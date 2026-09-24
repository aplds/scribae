// ============================================================================
// L'ANNUAIRE DE LA COLLECTIVITÉ, VU DU SERVICE — client OIDC côté serveur.
//
// POURQUOI CE MODULE EXISTE. Jusqu'ici, la connexion par l'annuaire était faite
// ENTIÈREMENT par le navigateur : découverte `/.well-known/openid-configuration`,
// échange du code, clés de signature, vérification du jeton. Trois conséquences,
// toutes vérifiées en exploitation :
//
//   1. LE FOURNISSEUR DEVAIT PARLER CORS. Les quatre appels partent d'une
//      origine (`https://actes.maville.fr`) différente de celle de l'annuaire :
//      un fournisseur qui ne renvoie pas d'en-tête `Access-Control-Allow-Origin`
//      fait échouer la découverte — « Découverte impossible (Failed to fetch) »
//      dans Administration › Annuaire — PUIS la connexion, au même endroit.
//      Beaucoup d'annuaires d'administration (Keycloak, LemonLDAP, ADFS…)
//      n'ouvrent pas le CORS, et l'exploitant n'y peut rien.
//   2. LA SESSION OUVERTE N'ÉTAIT PAS CELLE DU SERVICE. L'application ouvrait
//      une session d'APPLICATION : un service réglé sur ses propres sessions
//      (`AUTH_MODE=password`, `oidc`) ne l'acceptait pas. Un agent entré par
//      l'annuaire ne lisait donc aucun acte — et c'est pourquoi la seconde
//      porte n'était pas proposée dans ce cas (voir `annuaireFermePour`,
//      src/lib/auth.js).
//   3. LE JETON ÉTAIT VÉRIFIÉ LOIN DES DONNÉES. Le navigateur décidait seul de
//      l'identité, puis écrivait le compte : le service, lui, ne vérifiait rien.
//
// Ce module fait donc ce que fait tout service qui se branche sur un annuaire :
// **le service est le client OIDC**. Il découvre le fournisseur, échange le code
// (avec le vérificateur PKCE transmis par le navigateur), vérifie le jeton
// d'identité, en tire un compte, et ouvre SA session (le cookie `HttpOnly`).
// Le navigateur, lui, ne fait plus que ce qu'il est seul à pouvoir faire :
// rediriger, garder le `state`/`nonce`/vérificateur le temps de l'aller-retour,
// et présenter le résultat. Plus aucun appel au fournisseur ne part du
// navigateur : **le CORS cesse d'être une condition de fonctionnement**.
//
// CE QUI RESTE AU NAVIGATEUR, ET POURQUOI. Le flux reste « code d'autorisation
// + PKCE » : le vérificateur est tiré par le navigateur (il ne quitte l'onglet
// que pour l'aller-retour avec le service, sur la MÊME origine), `state` et
// `nonce` sont confrontés, et l'URL est nettoyée. Un attaquant qui obtiendrait
// un code ne pourrait ni le présenter sans le vérificateur, ni s'en servir deux
// fois : le service refuse un `state` inconnu, et le fournisseur un code rejoué.
//
// LES RÈGLES D'ATTRIBUTION SONT REPRISES D'ICI, À L'IDENTIQUE. Les revendications
// → compte (groupes → rôle, services et entité, création à la première
// connexion, qualités cumulables conservées) sont écrites côté navigateur dans
// `src/lib/oidc.js` (`mapRole`, `claimsToAccount`, `applyOidcUser`) — que le
// service ne peut pas importer : l'image du service ne contient que ce dossier
// (`src/server/mysql/`). Les deux implémentations doivent donc dire la même
// chose, et c'est pour cela que celle-ci est ÉPROUVÉE SÉPARÉMENT
// (`annuaire-service.test.mjs` : rôles, repli sans groupe, périmètre, cumul).
// Toute modification d'un côté demande de relire l'autre.
//
// Module PUR : aucun `import` de Node, ni base, ni réseau. Le réseau entre par
// `httpJson` (port posé par server.mjs), la cryptographie par `crypto` (le port
// existant de comptes.mjs), l'horloge par `now`. Il s'éprouve donc seul, avec
// un fournisseur simulé et des clés engendrées par l'épreuve.
// ============================================================================

