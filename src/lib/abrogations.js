// ============================================================================
// Abrogations prévues par un acte.
//
// Un acte peut, par lui-même, prévoir l'abrogation d'un AUTRE acte, ou d'un
// ARTICLE d'un autre acte : c'est la clause que l'on trouve à la fin du
// dispositif (« L'arrêté n° … du … est abrogé à compter de l'entrée en vigueur
// du présent arrêté »). Deux points comptent, et ce module les tient :
//
//   • l'ACTE VISÉ est le plus souvent un acte du registre : on le désigne alors
//     par son numéro, sa nature et sa date, et l'application sait de quoi l'on
//     parle — elle pourra appliquer l'abrogation le moment venu. Un acte qui
//     n'est pas dans l'application se vise par un texte libre ;
//   • l'abrogation prend effet au jour de l'ENTRÉE EN VIGUEUR de l'acte qui la
//     prévoit, et non au jour de sa publication : c'est ce que dit la clause,
//     et c'est ce que fait l'application (voir `entreeEnVigueur` dans
//     execution.js et ui/abrogations-apply.js).
//
// Ce module est PUR : ni DOM, ni état, ni import d'un autre module du moteur
// (compile.js l'importe, et l'on évite tout cycle). C'est la raison pour
// laquelle la règle d'opposabilité, elle, vit dans execution.js.
// ============================================================================
import { formatDate } from "./util.js";

export const ABROGATION_DEFAUT = {
  heading: "Abrogation",
  // Jetons : {target} (l'acte visé, avec son article défini), {targetCap} (le
  // même, en tête de phrase), {abroge} (« abrogé » / « abrogée », accordé),
  // {article} (le numéro de l'article visé), {articleLabel}, {self} (« le
  // présent arrêté »), {selfDe} (« du présent arrêté »), {designation},
  // {designationLower}, {designationThe}.
  acte: "{targetCap} est {abroge} à compter de l'entrée en vigueur {selfDe}.",
  article: "L'{articleLabel} {article} de {target} est abrogé à compter de l'entrée en vigueur {selfDe}.",
  texte: "{targetCap} est abrogé à compter de l'entrée en vigueur {selfDe}.",
};

export function abrogationVocab(config) {
  const v = (config && config.vocab && config.vocab.abrogation) || {};
  return { ...ABROGATION_DEFAUT, ...v };
}

const lcFirst = (s) => { const t = String(s || ""); return t ? t[0].toLowerCase() + t.slice(1) : t; };
const ucFirst = (s) => { const t = String(s || ""); return t ? t[0].toUpperCase() + t.slice(1) : t; };
const fill = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? m : String(vars[k])));

// Le genre d'une appellation d'acte : il commande l'article défini (« le
// règlement », « la délibération ») et l'accord du participe. Un mot inconnu
// est traité au féminin s'il se termine comme un nom féminin, au masculin
// sinon. Même règle que dans amend.js, dont ce module ne peut pas dépendre.
const FEMININE_END = /(ion|té|ce|ure|ance|ence|ette|ise|ité)$/;
const GENDER = {
  arrete: "m", reglement: "m", acte: "m", rapport: "m", avenant: "m", marche: "m",
  bail: "m", pouvoir: "m", procesverbal: "m", contrat: "m", protocole: "m",
};
const bare = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
export const genreAppellation = (s) => GENDER[bare(s)] || (FEMININE_END.test(bare(s)) ? "f" : "m");

// « le règlement », « la délibération », « l'arrêté ».
export function avecArticle(s) {
  const d = String(s || "").trim();
  if (!d) return "";
  const lower = lcFirst(d);
  if (/^[aeiouéèêàh]/i.test(lower)) return "l'" + lower;
  return (genreAppellation(d) === "f" ? "la " : "le ") + lower;
}

// « la présente délibération », « le présent arrêté » — la désignation de
// l'acte qui porte la clause, dans une phrase.
export function soiMeme(designation) {
  const d = String(designation || "").trim() || "acte";
  return (genreAppellation(d) === "f" ? "la présente " : "le présent ") + lcFirst(d);
}

// « du présent arrêté », « de la présente délibération » : la contraction de
// « de » et de l'article défini, qui ne s'écrit jamais « de le ».
export function deSoiMeme(designation) {
  const d = String(designation || "").trim() || "acte";
  return (genreAppellation(d) === "f" ? "de la présente " : "du présent ") + lcFirst(d);
}

