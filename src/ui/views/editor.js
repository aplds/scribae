import { state, touch, navigate, redrawView, parapheurActif } from "../state.js";
import { h, clear, button, icon, toast, modal, badge, textInput, fitPaper } from "../dom.js";
import { NODE_TYPES, NODE_MAP, FIELD_TYPES, NOTE_KINDS, RULE_LEVELS, newNode, newField, newRule, newNote, tramePublishable } from "../../lib/schema.js";
import { compile, buildContext, interpolate, nextNumero } from "../../lib/compile.js";
import { renderDocument, applyPaper } from "../../lib/render.js";
import { stylesOf } from "../../lib/styles.js";
import { checkExpr, safeEval } from "../../lib/expr.js";
import { download, debounce, slug } from "../../lib/util.js";
import { glissable, deposable, moitie, rangeDans, insererAuRange } from "../dnd.js";
import { confirmDialog, promptDialog, sectionHeader, statusBadge, textField, selectField, choiceField, orgFields } from "../components.js";
import { targetLabel, authorLabel } from "../../lib/scope.js";
import { helpLink } from "../components.js";
import { exportAkn, exportSchematron, exportJsonLd, exportMarkdown } from "../../lib/export.js";
import { circuitFor } from "../../lib/validation.js";
import { DISPENSES } from "../../lib/execution.js";
import { ecartsOfActe } from "./modifier.js";
import { fonctionsDeSignature, libelleFonction, champFonction, fonctionParCle } from "../../lib/fonctions.js";

// ------------------------------------------------------------------ helpers
const pathParts = (path) => String(path || "").split(".").filter(Boolean);

// Auteur d'une contribution à une trame (commentaire, règle) : c'est le
// **service** du compte connecté — jamais la personne qui a tapé le texte.
// Voir `authorLabel` (src/lib/scope.js).
const authorOf = () => authorLabel(state.config, state.user) || "Service";
const todayIso = () => new Date().toISOString().slice(0, 10);

function listAt(trame, path) {
  const parts = pathParts(path);
  const last = parts.pop();
  let arr = trame;
  for (const p of parts) arr = arr[/^\d+$/.test(p) ? Number(p) : p];
  if (!Array.isArray(arr)) return null;
  return { list: arr, index: Number(last) };
}

export function nodeAt(trame, path) {
  const parts = pathParts(path);
  let cur = trame;
  for (const p of parts) {
    if (cur == null) return null;
    cur = cur[/^\d+$/.test(p) ? Number(p) : p];
  }
  return cur;
}

function parentPath(path) {
  const parts = pathParts(path);
  parts.pop();
  return parts.join(".");
}

function nodeTitle(node, config, counter) {
  if (!node) return "";
  switch (node.type) {
    case "title": return "Intitulé";
    case "authority": return "Autorité";
    case "visas": return `Visas (${(node.items || []).length})`;
    case "considerants": return `Considérants (${(node.items || []).length})`;
    case "enact": return "Formule d'édiction";
    case "article": return `Article ${node.numMode === "auto" ? (counter ?? "") : (node.num || "?")}${node.heading ? " — " + node.heading : ""}`;
    case "para": return (node.text || "").slice(0, 40) || "Paragraphe vide";
    case "list": return `Liste ${node.ordered ? "numérotée" : "à puces"} (${(node.items || []).length})`;
    case "table": return "Tableau";
    case "signature": return "Signature";
    case "mention": return "Mention";
    case "raw": return "Bloc libre";
    default: return node.type;
  }
}

