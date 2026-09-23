// ============================================================================
// PDF/A — l'export d'archivage.
//
// La norme ISO 19005 (« PDF/A ») décrit un PDF fait pour durer : un fichier qui
// se lira encore dans vingt ans, sur une machine qui n'a ni les polices, ni le
// profil colorimétrique, ni le logiciel d'aujourd'hui. Trois règles le
// distinguent d'un PDF ordinaire, et commandent tout ce module :
//
//   • les POLICES doivent être EMBARQUÉES (un sous-ensemble suffit) : le
//     fichier ne dépend d'aucune police du poste — ni Times New Roman, ni
//     Segoe UI, ni les polices standard du format PDF, qui ne s'embarquent pas ;
//   • le fichier doit déclarer son espace colorimétrique par un « OutputIntent »
//     (un profil ICC sRVB, déposé dans le fichier) ;
//   • le fichier doit porter ses MÉTADONNÉES en XMP, et annoncer son niveau de
//     conformité (les propriétés « part » et « conformance » de PDF/A).
//
// Deux niveaux sont proposés, dans le même fichier de code :
//
//   • PDF/A-2b (2011, ISO 19005-2) — le niveau recommandé : bâti sur PDF 1.7,
//     il admet les flux d'objets et un profil ICC v4 ;
//   • PDF/A-1b (2005, ISO 19005-1) — le niveau historique, exigé par certains
//     services d'archivage : bâti sur PDF 1.4, sans flux d'objets, et il faut
//     alors un en-tête de fichier « %PDF-1.4 ».
//
// Le « b » (basic) est le niveau VISUEL : il garantit que le document se
// reproduira à l'identique. Le niveau « a » (accessible) exigerait en plus un
// étiquetage complet du contenu, qui n'est pas le sujet ici.
//
// Ce module fait deux choses, et rien d'autre :
//
//   1. il MET EN PAGE le document — les nœuds du document compilé : intitulé,
//      autorité, visas, considérants, formule d'édiction, articles, divisions,
//      tableaux, listes, annexes, signature, mentions — sur du papier A4, en
//      suivant la CHARTE de l'acte. C'est le rôle de la classe Feuille et des
//      fonctions « poser… » ;
//   2. il ASSEMBLE le fichier PDF/A — polices embarquées, profil
//      colorimétrique, métadonnées XMP, identifiant ELI — c'est le rôle de
//      `creerPdfA`.
//
// Aucune bibliothèque de rendu HTML n'est employée : le document est écrit
// directement dans le PDF. Il en faut plus de code, mais le fichier produit est
// un vrai PDF/A — texte sélectionnable et cherchable, police embarquée,
// métadonnées — et non l'image d'une page ou un HTML imprimé.
//
// CE QUI EST RESPECTÉ DE LA CHARTE : marges du papier, cadre de page, famille
// de police (à empattements ou sans empattement), corps de texte, interligne,
// justification, couleurs (encre, accent, filets), intitulé (taille, graisse,
// capitales, alignement, filet, encadré), formule d'autorité (alignement,
// graisse), visas (étiquette, retrait), considérants (retrait, italique),
// intitulés d'article (graisse, capitales, filet, position du numéro),
// diviseurs entre articles, listes (puce, numérotation, retrait), tableaux
// (genre, marges internes, légende), formule d'édiction, mentions, bloc de
// signature (alignement, filet ou encadré), en-tête et pied de page (texte,
// filet, logo).
//
// CE QUI NE L'EST PAS, et pourquoi : les césures automatiques et l'espacement
// des lettres (le PDF ne les compose pas comme un navigateur), et la police
// exacte — deux familles libres sont embarquées, là où la charte en nomme une
// du poste (voir src/pdfa/README.md). Un mot peut donc changer de ligne par
// rapport à l'aperçu ; les marges, les corps de texte et les blocs, eux, ne
// bougent pas. Les marques d'ajout et de suppression des versions consolidées
// sont rendues par un soulignement et un barré — qui, eux, s'impriment.
//
// La charte appliquée est CELLE DE L'ACTE : l'export papier suit l'entité
// signataire, comme le fichier Word ou l'original signé. C'est la version EN
// LIGNE, elle, qui ne suit aucune charte (voir src/lib/eli.js).
// ============================================================================
import { emptyStyle, paperMargins, tint } from "./styles.js";
import { personRoleLines, personSignatureName, renderSheetText } from "./render.js";
import { amendmentMention, amendmentMentions } from "./amend.js";
import { annexesVocab } from "./annexes.js";
import { download, formatDate } from "./util.js";

// ------------------------------------------------------- constantes de mesure
// Le point PostScript (1/72 de pouce) est l'unité du PDF, le millimètre celle
// du papier A4, et le pixel celle du CSS de la charte.
const MM_PT = 72 / 25.4;
const PX_PT = 0.75;
const PAGE = { largeur: 595.276, hauteur: 841.89 };
const PDFLIB = "https://esm.sh/pdf-lib@1.17.1";
const FONTKIT = "https://esm.sh/@pdf-lib/fontkit@1.1.1";

// Les deux familles embarquées, et leurs quatre graisses. Voir
// src/pdfa/README.md : ce sont les instances STATIQUES de Source Serif 4 et de
// Source Sans 3 (embarquer une police variable ne retiendrait que sa graisse
// par défaut, et le gras comme l'italique seraient perdus).
const FICHIERS_POLICE = {
  serif: {
    normal: "SourceSerif4-Regular.ttf",
    bold: "SourceSerif4-Bold.ttf",
    italic: "SourceSerif4-It.ttf",
    boldItalic: "SourceSerif4-BoldIt.ttf",
  },
  sans: {
    normal: "SourceSans3-Regular.ttf",
    bold: "SourceSans3-Bold.ttf",
    italic: "SourceSans3-It.ttf",
    boldItalic: "SourceSans3-BoldIt.ttf",
  },
};

// Les niveaux proposés, dans l'ordre où l'interface les présente.
export const NIVEAUX_PDFA = [
  { part: 2, label: "PDF/A-2b", hint: "Le niveau recommandé : PDF 1.7, profil ICC v4 admis (ISO 19005-2)." },
  { part: 1, label: "PDF/A-1b", hint: "Le niveau historique, exigé par certains services d'archivage : PDF 1.4 (ISO 19005-1)." },
];

// ------------------------------------------------------- chargement des outils
// pdf-lib (écriture du PDF) et fontkit (polices) sont chargés À LA DEMANDE : le
// premier export les télécharge, les suivants les réutilisent. Rien n'alourdit
// le démarrage de l'application.
let outils = null;
let pdfLib = null;
function chargerOutils() {
  if (!outils) {
    outils = Promise.all([import(PDFLIB), import(FONTKIT)]).then(([lib, kit]) => {
      pdfLib = lib;
      return { ...lib, fontkit: kit.default || kit };
    });
  }
  return outils;
}

// Une ressource embarquée (police, profil ICC). Le chemin est RELATIF au
// module : l'application est servie aussi bien depuis un sous-domaine de la
// plateforme que depuis un déploiement auto-hébergé, et les deux servent src/ à
// côté de la page.
const cacheRessources = new Map();
function lireRessource(nom, dossier = "") {
  const cle = (dossier ? dossier + "/" : "") + nom;
  if (!cacheRessources.has(cle)) {
    cacheRessources.set(cle, fetch(new URL("../pdfa/" + cle, import.meta.url))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error("Ressource PDF/A introuvable : " + cle))))
      .then((b) => new Uint8Array(b)));
  }
  return cacheRessources.get(cle);
}

// ------------------------------------------------------------- petites conversions
const nombre = (v, def) => {
  const n = parseFloat(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : def;
};

// La variante de police qu'appellent une graisse et une pente. Le seuil est
// celui du CSS : à partir de 600, c'est du gras.
const varianteDe = (graisse, italique) => (Number(graisse) >= 600
  ? (italique ? "boldItalic" : "bold")
  : (italique ? "italic" : "normal"));

// Une couleur CSS (#rgb, #rrggbb) vers les composantes du PDF (0 à 1). Une
// valeur illisible donne le repli, jamais une exception : un export ne s'arrête
// pas pour une couleur mal écrite dans une charte.
function couleur(hex, repli = "#111111") {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || "").trim());
  const t = m ? (m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1]) : String(repli).replace("#", "");
  const n = parseInt(t, 16);
  if (!Number.isFinite(n)) return { r: 0.07, g: 0.07, b: 0.07 };
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}

// La couleur d'un plan, dans la forme qu'attend pdf-lib.
function rvb(c) {
  return pdfLib ? pdfLib.rgb(c.r, c.g, c.b) : { type: "RGB", red: c.r, green: c.g, blue: c.b };
}

// La CATÉGORIE d'une pile de polices : « serif » ou « sans ». La chasse fixe est
// rendue en sans : aucune chasse fixe n'est embarquée, et aucun acte n'en
// compose son corps. L'ordre des essais compte — « sans-serif » contient
// « serif », et la pile d'Arial contient les deux mots.
function familleDe(pile) {
  const p = String(pile || "").toLowerCase();
  if (/mono|courier|consolas/.test(p)) return "sans";
  if (/sans|segoe|arial|calibri|verdana|tahoma|trebuchet|gothic|helvetica|roboto|system-ui/.test(p)) return "sans";
  return "serif";
}

