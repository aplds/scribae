// ============================================================================
// Tests de l'annuaire de la collectivité, côté SERVICE
// (src/server/mysql/annuaire-service.mjs).
//
//   node --test          (ou: npm test)
//
// Ce module est le CLIENT OIDC du service : c'est lui qui découvre le
// fournisseur, échange le code d'autorisation, vérifie le jeton d'identité et en
// tire un compte de l'application. Il est PUR — le réseau entre par `httpJson`,
// la cryptographie par `crypto`, l'horloge par `now` —, si bien que ces épreuves
// simulent un FOURNISSEUR COMPLET : un document de découverte, un point
// d'échange, un JWKS, un /userinfo. Ce qui est éprouvé ici est donc la DÉCISION
// (quels contrôles, quel refus, quel compte), et non l'arithmétique
// cryptographique : celle-là a son propre fichier (jws.test.mjs), avec de vraies
// clés et de vraies signatures.
//
// Les règles « revendications → compte » sont une COPIE de celles du navigateur
// (src/lib/oidc.js), que le service ne peut pas importer : son image ne contient
// que ce dossier. C'est `src/tests/purs.test.mjs` qui tient la concordance des
// deux, en confrontant les deux implémentations sur les mêmes revendications.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAUT_ANNUAIRE, ROLES_CUMULABLES, ROLE_SANS_ACCES,
  annuaireEffectif, annuaireDemande, estFournisseurDessai, annuaireAccepte, normaliserEmetteur,
  decouvrir, echangerCode, lireJwks, choisirCle, verifierJeton,
  lireRevendication, valeursRevendication, roleDepuisRevendications, rolesCanoniques,
  revendicationsVersCompte, compteApplique, verifierConnexionAnnuaire, lireProfil, partieLocale,
} from "./annuaire-service.mjs";

// --------------------------------------------------------------- outillage
const ISSUER = "https://annuaire.maville.fr/auth/realms/agents";
const EP = {
  authorization: ISSUER + "/protocol/openid-connect/auth",
  token: ISSUER + "/protocol/openid-connect/token",
  jwks: ISSUER + "/protocol/openid-connect/certs",
  userinfo: ISSUER + "/protocol/openid-connect/userinfo",
};
const DECOUVERTE = {
  issuer: ISSUER,
  authorization_endpoint: EP.authorization,
  token_endpoint: EP.token,
  jwks_uri: EP.jwks,
  userinfo_endpoint: EP.userinfo,
};
// Un JWK tel que le publie un fournisseur : les membres d'usage en plus.
const JWK = { kty: "RSA", kid: "k1", n: "un-module", e: "AQAB", use: "sig", alg: "RS256" };
const REFERENTIEL = {
  services: [{ id: "s-urb", code: "urbanisme", name: "Urbanisme" }, { id: "s-etat", code: "etat-civil", name: "État civil" }],
  entities: [{ id: "e-vsl", code: "VSL" }],
};
const IDENTITE = {
  sub: "agent-4711", email: "claire.martin@maville.fr",
  given_name: "Claire", family_name: "Martin",
  groups: ["scribae-editeurs"], services: ["urbanisme"], entity: "VSL",
};

// Les réglages tels que le service les lit : ce que `GET /v1/auth/config`
// publie, plus les défauts du navigateur appliqués par `annuaireEffectif`.
const REGLAGES = {
  annuaire: true, issuer: ISSUER, clientId: "scribae", scopes: "openid profile email",
  roleClaim: "groups", unknownPolicy: "deny", defaultRole: "redacteur",
  roleMap: [
    { claim: "scribae-admins", role: "administrateur" },
    { claim: "scribae-editeurs", role: "editeur" },
    { claim: "scribae-reviseurs", role: "reviseur" },
  ],
  serviceClaim: "services", entityClaim: "entity",
};
const reglages = (o = {}) => annuaireEffectif({ publie: { ...REGLAGES, ...o }, modeDeploiement: "password" });

const MAINTENANT = () => new Date("2026-03-10T12:00:00.000Z");
const SECONDE = Math.floor(MAINTENANT().getTime() / 1000);

