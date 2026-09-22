// ============================================================================
// Amorçage du compte d'administration.
//
// L'administrateur du service est déclaré dans `.env`. Au PREMIER démarrage, il
// est créé au référentiel avec son mot de passe ; ensuite, `.env` ne le touche
// plus (changer le mot de passe se fait dans l'application, ou par la commande
// `--mot-de-passe`).
//
// UNE RÉPARATION, au démarrage : si le compte d'administration a DISPARU du
// référentiel alors que le service garde encore son mot de passe (table
// `sb_motdepasse`, hors référentiel), le compte est rétabli — même identifiant,
// rôle administrateur, mot de passe conservé. Sans cela, une remise à zéro des
// collections enfermait l'installation dehors : plus personne ne pouvait se
// connecter, et `ADMIN_PASSWORD` avait souvent été retiré du `.env` (c'est ce
// que recommande la documentation, une fois le mot de passe changé depuis
// l'application). Voir la note de version 1.3.2p.
//
// Ce module est PUR : il ne connaît ni la base, ni le réseau, ni les journaux.
// On lui passe un « port » `comptes` (celui de comptes.mjs) et les valeurs du
// `.env`, il rend un VERDICT — `{ ok, motif, avertissement, message, panne }`.
// C'est ce verdict qui permet à server.mjs de porter l'état jusqu'à l'écran de
// connexion : un `ADMIN_PASSWORD` refusé ne doit pas se confondre avec un
// mauvais identifiant saisi par l'agent.
// ============================================================================

import { normaliserLogin, motDePasseFaible, estAdmin } from "./comptes.mjs";

// « Jean-Pierre Dubois » → identifiant de compte stable.
export const slug = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");

export function nomDe(complet) {
  const mots = String(complet || "").trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return { firstName: "", lastName: "" };
  if (mots.length === 1) return { firstName: mots[0], lastName: "" };
  return { firstName: mots[0], lastName: mots.slice(1).join(" ") };
}

