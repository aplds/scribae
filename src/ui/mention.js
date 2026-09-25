// ============================================================================
// La mention de l'éditeur du logiciel : « Propulsé par Scribae — GPLv3 ».
//
// Scribae est un logiciel libre (GPL-3.0) : ses pieds de page — celui du recueil
// public, celui de l'atelier et celui de l'écran de connexion — disent d'où il
// vient, et renvoient vers sa documentation. C'est une politesse, et la trace de
// provenance que la licence demande à qui REDISTRIBUE le logiciel.
//
// Le réglage `config.brand.mentionScribae` permet à une collectivité de
// l'éteindre : un site public a sa charte, et peut être intégré dans un portail
// qui porte déjà la mention (voir Administration › Identité, et
// `src/ui/views/referentiel.js`).
//
// Le texte est écrit ICI, une seule fois : les trois pieds de page le lisent
// d'ici, et ne peuvent donc pas diverger.
//
// La licence et l'adresse de la documentation, elles, appartiennent à l'identité
// du logiciel (`src/lib/logiciel.js`) : la bannière de démarrage du service les
// affiche aussi, et un exploitant ne doit pas lire deux adresses différentes
// selon qu'il regarde le journal du conteneur ou le bas d'une page.
// ============================================================================
import { h } from "./dom.js";
import { state } from "./state.js";
import { APP_NAME, LICENCE, DOCUMENTATION } from "../lib/logiciel.js";

// Réexportés : les pieds de page, et la documentation du projet, les nomment par
// ce module.
export { LICENCE, DOCUMENTATION };

// Le réglage vit dans le référentiel (il suit donc les données exportées et
// importées), et vaut « affichée » tant qu'il n'a pas été éteint : une
// installation qui n'y a jamais touché porte la mention.
export const mentionAffichee = () => state.config?.brand?.mentionScribae !== false;

// Le contenu de la mention — le texte et son lien —, sans son contenant :
// chaque pied de page le pose dans l'élément qui lui convient.
export function contenuMention() {
  return [
    h("span", { text: "Propulsé par " }),
    h("a", {
      class: "mention-editeur__lien",
      href: DOCUMENTATION,
      target: "_blank",
      rel: "noopener noreferrer",
      title: "Documentation de " + APP_NAME,
      text: APP_NAME,
    }),
    h("span", { text: " — " + LICENCE }),
  ];
}
