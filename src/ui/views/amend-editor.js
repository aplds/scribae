// ============================================================================
// L'acte éditable en place (écran « Modifier un acte »).
//
// Le document n'est pas un aperçu : c'est la matière. Le rédacteur réécrit
// directement les articles, abroge, insère — comme dans un traitement de texte.
// Chaque passage éditable porte une adresse stable (voir lib/amend-edit.js) ;
// la saisie est relevée au fil de la frappe et conservée dans la session, si
// bien que la page peut être reconstruite sans rien perdre.
//
// La STRUCTURE se travaille aussi : un paragraphe s'ajoute sous celui qu'on
// vient de lire (ou en fin d'article), une ligne de liste s'ajoute et se retire
// au fil de l'énumération, une ligne de tableau de même. Ces gestes passent par
// la même session (`session.layout`, `session.ajouts`) : rien n'est écrit dans
// l'acte d'origine avant la confirmation.
//
// Le préambule (intitulé, visas, considérants, mention d'exécution) et le bloc
// de signature ne sont pas éditables : ils appartiennent à l'acte d'origine. Ce
// que la modification peut atteindre, ce sont les dispositions — le dispositif.
// ============================================================================
import { h, button } from "../dom.js";
import { renderNode } from "../../lib/render.js";
import { normalizeSpace } from "../../lib/util.js";
import {
  ADDR, editedText, blocksWithSlots, layoutOf, insertedFor, isRemoved, flatNodes,
} from "../../lib/amend-edit.js";

const norm = (s) => normalizeSpace(s).replace(/\s+/g, " ");

// ------------------------------------------------------------- un passage
function region(session, addr, baseText, tag = "div", cls = "") {
  const el = h(tag, {
    class: ("amend-region " + cls).trim(),
    contenteditable: "true",
    spellcheck: "true",
    "data-addr": addr,
    title: "Réécrivez librement : votre texte remplacera celui de l'acte d'origine.",
  });
  el.textContent = editedText(session, addr, baseText ?? "");
  el.addEventListener("input", () => commit(el, session, baseText));
  el.addEventListener("blur", () => { commit(el, session, baseText); session.action("refresh"); });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") { el.textContent = editedText(session, addr, baseText ?? ""); mark(el, session, baseText); el.blur(); }
  });
  el.addEventListener("paste", (e) => {
    // Collage en texte brut : une modification d'acte ne doit pas hériter de la
    // mise en forme d'un traitement de texte externe.
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text.replace(/\s+/g, " "));
  });
  mark(el, session, baseText);
  return el;
}

function commit(el, session, baseText) {
  const addr = el.dataset.addr;
  const text = el.textContent;
  if (norm(text) === norm(baseText)) delete session.edits[addr];
  else session.edits[addr] = text;
  mark(el, session, baseText);
  session.action("edited");
}

function mark(el, session, baseText) {
  const cur = session.edits[el.dataset.addr];
  el.classList.toggle("amend-region--changed", cur !== undefined && norm(cur) !== norm(baseText));
}

// --------------------------------------------------------------- outils
// Un outil ne prend jamais le focus du document : il est en dehors de la zone
// éditable (`contenteditable="false"`), sinon le curseur sauterait au clic.
const tool = (label, title, onClick, cls = "") =>
  h("button", { class: ("amend-tool " + cls).trim(), type: "button", title, contenteditable: "false", onClick }, label);

function blockBar(...kids) {
  return h("div", { class: "amend-blockbar", contenteditable: "false" }, ...kids);
}

// --------------------------------------------------------------- l'éditeur
export function buildEditableDocument(doc, config, session) {
  const art = h("article", { class: "doc doc--amend" });
  // Le rang d'un nœud dans le corps, divisions comprises : c'est l'échelle des
  // adresses de saisie (`n3`), celle que lit `deriveAmendments`. Les deux
  // parcours doivent donc désigner les nœuds de la même façon.
  const rang = new Map(flatNodes(doc).map((n, i) => [n, i]));
  let flushedEnd = false;
  const flushEnd = () => {
    if (flushedEnd) return;
    flushedEnd = true;
    for (const ins of insertedFor(session, null, "end")) art.appendChild(insertedArticle(ins, session));
    art.appendChild(appendBar(session));
  };

  // Une DIVISION (Livre, Titre, Chapitre…) : son intitulé, puis son contenu.
  // Ses articles sont éditables comme ceux du corps — sans quoi un règlement
  // rangé en Titres et Chapitres ne serait pas modifiable article par article.
  const divisionBlock = (node) => {
    const niveau = Math.max(1, Number(node.level) || 1);
    const sec = h("section", { class: `doc-division doc-division--n${niveau} amend-division`, "data-eid": node.eId || "" });
    const tag = ["h2", "h3", "h4", "h5"][Math.min(niveau, 4) - 1];
    const head = h(tag, { class: "doc-division-head" });
    head.appendChild(h("span", { class: "doc-division-num", text: node.numLabel || node.levelLabel || "" }));
    if (node.heading) {
      head.appendChild(h("span", { class: "doc-division-heading", text: (node.numLabel || node.levelLabel ? " – " : "") + node.heading }));
    }
    sec.appendChild(head);
    rendre(node.blocks || [], sec);
    return sec;
  };

  const rendre = (nodes, container) => {
    (nodes || []).forEach((node) => {
      const i = rang.get(node);
      if (node.type === "article" && i !== undefined) {
        for (const ins of insertedFor(session, node.eId, "before")) container.appendChild(insertedArticle(ins, session));
        container.appendChild(article(node, i, session, config));
        for (const ins of insertedFor(session, node.eId, "after")) container.appendChild(insertedArticle(ins, session));
        return;
      }
      if (node.type === "division") { container.appendChild(divisionBlock(node)); return; }
      if (node.type === "signature" || node.type === "mention") flushEnd();
      container.appendChild(renderNode(node, config, {}));
    });
  };

  rendre(doc.nodes, art);
  flushEnd();
  return art;
}

