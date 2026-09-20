// ============================================================================
// Pilote « local » : le stockage du navigateur (IndexedDB).
//
// C'est le mode de démonstration : les données vivent sur le poste, elles ne
// sont pas partagées, et rien ne sort du navigateur. Les noms de dossiers kv
// sont ceux utilisés depuis l'origine, donc les données déjà enregistrées sont
// conservées telles quelles quand on reste en mode local.
// ============================================================================

import { hostKv } from "../hosts.js";

export const id = "local";
export const label = "Locale (ce navigateur)";
export const shared = false;

const FOLDERS = {
  config: "actesConfig",
  trames: "actesTrames",
  actes: "actesActes",
  users: "actesUsers",
  journal: "actesJournal",
  presence: "actesPresence",
  meta: "actesMeta",
  session: "actesSession",
};

function kv() {
  return hostKv();
}

// Repli en mémoire quand le stockage du navigateur est indisponible (navigation
// privée, quota, environnement restreint) : l'application reste utilisable, le
// temps de la session. Les noms de dossiers sont ceux de kv, pour que le repli
// et le stockage réel ne se marchent pas dessus.
const memory = new Map();

export function available() {
  return !!kv();
}

export async function read(name) {
  const k = kv();
  if (!k) return { value: memory.has(name) ? memory.get(name) : null, revision: null };
  const v = await k[FOLDERS[name]].get("data");
  if (v === undefined || v === null) return { value: memory.has(name) ? memory.get(name) : null, revision: null };
  return { value: v, revision: null };
}

export async function write(name, { value }) {
  memory.set(name, value);
  const k = kv();
  if (!k) return { revision: null, conflicts: [] };
  await k[FOLDERS[name]].set("data", value);
  return { revision: null, conflicts: [] };
}

export async function remove(name) {
  memory.delete(name);
  const k = kv();
  if (!k) return { ok: false };
  await k[FOLDERS[name]].delete("data");
  return { ok: true };
}

export async function health() {
  const k = kv();
  if (!k) return { ok: false, detail: "Stockage du navigateur indisponible.", info: null };
  try {
    // Une vraie écriture suivie d'une relecture : c'est le seul test qui prouve
    // que le stockage accepte les écritures (et pas seulement les lectures).
    await k.actesDiag.set("probe", Date.now());
    const v = await k.actesDiag.get("probe");
    return { ok: !!v, detail: v ? "Stockage du navigateur disponible, écriture vérifiée." : "Stockage du navigateur en lecture seule.", info: { driver: "indexeddb" } };
  } catch (e) {
    return { ok: false, detail: "Stockage du navigateur inaccessible : " + ((e && e.message) || e), info: null };
  }
}
