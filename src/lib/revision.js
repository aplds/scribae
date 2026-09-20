// ============================================================================
// Révision des actes — le contrôle entre la décision d'envoyer et l'envoi.
//
// Le réviseur s'intercale entre le geste du rédacteur (« Envoyer en
// signature ») et l'envoi effectif. Il contrôle l'acte, en reçoit un RAPPORT DE
// CONFORMITÉ (src/lib/conformite.js), peut le corriger (fautes de frappe,
// coquilles), puis :
//   • le VALIDER : l'acte part en signature ;
//   • le REJETER : l'acte revient en brouillon chez son rédacteur, et le motif
//     du rejet lui est communiqué.
//
// Deux principes, les mêmes que le parapheur (src/lib/validation.js) :
//
//   1. **Rien n'est codé en dur.** Un acte n'est révisé que s'il EXISTE un
//      réviseur compétent pour lui ; sans réviseur compétent, aucune révision
//      n'a lieu et l'acte part directement en signature (comportement
//      historique). La qualité de réviseur se donne de deux façons :
//        • à un COMPTE, par le rôle « Réviseur » — cumulable, un éditeur peut
//          être réviseur — et une compétence propre (`user.revision`) ;
//        • à un SERVICE entier, ou à certains de ses bureaux, par la
//          déclaration portée sur le service (`service.reviseur`) : c'est le
//          cas d'un service des affaires juridiques dont les agents contrôlent
//          les actes des autres services.
//      Une compétence se limite à certains services, trames, familles, types
//      d'actes ou entités signataires ; une liste vide vaut « tout ».
//
//   2. **La révision porte sur un TEXTE.** L'empreinte du texte soumis est
//      mémorisée. Si l'acte est réécrit après coup — par le rédacteur, ou par
//      le réviseur lui-même avant de valider —, l'empreinte le dit : la
//      révision devient caduque et doit être reprise. C'est ce qui garantit que
//      l'acte signé est bien celui qui a été contrôlé.
//
// Ce module est pur : il ne connaît ni le DOM ni l'état de l'application.
// ============================================================================
import { servicesOf } from "./scope.js";
import { hasRole } from "./users.js";
import { empreinteTexte } from "./validation.js";

export const REVISION_STATUTS = {
  en_attente: { label: "En attente de révision", color: "info" },
  valide: { label: "Révisé", color: "success" },
  rejete: { label: "Rejeté", color: "error" },
};

// ------------------------------------------------------------------ compétence
// La compétence d'un réviseur : ce sur quoi il est compétent. Deux formes
// selon qu'elle est portée par un compte ou par un service — la lecture est la
// même.
//
//   services   les services DONT LES ACTES relèvent de ce réviseur ;
//   trameIds / familyIds / actTypes   le type d'acte ;
//   entityIds  l'entité signataire.
//
// Une liste vide (ou absente) vaut « tout ».
export function newCompetence(patch = {}) {
  return { services: [], trameIds: [], familyIds: [], actTypes: [], entityIds: [], ...patch };
}

const vide = (a) => !Array.isArray(a) || !a.length;
const vise = (liste, valeur) => vide(liste) || (!!valeur && liste.includes(valeur));

export const competenceVide = (c) =>
  vide(c?.services) && vide(c?.trameIds) && vide(c?.familyIds) && vide(c?.actTypes) && vide(c?.entityIds);

// Un acte relève-t-il de cette compétence ?
export function competenceCouvre(competence, { trame, acte } = {}) {
  const c = competence || {};
  if (!vise(c.services, acte?.serviceId)) return false;
  if (!vise(c.trameIds, acte?.trameId)) return false;
  if (!vise(c.familyIds, trame?.familyId)) return false;
  if (!vise(c.actTypes, trame?.actTypeId)) return false;
  if (!vise(c.entityIds, acte?.entityId || trame?.entityId)) return false;
  return true;
}

// Le service tient-il la qualité pour ce compte, et le compte pour ce bureau ?
function serviceReviseurPour(service, membership) {
  const r = service?.reviseur;
  if (!r || r.actif === false) return null;
  if (vide(r.bureaux)) return r;                       // tout le service
  const siens = Array.isArray(membership?.bureaux) ? membership.bureaux : null;
  if (!siens) return r;                                // tous les bureaux du service
  return siens.some((b) => r.bureaux.includes(b)) ? r : null;
}

