// ============================================================================
// Actes de démonstration.
//
// Le référentiel et les trames de démonstration vivent dans src/lib/seed.js ;
// ce module-ci produit les ACTES qui peuplent le registre (voir SEED_VERSION
// dans src/lib/store.js, qui décide quand le jeu est posé).
//
// Sept actes sont rédigés ET signés — ce ne sont pas des coquilles vides. Le
// document est compilé depuis sa trame, exporté en Akoma Ntoso, puis signé par
// le même chemin de code que l'écran « Signature & publication » (ECDSA P-256,
// certificat et horodatage de démonstration). L'original signé de ces actes se
// vérifie donc exactement comme un acte signé à la main.
//
// Quatre actes sont en cours de rédaction : trois sont prêts à être envoyés en
// signature, un est un brouillon incomplet. L'atelier de signature et la file
// « à compléter » ont ainsi de quoi travailler dès le premier écran.
//
// Deux actes illustrent les actes individuels NON PUBLIABLES (trame
// `tpl-revalorisation`) : l'un est signé, l'autre prêt à signer. Ils sont
// conservés au registre et ne passent jamais par la publication.
//
// Chaque acte porte enfin son DOSSIER :
//   • le passage au parapheur (`parapheur`), avec les étapes déjà franchies et
//     celles qui attendent encore — deux actes en cours de validation donnent
//     de quoi travailler à l'écran « Parapheur » ;
//   • les formalités d'exécution (`execution`) : transmission au contrôle de
//     légalité, publication, notification — dont une publication oubliée, pour
//     que l'échéancier ait quelque chose à signaler ;
//   • l'historique des brouillons (`revisions`) des actes encore en rédaction.
// Le tout est construit avec les fonctions de l'application (voir
// src/lib/validation.js, execution.js, revisions.js) : la démonstration
// emprunte exactement le chemin du code réel.
//
// Le jeu n'est posé que sur un registre vide dont les trames sont celles de la
// démonstration : un registre réel n'est jamais touché.
// ============================================================================
import { compile } from "./compile.js";
import { exportAkn, documentCss } from "./export.js";
import { renderDocument } from "./render.js";
import { styleForDoc } from "./styles.js";
import { buildSignedPackage, PRESTATAIRE } from "./signature.js";
import { locateAddr } from "./redaction.js";
import { circuitFor, demarrerValidation, appliquerDecision, empreinteTexte } from "./validation.js";
import { enregistrerFormalite } from "./execution.js";
import { ajouterRevision } from "./revisions.js";

// Suivi technique des circuits de signature (identique à celui que le service
// attribue : ACT-0001 pour l'acte déposé, SIG-0001 pour le circuit, DOC-0001
// pour le dossier ouvert chez le prestataire).
const DOC = ["DOC-0001-8C41", "DOC-0002-A907", "DOC-0003-51DE", "DOC-0004-B2F6", "DOC-0005-77AC", "DOC-0006-E130", "DOC-0007-4F52"];

