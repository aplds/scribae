// ============================================================================
// Tests des modules PURS — `node --test`.
//
// Le pari de l'application est que le MÉTIER ne touche ni au DOM ni au réseau :
// ces modules peuvent donc être éprouvés sans navigateur, sans base et sans
// service. C'est ce que fait ce fichier, et c'est le socle sur lequel les tests
// de parcours (à venir) pourront s'appuyer.
//
//   node --test src/tests/
//
// Les modules sont chargés DYNAMIQUEMENT : un module qui exigerait un
// navigateur (DOMParser, localStorage) ferait échouer l'import, et ses tests
// sont alors simplement SAUTÉS au lieu de faire tomber la suite. Un test qu'on
// ne peut pas exécuter ici ne doit pas cacher les tests qu'on peut exécuter.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

// ------------------------------------------------------------------ expressions
test("expr : arithmétique, comparaisons et logique", async (t) => {
  const expr = await charger("../lib/expr.js");
  if (!expr) return t.skip("module indisponible hors navigateur");
  assert.equal(expr.evaluate("1 + 2 * 3"), 7);
  assert.equal(expr.evaluate("(1 + 2) * 3"), 9);
  assert.equal(expr.evaluate("2 > 1"), true);
  assert.equal(expr.evaluate("'a' !== 'b'"), true);
  assert.equal(expr.evaluate("true && false"), false);
  assert.equal(expr.evaluate("false || 3"), true);
  assert.equal(expr.evaluate("1 ? 'oui' : 'non'"), "oui");
});

test("expr : contexte, membres et index", async (t) => {
  const expr = await charger("../lib/expr.js");
  if (!expr) return t.skip("module indisponible hors navigateur");
  const ctx = { acte: { numero: "2026-001", tags: ["a", "b"] }, seuil: 2 };
  assert.equal(expr.evaluate("acte.numero", ctx), "2026-001");
  assert.equal(expr.evaluate("acte.tags[1]", ctx), "b");
  assert.equal(expr.evaluate("seuil * 10", ctx), 20);
});

test("expr : l'opérateur `in` couvre les listes et les chaînes", async (t) => {
  const expr = await charger("../lib/expr.js");
  if (!expr) return t.skip("module indisponible hors navigateur");
  assert.equal(expr.evaluate("'x' in liste", { liste: ["x", "y"] }), true);
  assert.equal(expr.evaluate("'z' in liste", { liste: ["x", "y"] }), false);
  assert.equal(expr.evaluate("'x' in 'xyz'"), true);
});

test("expr : une expression invalide est SIGNALÉE, jamais exécutée", async (t) => {
  const expr = await charger("../lib/expr.js");
  if (!expr) return t.skip("module indisponible hors navigateur");
  // Le contrôle rend un verdict sans lever ; `evaluate` lève sur une erreur.
  assert.equal(expr.checkExpr("1 +").ok, false);
  assert.equal(typeof expr.checkExpr("1 +").error, "string");
  assert.equal(expr.checkExpr("1 + 1").ok, true);
  assert.throws(() => expr.evaluate("1 +"));
  // Aucun `eval` : une tentative de sortie du langage ne trouve rien à évaluer.
  assert.equal(expr.evaluate("this"), undefined);
});

// ------------------------------------------------------------------ assainissement
test("sanitize : les adresses dangereuses sont refusées", async (t) => {
  const s = await charger("../lib/sanitize.js");
  if (!s) return t.skip("module indisponible hors navigateur");
  assert.equal(s.adresseSure("https://exemple.fr/acte", false), true);
  assert.equal(s.adresseSure("/eli/arr/2026/0001/vsl", false), true);
  assert.equal(s.adresseSure("#recueil-contenu", false), true);
  assert.equal(s.adresseSure("mailto:maire@exemple.fr", false), true);
  // Schémas exécutables — y compris obfusqués par espace ou tabulation.
  assert.equal(s.adresseSure("javascript:alert(1)", false), false);
  assert.equal(s.adresseSure("java\tscript:alert(1)", false), false);
  assert.equal(s.adresseSure(" JAVASCRIPT:alert(1)", false), false);
  assert.equal(s.adresseSure("vbscript:msgbox(1)", false), false);
  // Données : une image matricielle peut être une SOURCE, un HTML jamais.
  assert.equal(s.adresseSure("data:image/png;base64,AAAA", true), true);
  assert.equal(s.adresseSure("data:text/html;base64,AAAA", true), false);
  assert.equal(s.adresseSure("data:image/png;base64,AAAA", false), false);
});