const b64urlDe = (objet) => {
  const octets = new TextEncoder().encode(JSON.stringify(objet));
  let bin = "";
  for (const o of octets) bin += String.fromCharCode(o);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

// Un jeton d'identité tel qu'il circule : trois parties, la troisième n'étant
// jamais interprétée par le module (elle est remise au port de signature).
const jeton = ({ header = { alg: "RS256", kid: "k1", typ: "JWT" }, claims = {}, signature = "une-signature" } = {}) =>
  [b64urlDe(header), b64urlDe(claims), signature].join(".");

const revendicationsValides = (o = {}) => ({
  sub: IDENTITE.sub, iss: ISSUER, aud: "scribae",
  exp: SECONDE + 600, iat: SECONDE, nonce: "n-1", ...IDENTITE, ...o,
});

// Le port de cryptographie, factice : il ne vérifie rien, il REND CE QU'ON LUI
// DIT, et retient ce qu'on lui a présenté — c'est ainsi qu'on éprouve que le
// module présente bien la clé du `kid` annoncé et les octets signés.
function cryptoFactice(reponse = true) {
  const appels = [];
  return {
    appels,
    verifierJws: (demande) => {
      appels.push(demande);
      return typeof reponse === "function" ? reponse(demande) : reponse;
    },
  };
}

// Un fournisseur d'identité simulé : il répond comme un vrai — document de
// découverte, échange du code, clés, profil — et retient ce qu'on lui a demandé.
function fournisseur({ claims = revendicationsValides(), jwks = { keys: [JWK] }, refus = "", profil = ["claire.martin@maville.fr", ""], decouverteEnPanne = false, doc = DECOUVERTE } = {}) {
  const appels = [];
  const json = (body, status = 200) => ({ ok: status < 400, status, body, text: JSON.stringify(body) });
  return {
    appels,
    async httpJson(url, init = {}) {
      appels.push({ url, init });
      if (url.endsWith("/.well-known/openid-configuration")) {
        if (decouverteEnPanne) throw new Error("fetch failed");
        return json(doc);
      }
      if (url === EP.token) {
        if (refus) return json({ error: refus, error_description: "client refusé" }, 400);
        return json({ access_token: "jeton-d-acces", id_token: jeton({ claims }), token_type: "Bearer" });
      }
      if (url === EP.jwks) return json(jwks);
      if (url === EP.userinfo) return json(profil ? { email: profil[0], preferred_username: profil[1] } : {});
      throw new Error("appel inattendu : " + url);
    },
  };
}

// ------------------------------------------------------- les réglages effectifs
test("les défauts du navigateur s'appliquent, et le mode du déploiement est repris", () => {
  assert.equal(annuaireEffectif({ publie: null }), null, "rien à publier : rien à lire");
  const a = annuaireEffectif({ publie: { issuer: ISSUER }, modeDeploiement: "oidc" });
  assert.equal(a.mode, "oidc", "le mode vient du déploiement (AUTH_MODE)");
  assert.equal(a.roleClaim, DEFAUT_ANNUAIRE.roleClaim);
  assert.equal(a.requireSignature, true, "un jeton non signé est refusé par défaut");
  assert.equal(a.autoProvision, true);
  assert.deepEqual(a.roleMap, [], "aucune correspondance annoncée");
  assert.deepEqual(a.endpoints, DEFAUT_ANNUAIRE.endpoints);
});

test("l'annuaire est demandé, et l'annuaire d'essai n'est pas un fournisseur réel", () => {
  assert.equal(annuaireDemande({ mode: "password", annuaire: true }), true, "seconde porte");
  assert.equal(annuaireDemande({ mode: "oidc" }), true, "porte ordinaire");
  assert.equal(annuaireDemande({ mode: "password" }), false);
  assert.equal(annuaireDemande(null), false);

  assert.equal(estFournisseurDessai({ test: true, issuer: ISSUER }), true, "l'essai est un choix explicite");
  assert.equal(estFournisseurDessai({ issuer: "" }), true, "sans adresse, c'est l'essai");
  assert.equal(estFournisseurDessai({ issuer: ISSUER }), false);

  // Le service n'accepte QUE ce dont il peut faire une session : un vrai
  // fournisseur, avec une adresse. L'annuaire d'essai reste au navigateur.
  assert.equal(annuaireAccepte(reglages()), true);
  assert.equal(annuaireAccepte(reglages({ issuer: "" })), false);
  assert.equal(annuaireAccepte(reglages({ test: true })), false);
  assert.equal(annuaireAccepte(reglages({ annuaire: false, mode: "password" })), false);
  assert.equal(normaliserEmetteur("  " + ISSUER + "///  "), ISSUER, "l'émetteur se compare sans barre finale ni espaces");
});

// ------------------------------------------------------------------ découverte
test("la découverte lit le document du fournisseur", async () => {
  const f = fournisseur();
  const res = await decouvrir({ auth: reglages(), httpJson: f.httpJson });
  assert.equal(res.ok, true);
  assert.equal(res.source, "découverte");
  assert.equal(res.endpoints.token_endpoint, EP.token);
  assert.equal(res.endpoints.jwks_uri, EP.jwks);
});

test("les points de terminaison saisis à la main l'emportent, et n'appellent personne", async () => {
  const f = fournisseur();
  const auth = reglages({ endpoints: { authorization: "https://interne/auth", token: "https://interne/token" } });
  const res = await decouvrir({ auth, httpJson: f.httpJson });
  assert.equal(res.ok, true);
  assert.equal(res.source, "manuel");
  assert.equal(res.endpoints.token_endpoint, "https://interne/token");
  assert.equal(res.endpoints.jwks_uri, "", "ce qui n'est pas saisi reste vide");
  assert.equal(f.appels.length, 0, "aucun appel réseau quand tout est saisi");
});

test("une découverte impossible est dite, avec son adresse et sa cause", async () => {
  const panne = fournisseur({ decouverteEnPanne: true });
  const injoignable = await decouvrir({ auth: reglages(), httpJson: panne.httpJson });
  assert.equal(injoignable.ok, false);
  assert.equal(injoignable.code, "fournisseur_injoignable");
  assert.match(injoignable.erreur, /Découverte impossible sur https:\/\/annuaire\.maville\.fr/);
  assert.match(injoignable.erreur, /fetch failed/);

  const absent = await decouvrir({ auth: reglages({ issuer: "" }), httpJson: fournisseur().httpJson });
  assert.equal(absent.code, "fournisseur_absent");

  const incomplet = await decouvrir({ auth: reglages(), httpJson: fournisseur({ doc: { issuer: ISSUER, authorization_endpoint: EP.authorization } }).httpJson });
  assert.equal(incomplet.ok, false);
  assert.equal(incomplet.code, "decouverte_incomplete");

  // Un appel inattendu fait lever le port réseau : le module doit en faire une
  // réponse, pas une exception qui remonterait jusqu'au serveur HTTP.
  const casse = { httpJson: async () => { throw new Error("boum"); } };
  const plantage = await decouvrir({ auth: reglages(), httpJson: casse.httpJson });
  assert.equal(plantage.ok, false);
  assert.equal(plantage.code, "fournisseur_injoignable");
});

test("l'épreuve d'une adresse est bornée à ce qu'on lui demande", async () => {
  const f = fournisseur();
  const res = await decouvrir({ auth: reglages({ issuer: "https://autre.exemple.fr" }), issuer: "https://encore-autre.exemple.fr", httpJson: f.httpJson });
  assert.equal(res.ok, true);
  assert.equal(f.appels[0].url, "https://encore-autre.exemple.fr/.well-known/openid-configuration", "c'est l'adresse ÉPROUVÉE qui est interrogée");
  assert.equal(res.endpoints.issuer, ISSUER, "l'émetteur retenu est celui que le document annonce");
});

// -------------------------------------------------------------- échange du code
test("l'échange présente le code ET le vérificateur PKCE", async () => {
  const f = fournisseur();
  const res = await echangerCode({ auth: reglages(), endpoints: DECOUVERTE, code: "le-code", verifier: "le-verificateur", redirectUri: "https://actes.maville.fr/", httpJson: f.httpJson });
  assert.equal(res.ok, true);
  assert.equal(res.jetons.access_token, "jeton-d-acces");
  const corps = String(f.appels[0].init.body);
  assert.match(corps, /grant_type=authorization_code/);
  assert.match(corps, /code=le-code/);
  assert.match(corps, /code_verifier=le-verificateur/, "sans lui, un code volé servirait à se connecter");
  assert.match(corps, /redirect_uri=https%3A%2F%2Factes\.maville\.fr%2F/);
});

test("un échange refusé est expliqué, y compris le défaut de PKCE", async () => {
  const refus = fournisseur({ refus: "invalid_client" });
  const res = await echangerCode({ auth: reglages(), endpoints: DECOUVERTE, code: "c", verifier: "v", httpJson: refus.httpJson });
  assert.equal(res.ok, false);
  assert.equal(res.code, "echange_refuse");
  assert.match(res.erreur, /invalid_client/);
  assert.match(res.erreur, /PKCE/, "le remède est donné : un client public n'a pas de secret");

  const sansJeton = await echangerCode({
    auth: reglages(), endpoints: DECOUVERTE, code: "c", verifier: "v",
    httpJson: async () => ({ ok: true, status: 200, body: { access_token: "a" }, text: "{}" }),
  });
  assert.equal(sansJeton.code, "jeton_absent");

  const sansPoint = await echangerCode({ auth: reglages(), endpoints: {}, code: "c", verifier: "v", httpJson: fournisseur().httpJson });
  assert.equal(sansPoint.code, "decouverte_incomplete");
});

// ----------------------------------------------------------------------- clés
test("la clé de signature est choisie par son identifiant, sinon par sa famille", () => {
  const jwks = { keys: [{ kty: "RSA", kid: "k1" }, { kty: "RSA", kid: "k2" }, { kty: "EC", kid: "e1", crv: "P-256" }] };
  assert.equal(choisirCle(jwks, { alg: "RS256", kid: "k2" }).kid, "k2");
  assert.equal(choisirCle(jwks, { alg: "ES256" }).kid, "e1", "sans kid, c'est la famille qui décide");
  assert.equal(choisirCle({ keys: [{ kty: "RSA", kid: "seule" }] }, { alg: "RS256", kid: "inconnu" }).kid, "seule", "une seule clé : on la prend");
  assert.equal(choisirCle({ keys: [] }, { alg: "RS256" }), null);
  assert.equal(choisirCle({}, { alg: "RS256" }), null);
  assert.equal(choisirCle(jwks, { alg: "ES256", kid: "inconnu" }).kid, "e1");
});

test("le JWKS injoignable est un motif, pas une exception", async () => {
  const bon = await lireJwks({ uri: EP.jwks, httpJson: fournisseur().httpJson });
  assert.equal(bon.ok, true);
  assert.equal(bon.jwks.keys.length, 1);

  const vide = await lireJwks({ uri: "", httpJson: fournisseur().httpJson });
  assert.equal(vide.ok, false);
  assert.match(vide.erreur, /jwks_uri/);

  const boum = await lireJwks({ uri: EP.jwks, httpJson: async () => { throw new Error("réseau coupé"); } });
  assert.equal(boum.ok, false);
  assert.match(boum.erreur, /réseau coupé/);
});

// ------------------------------------------------------------ jeton d'identité
test("le jeton est confronté à l'émetteur, l'audience, la validité et le nonce", async () => {
  const crypto = cryptoFactice(true);
  const verdict = await verifierJeton({
    auth: reglages(), idToken: jeton({ claims: revendicationsValides() }), nonce: "n-1",
    jwks: { keys: [JWK] }, crypto, now: MAINTENANT,
  });
  assert.equal(verdict.ok, true);
  assert.deepEqual(verdict.checks.map((c) => c.label),
    ["Algorithme", "Émetteur (iss)", "Audience (aud)", "Validité (exp)", "Émission (iat)", "Nonce", "Signature"]);
  assert.equal(crypto.appels.length, 1);
  assert.equal(crypto.appels[0].alg, "RS256");
  assert.equal(crypto.appels[0].cle.kid, "k1", "la clé présentée est celle du `kid` du jeton");
  assert.equal(crypto.appels[0].signature, "une-signature");
  assert.equal(verdict.warnings.length, 0);
});

test("chaque contrôle refusé est nommé, et suffit à refuser la connexion", async () => {
  const cas = [
    ["Émetteur (iss)", { iss: "https://ailleurs.exemple.fr" }],
    ["Audience (aud)", { aud: "une-autre-application" }],
    ["Audience (aud)", { aud: ["autre", "encore"] }],
    ["Validité (exp)", { exp: SECONDE - 3600 }],
    ["Validité (exp)", { exp: undefined }],
    ["Émission (iat)", { iat: SECONDE + 3600 }],
    ["Nonce", { nonce: "n-2" }],
  ];
  for (const [label, patch] of cas) {
    const verdict = await verifierJeton({
      auth: reglages(), idToken: jeton({ claims: revendicationsValides(patch) }), nonce: "n-1",
      jwks: { keys: [JWK] }, crypto: cryptoFactice(true), now: MAINTENANT,
    });
    assert.equal(verdict.ok, false, label + " " + JSON.stringify(patch));
    const c = verdict.checks.find((x) => x.label === label);
    assert.equal(c.ok, false, label);
    assert.ok(String(c.detail).length > 0, "un contrôle refusé dit POURQUOI");
  }
});

test("un jeton non signé, ou signé symétriquement, est refusé sans même chercher une clé", async () => {
  for (const alg of ["none", "HS256"]) {
    const crypto = cryptoFactice(true);
    const verdict = await verifierJeton({
      auth: reglages(), idToken: jeton({ header: { alg }, claims: revendicationsValides() }), nonce: "n-1",
      jwks: { keys: [JWK] }, crypto, now: MAINTENANT,
    });
    assert.equal(verdict.ok, false, alg);
    assert.equal(verdict.checks[0].label, "Algorithme");
    assert.equal(verdict.checks[0].ok, false);
    assert.equal(crypto.appels.length, 0, "aucune signature à vérifier");
  }
});

test("une signature fausse refuse la connexion, et l'absence de clés est dite", async () => {
  const fausse = await verifierJeton({
    auth: reglages(), idToken: jeton({ claims: revendicationsValides() }), nonce: "n-1",
    jwks: { keys: [JWK] }, crypto: cryptoFactice(false), now: MAINTENANT,
  });
  assert.equal(fausse.ok, false);
  assert.equal(fausse.checks.find((c) => c.label === "Signature").ok, false);
  assert.match(fausse.warnings.join(" "), /Signature du jeton non vérifiée/);

  const sansCles = await verifierJeton({
    auth: reglages(), idToken: jeton({ claims: revendicationsValides() }), nonce: "n-1",
    jwksErreur: "JWKS injoignable (HTTP 502)", crypto: cryptoFactice(true), now: MAINTENANT,
  });
  assert.equal(sansCles.ok, false);
  assert.match(sansCles.checks.find((c) => c.label === "Signature").detail, /JWKS injoignable/);

  const kidInconnu = await verifierJeton({
    auth: reglages(), idToken: jeton({ header: { alg: "RS256", kid: "autre" }, claims: revendicationsValides() }),
    jwks: { keys: [{ kty: "EC", kid: "e1", crv: "P-256" }, { kty: "EC", kid: "e2", crv: "P-384" }] },
    crypto: cryptoFactice(({ alg, cle }) => (alg.startsWith("ES") ? cle.kty === "EC" : cle.kty === "RSA")), now: MAINTENANT,
  });
  assert.equal(kidInconnu.ok, false, "aucune clé de la famille annoncée");
  assert.match(kidInconnu.checks.find((c) => c.label === "Signature").detail, /kid « autre »/);

  // Une seule clé, mais de la mauvaise famille : elle est présentée quand même
  // (c'est le seul candidat), et c'est la vérification qui refuse — une clé EC
  // ne vaut pas une signature RS256.
  const mauvaiseFamille = await verifierJeton({
    auth: reglages(), idToken: jeton({ header: { alg: "RS256", kid: "autre" }, claims: revendicationsValides() }),
    jwks: { keys: [{ kty: "EC", kid: "e1", crv: "P-256" }] },
    crypto: cryptoFactice(({ alg, cle }) => (alg.startsWith("ES") ? cle.kty === "EC" : cle.kty === "RSA")), now: MAINTENANT,
  });
  assert.equal(mauvaiseFamille.ok, false);
  assert.match(mauvaiseFamille.checks.find((c) => c.label === "Signature").detail, /ne correspond pas à la clé publiée/);
});

test("désactiver la vérification de signature ne la tait pas", async () => {
  const verdict = await verifierJeton({
    auth: reglages({ requireSignature: false }), idToken: jeton({ claims: revendicationsValides() }), nonce: "n-1",
    jwks: null, jwksErreur: "aucune adresse de clés publiée (jwks_uri)", crypto: cryptoFactice(false), now: MAINTENANT,
  });
  assert.equal(verdict.ok, true, "le référentiel l'a demandé : la connexion passe");
  const sig = verdict.checks.find((c) => c.label === "Signature");
  assert.equal(sig.optional, true);
  assert.equal(sig.ok, false);
  assert.match(verdict.warnings.join(" "), /non vérifiée/);
});

test("un jeton illisible est refusé, pas levé", async () => {
  const verdict = await verifierJeton({ auth: reglages(), idToken: "pas-un-jeton", crypto: cryptoFactice(true), now: MAINTENANT });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.checks[0].label, "Jeton d'identité");
  assert.equal(verdict.checks[0].ok, false);
});

