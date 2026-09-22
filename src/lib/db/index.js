// ============================================================================
// Persistance — façade unique de l'application.
//
//   driver()  →  le pilote actif : « local » (IndexedDB du navigateur) ou
//                « service » (base partagée, joignable en socket ou en HTTP).
//
// La façade tient à jour, pour chaque collection, l'index des enregistrements
// connus du serveur (`snapshot`) : c'est lui qui permet de n'envoyer que les
// différences, enregistrement par enregistrement, et donc de ne pas écraser le
// travail d'un autre poste. En mode partagé, chaque lecture réussie est recopiée
// dans un miroir local (`actesMirror`) pour que l'application puisse démarrer
// même si le service est momentanément injoignable.
// ============================================================================

import * as localDriver from "./local.js";
import * as serviceDriver from "./service.js";
import {
  COLLECTIONS, SHARED_COLLECTIONS, DOCUMENT_COLLECTIONS, SILENT_COLLECTIONS,
  recordsOf, indexOf, diffRecords, reconcile, stableStringify, isLocalOnly, isSingleton,
} from "./contract.js";
import { definirCleService } from "../cle-service.js";
import { hostKv } from "../hosts.js";
import { sessionDeService, deploiementAuth, setDeploiementAuth } from "../auth.js";
import { enteteCsrf, jetonCsrfLisible, modeService, sessionCourante } from "../motdepasse.js";

// Les trois modes proposés à l'administrateur. `service` et `external` parlent
// le même contrat : seul le transport change (socket de l'environnement, ou HTTP
// vers un serveur MySQL/MariaDB installé par la collectivité).
export const MODES = [
  {
    id: "local",
    label: "Locale — ce navigateur",
    short: "Locale",
    help: "Les données restent sur ce poste (IndexedDB). Idéal pour la démonstration : rien à installer, tout est immédiat.",
    shared: false,
  },
  {
    id: "service",
    label: "Service de démonstration — partagé",
    short: "Service",
    help: "Le service partagé de démonstration conserve les données (50 Mio durables) : plusieurs postes voient le même référentiel, sans rien installer. Ne sait pas parler à MySQL.",
    shared: true,
    transport: "socket",
  },
  {
    id: "external",
    label: "Serveur externe — MySQL / MariaDB",
    short: "Serveur",
    help: "Les données vivent dans la base de la collectivité. Il faut déployer le service de données fourni (voir src/server/mysql/README.md) et renseigner son adresse et son jeton.",
    shared: true,
    transport: "http",
  },
];

// Édition statique (GitHub Pages) : le service de démonstration est **embarqué
// dans la page** (voir src/pages/host.js), donc son état vit dans le stockage de
// ce navigateur — il n'est pas partagé entre postes. On le dit dans le libellé :
// promettre un partage qui n'existe pas serait pire que de ne rien proposer.
if (globalThis.__SCRIBA_STATIC__) {
  const service = MODES.find((m) => m.id === "service");
  if (service) {
    service.label = "Service embarqué — ce navigateur";
    service.help = "Le service de démonstration est embarqué dans la page : il garde les données dans ce navigateur (8 Mio durables). Rien à installer, mais rien n'est partagé entre postes. Ne sait pas parler à MySQL.";
  }
}

export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];

const SETTINGS_FOLDER = "actesDb";
const MIRROR_FOLDER = "actesMirror";
const PENDING_FOLDER = "actesPending";
const PENDING_MAX = 200;

const DEFAULT_SETTINGS = {
  // Auto-hébergement : le service de données est celui du déploiement, sur la
  // même origine (`src/server/`). Ailleurs (démonstration statique), le défaut
  // reste le stockage du navigateur.
  mode: globalThis.__SCRIBA_SELF_HOSTED__ ? "external" : "local",
  url: globalThis.__SCRIBA_API_BASE__ || "",
  // Aucune clé par défaut : une clé inscrite dans le code servi serait publique,
  // donc inutile comme autorisation. Elle est remise par le déploiement, ou par
  // l'administrateur (voir src/lib/cles-service.js et l'écran Base de données).
  token: globalThis.__SCRIBA_API_TOKEN__ || "",
};

let settings = { ...DEFAULT_SETTINGS };
let driver = localDriver;
let snapshot = {};              // name → { rev, index: { id: { rev, json, ord } } }
let pending = [];               // écritures faites hors ligne, en attente de renvoi
// Ce que la file ne dit pas d'elle-même : depuis quand elle est ouverte, et ce
// que la base a répondu au dernier renvoi. Sans ces deux faits, une file muette
// grossit toute seule (un battement de cœur toutes les 25 secondes) et
// l'exploitant ne peut ni savoir pourquoi, ni quoi corriger. Voir CHANGELOG,
// notes 1.3.2k et 1.3.2l.
let pendingMeta = { depuis: null, derniereErreur: null };
let statusInfo = { mode: "local", state: "unknown", detail: "" };

const statusListeners = new Set();
const conflictListeners = new Set();

