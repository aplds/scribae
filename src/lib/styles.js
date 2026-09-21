import { uid } from "./util.js";

// ============================================================================
// Feuilles de style — la charte graphique des décisions.
//
// Une feuille de style décrit la **présentation** d'un acte, jamais son fond :
// marges du papier, police, corps du texte, couleurs, logo, en-tête, pied de
// page, filets de séparation (les « diviseurs »), encadrés, tableaux, bloc de
// signature, cadre de page. Le document est le même ; c'est son habillage qui
// change — à l'écran, dans le HTML autonome, dans le fichier Word, dans le PDF
// (impression) et sur la version publiée.
//
// Il y a une **feuille générale** (le défaut, marquée `general: true`) et, en
// plus, des **sous-feuilles**. Chacune se rattache *facultativement* à des
// **entités** et/ou à des **familles d'actes** : c'est ainsi que chaque entité
// habille ses propres décisions selon sa charte, sans rien changer au logiciel.
// Une trame peut aussi désigner sa feuille explicitement (`trame.styleId`).
//
// Résolution, du plus précis au plus général :
//   1. la trame (`trame.styleId`, repris dans `doc.meta.styleId`) ;
//   2. l'entité signataire (sa charte propre) ;
//   3. la famille de la trame (une sous-feuille par famille d'actes) ;
//   4. la feuille générale.
//
// Toutes les valeurs ont un défaut (`emptyStyle`) : une feuille incomplète, ou
// un référentiel hérité sans feuilles, reste parfaitement imprimable. C'est
// aussi ce qui rend les feuilles **compatibles dans le temps** : une feuille
// enregistrée avant l'ajout d'un réglage reçoit simplement le défaut de ce
// réglage, et le document continue de se présenter comme avant.
//
// `styleCss` est la source unique de la mise en forme d'une feuille : le CSS
// qu'elle produit est injecté **confiné** (`[data-sheet="…"]`) dans l'aperçu de
// l'application, et **non confiné** dans les documents exportés (une seule
// feuille par document). Ajouter un réglage se fait donc en trois endroits :
// le modèle (`emptyStyle`), le CSS (`styleCss`), et l'écran de réglage
// (`src/ui/views/styles.js` — l'écran est piloté par un schéma, voir
// `GROUPS`/`REGIONS` là-bas).
//
// Les longueurs sont des nombres *sans unité* : la police et les corps sont en
// points, les filets, logos et espaces en pixels, les marges de page en
// millimètres (l'unité est ajoutée en écrivant le CSS).
// ============================================================================

