// ============================================================================
// Provisionnement et administration des clés du service de publication.
//
// Le service ne contient aucun secret : les clés d'écriture sont des clés
// portables remises aux postes, dont seule l'empreinte est conservée (voir
// index.html, « clés d'API »). Ce module porte les appels correspondants :
//   • savoir si le service est provisionné ;
//   • le provisionner (le tout premier dépôt de clé) ;
//   • créer, lister et révoquer des clés ;
//   • lire le journal d'audit tenu par le service.
//
// La clé est TIRÉE PAR LE POSTE (`crypto.getRandomValues`) : elle ne circule
// que dans le sens poste → service, et le service n'en garde que l'empreinte.
// ============================================================================
import { call } from "./remote.js";

const detail = (r) => (r && r.body && (r.body.erreur || r.body.message)) || ("Erreur " + (r && r.status));

export async function etatService() {
  try {
    const r = await call("GET", "/v1/auth/etat");
    if (!r.ok) return { ok: false, status: r.status, detail: detail(r) };
    return { ok: true, provisionne: r.body.provisionne === true, roles: r.body.roles || [], mode: r.body.mode || "" };
  } catch (e) {
    return { ok: false, status: 0, detail: String((e && e.message) || e) };
  }
}

// Clé aléatoire de 32 octets (64 caractères hexadécimaux). `crypto` est
// disponible dans le navigateur ; le repli n'existe que pour les moteurs de
// test qui ne l'exposent pas.
export function tirerCle(octets = 32) {
  const n = Math.max(16, Number(octets) || 32);
  const b = new Uint8Array(n);
  if (globalThis.crypto && globalThis.crypto.getRandomValues) globalThis.crypto.getRandomValues(b);
  else for (let i = 0; i < n; i++) b[i] = Math.floor(Math.random() * 256);
  let s = "";
  for (const x of b) s += x.toString(16).padStart(2, "0");
  return s;
}

export async function provisionnerService({ cle, label = "Administrateur", role = "administrateur" } = {}) {
  const jeton = cle || tirerCle();
  try {
    const r = await call("POST", "/v1/auth/bootstrap", { body: { cle: jeton, label, role } });
    if (!r.ok) return { ok: false, status: r.status, detail: detail(r), cle: jeton };
    return { ok: true, cle: jeton, id: r.body.id, role: r.body.role, label: r.body.label };
  } catch (e) {
    return { ok: false, status: 0, detail: String((e && e.message) || e), cle: jeton };
  }
}

export async function listerCles(token) {
  const r = await call("GET", "/v1/auth/cles", { token });
  if (!r.ok) return { ok: false, status: r.status, detail: detail(r) };
  return { ok: true, cles: r.body.cles || [] };
}

export async function creerCle({ cle, label = "", role = "lecteur", token } = {}) {
  const jeton = cle || tirerCle();
  const r = await call("POST", "/v1/auth/cles", { token, body: { cle: jeton, label, role } });
  if (!r.ok) return { ok: false, status: r.status, detail: detail(r), cle: jeton };
  return { ok: true, cle: jeton, id: r.body.id, role: r.body.role, label: r.body.label };
}

export async function revoquerCle(id, token) {
  const r = await call("POST", "/v1/auth/cles/" + encodeURIComponent(id) + "/revoquer", { token, body: {} });
  if (!r.ok) return { ok: false, status: r.status, detail: detail(r) };
  return { ok: true, id: r.body.id };
}

export async function journalService({ token, limite = 200 } = {}) {
  const r = await call("GET", "/v1/journal", { token });
  if (!r.ok) return { ok: false, status: r.status, detail: detail(r) };
  return { ok: true, entrees: r.body.entrees || [], total: r.body.total, scelle: r.body.scelle === true };
}
