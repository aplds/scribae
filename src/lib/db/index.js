// ============================================================================
// Persistance — façade unique de l'application.
//
//   driver()  →  le pilote actif : « local » (IndexedDB du navigateur) ou
//                « service » (base partagée, joignable en socket ou en HTTP).
//
// La façade tient à jour, pour chaque collection, l'index des enregistrements
// connus du serveur (`snapshot`) : c'est lui qui permet de n'envoyer que les
// différences, enregistrement par enregistrement, et donc de ne pas écraser le
// travail d'un autre poste. En mode partagé, chaque lecture réussie est recopiée
// dans un miroir local (`actesMirror`) pour que l'application puisse démarrer
// même si le service est momentanément injoignable.
// ============================================================================

import * as localDriver from "./local.js";
import * as serviceDriver from "./service.js";
import {
  COLLECTIONS, SHARED_COLLECTIONS, DOCUMENT_COLLECTIONS, SILENT_COLLECTIONS,
  recordsOf, indexOf, diffRecords, reconcile, stableStringify, isLocalOnly, isSingleton,
} from "./contract.js";
import { DEFAULT_PUBLICATION } from "../eli.js";
import { hostKv } from "../hosts.js";

// Les trois modes proposés à l'administrateur. `service` et `external` parlent
// le même contrat : seul le transport change (socket de l'environnement, ou HTTP
// vers un serveur MySQL/MariaDB installé par la collectivité).
export const MODES = [
  {
    id: "local",
    label: "Locale — ce navigateur",
    short: "Locale",
    help: "Les données restent sur ce poste (IndexedDB). Idéal pour la démonstration : rien à installer, tout est immédiat.",
    shared: false,
  },
  {
    id: "service",
    label: "Service de démonstration — partagé",
    short: "Service",
    help: "Le service partagé de démonstration conserve les données (50 Mio durables) : plusieurs postes voient le même référentiel, sans rien installer. Ne sait pas parler à MySQL.",
    shared: true,
    transport: "socket",
  },
  {
    id: "external",
    label: "Serveur externe — MySQL / MariaDB",
    short: "Serveur",
    help: "Les données vivent dans la base de la collectivité. Il faut déployer le service de données fourni (voir src/server/mysql/README.md) et renseigner son adresse et son jeton.",
    shared: true,
    transport: "http",
  },
];

// Édition statique (GitHub Pages) : le service de démonstration est **embarqué
// dans la page** (voir src/pages/host.js), donc son état vit dans le stockage de
// ce navigateur — il n'est pas partagé entre postes. On le dit dans le libellé :
// promettre un partage qui n'existe pas serait pire que de ne rien proposer.
if (globalThis.__SCRIBA_STATIC__) {
  const service = MODES.find((m) => m.id === "service");
  if (service) {
    service.label = "Service embarqué — ce navigateur";
    service.help = "Le service de démonstration est embarqué dans la page : il garde les données dans ce navigateur (8 Mio durables). Rien à installer, mais rien n'est partagé entre postes. Ne sait pas parler à MySQL.";
  }
}

export const modeById = (id) => MODES.find((m) => m.id === id) || MODES[0];

const SETTINGS_FOLDER = "actesDb";
const MIRROR_FOLDER = "actesMirror";
const PENDING_FOLDER = "actesPending";
const PENDING_MAX = 200;

const DEFAULT_SETTINGS = {
  // Auto-hébergement : le service de données est celui du déploiement, sur la
  // même origine (`src/server/`). Ailleurs (démonstration statique), le défaut
  // reste le stockage du navigateur.
  mode: globalThis.__SCRIBA_SELF_HOSTED__ ? "external" : "local",
  url: globalThis.__SCRIBA_API_BASE__ || "",
  token: globalThis.__SCRIBA_API_TOKEN__ || DEFAULT_PUBLICATION.jetonDemonstration,
};

let settings = { ...DEFAULT_SETTINGS };
let driver = localDriver;
let snapshot = {};              // name → { rev, index: { id: { rev, json, ord } } }
let pending = [];               // écritures faites hors ligne, en attente de renvoi
let statusInfo = { mode: "local", state: "unknown", detail: "" };

const statusListeners = new Set();
const conflictListeners = new Set();

