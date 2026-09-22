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

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Un échec de TRANSPORT n'est pas un refus : le service s'est reconstruit (canal
// fermé, code 1011), et le dire tel quel évite de laisser croire à une panne.
const messageTransport = (e) => {
  const t = String((e && e.message) || e);
  return /1011|websocket|injoignable|ferm/i.test(t)
    ? "Le service s'est reconstruit pendant l'opération (le canal s'est fermé). Rien n'a été écrit : réessayez dans un instant."
    : t;
};

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

// Le provisionnement est le seul geste qui OUVRE un service neuf : c'est aussi
// celui qu'un service en reconstruction fait échouer (canal fermé, code 1011 —
// l'environnement d'édition recharge son état et referme le canal en cours).
// Trois précautions, apprises d'un essai de bout en bout :
//   • la MÊME clé est rejouée d'une tentative à l'autre — en tirer une nouvelle
//     laisserait le service provisionné avec une clé que le poste n'a pas ;
//   • un service « déjà provisionné » n'est PAS une erreur si c'est notre clé :
//     la réponse a pu se perdre alors que le dépôt avait abouti (une lecture des
//     clés avec cette clé tranche) ;
//   • l'échec, s'il persiste, dit qu'il faut réessayer, au lieu de laisser
//     croire à une panne.
export async function provisionnerService({ cle, label = "Administrateur", role = "administrateur", tentatives = 3 } = {}) {
  const jeton = cle || tirerCle();
  const repris = { ok: true, cle: jeton, id: "", role, label, repris: true };
  let dernier = null;
  for (let i = 0; i < Math.max(1, tentatives); i++) {
    if (i) await dormir(700 * i);
    try {
      const r = await call("POST", "/v1/auth/bootstrap", { body: { cle: jeton, label, role } });
      if (r.ok) return { ok: true, cle: jeton, id: r.body.id, role: r.body.role, label: r.body.label };
      // Déjà provisionné par quelqu'un — ou par NOUS, dont la réponse s'est
      // perdue : la clé le dit.
      if (r.status === 409) {
        const verif = await call("GET", "/v1/auth/cles", { token: jeton });
        if (verif.ok) return repris;
      }
      dernier = { ok: false, status: r.status, detail: detail(r), cle: jeton };
      if (r.status !== 0 && r.status !== 1011) break;   // refus franc : inutile d'insister
    } catch (e) {
      dernier = { ok: false, status: 0, detail: messageTransport(e), cle: jeton };
    }
  }
  // Dernier filet : le dépôt a pu aboutir sans que la réponse revienne.
  try {
    const verif = await call("GET", "/v1/auth/cles", { token: jeton });
    if (verif.ok) return repris;
  } catch (e) { /* le service ne répond toujours pas */ }
  return dernier || { ok: false, status: 0, detail: "Le service est injoignable.", cle: jeton };
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
