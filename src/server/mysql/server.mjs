#!/usr/bin/env node
// ============================================================================
// Scribae — service de la collectivité.
//
// Un seul processus HTTP, deux familles de ressources, une seule base MySQL :
//
//   /v1/db/…      persistance partagée (référentiel, trames, actes, comptes) —
//                 synchronisation enregistrement par enregistrement, révisions,
//                 conflits, colonnes indexées, journal `sb_journal` ;
//   /v1/…         signature et publication (dépôt des actes, circuits de
//                 signature, notification du prestataire, publication, ELI) —
//                 le domaine de `actes.mjs`, dont l'état est conservé dans
//                 `sb_etat`.
//
// Les deux familles exigent une autorisation : un **jeton d'API** en mode
// « demo » (le fonctionnement historique : `Authorization: Bearer`, dont le
// service ne connaît que l'empreinte SHA-256), ou une **session** en mode
// « password » (identifiant + mot de passe, cookie `HttpOnly`, voir
// `comptes.mjs`). Le mode est choisi par `.env` (`AUTH_MODE`) : c'est le
// déploiement qui décide, pas le référentiel de l'application. Aucun secret
// n'est écrit dans ce fichier.
//
// Démarrage :
//   1. créer la base et l'utilisateur (voir README.md)
//   2. npm install
//   3. node server.mjs --migrate        (crée les tables : schema.sql)
//   4. node server.mjs                  (ou: npm start)
//
// Toute la configuration passe par des variables d'environnement (env.example).
// ============================================================================

import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { createActesApi } from "./actes.mjs";
import * as courriel from "./courriel.mjs";
import { loadState, saveState } from "./state.mjs";
import { createComptes, createStoreMysql, normaliserLogin, motDePasseFaible } from "./comptes.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVICE = "Scribae — service de la collectivité";
const SERVICE_VERSION = "1.0.0";

// ------------------------------------------------------------------ réglages
const env = (k, d = "") => (process.env[k] === undefined ? d : String(process.env[k]));
const num = (k, d) => (process.env[k] === undefined ? d : Number(process.env[k]) || d);

const PORT = num("PORT", 8080);
const HOST = env("HOST", "0.0.0.0");
const MAX_BODY = num("MAX_BODY", 8 * 1024 * 1024);       // 8 Mio par requête
const MAX_SYNC_RECORDS = num("MAX_SYNC_RECORDS", 4000);
const MAX_STATE_CHARS = num("MAX_STATE_CHARS", 8 * 1000 * 1000); // taille de l'état signature/publication
const MAX_DOC = num("MAX_DOC", 400000);                  // taille d'un acte déposé
const MAX_PUBLIES = num("MAX_PUBLIES", 40);
const MAX_SIGNATURES = num("MAX_SIGNATURES", 80);
const MAX_ACTES = num("MAX_ACTES", 80);
const RATE_WINDOW_MS = num("RATE_WINDOW_MS", 60000);
const RATE_MAX_WRITES = num("RATE_MAX_WRITES", 600);
const RATE_MAX_CONNEXIONS = num("RATE_MAX_CONNEXIONS", 30);
// Origines autorisées à appeler l'API depuis un navigateur. Le défaut est
// FERMÉ (aucune) : une API de service public n'a pas à être appelable en
// lecture de cookies depuis n'importe quel site. Le déploiement déclare
// l'origine de l'application (`CORS_ORIGINS=https://actes.exemple.fr`), et
// plusieurs origines se séparent par des virgules. `*` reste possible, mais il
// faut l'écrire — et il n'expose alors aucune session (pas de cookies).
const CORS_ORIGINS = env("CORS_ORIGINS", "").split(",").map((s) => s.trim()).filter(Boolean);

// --- Authentification --------------------------------------------------------
//   demo      la porte reste celle d'aujourd'hui : jeton d'API pour écrire, et
//             comptes de l'application choisis dans une liste (démonstration) ;
//   password  une VRAIE connexion : identifiant, mot de passe, session. Les
//             jetons d'API ne sont alors PLUS acceptés (le jeton est dans le
//             navigateur, donc public : il ne peut pas protéger une donnée).
// Voir src/server/mysql/comptes.mjs et src/server/README.md § « Comptes ».
const AUTH_MODE = env("AUTH_MODE", "demo").trim().toLowerCase();
const MOT_DE_PASSE = AUTH_MODE === "password";
const ADMIN_LOGIN = env("ADMIN_LOGIN", "admin").trim();
const ADMIN_PASSWORD = env("ADMIN_PASSWORD", "");
const ADMIN_NOM = env("ADMIN_NOM", "Administrateur").trim();
const ADMIN_EMAIL = env("ADMIN_EMAIL", "").trim();
const ADMIN_ENTITY = env("ADMIN_ENTITY", "").trim();
const SESSION_DAYS = num("SESSION_DAYS", 12);
const MDP_MIN = num("MDP_MIN_LONGUEUR", 12);
const SCRYPT_N = num("SCRYPT_N", 65536);
// `Secure` sur les cookies : à laisser à true en production (HTTPS). Sur un
// essai en clair (http://serveur:8080), le navigateur refuserait le cookie.
const COOKIE_SECURE = env("COOKIE_SECURE", "true").trim() !== "false";
// Les comptes de démonstration (choisis dans une liste, sans mot de passe).
// Par défaut : autorisés en mode « demo », éteints en mode « password ».
const DEMO_ACCOUNTS = env("DEMO_ACCOUNTS", MOT_DE_PASSE ? "false" : "true").trim() === "true";
// En mode « demo », DEMO_ACCOUNTS=false n'aurait aucun sens (plus personne ne
// pourrait entrer) : le jeu de démonstration reste autorisé, et on le dit.
const DEMO_EFFECTIF = MOT_DE_PASSE ? DEMO_ACCOUNTS : true;
// Les collections qui portent l'IDENTITÉ et les RÉGLAGES ne sont écrites que par
// un administrateur : sinon un compte ordinaire pourrait se donner des droits.
const COLLECTIONS_ADMIN = new Set(["users", "config"]);


const COLLECTIONS = ["config", "trames", "actes", "users", "meta", "journal", "presence"];
// Collections qui ne sont pas recopiées dans le journal technique : elles sont
// elles-mêmes un flux (présence des postes, journal d'audit de l'application).
// Les y inscrire produirait un bruit continu sans valeur d'audit.
const SILENT_COLLECTIONS = new Set(["presence", "journal"]);

const DB = {
  host: env("DB_HOST", "127.0.0.1"),
  port: num("DB_PORT", 3306),
  user: env("DB_USER", "scriba"),
  password: env("DB_PASSWORD", ""),
  database: env("DB_NAME", "scriba"),
  socketPath: env("DB_SOCKET", "") || undefined,
  charset: "utf8mb4",
  connectionLimit: num("DB_POOL", 8),
  multipleStatements: false,
};

