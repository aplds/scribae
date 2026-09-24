// ============================================================================
// Écran « Pas d'accès ».
//
// Le compte est AUTHENTIFIÉ — l'identité a été vérifiée, par l'annuaire ou par
// la session ouverte — mais aucun de ses rôles ne lui ouvre l'atelier : c'est un
// **visiteur** (voir `estVisiteur`, src/lib/users.js). C'est le cas d'un agent de
// l'annuaire dont aucun groupe ne correspond à un rôle de l'application, ou d'un
// compte dont les rôles ont été retirés.
//
// Plutôt qu'une erreur sèche au moment de la connexion — qui ne dit pas quoi
// faire —, on explique la situation, on donne le contact du service qui gère
// l'application (Administration › Identité, champs « Contact d'aide »), et on
// ramène le visiteur à l'espace public : le recueil des actes se consulte sans
// compte, et reste la seule chose que cette installation lui ouvre.
// ============================================================================
import { state, logout, navigate } from "../state.js";
import { h, icon, button } from "../dom.js";
import { APP_NAME, APP_TAGLINE, markEl } from "../brand.js";
import { themeButton } from "../theme.js";
import { demoNotice } from "../notice.js";
import { chatErreurEl } from "../chats-erreur.js";
import { fullName, initialsOf, sourceOf, ROLES, VISITEUR } from "../../lib/users.js";

export function renderSansAcces(root) {
  const u = state.user;
  const brand = state.config?.brand || {};
  const contact = [brand.supportName, brand.supportPhone, brand.supportEmail].filter(Boolean);
  const groupes = String(u?.oidcClaims || "").split(",").map((s) => s.trim()).filter(Boolean);

  const card = h("div", { class: "connexion__card sans-acces__card" },
    h("div", { class: "connexion__brand" },
      markEl(40),
      h("div", {},
        h("p", { class: "connexion__name", text: APP_NAME }),
        h("p", { class: "connexion__tag", text: APP_TAGLINE }),
      ),
    ),
    h("h1", { class: "connexion__title", text: "Votre compte n'a pas accès à l'application" }),
    h("p", { class: "connexion__sub", text: "Votre identité a bien été reconnue, mais aucun rôle ne vous ouvre les écrans de l'atelier. Vous pouvez consulter les actes publiés dans l'espace public, sans compte." }),

    // Qui est connecté : le doute le plus fréquent (« suis-je sur le bon
    // compte ? ») se lève d'un coup d'œil, et le rôle « Visiteur » dit à quoi
    // s'en tenir.
    h("div", { class: "sans-acces__ident" },
      h("span", { class: "connexion__initials", text: initialsOf(u || {}) }),
      h("span", { class: "connexion__who" },
        h("span", { class: "connexion__fullname", text: fullName(u) }),
        h("span", { class: "connexion__meta", text: u?.email || u?.login || "" }),
      ),
      h("span", { class: "fr-badge fr-badge--" + ROLES[VISITEUR].badge, text: ROLES[VISITEUR].label }),
    ),

    h("p", { class: "sans-acces__motif", text: sourceOf(u) === "oidc"
      ? "Votre rôle se déduit des groupes annoncés par l'annuaire de la collectivité : aucun de vos groupes ne correspond à un rôle de l'application."
      : "Aucun rôle ne vous a été attribué dans l'application." }),
    groupes.length
      ? h("p", { class: "fr-small fr-muted", text: "Groupes reçus de l'annuaire : " + groupes.join(", ") })
      : null,

    h("div", { class: "sans-acces__contact" },
      h("h2", { class: "sans-acces__contact-title" }, icon("info", 16), h("span", { text: "Demander un accès ?" })),
      contact.length
        ? h("p", { text: "Adressez-vous à " + contact.join(" — ") + " : le service qui gère l'application attribue les rôles." })
        : h("p", { text: "Adressez-vous au service qui gère l'application : c'est lui qui attribue les rôles. Ses coordonnées n'ont pas encore été renseignées (Administration → Identité, champs « Contact d'aide »)." }),
      h("p", { class: "fr-small fr-muted", text: "Indiquez-lui votre nom et, si vous le connaissez, le groupe de votre annuaire auquel vous devriez être rattaché : cela fait gagner beaucoup de temps." }),
    ),

    h("div", { class: "fr-row sans-acces__actions" },
      button("Consulter l'espace public", { variant: "primary", icon: "globe", onClick: () => navigate("recueil") }),
      button("Changer de compte", { variant: "secondary", icon: "refresh", onClick: () => logout() }),
    ),

    h("p", { class: "connexion__note", text: "L'espace public — le recueil des actes administratifs — est ouvert à tous, sans compte : ses adresses se partagent et se citent. Si vous pensez qu'il s'agit d'une erreur, signalez-le au service qui gère l'application." }),

    // Un compte reconnu mais sans rôle : c'est un refus d'accès (403). Voir
    // src/ui/chats-erreur.js.
    chatErreurEl(403, { legende: "Accès refusé — aucun rôle n'ouvre l'atelier à ce compte" }),
  );

  root.appendChild(h("div", { class: "connexion sans-acces" },
    demoNotice(),
    h("div", { class: "connexion__theme" }, themeButton()),
    h("div", { class: "connexion__stage" }, card),
  ));
}
