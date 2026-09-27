// ============================================================================
// Épreuves de la signature interne (serveur).
//
// `node:crypto` expose `crypto.subtle` (WebCrypto) depuis Node 18 : le port
// s'éprouve donc ici avec l'implémentation RÉELLE, celle du service — aucune
// substitution. Ce qui se vérifie :
//   • une clé de scellement n'est acceptée que sur 32 octets (hex ou base64) ;
//   • une identité engendrée porte un certificat cohérent (sujet, émetteur,
//     empreinte) et une clé publique JWK ;
//   • la clé privée scellée se descelle, et resigne à l'identique (vérifiable) ;
//   • l'original signé est VÉRIFIABLE, et la falsification du document le rompt ;
//   • le coffre ne laisse pas fuir la clé privée en clair ;
//   • une clé de coffre suit la PERSONNE, et survit à un redémarrage du service.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";

import { portWebcrypto, cleDeScellement, genererIdentite, signerDocument, verifierOriginal, createSignatureInterne, cleCoffre, CLE_HORODATAGE, CLE_DE_SCELLEMENT, FORMAT_ORIGINAL, FORMAT_DOSSIER, ID_SERVICE, ALGORITHME } from "./signature-interne.mjs";
import { sansInterne } from "./original-signe.mjs";

// Le port du service : le MÊME que celui que `server.mjs` construira.
const crypto = portWebcrypto(globalThis.crypto.subtle);

const AKN = "<akomaNtoso><act><body><p>Arrêté n° 2026-001</p></body></act></akomaNtoso>";

async function identiteDeTest(patch = {}) {
  return genererIdentite(crypto, {
    nom: "Jeanne MARTIN", org: "Ville de Valmont-sur-Loire", brand: "Ville de Valmont-sur-Loire", ...patch,
  });
}

test("la clé de scellement : 32 octets, en hexadécimal ou en base64", () => {
  assert.equal(cleDeScellement(crypto.hex(crypto.bytesAleatoires(32))).length, 32, "hexadécimal de 64 caractères");
  assert.equal(cleDeScellement(crypto.b64(crypto.bytesAleatoires(32))).length, 32, "base64");
  assert.equal(cleDeScellement("abcd"), null, "trop courte");
  assert.equal(cleDeScellement(""), null, "absente");
  assert.equal(cleDeScellement("zzzz"), null, "illisible");
});

test("une identité porte un certificat cohérent et une clé publique JWK", async () => {
  const id = await identiteDeTest();
  assert.match(id.certificat.sujet, /CN=Jeanne MARTIN, OU=Ville de Valmont-sur-Loire, O=Ville de Valmont-sur-Loire, C=FR/);
  assert.match(id.certificat.emetteur, /Autorité de certification interne/);
  assert.equal(id.certificat.algorithme, ALGORITHME);
  assert.equal(id.certificat.clePublique.kty, "EC");
  assert.equal(id.certificat.clePublique.crv, "P-256");
  assert.match(id.certificat.empreinte, /^[0-9a-f]{64}$/, "l'empreinte du certificat est un SHA-256");
  assert.ok(!JSON.stringify(id.certificat).includes(id.jwk.privee.d), "le certificat ne porte jamais la clé privée");
});

test("la clé privée scellée se descelle et resigne", async () => {
  const id = await identiteDeTest();
  const cle = cleDeScellement(crypto.hex(crypto.bytesAleatoires(32)));
  const cache = await crypto.sceller(JSON.stringify(id.jwk.privee), cle);
  assert.ok(!cache.includes(id.jwk.privee.d), "le sceau ne laisse pas la clé privée en clair");
  const retour = JSON.parse(await crypto.desceller(cache, cle));
  assert.equal(retour.d, id.jwk.privee.d, "le descellement rend la même clé");
  const signature = await crypto.signer(retour, AKN);
  assert.equal(await crypto.verifier(id.jwk.publique, AKN, signature), true);
});

test("un autre sceau (mauvaise clé) ne se descelle pas", async () => {
  const id = await identiteDeTest();
  const cle = cleDeScellement(crypto.hex(crypto.bytesAleatoires(32)));
  const autre = cleDeScellement(crypto.hex(crypto.bytesAleatoires(32)));
  const cache = await crypto.sceller(JSON.stringify(id.jwk.privee), cle);
  await assert.rejects(() => crypto.desceller(cache, autre), "AES-GCM refuse un tag invalide");
});

