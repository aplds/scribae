// ============================================================================
// Tests du magasin MySQL — la file d'écriture et la reprise sur heurt.
//
//   node --test          (ou: npm test)
//
// Ce que l'on éprouve ici n'est PAS le rangement (les épreuves du magasin FICHIER
// en couvrent le contrat, identique pour les deux) : c'est ce que le magasin
// MySQL ajoute, et qui a coûté un « freeze » en production — la SÉRIALISATION des
// écritures d'une même collection, et la REPRISE quand la base a tout de même
// tranché un heurt de verrou. Le pilote est INJECTÉ (la base en mémoire de
// charge/faux-mysql.mjs) : ces épreuves tournent donc sans serveur de base de
// données, comme le reste du domaine.
//
// La panne d'origine : `INSERT IGNORE` prenait un verrou PARTAGÉ sur la ligne de
// `sb_collection`, que le `SELECT … FOR UPDATE` devait ensuite élever en
// EXCLUSIF ; deux transactions de la même collection se heurtaient, MySQL tuait
// l'une des deux (`ER_LOCK_DEADLOCK`), et la rafale saturait le pool jusqu'à
// donner l'impression que le service ne répondait plus. Les trois propriétés
// tenues ici sont celles qui rendent ce scénario impossible :
//   1. une seule transaction à la fois pour une collection donnée ;
//   2. un heurt de verrou est REJOUÉ, et l'écriture aboutit ;
//   3. la ligne de collection est créée par le geste qui prend le verrou
//      EXCLUSIF d'emblée (`ON DUPLICATE KEY UPDATE revision = revision`).
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { creerBase } from "../charge/faux-mysql.mjs";
import { creerMagasinMysql } from "./magasin-mysql.mjs";

// Le schéma minimal : ce que le magasin touche vraiment. Le socle du dépôt
// (schema.sql) ajoute des index et des vues dont ces épreuves n'ont pas besoin —
// la base en mémoire ne modélise de toute façon que l'existence des tables.
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS sb_collection (name VARCHAR(64) NOT NULL, revision BIGINT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (name));",
  "CREATE TABLE IF NOT EXISTS sb_record (collection VARCHAR(64) NOT NULL, id VARCHAR(191) NOT NULL, revision BIGINT UNSIGNED NOT NULL DEFAULT 1, ord INT NOT NULL DEFAULT 0, payload LONGTEXT NOT NULL, numero VARCHAR(64) NULL, statut VARCHAR(64) NULL, service_id VARCHAR(64) NULL, bureau_id VARCHAR(64) NULL, entity_id VARCHAR(64) NULL, kind VARCHAR(64) NULL, updated_by VARCHAR(191) NULL, PRIMARY KEY (collection, id));",
  "CREATE TABLE IF NOT EXISTS sb_journal (id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, collection VARCHAR(64) NOT NULL, record_id VARCHAR(191) NOT NULL, action VARCHAR(16) NOT NULL, revision BIGINT UNSIGNED NOT NULL DEFAULT 0, actor VARCHAR(191) NULL, remote_ip VARCHAR(64) NULL, PRIMARY KEY (id));",
  "CREATE TABLE IF NOT EXISTS sb_etat (name VARCHAR(64) NOT NULL, payload LONGTEXT NOT NULL, revision BIGINT UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (name));",
  "CREATE OR REPLACE VIEW v_collection AS SELECT 1;",
].join("\n");

const DB = { host: "127.0.0.1", port: 3306, user: "scriba", password: "", database: "scriba", timezone: "Z" };

async function basePrete(options = {}) {
  const base = creerBase(options);
  const cx = base.createConnection({ user: "scriba", password: "", multipleStatements: true });
  await cx.query(SCHEMA);
  return base;
}

const rec = (id, payload, rev = 0, ord = 0) => ({ id, rev, ord, payload });

// Une base qui COMPTE les transactions en vol : `getConnection` incrémente,
// `release` décrémente, et l'on retient le maximum. C'est la mesure exacte de ce
// que la file doit empêcher — deux transactions de la même collection ensemble.
function baseComptee(base, etat) {
  return {
    createConnection: (cfg) => base.createConnection(cfg),
    createPool: (cfg) => {
      const pool = base.createPool(cfg);
      const vrai = pool.getConnection.bind(pool);
      pool.getConnection = async () => {
        const conn = await vrai();
        etat.enVol += 1;
        etat.max = Math.max(etat.max, etat.enVol);
        const relacher = conn.release.bind(conn);
        conn.release = () => { etat.enVol -= 1; relacher(); };
        return conn;
      };
      return pool;
    },
  };
}

// Un heurt de verrou, tel que MySQL le rend : c'est le code qui décide de la
// reprise, et le message est celui du log de production.
function heurt() {
  const e = new Error("Deadlock found when trying to get lock; try restarting transaction");
  e.code = "ER_LOCK_DEADLOCK";
  e.errno = 1213;
  e.sqlState = "40001";
  return e;
}

