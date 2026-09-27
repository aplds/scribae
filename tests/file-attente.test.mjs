// ============================================================================
// La file des écritures en attente — ce qui la fait attendre, et ce qui la
// débloque.
//
//   node --test tests/
//
// POURQUOI CETTE ÉPREUVE. Deux points de l'audit ciblé du 22/09/2026 se lisent
// tous les deux à l'écran « Administration › Base de données » :
//
//   • O-2 — le mode « Service de démonstration » suppose un socket qui n'existe
//     pas dans un déploiement auto-hébergé : l'entrée doit s'y déclarer
//     INDISPONIBLE (et un réglage qui la demanderait ne pas rester) ;
//   • O-3 — une écriture que la base a refusée POUR UNE RAISON QUI NE VIENT PAS
//     DU RÉSEAU (`droit_requis`, `jeton_invalide`…) ne doit plus être représentée
//     toutes les trente secondes : on garde son refus en mémoire, le renvoi
//     automatique la saute, et elle repart au prochain geste explicite — sans
//     que le refus soit oublié quand il est RÉPARABLE (`csrf_invalide`,
//     `session_absente`).
//
// CE FICHIER N'IMPORTE QU'UN SEUL MODULE (`src/lib/db/index.js`) : le service de
// données est doublé par `fetch`. C'est délibéré — une épreuve qui importe aussi
// `src/lib/auth.js` éprouve DEUX copies du module dans l'atelier (voir
// docs/ATELIER.md § 3.3), alors qu'ici le pilote se règle par son propre
// réglage (`setSettings`), sans dépendre de la découverte du mode.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

// L'environnement d'un déploiement auto-hébergé, posé AVANT l'import de la
// façade : c'est au chargement du module que `MODES` est bâti (O-2).
globalThis.__SCRIBA_SELF_HOSTED__ = true;
globalThis.__SCRIBA_API_BASE__ = "";
globalThis.__SCRIBA_API_TOKEN__ = "0".repeat(64);
globalThis.document = globalThis.document || { cookie: "" };

// Ce que la base répond. `sync` est ce qu'on fait varier : c'est lui qui porte
// les refus, réparables ou non.
let appelsSync = 0;
let reponseSync = { status: 200, body: { revision: 1, applied: [], conflicts: [] } };

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  const methode = (opts && opts.method) || "GET";
  const repondre = (status, corps) => ({ ok: status < 400, status, json: async () => corps });
  if (methode === "POST" && u.includes("/sync")) {
    appelsSync += 1;
    return repondre(reponseSync.status, reponseSync.body);
  }
  if (u.includes("/v1/db/health")) return repondre(200, { message: "Base joignable." });
  if (u.includes("/v1/db/collections/")) return repondre(200, { collection: "presence", revision: 0, records: [] });
  return repondre(404, { erreur: "route inconnue", code: "route_inconnue" });
};

async function facade() {
  const db = await import("../src/lib/db/index.js");
  // Un service externe sur la même origine, sans session : le pilote parle par
  // `fetch`, ce que ce fichier double. `silent` : aucune sonde au passage.
  await db.setSettings({ mode: "external", url: "", token: "" }, { silent: true });
  return db;
}

test("O-2 : le mode « service de démonstration » est indisponible en auto-hébergement", async () => {
  const db = await facade();

  const service = db.MODES.find((m) => m.id === "service");
  assert.equal(service.available, false, "l'entrée se déclare indisponible");
  assert.match(service.label, /indisponible/i, "le libellé le dit");
  assert.match(service.help, /850 Kio/, "et l'aide explique pourquoi, chiffres en main");
  assert.equal(db.modeDisponible("service"), false);
  assert.equal(db.modeDisponible("external"), true, "le mode du déploiement, lui, reste offert");
  assert.equal(db.modeDisponible("local"), true);

  const reglages = await db.setSettings({ mode: "service" }, { silent: true });
  assert.equal(reglages.mode, "external", "un mode indisponible ne se met pas en service");
  assert.equal(db.getSettings().mode, "external");
});

