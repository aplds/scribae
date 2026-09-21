// ============================================================================
// Document éditable en place (WYSIWYG) pour la rédaction d'un acte.
//
// Le principe : la page A4 n'est pas un aperçu, c'est le formulaire. Le
// rédacteur complète les pastilles directement dans les phrases et réécrit le
// texte comme il le ferait dans un traitement de texte. Chaque pastille
// correspond à un champ de la trame ; chaque portion de texte réécrite est
// enregistrée comme un écart à la trame (voir lib/redaction.js).
// ============================================================================
import { h, clear, button, icon } from "../dom.js";
import { templateParts } from "../../lib/compile.js";
import { hasEcart } from "../../lib/redaction.js";
import { appliquerFormule } from "../../lib/schema.js";
import { normalizeSpace } from "../../lib/util.js";
import { personName, personSignatureName, personRoleLines, documentSheetHeader, documentSheetFooter, MARQUE_STYLE } from "../../lib/render.js";
import { styleForDoc } from "../../lib/styles.js";
import { signerPicker } from "../signer-picker.js";
import { champFonction } from "../../lib/fonctions.js";
import { annexesVocab } from "../../lib/annexes.js";
import { glissable, deposable, moitie, rangeDans, insererAuRange } from "../dnd.js";
import { deplacerVers, rangDe, ordreConteneur, rangerCommeLaTrame, aOrdre } from "../../lib/ordre.js";
import { annotationStrip, notesByPath } from "../annotations.js";
import { ajoutPour } from "../../lib/structure.js";

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

// Les blocs d'un document qui ne se déplacent pas : l'intitulé et l'auteur de
// l'acte (qui sont à leur place par nature), et la liste des annexes (écrite par
// l'application, à la fin du dispositif). Voir `bloc()` dans buildRedactionDoc.
const FIXES = new Set(["title", "authority", "annexes"]);

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

// La pastille d'un jeton donné — par exemple une variable glissée depuis la
// bibliothèque du panneau de droite. On la résout comme le fait le rendu : la
// pastille montre la valeur, et garde le jeton d'origine pour la source.
function tokenNodeFor(rx, token, addr) {
  const inner = String(token || "").replace(/^\{\{|\}\}$/g, "").trim();
  const parts = templateParts("{{" + inner + "}}", rx.doc.ctx);
  const part = parts.find((p) => p.t === "tok") || { t: "tok", expr: inner, inner, value: "", empty: true };
  return tokenWidget(rx, part, addr);
}

