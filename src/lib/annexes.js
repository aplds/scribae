// ============================================================================
// Les ANNEXES.
//
// Une annexe n'est pas un acte comme les autres : c'est un document ADOPTÉ par
// un autre, auquel il est annexé — et c'est cet acte qui lui donne son
// autorité. L'annexe ne se signe donc PAS : c'est l'acte d'adoption qui est
// signé, et son original est SUIVI du texte de l'annexe, dans le même document
// (voir src/lib/annexe-docs.js). L'exemple d'école est le règlement intérieur :
// une délibération l'adopte, et son texte suit la délibération signée. Il
// arrive aussi que l'annexe ne soit qu'un tableau — une grille tarifaire
// adoptée par une décision.
//
// COROLLAIRE : une annexe n'a PAS de numéro propre. Elle n'a ni place ni rang
// au recueil, puisqu'elle n'y est pas déposée pour elle-même — son texte suit
// la décision qui l'adopte (la modifie, ou l'abroge). Elle garde un
// identifiant INTERNE (son `id`, pour les liens et l'historique), mais partout
// où un acte ordinaire montrerait « n° 2026-416-VSL », une annexe montre à
// quelle décision elle tient : « Annexe à la délibération n° 2026-416-VSL du
// 24 septembre 2026 ». C'est ce que composent `appellationAnnexe` et
// `libelleAnnexe`, et ce que respectent la numérotation (on ne consomme pas un
// numéro pour une annexe), l'ELI (il n'y en a pas) et les tournures de
// modification (voir `targetPhrase`, src/lib/amend.js).
//
// Ce module tient le VOCABULAIRE de tout cela (les tournures de phrase, qui
// appartiennent au référentiel, non au logiciel) et les quelques lectures dont
// le reste de l'application a besoin :
//
//   • `annexesDe(values)`    ce qui est annexé à l'acte en cours de rédaction ;
//   • `adoptionDe(values)`   l'acte qui adopte le document en cours ;
//   • `visaAdoption(...)`    la tournure du visa de l'annexe (« Vu la
//                            délibération n°… du …, qui l'adopte ; ») ;
//   • `phraseAdoption(...)`  la tournure de la clause d'adoption.
//
// Le suivi des modifications, lui, n'a pas de vocabulaire propre : la
// modification d'une annexe « en suivi » est celle des versions consolidées
// (voir src/lib/amend.js et le rendu `showChanges` de src/lib/render.js).
// ============================================================================
import { formatDate } from "./util.js";

export const ADOPTION_DEFAUT = {
  // Intitulé porté en tête du document annexé (« Annexe », « Annexe I »…).
  title: "Annexe",
  // Le visa que porte l'ANNEXE, citant l'acte qui l'adopte. Le mot « Vu » n'y
  // figure PAS : c'est l'étiquette des visas (référentiel › Vocabulaire), que le
  // document pose devant chaque ligne. Jetons : les mêmes que ceux des tournures
  // d'amendement ({designation}, {designationThe}, {numero}, {date}), plus
  // {objet} de l'acte d'adoption.
  visa: "{designationThe} n°{numero} du {date}, qui l'adopte ;",
  // La clause par laquelle l'acte MODIFICATIF adopte la nouvelle rédaction de
  // l'annexe, présentée en suivi des modifications. {targetDe} est l'appellation
  // de la cible contractée avec « de » (« du règlement intérieur n°… »).
  adopt: "Est adoptée la nouvelle rédaction {targetDe}, annexée à {designationThe} n°{numero} du {date}, telle qu'elle résulte des modifications suivantes :",
  // L'intitulé de la liste des annexes, à la fin de l'acte qui les adopte.
  sectionTitle: "Annexes",
  // Le mot qui désigne une annexe dans une liste (« Annexe n°… du … »).
  label: "Annexe",
  // L'acte qui MODIFIE une annexe ne la modifie pas article par article : il en
  // ADOPTE la nouvelle rédaction, et cette rédaction lui est annexée — c'est son
  // texte qui suit l'acte modificatif signé. Ce sont les trois tournures de ce
  // geste.
  // Jetons : {designation} {designationLower} {designationThe} {numero} {date}
  // {target} {targetDe} {targetInSentence}.
  adoptTitle: "{designation} n°{numero} du {date} portant adoption de la nouvelle rédaction {targetDe}",
  adoptObjet: "adoption de la nouvelle rédaction {targetDe}",
  adoptClause: "Est adoptée la nouvelle rédaction {targetDe}, annexée à la présente {designationLower} ; son texte en suit l'original signé.",
};

export function annexesVocab(config) {
  return { ...ADOPTION_DEFAUT, ...((config && config.vocab && config.vocab.annexe) || {}) };
}

