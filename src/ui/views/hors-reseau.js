// ============================================================================
// Écran « Atelier hors réseau ».
//
// La collectivité a restreint l'accès à l'atelier à certaines adresses (voir
// `SCRIBA_ATELIER_IPS`, registre des variables, et src/server/mysql/atelier.mjs).
// La personne qui arrive ici n'est pas en panne : elle vient d'un réseau qui
// n'est pas celui de l'atelier. Le recueil public, lui, reste ouvert — c'est ce
// que cet écran dit, et c'est la seule chose utile à dire.
//
// L'écran n'est PAS une erreur : il ne s'affiche que si le service a répondu, et
// il montre ce que le service a répondu (l'adresse vue de lui, et d'où vient la
// règle). Aucune information secrète n'y figure : la liste d'adresses est un
// réglage, pas un secret, et l'agent qui la lit comprend pourquoi il est dehors.
// ============================================================================
import { state, navigate, logout } from "../state.js";
import { h, icon, button } from "../dom.js";
import { APP_NAME, APP_TAGLINE, markEl } from "../brand.js";
import { themeButton } from "../theme.js";
import { demoNotice } from "../notice.js";
import { acces } from "../../lib/atelier-acces.js";

export function renderHorsReseau(root) {
  const brand = state.config?.brand || {};
  const contact = [brand.supportName, brand.supportPhone, brand.supportEmail].filter(Boolean);
  const operateur = acces.source === "deploiement";

  const ligne = (label, valeur) => valeur
    ? h("p", { class: "fr-small", style: { margin: "0" } },
      h("span", { class: "fr-muted", text: label + " : " }),
      h("span", { class: "fr-mono", text: valeur }))
    : null;

  const card = h("div", { class: "connexion__card sans-acces__card" },
    h("div", { class: "connexion__brand" },
      markEl(40),
      h("div", {},
        h("p", { class: "connexion__name", text: APP_NAME }),
        h("p", { class: "connexion__tag", text: APP_TAGLINE }),
      ),
    ),
    h("h1", { class: "connexion__title", text: "L'atelier n'est pas ouvert depuis cette adresse" }),
    h("p", { class: "connexion__sub", text: acces.message }),

    // Ce que le SERVICE a vu : c'est le seul juge de la question, et le montrer
    // évite la conversation la plus coûteuse (« mais je suis bien au bureau ! »)
    // — un VPN, une box en double NAT, un partage de connexion, et l'adresse vue
    // n'est pas celle que l'on croit.
    h("div", { class: "sans-acces__contact" },
      h("h2", { class: "sans-acces__contact-title" }, icon("lock", 16), h("span", { text: "Ce que le service a vu" })),
      ligne("Adresse", acces.appelant || acces.ip),
      acces.interne ? h("p", { class: "fr-small", text: "Cette adresse est un espace réseau réservé : vous passez bien par un réseau interne — mais pas celui qui est autorisé." }) : null,
      h("p", { class: "fr-small", text: operateur
        ? "La liste des adresses autorisées est réglée par le déploiement (variable SCRIBA_ATELIER_IPS) : c'est l'exploitant du service qui la tient."
        : "La liste des adresses autorisées se règle dans Administration › Accès à l'atelier. Depuis un autre réseau, demandez à un administrateur." }),
    ),

    h("div", { class: "sans-acces__contact" },
      h("h2", { class: "sans-acces__contact-title" }, icon("info", 16), h("span", { text: "Que faire ?" })),
      h("p", { text: "Si vous êtes censé travailler depuis ce poste, deux causes possibles : votre accès passe par un réseau différent de celui de la collectivité (télétravail, connexion mobile, VPN éteint) — ou votre adresse manque à la liste." }),
      contact.length
        ? h("p", { text: "Le service qui gère l'application : " + contact.join(" — ") + "." })
        : h("p", { text: "Adressez-vous au service qui gère l'application (Administration → Identité, champs « Contact d'aide »)." }),
    ),

    h("div", { class: "fr-row sans-acces__actions" },
      button("Consulter le recueil public", { variant: "primary", icon: "globe", onClick: () => navigate("recueil") }),
      state.user ? button("Fermer la session", { variant: "secondary", icon: "logout", onClick: () => logout() }) : null,
    ),

    h("p", { class: "connexion__note", text: "Le recueil des actes publiés est public : il se consulte sans compte, et depuis n'importe quel réseau." }),
  );

  root.appendChild(h("div", { class: "connexion sans-acces" },
    demoNotice(),
    h("div", { class: "connexion__theme" }, themeButton()),
    h("div", { class: "connexion__stage" }, card),
  ));
}