export const onStatus = (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); };
export const onConflict = (fn) => { conflictListeners.add(fn); return () => conflictListeners.delete(fn); };

function notify(set, arg) { set.forEach((f) => { try { f(arg); } catch (e) { console.error(e); } }); }

function setStatus(state, detail = "") {
  if (statusInfo.state === state && statusInfo.detail === detail && statusInfo.mode === settings.mode) return;
  statusInfo = { mode: settings.mode, state, detail };
  notify(statusListeners, status());
}

export const status = () => ({ ...statusInfo, mode: settings.mode, shared: !!driver.shared, label: modeById(settings.mode).short });

function kv() {
  return hostKv();
}

async function kvGet(folder, key, fallback) {
  const k = kv();
  if (!k || !k[folder]) return fallback;
  try {
    const v = await k[folder].get(key);
    return v === undefined || v === null ? fallback : v;
  } catch (e) { return fallback; }
}

async function kvSet(folder, key, value) {
  const k = kv();
  if (!k || !k[folder]) return false;
  try { await k[folder].set(key, value); return true; } catch (e) { console.warn("Écriture du miroir impossible :", e); return false; }
}

// ---------------------------------------------------------------- pilotage
// Les seuls réglages que cette façade connaît. Une écriture qui les rangerait
// tous sans filtre laisserait entrer, et CONSERVER, n'importe quelle clé
// (un `silent` de passage, par exemple) : `getSettings()` doit rendre des
// réglages, pas des restes de l'appel qui les a posés.
const CLES_REGLAGE = ["mode", "url", "token"];

const reglagesPropres = (source) => {
  const out = {};
  for (const k of CLES_REGLAGE) if (source && source[k] !== undefined) out[k] = source[k];
  return out;
};

// La file RELUE au démarrage passe par la même règle que la file vivante (voir
// `queueWrite`) : une file écrite par une version antérieure peut porter des
// dizaines d'entrées pour une même collection — un battement de cœur toutes les
// vingt-cinq secondes —, et la plus récente de chacune dit tout ce que les
// précédentes demandaient. Un lot FORCÉ (« Envoyer les données à la base »),
// lui, porte une intention que le calcul de différences ne sait pas exprimer :
// il n'est pas effacé par une écriture ordinaire.
function compacterFile(file) {
  const sortie = [];
  for (const e of file) {
    if (!e || typeof e !== "object" || !e.collection) continue;
    const remplaces = sortie.filter((x) => x.collection === e.collection && (!!e.force || !x.force));
    const plusAncienne = remplaces[0];
    for (const r of remplaces) sortie.splice(sortie.indexOf(r), 1);
    sortie.push({ ...e, at: (plusAncienne && plusAncienne.at) || e.at || new Date().toISOString() });
  }
  return sortie;
}

export async function init() {
  const saved = await kvGet(SETTINGS_FOLDER, "data", null);
  if (saved && typeof saved === "object") settings = { ...DEFAULT_SETTINGS, ...reglagesPropres(saved) };
  definirCleService(settings.token);
  const queue = await kvGet(PENDING_FOLDER, "data", null);
  if (Array.isArray(queue)) {
    pending = compacterFile(queue);
    // File rangée : on la réécrit, pour que le poste ne garde pas soixante-quinze
    // entrées dont une seule a encore quelque chose à dire.
    if (pending.length !== queue.length) await kvSet(PENDING_FOLDER, "data", pending);
  }
  const motif = await kvGet(PENDING_FOLDER, "meta", null);
  if (motif && typeof motif === "object") {
    pendingMeta = {
      depuis: motif.depuis || null,
      derniereErreur: motif.derniereErreur && typeof motif.derniereErreur === "object" ? motif.derniereErreur : null,
    };
  }
  try {
    driver = makeDriver();
  } catch (e) {
    console.warn("Pilote de persistance indisponible, repli sur le stockage local :", e);
    settings = { ...settings, mode: "local" };
    driver = localDriver;
  }
  setStatus("unknown", driver.shared ? "Connexion au service de données…" : "Stockage du navigateur.");
  return settings;
}

// ------------------------------------------------------- écritures en attente
// Une écriture qui échoue (réseau, service momentanément indisponible) n'est pas
// perdue : elle est mise en file et renvoyée dès que la base répond de nouveau.
// Les refus définitifs (jeton invalide, configuration) ne sont pas mis en file :
// il faut d'abord corriger le réglage.
const fatalStatus = (e) => e && (e.status === 401 || e.status === 403);

// Le libellé d'une collection, pour nommer dans une phrase ce qui est refusé.
const libelleCollection = (name) => (name && COLLECTIONS[name] && COLLECTIONS[name].label) || "";

