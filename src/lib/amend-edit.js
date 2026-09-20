// ============================================================================
// Modification en place : de l'édition directe au plan d'amendements.
//
// L'écran « Modifier un acte » n'est pas un formulaire : le rédacteur ouvre
// l'acte publié et le réécrit directement, comme dans un traitement de texte.
// Ce module fait le lien entre les deux mondes :
//
//   • une ADRESSE stable par passage éditable, calculée sur le document
//     d'origine : `n3` (nœud 3), `n3.h` (son intitulé), `n3.b1` (bloc 1),
//     `n3.b1.i0` (premier item d'une liste), `n3.b1.t2.0` (cellule d'un
//     tableau), `n2.v1` (visa). Ces adresses ne bougent jamais : le document
//     édité peut être reconstruit autant de fois qu'il faut sans perdre la
//     saisie, et rien ne dépend de la position du curseur.
//
//   • la STRUCTURE : une modification peut ajouter ou retirer un paragraphe,
//     une ligne de liste, une ligne de tableau. Ces gestes ne touchent pas le
//     document d'origine (il est la matière, jamais réécrite) : ils vivent à
//     part, dans `session.layout` (l'ordre des entrées d'un conteneur) et
//     `session.ajouts` (les entrées ajoutées). Voir plus bas.
//
//   • la RECONSTRUCTION du texte retenu, et le calcul du plan de modifications
//     (remplacer / abroger / insérer / ajouter) que consomment ensuite
//     `buildModificatif` et `buildConsolidated`.
//
// Rien ici ne connaît le DOM : la table `edits` (adresse → texte) est produite
// par l'éditeur (`ui/views/amend-editor.js`) et lue ici.
// ============================================================================
import { clone, normalizeSpace } from "./util.js";
import { newAmend, articleKey, planAmendments } from "./amend.js";

const norm = (s) => normalizeSpace(s).replace(/\s+/g, " ");

// ---------------------------------------------------------------- adressage
export const ADDR = {
  heading: (i) => `n${i}.h`,
  block: (i, j) => `n${i}.b${j}`,
  item: (i, j, k) => `n${i}.b${j}.i${k}`,
  cell: (i, j, r, c) => `n${i}.b${j}.t${r}.${c}`,
  caption: (i, j) => `n${i}.b${j}.cap`,
  visa: (i, k) => `n${i}.v${k}`,
  recital: (i, k) => `n${i}.c${k}`,
  place: (i) => `n${i}.p`,
  ins: (id) => `x${id}`,
  insHeading: (id) => `x${id}.h`,
  insBlock: (id, j) => `x${id}.b${j}`,
  // Entrée AJOUTÉE dans un conteneur : son adresse est celle du conteneur
  // suivie du rang de l'entrée (`n3.a1f2k`, `n3.b0.a1f2k`, avec un `.c` de plus
  // pour une cellule de tableau).
  added: (containerAddr, slot) => `${containerAddr}.${slot}`,
};

// Le texte retenu pour une adresse : la saisie si elle existe, sinon le texte
// du document d'origine.
export const editedText = (session, addr, original) => {
  const v = session?.edits ? session.edits[addr] : undefined;
  return v === undefined ? (original ?? "") : v;
};

export const isEdited = (session, addr) => session?.edits ? session.edits[addr] !== undefined : false;

// Retire toutes les saisies d'un passage (l'adresse elle-même et ses enfant).
export function clearEditsUnder(session, addr) {
  for (const key of Object.keys(session.edits || {})) {
    if (key === addr || key.startsWith(addr + ".")) delete session.edits[key];
  }
}

