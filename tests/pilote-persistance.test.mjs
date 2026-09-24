// ============================================================================
// Persistance partagée : le pilote suit le mode annoncé par le service.
//
// Le pilote de persistance est bâti au démarrage, sur le régime que la PAGE
// annonce (le `.env` du déploiement, recopié dans `config.js`) ; le service, lui,
// ne dit le sien qu'ensuite (`GET /v1/auth/config`). Quand les deux diffèrent —
// un `.env` muet sur `AUTH_MODE`, par exemple —, l'application se présentait avec
// un jeton et SANS l'anti-CSRF : le service, en mode « mot de passe », servait
// les LECTURES (la session est dans le cookie) mais refusait chaque ÉCRITURE
// (`csrf_invalide`). La pastille d'état passait au rouge, et rien ne
// s'enregistrait sur la base — voir `CHANGELOG.md`, note intermédiaire 1.3.2g.
//
//   node --test tests/
//
// L'environnement est posé AVANT l'import de la façade : c'est à son chargement
// que le mode par défaut est lu (`__SCRIBA_SELF_HOSTED__` → « serveur
// externe »). Le module est chargé DYNAMIQUEMENT : s'il exigeait un navigateur,
// les épreuves seraient sautées au lieu de faire tomber la suite.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

globalThis.__SCRIBA_SELF_HOSTED__ = true;
globalThis.__SCRIBA_API_BASE__ = "";
globalThis.__SCRIBA_API_TOKEN__ = "0".repeat(64);
globalThis.document = globalThis.document || { cookie: "" };

// Ce que la BASE répond aux écritures. `null` = elle les accepte. C'est ce
// qu'on fait varier pour éprouver la file d'attente et le test de connexion.
let panneEcriture = null;

// Un refus qui ne vise qu'UNE collection : c'est la forme du refus de rôle
// (`droit_requis`), qui ne dit rien des autres collections.
let panneCollection = {};

// Le service sait-il annoncer son mode (`GET /v1/auth/config`) ? Éteint par
// défaut : c'est l'état d'une page chargée pendant un redémarrage du service —
// le pilote est alors bâti sur ce que la PAGE annonçait, et rien ne le corrige.
let modeAnnoncable = false;

const collectionDe = (url) => (String(url).match(/collections\/([A-Za-z]+)/) || [])[1] || "";

// Un service de données qui se comporte comme celui de la collectivité en mode
// « mot de passe » : il SERT les lectures, et REFUSE une écriture qui ne porte
// pas l'anti-CSRF (double envoi cookie + en-tête, voir comptes.mjs).
globalThis.fetch = async (url, opts = {}) => {
  const methode = (opts && opts.method) || "GET";
  const entetes = (opts && opts.headers) || {};
  const repondre = (status, corps) => ({ ok: status < 400, status, json: async () => corps });
  if (methode === "GET" && String(url).includes("/v1/db/health")) {
    return repondre(200, { message: "Base joignable." });
  }
  // Le mode du service : c'est lui qui fait autorité sur le présage de la page.
  if (methode === "GET" && String(url).includes("/v1/auth/config")) {
    return modeAnnoncable
      ? repondre(200, { auth: "password", demo: false, demoJeu: false })
      : repondre(404, { erreur: "route inconnue" });
  }
  // Le service rend le jeton anti-CSRF avec la session : c'est ce qui permet à
  // une page qui ne peut pas lire le cookie (autre hôte) d'écrire quand même.
  if (methode === "GET" && String(url).includes("/v1/auth/session")) {
    return repondre(200, { utilisateur: { id: "u1", login: "mj" }, mustChange: false, csrf: "jeton-csrf" });
  }
  if (methode === "GET" && String(url).includes("/v1/db/collections/")) {
    return repondre(200, { collection: collectionDe(url), revision: 1, records: [] });
  }
  if (methode === "POST" && String(url).includes("/sync")) {
    const refus = panneCollection[collectionDe(url)];
    if (refus) return repondre(refus.status, { erreur: refus.erreur, code: refus.code || "refus" });
    if (panneEcriture) return repondre(panneEcriture.status, { erreur: panneEcriture.erreur, code: panneEcriture.code || "panne" });
    if (String(entetes["x-csrf-token"] || "") !== "jeton-csrf") {
      return repondre(403, { erreur: "Jeton anti-CSRF absent ou incorrect : rechargez la page, puis réessayez.", code: "csrf_invalide" });
    }
    return repondre(200, { revision: 2, applied: [], conflicts: [] });
  }
  return repondre(404, { erreur: "route inconnue" });
};

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

