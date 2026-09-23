// ============================================================================
// Tests de l'outil de charge — modules PURS seulement.
//
// Ce qui se vérifie ici est ce qui doit rester juste sans réseau : la base en
// mémoire (son interprétation des ordres du service), les profils de charge
// (leurs pondérations, leurs écritures), les statistiques (centiles, alertes) et
// le moteur (concurrence, cadence du fond, agrégation). Le client HTTP et la
// commande, eux, ne se testent qu'en vrai — c'est leur nature.
// ============================================================================

import test from "node:test";
import assert from "node:assert";
import { creerBase } from "./faux-mysql.mjs";
import { mulberry32, planDepuisSpec, effectifTotal, tirerEtapes, etapesAgent, fondAgent, PROFILS } from "./profils.mjs";
import { centile, resumer, creerAgregat, noter, alertes, rapportMarkdown } from "./statistiques.mjs";
import { lancerCharge } from "./moteur.mjs";

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS sb_collection (name VARCHAR(64) NOT NULL, revision BIGINT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (name));",
  "CREATE TABLE IF NOT EXISTS sb_record (collection VARCHAR(64) NOT NULL, id VARCHAR(191) NOT NULL, revision BIGINT UNSIGNED NOT NULL DEFAULT 1, ord INT NOT NULL DEFAULT 0, payload LONGTEXT NOT NULL, numero VARCHAR(64) NULL, statut VARCHAR(64) NULL, service_id VARCHAR(64) NULL, bureau_id VARCHAR(64) NULL, entity_id VARCHAR(64) NULL, kind VARCHAR(64) NULL, updated_by VARCHAR(191) NULL, PRIMARY KEY (collection, id));",
  "CREATE TABLE IF NOT EXISTS sb_journal (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, collection VARCHAR(64) NOT NULL, record_id VARCHAR(191) NOT NULL, action VARCHAR(16) NOT NULL, revision BIGINT UNSIGNED NOT NULL DEFAULT 0, actor VARCHAR(191) NULL, remote_ip VARCHAR(64) NULL, PRIMARY KEY (id));",
  "CREATE TABLE IF NOT EXISTS sb_etat (name VARCHAR(64) NOT NULL, payload LONGTEXT NOT NULL, revision BIGINT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (name));",
  "CREATE TABLE IF NOT EXISTS sb_motdepasse (user_id VARCHAR(191) NOT NULL, hash VARCHAR(255) NOT NULL, must_change TINYINT(1) NOT NULL DEFAULT 0, echecs INT NOT NULL DEFAULT 0, bloque_jusqua DATETIME(3) NULL, PRIMARY KEY (user_id));",
  "CREATE TABLE IF NOT EXISTS sb_session (token_hash CHAR(64) NOT NULL, user_id VARCHAR(191) NOT NULL, created_at DATETIME(3) NULL, last_seen_at DATETIME(3) NULL, expires_at DATETIME(3) NULL, remote_ip VARCHAR(64) NULL, user_agent VARCHAR(255) NULL, PRIMARY KEY (token_hash));",
  "CREATE TABLE IF NOT EXISTS sb_courriel (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, evenement VARCHAR(64) NOT NULL, acte_id VARCHAR(191) NULL, cible VARCHAR(191) NULL, destinataires TEXT NULL, sujet VARCHAR(255) NULL, envoye TINYINT(1) NOT NULL DEFAULT 0, motif VARCHAR(500) NULL, acteur VARCHAR(191) NULL, remote_ip VARCHAR(64) NULL, PRIMARY KEY (id));",
  "CREATE OR REPLACE VIEW v_collection AS SELECT 1;",
].join("\n");

async function basePrete(options = {}) {
  const base = creerBase(options);
  const cx = base.createConnection({ user: "scriba", password: "", multipleStatements: true });
  await cx.query(SCHEMA);
  return base;
}

// ------------------------------------------------------------- base en mémoire
test("base en mémoire : le schéma s'applique et les tables se lisent", async (t) => {
  const base = await basePrete();
  assert.deepEqual(base.tablesCreees().includes("sb_record"), true);
  assert.deepEqual(base.tablesCreees().includes("v_collection"), true);
});

test("base en mémoire : sans schéma, une table manquante est signalée", async (t) => {
  const base = creerBase();
  const pool = base.createPool({ user: "scriba", password: "" });
  let echec = null;
  try { await pool.query("SELECT payload FROM sb_record WHERE collection = 'users' AND id = ?", ["u1"]); }
  catch (e) { echec = e; }
  assert.ok(echec, "une erreur est attendue");
  assert.equal(echec.code, "ER_NO_SUCH_TABLE");
});

