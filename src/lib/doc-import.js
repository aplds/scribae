// ============================================================================
// Import d'un document Word (.docx) ou LibreOffice (.odt) COMME TRAME.
//
// Une administration tient souvent son modèle d'acte dans un traitement de
// texte (« voici notre arrêté type »). Ce fichier n'est pas un acte : c'est un
// MODÈLE — ses « Vu… », ses « Considérant que… », son « ARRÊTE », ses articles,
// sa signature. L'import le relit, en reconnaît la structure, et en fait une
// TRAME, c'est-à-dire un document à trous que les services rempliront.
//
// Ce que l'import produit est un POINT DE DÉPART, jamais un résultat : la trame
// s'ouvre dans l'éditeur SANS être enregistrée (voir views/trames.js et
// views/editor.js), et c'est l'éditeur qui décide de la garder. Chaque décision
// de lecture est signalée (« points à vérifier ») plutôt que tue : une machine
// ne devine pas un modèle d'acte, elle en propose une lecture qu'un humain
// corrige.
//
// Les deux formats sont des archives ZIP contenant du XML — `word/document.xml`
// pour .docx, `content.xml` pour .odt. On les ouvre sans aucune dépendance :
// `DecompressionStream("deflate-raw")` décompresse, le `DOMParser` du navigateur
// lit le XML. Le texte retenu est celui du document TEL QU'IL SE PRÉSENTE : les
// passages supprimés par une révision Word (`w:delText`) sont ignorés.
// ============================================================================
import { newField, newNode } from "./schema.js";
import { normalizeTrame } from "./trame-format.js";

// ------------------------------------------------------------------ archives

