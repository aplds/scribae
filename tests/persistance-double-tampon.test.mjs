// ============================================================================
// L'ÉTAT DURABLE DU SERVICE DE DÉMONSTRATION, ÉCRIT EN DOUBLE TAMPON.
//
//   node --test          (ou: npm test)
//
// POURQUOI CE FICHIER EXISTE. Le service de démonstration range toute sa
// mémoire durable dans UN tableau d'octets (`state`), et la couche de
// persistance de l'environnement en prélève un INSTANTANÉ à tout moment — y
// compris au milieu d'une écriture. Avec une seule copie du document, un
// instantané pris là portait la longueur neuve et un mélange d'anciens et de
// nouveaux caractères : un document illisible, que `loadDb` refusait, et
// l'état était AINSI PERDU (c'est l'« état qui ne survit pas toujours » de
// l'aperçu, NC-II-012). L'état est donc écrit en DOUBLE TAMPON : deux copies à
// des places fixes, un index actif, et l'écriture ne touche QUE la copie
// inactive avant de basculer l'index d'un seul mot.
//
// CE QUI EST VÉRIFIÉ ICI, c'est la propriété qui rend la panne impossible —
// jamais la liste des fichiers touchés : un instantané pris à n'importe quel
// moment d'une écriture rend, à la relecture, SOIT la version précédente, SOIT
// la nouvelle, et jamais un document abîmé. Les épreuves SIMULENT l'instantané
// (elles recopient ce que l'écriture a laissé dans la copie visée) au lieu de
// l'attendre : c'est observable, et rejouable.
//
// Elles lisent `index.html` LUI-MÊME et exécutent son script serveur — le même
// que `tests/conformite-service.test.mjs` — pour ne pas réécrire une seconde
// fois la règle d'écriture. Là où le fichier n'est pas lisible (aucun harnais ne
// le fournit), les épreuves sont SAUTÉES plutôt que fausses.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const SKIP = "index.html illisible ici";

async function lireFichier(noms) {
  for (const nom of noms) {
    try { return await readFile(nom, "utf8"); } catch (e) { /* essai suivant */ }
  }
  return null;
}

// L'adresse d'`index.html` : deux crans au-dessus de `tests/`, dans les deux
// dispositions. On essaie d'abord l'adresse ancrée au fichier, puis des chemins
// relatifs — un module sans adresse hiérarchique (harnais de navigateur) ne doit
// pas faire échouer l'épreuve, seulement la faire changer de chemin.
async function lireIndex() {
  const noms = [];
  try {
    const { fileURLToPath } = await import("node:url");
    const base = import.meta.url;
    for (const rel of ["../../index.html", "../index.html"]) {
      try { noms.push(fileURLToPath(new URL(rel, base))); } catch (e) { /* adresse non hiérarchique */ }
    }
  } catch (e) { /* node:url indisponible */ }
  noms.push("index.html", "../../index.html", "../index.html");
  return lireFichier(noms);
}

async function lireHost() {
  const noms = ["src/pages/host.js", "pages/host.js"];
  try {
    const { fileURLToPath } = await import("node:url");
    const base = import.meta.url;
    for (const rel of ["../pages/host.js", "../../src/pages/host.js"]) {
      try { noms.push(fileURLToPath(new URL(rel, base))); } catch (e) { /* rien */ }
    }
  } catch (e) { /* node:url indisponible */ }
  return lireFichier(noms);
}

