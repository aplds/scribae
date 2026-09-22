// ============================================================================
// L'ORGANIGRAMME — entités, services et bureaux.
//
// Trois niveaux, du plus large au plus étroit :
//
//   ENTITÉ    la personne morale, ou la structure qui agit sous son nom — la
//             commune, le CCAS, la caisse des écoles, l'office, une régie…
//     └── SERVICE   « Direction des systèmes d'information », « Action sociale »
//           └── BUREAU   « Applications métier », « Accueil physique »
//
// Une ENTITÉ peut être AUTONOME, ou RATTACHÉE à une autre : la régie du cinéma
// n'a pas de personnalité morale propre, elle est rattachée à la commune — mais
// elle a son directeur, ses services et ses actes. Le drapeau `autonome`
// (défaut : vrai) dit la personnalité morale ; `parentId` dit le rattachement.
// Les deux se combinent : un office public autonome peut être rattaché à la
// commune pour la présentation de l'organigramme, sans cesser d'être une
// personne morale distincte.
//
// Une entité a un SIGNATAIRE PRINCIPAL : la personne qui, en son nom, signe ses
// actes à défaut de signataire désigné dans la trame (son directeur, son maire,
// son président). Il est désigné par une PERSONNE du référentiel et, si on le
// souhaite, par une QUALITÉ (un rôle) sous laquelle elle signe. Voir
// src/lib/compile.js (`buildContext`), qui s'en sert comme signataire par défaut.
//
// Ce module est PUR : il ne connaît ni le DOM ni l'état de l'application. Il
// sert à l'écran « Organigramme » (src/ui/views/organigramme.js), à
// l'Administration › Entités, et à la compilation.
// ============================================================================

export const ENTITY_KINDS = [
  { id: "commune", label: "Commune" },
  { id: "etablissement-public", label: "Établissement public" },
  { id: "etablissement", label: "Établissement" },
  { id: "association", label: "Association" },
  { id: "service", label: "Service" },
];

export const kindLabel = (id) => (ENTITY_KINDS.find((k) => k.id === id) || { label: id || "—" }).label;

// Une entité neuve. `autonome` est vrai par défaut : c'est le cas ordinaire.
// `parentId` (le rattachement) n'a de sens que pour une entité rattachée, mais
// peut aussi être posé sur une entité autonome pour l'ordre de l'organigramme.
export function newEntite(patch = {}) {
  return {
    id: "ent-" + Math.random().toString(36).slice(2, 9),
    code: "XXX",
    kind: "commune",
    name: "Nouvelle entité",
    nameWithArt: "",
    authorityFormula: "",
    legalName: "",
    seatCity: "",
    tribunal: "",
    parentId: "",
    // Personnalité morale propre. Faux : l'entité est rattachée à une autre
    // (une régie, un service doté d'un directeur, une structure sans personnalité
    // juridique propre).
    autonome: true,
    // Le SIGNATAIRE PRINCIPAL : la personne qui signe les actes de cette entité
    // quand la trame n'en désigne aucun, et la qualité sous laquelle elle signe.
    signerPersonId: "",
    signerRoleId: "",
    ...patch,
  };
}

export const entitesOf = (config) => (Array.isArray(config?.entities) ? config.entities : []);
export const entiteById = (config, id) => entitesOf(config).find((e) => e.id === id) || null;

// Une entité est autonome sauf déclaration contraire explicite. Un référentiel
// antérieur au drapeau reste donc tel qu'il était : toutes ses entités sont
// autonomes, et le rattachement (`parentId`) n'est qu'une présentation.
export const estAutonome = (entite) => !entite || entite.autonome !== false;

// L'entité à laquelle celle-ci est rattachée (null si elle est autonome, ou si
// le rattachement désigne une entité inconnue).
export function entiteParente(config, entite) {
  if (!entite || !entite.parentId || entite.parentId === entite.id) return null;
  return entiteById(config, entite.parentId);
}

// Les entités directement rattachées à celle-ci.
export const enfantsDe = (config, id) => entitesOf(config).filter((e) => e.parentId === id && e.id !== id);

// Le SIGNATAIRE PRINCIPAL d'une entité : la personne du référentiel désignée,
// ou null. `roleId` porte la qualité sous laquelle elle signe (facultative).
export function signatairePrincipal(config, entityId) {
  const e = entiteById(config, entityId);
  if (!e || !e.signerPersonId) return null;
  const personne = (config?.people || []).find((p) => p.id === e.signerPersonId) || null;
  return personne ? { personne, roleId: e.signerRoleId || "" } : null;
}

// L'arbre de l'organisation, tel qu'on l'affiche : chaque entité racine (sans
// rattachement, ou rattachée à une entité inconnue ou formant un cycle) porte
// ses services, ses bureaux et ses entités rattachées. La profondeur n'est pas
// limitée, mais un cycle ne boucle jamais : on s'arrête dès qu'une entité se
// rencontre elle-même.
export function organigramme(config) {
  const entites = entitesOf(config);
  const parId = new Map(entites.map((e) => [e.id, e]));
  const services = (config?.services || []);
  const servicesDe = (entityId) =>
    services.filter((s) => (s.entityId || "") === entityId)
      .map((s) => ({ service: s, bureaux: s.bureaux || [] }));

  const racines = entites.filter((e) => {
    if (!e.parentId) return true;
    const p = parId.get(e.parentId);
    return !p || p.id === e.id;
  });

  const brancher = (entite, niveau, vus) => ({
    entite,
    niveau,
    entiteParente: entiteParente(config, entite),
    autonome: estAutonome(entite),
    signataire: signatairePrincipal(config, entite.id),
    services: servicesDe(entite.id),
    enfants: enfantsDe(config, entite.id)
      .filter((e) => !vus.has(e.id))
      .map((e) => brancher(e, niveau + 1, new Set([...vus, e.id]))),
  });

  return racines.map((e) => brancher(e, 0, new Set([e.id])));
}

// Les entités qui n'apparaissent dans AUCUN arbre (rattachement cyclique) :
// l'écran les montre quand même, plutôt que de les laisser disparaître.
export function entitesHorsArbre(config) {
  const vues = new Set();
  const marcher = (noeuds) => {
    for (const n of noeuds) {
      vues.add(n.entite.id);
      marcher(n.enfants || []);
    }
  };
  marcher(organigramme(config));
  return entitesOf(config).filter((e) => !vues.has(e.id));
}

// Ce que l'organigramme contient, en une ligne (compteurs de l'écran).
export function statsOrganigramme(config) {
  const entites = entitesOf(config);
  const services = config?.services || [];
  const bureaux = services.reduce((n, s) => n + (s.bureaux || []).length, 0);
  return {
    entites: entites.length,
    autonomes: entites.filter(estAutonome).length,
    rattachees: entites.filter((e) => !estAutonome(e)).length,
    services: services.length,
    bureaux,
    sansSignataire: entites.filter((e) => !e.signerPersonId).length,
  };
}
