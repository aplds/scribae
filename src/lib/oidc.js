// ============================================================================
// OpenID Connect — client d'annuaire (Authorization Code + PKCE).
//
// Ce module est le **client public** de la collectivité : il n'y a ni secret
// client ni serveur intermédiaire, donc :
//   - PKCE (S256) protège l'échange du code — un client public ne peut pas
//     garder un secret, et n'en a pas besoin ;
//   - `state` et `nonce` sont tirés au hasard à chaque tentative et confrontés
//     au retour du fournisseur (protection contre la rejouure et le mélange de
//     flux) ;
//   - le jeton d'identité (`id_token`) est vérifié AVANT d'ouvrir la session :
//     émetteur, audience, période de validité, nonce, et **signature** (JWKS,
//     RS/PS/ES). Un jeton non signé (`alg: none`) ou signé symétriquement est
//     refusé : un client public ne détient aucune clé partagée.
//
// Ce qui vient de l'annuaire est traduit en compte de l'application
// (`applyOidcUser`) : identité, rôle (groupes → rôles) et périmètre (services,
// entité). Le rôle de l'annuaire devient le rôle PRINCIPAL du compte ; les
// qualités cumulées attribuées dans l'application (le rôle « Réviseur », par
// exemple) sont conservées — elles ne viennent pas des groupes. Un agent
// inconnu est créé à sa première connexion si l'administrateur l'a autorisé ;
// sinon la connexion est refusée avec un message explicite. Un agent dont aucun
// groupe ne correspond à un rôle devient **Visiteur** : authentifié, sans accès,
// accueilli par un écran qui le lui explique (voir src/ui/views/sans-acces.js).
//
// L'annuaire d'essai intégré (`TEST_IDENTITIES`) exerce le même chemin de code
// sans réseau : il sert à vérifier le branchement, et il est signalé comme tel
// (ses jetons ne sont pas vérifiés, il ne s'agit pas d'une authentification).
// ============================================================================
import { authConfig, isTestProvider, annuaireParLeService, DEFAULT_AUTH } from "./auth.js";
import { post, bodyOf } from "./remote.js";
import { newUser, uniqueLogin, rolesOf, estCumulable, setRoles, VISITEUR } from "./users.js";

export class AuthError extends Error {
  constructor(message, code = "auth_error") {
    super(message);
    this.name = "AuthError";
    this.code = code;
  }
}

