// ============================================================================
// Scribae — imports jamais employés (règle de `scripts/verifier-style.mjs`).
//
// POURQUOI CETTE RÈGLE. Un import que plus personne n'emploie ne casse rien à
// l'exécution, mais il trompe la lecture : il fait croire que le module dépend
// d'un autre, et il survit à toutes les refactorisations parce que rien ne le
// signale. Le TODO en portait la liste — dix-neuf fichiers, quarante et une
// mentions au moment de la 1.6.1p ; la règle ferme la liste, et l'empêche de se
// reformer.
//
// POURQUOI UN MODULE À PART. Cette fonction est PURE : elle ne lit que le texte
// qu'on lui donne. Elle s'éprouve donc sans outillage ni navigateur, à côté des
// modules du métier (`tests/purs.test.mjs`), plutôt que d'être enterrée dans
// un script qui s'exécute au chargement. `verifier-style.mjs`, lui, garde son
// métier : parcourir l'arborescence, décider, et rendre la monnaie.
//
// CE QU'ELLE NE FAIT PAS. Elle ne suit pas les portées : une variable locale du
// même nom qu'un import ferait tenir l'import pour employé (faux négatif), et un
// nom qui ne vit que dans une chaîne compte comme employé. C'est le sens qu'il
// faut — cette règle ne doit JAMAIS inventer un défaut, seulement constater une
// absence.
// ============================================================================

// Ce qu'une déclaration d'import peut porter : `import { a, b as c } from "…"`.
// Les imports sans accolades (défaut, espace de noms) sont traités à part.
const DECLARATION = /import\s+([^;]*?)\s+from\s+["'][^"']+["']\s*;?/g;

// Le NOM LOCAL d'une entrée d'import : `a` dans « a », `c` dans « a as c ».
const localDe = (entree) => (entree.split(/\s+as\s+/)[1] || entree).trim();

const estIdentifiant = (nom) => /^[A-Za-z_$][\w$]*$/.test(nom);

const employe = (corps, nom) => new RegExp("\\b" + nom.replace(/\$/g, "\\$") + "\\b").test(corps);

// Les imports d'un texte qui ne sont JAMAIS employés ailleurs dans ce texte.
// Rend `[{ nom, ligne }]` — `ligne` étant celle du début de la déclaration, pour
// que le rapport du contrôle de style nomme l'endroit à corriger.
export function importsInutilises(code) {
  const texte = String(code);
  const inutilises = [];
  for (const declaration of texte.matchAll(DECLARATION)) {
    const clause = declaration[1];
    const ligne = texte.slice(0, declaration.index).split("\n").length;
    // Le texte SANS cette déclaration : ce qui reste est ce qui l'emploie (ou non).
    const corps = texte.slice(0, declaration.index) + texte.slice(declaration.index + declaration[0].length);
    const liste = clause.match(/\{([\s\S]*?)\}/);
    const noms = [];
    if (liste) {
      for (const entree of liste[1].split(",")) {
        const brut = entree.trim();
        if (brut) noms.push(localDe(brut));
      }
    }
    // Ce qui précède les accolades : l'import par défaut (`import X from "…"`),
    // l'espace de noms (`import * as X from "…"`), ou les deux.
    const avant = clause.replace(/\{[\s\S]*?\}/, "").replace(/,/g, "").trim();
    const nomNu = avant.replace(/^\*\s+as\s+/, "").trim();
    if (nomNu) noms.push(nomNu);
    for (const nom of noms) {
      if (!estIdentifiant(nom)) continue;   // `import "./effet.js"` : rien à vérifier
      if (!employe(corps, nom)) inutilises.push({ nom, ligne });
    }
  }
  return inutilises;
}
