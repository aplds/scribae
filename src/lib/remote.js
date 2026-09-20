// ============================================================================
// Accès au service distant (API REST de signature et de publication).
//
// L'application est un client de ce service : elle n'écrit pas directement les
// publications, elle appelle l'API. Le transport est un canal WebSocket (le
// de l'environnement d'édition) mais la forme des échanges est celle d'une API
// HTTP/REST — méthode, chemin, en-têtes, corps JSON, statut, en-têtes de
// réponse — afin que le code d'appel soit celui d'un vrai client REST.
// Le journal (`log`) conserve chaque échange (requête + réponse) pour l'afficher
// dans la console de l'écran « Signature ».
// ============================================================================

import { hostSocketFactory } from "./hosts.js";

const MAX_PAYLOAD = 900000;   // marge sous la limite de 1 Mio d'un message (transport socket)
const MAX_HTTP_PAYLOAD = 8000000; // corps accepté par le service HTTP (MAX_BODY du serveur)

// Deux transports mènent au même contrat REST :
//   • le canal temps réel de l'environnement d'édition, quand il est fourni ;
//   • de simples appels `fetch` vers un service auto-hébergé (voir src/server/),
//     repéré par `__SCRIBA_SELF_HOSTED__` — posé par le déploiement, jamais par
//     cet environnement. Sans l'un ni l'autre, le service est déclaré indisponible.
const apiBase = () => String(globalThis.__SCRIBA_API_BASE__ ?? "").replace(/\/+$/, "");
const socketHost = () => hostSocketFactory();
const useHttp = () => !socketHost() && globalThis.__SCRIBA_SELF_HOSTED__ === true;

export const log = [];
const logListeners = new Set();
const statusListeners = new Set();
const LOG_MAX = 300;

let socket = null;
let status = "unavailable";
let detail = "";
let attempt = 0;
let retryTimer = null;

export const onLog = (fn) => { logListeners.add(fn); return () => logListeners.delete(fn); };
export const onStatus = (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); };
export const apiStatus = () => ({ status, detail });

function notify(set) { set.forEach((f) => { try { f(); } catch (e) { console.error(e); } }); }

function setStatus(s, d = "") {
  if (status === s && detail === d) return;
  status = s;
  detail = d;
  notify(statusListeners);
}

export function clearLog() {
  log.length = 0;
  notify(logListeners);
}

let flowSeq = 0;
export function beginFlow(name) {
  flowSeq += 1;
  return { id: "fl-" + flowSeq + "-" + Date.now().toString(36), name };
}

let entrySeq = 0;
function pushEntry(entry) {
  entrySeq += 1;
  entry.id = entry.id || "e" + entrySeq;
  entry.at = entry.at || new Date().toISOString();
  log.push(entry);
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  notify(logListeners);
  return entry;
}

// Appels sortants émis par la passerelle vers le prestataire de signature :
// ils n'ont pas le même destinataire que l'API, mais ils partagent le journal.
export function recordExternal({ method, url, request, response, status: st, ms, flow, label }) {
  return pushEntry({ service: "prestataire", method, url, request, response, status: st, ms, flow, label });
}

// ------------------------------------------------------------------ connexion

function ensureSocket() {
  const create = socketHost();
  if (typeof create !== "function") {
    setStatus("unavailable", "Le service n'est pas disponible dans cet environnement (aperçu hors ligne).");
    return null;
  }
  if (socket && (socket.readyState === 0 || socket.readyState === 1)) return socket;

  setStatus("connecting");
  let s;
  try { s = socket = create(); }
  catch (e) { setStatus("error", String((e && e.message) || e)); return null; }

  s.addEventListener("open", () => {
    if (s !== socket) return;
    attempt = 0;
    if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
    setStatus("online", "");
  });
  s.addEventListener("close", (ev) => {
    if (s !== socket) return;
    socket = null;
    if (ev.code === 4403) setStatus("blocked", "Le service refuse les pages servies depuis une autre adresse.");
    else if (ev.code === 1011) setStatus("error", "Le service distant a échoué à son démarrage.");
    else if (ev.code === 4429) setStatus("error", "Le service est temporairement suspendu (trop de requêtes). Réessayez dans quelques minutes.");
    else setStatus("offline", `Connexion au service perdue (${ev.code}). Reconnexion en cours…`);
    if (ev.code !== 4403 && ev.code !== 1011 && ev.code !== 4429) scheduleRetry();
  });
  return s;
}

