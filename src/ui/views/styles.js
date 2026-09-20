// ============================================================================
// Feuilles de style — la charte graphique des décisions.
//
// L'écran présente la **feuille générale** et les **sous-feuilles**, et laisse
// régler chacune. Deux façons de faire, pour deux façons de travailler :
//
//   • « Réglages » — tous les réglages, groupés par thème (papier, typographie,
//     intitulé, visas, tableaux, signature…). C'est la vue exhaustive.
//   • « Édition directe » — on clique l'élément dans l'aperçu (l'intitulé, un
//     tableau, l'en-tête, le bloc de signature…) et seuls les réglages de CET
//     élément apparaissent. C'est un éditeur sur le **style uniquement** : le
//     texte de l'acte n'est jamais modifiable ici, et l'aperçu est le vrai
//     rendu (le même code que le PDF, l'export Word et la version publiée).
//
// Les deux vues sont pilotées par le MÊME schéma (`GROUPS`, `REGIONS`) : ajouter
// un réglage se fait à deux endroits seulement — le modèle et le CSS
// (`src/lib/styles.js`), puis sa description ici. Le principe reste celui du
// reste de l'application : rien n'est codé — la feuille est une **donnée du
// référentiel**, éditable et exportable.
// ============================================================================
import { state, touch, applyBrand, redrawView } from "../state.js";
import { h, clear, button, toast, field as frField, fitPaper } from "../dom.js";
import { textField, selectField, choiceField, fontField, confirmDialog, helpLink, emptyState } from "../components.js";
import { download, pickFile } from "../../lib/util.js";
import {
  emptyStyle, stylesOf, styleSummary, styleTraits, sampleDocument, generalStyle, STYLE_PRESETS, applyPreset,
} from "../../lib/styles.js";
import { renderDocument, applyPaper } from "../../lib/render.js";

// ------------------------------------------------------------- schéma
// Un champ : `key` du modèle, libellé, type, et le cas échéant ses options.
// `wide` : le champ occupe les deux colonnes (libellés longs, textes libres).
const f = (key, label, kind, opts = {}) => ({ key, label, kind, ...opts });

