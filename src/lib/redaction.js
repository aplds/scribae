// ============================================================================
// Couche « rédaction ».
//
// Le rédacteur travaille directement dans le document, comme dans un traitement
// de texte. Il peut :
//   • remplir les champs prévus par la trame (les pastilles du document) ;
//   • réécrire librement le texte prérempli par les administrateurs.
//
// Toute réécriture d'un texte issu de la trame est un ÉCART : elle est
// conservée — le texte du rédacteur n'est jamais écrasé — mais marquée « non
// conforme à la trame » et signalée aux administrateurs. Rien n'est bloqué :
// adapter une rédaction peut être parfaitement légitime.
//
// Un « emplacement » (slot) est désigné par une adresse stable construite sur
// le chemin du bloc dans la trame :
//   body.3                texte du bloc n°3
//   body.3.heading        intitulé de l'article n°3
//   body.3.blocks.1       texte du paragraphe n°1 de l'article n°3
//   body.2.items.0        texte du visa n°0
//   body.5.caption        légende du tableau
//   body.5.columns.1      titre de la colonne n°1
//   body.5.rows.0.2       cellule (ligne 0, colonne 2)
//   body.7.place          lieu de signature
//
// Les écarts vivent dans `values.__overrides` : { adresse: texte source }.
// Le texte source conserve les jetons `{{…}}` ; remplir un champ ne change donc
// pas la source et ne crée jamais d'écart.
// ============================================================================
import { normalizeSpace } from "./util.js";
import { BLOC_DEFAUT } from "./schema.js";

// Propriété qui porte le texte d'un bloc simple (l'adresse est alors le chemin
// du bloc lui-même). Les autres emplacements (intitulé, éléments de liste,
// cellules de tableau, lieu de signature) ont une adresse suffixée.
export const SLOT_PROP = {
  title: "text",
  authority: "text",
  enact: "text",
  para: "text",
  raw: "text",
  mention: "textOverride",
};

export const SLOT_LABEL = {
  title: "Intitulé",
  authority: "Auteur de l'acte",
  enact: "Formule d'édiction",
  para: "Paragraphe",
  raw: "Passage libre",
  mention: "Mention",
  visas: "Visa",
  considerants: "Considérant",
  list: "Élément de liste",
  table: "Tableau",
  signature: "Lieu de signature",
  heading: "Intitulé d'article",
  division: "Intitulé de division",
};

// Une mention affiche le texte du référentiel, sauf surcharge du rédacteur.
export function mentionSource(node, config) {
  if (node?.textOverride) return node.textOverride;
  const m = (config?.mentions || []).find((x) => x.id === node?.mentionId);
  return m?.text || "";
}

// ---------------------------------------------------------------------------
// Application des écarts au texte de la trame (avant interprétation)
// ---------------------------------------------------------------------------
// Réglages de bloc que la rédaction peut ajuster sans toucher au modèle : le
// niveau d'une division, sa numérotation (et celle d'un article), le texte d'un
// numéro écrit à la main, et — pour les blocs de texte — leur mise en forme
// (alignement, retrait, encadré, marque de liste, disposition de tableau,
// formule des considérants : voir `paramsBloc`, lib/schema.js). Ce sont des
// écarts au même titre qu'une réécriture — ils sont signalés aux
// administrateurs (voir `reglagesEcarts`).
//
// L'ordre de la liste est celui des rubriques du panneau de rédaction.
export const REGLAGES_PAR_TYPE = {
  // `level` reste acceptée pour un article : d'anciens brouillons peuvent en
  // porter un, et un écart inutile ne doit pas devenir une erreur.
  article: ["level", "numMode", "num"],
  division: ["level", "numMode", "num"],
  para: ["align", "indent", "boxed"],
  list: ["ordered", "marker", "numbering", "start"],
  table: ["captionPos", "head", "layout", "align"],
  considerants: ["formule", "fin", "inline"],
};