test("base en mémoire : un mot de passe refusé est refusé", async (t) => {
  const base = creerBase();
  base.definirMotDePasse("APP");
  let echec = null;
  try { base.createPool({ user: "scriba", password: "AUTRE" }); } catch (e) { echec = e; }
  assert.ok(echec);
  assert.equal(echec.code, "ER_ACCESS_DENIED_ERROR");
});

test("base en mémoire : ALTER USER aligne le compte applicatif", async (t) => {
  const base = creerBase();
  base.definirMotDePasse("ANCIEN");
  const root = base.createConnection({ user: "root", password: "ROOT", multipleStatements: true });
  await root.query("ALTER USER 'scriba'@'%' IDENTIFIED BY 'NOUVEAU'");
  const pool = base.createPool({ user: "scriba", password: "NOUVEAU" });
  const [rows] = await pool.query("SELECT VERSION() AS version");
  assert.equal(rows[0].version, "11.4.4-MariaDB");
});

test("base en mémoire : écriture puis relecture d'un enregistrement", async (t) => {
  const base = await basePrete();
  const pool = base.createPool({ user: "scriba", password: "" });
  await pool.query("INSERT IGNORE INTO sb_collection (name, revision) VALUES (?, 0)", ["actes"]);
  await pool.query("UPDATE sb_collection SET revision = ? WHERE name = ?", [3, "actes"]);
  await pool.query(
    `INSERT INTO sb_record (collection, id, revision, ord, payload, numero, statut, service_id, bureau_id, entity_id, kind, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE revision = VALUES(revision), ord = VALUES(ord), payload = VALUES(payload),
       numero = VALUES(numero), statut = VALUES(statut), service_id = VALUES(service_id),
       bureau_id = VALUES(bureau_id), entity_id = VALUES(entity_id), kind = VALUES(kind), updated_by = VALUES(updated_by)`,
    ["actes", "a1", 1, 0, JSON.stringify({ id: "a1", objet: "Premier" }), "2026-0001", "brouillon", null, null, null, "Arrêté", "charge"],
  );
  const [rows] = await pool.query("SELECT id, revision, ord, payload FROM sb_record WHERE collection = ? ORDER BY ord ASC, id ASC", ["actes"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, "a1");
  assert.deepEqual(JSON.parse(rows[0].payload).objet, "Premier");

  // La MISE À JOUR prend la même clé : l'enregistrement est remplacé, pas doublé.
  await pool.query(
    `INSERT INTO sb_record (collection, id, revision, ord, payload, numero, statut, service_id, bureau_id, entity_id, kind, updated_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE revision = VALUES(revision), ord = VALUES(ord), payload = VALUES(payload),
       numero = VALUES(numero), statut = VALUES(statut), service_id = VALUES(service_id),
       bureau_id = VALUES(bureau_id), entity_id = VALUES(entity_id), kind = VALUES(kind), updated_by = VALUES(updated_by)`,
    ["actes", "a1", 2, 0, JSON.stringify({ id: "a1", objet: "Second" }), "2026-0001", "brouillon", null, null, null, "Arrêté", "charge"],
  );
  const [apres] = await pool.query("SELECT revision, payload FROM sb_record WHERE collection = ? AND id = ?", ["actes", "a1"]);
  assert.equal(apres.length, 1);
  assert.equal(apres[0].revision, 2);
  assert.equal(JSON.parse(apres[0].payload).objet, "Second");
  const [coll] = await pool.query("SELECT revision FROM sb_collection WHERE name = ?", ["actes"]);
  assert.equal(coll[0].revision, 3);
});

test("base en mémoire : le journal s'écrit en lot", async (t) => {
  const base = await basePrete();
  const pool = base.createPool({ user: "scriba", password: "" });
  await pool.query("INSERT INTO sb_journal (collection, record_id, action, revision, actor, remote_ip) VALUES ?", [[
    ["actes", "a1", "insert", 1, "charge", "10.0.0.1"],
    ["actes", "a2", "insert", 2, "charge", "10.0.0.1"],
  ]]);
  assert.equal(base.lignes("sb_journal").length, 2);
  assert.equal(base.lignes("sb_journal")[0].collection, "actes");
});

test("base en mémoire : l'état du service s'écrit et sa révision avance", async (t) => {
  const base = await basePrete();
  const pool = base.createPool({ user: "scriba", password: "" });
  const ecrire = (p) => pool.query(
    `INSERT INTO sb_etat (name, payload, revision) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = revision + 1`,
    ["service", p],
  );
  await ecrire("{}");
  await ecrire('{"actes":1}');
  const [rows] = await pool.query("SELECT payload FROM sb_etat WHERE name = ?", ["service"]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload, '{"actes":1}');
  assert.equal(base.lignes("sb_etat")[0].revision, 2);
});

test("base en mémoire : une session s'ouvre, se relit et se supprime", async (t) => {
  const base = await basePrete();
  const pool = base.createPool({ user: "scriba", password: "" });
  await pool.query(
    "INSERT INTO sb_session (token_hash, user_id, created_at, last_seen_at, expires_at, remote_ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ["t1", "u1", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "2026-02-01T00:00:00.000Z", "10.0.0.1", "agent"],
  );
  const [ligne] = await pool.query("SELECT user_id, expires_at, last_seen_at FROM sb_session WHERE token_hash = ?", ["t1"]);
  assert.equal(ligne[0].user_id, "u1");
  await pool.query("UPDATE sb_session SET last_seen_at = ? WHERE token_hash = ?", ["2026-01-02T00:00:00.000Z", "t1"]);
  assert.equal(base.lignes("sb_session")[0].last_seen_at, "2026-01-02T00:00:00.000Z");
  await pool.query("DELETE FROM sb_session WHERE token_hash = ?", ["t1"]);
  assert.equal(base.lignes("sb_session").length, 0);
});

test("base en mémoire : les ordres sont comptés par table et par genre", async (t) => {
  const base = await basePrete();
  base.reinitialiserStats();
  const pool = base.createPool({ user: "scriba", password: "" });
  await pool.query("SELECT name, revision, enregistrements FROM v_collection");
  await pool.query("SELECT VERSION() AS version");
  const s = base.stats();
  assert.equal(s.ordres, 2);
  assert.equal(s.parTable.v_collection, 1);
  assert.equal(s.parGenre.lecture, 2);
});

// ----------------------------------------------------------------- les profils
test("profils : un plan de charge se lit et se compte", (t) => {
  const plan = planDepuisSpec("public=40,redacteur=8,administrateur=2");
  assert.equal(plan.length, 3);
  assert.equal(effectifTotal(plan), 50);
  assert.equal(plan[0].profil.id, "public");
});

test("profils : un profil inconnu est refusé, en le nommant", (t) => {
  assert.throws(() => planDepuisSpec("public=2,inexistant=1"), /inexistant/);
});

test("profils : les effectifs nuls ne pèsent rien", (t) => {
  assert.equal(effectifTotal(planDepuisSpec("public=0,lecteur=3")), 3);
});

test("profils : les sept profils existent et chacun a des étapes", (t) => {
  const ctx = { publications: [{ cle: "c1" }], elis: ["/eli/fr/ar/2026/1/x"], actes: [{ id: "a1", rev: 1, payload: {} }], trames: [], informations: [], config: [] };
  for (const p of PROFILS) {
    const etapes = p.etapes(ctx, { ecriture: "aucune" });
    assert.ok(etapes.length > 0, `profil ${p.id} sans étape`);
  }
});

test("profils : l'écriture n'apparaît qu'au niveau « pleine »", (t) => {
  const sans = etapesAgent("redacteur", { ecriture: "aucune" }).map((e) => e.nom);
  const flux = etapesAgent("redacteur", { ecriture: "flux" }).map((e) => e.nom);
  const pleine = etapesAgent("redacteur", { ecriture: "pleine" }).map((e) => e.nom);
  assert.equal(sans.includes("agent/sync-acte"), false);
  assert.equal(flux.includes("agent/sync-acte"), false);
  assert.equal(pleine.includes("agent/sync-acte"), true);
});

test("profils : le journal de service n'est lu que par l'administrateur", (t) => {
  const admin = etapesAgent("administrateur", { ecriture: "aucune" }).map((e) => e.nom);
  const autre = etapesAgent("lecteur", { ecriture: "aucune" }).map((e) => e.nom);
  assert.equal(admin.includes("agent/service-journal"), true);
  assert.equal(autre.includes("agent/service-journal"), false);
});

test("profils : le fond porte le battement et le sondage, à leurs périodes", (t) => {
  const fond = fondAgent();
  const battement = fond.find((f) => f.nom === "fond/battement");
  const sondage = fond.find((f) => f.nom === "fond/sondage");
  assert.equal(battement.periodeMs, 25000);
  assert.equal(sondage.periodeMs, 30000);
  assert.deepEqual(battement.etapes.map((e) => e.nom), ["fond/presence-lue", "fond/presence-ecrite"]);
});

test("profils : le tirage pondéré respecte les poids", (t) => {
  const alea = mulberry32(7);
  const etapes = [{ nom: "rare", poids: 1 }, { nom: "frequent", poids: 9 }];
  let rares = 0;
  for (let i = 0; i < 2000; i++) if (tirerEtapes(etapes, alea).nom === "rare") rares++;
  assert.ok(rares > 100 && rares < 350, `tirage déséquilibré : ${rares} rares sur 2000`);
});

test("profils : la même graine rejoue le même trafic", (t) => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const c = mulberry32(43);
  const suiteA = Array.from({ length: 5 }, () => a());
  const suiteB = Array.from({ length: 5 }, () => b());
  const suiteC = Array.from({ length: 5 }, () => c());
  assert.deepEqual(suiteA, suiteB);
  assert.notEqual(JSON.stringify(suiteA), JSON.stringify(suiteC));
});

