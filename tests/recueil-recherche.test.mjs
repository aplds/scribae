// ============================================================================
// LA RECHERCHE DU RECUEIL PREND TOUTE LA LARGEUR — `node --test`.
//
// POURQUOI CE FICHIER EXISTE. L'entrée du recueil public est le premier geste
// du visiteur : une barre bridée à 640 px, collée à gauche sous un titre
// pleine largeur, faisait une entrée étriquée. La règle est unique et vit dans
// `css/app-recueil.css` : `.recueil-hero .recueil-recherche` ne porte AUCUN
// plafond de largeur — la barre suit le conteneur, du mobile au grand écran.
// L'épreuve lit la feuille comme un texte et tient ce que la règle PROMET :
// aucun `max-width` en longueur, aucune `width` figée. Ses dents : reposer
// `max-width: 640px` fait échouer le test.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const RACINE_TEST = (() => {
  try { return fileURLToPath(new URL("..", import.meta.url)); }
  catch (e) { return null; }
})();

async function lire(chemin) {
  if (!RACINE_TEST) return null;
  for (const prefixe of ["src/", ""]) {
    try { return await readFile(fileURLToPath(new URL(prefixe + chemin, new URL("..", import.meta.url))), "utf8"); }
    catch (e) { /* préfixe suivant */ }
  }
  return null;
}

function blocRegle(css, selecteur) {
  const i = css.indexOf(selecteur);
  assert.ok(i >= 0, `la règle « ${selecteur} » doit exister dans la feuille`);
  const debut = css.indexOf("{", i);
  const fin = css.indexOf("}", debut);
  assert.ok(debut > 0 && fin > debut, `la règle « ${selecteur} » doit être un bloc lisible`);
  return css.slice(debut + 1, fin);
}

test("la recherche de l'entrée du recueil n'est bridée par aucune largeur", async (t) => {
  const css = await lire("css/app-recueil.css");
  if (!css) return t.skip("feuille illisible hors dépôt");
  const bloc = blocRegle(css, ".recueil-hero .recueil-recherche");
  const plafond = bloc.match(/max-width\s*:\s*([^;]+)/);
  assert.ok(!plafond || plafond[1].trim() === "none", "aucun plafond de largeur sur la recherche de l'entrée");
  assert.doesNotMatch(bloc, /(?<!max-)width\s*:\s*\d/, "aucune largeur figée sur la recherche de l'entrée");
});