const scriptServeur = (html) => {
  const m = String(html || "").match(/<script[^>]*type="text\/x-server-plugin"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("le script du service de démonstration est introuvable dans index.html");
  return m[1];
};

// DEUX TAILLES. Celle que `src/pages/host.js` alloue lui-même (pour l'épreuve
// qui vérifie que les deux déclarations s'accordent) et une plus petite, pour
// les épreuves de MÉCANIQUE : la règle d'écriture ne dépend pas de la taille du
// tampon, et recopier 32 Mio n'apprendrait rien de plus.
const CAPACITE_HOST = 4 + 2 * (8000000 + 2);
const CAPACITE_TEST = 4 + 2 * (200000 + 2);

// Un service monté sur un tampon donné (neuf par défaut), rendu avec ses
// fonctions de stockage : c'est le VRAI `saveDb`/`loadDb` du service.
function monter(source, octets = new Uint8Array(CAPACITE_TEST * 2)) {
  const fabrique = new Function("state", "self",
    source + "\n;return { loadDb, saveDb, dbVide, U16, SLOT, MAX_COPIE, STATE_VERSION };");
  const b = fabrique(octets, {});
  return { ...b, octets };
}

// L'index de la copie active, lu dans un tampon donné (comme le ferait `loadDb`).
const copieActive = (octets) => (new Uint16Array(octets.buffer, octets.byteOffset, 4)[3] === 1 ? 1 : 0);

// La copie `i` commence à `HEADER + i * SLOT` unités. En OCTETS : × 2.
const debutCopieOctets = (b, i) => (4 + i * b.SLOT) * 2;
const tailleCopie = (b) => b.SLOT * 2;

let memoIndex = null;
const index = async () => {
  if (memoIndex === null) memoIndex = (await lireIndex()) || "";
  return memoIndex;
};

let memoSource = null;
const source = async () => {
  if (memoSource === null) memoSource = scriptServeur(await index());
  return memoSource;
};

// ----------------------------------------------------------------------------
test("les deux déclarations de format restent d'accord (index.html et l'hôte)", async (ctx) => {
  const html = await index();
  if (!html) return ctx.skip(SKIP);
  const host = await lireHost();
  if (!host) return ctx.skip("src/pages/host.js illisible ici");

  const versionHtml = Number((/const STATE_VERSION = (\d+)/.exec(html) || [])[1]);
  const versionHost = Number((/var VERSION_ETAT = (\d+)/.exec(host) || [])[1]);
  assert.ok(versionHtml >= 3, "index.html doit annoncer la version 3 (double tampon), vu : " + versionHtml);
  assert.equal(versionHost, versionHtml,
    "l'hôte qui enregistre l'état (src/pages/host.js) doit lire la MÊME version que le service l'écrit");

  // La taille du tampon est déclarée dans host.js et doit suffire aux DEUX copies
  // (le service en déduit la taille d'une copie — `SLOT`).
  const expr = (/var STATE_UNITS = ([^;]+);/.exec(host) || [])[1];
  assert.ok(expr, "host.js doit déclarer STATE_UNITS");
  const unites = new Function("return (" + expr + ")")();
  assert.equal(unites, CAPACITE_HOST,
    "host.js doit allouer de quoi tenir DEUX copies du plafond annoncé (8 000 000 caractères chacune)");
  const b = monter(await source(), new Uint8Array(unites * 2));
  assert.equal(b.MAX_COPIE, 8000000,
    "l'état doit pouvoir porter 8 000 000 caractères PAR COPIE (vu : " + b.MAX_COPIE + ")");
});

test("un aller-retour rend le document, et les deux copies alternent", async (ctx) => {
  const html = await index();
  if (!html) return ctx.skip(SKIP);
  const b = monter(await source());

  const a = b.dbVide();
  a.seq = 7;
  a.pieces = { p1: { nom: "Règlement « Été » — accès à la restauration" } };
  assert.equal(b.saveDb(a), true);
  assert.deepEqual(b.loadDb(), a, "le document enregistré se relit à l'identique (accents compris)");
  assert.ok(b.U16[1] + b.U16[2] * 65536 < b.SLOT,
    "après chaque écriture, la copie active est en BAS : la région à recopier reste celle d'un petit document, jamais la moitié du tampon (`etatUtilise`)");

  const c = b.dbVide();
  c.seq = 8;
  c.pieces = { p2: { nom: "Avenant n° 2" } };
  assert.equal(b.saveDb(c), true);
  assert.deepEqual(b.loadDb(), c);
  assert.ok(b.U16[1] + b.U16[2] * 65536 < b.SLOT,
    "et elle y reste après l'écriture suivante");
});

test("un instantané pris au MILIEU d'une écriture ne perd jamais l'état", async (ctx) => {
  const html = await index();
  if (!html) return ctx.skip(SKIP);
  const src = await source();
  const b = monter(src);

  const a = b.dbVide(); a.seq = 1; a.pieces = { p1: { nom: "Avant" } };
  b.saveDb(a);
  const imageAvant = b.octets.slice();

  const c = b.dbVide(); c.seq = 2; c.pieces = { p2: { nom: "Après" } };
  b.saveDb(c);
  const imageApres = b.octets.slice();

  const cible = copieActive(imageAvant) ? 0 : 1;

  // 1) Instantané pris PENDANT l'écriture de la copie visée : l'index braque
  //    encore l'ancienne copie, restée intacte. On recopie dans l'image d'avant
  //    le DÉBUT de ce que l'écriture dépose (la boucle écrit du début vers la
  //    fin : un instantané précoce voit la longueur neuve et un contenu ancien —
  //    c'est exactement ce qui corrompait une copie unique).
  const debCible = debutCopieOctets(b, cible);
  const demi = imageAvant.slice();
  demi.set(imageApres.subarray(debCible, debCible + 64 * 2), debCible);
  assert.deepEqual(monter(src, demi).loadDb(), a,
    "un instantané du milieu rend la version PRÉCÉDENTE — jamais un document abîmé, jamais du vide");

  // 2) Instantané pris APRÈS la bascule, PENDANT la descente en bas : l'index
  //    braque la copie neuve, complète (l'autre peut être à demi recopiée).
  const apresBascule = imageAvant.slice();
  apresBascule.set(imageApres.subarray(debCible, debCible + tailleCopie(b)), debCible);
  new Uint16Array(apresBascule.buffer, apresBascule.byteOffset, 4)[3] = cible;
  assert.deepEqual(monter(src, apresBascule).loadDb(), c,
    "un instantané pris après la bascule rend la version NEUVE — l'index ne désigne jamais qu'une copie entière");

  // 3) L'image finale, telle quelle.
  assert.deepEqual(monter(src, imageApres).loadDb(), c);
});

test("une copie abîmée est REFUSÉE, jamais relue de travers", async (ctx) => {
  const html = await index();
  if (!html) return ctx.skip(SKIP);
  const src = await source();
  const b = monter(src);

  const a = b.dbVide(); a.seq = 3; a.pieces = { p1: { nom: "Complet" } };
  b.saveDb(a);
  const octets = b.octets.slice();

  // La longueur de la copie ACTIVE dépasse ce qui est écrit : `loadDb` doit
  // REFUSER le document, pas en interpréter un morceau.
  const u16 = new Uint16Array(octets.buffer, octets.byteOffset, octets.length / 2);
  const d = 4 + (u16[3] ? b.SLOT : 0);
  u16[d] = u16[d] + 100;
  assert.equal(monter(src, octets).loadDb().seq, 0, "un document amputé est refusé, jamais interprété");
});

test("un état à l'ancien format est recommencé, jamais relu de travers", async (ctx) => {
  const html = await index();
  if (!html) return ctx.skip(SKIP);
  const b = monter(await source());
  const octets = b.octets;

  // Un état « version 2 » : en-tête de 4 unités, puis le JSON à HEADER. On
  // l'écrit à la main — c'est ce qu'un navigateur ayant tourné sur la version
  // précédente porte encore.
  const u16 = new Uint16Array(octets.buffer, octets.byteOffset, octets.length / 2);
  const doc = "{\"v\":2,\"seq\":41}";
  u16[1] = doc.length % 65536;
  u16[2] = (doc.length - u16[1]) / 65536;
  for (let i = 0; i < doc.length; i++) u16[4 + i] = doc.charCodeAt(i);
  u16[0] = 2;

  const relu = monter(await source(), octets).loadDb();
  assert.equal(relu.seq, 0, "un format inconnu est recommencé, jamais interprété");
});

test("un document trop grand pour une copie est refusé, et l'état précédent reste", async (ctx) => {
  const html = await index();
  if (!html) return ctx.skip(SKIP);
  const b = monter(await source());

  const a = b.dbVide(); a.seq = 5; a.pieces = { p1: { nom: "Gardé" } };
  assert.equal(b.saveDb(a), true);
  const avant = b.octets.slice();

  const gros = b.dbVide();
  gros.seq = 6;
  gros.pieces = { p: { nom: "x".repeat(b.MAX_COPIE + 1) } };
  assert.equal(b.saveDb(gros), false, "un document plus grand qu'une copie doit être refusé");
  assert.deepEqual(b.octets, avant, "un refus n'écrit rien");
  assert.deepEqual(b.loadDb(), a, "et l'état précédent reste lisible");
});
