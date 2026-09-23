import {
  state, init, parseRoute, navigate, onChange, applyBrand, setViewRenderer, can, logout,
  currentUser, emit, signalerEcranCollab, libererRedaction, demandeAtelier,
} from "./state.js";
import { h, clear, icon, button, badge, toast } from "./dom.js";
import { APP_NAME, APP_TAGLINE, markEl } from "./brand.js";
import { mentionAffichee, contenuMention } from "./mention.js";
import { versionBadge, releasedLabel } from "../lib/version.js";
import { fullName, roleLabel, badgesOf, initialsOf, estVisiteur } from "../lib/users.js";
import { scopeLabel } from "../lib/scope.js";
import { storageAvailable } from "../lib/store.js";
import { applyTheme, onSystemThemeChange, brandLogoUrl } from "../lib/theme.js";
import { authConfig, isTestProvider, accesLocal, sessionDeService } from "../lib/auth.js";
import { themeButton, themeChooser } from "./theme.js";
import * as db from "../lib/db/index.js";
import { COLLECTIONS } from "../lib/db/contract.js";
import { demoNotice, viergeNotice } from "./notice.js";
import { renderConnexion } from "./views/connexion.js";
import { ouvrirChangementMotDePasse } from "./mot-de-passe.js";
import { renderSansAcces } from "./views/sans-acces.js";
import { renderHorsReseau } from "./views/hors-reseau.js";
import { chargerAcces, horsReseau, surAcces } from "../lib/atelier-acces.js";
import { handleAuthReturn } from "./oidc.js";
import { renderComptes } from "./views/comptes.js";
import { renderTrames } from "./views/trames.js";
import { renderEditor } from "./views/editor.js";
import { renderRediger } from "./views/rediger.js";
import { renderActes } from "./views/actes.js";
import { renderDelegations } from "./views/delegations.js";
import { renderOrganigramme } from "./views/organigramme.js";
import { renderChrono } from "./views/chrono.js";
import { renderReferentiel } from "./views/referentiel.js";
import { renderStyles } from "./views/styles.js";
import { renderAide } from "./views/aide.js";
import { renderModifier, renderActeDetail } from "./views/modifier.js";
import { renderSignature } from "./views/signature.js";
import { renderPublications } from "./views/publications.js";
import { renderInformations } from "./views/informations.js";
import { renderBulletin } from "./views/bulletin.js";
import { renderRecueilPublic, retirerMetaRecueil } from "./views/recueil-public.js";
import { amorcerRecueil } from "./demo-publications.js";
import { appliquerAbrogations } from "./abrogations-apply.js";
import { renderDocs } from "./views/docs.js";
import { renderApiReference } from "./views/api-reference.js";
import { renderParapheur } from "./views/parapheur.js";
import { renderRevision } from "./views/revision.js";
import { renderExecution } from "./views/execution.js";
import { renderCorbeille } from "./views/corbeille.js";
import { monterBarreCollab } from "./collab.js";
import { avecCurseur } from "./focus.js";
import { monterAssistants, assistantsChooser } from "./assistant.js";
import { installerRaccourcis, ouvrirRecherche } from "./global-search.js";

