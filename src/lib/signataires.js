// ============================================================================
// Les SIGNATAIRES.
//
// Un signataire n'est pas un agent comme un autre : c'est l'auteur de l'acte,
// celui dont la qualité engage la collectivité. Trois conséquences, réunies
// ici.
//
// 1. UN COMPTE. Un signataire signe avec SON compte. Ce compte vient de
//    l'annuaire de la collectivité (OIDC) — et l'annuaire provisionne AUSSI le
//    même agent sur l'outil de signature utilisé. Deux rapprochements en
//    découlent : la PERSONNE du référentiel (celle qui porte la qualité) est
//    rattachée à son COMPTE de l'application, et ce compte est rapproché du
//    compte que l'outil de signature lui connaît. Un signataire sans compte,
//    ou dont le compte n'est pas rapproché, ne peut pas signer : la signature
//    serait anonyme, et l'outil refuserait le document.
//
// 2. UNE QUALITÉ : le rôle « Signataire » (src/lib/users.js). Il est CUMULABLE,
//    comme le rôle de réviseur : il ne remplace aucun profil, il ajoute la
//    qualité de signer. Le désigner quelque part — l'écran des délégations le
//    fait — l'attribue automatiquement au compte de la personne, sans qu'il
//    faille être administrateur.
//
// 3. UN CHAMP DE COMPÉTENCE. Un signataire ne voit, dans l'atelier, que les
//    actes dont la signature relève de lui : ceux qu'il signe lui-même, et
//    ceux que signent ses délégataires — car c'est alors SA signature qui est
//    engagée, par délégation puis subdélégation. Le champ se lit dans la CHAÎNE
//    DE SIGNATURE de l'acte (src/lib/delegations.js) : y figurer, à quelque
//    étage, c'est être compétent.
//
// Ce module est PUR : ni DOM, ni état de l'application.
// ============================================================================
import { chaineDeSignature, delegationsVers, enVigueur } from "./delegations.js";
import { hasRole, rolesOf, setRoles } from "./users.js";

export const ROLE_SIGNATAIRE = "signataire";

// --------------------------------------------------------- personne ↔ compte
// La personne du référentiel qui porte la qualité, et le compte qui la tient.
// Le lien est `user.personId` — c'est lui qui fait qu'un signataire signe
// « en son nom » (voir src/lib/users.js, seedUsers).
export const personneDeCompte = (config, user) =>
  (config?.people || []).find((p) => p.id === user?.personId) || null;

export const personnesDuCompte = (config, user, users) => {
  if (user?.personId && personneDeCompte(config, user)) return [personneDeCompte(config, user)];
  const memeNom = [user?.firstName, user?.lastName].filter(Boolean).join(" ").toLowerCase();
  if (!memeNom) return [];
  return (config?.people || []).filter((p) => [p.firstName, p.lastName].filter(Boolean).join(" ").toLowerCase() === memeNom);
};

export const compteDePersonne = (users, personId) =>
  (users || []).find((u) => u?.personId === personId) || null;

// ---------------------------------------------------------- rapprochement
// Le compte que l'OUTIL DE SIGNATURE connaît pour ce signataire. En production
// cet identifiant vient de l'annuaire (qui a créé le compte là-bas) ; ici, il
// est dérivé de façon déterministe pour que le rapprochement ait un objet
// vérifiable — un identifiant, et non une simple case cochée.
export function compteOutilDeSignature(compte) {
  const cle = String(compte?.login || compte?.id || "").trim().toUpperCase();
  return cle ? "SIG-" + cle : "";
}

