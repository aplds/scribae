#!/usr/bin/env node
// ============================================================================
// Régénère LA FICHE D'IDENTITÉ DU SERVICE — `node scripts/generer-logiciel.mjs`.
//
// Les sources de vérité sont `src/lib/version.js` (la version et sa date) et
// `src/lib/logiciel.js` (le nom, la licence, la documentation) : ce script en
// écrit le miroir `src/server/mysql/logiciel-engendre.mjs`, que le service lit
// au démarrage pour sa bannière. On ne modifie donc JAMAIS ce miroir à la main :
// on change la source, puis on régénère.
//
// POURQUOI UN MIROIR, ET NON UN SIMPLE IMPORT. L'image du SERVICE se construit
// sur le SEUL dossier `src/server/mysql/` (voir `mysql/Dockerfile`, et les deux
// `docker-compose*.yml`, qui déclarent `build: ./mysql`) : elle ne contient pas
// `src/lib/`. Or la bannière de démarrage doit annoncer la version RÉELLE — une
// valeur recopiée à la main se périmerait à la livraison suivante, et un journal
// qui annonce une fausse version est pire qu'un journal muet. Le miroir est donc
// ENGENDRÉ, et l'épreuve `logiciel-engendre.test.mjs` refuse qu'il diverge.
//
// La racine du code est CONSTATÉE, jamais supposée (`racine-code.mjs`) : le
// script s'exécute aussi bien depuis la racine du dépôt, où le code vit sous
// `src/`, que depuis l'atelier, où tout voisine sous `src/`.
//
// Il n'y a rien à installer : les deux sources sont des modules purs.
// ============================================================================
import { writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { RACINE_CODE, RACINE_OUTILLAGE } from "./racine-code.mjs";

const { APP_VERSION, APP_RELEASED, versionLabel } = await import(pathToFileURL(join(RACINE_CODE, "lib", "version.js")).href);
const { APP_NAME, LICENCE, DOCUMENTATION } = await import(pathToFileURL(join(RACINE_CODE, "lib", "logiciel.js")).href);

const cible = join(RACINE_CODE, "server", "mysql", "logiciel-engendre.mjs");

const declaration = (nom, valeur) => `export const ${nom} = ${JSON.stringify(valeur)};`;

const texte = [
  "// FICHIER ENGENDRÉ par `node scripts/generer-logiciel.mjs` — ne pas modifier à la main.",
  "//",
  "// Il reproduit, pour le SERVICE, ce que le logiciel dit de lui-même : son nom, sa version,",
  "// sa licence et sa documentation. Les sources de vérité sont `src/lib/version.js` et",
  "// `src/lib/logiciel.js` ; l'épreuve `logiciel-engendre.test.mjs` refuse un miroir qui aurait",
  "// divergé. Pourquoi un miroir, plutôt qu'un import : l'image du service se construit sur le",
  "// seul dossier `src/server/mysql/`, qui ne contient ni `src/lib/`, ni cette documentation.",
  "",
  declaration("APP_NAME", APP_NAME),
  declaration("APP_VERSION", APP_VERSION),
  declaration("VERSION_LABEL", versionLabel(APP_VERSION)),
  declaration("APP_RELEASED", APP_RELEASED),
  declaration("LICENCE", LICENCE),
  declaration("DOCUMENTATION", DOCUMENTATION),
  "",
].join("\n");

await writeFile(cible, texte, "utf8");

console.log(`${APP_NAME} ${versionLabel(APP_VERSION)} → ${relative(RACINE_OUTILLAGE, cible)}`);
