// ============================================================================
// Les écrans du mode « comptes locaux (mot de passe) ».
//
// Trois morceaux, qui ne parlent jamais à la base : le mot de passe part au
// SERVICE (voir src/lib/motdepasse.js), qui le vérifie et ouvre une session
// dans un cookie `HttpOnly`. Ce module ne fait que recueillir la saisie.
//
//   panneauMotDePasse        le formulaire de l'écran de connexion ;
//   ouvrirChangementMotDePasse  la fenêtre « Changer mon mot de passe » ;
//   dialogueMotDePasseCompte l'administration d'un mot de passe (poser,
//                            engendrer un provisoire, retirer).
//
// Il ne faut pas le confondre avec src/lib/motdepasse.js, qui est le CLIENT du
// service (les requêtes). Ici : l'interface.
// ============================================================================
import { h, icon, button, modal, toast, alert, field as frField, clear } from "./dom.js";
import { state, loginWithPassword, loginDemoService, changerMonMotDePasse, chargerModeDeploiement, redrawView } from "./state.js";
import { deploiementAuth } from "../lib/auth.js";
import { copyText } from "../lib/util.js";
import { fullName } from "../lib/users.js";
import * as motdepasse from "../lib/motdepasse.js";
import { comptesGroupes } from "./comptes-liste.js";

// La longueur exigée par le service. Elle est annoncée par `GET /v1/auth/config`
// (le service la calcule depuis son `.env`), et affichée AVANT la saisie : on
// préfère dire la règle que laisser l'agent la découvrir par un refus.
const minimum = () => {
  const d = deploiementAuth();
  return (d && Number(d.motDePasseMin)) || 12;
};

// L'état du DÉPLOIEMENT, dit À L'ÉCRAN plutôt que dans les seuls journaux du
// service (voir `GET /v1/auth/config`). Deux cas empêchent toute connexion, et
// l'agent doit pouvoir les distinguer d'un simple refus d'identifiants :
//   • la base est injoignable — l'écran serait vide sans ce mot ;
//   • aucun compte d'administration n'a pu être installé (ADMIN_PASSWORD refusé
//     par la politique, compte sans mot de passe…), et le motif est donné.
// Rend une liste de nœuds à poser en tête de l'écran de connexion.
export function bandeauEtatService() {
  const d = deploiementAuth();
  if (!d) return [];
  const out = [];
  if (d.baseDisponible === false) {
    out.push(alert("error", "Base de données indisponible",
      `${d.baseMessage || "Le service de la collectivité ne joint pas sa base de données."}${d.baseRemede ? " " + d.baseRemede : ""}`));
  } else if (d.adminPanne) {
    // L'amorçage a échoué parce que le référentiel des comptes était
    // injoignable — et non parce que le `.env` est mal réglé. Annoncer « aucun
    // compte d'administration installé » enverrait l'agent vérifier son
    // ADMIN_PASSWORD, qui n'est pas en cause : c'est la base qu'il faut
    // réparer. On dit donc la même chose que pour une base absente, remède
    // compris.
    out.push(alert("error", "Base de données indisponible",
      `${d.adminMotif || "Le référentiel des comptes est injoignable : aucun compte d'administration n'a pu être installé."}${d.baseRemede ? " " + d.baseRemede : ""}`));
  } else if (d.adminAmorce === false) {
    out.push(alert("warning", "Aucun compte d'administration installé",
      `${d.adminMotif || "L'installation n'a pas encore de compte d'administration."} Sans lui, aucune connexion n'est possible.`));
  }
  if (d.adminAvertissement) {
    out.push(alert("info", "Compte d'administration", d.adminAvertissement));
  }
  return out;
}

