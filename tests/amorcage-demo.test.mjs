// ============================================================================
// Amorçage : le jeu de démonstration est-il semé, ou laissé de côté ?
//
// Le commutateur de démonstration (`DEMO` du .env, voir src/lib/demo.js) décide
// de tout : démonstration ALLUMÉE, l'application sème le jeu fictif livré ;
// ÉTEINTE, elle part d'un référentiel VIERGE — aucune entité, assemblée, service,
// personne, rôle, référence, famille, trame, acte ni compte, et AUCUNE mention de
// la collectivité fictive (ni à l'écran, ni dans les données servies).
//
//   node --test tests/
//
// Les modules sont chargés DYNAMIQUEMENT : un module qui exigerait un navigateur
// ferait échouer l'import, et les tests sont alors SAUTÉS au lieu de faire
// tomber la suite.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

// Aucune trace du jeu fictif dans une valeur (référentiel, trames, actes,
// comptes). C'est le critère « page vierge » : la fiction ne doit apparaître
// nulle part, pas même enfouie dans les données de l'application.
const FICTIONS = ["Valmont", "Saint-Aubin", "Les Amis du Valmont"];
function sansFiction(valeur, quoi) {
  const texte = JSON.stringify(valeur ?? null);
  for (const mot of FICTIONS) {
    assert.equal(texte.includes(mot), false, `${quoi} : mention fictive « ${mot} »`);
  }
}

test("démonstration éteinte : l'amorçage ne sème rien", async (t) => {
  const store = await charger("../src/lib/store.js");
  const auth = await charger("../src/lib/auth.js");
  if (!store || !auth) return t.skip("module indisponible hors navigateur");

  await store.clearAll();
  auth.setDeploiementAuth({ mode: "password", demo: false, demoJeu: false });
  const { config, trames, actes, users } = await store.bootstrap();

  // Identité neutre, et le miroir du commutateur.
  assert.equal(config.brand.demo, false);
  assert.equal(String(config.brand.name || "").includes("Valmont"), false);
  assert.equal(config.brand.logoUrl || "", "", "aucun blason sur un référentiel vierge");
  assert.equal(config.brand.logoUrlDark || "", "", "aucun blason sombre non plus");

  // Rien n'a été construit.
  for (const cle of ["entities", "councils", "services", "people", "roles", "refs", "families", "styles"]) {
    assert.equal((config[cle] || []).length, 0, `config.${cle} devrait être vide`);
  }
  assert.equal(trames.length, 0);
  assert.equal(actes.length, 0);
  assert.equal(users.length, 0);

  // Et nulle part la fiction.
  sansFiction(config, "config");
  sansFiction(trames, "trames");
  sansFiction(actes, "actes");
  sansFiction(users, "users");
});

test("démonstration active : le jeu livré est installé", async (t) => {
  const store = await charger("../src/lib/store.js");
  const auth = await charger("../src/lib/auth.js");
  if (!store || !auth) return t.skip("module indisponible hors navigateur");

  await store.clearAll();
  auth.setDeploiementAuth({ mode: "demo", demo: true, demoJeu: true });
  const { config, trames, actes, users } = await store.bootstrap();

  assert.equal(config.brand.demo, true);
  assert.ok(String(config.brand.logoUrl || "").startsWith("data:"), "le blason livré est semé");
  assert.ok(String(config.brand.logoUrlDark || "").startsWith("data:"),
    "sa variante pour le thème sombre aussi, et les deux diffèrent");
  assert.notEqual(config.brand.logoUrl, config.brand.logoUrlDark);
  assert.ok((config.entities || []).length > 0, "le référentiel de démonstration est semé");
  assert.ok(trames.length > 0, "les trames de démonstration sont semées");
  assert.ok(users.length > 0, "les comptes de démonstration sont semés");
  assert.ok(actes.length > 0, "les actes de démonstration sont générés");
});

// ---------------------------------------------------------------------------
// O-4 (audit ciblé du 22/09/2026) : `config` et `users` sont les deux
// collections que le service réserve à l'administrateur (`COLLECTIONS_ADMIN`).
// Un agent dont le compte n'est PAS administrateur ne doit donc pas les voir
// tenter à chaque démarrage : le service répondrait `403 droit_requis`, la
// pastille d'erreur s'allumerait, et une phrase d'action s'afficherait pour une
// opération que l'application n'avait pas à demander.
//
// On l'éprouve ici sans doublure de `auth` : la façade de persistance est
// réglée sur un service externe (`store.db`), et `fetch` est doublé pour
// ENREGISTRER les écritures. C'est la seule façon de compter les tentatives.
// ---------------------------------------------------------------------------
test("O-4 : un compte ordinaire ne tente aucune écriture réservée à l'administrateur", async (t) => {
  const store = await charger("../src/lib/store.js");
  if (!store || !store.db) return t.skip("module indisponible hors navigateur");
  const db = store.db;

  const ecritures = [];
  const vraiFetch = globalThis.fetch;
  globalThis.__SCRIBA_SELF_HOSTED__ = true;
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const methode = (opts && opts.method) || "GET";
    const repondre = (status, corps) => ({ ok: status < 400, status, json: async () => corps });
    if (methode === "POST" && u.includes("/sync")) {
      ecritures.push((u.match(/collections\/([A-Za-z]+)\/sync/) || [])[1] || u);
      return repondre(200, { revision: 1, applied: [], conflicts: [] });
    }
    if (u.includes("/v1/db/health")) return repondre(200, { message: "Base joignable." });
    if (u.includes("/v1/db/collections/")) return repondre(200, { collection: "x", revision: 0, records: [] });
    return repondre(404, { erreur: "route inconnue", code: "route_inconnue" });
  };
  try {
    await db.init();
    await db.setSettings({ mode: "external", url: "", token: "" }, { silent: true });

    // Le compte n'est pas administrateur : le référentiel se lit (les lectures
    // ne sont pas réservées), mais rien de réservé ne s'écrit.
    ecritures.length = 0;
    await store.bootstrap({ administrateur: false });
    assert.equal(ecritures.includes("config"), false, "aucune écriture de `config`");
    assert.equal(ecritures.includes("users"), false, "aucune écriture de `users`");

    // Témoin : avec le rôle, l'application écrit bel et bien — c'est donc bien
    // le drapeau, et non un hasard, qui a retenu les écritures ci-dessus.
    ecritures.length = 0;
    await store.bootstrap({ administrateur: true });
    assert.ok(ecritures.includes("config") || ecritures.includes("users"),
      "un administrateur, lui, écrit le référentiel et les comptes");
  } finally {
    globalThis.fetch = vraiFetch;
  }
});