const SPECS = [
  {
    id: "acte-demo-401",
    trameId: "tpl-delegation",
    signed: true,
    at: "2026-01-20T09:40:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0001", signatureId: "SIG-0001", docId: DOC[0], deposeLe: "2026-01-20T09:12:00" },
    values: {
      numero: "2026-401-VSL",
      objet: "délégation de signature à Madame Sophie LECLERC, secrétaire générale",
      dateSignature: "2026-01-20",
      dateEffet: "2026-02-01",
      signataire: "p-faure",
      delegataire: "p-leclerc",
      fonctionDelegataire: "secrétaire générale",
      perimetres: ["etat-civil", "urbanisme", "finances", "ressources-humaines", "associations", "scolarite"],
      typeActe: "delegation",
    },
    execution: {
      transmission: { at: "2026-01-22", ref: "2026-01-DELEG-0184", mode: "ctes", byName: "Sophie LECLERC" },
      publication: { at: "2026-01-27", ref: "RAA n° 2026-02 du 27 janvier 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-402",
    trameId: "tpl-nomination",
    signed: true,
    at: "2026-02-02T11:05:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0002", signatureId: "SIG-0002", docId: DOC[1], deposeLe: "2026-02-02T10:38:00" },
    values: {
      numero: "2026-402-VSL",
      objet: "nomination de Madame Sarah LEBLANC en qualité d'agent d'accueil de la mairie",
      dateSignature: "2026-02-02",
      dateEffet: "2026-02-16",
      signataire: "p-leclerc",
      beneficiaire: "p-leblanc",
      fonction: "agent d'accueil",
      service: "Accueil de la mairie",
    },
    execution: {
      transmission: { at: "2026-02-04", ref: "2026-02-NOM-0041", mode: "ctes", byName: "Julien MERCIER" },
      publication: { at: "2026-02-09", ref: "RAA n° 2026-03 du 9 février 2026", mode: "recueil", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-403",
    trameId: "tpl-regie-creation",
    signed: true,
    at: "2026-02-10T16:20:00",
    createdBy: "u-garnier", createdByName: "Thomas GARNIER",
    api: { acteId: "ACT-0003", signatureId: "SIG-0003", docId: DOC[2], deposeLe: "2026-02-10T15:47:00" },
    values: {
      numero: "2026-403-VSL",
      objet: "institution d'une régie de recettes pour les droits de place et de stationnement",
      dateSignature: "2026-02-10",
      dateEffet: "2026-03-01",
      signataire: "p-faure",
      nomRegie: "Régie des droits de place et de stationnement",
      service: "Régie de recettes",
      typeRegie: "recettes",
      regisseur: "p-garnier",
      dateDebut: "2026-03-01",
      moyensPaiement: ["numeraire", "cheque", "carte"],
      plafondCheque: 300,
      montantAvance: 500,
      abroge: "",
    },
    execution: {
      transmission: { at: "2026-02-12", ref: "2026-02-REG-0007", mode: "ctes", byName: "Isabelle DAVAL" },
      publication: { at: "2026-02-16", ref: "RAA n° 2026-04 du 16 février 2026", mode: "recueil", byName: "Isabelle DAVAL" },
    },
  },
  {
    id: "acte-demo-404",
    trameId: "tpl-subvention",
    signed: true,
    at: "2026-03-05T10:15:00",
    createdBy: "u-bernard", createdByName: "Éric BERNARD",
    api: { acteId: "ACT-0004", signatureId: "SIG-0004", docId: DOC[3], deposeLe: "2026-03-05T09:51:00" },
    overrides: {
      "body.7.blocks.0": "Le versement de la subvention est subordonné à la production, par l'association, d'un compte rendu d'emploi des fonds dans les trois mois suivant la clôture de l'exercice.",
    },
    values: {
      numero: "2026-404-VSL",
      objet: "attribution d'une subvention de fonctionnement à l'association Les Amis du Valmont",
      dateSignature: "2026-03-05",
      dateEffet: "",
      signataire: "p-faure",
      association: "Les Amis du Valmont",
      objetSubvention: "des actions de sauvegarde et de mise en valeur du patrimoine local",
      montant: 2500,
      imputation: "6574 — subventions de fonctionnement aux associations",
    },
    // Publiée ? Non : la transmission est partie, la publication a été oubliée.
    // C'est le cas que l'échéancier doit rattraper.
    execution: {
      transmission: { at: "2026-03-09", ref: "2026-03-SUB-0112", mode: "ctes", byName: "Éric BERNARD" },
    },
  },
  {
    id: "acte-demo-405",
    trameId: "tpl-subvention",
    entity: "ccas",
    signed: true,
    at: "2026-03-12T14:50:00",
    createdBy: "u-martin", createdByName: "Hélène MARTIN",
    api: { acteId: "ACT-0005", signatureId: "SIG-0005", docId: DOC[4], deposeLe: "2026-03-12T14:22:00" },
    values: {
      numero: "2026-405-CCAS",
      objet: "attribution d'une subvention exceptionnelle à l'association Solidarité Valmont",
      dateSignature: "2026-03-12",
      dateEffet: "",
      signataire: "p-faure",
      association: "Solidarité Valmont",
      objetSubvention: "une action d'aide alimentaire et d'accompagnement des personnes isolées",
      montant: 1800,
      imputation: "6574 — subventions de fonctionnement (budget du CCAS)",
    },
    execution: {
      transmission: { at: "2026-03-16", ref: "2026-03-CCAS-0028", mode: "ctes", byName: "Hélène MARTIN" },
      publication: { at: "2026-03-20", ref: "RAA n° 2026-06 du 20 mars 2026", mode: "recueil", byName: "Hélène MARTIN" },
    },
  },
  {
    id: "acte-demo-406",
    trameId: "tpl-subvention",
    signed: true,
    at: "2026-03-24T15:40:00",
    createdBy: "u-bernard", createdByName: "Éric BERNARD",
    api: { acteId: "ACT-0006", signatureId: "SIG-0006", docId: DOC[5], deposeLe: "2026-03-24T15:08:00" },
    values: {
      numero: "2026-406-VSL",
      objet: "attribution d'une subvention de fonctionnement à l'association Les Baladins du Valmont",
      dateSignature: "2026-03-24",
      dateEffet: "",
      signataire: "p-faure",
      association: "Les Baladins du Valmont",
      objetSubvention: "la création et la diffusion d'un spectacle de fin d'année",
      montant: 1500,
      imputation: "6574 — subventions de fonctionnement aux associations",
    },
  },
  {
    id: "acte-demo-407",
    trameId: "tpl-regie-creation",
    at: "2026-09-14T14:20:00",
    createdBy: "u-garnier", createdByName: "Thomas GARNIER",
    values: {
      numero: "2026-407-VSL",
      objet: "institution d'une régie de recettes pour la location des salles communales",
      dateSignature: "2026-09-14",
      dateEffet: "2026-10-01",
      signataire: "p-faure",
      nomRegie: "Régie des locations de salles",
      service: "Régie de recettes",
      typeRegie: "recettes",
      regisseur: "p-garnier",
      dateDebut: "2026-10-01",
      moyensPaiement: ["cheque", "virement"],
      plafondCheque: 500,
    },
    // Passé au parapheur la veille : le bon pour accord du chef de service est
    // donné, le visa de la direction générale attend encore.
    parapheur: [{ comment: "Bon pour accord sur le fond et l'imputation budgétaire." }, null],
    revisions: 2,
  },
  {
    id: "acte-demo-408",
    trameId: "tpl-subvention",
    at: "2026-09-15T09:30:00",
    createdBy: "u-martin", createdByName: "Hélène MARTIN",
    overrides: {
      "body.5.blocks.0": "Une subvention d'un montant de {{montant|money}} est attribuée à l'association {{association}} au titre de {{objetSubvention}}, pour l'exercice 2026.",
    },
    values: {
      numero: "2026-408-VSL",
      objet: "attribution d'une subvention de fonctionnement à l'association Le Petit Poucet",
      dateSignature: "2026-09-15",
      dateEffet: "",
      signataire: "p-faure",
      association: "Le Petit Poucet",
      objetSubvention: "des ateliers d'éveil et de socialisation pour les jeunes enfants",
      montant: 900,
      imputation: "",
    },
    // Soumis au parapheur, aucune étape encore franchie : c'est le cas que
    // l'écran « Parapheur » met en tête de sa file.
    parapheur: [null, null],
    revisions: 2,
  },
  {
    id: "acte-demo-409",
    trameId: "tpl-subvention",
    at: "2026-09-16T17:05:00",
    createdBy: "u-leblanc", createdByName: "Sarah LEBLANC",
    values: {
      numero: "",
      objet: "attribution d'une subvention à l'association Valmont Randonnée",
      dateSignature: "2026-09-16",
      dateEffet: "",
      signataire: "",
      association: "Valmont Randonnée",
      objetSubvention: "des sorties pédestres mensuelles ouvertes à tous",
      montant: "",
      imputation: "",
    },
    // Brouillon incomplet : jamais soumis au parapheur (il manque le montant).
    revisions: 1,
  },
  // Acte individuel NON PUBLIABLE (trame `tpl-revalorisation`, `publishable:
  // false`) : signé et conservé, mais jamais déposé au recueil — il illustre la
  // file « actes non publiables » de l'écran Signature & publication.
  {
    id: "acte-demo-410",
    trameId: "tpl-revalorisation",
    signed: true,
    at: "2026-09-18T10:20:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0007", signatureId: "SIG-0007", docId: DOC[6], deposeLe: "2026-09-18T09:58:00" },
    values: {
      numero: "2026-410-VSL",
      objet: "revalorisation du régime indemnitaire de Madame Sarah LEBLANC, agent d'accueil",
      dateSignature: "2026-09-18",
      dateEffet: "2026-10-01",
      signataire: "p-faure",
      beneficiaire: "p-leblanc",
      corps: "adjoint administratif principal de 2e classe",
      partVariable: 1200,
      motif: "prise en compte de l'expérience professionnelle acquise",
    },
    // Acte individuel : transmis le jour même, mais pas encore notifié à
    // l'intéressée — et sans notification, il ne lui est pas opposable.
    execution: {
      transmission: { at: "2026-09-18", ref: "2026-09-RH-0155", mode: "ctes", byName: "Julien MERCIER" },
    },
  },
  // Même trame, acte encore en rédaction : prêt à signer. Le circuit de
  // signature s'arrêtera à la signature (pas de publication).
  {
    id: "acte-demo-411",
    trameId: "tpl-revalorisation",
    at: "2026-09-19T08:45:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    values: {
      numero: "2026-411-VSL",
      objet: "revalorisation du régime indemnitaire de Monsieur Thomas GARNIER, régisseur",
      dateSignature: "2026-09-19",
      dateEffet: "2026-11-01",
      signataire: "p-faure",
      beneficiaire: "p-garnier",
      corps: "rédacteur principal de 2e classe",
      partVariable: 1800,
      motif: "",
    },
    // Validé par le parapheur (un seul bon pour accord pour un acte individuel) :
    // il ne reste plus qu'à le signer, puis à le notifier.
    parapheur: [{}],
    revisions: 1,
  },
];