import { annuairePublic } from "./annuaire.mjs";

// ----------------------------------------------------------------------------
// Les réglages, tels que le service les lit : le référentiel, PUIS les
// variables `SCRIBA_ANNUAIRE_*` du `.env` par-dessus (voir annuaire.mjs). Ce
// que le service publie n'en est qu'un SOUS-ENSEMBLE : les défauts ci-dessous
// complètent ce qui n'est pas publié, et reprennent ceux du navigateur
// (`DEFAULT_AUTH`, src/lib/auth.js) — un réglage absent ne doit pas se lire
// « faux » ici et « vrai » là.
export const DEFAUT_ANNUAIRE = {
  mode: "demo",
  annuaire: false,
  test: false,
  issuer: "",
  clientId: "",
  scopes: "openid profile email",
  redirectUri: "",
  prompt: "",
  roleClaim: "groups",
  roleMap: [],
  unknownPolicy: "deny",
  defaultRole: "redacteur",
  serviceClaim: "services",
  entityClaim: "entity",
  authoritative: true,
  autoProvision: true,
  useUserinfo: true,
  requireSignature: true,
  disableDemo: true,
  allowRecovery: true,
  endpoints: {},
};

// Les rôles qui se CUMULENT avec le rôle principal (voir src/lib/users.js,
// `ROLES_CUMULABLES`) : repris à l'identique — un compte repris par l'annuaire
// garde ses qualités de réviseur ou de signataire, qui ne viennent pas des
// groupes mais d'une décision de l'administrateur.
export const ROLES_CUMULABLES = ["reviseur", "signataire"];
export const ROLE_SANS_ACCES = "visiteur";
export const ROLES_CONNUS = ["administrateur", "editeur", "reviseur", "signataire", "redacteur", ROLE_SANS_ACCES];

export const estObjet = (o) => !!o && typeof o === "object" && !Array.isArray(o);
const texte = (v) => (v === undefined || v === null ? "" : String(v));
const liste = (v) => (Array.isArray(v) ? v : []);

// Les réglages effectifs de l'annuaire, ou `null` s'il n'y a rien à lire.
// `modeDeploiement` vient du `.env` du service (`AUTH_MODE`) : en mode « oidc »,
// l'annuaire est la porte ordinaire, même si le référentiel ne le dit pas.
//
// `publie` permet de remettre ce que le service a DÉJÀ publié (`annuairePublie`,
// server.mjs, qui tient le cache) au lieu de relire le référentiel : c'est le
// même document, avec les défauts du navigateur par-dessus.
export function annuaireEffectif({ variables = {}, referentiel = null, publie = undefined, modeDeploiement = "" } = {}) {
  const reglages = publie !== undefined ? publie : annuairePublic({ variables, referentiel });
  if (!reglages) return null;
  const mode = texte(modeDeploiement).trim().toLowerCase();
  return {
    ...DEFAUT_ANNUAIRE,
    ...reglages,
    mode: mode || DEFAUT_ANNUAIRE.mode,
    endpoints: { ...DEFAUT_ANNUAIRE.endpoints, ...(estObjet(reglages.endpoints) ? reglages.endpoints : {}) },
  };
}

// L'annuaire est-il demandé, et par quelle porte ? En mode « oidc », il EST la
// porte ordinaire ; ailleurs, c'est la SECONDE PORTE (`auth.annuaire`), ou
// l'annuaire d'essai, qui est un choix explicite.
export const annuaireDemande = (auth) =>
  !!auth && (auth.mode === "oidc" || auth.annuaire === true || auth.test === true);

// Un annuaire RÉEL est-il branché ? L'annuaire d'essai ne passe pas par le
// service : ses jetons ne sont pas signés, il n'y a ni fournisseur ni réseau à
// interroger (voir src/lib/oidc.js, `TEST_IDENTITIES`).
export const estFournisseurDessai = (auth) =>
  !!auth && (auth.test === true || !texte(auth.issuer).trim());

