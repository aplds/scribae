#!/usr/bin/env node
// ============================================================================
// Régénère LA RÉFÉRENCE DE L'API REST — `node src/scripts/generer-api.mjs`.
//
// La description (`src/lib/api-reference.js`) est la source de vérité : ce script
// en déroule le Markdown dans `src/docs/API.md`, que l'application rend dans
// « Documentation technique › API REST » et dont s'inspire l'écran du même nom.
// On ne modifie donc JAMAIS `API.md` à la main : on ajoute ou corrige une
// opération, puis on régénère.
//
// Il n'y a rien à installer : la description est un module pur, sans dépendance.
// ============================================================================
import { writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { API_REFERENCE, GROUPES_API, markdownApi } from "../lib/api-reference.js";

const racine = fileURLToPath(new URL("..", import.meta.url));
const cible = new URL("../docs/API.md", import.meta.url);

await writeFile(cible, markdownApi() + "\n", "utf8");

console.log(
  `API : ${API_REFERENCE.length} opération(s) décrite(s) sur ${GROUPES_API.length} groupe(s) `
  + `→ ${relative(racine, fileURLToPath(cible))}`,
);
