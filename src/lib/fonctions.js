// ============================================================================
// Les FONCTIONS de signature.
//
// On ne choisit pas un signataire par son nom, mais par sa FONCTION — la
// qualité juridique qui donne compétence pour signer l'acte. On choisit
// d'abord la fonction, puis, parmi les personnes QUI ONT QUALITÉ pour cette
// fonction, celle qui signe.
//
// La fonction vient du référentiel, de deux endroits :
//   • un RÔLE (Administration › Rôles) — « Maire », « Adjoint au maire »,
//     « Directeur général des services »… Toutes les personnes qui portent le
//     rôle ont la fonction. C'est la fonction de l'autorité qui signe en son
//     nom.
//   • une DÉLÉGATION (écran Délégations) — « adjoint au maire en
//     charge de l'urbanisme », « chef de bureau Urbanisme »… La fonction est
//     alors celle sous laquelle le délégataire signe, pour les matières de la
//     délégation. Plusieurs personnes peuvent tenir la même qualité (chacune
//     par sa propre délégation) : c'est là que le choix « parmi les personnes
//     ayant qualité » prend tout son sens.
//
// Une fonction n'est proposée que si elle a du sens POUR L'ACTE : une
// délégation donnée dans une autre organisation ne s'affiche jamais, et une
// délégation limitée à une famille ou à un type d'acte ne s'affiche que sur
// ces actes (voir `scoreDelegation`, src/lib/delegations.js). Une fonction que
// personne ne peut tenir est écartée.
//
// Rien n'est bloqué : le rédacteur peut toujours écarter la fonction attendue
// par la trame, et la qualité imprimée reste celle que le référentiel donne au
// signataire (la délégation, quand il y en a une).
// ============================================================================
import {
  qualiteDeRole, qualiteDeDelegation, entiteDeDelegation,
  enVigueur, scoreDelegation,
} from "./delegations.js";
import { todayIso } from "./util.js";

const PREFIXE_ROLE = "role:";
const PREFIXE_DELEGATION = "del:";

export const fonctionRole = (roleId) => (roleId ? PREFIXE_ROLE + roleId : "");
export const fonctionDelegation = (delId) => (delId ? PREFIXE_DELEGATION + delId : "");
export const roleDeFonction = (cle) =>
  (String(cle || "").startsWith(PREFIXE_ROLE) ? String(cle).slice(PREFIXE_ROLE.length) : "");
export const delegationDeFonction = (cle) =>
  (String(cle || "").startsWith(PREFIXE_DELEGATION) ? String(cle).slice(PREFIXE_DELEGATION.length) : "");

// La clé de valeur qui accompagne le champ du signataire : le champ
// « signataire » range sa fonction sous `signataireFonction`. Rangée à part
// (et non dans le champ lui-même) parce que tout le reste de l'application lit
// `values.signataire` comme l'identifiant d'une personne, sans rien changer.
export const champFonction = (champId) => String(champId || "signataire") + "Fonction";

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

// Deux délégations confèrent-elles la même qualité ? C'est ce qui fait qu'une
// fonction est tenue par plusieurs personnes.
const qualiteCle = (d) => norm(d?.qualiteM) + "|" + norm(d?.qualiteF);

const personneParId = (config, id) => (config?.people || []).find((p) => p.id === id) || null;

// Les personnes qui ont qualité pour une fonction, la personne désignée par la
// délégation en tête de liste.
export function personnesAyantQualite(config, fonction, { entityId = "" } = {}) {
  if (!fonction) return [];
  if (fonction.kind === "role") {
    const list = (config?.people || []).filter((p) => (p.roles || []).includes(fonction.roleId));
    // Les personnes de l'organisation de l'acte d'abord : c'est le cas ordinaire
    // — sans en exclure les autres (un élu peut agir pour plusieurs entités).
    return list.sort((a, b) => Number(b.entityId === entityId) - Number(a.entityId === entityId));
  }
  if (fonction.kind === "delegation") {
    const ref = (config?.delegations || []).find((d) => d.id === fonction.delegationId);
    if (!ref) return [];
    const entite = entiteDeDelegation(config, ref);
    const cle = qualiteCle(ref);
    const ids = new Set([ref.toId]);
    for (const d of config?.delegations || []) {
      if (d === ref || !enVigueur(d)) continue;
      if (entiteDeDelegation(config, d) !== entite) continue;   // même organisation
      if (qualiteCle(d) !== cle) continue;                      // même qualité
      ids.add(d.toId);
    }
    return [...ids].map((id) => personneParId(config, id)).filter(Boolean)
      .sort((a, b) => Number(b.id === ref.toId) - Number(a.id === ref.toId));
  }
  return [];
}

