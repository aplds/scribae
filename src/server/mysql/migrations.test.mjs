// ============================================================================
// Tests des migrations versionnées.
//
//   node --test          (ou: npm test)
//
// Le module est pur : on lui injecte une connexion bouchonnée (elle retient le
// SQL reçu), une lecture de fichier en mémoire et une empreinte simplifiée.
// Aucune base, aucun réseau.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { MIGRATIONS, TABLE_MIGRATIONS, appliquerMigrations, migrationsAppliquees } from "./migrations.mjs";

// Une connexion bouchon : elle retient chaque appel, et rend ce que le scénario
// lui a préparé pour la lecture des migrations appliquées.
function bouchon({ deja = [] } = {}) {
  const appels = [];
  const query = async (sql, params) => {
    appels.push({ sql: String(sql).replace(/\s+/g, " ").trim(), params: params || null });
    if (/^SELECT version, nom, checksum FROM sb_migrations$/i.test(String(sql).trim())) return [deja, null];
    return [[], null];
  };
  return { appels, query, ecritures: () => appels.filter((a) => /^INSERT INTO sb_migrations/i.test(a.sql)) };
}

const sha256 = (s) => "emp:" + String(s).length + ":" + String(s).slice(0, 8);
const lireFichier = async (nom) => ({ "schema.sql": "CREATE TABLE socle (id INT);", "002-ajout.sql": "ALTER TABLE socle ADD COLUMN nom TEXT;" }[nom] ?? "");

test("une base neuve reçoit le socle, et la migration est enregistrée", async () => {
  const b = bouchon();
  const journal = [];
  const r = await appliquerMigrations({ query: b.query, lireFichier, sha256, journal: (n, m) => journal.push([n, m]) });
  assert.deepEqual(r.appliquees, [1]);
  assert.equal(r.total, 1);
  // La table des migrations est créée avant toute lecture, puis le socle passe.
  assert.ok(b.appels[0].sql.startsWith("CREATE TABLE IF NOT EXISTS " + TABLE_MIGRATIONS));
  assert.ok(b.appels.some((a) => a.sql === "CREATE TABLE socle (id INT);"));
  const inscrit = b.ecritures();
  assert.equal(inscrit.length, 1);
  assert.deepEqual(inscrit[0].params, [1, "socle", sha256("CREATE TABLE socle (id INT);")]);
  assert.deepEqual(journal, [["appliquee", "Migration 1 — socle."]]);
});

test("une base à jour n'est pas rejouée", async () => {
  const b = bouchon({ deja: [{ version: 1, nom: "socle", checksum: sha256("CREATE TABLE socle (id INT);") }] });
  const journal = [];
  const r = await appliquerMigrations({ query: b.query, lireFichier, sha256, journal: (n, m) => journal.push([n, m]) });
  assert.deepEqual(r.appliquees, []);
  assert.equal(r.aJour, 1);
  assert.equal(b.ecritures().length, 0, "rien à réinscrire");
  assert.equal(b.appels.some((a) => a.sql === "CREATE TABLE socle (id INT);"), false, "le socle n'est pas rejoué");
  assert.deepEqual(journal, []);
});

test("une migration modifiée après coup est signalée, jamais rejouée", async () => {
  const b = bouchon({ deja: [{ version: 1, nom: "socle", checksum: "une-autre-empreinte" }] });
  const journal = [];
  await appliquerMigrations({ query: b.query, lireFichier, sha256, journal: (n, m) => journal.push([n, m]) });
  assert.equal(journal.length, 1);
  assert.equal(journal[0][0], "avertissement");
  assert.match(journal[0][1], /a changé depuis son application/);
  assert.equal(b.ecritures().length, 0);
  assert.equal(b.appels.some((a) => a.sql === "CREATE TABLE socle (id INT);"), false);
});

test("migrationsAppliquees lit la table après l'avoir créée", async () => {
  const b = bouchon({ deja: [{ version: 1, nom: "socle", checksum: "x" }] });
  const faites = await migrationsAppliquees(b.query);
  assert.equal(faites.size, 1);
  assert.equal(faites.get(1).nom, "socle");
  assert.ok(b.appels[0].sql.startsWith("CREATE TABLE IF NOT EXISTS " + TABLE_MIGRATIONS));
  assert.ok(b.appels[0].sql.includes("PRIMARY KEY (version)"));
});

test("la liste des migrations est ordonnée et sans version en double", () => {
  const versions = MIGRATIONS.map((m) => m.version);
  assert.deepEqual(versions, [...versions].sort((a, b) => a - b));
  assert.equal(new Set(versions).size, versions.length);
  assert.ok(MIGRATIONS.every((m) => m.nom && (m.fichier || m.sql)), "chaque migration dit son nom et son SQL");
});
