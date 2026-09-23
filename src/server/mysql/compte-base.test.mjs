// ============================================================================
// Épreuves du compte applicatif de la base (`compte-base.mjs`) : l'échappement
// des littéraux et des identifiants, et les ordres qui remettent le compte au
// mot de passe du `.env`.
//
// Le mot de passe passe par du TEXTE SQL : c'est le seul endroit du logiciel où
// une apostrophe mal doublée deviendrait une commande. On éprouve donc aussi
// l'injection.
//
//   node --test src/server/mysql/
// ============================================================================
import { test } from "node:test";
import assert from "node:assert/strict";

import { litteral, identifiant, sqlCompteApplicatif } from "./compte-base.mjs";

// ------------------------------------------------------------------ littéraux

test("un littéral SQL entoure la valeur d'apostrophes", () => {
  assert.equal(litteral("scriba"), "'scriba'");
  assert.equal(litteral(""), "''");
  assert.equal(litteral(null), "''");
  assert.equal(litteral(42), "'42'");
});

test("l'apostrophe du mot de passe est doublée, jamais laissée seule", () => {
  assert.equal(litteral("l'apostrophe"), "'l''apostrophe'");
  assert.equal(litteral("''"), "''''''");
});

test("la barre oblique inverse est doublée (sinon elle avale l'apostrophe fermante)", () => {
  assert.equal(litteral("a\\b"), "'a\\\\b'");
  assert.equal(litteral("fin\\"), "'fin\\\\'");
});

test("un mot de passe qui contient du SQL reste une VALEUR, pas une commande", () => {
  const hostile = "x'; DROP DATABASE scriba; --";
  const echappe = litteral(hostile);
  assert.equal(echappe, "'x''; DROP DATABASE scriba; --'");
  // Le nombre d'apostrophes reste PAIR : aucune ne peut fermer le littéral.
  assert.equal((echappe.match(/'/g) || []).length % 2, 0);
  const sql = sqlCompteApplicatif({ base: "scriba", utilisateur: "scriba", motDePasse: hostile });
  assert.ok(sql.includes(echappe), "le mot de passe n'est pas échappé dans les ordres");
  assert.equal(sql.includes("IDENTIFIED BY 'x'; DROP DATABASE"), false);
});

test("un identifiant SQL s'entoure d'accents graves, doublés", () => {
  assert.equal(identifiant("scriba"), "`scriba`");
  assert.equal(identifiant("ma`base"), "`ma``base`");
  assert.equal(identifiant(""), "``");
  assert.equal(identifiant(null), "``");
});

// --------------------------------------------------------------------- ordres

test("les ordres créent la base, le compte, le mot de passe et les droits", () => {
  const sql = sqlCompteApplicatif({ base: "scriba", utilisateur: "scriba", motDePasse: "Secret-2026!" });
  const lignes = sql.split("\n").map((l) => l.trim()).filter(Boolean);
  assert.equal(lignes.length, 5);
  assert.ok(lignes[0].startsWith("CREATE DATABASE IF NOT EXISTS `scriba`"));
  assert.equal(lignes[1], "CREATE USER IF NOT EXISTS 'scriba'@'%' IDENTIFIED BY 'Secret-2026!';");
  assert.equal(lignes[2], "ALTER USER 'scriba'@'%' IDENTIFIED BY 'Secret-2026!';");
  assert.equal(lignes[3], "GRANT ALL PRIVILEGES ON `scriba`.* TO 'scriba'@'%';");
  assert.equal(lignes[4], "FLUSH PRIVILEGES;");
  // Chaque ordre est terminé : la requête part en `multipleStatements`.
  assert.equal(lignes.filter((l) => !l.endsWith(";")).length, 0);
});

test("les droits portent sur la seule base de l'application", () => {
  const sql = sqlCompteApplicatif({ base: "actes_valmont", utilisateur: "agent", motDePasse: "x", hote: "localhost" });
  assert.ok(sql.includes("GRANT ALL PRIVILEGES ON `actes_valmont`.*"));
  assert.equal(sql.includes("*.*"), false, "aucun droit global");
  assert.ok(sql.includes("'agent'@'localhost'"));
});

test("le mot de passe n'est jamais journalisé par ce module", () => {
  // Le module ne journalise rien : il ne fait que composer du texte. On s'en
  // assure : aucune fonction n'appelle `console`.
  assert.equal(sqlCompteApplicatif.toString().includes("console"), false);
  assert.equal(litteral.toString().includes("console"), false);
});
