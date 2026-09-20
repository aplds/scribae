import {
  state, init, parseRoute, navigate, onChange, applyBrand, setViewRenderer, can, logout,
  currentUser, emit, signalerEcranCollab, libererRedaction,
} from "./state.js";
import { h, clear, icon, button, badge, toast } from "./dom.js";
import { APP_NAME, APP_TAGLINE, markEl } from "./brand.js";
import { versionBadge, releasedLabel } from "../lib/version.js";
import { fullName, roleOf, initialsOf } from "../lib/users.js";
import { scopeLabel } from "../lib/scope.js";
import { storageAvailable } from "../lib/store.js";
import { applyTheme, onSystemThemeChange } from "../lib/theme.js";
import { authConfig, isTestProvider } from "../lib/auth.js";
import { themeButton, themeChooser } from "./theme.js";
import * as db from "../lib/db/index.js";
import { COLLECTIONS } from "../lib/db/contract.js";
import { demoNotice } from "./notice.js";
import { renderConnexion } from "./views/connexion.js";
import { handleAuthReturn } from "./oidc.js";
import { renderComptes } from "./views/comptes.js";
import { renderTrames } from "./views/trames.js";
import { renderEditor } from "./views/editor.js";
import { renderRediger } from "./views/rediger.js";
import { renderActes } from "./views/actes.js";
import { renderReferentiel } from "./views/referentiel.js";
import { renderStyles } from "./views/styles.js";
import { renderAide } from "./views/aide.js";
import { renderModifier, renderActeDetail } from "./views/modifier.js";
import { renderSignature } from "./views/signature.js";
import { renderPublications } from "./views/publications.js";
import { renderDocs } from "./views/docs.js";
import { renderParapheur } from "./views/parapheur.js";
import { renderExecution } from "./views/execution.js";
import { renderCorbeille } from "./views/corbeille.js";
import { monterBarreCollab } from "./collab.js";
import { installerRaccourcis, ouvrirRecherche } from "./global-search.js";

const NAV = [
  { group: "Produire", items: [
    { id: "trames", label: "Trames", icon: "doc", perm: "trames.voir" },
    { id: "rediger", label: "Rédiger un acte", icon: "plus", perm: "actes.rediger" },
    { id: "modifier", label: "Modifier un acte", icon: "refresh", perm: "actes.gerer" },
    { id: "actes", label: "Actes", icon: "list", perm: "actes.rediger" },
    { id: "parapheur", label: "Parapheur", icon: "check", perm: "actes.valider" },
  ] },
  { group: "Publier", items: [
    { id: "signature", label: "Signature & publication", icon: "lock", perm: "signature.gerer" },
    { id: "execution", label: "Exécution & délais", icon: "list", perm: "actes.rediger" },
    { id: "publications", label: "Publications (ELI)", icon: "eye", perm: "signature.gerer" },
  ] },
  { group: "Configurer", items: [
    { id: "referentiel", label: "Référentiel", icon: "grid", perm: "referentiel.gerer" },
    { id: "styles", label: "Feuilles de style", icon: "palette", perm: "trames.styles" },
    { id: "corbeille", label: "Corbeille", icon: "trash", perm: "actes.rediger" },
  ] },
  { group: "Aide", items: [
    { id: "aide", label: "Guide", icon: "info" },
    { id: "docs", label: "Documentation technique", icon: "doc" },
  ] },
];

// Permission exigée par écran. Un écran sans permission est ouvert à tous les
// comptes connectés. Toute vue non autorisée renvoie au premier écran permis :
// un rédacteur qui suit un lien vers le référentiel ne tombe jamais sur un écran
// vide, il revient à la rédaction.
const VIEW_PERMS = {
  trames: "trames.voir",
  trame: "trames.gerer",
  rediger: "actes.rediger",
  actes: "actes.rediger",
  acte: "actes.rediger",
  modifier: "actes.gerer",
  signature: "signature.gerer",
  publications: "signature.gerer",
  publication: "signature.gerer",
  referentiel: "referentiel.gerer",
  styles: "trames.styles",
  comptes: "comptes.gerer",
  parapheur: "actes.valider",
  execution: "actes.rediger",
  corbeille: "actes.rediger",
  aide: null,
  docs: null,
};
const allowed = (view) => !VIEW_PERMS[view] || can(VIEW_PERMS[view]);
const firstAllowedView = () => ["trames", "rediger", "actes", "signature", "publications", "aide"].find(allowed) || "aide";

