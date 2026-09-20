// ============================================================================
// Tests du domaine « signature et publication ».
//
//   node --test          (ou: npm test)
//
// Le domaine est pur : on lui injecte une empreinte (crypto de Node), une
// horloge figée et une persistance en mémoire. Aucune base, aucun réseau.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createActesApi, emptyState } from "./actes.mjs";

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");
const AKN = "<akomaNtoso><body>Arrêté n°2026-401</body></akomaNtoso>";
const JETON = "Bearer bon";

function banc({ save = () => true } = {}) {
  const state = emptyState();
  const api = createActesApi({ state, sha256, save, now: () => "2026-03-10T12:00:00.000Z" });
  const authorize = (headers) => (String(headers.authorization || "").includes(JETON)
    ? null
    : { status: 401, headers: {}, body: { erreur: "absent", code: "jeton_absent" } });
  const call = (method, path, body, headers = {}, ctx = {}) =>
    api.route({ method, path, headers, body }, { authorize, rate: () => false, ...ctx });
  return { state, api, call };
}

test("santé et description OpenAPI", () => {
  const { call } = banc();
  const sante = call("GET", "/v1/health");
  assert.equal(sante.status, 200);
  assert.equal(sante.body.statut, "ok");
  const spec = call("GET", "/v1/");
  assert.equal(spec.status, 200);
  assert.ok(spec.body.paths["/v1/actes"]);
  assert.equal(spec.body.servers[0].url, "/");
});

test("une écriture sans jeton est refusée", () => {
  const { call } = banc();
  assert.equal(call("POST", "/v1/actes", { akn: AKN }).status, 401);
});

test("dépôt d'un acte, puis idempotence tant que le circuit est ouvert", () => {
  const { api, call } = banc();
  const premier = call("POST", "/v1/actes", { akn: AKN, numero: "2026-401", dateSignature: "2026-03-10" }, { authorization: JETON });
  assert.equal(premier.status, 201);
  assert.equal(premier.body.id, "ACT-0001");
  assert.ok(api.takeDirty(), "l'état doit être marqué à écrire");
  assert.equal(api.takeDirty(), null, "l'état ne doit être écrit qu'une fois");

  const second = call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON });
  assert.equal(second.status, 200);
  assert.equal(second.body.idempotent, true);
  assert.equal(second.body.id, premier.body.id);
});

test("un document trop volumineux est refusé", () => {
  const state = emptyState();
  const api = createActesApi({ state, sha256, save: () => true, maxDoc: 10 });
  const res = api.route({ method: "POST", path: "/v1/actes", headers: { authorization: JETON }, body: { akn: AKN } }, { authorize: () => null });
  assert.equal(res.status, 413);
});

test("la publication précède obligatoirement la signature", () => {
  const { call } = banc();
  const a = call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON }).body;
  const res = call("POST", `/v1/actes/${a.id}/publication`, { html: "x", akn: AKN, original: {}, eliUri: "eli:/fr/arr/2026/0401/iam" }, { authorization: JETON });
  assert.equal(res.status, 409);
  assert.equal(res.body.code, "acte_non_signe");
});

test("le webhook n'accepte pas un document différent de celui déposé", () => {
  const { state, call } = banc();
  const a = call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON }).body;
  const s = call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON }).body;

  const faux = call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN + "FALSIFIÉ" }, signatures: [{ signeLe: "2026-03-10T12:10:00.000Z" }] },
  });
  assert.equal(faux.status, 409);
  assert.equal(faux.body.code, "empreinte_divergente");
  assert.equal(state.signatures[s.signatureId].statut, "rejetee");

  const vrai = call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z", algorithme: "ECDSA P-256 / SHA-256", signataire: { nom: "Yann Dubois", fonction: "Maire" } }] },
  });
  assert.equal(vrai.status, 200);
  assert.equal(vrai.body.statut, "signee");
  assert.equal(state.actes[a.id].statut, "signee");
});

test("publication : ELI, registre, idempotence et date d'opposabilité", () => {
  const { call } = banc();
  const a = call("POST", "/v1/actes", { akn: AKN, numero: "2026-401", dateSignature: "2026-03-10" }, { authorization: JETON }).body;
  const s = call("POST", `/v1/actes/${a.id}/signature`, {}, { authorization: JETON }).body;
  call("POST", "/v1/webhooks/signature", {
    signatureId: s.signatureId,
    documentSigne: { document: { akn: AKN }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] },
  });

  const corps = { html: "<html>x</html>", akn: AKN, eliUri: "eli:/fr/arr/2026/0401/iam", datePublication: "2026-03-11", original: { document: { sha256: sha256(AKN) }, signatures: [{ signeLe: "2026-03-10T12:20:00.000Z" }] } };
  const publie = call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON, "idempotency-key": "idem-1" });
  assert.equal(publie.status, 201);
  assert.equal(publie.body.eliUri, "eli:/fr/arr/2026/0401/iam");
  const cle = publie.body.cle;

  const rejeu = call("POST", `/v1/actes/${a.id}/publication`, corps, { authorization: JETON, "idempotency-key": "idem-1" });
  assert.equal(rejeu.status, 200);
  assert.equal(rejeu.body.idempotent, true);

  const anterieure = call("POST", `/v1/actes/${a.id}/publication`, { ...corps, datePublication: "2026-01-01" }, { authorization: JETON });
  assert.equal(anterieure.status, 422);
  assert.equal(anterieure.body.code, "date_publication_anterieure");

  assert.equal(call("GET", "/v1/publications").body.publications.length, 1);
  assert.ok(Array.isArray(call("GET", `/v1/publications/${encodeURIComponent(cle)}`).body.versions));
  assert.equal(call("GET", "/v1/eli/arr/2026/0401/iam").status, 200);
  assert.equal(call("GET", "/v1/eli/arr/2026/9999/zzz").status, 404);
  assert.equal(call("GET", "/v1/actes").body.actes.length, 1);
});

test("le routage : hors domaine, méthode et débit", () => {
  const { call, api } = banc();
  assert.equal(call("GET", "/v1/db/health"), null, "les routes de données ne relèvent pas de ce domaine");
  assert.equal(call("DELETE", "/v1/actes").status, 405);

  const limite = api.route({ method: "POST", path: "/v1/actes", headers: {}, body: { akn: AKN } }, { rate: () => true });
  assert.equal(limite.status, 429);
});

test("la capacité de l'état est respectée", () => {
  const { call } = banc({ save: () => false });
  const res = call("POST", "/v1/actes", { akn: AKN }, { authorization: JETON });
  assert.equal(res.status, 507);
});
