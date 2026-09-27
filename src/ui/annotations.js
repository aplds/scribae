// ============================================================================
// Les commentaires d'une trame — « annotations ».
//
// Un commentaire est posé sur un BLOC du document (un article, un paragraphe, un
// visa, une division…) et peut citer un PASSAGE : la phrase que l'éditeur a
// sélectionnée dans la page. Deux exigences tiennent tout ce module :
//
//   1. on commente CE QU'ON VOIT — l'article sur lequel on travaille, le passage
//      qu'on vient de sélectionner — sans passer par un plan ni par une liste ;
//   2. un commentaire ne peut PAS passer inaperçu. Il s'affiche donc dans la
//      page, sous le bloc qu'il vise, en bande nettement distincte du texte de
//      l'acte. (C'est la différence voulue avec un commentaire Word, qui dort
//      dans une marge, ou dans une bulle qu'on n'ouvre jamais.)
//   3. un commentaire se CLOS — « traité », par qui et quand. Une trame se
//      relit alors en ne montrant que ce qui reste ouvert, sans que les
//      consignes appliquées disparaissent du document.
//
// Le module ne connaît ni la trame ni la vue : il reçoit des notes et des
// rappels (`onEdit`, `onDelete`, `onAdd`). Il sert donc les deux écrans qui
// comptent : l'éditeur de trame (où l'on écrit les commentaires) et la
// rédaction (où le rédacteur les lit — en lecture seule).
// ============================================================================
import { h, button, icon, modal } from "./dom.js";
import { NOTE_KINDS } from "../lib/schema.js";

export const noteKind = (id) => NOTE_KINDS.find((k) => k.id === id) || NOTE_KINDS[1];

// ------------------------------------------------------------------ lecture
// Le FIL d'un commentaire : ses réponses, dans l'ordre où elles ont été écrites,
// chacune signée du service de son auteur et datée. Un point à arbitrer se
// discute avant d'être tranché — le fil garde la discussion, là où le commentaire
// ne gardait qu'une voix (voir `noteComposer`, mode « reponse »).
export function noteThread(reponses, { editable = false, onDelete } = {}) {
  const list = (reponses || []).filter(Boolean);
  if (!list.length) return null;
  const box = h("div", { class: "annot__thread" });
  list.forEach((r, i) => box.appendChild(h("div", { class: "annot__reply" },
    h("div", { class: "annot__reply-meta" },
      h("span", { class: "annot__reply-who", text: r.author || "—" }),
      r.date ? h("span", { class: "annot__when", text: r.date }) : null,
      h("span", { class: "fr-spacer" }),
      editable && onDelete ? h("button", {
        class: "annot__btn annot__btn--danger", type: "button", title: "Supprimer cette réponse",
        onClick: (e) => { e.stopPropagation(); onDelete(r, i); },
      }, icon("trash", 11)) : null,
    ),
    h("p", { class: "annot__reply-text", text: r.text || "—" }),
  )));
  return box;
}

// Un commentaire TRAITÉ : la consigne a été appliquée (ou le point tranché).
// L'état est porté par le commentaire lui-même (`resolu`, `resoluPar`,
// `resoluLe`) et voyage donc avec la trame, ses exports et ses imports — voir
// `lib/trame-format.js` et `lib/export.js`.
export const noteResolue = (nt) => !!(nt && nt.resolu === true);

// « Traité par X le Y » — la mention qui accompagne la pastille, et que les
// écrans reprennent telle quelle.
export function mentionTraite(nt) {
  const qui = nt && nt.resoluPar ? " par " + nt.resoluPar : "";
  const quand = nt && nt.resoluLe ? " le " + nt.resoluLe : "";
  return "Traité" + qui + quand;
}

// `ouvertes` ne compte que les commentaires NON traités : c'est la question
// qu'on se pose en relisant une trame (« qu'est-ce qui reste ouvert ? »).
export function countNotes(body, { ouvertes = false } = {}) {
  let n = 0;
  const walk = (nodes) => (nodes || []).forEach((x) => {
    if (!x) return;
    for (const nt of (x.notes || [])) if (!ouvertes || !noteResolue(nt)) n += 1;
    walk(x.blocks);
  });
  walk(body || []);
  return n;
}