// Ce que laisse deviner un refus de la base, et le geste qui le répare.
//
// Un `csrf_invalide` est LE refus muet : la session est valide (les lectures
// passent), la route répond, et pourtant chaque ÉCRITURE est refusée. Deux
// causes, dans cet ordre de fréquence :
//   • la page ne peut pas LIRE son jeton anti-CSRF — un cookie n'est lisible que
//     par les pages de SON hôte, si bien qu'une application servie par un hôte et
//     un service sur un autre laissent partir l'en-tête vide (le service voit
//     bien le cookie, mais pas l'en-tête qui doit lui correspondre) ;
//   • le cookie a disparu (refusé par le navigateur, session ouverte ailleurs).
// Dans les deux cas, le remède n'est pas « réessayer » : c'est de corriger le
// réglage, ou de recharger la page (le service rend le jeton avec la session).
//
// Les autres refus ont, eux aussi, une cause et un geste — et les laisser sans
// phrase rendait la file d'attente illisible : un `droit_requis` (une écriture
// de `users` ou de `config` laissée par une session d'administrateur, rejouée
// après qu'un compte ordinaire a pris la place) se contentait de dire
// « Écriture refusée par le service », et le seul conseil était de se
// reconnecter — alors que le geste juste est de se reconnecter EN
// ADMINISTRATEUR, ou d'abandonner cette écriture-là.
export function expliquerRefus({ code, base, collection } = {}) {
  if (code === "droit_requis" || code === "force_reserve_admin") {
    const quoi = libelleCollection(collection)
      ? `« ${libelleCollection(collection)} »`
      : "une collection réservée aux administrateurs (les comptes, le référentiel)";
    return `Cette écriture touche ${quoi} : seul un administrateur peut l'écrire, et la session ouverte ne l'est pas. Reconnectez-vous avec un compte d'administration pour la renvoyer, ou abandonnez-la depuis l'écran « Base de données ».`;
  }
  if (code === "session_absente") {
    return "La session n'a pas été présentée au service : elle a expiré, ou le cookie ne traverse pas jusqu'à lui (un service sur un autre SITE que l'application — le navigateur retient alors les cookies de session). Rechargez la page ; si cela persiste, reconnectez-vous.";
  }
  if (code === "jeton_invalide" || code === "jeton_absent" || code === "jeton_non_configure") {
    return "Le jeton d'API a été refusé : la clé inscrite sous « Base de données » ne correspond à aucune clé du service (API_TOKENS, dans le .env de la base).";
  }
  if (code !== "csrf_invalide") return "";
  const adresse = String(base === undefined ? (driver && driver.baseUrl) || "" : base || "");
  const hote = typeof location !== "undefined" && location ? String(location.host || "") : "";
  if (jetonCsrfLisible()) {
    return "La page lit bien son jeton anti-CSRF, mais la base le refuse : le jeton et la session ne viennent pas de la même connexion. Rechargez la page ; si cela persiste, reconnectez-vous.";
  }
  let hoteService = "";
  try { hoteService = adresse ? new URL(adresse).host : ""; } catch (e) { hoteService = ""; }
  if (hoteService && hote && hoteService !== hote) {
    return `La page ne peut pas lire son jeton anti-CSRF : le service est sur l'hôte « ${hoteService} » et l'application sur « ${hote} » — un cookie n'est lisible que par les pages de son hôte. Laissez l'« Adresse du service de données » vide : le service du déploiement est servi sur le même domaine (sous /v1/). Vérifiez aussi API_BASE dans le .env du service.`;
  }
  return "La page n'a pas trouvé de jeton anti-CSRF : le cookie a pu être refusé par le navigateur (un essai en clair avec COOKIE_SECURE=true), ou la session a été ouverte par un autre outil. Rechargez la page ; si cela persiste, reconnectez-vous.";
}

const memoireFile = () => ({ depuis: pendingMeta.depuis, derniereErreur: pendingMeta.derniereErreur });

async function sauverFile() {
  await kvSet(PENDING_FOLDER, "data", pending);
  await kvSet(PENDING_FOLDER, "meta", memoireFile());
}

// Une écriture en attente RESTE en attente : les différences qu'elle porte ont
// été calculées sur l'index serveur connu, et rien n'en a été appliqué (sinon la
// file l'aurait été). Une nouvelle écriture de la MÊME collection porte donc
// tout ce que la précédente demandait, et davantage : on remplace, au lieu
// d'empiler. Sans cela, un service injoignable une demi-heure laissait soixante-
// quinze écritures de battement de cœur à renvoyer, toutes décrivant le même
// poste — la plus ancienne n'ayant plus rien à dire.
async function queueWrite(entry, e) {
  if (pending.length >= PENDING_MAX) {
    setStatus("offline", `Trop d'écritures en attente de la base (${PENDING_MAX}) : cette modification n'a pas pu être mise de côté.`);
    return false;
  }
  const dejaLa = pending.filter((x) => x.collection === entry.collection);
  // Un lot FORCÉ — « Envoyer les données à la base » — porte une intention que le
  // calcul de différences ne sait pas exprimer : il impose l'état local, au lieu
  // de le faire arbitrer par les révisions. On ne l'efface donc pas au profit
  // d'une écriture ordinaire.
  const remplace = dejaLa.length > 0 && (!!entry.force || !dejaLa.some((x) => x.force));
  const at = remplace ? dejaLa[0].at : new Date().toISOString();
  if (remplace) pending = pending.filter((x) => x.collection !== entry.collection);
  pending.push({ at, ...entry });
  pendingMeta = {
    depuis: pendingMeta.depuis || new Date().toISOString(),
    derniereErreur: {
      at: new Date().toISOString(),
      collection: entry.collection,
      message: (e && e.message) || String(e || "échec sans message"),
      status: (e && e.status) || 0,
    },
  };
  await sauverFile();
  return true;
}

