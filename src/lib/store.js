// ============================================================================
// Persistance de l'application.
//
// Ce module ne sait plus *où* sont rangées les données : il passe par la façade
// `db` (src/lib/db/index.js), qui choisit le pilote — stockage du navigateur
// (mode local de démonstration) ou service de données partagé (service de
// démonstration, ou serveur MySQL/MariaDB externe). Voir src/README.md.
//
// Il ne reste ici que la logique de l'application : amorçage, migrations
// additives du jeu de données, et les accesseurs utilisés par l'interface.
// ============================================================================

import { seedConfig, seedConfigVierge, seedTrames } from "./seed.js";
import { LOGO_CCAS_SVG, svgDataUrl } from "./styles.js";
import { emptyConfig } from "./schema.js";
import { mentionsParDefaut } from "./recueil.js";
import { seedActes } from "./demo-actes.js";
import { seedInformations } from "./demo-informations.js";
import { seedUsers, isDemoUsers, isDemoUser, hasRole, rolesOf, setRoles, syncDemoAccounts, DEMO_USER_IDS } from "./users.js";
import { ROLE_SIGNATAIRE, situationDeSignature } from "./signataires.js";
import { emptyAuth, demoAccountsDisabled } from "./auth.js";
import { demoActif, demoDeploiement } from "./demo.js";
import { appliquerOptions } from "./deploiement-config.js";
import * as db from "./db/index.js";