// ------------------------------------------------------- le plan de mise en page
// La charte traduite en grandeurs PDF : c'est le SEUL endroit où la charte est
// lue, et donc le seul endroit à compléter quand un réglage de charte est
// ajouté. Tout ce qui suit ne connaît que le plan.
function planDeCharte(style) {
  const s = emptyStyle(style || {});
  const corps = nombre(s.fontSize, 11);
  const marges = paperMargins(s);
  const cadre = s.frameStyle && s.frameStyle !== "none" ? nombre(s.frameSpace, 6) * MM_PT : 0;
  const encre = s.ink || "#111111";
  const accent = s.color || "#000091";
  return {
    s,
    corps,
    famille: familleDe(s.fontFamily),
    interligne: nombre(s.lineHeight, 1.5),
    justifie: s.justify !== false,
    marges: {
      haut: marges.top * MM_PT + cadre,
      droite: marges.right * MM_PT + cadre,
      bas: marges.bottom * MM_PT + cadre,
      gauche: marges.left * MM_PT + cadre,
    },
    // Le cadre de page : il entoure le texte, à `frameSpace` millimètres de lui.
    // Le texte se rétrécit donc d'autant — c'est ce que fait aussi le CSS.
    cadre: cadre ? {
      style: s.frameStyle,
      largeur: s.frameStyle === "heavy"
        ? Math.max(1.4, nombre(s.frameWidth, 3) * PX_PT)
        : nombre(s.ruleWidth, 1) * PX_PT,
      marge: cadre,
      couleur: couleur(s.frameColor || s.ruleColor || accent, accent),
    } : null,
    encre: couleur(encre, "#111111"),
    encre2: couleur(s.muted || "#555555", "#555555"),
    accent: couleur(accent, "#000091"),
    filet: couleur(s.ruleColor || accent, accent),
    grille: couleur(tint(encre, 0.72), "#8993a5"),
    fond: couleur(tint(accent, 0.9), "#f2f2f6"),
    neutre: couleur(tint(encre, 0.94), "#f0f0f0"),
  };
}

// La graisse de la formule d'autorité : le réglage récent (`authorityWeight`)
// l'emporte ; une charte enregistrée avant lui n'a que `authorityItalic`, que
// l'on traduit.
const poidsAutorite = (s) => s.authorityWeight || (s.authorityItalic ? "italic" : "normal");

// Les styles de texte du document : chaque élément du papier a le sien, dérivé
// du corps de la charte. C'est ce que lisent les « poser… ».
function stylesTexte(plan) {
  const c = plan.corps;
  const s = plan.s;
  const autorite = poidsAutorite(s);
  // La famille du corps est celle de la charte ; l'intitulé et les intitulés
  // d'article peuvent nommer la leur (`titleFont`, `headingFont`) — on suit.
  const famTitre = s.titleFont ? familleDe(s.titleFont) : plan.famille;
  const famIntitule = s.headingFont ? familleDe(s.headingFont) : plan.famille;
  return {
    corps: { taille: c, graisse: 400, italique: false, couleur: plan.encre },
    titre: {
      taille: c * nombre(s.titleSize, 1.06), graisse: nombre(s.titleWeight, 700), italique: false, famille: famTitre,
      couleur: couleur(s.titleColor || s.headingColor || s.ink || "#111111", "#111111"), capitale: !!s.titleCase,
    },
    autorite: { taille: c * nombre(s.authoritySize, 1), graisse: /bold/.test(autorite) ? 700 : 400, italique: /italic/.test(autorite), couleur: plan.encre },
    intitule: {
      taille: c * nombre(s.headingSize, 1), graisse: nombre(s.headingWeight, 700), italique: false, famille: famIntitule,
      couleur: couleur(s.headingColor || s.ink || "#111111", "#111111"), capitale: !!s.headingCase,
    },
    mention: { taille: c * nombre(s.mentionSize, 0.92), graisse: 400, italique: !!s.mentionItalic, couleur: plan.encre },
    tableau: { taille: c * nombre(s.tableFontSize, 0.92), graisse: 400, italique: false, couleur: plan.encre },
    legende: { taille: c * 0.9, graisse: 400, italique: true, couleur: plan.encre2 },
    enTete: {
      taille: c * nombre(s.headerSize, 0.86), graisse: 400, italique: !!s.headerItalic,
      couleur: plan.encre2, capitale: !!s.headerCase,
    },
    pied: { taille: c * nombre(s.footerSize, 0.78), graisse: 400, italique: !!s.footerItalic, couleur: plan.encre2 },
    signature: { taille: c, graisse: 400, italique: false, couleur: plan.encre },
    note: { taille: c * 0.92, graisse: 400, italique: true, couleur: plan.encre2 },
  };
}

// ==========================================================================
// Le moteur : une feuille de papier où l'on pose des blocs
// ==========================================================================

class Feuille {
  constructor({ pdf, plan, textes, doc, config }) {
    this.pdf = pdf;
    this.plan = plan;
    this.textes = textes;
    this.doc = doc;
    this.config = config;
    this.polices = new Map();   // « serif/normal » → police EMBARQUÉE
    this.page = null;
    this.y = 0;                 // distance depuis le haut de la page, en points
    this.pages = 0;
  }

  // ------------------------------------------------------------ géométrie
  get gauche() { return this.plan.marges.gauche; }
  get droite() { return PAGE.largeur - this.plan.marges.droite; }
  get largeur() { return this.droite - this.gauche; }
  // Le bas utile : la marge, moins le pied de page s'il y en a un.
  get bas() { return PAGE.hauteur - this.plan.marges.bas - this.hauteurPied(); }

  // La hauteur de l'en-tête et du pied : la somme de ce que la charte y a mis.
  // La taille du texte est celle du STYLE (`textes.enTete` / `textes.pied`) —
  // le plan d'en-tête ne porte, lui, que le contenu.
  hauteurEntete() {
    const e = this.plan.entete;
    if (!e) return 0;
    const t = this.textes.enTete;
    return (e.logo ? e.logo.hauteur + 10 : 0) + (e.texte ? t.taille * 1.4 : 0) + (e.filet ? 14 : 0);
  }

  hauteurPied() {
    const p = this.plan.pied;
    return p && p.texte ? this.textes.pied.taille * 1.4 + 16 : 0;
  }

  // ------------------------------------------------------------ pages
  nouvellePage() {
    this.page = this.pdf.addPage([PAGE.largeur, PAGE.hauteur]);
    this.pages += 1;
    this.y = this.plan.marges.haut + this.hauteurEntete();
    this.dessinerCadre();
    this.dessinerEntete();
  }

  fermerPage() {
    if (!this.page) return;
    this.dessinerPied();
  }

  // De la place pour `h` points ? Sinon, on tourne la page. `eviter` demande en
  // outre de garder la place de ce qui suit (un intitulé seul en bas de page
  // n'est pas un intitulé).
  besoin(h, eviter = 0) {
    if (this.y + h > this.bas - eviter) this.nouvellePage();
  }

  // Le cadre de page, quand la charte en demande un. Il entoure le texte à
  // `frameSpace` millimètres de lui : les marges du plan comprennent déjà ce
  // décalage, le cadre se pose donc à la marge « nue » de chaque côté.
  dessinerCadre() {
    const c = this.plan.cadre;
    if (!c || !this.page) return;
    const x = this.gauche - c.marge;
    const haut = this.plan.marges.haut - c.marge;
    const bas = PAGE.hauteur - (this.plan.marges.bas - c.marge);
    const dessiner = (retrait, epaisseur) => this.page.drawRectangle({
      x: x + retrait, y: PAGE.hauteur - (bas - retrait),
      width: PAGE.largeur - 2 * (x + retrait), height: bas - haut - 2 * retrait,
      borderColor: rvb(c.couleur), borderWidth: epaisseur,
    });
    // Un cadre « double » est DEUX filets — comme le `3px double` du CSS. Un
    // cadre « heavy » est le même filet, plus épais.
    if (c.style === "double") {
      dessiner(0, 0.6);
      dessiner(2.6, 0.6);
    } else {
      dessiner(0, c.largeur);
    }
  }

  dessinerEntete() {
    const e = this.plan.entete;
    if (!e || !this.page) return;
    const y = this.plan.marges.haut;
    let x = this.gauche;
    if (e.logo && e.logo.image) {
      this.page.drawImage(e.logo.image, {
        x, y: PAGE.hauteur - (y + e.logo.hauteur), width: e.logo.largeur, height: e.logo.hauteur,
      });
      x += e.logo.largeur + 12;
    }
    if (e.texte) {
      const style = this.textes.enTete;
      const texte = e.capitales ? String(e.texte).toUpperCase() : String(e.texte);
      const police = this.police(style);
      const lh = style.taille * 1.4;
      const la = police.widthOfTextAtSize(texte, style.taille);
      const dispo = this.droite - x;
      const posX = e.align === "center" ? x + (dispo - la) / 2 : e.align === "right" ? x + dispo - la : x;
      this.page.drawText(texte, {
        x: Math.max(x, Math.min(posX, this.droite - la)), y: this.baseline(y, lh, style.taille),
        size: style.taille, font: police, color: rvb(style.couleur),
      });
    }
    if (e.filet) {
      const yl = this.plan.marges.haut + this.hauteurEntete() - 8;
      this.ligne(this.gauche, yl, this.droite, yl, { epaisseur: nombre(this.plan.s.ruleWidth, 1) * PX_PT, couleur: this.plan.filet });
    }
  }

