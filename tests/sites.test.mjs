// ============================================================================
// Sites et cookies — l'avertissement inter-site de l'écran « Base de données ».
//
//   node --test tests/
//
// O-5 de l'audit ciblé du 22/09/2026 : les cookies du service (session et
// anti-CSRF) sont posés `SameSite=Lax`, donc ils ne traversent pas d'un SITE à
// un autre. Rien ne le disait avant l'essai : la phrase de refus n'arrivait
// qu'APRÈS l'échec. La règle vit dans `src/lib/sites.js` — un module PUR, sans
// DOM ni réseau, éprouvé ici directement.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { domaineDe, hoteDeAdresse, memeSite, avertissementSite } from "../src/lib/sites.js";

test("le domaine enregistrable approché : les deux derniers libellés", () => {
  assert.equal(domaineDe("app.collectivite.fr"), "collectivite.fr");
  assert.equal(domaineDe("donnees.collectivite.fr"), "collectivite.fr");
  assert.equal(domaineDe("collectivite.fr"), "collectivite.fr");
  assert.equal(domaineDe("localhost"), "localhost");
  assert.equal(domaineDe(""), "");
});

test("l'hôte d'une adresse, même saisie sans schéma", () => {
  assert.equal(hoteDeAdresse("https://donnees.valmont.fr/v1"), "donnees.valmont.fr");
  assert.equal(hoteDeAdresse("donnees.valmont.fr"), "donnees.valmont.fr");
  assert.equal(hoteDeAdresse("http://127.0.0.1:8080"), "127.0.0.1:8080");
  assert.equal(hoteDeAdresse(""), "", "une adresse vide = même origine");
  assert.equal(hoteDeAdresse("   "), "");
  assert.equal(hoteDeAdresse("https://["), "", "une saisie illisible n'affirme rien");
});

test("deux adresses du même domaine sont sur le même site", () => {
  assert.equal(memeSite("https://donnees.collectivite.fr", "https://app.collectivite.fr"), true);
  assert.equal(memeSite("", "https://app.collectivite.fr"), true, "adresse vide = même origine");
  assert.equal(memeSite("http://localhost:8080", "http://localhost:5173"), true, "deux ports sur localhost : un seul site");
  assert.equal(memeSite("https://donnees.example.fr", "https://app.collectivite.fr"), false);
});

test("l'avertissement nomme les deux domaines, et se tait quand tout va bien", () => {
  assert.equal(avertissementSite("https://donnees.collectivite.fr", "https://app.collectivite.fr"), "");
  assert.equal(avertissementSite("", "https://app.collectivite.fr"), "");
  assert.equal(avertissementSite("http://localhost:8080", "http://localhost:5173"), "");

  const avis = avertissementSite("https://donnees.exemple.fr", "https://app.collectivite.fr");
  assert.match(avis, /exemple\.fr/, "il nomme le domaine du service");
  assert.match(avis, /collectivite\.fr/, "et celui de l'application");
  assert.match(avis, /SameSite=Lax/, "il dit la cause");
  assert.match(avis, /session_absente/, "et le refus qui en découlera");
});