// La mise en page A4 des documents (`src/lib/paper.js`), l'export Word, et
// l'auteur des commentaires et des règles — désormais le **service** du compte
// qui les a saisis — changent le contenu du jeu de démonstration : la version 17
// régénère trames et actes avec ces valeurs. La version 21 ajoute les feuilles
// de style (charte graphique) ; la 22 régénère les originaux signés pour qu'ils
// portent, eux aussi, la charte de leur entité et de leur famille. La 23 porte
// les réglages de charte ajoutés depuis (marges de page, cadre, numéros
// d'article, capitales, filets d'intitulé…) : les feuilles de démonstration en
// reçoivent quelques-uns (voir `migrateDemoStyleOptions`), et les actes de
// démonstration sont régénérés à cette version.
// La version 24 ajoute le parapheur et l'échéancier (circuits de validation,
// délais d'exécution) : le référentiel de démonstration reçoit ses circuits et
// ses délais, et les actes de démonstration sont régénérés pour porter, eux
// aussi, leur passage au parapheur, leurs formalités et leur historique.
// La version 25 ne change que le JEU DE DÉMONSTRATION : les essais de la mise
// en place (validations données, formalités constatées, actes mis à la
// corbeille) ont laissé des traces dans les données locales — on régénère pour
// que chacun parte d'un état neuf et cohérent.
// La version 26 ajoute l'accord des qualités en genre (les rôles portent leurs
// deux formes) et l'arbre des délégations de signature ; la 27, la trame
// « permis de construire » rattachée à l'urbanisme ; la 28, le compte du chef du
// bureau Urbanisme et l'acte signé au bout d'une chaîne à trois étages
// (maire → adjoint → chef de bureau) ; la 29, une AUTORITÉ AUTONOME — l'office
// public de l'habitat, son président de conseil d'administration et son
// directeur général, chaîne indépendante de celle de la commune — et la
// délégation donnée par le maire dans le nom du CCAS qu'il préside ; la 30, le
// rattachement de chaque délégation à son organisation, la lecture de la chaîne
// à la DATE de l'acte et la délégation du maire au nom du CCAS.
//
// La 31 ne change qu'un mécanisme : un changement de version remet désormais
// aussi le RÉFÉRENTIEL de démonstration à niveau (voir plus bas, dans
// `bootstrap`), et non les seules trames et actes.
//
// La 32 donne à chaque transmission de démonstration son CERTIFICAT DE
// TRANSMISSION (l'accusé de réception de l'API du contrôle de légalité), pour
// que l'étape soit visible sur les actes déjà au registre (voir
// src/lib/legalite.js).
//
// La 33 ajoute les DÉCISIONS fondant la signature : renseignées sur les
// personnes (le pouvoir de l'autorité) et, sur chaque délégation, en deux
// volets — la nomination puis la délégation, chacune prise d'une publication
// du recueil ou d'un lien externe. Elles se visent automatiquement sur les
// actes, avec leur lien, étage par étage de la chaîne (voir
// src/lib/delegations.js). Le jeu de démonstration porte la délibération du
// conseil municipal pour le maire et les arrêtés de délégation, et ses trames
// visent désormais la chaîne au lieu de la citer à la main.
//
// La 34 ajoute le RECOURS introduit contre un acte (sa date d'introduction, sa
// nature, son auteur) et les pièces qui s'y rattachent — l'état des formalités
// et l'attestation de non-recours (voir src/lib/execution.js et
// src/lib/execution-documents.js). Le jeu de démonstration reçoit un permis de
// construire contesté devant le tribunal administratif, pour que l'état
// « recours introduit » soit visible dès l'ouverture.
//
// La 35 ajoute la RÉVISION des actes (le contrôle entre la décision d'envoyer
// et l'envoi effectif — voir src/lib/revision.js) et, avec elle, le CUMUL DES
// RÔLES : un éditeur peut être réviseur. Le référentiel de démonstration reçoit
// le service des affaires générales comme réviseur pour tous les services, les
// comptes de démonstration leurs qualités de réviseur, et les actes de
// démonstration leur dossier de révision (un acte en attente, un acte révisé
// après correction, un acte rejeté et revenu en brouillon).
//
// La 36 ne choisit plus le signataire par son NOM mais par sa FONCTION : on
// désigne la qualité qui donne compétence pour signer l'acte, puis, parmi les
// personnes qui la tiennent, celle qui signe (voir src/lib/fonctions.js et
// src/ui/signer-picker.js). Le champ « signataire » des trames devient de type
// `signataire` ; les trames existantes sont converties (voir
// `migrateSignatureFields`).
// La 40 change le régime des ANNEXES : une annexe ne se signe ni ne se publie
// pour elle-même. C'est l'acte qui l'adopte qui est signé, et l'original de cet
// acte est suivi du texte de l'annexe (voir src/lib/annexe-docs.js). Le couple
// délibération / règlement de la démonstration en tient compte : le règlement
// n'est plus signé à part.
// La 41 en tire le COROLLAIRE : une annexe n'a pas de numéro propre. Le
// règlement de la démonstration en est dépouillé, et l'identification des
// annexes passe partout par la décision qui les adopte (voir src/lib/annexes.js).
// La 42 complète la même reprise : la trame du règlement perd le champ
// « Numéro de l'acte », que l'atelier ne propose donc plus.
//
// La 44 ÉLARGIT LE JEU DE DÉMONSTRATION : la collectivité fictive devient celle
// d'une ville d'une certaine importance, avec ses services (école et
// restauration, fêtes et vie associative, environnement, police municipale,
// finances), ses adjoints et leurs délégations de domaine, leurs codes et leurs
// délibérations de référence. Le registre passe de dix-sept à cinquante-neuf
// actes, d'une grande variété de documents : arrêtés de police, manifestations,
// conventions, avenants, engagements de dépense, occupations du domaine public,
// concessions funéraires, délibérations, règlements et tableaux tarifaires — et
// quatre ANNEXES, dont le règlement d'accès à la restauration scolaire, adopté
// par une délibération. Les documents mis en avant par la fiction (épinglés à la
// une du recueil) sont le règlement des cantines, la sécurité des abords des
// écoles et la fête du village.
//
// La 45 ACHÈVE CET ÉLARGISSEMENT, en mettant en avant ce qu'une collectivité
// montre d'abord : les ANNEXES et les ÉVÉNEMENTS À VENIR. Le registre passe de
// soixante et un à SOIXANTE-SIX actes, et les annexes de cinq à sept : la
// **grille tarifaire des services municipaux** (le prix du repas de cantine, de
// l'accueil du matin et du soir), adoptée par la délibération qui fixe les
// tarifs, et le **plan de stationnement et déroulé de la cérémonie du
// 11 novembre**, joint à l'arrêté qui l'organise. La fiction gagne la cérémonie
// commémorative du 11 novembre et l'engagement de la dépense des illuminations
// de fin d'année. Les actes mis à la une sont désormais le règlement de la
// restauration scolaire, la grille tarifaire, la fête du village et le marché
// de Noël : deux annexes, deux événements.
//
// La 46 ne change qu'un réglage de l'amorçage du recueil : il publie QUINZE
// actes choisis, au lieu de tous ceux que la fiction déclare publiés. L'amorçage
// dépose et publie chaque acte sur le service, un par un ; quinze suffisent à
// montrer toute la variété — les six annexes, les trois événements, et un
// document de chacune des autres familles — et la démonstration s'ouvre bien
// plus vite.
//
// La 47 redessine l'**emblème de la commune** (`LOGO_SVG`, src/lib/seed.js) :
// même écu, mais un dessin mis au point (rais du soleil courts et proches du
// disque, cimes enneigées et bandes d'eau liserées de leur propre couleur pour
// effacer les filets d'anticrénelage, galon unique). Le logo étant embarqué dans
// le référentiel, il faut un nouveau jeu pour le voir.
//
// La 48 corrige la FORMULE des considérants élidés : un considérant déjà écrit
// « Considérant qu'il est nécessaire… » recevait un « Considérant que » de plus
// à l'impression, faute de reconnaître l'élision (« Considérant que » + « il »).
// Deux actes du jeu portaient la faute dans leur document signé ; la correction
// est dans le moteur d'assemblage (src/lib/schema.js, `appliquerFormule`), et un
// nouveau jeu régénère les originaux déjà déposés.
// La 49 introduit les ASSEMBLÉES DÉLIBÉRANTES (src/lib/conseils.js) : le
// conseil municipal de la commune et le conseil d'administration de l'office
// public de l'habitat, et la trame « Délibération du conseil d'administration ».
// Les délibérations émanent désormais de l'assemblée — ligne d'autorité « Le
// conseil municipal de … » — et sont signées par le président de celle-ci.
// La 50 ne change PAS le jeu livré (les données de la fiction sont identiques) :
// elle change la façon dont il est semé. La démonstration devient un commutateur
// unique du déploiement (src/lib/demo.js) et `bootstrap()` n'installe plus rien
// quand elle est éteinte ; une installation de démonstration doit donc repasser
// par l'amorçage pour recevoir le MIROIR `brand.demo` et laisser le reste à
// l'identique — d'où l'incrément.
//
// La 51 enrichit le jeu livré de ce que l'ORGANIGRAMME a besoin de montrer : le
// SIGNATAIRE PRINCIPAL de chaque entité (le maire pour la commune, la directrice
// pour le CCAS, la présidente pour la caisse des écoles, le président du conseil
// d'administration pour l'office), le drapeau `autonome`, et une entité
// RATTACHÉE — la régie du cinéma municipal, sans personnalité morale propre,
// avec son directeur, son service et ses deux bureaux (voir
// src/lib/organigramme.js). Le référentiel de démonstration doit donc être
// regénéré pour que l'écran ait quoi montrer.
// La 52 change le vocabulaire des ÉTAPES du parapheur : les natures
// « vérification », « visa » et « signature » remplacent l'ancien couple
// « bon pour accord / avis », et le circuit général s'ouvre désormais par la
// vérification du réviseur (voir src/lib/validation.js). Les actes de
// démonstration portent leur passage au circuit avec les libellés des étapes :
// le jeu doit donc être regénéré pour que l'écran du parapheur montre le
// nouveau trajet.
// La 53 ajoute les DOCUMENTS D'ASSEMBLÉE QUI NE FONT PAS DROIT : trois trames
// (`tpl-verbatim`, `tpl-declaration`, `tpl-voeu`) et trois actes — un verbatim
// de séance et un vœu publiés au recueil, une déclaration en attente de
// publication. Le recueil public montre ainsi des « documents » à côté des
// actes, et l'écran de publication a de quoi illustrer une publication sans
// opposabilité (voir src/lib/schema.js, ACTE_NATURES).
export const SEED_VERSION = 53;

