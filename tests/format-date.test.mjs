// ============================================================================
// LES DATES HORODATÉES S'AFFICHENT COMME DES DATES — `node --test`.
//
// POURQUOI CE FICHIER EXISTE. `formatDate` (`lib/util.js`) ne savait lire que le
// format strict `AAAA-MM-JJ` : un horodatage complet (`2026-09-27T19:31:42Z`,
// celui que porte `updatedAt`) traversait la fonction sans être mis en forme,
// et la fiche dépliée du registre affichait « mis à jour le
// 2026-09-27T19:31:42Z » au milieu de dates en toutes lettres. La règle est
// unique et vit dans `formatDate` : toute valeur qui COMMENCE par une date
// calendaire se met en forme (l'heure, si elle existe, est ignorée), et une
// date impossible (`2026-13-40`) est rendue telle quelle plutôt qu'avec un mois
// « undefined ». Ses dents : restreindre l'expression au format strict fait
// échouer le premier test.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { formatDate } from "../src/lib/util.js";

test("un horodatage complet se lit comme sa date calendaire", () => {
  assert.equal(formatDate("2026-09-27T19:31:42Z"), "27 septembre 2026");
  assert.equal(formatDate("2026-12-02 14:05:00"), "2 décembre 2026");
  assert.equal(formatDate("2026-09-27T19:31:42Z", "date-short"), "27/09/2026");
  assert.equal(formatDate("2026-09-27T19:31:42Z", "date-month"), "septembre 2026");
});

test("les dates simples et les autres valeurs ne changent pas", () => {
  assert.equal(formatDate("2026-12-02"), "2 décembre 2026");
  assert.equal(formatDate("2026-12-01"), "1er décembre 2026");
  assert.equal(formatDate(""), "");
  assert.equal(formatDate("sans date"), "sans date");
  assert.equal(formatDate("2026-13-40"), "2026-13-40");
});
