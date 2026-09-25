// ============================================================================
// Comptes et profils d'accès.
//
// Quatre profils, du plus large au plus étroit :
//   administrateur  administre l'application (référentiel, comptes, API, données)
//   editeur         rédige, modifie et commente les trames ; règle les feuilles
//                   de style des actes ; rédige des actes
//   reviseur        contrôle un acte avant sa signature, le corrige, le valide
//                   ou le rejette (voir src/lib/revision.js)
//   signataire      signe les actes dont la signature relève de lui — les siens,
//                   et ceux de ses délégataires ; ne voit que ceux-là dans
//                   l'atelier (voir src/lib/signataires.js)
//   redacteur       rédige un acte et les actions associées (exporter, envoyer
//                   en signature, publier) ; ne voit que ses propres actes
//
// Un compte AUTHENTIFIÉ mais sans rôle d'application est un **visiteur** : il a
// une identité vérifiée (l'annuaire l'a reconnu) mais aucun accès à l'atelier —
// il ne lui reste que l'espace public. C'est le cas d'un agent de l'annuaire
// dont aucun groupe ne correspond à un rôle, ou d'un compte dont les rôles ont
// été retirés. Le rôle `visiteur` matérialise cet état (aucune permission) :
// l'application peut alors l'expliquer au lieu de refuser la connexion.
//
// Le rôle RÉVISEUR se CUMULE (`user.roles`), et le rôle SIGNATAIRE aussi : un
// éditeur des affaires juridiques est éditeur *et* réviseur ; un adjoint au
// maire est signataire (et souvent rédacteur par ailleurs). Le premier rôle de
// la liste est le rôle principal — celui qui s'affiche, qui classe et qui est
// lu par ce qui ne connaît qu'un rôle (annuaire, collaboration). `user.role`
// reste donc écrit, en miroir du rôle principal, et `rolesOf` est la seule
// porte d'entrée : un compte enregistré avant le cumul (rôle unique) est lu
// sans migration.
//
// Les permissions sont déclarées une seule fois (PERMS) : c'est cette table qui
// sert à la fois au contrôle d'accès (`can`, qui interroge TOUS les rôles du
// compte) et à la documentation affichée dans l'écran « Comptes et rôles » et
// dans le guide.
//
// Deux provenances de comptes (`source`) :
//   demo   compte du jeu de démonstration — l'authentification est simulée (on
//          choisit un compte, sans mot de passe) ;
//   oidc   compte rattaché à l'annuaire de la collectivité (OpenID Connect) :
//          l'agent ne peut ouvrir de session qu'authentifié par son annuaire,
//          et son rôle vient de ses groupes (voir src/lib/oidc.js) ;
//   local  compte créé à la main dans l'application (pré-enregistrement, ou
//          installation sans annuaire).
//
// Brancher l'annuaire désactive automatiquement les comptes de démonstration
// (`syncDemoAccounts`) : voir src/lib/auth.js.
// ============================================================================
import { demoAccountsDisabled } from "./auth.js";

