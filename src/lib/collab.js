// ============================================================================
// Collaboration : présence des postes, verrou souple de rédaction, journal.
//
// Trois besoins, une seule mécanique — deux collections partagées :
//
//   • `presence` : un enregistrement par compte connecté, réécrit toutes les
//     25 secondes (battement de cœur). Il dit qui est là, sur quel écran, et
//     quel acte est en cours de rédaction : c'est ce qui alimente le compteur
//     de postes connectés et l'avertissement « untel rédige cet acte ».
//     Au-delà de 70 secondes sans battement, le poste est considéré parti — un
//     navigateur fermé net ne laisse donc pas de verrou définitif.
//
//     Depuis la 1.6.2, il porte aussi le BROUILLON partagé : les seules
//     clés qu'un poste vient de toucher dans l'acte qu'il rédige, pour qu'un
//     collègue les voie arriver. C'est un fait ÉPHÉMÈRE, borné (voir
//     BROUILLON_MAX) et jamais enregistré — il disparaît avec la présence. Un
//     poste en rédaction partagée écrit plus souvent qu'une fois toutes les
//     25 secondes : c'est le battement « vif » (BROUILLON_MS).
//
//   • `journal` : le registre des faits — qui a créé, soumis, validé, signé,
//     publié, transmis, supprimé quoi. Chaque entrée peut DÉSIGNER des
//     destinataires (un compte, un rôle, un service) : c'est ce qui alimente
//     les notifications. Le journal est donc à la fois la piste d'audit lisible
//     par les administrateurs et la source des pastilles de notification.
//
// Les écritures passent par la façade de persistance : elles suivent le même
// chemin que les actes (service partagé ou base MySQL), et fonctionnent donc
// dans les trois modes. `BroadcastChannel` ajoute la mise à jour immédiate
// entre onglets d'un même navigateur ; ailleurs, un sondage périodique prend le
// relais. Aucun des deux n'est indispensable : l'application fonctionne sans
// (le journal est écrit, simplement moins vite rafraîchi).
// ============================================================================

import * as db from "./db/index.js";
import { hostKv } from "./hosts.js";
import { rolesOf, primaryRoleId } from "./users.js";

export const PRESENCE = "presence";
export const JOURNAL = "journal";

export const PRESENCE_MS = 25000;   // battement de cœur
// O-6 (audit ciblé du 22/09/2026) : en ÉTAT D'ERREUR, le battement s'ESPACE. Un
// service qui refuse la présence (rôle, session) recevait sinon un battement
// toutes les 25 secondes — donc une phrase d'erreur à l'écran et une entrée de
// plus dans la file, indéfiniment. En repli, le poste se fait encore connaître,
// mais sans marteler un service qui répond non.
export const PRESENCE_REPLI_MS = 120000;
export const EN_LIGNE_MS = 70000;   // au-delà : poste considéré parti
const POLL_MS = 30000;
const JOURNAL_MAX = 300;            // au-delà, les plus anciens sortent
const CANAL = "scribae-collab";
const FOLDER = "scribaeCollab";
const VU_KEY = "vu";

let moi = null;                     // { id, name, role, serviceId }
let presences = [];
let journal = [];
let canal = null;
let battement = null;
let sondage = null;
let vue = { acteId: "", acteLabel: "", ecran: "", trameId: "", trameLabel: "", brouillon: null };
// Le flux temps réel est-il ouvert (voir ui/flux.js) ? C'est lui qui rend les
// brouillons partagés utiles : sans lui, la présence se lit toutes les trente
// secondes, et un brouillon publié arriverait trop tard pour être « en même
// temps ». Hors temps réel, on ne publie donc RIEN.
let fluxActif = false;
// Le poste a-t-il un brouillon à publier ? Le battement ordinaire suffit quand
// rien ne bouge ; quand quelqu'un écrit, on bat plus vite, le temps de la
// rédaction (voir `planifierBattement`).
let brouillonEnAttente = false;
let battementVif = null;
let derniereErreur = "";
const ecouteurs = new Set();

export const surChangement = (fn) => { ecouteurs.add(fn); return () => ecouteurs.delete(fn); };
const prevenir = () => ecouteurs.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