// ------------------------------------------------------------- la structure
// Un CONTENEUR est un endroit qui porte une suite d'entrées : les blocs d'un
// article (`n3`), les items d'une liste (`n3.b1`), les rangées d'un tableau
// (`n3.b1`). Son `layout` est la liste des rangs dans l'ordre d'affichage :
//   `o<k>`  l'entrée de rang `k` du document d'origine (jamais recréée : elle
//           est lue à la source, seules ses saisies s'y ajoutent) ;
//   `a<id>`  une entrée AJOUTÉE par le rédacteur, décrite dans `session.ajouts`.
// Un conteneur sans `layout` suit simplement l'ordre d'origine : on ne
// matérialise le plan qu'à partir du premier geste de structure.
export function layoutOf(session, key, count) {
  const stored = session?.layout?.[key];
  if (stored) return stored.slice();
  return Array.from({ length: count }, (_, k) => "o" + k);
}

const setLayout = (session, key, layout) => {
  session.layout = session.layout || {};
  session.layout[key] = layout;
  return layout;
};

// Ajoute une entrée à un conteneur, juste après `afterSlot` (à la fin si
// l'entrée d'accroche est inconnue). Rend le rang de la nouvelle entrée.
export function addSlot(session, key, count, afterSlot, pour = {}) {
  const layout = layoutOf(session, key, count);
  const id = "a" + Math.random().toString(36).slice(2, 7);
  session.ajouts = session.ajouts || {};
  session.ajouts[id] = { id, ...pour };
  const at = afterSlot ? layout.indexOf(afterSlot) : -1;
  if (at < 0) layout.push(id); else layout.splice(at + 1, 0, id);
  setLayout(session, key, layout);
  return id;
}

// Retire une entrée d'un conteneur. `addr` (l'adresse de saisie de l'entrée
// d'origine, connue de l'appelant) permet d'effacer aussi ce qui y avait été
// saisi : une entrée retirée n'a plus de place dans l'acte.
export function dropSlot(session, key, count, slot, addr = "") {
  const layout = layoutOf(session, key, count).filter((s) => s !== slot);
  setLayout(session, key, layout);
  if (slot.startsWith("a")) delete session.ajouts?.[slot];
  if (addr) clearEditsUnder(session, addr);
  else clearEditsUnder(session, `${key}.${slot}`);
}

// Un conteneur a-t-il des entrées ajoutées ? (pour l'étiquette « modifié »)
export const hasAdded = (session, key) => (session?.layout?.[key] || []).some((s) => s.startsWith("a"));

// Efface la structure saisie sous un préfixe (remise à zéro d'un article).
export function clearStructureUnder(session, prefix) {
  for (const key of Object.keys(session.layout || {})) {
    if (key !== prefix && !key.startsWith(prefix + ".")) continue;
    for (const slot of session.layout[key]) {
      if (slot.startsWith("a")) delete session.ajouts?.[slot];
    }
    delete session.layout[key];
  }
}

// ------------------------------- lecture d'un article à travers les saisies
export function editedHeading(node, i, session) {
  return editedText(session, ADDR.heading(i), node.heading || "");
}

// Un bloc de l'acte d'origine, relu à travers les saisies de son texte et de sa
// structure (items de liste, rangées de tableau).
function baseBlock(node, i, j, session) {
  const b = node.blocks[j];
  if (!b) return null;
  if (b.type === "list") {
    const addr = `n${i}.b${j}`;
    const layout = layoutOf(session, addr, (b.items || []).length);
    return {
      ...clone(b),
      items: layout.map((slot) => {
        if (slot.startsWith("a")) return { id: slot, text: editedText(session, `${addr}.${slot}`, ""), when: "" };
        const k = Number(slot.slice(1));
        const it = (b.items || [])[k] || {};
        return { ...clone(it), text: editedText(session, ADDR.item(i, j, k), it.text) };
      }),
    };
  }
  if (b.type === "table") {
    const addr = `n${i}.b${j}`;
    const layout = layoutOf(session, addr, (b.rows || []).length);
    const cols = (b.columns || []).length;
    return {
      ...clone(b),
      caption: editedText(session, ADDR.caption(i, j), b.caption || ""),
      rows: layout.map((slot) => {
        if (slot.startsWith("a")) {
          return Array.from({ length: cols }, (_, c) => editedText(session, `${addr}.${slot}.${c}`, ""));
        }
        const r = Number(slot.slice(1));
        return (b.rows[r] || []).map((c, ci) => editedText(session, ADDR.cell(i, j, r, ci), c));
      }),
    };
  }
  return { ...clone(b), text: editedText(session, ADDR.block(i, j), b.text) };
}