// Rôles d'une clé d'API. Les quatre premiers forment une hiérarchie ; le
// `prestataire` est hors hiérarchie (notification de signature seulement).
const ROLES_CONNUES = ["administrateur", "editeur", "redacteur", "lecteur", "prestataire"];
const RANG_ROLE = { administrateur: 4, editeur: 3, redacteur: 2, lecteur: 1 };

// Jetons d'écriture : « libellé|rôle:empreinte_sha256 », « libellé:empreinte »
// ou « empreinte_sha256 ». Le rôle vaut « administrateur » à défaut : une clé de
// déploiement ouvre tout. Exemple : API_TOKENS="prestataire|prestataire:<hash>".
const TOKENS = env("API_TOKENS", "")
  .split(",").map((s) => s.trim()).filter(Boolean)
  .map((entry) => {
    const i = entry.lastIndexOf(":");
    const looksHashed = i > 0 && /^[0-9a-f]{64}$/i.test(entry.slice(i + 1));
    const tete = looksHashed ? entry.slice(0, i) : "jeton";
    const [label, role] = tete.split("|");
    return {
      label: label || "jeton",
      role: ROLES_CONNUES.includes(role) ? role : "administrateur",
      hash: (looksHashed ? entry.slice(i + 1) : entry).toLowerCase(),
    };
  })
  .filter((t) => /^[0-9a-f]{64}$/i.test(t.hash));

// Le rôle d'un compte : le plus fort de ses rôles.
const roleDeCompte = (compte) => {
  const roles = Array.isArray(compte && compte.roles) && compte.roles.length
    ? compte.roles
    : [compte && compte.role].filter(Boolean);
  return ROLES_CONNUES.find((r) => r !== "prestataire" && roles.includes(r)) || "lecteur";
};

const roleAutorise = (role, regle) => {
  if (!regle) return true;
  if (regle.exact) return regle.exact.includes(role);
  if (regle.min) return (RANG_ROLE[role] || 0) >= RANG_ROLE[regle.min];
  return true;
};

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

const pool = mysql.createPool(DB);

// ------------------------------------------------------------------ comptes
// Le port de cryptographie : c'est ICI, et nulle part ailleurs, que le service
// touche à `node:crypto`. Le domaine (comptes.mjs) ne connaît que ces six
// fonctions — ce qui le rend éprouvable sans base ni réseau (comptes.test.mjs).
const cryptoPort = {
  randomBytes: (n) => randomBytes(n),
  // `maxmem` : scrypt réclame 128·N·r octets ; on laisse de la marge.
  scrypt: (mdp, sel, { N, r, p, keylen }) => scryptSync(String(mdp), Buffer.from(sel), keylen, { N, r, p, maxmem: 256 * N * r }),
  sha256,
  b64: (octets) => Buffer.from(octets).toString("base64"),
  deb64: (texte) => new Uint8Array(Buffer.from(String(texte), "base64")),
  // Comparaison à TEMPS CONSTANT, pour les mots de passe comme pour les jetons.
  meme: (a, b) => {
    const x = typeof a === "string" ? Buffer.from(a, "utf8") : Buffer.from(a);
    const y = typeof b === "string" ? Buffer.from(b, "utf8") : Buffer.from(b);
    if (x.length !== y.length) return false;
    return x.length > 0 && timingSafeEqual(x, y);
  },
};

const comptes = createComptes({
  store: createStoreMysql(pool),
  crypto: cryptoPort,
  sessionJours: SESSION_DAYS,
  mdpMin: MDP_MIN,
  scryptParams: { N: SCRYPT_N, r: 8, p: 1 },
  demoAutorise: DEMO_EFFECTIF,
  sessionRequise: MOT_DE_PASSE,
});

// La session d'une requête HTTP (mode « mot de passe »), ou null. Toute la
// vérification — expiration, compte désactivé, compte de démonstration — vit
// dans `comptes.mjs` : le serveur HTTP ne fait que transporter le cookie.
async function sessionHTTP(req) {
  if (!MOT_DE_PASSE) return null;
  try { return await comptes.compteDeSession(comptes.jetonDeSession(req)); }
  catch (e) { console.error("[session]", e.message); return null; }
}

const refusSession = () => ({ status: 401, headers: {}, body: err("session_absente", "Connexion requise : ouvrez une session (identifiant et mot de passe).") });
const refusCsrf = () => ({ status: 403, headers: {}, body: err("csrf_invalide", "Jeton anti-CSRF absent ou incorrect : rechargez la page, puis réessayez.") });


// ------------------------------------------------------------------- réponses
function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const allow = CORS_ORIGINS.includes("*") ? "*" : (CORS_ORIGINS.includes(origin) ? origin : "");
  return {
    // Pas d'en-tête `access-control-allow-origin` quand l'origine n'est pas
    // autorisée : le navigateur bloque alors la réponse (le défaut « null »
    // laissait passer un appel depuis un site tiers).
    ...(allow ? { "access-control-allow-origin": allow } : {}),
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, idempotency-key",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function send(req, res, status, body, extra = {}) {
  // Le corps peut être une chaîne : certaines routes publiques servent du texte
  // (robots.txt, llms.txt), du XML ou du HTML, pas du JSON.
  const payload = body === null || body === undefined ? "" : (typeof body === "string" ? body : JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-service": SERVICE,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...corsHeaders(req),
    ...extra,
  });
  res.end(payload);
}

const err = (message, extra) => ({ erreur: message, ...(extra || {}) });

// --------------------------------------------------------------- limitations
const counters = new Map();
function tooMany(key, max, windowMs) {
  const now = Date.now();
  let e = counters.get(key);
  if (!e || now - e.t > windowMs) { e = { t: now, n: 0 }; counters.set(key, e); }
  e.n += 1;
  if (counters.size > 5000) for (const [k, v] of counters) if (now - v.t > windowMs) counters.delete(k);
  return e.n > max;
}