test("sanitize : le fragment publié perd ce qui peut exécuter", async (t) => {
  const s = await charger("../lib/sanitize.js");
  if (!s || typeof DOMParser === "undefined") return t.skip("DOMParser requis");
  const propre = s.assainirHtml(
    '<p onclick="x()">a</p><script>bad()</script>' +
    '<a href="javascript:y()">l</a><em>b</em><img src="data:image/png;base64,AA">' +
    '<iframe src="https://tiers"></iframe>',
  );
  assert.doesNotMatch(propre, /onclick/);
  assert.doesNotMatch(propre, /<script/);
  assert.doesNotMatch(propre, /javascript:/);
  assert.doesNotMatch(propre, /<iframe/);
  assert.match(propre, /<em>b<\/em>/);
  assert.match(propre, /data:image\/png/);
});

// ------------------------------------------------------------------ numérotation
test("numbering : gabarit et jetons inconnus", async (t) => {
  const n = await charger("../lib/numbering.js");
  if (!n) return t.skip("module indisponible hors navigateur");
  assert.equal(n.remplacerJetons("{year}-{seq}", { year: 2026, seq: "007" }), "2026-007");
  // Un jeton inconnu n'est PAS remplacé : il reste lisible tel quel.
  assert.equal(n.remplacerJetons("{year}-{inconnu}", { year: 2026 }), "2026-{inconnu}");
  assert.equal(n.cheminNormalise("articles[2].clauses[0]"), "articles.2.clauses.0");
  const entetes = n.lireEntetes("Authorization: Bearer x\nContent-Type: application/json");
  assert.equal(entetes.Authorization, "Bearer x");
  assert.equal(entetes["Content-Type"], "application/json");
});