export const ROLES = {
  administrateur: {
    id: "administrateur", label: "Administrateur", rank: 3, badge: "error",
    summary: "Administre l'application : référentiel, comptes et rôles, connexions aux API, données. Voit toutes les trames et tous les actes, quel que soit le service.",
  },
  editeur: {
    id: "editeur", label: "Éditeur", rank: 2, badge: "info",
    summary: "Rédige, modifie et commente les trames de son service (et règle les feuilles de style des actes). Rédige des actes et voit ceux de son service ou de son bureau. Tient l'organigramme des délégations de signature. Porte les étapes du parapheur confiées à son rôle : bon pour accord, avis, renvoi, refus.",
  },
  reviseur: {
    id: "reviseur", label: "Réviseur", rank: 2, badge: "warning", cumulable: true,
    summary: "Contrôle l'acte entre l'envoi à signature décidé par le rédacteur et l'envoi effectif. Il en reçoit le rapport de conformité, peut corriger l'acte, le valider — il part alors en signature — ou le rejeter, l'acte revenant en brouillon chez son rédacteur avec le motif du rejet. Sa compétence est limitée aux services, trames, familles ou types d'actes que le référentiel lui confie ; le rôle se cumule avec celui d'éditeur.",
  },
  signataire: {
    id: "signataire", label: "Signataire", rank: 2, badge: "brand", cumulable: true,
    summary: "Signe les actes dont la signature relève de lui : ceux qu'il signe en son nom, et ceux que signent ses délégataires, par délégation puis subdélégation. Dans l'atelier, il ne voit que les actes de son champ de compétence. Il signe avec son compte, rapproché de celui que l'outil de signature lui connaît. Le rôle se cumule avec les autres, et se donne en désignant quelqu'un comme signataire (écran Délégations) ou depuis les comptes.",
  },
  redacteur: {
    id: "redacteur", label: "Rédacteur", rank: 1, badge: "success",
    summary: "Rédige un acte à partir d'une trame de son service et procède aux actions associées (enregistrer, exporter, envoyer en signature, publier). Ne voit que ses propres actes, dans son périmètre. Le registre des trames ne lui est pas ouvert : il choisit son modèle dans l'écran « Rédiger un acte ».",
  },
  // Aucune permission : le visiteur est authentifié (son identité est vérifiée),
  // mais l'application ne lui ouvre rien. Il est accueilli par un écran qui le
  // lui explique et le renvoie vers l'espace public, qu'il consulte sans compte.
  // Une réserve : les QUALITÉS cumulées qu'il porterait restent (voir `can`) —
  // le cas du signataire extérieur, dont la signature engage un acte sans qu'il
  // ait rien à faire dans l'atelier.
  visiteur: {
    id: "visiteur", label: "Visiteur", rank: 0, badge: "warning",
    summary: "Compte authentifié sans accès à l'application : aucun écran de l'atelier ne lui est ouvert. Il ne lui reste que le recueil public, qu'il consulte sans compte. C'est l'état d'un agent de l'annuaire dont aucun groupe ne correspond à un rôle. Une qualité cumulée (signataire) lui rouvre le seul écran qu'elle commande.",
  },
};

export const ROLE_ORDER = ["administrateur", "editeur", "reviseur", "signataire", "redacteur", "visiteur"];

// Le rôle du compte authentifié mais sans accès.
export const VISITEUR = "visiteur";

// Rôles faits pour se CUMULER avec un autre (le rôle principal reste alors
// celui de la liste qui a le rang le plus élevé). Un réviseur est presque
// toujours un éditeur : la qualité de réviseur dit ce qu'il contrôle, pas ce
// qu'il rédige. Un signataire, de même : la qualité dit ce qu'il signe, pas ce
// qu'il fait du reste de sa journée.
export const ROLES_CUMULABLES = ["reviseur", "signataire"];
export const estCumulable = (role) => ROLES_CUMULABLES.includes(role);

// ------------------------------------------------------------------ les rôles
// `rolesOf` est la SEULE lecture des rôles d'un compte : elle accepte aussi
// bien `roles` (cumul) que `role` seul (compte enregistré avant le cumul).
export function rolesOf(user) {
  const list = Array.isArray(user?.roles) ? user.roles.filter((r) => ROLES[r]) : [];
  if (list.length) return [...new Set(list)];
  return user?.role && ROLES[user.role] ? [user.role] : [];
}

export const hasRole = (user, role) => rolesOf(user).includes(role);

// Un compte sans rôle d'application — ou dont le rôle est « Visiteur » — est un
// visiteur : authentifié, mais sans accès. C'est la question que pose
// l'application AVANT d'ouvrir l'atelier (voir src/ui/app.js).
//
// UNE EXCEPTION, et une seule : les QUALITÉS cumulées (voir
// `permissionsDeQualites`). Le profil « Visiteur » décrit un compte qui n'est
// pas un agent de l'atelier ; or une qualité peut précisément être ce qu'on
// attend d'un compte extérieur. Le cas qui l'impose est celui du SIGNATAIRE :
// une personne qui n'a aucune raison d'entrer dans l'atelier — un élu, le
// président d'une association partenaire, un agent d'une autre collectivité —
// mais dont la signature engage l'acte. Lui refuser l'atelier entier, c'est lui
// refuser les onglets de signature, c'est-à-dire la seule chose qu'on lui
// demande. Un visiteur qui porte une qualité qui ouvre quelque chose n'est donc
// pas renvoyé à l'écran « pas d'accès ».
export function estVisiteur(user) {
  if (!user) return false;
  if (!rolesOf(user).length) return true;
  if (!hasRole(user, VISITEUR)) return false;
  return !permissionsDeQualites(user).length;
}

