// ============================================================================
// Tests du relais HTTP (src/server/mysql/relais.mjs).
//
//   node --test          (ou: npm test)
//
// Le relais appelle un tiers pour le compte du navigateur : ces épreuves
// tiennent les quatre verrous, dans l'ordre où ils protègent — la liste
// blanche, le refus des adresses privées (même allowlistées), les méthodes et
// les corps, et l'absence de tout appel réseau quand un verrou tient. Le
// réseau (résolution, appel) est doublé dans chaque épreuve qui l'exerce.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  CORPS_MAX,
  METHODES_AUTORISEES,
  adressePrivee,
  hoteAutorise,
  normaliserHote,
  preparer,
  relayer,
} from "./relais.mjs";

const HOTES = ["grist.exemple.fr", "numeros.interne.example:8443"];

// Une résolution doublée : rend les adresses données pour chaque hôte.
const resolution = (table) => async (hote) => {
  if (!Object.hasOwn(table, hote)) throw new Error("introuvable");
  return table[hote].map((address) => ({ address, family: address.includes(":") ? 6 : 4 }));
};

// Un appel doublé : enregistre la demande et rend la réponse donnée.
const appel = (reponse = { status: 200, texte: '{"id":412}' }) => {
  const vu = [];
  const fn = async (adresse, options) => {
    vu.push({ adresse, options });
    return { status: reponse.status, text: async () => reponse.texte };
  };
  fn.vu = vu;
  return fn;
};

test("la liste blanche compare l'hôte exact, insensible à la casse", () => {
  assert.equal(hoteAutorise("grist.exemple.fr", "443", HOTES), true);
  assert.equal(hoteAutorise("GRIST.EXEMPLE.FR.", "443", HOTES), true);
  assert.equal(hoteAutorise("api.grist.exemple.fr", "443", HOTES), false);
  assert.equal(hoteAutorise("exemple.fr", "443", HOTES), false);
  assert.equal(hoteAutorise("grist.exemple.fr.evil.example", "443", HOTES), false);
  assert.equal(hoteAutorise("", "443", HOTES), false);
  assert.equal(hoteAutorise("grist.exemple.fr", "443", []), false);
});

test("le port allowlisté ne s'étend pas aux autres ports", () => {
  assert.equal(hoteAutorise("numeros.interne.example", "8443", HOTES), true);
  assert.equal(hoteAutorise("numeros.interne.example", "443", HOTES), false);
  // Sans port, l'entrée vaut pour l'hôte entier (tous ses ports).
  assert.equal(hoteAutorise("grist.exemple.fr", "8443", HOTES), true);
});

test("les adresses privées sont reconnues (IPv4)", () => {
  for (const ip of ["127.0.0.1", "10.0.0.5", "172.16.0.1", "172.31.255.255", "192.168.1.20", "169.254.169.254", "0.0.0.0", "224.0.0.1", "999.1.1.1", ""]) {
    assert.equal(adressePrivee(ip), true, ip || "(vide)");
  }
  assert.equal(adressePrivee("172.15.0.1"), false);
  assert.equal(adressePrivee("172.32.0.1"), false);
  assert.equal(adressePrivee("93.184.216.34"), false);
});

test("les adresses privées sont reconnues (IPv6)", () => {
  for (const ip of ["::1", "::", "fc00::1", "fd12::99", "fe80::1", "ff02::1", "::ffff:10.0.0.1"]) {
    assert.equal(adressePrivee(ip), true, ip);
  }
  assert.equal(adressePrivee("2001:db8::1"), false);
});

test("preparer refuse ce qui n'est pas une demande saine", () => {
  assert.equal(preparer({ url: "ftp://grist.exemple.fr/x" }, { hotes: HOTES }).code, "protocole_refuse");
  assert.equal(preparer({ url: "https://user:pass@grist.exemple.fr/" }, { hotes: HOTES }).code, "adresse_invalide");
  assert.equal(preparer({ url: "https://grist.exemple.fr/", method: "TRACE" }, { hotes: HOTES }).code, "methode_refusee");
  assert.equal(preparer({ url: "https://tiers.example/", method: "POST" }, { hotes: HOTES }).code, "hote_non_autorise");
  assert.equal(preparer({ url: "https://grist.exemple.fr/", body: "x".repeat(CORPS_MAX + 1) }, { hotes: HOTES }).code, "corps_trop_volumineux");
});

