// ============================================================================
// Écran de connexion (« Qui se connecte ? »).
//
// Trois cas, selon le mode d'authentification (src/lib/auth.js) :
//   - comptes de l'application : on choisit un compte dans la liste, sans mot
//     de passe (démonstration) ;
//   - comptes locaux (mot de passe) : un identifiant et un mot de passe, que le
//     SERVICE de la collectivité vérifie (src/ui/mot-de-passe.js). C'est le mode
//     d'une installation auto-hébergée sans annuaire ; le référentiel n'est pas
//     lisible avant la session, donc la liste des comptes vient du service.
//   - annuaire de la collectivité (OIDC) : les comptes de démonstration sont
//     automatiquement désactivés, et l'écran ne propose plus que l'annuaire —
//     le bouton ouvre le fournisseur d'identité, et l'application attribue le
//     rôle d'après ses groupes (voir src/ui/oidc.js).
//
// À quoi s'ajoute LA SECONDE PORTE : l'annuaire peut être branché À CÔTÉ de la
// porte ordinaire (`auth.annuaire`, quel que soit le mode — y compris « comptes
// locaux », le cas d'une installation sans annuaire qui veut l'ouvrir). L'écran
// propose alors les deux, la porte ordinaire d'abord. C'est `annuairePropose`
// qui commande l'affichage — jamais `isOidc` seul.
//
// Les comptes sont présentés par profil, avec ce que le profil permet de faire :
// c'est aussi la façon la plus rapide de montrer les rôles en démonstration.
// ============================================================================
import { state, login, navigate } from "../state.js";
import { h, icon } from "../dom.js";
import { APP_NAME, APP_TAGLINE, markEl } from "../brand.js";
import { mentionAffichee, contenuMention } from "../mention.js";
import { themeButton } from "../theme.js";
import { demoNotice } from "../notice.js";
import { isOidc, isPassword, demoAccountsDisabled, accesLocal, annuairePropose, annuaireSecondePorte } from "../../lib/auth.js";
import { loginPanel } from "../oidc.js";
import { comptesGroupes } from "../comptes-liste.js";
import { panneauMotDePasse, bandeauEtatService } from "../mot-de-passe.js";

