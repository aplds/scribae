// ============================================================================
// Mode d'authentification (référentiel, clé `config.auth`).
//
// Trois modes :
//   demo      les comptes de l'application (jeu de démonstration) — on choisit
//             un compte dans la liste, sans mot de passe ;
//   oidc      l'annuaire de la collectivité (OpenID Connect) — la connexion se
//             fait chez le fournisseur d'identité, et le rôle de l'agent vient
//             de ses groupes ;
//   password  des comptes LOCAUX avec mot de passe, tenus par le SERVICE de la
//             collectivité (voir src/server/mysql/comptes.mjs) : identifiant,
//             mot de passe, session. C'est le mode d'une installation
//             auto-hébergée qui n'a pas d'annuaire — il s'active dans le `.env`
//             du déploiement (`AUTH_MODE=password`), et c'est le déploiement qui
//             fait alors autorité sur le référentiel (voir `authConfig`).
//
// Brancher l'annuaire **désactive automatiquement les comptes de démonstration**
// (`disableDemo`) : ils ne sont plus proposés, ne peuvent plus ouvrir de
// session, et sont marqués « Désactivé (annuaire) » dans « Comptes et rôles ».
// L'opération est réversible : revenir en mode « Comptes de l'application »
// réactive les seuls comptes désactivés par ce mécanisme (ceux que
// l'administrateur avait désactivés à la main le restent). Le mode mot de passe
// applique la même règle quand le déploiement ferme les comptes de démonstration
// (`DEMO_ACCOUNTS=false`, le défaut dans ce mode).
//
// Ce module ne décrit QUE le modèle de configuration (aucune requête réseau) :
// le protocole OIDC est dans src/lib/oidc.js (interface dans src/ui/oidc.js), et
// l'appel au service des comptes dans src/lib/motdepasse.js.
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
  {
    id: "password",
    label: "Comptes locaux (mot de passe)",
    summary: "Un identifiant et un mot de passe, vérifiés par le service de la collectivité, qui ouvre une session. Le mode se règle dans le fichier .env du déploiement (AUTH_MODE=password).",
  },
];


// Ce qu'on fait d'un agent de l'annuaire dont AUCUN groupe ne correspond à un
// rôle. Dans les deux cas l'agent est bien authentifié — l'annuaire a reconnu la
// personne — et c'est ce qu'on lui OUVRE qui change :
//   deny    rien : le compte prend le rôle **Visiteur** (aucune permission).
//           L'application l'accueille, lui explique qu'il n'a pas d'accès, lui
//           donne le contact du service qui gère l'application, et le renvoie
//           vers l'espace public (voir src/ui/views/sans-acces.js).
//   default le rôle de repli (utile pendant la mise en service).
export const UNKNOWN_POLICIES = [
  { id: "deny", label: "Aucun accès (rôle Visiteur)" },
  { id: "default", label: "Attribuer le rôle de repli" },
];

export const DEFAULT_ROLE_MAP = [
  { claim: "scribae-administrateurs", role: "administrateur" },
  { claim: "scribae-editeurs", role: "editeur" },
  { claim: "scribae-redacteurs", role: "redacteur" },
];

export const DEFAULT_AUTH = {
  mode: "demo",
  // LA SECONDE PORTE : l'annuaire de la collectivité est-il proposé À CÔTÉ de la
  // porte ordinaire ? En mode « oidc », l'annuaire EST la porte ordinaire, et ce
  // réglage devient sans objet. Mais une installation qui entre par ses comptes
  // locaux (mode « password ») ou par les comptes de l'application (mode
  // « demo ») peut vouloir offrir, EN PLUS, la connexion par l'annuaire : c'est
  // ce que commande ce booléen. Le réglage ne CHANGE PAS la porte ordinaire — il
  // en ajoute une seconde, que l'écran de connexion propose sous la première.
  // Voir `annuairePropose` et src/ui/views/connexion.js.
  annuaire: false,
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
  // Aucun groupe reconnu : « deny » ouvre un accès Visiteur (aucune permission),
  // « default » attribue `defaultRole`.
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
  // Mode mot de passe : les comptes de démonstration restent-ils ouverts (le
  // raccourci « choisir un compte ») ? Réglé par le DÉPLOIEMENT
  // (`DEMO_ACCOUNTS`), jamais par le référentiel : voir `setDeploiementAuth`.
  demoAccounts: true,
};