// ------------------------------------------------------------ encodage / aléa
const enc = new TextEncoder();
const dec = new TextDecoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function bytesOfB64url(str) {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
  const bin = atob(s + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const textOfB64url = (str) => dec.decode(bytesOfB64url(str));

export function randomUrlSafe(bytes = 32) {
  const a = new Uint8Array(bytes);
  (crypto || window.crypto).getRandomValues(a);
  return b64url(a);
}

const subtle = () => {
  const c = globalThis.crypto;
  if (!c || !c.subtle) throw new AuthError("Le chiffrement du navigateur est indisponible : la connexion OIDC exige HTTPS (ou http://localhost).", "insecure_context");
  return c.subtle;
};

export async function pkceChallenge(verifier) {
  const digest = await subtle().digest("SHA-256", enc.encode(verifier));
  return b64url(new Uint8Array(digest));
}

// --------------------------------------------------------- flux en cours
// Le flux (vérificateur PKCE, state, nonce) vit dans sessionStorage : il
// disparaît à la fermeture de l'onglet, et n'est jamais partagé entre onglets.
const FLOW_KEY = "scribae.oidc.flow";

export function readFlow() {
  try { return JSON.parse(sessionStorage.getItem(FLOW_KEY) || "null"); } catch { return null; }
}
export function clearFlow() { try { sessionStorage.removeItem(FLOW_KEY); } catch { /* ignore */ } }
function saveFlow(flow) { try { sessionStorage.setItem(FLOW_KEY, JSON.stringify(flow)); } catch { /* ignore */ } }

// ------------------------------------------------------------- découverte
export const discoveredIssuer = (issuer) => String(issuer || "").trim().replace(/\/+$/, "");

// LA DÉCOUVERTE PAR LE SERVICE. Quand le service de la collectivité est le
// client OIDC (drapeau `annuaireService` de `GET /v1/auth/config`), c'est LUI
// qui lit `/.well-known/openid-configuration` : l'appel part d'une machine à
// l'autre, et le fournisseur n'a pas à publier d'en-têtes CORS pour
// l'application. C'est aussi ce qui fait fonctionner le bouton « Découverte » de
// l'administration sur un annuaire qui n'ouvre pas le CORS (Keycloak, LemonLDAP,
// ADFS…) : depuis le navigateur, ces fournisseurs répondaient « Découverte
// impossible (Failed to fetch) » — un refus du navigateur, pas une adresse
// fausse. Voir docs/ADMINISTRATION.md § 4.4.
//
// `issuer` et `endpoints` ne sont transmis que par l'Administration › Annuaire,
// pour éprouver une adresse avant de l'enregistrer : le service ne va pas
// chercher une adresse arbitraire pour le premier venu (voir la route).
export async function decouvrirParLeService({ issuer = "", endpoints = null } = {}) {
  const res = await post("/v1/auth/annuaire/decouverte", endpoints ? { issuer, endpoints } : { issuer });
  const body = bodyOf(res);
  if (!res.ok) throw new AuthError(body.erreur || "Découverte impossible par le service.", body.code || "discovery_failed");
  const ep = body.endpoints || {};
  return {
    issuer: discoveredIssuer(ep.issuer),
    authorization_endpoint: ep.authorization_endpoint || "",
    token_endpoint: ep.token_endpoint || "",
    jwks_uri: ep.jwks_uri || "",
    userinfo_endpoint: ep.userinfo_endpoint || "",
    source: body.source || "découverte",
  };
}

// L'ÉCHANGE PAR LE SERVICE. Le navigateur lui remet le code d'autorisation et le
// vérificateur PKCE (qu'il est seul à détenir, et qui ne quitte l'onglet que
// pour cette requête, sur la même origine), et reçoit en retour une SESSION DU
// SERVICE — les mêmes cookies que la connexion par mot de passe. Le jeton
// d'accès et le jeton d'identité ne traversent jamais le navigateur : le service
// les reçoit du fournisseur, les vérifie, et ouvre sa session (voir
// src/server/mysql/annuaire-service.mjs).
export async function connexionParLeService({ code, verifier, redirectUri, nonce }) {
  const res = await post("/v1/auth/annuaire", { code, verifier, redirectUri, nonce });
  const body = bodyOf(res);
  if (!res.ok) throw new AuthError(body.erreur || "Le service a refusé la connexion par l'annuaire.", body.code || "token_rejected");
  return { session: body, checks: body.checks || [], warnings: body.warnings || [] };
}

// Points de terminaison : ceux saisis à la main, sinon ceux publiés par le
// fournisseur (/.well-known/openid-configuration).
export async function discover(auth) {
  const forced = auth.endpoints || {};
  if (forced.authorization && forced.token) {
    return {
      issuer: discoveredIssuer(auth.issuer),
      authorization_endpoint: forced.authorization,
      token_endpoint: forced.token,
      jwks_uri: forced.jwks || "",
      userinfo_endpoint: forced.userinfo || "",
      source: "manuel",
    };
  }
  const base = discoveredIssuer(auth.issuer);
  if (!base) throw new AuthError("Aucune adresse de fournisseur n'est configurée.", "no_issuer");
  // LE SERVICE D'ABORD, quand c'est lui le client OIDC : aucun appel ne part
  // alors du navigateur. On ne retombe pas sur un appel direct si le service
  // échoue : le navigateur serait refusé par le CORS, et l'erreur affichée
  // (celle du navigateur) désignerait la mauvaise cause.
  if (annuaireParLeService()) return decouvrirParLeService();
  const url = base + "/.well-known/openid-configuration";
  let doc;
  try {
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    doc = await res.json();
  } catch (e) {
    throw new AuthError(
      "Découverte impossible sur " + url + " (" + ((e && e.message) || e) + "). " +
      "Vérifiez l'adresse de l'émetteur, ou saisissez les points de terminaison à la main.", "discovery_failed");
  }
  const out = {
    issuer: discoveredIssuer(doc.issuer || base),
    authorization_endpoint: forced.authorization || doc.authorization_endpoint || "",
    token_endpoint: forced.token || doc.token_endpoint || "",
    jwks_uri: forced.jwks || doc.jwks_uri || "",
    userinfo_endpoint: forced.userinfo || doc.userinfo_endpoint || "",
    source: "découverte",
  };
  if (!out.authorization_endpoint || !out.token_endpoint) {
    throw new AuthError("Le document de découverte ne publie pas les points de terminaison attendus.", "bad_discovery");
  }
  return out;
}

// --------------------------------------------------------------- connexion
// Prépare la redirection. `navigate(url)` laisse l'appelant décider (le flux
// d'essai ne redirige pas, il remplit les mêmes étapes en mémoire).
export async function buildAuthorizationUrl(auth, { redirectUri }) {
  if (isTestProvider(auth)) throw new AuthError("L'annuaire d'essai ne redirige pas.", "test_provider");
  const ep = await discover(auth);
  const verifier = randomUrlSafe(48);
  const challenge = await pkceChallenge(verifier);
  const state = randomUrlSafe(16);
  const nonce = randomUrlSafe(16);
  saveFlow({ verifier, state, nonce, redirectUri, at: Date.now(), issuer: ep.issuer, test: false });

  const url = new URL(ep.authorization_endpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", auth.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", auth.scopes || "openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (auth.prompt) url.searchParams.set("prompt", auth.prompt);
  return { url: url.href, flow: { state, nonce }, endpoints: ep };
}

async function exchangeCode(auth, ep, { code, verifier, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: auth.clientId,
    code_verifier: verifier,
  });
  let res, text;
  try {
    res = await fetch(ep.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: body.toString(),
    });
    text = await res.text();
  } catch (e) {
    throw new AuthError("Échange du code impossible (" + ((e && e.message) || e) + "). " +
      "Le fournisseur doit autoriser l'appel depuis le navigateur (en-têtes CORS) pour cette adresse.", "token_unreachable");
  }
  let data = null;
  try { data = JSON.parse(text); } catch { /* réponse non JSON */ }
  if (!res.ok || !data) {
    const detail = (data && (data.error_description || data.error)) || text.slice(0, 200) || ("HTTP " + res.status);
    throw new AuthError("Le fournisseur a refusé l'échange du code : " + detail +
      (String(detail).includes("invalid_client") ? " (un client public se configure SANS secret : activez PKCE côté fournisseur)" : ""), "token_error");
  }
  if (!data.id_token) throw new AuthError("Le fournisseur n'a pas renvoyé de jeton d'identité (id_token).", "no_id_token");
  return data;
}

// -------------------------------------------------------- jeton d'identité
export const decodeToken = (token) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new AuthError("Jeton d'identité illisible.", "bad_token");
  let header, payload;
  try {
    header = JSON.parse(textOfB64url(parts[0]));
    payload = JSON.parse(textOfB64url(parts[1]));
  } catch { throw new AuthError("Jeton d'identité illisible (en-tête ou revendications).", "bad_token"); }
  return { header, payload, signingInput: parts[0] + "." + parts[1], signature: parts[2] };
};