// Le compte d'une liste plate de commentaires : total, ouverts, traités.
export function compteNotes(notes) {
  const list = (notes || []).filter(Boolean);
  const resolues = list.filter(noteResolue).length;
  return { total: list.length, resolues, ouvertes: list.length - resolues };
}

// Les blocs qui portent au moins un commentaire, dans l'ordre du document.
// `labelOf(node, numéroDArticle)` nomme le bloc (« Article 3 — Objet », « Visas (2) »)
// — c'est la même nomenclature que le plan, fournie par l'appelant.
export function notesIndex(body, labelOf = () => "") {
  const out = [];
  let articles = 0;
  const walk = (nodes, base) => (nodes || []).forEach((n, i) => {
    if (!n) return;
    const path = `${base}.${i}`;
    if (n.type === "article") articles += 1;
    if ((n.notes || []).length) out.push({ path, node: n, notes: n.notes, label: labelOf(n, articles) });
    if (n.blocks) walk(n.blocks, `${path}.blocks`);
  });
  walk(body || [], "body");
  return out;
}

// Regroupe une liste plate de notes (les `doc.notes` compilés) par bloc visé.
export function notesByPath(notes) {
  const map = new Map();
  for (const n of notes || []) {
    if (!n || !n.path) continue;
    if (!map.has(n.path)) map.set(n.path, []);
    map.get(n.path).push(n);
  }
  return map;
}

// ------------------------------------------------------------ la bande visible
// Ce qu'on voit dans la page, sous chaque bloc commenté. `editable` laisse
// apparaître le crayon et la corbeille ; sans lui, c'est une CONSIGNE, que le
// rédacteur lit mais ne modifie pas.
export function annotationStrip({ notes, editable = false, title = "", variant = "", bare = false, onEdit, onDelete, onAdd, onToggle, onReply } = {}) {
  const list = (notes || []).filter(Boolean);
  if (!list.length) return null;
  const box = h("div", { class: "annot" + (variant ? " annot--" + variant : "") + (bare ? " annot--bare" : ""), contenteditable: "false" });
  if (!bare || onAdd) {
    const head = h("div", { class: "annot__head" },
      h("span", { class: "annot__icon" }, icon("note", 13)),
      h("span", { class: "annot__title", text: title || (list.length > 1 ? `${list.length} commentaires` : "Commentaire") }),
      h("span", { class: "fr-spacer" }),
    );
    if (editable && onAdd) {
      head.appendChild(h("button", {
        class: "annot__add", type: "button", title: "Ajouter un commentaire ici",
        onClick: (e) => { e.stopPropagation(); onAdd(); },
      }, icon("plus", 13)));
    }
    box.appendChild(head);
  }
  list.forEach((nt, i) => box.appendChild(annotationItem(nt, i, { editable, onEdit, onDelete, onToggle, onReply })));
  return box;
}

function annotationItem(nt, i, { editable, onEdit, onDelete, onToggle, onReply }) {
  const kind = noteKind(nt.kind);
  const resolu = noteResolue(nt);
  const actions = [];
  // Répondre : le fil du commentaire. C'est la suite naturelle d'un point à
  // arbitrer, qui se discute avant d'être tranché.
  if (onReply) {
    const nb = (nt.reponses || []).length;
    actions.push(h("button", {
      class: "annot__btn" + (nb ? " is-on" : ""), type: "button",
      title: nb ? `Répondre (${nb} réponse${nb > 1 ? "s" : ""} déjà dans le fil)` : "Répondre à ce commentaire",
      onClick: (e) => { e.stopPropagation(); onReply(nt, i); },
    }, icon("bulle", 12), nb ? h("span", { class: "annot__count", text: String(nb) }) : null));
  }
  // Le geste « traité » est offert dès qu'un appelant l'ouvre (`onToggle`) :
  // l'éditeur de trame le propose, la rédaction se contente de le MONTRER.
  if (onToggle) {
    actions.push(h("button", {
      class: "annot__btn annot__btn--done" + (resolu ? " is-on" : ""), type: "button",
      title: resolu ? "Rouvrir ce commentaire" : "Marquer ce commentaire comme traité",
      onClick: (e) => { e.stopPropagation(); onToggle(nt, i); },
    }, icon(resolu ? "refresh" : "check", 12)));
  }
  if (editable && onEdit) {
    actions.push(h("button", {
      class: "annot__btn", type: "button", title: "Modifier ce commentaire",
      onClick: (e) => { e.stopPropagation(); onEdit(nt, i); },
    }, icon("edit", 12)));
  }
  if (editable && onDelete) {
    actions.push(h("button", {
      class: "annot__btn annot__btn--danger", type: "button", title: "Supprimer ce commentaire",
      onClick: (e) => { e.stopPropagation(); onDelete(nt, i); },
    }, icon("trash", 12)));
  }
  return h("div", { class: "annot__item" + (resolu ? " annot__item--done" : "") },
    h("div", { class: "annot__meta" },
      h("span", { class: "fr-badge fr-badge--" + kind.color, text: kind.label }),
      resolu ? h("span", { class: "fr-badge fr-badge--success annot__done", title: mentionTraite(nt), text: "Traité" }) : null,
      nt.author ? h("span", { class: "annot__who", text: nt.author }) : null,
      nt.date ? h("span", { class: "annot__when", text: nt.date }) : null,
      h("span", { class: "fr-spacer" }),
      actions.length ? h("span", { class: "annot__actions" }, ...actions) : null,
    ),
    nt.quote ? h("p", { class: "annot__quote", text: nt.quote }) : null,
    h("p", { class: "annot__text", text: nt.text || "—" }),
    noteThread(nt.reponses),
  );
}

