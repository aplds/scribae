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
//   • avertissements : déclarations `var`, et traces `console.log`/`console.debug`
//     dans le code CLIENT (src/lib, src/ui). Le service auto-hébergé et le
//     démarrage `src/server/web/host.js` sont exemptés : le premier journalise
//     pour l'exploitant, le second est un amorçage ES5 volontaire.
//
// USAGE
//   npm run lint                               avertissements tolérés (CI douce)
//   npm run style                              les avertissements font échouer
//
// Voir docs/INDUSTRIALISATION.md et l'audit (proposition P-30).
// ============================================================================
import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const racine = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const strict = process.argv.includes("--strict");

// Où vit le code à analyser. L'outillage est rangé sous `src/` dans la copie de
// travail (Perchance) et recopié à la RACINE du dépôt (`scripts/…`) à la
// livraison : dans le premier cas le code est le dossier de l'outillage
// lui-même, dans le second c'est `src/`. Les deux marchent, sans réglage.
const dossierCode = existsSync(join(racine, "src")) ? "src" : ".";

// Les fichiers volontairement exemptés, et pourquoi.
const EXEMPTIONS = [
  { test: (p) => p.startsWith("scripts" + sep), raison: "outillage" },
  { test: (p) => p === "pages" + sep + "host.js", raison: "amorçage ES5 volontaire (avant les modules)" },
  { test: (p) => p.startsWith("server" + sep + "web" + sep + "host.js"), raison: "amorçage ES5 volontaire" },
  { test: (p) => p.startsWith("server" + sep), raison: "le service journalise pour l'exploitant" },
];

const exempt = (p) => EXEMPTIONS.find((e) => e.test(p));

async function fichiers(dir, out = []) {
  for (const e of await readdir(join(racine, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const rel = dir ? dir + sep + e.name : e.name;
    if (e.isDirectory()) await fichiers(rel, out);
    else if (/\.(m?js)$/.test(e.name)) out.push(rel);
  }
  return out;
}

const erreurs = [];
const avertissements = [];

const liste = await fichiers(dossierCode);
for (const rel of liste) {
  // Chemin du fichier relativement au code (c'est ce que lisent les exemptions).
  const chemin = dossierCode === "." ? rel : rel.split(sep).slice(1).join(sep);
  const ex = exempt(chemin);
  const lignes = (await readFile(join(racine, rel), "utf8")).split("\n");
  lignes.forEach((ligne, i) => {
    const n = i + 1;
    // `debugger` est cherché partout SAUF dans l'outillage, où le mot vit dans
    // les règles elles-mêmes (ce fichier).
    if (!chemin.startsWith("scripts" + sep) && /\bdebugger\b/.test(ligne)) erreurs.push(`${rel}:${n} — « debugger »`);
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