// Rôle principal : le rang le plus élevé, départagé par l'ordre de référence
// (donc l'administrateur l'emporte, puis l'éditeur sur le rédacteur). Une
// QUALITÉ qui se cumule ne peut pas devenir principale : le réviseur dit ce
// qu'on contrôle, le signataire ce qu'on signe — pas ce qu'on est — sans quoi
// un rédacteur à qui l'on ajoute l'une de ces qualités se retrouverait « profil
// réviseur ». Une qualité seule (compte monté par l'annuaire sans rôle
// ordinaire) reste le principal par défaut, faute de mieux.
export function primaryRoleId(user) {
  const roles = rolesOf(user);
  if (!roles.length) return "";
  const pick = (list) => list.slice().sort((a, b) =>
    (ROLES[b].rank - ROLES[a].rank) || (ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)))[0];
  return pick(roles.filter((r) => !estCumulable(r))) || pick(roles);
}

// Ramène une liste de rôles à une forme canonique : connus, dédoublonnés, le
// principal EN PREMIER (c'est lui que porte `user.role`).
export function normalizeRoles(roles) {
  const list = (Array.isArray(roles) ? roles : [roles]).filter((r) => ROLES[r]);
  const uniq = [...new Set(list)];
  const principal = primaryRoleId({ roles: uniq });
  return uniq.sort((a, b) => (a === principal ? -1 : b === principal ? 1 : ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)));
}

// Applique une liste de rôles à un compte : `roles` fait foi, `role` le suit.
export function setRoles(user, roles) {
  const list = normalizeRoles(roles);
  if (!list.length) return rolesOf(user);
  user.roles = list;
  user.role = list[0];
  return list;
}

export const toggleRole = (user, role) => {
  const list = rolesOf(user);
  return setRoles(user, list.includes(role) ? list.filter((r) => r !== role) : [...list, role]);
};


