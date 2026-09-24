// ============================================================================
// Tests de la règle « part publique d'un original signé » — et de sa copie.
//
//   node --test          (ou: npm test)
//
// La règle vit dans UN module (`src/server/mysql/original-signe.mjs`), que
// partagent l'application (`src/lib/signature.js`) et le service auto-hébergé
// (`src/server/mysql/actes.mjs`). Le service de DÉMONSTRATION (`index.html`,
// <script type="text/x-server-plugin">) n'importe pas de modules : il garde sa
// copie. Ces épreuves tiennent la copie pour ÉQUIVALENTE — la duplication
// constatée par l'audit (NC-I-004) ne peut donc plus dériver en silence.
//
// On extrait la fonction du texte de `index.html` (accolades équilibrées), on
// l'évalue, et on la compare au module sur une batterie d'entrées. Même chose
// pour l'empreinte SHA-256 synchrone du service de démonstration, comparée à
// `node:crypto` — la seule autorité en la matière.
// ============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CHAMPS_INTERNES, sansInterne, partiePublique } from "../src/server/mysql/original-signe.mjs";

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

// Le texte de `index.html` : il vit à la racine du dépôt, donc dans le dossier
// COURANT (les commandes s'exécutent depuis la racine) ; les autres essais
// couvrent une exécution lancée d'ailleurs. Il peut manquer (le dossier `src/`
// seul, dans l'image du service) : les épreuves qui en dépendent sont alors
// sautées.
async function lireIndex() {
  try {
    const { readFile } = await import("node:fs/promises");
    for (const p of ["index.html", "../../index.html", "../index.html"]) {
      try { return await readFile(p, "utf8"); } catch (e) { /* essai suivant */ }
    }
  } catch (e) { /* node:fs indisponible */ }
  return null;
}

// Extrait une déclaration `function nom(…) { … }` par équilibrage des accolades.
// Rend null si la fonction n'est pas là (le jour où le service de démonstration
// n'aura plus sa copie, ces épreuves n'auront plus d'objet).
function extraireFonction(source, nom) {
  const debut = source.indexOf("function " + nom + "(");
  if (debut < 0) return null;
  const ouvrante = source.indexOf("{", debut);
  if (ouvrante < 0) return null;
  let niveau = 0;
  for (let i = ouvrante; i < source.length; i++) {
    if (source[i] === "{") niveau++;
    else if (source[i] === "}") { niveau--; if (!niveau) return source.slice(debut, i + 1); }
  }
  return null;
}

// Extrait une déclaration `const nom = …;` (une seule instruction) — la table
// K256 accompagne l'empreinte. Rend null si elle n'est pas là.
function extraireConstante(source, nom) {
  const debut = source.indexOf("const " + nom + " =");
  if (debut < 0) return null;
  const fin = source.indexOf(";", debut);
  return fin < 0 ? null : source.slice(debut, fin + 1);
}

// L'entrée de référence : un original signé avec son dossier interne.
const packAvecInterne = () => ({
  format: "application/vnd.actes.original-signe+json",
  document: { akn: "<akomaNtoso/>", sha256: "abc" },
  interne: { format: "application/vnd.actes.dossier-signature+json", courriels: [{ a: "b" }] },
  signatures: [{
    signeLe: "2026-03-10T12:20:00.000Z",
    signataire: { nom: "Yann Dubois", fonction: "Maire", courriel: "y.dubois@exemple.fr", personId: "P-1", compteId: "C-1", compteOutil: "outil-9", rapproche: true },
  }],
});

test("sansInterne retire le dossier interne et les mentions nominatives", () => {
  const sortie = sansInterne(packAvecInterne());
  assert.equal(sortie.interne, undefined, "le dossier interne ne sort pas");
  const sig = sortie.signatures[0].signataire;
  for (const champ of CHAMPS_INTERNES) assert.equal(sig[champ], undefined, `« ${champ} » ne sort pas`);
  // Ce qui reste est ce que la signature donne à lire.
  assert.equal(sig.nom, "Yann Dubois");
  assert.equal(sig.fonction, "Maire");
  assert.equal(sortie.document.sha256, "abc", "le document et les autres champs sont conservés");
  // La signature elle-même n'est pas modifiée hors de `signataire`.
  assert.equal(sortie.signatures[0].signeLe, "2026-03-10T12:20:00.000Z");
  // L'entrée n'est pas modifiée (pas d'effet de bord).
  assert.ok(packAvecInterne().interne, "l'original n'est pas altéré sur place");
});

test("sansInterne laisse passer ce qu'il ne comprend pas, sans le casser", () => {
  assert.equal(sansInterne(null), null);
  assert.equal(sansInterne(undefined), undefined);
  assert.equal(sansInterne("texte"), "texte");
  const sansSignatures = sansInterne({ interne: {}, autre: 1 });
  assert.equal(sansSignatures.interne, undefined);
  assert.equal(sansSignatures.autre, 1);
  // Une signature sans identité ne fait pas échouer la règle.
  const sansIdentite = sansInterne({ signatures: [{ signeLe: "x" }] });
  assert.deepEqual(sansIdentite.signatures[0].signataire, {});
});

test("partiePublique est bien la même règle que sansInterne", () => {
  assert.equal(partiePublique, sansInterne, "un seul point de vérité : les deux noms désignent la même fonction");
});

test("la copie du service de démonstration suit exactement la règle", async () => {
  const html = await lireIndex();
  if (!html) return; // saut : le fichier n'est pas là
  const source = extraireFonction(html, "sansInterne");
  assert.ok(source, "index.html porte encore sa copie de `sansInterne`");
  const demo = new Function("return (" + source + ")")();
  // Une batterie d'entrées : la copie doit rendre EXACTEMENT ce que rend le module.
  const entrees = [
    packAvecInterne(),
    { interne: {}, signatures: [] },
    { signatures: [{ signataire: { nom: "A", courriel: "a@b.fr", compteId: "C" } }] },
    { document: { akn: "x" } },
    { signatures: [{ signataire: null, signeLe: "z" }] },
    { signatures: [{ signeLe: "z" }] },
    null,
    "texte",
    42,
  ];
  for (const e of entrees) {
    assert.deepEqual(demo(e), sansInterne(e), `divergence sur ${JSON.stringify(e)}`);
  }
  // Et la liste des champs retirés est la même : c'est elle qui se relira un jour.
  for (const champ of CHAMPS_INTERNES) {
    assert.ok(source.includes('delete sig.' + champ), `la copie retire bien « ${champ} »`);
  }
});

test("l'empreinte SHA-256 synchrone du service de démonstration est exacte", async () => {
  const html = await lireIndex();
  if (!html) return; // saut
  const source = extraireFonction(html, "sha256Hex");
  assert.ok(source, "index.html porte encore sa copie de `sha256Hex`");
  // `utf8Bytes` et la table K256 accompagnent l'empreinte : on évalue le tout.
  const utf8Source = extraireFonction(html, "utf8Bytes");
  const tableSource = extraireConstante(html, "K256");
  const demo = new Function((tableSource || "") + "\n" + (utf8Source || "") + "\n" + source + "\nreturn sha256Hex;")();
  // Des entrées qui éprouvent l'encodage (accents, caractère hors BMP) et les
  // longueurs qui font déborder le bloc de 64 octets.
  const echantillons = ["", "a", "Arrêté n°2026-401", "é".repeat(60), "𝄞 clé", "x".repeat(1000), JSON.stringify({ a: 1, b: "ç" })];
  for (const s of echantillons) {
    assert.equal(demo(s), sha256(s), `empreinte divergente pour ${JSON.stringify(s.slice(0, 20))}`);
  }
});