const maintenant = () => Date.now();
const frais = (p, ms = EN_LIGNE_MS) => !!p && maintenant() - Date.parse(p.at || 0) < ms;

// ------------------------------------------------------------------ lecture
export const presencesActives = () => presences.filter((p) => frais(p));
export const enLigne = () => presencesActives().length;

// Le poste qui rédige cet acte, s'il n'est pas le mien.
export const quiRedige = (acteId) =>
  presencesActives().find((p) => p.acteId === acteId && p.userId !== moi?.id) || null;

// Le poste qui a cette TRAME ouverte dans l'éditeur, s'il n'est pas le mien.
export const quiRedigeTrame = (trameId) =>
  presencesActives().find((p) => p.trameId === trameId && p.userId !== moi?.id) || null;

// ----------------------------------------------------------- brouillons partagés
// CE QUE LES AUTRES POSTES SONT EN TRAIN D'ÉCRIRE dans cet acte. Le brouillon
// voyage DANS l'enregistrement de présence (voir `presenceDuPoste`) : il n'y a
// donc ni collection nouvelle, ni route nouvelle — et le flux (1.6.2) le
// transporte vers les autres postes en une seconde.
//
// Un brouillon est ÉPHÉMÈRE, comme la présence : il vit le temps d'une
// rédaction, n'entre dans aucun journal, et s'efface au départ du poste (voir
// `arreter` et `libererRedaction`). Son contenu est borné (voir BROUILLON_MAX) :
// au-delà, on ne partage pas — mieux vaut pas de partage qu'un service qu'on
// charge avec des documents entiers.
export const BROUILLON_MAX = 24000;

export function brouillonsDistants(acteId) {
  if (!acteId) return [];
  return presencesActives()
    .filter((p) => p.userId !== moi?.id && p.brouillon && p.brouillon.acteId === acteId)
    .map((p) => ({ userId: p.userId, byName: p.byName, role: p.role, at: p.brouillon.at || p.at, valeurs: p.brouillon.valeurs || {}, ecarts: p.brouillon.ecarts || {} }));
}

// Publie ce que CE poste vient d'écrire dans l'acte ouvert. `valeurs` et
// `ecarts` ne contiennent que les clés que l'agent a touchées : le reste du
// document n'a pas à circuler (il n'a pas changé, et il peut être long).
export function publierBrouillon(acteId, { valeurs = {}, ecarts = {}, label = "" } = {}) {
  if (!moi || !acteId) return false;
  const taille = JSON.stringify({ valeurs, ecarts }).length;
  if (taille > BROUILLON_MAX) return false;
  vue = { ...vue, acteId, acteLabel: label || vue.acteLabel, brouillon: { acteId, at: new Date().toISOString(), valeurs, ecarts, byName: moi.name } };
  brouillonEnAttente = true;
  planifierBattement();
  return true;
}

// Le battement « vif » : pendant une rédaction partagée, la présence s'écrit plus
// souvent qu'une fois toutes les vingt-cinq secondes — mais pas à chaque frappe,
// et jamais deux battements en vol (voir `battre`, qui fusionne déjà).
const BROUILLON_MS = 1600;
function planifierBattement() {
  if (battementVif || !fluxActif) return;
  battementVif = setTimeout(() => {
    battementVif = null;
    if (!brouillonEnAttente) return;
    brouillonEnAttente = false;
    battre();
  }, BROUILLON_MS);
}

export const journalTout = () => [...journal].sort((a, b) => String(b.at).localeCompare(String(a.at)));

// Le journal vu par un compte : tout pour qui voit tous les actes, sinon les
// faits qui le concernent (il en est l'auteur, il en est le destinataire, ou
// l'objet est l'un de ses actes).
export function journalPour({ user, actesVisibles = null, tous = false } = {}) {
  const tout = journalTout();
  if (tous) return tout;
  const ids = actesVisibles ? new Set(actesVisibles.map((a) => a.id)) : null;
  return tout.filter((e) =>
    e.by === user?.id
    || destinatairesDe(e).includes(user?.id)
    || (ids && e.acteId && ids.has(e.acteId)));
}

// ---------------------------------------------------------- notifications
// `to` accepte : un identifiant de compte, « role:editeur », « service:svc-x »,
// ou « tous ». Une entrée sans destinataire n'est pas notifiée (elle reste au
// journal).
export const normaliserTo = (to) => (Array.isArray(to) ? to.map(String).filter(Boolean) : to ? [String(to)] : []);
export const destinatairesDe = (e) => normaliserTo(e?.to);

