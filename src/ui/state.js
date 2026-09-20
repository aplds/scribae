import { bootstrap, saveConfig, saveTrames, saveActes, saveUsers, saveSession, initStorage } from "../lib/store.js";
import { can as userCan, seedUsers, accountUsable, syncDemoAccounts, fullName } from "../lib/users.js";
import { demoAccountsDisabled, isOidc, authConfig } from "../lib/auth.js";
import { applyOidcUser } from "../lib/oidc.js";
import { inScope } from "../lib/scope.js";
import { tramePublishable } from "../lib/schema.js";
import { styleRuntimeCss, generalPageCss } from "../lib/styles.js";
import { isDark, brandColors, lighten } from "../lib/theme.js";
import { debounce } from "../lib/util.js";
import * as collab from "../lib/collab.js";
import { circuitFor, etapePour, validationAJour, validationPourSignature } from "../lib/validation.js";
import { statutExecution, alertes as alertesExecution } from "../lib/execution.js";

export const state = {
  config: null,
  trames: [],
  actes: [],
  users: [],
  user: null,
  route: { view: "trames", params: {} },
  ready: false,
  firstRun: false,
  storageOk: true,
  draft: {},
};

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

// Une vue s'enregistre ici pour pouvoir se redessiner toute seule sans que
// chaque module ait besoin de re-rendre la coquille (en-tête + navigation).
let viewRenderer = null;
let renderQueued = false;

export function setViewRenderer(fn) { viewRenderer = fn; }

// Redessine la vue courante. Le redessin est différé d'une micro-tâche et
// coalescé, pour deux raisons :
//  1. un gestionnaire `blur` ne doit jamais reconstruire le DOM pendant que
//     l'éditeur le parcourt ou le vide (sinon `removeChild` lève NotFoundError) ;
//  2. plusieurs demandes dans le même geste utilisateur ne coûtent qu'un rendu.
export function redrawView() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => {
    renderQueued = false;
    try { if (viewRenderer) viewRenderer(); } catch (e) { console.error(e); }
  });
}

const persistConfig = debounce(() => saveConfig(state.config), 400);
const persistTrames = debounce(() => saveTrames(state.trames), 400);
const persistActes = debounce(() => saveActes(state.actes), 400);

export function touch(what = "config", { rerender = true } = {}) {
  if (what === "config") persistConfig();
  if (what === "trames") persistTrames();
  if (what === "actes") persistActes();
  if (rerender) emit();
}

export async function init() {
  await initStorage();
  const { config, trames, actes, users, session, firstRun } = await bootstrap();
  state.config = config;
  state.trames = trames;
  state.actes = actes;
  state.users = users;
  const fromSession = session?.userId ? users.find((u) => u.id === session.userId) : null;
  // Un compte désactivé — ou un compte de démonstration alors que l'annuaire est
  // branché — ne rouvre pas de session : on repart de l'écran de connexion.
  state.user = fromSession && accountUsable(state.config, fromSession) ? fromSession : null;
  state.firstRun = firstRun;
  state.ready = true;
  applyBrand();
  emit();
  // Présence et journal : démarrés seulement quand une session est ouverte (le
  // battement de cœur porte l'identité du compte connecté). Voir src/lib/collab.js.
  if (state.user) collab.demarrer(state.user).catch((e) => console.warn("Collaboration indisponible :", e));
}

// ------------------------------------------------------------------ comptes
// Le contrôle d'accès est centralisé ici : les vues n'appellent que `can`.
export const can = (perm) => userCan(state.user, perm);
export const isAdmin = () => state.user?.role === "administrateur";
export const currentUser = () => state.user;

export async function login(userId) {
  const u = state.users.find((x) => x.id === userId);
  if (!u || !accountUsable(state.config, u)) return false;
  // Quand l'annuaire est branché, seule une session ouverte par l'annuaire est
  // possible : un compte local pré-enregistré attend sa première connexion
  // fédérée (il ne peut pas être choisi dans une liste).
  if (isOidc(state.config) && !u.oidcSub) return false;
  u.lastLogin = new Date().toISOString();
  state.user = u;
  await saveUsers(state.users);
  await saveSession({ userId: u.id, at: u.lastLogin });
  emit();
  collab.demarrer(u).catch((e) => console.warn("Collaboration indisponible :", e));
  return true;
}