function authenticate(req) {
  if (!TOKENS.length) {
    return { ok: false, status: 503, message: "Le service n'a aucun jeton configuré : renseignez API_TOKENS avant d'autoriser les écritures.", code: "jeton_non_configure" };
  }
  const raw = String(req.headers.authorization || "").trim();
  const m = /^Bearer\s+(.+)$/.exec(raw);
  if (!m) return { ok: false, status: 401, message: "Jeton d'API absent. Ajoutez l'en-tête « Authorization: Bearer <jeton> ».", code: "jeton_absent" };
  const got = Buffer.from(sha256(m[1]), "hex");
  for (const t of TOKENS) {
    const want = Buffer.from(t.hash, "hex");
    if (want.length === got.length && timingSafeEqual(want, got)) return { ok: true, label: t.label, role: t.role };
  }
  return { ok: false, status: 403, message: "Jeton d'API invalide.", code: "jeton_invalide" };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > MAX_BODY) { reject(Object.assign(new Error("Corps trop volumineux"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const ipOf = (req) => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();

// ------------------------------------------------------------------- projections
// Recopie dans des colonnes indexées les champs utiles aux recherches. Aucune
// de ces colonnes n'est saisie à la main : elles découlent du document.
const str = (v) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, 64));

function projections(collection, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (collection === "actes") {
    return { numero: str(p.numero), statut: str(p.statut), service_id: str(p.serviceId), bureau_id: str(p.bureauId), entity_id: str(p.entityId), kind: str(p.nature) };
  }
  if (collection === "trames") {
    return { numero: null, statut: str(p.status), service_id: str(p.serviceId), bureau_id: str(p.bureauId), entity_id: null, kind: str(p.actTypeId) };
  }
  if (collection === "users") {
    const first = Array.isArray(p.memberships) && p.memberships[0] ? p.memberships[0].serviceId : null;
    return { numero: null, statut: str(p.role), service_id: str(first), bureau_id: null, entity_id: str(p.entityId), kind: null };
  }
  return { numero: null, statut: null, service_id: null, bureau_id: null, entity_id: null, kind: null };
}

// --------------------------------------------------------------------- lectures
async function currentRecord(conn, collection, id) {
  const [rows] = await conn.query("SELECT revision, ord, payload FROM sb_record WHERE collection = ? AND id = ?", [collection, id]);
  if (!rows.length) return null;
  let value = null;
  try { value = JSON.parse(rows[0].payload); } catch (e) { value = null; }
  return { revision: Number(rows[0].revision) || 0, ord: Number(rows[0].ord) || 0, payload: value };
}

async function listCollection(conn, name) {
  const [rows] = await conn.query(
    "SELECT id, revision, ord, payload FROM sb_record WHERE collection = ? ORDER BY ord ASC, id ASC",
    [name],
  );
  return rows.map((r) => {
    let payload = null;
    try { payload = JSON.parse(r.payload); } catch (e) { payload = null; }
    return { id: r.id, rev: Number(r.revision) || 0, ord: Number(r.ord) || 0, payload };
  });
}

async function collectionRevision(conn, name) {
  const [rows] = await conn.query("SELECT revision FROM sb_collection WHERE name = ?", [name]);
  return rows.length ? Number(rows[0].revision) || 0 : 0;
}

// ------------------------------------------------------------------ écritures
async function sync(collection, body, actor, ip, estAdmin = false) {
  const upserts = Array.isArray(body.upserts) ? body.upserts : [];
  const deletes = Array.isArray(body.deletes) ? body.deletes : [];
  const force = !!body.force;
  // `force` écrase sans contrôle de révision : geste de reprise réservé à
  // l'administration. Voir NC-II-004 (résidu) et P-17.
  if (force && !estAdmin) {
    return { status: 403, body: err("L'écrasement sans contrôle de révision (`force`) est réservé à l'administrateur.", { code: "force_reserve_admin" }) };
  }
  if (upserts.length + deletes.length > MAX_SYNC_RECORDS) {
    return { status: 413, body: err(`Trop d'enregistrements dans une même synchronisation (maximum ${MAX_SYNC_RECORDS}).`, { code: "trop_d_enregistrements" }) };
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("INSERT IGNORE INTO sb_collection (name, revision) VALUES (?, 0)", [collection]);
    const [[coll]] = await conn.query("SELECT revision FROM sb_collection WHERE name = ? FOR UPDATE", [collection]);
    let revision = Number(coll.revision) || 0;

    const applied = [];
    const conflicts = [];
    const journal = [];
    const trace = !SILENT_COLLECTIONS.has(collection);

    for (const u of upserts) {
      if (!u || u.id === undefined || u.id === null) continue;
      const id = String(u.id).slice(0, 191);
      const cur = await currentRecord(conn, collection, id);
      if (!force) {
        if (cur && cur.revision !== (Number(u.rev) || 0)) { conflicts.push({ id, rev: cur.revision, ord: cur.ord, payload: cur.payload }); continue; }
        if (!cur && u.rev) { conflicts.push({ id, deleted: true, rev: 0 }); continue; }
      }
      revision += 1;
      const p = projections(collection, u.payload);
      // `VALUES(colonne)` reprend la valeur proposée à l'INSERT : le procédé est
      // déprécié par MySQL 8.0.20 (mais toujours accepté) et pleinement supporté
      // par MariaDB — c'est ce qui rend la même requête valable sur les deux.
      await conn.query(
        `INSERT INTO sb_record (collection, id, revision, ord, payload, numero, statut, service_id, bureau_id, entity_id, kind, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE revision = VALUES(revision), ord = VALUES(ord), payload = VALUES(payload),
           numero = VALUES(numero), statut = VALUES(statut), service_id = VALUES(service_id),
           bureau_id = VALUES(bureau_id), entity_id = VALUES(entity_id), kind = VALUES(kind), updated_by = VALUES(updated_by)`,
        [collection, id, revision, Number(u.ord) || 0, JSON.stringify(u.payload === undefined ? null : u.payload),
         p.numero, p.statut, p.service_id, p.bureau_id, p.entity_id, p.kind, actor],
      );
      applied.push({ id, rev: revision });
      journal.push([collection, id, cur ? (force ? "force" : "update") : "insert", revision, actor, ip]);
    }

    for (const d of deletes) {
      if (!d || d.id === undefined || d.id === null) continue;
      const id = String(d.id).slice(0, 191);
      const cur = await currentRecord(conn, collection, id);
      if (!cur) continue;
      if (!force && cur.revision !== (Number(d.rev) || 0)) { conflicts.push({ id, rev: cur.revision, ord: cur.ord, payload: cur.payload }); continue; }
      await conn.query("DELETE FROM sb_record WHERE collection = ? AND id = ?", [collection, id]);
      revision += 1;
      applied.push({ id, rev: 0, deleted: true });
      journal.push([collection, id, "delete", revision, actor, ip]);
    }

    if (applied.length) {
      // La révision de la collection avance dans tous les cas ; seul le journal
      // technique est facultatif (collections-flux).
      await conn.query("UPDATE sb_collection SET revision = ? WHERE name = ?", [revision, collection]);
      if (trace && journal.length) {
        await conn.query("INSERT INTO sb_journal (collection, record_id, action, revision, actor, remote_ip) VALUES ?", [journal]);
      }
    }
    await conn.commit();
    return { status: 200, body: { collection, revision, applied, conflicts } };
  } catch (e) {
    try { await conn.rollback(); } catch (e2) { /* rien à faire */ }
    throw e;
  } finally {
    conn.release();
  }
}

// --------------------------------------------------------------------- santé
async function health() {
  const [rows] = await pool.query("SELECT name, revision, enregistrements FROM v_collection");
  const byName = {};
  for (const r of rows) byName[r.name] = { records: Number(r.enregistrements) || 0, revision: Number(r.revision) || 0 };
  for (const name of COLLECTIONS) if (!byName[name]) byName[name] = { records: 0, revision: 0 };
  const [[{ version }]] = await pool.query("SELECT VERSION() AS version");
  return {
    statut: "ok",
    service: SERVICE,
    version: SERVICE_VERSION,
    driver: "mysql",
    partagee: true,
    base: { hote: DB.host, port: DB.port, schema: DB.database, moteur: version },
    message: "Base de données MySQL / MariaDB disponible.",
    collections: byName,
  };
}

// ------------------------------------------------------------------ OpenAPI
function dbPaths() {
  const garde = MOT_DE_PASSE
    ? "En mode « mot de passe » (AUTH_MODE=password), les lectures comme les écritures exigent une session ouverte par /v1/auth/connexion ; les collections `users` et `config` ne sont écrites que par un administrateur."
    : "Les lectures sont publiques ; les écritures exigent un jeton d'API (Authorization: Bearer).";
  return {
    "/v1/db/health": { get: { operationId: "santeBase", summary: "État de la base de données", description: "Donne le pilote de persistance et le nombre d'enregistrements par collection (référentiel, trames, actes, comptes, métadonnées).", tags: ["Base de données"], responses: { 200: { description: "Base disponible" } } } },
    "/v1/db/collections/{collection}": { get: { operationId: "lireCollection", summary: "Lire une collection", description: `Renvoie tous les enregistrements d'une collection, chacun avec sa révision. ${garde}`, tags: ["Base de données"], parameters: [{ name: "collection", in: "path", required: true, schema: { type: "string", enum: COLLECTIONS } }], responses: { 200: { description: "Les enregistrements de la collection" }, 401: { description: "Session absente (mode mot de passe)" }, 404: { description: "Collection inconnue" } } } },
    "/v1/db/collections/{collection}/sync": { post: { operationId: "synchroniserCollection", summary: "Synchroniser une collection", description: `Applique des écritures et des suppressions enregistrement par enregistrement. Chaque écriture porte la révision connue du client : si le serveur en détient une autre, l'enregistrement est renvoyé en conflit au lieu d'être écrasé. ${garde}`, security: [{ bearerAuth: [] }], tags: ["Base de données"], parameters: [{ name: "collection", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { upserts: { type: "array", items: { type: "object" } }, deletes: { type: "array", items: { type: "object" } }, force: { type: "boolean", description: "Écrase sans contrôle de révision (reprise de données). Réservé à l'administrateur : toute autre clé ou session reçoit 403 `force_reserve_admin`." } } } } } }, responses: { 200: { description: "Synchronisation appliquée (avec la liste des conflits éventuels)" }, 401: { description: "Session ou jeton absent" }, 403: { description: "Session, jeton ou rôle insuffisant (ou `force` sans le rôle administrateur)" }, 413: { description: "Trop d'enregistrements" }, 507: { description: "Base pleine" } } } },
  };
}

