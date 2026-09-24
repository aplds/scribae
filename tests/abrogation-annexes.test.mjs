// ============================================================================
// Tests de la règle d'abrogation des ANNEXES — `node --test`.
//
// La règle est juridique avant d'être technique, et c'est ce que ces épreuves
// fixent : une annexe SANS publication autonome fait partie de sa décision mère
// et s'éteint avec elle ; une annexe AUTONOME (un règlement, publié pour
// lui-même) y survit et demande un acte autonome pour être retirée. Se tromper
// ici, c'est soit laisser en vigueur un texte que personne ne surveille, soit
// éteindre un règlement que la collectivité croyait toujours applicable.
//
//   node --test tests/
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

const TRAME_ANNEXE = { id: "tpl-annexe", nature: "annexe" };
const TRAME_REGLEMENT = { id: "tpl-reglement", nature: "annexe", reglement: true };
const TRAME_ACTE = { id: "tpl-deliberation", nature: "acte" };

// Une décision mère : elle ADOPTE deux annexes (un tableau, et un règlement
// publié à part). `values.__annexes` ne porte qu'une identification figée —
// c'est le registre qui sait ce que chaque annexe est devenue.
function mere({ annexes = [] } = {}) {
  return {
    id: "mere", numero: "2026-0100-VSL", objet: "délibération adoptant le règlement intérieur",
    statut: "publie", dateSignature: "2026-03-01",
    values: {
      __annexes: annexes.map((a) => ({ acteId: a.id, numero: a.numero, designation: a.designation || "annexe", date: a.dateSignature, objet: a.objet, eli: a.eli })),
    },
  };
}

const tableau = { id: "annexe-tableau", numero: "2026-0101-VSL", designation: "grille tarifaire", trameId: "tpl-annexe", statut: "signee" };
const reglement = { id: "annexe-reglement", numero: "2026-0102-VSL", designation: "règlement intérieur", trameId: "tpl-reglement", statut: "publie", eli: "eli:/fr/reg/2026/0102/vsl" };

test("abrogation : la sorte d'une annexe se lit sur sa TRAME", async (t) => {
  const mod = await charger("../src/lib/abrogation-annexes.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const trames = [TRAME_ACTE, TRAME_ANNEXE, TRAME_REGLEMENT];
  assert.equal(mod.sorteAnnexe({ trameId: "tpl-reglement" }, trames), mod.SORTES.AUTONOME);
  assert.equal(mod.sorteAnnexe({ trameId: "tpl-annexe" }, trames), mod.SORTES.PART);
  // Trame inconnue, ou absente : une annexe n'a pas de publication autonome par
  // défaut — on ne lui en prête pas.
  assert.equal(mod.sorteAnnexe({ trameId: "disparue" }, trames), mod.SORTES.PART);
  assert.equal(mod.sorteAnnexe(null, trames), mod.SORTES.PART);
});

test("abrogation : les annexes sans publication autonome sont emportées, les autres NON", async (t) => {
  const mod = await charger("../src/lib/abrogation-annexes.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const actes = [mere({ annexes: [tableau, reglement] }), tableau, reglement];
  const trames = [TRAME_ANNEXE, TRAME_REGLEMENT];
  const effet = mod.effetAbrogationSurAnnexes(actes[0], { actes, trames });
  assert.deepEqual(effet.emportees.map((a) => a.id), ["annexe-tableau"]);
  assert.deepEqual(effet.autonomes.map((a) => a.id), ["annexe-reglement"]);
  assert.equal(effet.autonomes[0].eli, "eli:/fr/reg/2026/0102/vsl", "le texte autonome garde son identifiant, pour être retrouvé");
});

test("abrogation : rien à dire quand toutes les annexes sont des parties", async (t) => {
  const mod = await charger("../src/lib/abrogation-annexes.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const actes = [mere({ annexes: [tableau] }), tableau];
  assert.equal(mod.avertissementAnnexesAutonomes(actes[0], { actes, trames: [TRAME_ANNEXE] }), "");
  const avecReglement = [mere({ annexes: [tableau, reglement] }), tableau, reglement];
  const phrase = mod.avertissementAnnexesAutonomes(avecReglement[0], { actes: avecReglement, trames: [TRAME_ANNEXE, TRAME_REGLEMENT] });
  assert.match(phrase, /règlement intérieur/);
  assert.match(phrase, /abrogé ou modifié par un acte autonome/);
});

test("abrogation : une annexe absente du registre ne fait pas échouer la règle", async (t) => {
  const mod = await charger("../src/lib/abrogation-annexes.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const actes = [mere({ annexes: [{ id: "annexe-perdue", numero: "2026-0103-VSL", designation: "état annexé" }] })];
  const effet = mod.effetAbrogationSurAnnexes(actes[0], { actes, trames: [] });
  assert.equal(effet.toutes.length, 1);
  assert.equal(effet.toutes[0].sorte, mod.SORTES.PART, "sans acte, on ne lui prête pas de publication autonome");
  assert.equal(effet.emportees[0].id, "annexe-perdue");
  // Un acte d'annexe à la corbeille n'est pas résolu non plus — le registre ne
  // le porte plus.
  const corbeille = [{ ...tableau, deletedAt: "2026-04-01T00:00:00.000Z" }];
  const mere2 = mere({ annexes: [tableau] });
  assert.equal(mod.effetAbrogationSurAnnexes(mere2, { actes: [mere2, ...corbeille], trames: [TRAME_ANNEXE] }).toutes[0].acte, null);
});

test("abrogation : les phrases du journal et de la fiche disent la même règle", async (t) => {
  const mod = await charger("../src/lib/abrogation-annexes.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const actes = [mere({ annexes: [tableau, reglement] }), tableau, reglement];
  const effet = mod.effetAbrogationSurAnnexes(actes[0], { actes, trames: [TRAME_ANNEXE, TRAME_REGLEMENT] });
  assert.match(mod.phraseAnnexeEmportee(effet.emportees[0], actes[0]), /abrogée avec 2026-0100-VSL/);
  assert.match(mod.phraseAnnexeEmportee(effet.emportees[0], actes[0]), /pas de publication autonome/);
  assert.match(mod.phraseAnnexeAutonome(effet.autonomes[0]), /doit être abrogé ou modifié par un acte autonome/);

  // Sur l'annexe emportée, la mention explique pourquoi aucune clause ne la vise.
  assert.equal(mod.mentionAnnexePartDeLaMere({ abrogePar: { parAnnexion: true } }).length > 0, true);
  assert.equal(mod.mentionAnnexePartDeLaMere({ abrogePar: { numero: "X" } }), "", "une abrogation ordinaire n'emprunte pas cette phrase");

  // Sur l'acte abrogeant, ce qui reste à traiter.
  const restantes = mod.mentionAnnexesRestantes({ annexesAutonomesRestantes: [{ designation: "règlement intérieur", numero: "2026-0102-VSL" }] });
  assert.match(restantes, /reste en vigueur/);
  assert.match(restantes, /acte autonome/);
  assert.equal(mod.mentionAnnexesRestantes({}), "");
});
