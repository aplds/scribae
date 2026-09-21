import {
  state, init, parseRoute, navigate, onChange, applyBrand, setViewRenderer, can, logout,
  currentUser, emit, signalerEcranCollab, libererRedaction, parapheurActif,
} from "./state.js";
import { h, clear, icon, button, badge, toast } from "./dom.js";
import { APP_NAME, APP_TAGLINE, markEl } from "./brand.js";
import { versionBadge, releasedLabel } from "../lib/version.js";
import { fullName, roleLabel, badgesOf, initialsOf, estVisiteur } from "../lib/users.js";
import { scopeLabel } from "../lib/scope.js";
import { storageAvailable } from "../lib/store.js";
import { applyTheme, onSystemThemeChange } from "../lib/theme.js";
import { authConfig, isTestProvider, isPassword } from "../lib/auth.js";
import { themeButton, themeChooser } from "./theme.js";
import * as db from "../lib/db/index.js";
import { COLLECTIONS } from "../lib/db/contract.js";
import { demoNotice } from "./notice.js";
import { renderConnexion } from "./views/connexion.js";
import { ouvrirChangementMotDePasse } from "./mot-de-passe.js";
import { renderSansAcces } from "./views/sans-acces.js";
import { handleAuthReturn } from "./oidc.js";
import { renderComptes } from "./views/comptes.js";
import { renderTrames } from "./views/trames.js";
import { renderEditor } from "./views/editor.js";
import { renderRediger } from "./views/rediger.js";
import { renderActes } from "./views/actes.js";
import { renderDelegations } from "./views/delegations.js";
import { renderReferentiel } from "./views/referentiel.js";
import { renderStyles } from "./views/styles.js";
import { renderAide } from "./views/aide.js";
import { renderModifier, renderActeDetail } from "./views/modifier.js";
import { renderSignature } from "./views/signature.js";
import { renderPublications } from "./views/publications.js";
import { renderRecueilPublic, retirerMetaRecueil } from "./views/recueil-public.js";
import { amorcerRecueil } from "./demo-publications.js";
import { appliquerAbrogations } from "./abrogations-apply.js";
import { renderDocs } from "./views/docs.js";
import { renderParapheur } from "./views/parapheur.js";
import { renderRevision } from "./views/revision.js";
import { renderExecution } from "./views/execution.js";
import { renderCorbeille } from "./views/corbeille.js";
import { monterBarreCollab } from "./collab.js";
import { monterAssistants, assistantsChooser } from "./assistant.js";
import { installerRaccourcis, ouvrirRecherche } from "./global-search.js";

