// ============================================================================
// Glisser-déposer — primitives partagées.
//
// L'éditeur de trame s'en sert pour quatre gestes qui doivent se comprendre sans
// mode d'emploi (le public visé n'est pas informaticien) :
//
//   • glisser un CHAMP dans le texte d'un bloc : la pastille est insérée là où
//     on la lâche (le point de dépôt est converti en position de curseur) ;
//   • glisser un BLOC neuf depuis la réserve de blocs ;
//   • glisser un bloc EXISTANT (depuis le plan ou le document) pour le ranger ;
//   • glisser une QUESTION pour changer l'ordre du formulaire.
//
// Deux gestes du même moteur : on SAISIT une prise (`glissable`), on la LÂCHE
// sur une cible (`deposable`).
//
// ---------------------------------------------------------------------------
// POURQUOI PAS LE GLISSER-DÉPOSER HTML5
//
// Il a été essayé, et remplacé. Trois raisons, apprises à la dure :
//
//   1. **Il ne fonctionne pas au doigt.** Ni sur iOS, ni de façon fiable sur
//      Android : la tablette est un poste de travail courant, et un geste qui
//      n'y répond pas est un geste qui n'existe pas.
//   2. **Le navigateur interrompt le glisser dès que la source quitte le
//      document.** Or ici un re-rendu peut suivre la perte du focus d'un bloc
//      en cours d'édition (`blurGuard`) : le bloc se réécrit, la poignée
//      saisie disparaît de l'arbre, et le glisser meurt sans rien dire.
//   3. **Il ne dit pas où l'on lâche.** Il faut de toute façon un
//      `elementFromPoint` pour savoir sur quoi on dépose — et une fois qu'on
//      l'a, son `dataTransfer` n'apporte plus rien.
//
// Le moteur s'appuie donc sur les POINTER EVENTS, qui couvrent souris, doigt et
// stylet, et que l'on peut éprouver par des événements synthétiques.
//
// ---------------------------------------------------------------------------
// LE CLIC RESTE UN CLIC
//
// Rien n'est saisi avant que le pointeur n'ait bougé de quelques pixels : un
// appui sans déplacement laisse passer le clic (c'est ce qui fait qu'un bouton
// reste un bouton). Et là où le texte s'édite, le texte reste sélectionnable :
// une prise posée sur un bloc ENTIER ne démarre pas dans une zone éditable —
// on déplace le bloc par son intitulé, ses marges, sa barre d'outils ; on
// sélectionne son texte à la souris.
//
// Une prise déclarée `auDoigt` reçoit `touch-action: none` : le contact
// démarre un glisser au lieu de faire défiler la page. C'est le cas des
// poignées ⠿, et d'elles seules — ailleurs, le doigt doit continuer de faire
// défiler.
//
// Le module ne connaît ni les champs ni les blocs : il ne manipule que des
// charges utiles `{ kind, label, ... }` et des nœuds DOM, et convertit un point
// de dépôt en position de curseur.
// ============================================================================

// ---------------------------------------------------------------- registres
// Les prises (ce que l'on saisit) et les cibles (ce qui accepte un dépôt).
// Deux WeakMap : rien à défaire quand un nœud quitte le document.
const prises = new WeakMap();
const cibles = new WeakMap();

let installe = false;

// La candidature : un appui sur une prise, tant qu'il n'a pas bougé.
let candidat = null;   // { el, opt, id, depuis }
// Le glisser en cours.
let courant = null;    // la charge en vol
let sourceEl = null;   // l'élément saisi
let cibleEl = null;    // la cible survolée
let cibleOpt = null;
let actif = false;
let fantome = null;
let boucle = null;     // la boucle d'animation du glisser (autodéfilement)
let point = { x: 0, y: 0 };

const SEUIL = 6;       // pixels avant que l'appui ne devienne un glisser