const ALGOS = {
  RS256: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
  RS384: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-384" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
  RS512: { import: { name: "RSASSA-PKCS1-v1_5", hash: "SHA-512" }, verify: { name: "RSASSA-PKCS1-v1_5" } },
  PS256: { import: { name: "RSA-PSS", hash: "SHA-256" }, verify: { name: "RSA-PSS", saltLength: 32 } },
  PS384: { import: { name: "RSA-PSS", hash: "SHA-384" }, verify: { name: "RSA-PSS", saltLength: 48 } },
  PS512: { import: { name: "RSA-PSS", hash: "SHA-512" }, verify: { name: "RSA-PSS", saltLength: 64 } },
  ES256: { import: { name: "ECDSA", namedCurve: "P-256" }, verify: { name: "ECDSA", hash: "SHA-256" } },
  ES384: { import: { name: "ECDSA", namedCurve: "P-384" }, verify: { name: "ECDSA", hash: "SHA-384" } },
};

async function fetchJwks(uri) {
  try {
    const res = await fetch(uri, { headers: { accept: "application/json" } });
    if (!res.ok) return { error: "HTTP " + res.status };
    return { jwks: await res.json() };
  } catch (e) {
    return { error: (e && e.message) || String(e) };
  }
}

async function verifySignature({ header, signingInput, signature }, jwks) {
  const spec = ALGOS[header.alg];
  const keys = (jwks && jwks.keys) || [];
  const key = keys.find((k) => k.kid && k.kid === header.kid)
    || keys.find((k) => k.kty && (header.alg || "").startsWith(k.kty === "RSA" ? "RS" : k.kty === "EC" ? "ES" : "?"))
    || (keys.length === 1 ? keys[0] : null);
  if (!key) return { ok: false, detail: "aucune clé de signature correspondante (kid « " + (header.kid || "—") + " »)" };
  try {
    const ck = await subtle().importKey("jwk", key, spec.import, false, ["verify"]);
    const ok = await subtle().verify(spec.verify, ck, bytesOfB64url(signature), enc.encode(signingInput));
    return ok ? { ok: true, detail: "signature vérifiée (" + header.alg + ")" } : { ok: false, detail: "la signature ne correspond pas à la clé publiée" };
  } catch (e) {
    return { ok: false, detail: "signature invérifiable (" + ((e && e.message) || e) + ")" };
  }
}