// --------------------------------------------------- revendications → compte
test("une revendication se lit par chemin pointé, quelle que soit sa forme", () => {
  const claims = { groups: ["a"], realm_access: { roles: ["b", "c"] }, resource: { app: { roles: { x: true, y: ["z"] } } } };
  assert.deepEqual(lireRevendication(claims, "realm_access.roles"), ["b", "c"]);
  assert.deepEqual(valeursRevendication(claims, "realm_access.roles"), ["b", "c"]);
  assert.deepEqual(valeursRevendication(claims, "groups"), ["a"]);
  assert.deepEqual(valeursRevendication(claims, "groupes"), [], "une revendication absente ne rend rien");
  assert.deepEqual(valeursRevendication(claims, ""), []);
  // Objet de rôles, comme Zitadel ou Keycloak « resource_access » : seules les
  // valeurs vraies (ou listées) comptent.
  assert.deepEqual(valeursRevendication(claims, "resource.app.roles"), ["x", "z"]);
  // Le chemin complet d'abord : une clé qui contient un point l'emporte.
  assert.deepEqual(valeursRevendication({ "a.b": ["plein"] }, "a.b"), ["plein"]);
});

test("le rôle vient du PREMIER groupe reconnu ; sans groupe reconnu, le compte est Visiteur", () => {
  const auth = reglages();
  assert.equal(roleDepuisRevendications(auth, { groups: ["scribae-editeurs"] }).role, "editeur");
  assert.equal(roleDepuisRevendications(auth, { groups: ["scribae-admins", "scribae-editeurs"] }).role, "administrateur");
  assert.equal(roleDepuisRevendications(auth, { groups: ["autre", "scribae-editeurs"] }).role, "editeur", "un groupe inconnu ne masque pas le suivant");

  const visiteur = roleDepuisRevendications(auth, { groups: ["invités"] });
  assert.equal(visiteur.visiteur, true);
  assert.equal(visiteur.role, ROLE_SANS_ACCES);
  assert.match(visiteur.reason, /invités/, "le motif dit quels groupes ont été reçus");
  assert.match(roleDepuisRevendications(auth, {}).reason, /aucun groupe/);

  // Politique « rôle par défaut » : le compte entre, avec le rôle de repli.
  const repli = roleDepuisRevendications(reglages({ unknownPolicy: "default", defaultRole: "redacteur" }), { groups: ["invités"] });
  assert.equal(repli.role, "redacteur");
  assert.equal(repli.visiteur, false);
});

