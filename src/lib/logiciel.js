// ============================================================================
// L'identité du LOGICIEL — à ne pas confondre avec celle de la COLLECTIVITÉ, qui
// vit dans le référentiel (Administration › Identité).
//
// Trois constantes, écrites ici UNE SEULE FOIS : le nom sous lequel le logiciel
// se présente, la licence sous laquelle il est publié, et l'adresse de sa
// documentation. Les trois pieds de page de l'application (« Propulsé par
// Scribae — GPLv3 », voir `src/ui/mention.js`), la marque (`src/ui/brand.js`) et
// la bannière de démarrage du service (`src/server/mysql/banniere.mjs`) les
// lisent d'ici : ils ne peuvent donc pas diverger.
//
// Module PUR, sans aucune dépendance — ni DOM, ni réseau, ni autre module. C'est
// ce qui permet à l'outillage de génération (`scripts/generer-logiciel.mjs`) et
// au service de le lire, sans embarquer l'application.
//
// Pour changer de nom, de licence ou d'adresse de documentation, tout passe par
// ce fichier (et par `$meta` dans main.pjs pour le titre de la page).
// ============================================================================

// Le nom du logiciel, tel qu'il s'affiche : interface, pieds de page, bannière
// de démarrage, titre de la page.
export const APP_NAME = "Scribae";

// La licence du LOGICIEL. Le texte intégral vit dans `LICENSE`, à la racine du
// dépôt (voir `src/LICENSE.md`, qui arbitre aussi ce qui n'en relève pas : les
// actes publiés sont des données publiques, sous Licence Ouverte par défaut).
export const LICENCE = "GPLv3";

// Où le logiciel s'explique : sa documentation d'installation et d'usage. C'est
// l'adresse que portent les pieds de page de l'application et la bannière de
// démarrage du service — celle qu'un exploitant relèvera dans un journal.
export const DOCUMENTATION = "https://doc.scribae.eu";