// Migration du vocabulaire de modification. Les gabarits par défaut d'origine
// accordaient mal le nom de l'acte (« la présente arrêté », « confiée à le
// maire ») : ils sont remplacés par les gabarits corrigés (article défini
// accordé, contraction de « à »). Seul un gabarit resté au texte d'origine est
// touché — une tournure personnalisée par l'administrateur est conservée.
const AMEND_VOCAB_MIGRATIONS = [
  ["la {designationLower} n°{numero} du {date}", "{designationThe} n°{numero} du {date}"],
  ["l'{designationLower} n°{numero} du {date}", "{designationThe} n°{numero} du {date}"],
  ["Les dispositions de la présente {designationLower} entrent en vigueur à compter du {dateEffet}.",
    "Les dispositions de {designationThe} entrent en vigueur à compter du {dateEffet}."],
  ["Les dispositions de la présente {designationLower} entrent en vigueur au lendemain de sa publication.",
    "Les dispositions de {designationThe} entrent en vigueur au lendemain de sa publication."],
  ["L'exécution de la présente {designationLower} est confiée à {authority}.",
    "L'exécution de {designationThe} est confiée {authorityTo}."],
  // L'intitulé de l'acte modificatif écrivait « de {targetInSentence} », ce qui
  // produisait « de le règlement » pour toute appellation masculine non élidée.
  // Il passe par la forme contractée {targetDe} (voir lib/amend.js).
  ["{designation} n°{numero} du {date} portant modification de {targetInSentence}",
    "{designation} n°{numero} du {date} portant modification {targetDe}"],
];

function migrateAmendmentVocab(config) {
  const a = config?.vocab?.amendment;
  if (!a) return false;
  let changed = false;
  for (const [from, to] of AMEND_VOCAB_MIGRATIONS) {
    for (const key of Object.keys(a)) {
      if (a[key] === from) { a[key] = to; changed = true; }
    }
  }
  return changed;
}

// Rattrapage additif du référentiel de démonstration : les mentions propres aux
// actes individuels et la famille correspondante, introduites avec le réglage
// `publishable` des trames. L'ajout est purement additif (rien n'est écrasé) et
// réservé à un référentiel de démonstration : un référentiel réel n'est pas
// touché.
function migrateDemoNonPublishable(config) {
  if (!config || !demoActif(config)) return false;
  const fresh = seedConfig();
  let changed = false;
  config.families = config.families || [];
  if (!config.families.some((f) => f.id === "fam-individuels")) {
    const f = fresh.families.find((x) => x.id === "fam-individuels");
    if (f) { config.families.push(f); changed = true; }
  }
  config.mentions = config.mentions || [];
  for (const id of ["men-notification", "men-recours-notification"]) {
    if (!config.mentions.some((m) => m.id === id)) {
      const m = fresh.mentions.find((x) => x.id === id);
      if (m) { config.mentions.push(m); changed = true; }
    }
  }
  return changed;
}

// Présentation des familles — les THÈMES du recueil public (« Urbanisme et
// voirie : autorisations d'urbanisme, accès, voirie… »). Introduite avec
// l'accueil du recueil. Purement additive et prudente : on ne remplit que les
// familles CONNUES dont le libellé n'a pas été changé — une famille renommée par
// l'administration, ou créée à la main, reste sans présentation jusqu'à ce qu'on
// lui en écrive une (Administration › Familles).
function migrateFamilyDescriptions(config) {
  if (!config || !Array.isArray(config.families)) return false;
  const connues = seedConfig().families;
  let changed = false;
  for (const f of config.families) {
    if (f.description !== undefined) continue;
    const seed = connues.find((x) => x.id === f.id);
    if (seed && seed.label === f.label) { f.description = seed.description; changed = true; }
  }
  return changed;
}

// Feuilles de style de la démonstration (la charte graphique des décisions).
// Purement additif : un référentiel de démonstration qui n'en a pas encore les
// reçoit ; un référentiel réel — ou vidé volontairement — n'est pas touché et
// reste sur la feuille implicite dérivée de la marque (voir src/lib/styles.js).
function migrateDemoStyles(config) {
  if (!config || !demoActif(config)) return false;
  if (Array.isArray(config.styles) && config.styles.length) return false;
  config.styles = seedConfig().styles;
  return true;
}

// L'emblème du CCAS a d'abord été encodé avec `btoa` sur du texte Latin-1 : le
// navigateur refusait de le décoder (image muette, dans l'application comme
// dans les exports). On remet la version UTF-8 sur une feuille de démonstration
// qui porte encore l'ancienne — un emblème choisi par l'administrateur, ou un
// référentiel réel, n'est jamais touché.
function migrateDemoCcasLogo(config) {
  if (!config || !demoActif(config) || !Array.isArray(config.styles)) return false;
  const style = config.styles.find((s) => s.id === "sty-ccas");
  if (!style || !style.logoUrl) return false;
  const ancien = "data:image/svg+xml;base64," + btoa(LOGO_CCAS_SVG.trim());
  if (style.logoUrl !== ancien) return false;
  style.logoUrl = svgDataUrl(LOGO_CCAS_SVG);
  return true;
}

