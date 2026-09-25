// ============================================================================
// Pilote « local » : le stockage du navigateur (IndexedDB).
//
// C'est le mode de démonstration : les données vivent sur le poste, elles ne
// sont pas partagées, et rien ne sort du navigateur. Les noms de dossiers kv
// sont ceux utilisés depuis l'origine, donc les données déjà enregistrées sont
// conservées telles quelles quand on reste en mode local.
//
// CHAQUE COLLECTION A SON DOSSIER — et c'est une règle, non un détail. Le
// stockage kv range par DOSSIER nommé : une collection absente de `FOLDERS`
// tombait sur un dossier littéralement nommé « undefined », PARTAGÉ par toutes
// les collections non déclarées. Les billets du recueil (`informations`) y
// avaient élu domicile depuis la 1.5.3 ; les reprises d'actes anciens (1.6.1s)
// seraient venues s'y écrire PAR-DESSUS, et réciproquement — une écriture
// effaçant l'autre. L'héritage est repris une fois (voir `reprendreHeritage`).
// ============================================================================

import { hostKv } from "../hosts.js";

export const id = "local";
export const label = "Locale (ce navigateur)";
export const shared = false;

const FOLDERS = {
  config: "actesConfig",
  trames: "actesTrames",
  actes: "actesActes",
  reprises: "actesReprises",
  users: "actesUsers",
  journal: "actesJournal",
  presence: "actesPresence",
  informations: "actesInformations",
  meta: "actesMeta",
  session: "actesSession",
};

// L'ancien dossier PARTAGÉ des collections sans dossier (voir l'en-tête) : la
// clé `undefined` d'un objet devient la chaîne « undefined ».
const DOSSIER_HERITE = "undefined";

// Ce qu'une collection héritée doit AVOIR L'AIR d'être pour qu'on la reprenne :
// deux collections ont partagé ce dossier, on ne devine pas à l'aveugle — on ne
// reprend que ce qui porte la marque de la collection attendue.
const HERITAGE = {
  informations: (v) => Array.isArray(v) && v.every((x) => x && typeof x === "object" && (x.publie !== undefined || String(x.id || "").startsWith("info"))),
  reprises: (v) => Array.isArray(v) && v.every((x) => x && typeof x === "object" && String(x.id || "").startsWith("reprise")),
};

function kv() {
  return hostKv();
}

// Repli en mémoire quand le stockage du navigateur est indisponible (navigation
// privée, quota, environnement restreint) : l'application reste utilisable, le
// temps de la session. Les noms de dossiers sont ceux de kv, pour que le repli
// et le stockage réel ne se marchent pas dessus.
const memory = new Map();

// Le dossier kv d'une collection : son nom, ou `null` quand la collection n'a
// pas de dossier — cas qui n'arrive plus, mais qu'on ne veut pas voir retomber
// sur le dossier partagé.
const dossierDe = (name) => FOLDERS[name] || null;

export function available() {
  return !!kv();
}

// Reprise de l'héritage : les données écrites avant que la collection n'ait son
// dossier sont reprises UNE fois, à la première lecture, et réinstallées dans le
// bon dossier. Rend la valeur héritée, ou `null`.
async function reprendreHeritage(name, k) {
  const dossier = dossierDe(name);
  const forme = HERITAGE[name];
  if (!dossier || !forme) return null;
  let v;
  try { v = await k[DOSSIER_HERITE].get("data"); } catch (e) { return null; }
  if (v === undefined || v === null || !forme(v)) return null;
  try { await k[dossier].set("data", v); } catch (e) { /* la reprise est un confort */ }
  return v;
}

export async function read(name) {
  const dossier = dossierDe(name);
  const k = kv();
  const secours = () => (memory.has(name) ? memory.get(name) : null);
  if (!dossier || !k) return { value: secours(), revision: null };
  let v = await k[dossier].get("data");
  if (v === undefined || v === null) v = await reprendreHeritage(name, k);
  if (v === undefined || v === null) return { value: secours(), revision: null };
  return { value: v, revision: null };
}

export async function write(name, { value }) {
  memory.set(name, value);
  const dossier = dossierDe(name);
  const k = kv();
  if (!dossier || !k) return { revision: null, conflicts: [] };
  await k[dossier].set("data", value);
  return { revision: null, conflicts: [] };
}

export async function remove(name) {
  memory.delete(name);
  const dossier = dossierDe(name);
  const k = kv();
  if (!dossier || !k) return { ok: false };
  await k[dossier].delete("data");
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