test("le périmètre suit les revendications, et l'annuaire qui n'annonce rien ne détruit rien", () => {
  const auth = reglages();
  const res = revendicationsVersCompte({ referentiel: REFERENTIEL, auth, claims: revendicationsValides(), now: MAINTENANT });
  assert.equal(res.ok, true);
  assert.equal(res.patch.role, "editeur");
  assert.equal(res.patch.oidcSub, "agent-4711");
  assert.equal(res.patch.source, "oidc");
  assert.equal(res.patch.active, true);
  assert.equal(res.patch.oidcClaim, "scribae-editeurs");
  assert.equal(res.patch.oidcClaims, "scribae-editeurs");
  assert.equal(res.patch.oidcSyncedAt, MAINTENANT().toISOString());
  assert.deepEqual(res.patch.memberships, [{ serviceId: "s-urb", bureaux: null }]);
  assert.equal(res.patch.entityId, "e-vsl");
  assert.equal(res.patch.firstName, "Claire");
  assert.equal(res.patch.lastName, "Martin");

  // Un annuaire qui n'annonce aucun service ne doit pas effacer le périmètre
  // réglé dans l'application.
  const existant = { id: "u-1", login: "c.martin", memberships: [{ serviceId: "s-etat", bureaux: null }], entityId: "e-vsl", createdAt: "2020-01-01T00:00:00.000Z" };
  const sansPerimetre = revendicationsVersCompte({
    referentiel: REFERENTIEL, auth, now: MAINTENANT, existing: existant,
    claims: { ...revendicationsValides(), services: [], entity: "" },
  });
  assert.deepEqual(sansPerimetre.patch.memberships, existant.memberships);
  assert.equal(sansPerimetre.patch.entityId, "e-vsl");
  assert.equal(sansPerimetre.patch.login, "c.martin", "l'identifiant de connexion ne change pas");
  assert.equal(sansPerimetre.patch.id, "u-1");
  assert.equal(sansPerimetre.patch.createdAt, "2020-01-01T00:00:00.000Z", "la date de création est conservée");

  // Un service annoncé par son nom, ou par son code, mène au même rattachement.
  const parNom = revendicationsVersCompte({ referentiel: REFERENTIEL, auth, now: MAINTENANT, claims: revendicationsValides({ services: ["ETAT-CIVIL"] }) });
  assert.deepEqual(parNom.patch.memberships, [{ serviceId: "s-etat", bureaux: null }]);
  const inconnu = revendicationsVersCompte({ referentiel: REFERENTIEL, auth, now: MAINTENANT, claims: revendicationsValides({ services: ["service-qui-nexiste-pas"] }) });
  assert.deepEqual(inconnu.patch.memberships, [], "un service inconnu ne rattache à rien");
});

