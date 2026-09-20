// ============================================================================
// Akoma Ntoso — LECTURE.
//
// L'écriture se trouve dans export.js (exportAkn) ; ce module fait le chemin
// inverse : XML Akoma Ntoso → modèle interne de document.
//
// Règle : la lecture est TOLÉRANTE. Un acte produit par un autre outil reste
// importable ; les éléments non reconnus sont ignorés, jamais inventés, et
// l'application signale ce qu'elle n'a pas su reprendre. Les métadonnées
// propres à l'application (`<ia:preparation>`, `<ia:modification>`,
// `<ia:consolidation>`) permettent, elles, un aller-retour sans perte.
// ============================================================================
import { uid } from "./util.js";

export const AKN_NS = "http://docs.oasis-open.org/legaldocml/ns/akn/3.0";

// ------------------------------------------------------------ accès DOM (sans
// se soucier des préfixes d'espace de noms : on compare les noms locaux).
const isEl = (n) => !!n && n.nodeType === 1;
const kids = (el, name) => [...((el && el.children) || [])].filter((c) => !name || c.localName === name);
const kid = (el, name) => kids(el, name)[0] || null;
const all = (el, name) => (el && el.getElementsByTagNameNS ? [...el.getElementsByTagNameNS("*", name)] : []);
const desc = (el, name) => all(el, name)[0] || null;
const txt = (el) => (el ? String(el.textContent || "").replace(/\s+/g, " ").trim() : "");
const attr = (el, name) => (el && el.getAttribute ? el.getAttribute(name) || "" : "");

export const isAknXml = (text) => /<akomaNtoso[\s>]/i.test(String(text || ""));

// --------------------------------------------------------------- point d'entrée
export function parseAkn(text) {
  const dom = new DOMParser().parseFromString(String(text), "application/xml");
  const perr = dom.querySelector("parsererror");
  if (perr) throw new Error("Fichier XML illisible : " + txt(perr).slice(0, 160));
  const rootEl = dom.documentElement;
  if (!rootEl || rootEl.localName !== "akomaNtoso") {
    throw new Error("Ce fichier n'est pas un document Akoma Ntoso (élément racine « akomaNtoso » attendu).");
  }
  const act = desc(rootEl, "act") || desc(rootEl, "doc") || desc(rootEl, "amendment") || rootEl;
  const meta = readMeta(act);
  const nodes = readStructure(act, meta);
  const trail = readTrail(act);
  if (trail.length) {
    meta.consolidated = meta.consolidated || { at: "", count: 0 };
    meta.consolidated.count = trail.reduce((n, t) => n + (t.items || []).length, 0);
  }
  const warnings = [];
  if (!meta.numero) warnings.push("Numéro de l'acte absent du fichier.");
  if (!meta.dateSignature) warnings.push("Date de signature absente du fichier.");
  if (!nodes.some((n) => n.type === "article")) warnings.push("Aucun article n'a été trouvé dans le corps du document.");
  if (trail.length) warnings.push("Ce fichier est une version consolidée : les modifications déjà intégrées sont reprises dans la chaîne des actes.");
  return {
    kind: trail.length ? "consolide" : "original",
    imported: "akn",
    meta,
    nodes,
    notes: readNotes(act),
    trail,
    issues: [],
    missing: [],
    warnings,
  };
}

// Trace des modifications déjà intégrées (tableau des modifications).
function readTrail(act) {
  const box = desc(kid(act, "meta"), "consolidation");
  if (!box) return [];
  const out = [];
  for (const m of all(box, "acteModificatif")) {
    out.push({
      numero: attr(m, "numero"),
      date: attr(m, "date"),
      eli: attr(m, "eli"),
      designation: attr(m, "designation"),
      items: all(m, "item").map((it) => ({
        article: attr(it, "article"),
        action: attr(it, "action"),
        actionLabel: "",
        targetEId: attr(it, "cible"),
        newEId: attr(it, "nouveauEId"),
        newNum: attr(it, "nouveau"),
        detail: attr(it, "redaction"),
      })),
    });
  }
  return out;
}