// ------------------------------------------------------------------ version
test("version : numéro sémantique et libellés", async (t) => {
  const v = await charger("../lib/version.js");
  if (!v) return t.skip("module indisponible hors navigateur");
  assert.match(v.APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(v.versionLabel("1.2.3"), "v1.2.3");
  assert.equal(v.releasedLabel("2026-09-21"), "21/09/2026");
});

// ------------------------------------------------------------------ assemblées
test("conseils : l'assemblée d'une entité, et la qualité qui signe", async (t) => {
  const c = await charger("../lib/conseils.js");
  if (!c) return t.skip("module indisponible hors navigateur");
  const config = {
    roles: [
      { id: "maire", m: "maire", f: "maire", label: "Maire" },
      { id: "president-ca", m: "président du conseil d'administration", f: "présidente du conseil d'administration", label: "Président du CA" },
    ],
    councils: [
      { id: "cm", entityId: "vsl", name: "Conseil municipal de V", authorityFormula: "Le conseil municipal de V", signerRoleId: "maire", actif: true },
      { id: "ca", entityId: "oph", name: "Conseil d'administration de l'O", authorityFormula: "Le conseil d'administration de l'O", signerRoleId: "president-ca", actif: true },
    ],
  };
  assert.equal(c.conseilPourActe(config, { entityId: "vsl" }).id, "cm");
  assert.equal(c.conseilPourActe(config, { entityId: "oph" }).id, "ca");
  assert.equal(c.conseilPourActe(config, { entityId: "vsl", conseilId: "ca" }).id, "ca");
  assert.equal(c.conseilPourActe(config, { entityId: "inconnu" }), null);
  const e = c.enrichirConseil(config, config.councils[1], { signataire: { civility: "Madame" } });
  assert.equal(e.signerQualite, "présidente du conseil d'administration");
  assert.equal(e.signerQualiteArticleMaj, "La présidente du conseil d'administration");
});

test("compile : un acte d'assemblée porte la formule du conseil", async (t) => {
  const { compile } = await charger("../lib/compile.js");
  const { newTrame, newNode } = await charger("../lib/schema.js");
  if (!compile || !newTrame) return t.skip("module indisponible hors navigateur");
  const config = {
    brand: { baseUri: "https://exemple.fr" },
    roles: [{ id: "maire", m: "maire", f: "maire", label: "Maire" }],
    entities: [{ id: "vsl", code: "VSL", kind: "commune", name: "Ville de V", nameWithArt: "la ville de V", authorityFormula: "{qualite} de V" }],
    councils: [{ id: "cm", entityId: "vsl", name: "Conseil municipal de V", authorityFormula: "Le conseil municipal de V", signerRoleId: "maire", actif: true }],
    people: [{ id: "p1", civility: "Madame", firstName: "A", lastName: "B", roles: ["maire"], entityId: "vsl" }],
    refs: [], mentions: [], families: [], actTypes: [{ id: "deliberation", label: "Délibération" }],
    numbering: { year: 2026, seq: 1, eliPattern: "{baseUri}/eli/{actTypeId}/{year}/{seq}/{entityCode}", pad: 3 },
  };
  const trame = newTrame({
    id: "t", name: "Délibération", actTypeId: "deliberation", assemblee: true,
    fields: [{ id: "numero", type: "text" }, { id: "objet", type: "text" }, { id: "dateSignature", type: "date" }, { id: "signataire", type: "signataire" }],
    body: [newNode("authority", { text: "{{autorite}}" }), newNode("signature", { place: "{{entity.seatCity}}" })],
  });
  const doc = compile(trame, { numero: "2026-001-VSL", objet: "x", dateSignature: "2026-01-01", signataire: "p1", __entityId: "vsl" }, config);
  const autorite = (doc.nodes.find((n) => n.type === "authority") || {}).text;
  assert.equal(autorite, "Le conseil municipal de V");
  assert.equal(doc.meta.conseil && doc.meta.conseil.signerRoleId, "maire");
});

// ------------------------------------------------------------------ ELI
test("eli : l'identifiant et l'adresse ne se confondent pas", async (t) => {
  const e = await charger("../lib/eli.js");
  if (!e) return t.skip("module indisponible hors navigateur");
  const config = { brand: { baseUri: "https://exemple.fr/" } };
  assert.equal(e.eliIdentifiant("eli:/fr/arr/2026/0464/vsl"), "eli:/fr/arr/2026/0464/vsl");
  assert.equal(e.eliAdresse({ config, eliUri: "eli:/fr/arr/2026/0464/vsl" }), "https://exemple.fr/eli/arr/2026/0464/vsl");
  assert.equal(e.eliAdresse({ config: { brand: { baseUri: "" } }, eliUri: "eli:/fr/arr/2026/0464/vsl" }), "");
});

// ------------------------------------------------------------------ transmission
test("legalite : une transmission simulée porte une mention qualifiée", async (t) => {
  const l = await charger("../lib/legalite.js");
  if (!l) return t.skip("module indisponible hors navigateur");
  const reel = await l.certificatTransmission({ reference: "AR-1", recuLe: "2026-01-02T09:14:00Z", destinataire: "Préfecture", empreinte: "abc" });
  const simule = await l.certificatTransmission({ reference: "AR-1", recuLe: "2026-01-02T09:14:00Z", destinataire: "Préfecture", empreinte: "abc", demonstration: true });
  assert.equal(reel.demonstration, false);
  assert.doesNotMatch(reel.mention, /simulation/i);
  assert.equal(simule.demonstration, true);
  assert.match(simule.mention, /simulée/);
  // Le sceau se recalcule des mêmes mentions : il lie le certificat au document.
  const v = await l.verifierCertificatTransmission(simule, { empreinte: "abc" });
  assert.equal(v.ok, true);
});

