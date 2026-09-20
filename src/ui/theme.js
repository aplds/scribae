// ============================================================================
// Le sélecteur d'apparence de la coquille.
//
// Deux entrées, le même réglage (voir lib/theme.js) : un bouton dans l'en-tête
// pour basculer clair ⇄ sombre d'un clic, et le choix complet — dont
// « Automatique » — dans le menu du compte. Placés ici plutôt que dans `app.js`
// pour que l'écran de connexion, qui n'a pas d'en-tête, puisse les réutiliser.
// ============================================================================
import { h, icon } from "./dom.js";
import { emit, applyBrand } from "./state.js";
import { THEMES, themePref, setTheme, toggleTheme, isDark } from "../lib/theme.js";

export function themeButton() {
  const dark = isDark();
  const pref = themePref();
  const label = dark ? "Passer en clair" : "Passer en sombre";
  return h("button", {
    class: "app-theme", type: "button",
    title: label + (pref === "auto" ? " (réglage du système)" : ""),
    "aria-label": label,
    on: { click: () => { toggleTheme(); applyBrand(); emit(); } },
  }, icon(dark ? "sun" : "moon", 18));
}

export function themeChooser() {
  const wrap = h("div", { class: "app-user__theme" },
    h("div", { class: "app-user__themelabel" }, icon(isDark() ? "moon" : "sun", 13), h("span", { text: "Apparence" })),
  );
  const row = h("div", { class: "app-user__themes" });
  for (const t of THEMES) {
    row.appendChild(h("button", {
      class: "app-user__themebtn" + (themePref() === t.value ? " is-on" : ""),
      type: "button", title: t.hint,
      on: { click: () => { setTheme(t.value); applyBrand(); emit(); } },
    }, t.label));
  }
  wrap.appendChild(row);
  return wrap;
}