// Le contrat des comptes, tel qu'il apparaît dans la description du service.
function authPaths() {
  const gardeSession = { 401: { description: "Session absente ou expirée" } };
  return {
    "/v1/auth/config": { get: { operationId: "modeAuthentification", summary: "Mode d'authentification du service", description: "Rend `{ auth: \"demo\" | \"password\", demo: booléen, motDePasseMin, sessionJours }` — et, quand le raccourci de démonstration est ouvert, la liste `demoComptes` (identifiant, nom, rôle) dont l'écran de connexion a besoin avant toute session. Le navigateur s'en sert au démarrage : c'est le déploiement (`.env`) qui décide, et non le référentiel de l'application.", tags: ["Comptes"], responses: { 200: { description: "Mode du service" } } } },
    "/v1/auth/connexion": { post: { operationId: "connexion", summary: "Ouvrir une session", description: "Vérifie l'identifiant et le mot de passe, puis pose deux cookies : la session (`HttpOnly`) et le jeton anti-CSRF. Message identique pour un identifiant inconnu et un mot de passe faux ; le compte se bloque progressivement après plusieurs échecs (429).", tags: ["Comptes"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["login", "motDePasse"], properties: { login: { type: "string" }, motDePasse: { type: "string", format: "password" } } } } } }, responses: { 200: { description: "Session ouverte" }, 401: { description: "Identifiants invalides" }, 429: { description: "Compte bloqué quelques instants" } } } },
    "/v1/auth/session": { get: { operationId: "sessionCourante", summary: "Session courante", description: "Rend le compte de la session ouverte, ou 401.", tags: ["Comptes"], responses: { 200: { description: "Compte de la session" }, ...gardeSession } } },
    "/v1/auth/deconnexion": { post: { operationId: "deconnexion", summary: "Fermer la session", description: "Efface la session en base et les cookies.", tags: ["Comptes"], responses: { 200: { description: "Session fermée" }, ...gardeSession } } },
    "/v1/auth/mot-de-passe": { post: { operationId: "changerMotDePasse", summary: "Changer son mot de passe", description: "Exige le mot de passe actuel. Les autres sessions ne sont pas fermées (aucune session n'est privilégiée par rapport à une autre).", tags: ["Comptes"], responses: { 200: { description: "Mot de passe changé" }, 400: { description: "Mot de passe actuel incorrect" }, 422: { description: "Nouveau mot de passe trop faible" }, ...gardeSession } } },
    "/v1/auth/comptes": { get: { operationId: "etatComptes", summary: "État des mots de passe", description: "Pour chaque compte : mot de passe défini ou non, changement exigé, date, échecs, blocage. **Aucun dérivé n'est renvoyé.** Réservé au rôle administrateur.", tags: ["Comptes"], responses: { 200: { description: "État des comptes" }, 403: { description: "Rôle administrateur requis" }, ...gardeSession } } },
    "/v1/auth/comptes/{id}/mot-de-passe": {
      post: { operationId: "definirMotDePasse", summary: "Définir ou remettre un mot de passe", description: "Définit le mot de passe d'un compte, ou le REMET. Sans `motDePasse` dans le corps, le service en ENGENDRE un (16 caractères, à changer à la première connexion) et ne le rend qu'ici, une seule fois — c'est la remise d'un accès à un agent. Réservé au rôle administrateur.", tags: ["Comptes"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { motDePasse: { type: "string", format: "password" }, mustChange: { type: "boolean", description: "Exiger un changement à la première connexion (vrai par défaut pour un mot de passe choisi à la main)." } } } } } }, responses: { 200: { description: "Mot de passe défini (le mot de passe provisoire figure dans la réponse s'il a été engendré)" }, 404: { description: "Compte inconnu" }, 422: { description: "Mot de passe trop faible" }, 403: { description: "Rôle administrateur requis" }, ...gardeSession } },
      delete: { operationId: "retirerMotDePasse", summary: "Retirer le mot de passe d'un compte", description: "Le compte cesse de pouvoir ouvrir de session, et ses sessions ouvertes sont fermées. Le compte lui-même reste au référentiel. Réservé au rôle administrateur.", tags: ["Comptes"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Mot de passe retiré" }, 403: { description: "Rôle administrateur requis" }, 404: { description: "Compte inconnu" }, ...gardeSession } },
    },
  };
}