const VIEWS = {
  trames: renderTrames,
  trame: renderEditor,
  rediger: renderRediger,
  actes: renderActes,
  acte: renderActeDetail,
  modifier: renderModifier,
  referentiel: renderReferentiel,
  styles: renderStyles,
  signature: renderSignature,
  publications: renderPublications,
  publication: renderConsultationRoute,
  comptes: renderComptes,
  parapheur: renderParapheur,
  execution: renderExecution,
  corbeille: renderCorbeille,
  aide: renderAide,
  docs: renderDocs,
};

// La consultation d'une publication est un sous-écran du registre.
function renderConsultationRoute(root, params) {
  renderPublications(root, params);
}

let mainEl = null;

// Pastille d'état de la persistance : discrète en mode local (c'est le mode par
// défaut), explicite dès que les données sont partagées.
function storageBadge() {
  if (!db.isShared()) return null;
  const st = db.status();
  const color = st.state === "ok" ? "success" : st.state === "offline" ? "warning" : st.state === "error" ? "error" : "info";
  const text = st.state === "ok" ? "base partagée" : st.state === "offline" ? "base hors ligne" : "base : erreur";
  return h("span", { class: "fr-badge fr-badge--" + color, title: st.detail || "", text });
}

// Bascule clair ⇄ sombre : un bouton dans l'en-tête (le geste courant), et le
// choix complet — dont « Automatique » — dans le menu du compte. L'apparence
// est une préférence de POSTE : elle n'est pas enregistrée dans le référentiel.
function userMenu() {
  const u = currentUser();
  const role = roleOf(u);
  const wrap = h("div", { class: "app-user-wrap" });
  const menu = h("div", { class: "app-user__menu", hidden: true });
  const close = () => { menu.hidden = true; document.removeEventListener("click", onDoc); };
  const onDoc = (e) => { if (!wrap.contains(e.target)) close(); };

  const item = (label, ic, onClick) => h("button", {
    class: "app-user__item", type: "button",
    on: { click: () => { close(); onClick(); } },
  }, icon(ic, 15), h("span", { text: label }));

  menu.appendChild(h("div", { class: "app-user__head" },
    h("span", { class: "app-user__headname", text: fullName(u) }),
    h("span", { class: "fr-small fr-muted", text: (u.email || u.login) + " · " + role.label }),
    h("span", { class: "fr-small fr-muted", text: "Périmètre : " + scopeLabel(state.config, u) }),
    // Compte rattaché à l'annuaire : on rappelle d'où vient le rôle, pour que
    // l'agent (et l'administrateur à qui il montre son écran) le voie.
    u.source === "oidc"
      ? h("span", { class: "fr-small fr-muted", text: "Annuaire" + (u.oidcClaim ? " · groupe « " + u.oidcClaim + " »" : "") + (isTestProvider(authConfig(state.config)) ? " (essai)" : "") })
      : null,
  ));
  if (can("comptes.gerer")) menu.appendChild(item("Comptes et rôles", "lock", () => navigate("comptes")));
  if (can("referentiel.gerer")) menu.appendChild(item("Référentiel", "gear", () => navigate("referentiel")));
  menu.appendChild(item("Guide d'utilisation", "info", () => navigate("aide")));
  menu.appendChild(item("Documentation technique", "doc", () => navigate("docs")));
  menu.appendChild(h("hr", { class: "app-user__sep" }));
  menu.appendChild(themeChooser());
  menu.appendChild(item("Changer de compte", "x", () => logout()));
  // La version en service : c'est ici qu'un agent la lit quand on lui demande
  // « quelle version tourne ? ». Elle vient de src/lib/version.js (source unique).
  menu.appendChild(h("div", {
    class: "app-user__version",
    title: "Version du logiciel, livrée le " + releasedLabel(),
    text: versionBadge(APP_NAME) + " · " + releasedLabel(),
  }));

  const chip = h("button", {
    class: "app-user", type: "button", title: "Compte connecté — cliquer pour le menu",
    on: { click: (e) => {
      e.stopPropagation();
      menu.hidden = !menu.hidden;
      if (menu.hidden) document.removeEventListener("click", onDoc);
      else document.addEventListener("click", onDoc);
    } },
  },
    h("span", { class: "app-user__avatar", text: initialsOf(u) }),
    h("span", { class: "app-user__text" },
      h("span", { class: "app-user__name", text: fullName(u) }),
      h("span", { class: "app-user__role", text: role.label }),
    ),
    icon("down", 14),
  );
  wrap.appendChild(chip);
  wrap.appendChild(menu);
  return wrap;
}