export async function amorcerAdministrateur({
  adminLogin = "",
  adminPassword = "",
  adminNom = "",
  adminEmail = "",
  adminEntity = "",
  mdpMin = 12,
  comptes,
} = {}) {
  const refus = (motif) => ({ ok: false, compte: null, motif, avertissement: "", message: "", panne: null });
  const succes = (compte, message = "", avertissement = "") => ({ ok: true, compte, motif: "", avertissement, message, panne: null });

  const login = normaliserLogin(adminLogin);
  if (!login) {
    return refus("ADMIN_LOGIN est vide : aucun compte d'administration n'a été installé. Renseignez-le dans .env.");
  }

  // Un référentiel injoignable (base absente) n'est PAS un mot de passe refusé :
  // l'appelant le signale comme panne, pas comme configuration.
  let compte;
  try {
    compte = await comptes.lireCompteParLogin(login);
  } catch (e) {
    return { ok: false, compte: null, motif: "Le référentiel des comptes est injoignable : " + e.message, avertissement: "", message: "", panne: e };
  }

  if (!compte) {
    // Le compte a pu DISPARAÎTRE du référentiel sans que son mot de passe
    // disparaisse : le mot de passe vit chez le service (table `sb_motdepasse`),
    // HORS du référentiel. Une remise à zéro des collections, un import de
    // données sans les comptes, ou le bouton « Repartir d'un référentiel
    // vierge » suffisaient donc à laisser l'installation sans personne pour se
    // connecter — et rien dans `.env` ne pouvait la réparer si `ADMIN_PASSWORD`
    // en avait été retiré, comme la documentation le recommande une fois le mot
    // de passe changé depuis l'application. Le compte est donc RÉTABLI ici :
    // même identifiant, même rôle, et le mot de passe DÉJÀ POSÉ est conservé —
    // cette réparation ne remplace jamais un mot de passe.
    //
    // L'identifiant cherché est celui que ce module attribue lui-même (`u-` +
    // slug du login) : c'est celui du compte d'administration créé depuis `.env`.
    const id = "u-" + (slug(login) || "admin");
    let motDePasseOrphelin = false;
    try {
      const etats = await comptes.etatComptes();
      motDePasseOrphelin = etats.some((c) => c && String(c.userId) === id);
    } catch (e) {
      return { ok: false, compte: null, motif: "Le référentiel des comptes est injoignable : " + e.message, avertissement: "", message: "", panne: e };
    }
    if (motDePasseOrphelin) {
      const nom = nomDe(adminNom);
      compte = {
        id, civility: "", firstName: nom.firstName, lastName: nom.lastName,
        login, email: adminEmail, role: "administrateur", roles: ["administrateur"],
        entityId: adminEntity, service: "", personId: "", memberships: [],
        active: true, source: "local",
        createdAt: new Date().toISOString(), lastLogin: "",
      };
      await comptes.ecrireCompte(compte);
      return succes(compte,
        `Compte d'administration « ${login} » RÉTABLI : il manquait au référentiel, et son mot de passe — gardé par le service, hors du référentiel — reste valable (il n'a pas été remplacé).`,
        "Le compte avait disparu du référentiel (remise à zéro, ou import de données sans les comptes). Vérifiez « Comptes et rôles » : c'est le seul compte rétabli ainsi.");
    }
    if (!adminPassword) {
      return refus(`Aucun compte « ${login} » au référentiel, et ADMIN_PASSWORD n'est pas renseigné : rien n'a été créé. Renseignez ADMIN_PASSWORD dans .env (au moins ${mdpMin} caractères), puis RECRÉEZ le conteneur du service (« docker compose up -d », et non « restart » : un conteneur ne relit pas son .env) — le compte sera créé au démarrage suivant. À défaut, la commande de secours crée le compte : printf '%s' "$MDP" | node server.mjs --mot-de-passe ${login}`);
    }
    const faible = motDePasseFaible(login, adminPassword, mdpMin);
    if (faible) return refus("ADMIN_PASSWORD refusé : " + faible);
    const nom = nomDe(adminNom);
    compte = {
      id: "u-" + (slug(login) || "admin"),
      civility: "", firstName: nom.firstName, lastName: nom.lastName,
      login, email: adminEmail, role: "administrateur", roles: ["administrateur"],
      entityId: adminEntity, service: "", personId: "", memberships: [],
      active: true, source: "local",
      createdAt: new Date().toISOString(), lastLogin: "",
    };
    // Le compte lui-même est écrit au référentiel (collection `users`), comme
    // s'il avait été créé depuis l'écran « Comptes et rôles ».
    await comptes.ecrireCompte(compte);
    const pose = await comptes.definirMotDePasse(compte.id, adminPassword, { mustChange: false });
    if (!pose.ok) return refus("Mot de passe du compte administrateur non posé : " + pose.message);
    return succes(compte, `Compte administrateur « ${login} » créé depuis .env (rôle administrateur, mot de passe d'ADMIN_PASSWORD).\nChangez ce mot de passe depuis l'application (menu du compte → mot de passe), puis retirez ADMIN_PASSWORD de .env.`);
  }

  const etats = await comptes.etatComptes();
  const aMotDePasse = etats.some((c) => c.userId === compte.id);
  let message = "";
  if (!aMotDePasse) {
    if (adminPassword) {
      const pose = await comptes.definirMotDePasse(compte.id, adminPassword, { mustChange: false });
      if (!pose.ok) return refus("Mot de passe non posé pour « " + login + " » : " + pose.message);
      message = `Mot de passe d'ADMIN_PASSWORD posé sur le compte « ${login} ».`;
    } else {
      return refus(`Le compte « ${login} » n'a pas de mot de passe et ADMIN_PASSWORD n'est pas renseigné : il ne peut pas se connecter. Posez-en un avec : printf '%s' "$MDP" | node server.mjs --mot-de-passe ${login}`);
    }
  }
  const avertissement = estAdmin(compte)
    ? ""
    : `Le compte « ${login} » n'a plus le rôle administrateur (modifié depuis l'application) : .env n'y change rien.`;
  return succes(compte, message, avertissement);
}