// ---------------------------------------------------------------- courriel
// Le contrat du service de courriel, tel qu'il apparaît dans la description.
function courrielPaths() {
  const garde = { 401: { description: "Session ou jeton absent" }, 403: { description: "Jeton anti-CSRF absent ou incorrect" } };
  return {
    "/v1/courriel": { get: { operationId: "etatCourriel", summary: "État du service de courriel", description: "Rend la configuration SMTP du déploiement — hôte, port, chiffrement, adresse d'expédition, envoi actif ou non — et les derniers envois tentés. **Aucun secret** : le mot de passe SMTP ne quitte jamais le serveur.", tags: ["Courriel"], responses: { 200: { description: "État du service et derniers envois" }, ...garde } } },
    "/v1/courriel/envoi": { post: { operationId: "envoyerCourriel", summary: "Envoyer un courriel de notification", description: "Envoie un message par le serveur SMTP de la collectivité, via `SMTP_*` du `.env`, et le consigne au journal `sb_courriel`. Le corps du message est fourni par l'application ; le service n'invente rien. Répond 502 quand le serveur SMTP refuse — le motif est alors rendu tel quel.", tags: ["Courriel"], security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["destinataires", "sujet"], properties: { evenement: { type: "string" }, acteId: { type: "string" }, cible: { type: "string" }, destinataires: { type: "array", items: { type: "object" } }, copie: { type: "array", items: { type: "string" } }, sujet: { type: "string" }, texte: { type: "string" }, html: { type: "string" }, expediteurNom: { type: "string" }, repondreA: { type: "string" } } } } } }, responses: { 200: { description: "Message remis au serveur SMTP" }, 422: { description: "Requête incomplète" }, 502: { description: "Le serveur SMTP a refusé" }, ...garde } } },
    "/v1/courriel/test": { post: { operationId: "testerCourriel", summary: "Envoyer un courriel de test", description: "Vérifie que le service joint bien le serveur SMTP : envoie un message d'essai aux destinataires indiqués, sans passer par la politique de notification de l'application.", tags: ["Courriel"], security: [{ bearerAuth: [] }], responses: { 200: { description: "Message d'essai remis au serveur SMTP" }, 422: { description: "Destinataires manquants" }, 502: { description: "Le serveur SMTP a refusé" }, ...garde } } },
  };
}

// La garde des routes de courriel : session en mode « mot de passe », jeton en
// mode « demo » — la même que celle du reste du service. Rend null si la requête
// est autorisée, sinon la réponse de refus.
async function gardeCourriel(req) {
  if (MOT_DE_PASSE) {
    const s = await sessionHTTP(req);
    if (!s) return refusSession();
    if (comptes.csrfObligatoire(req) && !comptes.csrfValide(req)) return refusCsrf();
    return null;
  }
  const a = authenticate(req);
  return a.ok ? null : { status: a.status, headers: {}, body: err(a.message, { code: a.code }) };
}

async function acteurDe(req) {
  if (MOT_DE_PASSE) { const s = await sessionHTTP(req); return (s && s.compte && (s.compte.login || s.compte.id)) || "session"; }
  const a = authenticate(req);
  return a.ok ? a.label : "";
}

// Une trace d'envoi au journal des courriels. Le corps du message n'est PAS
// conservé : seuls l'événement, les destinataires et le résultat.
async function journaliserCourriel({ evenement, acteId, cible, destinataires, sujet, envoye, motif, acteur, ip }) {
  await pool.query(
    "INSERT INTO sb_courriel (evenement, acte_id, cible, destinataires, sujet, envoye, motif, acteur, remote_ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    [String(evenement || "courriel").slice(0, 64), acteId || null, cible || null,
      (destinataires || []).map((d) => (d && d.courriel) || d).filter(Boolean).join(", ").slice(0, 2000) || null,
      String(sujet || "").slice(0, 255) || null, envoye ? 1 : 0, String(motif || "").slice(0, 500) || null, acteur || null, ip || null],
  );
}

async function derniersCourriels(n = 20) {
  const [rows] = await pool.query(
    "SELECT evenement, acte_id, cible, destinataires, sujet, envoye, motif, acteur, at FROM sb_courriel ORDER BY at DESC, id DESC LIMIT ?",
    [Math.max(1, Math.min(100, Number(n) || 20))],
  );
  return rows.map((r) => ({ ...r, envoye: r.envoye === 1 || r.envoye === true }));
}