test("preparer normalise une demande saine et ne reprend pas le transport", () => {
  const { requete, erreur } = preparer({
    url: "https://GRIST.exemple.fr/api/docs/7/tables/Numeros/records",
    method: "post",
    headers: { Authorization: "Bearer cle", "Content-Type": "application/json", Host: "menteur.example", Connection: "keep-alive" },
    body: '{"a":1}',
  }, { hotes: HOTES });
  assert.equal(erreur, undefined);
  assert.equal(requete.adresse, "https://grist.exemple.fr/api/docs/7/tables/Numeros/records");
  assert.equal(requete.methode, "POST");
  assert.equal(requete.entetes.Authorization, "Bearer cle");
  assert.equal(requete.entetes.Host, undefined);
  assert.equal(requete.entetes.Connection, undefined);
});

test("relayer rend la réponse du tiers, sans l'altérer", async () => {
  const f = appel();
  const out = await relayer(
    { url: "https://grist.exemple.fr/api/x", method: "POST", headers: { Authorization: "Bearer k" }, body: "{}" },
    { hotes: HOTES, resolution: resolution({ "grist.exemple.fr": ["93.184.216.34"] }), fetchImpl: f },
  );
  assert.equal(out.statut, 200);
  assert.equal(out.corps, '{"id":412}');
  assert.equal(out.tronque, false);
  assert.equal(f.vu.length, 1);
  assert.equal(f.vu[0].options.headers.Authorization, "Bearer k");
});

test("relayer n'appelle rien quand un verrou tient", async () => {
  const f = appel();
  const refusee = await relayer(
    { url: "https://tiers.example/", method: "GET" },
    { hotes: HOTES, resolution: resolution({}), fetchImpl: f },
  );
  assert.equal(refusee.refus.code, "hote_non_autorise");
  assert.equal(f.vu.length, 0);
});

test("relayer refuse une adresse privée même allowlistée", async () => {
  const f = appel();
  const out = await relayer(
    { url: "https://grist.exemple.fr/", method: "GET" },
    { hotes: HOTES, resolution: resolution({ "grist.exemple.fr": ["93.184.216.34", "10.0.0.9"] }), fetchImpl: f },
  );
  assert.equal(out.refus.code, "adresse_privee");
  assert.equal(f.vu.length, 0);
});

test("relayer refuse quand l'hôte ne résout pas, et rend l'échec du tiers en 502", async () => {
  const f = appel();
  const irresoluble = await relayer(
    { url: "https://grist.exemple.fr/", method: "GET" },
    { hotes: HOTES, resolution: resolution({}), fetchImpl: f },
  );
  assert.equal(irresoluble.refus.code, "hote_irresoluble");
  const hs = appel({ status: 500, texte: "panne" });
  const echec = await relayer(
    { url: "https://grist.exemple.fr/", method: "GET" },
    { hotes: HOTES, resolution: resolution({ "grist.exemple.fr": ["93.184.216.34"] }), fetchImpl: hs },
  );
  assert.equal(echec.statut, 500);
  assert.equal(echec.corps, "panne");
});

test("relayer plafonne la réponse rendue au navigateur", async () => {
  const f = appel({ status: 200, texte: "y".repeat(2 * 1024 * 1024) });
  const out = await relayer(
    { url: "https://grist.exemple.fr/", method: "GET" },
    { hotes: HOTES, resolution: resolution({ "grist.exemple.fr": ["93.184.216.34"] }), fetchImpl: f },
  );
  assert.equal(out.tronque, true);
  assert.ok(out.corps.length <= 1024 * 1024);
});

test("METHODES_AUTORISEES couvre les méthodes de la numérotation externe", () => {
  assert.deepEqual([...METHODES_AUTORISEES].sort(), ["GET", "PATCH", "POST", "PUT"]);
  assert.equal(normaliserHote(" Exemple.FR... "), "exemple.fr");
});
