// ============================================================================
// Bandeaux de tête : démonstration, et référentiel vierge.
//
// DÉMONSTRATION. Elle est décidée par le DÉPLOIEMENT (`.env`, `DEMO`), jamais par
// ce fichier : `demoActif()` est la seule source de vérité (src/lib/demo.js). Le
// réglage `config.brand.demo` n'en est qu'un miroir. Quand la démonstration est
// éteinte, aucun bandeau de ce genre n'a de raison d'être — et l'application ne
// doit laisser AUCUNE trace de la collectivité fictive.
//
// RÉFÉRENTIEL VIERGE. Démonstration éteinte et référentiel neuf : l'outil n'a
// rien à montrer tant que l'administrateur n'a pas bâti son référentiel (identité,
// entités, services, rôles, personnes…). Le premier écran le DIT et propose le
// premier pas, plutôt que de laisser des écrans vides qu'on confondrait avec une
// panne.
//
// Le texte de la mention de démonstration est modifiable (brand.demoText) : une
// installation peut préférer « Recette », « Bac à sable », etc.
// ============================================================================
import { h, icon, button } from "./dom.js";
import { state, navigate } from "./state.js";
import { demoActif, referentielVierge } from "../lib/demo.js";

export const DEMO_TEXT = "Installation de démonstration : les données sont fictives, la signature électronique est simulée. Ne pas produire d'actes réels avec cette installation.";

export const isDemo = () => demoActif(state.config);

export function demoNotice(extra) {
  if (!isDemo()) return null;
  return h("div", { class: "app-demo" },
    h("span", { class: "app-demo__tag" }, icon("info", 13), h("span", { text: "Démonstration" })),
    h("span", { class: "app-demo__text", text: state.config?.brand?.demoText || DEMO_TEXT }),
    extra || null,
  );
}

// L'invitation du premier écran : « votre référentiel est vierge, commencez
// ici ». Rendue une seule fois que le référentiel soit vide, et seulement hors
// démonstration — un référentiel de fiction n'est pas vierge.
export function viergeNotice(extra) {
  if (isDemo() || !state.config) return null;
  if (!referentielVierge(state.config)) return null;
  return h("div", { class: "app-vierge" },
    h("span", { class: "app-vierge__tag" }, icon("info", 13), h("span", { text: "Référentiel vierge" })),
    h("span", { class: "app-vierge__text", text: "Cette installation n'a pas encore de référentiel : ni identité, ni entité, ni service, ni personne. Commencez par Administration › Identité, puis Entités, Services, Rôles et Personnes — les trames viendront ensuite." }),
    extra !== undefined ? extra : button("Commencer", { variant: "tertiary", size: "sm", onClick: () => navigate("referentiel") }),
  );
}
