// ============================================================================
// LE PARCOURS D'UN ACTE — les phases de son chemin, leur ORDRE, et qui les
// tient.
//
// Un acte ne suit pas un chemin linéaire « rédiger, signer, publier » : il
// traverse des PORTES, et ces portes ne se remplacent pas l'une l'autre.
//
//   1. le PARAPHEUR (src/lib/validation.js) — le circuit de validation du
//      référentiel : ses étapes, tour à tour (une vérification, un visa, une
//      signature), confiées à un rôle, une personne ou un service. L'acte ne
//      part pas en signature tant que le circuit n'est pas achevé ;
//   2. la RÉVISION (src/lib/revision.js) — le contrôle du réviseur COMPÉTENT
//      pour l'acte. Elle vient APRÈS le parapheur et AVANT la signature : le
//      circuit approuve le texte, le réviseur le contrôle juste avant qu'il ne
//      soit signé. C'est une porte indépendante : sans réviseur compétent,
//      elle n'existe pas, et l'acte part directement en signature ;
//   3. la SIGNATURE — donnée par le signataire désigné, dans l'application
//      (simple), auprès d'un prestataire (électronique), ou hors de
//      l'application (circuit externe) ;
//   4. dans le circuit EXTERNE, la révision n'est pas en amont : elle prend la
//      forme d'une CERTIFICATION DE CONFORMITÉ, après la signature, sur la
//      pièce signée déposée (voir src/lib/externe.js).
//
// À cela s'ajoutent, quand les fonctions sont actives, la transmission au
// contrôle de légalité (entre la signature et la publication — voir
// src/lib/legalite.js) et la publication au recueil (voir src/lib/eli.js).
//
// Cette lecture ne sert qu'à MONTRER le positionnement de chacun : elle
// rassemble ce que les modules savent déjà, sans rien décider à leur place.
// L'ordre des phases produites est l'ordre RÉEL du chemin de l'acte ; c'est ce
// qui permet aux fils d'étapes de l'atelier (la ligne de parcours de l'écran de
// rédaction, les marches du circuit de signature) de dire la même chose.
//
// Une ANNEXE, elle, ne suit pas ce chemin : elle ne se signe ni ne se publie
// pour elle-même — elle est ADOPTÉE par un acte, et c'est cet acte qui porte la
// signature (voir src/lib/annexes.js). Son parcours le dit, plutôt que de lui
// faire suivre les portes d'un acte ordinaire.
//
// Ce module est PUR : ni DOM, ni état de l'application.
// ============================================================================
import { natureOfActe, estReglementActe, appellationAnnexe } from "./annexes.js";
import { circuitFor, validationAJour, etiquetteEtape, etapeCible, ETAPE_STATUTS } from "./validation.js";
import { revisionRequise, reviseursPour, revisionAJour } from "./revision.js";
import { signataireEffectif, placeDansChaine } from "./signataires.js";
import { modeSignature, certificationDe, certificationRequise, versionSignee } from "./externe.js";
import { controleLegaliteActif } from "./legalite.js";
import { tramePublishable } from "./schema.js";

// Les LIBELLÉS courts d'une phase (ce que porte une puce de timeline) et son
// intitulé long (ce que porte une infobulle ou un titre).
export const PHASE_LABELS = {
  redaction: { court: "Rédaction", long: "Rédaction de l'acte" },
  parapheur: { court: "Parapheur", long: "Circuit de validation (parapheur)" },
  revision: { court: "Révision", long: "Révision — contrôle avant la signature" },
  signature: { court: "Signature", long: "Signature de l'acte" },
  certification: { court: "Certification", long: "Certification de conformité de la pièce signée" },
  legalite: { court: "Contrôle de légalité", long: "Transmission au contrôle de légalité" },
  publication: { court: "Publication", long: "Publication au recueil" },
  adoption: { court: "Adoption", long: "Adoption de l'annexe par un acte" },
  information: { court: "Publication informative", long: "Publication informative au recueil (règlement)" },
};

