// FICHIER ENGENDRÉ par `node scripts/generer-logiciel.mjs` — ne pas modifier à la main.
//
// Il reproduit, pour le SERVICE, ce que le logiciel dit de lui-même : son nom, sa version,
// sa licence et sa documentation. Les sources de vérité sont `src/lib/version.js` et
// `src/lib/logiciel.js` ; l'épreuve `logiciel-engendre.test.mjs` refuse un miroir qui aurait
// divergé. Pourquoi un miroir, plutôt qu'un import : l'image du service se construit sur le
// seul dossier `src/server/mysql/`, qui ne contient ni `src/lib/`, ni cette documentation.

export const APP_NAME = "Scribae";
export const APP_VERSION = "1.6.1w";
export const VERSION_LABEL = "v1.6.1w";
export const APP_RELEASED = "2026-09-29";
export const LICENCE = "GPLv3";
export const DOCUMENTATION = "https://doc.scribae.eu";