// Vérifie le jeton et rend ses revendications. Chaque contrôle est daté dans
// `checks`, pour que l'administrateur voie EXACTEMENT ce qui a été validé.
export async function verifyIdToken(auth, token, { nonce, endpoints }) {
  const checks = [];
  const warnings = [];
  const { header, payload, signingInput, signature } = decodeToken(token);
  const optionalSig = auth.requireSignature === false;
  const push = (label, ok, detail, optional = false) => checks.push({ label, ok, detail: detail || "", optional });

  if (header.alg === "none" || String(header.alg).startsWith("HS")) {
    push("Algorithme", false, "« " + header.alg + " » refusé : un client public ne peut vérifier qu'une signature asymétrique.");
    return { ok: false, checks, warnings, claims: payload };
  }
  push("Algorithme", !!ALGOS[header.alg], header.alg || "—");

  const iss = discoveredIssuer(auth.issuer);
  const issOk = !iss || discoveredIssuer(payload.iss) === iss;
  push("Émetteur (iss)", issOk, payload.iss || "—");

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const audOk = !!auth.clientId && aud.map(String).includes(String(auth.clientId));
  push("Audience (aud)", audOk, aud.filter(Boolean).join(", ") || "—");

  const now = Math.floor(Date.now() / 1000);
  const skew = 120;
  const expOk = typeof payload.exp === "number" && payload.exp + skew > now;
  push("Validité (exp)", expOk, payload.exp ? new Date(payload.exp * 1000).toLocaleString("fr-FR") : "absente");
  const iatOk = typeof payload.iat !== "number" || payload.iat - skew <= now;
  push("Émission (iat)", iatOk, payload.iat ? new Date(payload.iat * 1000).toLocaleString("fr-FR") : "absente");
  const nonceOk = !nonce || payload.nonce === nonce;
  push("Nonce", nonceOk, nonceOk ? "conforme" : "différent de celui demandé");

  let sigOk = null;
  let sigDetail = "";
  if (endpoints && endpoints.jwks_uri) {
    const got = await fetchJwks(endpoints.jwks_uri);
    if (got.error) { sigDetail = "JWKS injoignable : " + got.error; }
    else { const r = await verifySignature({ header, signingInput, signature }, got.jwks); sigOk = r.ok; sigDetail = r.detail; }
  } else {
    sigDetail = "aucune adresse de clés publiée (jwks_uri)";
  }
  push("Signature", sigOk === true, sigDetail, optionalSig);

  const ok = checks.every((c) => c.ok || c.optional);
  if (sigOk !== true) {
    warnings.push("Signature du jeton non vérifiée : " + sigDetail +
      (optionalSig ? " — la vérification est désactivée dans le référentiel." : ""));
  }
  return { ok, checks, warnings, claims: payload };
}

