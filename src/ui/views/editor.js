import { state, touch, navigate, redrawView, can } from "../state.js";
import { h, clear, button, icon, toast, modal, badge, textInput } from "../dom.js";
import { cadreZoom } from "../zoom.js";
import { NODE_TYPES, NODE_MAP, FIELD_TYPES, NOTE_KINDS, RULE_LEVELS, NUM_STYLES, ACTE_NATURES, newNode, newField, newRule, newNote, tramePublishable, ladderOf, niveauDe, natureDe, natureDocs, natureJuridiqueDe, paramsBloc, appliquerFormule, choixDe, PARA_ALIGNS, PARA_INDENTS, LIST_MARKERS, LIST_NUMBERINGS, TABLE_LAYOUTS, TABLE_ALIGNS, TABLE_CAPTION_POS, RECITAL_FINS } from "../../lib/schema.js";
import { compile, buildContext, interpolate } from "../../lib/compile.js";
import { prochainNumeroLibre } from "../../lib/numbering.js";
import { renderDocument, applyPaper, MARQUE_STYLE } from "../../lib/render.js";
import { stylesOf } from "../../lib/styles.js";
import { checkExpr, safeEval } from "../../lib/expr.js";
import { download, debounce, slug } from "../../lib/util.js";
import { glissable, deposable, moitie, rangeDans, insererAuRange } from "../dnd.js";
import { confirmDialog, promptDialog, sectionHeader, statusBadge, textField, selectField, choiceField, orgFields } from "../components.js";
import { targetLabel, authorLabel } from "../../lib/scope.js";
import { helpLink } from "../components.js";
import {
  countNotes, notesIndex, annotationStrip, noteComposer,
  armSelectionComment, flashBlock,
} from "../annotations.js";
import { exportAkn, exportSchematron, exportJsonLd, exportMarkdown } from "../../lib/export.js";
import { circuitFor } from "../../lib/validation.js";
import { MODES_TRAME, trameModeLabel, circuitPour, modeLabel } from "../../lib/externe.js";
import { DISPENSES } from "../../lib/execution.js";
import { ecartsOfActe } from "./modifier.js";
import { IMPORT_ID, trameImportee, enregistrerImport, abandonnerImport } from "../import-trame.js";
import { boutonDisponibilite, mettreADisposition, retirerMiseADisposition, trameEstDisponible } from "../mise-a-disposition.js";
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
    case "division": return (node.heading || "Division sans intitulé") + (node.level ? ` · échelon ${node.level}` : "");
    case "article": return `Article ${node.numMode === "auto" ? (counter ?? "") : (node.num || "?")}${node.heading ? " — " + node.heading : ""}`;
    case "para": return (node.text || "").slice(0, 40) || "Paragraphe vide";
    case "list": return `Liste ${node.ordered ? "numérotée" : "à puces"} (${(node.items || []).length})`;
    case "table": {
      const c = (node.columns || []).length, r = (node.rows || []).length;
      const resume = node.caption ? node.caption : `${c} × ${r}`;
      return `Tableau — ${resume}`;
    }
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
// La liste est partagée avec l'atelier de rédaction — voir lib/auto-tokens.js.
import { AUTO_TOKENS, AUTO_TOKENS_CONSEIL } from "../../lib/auto-tokens.js";
export { AUTO_TOKENS };