export function notifiePour(entry, user) {
  if (!user) return false;
  // On n'est jamais notifié de son propre geste : le journal garde la trace,
  // la cloche n'a rien à annoncer.
  if (entry.by && entry.by === user.id) return false;
  const to = destinatairesDe(entry);
  if (!to.length) return false;
  if (to.includes("tous")) return true;
  if (to.includes(user.id)) return true;
  // Les rôles CUMULÉS comptent tous : un éditeur-réviseur reçoit ce qui est
  // adressé au rôle « reviseur » comme à celui d'« editeur ».
  if (rolesOf(user).some((r) => to.includes("role:" + r))) return true;
  const services = (user.memberships || []).map((m) => m.serviceId).filter(Boolean);
  if (services.some((s) => to.includes("service:" + s))) return true;
  // Une étape confiée à une PERSONNE nommée du référentiel : c'est le compte
  // rattaché à cette personne qui est prévenu (`user.personId`).
  if (user.personId && to.includes("personne:" + user.personId)) return true;
  return false;
}

async function kv() {
  const k = hostKv();
  if (!k || !k[FOLDER]) return null;
  return k[FOLDER];
}

async function vuDe(userId) {
  try {
    const f = await kv();
    if (!f) return {};
    const m = await f.get(VU_KEY);
    return m && typeof m === "object" ? m : {};
  } catch (e) { return {}; }
}

export async function marquerVu(userId) {
  try {
    const f = await kv();
    if (!f || !userId) return;
    const m = await vuDe(userId);
    m[userId] = new Date().toISOString();
    await f.set(VU_KEY, m);
    prevenir();
  } catch (e) { /* la pastille se recalculera au prochain démarrage */ }
}

export async function notifications(user, { tous = false, actesVisibles = null } = {}) {
  const liste = journalPour({ user, actesVisibles, tous }).filter((e) => notifiePour(e, user));
  const vu = (await vuDe(user?.id))[user?.id || ""] || "";
  return liste.map((e) => ({ ...e, lu: !!vu && String(e.at) <= vu }));
}

export async function nonLus(user, opts) {
  if (!user) return 0;
  const l = await notifications(user, opts);
  return l.filter((e) => !e.lu).length;
}

// ---------------------------------------------------------------- écriture
async function lireTout() {
  try {
    const [p, j] = await Promise.all([db.read(PRESENCE), db.read(JOURNAL)]);
    presences = Array.isArray(p) ? p : [];
    journal = Array.isArray(j) ? j : [];
    derniereErreur = "";
  } catch (e) {
    derniereErreur = String((e && e.message) || e);
  }
}

async function ecrirePresence(payload) {
  // Relecture juste avant écriture : on réécrit SON enregistrement sans jamais
  // toucher à celui des autres (une copie périmée provoquerait un conflit — le
  // service renverrait sa version, ce qui n'a aucune conséquence ici, mais
  // autant l'éviter).
  try {
    const fraisP = await db.read(PRESENCE);
    const liste = (Array.isArray(fraisP) ? fraisP : []).filter((p) => p.userId !== payload.userId);
    liste.push(payload);
    const res = await db.write(PRESENCE, liste);
    presences = Array.isArray(res?.value) ? res.value : liste;
  } catch (e) {
    derniereErreur = String((e && e.message) || e);
  }
}

// Le battement de cœur, FUSIONNÉ. `battre()` est appelé par l'intervalle de
// 25 s, par le retour de visibilité de l'onglet, par un changement d'écran et
// par l'ouverture d'un brouillon — autant de sources qui, rapprochées, lançaient
// plusieurs écritures de `presence` coup sur coup. Chacune relit la collection
// avant d'écrire (voir `ecrirePresence`) : deux battements concurrents se
// relisaient et se réécrivaient l'un l'autre pour rien, et chaque écriture
// supplémentaire allait charger la ligne `presence` du service. Un battement à
// la fois suffit : si un second est demandé pendant qu'un battement est en vol,
// on NOTE qu'il en faudra un après (l'écran ou l'acte a changé entre-temps), et
// la boucle le refait — une seule fois de plus, jamais une pile.
let battementEnVol = false;
let battementAttendu = false;