// ------------------------------------------------------------------- métadonnées
function readMeta(act) {
  const metaEl = kid(act, "meta");
  const prep = desc(metaEl, "preparation");
  const g = (n) => txt(kid(prep, n));
  const work = desc(metaEl, "FRBRWork");
  const expr = desc(metaEl, "FRBRExpression");
  const frbrDate = (el, name) => {
    const d = kids(el, "FRBRdate").find((x) => attr(x, "name") === name);
    return attr(d, "date");
  };
  const entEl = kid(prep, "entite");
  const tr = kid(prep, "trame");
  const eli = g("eli") || attr(kid(work, "FRBRthis"), "value");
  const dateSignature = g("dateSignature") || frbrDate(work, "document") || frbrDate(expr, "signature");
  const title = readTitle(act);
  return {
    numero: g("numero") || txt(kid(work, "FRBRnumber")),
    objet: g("objet"),
    dateSignature,
    dateEffet: g("dateEffet"),
    statut: g("statut") || "publie",
    eli,
    trameId: attr(tr, "id"),
    trameName: "",
    trameVersion: attr(tr, "version"),
    actTypeId: attr(act, "name") || "acte",
    designation: guessDesignation(title),
    entity: {
      id: "",
      code: attr(entEl, "code"),
      name: txt(entEl),
      nameWithArt: txt(entEl),
      seatCity: "",
    },
    signataire: null,
    generatedAt: new Date().toISOString(),
    importedAt: new Date().toISOString(),
  };
}

function readTitle(act) {
  const preface = kid(act, "preface");
  const ps = kids(preface, "p").map(txt).filter(Boolean);
  if (ps.length) return ps.join(" ");
  return txt(desc(act, "FRBRtitle")) || txt(kid(desc(act, "FRBRWork"), "FRBRtitle"));
}