// L'état du rapprochement d'un signataire : sa personne, son compte, son
// adresse (la clé du rapprochement — c'est par elle que l'annuaire identifie
// l'agent des deux côtés), le compte de l'outil de signature, et le motif quand
// ce n'est pas en ordre.
export function etatRapprochement(config, users, personId) {
  const personne = (config?.people || []).find((p) => p.id === personId) || null;
  if (!personne) return { personne: null, compte: null, ok: false, motif: "Personne inconnue du référentiel." };
  const compte = compteDePersonne(users, personId);
  const declare = personne.signature || null;
  const courriel = String(declare?.courriel || compte?.email || "").trim();
  const base = { personne, compte, declare, courriel, compteOutil: compteOutilDeSignature(compte) };
  if (!compte) return { ...base, ok: false, motif: "Aucun compte rattaché à cette personne : un signataire signe avec son compte (annuaire de la collectivité)." };
  if (compte.active === false) return { ...base, ok: false, motif: "Le compte de ce signataire est désactivé." };
  if (!courriel) return { ...base, ok: false, motif: "Ce compte n'a pas d'adresse : impossible de le rapprocher de l'outil de signature." };
  const ok = !!declare && String(declare.courriel || "").trim().toLowerCase() === courriel.toLowerCase();
  return {
    ...base, ok,
    motif: ok ? "" : "Ce compte n'a pas encore été rapproché de l'outil de signature.",
  };
}

// Rapproche la personne de son compte, et son compte du compte de l'outil de
// signature. Écrit sur la PERSONNE (`personne.signature`) : la qualité de
// signataire est une donnée du référentiel, elle suit l'export.
export function rapprocher(config, users, personId, { par = "", le = "" } = {}) {
  const etat = etatRapprochement(config, users, personId);
  if (!etat.compte) return { ok: false, etat, motif: etat.motif };
  if (!etat.courriel) return { ok: false, etat, motif: etat.motif };
  etat.personne.signature = {
    compteId: etat.compte.id,
    courriel: etat.courriel,
    compteOutil: etat.compteOutil,
    rapprocheLe: le || new Date().toISOString(),
    par,
  };
  return { ok: true, etat: etatRapprochement(config, users, personId), motif: "" };
}

// Retire le rapprochement (le compte de l'outil change, l'adresse change…).
export function deRapprocher(config, personId) {
  const personne = (config?.people || []).find((p) => p.id === personId);
  if (!personne) return false;
  delete personne.signature;
  return true;
}

// ----------------------------------------------------------------- la qualité
// Désigner quelqu'un comme signataire lui attribue la qualité. Idempotent : on
// ne touche pas un compte qui la porte déjà, et un compte sans personne
// rattachée n'est pas concerné (il ne signe rien). `users` est modifié sur
// place, comme partout dans l'application ; la fonction rend de quoi l'annoncer.
export function assurerRoleSignataire(users, personId) {
  const liste = Array.isArray(users) ? users : [];
  const compte = liste.find((u) => u?.personId === personId);
  if (!compte) return { compte: null, ajoute: false };
  if (compte.active === false) return { compte, ajoute: false };
  if (hasRole(compte, ROLE_SIGNATAIRE)) return { compte, ajoute: false };
  setRoles(compte, [...rolesOf(compte), ROLE_SIGNATAIRE]);
  return { compte, ajoute: true };
}

// Les comptes qui portent la qualité de signataire.
export const comptesSignataires = (users) =>
  (users || []).filter((u) => u?.active !== false && hasRole(u, ROLE_SIGNATAIRE));

// ============================================================ la compétence
// La chaîne de signature d'un acte : l'autorité de tête, puis chaque étage,
// jusqu'au signataire. Elle est lue sur le signataire DÉSIGNÉ de l'acte
// (`values.signataire`, posé par la rédaction), dans le périmètre de l'acte
// (organisation, famille de la trame, type d'acte, date de signature) — une
// délégation limitée à un autre service ou à une famille ne s'y invite pas.
export function etapesDeSignature(config, acte, trame) {
  const sigId = acte?.values?.signataire || acte?.signataireId || "";
  if (!sigId) return [];
  return chaineDeSignature(config, sigId, {
    entityId: acte?.entityId || trame?.entityId || "",
    familyId: trame?.familyId || "",
    actTypeId: trame?.actTypeId || "",
    date: acte?.dateSignature || acte?.values?.dateSignature || "",
  });
}

// Où cette personne se situe-t-elle dans la chaîne de l'acte ?
//   effectif  elle est le dernier étage : c'est SA signature que l'acte attend ;
//   rang      sa place depuis la tête (0 = autorité de tête) ;
//   mediateur elle signe « par délégation » (1), « par subdélégation » (2)…
export function competenceDeSignature(config, acte, trame, personId) {
  const etapes = etapesDeSignature(config, acte, trame);
  if (!etapes.length || !personId) return { ok: false, etapes, effectif: false, rang: -1 };
  const i = etapes.findIndex((e) => e.person?.id === personId);
  if (i < 0) return { ok: false, etapes, effectif: false, rang: -1 };
  return { ok: true, etapes, effectif: i === etapes.length - 1, rang: i };
}