// ------------------------------------------------------------- statistiques
test("statistiques : les centiles d'une suite connue", (t) => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(centile(v, 50), 50.5);
  assert.equal(centile(v, 99), 99.01);
  assert.equal(centile(v, 100), 100);
  assert.equal(centile([], 50), 0);
});

test("statistiques : le résumé d'une suite", (t) => {
  const r = resumer([10, 20, 30, 40, 1000]);
  assert.equal(r.n, 5);
  assert.equal(r.min, 10);
  assert.equal(r.max, 1000);
  assert.equal(r.p50, 30);
  assert.equal(r.moyenne, 220);
});

test("statistiques : le résumé tient sur un très grand nombre de mesures", (t) => {
  // Une campagne « pensée zéro » range des dizaines de milliers de durées dans un
  // même seau. L'étalement d'un tel tableau en arguments (`Math.min(…v)`) fait
  // sauter la pile : le résumé doit rester une boucle.
  const v = [];
  for (let i = 0; i < 120000; i++) v.push(i % 97);
  const r = resumer(v);
  assert.equal(r.n, 120000);
  assert.equal(r.min, 0);
  assert.equal(r.max, 96);
});

test("statistiques : l'agrégat range par étape, par profil et par code", (t) => {
  const a = creerAgregat();
  noter(a, { etape: "public/recueil", profil: "public", ms: 10, statut: 200, octets: 100 });
  noter(a, { etape: "public/recueil", profil: "public", ms: 30, statut: 200, octets: 100 });
  noter(a, { etape: "agent/session", profil: "lecteur", ms: 5, statut: 401, octets: 20 });
  assert.equal(a.total, 3);
  assert.equal(a.octets, 220);
  assert.equal(a.erreurs, 0);
  assert.equal(a.etapes.get("public/recueil").n, 2);
  assert.equal(a.etapes.get("agent/session").statuts.get("401"), 1);
  assert.equal(a.profils.get("lecteur").n, 1);
});

