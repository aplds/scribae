// ============================================================================
// Amorçage du compte d'administration.
//
// L'administrateur du service est déclaré dans `.env`. Au PREMIER démarrage, il
// est créé au référentiel avec son mot de passe ; ensuite, `.env` ne le touche
// plus (changer le mot de passe se fait dans l'application, ou par la commande
// `--mot-de-passe`).
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
    if (!adminPassword) {
      return refus(`Aucun compte « ${login} » au référentiel, et ADMIN_PASSWORD n'est pas renseigné : rien n'a été créé. Renseignez ADMIN_PASSWORD dans .env (au moins ${mdpMin} caractères), ou créez le compte depuis l'application.`);
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