// ------------------------------------------------------------------ déploiement
// Le fichier `.env` du service (voir src/server/) est plus FORT que le
// référentiel : c'est lui qui garde les données, et lui seul sait si le service
// exige un mot de passe. Le mode qu'il annonce est donc appliqué par-dessus
// `config.auth`, où que le code lise la configuration.
//
// Deux Sources, dans cet ordre : ce que l'hébergement a écrit dans
// `window.__SCRIBA_AUTH__` (produit au démarrage du conteneur, voir
// src/server/web/host.js), puis ce que le service répond sur
// `GET /v1/auth/config` (posé par src/lib/motdepasse.js). La seconde est
// autoritaire : elle vient de la base qui sert vraiment les données.
let deploiement = null;

export function setDeploiementAuth(source) {
  if (!source || !source.mode) { deploiement = null; return null; }
  deploiement = {
    mode: String(source.mode),
    demo: source.demo !== false,
    // Le COMMUTATEUR DE DÉMONSTRATION (`DEMO` du .env) : le jeu fictif est-il
    // installé, et l'outil est-il une page vierge plutôt ? Il vient du
    // déploiement, comme le mode. `null` = le déploiement n'en parle pas : on
    // retombe alors sur le mode (« demo » implique le jeu de démonstration).
    // Voir src/lib/demo.js, qui est le seul endroit où la question se tranche.
    demoJeu: source.demoJeu === undefined || source.demoJeu === null ? null : !!source.demoJeu,
    motDePasseMin: Number(source.motDePasseMin) || 12,
    marque: source.marque || null,
    // Les comptes de démonstration annoncés par le service (vide en
    // production) : l'écran de connexion ne peut pas lire le référentiel avant
    // d'avoir une session, et c'est donc le service qui les lui donne.
    comptes: Array.isArray(source.comptes) ? source.comptes : [],
    serveur: source.serveur !== false,
    // LES COMPTES LOCAUX (identifiant + mot de passe) sont-ils ouverts, et les
    // données se lisent-elles par une session plutôt qu'un jeton ? En mode
    // « password », oui. En mode « oidc », l'annuaire est la porte ordinaire,
    // mais le service garde les comptes locaux ouverts (`comptesLocaux`) : c'est
    // par eux que passe le compte d'administration du `.env`, et c'est ce que
    // l'écran de connexion doit proposer. Voir `accesLocal` et `sessionDeService`.
    comptesLocaux: source.comptesLocaux === undefined ? null : !!source.comptesLocaux,
    session: source.session === undefined ? null : !!source.session,
    // LES RÉGLAGES DE L'ANNUAIRE, tels que le service les a publiés dans
    // `GET /v1/auth/config`. Pourquoi le service, et pas le référentiel ? Parce
    // qu'en mode « mot de passe », le référentiel n'est lisible QU'AVEC une
    // session : l'écran de connexion, qui vient avant, ne verrait jamais les
    // réglages de l'annuaire. Le service les publie donc (ils ne portent aucun
    // secret : un client OIDC public n'en détient pas), et le client les
    // applique par-dessus le référentiel — voir `authConfig`. `null` quand le
    // service n'en parle pas (mode « demo », ou service antérieur) : le
    // référentiel fait alors foi, comme avant.
    annuaire: source.annuaire && typeof source.annuaire === "object" ? source.annuaire : null,
    // LE SERVICE SAIT-IL OUVRIR UNE SESSION D'ANNUAIRE ? Depuis la version
    // 1.6.1p, le service est le CLIENT OIDC : il échange lui-même le code, vérifie
    // le jeton et ouvre SA session — c'est ce qui fait qu'un agent entré par
    // l'annuaire lit les actes, et que le fournisseur n'a pas besoin de parler
    // CORS. Il le publie ici (`annuaireService`), et c'est ce drapeau qui décide
    // si la seconde porte est proposée quand les données se lisent par une
    // session (voir `annuairePropose`). `null` = le service n'en parle pas
    // (version antérieure, aperçu hors ligne) : on garde le comportement d'avant,
    // où la porte n'était pas proposée.
    annuaireService: source.annuaireService === undefined || source.annuaireService === null
      ? null : !!source.annuaireService,
    // ÉTAT DU DÉPLOIEMENT, pour l'écran de connexion (voir mot-de-passe.js) :
    //   baseDisponible  la base répond-elle ? (`null` = pas encore éprouvée)
    //   baseMessage/baseRemede  le motif, et le remède à afficher ;
    //   adminAmorce     un compte d'administration peut-il se connecter ?
    //                   (`null` en mode « demo » : sans objet)
    //   adminMotif      pourquoi l'amorçage a échoué, le cas échéant ;
    //   adminPanne      cet échec est-il une PANNE (référentiel des comptes
    //                   injoignable) et non un refus de configuration ? Les
    //                   deux ne se réparent pas au même endroit ;
    //   adminAvertissement  l'amorçage a réussi, mais avec une réserve.
    // Sans ces champs, un ADMIN_PASSWORD refusé ne se voyait QUE dans les
    // journaux du service — l'agent, lui, ne lisait qu'« Identifiant ou mot de
    // passe incorrect ».
    baseDisponible: source.baseDisponible === undefined || source.baseDisponible === null
      ? null : !!source.baseDisponible,
    baseMessage: String(source.baseMessage || ""),
    baseRemede: String(source.baseRemede || ""),
    adminAmorce: source.adminAmorce === undefined || source.adminAmorce === null
      ? null : !!source.adminAmorce,
    adminMotif: String(source.adminMotif || ""),
    adminAvertissement: String(source.adminAvertissement || ""),
    adminPanne: !!source.adminPanne,
  };
  return deploiement;
}