test("l'annuaire non « faisant foi » authentifie seulement, et laisse le rôle réglé", () => {
  const auth = reglages({ authoritative: false });
  const existant = { id: "u-1", role: "signataire", roles: ["signataire", "reviseur"] };
  const res = revendicationsVersCompte({ referentiel: REFERENTIEL, auth, now: MAINTENANT, existing: existant, claims: revendicationsValides({ groups: ["scribae-admins"] }) });
  assert.equal(res.patch.role, "signataire", "le rôle de l'application est conservé");
  assert.equal(res.patch.oidcClaim, "scribae-admins", "mais on note ce que l'annuaire a annoncé");
  assert.equal(res.patch.oidcSub, "agent-4711");
});

test("les qualités cumulables survivent, sauf quand l'annuaire ne reconnaît personne", () => {
  assert.deepEqual(ROLES_CUMULABLES, ["reviseur", "signataire"]);

  const compte = compteApplique({ existant: { id: "u-1", role: "reviseur", roles: ["reviseur"] }, patch: { role: "editeur" }, principal: "editeur" });
  assert.deepEqual(compte.roles, ["editeur", "reviseur"], "le rôle principal vient de l'annuaire, la qualité reste");
  assert.equal(compte.role, "editeur");

  // Rôle Visiteur : aucune qualité résiduelle ne doit rouvrir un accès.
  const visiteur = compteApplique({ existant: { id: "u-1", role: "reviseur", roles: ["reviseur", "editeur"] }, patch: { role: ROLE_SANS_ACCES }, principal: ROLE_SANS_ACCES });
  assert.deepEqual(visiteur.roles, [ROLE_SANS_ACCES], "un visiteur n'est que visiteur");

  // Le rôle principal est le rang le plus élevé, et jamais une qualité cumulable.
  assert.deepEqual(rolesCanoniques(["redacteur", "reviseur", "administrateur"]), ["administrateur", "reviseur", "redacteur"]);
  assert.deepEqual(rolesCanoniques(["reviseur", "signataire"]), ["reviseur", "signataire"]);
  assert.deepEqual(rolesCanoniques(["inconnu"]), []);

  // Réactivation : un compte désactivé par l'annuaire redevient actif, et les
  // marques de désactivation disparaissent — sans quoi il resterait dehors.
  const reactive = compteApplique({ existant: { id: "u-1", active: false, deactivatedBy: "oidc", deactivatedAt: "2026-01-01T00:00:00.000Z", role: "editeur" }, patch: { active: true, role: "editeur" }, principal: "editeur" });
  assert.equal(reactive.active, true);
  assert.equal(reactive.deactivatedBy, undefined);
  assert.equal(reactive.deactivatedAt, undefined);
});