// -------------------------------------------------------- texte à jetons
function chipEl(token, config, fields) {
  const inner = token.replace(/^\{\{|\}\}$/g, "");
  const expr = inner.split("|")[0].trim();
  const base = expr.split(/[.\s(]/)[0];
  const known = ["entity", "org", "signataire", "config", "today"].includes(base)
    || (fields || []).some((f) => f.id === base)
    || /^['"\d]/.test(expr);
  const span = h("span", { class: "chip" + (known ? "" : " chip--missing"), "data-token": token, "data-expr": inner, title: inner, contenteditable: "false" }, inner);
  return span;
}

export function textToNodes(text, config, fields) {
  const frag = document.createDocumentFragment();
  const re = /\{\{[\s\S]*?\}\}/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    frag.appendChild(chipEl(m[0], config, fields));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
  return frag;
}

export function serializeEditable(el) {
  let out = "";
  for (const n of el.childNodes) {
    if (n.nodeType === 3) out += n.data;
    else if (n.nodeType === 1) {
      if (n.classList?.contains("chip")) out += n.dataset.token;
      else if (n.tagName === "BR") out += "\n";
      else out += serializeEditable(n);
    }
  }
  return out;
}

function insertToken(el, token) {
  // textarea / input : insertion au niveau du curseur, en texte
  if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    el.value = el.value.slice(0, start) + token + el.value.slice(end);
    el.selectionStart = el.selectionEnd = start + token.length;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.focus();
    return;
  }
  // zone éditable : insertion d'une pastille non éditable
  el.focus();
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const chip = chipEl(token, state.config, []);
  range.insertNode(chip);
  range.setStartAfter(chip);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// Un re-rendu sur blur est nécessaire pour normaliser les jetons, mais il ne doit
// pas voler le focus quand l'utilisateur passe simplement d'un contrôle à un autre.
export function blurGuard(redraw) {
  return (ev) => {
    const to = ev.relatedTarget;
    if (to && to.closest && (to.closest(".editor") || to.closest(".fr-modal-overlay"))) return;
    redraw();
  };
}

// ============================================================================
// Éléments insérables — la « réserve » de l'éditeur.
//
// Le public visé rédige des actes, il ne programme pas : insérer un champ ne
// doit pas demander de choisir un identifiant technique dans une liste
// déroulante. On GLISSE donc l'élément voulu dans le texte — ou on le clique,
// puis on clique à l'endroit voulu. Deux gestes, aucun vocabulaire.
// ============================================================================

// Informations que l'application remplit seule (elles viennent du référentiel et
// de l'acte en cours de rédaction) : elles ne font pas partie du formulaire.
export const AUTO_TOKENS = [
  { token: "entity.name", label: "Nom de la collectivité" },
  { token: "entity.seatCity", label: "Ville du siège" },
  { token: "entity.code", label: "Code de l'entité" },
  { token: "signataire.fonction", label: "Fonction du signataire" },
  { token: "signataire.qualite", label: "Qualité du signataire (accordée en genre)" },
  { token: "signataire.autorite.qualiteArticleMaj", label: "L'autorité, avec article (« Le maire » / « La maire »)" },
  { token: "signataire.civility", label: "Civilité du signataire" },
  { token: "signataire.firstName", label: "Prénom du signataire" },
  { token: "signataire.lastName", label: "Nom du signataire" },
  { token: "numero", label: "Numéro de l'acte" },
  { token: "dateSignature|date-long", label: "Date de signature, en toutes lettres" },
];

// Libellés d'usage des types de champ : le vocabulaire du schéma (« Choix
// unique », « Personne (référentiel) ») est celui du code, pas celui d'un
// rédacteur.
const TYPE_LABELS = {
  text: "Une ligne de texte",
  textarea: "Un paragraphe",
  date: "Une date",
  choice: "Un choix unique",
  multichoice: "Plusieurs choix",
  boolean: "Oui / Non",
  number: "Un nombre",
  money: "Un montant",
  signataire: "Le signataire (par fonction)",
  person: "Une personne",
  entity: "Une entité",
  ref: "Une référence",
  reflist: "Plusieurs références",
};
const typeLabel = (t) => TYPE_LABELS[t] || FIELD_TYPES.find((x) => x.id === t)?.label || t;

// Le type d'un champ se choisit sur des cartes, jamais dans une liste
// déroulante : on reconnaît « Une date » ou « Un montant » à son dessin, et
// l'exemple lève le doute sans qu'on ait à connaître le vocabulaire du schéma.
const FIELD_ICON = {
  text: "doc", textarea: "note", date: "doc", choice: "list", multichoice: "list",
  boolean: "check", number: "doc", money: "doc", signataire: "lock", person: "info",
  entity: "lock", ref: "code", reflist: "list",
};
const FIELD_HINTS = {
  text: "Un mot ou une phrase — ex. « Objet de l'arrêté »",
  textarea: "Plusieurs phrases, sur plusieurs lignes — ex. « Motifs »",
  date: "Le calendrier s'ouvre à la saisie",
  choice: "Une seule réponse à choisir dans une liste que vous composez",
  multichoice: "Plusieurs réponses possibles dans une liste que vous composez",
  boolean: "Une case à cocher : oui ou non",
  number: "Un nombre — ex. « 12 »",
  money: "Un montant en euros — ex. « 1 500,00 € »",
  signataire: "On choisit la fonction, puis qui signe parmi ceux qui la tiennent",
  person: "Choisie dans l'annuaire (Administration › Personnes)",
  entity: "Choisie parmi les collectivités du référentiel",
  ref: "Un texte juridique du référentiel (loi, décret, arrêté…)",
  reflist: "Plusieurs textes juridiques du référentiel",
};

// La liste des types, dans l'ordre où un rédacteur les rencontre : le courant
// d'abord, ce qui vient du référentiel ensuite, derrière un filet.
const FIELD_ORDER = ["text", "textarea", "date", "choice", "multichoice", "boolean", "number", "money", "|", "signataire", "person", "entity", "ref", "reflist"];

function typeCards(f, softSave, redraw) {
  const grid = h("div", { class: "typecards" });
  for (const id of FIELD_ORDER) {
    if (id === "|") { grid.appendChild(h("span", { class: "typecards__sep", text: "Depuis le référentiel" })); continue; }
    const on = f.type === id;
    grid.appendChild(h("button", {
      type: "button", class: "typecard" + (on ? " is-on" : ""),
      onClick: () => { f.type = id; softSave(); redraw(); },
    },
      h("span", { class: "typecard__ic" }, icon(FIELD_ICON[id] || "doc", 15)),
      h("span", { class: "typecard__tx" },
        h("span", { class: "typecard__lb", text: typeLabel(id) }),
        h("span", { class: "typecard__hint", text: FIELD_HINTS[id] || "" })),
      on ? h("span", { class: "typecard__ok", text: "✓", "aria-label": "choisi" }) : null,
    ));
  }
  return h("div", { class: "fr-field" },
    h("label", { class: "fr-label", text: "Ce que l'agent doit saisir" }),
    h("p", { class: "fr-hint", text: "Cliquez la carte qui correspond. Elle décide de la façon dont la question se posera à celui qui rédige l'acte." }),
    grid);
}

// Les icônes du schéma (t, v, c…) n'existent pas dans le jeu d'icônes : on
// donne un dessin lisible à chaque type de bloc pour que la réserve se
// parcourt du regard, sans lire.
const NODE_ICON = {
  title: "doc", authority: "lock", visas: "list", considerants: "list", enact: "check",
  article: "doc", para: "note", list: "list", table: "grid", signature: "lock",
  mention: "info", raw: "code",
};

// Identifiant technique d'un champ, dérivé de son libellé : « Date de
// signature » → `date_de_signature`. L'utilisateur ne le voit jamais ; il sert
// au jeton {{…}} et doit rester unique dans la trame.
function idDeChamp(label, trame) {
  const base = slug(label).replace(/-/g, "_").replace(/^(\d)/, "champ_$1") || "champ";
  const pris = new Set((trame.fields || []).map((f) => f.id));
  let id = base, n = 2;
  while (pris.has(id)) id = base + "_" + n++;
  return id;
}

// Le geste de repli du glisser-déposer : on clique l'élément, puis on clique
// dans le texte. Le même clic deux fois désarme.
function armer(ed, redraw, charge) {
  const deja = ed.armed && ed.armed.token === charge.token && ed.armed.label === charge.label;
  ed.armed = deja ? null : charge;
  if (ed.armed && ed.panel === "outline") ed.panel = "doc";   // écran étroit : montrer le document
  redraw();
}

// Une puce de la réserve : glissable vers le document, cliquable pour armer.
function puce(kind, label, token, icone, onClick) {
  return glissable(
    h("button", { class: "puce", type: "button", title: label, on: { click: (e) => { e.preventDefault(); e.stopPropagation(); onClick?.(); } } },
      h("span", { class: "fr-icon" }, icon(icone || "doc", 13)),
      h("span", { class: "puce__label", text: label })),
    { kind, token, label },
  );
}

// Insère une pastille de champ à une position du document (dépôt, ou clic armé).
function insererDans(el, range, token, trame) {
  insererAuRange(el, range, chipEl(token, state.config, trame.fields));
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

// --- déplacement des blocs -------------------------------------------------
function listByPath(trame, listPath) {
  const parts = pathParts(listPath);
  let arr = trame;
  for (const p of parts) arr = arr[/^\d+$/.test(p) ? Number(p) : p];
  return Array.isArray(arr) ? arr : null;
}

// Range un bloc : de sa liste d'origine vers une autre, à une position donnée.
// Refuse un dépôt dans sa propre descendance (un article ne peut pas entrer dans
// ses propres paragraphes) — mais déplacer un bloc VERS LA RACINE, c'est-à-dire
// dans la liste qui le contient déjà, reste légitime.
function deplacerBloc(trame, fromPath, listPath, index, redraw) {
  if (!fromPath) return false;
  const from = listAt(trame, fromPath);
  const vers = listByPath(trame, listPath);
  if (!from || !vers) return false;
  if (listPath.startsWith(fromPath + ".")) return false;
  const [node] = from.list.splice(from.index, 1);
  let i = Number(index);
  if (from.list === vers && from.index < i) i -= 1;   // le retrait a décalé la cible
  vers.splice(Math.max(0, Math.min(i, vers.length)), 0, node);
  touch("trames", { rerender: false });
  redraw();
  return true;
}

// Dépôt sur un bloc (du plan ou du document) : le bloc déposé se range avant ou
// après celui qu'on vise, selon la moitié survolée — le geste habituel des
// listes.
function deposerSurBloc(charge, e, el, path, trame, ed, redraw) {
  const position = moitie(el, e);
  const parent = parentPath(path);
  const index = listAt(trame, path).index + (position === "apres" ? 1 : 0);
  if (charge.kind === "bloc") {
    insertAt(trame, parent, index, newNode(charge.type));
    touch("trames", { rerender: false });
    ed.selPath = parent + "." + index;
    ed.tab = "bloc";
    redraw();
  } else {
    deplacerBloc(trame, charge.path, parent, index, redraw);
  }
}

// Dépôt sur une barre « + » : le bloc prend exactement cette place.
function deposerSurBarre(charge, listPath, index, trame, ed, redraw) {
  if (charge.kind === "bloc") {
    insertAt(trame, listPath, index, newNode(charge.type));
    touch("trames", { rerender: false });
    ed.selPath = listPath + "." + index;
    ed.tab = "bloc";
    redraw();
  } else {
    deplacerBloc(trame, charge.path, listPath, index, redraw);
  }
}

// Ajoute un bloc neuf après le bloc sélectionné : c'est le geste de repli du
// glisser-déposer, quand on préfère cliquer.
function ajouterBlocApresSelection(trame, ed, redraw, type) {
  const path = ed.selPath && nodeAt(trame, ed.selPath) ? ed.selPath : null;
  const listPath = path ? parentPath(path) : "body";
  const index = path ? listAt(trame, path).index + 1 : (trame.body || []).length;
  insertAt(trame, listPath, index, newNode(type));
  touch("trames", { rerender: false });
  ed.selPath = listPath + "." + index;
  ed.tab = "bloc";
  ed.armed = null;
  redraw();
}

// Crée un champ à la volée et l'arme pour l'insertion : « il me faut un montant
// ici » tient en deux gestes.
async function nouveauChamp(trame, ed, redraw) {
  const nom = await promptDialog("Nouveau champ", "Quel nom donner à ce champ dans le formulaire ? (ex. « Montant de la subvention »)");
  if (!nom || !String(nom).trim()) return;
  const f = newField({ id: idDeChamp(nom, trame), label: String(nom).trim(), type: "text", group: "", required: false });
  trame.fields = trame.fields || [];
  trame.fields.push(f);
  touch("trames", { rerender: false });
  ed.armed = { kind: "champ", token: "{{" + f.id + "}}", label: f.label };
  toast("Champ créé. Cliquez dans le document à l'endroit où l'insérer.");
  redraw();
}

// La réserve, sous le plan : les champs, les informations automatiques, les
// blocs. C'est de là que partent tous les glissers.
function paletteEl(trame, ed, redraw) {
  const boite = h("div", { class: "palette" });
  const groupe = (titre, aide, contenu) => boite.appendChild(h("div", { class: "palette__groupe" },
    h("span", { class: "palette__titre", text: titre }),
    aide ? h("p", { class: "palette__aide", text: aide }) : null,
    h("div", { class: "palette__puces" }, ...contenu),
  ));

  groupe("Vos champs", "Glissez un champ dans le texte — ou cliquez-le, puis cliquez dans le texte.",
    [
      ...(trame.fields || []).map((f) => puce("champ", f.label || f.id, "{{" + f.id + "}}", "doc",
        () => armer(ed, redraw, { kind: "champ", token: "{{" + f.id + "}}", label: f.label || f.id }))),
      h("button", { class: "puce puce--neuf", type: "button", title: "Créer un champ", on: { click: () => nouveauChamp(trame, ed, redraw) } },
        h("span", { class: "fr-icon" }, icon("plus", 13)),
        h("span", { class: "puce__label", text: "Créer un champ" })),
    ]);

  groupe("Rempli automatiquement", "La collectivité, le signataire, la date : l'application les connaît déjà.",
    AUTO_TOKENS.map((t) => puce("auto", t.label, "{{" + t.token + "}}", "check",
      () => armer(ed, redraw, { kind: "auto", token: "{{" + t.token + "}}", label: t.label }))));

  groupe("Ajouter un bloc", "Glissez un bloc dans le document, ou cliquez-le : il s'ajoute après le bloc sélectionné.",
    NODE_TYPES.map((t) => glissable(
      h("button", { class: "puce", type: "button", title: t.hint, on: { click: () => ajouterBlocApresSelection(trame, ed, redraw, t.id) } },
        h("span", { class: "fr-icon" }, icon(NODE_ICON[t.id] || "doc", 13)),
        h("span", { class: "puce__label", text: t.label })),
      { kind: "bloc", type: t.id, label: t.label },
    )));

  return boite;
}

// ------------------------------------------------------------------ éditeur
export function renderEditor(root, params) {
  const trame = state.trames.find((t) => t.id === params.id);
  if (!trame) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--error" },
      h("p", { class: "fr-alert__title", text: "Trame introuvable" }),
      button("Retour aux trames", { variant: "primary", onClick: () => navigate("trames") })));
    return;
  }
  const ed = (state.editor = state.editor && state.editor.trameId === trame.id
    ? state.editor
    : { trameId: trame.id, selPath: "body.0", tab: "bloc", mode: "edit", armed: null });

  const ctxSample = buildContext(state.config, { __entityId: state.config.entities?.[0]?.id }, { trame });

  // Passe par le rendu de vue partagé : différé (donc jamais déclenché depuis un
  // gestionnaire `blur` en pleine mutation du DOM) et coalescé.
  const redraw = () => redrawView();
  const softSave = () => touch("trames", { rerender: false });

  // ------------------------------------------------------------- en-tête
  root.appendChild(h("div", { class: "fr-row", style: { padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)" } },
    button("", { variant: "tertiary", icon: "x", title: "Retour", onClick: () => navigate("trames") }),
    h("div", { style: { flex: "1 1 auto", minWidth: "0" } },
      h("div", { class: "fr-row", style: { gap: "8px" } },
        h("strong", { text: trame.name }),
        statusBadge(trame.status),
        h("span", { class: "fr-badge", text: "v" + trame.version }),
      ),
      h("div", { class: "fr-small fr-muted", text: `${(trame.fields || []).length} champs · ${(trame.rules || []).length} règles · ${countNotes(trame)} commentaires` }),
    ),
    h("div", { class: "fr-row" },
      h("div", { class: "fr-choices" },
        h("button", { class: "fr-choice" + (ed.mode === "edit" ? " is-on" : ""), text: "Édition", onClick: () => { ed.mode = "edit"; redraw(); } }),
        h("button", { class: "fr-choice" + (ed.mode === "preview" ? " is-on" : ""), text: "Aperçu", onClick: () => { ed.mode = "preview"; redraw(); } }),
      ),
      button("Rédiger", { variant: "secondary", onClick: () => navigate("rediger/" + trame.id) }),
      helpLink("administrateurs", "Aide"),
      button("Exporter…", { variant: "primary", icon: "download", onClick: () => exportMenu(trame) }),
    ),
  ));

  // ------------------------------------------------------------- 3 volets
  const editor = h("div", { class: "editor" });
  const left = h("div", { class: "editor__col editor__col--left" });
  const center = h("div", { class: "editor__col" });
  const right = h("div", { class: "editor__col editor__col--right" });
  editor.append(left, center, right);
  root.appendChild(editor);

  // écran étroit : un panneau à la fois, choisi par onglets
  if (editor.clientWidth > 0 && editor.clientWidth < 900) {
    if (!["outline", "doc", "insp"].includes(ed.panel)) ed.panel = "doc";
    editor.classList.add("editor--narrow");
    const bar = h("div", { class: "fr-tabs", style: { padding: "0 10px", margin: "0" } });
    for (const [id, label] of [["outline", "Plan & champs"], ["doc", "Document"], ["insp", "Inspecteur"]]) {
      bar.appendChild(h("button", { class: "fr-tab" + (ed.panel === id ? " fr-tab--active" : ""), text: label, on: { click: () => { ed.panel = id; redraw(); } } }));
    }
    root.insertBefore(bar, editor);
    const map = { outline: left, doc: center, insp: right };
    for (const [id, el] of Object.entries(map)) el.classList.toggle("is-panel", id === ed.panel);
  }

  // ---- volet gauche : plan
  left.appendChild(h("div", { class: "editor__colhead" }, icon("list", 14), "Plan du document"));
  const outline = h("div", { class: "editor__scroll" });
  left.appendChild(outline);
  const outlineBox = h("div", { class: "outline" });
  outline.appendChild(outlineBox);
  let artCounter = 0;
  // Une ligne du plan : on la clique pour sélectionner, on la glisse pour
  // ranger le bloc ailleurs, et on y dépose un bloc pour le poser juste avant
  // ou juste après (selon la moitié survolée).
  const lignePlan = (node, path, label, sub) => {
    const item = h("button", {
      class: "outline__item" + (sub ? " outline__sub" : "") + (ed.selPath === path ? " is-active" : ""),
      on: { click: () => { ed.selPath = path; if (ed.tab !== "bloc") ed.tab = "bloc"; redraw(); } },
    }, h("span", { class: "fr-icon", style: sub ? { opacity: .5 } : null }, icon(NODE_ICON[node.type] || "doc", sub ? 12 : 14)),
       h("span", { class: "outline__label", text: label }));
    glissable(item, { kind: "deplacement", path, label }, { onDebut: (e) => e.dataTransfer.setDragImage(item, 24, 14) });
    deposable(item, {
      accepte: (c) => c.kind === "deplacement" || c.kind === "bloc",
      halo: (el, c, e) => { const m = moitie(el, e); el.classList.toggle("dnd-avant", m === "avant"); el.classList.toggle("dnd-apres", m === "apres"); },
      onDepot: (c, e) => deposerSurBloc(c, e, item, path, trame, ed, redraw),
    });
    return item;
  };
  (trame.body || []).forEach((node, i) => {
    const path = `body.${i}`;
    if (node.type === "article") artCounter++;
    outlineBox.appendChild(lignePlan(node, path, nodeTitle(node, state.config, artCounter), false));
    if (node.type === "article") {
      (node.blocks || []).forEach((b, j) => {
        outlineBox.appendChild(lignePlan(b, `${path}.blocks.${j}`, nodeTitle(b), true));
      });
    }
  });
  outline.appendChild(h("div", { style: { marginTop: "10px" } },
    button("Ajouter un bloc", { variant: "secondary", icon: "plus", size: "sm", onClick: (e) => addBlockMenu(e.currentTarget, trame, "body", (trame.body || []).length, redraw) })));

  // ---- la réserve : d'où partent les glissers (champs, blocs, informations
  // automatiques). Sous le plan, dans le même défilement.
  outline.appendChild(h("div", { class: "reserve" },
    h("div", { class: "editor__colhead editor__colhead--sub" }, icon("plus", 14), "Éléments à insérer"),
    paletteEl(trame, ed, redraw)));

  // ---- volet central : papier
  center.appendChild(h("div", { class: "editor__colhead" },
    icon("eye", 14),
    ed.mode === "edit" ? "Aperçu de la structure — cliquez un bloc, éditez le texte, insérez des champs" : "Aperçu compilé (valeurs de démonstration)",
    h("div", { class: "fr-spacer" }),
    ed.mode === "edit" ? button("Tout replier", { variant: "tertiary", size: "sm", onClick: redraw }) : null,
  ));
  // Insertion « armée » : un champ a été cliqué dans la réserve, il reste à
  // dire où il va. La consigne reste visible tant que le geste n'est pas fini.
  if (ed.armed) {
    center.appendChild(h("div", { class: "editor__arme" },
      h("span", { class: "fr-icon" }, icon("plus", 14)),
      h("span", { class: "editor__arme-txt", text: "Cliquez dans le document à l'endroit où insérer « " + ed.armed.label + " »" }),
      h("span", { class: "fr-spacer" }),
      button("Annuler", { variant: "tertiary", size: "sm", onClick: () => { ed.armed = null; redraw(); } })));
  }
  const canvas = h("div", { class: "canvas" });
  center.appendChild(canvas);
  const paper = h("div", { class: "paper" });
  paper.style.fontFamily = state.config.brand.documentFont || "";
  canvas.appendChild(paper);

  if (ed.mode === "preview") {
    const values = sampleValues(trame);
    const doc = compile(trame, values, state.config, { markMissing: true });
    applyPaper(paper, doc, state.config);
    paper.appendChild(renderDocument(doc, state.config, {}));
    if (doc.issues.length) {
      paper.appendChild(h("div", { style: { marginTop: "18px" } },
        h("p", { class: "fr-small fr-muted", text: "Contrôles sur ces valeurs de démonstration :" }),
        ...doc.issues.map((i) => h("div", { class: "fr-small", style: { color: i.level === "blocking" ? "var(--error)" : "var(--warning)" }, text: `• [${i.level}] ${i.message}` })),
      ));
    }
  } else {
    // La charte de la trame donne ses marges à la feuille, même en édition.
    applyPaper(paper, compile(trame, sampleValues(trame), state.config), state.config);
    renderEditableBody(paper, trame, ed, redraw, softSave, ctxSample);
  }
  requestAnimationFrame(() => fitPaper(canvas, paper));

  // ---- volet droit : inspecteur
  right.appendChild(h("div", { class: "editor__colhead" }, icon("gear", 14), "Inspecteur"));
  const tabs = h("div", { class: "fr-tabs", style: { padding: "0 8px" } });
  for (const [id, label] of [["bloc", "Ce bloc"], ["champs", "Questions"], ["regles", "Contrôles"], ["trame", "Trame"]]) {
    tabs.appendChild(h("button", { class: "fr-tab" + (ed.tab === id ? " fr-tab--active" : ""), text: label, on: { click: () => { ed.tab = id; redraw(); } } }));
  }
  right.appendChild(tabs);
  const inspector = h("div", { class: "editor__scroll", style: { padding: "0" } });
  right.appendChild(inspector);
  if (ed.tab === "bloc") renderBlockInspector(inspector, trame, ed, redraw, softSave, ctxSample);
  else if (ed.tab === "champs") renderFieldsInspector(inspector, trame, ed, redraw, softSave);
  else if (ed.tab === "regles") renderRulesInspector(inspector, trame, redraw, softSave, ctxSample);
  else renderTrameInspector(inspector, trame, redraw, softSave);
}

function countNotes(trame) {
  let n = 0;
  const walk = (nodes) => (nodes || []).forEach((x) => { n += (x.notes || []).length; walk(x.blocks); });
  walk(trame.body);
  return n;
}

function sampleValues(trame) {
  const values = { __entityId: state.config.entities?.[0]?.id };
  for (const f of trame.fields || []) {
    if (f.type === "date") values[f.id] = new Date().toISOString().slice(0, 10);
    else if (f.type === "person") values[f.id] = state.config.people?.[0]?.id || "";
    else if (f.type === "signataire") {
      // L'exemple montre le cas ordinaire : la fonction attendue par la trame
      // s'il y en a une, sinon la première fonction que quelqu'un peut tenir.
      const scope = { entityId: values.__entityId, familyId: trame.familyId || "", actTypeId: trame.actTypeId || "" };
      const choix = (f.qualite ? fonctionParCle(state.config, f.qualite, scope) : null)
        || fonctionsDeSignature(state.config, scope)[0] || null;
      values[f.id] = choix?.personnes?.[0]?.id || state.config.people?.[0]?.id || "";
      if (choix) values[champFonction(f.id)] = choix.key;
    }
    else if (f.type === "choice") values[f.id] = f.options?.[0] || "";
    else if (f.type === "multichoice") values[f.id] = (f.options || []).slice(0, 2);
    else if (f.type === "number" || f.type === "money") values[f.id] = 0;
    else values[f.id] = "…";
  }
  // Le numéro vient de la séquence locale. Quand la collectivité le fait
  // attribuer par un service externe (Administration › Numérotation), l'exemple
  // garde le point de suspension des champs à compléter : c'est exactement ce
  // que verra le rédacteur avant de demander le numéro.
  values.numero = nextNumero(state.config, state.config.entities?.[0]) || "…";
  return values;
}

// --------------------------------------------------- rendu éditable du corps
function renderEditableBody(paper, trame, ed, redraw, softSave, ctxSample) {
  // Barre « + » entre deux blocs : cliquable (choix du bloc dans une fenêtre) ET
  // cible de dépôt — le bloc glissé prend exactement cette place.
  const makeInsertBar = (container, listPath, index) => deposable(
    h("div", { class: "insert-bar" },
      h("button", { class: "insert-bar__btn", text: "+", title: "Ajouter un bloc ici", onClick: (e) => addBlockMenu(e.currentTarget, trame, listPath, index, redraw) }),
      h("span", { class: "insert-bar__hint", text: "déposer le bloc ici" })),
    {
      accepte: (c) => c.kind === "deplacement" || c.kind === "bloc",
      onDepot: (c) => deposerSurBarre(c, listPath, index, trame, ed, redraw),
    },
  );

  const renderNodes = (container, nodes, basePath, listPath) => {
    (nodes || []).forEach((node, i) => {
      container.appendChild(makeInsertBar(container, listPath, i));
      container.appendChild(renderBlock(node, `${basePath}.${i}`, ed, redraw, softSave, trame));
    });
    container.appendChild(makeInsertBar(container, listPath, (nodes || []).length));
  };

  // les blocs de niveau corps sont rendus dans l'ordre
  (trame.body || []).forEach((node, i) => {
    paper.appendChild(makeInsertBar(paper, "body", i));
    paper.appendChild(renderBlock(node, `body.${i}`, ed, redraw, softSave, trame));
  });
  paper.appendChild(makeInsertBar(paper, "body", (trame.body || []).length));
}

function renderBlock(node, path, ed, redraw, softSave, trame) {
  const selected = ed.selPath === path;
  const wrapper = h("div", {
    class: "blk" + (selected ? " blk--sel" : ""),
    "data-path": path,
    on: { click: (e) => { if (selected) return; ed.selPath = path; if (ed.tab !== "bloc") ed.tab = "bloc"; redraw(); } },
  });

  // Cible de dépôt : un bloc glissé (neuf, ou déplacé depuis le plan ou le
  // document) se range avant ou après celui-ci, selon la moitié survolée.
  deposable(wrapper, {
    accepte: (c) => c.kind === "deplacement" || c.kind === "bloc",
    halo: (el, c, e) => { const m = moitie(el, e); el.classList.toggle("dnd-avant", m === "avant"); el.classList.toggle("dnd-apres", m === "apres"); },
    onDepot: (c, e) => deposerSurBloc(c, e, wrapper, path, trame, ed, redraw),
  });

  // poignée de déplacement : c'est par elle qu'on saisit le bloc (la rendre
  // draggable sur tout le bloc empêcherait de sélectionner le texte à la souris)
  const poignee = glissable(
    h("span", { class: "blk__grip", title: "Glisser pour déplacer ce bloc", text: "⠿", "aria-hidden": "true" }),
    { kind: "deplacement", path, label: nodeTitle(node, state.config) },
    { onDebut: (e) => e.dataTransfer.setDragImage(wrapper, 30, 16) },
  );

  // barre d'outils du bloc
  const tools = h("div", { class: "blk__tools" },
    poignee,
    button("", { variant: "tertiary", icon: "up", title: "Monter", onClick: (e) => { e.stopPropagation(); moveNode(trame, path, -1, redraw); } }),
    button("", { variant: "tertiary", icon: "down", title: "Descendre", onClick: (e) => { e.stopPropagation(); moveNode(trame, path, 1, redraw); } }),
    button("", { variant: "tertiary", icon: "plus", title: "Ajouter", onClick: (e) => { e.stopPropagation(); addBlockMenu(e.currentTarget, trame, parentPath(path), listAt(trame, path).index + 1, redraw); } }),
    button("", { variant: "tertiary", icon: "trash", title: "Supprimer", onClick: async (e) => { e.stopPropagation(); const ok = await confirmDialog("Supprimer le bloc", "Ce bloc sera retiré de la trame.", { confirmLabel: "Supprimer", danger: true }); if (ok) { listAt(trame, path).list.splice(listAt(trame, path).index, 1); touch("trames", { rerender: false }); redraw(); } } }),
    (node.notes || []).length ? h("span", { class: "note-mark", title: (node.notes || []).map((n) => n.text).join(" | "), text: String(node.notes.length) }) : null,
  );
  wrapper.appendChild(tools);

  const editable = (cls, text, onInput) => {
    const el = h("div", { class: cls, contenteditable: "true", spellcheck: "true" });
    el.appendChild(textToNodes(text || "", state.config, trame.fields));
    el.addEventListener("input", () => onInput(serializeEditable(el)));
    el.addEventListener("blur", blurGuard(redraw));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey && node.type !== "list") { e.preventDefault(); el.blur(); } });
    // Un champ glissé depuis la réserve s'insère exactement là où on le lâche.
    deposable(el, {
      accepte: (c) => c.kind === "champ" || c.kind === "auto",
      onDepot: (c, e) => insererDans(el, rangeDans(el, e.clientX, e.clientY), c.token, trame),
    });
    // … et là où on clique, quand le champ a été cliqué dans la réserve.
    el.addEventListener("click", (e) => {
      if (!ed.armed) return;
      e.preventDefault();
      const token = ed.armed.token;
      ed.armed = null;
      insererDans(el, rangeDans(el, e.clientX, e.clientY), token, trame);
      redraw();
    });
    return el;
  };

  switch (node.type) {
    case "title":
      wrapper.appendChild(editable("doc-title", node.text, (v) => { node.text = v; softSave(); }));
      break;
    case "authority":
      wrapper.appendChild(editable("doc-authority", node.text, (v) => { node.text = v; softSave(); }));
      break;
    case "enact":
      wrapper.appendChild(editable("doc-enact", node.text, (v) => { node.text = v; softSave(); }));
      break;
    case "visas": {
      const ul = h("ul", { class: "doc-visas" });
      (node.items || []).forEach((it, i) => {
        const li = h("li", { style: { display: "flex", gap: "6px", alignItems: "flex-start" } });
        const label = resolveVisa(it, state.config, trame);
        const span = h("span", { style: { flex: "1 1 auto", textAlign: "justify" } },
          (state.config.vocab.visasLabel || "Vu") + " ",
          label ? h("span", { text: label + (it.when ? " " : "") }) : h("span", { class: "chip chip--missing", text: "référence non résolue" }),
          it.when ? h("span", { class: "fr-badge fr-badge--warning", style: { marginLeft: "6px" }, text: "si " + it.when }) : null,
        );
        li.appendChild(span);
        if (it.when) li.appendChild(h("span", { class: "fr-icon fr-muted", title: it.when }, icon("info", 12)));
        ul.appendChild(li);
      });
      wrapper.appendChild(ul);
      break;
    }
    case "considerants": case "list": {
      const box = node.type === "considerants" ? h("div", { class: "doc-recitals" }) : h(node.ordered ? "ol" : "ul", { class: "doc-list" });
      (node.items || []).forEach((it) => {
        if (node.type === "considerants") {
          const el = h("p", { class: "doc-p" });
          el.appendChild(editable("", it.text, (v) => { it.text = v; softSave(); }));
          if (it.when) el.appendChild(h("span", { class: "fr-badge fr-badge--warning", style: { marginLeft: "6px" }, text: "si " + it.when }));
          box.appendChild(el);
        } else {
          const el = h("li");
          el.appendChild(editable("", it.text, (v) => { it.text = v; softSave(); }));
          if (it.when) el.appendChild(h("span", { class: "fr-badge fr-badge--warning", style: { marginLeft: "6px" }, text: "si " + it.when }));
          box.appendChild(el);
        }
      });
      wrapper.appendChild(box);
      break;
    }
    case "article": {
      const sec = h("section", { class: "doc-article" });
      const head = h("h2", { class: "doc-article-head" },
        h("span", { class: "doc-article-num", text: node.numMode === "auto" ? "(numérotation automatique)" : node.num }),
        node.heading ? h("span", { text: " — " + node.heading }) : null);
      sec.appendChild(head);
      const sub = h("div");
      (node.blocks || []).forEach((b, j) => {
        sub.appendChild(h("div", { class: "insert-bar" }, h("button", { class: "insert-bar__btn", text: "+", onClick: (e) => { e.stopPropagation(); addBlockMenu(e.currentTarget, trame, `${path}.blocks`, j, redraw); } })));
        sub.appendChild(renderBlock(b, `${path}.blocks.${j}`, ed, redraw, softSave, trame));
      });
      sub.appendChild(h("div", { class: "insert-bar" }, h("button", { class: "insert-bar__btn", text: "+", onClick: (e) => { e.stopPropagation(); addBlockMenu(e.currentTarget, trame, `${path}.blocks`, (node.blocks || []).length, redraw); } })));
      sec.appendChild(sub);
      wrapper.appendChild(sec);
      break;
    }
    case "table": {
      wrapper.appendChild(h("div", { class: "doc-table-wrap" },
        node.caption ? h("p", { class: "doc-table-caption", text: node.caption }) : null,
        (() => {
          const t = h("table", { class: "doc-table" });
          const trh = h("tr");
          for (const c of node.columns || []) trh.appendChild(h("th", { text: String(c).split("|")[0] }));
          t.appendChild(h("thead", {}, trh));
          const tb = h("tbody");
          for (const r of node.rows || []) {
            const tr = h("tr");
            for (let i = 0; i < (node.columns || []).length; i++) tr.appendChild(h("td", { text: r[i] ?? "" }));
            tb.appendChild(tr);
          }
          t.appendChild(tb);
          return t;
        })(),
      ));
      break;
    }
    case "signature": {
      const withChips = (tag, cls, text) => {
        const el = h(tag, { class: cls });
        el.appendChild(textToNodes(text, state.config, trame.fields));
        return el;
      };
      const place = h("p", { class: "doc-signature-place" });
      place.appendChild(document.createTextNode("Fait à "));
      place.appendChild(textToNodes(node.place || "{{entity.seatCity}}", state.config, trame.fields));
      place.appendChild(document.createTextNode(", le "));
      place.appendChild(textToNodes("{{dateSignature|date-long}}", state.config, trame.fields));
      wrapper.appendChild(h("div", { class: "doc-signature" },
        h("div", {}, place),
        h("div", { class: "doc-signature-block" },
          node.showFunction !== false ? withChips("p", "doc-signature-role", "{{signataire.fonction}}") : null,
          withChips("p", "doc-signature-name", "{{signataire.firstName}} {{signataire.lastName}}"),
        ),
      ));
      // La qualité s'accorde en genre et, si le signataire tient sa signature
      // d'une délégation, les étages intermédiaires s'ajoutent ici tout seuls.
      wrapper.appendChild(h("p", { class: "doc-signature-note fr-small fr-muted",
        text: "La qualité s'accorde selon le signataire (« Le maire » / « La maire »). S'il tient sa signature d'une délégation, les lignes « Par délégation, … » s'ajoutent ici automatiquement — voir l'écran Délégations." }));
      break;
    }
    case "mention": {
      const m = (state.config.mentions || []).find((x) => x.id === node.mentionId);
      wrapper.appendChild(h("p", { class: "doc-mention", text: node.textOverride || m?.text || "— mention non sélectionnée —" }));
      break;
    }
    default:
      wrapper.appendChild(editable("doc-p", node.text, (v) => { node.text = v; softSave(); }));
  }
  return wrapper;
}