export const deploiementAuth = () => deploiement;
// Le MODE annoncé par le déploiement, sans avoir besoin du référentiel — c'est
// ce que consultent les couches basses (persistance, API) pour savoir si la
// porte est une session à mot de passe (le cookie du service) ou un jeton.
export const modeDeploiement = () => {
  const d = deploiement || deploiementDePage();
  return d && d.mode ? String(d.mode) : null;
};
// Relu à chaque appel : `window.__SCRIBA_AUTH__` peut avoir été posé par la page
// (édition auto-hébergée) sans que rien n'ait été appelé explicitement.
export function deploiementDePage() {
  const w = globalThis.__SCRIBA_AUTH__;
  return w && w.mode ? w : null;
}

export const emptyAuth = () => ({ ...DEFAULT_AUTH, endpoints: { ...DEFAULT_AUTH.endpoints }, roleMap: DEFAULT_ROLE_MAP.map((m) => ({ ...m })) });

// Les champs de l'annuaire qu'un DÉPLOIEMENT peut publier (par le `.env`, ou
// par le référentiel lu par le service) : tout ce qui décrit le fournisseur, la
// correspondance des rôles et la seconde porte. Aucun de ces champs ne porte un
// secret — l'application est un client OIDC public —, et c'est ce que le service
// a le droit de publier dans `GET /v1/auth/config` (voir src/server/mysql/
// annuaire.mjs, qui tient la même liste côté service).
export const ANNUAIRE_CLES = [
  "annuaire", "test", "issuer", "clientId", "scopes", "redirectUri", "prompt",
  "roleClaim", "roleMap", "unknownPolicy", "defaultRole",
  "serviceClaim", "entityClaim", "authoritative", "autoProvision", "useUserinfo",
  "requireSignature", "disableDemo", "allowRecovery",
];

