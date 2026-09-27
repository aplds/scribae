// ============================================================================
// Tests de la qualification de la signature — `node --test`.
//
// Ce que ces épreuves protègent, et pourquoi elles existent : la valeur probante
// d'un acte ne doit jamais dépendre d'une phrase écrite au hasard dans une vue.
// Un acte signé « en simple » — dans l'application, avec un compte — ne doit pas
// se présenter comme qualifié, et un prestataire simulé doit se dire simulé
// (NC-IV-001 : « ce qui est simulé doit être nommé »). Le module est PUR : on
// l'éprouve sans navigateur, sans service et sans référentiel.
//
//   node --test tests/
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

test("qualification : la signature simple est dite NON qualifiée", async (t) => {
  const mod = await charger("../src/lib/qualification-signature.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const q = mod.qualificationSignature({ niveau: "simple" });
  assert.equal(q.niveau, "simple");
  assert.equal(q.qualifiee, false);
  assert.equal(q.avertissement, true);
  assert.match(q.label, /non qualifiée/i);
  assert.match(q.mention, /eIDAS/);
  assert.match(q.mention, /910\/2014/);
  // Le point juridique : elle est donnée DANS l'application, elle n'est pas
  // qualifiée, et l'original reste la preuve.
  assert.match(q.mention, /dans l'application/i);
  assert.match(q.mention, /original conservé/i);
});

test("qualification : une signature qualifiée n'avertit de rien", async (t) => {
  const mod = await charger("../src/lib/qualification-signature.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const q = mod.qualificationSignature({ niveau: "qualifiee" });
  assert.equal(q.qualifiee, true);
  assert.equal(q.avertissement, false);
  assert.match(q.mention, /prestataire de confiance qualifié/i);
});

test("qualification : un prestataire simulé est nommé comme tel", async (t) => {
  const mod = await charger("../src/lib/qualification-signature.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const simule = mod.qualificationSignature({ niveau: "avancee", simule: true });
  const branche = mod.qualificationSignature({ niveau: "avancee", simule: false, prestataire: { nom: "ESUP-Signature" } });
  assert.equal(simule.avertissement, true);
  assert.match(simule.mention, /SIMULÉ/);
  assert.match(branche.label, /ESUP-Signature/);
  assert.doesNotMatch(branche.mention, /SIMULÉ/);
});

test("qualification : un niveau inconnu ne se devine PAS", async (t) => {
  const mod = await charger("../src/lib/qualification-signature.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  // Un enregistrement ancien, ou une source qui ne dit rien : on se tait plutôt
  // que d'inventer une qualification — et surtout plutôt que d'en inventer une
  // flatteuse.
  for (const entree of [{}, { niveau: "" }, { niveau: "avance" }, { niveau: "inconnu" }]) {
    const q = mod.qualificationSignature(entree);
    assert.equal(q.mention, "");
    assert.equal(q.avertissement, false);
  }
});

test("niveauDepuisCircuit : chaque circuit donne son niveau", async (t) => {
  const mod = await charger("../src/lib/qualification-signature.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  assert.equal(mod.niveauDepuisCircuit("simple"), "simple");
  assert.equal(mod.niveauDepuisCircuit("externe"), "externe");
  // Circuit électronique : le niveau vient du réglage du prestataire, et
  // « avancée » est le défaut quand ce réglage ne dit rien d'exploitable.
  assert.equal(mod.niveauDepuisCircuit("electronique", "qualifiee"), "qualifiee");
  assert.equal(mod.niveauDepuisCircuit("electronique", ""), "avancee");
  assert.equal(mod.niveauDepuisCircuit("electronique", "n'importe quoi"), "avancee");
  assert.equal(mod.niveauDepuisCircuit("", ""), "");
  // Signature interne : avancée par construction — jamais qualifiée.
  assert.equal(mod.niveauDepuisCircuit("interne"), "avancee");
});

test("qualification : la signature interne dit que le service en est l auteur", async (t) => {
  const mod = await charger("../src/lib/qualification-signature.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  // Le prestataire « interne » n'est pas un tiers : c'est le service lui-même, et
  // sa clé ne quitte jamais le serveur. La mention ne doit donc pas se lire comme
  // celle d'un prestataire branché — ni, surtout, comme celle d'un tiers qualifié.
  const q = mod.qualificationSignature({
    niveau: "avancee", simule: false,
    prestataire: { id: "scribae-interne", nom: "Signature interne du service", niveau: "avancee" },
  });
  assert.equal(q.niveau, "avancee");
  assert.equal(q.interne, true);
  assert.equal(q.simulee, false);
  assert.equal(q.avertissement, true, "non qualifiée : l acte publié doit le dire");
  assert.equal(q.qualifiee, false);
  assert.match(q.label, /par le service/);
  assert.match(q.mention, /SERVICE de la collectivité/);
  assert.match(q.mention, /ne quitte jamais le serveur/);
  assert.ok(q.mention.includes("910/2014"), "la mention cite le règlement eIDAS");
  assert.doesNotMatch(q.mention, /SIMULÉ/);
  // Un prestataire de démonstration reste, lui, dit « simulé » : les deux
  // situations ne se confondent pas.
  const demo = mod.qualificationSignature({ niveau: "avancee", simule: true, prestataire: { id: "esup", nom: "ESUP" } });
  assert.equal(demo.interne, false);
  assert.equal(demo.simulee, true);
  assert.match(demo.mention, /SIMULÉ/);
});