// Les revendications d'un jeton, sans vérification — réservé à l'annuaire
// d'essai et à l'affichage de contrôle.
export const readClaims = (token) => decodeToken(token).payload;

async function fetchUserinfo(endpoints, accessToken) {
  if (!endpoints.userinfo_endpoint || !accessToken) return {};
  try {
    const res = await fetch(endpoints.userinfo_endpoint, { headers: { authorization: "Bearer " + accessToken, accept: "application/json" } });
    if (!res.ok) return {};
    return await res.json();
  } catch { return {}; }
}

// Retour du fournisseur : contrôle du state, échange du code, vérification du
// jeton. Rend les revendications prêtes pour `applyOidcUser` — ou, quand le
// service est le client OIDC, la SESSION qu'il a ouverte (`{ session }`), que
// l'appelant adopte telle quelle.
export async function completeAuthorizationFromUrl(auth, { search, redirectUri }) {
  const params = new URLSearchParams(search || "");
  const error = params.get("error");
  if (error) {
    const d = params.get("error_description");
    throw new AuthError("Le fournisseur a refusé la connexion : " + (d || error), "provider_error");
  }
  const code = params.get("code");
  if (!code) return null;

  const flow = readFlow();
  if (!flow) throw new AuthError("Aucune demande de connexion en cours dans cet onglet : recommencez la connexion.", "no_flow");
  if (params.get("state") !== flow.state) throw new AuthError("Contrôle d'état échoué (state) : la réponse ne correspond pas à la demande de connexion. Recommencez.", "bad_state");
  clearFlow();

  // LE SERVICE EST LE CLIENT OIDC : il échange le code (avec le vérificateur
  // PKCE que nous venons de relire), vérifie le jeton, attribue le compte et
  // ouvre SA session. Le navigateur, lui, ne présente plus que ce qu'il est seul
  // à détenir — et le `state` vient d'être confronté ci-dessus.
  if (annuaireParLeService()) {
    return connexionParLeService({ code, verifier: flow.verifier, redirectUri: redirectUri || flow.redirectUri, nonce: flow.nonce });
  }

  const ep = await discover(auth);
  const tokens = await exchangeCode(auth, ep, { code, verifier: flow.verifier, redirectUri: redirectUri || flow.redirectUri });
  const verdict = await verifyIdToken(auth, tokens.id_token, { nonce: flow.nonce, endpoints: ep });
  if (!verdict.ok) {
    const failed = verdict.checks.filter((c) => !c.ok).map((c) => c.label + " (" + c.detail + ")").join(" · ");
    throw new AuthError("Jeton d'identité refusé — " + failed, "token_rejected");
  }
  let claims = verdict.claims;
  if (auth.useUserinfo !== false) {
    const info = await fetchUserinfo(ep, tokens.access_token);
    claims = { ...claims, ...Object.fromEntries(Object.entries(info).filter(([, v]) => v !== null && v !== undefined && v !== "")) };
  }
  return { claims, checks: verdict.checks, warnings: verdict.warnings, endpoints: ep };
}

// -------------------------------------------------- revendications → compte
// Chemin pointé : « groups », « realm_access.roles », « urn:zitadel:iam:… ».
export function claimValue(obj, path) {
  if (!obj || !path) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];
  const parts = String(path).split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object" || !(p in cur)) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function setClaim(obj, path, value) {
  const parts = String(path).split(".").filter(Boolean);
  let cur = obj;
  for (const p of parts.slice(0, -1)) { if (typeof cur[p] !== "object" || cur[p] === null) cur[p] = {}; cur = cur[p]; }
  cur[parts[parts.length - 1]] = value;
  return obj;
}