// Configuration complète, valeurs par défaut comprises : tout le reste du code
// lit l'authentification par cette fonction, jamais `config.auth` directement —
// un référentiel enregistré avant l'introduction de ces réglages n'en a pas.
// Le DÉPLOIEMENT, s'il est connu, passe par-dessus (voir ci-dessus).
export function authConfig(config) {
  const a = config?.auth || {};
  const base = {
    ...DEFAULT_AUTH,
    ...a,
    endpoints: { ...DEFAULT_AUTH.endpoints, ...(a.endpoints || {}) },
    roleMap: Array.isArray(a.roleMap) ? a.roleMap : DEFAULT_AUTH.roleMap,
  };
  const dep = deploiement || deploiementDePage();
  if (dep && dep.mode) {
    base.mode = dep.mode;
    // En mode mot de passe, le déploiement décide si le raccourci de
    // démonstration reste ouvert — le référentiel n'a pas voix au chapitre.
    if (dep.mode === "password") base.demoAccounts = dep.demo !== false;
  }
  // Les réglages de l'ANNUAIRE publiés par le service (référentiel relu par lui,
  // et variables `SCRIBA_ANNUAIRE_*` du `.env` par-dessus) : ils recouvrent le
  // référentiel de la PAGE, qui — en mode mot de passe — n'est pas encore
  // lisible ici. Sans publication (mode « demo », service antérieur), le
  // référentiel fait foi, exactement comme avant.
  if (dep && dep.annuaire) {
    for (const cle of ANNUAIRE_CLES) {
      if (dep.annuaire[cle] !== undefined) base[cle] = dep.annuaire[cle];
    }
    if (dep.annuaire.endpoints) base.endpoints = { ...base.endpoints, ...dep.annuaire.endpoints };
  }
  return base;
}

export const isOidc = (config) => authConfig(config).mode === "oidc";
export const isPassword = (config) => authConfig(config).mode === "password";

// ----------------------------------------------------------------------------
// LA SECONDE PORTE — OU L'ANNUAIRE ORDINAIRE.
//
// Trois questions, à ne pas confondre :
//   `isOidc`            l'annuaire est-il la porte ORDINAIRE ? (mode « oidc »)
//   `annuaireSecondePorte`  a-t-on branché l'annuaire EN PLUS de la porte
//                       ordinaire ? (mode « password » ou « demo », et
//                       `auth.annuaire` coché)
//   `annuairePropose`   l'écran de connexion doit-il PROPOSER l'annuaire ?
//                       (porte ordinaire, ou seconde porte réellement branchée)
//
// Le troisième est le seul que l'écran de connexion consulte. Une seconde porte
// DEMANDÉE mais pas branchée — la case cochée sans adresse d'émetteur, ou sans
// identifiant de client — n'est PAS proposée : un déploiement ne doit pas se
// retrouver avec une porte ouverte sur l'annuaire d'essai (des identités
// fictives, sans mot de passe) pour avoir coché une case. L'annuaire d'essai
// reste disponible, mais il faut l'avoir CHOISI (`test`).
const annuaireDemande = (a) => !!a && (a.mode === "oidc" || a.annuaire === true);

export const annuaireSecondePorte = (config) => {
  const a = authConfig(config);
  return a.mode !== "oidc" && a.annuaire === true;
};

// LE SERVICE FAIT-IL LA CONNEXION D'ANNUAIRE ? (drapeau `annuaireService` de
// `GET /v1/auth/config`). Quand il la fait, l'agent qui entre par l'annuaire
// obtient une SESSION DU SERVICE : il lit les actes comme tout le monde, et le
// fournisseur n'a pas à autoriser l'appel depuis le navigateur (CORS). La
// seconde porte s'ouvre donc même là où les données se lisent par une session.
export function annuaireParLeService() {
  const dep = deploiement || deploiementDePage();
  return !!(dep && dep.annuaireService === true);
}

