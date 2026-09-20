// ============================================================================
// Mode d'authentification (référentiel, clé `config.auth`).
//
// Deux modes :
//   demo  les comptes de l'application (jeu de démonstration) — on choisit un
//         compte dans la liste, sans mot de passe ;
//   oidc  l'annuaire de la collectivité (OpenID Connect) — la connexion se fait
//         chez le fournisseur d'identité, et le rôle de l'agent vient de ses
//         groupes.
//
// Brancher l'annuaire **désactive automatiquement les comptes de démonstration**
// (`disableDemo`) : ils ne sont plus proposés, ne peuvent plus ouvrir de
// session, et sont marqués « Désactivé (annuaire) » dans « Comptes et rôles ».
// L'opération est réversible : revenir en mode « Comptes de l'application »
// réactive les seuls comptes désactivés par ce mécanisme (ceux que
// l'administrateur avait désactivés à la main le restent).
//
// Ce module ne décrit QUE le modèle de configuration (aucune requête réseau) :
// le protocole lui-même est dans src/lib/oidc.js, l'interface dans
// src/ui/oidc.js. Aucun secret n'y figure : l'application est un **client
// public**, la sécurité du flux repose sur PKCE (voir src/lib/oidc.js).
// ============================================================================
export const AUTH_MODES = [
  {
    id: "demo",
    label: "Comptes de l'application",
    summary: "Démonstration : la liste des comptes de l'application, sans mot de passe. À réserver aux essais.",
  },
  {
    id: "oidc",
    label: "Annuaire de la collectivité (OIDC)",
    summary: "La connexion se fait chez le fournisseur d'identité ; le rôle et le périmètre viennent des groupes de l'agent.",
  },
];

// Un agent dont aucun groupe n'est reconnu :
//   deny    on refuse la connexion (défaut, sûr : l'annuaire est la seule porte)
//   default on lui donne `defaultRole` (utile pendant la mise en service)
export const UNKNOWN_POLICIES = [
  { id: "deny", label: "Refuser la connexion" },
  { id: "default", label: "Attribuer le rôle de repli" },
];

export const DEFAULT_ROLE_MAP = [
  { claim: "scribae-administrateurs", role: "administrateur" },
  { claim: "scribae-editeurs", role: "editeur" },
  { claim: "scribae-redacteurs", role: "redacteur" },
];

export const DEFAULT_AUTH = {
  mode: "demo",
  // Annuaire d'essai intégré : exerce tout le mécanisme (jetons, revendications,
  // attribution des rôles, désactivation des comptes de démonstration) sans
  // aucun appel réseau, quand aucun fournisseur n'est encore branché.
  test: false,
  issuer: "",
  clientId: "",
  scopes: "openid profile email",
  redirectUri: "",            // vide = adresse de la page courante
  prompt: "",                 // ex. « select_account »
  // Revendication portant les groupes, et correspondance groupe → rôle.
  roleClaim: "groups",
  roleMap: DEFAULT_ROLE_MAP,
  unknownPolicy: "deny",
  defaultRole: "redacteur",
  // Revendications du périmètre : le service (code de `config.services`) et
  // l'entité de rattachement (code de `config.entities`).
  serviceClaim: "services",
  entityClaim: "entity",
  // Les groupes de l'annuaire font foi : rôle et périmètre sont repris à chaque
  // connexion. Décoché, l'annuaire authentifie seulement, et le rôle attribué
  // dans l'application est conservé.
  authoritative: true,
  // Un agent inconnu de l'application est créé à sa première connexion.
  autoProvision: true,
  // Compléter les revendications par /userinfo (utile quand les groupes n'y
  // sont pas dans le jeton).
  useUserinfo: true,
  // Refuser un jeton dont la signature n'a pas pu être vérifiée (JWKS).
  requireSignature: true,
  // Points de terminaison saisis à la main, quand la découverte
  // (/.well-known/openid-configuration) est bloquée.
  endpoints: { authorization: "", token: "", jwks: "", userinfo: "" },
  // Les comptes de démonstration sont désactivés tant que l'annuaire est branché.
  disableDemo: true,
  // Porte de secours : depuis l'écran de connexion, revenir en mode
  // « Comptes de l'application » si l'annuaire est injoignable.
  allowRecovery: true,
};

export const emptyAuth = () => ({ ...DEFAULT_AUTH, endpoints: { ...DEFAULT_AUTH.endpoints }, roleMap: DEFAULT_ROLE_MAP.map((m) => ({ ...m })) });

// Configuration complète, valeurs par défaut comprises : tout le reste du code
// lit l'authentification par cette fonction, jamais `config.auth` directement —
// un référentiel enregistré avant l'introduction de ces réglages n'en a pas.
export function authConfig(config) {
  const a = config?.auth || {};
  return {
    ...DEFAULT_AUTH,
    ...a,
    endpoints: { ...DEFAULT_AUTH.endpoints, ...(a.endpoints || {}) },
    roleMap: Array.isArray(a.roleMap) ? a.roleMap : DEFAULT_AUTH.roleMap,
  };
}

export const isOidc = (config) => authConfig(config).mode === "oidc";

// L'annuaire branché est l'annuaire d'essai intégré (ou aucun fournisseur n'est
// encore renseigné : on ne bloque pas l'installation sur un écran de connexion
// injoignable, l'essai prend le relais jusqu'au branchement du vrai annuaire).
export const isTestProvider = (auth) => !!auth && auth.mode === "oidc" && (auth.test === true || !String(auth.issuer || "").trim());

// Les comptes de démonstration sont-ils refusés ?
export const demoAccountsDisabled = (config) => {
  const a = authConfig(config);
  return a.mode === "oidc" && a.disableDemo !== false;
};

// Adresse de retour déclarée au fournisseur : celle de la page, ou celle saisie
// dans le référentiel (déploiements derrière un reverse-proxy, sous-chemin…).
export function redirectUriFor(auth) {
  const forced = String(auth?.redirectUri || "").trim();
  if (forced) return forced;
  if (typeof location === "undefined") return "";
  return location.origin + location.pathname;
}

export const issuerLabel = (auth) => {
  const raw = String(auth?.issuer || "").trim();
  if (!raw) return "annuaire d'essai";
  try { return new URL(raw).host; } catch { return raw; }
};

export const providerLabel = (auth) => (isTestProvider(auth) ? "Annuaire d'essai" : issuerLabel(auth));

// Ce qui manque pour que la connexion fonctionne — affiché tel quel dans
// l'écran de connexion et dans « Référentiel › Annuaire ».
export function providerProblems(auth) {
  const out = [];
  if (!auth || auth.mode !== "oidc") return out;
  if (isTestProvider(auth)) return out;
  if (!String(auth.issuer || "").trim()) out.push("Adresse du fournisseur (émetteur) manquante.");
  if (!String(auth.clientId || "").trim()) out.push("Identifiant du client manquant.");
  const e = auth.endpoints || {};
  if (!e.authorization && !e.token) out.push("Points de terminaison inconnus : la découverte sera tentée à la connexion.");
  return out;
}

// Résumé lisible du mode, pour le bandeau de l'écran de connexion et le guide.
export function authSummary(config) {
  const a = authConfig(config);
  if (a.mode !== "oidc") return "Connexion par les comptes de l'application (démonstration).";
  if (isTestProvider(a)) return "Connexion par l'annuaire d'essai intégré (jetons non vérifiés) : les comptes de démonstration sont désactivés.";
  return "Connexion par l'annuaire " + issuerLabel(a) + " : les comptes de démonstration sont désactivés.";
}
