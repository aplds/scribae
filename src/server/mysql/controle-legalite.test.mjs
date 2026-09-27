// ============================================================================
// Tests du contrôle de légalité (src/server/mysql/controle-legalite.mjs).
//
//   node --test          (ou: npm test)
//
// C'est le seul module du service qui adresse réellement l'acte signé à l'API
// @ctes. Ces épreuves tiennent quatre choses, dans cet ordre d'importance :
//   1. RIEN NE SORT quand le module n'est pas branché : sans adresse, sans clé
//      ou en transport « demonstration », aucun appel réseau n'a lieu — et
//      `actif()` le dit, c'est ce que l'exploitant lit au démarrage ;
//   2. la CLÉ ne se répand pas : elle ne part que dans l'en-tête Authorization,
//      vers l'adresse configurée, et elle n'apparaît dans aucun état rendu ;
//   3. un refus n'est JAMAIS converti en certificat : un 4xx/5xx LÈVE, et
//      l'appelant sait qu'il n'y a pas d'accusé de réception ;
//   4. une réponse sans référence d'accusé de réception LÈVE aussi : un accusé
//      vide ne vaut pas un certificat opposable.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { createControleLegalite } from "./controle-legalite.mjs";

// Un faux `fetch` qui note les appels et rend ce qu'on lui dit de rendre.
function banc({ status = 201, data = { reference: "AR-2026-0001" }, texte = null } = {}) {
  const appels = [];
  const fetchImpl = async (url, init) => {
    appels.push({ url, init });
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (texte !== null ? texte : JSON.stringify(data || {})),
    };
  };
  return { appels, fetchImpl };
}

const CLE = "cle-de-test-0123456789abcdef";

test("sans réglage, le module n'est pas actif et n'appelle rien", async () => {
  const { appels, fetchImpl } = banc();
  const cl = createControleLegalite({ api: {}, cle: "", fetchImpl });
  assert.equal(cl.actif(), false);
  await assert.rejects(() => cl.transmettre({ akn: "<acte/>" }), /transmission reste simulée/);
  assert.equal(appels.length, 0, "aucun appel sortant");
  assert.match(cl.etat().motif, /aucune adresse/);
});

test("une adresse sans clé ne suffit pas : le transport reste simulé, et le motif le dit", async () => {
  const { appels, fetchImpl } = banc();
  const cl = createControleLegalite({ api: { url: "https://ctes.exemple.fr/v1" }, cle: "", fetchImpl });
  assert.equal(cl.actif(), false);
  assert.match(cl.etat().motif, /clé d'API absente/);
  assert.equal(cl.etat().cle, false);
  await assert.rejects(() => cl.transmettre({}), /clé d'API absente/);
  assert.equal(appels.length, 0);
});

test("le transport « demonstration » n'appelle rien, même avec adresse et clé", async () => {
  const { appels, fetchImpl } = banc();
  const cl = createControleLegalite({ api: { transport: "demonstration", url: "https://ctes.exemple.fr/v1" }, cle: CLE, fetchImpl });
  assert.equal(cl.actif(), false);
  assert.match(cl.etat().motif, /demonstration/);
  await assert.rejects(() => cl.transmettre({}), /aucun appel sortant/);
  assert.equal(appels.length, 0);
});

test("branché, il transmet réellement et rend la référence de l'accusé de réception", async () => {
  const { appels, fetchImpl } = banc({ status: 201, data: { reference: "AR-2026-0042", recuLe: "2026-09-27T08:10:00.000Z", destinataire: "Préfecture du Loiret" } });
  const cl = createControleLegalite({
    api: { url: "https://ctes.exemple.fr/v1/", chemin: "/transmissions", destinataire: "Préfecture — contrôle de légalité" },
    cle: CLE, fetchImpl,
  });
  assert.equal(cl.actif(), true);
  const recu = await cl.transmettre({ acteId: "ACTE-0001", numero: "2026-1", akn: "<acte/>", empreinte: "abc", destinataire: "Préfecture du Loiret" });
  assert.equal(recu.reference, "AR-2026-0042");
  assert.equal(recu.recuLe, "2026-09-27T08:10:00.000Z");
  assert.equal(recu.destinataire, "Préfecture du Loiret");
  assert.equal(appels.length, 1);
  // L'adresse est celle du réglage, le chemin est joint sans double barre.
  assert.equal(appels[0].url, "https://ctes.exemple.fr/v1/transmissions");
  assert.equal(appels[0].init.method, "POST");
  // La clé ne part QUE dans l'en-tête Authorization, et vers cette adresse.
  assert.equal(appels[0].init.headers.authorization, "Bearer " + CLE);
  const corps = JSON.parse(appels[0].init.body);
  assert.equal(corps.acteId, "ACTE-0001");
  assert.equal(corps.document.contenu, "<acte/>");
  assert.equal(JSON.stringify(corps).includes(CLE), false, "la clé ne voyage pas dans le corps");
});

test("un refus de l'API LÈVE, et n'est jamais converti en certificat", async () => {
  const { fetchImpl } = banc({ status: 403, texte: "{\"erreur\":\"hors délai de transmission\"}" });
  const cl = createControleLegalite({ api: { url: "https://ctes.exemple.fr/v1" }, cle: CLE, fetchImpl });
  await assert.rejects(() => cl.transmettre({ akn: "<acte/>" }), (e) => {
    assert.match(e.message, /refusé la transmission \(403\)/);
    assert.match(e.message, /hors délai/);
    return true;
  });
});

test("une réponse 2xx sans référence LÈVE : un accusé vide ne vaut pas un certificat", async () => {
  const { fetchImpl } = banc({ status: 201, data: { ok: true } });
  const cl = createControleLegalite({ api: { url: "https://ctes.exemple.fr/v1" }, cle: CLE, fetchImpl });
  await assert.rejects(() => cl.transmettre({ akn: "<acte/>" }), /aucune référence/);
});

test("l'état ne rend jamais la clé : seulement un booléen", () => {
  const cl = createControleLegalite({ api: { url: "https://ctes.exemple.fr/v1" }, cle: CLE });
  const etat = cl.etat();
  assert.equal(etat.cle, true);
  assert.equal(JSON.stringify(etat).includes(CLE), false);
});

test("un point de terminaison injoignable LÈVE, en le disant", async () => {
  const fetchImpl = async () => { throw new Error("getaddrinfo ENOTFOUND"); };
  const cl = createControleLegalite({ api: { url: "https://ctes.exemple.fr/v1" }, cle: CLE, fetchImpl });
  await assert.rejects(() => cl.transmettre({ akn: "<acte/>" }), /injoignable/);
});

test("le journal trace l'appel sans jamais porter la clé", () => {
  const lignes = [];
  const { fetchImpl } = banc();
  const promesse = createControleLegalite({
    api: { url: "https://ctes.exemple.fr/v1" }, cle: CLE, fetchImpl,
    journal: (e) => lignes.push(e),
  }).transmettre({ akn: "<acte/>" });
  return promesse.then(() => {
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].statut, 201);
    assert.equal(JSON.stringify(lignes).includes(CLE), false);
  });
});