export function annuairePropose(config) {
  const a = authConfig(config);
  if (!annuaireDemande(a)) return false;
  if (a.mode === "oidc") return true;   // porte ordinaire : l'essai prend le relais si rien n'est branché
  // LA PORTE DES DONNÉES DÉCIDE AUSSI. Si le service de la collectivité ne sert
  // les données qu'à SES sessions (mode « comptes locaux »), une connexion par
  // l'annuaire doit ouvrir une session DU SERVICE, sinon l'agent arriverait dans
  // une application vide et chaque lecture serait refusée (401). C'est ce que
  // fait un service à jour (`annuaireService`) : il est le client OIDC, échange
  // le code et ouvre la session. Un service antérieur ne sait pas le faire : la
  // porte n'est alors pas proposée, et l'Administration › Annuaire dit pourquoi.
  if (sessionDeService(config) && !annuaireParLeService()) return false;
  if (a.test === true) return true;     // l'annuaire d'essai est un choix explicite
  return !!String(a.issuer || "").trim() && !!String(a.clientId || "").trim();
}

// Pourquoi la seconde porte n'est-elle pas ouverte, alors qu'elle est demandée ?
// Rend une phrase, ou "" si tout est en ordre — c'est ce que l'Administration ›
// Annuaire affiche, et ce qu'un exploitant doit lire pour savoir QUOI corriger.
export function annuaireFermePour(config) {
  const a = authConfig(config);
  if (!annuaireDemande(a) || a.mode === "oidc" || annuairePropose(config)) return "";
  if (sessionDeService(config) && !annuaireParLeService()) {
    return "Ce déploiement sert les données par une session de service, et ce service ne sait pas encore ouvrir une session "
      + "à partir de l'annuaire : la connexion par l'annuaire n'ouvrirait qu'une identité, pas l'accès aux actes. "
      + "Mettez le service à jour (le branchement se fait chez lui depuis la version 1.6.1p — AUTH_MODE=password ou oidc), "
      + "ou employez l'annuaire devant un service protégé en amont (SSO devant l'application) — voir docs/ADMINISTRATION.md § 4.4.";
  }
  if (a.test !== true && !String(a.issuer || "").trim()) return "Adresse du fournisseur (émetteur) manquante.";
  if (a.test !== true && !String(a.clientId || "").trim()) return "Identifiant du client (client_id) manquant.";
  return "";
}

// ----------------------------------------------------------------------------
// LES DEUX PORTES, QUAND L'ANNUAIRE EST BRANCHÉ.
//
// Le mode « oidc » n'éteint pas les comptes locaux : le service garde la
// connexion par identifiant et mot de passe ouverte, parce que c'est par elle
// qu'on entre avec le compte d'administration du `.env` — le jour où l'annuaire
// est en panne, ou depuis un poste qui ne le joint pas. L'annuaire est la porte
// ORDINAIRE ; le compte local est la porte de SERVICE.
//
// `accesLocal` dit si le formulaire « identifiant / mot de passe » doit être
// proposé ; `sessionDeService` dit si les données se lisent par une session
// (cookie) plutôt que par un jeton d'API — c'est ce que consultent la
// persistance et l'API, qui n'ont pas le référentiel sous la main.
// ----------------------------------------------------------------------------
export function accesLocal(config) {
  const a = authConfig(config);
  if (a.mode === "password") return true;
  if (a.mode !== "oidc") return false;
  // Le service dit si les comptes locaux sont ouverts ; à défaut (service
  // antérieur, aperçu hors ligne), un déploiement OIDC les garde toujours.
  const dep = deploiement || deploiementDePage();
  if (dep && dep.comptesLocaux === false) return false;
  return true;
}