function shell() {
  const brand = state.config.brand || {};
  const initials = (brand.shortName || brand.name || "?")
    .split(/\s+/).map((w) => w[0]).join("").slice(0, 3).toUpperCase();

  // Bandeau de démonstration : en tête, au-dessus de l'en-tête. Il disparaît
  // quand l'administrateur l'a coupé (Référentiel › Identité).
  const notice = demoNotice(can("referentiel.gerer")
    ? button("Réglage", { variant: "tertiary", size: "sm", onClick: () => navigate("referentiel") })
    : null);

  // Témoins de collaboration (postes connectés, notifications) : montés dans
  // l'en-tête, mais mis à jour d'eux-mêmes — un redessin à chaque battement de
  // cœur ferait perdre le curseur de l'agent (voir src/ui/collab.js).
  const userBar = h("div", { class: "app-collab" });
  monterBarreCollab(userBar);

  const header = h("header", { class: "app-header" },
    h("div", { class: "app-brand" },
      markEl(32),
      h("div", { class: "app-brand__text" },
        h("span", { class: "app-brand__name", text: APP_NAME }),
        h("span", { class: "app-brand__sub", text: APP_TAGLINE }),
      ),
    ),
    h("div", { class: "app-header__spacer" }),
    h("div", { class: "app-header__tools" },
      h("div", { class: "app-org", title: "Structure au nom de laquelle les actes sont pris" },
        brand.logoUrl
          ? h("img", { src: brand.logoUrl, alt: "" })
          : h("span", { class: "app-org__mark", text: initials }),
        h("span", { class: "app-org__name", text: brand.name || "Organisation" }),
      ),
      h("span", { class: "fr-badge fr-badge--brand", text: state.config.entities?.[0]?.kind ? `${state.config.entities.length} entités` : "référentiel vide" }),
      !storageAvailable() ? h("span", { class: "fr-badge fr-badge--warning", text: "stockage local indisponible" }) : null,
      storageBadge(),
      // Recherche globale : un seul champ pour tout l'outil (actes, trames,
      // personnes, références, comptes, guide). Ctrl+K ou « / » l'ouvre aussi.
      h("button", {
        class: "app-search", type: "button", title: "Rechercher dans tout l'outil (Ctrl+K)",
        on: { click: () => ouvrirRecherche() },
      }, icon("info", 15), h("span", { text: "Rechercher" }), h("kbd", { text: "Ctrl K" })),
      userBar,
      button("Guide", { variant: "secondary", icon: "info", size: "", onClick: () => navigate("aide") }),
      can("referentiel.gerer") ? h("span", { class: "app-header__ref" }, button("Référentiel", { variant: "secondary", icon: "gear", size: "", onClick: () => navigate("referentiel") })) : null,
      themeButton(),
      userMenu(),
    ),
  );

  const nav = h("nav", { class: "app-nav" });
  for (const g of NAV) {
    const items = g.items.filter((it) => !it.perm || can(it.perm));
    if (!items.length) continue;
    nav.appendChild(h("div", { class: "app-nav__group", text: g.group }));
    for (const it of items) {
      const active = state.route.view === it.id || (it.id === "trames" && state.route.view === "trame") || (it.id === "rediger" && state.route.view === "rediger") || (it.id === "actes" && state.route.view === "acte") || (it.id === "publications" && state.route.view === "publication");
      nav.appendChild(h("button", {
        class: "app-nav__item" + (active ? " is-active" : ""),
        on: { click: () => navigate(it.id) },
      }, h("span", { class: "fr-icon" }, icon(it.icon, 17)), h("span", { text: it.label })));
    }
  }

  mainEl = h("main", { class: "app-main" });
  const body = h("div", { class: "app-body" }, nav, mainEl);
  const app = h("div", { class: "app" }, notice, header, body);
  return app;
}

export function renderApp(root) {
  clear(root);
  root.appendChild(shell());
  setViewRenderer(drawView);
  drawView();
}

