// ============================================================================
// Identité du logiciel : Scribae (nom + marque).
//
// La marque est une forme pleine : le document porte la couleur, le chevron est
// une découpe (le fond apparaît au travers). Une seule teinte, héritée du
// contexte (currentColor) : elle tient donc sur fond clair comme sur fond
// sombre, sans halo ni second ton. À l'impression, le noir du texte suffit.
//
// Le NOM, lui, ne s'écrit pas ici : il appartient à l'identité du logiciel
// (`src/lib/logiciel.js`), avec la licence et la documentation, parce que le
// service et l'outillage de génération le lisent aussi — et qu'il n'y a pas
// deux vérités pour un nom. On le réexporte pour que l'interface n'ait qu'un
// module d'identité à connaître.
//
// Pour changer de devise ou de marque, tout passe par ce fichier (et par
// `$meta` dans main.pjs pour le titre de la page).
// ============================================================================
export { APP_NAME } from "../lib/logiciel.js";
export const APP_TAGLINE = "Trames, rédaction et publication des actes administratifs";

const DOC = "M12 2H37L57 22V53A9 9 0 0 1 48 62H12A9 9 0 0 1 3 53V11A9 9 0 0 1 12 2Z";
const CHEVRON = '<path d="M20 47 33 21 46 47" fill="none" stroke="#000" stroke-width="9.5" stroke-linecap="round" stroke-linejoin="round"/>';

let seq = 0;

// Marque seule, en SVG en ligne : la couleur suit `currentColor`.
export function markSvg(size = 32) {
  const id = "sp-marque-" + (seq++);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="' + size + '" height="' + size + '" aria-hidden="true" focusable="false">'
    + '<defs><mask id="' + id + '"><rect width="64" height="64" fill="#000"/>'
    + '<path d="' + DOC + '" fill="#fff"/>' + CHEVRON + '</mask></defs>'
    + '<rect width="64" height="64" fill="currentColor" mask="url(#' + id + ')"/></svg>';
}

export function markEl(size = 32) {
  const box = document.createElement("span");
  box.className = "app-mark";
  box.innerHTML = markSvg(size);
  return box;
}

// Même marque en data URL, à teinte fixe : favicon (voir index.html), image de
// partage, ou tout autre contexte où `currentColor` ne serait pas défini.
export function markDataUrl(color = "#000091") {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" color="' + color + '">'
    + '<defs><mask id="sp-favicon"><rect width="64" height="64" fill="#000"/>'
    + '<path d="' + DOC + '" fill="#fff"/>' + CHEVRON + '</mask></defs>'
    + '<rect width="64" height="64" fill="currentColor" mask="url(#sp-favicon)"/></svg>';
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