function scheduleRetry() {
  if (retryTimer) return;
  attempt += 1;
  const delay = Math.min(30000, 700 * Math.pow(2, Math.min(attempt, 5))) + Math.round(Math.random() * 400);
  retryTimer = setTimeout(() => { retryTimer = null; ensureSocket(); }, delay);
}

export function connect() { return ensureSocket(); }

function ready() {
  // Transport HTTP : aucune connexion à établir, chaque appel est autonome.
  if (useHttp()) { setStatus("online", ""); return Promise.resolve(); }
  const s = ensureSocket();
  if (!s) return Promise.reject(new Error("Service distant indisponible."));
  if (s.readyState === 1) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const to = setTimeout(() => { done(); reject(new Error("Le service n'a pas répondu dans le délai imparti.")); }, 20000);
    const ok = () => { done(); resolve(); };
    const ko = (ev) => { done(); reject(new Error("Connexion au service impossible (code " + ev.code + ").")); };
    function done() {
      clearTimeout(to);
      s.removeEventListener("open", ok);
      s.removeEventListener("close", ko);
    }
    s.addEventListener("open", ok);
    s.addEventListener("close", ko);
  });
}

// ------------------------------------------------------------------ appel REST

// `call(method, path, opts)` renvoie un objet proche d'une Response :
//   { ok, status, headers, body, request, ms, id }
// Un appel HTTP réel, mis en forme comme une réponse (statut, en-têtes, corps) :
// c'est exactement ce que renvoie le canal du service, donc l'appelant ne sait
// pas quel transport a été utilisé.
async function httpRequest(request) {
  const res = await fetch(apiBase() + request.path, {
    method: request.method,
    headers: { ...(request.body === undefined ? {} : { "content-type": "application/json" }), ...request.headers },
    body: request.body === undefined ? undefined : JSON.stringify(request.body),
  });
  let body = null;
  try { body = await res.json(); } catch (e) { body = null; }
  const headers = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  return { status: res.status, headers, body };
}

export async function call(method, path, opts = {}) {
  const { body = null, token = null, headers = {}, idempotencyKey = null, flow = null, label = "", source = "application" } = opts;
  const request = { method: String(method).toUpperCase(), path, headers: { ...headers } };
  if (token) request.headers.authorization = "Bearer " + token;
  if (idempotencyKey) request.headers["idempotency-key"] = idempotencyKey;
  if (body !== null && body !== undefined) request.body = body;

  const raw = JSON.stringify(request);
  const limit = useHttp() ? MAX_HTTP_PAYLOAD : MAX_PAYLOAD;
  if (raw.length > limit) {
    const err = new Error(useHttp()
      ? `Document trop volumineux pour l'API : le service accepte au plus ${limit} caractères par requête.`
      : "Document trop volumineux pour l'API de démonstration : le service accepte au plus ~900 000 caractères par requête.");
    pushEntry({ service: "api", method: request.method, path, request, response: { error: err.message }, status: 0, ms: 0, flow, label, source });
    throw err;
  }

  await ready();
  const t0 = (globalThis.performance || Date).now();
  let response;
  try {
    if (useHttp()) {
      response = await httpRequest(request);
    } else {
      const reply = await socket.rpc.api(raw);
      response = typeof reply === "string" ? JSON.parse(reply) : reply;
    }
  } catch (e) {
    setStatus("offline", `Service injoignable : ${(e && e.message) || e}`);
    const entry = pushEntry({
      service: "api", method: request.method, path, request,
      response: { error: String((e && e.message) || e) }, status: 0,
      ms: Math.round(((globalThis.performance || Date).now()) - t0), flow, label, source,
    });
    throw new Error(`Échec de l'appel ${request.method} ${path} : ${(e && e.message) || e}`, { cause: entry });
  }
  const ms = Math.round(((globalThis.performance || Date).now()) - t0);
  if (useHttp() && status !== "online") setStatus("online", "");
  const entry = pushEntry({ service: "api", method: request.method, path, request, response, status: response.status, ms, flow, label, source });
  return { ok: response.status >= 200 && response.status < 300, status: response.status, headers: response.headers || {}, body: response.body, request, ms, id: entry.id };
}

export const get = (path, opts) => call("GET", path, opts);
export const post = (path, body, opts) => call("POST", path, { ...opts, body });

// Extrait un message d'erreur lisible d'une réponse non-2xx.
export function errorMessage(res) {
  const b = res && res.body;
  if (!b) return `Erreur ${res && res.status}`;
  return b.message || (b.error && b.error.message) || `Erreur ${res.status}`;
}
