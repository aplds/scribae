// ============================================================================
// Transmission au contrôle de légalité (télétransmission @ctes).
//
// L'acte signé est adressé au représentant de l'État par une API D'ENVOI. Le
// service de contrôle de légalité accuse réception, et cet accusé de réception
// vaut CERTIFICAT INFORMATIQUE de transmission :
//
//     « Transmis au contrôle de légalité le 22 janvier 2026 à 09 h 14 »
//
// Le certificat est déposé sur le document (l'original signé, et la version en
// ligne) ; la formalité de transmission est alors constatée d'elle-même, et
// l'acte est publié.
//
// TROIS RÉGIMES (Administration › Expérimentale, `config.controleLegalite.mode`) :
//
//   • « desactive » — la transmission n'est pas gérée par l'application : rien
//     n'est adressé, aucune porte ne s'intercale entre la signature et la
//     publication. La transmission — quand la collectivité en a l'obligation —
//     se constate à la main depuis l'échéancier, comme les autres formalités ;
//   • « declaratif » — avant sa publication, l'acte signé attend qu'un RÉVISEUR
//     compétent DÉCLARE la transmission : à qui l'acte a été transmis, et à
//     quelle date. Aucun appel sortant n'a lieu ; la déclaration vaut
//     attestation, et c'est elle que le service exige pour publier ;
//   • « api » — le SERVICE adresse l'acte signé à l'API d'envoi @ctes, et
//     l'accusé de réception vaut certificat. Chaque acte peut en outre faire
//     l'objet d'une DÉCLARATION (acte transmis hors application, API
//     injoignable…) : les deux voies lèvent la même porte.
//
// Ce module est pur : il ne connaît ni le DOM ni l'état de l'application.
// ============================================================================
import { sha256Hex } from "./signature.js";

// Les trois régimes, tels que l'administration les choisit.
export const MODES_CONTROLE_LEGALITE = [
  { id: "desactive", label: "Désactivée — la transmission se constate à la main" },
  { id: "declaratif", label: "Déclarative — un réviseur atteste la transmission avant publication" },
  { id: "api", label: "Télétransmission par API (@ctes), avec déclaration possible par acte" },
];

// Le régime EFFECTIF, en lisant aussi l'ancien réglage booléen
// (`experimental.controleLegalite`) : un référentiel enregistré avant les trois
// régimes garde son comportement (vrai = l'API d'envoi).
export function modeControleLegalite(config) {
  const m = config?.controleLegalite?.mode;
  if (m === "desactive" || m === "declaratif" || m === "api") return m;
  return config?.experimental?.controleLegalite ? "api" : "desactive";
}

// La transmission est-elle GÉRÉE par l'application (porte entre la signature et
// la publication) ? Vrai pour « declaratif » et « api », faux pour « desactive ».
export const controleLegaliteGere = (config) => modeControleLegalite(config) !== "desactive";
// Régime DÉCLARATIF : la transmission se déclare, aucun appel sortant.
export const controleLegaliteDeclaratif = (config) => modeControleLegalite(config) === "declaratif";
// Régime API : le service adresse l'acte à l'API d'envoi @ctes.
export const controleLegaliteParApi = (config) => modeControleLegalite(config) === "api";

// Le service de contrôle de légalité, décrit comme un service distant — il a
// son adresse, son vocabulaire, ses références d'accusé de réception. L'adresse
// est un EXEMPLE : la transmission est simulée (voir `controleLegaliteActif`),
// et un déploiement réel pointe vers son propre point de terminaison @ctes.
export const CONTROLE_LEGALITE = {
  id: "controle-legalite",
  nom: "Contrôle de légalité (@ctes)",
  service: "Télétransmission au contrôle de légalité",
  destinataire: "Préfecture — contrôle de légalité",
  mode: "ctes",
  apiUrl: "https://api.ctes.exemple.fr/v1/transmissions",
};

// Ancien nom, conservé : « la transmission est-elle gérée par l'application ?
// » — c'est `controleLegaliteGere`, les trois régimes réunis. Les appelants qui
// veulent la seule VOIE API emploient `controleLegaliteParApi`.
export const controleLegaliteActif = (config) => controleLegaliteGere(config);

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// « 09 h 14 » — l'heure seule. Elle sert à la ligne d'état de la rédaction
// (« Enregistré à 14 h 32 »), et `dateHeureFr` s'en sert pour ne pas écrire
// deux fois la même chose.
export function heureFr(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${h} h ${mi}`;
}

// « 22 janvier 2026 à 09 h 14 » — sans Intl : le service (qui produit l'accusé
// de réception) n'expose pas Intl, et la mention doit être identique des deux
// côtés. Les heures sont locales, comme celles du poste qui a transmis.
export function dateHeureFr(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} à ${heureFr(iso)}`;
}