export const onStatus = (fn) => { statusListeners.add(fn); return () => statusListeners.delete(fn); };
export const onConflict = (fn) => { conflictListeners.add(fn); return () => conflictListeners.delete(fn); };

function notify(set, arg) { set.forEach((f) => { try { f(arg); } catch (e) { console.error(e); } }); }

function setStatus(state, detail = "") {
  if (statusInfo.state === state && statusInfo.detail === detail && statusInfo.mode === settings.mode) return;
  statusInfo = { mode: settings.mode, state, detail };
  notify(statusListeners, status());
}

export const status = () => ({ ...statusInfo, mode: settings.mode, shared: !!driver.shared, label: modeById(settings.mode).short });

function kv() {
  return hostKv();
}

async function kvGet(folder, key, fallback) {
  const k = kv();
  if (!k || !k[folder]) return fallback;
  try {
    const v = await k[folder].get(key);
    return v === undefined || v === null ? fallback : v;
  } catch (e) { return fallback; }
}

async function kvSet(folder, key, value) {
  const k = kv();
  if (!k || !k[folder]) return false;
  try { await k[folder].set(key, value); return true; } catch (e) { console.warn("Écriture du miroir impossible :", e); return false; }
}

// ---------------------------------------------------------------- pilotage
export async function init() {
  const saved = await kvGet(SETTINGS_FOLDER, "data", null);
  if (saved && typeof saved === "object") settings = { ...DEFAULT_SETTINGS, ...saved };
  const queue = await kvGet(PENDING_FOLDER, "data", null);
  if (Array.isArray(queue)) pending = queue;
  try {
    driver = makeDriver();
  } catch (e) {
    console.warn("Pilote de persistance indisponible, repli sur le stockage local :", e);
    settings = { ...settings, mode: "local" };
    driver = localDriver;
  }
  setStatus("unknown", driver.shared ? "Connexion au service de données…" : "Stockage du navigateur.");
  return settings;
}

// ------------------------------------------------------- écritures en attente
// Une écriture qui échoue (réseau, service momentanément indisponible) n'est pas
// perdue : elle est mise en file et renvoyée dès que la base répond de nouveau.
// Les refus définitifs (jeton invalide, configuration) ne sont pas mis en file :
// il faut d'abord corriger le réglage.
const fatalStatus = (e) => e && (e.status === 401 || e.status === 403);

async function queueWrite(entry) {
  if (pending.length >= PENDING_MAX) {
    setStatus("offline", `Trop d'écritures en attente de la base (${PENDING_MAX}) : cette modification n'a pas pu être mise de côté.`);
    return false;
  }
  pending.push({ at: new Date().toISOString(), ...entry });
  await kvSet(PENDING_FOLDER, "data", pending);
  return true;
}

export const pendingCount = () => pending.length;

export async function flushPending() {
  if (!driver.shared || !pending.length) return { flushed: 0, left: pending.length };
  const queue = pending;
  const touched = new Set();
  let flushed = 0;
  while (queue.length) {
    const entry = queue[0];
    try {
      const r = await driver.write(entry.collection, { upserts: entry.upserts, deletes: entry.deletes, force: entry.force });
      if (r.conflicts && r.conflicts.length && !SILENT_COLLECTIONS.has(entry.collection)) {
        notify(conflictListeners, { collection: entry.collection, conflicts: r.conflicts });
      }
      touched.add(entry.collection);
      queue.shift();
      flushed += 1;
    } catch (e) {
      break;
    }
  }
  pending = queue;
  await kvSet(PENDING_FOLDER, "data", pending);
  // Les écritures rejouées ont fait avancer les révisions : on relit les
  // collections concernées pour que l'index local reste aligné sur la base.
  for (const name of touched) {
    try { await readCollection(name); } catch (e) { /* la prochaine lecture s'en chargera */ }
  }
  if (flushed) setStatus("ok", `${flushed} écriture(s) différée(s) transmise(s) à la base.`);
  return { flushed, left: pending.length };
}