const presence = [{ id: "u1", userId: "u1", at: "2026-09-22T10:00:00.000Z" }];

test("sans mode annoncé, l'écriture part avec le jeton et le service la refuse", async (t) => {
  const db = await charger("../src/lib/db/index.js");
  if (!db) return t.skip("module indisponible hors navigateur");

  await db.init();
  assert.equal(db.status().state, "unknown", "le pilote vient d'être bâti : rien n'est encore éprouvé");

  assert.equal((await db.write("presence", presence)).ok, false, "l'écriture est refusée (anti-CSRF absent)");
  assert.equal(db.status().state, "error", "et l'état le dit — c'est la pastille rouge");

  // La lecture, elle, passe : c'est le « rouge, puis vert » que l'exploitant voit.
  await db.read("presence");
  assert.equal(db.status().state, "ok");
});

test("dès que le service annonce son mode, le pilote passe à la session et l'écriture aboutit", async (t) => {
  const db = await charger("../src/lib/db/index.js");
  const auth = await charger("../src/lib/auth.js");
  if (!db || !auth) return t.skip("module indisponible hors navigateur");

  // Ce que fait `chargerModeDeploiement` en lisant GET /v1/auth/config…
  auth.setDeploiementAuth({ mode: "password" });
  // …et la session ouverte entre-temps, avec son cookie anti-CSRF.
  globalThis.document.cookie = "scribae_csrf=jeton-csrf";

  assert.equal(await db.rafraichirPilote(), true, "le pilote est refait");
  assert.equal(db.status().state, "ok", "le service répond");
  assert.equal((await db.write("presence", presence)).ok, true, "l'écriture aboutit, anti-CSRF compris");
  assert.equal(db.status().state, "ok");
  assert.equal(await db.rafraichirPilote(), false, "sans changement de mode, rien à refaire");
});

test("les écritures en attente se rangent, disent pourquoi, et se renvoient", async (t) => {
  const db = await charger("../src/lib/db/index.js");
  if (!db) return t.skip("module indisponible hors navigateur");

  // La panne typique : le service répond aux LECTURES, mais la base refuse
  // chaque ÉCRITURE (MySQL indisponible, sauvegarde en cours, service qui
  // redémarre). L'application travaille alors sur son miroir local, et met les
  // écritures de côté — c'est le « 75 écritures en attente » de l'écran.
  panneEcriture = { status: 500, erreur: "Écriture impossible : connexion perdue" };
  assert.equal((await db.write("presence", [{ id: "u1", at: "t1" }])).deferred, true, "l'écriture est mise de côté, pas perdue");
  assert.equal((await db.write("presence", [{ id: "u1", at: "t2" }])).deferred, true);
  assert.equal((await db.write("journal", [{ id: "j1", action: "modification" }])).deferred, true);

  const info = db.pendingInfo();
  assert.equal(info.count, 2, "deux collections en attente — la plus récente d'une collection porte tout ce que la précédente demandait");
  assert.equal(info.collections.find((c) => c.name === "presence").count, 1, "un battement de cœur ne s'empile pas sur le précédent");
  assert.ok(info.depuis, "l'ouverture de la file est datée");
  assert.match(info.derniereErreur.message, /connexion perdue/, "le motif du refus est conservé, pour être montré");

  // Le renvoi échoue encore : il le DIT, au lieu de laisser la pastille mentir.
  const echec = await db.flushPending();
  assert.equal(echec.flushed, 0);
  assert.equal(echec.left, 2);
  assert.equal(db.status().state, "offline", "une panne de la base n'est pas un refus définitif");
  assert.match(db.status().detail, /connexion perdue/);

  // La base revient : le renvoi passe, et la file se referme.
  panneEcriture = null;
  const reussi = await db.flushPending();
  assert.equal(reussi.flushed, 2);
  assert.equal(db.pendingCount(), 0);
  assert.equal(db.pendingInfo().depuis, null, "une file refermée n'a plus d'âge");
  assert.equal(db.status().state, "ok");

  // Un lot FORCÉ (« Envoyer les données à la base ») n'est jamais effacé au
  // profit d'une écriture ordinaire : il impose l'état local, ce qu'un calcul de
  // différences ne sait pas exprimer.
  panneEcriture = { status: 500, erreur: "Écriture impossible : connexion perdue" };
  await db.write("presence", [{ id: "u1", at: "imposé" }], { force: true });
  await db.write("presence", [{ id: "u1", at: "ordinaire" }]);
  assert.equal(db.pendingInfo().count, 2, "le lot forcé et l'écriture ordinaire cohabitent");
  panneEcriture = null;
  await db.flushPending();
  assert.equal(db.pendingCount(), 0);
});

