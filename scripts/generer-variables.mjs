#!/usr/bin/env node
// ============================================================================
// Régénère le WIKI DES VARIABLES — `node scripts/generer-variables.mjs`.
//
// Le registre (`src/server/mysql/variables.mjs`) est la source de vérité : ce
// script en déroule le Markdown dans `src/docs/VARIABLES.md`, que l'application
// rend dans « Documentation technique › Variables de déploiement ». On ne
// modifie donc JAMAIS `VARIABLES.md` à la main : on ajoute ou corrige un
// descripteur, puis on régénère.
//
// La racine du code est CONSTATÉE, jamais supposée (`racine-code.mjs`) : le
// script s'exécute aussi bien depuis la racine du dépôt, où le code vit sous
// `src/`, que depuis l'atelier, où tout voisine sous `src/`.
//
// Il n'y a rien à installer : le registre est un module pur, sans dépendance.
// ============================================================================
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { RACINE_CODE, RACINE_OUTILLAGE } from "./racine-code.mjs";

const { VARIABLES, wikiMarkdown } = await import(pathToFileURL(join(RACINE_CODE, "server", "mysql", "variables.mjs")).href);
const cible = join(RACINE_CODE, "docs", "VARIABLES.md");

await writeFile(cible, wikiMarkdown() + "\n", "utf8");

const referentiel = VARIABLES.filter((v) => v.portee === "referentiel").length;
const service = VARIABLES.length - referentiel;
console.log(
  `Variables : ${VARIABLES.length} décrite(s) (${referentiel} de référentiel, ${service} de service) `
  + `→ ${relative(RACINE_OUTILLAGE, cible)}`,
);