// L'adresse de l'émetteur, sans barre finale : c'est sur elle que se construit
// `/.well-known/openid-configuration`, et c'est elle que doit porter `iss`.
export const normaliserEmetteur = (v) => texte(v).trim().replace(/\/+$/, "");

// Le SERVICE accepte-t-il l'identité d'annuaire ? C'est la question que se pose
// le navigateur avant d'ouvrir la seconde porte (voir `annuaireFermePour`) :
// elle n'est ouverte que si le service sait en faire une session.
export const annuaireAccepte = (auth) => {
  if (!annuaireDemande(auth)) return false;
  if (estFournisseurDessai(auth)) return false;
  return true;
};

// ----------------------------------------------------------------------------
// Découverte. Les points de terminaison saisis à la main l'emportent : un
// fournisseur qui n'expose pas son document de découverte se branche en les
// recopiant depuis sa documentation (voir docs/ADMINISTRATION.md § 4.4).
//
// `issuer` permet d'éprouver une adresse AVANT de l'enregistrer (c'est ce que
// fait le bouton « Découverte » de l'administration). Il n'est accepté que d'un
// administrateur : le service ne va pas chercher une adresse arbitraire pour le
// premier venu (voir la route, `POST /v1/auth/annuaire/decouverte`).
export async function decouvrir({ auth, issuer = "", httpJson } = {}) {
  const ep = estObjet(auth && auth.endpoints) ? auth.endpoints : {};
  const manuel = { authorization: texte(ep.authorization), token: texte(ep.token), jwks: texte(ep.jwks), userinfo: texte(ep.userinfo) };
  const base = normaliserEmetteur(issuer || (auth && auth.issuer));

  if (manuel.authorization && manuel.token) {
    return {
      ok: true,
      source: "manuel",
      endpoints: {
        issuer: base,
        authorization_endpoint: manuel.authorization,
        token_endpoint: manuel.token,
        jwks_uri: manuel.jwks,
        userinfo_endpoint: manuel.userinfo,
      },
    };
  }
  if (!base) return { ok: false, code: "fournisseur_absent", erreur: "Aucune adresse de fournisseur n'est configurée (Adresse du fournisseur, ou points de terminaison à la main)." };

  const url = base + "/.well-known/openid-configuration";
  let reponse;
  try {
    reponse = await httpJson(url, { method: "GET", headers: { accept: "application/json" } });
  } catch (e) {
    return { ok: false, code: "fournisseur_injoignable", erreur: "Découverte impossible sur " + url + " (" + ((e && e.message) || e) + ")." };
  }
  if (!reponse || !reponse.ok) {
    const statut = reponse ? "HTTP " + reponse.status : "réponse illisible";
    return { ok: false, code: "fournisseur_injoignable", erreur: "Découverte impossible sur " + url + " (" + statut + ")." };
  }
  const doc = estObjet(reponse.body) ? reponse.body : {};
  const out = {
    issuer: normaliserEmetteur(doc.issuer || base),
    authorization_endpoint: manuel.authorization || texte(doc.authorization_endpoint),
    token_endpoint: manuel.token || texte(doc.token_endpoint),
    jwks_uri: manuel.jwks || texte(doc.jwks_uri),
    userinfo_endpoint: manuel.userinfo || texte(doc.userinfo_endpoint),
  };
  if (!out.authorization_endpoint || !out.token_endpoint) {
    return { ok: false, code: "decouverte_incomplete", erreur: "Le document de découverte ne publie pas les points de terminaison attendus (authorization_endpoint, token_endpoint)." };
  }
  return { ok: true, source: "découverte", endpoints: out };
}