function resolveVisa(it, config, trame) {
  if (it.text) return it.text;
  if (it.refKind) {
    const r = (config.refs || []).find((x) => x.kind === it.refKind && x.entityId === config.entities?.[0]?.id)
      || (config.refs || []).find((x) => x.kind === it.refKind);
    return r ? r.label : "";
  }
  if (it.refId) return (config.refs || []).find((x) => x.id === it.refId)?.label || "";
  return "";
}

// ---------------------------------------------------------- menus / actions
function addBlockMenu(anchor, trame, listPath, index, redraw) {
  const box = h("div", { class: "fr-modal-overlay", on: { click: (e) => { if (e.target === box) box.remove(); } } });
  const inner = h("div", { class: "fr-modal", style: { width: "min(460px,100%)" } },
    h("div", { class: "fr-modal__header" }, h("h2", { class: "fr-modal__title", text: "Ajouter un bloc" })),
    h("div", { class: "fr-modal__body fr-stack" },
      ...NODE_TYPES.map((t) => h("button", {
        class: "fr-btn fr-btn--secondary", style: { justifyContent: "flex-start" },
        onClick: () => {
          insertAt(trame, listPath, index, newNode(t.id));
          touch("trames", { rerender: false });
          box.remove();
          redraw();
        },
      }, h("span", { class: "fr-icon" }, icon(t.icon || "doc", 15)), h("span", { text: t.label }), h("span", { class: "fr-spacer" }), h("span", { class: "fr-small fr-muted", text: t.hint }))),
    ),
  );
  box.appendChild(inner);
  document.body.appendChild(box);
}

