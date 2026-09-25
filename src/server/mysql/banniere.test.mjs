// ============================================================================
// Tests de la bannière de démarrage (`banniere.mjs`).
//
//   node --test          (ou: npm test)
//
// CE QUE CES ÉPREUVES DÉFENDENT. La bannière part dans le journal du conteneur :
// personne ne la relit avant de la publier, et un cadre ouvert, une séquence
// ANSI ou une ligne de travers ne se voient qu'au moment où l'on cherche
// justement à lire ce journal. Les épreuves tiennent donc quatre propriétés :
//
//   • le cadre est FERMÉ, et de largeur constante ;
//   • il tient dans un terminal étroit (75 colonnes, sous les 80 d'usage) ;
//   • il est écrit en caractères d'imprimante (ASCII pur, ni couleur ni
//     tabulation), sauf la ligne de mention, qui suit la ponctuation du
//     journal (« — », comme le reste des messages du service) ;
//   • il annonce la VERSION DU LOGICIEL, jamais une valeur écrite en dur : une
//     version passée en argument doit se voir.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { banniere } from "./banniere.mjs";
import { VERSION_LABEL, LICENCE, DOCUMENTATION } from "./logiciel-engendre.mjs";

const LARGEUR_MAX = 80;

test("la bannière est un cadre fermé, de largeur constante", () => {
  const lignes = banniere().split("\n");
  const largeur = lignes[0].length;
  for (const ligne of lignes) {
    assert.equal(ligne.length, largeur, `ligne de largeur inattendue : « ${ligne} »`);
  }
  const bord = "+" + "-".repeat(largeur - 2) + "+";
  assert.equal(lignes[0], bord);
  assert.equal(lignes[lignes.length - 1], bord);
  const creux = "|" + " ".repeat(largeur - 2) + "|";
  assert.equal(lignes[1], creux);
  assert.equal(lignes[lignes.length - 2], creux);
});

test("elle tient dans un terminal de 80 colonnes", () => {
  const largeur = banniere().split("\n")[0].length;
  assert.ok(largeur <= LARGEUR_MAX, `bannière trop large : ${largeur} colonnes`);
});

test("elle annonce la version, la licence et la documentation", () => {
  const b = banniere();
  assert.ok(b.includes(VERSION_LABEL), "la version du logiciel n'apparaît pas");
  assert.ok(b.includes(LICENCE), "la licence n'apparaît pas");
  assert.ok(b.includes("doc.scribae.eu"), "l'adresse de la documentation n'apparaît pas");
});

test("l'adresse est affichée sans son schéma", () => {
  const b = banniere();
  assert.equal(b.includes("https://"), false, "le schéma n'a pas sa place dans un journal");
  assert.ok(b.includes(DOCUMENTATION.replace(/^https?:\/\//, "")), "l'adresse courte est absente");
});

test("la marque et le titre sont dessinés", () => {
  const b = banniere();
  assert.ok(b.includes("/\\"), "le chevron de la marque a disparu");
  assert.ok(b.includes("|____/"), "le titre dessiné a disparu");
  assert.ok(b.includes("|_____________|"), "le document de la marque est incomplet");
});

test("elle n'emploie ni couleur ni tabulation", () => {
  const b = banniere();
  assert.equal(b.includes("\u001b"), false, "séquence ANSI dans le journal");
  assert.equal(b.includes("\t"), false, "tabulation : l'alignement dépendrait du terminal");
  assert.equal(/[\u0000-\u0008\u000b-\u001f\u007f]/.test(b), false, "caractère de contrôle");
});

test("hors la mention, tout est en caractères d'imprimante", () => {
  for (const ligne of banniere().split("\n")) {
    if (ligne.includes(VERSION_LABEL)) continue;
    assert.match(ligne, /^[\x20-\x7e]*$/, `ligne non ASCII : « ${ligne} »`);
  }
});

test("la version annoncée vient de l'appel, jamais du texte", () => {
  const autre = banniere({ version: "9.9.9" });
  assert.ok(autre.includes("9.9.9"), "la version passée n'est pas affichée");
  assert.equal(autre.includes(VERSION_LABEL), false, "la version du miroir s'est glissée dans la ligne");
  const bord = "+" + "-".repeat(autre.split("\n")[0].length - 2) + "+";
  assert.equal(autre.split("\n")[0], bord);
});

test("une mention plus longue élargit le cadre sans l'ouvrir", () => {
  const large = banniere({ documentation: "https://exemple.invalid/une/adresse/tres/longue/pour/la/documentation" });
  const lignes = large.split("\n");
  assert.ok(lignes[0].length > banniere().split("\n")[0].length, "le cadre n'a pas suivi la ligne");
  for (const ligne of lignes) {
    assert.equal(ligne.length, lignes[0].length, `cadre ouvert : « ${ligne} »`);
  }
  assert.equal(lignes[0], "+" + "-".repeat(lignes[0].length - 2) + "+");
});
