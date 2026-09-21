// ============================================================================
// Vérification de syntaxe de TOUT le JavaScript du dépôt — `npm run lint`.
//
// Sans aucune dépendance : `node --check` PARSE un fichier sans l'exécuter.
// C'est le minimum qu'une chaîne d'intégration doit garantir — du JavaScript
// qui ne se parse pas ne s'exécute pas, et rien ne le signale avant l'écran
// blanc. Ce contrôle attrape donc la faute de frappe, la parenthèse fermante
// manquante, la virgule de trop, la chaîne non terminée.
//
// Le dépôt est un dépôt de modules ES (`"type": "module"` à la racine) : les
// fichiers `.js` sont donc lus dans la syntaxe des modules, comme le fait le
// navigateur pour le `<script type="module">` de l'application.
//
//   node scripts/verifier-syntaxe.mjs
//
// Sortie : une ligne par fichier fautif, et un code de sortie 1 s'il y en a.
// ============================================================================
import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const IGNORES = new Set(["node_modules", ".git", ".github"]);
const EXTENSIONS = new Set([".js", ".mjs"]);

async function* parcourir(dossier) {
  let entrees;
  try { entrees = await readdir(dossier, { withFileTypes: true }); }
  catch { return; }
  for (const entree of entrees) {
    if (IGNORES.has(entree.name)) continue;
    const chemin = resolve(dossier, entree.name);
    if (entree.isDirectory()) yield* parcourir(chemin);
    else if (EXTENSIONS.has(extname(entree.name))) yield chemin;
  }
}

let controles = 0;
const fautes = [];
for await (const chemin of parcourir(RACINE)) {
  controles += 1;
  const res = spawnSync(process.execPath, ["--check", chemin], { encoding: "utf8" });
  if (res.status !== 0) {
    const erreur = String(res.stderr || "").trim().split("\n").slice(0, 6).join("\n");
    fautes.push({ fichier: relative(RACINE, chemin), erreur });
  }
}

if (fautes.length) {
  console.error(`Syntaxe : ${fautes.length} fichier(s) fautif(s) sur ${controles} contrôle(s).\n`);
  for (const f of fautes) console.error(`— ${f.fichier}\n${f.erreur}\n`);
  process.exit(1);
}
console.log(`Syntaxe : ${controles} fichier(s) contrôlé(s), aucune faute.`);