// `owner: true` = l'agent ne voit que ce qu'il a produit lui-même.
export const PERMS = [
  { key: "trames.voir", label: "Consulter les trames", roles: ["administrateur", "editeur"] },
  { key: "trames.gerer", label: "Créer, modifier, dupliquer et commenter les trames (éditeur de trame)", roles: ["administrateur", "editeur"] },
  { key: "trames.styles", label: "Modifier les feuilles de style des actes (charte graphique)", roles: ["administrateur", "editeur"] },
  { key: "actes.rediger", label: "Rédiger un acte", roles: ["administrateur", "editeur", "reviseur", "redacteur"] },
  // La REPRISE d'actes anciens (voir src/lib/reprise.js) : faire entrer au
  // recueil des actes antérieurs à sa mise en service, écrits à la main et
  // publiés à titre informatif. C'est un geste de la RÉDACTION — les mêmes rôles
  // que la rédaction d'un acte, et pas les lecteurs du recueil.
  { key: "actes.reprendre", label: "Reprendre un acte ancien (import au recueil, publication informative)", roles: ["administrateur", "editeur", "reviseur", "redacteur"] },
  { key: "actes.gerer", label: "Modifier, supprimer et importer des actes (modificatif, consolidation)", roles: ["administrateur", "editeur"] },
  { key: "actes.tous", label: "Voir et rouvrir les actes de tous les agents", roles: ["administrateur", "editeur"] },
  { key: "actes.valider", label: "Porter une étape du parapheur : bon pour accord, avis, renvoi, refus", roles: ["administrateur", "editeur"] },
  { key: "actes.reviser", label: "Contrôler un acte avant sa signature (révision) : rapport de conformité, correction, validation, rejet", roles: ["administrateur", "reviseur"] },
  // Signer et PUBLIER sont deux gestes distincts : le signataire signe ce qui
  // relève de sa compétence (voir src/lib/signataires.js) sans pour autant
  // déposer les actes au recueil. L'écran « Signature & publication » s'ouvre
  // par `actes.signer` ; l'onglet de publication, lui, demande `signature.gerer`.
  { key: "actes.signer", label: "Signer un acte (signature directe, ou au titre d'une délégation) et accéder à l'écran de signature", roles: ["administrateur", "editeur", "reviseur", "redacteur", "signataire"] },
  { key: "signature.gerer", label: "Publier au recueil (identifiant ELI), consulter les publications, constater les formalités d'exécution", roles: ["administrateur", "editeur", "reviseur", "redacteur"] },
  // L'organigramme des délégations est LISIBLE par tous les comptes (voir
  // src/ui/app.js, VIEW_PERMS) ; cette permission ne garde que sa modification.
  { key: "delegations.gerer", label: "Gérer l'organigramme des délégations de signature (qui peut signer à la place de qui)", roles: ["administrateur", "editeur"] },
  // La STRUCTURE (les services, leurs bureaux et leurs rattachements) se dessine
  // aussi par un ÉDITEUR : c'est lui qui connaît les services, et le rattachement
  // d'un service élargit le périmètre de ceux qui sont au-dessus de lui. Les
  // ENTITÉS, elles — la personne morale —, restent à l'administrateur.
  { key: "organigramme.gerer", label: "Gérer la structure : services, bureaux et leurs rattachements (organigramme)", roles: ["administrateur", "editeur"] },
  { key: "publications.depublier", label: "Retirer une publication du recueil (dépublier)", roles: ["administrateur"] },
  { key: "publications.epingler", label: "Mettre un acte en avant sur le recueil public (épingler, « À la une »)", roles: ["administrateur", "editeur"] },
  // Les INFORMATIONS publiées au recueil (les billets de la rubrique
  // « Informations ») : un geste de communication, distinct de la publication
  // d'un acte — on y écrit, on publie, on épingle, et rien n'y est signé ni
  // numéroté. Voir src/lib/informations.js et src/ui/views/informations.js.
  { key: "informations.gerer", label: "Écrire et publier les informations du recueil public (billets, actualités)", roles: ["administrateur", "editeur"] },
  // Le BULLETIN (ou Journal) des actes : sa cadence, ses numéros, ses abonnés,
  // son flux. C'est un geste de PUBLICATION — le recueil rassemblé par période —
  // et il demande les mêmes rôles que la publication d'un acte. Voir
  // src/lib/bulletins.js et src/ui/views/bulletin.js.
  { key: "bulletin.gerer", label: "Régler et diffuser le bulletin des actes (cadence, numéros, abonnés, flux)", roles: ["administrateur", "editeur"] },
  { key: "referentiel.gerer", label: "Gérer le référentiel (identité, entités, personnes, rôles, références…)", roles: ["administrateur"] },
  { key: "comptes.gerer", label: "Créer des comptes, changer les rôles, désactiver, supprimer", roles: ["administrateur"] },
  { key: "api.gerer", label: "Connecter des API et consulter le journal des échanges", roles: ["administrateur"] },
  { key: "docs.voir", label: "Consulter la documentation technique (exploitation, installation, sécurité)", roles: ["administrateur"] },
];

export const ROLE_KEYS = ROLE_ORDER.slice();

const BY_KEY = new Map(PERMS.map((p) => [p.key, p]));

// Les permissions qu'un compte tient de ses QUALITÉS cumulées (réviseur,
// signataire), et non de son profil principal. Une qualité ne dit pas ce qu'un
// agent fait de sa journée : elle AJOUTE un pouvoir. C'est ce pouvoir-là qui
// survit au profil « Visiteur » — le profil ferme l'atelier, la qualité ouvre ce
// qu'elle ouvre (voir `can` et `estVisiteur`).
export const permissionsDeQualites = (user) =>
  PERMS.filter((p) => rolesOf(user).some((r) => estCumulable(r) && p.roles.includes(r))).map((p) => p.key);

export const roleOf = (user) => ROLES[primaryRoleId(user)] || null;
export const roleLabel = (user) => rolesOf(user).map((r) => ROLES[r].label).join(" + ") || "—";
export const roleBadge = (user) => roleOf(user)?.badge || "info";
// Toutes les pastilles du compte (rôle principal puis les qualités cumulées).
export const badgesOf = (user) => normalizeRoles(rolesOf(user)).map((r) => ROLES[r]);

