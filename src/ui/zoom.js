// ============================================================================
// Zoom et déplacement d'un contenu.
//
// Trois écrans montrent un contenu plus grand que la place qu'ils lui donnent :
// l'organigramme des délégations (un arbre large), le document en cours de
// rédaction et la trame ouverte dans son éditeur (une page A4, toujours plus
// large que la colonne du milieu). Plutôt que d'obliger à faire défiler
// horizontalement, on les traite comme un CANVAS : on saisit le fond et on le
// déplace, la molette règle le cran, deux boutons le font aussi, et « Ajuster »
// recadre le contenu à la largeur disponible.
//
// ---------------------------------------------------------------------------
// COMMENT C'EST FAIT
//
// Le contenu est posé dans un plateau dont la TAILLE est écrite en pixels
// (`largeur × cran`), le contenu lui-même étant mis hors flux et réduit par
// `transform: scale()` :
//
//     cadre (défile)  >  plateau (taille = taille × cran)  >  contenu (scale)
//
// L'astuce est que le plateau réserve EXACTEMENT la place du contenu réduit :
// le cadre défile donc correctement, les barres de défilement et le défilement
// tactile du navigateur restent normaux, et rien n'est jamais rogné. Mettre un
// `transform` sur un élément en flux, au contraire, ne réserve aucune place :
// le contenu réduit laisserait un grand vide, ou déborderait sans barre.
//
// Le contenu est mis hors flux (`position: absolute`) pour que sa taille de
// mise en page ne soit jamais contrainte par le plateau (sans quoi un
// organigramme se replierait au lieu de s'étendre). Sa largeur naturelle est
// donc MESURÉE (`offsetWidth`, que `transform` ne fausse pas) à chaque dessin.
//
// Le zoom « sous le curseur » tient immobile le point visé : on note sa
// position en coordonnées du contenu avant, et on corrige le défilement après
// — c'est la seule formule à retenir, et elle évite de tâtonner avec les
// origines de transformation.
//
// ---------------------------------------------------------------------------
// LE CLIC RESTE UN CLIC
//
// Déplacer le fond ne doit pas empêcher d'ouvrir la fiche d'un acteur, ni de
// poser le curseur dans le texte. On ne saisit donc qu'après quelques pixels de
// mouvement (comme le glisser-déposer, src/ui/dnd.js) : un appui sans
// déplacement laisse passer le clic, et un clic émis juste après un vrai
// déplacement est étouffé. Sur une feuille, on ne saisit jamais DANS une zone
// qui édite ou commande : le texte reste sélectionnable à la souris, et l'on
// déplace la page par sa marge ou par le fond du cadre.
//
// Le geste de la molette est réglable : `molette: "zoom"` sur un canvas libre
// (l'organigramme — la molette y règle le cran), `molette: "ctrl"` sur une
// feuille — là, la molette doit continuer de faire défiler la page, et c'est
// Ctrl (ou ⌘) qui zoome, comme dans un navigateur. Le pincement d'un pavé
// tactile arrive, lui, sous forme de molette avec Ctrl : il zoome donc
// naturellement sur les deux.
//
// Le doigt n'est pas accaparé : le plateau ayant la taille du contenu réduit,
// le défilement tactile du navigateur fait exactement le geste attendu — pas de
// `touch-action: none`, pas de geste écrit à la main.
//
// Le cran et le défilement sont rangés dans `state.ui.zooms[cle]` : un écran se
// redessine souvent (une frappe, une écriture du référentiel), et le cran choisi
// ne doit pas s'y perdre.
// ============================================================================

import { state } from "./state.js";
import { h } from "./dom.js";

const MIN = 0.35;      // on ne descend pas plus bas : le texte devient illisible
const MAX = 3;
const PAS_BOUTON = 1.25;   // un clic sur + ou − change le cran d'un quart
const SEUIL = 5;           // pixels avant que l'appui ne devienne un déplacement