  dessinerPied() {
    const p = this.plan.pied;
    if (!p || !p.texte || !this.page) return;
    const style = this.textes.pied;
    const texte = renderSheetText(p.texte, this.doc, this.config, this.plan.s) || p.texte;
    const lh = style.taille * 1.4;
    const y = PAGE.hauteur - this.plan.marges.bas - lh;
    if (p.filet) {
      const yl = y - 8;
      this.ligne(this.gauche, yl, this.droite, yl, { epaisseur: nombre(this.plan.s.ruleWidth, 1) * PX_PT, couleur: this.plan.filet });
    }
    const police = this.police(style);
    const la = police.widthOfTextAtSize(texte, style.taille);
    const x = p.align === "left" ? this.gauche : p.align === "right" ? this.droite - la : this.gauche + (this.largeur - la) / 2;
    this.page.drawText(texte, { x: Math.max(this.gauche, x), y: this.baseline(y, lh, style.taille), size: style.taille, font: police, color: rvb(style.couleur) });
  }

  // ------------------------------------------------------------ primitives
  // La ligne de base d'un texte posé dans une boîte de hauteur `lh` : on centre
  // la hauteur de la police dans la boîte, puis on descend de son ascendance.
  // C'est ce qui donne un interlignage régulier d'une ligne à l'autre.
  baseline(yHaut, lh, taille) {
    return PAGE.hauteur - (yHaut + (lh - taille) / 2 + taille * 0.78);
  }

  ligne(x1, y1, x2, y2, { epaisseur = 0.6, couleur: c = this.plan.filet, pointilles = false } = {}) {
    if (!this.page) return;
    this.page.drawLine({
      start: { x: x1, y: PAGE.hauteur - y1 }, end: { x: x2, y: PAGE.hauteur - y2 },
      thickness: epaisseur, color: rvb(c), lineCap: 0, ...(pointilles ? { dashArray: [2, 2] } : {}),
    });
  }

  cadre(x, y, largeur, hauteur, { epaisseur = 0.6, couleur: c = this.plan.filet, fond = null } = {}) {
    if (!this.page) return;
    if (fond) {
      this.page.drawRectangle({ x, y: PAGE.hauteur - (y + hauteur), width: largeur, height: hauteur, color: rvb(fond) });
    }
    if (epaisseur > 0) {
      this.page.drawRectangle({
        x, y: PAGE.hauteur - (y + hauteur), width: largeur, height: hauteur,
        borderColor: rvb(c), borderWidth: epaisseur,
      });
    }
  }

  // Un encadré dont on choisit les CÔTÉS (`tblr`, comme la charte) : c'est ce
  // que demande un encadré d'intitulé ou de mention, dont on ne veut parfois
  // qu'un trait supérieur.
  cadreCotes(x, y, largeur, hauteur, cotes = "tblr", { epaisseur = 0.6, couleur: c = this.plan.filet, pointilles = false } = {}) {
    if (!this.page) return;
    const l = Math.max(0.3, epaisseur);
    const cotesActifs = String(cotes || "tblr");
    if (cotesActifs.includes("t")) this.ligne(x, y, x + largeur, y, { epaisseur: l, couleur: c, pointilles });
    if (cotesActifs.includes("b")) this.ligne(x, y + hauteur, x + largeur, y + hauteur, { epaisseur: l, couleur: c, pointilles });
    if (cotesActifs.includes("l")) this.ligne(x, y, x, y + hauteur, { epaisseur: l, couleur: c, pointilles });
    if (cotesActifs.includes("r")) this.ligne(x + largeur, y, x + largeur, y + hauteur, { epaisseur: l, couleur: c, pointilles });
  }

  // ------------------------------------------------------------ polices
  // La police embarquée d'un style. L'embed est ASYNCHRONE et fait AVANT la
  // mise en page (voir `creerPdfA`) : ici, on ne fait que la retrouver — avec un
  // repli vers la variante la plus proche si une graisse rare n'a pas été
  // embarquée.
  police(style) {
    const fam = style.famille || this.plan.famille;
    const voulue = varianteDe(style.graisse || 400, !!style.italique);
    const replis = { boldItalic: ["bold", "italic", "normal"], bold: ["normal"], italic: ["normal"], normal: [] }[voulue] || [];
    for (const v of [voulue, ...replis]) {
      const police = this.polices.get(fam + "/" + v);
      if (police) return police;
    }
    throw new Error("Police PDF/A absente : " + fam + "/" + voulue);
  }

  // ------------------------------------------------------------ découpe du texte
  // Un « mot » porte sa police : c'est ce qui permet de composer une ligne
  // mixte (l'étiquette d'un visa en gras, la référence en romain) et de mesurer
  // juste. Les blancs du texte deviennent l'espace posé AVANT le mot suivant ;
  // l'espace INSÉCABLE, lui, reste dans le mot — c'est lui qui empêche de
  // renvoyer à la ligne le deux-points d'un acte français.
  mots(runs) {
    const out = [];
    let espace = 0;      // largeur de l'espace à poser avant le prochain mot
    for (const run of runs) {
      if (!run || run.texte == null) continue;
      const style = run.style;
      const police = this.police(style);
      const largeurEspace = police.widthOfTextAtSize(" ", style.taille);
      const morceaux = String(run.texte).replace(/[ \t\n\r\f\v]+/g, " ").split(" ");
      morceaux.forEach((mot, i) => {
        if (i > 0) espace = largeurEspace;
        if (!mot) return;
        out.push({
          texte: mot, police, taille: style.taille, couleur: style.couleur || this.plan.encre,
          avant: out.length === 0 ? 0 : espace,
        });
        espace = 0;
      });
    }
    return out;
  }

  // La découpe d'une suite de mots en lignes qui tiennent dans la largeur
  // donnée. Une ligne = ses mots, et la largeur qu'ils occupent.
  decouper(mots, largeurPremier, largeurSuivant) {
    const lignes = [];
    let premier = true;
    let i = 0;
    while (i < mots.length) {
      const dispo = Math.max(24, premier ? largeurPremier : largeurSuivant);
      const ligne = [];
      let largeur = 0;
      while (i < mots.length) {
        const mot = mots[i];
        const largeurMot = mot.police.widthOfTextAtSize(mot.texte, mot.taille);
        const avant = ligne.length ? mot.avant : 0;
        if (ligne.length && largeur + avant + largeurMot > dispo) break;
        // Un mot plus long que la ligne (une adresse, un identifiant) : on le
        // coupe au caractère, faute de pouvoir le couper ailleurs.
        if (!ligne.length && largeurMot > dispo) {
          const coupe = couperMot(mot.texte, mot.police, mot.taille, dispo);
          ligne.push({ ...mot, texte: coupe.debut, avant: 0 });
          mots[i] = { ...mot, texte: coupe.reste, avant: 0 };
          largeur = coupe.largeur;
          break;
        }
        ligne.push({ ...mot, avant });
        largeur += avant + largeurMot;
        i += 1;
      }
      if (ligne.length) lignes.push({ mots: ligne, largeur });
      premier = false;
    }
    return lignes;
  }

