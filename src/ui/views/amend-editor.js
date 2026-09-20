// ============================================================================
// L'acte éditable en place (écran « Modifier un acte »).
//
// Le document n'est pas un aperçu : c'est la matière. Le rédacteur réécrit
// directement les articles, abroge, insère — comme dans un traitement de texte.
// Chaque passage éditable porte une adresse stable (voir lib/amend-edit.js) ;
// la saisie est relevée au fil de la frappe et conservée dans la session, si
// bien que la page peut être reconstruite sans rien perdre.
//
// Le préambule (intitulé, visas, considérants, mention d'exécution) et le bloc
// de signature ne sont pas éditables : ils appartiennent à l'acte d'origine. Ce
// que la modification peut atteindre, ce sont les dispositions — le dispositif.
// ============================================================================
import { h, button } from "../dom.js";
import { renderNode } from "../../lib/render.js";
import { normalizeSpace } from "../../lib/util.js";
import { ADDR, editedText, editedBlocks, insertedFor, isRemoved } from "../../lib/amend-edit.js";

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

// --------------------------------------------------------------- l'éditeur
export function buildEditableDocument(doc, config, session) {
  const art = h("article", { class: "doc doc--amend" });
  let flushedEnd = false;
  const flushEnd = () => {
    if (flushedEnd) return;
    flushedEnd = true;
    for (const ins of insertedFor(session, null, "end")) art.appendChild(insertedArticle(ins, session));
    art.appendChild(appendBar(session));
  };

  doc.nodes.forEach((node, i) => {
    if (node.type === "article") {
      for (const ins of insertedFor(session, node.eId, "before")) art.appendChild(insertedArticle(ins, session));
      art.appendChild(article(node, i, session, config));
      for (const ins of insertedFor(session, node.eId, "after")) art.appendChild(insertedArticle(ins, session));
      return;
    }
    if (node.type === "signature" || node.type === "mention") flushEnd();
    art.appendChild(renderNode(node, config, {}));
  });
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
  head.appendChild(h("span", { class: "doc-article-num", text: node.numLabel || "" }));
  if (node.heading) {
    head.appendChild(document.createTextNode(" – "));
    head.appendChild(region(session, ADDR.heading(i), node.heading, "span", "amend-region--inline"));
  }
  head.appendChild(articleTools(node, i, key, removed, session));
  sec.appendChild(head);

  const edited = editedBlocks(node, i, session);
  edited.forEach((b, j) => sec.appendChild(block(b, i, j, session)));
  if (removed) {
    sec.appendChild(h("p", { class: "amend-removed-note", contenteditable: "false" },
      "Article abrogé par la modification en cours. ",
      button("Rétablir", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => session.action("restore", { key }) })));
  }
  return sec;
}

function articleTools(node, i, key, removed, session) {
  return h("span", { class: "amend-tools", contenteditable: "false" },
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
function block(b, i, j, session) {
  if (b.type === "list") {
    const list = h(b.ordered ? "ol" : "ul", { class: "doc-list" });
    (b.items || []).forEach((it, k) => list.appendChild(h("li", {}, region(session, ADDR.item(i, j, k), it.text, "span", "amend-region--inline"))));
    return list;
  }
  if (b.type === "table") {
    const wrap = h("div", { class: "doc-table-wrap" });
    if (b.caption) wrap.appendChild(h("p", { class: "doc-table-caption" }, region(session, ADDR.caption(i, j), b.caption, "span", "amend-region--inline")));
    const t = h("table", { class: "doc-table" });
    const trh = h("tr");
    (b.columns || []).forEach((c) => trh.appendChild(h("th", { text: c })));
    t.appendChild(h("thead", {}, trh));
    const tb = h("tbody");
    (b.rows || []).forEach((r, ri) => {
      const tr = h("tr");
      (b.columns || []).forEach((_, ci) => tr.appendChild(h("td", {}, region(session, ADDR.cell(i, j, ri, ci), r[ci] ?? "", "span", "amend-region--inline"))));
      tb.appendChild(tr);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    return wrap;
  }
  return h("p", { class: "doc-p" }, region(session, ADDR.block(i, j), b.text, "span", "amend-region--inline"));
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