// Un bloc AJOUTÉ par le rédacteur : un paragraphe, pour l'instant — c'est le
// seul bloc dont l'ajout a un sens au sein d'un article existant (une liste ou
// un tableau s'ajoutent par la trame, pas dans une modification d'acte).
function addedBlock(session, key, slot) {
  const addr = `${key}.${slot}`;
  return { id: slot, type: "para", text: editedText(session, addr, ""), when: "", notes: [] };
}

// Le contenu d'un article, dans l'ordre réellement affiché : entrées d'origine
// (relues à travers les saisies) et entrées ajoutées, mêlées selon le plan.
// `slot` est le rang de l'entrée dans son conteneur — l'éditeur en a besoin
// pour poser ses outils (ajouter après celle-ci, retirer celle-là).
export function blocksWithSlots(node, i, session) {
  const key = `n${i}`;
  return layoutOf(session, key, (node.blocks || []).length)
    .map((slot) => ({ slot, block: slot.startsWith("a") ? addedBlock(session, key, slot) : baseBlock(node, i, Number(slot.slice(1)), session) }))
    .filter((x) => x.block);
}

export function editedBlocks(node, i, session) {
  return blocksWithSlots(node, i, session).map((x) => x.block);
}

// Signature textuelle d'un bloc : sert à décider si un article a réellement
// changé (une remise à l'identique n'est pas une modification).
function canonBlock(b) {
  if (!b) return "";
  if (b.type === "list") return ["L", b.ordered ? "1" : "0", (b.items || []).map((it) => norm(it.text)).join("\u0001")].join(":");
  if (b.type === "table") return ["T", (b.columns || []).map(norm).join("|"), (b.rows || []).map((r) => (r || []).map(norm).join("|")).join("\u0001"), norm(b.caption)].join(":");
  return ["P", norm(b.text)].join(":");
}

const canonBlocks = (list) => (list || []).map(canonBlock).join("\u0002");

export function articleChanged(node, i, session, blocks) {
  const blocks0 = blocks || editedBlocks(node, i, session);
  if (norm(editedHeading(node, i, session)) !== norm(node.heading || "")) return true;
  return canonBlocks(node.blocks) !== canonBlocks(blocks0);
}

export const isRemoved = (session, key) => (session.removed || []).includes(key);

export const insertedFor = (session, anchorEId, position) =>
  (session.inserted || []).filter((ins) => (ins.position || "after") === position && (position === "end" || ins.anchorEId === anchorEId));

// --------------------------------------------------------------- renumérotage
// Le numéro d'un article est une donnée du document, et non une décoration : on
// peut donc en changer. `session.renumerote` porte, par identifiant d'article,
// le nouveau numéro ; `session.renumeroteTout` demande une renumérotation
// continue de tout le dispositif (les trous laissés par les abrogations
// disparaissent). Voir `applyRenumbering` (amend.js), qui les applique à la
// version consolidée.
export const renumbered = (session, key) => (session?.renumerote || {})[key] || "";
export const isRenumberAll = (session) => session?.renumeroteTout === true;

// --------------------------------------------------------- articles insérés
export function newInserted(anchorEId, position, opts = {}) {
  return {
    id: Math.random().toString(36).slice(2, 9),
    anchorEId: anchorEId || "",
    position: position || "after",
    heading: "",
    blocks: [{ id: "b" + Math.random().toString(36).slice(2, 7), type: "para", text: "" }],
    ...opts,
  };
}

export function insertedBlocks(session, ins) {
  return (ins.blocks || []).map((b, j) => ({
    id: b.id, type: "para", text: editedText(session, ADDR.insBlock(ins.id, j), b.text || ""), when: "", notes: [],
  }));
}

