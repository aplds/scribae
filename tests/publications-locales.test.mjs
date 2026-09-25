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
//   node --test tests/
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
  const mod = await charger("../src/lib/publications-locales.js");
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
  const mod = await charger("../src/lib/publications-locales.js");
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
  const mod = await charger("../src/lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  const actes = [actePublie({ publication: { reserve: true } })];
  assert.equal(mod.publicationsLocales(actes).length, 0, "un visiteur anonyme ne les voit pas");
  assert.equal(mod.publicationsLocales(actes, { reserveVue: true }).length, 1, "un agent de réseau autorisé, si");
});

test("publications locales : les pièces viennent de `formats` ou des champs à plat", async (t) => {
  const mod = await charger("../src/lib/publications-locales.js");
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
  const mod = await charger("../src/lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  assert.equal(mod.publicationLocale([actePublie()], "inconnue@2026-01-01-originale"), null);
  assert.equal(mod.publicationLocale([actePublie()], ""), null);
});

test("informations locales : un brouillon n'est jamais publié", async (t) => {
  const mod = await charger("../src/lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");
  const liste = mod.informationsLocales([
    { id: "i1", publie: true },
    { id: "i2", publie: false },
    { id: "i3" },
    null,
  ]);
  assert.deepEqual(liste.map((i) => i.id), ["i1"]);
});

test("publications locales : la signature est qualifiée, ou reprise de l'acte", async (t) => {
  const mod = await charger("../src/lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  // 1. L'enregistrement de publication porte la signature : c'est lui qui fait foi.
  const duService = actePublie({ id: "s1", publication: { signature: { niveau: "qualifiee", signataires: [] } } });
  assert.equal(mod.publicationLocale([duService], duService.publication.cle).signature.niveau, "qualifiee");

  // 2. Enregistrement ANTÉRIEUR (ou recueil d'une page statique sans service) :
  //    l'acte porte le circuit, et la signature se déduit de lui — sans quoi un
  //    acte signé « en simple » se présenterait sans mention.
  const signeSimple = actePublie({ id: "s2", signatureSimple: { signeLe: "2026-01-03T09:00:00.000Z" }, signeLe: "2026-01-03T09:00:00.000Z" });
  const rec = mod.publicationLocale([signeSimple], signeSimple.publication.cle);
  assert.equal(rec.signature.niveau, "simple");
  assert.equal(rec.signature.signeLe, "2026-01-03T09:00:00.000Z");

  // 3. Un acte publié sans circuit connu ne reçoit AUCUNE qualification : on ne
  //    devine pas ce que vaut une signature qu'on ne sait pas lire.
  const muet = actePublie({ id: "s3" });
  assert.equal(mod.publicationLocale([muet], muet.publication.cle).signature, null);
});

test("une reprise d'acte ancien : le drapeau voyage, et il n'y a AUCUNE signature", async (t) => {
  const mod = await charger("../src/lib/publications-locales.js");
  if (!mod) return t.skip("module indisponible hors navigateur");

  // Une reprise publiée, telle que le registre local la garde : elle n'a pas de
  // paquet signé, son original est la pièce jointe, et sa date est ancienne.
  const reprise = {
    id: "reprise-1", kind: "reprise", statut: "publie",
    auteur: "Yann Dubois", provenance: "Registre des délibérations, 1998",
    publication: {
      cle: "reg-1998-042-vsl@1998-06-12-reprise", eliUri: "eli:/fr/reg/1998/042/vsl",
      kind: "reprise", reprise: true, informative: true,
      numero: "1998-042", objet: "Règlement intérieur",
      dateDocument: "1998-06-12", datePublication: "1998-06-12",
      publieeLe: "2026-09-20T10:00:00.000Z", auteur: "Yann Dubois",
      provenance: "Registre des délibérations, 1998",
      originalExterne: { url: "https://exemple.fr/1998-042.pdf", sha256: "abc", nom: "1998-042.pdf" },
      formats: { html: "<p>texte</p>", akn: "<akn/>", jsonld: "{}", md: "# texte", texte: "texte" },
    },
  };

  const liste = mod.publicationsLocales([reprise]);
  assert.equal(liste.length, 1);
  assert.equal(liste[0].reprise, true);
  // Le piège : une reprise PORTE un `originalExterne`, comme un acte du circuit
  // externe — on ne doit pas en déduire une signature.
  assert.equal(liste[0].signature, null, "une reprise ne reçoit aucune qualification de signature");

  const rec = mod.publicationLocale([reprise], reprise.publication.cle);
  assert.equal(rec.reprise, true);
  assert.equal(rec.provenance, "Registre des délibérations, 1998");
  assert.equal(rec.originalExterne.url, "https://exemple.fr/1998-042.pdf");
  assert.equal(rec.kind, "reprise");

  // Un enregistrement ANTÉRIEUR (ou une réponse de dépôt qui ne portait pas
  // `kind`) : le genre se lit alors sur la reprise elle-même — la présenter
  // comme une « version initiale » serait faux.
  const sansKind = { ...reprise, publication: { ...reprise.publication, kind: undefined } };
  const n = mod.publicationsLocales([sansKind])[0];
  assert.equal(n.kind, "reprise");
  assert.equal(n.reprise, true);
});
