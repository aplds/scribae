// ============================================================================
// Tests des rôles tels que le service les oppose aux requêtes
// (src/server/mysql/roles.mjs).
//
//   node --test          (ou: npm test)
//
// Le défaut tenu ici : un compte qui ne porte que des qualités cumulables
// (signataire seul, visiteur + signataire) retombait sur le repli « lecteur »
// et se voyait refuser le dépôt comme l'ouverture du circuit — « Rôle
// insuffisant » — alors que l'application lui offre le bouton « Vérifier et
// signer » (`peutSignerEffectivement`, src/lib/signataires.js).
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { ROLES_CONNUES, RANG_ROLE, rolesDeCompte, roleDeCompte, roleAutorise } from "./roles.mjs";

test("roleDeCompte : le signataire seul vaut sa qualité, pas le repli lecteur", () => {
  assert.equal(roleDeCompte({ roles: ["signataire"] }), "signataire");
  assert.equal(roleDeCompte({ role: "signataire" }), "signataire");
});

test("roleDeCompte : visiteur + signataire vaut signataire", () => {
  assert.equal(roleDeCompte({ roles: ["visiteur", "signataire"] }), "signataire");
});

test("roleDeCompte : le cumul garde le plus fort (rédacteur + signataire)", () => {
  assert.equal(roleDeCompte({ roles: ["redacteur", "signataire"] }), "redacteur");
  assert.equal(roleDeCompte({ roles: ["editeur", "reviseur"] }), "editeur");
  assert.equal(roleDeCompte({ roles: ["administrateur", "signataire"] }), "administrateur");
});

test("roleDeCompte : le visiteur seul ne lit rien, et l'inconnu est refusé", () => {
  assert.equal(roleDeCompte({ roles: ["visiteur"] }), "visiteur");
  assert.equal(roleDeCompte({ roles: [] }), "visiteur");
  assert.equal(roleDeCompte({}), "visiteur");
});

test("roleAutorise : le signataire passe les gardes du circuit de signature", () => {
  assert.equal(roleAutorise("signataire", { min: "redacteur" }), true);
  assert.equal(roleAutorise("reviseur", { min: "redacteur" }), true);
  assert.equal(roleAutorise("signataire", { min: "editeur" }), false);
  assert.equal(roleAutorise("visiteur", { min: "lecteur" }), false);
  assert.equal(roleAutorise("lecteur", { min: "lecteur" }), true);
  assert.equal(roleAutorise("prestataire", { exact: ["prestataire", "administrateur"] }), true);
  assert.equal(roleAutorise("signataire", { exact: ["prestataire", "administrateur"] }), false);
});

test("rolesDeCompte : lit roles puis role seul", () => {
  assert.deepEqual(rolesDeCompte({ roles: ["a", "b"] }), ["a", "b"]);
  assert.deepEqual(rolesDeCompte({ role: "redacteur" }), ["redacteur"]);
  assert.deepEqual(rolesDeCompte({}), []);
});

test("tables : tous les rôles de l'application y ont leur rang", () => {
  for (const r of ["administrateur", "editeur", "redacteur", "reviseur", "signataire", "lecteur", "visiteur"]) {
    assert.ok(ROLES_CONNUES.includes(r), r + " connu");
    assert.equal(typeof RANG_ROLE[r], "number", r + " rangé");
  }
  assert.equal(RANG_ROLE.signataire >= RANG_ROLE.redacteur, true);
  assert.equal(RANG_ROLE.visiteur < RANG_ROLE.lecteur, true);
});
