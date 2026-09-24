// ============================================================================
// LE FIL DE PARCOURS — l'objet visuel partagé qui montre les phases d'un acte.
//
// La lecture du chemin (« où en est l'acte, qui tient chaque porte ») est
// calculée une seule fois, par `parcoursDeActe` (src/lib/parcours.js). Ce module
// n'en fait que l'IMAGE : une ligne de puces, une par phase, dans l'ordre réel —
// et, quand un circuit de validation s'applique, ses étapes vues de l'intérieur,
// avec leur nature (vérification, visa, signature) et leur titulaire.
//
// C'est ce fil qui rend l'imbrication lisible : on y voit que le PARAPHEUR vient
// en premier, que la RÉVISION s'intercale APRÈS lui et AVANT la signature, et
// que, dans le circuit externe, la certification de conformité prend sa place
// après la signature. Les écrans qui l'affichent (la rédaction, le circuit de
// signature) ne redessinent pas le parcours chacun à leur façon : ils donnent le
// même objet, et celui-ci se lit partout de la même manière.
// ============================================================================
import { h } from "./dom.js";

// Le fil : une puce par phase, la phase courante mise en avant, et les étapes du
// circuit en dessous quand il y en a un.
//   compact  — masque les titulaires (ligne serrée, écran de rédaction) ;
//   nu       — sans cadre ni fond (posé dans une carte qui en a déjà un) ;
//   note     — la phrase de fin (« Étape en cours : … ») ;
//   titre    — un intitulé devant la ligne (« Le parcours de l'acte : »).
export function bandeauParcours(parcours, { compact = false, note = "", nu = false, titre = "" } = {}) {
  const phases = (parcours && parcours.phases) || [];
  const box = h("div", { class: "pc-parcours" + (nu ? " pc-parcours--nu" : "") });
  if (titre) box.appendChild(h("span", { class: "pc-parcours__sous-titre", text: titre }));
  const liste = h("ol", { class: "pc-parcours__liste" });
  phases.forEach((p, i) => {
    liste.appendChild(h("li", {
      class: "pc-parcours__phase pc-parcours__phase--" + (p.etat || "avenir"),
      title: [p.titre, p.acteur, p.hint].filter(Boolean).join(" — "),
    },
      i ? h("span", { class: "pc-parcours__sep", text: "›" }) : null,
      h("span", { class: "pc-parcours__puce" }, h("span", { class: "pc-parcours__num", text: String(i + 1) })),
      h("span", { class: "pc-parcours__label", text: p.label }),
      // Une porte passée sans être franchie se dit : le fil ne doit pas laisser
      // croire qu'elle attend encore (voir `marquerEtats`, src/lib/parcours.js).
      p.etat === "sansobjet" ? h("span", { class: "pc-parcours__pos pc-parcours__pos--so", text: "non franchie" }) : null,
      !compact && p.acteur ? h("span", { class: "pc-parcours__acteur", text: p.acteur }) : null,
      !compact && p.position ? h("span", { class: "pc-parcours__pos", text: p.position }) : null,
    ));
  });
  box.appendChild(liste);
  const avecEtapes = phases.find((p) => p.sousEtapes && p.sousEtapes.length);
  if (avecEtapes) box.appendChild(etapesDuCircuitEl(avecEtapes));
  if (note) box.appendChild(h("span", { class: "pc-parcours__note", text: note }));
  return box;
}

// Les étapes d'un circuit, vues de l'intérieur : numérotées, avec leur NATURE et
// leur titulaire, l'étape ouverte mise en avant. C'est ce qui montre que le
// parapheur n'est pas une case unique : il ouvre souvent par une vérification du
// réviseur, puis un visa — et l'étape de signature qui le clôt n'est PAS la
// signature de l'acte, qui vient après la révision.
function etapesDuCircuitEl(phase) {
  let ouvert = false;
  const sous = (phase.sousEtapes || []).map((s) => {
    const encours = !s.fait && !ouvert && phase.etat === "encours";
    if (encours) ouvert = true;
    return { ...s, etat: s.fait ? "fait" : encours ? "encours" : "avenir" };
  });
  return h("div", { class: "pc-parcours__sous" },
    h("span", { class: "pc-parcours__sous-titre", text: "sous-étapes :" }),
    ...sous.map((s, i) => h("span", {
      class: "pc-sub pc-sub--" + s.etat,
      title: [s.nature, s.titulaire, s.statutLabel, s.optional ? "étape facultative" : ""].filter(Boolean).join(" · "),
    },
      h("span", { class: "pc-sub__puce", text: s.fait ? "✓" : String(i + 1) }),
      h("span", { class: "pc-sub__label", text: s.label }),
      // La nature ne se répète pas quand l'intitulé la nomme déjà
      // (« Vérification du dossier » n'a pas besoin qu'on ajoute
      // « VÉRIFICATION » à côté) : elle s'affiche pour les intitulés qui ne la
      // disent pas d'eux-mêmes, ce qui est le cas des intitulés métier.
      nommeDejaLaNature(s.label, s.nature) ? null : h("span", { class: "pc-sub__nature", text: s.nature }),
      s.titulaire ? h("span", { class: "pc-sub__titulaire", text: s.titulaire }) : null,
    )));
}

const sansAccent = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function nommeDejaLaNature(label, nature) {
  const mot = sansAccent(nature).split(/[\s(]/)[0];
  return !!mot && sansAccent(label).startsWith(mot);
}

// La phrase qui suit le fil à l'écran de rédaction : où l'on en est, et le
// rappel que l'export n'est pas la fin du chemin. Elle est écrite ici pour être
// la même partout où l'on affiche un parcours.
export function noteDeParcours(parcours, { avecExport = false } = {}) {
  const phases = (parcours && parcours.phases) || [];
  const courante = phases.find((p) => p.etat === "encours");
  if (!courante) return "Parcours terminé : l'acte a suivi tout son chemin.";
  return "Étape en cours : " + courante.label + "." + (avecExport ? " Exporter sert à imprimer ou transmettre l'acte — ce n'est pas la fin du parcours." : "");
}