function presenceDuPoste() {
  return {
    id: moi.id,
    userId: moi.id,
    byName: moi.name,
    role: moi.role,
    serviceId: moi.serviceId || "",
    at: new Date().toISOString(),
    acteId: vue.acteId || "",
    acteLabel: vue.acteLabel || "",
    trameId: vue.trameId || "",
    trameLabel: vue.trameLabel || "",
    ecran: vue.ecran || "",
    // Le brouillon partagé : ce que ce poste vient d'écrire (voir
    // `publierBrouillon`). Absent hors temps réel, et absent quand rien n'est en
    // cours de rédaction — la présence reste alors ce qu'elle était.
    brouillon: vue.brouillon && fluxActif ? vue.brouillon : null,
  };
}

export async function battre() {
  if (!moi) return;
  if (battementEnVol) { battementAttendu = true; return; }
  battementEnVol = true;
  try {
    do {
      battementAttendu = false;
      if (!moi) break;
      await ecrirePresence(presenceDuPoste());
    } while (battementAttendu);
  } finally {
    battementEnVol = false;
  }
  avertir();
  prevenir();
}

function avertir() {
  try { canal?.postMessage({ type: "maj", at: new Date().toISOString() }); } catch (e) { /* canal fermé */ }
}

export async function journaliser(entry = {}) {
  const at = new Date().toISOString();
  const e = {
    id: "j-" + maintenant().toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    at,
    action: entry.action || "modification",
    cible: entry.cible || "",
    cibleLabel: entry.cibleLabel || "",
    acteId: entry.acteId || "",
    detail: String(entry.detail || "").slice(0, 400),
    to: normaliserTo(entry.to),
    by: moi?.id || entry.by || "",
    byName: moi?.name || entry.byName || "",
    role: moi?.role || entry.role || "",
  };
  journal = [...journal, e].slice(-JOURNAL_MAX);
  try {
    const res = await db.write(JOURNAL, journal);
    if (Array.isArray(res?.value)) journal = res.value;
  } catch (err) {
    derniereErreur = String((err && err.message) || err);
  }
  avertir();
  prevenir();
  return e;
}

// ------------------------------------------------------------ cycle de vie
export function declarerUtilisateur(user) {
  if (!user) { moi = null; return; }
  moi = {
    id: user.id,
    name: [user.firstName, user.lastName].filter(Boolean).join(" ") || user.login || "—",
    // La présence et le journal portent le rôle PRINCIPAL : c'est lui que lit
    // l'en-tête (et les rôles cumulés sont visibles sur la fiche du compte).
    role: primaryRoleId(user) || "",
    serviceId: (user.memberships || [])[0]?.serviceId || "",
  };
}

// Annonce l'écran (et l'acte éventuellement en cours de rédaction) au reste de
// l'installation. Appelée par les vues, jamais par le module lui-même.
export function signalerEcran(ecran, { acteId = "", acteLabel = "", trameId = "", trameLabel = "" } = {}) {
  const change = vue.ecran !== ecran || vue.acteId !== acteId;
  vue = {
    ...vue,
    ecran: ecran || "",
    acteId: acteId || "",
    acteLabel: acteLabel || "",
    // `trameId` n'est pas remis à zéro ici : c'est l'ÉDITEUR qui le pose, et
    // `libererRedactionTrame` (appelé en quittant l'écran) qui le retire. Le
    // remettre à zéro à chaque redessin ferait clignoter la présence.
    trameId: trameId || vue.trameId || "",
    trameLabel: trameLabel || vue.trameLabel || "",
  };
  if (change && moi) battre();
}

export function signalerRedaction(acteId, acteLabel = "") {
  vue = { ...vue, acteId: acteId || "", acteLabel: acteLabel || "" };
  if (moi) battre();
}

export function libererRedaction() {
  if (!vue.acteId && !vue.brouillon) return;
  vue = { ...vue, acteId: "", acteLabel: "", brouillon: null };
  if (moi) battre();
}

