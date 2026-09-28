export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "html") node.innerHTML = v;
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v);
    else if (k === "dataset") Object.assign(node.dataset, v);
    else if (k === "on") for (const [ev, fn] of Object.entries(v)) node.addEventListener(ev, fn);
    // Raccourci `onClick`, `onChange`, `onInput`… : un attribut `on*` dont la
    // valeur est une fonction devient un vrai écouteur. Sans cette branche, un
    // `onClick` passé à `h()` finissait en attribut HTML `onclick` contenant le
    // source de la fonction — silencieusement inerte.
    else if (typeof v === "function" && /^on[A-Z]/.test(k)) node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "value") node.value = v;
    else if (k === "checked") node.checked = !!v;
    else node.setAttribute(k, v === true ? "" : v);
  }
  add(node, children);
  return node;
}

function add(node, children) {
  for (const c of children.flat(4)) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

export const frag = (...children) => {
  const f = document.createDocumentFragment();
  add(f, children);
  return f;
};

// La boucle `removeChild` lève NotFoundError si un gestionnaire d'événement
// (un `blur`, typiquement) déplace des nœuds pendant qu'elle s'exécute — c'est
// exactement le message « Perhaps it was moved in a 'blur' event handler? ».
// `replaceChildren` effectue le retrait en une seule opération native, sans
// jamais exposer d'état intermédiaire au code JS.
export const clear = (node) => {
  if (!node) return node;
  if (typeof node.replaceChildren === "function") { node.replaceChildren(); return node; }
  while (node.firstChild && node.firstChild.parentNode === node) node.removeChild(node.firstChild);
  return node;
};

const ICONS = {
  plus: "M12 5v14M5 12h14",  trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13",
  copy: "M9 9h10v10H9zM5 15V5h10",
  up: "M12 19V5M5 12l7-7 7 7",
  down: "M12 5v14M5 12l7 7 7-7",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM4 12h2m12 0h2M12 4v2m0 12v2",
  doc: "M6 3h8l4 4v14H6zM14 3v4h4",
  check: "M4 12l5 5L20 6",
  warn: "M12 4l9 16H3zM12 10v4M12 17h.01",
  info: "M12 4a8 8 0 100 16 8 8 0 000-16zM12 11v5M12 8h.01",
  x: "M6 6l12 12M18 6L6 18",
  eye: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6",
  code: "M9 8l-4 4 4 4m6-8l4 4-4 4",
  note: "M4 4h16v12l-4 4H4zM8 9h8M8 13h5",
  lock: "M6 11V8a6 6 0 1112 0v3M5 11h14v10H5z",
  download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  upload: "M12 20V9M7 13l5-5 5 5M5 4h14",
  list: "M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01",
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  refresh: "M20 12a8 8 0 11-3-6M20 4v5h-5",
  palette: "M12 3a9 9 0 000 18h1.5a2 2 0 001.5-3.3 2 2 0 011.5-3.2H18a3 3 0 003-3A9 9 0 0012 3zM7.5 11.5h.01M10 7.5h.01M15 8h.01",
  // Crayon : modifier un commentaire (voir ui/annotations.js).
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  sun: "M12 7.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM12 2.5V5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3L7 7M17 17l1.7 1.7M18.7 5.3L17 7M7 17l-1.7 1.7",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  globe: "M12 3a9 9 0 100 18 9 9 0 000-18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  // Organigramme : une case en tête, trois en dessous. C'est l'écran des
  // délégations de signature (voir src/ui/views/delegations.js).
  org: "M9 3h6v4H9zM12 7v3M6 10h12M6 10v3M12 10v3M18 10v3M3.5 13h5v4h-5zM9.5 13h5v4h-5zM15.5 13h5v4h-5z",
  moon: "M20.5 14.6A8.5 8.5 0 019.4 3.5a7.6 7.6 0 1011.1 11.1z",
  // Bulle de conversation : les assistants (Plume et Publia) et leur réglage.
  bulle: "M4 4h16v11H10l-6 5V4z",
  // Punaise : épingler un acte au recueil public (voir views/actes.js).
  pin: "M8 3h8v2l-2 5h-4L8 5zM12 10v10",
  // Partager : une flèche qui sort d'un plateau. C'est « mettre à disposition »
  // une trame — la faire passer de l'atelier aux services (voir views/trames.js).
  partage: "M4 12v7h16v-7M12 3v11M8 6l4-4 4 4",
  // Enveloppe : les notifications par courriel (voir src/lib/courriel.js).
  mail: "M3 6h18v12H3zM3 7.5l9 6 9-6",
  // Boîte d'archive : l'export PDF/A, la forme normalisée pour la conservation
  // (voir ui/pdfa.js).
  archive: "M3 4h18v4H3zM5 8v12h14V8M10 12h4",
  // Trois points verticaux : le menu « ⋯ » qui range les gestes secondaires
  // d'une carte ou d'une ligne (voir components.js, `menuButton`). Ce dessin-là
  // porte son propre poids de trait (`w`, plus gras que le socle) : à la finesse
  // du socle, trois points isolés ne sont plus des points, mais un pointillé.
  dots: { d: "M12 5h.01M12 12h.01M12 19h.01", w: 3.6 },
  // Cloche : les notifications de l'en-tête (voir ui/collab.js).
  cloche: "M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6zM9.7 19a2.4 2.4 0 004.6 0",
  // Panneau de droite : un cadre séparé par un trait vertical, côté droit —
  // c'est le geste « ouvrir le panneau de la rédaction » (voir rediger.js). Le
  // dessin dit ce que le bouton fait : une barre apparaît à droite.
  panneau: "M4 5h16v14H4zM15 5v14",
};

export function icon(name, size = 16) {
  // Un dessin est soit un simple chemin (tracé au poids du socle), soit un
  // objet `{ d, w }` quand il a besoin de son propre poids de trait — trois
  // points isolés, par exemple, demandent plus gras qu'un cadre (voir `dots`).
  const dessin = ICONS[name] || ICONS.info;
  const d = typeof dessin === "string" ? dessin : dessin.d;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(typeof dessin === "string" ? 1.6 : (dessin.w || 1.6)));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  // Le nom de l'icône reste lisible dans le DOM : c'est ce qui permet de
  // l'éprouver (voir « l'en-tête tient sur une ligne », tests/parcours.mjs).
  svg.setAttribute("data-icon", name);
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  svg.appendChild(p);
  return svg;
}