// Groupes annoncés par l'annuaire, quelle que soit la forme (chaîne, tableau,
// objet de rôles).
export function claimValues(claims, path) {
  const raw = claimValue(claims, path);
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((v) => String(typeof v === "object" ? JSON.stringify(v) : v)).filter(Boolean);
  if (typeof raw === "object") return Object.entries(raw).filter(([, v]) => v === true || Array.isArray(v)).flatMap(([k, v]) => (Array.isArray(v) ? v.map(String) : [k]));
  return [String(raw)];
}

// Correspondance groupe → rôle. Le PREMIER groupe reconnu décide ; sans
// correspondance, on applique la politique choisie : le rôle de repli, ou le
// rôle **Visiteur** — le compte est bien authentifié (l'annuaire a reconnu la
// personne), mais l'application ne lui ouvre rien : l'écran d'accueil le lui
// explique et le renvoie vers l'espace public (voir src/ui/views/sans-acces.js).
// On ne refuse donc plus la connexion : refuser ne dirait pas pourquoi, alors
// qu'un visiteur n'a, lui non plus, aucun accès (ses permissions sont vides).
export function mapRole(auth, claims) {
  const values = claimValues(claims, auth.roleClaim);
  const map = (auth.roleMap || []).filter((m) => m && m.claim && m.role);
  for (const v of values) {
    const hit = map.find((m) => String(m.claim) === v);
    if (hit) return { role: hit.role, matched: v, values, denied: false, visiteur: false, reason: "" };
  }
  const motif = "Aucun groupe reconnu ne donne accès à l'application" +
    (values.length ? " (groupes reçus : " + values.join(", ") + ")" : " (l'annuaire n'annonce aucun groupe)") + ".";
  if (auth.unknownPolicy === "default" && auth.defaultRole) {
    return { role: auth.defaultRole, matched: "", values, denied: false, visiteur: false, reason: "" };
  }
  return {
    role: VISITEUR, matched: "", values, denied: false, visiteur: true,
    reason: motif + " Le compte est authentifié sans accès : l'application ne lui ouvre que l'espace public. Demandez à votre administrateur de vous rattacher à un groupe d'utilisateurs.",
  };
}

const serviceCodes = (config, claims, auth) => {
  const wanted = claimValues(claims, auth.serviceClaim).map((s) => s.trim().toLowerCase());
  if (!wanted.length) return [];
  return (config?.services || [])
    .filter((s) => wanted.includes(String(s.code || "").toLowerCase()) || wanted.includes(String(s.name || "").toLowerCase()))
    .map((s) => ({ serviceId: s.id, bureaux: null }));
};

const entityIdOf = (config, claims, auth) => {
  const codes = claimValues(claims, auth.entityClaim).map((s) => s.trim().toLowerCase());
  if (!codes.length) return "";
  const hit = (config?.entities || []).find((e) => codes.includes(String(e.code || "").toLowerCase()));
  return hit ? hit.id : "";
};

const splitName = (claims) => {
  const given = claims.given_name || claims.givenName || "";
  const family = claims.family_name || claims.familyName || "";
  if (given || family) return { firstName: String(given), lastName: String(family) };
  const full = String(claims.name || "").trim();
  if (!full) return { firstName: "", lastName: "" };
  const parts = full.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
};

const localPart = (email) => String(email || "").split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");

// Traduit les revendications en fiche de compte. `authoritative` décide si le
// rôle et le périmètre de l'annuaire écrasent ceux déjà attribués dans
// l'application ; les champs que l'annuaire ne renseigne pas sont conservés.
export function claimsToAccount(config, claims, existing = null) {
  const auth = authConfig(config);
  const role = mapRole(auth, claims);
  if (role.denied) return { denied: true, reason: role.reason, role: null };

  const name = splitName(claims);
  const email = String(claims.email || claims.preferred_username || "").trim();
  const services = serviceCodes(config, claims, auth);
  const entityId = entityIdOf(config, claims, auth);
  const force = auth.authoritative !== false || !existing;
  const civility = /^femme|madame/i.test(claims.civility || "") ? "Madame"
    : /^homme|monsieur/i.test(claims.civility || "") ? "Monsieur" : "";

  const out = {
    oidcSub: String(claims.sub || ""),
    oidcClaim: role.matched || "",
    oidcClaims: role.values.join(", "),
    oidcSyncedAt: new Date().toISOString(),
    source: "oidc",
    active: true,
    email: email || (existing ? existing.email : ""),
    firstName: name.firstName || (existing ? existing.firstName : ""),
    lastName: name.lastName || (existing ? existing.lastName : ""),
    civility: civility || (existing ? existing.civility : ""),
  };
  if (force) {
    out.role = role.role;
    // Un annuaire qui n'annonce aucun service ne doit pas effacer le périmètre
    // déjà réglé dans l'application : on ne remplace que s'il en annonce un.
    out.memberships = services.length ? services : (existing ? existing.memberships : []);
    out.entityId = entityId || (existing ? existing.entityId : "");
  } else {
    out.role = existing.role;
    out.memberships = existing.memberships;
    out.entityId = existing.entityId;
  }
  if (existing && existing.personId) out.personId = existing.personId;
  return { denied: false, patch: out, role: role.role, matched: role.matched };
}

