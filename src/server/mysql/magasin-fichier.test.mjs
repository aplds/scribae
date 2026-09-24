// ============================================================================
// Tests du magasin FICHIER — le rangement du service sans MariaDB.
//
//   node --test          (ou: npm test)
//
// Le module reçoit ses primitives de disque (lire, écrire, renommer,
// supprimer, lister, créer un dossier) : on lui en injecte un EN MÉMOIRE, et
// rien n'est écrit sur le disque de la machine qui exécute les épreuves. Ce que
// l'on éprouve ici, c'est le comportement que l'application attend d'un
// rangement : révisions, conflits, ordre de lecture, état, journal, comptes,
// sessions. Le magasin MySQL rend les mêmes réponses — c'est le contrat de
// magasin.mjs, et c'est ce qui rend ce fichier utile pour les deux.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { creerMagasinFichier } from "./magasin-fichier.mjs";

// Un « disque » en mémoire : une table de fichiers, et l'ensemble des dossiers
// créés. `renommer` refuse une source absente, comme le vrai disque.
function memoire() {
  const fichiers = new Map();
  const dossiers = new Set();
  return {
    fichiers,
    async lireTexte(p) { return fichiers.has(p) ? fichiers.get(p) : null; },
    async ecrireTexte(p, t) { fichiers.set(p, t); },
    async renommer(a, b) {
      if (!fichiers.has(a)) throw new Error("renommage d'un fichier absent : " + a);
      fichiers.set(b, fichiers.get(a));
      fichiers.delete(a);
    },
    async supprimer(p) { fichiers.delete(p); },
    async lister(p) {
      const prefixe = p ? p + "/" : "";
      const noms = new Set();
      for (const cle of fichiers.keys()) {
        if (!cle.startsWith(prefixe)) continue;
        const reste = cle.slice(prefixe.length).split("/")[0];
        if (reste) noms.add(reste);
      }
      return [...noms];
    },
    async creerDossier(p) { dossiers.add(p); },
  };
}

const banc = () => {
  const io = memoire();
  const journal = [];
  const magasin = creerMagasinFichier({ dossier: "./data", io, journal: (n, m) => journal.push([n, m]) });
  return { io, magasin, journal, lignes: () => (io.fichiers.get("journal.jsonl") || "").split("\n").filter(Boolean).map((l) => JSON.parse(l)) };
};

const rec = (id, payload, rev = 0, ord = 0) => ({ id, rev, ord, payload });

test("un enregistrement neuf s'écrit, et la collection avance d'une révision", async () => {
  const b = banc();
  const r = await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "Arrêté" })] });
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual(r.applied, [{ id: "t1", rev: 1 }]);
  assert.equal(r.revision, 1);
  assert.equal(await b.magasin.lireRevisionCollection("trames"), 1);
  const lus = await b.magasin.lireCollection("trames");
  assert.equal(lus.length, 1);
  assert.deepEqual(lus[0].payload, { nom: "Arrêté" });
  assert.equal(lus[0].rev, 1);
});

test("un enregistrement annoncé à une révision non nulle alors qu'il n'existe pas est un CONFLIT", async () => {
  const b = banc();
  const r = await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "x" }, 3)] });
  assert.deepEqual(r.applied, []);
  assert.deepEqual(r.conflicts, [{ id: "t1", deleted: true, rev: 0 }]);
  assert.equal(await b.magasin.lireRevisionCollection("trames"), 0, "rien appliqué, rien avancé");
});

test("une révision périmée est un CONFLIT qui rend la version du service", async () => {
  const b = banc();
  await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "v1" })] });
  await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "v2" }, 1)] });
  const r = await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "v3" }, 1)] });
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].id, "t1");
  assert.equal(r.conflicts[0].rev, 2);
  assert.deepEqual(r.conflicts[0].payload, { nom: "v2" }, "le conflit porte la version GAGNANTE");
  assert.deepEqual((await b.magasin.lireCollection("trames"))[0].payload, { nom: "v2" });
});