function drawView() {
  if (!mainEl) return;
  clear(mainEl);
  if (!allowed(state.route.view)) state.route = { view: firstAllowedView(), params: {} };
  const view = VIEWS[state.route.view] || renderTrames;
  const params = state.route.params || {};
  mainEl.className = "app-main" + (state.route.view === "trame" ? " app-main--flush" : "");
  // La présence annonce l'écran courant : les autres postes voient qui travaille
  // où. Le libellé de l'acte, lui, est posé par l'éditeur de rédaction.
  // Quitter la rédaction relâche le verrou souple de l'acte.
  if (state.route.view !== "rediger") libererRedaction();
  signalerEcranCollab(state.route.view);
  try {
    view(mainEl, params);
  } catch (e) {
    console.error(e);
    mainEl.appendChild(h("div", { class: "fr-alert fr-alert--error" },
      h("p", { class: "fr-alert__title", text: "Erreur d'affichage" }),
      h("pre", { class: "fr-mono", text: String(e && e.stack || e) }),
    ));
  }
}

// Le CSS est chargé par <link> puis recopié dans un <style> : les styles restent
// présents dans le DOM (utile notamment pour toute mise en image de la page).
async function inlineStylesheets() {
  const links = [...document.querySelectorAll('link[rel="stylesheet"]')];
  for (const l of links) {
    try {
      if (l.dataset.inlined) continue;
      const css = await fetch(l.href).then((r) => r.text());
      const style = document.createElement("style");
      style.dataset.source = l.getAttribute("href");
      style.textContent = css;
      document.head.appendChild(style);
      l.dataset.inlined = "1";
    } catch (e) {
      console.warn("Feuille de style non inlinée :", l.href, e);
    }
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

async function boot() {
  const root = document.getElementById("app");
  root.appendChild(h("div", { class: "fr-card", style: { margin: "40px auto", maxWidth: "420px" }, text: "Chargement…" }));
  applyTheme();
  await inlineStylesheets();
  try {
    await init();
  } catch (e) {
    clear(root);
    root.appendChild(h("div", { class: "fr-alert fr-alert--error" },
      h("p", { class: "fr-alert__title", text: "Initialisation impossible" }),
      h("pre", { class: "fr-mono", text: String(e && e.stack || e) }),
    ));
    return;
  }
  onChange(() => { applyBrand(); renderRoot(root); });
  window.addEventListener("hashchange", parseRoute);
  // Retour du fournisseur d'identité (annuaire) : l'URL porte `code` et `state`
  // — on échange le code, on vérifie le jeton et on ouvre la session avant
  // d'afficher quoi que ce soit. Voir src/ui/oidc.js.
  const retour = await handleAuthReturn().catch((e) => ({ handled: true, ok: false, error: (e && e.message) || String(e) }));
  if (retour.error) toast(retour.error, "error");
  else if (retour.handled && retour.ok) toast("Connexion ouverte par l'annuaire", "success");
  // Si le retour a ouvert une session, `emit()` a déjà redessiné l'application ;
  // sinon on rend l'écran de connexion (avec le message d'erreur).
  // Le système passe en sombre (ou revient en clair) : suivi tant que le choix
  // d'apparence est « Automatique ».
  onSystemThemeChange(() => { applyBrand(); emit(); });
  // Deux postes peuvent écrire en même temps : le service refuse l'écrasement et
  // renvoie sa version. On prévient l'utilisateur, et l'écran se rafraîchit.
  db.onConflict(({ collection, conflicts }) => {
    toast(`${conflicts.length} élément(s) de « ${COLLECTIONS[collection]?.label || collection} » ont été modifiés sur un autre poste. La version de la base a été reprise.`, "warning");
    emit();
  });
  db.onStatus(() => { if (state.ready) emit(); });
  // Raccourcis globaux (Ctrl+K, « / ») : posés une seule fois.
  installerRaccourcis();
  renderRoot(root);
  parseRoute();
  // Vérifie la santé de la persistance en tâche de fond (sans bloquer l'affichage).
  db.health().catch(() => {});
}

// Sans session : écran de connexion. Avec session : application.
function renderRoot(root) {
  if (!state.user) { clear(root); renderConnexion(root); return; }
  renderApp(root);
}

// Point d'accès de diagnostic : l'état vivant de l'application, pour la console
// du navigateur et les vérifications d'installation. Rien de secret n'y figure —
// tout ce que cette poignée expose est déjà dans le navigateur de l'agent.
globalThis.scribae = { state, db, navigate, emit };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

window.addEventListener("error", (e) => console.error("Erreur globale :", e.error || e.message));