const SELECTS = {
  titreAlign: [{ value: "left", label: "À gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "À droite" }],
  titreRule: [{ value: "none", label: "Aucune marque" }, { value: "line", label: "Filet simple" }, { value: "double", label: "Filet double" }, { value: "underline", label: "Souligné" }, { value: "box", label: "Encadré" }],
  ruleStyle: [{ value: "line", label: "Trait simple" }, { value: "double", label: "Trait double" }, { value: "dotted", label: "Pointillé" }, { value: "none", label: "Aucun" }],
  divider: [{ value: "none", label: "Aucun filet" }, { value: "line", label: "Filet simple" }, { value: "dotted", label: "Pointillé" }, { value: "double", label: "Filet double" }],
  ecks: [{ value: "plain", label: "Texte seul" }, { value: "rule", label: "Entre deux filets" }, { value: "band", label: "Bandeau" }, { value: "box", label: "Encadré" }],
  mention: [{ value: "plain", label: "Texte seul" }, { value: "left", label: "Filet à gauche" }, { value: "box", label: "Encadré" }, { value: "tinted", label: "Fond coloré" }],
  table: [{ value: "grid", label: "Grille complète" }, { value: "rows", label: "Lignes seules" }, { value: "zebra", label: "Lignes alternées" }],
  signAlign: [{ value: "right", label: "À droite" }, { value: "left", label: "À gauche" }],
  signStyle: [{ value: "plain", label: "Texte seul" }, { value: "line", label: "Ligne de signature" }, { value: "box", label: "Encadré" }],
  logoAlign: [{ value: "left", label: "À gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "À droite" }],
  frame: [{ value: "none", label: "Aucun" }, { value: "line", label: "Filet simple" }, { value: "double", label: "Filet double" }, { value: "heavy", label: "Filet épais" }],
  numPosition: [{ value: "inline", label: "À la suite du titre" }, { value: "block", label: "Au-dessus du titre" }, { value: "margin", label: "Dans la marge de gauche" }],
  headingRule: [{ value: "none", label: "Aucune" }, { value: "line", label: "Filet simple" }, { value: "dotted", label: "Souligné pointillé" }, { value: "box", label: "Encadré" }],
  visasLabel: [{ value: "plain", label: "Normal" }, { value: "italic", label: "Italique" }, { value: "bold", label: "Gras" }, { value: "smallcaps", label: "Petites capitales" }],
  listMarker: [{ value: "disc", label: "Puces ●" }, { value: "circle", label: "Cercle ○" }, { value: "square", label: "Carré ▪" }, { value: "dash", label: "Tiret –" }, { value: "none", label: "Aucune" }],
  listNumbering: [
    { value: "decimal", label: "1. 2. 3." },
    { value: "degree", label: "1° 2° 3°" },
    { value: "parenth", label: "1) 2) 3)" },
    { value: "lalpha", label: "a) b) c)" },
    { value: "ualpha", label: "A) B) C)" },
    { value: "lroman", label: "i. ii. iii." },
    { value: "uroman", label: "I. II. III." },
    { value: "none", label: "Aucune" },
  ],
  align3: [{ value: "left", label: "À gauche" }, { value: "center", label: "Centré" }, { value: "right", label: "À droite" }],
  weight: [{ value: "400", label: "Normal" }, { value: "600", label: "Semi-gras" }, { value: "700", label: "Gras" }],
};

const YES_NO = [{ value: true, label: "Oui" }, { value: false, label: "Non" }];
const TOKENS = "Jetons disponibles : {{entity.name}}, {{entity.nameWithArt}}, {{entity.code}}, {{brand.name}}, {{numero}}, {{objet}}, {{dateSignature}}, {{date}}, {{actType}}, {{style.label}}.";
const FONT_HELP = "Les polices proposées, rangées par familles — des polices répandues sur les postes, disponibles sans rien installer. La police choisie est celle de l'écran, du PDF, du fichier Word et de la version publiée ; « Autre » permet d'indiquer une police de la collectivité ou une pile CSS complète.";
const SIDES_HELP = "Les côtés tracés autour de l'encadré. Sans effet tant que la présentation ci-dessus n'est pas « Encadré » — un filet se pose ainsi d'un seul côté, ou l'encadré s'ouvre.";

const GROUPS = [
  {
    id: "papier", title: "Papier et marges",
    sub: "Le format est A4. Les marges s'appliquent à l'aperçu, au PDF, au fichier Word et à la version publiée.",
    fields: [
      f("pageMarginTop", "Marge du haut (mm)", "num"),
      f("pageMarginBottom", "Marge du bas (mm)", "num"),
      f("pageMarginLeft", "Marge de gauche (mm)", "num"),
      f("pageMarginRight", "Marge de droite (mm)", "num"),
    ],
  },
  {
    id: "cadre", title: "Cadre de page",
    sub: "Un filet autour du document — la marque des actes solennels.",
    fields: [
      f("frameStyle", "Cadre", "select", { options: SELECTS.frame }),
      f("frameWidth", "Épaisseur du cadre (px)", "num"),
      f("frameSpace", "Espace entre le cadre et le texte (mm)", "num"),
      f("frameColor", "Couleur du cadre", "color-empty", { help: "Vide = couleur des filets." }),
    ],
  },
  {
    id: "typo", title: "Typographie",
    fields: [
      f("fontFamily", "Police du corps", "font", { wide: true, help: FONT_HELP }),
      f("fontSize", "Taille du corps (pt)", "num"),
      f("lineHeight", "Interligne", "num"),
      f("letterSpacing", "Interlettrage (em)", "num"),
      f("hyphens", "Coupure des mots en fin de ligne", "bool"),
      f("justify", "Texte justifié", "bool"),
    ],
  },
  {
    id: "text", title: "Paragraphes",
    fields: [
      f("paraIndent", "Retrait de première ligne (em)", "num"),
      f("paraSpacing", "Espace entre paragraphes (em)", "num"),
    ],
  },
  {
    id: "title", title: "Intitulé de l'acte",
    sub: "La première ligne du document — celle qui porte le numéro et l'objet.",
    fields: [
      f("titleFont", "Police de l'intitulé", "font", { wide: true, inherit: true, help: "« Héritée » : l'intitulé reprend la police du corps." }),
      f("titleSize", "Taille (em)", "num"),
      f("titleWeight", "Graisse", "text", { placeholder: "700" }),
      f("titleAlign", "Alignement", "select", { options: SELECTS.titreAlign }),
      f("titleCase", "Capitales", "bool"),
      f("titleSpacing", "Interlettrage des capitales (em)", "num"),
      f("titleRule", "Marque de l'intitulé", "select", { options: SELECTS.titreRule }),
      f("titleBoxSides", "Bordures de l'encadré", "sides", { wide: true, help: SIDES_HELP }),
      f("titleMargin", "Espace sous l'intitulé (em)", "num"),
      f("titleColor", "Couleur de l'intitulé", "color-empty", { help: "Vide = couleur des intitulés." }),
    ],
  },
  {
    id: "authority", title: "Formule d'autorité",
    sub: "« Le maire de… », « La présidente du CCAS… ».",
    fields: [
      f("authorityAlign", "Alignement", "select", { options: SELECTS.align3 }),
      f("authoritySize", "Taille (em)", "num"),
      f("authorityItalic", "Italique", "bool"),
    ],
  },
  {
    id: "visas", title: "Visas et considérants",
    fields: [
      f("visasIndent", "Retrait des visas (px)", "num"),
      f("visasBullet", "Puces devant les visas", "bool"),
      f("visasLabelStyle", "Étiquette « Vu »", "select", { options: SELECTS.visasLabel }),
      f("recitalsIndent", "Retrait des considérants (px)", "num"),
      f("recitalsItalic", "Considérants en italique", "bool"),
    ],
  },
  {
    id: "filets", title: "Filets",
    sub: "Le trait qui sépare, souligne et encadre. Sa couleur est la couleur principale, sauf indication contraire.",
    fields: [
      f("ruleStyle", "Style des filets", "select", { options: SELECTS.ruleStyle }),
      f("ruleWidth", "Épaisseur des filets (px)", "num"),
    ],
  },
  {
    id: "articles", title: "Articles",
    sub: "Les intitulés d'article (« Article 1er — Objet ») et leur séparation.",
    fields: [
      f("headingFont", "Police des intitulés d'article", "font", { wide: true, inherit: true, help: "« Héritée » : les intitulés d'article reprennent la police du corps." }),
      f("headingSize", "Taille (em)", "num"),
      f("headingWeight", "Graisse", "text", { placeholder: "700" }),
      f("headingCase", "Intitulés en capitales", "bool"),
      f("headingRule", "Marque de l'intitulé d'article", "select", { options: SELECTS.headingRule }),
      f("headingBoxSides", "Bordures de l'encadré", "sides", { wide: true, help: SIDES_HELP }),
      f("articleNumberLayout", "Place du numéro", "select", { options: SELECTS.numPosition }),
      f("headingColor", "Couleur des intitulés", "color-empty", { help: "Vide = couleur du texte." }),
      f("articleDivider", "Filet entre les articles", "select", { options: SELECTS.divider }),
      f("articleSpacing", "Espace après chaque article (em)", "num"),
    ],
  },
  {
    id: "lists", title: "Listes",
    sub: "La puce des listes à puces et la numérotation des listes numérotées. C'est le rédacteur qui choisit, bloc par bloc dans la trame, entre liste à puces et liste numérotée ; ici, la charte dit à quoi elles ressemblent.",
    fields: [
      f("listMarker", "Puces (listes à puces)", "select", { options: SELECTS.listMarker, legacy: { decimal: "Numérotée 1. (héritée)" } }),
      f("listNumbering", "Numérotation (listes numérotées)", "select", { options: SELECTS.listNumbering, help: "S'applique aux listes que la trame déclare « numérotées » — par exemple « 1° 2° 3° », l'usage des énumérations administratives." }),
      f("listIndent", "Retrait (px)", "num"),
    ],
  },
  {
    id: "enact", title: "Formule d'édiction (« ARRÊTE » / « DÉCIDE »)",
    fields: [
      f("enactStyle", "Présentation", "select", { options: SELECTS.ecks }),
      f("enactBoxSides", "Bordures de l'encadré", "sides", { wide: true, help: SIDES_HELP }),
      f("enactCase", "En capitales", "bool"),
    ],
  },
  {
    id: "mentions", title: "Mentions (recours, publication, notification)",
    fields: [
      f("mentionStyle", "Présentation", "select", { options: SELECTS.mention }),
      f("mentionBoxSides", "Bordures de l'encadré", "sides", { wide: true, help: SIDES_HELP }),
      f("mentionSize", "Taille (em)", "num"),
      f("mentionItalic", "Italique", "bool"),
    ],
  },
  {
    id: "tables", title: "Tableaux",
    fields: [
      f("tableStyle", "Présentation", "select", { options: SELECTS.table }),
      f("tableFontSize", "Taille du texte (em)", "num"),
      f("tableCellPadding", "Marge intérieure des cellules (px)", "num"),
      f("tableCaptionAlign", "Alignement du titre du tableau", "select", { options: SELECTS.align3 }),
      f("tableCaptionCase", "Titre du tableau en capitales", "bool"),
    ],
  },
  {
    id: "signature", title: "Bloc de signature",
    fields: [
      f("signatureAlign", "Position", "select", { options: SELECTS.signAlign }),
      f("signatureStyle", "Présentation", "select", { options: SELECTS.signStyle }),
      f("signatureBoxSides", "Bordures de l'encadré", "sides", { wide: true, help: SIDES_HELP }),
      f("signatureSpace", "Espace pour la signature (px)", "num", { help: "Hauteur laissée au-dessus du nom, sous la ligne ou dans l'encadré." }),
      f("signatureWidth", "Largeur du bloc (% de la page)", "num"),
      f("signatureNameWeight", "Graisse du nom", "select", { options: SELECTS.weight }),
      f("signatureFunctionItalic", "Fonction en italique", "bool"),
    ],
  },
  {
    id: "header", title: "En-tête",
    sub: "Le logo et la ligne de recueil qui coiffent chaque page du document. " + TOKENS,
    fields: [
      f("showHeader", "Afficher un en-tête", "bool"),
      f("logoUrl", "URL ou image du logo", "text", { wide: true, help: "Une URL, ou une image encodée (data URL). Vide = pas de logo." }),
      f("logoHeight", "Hauteur du logo (px)", "num"),
      f("logoAlign", "Alignement de l'en-tête", "select", { options: SELECTS.logoAlign }),
      f("headerText", "Texte de l'en-tête", "text", { wide: true, placeholder: "{{entity.name}} — recueil des actes administratifs" }),
      f("headerRule", "Filet sous l'en-tête", "bool"),
      f("headerSize", "Taille du texte (em)", "num"),
      f("headerCase", "En capitales", "bool"),
      f("headerItalic", "Italique", "bool"),
    ],
  },
  {
    id: "footer", title: "Pied de page",
    fields: [
      f("showFooter", "Afficher un pied de page", "bool"),
      f("footerText", "Texte du pied", "text", { wide: true, placeholder: "Acte n°{{numero}} du {{dateSignature}}" }),
      f("footerAlign", "Alignement", "select", { options: SELECTS.align3 }),
      f("footerSize", "Taille du texte (em)", "num"),
      f("footerItalic", "Italique", "bool"),
    ],
  },
  {
    id: "colors", title: "Couleurs",
    sub: "La couleur principale teinte les filets, les bandeaux et les aplats discrets.",
    fields: [
      f("color", "Couleur principale", "color", { structure: true }),
      f("ink", "Couleur du texte", "color"),
      f("ruleColor", "Couleur des filets", "color-empty", { help: "Vide = couleur principale." }),
      f("muted", "Couleur du texte secondaire (en-tête, pied)", "color"),
    ],
  },
];

const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g]));

// Les zones cliquables de l'aperçu : le document est découpé en régions, chacune
// correspondant à un ou plusieurs groupes de réglages. C'est ce qui fait
// l'éditeur direct : on clique « l'intitulé » dans le document, on règle
// l'intitulé — jamais son texte.
const REGIONS = [
  { id: "page", label: "Papier", selector: ".doc", groups: ["papier", "cadre", "colors"], hint: "Marges de la page, cadre, couleurs de la charte." },
  { id: "header", label: "En-tête", groups: ["header"] },
  { id: "title", label: "Intitulé", groups: ["title"] },
  { id: "authority", label: "Formule d'autorité", groups: ["authority"] },
  { id: "visas", label: "Visas", groups: ["visas"] },
  { id: "recitals", label: "Considérants", groups: ["visas", "text"] },
  { id: "enact", label: "Formule DÉCIDE", groups: ["enact", "filets"] },
  { id: "articleHead", label: "Intitulés d'article", groups: ["articles", "filets"] },
  { id: "para", label: "Paragraphes", groups: ["text", "typo"] },
  { id: "list", label: "Listes", groups: ["lists", "text"] },
  { id: "table", label: "Tableaux", groups: ["tables"] },
  { id: "mention", label: "Mentions", groups: ["mentions", "filets"] },
  { id: "signature", label: "Signature", groups: ["signature"] },
  { id: "footer", label: "Pied de page", groups: ["footer"] },
  { id: "typo", label: "Texte du document", selector: ".doc", groups: ["typo", "text"] },
];
const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r]));