// Applique les revendications à la liste des comptes :
//   1. compte déjà rattaché à cet identifiant d'annuaire (oidcSub) ;
//   2. sinon compte portant la même adresse (ou le même identifiant) ;
//   3. sinon création, si l'administrateur l'a autorisée.
// Un compte de démonstration ainsi reconnu **devient un compte d'annuaire** :
// il sort du jeu de démonstration et n'est plus désactivé (l'annuaire a
// authentifié la personne).
export function applyOidcUser(config, users, claims) {
  const auth = authConfig(config);
  const sub = String(claims.sub || "");
  const email = String(claims.email || claims.preferred_username || "").trim().toLowerCase();
  const list = Array.isArray(users) ? users : [];

  let existing = sub ? list.find((u) => u.oidcSub && u.oidcSub === sub) : null;
  let how = "subject";
  if (!existing && email) {
    existing = list.find((u) => String(u.email || "").toLowerCase() === email)
      || list.find((u) => String(u.login || "").toLowerCase() === localPart(email));
    how = "adresse";
  }

  if (!existing && auth.autoProvision === false) {
    return {
      denied: true, users: list,
      reason: "Aucun compte ne correspond à cette identité (" + (email || sub || "inconnue") + ") et la création automatique est désactivée. Demandez à l'administrateur de pré-enregistrer le compte.",
    };
  }

  const res = claimsToAccount(config, claims, existing);
  if (res.denied) return { denied: true, users: list, reason: res.reason };

  if (existing) {
    const patched = { ...existing, ...res.patch };
    delete patched.deactivatedBy;
    delete patched.deactivatedAt;
    // Le rôle de l'annuaire devient le rôle PRINCIPAL ; les qualités cumulées
    // attribuées dans l'application (le rôle « Réviseur », par exemple) sont
    // conservées : elles ne viennent pas des groupes, mais d'une décision de
    // l'administrateur, et l'annuaire n'a pas à les effacer. Sauf quand
    // l'annuaire ne reconnaît AUCUN rôle : le compte devient Visiteur, et une
    // qualité résiduelle ne doit pas lui rouvrir un accès.
    const principal = res.patch.role || res.role;
    const qualites = principal && principal !== VISITEUR ? rolesOf(existing).filter(estCumulable) : [];
    setRoles(patched, principal ? [principal, ...qualites] : rolesOf(existing));
    // Un compte repris par l'annuaire garde son historique : seuls l'identité,
    // le rôle et le périmètre sont repris.
    const users2 = list.map((u) => (u.id === existing.id ? patched : u));
    return { denied: false, users: users2, user: patched, created: false, linked: how, role: res.role };
  }

  const u = newUser({ source: "oidc", ...res.patch });
  u.login = uniqueLogin(list, localPart(email) || slugOf(sub), "");
  u.createdAt = new Date().toISOString();
  return { denied: false, users: [...list, u], user: u, created: true, linked: "création", role: res.role };
}

const slugOf = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20) || "compte";

