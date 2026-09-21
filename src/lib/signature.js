// ============================================================================
// Signature électronique.
//
// Le module remplit deux rôles bien distincts :
//
//  1. La **cryptographie** réellement exécutée : empreinte SHA-256 du document,
//     signature ECDSA P-256, horodatage, et vérification. Ce n'est pas une
//     maquette : la signature produite est vérifiable par n'importe qui à partir
//     de la clé publique contenue dans le certificat, et la vérification est
//     refaite à la consultation de l'acte publié.
//
//  2. La **simulation du prestataire** de signature (type ESUP-Signature) :
//     dépôt du document, ajout des signataires, démarrage du circuit, signature,
//     relève du statut. Les échanges sont tracés dans le journal comme de vrais
//     appels sortants.
//
// Le certificat est un certificat de démonstration : il n'est pas délivré par
// une autorité de certification qualifiée, et la clé privée est créée dans le
// navigateur. La signature est donc cryptographiquement valide, mais elle n'a
// pas la valeur juridique d'une signature qualifiée au sens eIDAS.
// ============================================================================

import { recordExternal } from "./remote.js";
import { hostKv } from "./hosts.js";
import { A4_WIDTH, A4_HEIGHT, A4_MARGIN } from "./paper.js";

const b64 = (bytes) => {
  let s = "";
  const u8 = new Uint8Array(bytes);
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
};

const hex = (bytes) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
const utf8 = (s) => new TextEncoder().encode(String(s));

export async function sha256Hex(text) {
  return hex(await crypto.subtle.digest("SHA-256", utf8(text)));
}

// ------------------------------------------------------------------- clés/AC

function kv() {
  return hostKv();
}

const FOLDER = "actesCertificats";
const memory = {};

async function readCert(key) {
  if (memory[key]) return memory[key];
  const k = kv();
  if (!k) return null;
  try { return (memory[key] = (await k[FOLDER].get(key)) || null); } catch { return null; }
}

async function writeCert(key, value) {
  memory[key] = value;
  const k = kv();
  if (!k) return;
  try { await k[FOLDER].set(key, value); } catch (e) { console.warn("Certificat non enregistré :", e); }
}

const AUTHORITY = {
  signataire: {
    label: "Autorité de certification (poste de signature)",
    subject: (brand, who, org) => `CN=${who || "Signataire"}, OU=${org || brand}, O=${brand}, C=FR`,
    issuer: (brand) => `CN=AC Scribae — démonstration (non qualifiée), O=${brand}, C=FR`,
  },
  horodatage: {
    label: "Autorité d'horodatage",
    subject: (brand) => `CN=Horodatage Scribae — démonstration, O=${brand}, C=FR`,
    issuer: (brand) => `CN=AC Scribae — démonstration (non qualifiée), O=${brand}, C=FR`,
  },
};

// Crée (une seule fois par navigateur et par titulaire) la paire de clés et son
// certificat. Deux signataires différents ont donc deux certificats distincts,
// comme dans un vrai poste de signature.
export async function certificate(kind = "signataire", { brand = "", subject = "", org = "" } = {}) {
  const a = AUTHORITY[kind] || AUTHORITY.signataire;
  const sujet = a.subject(brand || "Établissement", subject, org);
  const existing = await readCert(kind + ":" + sujet);
  if (existing) return existing;
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const serial = hex(crypto.getRandomValues(new Uint8Array(8)));
  const now = new Date();
  // Validité large (trois ans de part et d'autre) : le jeu de démonstration
  // contient des actes signés plusieurs mois avant l'ouverture de cette page.
  const from = new Date(now.getTime() - 1000 * 60 * 60 * 24 * 365 * 3);
  const until = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 365 * 3);
  const cert = {
    version: "3 (démonstration)",
    sujet,
    emetteur: a.issuer(brand || "Établissement"),
    numeroSerie: serial.toUpperCase(),
    algorithme: "ECDSA P-256 / SHA-256",
    valideDu: from.toISOString(),
    valideAu: until.toISOString(),
    usage: "Signature électronique de documents (démonstration)",
    clePublique: publicJwk,
  };
  cert.empreinte = await sha256Hex(JSON.stringify({ sujet: cert.sujet, ser: cert.numeroSerie, cle: publicJwk }));
  const record = { cert, jwk: { publicKey: publicJwk, privateKey: privateJwk } };
  await writeCert(kind, record);
  return record;
}