export function can(user, perm) {
  if (!user || user.active === false) return false;
  const p = BY_KEY.get(perm);
  if (!p) return false;
  const roles = rolesOf(user);
  // Le profil « Visiteur » ferme l'atelier : il prime sur le PROFIL et sur tout
  // rôle ordinaire résiduel. Les QUALITÉS cumulées, elles, restent : elles ne
  // disent pas ce qu'on fait de sa journée, elles ajoutent un pouvoir (voir
  // `permissionsDeQualites`). Un compte extérieur dont la signature engage un
  // acte garde donc `actes.signer`, et rien d'autre.
  if (hasRole(user, VISITEUR)) return roles.some((r) => estCumulable(r) && p.roles.includes(r));
  return roles.some((r) => p.roles.includes(r));
}

export const permsOf = (role) => PERMS.filter((p) => p.roles.includes(role)).map((p) => p.key);
export const rolesWith = (perm) => BY_KEY.get(perm)?.roles || [];
// Les permissions qu'un compte tient de L'ENSEMBLE de ses rôles : c'est ce que
// l'écran « Comptes et rôles » affiche pour un compte à rôles cumulés.
export const permsOfUser = (user) => {
  const roles = rolesOf(user);
  return PERMS.filter((p) => roles.some((r) => p.roles.includes(r))).map((p) => p.key);
};