// ------------------------------------------------------- annuaire d'essai
// Un annuaire minimal, local, pour vérifier le branchement sans fournisseur :
// mêmes étapes, mêmes revendications, mêmes correspondances. Ses jetons ne sont
// PAS signés (alg « TEST ») : c'est un exercice, pas une authentification.
export const TEST_ISSUER = "urn:scribae:annuaire-d-essai";
export const TEST_CLIENT_ID = "scribae-application";

export const TEST_IDENTITIES = [
  {
    id: "essai:dubois", label: "Yann DUBOIS", role: "Directeur des systèmes d'information",
    email: "yann.dubois@valmont-sur-loire.fr", name: "Yann DUBOIS", given_name: "Yann", family_name: "DUBOIS",
    groups: ["scribae-administrateurs", "Annuaire-Administrateurs-Applicatifs"], services: ["DSI"], entity: "VSL",
  },
  {
    id: "essai:leclerc", label: "Sophie LECLERC", role: "Secrétaire générale",
    email: "sophie.leclerc@valmont-sur-loire.fr", name: "Sophie LECLERC", given_name: "Sophie", family_name: "LECLERC",
    groups: ["scribae-editeurs"], services: ["SG"], entity: "VSL",
  },
  {
    id: "essai:bernard", label: "Éric BERNARD", role: "Chargé de mission — cabinet",
    email: "eric.bernard@valmont-sur-loire.fr", name: "Éric BERNARD", given_name: "Éric", family_name: "BERNARD",
    groups: ["scribae-redacteurs"], services: ["CAB"], entity: "VSL",
  },
  {
    id: "essai:martin", label: "Hélène MARTIN", role: "Travailleuse sociale — CCAS",
    email: "helene.martin@valmont-sur-loire.fr", name: "Hélène MARTIN", given_name: "Hélène", family_name: "MARTIN",
    groups: ["scribae-redacteurs"], services: ["AS"], entity: "CCAS",
  },
  {
    id: "essai:daval", label: "Isabelle DAVAL", role: "Directrice des affaires juridiques (transverse)",
    email: "isabelle.daval@valmont-sur-loire.fr", name: "Isabelle DAVAL", given_name: "Isabelle", family_name: "DAVAL",
    groups: ["scribae-editeurs", "scribae-transverses"], services: ["SG", "DSI", "DAP", "DGST", "CAB", "REG", "ACC"], entity: "VSL",
  },
  {
    id: "essai:externe", label: "Compte sans rattachement", role: "Prestataire — aucun groupe d'application",
    email: "prestataire@exemple.fr", name: "Prestataire Externe", given_name: "Prestataire", family_name: "Externe",
    groups: ["visiteurs"], services: [], entity: "",
  },
];

// Jeton d'identité de l'annuaire d'essai, aux mêmes revendications qu'un vrai
// fournisseur — y compris le chemin de revendication configuré.
export function testIdToken(auth, identity, nonce = "") {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: TEST_ISSUER, sub: identity.id, aud: auth.clientId || TEST_CLIENT_ID,
    exp: now + 300, iat: now, auth_time: now, typ: "ID",
    email: identity.email, email_verified: true, name: identity.name,
    given_name: identity.given_name, family_name: identity.family_name,
    preferred_username: localPart(identity.email),
  };
  if (nonce) payload.nonce = nonce;
  setClaim(payload, auth.roleClaim || DEFAULT_AUTH.roleClaim, identity.groups);
  if (auth.serviceClaim) setClaim(payload, auth.serviceClaim, identity.services);
  if (auth.entityClaim && identity.entity) setClaim(payload, auth.entityClaim, identity.entity);
  const header = { alg: "TEST", typ: "JWT", kid: "annuaire-d-essai" };
  return [b64url(enc.encode(JSON.stringify(header))), b64url(enc.encode(JSON.stringify(payload))), b64url(enc.encode("essai"))].join(".");
}

// Ce que produirait une identité avec la configuration courante : la fiche du
// compte, ou le refus. C'est ce que montre la fenêtre de l'annuaire d'essai.
export function previewAccount(config, identity) {
  const auth = authConfig(config);
  const claims = readClaims(testIdToken(auth, identity));
  const role = mapRole(auth, claims);
  const account = claimsToAccount(config, claims);
  return { claims, role, account };
}