// Un champ de mot de passe, avec l'œil qui montre la saisie : une faute de
// frappe invisible est la première cause de « connexion refusée ».
function champMotDePasse(label, { help, autocomplete = "current-password", required = true } = {}) {
  const input = h("input", {
    class: "fr-input", type: "password", autocomplete, spellcheck: "false", required,
  });
  const oeil = h("button", {
    class: "mdp-champ__oeil", type: "button",
    title: "Afficher la saisie", "aria-label": "Afficher la saisie",
    on: {
      click: () => {
        const cache = input.type === "password";
        input.type = cache ? "text" : "password";
        oeil.title = cache ? "Masquer la saisie" : "Afficher la saisie";
        oeil.setAttribute("aria-label", oeil.title);
        oeil.classList.toggle("is-on", cache);
        input.focus();
      },
    },
  }, icon("eye", 16));
  const boite = h("div", { class: "mdp-champ" }, input, oeil);
  return { el: frField(label, boite, { help, required }), input };
}

// Un bouton qui se met en attente : désactivé, et porteur de son mouvement.
// L'appel au service peut prendre un instant (le service calcule le dérivé du
// mot de passe — c'est voulu, et c'est ce qui le rend coûteux à deviner).
function enAttente(btn, actif) {
  if (!btn) return;
  btn.disabled = !!actif;
  if (actif) {
    if (!btn.querySelector(".spinner")) btn.appendChild(h("span", { class: "spinner", "aria-hidden": "true" }));
  } else {
    btn.querySelector(".spinner")?.remove();
  }
}

// --------------------------------------------------------------- connexion
// `demoUsers` : les comptes de démonstration, quand le déploiement les a laissés
// ouverts (`DEMO_ACCOUNTS=true` avec `AUTH_MODE=password`). Le choix d'un compte
// de démonstration ne saute pas le service : c'est lui qui ouvre la session.
export function panneauMotDePasse({ demoUsers = [] } = {}) {
  const box = h("div", { class: "mdp-connexion" });
  const messages = h("div", { class: "mdp-messages" });

  // Le mode mot de passe vient d'un DÉPLOIEMENT : si le service ne répond pas,
  // aucune connexion n'est possible — on le dit, plutôt que de laisser l'agent
  // essayer en vain.
  if (!deploiementAuth()) {
    messages.appendChild(alert("warning", "Le service des comptes n'a pas répondu",
      "Ce déploiement demande une connexion par identifiant et mot de passe, mais le service de la collectivité est injoignable depuis ce poste. Vérifiez qu'il est démarré, puis rechargez la page."));
  }

  const ident = h("input", { class: "fr-input", type: "text", autocomplete: "username", spellcheck: "false" });
  const mdp = champMotDePasse("Mot de passe", { help: null });
  // `type: "submit"` — c'est ce qui fait qu'« Entrée », dans l'identifiant ou le
  // mot de passe, ouvre la session. Sans bouton de soumission, un formulaire qui
  // porte plusieurs champs de saisie n'est PAS soumis implicitement par le
  // navigateur : la touche Entrée n'y faisait rien du tout.
  const valider = button("Se connecter", { variant: "primary", type: "submit" });
  let enCours = false;

  async function soumettre() {
    if (enCours) return;
    const login = ident.value.trim();
    const passe = mdp.input.value;
    clear(messages);
    if (!login || !passe) {
      messages.appendChild(alert("error", "Champs incomplets", "Renseignez votre identifiant et votre mot de passe."));
      (login ? mdp.input : ident).focus();
      return;
    }
    enCours = true;
    enAttente(valider, true);
    const r = await loginWithPassword(login, passe);
    // En cas de succès, l'application s'est déjà redessinée (la session est
    // ouverte) : les nœuds d'ici sont détachés, et il n'y a plus rien à remettre.
    if (r.ok) return;
    // UN REFUS PEUT N'ÊTRE QU'UN ÉTAT DE DÉPLOIEMENT PÉRIMÉ. Le service rééprouve
    // sa base à chaque `GET /v1/auth/config` (voir server.mjs, `reevaluerBase`) :
    // quand l'écran annonçait une base indisponible, on redemande donc l'état avant
    // de laisser l'agent sur un « connexion refusée » — le bandeau se corrige (ou
    // le motif se précise) sans recharger la page.
    const avant = deploiementAuth();
    if (avant && (avant.baseDisponible === false || avant.adminPanne)) {
      const apres = await chargerModeDeploiement();
      if (apres && (apres.baseDisponible !== avant.baseDisponible
        || apres.baseRemede !== avant.baseRemede
        || apres.adminAmorce !== avant.adminAmorce)) {
        redrawView();
        return;
      }
    }
    enCours = false;
    enAttente(valider, false);
    mdp.input.value = "";
    messages.appendChild(alert("error", "Connexion refusée", r.message));
    mdp.input.focus();
  }
  // La soumission passe par le FORMULAIRE (voir son `submit` ci-dessous) : c'est
  // le même chemin pour le bouton et pour la touche Entrée.

  const form = h("form", {
    class: "mdp-form",
    on: { submit: (e) => { e.preventDefault(); soumettre(); } },
  },
    frField("Identifiant", ident, { required: true, help: "Votre identifiant de connexion, remis par l'administrateur." }),
    mdp.el,
    h("div", { class: "mdp-form__actions" }, valider),
    h("p", { class: "fr-small fr-muted", text: `Le mot de passe doit compter au moins ${minimum()} caractères. Après plusieurs échecs, le compte est bloqué quelques minutes.` }),
  );
  box.append(messages, form);

  if (demoUsers.length) {
    box.appendChild(h("details", { class: "mdp-demo" },
      h("summary", { text: "Comptes de démonstration (ce service les laisse ouverts)" }),
      h("p", { class: "fr-small fr-muted", text: "Ce déploiement a gardé les comptes de démonstration : ils entrent sans mot de passe, comme sur un poste d'essai. À refermer (DEMO_ACCOUNTS=false) sur une installation réelle." }),
      h("div", { class: "mdp-demo__liste" }, ...comptesGroupes(demoUsers, (u) => choisirDemo(u, messages))),
    ));
  }
  return box;
}

