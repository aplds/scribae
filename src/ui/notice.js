// ============================================================================
// Bandeaux de tête : démonstration, référentiel vierge — et messages de
// l'administration (voir src/lib/bandeaux.js).
//
// DÉMONSTRATION. Elle est décidée par le DÉPLOIEMENT (`.env`, `DEMO`), jamais par
// ce fichier : `demoActif()` est la seule source de vérité (src/lib/demo.js). Le
// réglage `config.brand.demo` n'en est qu'un miroir. Quand la démonstration est
// éteinte, aucun bandeau de ce genre n'a de raison d'être — et l'application ne
// doit laisser AUCUNE trace de la collectivité fictive.
//
// RÉFÉRENTIEL VIERGE. Démonstration éteinte et référentiel neuf : l'outil n'a
// rien à montrer tant que l'administrateur n'a pas bâti son référentiel (identité,
// entités, services, rôles, personnes…). Le premier écran le DIT et propose le
// premier pas, plutôt que de laisser des écrans vides qu'on confondrait avec une
// panne.
//
// Le texte de la mention de démonstration est modifiable (brand.demoText) : une
// installation peut préférer « Recette », « Bac à sable », etc.
//
// ÉDITION STATIQUE (GitHub Pages, ou tout service de fichiers). Elle est
// repérée par `__SCRIBA_STATIC__`, posé par `src/pages/host.js` : la page
// héberge elle-même le service, dont l'état vit dans le stockage du navigateur.
// Rien n'est donc partagé entre postes, et le bandeau doit le DIRE — c'est la
// première chose qu'un visiteur venu d'un forum comprend de travers (« je l'ai
// montré à ma collègue, elle ne voit pas mes actes »). Le libellé du mode de
// persistance ne suffit pas : il se lit dans un écran d'administration.
// ============================================================================
import { h, icon, button } from "./dom.js";
import { state, navigate } from "./state.js";
import { demoActif, referentielVierge } from "../lib/demo.js";
import { bandeauxActifs, couleurBandeau } from "../lib/bandeaux.js";

export const DEMO_TEXT = "Installation de démonstration : les données sont fictives, la signature électronique est simulée. Ne pas produire d'actes réels avec cette installation.";

// Ce que l'édition statique ajoute à la mention : elle tient lieu de serveur, et
// son « partage » s'arrête aux onglets d'un même navigateur. Le dire ici vaut
// mieux que de le laisser deviner par un écran d'administration.
//
// Une page statique peut aussi être RELIÉE à un service (`__SCRIBA_SERVICE_URL__`,
// voir src/pages/host.js) : là, les données sont bel et bien communes, et le
// bandeau doit dire l'inverse de la phrase ci-dessus.
export const STATIC_TEXT = "Édition statique : cette page héberge elle-même son service, dont l'état vit dans VOTRE navigateur. Rien n'est partagé entre postes — pour travailler à plusieurs, il faut un service (voir le README du dépôt).";

export const STATIC_SHARED_TEXT = "Édition statique reliée à un service : les fichiers de la page sont servis en statique, mais les données sont communes — tous les postes qui visent le même service voient le même référentiel.";

export const isDemo = () => demoActif(state.config);

// L'édition statique : celle dont la page héberge le service.
export const editionStatique = () => globalThis.__SCRIBA_STATIC__ === true;

// La page statique est-elle branchée sur un service commun ?
export const statiquePartagee = () => globalThis.__SCRIBA_STATIC_SHARED__ === true;

// Le texte du bandeau de démonstration : celui de la collectivité s'il est réglé
// (brand.demoText), sinon la mention livrée — suivi, en édition statique, de ce
// que cette édition a de particulier.
export function texteBandeauDemo() {
  const base = state.config?.brand?.demoText || DEMO_TEXT;
  if (!editionStatique()) return base;
  return base + " " + (statiquePartagee() ? STATIC_SHARED_TEXT : STATIC_TEXT);
}

export function demoNotice(extra) {
  if (!isDemo()) return null;
  return h("div", { class: "app-demo" },
    h("span", { class: "app-demo__tag" }, icon("info", 13), h("span", { text: "Démonstration" })),
    h("span", { class: "app-demo__text", text: texteBandeauDemo() }),
    extra || null,
  );
}