// La porte du service est-elle une SESSION (mot de passe, annuaire) plutôt
// qu'un jeton d'API ? Faux en mode « demo » : là, un jeton, et une liste de
// comptes sans mot de passe.
export function sessionDeService(config) {
  const dep = deploiement || deploiementDePage();
  const mode = dep && dep.mode ? String(dep.mode) : (config ? authConfig(config).mode : "demo");
  if (mode === "demo") return false;
  // Le service fait autorité s'il s'est prononcé ; sinon, tout mode non-démo
  // (password, oidc) passe par une session.
  if (dep && dep.session !== null && dep.session !== undefined) return !!dep.session;
  return true;
}

// Les COMPTES de l'application sont-ils ceux du DÉPLOIEMENT — comptes locaux
// tenus par le service, ou agents de l'annuaire — plutôt que ceux du jeu de
// démonstration ? La question commande un geste destructeur : « Repartir d'un
// référentiel vierge » emporte les comptes du jeu fictif, mais PAS ceux d'un
// service. Les mots de passe vivent chez lui (`sb_motdepasse`), hors du
// référentiel : effacer les comptes ne les supprime pas, et l'installation s'en
// trouvait sans personne pour se connecter — le compte d'administration compris.
// Voir `clearAll` (src/lib/store.js) et src/ui/views/referentiel.js.
export const comptesDuDeploiement = () => ["password", "oidc"].includes(modeDeploiement());

// L'annuaire branché est l'annuaire d'essai intégré (ou aucun fournisseur n'est
// encore renseigné : on ne bloque pas l'installation sur un écran de connexion
// injoignable, l'essai prend le relais jusqu'au branchement du vrai annuaire).
// Vaut pour la porte ordinaire comme pour la seconde porte.
export const isTestProvider = (auth) => annuaireDemande(auth) && (auth.test === true || !String(auth.issuer || "").trim());

// Les comptes de démonstration sont-ils refusés ? Deux raisons, dans cet ordre :
// l'annuaire branché (réglage du référentiel, `disableDemo`), ou le déploiement
// qui ferme le raccourci de démonstration de son mode mot de passe.
export const demoAccountsDisabled = (config) => {
  const a = authConfig(config);
  if (a.mode === "oidc") return a.disableDemo !== false;
  if (a.mode === "password") return a.demoAccounts === false;
  return false;
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
// l'écran de connexion et dans « Administration › Annuaire ».
export function providerProblems(auth) {
  const out = [];
  if (!annuaireDemande(auth)) return out;
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
  // LA SECONDE PORTE, quand elle est réellement proposée : on la dit, sans
  // effacer ce que la porte ordinaire est déjà.
  if (annuaireSecondePorte(config) && annuairePropose(config)) {
    const ordinaire = a.mode === "password"
      ? "Connexion par un compte local (identifiant et mot de passe)"
      : "Connexion par les comptes de l'application (démonstration)";
    return ordinaire + ", ou par l'annuaire " + (isTestProvider(a) ? "d'essai intégré" : issuerLabel(a)) + " : les deux portes sont proposées.";
  }
  if (a.mode === "password") {
    return a.demoAccounts === false
      ? "Connexion par un compte local (identifiant et mot de passe) : les comptes de démonstration sont désactivés."
      : "Connexion par un compte local (identifiant et mot de passe). Les comptes de démonstration restent ouverts sur ce service (réglage du déploiement).";
  }
  if (a.mode !== "oidc") return "Connexion par les comptes de l'application (démonstration).";
  if (isTestProvider(a)) return "Connexion par l'annuaire d'essai intégré (jetons non vérifiés) : les comptes de démonstration sont désactivés.";
  return "Connexion par l'annuaire " + issuerLabel(a) + " : les comptes de démonstration sont désactivés.";
}