// ----------------------------------------------------------------------------
// Échange du code : le service présente le code ET le vérificateur PKCE. C'est
// le seul endroit du branchement où un secret de session circule — et il ne
// quitte pas le service : le navigateur ne voit jamais le jeton d'accès.
export async function echangerCode({ auth, endpoints, code, verifier, redirectUri, httpJson } = {}) {
  if (!endpoints || !endpoints.token_endpoint) return { ok: false, code: "decouverte_incomplete", erreur: "Le point de terminaison du jeton (token_endpoint) est inconnu." };
  const corps = new URLSearchParams({
    grant_type: "authorization_code",
    code: texte(code),
    redirect_uri: texte(redirectUri),
    client_id: texte(auth && auth.clientId),
    code_verifier: texte(verifier),
  });
  let reponse, texteBrut = "";
  try {
    reponse = await httpJson(endpoints.token_endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
      body: corps.toString(),
    });
    texteBrut = reponse && typeof reponse.text === "string" ? reponse.text : "";
  } catch (e) {
    return { ok: false, code: "fournisseur_injoignable", erreur: "Le fournisseur n'a pas répondu à l'échange du code (" + ((e && e.message) || e) + ")." };
  }
  const data = estObjet(reponse && reponse.body) ? reponse.body : null;
  if (!reponse || !reponse.ok || !data) {
    const codeErreur = texte(data && data.error);
    const description = texte(data && data.error_description);
    const detail = description || codeErreur || texteBrut.slice(0, 200) || ("HTTP " + ((reponse && reponse.status) || 0));
    // Le CODE du fournisseur est joint quand sa description ne le dit pas :
    // c'est lui qui se cherche dans sa documentation (« invalid_client »,
    // « invalid_grant »…).
    const precision = codeErreur && description && codeErreur !== description ? " (" + codeErreur + ")" : "";
    const mention = (codeErreur + " " + detail).includes("invalid_client");
    return {
      ok: false,
      code: "echange_refuse",
      erreur: "Le fournisseur a refusé l'échange du code : " + detail + precision +
        (mention ? " (un client public se configure SANS secret : activez PKCE côté fournisseur)" : ""),
    };
  }
  if (!data.id_token) return { ok: false, code: "jeton_absent", erreur: "Le fournisseur n'a pas renvoyé de jeton d'identité (id_token)." };
  return { ok: true, jetons: data };
}

// ----------------------------------------------------------------------------
// Vérification du jeton d'identité. Chaque contrôle est daté dans `checks`,
// avec le MÊME libellé que côté navigateur : le contrôle affiché après connexion
// doit dire la même chose, que la vérification ait eu lieu ici ou là
// (voir `verifyIdToken`, src/lib/oidc.js).
//
// Un jeton non signé (`alg: none`) ou signé symétriquement est refusé : le
// service ne détient aucune clé partagée avec le fournisseur, et un client
// public n'en détient pas davantage.
const ALGORITHMES = ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384"];

export async function lireJwks({ uri, httpJson } = {}) {
  if (!uri) return { ok: false, erreur: "aucune adresse de clés publiée (jwks_uri)" };
  try {
    const reponse = await httpJson(uri, { method: "GET", headers: { accept: "application/json" } });
    if (!reponse || !reponse.ok || !estObjet(reponse.body)) {
      return { ok: false, erreur: "JWKS injoignable (HTTP " + ((reponse && reponse.status) || 0) + ")" };
    }
    return { ok: true, jwks: reponse.body };
  } catch (e) {
    return { ok: false, erreur: "JWKS injoignable : " + ((e && e.message) || e) };
  }
}

// La clé qui a signé : d'abord par `kid`, sinon la seule clé de la famille
// attendue (RS/PS → RSA, ES → EC), sinon — s'il n'y en a qu'une — celle-là.
export function choisirCle(jwks, header = {}) {
  const cles = liste(jwks && jwks.keys);
  if (!cles.length) return null;
  const kid = texte(header.kid);
  if (kid) {
    const parKid = cles.find((k) => texte(k && k.kid) === kid);
    if (parKid) return parKid;
  }
  const alg = texte(header.alg);
  const famille = alg.startsWith("ES") ? "EC" : alg.startsWith("RS") || alg.startsWith("PS") ? "RSA" : "";
  const parFamille = famille ? cles.find((k) => texte(k && k.kty) === famille) : null;
  if (parFamille) return parFamille;
  return cles.length === 1 ? cles[0] : null;
}