// « Décision n°2026-114-IA du 13 mai 2026 portant … » → « Décision »
function guessDesignation(title) {
  const m = String(title || "").match(/^([A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'-]{2,20})\s+(?:n°|no|numéro)/i);
  if (m) return m[1].charAt(0).toUpperCase() + m[1].slice(1);
  return "";
}

// ------------------------------------------------------------------- structure
function readStructure(act, meta) {
  const nodes = [];
  const title = readTitle(act);
  if (title) nodes.push(node("title", { text: title, eId: "title_1" }));

  const place = readPlace(act);

  const preamble = kid(act, "preamble");
  if (preamble) {
    const formulas = kids(preamble, "formula");
    const fBy = (name) => formulas.find((f) => attr(f, "name") === name);
    const authority = fBy("authority");
    if (authority) nodes.push(node("authority", { text: kids(authority, "p").map(txt).filter(Boolean).join(" "), eId: "frm_authority" }));

    const visas = fBy("visas");
    if (visas) {
      const items = kids(visas, "p").map(txt).filter(Boolean)
        .map((t) => ({ id: uid("it"), refId: "", text: stripVisaPrefix(t), when: "" }));
      if (items.length) nodes.push(node("visas", { items, eId: "frm_visas" }));
    }

    const rec = kid(preamble, "recitals");
    if (rec) {
      const parts = [...kids(kid(rec, "intro"), "p"), ...kids(rec, "p")].map(txt).filter(Boolean);
      if (parts.length) nodes.push(node("considerants", { items: parts.map((t) => ({ id: uid("it"), text: t, when: "" })), eId: "recitals_1" }));
    }

    const enact = fBy("enacting");
    if (enact) nodes.push(node("enact", { text: kids(enact, "p").map(txt).filter(Boolean).join(" "), eId: "frm_enacting" }));
  }

  const bodyEl = kid(act, "body");
  let idx = 0;
  for (const art of kids(bodyEl, "article")) {
    idx++;
    nodes.push(readArticle(art, idx));
  }

  const concl = kid(act, "conclusions");
  if (concl) {
    const mentions = [];
    for (const pEl of kids(concl, "p")) {
      const t = txt(pEl);
      if (!t) continue;
      const m = t.match(/^Fait à (.+?),\s*le (.+)$/i);
      if (m) { place.raw = m[1]; place.date = m[2]; continue; }
      mentions.push(node("mention", { text: t, kind: /recours/i.test(t) ? "recours" : "publication", eId: uid("men") }));
    }
    const sig = kids(concl, "block").find((b) => attr(b, "name") === "signature");
    const sigPs = kids(sig, "p").map(txt).filter(Boolean);
    const signataire = sigPs.length
      ? { civility: "", firstName: "", lastName: sigPs[sigPs.length - 1], fonction: sigPs.length > 1 ? sigPs[0] : "", roles: [] }
      : null;
    if (sig || place.date) {
      nodes.push(node("signature", { place: place.raw, date: place.date, signataire, showFunction: true, eId: "sig_1" }));
    }
    nodes.push(...mentions);
  }
  return nodes;
}

function readPlace(act) {
  // « Fait à …, le … » se trouve dans les conclusions ; on le lit une fois pour
  // alimenter la signature et la ville de l'entité.
  for (const pEl of all(act, "p")) {
    const m = txt(pEl).match(/^Fait à (.+?),\s*le (.+)$/i);
    if (m) return { raw: m[1], date: m[2] };
  }
  return { raw: "", date: "" };
}

function stripVisaPrefix(text) {
  return String(text || "").replace(/^\s*(vu|considerant|considérant)\s*/i, "").replace(/^\s*/, "");
}

function readArticle(art, idx) {
  const eId = attr(art, "eId") || `art_${idx}`;
  const numLabel = txt(kid(art, "num")) || `Article ${idx}`;
  const heading = txt(kid(art, "heading"));
  const blocks = [];
  let bi = 0;
  const push = (container, change) => {
    for (const c of [...((container && container.childNodes) || [])]) {
      if (!isEl(c)) continue;
      const ln = c.localName;
      if (ln === "num" || ln === "heading" || ln === "eId" || ln === "authorialNote") continue;
      if (ln === "ins" || ln === "del") {
        push(c, { kind: ln, by: attr(c, "by") || "", date: attr(c, "date") || "" });
        continue;
      }
      if (ln === "p") { bi++; blocks.push(block("para", { text: txt(c), eId: `${eId}__p_${bi}`, change })); continue; }
      if (ln === "ul" || ln === "ol") {
        bi++;
        blocks.push(block("list", {
          ordered: ln === "ol",
          items: kids(c, "li").map((li) => ({ id: uid("it"), text: txt(li), when: "" })),
          eId: `${eId}__p_${bi}`, change,
        }));
        continue;
      }
      if (ln === "table") { bi++; blocks.push(block("table", { ...readTable(c), eId: `${eId}__p_${bi}`, change })); continue; }
      // conteneurs traversés sans être conservés
      if (["content", "paragraph", "block", "blockList", "tblock", "hcontainer", "subparagraph", "level", "crossHeading", "list", "intro", "wrapUp"].includes(ln)) {
        push(c, change);
        continue;
      }
      const t = txt(c);
      if (t) { bi++; blocks.push(block("para", { text: t, eId: `${eId}__p_${bi}`, change })); }
    }
  };
  push(art, null);
  return { id: uid("n"), type: "article", eId, numMode: "fixed", num: numLabel, numLabel, heading, blocks, when: "", notes: [] };
}

function readTable(t) {
  const cols = [...t.querySelectorAll("thead th")].map(txt);
  const rows = [...t.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map(txt));
  const caption = txt(kid(t, "caption"));
  return { caption, columns: cols.length ? cols : [""], rows };
}

function readNotes(act) {
  const out = [];
  for (const n of all(kid(act, "meta"), "note")) {
    out.push({
      id: uid("c"),
      kind: attr(n, "type") || "instruction",
      author: attr(n, "author"),
      date: attr(n, "date"),
      text: txt(kid(n, "p")) || txt(n),
      ruleId: "",
      path: attr(n, "data-target"),
    });
  }
  return out;
}

const node = (type, patch) => ({ id: uid("n"), type, when: "", notes: [], ...patch });
const block = (type, patch) => ({ id: uid("n"), type, when: "", notes: [], ...patch });

// ------------------------------------------------------------------- fichiers
// Accepte : un XML Akoma Ntoso, un document exporté par l'application
// ({ kind: "document", doc }), ou un document nu ({ meta, nodes }).
export function parseDocumentFile(text, filename = "") {
  const t = String(text || "").trim();
  if (!t) throw new Error("Fichier vide.");
  if (t.startsWith("{") || t.startsWith("[")) {
    let data;
    try { data = JSON.parse(t); } catch (e) { throw new Error("Fichier JSON illisible : " + e.message); }
    return normaliseDoc(data, filename);
  }
  if (isAknXml(t)) return parseAkn(t);
  throw new Error("Format non reconnu. Joignez un fichier Akoma Ntoso (.akn.xml / .xml) ou un document JSON exporté par l'application.");
}

function normaliseDoc(data, filename) {
  const candidates = [data, data && data.doc, data && data.document].filter(Boolean);
  for (const c of candidates) {
    if (Array.isArray(c.nodes) && c.meta) {
      return {
        kind: c.kind || "original",
        imported: "json",
        meta: { ...c.meta, importedAt: new Date().toISOString() },
        nodes: c.nodes,
        notes: c.notes || [],
        issues: [],
        missing: [],
        trail: c.trail || [],
        warnings: filename ? [`Document repris du fichier « ${filename} ».`] : [],
      };
    }
  }
  if (data && data.kind === "acte") {
    throw new Error("Ce fichier est un acte lié à une trame, pas un document autonome. Importez l'export Akoma Ntoso (.akn.xml) de cet acte.");
  }
  throw new Error("Ce fichier JSON ne contient pas de document (propriétés « meta » et « nodes » attendues).");
}