export function insertAt(trame, listPath, index, node) {
  const parts = pathParts(listPath);
  let arr = trame;
  for (const p of parts) arr = arr[/^\d+$/.test(p) ? Number(p) : p];
  if (!Array.isArray(arr)) return false;
  arr.splice(index, 0, node);
  return true;
}

function moveNode(trame, path, dir, redraw) {
  const { list, index } = listAt(trame, path);
  const to = index + dir;
  if (to < 0 || to >= list.length) return;
  const [n] = list.splice(index, 1);
  list.splice(to, 0, n);
  touch("trames", { rerender: false });
  redraw();
}

// Rafraîchit le papier après une édition faite depuis l'inspecteur, sans
// reconstruire tout l'éditeur (le focus reste où il est).
function refreshPaperNow(trame, ed, redraw, softSave, ctxSample) {
  const paper = document.querySelector(".paper");
  if (!paper) return;
  clear(paper);
  renderEditableBody(paper, trame, ed, redraw, softSave, ctxSample);
}
const refreshPaper = debounce((trame, ed, redraw, softSave, ctxSample) => refreshPaperNow(trame, ed, redraw, softSave, ctxSample), 260);

// -------------------------------------------------------------- inspecteur
function renderBlockInspector(root, trame, ed, redraw, softSave, ctxSample) {
  const node = nodeAt(trame, ed.selPath);
  if (!node) {
    root.appendChild(h("div", { class: "inspector__section" }, h("p", { class: "fr-muted", text: "Sélectionnez un bloc dans le plan ou dans le document." })));
    return;
  }
  const sec = (children) => h("div", { class: "inspector__section" }, ...children);
  root.appendChild(sec([
    h("span", { class: "inspector__label", text: "Bloc · " + (NODE_MAP[node.type]?.label || node.type) }),
    h("p", { class: "fr-small fr-muted", text: NODE_MAP[node.type]?.hint || "" }),
  ]));

  // contenu selon le type
  if (["title", "authority", "enact", "para", "raw"].includes(node.type)) {
    const ta = h("textarea", { class: "fr-textarea", rows: 4 });
    ta.value = node.text || "";
    ta.addEventListener("input", () => { node.text = ta.value; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); });
    ta.addEventListener("blur", blurGuard(redraw));
    root.appendChild(sec([
      h("span", { class: "inspector__label", text: "Texte" }),
      ta,
      h("p", { class: "palette__aide", text: "Pour insérer un champ : cliquez-le ci-dessous (il s'ajoute au curseur) — ou glissez-le dans le document." }),
      h("div", { class: "palette__puces" }, ...pucesChamps(trame, (tok) => { insertToken(ta, tok); node.text = ta.value; softSave(); })),
    ]));
  }

  if (node.type === "article") {
    root.appendChild(sec([
      h("span", { class: "inspector__label", text: "Numérotation" }),
      choiceField({
        label: "", value: node.numMode || "auto", options: [{ value: "auto", label: "Automatique" }, { value: "fixed", label: "Manuelle" }],
        onChange: (v) => { node.numMode = v; softSave(); redraw(); },
      }),
      node.numMode === "fixed" ? textField({ label: "Texte du numéro", value: node.num, onChange: (v) => { node.num = v; softSave(); } }) : null,
      textField({ label: "Intitulé de l'article", value: node.heading || "", onChange: (v) => { node.heading = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); } }),
    ]));
  }

  if (node.type === "visas") {
    root.appendChild(sec([
      sectionHeader("Visas", button("Ajouter", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { node.items = node.items || []; node.items.push({ id: "it-" + Math.random().toString(36).slice(2, 7), refId: "", text: "", when: "" }); touch("trames", { rerender: false }); redraw(); } })),
      ...(node.items || []).map((it, i) => visaItemEditor(it, i, node, trame, redraw, softSave)),
    ]));
  }

  if (node.type === "list") {
    root.appendChild(sec([
      h("span", { class: "inspector__label", text: "Type de liste" }),
      choiceField({
        label: "", value: !!node.ordered,
        options: [{ value: false, label: "À puces" }, { value: true, label: "Numérotée" }],
        onChange: (v) => { node.ordered = v; softSave(); redraw(); },
      }),
      h("p", { class: "palette__aide", text: "Le genre de la liste se choisit ici ; son apparence (la puce, la numérotation — 1°, a), i… —) se règle dans les Feuilles de style, rubrique « Listes »." }),
    ]));
  }

  if (node.type === "considerants" || node.type === "list") {
    root.appendChild(sec([
      sectionHeader("Éléments", button("Ajouter", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { node.items = node.items || []; node.items.push({ id: "it-" + Math.random().toString(36).slice(2, 7), text: node.type === "considerants" ? "Considérant que …" : "Nouvel élément", when: "" }); touch("trames", { rerender: false }); redraw(); } })),
      ...(node.items || []).map((it, i) => h("div", { class: "note-card", style: { borderLeftColor: "var(--border-strong)" } },
        h("div", { class: "fr-row" }, h("strong", { class: "fr-small", text: "#" + (i + 1) }), h("div", { class: "fr-spacer" }),
          button("", { variant: "tertiary", icon: "trash", size: "sm", onClick: () => { node.items.splice(i, 1); touch("trames", { rerender: false }); redraw(); } })),
        (() => { const ta = h("textarea", { class: "fr-textarea", rows: 3 }); ta.value = it.text || ""; ta.addEventListener("input", () => { it.text = ta.value; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); }); ta.addEventListener("blur", blurGuard(redraw)); return ta; })(),
        h("div", { style: { marginTop: "6px" } }, condInput(it, softSave, redraw)),
      )),
    ]));
  }

  if (node.type === "table") {
    root.appendChild(sec([
      textField({ label: "Titre du tableau", value: node.caption || "", onChange: (v) => { node.caption = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); } }),
      textField({ label: "Colonnes (une par ligne)", value: (node.columns || []).join("\n"), rows: 4, onChange: (v) => { node.columns = v.split("\n").map((s) => s.trim()).filter(Boolean); softSave(); } }),
      textField({ label: "Lignes (cellules séparées par |)", value: (node.rows || []).map((r) => r.join(" | ")).join("\n"), rows: 6, onChange: (v) => { node.rows = v.split("\n").filter((l) => l.trim()).map((l) => l.split("|").map((c) => c.trim())); softSave(); } }),
    ]));
  }

  if (node.type === "mention") {
    root.appendChild(sec([
      selectField({
        label: "Mention du référentiel", value: node.mentionId, placeholder: "— Sélectionner —",
        options: (state.config.mentions || []).map((m) => ({ value: m.id, label: m.label })),
        onChange: (v) => { node.mentionId = v; softSave(); redraw(); },
      }),
      textField({ label: "Surcharge (facultatif)", value: node.textOverride || "", rows: 4, onChange: (v) => { node.textOverride = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); } }),
    ]));
  }

  if (node.type === "signature") {
    root.appendChild(sec([
      textField({ label: "Lieu (jetons acceptés)", value: node.place || "", onChange: (v) => { node.place = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); } }),
    ]));
  }

  // condition d'affichage
  root.appendChild(sec([
    h("span", { class: "inspector__label", text: "Condition d'affichage (facultatif)" }),
    condInput(node, softSave, redraw),
    h("p", { class: "fr-small fr-muted", text: "Exemples : contains(perimetres, 'immobilier') · dateEffet == '' · entity.code == 'IAM'" }),
  ]));

  // commentaires
  root.appendChild(sec([
    sectionHeader("Commentaires", button("Ajouter", { variant: "secondary", size: "sm", icon: "note", onClick: () => { node.notes = node.notes || []; node.notes.push(newNote({ author: authorOf(), date: todayIso() })); touch("trames", { rerender: false }); redraw(); } })),
    h("p", { class: "fr-small fr-muted", text: `Administrateurs et éditeurs peuvent commenter. Un commentaire est signé du service de son auteur — ici : ${authorOf()}.` }),
    ...(node.notes || []).map((nt, i) => noteEditor(nt, i, node, redraw, softSave)),
    !(node.notes || []).length ? h("p", { class: "fr-small fr-muted", text: "Aucun commentaire. Les commentaires sont conservés dans l'acte et exportés (contrairement aux commentaires Word)." }) : null,
  ]));
}

