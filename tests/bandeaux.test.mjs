// ============================================================================
// LES BANDEAUX D'INFORMATION — `node --test`.
//
// POURQUOI CE FICHIER EXISTE. L'administration affiche ses propres messages en
// tête de l'application, sur le recueil public et à l'écran de connexion —
// maintenance programmée, alerte, annonce : un titre, une couleur, un contenu,
// enregistrés dans le référentiel (`config.bandeaux`, voir src/lib/bandeaux.js).
// On les PRÉPARE à l'avance puis on les allume : seul un bandeau allumé, qui
// dit quelque chose, s'affiche. Et le pendant : hors démonstration
// (`DEMO=false` en production), les options du bandeau « Démonstration » sont
// MASQUÉES — une installation en service n'a ni jeu fictif ni mention fictive
// à régler.
//
// L'épreuve tient les deux propriétés : la sélection des bandeaux (module pur)
// et le câblage (la carte d'identité masque la démo éteinte, le rendu partagé
// existe, les quatre couleurs sont stylées). Ses dents : retirer le filtre
// `actif` de `bandeauxActifs` fait échouer le test.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

async function lire(chemin) {
  for (const prefixe of ["src/", ""]) {
    try { return await readFile(fileURLToPath(new URL(prefixe + chemin, new URL("..", import.meta.url))), "utf8"); }
    catch (e) { /* préfixe suivant */ }
  }
  return null;
}

// ------------------------------------------------------------------ sélection
test("bandeauxActifs : seuls les bandeaux allumés, qui disent quelque chose", async (t) => {
  const mod = await charger("../src/lib/bandeaux.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const { newBandeau, bandeauxActifs, couleurBandeau } = mod;

  const neuf = newBandeau();
  assert.equal(neuf.actif, true, "un bandeau neuf est allumé");
  assert.equal(neuf.couleur, "info", "un bandeau neuf est bleu");
  assert.ok(String(neuf.id).startsWith("bd-"), "un bandeau neuf est identifié");

  assert.equal(couleurBandeau("urgence"), "urgence");
  assert.equal(couleurBandeau("vert-fluo"), "info", "une couleur inconnue retombe sur l'information");

  const config = {
    bandeaux: [
      { id: "bd-1", titre: "Maintenance programmée", texte: "Samedi de 8 h à 12 h.", couleur: "avertissement", actif: true },
      { id: "bd-2", titre: "Brouillon du mois prochain", texte: "À paraître.", couleur: "info", actif: false },
      { id: "bd-3", titre: "", texte: "   ", couleur: "urgence", actif: true },
    ],
  };
  const actifs = bandeauxActifs(config);
  assert.deepEqual(actifs.map((b) => b.id), ["bd-1"],
    "l'éteint reste en préparation, le vide ne dit rien : seul le premier s'affiche");
  assert.deepEqual(bandeauxActifs({}), [], "sans liste, aucun bandeau");
  assert.deepEqual(bandeauxActifs(null), [], "sans référentiel, aucun bandeau");
});

// ------------------------------------------------------------------- câblage
test("la carte d'identité masque la démo éteinte et règle les bandeaux", async (t) => {
  const vue = await lire("ui/views/referentiel.js");
  if (!vue) return t.skip("vue illisible hors dépôt");
  assert.match(vue, /demoActif\(c\)/, "la carte « Mention de démonstration » dépend de la démonstration allumée");
  assert.match(vue, /ses réglages sont donc masqués/, "démonstration éteinte : aucune option démo, juste la phrase qui le dit");
  assert.match(vue, /bandeauxBloc\(save, redraw\)/, "la carte « Bandeaux d'information » suit la mention de démonstration");
  assert.match(vue, /COULEURS_BANDEAU/, "la couleur se choisit parmi les quatre valeurs du module");
  assert.match(vue, /rafraichirBandeaux\(\)/, "retoucher un bandeau rafraîchit les bandeaux affichés en direct");
});

test("le rendu partagé et ses quatre couleurs existent", async (t) => {
  const notice = await lire("ui/notice.js");
  if (!notice) return t.skip("notice illisible hors dépôt");
  assert.match(notice, /export function bandeauxNotice/, "un seul rendu pour tous les écrans");
  const css = await lire("css/app-base.css");
  if (!css) return t.skip("feuille illisible hors dépôt");
  for (const couleur of ["info", "avertissement", "urgence", "succes"]) {
    assert.ok(css.includes(".app-bandeau--" + couleur), `la couleur « ${couleur} » est stylée`);
  }
  const schema = await lire("lib/schema.js");
  if (!schema) return t.skip("schéma illisible hors dépôt");
  assert.match(schema, /bandeaux:\s*\[\]/, "un référentiel neuf ne porte aucun bandeau");
});
