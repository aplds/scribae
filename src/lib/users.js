// ============================================================================
// Comptes et profils d'accès.
//
// Trois profils, du plus large au plus étroit :
//   administrateur  administre l'application (référentiel, comptes, API, données)
//   editeur         rédige, modifie et commente les trames ; règle les feuilles
//                   de style des actes ; rédige des actes
//   redacteur       rédige un acte et les actions associées (exporter, envoyer
//                   en signature, publier) ; ne voit que ses propres actes
//
// Les permissions sont déclarées une seule fois (PERMS) : c'est cette table qui
// sert à la fois au contrôle d'accès (`can`) et à la documentation affichée
// dans l'écran « Comptes et rôles » et dans le guide.
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
    summary: "Rédige, modifie et commente les trames de son service (et règle les feuilles de style des actes). Rédige des actes et voit ceux de son service ou de son bureau. Porte les étapes du parapheur confiées à son rôle : bon pour accord, avis, renvoi, refus.",
  },
  redacteur: {
    id: "redacteur", label: "Rédacteur", rank: 1, badge: "success",
    summary: "Rédige un acte à partir d'une trame de son service et procède aux actions associées (enregistrer, exporter, envoyer en signature, publier). Ne voit que ses propres actes, dans son périmètre. Le registre des trames ne lui est pas ouvert : il choisit son modèle dans l'écran « Rédiger un acte ».",
  },
};

export const ROLE_ORDER = ["administrateur", "editeur", "redacteur"];

// `owner: true` = l'agent ne voit que ce qu'il a produit lui-même.
export const PERMS = [
  { key: "trames.voir", label: "Consulter les trames", roles: ["administrateur", "editeur"] },
  { key: "trames.gerer", label: "Créer, modifier, dupliquer et commenter les trames (éditeur de trame)", roles: ["administrateur", "editeur"] },
  { key: "trames.styles", label: "Modifier les feuilles de style des actes (charte graphique)", roles: ["administrateur", "editeur"] },
  { key: "actes.rediger", label: "Rédiger un acte", roles: ["administrateur", "editeur", "redacteur"] },
  { key: "actes.gerer", label: "Modifier, supprimer et importer des actes (modificatif, consolidation)", roles: ["administrateur", "editeur"] },
  { key: "actes.tous", label: "Voir et rouvrir les actes de tous les agents", roles: ["administrateur", "editeur"] },
  { key: "actes.valider", label: "Porter une étape du parapheur : bon pour accord, avis, renvoi, refus", roles: ["administrateur", "editeur"] },
  { key: "signature.gerer", label: "Envoyer en signature et publier au recueil", roles: ["administrateur", "editeur", "redacteur"] },
  { key: "referentiel.gerer", label: "Gérer le référentiel (identité, entités, personnes, rôles, références…)", roles: ["administrateur"] },
  { key: "comptes.gerer", label: "Créer des comptes, changer les rôles, désactiver, supprimer", roles: ["administrateur"] },
  { key: "api.gerer", label: "Connecter des API et consulter le journal des échanges", roles: ["administrateur"] },
];

export const ROLE_KEYS = ROLE_ORDER.slice();

const BY_KEY = new Map(PERMS.map((p) => [p.key, p]));

export const roleOf = (user) => ROLES[user?.role] || null;
export const roleLabel = (user) => roleOf(user)?.label || "—";
export const roleBadge = (user) => roleOf(user)?.badge || "info";

export function can(user, perm) {
  if (!user || user.active === false) return false;
  const p = BY_KEY.get(perm);
  if (!p) return false;
  return p.roles.includes(user.role);
}

export const permsOf = (role) => PERMS.filter((p) => p.roles.includes(role)).map((p) => p.key);
export const rolesWith = (perm) => BY_KEY.get(perm)?.roles || [];

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
  return {
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
//   - deux éditeurs et quatre rédacteurs dans leur service ;
//   - un éditeur **transverse** (directrice des affaires juridiques) rattaché à
//     *tous* les services par l'administrateur : il voit tout ;
//   - deux comptes dont le périmètre est **restreint à certains bureaux** ;
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
      email: "amandine.roussel@valmont-sur-loire.fr", role: "editeur", entityId: ent("VSL"),
      personId: "p-roussel", memberships: [member("AG", "Affaires juridiques")] }),
    mk({ id: "u-daval", civility: "Madame", firstName: "Isabelle", lastName: "DAVAL", login: "i.daval",
      email: "isabelle.daval@valmont-sur-loire.fr", role: "editeur", entityId: ent("VSL"),
      personId: "p-daval", memberships: all() }),
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
  ];
}

// Combien d'administrateurs actifs resterait-il ? Garde-fou : on ne supprime pas
// le dernier, et on ne se retire pas soi-même le rôle.
export function activeAdmins(users) {
  return users.filter((u) => u.role === "administrateur" && u.active !== false);
}

// Identifiants des comptes livrés avec la démonstration : sert à reconnaître un
// jeu de comptes de démonstration (pour le remettre à niveau) sans jamais
// toucher à des comptes créés à la main.
export const DEMO_USER_IDS = ["u-dubois", "u-mercier", "u-leclerc", "u-roussel", "u-daval", "u-bernard", "u-martin", "u-garnier", "u-leblanc"];
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