// L'auteur du document tel que l'écran de signature le construit : le
// signataire du référentiel, replié sur la formule d'autorité de l'entité.
function auteurOf(doc) {
  const p = doc.meta?.signataire;
  return {
    nom: p ? [p.civility, p.firstName, p.lastName].filter(Boolean).join(" ") : (doc.meta?.entity?.authorityFormula || "Signataire"),
    fonction: p?.fonction || "",
    courriel: "",
    entite: doc.meta?.entity?.name || "",
  };
}

function bodyHtmlOf(doc, config) {
  return renderDocument(doc, config, {}).outerHTML.replace(/^<article[^>]*>/, "").replace(/<\/article>$/, "");
}

function ecartsOf(doc) {
  return doc.ecarts.map((e) => {
    const l = locateAddr(doc, e.addr);
    return { addr: e.addr, label: [l.area, l.label].filter(Boolean).join(" · "), original: e.original, current: e.current };
  });
}

function entiteIdDe(config, code) {
  const found = (config.entities || []).find((e) => String(e.code).toUpperCase() === code);
  return found?.id || (config.entities || [])[0]?.id || "";
}

// ------------------------------------------------------- dossier de l'acte
// Les acteurs du parapheur, par rôle, tels que la démonstration les fait
// travailler : la directrice des affaires juridiques (éditrice transverse) donne
// les bons pour accord, l'administrateur de la DSI les visas de direction.
const ACTEURS_PARAPHEUR = {
  editeur: { id: "u-daval", firstName: "", lastName: "Isabelle DAVAL" },
  administrateur: { id: "u-dubois", firstName: "", lastName: "Yann DUBOIS" },
};
const nomme = (id, name) => ({ id, firstName: "", lastName: name || "" });