// Décode un JWT sans le vérifier : en-tête, revendications, et la chaîne qui
// porte la signature. Le décodage base64url n'emploie que `atob` et
// `TextDecoder`, disponibles des deux côtés (Node et navigateur) : ce module
// reste pur, sans dépendance à Node.
function decoderJwt(jeton) {
  const parts = texte(jeton).split(".");
  if (parts.length !== 3) return null;
  const versTexte = (p) => {
    const s = p.replace(/-/g, "+").replace(/_/g, "/");
    const pad = s.length % 4 ? "=".repeat(4 - (s.length % 4)) : "";
    const bin = atob(s + pad);
    const octets = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) octets[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(octets);
  };
  try {
    return {
      header: JSON.parse(versTexte(parts[0])),
      payload: JSON.parse(versTexte(parts[1])),
      signingInput: parts[0] + "." + parts[1],
      signatureB64: parts[2],
    };
  } catch (e) {
    return null;
  }
}

export async function verifierJeton({ auth, idToken, nonce = "", jwks = null, jwksErreur = "", crypto, now = () => new Date() } = {}) {
  const checks = [];
  const warnings = [];
  const pousser = (label, ok, detail = "", optionnel = false) => checks.push({ label, ok, detail, optional: optionnel });

  const decode = decoderJwt(idToken);
  if (!decode) {
    pousser("Jeton d'identité", false, "jeton illisible (en-tête ou revendications)");
    return { ok: false, checks, warnings, claims: {} };
  }
  const { header, payload, signingInput, signatureB64 } = decode;
  const alg = texte(header.alg);
  const optionnelle = auth && auth.requireSignature === false;

  if (alg === "none" || alg.startsWith("HS")) {
    pousser("Algorithme", false, "« " + (alg || "—") + " » refusé : le service ne peut vérifier qu'une signature asymétrique.");
    return { ok: false, checks, warnings, claims: payload };
  }
  pousser("Algorithme", ALGORITHMES.includes(alg), alg || "—");

  const iss = normaliserEmetteur(auth && auth.issuer);
  const issRecu = normaliserEmetteur(payload.iss);
  const issOk = !iss || issRecu === iss;
  pousser("Émetteur (iss)", issOk, payload.iss || "—");

  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const attendu = texte(auth && auth.clientId);
  const audOk = !!attendu && aud.map(texte).includes(attendu);
  pousser("Audience (aud)", audOk, aud.filter(Boolean).join(", ") || "—");

  const seconde = Math.floor(now().getTime() / 1000);
  const marge = 120;
  const expOk = typeof payload.exp === "number" && payload.exp + marge > seconde;
  pousser("Validité (exp)", expOk, payload.exp ? new Date(payload.exp * 1000).toLocaleString("fr-FR") : "absente");
  const iatOk = typeof payload.iat !== "number" || payload.iat - marge <= seconde;
  pousser("Émission (iat)", iatOk, payload.iat ? new Date(payload.iat * 1000).toLocaleString("fr-FR") : "absente");
  const nonceOk = !nonce || payload.nonce === nonce;
  pousser("Nonce", nonceOk, nonceOk ? "conforme" : "différent de celui demandé");

  let sigOk = false;
  let sigDetail = "";
  if (jwksErreur) sigDetail = jwksErreur;
  else if (!jwks) sigDetail = "aucune clé de signature disponible";
  else {
    const cle = choisirCle(jwks, header);
    if (!cle) sigDetail = "aucune clé de signature correspondante (kid « " + (header.kid || "—") + " »)";
    else {
      let bonne = false;
      try {
        bonne = await crypto.verifierJws({ alg, cle, donnees: signingInput, signature: signatureB64 });
      } catch (e) {
        sigDetail = "signature invérifiable (" + ((e && e.message) || e) + ")";
      }
      sigOk = !!bonne;
      if (bonne) sigDetail = "signature vérifiée (" + alg + ")";
      else if (!sigDetail) sigDetail = "la signature ne correspond pas à la clé publiée";
    }
  }
  pousser("Signature", sigOk, sigDetail, optionnelle);

  const ok = checks.every((c) => c.ok || c.optional);
  if (!sigOk) {
    warnings.push("Signature du jeton non vérifiée : " + sigDetail +
      (optionnelle ? " — la vérification est désactivée dans le référentiel." : ""));
  }
  return { ok, checks, warnings, claims: payload };
}