async function choisirDemo(u, messages) {
  clear(messages);
  const r = await loginDemoService(u.id);
  if (r.ok) return;
  messages.appendChild(alert("error", "Connexion de démonstration refusée", r.message));
}

// --------------------------------------------------- changer SON mot de passe
// `obligatoire` : le mot de passe est provisoire (remis par un administrateur)
// et le service demande qu'il soit changé. La fenêtre reste fermable — un agent
// doit toujours pouvoir renoncer et se déconnecter — mais elle est rouverte au
// prochain rendu tant que le changement n'a pas eu lieu (voir src/ui/app.js).
export function ouvrirChangementMotDePasse({ obligatoire = false, surFait, onFermer } = {}) {
  const messages = h("div", { class: "mdp-messages" });
  const ancien = champMotDePasse("Mot de passe actuel");
  const nouveau = champMotDePasse("Nouveau mot de passe", { autocomplete: "new-password" });
  const confirmation = champMotDePasse("Confirmer le nouveau mot de passe", { autocomplete: "new-password" });
  const valider = button("Changer le mot de passe", { variant: "primary" });
  let enCours = false;
  let change = false;

  const body = h("div", { class: "fr-stack" },
    obligatoire ? alert("info", "Mot de passe à renouveler",
      "Votre mot de passe actuel est provisoire : il vous a été remis pour une seule connexion. Choisissez celui qui vous suivra.") : null,
    messages,
    ancien.el, nouveau.el, confirmation.el,
    h("p", { class: "fr-small fr-muted", text: `Le mot de passe doit compter au moins ${minimum()} caractères et ne pas être un mot de passe courant.` }),
  );

  const modale = modal({
    title: obligatoire ? "Choisir votre mot de passe" : "Changer mon mot de passe",
    body,
    actions: (close) => [
      button(obligatoire ? "Plus tard" : "Annuler", { variant: "secondary", onClick: () => close() }),
      valider,
    ],
    // Refermer sans changer n'est pas un échec : c'est un report, et on le dit —
    // sauf quand c'est le changement lui-même qui a refermé la fenêtre.
    onClose: () => {
      if (obligatoire && !change && state.motDePasseAChanger) {
        toast("Mot de passe provisoire : vous pouvez le changer depuis le menu de votre compte.", "info");
      }
      onFermer?.();
    },
  });

  async function soumettre() {
    if (enCours) return;
    clear(messages);
    const a = ancien.input.value;
    const n = nouveau.input.value;
    if (!a || !n) {
      messages.appendChild(alert("error", "Champs incomplets", "Renseignez votre mot de passe actuel, puis le nouveau deux fois."));
      return;
    }
    if (n !== confirmation.input.value) {
      messages.appendChild(alert("error", "Les deux saisies diffèrent", "Le nouveau mot de passe et sa confirmation doivent être identiques."));
      confirmation.input.value = "";
      confirmation.input.focus();
      return;
    }
    if (n.length < minimum()) {
      messages.appendChild(alert("error", "Mot de passe trop court", `Il faut au moins ${minimum()} caractères.`));
      return;
    }
    enCours = true;
    enAttente(valider, true);
    const r = await changerMonMotDePasse(a, n);
    enCours = false;
    enAttente(valider, false);
    if (!r.ok) {
      messages.appendChild(alert("error", "Changement refusé", r.message));
      ancien.input.value = "";
      ancien.input.focus();
      return;
    }
    change = true;
    modale.close();
    toast("Mot de passe changé", "success");
    surFait?.();
  }
  valider.addEventListener("click", soumettre);
  body.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); soumettre(); } });
  return modale;
}