// Classe du document → région. La recherche part de l'élément cliqué et remonte
// l'arbre : cliquer un paragraphe règle les paragraphes, cliquer le numéro d'un
// article règle les intitulés d'article, etc.
const REGION_BY_CLASS = {
  doc: "page",
  "doc-sheet-header": "header", "doc-sheet-footer": "footer",
  "doc-title": "title", "doc-authority": "authority",
  "doc-visas": "visas", "doc-recitals": "recitals",
  "doc-enact": "enact",
  "doc-article": "articleHead", "doc-article-head": "articleHead",
  "doc-p": "para",
  "doc-list": "list",
  "doc-table-wrap": "table", "doc-table": "table",
  "doc-mention": "mention",
  "doc-signature": "signature",
};
// Le sélecteur qui met en évidence une région dans l'aperçu (à défaut, la
// première classe qui la représente).
const REGION_SELECTOR = { page: ".doc", typo: ".doc", colors: ".doc", recitals: ".doc-recitals" };
for (const [cls, id] of Object.entries(REGION_BY_CLASS)) if (!REGION_SELECTOR[id]) REGION_SELECTOR[id] = "." + cls;

// ------------------------------------------------------------- écran

export function renderStyles(root) {
  const ui = (state.ui = state.ui || {});
  const config = state.config;
  // Les feuilles sont normalisées au chargement : une feuille enregistrée avant
  // l'ajout d'un réglage reçoit le défaut de ce réglage (voir `emptyStyle`), et
  // l'écran n'a jamais à se demander si la clé existe.
  config.styles = stylesOf(config).map((s) => emptyStyle(s));
  const direct = ui.styleMode === "direct";

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Feuilles de style" }),
      h("p", { class: "page-head__sub", text: "La charte graphique des décisions : marges, police, logo, en-tête, filets, encadrés, tableaux, signature. Une feuille générale habille tous les actes ; des sous-feuilles se rattachent facultativement à certaines entités ou familles d'actes. La présentation est la même à l'écran, à l'impression (PDF), en Word et sur la version publiée." }),
    ),
    h("div", { class: "page-head__actions" },
      h("div", { class: "styles-tabs", role: "tablist" },
        h("button", { class: "styles-tab" + (!direct ? " is-on" : ""), role: "tab", "aria-selected": String(!direct), onClick: () => { ui.styleMode = "settings"; redrawView(); } }, "Réglages"),
        h("button", { class: "styles-tab" + (direct ? " is-on" : ""), role: "tab", "aria-selected": String(direct), onClick: () => { ui.styleMode = "direct"; redrawView(); } }, "Édition directe"),
      ),
      button("Nouvelle sous-feuille", { variant: "primary", icon: "plus", onClick: () => addSheet() }),
      helpLink("chartes", "Aide"),
    ),
  ));

  if (!config.styles.length) {
    // Un référentiel sans feuilles (héritage) : on en crée une à la volée.
    root.appendChild(emptyState(
      "Aucune feuille de style n'est définie : les actes utilisent la mise en page par défaut.",
      button("Créer la feuille générale", { variant: "primary", onClick: () => { config.styles.push(emptyStyle({ general: true, label: "Charte générale" })); save({ structure: true }); } }),
    ));
    return;
  }

  if (!config.styles.some((s) => s.id === ui.styleSel)) ui.styleSel = generalStyle(config).id;
  const sheet = config.styles.find((s) => s.id === ui.styleSel) || generalStyle(config);
  if (!REGION_BY_ID[ui.stylePick]) ui.stylePick = "page";
  const set = (key, value, opts) => { sheet[key] = value; save(opts); };

  // --- disposition : dans les deux modes, la liste des feuilles à gauche, puis
  //     l'aperçu et les réglages — l'aperçu reste collé au défilement.
  const grid = h("div", { class: "styles-grid" });
  const side = h("div");
  const editor = h("div", { class: "fr-stack styles-editor" });
  const preview = h("div", { class: "styles-preview" });
  const inspector = h("div", { class: "styles-inspector" });
  root.appendChild(grid);
  grid.appendChild(side);
  if (direct) { grid.appendChild(preview); grid.appendChild(inspector); }
  else { grid.appendChild(editor); grid.appendChild(preview); }

  // ------------------------------------------------------------- la liste
  const sideCard = h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Feuilles de style" }),
    h("p", { class: "fr-small fr-muted", text: "Cliquez une feuille pour la régler. La feuille générale sert de défaut ; une sous-feuille l'emporte pour les entités et familles auxquelles elle est rattachée." }),
  );
  side.appendChild(sideCard);
  for (const s of config.styles) {
    sideCard.appendChild(h("button", {
      class: "styles-sheet" + (s.id === sheet.id ? " is-on" : ""),
      onClick: () => { ui.styleSel = s.id; redrawView(); },
    },
      h("span", { class: "styles-sheet__label" },
        h("span", { class: "styles-swatch", style: { background: s.color || "#000091" } }),
        s.label || "Sans nom",
      ),
      h("span", { class: "styles-sheet__sub", text: sheetBadges(s, config) }),
    ));
  }

  // ------------------------------------------------------------- aperçu
  const canvas = h("div", { class: "paper-box paper-box--sheet" });
  const paper = h("div", { class: "paper" });
  canvas.appendChild(paper);

  const statusEl = h("p", { class: "fr-hint styles-pickstatus", text: direct
    ? "Cliquez un élément du document pour régler son apparence."
    : "" });
  const pickbar = h("div", { class: "styles-pickbar" });
  if (direct) {
    for (const r of REGIONS) {
      pickbar.appendChild(h("button", {
        class: "styles-chip" + (r.id === ui.stylePick ? " is-on" : ""),
        onClick: () => pickRegion(r.id, true),
      }, r.label));
    }
  }
  preview.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Aperçu" }),
    h("p", { class: "fr-card__sub", text: direct
      ? "Un acte type, rendu par le même code que le PDF, l'export Word et la version publiée. Cliquez l'élément à régler — le texte n'est jamais modifié ici."
      : "Un acte type, rendu par le même code que l'impression (PDF), l'export Word et la version publiée." }),
    direct ? pickbar : null,
    direct ? statusEl : null,
    canvas,
  ));

  // ------------------------------------------------------------- réglages
  if (direct) {
    inspector.appendChild(inspectorCard());
  } else {
    editor.appendChild(identityCard());
    editor.appendChild(presetCard());
    const seen = new Set();
    for (const g of GROUPS) editor.appendChild(groupCard(g, seen));
  }

  repaint();

  // Les zones cliquables de l'aperçu ne vivent que dans l'éditeur direct : dans
  // la vue « Réglages », le document reste un aperçu inerte.
  if (direct) {
    paper.classList.add("styles-pickable");
    paper.addEventListener("mouseover", (e) => showHover(pickable(e.target)));
    paper.addEventListener("mouseleave", () => showHover(null));
    paper.addEventListener("click", (e) => {
      const r = pickable(e.target);
      if (!r) return;
      e.preventDefault();
      pickRegion(r, false);
    });
  }

  // ------------------------------------------------------------- cartes
  function identityCard() {
    const card = h("div", { class: "fr-card" },
      h("div", { class: "fr-row" },
        h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: sheet.general ? "Feuille générale" : "Sous-feuille" }),
        sheet.general ? h("span", { class: "fr-badge fr-badge--info", text: "S'applique par défaut" }) : null,
      ),
    );
    card.appendChild(textField({ label: "Nom de la feuille", value: sheet.label, onChange: (v) => set("label", v, { structure: true }) }));
    card.appendChild(choiceField({
      label: "Rôle", value: !!sheet.general, options: [{ value: false, label: "Sous-feuille" }, { value: true, label: "Feuille générale" }],
      help: "Il n'y a qu'une feuille générale : la définir ici la retire de l'ancienne. C'est l'habillage par défaut de tous les actes.",
      onChange: (v) => {
        if (v) for (const s of config.styles) s.general = false;
        sheet.general = v;
        save({ structure: true });
      },
    }));
    card.appendChild(choiceField({
      label: "Entités rattachées", value: sheet.entityIds || [], multi: true,
      options: (config.entities || []).map((e) => ({ value: e.id, label: e.name })),
      help: "Les actes pris par ces entités reçoivent cette charte — chacune peut donc avoir la sienne.",
      onChange: (v) => set("entityIds", v, { structure: true }),
    }));
    card.appendChild(choiceField({
      label: "Familles d'actes rattachées", value: sheet.familyIds || [], multi: true,
      options: (config.families || []).map((fe) => ({ value: fe.id, label: fe.label })),
      help: "Une sous-feuille peut viser une famille entière (les actes individuels, les marchés publics…), indépendamment de l'entité.",
      onChange: (v) => set("familyIds", v, { structure: true }),
    }));
    card.appendChild(h("p", { class: "fr-hint", text: styleSummary(sheet, config) }));
    card.appendChild(h("p", { class: "fr-hint", text: "Ordre de priorité : la trame de l'acte (si elle désigne une feuille), puis l'entité, puis la famille, puis la feuille générale." }));
    card.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", marginTop: "8px" } },
      button("Dupliquer", { variant: "secondary", size: "sm", icon: "copy", onClick: () => duplicate(sheet) }),
      button("Exporter la charte (JSON)", { variant: "secondary", size: "sm", icon: "download", onClick: () => exportSheet(sheet) }),
      button("Importer une charte", { variant: "secondary", size: "sm", icon: "upload", onClick: () => importSheet() }),
      !sheet.general && config.styles.length > 1
        ? button("Supprimer", { variant: "secondary", size: "sm", danger: true, icon: "trash", onClick: () => removeSheet(sheet) })
        : null,
    ));
    return card;
  }

  // Les préréglages : un point de départ, pas une identité — ils ne touchent ni
  // le nom, ni le rattachement, ni le logo de la feuille.
  function presetCard() {
    const card = h("div", { class: "fr-card fr-card--soft" },
      h("h2", { class: "fr-card__title", text: "Modèle de départ" }),
      h("p", { class: "fr-card__sub", text: "Applique d'un coup une présentation complète. Le nom, le rattachement et le logo de la feuille sont conservés ; tout reste modifiable ensuite, réglage par réglage." }),
    );
    const wrap = h("div", { class: "styles-presets" });
    for (const p of STYLE_PRESETS) {
      wrap.appendChild(h("button", {
        class: "styles-preset", type: "button",
        on: { click: () => applyPresetTo(p) },
      },
        h("span", { class: "styles-preset__tete" },
          h("span", { class: "styles-preset__name", text: p.label }),
          p.badge ? h("span", { class: "styles-preset__badge" + (p.badgeKind === "warning" ? " styles-preset__badge--warning" : ""), text: p.badge }) : null,
        ),
        h("span", { class: "styles-preset__hint", text: p.hint }),
      ));
    }
    card.appendChild(wrap);
    card.appendChild(h("div", { class: "fr-row", style: { marginTop: "10px" } },
      button("Valeurs par défaut", { variant: "secondary", size: "sm", icon: "refresh", onClick: () => resetSheet(sheet) }),
    ));
    return card;
  }

  function groupCard(g, seen) {
    const card = h("div", { class: "fr-card" },
      h("h2", { class: "fr-card__title", text: g.title }),
      g.sub ? h("p", { class: "fr-card__sub", text: g.sub }) : null,
    );
    const fields = h("div", { class: "styles-fields" });
    for (const fl of g.fields) {
      // En vue « Réglages », un même réglage peut appartenir à deux groupes
      // (la justification est aussi bien typographique que « paragraphe ») :
      // il n'est présenté qu'une fois.
      if (seen && seen.has(fl.key)) continue;
      if (seen) seen.add(fl.key);
      fields.appendChild(styleField(fl, sheet, set));
    }
    card.appendChild(fields);
    return card;
  }

  // Le panneau de l'éditeur direct : la région cliquée, et seuls ses réglages.
  function inspectorCard() {
    const r = REGION_BY_ID[ui.stylePick] || REGION_BY_ID.page;
    const card = h("div", { class: "fr-card" },
      h("div", { class: "fr-row" },
        h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: r.label }),
        button("Tout voir", { variant: "tertiary", size: "sm", icon: "list", onClick: () => { ui.styleMode = "settings"; redrawView(); } }),
      ),
      r.hint ? h("p", { class: "fr-card__sub", text: r.hint }) : null,
    );
    for (const gid of r.groups) {
      const g = GROUP_BY_ID[gid];
      if (!g) continue;
      card.appendChild(h("h3", { class: "styles-group-title", text: g.title }));
      const fields = h("div", { class: "styles-fields" });
      for (const fl of g.fields) fields.appendChild(styleField(fl, sheet, set));
      card.appendChild(fields);
    }
    // L'identité et le rattachement restent accessibles, mais repliés : l'éditeur
    // direct s'adresse au style, pas à l'organisation des feuilles.
    const details = h("details", { class: "styles-identity" },
      h("summary", { text: "Identité et rattachement de la feuille" }),
    );
    details.appendChild(identityCard());
    details.appendChild(presetCard());
    card.appendChild(h("hr", { class: "styles-sep" }));
    card.appendChild(details);
    return card;
  }

  // ------------------------------------------------------------- aperçu / interactions
  function repaint() {
    clear(paper);
    // Les marges du papier viennent de la feuille : l'aperçu montre le document
    // à la bonne mesure, pas une page générique.
    applyPaper(paper, sampleDocument(config, sheet), config, { style: sheet });
    paper.style.fontFamily = "";
    paper.appendChild(renderDocument(sampleDocument(config, sheet), config, { style: sheet }));
    if (direct) markPick();
    requestAnimationFrame(() => fitPaper(canvas, paper));
  }

  // La région d'un élément du document : on part de l'élément touché et on
  // remonte jusqu'à une classe connue (voir REGION_BY_CLASS).
  function pickable(node) {
    let el = node && node.nodeType === 1 ? node : node?.parentElement;
    while (el && el !== paper) {
      for (const c of el.classList) if (REGION_BY_CLASS[c]) return REGION_BY_CLASS[c];
      el = el.parentElement;
    }
    return null;
  }

  function regionEl(id) {
    const sel = REGION_SELECTOR[id];
    return sel ? paper.querySelector(sel) : null;
  }

  let hoverEl = null;
  function showHover(id) {
    if (hoverEl) hoverEl.classList.remove("styles-pick-hover");
    hoverEl = id ? regionEl(id) : null;
    if (hoverEl) hoverEl.classList.add("styles-pick-hover");
    const r = id ? REGION_BY_ID[id] : null;
    statusEl.textContent = r
      ? "Élément survolé : " + r.label + " — cliquez pour le régler."
      : "Cliquez un élément du document pour régler son apparence.";
  }

  function markPick() {
    for (const el of paper.querySelectorAll(".styles-pick-on")) el.classList.remove("styles-pick-on");
    const el = regionEl(ui.stylePick);
    if (el) el.classList.add("styles-pick-on");
  }

  function pickRegion(id, scroll) {
    ui.stylePick = id;
    clear(inspector);
    inspector.appendChild(inspectorCard());
    for (const chip of pickbar.children) chip.classList.toggle("is-on", chip.textContent === (REGION_BY_ID[id] || {}).label);
    markPick();
    const el = regionEl(id);
    if (scroll && el) el.scrollIntoView({ block: "center", behavior: "smooth" });
    if (direct) requestAnimationFrame(() => fitPaper(canvas, paper));
  }

  // ------------------------------------------------------------- enregistrement
  function save({ structure = false } = {}) {
    touch("config", { rerender: false });
    applyBrand();
    if (structure) redrawView();
    else repaint();
  }

  function applyPresetTo(p) {
    Object.assign(sheet, applyPreset(sheet, p.id));
    save({ structure: true });
    toast("Modèle « " + p.label + " » appliqué à cette feuille.", "success");
  }

  function resetSheet(s) {
    const fresh = emptyStyle({ id: s.id, label: s.label, description: s.description, general: s.general, entityIds: s.entityIds, familyIds: s.familyIds, logoUrl: s.logoUrl });
    for (const k of Object.keys(s)) if (!(k in fresh)) delete s[k];
    Object.assign(s, fresh);
    save({ structure: true });
    toast("Réglages remis aux valeurs par défaut.", "info");
  }

  function addSheet() {
    const s = emptyStyle({ label: "Nouvelle sous-feuille" });
    config.styles.push(s);
    ui.styleSel = s.id;
    save({ structure: true });
  }

  function duplicate(src) {
    const copy = emptyStyle({ ...src, id: undefined, label: (src.label || "Feuille") + " (copie)", general: false });
    config.styles.push(copy);
    ui.styleSel = copy.id;
    save({ structure: true });
  }

  async function removeSheet(s) {
    const ok = await confirmDialog("Supprimer la feuille de style",
      `« ${s.label} » sera retirée du référentiel. Les actes qu'elle habillait reprendront la feuille générale.`,
      { confirmLabel: "Supprimer", danger: true });
    if (!ok) return;
    config.styles = config.styles.filter((x) => x.id !== s.id);
    ui.styleSel = generalStyle(config).id;
    save({ structure: true });
  }

  function exportSheet(s) {
    const file = {
      kind: "actes-feuille-de-style", version: 1,
      exporteLe: new Date().toISOString(),
      feuille: { ...s },
    };
    download((s.label || "feuille-de-style").replace(/[^\w\-]+/g, "-").toLowerCase() + ".json", JSON.stringify(file, null, 2));
  }

  async function importSheet() {
    const file = await pickFile(".json");
    if (!file) return;
    try {
      const data = JSON.parse(file.text);
      const raw = data.feuille || data.style || data;
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Structure inattendue");
      const s = emptyStyle({ ...raw, id: undefined, general: false, label: raw.label || "Feuille importée" });
      config.styles.push(s);
      ui.styleSel = s.id;
      save({ structure: true });
      toast("Feuille de style importée.", "success");
    } catch (e) {
      toast("Import impossible : " + e.message, "error");
    }
  }
}