// Ouvre une archive ZIP et rend son contenu à la demande. On ne lit que le
// répertoire central (la table des matières, en fin de fichier) : les entrées
// sont décompressées une par une, seulement si on les demande.
export async function ouvrirArchive(buffer) {
  const u8 = new Uint8Array(buffer);
  const vue = new DataView(buffer);
  let eocd = -1;
  const plancher = Math.max(0, u8.length - 22 - 65536);
  for (let i = u8.length - 22; i >= plancher; i--) {
    if (i + 4 <= u8.length && vue.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Ce fichier n'est pas une archive .docx ou .odt lisible.");
  const nombre = vue.getUint16(eocd + 10, true);
  let p = vue.getUint32(eocd + 16, true);
  const entrees = new Map();
  for (let i = 0; i < nombre && p + 46 <= u8.length; i++) {
    if (vue.getUint32(p, true) !== 0x02014b50) break;
    const methode = vue.getUint16(p + 10, true);
    const taille = vue.getUint32(p + 20, true);
    const nomLen = vue.getUint16(p + 28, true);
    const extraLen = vue.getUint16(p + 30, true);
    const commLen = vue.getUint16(p + 32, true);
    const local = vue.getUint32(p + 42, true);
    const nom = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nomLen));
    if (local + 30 <= u8.length && vue.getUint32(local, true) === 0x04034b50) {
      const lNom = vue.getUint16(local + 26, true);
      const lExtra = vue.getUint16(local + 28, true);
      const debut = local + 30 + lNom + lExtra;
      entrees.set(nom, { methode, data: u8.subarray(debut, debut + taille) });
    }
    p += 46 + nomLen + extraLen + commLen;
  }
  const octets = async (nom) => {
    const e = entrees.get(nom);
    if (!e) return null;
    if (e.methode === 0) return e.data;
    if (e.methode !== 8) throw new Error("Compression non prise en charge dans l'archive.");
    const flux = new Blob([e.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(flux).arrayBuffer());
  };
  return {
    noms: () => [...entrees.keys()],
    octets,
    async texte(nom) {
      const b = await octets(nom);
      return b ? new TextDecoder("utf-8", { fatal: false }).decode(b) : null;
    },
  };
}

// ------------------------------------------------------------------ XML

const parseXml = (texte) => new DOMParser().parseFromString(texte, "application/xml");
const enfants = (el) => (el ? [...el.children] : []);
const premier = (racine, nom) => [...(racine?.getElementsByTagName("*") || [])].find((e) => e.localName === nom) || null;
const tous = (racine, nom) => [...(racine?.getElementsByTagName("*") || [])].filter((e) => e.localName === nom);
// Les attributs portent un préfixe de namespace (`w:numId`, `text:style-name`) :
// on les lit par leur nom LOCAL, qui est le même partout.
const attr = (el, nom) => {
  if (!el || !el.attributes) return "";
  for (const a of el.attributes) if (a.localName === nom) return a.value;
  return "";
};

const normaliser = (t) => String(t || "")
  .replace(/\u00a0/g, " ")
  .replace(/[ \t\u202f]+/g, " ")
  .replace(/\s*\n\s*/g, "\n")
  .trim();

// ------------------------------------------------------------------ .docx

// Numérotation : `numId` → liste NUMÉROTÉE ou liste à puces. L'information vit
// dans `word/numbering.xml`, et elle compte : « 1° … 2° … » n'est pas une liste
// à puces.
async function numerotationDocx(zip) {
  const xml = await zip.texte("word/numbering.xml");
  const parNum = new Map();
  if (!xml) return parNum;
  const doc = parseXml(xml);
  const parModele = new Map();
  for (const an of tous(doc, "abstractNum")) {
    const id = attr(an, "abstractNumId");
    const lvl0 = enfants(an).find((c) => c.localName === "lvl" && (attr(c, "ilvl") || "0") === "0");
    const format = attr(tous(lvl0 || an, "numFmt")[0] || {}, "val");
    if (id) parModele.set(id, format !== "bullet" && format !== "none");
  }
  for (const num of tous(doc, "num")) {
    const id = attr(num, "numId");
    const modele = attr(tous(num, "abstractNumId")[0] || {}, "val");
    if (id) parNum.set(id, parModele.get(modele) !== false);
  }
  return parNum;
}

// Le texte d'un paragraphe Word : les `w:t` dans l'ordre, sauts de ligne et
// tabulations compris. Les passages supprimés (`w:delText`) ne sont plus dans le
// document : on ne les importe pas.
function texteDocx(el) {
  let out = "";
  const parcourir = (n) => {
    for (const c of n.childNodes || []) {
      if (c.nodeType !== 1) continue;
      const nom = c.localName;
      if (nom === "t") out += c.textContent;
      else if (nom === "tab") out += " ";
      else if (nom === "br" || nom === "cr") out += "\n";
      else if (nom === "noBreakHyphen") out += "-";
      else if (nom === "delText" || nom === "annotationRef" || nom === "footnoteRef" || nom === "endnoteRef") continue;
      else if (nom === "rPr" || nom === "pPr" || nom === "tblPr" || nom === "tcPr" || nom === "proofErr" || nom.startsWith("bookmark")) continue;
      else parcourir(c);
    }
  };
  parcourir(el);
  return normaliser(out);
}

function tableauDocx(tbl) {
  const lignes = [];
  for (const tr of enfants(tbl)) {
    if (tr.localName !== "tr") continue;
    const cellules = [];
    for (const tc of enfants(tr)) {
      if (tc.localName !== "tc") continue;
      const txt = enfants(tc)
        .filter((c) => c.localName === "p")
        .map((p) => texteDocx(p).replace(/\n/g, " ").trim())
        .filter(Boolean)
        .join(" ");
      cellules.push(txt);
    }
    if (cellules.length) lignes.push(cellules);
  }
  return tableauNormalise(lignes);
}

async function lireDocx(zip) {
  const xml = await zip.texte("word/document.xml");
  if (!xml) throw new Error("Le fichier .docx ne contient pas de document (word/document.xml).");
  const doc = parseXml(xml);
  const numerotation = await numerotationDocx(zip);
  const body = premier(doc, "body");
  if (!body) throw new Error("Document Word illisible.");
  const blocs = [];
  for (const c of enfants(body)) {
    if (c.localName === "p") {
      const b = paragrapheDocx(c, numerotation);
      if (b) blocs.push(b);
    } else if (c.localName === "tbl") {
      const t = tableauDocx(c);
      if (t) blocs.push(t);
    }
  }
  return blocs;
}

function paragrapheDocx(p, numerotation) {
  const texte = texteDocx(p);
  if (!texte) return null;
  const style = attr(tous(p, "pStyle")[0] || {}, "val");
  const numPr = tous(p, "numPr")[0];
  const titre = style.match(/(?:heading|titre|berschrift)\s*(\d)/i);
  if (numPr) {
    const id = attr(tous(numPr, "numId")[0] || {}, "numId") || "0";
    const niveau = attr(tous(numPr, "ilvl")[0] || {}, "ilvl") || "0";
    return { type: "li", text: texte.replace(/\n/g, " "), ordered: numerotation.get(id) !== false, listKey: id + ":" + niveau };
  }
  if (titre) return { type: "h", text: texte.replace(/\n/g, " "), level: Number(titre[1]) || 1 };
  return { type: "p", text: texte };
}

// ------------------------------------------------------------------ .odt

// Le style des puces et des numéros vit dans les styles automatiques du
// document : un `text:list-style` porte des `text:list-level-style-number`
// (numérotation) ou des `text:list-level-style-bullet` (puces).
function stylesOdt(doc) {
  const out = new Map();
  for (const style of tous(doc, "list-style")) {
    const nom = attr(style, "name");
    if (nom) out.set(nom, tous(style, "list-level-style-number").length > 0);
  }
  return out;
}

function texteOdt(el) {
  let out = "";
  const parcourir = (n) => {
    for (const c of n.childNodes || []) {
      if (c.nodeType === 3) { out += c.nodeValue; continue; }
      if (c.nodeType !== 1) continue;
      const nom = c.localName;
      if (nom === "annotation" || nom === "annotation-end" || nom === "change" || nom === "change-start" || nom === "change-end"
        || nom === "tracked-changes" || nom === "note" || nom === "note-body" || nom === "table-of-content") continue;
      if (nom === "line-break") { out += "\n"; continue; }
      if (nom === "tab") { out += " "; continue; }
      if (nom === "s") { out += " ".repeat(Number(attr(c, "c")) || 1); continue; }
      parcourir(c);
    }
  };
  parcourir(el);
  return normaliser(out);
}

function tableauOdt(tbl) {
  const lignes = [];
  for (const tr of enfants(tbl)) {
    if (tr.localName !== "table-row") continue;
    const cellules = [];
    for (const tc of enfants(tr)) {
      if (tc.localName !== "table-cell") continue;
      const txt = enfants(tc)
        .filter((c) => c.localName === "p" || c.localName === "h")
        .map((p) => texteOdt(p).replace(/\n/g, " ").trim())
        .filter(Boolean)
        .join(" ");
      cellules.push(txt);
    }
    if (cellules.length) lignes.push(cellules);
  }
  return tableauNormalise(lignes);
}

async function lireOdt(zip) {
  const xml = await zip.texte("content.xml");
  if (!xml) throw new Error("Le fichier .odt ne contient pas de contenu (content.xml).");
  const doc = parseXml(xml);
  const styles = stylesOdt(doc);
  const corps = premier(doc, "text");
  if (!corps) throw new Error("Document LibreOffice illisible.");
  const blocs = [];
  for (const c of enfants(corps)) parcourirOdt(c, styles, blocs, "");
  return blocs;
}

// `dansListe` : "" (hors liste), "ordered" ou "bulleted" — un paragraphe qui
// appartient à une liste devient un élément de liste, et c'est la liste du
// document qui donne son type.
function parcourirOdt(el, styles, blocs, dansListe) {
  const nom = el.localName;
  if (nom === "h") {
    const texte = texteOdt(el).replace(/\n/g, " ");
    if (texte) blocs.push({ type: "h", text: texte, level: Number(attr(el, "outline-level")) || 1 });
    return;
  }
  if (nom === "p") {
    const texte = texteOdt(el);
    if (!texte) return;
    if (dansListe) blocs.push({ type: "li", text: texte.replace(/\n/g, " "), ordered: dansListe === "ordered", listKey: "odt" });
    else blocs.push({ type: "p", text: texte });
    return;
  }
  if (nom === "list") {
    const ordonnee = styles.get(attr(el, "style-name")) === true;
    for (const item of enfants(el)) {
      if (item.localName !== "list-item") continue;
      for (const c of enfants(item)) parcourirOdt(c, styles, blocs, ordonnee ? "ordered" : "bulleted");
    }
    return;
  }
  if (nom === "table") {
    const t = tableauOdt(el);
    if (t) blocs.push(t);
    return;
  }
  if (nom === "section" || nom === "list-header") {
    for (const c of enfants(el)) parcourirOdt(c, styles, blocs, dansListe);
  }
}

// ------------------------------------------------------- tableau normalisé

function tableauNormalise(lignes) {
  const propres = lignes.filter((l) => l.some((c) => String(c).trim()));
  if (!propres.length) return null;
  const largeur = Math.max(...propres.map((l) => l.length));
  if (largeur < 2) return null;
  const norm = propres.map((l) => [...l, ...Array(largeur - l.length).fill("")].slice(0, largeur));
  // La première ligne fait l'en-tête si elle est faite de libellés courts ;
  // sinon elle reste une ligne de données et les colonnes prennent un nom neutre.
  const entete = norm[0].every((c) => c && c.length <= 28 && !/[.;]$/.test(c));
  return {
    type: "table",
    columns: norm[0].map((c, i) => (entete ? c || `Colonne ${i + 1}` : `Colonne ${i + 1}`)),
    rows: entete ? norm.slice(1) : norm,
    caption: "",
  };
}

// ------------------------------------------------- lecture d'un fichier

// Lit un fichier .docx ou .odt et rend ses blocs bruts (paragraphes, titres,
// éléments de liste, tableaux) — la matière que `trameDepuisBlocs` met en trame.
export async function lireDocument(fichier) {
  const nom = String(fichier?.name || "");
  const buffer = await fichier.arrayBuffer();
  const zip = await ouvrirArchive(buffer);
  const noms = zip.noms();
  if (noms.includes("word/document.xml")) return { kind: "docx", nom, blocs: await lireDocx(zip) };
  if (noms.includes("content.xml")) return { kind: "odt", nom, blocs: await lireOdt(zip) };
  throw new Error("Ce fichier n'est pas un document Word (.docx) ou LibreOffice (.odt).");
}

// ------------------------------------------------------ blocs → trame

const ENACT = /^(arr[êe]te|d[ée]cide|d[ée]cides|statue|pr[ée]cise|ordonne|autorise)\b/i;
const JETON = /\{\{\s*([a-zA-Z_][\w.]*)\s*(?:\|[^}]*)?\}\}/g;
const ART = /^(?:article|art\.?)\s+([^\s:–—-]+)\s*[:.–—-]?\s*(.*)$/i;
const DIVISION = /^(livre|titre|chapitre|section|partie)\s+([ivxlcdm0-9]+)\b/i;
const ECHELON_DIVISION = { livre: 1, titre: 2, partie: 2, chapitre: 3, section: 4 };
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const MOTIF_DATE = new RegExp("\\bdu\\s+\\d{1,2}\\s*(?:er)?\\s+(?:" + MOIS.join("|") + ")\\s+\\d{4}", "i");
// L'en-tête d'autorité : la ligne de la COLLECTIVITÉ (mairie, département,
// établissement…). « RÉPUBLIQUE FRANÇAISE » n'est retenu qu'à défaut — c'est un
// en-tête d'État, pas l'autorité qui signe.
// Note : `\b` ne fonctionne pas après une lettre accentuée (« collectivité »),
// on exige donc explicitement l'absence d'une lettre ensuite.
const ENTITE = /^(mairie|commune|ville|d[ée]partement|r[ée]gion|pr[ée]fecture|sous-pr[ée]fecture|[ée]tablissement|ccas|caisse|office|syndicat|collectivit[ée]|centre)(?![\wÀ-ÿ])/i;
const ENTITE_ETAT = /^(r[ée]publique)\b/i;
// Numérotations écrites à la main (« 1° … », « 1) … », « a) … ») : les listes
// d'un acte se lisent ainsi, et un « 1° » n'est pas un paragraphe comme un autre.
const NUMEROTEE = /^(\d{1,2})\s*([°.)])\s*|^([a-z])\s*\)\s*/;

