// ============================================================================
// Circuit de validation (le « parapheur »).
//
// Un acte ne passe pas directement de la rédaction à la signature : il est
// soumis à un CIRCUIT, défini dans le référentiel (`config.circuits`), fait
// d'ÉTAPES successives. Chaque étape est confiée à un rôle (et, si on le veut, à
// un agent du service concerné), et demande soit un BON POUR ACCORD, soit un
// simple AVIS.
//
// Deux principes :
//
//   1. **Rien n'est codé en dur.** Un circuit est une donnée du référentiel :
//      combien d'étapes, lesquelles, qui les porte, à quoi elles s'appliquent
//      (trame, famille d'actes ou entité). Un référentiel sans circuit n'a
//      aucun parapheur : le comportement historique est préservé.
//
//   2. **La validation porte sur un TEXTE, pas sur un acte en général.** Le
//      circuit mémorise l'empreinte du texte validé. Si le rédacteur modifie
//      ensuite l'acte, la validation devient caduque et doit être reprise :
//      c'est ce qui empêche de faire signer autre chose que ce qui a été
//      approuvé. Le service de signature vérifie lui aussi cet état (voir
//      `validation` dans le dépôt, index.html).
//
// Ce module est pur : il ne connaît ni le DOM ni l'état de l'application.
//
// Le parapheur n'est qu'UNE des portes avant la signature : la RÉVISION
// (src/lib/revision.js) en est une autre, indépendante — un acte peut être
// révisé sans passer par un circuit, et un circuit peut être achevé sans qu'un
// réviseur soit compétent. Les deux portes sont vérifiées au même endroit, au
// moment de l'envoi en signature (voir src/ui/views/signature.js).
// ============================================================================

import { uid } from "./util.js";
import { stableStringify } from "./db/contract.js";
import { inScope } from "./scope.js";
import { hasRole } from "./users.js";

// Rôles pouvant porter une étape. Les intitulés viennent de src/lib/users.js
// (le rôle est celui du COMPTE, pas celui des personnes du référentiel).
export const STEP_ROLES = [
  { id: "editeur", label: "Éditeur (chef de service, rédacteur en chef)" },
  { id: "administrateur", label: "Administrateur (direction, secrétariat général)" },
];

export const STEP_KINDS = [
  { id: "accord", label: "Bon pour accord" },
  { id: "avis", label: "Avis (consultatif)" },
];

// Sentinelle : une trame peut refuser explicitement tout circuit.
export const AUCUN_CIRCUIT = "aucun";

// Le parapheur est une fonction EXPÉRIMENTALE (Administration › Expérimentale) :
// éteint par défaut, car beaucoup de collectivités ont déjà leur propre circuit
// de validation interne, en amont de l'envoi en signature. Tant qu'il est
// éteint, aucun circuit du référentiel ne s'applique, les actes partent
// directement en signature, et l'écran du parapheur n'est pas proposé.
export const parapheurActif = (config) => !!config?.experimental?.parapheur;

export const VALIDATION_STATUTS = {
  en_cours: { label: "En cours de validation", color: "info" },
  valide: { label: "Validé", color: "success" },
  refuse: { label: "Refusé", color: "error" },
  renvoye: { label: "Renvoyé en rédaction", color: "warning" },
};

export const ETAPE_STATUTS = {
  en_attente: { label: "En attente", color: "info" },
  valide: { label: "Validé", color: "success" },
  refuse: { label: "Refusé", color: "error" },
  renvoye: { label: "Renvoyé", color: "warning" },
  passe: { label: "Étape passée", color: "info" },
};

export function newStep(patch = {}) {
  return {
    id: uid("etp"),
    label: "Bon pour accord du chef de service",
    role: "editeur",
    kind: "accord",
    // Le validateur doit relever du service de l'acte (et non de tout
    // l'établissement) : c'est le cas courant — le chef du service qui a
    // préparé l'acte le contresigne avant la direction.
    serviceScoped: true,
    optional: false,
    help: "",
    ...patch,
  };
}