// ----------------------------------------------------------------------------
// Revendications → compte. Reprise à l'identique des règles du navigateur
// (src/lib/oidc.js : `claimValue`, `claimValues`, `mapRole`, `claimsToAccount`).
// Ce que l'annuaire ne renseigne pas ne détruit rien : l'identité, le rôle et le
// périmètre sont repris à chaque connexion, le reste du compte (personne
// rattachée, historique) est conservé.
export function lireRevendication(claims, chemin) {
  const c = texte(chemin);
  if (!c) return undefined;
  if (claims && Object.prototype.hasOwnProperty.call(claims, c)) return claims[c];
  let courant = claims;
  for (const part of c.split(".").filter(Boolean)) {
    if (courant == null || typeof courant !== "object" || !(part in courant)) return undefined;
    courant = courant[part];
  }
  return courant;
}

// Les valeurs d'une revendication, quelle que soit leur forme : chaîne, tableau,
// ou objet de rôles (`{ "groupe": true }`, `{ "groupe": ["a","b"] }`).
export function valeursRevendication(claims, chemin) {
  const brut = lireRevendication(claims, chemin);
  if (brut == null) return [];
  if (Array.isArray(brut)) return brut.map((v) => texte(typeof v === "object" ? JSON.stringify(v) : v)).filter(Boolean);
  if (typeof brut === "object") {
    return Object.entries(brut)
      .filter(([, v]) => v === true || Array.isArray(v))
      .flatMap(([k, v]) => (Array.isArray(v) ? v.map(texte) : [k]));
  }
  return [texte(brut)];
}

// Le rôle que donne l'annuaire : le PREMIER groupe reconnu décide. Sans
// correspondance, la politique du référentiel s'applique — le rôle de repli, ou
// le rôle Visiteur : le compte est bien authentifié (l'annuaire a reconnu la
// personne), mais l'application ne lui ouvre rien.
export function roleDepuisRevendications(auth, claims) {
  const valeurs = valeursRevendication(claims, auth && auth.roleClaim);
  const correspondances = liste(auth && auth.roleMap).filter((m) => m && m.claim && m.role);
  for (const v of valeurs) {
    const trouve = correspondances.find((m) => texte(m.claim) === v);
    if (trouve) return { role: texte(trouve.role), matched: v, valeurs, visiteur: false, reason: "" };
  }
  const motif = "Aucun groupe reconnu ne donne accès à l'application" +
    (valeurs.length ? " (groupes reçus : " + valeurs.join(", ") + ")" : " (l'annuaire n'annonce aucun groupe)") + ".";
  if (auth && auth.unknownPolicy === "default" && auth.defaultRole) {
    return { role: texte(auth.defaultRole), matched: "", valeurs, visiteur: false, reason: "" };
  }
  return {
    role: ROLE_SANS_ACCES, matched: "", valeurs, visiteur: true,
    reason: motif + " Le compte est authentifié sans accès : l'application ne lui ouvre que l'espace public. Demandez à votre administrateur de vous rattacher à un groupe d'utilisateurs.",
  };
}

const servicesDuPerimetre = (referentiel, claims, auth) => {
  const voulus = valeursRevendication(claims, auth && auth.serviceClaim).map((s) => s.trim().toLowerCase());
  if (!voulus.length) return [];
  return liste(referentiel && referentiel.services)
    .filter((s) => voulus.includes(texte(s.code).toLowerCase()) || voulus.includes(texte(s.name).toLowerCase()))
    .map((s) => ({ serviceId: s.id, bureaux: null }));
};

const entiteDuPerimetre = (referentiel, claims, auth) => {
  const codes = valeursRevendication(claims, auth && auth.entityClaim).map((s) => s.trim().toLowerCase());
  if (!codes.length) return "";
  const trouve = liste(referentiel && referentiel.entities).find((e) => codes.includes(texte(e.code).toLowerCase()));
  return trouve ? trouve.id : "";
};

const nomSepare = (claims) => {
  const prenom = claims.given_name || claims.givenName || "";
  const nom = claims.family_name || claims.familyName || "";
  if (prenom || nom) return { firstName: texte(prenom), lastName: texte(nom) };
  const complet = texte(claims.name).trim();
  if (!complet) return { firstName: "", lastName: "" };
  const parts = complet.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
};