// ------------------------------------------------------------------ le plan
// Traduit l'état d'édition en liste de modifications, dans l'ordre du document :
//   • un article dont le texte a bougé devient un remplacement ;
//   • un article marqué abrogé le devient ;
//   • les articles insérés sont rattachés à l'article voisin.
export function deriveAmendments(baseDoc, session) {
  const amends = [];
  (baseDoc.nodes || []).forEach((node, i) => {
    if (node.type !== "article") return;
    const key = articleKey(node);
    if (isRemoved(session, key)) {
      amends.push(newAmend({ targetEId: key, action: "abrogate", targetLabel: node.numLabel || "" }));
      return;
    }
    const blocks = editedBlocks(node, i, session);
    if (!articleChanged(node, i, session, blocks)) return;
    amends.push(newAmend({
      targetEId: key, action: "replace", heading: editedHeading(node, i, session),
      blocks, targetLabel: node.numLabel || "",
    }));
  });
  for (const ins of session.inserted || []) {
    const position = ins.position || "after";
    const a = newAmend({
      targetEId: ins.anchorEId || "",
      action: position === "end" ? "append" : position === "before" ? "insert-before" : "insert-after",
      heading: ins.heading || "",
      blocks: insertedBlocks(session, ins),
      targetLabel: ins.anchorLabel || "",
    });
    // Le rattachement à l'article inséré permet à l'écran de retirer une
    // insertion précise (alors que les remplacements se retirent par article).
    a.insId = ins.id;
    amends.push(a);
  }
  return amends;
}

// Plan enrichi (numéros des articles insérés, article visé) — exactement ce que
// reçoivent `buildModificatif` et `buildConsolidated`.
export function planFromSession(baseDoc, session, opts = {}) {
  const amends = deriveAmendments(baseDoc, session);
  return planAmendments(baseDoc, amends, opts);
}

// Nombre de modifications relevées (pour l'étiquette et les garde-fous).
export const countChanges = (plan) => (plan || []).filter((a) => a.action !== "keep").length;

// ------------------------------------------------------- remise à zéro d'un
// article : annule les saisies de son texte et de sa structure (l'article abrogé
// ou inséré est retiré par l'appelant, qui seul connaît la structure).
export function revertArticle(session, i, key) {
  clearEditsUnder(session, `n${i}`);
  clearStructureUnder(session, `n${i}`);
  if (key) session.removed = (session.removed || []).filter((x) => x !== key);
}

// `targetIndex` (plan) est le rang de l'article dans le DISPOSITIF ; l'adresse
// des saisies, elle, est celle du NŒUD du document (`n3.b1`…). On retrouve donc
// le nœud par son `eId` avant de remettre l'article à son texte d'origine.
export function revertArticleByEId(session, baseDoc, eId) {
  const i = (baseDoc?.nodes || []).findIndex((n) => n.type === "article" && articleKey(n) === eId);
  if (i < 0) return false;
  revertArticle(session, i, eId);
  delete session.renumerote?.[eId];
  return true;
}

// ------------------------------------------------------------------ nettoyage
// Le document sur lequel on travaille est le texte EN VIGUEUR : d'une version
// consolidée on retire donc les passages supprimés (barrés), les marques de
// modification et la bannière — mais on conserve le tableau des modifications,
// qui sera complété par la nouvelle consolidation.
export function cleanDoc(doc) {
  if (!doc) return doc;
  const nodes = [];
  for (const n of doc.nodes || []) {
    if (n.type === "article") {
      if (n.change?.action === "abrogate") continue;
      const blocks = (n.blocks || [])
        .filter((b) => b.change?.kind !== "del")
        .map((b) => ({ ...b, change: null }));
      nodes.push({ ...n, change: null, blocks });
    } else {
      nodes.push({ ...n, change: null });
    }
  }
  return {
    ...doc,
    kind: "original",
    nodes,
    consolidationNotice: undefined,
    meta: { ...doc.meta, consolidated: undefined },
  };
}
