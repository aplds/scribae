// ============================================================================
// La STRUCTURE du document, du point de vue de la rédaction.
//
// La trame dit ce que l'acte doit contenir. Mais un acte se rédige : on
// découvre en écrivant qu'un paragraphe doit être ajouté, qu'un visa ne
// s'applique pas, qu'un article du modèle est sans objet. Le rédacteur doit
// pouvoir le faire SANS toucher au modèle — la trame reste la référence, et ce
// qu'il en écarte lui est signalé, comme les réécritures de texte (voir
// lib/redaction.js).
//
// Deux gestes, deux registres rangés avec les valeurs de l'acte :
//
//   • `__supprimes` — { adresse: true }. Une adresse de bloc (`body.3`) ou
//     d'élément (`body.2.items.0`). Le bloc visé n'est pas affiché : ni lui, ni
//     ses descendants. Le texte de la trame, lui, n'est pas modifié, et un
//     « Rétablir » (retirer l'adresse) rend le bloc tel qu'il était, avec ses
//     réécritures.
//
//   • `__ajouts` — { conteneur: [ { id, rang, node } ] }. Un bloc (ou un
//     élément de liste) AJOUTÉ par le rédacteur, posé dans un conteneur du
//     document. Son rang est SYNTHÉTIQUE : il commence après le dernier bloc de
//     la trame du conteneur, et ne bouge plus — c'est ce qui permet de le
//     déplacer, de le citer et de le commenter avec les mêmes outils que les
//     blocs de la trame.
//
// L'ORDRE reste celui de lib/ordre.js (`__ordre`, en rangs d'origine). Un ajout
// y entre à la place où on l'a posé : les rangs synthétiques y cohabitent donc
// avec les rangs de la trame. Rien n'est déplacé dans le modèle.
// ============================================================================
import { uid } from "./util.js";
import { ordreConteneur } from "./ordre.js";

// ---------------------------------------------------------------- suppression
export const supprimesDe = (values) =>
  (values && values.__supprimes && typeof values.__supprimes === "object") ? values.__supprimes : {};

export const estSupprime = (values, addr) => !!supprimesDe(values)[addr];

export function supprimer(values, addr) {
  if (!addr) return false;
  values.__supprimes = values.__supprimes || {};
  values.__supprimes[addr] = true;
  return true;
}

export function retablir(values, addr) {
  const s = values.__supprimes;
  if (!s || !s[addr]) return false;
  delete s[addr];
  if (!Object.keys(s).length) delete values.__supprimes;
  return true;
}

export const suppressions = (values) => Object.keys(supprimesDe(values));

// Une adresse est « sous suppression » quand elle est supprimée elle-même, ou
// qu'un bloc qui la contient l'est. C'est ce qui fait disparaître les écarts de
// texte d'un article supprimé, sans les effacer (un « Rétablir » les retrouve).
export function sousSuppression(values, addr) {
  const s = supprimesDe(values);
  if (s[addr]) return true;
  for (const k of Object.keys(s)) if (String(addr).startsWith(k + ".")) return true;
  return false;
}

// ------------------------------------------------------------------ ajouts
export const ajoutsDe = (values, containerPath) => {
  const box = values && values.__ajouts;
  return (box && Array.isArray(box[containerPath])) ? box[containerPath] : [];
};

export function rangSuivantAjout(values, containerPath, count) {
  let max = Number(count) - 1;
  for (const a of ajoutsDe(values, containerPath)) if (Number(a.rang) > max) max = Number(a.rang);
  return max + 1;
}

export function ajouter(values, containerPath, node, rang) {
  values.__ajouts = values.__ajouts || {};
  const list = (values.__ajouts[containerPath] = values.__ajouts[containerPath] || []);
  const entree = { id: uid("aj"), rang: Number(rang), node };
  list.push(entree);
  return entree;
}

// Pose un ajout à une place précise. L'ordre naturel range les ajouts à la
// suite des blocs de la trame ; on n'écrit donc un ordre explicite que si la
// place demandée n'est pas cette place-là — un ajout en fin de conteneur ne
// salit pas l'ordre du document.
export function ajouterA(values, containerPath, node, index, count) {
  const rang = rangSuivantAjout(values, containerPath, count);
  const entree = ajouter(values, containerPath, node, rang);
  const complet = ordreConteneur(values, containerPath, count);
  const sans = complet.filter((r) => Number(r) !== rang);
  const i = Math.max(0, Math.min(Number(index ?? sans.length), sans.length));
  if (i < sans.length) {
    sans.splice(i, 0, rang);
    values.__ordre = values.__ordre || {};
    values.__ordre[containerPath] = sans;
  }
  return entree;
}

