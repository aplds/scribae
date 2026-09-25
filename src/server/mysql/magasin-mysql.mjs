// ============================================================================
// LE MAGASIN MySQL / MariaDB.
//
// C'est le rangement historique du service : les collections dans `sb_record`
// (une ligne par enregistrement, colonnes indexées, révisions), l'état de
// signature/publication dans `sb_etat`, le journal technique dans `sb_journal`,
// la trace des courriels dans `sb_courriel`, les comptes et les sessions dans
// `sb_record` (collection « users »), `sb_motdepasse` et `sb_session`. Rien de
// ce fichier ne change ce rangement : il ne fait que le présenter sous le
// contrat du magasin (voir magasin.mjs), au même titre que le magasin FICHIER.
//
// `mysql2` est importé DYNAMIQUEMENT, à la création du magasin, et non au
// chargement du module : une installation `STOCKAGE=fichier` n'a alors pas
// besoin de charger le pilote de base de données, ni de s'en soucier.
//
// Le module n'importe NI `node:path` NI `node:url` en tête de fichier (seul
// `node:fs/promises` l'est) : `preparer()` les charge elle-même, le moment venu.
// C'est ce qui le rend importable par le harnais d'épreuves du navigateur (qui
// n'a ni l'un ni l'autre), exactement comme magasin-fichier.mjs.
//
// Le pool est créé ICI et nulle part ailleurs. `fermer()` le referme — c'est ce
// que fait le service à l'arrêt, et les commandes de ligne de commande en
// sortant.
// ============================================================================

import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadState, saveState } from "./state.mjs";
import { createStoreMysql } from "./comptes.mjs";
import { appliquerMigrations } from "./migrations.mjs";
import { sqlCompteApplicatif } from "./compte-base.mjs";
import { synchroniser as synchroniserCommun } from "./magasin.mjs";

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

// ------------------------------------------------------- écritures concurrentes
// LE PROBLÈME. Deux écritures de la MÊME collection parties en même temps — deux
// postes, ou le battement de cœur d'un poste pendant qu'il renvoie sa file
// d'attente — se disputaient la LIGNE de `sb_collection`. `INSERT IGNORE` y pose
// un verrou PARTAGÉ pour tester l'unicité, puis `SELECT … FOR UPDATE` doit
// l'élever en EXCLUSIF : deux transactions qui montent en même temps s'attendent
// l'une l'autre, et MySQL tranche en tuant l'une des deux (`ER_LOCK_DEADLOCK`,
// errno 1213). La clé étrangère `sb_record → sb_collection` pose, elle aussi, des
// verrous PARTAGÉS sur cette même ligne à chaque écriture d'enregistrement, ce
// qui rend la rencontre fréquente. Une rafale de ces échecs sature le pool
// (`DB_POOL`, 8 connexions par défaut) : chaque requête attend un verrou, donc un
// fil, et le service finit par ne plus répondre — le « freeze » que l'on observe.
//
// DEUX REMÈDES, qui se complètent :
//   • une FILE PAR COLLECTION sérialise les écritures d'une même collection dans
//     CE processus : le verrou n'a plus de concurrent à départager ;
//   • une REPRISE sur heurt rejoue la transaction ENTIÈRE quand la base a tout de
//     même tranché (deux processus, ou une base partagée) : l'erreur des logs
//     devient un contretemps, pas une écriture perdue.
// La reprise est le filet ; la file est ce qui évite d'y tomber.
const HEURTS = new Set(["ER_LOCK_DEADLOCK", "ER_LOCK_WAIT_TIMEOUT"]);

// La file, UNE PAR COLLECTION : deux écritures de collections distinctes
// continuent de marcher en parallèle. Une entrée quitte la table quand sa tâche
// est finie — la table ne grandit donc pas avec le nombre de collections vues.
// (Même motif que magasin-fichier.mjs, où une file unique suffit : là, tout le
// rangement tient dans un seul dossier.)
const files = new Map();
function aLaQueue(nom, tache) {
  const precedent = files.get(nom) || Promise.resolve();
  const suite = precedent.then(tache, tache);
  const fin = suite.then(() => {}, () => {});
  files.set(nom, fin);
  fin.then(() => { if (files.get(nom) === fin) files.delete(nom); });
  return suite;
}

