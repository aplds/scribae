// ============================================================================
// Remise à zéro du service : POST /v1/admin/purge.
//
// Le pendant côté SERVICE du bouton « Repartir d'un référentiel vierge » (voir
// src/ui/views/referentiel.js) : le recueil public lit le service, donc vider le
// seul navigateur laisserait les publications de démonstration en ligne. La
// purge vide actes déposés, circuits de signature et publications, et exige un
// mot de confirmation explicite.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { createActesApi, emptyState } from "./actes.mjs";

const sha256 = (s) => "0".repeat(64);

function apiDeTest() {
  const etat = emptyState();
  const ecrits = [];
  const api = createActesApi({
    state: etat, sha256, now: () => "2026-01-15T09:00:00.000Z",
    save: (json) => { ecrits.push(json); return true; },
  });
  return { api, etat, ecrits };
}

const sansGarde = { authorize: () => null, rate: () => false };

// Un acte minimal, accepté au dépôt.
const acte = () => ({
  akn: "<akomaNtoso>" + "x".repeat(40) + "</akomaNtoso>",
  numero: "2026-001", nature: "decision", objet: "objet",
  serviceId: "svc", bureauId: "bur", entityId: "ent",
  dateSignature: "2026-01-14", signataire: [{ nom: "Yann Dubois" }],
  signataires: [{ nom: "Yann Dubois" }],
});

test("purge : refusée sans le mot de confirmation", () => {
  const { api } = apiDeTest();
  const non = api.route({ method: "POST", path: "/v1/admin/purge", headers: {}, body: {} }, sansGarde);
  assert.equal(non.status, 400);
  assert.equal(non.body.code, "confirmation_absente");
});

test("purge : vide actes, circuits et publications", () => {
  const { api, etat, ecrits } = apiDeTest();
  const depose = api.route({ method: "POST", path: "/v1/actes", headers: {}, body: acte() }, sansGarde);
  assert.equal(depose.status, 201);
  assert.ok(Object.keys(etat.actes).length > 0);

  const purge = api.route({ method: "POST", path: "/v1/admin/purge", headers: {}, body: { confirmation: "repurge" } }, sansGarde);
  assert.equal(purge.status, 200);
  assert.equal(purge.body.purge, true);
  assert.equal(purge.body.avant.actes, 1);
  assert.equal(Object.keys(etat.actes).length, 0);
  assert.equal(Object.keys(etat.publies).length, 0);
  assert.equal(Object.keys(etat.signatures).length, 0);
  assert.equal(etat.seq, 0);
  // L'état purgé a bien été confié à la persistance.
  assert.ok(ecrits.some((j) => Object.keys(JSON.parse(j).actes).length === 0), "l'état vidé est écrit");
});

test("purge : exige le rôle administrateur", () => {
  const { api } = apiDeTest();
  const refus = api.route({ method: "POST", path: "/v1/admin/purge", headers: {}, body: { confirmation: "repurge" } }, {
    authorize: (headers, regle) => (regle && regle.min === "administrateur" ? { status: 403, headers: {}, body: { erreur: "role" } } : null),
    rate: () => false,
  });
  assert.equal(refus.status, 403);
});

test("purge : documentée dans l'OpenAPI", () => {
  const { api } = apiDeTest();
  const doc = api.openapi();
  assert.ok(doc.paths["/v1/admin/purge"], "la route figure dans la description OpenAPI");
  assert.equal(doc.paths["/v1/admin/purge"].post.operationId, "purgerService");
});