// Ouverture de session après authentification par l'annuaire (voir
// src/lib/oidc.js) : le compte est créé ou repris à partir des revendications,
// puis la session est ouverte. Rend `{ok, user, created, linked}` ou
// `{ok: false, reason}` — le refus est motivé, l'écran de connexion l'affiche.
export async function loginWithClaims(claims) {
  const res = applyOidcUser(state.config, state.users, claims);
  if (res.denied) return { ok: false, reason: res.reason };
  const sync = syncDemoAccounts(state.config, res.users);
  const u = sync.changed ? sync.users.find((x) => x.id === res.user.id) : res.user;
  u.lastLogin = new Date().toISOString();
  u.oidcSyncedAt = new Date().toISOString();
  state.users = sync.users;
  state.user = u;
  await saveUsers(state.users);
  await saveSession({ userId: u.id, at: u.lastLogin, via: "oidc" });
  emit();
  collab.demarrer(u).catch((e) => console.warn("Collaboration indisponible :", e));
  return { ok: true, user: u, created: res.created, linked: res.linked, role: res.role };
}

export async function logout() {
  // On quitte proprement : notre présence est retirée (les autres postes ne nous
  // attendent pas 70 secondes), et le verrou de rédaction tombe avec elle.
  await collab.arreter().catch(() => {});
  state.user = null;
  await saveSession(null);
  emit();
}

export async function setUsers(users) {
  // Les comptes de démonstration restent désactivés tant que l'annuaire est
  // branché, quelle que soit la façon dont la liste a été modifiée (création,
  // modification, import, réinstallation du jeu de démonstration).
  const sync = syncDemoAccounts(state.config, users);
  state.users = sync.users;
  // Un compte désactivé ou supprimé pendant la session : on ferme la session.
  if (state.user) {
    const still = state.users.find((u) => u.id === state.user.id);
    if (!still || !accountUsable(state.config, still)) { await logout(); return; }
    state.user = still;
  }
  await saveUsers(state.users);
  emit();
}

export const resetDemoUsers = async () => setUsers(seedUsers(state.config));

// ------------------------------------------------------------------ annuaire
// Applique le mode d'authentification qui vient d'être réglé : désactive (ou
// réactive) les comptes de démonstration, et ferme la session si le compte
// connecté n'est plus utilisable. Rend de quoi prévenir l'utilisateur.
export async function applyAuthMode() {
  const sync = syncDemoAccounts(state.config, state.users);
  if (sync.changed) {
    state.users = sync.users;
    await saveUsers(state.users);
  }
  // Le compte connecté n'est plus utilisable (compte de démonstration alors que
  // l'annuaire est branché, ou compte désactivé) : on referme la session. Le
  // réglage d'un simple paramètre, lui, ne déconnecte personne.
  const detached = !!state.user && !accountUsable(state.config, state.user);
  if (detached) await logout();
  touch("config");
  return { disabled: sync.disabled.length, restored: sync.restored.length, demoDisabled: demoAccountsDisabled(state.config), detached };
}

// Un rédacteur ne voit que ses actes (et ceux qui n'ont pas d'auteur, hérités
// d'un import : personne ne les « possède »), et chacun ne voit que ce qui
// relève de son périmètre (services et bureaux — voir src/lib/scope.js). Un
// acte à la corbeille ne fait plus partie du registre : il a son propre écran.
export const estCorbeille = (x) => !!x?.deletedAt;

export function visibleActes() {
  const tous = can("actes.tous");
  const me = state.user?.id;
  return state.actes.filter((a) => {
    if (estCorbeille(a)) return false;
    if (!tous && a.createdBy && a.createdBy !== me) return false;
    return inScope(state.config, state.user, a);
  });
}

// Les trames visibles : celles qui relèvent du périmètre du compte (une trame
// sans service — générale ou héritée — reste visible par tous).
export function visibleTrames() {
  return state.trames.filter((t) => !estCorbeille(t) && inScope(state.config, state.user, t));
}

// ------------------------------------------------------------------ corbeille
// La suppression est RÉVERSIBLE : l'objet est marqué (`deletedAt`) et quitte le
// registre, mais reste dans le document jusqu'à sa suppression définitive. Une
// trame supprimée par erreur, un acte mis de côté : rien n'est perdu par
// inadvertance.
export function actesCorbeille() {
  const tous = can("actes.tous");
  const me = state.user?.id;
  return state.actes.filter((a) => {
    if (!estCorbeille(a)) return false;
    if (!tous && a.createdBy && a.createdBy !== me) return false;
    return inScope(state.config, state.user, a);
  }).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
}