export const partieLocale = (email) => texte(email).split("@")[0].replace(/[^a-zA-Z0-9._-]/g, "");

// Les rôles d'un compte porté au référentiel : `roles` fait foi, `role` le
// reflet (mêmes conventions que src/lib/users.js).
export const rolesDuCompte = (compte) => {
  const l = liste(compte && compte.roles).filter((r) => ROLES_CONNUS.includes(r));
  if (l.length) return [...new Set(l)];
  const r = texte(compte && compte.role);
  return ROLES_CONNUS.includes(r) ? [r] : [];
};

// Le rôle principal : le rang le plus élevé, une QUALITÉ cumulable ne pouvant
// pas devenir principale (voir `primaryRoleId`, src/lib/users.js).
const RANG = { administrateur: 3, editeur: 2, reviseur: 2, signataire: 2, redacteur: 1, visiteur: 0 };
const ORDRE = ["administrateur", "editeur", "reviseur", "signataire", "redacteur", "visiteur"];
export function rolesCanoniques(roles) {
  const uniq = [...new Set(liste(roles).filter((r) => ROLES_CONNUS.includes(r)))];
  if (!uniq.length) return [];
  const parRang = (a, b) => (RANG[b] - RANG[a]) || (ORDRE.indexOf(a) - ORDRE.indexOf(b));
  const principal = uniq.filter((r) => !ROLES_CUMULABLES.includes(r)).sort(parRang)[0] || uniq.slice().sort(parRang)[0];
  return uniq.sort((a, b) => (a === principal ? -1 : b === principal ? 1 : ORDRE.indexOf(a) - ORDRE.indexOf(b)));
}

// Ce que l'annuaire fait du compte : la fiche à écrire, le rôle principal, et
// les qualités cumulables conservées. `existing` est le compte déjà rattaché, ou
// `null` (création).
export function revendicationsVersCompte({ referentiel = null, auth, claims = {}, existing = null, now = () => new Date() } = {}) {
  const role = roleDepuisRevendications(auth, claims);
  const nom = nomSepare(claims);
  const email = texte(claims.email || claims.preferred_username).trim();
  const services = servicesDuPerimetre(referentiel, claims, auth);
  const entityId = entiteDuPerimetre(referentiel, claims, auth);
  // Les groupes de l'annuaire font foi : rôle et périmètre sont repris à chaque
  // connexion. Décoché (`authoritative: false`), l'annuaire authentifie
  // seulement, et le rôle attribué dans l'application est conservé.
  const faitFoi = !auth || auth.authoritative !== false || !existing;
  const civilite = /^femme|madame/i.test(texte(claims.civility)) ? "Madame"
    : /^homme|monsieur/i.test(texte(claims.civility)) ? "Monsieur" : "";

  const patch = {
    oidcSub: texte(claims.sub),
    oidcClaim: role.matched || "",
    oidcClaims: role.valeurs.join(", "),
    oidcSyncedAt: now().toISOString(),
    source: "oidc",
    active: true,
    email: email || texte(existing && existing.email),
    firstName: nom.firstName || texte(existing && existing.firstName),
    lastName: nom.lastName || texte(existing && existing.lastName),
    civility: civilite || texte(existing && existing.civility),
  };
  if (faitFoi) {
    patch.role = role.role;
    // Un annuaire qui n'annonce aucun service ne doit pas effacer le périmètre
    // déjà réglé dans l'application : on ne remplace que s'il en annonce un.
    patch.memberships = services.length ? services : liste(existing && existing.memberships);
    patch.entityId = entityId || texte(existing && existing.entityId);
  } else {
    patch.role = texte(existing && existing.role) || role.role;
    patch.memberships = liste(existing && existing.memberships);
    patch.entityId = texte(existing && existing.entityId);
  }
  if (existing && existing.id) patch.id = existing.id;
  if (existing && existing.login) patch.login = existing.login;
  if (existing && existing.createdAt) patch.createdAt = existing.createdAt;
  if (existing && existing.personId) patch.personId = existing.personId;
  return { ok: true, patch, role: role.role, matched: role.matched, visiteur: role.visiteur, reason: role.reason };
}