test("dix écritures concurrentes de la MÊME collection se sérialisent", async () => {
  const base = await basePrete();
  const etat = { enVol: 0, max: 0 };
  const magasin = await creerMagasinMysql({ DB, mysql: baseComptee(base, etat) });
  await Promise.all(Array.from({ length: 10 }, (_, i) =>
    magasin.synchroniser({ collection: "presence", upserts: [rec("p" + i, { i })], trace: false })));
  assert.equal(etat.max, 1, "deux transactions de la même collection ne doivent jamais se chevaucher");
  assert.equal(await magasin.lireRevisionCollection("presence"), 10, "chaque écriture a sa révision");
  assert.equal((await magasin.lireCollection("presence")).length, 10, "aucun enregistrement perdu");
});

test("des collections distinctes continuent d'écrire en parallèle", async () => {
  const base = await basePrete();
  const etat = { enVol: 0, max: 0 };
  const magasin = await creerMagasinMysql({ DB, mysql: baseComptee(base, etat) });
  await Promise.all([
    magasin.synchroniser({ collection: "trames", upserts: [rec("t1", {})], trace: false }),
    magasin.synchroniser({ collection: "actes", upserts: [rec("a1", {})], trace: false }),
  ]);
  assert.equal(etat.max, 2, "la file est PAR collection : deux collections distinctes ne s'attendent pas");
});

test("un ER_LOCK_DEADLOCK est rejoué, et l'écriture aboutit", async () => {
  const base = await basePrete();
  let poison = 1;
  let heurts = 0;
  const mysql = {
    createConnection: (cfg) => base.createConnection(cfg),
    createPool: (cfg) => {
      const pool = base.createPool(cfg);
      const vrai = pool.getConnection.bind(pool);
      pool.getConnection = async () => {
        const conn = await vrai();
        const vraiQuery = conn.query.bind(conn);
        conn.query = async (sql, params) => {
          // Le heurt frappe la PREMIÈRE requête de la PREMIÈRE transaction
          // seulement — c'est exactement ce que fait un deadlock : la base
          // annule celle qu'elle a tuée, et la reprise repart d'une transaction
          // neuve.
          if (poison > 0) { poison -= 1; heurts += 1; throw heurt(); }
          return vraiQuery(sql, params);
        };
        return conn;
      };
      return pool;
    },
  };
  const magasin = await creerMagasinMysql({ DB, mysql });
  const r = await magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "Arrêté" })] });
  assert.equal(heurts, 1, "le heurt a bien eu lieu");
  assert.deepEqual(r.applied, [{ id: "t1", rev: 1 }], "l'écriture aboutit malgré le heurt");
  assert.equal(await magasin.lireRevisionCollection("trames"), 1);
});

test("une ERREUR ÉTRANGÈRE n'est pas rejouée : elle remonte", async () => {
  const base = await basePrete();
  let essais = 0;
  const mysql = {
    createConnection: (cfg) => base.createConnection(cfg),
    createPool: (cfg) => {
      const pool = base.createPool(cfg);
      const vrai = pool.getConnection.bind(pool);
      pool.getConnection = async () => {
        const conn = await vrai();
        conn.query = async () => {
          essais += 1;
          const e = new Error("Table 'scriba.sb_record' doesn't exist");
          e.code = "ER_NO_SUCH_TABLE";
          throw e;
        };
        return conn;
      };
      return pool;
    },
  };
  const magasin = await creerMagasinMysql({ DB, mysql });
  let echec = null;
  try { await magasin.synchroniser({ collection: "trames", upserts: [rec("t1", {})] }); }
  catch (e) { echec = e; }
  assert.ok(echec, "une erreur est attendue");
  assert.equal(echec.code, "ER_NO_SUCH_TABLE");
  assert.equal(essais, 1, "un défaut franc ne doit PAS être rejoué en boucle");
});

test("la ligne de collection est créée par le geste qui prend le verrou EXCLUSIF", async () => {
  const ordres = [];
  const base = await basePrete({ journaliser: (o) => ordres.push(o.sql) });
  const magasin = await creerMagasinMysql({ DB, mysql: base });
  await magasin.synchroniser({ collection: "trames", upserts: [rec("t1", {})] });
  const sql = ordres.join("\n");
  assert.doesNotMatch(sql, /INSERT IGNORE INTO sb_collection/i,
    "`INSERT IGNORE` prend un verrou PARTAGÉ qu'il faut ensuite élever : c'est la cause du deadlock");
  assert.match(sql, /INSERT INTO sb_collection \(name, revision\) VALUES \(\?, 0\) ON DUPLICATE KEY UPDATE revision = revision/);
});

test("le no-op `revision = revision` ne transforme pas la révision en texte", async () => {
  // Sans la reconnaissance du no-op, la base en mémoire écrirait la CHAÎNE
  // « revision » : la révision deviendrait illisible, et l'épreuve le dirait.
  const base = await basePrete();
  const magasin = await creerMagasinMysql({ DB, mysql: base });
  await magasin.synchroniser({ collection: "trames", upserts: [rec("t1", {})] });
  await magasin.synchroniser({ collection: "trames", upserts: [rec("t2", {})] });
  const revision = await magasin.lireRevisionCollection("trames");
  assert.equal(typeof revision, "number");
  assert.equal(revision, 2);
});