export function button(label, opts = {}) {
  const { variant = "secondary", size = "", icon: ic, onClick, title, disabled, type = "button" } = opts;
  const b = h("button", {
    class: `fr-btn fr-btn--${variant}${size ? " fr-btn--" + size : ""}`,
    type, title, disabled,
    on: onClick ? { click: onClick } : {},
  }, ic ? icon(ic, size === "sm" ? 14 : 16) : null, label ? h("span", { text: label }) : null);
  return b;
}

export function badge(text, color = "info") {
  return h("span", { class: "fr-badge fr-badge--" + color, text });
}

export function alert(kind, title, content, opts = {}) {
  const map = { blocking: "error", error: "error", warning: "warning", info: "info", success: "success" };
  return h("div", { class: `fr-alert fr-alert--${map[kind] || "info"}`, role: "status" },
    h("p", { class: "fr-alert__title", text: title }),
    content ? (typeof content === "string" ? h("p", { text: content }) : content) : null,
    opts.actions || null);
}

// Deux fenêtres peuvent être ouvertes l'une par-dessus l'autre (la fiche d'une
// délégation, puis celle de sa sous-délégation) : chacune s'inscrit dans cette
// pile à l'ouverture, et seule celle du DESSUS répond à « Échap » — sans quoi
// appuyer une fois sur Échap refermerait aussi la fiche qu'on lisait.
const pileModales = [];