// L'ajout qui porte une adresse donnée (`body.5`, `body.3.blocks.2`,
// `body.2.items.4`…). On cherche par CONTENEUR : une adresse ajoutée commence
// par l'un des conteneurs connus, suivi de son rang — la forme d'un conteneur
// (`body`, `…blocks`, `…items`) n'a donc pas à être devinée.
function parseAjoutAddr(values, addr) {
  const a = String(addr || "");
  for (const container of Object.keys(values?.__ajouts || {})) {
    const prefix = container + ".";
    if (!a.startsWith(prefix)) continue;
    const m = a.slice(prefix.length).match(/^(\d+)(\.heading)?$/);
    if (m) return { container, rang: Number(m[1]), heading: !!m[2] };
  }
  return null;
}

export function ajoutPour(values, addr) {
  const p = parseAjoutAddr(values, addr);
  if (!p) return null;
  return ajoutsDe(values, p.container).find((a) => Number(a.rang) === p.rang) || null;
}

// Retire l'ajout que vise une adresse (et tout ce qui pend sous lui).
export function retirerAjoutPour(values, addr) {
  const p = parseAjoutAddr(values, addr);
  if (!p) return null;
  const a = ajoutsDe(values, p.container).find((x) => Number(x.rang) === p.rang);
  if (!a) return null;
  return retirerAjout(values, p.container, a.id);
}

// Retire un ajout : lui, son rang dans l'ordre, et tout ce qui pend sous lui
// (réécritures, suppressions, ajouts imbriqués). Ce qu'on retire est un ajout —
// jamais une réécriture de la trame : il n'y a donc rien à regretter.
export function retirerAjout(values, containerPath, id) {
  const list = ajoutsDe(values, containerPath);
  const i = list.findIndex((a) => a.id === id);
  if (i < 0) return null;
  const [entree] = list.splice(i, 1);
  if (!list.length) delete values.__ajouts[containerPath];
  const prefix = `${containerPath}.${entree.rang}`;
  const ord = values.__ordre && values.__ordre[containerPath];
  if (Array.isArray(ord)) {
    const reste = ord.filter((r) => Number(r) !== Number(entree.rang));
    if (reste.length) values.__ordre[containerPath] = reste; else delete values.__ordre[containerPath];
  }
  for (const box of ["__overrides", "__supprimes", "__ajouts"]) {
    for (const k of Object.keys(values[box] || {})) {
      if (k === prefix || k.startsWith(prefix + ".")) delete values[box][k];
    }
  }
  for (const box of ["__ordre"]) {
    for (const k of Object.keys(values[box] || {})) {
      if (k === prefix || k.startsWith(prefix + ".")) delete values[box][k];
    }
  }
  return entree;
}

// Les emplacements éditables des ajouts, pour que leur texte ne soit pas
// signalé comme un écart à la trame (il n'en est pas un : il n'est pas dans la
// trame) et que `markRegion` compare à la bonne origine.
export function slotsAjoutes(values) {
  const out = [];
  for (const [container, list] of Object.entries(values?.__ajouts || {})) {
    for (const a of list || []) {
      const node = a.node || {};
      const addr = `${container}.${a.rang}`;
      if (container.endsWith(".items")) out.push({ addr, original: node.text || "" });
      else if (node.type === "article" || node.type === "division") out.push({ addr: addr + ".heading", original: node.heading || "" });
      else out.push({ addr, original: node.text || "" });
    }
  }
  return out;
}

// Reporte dans l'ajout le texte saisi dans le document : l'ajout est sa propre
// source (il n'y a pas de trame derrière lui).
export function majAjout(values, addr, src) {
  const p = parseAjoutAddr(values, addr);
  if (!p) return false;
  const a = ajoutsDe(values, p.container).find((x) => Number(x.rang) === p.rang);
  if (!a) return false;
  if (p.heading) a.node.heading = src; else a.node.text = src;
  return true;
}
