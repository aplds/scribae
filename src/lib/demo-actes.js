// ============================================================================
// Actes de démonstration.
//
// Le référentiel et les trames de démonstration vivent dans src/lib/seed.js ;
// ce module-ci produit les ACTES qui peuplent le registre (voir SEED_VERSION
// dans src/lib/store.js, qui décide quand le jeu est posé).
//
// SOIXANTE-SIX ACTES peuplent le registre, pour une collectivité d'une
// certaine importance — la ville fictive de Valmont-sur-Loire et ses
// établissements. La plupart sont rédigés ET signés : ce ne sont pas des
// coquilles vides, le document est compilé depuis sa trame, exporté en Akoma
// Ntoso, puis signé par le même chemin de code que l'écran « Signature &
// publication » (ECDSA P-256, certificat et horodatage de démonstration).
// L'original signé de ces actes se vérifie donc exactement comme un acte signé à
// la main.
//
// La variété des DOCUMENTS est le propos : arrêtés de police (circulation,
// stationnement, salubrité, sécurité), arrêtés d'organisation d'une manifestation,
// règlements, délibérations, conventions, décisions d'engagement de dépense,
// avenants à marché, occupations du domaine public, concessions funéraires,
// nominations, délégations de signature, régies, subventions, périscolaire,
// environnement — et leurs ANNEXES.
//
// La démonstration met surtout en avant DEUX FAMILLES, parce que ce sont elles
// qu'une collectivité montre d'abord :
//
//   • les ANNEXES — un document adopté, qui ne se signe ni ne se publie pour
//     lui-même : le règlement d'accès à la restauration scolaire et la grille
//     tarifaire des services municipaux (dont le prix du repas), le règlement
//     intérieur du conseil, la charte de la participation citoyenne, et les
//     documents joints à une manifestation (plan de circulation et de
//     stationnement, programme, déroulé de la cérémonie). Leur texte suit
//     l'original signé de l'acte qui les adopte (voir src/lib/annexe-docs.js).
//   • les ÉVÉNEMENTS À VENIR — la fête du village « Valmont en fête », le
//     marché de Noël, la cérémonie commémorative du 11 novembre : organisés
//     par un arrêté du maire, avec leur emprise, leurs mesures de police et
//     leurs annexes. Ce sont les actes qu'un administré vient consulter.
//
// Quinze actes sont enfin PUBLIÉS, c'est-à-dire que la fiction leur donne une
// constatation de publication au recueil (voir `execution.publication`) :
// l'amorçage de démonstration les dépose au service, qui tient le recueil public
// (src/ui/demo-publications.js). Le choix de ces quinze-là n'est pas un hasard :
// ils couvrent les deux familles mises en avant (les six annexes publiées, les
// trois événements) et une dizaine d'autres documents, de la délégation de
// signature au plan de stationnement ; le recueil public montre ainsi toute la
// variété de la collectivité, sans exiger de l'amorçage un travail de plusieurs
// minutes. Les autres actes sont signés, transmis au contrôle de légalité, et
// attendent leur publication : c'est l'état réel d'un registre en
// fonctionnement, et ce que l'échéancier a à montrer.
//
// Quelques actes sont en cours de rédaction : deux sont prêts à être envoyés en
// signature, deux sont revenus en brouillon (un incomplet, un rejeté en
// révision), et un est en attente de révision. L'atelier de signature, la file
// « à compléter » et l'écran « Révision » ont ainsi de quoi travailler dès le
// premier écran.
//
// Deux actes illustrent les actes individuels NON PUBLIABLES (trame
// `tpl-revalorisation`) : l'un est signé, l'autre attend son réviseur. Ils sont
// conservés au registre et ne passent jamais par la publication.
//
// Chaque acte porte enfin son DOSSIER :
//   • le passage au parapheur (`parapheur`), avec les étapes déjà franchies et
//     celles qui attendent encore — deux actes en cours de validation donnent
//     de quoi travailler à l'écran « Parapheur » ;
//   • la RÉVISION (`revision`) : l'acte contrôlé par un réviseur, selon qu'il
//     attend, qu'il a été révisé (et corrigé) ou qu'il a été rejeté — le motif
//     du rejet, lui, est communiqué au rédacteur ;
//   • les formalités d'exécution (`execution`) : transmission au contrôle de
//     légalité, publication, notification — dont une publication oubliée, pour
//     que l'échéancier ait quelque chose à signaler ;
//   • l'historique des brouillons (`historique-brouillons`) des actes encore en rédaction.
// Le tout est construit avec les fonctions de l'application (voir
// src/lib/validation.js, execution.js, historique-brouillons.js) : la démonstration
// emprunte exactement le chemin du code réel.
//
// Le jeu n'est posé que sur un registre vide dont les trames sont celles de la
// démonstration : un registre réel n'est jamais touché.
// ============================================================================
import { compile } from "./compile.js";
import { annexesJointes } from "./annexe-docs.js";
import { exportAkn, documentCss } from "./export.js";
import { renderDocument } from "./render.js";
import { styleForDoc } from "./styles.js";
import { buildSignedPackage, PRESTATAIRE } from "./signature.js";
import { locateAddr } from "./redaction.js";
import { circuitFor, demarrerValidation, appliquerDecision, empreinteTexte } from "./validation.js";
import { demanderRevision, validerRevision, rejeterRevision } from "./revision.js";
import { enregistrerFormalite, enregistrerRecours } from "./execution.js";
import { certificatTransmission, CONTROLE_LEGALITE } from "./legalite.js";
import { ajouterRevision } from "./historique-brouillons.js";
import { eliUri } from "./eli.js";