const nomDe = (u) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") || u.login || "" : "");
const personneNom = (config, id) => {
  const p = (config?.people || []).find((x) => x.id === id);
  return p ? [p.civility, p.firstName, p.lastName].filter(Boolean).join(" ") : "";
};

// L'état de la phase : `fait` (franchie), `encours` (la porte ouverte),
// `avenir` (à venir), ou `sansobjet`.
//
// « Sans objet » demande une explication, parce que le cas n'a rien
// d'exceptionnel : une porte peut avoir été PASSÉE SANS ÊTRE FRANCHIE. Un acte
// signé et publié avant que le référentiel ne prévoie une révision n'en porte
// aucune trace ; l'annoncer « en cours » serait faux, puisque l'acte est déjà
// plus loin qu'elle — et le fil se contredirait lui-même, une porte « ouverte »
// voisinant des puces vertes. On la dit donc pour ce qu'elle est : une porte que
// le chemin n'a pas empruntée.
function marquerEtats(phases) {
  let derniereFranchie = -1;
  phases.forEach((p, i) => { if (p.fait) derniereFranchie = i; });
  let encours = false;
  phases.forEach((p, i) => {
    if (p.fait) { p.etat = "fait"; return; }
    if (i < derniereFranchie) {
      p.etat = "sansobjet";
      p.hint = (p.hint ? p.hint + " " : "") +
        "Cette porte n'a pas été franchie : l'acte est allé plus loin sans elle (aucune trace au dossier).";
      return;
    }
    if (!encours) { p.etat = "encours"; encours = true; return; }
    p.etat = "avenir";
  });
  return phases;
}

// Les étapes d'un circuit, telles qu'on les montre : l'intitulé, la NATURE du
// geste (vérification, visa, signature), qui la tient et où elle en est. Quand
// le circuit est ouvert, on lit les étapes FIGÉES au démarrage (`validation.steps`,
// qui gardent le titulaire de ce jour-là) ; tant qu'il ne l'est pas, on lit le
// circuit du référentiel, et toutes les étapes sont à venir.
export function etapesDuCircuit(circuit, validation, acte, config) {
  if (validation && Array.isArray(validation.steps) && validation.steps.length) {
    return validation.steps.map((s) => ({
      label: s.label || "Étape",
      nature: etiquetteEtape(s.kind).label,
      titulaire: s.cibleLabel || libelleRole(s.role),
      statut: s.statut || "en_attente",
      statutLabel: (ETAPE_STATUTS[s.statut] || ETAPE_STATUTS.en_attente).label,
      optional: !!s.optional,
      fait: s.statut === "valide" || s.statut === "passe",
    }));
  }
  return (circuit?.steps || []).map((s) => ({
    label: s.label || "Étape",
    nature: etiquetteEtape(s.kind).label,
    titulaire: etapeCible(s, config),
    statut: "en_attente",
    statutLabel: ETAPE_STATUTS.en_attente.label,
    optional: !!s.optional,
    fait: false,
  }));
}

// Le libellé du rôle d'une étape, tel qu'on le lit dans une phrase.
function libelleRole(role) {
  return ({ reviseur: "le réviseur", editeur: "un éditeur", administrateur: "l'administration", signataire: "le signataire" })[role] || role || "un valideur";
}