const CHAMPS_CONNUS = {
  numero: { label: "Numéro de l'acte", group: "Identification" },
  objet: { label: "Objet", type: "textarea", group: "Identification" },
  dateSignature: { label: "Date de signature", type: "date", group: "Identification" },
  dateEffet: { label: "Date d'effet", type: "date", group: "Identification", required: false },
  signataire: { label: "Signataire", type: "signataire", group: "Signature" },
};

function versionCourante() {
  const d = new Date();
  return String(d.getFullYear()).slice(2) + String(d.getMonth() + 1).padStart(2, "0");
}

// Le type d'acte se déduit de la formule d'édiction du document : un « ARRÊTE »
// n'est pas une « DÉLIBÉRATION ».
function typeDepuisEnact(config, enact) {
  const mot = String(enact || "").toLowerCase();
  if (!mot) return "";
  const motCle = /arr[êe]t/.test(mot) ? "arr[êe]t"
    : /d[ée]cid/.test(mot) ? "d[ée]cid"
      : /d[ée]lib/.test(mot) ? "d[ée]lib"
        : /r[èe]glement/.test(mot) ? "r[èe]glement" : "";
  if (!motCle) return "";
  const re = new RegExp(motCle);
  return (config?.actTypes || []).find((t) => re.test(String(t.id || "").toLowerCase()) || re.test(String(t.label || "").toLowerCase()))?.id || "";
}