// ------------------------------------------------------------- les entrées
// Une entrée d'abrogation : le genre de cible, et de quoi la désigner.
//   { id, kind: "acte", acteId, numero, designation, date, eli }
//   { id, kind: "article", acteId, numero, designation, date, eli, article }
//   { id, kind: "texte", texte }
// Les champs de l'acte visé sont une PHOTOGRAPHIE prise au moment où le
// rédacteur l'a désigné : la clause d'un acte signé ne se réécrit pas ensuite.
export const KINDS = [
  { id: "acte", label: "Un acte du registre" },
  { id: "article", label: "Un article d'un acte du registre" },
  { id: "texte", label: "Un acte qui n'est pas dans l'application" },
];

export const abrogationsDe = (x) => {
  const list = x && x.values ? x.values.__abrogations : (x && x.__abrogations);
  return Array.isArray(list) ? list : [];
};

// L'acte cible, tel qu'on l'écrit dans la clause (« la décision n° … du … »).
export function cibleTexte(a) {
  if (!a) return "";
  if (a.kind === "texte") return String(a.texte || "").trim();
  const date = a.date ? formatDate(a.date, "date-long") : "";
  return [avecArticle(a.designation || "acte"), a.numero ? "n° " + a.numero : "", date ? "du " + date : ""].filter(Boolean).join(" ").trim();
}

// La phrase d'abrogation, prête à être interprétée (elle peut contenir des
// jetons `{{…}}` si le rédacteur en a saisi).
export function clauseAbrogation(a, { config, designation } = {}) {
  const V = abrogationVocab(config);
  // Le rédacteur peut réécrire la clause depuis le panneau : sa version prime
  // sur le modèle, et les jetons `{…}` qu'elle contient restent résolus.
  const tpl = (a && a.clause && String(a.clause).trim()) || V[a?.kind] || V.texte;
  const des = designation || "acte";
  const vars = {
    target: cibleTexte(a),
    targetCap: ucFirst(cibleTexte(a)),
    self: soiMeme(des),
    selfDe: deSoiMeme(des),
    // Le participe s'accorde avec l'acte visé ; l'article, lui, est masculin.
    abroge: a?.kind === "acte" && genreAppellation(a.designation) === "f" ? "abrogée" : "abrogé",
    article: a?.article || "…",
    articleLabel: (config?.vocab?.articleLabel || "Article").toLowerCase(),
    designation: des,
    designationLower: lcFirst(des),
    designationThe: avecArticle(des),
  };
  return fill(tpl, vars);
}

// ------------------------------------------- l'article porté par le document
// Rend la matière d'un article « Abrogation » : son intitulé et ses blocs. Le
// regroupement en une seule clause se fait dans l'appelant (compile.js), qui
// seul sait où l'insérer, quel numéro lui donner et comment l'interpréter.
export function blocsAbrogation(list, { config, designation } = {}) {
  const V = abrogationVocab(config);
  return {
    heading: V.heading,
    blocks: (list || []).map((a) => clauseAbrogation(a, { config, designation })).filter(Boolean),
  };
}

// ------------------------------------------------------- abrogations subies
// Ce qu'un acte a subi : la marque de son abrogation (tout l'acte), ou celle de
// ses articles abrogés par l'effet d'un autre acte. Posées par
// ui/abrogations-apply.js le jour de l'entrée en vigueur.
export const abrogeParDe = (acte) => (acte && acte.abrogePar) || null;

// La nature d'un acte, telle qu'on le DÉSIGNE dans une clause : le libellé du
// type d'acte de sa trame (« Arrêté », « Délibération »), à défaut celui que
// porte son document. `trame` est celle de l'acte, si l'appelant la connaît.
export function designationDe(acte, config, trame) {
  const id = acte?.doc?.meta?.actTypeId || trame?.actTypeId || acte?.actTypeId || "";
  return acte?.doc?.meta?.designation || (config?.actTypes || []).find((t) => t.id === id)?.label || "acte";
}

// L'abrogation d'un acte est-elle EFFECTIVE ? Tant qu'elle est en attente (la
// version consolidée n'est pas publiée), elle est annoncée sans être opposable.
export const estAbroge = (acte) => {
  const a = abrogeParDe(acte);
  return !!a && a.enAttente !== true;
};