test("le test de connexion éprouve l'ÉCRITURE, et pas seulement la santé", async (t) => {
  const db = await charger("../src/lib/db/index.js");
  if (!db) return t.skip("module indisponible hors navigateur");

  // C'est exactement l'écran qui se contredisait : « Connexion réussie » à côté
  // d'une pastille rouge et de 75 écritures en attente. La route de santé ne
  // demande ni session ni anti-CSRF — elle répond donc 200 pendant que la base
  // refuse chaque geste (voir CHANGELOG, note 1.3.2k).
  panneEcriture = { status: 403, erreur: "Jeton anti-CSRF absent ou incorrect : rechargez la page, puis réessayez.", code: "csrf_invalide" };
  const res = await db.test({ mode: "external", url: "", token: "" });
  assert.equal(res.ok, true, "le service répond — c'est le « Connexion réussie » de l'écran");
  assert.equal(res.ecriture.ok, false, "et l'essai d'écriture dit, lui, que la base refuse");
  assert.equal(res.ecriture.status, 403);

  panneEcriture = null;
  const bon = await db.test({ mode: "external", url: "", token: "" });
  assert.equal(bon.ok, true);
  assert.equal(bon.ecriture.ok, true, "l'écriture est acceptée quand la base répond");
});

test("sans cookie lisible, le jeton rendu avec la session suffit à écrire", async (t) => {
  const db = await charger("../src/lib/db/index.js");
  const motdepasse = await charger("../src/lib/motdepasse.js");
  if (!db || !motdepasse) return t.skip("module indisponible hors navigateur");

  // L'application est servie par un hôte, le service par un autre : la page ne
  // voit AUCUN de ses cookies (c'est la règle du navigateur), alors que le
  // navigateur, lui, les envoie. La session vaut donc, mais l'en-tête anti-CSRF
  // partait vide — et chaque écriture était refusée (`csrf_invalide`) pendant que
  // les lectures passaient. Voir CHANGELOG, note 1.3.2m.
  globalThis.document.cookie = "";
  panneEcriture = null;
  assert.equal(motdepasse.jetonCsrfLisible(), false, "la page ne lit aucun cookie");

  const session = await motdepasse.sessionCourante();
  assert.equal(session.ok, true);
  assert.equal(motdepasse.jetonCsrf(), "jeton-csrf", "le jeton rendu avec la session est retenu");

  assert.equal((await db.write("presence", [{ id: "u1", at: "sans-cookie" }])).ok, true, "l'écriture aboutit sans cookie lisible");
  assert.equal(db.status().state, "ok");
});