// Suivi technique des circuits de signature (identique à celui que le service
// attribue : ACT-0001 pour l'acte déposé, SIG-0001 pour le circuit, DOC-0001
// pour le dossier ouvert chez le prestataire).
const DOC = [
  "DOC-0001-8C41", "DOC-0002-A907", "DOC-0003-51DE", "DOC-0004-B2F6", "DOC-0005-77AC",
  "DOC-0006-E130", "DOC-0007-4F52", "DOC-0008-2E7B", "DOC-0009-3D1A", "DOC-0010-C4D9",
  "DOC-0011-9A3C", "DOC-0012-6E70", "DOC-0013-A1F8", "DOC-0014-77B3", "DOC-0015-2C9E",
  "DOC-0016-84D1", "DOC-0017-5E6A", "DOC-0018-B0C4", "DOC-0019-3F27", "DOC-0020-D85B",
  "DOC-0021-6A1E", "DOC-0022-9C40", "DOC-0023-18D7", "DOC-0024-7B2E", "DOC-0025-C3A6",
  "DOC-0026-4F91", "DOC-0027-E258", "DOC-0028-0A7D", "DOC-0029-96C3", "DOC-0030-B1E9",
  "DOC-0031-52F4", "DOC-0032-8D60", "DOC-0033-C7B1", "DOC-0034-3E95", "DOC-0035-6A48",
  "DOC-0036-F2D0", "DOC-0037-9B53", "DOC-0038-1C7E", "DOC-0039-60A2", "DOC-0040-E4B8",
  "DOC-0041-7F95", "DOC-0042-2B17", "DOC-0043-D0C6", "DOC-0044-84E1", "DOC-0045-3A29",
  "DOC-0046-C95F", "DOC-0047-1E74", "DOC-0048-5B08", "DOC-0049-A73C", "DOC-0050-2F61",
];

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
      transmission: { at: "2026-01-22", ref: "2026-01-DELEG-0184", mode: "ctes", recuLe: "2026-01-22T09:14:00", byName: "Sophie LECLERC" },
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
      transmission: { at: "2026-02-04", ref: "2026-02-NOM-0041", mode: "ctes", recuLe: "2026-02-04T10:27:00", byName: "Julien MERCIER" },
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
      transmission: { at: "2026-02-12", ref: "2026-02-REG-0007", mode: "ctes", recuLe: "2026-02-12T15:06:00", byName: "Isabelle DAVAL" },
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
      transmission: { at: "2026-03-09", ref: "2026-03-SUB-0112", mode: "ctes", recuLe: "2026-03-09T11:38:00", byName: "Éric BERNARD" },
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
      signataire: "p-martin",
      association: "Solidarité Valmont",
      objetSubvention: "une action d'aide alimentaire et d'accompagnement des personnes isolées",
      montant: 1800,
      imputation: "6574 — subventions de fonctionnement (budget du CCAS)",
    },
    execution: {
      transmission: { at: "2026-03-16", ref: "2026-03-CCAS-0028", mode: "ctes", recuLe: "2026-03-16T08:52:00", byName: "Hélène MARTIN" },
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
      transmission: { at: "2026-09-18", ref: "2026-09-RH-0155", mode: "ctes", recuLe: "2026-09-18T16:03:00", byName: "Julien MERCIER" },
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
    // Validé par le parapheur (un seul bon pour accord pour un acte individuel),
    // puis ENVOYÉ AU RÉVISEUR : le contrôle du service des affaires juridiques
    // attend. C'est l'acte que l'écran « Révision » met en tête de sa file.
    parapheur: [{}],
    revision: "attente",
    revisions: 1,
  },
  // Le cas de la chaîne de délégations : un permis de construire signé par le
  // chef du bureau Urbanisme, qui tient sa compétence du maire par l'adjoint à
  // l'urbanisme — et par subdélégation de celui-ci. Le document porte les trois
  // lignes de qualité, et seul le nom du signataire (Karim BENALI). Voir
  // src/lib/delegations.js et l'écran « Délégations ».
  {
    id: "acte-demo-412",
    trameId: "tpl-permis-construire",
    signed: true,
    at: "2026-09-17T11:30:00",
    createdBy: "u-benali", createdByName: "Karim BENALI",
    api: { acteId: "ACT-0008", signatureId: "SIG-0008", docId: DOC[7], deposeLe: "2026-09-17T11:04:00" },
    values: {
      numero: "2026-412-VSL",
      objet: "permis de construire une maison individuelle",
      dateSignature: "2026-09-17",
      dateEffet: "",
      signataire: "p-benali",
      demandeur: "p-leblanc",
      adresseTerrain: "12 rue des Tilleuls",
      parcelle: "section AB n° 214",
      natureTravaux: "la construction d'une maison individuelle de 138 m²",
      surfacePlancher: 138,
      prescriptions: "",
    },
    execution: {
      transmission: { at: "2026-09-18", ref: "2026-09-URB-0317", mode: "ctes", recuLe: "2026-09-18T09:41:00", byName: "Karim BENALI" },
      publication: { at: "2026-09-22", ref: "RAA n° 2026-19 du 22 septembre 2026", mode: "recueil", byName: "Karim BENALI" },
    },
  },
  // Le cas de l'AUTORITÉ AUTONOME : une décision de l'office public de
  // l'habitat, signée par son directeur général sur délégation du président de
  // son conseil d'administration. La chaîne est indépendante de celle de la
  // commune : elle ne remonte pas au maire, mais au président de l'office. Voir
  // src/lib/delegations.js et l'écran « Délégations ».
  {
    id: "acte-demo-413",
    trameId: "tpl-marche-oph",
    entity: "oph",
    signed: true,
    at: "2026-09-18T15:10:00",
    createdBy: "u-marchand", createdByName: "Nadia MARCHAND",
    api: { acteId: "ACT-0009", signatureId: "SIG-0009", docId: DOC[8], deposeLe: "2026-09-18T14:47:00" },
    values: {
      numero: "2026-413-OPH",
      objet: "passation du marché de réhabilitation des façades de la résidence des Tilleuls",
      dateSignature: "2026-09-18",
      dateEffet: "",
      signataire: "p-marchand",
      objetMarche: "la réhabilitation des façades de la résidence des Tilleuls",
      titulaire: "SARL Bâtir Ensemble",
      montant: 186500,
      procedure: "appel-offres-ouvert",
      duree: "huit mois à compter de l'ordre de service",
    },
    // Révisé par Isabelle DAVAL, directrice des affaires juridiques : sa
    // COMPÉTENCE PROPRE (le compte) porte sur les actes d'engagement financier —
    // marchés et subventions. Elle tient par ailleurs la qualité du service des
    // affaires générales, qui contrôle l'ensemble des actes : la compétence d'un
    // compte est la RÉUNION de la sienne et de celles de ses services (voir
    // src/lib/revision.js). Elle a corrigé le texte avant de valider (`corrige`) :
    // la trace de la correction reste au dossier de l'acte.
    revision: { statut: "valide", par: "u-daval", parName: "Isabelle DAVAL", corrige: true },
    execution: {
      transmission: { at: "2026-09-21", ref: "2026-09-OPH-0042", mode: "ctes", recuLe: "2026-09-21T14:19:00", byName: "Nadia MARCHAND" },
    },
  },
  // Le cas du RECOURS : un permis de construire délivré au printemps, dont le
  // délai de recours est échu — mais qu'un voisin a attaqué devant le tribunal
  // administratif dans ce délai. L'acte n'est donc pas « définitif » : il est
  // contesté, et aucune attestation de non-recours ne peut être délivrée (voir
  // `recours` dans src/lib/execution.js).
  {
    id: "acte-demo-414",
    trameId: "tpl-permis-construire",
    signed: true,
    at: "2026-04-08T10:35:00",
    createdBy: "u-benali", createdByName: "Karim BENALI",
    api: { acteId: "ACT-0010", signatureId: "SIG-0010", docId: DOC[9], deposeLe: "2026-04-08T10:02:00" },
    values: {
      numero: "2026-414-VSL",
      objet: "permis de construire un garage et une extension pour une maison d'habitation",
      dateSignature: "2026-04-08",
      dateEffet: "",
      signataire: "p-benali",
      demandeur: "p-daval",
      adresseTerrain: "8 chemin des Vignes",
      parcelle: "section AC n° 417",
      natureTravaux: "la construction d'un garage accolé et d'une extension de 42 m²",
      surfacePlancher: 62,
      prescriptions: "L'accès au terrain se fera par le chemin des Vignes, dans les conditions définies par le service de la voirie.",
    },
    execution: {
      transmission: { at: "2026-04-09", ref: "2026-04-URB-0112", mode: "ctes", recuLe: "2026-04-09T11:14:00", byName: "Karim BENALI" },
    },
    recours: { introduitLe: "2026-05-20", type: "contentieux", demandeur: "M. et Mme VASSEUR, voisins du projet (par Me Lorrain, avocat)", ref: "requête n° 2601894 — greffe du tribunal administratif d'Orléans", note: "Recours en annulation pour erreur d'appréciation et atteinte aux conditions de desserte. Mémoire en défense à produire pour le 15 novembre 2026.", by: "u-daval", byName: "Isabelle DAVAL" },
  },
  {
    id: "acte-demo-415",
    trameId: "tpl-subvention",
    at: "2026-09-17T11:15:00",
    createdBy: "u-leblanc", createdByName: "Sarah LEBLANC",
    values: {
      numero: "2026-415-VSL",
      objet: "attribution d'une subvention de fonctionnement à l'association Valmont Randonnée",
      dateSignature: "2026-09-17",
      dateEffet: "",
      signataire: "p-faure",
      association: "Valmont Randonnée",
      objetSubvention: "des sorties pédestres mensuelles ouvertes à tous",
      montant: 2200,
      imputation: "6574 — subventions de fonctionnement aux associations",
    },
    // Le parapheur est achevé ; le rejet vient de la révision.
    parapheur: [{}, {}],
    revision: {
      statut: "rejete", par: "u-roussel", parName: "Amandine ROUSSEL",
      motif: "Le montant annoncé dans l'article 1er ne correspond pas à la délibération du 9 septembre (2 500 € et non 2 200 €), et la convention n'est pas visée. À corriger avant nouvel envoi.",
    },
    revisions: 2,
  },
  // Le cas de l'ANNEXE : une DÉLIBÉRATION qui adopte le règlement intérieur du
  // conseil, et le RÈGLEMENT lui-même — un document adopté par un autre, qui ne
  // se signe PAS. C'est la délibération qui est signée, et son original est suivi
  // du texte du règlement, dans le même document (voir src/lib/annexe-docs.js).
  // Le lien se noue par les `liens` ci-dessous (la rédaction l'aurait posé par la
  // carte « Annexes » et la carte « Acte d'adoption ») : le règlement porte le
  // visa de la délibération en tête de ses visas, et la délibération annonce le
  // règlement en fin de dispositif, puis le donne à lire. Voir src/lib/annexes.js,
  // et les trames `tpl-deliberation` / `tpl-reglement-int`.
  {
    id: "acte-demo-416",
    trameId: "tpl-deliberation",
    signed: true,
    at: "2026-09-24T10:20:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0011", signatureId: "SIG-0011", docId: DOC[10], deposeLe: "2026-09-24T09:55:00" },
    annexesRefs: [{ ref: "acte-demo-417", designation: "Règlement intérieur" }],
    values: {
      numero: "2026-416-VSL",
      objet: "adoption du règlement intérieur du conseil municipal",
      dateSignature: "2026-09-24",
      dateEffet: "",
      signataire: "p-faure",
    },
    execution: {
      transmission: { at: "2026-09-25", ref: "2026-09-DELIB-0231", mode: "ctes", recuLe: "2026-09-25T09:41:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-09-28", ref: "RAA n° 2026-20 du 28 septembre 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    // L'ANNEXE elle-même : elle n'est ni signée ni publiée pour elle-même, et
    // elle n'a PAS de numéro — son identité, c'est la décision qui l'adopte (son
    // `adoptionRef`), et sa date est celle de cette décision. Son texte est
    // compilé et joint à l'original signé de la délibération ci-dessus. Voir
    // src/lib/annexes.js.
    id: "acte-demo-417",
    trameId: "tpl-reglement-int",
    at: "2026-09-24T10:35:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    adoptionRef: { ref: "acte-demo-416", designation: "Délibération" },
    values: {
      objet: "règlement intérieur du conseil municipal",
      dateSignature: "2026-09-24",
      dateEffet: "2026-09-25",
    },
  },

  // ==========================================================================
  // LA RESTAURATION SCOLAIRE — le couple ADOPTION / ANNEXE que la démonstration
  // met en avant, et les actes qui l'entourent : l'accès aux cantines, la
  // sécurité des abords des écoles, les repas, les tarifs.
  //
  // Le RÈGLEMENT DE LA RESTAURATION SCOLAIRE est une ANNEXE : il n'est ni signé
  // ni publié pour lui-même, c'est la délibération qui l'adopte qui l'est, et
  // son texte suit l'original de cette délibération (voir src/lib/annexe-docs.js).
  // C'est lui que la bande « À la une » du recueil met en avant.
  // ==========================================================================
  {
    id: "acte-demo-418",
    trameId: "tpl-deliberation",
    signed: true,
    epingle: true,
    at: "2026-09-30T10:15:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0012", signatureId: "SIG-0012", docId: DOC[12], deposeLe: "2026-09-30T09:52:00" },
    annexesRefs: [{ ref: "acte-demo-419", designation: "Délibération" }],
    values: {
      numero: "2026-418-VSL",
      objet: "adoption du règlement de la restauration scolaire",
      dateSignature: "2026-09-30",
      dateEffet: "2026-10-01",
      signataire: "p-faure",
    },
    execution: {
      transmission: { at: "2026-10-01", ref: "2026-10-DELIB-0242", mode: "ctes", recuLe: "2026-10-01T09:18:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-10-05", ref: "RAA n° 2026-21 du 5 octobre 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    // L'ANNEXE : le règlement lui-même. Pas de numéro, pas de signature — son
    // identité est la délibération qui l'adopte, sa date est la sienne, et son
    // texte suit l'original signé de la délibération.
    id: "acte-demo-419",
    trameId: "tpl-reglement-cantine",
    at: "2026-09-30T10:40:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    adoptionRef: { ref: "acte-demo-418", designation: "Délibération" },
    values: {
      objet: "règlement de la restauration scolaire",
      dateSignature: "2026-09-30",
      dateEffet: "2026-10-01",
    },
  },
  {
    id: "acte-demo-420",
    trameId: "tpl-police",
    signed: true,
    at: "2026-08-28T09:30:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0013", signatureId: "SIG-0013", docId: DOC[13], deposeLe: "2026-08-28T09:05:00" },
    values: {
      numero: "2026-420-VSL",
      objet: "réglementation de la circulation et du stationnement aux abords des groupes scolaires",
      dateSignature: "2026-08-28",
      dateEffet: "2026-09-01",
      signataire: "p-faure",
      motif: "securite",
      voie: "aux abords des groupes scolaires Jean-Moulin et Jules-Ferry, aux heures d'entrée et de sortie des classes",
      dateDebut: "2026-09-01",
      dateFin: "",
      mesures: "La circulation des véhicules à moteur est interdite sur les voies desservant les entrées des groupes scolaires quinze minutes avant et quinze minutes après les heures d'entrée et de sortie des classes ; la vitesse y est limitée à 20 km/h ; des cheminements piétons protégés sont matérialisés et réservés aux enfants et à leurs accompagnants.",
      derogations: "Les véhicules de secours, de police et de service, ainsi que les riverains munis d'une autorisation délivrée par la mairie, demeurent autorisés à circuler à l'allure du pas.",
    },
    execution: {
      transmission: { at: "2026-09-01", ref: "2026-09-POL-0088", mode: "ctes", recuLe: "2026-09-01T08:47:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-09-04", ref: "RAA n° 2026-18 du 4 septembre 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-421",
    trameId: "tpl-nomination",
    signed: true,
    at: "2026-09-02T11:20:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0014", signatureId: "SIG-0014", docId: DOC[14], deposeLe: "2026-09-02T10:58:00" },
    values: {
      numero: "2026-421-VSL",
      objet: "nomination de Madame Léa PAGES en qualité d'animatrice périscolaire",
      dateSignature: "2026-09-02",
      dateEffet: "2026-09-15",
      signataire: "p-morel",
      beneficiaire: "p-pages",
      fonction: "animatrice périscolaire",
      service: "Accueils périscolaires",
    },
    execution: {
      transmission: { at: "2026-09-04", ref: "2026-09-NOM-0214", mode: "ctes", recuLe: "2026-09-04T11:12:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-422",
    trameId: "tpl-decision-achat",
    signed: true,
    at: "2026-09-09T14:40:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0015", signatureId: "SIG-0015", docId: DOC[15], deposeLe: "2026-09-09T14:16:00" },
    values: {
      numero: "2026-422-VSL",
      objet: "engagement de la dépense de fourniture des repas de la restauration scolaire",
      dateSignature: "2026-09-09",
      dateEffet: "",
      signataire: "p-vidal",
      fournisseur: "la société Cuisines du Val de Loire",
      objetAchat: "la fourniture et la livraison des repas de la restauration scolaire pour le premier trimestre de l'année scolaire 2026-2027",
      montant: 38400,
      imputation: "60623 — alimentation",
      procedure: "mapa",
    },
    execution: {
      transmission: { at: "2026-09-11", ref: "2026-09-FIN-0326", mode: "ctes", recuLe: "2026-09-11T10:05:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-423",
    trameId: "tpl-subvention",
    entity: "cde",
    signed: true,
    at: "2026-09-16T10:05:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0016", signatureId: "SIG-0016", docId: DOC[16], deposeLe: "2026-09-16T09:41:00" },
    overrides: {
      "body.9.blocks.0": "La présidente de la Caisse des écoles de Valmont-sur-Loire est chargée de l'exécution du présent arrêté.",
    },
    values: {
      numero: "2026-423-CDE",
      objet: "attribution d'une subvention de fonctionnement à l'association des parents d'élèves des écoles publiques",
      dateSignature: "2026-09-16",
      dateEffet: "",
      signataire: "p-lefevre",
      association: "l'Association des parents d'élèves des écoles publiques de Valmont-sur-Loire",
      objetSubvention: "des actions d'accompagnement des sorties scolaires et des ateliers de soutien à la lecture",
      montant: 1400,
      imputation: "6574 — subventions de fonctionnement (budget de la Caisse des écoles)",
    },
    execution: {
      transmission: { at: "2026-09-18", ref: "2026-09-CDE-0011", mode: "ctes", recuLe: "2026-09-18T09:22:00", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-424",
    trameId: "tpl-evenement",
    signed: true,
    epingle: true,
    at: "2026-09-22T09:50:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0017", signatureId: "SIG-0017", docId: DOC[17], deposeLe: "2026-09-22T09:26:00" },
    annexesRefs: [
      { ref: "acte-demo-425", designation: "Arrêté" },
      { ref: "acte-demo-426", designation: "Arrêté" },
    ],
    values: {
      numero: "2026-424-VSL",
      objet: "organisation de la fête du village « Valmont en fête »",
      dateSignature: "2026-09-22",
      dateEffet: "",
      signataire: "p-masson",
      nomEvenement: "la fête du village « Valmont en fête »",
      organisateur: "le comité des fêtes de Valmont-sur-Loire",
      dateDebut: "2026-10-03",
      dateFin: "2026-10-04",
      lieu: "sur la place du Marché et dans le parc du Château",
      emprise: "la place du Marché, la rue du Pont et la partie nord du parc du Château sont occupées du vendredi 2 octobre à 14 heures au lundi 5 octobre à 12 heures, pour l'installation des stands, des deux scènes et de la buvette.",
      mesures: ["circulation", "stationnement", "sonorisation", "buvette", "secours", "pyrotechnie"],
      securite: "Le comité met en place une équipe de six secouristes bénévoles, un poste de secours sur la place du Marché et une zone de sécurité de soixante mètres autour du point de tir du feu d'artifice, interdite au public une heure avant le spectacle.",
      obligations: "Le comité désigne un responsable de la sécurité, présent sur le site pendant toute la durée de la manifestation, et communique à la police municipale la liste des bénévoles chargés du service d'ordre.",
    },
    execution: {
      transmission: { at: "2026-09-24", ref: "2026-09-MAN-0074", mode: "ctes", recuLe: "2026-09-24T09:31:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-09-28", ref: "RAA n° 2026-23 du 28 septembre 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-425",
    trameId: "tpl-annexe-joint",
    at: "2026-09-22T10:10:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    adoptionRef: { ref: "acte-demo-424", designation: "Arrêté" },
    values: {
      objet: "plan de circulation et de stationnement de la fête du village",
      dateSignature: "2026-09-22",
      dateEffet: "",
      intitule: "Plan de circulation et de stationnement — fête du village 2026",
      chapeau: "Le présent plan est annexé à l'arrêté du 22 septembre 2026 portant organisation de la fête du village. Il décrit les déviations et les stationnements mis en place du 2 au 5 octobre 2026.",
      partie1: "La rue du Pont est fermée à la circulation du vendredi 2 octobre à 14 heures au lundi 5 octobre à 12 heures, entre la place du Marché et le pont sur la Loire. La circulation est déviée, dans les deux sens, par la rue des Tilleuls puis l'avenue du Général-Leclerc.",
      partie2: "Le stationnement est interdit sur la place du Marché, la rue du Pont et la partie nord du parc du Château. Les visiteurs sont dirigés vers le parking du gymnase (250 places) et celui de la gare (120 places), signalés depuis la rocade par un fléchage temporaire.",
      partie3: "Les services techniques installent la signalisation le vendredi matin et la retirent le lundi après-midi. Les riverains de la rue du Pont conservent l'accès à pied et reçoivent un badge d'accès véhicule pour les livraisons et les secours.",
    },
  },
  {
    id: "acte-demo-426",
    trameId: "tpl-annexe-joint",
    at: "2026-09-22T10:25:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    adoptionRef: { ref: "acte-demo-424", designation: "Arrêté" },
    values: {
      objet: "programme de la fête du village",
      dateSignature: "2026-09-22",
      dateEffet: "",
      intitule: "Programme de la fête du village — 3 et 4 octobre 2026",
      chapeau: "Le présent programme est annexé à l'arrêté du 22 septembre 2026 portant organisation de la fête du village. Il est affiché sur les panneaux d'information municipale et distribué dans les écoles de la commune.",
      partie1: "Samedi 3 octobre. — 10 heures : ouverture du marché de producteurs, place du Marché. 11 h 30 : inauguration de la fête par le maire, au kiosque. 14 heures : concours de pétanque et jeux pour les enfants, parc du Château. 18 h 30 : apéritif offert par la municipalité, place du Marché. 21 heures : bal populaire animé par l'orchestre Les Baladins, sous la halle.",
      partie2: "Dimanche 4 octobre. — 9 heures : vide-greniers, rue du Pont et place du Marché. 11 heures : messe en plein air, puis cérémonie au monument aux morts. 15 heures : défilé des associations et spectacle des enfants de l'accueil de loisirs, parc du Château. 22 heures : feu d'artifice tiré depuis les bords de Loire, quai des Pêcheurs.",
      partie3: "Le comité des fêtes accueille les exposants et les associations sur place le vendredi 2 octobre de 14 heures à 19 heures. Renseignements à la mairie, service des fêtes, du lundi au vendredi de 9 heures à 12 heures.",
    },
  },
  {
    id: "acte-demo-427",
    trameId: "tpl-evenement",
    signed: true,
    // Épinglé : la démonstration met en avant les événements à venir — la fête
    // du village, le marché de Noël — et les annexes qu'ils portent. C'est
    // l'usage de la bande « À la une » : le document qu'un visiteur vient
    // chercher (voir src/ui/views/recueil-public.js).
    epingle: true,
    at: "2026-10-06T15:20:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0018", signatureId: "SIG-0018", docId: DOC[18], deposeLe: "2026-10-06T14:54:00" },
    values: {
      numero: "2026-427-VSL",
      objet: "organisation du marché de Noël",
      dateSignature: "2026-10-06",
      dateEffet: "",
      signataire: "p-masson",
      nomEvenement: "le marché de Noël",
      organisateur: "le comité des fêtes de Valmont-sur-Loire, avec le concours de l'association Valmont Randonnée",
      dateDebut: "2026-12-12",
      dateFin: "2026-12-13",
      lieu: "sur la place du Marché et sous la halle",
      emprise: "la place du Marché et la halle sont occupées du vendredi 11 décembre à 8 heures au lundi 14 décembre à 12 heures, pour l'installation des chalets et des illuminations.",
      mesures: ["circulation", "stationnement", "sonorisation", "buvette", "secours"],
      securite: "",
      obligations: "Les illuminations sont installées par les services techniques de la commune, sous la responsabilité du comité pour leur usage. Le comité s'assure de la présence d'un point de secours pendant les heures d'ouverture, de 14 heures à 20 heures.",
    },
    execution: {
      transmission: { at: "2026-10-08", ref: "2026-10-MAN-0091", mode: "ctes", recuLe: "2026-10-08T10:12:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-10-12", ref: "RAA n° 2026-24 du 12 octobre 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-428",
    trameId: "tpl-convention",
    signed: true,
    at: "2026-09-08T11:15:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0019", signatureId: "SIG-0019", docId: DOC[19], deposeLe: "2026-09-08T10:47:00" },
    values: {
      numero: "2026-428-VSL",
      objet: "convention de jumelage avec la commune de Saint-Aubin-sur-Rive",
      dateSignature: "2026-09-08",
      dateEffet: "",
      signataire: "p-faure",
      partenaire: "la commune de Saint-Aubin-sur-Rive",
      objetConvention: "le jumelage des communes de Valmont-sur-Loire et de Saint-Aubin-sur-Rive, et le développement d'échanges entre leurs habitants",
      domaines: ["echanges-scolaires", "manifestations-culturelles", "vie-associative", "patrimoine"],
      duree: "cinq ans à compter de sa signature",
      contribution: 8000,
      renouvellement: "tacite",
    },
    execution: {
      transmission: { at: "2026-09-10", ref: "2026-09-CONV-0022", mode: "ctes", recuLe: "2026-09-10T09:58:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-09-14", ref: "RAA n° 2026-21 du 14 septembre 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-429",
    trameId: "tpl-police",
    signed: true,
    at: "2026-11-25T10:40:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0020", signatureId: "SIG-0020", docId: DOC[20], deposeLe: "2026-11-25T10:11:00" },
    values: {
      numero: "2026-429-VSL",
      objet: "réglementation de l'usage des artifices de divertissement pendant les fêtes de fin d'année",
      dateSignature: "2026-11-25",
      dateEffet: "2026-12-15",
      signataire: "p-faure",
      motif: "securite",
      voie: "sur l'ensemble du territoire communal",
      dateDebut: "2026-12-15",
      dateFin: "2027-01-02",
      mesures: "La vente et l'usage des artifices de divertissement et des articles pyrotechniques sont interdits sur la voie publique, à l'exception du spectacle tiré par un artificier professionnel lors des festivités autorisées par la municipalité. Le port et le transport de ces articles, hors du cadre d'un spectacle autorisé, sont également interdits.",
      derogations: "Les professionnels titulaires d'une autorisation préfectorale de stockage et de vente demeurent autorisés à exercer leur activité dans leurs établissements, dans les conditions réglementaires.",
    },
    execution: {
      transmission: { at: "2026-11-27", ref: "2026-11-POL-0311", mode: "ctes", recuLe: "2026-11-27T11:02:00", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-430",
    trameId: "tpl-deliberation",
    signed: true,
    at: "2026-11-18T18:30:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0021", signatureId: "SIG-0021", docId: DOC[21], deposeLe: "2026-11-18T18:02:00" },
    overrides: {
      "body.5.blocks.0": "Le conseil municipal approuve le programme des festivités de l'année 2027, tel qu'il lui a été présenté par l'adjointe à la vie associative, et autorise le maire à engager les dépenses correspondantes dans la limite des crédits inscrits au budget.",
    },
    values: {
      numero: "2026-430-VSL",
      objet: "approbation du programme des festivités de l'année 2027",
      dateSignature: "2026-11-18",
      dateEffet: "",
      signataire: "p-faure",
    },
    execution: {
      transmission: { at: "2026-11-20", ref: "2026-11-DELIB-0298", mode: "ctes", recuLe: "2026-11-20T09:27:00", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-431",
    trameId: "tpl-subvention",
    signed: true,
    at: "2026-03-18T09:35:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0022", signatureId: "SIG-0022", docId: DOC[22], deposeLe: "2026-03-18T09:08:00" },
    values: {
      numero: "2026-431-VSL",
      objet: "attribution d'une subvention de fonctionnement au comité des fêtes de Valmont-sur-Loire",
      dateSignature: "2026-03-18",
      dateEffet: "",
      signataire: "p-faure",
      association: "le comité des fêtes de Valmont-sur-Loire",
      objetSubvention: "l'organisation de la fête du village et du marché de Noël",
      montant: 4500,
      imputation: "6574 — subventions de fonctionnement aux associations",
    },
    execution: {
      transmission: { at: "2026-03-20", ref: "2026-03-SUB-0163", mode: "ctes", recuLe: "2026-03-20T10:44:00", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-432",
    trameId: "tpl-concession",
    signed: true,
    at: "2026-09-11T11:05:00",
    createdBy: "u-roussel", createdByName: "Amandine ROUSSEL",
    api: { acteId: "ACT-0023", signatureId: "SIG-0023", docId: DOC[23], deposeLe: "2026-09-11T10:32:00" },
    values: {
      numero: "2026-432-VSL",
      objet: "délivrance d'une concession funéraire à Madame Sylvie BERTIN",
      dateSignature: "2026-09-11",
      dateEffet: "",
      signataire: "p-faure",
      concessionnaire: "p-bertin",
      emplacement: "carré C, rangée 4, case 12",
      typeConcession: "caveau",
      dureeConcession: "quinze-ans",
      montant: 420,
    },
    execution: {
      transmission: { at: "2026-09-15", ref: "2026-09-ETC-0047", mode: "ctes", recuLe: "2026-09-15T09:12:00", byName: "Amandine ROUSSEL" },
    },
  },

  // ==========================================================================
  // LES ACTES DE GESTION COURANTE — finances, marchés, ressources humaines.
  // Ce sont les actes les plus nombreux d'une collectivité : dépenses engagées,
  // avenants, nominations, délégations. La démonstration en donne le volume.
  // ==========================================================================
  {
    id: "acte-demo-433",
    trameId: "tpl-avenant",
    signed: true,
    at: "2026-10-02T11:40:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0024", signatureId: "SIG-0024", docId: DOC[24], deposeLe: "2026-10-02T11:14:00" },
    values: {
      numero: "2026-433-VSL",
      objet: "avenant au marché de réfection de la voirie communale",
      dateSignature: "2026-10-02",
      dateEffet: "",
      signataire: "p-vidal",
      marche: "ref-marche-voirie",
      titulaire: "l'entreprise Routière du Centre",
      objetAvenant: "la prolongation du délai d'exécution des travaux de la rue de la Fontaine, en raison des intempéries du mois de septembre",
      natureAvenant: "prolongation",
      montantAvenant: 0,
      nouveauMontant: 286400,
      prolongation: "quarante-cinq jours à compter de la date d'achèvement contractuelle",
    },
    execution: {
      transmission: { at: "2026-10-05", ref: "2026-10-MAR-0219", mode: "ctes", recuLe: "2026-10-05T10:31:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-434",
    trameId: "tpl-decision-achat",
    signed: true,
    at: "2026-10-07T16:10:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0025", signatureId: "SIG-0025", docId: DOC[25], deposeLe: "2026-10-07T15:42:00" },
    values: {
      numero: "2026-434-VSL",
      objet: "engagement de la dépense de renouvellement des licences des applications métier",
      dateSignature: "2026-10-07",
      dateEffet: "",
      signataire: "p-mercier",
      fournisseur: "la société Val de Loire Informatique",
      objetAchat: "le renouvellement annuel des licences des applications métier et des sauvegardes de la direction des systèmes d'information",
      montant: 12400,
      imputation: "6156 — maintenance et logiciels",
      procedure: "bon-de-commande",
    },
    execution: {
      transmission: { at: "2026-10-09", ref: "2026-10-DSI-0141", mode: "ctes", recuLe: "2026-10-09T09:47:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-435",
    trameId: "tpl-decision-achat",
    signed: true,
    at: "2026-09-25T09:55:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0026", signatureId: "SIG-0026", docId: DOC[26], deposeLe: "2026-09-25T09:21:00" },
    values: {
      numero: "2026-435-VSL",
      objet: "engagement de la dépense de fournitures scolaires des écoles publiques",
      dateSignature: "2026-09-25",
      dateEffet: "",
      signataire: "p-vidal",
      fournisseur: "la librairie-papeterie Le Comptoir des Écoles",
      objetAchat: "la fourniture des papiers, crayons et petits matériels des classes des trois écoles publiques de la commune",
      montant: 3480,
      imputation: "60632 — fournitures scolaires",
      procedure: "achat-direct",
    },
    execution: {
      transmission: { at: "2026-09-28", ref: "2026-09-FIN-0341", mode: "ctes", recuLe: "2026-09-28T10:19:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-436",
    trameId: "tpl-decision-achat",
    signed: true,
    at: "2026-10-13T14:25:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0027", signatureId: "SIG-0027", docId: DOC[27], deposeLe: "2026-10-13T13:58:00" },
    values: {
      numero: "2026-436-VSL",
      objet: "engagement de la dépense d'entretien des espaces verts communaux",
      dateSignature: "2026-10-13",
      dateEffet: "",
      signataire: "p-rolland",
      fournisseur: "les Pépinières du Val",
      objetAchat: "la fourniture et la plantation des arbres et arbustes prévus au programme de renouvellement des espaces verts du parc du Château",
      montant: 9600,
      imputation: "61523 — entretien des espaces verts",
      procedure: "bon-de-commande",
    },
    execution: {
      transmission: { at: "2026-10-15", ref: "2026-10-ENV-0062", mode: "ctes", recuLe: "2026-10-15T09:36:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-437",
    trameId: "tpl-nomination",
    signed: true,
    at: "2026-09-03T10:20:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0028", signatureId: "SIG-0028", docId: DOC[28], deposeLe: "2026-09-03T09:54:00" },
    values: {
      numero: "2026-437-VSL",
      objet: "nomination de Madame Chloé FONTAINE en qualité d'agent de restauration",
      dateSignature: "2026-09-03",
      dateEffet: "2026-09-15",
      signataire: "p-mercier",
      beneficiaire: "p-fontaine",
      fonction: "agent de restauration",
      service: "Restauration scolaire",
    },
    execution: {
      transmission: { at: "2026-09-07", ref: "2026-09-NOM-0216", mode: "ctes", recuLe: "2026-09-07T10:41:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-438",
    trameId: "tpl-nomination",
    signed: true,
    at: "2026-10-09T11:50:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0029", signatureId: "SIG-0029", docId: DOC[29], deposeLe: "2026-10-09T11:22:00" },
    values: {
      numero: "2026-438-VSL",
      objet: "nomination de Monsieur Franck MICHEL en qualité de responsable du service technique",
      dateSignature: "2026-10-09",
      dateEffet: "2026-11-01",
      signataire: "p-mercier",
      beneficiaire: "p-michel",
      fonction: "responsable du service technique",
      service: "Cadre de vie et environnement",
    },
    execution: {
      transmission: { at: "2026-10-12", ref: "2026-10-NOM-0247", mode: "ctes", recuLe: "2026-10-12T09:29:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-439",
    trameId: "tpl-delegation",
    signed: true,
    at: "2026-09-29T15:35:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0030", signatureId: "SIG-0030", docId: DOC[30], deposeLe: "2026-09-29T15:06:00" },
    values: {
      numero: "2026-439-VSL",
      objet: "délégation de signature à Madame Nathalie PETIT, directrice de l'éducation",
      dateSignature: "2026-09-29",
      dateEffet: "2026-10-01",
      signataire: "p-faure",
      delegataire: "p-petit",
      fonctionDelegataire: "directrice de l'éducation, enfance et jeunesse",
      perimetres: ["scolarite"],
      typeActe: "delegation",
    },
    execution: {
      transmission: { at: "2026-10-01", ref: "2026-10-DELEG-0261", mode: "ctes", recuLe: "2026-10-01T10:14:00", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-440",
    trameId: "tpl-revalorisation",
    signed: true,
    at: "2026-10-14T09:15:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0031", signatureId: "SIG-0031", docId: DOC[31], deposeLe: "2026-10-14T08:52:00" },
    values: {
      numero: "2026-440-VSL",
      objet: "revalorisation du régime indemnitaire de Madame Chloé FONTAINE, agent de restauration",
      dateSignature: "2026-10-14",
      dateEffet: "2026-11-01",
      signataire: "p-faure",
      beneficiaire: "p-fontaine",
      corps: "adjoint technique principal de 2e classe",
      partVariable: 950,
      motif: "prise en compte des fonctions d'encadrement de la cuisine de production",
    },
    execution: {
      transmission: { at: "2026-10-14", ref: "2026-10-RH-0187", mode: "ctes", recuLe: "2026-10-14T15:22:00", byName: "Julien MERCIER" },
    },
  },

  // ==========================================================================
  // L'URBANISME ET LE DOMAINE PUBLIC. Deux actes portent des ÉCARTS (`overrides`) :
  // le rédacteur y a réécrit un paragraphe de la trame — un permis de construire
  // devient une déclaration préalable. L'application garde la trace de l'écart.
  // ==========================================================================
  {
    id: "acte-demo-441",
    trameId: "tpl-permis-construire",
    signed: true,
    at: "2026-10-01T10:50:00",
    createdBy: "u-benali", createdByName: "Karim BENALI",
    api: { acteId: "ACT-0032", signatureId: "SIG-0032", docId: DOC[32], deposeLe: "2026-10-01T10:24:00" },
    values: {
      numero: "2026-441-VSL",
      objet: "permis de construire une maison individuelle et son garage",
      dateSignature: "2026-10-01",
      dateEffet: "",
      signataire: "p-benali",
      demandeur: "p-chauvet",
      adresseTerrain: "24 route de la Vallée",
      parcelle: "section AB n° 318",
      natureTravaux: "la construction d'une maison individuelle de 118 m² de surface de plancher, avec un garage accolé de 26 m²",
      surfacePlancher: 144,
      prescriptions: "Les eaux pluviales seront infiltrées sur la parcelle. L'accès se fera par la route de la Vallée, après aménagement d'un garage désenclavé conforme au plan joint au dossier.",
    },
    execution: {
      transmission: { at: "2026-10-02", ref: "2026-10-URB-0358", mode: "ctes", recuLe: "2026-10-02T09:48:00", byName: "Karim BENALI" },
    },
  },
  {
    id: "acte-demo-442",
    trameId: "tpl-permis-construire",
    signed: true,
    at: "2026-10-05T14:10:00",
    createdBy: "u-benali", createdByName: "Karim BENALI",
    api: { acteId: "ACT-0033", signatureId: "SIG-0033", docId: DOC[33], deposeLe: "2026-10-05T13:44:00" },
    overrides: {
      "body.5.blocks.0": "La déclaration préalable est accordée à {{demandeur.civility}} {{demandeur.firstName}} {{demandeur.lastName}} pour {{natureTravaux}} sur un terrain situé {{adresseTerrain}}, cadastré {{parcelle}}.",
      "body.4.text": "Arrêté n°{{numero}} du {{dateSignature|date-long}} portant non-opposition à une déclaration préalable",
    },
    values: {
      numero: "2026-442-VSL",
      objet: "non-opposition à une déclaration préalable portant sur la pose d'une clôture et d'un portail",
      dateSignature: "2026-10-05",
      dateEffet: "",
      signataire: "p-benali",
      demandeur: "p-bertin",
      adresseTerrain: "9 impasse des Vergers",
      parcelle: "section AC n° 512",
      natureTravaux: "la pose d'une clôture périphérique et d'un portail le long de l'impasse des Vergers",
      surfacePlancher: "",
      prescriptions: "La hauteur de la clôture n'excédera pas 1,80 mètre. Le portail sera équipé d'un dispositif d'ouverture vers l'intérieur de la propriété.",
    },
    execution: {
      transmission: { at: "2026-10-06", ref: "2026-10-URB-0361", mode: "ctes", recuLe: "2026-10-06T10:07:00", byName: "Karim BENALI" },
    },
  },
  {
    id: "acte-demo-443",
    trameId: "tpl-permis-construire",
    signed: true,
    at: "2026-10-16T09:30:00",
    createdBy: "u-benali", createdByName: "Karim BENALI",
    api: { acteId: "ACT-0034", signatureId: "SIG-0034", docId: DOC[34], deposeLe: "2026-10-16T09:02:00" },
    overrides: {
      "body.5.blocks.0": "L'autorisation de construire une enseigne est accordée à {{demandeur.civility}} {{demandeur.firstName}} {{demandeur.lastName}} pour {{natureTravaux}} sur un terrain situé {{adresseTerrain}}, cadastré {{parcelle}}.",
      "body.4.text": "Arrêté n°{{numero}} du {{dateSignature|date-long}} portant autorisation d'une enseigne commerciale",
    },
    values: {
      numero: "2026-443-VSL",
      objet: "autorisation d'installation d'une enseigne commerciale",
      dateSignature: "2026-10-16",
      dateEffet: "",
      signataire: "p-benali",
      demandeur: "p-michel",
      adresseTerrain: "3 place du Marché",
      parcelle: "section AA n° 87",
      natureTravaux: "l'installation d'une enseigne lumineuse de 2,40 m² en façade du commerce",
      surfacePlancher: "",
      prescriptions: "L'enseigne sera éteinte entre 22 heures et 7 heures. Sa fixation respectera les prescriptions de l'avis de l'architecte des bâtiments de France.",
    },
    execution: {
      transmission: { at: "2026-10-19", ref: "2026-10-URB-0367", mode: "ctes", recuLe: "2026-10-19T11:23:00", byName: "Karim BENALI" },
    },
  },
  {
    id: "acte-demo-444",
    trameId: "tpl-occupation",
    signed: true,
    at: "2026-09-21T11:25:00",
    createdBy: "u-benali", createdByName: "Karim BENALI",
    api: { acteId: "ACT-0035", signatureId: "SIG-0035", docId: DOC[35], deposeLe: "2026-09-21T10:58:00" },
    values: {
      numero: "2026-444-VSL",
      objet: "autorisation d'occupation du domaine public pour une terrasse",
      dateSignature: "2026-09-21",
      dateEffet: "",
      signataire: "p-faure",
      beneficiaire: "la SARL Le Comptoir du Pont",
      natureOccupation: "terrasse",
      emplacement: "sur la place du Marché, devant le n° 3",
      superficie: 24,
      dateDebut: "2026-10-01",
      dateFin: "2027-09-30",
      redevance: 480,
      conditions: "La terrasse est close par des bacs plantés de 60 centimètres de hauteur au plus. Le mobilier est démonté chaque soir à la fermeture de l'établissement.",
    },
    execution: {
      transmission: { at: "2026-09-23", ref: "2026-09-DOM-0129", mode: "ctes", recuLe: "2026-09-23T09:54:00", byName: "Karim BENALI" },
    },
  },
  {
    id: "acte-demo-445",
    trameId: "tpl-occupation",
    at: "2026-10-15T16:45:00",
    createdBy: "u-benali", createdByName: "Karim BENALI",
    values: {
      numero: "2026-445-VSL",
      objet: "autorisation d'occupation du domaine public pour l'emprise d'un chantier",
      dateSignature: "2026-10-15",
      dateEffet: "",
      signataire: "p-faure",
      beneficiaire: "l'entreprise Routière du Centre",
      natureOccupation: "chantier",
      emplacement: "sur la rue de la Fontaine, entre les n° 4 et 22",
      superficie: 180,
      dateDebut: "2026-11-02",
      dateFin: "2026-12-18",
      redevance: "",
      conditions: "",
    },
    // En attente du visa de la direction générale : le bon pour accord du chef de
    // bureau Urbanisme est donné, l'étape suivante attend.
    parapheur: [{ comment: "Emprise conforme au plan de circulation transmis par l'entreprise." }, null],
    revisions: 2,
  },
  {
    id: "acte-demo-446",
    trameId: "tpl-occupation",
    at: "2026-10-14T09:05:00",
    createdBy: "u-benali", createdByName: "Karim BENALI",
    values: {
      numero: "2026-446-VSL",
      objet: "autorisation d'occupation du domaine public pour un étalage",
      dateSignature: "2026-10-14",
      dateEffet: "",
      signataire: "p-faure",
      beneficiaire: "la boulangerie Aux Trois Épis",
      natureOccupation: "etalage",
      emplacement: "sur la place du Marché, devant le n° 8",
      superficie: 6,
      dateDebut: "2026-11-03",
      dateFin: "2027-11-02",
      redevance: 145,
      conditions: "",
    },
    // Renvoyé au rédacteur par le réviseur : il manque la pièce d'assurance et
    // l'emplacement empiète sur le passage protégé. L'acte est revenu en
    // brouillon, avec le motif — c'est ce que lit son rédacteur.
    parapheur: [{}, {}],
    revision: {
      statut: "rejete", par: "u-daval", parName: "Isabelle DAVAL",
      motif: "L'attestation d'assurance de l'occupant ne figure pas au dossier, et l'emplacement décrit empiète sur le passage protégé de la poste. Réduire la superficie à 4 m² et joindre la pièce avant nouvel envoi.",
    },
    revisions: 3,
  },

  // ==========================================================================
  // L'ENVIRONNEMENT ET LA POLICE. Les arrêtés de police sont pris par le maire :
  // la trame impose sa fonction, et le rédacteur ne choisit que la personne.
  // ==========================================================================
  {
    id: "acte-demo-447",
    trameId: "tpl-environnement",
    signed: true,
    at: "2026-06-12T09:45:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0036", signatureId: "SIG-0036", docId: DOC[36], deposeLe: "2026-06-12T09:18:00" },
    values: {
      numero: "2026-447-VSL",
      objet: "interdiction du brûlage des déchets verts à l'air libre",
      dateSignature: "2026-06-12",
      dateEffet: "2026-06-15",
      signataire: "p-faure",
      motif: "nuisances",
      voie: "sur l'ensemble du territoire communal",
      dateDebut: "2026-06-15",
      dateFin: "",
      mesures: "Le brûlage à l'air libre des déchets verts, des feuilles et des résidus de jardinage est interdit sur l'ensemble du territoire communal. Les déchets verts sont déposés à la déchèterie intercommunale ou collectés en porte-à-porte aux jours fixés par le calendrier de collecte.",
      derogations: "L'écobuage et le brûlage des déchets agricoles demeurent régis par la réglementation qui leur est propre, sous réserve de l'accord du maire.",
    },
    execution: {
      transmission: { at: "2026-06-15", ref: "2026-06-POL-0158", mode: "ctes", recuLe: "2026-06-15T10:02:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-06-18", ref: "RAA n° 2026-13 du 18 juin 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-448",
    trameId: "tpl-environnement",
    signed: true,
    at: "2026-07-20T17:30:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0037", signatureId: "SIG-0037", docId: DOC[37], deposeLe: "2026-07-20T17:04:00" },
    values: {
      numero: "2026-448-VSL",
      objet: "limitation des prélèvements d'eau potable en période de sécheresse",
      dateSignature: "2026-07-20",
      dateEffet: "2026-07-22",
      signataire: "p-faure",
      motif: "eau",
      voie: "sur l'ensemble du territoire communal",
      dateDebut: "2026-07-22",
      dateFin: "2026-09-30",
      mesures: "En période d'alerte sécheresse, l'arrosage des pelouses, le lavage des véhicules hors station professionnelle et le remplissage des piscines privées de plus d'un mètre cube sont interdits entre 8 heures et 20 heures. Le nettoyage des voies et des trottoirs à l'eau potable est proscrit.",
      derogations: "Les prélèvements nécessaires à l'abreuvement des animaux, à la sécurité civile et au maintien de la salubrité publique demeurent autorisés.",
    },
    execution: {
      transmission: { at: "2026-07-22", ref: "2026-07-POL-0201", mode: "ctes", recuLe: "2026-07-22T09:41:00", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-449",
    trameId: "tpl-environnement",
    at: "2026-10-12T10:35:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    values: {
      numero: "2026-449-VSL",
      objet: "réglementation de la présentation des déchets ménagers à la collecte",
      dateSignature: "2026-10-12",
      dateEffet: "2026-11-01",
      signataire: "p-faure",
      motif: "dechets",
      voie: "sur l'ensemble du territoire communal",
      dateDebut: "2026-11-01",
      dateFin: "",
      mesures: "Les bacs de déchets ménagers sont présentés sur la voie publique la veille de la collecte, à partir de 19 heures, et retirés le jour même, avant 20 heures. Le dépôt sauvage de déchets au pied des conteneurs est interdit.",
      derogations: "",
    },
    // Soumis au parapheur, aucune étape encore franchie : c'est le cas que
    // l'écran « Parapheur » met en tête de sa file.
    parapheur: [null, null],
    revisions: 2,
  },
  {
    id: "acte-demo-450",
    trameId: "tpl-police",
    signed: true,
    at: "2026-09-24T08:50:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0038", signatureId: "SIG-0038", docId: DOC[38], deposeLe: "2026-09-24T08:26:00" },
    values: {
      numero: "2026-450-VSL",
      objet: "réglementation temporaire de la circulation pour la réfection de la rue de la Fontaine",
      dateSignature: "2026-09-24",
      dateEffet: "2026-11-02",
      signataire: "p-faure",
      motif: "travaux",
      voie: "rue de la Fontaine, entre la place du Marché et le carrefour des Quatre-Chemins",
      dateDebut: "2026-11-02",
      dateFin: "2027-02-15",
      mesures: "La circulation est interdite dans les deux sens pendant toute la durée des travaux de réfection de la chaussée et des réseaux. La circulation est déviée par la rue des Tilleuls et l'avenue du Général-Leclerc. Le stationnement est interdit sur le tronçon concerné, à l'exception des emplacements de livraison maintenus devant les commerces.",
      derogations: "Les véhicules de secours, de service et les riverains munis d'un badge délivré par l'entreprise chargée des travaux demeurent autorisés à accéder à leurs propriétés, à l'allure du pas, sur les portions non encore dépavées.",
    },
    execution: {
      transmission: { at: "2026-09-28", ref: "2026-09-POL-0226", mode: "ctes", recuLe: "2026-09-28T10:37:00", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-451",
    trameId: "tpl-police",
    at: "2026-10-13T15:10:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    values: {
      numero: "2026-451-VSL",
      objet: "interdiction temporaire de l'accès au parc du Château pendant l'élagage des grands arbres",
      dateSignature: "2026-10-13",
      dateEffet: "2026-10-26",
      signataire: "p-faure",
      motif: "securite",
      voie: "dans le parc du Château, allée centrale et pelouse nord",
      dateDebut: "2026-10-26",
      dateFin: "2026-10-30",
      mesures: "L'accès du public est interdit à l'allée centrale et à la pelouse nord du parc du Château pendant toute la durée de l'élagage des platanes réalisé par une entreprise spécialisée. Les accès concernés sont fermés et signalés.",
      derogations: "Les agents des services techniques et l'entreprise d'élagage sont autorisés à circuler dans le périmètre, qui est interdit au public.",
    },
    // Validé par le parapheur, puis ENVOYÉ AU RÉVISEUR : le contrôle du service
    // des affaires juridiques attend. C'est un des actes que l'écran « Révision »
    // met dans sa file.
    parapheur: [{}, {}],
    revision: "attente",
    revisions: 2,
  },
  {
    id: "acte-demo-452",
    trameId: "tpl-police",
    signed: true,
    at: "2026-05-11T10:15:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0039", signatureId: "SIG-0039", docId: DOC[39], deposeLe: "2026-05-11T09:49:00" },
    values: {
      numero: "2026-452-VSL",
      objet: "institution d'une zone de stationnement à durée limitée sur la place du Marché",
      dateSignature: "2026-05-11",
      dateEffet: "2026-06-01",
      signataire: "p-faure",
      motif: "stationnement",
      voie: "sur la place du Marché et les rues adjacentes",
      dateDebut: "2026-06-01",
      dateFin: "",
      mesures: "Le stationnement sur la place du Marché et sur les rues adjacentes est limité à une durée de deux heures, de 9 heures à 19 heures, du lundi au samedi. Les emplacements sont matérialisés par un marquage bleu et la durée est contrôlée par les agents de la police municipale au moyen de disques ou d'horodateurs.",
      derogations: "Les emplacements réservés aux personnes titulaires de la carte mobilité inclusion, aux médecins en visite et aux livraisons ne sont pas soumis à la limitation de durée.",
    },
    execution: {
      transmission: { at: "2026-05-13", ref: "2026-05-POL-0121", mode: "ctes", recuLe: "2026-05-13T10:22:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-05-18", ref: "RAA n° 2026-11 du 18 mai 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },

  // ==========================================================================
  // LE CCAS ET LES RÉGIES — les deux autres organisations du registre, avec
  // leurs propres autorités. Un acte du CCAS ne se signe pas au nom de la
  // commune ; la qualification de l'autorité en découle.
  // ==========================================================================
  {
    id: "acte-demo-453",
    trameId: "tpl-subvention",
    entity: "ccas",
    signed: true,
    at: "2026-10-08T15:25:00",
    createdBy: "u-martin", createdByName: "Hélène MARTIN",
    api: { acteId: "ACT-0040", signatureId: "SIG-0040", docId: DOC[40], deposeLe: "2026-10-08T14:57:00" },
    values: {
      numero: "2026-453-CCAS",
      objet: "attribution d'une subvention exceptionnelle à l'association Valmont Solidarité",
      dateSignature: "2026-10-08",
      dateEffet: "",
      signataire: "p-martin",
      association: "l'association Valmont Solidarité",
      objetSubvention: "une action de distribution de colis alimentaires et d'accompagnement des personnes âgées isolées pendant l'hiver",
      montant: 2200,
      imputation: "6574 — subventions de fonctionnement (budget du CCAS)",
    },
    execution: {
      transmission: { at: "2026-10-12", ref: "2026-10-CCAS-0074", mode: "ctes", recuLe: "2026-10-12T09:41:00", byName: "Hélène MARTIN" },
    },
  },
  {
    id: "acte-demo-454",
    trameId: "tpl-regie-creation",
    signed: true,
    at: "2026-10-16T11:05:00",
    createdBy: "u-garnier", createdByName: "Thomas GARNIER",
    api: { acteId: "ACT-0041", signatureId: "SIG-0041", docId: DOC[41], deposeLe: "2026-10-16T10:38:00" },
    values: {
      numero: "2026-454-VSL",
      objet: "institution d'une régie de recettes pour la restauration scolaire",
      dateSignature: "2026-10-16",
      dateEffet: "2026-11-02",
      signataire: "p-faure",
      nomRegie: "Régie de recettes de la restauration scolaire",
      service: "Restauration scolaire",
      typeRegie: "recettes",
      regisseur: "p-garnier",
      dateDebut: "2026-11-02",
      moyensPaiement: ["cheque", "virement"],
      plafondCheque: 200,
      abroge: "",
    },
    execution: {
      transmission: { at: "2026-10-19", ref: "2026-10-REG-0148", mode: "ctes", recuLe: "2026-10-19T10:16:00", byName: "Thomas GARNIER" },
    },
  },
  {
    id: "acte-demo-455",
    trameId: "tpl-regie-creation",
    at: "2026-10-14T14:20:00",
    createdBy: "u-garnier", createdByName: "Thomas GARNIER",
    values: {
      numero: "2026-455-VSL",
      objet: "institution d'une régie de recettes pour les concessions du cimetière",
      dateSignature: "2026-10-14",
      dateEffet: "2026-11-02",
      signataire: "p-faure",
      nomRegie: "Régie de recettes des concessions funéraires",
      service: "Accueil de la mairie",
      typeRegie: "recettes",
      regisseur: "p-garnier",
      dateDebut: "2026-11-02",
      moyensPaiement: ["cheque", "virement", "carte"],
      plafondCheque: 1000,
      abroge: "2021-118-VSL",
    },
    // Le bon pour accord du chef de service est donné ; le visa de la direction
    // générale attend encore.
    parapheur: [{ comment: "Le plafond du chèque suit celui de la régie principale : cohérent." }, null],
    revisions: 3,
  },

  // ==========================================================================
  // LES SUBVENTIONS ET LA CHARTE — les derniers actes du jeu : le soutien à la
  // vie associative, et une seconde délibération qui adopte un document
  // (la charte), avec son annexe.
  // ==========================================================================
  {
    id: "acte-demo-456",
    trameId: "tpl-subvention",
    signed: true,
    at: "2026-04-14T10:30:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0042", signatureId: "SIG-0042", docId: DOC[42], deposeLe: "2026-04-14T10:04:00" },
    values: {
      numero: "2026-456-VSL",
      objet: "attribution d'une subvention de fonctionnement à l'Union sportive du Valmont",
      dateSignature: "2026-04-14",
      dateEffet: "",
      signataire: "p-faure",
      association: "l'Union sportive du Valmont",
      objetSubvention: "le fonctionnement des équipes de jeunes et l'organisation du tournoi de fin de saison",
      montant: 3200,
      imputation: "6574 — subventions de fonctionnement aux associations",
    },
    execution: {
      transmission: { at: "2026-04-16", ref: "2026-04-SUB-0187", mode: "ctes", recuLe: "2026-04-16T09:38:00", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-457",
    trameId: "tpl-subvention",
    signed: true,
    at: "2026-10-20T09:40:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0043", signatureId: "SIG-0043", docId: DOC[43], deposeLe: "2026-10-20T09:12:00" },
    values: {
      numero: "2026-457-VSL",
      objet: "attribution d'une subvention de fonctionnement à l'association Les Amis du Patrimoine",
      dateSignature: "2026-10-20",
      dateEffet: "",
      signataire: "p-mercier",
      association: "l'association Les Amis du Patrimoine",
      objetSubvention: "la restauration du lavoir communal et les visites guidées du bourg",
      montant: 2400,
      imputation: "6574 — subventions de fonctionnement aux associations",
    },
    execution: {
      transmission: { at: "2026-10-22", ref: "2026-10-SUB-0341", mode: "ctes", recuLe: "2026-10-22T10:05:00", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-458",
    trameId: "tpl-deliberation",
    signed: true,
    at: "2026-12-02T18:40:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0044", signatureId: "SIG-0044", docId: DOC[44], deposeLe: "2026-12-02T18:11:00" },
    annexesRefs: [{ ref: "acte-demo-459", designation: "Délibération" }],
    values: {
      numero: "2026-458-VSL",
      objet: "adoption de la charte de la participation citoyenne",
      dateSignature: "2026-12-02",
      dateEffet: "",
      signataire: "p-faure",
    },
    execution: {
      transmission: { at: "2026-12-04", ref: "2026-12-DELIB-0341", mode: "ctes", recuLe: "2026-12-04T09:44:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-12-08", ref: "RAA n° 2026-28 du 8 décembre 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-459",
    trameId: "tpl-annexe-joint",
    at: "2026-12-02T19:00:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    adoptionRef: { ref: "acte-demo-458", designation: "Délibération" },
    values: {
      objet: "charte de la participation citoyenne",
      dateSignature: "2026-12-02",
      dateEffet: "",
      intitule: "Charte de la participation citoyenne",
      chapeau: "La commune s'engage à associer les habitants aux décisions qui les concernent. La présente charte fixe les principes et les outils de cette participation.",
      partie1: "Les habitants sont informés des projets de la commune par le bulletin municipal, le site internet et les panneaux d'affichage. Les projets d'aménagement font l'objet d'une réunion publique avant leur approbation.",
      partie2: "Le conseil municipal reçoit chaque année les propositions des conseils de quartier et des associations. Un budget participatif annuel de 20 000 € est consacré aux projets proposés par les habitants et retenus par le vote de l'assemblée.",
      partie3: "Les pétitions signées par au moins deux cents habitants sont inscrites à l'ordre du jour de la séance suivante du conseil municipal. La charte est révisée tous les trois ans, après une concertation publique.",
    },
  },

  // ==========================================================================
  // LES ACCUEILS PÉRISCOLAIRES — l'organisation des temps d'accueil, prise
  // chaque année avant la rentrée. Deux arrêtés : l'année scolaire, puis les
  // vacances. C'est le thème « écoles et enfance » du recueil public.
  // ==========================================================================
  {
    id: "acte-demo-460",
    trameId: "tpl-periscolaire",
    signed: true,
    at: "2026-06-25T10:30:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0045", signatureId: "SIG-0045", docId: DOC[45], deposeLe: "2026-06-25T10:02:00" },
    values: {
      numero: "2026-460-VSL",
      objet: "organisation des accueils périscolaires pour l'année scolaire 2026-2027",
      dateSignature: "2026-06-25",
      dateEffet: "2026-09-01",
      signataire: "p-morel",
      anneeScolaire: "2026-2027",
      dateRentree: "2026-09-01",
      services: ["matin", "soir", "mercredi", "vacances"],
      lieuAccueil: "le groupe scolaire Jean-Moulin",
      encadrement: "L'accueil est encadré par des animateurs titulaires du brevet d'aptitude aux fonctions d'animateur, à raison d'un animateur pour douze enfants de moins de six ans et d'un animateur pour dix-huit enfants de six ans et plus. Un agent de la commune assure la coordination avec les directeurs des écoles.",
      horaires: "Le mercredi après-midi et pendant les vacances, l'accueil se tient au groupe scolaire Jean-Moulin, y compris pour les enfants des écoles Jules-Ferry et du Bourg, qui y sont conduits par un transport communal.",
    },
    execution: {
      transmission: { at: "2026-06-29", ref: "2026-06-EDU-0092", mode: "ctes", recuLe: "2026-06-29T09:37:00", byName: "Julien MERCIER" },
      publication: { at: "2026-07-02", ref: "RAA n° 2026-14 du 2 juillet 2026", mode: "recueil", byName: "Julien MERCIER" },
    },
  },
  {
    id: "acte-demo-461",
    trameId: "tpl-periscolaire",
    signed: true,
    at: "2026-10-09T09:20:00",
    createdBy: "u-mercier", createdByName: "Julien MERCIER",
    api: { acteId: "ACT-0046", signatureId: "SIG-0046", docId: DOC[46], deposeLe: "2026-10-09T08:56:00" },
    values: {
      numero: "2026-461-VSL",
      objet: "organisation de l'accueil de loisirs pendant les vacances de la Toussaint",
      dateSignature: "2026-10-09",
      dateEffet: "2026-10-19",
      signataire: "p-morel",
      anneeScolaire: "2026-2027",
      dateRentree: "2026-10-19",
      services: ["vacances", "matin"],
      lieuAccueil: "le centre de loisirs du parc du Château",
      encadrement: "L'accueil est assuré par l'équipe d'animation du centre de loisirs, renforcée par deux agents recrutés pour la période. Les enfants sont répartis par groupes d'âge, de trois à six ans et de sept à douze ans.",
      horaires: "L'accueil de loisirs est ouvert du lundi 19 au vendredi 30 octobre 2026, de 7 h 30 à 18 h 30. Une sortie à la ferme pédagogique du Valmont est organisée le jeudi 22 octobre.",
    },
    execution: {
      transmission: { at: "2026-10-12", ref: "2026-10-EDU-0147", mode: "ctes", recuLe: "2026-10-12T10:19:00", byName: "Julien MERCIER" },
    },
  },

  // ==========================================================================
  // LES TARIFS DES SERVICES MUNICIPAUX — la SECONDE famille d'ANNEXES de la
  // démonstration, et celle qui touche le plus directement les familles : la
  // grille tarifaire dit le prix du repas de cantine, de l'accueil du matin et
  // du soir. Comme le règlement de la restauration scolaire, la grille ne se
  // signe pas : c'est la délibération qui l'adopte qui est signée, et le
  // tableau suit son original (voir src/lib/annexe-docs.js). Le couple
  // « délibération + grille » est épinglé au recueil : c'est le document qu'un
  // parent vient chercher.
  // ==========================================================================
  {
    id: "acte-demo-462",
    trameId: "tpl-deliberation",
    signed: true,
    epingle: true,
    at: "2026-06-18T10:10:00",
    createdBy: "u-daval", createdByName: "Isabelle DAVAL",
    api: { acteId: "ACT-0047", signatureId: "SIG-0047", docId: DOC[47], deposeLe: "2026-06-18T09:48:00" },
    annexesRefs: [{ ref: "acte-demo-463", designation: "Grille tarifaire" }],
    values: {
      numero: "2026-462-VSL",
      objet: "fixation des tarifs des services municipaux pour l'année 2026-2027",
      dateSignature: "2026-06-18",
      dateEffet: "2026-09-01",
      signataire: "p-faure",
    },
    execution: {
      transmission: { at: "2026-06-22", ref: "2026-06-DELIB-0158", mode: "ctes", recuLe: "2026-06-22T09:12:00", byName: "Isabelle DAVAL" },
      publication: { at: "2026-06-25", ref: "RAA n° 2026-12 du 25 juin 2026", mode: "recueil", byName: "Isabelle DAVAL" },
    },
  },
  {
    // L'ANNEXE : le tableau des tarifs. Sa grande table — dix lignes, trois
    // colonnes — est ce que la compilation a de plus volumineux à rendre : elle
    // paraît à l'identique dans l'original signé, dans l'export Akoma Ntoso et
    // au recueil public.
    id: "acte-demo-463",
    trameId: "tpl-grille-tarifaire",
    at: "2026-06-18T10:35:00",
    createdBy: "u-daval", createdByName: "Isabelle DAVAL",
    adoptionRef: { ref: "acte-demo-462", designation: "Délibération" },
    values: {
      objet: "grille tarifaire des services municipaux pour l'année 2026-2027",
      dateSignature: "2026-06-18",
      dateEffet: "2026-09-01",
      intitule: "Grille tarifaire des services municipaux — exercice 2026-2027",
    },
  },

  // ==========================================================================
  // LA CÉRÉMONIE DU 11 NOVEMBRE — l'autre événement à venir de la démonstration,
  // après la fête du village et avant le marché de Noël. Une journée, une
  // cérémonie, un défilé : les mesures de police y sont plus légères que pour
  // une fête, mais le plan de stationnement est joint, comme il l'est d'usage.
  // ==========================================================================
  {
    id: "acte-demo-464",
    trameId: "tpl-evenement",
    signed: true,
    at: "2026-10-28T09:40:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    api: { acteId: "ACT-0048", signatureId: "SIG-0048", docId: DOC[48], deposeLe: "2026-10-28T09:18:00" },
    annexesRefs: [{ ref: "acte-demo-465", designation: "Arrêté" }],
    values: {
      numero: "2026-464-VSL",
      objet: "organisation de la cérémonie commémorative du 11 novembre 2026",
      dateSignature: "2026-10-28",
      dateEffet: "",
      signataire: "p-masson",
      nomEvenement: "la cérémonie commémorative de l'armistice du 11 novembre 1918",
      organisateur: "la municipalité de Valmont-sur-Loire, avec les anciens combattants et les écoles",
      dateDebut: "2026-11-11",
      dateFin: "",
      lieu: "au monument aux morts, place de la République",
      emprise: "la place de la République et le parvis de l'église sont occupés le mercredi 11 novembre de 9 heures à 13 heures pour l'installation de la tribune, des sonorisations et du défilé.",
      mesures: ["circulation", "stationnement", "sonorisation"],
      securite: "",
      obligations: "Les écoles remettent leurs gerbes à l'organisation la veille. Les porte-drapeaux des associations d'anciens combattants sont reçus à la mairie à 9 h 30.",
    },
    execution: {
      transmission: { at: "2026-10-30", ref: "2026-10-MAN-0119", mode: "ctes", recuLe: "2026-10-30T10:04:00", byName: "Sophie LECLERC" },
      publication: { at: "2026-11-03", ref: "RAA n° 2026-27 du 3 novembre 2026", mode: "recueil", byName: "Sophie LECLERC" },
    },
  },
  {
    id: "acte-demo-465",
    trameId: "tpl-annexe-joint",
    at: "2026-10-28T10:05:00",
    createdBy: "u-leclerc", createdByName: "Sophie LECLERC",
    adoptionRef: { ref: "acte-demo-464", designation: "Arrêté" },
    values: {
      objet: "plan de stationnement et déroulé de la cérémonie du 11 novembre",
      dateSignature: "2026-10-28",
      dateEffet: "",
      intitule: "Stationnement et déroulé — cérémonie du 11 novembre 2026",
      chapeau: "La présente annexe est jointe à l'arrêté du 28 octobre 2026 portant organisation de la cérémonie commémorative du 11 novembre. Elle fixe le stationnement et l'ordre du déroulé de la matinée.",
      partie1: "Le stationnement est interdit, de 7 heures à 14 heures, sur la place de la République et sur le parvis de l'église. Les véhicules sont dirigés vers le parking de la poste (60 places) et celui du gymnase (250 places), signalés depuis la rocade. Les personnes à mobilité réduite disposent de six emplacements réservés rue de la Mairie.",
      partie2: "9 h 30 : accueil des porte-drapeaux et des autorités à la mairie. 10 h 15 : rassemblement place de la République. 10 h 30 : revue des troupes par le maire et dépôt de gerbes au monument aux morts, accompagnés par l'Harmonie municipale. 11 heures : sonnerie aux morts, minute de silence, puis lecture du message ministériel par un élève des écoles. 11 h 45 : vin d'honneur offert par la municipalité, salle du conseil.",
      partie3: "La police municipale assure la régulation aux abords de la place dès 8 heures. Les riverains de la place de la République conservent l'accès à pied ; les livraisons sont autorisées jusqu'à 8 heures.",
    },
  },
  {
    id: "acte-demo-466",
    trameId: "tpl-decision-achat",
    signed: true,
    at: "2026-11-12T14:30:00",
    createdBy: "u-daval", createdByName: "Isabelle DAVAL",
    api: { acteId: "ACT-0049", signatureId: "SIG-0049", docId: DOC[49], deposeLe: "2026-11-12T14:08:00" },
    values: {
      numero: "2026-466-VSL",
      objet: "engagement de la dépense des illuminations de fin d'année et des chalets du marché de Noël",
      dateSignature: "2026-11-12",
      dateEffet: "",
      signataire: "p-vidal",
      fournisseur: "la société Loire Illuminations",
      objetAchat: "la fourniture, l'installation et le démontage des motifs lumineux de la traverse et du marché de Noël, ainsi que la location de six chalets de bois",
      montant: 24800,
      imputation: "6068 — achats non stockés de matières et fournitures",
      procedure: "mapa",
    },
    execution: {
      transmission: { at: "2026-11-16", ref: "2026-11-FIN-0402", mode: "ctes", recuLe: "2026-11-16T10:41:00", byName: "Isabelle DAVAL" },
    },
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

// L'entité d'un acte de démonstration : la commune par défaut, ou celle que
// nomme `spec.entity` (« ccas », « oph »…). C'est ce qui permet de montrer des
// actes pris par une organisation AUTONOME, dans son propre nom.
const ENTITE_DE_SPEC = { ccas: "CCAS", oph: "OPH" };
const entiteIdDuSpec = (config, spec) =>
  entiteIdDe(config, ENTITE_DE_SPEC[spec.entity] || (spec.entity ? String(spec.entity).toUpperCase() : "VSL"));

// Le code de l'entité d'un acte de démonstration — celui qui entre dans son
// identifiant ELI (« …/vsl », « …/ccas »).
const codeDeSpec = (config, spec) =>
  (config.entities || []).find((e) => e.id === entiteIdDuSpec(config, spec))?.code || "VSL";

// Le lien d'ANNEXE figé par la rédaction : l'identification d'un acte de
// démonstration, vue d'un autre (numéro, nature, date, objet, ELI). C'est
// exactement ce que pose `identification` (src/lib/annexes.js) quand un
// rédacteur joint une annexe ou désigne son acte d'adoption — sauf que la
// démonstration le compose d'après les actes qu'elle va elle-même poser.
function identifiantDeDemo({ ref, designation }, config, trameOf) {
  const s = SPECS.find((x) => x.id === ref);
  if (!s) return null;
  const t = trameOf(s.trameId);
  return {
    acteId: s.id,
    numero: s.values.numero || "",
    designation: designation || "",
    date: s.values.dateSignature || "",
    objet: s.values.objet || "",
    // Une ANNEXE n'a pas d'adresse de recueil : elle ne s'y publie pas, son texte
    // suit l'acte qui l'adopte (voir src/lib/annexe-docs.js).
    eli: t && t.nature !== "annexe" ? eliUri({ config, actTypeId: t.actTypeId, numero: s.values.numero, entityCode: codeDeSpec(config, s) }) : "",
  };
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
// notification). La transmission de la démonstration a été faite par l'API
// d'envoi du contrôle de légalité : elle porte donc son certificat, construit
// exactement comme celui du service (mêmes mentions, même sceau). L'empreinte
// est celle du document signé — c'est pourquoi les formalités sont posées APRÈS
// la signature, dans seedActes.
async function poserFormalites(acte, spec) {
  const e = spec.execution;
  if (!e) return;
  for (const id of ["transmission", "publication", "notification"]) {
    if (!e[id]) continue;
    const f = { ...e[id] };
    if (id === "transmission" && f.recuLe && !f.certificat) {
      f.certificat = await certificatTransmission({
        reference: f.ref, recuLe: f.recuLe,
        destinataire: CONTROLE_LEGALITE.destinataire,
        empreinte: acte.original?.document?.sha256 || "",
      });
      if (acte.original) acte.original.transmission = f.certificat;
    }
    enregistrerFormalite(acte, id, f);
  }
}

// Rejoue la constatation d'un recours : l'administration a reçu la requête, et
// elle en note la date d'introduction. C'est ce fait — et non une échéance — qui
// ferme le délai de recours contentieux (voir src/lib/execution.js).
function poserRecours(acte, spec) {
  if (!spec.recours) return;
  enregistrerRecours(acte, spec.recours);
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

// Rejoue la RÉVISION d'un acte (voir src/lib/revision.js). `spec.revision` décrit
// le sort de l'acte devant le réviseur :
//   undefined          aucune révision (aucun réviseur compétent à l'époque)
//   "attente"          soumis, personne n'a encore statué
//   { statut: "valide"|"rejete", par, parName, motif, corrige }
// L'empreinte est posée avec les fonctions du module : l'acte de démonstration
// est donc exactement dans l'état où le laisserait le geste réel.
function poserRevision(acte, config, spec) {
  if (!spec.revision) return;
  const r = spec.revision === "attente" ? {} : spec.revision;
  const auteur = nomme(spec.createdBy, spec.createdByName);
  const reviseur = r.par ? nomme(r.par, r.parName) : nomme("u-roussel", "Amandine ROUSSEL");
  const base = Date.parse(spec.at || "") || Date.now();
  demanderRevision(acte, auteur, { reviseurs: [] });
  acte.revision.demandeeLe = new Date(base - 3600000).toISOString();
  if (!r.statut) return;
  // Le réviseur a pu corriger l'acte avant de statuer : l'empreinte soumise est
  // alors celle d'avant sa correction, et `revision.corrige` devient vrai.
  if (r.corrige) acte.revision.empreinte = "0000000000000000";
  if (r.statut === "valide") validerRevision(acte, reviseur);
  else rejeterRevision(acte, reviseur, r.motif || "");
  const quand = new Date(base + 5400000).toISOString();
  if (acte.revision.valideLe) acte.revision.valideLe = quand;
  if (acte.revision.rejeteLe) acte.revision.rejeteLe = quand;
  // Le rejet renvoie l'acte en brouillon chez son rédacteur.
  if (r.statut === "rejete") acte.statut = "brouillon";
}

export async function seedActes(config, trames) {
  const trameOf = (id) => (trames || []).find((t) => t.id === id);
  // Première passe : les VALEURS de chaque acte, et les liens d'annexe figés par
  // la rédaction (numéro, nature, date, objet, ELI). On les prépare toutes avant
  // de compiler quoi que ce soit, parce qu'un acte qui ADOPTE une annexe doit
  // pouvoir en résoudre le TEXTE — celui qui suit sa signature (voir
  // src/lib/annexe-docs.js). Or l'ordre des `SPECS` ne le permettrait pas : la
  // délibération est écrite avant le règlement qu'elle adopte.
  const plans = [];
  for (const spec of SPECS) {
    const trame = trameOf(spec.trameId);
    if (!trame) continue;
    const values = {
      __entityId: entiteIdDuSpec(config, spec),
      __overrides: spec.overrides || {},
      ...spec.values,
    };
    // Les liens d'annexe : ce que la rédaction aurait figé (voir ci-dessus).
    if (spec.annexesRefs) values.__annexes = spec.annexesRefs.map((r) => identifiantDeDemo(r, config, trameOf)).filter(Boolean);
    if (spec.adoptionRef) values.__adoption = identifiantDeDemo(spec.adoptionRef, config, trameOf);
    plans.push({ spec, trame, values });
  }
  // Les actes tels que `annexesJointes` les lit, pour résoudre le texte des
  // documents annexés (voir src/lib/annexe-docs.js).
  const registre = plans.map((p) => ({ id: p.spec.id, trameId: p.trame.id, values: p.values, overrides: p.spec.overrides || {} }));
  const actes = [];
  for (const { spec, trame, values } of plans) {
    const doc = compile(trame, values, config);
    // Le TEXTE des documents ANNEXÉS : il suit l'acte qui les adopte, à la suite
    // de la signature. L'original signé de démonstration en porte donc le texte,
    // comme il le ferait d'un acte réel.
    const joints = annexesJointes(values, { actes: registre, trames, config, acteId: spec.id });
    if (joints.length) doc.annexeDocs = joints;
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
      // La nature du document et ses liens d'annexe, tels que les pose la
      // rédaction : une ANNEXE est adoptée par un autre acte (`adoptePar`), un
      // acte ordinaire annonce ceux qu'il annexe (`annexes`). Voir
      // src/lib/annexes.js.
      nature: trame.nature === "annexe" ? "annexe" : "acte",
      adoptePar: values.__adoption || null,
      annexes: values.__annexes || [],
      // Un acte ÉPINGLÉ est mis en avant sur l'accueil du recueil public (bande
      // « À la une »). La démonstration en épingle un — la délibération qui
      // adopte le règlement intérieur : c'est exactement l'usage de la fonction
      // (voir src/ui/demo-publications.js, qui porte le drapeau au service).
      epingle: spec.epingle === true,
    };
    // Le dossier de l'acte : parapheur et historique AVANT la signature (c'est
    // l'ordre réel), formalités APRÈS (elles suivent la signature).
    poserParapheur(acte, config, trame, spec);
    poserRevisions(acte, spec);
    poserRevision(acte, config, spec);
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
    await poserFormalites(acte, spec);
    poserRecours(acte, spec);
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
