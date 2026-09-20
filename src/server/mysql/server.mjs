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
// Les deux familles exigent `Authorization: Bearer <jeton>` pour écrire ; le
// service ne connaît que l'empreinte SHA-256 des jetons (`API_TOKENS`). Aucun
// secret n'est écrit dans ce fichier.
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
import { createHash, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { createActesApi } from "./actes.mjs";
import { loadState, saveState } from "./state.mjs";

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
const CORS_ORIGINS = env("CORS_ORIGINS", "*").split(",").map((s) => s.trim()).filter(Boolean);

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

// Jetons d'écriture : « libellé:empreinte_sha256 » ou « empreinte_sha256 ».
const TOKENS = env("API_TOKENS", "")
  .split(",").map((s) => s.trim()).filter(Boolean)
  .map((entry) => {
    const i = entry.lastIndexOf(":");
    const looksHashed = i > 0 && /^[0-9a-f]{64}$/i.test(entry.slice(i + 1));
    return looksHashed
      ? { label: entry.slice(0, i), hash: entry.slice(i + 1).toLowerCase() }
      : { label: "jeton", hash: entry.toLowerCase() };
  })
  .filter((t) => /^[0-9a-f]{64}$/i.test(t.hash));

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

const pool = mysql.createPool(DB);

// ------------------------------------------------------------------- réponses
function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const allow = CORS_ORIGINS.includes("*") ? "*" : (CORS_ORIGINS.includes(origin) ? origin : "");
  return {
    "access-control-allow-origin": allow || "null",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type, authorization, idempotency-key",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function send(req, res, status, body, extra = {}) {
  const payload = body === null || body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "x-service": SERVICE,
    "cache-control": "no-store",
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
    if (want.length === got.length && timingSafeEqual(want, got)) return { ok: true, label: t.label };
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
async function sync(collection, body, actor, ip) {
  const upserts = Array.isArray(body.upserts) ? body.upserts : [];
  const deletes = Array.isArray(body.deletes) ? body.deletes : [];
  const force = !!body.force;
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
  return {
    "/v1/db/health": { get: { operationId: "santeBase", summary: "État de la base de données", description: "Donne le pilote de persistance et le nombre d'enregistrements par collection (référentiel, trames, actes, comptes, métadonnées).", tags: ["Base de données"], responses: { 200: { description: "Base disponible" } } } },
    "/v1/db/collections/{collection}": { get: { operationId: "lireCollection", summary: "Lire une collection", description: "Renvoie tous les enregistrements d'une collection, chacun avec sa révision.", tags: ["Base de données"], parameters: [{ name: "collection", in: "path", required: true, schema: { type: "string", enum: COLLECTIONS } }], responses: { 200: { description: "Les enregistrements de la collection" }, 404: { description: "Collection inconnue" } } } },
    "/v1/db/collections/{collection}/sync": { post: { operationId: "synchroniserCollection", summary: "Synchroniser une collection", description: "Applique des écritures et des suppressions enregistrement par enregistrement. Chaque écriture porte la révision connue du client : si le serveur en détient une autre, l'enregistrement est renvoyé en conflit au lieu d'être écrasé.", security: [{ bearerAuth: [] }], tags: ["Base de données"], parameters: [{ name: "collection", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { upserts: { type: "array", items: { type: "object" } }, deletes: { type: "array", items: { type: "object" } }, force: { type: "boolean", description: "Écrase sans contrôle de révision (reprise de données par un administrateur)." } } } } } }, responses: { 200: { description: "Synchronisation appliquée (avec la liste des conflits éventuels)" }, 401: { description: "Jeton absent" }, 403: { description: "Jeton invalide" }, 413: { description: "Trop d'enregistrements" }, 507: { description: "Base pleine" } } } },
  };
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
    doc.paths = { ...doc.paths, ...dbPaths() };
    doc.paths = Object.fromEntries(Object.entries(doc.paths).sort((a, b) => a[0].localeCompare(b[0])));
    send(req, res, 200, doc);
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
    const auth = authenticate(req);
    if (!auth.ok) { send(req, res, auth.status, err(auth.message, { code: auth.code })); return; }
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
      const out = await sync(name, body || {}, auth.label, ip);
      send(req, res, out.status, out.body);
    } catch (e) {
      console.error("[sync]", name, e);
      send(req, res, 500, err("Écriture impossible : " + e.message, { code: "ecriture_impossible" }));
    }
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
    const request = { method: req.method, path: pathname + url.search, headers: req.headers, body, ip };
    const out = api.route(request, {
      authorize: (headers) => {
        const a = authenticate({ headers });
        return a.ok ? null : { status: a.status, headers: {}, body: err(a.message, { code: a.code }) };
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

// -------------------------------------------------------------------- démarrage
async function main() {
  if (process.argv.includes("--migrate")) {
    await migrate();
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
  if (!TOKENS.length) console.warn("ATTENTION : aucun jeton dans API_TOKENS — toutes les écritures seront refusées (503).");
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
