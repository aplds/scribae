// ============================================================================
// Document éditable en place (WYSIWYG) pour la rédaction d'un acte.
//
// Le principe : la page A4 n'est pas un aperçu, c'est le formulaire. Le
// rédacteur complète les pastilles directement dans les phrases et réécrit le
// texte comme il le ferait dans un traitement de texte. Chaque pastille
// correspond à un champ de la trame ; chaque portion de texte réécrite est
// enregistrée comme un écart à la trame (voir lib/redaction.js).
// ============================================================================
import { h, clear, button } from "../dom.js";
import { templateParts } from "../../lib/compile.js";
import { hasEcart } from "../../lib/redaction.js";
import { normalizeSpace } from "../../lib/util.js";
import { personName, documentSheetHeader, documentSheetFooter } from "../../lib/render.js";
import { styleForDoc } from "../../lib/styles.js";

// ---------------------------------------------------------------- sérialisation
// Reconstitue la source (texte + jetons `{{…}}`) d'une zone éditable. Les
// pastilles sont ramenées à leur jeton d'origine : remplir un champ ne modifie
// donc jamais le texte de la trame.
export function serializeEditable(el) {
  let out = "";
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.data;
    else if (n.nodeType === 1) {
      if (n.classList?.contains("rw-tok")) out += "{{" + (n.dataset.inner ?? "") + "}}";
      else if (n.tagName === "BR") out += "\n";
      else out += serializeEditable(n);
    }
  }
  return out;
}

const fieldOf = (trame, expr) => (trame.fields || []).find((f) => f.id === expr) || null;

// Un jeton peut désigner une propriété d'un champ : `{{beneficiaire.lastName}}`
// est rempli en choisissant le champ « beneficiaire » (le reste, c'est de
// l'affichage). En revanche `entity.name` ou `org.name` viennent du référentiel.
function fieldRefOf(trame, expr) {
  const base = String(expr || "").split(".")[0].trim();
  return fieldOf(trame, expr) || fieldOf(trame, base) || null;
}

// ---------------------------------------------------------------- pastilles
function tokenWidget(rx, part, addr) {
  const field = fieldRefOf(rx.trame, part.expr);
  const span = h("span", {
    class: "rw-tok " + (field ? "rw-tok--field" : "rw-tok--ref") + (part.empty ? " rw-tok--empty" : ""),
    "data-inner": part.inner,
    "data-expr": part.expr,
    contenteditable: "false",
    title: field
      ? `Champ « ${field.label} » — cliquez pour le renseigner`
      : `Valeur issue du référentiel (${part.expr}) — cliquez pour la remplacer`,
  });
  if (field) span.dataset.field = field.id;
  if (part.value) span.appendChild(document.createTextNode(part.value));
  else span.appendChild(h("span", { class: "rw-tok__hint", text: field ? field.label : "valeur non trouvée" }));
  span.addEventListener("mousedown", (e) => { e.preventDefault(); e.stopPropagation(); openTokenEditor(span, part, rx, addr); });
  return span;
}

function partsToNodes(parts, rx, addr) {
  const out = [];
  for (const p of parts) {
    if (p.t === "text") { if (p.v) out.push(document.createTextNode(p.v)); }
    else out.push(tokenWidget(rx, p, addr));
  }
  return out;
}

// ------------------------------------------------------------- zone éditable
function editableRegion(rx, { addr, base, renderSource, tag = "div", cls = "", compiled = "" }) {
  const el = h(tag, { class: cls + " rw-region", contenteditable: "true", spellcheck: "true", "data-slot": addr, "data-base": base });
  paintRegion(el, rx, renderSource);
  el.addEventListener("input", () => {
    el.__changed = true;
    commitRegion(el, rx);
    rx.paintPanelSoon();
  });
  el.addEventListener("blur", (ev) => {
    const changed = commitRegion(el, rx);
    el.__changed = false;
    // On ne redessine PAS la vue ici : le rédacteur vient souvent de cliquer un
    // bouton de l'application, qui serait détruit avant de recevoir son clic.
    // Le panneau (écarts, compteurs) se met à jour juste après, en différé.
    if (changed) rx.paintPanelSoon();
  });
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); el.blur(); }
    if (e.key === "Escape") el.blur();
  });
  markRegion(el, rx);
  return el;
}

