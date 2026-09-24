// ============================================================================
// Tests de la vérification de signature d'un jeton d'identité (jws.mjs).
//
//   node --test          (ou: npm test)
//
// Ce qui est VÉRIFIÉ ici n'est pas la mécanique de Node mais une propriété qui,
// autrement, passerait inaperçue : un jeton parfaitement signé par un vrai
// fournisseur doit être ACCEPTÉ, et il ne doit plus l'être dès qu'un octet
// change. Une vérification de signature a trois façons de mal tourner, toutes
// silencieuses : un encodage de signature qui n'est pas celui attendu (ECDSA en
// DER au lieu de `r‖s`), une longueur de sel qui n'est pas celle de l'algorithme
// (RSA-PSS), et un algorithme accepté par défaut. Les épreuves ci-dessous
// engendrent donc de VRAIES paires de clés, signent de VRAIS jetons, et
// vérifient les trois.
//
// Ces épreuves ont besoin du `node:crypto` complet (`generateKeyPairSync`,
// `createSign`, `createVerify`, `createPublicKey`). Le harnais de navigateur qui
// fait tourner la suite ailleurs ne l'a pas : elles s'y SAUTENT, proprement,
// plutôt que d'échouer.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import * as nodeCrypto from "node:crypto";
import { verifierJws, ALGORITHMES_SIGNATURE } from "./jws.mjs";

const cryptoComplet = typeof nodeCrypto.createSign === "function"
  && typeof nodeCrypto.createVerify === "function"
  && typeof nodeCrypto.generateKeyPairSync === "function";

const b64url = (octets) => Buffer.from(octets).toString("base64url");

// Le signataire d'une épreuve : il signe comme le ferait un fournisseur —
// l'encodage de signature propre à chaque famille, et rien d'autre.
function signataire(alg, clePrivee) {
  const hash = { 256: "sha256", 384: "sha384", 512: "sha512" }[alg.slice(2)];
  const options = alg.startsWith("PS")
    ? { padding: nodeCrypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(alg.slice(2)) / 8 }
    : alg.startsWith("ES") ? { dsaEncoding: "ieee-p1363" }
      : { padding: nodeCrypto.constants.RSA_PKCS1_PADDING };
  return (donnees) => {
    const s = nodeCrypto.createSign(hash);
    s.update(donnees, "utf8");
    s.end();
    return b64url(s.sign({ key: clePrivee, ...options }));
  };
}

let rsa = null;
let ec256 = null;
let ec384 = null;
function cles() {
  if (!rsa) {
    rsa = nodeCrypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    ec256 = nodeCrypto.generateKeyPairSync("ec", { namedCurve: "P-256" });
    ec384 = nodeCrypto.generateKeyPairSync("ec", { namedCurve: "P-384" });
  }
  return {
    rsa: { privee: rsa.privateKey, jwk: { ...rsa.publicKey.export({ format: "jwk" }), kid: "rsa-1", use: "sig", alg: "RS256" } },
    ec256: { privee: ec256.privateKey, jwk: { ...ec256.publicKey.export({ format: "jwk" }), kid: "ec-1" } },
    ec384: { privee: ec384.privateKey, jwk: { ...ec384.publicKey.export({ format: "jwk" }), kid: "ec-2" } },
  };
}

const ANNONCE = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJhYmMifQ";

test("chaque algorithme annoncé par l'annuaire est vérifiable : RS*, PS*, ES*", (t) => {
  if (!cryptoComplet) return t.skip("node:crypto complet requis (harnais de navigateur)");
  const { rsa, ec256, ec384 } = cles();
  const jeux = [
    { alg: "RS256", cle: rsa.jwk, privee: rsa.privee },
    { alg: "RS384", cle: rsa.jwk, privee: rsa.privee },
    { alg: "RS512", cle: rsa.jwk, privee: rsa.privee },
    { alg: "PS256", cle: rsa.jwk, privee: rsa.privee },
    { alg: "PS384", cle: rsa.jwk, privee: rsa.privee },
    { alg: "PS512", cle: rsa.jwk, privee: rsa.privee },
    { alg: "ES256", cle: ec256.jwk, privee: ec256.privee },
    { alg: "ES384", cle: ec384.jwk, privee: ec384.privee },
  ];
  assert.deepEqual(jeux.map((j) => j.alg), ALGORITHMES_SIGNATURE, "la liste éprouvée est celle que le module annonce");
  for (const j of jeux) {
    const signature = signataire(j.alg, j.privee)(ANNONCE);
    assert.equal(verifierJws({ alg: j.alg, cle: j.cle, donnees: ANNONCE, signature }), true, j.alg + " : signature acceptée");
  }
});