// Insère une variable dans une zone éditable — au point du dépôt quand il y en
// a un (glisser, ou clic dans le texte), à la fin sinon. La zone est ensuite
// enregistrée comme n'importe quelle réécriture.
export function insererJeton(rx, el, token, x, y) {
  const node = tokenNodeFor(rx, token, el.dataset.slot);
  const range = (x == null || y == null) ? null : rangeDans(el, x, y);
  if (range) insererAuRange(el, range, node);
  else el.appendChild(node);
  commitRegion(el, rx);
  el.__changed = false;
  rx.markDirty?.();
  return node;
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
  // La bibliothèque de variables du panneau de droite : on glisse une variable
  // dans le texte, elle s'insère exactement où on la lâche.
  deposable(el, {
    accepte: (c) => c.kind === "champ" || c.kind === "auto",
    onDepot: (c, e) => { insererJeton(rx, el, c.token, e.clientX, e.clientY); rx.paintFull(); },
  });
  // … et, à défaut de glisser, on clique la variable (elle s'arme) puis on
  // clique dans le texte — le geste de l'éditeur de trame.
  el.addEventListener("click", (e) => {
    if (!rx.arme) return;
    if (e.target.closest?.(".rw-tok")) return;
    const token = rx.arme.token;
    rx.desarmer?.();
    insererJeton(rx, el, token, e.clientX, e.clientY);
    rx.paintFull();
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
  // Un bloc AJOUTÉ par la rédaction n'a pas de trame derrière lui : son texte
  // vit dans l'ajout lui-même, non dans les écarts (voir lib/structure.js).
  rx.onCommit?.(addr, src, el);
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
    // Le périmètre de l'acte décide des fonctions proposables et de la chaîne de
    // délégations (voir src/ui/signer-picker.js).
    const scope = {
      entityId: rx.values.__entityId || "", familyId: rx.trame.familyId || "",
      actTypeId: rx.trame.actTypeId || "", date: rx.values.dateSignature || "",
    };
    body.appendChild(controlFor(field, rx.values[field.id], apply, {
      config: rx.config, scope,
      fonctionKey: rx.values[champFonction(field.id)] || "",
      onFonction: (cle) => { rx.values[champFonction(field.id)] = cle; rx.paintSoon(); rx.paintPanelSoon(); },
    }));
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
// `opts` porte ce dont certains types ont besoin en plus du champ lui-même : la
// configuration du référentiel et le périmètre de l'acte, pour le signataire.
export function controlFor(field, value, onChange, opts = {}) {
  const config = opts.config || configRef || {};
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
    case "signataire":
      // Deux temps : la fonction, puis qui signe parmi ceux qui la tiennent.
      return signerPicker({
        field, config, scope: opts.scope || {},
        personId: value || "", fonctionKey: opts.fonctionKey || "",
        onPerson: (v) => onChange(v),
        onFonction: (cle) => opts.onFonction?.(cle),
        showQualite: true,
      });
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

// ----------------------------------------------------- réglages de bloc
// Les paramètres propres à un bloc (voir `paramsBloc`, lib/schema.js) valent
// aussi dans l'atelier de rédaction : le rédacteur doit voir exactement ce qui
// sera imprimé — un paragraphe encadré, une liste « 1° », une légende
// au-dessous. Les nœuds compilés portent déjà ces valeurs ; il ne reste qu'à
// les poser sur le DOM, avec les mêmes classes que le rendu (lib/render.js).
const styleListe = (list, node) => {
  const marque = node.ordered ? node.numbering : node.marker;
  if (marque) list.style.listStyleType = MARQUE_STYLE[marque] || marque;
  if (node.ordered && Number(node.start) > 1) list.setAttribute("start", String(Number(node.start)));
  return list;
};
const styleParagraphe = (p, node) => {
  if (node.type !== "para") return p;
  if (node.align) p.style.textAlign = node.align;
  if (node.indent) p.classList.add("doc-p--indent-" + node.indent);
  if (node.boxed) p.classList.add("doc-p--boxed");
  return p;
};
const classesTable = (node) => "doc-table"
  + (node.layout ? " doc-table--" + node.layout : "")
  + (node.align ? " doc-table--" + node.align : "");

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

  const page = h("article", { class: "doc doc--redaction" });
  // L'habillage du document (en-tête, pied, jeu de couleurs et de filets) vient
  // de sa charte : le rédacteur voit exactement ce qui sera imprimé.
  const style = styleForDoc(rx.config, doc);
  if (style?.id) page.dataset.sheet = style.id;
  if (style?.showHeader) page.appendChild(documentSheetHeader(style, doc, rx.config));

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
    // `art` est ici l'ENVELOPPE du bloc (son outillage de rangement) : le rendu
    // qui suit n'a pas à connaître la mécanique du déplacement, il remplit.
    const art = bloc(node, "body");
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
          const { idx, addr } = pieceAddr(it, trameNode, node.path);
          const li = h("li", {});
          li.appendChild(document.createTextNode((rx.config.vocab?.visasLabel || "Vu") + " "));
          li.appendChild(addr
            ? region(addr, it.text, { tag: "span", cls: "rw-inline" })
            : h("span", { text: it.text }));
          li.appendChild(pieceTools(node.path, it, addr));
          ul.appendChild(li);
        });
        ul.appendChild(h("li", { class: "piece--ajout" }, boutonAjout(node.path, "Ajouter un visa")));
        art.appendChild(ul);
        break;
      }
      case "considerants": {
        const box = h("div", { class: "doc-recitals" + (node.inline ? " doc-recitals--inline" : "") });
        (node.items || []).forEach((it) => {
          const { addr } = pieceAddr(it, trameNode, node.path);
          const p = h("p", { class: "doc-p" });
          // La formule du bloc est ajoutée à la compilation : montrer ici ce
          // qu'elle ajoutera, sinon le rédacteur ne lirait pas la phrase qu'il
          // signe. Elle n'est pas répétée quand le texte la porte déjà (voir
          // `appliquerFormule`, lib/schema.js).
          const source = String(src(addr, it.text) || "");
          if (node.formule && source.trim() && appliquerFormule(node.formule, source) !== source) {
            p.appendChild(h("span", { class: "doc-recitals__formule", contenteditable: "false", text: node.formule + " " }));
          }
          p.appendChild(addr ? region(addr, it.text, { tag: "span", cls: "rw-inline" }) : h("span", { text: it.text }));
          // La ponctuation finale du bloc s'ajoute à la compilation : on la
          // montre, sans l'écrire (même règle que `finir`, lib/compile.js).
          if (node.fin && source.trim() && !/[.;,:]$/.test(source.trim())) {
            p.appendChild(h("span", { class: "doc-recitals__fin", contenteditable: "false", text: node.fin }));
          }
          p.appendChild(pieceTools(node.path, it, addr));
          box.appendChild(p);
        });
        box.appendChild(h("p", { class: "doc-p piece--ajout" }, boutonAjout(node.path, "Ajouter un considérant")));
        art.appendChild(box);
        break;
      }
      case "article": {
        art.appendChild(renderArticle(node, trameNode));
        break;
      }
      case "division": {
        art.appendChild(divisionEl(node, trameNode));
        break;
      }
      case "annexes": {
        // La liste des documents annexés à l'acte : elle vient de la rédaction
        // (les annexes jointes), non de la trame, et n'est donc pas éditable ici.
        const box = h("section", { class: "doc-annexes" });
        box.appendChild(h("h2", { class: "doc-annexes-title" }, annexesVocab(rx.config).sectionTitle));
        const ul = h("ul", { class: "doc-annexes-list" });
        for (const it of node.items || []) {
          const label = [it.texte, it.objet].filter(Boolean).join(" — ");
          ul.appendChild(h("li", {}, it.lien ? h("a", { href: it.lien, target: "_blank", rel: "noopener noreferrer" }, label) : document.createTextNode(label || "Annexe")));
        }
        box.appendChild(ul);
        art.appendChild(box);
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
          for (const ligne of personRoleLines(node.signataire, rx.config)) {
            right.appendChild(h("p", { class: "doc-signature-role", text: ligne }));
          }
          right.appendChild(h("p", { class: "doc-signature-name", text: personSignatureName(node.signataire) }));
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
        art.appendChild(styleParagraphe(region(node.path, node.text, { tag: "p", cls: "doc-p" }), node));
        break;
      case "list": {
        const list = styleListe(h(node.ordered ? "ol" : "ul", { class: "doc-list" }), node);
        (node.items || []).forEach((it) => {
          const { addr } = pieceAddr(it, trameNode, node.path);
          const li = h("li", {});
          li.appendChild(addr ? region(addr, it.text, { tag: "span", cls: "rw-inline" }) : h("span", { text: it.text }));
          li.appendChild(pieceTools(node.path, it, addr));
          list.appendChild(li);
        });
        list.appendChild(h("li", { class: "piece--ajout" }, boutonAjout(node.path, "Ajouter un élément")));
        art.appendChild(list);
        break;
      }
      case "table": {
        const wrap = h("div", { class: "doc-table-wrap" });
        const legende = () => (node.caption ? region(`${node.path}.caption`, node.caption, { tag: "p", cls: "doc-table-caption" }) : null);
        if (node.captionPos !== "bottom" && legende()) wrap.appendChild(legende());
        const t = h("table", { class: classesTable(node) });
        const tb = h("tbody");
        const ligneColonnes = (tag) => {
          const tr = h("tr");
          (node.columns || []).forEach((c, j) => tr.appendChild(h(tag, {}, region(`${node.path}.columns.${j}`, c, { tag: "span", cls: "rw-inline" }))));
          return tr;
        };
        if (node.head !== false) t.appendChild(h("thead", {}, ligneColonnes("th")));
        else tb.appendChild(ligneColonnes("td"));
        (node.rows || []).forEach((r, ri) => {
          const tr = h("tr");
          (node.columns || []).forEach((_, ci) => tr.appendChild(h("td", {}, region(`${node.path}.rows.${ri}.${ci}`, r[ci] ?? "", { tag: "span", cls: "rw-inline" }))));
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        wrap.appendChild(t);
        if (node.captionPos === "bottom" && legende()) wrap.appendChild(legende());
        art.appendChild(wrap);
        break;
      }
      default:
        break;
    }
    armerPrise(art, node, "body");
    page.appendChild(art);
  }
  if (style?.showFooter) page.appendChild(documentSheetFooter(style, doc, rx.config));
  attacherConsignes(page, rx);
  return page;

  // ------------------------------------------------------- blocs déplaçables
  // Tout bloc d'un document se SUIT : on doit pouvoir le remonter, le
  // descendre, l'attraper pour le poser ailleurs dans le même ensemble. Trois
  // blocs échappent au geste, parce qu'ils ne sont pas à leur place mais à LEUR
  // place : l'intitulé et l'auteur de l'acte (en tête), et la liste des annexes
  // (à la fin, écrite par l'application).
  // Le rang d'origine du conteneur dans la TRAME — c'est lui qui donne l'échelle
  // des rangs, y compris pour les blocs qu'une condition masque à l'écran.
  function tailleConteneur(containerPath) {
    if (containerPath === "body") return (rx.trame.body || []).length;
    const parent = String(containerPath).replace(/\.blocks$/, "");
    let cur = rx.trame;
    for (const p of parent.split(".")) cur = cur?.[/^\d+$/.test(p) ? Number(p) : p];
    return (cur?.blocks || []).length;
  }

  // L'enveloppe d'un bloc : sa poignée, ses deux flèches, et de quoi recevoir
  // les autres blocs du même conteneur. Le bloc lui-même y est ajouté ensuite
  // par le rendu (`art.appendChild(...)`) — l'ordre des deux n'importe pas : la
  // barre d'outils est posée hors du flux.
  function bloc(node, containerPath) {
    const wrap = h("div", { class: "mv" + (rx.selPath === node.path ? " mv--sel" : ""), "data-node": node.path });
    // Cliquer un bloc, c'est le désigner : le panneau de droite montre alors
    // tout ce qui le concerne (intitulé, numérotation, échelon, ajouts,
    // suppression). On ne redessine pas la page — le curseur de saisie doit
    // rester où il est (voir `rx.selectBlock`).
    if (node.path) wrap.addEventListener("click", () => rx.selectBlock?.(node.path));
    if (FIXES.has(node.type)) return wrap;
    const count = tailleConteneur(containerPath) || 1;
    const rang = rangDe(node.path);
    const ordre = ordreConteneur(rx.values, containerPath, count);
    const pos = ordre.indexOf(rang);
    const precedent = ordre[pos - 1];
    const suivant = ordre[pos + 1];
    // « Descendre » = prendre la place du bloc qui SUIT celui qui suit : une
    // place se décrit comme « la position du bloc X », et se glisser à la
    // position de son voisin immédiat ne changerait rien. Il en va de même d'un
    // dépôt : l'aperçu « après X » vise le bloc qui suit X.
    const apresSuivant = ordre[pos + 2];
    const bouger = (versRang) => {
      if (deplacerVers(rx.values, containerPath, count, rang, versRang)) {
        rx.markDirty?.();
        rx.paintFull();
      }
    };
    const poignee = glissable(
      h("span", { class: "mv__grip", title: "Glisser pour déplacer ce bloc", text: "⠿", "aria-hidden": "true" }),
      { kind: "mv", container: containerPath, rang, label: blocLabel(node) },
      { auDoigt: true },
    );
    const fleche = (icone, titre, desactive, onClick) => {
      const b = button("", { variant: "tertiary", icon: icone, size: "sm", title: titre, onClick });
      if (desactive) { b.disabled = true; b.style.opacity = ".35"; }
      return b;
    };
    const ajout = ajoutPour(rx.values, node.path);
    const outil = (icone, titre, onClick, cls = "") => h("button", {
      class: "mv__btn" + cls, type: "button", title: titre, "aria-label": titre,
      onClick: (e) => { e.stopPropagation(); onClick(e); },
    }, icon(icone, 13));
    wrap.appendChild(h("div", { class: "mv__tools", contenteditable: "false" },
      poignee,
      fleche("up", "Monter ce bloc", pos <= 0, () => bouger(precedent)),
      fleche("down", "Descendre ce bloc", suivant === undefined, () => bouger(apresSuivant === undefined ? null : apresSuivant)),
      // Ajouter un bloc après celui-ci : le menu ne propose que ce que ce
      // conteneur accepte (un paragraphe dans un article, un visa dans des
      // visas…). C'est le « revenir à la liste pour ajouter » d'un seul clic.
      outil("plus", "Ajouter après ce bloc", (e) => rx.menuAjout?.(e.currentTarget, containerPath, rang, "apres")),
      // Retirer ce bloc du document — d'un seul clic. Ce n'est pas une
      // suppression dans la trame : « Contrôle & écarts » peut le rétablir.
      outil("trash", ajout ? "Retirer ce bloc que vous avez ajouté" : "Retirer ce bloc du document",
        () => rx.supprimer?.(node.path), " mv__btn--danger"),
      // Toutes les options du bloc, dans le panneau (titre, numérotation,
      // échelon, condition, commentaires…).
      outil("gear", "Options de ce bloc", () => rx.selectBlock?.(node.path)),
    ));
    deposable(wrap, {
      accepte: (c) => c.kind === "mv" && c.container === containerPath && c.rang !== rang,
      halo: (el, c, e) => {
        const m = moitie(el, e);
        el.classList.toggle("dnd-avant", m === "avant");
        el.classList.toggle("dnd-apres", m === "apres");
      },
      onDepot: (c, e) => {
        const m = moitie(wrap, e);
        const versRang = m === "avant" ? rang : (suivant === undefined ? null : suivant);
        if (versRang === c.rang) return;
        if (deplacerVers(rx.values, containerPath, count, c.rang, versRang)) {
          rx.markDirty?.();
          rx.paintFull();
        }
      },
    });
    return wrap;
  }

  function blocLabel(node) {
    if (node.type === "article") return node.numLabel || "Article";
    if (node.type === "division") return [node.numLabel, node.heading].filter(Boolean).join(" — ") || "Division";
    if (node.type === "list") return "Liste";
    if (node.type === "table") return "Tableau";
    if (node.type === "signature") return "Signature";
    return node.type;
  }

  // Attraper un bloc PAR SON INTITULÉ : « Article 2 », « Titre Ier ». Le numéro
  // est une prise naturelle — c'est ce qu'on vise en pensant « cet article-là » —
  // et, contrairement au texte, il n'y a rien à y sélectionner.
  function armerPrise(wrap, node, containerPath) {
    if (FIXES.has(node.type)) return;
    const prise = wrap.querySelector(".doc-article-num, .doc-division-num");
    if (!prise || prise.dataset.prise) return;
    prise.dataset.prise = "1";
    prise.title = "Glisser pour déplacer ce bloc — ou le remonter à la flèche";
    prise.style.cursor = "grab";
    glissable(prise, { kind: "mv", container: containerPath, rang: rangDe(node.path), label: blocLabel(node) });
  }

  // ---------------------------------------------- éléments de liste & ajouts
  // Un élément (visa, considérant, item de liste) se rend de la même façon
  // qu'il vienne de la trame ou qu'il ait été ajouté par la rédaction ; seule
  // son adresse change. Les éléments ajoutés portent `it.ajout` (voir
  // lib/compile.js).
  function pieceAddr(it, trameChild, nodePath) {
    const idx = (trameChild?.items || []).findIndex((x) => x.id === it.id);
    const addr = idx >= 0 ? `${nodePath}.items.${idx}` : (it.ajout && it.path ? it.path : "");
    return { idx, addr };
  }

  // Les outils d'un élément : le retirer d'un clic, ou en ajouter un juste
  // après. Discrets au repos, jamais imprimés (voir `.piece__tools`).
  function pieceTools(nodePath, it, addr) {
    // Un élément sans adresse (un visa engendré par la chaîne de délégations)
    // n'est pas modifiable ici : pas d'outils.
    if (!addr) return h("span", { class: "piece__tools" });
    const outil = (icone, titre, onClick, danger) => h("button", {
      class: "piece__btn" + (danger ? " piece__btn--danger" : ""), type: "button", title: titre, "aria-label": titre,
      onClick: (e) => { e.stopPropagation(); onClick(); },
    }, icon(icone, 12));
    return h("span", { class: "piece__tools", contenteditable: "false" },
      outil("plus", "Ajouter un élément après celui-ci", () => rx.ajouterElement?.(nodePath, addr)),
      outil("trash", it.ajout ? "Retirer cet élément que vous avez ajouté" : "Retirer cet élément du document",
        () => rx.supprimer?.(addr), true),
    );
  }

  // Le bouton qui ajoute un élément à la fin d'une liste (« Ajouter un visa »).
  function boutonAjout(nodePath, label) {
    return h("button", {
      class: "piece__add", type: "button", contenteditable: "false",
      onClick: (e) => { e.stopPropagation(); rx.ajouterElement?.(nodePath, ""); },
    }, icon("plus", 12), h("span", { text: label }));
  }

  function renderBlock(b, articleTrameNode) {
    const el = renderBlockInner(b, articleTrameNode);
    // Le bloc porte son chemin : c'est là que se rattachent les commentaires de
    // la trame (voir `attacherConsignes`).
    if (el) el.dataset.node = b.path;
    return el;
  }

  function renderBlockInner(b, articleTrameNode) {
    const child = trameByPath.get(b.path);
    switch (b.type) {
      case "article":
        return renderArticle(b, child);
      case "division":
        return divisionEl(b, child);
      case "list": {
        const list = styleListe(h(b.ordered ? "ol" : "ul", { class: "doc-list" }), b);
        (b.items || []).forEach((it) => {
          const { addr } = pieceAddr(it, child, b.path);
          const li = h("li", {});
          li.appendChild(addr ? region(addr, it.text, { tag: "span", cls: "rw-inline" }) : h("span", { text: it.text }));
          li.appendChild(pieceTools(b.path, it, addr));
          list.appendChild(li);
        });
        list.appendChild(h("li", { class: "piece--ajout" }, boutonAjout(b.path, "Ajouter un élément")));
        return list;
      }
      case "table": {
        const wrap = h("div", { class: "doc-table-wrap" });
        const legende = () => (b.caption ? region(`${b.path}.caption`, b.caption, { tag: "p", cls: "doc-table-caption" }) : null);
        if (b.captionPos !== "bottom" && legende()) wrap.appendChild(legende());
        const t = h("table", { class: classesTable(b) });
        const tb = h("tbody");
        const ligneColonnes = (tag) => {
          const tr = h("tr");
          (b.columns || []).forEach((c, j) => tr.appendChild(h(tag, {}, region(`${b.path}.columns.${j}`, c, { tag: "span", cls: "rw-inline" }))));
          return tr;
        };
        if (b.head !== false) t.appendChild(h("thead", {}, ligneColonnes("th")));
        else tb.appendChild(ligneColonnes("td"));
        (b.rows || []).forEach((r, ri) => {
          const tr = h("tr");
          (b.columns || []).forEach((_, ci) => tr.appendChild(h("td", {}, region(`${b.path}.rows.${ri}.${ci}`, r[ci] ?? "", { tag: "span", cls: "rw-inline" }))));
          tb.appendChild(tr);
        });
        t.appendChild(tb);
        wrap.appendChild(t);
        if (b.captionPos === "bottom" && legende()) wrap.appendChild(legende());
        return wrap;
      }
      default:
        return styleParagraphe(region(b.path, b.text, { tag: b.type === "raw" ? "p" : "p", cls: "doc-p" }), b);
    }
  }

  // Un article : son numéro (la prise naturelle pour le déplacer), son intitulé,
  // et ses blocs. Le même rendu sert dans le corps du document et DANS une
  // division — sans quoi les articles rangés en Titres et Chapitres perdraient
  // leur numéro et ne pourraient plus être déplacés.
  function renderArticle(node, trameNode) {
    const sec = h("section", { class: "doc-article" + (node.ecart ? " rw-region--ecart" : "") });
    const head = h("h2", { class: "doc-article-head" });
    head.appendChild(h("span", { class: "doc-article-num", text: node.numLabel }));
    if (node.heading || (trameNode?.heading !== undefined && trameNode.heading !== "")) {
      head.appendChild(document.createTextNode(" – "));
      head.appendChild(region(`${node.path}.heading`, node.heading, { tag: "span", cls: "rw-inline" }));
    }
    sec.appendChild(head);
    // Les blocs d'un article se déplacent et se commentent ENTRE EUX, et chacun
    // porte ses outils (ajouter, retirer, options) : même enveloppe que dans le
    // corps du document et dans une division.
    for (const b of node.blocks || []) {
      const enveloppe = bloc(b, `${node.path}.blocks`);
      sec.appendChild(enveloppe);
      enveloppe.appendChild(renderBlock(b, trameNode));
      armerPrise(enveloppe, b, `${node.path}.blocks`);
    }
    return sec;
  }

  // Une division (Livre, Titre, Chapitre, Section…) : son intitulé se réécrit
  // comme celui d'un article, et son contenu se rend récursivement.
  function divisionEl(node, trameNode) {
    const niveau = Math.max(1, Number(node.level) || 1);
    const sec = h("section", { class: `doc-division doc-division--n${niveau}` });
    const head = h("h2", { class: "doc-division-head" });
    head.appendChild(h("span", { class: "doc-division-num", text: node.numLabel || node.levelLabel || "" }));
    if (node.heading || (trameNode?.heading !== undefined && trameNode.heading !== "")) {
      head.appendChild(document.createTextNode(" – "));
      head.appendChild(region(`${node.path}.heading`, node.heading, { tag: "span", cls: "rw-inline" }));
    }
    sec.appendChild(head);
    // Les blocs d'une division se déplacent ENTRE EUX : un article remonte avant
    // un autre, une sous-division passe en tête. C'est le même geste que dans le
    // corps du document.
    for (const b of node.blocks || []) {
      const enveloppe = bloc(b, `${node.path}.blocks`);
      sec.appendChild(enveloppe);
      enveloppe.appendChild(renderBlock(b, trameNode));
      armerPrise(enveloppe, b, `${node.path}.blocks`);
    }
    return sec;
  }
}

// Les commentaires de la trame, dans la page du rédacteur : chaque bloc commenté
// reçoit, JUSTE APRÈS lui, la bande des consignes qui le visent. Le rédacteur ne
// peut donc pas les manquer — c'est précisément ce qu'on reprochait à l'ancien
// dispositif, où les commentaires ne vivaient que dans l'inspecteur (voir
// ui/annotations.js).
function attacherConsignes(page, rx) {
  const byPath = notesByPath(rx.doc?.notes || []);
  for (const [path, notes] of byPath) {
    const host = page.querySelector(`[data-node="${cssEscape(path)}"]`);
    if (!host) continue;
    const strip = annotationStrip({
      notes,
      title: notes.length > 1 ? `${notes.length} consignes de la trame` : "Consigne de la trame",
      variant: "redaction",
    });
    if (strip) host.insertAdjacentElement("afterend", strip);
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

// Fait défiler jusqu'au bloc visé par un commentaire et le met en évidence.
export function focusNodeWidget(paper, path) {
  const el = paper.querySelector(`[data-node="${cssEscape(path)}"]`);
  if (!el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("annot-flash");
  setTimeout(() => el.classList.remove("annot-flash"), 1600);
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