// ------------------------------------------------------------------ composer
// La fenêtre d'écriture. Elle sert pour un commentaire neuf (éventuellement
// adossé à un passage) comme pour la reprise d'un commentaire existant.
export function noteComposer({ note = null, quote = "", author = "", date = "", context = "", mode = "note", onSave, onDelete } = {}) {
  const repondre = mode === "reponse";
  const editing = !!note && !repondre;
  const wrap = h("div", { class: "fr-stack" });

  if (context) wrap.appendChild(h("p", { class: "note-context", text: context }));
  if (quote) wrap.appendChild(h("blockquote", { class: "note-quote", text: quote }));
  // En réponse, on rappelle le commentaire auquel on répond : le fil se lit
  // depuis la carte du commentaire, mais la fenêtre doit dire sur quoi on parle.
  if (repondre && note) wrap.appendChild(h("blockquote", { class: "note-quote", text: note.text || "—" }));

  // La nature qualifie une CONSIGNE : une réponse n'en porte pas.
  let kind = note?.kind || "instruction";
  if (!repondre) {
    wrap.appendChild(h("p", { class: "inspector__label", text: "Nature du commentaire" }));
    const natures = h("div", { class: "fr-choices" });
    for (const k of NOTE_KINDS) {
      natures.appendChild(h("button", {
        type: "button", class: "fr-choice" + (k.id === kind ? " is-on" : ""),
        onClick: (e) => {
          kind = k.id;
          for (const b of natures.children) b.classList.toggle("is-on", b === e.currentTarget);
        },
      }, k.label));
    }
    wrap.appendChild(natures);
  }

  const ta = h("textarea", {
    class: "fr-textarea", rows: 4,
    placeholder: repondre ? "Ex. : vérifié avec le service, la délégation a été retirée le 12…" : "Ex. : vérifier que l'agent n'a pas déjà une délégation sur ce périmètre…",
  });
  ta.value = repondre ? "" : (note?.text || "");
  wrap.appendChild(h("p", { class: "inspector__label", style: { marginTop: repondre ? "0" : "10px" }, text: repondre ? "Votre réponse" : "Le commentaire" }));
  wrap.appendChild(ta);
  const err = h("p", { class: "fr-error-text", hidden: true, text: repondre ? "Écrivez d'abord la réponse." : "Écrivez d'abord le commentaire." });
  wrap.appendChild(err);

  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "8px" },
    text: repondre
      ? `Signée du service de votre compte (${author}${date ? " · " + date : ""}). La réponse s'ajoute au fil du commentaire : elle reste dans le document, avec les autres.`
      : `Signé du service de votre compte (${author}${date ? " · " + date : ""}). Les commentaires accompagnent la préparation : ils ne sont pas publiés, mais ils restent dans le document et partent dans les exports.` }));

  const m = modal({
    title: repondre ? "Répondre au commentaire" : (editing ? "Modifier le commentaire" : "Nouveau commentaire"),
    body: wrap,
    actions: (close) => [
      editing && onDelete ? button("Supprimer", { variant: "tertiary", icon: "trash", onClick: () => { onDelete(); close(); } }) : null,
      button("Annuler", { variant: "secondary", onClick: close }),
      button(repondre ? "Répondre" : (editing ? "Enregistrer" : "Ajouter le commentaire"), {
        variant: "primary", icon: "check",
        onClick: () => {
          const text = ta.value.trim();
          if (!text) { err.hidden = false; ta.focus(); return; }
          onSave(repondre ? { text: text } : { kind, text: text, quote: quote });
          close();
        },
      }),
    ],
  });
  setTimeout(() => ta.focus(), 40);
  return m;
}
// -------------------------------------------------- commenter une sélection
// Un passage se sélectionne à la souris dans la page ; une pastille « Commenter »
// apparaît juste au-dessus. Un seul geste, et l'on cite exactement ce qu'on a
// montré — sans avoir à recopier le texte.
let bubble = null;