async function signWith(record, text) {
  const key = await crypto.subtle.importKey("jwk", record.jwk.privateKey, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, utf8(text));
  return b64(sig);
}

async function verifyWith(cert, text, valueB64) {
  const key = await crypto.subtle.importKey("jwk", cert.clePublique, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
  const raw = Uint8Array.from(atob(valueB64), (c) => c.charCodeAt(0));
  return crypto.subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, raw, utf8(text));
}

// ------------------------------------------------------- l'original signé

// Un « original signé » : le document (Akoma Ntoso, source de vérité) figé à la
// signature, ses signatures, son horodatage, et la page consultable qui
// présente la signature au même niveau que le texte.
//
// `interne` est le DOSSIER DE SIGNATURE — la part de l'original qui ne se
// diffuse pas. Il porte ce qui identifie le signataire au sens des données
// personnelles (son adresse, son compte, la façon dont il s'est authentifié)
// et les courriels de notification qui ont été envoyés. L'original signé est
// donc scindé en deux : sa PARTIE PUBLIQUE (le paquet sans `interne`, et sans
// les coordonnées du signataire), qui part au recueil, et sa part interne, qui
// reste au registre et ne se lit qu'avec une session (voir `partiePublique`).
export async function buildSignedPackage({ akn, pageHtml, pageCss, numero, objet, signataire, prestataire, brand, signeLe, interne = null }) {
  const empreinte = await sha256Hex(akn);
  const auth = await certificate("signataire", { brand, subject: signataire.nom, org: signataire.entite });
  const signedAt = signeLe || new Date().toISOString();
  const valeur = await signWith(auth, akn);

  const tsa = await certificate("horodatage", { brand });
  const emisLe = signedAt;
  const jeton = `${empreinte}|${emisLe}`;
  const horodatage = {
    emisPar: "Horodatage Scribae — démonstration",
    emisLe,
    algorithme: "ECDSA P-256 / SHA-256",
    empreinte,
    valeur: await signWith(tsa, jeton),
    certificat: tsa.cert,
  };

  const pack = {
    format: "application/vnd.actes.original-signe+json",
    version: 1,
    reference: numero || "",
    objet: objet || "",
    document: { akn, sha256: empreinte },
    signatures: [{
      signataire,
      signeLe: signedAt,
      algorithme: "ECDSA P-256 / SHA-256",
      valeur,
      certificat: auth.cert,
    }],
    horodatage,
    prestataire: prestataire ? { id: prestataire.id, nom: prestataire.nom, niveau: prestataire.niveau } : null,
  };
  // Le dossier interne, quand il est fourni : c'est la part non diffusable de
  // l'original (coordonnées du signataire, compte, authentification, courriels
  // de notification). Il n'apparaît JAMAIS dans la page publique — voir
  // `partiePublique`.
  if (interne) pack.interne = { format: "application/vnd.actes.dossier-signature+json", version: 1, ...interne };
  pack.pageHtml = originalPageHtml(pack, pageHtml, brand, pageCss);
  return pack;
}

// La PARTIE PUBLIQUE d'un original signé : le paquet débarrassé de son dossier
// interne, et de tout ce qui, dans l'identité du signataire, n'a pas à être
// publié — l'adresse électronique, le rattachement au compte, le compte de
// l'outil de signature et l'état du rapprochement. Ce qui reste (nom, fonction,
// entité) est ce que la signature donne à lire au public.
//
// C'est cette partie-là qui est déposée au recueil ; la part interne reste au
// registre, sous `originalInterne`, et ne se lit qu'avec une session.
export function partiePublique(pack) {
  if (!pack || typeof pack !== "object") return pack;
  const { interne, ...reste } = pack;
  const signatures = (pack.signatures || []).map((s) => {
    const sig = { ...(s.signataire || {}) };
    delete sig.courriel;
    delete sig.personId;
    delete sig.compteId;
    delete sig.compteOutil;
    delete sig.rapproche;
    return { ...s, signataire: sig };
  });
  return { ...reste, signatures };
}