// ------------------------------------------- administration d'un mot de passe
// Ce que le service sait d'un mot de passe, sans le mot de passe : c'est ce que
// l'écran « Comptes et rôles » affiche. Rend `{ userId: état }`, ou null si le
// service n'a pas répondu (l'écran le dit alors, plutôt que d'inventer un état).
export async function etatsMotDePasse() {
  const r = await motdepasse.etatComptes();
  if (!r.ok || !r.body) return null;
  const map = {};
  for (const e of r.body.comptes || []) map[e.userId] = e;
  return map;
}

export const libelleEtatMotDePasse = (etat) => {
  if (!etat || !etat.defini) return "aucun";
  if (etat.bloque) return "bloqué";
  return etat.mustChange ? "provisoire" : "défini";
};

// La fenêtre d'administration d'un compte : poser un mot de passe choisi,
// en engendrer un provisoire (le service le rend UNE fois), ou le retirer.
// `surFait` est appelé après toute modification, pour redessiner la table.
export async function dialogueMotDePasseCompte(user, { surFait } = {}) {
  const messages = h("div", { class: "mdp-messages" });
  const corps = h("div", { class: "mdp-admin" });
  const choix = champMotDePasse("Mot de passe à définir", {
    autocomplete: "new-password",
    help: `Laisser vide pour que le service en engendre un. Au moins ${minimum()} caractères sinon.`,
  });
  let enCours = false;
  let modale;

  const rafraichir = async () => {
    const etats = await etatsMotDePasse();
    const etat = etats ? etats[user.id] : null;
    const connu = !!etats;
    const ligne = (label, valeur) => h("p", { class: "fr-small" }, h("span", { text: label + " : " }), h("strong", { text: valeur }));
    const boutons = h("div", { class: "fr-row mdp-admin__actions" });

    const poser = async (motDePasse) => {
      if (enCours) return;
      clear(messages);
      enCours = true;
      const r = await motdepasse.definirMotDePasse(user.id, motDePasse, { mustChange: true });
      enCours = false;
      if (!r.ok) { messages.appendChild(alert("error", "Mot de passe refusé", motdepasse.messageErreur(r))); return; }
      if (r.body.motDePasse) afficherProvisoire(r.body.motDePasse);
      else { modale?.close(); toast("Mot de passe défini", "success"); }
      surFait?.();
    };

    const engendrer = async () => {
      if (enCours) return;
      clear(messages);
      enCours = true;
      const r = await motdepasse.definirMotDePasse(user.id, "", { mustChange: true });
      enCours = false;
      if (!r.ok || !r.body.motDePasse) { messages.appendChild(alert("error", "Remise impossible", motdepasse.messageErreur(r))); return; }
      afficherProvisoire(r.body.motDePasse);
      surFait?.();
    };

    const retirer = async () => {
      if (enCours) return;
      clear(messages);
      enCours = true;
      const r = await motdepasse.retirerMotDePasse(user.id);
      enCours = false;
      if (!r.ok) { messages.appendChild(alert("error", "Retrait impossible", motdepasse.messageErreur(r))); return; }
      modale?.close();
      toast("Mot de passe retiré : ce compte ne peut plus se connecter.", "warning");
      surFait?.();
    };

    clear(corps);
    corps.appendChild(h("p", { class: "fr-small fr-muted", text: `Compte : ${fullName(user)} (${user.login}).` }));
    if (!connu) {
      corps.appendChild(alert("warning", "État inconnu", "Le service des comptes n'a pas répondu : l'état du mot de passe est illisible pour le moment."));
      return;
    }
    corps.appendChild(ligne("État du mot de passe", libelleEtatMotDePasse(etat)));
    if (etat && etat.defini) {
      if (etat.updatedAt) corps.appendChild(ligne("Dernière remise", new Date(etat.updatedAt).toLocaleString("fr-FR")));
      if (etat.echecs) corps.appendChild(ligne("Tentatives manquées depuis", String(etat.echecs)));
      if (etat.bloque) corps.appendChild(ligne("Bloqué jusqu'à", new Date(etat.bloqueJusqua).toLocaleString("fr-FR")));
      if (etat.mustChange) corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Le mot de passe est provisoire : il devra être changé à la prochaine connexion." }));
    } else {
      corps.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun mot de passe n'est posé : avec le mode mot de passe, ce compte ne peut pas se connecter tant qu'il n'en a pas un." }));
    }

    corps.append(choix.el, messages, boutons);
    boutons.appendChild(button("Définir ce mot de passe", {
      variant: "secondary", icon: "check",
      onClick: () => {
        const v = choix.input.value;
        if (!v) { clear(messages); messages.appendChild(alert("error", "Aucun mot de passe", "Saisissez un mot de passe, ou laissez le service en engendrer un.")); return; }
        poser(v);
      },
    }));
    boutons.appendChild(button("Engendrer un mot de passe provisoire", {
      variant: "primary", icon: "refresh",
      title: "Le service en tire un au hasard et le montre une seule fois",
      onClick: () => engendrer(),
    }));
    if (etat && etat.defini) {
      boutons.appendChild(button("Retirer le mot de passe", { variant: "tertiary", icon: "x", onClick: () => retirer() }));
    }
  };

  // Le mot de passe provisoire n'est rendu qu'UNE fois par le service : on
  // l'affiche en clair, dans un champ que l'on peut copier, avec le rappel
  // qu'il faudra le transmettre par un canal sûr.
  function afficherProvisoire(valeur) {
    clear(messages);
    clear(corps);
    const champ = h("input", { class: "fr-input fr-mono", readonly: true, value: valeur });
    corps.appendChild(alert("success", "Mot de passe provisoire",
      "Notez-le maintenant : le service ne le montrera plus. Il devra être changé à la première connexion."));
    corps.appendChild(frField("Mot de passe", champ, { help: "Transmettez-le par un canal sûr (de vive voix, ou par un message chiffré)." }));
    corps.appendChild(h("div", { class: "fr-row" },
      button("Copier", {
        variant: "primary", icon: "copy",
        onClick: async () => {
          const ok = await copyText(valeur);
          toast(ok ? "Mot de passe copié" : "La copie est indisponible sur ce poste : notez-le à la main.", ok ? "success" : "warning");
        },
      }),
    ));
    champ.focus();
    champ.select();
  }

  modale = modal({
    title: "Mot de passe — " + fullName(user),
    body: corps,
    actions: (close) => [button("Fermer", { variant: "secondary", onClick: () => close() })],
  });
  await rafraichir();
  return modale;
}