// L'emblème du thème sombre (`brand.logoUrlDark`) : réglage introduit après coup
// (voir `brandLogoUrl`, src/lib/theme.js). Purement additif et volontairement
// étroit — seul un référentiel de démonstration qui porte encore l'emblème LIVRÉ
// reçoit sa variante sombre. Un emblème choisi par l'administrateur n'est jamais
// touché, et un référentiel réel non plus : c'est à lui de décider s'il lui faut
// un second dessin pour le fond sombre.
function migrateDemoLogoDark(config) {
  if (!config || !config.brand || !demoActif(config)) return false;
  if (config.brand.logoUrlDark) return false;
  const seed = seedConfig().brand;
  if (config.brand.logoUrl !== seed.logoUrl) return false;
  config.brand.logoUrlDark = seed.logoUrlDark;
  return true;
}

// Réglages de charte ajoutés APRÈS la première livraison : les feuilles de
// démonstration en reçoivent quelques-uns, pour que les nouvelles possibilités
// (marges de page, cadre, numéros d'article, capitales, filets d'intitulé…) se
// voient dès l'ouverture. Purement additif : on ne remplit que des clés
// ABSENTES — une valeur choisie par l'administrateur n'est jamais écrasée.
const DEMO_STYLE_OPTIONS = {
  "sty-ccas": {
    authorityItalic: true, visasLabelStyle: "bold", footerAlign: "left",
    signatureFunctionItalic: true, tableCellPadding: "5",
    pageMarginTop: "16", letterSpacing: "0.005",
  },
  "sty-individuels": {
    headingCase: true, articleNumberLayout: "block", mentionSize: "0.88",
    signatureNameWeight: "700",
  },
};

// Circuits de validation (parapheur) et délais d'exécution, introduits avec
// l'échéancier. Purement additif, et volontairement prudent : sur un référentiel
// RÉEL (marque sans mention de démonstration), on n'installe aucun circuit —
// « pas de parapheur » est le comportement historique, et c'est à
// l'administrateur de décider qui valide quoi. Un référentiel de démonstration,
// lui, reçoit les circuits livrés.
function migrateCircuits(config) {
  if (!config) return false;
  let changed = false;
  if (!config.delais) {
    config.delais = { ...emptyConfig().delais };
    changed = true;
  }
  if (!Array.isArray(config.circuits)) {
    config.circuits = demoActif(config) ? seedConfig().circuits : [];
    changed = true;
  }
  return changed;
}

// Les NATURES d'étape (vérification, visa, signature) remplacent l'ancien
// couple « bon pour accord / avis » (1.5.0). Le moteur lit les circuits anciens
// sans broncher (`natureEtape` les ramène au visa), mais le jeu de déMONSTRATION
// doit montrer le nouveau vocabulaire : ses étapes livrées y sont donc ramenées,
// et seulement elles. Une étape dont la nature a déjà été choisie parmi les
// trois nouvelles — ou une étape ajoutée par l'administrateur — n'est jamais
// touchée. Le drapeau `experimental.parapheur` suit : toujours vrai.
const NATURES_DEMO = {
  "etp-chef-service": {
    kind: "verification", role: "reviseur", serviceScoped: false, optional: false,
    label: "Vérification du dossier",
    help: "Le réviseur — le service des affaires juridiques, ici — contrôle que le dossier est complet, l'acte conforme et les visas réunis, avant tout engagement.",
  },
  "etp-ccas-chef": { kind: "visa", label: "Visa du responsable de service" },
  "etp-direction": { kind: "visa" },
  "etp-ccas-avis": {
    kind: "verification", role: "administrateur", serviceScoped: false, optional: true,
    label: "Vérification du secrétariat général",
    help: "Vérification facultative : elle n'empêche pas la signature, mais elle est conservée au dossier.",
  },
  "etp-individuel": {
    kind: "verification", role: "editeur", serviceScoped: true, optional: false,
    label: "Vérification du responsable des ressources humaines",
    help: "Vérification de l'habilitation, du grade et du montant avant signature.",
  },
  "etp-oph-service": { kind: "visa", label: "Visa du responsable de service" },
  "etp-oph-direction": {
    kind: "signature", role: "signataire", serviceScoped: false, optional: false,
    label: "Signature de l'acte",
    help: "Le signataire de l'office marque son accord pour signer : le circuit est alors achevé, et l'acte passe à la signature.",
  },
};

function migrateCircuitsNatures(config) {
  if (!config) return false;
  let changed = false;
  if (config.experimental && config.experimental.parapheur !== true) {
    config.experimental.parapheur = true;
    changed = true;
  }
  if (!demoActif(config)) return changed;
  for (const c of config.circuits || []) {
    for (const s of (c && c.steps) || []) {
      const patch = NATURES_DEMO[s.id];
      if (!patch) continue;
      // Seules les étapes livrées restées sur l'ancien vocabulaire sont reprises.
      if (s.kind !== "accord" && s.kind !== "avis") continue;
      if (patch.kind && s.kind !== patch.kind) { s.kind = patch.kind; changed = true; }
      for (const k of ["role", "label", "help", "serviceScoped", "optional"]) {
        if (patch[k] !== undefined && s[k] !== patch[k]) { s[k] = patch[k]; changed = true; }
      }
    }
  }
  return changed;
}

// Fonctions expérimentales : réglage introduit après coup. Toutes sont éteintes
// par défaut — c'est le cas du parapheur (circuit de validation avant signature),
// que beaucoup de collectivités remplacent par leur propre circuit interne.
// Idempotent : on ne pose que les clés ABSENTES.
function migrateExperiments(config) {
  if (!config) return false;
  const defaults = emptyConfig().experimental;
  if (!config.experimental || typeof config.experimental !== "object") {
    config.experimental = { ...defaults };
    return true;
  }
  let changed = false;
  for (const [k, v] of Object.entries(defaults)) {
    if (config.experimental[k] === undefined) { config.experimental[k] = v; changed = true; }
  }
  return changed;
}

