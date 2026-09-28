// ============================================================================
// Épreuves de la veille de lecture — `node --test`.
//
// Ce que ce module tient : une lecture qui ÉCHOUE n'est pas une lecture qui rend
// VIDE. Une réponse vide conclut ; un échec laisse la lecture à rejouer. Le
// défaut qu'il empêche est visible à l'écran : une rubrique du recueil public
// qui disparaît et ne revient plus.
//
//   node --test tests/
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

test("relecture : une veille neuve est prête, et le reste après un succès", async (t) => {
  const r = await charger("../src/lib/relecture.js");
  if (!r) return t.skip("module indisponible hors navigateur");
  const v = r.veille();
  assert.equal(v.prete, true);
  assert.equal(v.enEchec, false);
  v.succes();
  assert.equal(v.prete, true);
  assert.equal(v.enEchec, false);
});

test("relecture : un échec ferme la porte, le délai la rouvre", async (t) => {
  const r = await charger("../src/lib/relecture.js");
  if (!r) return t.skip("module indisponible hors navigateur");
  const vraiMaintenant = Date.now;
  let maintenant = 1_000_000;
  Date.now = () => maintenant;
  try {
    const v = r.veille();
    v.echec();
    assert.equal(v.enEchec, true);
    assert.equal(v.prete, false);
    // Un redessin immédiat ne rejoue pas la lecture : pas de boucle d'appels.
    maintenant += r.DELAI_RELECTURE - 1;
    assert.equal(v.prete, false);
    // Passé le délai, la lecture est de nouveau permise.
    maintenant += 1;
    assert.equal(v.prete, true);
    // Un succès efface le souvenir de l'échec.
    v.succes();
    assert.equal(v.enEchec, false);
    assert.equal(v.prete, true);
  } finally {
    Date.now = vraiMaintenant;
  }
});

test("relecture : le délai annoncé est celui que lisent les vues", async (t) => {
  const r = await charger("../src/lib/relecture.js");
  if (!r) return t.skip("module indisponible hors navigateur");
  assert.equal(typeof r.DELAI_RELECTURE, "number");
  assert.ok(r.DELAI_RELECTURE >= 1000 && r.DELAI_RELECTURE <= 60000);
});