// Les compétences d'un compte : la sienne (rôle Réviseur) et celles des
// services qui portent la qualité et dont il relève.
export function competencesDe(config, user) {
  if (!user || user.active === false) return [];
  const out = [];
  if (hasRole(user, "reviseur")) out.push(user.revision || {});
  for (const m of Array.isArray(user.memberships) ? user.memberships : []) {
    const service = servicesOf(config).find((s) => s.id === m?.serviceId);
    const r = serviceReviseurPour(service, m);
    if (r) out.push(r);
  }
  return out;
}

export const estReviseur = (config, user) => competencesDe(config, user).length > 0;

// Un compte peut-il réviser CET acte ? Deux questions distinctes :
//   • la COMPÉTENCE (`peutReviser`), qui décide aussi si l'acte doit passer par
//     un réviseur : elle ne s'improvise pas ;
//   • le DROIT DE TRANCHER (`peutTrancherRevision`), qui ajoute le recours de
//     l'administrateur — il peut valider ou rejeter n'importe quelle révision,
//     comme il peut tenir n'importe quelle étape du parapheur, mais il ne rend
//     pas la révision obligatoire du seul fait de son rôle.
export const peutReviser = (config, user, cible) =>
  competencesDe(config, user).some((c) => competenceCouvre(c, cible));

export const peutTrancherRevision = (config, user, cible) =>
  !!user && user.active !== false && (hasRole(user, "administrateur") || peutReviser(config, user, cible));

// Les comptes compétents pour un acte — ceux à qui il sera annoncé. Un
// administrateur n'est pas réviseur du seul fait de son rôle : c'est la
// compétence qui décide (il reste le recours, à la main).
export const reviseursPour = (config, users, cible) =>
  (users || []).filter((u) => u.active !== false && peutReviser(config, u, cible));

// L'acte doit-il passer par un réviseur ? Oui dès qu'un compte est compétent
// pour lui. Les versions consolidées, publiées par l'acte modificatif qui les a
// produites, ne suivent pas ce chemin.
export function revisionRequise(config, users, { trame, acte } = {}) {
  if (!acte || acte.kind === "consolide") return false;
  return reviseursPour(config, users, { trame, acte }).length > 0;
}

// Comment dire la compétence à un administrateur (« tous les services », « DSI
// et CCAS », « marchés publics », …).
export function competenceLabel(config, competence = {}) {
  const parts = [];
  const nomService = (id) => servicesOf(config).find((s) => s.id === id)?.code || "?";
  if (!vide(competence.services)) parts.push("services " + competence.services.map(nomService).join(", "));
  if (!vide(competence.trameIds)) parts.push(competence.trameIds.length + " trame(s)");
  if (!vide(competence.familyIds)) parts.push("familles : " + competence.familyIds.map((id) => (config?.families || []).find((f) => f.id === id)?.label || id).join(", "));
  if (!vide(competence.actTypes)) parts.push("types : " + competence.actTypes.map((id) => (config?.actTypes || []).find((t) => t.id === id)?.label || id).join(", "));
  if (!vide(competence.entityIds)) parts.push("entités : " + competence.entityIds.map((id) => (config?.entities || []).find((e) => e.id === id)?.code || id).join(", "));
  return parts.join(" · ") || "tous les services, tous les actes";
}

// ------------------------------------------------------------------ l'état
function nomDe(user) {
  if (!user) return "";
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.login || "";
}

// Le rédacteur envoie l'acte : il part au réviseur, il n'est pas encore en
// signature. On mémorise l'empreinte du texte soumis et l'état de l'historique
// de travail, pour pouvoir dire ensuite si le réviseur a corrigé l'acte.
export function demanderRevision(acte, user, { reviseurs = [] } = {}) {
  const at = new Date().toISOString();
  acte.revision = {
    statut: "en_attente",
    demandeeLe: at,
    demandeePar: user?.id || "",
    demandeeParNom: nomDe(user),
    empreinte: empreinteTexte(acte),
    reviseurs: (reviseurs || []).map((u) => u.id),
    laboratoire: (acte.revisions || []).length,
    corrections: 0,
  };
  return acte.revision;
}

