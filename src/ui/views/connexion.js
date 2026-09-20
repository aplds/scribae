// ============================================================================
// Écran de connexion (« Qui se connecte ? »).
//
// Deux cas, selon le mode d'authentification du référentiel (src/lib/auth.js) :
//   - comptes de l'application : on choisit un compte dans la liste, sans mot
//     de passe (démonstration) ;
//   - annuaire de la collectivité (OIDC) : les comptes de démonstration sont
//     automatiquement désactivés, et l'écran ne propose plus que l'annuaire —
//     le bouton ouvre le fournisseur d'identité, et l'application attribue le
//     rôle d'après ses groupes (voir src/ui/oidc.js).
//
// Les comptes sont présentés par profil, avec ce que le profil permet de faire :
// c'est aussi la façon la plus rapide de montrer les rôles en démonstration.
// ============================================================================
import { state, login } from "../state.js";
import { h, icon } from "../dom.js";
import { APP_NAME, APP_TAGLINE, markEl } from "../brand.js";
import { themeButton } from "../theme.js";
import { demoNotice } from "../notice.js";
import { ROLES, ROLE_ORDER, fullName, initialsOf, sortName } from "../../lib/users.js";
import { primaryServiceName } from "../../lib/scope.js";
import { isOidc } from "../../lib/auth.js";
import { loginPanel } from "../oidc.js";

export function renderConnexion(root) {
  const oidc = isOidc(state.config);
  const users = state.users.filter((u) => u.active !== false);
  const box = h("div", { class: "connexion" },
    demoNotice(),
    // L'apparence (clair / sombre) se règle aussi avant de se connecter : c'est
    // un réglage du poste de travail, indépendant du compte.
    h("div", { class: "connexion__theme" }, themeButton()),
    h("div", { class: "connexion__stage" },
      h("div", { class: "connexion__card" },
        h("div", { class: "connexion__brand" },
          markEl(40),
          h("div", {},
            h("p", { class: "connexion__name", text: APP_NAME }),
            h("p", { class: "connexion__tag", text: APP_TAGLINE }),
          ),
        ),
        h("h1", { class: "connexion__title", text: oidc ? "Connexion à l'annuaire" : "Qui se connecte ?" }),
        h("p", { class: "connexion__sub", text: oidc
          ? "L'application ouvre la session par l'annuaire de la collectivité. Votre rôle et votre périmètre (services et bureaux) sont ceux de vos groupes."
          : "Choisissez un compte pour entrer. Les écrans, les actions et les trames accessibles dépendent du rôle et du périmètre (services et bureaux) du compte." }),
        oidc ? loginPanel() : groups(users, root),
        h("p", { class: "connexion__note", text: oidc
          ? "Les comptes de démonstration sont désactivés tant que l'annuaire est branché : aucune session ne peut être ouverte sans passer par lui. C'est un réglage du référentiel (Référentiel › Annuaire)."
          : "Démonstration : les comptes sont fictifs et l'authentification est simulée (aucun mot de passe n'est demandé). Pour brancher l'annuaire de la collectivité, voir Référentiel › Annuaire : les comptes de démonstration sont alors désactivés automatiquement." }),
      ),
    ),
  );
  root.appendChild(box);
}

function groups(users, root) {
  const out = [];
  for (const roleId of ROLE_ORDER) {
    const role = ROLES[roleId];
    const members = users.filter((u) => u.role === roleId).sort((a, b) => sortName(a).localeCompare(sortName(b)));
    if (!members.length) continue;
    out.push(h("div", { class: "connexion__group" },
      h("div", { class: "connexion__grouphead" },
        h("span", { class: "fr-badge fr-badge--" + role.badge, text: role.label }),
        h("span", { class: "connexion__groupsum", text: role.summary }),
      ),
      ...members.map((u) => accountRow(u, root)),
    ));
  }
  return out;
}

function accountRow(u, root) {
  const entity = (state.config.entities || []).find((e) => e.id === u.entityId);
  const entLogo = u.entityId === state.config.entities?.[0]?.id ? state.config.brand?.logoUrl : "";
  return h("button", {
    class: "connexion__user", type: "button",
    title: "Se connecter en tant que " + fullName(u),
    onClick: async () => { if (!(await login(u.id))) return; },
  },
    entLogo
      ? h("img", { class: "connexion__logo", src: entLogo, alt: "" })
      : h("span", { class: "connexion__initials", text: initialsOf(u) }),
    h("span", { class: "connexion__who" },
      h("span", { class: "connexion__fullname", text: fullName(u) }),
      h("span", { class: "connexion__meta", text: [primaryServiceName(state.config, u), entity?.name].filter(Boolean).join(" · ") || u.email || "" }),
    ),
    h("span", { class: "connexion__id fr-mono", text: u.login }),
    h("span", { class: "connexion__go", title: "Se connecter" }, icon("check", 16), h("span", { text: "Entrer" })),
  );
}