function makeDriver() {
  const mode = modeById(settings.mode);
  if (!mode.shared) return localDriver;
  // Le mode « service de démonstration » utilise toujours son propre jeton (son
  // empreinte est inscrite dans le service lui-même) : les champs adresse et
  // jeton ne concernent que le serveur externe.
  const external = settings.mode === "external";
  return serviceDriver.create({
    baseUrl: external ? settings.url : "",
    token: (external ? settings.token : "") || DEFAULT_SETTINGS.token,
    transport: mode.transport,
    label: mode.short + " · base de données",
  });
}

export async function setSettings(patch, { silent = false } = {}) {
  const prevSettings = settings;
  const prevDriver = driver;
  settings = { ...settings, ...(patch || {}) };
  try {
    driver = makeDriver();
  } catch (e) {
    settings = prevSettings;
    driver = prevDriver;
    throw e;
  }
  await kvSet(SETTINGS_FOLDER, "data", settings);
  snapshot = {};
  setStatus("unknown", driver.shared ? "Connexion au service de données…" : "Stockage du navigateur.");
  if (!silent) await health();
  return settings;
}

export const getSettings = () => ({ ...settings });
export const driverId = () => (driver.shared ? "service:" + (driver.transport || "") : "local");
export const isShared = () => !!driver.shared;
export const isLocalMode = () => !driver.shared;

export async function health() {
  // Mode local : une simple vérification de disponibilité suffit (pas de probe
  // écrit sur le disque à chaque appel).
  if (!driver.shared) {
    const ok = localDriver.available();
    setStatus(ok ? "ok" : "error", ok
      ? "Stockage du navigateur disponible (données locales à ce poste)."
      : "Le stockage du navigateur est indisponible (navigation privée ?).");
    return statusInfo;
  }
  const res = await driver.health();
  // Un jeton refusé ou un service mal configuré est une erreur ; un service
  // momentanément injoignable est une indisponibilité (l'application continue
  // sur le miroir local).
  const fatal = res.status === 401 || res.status === 403 || res.status === 503;
  setStatus(res.ok ? "ok" : fatal ? "error" : "offline", res.detail || "");
  if (res.ok && pending.length) await flushPending();
  return { ...statusInfo, info: res.info };
}

// Teste un réglage sans l'appliquer (bouton « Tester la connexion »).
export async function test(patch = {}) {
  const merged = { ...settings, ...patch };
  const mode = modeById(merged.mode);
  if (!mode.shared) {
    const res = await localDriver.health();
    return { ok: res.ok, detail: res.detail || (res.ok ? "Stockage du navigateur disponible." : ""), info: res.info };
  }
  const external = merged.mode === "external";
  const probe = serviceDriver.create({
    baseUrl: external ? merged.url : "",
    token: (external ? merged.token : "") || DEFAULT_SETTINGS.token,
    transport: mode.transport,
    label: "test de connexion",
  });
  const res = await probe.health();
  return { ok: res.ok, detail: res.detail, info: res.info };
}

// ---------------------------------------------------------------- lecture
async function readCollection(name) {
  const res = await driver.read(name);
  const records = res.records || recordsOf(name, res.value);
  const index = {};
  for (const r of records) index[r.id] = { rev: r.rev ?? null, json: stableStringify(r.payload), ord: r.ord || 0 };
  snapshot[name] = { rev: res.revision ?? 0, index };
  await kvSet(MIRROR_FOLDER, name, res.value);
  return res.value;
}

// `fresh` force la lecture du service (sans passer par le miroir).
export async function read(name, { fresh = false } = {}) {
  if (!COLLECTIONS[name]) return null;
  if (isLocalOnly(name)) return (await localDriver.read(name)).value;
  if (driver.shared && fresh) {
    if (pending.length) await flushPending();
    return readCollection(name);
  }
  if (driver.shared) {
    if (pending.length) await flushPending();
    try {
      const value = await readCollection(name);
      if (statusInfo.state !== "ok") setStatus("ok", "Service de données disponible.");
      return value;
    } catch (e) {
      const mirror = await kvGet(MIRROR_FOLDER, name, null);
      setStatus("offline", `Service injoignable (${(e && e.message) || e}). Données locales de secours utilisées.`);
      return mirror;
    }
  }
  return (await driver.read(name)).value;
}