// ---------------------------------------------------------------- un article
function article(node, i, session, config) {
  const key = node.eId || node.path || node.id;
  const removed = isRemoved(session, key);
  const sec = h("section", {
    class: "doc-article amend-article amend-article--base" + (removed ? " amend-article--removed" : ""),
    "data-eid": key,
  });
  const head = h("h2", { class: "doc-article-head" });
  head.appendChild(h("span", { class: "doc-article-num", text: session.renumerote?.[key]
    ? (config?.vocab?.articleLabel || "Article") + " " + session.renumerote[key]
    : (node.numLabel || "") }));
  head.appendChild(numberTool(node, key, session, config));
  if (node.heading) {
    head.appendChild(document.createTextNode(" – "));
    head.appendChild(region(session, ADDR.heading(i), node.heading, "span", "amend-region--inline"));
  }
  head.appendChild(articleTools(node, i, key, removed, session));
  sec.appendChild(head);

  const entries = blocksWithSlots(node, i, session);
  const slots = entries.map((e) => e.slot);
  const count = (node.blocks || []).length;
  const containerAddr = `n${i}`;
  entries.forEach((entry, idx) => {
    const j = entry.slot.startsWith("a") ? null : Number(entry.slot.slice(1));
    const addr = entry.slot.startsWith("a") ? `${containerAddr}.${entry.slot}` : ADDR.block(i, j);
    sec.appendChild(block(entry.block, {
      i, j, slot: entry.slot, addr, container: containerAddr, count,
      prev: idx > 0 ? slots[idx - 1] : "", removed,
    }, session));
  });
  if (removed) {
    sec.appendChild(h("p", { class: "amend-removed-note", contenteditable: "false" },
      "Article abrogé par la modification en cours. ",
      button("Rétablir", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => session.action("restore", { key }) })));
  }
  return sec;
}

// Le numéro de l'article, et sa réattribution. Le numéro doit être LIBRE : on
// refuse un numéro déjà porté par un autre article du texte en vigueur.
function numberTool(node, key, session, config) {
  return h("button", {
    class: "amend-num", type: "button", contenteditable: "false",
    title: "Réattribuer un numéro à cet article — le numéro doit être libre",
    onClick: () => session.action("renumber", { key, node }),
  }, "n°");
}

function articleTools(node, i, key, removed, session) {
  return h("span", { class: "amend-tools", contenteditable: "false" },
    tool("+ §", "Ajouter un paragraphe à la fin de cet article", () => session.action("addBlock", { container: `n${i}`, count: (node.blocks || []).length, after: null, type: "para" })),
    h("button", {
      class: "amend-tool", type: "button", title: removed ? "Rétablir cet article" : "Abroger cet article",
      onClick: () => session.action(removed ? "restore" : "abrogate", { key }),
    }, removed ? "rétablir" : "abroger"),
    h("button", {
      class: "amend-tool", type: "button", title: "Insérer un nouvel article après celui-ci",
      onClick: () => session.action("insert", { node, position: "after" }),
    }, "+ article après"),
  );
}

