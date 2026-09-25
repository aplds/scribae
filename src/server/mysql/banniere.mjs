// ============================================================================
// La bannière de démarrage du service : ce que `docker logs` montre en premier.
//
// POURQUOI ELLE EXISTE. Le journal du conteneur est la première chose qu'un
// exploitant ouvre, et la seule qui dise d'un coup d'œil QUELLE version tourne,
// sous QUELLE licence et OÙ se trouve la documentation — trois questions qu'on
// se pose précisément quand quelque chose ne va pas. La réponse est écrite en
// tête du journal, avant les messages d'état, plutôt que dispersée dans une
// page d'administration qu'il faut d'abord atteindre.
//
// POURQUOI EN ASCII. Un journal se lit dans un terminal étroit, se copie dans un
// rapport de panne et se relit dans un fichier de logs où les séquences ANSI ne
// sont plus interprétées. La marque et le titre sont donc dessinés en caractères
// d'imprimante — pas de couleur, pas de demi-bloc, pas de cadre Unicode —, et
// l'encadré tient sur 74 colonnes.
//
// CE QU'ELLE DIT, ELLE NE L'INVENTE PAS. Le nom, la version, la licence et
// l'adresse viennent de `logiciel-engendre.mjs`, engendré depuis `src/lib/`
// (`node scripts/generer-logiciel.mjs`) : la bannière ne peut donc pas annoncer
// une version que le logiciel n'est pas.
//
// LE NOM EST DESSINÉ, non composé à partir d'une chaîne : le titre du cadre est
// la marque du logiciel (« Scribae », en lettres d'imprimante). Renommer le
// logiciel demande donc de redessiner ce titre-là — voir `src/lib/logiciel.js`.
//
// Module PUR : il compose une chaîne, ne l'écrit nulle part, et ne touche ni au
// réseau, ni à la base, ni à la console. C'est `server.mjs` qui l'imprime.
// ============================================================================
import { VERSION_LABEL, LICENCE, DOCUMENTATION } from "./logiciel-engendre.mjs";

// La marque du logiciel — un document au coin coupé, frappé d'un chevron (voir
// `src/ui/brand.js`, qui en porte la version vectorielle). Chaque ligne est
// complétée par `banniere` : leur longueur n'a pas à être écrite à la main.
const MARQUE = [
  "  ____________",
  " |            \\",
  " |             \\",
  " |     /\\      |",
  " |    // \\\\    |",
  " |   //   \\\\   |",
  " |  //     \\\\  |",
  " |             |",
  " |_____________|",
];

// Le titre, en lettres d'imprimante. Un espace sépare les lettres : les glyphes
// portent déjà leur propre approche, et les coller les ferait se toucher. Les
// espaces FINAUX font partie du dessin — c'est l'approche du dernier glyphe, et
// donc la largeur du bloc, qui règle celle du cadre : ne les rognez pas.
const TITRE = [
  " ____                   _   _                     ",
  "/ ___|    ___    _ __  (_) | |__     __ _    ___  ",
  "\\___ \\   / __|  | '__| | | | '_ \\   / _` |  / _ \\ ",
  " ___) | | (__   | |    | | | |_) | | (_| | |  __/ ",
  "|____/   \\___|  |_|    |_| |_.__/   \\__,_|  \\___| ",
];

// L'adresse de la documentation, telle qu'elle s'affiche dans un journal : le
// schéma est en trop (on ne clique pas dans un journal) et ses huit caractères
// mangeraient la largeur du cadre.
const adresseCourte = (url) => String(url || "").replace(/^[a-z][a-z0-9+.-]*:\/\//i, "").replace(/\/+$/, "");

// La bannière, encadrée. Le nom n'est pas un paramètre : il est DESSINÉ dans le
// titre (voir plus haut). Les autres valeurs viennent du miroir engendré, et ne
// sont réglables que pour l'épreuve : un déploiement n'a jamais à les passer,
// sans quoi le journal annoncerait autre chose que ce que le logiciel est.
export function banniere({ version = VERSION_LABEL, licence = LICENCE, documentation = DOCUMENTATION } = {}) {
  const sous = [version, licence, adresseCourte(documentation)].filter(Boolean).join(" — ");
  const largeurMarque = Math.max(...MARQUE.map((l) => l.length));
  // Le cadre s'élargit si la ligne du bas dépasse le titre : un cadre ouvert
  // serait pire qu'un cadre un peu large.
  const largeurTexte = Math.max(...TITRE.map((l) => l.length), sous.length);
  const hauteurTexte = TITRE.length + 2;                        // titre, blanc, mention
  const hauteur = Math.max(MARQUE.length, hauteurTexte);
  const hautMarque = Math.floor((hauteur - MARQUE.length) / 2);
  const hautTexte = Math.floor((hauteur - hauteurTexte) / 2);
  // La largeur INTÉRIEURE du cadre : l'espace qui suit le bord, la marque, les
  // trois colonnes qui la séparent du texte, le texte, et les deux colonnes qui
  // le précèdent. Le bord, lui, s'ajoute de part et d'autre (voir les lignes).
  const dedans = 1 + largeurMarque + 3 + largeurTexte + 2;

  const lignes = ["+" + "-".repeat(dedans) + "+", "|" + " ".repeat(dedans) + "|"];
  for (let i = 0; i < hauteur; i++) {
    const k = i - hautMarque;
    const marque = k >= 0 && k < MARQUE.length ? MARQUE[k] : "";
    const j = i - hautTexte;
    const texte = j >= 0 && j < TITRE.length ? TITRE[j] : (j === TITRE.length + 1 ? sous : "");
    lignes.push("| " + marque.padEnd(largeurMarque) + "   " + texte.padEnd(largeurTexte) + "  |");
  }
  lignes.push("|" + " ".repeat(dedans) + "|", "+" + "-".repeat(dedans) + "+");
  return lignes.join("\n");
}
