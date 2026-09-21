// ============================================================================
// Pilote « service » : la base de données est distante et partagée.
//
// Deux transports mènent au même contrat REST (`/v1/db/…`) :
//   • `socket` — le canal temps réel de l'environnement d'édition. C'est le mode
//     « démonstration partagée » : rien à installer, et l'état durable du
//     service est partagé par tous les postes. Il ne sait pas parler à MySQL.
//   • `http`   — un serveur externe (MySQL / MariaDB) déployé par la
//     collectivité ; voir `src/server/mysql/`. Les requêtes sont de simples
//     appels `fetch` avec un jeton d'API.
//
// Le contrat est le même dans les deux cas, donc tout le reste de l'application
// ignore où vivent réellement les données.
// ============================================================================

import { call as socketCall, errorMessage } from "../remote.js";
import { docFromRecords, LIMITS, bytesOf } from "./contract.js";

export { errorMessage };

export const id = "service";

export function create({
  baseUrl = "", token = "", transport = "socket", label = "Service de données",
  // Mode « comptes locaux (mot de passe) » : la porte est la session du service,
  // dans un cookie — donc `credentials: "include"` — et les écritures portent
  // l'en-tête anti-CSRF, relu du cookie à chaque appel (voir src/lib/motdepasse.js).
  credentials = "same-origin", csrf = null,
} = {}) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const entetesCsrf = () => (typeof csrf === "function" ? csrf() : (csrf || {}));

  async function request(method, path, body) {
    const payload = body === undefined ? null : body;
    if (payload) {
      const size = bytesOf(payload);
      const max = transport === "socket" ? LIMITS.socketChars : LIMITS.httpChars;
      if (size > max) {
        throw new Error(
          `Les données à envoyer sont trop volumineuses pour une seule requête (${Math.round(size / 1024)} Kio, maximum ${Math.round(max / 1024)} Kio). ` +
          (transport === "socket" ? "Le service de démonstration limite chaque message à 1 Mio." : "Augmentez la limite du serveur ou réduisez le volume."),
        );
      }
    }
    if (transport === "socket") {
      const res = await socketCall(method, path, { body: payload, token, source: "base", label });
      return { ok: res.ok, status: res.status, body: res.body };
    }
    let res;
    try {
      res = await fetch(base + path, {
        method,
        credentials,
        headers: {
          "content-type": "application/json",
          ...(token ? { authorization: "Bearer " + token } : {}),
          ...(method === "GET" ? {} : entetesCsrf()),
        },
        body: payload === null ? undefined : JSON.stringify(payload),
      });
    } catch (e) {
      throw new Error(`Serveur de données injoignable (${base + path}) : ${(e && e.message) || e}`);
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = { message: "Réponse illisible du serveur." }; }
    return { ok: res.ok, status: res.status, body: data };
  }

  function check(res, what) {
    if (!res.ok) {
      const e = new Error((res.body && (res.body.erreur || res.body.message)) || `${what} : erreur ${res.status}`);
      e.status = res.status;
      throw e;
    }
    return res.body;
  }

  async function read(name) {
    const res = await request("GET", `/v1/db/collections/${encodeURIComponent(name)}`);
    const body = check(res, "Lecture " + name);
    const records = (body.records || []).map((r) => ({
      id: String(r.id),
      rev: r.rev ?? null,
      ord: r.ord || 0,
      payload: r.payload === undefined ? null : r.payload,
    }));
    return { value: docFromRecords(name, records), revision: body.revision ?? 0, records };
  }

  async function write(name, { upserts, deletes, force }) {
    const res = await request("POST", `/v1/db/collections/${encodeURIComponent(name)}/sync`, {
      upserts: upserts || [],
      deletes: deletes || [],
      force: !!force,
    });
    const body = check(res, "Écriture " + name);
    return { revision: body.revision ?? 0, applied: body.applied || [], conflicts: body.conflicts || [] };
  }

  async function remove(name) {
    const cur = await read(name);
    const records = Array.isArray(cur.value) ? cur.value : [];
    const deletes = records.map((item) => ({ id: String(item && item.id), rev: null }));
    const res = await request("POST", `/v1/db/collections/${encodeURIComponent(name)}/sync`, { upserts: [], deletes, force: true });
    check(res, "Suppression " + name);
    return { ok: true };
  }

  async function health() {
    try {
      const res = await request("GET", "/v1/db/health");
      const body = check(res, "État du service");
      return { ok: true, detail: body.message || "Service de données disponible.", info: body };
    } catch (e) {
      return { ok: false, status: e && e.status, detail: (e && e.message) || String(e), info: null };
    }
  }

  return { id, label, shared: true, transport, baseUrl: base, read, write, remove, health };
}
