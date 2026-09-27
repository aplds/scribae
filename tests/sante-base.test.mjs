// ============================================================================
// La route de santé de la base et l'écran de connexion.
//
//   node --test tests/
//
// POURQUOI CETTE ÉPREUVE. La route `GET /v1/db/health` décrit l'hôte, le port,
// le schéma et la VERSION du moteur de base : depuis l'audit ciblé du 22/09/2026
// (point O-1), elle est réservée à la SESSION quand la porte du service est un
// mot de passe — un anonyme n'énumère pas l'infrastructure. Mais c'est la route
// que l'application interroge AU DÉMARRAGE, avant qu'une session soit ouverte
// (`src/ui/app.js`, `rafraichirPilote`). Un `401` y vaut donc « session
// requise » — jamais « panne » : confondre les deux allumerait la pastille
// rouge sur l'écran de connexion, et l'agent croirait à une base en panne là
// où il lui reste seulement à se connecter.
//
// On éprouve ICI la seule règle qui compte pour l'écran : ce que le pilote LIT
// de la réponse. Aucun réseau, aucune base — `fetch` est doublé.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

// Ce que le service répond, appel après appel. Chaque épreuve empile sa réponse
// avant d'interroger le pilote : rien n'est partagé entre les épreuves.
const reponses = [];

globalThis.fetch = async () => {
  const r = reponses.shift() || { status: 200, body: {} };
  return { ok: r.status < 400, status: r.status, json: async () => r.body };
};

async function pilote() {
  const m = await import("../src/lib/db/service.js");
  return m.create({ transport: "http", baseUrl: "https://service.exemple.fr" });
}

test("un 401 sur la santé vaut « session requise », pas une panne", async () => {
  const p = await pilote();
  reponses.push({ status: 401, body: { erreur: "Session absente.", code: "session_absente" } });
  const r = await p.health();
  assert.equal(r.ok, false);
  assert.equal(r.sessionRequise, true, "l'écran de connexion doit lire « session requise »");
  assert.equal(r.status, 401);
  assert.equal(r.info, null, "aucune infrastructure n'est décrite à un anonyme");
});

test("le code `session_absente` suffit à dire « session requise », même sans 401", async () => {
  const p = await pilote();
  reponses.push({ status: 403, body: { erreur: "Session absente.", code: "session_absente" } });
  const r = await p.health();
  assert.equal(r.sessionRequise, true);
});

test("une vraie panne reste une panne (et n'est pas prise pour une session manquante)", async () => {
  const p = await pilote();
  reponses.push({ status: 503, body: { erreur: "La base de données n'est pas prête.", code: "base_indisponible" } });
  const r = await p.health();
  assert.equal(r.ok, false);
  assert.notEqual(r.sessionRequise, true);
  assert.equal(r.status, 503);
});

test("une base qui répond est disponible", async () => {
  const p = await pilote();
  reponses.push({ status: 200, body: { message: "Base joignable." } });
  const r = await p.health();
  assert.equal(r.ok, true);
  assert.equal(r.info.message, "Base joignable.");
});