// ------------------------------------------------------------------- blocs
// Chaque bloc est suivi (ou porte) ses outils : ajouter un paragraphe après,
// retirer le bloc ; et, pour une liste ou un tableau, ajouter une ligne et
// retirer celle qu'on désigne.
function block(b, info, session) {
  const { i, j, slot, addr, container, count, prev, removed } = info;
  const addAfter = (type) => session.action("addBlock", { container, count, after: slot, type });
  const dropBlock = () => session.action("dropBlock", { container, count, slot, addr });

  if (b.type === "list") {
    const list = h(b.ordered ? "ol" : "ul", { class: "doc-list amend-block" });
    const slots = layoutOf(session, addr, (b.items || []).length);
    (b.items || []).forEach((it, k) => {
      const islot = slots[k];
      const lineAddr = islot && islot.startsWith("a")
        ? `${addr}.${islot}`
        : ADDR.item(i, j, islot ? Number(islot.slice(1)) : k);
      const li = h("li", {}, region(session, lineAddr, it.text, "span", "amend-region--inline"));
      if (!removed && islot) {
        li.appendChild(h("span", { class: "amend-line__tools", contenteditable: "false" },
          tool("+", "Ajouter une ligne après celle-ci", () => session.action("addLine", { container: addr, count: (b.items || []).length, after: islot, kind: "item" })),
          tool("✕", "Retirer cette ligne", () => session.action("dropLine", { container: addr, count: (b.items || []).length, slot: islot, addr: lineAddr }))));
      }
      list.appendChild(li);
    });
    const wrap = h("div", { class: "amend-blockgroup" }, list);
    if (!removed) {
      wrap.appendChild(blockBar(
        tool("+ ligne", "Ajouter une ligne à la fin de la liste", () => session.action("addLine", { container: addr, count: (b.items || []).length, after: null, kind: "item" })),
        tool("+ §", "Ajouter un paragraphe après cette liste", () => addAfter("para")),
        tool("✕ bloc", "Retirer toute la liste", dropBlock),
      ));
    }
    return wrap;
  }

  if (b.type === "table") {
    const wrap = h("div", { class: "doc-table-wrap amend-block" });
    if (b.caption) wrap.appendChild(h("p", { class: "doc-table-caption" }, region(session, ADDR.caption(i, j), b.caption, "span", "amend-region--inline")));
    const t = h("table", { class: "doc-table" });
    const trh = h("tr");
    (b.columns || []).forEach((c) => trh.appendChild(h("th", { text: c })));
    trh.appendChild(h("th", { class: "amend-th__tools", "aria-label": "Ajouter une ligne" }));
    t.appendChild(h("thead", {}, trh));
    const tb = h("tbody");
    const slots = layoutOf(session, addr, (b.rows || []).length);
    (b.rows || []).forEach((r, ri) => {
      const rslot = slots[ri];
      const tr = h("tr");
      (b.columns || []).forEach((_, ci) => {
        const cellAddr = rslot && rslot.startsWith("a")
          ? `${addr}.${rslot}.${ci}`
          : ADDR.cell(i, j, rslot ? Number(rslot.slice(1)) : ri, ci);
        tr.appendChild(h("td", {}, region(session, cellAddr, r[ci] ?? "", "span", "amend-region--inline")));
      });
      const tdTools = h("td", { class: "amend-td__tools", contenteditable: "false" });
      if (!removed && rslot) {
        tdTools.appendChild(tool("+", "Ajouter une ligne après celle-ci", () => session.action("addLine", { container: addr, count: (b.rows || []).length, after: rslot, kind: "row" })));
        tdTools.appendChild(tool("✕", "Retirer cette ligne", () => session.action("dropLine", { container: addr, count: (b.rows || []).length, slot: rslot })));
      }
      tr.appendChild(tdTools);
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    if (!removed) {
      wrap.appendChild(blockBar(
        tool("+ ligne", "Ajouter une ligne à la fin du tableau", () => session.action("addLine", { container: addr, count: (b.rows || []).length, after: null, kind: "row" })),
        tool("+ §", "Ajouter un paragraphe après ce tableau", () => addAfter("para")),
        tool("✕ bloc", "Retirer tout le tableau", dropBlock),
      ));
    }
    return wrap;
  }

  const p = h("p", { class: "doc-p amend-block" }, region(session, addr, b.text, "span", "amend-region--inline"));
  if (!removed) {
    p.appendChild(h("span", { class: "amend-block__tools", contenteditable: "false" },
      tool("+ §", "Ajouter un paragraphe après celui-ci", () => addAfter("para")),
      tool("✕", "Retirer ce paragraphe", dropBlock)));
  }
  return p;
}

// ------------------------------------------------------- nouveau article
function insertedArticle(ins, session) {
  const sec = h("section", { class: "doc-article amend-article amend-article--inserted" });
  const head = h("h2", { class: "doc-article-head" },
    h("span", { class: "doc-article-num", text: "Article à insérer" }),
    document.createTextNode(" – "),
    region(session, ADDR.insHeading(ins.id), ins.heading || "", "span", "amend-region--inline"),
  );
  sec.appendChild(head);
  (ins.blocks || []).forEach((b, j) => {
    sec.appendChild(h("p", { class: "doc-p amend-ins__block" },
      region(session, ADDR.insBlock(ins.id, j), b.text || "", "span", "amend-region--inline"),
      h("span", { class: "amend-ins__tools", contenteditable: "false" },
        (ins.blocks || []).length > 1
          ? button("", { variant: "tertiary", size: "sm", icon: "trash", title: "Retirer ce paragraphe", onClick: () => session.action("removePara", { ins, index: j }) })
          : null)));
  });
  sec.appendChild(h("div", { class: "amend-ins__actions", contenteditable: "false" },
    button("Ajouter un paragraphe", { variant: "tertiary", size: "sm", icon: "plus", onClick: () => session.action("addPara", { ins }) }),
    button("Retirer cet article", { variant: "tertiary", size: "sm", icon: "trash", onClick: () => session.action("removeInserted", { ins }) }),
  ));
  return sec;
}

function appendBar(session) {
  return h("div", { class: "amend-append", contenteditable: "false" },
    button("Ajouter un article à la fin du dispositif", { variant: "secondary", size: "sm", icon: "plus", onClick: () => session.action("insert", { position: "end" }) }),
  );
}