// Les mêmes puces que la réserve, mais pour insérer au curseur d'une zone de
// saisie : le texte se règle aussi depuis l'inspecteur.
function pucesChamps(trame, onPick) {
  const liste = (trame.fields || []).map((f) => puce("champ", f.label || f.id, "{{" + f.id + "}}", "doc", () => onPick("{{" + f.id + "}}")));
  if (!liste.length) liste.push(h("span", { class: "palette__aide", text: "Aucun champ pour l'instant : créez-en un dans la réserve, à gauche." }));
  return [...liste, ...AUTO_TOKENS.map((t) => puce("auto", t.label, "{{" + t.token + "}}", "check", () => onPick("{{" + t.token + "}}")))];
}

// Range un champ dans la liste du formulaire (glisser par la poignée).
function rangerChamp(trame, de, vers, apres, redraw) {
  const l = trame.fields || [];
  if (de < 0 || de >= l.length) return;
  const [f] = l.splice(de, 1);
  let i = vers + (apres ? 1 : 0);
  if (de < i) i -= 1;
  l.splice(Math.max(0, Math.min(i, l.length)), 0, f);
  touch("trames", { rerender: false });
  redraw();
}

function condInput(holder, softSave, redraw) {
  const input = h("input", { class: "fr-input fr-mono", value: holder.when || "", placeholder: "ex. exists(dateFin)" });
  const status = h("span", { class: "fr-small fr-muted", text: "" });
  const update = () => {
    const v = input.value.trim();
    holder.when = v;
    if (!v) { status.textContent = "aucune condition : le bloc est toujours présent"; status.style.color = ""; }
    else { const c = checkExpr(v); status.textContent = c.ok ? "expression valide" : c.error; status.style.color = c.ok ? "var(--success)" : "var(--error)"; }
    softSave();
  };
  input.addEventListener("input", update);
  input.addEventListener("blur", blurGuard(redraw));
  update();
  return h("div", { class: "fr-field" }, input, status);
}