function installer() {
  if (installe) return;
  installe = true;
  document.addEventListener("pointerdown", aLAppui, true);
  document.addEventListener("pointermove", auMouvement, true);
  document.addEventListener("pointerup", auRelachement, true);
  // Un contact qui devient un défilement (ou que le système reprend) annule le
  // glisser : c'est ce que fait le doigt quand il fait défiler la page.
  document.addEventListener("pointercancel", () => terminer(), true);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") terminer(); }, true);
  window.addEventListener("blur", () => terminer());
}

// -------------------------------------------------------------------- prise
// `charge` : { kind: "champ" | "auto" | "bloc" | "deplacement" | "rangement" | "mv", label, ... }.
// `auDoigt` : la prise répond au doigt (voir l'en-tête).
// `onFin`   : appelé dans tous les cas à la fin du geste (dépôt, annulation).
export function glissable(el, charge, { auDoigt = false, onFin } = {}) {
  installer();
  prises.set(el, { charge, onFin });
  if (auDoigt) {
    el.classList.add("dnd-prise-doigt");
    el.style.touchAction = "none";
  }
  return el;
}

// -------------------------------------------------------------------- cible
// `accepte(charge)` filtre ; `onDepot(charge, point)` agit — `point` porte
// `clientX` / `clientY`, comme un événement de pointeur.
// `halo(el, charge, point)` (facultatif) nuance l'aperçu (avant / après).
// `classe` est la classe posée sur la cible survolée.
export function deposable(el, { accepte, onDepot, halo, classe = "dnd-sur" } = {}) {
  installer();
  cibles.set(el, { accepte, onDepot, halo, classe });
  return el;
}

export const chargeCourante = () => courant;

// La prise la plus proche du point d'appui (c'est la plus fine qui gagne : une
// poignée posée dans un bloc se saisit avant le bloc lui-même).
function sourcePour(node) {
  for (let n = node; n; n = n.parentElement) if (prises.has(n)) return { el: n, opt: prises.get(n) };
  return null;
}

// La cible qui ACCEPTE la charge, en remontant depuis le point visé : un
// paragraphe qui refuse un bloc laisse passer à l'article qui le contient —
// exactement ce que ferait la remontée d'un événement.
function ciblePour(x, y) {
  let n = typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null;
  while (n) {
    const opt = cibles.get(n);
    if (opt && (!opt.accepte || opt.accepte(courant))) return n;
    n = n.parentElement;
  }
  return null;
}

// ------------------------------------------------------------------- appui
function aLAppui(e) {
  if (actif) terminer();                    // filet : un glisser resté ouvert
  if (e.button !== 0) return;               // bouton principal seulement
  const src = sourcePour(e.target);
  if (!src) return;
  // Le doigt ne déplace que les prises faites pour lui (les poignées) :
  // partout ailleurs, le doigt doit faire défiler le document.
  if (e.pointerType === "touch" && !src.el.classList.contains("dnd-prise-doigt")) return;
  // Un contrôle qui COMMANDE (bouton, champ, zone de texte éditable, résumé
  // dépliable) l'emporte sur la prise, sauf s'il appartient à la prise
  // elle-même : cliquer « supprimer ce bloc » ne déplace pas le bloc, et
  // sélectionner un mot ne le déplace pas non plus.
  const inter = e.target.closest?.("button, a, input, select, textarea, summary, [contenteditable='true']");
  if (inter && inter !== src.el && !inter.contains(src.el)) return;
  candidat = { el: src.el, opt: src.opt, id: e.pointerId, depuis: { x: e.clientX, y: e.clientY } };
}

function auMouvement(e) {
  if (!candidat || (e.pointerId != null && e.pointerId !== candidat.id)) return;
  if (!actif) {
    const d = Math.abs(e.clientX - candidat.depuis.x) + Math.abs(e.clientY - candidat.depuis.y);
    if (d < SEUIL) return;
    demarrer(e);
    return;
  }
  point = { x: e.clientX, y: e.clientY };
  placerFantome(point);
}

