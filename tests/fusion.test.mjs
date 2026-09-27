// ============================================================================
// Tests de la FUSION À TROIS VOIES — `node --test`.
//
// Ce que ces épreuves protègent, et pourquoi elles existent : depuis la 1.6.2,
// deux postes qui écrivent le même enregistrement ne s'écrasent plus — leurs
// modifications sont réunies champ par champ (voir src/lib/fusion.js). Ce
// fichier est le contrat de cette promesse : « rien n'est perdu en silence ».
// Une régression ici ne se verrait pas à l'écran : elle se verrait le lendemain,
// sous la forme d'un paragraphe qui a disparu du dossier. Le module est PUR (ni
// DOM, ni réseau) : on l'éprouve donc directement.
//
//   node --test tests/
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { fusionnerJson, estListeIdentifiee, decrireDesaccords } from "../src/lib/fusion.js";

test("fusion : un seul côté a changé — c'est lui qui l'emporte", () => {
  const base = { objet: "Arrêté", numero: "" };
  // Notre poste a rempli le numéro ; le leur n'a rien touché.
  assert.deepEqual(fusionnerJson(base, { objet: "Arrêté", numero: "2026-14" }, base).valeur,
    { objet: "Arrêté", numero: "2026-14" });
  // L'inverse : leur poste a rempli le numéro, le nôtre n'a rien touché.
  assert.deepEqual(fusionnerJson(base, base, { objet: "Arrêté", numero: "2026-14" }).valeur,
    { objet: "Arrêté", numero: "2026-14" });
  // Les deux ont fait la MÊME chose : une seule version.
  assert.deepEqual(fusionnerJson(base, { objet: "Arrêté", numero: "9" }, { objet: "Arrêté", numero: "9" }).valeur,
    { objet: "Arrêté", numero: "9" });
});

test("fusion : deux champs différents changés de part et d'autre sont CONSERVÉS", () => {
  const base = { objet: "Arrêté", numero: "", dateSignature: "", signataire: "" };
  const notre = { ...base, objet: "Arrêté portant réglementation du stationnement" };
  const leur = { ...base, signataire: "p-maire" };
  const r = fusionnerJson(base, notre, leur);
  assert.equal(r.valeur.objet, "Arrêté portant réglementation du stationnement");
  assert.equal(r.valeur.signataire, "p-maire");
  assert.equal(r.desaccords.length, 0, "aucun désaccord : les deux modifications tiennent ensemble");
});

test("fusion : le MÊME champ changé différemment — la nôtre est gardée, et c'est SIGNALÉ", () => {
  const base = { objet: "Arrêté" };
  const notre = { objet: "Arrêté municipal" };
  const leur = { objet: "Arrêté préfectoral" };
  const r = fusionnerJson(base, notre, leur);
  assert.equal(r.valeur.objet, "Arrêté municipal", "le poste qui écrit garde sa valeur");
  assert.equal(r.desaccords.length, 1, "le désaccord doit être signalé, jamais avalé");
  assert.equal(r.desaccords[0].chemin, "objet");
  assert.match(decrireDesaccords(r.desaccords), /objet/);
});

test("fusion : une clé ajoutée d'un côté, une autre de l'autre — les deux survivent", () => {
  const base = { a: 1 };
  const r = fusionnerJson(base, { a: 1, c: 3 }, { a: 1, b: 2 });
  assert.deepEqual(r.valeur, { a: 1, b: 2, c: 3 });
});

test("fusion : une clé SUPPRIMÉE d'un côté, intacte de l'autre — la suppression est honorée", () => {
  const base = { numero: "1", annexes: ["a"] };
  const r = fusionnerJson(base, { numero: "1" }, base);
  assert.deepEqual(r.valeur, { numero: "1" });
});

test("fusion : une clé supprimée d'un côté, MODIFIÉE de l'autre — la modification survit", () => {
  const base = { numero: "1", objet: "Ancien" };
  const r = fusionnerJson(base, { numero: "1", objet: "Nouveau" }, { numero: "1" });
  assert.deepEqual(r.valeur, { numero: "1", objet: "Nouveau" });
});