const NAV = [
  { group: "Produire", items: [
    { id: "trames", label: "Trames", icon: "doc", perm: "trames.voir" },
    { id: "rediger", label: "Rédiger un acte", icon: "plus", perm: "actes.rediger" },
    { id: "modifier", label: "Modifier un acte", icon: "refresh", perm: "actes.gerer" },
    { id: "actes", label: "Actes", icon: "list", perm: "actes.rediger" },
    { id: "delegations", label: "Délégations", icon: "org" },
    { id: "parapheur", label: "Parapheur", icon: "check", perm: "actes.valider", experimental: true },
    { id: "revision", label: "Révision", icon: "eye", perm: "actes.reviser" },
  ] },
  { group: "Publier", items: [
    { id: "signature", label: "Signature & publication", icon: "lock", perm: "actes.signer" },
    { id: "execution", label: "Exécution & délais", icon: "list", perm: "actes.rediger" },
    { id: "publications", label: "Publications (ELI)", icon: "eye", perm: "signature.gerer" },
    // Le recueil public est ouvert à tous, y compris hors de l'atelier : sa
    // place dans le menu est une commodité, non un droit.
    { id: "recueil", label: "Recueil public", icon: "globe" },
  ] },
  { group: "Configurer", items: [
    { id: "referentiel", label: "Administration", icon: "grid", perm: "referentiel.gerer" },
    { id: "styles", label: "Feuilles de style", icon: "palette", perm: "trames.styles" },
    { id: "corbeille", label: "Corbeille", icon: "trash", perm: "actes.rediger" },
  ] },
  { group: "Aide", items: [
    { id: "aide", label: "Guide", icon: "info" },
    { id: "docs", label: "Documentation technique", icon: "doc", perm: "docs.voir" },
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
  // L'organigramme des délégations est visible par TOUS les comptes : savoir qui
  // peut signer à la place de qui n'est pas une donnée réservée. Ce sont les
  // modifications qui sont gardées (permission « delegations.gerer », contrôlée
  // dans la vue).
  delegations: null,
  modifier: "actes.gerer",
  signature: "actes.signer",
  publications: "signature.gerer",
  publication: "signature.gerer",
  referentiel: "referentiel.gerer",
  styles: "trames.styles",
  comptes: "comptes.gerer",
  parapheur: "actes.valider",
  revision: "actes.reviser",
  execution: "actes.rediger",
  corbeille: "actes.rediger",
  aide: null,
  // La documentation technique (exploitation, installation, sécurité) est
  // réservée aux administrateurs.
  docs: "docs.voir",
};
// Le parapheur est une fonction expérimentale : éteint, son écran n'est pas
// accessible, même par un lien direct (voir src/lib/validation.js).
const allowed = (view) => (!VIEW_PERMS[view] || can(VIEW_PERMS[view])) && (view !== "parapheur" || parapheurActif());
const firstAllowedView = () => ["trames", "rediger", "actes", "signature", "publications", "aide"].find(allowed) || "aide";

const VIEWS = {
  trames: renderTrames,
  trame: renderEditor,
  rediger: renderRediger,
  actes: renderActes,
  acte: renderActeDetail,
  delegations: renderDelegations,
  modifier: renderModifier,
  referentiel: renderReferentiel,
  styles: renderStyles,
  signature: renderSignature,
  publications: renderPublications,
  publication: renderConsultationRoute,
  comptes: renderComptes,
  parapheur: renderParapheur,
  revision: renderRevision,
  execution: renderExecution,
  corbeille: renderCorbeille,
  aide: renderAide,
  docs: renderDocs,
};

// Les écrans PUBLICS échappent à la coquille : ni session, ni navigation, ni
// compte. Le recueil est un site à part, servi par la même page (« #/recueil »,
// « #/recueil/<clé> ») : c'est ce qui permet de le citer et de le partager.
const EST_PUBLIQUE = (view) => view === "recueil";
let publicMode = false;

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
    h("span", { class: "fr-small fr-muted", text: (u.email || u.login) + " · " + roleLabel(u) }),
    // Les rôles CUMULÉS se lisent d'un coup d'œil : un éditeur-réviseur porte
    // deux pastilles, et l'on voit laquelle il tient de l'annuaire.
    h("span", { class: "fr-row", style: { gap: "4px", flexWrap: "wrap", margin: "2px 0" } },
      ...badgesOf(u).map((b) => h("span", { class: "fr-badge fr-badge--" + b.badge, text: b.label }))),
    h("span", { class: "fr-small fr-muted", text: "Périmètre : " + scopeLabel(state.config, u) }),
    // Compte rattaché à l'annuaire : on rappelle d'où vient le rôle, pour que
    // l'agent (et l'administrateur à qui il montre son écran) le voie.
    u.source === "oidc"
      ? h("span", { class: "fr-small fr-muted", text: "Annuaire" + (u.oidcClaim ? " · groupe « " + u.oidcClaim + " »" : "") + (isTestProvider(authConfig(state.config)) ? " (essai)" : "") })
      : null,
  ));
  if (can("comptes.gerer")) menu.appendChild(item("Comptes et rôles", "lock", () => navigate("comptes")));
  if (can("referentiel.gerer")) menu.appendChild(item("Administration", "gear", () => navigate("referentiel")));
  menu.appendChild(item("Guide d'utilisation", "info", () => navigate("aide")));
  if (can("docs.voir")) menu.appendChild(item("Documentation technique", "doc", () => navigate("docs")));
  menu.appendChild(h("hr", { class: "app-user__sep" }));
  menu.appendChild(themeChooser());
  // Les assistants (Plume, Publia) : l'agent peut les éteindre POUR SON COMPTE,
  // comme il choisit l'apparence de son poste. Le réglage de l'installation
  // (Administration › Assistants) reste, lui, à l'administrateur.
  const assistants = assistantsChooser();
  if (assistants) menu.appendChild(assistants);
  // En mode mot de passe, on ne « change » pas de compte en choisissant dans une
  // liste : on se déconnecte, et l'écran de connexion reprend la main. Le menu
  // porte donc la déconnexion, plus le changement de son propre mot de passe.
  if (isPassword(state.config)) {
    menu.appendChild(item("Changer mon mot de passe", "lock", () => ouvrirChangementMotDePasse({ surFait: () => emit() })));
    menu.appendChild(item("Se déconnecter", "x", () => logout()));
  } else {
    menu.appendChild(item("Changer de compte", "x", () => logout()));
  }
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
      h("span", { class: "app-user__role", text: roleLabel(u) }),
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
  // quand l'administrateur l'a coupé (Administration › Identité).
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
      can("referentiel.gerer") ? h("span", { class: "app-header__ref" }, button("Administration", { variant: "secondary", icon: "gear", size: "", onClick: () => navigate("referentiel") })) : null,
      themeButton(),
      userMenu(),
    ),
  );

  const nav = h("nav", { class: "app-nav" });
  for (const g of NAV) {
    const items = g.items.filter((it) => (!it.perm || can(it.perm)) && (!it.experimental || parapheurActif()));
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
  if (!mainEl || publicMode) return;
  clear(mainEl);
  if (!allowed(state.route.view)) state.route = { view: firstAllowedView(), params: {} };
  const view = VIEWS[state.route.view] || renderTrames;
  const params = state.route.params || {};
  poserTitreEcran();
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

// Titre du document : chaque écran de l'atelier DIT où l'on est. C'est le
// premier repère d'un lecteur d'écran, et ce qui nomme l'onglet du navigateur —
// sans lui, tous les écrans de l'application portaient le titre de la page
// (RGAA 8.5/8.6). Le recueil public, lui, pose le sien (voir
// src/ui/views/recueil-public.js).
const TITRE_ECRAN = Object.fromEntries(
  NAV.flatMap((g) => g.items.map((i) => [i.id, i.label])).concat([
    ["trame", "Trame"], ["acte", "Acte"], ["publication", "Publication"],
  ]),
);

function poserTitreEcran() {
  const label = TITRE_ECRAN[state.route.view] || "";
  const nom = String(state.config?.brand?.name || "").trim();
  document.title = [label, nom || APP_NAME].filter(Boolean).join(" — ");
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
  // La route (un lien profond « #/recueil/<clé> », par exemple) est lue AVANT
  // l'initialisation : un visiteur qui suit le lien du recueil ne voit pas
  // l'écran de connexion clignoter avant la bascule. Sans ancre ni paramètre,
  // c'est la route par défaut qui s'applique : le recueil public, la page
  // d'accueil du site (voir `state.route`).
  parseRoute();
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
  onChange(() => { applyBrand(); renderRoot(root); proposerMotDePasse(root); });
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
  // Les deux assistants (l'atelier et le recueil) : posés une seule fois, hors
  // de la coquille, pour qu'une conversation en cours survive aux redessins.
  // Leur visibilité suit la route. Voir src/ui/assistant.js.
  monterAssistants();
  renderRoot(root);
  proposerMotDePasse(root);
  parseRoute();
  // Vérifie la santé de la persistance en tâche de fond (sans bloquer l'affichage).
  db.health().catch(() => {});
  // Démonstration : le recueil public se remplit au premier démarrage (les
  // actes que la fiction déclare publiés sont publiés par le chemin réel, et
  // le service leur attribue leur ELI). Silencieux et sans effet sur une
  // installation réelle — voir src/ui/demo-publications.js.
  // Les abrogations prévues par un acte prennent effet au jour de l'ENTRÉE EN
  // VIGUEUR de cet acte : on regarde, à chaque démarrage, celles dont le terme
  // est arrivé (idempotent, silencieux). Voir src/ui/abrogations-apply.js.
  // En mode mot de passe, ces deux tâches attendent la SESSION : le registre
  // n'est lisible qu'une fois identifié, et elles n'ont rien à faire avant.
  tachesDeFond();
}

// Les deux tâches de fond qui suivent le démarrage, et que la session peut
// retarder (mode mot de passe) : on ne les lance qu'une fois, et seulement
// quand le registre est là.
let tachesDeFondFaites = false;
function tachesDeFond() {
  if (tachesDeFondFaites || !state.ready) return;
  if (isPassword(state.config) && !state.user) return;
  tachesDeFondFaites = true;
  amorcerRecueil().catch((e) => console.warn("Amorçage du recueil :", e));
  appliquerAbrogations().catch((e) => console.warn("Abrogations :", e));
}

// Mot de passe provisoire : on propose le changement dès l'ouverture de session,
// une fois par session d'application. Refermer la fenêtre est un report — le
// menu du compte porte l'entrée « Changer mon mot de passe ».
let motDePassePropose = false;
function proposerMotDePasse(root) {
  if (!state.user) { motDePassePropose = false; return; }
  if (motDePassePropose || !state.motDePasseAChanger) return;
  motDePassePropose = true;
  ouvrirChangementMotDePasse({ obligatoire: true, surFait: () => renderRoot(root) });
  tachesDeFond();
}

// Sans session : écran de connexion. Avec session mais sans rôle d'application :
// écran « pas d'accès » (le visiteur est authentifié, l'atelier ne lui est pas
// ouvert). Avec session : application. Les écrans publics (le recueil) passent
// avant l'un comme avant l'autre : ils ne supposent aucun compte.
//
// L'accueil du site est le RECUEIL PUBLIC (voir `state.route`) : une adresse
// qu'on ne sait pas lire — une ancre mal recopiée, un écran qui n'existe plus —
// ne doit donc pas ouvrir l'atelier, et encore moins l'écran de connexion. Elle
// ramène à la page d'accueil, c'est-à-dire au recueil.
function normaliserRoute() {
  const v = state.route && state.route.view;
  if (!v || VIEWS[v] || EST_PUBLIQUE(v)) return;
  state.route = { view: "recueil", params: {} };
}

function renderRoot(root) {
  normaliserRoute();
  publicMode = EST_PUBLIQUE(state.route.view);
  clear(root);
  if (publicMode) { renderRecueilPublic(root, state.route.params || {}); return; }
  // On quitte le recueil : ses métadonnées (titre, canonique, JSON-LD) n'ont
  // plus lieu d'être dans la page de l'atelier.
  retirerMetaRecueil();
  if (!state.user) { renderConnexion(root); return; }
  if (estVisiteur(state.user)) { renderSansAcces(root); return; }
  renderApp(root);
}

// Point d'accès de diagnostic : l'état vivant de l'application, pour la console
// du navigateur et les vérifications d'installation. Rien de secret n'y figure —
// tout ce que cette poignée expose est déjà dans le navigateur de l'agent.
globalThis.scribae = { state, db, navigate, emit };

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();

window.addEventListener("error", (e) => console.error("Erreur globale :", e.error || e.message));