// Assistants : réglage introduit après coup. Un référentiel antérieur n'a pas
// ce bloc — on pose deux blocs VIDES, c'est-à-dire « tout par défaut » : les
// deux assistants s'allument (leurs réglages livrés), sans qu'aucun écran ne
// change pour autant. Purement additif, et idempotent.
function migrateAssistants(config) {
  if (!config) return false;
  if (!config.assistant || typeof config.assistant !== "object") {
    config.assistant = { atelier: {}, public: {} };
    return true;
  }
  let changed = false;
  for (const qui of ["atelier", "public"]) {
    if (!config.assistant[qui] || typeof config.assistant[qui] !== "object") {
      config.assistant[qui] = {};
      changed = true;
    }
  }
  return changed;
}

// Recueils extérieurs et renvois du recueil public : réglage introduit après
// coup (Administration › Publication). Un référentiel antérieur n'a pas ce
// bloc : on pose une LISTE VIDE sur un référentiel réel — le bas de page du
// recueil ne renvoie alors vers rien d'autre —, et les renvois livrés avec
// l'application sur le jeu de démonstration, pour que l'écran ne soit pas vide.
// Purement additif, et idempotent.
function migrateRecueilsExternes(config) {
  if (!config) return false;
  const p = (config.publication = config.publication || {});
  if (Array.isArray(p.recueilsExternes)) return false;
  p.recueilsExternes = demoActif(config) ? seedConfig().publication.recueilsExternes.map((r) => ({ ...r })) : [];
  return true;
}

// Mentions du pied de page du recueil public : réglage introduit après coup
// (Administration › Publication › « Mentions du recueil public »). Un référentiel
// antérieur n'a pas ce bloc : on pose les mentions LIVRÉES, et on les pose
// ACTIVES — elles rappellent les règles de publication et d'opposabilité des
// actes, et l'accessibilité du service ; c'est à l'administration de les adapter,
// de les remplacer par un lien ou de les éteindre si sa situation le demande.
// Le jeu de démonstration reçoit les textes de la fiction, comme pour les renvois
// du recueil. Purement additif, et idempotent.
function migrateMentionsPubliques(config) {
  if (!config) return false;
  const p = (config.publication = config.publication || {});
  if (p.mentions && typeof p.mentions === "object") return false;
  p.mentions = demoActif(config) ? seedConfig().publication.mentions : mentionsParDefaut();
  return true;
}

function migrateDemoStyleOptions(config) {
  if (!config || !demoActif(config)) return false;
  if (!Array.isArray(config.styles)) return false;
  let changed = false;
  for (const s of config.styles) {
    const opts = DEMO_STYLE_OPTIONS[s.id];
    if (!opts) continue;
    for (const [k, v] of Object.entries(opts)) {
      if (s[k] === undefined) { s[k] = v; changed = true; }
    }
  }
  return changed;
}

// Révision des actes : la QUALITÉ DE RÉVISEUR portée par un SERVICE (Administration ›
// Services). Introduite avec le rôle « Réviseur » : dans la démonstration, c'est
// le service des affaires générales qui contrôle les actes des autres services.
// Purement additif, et réservé à un référentiel de démonstration : un service qui
// n'a AUCUN réglage de révision reçoit celui de la démonstration ; s'il en a un —
// même éteint par l'administrateur — il n'est pas touché.
function migrateDemoServiceRevision(config) {
  if (!config || !demoActif(config)) return false;
  const fresh = seedConfig();
  let changed = false;
  for (const s of config.services || []) {
    if (s.reviseur) continue;
    const f = (fresh.services || []).find((x) => x.id === s.id);
    if (f?.reviseur) { s.reviseur = { ...f.reviseur, bureaux: [...(f.reviseur.bureaux || [])] }; changed = true; }
  }
  return changed;
}

// L'ORGANIGRAMME : le SIGNATAIRE PRINCIPAL de chaque entité, son drapeau
// « autonome », et les entités RATTACHÉES du jeu de démonstration (la régie du
// cinéma, sans personnalité morale propre, mais avec son directeur, son service
// et ses bureaux). Purement additif, et réservé à un référentiel de
// démonstration : une entité qui porte DÉJÀ un signataire, ou dont le drapeau
// est posé — même éteint par l'administrateur — n'est pas touchée, et une
// entité rattachée déjà supprimée n'est pas ressuscitée (elle est cherchée par
// son identifiant avant d'être ajoutée).
function migrateDemoOrganigramme(config) {
  if (!config || !demoActif(config)) return false;
  const fresh = seedConfig();
  let changed = false;
  const entites = (config.entities = Array.isArray(config.entities) ? config.entities : []);
  const services = (config.services = Array.isArray(config.services) ? config.services : []);
  const people = (config.people = Array.isArray(config.people) ? config.people : []);

  for (const e of entites) {
    const f = (fresh.entities || []).find((x) => x.id === e.id);
    if (!f) continue;
    if (e.autonome === undefined && f.autonome !== undefined) { e.autonome = f.autonome; changed = true; }
    if (e.signerPersonId === undefined && f.signerPersonId) { e.signerPersonId = f.signerPersonId; changed = true; }
    if (e.signerRoleId === undefined && f.signerRoleId) { e.signerRoleId = f.signerRoleId; changed = true; }
  }

  // Les entités rattachées livrées : ajoutées, avec ce qui leur appartient, si
  // et seulement si leur identifiant est encore inconnu de ce référentiel.
  const rattachees = (fresh.entities || []).filter((e) => e.autonome === false).map((e) => e.id);
  const connues = new Set(entites.map((e) => e.id));
  for (const id of rattachees) {
    if (connues.has(id)) continue;
    const f = fresh.entities.find((e) => e.id === id);
    entites.push({ ...f });
    for (const s of fresh.services || []) {
      if (s.entityId === id) services.push({ ...s, bureaux: (s.bureaux || []).map((b) => ({ ...b })) });
    }
    for (const pers of fresh.people || []) {
      if (pers.entityId === id) people.push({ ...pers });
    }
    changed = true;
  }
  return changed;
}