test("un refus « csrf_invalide » est expliqué, et non seulement constaté", async (t) => {
  const db = await charger("../src/lib/db/index.js");
  if (!db) return t.skip("module indisponible hors navigateur");

  // `location` est en lecture seule dans un Worker : on pose une propriété à nous
  // (elle se supprime ensuite), pour que l'épreuve tourne partout.
  Object.defineProperty(globalThis, "location", { value: { host: "app.collectivite.fr" }, configurable: true, writable: true });
  const piste = db.expliquerRefus({ code: "csrf_invalide", base: "https://donnees.collectivite.fr" });
  assert.match(piste, /app\.collectivite\.fr/, "la piste nomme l'hôte de la page");
  assert.match(piste, /donnees\.collectivite\.fr/, "et celui du service");
  // Les autres refus ont eux aussi leur phrase : sans elle, « la base a refusé
  // le renvoi » laissait l'agent devant un code, et le seul conseil était de se
  // reconnecter — alors que le geste juste est de se reconnecter EN
  // ADMINISTRATEUR.
  const droit = db.expliquerRefus({ code: "droit_requis", collection: "users" });
  assert.match(droit, /Comptes/, "le refus de rôle nomme la collection visée");
  assert.match(droit, /administrateur/, "et le geste qui le répare");
  const session = db.expliquerRefus({ code: "session_absente" });
  assert.match(session, /cookie/, "le refus de session parle du cookie");
  assert.equal(db.expliquerRefus({ code: "route_inconnue" }), "", "un code sans cause connue n'a pas de piste");
  delete globalThis.location;
});

test("un pilote bâti sans le mode du service se répare au premier refus", async (t) => {
  const db = await charger("../src/lib/db/index.js");
  const auth = await charger("../src/lib/auth.js");
  if (!db || !auth) return t.skip("module indisponible hors navigateur");

  // La page s'est chargée pendant un redémarrage du service : elle n'a jamais
  // pu lire GET /v1/auth/config. Le pilote est donc bâti sur son seul présage —
  // ici, RIEN (le déploiement n'a rien annoncé) : pas de session, pas
  // d'anti-CSRF. Chaque écriture partait sans en-tête et était refusée, POUR
  // TOUJOURS : rien ne redemandait le mode, et seule une relecture de la page
  // réparait. La façade répare désormais elle-même.
  auth.setDeploiementAuth(null);
  globalThis.document.cookie = "";
  assert.equal(await db.rafraichirPilote(), true, "le pilote repasse au régime sans session");

  // Le service, lui, répond de nouveau — et il sait dire son mode.
  modeAnnoncable = true;
  const r = await db.write("presence", [{ id: "u1", at: "reparé" }]);
  assert.equal(r.ok, true, "l'écriture aboutit après réparation");
  assert.equal(db.status().state, "ok");
  const mode = auth.modeDeploiement();
  assert.equal(mode, "password", "le mode annoncé par le service a été repris");
});

test("une écriture définitivement refusée ne bloque plus les autres collections", async (t) => {
  const db = await charger("../src/lib/db/index.js");
  const auth = await charger("../src/lib/auth.js");
  if (!db || !auth) return t.skip("module indisponible hors navigateur");

  auth.setDeploiementAuth({ mode: "password" });
  globalThis.document.cookie = "scribae_csrf=jeton-csrf";
  await db.rafraichirPilote();

  // Deux collections mises de côté : « Comptes » (que seul un administrateur
  // écrit) et « Présence ». Elles datent d'une session d'administrateur, et
  // c'est maintenant un compte ordinaire qui tient le poste.
  panneEcriture = { status: 500, erreur: "Écriture impossible : connexion perdue" };
  await db.write("users", [{ id: "u-x", login: "x" }]);
  await db.write("presence", [{ id: "u1", at: "t1" }]);
  assert.equal(db.pendingInfo().count, 2);
  panneEcriture = null;
  panneCollection = { users: { status: 403, erreur: "Seul un administrateur écrit la collection « users ».", code: "droit_requis" } };

  // Le refus de « Comptes » n'arrête plus le renvoi : « Présence » passe.
  const r = await db.flushPending();
  assert.equal(r.flushed, 1, "la collection suivante est transmise malgré le refus");
  assert.equal(r.left, 1, "l'écriture refusée reste, elle, en attente");
  assert.equal(r.error.code, "droit_requis");
  assert.match(db.status().detail, /Comptes/, "le motif nomme la collection refusée");
  assert.match(db.status().detail, /administrateur/, "et dit le geste qui la répare");
  assert.match(db.status().detail, /1 autre/, "ce qui a été transmis malgré tout est dit aussi");

  // La cause levée (session d'administrateur), la dernière écriture part.
  panneCollection = {};
  const suite = await db.flushPending();
  assert.equal(suite.flushed, 1);
  assert.equal(db.pendingCount(), 0);
  assert.equal(db.status().state, "ok");
});