export function closeSelectionBubble() {
  if (bubble) { bubble.remove(); bubble = null; }
}

function placeBubble(el, rect) {
  const w = el.offsetWidth, hgt = el.offsetHeight;
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - w / 2), window.innerWidth - w - 8);
  let top = rect.top - hgt - 8;
  if (top < 8) top = Math.min(rect.bottom + 8, window.innerHeight - hgt - 8);
  el.style.left = left + "px";
  el.style.top = top + "px";
}

export function armSelectionComment(host, { onComment } = {}) {
  const onUp = (e) => {
    if (bubble && bubble.contains(e.target)) return;
    // On attend la fin de l'événement : au `mouseup`, la sélection est encore
    // celle du navigateur, mais elle peut être effacée par le clic suivant.
    setTimeout(() => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) { closeSelectionBubble(); return; }
      const range = sel.getRangeAt(0);
      if (!host.contains(range.commonAncestorContainer)) { closeSelectionBubble(); return; }
      const quote = sel.toString().replace(/\s+/g, " ").trim().slice(0, 240);
      if (quote.length < 2) { closeSelectionBubble(); return; }
      const start = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
      const bloc = start?.closest?.(".blk[data-path]");
      if (!bloc) { closeSelectionBubble(); return; }
      const rect = range.getBoundingClientRect();
      closeSelectionBubble();
      bubble = h("button", {
        class: "sel-bubble", type: "button", title: "Commenter le passage sélectionné",
        on: { mousedown: (ev) => ev.preventDefault() },
      }, icon("note", 13), h("span", { text: "Commenter" }));
      bubble.addEventListener("click", () => {
        closeSelectionBubble();
        document.getSelection()?.removeAllRanges?.();
        onComment?.({ path: bloc.dataset.path, quote });
      });
      document.body.appendChild(bubble);
      placeBubble(bubble, rect);
    }, 0);
  };
  const onKey = (e) => { if (e.key === "Escape") closeSelectionBubble(); };
  const onScroll = () => closeSelectionBubble();
  const onClickAway = (e) => { if (bubble && !bubble.contains(e.target) && !host.contains(e.target)) closeSelectionBubble(); };
  host.addEventListener("mouseup", onUp);
  document.addEventListener("keydown", onKey);
  document.addEventListener("scroll", onScroll, true);
  document.addEventListener("mousedown", onClickAway, true);
  return () => {
    host.removeEventListener("mouseup", onUp);
    document.removeEventListener("keydown", onKey);
    document.removeEventListener("scroll", onScroll, true);
    document.removeEventListener("mousedown", onClickAway, true);
    closeSelectionBubble();
  };
}

// Défile jusqu'au bloc visé et le fait clignoter : le lien entre un commentaire
// et l'endroit du document qu'il vise doit être immédiat.
export function flashBlock(host, path) {
  const el = host?.querySelector?.(`.blk[data-path="${String(path).replace(/["\\]/g, "\\$&")}"]`)
    || host?.querySelector?.(`[data-node="${String(path).replace(/["\\]/g, "\\$&")}"]`);
  if (!el) return false;
  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("annot-flash");
  setTimeout(() => el.classList.remove("annot-flash"), 1600);
  return true;
}