// -------------------------------------------------------- le branchement complet
test("le branchement complet : découverte, échange, clés, jeton, profil", async () => {
  const f = fournisseur({ profil: ["claire.martin@maville.fr", "c.martin"] });
  const crypto = cryptoFactice(true);
  const res = await verifierConnexionAnnuaire({
    auth: reglages(), code: "le-code", verifier: "le-verificateur", redirectUri: "https://actes.maville.fr/", nonce: "n-1",
    httpJson: f.httpJson, crypto, now: MAINTENANT,
  });
  assert.equal(res.ok, true);
  assert.equal(res.source, "découverte");
  assert.equal(f.appels.map((a) => a.url).join(" "), [ISSUER + "/.well-known/openid-configuration", EP.token, EP.jwks, EP.userinfo].join(" "));
  // Le profil complète le jeton sans l'écraser : le nonce et l'audience du jeton
  // restent ceux qui ont été vérifiés.
  assert.equal(res.claims.sub, "agent-4711");
  assert.equal(res.claims.preferred_username, "c.martin");
  assert.equal(res.claims.nonce, "n-1");
  assert.equal(res.checks.every((c) => c.ok || c.optional), true);
});

test("un échec est remonté tel quel, sans aller plus loin", async () => {
  const refuse = await verifierConnexionAnnuaire({
    auth: reglages(), code: "c", verifier: "v", httpJson: fournisseur({ claims: revendicationsValides({ aud: "autre" }) }).httpJson,
    crypto: cryptoFactice(true), now: MAINTENANT,
  });
  assert.equal(refuse.ok, false);
  assert.equal(refuse.code, "jeton_refuse");
  assert.match(refuse.erreur, /Audience \(aud\)/);

  const panne = await verifierConnexionAnnuaire({
    auth: reglages(), code: "c", verifier: "v", httpJson: fournisseur({ decouverteEnPanne: true }).httpJson,
    crypto: cryptoFactice(true), now: MAINTENANT,
  });
  assert.equal(panne.ok, false);
  assert.equal(panne.code, "fournisseur_injoignable");
});

test("le profil est un complément, jamais une condition", async () => {
  const f = fournisseur({ profil: null });
  const res = await verifierConnexionAnnuaire({
    auth: reglages(), code: "c", verifier: "v", httpJson: f.httpJson, crypto: cryptoFactice(true), now: MAINTENANT,
  });
  assert.equal(res.ok, true, "un /userinfo absent ne fait pas échouer une connexion vérifiée");
  assert.equal(res.claims.sub, "agent-4711");

  assert.deepEqual(await lireProfil({ endpoints: {}, accessToken: "a", httpJson: f.httpJson }), {});
  assert.deepEqual(await lireProfil({ endpoints: DECOUVERTE, accessToken: "", httpJson: f.httpJson }), {});
  assert.deepEqual(await lireProfil({ endpoints: DECOUVERTE, accessToken: "a", httpJson: async () => { throw new Error("coupé"); } }), {});
});

test("le nom de connexion se tire de l'adresse, et reste un identifiant", () => {
  assert.equal(partieLocale("claire.martin@maville.fr"), "claire.martin");
  assert.equal(partieLocale("Jean+Service@maville.fr"), "JeanService");
  assert.equal(partieLocale(""), "");
  assert.equal(partieLocale(undefined), "");
});