function paintRegion(el, rx, renderSource) {
  const parts = templateParts(renderSource || "", rx.doc.ctx);
  el.replaceChildren(...partsToNodes(parts, rx, el.dataset.slot));
}

// Marque visiblement ce qui a été réécrit par le rédacteur (le même signal est
// repris dans la fiche de l'acte et dans le registre, pour les administrateurs).
function markRegion(el, rx) {
  const addr = el.dataset.slot;
  const original = rx.sources.get(addr) ?? "";
  el.classList.toggle("rw-region--ecart", hasEcart(rx.overrides, addr, original));
}

function commitRegion(el, rx) {
  const addr = el.dataset.slot;
  const base = el.dataset.base ?? "";
  const src = serializeEditable(el);
  if (normalizeSpace(src) === normalizeSpace(base)) { markRegion(el, rx); return false; }
  const original = rx.sources.get(addr) ?? "";
  if (normalizeSpace(src) === normalizeSpace(original)) delete rx.overrides[addr];
  else rx.overrides[addr] = src;
  el.dataset.base = src;
  markRegion(el, rx);
  return true;
}

// ---------------------------------------------------------------- popover
let popover = null;
export function closeTokenEditor() {
  if (!popover) return;
  popover.remove();
  popover = null;
  document.removeEventListener("mousedown", onOutside, true);
  document.removeEventListener("keydown", onEscape, true);
}
function onOutside(e) { if (popover && !popover.contains(e.target)) { closeTokenEditor(); } }
function onEscape(e) { if (e.key === "Escape") closeTokenEditor(); }

function openTokenEditor(widget, part, rx, addr) {
  closeTokenEditor();
  const field = fieldRefOf(rx.trame, part.expr);
  const pop = h("div", { class: "rw-pop", role: "dialog" });
  const head = h("div", { class: "rw-pop__head" },
    h("span", { class: "rw-pop__title", text: field ? field.label : "Valeur du référentiel" }),
    h("span", { class: "fr-small fr-muted", text: "{{" + part.expr + "}}" }),
  );
  const body = h("div", { class: "rw-pop__body" });
  const foot = h("div", { class: "rw-pop__foot" });

  const apply = (value) => { rx.setField(field.id, value); refreshWidget(widget, rx, part); rx.paintSoon(); rx.paintPanelSoon(); rx.markDirty(); };

  if (field) {
    if (field.help) body.appendChild(h("p", { class: "fr-hint", text: field.help }));
    body.appendChild(controlFor(field, rx.values[field.id], apply));
    if (!field.required) {
      foot.appendChild(button("Effacer", { variant: "tertiary", size: "sm", onClick: () => { apply(""); } }));
    }
  } else {
    body.appendChild(h("p", { class: "rw-pop__value", text: part.value || "— valeur introuvable —" }));
    body.appendChild(h("p", { class: "fr-small fr-muted", text: "Cette valeur vient du référentiel : elle n'est pas saisie ici. Vous pouvez l'adapter en l'écrivant vous-même — l'écart sera signalé aux administrateurs." }));
    // Si l'expression fait intervenir un champ (« le 1er juin » ou « au lendemain
    // de la publication » selon la date d'effet), on propose de renseigner
    // directement ce champ.
    const involved = (rx.trame.fields || []).find((f) => new RegExp(`(^|[^\\w])${f.id}([^\\w]|$)`).test(part.expr));
    if (involved) {
      foot.appendChild(button("Renseigner « " + involved.label + " »", {
        variant: "tertiary", size: "sm",
        onClick: () => openTokenEditor(widget, { expr: involved.id, inner: involved.id, value: rx.values[involved.id] || "", empty: false }, rx, addr),
      }));
    }
    const write = button("Écrire ce texte moi-même", {
      variant: "secondary", size: "sm", icon: "check",
      onClick: () => {
        const text = part.value || "";
        widget.replaceWith(document.createTextNode(text));
        const region = document.querySelector(`[data-slot="${addr}"]`);
        if (region) { commitRegion(region, rx); region.__changed = false; }
        closeTokenEditor();
        rx.markDirty();
        rx.paintFull();
      },
    });
    foot.appendChild(write);
  }
  foot.appendChild(button("Terminer", { variant: "primary", size: "sm", onClick: () => { closeTokenEditor(); rx.paintFull(); } }));

  pop.append(head, body, foot);
  document.body.appendChild(pop);
  popover = pop;
  positionPopover(pop, widget);
  requestAnimationFrame(() => { const c = pop.querySelector("input,select,textarea,button"); c?.focus(); });
  document.addEventListener("mousedown", onOutside, true);
  document.addEventListener("keydown", onEscape, true);
}