// Intitulé : le numéro et la date du document d'origine sont remplacés par les
// CHAMPS correspondants — c'est ce qui fait d'un document daté un modèle
// réutilisable. La fin (« portant … ») devient l'objet, rendu à part : il
// permet de NOMMER la trame d'après ce dont elle traite, pas d'après sa date.
function tokeniserTitre(texte, avertissements) {
  let t = String(texte);
  let touche = false;
  const num = t.replace(/\bn[°º]\s*([0-9A-Z][\w\-/.]*)/i, "n°{{numero}}");
  if (num !== t) { t = num; touche = true; }
  const date = t.replace(MOTIF_DATE, "du {{dateSignature|date-long}}");
  if (date !== t) { t = date; touche = true; }
  const objet = (t.match(/\bportant\s+(.{3,})$/i) || [])[1] || "";
  const avecObjet = t.replace(/\bportant\s+(.{3,})$/i, "portant {{objet}}");
  if (avecObjet !== t) { t = avecObjet; touche = true; }
  if (touche) {
    avertissements.push("L'intitulé a été relié aux champs : le numéro, la date et l'objet du document sont devenus {{numero}}, {{dateSignature}} et {{objet}} — vérifiez que le découpage est exact.");
  }
  return { texte: t, objet };
}

// Les jetons déjà écrits dans le document d'origine (`{{objet}}`, `{{dateEffet}}`
// …) font foi : l'import crée les champs correspondants plutôt que de les
// perdre. On les cherche sur les blocs BRUTS, avant toute tokenisation — sinon
// les jetons que l'import vient lui-même d'écrire dans l'intitulé se feraient
// passer pour des jetons d'origine.
function jetonsDesBlocs(blocs) {
  const trouves = new Set();
  const scanner = (texte) => {
    for (const m of String(texte || "").matchAll(JETON)) if (!m[1].includes(".")) trouves.add(m[1]);
  };
  for (const b of blocs) {
    if (b.type === "table") {
      for (const cellule of b.columns || []) scanner(cellule);
      for (const ligne of b.rows || []) for (const cellule of ligne) scanner(cellule);
    } else {
      scanner(b.text);
    }
  }
  return [...trouves];
}

