// ============================================================================
// L'accès à l'atelier — vu du navigateur.
//
// Le service est seul juge : c'est lui qui voit l'adresse réseau de l'appelant,
// et c'est lui qui décide (voir src/server/mysql/atelier.mjs). L'application, de
// son côté, a trois choses à en faire :
//
//   • savoir si l'atelier est OUVERT à cette adresse, pour le dire clairement
//     quand il ne l'est pas (un écran vaut mieux qu'un 403 découvert au hasard
//     du premier clic) ;
//   • dire au recueil public si les actes RÉSERVÉS AUX AGENTS doivent s'afficher
//     — ils ne le font que pour une personne connectée venant d'une adresse
//     autorisée, et c'est le service qui les sert ou non ;
//   • laisser un administrateur ESSAYER une adresse (« et si j'arrivais de
//     là ? »), sans rien simuler d'autre que la comparaison à la liste, que le
//     service fait pour lui.
//
// Rien ici n'accorde ni ne refuse un droit : c'est un reflet. Un navigateur qui
// mentirait sur son état ne verrait pas la première publication réservée.
// ============================================================================

import { get, bodyOf } from "./remote.js";

// Les clés du RÉGLAGE (`config.publication.atelier`), et le message livré. Elles
// sont écrites ici pour que l'interface puisse les nommer sans importer le
// module du service (src/server/mysql/atelier.mjs, qui les porte pour Node) :
// l'interface n'a rien à faire dans le dossier du service. Les deux jeux doivent
// rester d'accord — c'est la même clé du référentiel et le même registre de
// variables (voir src/server/mysql/variables.mjs, section « Accès à l'atelier »).
export const CLE_IPS = "publication.atelier.ips";
export const CLE_MESSAGE = "publication.atelier.message";
export const VAR_IPS = "SCRIBA_ATELIER_IPS";
export const VAR_MESSAGE = "SCRIBA_ATELIER_MESSAGE";
export const MESSAGE_DEFAUT =
  "L'atelier des actes est réservé au réseau de la collectivité. Depuis une autre adresse, "
  + "l'espace public du recueil reste consultable.";

// L'état connu. Tant que le service n'a pas répondu — démonstration hors ligne,
// aperçu sans service —, l'accès est réputé OUVERT : c'est le cas ordinaire, et
// un service muet ne doit pas fermer l'outil de ses agents.
export const acces = {
  charge: false,
  actif: false,
  autorise: true,
  ip: "",
  appelant: "",
  interne: false,
  connue: false,
  liste: [],
  regle: "",
  erreurs: [],
  source: "",
  message: "",
  note: "",
  simulation: false,
};

const listeners = new Set();
export const surAcces = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const prevenir = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

const recopier = (corps) => {
  for (const k of ["actif", "autorise", "ip", "appelant", "interne", "connue", "source", "regle", "message", "note", "simulation"]) {
    if (corps[k] !== undefined) acces[k] = corps[k];
  }
  acces.liste = Array.isArray(corps.liste) ? corps.liste : [];
  acces.erreurs = Array.isArray(corps.erreurs) ? corps.erreurs : [];
  acces.charge = true;
};

// Interroge le service. `simulee` demande « et si j'arrivais de cette
// adresse ? » : le service répond, l'application ne juge pas.
export async function chargerAcces({ simulee = "", silencieux = false } = {}) {
  try {
    const r = await get("/v1/atelier/acces" + (simulee ? "?ip=" + encodeURIComponent(simulee) : ""), {
      label: simulee ? "Essai d'adresse" : "Accès à l'atelier",
      source: "lecture",
    });
    if (!r.ok) return null;
    const etat = bodyOf(r);
    if (simulee) return etat;   // un essai ne remplace pas l'état réel
    recopier(etat);
    prevenir();
    return etat;
  } catch (e) {
    // Service muet : on ne ferme rien, et on ne prétend rien savoir.
    if (!silencieux) console.warn("Accès à l'atelier : le service n'a pas répondu", e && e.message);
    return null;
  }
}

// L'atelier est-il restreint, et cette adresse est-elle dehors ?
export const atelierRestreint = () => !!acces.actif;
export const horsReseau = () => !!acces.actif && !acces.autorise;

// Les actes réservés sont-ils visibles ici ? Oui pour une personne connectée
// venant d'une adresse autorisée. Sans restriction d'adresse, la seule condition
// est d'être connecté — comportement historique.
export const agentsAvecActesReserves = (connecte) => !!connecte && (!acces.actif || acces.autorise);