test("`force` écrase sans contrôle de révision, et le journal le dit", async () => {
  const b = banc();
  await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "v1" })] });
  const r = await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "reprise" }, 1)], force: true, actor: "admin" });
  assert.deepEqual(r.conflicts, []);
  assert.deepEqual((await b.magasin.lireCollection("trames"))[0].payload, { nom: "reprise" });
  assert.equal(b.lignes().at(-1).action, "force");
  assert.equal(b.lignes().at(-1).actor, "admin");
});

test("supprimer : un identifiant absent ne fait rien, un présent avance la révision", async () => {
  const b = banc();
  const vide = await b.magasin.synchroniser({ collection: "trames", deletes: [{ id: "inconnu", rev: 0 }] });
  assert.deepEqual(vide.applied, []);
  assert.equal(vide.revision, 0);
  await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "x" })] });
  const r = await b.magasin.synchroniser({ collection: "trames", deletes: [{ id: "t1", rev: 1 }] });
  assert.deepEqual(r.applied, [{ id: "t1", rev: 0, deleted: true }]);
  assert.equal(await b.magasin.lireRevisionCollection("trames"), 2);
  assert.deepEqual(await b.magasin.lireCollection("trames"), []);
});

test("la lecture rend les enregistrements triés par (ord, id)", async () => {
  const b = banc();
  await b.magasin.synchroniser({
    collection: "actes",
    upserts: [rec("b", { n: "b" }, 0, 5), rec("a", { n: "a" }, 0, 5), rec("c", { n: "c" }, 0, 1)],
  });
  const ids = (await b.magasin.lireCollection("actes")).map((r) => r.id);
  assert.deepEqual(ids, ["c", "a", "b"]);
});

test("les collections-flux ne remplissent pas le journal technique", async () => {
  const b = banc();
  await b.magasin.synchroniser({ collection: "presence", upserts: [rec("p1", { poste: "ici" })], trace: false });
  assert.equal(b.lignes().length, 0);
  await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", { nom: "x" })], trace: true });
  assert.equal(b.lignes().length, 1);
  assert.equal(b.lignes()[0].collection, "trames");
});

test("l'état se relit tel qu'écrit, et un fichier corrompu est signalé DÉGRADÉ", async () => {
  const b = banc();
  const vierge = await b.magasin.lireEtat();
  assert.equal(vierge.degrade, false);
  assert.deepEqual(vierge.etat.actes, {}, "une installation neuve n'est PAS dégradée");
  await b.magasin.ecrireEtat(JSON.stringify({ actes: { A1: { statut: "signee" } } }));
  const relu = await b.magasin.lireEtat();
  assert.equal(relu.degrade, false);
  assert.equal(relu.etat.actes.A1.statut, "signee");
  b.io.fichiers.set("etat.json", "{ceci n'est pas du JSON");
  const casse = await b.magasin.lireEtat();
  assert.equal(casse.degrade, true);
  assert.deepEqual(casse.etat.actes, {});
});

test("le document du référentiel se lit là où l'administration l'écrit", async () => {
  const b = banc();
  assert.equal(await b.magasin.lireConfig(), null);
  await b.magasin.synchroniser({ collection: "config", upserts: [rec("self", { brand: { name: "Ville d'Exemple" } })] });
  assert.deepEqual(await b.magasin.lireConfig(), { brand: { name: "Ville d'Exemple" } });
});

test("les comptes traversent le magasin : écriture, recherche par identifiant, jeu de démonstration", async () => {
  const b = banc();
  const compte = { id: "u-admin", login: "Admin", role: "administrateur", source: "local", entityId: "e1" };
  await b.magasin.store.ecrireCompte(compte);
  assert.deepEqual(await b.magasin.store.lireCompte("u-admin"), compte);
  assert.equal((await b.magasin.store.lireCompteParLogin("admin")).id, "u-admin", "la recherche ignore la casse");
  await b.magasin.store.ecrireCompte({ id: "u-demo", login: "madeleine", role: "redacteur", source: "demo" });
  assert.deepEqual((await b.magasin.store.listerComptesDemo()).map((c) => c.id), ["u-demo"]);
  // Les comptes vivent dans la MÊME collection que celle que lit l'administration.
  assert.equal((await b.magasin.lireCollection("users")).length, 2);
});