// Les réglages dont la valeur est un nombre ou un booléen : la valeur relue
// dans un écart (chaîne, le plus souvent) y est ramenée avant d'habiller le
// document.
export const REGLAGE_TYPES = {
  level: Number, start: Number,
  ordered: Boolean, boxed: Boolean, head: Boolean, inline: Boolean,
};

export const SLOT_REGLAGES = {
  level: "Échelon",
  numMode: "Numérotation",
  num: "Numéro",
  align: "Alignement",
  indent: "Retrait",
  boxed: "Encadré",
  ordered: "Genre de liste",
  marker: "Marqueur",
  numbering: "Numérotation de liste",
  start: "Numéro de départ",
  captionPos: "Position de la légende",
  head: "Ligne d'en-tête",
  layout: "Disposition du tableau",
  formule: "Formule des considérants",
  fin: "Ponctuation finale",
  inline: "Considérants en un seul alinéa",
};

// La valeur d'un réglage telle qu'elle doit habiller le document.
export function valeurReglage(k, v) {
  const f = REGLAGE_TYPES[k];
  if (!f) return v;
  if (f === Boolean) return v === true || v === "true" || v === "1";
  const n = Number(v);
  return Number.isFinite(n) ? f(n) : v;
}

export function overrideNode(node, path, ov) {
  if (!ov || !node) return node;
  const out = { ...node };
  const prop = SLOT_PROP[node.type];
  if (prop && ov[path] !== undefined) out[prop] = ov[path];
  if (node.type === "article" && ov[path + ".heading"] !== undefined) out.heading = ov[path + ".heading"];
  if (node.type === "division" && ov[path + ".heading"] !== undefined) out.heading = ov[path + ".heading"];
  // Les réglages du bloc (échelon, numérotation, mise en forme…) : ceux que la
  // rédaction a ajustés, et ceux-là seuls.
  for (const k of REGLAGES_PAR_TYPE[node.type] || []) {
    if (ov[path + "." + k] !== undefined) out[k] = valeurReglage(k, ov[path + "." + k]);
  }
  if (out.level !== undefined && out.level !== null && out.level !== "") out.level = Math.max(1, Number(out.level) || 1);
  if (node.type === "signature" && ov[path + ".place"] !== undefined) out.place = ov[path + ".place"];
  if (Array.isArray(node.items)) {
    out.items = node.items.map((it, i) => (ov[`${path}.items.${i}`] !== undefined ? { ...it, text: ov[`${path}.items.${i}`] } : it));
  }
  if (node.type === "table") {
    if (ov[path + ".caption"] !== undefined) out.caption = ov[path + ".caption"];
    if (Array.isArray(node.columns)) out.columns = node.columns.map((c, i) => (ov[`${path}.columns.${i}`] !== undefined ? ov[`${path}.columns.${i}`] : c));
    if (Array.isArray(node.rows)) out.rows = node.rows.map((r, ri) => (r || []).map((c, ci) => (ov[`${path}.rows.${ri}.${ci}`] !== undefined ? ov[`${path}.rows.${ri}.${ci}`] : c)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Inventaire des emplacements éditables d'une trame
// ---------------------------------------------------------------------------
export function listSlots(trame, config) {
  const out = [];
  const walk = (nodes, base) => {
    (nodes || []).forEach((node, i) => {
      const path = `${base}.${i}`;
      switch (node.type) {
        case "title":
        case "authority":
        case "enact":
        case "para":
        case "raw":
          out.push({ addr: path, nodeType: node.type, original: node.text || "", label: SLOT_LABEL[node.type] });
          break;
        case "mention":
          out.push({ addr: path, nodeType: node.type, original: mentionSource(node, config), label: SLOT_LABEL.mention });
          break;
        case "article":
          out.push({ addr: `${path}.heading`, nodeType: "heading", original: node.heading || "", label: SLOT_LABEL.heading });
          walk(node.blocks || [], `${path}.blocks`);
          break;
        case "division":
          // L'intitulé d'une division (« Livre Ier — Dispositions générales »)
          // se réécrit comme celui d'un article ; la réécriture est un écart.
          out.push({ addr: `${path}.heading`, nodeType: "division", original: node.heading || "", label: SLOT_LABEL.division });
          walk(node.blocks || [], `${path}.blocks`);
          break;
        case "visas":
        case "considerants":
        case "list":
          (node.items || []).forEach((it, j) => out.push({
            addr: `${path}.items.${j}`, nodeType: node.type, original: it.text || "",
            label: `${SLOT_LABEL[node.type]} ${j + 1}`,
          }));
          break;
        case "table":
          out.push({ addr: `${path}.caption`, nodeType: "table", original: node.caption || "", label: "Légende du tableau" });
          (node.columns || []).forEach((c, j) => out.push({ addr: `${path}.columns.${j}`, nodeType: "table", original: c || "", label: `Colonne ${j + 1}` }));
          (node.rows || []).forEach((r, ri) => (r || []).forEach((c, ci) => out.push({
            addr: `${path}.rows.${ri}.${ci}`, nodeType: "table", original: c || "", label: `Cellule ligne ${ri + 1}, colonne ${ci + 1}`,
          })));
          break;
        case "signature":
          out.push({ addr: `${path}.place`, nodeType: "signature", original: node.place || "", label: SLOT_LABEL.signature });
          break;
        default:
          break;
      }
    });
  };
  walk(trame?.body || [], "body");
  return out;
}

// Écarts = emplacements dont le texte source a réellement changé.
export function ecarts(trame, overrides, config) {
  if (!overrides) return [];
  const out = [];
  for (const s of listSlots(trame, config)) {
    const v = overrides[s.addr];
    if (v === undefined) continue;
    if (normalizeSpace(v) === normalizeSpace(s.original)) continue;
    out.push({ ...s, current: v });
  }
  return out;
}

// Réglages de bloc modifiés par la rédaction (échelon, numérotation, mise en
// forme des blocs de texte). Ce ne sont pas des emplacements de texte : ils
// sont donc listés à part, puis présentés avec les écarts (voir lib/compile.js).
export function reglagesEcarts(trame, overrides) {
  if (!overrides) return [];
  const out = [];
  const walk = (nodes, base) => (nodes || []).forEach((n, i) => {
    const path = `${base}.${i}`;
    for (const k of REGLAGES_PAR_TYPE[n.type] || []) {
      const addr = `${path}.${k}`;
      const v = overrides[addr];
      if (v === undefined) continue;
      // Un réglage absent du modèle se compare au DÉFAUT du bloc (voir
      // `paramsBloc`) : régler un paragraphe « comme la feuille de style » ne
      // doit pas être signalé comme un écart.
      const original = n[k] !== undefined && n[k] !== null ? n[k] : (BLOC_DEFAUT[n.type] || {})[k];
      if (String(v) === String(original ?? "")) continue;
      out.push({
        addr, path, nodeType: k, original: original ?? "", current: valeurReglage(k, v),
        label: SLOT_REGLAGES[k] || k, reglage: true,
      });
    }
    if (n.blocks) walk(n.blocks, `${path}.blocks`);
  });
  walk(trame?.body || [], "body");
  return out;
}

// Un écart peut porter sur un texte vide (le rédacteur a tout effacé).
export function hasEcart(overrides, addr, original) {
  const v = overrides?.[addr];
  if (v === undefined) return false;
  return normalizeSpace(v) !== normalizeSpace(original || "");
}

// ---------------------------------------------------------------------------
// Champs « placés » dans le texte de la trame
// ---------------------------------------------------------------------------
export function fieldIdsInText(trame) {
  const found = new Set();
  const ids = new Set((trame?.fields || []).map((f) => f.id));
  const scan = (text) => {
    const re = /\{\{([\s\S]*?)\}\}/g;
    let m;
    while ((m = re.exec(String(text || "")))) {
      const expr = m[1].split("|")[0].trim();
      const base = expr.split(/[.\s(?:+×/'"=!<>&|]+/)[0];
      if (ids.has(base)) found.add(base);
    }
  };
  const walk = (nodes) => (nodes || []).forEach((n) => {
    for (const k of ["text", "heading", "place", "caption", "textOverride"]) if (n[k]) scan(n[k]);
    (n.items || []).forEach((it) => scan(it.text));
    (n.columns || []).forEach((c) => scan(c));
    (n.rows || []).forEach((r) => (r || []).forEach((c) => scan(c)));
    if (n.blocks) walk(n.blocks);
  });
  walk(trame?.body || []);
  return found;
}

// ---------------------------------------------------------------------------
// Repérage humain d'une adresse dans un document compilé
// ---------------------------------------------------------------------------
function nodeLabel(n) {
  if (!n) return "";
  switch (n.type) {
    case "title": return "Intitulé";
    case "authority": return "Auteur de l'acte";
    case "visas": return "Visas";
    case "considerants": return "Considérants";
    case "enact": return "Formule d'édiction";
    case "article": return n.numLabel || "Article";
    case "division": return [n.numLabel, n.heading].filter(Boolean).join(" — ") || "Division";
    case "annexes": return "Annexes";
    case "para": return "Paragraphe";
    case "list": return "Liste";
    case "table": return "Tableau";
    case "signature": return "Signature";
    case "mention": return "Mention";
    default: return n.type || "Passage";
  }
}

function compiledIndex(doc) {
  const out = [];
  const walk = (nodes) => (nodes || []).forEach((n) => {
    if (n.path) out.push({ path: n.path, label: nodeLabel(n), type: n.type });
    walk(n.blocks);
  });
  walk(doc?.nodes || []);
  return out;
}

// « Article 2 — Paragraphe », aussi précis que possible.
export function locateAddr(doc, addr) {
  // Un réglage (`.level`, `.numMode`, `.num`) se rapporte au BLOC qui le porte :
  // on l'y ramène pour le repérer, comme une réécriture de son intitulé.
  const suffixe = String(addr).split(".").slice(-1)[0];
  const reglage = SLOT_REGLAGES[suffixe];
  if (reglage) addr = String(addr).slice(0, -(suffixe.length + 1));
  const entries = compiledIndex(doc);
  const matches = entries.filter((e) => addr === e.path || addr.startsWith(e.path + "."));
  if (!matches.length) {
    return { label: reglage || SLOT_LABEL[compiledKind(addr)] || "Passage", area: "" };
  }
  matches.sort((a, b) => a.path.length - b.path.length);
  const own = matches[matches.length - 1];
  const container = matches.length > 1 ? matches[matches.length - 2] : null;
  const fine = reglage || slotLabelOf(own, addr);
  return {
    label: fine || own.label,
    area: own.type === "article" ? own.label : (container ? container.label : own.label),
  };
}

function compiledKind(addr) {
  const tail = String(addr).split(".").slice(-1)[0];
  if (addr.endsWith(".heading")) return "heading";
  if (SLOT_REGLAGES[tail]) return "reglage";
  if (addr.endsWith(".place")) return "signature";
  if (/\.items\.\d+$/.test(addr)) return "list";
  if (/\.rows?\./.test(addr)) return "table";
  return "";
}

function slotLabelOf(entry, addr) {
  const label = SLOT_LABEL[entry.type];
  if (!label) return "";
  if (addr === entry.path) return label;
  const rest = addr.slice(entry.path.length + 1);
  const m = rest.match(/items\.(\d+)/);
  if (m) return `${label} n°${Number(m[1]) + 1}`;
  const r = rest.match(/rows\.(\d+)\.(\d+)/);
  if (r) return `Cellule ligne ${Number(r[1]) + 1}, colonne ${Number(r[2]) + 1}`;
  const c = rest.match(/columns\.(\d+)/);
  if (c) return `Colonne ${Number(c[1]) + 1}`;
  if (rest === "caption") return "Légende du tableau";
  if (rest === "heading") return "Intitulé";
  if (SLOT_REGLAGES[rest]) return SLOT_REGLAGES[rest];
  return label;
}