test("un seul octet changé dans les données signées suffit à refuser la signature", (t) => {
  if (!cryptoComplet) return t.skip("node:crypto complet requis");
  const { rsa } = cles();
  const signature = signataire("RS256", rsa.privee)(ANNONCE);
  assert.equal(verifierJws({ alg: "RS256", cle: rsa.jwk, donnees: ANNONCE, signature }), true);
  assert.equal(verifierJws({ alg: "RS256", cle: rsa.jwk, donnees: ANNONCE + "x", signature }), false, "données modifiées");
  assert.equal(verifierJws({ alg: "RS256", cle: rsa.jwk, donnees: ANNONCE, signature: signature.slice(0, -2) + "AA" }), false, "signature modifiée");
});

test("la signature d'un autre émetteur ne vaut rien, et une clé inutilisable est un refus, pas une panne", (t) => {
  if (!cryptoComplet) return t.skip("node:crypto complet requis");
  const { rsa, ec256 } = cles();
  const signature = signataire("RS256", rsa.privee)(ANNONCE);
  assert.equal(verifierJws({ alg: "RS256", cle: ec256.jwk, donnees: ANNONCE, signature }), false, "algorithme RSA sur une clé EC");
  assert.equal(verifierJws({ alg: "ES256", cle: rsa.jwk, donnees: ANNONCE, signature }), false, "algorithme EC sur une clé RSA");
  assert.equal(verifierJws({ alg: "RS256", cle: { kty: "RSA", n: "pas-une-cle", e: "AQAB" }, donnees: ANNONCE, signature }), false, "clé illisible");
  assert.equal(verifierJws({ alg: "RS256", cle: null, donnees: ANNONCE, signature }), false, "clé absente");
});

test("les algorithmes que le service ne peut pas vérifier sont refusés — jamais acceptés par défaut", (t) => {
  if (!cryptoComplet) return t.skip("node:crypto complet requis");
  const { rsa, ec256 } = cles();
  const signature = signataire("RS256", rsa.privee)(ANNONCE);
  // Le jeton non signé, et la signature symétrique : les deux classiques.
  assert.equal(verifierJws({ alg: "none", cle: rsa.jwk, donnees: ANNONCE, signature: "" }), false, "alg none");
  assert.equal(verifierJws({ alg: "HS256", cle: rsa.jwk, donnees: ANNONCE, signature }), false, "alg HS256");
  assert.equal(verifierJws({ alg: "", cle: ec256.jwk, donnees: ANNONCE, signature }), false, "alg vide");
  assert.equal(verifierJws({ alg: "ES512", cle: ec256.jwk, donnees: ANNONCE, signature }), false, "ES512 hors liste");
  assert.equal(verifierJws({ alg: "RS128", cle: rsa.jwk, donnees: ANNONCE, signature }), false, "algorithme inventé");
});

test("l'algorithme se lit sans égard à la casse, et les membres d'usage du JWK ne gênent pas", (t) => {
  if (!cryptoComplet) return t.skip("node:crypto complet requis");
  const { rsa } = cles();
  const signature = signataire("RS256", rsa.privee)(ANNONCE);
  assert.equal(verifierJws({ alg: "rs256", cle: rsa.jwk, donnees: ANNONCE, signature }), true, "minuscules");
  // Un JWK réel porte `kid`, `use`, `alg`, `key_ops`, parfois `x5c` : le module
  // ne présente au constructeur que ce qui décrit la clé.
  const charge = { ...rsa.jwk, use: "sig", key_ops: ["verify"], x5c: [], ext: true };
  assert.equal(verifierJws({ alg: "RS256", cle: charge, donnees: ANNONCE, signature }), true, "JWK chargé de membres d'usage");
});