function positionPopover(pop, widget) {
  const r = widget.getBoundingClientRect();
  pop.style.left = "0px";
  pop.style.top = "0px";
  const w = pop.offsetWidth, hgt = pop.offsetHeight;
  let left = Math.min(Math.max(8, r.left - 20), window.innerWidth - w - 8);
  let top = r.bottom + 6;
  if (top + hgt > window.innerHeight - 8) top = Math.max(8, r.top - hgt - 6);
  pop.style.left = left + "px";
  pop.style.top = top + "px";
}

// Reflète tout de suite une nouvelle valeur sur la pastille, sans reconstruire
// la page (le curseur est dans la bulle). Les jetons qui visent une propriété
// (`beneficiaire.lastName`) sont laissés tels quels : la page se redessine juste
// après et affiche la valeur mise en forme.
function refreshWidget(widget, rx, part) {
  const field = fieldRefOf(rx.trame, part.expr);
  // On ne touche à la pastille que si elle affiche exactement cette expression
  // (la bulle peut avoir été ouverte pour un champ « caché » dans un calcul).
  if (widget.dataset.expr !== part.expr) return;
  if (field && String(part.expr).includes(".")) return;
  const value = field ? rx.values[field.id] : part.value;
  const text = value == null || value === "" ? "" : String(value);
  clear(widget);
  if (text) { widget.classList.remove("rw-tok--empty"); widget.appendChild(document.createTextNode(text)); }
  else {
    widget.classList.add("rw-tok--empty");
    widget.appendChild(h("span", { class: "rw-tok__hint", text: field ? field.label : "valeur non trouvée" }));
  }
}

// Contrôle de saisie d'un champ, adapté à son type (utilisé par la bulle).
export function controlFor(field, value, onChange) {
  const config = {};
  switch (field.type) {
    case "textarea": {
      const ta = h("textarea", { class: "fr-textarea", rows: 4, placeholder: field.placeholder || "" });
      ta.value = value ?? "";
      ta.addEventListener("input", () => onChange(ta.value));
      return ta;
    }
    case "date": {
      const i = h("input", { class: "fr-input", type: "date", value: value || "" });
      i.addEventListener("change", () => onChange(i.value));
      return i;
    }
    case "number":
    case "money": {
      const i = h("input", { class: "fr-input", type: "number", value: value ?? "" });
      i.addEventListener("input", () => onChange(i.value === "" ? "" : Number(i.value)));
      return i;
    }
    case "boolean": {
      const c = h("input", { type: "checkbox", checked: !!value });
      c.addEventListener("change", () => onChange(c.checked));
      return h("label", { class: "fr-check" }, c, field.label || "Oui");
    }
    case "choice":
      return selectOf([{ value: "", label: "— Sélectionner —" }, ...(field.options || []).map((o) => ({ value: o, label: o }))], value, onChange);
    case "person":
      return selectOf([{ value: "", label: "— Sélectionner —" }, ...(state_config_people()).map((p) => ({ value: p.id, label: personName(p) }))], value, onChange);
    case "entity":
      return selectOf([{ value: "", label: "— Sélectionner —" }, ...(state_config_entities()).map((e) => ({ value: e.id, label: e.name }))], value, onChange);
    case "ref":
      return selectOf([{ value: "", label: "— Sélectionner —" }, ...(state_config_refs()).map((r) => ({ value: r.id, label: r.label }))], value, onChange);
    case "multichoice":
      return multiChoices(field.options || [], value, onChange);
    case "reflist":
      return multiChoicesRefs(value, onChange);
    default: {
      const i = h("input", { class: "fr-input", value: value ?? "", placeholder: field.placeholder || "" });
      i.addEventListener("input", () => onChange(i.value));
      return i;
    }
  }
}