// Rejoue le passage au parapheur : `spec.parapheur` est un tableau parallèle aux
// étapes du circuit — un objet pour une étape franchie, `null` pour une étape en
// attente. Sans `parapheur`, un acte signé est réputé avoir suivi son circuit
// jusqu'au bout (sinon sa signature n'aurait pas eu lieu).
function poserParapheur(acte, config, trame, spec) {
  const circuit = circuitFor(config, { trame, acte });
  const steps = circuit?.steps || [];
  if (!circuit || !steps.length) return;
  const plan = Array.isArray(spec.parapheur) ? spec.parapheur : (spec.signed ? steps.map(() => ({})) : null);
  if (!plan) return;
  const base = Date.parse(spec.at || "") || Date.now();
  demarrerValidation(acte, circuit, nomme(spec.createdBy, spec.createdByName));
  acte.validation.demarreLe = new Date(base - (steps.length + 1) * 86400000).toISOString();
  (acte.validation.steps || []).forEach((step, i) => {
    const p = plan[i];
    if (!p) return;
    const acteur = p.by ? nomme(p.by, p.byName) : (ACTEURS_PARAPHEUR[step.role] || ACTEURS_PARAPHEUR.editeur);
    appliquerDecision(acte, step.id, p.statut || "valide", acteur, p.comment || "");
    step.at = new Date(base - (steps.length - i) * 86400000).toISOString();
  });
  // L'empreinte est posée EN DERNIER : c'est elle qui atteste que le circuit a
  // porté sur ce texte-là.
  acte.validation.empreinte = empreinteTexte(acte);
}