// La fiche complète d'un compte — création, ou reprise. Les qualités cumulables
// du compte existant sont conservées : elles ne viennent pas des groupes, mais
// d'une décision de l'administrateur ; sauf quand l'annuaire ne reconnaît AUCUN
// rôle : le compte devient Visiteur, et une qualité résiduelle ne doit pas lui
// rouvrir un accès.
export function compteApplique({ existant = null, patch = {}, principal = "" } = {}) {
  const base = existant ? { ...existant } : null;
  const qualites = principal && principal !== ROLE_SANS_ACCES && base
    ? rolesDuCompte(base).filter((r) => ROLES_CUMULABLES.includes(r))
    : [];
  const roles = rolesCanoniques(principal ? [principal, ...qualites] : rolesDuCompte(base));
  const compte = { ...(base || {}), ...patch };
  delete compte.deactivatedBy;
  delete compte.deactivatedAt;
  if (roles.length) { compte.roles = roles; compte.role = roles[0]; }
  return compte;
}

// ----------------------------------------------------------------------------
// Le branchement complet : découverte, échange, clés, vérification, profil.
// C'est ce qu'appelle la route `POST /v1/auth/annuaire` ; le compte, lui, est
// écrit par comptes.mjs (c'est son domaine).
export async function verifierConnexionAnnuaire({
  auth, code, verifier, redirectUri, nonce = "",
  httpJson, crypto, now = () => new Date(),
} = {}) {
  const decouverte = await decouvrir({ auth, httpJson });
  if (!decouverte.ok) return decouverte;
  const endpoints = decouverte.endpoints;

  const echange = await echangerCode({ auth, endpoints, code, verifier, redirectUri, httpJson });
  if (!echange.ok) return echange;

  // Les clés de signature : la vérification peut être désactivée par le
  // référentiel (`requireSignature: false`), mais l'échec est alors DIT, et
  // jamais passé sous silence (voir `warnings`).
  let jwks = null;
  let jwksErreur = "";
  if (auth && auth.requireSignature !== false) {
    const cles = await lireJwks({ uri: endpoints.jwks_uri, httpJson });
    if (cles.ok) jwks = cles.jwks;
    else jwksErreur = cles.erreur;
  } else if (endpoints.jwks_uri) {
    const cles = await lireJwks({ uri: endpoints.jwks_uri, httpJson });
    if (cles.ok) jwks = cles.jwks;
  }

  const verdict = await verifierJeton({ auth, idToken: echange.jetons.id_token, nonce, jwks, jwksErreur, crypto, now });
  if (!verdict.ok) {
    const refuses = verdict.checks.filter((c) => !c.ok).map((c) => c.label + " (" + c.detail + ")").join(" · ");
    return { ok: false, code: "jeton_refuse", erreur: "Jeton d'identité refusé — " + refuses, checks: verdict.checks, warnings: verdict.warnings };
  }

  let claims = verdict.claims;
  if (!auth || auth.useUserinfo !== false) {
    const profil = await lireProfil({ endpoints, accessToken: echange.jetons.access_token, httpJson });
    const nettoie = Object.fromEntries(Object.entries(profil).filter(([, v]) => v !== null && v !== undefined && v !== ""));
    claims = { ...claims, ...nettoie };
  }
  return { ok: true, claims, checks: verdict.checks, warnings: verdict.warnings, endpoints, source: decouverte.source };
}

// `/userinfo` : un complément, jamais une condition — un fournisseur qui ne le
// sert pas, ou lentement, ne doit pas faire échouer une connexion pourtant
// vérifiée (mêmes règles que côté navigateur, `fetchUserinfo`).
export async function lireProfil({ endpoints, accessToken, httpJson } = {}) {
  if (!endpoints || !endpoints.userinfo_endpoint || !accessToken) return {};
  try {
    const reponse = await httpJson(endpoints.userinfo_endpoint, {
      method: "GET",
      headers: { authorization: "Bearer " + texte(accessToken), accept: "application/json" },
    });
    if (!reponse || !reponse.ok || !estObjet(reponse.body)) return {};
    return reponse.body;
  } catch (e) {
    return {};
  }
}