  // Écrit des « runs » (segments de texte stylés) comme un paragraphe, et
  // renvoie la hauteur occupée. C'est LA fonction d'écriture : tout passe par
  // elle.
  //   opts.avant / apres            espaces avant et après, en points
  //   opts.garder                   lignes à ne pas séparer de ce qui suit
  //   opts.align                    left | center | right
  //   opts.justifie                 étirer les lignes (sauf la dernière)
  //   opts.retraitPremier/-Suivant  retraits de première ligne / des suivantes
  //   opts.margeGauche / -Droite    décalage du bloc entier
  //   opts.largeur                  largeur imposée (colonne, tableau)
  //   opts.couleurFond              fond du bloc (mentions sur fond)
  //   opts.barre / souligne         marques de suppression / d'ajout
  //   opts.y                        commencer à cette hauteur (colonnes)
  ecrire(runs, opts = {}) {
    const depart = this.y;
    if (opts.y != null) this.y = opts.y;
    const mots = this.mots(runs);
    if (!mots.length) { this.y = depart; return 0; }
    const style = opts.style || runs[0].style;
    const lh = style.taille * (opts.interligne || this.plan.interligne);
    const margeGauche = opts.margeGauche || 0;
    const margeDroite = opts.margeDroite || 0;
    const largeurDispo = (opts.largeur || this.largeur) - margeGauche - margeDroite;
    const x0 = this.gauche + margeGauche;
    const rPremier = opts.retraitPremier || 0;
    const rSuivant = opts.retraitSuivant || 0;
    const lignes = this.decouper(mots, largeurDispo - rPremier, largeurDispo - rSuivant);
    const align = opts.align || "left";
    const justifie = opts.justifie != null ? opts.justifie : this.plan.justifie;

    // L'espace avant n'est posé que si la page peut le porter : sinon la page
    // tourne, et le bloc commence en haut de la suivante, sans trou.
    if (opts.avant) {
      if (this.y + opts.avant + lh > this.bas - (opts.garder || 0) * lh) this.nouvellePage();
      else this.y += opts.avant;
    }
    let hauteurTotale = 0;
    lignes.forEach((ligne, i) => {
      const dernier = i === lignes.length - 1;
      this.besoin(lh * 1 + (dernier ? (opts.garder || 0) : 1) * lh);
      const retrait = i === 0 ? rPremier : rSuivant;
      const largeurLigne = largeurDispo - retrait;
      let x = x0 + retrait;
      if (align === "center") x += (largeurLigne - ligne.largeur) / 2;
      else if (align === "right") x += largeurLigne - ligne.largeur;
      // Justification : l'espace restant se répartit entre les mots. La dernière
      // ligne d'un paragraphe n'est jamais étirée, et une ligne presque vide
      // (un mot seul) ne l'est pas non plus.
      let surplus = justifie && !dernier && ligne.mots.length > 1 ? (largeurLigne - ligne.largeur) / (ligne.mots.length - 1) : 0;
      if (surplus > lh * 0.9) surplus = 0;
      const yBas = this.baseline(this.y, lh, style.taille);
      if (opts.couleurFond) {
        this.page.drawRectangle({
          x: x0 - 3, y: PAGE.hauteur - (this.y + lh), width: largeurDispo + 6, height: lh, color: rvb(opts.couleurFond),
        });
      }
      for (const mot of ligne.mots) {
        x += mot.avant;
        this.page.drawText(mot.texte, { x, y: yBas, size: mot.taille, font: mot.police, color: rvb(mot.couleur) });
        x += mot.police.widthOfTextAtSize(mot.texte, mot.taille) + surplus;
      }
      // Les marques d'ajout et de suppression : un trait, qui s'imprime.
      if (opts.barre || opts.souligne) {
        const yTrait = opts.barre ? this.y + lh * 0.52 : this.y + lh - 3;
        this.ligne(x0 + retrait - 1, yTrait, x0 + retrait + ligne.largeur + 1, yTrait,
          { epaisseur: 0.5, couleur: opts.barre ? this.plan.encre2 : this.plan.accent });
      }
      this.y += lh;
      hauteurTotale += lh;
    });
    if (opts.apres) this.y += opts.apres;
    const fin = this.y;
    this.y = Math.max(depart, fin);
    return hauteurTotale;
  }

  mesure(texte, style) {
    return this.police(style).widthOfTextAtSize(String(texte ?? ""), style.taille);
  }

  // Combien de lignes occupe un texte dans une largeur donnée ? Sert à réserver
  // la bonne hauteur à un bloc composé en colonne (la signature), dont une
  // qualité longue se replie sur deux lignes.
  nbLignes(texte, style, largeur) {
    const mots = this.mots([{ texte, style }]);
    if (!mots.length) return 0;
    return this.decouper(mots, largeur, largeur).length;
  }

  // ------------------------------------------------------------ blocs composés
  // Un tableau : les colonnes sont dimensionnées d'après leur contenu, puis
  // ramenées à la largeur disponible. Les lignes se posent une à une, et si le
  // tableau tourne la page, sa ligne d'en-tête est reprise en haut de la
  // suivante — un tableau qui continue sans ses intitulés ne se lit pas.
  tableau(node) {
    const t = this.textes.tableau;
    const entete = { ...t, graisse: 700 };
    const colonnes = node.columns || [];
    if (!colonnes.length) return;
    const marge = nombre(this.plan.s.tableCellPadding, 3) * PX_PT;
    const lignes = (node.rows || []).map((r) => colonnes.map((_, i) => String(r[i] ?? "")));
    const genre = node.layout || (["rows", "zebra"].includes(this.plan.s.tableStyle) ? this.plan.s.tableStyle : "grid");
    // Largeur naturelle de chaque colonne : son plus long mot, mesuré dans les
    // deux graisses — les lignes longues se replieront.
    const naturelles = colonnes.map((c, i) => {
      const mesures = [String(c ?? ""), ...lignes.map((r) => r[i])]
        .flatMap((v) => String(v).split(" ").filter(Boolean))
        .map((m) => Math.max(this.mesure(m, entete), this.mesure(m, t)));
      return Math.max(30, ...mesures) + marge * 2;
    });
    const total = naturelles.reduce((a, b) => a + b, 0);
    const largeurs = naturelles.map((l) => l * (total > this.largeur ? this.largeur / total : 1));

    const dessinerLigne = (cellules, style, bande, prem) => {
      const decoupees = cellules.map((v, i) => this.decouper(this.mots([{ texte: v, style }]), largeurs[i] - marge * 2, largeurs[i] - marge * 2));
      const hauteur = Math.max(1, ...decoupees.map((l) => l.length)) * style.taille * 1.35 + marge * 2;
      const pageAvant = this.pages;
      this.besoin(hauteur);
      if (this.pages !== pageAvant && !prem) {
        // Nouvelle page : on reprend les intitulés de colonnes.
        if (node.head !== false) dessinerLigne(colonnes.map((c) => String(c ?? "")), entete, this.plan.neutre, true);
      }
      const y = this.y;
      let x = this.gauche;
      decoupees.forEach((ligne, i) => {
        if (bande) this.cadre(x, y, largeurs[i], hauteur, { epaisseur: 0, fond: bande });
        ligne.forEach((l, j) => {
          this.page.drawText(l.mots.map((m) => m.texte).join(" "), {
            x: x + marge,
            y: this.baseline(y + marge + j * style.taille * 1.35, style.taille * 1.35, style.taille),
            size: style.taille, font: this.police(style), color: rvb(style.couleur),
          });
        });
        x += largeurs[i];
      });
      const xFin = this.gauche + largeurs.reduce((a, b) => a + b, 0);
      if (genre !== "rows") {
        let xf = this.gauche;
        for (const l of largeurs) { this.cadre(xf, y, l, hauteur, { epaisseur: 0.4, couleur: this.plan.grille }); xf += l; }
      } else if (!prem) {
        this.ligne(this.gauche, y, xFin, y, { epaisseur: 0.4, couleur: this.plan.grille });
      }
      if (prem) {
        this.ligne(this.gauche, y + hauteur, xFin, y + hauteur,
          { epaisseur: genre === "rows" ? 1 : 0.4, couleur: genre === "rows" ? this.plan.filet : this.plan.grille });
      }
      this.y += hauteur;
    };

    const legende = () => {
      if (!node.caption) return;
      const align = this.plan.s.tableCaptionAlign === "center" ? "center" : this.plan.s.tableCaptionAlign === "right" ? "right" : "left";
      const texte = this.plan.s.tableCaptionCase ? String(node.caption).toUpperCase() : String(node.caption);
      this.ecrire([{ texte, style: this.textes.legende }], { align, avant: this.plan.s.tableCaptionPos === "bottom" ? 3 : 3, apres: 4, justifie: false });
    };

    if (node.caption && node.captionPos !== "bottom") legende();
    this.besoin(t.taille * 1.35 + marge * 2, t.taille * 2.7);
    if (node.head !== false) dessinerLigne(colonnes.map((c) => String(c ?? "")), entete, this.plan.neutre, true);
    lignes.forEach((r, i) => {
      const bande = genre === "zebra" && i % 2 === 1 ? this.plan.neutre : null;
      dessinerLigne(r, t, bande, false);
    });
    if (node.caption && node.captionPos === "bottom") legende();
    this.y += 6;
  }

  // Une liste : chaque item est un paragraphe décalé, précédé de sa puce ou de
  // son numéro, posé dans la gouttière à gauche du texte.
  liste(node) {
    const style = this.textes.corps;
    const retrait = nombre(this.plan.s.listIndent, 22) * PX_PT;
    const lh = style.taille * this.plan.interligne;
    (node.items || []).forEach((item, i) => {
      const etiquette = node.ordered
        ? marqueNumero(node.numbering || this.plan.s.listNumbering, nombre(node.start, 1) + i)
        : marquePuce(node.marker || this.plan.s.listMarker);
      // Un item de liste ne commence pas en bas de page : il lui faut sa
      // première ligne ET la place de la suivante, faute de quoi sa première
      // ligne resterait seule, détachée de son texte.
      this.besoin(lh, lh);
      const yItem = this.y;
      this.ecrire([{ texte: item.text, style }], { margeGauche: retrait, apres: 3, garder: 1 });
      if (etiquette) {
        const la = this.mesure(etiquette, style);
        this.page.drawText(etiquette, {
          x: this.gauche + retrait - 6 - la, y: this.baseline(yItem, lh, style.taille),
          size: style.taille, font: this.police(style), color: rvb(style.couleur || this.plan.encre),
        });
      }
    });
  }
}

// Le plus long début de `mot` qui tient dans `largeur` : la coupure de la
// dernière extrémité, quand un mot est plus long que la ligne.
function couperMot(mot, police, taille, largeur) {
  let i = 1;
  while (i < mot.length && police.widthOfTextAtSize(mot.slice(0, i + 1), taille) <= largeur) i += 1;
  if (i >= mot.length) return { debut: mot, reste: "", largeur: police.widthOfTextAtSize(mot, taille) };
  return { debut: mot.slice(0, i), reste: mot.slice(i), largeur: police.widthOfTextAtSize(mot.slice(0, i), taille) };
}