test("l'original signé est vérifiable, et la falsification le rompt", async () => {
  const identite = await identiteDeTest();
  const tsa = await identiteDeTest({ kind: "horodatage", nom: "" });
  const pack = await signerDocument(crypto, {
    akn: AKN, identite, horodatageIdentite: tsa,
    signataire: { nom: "Jeanne MARTIN", fonction: "Maire", courriel: "jeanne.martin@vsl.fr" },
    reference: "2026-001-VSL", objet: "portant test", brand: "Ville de Valmont-sur-Loire",
    niveau: "avancee", interne: { compte: "j.martin", authentification: "session du service" },
  });

  assert.equal(pack.format, FORMAT_ORIGINAL);
  assert.equal(pack.prestataire.id, ID_SERVICE);
  assert.equal(pack.prestataire.niveau, "avancee");
  assert.equal(pack.document.akn, AKN);
  assert.equal(pack.signatures.length, 1);
  assert.equal(pack.interne.compte, "j.martin", "le dossier interne voyage avec l'original");

  const verif = await verifierOriginal(crypto, pack);
  assert.equal(verif.ok, true, verif.checks.map((c) => c.label + "=" + c.ok).join(" | "));

  const falsifie = JSON.parse(JSON.stringify(pack));
  falsifie.document.akn = falsifie.document.akn.replace("2026-001", "2026-999");
  const verif2 = await verifierOriginal(crypto, falsifie);
  assert.equal(verif2.ok, false, "un document retouché ne vérifie plus");
});

test("l'horodatage est facultatif", async () => {
  const identite = await identiteDeTest();
  const pack = await signerDocument(crypto, { akn: AKN, identite, signataire: { nom: "Jeanne MARTIN" } });
  assert.equal(pack.horodatage, null);
  assert.equal((await verifierOriginal(crypto, pack)).ok, true);
});

// ------------------------------------------------ le coffre du service
test("la clé de coffre suit la PERSONNE, pas le compte ni l adresse", () => {
  // L'identifiant de personne vient d'abord : un changement de compte, de
  // courriel ou de nom ne doit pas changer le certificat du signataire.
  assert.equal(cleCoffre({ personId: "per-004", compteId: "u-12", courriel: "j.martin@vsl.fr", nom: "Jeanne MARTIN" }), "per-004");
  assert.equal(cleCoffre({ compteId: "u-12", courriel: "j.martin@vsl.fr" }), "u-12");
  assert.equal(cleCoffre({ courriel: "J.Martin@VSL.FR" }), "j.martin@vsl.fr", "la casse ne change pas la clé");
  assert.equal(cleCoffre({}), "signataire", "un signataire sans identifiant a tout de même une clé");
});

test("sans clé de scellement, la signature interne est ÉTEINTE — et le dit", async () => {
  const coffre = {};
  const service = createSignatureInterne({ crypto, cle: "", coffre, brand: "Ville de Valmont-sur-Loire" });
  assert.equal(service.disponible(), false);
  assert.match(service.motif(), new RegExp(CLE_DE_SCELLEMENT));
  assert.equal(service.etat().disponible, false);
  await assert.rejects(() => service.signer({ akn: AKN, signataire: { nom: "Jeanne MARTIN" } }));
  assert.deepEqual(coffre, {}, "un coffre éteint n écrit rien");
});