function visaItemEditor(it, i, node, trame, redraw, softSave) {
  const mode = it.chaine ? "chaine" : it.refKind ? "kind" : it.refId ? "ref" : it.text ? "text" : "empty";
  return h("div", { class: "note-card", style: { borderLeftColor: "var(--brand)" } },
    h("div", { class: "fr-row" },
      h("strong", { class: "fr-small", text: "Visa #" + (i + 1) }),
      h("div", { class: "fr-spacer" }),
      button("", { variant: "tertiary", icon: "up", size: "sm", onClick: () => { if (i > 0) { const [x] = node.items.splice(i, 1); node.items.splice(i - 1, 0, x); touch("trames", { rerender: false }); redraw(); } } }),
      button("", { variant: "tertiary", icon: "down", size: "sm", onClick: () => { if (i < node.items.length - 1) { const [x] = node.items.splice(i, 1); node.items.splice(i + 1, 0, x); touch("trames", { rerender: false }); redraw(); } } }),
      button("", { variant: "tertiary", icon: "trash", size: "sm", onClick: () => { node.items.splice(i, 1); touch("trames", { rerender: false }); redraw(); } }),
    ),
    choiceField({
      label: "D'où vient ce visa ?", value: mode,
      options: [
        { value: "ref", label: "Je le choisis dans le référentiel" },
        { value: "kind", label: "Automatique, selon l'entité signataire" },
        { value: "chaine", label: "Les décisions fondant la signature, étage par étage" },
        { value: "text", label: "Je tape le texte moi-même" },
      ],
      onChange: (v) => {
        it.refId = ""; it.refKind = ""; it.text = ""; it.chaine = false;
        if (v === "ref") it.refId = state.config.refs?.[0]?.id || "";
        if (v === "kind") { it.refKind = state.config.refs?.[0]?.kind || ""; it.refScope = "self"; }
        if (v === "chaine") it.chaine = true;
        touch("trames", { rerender: false }); redraw();
      },
    }),
    mode === "chaine" ? h("p", { class: "fr-hint", text: "Du sommet de la chaîne vers le signataire : la délibération qui donne son pouvoir à l'autorité, puis, à chaque étage, la décision de nomination et celle de délégation. Les décisions se renseignent dans Administration › Personnes (pouvoir de l'autorité) et l'écran Délégations." }) : null,
    mode === "ref" ? selectField({
      label: "Référence", value: it.refId,
      options: (state.config.refs || []).map((r) => ({ value: r.id, label: r.label.slice(0, 80) })),
      onChange: (v) => { it.refId = v; softSave(); redraw(); },
    }) : null,
    mode === "kind" ? selectField({
      label: "Nature", value: it.refKind,
      options: [...new Set((state.config.refs || []).map((r) => r.kind))].map((k) => ({ value: k, label: k })),
      onChange: (v) => { it.refKind = v; softSave(); redraw(); },
      help: "La référence de cette nature rattachée à l'entité signataire est retenue automatiquement.",
    }) : null,
    mode === "text" ? textField({ label: "Texte", value: it.text, onChange: (v) => { it.text = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); } }) : null,
    h("div", { style: { marginTop: "6px" } }, condInput(it, softSave, redraw)),
  );
}

function noteEditor(nt, i, node, redraw, softSave) {
  const kindSel = choiceField({
    label: "", value: nt.kind,
    options: NOTE_KINDS.map((k) => ({ value: k.id, label: k.label })),
    onChange: (v) => { nt.kind = v; softSave(); redraw(); },
  });
  const ta = h("textarea", { class: "fr-textarea", rows: 3 });
  ta.value = nt.text || "";
  ta.addEventListener("input", () => { nt.text = ta.value; softSave(); });
  ta.addEventListener("blur", blurGuard(redraw));
  const authorIn = h("div", {
    class: "fr-small fr-muted",
    style: { marginTop: "6px" },
    title: "L'auteur d'un commentaire est le service du compte connecté",
    text: "Auteur : " + (nt.author || "—") + (nt.date ? " · " + nt.date : ""),
  });
  return h("div", { class: "note-card note-card--" + (nt.kind || "info") },
    h("div", { class: "note-card__head" }, kindSel, h("div", { class: "fr-spacer" }),
      button("", { variant: "tertiary", icon: "trash", size: "sm", onClick: () => { node.notes.splice(i, 1); touch("trames", { rerender: false }); redraw(); } })),
    ta,
    h("div", { style: { marginTop: "6px" } }, authorIn),
  );
}