export function newCircuit(patch = {}) {
  return {
    id: uid("cir"),
    label: "Nouveau circuit",
    description: "",
    active: true,
    // Ciblage : vide = « tous ». Un circuit sans aucun filtre s'applique à
    // toutes les trames (circuit général de l'établissement) ; un circuit
    // ciblé l'emporte sur un circuit général (voir `circuitFor`).
    trameIds: [],
    familyIds: [],
    entityIds: [],
    steps: [newStep()],
    ...patch,
  };
}

// --------------------------------------------------------------- résolution
// Le circuit applicable à un acte : celui que la trame désigne nommément, sinon
// le plus SPÉCIFIQUE des circuits actifs dont les filtres correspondent à la
// trame, à sa famille et à l'entité signataire. Un circuit général (sans
// filtre) ne l'emporte jamais sur un circuit ciblé.
export function circuitFor(config, { trame, acte } = {}) {
  if (!parapheurActif(config)) return null;
  const list = (config?.circuits || []).filter((c) => c && c.active !== false && (c.steps || []).length);
  if (!list.length) return null;
  if (trame) {
    if (trame.circuitId === AUCUN_CIRCUIT) return null;
    if (trame.circuitId) {
      const forced = list.find((c) => c.id === trame.circuitId);
      if (forced) return forced;
    }
  }
  const ids = (v) => (Array.isArray(v) ? v.filter(Boolean) : []);
  let best = null;
  let bestScore = -1;
  for (const c of list) {
    const t = ids(c.trameIds), f = ids(c.familyIds), e = ids(c.entityIds);
    if (t.length && !(trame && t.includes(trame.id))) continue;
    if (f.length && !(trame && f.includes(trame.familyId))) continue;
    if (e.length && !(acte && e.includes(acte.entityId))) continue;
    const score = t.length * 4 + f.length * 2 + e.length;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

// Un circuit s'applique-t-il à cette trame ? (utilisé par l'éditeur de trame)
export const circuitsApplicables = (config, trame, acte) => !!circuitFor(config, { trame, acte });

// --------------------------------------------------------------- empreinte
// Empreinte du texte de l'acte (valeurs + réécritures). Deux fois 32 bits
// (FNV-1a), en hexadécimal : suffisant pour détecter qu'un texte a changé, sans
// dépendre de `crypto.subtle` (donc utilisable de façon synchrone).
function fnv(str, seed) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i) & 0xffff;
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function empreinteTexte(acte) {
  const s = stableStringify({ v: acte?.values || {}, o: acte?.overrides || {} });
  const a = fnv(s, 0x811c9dc5);
  const b = fnv(s, 0x01000193) ^ (s.length >>> 0);
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}

export const validationAJour = (acte) =>
  !!acte?.validation && acte.validation.empreinte === empreinteTexte(acte);

// Peut-on envoyer cet acte en signature du point de vue du parapheur ?
// Sans circuit, la réponse est oui (comportement historique).
export function validationRequise(acte) {
  return !!acte?.validation;
}

export function validationPourSignature(acte) {
  const v = acte?.validation;
  if (!v) return { ok: true, raison: "" };
  if (!validationAJour(acte)) {
    return { ok: false, raison: "Le texte de l'acte a été modifié depuis le passage au parapheur : la validation doit être reprise." };
  }
  if (v.statut === "valide") return { ok: true, raison: "" };
  const reste = (v.steps || []).filter((s) => s.statut === "en_attente" && !s.optional).length;
  if (v.statut === "refuse") return { ok: false, raison: "Le circuit a été refusé : corrigez l'acte, puis soumettez-le de nouveau." };
  if (v.statut === "renvoye") return { ok: false, raison: "Le circuit a renvoyé l'acte en rédaction." };
  return { ok: false, raison: `Le circuit de validation n'est pas achevé : ${reste} étape(s) en attente.` };
}

// ------------------------------------------------------------- déroulement
export function demarrerValidation(acte, circuit, user) {
  if (!circuit || !(circuit.steps || []).length) { delete acte.validation; return null; }
  const at = new Date().toISOString();
  acte.validation = {
    circuitId: circuit.id,
    circuitLabel: circuit.label || "Circuit de validation",
    statut: "en_cours",
    demarreLe: at,
    demarrePar: user?.id || "",
    demarreParNom: nomDe(user),
    empreinte: empreinteTexte(acte),
    steps: circuit.steps.map((s) => ({
      id: s.id,
      label: s.label || "Étape",
      role: s.role || "editeur",
      kind: s.kind === "avis" ? "avis" : "accord",
      serviceScoped: !!s.serviceScoped,
      optional: !!s.optional,
      statut: "en_attente",
      by: "",
      byName: "",
      at: "",
      comment: "",
    })),
  };
  return acte.validation;
}

function nomDe(user) {
  if (!user) return "";
  return [user.firstName, user.lastName].filter(Boolean).join(" ") || user.login || "";
}

export const etapesRestantes = (v) => (v?.steps || []).filter((s) => s.statut === "en_attente");

// L'étape ouverte : le parapheur est SÉQUENTIEL — on ne passe pas à la
// direction avant le chef de service.
export function etapeActive(v) {
  const steps = v?.steps || [];
  return steps.find((s) => s.statut === "en_attente") || null;
}

// Un compte peut-il agir sur l'étape ouverte ?
export function peutValider(user) {
  return !!user && user.active !== false && (hasRole(user, "administrateur") || hasRole(user, "editeur"));
}

export function etapePour(acte, user, config) {
  const v = acte?.validation;
  if (!v || v.statut !== "en_cours" || !peutValider(user)) return null;
  if (!validationAJour(acte)) return null;
  const step = etapeActive(v);
  if (!step) return null;
  // Un administrateur peut tenir n'importe quelle étape (il est le recours
  // quand le titulaire est absent) ; les autres doivent porter le rôle demandé.
  if (!hasRole(user, "administrateur") && !hasRole(user, step.role)) return null;
  if (step.serviceScoped && acte.serviceId && !inScope(config, user, acte)) return null;
  return step;
}

// Enregistre une décision sur l'étape ouverte et recalcule l'état du circuit.
// `decision` : "valide" | "refuse" | "renvoye" | "passe" (étape facultative).
export function appliquerDecision(acte, stepId, decision, user, comment = "") {
  const v = acte?.validation;
  if (!v) return null;
  const step = (v.steps || []).find((s) => s.id === stepId);
  if (!step) return null;
  step.statut = decision;
  step.by = user?.id || "";
  step.byName = nomDe(user);
  step.at = new Date().toISOString();
  step.comment = String(comment || "").trim();
  recalculer(v);
  return step;
}

function recalculer(v) {
  const steps = v.steps || [];
  const obligatoires = steps.filter((s) => !s.optional);
  if (steps.some((s) => s.statut === "refuse")) v.statut = "refuse";
  else if (steps.some((s) => s.statut === "renvoye")) v.statut = "renvoye";
  else if (obligatoires.every((s) => s.statut === "valide" || s.statut === "passe")) v.statut = "valide";
  else v.statut = "en_cours";
  if (v.statut === "valide" || v.statut === "refuse" || v.statut === "renvoye") v.closLe = new Date().toISOString();
  else delete v.closLe;
}

// Remet le circuit à zéro (après une réécriture de l'acte, ou une reprise
// volontaire). Les décisions précédentes restent lisibles dans l'historique du
// journal, mais le circuit repart de sa première étape.
export function redemarrerValidation(acte, circuit, user) {
  if (!acte?.validation) return null;
  const ancien = { statut: acte.validation.statut, closLe: acte.validation.closLe };
  const v = demarrerValidation(acte, circuit, user);
  if (v) v.repriseDe = ancien;
  return v;
}

// Libellé d'état d'un acte du point de vue du parapheur.
export function etatParapheur(acte) {
  const v = acte?.validation;
  if (!v) return null;
  const base = VALIDATION_STATUTS[v.statut] || VALIDATION_STATUTS.en_cours;
  if (!validationAJour(acte)) return { ...base, label: "Validation caduque", color: "warning", caduque: true };
  return { ...base, caduque: false };
}

export const avancement = (v) => {
  const steps = v?.steps || [];
  if (!steps.length) return { faites: 0, total: 0 };
  return { faites: steps.filter((s) => s.statut !== "en_attente").length, total: steps.length };
};