// La personne du compte est-elle un maillon de la chaîne ? C'est la question
// que pose la visibilité : un signataire voit les actes où sa signature est
// engagée, la sienne ou celle qu'il a déléguée.
export function competenceDuCompte(config, user, acte, trame) {
  const p = personneDeCompte(config, user);
  if (!p) return { ok: false, effectif: false, rang: -1, etapes: [] };
  return competenceDeSignature(config, acte, trame, p.id);
}

export const peutSignerActe = (config, user, acte, trame) =>
  competenceDuCompte(config, user, acte, trame).ok;

// Les comptes dont la signature est engagée sur cet acte — ceux à qui le fait
// est annoncé. C'est l'homologue de `reviseursPour` (src/lib/revision.js).
export const signatairesPourActe = (config, users, acte, trame) =>
  (users || []).filter((u) => u?.active !== false && competenceDuCompte(config, u, acte, trame).ok);

// ------------------------------------------------------------- les files
// Ce que l'écran de signature met sous les yeux du signataire, en deux temps :
//   aSigner  les actes qui attendent SA signature (il est le dernier étage) ;
//   engagee  les actes signés au titre de sa délégation, qu'il n'a pas à
//            signer lui-même mais qu'il doit pouvoir suivre.
export function fileSignature(config, user, actes, trameDe) {
  const aSigner = [];
  const engagee = [];
  const signe = (a) => !!(a.original || a.statut === "signee" || a.statut === "publie" || a.kind === "consolide");
  for (const a of actes || []) {
    const c = competenceDuCompte(config, user, a, trameDe ? trameDe(a) : null);
    if (!c.ok) continue;
    if (c.effectif && !signe(a)) aSigner.push(a);
    else engagee.push(a);
  }
  const tri = (l) => l.sort((x, y) => String(y.updatedAt || "").localeCompare(String(x.updatedAt || "")));
  return { aSigner: tri(aSigner), engagee: tri(engagee) };
}

// Comment dire la place d'un signataire dans la chaîne (« signature directe »,
// « par délégation de … », « par subdélégation de … »).
export function placeDansChaine(config, acte, trame, personId) {
  const c = competenceDeSignature(config, acte, trame, personId);
  if (!c.ok) return "";
  if (c.rang === 0) return "autorité de tête";
  return c.rang === 1 ? "par délégation" : "par subdélégation";
}

// Ce que cette personne signe, en général (et non pour un acte donné) : en son
// nom propre — c'est le cas quand son rôle la qualifie —, et/ou au titre des
// délégations qu'elle a reçues. Une personne qui DÉLÈGUE engage sa signature
// par ses délégataires : le fait est dit aussi.
export function situationDeSignature(config, personId) {
  const personne = (config?.people || []).find((p) => p.id === personId) || null;
  if (!personne) return { personne: null, recues: [], donnees: [], texte: "", enSonNom: false };
  const nomDe = (id) => {
    const p = (config?.people || []).find((x) => x.id === id);
    return p ? [p.civility, p.firstName, p.lastName].filter(Boolean).join(" ") : "";
  };
  const recues = delegationsVers(config, personId);
  const donnees = (config?.delegations || []).filter((d) => d.fromId === personId && enVigueur(d));
  const roles = (personne.roles || []).map((r) => (config?.roles || []).find((x) => x.id === r)?.label || r);
  const parts = [];
  if (roles.length) parts.push("en son nom (" + roles.join(", ") + ")");
  for (const d of recues) parts.push("au titre de la délégation de " + (nomDe(d.fromId) || "—") + (d.qualiteM ? " — « " + d.qualiteM + " »" : ""));
  if (donnees.length) parts.push("signature engagée par " + donnees.length + " délégation" + (donnees.length > 1 ? "s" : "") + " donnée" + (donnees.length > 1 ? "s" : ""));
  return { personne, recues, donnees, enSonNom: roles.length > 0, texte: parts.length ? parts.join(" · ") : "aucune signature : ni rôle, ni délégation" };
}
