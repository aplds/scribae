import { formatDate } from "./util.js";
import { amendmentMentions, amendmentMention } from "./amend.js";
import { styleForDoc, paperPadding } from "./styles.js";
import { qualitePersonne } from "./delegations.js";
import { annexesVocab } from "./annexes.js";

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};

// La marque d'une liste, quand le bloc ne suit pas la feuille de style (voir
// `LIST_MARKERS` / `LIST_NUMBERINGS`, lib/schema.js). Les valeurs des listes
// numérotées sont les noms des compteurs déclarés par la feuille (« 1° », « a) »,
// « i. » — voir `COUNTER_STYLES`, lib/styles.js). Les écrans d'édition s'en
// servent aussi (`views/editor.js`, `views/wysiwyg.js`) : la liste de l'aperçu
// doit montrer la même marque que la liste compilée.
export const MARQUE_STYLE = {
  disc: "disc", circle: "circle", square: "square", dash: "'– '", none: "none",
  decimal: "decimal", degree: "scribae-degree", parenth: "scribae-parenth",
  lalpha: "scribae-lalpha", ualpha: "scribae-ualpha",
  lroman: "scribae-lroman", uroman: "scribae-uroman",
};

export function personName(p) {
  if (!p) return "";
  return [p.civility, p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

// Le nom du signataire tel qu'il s'imprime : « Prénom Nom ». La civilité n'y
// figure pas — la qualité, juste au-dessus, dit déjà de qui il s'agit
// (« Le Maire, »), et la reprendre ferait doublon. `personName` (avec civilité)
// reste la forme des listes, des menus et des sélecteurs.
export function personSignatureName(p) {
  if (!p) return "";
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

// La qualité qui s'imprime sous (ou plutôt au-dessus de) le nom : celle du
// référentiel, accordée en genre. « label » n'est qu'un repère de liste
// (« Adjoint / Adjointe au maire ») : il ne doit jamais s'imprimer.
export function personRole(p, config) {
  if (!p) return "";
  return p.qualite || qualitePersonne(config, p);
}

// Les lignes de qualité d'une signature : une seule quand le signataire agit en
// son nom, toute la chaîne de délégations sinon — « Le Maire, », « Par
// délégation, l'adjoint au maire en charge de l'urbanisme, », « Par
// subdélégation, le chef de bureau Urbanisme, ». Voir src/lib/delegations.js.
export function personRoleLines(p, config) {
  if (!p) return [];
  if ((p.qualites || []).length) return p.qualites;
  const q = personRole(p, config);
  return q ? [q] : [];
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
  // `opts.sheet === false` : rendre le document SANS sa charte — ni l'attribut
  // qui la désigne (`data-sheet`), ni son en-tête ni son pied. C'est ce
  // qu'emploie la version EN LIGNE publiée : l'acte publié suit la feuille de
  // style web du recueil, jamais la charte de son entité (voir lib/recueil.js,
  // `CSS_DOCUMENT_WEB`, et lib/eli.js, `buildWebVersion`).
  const habillage = opts.sheet !== false;
  if (habillage && style?.id) root.dataset.sheet = style.id;
  if (opts.arial) root.style.fontFamily = style?.fontFamily || config.brand.documentFont || "";
  if (habillage && style?.showHeader) root.appendChild(documentSheetHeader(style, doc, config));
  if (doc?.kind === "consolide" && opts.consolidation !== false) root.appendChild(consolidationBanner(doc, o));
  o.mentions = tracking ? null : amendmentMentions(doc, config);
  for (const node of doc?.nodes || []) {
    // Une annexe ne se signe pas : c'est l'acte qui l'adopte qui est signé, et
    // sa signature lui donne son autorité (voir src/lib/annexe-docs.js). Le
    // rendu peut donc écarter le bloc de signature — ce que fait la partie
    // annexée, imprimée à la suite de l'acte d'adoption.
    if (o.sansSignature && node.type === "signature") continue;
    root.appendChild(renderNode(node, config, o));
  }
  if (opts.showNotes && doc?.notes?.length) root.appendChild(notesAppendix(doc, config));
  if (tracking && doc?.trail?.length && opts.showTrail !== false) root.appendChild(trailAppendix(doc, config));
  // Les documents ANNEXÉS : l'original de l'acte qui les adopte est SUIVI de
  // leur texte, sur une page à eux (voir `annexePart` ci-dessous). Un document
  // annexé qui porterait lui-même des annexes ne les reprend pas (`annexes:
  // false`) : le texte de l'annexe est son propre texte.
  if (opts.annexes !== false) {
    for (const joint of doc?.annexeDocs || []) root.appendChild(annexePart(joint, config, o, style));
  }
  if (habillage && style?.showFooter) root.appendChild(documentSheetFooter(style, doc, config));
  return root;
}

// La partie ANNEXÉE d'un document : l'annexe elle-même, imprimée à la suite de
// l'acte qui l'adopte, sur une nouvelle page (`.doc-annexe-part`, voir la règle
// de saut de page). Elle porte son intitulé — « Annexe n° 2026-14 du 3 avril
// 2026 » — puis son texte, rendu comme un document : sa charte, ses visas, ses
// articles. Elle ne porte PAS de signature : l'annexe tient son autorité de
// l'acte d'adoption, qui vient d'être signé au-dessus. Voir annexe-docs.js.
//
// La partie annexée est rendue avec la CHARTE de l'acte qu'elle suit : c'est le
// même document, imprimé sur le même papier, et un document exporté ne porte
// qu'une seule feuille de style. L'annexe garde son texte et ses métadonnées
// (son en-tête nomme son numéro à elle), mais l'habillage est celui de l'acte
// qui vient de l'adopter.
function annexePart(joint, config, opts = {}, style = null) {
  const sec = el("section", "doc-annexe-part");
  const head = el("div", "doc-annexe-part__head");
  head.appendChild(el("p", "doc-annexe-part__label", annexesVocab(config).label || "Annexe"));
  if (joint?.libelle) head.appendChild(el("p", "doc-annexe-part__title", joint.libelle));
  sec.appendChild(head);
  if (joint?.doc) {
    sec.appendChild(renderDocument(joint.doc, config, {
      // Ce qui suit l'acte est le document adopté : ni les notes de préparation
      // de l'atelier, ni le tableau des modifications, ni les annexes d'une
      // annexe. Le suivi des modifications, lui, suit la règle de l'ANNEXE :
      // une nouvelle rédaction adoptée se lit avec ses ajouts apparents.
      showNotes: false, showTrail: false, annexes: false,
      sansSignature: true,
      style,
      sheet: opts.sheet,
      showPaths: opts.showPaths,
      abrogations: opts.abrogations,
      compact: opts.compact,
    }));
  }
  return sec;
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
  const droit = String(style.logoRightUrl || "").trim();
  const box = el("div", "doc-sheet-header" + (droit ? " doc-sheet-header--duo" : ""));
  box.setAttribute("data-align", style.logoAlign || "left");
  if (style.logoUrl) {
    const img = el("img", "doc-sheet-logo");
    img.src = style.logoUrl;
    img.alt = "";
    box.appendChild(img);
  }
  const text = renderSheetText(style.headerText, doc, config, style);
  if (text) box.appendChild(el("p", "doc-sheet-headtext", text));
  // Le second emblème, à DROITE du filet : la marque de l'État, d'un partenaire
  // ou d'une délégation. Voir `logoRightUrl`, src/lib/styles.js.
  if (droit) {
    const img = el("img", "doc-sheet-logo doc-sheet-logo--right");
    img.src = droit;
    img.alt = "";
    box.appendChild(img);
  }
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
        // Une décision fondant la signature porte son LIEN : le visa devient un
        // lien cliquable — sur le recueil en ligne, dans le HTML autonome, dans
        // le Word et dans le PDF imprimé depuis le navigateur. Le texte, lui,
        // reste celui de la référence : l'adresse ne s'imprime jamais en clair.
        if (it.lien) {
          const a = el("a", "doc-visas-link", [it.text]);
          a.setAttribute("href", it.lien);
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
          a.setAttribute("title", it.lien);
          li.appendChild(a);
        } else {
          li.appendChild(document.createTextNode(it.text));
        }
        ul.appendChild(li);
      }
      element = ul;
      break;
    }
    case "considerants": {
      const box = el("div", cls("recitals") + (node.inline ? " doc-recitals--inline" : ""));
      const textes = (node.items || []).map((it) => it.text).filter(Boolean);
      if (node.inline && textes.length) {
        // « En un seul alinéa » : les considérants s'enchaînent dans le même
        // paragraphe — leur ponctuation finale les sépare (voir lib/compile.js).
        box.appendChild(el("p", null, textes.join(" ")));
      } else {
        for (const t of textes) box.appendChild(el("p", null, t));
      }
      element = box;
      break;
    }
    case "enact":
      element = el("p", cls("enact"), node.text);
      break;
    case "division": {
      // Une division (Livre, Titre, Chapitre, Section…) : son intitulé, puis
      // son contenu — articles et divisions imbriquées. Le rang de l'échelon
      // commande la taille du titre et le retrait ; c'est la charte qui en
      // règle l'apparence (`.doc-division--n1`…).
      const niveau = Math.max(1, Number(node.level) || 1);
      const sec = el("section", cls("division") + ` doc-division--n${niveau}`);
      if (node.path && opts.showPaths) sec.dataset.path = node.path;
      if (node.eId) sec.dataset.eid = node.eId;
      const tag = ["h2", "h3", "h4", "h5"][Math.min(niveau, 4) - 1];
      const head = el(tag, cls("division-head"));
      head.appendChild(el("span", cls("division-num"), node.numLabel || node.levelLabel || ""));
      if (node.heading) head.appendChild(el("span", cls("division-heading"), (node.numLabel || node.levelLabel ? " – " : "") + node.heading));
      sec.appendChild(head);
      for (const b of node.blocks || []) {
        if (!opts.tracking && b.change?.kind === "del") continue;
        sec.appendChild(renderNode(b, config, opts));
      }
      element = sec;
      break;
    }
    case "annexes": {
      // La liste des documents annexés à l'acte : chacun est annoncé ici par son
      // intitulé, et son TEXTE suit l'acte, à la suite de la signature (voir
      // `annexePart`). Un renvoi n'est porté que si l'annexe a une adresse de
      // recueil à elle — le cas d'un document publié avant cette règle.
      const box = el("section", cls("annexes"));
      box.appendChild(el("h2", cls("annexes-title"), annexesVocab(config).sectionTitle));
      const ul = el("ul", cls("annexes-list"));
      for (const it of node.items || []) {
        const li = el("li", cls("annexes-item"));
        // `texte` porte déjà l'intitulé complet (« Annexe — … ») : l'objet n'est
        // là que de repli, pour une identification qui ne l'aurait pas.
        const label = it.texte || it.objet || "";
        if (it.lien) {
          const a = el("a", cls("annexes-link"), label || "Annexe");
          a.setAttribute("href", it.lien);
          a.setAttribute("target", "_blank");
          a.setAttribute("rel", "noopener noreferrer");
          li.appendChild(a);
        } else {
          li.appendChild(document.createTextNode(label || "Annexe"));
        }
        ul.appendChild(li);
      }
      box.appendChild(ul);
      element = box;
      break;
    }
    case "article": {
      const sec = el("section", cls("article"));
      if (node.path && opts.showPaths) sec.dataset.path = node.path;
      if (node.eId) sec.dataset.eid = node.eId;
      const head = el("h2", cls("article-head"));
      head.appendChild(el("span", cls("article-num"), node.numLabel));
      if (node.heading) head.appendChild(el("span", cls("article-heading"), " – " + node.heading));
      sec.appendChild(head);
      const abrogated = node.change?.action === "abrogate";
      // Un article abrogé n'a plus de rédaction en vigueur : son intitulé reste
      // (la numérotation s'y appuie) et la mention de l'acte qui l'a abrogé se
      // lit dessous. Sa RÉDACTION n'est conservée que si l'appelant la demande
      // (`opts.abrogations`) : elle est alors rangée dans un bloc que la page du
      // recueil masque par défaut et révèle à la demande (« Afficher les
      // articles abrogés ») — la version papier, elle, ne la montre jamais.
      if (abrogated && !opts.tracking) sec.classList.add("doc-article--abroge");
      if (!opts.tracking) {
        // Sans le suivi des modifications : la mention de l'acte modificatif
        // sous l'intitulé, et le seul texte en vigueur.
        const mention = amendmentMention(node, opts.mentions, config);
        if (mention) sec.appendChild(el("p", "doc-amend-mention", mention));
      }
      const garderRedaction = abrogated && !opts.tracking && !!opts.abrogations;
      if (!(abrogated && !opts.tracking) || garderRedaction) {
        const corps = garderRedaction ? el("div", "doc-abroge-corps") : sec;
        if (garderRedaction) corps.appendChild(el("p", "doc-abroge-label", "Rédaction abrogée"));
        for (const b of node.blocks || []) {
          if (!opts.tracking && b.change?.kind === "del" && !garderRedaction) continue;
          corps.appendChild(renderNode(b, config, opts));
        }
        if (corps !== sec) sec.appendChild(corps);
      }
      element = sec;
      break;
    }
    case "para":
    case "raw": {
      element = el("p", cls("p"), node.text);
      if (node.type === "para") {
        // Les réglages du paragraphe (voir `paramsBloc`, lib/schema.js) : un
        // choix de bloc s'exprime en classes, pour l'emporter sur la charte
        // sans coder de couleur en dur.
        if (node.align) element.style.textAlign = node.align;
        if (node.indent) element.classList.add("doc-p--indent-" + node.indent);
        if (node.boxed) element.classList.add("doc-p--boxed");
      }
      break;
    }
    case "list": {
      const list = el(node.ordered ? "ol" : "ul", cls("list"));
      if (node.path && opts.showPaths) list.dataset.path = node.path;
      // Le marqueur (liste à puces) ou la numérotation (liste numérotée) du
      // bloc, quand il ne suit pas la feuille de style. Les compteurs sur
      // mesure — « 1° », « a) », « i. » — sont déclarés par la feuille
      // (`LIST_NUMBER`, src/lib/styles.js) : le bloc n'a qu'à les nommer.
      const marque = node.ordered ? node.numbering : node.marker;
      if (marque) list.style.listStyleType = MARQUE_STYLE[marque] || marque;
      if (node.ordered && Number(node.start) > 1) list.setAttribute("start", String(Number(node.start)));
      for (const it of node.items || []) list.appendChild(el("li", null, it.text));
      element = list;
      break;
    }
    case "table": {
      const wrap = el("div", cls("table-wrap"));
      const legende = () => (node.caption ? el("p", cls("table-caption"), node.caption) : null);
      if (node.captionPos !== "bottom" && legende()) wrap.appendChild(legende());
      const classes = cls("table")
        + (node.layout ? " doc-table--" + node.layout : "")
        + (node.align ? " doc-table--" + node.align : "");
      const t = el("table", classes);
      const rangee = (cells, tag) => {
        const tr = el("tr");
        for (const c of cells) tr.appendChild(el(tag, null, c ?? ""));
        return tr;
      };
      // « Ligne d'en-tête : non » : les intitulés de colonnes ne sont plus un
      // en-tête, ils deviennent la première ligne du tableau.
      if (node.head === false) {
        const tb = el("tbody");
        tb.appendChild(rangee(node.columns || [], "td"));
        for (const r of node.rows || []) tb.appendChild(rangee((node.columns || []).map((_, i) => r[i] ?? ""), "td"));
        t.appendChild(tb);
      } else {
        t.appendChild(el("thead", null)).appendChild(rangee(node.columns || [], "th"));
        const tb = el("tbody");
        for (const r of node.rows || []) tb.appendChild(rangee((node.columns || []).map((_, i) => r[i] ?? ""), "td"));
        t.appendChild(tb);
      }
      wrap.appendChild(t);
      if (node.captionPos === "bottom" && legende()) wrap.appendChild(legende());
      element = wrap;
      break;
    }
    case "signature": {
      const box = el("div", cls("signature"));
      box.appendChild(el("p", cls("signature-place"), `Fait à ${node.place}, le ${node.date}`));
      const right = el("div", cls("signature-block"));
      if (node.signataire) {
        if (node.showFunction !== false) {
          for (const ligne of personRoleLines(node.signataire, config)) {
            right.appendChild(el("p", cls("signature-role"), ligne));
          }
        }
        right.appendChild(el("p", cls("signature-name"), personSignatureName(node.signataire)));
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
    if (n.quote) li.appendChild(el("span", "doc-notes__quote", "« " + n.quote + " »"));
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