export function tramesCorbeille() {
  return state.trames.filter((t) => estCorbeille(t) && inScope(state.config, state.user, t))
    .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
}

export async function mettreALaCorbeille(type, obj) {
  const at = new Date().toISOString();
  obj.deletedAt = at;
  obj.deletedBy = state.user?.id || "";
  obj.deletedByName = state.user ? fullName(state.user) : "";
  await journaliser({
    action: "corbeille", cible: type, cibleLabel: libelleObjet(type, obj),
    acteId: type === "acte" ? obj.id : "",
    detail: "placé à la corbeille", to: [],
  });
  touch(type === "acte" ? "actes" : "trames");
  return obj;
}

export async function restaurer(type, obj) {
  delete obj.deletedAt;
  delete obj.deletedBy;
  delete obj.deletedByName;
  await journaliser({
    action: "restauration", cible: type, cibleLabel: libelleObjet(type, obj),
    acteId: type === "acte" ? obj.id : "",
    detail: "restauré depuis la corbeille", to: [],
  });
  touch(type === "acte" ? "actes" : "trames");
  return obj;
}

// Suppression définitive : l'objet quitte le document. Réservée à qui peut
// gérer des actes (ou des trames) — la corbeille n'est pas une porte dérobée.
export async function supprimerDefinitivement(type, obj) {
  const liste = type === "acte" ? state.actes : state.trames;
  const i = liste.findIndex((x) => x.id === obj.id);
  if (i < 0) return false;
  await journaliser({
    action: "suppression", cible: type, cibleLabel: libelleObjet(type, obj),
    detail: "supprimé définitivement", to: [],
  });
  liste.splice(i, 1);
  touch(type === "acte" ? "actes" : "trames");
  return true;
}

const libelleObjet = (type, obj) =>
  type === "acte" ? (obj.numero || obj.objet || obj.id) : (obj.name || obj.id);

// --------------------------------------------------------------- journal
// Une seule fonction pour écrire dans le registre des faits : elle complète
// l'entrée avec le compte courant, l'écrit et rafraîchit les pastilles.
export async function journaliser(entry) {
  try {
    return await collab.journaliser({ by: state.user?.id || "", byName: state.user ? fullName(state.user) : "", ...entry });
  } catch (e) {
    console.warn("Journal indisponible :", e);
    return null;
  }
}

// --------------------------------------------------------------- parapheur
// Le circuit applicable à un acte : celui de sa trame, résolu dans le référentiel.
export const circuitDe = (acte) => circuitFor(state.config, { trame: trameById(acte?.trameId), acte });

// L'étape que le compte courant peut franchir sur cet acte (null sinon).
export const etapeAParachever = (acte) => etapePour(acte, state.user, state.config);

// Les actes qui attendent un geste de ma part, puis ceux en cours chez d'autres.
export function parapheur() {
  const tous = visibleActes();
  const aMoi = [];
  const enCours = [];
  const valides = [];
  const rejets = [];
  for (const a of tous) {
    const v = a.validation;
    if (!v) continue;
    if (!validationAJour(a)) { enCours.push(a); continue; }
    if (v.statut === "en_cours") {
      if (etapeAParachever(a)) aMoi.push(a); else enCours.push(a);
    } else if (v.statut === "valide") valides.push(a);
    else rejets.push(a);
  }
  const tri = (l) => l.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { aMoi: tri(aMoi), enCours: tri(enCours), valides: tri(valides), rejets: tri(rejets), horsCircuit: tous.filter((a) => !a.validation) };
}

// Un acte peut-il être envoyé en signature du point de vue du parapheur ?
export const pretPourSignature = (acte) => validationPourSignature(acte);

// -------------------------------------------------------------- exécution
export const executionDe = (acte) => statutExecution(acte, state.config, { publiable: actePubliable(acte), trame: trameById(acte?.trameId) });
export const alertesDe = (acte) => alertesExecution(acte, state.config, { publiable: actePubliable(acte), trame: trameById(acte?.trameId) });

// ------------------------------------------------------------ collaboration
// La couche de collaboration (présence, verrou de rédaction, journal) est
// ré-exportée ici pour que les vues n'aient qu'un seul module à connaître.
export const signalerEcranCollab = (ecran, opts) => collab.signalerEcran(ecran, opts);
export const signalerRedaction = (id, label) => collab.signalerRedaction(id, label);
export const libererRedaction = () => collab.libererRedaction();
export const quiRedige = (acteId) => collab.quiRedige(acteId);
export const presencesActives = () => collab.presencesActives();
export const enLigne = () => collab.enLigne();
export const journalPour = (opts) => collab.journalPour(opts);
export const notifications = (opts) => collab.notifications(state.user, { actesVisibles: visibleActes(), ...opts });
export const marquerVu = () => collab.marquerVu(state.user?.id);
export const surChangementCollab = (fn) => collab.surChangement(fn);
export const rafraichirCollab = () => collab.rafraichir();

