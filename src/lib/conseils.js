// ============================================================================
// LES ASSEMBLÉES DÉLIBÉRANTES (conseils).
//
// Beaucoup d'actes n'émanent pas d'une personne, mais d'une ASSEMBLÉE : le
// conseil municipal, le conseil d'administration d'un établissement. C'est
// notamment le cas des DÉLIBÉRATIONS, dont la ligne d'autorité se lit « Le
// conseil municipal de … » — alors que l'acte est signé, lui, par le président
// de l'assemblée : le maire pour un conseil municipal, le président du conseil
// d'administration pour un établissement public.
//
// Une assemblée se décrit donc, dans le référentiel, par :
//   • son ENTITÉ de rattachement (le conseil municipal est celui de la commune) ;
//   • sa FORMULE D'AUTORITÉ — la ligne d'en-tête de l'acte (« Le conseil
//     municipal de Valmont-sur-Loire ») ;
//   • la QUALITÉ QUI SIGNE — la fonction du signataire appelée par l'assemblée
//     (« maire », « président du conseil d'administration »…) : c'est un rôle du
//     référentiel, donc configurable par conseil, sans toucher au code.
//
// Une trame déclare qu'elle produit un ACTE D'ASSEMBLÉE (`trame.assemblee`) ;
// l'acte prend alors l'assemblée de son entité, et le jeton `{{autorite}}` rend
// la formule de l'assemblée (au lieu de celle de l'entité). Voir src/lib/compile.js.
// ============================================================================
import { uid } from "./util.js";
import { qualiteDeRole, avecArticle, genreDe } from "./delegations.js";

export function newConseil(patch = {}) {
  return {
    id: uid("csl"),
    code: "CM",
    entityId: "",
    name: "Conseil municipal",
    authorityFormula: "Le conseil municipal",
    // Le rôle (du référentiel) sous lequel l'acte est signé : le maire pour un
    // conseil municipal, le président du conseil d'administration pour un
    // établissement public. Voir Administration › Assemblées.
    signerRoleId: "maire",
    actif: true,
    ...patch,
  };
}

export const conseilsActifs = (config) => (config?.councils || []).filter((c) => c && c.actif !== false);

// Les assemblées d'une entité — par défaut, la première déclarée.
export function conseilsDe(config, entityId) {
  const tous = conseilsActifs(config);
  return entityId ? tous.filter((c) => c.entityId === entityId) : tous;
}

// L'assemblée retenue pour un acte : celle qu'on désigne explicitement
// (`__conseilId`), sinon la première assemblée active de l'entité de l'acte.
export function conseilPourActe(config, { entityId = "", conseilId = "" } = {}) {
  const tous = config?.councils || [];
  if (conseilId) {
    const c = tous.find((x) => x && x.id === conseilId);
    if (c) return c;
  }
  return conseilsDe(config, entityId)[0] || null;
}

// La qualité sous laquelle l'assemblée fait signer. Le genre suit la personne
// qui signe (« Le président » / « La présidente »).
export function qualiteSignataireConseil(config, conseil, personne) {
  if (!conseil) return "";
  return qualiteDeRole(config, conseil.signerRoleId, genreDe(personne));
}

// L'assemblée, enrichie pour la compilation : sa formule d'autorité et la
// qualité du signataire qu'elle appelle, avec article et accord en genre.
export function enrichirConseil(config, conseil, { signataire = null } = {}) {
  if (!conseil) return null;
  const q = qualiteSignataireConseil(config, conseil, signataire);
  return {
    ...conseil,
    authorityFormula: String(conseil.authorityFormula || conseil.name || "").trim(),
    signerQualite: q,
    signerQualiteArticleMaj: q ? avecArticle(q, genreDe(signataire), { majuscule: true }) : "",
  };
}