function selectOf(options, value, onChange) {
  const s = h("select", { class: "fr-select", on: { change: (e) => onChange(e.target.value) } });
  for (const o of options) {
    const opt = h("option", { value: o.value, text: o.label });
    if (String(o.value) === String(value ?? "")) opt.selected = true;
    s.appendChild(opt);
  }
  return s;
}

function multiChoices(options, value, onChange) {
  const arr = Array.isArray(value) ? [...value] : [];
  const wrap = h("div", { class: "fr-choices" });
  for (const o of options) {
    wrap.appendChild(h("button", {
      type: "button", class: "fr-choice" + (arr.includes(o) ? " is-on" : ""),
      onClick: (e) => {
        const i = arr.indexOf(o);
        if (i >= 0) arr.splice(i, 1); else arr.push(o);
        e.currentTarget.classList.toggle("is-on");
        onChange([...arr]);
      },
    }, o));
  }
  return wrap;
}

function multiChoicesRefs(value, onChange) {
  const arr = Array.isArray(value) ? [...value] : [];
  const wrap = h("div", { class: "fr-choices" });
  for (const r of state_config_refs()) {
    wrap.appendChild(h("button", {
      type: "button", class: "fr-choice" + (arr.includes(r.id) ? " is-on" : ""),
      onClick: (e) => {
        const i = arr.indexOf(r.id);
        if (i >= 0) arr.splice(i, 1); else arr.push(r.id);
        e.currentTarget.classList.toggle("is-on");
        onChange([...arr]);
      },
    }, r.label.length > 70 ? r.label.slice(0, 70) + "…" : r.label));
  }
  return wrap;
}

// Le référentiel est lu à l'exécution (jamais capturé à l'import).
let configRef = null;
export function bindConfig(config) { configRef = config; }
const state_config_people = () => configRef?.people || [];
const state_config_entities = () => configRef?.entities || [];
const state_config_refs = () => configRef?.refs || [];