test("fusion : les listes IDENTIFIÉES se réunissent élément par élément", () => {
  // L'état que le poste connaissait, puis ce qu'il propose, puis ce que la base
  // détient : chacun a modifié un élément DIFFÉRENT, et l'un a ajouté le sien.
  const base = [{ id: "f1", label: "Objet", required: true }, { id: "f2", label: "Date" }];
  const notre = [{ id: "f1", label: "Objet", required: true }, { id: "f2", label: "Date de signature" }];
  const leur = [{ id: "f1", label: "Objet de l'arrêté", required: true }, { id: "f2", label: "Date" }, { id: "f3", label: "Signataire" }];
  const r = fusionnerJson(base, notre, leur);
  assert.equal(r.valeur.length, 3);
  assert.equal(r.valeur.find((x) => x.id === "f1").label, "Objet de l'arrêté", "la modification de l'autre poste");
  assert.equal(r.valeur.find((x) => x.id === "f2").label, "Date de signature", "la nôtre");
  assert.equal(r.valeur.find((x) => x.id === "f3").label, "Signataire", "son ajout");
  assert.equal(r.desaccords.length, 0);
});

test("fusion : un élément supprimé d'un côté, modifié de l'autre — on ne perd pas le travail", () => {
  const base = [{ id: "v1", text: "Vu la loi" }];
  const notre = [{ id: "v1", text: "Vu la loi du 12 avril 2000" }];   // nous l'avons corrigé
  const leur = [];                                                    // ils l'ont retiré
  const r = fusionnerJson(base, notre, leur);
  assert.equal(r.valeur.length, 1, "la correction supplante la suppression : rien ne se perd");
  assert.equal(r.valeur[0].id, "v1");
  assert.equal(r.desaccords.length, 1);
});

test("fusion : une suppression des deux côtés s'applique", () => {
  const base = [{ id: "v1", text: "Vu la loi" }];
  assert.deepEqual(fusionnerJson(base, [], []).valeur, []);
  // Cas réel : celui qui n'a pas touché l'élément honore la suppression de l'autre.
  assert.deepEqual(fusionnerJson(base, base, []).valeur, []);
  assert.deepEqual(fusionnerJson(base, [], base).valeur, []);
});

test("fusion : les listes NON identifiées (de chaînes) ne se devinent pas", () => {
  const base = { entityIds: ["e1", "e2"] };
  // Un seul des deux a changé : pas d'ambiguïté.
  const r0 = fusionnerJson(base, { entityIds: ["e1", "e2", "e3"] }, base);
  assert.deepEqual(r0.valeur.entityIds, ["e1", "e2", "e3"]);
  assert.equal(r0.desaccords.length, 0);
  // Les deux ont changé, différemment : on garde la nôtre, et ON LE DIT —
  // deviner une intention dans « e1, e2, e3 » n'aurait aucun sens.
  const r = fusionnerJson(base, { entityIds: ["e1", "e2", "e3"] }, { entityIds: ["e9"] });
  assert.deepEqual(r.valeur.entityIds, ["e1", "e2", "e3"]);
  assert.equal(r.desaccords.length, 1);
  assert.equal(r.desaccords[0].chemin, "entityIds");
});

test("fusion : un tableau vide n'est pas une liste identifiée n'importe comment", () => {
  assert.equal(estListeIdentifiee([]), true);
  assert.equal(estListeIdentifiee(["a"]), false, "une liste de chaînes n'a pas d'identifiants");
  assert.equal(estListeIdentifiee([{ id: "a" }, { id: "a" }]), false, "des identifiants en double ne se fusionnent pas");
  assert.equal(estListeIdentifiee([{ id: "a" }, { label: "sans identifiant" }]), false);
});

test("fusion : le désaccord ne dit pas le document entier", () => {
  const base = { textes: { a: "un texte très long ".repeat(40) } };
  const r = fusionnerJson(base, { textes: { a: "nôtre" } }, { textes: { a: "leur" } });
  assert.equal(r.desaccords.length, 1);
  assert.ok(r.desaccords[0].notre.length <= 121, "le résumé est borné");
  assert.ok(r.desaccords[0].chemin.includes("textes"));
});
