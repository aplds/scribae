import { formatDate } from "./util.js";
import { amendmentMentions, amendmentMention } from "./amend.js";
import { styleForDoc, paperPadding } from "./styles.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

export function personName(p) {
  if (!p) return "";
  return [p.civility, p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

export function personRole(p, config) {
  const id = p?.roles?.[0];
  return (config.roles || []).find((r) => r.id === id)?.label || p?.fonction || "";
}

// Marques de modification (ajout / suppression) utilisées par la version
// consolidée. `ins` et `del` sont des éléments HTML standard : ils restent
// lisibles à l'impression et dans le HTML exporté.
const CHANGE = {
  ins: { tag: "ins", cls: "doc-ins", label: "Ajout" },
  del: { tag: "del", cls: "doc-del", label: "Suppression" },
  mod: { tag: "div", cls: "doc-mod", label: "Article modifié" },
};

function decorate(node, element, opts = {}) {
  let out = element;
  if (node.quoted) {
    const q = el("div", "doc-quote");
    q.appendChild(element);
    out = q;
  }
  const ch = node.change;
  if (opts.tracking && ch && ch.kind && CHANGE[ch.kind]) {
    const c = CHANGE[ch.kind];
    const who = [ch.designation, ch.by].filter(Boolean).join(" ");
    const w = el(c.tag, c.cls);
    w.title = [c.label, who ? "par " + who : "", ch.date ? "le " + formatDate(ch.date) : ""].filter(Boolean).join(" ");
    w.setAttribute("data-change", ch.kind);
    if (ch.by) w.setAttribute("data-by", ch.by);
    w.appendChild(out);
    out = w;
  }
  return out;
}

// Le suivi des modifications est une OPTION d'affichage de la version
// consolidée : désactivée par défaut, elle montre les ajouts et les suppressions
// apparents et le tableau des modifications en fin de document. Quand elle est
// désactivée, le document est le seul texte en vigueur, et chaque article touché
// porte sous son intitulé la mention en italique de l'acte qui l'a modifié.
// À défaut d'indication de l'appelant, c'est le document qui décide — de sorte
// que l'aperçu, les exports et la version en ligne publiée montrent la même
// chose.
export function renderDocument(doc, config, opts = {}) {
  const tracking = opts.showChanges != null
    ? !!opts.showChanges
    : doc?.meta?.consolidated?.showChanges === true;
  const o = { ...opts, tracking };
  // La charte graphique du document : désignée par la trame, sinon déduite de
  // l'entité puis de la famille (voir src/lib/styles.js). Elle habille le
  // document — en-tête, pied, polices, filets — sans toucher à son contenu.
  const style = opts.style || styleForDoc(config, doc);
  const root = el("article", "doc" + (opts.compact ? " doc--compact" : ""));
  if (style?.id) root.dataset.sheet = style.id;
  if (opts.arial) root.style.fontFamily = style?.fontFamily || config.brand.documentFont || "";
  if (style?.showHeader) root.appendChild(documentSheetHeader(style, doc, config));
  if (doc?.kind === "consolide" && opts.consolidation !== false) root.appendChild(consolidationBanner(doc, o));
  o.mentions = tracking ? null : amendmentMentions(doc, config);
  for (const node of doc?.nodes || []) root.appendChild(renderNode(node, config, o));
  if (opts.showNotes && doc?.notes?.length) root.appendChild(notesAppendix(doc, config));
  if (tracking && doc?.trail?.length && opts.showTrail !== false) root.appendChild(trailAppendix(doc, config));
  if (style?.showFooter) root.appendChild(documentSheetFooter(style, doc, config));
  return root;
}

// ------------------------------------------------ en-tête et pied de la charte
// L'en-tête et le pied d'une feuille de style sont de la présentation, pas du
// contenu : ils sont donc ajoutés au document au moment du rendu, à partir des
// valeurs de la feuille. Leur texte accepte quelques jetons ({{entity.name}},
// {{numero}}, {{dateSignature}}…), résolus ici sur les métadonnées de l'acte.
function sheetContext(doc, config, style) {
  const m = doc?.meta || {};
  const ent = m.entity || {};
  const org = m.org || ent;
  return {
    "entity.name": ent.name || "",
    "entity.nameWithArt": ent.nameWithArt || ent.name || "",
    "entity.code": ent.code || "",
    "org.name": org.name || "",
    "brand.name": config?.brand?.name || "",
    "numero": m.numero || "",
    "objet": m.objet || "",
    "dateSignature": m.dateSignature ? formatDate(m.dateSignature, "date-long") : "",
    "date": formatDate(new Date().toISOString().slice(0, 10), "date-long"),
    "actType": (config?.actTypes || []).find((t) => t.id === m.actTypeId)?.label || "",
    "style.label": style?.label || "",
  };
}

export function renderSheetText(text, doc, config, style) {
  const ctx = sheetContext(doc, config, style);
  return String(text || "").replace(/\{\{\s*([\w.]+)\s*\}\}/g, (raw, key) => (key in ctx ? ctx[key] : raw)).trim();
}

export function documentSheetHeader(style, doc, config) {
  const box = el("div", "doc-sheet-header");
  box.setAttribute("data-align", style.logoAlign || "left");
  if (style.logoUrl) {
    const img = el("img", "doc-sheet-logo");
    img.src = style.logoUrl;
    img.alt = "";
    box.appendChild(img);
  }
  const text = renderSheetText(style.headerText, doc, config, style);
  if (text) box.appendChild(el("p", "doc-sheet-headtext", text));
  return box;
}

export function documentSheetFooter(style, doc, config) {
  const text = renderSheetText(style.footerText, doc, config, style);
  return el("p", "doc-sheet-footer", text);
}

// Le papier d'un aperçu : dans l'application, la feuille A4 est un bloc HTML, et
// ses marges ne peuvent pas venir de `@page` (plusieurs papiers cohabitent dans
// une même page). Elles sont posées ici, sur le papier lui-même, sous forme de
// variable CSS — la même valeur que celle des documents exportés, pour que
// l'aperçu et le PDF se superposent au millimètre.
//   paperEl : le bloc `.paper` (voir app.css) ; `doc` : le document affiché ;
//   `opts.style` : la feuille déjà résolue, si l'appelant la connaît.
export function applyPaper(paperEl, doc, config, opts = {}) {
  const style = opts.style || styleForDoc(config, doc);
  if (paperEl) {
    if (style?.id) paperEl.dataset.sheet = style.id;
    paperEl.style.setProperty("--paper-pad", paperPadding(style));
  }
  return style;
}

function consolidationBanner(doc, opts = {}) {
  const box = el("div", "doc-consolidation");
  box.appendChild(el("p", "doc-consolidation__title", "Version consolidée"));
  if (doc.consolidationNotice) box.appendChild(el("p", "doc-consolidation__notice", doc.consolidationNotice));
  const c = doc.meta?.consolidated;
  if (c) {
    const n = (doc.trail || []).length;
    box.appendChild(el("p", "doc-consolidation__meta",
      `Mise à jour du ${formatDate(String(c.at || "").slice(0, 10), "date-long")} — ${c.count} modification(s) apportée(s) par ${n} acte(s) modificatif(s).`));
  }
  if (opts.tracking) {
    const legend = el("p", "doc-consolidation__legend");
    legend.appendChild(el("span", "doc-ins", "texte ajouté"));
    legend.appendChild(el("span", "doc-del", "texte supprimé"));
    box.appendChild(legend);
  } else {
    box.appendChild(el("p", "doc-consolidation__hint",
      "Le texte est présenté dans sa rédaction en vigueur. Chaque article modifié porte, sous son intitulé, la mention de l'acte qui l'a modifié."));
  }
  return box;
}

export function renderNode(node, config, opts = {}) {
  const cls = (c) => "doc-" + c;
  let element;
  switch (node.type) {
    case "title":
      element = el("h1", cls("title"), node.text);
      break;
    case "authority":
      element = el("p", cls("authority"), node.text);
      break;
    case "visas": {
      const ul = el("ul", cls("visas"));
      for (const it of node.items || []) {
        const li = el("li");
        // L'étiquette (« Vu », « Vu le »…) est isolée dans son propre élément :
        // la charte peut ainsi l'italiser, la graisser ou la mettre en petites
        // capitales sans toucher au texte de la référence elle-même.
        li.appendChild(el("span", "doc-visas-label", [(config.vocab.visasLabel || "Vu"), " "].join("")));
        li.appendChild(document.createTextNode(it.text));
        ul.appendChild(li);
      }
      element = ul;
      break;
    }
    case "considerants": {
      const box = el("div", cls("recitals"));
      for (const it of node.items || []) box.appendChild(el("p", null, it.text));
      element = box;
      break;
    }
    case "enact":
      element = el("p", cls("enact"), node.text);
      break;
    case "article": {
      const sec = el("section", cls("article"));
      if (node.path && opts.showPaths) sec.dataset.path = node.path;
      if (node.eId) sec.dataset.eid = node.eId;
      const head = el("h2", cls("article-head"));
      head.appendChild(el("span", cls("article-num"), node.numLabel));
      if (node.heading) head.appendChild(el("span", cls("article-heading"), " – " + node.heading));
      sec.appendChild(head);
      const abrogated = node.change?.action === "abrogate";
      if (!opts.tracking) {
        // Sans le suivi des modifications : la mention de l'acte modificatif
        // sous l'intitulé, et le seul texte en vigueur.
        const mention = amendmentMention(node, opts.mentions, config);
        if (mention) sec.appendChild(el("p", "doc-amend-mention", mention));
      }
      // Un article abrogé n'a plus de rédaction en vigueur : seule sa mention
      // subsiste (l'intitulé continue d'exister, pour la numérotation).
      if (!(abrogated && !opts.tracking)) {
        for (const b of node.blocks || []) {
          if (!opts.tracking && b.change?.kind === "del") continue;
          sec.appendChild(renderNode(b, config, opts));
        }
      }
      element = sec;
      break;
    }
    case "para":
    case "raw":
      element = el("p", cls("p"), node.text);
      break;
    case "list": {
      const list = el(node.ordered ? "ol" : "ul", cls("list"));
      if (node.path && opts.showPaths) list.dataset.path = node.path;
      for (const it of node.items || []) list.appendChild(el("li", null, it.text));
      element = list;
      break;
    }
    case "table": {
      const wrap = el("div", cls("table-wrap"));
      if (node.caption) wrap.appendChild(el("p", cls("table-caption"), node.caption));
      const t = el("table", cls("table"));
      const thead = el("thead");
      const trh = el("tr");
      for (const c of node.columns || []) trh.appendChild(el("th", null, c));
      thead.appendChild(trh);
      t.appendChild(thead);
      const tb = el("tbody");
      for (const r of node.rows || []) {
        const tr = el("tr");
        for (let i = 0; i < (node.columns || []).length; i++) tr.appendChild(el("td", null, r[i] ?? ""));
        tb.appendChild(tr);
      }
      t.appendChild(tb);
      wrap.appendChild(t);
      element = wrap;
      break;
    }
    case "signature": {
      const box = el("div", cls("signature"));
      box.appendChild(el("p", cls("signature-place"), `Fait à ${node.place}, le ${node.date}`));
      const right = el("div", cls("signature-block"));
      if (node.signataire) {
        if (node.showFunction !== false && config.vocab) {
          right.appendChild(el("p", cls("signature-role"), personRole(node.signataire, config)));
        }
        right.appendChild(el("p", cls("signature-name"), personName(node.signataire)));
      }
      box.appendChild(right);
      element = box;
      break;
    }
    case "mention":
      element = el("p", cls("mention mention--" + (node.kind || "info")), node.text);
      break;
    default:
      element = el("p", cls("p"), node.text || "");
  }
  return decorate(node, element, opts);
}

function notesAppendix(doc, config) {
  const box = el("section", "doc-notes");
  box.appendChild(el("h3", "doc-notes__title", "Notes de préparation (non publiées)"));
  const ul = el("ul", "doc-notes__list");
  for (const n of doc.notes || []) {
    const li = el("li", "doc-notes__item");
    li.appendChild(el("span", "doc-notes__kind", n.kind));
    li.appendChild(el("span", "doc-notes__text", n.text));
    if (n.author) li.appendChild(el("span", "doc-notes__author", "— " + n.author + (n.date ? ", " + n.date : "")));
    ul.appendChild(li);
  }
  box.appendChild(ul);
  return box;
}

// Tableau des modifications : c'est la « trace » exigée pour la version
// consolidée. Une entrée par acte modificatif, dans l'ordre chronologique.
function trailAppendix(doc, config) {
  const v = config?.vocab?.amendment || {};
  const box = el("section", "doc-trail");
  box.appendChild(el("h3", "doc-trail__title", doc.trailTitle || v.trailTitle || "Tableau des modifications"));
  for (const entry of doc.trail || []) {
    const head = el("p", "doc-trail__entry");
    head.textContent = `${entry.designation || "Acte"} n° ${entry.numero || "—"} du ${formatDate(entry.date, "date-long")}`;
    box.appendChild(head);
    const t = el("table", "doc-table doc-trail__table");
    const thead = el("thead");
    const trh = el("tr");
    for (const h of (v.trailHead || ["Article", "Modification", "Rédaction"])) trh.appendChild(el("th", null, h));
    thead.appendChild(trh);
    t.appendChild(thead);
    const tb = el("tbody");
    for (const it of entry.items || []) {
      const tr = el("tr");
      tr.appendChild(el("td", null, it.article || (it.newNum ? "Article " + it.newNum : "—")));
      tr.appendChild(el("td", null, it.actionLabel || it.action));
      tr.appendChild(el("td", null, it.detail || ""));
      tb.appendChild(tr);
    }
    t.appendChild(tb);
    box.appendChild(t);
  }
  return box;
}

export function documentToHtml(doc, config, opts = {}) {
  const node = renderDocument(doc, config, { ...opts, showNotes: false });
  return node.outerHTML;
}

export function documentToText(doc, config) {
  const node = renderDocument(doc, config, {});
  return (node.innerText || node.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
}