// ---------------------------------------------------------------------------
// Le parcours d'un acte ordinaire.
// ---------------------------------------------------------------------------
export function parcoursDeActe(acte, { config, trames = [], users = [], trame } = {}) {
  const t = trame !== undefined ? trame : ((trames || []).find((x) => x.id === acte?.trameId) || null);
  if (natureOfActe(acte, trames) === "annexe") return parcoursAnnexe(acte, { config, trames, trame: t });

  const mode = modeSignature(config, t, acte);
  const externe = mode === "externe";
  const circuit = circuitFor(config, { trame: t, acte });
  const validation = acte?.validation || null;
  const paraFait = !!(validation && validationAJour(acte) && validation.statut === "valide");
  const revRequise = revisionRequise(config, users, { trame: t, acte });
  const revValide = !!(acte?.revision && acte.revision.statut === "valide" && revisionAJour(acte));
  const signe = !!(acte && (acte.original || acte.statut === "signee" || acte.statut === "publie")) || !!versionSignee(acte);
  const publiable = t ? tramePublishable(t) : acte?.publishable !== false;
  const publie = !!(acte && acte.statut === "publie" && acte.publication);
  const cert = certificationDe(acte) || {};

  const phases = [];

  phases.push({
    cle: "redaction",
    nature: "redaction",
    label: PHASE_LABELS.redaction.court,
    titre: PHASE_LABELS.redaction.long,
    acteur: acte?.createdByName ? "Le rédacteur — " + acte.createdByName : "Le rédacteur",
    fait: !!acte,
    hint: "Le texte est écrit, puis enregistré : c'est cette version qui sera contrôlée et signée.",
  });

  if (circuit) {
    const sousEtapes = etapesDuCircuit(circuit, validation, acte, config);
    const restantes = sousEtapes.filter((s) => !s.fait && !s.optional).length;
    phases.push({
      cle: "parapheur",
      nature: "parapheur",
      label: PHASE_LABELS.parapheur.court,
      titre: PHASE_LABELS.parapheur.long + " — " + (circuit.label || ""),
      acteur: "Le circuit de validation",
      fait: paraFait,
      sousEtapes,
      hint: paraFait
        ? "Le circuit est achevé : ses étapes sont franchies dans l'ordre."
        : restantes
          ? `Il reste ${restantes} étape(s) à franchir : l'acte ne partira qu'une fois le circuit achevé.`
          : "Le circuit reste à ouvrir : « Soumettre au circuit » engage la première étape.",
    });
  }

  if (!externe) {
    if (revRequise) {
      const reviseurs = reviseursPour(config, users, { trame: t, acte });
      phases.push({
        cle: "revision",
        nature: "revision",
        label: PHASE_LABELS.revision.court,
        titre: PHASE_LABELS.revision.long,
        acteur: "Le réviseur" + (reviseurs.length ? " — " + reviseurs.map(nomDe).filter(Boolean).join(", ") : ""),
        fait: revValide,
        position: "après le parapheur · avant la signature",
        hint: "Vient APRÈS le parapheur, et AVANT la signature : le réviseur contrôle le texte, peut le corriger, puis le valide ou le rejette.",
      });
    }
  }

  phases.push({
    cle: "signature",
    nature: "signature",
    label: PHASE_LABELS.signature.court,
    titre: externe ? "Signature hors de l'application (circuit externe)" : PHASE_LABELS.signature.long,
    acteur: acteurDeSignature(config, acte, t),
    fait: signe,
    hint: externe
      ? "Le document est remis au signataire, signé hors de l'application, puis sa version signée est déposée et certifiée."
      : "La signature engage son auteur : le signataire désigné signe le texte tel qu'il a été contrôlé.",
  });

  if (externe) {
    const requise = acte?.externe ? certificationRequise(acte) : revRequise;
    if (requise) {
      phases.push({
        cle: "certification",
        nature: "certification",
        label: PHASE_LABELS.certification.court,
        titre: PHASE_LABELS.certification.long,
        acteur: "Le réviseur",
        fait: cert.statut === "conforme",
        position: "après la signature · avant la publication",
        hint: "Dans le circuit externe, le contrôle du réviseur ne précède pas la signature : il porte sur la PIÈCE signée déposée, et commande la publication.",
      });
    }
  }

  if (controleLegaliteActif(config)) {
    phases.push({
      cle: "legalite",
      nature: "legalite",
      label: PHASE_LABELS.legalite.court,
      titre: PHASE_LABELS.legalite.long,
      acteur: "Le contrôle de légalité (préfecture)",
      fait: !!(acte && acte.execution && acte.execution.transmission),
      position: "après la signature · avant la publication",
      hint: "L'acte signé est télétransmis à la préfecture avant sa publication.",
    });
  }

  if (publiable) {
    phases.push({
      cle: "publication",
      nature: "publication",
      label: PHASE_LABELS.publication.court,
      titre: PHASE_LABELS.publication.long,
      acteur: "Le recueil public",
      fait: publie,
      hint: publie ? "L'acte est publié : il reçoit son identifiant ELI et devient opposable." : "La publication au recueil donne à l'acte son opposabilité.",
    });
  } else {
    phases.push({
      cle: "conservation",
      nature: "publication",
      label: "Conservation au registre",
      titre: "Acte non publiable — conservé au registre",
      acteur: "Le registre des actes",
      fait: signe,
      hint: "La trame a déclaré cet acte non publiable : signé, il produit ses effets et reste au registre, sans publication au recueil.",
    });
  }

  marquerEtats(phases);
  return { phases, courante: cleCourante(phases), annexe: false };
}