// Le libellé d'une fonction tel qu'il se lit dans une liste déroulante.
// `genre` accorde la qualité (« Adjointe au maire » quand la personne qui la
// tient est une femme) — sans quoi la liste afficherait un masculin générique.
export function libelleFonction(config, fonction, { genre = "m" } = {}) {
  if (!fonction) return "";
  const q = qualiteDeFonction(fonction, genre);
  const cap = q.charAt(0).toUpperCase() + q.slice(1);
  if (fonction.kind === "role") return cap;
  const ref = (config?.delegations || []).find((d) => d.id === fonction.delegationId);
  const del = ref ? personneParId(config, ref.fromId) : null;
  const qui = del ? [del.firstName, del.lastName].filter(Boolean).join(" ") : "";
  return cap + " — par délégation" + (qui ? " de " + qui : "");
}

// La qualité (sans article) d'une fonction, accordée en genre.
export function qualiteDeFonction(fonction, genre = "m") {
  if (!fonction) return "";
  if (fonction.kind === "role") return String((genre === "f" ? fonction.qualite.f : fonction.qualite.m) || fonction.qualite.m || "").trim();
  return qualiteDeDelegation({ qualiteM: fonction.qualite.m, qualiteF: fonction.qualite.f }, genre);
}

// Le catalogue des fonctions proposables pour un acte : les rôles, puis les
// délégations qui s'appliquent à cet acte. Chaque entrée porte ses personnes,
// sauf si `vides` est vrai (on veut alors le catalogue complet — c'est le cas
// de l'éditeur de trame, qui choisit une fonction attendue avant que le
// référentiel des personnes ne soit arrêté).
export function fonctionsDeSignature(config, { entityId = "", familyId = "", actTypeId = "", date = "", vides = false } = {}) {
  const scope = { entityId, familyId, actTypeId };
  const jour = date || todayIso();
  const out = [];
  for (const r of config?.roles || []) {
    out.push({
      key: fonctionRole(r.id), kind: "role", roleId: r.id,
      qualite: { m: qualiteDeRole(config, r.id, "m"), f: qualiteDeRole(config, r.id, "f") },
    });
  }
  for (const d of config?.delegations || []) {
    if (!enVigueur(d, jour)) continue;
    if (scoreDelegation(config, d, scope) < 0) continue;
    out.push({
      key: fonctionDelegation(d.id), kind: "delegation", delegationId: d.id,
      qualite: { m: String(d.qualiteM || "").trim(), f: String(d.qualiteF || d.qualiteM || "").trim() },
    });
  }
  return out
    .map((f) => ({ ...f, personnes: personnesAyantQualite(config, f, { entityId }) }))
    .filter((f) => vides || f.personnes.length);
}

// La fonction sous laquelle une personne signe cet acte : sa délégation la plus
// précise, à défaut son premier rôle. Sert à présélectionner la fonction quand
// le rédacteur rouvre un acte dont la fonction n'a pas été rangée.
export function fonctionPourPersonne(config, personId, opts = {}) {
  const p = personneParId(config, personId);
  if (!p) return "";
  const { date = "", ...scope } = opts;
  const cands = (config?.delegations || [])
    .filter((d) => d.toId === personId && enVigueur(d, date || todayIso()))
    .map((d) => ({ d, n: scoreDelegation(config, d, scope) }))
    .filter((x) => x.n >= 0)
    .sort((a, b) => b.n - a.n);
  if (cands.length) return fonctionDelegation(cands[0].d.id);
  const roleId = (p.roles || [])[0];
  return roleId ? fonctionRole(roleId) : "";
}

// Retrouve une fonction du catalogue par sa clé — en la recréant si le
// catalogue ne la contient pas (délégation écartée du périmètre de l'acte, mais
// déjà retenue sur l'acte : mieux vaut l'afficher que la perdre).
export function fonctionParCle(config, cle, opts = {}) {
  const catalogue = fonctionsDeSignature(config, opts);
  const trouvee = catalogue.find((f) => f.key === cle);
  if (trouvee) return trouvee;
  const roleId = roleDeFonction(cle);
  if (roleId) {
    const r = (config?.roles || []).find((x) => x.id === roleId);
    if (!r) return null;
    return {
      key: cle, kind: "role", roleId,
      qualite: { m: qualiteDeRole(config, roleId, "m"), f: qualiteDeRole(config, roleId, "f") },
      personnes: personnesAyantQualite(config, { kind: "role", roleId }, opts),
    };
  }
  const delId = delegationDeFonction(cle);
  if (delId) {
    const d = (config?.delegations || []).find((x) => x.id === delId);
    if (!d) return null;
    const f = {
      key: cle, kind: "delegation", delegationId: d.id,
      qualite: { m: String(d.qualiteM || "").trim(), f: String(d.qualiteF || d.qualiteM || "").trim() },
    };
    return { ...f, personnes: personnesAyantQualite(config, f, opts) };
  }
  return null;
}