// Le dossier INTERNE d'un acte signé : la part non diffusable de l'original,
// qu'elle provienne de la signature simple (signée dans l'application) ou d'un
// circuit électronique. Rend `null` quand l'original n'en porte pas.
export function dossierInterne(pack) {
  return (pack && pack.interne) || null;
}

// Vérification complète : c'est cette fonction qui tourne à la consultation.
export async function verifySignedPackage(pack) {
  const checks = [];
  if (!pack || !pack.document) return { ok: false, checks: [{ label: "Structure de l'original", ok: false, detail: "Document illisible" }] };
  const empreinte = await sha256Hex(pack.document.akn || "");
  checks.push({
    label: "Intégrité du document",
    ok: empreinte === pack.document.sha256,
    detail: `SHA-256 ${empreinte.slice(0, 16)}… ${empreinte === pack.document.sha256 ? "correspond à l'empreinte signée" : "NE CORRESPOND PAS"}`,
  });
  for (const s of pack.signatures || []) {
    let ok = false;
    let detail = "";
    try {
      ok = await verifyWith(s.certificat, pack.document.akn, s.valeur);
      detail = ok ? "clé publique du certificat" : "signature invalide pour cette clé";
    } catch (e) { detail = "vérification impossible : " + ((e && e.message) || e); }
    checks.push({ label: `Signature — ${s.signataire?.nom || "signataire"}`, ok, detail: `${s.algorithme || "ECDSA"} · ${detail}` });
  }
  const h = pack.horodatage;
  if (h) {
    let ok = false;
    let detail = "";
    try {
      ok = await verifyWith(h.certificat, `${h.empreinte}|${h.emisLe}`, h.valeur);
      detail = ok ? "horodatage cohérent avec l'empreinte" : "horodatage invalide";
    } catch (e) { detail = "vérification impossible"; }
    checks.push({ label: "Horodatage", ok, detail: `${h.emisPar} · ${detail}` });
  }
  return { ok: checks.every((c) => c.ok), checks };
}

