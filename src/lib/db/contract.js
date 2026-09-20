// ============================================================================
// Contrat de persistance : ce que l'application stocke, et comment.
//
// L'application ne connaît que des « collections » :
//   • `config`   — le référentiel (objet unique)
//   • `trames`   — les trames (liste d'objets identifiés par `id`)
//   • `actes`    — les actes (liste)
//   • `users`    — les comptes (liste)
//   • `journal`  — le registre des faits (qui a fait quoi) et la source des
//                  notifications : liste d'entrées, les plus anciennes évincées
//   • `presence` — un enregistrement par poste connecté (battement de cœur,
//                  écran courant, acte en cours de rédaction)
//   • `meta`     — métadonnées d'installation (version de seed…)
//   • `session`  — la session locale (JAMAIS partagée, jamais envoyée)
//
// Un « enregistrement » est l'unité élémentaire : pour une liste, chaque objet
// de la liste ; pour un objet unique, l'objet lui-même rangé sous l'id `self`.
// C'est cette granularité qui permet à un serveur partagé de fusionner les
// modifications de deux postes sans écraser tout le référentiel.
// ============================================================================

export const SINGLETON = "singleton";
export const LIST = "list";

export const COLLECTIONS = {
  config: { kind: SINGLETON, label: "Référentiel", table: "referentiel" },
  trames: { kind: LIST, label: "Trames", table: "trame" },
  actes: { kind: LIST, label: "Actes", table: "acte" },
  users: { kind: LIST, label: "Comptes", table: "compte" },
  journal: { kind: LIST, label: "Journal", table: "journal" },
  presence: { kind: LIST, label: "Présence", table: "presence" },
  meta: { kind: SINGLETON, label: "Métadonnées", table: "meta" },
  session: { kind: SINGLETON, label: "Session", local: true },
};

// Collections dont les conflits ne sont JAMAIS signalés à l'utilisateur : le
// journal et la présence sont des écritures automatiques et continues (un
// battement de cœur toutes les 25 secondes) ; une version « reprise » n'y a
// aucune conséquence, et un message à chaque battement serait du bruit pur.
export const SILENT_COLLECTIONS = new Set(["journal", "presence"]);

// Collections partageables (tout sauf la session).
export const SHARED_COLLECTIONS = Object.keys(COLLECTIONS).filter((n) => !COLLECTIONS[n].local);

// Collections écrites automatiquement par l'application au démarrage.
export const DOCUMENT_COLLECTIONS = ["config", "trames", "actes", "users"];

export const isSingleton = (name) => COLLECTIONS[name]?.kind === SINGLETON;
export const isLocalOnly = (name) => !!COLLECTIONS[name]?.local;

// Identifiant du document unique d'une collection singleton.
export const SELF = "self";

// ----------------------------------------------------------------- JSON stable
// Deux documents doivent se comparer de façon fiable quelle que soit l'ordre
// des clés (un aller-retour par un serveur SQL peut renormaliser un objet).
export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}

// ---------------------------------------------------------------- conversions
// Document → enregistrements (une entrée par objet de liste, `ord` = position).
export function recordsOf(name, value) {
  if (isSingleton(name)) return [{ id: SELF, ord: 0, payload: value ?? null }];
  const list = Array.isArray(value) ? value : [];
  return list.map((item, i) => ({
    id: String(item && item.id != null ? item.id : "idx-" + i),
    ord: i,
    payload: item,
  }));
}

// Enregistrements → document (triés par `ord`, qui porte l'ordre voulu).
export function docFromRecords(name, records) {
  const sorted = [...(records || [])].sort((a, b) => (a.ord || 0) - (b.ord || 0));
  if (isSingleton(name)) return sorted.length ? sorted[0].payload : null;
  return sorted.map((r) => r.payload);
}

// ------------------------------------------------------------------- diff/merge
// `base` : index { id: { rev, json } } de l'état connu du serveur.
// Renvoie les écritures et suppressions strictement nécessaires.
export function diffRecords(next, base) {
  const b = base || {};
  const upserts = [];
  const deletes = [];
  const seen = new Set();
  for (const r of next) {
    seen.add(r.id);
    const json = stableStringify(r.payload);
    const prev = b[r.id];
    if (!prev || prev.json !== json) upserts.push({ id: r.id, ord: r.ord, rev: prev ? prev.rev : null, payload: r.payload });
  }
  for (const id of Object.keys(b)) if (!seen.has(id)) deletes.push({ id, rev: b[id].rev });
  return { upserts, deletes };
}

// Index { id: {rev, json} } à partir de l'état local (sans rev connu).
export function indexOf(records) {
  const out = {};
  for (const r of records) out[r.id] = { rev: null, json: stableStringify(r.payload), ord: r.ord };
  return out;
}

// Applique les réponses du serveur à l'index local.
export function applyApplied(base, applied) {
  const out = { ...(base || {}) };
  for (const a of applied || []) {
    const cur = out[a.id] || {};
    out[a.id] = { ...cur, rev: a.rev };
  }
  return out;
}

// Réconcilie un document local avec les enregistrements que le serveur a
// refusés (modifiés ou supprimés ailleurs). Le serveur gagne : le document
// local est mis à jour **en place** (l'appelant garde sa référence), et les
// conflits sont signalés.
export function reconcile(name, value, conflicts) {
  if (!conflicts || !conflicts.length) return value;
  if (isSingleton(name)) {
    const c = conflicts[0];
    if (!c.deleted && c.payload && typeof c.payload === "object" && value && typeof value === "object") {
      for (const k of Object.keys(value)) if (!(k in c.payload)) delete value[k];
      Object.assign(value, c.payload);
    }
    return value;
  }
  const byId = new Map(conflicts.map((c) => [c.id, c]));
  const arr = Array.isArray(value) ? value : [];
  const removed = new Set();
  for (let i = 0; i < arr.length; i++) {
    const c = byId.get(String(arr[i] && arr[i].id));
    if (!c) continue;
    if (c.deleted) removed.add(arr[i].id);
    else arr[i] = c.payload;
  }
  if (removed.size) {
    for (let i = arr.length - 1; i >= 0; i--) if (removed.has(arr[i] && arr[i].id)) arr.splice(i, 1);
  }
  return arr;
}

// ---------------------------------------------------------------- limites/taille
export const LIMITS = {
  // Une requête de synchronisation doit tenir dans un message WebSocket (1 Mio).
  socketChars: 850000,
  // Le service de démonstration garde son état dans un tampon de taille fixe.
  httpChars: 8000000,
};

export const bytesOf = (v) => stableStringify(v).length;