export function modal({ title, body, actions, wide = false, onClose }) {
  const overlay = h("div", { class: "fr-modal-overlay", on: { click: (e) => { if (e.target === overlay) close(); } } });
  const close = () => {
    const i = pileModales.indexOf(close);
    if (i >= 0) pileModales.splice(i, 1);
    overlay.remove();
    document.removeEventListener("keydown", onKey);
    onClose?.();
  };
  const onKey = (e) => { if (e.key === "Escape" && pileModales[pileModales.length - 1] === close) close(); };
  pileModales.push(close);
  document.addEventListener("keydown", onKey);
  const box = h("div", { class: "fr-modal" + (wide ? " fr-modal--wide" : ""), role: "dialog", "aria-modal": "true" },
    h("div", { class: "fr-modal__header" },
      h("h2", { class: "fr-modal__title", text: title }),
      h("button", { class: "fr-btn fr-btn--tertiary fr-btn--icon", "aria-label": "Fermer", on: { click: close } }, icon("x", 18)),
    ),
    h("div", { class: "fr-modal__body" }, typeof body === "string" ? h("p", { text: body }) : body),
    actions ? h("div", { class: "fr-modal__footer" }, actions(close)) : null,
  );
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  const first = box.querySelector("input,select,textarea,button");
  first?.focus();
  return { close, el: box };
}

// L'ÉTIQUETTE NOMME SON CHAMP. Le helper est le seul endroit où une étiquette
// est posée : c'est donc ici, une fois, que le lien se fait (NC-III-009). Trois
// cas, dans l'ordre :
//
//   • le contrôle est étiquetable (`input`, `select`, `textarea`) — cas courant —
//     il reçoit un identifiant (celui de l'appelant, sinon un identifiant
//     engendré) et l'étiquette le vise par `for` ;
//   • le contrôle est COMPOSITE — un conteneur qui empile plusieurs commandes
//     derrière une même étiquette (choix de police, côtés d'un encadré, couleur) —
//     un `<label for>` ne peut viser qu'un seul contrôle : l'étiquette porte donc
//     l'identifiant, et chaque commande interne la vise par `aria-labelledby` ;
//   • le conteneur ne porte que des boutons (choix multiples) : il devient un
//     groupe nommé par l'étiquette.
//
// Le texte d'aide est lié de la même façon (`aria-describedby`).
const CONTROLES = "input,select,textarea";
const estControle = (n) => !!n && n.nodeType === 1 && CONTROLES.includes(n.tagName.toLowerCase());

// Les identifiants ENGENDRÉS (quand l'appelant n'en donne pas) sont dérivés de
// l'étiquette — « Nom » → `champ-nom` — et non d'un compteur qui ne redescend
// jamais. La raison est précise : le curseur est retrouvé après un redessin par
// le CHEMIN du champ **et sa signature**, qui comprend son `id`
// (voir `src/ui/focus.js`). Un identifiant neuf à chaque rendu ferait échouer
// cette vérification, et la saisie perdrait le curseur à la première lettre.
// Deux champs du même nom se départagent par un suffixe, et le rendu repart à
// zéro (`remiseAZeroDesIdentifiants`, appelé au début de chaque rendu) : le même
// écran redessiné redonne donc toujours les mêmes identifiants.
let identifiantsEngendres = new Set();
export function remiseAZeroDesIdentifiants() { identifiantsEngendres = new Set(); }
const enLigne = (s) => String(s || "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
function identifiantEngendre(label) {
  const texte = typeof label === "string" ? label : (label && label.textContent) || "";
  const base = "champ-" + (enLigne(texte) || "sans-etiquette");
  let ident = base, n = 1;
  while (identifiantsEngendres.has(ident) || document.getElementById(ident)) ident = base + "-" + (++n);
  identifiantsEngendres.add(ident);
  return ident;
}

export function field(label, control, opts = {}) {
  const { help, error, required, id } = opts;
  const wrap = h("div", { class: "fr-field" + (error ? " fr-field--error" : "") });
  const ident = id || identifiantEngendre(label);
  const labelId = ident + "-label";
  const direct = estControle(control);
  if (label && direct && !control.id) control.id = ident;
  if (label) wrap.appendChild(h("label", {
    class: "fr-label", id: labelId, for: direct ? control.id : null,
  }, label, required ? h("span", { class: "fr-required", text: " *" }) : null));
  const aideId = help ? ident + "-aide" : null;
  if (help) wrap.appendChild(h("p", { class: "fr-hint", id: aideId, text: help }));
  wrap.appendChild(control);
  const errId = error ? ident + "-erreur" : null;
  if (error) wrap.appendChild(h("p", { class: "fr-error-text", id: errId, text: error }));
  if (label && !direct) {
    const cibles = [...control.querySelectorAll(CONTROLES)];
    for (const c of cibles) {
      const aSonPropreIntitule = c.id && [...control.querySelectorAll("label[for]")].some((l) => l.getAttribute("for") === c.id);
      if (!c.getAttribute("aria-label") && !c.getAttribute("aria-labelledby") && !c.closest("label") && !aSonPropreIntitule) {
        c.setAttribute("aria-labelledby", labelId);
      }
    }
    if (!cibles.length && control.tagName === "DIV") {
      control.setAttribute("role", "group");
      control.setAttribute("aria-labelledby", labelId);
    }
  }
  for (const c of (direct ? [control] : [...control.querySelectorAll(CONTROLES)])) {
    if (aideId && !c.getAttribute("aria-describedby")) c.setAttribute("aria-describedby", aideId);
    if (errId && !c.getAttribute("aria-describedby")) c.setAttribute("aria-describedby", errId);
  }
  return wrap;
}

export function tabs(items, activeId, onSelect) {
  const nav = h("div", { class: "fr-tabs", role: "tablist" });
  for (const it of items) {
    nav.appendChild(h("button", {
      class: "fr-tab" + (it.id === activeId ? " fr-tab--active" : ""),
      role: "tab", "aria-selected": it.id === activeId ? "true" : "false",
      on: { click: () => onSelect(it.id) },
    }, it.label, it.count != null ? h("span", { class: "fr-tab__count", text: String(it.count) }) : null));
  }
  return nav;
}

export function toast(message, kind = "info") {
  const t = h("div", { class: `fr-toast fr-toast--${kind}`, text: message });
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("is-visible"));
  setTimeout(() => { t.classList.remove("is-visible"); setTimeout(() => t.remove(), 300); }, 3200);
}