// Le bandeau de l'édition statique, quand celui de la démonstration ne suffit
// pas : une installation servie en fichiers, et qui ne se dit plus en
// démonstration, doit quand même dire que rien n'est partagé. Le bandeau de
// démonstration le porte déjà (voir `texteBandeauDemo`).
export function staticNotice(extra) {
  if (!editionStatique() || isDemo()) return null;
  return h("div", { class: "app-demo" },
    h("span", { class: "app-demo__tag" }, icon("info", 13), h("span", { text: "Édition statique" })),
    h("span", { class: "app-demo__text", text: statiquePartagee() ? STATIC_SHARED_TEXT : STATIC_TEXT }),
    extra || null,
  );
}

// Les bandeaux d'information de l'administration (voir src/lib/bandeaux.js) :
// les messages allumés, dans l'ordre du référentiel — maintenance programmée,
// alerte, annonce. Ils s'affichent PARTOUT où le bandeau de démonstration
// s'affiche (atelier, recueil public, écran de connexion), et PAR-DESSUS lui :
// une maintenance annoncée pendant une démonstration se lit quand même. Rend un
// TABLEAU (vide le plus souvent) : `h()` aplati les tableaux, on l'étale donc
// (`...bandeauxNotice()`).
export function bandeauxNotice() {
  return bandeauxActifs(state.config).map((b) => {
    const couleur = couleurBandeau(b.couleur);
    const titre = String(b.titre || "").trim() || "Information";
    return h("div", { class: "app-bandeau app-bandeau--" + couleur, role: "status", "data-bandeau": b.id },
      h("span", { class: "app-bandeau__tag" }, icon("info", 13), h("span", { text: titre })),
      h("span", { class: "app-bandeau__text", text: String(b.texte || "").trim() }),
    );
  });
}

// Le rafraîchissement en direct : la coquille (dont les bandeaux) n'est bâtie
// qu'au chargement — un redessin de vue ne la touche pas (voir src/ui/app.js,
// `renderApp` / `drawView`). Quand l'administration allume, éteint ou retouche
// un bandeau, on remplace donc les bandeaux affichés par des neufs, à la même
// place : après le bandeau de tête (démonstration, édition statique) s'il y en
// a un, sinon en tête du conteneur. Même geste, en plus simple, que le texte du
// bandeau de démonstration que l'écran d'identité retouche en direct.
export function rafraichirBandeaux() {
  const anciens = [...document.querySelectorAll(".app-bandeau")];
  const neufs = bandeauxNotice();
  if (anciens.length) {
    const parent = anciens[0].parentNode;
    const suivant = anciens[anciens.length - 1].nextSibling;
    for (const a of anciens) a.remove();
    for (const n of neufs) parent.insertBefore(n, suivant);
    return;
  }
  const tete = document.querySelector(".app-demo, .app-vierge");
  if (tete && tete.parentNode) {
    for (const n of neufs) tete.parentNode.insertBefore(n, tete.nextSibling);
    return;
  }
  const conteneur = document.querySelector(".app, .recueil, .connexion");
  if (conteneur) for (const n of neufs.reverse()) conteneur.prepend(n);
}

// L'invitation du premier écran : « votre référentiel est vierge, commencez
// ici ». Rendue une seule fois que le référentiel soit vide, et seulement hors
// démonstration — un référentiel de fiction n'est pas vierge.
export function viergeNotice(extra) {
  if (isDemo() || !state.config) return null;
  if (!referentielVierge(state.config)) return null;
  return h("div", { class: "app-vierge" },
    h("span", { class: "app-vierge__tag" }, icon("info", 13), h("span", { text: "Référentiel vierge" })),
    h("span", { class: "app-vierge__text", text: "Cette installation n'a pas encore de référentiel : ni identité, ni entité, ni service, ni personne. Commencez par Administration › Identité, puis Entités, Services, Rôles et Personnes — les trames viendront ensuite." }),
    extra !== undefined ? extra : button("Commencer", { variant: "tertiary", size: "sm", onClick: () => navigate("referentiel") }),
  );
}
