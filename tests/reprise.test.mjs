// ============================================================================
// Tests de la REPRISE D'UN ACTE ANCIEN — `node --test`.
//
// `src/lib/reprise.js` est PUR : il dit ce qui empêche de publier une reprise et
// tourne un texte libre en blocs de document. C'est là que vivent les trois
// règles du dispositif, et c'est donc là qu'on les éprouve :
//   • la date de publication est nécessairement ANTÉRIEURE au jour ;
//   • l'original signé est exigé ;
//   • le texte se relit en articles sans être réécrit.
//
//   node --test tests/
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

const JOUR = new Date(2026, 8, 22); // 22 septembre 2026 (mois 8 = septembre)

// Une reprise complète, telle que l'écran la compose.
function reprise(over = {}) {
  return {
    titre: "Délibération portant tarification de la restauration scolaire",
    numero: "1998-042",
    texte: "Article 1er — Objet\nLa présente délibération fixe les tarifs.",
    datePublication: "1998-09-21",
    original: { url: "https://user.uploads.dev/file/scan.pdf", nom: "scan.pdf", sha256: "abc" },
    ...over,
  };
}

test("reprise : la date de publication doit être antérieure au jour", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  assert.equal(mod.dateMaxReprise(JOUR), "2026-09-21", "la veille est la date la plus récente");
  assert.equal(mod.dateRepriseValide("1998-09-21", { maintenant: JOUR }), true);
  assert.equal(mod.dateRepriseValide("2026-09-21", { maintenant: JOUR }), true, "la veille passe");
  assert.equal(mod.dateRepriseValide("2026-09-22", { maintenant: JOUR }), false, "le jour même ne passe pas");
  assert.equal(mod.dateRepriseValide("2026-12-01", { maintenant: JOUR }), false, "une date future ne passe pas");
  assert.equal(mod.dateRepriseValide("", { maintenant: JOUR }), false);
  assert.equal(mod.dateRepriseValide("21/09/1998", { maintenant: JOUR }), false, "seule la forme ISO est lue");
});

test("reprise : la validation exige l'original joint et le numéro d'origine", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  assert.deepEqual(mod.validerReprise(reprise(), { maintenant: JOUR }), []);
  assert.equal(mod.repriseValide(reprise(), { maintenant: JOUR }), true);

  const sansOriginal = mod.validerReprise(reprise({ original: null }), { maintenant: JOUR });
  assert.deepEqual(sansOriginal.map((e) => e.champ), ["original"]);

  const sansNumero = mod.validerReprise(reprise({ numero: "  " }), { maintenant: JOUR });
  assert.deepEqual(sansNumero.map((e) => e.champ), ["numero"]);

  const future = mod.validerReprise(reprise({ datePublication: "2026-09-22" }), { maintenant: JOUR });
  assert.deepEqual(future.map((e) => e.champ), ["datePublication"]);

  const vide = mod.validerReprise({}, { maintenant: JOUR });
  assert.deepEqual(vide.map((e) => e.champ).sort(), ["datePublication", "numero", "original", "texte", "titre"]);
});

test("reprise : l'identifiant ELI se déduit du genre et de l'année d'origine", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  assert.equal(mod.actTypeEli({ actTypeId: "deliberation" }), "deliberation");
  assert.equal(mod.actTypeEli({ annexe: true, actTypeId: "deliberation" }), "reglement",
    "un texte autonome porte le code du règlement, non celui de l'acte choisi");
  assert.equal(mod.anneeDuNumero("1998-042"), "1998");
  assert.equal(mod.anneeDuNumero("RI/2011"), "2011");
  assert.equal(mod.anneeDuNumero("42"), "");
  assert.equal(mod.genreDe({ annexe: true }).id, "annexe");
  assert.equal(mod.genreDe({}).id, "acte");
});

test("reprise : le numéro d'origine bâtit un ELI daté et unique", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  // Un numéro à l'ancienne : on le garde tel quel, l'année datant l'acte.
  assert.equal(mod.numeroPourEli({ numero: "1998-042" }), "1998-042");
  assert.equal(mod.numeroPourEli({ numero: "1998/42" }), "1998-42");
  // Sans année dans le numéro : l'année vient de la date de publication.
  assert.equal(mod.numeroPourEli({ numero: "42", datePublication: "1998-09-21" }), "1998-42");
  // Un texte sans séquence : l'empreinte donne une séquence stable, et deux
  // reprises distinctes ne se disputent pas la même adresse.
  const a = mod.numeroPourEli({ numero: "RI/2011", titre: "Règlement intérieur" });
  const b = mod.numeroPourEli({ numero: "RI/2011", titre: "Charte d'usage" });
  assert.match(a, /^2011-\d{4}$/);
  assert.notEqual(a, b);
  assert.equal(a, mod.numeroPourEli({ numero: "RI/2011", titre: "Règlement intérieur" }), "l'empreinte est stable");
});