// Les fonctions qu'une trame peut attendre d'un champ « signataire » : les
// rôles, puis les délégations qui s'appliquent à cette trame (même famille,
// même type d'acte). Les entités ne filtrent pas : la trame peut valoir pour
// plusieurs organisations. Le libellé accorde la qualité au genre de la
// personne qui tient la fonction, pour ne pas lire un masculin générique.
function fonctionsAttendues(trame) {
  const catalogue = fonctionsDeSignature(state.config, {
    familyId: trame.familyId || "", actTypeId: trame.actTypeId || "", vides: true,
  });
  const option = (f) => {
    const p = f.personnes[0];
    const c = String(p?.civility || "").toLowerCase();
    const genre = p?.accord === "f" || c.startsWith("madame") || c.startsWith("mme") ? "f" : "m";
    return { value: f.key, label: libelleFonction(state.config, f, { genre }) };
  };
  const roles = catalogue.filter((f) => f.kind === "role").map(option);
  const delegations = catalogue.filter((f) => f.kind === "delegation").map(option);
  const groupes = [];
  if (roles.length) groupes.push({ label: "Fonctions (rôles)", options: roles });
  if (delegations.length) groupes.push({ label: "Par délégation de signature", options: delegations });
  return groupes;
}

function renderFieldsInspector(root, trame, ed, redraw, softSave) {
  // Quelles questions sont dépliées. L'état vit dans l'éditeur (et non dans le
  // DOM) parce que chaque réglage redessine l'inspecteur : sans lui, la carte
  // se refermerait au moment même où l'on choisit un type de champ.
  const ouverts = (ed.champsOuverts = ed.champsOuverts || new Set());

  root.appendChild(h("div", { class: "inspector__section" },
    sectionHeader("Vos questions", button("Ajouter", { variant: "secondary", size: "sm", icon: "plus", onClick: () => {
      const f = newField({ group: "", label: "Nouvelle question" });
      (trame.fields = trame.fields || []).push(f);
      ouverts.add(f.id);   // la question neuve s'ouvre : on la règle tout de suite
      touch("trames", { rerender: false });
      redraw();
    } })),
    h("p", { class: "fr-small fr-muted", text: "Chaque question est un champ à remplir : celui qui rédige l'acte y répondra. Elle se place ensuite dans le texte, à l'endroit voulu." }),
    h("p", { class: "fr-small fr-muted", text: "Cliquez une question pour la régler. Pour en changer l'ordre, attrapez sa poignée ⠿ et faites-la glisser." }),
  ));

  if (!(trame.fields || []).length) {
    root.appendChild(h("div", { class: "inspector__section" },
      h("p", { class: "fr-small fr-muted", text: "Aucune question pour l'instant. La première est souvent l'objet de l'acte ; ajoutez-la, puis glissez-la dans le titre." })));
    return;
  }

  (trame.fields || []).forEach((f, i) => {
    const poignee = glissable(
      h("span", { class: "blk__grip", title: "Glisser pour changer l'ordre des questions", text: "⠿", "aria-hidden": "true" }),
      { kind: "rangement", index: i, label: f.label || f.id },
    );
    const nom = h("span", { class: "fcard__nom", text: f.label || f.id });
    const det = h("details", { class: "fcard", open: ouverts.has(f.id) },
      h("summary", { class: "fcard__tete", title: "Régler cette question" },
        poignee,
        nom,
        f.required ? h("span", { class: "fr-badge fr-badge--info", text: "obligatoire" }) : null,
        h("span", { class: "fcard__type", text: typeLabel(f.type) }),
        h("span", { class: "fcard__chev" }, icon("down", 15)),
      ),
      h("div", { class: "fcard__corps" },
        textField({
          label: "Nom de la question", value: f.label,
          help: "Le libellé que lira l'agent. Il sert aussi à repérer le champ dans la réserve, à gauche.",
          onChange: (v) => { f.label = v; nom.textContent = v || f.id; softSave(); },
        }),
        typeCards(f, softSave, redraw),
        f.type === "signataire"
          ? selectField({
            label: "Fonction attendue",
            value: f.qualite || "",
            placeholder: "— Au choix de celui qui rédige —",
            options: fonctionsAttendues(trame),
            help: "La qualité qui donne compétence pour signer cet acte. Choisissez-la ici pour la fixer dans le modèle : le rédacteur ne fera plus que désigner, parmi les personnes qui la tiennent, celle qui signe. Laissez vide pour le laisser choisir la fonction lui-même.",
            onChange: (v) => { f.qualite = v; softSave(); redraw(); },
          })
          : null,
        ["choice", "multichoice"].includes(f.type)
          ? textField({ label: "Valeurs proposées (une par ligne)", value: (f.options || []).join("\n"), rows: 4, help: "Exemple :\nOui\nNon\nSans objet", onChange: (v) => { f.options = v.split("\n").map((s) => s.trim()).filter(Boolean); softSave(); } })
          : null,
        // Placer le champ dans le texte : le même geste que depuis la réserve,
        // mais au contact de la question — c'est là qu'on y pense.
        h("div", { class: "champ__placer" },
          h("span", { class: "inspector__label", text: "Placer ce champ dans le document" }),
          h("div", { class: "fr-row" },
            puce("champ", f.label || f.id, "{{" + f.id + "}}", "doc",
              () => armer(ed, redraw, { kind: "champ", token: "{{" + f.id + "}}", label: f.label || f.id })),
            h("span", { class: "fr-small fr-muted", style: { flex: "1 1 auto" }, text: "Glissez-le dans le texte — ou cliquez-le, puis cliquez à l'endroit voulu." }),
          ),
        ),
        // Les réglages techniques ne concernent pas l'agent qui rédige la trame :
        // ils restent là, mais repliés.
        h("details", { class: "inspector__plus" },
          h("summary", { text: "Réglages avancés" }),
          textField({ label: "Aide affichée sous le champ", value: f.help || "", onChange: (v) => { f.help = v; softSave(); } }),
          h("label", { class: "fr-check" }, (() => { const c = h("input", { type: "checkbox", checked: f.required }); c.addEventListener("change", () => { f.required = c.checked; softSave(); redraw(); }); return c; })(), "Réponse obligatoire"),
          textField({ label: "Groupe de questions", value: f.group || "", onChange: (v) => { f.group = v; softSave(); } }),
          textField({ label: "Identifiant technique (jeton)", value: f.id, onChange: (v) => { f.id = v.replace(/[^\w]/g, "_"); softSave(); } }),
          textField({ label: "N'afficher que si…", value: f.appliesWhen || "", onChange: (v) => { f.appliesWhen = v; softSave(); } }),
        ),
        h("div", { class: "fcard__pied" },
          f.group ? h("span", { class: "fr-small fr-muted", text: "Groupe : " + f.group }) : null,
          h("div", { class: "fr-spacer" }),
          button("Supprimer cette question", { variant: "tertiary", icon: "trash", size: "sm", onClick: () => { trame.fields.splice(i, 1); ouverts.delete(f.id); touch("trames", { rerender: false }); redraw(); } }),
        ),
      ),
    );
    det.addEventListener("toggle", () => { if (det.open) ouverts.add(f.id); else ouverts.delete(f.id); });
    deposable(det, {
      accepte: (c) => c.kind === "rangement",
      halo: (el, c, e) => { const m = moitie(el, e); el.classList.toggle("dnd-avant", m === "avant"); el.classList.toggle("dnd-apres", m === "apres"); },
      onDepot: (c, e) => rangerChamp(trame, c.index, i, moitie(det, e) === "apres", redraw),
    });
    root.appendChild(det);
  });
}

function renderRulesInspector(root, trame, redraw, softSave, ctx) {
  root.appendChild(h("div", { class: "inspector__section" },
    sectionHeader("Règles", button("Ajouter", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { (trame.rules = trame.rules || []).push(newRule({ author: authorOf(), date: todayIso() })); touch("trames", { rerender: false }); redraw(); } })),
    h("p", { class: "fr-small fr-muted", text: "Les règles bloquantes interdisent l'export ; les avertissements signalent sans bloquer. Elles sont aussi exportées en Schematron." }),
  ));
  (trame.rules || []).forEach((r, i) => {
    const test = safeEval(r.expr, ctx);
    root.appendChild(h("div", { class: "rule-card rule-card--" + (r.level || "info") },
      h("div", { class: "fr-row" },
        choiceField({
          label: "", value: r.level,
          options: RULE_LEVELS.map((l) => ({ value: l.id, label: l.label })),
          onChange: (v) => { r.level = v; softSave(); redraw(); },
        }),
        h("div", { class: "fr-spacer" }),
        button("", { variant: "tertiary", icon: "trash", size: "sm", onClick: () => { trame.rules.splice(i, 1); touch("trames", { rerender: false }); redraw(); } }),
      ),
      h("div", { style: { marginTop: "6px" } },
        textField({ label: "Message", value: r.message, onChange: (v) => { r.message = v; softSave(); } }),
        (() => { const ta = h("textarea", { class: "fr-textarea fr-mono", rows: 2 }); ta.value = r.expr || ""; ta.addEventListener("input", () => { r.expr = ta.value; softSave(); }); ta.addEventListener("blur", redraw); return ta; })(),
        h("div", { class: "fr-row" },
          h("span", { class: "fr-small", text: test.ok ? (test.value ? "✓ vérifiée sur le contexte courant" : "✗ non vérifiée sur le contexte courant (normal si des champs sont vides)") : "⚠ " + test.error }),
        ),
        h("div", { class: "fr-row" },
          h("div", { class: "fr-small fr-muted", style: { flex: "1 1 auto" }, title: "L'auteur d'une règle est le service du compte connecté", text: "Auteur : " + (r.author || "—") }),
          textField({ label: "Référence", value: r.ref || "", onChange: (v) => { r.ref = v; softSave(); } }),
        ),
      ),
    ));
  });
}