// ------------------------------------------------------------- champs

// Les badges d'une feuille dans la liste : générale, entités, familles — et, à
// défaut, les réglages qui la distinguent (cadre, capitales, numéros dans la
// marge…), pour qu'on voie d'un coup d'œil en quoi deux chartes diffèrent.
function sheetBadges(s, config) {
  const { entities, families } = { entities: (config.entities || []).filter((e) => (s.entityIds || []).includes(e.id)), families: (config.families || []).filter((x) => (s.familyIds || []).includes(x.id)) };
  const badges = [];
  if (s.general) badges.push("Générale");
  if (entities.length) badges.push(entities.length + " entité" + (entities.length > 1 ? "s" : ""));
  if (families.length) badges.push(families.length + " famille" + (families.length > 1 ? "s" : ""));
  const traits = styleTraits(s).slice(0, 3);
  const parts = badges.length ? [badges.join(" · ")] : ["Non rattachée"];
  if (traits.length) parts.push(traits.join(", "));
  return parts.join(" — ");
}

// Un champ du schéma : même rendu partout (vue « Réglages » et panneau de
// l'éditeur direct), donc une seule définition par réglage.
function styleField(fl, sheet, set) {
  const value = sheet[fl.key];
  const wide = fl.wide ? " styles-field--wide" : "";
  let control;
  switch (fl.kind) {
    case "bool":
      control = choiceField({ label: fl.label, value: value !== false && value !== "false", options: YES_NO, help: fl.help, onChange: (v) => set(fl.key, v, fl) });
      break;
    case "select": {
      // Une feuille enregistrée avant un changement de nomenclature garde sa
      // valeur : on lui rend son option, pour qu'elle reste lisible — et
      // modifiable — dans la liste déroulante.
      let options = fl.options || [];
      const legacy = fl.legacy && fl.legacy[String(value ?? "")];
      if (legacy && !options.some((o) => String(o.value) === String(value))) options = [...options, { value: value, label: legacy }];
      control = selectField({ label: fl.label, value: String(value ?? ""), options, help: fl.help, onChange: (v) => set(fl.key, v, fl) });
      break;
    }
    case "sides": {
      // Un encadré dont on coche les côtés. L'état vit ici (et non dans une
      // fermeture sur la valeur de la feuille) : les clics s'enchaînent sans
      // reconstruire l'écran, qui n'est pas redessiné à chaque réglage.
      const sides = { value: String(value || "tblr") };
      const sideBtn = (key, label) => h("button", {
        type: "button",
        class: "styles-side" + (sides.value.includes(key) ? " is-on" : ""),
        "aria-pressed": String(sides.value.includes(key)),
        onClick: (e) => {
          const on = new Set(sides.value.split(""));
          if (on.has(key)) on.delete(key); else on.add(key);
          sides.value = "tblr".split("").filter((x) => on.has(x)).join("");
          e.currentTarget.classList.toggle("is-on", sides.value.includes(key));
          e.currentTarget.setAttribute("aria-pressed", String(sides.value.includes(key)));
          set(fl.key, sides.value, fl);
        },
      }, label);
      control = frField(fl.label, h("div", { class: "styles-sides" },
        sideBtn("t", "Haut"), sideBtn("r", "Droite"), sideBtn("b", "Bas"), sideBtn("l", "Gauche")), { help: fl.help });
      break;
    }
    case "font":
      control = fontField({ label: fl.label, value, inherit: fl.inherit, help: fl.help, onChange: (v) => set(fl.key, v, fl) });
      break;
    case "num":
      control = textField({ label: fl.label, value: value ?? "", type: "number", help: fl.help, placeholder: fl.placeholder, onChange: (v) => set(fl.key, v, fl) });
      break;
    case "color":
    case "color-empty":
      control = colorField({ label: fl.label, value: value, allowEmpty: fl.kind === "color-empty", help: fl.help, onChange: (v) => set(fl.key, v, fl) });
      break;
    default:
      control = textField({ label: fl.label, value: value ?? "", help: fl.help, placeholder: fl.placeholder, onChange: (v) => set(fl.key, v, fl) });
  }
  if (wide) control.classList.add("styles-field--wide");
  return control;
}

// Couleur : une pastille native et sa valeur écrite — la pastille pour choisir,
// le texte pour coller la teinte exacte de la charte. Vide, la couleur hérite
// (celle du texte, ou la couleur principale pour les filets).
function colorField({ label, value, onChange, help, allowEmpty = false }) {
  const valid = (v) => /^#[0-9a-f]{6}$/i.test(String(v || ""));
  const text = h("input", {
    class: "fr-input", value: value ?? "",
    placeholder: allowEmpty ? "— héritée —" : "#000000",
    on: { input: (e) => onChange(e.target.value) },
  });
  const swatch = h("input", {
    type: "color", value: valid(value) ? value : "#000000",
    on: { input: (e) => { text.value = e.target.value; onChange(e.target.value); } },
  });
  return frField(label, h("div", { class: "styles-color-row" }, swatch, text), { help });
}