// ---------------------------------------------------------------- écriture
export async function write(name, value, { force = false } = {}) {
  if (!COLLECTIONS[name]) return { ok: false, error: "Collection inconnue : " + name };

  if (isLocalOnly(name)) {
    await localDriver.write(name, { value });
    if (driver.shared) await kvSet(MIRROR_FOLDER, name, value);
    return { ok: true };
  }

  if (!driver.shared) {
    await localDriver.write(name, { value });
    snapshot[name] = { rev: 0, index: indexOf(recordsOf(name, value)) };
    return { ok: true };
  }

  const next = recordsOf(name, value);
  const base = snapshot[name]?.index || {};
  const { upserts, deletes } = diffRecords(next, base);
  if (!upserts.length && !deletes.length) return { ok: true, unchanged: true };

  let res;
  try {
    res = await driver.write(name, { upserts, deletes, force });
  } catch (e) {
    await kvSet(MIRROR_FOLDER, name, value);
    if (fatalStatus(e)) {
      setStatus("error", `Écriture refusée (${(e && e.message) || e}). Vérifiez le réglage de la base.`);
      return { ok: false, error: (e && e.message) || String(e) };
    }
    await queueWrite({ collection: name, upserts, deletes, force });
    setStatus("offline", `Écriture différée (${(e && e.message) || e}). Elle sera transmise dès que la base répondra.`);
    return { ok: false, deferred: true, error: (e && e.message) || String(e) };
  }

  const index = { ...base };
  const payloadById = new Map(upserts.map((u) => [u.id, u]));
  for (const a of res.applied || []) {
    const u = payloadById.get(a.id);
    index[a.id] = { rev: a.rev, json: stableStringify(u ? u.payload : null), ord: u ? u.ord : 0 };
  }
  const conflictIds = new Set((res.conflicts || []).map((c) => c.id));
  for (const d of deletes) if (!conflictIds.has(d.id)) delete index[d.id];
  for (const c of res.conflicts || []) {
    if (c.deleted) delete index[c.id];
    else index[c.id] = { rev: c.rev, json: stableStringify(c.payload), ord: c.ord || 0 };
  }
  snapshot[name] = { rev: res.revision ?? (snapshot[name]?.rev || 0), index };

  let reconciled = value;
  if (res.conflicts && res.conflicts.length) {
    reconciled = reconcile(name, value, res.conflicts);
    if (!SILENT_COLLECTIONS.has(name)) notify(conflictListeners, { collection: name, conflicts: res.conflicts });
  }
  await kvSet(MIRROR_FOLDER, name, reconciled);
  setStatus("ok", "Service de données disponible.");
  return { ok: true, conflicts: res.conflicts || [], value: reconciled };
}

export async function remove(name) {
  if (!COLLECTIONS[name]) return { ok: false };
  if (isLocalOnly(name)) return localDriver.remove(name);
  const res = await driver.remove(name);
  snapshot[name] = { rev: 0, index: {} };
  await kvSet(MIRROR_FOLDER, name, isSingleton(name) ? null : []);
  return res;
}

// -------------------------------------------------------------- bascule/transfert
// Envoie les documents fournis vers le pilote actif, en forçant l'écriture
// (l'appelant est administrateur et sait ce qu'il fait).
export async function push(values) {
  const out = [];
  for (const name of SHARED_COLLECTIONS) {
    if (!(name in values)) continue;
    const r = await write(name, values[name], { force: true });
    out.push({ name, ok: !!r.ok, error: r.error });
  }
  return out;
}

// Récupère l'état du service et le recopie aussi dans le stockage local.
export async function pull({ mirrorToLocal = true } = {}) {
  const out = {};
  for (const name of SHARED_COLLECTIONS) {
    try {
      const value = await read(name, { fresh: true });
      out[name] = { ok: true, value };
      if (mirrorToLocal) await localDriver.write(name, { value });
    } catch (e) {
      out[name] = { ok: false, error: (e && e.message) || String(e) };
    }
  }
  return out;
}

// Réinitialise toutes les collections partagées (le mode local efface, le mode
// partagé supprime les enregistrements).
export async function clearAll() {
  for (const name of SHARED_COLLECTIONS) {
    try { await remove(name); } catch (e) { console.warn("Réinitialisation de " + name + " impossible :", e); }
  }
  snapshot = {};
  return true;
}

export { COLLECTIONS, SHARED_COLLECTIONS, DOCUMENT_COLLECTIONS, localDriver };
