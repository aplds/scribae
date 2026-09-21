// ============================================================================
// Importer un document Word (.docx) ou LibreOffice (.odt) COMME TRAME.
//
// Beaucoup d'administrations tiennent déjà leurs modèles d'actes dans un
// traitement de texte : « notre arrêté de délégation, c'est ce fichier-là ».
// Retaper ce document dans l'éditeur de trames serait absurde. L'import le
// relit, en reconnaît la structure (autorité, intitulé, visas, considérants,
// formule d'édiction, articles, listes, tableaux, mentions, signature), et en
// propose une TRAME — voir src/lib/doc-import.js, qui fait la lecture.
//
// L'import n'ENREGISTRE rien. Trois raisons, et elles tiennent toutes :
//   • une trame est un modèle officiel ; un document reçu par courriel n'entre
//     pas au registre sans qu'un humain l'ait relu ;
//   • la relecture automatique se trompe (elle le dit elle-même, point par
//     point) et l'éditeur doit pouvoir corriger dans l'éditeur de trames ;
//   • l'éditeur veut parfois simplement voir ce que la machine a compris pour
//     décider que non, et jeter le document.
// La trame proposée vit donc dans `state.trameImport`, s'ouvre sous l'adresse
// réservée `trame/__import__`, et l'éditeur la garde ou l'abandonne (voir
// ui/views/editor.js, qui affiche la bannière et les deux gestes).
// ============================================================================
import { state, navigate } from "./state.js";
import { h, button, modal, toast } from "./dom.js";
import { trameDepuisFichier, LIBELLE_FORMAT } from "../lib/doc-import.js";
import { authorLabel } from "../lib/scope.js";

// L'adresse réservée de la trame en cours d'import : elle n'est pas encore au
// registre, donc elle n'a pas d'identifiant. Aucune collision possible — les
// identifiants du registre sont des « tpl-… ».
export const IMPORT_ID = "__import__";

// La trame proposée par l'import en cours, ou null. C'est ce que l'éditeur
// ouvre quand on lui demande `trame/__import__`.
export const trameImportee = () => (state.trameImport && state.trameImport.trame) || null;

// Enregistrer la trame importée : elle entre au registre en BROUILLON. Elle
// reste donc invisible des services jusqu'à ce qu'un éditeur la mette à
// disposition — un document importé n'est jamais un modèle publié d'office.
export function enregistrerImport() {
  const imp = state.trameImport;
  if (!imp || !imp.trame) return null;
  const t = imp.trame;
  state.trameImport = null;
  state.trames.push(t);
  return t;
}

// Abandonner l'import : la trame proposée est oubliée. Rien n'ayant été
// enregistré, il n'y a rien à défaire — et rien à demander à l'utilisateur.
export function abandonnerImport() {
  state.trameImport = null;
  state.editor = null;
}

// Lit un document et ouvre la trame proposée dans l'éditeur. Rend la trame
// proposée, ou null si le document n'a pas pu être relu (l'obstacle est montré).
export async function importerTrameDocument(fichier) {
  const attente = modal({
    title: "Lecture du document…",
    body: h("div", {},
      h("p", { class: "fr-small fr-muted docs-loading" },
        h("span", { class: "spinner", "aria-hidden": "true" }),
        " Relecture de « " + fichier.name + " »…"),
      h("p", { class: "fr-small fr-muted", text: "L'application y cherche la structure d'un acte administratif : autorité, intitulé, visas, considérants, formule d'édiction, articles, listes, tableaux, mentions de recours et signature." })),
  });
  // Un tour de peinture avant le travail : sans cela, un document relu en
  // quelques millisecondes n'afficherait jamais son attente (et un gros
  // document, lui, afficherait un écran figé).
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  let res;
  try {
    res = await trameDepuisFichier(fichier, { config: state.config, owner: authorLabel(state.config, state.user) || "" });
  } catch (e) {
    attente.close();
    modal({
      title: "Import impossible",
      body: h("div", { class: "fr-stack" },
        h("p", { text: "Le document n'a pas pu être relu." }),
        h("p", { class: "fr-small fr-muted", text: String((e && e.message) || e) }),
        h("p", { class: "fr-small fr-muted", text: "Formats acceptés : document Word (.docx) et document LibreOffice (.odt). Un fichier .doc (ancien format) ou un .odt exporté en « texte » ne contient pas la structure d'un document : il ne peut pas être relu." })),
      actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
    });
    return null;
  }
  attente.close();

  const libelle = LIBELLE_FORMAT[res.kind] || "document";
  if (!res.trame) {
    modal({
      title: "Ce document n'a pas pu être mis en trame",
      body: h("div", { class: "fr-stack" },
        h("p", { text: `Le ${libelle} a bien été lu, mais il n'en est pas sorti une trame utilisable :` }),
        ...res.issues.slice(0, 12).map((m) => h("p", { class: "fr-small", text: "• " + m })),
        h("p", { class: "fr-small fr-muted", text: "Le document ne contient peut-être aucun texte (image seule, tableau vide), ou son contenu est illisible. Rien n'a été enregistré." })),
      actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
    });
    return null;
  }

  state.trameImport = { trame: res.trame, fichier: fichier.name, kind: res.kind };
  // L'éditeur doit s'ouvrir sur la trame PROPOSÉE, pas sur celle qu'on éditait
  // avant : on repart d'un état d'éditeur neuf (même règle que `resetDraft`).
  state.editor = null;
  navigate("trame/" + IMPORT_ID);

  const points = [...res.issues, ...res.avertissements];
  if (points.length) {
    modal({
      title: "Points à vérifier",
      body: h("div", { class: "fr-stack" },
        h("p", { text: `Ce ${libelle} a été relu et proposé en trame. La lecture est automatique : voici ce qui mérite votre œil avant d'enregistrer quoi que ce soit.` }),
        ...points.slice(0, 12).map((m) => h("p", { class: "fr-small", text: "• " + m })),
        points.length > 12 ? h("p", { class: "fr-small fr-muted", text: `… et ${points.length - 12} autre(s).` }) : null,
        h("p", { class: "fr-small fr-muted", text: "Rien n'est enregistré pour l'instant : la trame est ouverte dans l'éditeur, où vous pouvez la corriger, puis l'enregistrer." })),
      actions: (close) => [button("Voir la trame proposée", { variant: "primary", icon: "doc", onClick: close })],
    });
  } else {
    toast("Document relu : la trame est proposée, à vous de l'enregistrer", "info");
  }
  return res.trame;
}