function magasin() {
  const ui = (state.ui = state.ui || {});
  return (ui.zooms = ui.zooms || {});
}

const nombre = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// `contenu` : l'élément à zoomer (il sera mis hors flux — il doit donc porter
// une largeur propre : 21 cm pour une feuille, `max-content` pour un arbre).
// Options : `cle` (mémorisation), `mode` (« feuille » | « canvas »), `classe`
// (classes du cadre défilant), `molette`, `deplacement`, `min`, `max`.
// Rend l'ENVELOPPE à poser dans la page (`cadreZoom(...)` → un élément).
export function cadreZoom(contenu, opts = {}) {
  const mode = opts.mode === "canvas" ? "canvas" : "feuille";
  const cle = opts.cle || "zoom";
  const min = opts.min ?? MIN;
  const max = opts.max ?? MAX;
  const molette = opts.molette || (mode === "canvas" ? "zoom" : "ctrl");
  const deplacement = opts.deplacement ?? true;
  const classe = opts.classe || "";

  // Premier cran : une feuille s'ajuste à la colonne (comme le faisait
  // l'ajustement à la largeur), un arbre s'ouvre à 100 % — le réduire pour le
  // faire tenir entier rendrait ses noms illisibles ; « Ajuster » reste là pour
  // qui veut la vue d'ensemble.
  const depart = opts.depart != null ? opts.depart : (mode === "canvas" ? 1 : null);
  const memoire = magasin();
  let etat = memoire[cle];
  if (!etat) etat = memoire[cle] = { s: depart, sx: 0, sy: 0, auto: depart == null };

  contenu.classList.add("zoom__contenu");
  const plateau = h("div", { class: "zoom__plateau" }, contenu);
  const cadre = h("div", { class: "zoom zoom--" + mode + (classe ? " " + classe : "") }, plateau);

  // ------------------------------------------------------------------ la barre
  const pct = h("button", {
    class: "zoom__pct", type: "button", title: "Revenir à 100 %",
    onClick: () => { const r = cadre.getBoundingClientRect(); vers(1, r.left + cadre.clientWidth / 2, r.top + cadre.clientHeight / 2); },
  }, "100 %");
  const barre = h("div", { class: "zoom__bar", role: "group", "aria-label": "Zoom" },
    h("button", { class: "zoom__btn", type: "button", title: "Dézoomer", "aria-label": "Dézoomer", onClick: () => centre(1 / PAS_BOUTON) }, "−"),
    pct,
    h("button", { class: "zoom__btn", type: "button", title: "Zoomer", "aria-label": "Zoomer", onClick: () => centre(PAS_BOUTON) }, "+"),
    h("button", { class: "zoom__btn zoom__btn--fit", type: "button", title: "Ajuster à la largeur", "aria-label": "Ajuster", onClick: () => ajuster() }, "Ajuster"),
  );
  // `plein` : le cadre prend la hauteur restante de la colonne et défile sur
  // place (l'éditeur de trame, l'organigramme) ; sinon il grandit avec son
  // contenu et la page défile (le document de la rédaction).
  // La barre est posée sur l'ENVELOPPE, non dans le cadre : un enfant d'une zone
  // qui défile défile avec elle, et la barre doit rester en place.
  const enveloppe = h("div", { class: "zoom-cadre" + (opts.plein ? " zoom-cadre--plein" : "") }, cadre, barre);

  // ------------------------------------------------------------------ la mesure
  let natW = 1, natH = 1;
  let applW = 0, applH = 0;   // la taille naturelle du dernier dessin
  // La taille du plateau ET la largeur du contenu sont effacées le temps de la
  // mesure : sans cela, un contenu FLUIDE (le papier d'un écran étroit, qui
  // prend la largeur qu'on lui donne : `width: 100%`) se mesurerait d'après le
  // plateau, qui se règle lui-même d'après la mesure — la feuille fondrait à
  // chaque dessin, et une feuille réduite serait comptée deux fois. Sans largeur
  // imposée, le plateau (comme le contenu) prend la largeur du cadre, qui est
  // exactement ce que vaut « 100 % ». La largeur naturelle ainsi trouvée est
  // ensuite FIGÉE sur le contenu en pixels : c'est elle que le plateau réserve,
  // multipliée par le cran.
  const mesurer = () => {
    const w = plateau.style.width, h = plateau.style.height, cw = contenu.style.width;
    if (w) plateau.style.width = "";
    if (h) plateau.style.height = "";
    if (cw) contenu.style.width = "";
    natW = contenu.offsetWidth || 1;
    natH = contenu.offsetHeight || 1;
    if (w) plateau.style.width = w;
    if (h) plateau.style.height = h;
    contenu.style.width = natW + "px";
  };
  const borner = (s) => Math.max(min, Math.min(max, s));

  const peindre = () => {
    const s = etat.s || 1;
    mesurer();
    applW = natW;
    applH = natH;
    plateau.style.width = Math.round(natW * s) + "px";
    plateau.style.height = Math.round(natH * s) + "px";
    contenu.style.transformOrigin = "0 0";
    contenu.style.transform = s === 1 ? "" : "scale(" + s + ")";
    pct.textContent = Math.round(s * 100) + " %";
  };

  // Ajuste le contenu à la place disponible, sans jamais l'agrandir : une
  // feuille A4 doit tenir dans la colonne, un arbre entier se voir d'un coup.
  function ajuster() {
    const cs = getComputedStyle(cadre);
    const dispoW = cadre.clientWidth - nombre(cs.paddingLeft) - nombre(cs.paddingRight);
    const dispoH = cadre.clientHeight - nombre(cs.paddingTop) - nombre(cs.paddingBottom);
    mesurer();
    let s = dispoW / natW;
    if (mode === "canvas" && natH > 1 && dispoH > 1) s = Math.min(s, dispoH / natH);
    s = borner(Math.min(1, s));
    etat.s = s;
    etat.auto = true;
    etat.sx = 0; etat.sy = 0;
    peindre();
    cadre.scrollLeft = 0;
    cadre.scrollTop = 0;
  }

  // Zoome en gardant immobile le point visé (coordonnées écran dans le cadre).
  function vers(s2, cx, cy) {
    s2 = borner(s2);
    const s1 = etat.s || 1;
    if (Math.abs(s2 - s1) < 1e-4) return;
    const r1 = contenu.getBoundingClientRect();
    const u = (cx - r1.left) / s1;      // le point visé, en coordonnées du contenu
    const v = (cy - r1.top) / s1;
    etat.s = s2;
    etat.auto = false;
    peindre();
    const r2 = contenu.getBoundingClientRect();
    cadre.scrollLeft += (r2.left + u * s2) - cx;
    cadre.scrollTop += (r2.top + v * s2) - cy;
    etat.sx = cadre.scrollLeft;
    etat.sy = cadre.scrollTop;
  }

  // Zoome autour du centre du cadre — c'est ce que font les boutons.
  function centre(f) {
    const r = cadre.getBoundingClientRect();
    vers((etat.s || 1) * f, r.left + cadre.clientWidth / 2, r.top + cadre.clientHeight / 2);
  }

  // ------------------------------------------------------------------ molette
  // `passive: false` : sur un canvas, la molette règle le cran et ne doit pas
  // faire défiler la page ; sur une feuille, seul Ctrl+molette est repris (la
  // molette nue continue de faire défiler, comme partout ailleurs).
  cadre.addEventListener("wheel", (e) => {
    const veut = molette === "zoom" || (molette === "ctrl" && (e.ctrlKey || e.metaKey));
    if (!veut) return;
    e.preventDefault();
    const lignes = e.deltaMode === 1;
    const d = e.deltaY * (lignes ? 18 : 1);
    vers((etat.s || 1) * Math.exp(-d * (lignes ? 0.01 : 0.0015)), e.clientX, e.clientY);
  }, { passive: false });

  // -------------------------------------------------------------- déplacement
  let glisse = null;
  let aDeplace = false;      // un déplacement vient d'avoir lieu : le clic qui suit est étouffé

  cadre.addEventListener("pointerdown", (e) => {
    aDeplace = false;        // nouveau geste : on rouvre le clic
    if (!deplacement || e.button !== 0 || e.pointerType === "touch") return;
    if (e.target.closest?.(".zoom__bar")) return;
    // Sur une feuille, saisir le fond ne doit jamais voler le texte ni un
    // bouton : on ne déplace la page qu'en partant d'une zone muette.
    if (mode === "feuille" && e.target.closest?.("input, textarea, select, [contenteditable='true'], .rw-region, .rw-tok, a, button, label, summary")) return;
    glisse = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: cadre.scrollLeft, sy: cadre.scrollTop, bouge: false };
    try { cadre.setPointerCapture?.(e.pointerId); } catch (err) { /* sans capture */ }
  });

  cadre.addEventListener("pointermove", (e) => {
    if (!glisse || e.pointerId !== glisse.id) return;
    const dx = e.clientX - glisse.x;
    const dy = e.clientY - glisse.y;
    if (!glisse.bouge) {
      if (Math.abs(dx) + Math.abs(dy) < SEUIL) return;
      glisse.bouge = true;
      cadre.classList.add("is-glisse");
      try { window.getSelection()?.removeAllRanges?.(); } catch (err) { /* sans sélection */ }
    }
    cadre.scrollLeft = glisse.sx - dx;
    cadre.scrollTop = glisse.sy - dy;
  });

  const finirGlisse = (e) => {
    if (!glisse || (e && e.pointerId != null && e.pointerId !== glisse.id)) return;
    const bouge = glisse.bouge;
    try { cadre.releasePointerCapture?.(glisse.id); } catch (err) { /* rien à relâcher */ }
    glisse = null;
    cadre.classList.remove("is-glisse");
    if (bouge) {
      aDeplace = true;
      etat.sx = cadre.scrollLeft;
      etat.sy = cadre.scrollTop;
    }
  };
  cadre.addEventListener("pointerup", finirGlisse);
  cadre.addEventListener("pointercancel", finirGlisse);

  // Le clic d'un vrai déplacement ne doit pas ouvrir la fiche saisie par
  // mégarde : on l'étouffe en phase de capture, avant que la cible ne le voie.
  cadre.addEventListener("click", (e) => {
    if (!aDeplace) return;
    aDeplace = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);

  // ------------------------------------------------------------- défilement
  cadre.addEventListener("scroll", () => {
    etat.sx = cadre.scrollLeft;
    etat.sy = cadre.scrollTop;
  });

  // Un cadre « ajusté » suit la largeur de la fenêtre : c'est ce que faisait
  // l'ancien ajustement à la feuille, à chaque redessin.
  window.addEventListener("resize", () => {
    if (etat.auto) ajuster();
  });

  // Le contenu peut grandir tout seul — un article ajouté, une division
  // ouverte, une annexe jointe : le plateau qui réserve sa place doit suivre,
  // sans quoi le défilement s'arrêterait avant la fin du document. On l'observe
  // donc, et l'on ne redessine que si sa taille a réellement changé (sans quoi
  // le moindre détail de mise en page relancerait la boucle).
  if (typeof ResizeObserver === "function") {
    let prevu = false;
    const ro = new ResizeObserver(() => {
      if (prevu) return;
      prevu = true;
      requestAnimationFrame(() => {
        prevu = false;
        mesurer();
        if (natW === applW && natH === applH) return;
        if (etat.auto) ajuster();
        else peindre();
      });
    });
    ro.observe(contenu);
  }

  // --------------------------------------------------------------- premier cran
  requestAnimationFrame(() => {
    if (etat.s == null) ajuster();
    else {
      peindre();
      cadre.scrollLeft = etat.sx || 0;
      cadre.scrollTop = etat.sy || 0;
    }
  });

  return enveloppe;
}