// Rejoue les formalités d'exécution constatées (transmission, publication,
// notification).
function poserFormalites(acte, spec) {
  const e = spec.execution;
  if (!e) return;
  for (const id of ["transmission", "publication", "notification"]) {
    if (e[id]) enregistrerFormalite(acte, id, e[id]);
  }
}

// Reconstitue l'historique des brouillons : les états antérieurs de l'acte, du
// plus ancien au plus récent. Le plus ancien est un peu plus pauvre que le
// courant (le numéro n'était pas encore réservé), pour que la comparaison des
// versions ait un sens.
function poserRevisions(acte, spec) {
  const n = Number(spec.revisions) || 0;
  if (!n) return;
  const base = Date.parse(spec.at || "") || Date.now();
  for (let i = n; i >= 1; i--) {
    const rev = ajouterRevision(acte, {
      label: i === n ? "Première rédaction" : "Enregistrement",
      by: spec.createdBy, byName: spec.createdByName,
    });
    if (!rev) continue;
    rev.at = new Date(base - i * 5400000).toISOString();
    if (i === n) { rev.values.numero = ""; rev.statut = "brouillon"; }
  }
}

export async function seedActes(config, trames) {
  const trameOf = (id) => (trames || []).find((t) => t.id === id);
  const actes = [];
  for (const spec of SPECS) {
    const trame = trameOf(spec.trameId);
    if (!trame) continue;
    const values = {
      __entityId: spec.entity === "ccas" ? entiteIdDe(config, "CCAS") : entiteIdDe(config, "VSL"),
      __overrides: spec.overrides || {},
      ...spec.values,
    };
    const doc = compile(trame, values, config);
    doc.kind = "original";
    const blocking = (doc.issues || []).some((i) => i.level === "blocking");
    const acte = {
      id: spec.id,
      kind: "original",
      trameId: trame.id,
      trameName: trame.name,
      serviceId: trame.serviceId || "",
      bureauId: trame.bureauId || "",
      numero: values.numero || "",
      objet: values.objet || "",
      entityId: values.__entityId,
      dateSignature: values.dateSignature || "",
      statut: spec.signed ? "signee" : (blocking ? "brouillon" : "pret"),
      createdAt: spec.at,
      updatedAt: spec.at,
      createdBy: spec.createdBy,
      createdByName: spec.createdByName,
      values,
      overrides: { ...(spec.overrides || {}) },
      ecarts: ecartsOf(doc),
      issues: doc.issues,
      eli: doc.meta.eli,
    };
    // Le dossier de l'acte : parapheur et historique AVANT la signature (c'est
    // l'ordre réel), formalités APRÈS (elles suivent la signature).
    poserParapheur(acte, config, trame, spec);
    poserRevisions(acte, spec);
    if (spec.signed) {
      try {
        const auteur = auteurOf(doc);
        const akn = exportAkn(doc, config, trame);
        const pack = await buildSignedPackage({
          akn, pageHtml: bodyHtmlOf(doc, config), pageCss: documentCss(config, styleForDoc(config, doc)),
          numero: acte.numero, objet: acte.objet,
          signataire: auteur, prestataire: PRESTATAIRE, brand: config.brand?.name || "", signeLe: spec.at,
        });
        acte.original = pack;
        acte.signeLe = pack.signatures[0].signeLe;
        acte.api = {
          acteId: spec.api.acteId, signatureId: spec.api.signatureId, docId: spec.api.docId,
          statut: "signee", sha256: pack.document.sha256,
          lienSignature: `${PRESTATAIRE.baseUrl}/signature/${spec.api.signatureId}`,
          signataire: auteur.nom, deposeLe: spec.api.deposeLe, akn,
        };
      } catch (e) {
        // Sans WebCrypto (contexte non sécurisé), l'acte reste rédigé : il sera
        // signé depuis l'écran de signature comme n'importe quel autre.
        console.warn("Signature de démonstration impossible :", e);
        acte.statut = "pret";
      }
    }
    poserFormalites(acte, spec);
    actes.push(acte);
  }

  // La séquence de numérotation reprend après le dernier numéro utilisé.
  const seqMax = Math.max(
    Number(config.numbering?.seq || 1) - 1,
    ...actes.map((a) => Number((String(a.numero || "").match(/^\d{4}-(\d+)/) || [])[1]) || 0),
  );
  config.numbering.seq = seqMax + 1;
  return actes;
}
