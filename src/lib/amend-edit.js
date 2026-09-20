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

// ------------------------------- lecture d'un article à travers les saisies
export function editedHeading(node, i, session) {
  return editedText(session, ADDR.heading(i), node.heading || "");
}

export function editedBlocks(node, i, session) {
  return (node.blocks || []).map((b, j) => {
    if (b.type === "list") {
      return {
        ...clone(b),
        items: (b.items || []).map((it, k) => ({ ...clone(it), text: editedText(session, ADDR.item(i, j, k), it.text) })),
      };
    }
    if (b.type === "table") {
      return {
        ...clone(b),
        caption: editedText(session, ADDR.caption(i, j), b.caption || ""),
        rows: (b.rows || []).map((r, ri) => (r || []).map((c, ci) => editedText(session, ADDR.cell(i, j, ri, ci), c))),
      };
    }
    return { ...clone(b), text: editedText(session, ADDR.block(i, j), b.text) };
  });
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
// article : annule les saisies de son texte (l'article abrogé ou inséré est
// retiré par l'appelant, qui seul connaît la structure).
export function revertArticle(session, i, key) {
  clearEditsUnder(session, `n${i}`);
  if (key) session.removed = (session.removed || []).filter((x) => x !== key);
}

// `targetIndex` (plan) est le rang de l'article dans le DISPOSITIF ; l'adresse
// des saisies, elle, est celle du NŒUD du document (`n3.b1`…). On retrouve donc
// le nœud par son `eId` avant de remettre l'article à son texte d'origine.
export function revertArticleByEId(session, baseDoc, eId) {
  const i = (baseDoc?.nodes || []).findIndex((n) => n.type === "article" && articleKey(n) === eId);
  if (i < 0) return false;
  revertArticle(session, i, eId);
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