test("statistiques : un échec réseau est compté comme tel", (t) => {
  const a = creerAgregat();
  noter(a, { etape: "public/recueil", profil: "public", ms: 10, statut: 0, erreur: "connexion perdue" });
  assert.equal(a.erreurs, 1);
  assert.equal(a.etapes.get("public/recueil").statuts.get("réseau"), 1);
});

test("statistiques : les alertes repèrent les refus et les p99 trop longs", (t) => {
  const a = creerAgregat();
  // Neuf mesures sur dix sont rapides, une sur dix est lente : c'est ce qui met
  // le p99 au-dessus du seuil (un centile ne « voit » que le centième supérieur).
  for (let i = 0; i < 90; i++) noter(a, { etape: "lent", profil: "public", ms: 5, statut: 200 });
  for (let i = 0; i < 10; i++) noter(a, { etape: "lent", profil: "public", ms: 2000, statut: 200 });
  noter(a, { etape: "casse", profil: "public", ms: 4, statut: 500 });
  const al = alertes(a);
  assert.equal(al.some((x) => x.nom === "lent" && x.gravite === "latence"), true);
  assert.equal(al.some((x) => x.nom === "casse" && x.gravite === "erreur"), true);
  assert.equal(al[0].gravite, "erreur");
});

test("statistiques : le rapport Markdown porte ses sections", (t) => {
  const a = creerAgregat();
  for (let i = 0; i < 10; i++) noter(a, { etape: "public/recueil", profil: "public", ms: 12, statut: 200, octets: 512 });
  const md = rapportMarkdown({
    cible: "http://127.0.0.1:8099", debut: 0, fin: 1000, effectif: 4, agregat: a,
    sql: { ordres: 20, ms: 3, parTable: { sb_record: 12 }, parGenre: { lecture: 20 } },
    notes: ["campagne de test"],
  });
  assert.match(md, /# Étude de charge — Scribae/);
  assert.match(md, /public\/recueil/);
  assert.match(md, /## Latence par profil/);
  assert.match(md, /## Côté base de données/);
  assert.match(md, /campagne de test/);
  assert.match(md, /10 requêtes/);
});

// ------------------------------------------------------------------- le moteur
test("moteur : les postes jouent leurs étapes et le fond à sa cadence", async (t) => {
  // Horloge PAR PAS : chaque attente avance le temps d'une unité. Une horloge
  // partagée qui avancerait du délai demandé ferait dépendre le nombre de tours
  // de l'entrelacement des postes — la mesure ne serait plus reproductible.
  let horloge = 0;
  const appels = [];
  const profil = {
    id: "essai", session: false,
    etapes: () => [{ nom: "essai/lecture", construire: () => ({ method: "GET", chemin: "/x" }), apres: null, poids: 1 }],
    fond: () => [{ nom: "essai/fond", periodeMs: 30, etapes: [{ nom: "essai/battement", construire: () => ({ method: "GET", chemin: "/b" }), apres: null, poids: 1 }] }],
  };
  const r = await lancerCharge({
    plan: [{ profil, effectif: 3 }],
    contexte: {},
    requete: async () => { appels.push(true); return { status: 200, octets: 10 }; },
    dureeMs: 100,
    penseeMs: 10,
    maintenant: () => horloge,
    dormir: async () => { horloge += 1; },
  });
  assert.equal(r.effectif, 3);
  assert.equal(r.agregat.total, appels.length);
  assert.ok(r.agregat.total >= 60, `trop peu d'appels : ${r.agregat.total}`);
  assert.ok(r.agregat.etapes.get("essai/lecture").n >= 30, "chaque poste doit travailler");
  assert.ok(r.agregat.etapes.get("essai/battement").n >= 3, "le fond doit battre au moins trois fois");
});

test("moteur : une session qui échoue n'arrête pas les autres postes", async (t) => {
  let horloge = 0;
  const profil = {
    id: "agent", session: true,
    etapes: () => [{ nom: "agent/lecture", construire: () => ({ method: "GET", chemin: "/x" }), apres: null, poids: 1 }],
    fond: () => [],
  };
  const r = await lancerCharge({
    plan: [{ profil, effectif: 4 }],
    contexte: {},
    ouvrirPoste: async (poste) => { if (poste.index % 2 === 0) throw new Error("refus"); return {}; },
    requete: async () => ({ status: 200, octets: 1 }),
    dureeMs: 50,
    penseeMs: 10,
    maintenant: () => horloge,
    dormir: async () => { horloge += 1; },
  });
  const connexions = r.agregat.etapes.get("connexion/agent");
  assert.equal(connexions.n, 4);
  assert.equal(connexions.erreurs, 2);
  assert.ok(r.agregat.etapes.get("agent/lecture").n > 0, "les postes connectés doivent travailler");
});

// « Sans temps de pensée » ne veut pas dire « sans jamais rendre la main ». Un
// poste qui n'attend pas enchaîne des promesses déjà résolues : il garde la file
// des micro-tâches pleine et AUCUN minuteur ne s'exécute — pas même ceux du
// service mesuré. Ce test tient la propriété : avec `penseeMs: 0`, la boucle
// d'événements reprend la main entre deux gestes.
test("moteur : un poste sans temps de pensée rend tout de même la main", async () => {
  let horloge = 0;
  const profil = {
    id: "presse", session: false,
    etapes: () => [{ nom: "presse/lecture", construire: () => ({ method: "GET", chemin: "/x" }), apres: null, poids: 1 }],
    fond: () => [],
  };
  const r = await lancerCharge({
    plan: [{ profil, effectif: 5 }],
    contexte: {},
    requete: async () => ({ status: 200, octets: 1 }),
    dureeMs: 60,
    penseeMs: 0,
    maintenant: () => horloge,
    // Chaque attente, MÊME NULLE, doit passer par ici : c'est la preuve que le
    // poste a rendu la main. Une horloge qui n'avance pas garde le test borné.
    dormir: async (_ms) => { horloge += 1; },
  });
  assert.ok(r.agregat.total > 0);
  assert.ok(r.agregat.total <= 60 * 5 + 5, `trop de tours : ${r.agregat.total}`);
});