// Ce qui est ANNEXÉ à l'acte en cours : une liste d'identifications, prise au
// moment où le rédacteur a joint l'annexe (numéro, objet, adresse de recueil).
// On fige l'identification, non l'acte : si l'annexe est ensuite republiée, sa
// fiche reste la source vivante — ici, c'est le texte du visa qui compte.
export const annexesDe = (values) => (Array.isArray(values?.__annexes) ? values.__annexes.filter(Boolean) : []);

// L'acte qui ADOPTE le document en cours (une annexe) : la même
// identification figée.
export const adoptionDe = (values) => (values?.__adoption && typeof values.__adoption === "object" ? values.__adoption : null);

export const estAnnexe = (slot) => !!slot && slot.nature === "annexe";

// Un RÈGLEMENT : une annexe d'un genre particulier, déclarée comme telle sur sa
// trame (`trame.reglement`). C'est un texte NORMATIF — un règlement intérieur,
// un règlement d'usage — qui se consulte pour lui-même, comme un code : ses
// articles font droit, et les actes qui l'adoptent ou le modifient en publient
// les versions successives. Le recueil public en donne donc une publication
// INFORMATIVE autonome (`kind: "informative"`), à côté de sa place dans l'acte
// qui l'adopte — voir SPEC § 2.2.4 ter, et `src/server/mysql/actes.mjs`.
export const estReglement = (trame) => !!(trame && trame.nature === "annexe" && trame.reglement === true);

// Une annexe est-elle un RÈGLEMENT ? On la lit par sa trame — la trame est la
// source du drapeau ; l'acte, lui, ne le porte pas (il n'a pas de nature de
// règlement propre : c'est le document qui en est un).
export function estReglementActe(acte, trames) {
  const t = (trames || []).find((x) => x && x.id === acte?.trameId);
  return estReglement(t);
}

// La nature d'un ACTE. Les actes récents la portent ; les plus anciens la
// tiennent de leur trame (le champ n'existait pas encore) — on ne migre rien.
export const natureOfActe = (a, trames) => {
  if (!a) return "acte";
  if (a.nature === "annexe" || a.nature === "acte") return a.nature;
  const t = (trames || []).find((x) => x.id === a.trameId);
  return t && t.nature === "annexe" ? "annexe" : "acte";
};

// L'IDENTIFICATION d'un acte, telle qu'on la fige en la citant ailleurs :
// numéro, nature, date, objet, adresse de recueil. On ne garde pas l'acte
// lui-même — sa fiche reste la source vivante ; ici, c'est le TEXTE de la
// citation qui compte (« Vu la délibération n°… du … »).
export function identification(a, designation = "") {
  return {
    acteId: a?.id || "",
    numero: a?.numero || "",
    designation: designation || a?.designation || "",
    date: a?.dateSignature || "",
    objet: a?.objet || "",
    eli: a?.eli || "",
  };
}

// --------------------------------------------------------------- les tournures
const fill = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? "" : String(vars[k])));
const longDate = (v) => (v ? formatDate(v, "date-long") : "");
const lcFirst = (s) => { const t = String(s || ""); return t ? t[0].toLowerCase() + t.slice(1) : t; };

const FEMININE_END = /(ion|té|ce|ure|ance|ence|ette|ise|ité)$/;
const GENDER = { arrete: "m", reglement: "m", acte: "m", rapport: "m", avenant: "m", marche: "m", bail: "m", contrat: "m", protocole: "m", deliberation: "f", decision: "f" };
const bare = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

export function designationDefinie(designation) {
  const d = String(designation || "l'acte").trim() || "l'acte";
  const lower = lcFirst(d);
  if (/^[aeiouéèêàh]/i.test(lower)) return "l'" + lower;
  const g = GENDER[bare(d)] || (FEMININE_END.test(bare(d)) ? "f" : "m");
  return (g === "f" ? "la " : "le ") + lower;
}

function varsDe(slot, config) {
  const designation = slot?.designation || "l'acte";
  return {
    designation,
    designationLower: lcFirst(designation),
    designationThe: designationDefinie(designation),
    numero: slot?.numero || "à compléter",
    date: longDate(slot?.date || slot?.dateSignature),
    objet: slot?.objet || "",
  };
}

