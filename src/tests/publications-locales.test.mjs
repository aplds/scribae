// ============================================================================
// Tests du repli local du recueil public — `node --test`.
//
// `src/lib/publications-locales.js` relit les enregistrements de publication
// gardés sur les actes quand le service ne rend rien. C'est un module PUR : il
// reçoit une liste d'actes et rend des notices. On l'éprouve donc sans
// navigateur, sans base et sans service — y compris les deux pièges qui lui ont
// donné sa forme :
//   • un acte qui n'est pas « publié » n'appartient pas au recueil ;
//   • `formats` a DEUX sens selon le chemin de publication — la fiche complète
//     du service en fait un objet de pièces, la réponse de dépôt un tableau de
//     types MIME. Confondre les deux fait disparaître le texte de l'acte.
//
//   node --test src/tests/
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

// Un acte publié, tel que le registre local le porte : la notice de sa
// publication est rangée sur l'acte lui-même. `publication` reçoit ce que le
// test veut changer dans la notice (elle est fusionnée EN DERNIER, sinon les
// autres champs de l'acte l'écraseraient).
function actePublie({ id = "acte-1", cle = "arr-2026-0001-vsl@2026-01-02-originale", eliUri = "eli:/fr/arr/2026/0001/vsl", publication = {}, ...reste } = {}) {
  return {
    id,
    statut: "publie",
    numero: "2026-0001-VSL",
    objet: "règlement de la restauration scolaire",
    ...reste,
    publication: {
      cle, eliUri, dateDocument: "2026-01-02", datePublication: "2026-01-05",
      publieeLe: "2026-01-05T10:00:00.000Z", kind: "originale",
      formats: { html: "<p>texte</p>", akn: "<akn/>", jsonld: "{}", md: "# texte", texte: "texte" },
      ...publication,
    },
  };
}

test("publications locales : seuls les actes RÉELLEMENT publiés entrent au recueil", async (t) => {
  const mod = await charger("../lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const liste = mod.publicationsLocales([
    actePublie({ id: "a" }),
    { id: "b", statut: "signee", publication: { cle: "x@y" } },              // signé, pas publié
    { id: "c", statut: "publie" },                                            // publié sans enregistrement
    { ...actePublie({ id: "d" }), deletedAt: "2026-02-01T00:00:00.000Z" },     // à la corbeille
    { id: "e", statut: "brouillon" },
  ]);
  assert.deepEqual(liste.map((p) => p.cle), ["arr-2026-0001-vsl@2026-01-02-originale"]);
  assert.equal(mod.actePublie({ statut: "publie", publication: { cle: "x" } }), true);
  assert.equal(mod.actePublie({ statut: "publie" }), false);
  assert.equal(mod.actePublie({ statut: "signee", publication: { cle: "x" } }), false);
});

test("publications locales : les versions d'un même ELI sont rangées, la plus récente est `latest`", async (t) => {
  const mod = await charger("../lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const ancienne = actePublie({
    id: "v1", cle: "arr-2026-0001-vsl@2026-01-02-originale",
    publication: { dateDocument: "2026-01-02", publieeLe: "2026-01-05T10:00:00.000Z", kind: "originale" },
  });
  const nouvelle = actePublie({
    id: "v2", cle: "arr-2026-0001-vsl@2026-06-02-consolidee",
    publication: { dateDocument: "2026-06-02", publieeLe: "2026-06-05T10:00:00.000Z", kind: "consolidee" },
  });
  const liste = mod.publicationsLocales([ancienne, nouvelle]);
  const parCle = Object.fromEntries(liste.map((p) => [p.cle, p]));
  assert.equal(parCle[ancienne.publication.cle].latest, false);
  assert.equal(parCle[nouvelle.publication.cle].latest, true, "la version la plus récente porte `latest`");
  // Chaque version porte l'historique de son identifiant — sans se contenir.
  assert.equal(parCle[ancienne.publication.cle].versions.length, 2);
  assert.equal(parCle[ancienne.publication.cle].versions[0].versions.length, 0);
});

test("publications locales : un acte réservé aux agents n'est pas montré", async (t) => {
  const mod = await charger("../lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const actes = [actePublie({ publication: { reserve: true } })];
  assert.equal(mod.publicationsLocales(actes).length, 0, "un visiteur anonyme ne les voit pas");
  assert.equal(mod.publicationsLocales(actes, { reserveVue: true }).length, 1, "un agent de réseau autorisé, si");
});

test("publications locales : les pièces viennent de `formats` ou des champs à plat", async (t) => {
  const mod = await charger("../lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  // Fiche complète du service : `formats` est un OBJET de pièces.
  const complete = actePublie({ id: "f1" });
  const a = mod.publicationLocale([complete], complete.publication.cle);
  assert.equal(a.formats.html, "<p>texte</p>");

  // Réponse de dépôt : les pièces sont à plat, et `formats` est la liste des
  // types MIME. Les prendre pour des pièces viderait le texte de l'acte.
  const depot = actePublie({ id: "f2" });
  delete depot.publication.formats;
  depot.publication.html = "<p>à plat</p>";
  depot.publication.md = "# à plat";
  depot.publication.formats = ["text/html", "application/ld+json"];
  const b = mod.publicationLocale([depot], depot.publication.cle);
  assert.equal(b.formats.html, "<p>à plat</p>", "le tableau de types MIME n'est pas un objet de pièces");
  assert.equal(b.formats.md, "# à plat");
  assert.equal(b.formats.akn, "");
});

test("publications locales : une clé inconnue ne rend rien", async (t) => {
  const mod = await charger("../lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  assert.equal(mod.publicationLocale([actePublie()], "inconnue@2026-01-01-originale"), null);
  assert.equal(mod.publicationLocale([actePublie()], ""), null);
});

test("informations locales : un brouillon n'est jamais publié", async (t) => {
  const mod = await charger("../lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const liste = mod.informationsLocales([
    { id: "i1", publie: true },
    { id: "i2", publie: false },
    { id: "i3" },
    null,
  ]);
  assert.deepEqual(liste.map((i) => i.id), ["i1"]);
});
