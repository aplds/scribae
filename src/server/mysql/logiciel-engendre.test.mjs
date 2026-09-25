// ============================================================================
// Tests du miroir d'identité du service (`logiciel-engendre.mjs`).
//
//   node --test          (ou: npm test)
//
// POURQUOI CES ÉPREUVES. Le miroir existe parce que l'image du service ne
// contient que le dossier `src/server/mysql/` : elle ne peut pas lire
// `src/lib/version.js`. Un miroir qu'on oublie de régénérer annoncerait donc,
// dans le journal du conteneur, une version qui n'est plus celle du logiciel —
// exactement le mensonge que la bannière de démarrage doit éviter. Ces épreuves
// comparent le miroir à ses deux sources de vérité, valeur par valeur ; la
// dernière vérifie en outre le TEXTE du fichier, pour qu'une main distraite ne
// puisse pas y écrire une valeur en dur sans être vue.
//
// Le marqueur « FICHIER ENGENDRÉ » fait partie du contrat : c'est lui qui
// prévient celui qui ouvre le fichier qu'il ne doit pas l'éditer.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import * as miroir from "./logiciel-engendre.mjs";
import { APP_VERSION, APP_RELEASED, versionLabel } from "../../lib/version.js";
import { APP_NAME, LICENCE, DOCUMENTATION } from "../../lib/logiciel.js";

test("le miroir reproduit la version et sa date", () => {
  assert.equal(miroir.APP_VERSION, APP_VERSION);
  assert.equal(miroir.VERSION_LABEL, versionLabel(APP_VERSION));
  assert.equal(miroir.APP_RELEASED, APP_RELEASED);
});

test("le miroir reproduit l'identité du logiciel", () => {
  assert.equal(miroir.APP_NAME, APP_NAME);
  assert.equal(miroir.LICENCE, LICENCE);
  assert.equal(miroir.DOCUMENTATION, DOCUMENTATION);
});

// La date de livraison se lit sur l'étiquette du miroir, pour qu'un journal
// affiche « v1.6.1t » et non un numéro nu : c'est la même convention que
// l'interface (`versionLabel`, src/lib/version.js).
test("l'étiquette de version porte le « v » de l'interface", () => {
  assert.equal(miroir.VERSION_LABEL, "v" + miroir.APP_VERSION);
});

test("le fichier engendré porte son avertissement, et les valeurs des sources", async (t) => {
  let readFile = null;
  try { ({ readFile } = await import("node:fs/promises")); } catch (e) { readFile = null; }
  if (typeof readFile !== "function") return t.skip("lecture de fichier indisponible hors dépôt");
  const lire = async (chemins) => {
    for (const c of chemins) { try { return await readFile(c, "utf8"); } catch (e) { /* essai suivant */ } }
    return null;
  };
  // Chemins relatifs au dépôt (le dossier courant de `node --test`), avec le
  // repli « racine = src/ » si l'outillage est déplacé un jour.
  const texte = await lire([
    "src/server/mysql/logiciel-engendre.mjs",
    "server/mysql/logiciel-engendre.mjs",
    "logiciel-engendre.mjs",
  ]);
  assert.ok(texte, "le miroir est introuvable");
  assert.match(texte, /FICHIER ENGENDRÉ/, "le miroir ne prévient pas qu'il est engendré");
  assert.match(texte, /scripts\/generer-logiciel\.mjs/, "le miroir ne dit pas quoi régénérer");
  const declarations = [
    ["APP_NAME", APP_NAME],
    ["APP_VERSION", APP_VERSION],
    ["VERSION_LABEL", versionLabel(APP_VERSION)],
    ["APP_RELEASED", APP_RELEASED],
    ["LICENCE", LICENCE],
    ["DOCUMENTATION", DOCUMENTATION],
  ];
  for (const [nom, valeur] of declarations) {
    const attendue = `export const ${nom} = ${JSON.stringify(valeur)};`;
    assert.ok(texte.includes(attendue), `le miroir ne déclare pas « ${attendue} »`);
  }
});