// Reprend une transaction heurtée. La pause est courte et HASARDÉE : deux
// transactions qui se heurtent en boucle doivent se désynchroniser, sinon elles
// se retrouvent au même instant et se heurtent de nouveau. On ne reprend QUE sur
// un heurt de verrou — toute autre erreur (colonne inconnue, base fermée) est un
// défaut franc, qu'il faut voir tout de suite.
async function avecReprise(tache, essais = 4) {
  for (let i = 0; ; i++) {
    try { return await tache(); }
    catch (e) {
      if (!HEURTS.has(e && e.code) || i >= essais) throw e;
      await new Promise((r) => setTimeout(r, 20 + Math.floor(Math.random() * 60) * (i + 1)));
    }
  }
}

// --------------------------------------------------------------------- fabrique
// `mysql` est INJECTABLE : le service passe `null` et le pilote est chargé
// dynamiquement, tandis que les épreuves donnent la base en mémoire de
// charge/faux-mysql.mjs. C'est ce qui permet d'éprouver la file d'écriture et la
// reprise sans installer de serveur de base de données.
export async function creerMagasinMysql({ DB, mysql: mysqlInjecte = null }) {
  const mysql = mysqlInjecte || (await import("mysql2/promise")).default;
  const pool = mysql.createPool(DB);

  // L'objet transactionnel : c'est lui que l'algorithme commun pilote. Toutes
  // ces primitives passent par la MÊME connexion (`conn`), donc dans la même
  // transaction — c'est ce qui garantit qu'une synchronisation ne laisse jamais
  // une révision à moitié écrite.
  const transaction = (conn) => ({
    async lireRevision(nom) {
      const [rows] = await conn.query("SELECT revision FROM sb_collection WHERE name = ? FOR UPDATE", [nom]);
      return rows.length ? Number(rows[0].revision) || 0 : 0;
    },
    async ecrireRevision(nom, n) {
      await conn.query("UPDATE sb_collection SET revision = ? WHERE name = ?", [n, nom]);
    },
    async lireEnregistrement(nom, id) {
      const [rows] = await conn.query("SELECT revision, ord, payload FROM sb_record WHERE collection = ? AND id = ?", [nom, id]);
      if (!rows.length) return null;
      let payload = null;
      try { payload = JSON.parse(rows[0].payload); } catch (e) { payload = null; }
      return { rev: Number(rows[0].revision) || 0, ord: Number(rows[0].ord) || 0, payload };
    },
    async ecrireEnregistrement(nom, { id, rev, ord, payload, projections: p, actor }) {
      // `VALUES(colonne)` reprend la valeur proposée à l'INSERT : le procédé est
      // déprécié par MySQL 8.0.20 (mais toujours accepté) et pleinement supporté
      // par MariaDB — c'est ce qui rend la même requête valable sur les deux.
      await conn.query(
        `INSERT INTO sb_record (collection, id, revision, ord, payload, numero, statut, service_id, bureau_id, entity_id, kind, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE revision = VALUES(revision), ord = VALUES(ord), payload = VALUES(payload),
           numero = VALUES(numero), statut = VALUES(statut), service_id = VALUES(service_id),
           bureau_id = VALUES(bureau_id), entity_id = VALUES(entity_id), kind = VALUES(kind), updated_by = VALUES(updated_by)`,
        [nom, id, rev, ord, JSON.stringify(payload), p.numero, p.statut, p.service_id, p.bureau_id, p.entity_id, p.kind, actor],
      );
    },
    async supprimerEnregistrement(nom, id) {
      await conn.query("DELETE FROM sb_record WHERE collection = ? AND id = ?", [nom, id]);
    },
    async journaliser(entrees) {
      await conn.query("INSERT INTO sb_journal (collection, record_id, action, revision, actor, remote_ip) VALUES ?", [
        entrees.map((e) => [e.collection, e.recordId, e.action, e.revision, e.actor, e.ip]),
      ]);
    },
  });

  return {
    type: "mysql",
    resume: {
      driver: "mysql",
      partagee: true,
      message: "Base de données MySQL / MariaDB disponible.",
      base: { hote: DB.host, port: DB.port, schema: DB.database },
    },
    // Le magasin des COMPTES : c'est le même `sb_record` que les collections
    // (collection « users »), plus les deux tables `sb_motdepasse` et
    // `sb_session`. La règle vit dans comptes.mjs.
    store: createStoreMysql(pool),

    async lireConfig() {
      const [rows] = await pool.query("SELECT payload FROM sb_record WHERE collection = 'config' AND id = 'self'");
      if (!rows.length) return null;
      try { return JSON.parse(rows[0].payload); } catch (e) { return null; }
    },

    async lireEtat() {
      let degrade = false;
      const etat = await loadState(pool, { onDegrade: () => { degrade = true; } });
      return { etat, degrade };
    },

    async ecrireEtat(json) {
      await saveState(pool, json);
      return true;
    },

    async lireCollection(nom) {
      const [rows] = await pool.query(
        "SELECT id, revision, ord, payload FROM sb_record WHERE collection = ? ORDER BY ord ASC, id ASC",
        [nom],
      );
      return rows.map((r) => {
        let payload = null;
        try { payload = JSON.parse(r.payload); } catch (e) { payload = null; }
        return { id: r.id, rev: Number(r.revision) || 0, ord: Number(r.ord) || 0, payload };
      });
    },

    async lireRevisionCollection(nom) {
      const [rows] = await pool.query("SELECT revision FROM sb_collection WHERE name = ?", [nom]);
      return rows.length ? Number(rows[0].revision) || 0 : 0;
    },

    async synchroniser(opts) {
      // File par collection, puis reprise : voir le commentaire des deux
      // mécanismes en tête de fichier. La transaction est rejouée ENTIÈRE
      // (connexion, `beginTransaction`, synchronisation, `commit`) : une
      // transaction heurtée a été annulée par la base, et rien de ce qu'elle a
      // fait ne subsiste.
      return aLaQueue(opts.collection, () => avecReprise(async () => {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          // ON DUPLICATE KEY UPDATE — et NON `INSERT IGNORE`. Les deux créent la
          // ligne de la collection si elle manque, mais `INSERT IGNORE` commence
          // par un verrou PARTAGÉ (contrôle d'unicité) que le `SELECT … FOR UPDATE`
          // qui suit doit élever en EXCLUSIF : deux transactions qui montent en
          // même temps se heurtent de plein fouet. `ON DUPLICATE KEY UPDATE`
          // prend d'emblée le verrou EXCLUSIF, et l'affectation `revision =
          // revision` est le moyen explicite de ne RIEN changer sur une ligne
          // existante (MySQL accepte le no-op, et c'est cette forme, avec le
          // nom de colonne nu de part et d'autre, qui reste valable sur MySQL
          // comme sur MariaDB — voir charge/faux-mysql.mjs, qui l'interprète).
          await conn.query(
            "INSERT INTO sb_collection (name, revision) VALUES (?, 0) ON DUPLICATE KEY UPDATE revision = revision",
            [opts.collection],
          );
          const r = await synchroniserCommun(transaction(conn), opts);
          await conn.commit();
          return r;
        } catch (e) {
          try { await conn.rollback(); } catch (e2) { /* rien à faire */ }
          throw e;
        } finally {
          conn.release();
        }
      }));
    },

    async sante() {
      const [rows] = await pool.query("SELECT name, revision, enregistrements FROM v_collection");
      const collections = {};
      for (const r of rows) collections[r.name] = { records: Number(r.enregistrements) || 0, revision: Number(r.revision) || 0 };
      const [[{ version }]] = await pool.query("SELECT VERSION() AS version");
      return { moteur: version, collections };
    },

    async journaliserCourriel({ evenement, acteId, cible, destinataires, sujet, envoye, motif, acteur, ip }) {
      await pool.query(
        "INSERT INTO sb_courriel (evenement, acte_id, cible, destinataires, sujet, envoye, motif, acteur, remote_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [String(evenement || "courriel").slice(0, 64), acteId || null, cible || null,
          (destinataires || []).map((d) => (d && d.courriel) || d).filter(Boolean).join(", ").slice(0, 2000) || null,
          String(sujet || "").slice(0, 255) || null, envoye ? 1 : 0, String(motif || "").slice(0, 500) || null, acteur || null, ip || null],
      );
    },

    async derniersCourriels(n = 20) {
      const [rows] = await pool.query(
        "SELECT evenement, acte_id, cible, destinataires, sujet, envoye, motif, acteur, at FROM sb_courriel ORDER BY at DESC, id DESC LIMIT ?",
        [Math.max(1, Math.min(100, Number(n) || 20))],
      );
      return rows.map((r) => ({ ...r, envoye: r.envoye === 1 || r.envoye === true }));
    },

    // Le SCHÉMA, appliqué par MIGRATIONS VERSIONNÉES (voir migrations.mjs). Le
    // socle (`schema.sql`) ne contient que des `CREATE TABLE IF NOT EXISTS` et
    // des vues : l'appliquer à une base en service ne détruit rien, et c'est ce
    // qui rend le geste répétable.
    //
    // `node:path` et `node:url` sont chargés ICI, et non en tête de fichier : le
    // magasin reste ainsi importable par le harnais d'épreuves du navigateur
    // (qui n'a ni l'un ni l'autre), exactement comme magasin-fichier.mjs. Le
    // service, lui, les a bien.
    async preparer(journal = () => {}) {
      const path = (await import("node:path")).default;
      const { fileURLToPath } = (await import("node:url")).default;
      const HERE = path.dirname(fileURLToPath(import.meta.url));
      const conn = await mysql.createConnection({ ...DB, multipleStatements: true });
      try {
        return await appliquerMigrations({
          query: (sql, params) => conn.query(sql, params),
          lireFichier: (nom) => readFile(path.join(HERE, nom), "utf8"),
          sha256,
          journal,
        });
      } finally {
        await conn.end();
      }
    },

    // LE COMPTE APPLICATIF SUIT LE `.env` : c'est le SEUL endroit du logiciel qui
    // parle à la base en ROOT (le mot de passe root est lu ici, et n'est ni
    // journalisé, ni transmis). MariaDB ne crée son compte qu'au PREMIER
    // démarrage d'un dossier de données VIERGE : changer `DB_PASSWORD` ensuite ne
    // change plus rien en base, et le service se voit refuser l'accès alors que
    // le `.env` est correct — c'est la panne d'installation la plus fréquente.
    // Voir server.mjs, qui porte les messages, et compte-base.mjs, qui construit
    // les ordres SQL.
    async reconcilier({ motDePasseRoot }) {
      if (!motDePasseRoot) return { fait: false, motif: "DB_ROOT_PASSWORD est vide — alignement impossible. Renseignez-le (il est dans le .env du déploiement), ou alignez le compte à la main." };
      if (!DB.password) return { fait: false, motif: "DB_PASSWORD est vide — refus d'inscrire un mot de passe vide sur le compte de la base." };
      const conn = await mysql.createConnection({
        host: DB.host, port: DB.port, socketPath: DB.socketPath,
        user: "root", password: motDePasseRoot,
        charset: DB.charset, multipleStatements: true, timezone: DB.timezone,
      });
      try {
        await conn.query(sqlCompteApplicatif({ base: DB.database, utilisateur: DB.user, motDePasse: DB.password }));
      } finally {
        await conn.end();
      }
      let schemaApplication = true;
      try {
        await this.preparer();
      } catch (e) {
        schemaApplication = false;
        console.error("Schéma non appliqué :", e.message);
      }
      return { fait: true, schemaApplication };
    },

    async fermer() {
      try { await pool.end(); } catch (e) { /* déjà fermé */ }
    },
  };
}