export const mentionDeTransmission = (iso) => `Transmis au contrôle de légalité le ${dateHeureFr(iso)}`;

// Une transmission SIMULÉE — aucun appel sortant n'a eu lieu (démonstration, ou
// service qui n'a pas d'accès réel à l'API @ctes) — ne porte pas la même
// mention qu'une transmission réelle : la mention est QUALIFIÉE, pour qu'un
// lecteur ne prenne pas l'accusé de réception fabriqué pour un certificat
// opposable. Voir NC-IV-004 et P-19.
export const mentionDeTransmissionSimulee = (iso) => `Transmis au contrôle de légalité le ${dateHeureFr(iso)} (mention de démonstration — transmission simulée, sans appel sortant)`;

// Une transmission DÉCLARÉE — le régime déclaratif, ou une déclaration par acte
// en régime API : une personne (le réviseur) atteste que l'acte a été transmis
// hors de l'application, et la mention le dit, en la nommant. Ce n'est ni un
// accusé de réception (aucun appel n'a eu lieu), ni une simulation : c'est une
// attestation, et elle porte son auteur.
export const mentionDeTransmissionDeclaree = (iso, par) =>
  `Transmis au contrôle de légalité le ${dateHeureFr(iso)}${par ? ` (déclaration de ${par})` : " (déclaration)"}`;

// L'accusé de réception, tel que le service de contrôle de légalité le délivre.
// Le « sceau » est l'empreinte des mentions du certificat rapprochée de celle
// du document transmis : il scelle le certificat sur l'acte, et se recalcule.
//
// TROIS NATURES : l'accusé de réception d'un appel réel, la SIMULATION qui le
// dit (`demonstration: true`), et la DÉCLARATION — l'attestation d'une personne
// (`declaration`), qui n'est ni l'un ni l'autre et porte son auteur.
export async function certificatTransmission({ reference, recuLe, destinataire, empreinte, demonstration = false, declaration = null }) {
  const d = destinataire || CONTROLE_LEGALITE.destinataire;
  const r = recuLe || new Date().toISOString();
  const decl = declaration && typeof declaration === "object" ? declaration : null;
  const par = decl ? String(decl.parNom || decl.par || "") : "";
  const nature = decl
    ? "Déclaration de transmission au contrôle de légalité"
    : demonstration ? "Simulation d'accusé de réception de télétransmission" : "Accusé de réception de télétransmission";
  const emisPar = decl
    ? `Déclaration${par ? " de " + par : ""} (acte transmis hors application)`
    : demonstration ? "Simulation locale (aucun appel à l'API @ctes)" : "Contrôle de légalité — télétransmission @ctes";
  const mention = decl ? mentionDeTransmissionDeclaree(r, par) : demonstration ? mentionDeTransmissionSimulee(r) : mentionDeTransmission(r);
  return {
    nature,
    emisPar,
    emisLe: r,
    destinataire: d,
    reference: String(reference || ""),
    empreinte: String(empreinte || ""),
    algorithme: "SHA-256",
    demonstration: !!demonstration,
    declaration: !!decl,
    par: par || undefined,
    motif: decl && decl.motif ? String(decl.motif) : undefined,
    sceau: await sha256Hex([reference, r, d, empreinte].join("|")),
    mention,
  };
}

// Vérification du sceau : le certificat présenté est bien celui que ces
// mentions produisent, et il porte bien sur le document de l'acte. C'est le
// pendant, pour la transmission, de la vérification de l'original signé.
export async function verifierCertificatTransmission(certificat, { empreinte } = {}) {
  if (!certificat) return { ok: false, detail: "Aucun certificat de transmission." };
  const attendu = await sha256Hex([certificat.reference, certificat.emisLe, certificat.destinataire, certificat.empreinte].join("|"));
  const scelle = attendu === certificat.sceau;
  const surDocument = !empreinte || !certificat.empreinte || empreinte === certificat.empreinte;
  return {
    ok: scelle && surDocument,
    detail: scelle
      ? (surDocument ? "sceau vérifié, sur l'empreinte du document" : "sceau vérifié, mais sur un autre document")
      : "sceau du certificat invalide",
  };
}
