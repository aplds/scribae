// ============================================================================
// La liste des comptes, telle qu'elle se présente à la connexion.
//
// Elle sert deux écrans : « Qui se connecte ? » (les comptes de l'application,
// sans mot de passe) et l'écran de connexion par mot de passe, quand le
// déploiement a laissé les comptes de démonstration ouverts (le raccourci
// « choisir un compte »). Le geste, lui, n'est pas le même : dans le premier cas
// la session s'ouvre localement, dans le second c'est le SERVICE qui l'ouvre —
// d'où le rappel `onPick`, laissé à l'appelant.
//
// Les comptes sont rangés par PROFIL PRINCIPAL : c'est aussi la façon la plus
// rapide de montrer les rôles. Un compte à rôles cumulés — un éditeur chargé de
// la révision, par exemple — figure dans son profil principal, et ses qualités
// cumulées s'affichent sur sa ligne.
// ============================================================================
import { h, icon } from "./dom.js";
import { state } from "./state.js";
import { ROLES, ROLE_ORDER, fullName, initialsOf, sortName, primaryRoleId, badgesOf } from "../lib/users.js";
import { primaryServiceName } from "../lib/scope.js";

// Rend un tableau (au sens de `frag`) de groupes et de lignes, prêt à insérer.
// `onPick(u)` est appelé au clic sur une ligne.
export function comptesGroupes(users, onPick) {
  const out = [];
  for (const roleId of ROLE_ORDER) {
    const role = ROLES[roleId];
    const members = users.filter((u) => primaryRoleId(u) === roleId).sort((a, b) => sortName(a).localeCompare(sortName(b)));
    if (!members.length) continue;
    out.push(h("div", { class: "connexion__group" },
      h("div", { class: "connexion__grouphead" },
        h("span", { class: "fr-badge fr-badge--" + role.badge, text: role.label }),
        h("span", { class: "connexion__groupsum", text: role.summary }),
      ),
      ...members.map((u) => ligneCompte(u, onPick)),
    ));
  }
  return out;
}

function ligneCompte(u, onPick) {
  const entity = (state.config.entities || []).find((e) => e.id === u.entityId);
  const entLogo = u.entityId === state.config.entities?.[0]?.id ? state.config.brand?.logoUrl : "";
  const cumul = badgesOf(u).slice(1);
  return h("button", {
    class: "connexion__user", type: "button",
    title: "Se connecter en tant que " + fullName(u),
    onClick: () => onPick(u),
  },
    entLogo
      ? h("img", { class: "connexion__logo", src: entLogo, alt: "" })
      : h("span", { class: "connexion__initials", text: initialsOf(u) }),
    h("span", { class: "connexion__who" },
      h("span", { class: "connexion__fullname", text: fullName(u) }),
      h("span", { class: "connexion__meta", text: [primaryServiceName(state.config, u), entity?.name].filter(Boolean).join(" · ") || u.email || "" }),
      cumul.length ? h("span", { class: "connexion__qualites" }, ...cumul.map((r) => h("span", { class: "fr-badge fr-badge--" + r.badge, title: r.summary, text: r.label }))) : null,
    ),
    h("span", { class: "connexion__id fr-mono", text: u.login }),
    h("span", { class: "connexion__go", title: "Se connecter" }, icon("check", 16), h("span", { text: "Entrer" })),
  );
}
