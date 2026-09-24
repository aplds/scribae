#!/usr/bin/env node
// ============================================================================
// Régénère LA RÉFÉRENCE DE L'API REST — `node scripts/generer-api.mjs`.
//
// La description (`src/lib/api-reference.js`) est la source de vérité : ce
// script en déroule le Markdown dans `src/docs/API.md`, que l'application rend
// dans « Documentation technique › API REST » et dont s'inspire l'écran du même
// nom. On ne modifie donc JAMAIS `API.md` à la main : on ajoute ou corrige une
// opération, puis on régénère.
//
// La racine du code est CONSTATÉE, jamais supposée (`racine-code.mjs`) : le
// script s'exécute aussi bien depuis la racine du dépôt, où le code vit sous
// `src/`, que depuis l'atelier, où tout voisine sous `src/`.
//
// Il n'y a rien à installer : la description est un module pur, sans dépendance.
// ============================================================================
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { RACINE_CODE, RACINE_OUTILLAGE } from "./racine-code.mjs";

const { API_REFERENCE, GROUPES_API, markdownApi } = await import(pathToFileURL(join(RACINE_CODE, "lib", "api-reference.js")).href);
const cible = join(RACINE_CODE, "docs", "API.md");

await writeFile(cible, markdownApi() + "\n", "utf8");

console.log(
  `API : ${API_REFERENCE.length} opération(s) décrite(s) sur ${GROUPES_API.length} groupe(s) `
  + `→ ${relative(RACINE_OUTILLAGE, cible)}`,
);