// ----------------------------------------------------------------- document
export function buildRedactionDoc(rx) {
  const doc = rx.doc;
  const trameByPath = new Map();
  const collect = (nodes, base) => (nodes || []).forEach((n, i) => {
    const path = `${base}.${i}`;
    trameByPath.set(path, n);
    if (n.blocks) collect(n.blocks, `${path}.blocks`);
  });
  collect(rx.trame.body || [], "body");

  const art = h("article", { class: "doc doc--redaction" });
  // L'habillage du document (en-tête, pied, jeu de couleurs et de filets) vient
  // de sa charte : le rédacteur voit exactement ce qui sera imprimé.
  const style = styleForDoc(rx.config, doc);
  if (style?.id) art.dataset.sheet = style.id;
  if (style?.showHeader) art.appendChild(documentSheetHeader(style, doc, rx.config));

  const src = (addr, fallback) => {
    const v = rx.overrides[addr];
    return v !== undefined ? v : (rx.sources.get(addr) ?? fallback ?? "");
  };
  const region = (addr, compiled, opts = {}) => {
    const base = src(addr, opts.originalFallback ?? compiled);
    const renderFrom = String(base).trim() ? base : compiled;
    return editableRegion(rx, { addr, base, renderSource: renderFrom, tag: opts.tag || "div", cls: opts.cls || "", compiled });
  };

  for (const node of doc.nodes) {
    const trameNode = trameByPath.get(node.path);
    switch (node.type) {
      case "title":
        art.appendChild(region(node.path, node.text, { tag: "h1", cls: "doc-title" }));
        break;
      case "authority":
        art.appendChild(region(node.path, node.text, { tag: "p", cls: "doc-authority" }));
        break;
      case "enact":
        art.appendChild(region(node.path, node.text, { tag: "p", cls: "doc-enact" }));
        break;
      case "visas": {
        const ul = h("ul", { class: "doc-visas" });
        (node.items || []).forEach((it) => {
          const idx = (trameNode?.items || []).findIndex((x) => x.id === it.id);
          const li = h("li", {});
          li.appendChild(document.createTextNode((rx.config.vocab?.visasLabel || "Vu") + " "));
          const addr = idx >= 0 ? `${node.path}.items.${idx}` : "";
          li.appendChild(addr
            ? region(addr, it.text, { tag: "span", cls: "rw-inline" })
            : h("span", { text: it.text }));
          ul.appendChild(li);
        });
        art.appendChild(ul);
        break;
      }
      case "considerants": {
        const box = h("div", { class: "doc-recitals" });
        (node.items || []).forEach((it) => {
          const idx = (trameNode?.items || []).findIndex((x) => x.id === it.id);
          const p = h("p", { class: "doc-p" });
          p.appendChild(idx >= 0 ? region(`${node.path}.items.${idx}`, it.text, { tag: "span", cls: "rw-inline" }) : h("span", { text: it.text }));
          box.appendChild(p);
        });
        art.appendChild(box);
        break;
      }
      case "article": {
        const sec = h("section", { class: "doc-article" + (node.ecart ? " rw-region--ecart" : "") });
        const head = h("h2", { class: "doc-article-head" });
        head.appendChild(h("span", { class: "doc-article-num", text: node.numLabel }));
        if (node.heading || (trameNode?.heading !== undefined && trameNode.heading !== "")) {
          head.appendChild(document.createTextNode(" – "));
          head.appendChild(region(`${node.path}.heading`, node.heading, { tag: "span", cls: "rw-inline" }));
        }
        sec.appendChild(head);
        for (const b of node.blocks || []) sec.appendChild(renderBlock(b, trameNode));
        art.appendChild(sec);
        break;
      }
      case "signature": {
        const box = h("div", { class: "doc-signature" });
        const place = h("p", { class: "doc-signature-place" });
        place.appendChild(document.createTextNode("Fait à "));
        place.appendChild(region(`${node.path}.place`, node.place, { tag: "span", cls: "rw-inline" }));
        place.appendChild(document.createTextNode(`, le ${node.date}`));
        box.appendChild(place);
        const right = h("div", { class: "doc-signature-block" });
        if (node.signataire) {
          right.appendChild(h("p", { class: "doc-signature-role", text: (rx.config.roles || []).find((r) => r.id === node.signataire.roles?.[0])?.label || "" }));
          right.appendChild(h("p", { class: "doc-signature-name", text: personName(node.signataire) }));
        } else {
          right.appendChild(h("p", { class: "rw-hint-inline", text: "Signataire à choisir dans le panneau de droite" }));
        }
        box.appendChild(right);
        art.appendChild(box);
        break;
      }
      case "mention":
        art.appendChild(region(node.path, node.text, { tag: "p", cls: "doc-mention" }));
        break;
      case "para":
      case "raw":
        art.appendChild(region(node.path, node.text, { tag: "p", cls: "doc-p" }));
        break;
      case "list": {
        const list = h(node.ordered ? "ol" : "ul", { class: "doc-list" });
        (node.items || []).forEach((it) => {
          const idx = (trameNode?.items || []).findIndex((x) => x.id === it.id);
          const li = h("li", {});
          li.appendChild(idx >= 0 ? region(`${node.path}.items.${idx}`, it.text, { tag: "span", cls: "rw-inline" }) : h("span", { text: it.text }));
          list.appendChild(li);
        });
        art.appendChild(list);
        break;
      }
      case "table": {
        const wrap = h("div", { class: "doc-table-wrap" });
        if (node.caption) wrap.appendChild(region(`${node.path}.caption`, node.caption, { tag: "p", cls: "doc-table-caption" }));
        const t = h("table", { class: "doc-table" });
        const thead = h("thead");
        const trh = h("tr");
        (node.columns || []).forEach((c, j) => trh.appendChild(h("th", {}, region(`${node.path}.columns.${j}`, c, { tag: "span", cls: "rw-inline" }))));
        thead.appendChild(trh);
        t.appendChild(thead);
        const tb = h("tbody");
        (node.rows || []).forEach((r, ri) => {
          const tr = h("tr");
          (node.columns || []).forEach((_, ci) => tr.appendChild(h("td", {}, region(`${node.path}.rows.${ri}.${ci}`, r[ci] ?? "", { tag: "span", cls: "rw-inline" }))));
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        wrap.appendChild(t);
        art.appendChild(wrap);
        break;
      }
      default:
        break;
    }
  }
  if (style?.showFooter) art.appendChild(documentSheetFooter(style, doc, rx.config));
  return art;

  function renderBlock(b, articleTrameNode) {
    const child = trameByPath.get(b.path);
    switch (b.type) {
      case "list": {
        const list = h(b.ordered ? "ol" : "ul", { class: "doc-list" });
        (b.items || []).forEach((it) => {
          const idx = (child?.items || []).findIndex((x) => x.id === it.id);
          const li = h("li", {});
          li.appendChild(idx >= 0 ? region(`${b.path}.items.${idx}`, it.text, { tag: "span", cls: "rw-inline" }) : h("span", { text: it.text }));
          list.appendChild(li);
        });
        return list;
      }
      case "table": {
        const wrap = h("div", { class: "doc-table-wrap" });
        if (b.caption) wrap.appendChild(region(`${b.path}.caption`, b.caption, { tag: "p", cls: "doc-table-caption" }));
        const t = h("table", { class: "doc-table" });
        const trh = h("tr");
        (b.columns || []).forEach((c, j) => trh.appendChild(h("th", {}, region(`${b.path}.columns.${j}`, c, { tag: "span", cls: "rw-inline" }))));
        t.appendChild(h("thead", {}, trh));
        const tb = h("tbody");
        (b.rows || []).forEach((r, ri) => {
          const tr = h("tr");
          (b.columns || []).forEach((_, ci) => tr.appendChild(h("td", {}, region(`${b.path}.rows.${ri}.${ci}`, r[ci] ?? "", { tag: "span", cls: "rw-inline" }))));
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        wrap.appendChild(t);
        return wrap;
      }
      default:
        return region(b.path, b.text, { tag: b.type === "raw" ? "p" : "p", cls: "doc-p" });
    }
  }
}

// Fait défiler jusqu'à la pastille d'un champ et la met en évidence.
export function focusFieldWidget(paper, fieldId) {
  const el = paper.querySelector(`[data-field="${cssEscape(fieldId)}"]`);
  if (!el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("rw-tok--flash");
  setTimeout(() => el.classList.remove("rw-tok--flash"), 1400);
  return true;
}

function cssEscape(s) {
  return String(s).replace(/["\\]/g, "\\$&");
}

// Liste des passages conditionnels actuellement masqués : utile pour expliquer
// au rédacteur pourquoi une clause n'apparaît pas encore.
export function hiddenPassages(trame, doc) {
  const present = new Set(compiledPaths(doc));
  const out = [];
  const walk = (nodes, base) => (nodes || []).forEach((n, i) => {
    const path = `${base}.${i}`;
    if (n.when && !present.has(path)) out.push({ path, label: passageLabel(n), when: n.when });
    if (n.blocks) walk(n.blocks, `${path}.blocks`);
  });
  walk(trame.body || [], "body");
  return out;
}

function compiledPaths(doc) {
  const out = [];
  const walk = (nodes) => (nodes || []).forEach((n) => { if (n.path) out.push(n.path); walk(n.blocks); });
  walk(doc?.nodes || []);
  return out;
}

function passageLabel(n) {
  if (n.type === "article") return "Article" + (n.heading ? " — " + n.heading : "");
  if (n.type === "list") return "Liste";
  if (n.type === "para") return (n.text || "").slice(0, 60);
  return n.type;
}