// --------------------------------------------------------------- polices
// Les polices proposées aux feuilles de style : une **liste fermée** plutôt
// qu'un champ libre, pour que l'écran dise ce qui est disponible et que les
// chartes d'une collectivité se ressemblent. Ce sont des familles **répandues
// sur les postes** — rien à télécharger, aucune dépendance réseau — et chaque
// entrée porte sa pile CSS complète avec ses replis, car une même famille ne
// s'appelle pas pareil d'un système à l'autre. Les documents exportés (Word,
// HTML, PDF) nomment la même pile : la charte traverse donc les postes.
//
// Une police hors liste reste possible : la feuille conserve la pile saisie
// (une police installée sur les postes, ou une pile CSS complète) et l'écran
// la présente comme « Personnalisée ».
export const FONT_CHOICES = [
  {
    group: "À empattements",
    fonts: [
      { value: "'Times New Roman', Times, Georgia, serif", label: "Times New Roman" },
      { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
      { value: "Cambria, Georgia, 'Times New Roman', serif", label: "Cambria" },
      { value: "'Palatino Linotype', 'Book Antiqua', Palatino, Georgia, serif", label: "Palatino" },
      { value: "Garamond, 'EB Garamond', Georgia, serif", label: "Garamond" },
      { value: "'Century Schoolbook', 'New Century Schoolbook', Georgia, serif", label: "Century Schoolbook" },
    ],
  },
  {
    group: "Sans empattement",
    fonts: [
      { value: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif", label: "Segoe UI" },
      { value: "Arial, 'Helvetica Neue', Helvetica, sans-serif", label: "Arial" },
      { value: "Calibri, 'Segoe UI', Arial, sans-serif", label: "Calibri" },
      { value: "Verdana, Geneva, Tahoma, sans-serif", label: "Verdana" },
      { value: "Tahoma, Verdana, sans-serif", label: "Tahoma" },
      { value: "'Trebuchet MS', Tahoma, sans-serif", label: "Trebuchet MS" },
      { value: "'Century Gothic', 'AppleGothic', sans-serif", label: "Century Gothic" },
    ],
  },
  {
    group: "Chasse fixe",
    fonts: [
      { value: "'Courier New', Courier, monospace", label: "Courier New" },
      { value: "Consolas, 'Courier New', monospace", label: "Consolas" },
    ],
  },
];

export const FONT_DEFAULT = FONT_CHOICES[0].fonts[0].value;

const FONT_FLAT = FONT_CHOICES.flatMap((g) => g.fonts);
export const FONT_VALUES = FONT_FLAT.map((f) => f.value);
export const isListedFont = (value) => FONT_VALUES.includes(value);
export const fontLabel = (value) => (FONT_FLAT.find((f) => f.value === value) || {}).label || "";

// --------------------------------------------------------------- modèle

export function emptyStyle(patch = {}) {
  return {
    id: patch.id || uid("sty"),
    label: "Nouvelle feuille de style",
    description: "",
    // Le drapeau `general` désigne LA feuille générale : le défaut que reçoivent
    // les actes qu'aucune sous-feuille ne vise. Il n'y en a qu'une.
    general: false,
    entityIds: [],
    familyIds: [],

    // --- papier (marges de page en millimètres) et cadre
    // Les marges sont celles du papier A4 : elles s'appliquent à l'aperçu comme
    // aux documents exportés (PDF, Word, HTML autonome, version publiée).
    pageMarginTop: "20",
    pageMarginRight: "18",
    pageMarginBottom: "20",
    pageMarginLeft: "18",
    frameStyle: "none", // none | line | double | heavy
    frameWidth: "1",
    frameColor: "",
    frameSpace: "6", // mm entre le cadre et le texte

    // --- typographie
    fontFamily: FONT_DEFAULT,
    fontSize: "11",
    lineHeight: "1.5",
    justify: true,
    letterSpacing: "0", // em
    hyphens: false,
    paraIndent: "0", // em — retrait de la première ligne des paragraphes
    paraSpacing: "0.55", // em — espace entre deux paragraphes
    articleSpacing: "1", // em — espace après chaque article

    // --- couleurs
    color: "#000091",
    ink: "#111111",
    muted: "#555555",
    ruleColor: "",

    // --- intitulé
    titleFont: "",
    titleSize: "1.06",
    titleWeight: "700",
    titleCase: false,
    titleAlign: "center",
    titleRule: "none", // none | line | double | underline
    titleColor: "",
    titleSpacing: "0.02", // em, quand l'intitulé est en capitales
    titleMargin: "0.9", // em

    // --- formule d'autorité (« Le maire de… »)
    authorityAlign: "left",
    authorityItalic: false,
    authoritySize: "1",

    // --- intitulés d'article
    headingFont: "",
    headingSize: "1",
    headingWeight: "700",
    headingColor: "",
    headingCase: false,
    headingRule: "none", // none | line | dotted
    // Disposition du numéro d'article : à la suite du titre (`inline`), au-dessus
    // (`block`), ou dans la marge de gauche (`margin`).
    articleNumberLayout: "inline", // inline | block | margin

    // --- visas et considérants
    visasIndent: "0", // px
    visasBullet: false,
    visasLabelStyle: "plain", // plain | italic | bold | smallcaps
    recitalsIndent: "0", // px
    recitalsItalic: false,

    // --- listes
    // `listMarker` est la marque des listes à puces (`ul`) ; `listNumbering`,
    // celle des listes numérotées (`ol`). Les deux se règlent séparément depuis
    // que le rédacteur choisit, bloc par bloc, entre liste à puces et liste
    // numérotée (voir l'éditeur de trame).
    listMarker: "disc", // disc | circle | square | dash | decimal | none
    listNumbering: "decimal", // decimal | degree | parenth | lalpha | ualpha | lroman | uroman | none
    listIndent: "22", // px

    // --- diviseurs et encadrés
    ruleStyle: "line", // line | double | dotted | none
    ruleWidth: "1",
    articleDivider: "none", // none | line | dotted | double
    // Les encadrés : chaque présentation « Encadré » trace les côtés retenus —
    // « tblr » (haut, droite, bas, gauche) par défaut. Voir `boxSides`.
    titleBoxSides: "tblr",
    headingBoxSides: "tblr",
    enactStyle: "plain", // plain | rule | band | box
    enactBoxSides: "tblr",
    enactCase: false,
    mentionStyle: "plain", // plain | left | box | tinted
    mentionBoxSides: "tblr",
    signatureBoxSides: "tblr",
    mentionSize: "0.92", // em
    mentionItalic: false,
    tableStyle: "grid", // grid | rows | zebra
    tableFontSize: "0.92", // em
    tableCellPadding: "3", // px
    tableCaptionAlign: "left",
    tableCaptionCase: false,

    // --- signature
    signatureAlign: "right",
    signatureStyle: "plain", // plain | line | box
    signatureSpace: "40", // px
    signatureWidth: "40", // % de la largeur
    signatureFunctionItalic: false,
    signatureNameWeight: "400",

    // --- en-tête et pied de page
    showHeader: false,
    logoUrl: "",
    logoHeight: "42",
    logoAlign: "left",
    headerText: "",
    headerRule: true,
    headerSize: "0.86", // em
    headerItalic: false,
    headerCase: false,
    showFooter: false,
    footerText: "",
    footerAlign: "center",
    footerSize: "0.78", // em
    footerItalic: false,

    ...patch,
  };
}

// La feuille implicite : un référentiel hérité (ou vide) n'a pas de feuilles.
// On en dérive une de l'identité de la marque, de sorte que rien ne change de
// présentation tant que l'administrateur n'a pas créé ses propres feuilles.
export function legacyStyleFromBrand(brand = {}) {
  return emptyStyle({
    id: "sty-general",
    label: "Feuille générale",
    general: true,
    fontFamily: brand.documentFont || FONT_DEFAULT,
    color: brand.color || "#000091",
  });
}

export const stylesOf = (config) => (Array.isArray(config?.styles) ? config.styles : []);

export function generalStyle(config) {
  const list = stylesOf(config);
  return list.find((x) => x.general) || list[0] || legacyStyleFromBrand(config?.brand);
}

export function resolveStyle(config, { styleId, entityId, familyId } = {}) {
  const list = stylesOf(config);
  if (!list.length) return legacyStyleFromBrand(config?.brand);
  if (styleId) {
    const s = list.find((x) => x.id === styleId);
    if (s) return s;
  }
  if (entityId) {
    const s = list.find((x) => !x.general && (x.entityIds || []).includes(entityId));
    if (s) return s;
  }
  if (familyId) {
    const s = list.find((x) => !x.general && (x.familyIds || []).includes(familyId));
    if (s) return s;
  }
  return generalStyle(config);
}

// La feuille d'un document compilé : c'est ce que l'aperçu, les exports et la
// version publiée appellent tous. `doc.meta` porte les trois critères.
export function styleForDoc(config, doc) {
  return resolveStyle(config, {
    styleId: doc?.meta?.styleId,
    entityId: doc?.meta?.entity?.id || doc?.meta?.org?.id,
    familyId: doc?.meta?.familyId,
  });
}

// À qui une feuille s'applique : libellés des entités et familles rattachées.
export function styleTargets(style, config) {
  return {
    entities: (config?.entities || []).filter((e) => (style?.entityIds || []).includes(e.id)).map((e) => e.name),
    families: (config?.families || []).filter((f) => (style?.familyIds || []).includes(f.id)).map((f) => f.label),
  };
}

// Une phrase qui dit à quoi sert la feuille — affichée dans la liste.
export function styleSummary(style, config) {
  if (style?.general) return "S'applique à tous les actes, sauf ceux visés par une sous-feuille.";
  const { entities, families } = styleTargets(style, config);
  const parts = [];
  if (entities.length) parts.push(entities.join(", "));
  if (families.length) parts.push(families.join(", "));
  return parts.length ? "S'applique à : " + parts.join(" · ") : "Sous-feuille non rattachée : elle ne s'applique à aucun acte tant qu'aucune entité ni famille ne lui est associée.";
}

// Le rappel des réglages marquants d'une feuille, en une ligne : la liste des
// feuilles dit ainsi, d'un coup d'œil, en quoi elles diffèrent.
export function styleTraits(style) {
  const s = emptyStyle(style || {});
  const t = [];
  if (s.frameStyle !== "none") t.push("cadre");
  if (s.showHeader) t.push("en-tête");
  if (s.showFooter) t.push("pied de page");
  if (s.titleCase) t.push("intitulé en capitales");
  if (s.titleRule === "box") t.push("intitulé encadré");
  if (s.headingRule === "box") t.push("intitulés d'article encadrés");
  if (s.articleNumberLayout === "margin") t.push("numéros dans la marge");
  if (s.articleNumberLayout === "block") t.push("numéros au-dessus");
  if (s.articleDivider !== "none") t.push("filets entre articles");
  if (s.enactStyle !== "plain") t.push("formule DÉCIDE encadrée");
  if (s.mentionStyle !== "plain") t.push("mentions encadrées");
  const numTrait = { degree: "listes en 1°", parenth: "listes en 1)", lalpha: "listes en a)", ualpha: "listes en A)", lroman: "listes en i.", uroman: "listes en I." }[s.listNumbering];
  if (numTrait) t.push(numTrait);
  if (!s.justify) t.push("texte non justifié");
  return t;
}

// --------------------------------------------------------------- géométrie du papier

const num = (v, d) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : d;
};
const pxv = (v, d) => num(v, parseFloat(d)) + "px";
const ptv = (v, d) => num(v, parseFloat(d)) + "pt";
const emv = (v, d) => num(v, parseFloat(d)) + "em";
const mmv = (v, d) => num(v, d) + "mm";

// Les marges de page d'une feuille, en millimètres. Les valeurs sont celles du
// papier A4 par défaut (voir `paper.js`) tant que la feuille n'en décide
// pas autrement.
export function paperMargins(style) {
  const s = emptyStyle(style || {});
  return {
    top: num(s.pageMarginTop, 20),
    right: num(s.pageMarginRight, 18),
    bottom: num(s.pageMarginBottom, 20),
    left: num(s.pageMarginLeft, 18),
  };
}

// `20mm 18mm 20mm 18mm`
export const paperMarginCss = (style) => {
  const m = paperMargins(style);
  return `${m.top}mm ${m.right}mm ${m.bottom}mm ${m.left}mm`;
};

// La règle `@page` du document imprimé : c'est elle qui fixe les marges du PDF.
export const paperPageCss = (style) => `@page{size:A4 portrait;margin:${paperMarginCss(style)}}`;

// L'aperçu de l'application ne peut pas être mis en page par `@page` : le papier
// y est un bloc, dont la marge intérieure vient de cette variable CSS. Les vues
// qui affichent un papier la posent (`applyPaper`, dans render.js).
export const paperPadding = (style) => paperMarginCss(style);

// --------------------------------------------------------------- jeu de démonstration

// Emblème du CCAS (SVG embarqué, comme celui de la commune) : il illustre la
// charte propre à une entité — un logo différent sur les mêmes actes.
export const LOGO_CCAS_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="CCAS de Valmont-sur-Loire">
  <circle cx="32" cy="32" r="30" fill="#eef7f2" stroke="#1f7a5a" stroke-width="3"/>
  <path d="M32 46s-14-8.6-14-18a8 8 0 0114-5 8 8 0 0114 5c0 9.4-14 18-14 18z" fill="#1f7a5a" opacity=".92"/>
  <path d="M22 24h20" stroke="#0f4d38" stroke-width="3" stroke-linecap="round"/>
</svg>`;

const dataUrl = (svg) => "data:image/svg+xml;base64," + btoa(svg.trim());

// Les feuilles livrées avec la démonstration. Elles montrent les trois niveaux :
// une générale, une rattachée à une entité (le CCAS), une rattachée à une
// famille (les actes individuels) — et, à elles trois, l'essentiel des réglages.
export function seedStyles() {
  return [
    emptyStyle({
      id: "sty-general",
      label: "Charte générale de la collectivité",
      general: true,
      description: "La présentation par défaut de tous les actes : sobre, sur papier A4, sans en-tête ni pied de page.",
    }),
    emptyStyle({
      id: "sty-ccas",
      label: "Charte du CCAS",
      entityIds: ["ent-ccas"],
      // Une entité a sa charte : autre logo, autre police, filets et encadrés
      // distincts. Les actes pris par le CCAS en héritent automatiquement.
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      fontSize: "10.5",
      lineHeight: "1.55",
      color: "#1f7a5a",
      ruleColor: "#1f7a5a",
      letterSpacing: "0.005",
      titleFont: "'Segoe UI Semibold', 'Segoe UI', Arial, sans-serif",
      titleSize: "1.12",
      titleAlign: "left",
      titleCase: true,
      titleRule: "line",
      headingColor: "#0f4d38",
      authorityItalic: true,
      visasLabelStyle: "bold",
      showHeader: true,
      logoUrl: dataUrl(LOGO_CCAS_SVG),
      logoHeight: "46",
      logoAlign: "left",
      headerText: "{{entity.name}} — recueil des actes administratifs",
      headerRule: true,
      showFooter: true,
      footerText: "Acte n°{{numero}} du {{dateSignature}} — {{entity.name}}",
      footerAlign: "left",
      articleDivider: "dotted",
      enactStyle: "band",
      mentionStyle: "left",
      signatureAlign: "left",
      signatureStyle: "box",
      signatureFunctionItalic: true,
      tableStyle: "rows",
      tableCellPadding: "5",
      pageMarginTop: "16",
    }),
    emptyStyle({
      id: "sty-individuels",
      label: "Charte des actes individuels",
      familyIds: ["fam-individuels"],
      // Une famille a sa charte : les actes individuels (notifiés, non publiés)
      // sont présentés sobrement, sans logo ni en-tête de recueil, et le bloc de
      // signature laisse la place à la main du signataire.
      color: "#3a3a3a",
      ruleColor: "#8a8a8a",
      titleSize: "1.02",
      titleWeight: "700",
      titleCase: true,
      titleAlign: "center",
      titleRule: "double",
      headingColor: "#222222",
      headingCase: true,
      articleNumberLayout: "block",
      mentionStyle: "box",
      mentionSize: "0.88",
      signatureAlign: "right",
      signatureStyle: "line",
      signatureSpace: "46",
      signatureNameWeight: "700",
      fontSize: "10.5",
    }),
  ];
}

// --------------------------------------------------------------- préréglages
// Un préréglage est un point de départ : appliquer « Solennel » règle d'un coup
// la vingtaine de valeurs qui font un document solennel. Il ne touche ni le nom,
// ni le rattachement (entités, familles), ni le logo : c'est une présentation,
// pas une identité. Les valeurs absentes reprennent le défaut du modèle.
export const STYLE_PRESETS = [
  {
    id: "classique",
    label: "Classique préfectoral",
    hint: "Times, texte justifié, intitulé centré souligné d'un filet, mentions à filet gauche, signature sur une ligne.",
    values: {
      fontFamily: "'Times New Roman', Times, Georgia, serif",
      fontSize: "11", lineHeight: "1.5", justify: true,
      titleAlign: "center", titleRule: "line", titleCase: false, titleWeight: "700",
      headingCase: false, articleNumberLayout: "inline", articleDivider: "none",
      ruleStyle: "line", enactStyle: "plain", mentionStyle: "left",
      tableStyle: "grid", signatureAlign: "right", signatureStyle: "line",
      frameStyle: "none", showHeader: false, showFooter: false,
    },
  },
  {
    id: "moderne",
    label: "Moderne",
    hint: "Sans empattement, intitulé à gauche en capitales, formule DÉCIDE en bandeau, mentions encadrées, tableaux en lignes seules.",
    values: {
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      fontSize: "10.5", lineHeight: "1.55", justify: true, letterSpacing: "0.005",
      titleAlign: "left", titleCase: true, titleRule: "line", titleWeight: "600",
      headingCase: false, articleNumberLayout: "inline", articleDivider: "dotted",
      ruleStyle: "line", enactStyle: "band", mentionStyle: "box",
      tableStyle: "rows", signatureAlign: "left", signatureStyle: "box",
      frameStyle: "none", showHeader: false, showFooter: false,
    },
  },
  {
    id: "solennel",
    label: "Solennel",
    hint: "Capitales, cadre double autour de la page, intitulé à double filet, numéros d'article dans la marge, mentions sur fond.",
    values: {
      fontFamily: "'Times New Roman', Times, Georgia, serif",
      fontSize: "11", lineHeight: "1.5", justify: true,
      titleAlign: "center", titleCase: true, titleRule: "double", titleWeight: "700",
      headingCase: true, articleNumberLayout: "margin", articleDivider: "none",
      ruleStyle: "double", enactStyle: "rule", mentionStyle: "tinted",
      tableStyle: "grid", signatureAlign: "right", signatureStyle: "line",
      frameStyle: "double", frameWidth: "2", frameSpace: "8",
      showHeader: false, showFooter: false,
    },
  },
  {
    id: "sobre",
    label: "Sobre",
    hint: "Aucun filet, aucune couleur : le texte seul, justifié. Pour les documents qui seront relus à l'écran.",
    values: {
      fontFamily: "'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      fontSize: "10.5", lineHeight: "1.6", justify: false,
      titleAlign: "left", titleCase: false, titleRule: "none", titleWeight: "700",
      headingCase: false, articleNumberLayout: "inline", articleDivider: "none",
      ruleStyle: "none", enactStyle: "plain", mentionStyle: "plain",
      tableStyle: "rows", signatureAlign: "left", signatureStyle: "plain",
      frameStyle: "none", showHeader: false, showFooter: false,
    },
  },
  {
    id: "recueil",
    label: "Recueil communal",
    hint: "En-tête et pied de page, intitulé en capitales centré, considérants en italique, tableaux à lignes alternées.",
    values: {
      fontFamily: "'Times New Roman', Times, Georgia, serif",
      fontSize: "11", lineHeight: "1.5", justify: true,
      titleAlign: "center", titleCase: true, titleRule: "line", titleWeight: "700",
      headingCase: false, articleNumberLayout: "inline", articleDivider: "line",
      ruleStyle: "line", enactStyle: "band", mentionStyle: "left",
      tableStyle: "zebra", signatureAlign: "right", signatureStyle: "box",
      frameStyle: "none", showHeader: true, showFooter: true,
      headerRule: true, recitalsItalic: true, visasLabelStyle: "italic",
      headerText: "{{brand.name}} — recueil des actes administratifs",
      footerText: "{{brand.name}} — acte n°{{numero}} du {{dateSignature}}",
      pageMarginTop: "18",
    },
  },
  {
    id: "individuel",
    label: "Acte individuel",
    hint: "Notification : sans en-tête, intitulé à double filet, numéro d'article au-dessus du titre, mention encadrée.",
    values: {
      fontFamily: "'Times New Roman', Times, Georgia, serif",
      fontSize: "10.5", lineHeight: "1.45", justify: true,
      titleAlign: "center", titleCase: true, titleRule: "double", titleWeight: "700",
      headingCase: true, articleNumberLayout: "block", articleDivider: "none",
      ruleStyle: "line", enactStyle: "plain", mentionStyle: "box",
      mentionSize: "0.88", tableStyle: "grid", signatureAlign: "right",
      signatureStyle: "line", signatureSpace: "46", signatureNameWeight: "700",
      frameStyle: "none", showHeader: false, showFooter: false,
    },
  },
  // Les deux modèles « charte de l'État ». Le premier applique la charte de
  // l'État à ses documents — la typographie Marianne et le bleu France —, mais
  // elle est RÉSERVÉE à l'État et à ses opérateurs : le logiciel ne peut donc
  // livrer ni la police Marianne ni le bloc-marque, qui restent à la charge de
  // l'administration qui en a le droit. Le second en reprend la sobriété et les
  // couleurs SANS ces éléments réservés (police Arial, identité de la
  // collectivité) : c'est celui que prendront les collectivités. Voir la charte
  // officielle : https://www.info.gouv.fr/marque-de-letat/charte-graphique-introduction
  {
    id: "etat",
    label: "Charte graphique de l'État (réservé à l'État et à ses opérateurs)",
    badge: "réservé",
    badgeKind: "warning",
    hint: "Bleu France (#000091) et typographie Marianne : la charte de l'État, son en-tête et son filet. Réservée à l'État et à ses opérateurs — la police Marianne et le bloc-marque ne sont pas livrés (installez la police, ajoutez votre bloc-marque au logo).",
    values: {
      // `Marianne` d'abord, avec des replis : la police officielle si le poste
      // l'a, sinon une sans empattement sobre.
      fontFamily: "Marianne, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
      fontSize: "11", lineHeight: "1.5", justify: true, letterSpacing: "0",
      color: "#000091", ink: "#1E1E1E", muted: "#666666", ruleColor: "#000091",
      titleFont: "", titleSize: "1.1", titleWeight: "700", titleCase: false,
      titleAlign: "center", titleRule: "line", titleColor: "#000091", titleMargin: "1",
      authorityAlign: "left", authorityItalic: false,
      headingFont: "", headingSize: "1", headingWeight: "700", headingColor: "#000091",
      headingCase: false, headingRule: "none", articleNumberLayout: "inline",
      visasLabelStyle: "plain", recitalsItalic: false,
      ruleStyle: "line", articleDivider: "none",
      enactStyle: "plain", enactCase: false,
      mentionStyle: "plain", mentionSize: "0.9", mentionItalic: false,
      tableStyle: "grid", signatureAlign: "right", signatureStyle: "line",
      signatureSpace: "40", signatureWidth: "40", signatureNameWeight: "700",
      frameStyle: "none",
      showHeader: true, logoAlign: "left", logoHeight: "44",
      headerText: "République française — {{entity.name}}", headerRule: true,
      headerSize: "0.8", headerItalic: false, headerCase: false,
      showFooter: false,
    },
  },
  {
    id: "marianne",
    label: "Marianne-like (inspiré de la charte de l'État)",
    badge: "libre",
    hint: "Inspirée de la charte de l'État, sans ses éléments réservés : mêmes couleurs (bleu France #000091, noir) et même sobriété, mais en Arial et avec l'identité de votre collectivité. Utilisable par toute administration.",
    values: {
      fontFamily: "Arial, 'Helvetica Neue', Helvetica, sans-serif",
      fontSize: "11", lineHeight: "1.5", justify: true, letterSpacing: "0",
      color: "#000091", ink: "#1E1E1E", muted: "#666666", ruleColor: "#000091",
      titleFont: "", titleSize: "1.08", titleWeight: "700", titleCase: false,
      titleAlign: "left", titleRule: "line", titleColor: "#000091", titleMargin: "1",
      authorityAlign: "left", authorityItalic: false,
      headingFont: "", headingSize: "1", headingWeight: "700", headingColor: "#000091",
      headingCase: false, headingRule: "none", articleNumberLayout: "inline",
      visasLabelStyle: "plain", recitalsItalic: false,
      ruleStyle: "line", articleDivider: "none",
      enactStyle: "plain", enactCase: false,
      mentionStyle: "left", mentionSize: "0.9", mentionItalic: false,
      tableStyle: "rows", signatureAlign: "right", signatureStyle: "line",
      signatureSpace: "40", signatureWidth: "40", signatureNameWeight: "700",
      frameStyle: "none",
      showHeader: true, logoAlign: "left", logoHeight: "44",
      headerText: "{{entity.name}}", headerRule: true,
      headerSize: "0.85", headerItalic: false, headerCase: false,
      showFooter: false,
    },
  },
];

// Applique un préréglage à une feuille : les valeurs du préréglage, le reste
// inchangé. Renvoie une NOUVELLE feuille (l'écran remplace l'ancienne).
export function applyPreset(style, presetId) {
  const p = STYLE_PRESETS.find((x) => x.id === presetId);
  if (!p) return emptyStyle(style || {});
  return emptyStyle({ ...(style || {}), ...p.values });
}

// --------------------------------------------------------------- CSS

// Éclaircit une couleur (mélange vers le blanc) : sert aux fonds discrets
// (bandeaux, encadrés, lignes alternées), sans dépendre de `color-mix`.
function tint(hex, amount = 0.9) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return "#f2f2f6";
  const n = parseInt(m[1], 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return "#" + [mix((n >> 16) & 255), mix((n >> 8) & 255), mix(n & 255)]
    .map((x) => x.toString(16).padStart(2, "0")).join("");
}

const RULE_BORDER = { line: "solid", double: "double", dotted: "dotted" };
// La marque des listes à puces (`ul`). `decimal` y subsiste pour les feuilles
// enregistrées avant que la numérotation ait son propre réglage : leur valeur
// reste rendue à l'identique.
const LIST_MARKER = { disc: "disc", circle: "circle", square: "square", dash: "'– '", decimal: "decimal", none: "none" };
// La numérotation des listes numérotées (`ol`), par leur nom de compteur CSS.
const LIST_NUMBER = {
  decimal: "decimal",
  degree: "scribae-degree",
  parenth: "scribae-parenth",
  lalpha: "scribae-lalpha",
  ualpha: "scribae-ualpha",
  lroman: "scribae-lroman",
  uroman: "scribae-uroman",
  none: "none",
};
// Les compteurs sur mesure : `extends` reprend le compteur natif et n'en change
// que le suffixe — « 1° », « 1) », « a) »… Rien à calculer, et la numérotation
// reste continue d'une liste à l'autre comme celle du navigateur.
const COUNTER_STYLES = {
  "scribae-degree": 'system:extends decimal;suffix:"°"',
  "scribae-parenth": 'system:extends decimal;suffix:")"',
  "scribae-lalpha": 'system:extends lower-alpha;suffix:")"',
  "scribae-ualpha": 'system:extends upper-alpha;suffix:")"',
  "scribae-lroman": 'system:extends lower-roman;suffix:"."',
  "scribae-uroman": 'system:extends upper-roman;suffix:"."',
};
// Les côtés d'un encadré : « tblr » = haut, droite, bas, gauche. On ne trace que
// les côtés retenus, côté par côté, plutôt que par le raccourci `border` : c'est
// ce qui permet un filet en haut seul, ou un encadré ouvert d'un côté.
const BOX_SIDES = [["t", "top"], ["r", "right"], ["b", "bottom"], ["l", "left"]];
const boxSides = (sides, decl) => {
  // Une valeur absente vaut l'encadré complet ; une valeur vide (« aucun côté »)
  // est une case comme une autre — on ne la remplace pas par le défaut.
  const on = sides == null ? "tblr" : String(sides);
  return BOX_SIDES.filter(([k]) => on.includes(k)).map(([, name]) => `border-${name}:${decl}`);
};
const AUTHORITY_ALIGN = { left: "left", center: "center", right: "right" };

// Le CSS d'une feuille. `scope` permet de le confiner à un document précis
// (aperçu dans l'application : `[data-sheet="…"]`) ; vide, il s'applique à la
// page entière (HTML autonome, Word, version publiée — une seule feuille) et
// porte alors aussi le papier : `.paper` et sa règle `@page`.
export function styleCss(style, config, { scope = "" } = {}) {
  const s = emptyStyle(style || {});
  const ink = s.ink || "#111111";
  const muted = s.muted || "#555555";
  const accent = s.color || "#000091";
  const rule = s.ruleColor || accent;
  const soft = tint(accent, 0.9);
  const neutral = tint(ink, 0.94);
  const gridLine = tint(ink, 0.72);
  const font = s.fontFamily || FONT_DEFAULT;
  const titleFont = s.titleFont || font;
  const headingFont = s.headingFont || font;
  const headingColor = s.headingColor || ink;
  const titleColor = s.titleColor || headingColor;
  const frameColor = s.frameColor || rule;
  const W = pxv(s.ruleWidth, "1px");
  const border = RULE_BORDER[s.ruleStyle] || "solid";
  const A = (sel) => sel.split(",").map((x) => (scope ? scope + " " + x.trim() : x.trim())).join(",");
  const R = (sel) => (scope ? scope + sel : sel);

  const w = [];
  const rule2 = (sel, decls) => w.push(`${sel}{${decls}}`);
  // Un encadré : seuls les côtés retenus sont tracés (`boxSides`). Sans côté,
  // rien n'est écrit — la casse d'un encadré est un réglage comme un autre.
  const ruleBox = (sel, sides, decl) => { const d = boxSides(sides, decl); if (d.length) rule2(sel, d.join(";")); };

  // -- corps du document
  // La règle porte aussi la PALETTE, sous forme de variables : les réglages
  // posés bloc par bloc (encadré d'un paragraphe, filets d'un tableau —
  // voir `paramsBloc`, lib/schema.js) s'y réfèrent, et suivent donc la charte
  // de la collectivité au lieu de coder des couleurs en dur.
  rule2(R(".doc"),
    `font-family:${font};font-size:${ptv(s.fontSize, "11pt")};line-height:${num(s.lineHeight, 1.5)};color:${ink}`
    + `;letter-spacing:${emv(s.letterSpacing, "0em")}`
    + `;--doc-ink:${ink};--doc-muted:${muted};--doc-rule:${rule};--doc-grid:${gridLine};--doc-soft:${soft};--doc-neutral:${neutral};--doc-heading:${headingColor}`
    + (s.hyphens ? ";hyphens:auto;-webkit-hyphens:auto" : ""));

  // -- cadre de page : un filet (ou deux) tout autour du texte
  if (s.frameStyle && s.frameStyle !== "none") {
    const fborder = s.frameStyle === "double"
      ? `3px double ${frameColor}`
      : `${s.frameStyle === "heavy" ? pxv(s.frameWidth, "3px") : W} solid ${frameColor}`;
    rule2(R(".doc"), `border:${fborder};padding:${mmv(s.frameSpace, "6mm")}`);
  }

  // -- paragraphes
  rule2(A(".doc-p, .doc-recitals p, .doc-visas li, .doc-list li, .doc-mention, .doc-quote, .doc-authority"),
    `text-align:${s.justify ? "justify" : "left"}`);
  rule2(A(".doc-p"), `text-indent:${emv(s.paraIndent, "0em")};margin:0 0 ${emv(s.paraSpacing, "0.55em")}`);
  rule2(A(".doc-article"), `margin-bottom:${emv(s.articleSpacing, "1em")}`);

  // -- intitulé
  rule2(A(".doc-title"),
    `font-family:${titleFont};font-size:${emv(s.titleSize, "1.06em")};font-weight:${s.titleWeight || "700"};`
    + `text-align:${s.titleAlign || "center"};color:${titleColor};margin:0 0 ${emv(s.titleMargin, "0.9em")};`
    + (s.titleCase ? `text-transform:uppercase;letter-spacing:${emv(s.titleSpacing, "0.02em")};` : ""));
  if (s.titleRule === "line") rule2(A(".doc-title"), `border-bottom:${W} ${border} ${rule};padding-bottom:.35em`);
  if (s.titleRule === "double") rule2(A(".doc-title"), `border-bottom:3px double ${rule};padding-bottom:.35em`);
  if (s.titleRule === "underline") rule2(A(".doc-title"), "text-decoration:underline;text-underline-offset:4px");
  if (s.titleRule === "box") { rule2(A(".doc-title"), "padding:.5em .8em"); ruleBox(A(".doc-title"), s.titleBoxSides, `${W} ${border} ${rule}`); }

  // -- formule d'autorité
  rule2(A(".doc-authority"),
    `text-align:${AUTHORITY_ALIGN[s.authorityAlign] || "left"};font-size:${emv(s.authoritySize, "1em")}`
    + (s.authorityItalic ? ";font-style:italic" : ""));

  // -- visas et considérants
  rule2(A(".doc-visas"), `list-style:${s.visasBullet ? "disc" : "none"};padding-left:${pxv(s.visasIndent, "0px")}`);
  if (s.visasLabelStyle === "italic") rule2(A(".doc-visas-label"), "font-style:italic");
  if (s.visasLabelStyle === "bold") rule2(A(".doc-visas-label"), "font-weight:700");
  if (s.visasLabelStyle === "smallcaps") rule2(A(".doc-visas-label"), "font-variant:small-caps;letter-spacing:.02em");
  rule2(A(".doc-recitals"), `padding-left:${pxv(s.recitalsIndent, "0px")}`);
  if (s.recitalsItalic) rule2(A(".doc-recitals p"), "font-style:italic");

  // -- intitulés d'article
  rule2(A(".doc-article-head"),
    `font-family:${headingFont};font-size:${emv(s.headingSize, "1em")};font-weight:${s.headingWeight || "700"};color:${headingColor}`
    + (s.headingCase ? ";text-transform:uppercase;letter-spacing:.01em" : ""));
  rule2(A(".doc-article-num"), `color:${headingColor}`);
  if (s.headingRule === "line") rule2(A(".doc-article-head"), `border-bottom:${W} solid ${rule};padding-bottom:.2em`);
  if (s.headingRule === "dotted") rule2(A(".doc-article-head"), `border-bottom:${W} dotted ${rule};padding-bottom:.2em`);
  if (s.headingRule === "box") { rule2(A(".doc-article-head"), "padding:.35em .6em;margin-bottom:.55em"); ruleBox(A(".doc-article-head"), s.headingBoxSides, `${W} ${border} ${rule}`); }
  // Le numéro d'article au-dessus du titre, ou dans la marge de gauche.
  if (s.articleNumberLayout === "block") rule2(A(".doc-article-num"), "display:block;margin-bottom:.1em");
  if (s.articleNumberLayout === "margin") {
    rule2(A(".doc-article-head"), "position:relative");
    rule2(A(".doc-article-num"), "position:absolute;left:-7em;width:6.5em;text-align:right;top:0");
  }

  // -- diviseur entre les articles
  if (s.articleDivider && s.articleDivider !== "none") {
    const st = RULE_BORDER[s.articleDivider] || "solid";
    rule2(A(".doc-article"), `border-top:${W} ${st} ${rule};padding-top:.9em;margin-top:.4em`);
    rule2(A(".doc-article:first-of-type"), "border-top:none;padding-top:0");
  }

  // -- listes : la puce des listes à puces, la numérotation des listes
  //    numérotées. Le rédacteur choisit le genre, bloc par bloc.
  const indent = pxv(s.listIndent, "22px");
  rule2(A("ul.doc-list"), `list-style-type:${LIST_MARKER[s.listMarker] || "disc"};padding-left:${indent}`);
  const numbering = LIST_NUMBER[s.listNumbering] || "decimal";
  rule2(A("ol.doc-list"), `list-style-type:${numbering};padding-left:${indent}`);
  // Tous les compteurs sur mesure sont déclarés, pas seulement celui de la
  // feuille : une liste peut choisir sa numérotation BLOC PAR BLOC (« 1° »,
  // « a) », « i. » — voir `paramsBloc`, lib/schema.js) sans que l'on touche à
  // la charte. Six règles de plus, et toutes les numérotations restent
  // possibles partout.
  for (const [name, decl] of Object.entries(COUNTER_STYLES)) w.push(`@counter-style ${name}{${decl}}`);

  // -- formule d'édiction
  if (s.enactStyle === "rule") rule2(A(".doc-enact"), `border-top:${W} solid ${rule};border-bottom:${W} solid ${rule};padding:.35em 0`);
  if (s.enactStyle === "band") rule2(A(".doc-enact"), `background:${soft};border-top:1px solid ${rule};border-bottom:1px solid ${rule};padding:.5em;color:${headingColor}`);
  if (s.enactStyle === "box") { rule2(A(".doc-enact"), "padding:.55em;background:#fff"); ruleBox(A(".doc-enact"), s.enactBoxSides, `1px solid ${rule}`); }
  if (s.enactCase) rule2(A(".doc-enact"), "text-transform:uppercase;letter-spacing:.04em");

  // -- mentions (recours, publication, notification)
  rule2(A(".doc-mention"), `font-size:${emv(s.mentionSize, "0.92em")}`);
  if (s.mentionItalic) rule2(A(".doc-mention"), "font-style:italic");
  if (s.mentionStyle === "left") rule2(A(".doc-mention"), `border-left:3px solid ${rule};padding-left:.7em`);
  if (s.mentionStyle === "box") { rule2(A(".doc-mention"), "padding:.5em .7em"); ruleBox(A(".doc-mention"), s.mentionBoxSides, `1px solid ${rule}`); }
  if (s.mentionStyle === "tinted") rule2(A(".doc-mention"), `background:${neutral};border-left:3px solid ${rule};padding:.5em .7em`);

  // -- tableaux
  rule2(A(".doc-table"), `font-size:${emv(s.tableFontSize, "0.92em")}`);
  rule2(A(".doc-table th, .doc-table td"), `padding:${pxv(s.tableCellPadding, "3px")} 6px`);
  rule2(A(".doc-table-caption"), `text-align:${s.tableCaptionAlign || "left"}${s.tableCaptionCase ? ";text-transform:uppercase;letter-spacing:.02em" : ""}`);
  if (s.tableStyle === "rows") {
    rule2(A(".doc-table th, .doc-table td"), `border:0;border-bottom:1px solid ${gridLine}`);
    rule2(A(".doc-table th"), `background:transparent;border-bottom:2px solid ${rule};color:${headingColor}`);
  } else if (s.tableStyle === "zebra") {
    rule2(A(".doc-table th, .doc-table td"), `border:1px solid ${gridLine}`);
    rule2(A(".doc-table th"), `background:${soft};color:${headingColor}`);
    rule2(A(".doc-table tbody tr:nth-child(even)"), `background:${neutral}`);
  } else {
    rule2(A(".doc-table th"), `background:${neutral}`);
  }

  // -- signature
  // Le bloc de signature est, dans le corps du document, placé après la ligne
  // « Fait à …, le … ». Pour le mettre à gauche, on remonte le bloc dans l'ordre
  // d'affichage (`order`) et on repousse la ligne de lieu à droite par une marge
  // automatique — la méthode des marges doubles donnait un résultat flottant.
  if (s.signatureAlign === "left") {
    rule2(A(".doc-signature"), "justify-content:flex-start");
    rule2(A(".doc-signature-block"), "order:-1");
    rule2(A(".doc-signature-place"), "margin-left:auto;text-align:right");
  } else {
    rule2(A(".doc-signature-block"), "margin-left:auto");
  }
  rule2(A(".doc-signature-block"), `min-width:${num(s.signatureWidth, 40)}%`);
  rule2(A(".doc-signature-name"), `font-weight:${s.signatureNameWeight || "400"}`);
  if (s.signatureFunctionItalic) rule2(A(".doc-signature-role"), "font-style:italic");
  if (s.signatureStyle === "line") rule2(A(".doc-signature-block"), `border-top:${W} solid ${ink};padding-top:${pxv(s.signatureSpace, "40px")}`);
  if (s.signatureStyle === "box") { rule2(A(".doc-signature-block"), `padding:${pxv(s.signatureSpace, "40px")} 14px 10px`); ruleBox(A(".doc-signature-block"), s.signatureBoxSides, `${W} dashed ${rule}`); }

  // -- en-tête (logo + texte) et pied de page
  const headerRule = s.headerRule && s.ruleStyle !== "none";
  rule2(A(".doc-sheet-header"),
    `display:flex;gap:14px;align-items:center;justify-content:flex-start;`
    + `margin:0 0 ${headerRule ? "14px" : "10px"};`
    + (headerRule ? `border-bottom:${W} ${border} ${rule};padding-bottom:10px` : ""));
  rule2(A(".doc-sheet-header") + '[data-align="center"]', "justify-content:center;text-align:center");
  rule2(A(".doc-sheet-header") + '[data-align="right"]', "justify-content:flex-end;text-align:right");
  rule2(A(".doc-sheet-logo"), `height:${pxv(s.logoHeight, "42px")};width:auto;max-width:45%;flex:none`);
  rule2(A(".doc-sheet-headtext"),
    `margin:0;font-family:${headingFont};font-size:${emv(s.headerSize, "0.86em")};color:${muted}`
    + (s.headerItalic ? ";font-style:italic" : "")
    + (s.headerCase ? ";text-transform:uppercase;letter-spacing:.03em" : ""));
  rule2(A(".doc-sheet-footer"),
    `margin-top:1.6em;padding-top:8px;border-top:${W} ${border} ${rule};font-size:${emv(s.footerSize, "0.78em")};`
    + `color:${muted};text-align:${s.footerAlign || "center"}`
    + (s.footerItalic ? ";font-style:italic" : ""));

  // -- le papier lui-même : ses marges et la règle `@page` du PDF. Uniquement
  //    dans un document exporté (`scope` vide) : dans l'application, plusieurs
  //    papiers cohabitent, et c'est la variable CSS `--paper-pad` posée par la
  //    vue qui porte ces marges (voir `paperPadding`).
  if (!scope) {
    rule2(".paper", `padding:${paperPadding(s)}`);
    w.push(paperPageCss(s));
  }

  return w.join("\n");
}

// Tout le CSS dont l'aperçu de l'application a besoin : chaque feuille confinée
// à ses propres documents (`data-sheet`). Idempotent, appelé à chaque
// changement du référentiel.
export function styleRuntimeCss(config) {
  const list = stylesOf(config);
  const sheets = list.length ? list : [legacyStyleFromBrand(config?.brand)];
  return sheets.map((s) => styleCss(s, config, { scope: `[data-sheet="${s.id}"]` })).join("\n");
}

// La règle `@page` de la feuille GÉNÉRALE : le navigateur l'applique quand on
// imprime directement l'aperçu de l'application (Ctrl+P). Les documents exportés
// (« Imprimer / PDF », Word, HTML autonome) portent, eux, la feuille de l'acte.
export function generalPageCss(config) {
  return paperPageCss(generalStyle(config));
}

// --------------------------------------------------------------- aperçu

// Un acte type, complet (intitulé, visas, considérants, articles, tableau,
// signature, mentions) : c'est sur lui que l'administrateur règle sa charte.
// Même structure que les documents compilés — le rendu, lui, est le vrai.
export function sampleDocument(config, style) {
  const entId = (style?.entityIds || [])[0];
  const entity = (config?.entities || []).find((e) => e.id === entId) || (config?.entities || [])[0]
    || { id: "org", name: config?.brand?.name || "La collectivité", nameWithArt: config?.brand?.name || "la collectivité", code: "ORG", seatCity: "…" };
  const dateSignature = "2026-09-19";
  return {
    kind: "original",
    meta: {
      numero: "2026-042-" + (entity.code || "ORG"),
      objet: "attribution d'une subvention à l'association Les Jardins Partagés",
      entity,
      org: entity,
      dateSignature,
      actTypeId: (config?.actTypes || [])[0]?.id || "arrete",
      familyId: (style?.familyIds || [])[0] || "",
      trameName: "Acte type",
      trameVersion: "démo",
      styleId: style?.id || "",
      generatedAt: new Date().toISOString(),
    },
    nodes: [
      { type: "title", text: `Arrêté n°2026-042-${entity.code || "ORG"} du 19 septembre 2026 portant attribution d'une subvention à l'association Les Jardins Partagés` },
      { type: "authority", text: `${entity.authorityFormula || "L'autorité compétente"}` },
      {
        type: "visas",
        items: [
          { id: "v1", text: "le code général des collectivités territoriales, notamment ses articles L. 2122-18 à L. 2122-20," },
          { id: "v2", text: "le code des relations entre le public et l'administration," },
          { id: "v3", text: "la délibération du conseil municipal n°2026-021 du 9 avril 2026 portant vote du budget primitif 2026," },
        ],
      },
      {
        type: "considerants",
        items: [
          { id: "c1", text: "Considérant que la collectivité soutient les initiatives associatives locales ;" },
          { id: "c2", text: "Considérant que le projet présenté concourt à l'animation du quartier des Jardins ;" },
        ],
      },
      { type: "enact", text: "ARRÊTE" },
      {
        type: "article", numLabel: "Article 1er", heading: "Objet",
        blocks: [{ type: "para", text: "Une subvention de fonctionnement d'un montant de 4 500 € est attribuée à l'association Les Jardins Partagés au titre des activités de jardinage collectif." }],
      },
      {
        type: "article", numLabel: "Article 2", heading: "Conditions",
        blocks: [
          { type: "para", text: "Cette subvention est soumise aux conditions suivantes :" },
          { type: "list", ordered: false, items: [
            { id: "l1", text: "la production d'un compte rendu d'emploi des fonds dans les six mois suivant la clôture de l'exercice ;" },
            { id: "l2", text: "la mention du concours de la collectivité dans les supports de communication de l'association ;" },
            { id: "l3", text: "l'information immédiate de la collectivité en cas de changement de dirigeants." },
          ] },
          { type: "para", text: "Elle est en outre soumise aux obligations suivantes :" },
          // Une liste NUMÉROTÉE, pour que l'écran des feuilles de style montre
          // aussi la numérotation (1°, a), i… ) à côté de la puce.
          { type: "list", ordered: true, items: [
            { id: "n1", text: "justifier de la tenue d'une comptabilité séparée pour l'opération subventionnée ;" },
            { id: "n2", text: "signaler sans délai toute modification statutaire ou changement de représentant légal ;" },
            { id: "n3", text: "restituer les sommes non employées au terme de l'exercice." },
          ] },
        ],
      },
      {
        type: "article", numLabel: "Article 3", heading: "Emploi des fonds",
        blocks: [{
          type: "table", caption: "Emploi prévisionnel de la subvention",
          columns: ["Poste", "Détail", "Montant"],
          rows: [["Fournitures", "Graines, plants et outillage", "1 200 €"], ["Animations", "Ateliers ouverts au public", "2 300 €"], ["Fonctionnement", "Assurance et frais divers", "1 000 €"]],
        }],
      },
      { type: "signature", place: entity.seatCity || "…", date: "19 septembre 2026", signataire: { civility: "Madame", firstName: "Claire", lastName: "FAURE", fonction: "Maire" } },
      { type: "mention", kind: "recours", text: "Conformément à l'article R.421-1 du code de justice administrative, le présent arrêté peut faire l'objet d'un recours gracieux ou, à défaut, d'un recours contentieux auprès du tribunal administratif territorialement compétent dans un délai de deux mois à compter de sa publication." },
      { type: "mention", kind: "publication", text: `Le présent arrêté est publié au recueil des actes administratifs de ${entity.nameWithArt || entity.name}.` },
    ],
  };
}