export const userById = (id) => state.users.find((u) => u.id === id);

export function applyBrand() {
  const b = state.config?.brand || {};
  const r = document.documentElement.style;
  // La couleur de la marque est adaptée au thème : un bleu très foncé est
  // illisible sur un fond sombre. `--brand-light` garde la teinte d'origine —
  // c'est elle que reprennent les papiers (`[data-theme="dark"] .paper`), qui
  // restent clairs.
  if (b.color) r.setProperty("--brand-light", b.color);
  const bc = brandColors(b.color);
  if (bc.brand) r.setProperty("--brand", bc.brand);
  if (bc.soft) r.setProperty("--brand-soft", bc.soft);
  else r.removeProperty("--brand-soft");
  if (b.colorDark) r.setProperty("--brand-dark", isDark() ? lighten(b.colorDark, 0.7) : b.colorDark);
  if (b.uiFont) r.setProperty("--font-ui", b.uiFont);
  if (b.documentFont) r.setProperty("--font-doc", b.documentFont);
  applySheets();
}

// Les feuilles de style (charte graphique) des documents vivent dans une
// feuille <style> à part, tenue à jour ici : chaque feuille est confinée à ses
// propres documents (`[data-sheet="…"]`), de sorte que l'aperçu montre, sur le
// même écran, plusieurs chartes sans qu'elles se mélangent. Rejouée à chaque
// changement du référentiel — elle est idempotente.
// Une seconde feuille porte la règle `@page` : quand on imprime directement
// l'aperçu (Ctrl+P), c'est la charte GÉNÉRALE qui donne ses marges à la page.
export function applySheets() {
  if (!state.config) return;
  let el = document.getElementById("sheet-css");
  if (!el) {
    el = document.createElement("style");
    el.id = "sheet-css";
    document.head.appendChild(el);
  }
  el.textContent = styleRuntimeCss(state.config);
  let page = document.getElementById("sheet-print-css");
  if (!page) {
    page = document.createElement("style");
    page.id = "sheet-print-css";
    document.head.appendChild(page);
  }
  page.textContent = "@media print{" + generalPageCss(state.config) + "}";
}

const ROUTE_WITH_ID = ["trame", "rediger", "acte", "aide", "modifier", "publication", "docs"];

export function navigate(path) {
  const raw = String(path).replace(/^#?\/?/, "");
  const [view, ...rest] = raw.split("/");
  const params = {};
  if (ROUTE_WITH_ID.includes(view) && rest[0]) params.id = rest[0];
  state.route = { view: view || "trames", params };
  emit();
}

// Compatibilité : accepte un lien profond #/… sans jamais écrire dans le hash
// (l'environnement d'édition utilise le hash pour ses propres besoins).
export function parseRoute() {
  const raw = (location.hash || "").replace(/^#\/?/, "");
  if (!raw || !location.hash.startsWith("#/")) return;
  const [view, ...rest] = raw.split("/");
  const params = {};
  if (ROUTE_WITH_ID.includes(view) && rest[0]) params.id = rest[0];
  state.route = { view: view || "trames", params };
  emit();
}

export const trameById = (id) => state.trames.find((t) => t.id === id);

// Un acte est publiable si sa trame ne l'a pas déclaré non publiable. Les actes
// sans trame (importés, actes modificatifs, versions consolidées) restent
// publiables : ils ne relèvent pas d'un acte individuel. La question se pose au
// moment de la publication, donc on la lit à la trame COURANTE : déclarer une
// trame non publiable vaut aussi pour les actes déjà rédigés à partir d'elle.
export function actePubliable(a) {
  if (!a) return true;
  const t = a.trameId ? state.trames.find((x) => x.id === a.trameId) : null;
  if (t) return tramePublishable(t);
  return a.publishable !== false;
}
export const entityById = (id) => state.config?.entities?.find((e) => e.id === id);
export const personById = (id) => state.config?.people?.find((p) => p.id === id);
export const refById = (id) => state.config?.refs?.find((r) => r.id === id);
export const acteById = (id) => state.actes.find((a) => a.id === id);