// --------------------------------------------------------------------- routage
let api = null;   // renseigné au démarrage, après lecture de l'état

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const ip = ipOf(req);

  if (req.method === "OPTIONS") { send(req, res, 204, null); return; }

  if (pathname === "/" || pathname === "/v1" || pathname === "/v1/") {
    const doc = api.openapi();
    doc.paths = { ...doc.paths, ...dbPaths(), ...authPaths(), ...courrielPaths() };
    doc.paths = Object.fromEntries(Object.entries(doc.paths).sort((a, b) => a[0].localeCompare(b[0])));
    send(req, res, 200, doc);
    return;
  }

  // --- comptes et sessions : /v1/auth/… --------------------------------------
  // La porte des comptes répond AVANT tout le reste : c'est par elle que le
  // navigateur apprend le mode du service (voir `GET /v1/auth/config`) et ouvre
  // sa session. Elle n'exige donc aucune session, sauf pour ce qui la concerne
  // elle-même (`/v1/auth/session`, comptes, changement de mot de passe).
  if (pathname === "/v1/auth" || pathname.startsWith("/v1/auth/")) {
    if (pathname === "/v1/auth/config" && req.method === "GET") {
      send(req, res, 200, MOT_DE_PASSE
        ? await comptes.config()
        : { auth: "demo", demo: true, message: "Le service est en mode « comptes de l'application » (AUTH_MODE=demo)." });
      return;
    }
    if (!MOT_DE_PASSE) {
      send(req, res, 404, err("Le service est en mode « comptes de l'application » : aucune session n'est ouverte ici (AUTH_MODE=demo).", { code: "auth_desactivee" }));
      return;
    }
    if (tooMany("a:" + ip, RATE_MAX_CONNEXIONS, RATE_WINDOW_MS)) {
      send(req, res, 429, err("Trop de requêtes : ralentissez.", { code: "trop_de_requetes" }), { "retry-after": String(Math.ceil(RATE_WINDOW_MS / 1000)) });
      return;
    }
    let body = null;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      try {
        const raw = await readBody(req);
        body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        const status = e.status || 400;
        send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
        return;
      }
    }
    const out = await comptes.route({ method: req.method, path: pathname, headers: req.headers, body, ip }, { secure: COOKIE_SECURE, ip });
    send(req, res, out.status, out.body, out.headers || {});
    return;
  }

  if (pathname === "/v1/db/health" && req.method === "GET") {
    try {
      send(req, res, 200, await health());
    } catch (e) {
      // Le cas le plus fréquent d'une première installation : la base répond
      // mais le schéma n'existe pas encore.
      send(req, res, 503, err("La base de données n'est pas prête : " + e.message, {
        code: "base_indisponible",
        remede: "Vérifiez DB_HOST / DB_USER / DB_PASSWORD / DB_NAME, puis lancez « node server.mjs --migrate » pour créer les tables.",
      }));
    }
    return;
  }

  const mCol = /^\/v1\/db\/collections\/([A-Za-z]+)$/.exec(pathname);
  if (mCol && req.method === "GET") {
    const name = mCol[1];
    if (!COLLECTIONS.includes(name)) { send(req, res, 404, err("Collection inconnue : " + name, { code: "collection_inconnue" })); return; }
    // Mode « mot de passe » : les données ne se lisent qu'avec une session. Les
    // adresses PUBLIQUES (le recueil, /v1/publications…) ne passent pas par ici :
    // elles restent ouvertes à tous.
    if (MOT_DE_PASSE && !(await sessionHTTP(req))) {
      send(req, res, 401, refusSession().body);
      return;
    }
    try {
      const records = await listCollection(pool, name);
      const revision = await collectionRevision(pool, name);
      send(req, res, 200, { collection: name, revision, records });
    } catch (e) { send(req, res, 500, err("Lecture impossible : " + e.message, { code: "lecture_impossible" })); }
    return;
  }

  const mSync = /^\/v1\/db\/collections\/([A-Za-z]+)\/sync$/.exec(pathname);
  if (mSync && req.method === "POST") {
    const name = mSync[1];
    if (!COLLECTIONS.includes(name)) { send(req, res, 404, err("Collection inconnue : " + name, { code: "collection_inconnue" })); return; }
    if (tooMany("w:" + ip + ":" + name, RATE_MAX_WRITES, RATE_WINDOW_MS)) {
      send(req, res, 429, err("Trop d'écritures : ralentissez.", { code: "trop_de_requetes" }), { "retry-after": String(Math.ceil(RATE_WINDOW_MS / 1000)) });
      return;
    }
    // Autorisation : une SESSION en mode « mot de passe » (le jeton est public,
    // il ne peut pas protéger une donnée), un JETON en mode « demo » (le
    // fonctionnement historique). Un compte ordinaire n'écrit pas les
    // collections qui portent l'identité et les réglages.
    let acteur = "";
    let estAdmin = false;
    if (MOT_DE_PASSE) {
      const s = await sessionHTTP(req);
      if (!s) { send(req, res, 401, refusSession().body); return; }
      if (comptes.csrfObligatoire(req) && !comptes.csrfValide(req)) { send(req, res, 403, refusCsrf().body); return; }
      estAdmin = comptes.estAdmin(s.compte);
      if (COLLECTIONS_ADMIN.has(name) && !estAdmin) {
        send(req, res, 403, err(`Seul un administrateur écrit la collection « ${name} ».`, { code: "droit_requis" }));
        return;
      }
      acteur = s.compte.login || s.compte.id || "session";
    } else {
      const jeton = authenticate(req);
      if (!jeton.ok) { send(req, res, jeton.status, err(jeton.message, { code: jeton.code })); return; }
      acteur = jeton.label;
      estAdmin = jeton.role === "administrateur";
    }
    let body;
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      const status = e.status || 400;
      send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
      return;
    }
    try {
      const out = await sync(name, body || {}, acteur, ip, estAdmin);
      send(req, res, out.status, out.body);
    } catch (e) {
      console.error("[sync]", name, e);
      send(req, res, 500, err("Écriture impossible : " + e.message, { code: "ecriture_impossible" }));
    }
    return;
  }

  // --- courriel : le service parle au serveur SMTP de la collectivité --------
  // L'application n'a jamais accès au serveur SMTP : elle demande, le service
  // envoie. Ces routes exigent la même autorisation que le reste.
  if (pathname === "/v1/courriel" && req.method === "GET") {
    const refus = await gardeCourriel(req);
    if (refus) { send(req, res, refus.status, refus.body, refus.headers || {}); return; }
    let derniers = [];
    try { derniers = await derniersCourriels(20); }
    catch (e) { console.error("[courriel]", e.message); }
    send(req, res, 200, { ...courriel.etat(), derniers });
    return;
  }

  if ((pathname === "/v1/courriel/envoi" || pathname === "/v1/courriel/test") && req.method === "POST") {
    const refus = await gardeCourriel(req);
    if (refus) { send(req, res, refus.status, refus.body, refus.headers || {}); return; }
    if (tooMany("c:" + ip, RATE_MAX_WRITES, RATE_WINDOW_MS)) {
      send(req, res, 429, err("Trop de courriels en peu de temps : ralentissez.", { code: "trop_de_requetes" }), { "retry-after": "60" });
      return;
    }
    let body;
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      const status = e.status || 400;
      send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
      return;
    }
    const test = pathname.endsWith("/test");
    const destinataires = Array.isArray(body.destinataires) ? body.destinataires : [];
    if (!destinataires.length) {
      send(req, res, 422, err("Indiquez au moins un destinataire (`destinataires`).", { code: "destinataire_absent" }));
      return;
    }
    const resultat = test
      ? await courriel.tester({ destinataires, expediteurNom: body.expediteurNom, repondreA: body.repondreA })
      : await courriel.envoyer({
        destinataires, copie: body.copie, sujet: body.sujet, texte: body.texte, html: body.html,
        expediteurNom: body.expediteurNom, repondreA: body.repondreA,
      });
    const acteur = await acteurDe(req);
    try {
      await journaliserCourriel({
        evenement: test ? "test" : (body.evenement || "courriel"),
        acteId: body.acteId || null, cible: body.cible || null,
        destinataires, sujet: test ? "Test de configuration — Scribae" : body.sujet,
        envoye: resultat.envoye, motif: resultat.raison, acteur, ip,
      });
    } catch (e) { console.error("[courriel:journal]", e.message); }
    const envoi = ((resultat.trace || []).filter((x) => x.sens === ">").map((x) => x.ligne)).slice(0, 12);
    if (!resultat.envoye) {
      send(req, res, 502, err(resultat.raison || "Le message n'a pas été envoyé.", { code: "envoi_refuse", destinataires: destinataires.map((d) => (d && d.courriel) || d) }));
      return;
    }
    send(req, res, 200, {
      envoye: true, destinataires: resultat.destinataires, detail: resultat.detail || "",
      ms: resultat.ms || 0, dialogue: envoi,
    });
    return;
  }

  // --- signature et publication : le domaine de actes.mjs -------------------
  if (/^\/v1\//.test(pathname)) {
    let body = null;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      try {
        const raw = await readBody(req);
        body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        const status = e.status || 400;
        send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
        return;
      }
    }
    // Mode « mot de passe » : les actes déposés et les circuits de signature ne
    // sont ni publics ni « à jeton » — ce qui n'est pas encore publié au recueil
    // ne se lit qu'avec une session. Les publications, les identifiants ELI, le
    // recueil et la santé du service restent, eux, ouverts à tous.
    const session = await sessionHTTP(req);
    if (MOT_DE_PASSE && /^\/v1\/(actes|signatures)(\/|$)/.test(pathname) && !session) {
      send(req, res, 401, refusSession().body);
      return;
    }
    const request = { method: req.method, path: pathname + url.search, headers: req.headers, body, ip };
    const out = api.route(request, {
      authorize: (headers, regle) => {
        if (MOT_DE_PASSE) {
          if (!session) return { status: 401, headers: {}, body: refusSession().body };
          if (comptes.csrfObligatoire(request) && !comptes.csrfValide({ headers })) {
            return { status: 403, headers: {}, body: refusCsrf().body };
          }
          const role = roleDeCompte(session.compte);
          if (!roleAutorise(role, regle)) {
            return { status: 403, headers: {}, body: err("Rôle insuffisant pour cette opération (rôle du compte : « " + role + " »).", { code: "role_insuffisant", role }) };
          }
          return null;
        }
        const a = authenticate({ headers });
        if (!a.ok) return { status: a.status, headers: {}, body: err(a.message, { code: a.code }) };
        if (!roleAutorise(a.role, regle)) {
          return { status: 403, headers: {}, body: err("Cette clé d'API n'a pas le rôle requis (« " + a.role + " »).", { code: "role_insuffisant", role: a.role }) };
        }
        return null;
      },
      rate: (r) => tooMany("w:" + ip + ":" + pathname, RATE_MAX_WRITES, RATE_WINDOW_MS),
    });
    if (!out) { send(req, res, 404, err("Ressource inconnue : " + pathname, { code: "ressource_inconnue" })); return; }
    // L'état n'est écrit qu'après un changement effectif : une lecture ne touche
    // pas la base.
    const dirty = api.takeDirty();
    if (dirty) {
      try { await saveState(pool, dirty); }
      catch (e) {
        console.error("[etat]", e);
        send(req, res, 500, err("L'écriture de l'état a échoué : " + e.message, { code: "etat_non_ecrit" }));
        return;
      }
    }
    send(req, res, out.status, out.body, out.headers || {});
    return;
  }

  // --- le recueil ouvert : /robots.txt, /llms.txt, /sitemap.xml, /recueil… ----
  // Ces adresses sont celles du SITE, pas de l'API : elles sont servies par le
  // domaine du recueil (voir nginx.conf) et le domaine `actes.mjs` les tient,
  // puisqu'il détient les publications. Une lecture ne touche pas la base.
  if (req.method === "GET" || req.method === "HEAD") {
    const out = api.route({ method: req.method, path: pathname + url.search, headers: req.headers, body: null, ip }, {
      authorize: () => null,
      rate: () => false,
    });
    if (out) { send(req, res, out.status, out.body, out.headers || {}); return; }
  }

  send(req, res, 404, err("Ressource inconnue : " + pathname, { code: "ressource_inconnue" }));
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error("[http]", e);
    if (!res.headersSent) send(req, res, 500, err("Erreur interne du service.", { code: "erreur_interne" }));
    else res.end();
  });
});