// ---------------------------------------------------------------------------
// Le parcours d'une ANNEXE : un autre chemin, qui dit ce qu'elle est.
// ---------------------------------------------------------------------------
function parcoursAnnexe(acte, { config, trames, trame }) {
  const reglement = estReglementActe(acte, trames);
  const adoption = acte?.adoptePar || null;
  const phases = [{
    cle: "redaction",
    nature: "redaction",
    label: PHASE_LABELS.redaction.court,
    titre: "Rédaction du document annexé",
    acteur: acte?.createdByName ? "Le rédacteur — " + acte.createdByName : "Le rédacteur",
    fait: !!acte,
    hint: "Une annexe n'a pas d'autorité propre : elle tient la sienne de l'acte qui l'adopte.",
  }, {
    cle: "adoption",
    nature: "adoption",
    label: PHASE_LABELS.adoption.court,
    titre: PHASE_LABELS.adoption.long,
    acteur: adoption ? "L'acte d'adoption — " + appellationAnnexe(acte, config) : "L'acte d'adoption (à désigner)",
    fait: !!adoption,
    hint: adoption
      ? "C'est l'acte d'adoption qui est signé : sa signature donne à l'annexe son autorité, et son texte suit l'acte dans l'original signé."
      : "Désignez l'acte qui adopte l'annexe : c'est lui qui portera la signature.",
  }];
  if (reglement) {
    phases.push({
      cle: "information",
      nature: "information",
      label: PHASE_LABELS.information.court,
      titre: PHASE_LABELS.information.long,
      acteur: "Le recueil public",
      fait: acte?.statut === "publie",
      hint: "Un règlement se consulte pour lui-même, comme un code : le recueil en donne une publication informative autonome, à côté de sa place dans l'acte qui l'adopte.",
    });
  }
  marquerEtats(phases);
  return { phases, courante: cleCourante(phases), annexe: true };
}

function cleCourante(phases) {
  const p = phases.find((x) => x.etat === "encours");
  return p ? p.cle : (phases.length ? phases[phases.length - 1].cle : null);
}

// Qui signe l'acte, et à quel titre : le signataire effectif (désigné par la
// rédaction, ou le signataire principal de l'entité), et sa place dans la
// chaîne de signature (« par délégation », « par subdélégation »…).
function acteurDeSignature(config, acte, trame) {
  const sigId = signataireEffectif(config, acte, trame);
  const nom = personneNom(config, sigId);
  if (!nom) return "Le signataire désigné";
  const place = acte ? placeDansChaine(config, acte, trame, sigId) : "";
  return "Le signataire — " + nom + (place ? " (" + place + ")" : "");
}