// Une option du `select` : soit une option simple (`{value, label}`), soit un
// groupe (`{label, options}`), rendu par un `<optgroup>` — c'est ainsi que la
// liste des polices se lit par familles.
export function select(options, value, onChange, opts = {}) {
  const s = h("select", { class: "fr-select", on: { change: (e) => onChange(e.target.value) } });
  const optionEl = (o) => {
    const opt = h("option", { value: o.value, text: o.label });
    if (String(o.value) === String(value ?? "")) opt.selected = true;
    return opt;
  };
  for (const o of options) {
    if (Array.isArray(o.options)) {
      const g = h("optgroup", { label: o.label });
      for (const oo of o.options) g.appendChild(optionEl(oo));
      s.appendChild(g);
    } else {
      s.appendChild(optionEl(o));
    }
  }
  if (opts.multiple) s.multiple = true;
  return s;
}

export function textInput(value, onChange, opts = {}) {
  return h("input", {
    class: "fr-input", type: opts.type || "text", value: value ?? "",
    placeholder: opts.placeholder || "", spellcheck: "true",
    on: {
      input: opts.debounce === false ? (e) => onChange(e.target.value) : (e) => debounceInput(e.target, onChange),
      keydown: opts.onKeydown,
    },
  });
}

function debounceInput(target, fn) {
  clearTimeout(target.__t);
  target.__t = setTimeout(() => fn(target.value), 220);
}

// Ajuste une feuille A4 (21 cm) à la largeur disponible, sans jamais agrandir.
// `transform-origin: top left` : quand la feuille est réduite, elle se cale à
// gauche du panneau (avec la marge intérieure de celui-ci) au lieu de déborder
// d'un côté — le `margin: 0 auto` ne peut rien centrer d'un élément plus large
// que son conteneur.
export function fitPaper(canvas, paper) {
  const avail = canvas.clientWidth - 40;
  const w = paper.offsetWidth || 794;
  if (!w) return;
  const scale = Math.min(1, avail / w);
  paper.style.transform = scale < 1 ? `scale(${scale})` : "";
  paper.style.transformOrigin = "top left";
  paper.style.marginBottom = scale < 1 ? `${Math.round((scale - 1) * paper.offsetHeight)}px` : "";
}
