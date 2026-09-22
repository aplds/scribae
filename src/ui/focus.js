// ============================================================================
// Le curseur survit au redessin.
//
// L'application se redessine souvent : un geste, une écriture de la base, une
// donnée qui arrive — la vue, parfois la coquille entière, est reconstruite.
// Rien de tout cela ne devrait interrompre une saisie en cours. Ce module
// retient, AVANT le redessin, où était le curseur (le champ, la sélection, le
// défilement) et l'y replace après.
//
// Le champ est retrouvé par son CHEMIN dans le document — il renaît au même
// endroit — puis vérifié par une signature (balise, id, nom, type, gabarit,
// adresse de bloc) : un écran ne peut donc pas hériter du curseur d'un autre.
// La clé fournie par l'appelant (`avecCurseur(fn, cle)`) ajoute la même
// garantie à l'échelle de l'écran : un changement de route n'est pas un
// redessin, et rien n'y est repris.
// ============================================================================

// Le chemin d'un nœud (élément ou nœud de texte) depuis <body> : une suite
// d'indices dans `childNodes`. Deux rendus successifs du même écran donnent le
// même chemin ; un autre écran, non.
const cheminDe = (n) => {
  const parts = [];
  let noeud = n;
  while (noeud && noeud !== document.body && noeud.parentNode) {
    parts.unshift(Array.prototype.indexOf.call(noeud.parentNode.childNodes, noeud));
    noeud = noeud.parentNode;
  }
  return noeud === document.body ? parts : null;
};

const auChemin = (parts) => {
  let n = document.body;
  for (const i of parts || []) {
    if (!n || !n.childNodes[i]) return null;
    n = n.childNodes[i];
  }
  return n && n !== document.body ? n : null;
};

// Ce qui identifie un champ : de quoi reconnaître le même, et de quoi refuser
// un autre. La classe n'y figure pas — elle change en cours de saisie (un
// passage réécrit se marque « hors trame »), et un champ marqué n'est pas un
// autre champ.
const signatureDe = (el) => [
  el.tagName,
  el.id || "",
  el.getAttribute?.("name") || "",
  el.getAttribute?.("type") || "",
  el.getAttribute?.("placeholder") || "",
  el.dataset?.slot || "",
].join("|");

// Les conteneurs défilants d'un nœud : leur position est perdue avec le
// redessin, et un écran long qui se remet en haut est aussi déroutant qu'un
// curseur perdu. On retient x/y des ancêtres qui défilent réellement.
const defilementsDe = (el) => {
  const out = [];
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    if (n.scrollTop || n.scrollLeft) out.push({ chemin: cheminDe(n), x: n.scrollLeft, y: n.scrollTop });
  }
  return out;
};

// L'état à reprendre : le défilement de la fenêtre (toujours), puis le curseur
// et son contexte — l'élément lui-même (s'il survit au redessin, comme une
// fenêtre modale), son chemin, sa signature, la sélection et les défilements.
export function capturerCurseur() {
  const snap = {
    fenetre: { x: window.scrollX || 0, y: window.scrollY || 0 },
    defilements: [],
    noeud: null, chemin: null, sig: "", sel: null, texte: null,
  };
  const el = document.activeElement;
  if (!el || el === document.body || el === document.documentElement) return snap;
  snap.noeud = el;
  snap.chemin = cheminDe(el);
  snap.sig = signatureDe(el);
  snap.defilements = defilementsDe(el);
  if (typeof el.selectionStart === "number") {
    snap.sel = [el.selectionStart, el.selectionEnd, el.selectionDirection || "none"];
  }
  // Zone éditable (le document d'un acte, un bloc de trame) : la sélection vit
  // dans le document, pas sur l'élément. On la retient elle aussi.
  const s = typeof document.getSelection === "function" ? document.getSelection() : null;
  if (s && s.rangeCount && s.anchorNode && el.contains(s.anchorNode)) {
    const a = cheminDe(s.anchorNode);
    const f = cheminDe(s.focusNode);
    if (a && f) snap.texte = { a, ao: s.anchorOffset, f, fo: s.focusOffset };
  }
  return snap;
}

// Reprend le curseur. Rend `true` si le champ a été retrouvé. Le défilement est
// repris dans tous les cas : c'est le premier signe visible du redessin.
export function restaurerCurseur(snap) {
  if (!snap) return false;
  for (const d of snap.defilements || []) {
    const conteneur = d.chemin ? auChemin(d.chemin) : null;
    if (conteneur) { conteneur.scrollLeft = d.x; conteneur.scrollTop = d.y; }
  }
  if (snap.fenetre && (window.scrollX !== snap.fenetre.x || window.scrollY !== snap.fenetre.y)) {
    try { window.scrollTo(snap.fenetre.x, snap.fenetre.y); } catch (e) { /* le navigateur décide */ }
  }
  if (!snap.chemin) return false;
  // Le champ d'origine est resté dans le document : la sélection est intacte.
  if (snap.noeud && snap.noeud.isConnected) return true;
  const el = auChemin(snap.chemin);
  if (!el || !el.isConnected || signatureDe(el) !== snap.sig) return false;
  try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (e2) { return false; } }
  if (snap.sel && typeof el.setSelectionRange === "function") {
    // Le champ a pu être renormalisé (une valeur détourée) : on borne la
    // sélection à ce qu'il contient réellement.
    const fin = typeof el.value === "string" ? el.value.length : null;
    const borne = (n) => (fin == null ? n : Math.max(0, Math.min(n, fin)));
    try { el.setSelectionRange(borne(snap.sel[0]), borne(snap.sel[1]), snap.sel[2]); }
    catch (e) { /* champ sans sélection (type date, nombre…) */ }
  }
  if (snap.texte) {
    const a = auChemin(snap.texte.a);
    const f = auChemin(snap.texte.f);
    if (a && f) {
      try { document.getSelection().setBaseAndExtent(a, snap.texte.ao, f, snap.texte.fo); }
      catch (e) { /* sélection hors zone : on garde le curseur au moins */ }
    }
  }
  return true;
}

// Exécute un rendu sans que l'agent y laisse son curseur. `cle` (facultatif)
// dit à quel écran appartient le rendu : si elle change, c'est une navigation,
// et rien n'est repris — le nouvel écran commence proprement, en haut de page.
export function avecCurseur(fn, cle) {
  const snap = capturerCurseur();
  const avant = typeof cle === "function" ? cle() : "";
  try {
    return fn();
  } finally {
    if (typeof cle === "function" && cle() !== avant) return;
    // Un écran qui construit une partie de son contenu en différé (une lecture
    // de service, une liste qui arrive) n'a pas encore le champ au moment du
    // rendu : on retente une fois, à l'image suivante.
    if (!restaurerCurseur(snap) && snap.chemin) {
      requestAnimationFrame(() => { if (!snap.noeud?.isConnected) restaurerCurseur(snap); });
    }
  }
}