// « le règlement intérieur n°… » → « du règlement intérieur n°… » : la
// contraction de « de » avec l'article défini, pour les tournures qui ENCHÂSSENT
// l'appellation de la cible (« … portant adoption de la nouvelle rédaction du
// règlement intérieur n°… »). Sans elle, la phrase dirait « de le règlement ».
export function avecDe(phrase) {
  const s = String(phrase || "").trim();
  if (!s) return "";
  if (/^les\s/i.test(s)) return "des " + s.slice(4);
  if (/^le\s/i.test(s)) return "du " + s.slice(3);
  if (/^la\s/i.test(s)) return "de la " + s.slice(3);
  if (/^l['’]/i.test(s)) return "de " + s;
  return "de " + lcFirst(s);
}

// Le visa de l'annexe, citant l'acte qui l'adopte.
export function visaAdoption(adoption, config) {
  if (!adoption) return "";
  return fill(annexesVocab(config).visa, varsDe(adoption, config));
}

// La clause par laquelle un acte adoptant (ou modificatif) adopte la nouvelle
// rédaction d'une annexe. `cible` est la tournure qui désigne l'annexe dans la
// phrase (« le règlement intérieur n°… du … ») — voir `targetPhrase` (amend.js).
export function clauseAdoption(cible, acte, config) {
  const V = annexesVocab(config);
  const av = varsDe(acte, config);
  const c = cible || "l'annexe";
  return fill(V.adoptClause, { ...av, targetInSentence: c, target: c, targetDe: avecDe(c) });
}

// L'INTITULÉ du document annexé, tel qu'il s'imprime dans la liste des annexes
// d'un acte : « Annexe — Règlement intérieur du conseil municipal ». Une annexe
// n'ayant pas de numéro, elle se nomme par ce qu'elle est.
export function itemAnnexe(a, config) {
  return {
    id: a?.acteId || "",
    acteId: a?.acteId || "",
    texte: libelleAnnexe(a, config),
    objet: a?.objet || "",
    lien: a?.eli || a?.url || "",
  };
}

// Le NŒUD « annexes » d'un document : la liste, à la fin du dispositif, de ce
// qui est annexé à l'acte. Il vit ici parce que deux chemins le fabriquent — la
// compilation d'une trame (compile.js) et l'acte modificatif (amend.js).
export function nodeAnnexes(list, config) {
  const items = (list || []).filter(Boolean).map((a) => itemAnnexe(a, config));
  if (!items.length) return null;
  return { id: "annexes", type: "annexes", path: "annexes", notes: [], when: "", items };
}

const cap = (s) => { const t = String(s || ""); return t ? t[0].toUpperCase() + t.slice(1) : t; };

// Le renvoi à la DÉCISION qui fait exister l'annexe : « la délibération
// n° 2026-416-VSL du 24 septembre 2026 ». Une annexe n'a pas de numéro propre :
// c'est par cette décision qu'elle s'identifie — celle qui l'adopte, celle qui
// en adopte la nouvelle rédaction (la même mécanique), ou celle qui l'abroge.
export function refDecision(d) {
  if (!d) return "";
  return [
    designationDefinie(d.designation || "acte"),
    d.numero ? "n° " + d.numero : "",
    d.date ? "du " + longDate(d.date) : "",
  ].filter(Boolean).join(" ").trim();
}

// Ce qu'on écrit dans une colonne « Numéro » : le numéro de l'acte — et, pour
// une annexe, qui n'en a pas, le renvoi court à la décision qui l'adopte
// (« annexe à 2026-416-VSL »). C'est le pendant de `appellationAnnexe`, en trois
// mots, pour les tableaux et les listes.
export function numeroAffiche(a, config, trames) {
  if (natureOfActe(a, trames) !== "annexe") return a?.numero || "";
  return a?.adoptePar?.numero ? "annexe à " + a.adoptePar.numero : "annexe";
}

// L'appellation d'un document ANNEXÉ, là où un acte ordinaire montrerait son
// numéro : « Annexe à la délibération n° 2026-416-VSL du 24 septembre 2026 ».
// `annexe` est un acte du registre (il porte alors `adoptePar`), ou la seule
// identification figée de son acte d'adoption.
export function appellationAnnexe(annexe, config) {
  const V = annexesVocab(config);
  const d = annexe?.adoptePar || annexe?.adoption || null;
  const ref = refDecision(d);
  return ref ? `${V.label} à ${ref}` : V.label;
}

// La même appellation, mais EN PHRASE : avec l'article défini et en minuscules,
// pour « Modifier l'annexe à la délibération n° … » ou « … les articles de
// l'annexe à la délibération n° … ». La forme `appellationAnnexe` est une
// étiquette (titre, ligne de fiche) ; celle-ci se glisse dans une phrase.
export function appellationAnnexeDefinie(annexe, config) {
  const base = designationDefinie(annexesVocab(config).label); // « l'annexe »
  const ref = refDecision(annexe?.adoptePar || annexe?.adoption || null);
  return ref ? `${base} à ${ref}` : base;
}

// L'intitulé d'une annexe dans une liste ou un tableau. Elle se nomme par ce
// qu'elle est (son objet, à défaut son appellation) : une annexe n'a pas de
// numéro à montrer.
export function libelleAnnexe(annexe, config) {
  const V = annexesVocab(config);
  const corps = String(annexe?.objet || annexe?.designation || "").trim();
  return corps && corps.toLowerCase() !== V.label.toLowerCase() ? `${V.label} — ${cap(corps)}` : V.label;
}
