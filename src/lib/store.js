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

import { seedConfig, seedTrames } from "./seed.js";
import { emptyConfig } from "./schema.js";
import { seedActes } from "./demo-actes.js";
import { seedUsers, isDemoUsers, syncDemoAccounts } from "./users.js";
import { emptyAuth } from "./auth.js";
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
export const SEED_VERSION = 25;

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
  if (!config || config.brand?.demo === false) return false;
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

// Feuilles de style de la démonstration (la charte graphique des décisions).
// Purement additif : un référentiel de démonstration qui n'en a pas encore les
// reçoit ; un référentiel réel — ou vidé volontairement — n'est pas touché et
// reste sur la feuille implicite dérivée de la marque (voir src/lib/styles.js).
function migrateDemoStyles(config) {
  if (!config || config.brand?.demo === false) return false;
  if (Array.isArray(config.styles) && config.styles.length) return false;
  config.styles = seedConfig().styles;
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
    config.circuits = config.brand?.demo === false ? [] : seedConfig().circuits;
    changed = true;
  }
  return changed;
}

function migrateDemoStyleOptions(config) {
  if (!config || config.brand?.demo === false) return false;
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

// La façade doit être initialisée (réglages lus, pilote choisi) avant toute
// lecture. `state.init()` s'en charge ; les accesseurs restent utilisables sans
// (le pilote par défaut est le stockage local).
export const initStorage = () => db.init();

export const storageAvailable = () => !db.isLocalMode() || db.localDriver.available();

export const loadConfig = () => db.read("config");
export const saveConfig = (c) => db.write("config", c);
export const loadTrames = () => db.read("trames");
export const saveTrames = (t) => db.write("trames", t);
export const loadActes = () => db.read("actes");
export const saveActes = (a) => db.write("actes", a);
export const loadUsers = () => db.read("users");
export const saveUsers = (u) => db.write("users", u);
export const loadSession = () => db.read("session");
export const saveSession = (s) => db.write("session", s);

export async function bootstrap() {
  let config = await loadConfig();
  let trames = await loadTrames();
  let actes = await loadActes();
  let users = await loadUsers();
  const session = await loadSession();
  const meta = (await db.read("meta")) || {};
  const firstRun = !config && !trames;
  // Le registre ne contient que des actes de démonstration (ou rien) : une mise
  // à niveau du jeu de démonstration peut alors remplacer trames et actes sans
  // risquer d'écraser un travail réel.
  const demoActes = (actes || []).every((a) => String(a.id).startsWith("acte-demo-"));
  if (!config) { config = seedConfig(); await saveConfig(config); }
  if (!trames) { trames = seedTrames(); await saveTrames(trames); }
  else if (meta.seedVersion !== SEED_VERSION && demoActes && trames.every((t) => String(t.id).startsWith("tpl-"))) {
    // jeu de démonstration obsolète et aucune donnée utilisateur : on remet à niveau
    trames = seedTrames();
    await saveTrames(trames);
    // le référentiel de démonstration (reconnaissable à son absence de « nameWithArt »)
    // est remis à niveau lui aussi tant qu'aucun acte réel n'existe
    if (!(config.entities || []).some((e) => e.nameWithArt)) {
      const keep = { brand: config.brand, vocab: config.vocab, numbering: config.numbering };
      const fresh = seedConfig();
      config = { ...fresh, brand: { ...fresh.brand, ...keep.brand }, vocab: { ...fresh.vocab, ...keep.vocab }, numbering: { ...fresh.numbering, ...keep.numbering } };
      await saveConfig(config);
    }
  }
  if (!actes) { actes = []; await saveActes(actes); }

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
  // Vocabulaire de modification (accord en genre / contraction), mentions des
  // actes individuels, feuilles de style : `|` (et non `||`) pour toutes les
  // tenter — chacune est idempotente.
  const migrated = migrateAmendmentVocab(config) | migrateDemoNonPublishable(config) | migrateDemoStyles(config)
    | migrateDemoStyleOptions(config) | migrateCircuits(config);
  if (migrated || configTouched) await saveConfig(config);

  // Actes de démonstration : posés (ou remis à niveau) à la version de jeu
  // courante, et uniquement si les trames sont celles de la démonstration et que
  // le registre ne contient que des actes de démonstration. Un registre réel —
  // ou enrichi à la main — n'est jamais touché.
  const demoRegistry = (trames || []).length && trames.every((t) => String(t.id).startsWith("tpl-"));
  if (meta.seedVersion !== SEED_VERSION && demoRegistry && demoActes && config.brand?.demo !== false) {
    try {
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

  if (!users || !Array.isArray(users) || !users.length) { users = seedUsers(config); await saveUsers(users); }  // Comptes de démonstration créés avant les services : on leur redonne le
  // rattachement de démonstration (services et bureaux).
  else if (isDemoUsers(users) && users.every((u) => u.memberships === undefined) && (config.services || []).length) {
    users = seedUsers(config);
    await saveUsers(users);
  }
  // Annuaire branché : les comptes de démonstration sont désactivés (et
  // réactivés lorsqu'on revient aux comptes de l'application). Le calcul ne
  // dépend que du mode d'authentification : il est donc idempotent, et il
  // s'applique à chaque démarrage, y compris après un import de données.
  const sync = syncDemoAccounts(config, users);
  if (sync.changed) { users = sync.users; await saveUsers(users); }
  if (meta.seedVersion !== SEED_VERSION) await db.write("meta", { ...meta, seedVersion: SEED_VERSION });
  return { config, trames, actes, users, session, firstRun };
}

export async function clearAll() {
  return db.clearAll();
}

export { db };