export const fullName = (u) => [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.login || "—";
const parts = (u) => [u?.firstName, u?.lastName].filter(Boolean);
export const initialsOf = (u) => parts(u).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "?";
export const sortName = (u) => [u?.lastName, u?.firstName].filter(Boolean).join(" ").toLowerCase() || "";

export function slugLogin(firstName, lastName) {
  const strip = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const f = strip(firstName), l = strip(lastName);
  return f && l ? f[0] + "." + l : (f || l || "compte");
}

export function newUser(over = {}) {
  const u = {
    id: "u-" + Math.random().toString(36).slice(2, 9),
    civility: "", firstName: "", lastName: "", login: "", email: "",
    role: "redacteur", entityId: "", service: "", personId: "",
    memberships: [],
    active: true,
    source: "local",
    oidcSub: "",
    createdAt: new Date().toISOString(),
    lastLogin: "",
    ...over,
  };
  // `roles` fait foi ; `role` n'en est que le reflet (rôle principal), pour ce
  // qui ne connaît qu'un rôle : annuaire, présence, journal.
  setRoles(u, u.roles && u.roles.length ? u.roles : (u.role ? [u.role] : ["redacteur"]));
  return u;
}

// Provenance d'un compte : ce que l'écran « Comptes et rôles » affiche, et ce
// qui décide si le compte fait partie du jeu de démonstration.
export const ACCOUNT_SOURCES = {
  demo: { label: "Démonstration", badge: "info", help: "Compte fictif livré avec la démonstration : la connexion se fait en le choisissant, sans mot de passe." },
  oidc: { label: "Annuaire", badge: "success", help: "Compte rattaché à l'annuaire de la collectivité : la session s'ouvre par l'annuaire et le rôle vient de ses groupes." },
  local: { label: "Local", badge: "warning", help: "Compte créé à la main dans l'application (installation sans annuaire, ou compte pré-enregistré pour un agent)." },
};

export const sourceOf = (u) => (u?.source === "oidc" ? "oidc" : u?.source === "demo" ? "demo" : (isDemoUser(u) ? "demo" : "local"));

// Logins uniques : un compte importé deux fois ne doit pas écraser l'autre.
export function uniqueLogin(users, wanted, keepId = "") {
  const taken = new Set(users.filter((u) => u.id !== keepId).map((u) => String(u.login || "").toLowerCase()));
  const base = String(wanted || "compte").toLowerCase();
  if (!taken.has(base)) return base;
  for (let i = 2; i < 500; i++) if (!taken.has(base + i)) return base + i;
  return base + "-" + Math.random().toString(36).slice(2, 6);
}

const entityByCode = (config, code) =>
  (config?.entities || []).find((e) => String(e.code).toUpperCase() === code)?.id
  || (config?.entities || [])[0]?.id || "";

const serviceByCode = (config, code) =>
  (config?.services || []).find((s) => String(s.code).toUpperCase() === code) || null;
const bureauOf = (config, code, name) =>
  (serviceByCode(config, code)?.bureaux || []).find((b) => b.name === name)?.id || "";

// ------------------------------------------------------------------ démo
// Comptes fictifs, rattachés pour la plupart aux personnes du référentiel de
// démonstration (personId) : le nom du connecté correspond alors à celui qui
// signe les actes.
//
// Chaque compte est rattaché à un ou plusieurs **services** (voir src/lib/scope.js) :
//   - deux administrateurs (le rôle administrateur voit tout, quel que soit le
//     service — c'est le rôle d'administration de l'application) ;
//   - deux éditeurs et six rédacteurs dans leur service ;
//   - un éditeur **transverse** (directrice des affaires juridiques) rattaché à
//     *tous* les services par l'administrateur : il voit tout ;
//   - deux comptes dont le périmètre est **restreint à certains bureaux** ;
//   - deux **réviseurs** (le rôle se cumule avec celui d'éditeur) : Amandine
//     ROUSSEL, des affaires juridiques, compétente pour tous les services et
//     tous les actes, et Isabelle DAVAL, limitée aux actes d'engagement
//     financier — la compétence d'un réviseur se règle au cas par cas ;
// sans rattachement de bureau, un compte a accès à tout son service.
export function seedUsers(config) {
  const at = new Date(Date.UTC(2026, 8, 1, 7, 30)).toISOString();
  const ent = (code) => entityByCode(config, code);
  const svc = (code) => serviceByCode(config, code)?.id || "";
  const bur = (code, name) => bureauOf(config, code, name);
  const all = () => (config?.services || []).map((s) => ({ serviceId: s.id, bureaux: null }));
  const member = (code, ...bureaux) => ({
    serviceId: svc(code),
    bureaux: bureaux.length ? bureaux.map((n) => bur(code, n)).filter(Boolean) : null,
  });
  const mk = (o) => newUser({ createdAt: at, lastLogin: "", active: true, source: "demo", ...o });
  return [
    mk({ id: "u-dubois", civility: "Monsieur", firstName: "Yann", lastName: "DUBOIS", login: "y.dubois",
      email: "yann.dubois@valmont-sur-loire.fr", role: "administrateur", entityId: ent("VSL"),
      memberships: [member("DSI")] }),
    mk({ id: "u-mercier", civility: "Monsieur", firstName: "Julien", lastName: "MERCIER", login: "j.mercier",
      email: "julien.mercier@valmont-sur-loire.fr", role: "administrateur", entityId: ent("VSL"),
      personId: "p-mercier", memberships: [member("DGS")] }),
    mk({ id: "u-leclerc", civility: "Madame", firstName: "Sophie", lastName: "LECLERC", login: "s.leclerc",
      email: "sophie.leclerc@valmont-sur-loire.fr", role: "editeur", entityId: ent("VSL"),
      personId: "p-leclerc", memberships: [member("SG")] }),
    mk({ id: "u-roussel", civility: "Madame", firstName: "Amandine", lastName: "ROUSSEL", login: "a.roussel",
      email: "amandine.roussel@valmont-sur-loire.fr", roles: ["editeur", "reviseur"], entityId: ent("VSL"),
      personId: "p-roussel", memberships: [member("AG", "Affaires juridiques")] }),
    mk({ id: "u-daval", civility: "Madame", firstName: "Isabelle", lastName: "DAVAL", login: "i.daval",
      email: "isabelle.daval@valmont-sur-loire.fr", roles: ["editeur", "reviseur"], entityId: ent("VSL"),
      personId: "p-daval", memberships: all(),
      // Compétence RESTREINTE : la directrice des affaires juridiques ne révise
      // que les actes d'engagement financier (marchés, subventions) — un
      // réviseur peut n'être compétent que pour certains types d'actes.
      revision: { trameIds: [], familyIds: ["fam-marches", "fam-associations"], actTypes: [], services: [], entityIds: [] } }),
    mk({ id: "u-bernard", civility: "Monsieur", firstName: "Éric", lastName: "BERNARD", login: "e.bernard",
      email: "eric.bernard@valmont-sur-loire.fr", role: "redacteur", entityId: ent("VSL"),
      personId: "p-bernard", memberships: [member("CAB")] }),
    mk({ id: "u-martin", civility: "Madame", firstName: "Hélène", lastName: "MARTIN", login: "h.martin",
      email: "helene.martin@valmont-sur-loire.fr", role: "redacteur", entityId: ent("CCAS"),
      personId: "p-martin", memberships: [member("AS")] }),
    mk({ id: "u-garnier", civility: "Monsieur", firstName: "Thomas", lastName: "GARNIER", login: "t.garnier",
      email: "thomas.garnier@valmont-sur-loire.fr", role: "redacteur", entityId: ent("VSL"),
      personId: "p-garnier", memberships: [member("REG", "Régie principale")] }),
    mk({ id: "u-leblanc", civility: "Madame", firstName: "Sarah", lastName: "LEBLANC", login: "s.leblanc",
      email: "sarah.leblanc@valmont-sur-loire.fr", role: "redacteur", entityId: ent("VSL"),
      personId: "p-leblanc", memberships: [member("ACC", "Accueil physique")] }),
    mk({ id: "u-benali", civility: "Monsieur", firstName: "Karim", lastName: "BENALI", login: "k.benali",
      email: "karim.benali@valmont-sur-loire.fr", role: "redacteur", entityId: ent("VSL"),
      personId: "p-benali", memberships: [member("URB", "Urbanisme")] }),
    mk({ id: "u-marchand", civility: "Madame", firstName: "Nadia", lastName: "MARCHAND", login: "n.marchand",
      email: "nadia.marchand@valmont-sur-loire.fr", role: "redacteur", entityId: ent("OPH"),
      personId: "p-marchand", memberships: [member("OPH")] }),
  ];
}

// Combien d'administrateurs actifs resterait-il ? Garde-fou : on ne supprime pas
// le dernier, et on ne se retire pas soi-même le rôle.
export function activeAdmins(users) {
  return users.filter((u) => hasRole(u, "administrateur") && u.active !== false);
}

// Identifiants des comptes livrés avec la démonstration : sert à reconnaître un
// jeu de comptes de démonstration (pour le remettre à niveau) sans jamais
// toucher à des comptes créés à la main.
export const DEMO_USER_IDS = ["u-dubois", "u-mercier", "u-leclerc", "u-roussel", "u-daval", "u-bernard", "u-martin", "u-garnier", "u-leblanc", "u-benali", "u-marchand"];
export const isDemoUser = (u) => !!u && (u.source === "demo" || (!u.source && DEMO_USER_IDS.includes(u.id)));
export const isDemoUsers = (users) =>
  Array.isArray(users) && users.length > 0 && users.every((u) => isDemoUser(u));

// ------------------------------------------------- annuaire de la collectivité
// Un compte utilisable est un compte actif, et — quand l'annuaire est branché —
// qui n'est pas un compte de démonstration. C'est le garde-fou appliqué à
// l'ouverture de session, en plus de la désactivation enregistrée dans la
// liste des comptes : aucune des deux barrières ne suffit seule.
export function accountUsable(config, user) {
  if (!user || user.active === false) return false;
  if (demoAccountsDisabled(config) && isDemoUser(user)) return false;
  return true;
}

// Désactive / réactive les comptes de démonstration selon le mode
// d'authentification. Idempotent, et **réversible** : revenir aux comptes de
// l'application ne réactive que les comptes désactivés par ce mécanisme
// (`deactivatedBy: "oidc"`) — ceux qu'un administrateur a désactivés à la main
// le restent. Rend la liste, et de quoi l'annoncer à l'utilisateur.
export function syncDemoAccounts(config, users) {
  const off = demoAccountsDisabled(config);
  const list = Array.isArray(users) ? users : [];
  const disabled = [];
  const restored = [];
  let changed = false;
  const at = new Date().toISOString();
  const out = list.map((u) => {
    if (!isDemoUser(u)) return u;
    if (off) {
      if (u.active !== false) { disabled.push(u.id); changed = true; return { ...u, active: false, deactivatedBy: "oidc", deactivatedAt: at }; }
      return u;
    }
    if (u.active === false && u.deactivatedBy === "oidc") {
      restored.push(u.id);
      changed = true;
      const next = { ...u, active: true };
      delete next.deactivatedBy;
      delete next.deactivatedAt;
      return next;
    }
    return u;
  });
  return { users: changed ? out : list, changed, disabled, restored, mode: off ? "oidc" : "demo" };
}

// Comptes de démonstration encore actifs malgré l'annuaire branché : l'écran
// d'administration s'en sert pour alerter (cela ne devrait pas arriver).
export const activeDemoAccounts = (config, users) =>
  (users || []).filter((u) => isDemoUser(u) && accountUsable(config, u));
