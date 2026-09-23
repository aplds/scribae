// ============================================================================
// L'accès à l'atelier : qui a le droit d'entrer, et ce que l'on répond aux
// autres.
//
// Deux questions, une seule table de correspondance. D'abord « d'où vient
// l'appelant » : c'est l'adresse réseau qui le dit (voir `ips.mjs`). Ensuite
// « cette adresse est-elle dans la liste blanche » : une commune peut n'ouvrir
// son atelier qu'à son intranet — la liste est alors la seule porte.
//
// La règle tient en trois lignes, et il faut les trois :
//   • la liste est VIDE → l'atelier est ouvert à tous (c'est le défaut, et celui
//     d'une installation que rien ne restreint) ;
//   • la liste est renseignée → seules les adresses qu'elle contient entrent ;
//   • les ACTES RÉSERVÉS AUX AGENTS ne sont montrés, sur le recueil public,
//     qu'aux personnes connectées ET passant par une adresse autorisée — un
//     agent en télétravail voit le recueil public, pas les circulaires internes.
//
// Module PUR (il ne fait que lire des listes et comparer des adresses) :
// il s'éprouve seul, et le service l'utilise sans base ni réseau.
// ============================================================================

import { lireListe, lireListeBrute, lireAdresse, entreeAutorisee, estInterne, adresseDeLEntete } from "./ips.mjs";

// Les clés du référentiel, et les variables de déploiement qui les posent :
// `SCRIBA_ATELIER_IPS` l'emporte sur le réglage fait dans l'interface, comme
// partout ailleurs (voir variables.mjs).
export const CLE_IPS = "publication.atelier.ips";
export const CLE_MESSAGE = "publication.atelier.message";
export const VAR_IPS = "SCRIBA_ATELIER_IPS";
export const VAR_MESSAGE = "SCRIBA_ATELIER_MESSAGE";

export const MESSAGE_DEFAUT =
  "L'atelier des actes est réservé au réseau de la collectivité. Depuis une autre adresse, "
  + "l'espace public du recueil reste consultable.";

// La liste vient de deux endroits : le `.env` du déploiement (portée
// référentiel) et le référentiel enregistré, que l'Administration › Accès à
// l'atelier écrit. Le premier l'emporte : c'est lui qui survit à une remise à
// zéro du référentiel, et c'est celui qu'un exploitant peut poser avant la
// première connexion.
//
// La préférence se décide sur la PRÉSENCE de la valeur, non sur ce qu'elle a
// donné : une liste de déploiement écrite de travers ne doit pas être remplacée
// en silence par le réglage de l'interface — elle doit apparaître, refusée, et
// se voir. Une liste vide, elle, ne dit rien : c'est le cas ordinaire d'une
// installation que rien ne restreint.
const nonVide = (v) => (Array.isArray(v) ? v : String(v == null ? "" : v).split(/[,\n;]/))
  .some((x) => String(x == null ? "" : x).split("#")[0].trim() !== "");

export function listeRetenue(ipsEnv, ipsReferentiel) {
  if (nonVide(ipsEnv)) return { ...lireListe(ipsEnv), source: "deploiement", demandee: true };
  if (nonVide(ipsReferentiel)) return { ...lireListe(ipsReferentiel), source: "referentiel", demandee: true };
  return { entrees: [], erreurs: [], demandee: false, source: "" };
}

// Ce que le service répond d'une adresse : elle entre, ou non, et pourquoi.
// `simulee` dit qu'un administrateur a demandé « et si j'arrivais de là ? » —
// la réponse est calculée, mais elle ne vaut pas décision.
export function etat({ ip = "", ipsDeploiement, ipsReferentiel, message = "" } = {}) {
  const { entrees, erreurs, source, demandee } = listeRetenue(ipsDeploiement, ipsReferentiel);
  // La restriction est ACTIVE dès qu'une liste a été DEMANDÉE — même si aucune
  // de ses entrées n'est lisible. C'est le point qui compte : une liste écrite
  // de travers (une faute de frappe dans SCRIBA_ATELIER_IPS, une plage
  // malformée) ne doit pas laisser l'atelier OUVERT à tout le monde en croyant
  // l'avoir fermé. Elle ne laisse alors entrer personne — la porte est fermée,
  // et `erreurs` dit pourquoi (voir `listeRetenue`). « Aucune liste » reste le
  // seul cas qui ouvre l'atelier : c'est celui d'une installation que rien ne
  // restreint.
  const actif = demandee;
  const adresse = String(ip || "").trim();
  // La RÈGLE qui autorise l'adresse, quand elle entre : c'est ce que montre le
  // simulateur de l'écran d'administration, et ce qui se journalise.
  const regle = actif ? entreeAutorisee(adresse, entrees) : null;
  return {
    ip: adresse,
    actif,
    autorise: actif ? !!regle : true,
    interne: estInterne(adresse),
    // L'adresse est-elle LISIBLE ? Le simulateur s'en sert : lui demander de
    // juger « n'importe quoi » ne veut rien dire, et une réponse « Refusée »
    // ferait croire à une règle là où il n'y a qu'une faute de frappe.
    connue: !!lireAdresse(adresse),
    source,
    regle: regle ? regle.libelle : "",
    liste: entrees.map((e) => e.libelle),
    erreurs,
    message: String(message || "").trim() || MESSAGE_DEFAUT,
  };
}

// La réponse faite à une requête venue d'une adresse non autorisée : un 403
// explicite, jamais un 404 muet — l'agent doit comprendre que l'outil existe et
// que c'est le réseau qui le sépare de lui, pas une panne.
export function corpsRefus(etatAtelier) {
  return {
    erreur: etatAtelier.message,
    code: "atelier_hors_reseau",
    ip: etatAtelier.ip,
    interne: etatAtelier.interne,
    atelier: { actif: true, autorise: false },
  };
}

// Le résumé d'une ligne pour le journal du service au démarrage. Il doit dire la
// même chose que la décision : une liste ENTIÈREMENT illisible ferme l'atelier
// (voir `etat`), et l'annoncer « ouvert » serait le plus mauvais des messages —
// l'exploitant croirait sa porte ouverte alors qu'elle est fermée à tous, ou
// l'inverse. Les deux cas se distinguent donc ici aussi.
export function resume(ips, message = "") {
  const { retenues, erreurs } = lireListeBrute(ips);
  if (!retenues.length && !erreurs.length) return "Accès à l'atelier : ouvert (aucune restriction d'adresse).";
  if (!retenues.length) {
    return "Accès à l'atelier : FERMÉ — aucune entrée lisible dans la liste d'adresses ("
      + erreurs.length + " refusée" + (erreurs.length > 1 ? "s" : "") + " : "
      + erreurs.map((e) => `« ${e.entree} »`).join(", ") + ").";
  }
  return "Accès à l'atelier : restreint à " + retenues.map((r) => r.texte).join(", ")
    + (String(message || "").trim() ? ` — message : ${String(message).trim()}` : "");
}

export { adresseDeLEntete };