test("le service signe, scelle la clé, et ne la livre jamais en clair", async () => {
  const coffre = {};
  const cle = crypto.hex(crypto.bytesAleatoires(32));
  const service = createSignatureInterne({ crypto, cle, coffre, brand: "Ville de Valmont-sur-Loire" });
  assert.equal(service.disponible(), true);
  assert.equal(service.motif(), "");
  assert.equal(service.etat().disponible, true);

  const signataire = { nom: "Jeanne MARTIN", fonction: "Maire", courriel: "j.martin@vsl.fr", personId: "per-004", compteId: "u-12", entite: "Ville de Valmont-sur-Loire" };
  const pack = await service.signer({ akn: AKN, signataire, operateur: { id: "u-12", nom: "Jeanne MARTIN" }, reference: "2026-001-VSL", objet: "portant test", poste: "poste de l agent", ip: "10.0.0.4" });

  assert.equal(pack.format, FORMAT_ORIGINAL);
  assert.equal(pack.prestataire.id, ID_SERVICE);
  assert.equal(pack.interne.format, FORMAT_DOSSIER);
  assert.equal(pack.interne.signataire.courriel, "j.martin@vsl.fr", "le dossier interne porte la trace nominative");
  assert.equal(pack.interne.poste, "poste de l agent");
  assert.equal((await verifierOriginal(crypto, pack)).ok, true, "l original est verifiable");

  // La part PUBLIQUE ne laisse rien de nominatif : c est la garantie de la route
  // du recueil (voir original-signe.mjs).
  const publique = sansInterne(pack);
  assert.equal(publique.interne, undefined);
  assert.equal(publique.signatures[0].signataire.courriel, undefined, "le courriel ne sort pas");
  assert.equal(publique.signatures[0].signataire.nom, "Jeanne MARTIN", "le nom, lui, est public");

  // Le coffre : une fiche par signataire, une pour l horodatage, et AUCUNE clé
  // privée en clair.
  const fiches = Object.keys(coffre);
  assert.equal(fiches.length, 2, "un signataire et l horodatage");
  assert.ok(fiches.includes(CLE_HORODATAGE));
  const fiche = coffre["per-004"];
  assert.ok(fiche.cache && fiche.cache.includes(":"), "la clé est scellée (iv:corps)");
  assert.equal(JSON.stringify(coffre).includes('"d"'), false, "aucune clé privée en clair dans le coffre");
  assert.equal(fiche.certificat.clePublique.d, undefined, "le certificat ne porte que la clé publique");

  // LA VALIDITÉ : la signature scelle le document, et lui seul.
  const falsifie = JSON.parse(JSON.stringify(pack));
  falsifie.document.akn = falsifie.document.akn.replace("2026-001", "2026-999");
  assert.equal((await verifierOriginal(crypto, falsifie)).ok, false);
});

test("le certificat d un signataire est STABLE : deux signatures, une seule clé", async () => {
  const coffre = {};
  const cle = crypto.hex(crypto.bytesAleatoires(32));
  const service = createSignatureInterne({ crypto, cle, coffre, brand: "Ville de Valmont-sur-Loire" });
  const signataire = { nom: "Jeanne MARTIN", courriel: "j.martin@vsl.fr", personId: "per-004" };
  const a = await service.signer({ akn: AKN, signataire });
  const b = await service.signer({ akn: AKN + " ", signataire });
  assert.equal(a.signatures[0].certificat.numeroSerie, b.signatures[0].certificat.numeroSerie);
  assert.deepEqual(a.signatures[0].certificat.clePublique, b.signatures[0].certificat.clePublique);
  // Deux documents différents, deux signatures différentes — la clé les sépare.
  assert.notEqual(a.signatures[0].valeur, b.signatures[0].valeur);

  // UN REDÉMARRAGE (une fabrique neuve sur le MÊME coffre) retrouve la clé
  // scellée : le service peut signer de nouveau, et le certificat est le même.
  const apres = createSignatureInterne({ crypto, cle, coffre, brand: "Ville de Valmont-sur-Loire" });
  const c = await apres.signer({ akn: AKN, signataire });
  assert.equal(c.signatures[0].certificat.numeroSerie, a.signatures[0].certificat.numeroSerie);
  assert.equal((await verifierOriginal(crypto, c)).ok, true);
  assert.equal((await verifierOriginal(crypto, a)).ok, true, "l original d avant redemarrage reste verifiable");
});

test("une clé de scellement changée n invalide pas les actes, mais réémet la clé", async () => {
  const coffre = {};
  const service = createSignatureInterne({ crypto, cle: crypto.hex(crypto.bytesAleatoires(32)), coffre, brand: "V" });
  const signataire = { nom: "Jeanne MARTIN", personId: "per-004" };
  const premier = await service.signer({ akn: AKN, signataire });

  // Le coffre déménage avec une AUTRE clé (ou le sceau est corrompu) : la fiche
  // est illisible, une clé neuve est engendrée, et le journal le dit.
  const traces = [];
  const autre = createSignatureInterne({ crypto, cle: crypto.hex(crypto.bytesAleatoires(32)), coffre, brand: "V", journal: (e) => traces.push(e.evenement) });
  const second = await autre.signer({ akn: AKN, signataire });
  assert.ok(traces.includes("coffre_cle_illisible"), "la fiche illisible est signalée");
  assert.ok(traces.includes("coffre_cle_engendree"), "une clé neuve est engendrée");
  assert.notEqual(premier.signatures[0].certificat.numeroSerie, second.signatures[0].certificat.numeroSerie);
  // L'acte déjà signé garde son certificat, donc reste vérifiable : c est ce qui
  // permet de changer la clé de scellement sans perdre le registre.
  assert.equal((await verifierOriginal(crypto, premier)).ok, true);
  assert.equal((await verifierOriginal(crypto, second)).ok, true);
});
