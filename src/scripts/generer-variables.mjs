#!/usr/bin/env node
// ============================================================================
// Régénère le WIKI DES VARIABLES — `node src/scripts/generer-variables.mjs`.
//
// Le registre (`src/server/mysql/variables.mjs`) est la source de vérité : ce
// script en déroule le Markdown dans `src/docs/VARIABLES.md`, que l'application
// rend dans « Documentation technique › Variables de déploiement ». On ne
// modifie donc JAMAIS `VARIABLES.md` à la main : on ajoute ou corrige un
// descripteur, puis on régénère.
//
// Il n'y a rien à installer : le registre est un module pur, sans dépendance.
// ============================================================================
import { writeFile } from "node:fs/promises";
import { relative } from "node:path";
import { fileURLToPath } from "node:url";
import { VARIABLES, wikiMarkdown } from "../server/mysql/variables.mjs";

const racine = fileURLToPath(new URL("..", import.meta.url));
const cible = new URL("../docs/VARIABLES.md", import.meta.url);

await writeFile(cible, wikiMarkdown() + "\n", "utf8");

const referentiel = VARIABLES.filter((v) => v.portee === "referentiel").length;
const service = VARIABLES.length - referentiel;
console.log(
  `Variables : ${VARIABLES.length} décrite(s) (${referentiel} de référentiel, ${service} de service) `
  + `→ ${relative(racine, fileURLToPath(cible))}`,
);