test("O-3 : une écriture refusée pour une raison durable cesse d'être redemandée", async () => {
  const db = await facade();

  // L'écriture est mise de côté : la base ne répond pas (5xx = panne, pas refus).
  reponseSync = { status: 500, body: { erreur: "Écriture impossible : connexion perdue", code: "panne" } };
  await db.write("presence", [{ id: "u1", at: "t1" }]);
  assert.equal(db.pendingInfo().count, 1, "l'écriture est gardée sur ce poste");

  // Elle est rejouée — et la base la REFUSE par nature : la session ouverte
  // n'est pas celle d'un administrateur.
  reponseSync = { status: 403, body: { erreur: "Seul un administrateur écrit cette collection.", code: "droit_requis" } };
  const premier = await db.flushPending();
  assert.equal(premier.flushed, 0);
  assert.equal(premier.left, 1, "rien n'est perdu");
  assert.equal(db.pendingInfo().refusees.length, 1, "l'écran peut dire laquelle est refusée");

  // La cause est levée côté base — mais le renvoi AUTOMATIQUE ne la redemande
  // plus : c'est O-3. Une requête vouée au refus toutes les trente secondes ne
  // servirait à rien.
  reponseSync = { status: 200, body: { revision: 2, applied: [], conflicts: [] } };
  const avant = appelsSync;
  const saute = await db.flushPending();
  assert.equal(appelsSync, avant, "aucune requête n'est envoyée");
  assert.equal(saute.flushed, 0);
  assert.equal(saute.left, 1, "l'écriture reste en file");
  assert.match(db.status().detail, /en attente d'un geste/, "et l'écran dit pourquoi elle attend");

  // Le GESTE explicite (« Renvoyer maintenant ») la rejoue : là, la cause a pu
  // changer.
  const suite = await db.flushPending({ force: true });
  assert.equal(suite.flushed, 1);
  assert.equal(db.pendingCount(), 0);
  assert.equal(db.pendingInfo().refusees.length, 0, "le refus est oublié dès que l'écriture est passée");
});

test("O-3 : un refus RÉPARABLE n'est jamais mis de côté", async () => {
  const db = await facade();

  reponseSync = { status: 500, body: { erreur: "Écriture impossible", code: "panne" } };
  await db.write("presence", [{ id: "u1", at: "t1" }]);
  assert.equal(db.pendingInfo().count, 1);

  // `csrf_invalide` est le refus que `reparerPilote` sait LEVER : le mémoriser
  // bloquerait la réparation qui le répare, et la file ne repartirait jamais.
  reponseSync = { status: 403, body: { erreur: "Jeton anti-CSRF absent ou incorrect.", code: "csrf_invalide" } };
  await db.flushPending();
  assert.equal(db.pendingInfo().refusees.length, 0, "rien n'est mémorisé");

  const avant = appelsSync;
  await db.flushPending();                       // renvoi automatique, sans `force`
  assert.ok(appelsSync > avant, "un refus réparable est bel et bien retenté");

  reponseSync = { status: 200, body: { revision: 2, applied: [], conflicts: [] } };
  const r = await db.flushPending();
  assert.equal(r.flushed, 1, "et il finit par passer");
  assert.equal(db.pendingCount(), 0);
});

test("O-3 : une nouvelle écriture rend sa chance à une collection refusée", async () => {
  const db = await facade();

  reponseSync = { status: 500, body: { erreur: "panne", code: "panne" } };
  await db.write("presence", [{ id: "u1", at: "t1" }]);
  reponseSync = { status: 403, body: { erreur: "refus", code: "droit_requis" } };
  await db.flushPending();
  assert.equal(db.pendingInfo().refusees.length, 1);

  // L'agent retouche sa donnée : c'est un geste, et le refus mémorisé tombe.
  reponseSync = { status: 500, body: { erreur: "panne", code: "panne" } };
  await db.write("presence", [{ id: "u1", at: "t2" }]);
  assert.equal(db.pendingInfo().refusees.length, 0, "le geste efface la mémoire du refus");

  reponseSync = { status: 200, body: { revision: 3, applied: [], conflicts: [] } };
  const r = await db.flushPending();
  assert.equal(r.flushed, 1, "et elle repart au renvoi automatique");
  assert.equal(db.pendingCount(), 0);
});

test("O-6 : le refus d'une collection de fond ne pilote pas la pastille d'état", async () => {
  const db = await facade();

  // Le battement de cœur écrit `presence` toutes les 25 secondes. Quand le
  // service refuse cette écriture, l'écran recevait un message d'erreur toutes
  // les 25 secondes — une pastille rouge CONTINUELLE pour un refus qui
  // n'empêche pas de travailler.
  reponseSync = { status: 403, body: { erreur: "Seul un administrateur écrit cette collection.", code: "droit_requis" } };
  const avant = db.status();
  const presence = await db.write("presence", [{ id: "u1", at: "t1" }]);
  assert.equal(presence.ok, false, "l'écriture est bien refusée");
  assert.equal(db.status().state, avant.state, "et l'état de la base n'a pas bougé");
  assert.equal(db.status().detail, avant.detail);

  // Témoin : une collection de TRAVAIL, elle, le dit — c'est bien la nature de
  // la collection, et non un silence général, qui décide.
  await db.write("trames", [{ id: "tpl-1", label: "Trame" }]);
  assert.equal(db.status().state, "error", "le refus d'une trame, lui, s'affiche");
  assert.match(db.status().detail, /refusée/);
});

test("O-6 : le battement de cœur s'espace en état d'erreur", async () => {
  const collab = await import("../src/lib/collab.js");

  assert.equal(collab.delaiPresence({}), collab.PRESENCE_MS, "sans erreur, le rythme ordinaire");
  assert.equal(collab.delaiPresence({ erreur: "" }), collab.PRESENCE_MS);
  assert.equal(collab.delaiPresence({ erreur: "droit_requis" }), collab.PRESENCE_REPLI_MS,
    "en état d'erreur, le repli");
  assert.ok(collab.PRESENCE_REPLI_MS >= 120000, "et le repli laisse vraiment respirer le service");
  assert.ok(collab.PRESENCE_REPLI_MS > collab.PRESENCE_MS);
  // Le repli (2 min) dépasse la durée au-delà de laquelle un poste est considéré
  // parti (70 s) : c'est assumé — un poste dont la présence est REFUSÉE n'est de
  // toute façon pas visible des autres, et rien ne sert de le redemander plus
  // souvent.
  assert.ok(collab.PRESENCE_REPLI_MS > collab.EN_LIGNE_MS);
});