// La même chose pour une TRAME ouverte dans l'éditeur : les autres postes voient
// qui travaille dessus, dans l'en-tête (voir ui/collab.js) et dans l'éditeur.
export function signalerRedactionTrame(trameId, trameLabel = "") {
  vue = { ...vue, trameId: trameId || "", trameLabel: trameLabel || "" };
  if (moi) battre();
}

export function libererRedactionTrame() {
  if (!vue.trameId) return;
  vue = { ...vue, trameId: "", trameLabel: "" };
  if (moi) battre();
}

// Le flux temps réel est-il ouvert ? Réglé par la coquille (ui/state.js), qui
// seule sait ce que dit ui/flux.js.
export function setFluxActif(actif) {
  const avant = fluxActif;
  fluxActif = !!actif;
  if (avant && !fluxActif) {
    // Le temps réel s'arrête : le brouillon partagé n'a plus de sens (il
    // n'arriverait plus à temps). On le retire de la présence au prochain
    // battement, sans le laisser traîner.
    vue = { ...vue, brouillon: null };
    if (brouillonEnAttente) { brouillonEnAttente = false; }
    if (battementVif) { clearTimeout(battementVif); battementVif = null; }
    if (moi) battre();
  }
  return fluxActif;
}

export const fluxOuvert = () => fluxActif;

// Le délai du PROCHAIN battement : le rythme ordinaire, ou le repli quand le
// dernier battement a échoué (O-6). Fonction PURE, pour que la règle se lise et
// s'éprouve sans horloge.
export const delaiPresence = ({ erreur = "" } = {}) => (erreur ? PRESENCE_REPLI_MS : PRESENCE_MS);

// Le battement se RE-PLANIFIE lui-même (et non un `setInterval` fixe) : c'est ce
// qui permet d'espacer le rythme en état d'erreur, et de le resserrer dès qu'un
// battement passe.
function bouclerBattement() {
  battement = setTimeout(async () => {
    try {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") await battre();
    } catch (e) { /* `battre` ne lève pas : on garde la boucle vivante */ }
    if (battement !== null) bouclerBattement();
  }, delaiPresence({ erreur: derniereErreur }));
}

export async function demarrer(user) {
  declarerUtilisateur(user);
  if (!user) { await arreter(); return; }
  await lireTout();
  try {
    canal = new BroadcastChannel(CANAL);
    canal.onmessage = () => { rafraichir(); };
  } catch (e) { canal = null; }
  await battre();
  if (battement === null) bouclerBattement();
  if (!sondage) sondage = setInterval(() => { if (document.visibilityState !== "hidden") rafraichir(); }, POLL_MS);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("pagehide", arreter);
  prevenir();
}

let rafraichissement = null;
export function rafraichir() {
  if (rafraichissement) return rafraichissement;
  rafraichissement = lireTout().then(() => { rafraichissement = null; prevenir(); });
  return rafraichissement;
}

function onVisible() {
  if (document.visibilityState === "visible") { battre(); rafraichir(); }
}

export async function arreter() {
  if (battement !== null) { clearTimeout(battement); battement = null; }
  if (sondage) { clearInterval(sondage); sondage = null; }
  if (battementVif) { clearTimeout(battementVif); battementVif = null; }
  brouillonEnAttente = false;
  document.removeEventListener("visibilitychange", onVisible);
  window.removeEventListener("pagehide", arreter);
  if (moi) {
    // Départ propre : notre enregistrement est marqué comme ancien, pour que les
    // autres postes ne nous attendent pas 70 secondes. Le brouillon partagé, lui,
    // est retiré : un poste parti n'écrit plus rien.
    const parti = { ...(presences.find((p) => p.userId === moi.id) || {}), id: moi.id, userId: moi.id, byName: moi.name, at: new Date(0).toISOString(), acteId: "", acteLabel: "", trameId: "", trameLabel: "", ecran: "", brouillon: null };
    try {
      const liste = (await db.read(PRESENCE)).filter((p) => p.userId !== moi.id);
      liste.push(parti);
      await db.write(PRESENCE, liste);
    } catch (e) { /* sans conséquence : l'enregistrement expirera */ }
    avertir();
  }
  try { canal?.close(); } catch (e) { /* déjà fermé */ }
  canal = null;
  moi = null;
  presences = [];
  prevenir();
}

export const etat = () => ({ moi: !!moi, enLigne: enLigne(), erreur: derniereErreur });
