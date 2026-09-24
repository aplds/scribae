#!/usr/bin/env node
// ============================================================================
// Scribae — analyse statique SANS DÉPENDANCE.
//
// Pourquoi sans dépendance ? Le dépôt se vérifie avec Node seul : la syntaxe
// (`scripts/verifier-syntaxe.mjs`) et quelques règles de style, ici. Un linter
// tiers ajouterait une chaîne d'approvisionnement à auditer pour des règles que
// l'on écrit en quelques lignes — et la CI n'installe rien pour ce travail.
//
// CE QU'ELLE VÉRIFIE
//   • erreurs : `debugger` (jamais dans du code livré) ;
//   • avertissements : déclarations `var`, traces `console.log`/`console.debug`
//     dans le code CLIENT (lib, ui), et **imports jamais employés** (partout,
//     voir `analyse-imports.mjs`). L'outillage (`scripts/`, `tests/`) et le
//     service auto-hébergé sont exemptés des deux premiers — le service
//     journalise pour l'exploitant, le harnais d'amorçage `host.js` est un
//     amorçage ES5 volontaire, l'outillage rend son verdict à la console.
//     L'import jamais employé, lui, se signale PARTOUT : il ne dépend ni du
//     rôle du fichier, ni de son style.
//
// CE QU'ELLE PARCOURT. Le dossier qui porte l'outillage — la racine du dépôt
// livré, où vivent `scripts/`, `tests/` et `src/` ; tout l'arbre de l'atelier,
// où tout voisine sous `src/`. Les exemptions, elles, sont écrites relativement
// à la RACINE DU CODE (`racine-code.mjs`) : c'est ce qui les rend justes dans
// les deux dispositions — un décalage entre l'outil et la disposition qu'il
// contrôle avait éteint toutes les exemptions (audit, NC-I-009).
//
// USAGE
//   npm run lint                               avertissements tolérés (CI douce)
//   npm run style                              les avertissements font échouer
//
// Voir docs/INDUSTRIALISATION.md et l'audit (proposition P-30).
// ============================================================================
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { RACINE_CODE, RACINE_OUTILLAGE } from "./racine-code.mjs";
import { importsInutilises } from "./analyse-imports.mjs";

const strict = process.argv.includes("--strict");

// Les fichiers volontairement exemptés, et pourquoi. Les chemins sont écrits
// RELATIVEMENT AU CODE (voir `cheminDuCode` plus bas) : `scripts/…` et
// `tests/…` n'y figurent que pour mémoire, l'outillage n'étant jamais dans
// l'arbre du code.
const EXEMPTIONS = [
  { test: (p) => p.startsWith("scripts" + sep) || p.startsWith("tests" + sep), raison: "outillage" },
  { test: (p) => p === "pages" + sep + "host.js", raison: "amorçage ES5 volontaire (avant les modules)" },
  { test: (p) => p.startsWith("server" + sep + "web" + sep + "host.js"), raison: "amorçage ES5 volontaire" },
  { test: (p) => p.startsWith("server" + sep), raison: "le service journalise pour l'exploitant" },
];

const exempt = (p) => EXEMPTIONS.find((e) => e.test(p));

// L'outillage, au sens du parcours : son PREMIER segment de chemin, qui est
// `scripts` ou `tests` dans les deux dispositions (voir ci-dessus).
const estOutillage = (rel) => {
  const premier = rel.split(sep)[0];
  return premier === "scripts" || premier === "tests";
};

// Le chemin d'un fichier relativement à la RACINE DU CODE. Un fichier de
// l'outillage (hors du code) garde son chemin tel quel : il ne peut donc
// correspondre à aucune exemption, ce qui est le sens voulu (« scripts/… » et
// « tests/… » ne sont là que pour la lecture).
const prefixeCode = relative(RACINE_OUTILLAGE, RACINE_CODE);
const cheminDuCode = (rel) => {
  if (!prefixeCode) return rel;
  return rel.startsWith(prefixeCode + sep) ? rel.slice(prefixeCode.length + 1) : rel;
};

async function fichiers(dir, out = []) {
  for (const e of await readdir(join(RACINE_OUTILLAGE, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === "data" || e.name.startsWith(".")) continue;
    const rel = dir ? dir + sep + e.name : e.name;
    if (e.isDirectory()) await fichiers(rel, out);
    else if (/\.(m?js)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const erreurs = [];
const avertissements = [];

const liste = await fichiers("");
for (const rel of liste) {
  const chemin = cheminDuCode(rel);
  const ex = exempt(chemin);
  const texte = await readFile(join(RACINE_OUTILLAGE, rel), "utf8");
  const lignes = texte.split("\n");
  // Un import jamais employé se signale PARTOUT : contrairement aux `var` et aux
  // traces, il ne dépend ni du rôle du fichier (client ou service), ni du style
  // qu'on lui impose (voir analyse-imports.mjs).
  for (const u of importsInutilises(texte)) {
    avertissements.push(`${rel}:${u.ligne} — import « ${u.nom} » jamais employé`);
  }
  lignes.forEach((ligne, i) => {
    const n = i + 1;
    // `debugger` est cherché partout SAUF dans l'outillage, où le mot vit dans
    // les règles elles-mêmes (ce fichier).
    if (!estOutillage(rel)) {
      if (/\bdebugger\b/.test(ligne)) erreurs.push(`${rel}:${n} — « debugger »`);
    }
    if (!ex) {
      if (/^\s*var\s+[A-Za-z_$]/.test(ligne)) avertissements.push(`${rel}:${n} — déclaration « var »`);
      if (/(^|[^.\w])console\.(log|debug)\s*\(/.test(ligne)) avertissements.push(`${rel}:${n} — trace « console.${/debug/.test(ligne) ? "debug" : "log"} » dans le code client`);
    }
  });
}

const rapport = (titre, liste) => {
  if (!liste.length) return;
  console.log(`\n${titre} (${liste.length}) :`);
  for (const x of liste) console.log("  " + x);
};

rapport("Erreurs", erreurs);
rapport("Avertissements", avertissements);

const total = erreurs.length + avertissements.length;
if (!total) {
  console.log(`Analyse statique : ${liste.length} fichier(s), aucune remarque.`);
  process.exit(0);
}
console.log(`\nAnalyse statique : ${liste.length} fichier(s), ${erreurs.length} erreur(s), ${avertissements.length} avertissement(s).`);
process.exit(erreurs.length || (strict && avertissements.length) ? 1 : 0);