export const pendingCount = () => pending.length;

// Ce que l'écran « Base de données » montre de la file : combien d'écritures
// attendent, de quelles collections, depuis quand, et ce que la base a répondu
// au dernier renvoi. C'est ce qui permet de réparer au lieu de constater.
export function pendingInfo() {
  const parCollection = new Map();
  for (const e of pending) parCollection.set(e.collection, (parCollection.get(e.collection) || 0) + 1);
  return {
    count: pending.length,
    depuis: pendingMeta.depuis || null,
    derniereErreur: pendingMeta.derniereErreur || null,
    collections: [...parCollection.entries()]
      .map(([name, count]) => ({ name, label: (COLLECTIONS[name] && COLLECTIONS[name].label) || name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

// Renonce aux écritures en attente — geste d'administration, à faire après avoir
// lu le motif du refus. Une file qu'on ne peut pas vider est une file qui ment :
// ses écritures décrivent un état local périmé, et un rechargement de la page
// recalculera de toute façon ce qui reste à transmettre.
export async function viderPending() {
  const avant = pending.length;
  pending = [];
  pendingMeta = { depuis: null, derniereErreur: null };
  await sauverFile();
  return avant;
}

// Un renvoi n'est plus arrêté par la première entrée refusée.
//
// La file garde au plus une écriture par collection (voir `queueWrite`), et
// aucune entrée ne dépend d'une autre : chacune porte le calcul de différences
// fait sur l'index du service tel qu'il était quand elle a été mise de côté.
// Rien n'oblige donc à s'arrêter au premier échec — et s'y arrêter coûtait
// cher : une seule entrée définitivement refusée bloquait TOUTE la file
// derrière elle. Le cas type : une écriture de `users` ou de `config` mise de
// côté par une session d'administrateur, rejouée après qu'un compte ordinaire a
// pris la place du précédent — le service répond 403 `droit_requis`, et les
// collections suivantes (les actes que l'agent venait d'écrire, son journal, sa
// présence) ne partaient plus jamais. « Renvoyer maintenant » échouait à
// l'identique, et il ne restait que « Abandonner », qui perd le travail de tout
// le monde. On essaie donc CHAQUE entrée, on garde celles qui échouent (rien
// n'est perdu), et on rapporte le premier motif.
export async function flushPending() {
  if (!driver.shared || !pending.length) return { flushed: 0, left: pending.length, error: null };
  const reste = [];
  const touched = new Set();
  let flushed = 0;
  let error = null;
  // Une seule réparation de pilote par renvoi (voir `reparerPilote`) : elle
  // coûte deux appels au service, et le refus serait le même pour toutes les
  // entrées.
  let reparationFaite = false;
  const compter = (entry, r) => {
    if (r.conflicts && r.conflicts.length && !SILENT_COLLECTIONS.has(entry.collection)) {
      notify(conflictListeners, { collection: entry.collection, conflicts: r.conflicts });
    }
    touched.add(entry.collection);
    flushed += 1;
  };
  for (const entry of [...pending]) {
    let refus = null;
    for (let essai = 0; essai < 2; essai += 1) {
      try {
        compter(entry, await driver.write(entry.collection, { upserts: entry.upserts, deletes: entry.deletes, force: entry.force }));
        refus = null;
        break;
      } catch (e) {
        refus = {
          collection: entry.collection,
          message: (e && e.message) || String(e),
          status: (e && e.status) || 0,
          code: (e && e.code) || "",
        };
        // Un refus d'anti-CSRF ou de session peut venir d'un pilote bâti sur un
        // présage périmé du mode (voir `reparerPilote`). On répare, et on rejoue
        // l'entrée : c'est ce que faisait le bouton « Renvoyer maintenant »,
        // sans qu'il faille le cliquer.
        if (essai === 0 && !reparationFaite && !reparationEnCours && REJOUABLE.has(refus.code)) {
          reparationFaite = true;
          if (!(await reparerPilote().catch(() => false))) break;
          continue;
        }
        break;
      }
    }
    if (refus) {
      if (!error) error = refus;
      reste.push(entry);
    }
  }
  pending = reste;
  if (error) {
    // Un renvoi qui échoue ne doit pas laisser la pastille sur un état antérieur
    // (« base disponible » alors que rien ne passe) : il DIT ce que la base a
    // répondu, ce qui a été transmis malgré tout, et, quand le refus a une cause
    // connue, le geste qui le répare.
    pendingMeta = { ...pendingMeta, derniereErreur: { at: new Date().toISOString(), ...error } };
    const definitif = error.status === 401 || error.status === 403;
    const suite = expliquerRefus(error) || (definitif
      ? "Ces écritures-là ne repartiront pas tant que la cause n'aura pas changé : corrigez ce qui est refusé, puis renvoyez-les ; sinon, abandonnez-les depuis l'écran « Base de données »."
      : "Elles repartiront au prochain renvoi automatique.");
    setStatus(definitif ? "error" : "offline",
      `Écritures en attente : la base a refusé le renvoi de ${libelleCollection(error.collection) ? `« ${libelleCollection(error.collection)} »` : "l'une des collections"} (${error.message}). ` +
      (flushed ? `${flushed} autre(s) écriture(s) ont été transmises. ` : "") + suite);
  } else if (flushed) {
    setStatus("ok", `${flushed} écriture(s) différée(s) transmise(s) à la base.`);
  }
  // File refermée : plus rien à dater. On garde le motif du dernier refus — il
  // reste la trace de ce qui vient de se passer, et l'écran peut le montrer.
  if (!pending.length) pendingMeta = { depuis: null, derniereErreur: pendingMeta.derniereErreur };
  await sauverFile();
  // Les écritures rejouées ont fait avancer les révisions : on relit les
  // collections concernées pour que l'index local reste aligné sur la base.
  for (const name of touched) {
    try { await readCollection(name); } catch (e) { /* la prochaine lecture s'en chargera */ }
  }
  return { flushed, left: pending.length, error };
}

// ------------------------------------------------------------- reprise auto
// La file n'était rejouée que par une lecture ou un contrôle de santé : un poste
// laissé sur un écran immobile — une page ouverte, personne devant — pouvait donc
// garder ses écritures des heures, même après le retour de la base. On la
// represente nous-mêmes : doucement (trente secondes), seulement quand il y a
// quelque chose à renvoyer, et jamais deux renvois à la fois.
let reprise = null;
let repriseEnCours = false;
async function repriseTick() {
  if (repriseEnCours || !driver.shared || !pending.length) return;
  repriseEnCours = true;
  try { await flushPending(); }
  catch (e) { console.warn("Renvoi des écritures en attente :", e); }
  finally { repriseEnCours = false; }
}

export function reprendreAuto({ intervalMs = 30000 } = {}) {
  if (reprise) return false;
  reprise = setInterval(repriseTick, Math.max(5000, intervalMs));
  if (typeof globalThis.addEventListener === "function") globalThis.addEventListener("online", () => { repriseTick(); });
  return true;
}

export function arreterRepriseAuto() {
  if (reprise) { clearInterval(reprise); reprise = null; }
  return true;
}

// Le régime sur lequel le pilote COURANT a été bâti (voir `makeDriver`), pour
// savoir s'il faut le refaire quand le service annonce autre chose — voir
// `rafraichirPilote`. `null` = aucun pilote partagé.
let piloteParSession = null;

function makeDriver() {
  const mode = modeById(settings.mode);
  if (!mode.shared) { piloteParSession = null; return localDriver; }
  // Le mode « service de démonstration » utilise toujours son propre jeton (son
  // empreinte est inscrite dans le service lui-même) : les champs adresse et
  // jeton ne concernent que le serveur externe.
  const external = settings.mode === "external";
  // Mode « comptes locaux (mot de passe) » : il n'y a pas de jeton d'API — la
  // porte est la SESSION du service, dans un cookie `HttpOnly`, et les écritures
  // portent le jeton anti-CSRF relu du cookie (voir src/lib/motdepasse.js).
  const parSession = sessionDeService();
  piloteParSession = parSession;
  return serviceDriver.create({
    baseUrl: external ? settings.url : "",
    token: parSession ? "" : (settings.token || ""),
    transport: mode.transport,
    credentials: parSession ? "include" : "same-origin",
    csrf: parSession ? enteteCsrf : null,
    label: mode.short + " · base de données",
  });
}

export async function setSettings(patch, { silent = false } = {}) {
  const prevSettings = settings;
  const prevDriver = driver;
  settings = { ...settings, ...reglagesPropres(patch) };
  definirCleService(settings.token);
  try {
    driver = makeDriver();
  } catch (e) {
    settings = prevSettings;
    driver = prevDriver;
    throw e;
  }
  await kvSet(SETTINGS_FOLDER, "data", settings);
  snapshot = {};
  setStatus("unknown", driver.shared ? "Connexion au service de données…" : "Stockage du navigateur.");
  if (!silent) await health();
  return settings;
}

export const getSettings = () => ({ ...settings });
export const driverId = () => (driver.shared ? "service:" + (driver.transport || "") : "local");
export const isShared = () => !!driver.shared;
export const isLocalMode = () => !driver.shared;

// Le MODE DU DÉPLOIEMENT peut être connu APRÈS la création du pilote : le
// pilote est bâti dès `init()`, sur ce que la page annonçait, et le service dit
// le reste seulement après (`GET /v1/auth/config`, voir `src/ui/state.js`). Si
// les deux diffèrent, le pilote doit être refait : en mode « mot de passe »,
// une écriture part sans l'en-tête anti-CSRF (et avec un jeton qui ne sert
// plus) — le service la refuse (403 `csrf_invalide`) alors qu'il SERT les
// lectures, si bien que la pastille d'état passait au rouge à chaque geste et
// que l'enregistrement échouait, sans que rien ne dise pourquoi.
//
// Sans changement, c'est un non-geste : on ne refait pas le pilote pour rien.
export async function rafraichirPilote() {
  const attendu = sessionDeService();
  if (piloteParSession === attendu) return false;
  try {
    driver = makeDriver();
  } catch (e) {
    console.warn("Pilote de persistance indisponible, repli sur le stockage local :", e);
    settings = { ...settings, mode: "local" };
    driver = localDriver;
    piloteParSession = null;
  }
  setStatus("unknown", driver.shared ? "Connexion au service de données…" : "Stockage du navigateur.");
  await health();
  return true;
}

// Les codes de refus qu'un pilote bâti sur un présage périmé du mode provoque :
// le service refuse l'écriture faute de jeton anti-CSRF (ou faute de session,
// quand le cookie ne part même pas). Voir `reparerPilote`.
const REJOUABLE = new Set(["csrf_invalide", "session_absente"]);

let reparationEnCours = null;
let derniereReparation = 0;

// Répare un pilote bâti sur un présage périmé du mode du service.
//
// Le pilote est bâti à `init()` sur ce que la PAGE annonce (`window.__SCRIBA_AUTH__`,
// posé par le déploiement) ; le service dit le sien par `GET /v1/auth/config`
// (voir src/ui/state.js). Si cet appel échoue — le service redémarrait au moment
// où la page s'est chargée —, rien ne le refaisait : le pilote gardait
// `credentials: "same-origin"` et aucun anti-CSRF, et chaque écriture était
// refusée (`csrf_invalide`, ou `session_absente` si le cookie ne traversait
// pas) POUR TOUJOURS, sans autre issue qu'un rechargement de la page. On répare
// donc à la demande : on redemande le mode, on relit la session (le service rend
// le jeton anti-CSRF avec elle), et on refait le pilote si le régime a changé.
//
// Rend `true` quand quelque chose a été rafraîchi (mode, jeton, ou pilote) : la
// copie de l'entrée refusée mérite alors un second essai.
export function reparerPilote({ force = false } = {}) {
  if (reparationEnCours) return reparationEnCours;
  // Un refus définitif se répète à chaque battement (toutes les trente
  // secondes) : on ne redemande pas le mode plus d'une fois par demi-minute,
  // sauf geste explicite de l'administrateur (« Renvoyer maintenant »).
  if (!force && Date.now() - derniereReparation < 20000) return Promise.resolve(false);
  derniereReparation = Date.now();
  reparationEnCours = (async () => {
    let rafraichi = false;
    try {
      const r = await modeService();
      if (r && r.ok && r.body && r.body.auth) {
        // On garde ce que le service a déjà dit de son état (base joignable,
        // amorçage du compte d'administration…) : la découverte du mode ne doit
        // pas effacer l'écran de connexion.
        setDeploiementAuth({ ...(deploiementAuth() || {}), mode: r.body.auth, demo: r.body.demo !== false, demoJeu: r.body.demoJeu });
        rafraichi = true;
      }
      const s = await sessionCourante();
      if (s && s.ok) rafraichi = true;
    } catch (e) {
      // Service injoignable : la réparation attendra le prochain renvoi.
    }
    try { if (await rafraichirPilote()) rafraichi = true; } catch (e) { /* on garde le pilote courant */ }
    return rafraichi;
  })().finally(() => { reparationEnCours = null; });
  return reparationEnCours;
}

export async function health() {
  // Mode local : une simple vérification de disponibilité suffit (pas de probe
  // écrit sur le disque à chaque appel).
  if (!driver.shared) {
    const ok = localDriver.available();
    setStatus(ok ? "ok" : "error", ok
      ? "Stockage du navigateur disponible (données locales à ce poste)."
      : "Le stockage du navigateur est indisponible (navigation privée ?).");
    return statusInfo;
  }
  const res = await driver.health();
  // Un jeton refusé ou un service mal configuré est une erreur ; un service
  // momentanément injoignable est une indisponibilité (l'application continue
  // sur le miroir local).
  const fatal = res.status === 401 || res.status === 403 || res.status === 503;
  // Un service qui ne rend AUCUN message laisserait la pastille rouge sans
  // motif : on écrit alors ce que le transport a répondu (le code HTTP), pour
  // que l'écran ne montre jamais « Erreur de connexion » sans rien d'autre.
  setStatus(res.ok ? "ok" : fatal ? "error" : "offline",
    res.detail || (res.status ? `Le service de données a répondu ${res.status}, sans message.` : "Le service de données n'a rien répondu."));
  // Jamais pendant une réparation de pilote : celle-ci passe par ici
  // (`reparerPilote` → `rafraichirPilote` → `health`), et un renvoi de file
  // demanderait alors à nouveau la réparation en cours — qui attendrait sa
  // propre fin. La file sera rejouée au battement suivant.
  if (res.ok && pending.length && !reparationEnCours) await flushPending();
  return { ...statusInfo, info: res.info, httpStatus: res.status || 0 };
}

// Teste un réglage sans l'appliquer (bouton « Tester la connexion »).
export async function test(patch = {}) {
  const merged = { ...settings, ...patch };
  const mode = modeById(merged.mode);
  if (!mode.shared) {
    const res = await localDriver.health();
    return { ok: res.ok, detail: res.detail || (res.ok ? "Stockage du navigateur disponible." : ""), info: res.info, ecriture: null };
  }
  const external = merged.mode === "external";
  // La porte est celle du DÉPLOIEMENT : en mode « mot de passe », le service
  // vérifie une SESSION (cookie) et l'anti-CSRF, jamais le jeton. Sonder avec
  // le seul jeton ferait déclarer « Échec de la connexion » à un service qui
  // fonctionne — l'essai doit passer par ce qui ouvre vraiment.
  const parSession = sessionDeService();
  const probe = serviceDriver.create({
    baseUrl: external ? merged.url : "",
    token: parSession ? "" : (merged.token || ""),
    transport: mode.transport,
    credentials: parSession ? "include" : "same-origin",
    csrf: parSession ? enteteCsrf : null,
    label: "test de connexion",
  });
  const res = await probe.health();
  // Le test doit dire ce qui COMPTE : la base accepte-t-elle d'écrire ? La route
  // de santé répond sans session et sans anti-CSRF — elle peut donc réussir
  // pendant que chaque geste est refusé, et l'écran affichait alors « Connexion
  // réussie » à côté d'une pastille rouge et d'une file d'écritures en attente
  // (voir CHANGELOG, note 1.3.2k).
  const ecriture = typeof probe.essaiEcriture === "function" ? await probe.essaiEcriture() : null;
  return { ok: res.ok, detail: res.detail, info: res.info, ecriture };
}

// ---------------------------------------------------------------- lecture
async function readCollection(name) {
  const res = await driver.read(name);
  const records = res.records || recordsOf(name, res.value);
  const index = {};
  for (const r of records) index[r.id] = { rev: r.rev ?? null, json: stableStringify(r.payload), ord: r.ord || 0 };
  snapshot[name] = { rev: res.revision ?? 0, index };
  await kvSet(MIRROR_FOLDER, name, res.value);
  return res.value;
}

// `fresh` force la lecture du service (sans passer par le miroir).
export async function read(name, { fresh = false } = {}) {
  if (!COLLECTIONS[name]) return null;
  if (isLocalOnly(name)) return (await localDriver.read(name)).value;
  if (driver.shared && fresh) {
    if (pending.length) await flushPending();
    return readCollection(name);
  }
  if (driver.shared) {
    if (pending.length) await flushPending();
    try {
      const value = await readCollection(name);
      if (statusInfo.state !== "ok") setStatus("ok", "Service de données disponible.");
      return value;
    } catch (e) {
      const mirror = await kvGet(MIRROR_FOLDER, name, null);
      if (fatalStatus(e)) {
        // Le service répond, mais refuse : clé absente, invalide, ou service non
        // provisionné. Ce n'est pas une panne réseau — le dire clairement évite
        // de chercher une coupure qui n'existe pas.
        setStatus("error", `Le service a refusé la lecture (${(e && e.message) || e}). Données locales de secours utilisées.`);
      } else {
        setStatus("offline", `Service injoignable (${(e && e.message) || e}). Données locales de secours utilisées.`);
      }
      return mirror;
    }
  }
  return (await driver.read(name)).value;
}

// ---------------------------------------------------------------- écriture
export async function write(name, value, { force = false } = {}) {
  if (!COLLECTIONS[name]) return { ok: false, error: "Collection inconnue : " + name };

  if (isLocalOnly(name)) {
    await localDriver.write(name, { value });
    if (driver.shared) await kvSet(MIRROR_FOLDER, name, value);
    return { ok: true };
  }

  if (!driver.shared) {
    await localDriver.write(name, { value });
    snapshot[name] = { rev: 0, index: indexOf(recordsOf(name, value)) };
    return { ok: true };
  }

  const next = recordsOf(name, value);
  const base = snapshot[name]?.index || {};
  const { upserts, deletes } = diffRecords(next, base);
  if (!upserts.length && !deletes.length) return { ok: true, unchanged: true };

  let res;
  // Une écriture qui échoue est rejouée UNE fois quand le refus vient de
  // l'anti-CSRF ou de la session : le pilote peut avoir été bâti sur un présage
  // périmé du mode (voir `reparerPilote`). C'est le premier geste de l'agent
  // après un démarrage où le service n'a pas pu annoncer son mode : il échouait,
  // et rien ne le lui disait.
  const tenter = () => driver.write(name, { upserts, deletes, force });
  try {
    res = await tenter();
  } catch (premier) {
    await kvSet(MIRROR_FOLDER, name, value);
    let e = premier;
    if (REJOUABLE.has((e && e.code) || "") && !reparationEnCours
      && await reparerPilote({ force: true }).catch(() => false)) {
      try { res = await tenter(); } catch (deuxieme) { e = deuxieme; }
    }
    if (!res) {
      if (fatalStatus(e)) {
        const suite = expliquerRefus({ code: (e && e.code) || "", collection: name }) || (sessionDeService()
          ? "Rechargez la page ; si cela persiste, reconnectez-vous."
          : "Vérifiez le réglage de la base.");
        setStatus("error", `Écriture refusée par le service (${(e && e.message) || e}). ${suite}`);
        return { ok: false, error: (e && e.message) || String(e), code: (e && e.code) || "" };
      }
      await queueWrite({ collection: name, upserts, deletes, force }, e);
      setStatus("offline", `Écriture différée (${(e && e.message) || e}). Elle sera transmise dès que la base répondra — l'écran « Base de données » en tient la liste et le motif.`);
      return { ok: false, deferred: true, error: (e && e.message) || String(e) };
    }
  }

  const index = { ...base };
  const payloadById = new Map(upserts.map((u) => [u.id, u]));
  for (const a of res.applied || []) {
    const u = payloadById.get(a.id);
    index[a.id] = { rev: a.rev, json: stableStringify(u ? u.payload : null), ord: u ? u.ord : 0 };
  }
  const conflictIds = new Set((res.conflicts || []).map((c) => c.id));
  for (const d of deletes) if (!conflictIds.has(d.id)) delete index[d.id];
  for (const c of res.conflicts || []) {
    if (c.deleted) delete index[c.id];
    else index[c.id] = { rev: c.rev, json: stableStringify(c.payload), ord: c.ord || 0 };
  }
  snapshot[name] = { rev: res.revision ?? (snapshot[name]?.rev || 0), index };

  let reconciled = value;
  if (res.conflicts && res.conflicts.length) {
    reconciled = reconcile(name, value, res.conflicts);
    if (!SILENT_COLLECTIONS.has(name)) notify(conflictListeners, { collection: name, conflicts: res.conflicts });
  }
  await kvSet(MIRROR_FOLDER, name, reconciled);
  setStatus("ok", "Service de données disponible.");
  return { ok: true, conflicts: res.conflicts || [], value: reconciled };
}

export async function remove(name) {
  if (!COLLECTIONS[name]) return { ok: false };
  if (isLocalOnly(name)) return localDriver.remove(name);
  const res = await driver.remove(name);
  snapshot[name] = { rev: 0, index: {} };
  await kvSet(MIRROR_FOLDER, name, isSingleton(name) ? null : []);
  return res;
}

// -------------------------------------------------------------- bascule/transfert
// Envoie les documents fournis vers le pilote actif, en forçant l'écriture
// (l'appelant est administrateur et sait ce qu'il fait).
export async function push(values) {
  const out = [];
  for (const name of SHARED_COLLECTIONS) {
    if (!(name in values)) continue;
    const r = await write(name, values[name], { force: true });
    out.push({ name, ok: !!r.ok, error: r.error });
  }
  return out;
}

// Récupère l'état du service et le recopie aussi dans le stockage local.
export async function pull({ mirrorToLocal = true } = {}) {
  const out = {};
  for (const name of SHARED_COLLECTIONS) {
    try {
      const value = await read(name, { fresh: true });
      out[name] = { ok: true, value };
      if (mirrorToLocal) await localDriver.write(name, { value });
    } catch (e) {
      out[name] = { ok: false, error: (e && e.message) || String(e) };
    }
  }
  return out;
}

// Réinitialise toutes les collections partagées (le mode local efface, le mode
// partagé supprime les enregistrements). `garder` ÉPARGNE des collections : une
// remise à zéro du référentiel ne doit pas emporter les COMPTES quand ils sont
// ceux du déploiement (voir `clearAll`, src/lib/store.js, et la note 1.3.2p).
export async function clearAll({ garder = [] } = {}) {
  const epargne = new Set(garder);
  for (const name of SHARED_COLLECTIONS) {
    if (epargne.has(name)) continue;
    try { await remove(name); } catch (e) { console.warn("Réinitialisation de " + name + " impossible :", e); }
  }
  snapshot = {};
  return true;
}

export { COLLECTIONS, SHARED_COLLECTIONS, DOCUMENT_COLLECTIONS, localDriver };