// La page « original signé » : le texte de l'acte suivi du bloc de signature
// (identité, certificat, empreinte, horodatage). C'est le document qu'on
// consulte pour vérifier qui a signé quoi, et quand.
//
// Le corps du document est habillé par la charte de l'acte : `pageCss` est la
// feuille de style du document (`documentCss`), la même que celle du HTML
// autonome et du PDF — l'original signé ne se présente donc pas autrement que
// l'acte imprimé.
function originalPageHtml(pack, bodyHtml, brand, pageCss) {
  const s = (pack.signatures || [])[0] || {};
  const c = s.certificat || {};
  const h = pack.horodatage || {};
  const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const dt = (x) => (x ? new Date(x).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" }) : "—");
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Original signé — ${esc(pack.reference)}</title>
<style>
body{margin:0;background:#eef1f5;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;color:#161616}
.wrap{width:${A4_WIDTH};max-width:100%;margin:0 auto;padding:20px 0 40px}
.banner{background:#0b5a2b;color:#fff;padding:8px 14px;border-radius:4px;font-size:.82rem;display:flex;gap:10px;align-items:center;margin-bottom:12px}
.paper{width:100%;min-height:${A4_HEIGHT};background:#fff;padding:${A4_MARGIN};box-shadow:0 1px 3px rgba(0,0,0,.14)}
${pageCss || ""}
.sig{margin-top:1.8em;border:1px solid #b6c2d2;border-radius:4px;background:#f7f9fc;padding:14px 16px;font-size:.84rem}
.sig h3{margin:0 0 8px;font-size:1rem}
.sig table{border-collapse:collapse;width:100%}
.sig th{text-align:left;vertical-align:top;width:34%;padding:2px 8px 2px 0;font-weight:600;color:#3a3a3a}
.sig td{padding:2px 0;word-break:break-all}
.hash{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.78rem}
.stamp{margin-top:10px;padding:8px 10px;border-left:3px solid #0b5a2b;background:#eef7f1;font-size:.8rem}
@media (max-width:860px){.wrap{padding:12px 0 30px}.paper{padding:1.2cm 1cm;min-height:0}}
@media print{body{background:#fff}.wrap{width:auto;max-width:none;padding:0}.paper{width:auto;min-height:0;padding:0;box-shadow:none}.banner{display:none}.doc-title,.sig{break-inside:avoid;page-break-inside:avoid}}
</style></head><body><div class="wrap">
<div class="banner"><strong>Original signé</strong><span>${esc(brand)} · ${esc(pack.reference)} · signé le ${esc(dt(s.signeLe))}</span></div>
<div class="paper"><div class="doc">${bodyHtml || ""}</div>
<div class="sig">
  <h3>Signature électronique</h3>
  <table>
    <tr><th>Signataire</th><td>${esc(s.signataire?.nom || "")}${s.signataire?.fonction ? " — " + esc(s.signataire.fonction) : ""}</td></tr>
    <tr><th>Date de signature</th><td>${esc(dt(s.signeLe))}</td></tr>
    <tr><th>Algorithme</th><td>${esc(s.algorithme)}</td></tr>
    <tr><th>Empreinte du document</th><td class="hash">SHA-256 ${esc(pack.document.sha256)}</td></tr>
    <tr><th>Valeur de signature</th><td class="hash">${esc(String(s.valeur || "").slice(0, 96))}…</td></tr>
    <tr><th>Certificat</th><td>${esc(c.sujet || "")}<br><span class="hash">n° ${esc(c.numeroSerie || "")} — ${esc(c.algorithme || "")}</span><br>Délivré par ${esc(c.emetteur || "")}<br>Valide du ${esc(dt(c.valideDu))} au ${esc(dt(c.valideAu))}<br><span class="hash">empreinte ${esc(String(c.empreinte || "").slice(0, 32))}…</span></td></tr>
  </table>
  <div class="stamp"><strong>Horodatage</strong> — ${esc(h.emisPar || "")}, ${esc(dt(h.emisLe))}<br>
  <span class="hash">jeton ${esc(String(h.valeur || "").slice(0, 64))}…</span><br>
  <span class="hash">empreinte horodatée ${esc(String(h.empreinte || "").slice(0, 32))}…</span></div>
  <p style="margin:8px 0 0;font-size:.76rem;color:#555">Certificat de démonstration. La signature est cryptographiquement vérifiable, mais ce certificat n'est pas qualifié au sens du règlement eIDAS.</p>
</div>
</div></div></body></html>`;
}

// -------------------------------------------------- prestataire (simulation)

// Le prestataire est décrit comme un service distant : il a sa propre API, son
// propre vocabulaire, ses propres statuts. Les appels ci-dessous sont tracés
// dans le journal comme des appels sortants (méthode, URL, corps, réponse).
export const PRESTATAIRE = {
  id: "esup-signature",
  nom: "ESUP-Signature (simulation)",
  baseUrl: "https://signature.valmont-sur-loire.fr/api/v1",
  niveau: "signature avancée — certificat de démonstration",
  fournisseur: "Prestataire de démonstration embarqué",
};

const dossiers = new Map();
let seq = 0;

export function resetPrestataire() { dossiers.clear(); seq = 0; }

async function external(recordFn, { flow, method, url, request, label }) {
  const t0 = performance.now();
  let response = null;
  let status = 0;
  try {
    const out = await recordFn();
    response = out.response; status = out.status;
    recordExternal({ service: "prestataire", method, url, request, response, status, ms: Math.round(performance.now() - t0), flow, label });
    return out.value;
  } catch (e) {
    recordExternal({ service: "prestataire", method, url, request, response: { erreur: String((e && e.message) || e) }, status: e.status || 500, ms: Math.round(performance.now() - t0), flow, label });
    throw e;
  }
}

export const prestataire = {
  // Dépôt du document à signer (l'acte finalisé).
  async creerDocument({ xml, titre, reference, flow, signataire }) {
    return external(
      async () => {
        seq += 1;
        const id = "DOC-" + String(seq).padStart(4, "0") + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
        const dossier = { id, titre, reference, xml, statut: "en_attente", signataires: [], signataire: signataire || null, documentSigne: null, creeLe: new Date().toISOString() };
        dossiers.set(id, dossier);
        return { value: dossier, response: { id, statut: "en_attente", reference, horodatage: dossier.creeLe }, status: 201 };
      },
      {
        flow, method: "POST", url: PRESTATAIRE.baseUrl + "/documents", label: "Dépôt du document auprès du prestataire",
        request: { content_type: "application/akn+xml", reference, titre, taille: (xml || "").length, sha256: await sha256Hex(xml || "") },
      },
    );
  },

  async ajouterSignataire({ docId, signataire, flow }) {
    return external(
      async () => {
        const d = require_(docId);
        d.signataires.push({ nom: signataire.nom, courriel: signataire.courriel, ordre: d.signataires.length + 1 });
        d.signataire = signataire;
        d.statut = "signataires_ajoutes";
        return { value: { ...d }, response: { id: docId, statut: d.statut, signataires: d.signataires }, status: 200 };
      },
      { flow, method: "POST", url: PRESTATAIRE.baseUrl + `/documents/${docId}/signataires`, label: "Ajout du signataire", request: signataire },
    );
  },

  async demarrer({ docId, flow }) {
    return external(
      async () => {
        const d = require_(docId);
        d.statut = "en_cours";
        d.demarreLe = new Date().toISOString();
        const lien = `${PRESTATAIRE.baseUrl}/signature/${docId}`;
        return { value: { ...d, lienSignature: lien }, response: { id: docId, statut: "en_cours", lien_signature: lien }, status: 200 };
      },
      { flow, method: "POST", url: PRESTATAIRE.baseUrl + `/documents/${docId}/demarrer`, label: "Démarrage du circuit de signature", request: null },
    );
  },

  // Le geste de signature : c'est ici que la cryptographie est réellement faite.
  async signer({ docId, signataire, pageHtml, pageCss, brand, flow, interne = null }) {
    return external(
      async () => {
        const d = require_(docId);
        const pack = await buildSignedPackage({
          akn: d.xml, pageHtml, pageCss, numero: d.reference, objet: d.titre,
          signataire, prestataire: PRESTATAIRE, brand, interne,
        });
        d.documentSigne = pack;
        d.statut = "signee";
        d.signeLe = pack.signatures[0].signeLe;
        return {
          value: pack,
          response: {
            id: docId, statut: "signee",
            signataires: [{ nom: signataire.nom, signe_le: d.signeLe }],
            empreinte: pack.document.sha256,
            format_document_signe: pack.format,
          },
          status: 200,
        };
      },
      {
        flow, method: "POST", url: PRESTATAIRE.baseUrl + `/documents/${docId}/signature`, label: "Signature par le signataire (cryptographie réelle)",
        request: { signataire: signataire.nom, algorithme: "ECDSA P-256 / SHA-256", certificat: "certificat de démonstration" },
      },
    );
  },

  async releverStatut({ docId, flow, silencieux = false }) {
    const run = async () => {
      const d = dossiers.get(docId);
      if (!d) throw new Error("Dossier inconnu du prestataire : " + docId);
      return {
        value: { ...d },
        response: { id: d.id, statut: d.statut, signataires: d.signataires, signe_le: d.signeLe || null, empreinte: d.documentSigne?.document?.sha256 || null },
        status: 200,
      };
    };
    if (silencieux) return run().then((r) => r.value);
    return external(run, { flow, method: "GET", url: PRESTATAIRE.baseUrl + `/documents/${docId}`, label: "Relevé du statut auprès du prestataire", request: null });
  },

  dossier: (docId) => dossiers.get(docId) || null,
};

function require_(docId) {
  const d = dossiers.get(docId);
  if (!d) throw new Error("Dossier inconnu du prestataire : " + docId);
  return d;
}