const estTitreCourt = (t) => String(t || "").length <= 90 && !/[.]\s+\S/.test(String(t || ""));

// L'intitulé d'un article est un membre de phrase court (« Objet », « Durée de
// l'autorisation »), pas la première phrase du dispositif : un « Article 1er.
// Madame X est nommée… » n'a pas d'intitulé, seulement un texte.
const estIntituleArticle = (t) => {
  const s = String(t || "").trim();
  return s.length > 0 && s.length <= 60 && !/[.;:]$/.test(s);
};

function nettoieNom(t) {
  return String(t || "")
    .replace(/\{\{[^}]*\}\}/g, "")
    .replace(/\bn[°º]\s*/i, "")
    .replace(/^[^A-Za-zÀ-ÿ0-9]+/, "")
    .replace(/\s{2,}/g, " ")
    .trim()
    .slice(0, 80);
}

// Un nom de trame commence par une majuscule : « Arrêté — Délégation de… ».
const majuscule = (t) => {
  const s = String(t || "");
  return s ? s[0].toUpperCase() + s.slice(1) : s;
};

// Met les blocs lus en TRAME : c'est ici que la structure d'un acte
// administratif est reconnue — intitulé, autorité, visas, considérants, formule
// d'édiction, articles (et divisions, listes, tableaux), mentions, signature.
export function trameDepuisBlocs(blocs, { nom = "", config = {}, owner = "" } = {}) {
  const avertissements = [];
  const body = [];
  let division = null;      // dernière division ouverte : { cible }
  let article = null;       // article courant : { node, ordinaire }
  let liste = null;         // liste en cours : { node, cle }
  let visaNode = null;
  let considNode = null;
  let enact = "";
  let signature = false;

  const conteneur = () => (division ? division.cible : body);
  // Les paragraphes, listes et tableaux d'un article lui appartiennent ; tout le
  // reste (division, article, mention, signature) se range dans le conteneur.
  const jeter = (node) => {
    const dedans = article && ["para", "list", "table"].includes(node.type);
    (dedans ? article.node.blocks : conteneur()).push(node);
  };
  const fermerListe = () => { liste = null; };
  const fermerArticle = () => { article = null; };

  const restes = [...blocs];
  const premierTexte = restes.findIndex((b) => (b.type === "p" || b.type === "h") && String(b.text || "").trim());
  if (premierTexte < 0) return { body: [], avertissements: ["Aucun texte n'a été trouvé dans le document."], raw: null };

  // ---------------------------------------------------- en-tête, puis intitulé
  let titreIndex = restes.findIndex((b, i) => i >= premierTexte && (b.type === "p" || b.type === "h") && /\bn[°º]\s*\S/i.test(String(b.text || "")));
  if (titreIndex < 0) titreIndex = premierTexte;

  const avant = restes.splice(0, titreIndex);
  const lignesAvant = avant.filter((b) => (b.type === "p" || b.type === "h") && String(b.text || "").trim());
  // La ligne d'autorité est celle de la COLLECTIVITÉ — on la préfère à la ligne
  // d'État (« RÉPUBLIQUE FRANÇAISE »), qui coiffe tous les actes officiels mais
  // ne dit pas QUI signe.
  const ligneEntite = lignesAvant.find((b) => estLigneEntite(b.text)) || lignesAvant.find((b) => ENTITE_ETAT.test(String(b.text).trim()));
  if (ligneEntite) {
    jeter(newNode("authority", { text: String(ligneEntite.text).replace(/\n/g, " ") }));
    avertissements.push("Le bloc « Autorité » reprend la ligne du document (« " + String(ligneEntite.text).slice(0, 60) + "… »). Si elle doit suivre la collectivité, remplacez-la par le jeton {{entity.authorityFormula}}.");
  }
  const perdues = lignesAvant.filter((b) => b !== ligneEntite);
  if (perdues.length) {
    avertissements.push("Des lignes précèdent l'intitulé (« " + String(perdues[0].text).slice(0, 60) + "… ») : elles n'ont pas été reprises, l'en-tête de la collectivité venant du référentiel et de la feuille de style.");
  }

  const titre = restes.shift();
  const texteTitre = String(titre.text || "").replace(/\n/g, " ");
  let objetTitre = "";
  let texteTitreFinal = texteTitre;
  if (/\{\{/.test(texteTitre)) {
    avertissements.push("L'intitulé portait déjà des jetons : il a été repris tel quel.");
  } else {
    const tok = tokeniserTitre(texteTitre, avertissements);
    texteTitreFinal = tok.texte;
    objetTitre = tok.objet;
  }
  jeter(newNode("title", { text: texteTitreFinal }));

  // ---------------------------------------------------- le reste du document
  for (let i = 0; i < restes.length; i++) {
    const b = restes[i];
    const texte = String(b.text || "").trim();

    if (b.type === "table") { fermerListe(); jeter(newNode("table", { columns: b.columns, rows: b.rows, caption: b.caption || "" })); continue; }
    if (!texte) continue;

    // --- la signature, et ce qui suit (nom, fonction) : le signataire du
    // document d'origine ne se reprend pas, il vient du champ « Signataire ».
    if (/^fait\s+[àa](?=[\s,;:]|$)/i.test(texte)) {
      fermerListe(); fermerArticle();
      jeter(newNode("signature", { place: "{{entity.seatCity}}" }));
      signature = true;
      const suite = [];
      while (i + 1 < restes.length && (restes[i + 1].type === "p" || restes[i + 1].type === "h")) {
        const t = String(restes[i + 1].text || "").trim();
        if (!t || t.length > 80 || /[.;]$/.test(t) || ENACT.test(t) || ART.test(t) || /^(vu|consid)/i.test(t)) break;
        suite.push(t);
        i++;
      }
      if (suite.length) avertissements.push("Le signataire du document (« " + suite.join(", ").slice(0, 80) + " ») n'a pas été repris : il vient du champ « Signataire », choisi par la rédaction.");
      continue;
    }

    // --- divisions : Livre, Titre, Chapitre, Section
    const trouveDivision = texte.match(DIVISION);
    const niveau = b.type === "h" ? Math.min(4, Math.max(1, b.level || 1)) : (trouveDivision ? ECHELON_DIVISION[trouveDivision[1].toLowerCase()] : 0);
    if (niveau && (b.type === "h" || estTitreCourt(texte))) {
      fermerListe(); fermerArticle();
      const node = newNode("division", { level: niveau, heading: texte.replace(/\.$/, ""), blocks: [] });
      conteneur().push(node);
      division = { cible: node.blocks };
      continue;
    }

    // --- articles
    const art = texte.match(ART);
    if (art) {
      fermerListe();
      const num = art[1];
      const reste = art[2].trim();
      const ordinaire = /^(1er|premier|\d{1,3})$/i.test(num);
      article = { node: newNode("article", {
        numMode: ordinaire ? "auto" : "manual",
        num: ordinaire ? (num.toLowerCase() === "premier" ? "1er" : num) : num,
        heading: estIntituleArticle(reste) ? reste : "",
        blocks: [],
      }), ordinaire };
      conteneur().push(article.node);
      if (reste && article.node.heading !== reste) article.node.blocks.push(newNode("para", { text: reste }));
      continue;
    }

    // --- visas et considérants (avant la formule d'édiction)
    if (!enact && /^vu\b/i.test(texte)) {
      fermerListe(); fermerArticle();
      if (!visaNode) { visaNode = newNode("visas", { items: [] }); conteneur().push(visaNode); }
      visaNode.items.push({ id: "", refId: "", text: texte.replace(/\s*\n\s*/g, " "), when: "" });
      continue;
    }
    if (!enact && /^consid[ée]rant/i.test(texte)) {
      fermerListe(); fermerArticle();
      if (!considNode) { considNode = newNode("considerants", { items: [] }); conteneur().push(considNode); }
      considNode.items.push({ id: "", text: texte.replace(/\s*\n\s*/g, " "), when: "" });
      continue;
    }

    // --- la formule d'édiction
    if (!enact && ENACT.test(texte) && estTitreCourt(texte)) {
      fermerListe(); fermerArticle();
      enact = texte.replace(/[:.]$/, "");
      conteneur().push(newNode("enact", { text: enact }));
      continue;
    }

    // --- la clause de recours : une mention, pas un paragraphe
    if (/recours/i.test(texte) && /(deux mois|contentieux|tribunal administratif|greffe)/i.test(texte)) {
      fermerListe(); fermerArticle();
      conteneur().push(newNode("mention", { textOverride: texte.replace(/\s*\n\s*/g, " ") }));
      continue;
    }

    // --- listes : celles du traitement de texte, et celles numérotées à la main
    const numerotee = texte.match(NUMEROTEE);
    if (b.type === "li" || numerotee) {
      const cle = b.type === "li" ? (b.listKey || "liste") : "manuel:" + (numerotee[2] || "a)");
      const ordonnee = b.type === "li" ? b.ordered !== false : true;
      const marque = !numerotee ? "" : numerotee[3] ? "lalpha" : numerotee[2] === "°" ? "degree" : numerotee[2] === ")" ? "parenth" : "decimal";
      const texteItem = numerotee ? texte.replace(NUMEROTEE, "") : texte;
      if (!liste || liste.cle !== cle) {
        const node = newNode("list", { ordered: ordonnee, numbering: ordonnee ? (marque || "decimal") : "", marker: ordonnee ? "" : "disc", start: 1, items: [] });
        jeter(node);
        liste = { node, cle };
      }
      liste.node.items.push({ id: "", text: texteItem.replace(/\n/g, " "), when: "" });
      continue;
    }
    fermerListe();

    // --- paragraphe ordinaire
    jeter(newNode("para", { text: texte.replace(/\n/g, " ") }));
  }

  // --- ce que l'import n'a pas su lire
  if (!enact) avertissements.push("Aucune formule d'édiction (ARRÊTE, DÉCIDE…) n'a été reconnue : vérifiez le bloc « Formule d'édiction ».");
  if (!body.some((n) => n.type === "article" || n.type === "division")) {
    avertissements.push("Aucun article n'a été reconnu (« Article 1 », « Article 1er »…) : le dispositif est repris en paragraphes, à découper dans l'éditeur.");
  }
  if (article && !article.ordinaire) {
    avertissements.push("Les articles n'étaient pas numérotés de 1 à n : leur numérotation d'origine a été conservée. Passez-les en numérotation automatique si l'acte doit se renuméroter.");
  }
  if (!signature) jeter(newNode("signature", { place: "{{entity.seatCity}}" }));

  // --- les champs
  const jetons = jetonsDesBlocs(blocs);
  const vus = new Set();
  const fields = [];
  for (const cle of ["numero", "objet", "dateSignature", "dateEffet", "signataire", ...jetons]) {
    if (vus.has(cle)) continue;
    vus.add(cle);
    const connu = CHAMPS_CONNUS[cle];
    if (connu) fields.push(newField({ id: cle, ...connu }));
    else fields.push(newField({
      id: cle, type: "text", group: "Acte importé", required: false,
      label: cle.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()),
      help: "Champ repris du document importé (jeton {{" + cle + "}}).",
    }));
  }
  if (jetons.length) {
    avertissements.push("Le document portait déjà des jetons (" + jetons.slice(0, 6).map((j) => "{{" + j + "}}").join(", ") + (jetons.length > 6 ? "…" : "") + ") : les champs correspondants ont été créés.");
  } else {
    avertissements.push("Les champs d'identification (numéro, objet, date, signataire) ont été ajoutés : complétez leurs libellés et leurs contrôles selon l'usage du service.");
  }

  const typeId = typeDepuisEnact(config, enact);
  const libelleType = (config?.actTypes || []).find((t) => t.id === typeId)?.label || "";
  // Nom de la trame : le type d'acte, puis ce dont elle traite — jamais sa date.
  const propose = [libelleType, majuscule(objetTitre) || nettoieNom(texteTitreFinal)].filter(Boolean).join(" — ") || nettoieNom(nom);

  return {
    avertissements,
    raw: {
      name: (nom || propose || "Trame importée").slice(0, 120),
      version: versionCourante(),
      actTypeId: typeId || "",
      status: "draft",
      owner,
      description: "",
      fields,
      body,
    },
  };
}

// Une ligne d'en-tête de collectivité : courte, et qui commence par une qualité
// d'administration.
const estLigneEntite = (t) => {
  const s = String(t || "").trim();
  return s.length > 0 && s.length <= 90 && ENTITE.test(s);
};

// ------------------------------------------------------------ point d'entrée

// Lit un fichier .docx ou .odt et rend la trame proposée (NON enregistrée), ses
// problèmes bloquants et ses points à vérifier. Le fichier passe ensuite par le
// même chemin que l'import JSON (src/lib/trame-format.js) : identifiants
// régénérés, valeurs par défaut complétées, structure vérifiée.
export async function trameDepuisFichier(fichier, { nom = "", config = {}, owner = "" } = {}) {
  const lu = await lireDocument(fichier);
  if (!lu.blocs.length) return { trame: null, issues: ["Le document ne contient aucun texte exploitable."], avertissements: [], kind: lu.kind, nom: lu.nom };
  const { raw, avertissements } = trameDepuisBlocs(lu.blocs, { nom, config, owner });
  const res = normalizeTrame(raw);
  return { trame: res.trame, issues: res.issues, avertissements: [...avertissements, ...res.warnings], kind: lu.kind, nom: lu.nom };
}

export const LIBELLE_FORMAT = { docx: "document Word", odt: "document LibreOffice" };