test("mots de passe et sessions : écrire, relire, compter les échecs, purger", async () => {
  const b = banc();
  await b.magasin.store.ecrireCompte({ id: "u1", login: "jean" });
  await b.magasin.store.ecrireMdp("u1", { hash: "scrypt:abc", mustChange: true });
  const mdp = await b.magasin.store.lireMdp("u1");
  assert.equal(mdp.hash, "scrypt:abc");
  assert.equal(mdp.must_change, 1, "la forme est celle du magasin SQL (snake_case)");
  assert.equal(mdp.echecs, 0);
  await b.magasin.store.majEchecs("u1", { echecs: 3, bloqueJusqua: "2026-10-01T00:00:00.000Z" });
  assert.equal((await b.magasin.store.lireMdp("u1")).echecs, 3);
  assert.equal((await b.magasin.store.listerMdp())[0].mustChange, true, "la liste rend la forme camelCase de l'administration");

  await b.magasin.store.creerSession({ tokenHash: "h1", userId: "u1", at: "2026-09-20T10:00:00.000Z", expiresAt: "2026-10-20T10:00:00.000Z", ip: "10.0.0.1", userAgent: "test" });
  const s = await b.magasin.store.lireSession("h1");
  assert.equal(s.user_id, "u1");
  assert.equal(s.expires_at, "2026-10-20T10:00:00.000Z");
  await b.magasin.store.toucherSession("h1", "2026-09-21T10:00:00.000Z");
  assert.equal((await b.magasin.store.lireSession("h1")).last_seen_at, "2026-09-21T10:00:00.000Z");
  await b.magasin.store.creerSession({ tokenHash: "h2", userId: "u1", at: "2026-09-20T10:00:00.000Z", expiresAt: "2026-09-25T10:00:00.000Z" });
  await b.magasin.store.purgerSessions("2026-10-01T00:00:00.000Z");
  assert.equal(await b.magasin.store.lireSession("h2"), null, "la session échue est purgée");
  assert.ok(await b.magasin.store.lireSession("h1"), "la session vivante reste");
  await b.magasin.store.supprimerMdp("u1");
  assert.equal(await b.magasin.store.lireMdp("u1"), null);
  assert.equal(await b.magasin.store.lireSession("h1"), null, "supprimer un compte retire aussi ses sessions");
});

test("santé : le dossier est créé au besoin, et les collections sont comptées", async () => {
  const b = banc();
  await b.magasin.synchroniser({ collection: "trames", upserts: [rec("t1", {}), rec("t2", {})] });
  const s = await b.magasin.sante();
  assert.equal(s.moteur, "fichiers JSON");
  assert.deepEqual(s.collections.trames, { records: 2, revision: 2 });
  assert.ok(b.io.fichiers.has("collections/trames.json"));
  assert.equal(b.magasin.resume.partagee, false, "le rangement par fichiers n'est PAS partagé");
});

test("preparer() crée le dossier, une fois, et le dit", async () => {
  const b = banc();
  const premier = await b.magasin.preparer((n, m) => b.journal.push([n, m]));
  assert.deepEqual(premier.appliquees, ["dossier de données"]);
  assert.ok(b.io.fichiers.has("STOCKAGE.json"));
  assert.match(b.io.fichiers.get("STOCKAGE.json"), /"format": 1/);
  assert.match(b.io.fichiers.get("LISEZ-MOI.txt"), /SAUVEGARDE/);
  const second = await b.magasin.preparer((n, m) => b.journal.push([n, m]));
  assert.deepEqual(second.appliquees, [], "le second passage ne refait rien");
  assert.equal(b.journal.filter(([n, m]) => /créé/.test(m)).length, 1);
});

test("deux écritures concurrentes ne se perdent pas (la file sérialise)", async () => {
  const b = banc();
  await Promise.all(Array.from({ length: 20 }, (_, i) => b.magasin.synchroniser({ collection: "trames", upserts: [rec("t" + i, { i })] })));
  const lus = await b.magasin.lireCollection("trames");
  assert.equal(lus.length, 20);
  assert.equal(await b.magasin.lireRevisionCollection("trames"), 20, "chaque écriture a sa révision");
});