// ------------------------------------------------------------------ migration
async function migrate() {
  const sql = await readFile(path.join(HERE, "schema.sql"), "utf8");
  const conn = await mysql.createConnection({ ...DB, multipleStatements: true });
  try {
    await conn.query(sql);
    console.log("Schéma appliqué (schema.sql).");
  } finally {
    await conn.end();
  }
}

// ------------------------------------------------------- comptes : amorçage
// L'administrateur du service est déclaré dans `.env`. Au PREMIER démarrage, il
// est créé au référentiel avec son mot de passe. Ensuite, `.env` ne le touche
// plus : changer le mot de passe se fait dans l'application (ou par la commande
// `--mot-de-passe`), et rien ne l'écrase au redémarrage.
const slug = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
function nomDe(complet) {
  const mots = String(complet || "").trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return { firstName: "", lastName: "" };
  if (mots.length === 1) return { firstName: mots[0], lastName: "" };
  return { firstName: mots[0], lastName: mots.slice(1).join(" ") };
}

async function amorcerAdmin() {
  const login = normaliserLogin(ADMIN_LOGIN);
  if (!login) {
    console.error("ADMIN_LOGIN est vide : aucun compte d'administration n'a été installé. Renseignez-le dans .env.");
    return null;
  }
  let compte = await comptes.lireCompteParLogin(login);
  if (!compte) {
    if (!ADMIN_PASSWORD) {
      console.error(`Aucun compte « ${login} » au référentiel, et ADMIN_PASSWORD n'est pas renseigné : rien n'a été créé.`);
      console.error(`Renseignez ADMIN_PASSWORD dans .env (au moins ${MDP_MIN} caractères), ou créez le compte depuis l'application.`);
      return null;
    }
    const faible = motDePasseFaible(login, ADMIN_PASSWORD, MDP_MIN);
    if (faible) { console.error("ADMIN_PASSWORD refusé : " + faible); return null; }
    const nom = nomDe(ADMIN_NOM);
    compte = {
      id: "u-" + (slug(login) || "admin"),
      civility: "", firstName: nom.firstName, lastName: nom.lastName,
      login, email: ADMIN_EMAIL, role: "administrateur", roles: ["administrateur"],
      entityId: ADMIN_ENTITY, service: "", personId: "", memberships: [],
      active: true, source: "local",
      createdAt: new Date().toISOString(), lastLogin: "",
    };
    // Le compte lui-même est écrit au référentiel (collection `users`), comme
    // s'il avait été créé depuis l'écran « Comptes et rôles ».
    await comptes.ecrireCompte(compte);
    const pose = await comptes.definirMotDePasse(compte.id, ADMIN_PASSWORD, { mustChange: false });
    if (!pose.ok) { console.error("Mot de passe du compte administrateur non posé : " + pose.message); return compte; }
    console.log(`Compte administrateur « ${login} » créé depuis .env (rôle administrateur, mot de passe d'ADMIN_PASSWORD).`);
    console.log("Changez ce mot de passe depuis l'application (menu du compte → mot de passe), puis retirez ADMIN_PASSWORD de .env.");
    return compte;
  }

  const etats = await comptes.etatComptes();
  const aMotDePasse = etats.some((c) => c.userId === compte.id);
  if (!aMotDePasse) {
    if (ADMIN_PASSWORD) {
      const pose = await comptes.definirMotDePasse(compte.id, ADMIN_PASSWORD, { mustChange: false });
      if (pose.ok) console.log(`Mot de passe d'ADMIN_PASSWORD posé sur le compte « ${login} ».`);
      else console.error("Mot de passe non posé : " + pose.message);
    } else {
      console.warn(`Le compte « ${login} » n'a pas de mot de passe et ADMIN_PASSWORD n'est pas renseigné : il ne peut pas se connecter.`);
      console.warn(`Posez-en un avec : printf '%s' "$MDP" | node server.mjs --mot-de-passe ${login}`);
    }
  }
  if (!comptes.estAdmin(compte)) {
    console.warn(`Le compte « ${login} » n'a plus le rôle administrateur (modifié depuis l'application) : .env n'y change rien.`);
  }
  return compte;
}

