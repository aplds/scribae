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
// L'étape est ÉTEINTE PAR DÉFAUT (Administration › Expérimentale) : la
// télétransmission suppose une convention et des identifiants d'accès auprès de
// la préfecture, que tout le monde n'a pas. Éteinte, rien n'est envoyé et la
// transmission se constate à la main depuis l'échéancier, comme les autres
// formalités (voir src/lib/execution.js).
//
// Ce module est pur : il ne connaît ni le DOM ni l'état de l'application.
// ============================================================================
import { sha256Hex } from "./signature.js";

// Le service de contrôle de légalité, décrit comme un service distant — il a
// son adresse, son vocabulaire, ses références d'accusé de réception.
export const CONTROLE_LEGALITE = {
  id: "controle-legalite",
  nom: "Contrôle de légalité (@ctes)",
  service: "Télétransmission au contrôle de légalité",
  destinataire: "Préfecture — contrôle de légalité",
  mode: "ctes",
  apiUrl: "https://api.ctes.valmont-sur-loire.fr/v1/transmissions",
};

// La transmission automatique est une fonction expérimentale : éteinte par
// défaut, elle ne s'intercale pas entre la signature et la publication.
export const controleLegaliteActif = (config) => !!config?.experimental?.controleLegalite;

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

// « 22 janvier 2026 à 09 h 14 » — sans Intl : le service (qui produit l'accusé
// de réception) n'expose pas Intl, et la mention doit être identique des deux
// côtés. Les heures sont locales, comme celles du poste qui a transmis.
export function dateHeureFr(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()} à ${h} h ${mi}`;
}

export const mentionDeTransmission = (iso) => `Transmis au contrôle de légalité le ${dateHeureFr(iso)}`;

// L'accusé de réception, tel que le service de contrôle de légalité le délivre.
// Le « sceau » est l'empreinte des mentions du certificat rapprochée de celle
// du document transmis : il scelle le certificat sur l'acte, et se recalcule.
export async function certificatTransmission({ reference, recuLe, destinataire, empreinte }) {
  const d = destinataire || CONTROLE_LEGALITE.destinataire;
  const r = recuLe || new Date().toISOString();
  return {
    nature: "Accusé de réception de télétransmission",
    emisPar: "Contrôle de légalité — télétransmission @ctes",
    emisLe: r,
    destinataire: d,
    reference: String(reference || ""),
    empreinte: String(empreinte || ""),
    algorithme: "SHA-256",
    sceau: await sha256Hex([reference, r, d, empreinte].join("|")),
    mention: mentionDeTransmission(r),
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
