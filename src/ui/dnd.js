// ============================================================================
// Glisser-déposer — primitives partagées.
//
// L'éditeur de trame s'en sert pour trois gestes qui doivent se comprendre sans
// mode d'emploi (le public visé n'est pas informaticien) :
//
//   • glisser un CHAMP dans le texte d'un bloc : la pastille est insérée là où
//     on la lâche (le point de dépôt est converti en position de curseur) ;
//   • glisser un BLOC neuf depuis la réserve de blocs ;
//   • glisser un bloc EXISTANT (depuis le plan ou le document) pour le ranger.
//
// Deux choses apprises à la dure :
//
//   1. `dataTransfer.getData()` est VIDE pendant `dragover` — règle des
//      navigateurs, pour empêcher un site de lire les données préparées par un
//      autre document. On garde donc la charge utile courante dans une variable
//      de module : c'est fiable ici, un glisser-déposer ne quittant jamais la
//      page.
//   2. Une cible qui n'accepte pas la charge déposée ne doit PAS appeler
//      `preventDefault()` : le navigateur affiche alors le curseur « interdit »
//      et l'utilisateur comprend le refus sans qu'on ait à le lui écrire.
//
// Le module ne connaît ni les champs ni les blocs : il ne manipule que des
// charges utiles `{ kind, label, ... }` et des nœuds DOM.
// ============================================================================

export const MIME = "application/x-scribae";

let courant = null;
let installe = false;

function installer() {
  if (installe) return;
  installe = true;
  // Filet de sécurité : quel que soit le chemin (dépôt refusé, source
  // reconstruite pendant le glisser, Échap), l'état visuel est remis à zéro.
  document.addEventListener("dragend", () => terminer());
  document.addEventListener("drop", () => terminer());
  window.addEventListener("blur", () => terminer());
}

export function terminer() {
  courant = null;
  document.documentElement.classList.remove("dnd-actif");
  document.querySelectorAll(".dnd-sur").forEach((el) => el.classList.remove("dnd-sur"));
}

export const chargeCourante = () => courant;

function lire(e) {
  try {
    const brut = e.dataTransfer?.getData(MIME);
    return brut ? JSON.parse(brut) : null;
  } catch (err) { return null; }
}

// ------------------------------------------------------------------- source
// `charge` : { kind: "champ" | "auto" | "bloc" | "deplacement", label, ... }.
export function glissable(el, charge, { onDebut, onFin } = {}) {
  installer();
  el.draggable = true;
  el.addEventListener("dragstart", (e) => {
    courant = charge;
    document.documentElement.classList.add("dnd-actif");
    try {
      e.dataTransfer.effectAllowed = "copyMove";
      e.dataTransfer.setData(MIME, JSON.stringify(charge));
      // Repli texte : un dépôt hors de l'application ne casse rien.
      e.dataTransfer.setData("text/plain", charge.label || "");
    } catch (err) { /* certains navigateurs refusent setData pendant dragstart ? sans conséquence */ }
    el.classList.add("dnd-source");
    // `onDebut` sert à l'aperçu de glisser (`setDragImage`) : il lève si le
    // navigateur n'est pas dans un vrai glisser — sans conséquence ici.
    try { onDebut?.(e); } catch (err) { /* aperçu indisponible : on continue */ }
  });
  el.addEventListener("dragend", () => {
    el.classList.remove("dnd-source");
    onFin?.();
    terminer();
  });
  return el;
}

// -------------------------------------------------------------------- cible
// `accepte(charge)` filtre ; `onDepot(charge, evenement)` agit.
// `halo(el, charge)` (facultatif) permet de nuancer l'aperçu (avant / après).
export function deposable(el, { accepte, onDepot, halo, classe = "dnd-sur" } = {}) {
  installer();
  const ok = (c) => !!c && (!accepte || accepte(c));
  el.addEventListener("dragover", (e) => {
    if (!ok(courant)) return;           // pas de preventDefault : dépôt refusé
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = courant.kind === "deplacement" ? "move" : "copy";
    el.classList.add(classe);
    if (halo) halo(el, courant, e);
  });
  el.addEventListener("dragleave", (e) => {
    if (el.contains(e.relatedTarget)) return;
    el.classList.remove(classe, "dnd-avant", "dnd-apres");
  });
  el.addEventListener("drop", (e) => {
    const charge = courant || lire(e.dataTransfer);
    el.classList.remove(classe, "dnd-avant", "dnd-apres");
    if (!ok(charge)) return;
    e.preventDefault();
    e.stopPropagation();
    terminer();
    onDepot(charge, e);
  });
  return el;
}

// Position (avant / après) selon la moitié survolée — le geste habituel des
// listes : on vise le haut pour poser au-dessus, le bas pour poser en dessous.
export function moitie(el, e) {
  const r = el.getBoundingClientRect();
  return e.clientY < r.top + r.height / 2 ? "avant" : "apres";
}

// ------------------------------------------------- conversion en curseur
// Le point de dépôt devient une position de curseur : c'est ce qui fait qu'un
// champ lâché « au milieu d'une phrase » s'insère exactement là.
export function rangeDepuisPoint(x, y) {
  if (typeof document.caretRangeFromPoint === "function") return document.caretRangeFromPoint(x, y);
  if (typeof document.caretPositionFromPoint === "function") {
    const pos = document.caretPositionFromPoint(x, y);
    if (!pos) return null;
    const r = document.createRange();
    r.setStart(pos.offsetNode, pos.offset);
    r.collapse(true);
    return r;
  }
  return null;
}

// Un range TOUJOURS utilisable dans `el` : celui du point visé s'il tombe bien
// dans l'élément, sinon la fin du contenu (dépôt sur une zone vide, ou
// navigateur qui ne sait pas convertir un point en curseur).
export function rangeDans(el, x, y) {
  const r = rangeDepuisPoint(x, y);
  if (r && el.contains(r.startContainer)) return auNiveauEnfant(el, r);
  const fin = document.createRange();
  fin.selectNodeContents(el);
  fin.collapse(false);
  return fin;
}

// Ramène la position au niveau des enfants DIRECTS de `el`.
//
// Sans cela, viser une pastille existante place le curseur DANS cette pastille :
// la nouvelle pastille s'y imbrique, et la lecture du bloc (qui lit le jeton
// porté par chaque pastille, sans descendre dans ses enfants) ne la voit
// jamais — le champ paraît inséré à l'écran et absent du texte enregistré.
function auNiveauEnfant(el, r) {
  if (r.startContainer === el) return r;
  let enfant = r.startContainer;
  while (enfant && enfant.parentNode !== el) enfant = enfant.parentNode;
  if (!enfant) return r;
  const res = document.createRange();
  if (r.startContainer.nodeType === 3 && r.startContainer === enfant) {
    res.setStart(enfant, Math.min(r.startOffset, enfant.data.length));
  } else {
    res.setStartAfter(enfant);
  }
  res.collapse(true);
  return res;
}

// Insère un nœud à la position donnée, puis laisse le curseur juste après :
// l'utilisateur peut continuer à taper sans reprendre la souris.
export function insererAuRange(el, range, noeud) {
  if (typeof el.focus === "function") el.focus();
  range.deleteContents();
  range.insertNode(noeud);
  const apres = document.createRange();
  apres.setStartAfter(noeud);
  apres.collapse(true);
  const sel = window.getSelection();
  if (sel) { sel.removeAllRanges(); sel.addRange(apres); }
  return noeud;
}
