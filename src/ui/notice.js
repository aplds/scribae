// ============================================================================
// Bandeau de démonstration.
//
// Il est affiché en tête de l'application tant que le référentiel ne dit pas le
// contraire : `brand.demo !== false`. L'administrateur le coupe depuis
// « Administration › Identité » au moment où l'installation est adaptée pour de
// vrai. Le réglage vit donc dans le référentiel : il voyage avec lui quand on
// exporte/importe les données, et une installation neuve repart avec le bandeau.
//
// Le texte est modifiable (brand.demoText) : une installation peut préférer
// « Recette », « Bac à sable », etc.
// ============================================================================
import { h, icon } from "./dom.js";
import { state } from "./state.js";

export const DEMO_TEXT = "Installation de démonstration : les données sont fictives, la signature électronique est simulée. Ne pas produire d'actes réels avec cette installation.";

export const isDemo = () => state.config?.brand?.demo !== false;

export function demoNotice(extra) {
  if (!isDemo()) return null;
  return h("div", { class: "app-demo" },
    h("span", { class: "app-demo__tag" }, icon("info", 13), h("span", { text: "Démonstration" })),
    h("span", { class: "app-demo__text", text: state.config?.brand?.demoText || DEMO_TEXT }),
    extra || null,
  );
}