function renderTrameInspector(root, trame, redraw, softSave) {
  root.appendChild(h("div", { class: "inspector__section" },
    h("span", { class: "inspector__label", text: "Identité de la trame" }),
    textField({ label: "Nom", value: trame.name, onChange: (v) => { trame.name = v; softSave(); } }),
    textField({ label: "Version", value: trame.version, onChange: (v) => { trame.version = v; softSave(); } }),
    choiceField({
      label: "Statut", value: trame.status,
      options: [{ value: "draft", label: "Brouillon" }, { value: "published", label: "Publiée" }, { value: "archived", label: "Archivée" }],
      onChange: (v) => { trame.status = v; softSave(); redraw(); },
    }),
    selectField({ label: "Famille", value: trame.familyId, placeholder: "—", options: (state.config.families || []).map((f) => ({ value: f.id, label: f.label })), onChange: (v) => { trame.familyId = v; softSave(); } }),
    selectField({ label: "Type d'acte", value: trame.actTypeId, options: (state.config.actTypes || []).map((a) => ({ value: a.id, label: a.label })), onChange: (v) => { trame.actTypeId = v; softSave(); } }),
    selectField({
      label: "Feuille de style", value: trame.styleId || "",
      placeholder: "— Automatique (entité, puis famille) —",
      options: stylesOf(state.config).map((s) => ({ value: s.id, label: (s.label || s.id) + (s.general ? " (feuille générale)" : "") })),
      help: "Habillage du document (police, logo, filets…). Automatique : la charte de l'entité signataire, sinon celle de la famille, sinon la feuille générale.",
      onChange: (v) => { trame.styleId = v; softSave(); redraw(); },
    }),
    textField({ label: "Description", value: trame.description || "", rows: 3, onChange: (v) => { trame.description = v; softSave(); } }),
    h("span", { class: "inspector__label", style: { marginTop: "10px" }, text: "Publication au recueil" }),
    h("label", { class: "fr-check" }, (() => {
      const c = h("input", { type: "checkbox", checked: tramePublishable(trame) });
      c.addEventListener("change", () => { trame.publishable = c.checked; softSave(); redraw(); });
      return c;
    })(), "Publiable au recueil des actes administratifs"),
    h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: tramePublishable(trame)
      ? "Les actes issus de cette trame sont signés puis publiés : le service leur attribue un identifiant ELI et ils deviennent opposables à leur entrée en vigueur."
      : "Trame non publiable : les actes issus de cette trame (actes individuels — revalorisation d'un traitement, sanction, etc.) sont rédigés, signés et conservés au registre, mais jamais déposés au recueil." }),
    h("span", { class: "inspector__label", style: { marginTop: "10px" }, text: "Validation et formalités" }),
    // Le parapheur est une fonction expérimentale : éteint, la trame n'a pas de
    // circuit à choisir (voir Administration › Expérimentale).
    ...(parapheurActif() ? [
      selectField({
        label: "Circuit de validation (parapheur)",
        value: trame.circuitId || "",
        placeholder: "— Circuit applicable automatiquement —",
        options: [
          { value: "aucun", label: "Aucune validation (parapheur écarté)" },
          ...(state.config.circuits || []).filter((c) => c.active !== false).map((c) => ({ value: c.id, label: c.label + " (" + (c.steps || []).length + " étape(s))" })),
        ],
        help: "Le circuit que doivent franchir les actes issus de cette trame avant la signature. « Automatique » laisse jouer le ciblage des circuits du référentiel (Administration › Circuits de validation).",
        onChange: (v) => { trame.circuitId = v; softSave(); redraw(); },
      }),
      h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: (() => {
        if (trame.circuitId === "aucun") return "Les actes issus de cette trame sont signés sans validation préalable.";
        const force = circuitFor(state.config, { trame });
        return force
          ? `Circuit appliqué : « ${force.label} » — ${(force.steps || []).length} étape(s).`
          : "Aucun circuit ne s'applique à cette trame : les actes partent en signature sans validation préalable.";
      })() }),
    ] : []),
    choiceField({
      label: "Transmission au contrôle de légalité", value: trame.transmission || "",
      options: DISPENSES.map((d) => ({ value: d.id, label: d.label })),
      help: "Presque toujours requise : c'est elle qui fait courir le délai de deux mois du représentant de l'État.",
      onChange: (v) => { trame.transmission = v; softSave(); },
    }),
    choiceField({
      label: "Notification aux intéressés", value: trame.notification || "",
      options: DISPENSES.map((d) => ({ value: d.id, label: d.label })),
      help: "Requise pour un acte individuel (revalorisation, sanction, nomination…), qui ne se publie pas et n'est opposable qu'une fois notifié.",
      onChange: (v) => { trame.notification = v; softSave(); },
    }),
    h("p", { class: "fr-small fr-muted", text: "Auteur : " + (trame.owner || "—") + " — la trame appartient au service qui la tient à jour, pas à l'agent qui l'a saisie." }),
    h("span", { class: "inspector__label", style: { marginTop: "10px" }, text: "Service et bureau" }),
    h("p", { class: "fr-small fr-muted", text: trame.serviceId ? targetLabel(state.config, trame.serviceId, trame.bureauId) : "Trame générale : tous les services peuvent la remplir." }),
    orgFields({
      serviceId: trame.serviceId || "", bureauId: trame.bureauId || "",
      label: "Service gestionnaire",
      help: "Réservé au service (et au bureau) choisis. Sans service, la trame reste générale.",
      onChange: (s, b) => { trame.serviceId = s; trame.bureauId = b; touch("trames", { rerender: false }); softSave(); redraw(); },
    }),
    h("span", { class: "inspector__label", style: { marginTop: "10px" }, text: "Entités concernées" }),
    h("p", { class: "fr-small fr-muted", text: (trame.entityIds || []).length ? trame.entityIds.map((id) => state.config.entities.find((e) => e.id === id)?.name).join(", ") : "Toutes les entités (aucune restriction)" }),
    h("div", { class: "fr-choices" }, ...(state.config.entities || []).map((e) => h("button", {
      class: "fr-choice" + ((trame.entityIds || []).includes(e.id) ? " is-on" : ""),
      text: e.code || e.name,
      onClick: () => {
        trame.entityIds = trame.entityIds || [];
        const i = trame.entityIds.indexOf(e.id);
        if (i >= 0) trame.entityIds.splice(i, 1); else trame.entityIds.push(e.id);
        touch("trames", { rerender: false }); redraw();
      },
    }))),
  ));

  // Remontée aux administrateurs : ce que les rédacteurs ont réécrit dans les
  // actes issus de cette trame. C'est le pendant « administratif » du tag
  // « hors trame » posé sur l'acte.
  const mine = state.actes.filter((a) => a.trameId === trame.id && a.values);
  if (mine.length) {
    const withEc = mine.map((a) => ({ a, ec: ecartsOfActe(a) })).filter((x) => x.ec.count);
    root.appendChild(h("div", { class: "inspector__section" },
      h("span", { class: "inspector__label", text: "Rédaction des actes issus de cette trame" }),
      h("p", { class: "fr-small fr-muted", text: `${mine.length} acte(s) · ${withEc.length} comportant des passages réécrits.` }),
      ...withEc.map(({ a, ec }) => h("div", { class: "note-card", style: { borderLeftColor: "var(--warning)" } },
        h("div", { class: "fr-row" },
          h("strong", { class: "fr-small", text: a.numero || "(sans numéro)" }),
          h("span", { class: "fr-badge fr-badge--warning", text: `${ec.count} écart(s)` }),
          h("div", { class: "fr-spacer" }),
          button("Voir", { variant: "tertiary", size: "sm", onClick: () => navigate("acte/" + a.id) }),
        ),
        [...new Set(ec.list.map((x) => x.label))].slice(0, 5).map((l) => h("p", { class: "fr-small fr-muted", style: { margin: "2px 0" }, text: "• " + l })),
      )),
      !withEc.length ? h("p", { class: "fr-small", style: { color: "var(--success)" }, text: "Aucun passage réécrit : les actes suivent la trame telle quelle." }) : null,
      h("p", { class: "fr-small fr-muted", style: { marginTop: "6px" }, text: "Un écart signale une adaptation de la part du rédacteur. Si elle est légitime ou récurrente, faites évoluer la trame puis publiez une nouvelle version." }),
    ));
  }
}

// ----------------------------------------------------------------- exports
function exportMenu(trame) {
  const values = sampleValues(trame);
  const doc = compile(trame, values, state.config);
  const actions = (close) => [button("Fermer", { variant: "secondary", onClick: () => close() })];
  modal({
    title: "Exporter — " + trame.name,
    body: h("div", { class: "fr-stack" },
      h("p", { class: "fr-small fr-muted", text: "L'export porte sur la trame compilée avec des valeurs de démonstration. Pour un acte réel, exportez depuis « Rédiger »." }),
      h("div", { class: "fr-row" },
        button("Akoma Ntoso (.xml)", { variant: "secondary", onClick: () => download(`${trame.id}.akn.xml`, exportAkn(doc, state.config, trame), "application/xml") }),
        button("Schematron (.sch)", { variant: "secondary", onClick: () => download(`${trame.id}.sch`, exportSchematron(doc, state.config, trame), "application/xml") }),
      ),
      h("div", { class: "fr-row" },
        button("JSON-LD (ELI)", { variant: "secondary", onClick: () => download(`${trame.id}.jsonld`, exportJsonLd(doc, state.config), "application/ld+json") }),
        button("Markdown", { variant: "secondary", onClick: () => download(`${trame.id}.md`, exportMarkdown(doc, state.config), "text/markdown") }),
        button("Trame (JSON)", { variant: "secondary", onClick: () => download(`${trame.id}.json`, JSON.stringify({ kind: "trame", trame }, null, 2)) }),
      ),
    ),
    actions,
  });
}
