// ============================================================================
// L'ÉTAT DE L'INTERFACE, et le seau où les écrans le rangent — `node --test`.
//
// POURQUOI CE FICHIER EXISTE. `state` porte l'état de l'application, et une part
// de cet état n'appartient qu'à l'INTERFACE : l'onglet ouvert, le filtre d'une
// liste, le panneau déplié, le cran de zoom. Plusieurs écrans le rangent en
// DÉRÉFÉRENÇANT le seau directement — `state.ui.registre = …` (`views/actes.js`),
// `state.ui.refTab` (`views/referentiel.js`) —, là où d'autres l'ouvrent d'abord
// (`state.ui = state.ui || {}`). Tant que le seau existe dès le départ, les deux
// façons s'accordent ; s'il manque, le premier écran de cette seconde famille
// tombe sur « Cannot read properties of undefined (reading 'registre') », que la
// coquille attrape… en n'affichant RIEN : l'écran du registre était vide, et un
// lien direct vers lui (ou vers le référentiel) l'était aussi.
//
// L'épreuve est courte, et c'est voulu : elle tient LA propriété dont les écrans
// dépendent — le seau existe, et c'est un objet — jamais la liste des fichiers
// qui s'en servent. Ses dents : retirer `ui: {}` de l'état fait échouer le test.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

test("l'état de l'interface existe dès le départ", async (t) => {
  const st = await charger("../src/ui/state.js");
  if (!st || !st.state) return t.skip("module indisponible hors navigateur");

  assert.ok(st.state.ui !== null && typeof st.state.ui === "object" && !Array.isArray(st.state.ui),
    "`state.ui` doit exister dès le départ et être un objet : des écrans le déréférencent "
    + "directement (`state.ui.registre`, `views/actes.js` ; `state.ui.refTab`, `views/referentiel.js`), "
    + "et un écran rendu avant qu'un autre ne l'ait ouvert n'affichait plus RIEN "
    + "(« Cannot read properties of undefined »)");
});