// Consigne ce que le réviseur a changé (il peut avoir corrigé l'acte avant de
// statuer : les corrections passent par l'historique de travail, on ne fait ici
// que les compter et dire qu'il y en a eu).
function consignerTravail(r, acte) {
  r.corrige = r.empreinte !== empreinteTexte(acte);
  r.corrections = Math.max(0, (acte.revisions || []).length - (r.laboratoire || 0));
  r.empreinte = empreinteTexte(acte);
}

export function validerRevision(acte, user, rapport = null) {
  const r = acte?.revision;
  if (!r) return null;
  consignerTravail(r, acte);
  r.statut = "valide";
  r.valideLe = new Date().toISOString();
  r.validePar = user?.id || "";
  r.valideParNom = nomDe(user);
  if (rapport) r.rapport = { erreurs: rapport.compte.erreurs, avertissements: rapport.compte.avertissements, le: rapport.le };
  return r;
}

export function rejeterRevision(acte, user, motif, rapport = null) {
  const r = acte?.revision;
  if (!r) return null;
  consignerTravail(r, acte);
  r.statut = "rejete";
  r.rejeteLe = new Date().toISOString();
  r.rejetePar = user?.id || "";
  r.rejeteParNom = nomDe(user);
  r.motif = String(motif || "").trim();
  if (rapport) r.rapport = { erreurs: rapport.compte.erreurs, avertissements: rapport.compte.avertissements, le: rapport.le };
  return r;
}

// La révision porte-t-elle encore sur le texte de l'acte ?
export const revisionAJour = (acte) =>
  !!acte?.revision && acte.revision.empreinte === empreinteTexte(acte);

// L'acte peut-il être envoyé en signature du point de vue de la révision ?
// `requise: false` = aucun réviseur compétent : la porte n'existe pas pour cet
// acte, et l'envoi suit son cours.
export function revisionPourSignature(config, users, acte, trame) {
  if (!revisionRequise(config, users, { trame, acte })) return { requise: false, ok: true, raison: "" };
  const r = acte?.revision;
  if (!r) {
    return { requise: true, ok: false, raison: "Un réviseur est compétent pour cet acte : il doit lui être soumis avant d'être envoyé en signature." };
  }
  if (r.statut === "rejete") {
    return { requise: true, ok: false, raison: "Le réviseur a rejeté cet acte : il revient en brouillon." + (r.motif ? " Motif : « " + r.motif + " »" : "") };
  }
  if (r.statut === "en_attente") {
    return { requise: true, ok: false, raison: "L'acte est en attente de révision" + (r.demandeeParNom ? ` (soumis par ${r.demandeeParNom})` : "") + "." };
  }
  if (!revisionAJour(acte)) {
    return { requise: true, ok: false, raison: "Le texte de l'acte a été modifié depuis sa révision : la révision doit être reprise." };
  }
  return { requise: true, ok: true, raison: "" };
}

// Libellé d'état de la révision d'un acte (null si aucune révision). La révision
// est CADUQUE quand le texte a changé depuis qu'elle a été demandée ou rendue —
// sauf après un rejet, où le rédacteur est justement en train de corriger : le
// rejet, lui, tient jusqu'au prochain envoi.
export function etatRevision(acte) {
  const r = acte?.revision;
  if (!r) return null;
  const base = REVISION_STATUTS[r.statut] || REVISION_STATUTS.en_attente;
  if (r.statut !== "rejete" && !revisionAJour(acte)) return { ...base, label: "Révision caduque", color: "warning", caduque: true };
  return { ...base, caduque: false };
}

// Ce que l'acte dit de sa révision, à l'attention du rédacteur : le rédacteur
// de l'acte lit `revision.motif` sous le rejet, et `revision.corrige` quand le
// réviseur a corrigé le texte avant de valider.
export const reviseursNommes = (users, r) =>
  (r?.reviseurs || []).map((id) => (users || []).find((u) => u.id === id)).filter(Boolean);
