// ============================================================================
// Le papier des documents : A4 (21 × 29,7 cm).
//
// Tous les documents produits par l'application — aperçu de rédaction, HTML
// autonome, fichier Word, impression et PDF, original signé, version en ligne
// publiée — sont des actes administratifs français : ils se présentent sur du
// papier A4 avec les mêmes marges. Ces valeurs sont la source unique de cette
// règle ; `src/css/app.css` reprend les mêmes nombres pour l'aperçu de
// l'application (elle ne peut pas importer un module).
//
// Marges : 2 cm en haut et en bas, 1,8 cm à gauche et à droite — soit, pour
// l'imprimante, `margin:20mm 18mm`. C'est ce qui fait que l'aperçu à l'écran et
// le PDF se superposent au millimètre.
//
// Ces valeurs sont le DÉFAUT : une feuille de style (charte graphique) peut
// donner ses propres marges au papier (`pageMarginTop`…), et c'est alors elle
// qui s'applique — à l'écran (`--paper-pad`), dans le HTML autonome, dans le
// fichier Word et dans le PDF (voir `paperMargins`/`paperPageCss`, styles.js).
// ============================================================================

export const A4_WIDTH = "21cm";
export const A4_HEIGHT = "29.7cm";
export const A4_MARGIN = "2cm 1.8cm";
export const A4_MARGIN_PRINT = "20mm 18mm";

// L'en-tête de page : c'est lui qui garantit le format (et non le contenu).
export const A4_PAGE_CSS = `@page{size:A4 portrait;margin:${A4_MARGIN_PRINT}}`;

// Ce qu'un saut de page ne doit pas abîmer : un titre seul en bas de page, une
// signature détachée de son bloc, une ligne de tableau coupée en deux. Les deux
// écritures (`break-*` et `page-break-*`) sont données : selon la version, les
// moteurs d'impression n'honorent que l'une des deux.
export const A4_BREAK_CSS = `
.doc-title,.doc-article-head,.doc-enact,.doc-signature,.doc-consolidation,.doc-trail__entry,.doc-amend-mention{break-after:avoid;page-break-after:avoid}
.doc-title,.doc-signature,.doc-consolidation,.doc-trail__entry,.doc-table-caption,.doc-amend-mention{break-inside:avoid;page-break-inside:avoid}
tr{break-inside:avoid;page-break-inside:avoid}
.doc-p,.doc-list li,.doc-mention{orphans:2;widows:2}
.doc-trail__table thead{display:table-header-group}
`;
