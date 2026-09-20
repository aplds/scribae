// ============================================================================
// Mode d'affichage — clair, sombre, ou celui du système.
//
// C'est une préférence de **poste de travail**, pas une donnée du référentiel :
// elle est rangée dans le stockage local du navigateur, et chaque agent choisit
// la sienne sans rien changer pour les autres. Trois valeurs :
//   auto  — suit le réglage du système (par défaut) ;
//   light — clair, quoi qu'il arrive ;
//   dark  — sombre, quoi qu'il arrive.
//
// Le thème se pose sur `<html data-theme="…">` ; c'est `src/css/app.css` qui
// porte les deux palettes. Un script en tête d'`index.html` applique le thème
// avant tout rendu, pour éviter l'éclair blanc du chargement : la clé de
// stockage ci-dessous est donc la même dans les deux fichiers.
//
// Le **papier reste blanc** : seuls l'application et ses tableaux de bord
// s'assombrissent. Un acte administratif s'imprime sur du papier blanc, et
// l'aperçu doit montrer le document tel qu'il sera imprimé.
// ============================================================================

export const THEME_KEY = "scribae.theme";

export const THEMES = [
  { value: "auto", label: "Automatique", hint: "Suit le réglage clair / sombre du système." },
  { value: "light", label: "Clair", hint: "Toujours en clair." },
  { value: "dark", label: "Sombre", hint: "Toujours en sombre." },
];

export function themePref() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return THEMES.some((t) => t.value === v) ? v : "auto";
  } catch (e) {
    return "auto";
  }
}

export function systemDark() {
  try { return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches); }
  catch (e) { return false; }
}

export const resolvedTheme = (pref = themePref()) =>
  (pref === "dark" || (pref === "auto" && systemDark())) ? "dark" : "light";

export const isDark = () => resolvedTheme() === "dark";

// Applique le thème au document. `pref` permet d'appliquer une valeur qui n'est
// pas encore enregistrée (aperçu immédiat dans le menu).
export function applyTheme(pref = themePref()) {
  const resolved = resolvedTheme(pref);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePref = pref;
  // `color-scheme` fait suivre les contrôles natifs (barres de défilement,
  // champs de saisie, calendriers) : sans lui, ils restent clairs.
  root.style.colorScheme = resolved;
  return resolved;
}

export function setTheme(pref) {
  const v = THEMES.some((t) => t.value === pref) ? pref : "auto";
  try { localStorage.setItem(THEME_KEY, v); } catch (e) {}
  applyTheme(v);
  return v;
}

// Le passage clair → sombre du système : à suivre tant que le choix est
// « Automatique ». Renvoie une fonction de désabonnement.
export function onSystemThemeChange(fn) {
  try {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (themePref() === "auto") { applyTheme("auto"); fn?.(resolvedTheme()); } };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  } catch (e) {
    return () => {};
  }
}

// Bascule clair ⇄ sombre depuis le bouton de l'en-tête : un simple aller-retour
// entre les deux thèmes (le mode « Automatique » reste accessible dans le menu).
export function toggleTheme() {
  return setTheme(isDark() ? "light" : "dark");
}

// ------------------------------------------------------- couleur de la marque
// Les jetons `--brand` et `--brand-soft` sont posés par la configuration
// (Référentiel › Identité) sur la couleur de la collectivité — un bleu très
// foncé, illisible sur un fond sombre. On les adapte donc au thème : éclaircis
// en mode sombre, tels quels en mode clair.
const hex2rgb = (hex) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb2hex = (rgb) => "#" + rgb.map((x) => Math.round(Math.max(0, Math.min(255, x))).toString(16).padStart(2, "0")).join("");

// Mélange `a` vers `b` : t = 0 → a, t = 1 → b.
export function mix(a, b, t) {
  const ca = hex2rgb(a); const cb = hex2rgb(b);
  if (!ca || !cb) return a;
  return rgb2hex(ca.map((x, i) => x + (cb[i] - x) * t));
}

export const lighten = (hex, amount = 0.5) => mix(hex, "#ffffff", amount);

// La couleur de marque telle qu'elle doit apparaître dans le thème courant.
export function brandColors(brandColor, { dark = isDark(), darkBg = "#1b1e26" } = {}) {
  const base = brandColor || "#000091";
  if (!dark) return { brand: base, soft: "" };
  return { brand: lighten(base, 0.56), soft: mix(base, darkBg, 0.8) };
}