// La marque d'une liste à puces. Les noms sont ceux du schéma des blocs (voir
// lib/schema.js) — « decimal » y subsiste pour les listes enregistrées avant
// que la puce et la numérotation ne soient séparées.
const PUCES = { disc: "•", circle: "◦", square: "▪", dash: "–", decimal: "•", none: "" };
const marquePuce = (m) => (PUCES[m] != null ? PUCES[m] : "•");

const ROMAIN = [[1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"], [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]];
function romain(n) {
  let reste = Math.max(1, Math.round(n));
  let out = "";
  for (const [valeur, signe] of ROMAIN) while (reste >= valeur) { out += signe; reste -= valeur; }
  return out;
}
function lettres(n, majuscule) {
  let reste = Math.max(1, Math.round(n));
  let out = "";
  while (reste > 0) {
    const r = (reste - 1) % 26;
    out = String.fromCharCode((majuscule ? 65 : 97) + r) + out;
    reste = Math.floor((reste - 1) / 26);
  }
  return out;
}
// La marque d'une liste numérotée, par son nom de compteur CSS (voir
// COUNTER_STYLES, lib/styles.js) : « 1° », « 1) », « a) », « I. »…
function marqueNumero(nom, n) {
  switch (nom) {
    case "degree": return n + "°";
    case "parenth": return n + ")";
    case "lalpha": return lettres(n, false) + ")";
    case "ualpha": return lettres(n, true) + ")";
    case "lroman": return romain(n) + ".";
    case "uroman": return romain(n).toUpperCase() + ".";
    case "none": return "";
    default: return n + ".";
  }
}

// ==========================================================================
// Le document : parcours des nœuds
// ==========================================================================

// Le corps d'un document, dans l'ordre : intitulé, autorité, visas,
// considérants, formule d'édiction, articles et divisions, annexes, signature,
// mentions — puis, sur une page neuve, le texte des documents annexés. C'est le
// même ordre que le rendu HTML (voir lib/render.js) : le papier et l'écran
// montrent la même chose.
export function poserDocument(f, doc, config, opts = {}) {
  f.nouvellePage();
  if (doc.kind === "consolide" && doc.consolidationNotice) banniereConsolidation(f, doc);
  const ctx = {
    config,
    tracking: !!opts.tracking,
    mentions: opts.tracking ? null : amendmentMentions(doc, config),
    sansSignature: !!opts.sansSignature,
  };
  for (const node of doc.nodes || []) poserNode(f, node, ctx);
  for (const joint of doc.annexeDocs || []) poserAnnexe(f, joint, ctx);
  f.fermerPage();
}

function poserNode(f, node, ctx) {
  const t = f.textes;
  switch (node.type) {
    case "title": {
      if (!node.text) break;
      const style = t.titre;
      const texte = style.capitale ? String(node.text).toUpperCase() : node.text;
      const filet = f.plan.s.titleRule;
      const pointilles = f.plan.s.ruleStyle === "dotted";
      const ep = Math.max(0.4, nombre(f.plan.s.ruleWidth, 1) * PX_PT);
      const hauteur = f.ecrire([{ texte, style }], {
        align: alignDe(f.plan.s.titleAlign), apres: 6, garder: 2, justifie: false,
        souligne: filet === "underline",
      });
      // Le filet de l'intitulé : un trait, deux traits, un encadré. Il se pose
      // SOUS la dernière ligne écrite — donc à la hauteur où l'écriture s'est
      // arrêtée, même si l'intitulé a tourné la page.
      const haut = f.y - 6 - hauteur;
      if (filet === "line") {
        f.ligne(f.gauche, f.y - 8, f.droite, f.y - 8, { epaisseur: ep, couleur: f.plan.filet, pointilles });
        f.y += 5;
      } else if (filet === "double") {
        // `3px double` au CSS : deux filets fins, un intervalle d'un pixel.
        f.ligne(f.gauche, f.y - 8, f.droite, f.y - 8, { epaisseur: 0.5, couleur: f.plan.filet });
        f.ligne(f.gauche, f.y - 5.4, f.droite, f.y - 5.4, { epaisseur: 0.5, couleur: f.plan.filet });
        f.y += 9;
      } else if (filet === "box") {
        f.cadreCotes(f.gauche - 6, haut - 5, f.largeur + 12, hauteur + 10, f.plan.s.titleBoxSides,
          { epaisseur: ep, couleur: f.plan.filet, pointilles });
        f.y += 8;
      }
      break;
    }
    case "authority":
      if (node.text) {
        f.ecrire([{ texte: node.text, style: t.autorite }], { align: alignDe(f.plan.s.authorityAlign), apres: 9, justifie: false });
      }
      break;
    case "visas": {
      const etiquette = ctx.config?.vocab?.visasLabel || "Vu";
      const marque = f.plan.s.visasLabelStyle;
      const puce = f.plan.s.visasBullet ? "• " : "";
      for (const it of node.items || []) {
        const texte = marque === "smallcaps" ? String(etiquette).toUpperCase() : etiquette;
        f.ecrire([
          { texte: puce + texte + " ", style: { ...t.corps, graisse: marque === "bold" ? 700 : 400, italique: marque === "italic" } },
          { texte: it.text, style: t.corps },
        ], { margeGauche: nombre(f.plan.s.visasIndent, 0) * PX_PT, apres: 3, garder: 1 });
      }
      f.y += 7;
      break;
    }
    case "considerants": {
      const textes = (node.items || []).map((i) => i.text).filter(Boolean);
      const style = f.plan.s.recitalsItalic ? { ...t.corps, italique: true } : t.corps;
      const runs = node.inline && textes.length ? [{ texte: textes.join(" "), style }] : textes.map((x) => ({ texte: x, style }));
      for (const r of runs) f.ecrire([r], { apres: 5, garder: 1, margeGauche: nombre(f.plan.s.recitalsIndent, 0) * PX_PT });
      f.y += 4;
      break;
    }
    case "enact":
      if (node.text) poserEnact(f, node.text);
      break;
    case "division": {
      const niveau = Math.min(4, Math.max(1, Number(node.level) || 1));
      const facteur = [1.08, 1.02, 1, 0.98][niveau - 1];
      const style = { ...t.intitule, taille: t.corps.taille * facteur, italique: niveau >= 4 };
      const libelle = [node.numLabel || node.levelLabel, node.heading].filter(Boolean).join(" – ");
      if (libelle) {
        f.ecrire([{ texte: libelle, style }], {
          align: niveau === 1 ? "center" : "left", avant: f.y > f.plan.marges.haut + 60 ? 14 : 5,
          apres: 7, garder: 2, justifie: false, margeGauche: (niveau - 1) * 8,
        });
      }
      for (const b of node.blocks || []) {
        if (!ctx.tracking && b.change?.kind === "del") continue;
        poserNode(f, b, ctx);
      }
      break;
    }
    case "article":
      poserArticle(f, node, ctx);
      break;
    case "annexes": {
      const titre = annexesVocab(ctx.config).sectionTitle || "Annexes";
      f.ecrire([{ texte: titre, style: t.intitule }], { avant: 15, apres: 5, garder: 2, justifie: false });
      for (const it of node.items || []) {
        f.ecrire([{ texte: "• " + (it.texte || it.objet || "Annexe"), style: t.corps }], {
          margeGauche: 16, retraitSuivant: 16, apres: 3, justifie: false,
        });
      }
      break;
    }
    case "signature":
      if (!ctx.sansSignature) poserSignature(f, node, ctx);
      break;
    case "mention":
      poserMention(f, node);
      break;
    case "para":
    case "raw":
    case "list":
    case "table":
      poserBloc(f, node);
      break;
    default:
      if (node.text) f.ecrire([{ texte: node.text, style: t.corps }], { apres: 6, garder: 1 });
  }
}

// Un article : son intitulé, la mention de l'acte qui l'a modifié (version
// consolidée), puis ses blocs. Un article ABROGÉ n'a plus de rédaction en
// vigueur : il garde son intitulé et la mention, jamais son ancien texte — le
// papier ne montre pas ce que la version en ligne réserve au lecteur curieux.
function poserArticle(f, node, ctx) {
  const t = f.textes;
  const abroge = node.change?.action === "abrogate" && !ctx.tracking;
  const style = t.intitule;
  const numero = style.capitale ? String(node.numLabel || "").toUpperCase() : String(node.numLabel || "");
  const titre = node.heading ? (style.capitale ? String(node.heading).toUpperCase() : node.heading) : "";
  const disposition = f.plan.s.articleNumberLayout || "inline";
  // Le diviseur entre articles (`.doc-article` : bordure haute sauf le premier).
  // Le premier article n'en porte pas — d'où le souvenir, sur la feuille, qu'un
  // article a déjà été posé.
  const diviseur = f.plan.s.articleDivider;
  const avecDiviseur = !!diviseur && diviseur !== "none" && !!f.articleVu;
  if (avecDiviseur) tracerDiviseur(f, diviseur);
  const avant = avecDiviseur ? 0 : 8 * nombre(f.plan.s.articleSpacing, 1);
  const filet = f.plan.s.headingRule;
  const ep = Math.max(0.4, nombre(f.plan.s.ruleWidth, 1) * PX_PT);
  const pointilles = f.plan.s.ruleStyle === "dotted";
  let hauteurTitre = 0;

  if (disposition === "block") {
    if (numero) hauteurTitre += f.ecrire([{ texte: numero, style }], { avant, apres: 1, garder: 2, justifie: false }) + 1;
    if (titre) hauteurTitre += f.ecrire([{ texte: titre, style }], { apres: 4, garder: 2, justifie: false });
  } else {
    const runs = [];
    if (numero) runs.push({ texte: numero, style });
    if (titre) runs.push({ texte: (numero ? " – " : "") + titre, style });
    if (runs.length) hauteurTitre = f.ecrire(runs, { avant, apres: 4, garder: 2, justifie: false });
    if (disposition === "margin" && numero) {
      // Le numéro est remonté dans la marge de gauche, à la hauteur de la
      // première ligne de l'intitulé (le CSS le pose en absolu, à sept cadratins).
      const y = f.y - style.taille * f.plan.interligne - 4;
      const la = f.mesure(numero, style);
      f.page.drawText(numero, {
        x: Math.max(6, f.gauche - 10 - la), y: f.baseline(y, style.taille * f.plan.interligne, style.taille),
        size: style.taille, font: f.police(style), color: rvb(style.couleur),
      });
    }
  }
  if (filet === "line" || filet === "dotted") {
    const yl = f.y - 4;
    f.ligne(f.gauche, yl, f.droite, yl,
      { epaisseur: ep, couleur: f.plan.filet, pointilles: filet === "dotted" });
    f.y += 3;
  } else if (filet === "box" && hauteurTitre) {
    f.cadreCotes(f.gauche - 5, f.y - 4 - hauteurTitre - 3, f.largeur + 10, hauteurTitre + 6, f.plan.s.headingBoxSides,
      { epaisseur: ep, couleur: f.plan.filet, pointilles });
    f.y += 3;
  }

  if (!ctx.tracking) {
    const mention = amendmentMention(node, ctx.mentions, ctx.config);
    if (mention) f.ecrire([{ texte: mention, style: t.note }], { apres: 4, garder: 1 });
  }
  f.articleVu = true;
  if (abroge) return;
  for (const b of node.blocks || []) {
    if (!ctx.tracking && b.change?.kind === "del") continue;
    poserBloc(f, b);
  }
}

// Le filet qui sépare deux articles (marge haute, filet, garde) — la traduction
// de `border-top:.9em … ; padding-top:.9em; margin-top:.4em` du CSS.
function tracerDiviseur(f, genre) {
  const lh = f.textes.intitule.taille * f.plan.interligne;
  const marge = f.plan.corps * 0.4;
  const garde = f.plan.corps * 0.9;
  f.besoin(marge + garde + lh, lh);
  f.y += marge;
  const ep = Math.max(0.4, nombre(f.plan.s.ruleWidth, 1) * PX_PT);
  const pointilles = genre === "dotted";
  f.ligne(f.gauche, f.y, f.droite, f.y, { epaisseur: ep, couleur: f.plan.filet, pointilles });
  if (genre === "double") f.ligne(f.gauche, f.y + 2.4, f.droite, f.y + 2.4, { epaisseur: ep, couleur: f.plan.filet });
  f.y += garde;
}

// Un bloc de contenu : paragraphe (encadré, aligné, en retrait), liste ou
// tableau. Un bloc « cité » — la nouvelle rédaction apportée par un acte
// modificatif — est décalé et mis entre guillemets de part et d'autre d'un
// filet, comme le fait le CSS de citation (`.doc-quote`).
function poserBloc(f, bloc) {
  const style = f.textes.corps;
  const change = bloc.change?.kind;
  const cite = bloc.quoted;
  const margeCite = cite ? 18 : 0;

  if (bloc.type === "list") { f.liste(bloc); return; }
  if (bloc.type === "table") { f.tableau(bloc); return; }

  const texte = String(bloc.text || "");
  if (!texte) return;
  const contenu = cite ? "« " + texte + " »" : texte;
  const marques = { barre: change === "del", souligne: change === "ins" };

  if (bloc.boxed) {
    const interne = 9;
    f.besoin(f.textes.corps.taille * f.plan.interligne, 0);
    const haut = f.y;
    const hauteur = f.ecrire([{ texte: contenu, style }], {
      ...marques, margeGauche: margeCite + interne, margeDroite: interne, align: alignDe(bloc.align), apres: 0, garder: 1,
    });
    f.cadre(f.gauche + margeCite, haut + 2, f.largeur - margeCite, hauteur + 8, { epaisseur: 0.6, couleur: f.plan.filet });
    f.y += 8;
  } else {
    if (cite) f.besoin(f.textes.corps.taille * f.plan.interligne, 0);
    const haut = f.y;
    f.ecrire([{ texte: contenu, style }], {
      ...marques,
      align: alignDe(bloc.align),
      apres: nombre(f.plan.s.paraSpacing, 0.55) * f.plan.corps,
      retraitPremier: bloc.indent === "first" ? 1.5 * f.plan.corps : bloc.indent === "none" ? 0 : nombre(f.plan.s.paraIndent, 0) * f.plan.corps,
      margeGauche: margeCite + (bloc.indent === "all" ? 1.5 * f.plan.corps : 0),
      garder: 1,
    });
    // Le filet de citation, à gauche du bloc : du haut du bloc à son dernier
    // mot. C'est ce que trace le CSS de citation.
    if (cite) f.ligne(f.gauche + 6, haut, f.gauche + 6, f.y - 6, { epaisseur: 2, couleur: f.plan.grille });
  }
}

// La formule d'édiction (« ARRÊTE ») : la charte la veut simple, entre deux
// filets, sur une bande de couleur, ou encadrée.
function poserEnact(f, texte) {
  const s = f.plan.s;
  const enBande = s.enactStyle === "band";
  // Sur une bande, la formule prend la couleur des intitulés (voir le CSS) ;
  // sinon elle reste à l'encre du corps, en gras.
  const style = {
    ...f.textes.corps, graisse: 700,
    couleur: enBande ? f.textes.intitule.couleur : f.textes.corps.couleur,
  };
  const contenu = s.enactCase ? String(texte).toUpperCase() : texte;
  const lh = style.taille * f.plan.interligne;
  const avant = 14;
  // La formule ne se coupe pas de ses filets : on s'assure d'abord de la place,
  // puis on retient la hauteur où elle commence — c'est là que le cadre, la
  // bande ou les filets se posent.
  const hauteur = Math.max(lh, f.nbLignes(contenu, style, f.largeur) * lh);
  const place = hauteur + 10;
  f.besoin(avant + place, lh);
  f.y += avant;
  const haut = f.y;
  // La bande de couleur se pose AVANT le texte : c'est un fond, il doit passer
  // sous la formule, non la recouvrir.
  if (enBande) {
    f.page.drawRectangle({
      x: f.gauche - 6, y: PAGE.hauteur - (haut - 4 + hauteur + 8), width: f.largeur + 12, height: hauteur + 8, color: rvb(f.plan.fond),
    });
  }
  f.ecrire([{ texte: contenu, style }], { align: "center", justifie: false, garder: 2 });
  const epaisseur = Math.max(0.4, nombre(s.ruleWidth, 1) * PX_PT);
  const pointilles = s.ruleStyle === "dotted";
  if (s.enactStyle === "rule") {
    f.ligne(f.gauche, haut - 3, f.droite, haut - 3, { epaisseur, couleur: f.plan.filet, pointilles });
    f.ligne(f.gauche, haut + hauteur + 3, f.droite, haut + hauteur + 3, { epaisseur, couleur: f.plan.filet, pointilles });
  } else if (enBande) {
    f.ligne(f.gauche - 6, haut - 4, f.droite + 6, haut - 4, { epaisseur: 0.5, couleur: f.plan.filet });
    f.ligne(f.gauche - 6, haut + hauteur + 4, f.droite + 6, haut + hauteur + 4, { epaisseur: 0.5, couleur: f.plan.filet });
  } else if (s.enactStyle === "box") {
    f.cadreCotes(f.gauche - 6, haut - 4, f.largeur + 12, hauteur + 8, s.enactBoxSides,
      { epaisseur, couleur: f.plan.filet, pointilles });
  }
  f.y += 14;
}

// Une mention (recours, publication, notification) : simple, à filet gauche,
// encadrée, ou sur un fond discret.
function poserMention(f, node) {
  const s = f.plan.s;
  const style = f.textes.mention;
  const block = s.mentionStyle === "box" || s.mentionStyle === "tinted";
  // Le retrait intérieur suit la feuille de style : `.7em` de chaque côté pour
  // un encadré, `.7em` à gauche (derrière le filet) pour la mention à filet.
  const interne = block ? style.taille * 0.7 : s.mentionStyle === "left" ? style.taille * 0.7 : 0;
  const lh = style.taille * f.plan.interligne;
  f.besoin(14 + lh, lh);
  f.y += 14;
  const haut = f.y;
  const hauteur = f.ecrire([{ texte: node.text, style }], {
    apres: 0, margeGauche: interne, margeDroite: interne,
    couleurFond: s.mentionStyle === "tinted" ? f.plan.neutre : null, garder: 1,
  });
  if (s.mentionStyle === "left") {
    f.ligne(f.gauche, haut, f.gauche, haut + hauteur, { epaisseur: 2.5, couleur: f.plan.filet });
  } else if (s.mentionStyle === "box") {
    f.cadreCotes(f.gauche, haut - 2, f.largeur, hauteur + 4, s.mentionBoxSides,
      { epaisseur: Math.max(0.4, nombre(s.ruleWidth, 1) * PX_PT), couleur: f.plan.filet });
  } else if (s.mentionStyle === "tinted") {
    // La mention sur fond porte aussi son filet gauche (voir `styleCss`).
    f.ligne(f.gauche, haut, f.gauche, haut + hauteur, { epaisseur: 2.5, couleur: f.plan.filet });
  }
  f.y += 8;
}

// La signature : « Fait à …, le … », puis le bloc (qualité, nom). La charte
// décide du côté — et, quand le bloc est à gauche, c'est la ligne de lieu qui
// passe à droite, comme le fait la feuille de style.
function poserSignature(f, node, ctx) {
  const t = f.textes;
  const lh = t.signature.taille * f.plan.interligne;
  const lignesRole = node.showFunction === false ? [] : personRoleLines(node.signataire, ctx.config);
  const nom = personSignatureName(node.signataire);
  const espace = nombre(f.plan.s.signatureSpace, 40) * PX_PT;
  const decalage = f.plan.s.signatureStyle === "line" ? espace : f.plan.s.signatureStyle === "box" ? espace * 0.6 : 0;
  const aGauche = f.plan.s.signatureAlign === "left";
  const largeurBloc = Math.max(90, f.largeur * nombre(f.plan.s.signatureWidth, 40) / 100);
  const styleRole = { ...t.signature, italique: !!f.plan.s.signatureFunctionItalic };
  const styleNom = { ...t.signature, graisse: nombre(f.plan.s.signatureNameWeight, 400) };
  // Une qualité longue se replie sur deux lignes : on compte les lignes
  // RÉELLEMENT composées (et non le nombre de chaînes) pour que le nom, le
  // filet et l'encadré se posent sous la dernière, sans se chevaucher.
  const compte = lignesRole.map((l) => f.nbLignes(l, styleRole, largeurBloc));
  const compteNom = nom ? f.nbLignes(nom, styleNom, largeurBloc) : 0;
  const nbLignes = compte.reduce((a, b) => a + b, 0) + compteNom;
  const hauteur = decalage + Math.max(1, nbLignes) * lh;
  f.y += 26;
  f.besoin(hauteur, lh);
  const yBloc = f.y;
  const xBloc = aGauche ? f.gauche : f.gauche + f.largeur - largeurBloc;
  const yLieu = yBloc + decalage + Math.max(0, nbLignes - 1) * lh;
  const place = "Fait à " + (node.place || "") + ", le " + (node.date || "");
  // Les deux colonnes : la ligne de lieu d'un côté, le bloc de signature de
  // l'autre. On les écrit en imposant leur largeur (le retrait gauche est un
  // DÉCALAGE, il se retire donc de la largeur totale — voir `ecrire`).
  const margeG = xBloc - f.gauche;
  const margeD = f.largeur - margeG - largeurBloc;
  const largeurGauche = Math.max(60, xBloc - 12 - f.gauche);
  if (aGauche) {
    f.ecrire([{ texte: place, style: t.signature }], {
      y: yLieu, largeur: f.largeur, margeGauche: largeurBloc + 12, align: "right", justifie: false,
    });
  } else {
    f.ecrire([{ texte: place, style: t.signature }], {
      y: yLieu, largeur: Math.max(60, largeurGauche), align: "left", justifie: false,
    });
  }
  let ligne = 0;
  lignesRole.forEach((texte, i) => {
    f.ecrire([{ texte, style: styleRole }], {
      y: yBloc + decalage + ligne * lh, largeur: f.largeur, margeGauche: margeG, margeDroite: margeD, align: "center", justifie: false,
    });
    ligne += compte[i];
  });
  if (nom) {
    f.ecrire([{ texte: nom, style: styleNom }], {
      y: yBloc + decalage + ligne * lh, largeur: f.largeur, margeGauche: margeG, margeDroite: margeD,
      align: "center", justifie: false,
    });
  }
  if (f.plan.s.signatureStyle === "line") {
    f.ligne(xBloc, yBloc, xBloc + largeurBloc, yBloc, { epaisseur: 0.6, couleur: f.plan.encre });
  } else if (f.plan.s.signatureStyle === "box") {
    f.cadre(xBloc, yBloc - 4, largeurBloc, hauteur + 10, { epaisseur: 0.6, couleur: f.plan.filet });
  }
  f.y = Math.max(f.y, yBloc + hauteur) + 16;
}

// La bannière d'une version consolidée : le même avertissement que celui que
// porte le HTML publié (voir `consolidationBanner`, lib/render.js).
function banniereConsolidation(f, doc) {
  const note = f.textes.note;
  f.ecrire([{ texte: "Version consolidée", style: { ...note, graisse: 700, italique: false, couleur: f.plan.encre } }],
    { apres: 3, justifie: false, garder: 2 });
  if (doc.consolidationNotice) f.ecrire([{ texte: doc.consolidationNotice, style: note }], { apres: 3, justifie: false, garder: 1 });
  const c = doc.meta?.consolidated;
  if (c) {
    f.ecrire([{
      texte: "Mise à jour du " + formatDate(String(c.at || "").slice(0, 10), "date-long")
        + " — " + c.count + " modification(s) apportée(s) par " + (doc.trail || []).length + " acte(s) modificatif(s).",
      style: note,
    }], { apres: 4, justifie: false });
  }
  f.ecrire([{ texte: "Le texte est présenté dans sa rédaction en vigueur. Chaque article modifié porte, sous son intitulé, la mention de l'acte qui l'a modifié.", style: note }],
    { apres: 10, justifie: false });
}

// La partie ANNEXÉE : le texte des documents adoptés, sur une page neuve, après
// la signature de l'acte qui les adopte (voir lib/annexe-docs.js). Une annexe
// ne se signe pas : c'est la signature de l'acte qui lui donne son autorité.
function poserAnnexe(f, joint, ctx) {
  f.fermerPage();
  f.nouvellePage();
  f.ligne(f.gauche, f.y, f.droite, f.y, { epaisseur: nombre(f.plan.s.ruleWidth, 1) * PX_PT, couleur: f.plan.filet });
  f.y += 8;
  f.ecrire([{ texte: String(annexesVocab(ctx.config).label || "Annexe").toUpperCase(), style: { ...f.textes.note, taille: f.plan.corps * 0.72, italique: false } }],
    { apres: 3, justifie: false, garder: 2 });
  if (joint.libelle) f.ecrire([{ texte: joint.libelle, style: f.textes.intitule }], { apres: 9, justifie: false, garder: 2 });
  if (joint.doc) {
    const ctxAnnexe = { ...ctx, sansSignature: true };
    for (const n of joint.doc.nodes || []) poserNode(f, n, ctxAnnexe);
  }
}

const alignDe = (v) => (v === "center" || v === "right" ? v : "left");

// ==========================================================================
// Assemblage du PDF/A
// ==========================================================================

// Le paquet XMP : l'identité du fichier, en XML, telle que la norme l'exige. On
// n'y emploie QUE les vocabulaires normalisés (dc, xmp, pdf, pdfaid) : une
// propriété inventée devrait être déclarée dans un schéma d'extension, et une
// déclaration approximative rendrait le fichier non conforme. L'identifiant ELI
// trouve donc sa place là où le Dublin Core l'attend : dc:identifier.
function paquetXmp(meta, part) {
  const x = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/" x:xmptk="Scribae">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>${part}</pdfaid:part>
   <pdfaid:conformance>B</pdfaid:conformance>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:format>application/pdf</dc:format>
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${x(meta.titre)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${x(meta.auteur)}</rdf:li></rdf:Seq></dc:creator>
   <dc:description><rdf:Alt><rdf:li xml:lang="x-default">${x(meta.description)}</rdf:li></rdf:Alt></dc:description>
   ${meta.eli ? `<dc:identifier><rdf:Bag><rdf:li>${x(meta.eli)}</rdf:li></rdf:Bag></dc:identifier>` : ""}
   <dc:language><rdf:Bag><rdf:li>fr-FR</rdf:li></rdf:Bag></dc:language>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:CreatorTool>${x(meta.outil)}</xmp:CreatorTool>
   <xmp:CreateDate>${meta.date}</xmp:CreateDate>
   <xmp:ModifyDate>${meta.date}</xmp:ModifyDate>
   <xmp:MetadataDate>${meta.date}</xmp:MetadataDate>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdf:Producer>${x(meta.producteur)}</pdf:Producer>
   ${meta.motsCles ? `<pdf:Keywords>${x(meta.motsCles)}</pdf:Keywords>` : ""}
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

// L'horodatage XMP : « 2026-09-22T14:05:00+02:00 ». PDF/A compare ces valeurs à
// celles du dictionnaire d'information du fichier : les deux viennent donc du
// MÊME instant, calculé une seule fois.
function dateXmp(d) {
  const p = (n) => String(n).padStart(2, "0");
  const decalage = -d.getTimezoneOffset();
  const signe = decalage < 0 ? "-" : "+";
  const h = Math.floor(Math.abs(decalage) / 60);
  const m = Math.abs(decalage) % 60;
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate())
    + "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds())
    + signe + p(h) + ":" + p(m);
}

// Un logo de charte, prêt à poser : pdf-lib embarque les PNG et les JPEG. Une
// charte de démonstration porte un SVG (des données embarquées) : on le
// rasterise au passage. Un logo qu'on ne peut pas lire est simplement omis —
// un en-tête sans emblème vaut mieux qu'un export en échec.
async function poserLogo(pdf, url, hauteurPt) {
  try {
    const reponse = await fetch(url);
    const type = reponse.headers.get("content-type") || "";
    const octets = new Uint8Array(await reponse.arrayBuffer());
    if (/image\/png/i.test(type) || /\.png($|\?)/i.test(url)) return await pdf.embedPng(octets);
    if (/image\/jpe?g/i.test(type) || /\.jpe?g($|\?)/i.test(url)) return await pdf.embedJpg(octets);
    const png = await rasteriser(url, hauteurPt * 4);
    return png ? await pdf.embedPng(png) : null;
  } catch (e) {
    return null;
  }
}

// Un SVG (ou toute image que le navigateur sait dessiner) vers des octets PNG.
async function rasteriser(url, hauteurPx) {
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const ratio = (img.naturalWidth || 1) / (img.naturalHeight || 1);
    const largeur = Math.max(8, Math.round(hauteurPx * ratio));
    const hauteur = Math.max(8, Math.round(hauteurPx));
    if (typeof OffscreenCanvas === "function") {
      const toile = new OffscreenCanvas(largeur, hauteur);
      toile.getContext("2d").drawImage(img, 0, 0, largeur, hauteur);
      const blob = await toile.convertToBlob({ type: "image/png" });
      return new Uint8Array(await blob.arrayBuffer());
    }
    const c = document.createElement("canvas");
    c.width = largeur; c.height = hauteur;
    c.getContext("2d").drawImage(img, 0, 0, largeur, hauteur);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    return blob ? new Uint8Array(await blob.arrayBuffer()) : null;
  } catch (e) {
    return null;
  }
}

// Les métadonnées du fichier, tirées du document et du référentiel. Le titre,
// l'auteur et la description sont ceux que le PDF/A annonce : c'est ce que
// verront la recherche du poste, le gestionnaire de documents et le service
// d'archivage.
function metadonnees(doc, config) {
  const m = doc?.meta || {};
  const org = m.entity || m.org || {};
  const titre = (doc?.nodes || []).find((n) => n.type === "title")?.text
    || [m.numero, m.objet].filter(Boolean).join(" — ") || "Acte administratif";
  return {
    titre,
    auteur: org.name || config?.brand?.name || "",
    description: [m.objet, m.eli].filter(Boolean).join(" — ") || titre,
    eli: m.eli || "",
    outil: "Scribae — éditeur d'actes administratifs",
    producteur: "Scribae (export PDF/A)",
    motsCles: [m.numero, config?.brand?.name, m.eli].filter(Boolean).join(", "),
  };
}

// ==========================================================================
// API
// ==========================================================================

// Le PDF/A d'un document compilé. `part` choisit le niveau : 2 (défaut) ou 1.
// Renvoie les OCTETS du fichier — à l'appelant de les enregistrer ou de les
// télécharger (voir `telechargerPdfA`).
export async function creerPdfA({ doc, config, style, part = 2 } = {}) {
  if (!doc) throw new Error("Aucun document à exporter.");
  const { PDFDocument, PDFName, PDFString, PDFHexString, fontkit } = await chargerOutils();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const plan = planDeCharte(style);
  const textes = stylesTexte(plan);
  const feuille = new Feuille({ pdf, plan, textes, doc, config });

  // Les polices sont embarquées AVANT la mise en page : on ne peut mesurer un
  // texte qu'avec la police qui le composera. On n'embarque que les variantes
  // et les familles réellement employées par les styles du document.
  const variantes = new Set();
  const familles = new Set([plan.famille]);
  for (const st of Object.values(textes)) {
    variantes.add(varianteDe(st.graisse || 400, !!st.italique));
    if (st.famille) familles.add(st.famille);
  }
  for (const fam of familles) {
    for (const v of variantes) {
      const cle = fam + "/" + v;
      feuille.polices.set(cle, await pdf.embedFont(await lireRessource(FICHIERS_POLICE[fam][v], "fonts"), { subset: true }));
    }
  }

  // L'en-tête et le pied de page de la charte : leur texte accepte les jetons
  // ({{entity.name}}, {{numero}}… — voir `renderSheetText`, lib/render.js), et
  // leur logo est embarqué au passage.
  const s = plan.s;
  if (s.showHeader) {
    const logoUrl = String(s.logoUrl || "").trim();
    const hauteur = nombre(s.logoHeight, 42) * PX_PT;
    const image = logoUrl ? await poserLogo(pdf, logoUrl, hauteur) : null;
    plan.entete = {
      texte: renderSheetText(String(s.headerText || "").trim(), doc, config, s) || String(s.headerText || "").trim(),
      filet: s.headerRule !== false && s.ruleStyle !== "none",
      align: s.logoAlign === "center" ? "center" : s.logoAlign === "right" ? "right" : "left",
      capitales: !!s.headerCase,
      logo: image ? { image, hauteur, largeur: hauteur * (image.width / image.height) } : null,
    };
  }
  if (s.showFooter && String(s.footerText || "").trim()) {
    plan.pied = {
      texte: String(s.footerText).trim(),
      filet: s.ruleStyle !== "none",
      align: s.footerAlign === "left" ? "left" : s.footerAlign === "right" ? "right" : "center",
    };
  }

  poserDocument(feuille, doc, config, { tracking: doc?.meta?.consolidated?.showChanges === true });

  // ---- métadonnées : le dictionnaire d'information ET le paquet XMP, accordés
  const meta = metadonnees(doc, config);
  const instant = new Date();
  meta.date = dateXmp(instant);
  pdf.setTitle(meta.titre);
  if (meta.auteur) pdf.setAuthor(meta.auteur);
  pdf.setSubject(meta.description);
  if (meta.motsCles) pdf.setKeywords(meta.motsCles.split(/,\s*/));
  pdf.setCreator(meta.outil);
  pdf.setProducer(meta.producteur);
  pdf.setCreationDate(instant);
  pdf.setModificationDate(instant);
  pdf.setLanguage("fr-FR");

  const fluxXmp = pdf.context.stream(paquetXmp(meta, part), { Type: PDFName.of("Metadata"), Subtype: PDFName.of("XML") });
  pdf.catalog.set(PDFName.of("Metadata"), pdf.context.register(fluxXmp));

  // ---- OutputIntent : la règle de couleur, déposée dans le fichier
  const profil = await lireRessource("sRGB-v2-magic.icc");
  const refProfil = pdf.context.register(pdf.context.flateStream(profil, { N: 3 }));
  pdf.catalog.set(PDFName.of("OutputIntents"), pdf.context.obj([pdf.context.obj({
    Type: PDFName.of("OutputIntent"),
    S: PDFName.of("GTS_PDFA1"),
    OutputConditionIdentifier: PDFString.of("sRGB IEC61966-2.1"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    DestOutputProfile: refProfil,
  })]));
  pdf.catalog.set(PDFName.of("Lang"), PDFString.of("fr-FR"));

  // L'identifiant du fichier : la norme l'exige (trailer ID), et ses deux
  // parties doivent être identiques.
  const graine = Array.from(new TextEncoder().encode((meta.eli || meta.titre || "scribae") + "#" + instant.toISOString()));
  const identifiant = PDFHexString.of(graine.slice(0, 16).map((b) => b.toString(16).padStart(2, "0")).join(""));
  pdf.context.trailerInfo.ID = pdf.context.obj([identifiant, identifiant]);

  // PDF/A-1 est bâti sur PDF 1.4 : pas de flux d'objets, et un en-tête de
  // fichier qui l'annonce. On n'emploie pas non plus de flux d'objets pour
  // PDF/A-2 : un fichier d'archivage se lit mieux quand sa structure est
  // visible telle quelle, et la taille gagnée ne vaut pas la lisibilité perdue.
  // pdf-lib écrit toujours « %PDF-1.7 » : on corrige l'en-tête APRÈS coup — les
  // trois caractères de version ne changent pas de longueur, donc aucun décalage
  // n'est introduit dans le fichier.
  const sortie = new Uint8Array(await pdf.save({ useObjectStreams: false }));
  if (part === 1) sortie.set(new TextEncoder().encode("1.4"), 5);
  return sortie;
}

// Le nom du fichier : « 2026-401-VSL-pdfa.pdf ».
export function nomPdfA(doc, suffixe = "pdfa") {
  const base = String(doc?.meta?.numero || doc?.meta?.designation || "acte").replace(/[^\w-]+/g, "_");
  return (base || "acte") + (suffixe ? "-" + suffixe : "") + ".pdf";
}

// Crée le PDF/A et le TÉLÉCHARGE : c'est le geste de l'export. Une ligne dans
// les écrans, toute la mécanique ici.
export async function telechargerPdfA(doc, config, { style, part = 2, nom = "" } = {}) {
  const octets = await creerPdfA({ doc, config, style, part });
  const fichier = nom || nomPdfA(doc, part === 1 ? "pdfa-1b" : "pdfa-2b");
  download(fichier, new Blob([octets], { type: "application/pdf" }), "application/pdf");
  return { fichier, taille: octets.length };
}