export function renderConnexion(root) {
  // `oidc` : l'annuaire est la porte ORDINAIRE. `annuaire` : il est proposé —
  // porte ordinaire, ou seconde porte. Les deux questions sont distinctes.
  const oidc = isOidc(state.config);
  const mdp = isPassword(state.config);
  const annuaire = annuairePropose(state.config);
  const secondePorte = annuaireSecondePorte(state.config) && annuaire;
  // LA PORTE LOCALE. En mode « mot de passe », c'est la porte unique. En mode
  // « oidc », l'annuaire est la porte ordinaire, MAIS le service garde la
  // connexion par identifiant et mot de passe ouverte : c'est par elle qu'on
  // entre avec le compte d'administration du `.env` le jour où l'annuaire est
  // en panne, ou depuis un poste qui ne le joint pas. Les deux portes sont donc
  // proposées ensemble (voir src/lib/auth.js, `accesLocal`).
  const local = accesLocal(state.config);
  const users = state.users.filter((u) => u.active !== false);
  // En mode mot de passe, le référentiel est protégé : les comptes de
  // démonstration — quand le déploiement les laisse ouverts — sont ceux que le
  // SERVICE annonce dans `GET /v1/auth/config` (voir src/lib/motdepasse.js).
  const demoUsers = (mdp || oidc) ? (state.deploiement?.comptes || []) : [];
  const demoOuverts = !demoAccountsDisabled(state.config);

  // Le formulaire « identifiant / mot de passe », quand la porte locale est
  // ouverte — seul (mode mot de passe) ou derrière l'annuaire (mode OIDC).
  const blocLocal = () => (mdp
    ? panneauMotDePasse({ demoUsers: demoOuverts ? demoUsers : [] })
    : h("div", { class: "connexion__local" },
      h("p", { class: "connexion__local-titre", text: "Ou par un compte local" }),
      h("p", { class: "fr-small fr-muted", text: "Le compte d'administration du déploiement, ou un compte remis par l'administrateur, entre par ici — même quand l'annuaire est injoignable." }),
      panneauMotDePasse({ demoUsers: demoOuverts ? demoUsers : [] })));

  // La porte ordinaire, hors annuaire : la liste des comptes de l'application,
  // ou le formulaire de mot de passe quand c'est elle que le service tient.
  const blocOrdinaire = () => (mdp
    ? panneauMotDePasse({ demoUsers: demoOuverts ? demoUsers : [] })
    : comptesGroupes(users, (u) => login(u.id)));

  // L'ANNUAIRE EN SECONDE PORTE : la porte ordinaire reste en tête, l'annuaire
  // vient dessous, présenté comme tel. C'est la même mécanique de connexion
  // (`loginPanel`), donc les mêmes contrôles de jeton et la même attribution de
  // rôle (voir src/ui/oidc.js).
  const blocAnnuaire = () => h("div", { class: "connexion__local connexion__annuaire" },
    h("p", { class: "connexion__local-titre", text: "Ou par l'annuaire de la collectivité" }),
    h("p", { class: "fr-small fr-muted", text: "L'annuaire vérifie votre identité ; votre rôle et votre périmètre (services et bureaux) viennent de vos groupes. Il est branché en seconde porte : la porte ordinaire ci-dessus reste ouverte." }),
    loginPanel());

  const box = h("div", { class: "connexion" },
    demoNotice(),
    // L'état du déploiement (base joignable ? compte d'administration amorcé ?)
    // est dit ICI, avant le formulaire : « Identifiant ou mot de passe
    // incorrect » ne doit pas être la seule explication d'un service qui n'a
    // jamais pu installer son administrateur.
    ...bandeauEtatService(),
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
        h("h1", { class: "connexion__title", text: (oidc || mdp) ? "Connexion" : "Qui se connecte ?" }),
        h("p", { class: "connexion__sub", text: oidc
          ? "L'application ouvre la session par l'annuaire de la collectivité. Votre rôle et votre périmètre (services et bureaux) sont ceux de vos groupes. Un compte local reste possible ci-dessous : c'est la porte de service, celle du compte d'administration du déploiement."
          : mdp
            ? "Identifiez-vous avec le compte que l'administrateur vous a remis. Votre rôle et votre périmètre (services et bureaux) décident de ce que vous verrez."
            : secondePorte
              ? "Choisissez un compte pour entrer, ou passez par l'annuaire de la collectivité, proposé plus bas. Les écrans, les actions et les trames accessibles dépendent du rôle et du périmètre du compte."
              : "Choisissez un compte pour entrer. Les écrans, les actions et les trames accessibles dépendent du rôle et du périmètre (services et bureaux) du compte." }),
        // La page d'accueil du site est le recueil public (voir src/ui/app.js) :
        // l'écran de connexion ne doit donc pas être un cul-de-sac. La porte est
        // ici, sous le sous-titre — visible sans faire défiler la liste des
        // comptes, et dans les trois modes d'authentification.
        h("p", { class: "connexion__retour" },
          h("a", {
            class: "connexion__retour-lien", href: "#/recueil",
            on: { click: (e) => { e.preventDefault(); navigate("recueil"); } },
          }, icon("globe", 15), h("span", { text: "Consulter le recueil public" }))),
        oidc
          ? h("div", { class: "fr-stack" }, loginPanel(), local ? blocLocal() : null)
          : secondePorte
            ? h("div", { class: "fr-stack" }, blocOrdinaire(), blocAnnuaire())
            : blocOrdinaire(),
        h("p", { class: "connexion__note", text: oidc
          ? "Les comptes de démonstration sont désactivés tant que l'annuaire est branché : on entre par l'annuaire, ou par un compte local. Le mode et le compte d'administration se règlent dans le fichier .env du déploiement (AUTH_MODE=oidc)."
          : mdp
            ? "Le mot de passe est vérifié par le service de la collectivité, qui garde la session dans un cookie — l'application ne conserve aucun mot de passe. Le mode et le compte d'administration se règlent dans le fichier .env du déploiement (AUTH_MODE=password)."
            : secondePorte
              ? "L'annuaire de la collectivité est branché en seconde porte : les deux façons d'entrer sont acceptées, et le compte créé ou repris par l'annuaire est un compte de l'application comme un autre (il conserve son historique). Le branchement se règle dans Administration › Annuaire, ou dans le fichier .env du déploiement (variables SCRIBA_ANNUAIRE_*)."
              : "Démonstration : les comptes sont fictifs et l'authentification est simulée (aucun mot de passe n'est demandé). Pour brancher l'annuaire de la collectivité, voir Administration › Annuaire : les comptes de démonstration sont alors désactivés automatiquement." }),
      ),
    ),
    // Le pied de l'écran de connexion — la mention de l'éditeur du logiciel,
    // comme dans l'atelier et sur le recueil public (voir src/ui/mention.js).
    mentionAffichee()
      ? h("footer", { class: "app-pied app-pied--connexion" }, h("p", { class: "app-pied__mention" }, ...contenuMention()))
      : null,
  );
  root.appendChild(box);
}