// Révision des actes : réglage introduit avec le CUMUL DES RÔLES. Les comptes de
// démonstration reçoivent la qualité de réviseur (et sa compétence). Purement
// additif, et réservé au jeu de démonstration : un compte réel ne se voit jamais
// attribuer un rôle par une mise à niveau — c'est à l'administrateur de le faire.
function migrateDemoRevision(users) {
  const list = Array.isArray(users) ? users : [];
  if (!isDemoUsers(list)) return { users: list, changed: false };
  let changed = false;
  const out = list.map((u) => {
    if (!isDemoUser(u)) return u;
    if (u.id === "u-roussel" && !hasRole(u, "reviseur")) {
      changed = true;
      const v = { ...u };
      setRoles(v, [...rolesOf(u), "reviseur"]);
      return v;
    }
    if (u.id === "u-daval") {
      const v = { ...u };
      let touche = false;
      if (!hasRole(u, "reviseur")) { setRoles(v, [...rolesOf(u), "reviseur"]); touche = true; }
      if (!v.revision) {
        v.revision = { services: [], trameIds: [], familyIds: ["fam-marches", "fam-associations"], actTypes: [], entityIds: [] };
        touche = true;
      }
      if (touche) changed = true;
      return touche ? v : u;
    }
    return u;
  });
  return { users: changed ? out : list, changed };
}

// La QUALITÉ DE SIGNATAIRE. Elle découle d'une désignation : celui qui figure
// dans une chaîne de signature — comme autorité qui délègue, ou comme
// délégataire qui signera — signe, et porte donc la qualité. Le référentiel de
// démonstration portant déjà ses chaînes, ses comptes en reçoivent la qualité,
// comme si l'administrateur venait de les désigner (voir
// src/lib/signataires.js, `assurerRoleSignataire`). Purement additif, et
// réservé au jeu de démonstration : un compte réel ne se voit jamais attribuer
// un rôle par une mise à niveau.
function migrateDemoSignataires(config, users) {
  const list = Array.isArray(users) ? users : [];
  if (!isDemoUsers(list)) return { users: list, changed: false };
  let changed = false;
  const out = list.map((u) => {
    if (!isDemoUser(u)) return u;
    if (!u.personId || u.active === false) return u;
    if (hasRole(u, ROLE_SIGNATAIRE)) return u;
    const sit = situationDeSignature(config, u.personId);
    if (!sit.recues.length && !sit.donnees.length) return u;
    changed = true;
    const v = { ...u };
    setRoles(v, [...rolesOf(u), ROLE_SIGNATAIRE]);
    return v;
  });
  return { users: changed ? out : list, changed };
}

// Le signataire se choisit par la FONCTION, non par le nom. Les trames
// antérieures portent un champ « signataire » de type `person` (la liste des
// personnes du référentiel) : on le bascule sur le type `signataire`, qui ouvre
// la fonction puis les personnes qui la tiennent. Purement mécanique, et
// strictement limité au champ qui porte cette identité — le champ reste
// `values.signataire`, l'identifiant d'une personne : rien d'autre ne bouge.
function migrateSignatureFields(trames) {
  if (!Array.isArray(trames)) return false;
  let changed = false;
  for (const t of trames) {
    for (const f of t?.fields || []) {
      if (f.id === "signataire" && f.type === "person") { f.type = "signataire"; changed = true; }
    }
  }
  return changed;
}

// La façade doit être initialisée (réglages lus, pilote choisi) avant toute
// lecture. `state.init()` s'en charge ; les accesseurs restent utilisables sans
// (le pilote par défaut est le stockage local).
export const initStorage = () => db.init();

export const storageAvailable = () => !db.isLocalMode() || db.localDriver.available();

export const loadConfig = () => db.read("config");
// Garde-fou : la clé d'accès d'un moteur de langage est un SECRET de poste (voir
// src/lib/assistant.js) ; elle ne doit jamais repartir dans le référentiel, qui
// est partagé et exporté. On la retire ici, quelle que soit la provenance de
// l'objet enregistré.
function sansSecrets(c) {
  const assistant = c && c.assistant;
  if (!assistant || typeof assistant !== "object") return c;
  for (const qui of Object.keys(assistant)) {
    if (assistant[qui] && typeof assistant[qui] === "object" && "cle" in assistant[qui]) {
      assistant[qui] = { ...assistant[qui] };
      delete assistant[qui].cle;
    }
  }
  return c;
}
export const saveConfig = (c) => db.write("config", sansSecrets(c));
export const loadTrames = () => db.read("trames");
export const saveTrames = (t) => db.write("trames", t);
export const loadActes = () => db.read("actes");
export const saveActes = (a) => db.write("actes", a);
// Les INFORMATIONS publiées au recueil : des billets (actualités, avis,
// communications) que l'administration écrit et publie, à côté des actes. Elles
// vivent dans leur propre collection — elles ne sont ni des actes ni des trames,
// et elles se publient sans passer par la signature ni par l'ELI (voir
// src/server/mysql/informations.mjs et src/ui/views/informations.js).
export const loadInformations = () => db.read("informations");
export const saveInformations = (l) => db.write("informations", l);
export const loadUsers = () => db.read("users");
export const saveUsers = (u) => db.write("users", u);
export const loadSession = () => db.read("session");
export const saveSession = (s) => db.write("session", s);