function demarrer(e) {
  actif = true;
  courant = candidat.opt.charge;
  sourceEl = candidat.el;
  point = { x: e.clientX, y: e.clientY };
  document.documentElement.classList.add("dnd-actif");
  sourceEl.classList.add("dnd-source");
  // La sélection de texte a pu commencer avant le seuil : on la retire.
  try { window.getSelection()?.removeAllRanges?.(); } catch (err) { /* sans sélection */ }
  fantome = document.createElement("div");
  fantome.className = "dnd-fantome";
  fantome.textContent = courant.label || "Déplacer";
  document.body.appendChild(fantome);
  placerFantome(point);
  boucle = requestAnimationFrame(tourner);
}

// La boucle du glisser : le pointeur ne bouge pas, mais la page peut défiler
// sous lui (autodéfilement) — et la cible change alors sans `pointermove`.
function tourner() {
  boucle = requestAnimationFrame(tourner);
  autodefiler();
  const c = ciblePour(point.x, point.y);
  if (c !== cibleEl) {
    nettoyerCible();
    cibleEl = c;
    cibleOpt = c ? cibles.get(c) : null;
    if (c) marquer(c);
  } else if (c && cibleOpt?.halo) {
    cibleOpt.halo(c, courant, point);      // « avant » ou « après » selon la moitié
  }
}

function marquer(c) {
  if (!cibleOpt) return;
  c.classList.add(cibleOpt.classe);
  cibleOpt.halo?.(c, courant, point);
}

function nettoyerCible() {
  if (cibleEl) cibleEl.classList.remove(cibleOpt?.classe || "dnd-sur", "dnd-avant", "dnd-apres");
  cibleEl = null;
  cibleOpt = null;
}

// Autodéfilement : quand on glisse près du bord d'une zone qui défile, la zone
// suit — sans quoi l'on ne peut pas déposer plus loin que l'écran.
function autodefiler() {
  const MARGE = 46;
  const PAS = 18;
  let n = typeof document.elementFromPoint === "function" ? document.elementFromPoint(point.x, point.y) : null;
  while (n) {
    const r = n.getBoundingClientRect();
    if (r.height > 80 && n.scrollHeight > n.clientHeight + 4) {
      const ov = getComputedStyle(n).overflowY;
      if (ov === "auto" || ov === "scroll") {
        if (point.y < r.top + MARGE) n.scrollTop -= PAS;
        else if (point.y > r.bottom - MARGE) n.scrollTop += PAS;
        return;
      }
    }
    n = n.parentElement;
  }
}

function placerFantome(p) {
  if (!fantome) return;
  fantome.style.left = p.x + 14 + "px";
  fantome.style.top = p.y + 14 + "px";
}

// --------------------------------------------------------------- relâchement
function auRelachement(e) {
  if (!candidat || (e.pointerId != null && e.pointerId !== candidat.id)) return;
  const charge = actif ? courant : null;
  const c = charge ? (cibleEl || ciblePour(e.clientX, e.clientY)) : null;
  const opt = c ? cibles.get(c) : null;
  const fin = candidat.opt.onFin;
  const compte = actif;
  terminer();
  if (compte) {
    if (c && opt && (!opt.accepte || opt.accepte(charge))) opt.onDepot(charge, { clientX: e.clientX, clientY: e.clientY });
    fin?.();
  }
}

// Remet tout à zéro : quelle que soit la sortie (dépôt, Échap, contact repris
// par le système, perte du focus de la fenêtre), l'état visuel est nettoyé.
export function terminer() {
  if (boucle) { cancelAnimationFrame(boucle); boucle = null; }
  if (fantome) { fantome.remove(); fantome = null; }
  if (sourceEl) sourceEl.classList.remove("dnd-source");
  nettoyerCible();
  document.documentElement.classList.remove("dnd-actif");
  candidat = null;
  courant = null;
  sourceEl = null;
  actif = false;
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