// La barre de gauche suit la VIE DE L'ACTE plutôt que la liste des écrans : on
// écrit (Produire), on valide (Valider), on rend l'acte opposable et public
// (Publier). Les référentiels qui décrivent la collectivité — qui la compose,
// qui signe à la place de qui, comment on numérote — sont rangés à part
// (Organisation) : ce ne sont pas des gestes de production, mais une donnée
// qu'on consulte. La corbeille range les actes et les trames retirés : elle
// appartient à l'atelier, pas aux réglages.
const NAV = [
  { group: "Produire", items: [
    { id: "trames", label: "Trames", icon: "doc", perm: "trames.voir" },
    { id: "rediger", label: "Rédiger un acte", icon: "plus", perm: "actes.rediger" },
    { id: "modifier", label: "Modifier un acte", icon: "refresh", perm: "actes.gerer" },
    { id: "actes", label: "Actes", icon: "list", perm: "actes.rediger" },
    // La corbeille appartient à l'atelier : ce sont les actes et les trames
    // retirés du registre, que tout rédacteur peut consulter et rétablir.
    { id: "corbeille", label: "Corbeille", icon: "trash", perm: "actes.rediger" },
  ] },
  // Le circuit d'avant-signature : le parapheur (vérification, visa, signature)
  // et la révision du texte. Un moment et un métier à part de la rédaction, donc
  // une rubrique à part.
  { group: "Valider", items: [
    { id: "parapheur", label: "Parapheur", icon: "check", perm: "actes.valider" },
    { id: "revision", label: "Révision", icon: "eye", perm: "actes.reviser" },
  ] },
  { group: "Publier", items: [
    { id: "signature", label: "Signature & publication", icon: "lock", perm: "actes.signer" },
    { id: "execution", label: "Exécution & délais", icon: "list", perm: "actes.rediger" },
    { id: "publications", label: "Publications (ELI)", icon: "eye", perm: "signature.gerer" },
    // Les INFORMATIONS du recueil public : les billets que la collectivité
    // publie (actualités, avis, communications). Ils ne se signent pas et ne
    // reçoivent pas d'identifiant ELI — c'est un geste de communication, pas de
    // publication d'acte, et il a sa propre permission.
    { id: "informations", label: "Informations", icon: "bulle", perm: "informations.gerer" },
    // LE BULLETIN (ou Journal) des actes : le recueil rassemblé par période,
    // adressé aux abonnés et suivi par un flux. Il ne se signe pas et ne se
    // numérote pas acte par acte — c'est une forme de la publication, d'où sa
    // place ici, à côté des informations.
    { id: "bulletin", label: "Bulletin", icon: "bulle", perm: "bulletin.gerer" },
    // Le recueil public est ouvert à tous, y compris hors de l'atelier : sa
    // place dans le menu est une commodité, non un droit.
    { id: "recueil", label: "Recueil public", icon: "globe" },
  ] },
  // Les référentiels de la collectivité : sa structure (l'organigramme), les
  // délégations de signature, et le chrono qui dit comment les numéros sont
  // tirés. Ouverts à tous les comptes — savoir qui existe et qui signe n'est pas
  // une donnée réservée ; seules leurs modifications sont gardées.
  { group: "Organisation", items: [
    { id: "organigramme", label: "Organigramme", icon: "org" },
    { id: "delegations", label: "Délégations", icon: "org" },
    // Le chrono : le registre des numéros tirés. Il se lit comme les actes —
    // tout rédacteur a le droit de savoir quel numéro porte quoi — mais ses deux
    // gestes d'écriture (passer à l'année suivante, annuler un rang) sont
    // réservés à l'administration, dans la vue.
    { id: "chrono", label: "Chrono de numérotation", icon: "list", perm: "actes.rediger" },
  ] },
  { group: "Configurer", items: [
    { id: "referentiel", label: "Administration", icon: "grid", perm: "referentiel.gerer" },
    { id: "styles", label: "Feuilles de style", icon: "palette", perm: "trames.styles" },
  ] },
  { group: "Aide", items: [
    { id: "aide", label: "Guide", icon: "info" },
    // La référence de l'API REST et son panneau de commande : réservés à qui
    // peut lire la documentation technique (permission « docs.voir »), puisque
    // le panneau joue de VRAIS appels sur le service.
    { id: "api", label: "API REST", icon: "doc", perm: "docs.voir" },
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
  organigramme: null,
  chrono: "actes.rediger",
  modifier: "actes.gerer",
  signature: "actes.signer",
  publications: "signature.gerer",
  publication: "signature.gerer",
  informations: "informations.gerer",
  bulletin: "bulletin.gerer",
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
  api: "docs.voir",
};
// Le parapheur n'est plus expérimental (1.5.0) : son écran est accessible comme
// les autres, et c'est la présence de circuits qui décide de ce qu'il montre.
const allowed = (view) => !VIEW_PERMS[view] || can(VIEW_PERMS[view]);
const firstAllowedView = () => ["trames", "rediger", "actes", "signature", "publications", "aide"].find(allowed) || "aide";

const VIEWS = {
  trames: renderTrames,
  trame: renderEditor,
  rediger: renderRediger,
  actes: renderActes,
  acte: renderActeDetail,
  delegations: renderDelegations,
  organigramme: renderOrganigramme,
  chrono: renderChrono,
  modifier: renderModifier,
  referentiel: renderReferentiel,
  styles: renderStyles,
  signature: renderSignature,
  publications: renderPublications,
  publication: renderConsultationRoute,
  informations: renderInformations,
  bulletin: renderBulletin,
  comptes: renderComptes,
  parapheur: renderParapheur,
  revision: renderRevision,
  execution: renderExecution,
  corbeille: renderCorbeille,
  aide: renderAide,
  docs: renderDocs,
  api: renderApiReference,
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
// La coquille entière : elle porte l'état « plein écran » de l'éditeur de trame
// (`app--plein`), qui borne la hauteur pour que les volets défilent sur place —
// et pour que le canvas de la feuille ait une vraie fenêtre à déplacer.
let appEl = null;

// Pastille d'état de la persistance : discrète en mode local (c'est le mode par
// défaut), explicite dès que les données sont partagées. Les quatre états ont
// chacun leur mot : un service qu'on interroge encore n'est pas un service en
// erreur — lui donner le mot de l'erreur faisait croire à une panne à chaque
// redessin, alors que la connexion était simplement en cours.
//
// Elle porte un identifiant : l'état de la base change souvent, et c'est ELLE
// qu'on remplace alors, sans reconstruire l'écran (voir `rafraichirPastilleBase`).
function storageBadge() {
  if (!db.isShared()) return null;
  const st = db.status();
  const ETATS = {
    ok: ["success", "base partagée"],
    offline: ["warning", "base hors ligne"],
    error: ["error", "base : erreur"],
    unknown: ["info", "base : connexion…"],
  };
  const [color, text] = ETATS[st.state] || ETATS.unknown;
  return h("span", { id: "storage-badge", class: "fr-badge fr-badge--" + color, title: st.detail || "", text });
}

// L'état de la base change à chaque écriture qui passe (ou qui échoue) : le
// signaler ne doit pas refaire la page. On remplace la SEULE pastille de
// l'en-tête — et si c'est le MODE qui a changé (locale ⇄ partagée), la pastille
// apparaît ou disparaît : là, la coquille est refaite, une fois.
function rafraichirPastilleBase() {
  const actuelle = document.getElementById("storage-badge");
  const suivante = storageBadge();
  if (actuelle && suivante) { actuelle.replaceWith(suivante); return; }
  if (!actuelle && !suivante) return;
  emit();
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
  // Un compte local (mode mot de passe, ou compte de service en mode annuaire)
  // peut changer SON mot de passe ; les autres se contentent de changer de
  // compte. Voir src/lib/auth.js, `accesLocal`.
  if (accesLocal(state.config)) {
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
  // L'emblème du référentiel, dans la variante du thème courant : la coquille est
  // reconstruite à chaque changement d'apparence, le logo suit donc sans autre
  // précaution (voir `brandLogoUrl`, src/lib/theme.js).
  const logo = brandLogoUrl(brand);

  // Bandeau de démonstration : en tête, au-dessus de l'en-tête. Il n'apparaît
  // que si le DÉPLOIEMENT a allumé la démonstration (voir src/lib/demo.js).
  const notice = demoNotice(can("referentiel.gerer")
    ? button("Réglage", { variant: "tertiary", size: "sm", onClick: () => navigate("referentiel") })
    : null);

  // Invitation du premier pas : démonstration éteinte et référentiel vierge.
  // Elle occupe la place du bandeau de démonstration — jamais les deux à la fois.
  // Le raccourci n'est proposé qu'à qui peut tenir le référentiel.
  const vierge = notice ? null : viergeNotice(can("referentiel.gerer") ? undefined : null);

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
        logo
          ? h("img", { src: logo, alt: "" })
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
  // LE PIED DE L'ATELIER : la mention de l'éditeur du logiciel, en bas de page —
  // discrète, et éteignable depuis Administration › Identité (voir
  // src/ui/mention.js). L'éditeur de trame occupe toute la hauteur (`.app--plein`) :
  // le pied s'y efface, la feuille ne se dispute pas la place avec lui.
  const pied = mentionAffichee()
    ? h("footer", { class: "app-pied" }, h("p", { class: "app-pied__mention" }, ...contenuMention()))
    : null;
  const app = h("div", { class: "app" }, notice, vierge, header, body, pied);
  appEl = app;
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
  // Le redessin d'une vue ne doit pas coûter son curseur à l'agent : une
  // sauvegarde différée, un état de base qui change, une donnée qui arrive, et
  // le champ en cours de saisie était reconstruit. Voir src/ui/focus.js.
  avecCurseur(drawViewNow, () => state.route.view);
}

function drawViewNow() {
  clear(mainEl);
  if (!allowed(state.route.view)) state.route = { view: firstAllowedView(), params: {} };
  const view = VIEWS[state.route.view] || renderTrames;
  const params = state.route.params || {};
  poserTitreEcran();
  mainEl.className = "app-main" + (state.route.view === "trame" ? " app-main--flush" : "");
  // L'éditeur de trame est un écran « plein » : sa hauteur doit être bornée à la
  // fenêtre, sinon il s'allonge avec son contenu et les volets (plan, inspecteur,
  // feuille) ne défilent plus sur place — voir `.app--plein`.
  if (appEl) appEl.classList.toggle("app--plein", state.route.view === "trame");
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
  // Deux images d'attente : le temps que la feuille recopiée s'applique. Sur un
  // onglet que le navigateur ne peint pas — arrière-plan, aperçu réduit, iframe
  // hors de l'écran —, aucune image n'arrive : on ne reste donc pas suspendu à
  // l'écran « Chargement… ». Un délai bref fait office de repli.
  await new Promise((r) => {
    let fini = false;
    const terminer = () => { if (!fini) { fini = true; r(); } };
    requestAnimationFrame(() => requestAnimationFrame(terminer));
    setTimeout(terminer, 250);
  });
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
  // L'état de la base, lui, ne refait pas l'écran : il ne change QUE ce que la
  // pastille de l'en-tête en dit (et, sur l'écran qui le montre, le panneau
  // « Base de données » s'en aperçoit par lui-même). Un service qui refuse une
  // écriture pendant une saisie ne doit pas la faire perdre.
  db.onStatus(() => { if (state.ready) rafraichirPastilleBase(); });
  // Raccourcis globaux (Ctrl+K, « / ») : posés une seule fois.
  installerRaccourcis();
  // Les deux assistants (l'atelier et le recueil) : posés une seule fois, hors
  // de la coquille, pour qu'une conversation en cours survive aux redessins.
  // Leur visibilité suit la route. Voir src/ui/assistant.js.
  monterAssistants();
  renderRoot(root);
  proposerMotDePasse(root);
  parseRoute();
  // L'accès à l'atelier : la question se pose au service, qui seul voit d'où
  // l'on vient. On ne l'attend pas — un service lent ne doit pas retarder
  // l'écran —, et son verdict (publié par `surAcces`) redessine la page s'il
  // change quelque chose : l'écran « hors réseau », notamment.
  // Voir src/lib/atelier-acces.js.
  chargerAcces().catch(() => {});
  surAcces(() => renderRoot(root));
  // Vérifie la santé de la persistance en tâche de fond (sans bloquer l'affichage).
  db.health().catch(() => {});
  // Et represente, doucement, les écritures mises de côté : la file n'était
  // rejouée que par une lecture ou un contrôle de santé, si bien qu'un poste
  // laissé sur un écran immobile pouvait garder ses écritures des heures, même
  // après le retour de la base. Voir `reprendreAuto` (src/lib/db/index.js).
  db.reprendreAuto();
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
  if (sessionDeService(state.config) && !state.user) return;
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
//
// L'exception est l'ATELIER DEMANDÉ (« ?atelier », « /atelier ») : là, l'adresse
// mal lue ne ramène pas au recueil — ce serait répondre à côté —, elle ramène au
// premier écran que l'agent a le droit d'ouvrir (voir `demandeAtelier`).
function normaliserRoute() {
  const v = state.route && state.route.view;
  if (!v || VIEWS[v] || EST_PUBLIQUE(v)) return;
  state.route = demandeAtelier()
    ? { view: firstAllowedView(), params: {} }
    : { view: "recueil", params: {} };
}

function renderRoot(root) {
  // La coquille entière est reconstruite (déconnexion, changement d'écran,
  // données rechargées) : le curseur et le défilement sont repris après coup —
  // hors changement d'écran, où la nouvelle page commence en haut. Voir
  // src/ui/focus.js.
  avecCurseur(() => renderRootMaintenant(root), () => state.route.view);
}

function renderRootMaintenant(root) {
  normaliserRoute();
  publicMode = EST_PUBLIQUE(state.route.view);
  clear(root);
  if (publicMode) { renderRecueilPublic(root, state.route.params || {}); return; }
  // On quitte le recueil : ses métadonnées (titre, canonique, JSON-LD) n'ont
  // plus lieu d'être dans la page de l'atelier.
  retirerMetaRecueil();
  // L'accès à l'atelier peut être restreint à certaines adresses (intranet d'une
  // commune) : le service l'a dit, et c'est lui qui le fait respecter. Ici, on
  // l'annonce AVANT la connexion — découvrir un refus au premier clic, sans
  // explication, serait le pire des accueils.
  if (horsReseau()) { renderHorsReseau(root); return; }
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