// Les jetons automatiques utiles à CETTE trame : une ANNEXE n'a pas de numéro
// propre, le jeton « numero » n'a donc rien à y faire — il s'imprimerait vide
// (voir src/lib/annexes.js). Une trame d'ASSEMBLÉE reçoit, en plus, les jetons
// de l'assemblée délibérante (voir src/lib/conseils.js).
const autoTokensDe = (trame) => {
  const base = natureDe(trame) === "annexe"
    ? AUTO_TOKENS.filter((t) => t.token !== "numero")
    : AUTO_TOKENS;
  return trame?.assemblee ? base.concat(AUTO_TOKENS_CONSEIL) : base;
};

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
  division: "list",
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
  // L'adresse de la source est relue au moment du dépôt : si l'arbre a changé
  // entre la saisie et le lâcher, elle peut désigner une place vide. On refuse
  // alors le dépôt — une place vide insérée dans la trame la corromprait, et le
  // document ne saurait plus se peindre.
  const node = from.list[from.index];
  if (!node) return false;
  if (listPath.startsWith(fromPath + ".")) return false;
  from.list.splice(from.index, 1);
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
    autoTokensDe(trame).map((t) => puce("auto", t.label, "{{" + t.token + "}}", "check",
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
  // Deux façons d'ouvrir l'éditeur : une trame du registre, ou la trame qu'un
  // import vient de proposer (elle n'a pas encore d'identifiant — voir
  // ui/import-trame.js). L'adresse réservée dit laquelle.
  const importee = params.id === IMPORT_ID ? trameImportee() : null;
  if (params.id === IMPORT_ID && !importee) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--info" },
      h("p", { class: "fr-alert__title", text: "Aucun import en cours" }),
      h("p", { class: "fr-small", text: "Cet écran ouvre la trame proposée par un import de document, le temps de décider si on la garde. Il n'y a pas d'import en cours." }),
      h("div", { style: { marginTop: "8px" } },
        button("Retour aux trames", { variant: "primary", onClick: () => navigate("trames") }))));
    return;
  }
  const trame = importee || state.trames.find((t) => t.id === params.id);
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

  const nbNotes = countNotes(trame.body);

  // ------------------------------------------------------------- bannière
  // Ce que l'écran ne peut pas montrer de lui-même : que la trame n'est pas au
  // registre (import en cours), ou qu'elle n'est pas encore entre les mains des
  // services (brouillon, archivée). Les deux disent « personne d'autre ne la
  // voit » ; ce qui les distingue, c'est le geste qui en fait sortir.
  if (importee) root.appendChild(banniereImport(state.trameImport));
  else if (!trameEstDisponible(trame)) root.appendChild(banniereDisponibilite(trame));

  // ------------------------------------------------------------- en-tête
  root.appendChild(h("div", { class: "fr-row", style: { padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--bg)" } },
    button("", { variant: "tertiary", icon: "x", title: "Retour", onClick: () => navigate("trames") }),
    h("div", { style: { flex: "1 1 auto", minWidth: "0" } },
      h("div", { class: "fr-row", style: { gap: "8px" } },
        h("strong", { text: trame.name }),
        statusBadge(trame.status),
        h("span", { class: "fr-badge", text: "v" + trame.version }),
      ),
      // Les compteurs sont cliquables : « N commentaires » ouvre la liste, pour
      // qu'un commentaire ne reste jamais invisible faute de savoir où regarder.
      h("button", {
        class: "editor__counts" + (nbNotes ? " is-on" : ""), type: "button",
        title: nbNotes ? "Voir tous les commentaires de la trame" : "Aucun commentaire pour l'instant — sélectionnez un passage dans la page, ou ouvrez l'onglet « Commentaires ».",
        onClick: () => { ed.tab = "commentaires"; redraw(); },
      }, `${(trame.fields || []).length} champ${(trame.fields || []).length > 1 ? "s" : ""} · ${(trame.rules || []).length} règle${(trame.rules || []).length > 1 ? "s" : ""} · ${nbNotes} commentaire${nbNotes > 1 ? "s" : ""}`),
    ),
    h("div", { class: "fr-row" },
      h("div", { class: "fr-choices" },
        h("button", { class: "fr-choice" + (ed.mode === "edit" ? " is-on" : ""), text: "Édition", onClick: () => { ed.mode = "edit"; redraw(); } }),
        h("button", { class: "fr-choice" + (ed.mode === "preview" ? " is-on" : ""), text: "Aperçu", onClick: () => { ed.mode = "preview"; redraw(); } }),
      ),
      // Le retour en arrière de la bannière, réduit à sa plus simple expression :
      // une trame mise à disposition se retire d'ici. Un brouillon, lui, a déjà
      // son bouton dans la bannière — on ne le répète pas.
      !importee && can("trames.gerer") && trameEstDisponible(trame) ? boutonDisponibilite(trame, { variant: "tertiary", court: true, size: "sm" }) : null,
      // Rédiger suppose une trame AU REGISTRE : la trame d'un import n'a pas
      // encore d'existence, on ne part pas d'elle pour rédiger un acte.
      !importee ? button("Rédiger", { variant: "secondary", onClick: () => navigate("rediger/" + trame.id) }) : null,
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
    glissable(item, { kind: "deplacement", path, label });
    deposable(item, {
      accepte: (c) => c.kind === "deplacement" || c.kind === "bloc",
      halo: (el, c, e) => { const m = moitie(el, e); el.classList.toggle("dnd-avant", m === "avant"); el.classList.toggle("dnd-apres", m === "apres"); },
      onDepot: (c, e) => deposerSurBloc(c, e, item, path, trame, ed, redraw),
    });
    return item;
  };
  // Peint une ligne du plan, puis son contenu (les blocs d'un article, comme
  // les divisions d'une division), en rendant le compteur d'articles.
  const peindrePlan = (node, path, depth, compteur) => {
    let c = compteur;
    if (!node) return c;
    if (node.type === "article") c += 1;
    outlineBox.appendChild(lignePlan(node, path, nodeTitle(node, state.config, c), depth > 0));
    (node.blocks || []).forEach((b, j) => { c = peindrePlan(b, `${path}.blocks.${j}`, depth + 1, c); });
    return c;
  };
  (trame.body || []).forEach((node, i) => {
    // Le plan descend dans les articles ET dans les divisions (Livre, Titre,
    // Chapitre, Section) : la hiérarchie du document s'y lit d'un coup d'œil.
    artCounter = peindrePlan(node, `body.${i}`, 0, artCounter);
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
  const paper = h("div", { class: "paper" });
  paper.style.fontFamily = state.config.brand.documentFont || "";
  // La feuille est un CANVAS : la molette (Ctrl) ou la barre règle le cran, et
  // le fond se déplace au curseur — voir src/ui/zoom.js.
  const canvas = cadreZoom(paper, { mode: "feuille", plein: true, cle: "trame", classe: "canvas" });
  center.appendChild(canvas);

  if (ed.mode === "preview") {
    const values = sampleValues(trame);
    const doc = compile(trame, values, state.config, { markMissing: true });
    applyPaper(paper, doc, state.config);
    // `showNotes` : l'aperçu compilé porte, à la fin, les commentaires de
    // préparation — jamais publiés, mais jamais perdus non plus.
    paper.appendChild(renderDocument(doc, state.config, { showNotes: true }));
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
    // Sélectionner un passage dans la page propose aussitôt de le commenter.
    armSelectionComment(paper, {
      onComment: ({ path, quote }) => {
        const node = nodeAt(trame, path);
        if (node) openCommentComposer(node, -1, quote);
      },
    });
  }

  // ---- volet droit : inspecteur
  right.appendChild(h("div", { class: "editor__colhead" }, icon("gear", 14), "Inspecteur"));
  const tabs = h("div", { class: "fr-tabs", style: { padding: "0 8px" } });
  for (const [id, label] of [
    ["bloc", "Ce bloc"],
    ["commentaires", nbNotes ? `Commentaires (${nbNotes})` : "Commentaires"],
    ["champs", "Questions"],
    ["regles", "Contrôles"],
    ["trame", "Trame"],
  ]) {
    tabs.appendChild(h("button", { class: "fr-tab" + (ed.tab === id ? " fr-tab--active" : ""), text: label, on: { click: () => { ed.tab = id; redraw(); } } }));
  }
  right.appendChild(tabs);
  const inspector = h("div", { class: "editor__scroll", style: { padding: "0" } });
  right.appendChild(inspector);
  if (ed.tab === "bloc") renderBlockInspector(inspector, trame, ed, redraw, softSave, ctxSample);
  else if (ed.tab === "commentaires") renderCommentsInspector(inspector, trame, ed, redraw, softSave, paper);
  else if (ed.tab === "champs") renderFieldsInspector(inspector, trame, ed, redraw, softSave);
  else if (ed.tab === "regles") renderRulesInspector(inspector, trame, redraw, softSave, ctxSample);
  else renderTrameInspector(inspector, trame, redraw, softSave);
}

// ============================================================================
// Les deux bannières de tête de l'éditeur.
// ============================================================================

// IMPORT EN COURS : la trame proposée n'existe que dans cette fenêtre, et il faut
// le voir à chaque instant — c'est aussi de là que partent les deux seuls gestes
// possibles, garder ou jeter. Rien n'est écrit tant que « Enregistrer » n'a pas
// été cliqué (voir ui/import-trame.js).
function banniereImport(imp) {
  return h("div", { class: "fr-alert fr-alert--info editor__banniere" },
    h("p", { class: "fr-alert__title", text: "Trame importée de « " + imp.fichier + " » — rien n'est encore enregistré" }),
    h("p", { class: "fr-small", text: "L'application a relu le document et en a proposé une trame. Corrigez-la ici autant qu'il faut : elle n'existe que dans cette fenêtre. « Enregistrer » l'ajoute au registre en brouillon — les services ne la verront qu'une fois mise à disposition. « Abandonner » la jette, sans laisser de trace." }),
    h("div", { class: "fr-row", style: { marginTop: "8px" } },
      button("Enregistrer la trame", { variant: "primary", icon: "check", onClick: () => {
        const t = enregistrerImport();
        if (!t) return;
        // Naviguer d'abord : la trame est au registre, l'adresse est la sienne.
        navigate("trame/" + t.id);
        touch("trames");
        toast("Trame enregistrée en brouillon — mettez-la à disposition quand elle sera prête", "success");
      } }),
      button("Abandonner l'import", { variant: "secondary", icon: "trash", onClick: () => {
        abandonnerImport();
        navigate("trames");
        toast("Import abandonné — rien n'a été enregistré");
      } }),
    ),
  );
}

// BROUILLON (ou archivée) : la trame est bien au registre, mais hors de portée
// des services. Un éditeur qui l'oublie croit avoir publié — la bannière est là
// pour ça, avec le bouton qui la met à disposition.
function banniereDisponibilite(trame) {
  const archivee = trame.status === "archived";
  return h("div", { class: "fr-alert fr-alert--warning editor__banniere" },
    h("p", { class: "fr-alert__title", text: archivee ? "Trame archivée — proposée à personne" : "Brouillon — les services ne la voient pas" }),
    h("p", { class: "fr-small", text: archivee
      ? "Une trame archivée n'est proposée ni aux services, ni comme modèle à qui que ce soit. Retirez-la des archives pour la remettre à disposition."
      : "Tant qu'elle n'est pas mise à disposition, cette trame reste à l'atelier : aucun service ne peut rédiger à partir d'elle. C'est le moment de la relire — texte, questions, contrôles, commentaires — puis de l'ouvrir aux services." }),
    h("div", { class: "fr-row", style: { marginTop: "8px" } },
      can("trames.gerer") ? boutonDisponibilite(trame, { variant: "primary" }) : null),
  );
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
  // Une annexe n'en a pas : l'exemple le dit en le laissant vide (voir
  // src/lib/annexes.js).
  values.numero = natureDe(trame) === "annexe" ? ""
    : (prochainNumeroLibre(state.config, { entity: state.config.entities?.[0], actes: state.actes }).numero || "…");
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

  // Les blocs éditables vivent dans un conteneur `.doc`, comme le document
  // compilé (voir `renderDocument`, lib/render.js). Les réglages de bloc
  // s'écrivent sous ce préfixe (`app.css` : `.doc .doc-p--boxed`,
  // `.doc .doc-table--rows`…) pour l'emporter sur la feuille de style ; sans ce
  // conteneur, régler un paragraphe encadré ou une liste « 1° » ne se verrait
  // pas ici, alors que le code pose déjà les bonnes classes.
  const corps = h("div", { class: "doc" });
  paper.appendChild(corps);

  // les blocs de niveau corps sont rendus dans l'ordre
  (trame.body || []).forEach((node, i) => {
    corps.appendChild(makeInsertBar(corps, "body", i));
    corps.appendChild(renderBlock(node, `body.${i}`, ed, redraw, softSave, trame));
  });
  corps.appendChild(makeInsertBar(corps, "body", (trame.body || []).length));
}

function renderBlock(node, path, ed, redraw, softSave, trame) {
  // Une place vide (une adresse périmée, une trame abîmée) ne se peint pas :
  // mieux vaut un trou invisible qu'un éditeur qui refuse de s'ouvrir.
  if (!node) return h("span", { hidden: true });
  const selected = ed.selPath === path;
  const wrapper = h("div", {
    class: "blk" + (selected ? " blk--sel" : ""),
    "data-path": path,
    on: { click: (e) => { if (selected) return; ed.selPath = path; if (ed.tab !== "bloc") ed.tab = "bloc"; redraw(); } },
  });

  // Le bloc ENTIER se saisit pour être déplacé — pas seulement sa poignée : on
  // attrape « cet article-là » par son intitulé, sa marge, sa barre d'outils.
  // La règle est dans ui/dnd.js : un appui DANS une zone de texte éditable ne
  // déplace pas le bloc, il y place le curseur — le texte reste sélectionnable.
  glissable(wrapper, { kind: "deplacement", path, label: nodeTitle(node, state.config) });

  // Cible de dépôt : un bloc glissé (neuf, ou déplacé depuis le plan ou le
  // document) se range avant ou après celui-ci, selon la moitié survolée.
  deposable(wrapper, {
    accepte: (c) => c.kind === "deplacement" || c.kind === "bloc",
    halo: (el, c, e) => { const m = moitie(el, e); el.classList.toggle("dnd-avant", m === "avant"); el.classList.toggle("dnd-apres", m === "apres"); },
    onDepot: (c, e) => deposerSurBloc(c, e, wrapper, path, trame, ed, redraw),
  });

  // poignée de déplacement : le repère visible du glisser — et la prise qui
  // répond au doigt (le bloc entier, lui, laisse le doigt faire défiler).
  const poignee = glissable(
    h("span", { class: "blk__grip", title: "Glisser pour déplacer ce bloc", text: "⠿", "aria-hidden": "true" }),
    { kind: "deplacement", path, label: nodeTitle(node, state.config) },
    { auDoigt: true },
  );
  // … et l'on peut aussi saisir le bloc PAR SON INTITULÉ : c'est la prise
  // naturelle quand on pense « cet article-là » — et le titre d'un article ou
  // d'une division ne contient pas de texte qu'on voudrait sélectionner.
  const armerPrise = (headEl) => {
    if (!headEl) return;
    headEl.title = "Glisser pour déplacer ce bloc — ou le déplacer aux flèches";
    headEl.classList.add("blk__prise-cible");
  };

  // barre d'outils du bloc
  const tools = h("div", { class: "blk__tools" },
    poignee,
    button("", { variant: "tertiary", icon: "up", title: "Monter", onClick: (e) => { e.stopPropagation(); moveNode(trame, path, -1, redraw); } }),
    button("", { variant: "tertiary", icon: "down", title: "Descendre", onClick: (e) => { e.stopPropagation(); moveNode(trame, path, 1, redraw); } }),
    button("", { variant: "tertiary", icon: "plus", title: "Ajouter", onClick: (e) => { e.stopPropagation(); addBlockMenu(e.currentTarget, trame, parentPath(path), listAt(trame, path).index + 1, redraw); } }),
    button("", { variant: "tertiary", icon: "trash", title: "Supprimer", onClick: async (e) => { e.stopPropagation(); const ok = await confirmDialog("Supprimer le bloc", "Ce bloc sera retiré de la trame.", { confirmLabel: "Supprimer", danger: true }); if (ok) { listAt(trame, path).list.splice(listAt(trame, path).index, 1); touch("trames", { rerender: false }); redraw(); } } }),
    // Commenter CE bloc — l'article sur lequel on travaille, le paragraphe qu'on
    // vient d'écrire. Le bouton ne dort pas dans l'inspecteur : il est sur le
    // bloc, et rappelle le nombre de commentaires déjà posés.
    h("button", {
      class: "blk__note" + ((node.notes || []).length ? " is-on" : ""), type: "button",
      title: (node.notes || []).length
        ? `Commenter ce bloc (${node.notes.length} commentaire${node.notes.length > 1 ? "s" : ""} déjà posé${node.notes.length > 1 ? "s" : ""})`
        : "Commenter ce bloc",
      onClick: (e) => { e.stopPropagation(); openCommentComposer(node, -1, ""); },
    }, icon("note", 14), (node.notes || []).length ? h("span", { class: "blk__note-count", text: String(node.notes.length) }) : null),
  );
  wrapper.appendChild(tools);

  // Repère de marge : un bloc commenté le dit au premier regard, même quand la
  // bande posée sous lui est loin (un commentaire sur un article se lit à la fin
  // de l'article). C'est le signal qu'on ne peut pas manquer — et il vit dans la
  // marge, sans jamais recouvrir le texte (voir `.blk__annot-flag`).
  if ((node.notes || []).length) {
    wrapper.appendChild(h("button", {
      class: "blk__annot-flag", type: "button",
      title: (node.notes.length === 1 ? "Un commentaire sur ce bloc" : node.notes.length + " commentaires sur ce bloc") + " — cliquez pour les ouvrir",
      onClick: (e) => { e.stopPropagation(); ed.selPath = path; ed.tab = "commentaires"; redraw(); },
    }, String(node.notes.length)));
  }

  const editable = (cls, text, onInput, tag = "div") => {
    const el = h(tag, { class: cls, contenteditable: "true", spellcheck: "true" });
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

  // Les réglages du bloc (voir `paramsBloc`, lib/schema.js) : l'aperçu de
  // l'éditeur montre ce que la compilation produira — encadré, alinéa, liste
  // « 1° », légende au-dessous, ligne d'en-tête ou non. Ce qui se voit ici est
  // ce qui s'imprime.
  const reglages = paramsBloc(node);

  // Un élément de liste (un considérant, un item) : son texte, et les deux
  // gestes qui le concernent — en ajouter un juste après, le retirer. Les mêmes
  // gestes que dans l'atelier de rédaction, aux mêmes boutons (`.piece__tools`).
  const nouvelItem = () => ({ id: "it-" + Math.random().toString(36).slice(2, 7), text: "", when: "" });
  const outilsItem = (i) => h("span", { class: "piece__tools", contenteditable: "false" },
    h("button", { class: "piece__btn", type: "button", title: "Ajouter un élément après celui-ci",
      onClick: (e) => { e.stopPropagation(); node.items.splice(i + 1, 0, nouvelItem()); touch("trames", { rerender: false }); redraw(); } }, icon("plus", 12)),
    h("button", { class: "piece__btn piece__btn--danger", type: "button", title: "Retirer cet élément",
      onClick: (e) => { e.stopPropagation(); node.items.splice(i, 1); touch("trames", { rerender: false }); redraw(); } }, icon("trash", 12)));

  // Une cellule de tableau : le texte se réécrit en place, comme partout dans
  // le document.
  const cellule = (tag, text, onInput) => h(tag, {}, editable("", text, onInput));

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
    case "para":
    case "raw": {
      const p = editable("doc-p", node.text, (v) => { node.text = v; softSave(); });
      if (node.type === "para") {
        // Mêmes classes que le document compilé (voir lib/render.js) : ce que
        // règle l'inspecteur se voit ici, tout de suite.
        if (reglages.align) p.style.textAlign = reglages.align;
        if (reglages.indent) p.classList.add("doc-p--indent-" + reglages.indent);
        if (reglages.boxed) p.classList.add("doc-p--boxed");
      }
      wrapper.appendChild(p);
      break;
    }
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
      // Une LISTE : sa marque (puces ou numérotation) telle que la feuille ou le
      // bloc l'ont réglée, ses éléments éditables, et les deux gestes d'élément.
      const box = node.type === "considerants"
        ? h("div", { class: "doc-recitals" + (reglages.inline ? " doc-recitals--inline" : "") })
        : h(node.ordered ? "ol" : "ul", { class: "doc-list" });
      if (node.type === "list") {
        const marque = node.ordered ? reglages.numbering : reglages.marker;
        if (marque) box.style.listStyleType = MARQUE_STYLE[marque] || marque;
        if (node.ordered && Number(reglages.start) > 1) box.setAttribute("start", String(Number(reglages.start)));
      }
      const elements = [];
      (node.items || []).forEach((it, i) => {
        const el = node.type === "considerants" ? h("p", { class: "doc-p" }) : h("li");
        // La formule du bloc s'affiche comme le compilateur l'ajoutera — et
        // n'est pas écrite une seconde fois quand le texte la porte déjà.
        if (node.type === "considerants" && reglages.formule && appliquerFormule(reglages.formule, it.text) !== it.text) {
          el.appendChild(h("span", { class: "doc-recitals__formule", contenteditable: "false", text: reglages.formule + " " }));
        }
        el.appendChild(editable("", it.text, (v) => { it.text = v; softSave(); }, "span"));
        // La ponctuation de fin du bloc, elle aussi ajoutée à la compilation :
        // montrée après le texte, jamais écrite — le pendant de la formule.
        // Même règle que `finir` (lib/compile.js) : pas de doublon si le texte
        // porte déjà sa ponctuation.
        if (node.type === "considerants" && reglages.fin && String(it.text || "").trim() && !/[.;,:]$/.test(String(it.text).trim())) {
          el.appendChild(h("span", { class: "doc-recitals__fin", contenteditable: "false", text: reglages.fin }));
        }
        if (it.when) el.appendChild(h("span", { class: "fr-badge fr-badge--warning", style: { marginLeft: "6px" }, text: "si " + it.when }));
        el.appendChild(outilsItem(i));
        elements.push(el);
      });
      // « En un seul alinéa » : les considérants se suivent dans le même
      // paragraphe, comme à la compilation. On garde un élément par considérant
      // pour pouvoir les éditer, mais ils se présentent à la suite.
      if (node.type === "considerants" && reglages.inline) {
        for (let i = 1; i < elements.length; i++) elements[i].style.marginTop = "0";
      }
      for (const el of elements) box.appendChild(el);
      if (node.type === "list") {
        box.appendChild(h("li", { class: "piece--ajout" }, h("button", {
          class: "piece__add", type: "button", title: "Ajouter un élément à la fin de la liste",
          onClick: (e) => { e.stopPropagation(); node.items.push(nouvelItem()); touch("trames", { rerender: false }); redraw(); },
        }, icon("plus", 12), h("span", { text: "Ajouter un élément" }))));
      } else {
        box.appendChild(h("p", { class: "doc-p piece--ajout" }, h("button", {
          class: "piece__add", type: "button", title: "Ajouter un considérant",
          onClick: (e) => { e.stopPropagation(); node.items.push(nouvelItem()); touch("trames", { rerender: false }); redraw(); },
        }, icon("plus", 12), h("span", { text: "Ajouter un considérant" }))));
      }
      wrapper.appendChild(box);
      break;
    }
    case "article": {
      const sec = h("section", { class: "doc-article" });
      const head = h("h2", { class: "doc-article-head" },
        h("span", { class: "doc-article-num", text: node.numMode === "auto" ? "(numérotation automatique)" : node.num }),
        node.heading ? h("span", { text: " — " + node.heading }) : null);
      armerPrise(head);
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
    case "division": {
      // Une division (Livre, Titre, Chapitre, Section…) : son intitulé et sa
      // place dans la hiérarchie, puis son contenu — articles et divisions —
      // rendu de la même façon, récursivement.
      const niveau = Math.max(1, Number(node.level) || 1);
      const sec = h("section", { class: `doc-division doc-division--n${niveau}` });
      const head = h(["h2", "h3", "h4", "h5"][Math.min(niveau, 4) - 1], { class: "doc-division-head" },
        h("span", { class: "doc-division-num", text: (node.numMode === "manual" ? (node.num || "(numéro)") : "(numérotation automatique)") + " · " + niveauDe(trame, niveau).label }),
        node.heading ? h("span", { class: "doc-division-heading", text: " — " + node.heading }) : null);
      armerPrise(head);
      sec.appendChild(head);
      const sub = h("div");
      (node.blocks || []).forEach((b, j) => {
        sub.appendChild(h("div", { class: "insert-bar" }, h("button", { class: "insert-bar__btn", text: "+", onClick: (e) => { e.stopPropagation(); addBlockMenu(e.currentTarget, trame, `${path}.blocks`, j, redraw); } })));
        sub.appendChild(renderBlock(b, `${path}.blocks.${j}`, ed, redraw, softSave, trame));
      });
      sub.appendChild(h("div", { class: "insert-bar" },
        h("button", { class: "insert-bar__btn", text: "+", onClick: (e) => { e.stopPropagation(); addBlockMenu(e.currentTarget, trame, `${path}.blocks`, (node.blocks || []).length, redraw); } }),
        h("span", { class: "insert-bar__hint", text: "article, paragraphe, division…" })));
      sec.appendChild(sub);
      wrapper.appendChild(sec);
      break;
    }
    case "table": {
      // Un TABLEAU s'édite ici comme un tableau de traitement de texte :
      // chaque case se réécrit sur place, une colonne ou une ligne s'insère et
      // se retire au bouton. Les commandes sont posées dans une gouttière
      // (`.tbl-tools*`), jamais imprimée — même dispositif que l'éditeur de
      // modification (`.amend-th__tools`, voir views/amend-editor.js).
      const md = paramsBloc(node);
      const wrap = h("div", { class: "doc-table-wrap" });
      const legende = () => (node.caption
        ? editable("doc-table-caption", node.caption, (v) => { node.caption = v; softSave(); })
        : null);
      if (md.captionPos !== "bottom" && legende()) wrap.appendChild(legende());

      const geste = (icone, titre, onClick) => h("button", {
        class: "tbl__geste", type: "button", title: titre, "aria-label": titre,
        onClick: (e) => { e.stopPropagation(); onClick(); },
      }, icon(icone, 11));
      const barreGeste = (label, titre, onClick) => h("button", {
        class: "tbl__btn", type: "button", title: titre,
        onClick: (e) => { e.stopPropagation(); onClick(); },
      }, icon("plus", 12), h("span", { text: label }));

      // La ligne des intitulés de colonnes. `tag` vaut `th` quand le bloc a une
      // ligne d'en-tête, `td` sinon (les intitulés sont alors la première ligne
      // de données) : au rendu comme ici, la même règle (voir lib/render.js).
      const ligneColonnes = (tag) => {
        const tr = h("tr");
        (node.columns || []).forEach((c, j) => {
          const cell = h(tag, {}, editable("", c, (v) => { node.columns[j] = v; softSave(); }));
          cell.appendChild(h("span", { class: "tbl-tools", contenteditable: "false" },
            geste("plus", "Insérer une colonne après celle-ci", () => {
              node.columns.splice(j + 1, 0, "");
              node.rows.forEach((r) => r.splice(j + 1, 0, ""));
              touch("trames", { rerender: false }); redraw();
            }),
            geste("trash", (node.columns || []).length > 1 ? "Retirer cette colonne" : "Un tableau garde au moins une colonne", () => {
              if ((node.columns || []).length <= 1) return;
              node.columns.splice(j, 1);
              node.rows.forEach((r) => r.splice(j, 1));
              touch("trames", { rerender: false }); redraw();
            })));
          tr.appendChild(cell);
        });
        return tr;
      };
      const ligneDonnees = (r, i) => {
        const tr = h("tr");
        (node.columns || []).forEach((_, ci) => {
          tr.appendChild(cellule("td", r[ci] ?? "", (v) => { while (r.length <= ci) r.push(""); r[ci] = v; softSave(); }));
        });
        tr.appendChild(h("td", { class: "tbl-tools-td", contenteditable: "false" },
          geste("plus", "Insérer une ligne après celle-ci", () => {
            node.rows.splice(i + 1, 0, (node.columns || []).map(() => ""));
            touch("trames", { rerender: false }); redraw();
          }),
          geste("trash", "Retirer cette ligne", () => {
            node.rows.splice(i, 1);
            touch("trames", { rerender: false }); redraw();
          })));
        return tr;
      };

      const t = h("table", { class: "doc-table"
        + (node.layout ? " doc-table--" + node.layout : "")
        + (node.align ? " doc-table--" + node.align : "") });
      const tb = h("tbody");
      if (md.head !== false) t.appendChild(h("thead", {}, ligneColonnes("th")));
      else tb.appendChild(ligneColonnes("td"));
      (node.rows || []).forEach((r, i) => tb.appendChild(ligneDonnees(r, i)));
      t.appendChild(tb);
      wrap.appendChild(t);
      // La légende « au-dessous » vient JUSTE après le tableau (la feuille lui
      // donne alors sa marge haute) ; la barre de gestes, elle, reste au bas de
      // l'ensemble.
      if (md.captionPos === "bottom" && legende()) wrap.appendChild(legende());

      // La barre de gestes du tableau : ajouter une colonne, une ligne — les
      // deux manques qu'un tableau neuf laisse toujours deviner.
      wrap.appendChild(h("div", { class: "tbl__bar", contenteditable: "false" },
        barreGeste("Colonne", "Ajouter une colonne à la fin du tableau", () => {
          node.columns.push("");
          node.rows.forEach((r) => r.push(""));
          touch("trames", { rerender: false }); redraw();
        }),
        barreGeste("Ligne", "Ajouter une ligne à la fin du tableau", () => {
          node.rows.push((node.columns || []).map(() => ""));
          touch("trames", { rerender: false }); redraw();
        }),
        h("span", { class: "tbl__hint", text: (node.columns || []).length + " colonne" + ((node.columns || []).length > 1 ? "s" : "") + " · " + (node.rows || []).length + " ligne" + ((node.rows || []).length > 1 ? "s" : "") })));

      wrapper.appendChild(wrap);
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

  // Les commentaires ne se cachent pas : ils s'affichent ici, sous le bloc
  // qu'ils visent, dans la page elle-même (voir ui/annotations.js). C'est ce
  // qui les rend impossibles à manquer — contrairement à un commentaire Word,
  // qui attend dans une marge.
  if ((node.notes || []).length) {
    wrapper.appendChild(annotationStrip({
      notes: node.notes,
      editable: true,
      onEdit: (nt, i) => openCommentComposer(node, i, ""),
      onDelete: (nt, i) => supprimerCommentaire(node, i, redraw),
      onAdd: () => openCommentComposer(node, -1, ""),
    }));
  }
  return wrapper;
}

// --------------------------------------------------------------- commentaires
// Écrire un commentaire sur CE bloc — celui qu'on vient de cliquer, ou celui qui
// portait le passage sélectionné. (Le commentaire est signé du service du
// compte connecté : voir `authorOf`.)
function openCommentComposer(node, index, quote) {
  const editing = index >= 0;
  const nt = editing ? node.notes[index] : null;
  if (editing && !nt) return;
  noteComposer({
    note: nt,
    quote: quote || nt?.quote || "",
    author: authorOf(),
    date: todayIso(),
    context: "Sur : " + nodeTitle(node, state.config),
    onDelete: editing ? () => {
      node.notes.splice(index, 1);
      touch("trames", { rerender: false });
      toast("Commentaire supprimé", "info");
      redrawView();
    } : null,
    onSave: (data) => {
      if (editing) {
        nt.kind = data.kind;
        nt.text = data.text;
        nt.quote = data.quote || "";
      } else {
        node.notes = node.notes || [];
        node.notes.push(newNote({
          kind: data.kind, text: data.text, quote: data.quote || "",
          author: authorOf(), date: todayIso(),
        }));
      }
      touch("trames", { rerender: false });
      toast(editing ? "Commentaire modifié" : "Commentaire ajouté au bloc", "success");
      redrawView();
    },
  });
}

function supprimerCommentaire(node, index, redraw) {
  node.notes.splice(index, 1);
  touch("trames", { rerender: false });
  toast("Commentaire supprimé", "info");
  redraw();
}

// L'onglet « Commentaires » : tous ceux de la trame, rangés par bloc, dans
// l'ordre du document. C'est la vue d'ensemble — et l'endroit où l'on écrit.
function renderCommentsInspector(root, trame, ed, redraw, softSave, paper) {
  const groups = notesIndex(trame.body || [], (n, c) => nodeTitle(n, state.config, c));
  const total = groups.reduce((n, g) => n + g.notes.length, 0);
  const sel = nodeAt(trame, ed.selPath);

  root.appendChild(h("div", { class: "inspector__sec" },
    h("p", { class: "fr-small fr-muted", style: { marginTop: 0 },
      text: `Un commentaire est signé du service de son auteur — ici : ${authorOf()}. Il accompagne la préparation du document, reste dans l'acte et part dans les exports ; il n'est jamais publié.` }),
    sel ? button("Commenter « " + resume(nodeTitle(sel, state.config), 34) + " »", {
      variant: "primary", size: "sm", icon: "note",
      onClick: () => openCommentComposer(sel, -1, ""),
    }) : null,
    h("p", { class: "fr-small fr-muted", style: { marginTop: "8px" },
      text: "Pour viser un passage précis, sélectionnez-le dans la page : la pastille « Commenter » vous proposera de le citer." }),
  ));

  if (!total) {
    root.appendChild(h("div", { class: "inspector__sec" },
      h("p", { class: "fr-small fr-muted", style: { margin: 0 } },
        "Aucun commentaire pour l'instant. Sélectionnez un article (ou un passage) dans la page, puis cliquez « Commenter » : une consigne juridique, une explication, un point à arbitrer, une veille — ils resteront dans le document au lieu de se perdre.")));
    return;
  }

  for (const g of groups) {
    const card = h("div", { class: "cmt-group" + (g.path === ed.selPath ? " is-open" : "") });
    card.appendChild(h("div", { class: "cmt-group__head" },
      h("button", {
        class: "cmt-group__jump", type: "button", title: "Voir ce bloc dans la page",
        onClick: (e) => {
          e.stopPropagation();
          ed.selPath = g.path;
          if (!flashBlock(paper, g.path)) redraw();
        },
      }, icon("eye", 13), h("span", { class: "cmt-group__label", text: g.label })),
      h("span", { class: "fr-badge fr-badge--info", text: String(g.notes.length) }),
      button("", { variant: "tertiary", icon: "plus", size: "sm", title: "Ajouter un commentaire à ce bloc", onClick: () => openCommentComposer(g.node, -1, "") }),
    ));
    const body = h("div", { class: "cmt-group__body" });
    for (let i = 0; i < g.notes.length; i++) body.appendChild(noteEditor(g.notes[i], i, g.node, redraw, softSave));
    card.appendChild(body);
    root.appendChild(card);
  }
}

function resume(text, max) {
  const t = String(text || "");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
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
  if (!node) return false;
  const parts = pathParts(listPath);
  let arr = trame;
  for (const p of parts) arr = arr[/^\d+$/.test(p) ? Number(p) : p];
  if (!Array.isArray(arr)) return false;
  arr.splice(index, 0, node);
  return true;
}

function moveNode(trame, path, dir, redraw) {
  const at = listAt(trame, path);
  if (!at) return;
  const { list, index } = at;
  const to = index + dir;
  if (to < 0 || to >= list.length) return;
  const [n] = list.splice(index, 1);
  if (!n) return;
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
// La grille d'un tableau dans l'inspecteur : une case par cellule, un bouton par
// geste. C'est le pendant « panneau » de l'édition en place dans le document —
// les deux écrivent le même tableau, et l'un rattrape l'autre (on agrandit la
// grille ici quand elle est large, on corrige une cellule là-bas en la lisant
// dans son contexte). Voir `case "table"` de `renderBlock`.
function tableGridEditor(node, redraw, softSave, rafraichir) {
  const colonnes = node.columns || (node.columns = []);
  const lignes = node.rows || (node.rows = []);
  const N = colonnes.length;
  const ecrire = () => { softSave(); rafraichir(); };
  const structure = () => { touch("trames", { rerender: false }); redraw(); };
  const outil = (icone, titre, actif, onClick) => {
    const b = button("", { variant: "tertiary", icon: icone, size: "sm", title: titre, onClick });
    if (!actif) { b.disabled = true; b.style.opacity = ".32"; }
    return b;
  };
  const bouger = (arr, i, d) => {
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    const [x] = arr.splice(i, 1);
    arr.splice(j, 0, x);
  };

  const grille = h("div", { class: "tbl-edit" });
  grille.style.gridTemplateColumns = `auto repeat(${Math.max(1, N)}, minmax(0, 1fr)) auto`;

  const champ = (valeur, onChange) => h("input", {
    class: "fr-input tbl-edit__case", value: valeur ?? "",
    on: { input: (e) => onChange(e.target.value) },
  });

  // -- ligne des intitulés de colonnes
  grille.appendChild(h("span", { class: "tbl-edit__coin", text: "Colonnes" }));
  colonnes.forEach((c, j) => {
    grille.appendChild(h("div", { class: "tbl-edit__entete" },
      champ(c, (v) => { colonnes[j] = v; ecrire(); }),
      h("span", { class: "tbl-edit__outils" },
        outil("left", "Déplacer cette colonne vers la gauche", j > 0, () => {
          bouger(colonnes, j, -1);
          for (const r of lignes) { while (r.length < N) r.push(""); bouger(r, j, -1); }
          structure();
        }),
        outil("right", "Déplacer cette colonne vers la droite", j < N - 1, () => {
          bouger(colonnes, j, 1);
          for (const r of lignes) { while (r.length < N) r.push(""); bouger(r, j, 1); }
          structure();
        }),
        outil("trash", N > 1 ? "Retirer cette colonne" : "Un tableau garde au moins une colonne", N > 1, () => {
          colonnes.splice(j, 1);
          for (const r of lignes) r.splice(j, 1);
          structure();
        }))));
  });
  grille.appendChild(h("button", {
    class: "tbl-edit__geste", type: "button", title: "Ajouter une colonne à la fin",
    onClick: () => { colonnes.push(""); for (const r of lignes) r.push(""); structure(); },
  }, icon("plus", 12), h("span", { text: "Colonne" })));

  // -- les lignes, une case par cellule
  lignes.forEach((r, ri) => {
    while (r.length < N) r.push("");
    grille.appendChild(h("span", { class: "tbl-edit__num", text: String(ri + 1) }));
    for (let ci = 0; ci < N; ci++) {
      grille.appendChild(champ(r[ci], (v) => { while (r.length <= ci) r.push(""); r[ci] = v; ecrire(); }));
    }
    grille.appendChild(h("span", { class: "tbl-edit__outils" },
      outil("up", "Monter cette ligne", ri > 0, () => { bouger(lignes, ri, -1); structure(); }),
      outil("down", "Descendre cette ligne", ri < lignes.length - 1, () => { bouger(lignes, ri, 1); structure(); }),
      outil("trash", "Retirer cette ligne", true, () => { lignes.splice(ri, 1); structure(); })));
  });

  // -- ajouter une ligne
  grille.appendChild(h("span"));
  grille.appendChild(h("div", { class: "tbl-edit__pied", style: { gridColumn: `span ${Math.max(1, N)}` } },
    h("button", {
      class: "tbl-edit__geste", type: "button", title: "Ajouter une ligne à la fin",
      onClick: () => { lignes.push(colonnes.map(() => "")); structure(); },
    }, icon("plus", 12), h("span", { text: "Ligne" }))));
  grille.appendChild(h("span"));
  return grille;
}

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

  // Une division : son ÉCHELON dans la hiérarchie, sa numérotation, son
  // intitulé. L'échelle elle-même (le mot de chaque échelon, sa numérotation)
  // est un réglage de la TRAME — onglet « Trame », rubrique « Hiérarchie ».
  if (node.type === "division") {
    root.appendChild(sec([
      h("span", { class: "inspector__label", text: "Échelon dans la hiérarchie" }),
      choiceField({
        label: "", value: String(node.level || 1),
        options: ladderOf(trame).map((n) => ({ value: String(n.level), label: `${n.label} — échelon ${n.level}` })),
        onChange: (v) => { node.level = Number(v); softSave(); redraw(); },
      }),
      h("p", { class: "fr-small fr-muted", text: "L'échelle des échelons se règle dans l'onglet « Trame », rubrique « Hiérarchie du document »." }),
      h("span", { class: "inspector__label", text: "Numérotation" }),
      choiceField({
        label: "", value: node.numMode || "auto", options: [{ value: "auto", label: "Automatique" }, { value: "manual", label: "Manuelle" }],
        onChange: (v) => { node.numMode = v; softSave(); redraw(); },
      }),
      node.numMode === "manual" ? textField({ label: "Texte du numéro", value: node.num || "", onChange: (v) => { node.num = v; softSave(); } }) : null,
      textField({ label: "Intitulé de la division", value: node.heading || "", onChange: (v) => { node.heading = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); } }),
    ]));
  }

  if (node.type === "visas") {
    root.appendChild(sec([
      sectionHeader("Visas", button("Ajouter", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { node.items = node.items || []; node.items.push({ id: "it-" + Math.random().toString(36).slice(2, 7), refId: "", text: "", when: "" }); touch("trames", { rerender: false }); redraw(); } })),
      ...(node.items || []).map((it, i) => visaItemEditor(it, i, node, trame, redraw, softSave)),
    ]));
  }

  // Un PARAGRAPHE : son texte (plus haut), puis sa MISE EN FORME — alignement,
  // retrait, encadré. Chaque réglage peut rester « comme la feuille de style » :
  // c'est alors la charte de la collectivité qui décide, et le bloc n'impose
  // rien. Un choix explicite ne vaut que pour ce paragraphe-là.
  if (node.type === "para") {
    const md = paramsBloc(node);
    root.appendChild(sec([
      h("span", { class: "inspector__label", text: "Mise en forme" }),
      selectField({
        label: "Alignement", value: md.align, options: choixDe(PARA_ALIGNS),
        onChange: (v) => { node.align = v; softSave(); redraw(); },
      }),
      selectField({
        label: "Retrait", value: md.indent, options: choixDe(PARA_INDENTS),
        onChange: (v) => { node.indent = v; softSave(); redraw(); },
      }),
      choiceField({
        label: "Encadré", value: !!md.boxed,
        options: [{ value: false, label: "Non" }, { value: true, label: "Oui" }],
        onChange: (v) => { node.boxed = v; softSave(); redraw(); },
      }),
      h("p", { class: "fr-small fr-muted", text: "« Comme la feuille de style » laisse la charte décider. Un choix explicite ne s'applique qu'à ce paragraphe." }),
    ]));
  }

  if (node.type === "list") {
    const md = paramsBloc(node);
    root.appendChild(sec([
      h("span", { class: "inspector__label", text: "Genre de liste" }),
      choiceField({
        label: "", value: !!node.ordered,
        options: [{ value: false, label: "À puces" }, { value: true, label: "Numérotée" }],
        onChange: (v) => { node.ordered = v; softSave(); redraw(); },
      }),
      node.ordered
        ? selectField({
          label: "Numérotation", value: md.numbering, options: choixDe(LIST_NUMBERINGS),
          onChange: (v) => { node.numbering = v; softSave(); redraw(); },
        })
        : selectField({
          label: "Marqueur", value: md.marker, options: choixDe(LIST_MARKERS),
          onChange: (v) => { node.marker = v; softSave(); redraw(); },
        }),
      node.ordered ? textField({
        label: "Numéro de départ", type: "number", value: md.start,
        onChange: (v) => { node.start = Math.max(1, Number(v) || 1); softSave(); redraw(); },
      }) : null,
      h("p", { class: "fr-small fr-muted", text: "Les valeurs par défaut sont celles de la feuille de style (écran « Feuilles de style », rubrique « Listes »). Chaque liste peut s'en écarter séparément — « 1° » ici, « a) » là." }),
    ]));
  }

  if (node.type === "considerants" || node.type === "list") {
    const md = paramsBloc(node);
    const deplacer = (i, d) => {
      const j = i + d;
      if (j < 0 || j >= node.items.length) return;
      const [it] = node.items.splice(i, 1);
      node.items.splice(j, 0, it);
      touch("trames", { rerender: false }); redraw();
    };
    root.appendChild(sec([
      sectionHeader("Éléments", button("Ajouter", {
        variant: "secondary", size: "sm", icon: "plus",
        onClick: () => {
          // Un considérant neuf n'écrit que sa substance : la formule est un
          // réglage du bloc (voir `formule`, plus bas).
          node.items = node.items || [];
          node.items.push({ id: "it-" + Math.random().toString(36).slice(2, 7), text: "", when: "" });
          touch("trames", { rerender: false }); redraw();
        },
      })),
      node.type === "considerants"
        ? h("p", { class: "fr-small fr-muted", text: md.formule
          ? "La formule « " + md.formule + " » est placée devant chaque considérant au moment de la compilation : écrivez ici la substance, elle n'est pas répétée si elle est déjà écrite."
          : "Écrivez chaque considérant en entier (« Considérant que… ») — ou réglez une formule plus bas, qui sera placée devant chacun." })
        : null,
      ...(node.items || []).map((it, i) => h("div", { class: "note-card", style: { borderLeftColor: "var(--border-strong)" } },
        h("div", { class: "fr-row" },
          h("strong", { class: "fr-small", text: "#" + (i + 1) }),
          h("div", { class: "fr-spacer" }),
          button("", { variant: "tertiary", icon: "up", size: "sm", title: "Monter cet élément", onClick: () => deplacer(i, -1) }),
          button("", { variant: "tertiary", icon: "down", size: "sm", title: "Descendre cet élément", onClick: () => deplacer(i, 1) }),
          button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Retirer cet élément", onClick: () => { node.items.splice(i, 1); touch("trames", { rerender: false }); redraw(); } })),
        (() => { const ta = h("textarea", { class: "fr-textarea", rows: 3 }); ta.value = it.text || ""; ta.addEventListener("input", () => { it.text = ta.value; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); }); ta.addEventListener("blur", blurGuard(redraw)); return ta; })(),
        h("div", { style: { marginTop: "6px" } }, condInput(it, softSave, redraw)),
      )),
    ]));

    // Les réglages propres aux CONSIDÉRANTS : la formule répétée devant chacun,
    // leur ponctuation finale, et le choix de les lire d'un seul alinéa.
    if (node.type === "considerants") {
      root.appendChild(sec([
        h("span", { class: "inspector__label", text: "Considérants" }),
        textField({
          label: "Formule placée devant chaque considérant", value: md.formule, placeholder: "Considérant que",
          onChange: (v) => { node.formule = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); },
        }),
        selectField({
          label: "Ponctuation finale", value: md.fin, options: choixDe(RECITAL_FINS),
          onChange: (v) => { node.fin = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); },
        }),
        choiceField({
          label: "En un seul alinéa", value: !!md.inline,
          options: [{ value: false, label: "Un par paragraphe" }, { value: true, label: "Tous suivis" }],
          onChange: (v) => { node.inline = v; softSave(); redraw(); },
        }),
        h("p", { class: "fr-small fr-muted", text: "La ponctuation est ajoutée seulement si le considérant ne la porte pas déjà. La formule n'est pas répétée quand le texte la commence déjà." }),
      ]));
    }
  }

  // Un TABLEAU : sa légende, ses réglages de présentation, puis SA GRILLE — une
  // case par cellule, un bouton par geste (insérer, retirer, déplacer). La même
  // grille se réécrit en place dans le document ; les deux chemins écrivent le
  // même tableau.
  if (node.type === "table") {
    const md = paramsBloc(node);
    root.appendChild(sec([
      h("span", { class: "inspector__label", text: "Tableau" }),
      textField({
        label: "Légende du tableau", value: node.caption || "",
        onChange: (v) => { node.caption = v; softSave(); refreshPaper(trame, ed, redraw, softSave, ctxSample); },
      }),
      selectField({
        label: "Position de la légende", value: md.captionPos, options: choixDe(TABLE_CAPTION_POS),
        onChange: (v) => { node.captionPos = v; softSave(); redraw(); },
      }),
      choiceField({
        label: "Ligne d'en-tête", value: md.head !== false,
        options: [{ value: true, label: "Oui" }, { value: false, label: "Non" }],
        onChange: (v) => { node.head = v; softSave(); redraw(); },
      }),
      selectField({
        label: "Disposition", value: md.layout, options: choixDe(TABLE_LAYOUTS),
        onChange: (v) => { node.layout = v; softSave(); redraw(); },
      }),
      selectField({
        label: "Alignement des cellules", value: md.align, options: choixDe(TABLE_ALIGNS),
        onChange: (v) => { node.align = v; softSave(); redraw(); },
      }),
      h("p", { class: "fr-small fr-muted", text: "« Comme la feuille de style » laisse la charte décider ; un choix explicite ne s'applique qu'à ce tableau." }),
    ]));
    root.appendChild(sec([
      sectionHeader("Lignes et colonnes", h("span", { class: "fr-small fr-muted", text: (node.columns || []).length + " × " + (node.rows || []).length })),
      tableGridEditor(node, redraw, softSave, () => refreshPaper(trame, ed, redraw, softSave, ctxSample)),
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

  // Les commentaires ont leur propre onglet (« Commentaires ») : ils portent sur
  // toute la trame, pas seulement sur ce bloc, et ils doivent rester visibles.
  // On indique ici où les retrouver, plutôt que de les répéter.
  root.appendChild(sec([
    sectionHeader("Commentaires", (node.notes || []).length
      ? button("Voir (" + node.notes.length + ")", { variant: "secondary", size: "sm", icon: "note", onClick: () => { ed.tab = "commentaires"; redraw(); } })
      : button("Commenter", { variant: "secondary", size: "sm", icon: "note", onClick: () => openCommentComposer(node, -1, "") })),
    h("p", { class: "fr-small fr-muted", text: (node.notes || []).length
      ? "Ce bloc porte " + (node.notes.length === 1 ? "un commentaire" : node.notes.length + " commentaires") + ", affiché" + (node.notes.length === 1 ? "" : "s") + " sous lui dans la page et repris dans l'onglet « Commentaires »."
      : "Aucun commentaire sur ce bloc. Sélectionnez un passage dans la page pour le citer, ou cliquez « Commenter »." }),
  ]));
}

// Les mêmes puces que la réserve, mais pour insérer au curseur d'une zone de
// saisie : le texte se règle aussi depuis l'inspecteur.
function pucesChamps(trame, onPick) {
  const liste = (trame.fields || []).map((f) => puce("champ", f.label || f.id, "{{" + f.id + "}}", "doc", () => onPick("{{" + f.id + "}}")));
  if (!liste.length) liste.push(h("span", { class: "palette__aide", text: "Aucun champ pour l'instant : créez-en un dans la réserve, à gauche." }));
  return [...liste, ...autoTokensDe(trame).map((t) => puce("auto", t.label, "{{" + t.token + "}}", "check", () => onPick("{{" + t.token + "}}")))];
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
  // La zone grandit avec le texte : un commentaire long reste lisible d'un coup
  // d'œil, sans barre de défilement (on le relit, on ne le saisit pas au clavier).
  const autosize = () => { ta.style.height = "auto"; ta.style.height = Math.max(52, ta.scrollHeight + 2) + "px"; };
  ta.addEventListener("input", () => { nt.text = ta.value; softSave(); autosize(); });
  ta.addEventListener("blur", blurGuard(redraw));
  requestAnimationFrame(autosize);
  const authorIn = h("div", {
    class: "fr-small fr-muted",
    style: { marginTop: "6px" },
    title: "L'auteur d'un commentaire est le service du compte connecté",
    text: "Auteur : " + (nt.author || "—") + (nt.date ? " · " + nt.date : ""),
  });
  return h("div", { class: "note-card note-card--" + (nt.kind || "info") },
    h("div", { class: "note-card__head" }, kindSel, h("div", { class: "fr-spacer" }),
      button("", { variant: "tertiary", icon: "trash", size: "sm", onClick: () => { node.notes.splice(i, 1); touch("trames", { rerender: false }); redraw(); } })),
    nt.quote ? h("p", { class: "note-quote", text: nt.quote }) : null,
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
      { auDoigt: true },
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

// L'ÉCHELLE des divisions d'une trame. C'est une donnée de la trame, non du
// logiciel : l'éditeur en fixe les mots (« Livre », « Titre », « Partie »…),
// l'ordre (l'échelon 1 est le plus haut) et la numérotation de chacun. Tant
// qu'on n'y touche pas, la trame suit l'échelle livrée.
function echelleEditor(trame, redraw, softSave) {
  const box = h("div", { class: "fr-stack" });
  const poser = (list) => {
    trame.divisions = list.map((n, i) => ({ level: i + 1, label: n.label || "Division", num: n.num || "decimal" }));
    touch("trames", { rerender: false });
  };
  const list = ladderOf(trame);
  list.forEach((n, i) => {
    const changer = (patch) => {
      const suivante = list.map((x, k) => (k === i ? { ...x, ...patch } : { ...x }));
      poser(suivante);
      softSave();
    };
    box.appendChild(h("div", { class: "note-card", style: { borderLeftColor: "var(--brand)" } },
      h("div", { class: "fr-row" },
        h("strong", { class: "fr-small", text: "Échelon " + n.level }),
        h("div", { class: "fr-spacer" }),
        button("", { variant: "tertiary", icon: "up", size: "sm", title: "Monter cet échelon", onClick: () => {
          if (i === 0) return;
          const s = list.map((x) => ({ ...x }));
          [s[i - 1], s[i]] = [s[i], s[i - 1]];
          poser(s); softSave(); redraw();
        } }),
        button("", { variant: "tertiary", icon: "down", size: "sm", title: "Descendre cet échelon", onClick: () => {
          if (i >= list.length - 1) return;
          const s = list.map((x) => ({ ...x }));
          [s[i + 1], s[i]] = [s[i], s[i + 1]];
          poser(s); softSave(); redraw();
        } }),
        button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Retirer cet échelon", onClick: () => {
          poser(list.filter((_, k) => k !== i));
          softSave(); redraw();
        } }),
      ),
      textField({
        label: "Mot imprimé", value: n.label,
        help: "Ce qui s'écrit devant le numéro : « Livre », « Titre », « Partie », « Chapitre », « Section », « Annexe »…",
        onChange: (v) => changer({ label: v }),
      }),
      selectField({
        label: "Numérotation", value: n.num,
        options: NUM_STYLES.map((s) => ({ value: s.id, label: s.label })),
        onChange: (v) => { changer({ num: v }); redraw(); },
      }),
    ));
  });
  box.appendChild(button("Ajouter un échelon", {
    variant: "secondary", size: "sm", icon: "plus",
    onClick: () => { poser([...list, { label: "Section", num: "decimal" }]); softSave(); redraw(); },
  }));
  if (!(trame.divisions || []).length) {
    box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: "Cette trame suit l'échelle livrée. La première modification ci-dessus la fixera pour elle seule." }));
  }
  return box;
}

function renderTrameInspector(root, trame, redraw, softSave) {
  root.appendChild(h("div", { class: "inspector__section" },
    h("span", { class: "inspector__label", text: "Identité de la trame" }),
    textField({ label: "Nom", value: trame.name, onChange: (v) => { trame.name = v; softSave(); } }),
    textField({ label: "Version", value: trame.version, onChange: (v) => { trame.version = v; softSave(); } }),
    choiceField({
      label: "Statut", value: trame.status,
      options: [{ value: "draft", label: "Brouillon" }, { value: "published", label: "Mise à disposition" }, { value: "archived", label: "Archivée" }],
      help: "« Mise à disposition » est le statut qui ouvre la trame aux services : c'est le même geste que le bouton du même nom, sur la carte de la trame et en tête de cet écran. Tant que la trame n'est pas mise à disposition, elle reste à l'atelier.",
      onChange: (v) => {
        if (v === trame.status) return;
        // Les deux passages qui engagent (ouvrir aux services, refermer) passent
        // par les mêmes gestes que le bouton — journalisés, avec confirmation.
        if (v === "published") { mettreADisposition(trame, { redraw }); return; }
        if (v === "draft" && trameEstDisponible(trame)) { retirerMiseADisposition(trame, { redraw }); return; }
        trame.status = v; softSave(); redraw();
      },
    }),
    selectField({ label: "Famille", value: trame.familyId, placeholder: "—", options: (state.config.families || []).map((f) => ({ value: f.id, label: f.label })), onChange: (v) => { trame.familyId = v; softSave(); } }),
    selectField({ label: "Type d'acte", value: trame.actTypeId, options: (state.config.actTypes || []).map((a) => ({ value: a.id, label: a.label })), onChange: (v) => { trame.actTypeId = v; softSave(); } }),
    choiceField({
      label: "Nature du document", value: natureDe(trame),
      options: ACTE_NATURES.map((n) => ({ value: n.id, label: n.label })),
      help: natureDocs(natureDe(trame)).hint
        + " — Les documents NON JURIDIQUES (verbatim d'assemblée, déclaration, vœu) se publient au recueil comme les actes, mais leur publication ne les rend ni opposables ni exécutoires : le recueil les présente comme des documents, sans entrée en vigueur, et les formalités d'exécution ne s'y appliquent pas."
        + (natureDe(trame) === "annexe" ? " Les actes issus d'une trame d'annexe ne sont pas modifiés comme les autres — voir la fiche de l'acte, « Modifier l'annexe »." : ""),
      onChange: (v) => { trame.nature = v; softSave(); redraw(); },
    }),
    h("label", { class: "fr-check" }, (() => {
      const c = h("input", { type: "checkbox", checked: trame.assemblee === true });
      c.addEventListener("change", () => { trame.assemblee = c.checked; softSave(); redraw(); });
      return c;
    })(), "Acte d'assemblée (délibération, verbatim de séance, déclaration, vœu…)"),
    trame.assemblee
      ? h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: "L'acte émane d'une ASSEMBLÉE délibérante (conseil municipal, conseil d'administration) : sa ligne d'autorité est celle de l'assemblée (« Le conseil municipal de … »), non celle d'une personne, tandis qu'il est signé par le président de cette assemblée — le maire, ou le président du conseil d'administration. Le jeton {{autorite}} rend la formule de l'assemblée. Les assemblées et leur signataire se règlent dans Administration › Assemblées." })
      : null,
    natureDe(trame) === "annexe"
      ? h("label", { class: "fr-check" }, (() => {
        const c = h("input", { type: "checkbox", checked: trame.adoptionVisa !== false });
        c.addEventListener("change", () => { trame.adoptionVisa = c.checked; softSave(); redraw(); });
        return c;
      })(), "Rappeler l'acte d'adoption dans les visas")
      : null,
    natureDe(trame) === "annexe"
      ? h("label", { class: "fr-check" }, (() => {
        const c = h("input", { type: "checkbox", checked: trame.reglement === true });
        c.addEventListener("change", () => { trame.reglement = c.checked; softSave(); redraw(); });
        return c;
      })(), "C'est un RÈGLEMENT : le publier aussi à part, au recueil")
      : null,
    natureDe(trame) === "annexe" && trame.reglement === true
      ? h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: "Un règlement est un texte NORMATIF : le recueil en donne une publication informative autonome — son texte en vigueur s'y consulte pour lui-même, comme un code, sous son propre identifiant —, en plus de sa place dans l'acte qui l'adopte. Les actes qui l'adoptent ou le modifient en publient les versions successives. Une annexe qui n'est pas un règlement (un tableau, une grille) ne reçoit rien de tel." })
      : null,
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
      ? (natureJuridiqueDe(trame)
        ? "Les actes issus de cette trame sont signés puis publiés : le service leur attribue un identifiant ELI et ils deviennent opposables à leur entrée en vigueur."
        : `Ce document non juridique (${natureDocs(natureDe(trame)).label.toLowerCase()}) se publie au recueil comme un acte — il y reçoit son identifiant ELI et s'y consulte —, mais sa publication ne le rend NI opposable NI exécutoire : le recueil le présente comme un document, sans entrée en vigueur, et les délais d'exécution ne s'y appliquent pas.`)
      : "Trame non publiable : les actes issus de cette trame (actes individuels — revalorisation d'un traitement, sanction, etc.) sont rédigés, signés et conservés au registre, mais jamais déposés au recueil." }),
    h("span", { class: "inspector__label", style: { marginTop: "10px" }, text: "Signature" }),
    selectField({
      label: "Circuit de signature", value: trame.signature || "",
      options: MODES_TRAME.map((m) => ({ value: m.id, label: m.label })),
      help: "Trois circuits (voir Administration › Signature). ÉLECTRONIQUE : signé dans l'outil du prestataire. SIMPLE : signé dans l'application, par le signataire, avec son compte — les mentions nominatives restent dans l'original interne, jamais diffusées. EXTERNE : le document est téléchargé prêt à signer, signé hors de l'application (papier ou outil tiers), puis la version signée (PDF) est déposée, et le réviseur certifie sa conformité avec la version numérique avant publication. « Imposé » l'exige pour cette trame ; « autorisé » le laisse au choix du rédacteur, acte par acte.",
      onChange: (v) => { trame.signature = v; redraw(); softSave(); },
    }),
    h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: (() => {
      const c = circuitPour(state.config, trame);
      return (c.source === "trame" ? trameModeLabel(trame.signature || "") + " — " : "Suivant le réglage général — ")
        + "circuit retenu : " + modeLabel(c.mode) + (c.choix ? ", au choix du rédacteur pour chaque acte." : ".")
        + (c.mode === "externe" ? " Le réviseur certifiera la conformité de la pièce signée." : "");
    })() }),
    h("span", { class: "inspector__label", style: { marginTop: "10px" }, text: "Hiérarchie du document" }),
    h("p", { class: "fr-small fr-muted", style: { margin: "0" }, text: "Un texte long ne se compose pas seulement d'articles : il se range en livres, titres, chapitres, sections… L'échelle ci-dessous est celle de CETTE trame : les mots et la numérotation sont libres. Dans le document, une « Division » prend l'un de ces échelons ; l'échelon 1 est le plus haut." }),
    echelleEditor(trame, redraw, softSave),
    h("span", { class: "inspector__label", style: { marginTop: "10px" }, text: "Validation et formalités" }),
    // Le circuit de validation s'applique à toutes les trames : un référentiel
    // sans circuit n'a simplement rien à choisir ici.
    ...[
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
    ],
    natureJuridiqueDe(trame) ? choiceField({
      label: "Transmission au contrôle de légalité", value: trame.transmission || "",
      options: DISPENSES.map((d) => ({ value: d.id, label: d.label })),
      help: "Presque toujours requise : c'est elle qui fait courir le délai de deux mois du représentant de l'État.",
      onChange: (v) => { trame.transmission = v; softSave(); },
    }) : null,
    natureJuridiqueDe(trame) ? choiceField({
      label: "Notification aux intéressés", value: trame.notification || "",
      options: DISPENSES.map((d) => ({ value: d.id, label: d.label })),
      help: "Requise pour un acte individuel (revalorisation, sanction, nomination…), qui ne se publie pas et n'est opposable qu'une fois notifié.",
      onChange: (v) => { trame.notification = v; softSave(); },
    }) : h("p", { class: "fr-small fr-muted", text: "Document NON JURIDIQUE : il n'est ni transmis au contrôle de légalité, ni notifié aux intéressés, et aucun délai d'exécution ne court à sa publication. Ses formalités n'ont donc pas lieu d'être réglées ici." }),
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