// Réinitialisation par la ligne de commande : le mot de passe est lu sur
// l'entrée standard, jamais dans les arguments — il ne doit pas rester dans
// l'historique du shell ni dans la liste des processus.
async function motDePasseCLI(login) {
  const l = normaliserLogin(login || "");
  if (!l) {
    console.error("Usage : node server.mjs --mot-de-passe <identifiant>   (le mot de passe est lu sur l'entrée standard)");
    process.exitCode = 1;
    return;
  }
  const compte = await comptes.lireCompteParLogin(l);
  if (!compte) { console.error(`Aucun compte « ${l} » au référentiel.`); process.exitCode = 1; return; }
  let mdp = "";
  try { mdp = String(readFileSync(0, "utf8")).replace(/\r?\n$/, ""); } catch (e) { mdp = ""; }
  if (!mdp) {
    console.error("Aucun mot de passe lu sur l'entrée standard.");
    console.error(`Exemple : printf '%s' "$MDP" | node server.mjs --mot-de-passe ${l}`);
    process.exitCode = 1;
    return;
  }
  const r = await comptes.definirMotDePasse(compte.id, mdp, { mustChange: false });
  if (!r.ok) { console.error(r.message); process.exitCode = 1; return; }
  console.log(`Mot de passe défini pour « ${l} » (ses sessions ouvertes restent valides).`);
}

// -------------------------------------------------------------------- démarrage
async function main() {
  if (process.argv.includes("--migrate")) {
    await migrate();
    await pool.end();
    return;
  }
  const iMdp = process.argv.indexOf("--mot-de-passe");
  if (iMdp >= 0) {
    await motDePasseCLI(process.argv[iMdp + 1]);
    await pool.end();
    return;
  }
  if (env("AUTO_MIGRATE", "false") === "true") {
    try { await migrate(); } catch (e) { console.error("Migration automatique impossible :", e.message); }
  }
  try {
    const h = await health();
    console.log(`Base « ${h.base.schema} » joignable (${h.base.moteur}).`);
  } catch (e) {
    console.error("La base ne répond pas encore :", e.message);
    console.error("Vérifiez DB_HOST / DB_USER / DB_PASSWORD / DB_NAME, puis lancez « node server.mjs --migrate ».");
  }
  const state = await loadState(pool);
  api = createActesApi({
    state,
    sha256,
    save: (json) => json.length <= MAX_STATE_CHARS,
    maxDoc: MAX_DOC, maxPublies: MAX_PUBLIES, maxSignatures: MAX_SIGNATURES, maxActes: MAX_ACTES,
  });
  console.log(`État du service : ${Object.keys(state.actes).length} acte(s), ${Object.keys(state.signatures).length} circuit(s), ${Object.keys(state.publies).length} publication(s).`);
  const etatCourriel = courriel.etat();
  console.log(etatCourriel.disponible
    ? `Courriel : notifications actives — ${etatCourriel.hote}:${etatCourriel.port} (${etatCourriel.securise}), expéditeur ${etatCourriel.expediteur}${etatCourriel.authentifie ? ", authentifié" : ", sans authentification"}.`
    : `Courriel : envoi inactif — ${etatCourriel.raison}`);
  if (MOT_DE_PASSE) {
    console.log("Authentification : comptes locaux (mot de passe). Les jetons d'API ne sont PAS acceptés dans ce mode.");
    if (DEMO_EFFECTIF) {
      console.warn("DEMO_ACCOUNTS=true : les comptes de démonstration peuvent ouvrir une session sans mot de passe. À éteindre en service.");
    }
    try { await amorcerAdmin(); }
    catch (e) { console.error("Amorçage du compte administrateur impossible :", e.message); }
  } else {
    if (!TOKENS.length) console.warn("ATTENTION : aucun jeton dans API_TOKENS — toutes les écritures seront refusées (503).");
    if (!DEMO_ACCOUNTS) console.warn("AUTH_MODE=demo avec DEMO_ACCOUNTS=false : personne ne pourrait se connecter ; le jeu de démonstration reste autorisé (DEMO_ACCOUNTS n'a de sens qu'avec AUTH_MODE=password).");
  }
  server.listen(PORT, HOST, () => {
    console.log(`${SERVICE} à l'écoute sur http://${HOST}:${PORT}`);
    console.log(`Collections : ${COLLECTIONS.join(", ")}`);
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log("\nArrêt…");
    server.close(async () => { try { await pool.end(); } catch (e) {} process.exit(0); });
    setTimeout(() => process.exit(0), 3000);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