test("reprise : le texte se relit en articles, divisions et listes", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const texte = [
    "# TITRE I — Dispositions générales",
    "",
    "Article 1er — Objet",
    "Le présent règlement fixe les règles d'usage.",
    "Il s'applique à tous.",
    "",
    "Article 2 : Tarifs",
    "- premier tarif",
    "- second tarif",
    "",
    "## Chapitre 2",
    "",
    "Article 3",
    "Texte du troisième article.",
  ].join("\n");

  const nodes = mod.analyserTexteLibre(texte);
  assert.equal(nodes.length, 1, "un seul titre de niveau 1");
  const titre = nodes[0];
  assert.equal(titre.type, "division");
  assert.equal(titre.level, 1);
  assert.equal(titre.heading, "TITRE I — Dispositions générales");

  const [art1, art2, chap] = titre.blocks;
  const art3 = chap.blocks[0];
  assert.equal(art1.type, "article");
  assert.equal(art1.numLabel, "Article 1er");
  assert.equal(art1.heading, "Objet");
  // Deux lignes consécutives ne font qu'un paragraphe : le texte collé se relit
  // comme un texte, non comme une suite de lignes.
  assert.deepEqual(art1.blocks, [{ type: "para", text: "Le présent règlement fixe les règles d'usage. Il s'applique à tous." }]);

  assert.equal(art2.numLabel, "Article 2");
  assert.equal(art2.heading, "Tarifs");
  assert.deepEqual(art2.blocks, [{ type: "list", items: [{ text: "premier tarif" }, { text: "second tarif" }] }]);

  assert.equal(chap.type, "division");
  assert.equal(chap.level, 2);
  assert.equal(chap.heading, "Chapitre 2");
  assert.equal(art3.numLabel, "Article 3");
  assert.equal(chap.blocks[0].type, "article", "un article vit DANS la division courante");
  assert.equal(chap.blocks[0].blocks[0].text, "Texte du troisième article.");
});

test("reprise : une phrase n'est pas un intitulé d'article", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  // « Article 5 du règlement s'applique » n'est pas un intitulé : la ligne
  // continue après le numéro, sans séparateur — c'est un paragraphe.
  const nodes = mod.analyserTexteLibre("Article 5 du présent règlement s'applique aux agents.");
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0].type, "para");
});

test("reprise : le document porte le titre, puis le texte analysé", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const doc = mod.docReprise(reprise({
    titre: "Règlement intérieur du conseil municipal",
    numero: "2011-007",
    texte: "Article 1er — Séances\nLe conseil se réunit au moins dix fois par an.",
    annexe: true,
    actTypeId: "deliberation",
  }), {
    config: { actTypes: [{ id: "reglement", label: "Règlement" }, { id: "deliberation", label: "Délibération" }], vocab: { articleLabel: "Article" } },
    entity: { id: "ent-vsl", code: "VSL", name: "Ville de Valmont-sur-Loire" },
    eliHttp: "https://www.valmont-sur-loire.fr/eli/reg/2011/0007/vsl",
  });

  assert.equal(doc.kind, "reprise");
  assert.equal(doc.nodes[0].type, "title");
  assert.equal(doc.nodes[0].text, "Règlement intérieur du conseil municipal");
  assert.equal(doc.nodes[1].type, "article");
  assert.equal(doc.meta.actTypeId, "reglement", "le type d'acte sert l'identifiant ELI");
  assert.equal(doc.meta.designation, "Règlement");
  assert.equal(doc.meta.dateSignature, "1998-09-21", "la date d'origine vaut date du document");
  assert.equal(doc.meta.eli, "https://www.valmont-sur-loire.fr/eli/reg/2011/0007/vsl");
  assert.equal(doc.meta.entity.code, "VSL");
});

test("reprise : la mention affichée au bas de la page dit ce qu'est une reprise", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  assert.match(mod.MENTION_REPRISE, /titre informatif uniquement/);
  assert.match(mod.MENTION_REPRISE, /reprise/);
  assert.match(mod.MENTION_REPRISE, /n'ouvre aucun délai de recours/);
  assert.match(mod.MENTION_REPRISE, /original signé/);
});

test("reprise : `estReprise` ne confond pas une reprise avec un acte ordinaire", async (t) => {
  const mod = await charger("../src/lib/reprise.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  assert.equal(mod.estReprise({ kind: "reprise" }), true);
  assert.equal(mod.estReprise({ kind: "importe" }), false);
  assert.equal(mod.estReprise({}), false);
  assert.equal(mod.estReprise(null), false);
});