export async function bootstrap() {
  let config = await loadConfig();
  let trames = await loadTrames();
  let actes = await loadActes();
  let informations = await loadInformations();
  let users = await loadUsers();
  const session = await loadSession();
  const meta = (await db.read("meta")) || {};
  const firstRun = !config && !trames;
  // LE COMMUTATEUR DE DÉMONSTRATION (voir src/lib/demo.js) : allumé, on sème le
  // jeu fictif livré ; éteint, on n'installe RIEN — un référentiel neuf reste
  // vierge, sans identité de fiction, et c'est à l'administrateur de le bâtir.
  const demo = demoActif(config);
  // Le registre ne contient que des actes de démonstration (ou rien) : une mise
  // à niveau du jeu de démonstration peut alors remplacer trames et actes sans
  // risquer d'écraser un travail réel.
  const demoActes = (actes || []).every((a) => String(a.id).startsWith("acte-demo-"));
  if (!config) { config = demo ? seedConfig() : seedConfigVierge(); await saveConfig(config); }
  if (!trames) { trames = demo ? seedTrames() : []; await saveTrames(trames); }
  else if (demo && meta.seedVersion !== SEED_VERSION && demoActes && trames.every((t) => String(t.id).startsWith("tpl-"))) {
    // jeu de démonstration obsolète et aucune donnée utilisateur : on remet à niveau
    trames = seedTrames();
    await saveTrames(trames);
    // Le référentiel de démonstration est remis à niveau lui aussi : c'est déjà
    // acquis que le registre ne contient que des actes de démonstration, et l'on
    // vérifie que la démonstration est bien allumée — un référentiel réel, ou
    // repris à la main, n'est jamais touché. Seuls l'identité, le vocabulaire et
    // la numérotation de l'utilisateur survivent.
    if (demo) {
      const keep = { brand: config.brand, vocab: config.vocab, numbering: config.numbering, experimental: config.experimental, assistant: config.assistant };
      const fresh = seedConfig();
      config = { ...fresh, brand: { ...fresh.brand, ...keep.brand }, vocab: { ...fresh.vocab, ...keep.vocab }, numbering: { ...fresh.numbering, ...keep.numbering }, experimental: { ...fresh.experimental, ...(keep.experimental || {}) }, assistant: { atelier: { ...(keep.assistant?.atelier || {}) }, public: { ...(keep.assistant?.public || {}) } } };
      await saveConfig(config);
    }
  }
  if (!actes) { actes = []; await saveActes(actes); }

  // Les INFORMATIONS du recueil public — les billets de l'administration. Comme
  // les trames et les actes, elles suivent le jeu de démonstration : semées à
  // l'installation d'une démonstration, et remises à niveau avec lui TANT QUE la
  // liste ne contient que des billets livrés. Une information écrite à la main
  // (un identifiant qui n'est pas de démonstration) protège toute la liste : on
  // n'écrase jamais un billet réel.
  //
  // Deux cas mènent au semis : la liste ABSENTE (stockage local d'un poste qui
  // n'en a jamais reçu), et — en démonstration seulement — la liste VIDE ou
  // périmée. Le service partagé, lui, rend toujours une liste, vide au premier
  // démarrage : sans cette règle, une démonstration neuve n'aurait aucun billet
  // à montrer, et le recueil public serait sans nouvelles.
  const demoInfosAVoir = demo && (!Array.isArray(informations) || !informations.length
    || (meta.seedVersion !== SEED_VERSION && informations.every((i) => String(i.id).startsWith("info-demo-"))));
  if (!informations || demoInfosAVoir) {
    informations = demo ? seedInformations() : [];
    await saveInformations(informations);
  }

  // MIROIR du commutateur : `brand.demo` recopie ce que dit le déploiement, pour
  // que le réglage voyage avec les données exportées et importées. Il ne décide
  // plus rien — toutes les décisions passent par `demoActif()` (src/lib/demo.js).
  const reglageDeploiement = demoDeploiement();
  if (reglageDeploiement !== null && config.brand?.demo !== reglageDeploiement) {
    config.brand = { ...(config.brand || {}), demo: reglageDeploiement };
    await saveConfig(config);
  }

  // Le choix du signataire par la fonction : conversion des trames antérieures
  // (champ « signataire » de type `person` → type `signataire`). Indépendante du
  // jeu de démonstration — une trame réelle en bénéficie aussi.
  if (migrateSignatureFields(trames)) await saveTrames(trames);

  // Les référentiels de démonstration datant d'avant l'introduction des éléments
  // dont la GÉNÉRATION des actes dépend (services et bureaux, mentions des actes
  // individuels, feuilles de style) sont mis à niveau ICI, avant la
  // régénération : sinon les actes de démonstration seraient produits avec un
  // référentiel incomplet, et ne porteraient pas leur charte. Purement additif :
  // rien n'est supprimé, et un référentiel volontairement vidé (`services: []`)
  // n'est pas touché.
  let configTouched = false;
  // Les référentiels antérieurs à l'introduction du mode d'authentification
  // n'ont pas ce réglage : on l'ajoute (valeurs par défaut = comptes de
  // l'application), pour que l'export soit explicite.
  if (!config.auth) { config.auth = emptyAuth(); configTouched = true; }
  if (config.services === undefined) {
    const fresh = seedConfig();
    config.services = fresh.services;
    const assign = {
      "tpl-nomination": ["svc-dgs", "bur-dgs-rh"],
      "tpl-delegation": ["svc-sg", "bur-sg-assemblees"],
      "tpl-regie-creation": ["svc-regie", "bur-reg-principale"],
    };
    for (const t of trames) {
      const a = assign[t.id];
      if (a && t.serviceId === undefined) { t.serviceId = a[0]; t.bureauId = a[1]; }
    }
    await saveTrames(trames);
    configTouched = true;
  }
  // Délégations de signature : réglage introduit après coup. Un référentiel
  // antérieur n'en a pas — on pose une liste vide, que l'on remplit depuis
  // l'écran Délégations. Idempotent.
  if (!Array.isArray(config.delegations)) { config.delegations = []; configTouched = true; }
  // Vocabulaire de modification (accord en genre / contraction), mentions des
  // actes individuels, feuilles de style : `|` (et non `||`) pour toutes les
  // tenter — chacune est idempotente.
  const migrated = migrateAmendmentVocab(config) | migrateDemoNonPublishable(config) | migrateDemoStyles(config)
    | migrateDemoLogoDark(config)
    | migrateDemoCcasLogo(config)
    | migrateDemoStyleOptions(config) | migrateCircuits(config) | migrateExperiments(config)
    | migrateCircuitsNatures(config)
    | migrateDemoServiceRevision(config) | migrateDemoOrganigramme(config)
    | migrateFamilyDescriptions(config) | migrateAssistants(config)
    | migrateRecueilsExternes(config) | migrateMentionsPubliques(config);
  if (migrated || configTouched) await saveConfig(config);

  // Actes de démonstration : posés (ou remis à niveau) à la version de jeu
  // courante, et uniquement si les trames sont celles de la démonstration et que
  // le registre ne contient que des actes de démonstration. Un registre réel —
  // ou enrichi à la main — n'est jamais touché.
  const demoRegistry = demo && (trames || []).length && trames.every((t) => String(t.id).startsWith("tpl-"));
  if (meta.seedVersion !== SEED_VERSION && demoRegistry && demoActes) {
    try {
      // L'emblème de la commune fait partie du jeu de démonstration : la version
      // 47 l'a redessiné. Sur une installation de démonstration, l'identité suit
      // donc le jeu livré — de la même façon que les trames et les actes qu'on
      // régénère ici (le commutateur de démonstration, lui, est celui du
      // déploiement : voir src/lib/demo.js).
      const embleme = seedConfig().brand;
      if (config.brand?.logoUrl !== embleme.logoUrl || config.brand?.logoUrlDark !== embleme.logoUrlDark) {
        config.brand = { ...(config.brand || {}), logoUrl: embleme.logoUrl, logoUrlDark: embleme.logoUrlDark };
      }
      actes = await seedActes(config, trames);
      await saveActes(actes);
      await saveConfig(config);
      // Le jeu de démonstration est reconstruit : on repart aussi d'un journal
      // et d'une présence vides, sinon on lirait des faits qui ne correspondent
      // plus à aucun acte (et des postes « présents » qui n'existent plus).
      await db.write("journal", []);
      await db.write("presence", []);
    } catch (e) {
      console.warn("Actes de démonstration non générés :", e);
      actes = [];
    }
  }

  // Rattrapage des données créées avant l'introduction des services et bureaux :
  // déjà traité ci-dessus, avant la génération des actes de démonstration.

  if (!users || !Array.isArray(users) || !users.length) {
    // Un référentiel neuf reçoit le jeu de comptes de démonstration — SAUF quand
    // le déploiement ferme ces comptes (mode mot de passe sans `DEMO_ACCOUNTS`,
    // ou annuaire branché) : les semer remplirait « Comptes et rôles » de
    // comptes fictifs incapables de se connecter. Sur une installation réelle,
    // le référentiel n'est d'ailleurs pas vide : le service y a créé le compte
    // d'administration du `.env` (voir src/server/mysql/server.mjs).
    // Les comptes fictifs font partie du jeu de démonstration : démonstration
    // éteinte, ou raccourci fermé par le déploiement, on n'en sème aucun.
    users = (demo && !demoAccountsDisabled(config)) ? seedUsers(config) : [];
    await saveUsers(users);
  }
  // Comptes de démonstration créés avant les services : on leur redonne le
  // rattachement de démonstration (services et bureaux).
  else if (isDemoUsers(users) && (config.services || []).length
    && (users.every((u) => u.memberships === undefined) || DEMO_USER_IDS.some((id) => !users.some((u) => u.id === id)))) {
    // Soit les comptes datent d'avant les services (pas de rattachement), soit le
    // jeu de démonstration s'est enrichi d'un compte depuis (ex. le chef du
    // bureau Urbanisme, ajouté avec les délégations).
    users = seedUsers(config);
    await saveUsers(users);
  }
  // Annuaire branché : les comptes de démonstration sont désactivés (et
  // réactivés lorsqu'on revient aux comptes de l'application). Le calcul ne
  // dépend que du mode d'authentification : il est donc idempotent, et il
  // s'applique à chaque démarrage, y compris après un import de données.
  // Avant cela, la qualité de réviseur est posée sur les comptes de
  // démonstration (voir `migrateDemoRevision`).
  const rev = migrateDemoRevision(users);
  if (rev.changed) { users = rev.users; await saveUsers(users); }
  const sync = syncDemoAccounts(config, users);
  if (sync.changed) { users = sync.users; await saveUsers(users); }
  // Après la synchronisation des comptes : un compte rendu actif par elle doit
  // pouvoir recevoir la qualité dans le même démarrage.
  const sig = migrateDemoSignataires(config, users);
  if (sig.changed) { users = sig.users; await saveUsers(users); }
  if (meta.seedVersion !== SEED_VERSION) await db.write("meta", { ...meta, seedVersion: SEED_VERSION });
  // LES RÉGLAGES DU DÉPLOIEMENT (identité, vocabulaire, numérotation, délais,
  // recueil, fonctions) s'appliquent EN DERNIER, et seulement EN MÉMOIRE : le
  // `.env` du service l'emporte sur le référentiel (voir src/lib/deploiement-config.js),
  // mais le référentiel enregistré reste celui de l'administrateur. Rien n'est
  // donc persisté ici : retirer une variable du `.env` la fait disparaître au
  // démarrage suivant.
  appliquerOptions(config);
  return { config, trames, actes, users, session, informations, firstRun };
}

// Remise à zéro de toutes les collections. `garderComptes` épargne la collection
// des comptes : sur un service qui tient les mots de passe (comptes locaux,
// annuaire), les comptes ne sont PAS des données du référentiel — les effacer ne
// les supprime pas côté service, et l'installation pouvait s'en trouver sans
// personne pour se connecter, le compte d'administration compris. On les garde
// donc dans ce cas (voir `comptesDuDeploiement`, src/lib/auth.js).
export async function clearAll({ garderComptes = false } = {}) {
  return db.clearAll({ garder: garderComptes ? ["users"] : [] });
}

export { db };
