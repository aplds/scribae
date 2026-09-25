#!/usr/bin/env node
// ============================================================================
// Scribae — service de la collectivité.
//
// Un seul processus HTTP, deux familles de ressources, un seul RANGEMENT :
//
//   /v1/db/…      persistance partagée (référentiel, trames, actes, comptes) —
//                 synchronisation enregistrement par enregistrement, révisions,
//                 conflits, colonnes indexées, journal technique ;
//   /v1/…         signature et publication (dépôt des actes, circuits de
//                 signature, notification du prestataire, publication, ELI) —
//                 le domaine de `actes.mjs`, dont l'état est conservé à part.
//
// LE RANGEMENT est MariaDB PAR DÉFAUT, ou un simple DOSSIER DE FICHIERS
// (`STOCKAGE=fichier`, `DATA_DIR=./data`) pour une installation sans serveur de
// base de données. Le CONTRAT des deux est le même (voir magasin.mjs) : le reste
// du service ne fait aucune différence, et l'application non plus. Voir
// magasin-mysql.mjs et magasin-fichier.mjs.
//
// Les deux familles exigent une autorisation : un **jeton d'API** en mode
// « demo » (le fonctionnement historique : `Authorization: Bearer`, dont le
// service ne connaît que l'empreinte SHA-256), ou une **session** en mode
// « password » (identifiant + mot de passe, cookie `HttpOnly`, voir
// `comptes.mjs`). Le mode est choisi par `.env` (`AUTH_MODE`) : c'est le
// déploiement qui décide, pas le référentiel de l'application. Aucun secret
// n'est écrit dans ce fichier.
//
// Démarrage :
//   1. préparer la base — le COMPTE applicatif et le SCHÉMA, dans cet ordre :
//      `node server.mjs --reconcilier` remet le compte au mot de passe du .env,
//      PUIS applique `schema.sql` (les deux gestes sont idempotents ; c'est
//      exactement ce que fait le service `db-init` de la pile Compose à chaque
//      démarrage, et c'est ce qui garantit une base utilisable) ;
//   2. npm ci                           (installe l'arbre verrouillé)
//   3. node server.mjs --migrate        (schéma seul, si le compte est déjà bon)
//   4. node server.mjs                  (ou: npm start)
//
// Toute la configuration passe par des variables d'environnement (env.example).
// ============================================================================

import http from "node:http";
import { readFileSync } from "node:fs";
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { createActesApi, emptyState } from "./actes.mjs";
import { APP_NAME } from "./logiciel-engendre.mjs";
import { banniere } from "./banniere.mjs";
import { createBulletins } from "./bulletins.mjs";
import * as courriel from "./courriel.mjs";
import { SERVICE_ID, entetesSurs, ecrireEntetes } from "./entetes.mjs";
import { amorcerAdministrateur, nomDe, slug } from "./amorcage.mjs";
import { createComptes, normaliserLogin, motDePasseFaible } from "./comptes.mjs";
import { lireVariables } from "./variables.mjs";
import { annuairePublic } from "./annuaire.mjs";
import { annuaireAccepte, annuaireEffectif } from "./annuaire-service.mjs";
import { verifierJws } from "./jws.mjs";
import { createPrestataire } from "./signature.mjs";
import { creerMagasinMysql } from "./magasin-mysql.mjs";
import { creerMagasinFichier } from "./magasin-fichier.mjs";
import { CLE_IPS, CLE_MESSAGE, etat as etatAtelier, corpsRefus, resume as resumeAtelier, adresseDeLEntete } from "./atelier.mjs";

// Le NOM vient de l'identité du logiciel (`src/lib/logiciel.js`, par le miroir
// engendré) : celui qui renomme le logiciel n'a pas à le retrouver ici, et le
// journal du conteneur ne peut pas annoncer un autre nom que la bannière.
const SERVICE = APP_NAME + " — service de la collectivité";
const SERVICE_VERSION = "1.0.0";
// `SERVICE` (tiret cadratin, accents) sert aux journaux et aux corps JSON ;
// `SERVICE_ID` (« scribae », ASCII) est le seul employé en en-tête HTTP. La
// distinction vit dans entetes.mjs, avec les protections qui empêchent un
// en-tête refusé d'abattre le processus.

// ------------------------------------------------------------------ réglages
const env = (k, d = "") => (process.env[k] === undefined ? d : String(process.env[k]));
const num = (k, d) => (process.env[k] === undefined ? d : Number(process.env[k]) || d);

// --- Réglages déclaratifs du `.env` -----------------------------------------
// Le registre (variables.mjs) est la source de vérité des variables : il dit
// leur portée, leur type, leurs bornes et leur rôle. On lit et on VALIDE les
// deux portées ici, AVANT de s'en servir :
//   • OPTIONS — les réglages de RÉFÉRENTIEL, transmis au navigateur par
//     `GET /v1/config`, qui les applique par-dessus le référentiel ;
//   • OPTIONS_SERVICE — les réglages du SERVICE. Les constantes ci-dessous les
//     lisent par `opt()`, pour qu'il n'existe qu'UNE interprétation de chaque
//     variable (types, bornes, choix) au lieu d'un lecteur par réglage.
// Une valeur refusée n'est jamais appliquée : elle est signalée dans les
// journaux et dans `GET /v1/config`, jamais remplacée en silence.
const OPTIONS = lireVariables(process.env, "referentiel");
const OPTIONS_SERVICE = lireVariables(process.env, "service");
const opt = (k) => OPTIONS_SERVICE.valeurs[k];

const PORT = num("PORT", 8080);
const HOST = env("HOST", "0.0.0.0");
const MAX_BODY = num("MAX_BODY", 8 * 1024 * 1024);       // 8 Mio par requête
const MAX_SYNC_RECORDS = num("MAX_SYNC_RECORDS", 4000);
const MAX_STATE_CHARS = num("MAX_STATE_CHARS", 8 * 1000 * 1000); // taille de l'état signature/publication
const MAX_DOC = num("MAX_DOC", 400000);                  // taille d'un acte déposé
const MAX_PUBLIES = num("MAX_PUBLIES", 40);
const MAX_SIGNATURES = num("MAX_SIGNATURES", 80);
const MAX_ACTES = num("MAX_ACTES", 80);
const RATE_WINDOW_MS = num("RATE_WINDOW_MS", 60000);
const RATE_MAX_WRITES = num("RATE_MAX_WRITES", 600);
const RATE_MAX_CONNEXIONS = num("RATE_MAX_CONNEXIONS", 30);
// Origines autorisées à appeler l'API depuis un navigateur. Le défaut est
// FERMÉ (aucune) : une API de service public n'a pas à être appelable en
// lecture de cookies depuis n'importe quel site. Le déploiement déclare
// l'origine de l'application (`CORS_ORIGINS=https://actes.exemple.fr`), et
// plusieurs origines se séparent par des virgules. `*` reste possible, mais il
// faut l'écrire — et il n'expose alors aucune session (pas de cookies).
const CORS_ORIGINS = env("CORS_ORIGINS", "").split(",").map((s) => s.trim()).filter(Boolean);

// --- le BULLETIN des actes ---------------------------------------------------
// Le Bulletin rassemble les actes publiés par PÉRIODE et les diffuse : une
// sous-page du recueil par numéro, un flux RSS/Atom, un courriel aux abonnés
// (voir src/server/mysql/bulletins.mjs). Ce qui se règle ici tient au SERVICE :
// l'adresse PUBLIQUE du recueil — c'est elle qui donne leurs liens aux
// courriels et au flux, puisque le service, quand il compose seul, ne voit pas
// l'adresse du lecteur — et les bornes de ce qu'il conserve et expédie.
const PUBLIQUE_URL = String(opt("SCRIBA_PUBLIQUE_URL") || "").replace(/\/+$/, "");
const BULLETIN_MAX = opt("SCRIBA_BULLETIN_MAX") || 60;
const BULLETIN_MAX_ABONNES = opt("SCRIBA_BULLETIN_MAX_ABONNES") || 2000;
const BULLETIN_ENVOIS_PASSE = opt("SCRIBA_BULLETIN_ENVOIS_PASSE") || 40;
const BULLETIN_INTERVALLE_MIN = opt("SCRIBA_BULLETIN_INTERVALLE_MIN") || 10;

// --- Authentification --------------------------------------------------------
//   demo      la porte reste celle d'aujourd'hui : jeton d'API pour écrire, et
//             comptes de l'application choisis dans une liste (démonstration) ;
//   password  une VRAIE connexion : identifiant, mot de passe, session. Les
//             jetons d'API ne sont alors PLUS acceptés (le jeton est dans le
//             navigateur, donc public : il ne peut pas protéger une donnée) ;
//   oidc      l'annuaire de la collectivité (OpenID Connect). Les comptes LOCAUX
//             restent ouverts — c'est ce qui permet de se connecter avec le
//             compte d'administration déclaré ici (ADMIN_LOGIN/ADMIN_PASSWORD),
//             même quand l'annuaire est en panne, ou pour un poste qui n'y a pas
//             accès. Les deux portes coexistent : c'est le client qui les
//             propose toutes les deux (voir src/lib/auth.js).
// Voir src/server/mysql/comptes.mjs et src/server/README.md § « Comptes ».
const AUTH_MODE = env("AUTH_MODE", "demo").trim().toLowerCase();
// Les comptes LOCAUX (identifiant + mot de passe, session par cookie) sont
// ouverts dès que le mode n'est pas « demo ». En OIDC, l'annuaire s'ajoute à
// eux sans les remplacer : la session reste le moyen d'accéder aux données, et
// l'amorçage du compte d'administration garde tout son sens.
const COMPTES_LOCAUX = AUTH_MODE !== "demo";
// Le nom historique du réglage : « la porte est une session », et non un jeton.
const MOT_DE_PASSE = COMPTES_LOCAUX;
const ADMIN_LOGIN = env("ADMIN_LOGIN", "admin").trim();
const ADMIN_PASSWORD = env("ADMIN_PASSWORD", "");
const ADMIN_NOM = env("ADMIN_NOM", "Administrateur").trim();
const ADMIN_EMAIL = env("ADMIN_EMAIL", "").trim();
const ADMIN_ENTITY = env("ADMIN_ENTITY", "").trim();
const SESSION_DAYS = num("SESSION_DAYS", 12);
const MDP_MIN = num("MDP_MIN_LONGUEUR", 12);
const SCRYPT_N = num("SCRYPT_N", 65536);
// `Secure` sur les cookies : à laisser à true en production (HTTPS). Sur un
// essai en clair (http://serveur:8080), le navigateur refuserait le cookie.
// Lu par le registre (`OPTIONS_SERVICE`) : « false » (ou « 0 », « non »…) éteint
// le drapeau ; toute autre valeur posée le laisse allumé. Vide = allumé.
const COOKIE_SECURE = opt("COOKIE_SECURE") !== false;
// Les comptes de démonstration (choisis dans une liste, sans mot de passe).
// Par défaut : autorisés en mode « demo », éteints en mode « password ».
const DEMO_ACCOUNTS = opt("DEMO_ACCOUNTS") === undefined ? !MOT_DE_PASSE : opt("DEMO_ACCOUNTS");
// En mode « demo », DEMO_ACCOUNTS=false n'aurait aucun sens (plus personne ne
// pourrait entrer) : le jeu de démonstration reste autorisé, et on le dit.
const DEMO_EFFECTIF = MOT_DE_PASSE ? DEMO_ACCOUNTS : true;
// LE COMMUTATEUR DE DÉMONSTRATION (`DEMO`). Un seul réglage commande tout le jeu
// fictif : identité, entités, services, personnes, rôles, trames, actes, comptes
// et publications de démonstration. Éteint, l'outil est une page vierge — aucune
// donnée fictive, aucune mention de collectivité fictive (voir src/lib/demo.js,
// qui est le seul endroit où la question se tranche côté navigateur).
// À défaut de réglage explicite, le mode « demo » l'allume, et `DEMO_ACCOUNTS=true`
// aussi : c'est le sens historique de ces deux réglages, et rien ne doit changer
// pour une installation de démonstration existante. Le registre lit `DEMO`
// (« true »/« 1 »/« oui » l'allument, « false »/« 0 »/« non » l'éteignent).
const DEMO_BRUT = env("DEMO", "").trim();
const DEMO_JEU = opt("DEMO") === undefined ? (AUTH_MODE === "demo" || DEMO_ACCOUNTS) : opt("DEMO");
// Les collections qui portent l'IDENTITÉ et les RÉGLAGES ne sont écrites que par
// un administrateur : sinon un compte ordinaire pourrait se donner des droits.
const COLLECTIONS_ADMIN = new Set(["users", "config"]);
// Collections dont l'écriture demande au moins le rôle éditeur : les billets du
// recueil public (voir la permission « informations.gerer », src/lib/users.js).
const COLLECTIONS_EDITEUR = new Set(["informations"]);


const COLLECTIONS = ["config", "trames", "actes", "reprises", "users", "meta", "journal", "presence", "informations"];
// Collections qui ne sont pas recopiées dans le journal technique : elles sont
// elles-mêmes un flux (présence des postes, journal d'audit de l'application).
// Les y inscrire produirait un bruit continu sans valeur d'audit.
const SILENT_COLLECTIONS = new Set(["presence", "journal"]);

const DB = {
  host: env("DB_HOST", "127.0.0.1"),
  port: num("DB_PORT", 3306),
  user: env("DB_USER", "scriba"),
  password: env("DB_PASSWORD", ""),
  database: env("DB_NAME", "scriba"),
  socketPath: env("DB_SOCKET", "") || undefined,
  charset: "utf8mb4",
  connectionLimit: num("DB_POOL", 8),
  multipleStatements: false,
  // Les DATETIME sont écrits et relus en UTC. MySQL / MariaDB attend
  // « AAAA-MM-JJ hh:mm:ss[.fff] » et REFUSE la forme ISO de JavaScript
  // (« …T…Z ») : une date de session écrite telle quelle faisait échouer
  // l'INSERT, donc la connexion. Avec ce fuseau, un objet `Date` fait
  // l'aller-retour exactement, dans les deux sens.
  timezone: "Z",
};

// --- LE RANGEMENT (le « magasin ») -------------------------------------------
// Deux rangements, un seul contrat (voir magasin.mjs) :
//
//   mysql    (le défaut) tout dans MariaDB, comme depuis toujours ;
//   fichier  tout dans un DOSSIER — `DATA_DIR`, « ./data » par défaut — pour
//            une installation sans serveur de base de données. Les données y
//            sont EN CLAIR (sauf les empreintes de mots de passe), lisibles et
//            copiables ; une sauvegarde est une copie de dossier. Le magasin
//            FICHIER suppose UN service sur UNE machine (voir son en-tête).
//
// Le choix ne change RIEN au reste du service : c'est tout l'intérêt du contrat.
// Une valeur refusée par le registre (STOCKAGE=nimportequoi) n'est jamais
// appliquée : on retombe sur `mysql`, et le registre le signale au démarrage.
const STOCKAGE = String(opt("STOCKAGE") || "mysql").toLowerCase();
const DATA_DIR = String(opt("DATA_DIR") || "./data");
const magasin = STOCKAGE === "fichier"
  ? creerMagasinFichier({
    dossier: DATA_DIR,
    journal: (niveau, message) => (niveau === "avertissement" ? console.warn("[magasin] " + message) : console.log("[magasin] " + message)),
  })
  : await creerMagasinMysql({ DB });

// Rôles d'une clé d'API. Les quatre premiers forment une hiérarchie ; le
// `prestataire` est hors hiérarchie (notification de signature seulement).
const ROLES_CONNUES = ["administrateur", "editeur", "redacteur", "lecteur", "prestataire"];
const RANG_ROLE = { administrateur: 4, editeur: 3, redacteur: 2, lecteur: 1 };

// Jetons d'écriture : « libellé|rôle:empreinte_sha256 », « libellé:empreinte »
// ou « empreinte_sha256 ». Le rôle vaut « administrateur » à défaut : une clé de
// déploiement ouvre tout. Exemple : API_TOKENS="prestataire|prestataire:<hash>".
const TOKENS = env("API_TOKENS", "")
  .split(",").map((s) => s.trim()).filter(Boolean)
  .map((entry) => {
    const i = entry.lastIndexOf(":");
    const looksHashed = i > 0 && /^[0-9a-f]{64}$/i.test(entry.slice(i + 1));
    const tete = looksHashed ? entry.slice(0, i) : "jeton";
    const [label, role] = tete.split("|");
    return {
      label: label || "jeton",
      role: ROLES_CONNUES.includes(role) ? role : "administrateur",
      hash: (looksHashed ? entry.slice(i + 1) : entry).toLowerCase(),
    };
  })
  .filter((t) => /^[0-9a-f]{64}$/i.test(t.hash));

// Le rôle d'un compte : le plus fort de ses rôles.
const roleDeCompte = (compte) => {
  const roles = Array.isArray(compte && compte.roles) && compte.roles.length
    ? compte.roles
    : [compte && compte.role].filter(Boolean);
  return ROLES_CONNUES.find((r) => r !== "prestataire" && roles.includes(r)) || "lecteur";
};

const roleAutorise = (role, regle) => {
  if (!regle) return true;
  if (regle.exact) return regle.exact.includes(role);
  if (regle.min) return (RANG_ROLE[role] || 0) >= RANG_ROLE[regle.min];
  return true;
};

const sha256 = (s) => createHash("sha256").update(String(s), "utf8").digest("hex");

// ------------------------------------------------------------------ comptes
// Le port de cryptographie : c'est ICI — et dans `jws.mjs`, où vit la seule
// opération qui méritait son propre module pour être éprouvée avec de vraies
// clés — que le service touche à `node:crypto`. Le domaine (comptes.mjs) ne
// connaît que ces fonctions — ce qui le rend éprouvable sans base ni réseau
// (comptes.test.mjs).
const cryptoPort = {
  randomBytes: (n) => randomBytes(n),
  // `maxmem` : scrypt réclame 128·N·r octets ; on laisse de la marge.
  //
  // ASYNCHRONE, ET C'EST DÉLIBÉRÉ. `scryptSync` dérive le mot de passe SUR LE FIL
  // PRINCIPAL : pendant ~130 ms, le service ne répond plus à PERSONNE — pas même
  // aux visiteurs du recueil, qui n'ont pourtant pas de mot de passe à vérifier.
  // Une matinée où vingt agents se connectent ensemble gelait donc le service
  // deux secondes et demie, tout compris (mesuré : voir src/server/charge).
  // `scrypt` (asynchrone) fait le même travail sur le pool de fils de libuv : le
  // fil principal reste libre, et seules les connexions concurrentes attendent.
  // La taille du pool (`UV_THREADPOOL_SIZE`) décide de combien de dérivés
  // avancent en même temps — voir docs/ADMINISTRATION.md.
  scrypt: (mdp, sel, { N, r, p, keylen }) => new Promise((resoudre, rejeter) => {
    scrypt(String(mdp), Buffer.from(sel), keylen, { N, r, p, maxmem: 256 * N * r }, (err, cle) => {
      if (err) rejeter(err);
      else resoudre(new Uint8Array(cle));
    });
  }),
  sha256,
  b64: (octets) => Buffer.from(octets).toString("base64"),
  deb64: (texte) => new Uint8Array(Buffer.from(String(texte), "base64")),
  // Comparaison à TEMPS CONSTANT, pour les mots de passe comme pour les jetons.
  meme: (a, b) => {
    const x = typeof a === "string" ? Buffer.from(a, "utf8") : Buffer.from(a);
    const y = typeof b === "string" ? Buffer.from(b, "utf8") : Buffer.from(b);
    if (x.length !== y.length) return false;
    return x.length > 0 && timingSafeEqual(x, y);
  },
  // LA SIGNATURE D'UN JETON D'IDENTITÉ (voir annuaire-service.mjs, qui s'en
  // sert pour vérifier le jeton de l'annuaire). Elle est écrite dans `jws.mjs`,
  // un module à part, afin d'être éprouvée seule avec de vraies clés et de
  // vraies signatures (jws.test.mjs) — c'est la seule opération cryptographique
  // du service qui ne soit pas du mot de passe, et la seule dont l'échec serait
  // silencieux (une signature jamais vérifiée ne se voit nulle part).
  verifierJws,
};

// LE RÉSEAU VERS LE FOURNISSEUR D'IDENTITÉ. Un seul endroit du service parle à
// l'extérieur, et c'est ici : `httpJson(url, init)` → `{ ok, status, body,
// text }`. Le domaine (annuaire-service.mjs) ne connaît que ce contrat, ce qui
// le rend éprouvable avec un faux fournisseur, sans réseau.
//
// Le DÉLAI est borné : un fournisseur lent ne doit pas retenir une connexion
// ouverte jusqu'à l'abandon du navigateur — huit secondes, puis on rend la
// main à l'appelant, qui dit « fournisseur injoignable ». Le corps n'est
// interprété comme JSON que s'il en a l'air ; le texte brut est toujours
// rendu, car c'est lui qui porte le message d'erreur d'un fournisseur
// (`error_description`) et qui finit dans le journal.
const DELAI_ANNUAIRE_MS = 8 * 1000;
async function httpJson(url, init = {}) {
  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), DELAI_ANNUAIRE_MS);
  try {
    const reponse = await fetch(url, { ...init, signal: controleur.signal, redirect: "follow" });
    const texteBrut = await reponse.text();
    let corps = null;
    const type = String(reponse.headers.get("content-type") || "");
    if (texteBrut && (type.toLowerCase().includes("json") || /^\s*[{[]/.test(texteBrut))) {
      try { corps = JSON.parse(texteBrut); } catch (e) { corps = null; }
    }
    return { ok: reponse.ok, status: reponse.status, body: corps, text: texteBrut };
  } finally {
    clearTimeout(minuteur);
  }
}

const comptes = createComptes({
  store: magasin.store,
  crypto: cryptoPort,
  sessionJours: SESSION_DAYS,
  mdpMin: MDP_MIN,
  scryptParams: { N: SCRYPT_N, r: 8, p: 1 },
  demoAutorise: DEMO_EFFECTIF,
  sessionRequise: MOT_DE_PASSE,
  // L'ANNUAIRE DE LA COLLECTIVITÉ (voir annuaire-service.mjs). Le service est le
  // client OIDC : la découverte, l'échange du code, la vérification du jeton et
  // l'ouverture de la session se font ici, à l'abri du CORS. Ces trois
  // fermetures sont PARESSEUSES : les fonctions sont déclarées plus bas
  // (déclarations hissées), et rien n'est lu tant qu'une connexion d'annuaire
  // n'est pas tentée — un service qui n'emploie pas l'annuaire ne paie rien.
  lireAnnuaire: () => annuairePublie(),
  lireReferentiel: () => magasin.lireConfig().catch(() => null),
  httpJson,
  modeDeploiement: AUTH_MODE,
});

// ------------------------------------------------- le prestataire de signature
// Les réglages de l'API du prestataire (circuit électronique) : ceux du `.env`
// — les variables `SCRIBA_SIGNATURE_API_*` du registre, validées au démarrage —
// complétés par le référentiel, que le client transmet au moment d'ouvrir un
// circuit. La CLÉ, elle, n'existe qu'ici : elle est lue à la source et remise
// au seul module qui appelle le prestataire (signature.mjs). Elle n'est jamais
// journalisée, jamais transmise, jamais écrite au référentiel.
const apiOpt = (k) => OPTIONS.valeurs["signature.api." + k];
const SIGNATURE_API = {
  transport: apiOpt("transport") || "service",
  url: apiOpt("url") || "",
  prestataire: apiOpt("prestataire") || "esup-signature",
  niveau: apiOpt("niveau") || "avancee",
  urlNotification: apiOpt("urlNotification") || "",
  timeoutMs: apiOpt("timeoutMs") || 20000,
  cheminDocument: apiOpt("cheminDocument") || "/documents",
  cheminSignataires: apiOpt("cheminSignataires") || "/documents/{document}/signataires",
  cheminDemarrer: apiOpt("cheminDemarrer") || "/documents/{document}/demarrer",
  cheminStatut: apiOpt("cheminStatut") || "/documents/{document}",
};
const prestataireSignature = createPrestataire({
  api: SIGNATURE_API,
  cle: env("SCRIBA_SIGNATURE_API_CLE"),
  // Une ligne par appel sortant : de quoi relire, dans les journaux du service,
  // ce qui a été demandé au prestataire, et quand. Jamais le corps, jamais la clé.
  journal: (e) => console.log("[prestataire]", JSON.stringify(e)),
});

// La session d'une requête HTTP (mode « mot de passe »), ou null. Toute la
// vérification — expiration, compte désactivé, compte de démonstration — vit
// dans `comptes.mjs` : le serveur HTTP ne fait que transporter le cookie.
async function sessionHTTP(req) {
  if (!MOT_DE_PASSE) return null;
  try { return await comptes.compteDeSession(comptes.jetonDeSession(req)); }
  catch (e) { console.error("[session]", e.message); return null; }
}

const refusSession = () => ({ status: 401, headers: {}, body: err("Connexion requise : ouvrez une session (identifiant et mot de passe).", { code: "session_absente" }) });
const refusCsrf = () => ({ status: 403, headers: {}, body: err("Jeton anti-CSRF absent ou incorrect : rechargez la page, puis réessayez.", { code: "csrf_invalide" }) });

// -------------------------------------------------- état de santé du service
// Ce que l'écran de connexion doit pouvoir montrer AVANT toute session, plutôt
// que de laisser l'agent devant « Identifiant ou mot de passe incorrect » (le
// cas d'un ADMIN_PASSWORD refusé) ou devant un écran vide (base injoignable).
// `GET /v1/auth/config` le transporte ; c'est le seul endroit qui expose l'état
// du DÉPLOIEMENT (et non celui du référentiel).
const etatService = {
  //   true  un compte d'administration peut ouvrir une session : il existe et
  //         porte un mot de passe ;
  //   false l'amorçage a été refusé (ADMIN_PASSWORD non conforme, absent,
  //         ADMIN_LOGIN vide…) : le motif accompagne.
  adminAmorce: null,     // null = pas encore tenté (ou mode « demo » : sans objet)
  adminMotif: "",
  adminAvertissement: "",
  // L'échec de l'amorçage est-il une PANNE (référentiel des comptes injoignable)
  // plutôt qu'un refus de configuration ? Les deux ne se réparent pas au même
  // endroit : l'écran de connexion ne doit pas annoncer « aucun compte
  // d'administration installé » — l'agent croirait son ADMIN_PASSWORD en cause,
  // alors que c'est la base qu'il faut réparer (schéma non appliqué, par
  // exemple). Voir src/ui/mot-de-passe.js.
  adminPanne: false,
  // La base répond-elle ? Tant qu'on ne l'a pas éprouvée, on se tait.
  baseDisponible: null,  // null = inconnu ; true/false ensuite
  baseMessage: "",
};

// L'ÉTAT DE LA BASE EST RÉÉPROUVÉ À LA DEMANDE. Un verdict de démarrage n'est pas
// un verdict éternel : sans cette réépreuve, une panne RÉPARÉE (compte aligné par
// « docker compose run --rm db-init », dossier de données recréé) laissait à
// l'écran le bandeau « base indisponible » — et, `AUTO_MIGRATE` ne courant qu'au
// démarrage, laissait aussi la base SANS TABLES, jusqu'à ce qu'on recrée le
// conteneur du service. C'est exactement la panne que ce bandeau conseillait de
// réparer sans recréer quoi que ce soit : on va donc jusqu'au bout. Voir
// `reevaluerBase`.
//
// Le délai borne les réépreuves : un écran de connexion qui se recharge, ou
// plusieurs postes derrière la même panne, ne déclenchent pas une connexion à la
// base par requête. Cinq secondes laissent le temps à l'exploitant de réparer et
// de recharger son écran sans attendre.
const REESSAI_BASE_MS = 5000;
let reessaiBaseAt = 0;

// Enregistre la disponibilité de la base, avec le remède adapté à l'erreur
// (identifiants refusés, base absent, schéma non migré…). Le client s'en sert
// pour afficher un bandeau au lieu d'écrans vides.
function noterBase(disponible, message = "", e = null) {
  etatService.baseDisponible = !!disponible;
  etatService.baseMessage = disponible ? "" : String(message || (e && e.message) || "");
  etatService.baseRemede = disponible ? "" : remedeBase(e && e.code, e);
}

// Le remède DIT le geste à faire, et dans le bon ordre — il dépend du RANGEMENT.
// MariaDB : un schéma absent s'applique SANS RIEN EFFACER (`schema.sql` est
// idempotent — et la pile Compose l'applique d'elle-même au démarrage) ; l'effacement
// du dossier de données (« docker compose down -v ») n'est proposé que pour les
// identifiants du compte applicatif, qui, eux, ne se corrigent pas après coup.
// FICHIERS : il n'y a ni compte ni schéma — seulement un dossier à rendre
// accessible en écriture. Confondre les deux ferait perdre les données d'un
// service en marche.
function remedeBase(code, e = null) {
  if (magasin.type === "fichier") return remedeFichier(code);
  if (code === "ER_ACCESS_DENIED_ERROR" || code === "ER_ACCESS_DENIED_NO_PASSWORD_ERROR") {
    return "La base refuse les identifiants du service. Le compte applicatif et son mot de passe sont inscrits au PREMIER démarrage de la base : si DB_PASSWORD a changé depuis, la base garde l'ancien — c'est la cause la plus fréquente. Alignez le compte sur le .env (« docker compose run --rm db-init », ou « node server.mjs --reconcilier ») : ce seul geste remet aussi le SCHÉMA, et le service se rétablit de lui-même, sans être recréé. Si l'alignement échoue à son tour, c'est le mot de passe ROOT qui n'est plus celui du dossier de données — « docker compose logs db-init » le dit ; ne recréez alors le dossier de données (« docker compose down -v ») qu'en dernier recours : il efface les données.";
  }
  if (CONNEXION_PERDUE.has(code)) {
    return "Le service n'atteint pas la base : vérifiez DB_HOST / DB_PORT (et, sous Docker, que le service de base tourne — « docker compose ps », « docker compose logs db »).";
  }
  if (code === "ER_BAD_DB_ERROR" || code === "ER_NO_DB_ERROR") {
    return `La base « ${DB.database} » n'existe pas : créez-la, ou posez DB_NAME sur une base existante (sous Docker, c'est MARIADB_DATABASE qui la crée au premier démarrage).`;
  }
  if (code === "ER_NO_SUCH_TABLE") {
    return "La base répond, mais le SCHÉMA n'y est pas appliqué : les tables manquent. Le geste qui répare les deux pannes d'un coup : « docker compose run --rm db-init » — il aligne le compte ET applique le schéma — et le service se recharge alors de lui-même, sans être recréé. Sans Docker : « node server.mjs --migrate », puis « docker compose up -d --force-recreate api » (le compte d'administration du .env n'est installé qu'au démarrage, et « docker compose restart » ne relit PAS le .env). Rien n'est effacé.";
  }
  return "Vérifiez la configuration DB_* / MARIADB_* du .env, puis « node server.mjs --migrate » pour appliquer le schéma (cette commande ne supprime rien), ou « docker compose down -v && docker compose up -d --build » pour rejouer schéma et amorçage sur un dossier de données vierge — au prix des données.";
}

// Le remède du rangement par FICHIERS : ni compte, ni schéma — un dossier.
// Le geste est de rendre `DATA_DIR` accessible en écriture au compte du service.
function remedeFichier(code) {
  if (code === "EACCES" || code === "EPERM") {
    return `Le service n'a pas le droit d'écrire dans le dossier de données (${DATA_DIR}). Donnez-lui ce droit (propriétaire ou droits du dossier), ou posez DATA_DIR sur un dossier accessible en écriture par le compte du service.`;
  }
  if (code === "EROFS") return `Le dossier de données (${DATA_DIR}) est sur un système de fichiers en lecture seule : le service ne peut pas y écrire.`;
  if (code === "ENOTDIR" || code === "EISDIR") return `DATA_DIR (${DATA_DIR}) ne désigne pas un dossier utilisable. Corrigez la variable dans le .env.`;
  return `Vérifiez DATA_DIR (${DATA_DIR}) : le dossier de données doit pouvoir être créé, et accessible en écriture par le compte du service. Sous Docker, il est monté par le fichier docker-compose.fichier.yml.`;
}

// Les erreurs de LIAISON : elles ne se corrigent pas en appliquant le schéma,
// et le dire évite d'envoyer l'exploitant migrer une base qu'il n'atteint pas.
const CONNEXION_PERDUE = new Set([
  "ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "EHOSTUNREACH", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST",
]);

// Les erreurs qui disent « la base n'est pas là » (et non « cette requête a
// échoué »). Elles font basculer l'état du service, pour que l'écran le montre,
// au lieu de laisser un écran vide ou un message de repli trompeur.
const CODES_BASE_INDISPONIBLE = new Set([
  "ECONNREFUSED", "PROTOCOL_CONNECTION_LOST", "ETIMEDOUT", "ENOTFOUND", "EHOSTUNREACH",
  "ER_ACCESS_DENIED_ERROR", "ER_ACCESS_DENIED_NO_PASSWORD_ERROR", "ER_BAD_DB_ERROR",
  "ER_NO_SUCH_TABLE", "ER_NO_DB_ERROR",
]);
function noterBaseSelonErreur(e) {
  if (e && e.code && CODES_BASE_INDISPONIBLE.has(e.code)) noterBase(false, e.message, e);
}


// ------------------------------------------------------------------- réponses
function corsHeaders(req) {
  const origin = req.headers.origin || "";
  const wildcard = CORS_ORIGINS.includes("*");
  const allow = wildcard ? "*" : (CORS_ORIGINS.includes(origin) ? origin : "");
  return {
    // Pas d'en-tête `access-control-allow-origin` quand l'origine n'est pas
    // autorisée : le navigateur bloque alors la réponse (le défaut « null »
    // laissait passer un appel depuis un site tiers).
    ...(allow ? { "access-control-allow-origin": allow } : {}),
    // « Autoriser l'envoi des cookies » : sans cet en-tête, le navigateur
    // REFUSE la réponse à une requête en `credentials: "include"` — c'est le cas
    // de TOUTES les écritures en mode « mot de passe », où la session vit dans
    // un cookie. Une application servie par une autre origine que le service
    // (une « Adresse du service de données » distincte) n'aurait alors aucun
    // accès : ses écritures étaient rangées en attente comme si le service était
    // injoignable (« Serveur de données injoignable »), et l'exploitant
    // cherchait une panne réseau qui n'existait pas. Avec `*`, on ne le pose PAS
    // (la spécification l'interdit : le navigateur rejetterait la réponse), et
    // `*` n'a de toute façon pas à transporter de session.
    ...(allow && !wildcard ? { "access-control-allow-credentials": "true" } : {}),
    // `DELETE` sert à retirer le mot de passe d'un compte.
    "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
    // `x-csrf-token` est l'en-tête que TOUTE écriture porte : non déclaré ici, le
    // contrôle préalable (OPTIONS) échoue, et la requête n'atteint jamais le
    // service — un refus muet de plus, côté navigateur celui-là.
    "access-control-allow-headers": "content-type, authorization, idempotency-key, x-csrf-token",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

function send(req, res, status, body, extra = {}) {
  // Le corps peut être une chaîne : certaines routes publiques servent du texte
  // (robots.txt, llms.txt), du XML ou du HTML, pas du JSON.
  const payload = body === null || body === undefined ? "" : (typeof body === "string" ? body : JSON.stringify(body));
  const entetes = entetesSurs({
    "content-type": "application/json; charset=utf-8",
    "x-service": SERVICE_ID,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    ...corsHeaders(req),
    ...extra,
  });
  // Un en-tête refusé ne doit JAMAIS abattre le service : `ecrireEntetes` se
  // rabat sur un jeu minimal (voir entetes.mjs, et sa mise en cause en tête).
  ecrireEntetes(res, status, entetes);
  if (!res.writableEnded) res.end(payload);
}

const err = (message, extra) => ({ erreur: message, ...(extra || {}) });

// --------------------------------------------------------------- limitations
const counters = new Map();
function tooMany(key, max, windowMs) {
  const now = Date.now();
  let e = counters.get(key);
  if (!e || now - e.t > windowMs) { e = { t: now, n: 0 }; counters.set(key, e); }
  e.n += 1;
  if (counters.size > 5000) for (const [k, v] of counters) if (now - v.t > windowMs) counters.delete(k);
  return e.n > max;
}

function authenticate(req) {
  if (!TOKENS.length) {
    return { ok: false, status: 503, message: "Le service n'a aucun jeton configuré : renseignez API_TOKENS avant d'autoriser les écritures.", code: "jeton_non_configure" };
  }
  const raw = String(req.headers.authorization || "").trim();
  const m = /^Bearer\s+(.+)$/.exec(raw);
  if (!m) return { ok: false, status: 401, message: "Jeton d'API absent. Ajoutez l'en-tête « Authorization: Bearer <jeton> ».", code: "jeton_absent" };
  const got = Buffer.from(sha256(m[1]), "hex");
  for (const t of TOKENS) {
    const want = Buffer.from(t.hash, "hex");
    if (want.length === got.length && timingSafeEqual(want, got)) return { ok: true, label: t.label, role: t.role };
  }
  return { ok: false, status: 403, message: "Jeton d'API invalide.", code: "jeton_invalide" };
}

// Le jeton porté par l'en-tête `Authorization: Bearer …`, ou "".
const jetonBearer = (req) => {
  const m = /^Bearer\s+(.+)$/.exec(String(req.headers.authorization || "").trim());
  return m ? m[1].trim() : "";
};

// ------------------------------------------------------------------- clés d'API
// Les COMPTES DE SERVICE de l'API : un administrateur crée une clé dans
// l'interface, lui donne un rôle, et la remet à un script, un poste ou un outil
// tiers. Ces clés n'existent que pour l'API — ce ne sont pas des comptes du
// référentiel, et elles n'apparaissent donc nulle part dans les interfaces
// (Comptes et rôles, personnes, annuaire). Le domaine signature/publication les
// gère (actes.mjs) : ici, on ne fait que les INTERROGER pour autoriser.

// L'identité portée par une clé : celle du déploiement (`API_TOKENS`), ou une
// clé d'API créée dans l'administration. `null` si aucune ne correspond.
function cleValide(req) {
  const token = jetonBearer(req);
  if (!token) return null;
  const a = authenticate(req);
  if (a.ok) return { role: a.role, label: a.label, parCle: true };
  const k = api && typeof api.cleDeJeton === "function" ? api.cleDeJeton(token) : null;
  return k ? { role: k.role, label: k.label || k.id, parCle: true, cleId: k.id } : null;
}

// La règle de rôle, appliquée à une identité : `null` si elle passe, sinon le
// refus à rendre.
function roleRefuse(role, regle) {
  if (roleAutorise(role, regle)) return null;
  return { status: 403, headers: {}, body: err("Rôle insuffisant pour cette opération (rôle : « " + role + " »).", { code: "role_insuffisant", role }) };
}

// L'autorisation d'une route, telle que la reçoit le domaine : une SESSION
// (mode « mot de passe »), ou une CLÉ — du déploiement ou de l'administration.
function autoriser(req, session, regle) {
  if (MOT_DE_PASSE && session) {
    // Le jeton anti-CSRF ne concerne que les requêtes menées par un COOKIE : une
    // clé d'API ne s'accompagne pas d'un cookie, et n'a donc rien à prouver de
    // ce côté.
    if (comptes.csrfObligatoire(req) && !comptes.csrfValide(req)) return refusCsrf();
    return roleRefuse(roleDeCompte(session.compte), regle);
  }
  const id = cleValide(req);
  if (!id) {
    return MOT_DE_PASSE
      ? refusSession()
      : { status: 401, headers: {}, body: err("Jeton d'API absent ou invalide. Ajoutez l'en-tête « Authorization: Bearer <jeton> ».", { code: "jeton_absent" }) };
  }
  return roleRefuse(id.role, regle);
}

// La requête porte-t-elle l'identité d'un AGENT (session, ou clé de service) ?
// C'est ce qui décide si les publications à diffusion restreinte sont servies.
//
// Être connecté ne suffit PAS : quand l'accès à l'atelier est restreint à
// certaines adresses, un agent qui se connecte depuis ailleurs (télétravail,
// réseau mobile) reste un lecteur du recueil public — il ne reçoit pas les
// circulaires internes. C'est la règle demandée : « les actes réservés
// s'affichent sur l'accès public comme les autres pour les personnes
// authentifiées ET venant d'une adresse autorisée ».
async function estAgent(req) {
  const identifie = (MOT_DE_PASSE && !!(await sessionHTTP(req))) || !!cleValide(req);
  if (!identifie) return false;
  const etat = await etatDeLAtelier(ipOf(req));
  return etat.actif ? etat.autorise : true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > MAX_BODY) { reject(Object.assign(new Error("Corps trop volumineux"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// L'adresse de l'appelant, normalisée (`::ffff:10.0.0.1` devient `10.0.0.1` :
// une pile double annonce l'une ou l'autre forme pour la même adresse, et une
// liste blanche écrite en IPv4 doit reconnaître les deux).
const ipOf = (req) => adresseDeLEntete(req.headers, req.socket && req.socket.remoteAddress);

// Le corps d'une requête, selon ce que le client ANNONCE. L'API parle JSON ;
// les formulaires du recueil parlent `application/x-www-form-urlencoded` — un
// abonnement au Bulletin doit pouvoir se faire sans JavaScript, donc avec un
// vrai formulaire, dont le corps n'est pas du JSON. Une seule lecture, deux
// formats : les routes en aval reçoivent toujours un objet.
function corpsDeRequete(raw, contentType = "") {
  const texte = String(raw || "");
  if (!texte) return {};
  const type = String(contentType).split(";")[0].trim().toLowerCase();
  if (type === "application/x-www-form-urlencoded") {
    const o = {};
    for (const [k, v] of new URLSearchParams(texte)) o[k] = v;
    return o;
  }
  return JSON.parse(texte);
}

// L'origine PUBLIQUE telle que le visiteur l'a demandée : les pages du recueil
// (et les liens qu'elles portent) doivent être justes quel que soit le domaine
// du déploiement. `SCRIBA_PUBLIQUE_URL` l'emporte quand il est déclaré : c'est
// l'adresse que le service emploie pour les courriels et le flux, où il n'a
// aucune requête sous les yeux.
function originePublique(req) {
  if (PUBLIQUE_URL) return PUBLIQUE_URL;
  const h = (req && req.headers) || {};
  const host = String(h["x-forwarded-host"] || h.host || "").split(",")[0].trim();
  if (!host) return "";
  const proto = String(h["x-forwarded-proto"] || "").split(",")[0].trim()
    || (/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ? "http" : "https");
  return proto + "://" + host;
}

// ------------------------------------------------------ l'accès à l'atelier
// La restriction d'accès est une décision de SERVICE, et elle se prend ici :
// c'est le seul endroit qui voit l'adresse réelle de l'appelant, et un
// navigateur ne peut pas décider de son propre droit d'entrer.
//
// La liste vient de deux endroits, dans cet ordre : la variable de déploiement
// `SCRIBA_ATELIER_IPS` (portée référentiel), puis le référentiel enregistré
// (`publication.atelier.ips`, réglé dans Administration › Accès à l'atelier).
// Le `.env` l'emporte : c'est lui qui survit à une remise à zéro du référentiel,
// et le seul qu'un exploitant puisse poser AVANT la première connexion.
//
// Le référentiel est relu au plus une fois toutes les dix secondes : la décision
// d'accès ne doit pas coûter une requête à chaque appel d'API, mais elle doit
// suivre un changement de réglage sans qu'il faille redémarrer le service.
const ATELIER_CACHE_MS = 10 * 1000;
let atelierRefCache = { valeur: undefined, at: 0 };

async function ipsAtelierReferentiel() {
  if (atelierRefCache.valeur !== undefined && Date.now() - atelierRefCache.at < ATELIER_CACHE_MS) return atelierRefCache.valeur;
  let liste;
  try {
    const doc = await magasin.lireConfig();
    liste = doc && doc.publication && doc.publication.atelier ? doc.publication.atelier.ips : undefined;
  } catch (e) {
    liste = undefined;
  }
  atelierRefCache = { valeur: liste, at: Date.now() };
  return liste;
}
const oublierIpsAtelier = () => { atelierRefCache = { valeur: undefined, at: 0 }; };

// L'état de l'accès pour une adresse (l'appelant, ou une adresse simulée par
// l'écran d'administration).
async function etatDeLAtelier(ip, { simulation = false } = {}) {
  const e = etatAtelier({
    ip,
    ipsDeploiement: OPTIONS.valeurs[CLE_IPS],
    ipsReferentiel: await ipsAtelierReferentiel(),
    message: OPTIONS.valeurs[CLE_MESSAGE],
  });
  return simulation ? { ...e, simulation: true } : e;
}

// Les routes qui appartiennent à l'ATELIER : hors réseau autorisé, elles
// répondent 403. Les routes PUBLIQUES (recueil, publications, résolution ELI,
// santé, configuration du service, état de l'accès) ne passent jamais par cette
// porte : un visiteur extérieur doit pouvoir lire le recueil.
const ATELIER_PUBLIC = new Set(["/v1/config", "/v1/health", "/v1/db/health", "/v1/atelier/acces", "/v1/auth/config"]);
const estRouteAtelier = (pathname) => {
  if (ATELIER_PUBLIC.has(pathname)) return false;
  if (/^\/v1\/db(\/|$)/.test(pathname)) return true;
  if (/^\/v1\/atelier(\/|$)/.test(pathname)) return true;
  if (/^\/v1\/journal(\/|$)/.test(pathname)) return true;
  if (/^\/v1\/(actes|signatures|auth|comptes|courriel|admin)(\/|$)/.test(pathname)) return true;
  return false;
};

// ------------------------------------------------------------------ écritures
// L'écriture d'une collection : contrôle d'autorisation, bornes, puis le
// MAGASIN (magasin.mjs, `synchroniser`). L'algorithme — révisions, conflits,
// journal — est commun aux deux rangements ; ce qui reste ICI est ce qui ne
// dépend pas du rangement : qui a le droit d'écrire quoi.
async function sync(collection, body, actor, ip, estAdmin = false) {
  const upserts = Array.isArray(body.upserts) ? body.upserts : [];
  const deletes = Array.isArray(body.deletes) ? body.deletes : [];
  const force = !!body.force;
  // `force` écrase sans contrôle de révision : geste de reprise réservé à
  // l'administration. Voir NC-II-004 (résidu) et P-17.
  if (force && !estAdmin) {
    return { status: 403, body: err("L'écrasement sans contrôle de révision (`force`) est réservé à l'administrateur.", { code: "force_reserve_admin" }) };
  }
  if (upserts.length + deletes.length > MAX_SYNC_RECORDS) {
    return { status: 413, body: err(`Trop d'enregistrements dans une même synchronisation (maximum ${MAX_SYNC_RECORDS}).`, { code: "trop_d_enregistrements" }) };
  }
  const r = await magasin.synchroniser({
    collection, upserts, deletes, force, actor, ip,
    trace: !SILENT_COLLECTIONS.has(collection),
  });
  return { status: 200, body: { collection, revision: r.revision, applied: r.applied, conflicts: r.conflicts } };
}

// --------------------------------------------------------------------- santé
// « Le rangement est-il joignable ? » — la question est la même pour les deux
// magasins, la réponse aussi (`sante()` LÈVE si le rangement est injoignable :
// c'est ici, et chez l'appelant, que l'erreur devient un bandeau et un remède).
async function health() {
  const s = await magasin.sante();
  const byName = s.collections || {};
  for (const name of COLLECTIONS) if (!byName[name]) byName[name] = { records: 0, revision: 0 };
  return {
    statut: "ok",
    service: SERVICE,
    version: SERVICE_VERSION,
    driver: magasin.resume.driver,
    partagee: magasin.resume.partagee,
    base: { ...magasin.resume.base, moteur: s.moteur },
    message: magasin.resume.message,
    collections: byName,
  };
}

// ------------------------------------------------------------------ OpenAPI
function dbPaths() {
  const garde = MOT_DE_PASSE
    ? "En mode « mot de passe » (AUTH_MODE=password), les lectures comme les écritures exigent une session ouverte par /v1/auth/connexion ; les collections `users` et `config` ne sont écrites que par un administrateur."
    : "Les lectures sont publiques ; les écritures exigent un jeton d'API (Authorization: Bearer).";
  return {
    "/v1/db/health": { get: { operationId: "santeBase", summary: "État de la base de données", description: "Donne le pilote de persistance et le nombre d'enregistrements par collection (référentiel, trames, actes, comptes, métadonnées).", tags: ["Base de données"], responses: { 200: { description: "Base disponible" } } } },
    "/v1/db/collections/{collection}": { get: { operationId: "lireCollection", summary: "Lire une collection", description: `Renvoie tous les enregistrements d'une collection, chacun avec sa révision. ${garde}`, tags: ["Base de données"], parameters: [{ name: "collection", in: "path", required: true, schema: { type: "string", enum: COLLECTIONS } }], responses: { 200: { description: "Les enregistrements de la collection" }, 401: { description: "Session absente (mode mot de passe)" }, 404: { description: "Collection inconnue" } } } },
    "/v1/db/collections/{collection}/sync": { post: { operationId: "synchroniserCollection", summary: "Synchroniser une collection", description: `Applique des écritures et des suppressions enregistrement par enregistrement. Chaque écriture porte la révision connue du client : si le serveur en détient une autre, l'enregistrement est renvoyé en conflit au lieu d'être écrasé. ${garde}`, security: [{ bearerAuth: [] }], tags: ["Base de données"], parameters: [{ name: "collection", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { upserts: { type: "array", items: { type: "object" } }, deletes: { type: "array", items: { type: "object" } }, force: { type: "boolean", description: "Écrase sans contrôle de révision (reprise de données). Réservé à l'administrateur : toute autre clé ou session reçoit 403 `force_reserve_admin`." } } } } } }, responses: { 200: { description: "Synchronisation appliquée (avec la liste des conflits éventuels)" }, 401: { description: "Session ou jeton absent" }, 403: { description: "Session, jeton ou rôle insuffisant (ou `force` sans le rôle administrateur)" }, 413: { description: "Trop d'enregistrements" }, 507: { description: "Base pleine" } } } },
  };
}

// Le contrat des comptes, tel qu'il apparaît dans la description du service.
function authPaths() {
  const gardeSession = { 401: { description: "Session absente ou expirée" } };
  return {
    "/v1/auth/config": { get: { operationId: "modeAuthentification", summary: "Mode d'authentification du service", description: "Rend `{ auth: \"demo\" | \"password\", demo: booléen, demoJeu: booléen, motDePasseMin, sessionJours }` — et, quand le raccourci de démonstration est ouvert, la liste `demoComptes` (identifiant, nom, rôle) dont l'écran de connexion a besoin avant toute session. Le navigateur s'en sert au démarrage : c'est le déploiement (`.env`) qui décide, et non le référentiel de l'application. `demoJeu` est LE COMMUTATEUR DE DÉMONSTRATION (`DEMO` du .env) : allumé, le jeu fictif est installé ; éteint, l'outil est une page vierge (voir src/lib/demo.js). Il porte en outre l'état du déploiement, pour que l'écran de connexion montre un motif au lieu d'« Identifiant ou mot de passe incorrect » : `adminAmorce` (un compte d'administration peut-il se connecter ?), `adminMotif`, `adminPanne` (cet échec est-il une panne de la base, et non un refus de configuration ?), `adminAvertissement`, `baseDisponible`, `baseMessage` et `baseRemede`. Il publie enfin les RÉGLAGES DE L'ANNUAIRE (`annuaire`) et le drapeau `annuaireService` : le service sait-il ouvrir une session d'annuaire ? C'est lui, et non le navigateur, qui décide si la seconde porte est proposée (voir `annuaireFermePour`, src/lib/auth.js).", tags: ["Comptes"], responses: { 200: { description: "Mode du service et état du déploiement" } } } },
    "/v1/auth/connexion": { post: { operationId: "connexion", summary: "Ouvrir une session", description: "Vérifie l'identifiant et le mot de passe, puis pose deux cookies : la session (`HttpOnly`) et le jeton anti-CSRF. Message identique pour un identifiant inconnu et un mot de passe faux ; le compte se bloque progressivement après plusieurs échecs (429).", tags: ["Comptes"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["login", "motDePasse"], properties: { login: { type: "string" }, motDePasse: { type: "string", format: "password" } } } } } }, responses: { 200: { description: "Session ouverte" }, 401: { description: "Identifiants invalides" }, 429: { description: "Compte bloqué quelques instants" } } } },
    "/v1/auth/annuaire": { post: { operationId: "connexionAnnuaire", summary: "Ouvrir une session par l'annuaire de la collectivité", description: "Le SERVICE est le client OIDC : il découvre le fournisseur, échange le code d'autorisation (avec le vérificateur PKCE que le navigateur a gardé), vérifie le jeton d'identité (signature par le JWKS du fournisseur, émetteur, audience, validité, nonce), en tire un compte (groupes → rôle, services et entité), l'écrit au référentiel, puis ouvre SA session — les mêmes cookies que la connexion locale. Aucun appel ne part du navigateur vers le fournisseur : le fournisseur n'a donc pas besoin d'autoriser le CORS, et c'est le remède à « Découverte impossible (Failed to fetch) ». Corps : code, verifier, redirectUri, nonce. Réponses : 200 (session ouverte ; checks et warnings disent ce qui a été vérifié), 401 (code invalide ou fournisseur injoignable), 403 (jeton refusé ou compte inconnu), 404 (annuaire non branché), 503 (le service n'a pas le moyen d'appeler un fournisseur).", tags: ["Comptes"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["code", "verifier"], properties: { code: { type: "string" }, verifier: { type: "string", description: "Le vérificateur PKCE (code_verifier) tiré par le navigateur." }, redirectUri: { type: "string" }, nonce: { type: "string" } } } } } }, responses: { 200: { description: "Session ouverte (le compte est rendu, avec les contrôles effectués)" }, 401: { description: "Code invalide ou fournisseur injoignable" }, 403: { description: "Jeton refusé ou compte inconnu" }, 404: { description: "Aucun annuaire branché sur ce service" }, 503: { description: "Le service n'a pas le moyen d'appeler un fournisseur" } } } },
    "/v1/auth/annuaire/decouverte": { post: { operationId: "decouvrirAnnuaire", summary: "Éprouver l'annuaire (bouton « Découverte »)", description: "Le SERVICE lit /.well-known/openid-configuration chez le fournisseur et rend les points de terminaison (authorization_endpoint, token_endpoint, jwks_uri, userinfo_endpoint). C'est le bouton « Découverte » de l'administration : l'appel partant du service et non du navigateur, un fournisseur sans en-têtes CORS (Keycloak, LemonLDAP, ADFS…) se branche comme les autres. Un administrateur peut faire éprouver l'adresse qu'il vient de saisir (issuer) et des points de terminaison saisis à la main (endpoints) ; les autres appelants n'obtiennent que ce que le service a déjà enregistré.", tags: ["Comptes"], requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { issuer: { type: "string", description: "Adresse du fournisseur à éprouver (administrateur)." }, endpoints: { type: "object", description: "Points de terminaison saisis à la main (authorization, token, jwks, userinfo) — ils l'emportent sur la découverte." } } } } } }, responses: { 200: { description: "Les points de terminaison retenus, et leur source (découverte ou manuel)" }, 404: { description: "Aucun annuaire branché" }, 502: { description: "Découverte impossible (fournisseur injoignable, document incomplet)" }, 503: { description: "Le service n'a pas le moyen d'appeler un fournisseur" } } } },
    "/v1/auth/session": { get: { operationId: "sessionCourante", summary: "Session courante", description: "Rend le compte de la session ouverte, ou 401.", tags: ["Comptes"], responses: { 200: { description: "Compte de la session" }, ...gardeSession } } },
    "/v1/auth/deconnexion": { post: { operationId: "deconnexion", summary: "Fermer la session", description: "Efface la session en base et les cookies.", tags: ["Comptes"], responses: { 200: { description: "Session fermée" }, ...gardeSession } } },
    "/v1/auth/mot-de-passe": { post: { operationId: "changerMotDePasse", summary: "Changer son mot de passe", description: "Exige le mot de passe actuel. Les autres sessions ne sont pas fermées (aucune session n'est privilégiée par rapport à une autre).", tags: ["Comptes"], responses: { 200: { description: "Mot de passe changé" }, 400: { description: "Mot de passe actuel incorrect" }, 422: { description: "Nouveau mot de passe trop faible" }, ...gardeSession } } },
    "/v1/auth/comptes": { get: { operationId: "etatComptes", summary: "État des mots de passe", description: "Pour chaque compte : mot de passe défini ou non, changement exigé, date, échecs, blocage. **Aucun dérivé n'est renvoyé.** Réservé au rôle administrateur.", tags: ["Comptes"], responses: { 200: { description: "État des comptes" }, 403: { description: "Rôle administrateur requis" }, ...gardeSession } } },
    // --- clés d'API (comptes de service) et journal du service ---------------
    "/v1/auth/etat": { get: { operationId: "etatAutorisation", summary: "État de l'autorisation du service", description: "Route PUBLIQUE : dit si le service est administrable (`provisionne`), quels rôles existent, et par quel mode (`session` quand l'administration se fait par une session — mode « mot de passe » ou annuaire —, `service` quand il faut la première clé).", tags: ["Autorisation"], responses: { 200: { description: "État de l'autorisation" } } } },
    "/v1/auth/bootstrap": { post: { operationId: "provisionnerService", summary: "Provisionner le service (dépôt de la première clé)", description: "Geste d'installation : dépose la PREMIÈRE clé d'administration, quand le service n'en a aucune. La valeur est tirée par le client ; le service n'en conserve que l'empreinte SHA-256. Un service déjà pourvu refuse (409 `service_deja_provisionne`).", tags: ["Autorisation"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["cle"], properties: { cle: { type: "string", minLength: 32 }, role: { type: "string", default: "administrateur" }, label: { type: "string" } } } } } }, responses: { 201: { description: "Service provisionné" }, 409: { description: "Service déjà provisionné (code `service_deja_provisionne`)" }, 422: { description: "Clé trop courte (code `cle_trop_courte`)" } } } },
    "/v1/auth/cles": {
      get: { operationId: "listerCles", summary: "Lister les clés d'API (comptes de service)", description: "Rend les clés connues du service — identifiant, libellé, rôle, date de création —, jamais leur valeur ni leur empreinte. Ce ne sont PAS des comptes du référentiel : elles n'apparaissent nulle part dans « Comptes et rôles », ni dans les personnes, ni dans l'annuaire. Réservé à l'administration (session, ou clé de rôle administrateur).", security: [{ bearerAuth: [] }], tags: ["Autorisation"], responses: { 200: { description: "Les clés connues" }, 403: { description: "Rôle administrateur requis" } } },
      post: { operationId: "creerCle", summary: "Créer une clé d'API (compte de service)", description: "Crée une clé rattachée à un rôle (`lecteur`, `redacteur`, `editeur`, `administrateur`, ou `prestataire` pour la seule notification de signature). C'est le client qui tire la valeur et n'en transmet que l'empreinte. Réservé à l'administration.", security: [{ bearerAuth: [] }], tags: ["Autorisation"], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["cle", "role"], properties: { cle: { type: "string", minLength: 32 }, role: { type: "string", enum: ["lecteur", "redacteur", "editeur", "administrateur", "prestataire"] }, label: { type: "string" } } } } } }, responses: { 201: { description: "Clé créée" }, 403: { description: "Rôle administrateur requis" }, 422: { description: "Clé trop courte (code `cle_trop_courte`)" } } },
    },
    "/v1/auth/cles/{id}/revoquer": { post: { operationId: "revoquerCle", summary: "Révoquer une clé d'API", description: "Retire une clé. Le service refuse de révoquer la DERNIÈRE clé d'administration (409 `derniere_cle_admin`).", security: [{ bearerAuth: [] }], tags: ["Autorisation"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Clé révoquée" }, 403: { description: "Rôle administrateur requis" }, 404: { description: "Clé inconnue (code `cle_inconnue`)" }, 409: { description: "Dernière clé d'administration (code `derniere_cle_admin`)" } } } },
    "/v1/journal": { get: { operationId: "lireJournal", summary: "Lire le journal d'audit du service", description: "Journal APPEND-ONLY tenu par le service : chaque geste sensible — dépôt, signature, publication, retrait, épinglage, provisionnement et gestion des clés — y laisse une ligne, et chaque ligne scelle la précédente par son empreinte (le champ `scelle` révèle une chaîne rompue). Réservé à l'administration.", security: [{ bearerAuth: [] }], tags: ["Autorisation"], responses: { 200: { description: "Les dernières entrées, et l'état du scellement" }, 403: { description: "Rôle administrateur requis" } } } },
    "/v1/auth/comptes/{id}/mot-de-passe": {
      post: { operationId: "definirMotDePasse", summary: "Définir ou remettre un mot de passe", description: "Définit le mot de passe d'un compte, ou le REMET. Sans `motDePasse` dans le corps, le service en ENGENDRE un (16 caractères, à changer à la première connexion) et ne le rend qu'ici, une seule fois — c'est la remise d'un accès à un agent. Réservé au rôle administrateur.", tags: ["Comptes"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: false, content: { "application/json": { schema: { type: "object", properties: { motDePasse: { type: "string", format: "password" }, mustChange: { type: "boolean", description: "Exiger un changement à la première connexion (vrai par défaut pour un mot de passe choisi à la main)." } } } } } }, responses: { 200: { description: "Mot de passe défini (le mot de passe provisoire figure dans la réponse s'il a été engendré)" }, 404: { description: "Compte inconnu" }, 422: { description: "Mot de passe trop faible" }, 403: { description: "Rôle administrateur requis" }, ...gardeSession } },
      delete: { operationId: "retirerMotDePasse", summary: "Retirer le mot de passe d'un compte", description: "Le compte cesse de pouvoir ouvrir de session, et ses sessions ouvertes sont fermées. Le compte lui-même reste au référentiel. Réservé au rôle administrateur.", tags: ["Comptes"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Mot de passe retiré" }, 403: { description: "Rôle administrateur requis" }, 404: { description: "Compte inconnu" }, ...gardeSession } },
    },
  };
}

// Le contrat des réglages déclaratifs, tel qu'il apparaît dans la description.
function deploiementPaths() {
  return {
    "/v1/config": { get: { operationId: "reglagesDeploiement", summary: "Réglages de référentiel posés par le déploiement", description: "Rend les variables de RÉFÉRENTIEL posées dans le `.env` du déploiement (identité, vocabulaire, numérotation, délais, recueil, fonctions), sous forme de chemins pointés — `{ \"brand.name\": \"…\", \"numbering.pad\": 3 }` — accompagnées des valeurs REFUSÉES (`erreurs` : variable, valeur, motif), et l'ÉTAT DU PRESTATAIRE DE SIGNATURE (`prestataire` : transport, adresse, niveau, délai, chemins, et `cle` — un booléen, jamais la clé elle-même —, avec le `motif` quand le circuit électronique est simulé). Le navigateur s'en sert au démarrage : il applique ces réglages par-dessus le référentiel, si bien qu'une variable posée ici l'emporte sur la valeur réglée dans l'interface. Route PUBLIQUE : ces informations sont celles que le recueil public affiche déjà, et l'écran de connexion en a besoin avant toute session ; aucun secret n'y figure (voir src/server/mysql/variables.mjs).", tags: ["Service"], responses: { 200: { description: "Réglages posés, valeurs refusées, et état du prestataire" } } } },
    "/v1/atelier/acces": { get: { operationId: "accesAtelier", summary: "L'accès à l'atelier depuis cette adresse", description: "Route PUBLIQUE. Dit si l'accès à l'atelier est restreint (`actif`), si l'adresse de l'appelant y est autorisée (`autorise`), d'où vient l'adresse (`ip`, `interne`), quelle liste s'applique (`liste`, `source` : `deploiement` ou `referentiel`) et le message à montrer en cas de refus. Le paramètre `ip` permet de DEMANDER « et si j'arrivais de là ? » — c'est le simulateur de l'écran d'administration —, et la réponse porte alors `simulation: true` sans valeur de décision. La restriction est appliquée par le service à toutes les routes de l'atelier (`/v1/db/…`, `/v1/actes/…`, `/v1/signatures/…`, `/v1/auth/…`) : depuis une adresse non autorisée, elles répondent 403 `atelier_hors_reseau`. Elle vaut aussi pour les publications RÉSERVÉES AUX AGENTS, qui ne sont servies qu'aux personnes connectées venant d'une adresse autorisée (voir `SCRIBA_ATELIER_IPS`).", tags: ["Service"], responses: { 200: { description: "État de l'accès depuis cette adresse" }, 403: { description: "Adresse non autorisée (code `atelier_hors_reseau`)" } } } },
  };
}

// ---------------------------------------------------------------- courriel
// Le contrat du service de courriel, tel qu'il apparaît dans la description.
function courrielPaths() {
  const garde = { 401: { description: "Session ou jeton absent" }, 403: { description: "Jeton anti-CSRF absent ou incorrect" } };
  return {
    "/v1/courriel": { get: { operationId: "etatCourriel", summary: "État du service de courriel", description: "Rend la configuration SMTP du déploiement — hôte, port, chiffrement, adresse d'expédition, envoi actif ou non — et les derniers envois tentés. **Aucun secret** : le mot de passe SMTP ne quitte jamais le serveur.", tags: ["Courriel"], responses: { 200: { description: "État du service et derniers envois" }, ...garde } } },
    "/v1/courriel/envoi": { post: { operationId: "envoyerCourriel", summary: "Envoyer un courriel de notification", description: "Envoie un message par le serveur SMTP de la collectivité, via `SMTP_*` du `.env`, et le consigne au journal `sb_courriel`. Le corps du message est fourni par l'application ; le service n'invente rien. Répond 502 quand le serveur SMTP refuse — le motif est alors rendu tel quel.", tags: ["Courriel"], security: [{ bearerAuth: [] }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["destinataires", "sujet"], properties: { evenement: { type: "string" }, acteId: { type: "string" }, cible: { type: "string" }, destinataires: { type: "array", items: { type: "object" } }, copie: { type: "array", items: { type: "string" } }, sujet: { type: "string" }, texte: { type: "string" }, html: { type: "string" }, expediteurNom: { type: "string" }, repondreA: { type: "string" } } } } } }, responses: { 200: { description: "Message remis au serveur SMTP" }, 422: { description: "Requête incomplète" }, 502: { description: "Le serveur SMTP a refusé" }, ...garde } } },
    "/v1/courriel/test": { post: { operationId: "testerCourriel", summary: "Envoyer un courriel de test", description: "Vérifie que le service joint bien le serveur SMTP : envoie un message d'essai aux destinataires indiqués, sans passer par la politique de notification de l'application.", tags: ["Courriel"], security: [{ bearerAuth: [] }], responses: { 200: { description: "Message d'essai remis au serveur SMTP" }, 422: { description: "Destinataires manquants" }, 502: { description: "Le serveur SMTP a refusé" }, ...garde } } },
  };
}

// La garde des routes de courriel : session en mode « mot de passe », jeton en
// mode « demo » — la même que celle du reste du service. Rend null si la requête
// est autorisée, sinon la réponse de refus.
async function gardeCourriel(req) {
  if (MOT_DE_PASSE) {
    const s = await sessionHTTP(req);
    if (!s) return refusSession();
    if (comptes.csrfObligatoire(req) && !comptes.csrfValide(req)) return refusCsrf();
    return null;
  }
  const a = authenticate(req);
  return a.ok ? null : { status: a.status, headers: {}, body: err(a.message, { code: a.code }) };
}

async function acteurDe(req) {
  if (MOT_DE_PASSE) { const s = await sessionHTTP(req); return (s && s.compte && (s.compte.login || s.compte.id)) || "session"; }
  const a = authenticate(req);
  return a.ok ? a.label : "";
}

// Une trace d'envoi au journal des courriels. Le corps du message n'est PAS
// conservé : seuls l'événement, les destinataires et le résultat. C'est le
// MAGASIN qui range (table `sb_courriel` en MySQL, `courriel.jsonl` en
// fichiers) — le service ne fait que lui passer les champs.
const journaliserCourriel = (champs) => magasin.journaliserCourriel(champs);
const derniersCourriels = (n = 20) => magasin.derniersCourriels(n);

// ------------------------------------------------------- les réglages du Bulletin
// Le service lit `publication.bulletin` là où l'administration l'écrit (le
// référentiel), et le `.env` l'emporte par-dessus : les variables déclaratives
// survivent à une remise à zéro du référentiel, et c'est par elles qu'un
// exploitant règle le Bulletin sans entrer dans l'application.
//
// La lecture est gardée dix secondes, comme celle de l'accès à l'atelier : une
// page du recueil ne doit pas coûter une requête à chaque visite, mais un
// réglage changé doit se voir sans redémarrer le service — la copie est donc
// OUBLIÉE dès que le référentiel est réécrit (voir `sync`).
let bulletinRefCache = { valeur: undefined, at: 0 };
const oublierBulletin = () => { bulletinRefCache = { valeur: undefined, at: 0 }; };

// Ce que le `.env` impose au Bulletin (portée référentiel : ces variables sont
// aussi transmises au navigateur par `GET /v1/config`).
function bulletinDepuisEnv() {
  const v = OPTIONS.valeurs;
  const o = {};
  if (v.SCRIBA_BULLETIN_ACTIF !== undefined) o.actif = v.SCRIBA_BULLETIN_ACTIF === true;
  if (v.SCRIBA_BULLETIN_TITRE !== undefined) o.titre = v.SCRIBA_BULLETIN_TITRE;
  if (v.SCRIBA_BULLETIN_TITRE_BULLETIN !== undefined) o.titreBulletin = v.SCRIBA_BULLETIN_TITRE_BULLETIN;
  if (v.SCRIBA_BULLETIN_SOUS_TITRE !== undefined) o.sousTitre = v.SCRIBA_BULLETIN_SOUS_TITRE;
  if (v.SCRIBA_BULLETIN_CADENCE !== undefined) o.cadence = v.SCRIBA_BULLETIN_CADENCE;
  if (v.SCRIBA_BULLETIN_PARUTION_JOURS !== undefined) o.parutionJours = v.SCRIBA_BULLETIN_PARUTION_JOURS;
  if (PUBLIQUE_URL) o.base = PUBLIQUE_URL;
  return o;
}

async function reglagesBulletin() {
  if (bulletinRefCache.valeur !== undefined && Date.now() - bulletinRefCache.at < ATELIER_CACHE_MS) return bulletinRefCache.valeur;
  let ref = {};
  try {
    const doc = await magasin.lireConfig();
    ref = (doc && doc.publication && doc.publication.bulletin) || {};
  } catch (e) {
    ref = {};
  }
  const valeur = { ...ref, ...bulletinDepuisEnv() };
  bulletinRefCache = { valeur, at: Date.now() };
  return valeur;
}

// --- l'annuaire de la collectivité, publié pour l'écran de connexion ---------
// Le référentiel porte les réglages de l'annuaire (Administration › Annuaire),
// mais il n'est lisible QU'AVEC une session : en mode « comptes locaux », et en
// mode « oidc », l'écran de connexion — qui vient avant la session — ne les
// verrait jamais. Le service les lit donc pour lui et les publie dans
// `GET /v1/auth/config`, avec les variables `SCRIBA_ANNUAIRE_*` du `.env`
// par-dessus : c'est ainsi qu'un parc se branche sans cliquer dans chaque
// interface (voir src/server/mysql/annuaire.mjs, qui tient la liste blanche —
// rien de secret n'en sort, l'application étant un client OIDC public).
//
// Même garde que pour le Bulletin : dix secondes de copie, oubliée dès que le
// référentiel est réécrit — un réglage change donc sans redémarrer le service.
const ANNUAIRE_CACHE_MS = 10 * 1000;
let annuaireRefCache = { valeur: undefined, at: 0 };
const oublierAnnuaire = () => { annuaireRefCache = { valeur: undefined, at: 0 }; };

async function annuairePublie() {
  if (annuaireRefCache.valeur !== undefined && Date.now() - annuaireRefCache.at < ANNUAIRE_CACHE_MS) return annuaireRefCache.valeur;
  let referentiel = null;
  try { referentiel = await magasin.lireConfig(); }
  catch (e) { referentiel = null; }   // base injoignable : on publie ce que le `.env` dit
  const valeur = annuairePublic({ variables: OPTIONS.valeurs, referentiel });
  annuaireRefCache = { valeur, at: Date.now() };
  return valeur;
}

// Ce que le service a de l'annuaire, défauts du navigateur compris — la même
// lecture que `annuaireCourant` (comptes.mjs), pour que ce qui est publié ici
// décrive exactement ce qui se passera à la connexion.
async function annuaireEffectifDuService() {
  return annuaireEffectif({ publie: await annuairePublie(), modeDeploiement: AUTH_MODE });
}

// LE SERVICE SAIT-IL OUVRIR UNE SESSION D'ANNUAIRE ? C'est la question que se
// pose le navigateur avant de proposer la seconde porte (voir `annuaireFermePour`,
// src/lib/auth.js) : elle n'est ouverte que si le service sait en faire une
// session — des comptes locaux ouverts (c'est là que la session vit), un
// fournisseur RÉEL branché (l'annuaire d'essai ne quitte pas le navigateur), et
// le moyen de l'appeler. Répondre « oui » à tort fermerait la porte à double
// tour : l'agent serait redirigé vers un fournisseur, puis refusé au retour.
async function annuaireParLeService() {
  if (!COMPTES_LOCAUX || typeof fetch !== "function") return false;
  try {
    return annuaireAccepte(await annuaireEffectifDuService());
  } catch (e) {
    return false;
  }
}

// La trace d'un courriel de Bulletin — abonnement, confirmation, parution — va
// au MÊME journal que les notifications d'actes (`sb_courriel`) : le corps du
// message n'y est pas conservé, seulement l'événement, la cible et le résultat.
// `tracer` est appelé sans être attendu (voir bulletins.mjs) : on ne fait donc
// pas échouer un envoi parce que sa trace n'a pas pu s'écrire.
function tracerBulletin({ evenement, cible, destinataires, sujet, envoye, motif } = {}) {
  journaliserCourriel({ evenement, cible, destinataires, sujet, envoye, motif, acteur: "service", ip: null })
    .catch((e) => console.error("[bulletin] trace impossible :", e.message));
}

// --------------------------------------------------------------------- routage
let api = null;   // renseigné au démarrage, après lecture de l'état
// Le domaine des bulletins (voir bulletins.mjs) : instancié avec l'API, sur le
// même état — c'est lui qui compose les numéros, tient les abonnés, expédie la
// file d'envoi et sert les routes `/v1/bulletins…`.
let bulletins = null;

async function handle(req, res) {
  const url = new URL(req.url, "http://localhost");
  const pathname = decodeURIComponent(url.pathname);
  const ip = ipOf(req);

  if (req.method === "OPTIONS") { send(req, res, 204, null); return; }

  // --- l'accès à l'atelier : /v1/atelier/acces ------------------------------
  // Route PUBLIQUE : l'application en a besoin AVANT toute session (elle décide
  // quoi afficher à qui arrive), et elle ne révèle rien de secret — l'adresse de
  // l'appelant, il la connaît déjà. `?ip=` permet de demander « et si j'arrivais
  // de là ? » : c'est le simulateur de l'écran d'administration, et sa réponse
  // ne vaut pas décision (elle est marquée `simulation`).
  if (pathname === "/v1/atelier/acces" && req.method === "GET") {
    const simulee = url.searchParams.get("ip");
    const etat = await etatDeLAtelier(simulee ? simulee : ip, { simulation: !!simulee });
    send(req, res, 200, { ...etat, appelant: ip });
    return;
  }

  // La porte de l'atelier : hors du réseau autorisé, tout ce qui appartient à
  // l'atelier s'arrête ici. Un 403 explicite, jamais un 404 muet — l'agent doit
  // comprendre que l'outil existe et que c'est le réseau qui l'en sépare.
  if (estRouteAtelier(pathname)) {
    const etat = await etatDeLAtelier(ip);
    if (!etat.autorise) {
      console.warn(`[atelier] refusé à ${etat.ip || "adresse inconnue"} (${pathname})`);
      send(req, res, 403, corpsRefus(etat));
      return;
    }
  }

  if (pathname === "/" || pathname === "/v1" || pathname === "/v1/") {
    const doc = api.openapi();
    doc.paths = { ...doc.paths, ...dbPaths(), ...authPaths(), ...deploiementPaths(), ...courrielPaths() };
    doc.paths = Object.fromEntries(Object.entries(doc.paths).sort((a, b) => a[0].localeCompare(b[0])));
    send(req, res, 200, doc);
    return;
  }

  // --- réglages déclaratifs du déploiement : /v1/config ----------------------
  // Les variables de RÉFÉRENTIEL posées dans le `.env` (voir variables.mjs),
  // validées au démarrage. L'application les applique par-dessus le référentiel.
  // Route PUBLIQUE et sans secret : ce sont les informations que le recueil
  // public affiche déjà, et l'écran de connexion en a besoin avant toute
  // session. Une valeur refusée n'est pas appliquée : elle est rendue ici, et
  // l'exploitant la lit aussi dans les journaux du service.
  if (pathname === "/v1/config" && req.method === "GET") {
    send(req, res, 200, {
      service: SERVICE_ID,
      variables: OPTIONS.valeurs,
      erreurs: OPTIONS.erreurs,
      // L'état du prestataire de signature — SANS LA CLÉ, jamais : « cle »
      // dit seulement si elle est là. L'Administration › Signature s'en sert
      // pour annoncer si le circuit électronique est réellement branché, ou
      // s'il est simulé, et pourquoi.
      prestataire: prestataireSignature.etat(),
    });
    return;
  }

  // --- clés d'API et journal du service : le domaine signature/publication -----
  // Ces adresses servent les COMPTES DE SERVICE de l'API (créer, lister, révoquer
  // une clé), l'état de l'autorisation et la piste d'audit du service : elles
  // appartiennent au domaine `actes.mjs`, qui détient l'état (`db.cles`,
  // `db.journal`). Elles sont donc traitées ICI, AVANT la porte des comptes —
  // sinon `/v1/auth/cles` tomberait dans le routage des sessions, qui ne les
  // connaît pas. Aucune de ces routes ne pose ni ne lit de cookie de session :
  // elles s'autorisent par une session EXISTANTE ou par une clé.
  if (/^\/v1\/(auth\/(etat|bootstrap|cles)|journal)(\/|$)/.test(pathname)) {
    if (tooMany("a:" + ip, RATE_MAX_CONNEXIONS, RATE_WINDOW_MS)) {
      send(req, res, 429, err("Trop de requêtes : ralentissez.", { code: "trop_de_requetes" }), { "retry-after": String(Math.ceil(RATE_WINDOW_MS / 1000)) });
      return;
    }
    let corps = null;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      try {
        const raw = await readBody(req);
        corps = raw ? JSON.parse(raw) : {};
      } catch (e) {
        const status = e.status || 400;
        send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
        return;
      }
    }
    const sessionCles = await sessionHTTP(req);
    const out = await api.route({ method: req.method, path: pathname, headers: req.headers, body: corps, ip }, {
      agent: !!sessionCles || !!cleValide(req),
      authorize: (headers, regle) => autoriser(req, sessionCles, regle),
      rate: () => false,
    });
    if (!out) { send(req, res, 404, err("Ressource inconnue : " + pathname, { code: "ressource_inconnue" })); return; }
    const sale = api.takeDirty();
    if (sale) {
      if (etatDegrade) { send(req, res, 503, refusEtatDegrade()); return; }
      try { await magasin.ecrireEtat(sale); }
      catch (e) { send(req, res, 500, err("L'écriture de l'état a échoué : " + e.message, { code: "etat_non_ecrit" })); return; }
    }
    send(req, res, out.status, out.body, out.headers || {});
    return;
  }

  // --- comptes et sessions : /v1/auth/… --------------------------------------
  // La porte des comptes répond AVANT tout le reste : c'est par elle que le
  // navigateur apprend le mode du service (voir `GET /v1/auth/config`) et ouvre
  // sa session. Elle n'exige donc aucune session, sauf pour ce qui la concerne
  // elle-même (`/v1/auth/session`, comptes, changement de mot de passe).
  if (pathname === "/v1/auth" || pathname.startsWith("/v1/auth/")) {
    if (pathname === "/v1/auth/config" && req.method === "GET") {
      // La base a pu être RÉPARÉE depuis le démarrage (compte aligné par
      // « docker compose run --rm db-init », schéma appliqué à la main) : c'est
      // ici, le seul appel que fait l'écran de connexion, qu'on rééprouve et
      // qu'on se rétablit — plutôt que de laisser un bandeau périmé (voir
      // `reevaluerBase`).
      await reevaluerBase();
      // L'écran de connexion lit TOUT ici : le mode du service, les règles du
      // mot de passe, les comptes de démonstration éventuels, ET l'état du
      // déploiement — un compte d'administration a-t-il pu être amorcé ? la base
      // répond-elle ? Sans cela, un ADMIN_PASSWORD refusé restait invisible (on
      // n'affichait qu'« Identifiant ou mot de passe incorrect ») et une base
      // injoignable donnait un écran vide.
      let base;
      try {
        base = MOT_DE_PASSE
          ? await comptes.config()
          : { auth: "demo", demo: true, message: "Le service est en mode « comptes de l'application » (AUTH_MODE=demo)." };
      } catch (e) {
        console.error("[auth:config]", e);
        noterBase(false, "La configuration des comptes n'a pas pu être lue : " + e.message, e);
        base = { auth: MOT_DE_PASSE ? "password" : "demo", demo: !MOT_DE_PASSE };
      }
      // LE MODE RÉEL DU DÉPLOIEMENT, tel qu'il est écrit dans le `.env` : en
      // mode « oidc », l'annuaire de la collectivité est la porte ordinaire —
      // MAIS les comptes locaux restent ouverts (`comptesLocaux`), et c'est ce
      // qui permet d'entrer avec le compte d'administration déclaré ici. Le
      // client affiche alors les DEUX portes. `session` dit que les données se
      // lisent avec une session (cookie) et non un jeton d'API.
      send(req, res, 200, {
        ...base,
        auth: AUTH_MODE,
        session: COMPTES_LOCAUX,
        comptesLocaux: COMPTES_LOCAUX,
        oidc: AUTH_MODE === "oidc",
        message: AUTH_MODE === "oidc"
          ? "Le service accepte la connexion par l'annuaire de la collectivité (OIDC) ET par un compte local (identifiant et mot de passe)."
          : base.message,
        // LE COMMUTATEUR DE DÉMONSTRATION (`DEMO` du .env) : le jeu fictif est-il
        // installé, ou l'outil est-il une page vierge ? Le navigateur en a besoin
        // AVANT toute session (il décide de semer ou non le référentiel), donc il
        // voyage ici, avec le mode. Voir src/lib/demo.js.
        demoJeu: DEMO_JEU,
        // LES RÉGLAGES DE L'ANNUAIRE (fournisseur, correspondance des groupes,
        // seconde porte), tels que le service les lit — référentiel relu par
        // lui, variables `SCRIBA_ANNUAIRE_*` par-dessus. L'écran de connexion en
        // a besoin AVANT toute session, et c'est la seule route qui les lui
        // donne en mode « comptes locaux ». Aucun secret (voir annuaire.mjs) ;
        // `null` quand il n'y a rien à publier.
        annuaire: await annuairePublie(),
        // LE SERVICE SAIT-IL OUVRIR UNE SESSION D'ANNUAIRE ? Ce drapeau est la
        // clé de la seconde porte : sans lui, le navigateur ne peut pas savoir
        // si l'annuaire qu'on lui publie ci-dessus mène quelque part (voir
        // `annuaireFermePour`, src/lib/auth.js). Un service qui l'accepte est un
        // service où l'on peut entrer par l'annuaire ET LIRE les actes.
        annuaireService: await annuaireParLeService(),
        // Sans objet en mode « demo » (les comptes viennent de la liste).
        adminAmorce: MOT_DE_PASSE ? etatService.adminAmorce : null,
        adminMotif: MOT_DE_PASSE ? etatService.adminMotif : "",
        adminAvertissement: MOT_DE_PASSE ? etatService.adminAvertissement : "",
        adminPanne: MOT_DE_PASSE ? etatService.adminPanne : false,
        baseDisponible: etatService.baseDisponible,
        baseMessage: etatService.baseMessage,
        baseRemede: etatService.baseRemede || "",
      });
      return;
    }

    if (!MOT_DE_PASSE) {
      send(req, res, 404, err("Le service est en mode « comptes de l'application » : aucune session n'est ouverte ici (AUTH_MODE=demo).", { code: "auth_desactivee" }));
      return;
    }
    if (tooMany("a:" + ip, RATE_MAX_CONNEXIONS, RATE_WINDOW_MS)) {
      send(req, res, 429, err("Trop de requêtes : ralentissez.", { code: "trop_de_requetes" }), { "retry-after": String(Math.ceil(RATE_WINDOW_MS / 1000)) });
      return;
    }
    let body = null;
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      try {
        const raw = await readBody(req);
        body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        const status = e.status || 400;
        send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
        return;
      }
    }
    const out = await comptes.route({ method: req.method, path: pathname, headers: req.headers, body, ip }, { secure: COOKIE_SECURE, ip });
    send(req, res, out.status, out.body, out.headers || {});
    return;
  }

  if (pathname === "/v1/db/health" && req.method === "GET") {
    try {
      noterBase(true);
      send(req, res, 200, await health());
    } catch (e) {
      // Le cas le plus fréquent d'une première installation : la base répond
      // mais le schéma n'existe pas encore. Le remède est celui du bandeau :
      // une seule phrase pour la même panne, où qu'on la lise.
      noterBaseSelonErreur(e);
      if (etatService.baseDisponible === null) noterBase(false, e.message, e);
      send(req, res, 503, err("La base de données n'est pas prête : " + e.message, {
        code: "base_indisponible",
        remede: etatService.baseRemede,
      }));
    }
    return;
  }

  const mCol = /^\/v1\/db\/collections\/([A-Za-z]+)$/.exec(pathname);
  if (mCol && req.method === "GET") {
    const name = mCol[1];
    if (!COLLECTIONS.includes(name)) { send(req, res, 404, err("Collection inconnue : " + name, { code: "collection_inconnue" })); return; }
    // Mode « mot de passe » : les données ne se lisent qu'avec une session. Les
    // adresses PUBLIQUES (le recueil, /v1/publications…) ne passent pas par ici :
    // elles restent ouvertes à tous.
    if (MOT_DE_PASSE && !(await sessionHTTP(req))) {
      send(req, res, 401, refusSession().body);
      return;
    }
    try {
      const records = await magasin.lireCollection(name);
      const revision = await magasin.lireRevisionCollection(name);
      noterBase(true);
      send(req, res, 200, { collection: name, revision, records });
    } catch (e) { noterBaseSelonErreur(e); send(req, res, 500, err("Lecture impossible : " + e.message, { code: "lecture_impossible" })); }
    return;
  }

  const mSync = /^\/v1\/db\/collections\/([A-Za-z]+)\/sync$/.exec(pathname);
  if (mSync && req.method === "POST") {
    const name = mSync[1];
    if (!COLLECTIONS.includes(name)) { send(req, res, 404, err("Collection inconnue : " + name, { code: "collection_inconnue" })); return; }
    if (tooMany("w:" + ip + ":" + name, RATE_MAX_WRITES, RATE_WINDOW_MS)) {
      send(req, res, 429, err("Trop d'écritures : ralentissez.", { code: "trop_de_requetes" }), { "retry-after": String(Math.ceil(RATE_WINDOW_MS / 1000)) });
      return;
    }
    // Autorisation : une SESSION en mode « mot de passe » (le jeton est public,
    // il ne peut pas protéger une donnée), un JETON en mode « demo » (le
    // fonctionnement historique). Un compte ordinaire n'écrit pas les
    // collections qui portent l'identité et les réglages.
    let acteur = "";
    let estAdmin = false;
    let roleActeur = "";
    if (MOT_DE_PASSE) {
      const s = await sessionHTTP(req);
      if (!s) { send(req, res, 401, refusSession().body); return; }
      if (comptes.csrfObligatoire(req) && !comptes.csrfValide(req)) { send(req, res, 403, refusCsrf().body); return; }
      estAdmin = comptes.estAdmin(s.compte);
      roleActeur = roleDeCompte(s.compte);
      if (COLLECTIONS_ADMIN.has(name) && !estAdmin) {
        send(req, res, 403, err(`Seul un administrateur écrit la collection « ${name} ».`, { code: "droit_requis" }));
        return;
      }
      acteur = s.compte.login || s.compte.id || "session";
    } else {
      const jeton = authenticate(req);
      if (!jeton.ok) { send(req, res, jeton.status, err(jeton.message, { code: jeton.code })); return; }
      acteur = jeton.label;
      estAdmin = jeton.role === "administrateur";
      roleActeur = jeton.role;
    }
    // Les billets du recueil public s'écrivent par la COMMUNICATION, pas par
    // n'importe quel compte : la collection « informations » demande le rôle
    // éditeur, comme la permission « informations.gerer » de l'application
    // (voir src/lib/users.js) et comme le service de démonstration
    // (index.html, DBC_ECRITURE). Sans ce seuil, un rédacteur pourrait publier
    // une communication sur le site public.
    if (COLLECTIONS_EDITEUR.has(name) && !roleAutorise(roleActeur, { min: "editeur" })) {
      send(req, res, 403, err(`La collection « ${name} » demande au moins le rôle éditeur (rôle : « ${roleActeur} »).`, { code: "droit_requis", role: roleActeur }));
      return;
    }
    let body;
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      const status = e.status || 400;
      send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
      return;
    }
    try {
      const out = await sync(name, body || {}, acteur, ip, estAdmin);
      // Le référentiel vient d'être écrit : la liste d'accès à l'atelier est
      // peut-être dedans. On oublie la copie gardée, pour que le prochain appel
      // relise la règle à jour (voir `ipsAtelierReferentiel`).
      if (name === "config") oublierIpsAtelier();
      // Les réglages de l'annuaire voyagent aussi par le référentiel : la copie
      // publiée par `GET /v1/auth/config` doit être oubliée en même temps, sinon
      // l'écran de connexion ignorerait un branchement pendant dix secondes.
      if (name === "config") oublierAnnuaire();
      // Les réglages du Bulletin sont dans le même document : ils doivent suivre
      // le même chemin, sinon un réglage changé attendrait dix secondes.
      if (name === "config") oublierBulletin();      send(req, res, out.status, out.body);
    } catch (e) {
      console.error("[sync]", name, e);
      send(req, res, 500, err("Écriture impossible : " + e.message, { code: "ecriture_impossible" }));
    }
    return;
  }

  // --- les informations publiées au recueil (les billets) --------------------
  // Route PUBLIQUE, comme le recueil lui-même : elle ne rend que les billets
  // PUBLIÉS (`publie: true`). Un brouillon ne sort que vers une identité de rôle
  // `editeur` au moins — c'est ce que la collection `informations` exige à
  // l'écriture (COLLECTIONS_EDITEUR), et c'est aussi la règle du service de
  // démonstration (index.html, `hInformations`). Un billet n'est ni signé ni
  // numéroté : il n'entre pas dans le registre des actes, et la restriction
  // d'accès à l'atelier ne le concerne pas — le recueil public est ouvert à tous.
  if (pathname === "/v1/informations" && req.method === "GET") {
    try {
      const records = await magasin.lireCollection("informations");
      const session = MOT_DE_PASSE ? await sessionHTTP(req) : null;
      const peutVoirBrouillons = !autoriser(req, session, { min: "editeur" });
      const liste = records
        .map((r) => r.payload)
        .filter((i) => i && typeof i === "object")
        .filter((i) => i.publie === true || peutVoirBrouillons)
        .sort((a, b) => String(b.date || b.creeLe || "").localeCompare(String(a.date || a.creeLe || "")));
      noterBase(true);
      send(req, res, 200, { informations: liste });
    } catch (e) {
      noterBaseSelonErreur(e);
      send(req, res, 500, err("Lecture impossible : " + e.message, { code: "lecture_impossible" }));
    }
    return;
  }

  // --- courriel : le service parle au serveur SMTP de la collectivité --------
  // L'application n'a jamais accès au serveur SMTP : elle demande, le service
  // envoie. Ces routes exigent la même autorisation que le reste.
  if (pathname === "/v1/courriel" && req.method === "GET") {
    const refus = await gardeCourriel(req);
    if (refus) { send(req, res, refus.status, refus.body, refus.headers || {}); return; }
    let derniers = [];
    try { derniers = await derniersCourriels(20); }
    catch (e) { console.error("[courriel]", e.message); }
    send(req, res, 200, { ...courriel.etat(), derniers });
    return;
  }

  if ((pathname === "/v1/courriel/envoi" || pathname === "/v1/courriel/test") && req.method === "POST") {
    const refus = await gardeCourriel(req);
    if (refus) { send(req, res, refus.status, refus.body, refus.headers || {}); return; }
    if (tooMany("c:" + ip, RATE_MAX_WRITES, RATE_WINDOW_MS)) {
      send(req, res, 429, err("Trop de courriels en peu de temps : ralentissez.", { code: "trop_de_requetes" }), { "retry-after": "60" });
      return;
    }
    let body;
    try {
      const raw = await readBody(req);
      body = raw ? JSON.parse(raw) : {};
    } catch (e) {
      const status = e.status || 400;
      send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
      return;
    }
    const test = pathname.endsWith("/test");
    const destinataires = Array.isArray(body.destinataires) ? body.destinataires : [];
    if (!destinataires.length) {
      send(req, res, 422, err("Indiquez au moins un destinataire (`destinataires`).", { code: "destinataire_absent" }));
      return;
    }
    const resultat = test
      ? await courriel.tester({ destinataires, expediteurNom: body.expediteurNom, repondreA: body.repondreA })
      : await courriel.envoyer({
        destinataires, copie: body.copie, sujet: body.sujet, texte: body.texte, html: body.html,
        expediteurNom: body.expediteurNom, repondreA: body.repondreA,
      });
    const acteur = await acteurDe(req);
    try {
      await journaliserCourriel({
        evenement: test ? "test" : (body.evenement || "courriel"),
        acteId: body.acteId || null, cible: body.cible || null,
        destinataires, sujet: test ? "Test de configuration — Scribae" : body.sujet,
        envoye: resultat.envoye, motif: resultat.raison, acteur, ip,
      });
    } catch (e) { console.error("[courriel:journal]", e.message); }
    const envoi = ((resultat.trace || []).filter((x) => x.sens === ">").map((x) => x.ligne)).slice(0, 12);
    if (!resultat.envoye) {
      send(req, res, 502, err(resultat.raison || "Le message n'a pas été envoyé.", { code: "envoi_refuse", destinataires: destinataires.map((d) => (d && d.courriel) || d) }));
      return;
    }
    send(req, res, 200, {
      envoye: true, destinataires: resultat.destinataires, detail: resultat.detail || "",
      ms: resultat.ms || 0, dialogue: envoi,
    });
    return;
  }

  // --- signature et publication : le domaine de actes.mjs -------------------
  if (/^\/v1\//.test(pathname)) {
    let body = null;
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH") {
      try {
        const raw = await readBody(req);
        body = raw ? JSON.parse(raw) : {};
      } catch (e) {
        const status = e.status || 400;
        send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible (JSON attendu).", { code: status === 413 ? "corps_trop_volumineux" : "json_invalide" }));
        return;
      }
    }
    // Mode « mot de passe » : les actes déposés et les circuits de signature ne
    // sont ni publics ni « à jeton » — ce qui n'est pas encore publié au recueil
    // ne se lit qu'avec une session. Les publications, les identifiants ELI, le
    // recueil et la santé du service restent, eux, ouverts à tous.
    const session = await sessionHTTP(req);
    // En mode « mot de passe », ce qui n'est pas encore publié au recueil ne se
    // lit pas sans identité — une SESSION (l'agent), ou une CLÉ d'API (le compte
    // de service d'un script ou d'un outil tiers). Les publications, les
    // identifiants ELI, le recueil et la santé du service restent, eux, ouverts à
    // tous.
    if (MOT_DE_PASSE && /^\/v1\/(actes|signatures)(\/|$)/.test(pathname) && !session && !cleValide(req)) {
      send(req, res, 401, refusSession().body);
      return;
    }
    const request = { method: req.method, path: pathname + url.search, headers: req.headers, body, ip };
    // `await` : un gestionnaire peut avoir à SORTIR sur le réseau — l'ouverture
    // d'un circuit de signature auprès du prestataire (voir signature.mjs). Le
    // routage rend alors une promesse, et l'état n'est écrit qu'après coup.
    const ctxRoute = {
      // `agent` : la requête porte-t-elle une session, ou une clé de service ?
      // Les publications RÉSERVÉES AUX AGENTS ne se servent qu'à celles-là (voir
      // src/server/mysql/actes.mjs).
      agent: !!session || !!cleValide(req),
      authorize: (headers, regle) => autoriser(request, session, regle),
      rate: (r) => tooMany("w:" + ip + ":" + pathname, RATE_MAX_WRITES, RATE_WINDOW_MS),
      base: originePublique(req),
    };
    let out = await api.route(request, ctxRoute);
    // LE BULLETIN appartient à son propre domaine (voir bulletins.mjs) : le
    // service l'essaie dans la foulée, sur le même état et avec les mêmes
    // règles d'accès — c'est ce qui fait de `/v1/bulletins…` une partie du
    // service, sans que le domaine des actes ait à le connaître.
    if (!out && bulletins) out = await bulletins.route(request, ctxRoute);
    if (!out) { send(req, res, 404, err("Ressource inconnue : " + pathname, { code: "ressource_inconnue" })); return; }
    // L'état n'est écrit qu'après un changement effectif : une lecture ne touche
    // pas la base. Les deux domaines écrivent le MÊME document — on draine donc
    // les deux, et le dernier sérialisé fait foi.
    const dirty = api.takeDirty() || (bulletins ? bulletins.takeDirty() : null);
    if (dirty) {
      // Un état VIDE de secours ne s'écrit jamais par-dessus l'état enregistré
      // (voir `refusEtatDegrade`).
      if (etatDegrade) { send(req, res, 503, refusEtatDegrade()); return; }
      try { await magasin.ecrireEtat(dirty); }
      catch (e) {
        console.error("[etat]", e);
        send(req, res, 500, err("L'écriture de l'état a échoué : " + e.message, { code: "etat_non_ecrit" }));
        return;
      }
    }
    send(req, res, out.status, out.body, out.headers || {});
    return;
  }

  // --- le recueil ouvert : /robots.txt, /llms.txt, /sitemap.xml, /recueil… ----
  // Ces adresses sont celles du SITE, pas de l'API : elles sont servies par le
  // domaine du recueil (voir nginx.conf) et le domaine `actes.mjs` les tient,
  // puisqu'il détient les publications — et, avec elles, les pages du Bulletin.
  //
  // Les LECTURES sont publiques et ne touchent pas la base. Les ÉCRITURES du
  // recueil — la demande d'abonnement au Bulletin, qui poste depuis un VRAI
  // formulaire HTML, pour fonctionner sans JavaScript — passent par le même
  // domaine, avec les garde-fous de l'API : corps lu et converti, débit borné,
  // et état écrit uniquement après un changement effectif.
  {
    const lecture = req.method === "GET" || req.method === "HEAD";
    let corps = null;
    if (!lecture) {
      try {
        corps = corpsDeRequete(await readBody(req), req.headers["content-type"] || "");
      } catch (e) {
        const status = e.status || 400;
        send(req, res, status, err(status === 413 ? "Requête trop volumineuse." : "Requête illisible.", { code: status === 413 ? "corps_trop_volumineux" : "corps_invalide" }));
        return;
      }
    }
    // Une publication RÉSERVÉE AUX AGENTS ne se montre qu'à une identité connue
    // (session ou clé de service) — voir src/server/mysql/actes.mjs.
    const agent = lecture ? await estAgent(req) : false;
    const out = await api.route({ method: req.method, path: pathname + url.search, headers: req.headers, body: corps, ip }, {
      agent,
      authorize: () => null,
      rate: () => tooMany("w:" + ip + ":" + pathname, RATE_MAX_WRITES, RATE_WINDOW_MS),
      base: originePublique(req),
    });
    if (out) {
      const dirty = api.takeDirty() || (bulletins ? bulletins.takeDirty() : null);
      if (dirty) {
        if (etatDegrade) { send(req, res, 503, refusEtatDegrade()); return; }
        try { await magasin.ecrireEtat(dirty); }
        catch (e) {
          console.error("[etat]", e);
          send(req, res, 500, err("L'écriture de l'état a échoué : " + e.message, { code: "etat_non_ecrit" }));
          return;
        }
      }
      send(req, res, out.status, out.body, out.headers || {});
      return;
    }
  }

  send(req, res, 404, err("Ressource inconnue : " + pathname, { code: "ressource_inconnue" }));
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    // Une requête qui échoue sur la BASE (table manquante, identifiants refusés)
    // n'est pas qu'une erreur de requête : c'est l'état du déploiement qui a
    // changé. On le note, pour que l'écran de connexion porte le bon remède et
    // que le service se rétablisse (voir `reevaluerBase`).
    noterBaseSelonErreur(e);
    console.error("[http]", e);
    if (!res.headersSent) send(req, res, 500, err("Erreur interne du service.", { code: "erreur_interne" }));
    else res.end();
  });
});

// ------------------------------------------------------------------ migration
// LE SCHÉMA, appliqué par MIGRATIONS VERSIONNÉES (voir migrations.mjs). Le socle
// (`schema.sql`) ne contient que des `CREATE TABLE IF NOT EXISTS` et des vues
// (`CREATE OR REPLACE`) : l'appliquer à une base en service ne détruit rien, et
// c'est ce qui rend le geste répétable — au démarrage (AUTO_MIGRATE), après une
// reprise de la base (voir `reevaluerBase`), ou à la main (`--migrate`, et
// `--reconcilier`, qui l'appelle après avoir aligné le compte). Chaque migration
// n'est appliquée qu'UNE fois, et son passage est inscrit dans `sb_migrations` :
// une base sait donc à quelle version elle se trouve.
// ------------------------------------------------------------------ préparation
// LE SCHÉMA (MySQL) OU LE DOSSIER (fichiers), appliqué au démarrage. Les deux
// magasins savent le faire (`preparer`) : MySQL applique ses migrations
// versionnées, le magasin FICHIER crée son dossier et y dépose sa version de
// format. Le geste est répétable et sans effet sur les données, dans les deux
// cas — c'est ce qui rend une installation neuve utilisable du premier coup.
async function preparerBase() {
  const r = await magasin.preparer((niveau, message) => (niveau === "avertissement" ? console.warn("[magasin] " + message) : console.log("[magasin] " + message)));
  if (!r) return r;
  console.log(r.appliquees && r.appliquees.length
    ? `Rangement à jour : ${r.appliquees.length} élément(s) appliqué(s) (version ${r.aJour}/${r.total}).`
    : `Rangement déjà à jour (version ${r.aJour}/${r.total}).`);
  return r;
}

// ------------------------------------------------------- le compte applicatif
// LE COMPTE APPLICATIF SUIT LE `.env` : c'est ce que fait ce geste, et c'est le
// SEUL endroit du logiciel qui parle à la base en ROOT (le mot de passe root est
// lu ici, et n'est ni journalisé, ni transmis).
//
// démarrage). Rien n'est DÉTRUIT : ni table, ni contenu.
//
// LE SCHÉMA SUIT LE COMPTE, dans le même geste. Les deux pannes vont de pair : une
// base dont le compte était refusé n'a jamais reçu son schéma (l'application
// n'avait pas de quoi le créer), et l'exploitant qui répare le compte avec cette
// commande doit repartir d'une base UTILISABLE — sinon il voit « Table … doesn't
// exist » au premier écran, et doit chercher une seconde commande. `schema.sql`
// étant idempotent, l'appliquer ici ne touche à aucune donnée, même sur une base
// en service.
//
// Le geste est BON ENFANT : s'il échoue (mot de passe root périmé, base
// injoignable), il le DIT et n'empêche rien de démarrer — le service journalise
// ensuite, à son tour, l'état réel de la base et le remède.
async function reconcilierCompte() {
  const r = await magasin.reconcilier({ motDePasseRoot: env("DB_ROOT_PASSWORD", "") });
  if (r.sansObjet) {
    console.log(r.motif);
    return false;
  }
  if (!r.fait) {
    console.error("Compte applicatif : " + r.motif);
    return false;
  }
  console.log(`Compte applicatif « ${DB.user} » aligné sur le .env (base « ${DB.database} »).`);
  if (!r.schemaApplication) {
    console.error("Le compte est en règle, mais les tables manquent encore. Quand la base répondra : « node server.mjs --migrate », ou « docker compose up -d --force-recreate api » (AUTO_MIGRATE les crée au démarrage de son côté).");
    return false;
  }
  return true;
}

// ------------------------------------------------------- comptes : amorçage
// L'amorçage DIT toujours ce qu'il a fait : le verdict est porté jusqu'à l'écran
// de connexion par `etatService` (voir plus haut). Le VERDICT lui-même est
// calculé par amorcage.mjs, qui est pur et donc éprouvable sans base.
async function amorcerAdmin() {
  const r = await amorcerAdministrateur({
    adminLogin: ADMIN_LOGIN,
    adminPassword: ADMIN_PASSWORD,
    adminNom: ADMIN_NOM,
    adminEmail: ADMIN_EMAIL,
    adminEntity: ADMIN_ENTITY,
    mdpMin: MDP_MIN,
    comptes,
  });
  if (r.panne) {
    noterBaseSelonErreur(r.panne);
    // Un référentiel de comptes injoignable EST une base indisponible : on ne
    // laisse pas `baseDisponible` à `null` (l'écran n'aurait alors rien à
    // montrer à l'agent, sinon un motif sans remède).
    if (etatService.baseDisponible === null) noterBase(false, r.panne.message, r.panne);
  }
  etatService.adminAmorce = r.ok;
  etatService.adminPanne = !!r.panne;
  etatService.adminMotif = r.motif || "";
  etatService.adminAvertissement = r.avertissement || "";
  if (r.message) console.log(r.message);
  if (r.avertissement) console.warn("[amorcage] " + r.avertissement);
  if (!r.ok) console.error("[amorcage] " + (r.motif || "l'amorçage n'a pas abouti"));
  return r.compte;
}

// Réinitialisation par la ligne de commande : le mot de passe est lu sur
// l'entrée standard, jamais dans les arguments — il ne doit pas rester dans
// l'historique du shell ni dans la liste des processus.
//
// C'est la PORTE DE SECOURS du service : si le compte a disparu du référentiel
// (remise à zéro des collections, import de données sans les comptes), la
// commande ne se contente pas de refuser — elle CRÉE le compte, avec le rôle
// administrateur, puisque c'est le seul geste qui permette encore de rentrer.
// Le geste demande un accès au conteneur du service : il n'est pas plus ouvert
// que la base elle-même. Le mot de passe est vérifié AVANT toute écriture, pour
// ne pas laisser derrière soi un compte sans mot de passe.
async function motDePasseCLI(login) {
  const l = normaliserLogin(login || "");
  if (!l) {
    console.error("Usage : node server.mjs --mot-de-passe <identifiant>   (le mot de passe est lu sur l'entrée standard)");
    process.exitCode = 1;
    return;
  }
  let mdp = "";
  try { mdp = String(readFileSync(0, "utf8")).replace(/\r?\n$/, ""); } catch (e) { mdp = ""; }
  if (!mdp) {
    console.error("Aucun mot de passe lu sur l'entrée standard.");
    console.error(`Exemple : printf '%s' "$MDP" | node server.mjs --mot-de-passe ${l}`);
    process.exitCode = 1;
    return;
  }
  const faible = motDePasseFaible(l, mdp, MDP_MIN);
  if (faible) { console.error("Mot de passe refusé : " + faible); process.exitCode = 1; return; }
  let compte = await comptes.lireCompteParLogin(l);
  if (!compte) {
    const nom = nomDe(ADMIN_NOM || l);
    compte = {
      id: "u-" + (slug(l) || "admin"), civility: "",
      firstName: nom.firstName, lastName: nom.lastName,
      login: l, email: ADMIN_EMAIL, role: "administrateur", roles: ["administrateur"],
      entityId: ADMIN_ENTITY, service: "", personId: "", memberships: [],
      active: true, source: "local",
      createdAt: new Date().toISOString(), lastLogin: "",
    };
    await comptes.ecrireCompte(compte);
    console.warn(`Aucun compte « ${l} » au référentiel : il vient d'être CRÉÉ, avec le rôle administrateur — sinon la commande ne servirait à rien là où elle est le dernier recours.`);
  }
  const r = await comptes.definirMotDePasse(compte.id, mdp, { mustChange: false });
  if (!r.ok) { console.error(r.message); process.exitCode = 1; return; }
  console.log(`Mot de passe défini pour « ${l} » (ses sessions ouvertes restent valides).`);
}

// ------------------------------------------------- l'état du service en mémoire
// L'état de signature/publication (actes, circuits, publications) vit en mémoire
// et est écrit dans `sb_etat` après chaque changement. On le tient ici, hors de
// `main`, pour pouvoir le RECHARGER après une reprise de la base (voir
// `reevaluerBase`) : sans cela, un service parti sur un état vide y resterait.
let etatApp = null;
// L'état en mémoire est-il un état VIDE de secours, faute d'avoir pu lire le
// véritable ? C'est ce drapeau qui empêche de l'écrire par-dessus celui du
// rangement (voir les deux `ecrireEtat` de `handle`) : ce serait une perte
// silencieuse.
let etatDegrade = false;

// Charge l'état depuis le rangement, ou repart d'un état vide EN LE DISANT. Le
// magasin signale lui-même le cas DÉGRADÉ (`degrade: true`) : état illisible,
// table absente, fichier corrompu. Démarrage DÉGRADÉ, explicite : si l'état est
// illisible, on ne sort PAS en `process.exit(1)` (le conteneur redémarrerait en
// boucle, nginx servirait des 502) et on ne bascule pas en silence sur un état
// vide — on démarre, on le journalise, et le client l'apprend par
// `/v1/auth/config`.
async function chargerEtatService() {
  etatDegrade = false;
  try {
    const r = await magasin.lireEtat();
    if (r.degrade) {
      etatDegrade = true;
      noterBase(false, "L'état du service est illisible.", null);
      console.error("Démarrage DÉGRADÉ : l'état du service n'a pas pu être chargé. Le registre paraîtra vide tant que le rangement ne sera pas rétabli.");
      if (etatService.baseRemede) console.error(etatService.baseRemede);
    }
    return r.etat;
  } catch (e) {
    // Le magasin ne devrait pas lever (il retombe sur un état vide), mais un
    // démarrage ne doit jamais dépendre de cette promesse.
    etatDegrade = true;
    noterBase(false, "L'état du service est illisible : " + e.message, e);
    console.error("Démarrage DÉGRADÉ :", e.message);
    return emptyState();
  }
}

// Le domaine (`actes.mjs`) est un objet SANS état propre : on peut le
// réinstancier sur un état rechargé, sans redémarrer le service.
function instancierApi(state) {
  // LE DOMAINE DES BULLETINS d'abord : l'API des actes le reçoit, pour servir
  // ses pages publiques (voir actes.mjs, `pageBulletins`). On lui passe les
  // LECTURES dont il a besoin — les publications du recueil, les réglages, le
  // courriel — et rien de plus : il ne connaît ni MySQL, ni le réseau.
  bulletins = createBulletins({
    state,
    sha256,
    alea: (n = 32) => randomBytes(Math.max(8, Math.ceil(Number(n) / 2))).toString("hex"),
    now: () => new Date().toISOString(),
    save: (json) => json.length <= MAX_STATE_CHARS,
    reglages: reglagesBulletin,
    // Les publications, dans la forme qu'attend le composeur : la dernière
    // version de chaque identifiant ELI, et JAMAIS une publication réservée aux
    // agents — un bulletin part par courriel et se lit en clair sur le recueil.
    // `api` est lu AU MOMENT DE L'APPEL, pas à l'instanciation (elle n'existe
    // pas encore ici).
    publications: async () => (api ? api.publicationsPubliques(false) : []),
    courriel,
    tracer: tracerBulletin,
    maxBulletins: BULLETIN_MAX,
    maxAbonnes: BULLETIN_MAX_ABONNES,
    maxEnvoisParPasse: BULLETIN_ENVOIS_PASSE,
    baseUrl: PUBLIQUE_URL,
    journal: (m) => console.log("[bulletin] " + m),
  });
  api = createActesApi({
    state,
    sha256,
    save: (json) => json.length <= MAX_STATE_CHARS,
    maxDoc: MAX_DOC, maxPublies: MAX_PUBLIES, maxSignatures: MAX_SIGNATURES, maxActes: MAX_ACTES,
    prestataire: prestataireSignature,
    authMode: AUTH_MODE,
    bulletins,
  });
  const b = bulletins.compter();
  console.log(`État du service : ${Object.keys(state.actes).length} acte(s), ${Object.keys(state.signatures).length} circuit(s), ${Object.keys(state.publies).length} publication(s), ${b.bulletins} bulletin(s), ${b.abonnes} abonné(s).`);
}

// L'ÉTAT DÉGRADÉ NE S'ÉCRIT PAS. Un service qui a démarré sans avoir pu lire son
// état a, en mémoire, un état VIDE : l'écrire remplacerait celui de la base — la
// pire perte possible, parce qu'elle serait silencieuse. On refuse le temps que la
// base revienne ; le service recharge alors son état tout seul (`reevaluerBase`).
function refusEtatDegrade() {
  return err("Le service a démarré sans pouvoir lire son état (base indisponible au démarrage) : écrire maintenant effacerait l'état enregistré. Rétablissez la base — le service se recharge de lui-même — puis recommencez.", { code: "etat_degrade" });
}

// RÉÉPROUVER LA BASE, ET SE RÉTABLIR SANS ÊTRE RECRÉÉ.
//
// `baseDisponible` était un VERDICT DE DÉMARRAGE : une fois posé, il ne changeait
// plus. Un exploitant qui suivait le conseil du bandeau (« docker compose run --rm
// db-init ») réparait donc bien le compte, mais gardait un service qui se croyait
// en panne — et, `AUTO_MIGRATE` ne courant qu'au démarrage, une base sans tables :
// le « Table … doesn't exist » au premier écran. On rééprouve donc la base À LA
// DEMANDE, depuis le seul appel que fait l'écran de connexion
// (`GET /v1/auth/config`), au plus une fois toutes les `REESSAI_BASE_MS` :
// schéma si `AUTO_MIGRATE`, épreuve de santé, amorçage de l'administrateur s'il
// avait échoué FAUTE DE BASE, et rechargement de l'état si le service était parti
// sur un état vide.
async function reevaluerBase() {
  if (etatService.baseDisponible !== false) return;
  const maintenant = Date.now();
  if (maintenant - reessaiBaseAt < REESSAI_BASE_MS) return;
  reessaiBaseAt = maintenant;
  if (opt("AUTO_MIGRATE") === true) {
    try { await preparerBase(); }
    catch (e) { console.error("[reprise] Migration automatique impossible :", e.message); }
  }
  let h;
  try {
    h = await health();
  } catch (e) {
    noterBaseSelonErreur(e);
    if (etatService.baseDisponible === null) noterBase(false, e.message, e);
    console.error("[reprise] La base ne répond toujours pas :", e.message);
    return;
  }
  noterBase(true);
  console.log(`[reprise] ${magasin.type === "fichier" ? "Dossier de données" : "Base"} « ${h.base.schema} » de nouveau joignable.`);
  // L'administrateur du `.env` n'est amorcé qu'au démarrage : si c'est la base qui
  // manquait, il ne l'a jamais été, et personne ne pourrait entrer. On ne le
  // refait que sur une PANNE (`adminPanne`) : un mot de passe refusé pour cause de
  // configuration n'est pas à rejouer.
  if (MOT_DE_PASSE && etatService.adminPanne && etatService.adminAmorce !== true) {
    try { await amorcerAdmin(); }
    catch (e) { console.error("[reprise] Amorçage du compte administrateur impossible :", e.message); }
  }
  if (etatDegrade) {
    etatApp = await chargerEtatService();
    instancierApi(etatApp);
  }
}

// -------------------------------------------------------------------- démarrage
async function main() {
  if (process.argv.includes("--reconcilier")) {
    // Le compte applicatif, avant tout le reste : c'est ce qui répare
    // « Access denied for user 'scriba'@… » quand le .env a changé depuis la
    // création du dossier de données. Le schéma est appliqué dans la foulée, avec
    // le compte qui vient d'être aligné (voir la fonction) : la base ressort
    // utilisable. Toujours en succès (voir la fonction).
    try {
      await reconcilierCompte();
    } catch (e) {
      console.error("Alignement du compte applicatif impossible :", e.message);
      console.error("Le compte et son mot de passe sont inscrits au PREMIER démarrage de la base. Si DB_ROOT_PASSWORD n'est plus celui du dossier de données, il n'y a que deux issues : retrouver l'ancien, ou repartir d'un dossier de données vierge (« docker compose down -v && docker compose up -d » — au prix des données).");
    }
    await magasin.fermer();
    return;
  }
  if (process.argv.includes("--migrate")) {
    await preparerBase();
    await magasin.fermer();
    return;
  }
  const iMdp = process.argv.indexOf("--mot-de-passe");
  if (iMdp >= 0) {
    await motDePasseCLI(process.argv[iMdp + 1]);
    await magasin.fermer();
    return;
  }
  // LA BANNIÈRE OUVRE LE JOURNAL. Un exploitant qui ouvre `docker logs` doit lire
  // d'abord ce que le service EST — sa version, sa licence, sa documentation —,
  // avant les messages d'état : c'est la première question qu'on se pose devant
  // un conteneur qui ne se comporte pas comme prévu. Elle ne paraît PAS sur les
  // chemins d'administration (`--reconcilier`, `--migrate`, `--mot-de-passe`),
  // qui rendent la main d'eux-mêmes : leur journal doit rester la trace du seul
  // geste qu'on y a fait.
  console.log(banniere());
  // LE SCHÉMA D'ABORD (idempotent) : il rend la base UTILISABLE, et son échec
  // porte le remède le plus juste (compte refusé, base absente, schéma refusé).
  // On GARDE son erreur : le verdict est reposé APRÈS l'épreuve de santé, pour
  // qu'une base qui répond — mais sans ses tables — ne l'efface pas en annonçant
  // « joignable ».
  let echecSchema = null;
  if (opt("AUTO_MIGRATE") === true) {
    try { await preparerBase(); }
    catch (e) { echecSchema = e; console.error("Migration automatique impossible :", e.message); }
  }
  try {
    const h = await health();
    noterBase(true);
    console.log(`${magasin.type === "fichier" ? "Dossier de données" : "Base"} « ${h.base.schema} » joignable (${h.base.moteur}).`);
  } catch (e) {
    noterBaseSelonErreur(e);
    // Une erreur qui n'est pas une panne de liaison (schéma vide, par exemple)
    // laisse `baseDisponible` à null : on ne dit pas « base injoignable » à tort.
    if (etatService.baseDisponible === null) noterBase(false, e.message, e);
    console.error("La base ne répond pas encore :", e.message);
    console.error(etatService.baseRemede || "Vérifiez DB_HOST / DB_USER / DB_PASSWORD / DB_NAME, puis lancez « node server.mjs --migrate ».");
  }
  // Le verdict de la MIGRATION prime : une base joignable dont le schéma n'a pas
  // pu être appliqué n'est pas une base utilisable, et c'est le motif que l'écran
  // de connexion doit montrer. La base se rétablit ensuite toute seule (voir
  // `reevaluerBase`) — et l'écriture de l'état reste refusée jusque-là.
  if (echecSchema) {
    noterBase(false, "Le schéma n'a pas pu être appliqué : " + echecSchema.message, echecSchema);
    console.error(etatService.baseRemede);
  }
  etatApp = await chargerEtatService();
  instancierApi(etatApp);
  // LA PASSE DU BULLETIN : tout de suite, puis à intervalle régulier. C'est elle
  // qui clôt les périodes échues, compose les numéros et vide la file d'envoi —
  // un service redémarré rattrape donc son retard seul, sans attendre la
  // première échéance d'un minuteur. Elle n'écrit JAMAIS sur un état dégradé :
  // ce serait effacer l'état enregistré (voir `refusEtatDegrade`).
  const passeBulletins = async () => {
    if (!bulletins || etatDegrade) return;
    try {
      const r = await bulletins.assurer();
      const sale = bulletins.takeDirty();
      if (sale) await magasin.ecrireEtat(sale);
      if (r.composees.length) console.log(`[bulletin] ${r.composees.length} numéro(s) composé(s) : ${r.composees.join(", ")}`);
      if (r.envois.total) console.log(`[bulletin] envois de cette passe : ${r.envois.ok} parti(s), ${r.envois.echecs} échec(s).`);
    } catch (e) {
      console.error("[bulletin] passe impossible :", e.message);
    }
  };
  await passeBulletins();
  const minuteurBulletin = setInterval(passeBulletins, Math.max(1, Number(BULLETIN_INTERVALLE_MIN) || 10) * 60000);
  // Le minuteur ne doit pas retenir le processus : un service qu'on arrête
  // s'arrête, il n'attend pas la passe suivante.
  if (minuteurBulletin.unref) minuteurBulletin.unref();
  // Le service de courriel : actif, ou POURQUOI il ne l'est pas. Le bulletin part
  // par courriel (voir `bulletins.mjs`) et l'exploitant doit lire ici, au
  // démarrage, si ses envois sortiront — plutôt que de découvrir au premier
  // numéro que `SMTP_HOST` manquait. `etat()` ne rend aucun secret.
  const etatCourriel = courriel.etat();
  console.log(etatCourriel.disponible
    ? `Courriel : notifications actives — ${etatCourriel.hote}:${etatCourriel.port} (${etatCourriel.securise}), expéditeur ${etatCourriel.expediteur}${etatCourriel.authentifie ? ", authentifié" : ", sans authentification"}.`
    : `Courriel : envoi inactif — ${etatCourriel.raison}`);
  // Le prestataire de signature : branché, ou simulé — et POURQUOI. Un
  // exploitant qui a posé SCRIBA_SIGNATURE_API_URL sans la clé doit le lire ici,
  // plutôt que de découvrir la simulation au premier envoi en signature.
  const etatSig = prestataireSignature.etat();
  console.log(etatSig.actif
    ? `Signature : prestataire « ${etatSig.prestataire} » branché — ${etatSig.url} (niveau ${etatSig.niveau}, délai ${etatSig.timeoutMs} ms, notification ${etatSig.urlNotification || "par défaut"}).`
    : `Signature : circuit électronique SIMULÉ — ${etatSig.motif}.`);
  if (MOT_DE_PASSE) {
    console.log(AUTH_MODE === "oidc"
      ? "Authentification : annuaire de la collectivité (OIDC), ET comptes locaux (mot de passe) — le compte d'administration du .env reste accessible. Les jetons d'API ne sont PAS acceptés dans ce mode."
      : "Authentification : comptes locaux (mot de passe). Les jetons d'API ne sont PAS acceptés dans ce mode.");
    if (DEMO_EFFECTIF) {
      console.warn("DEMO_ACCOUNTS=true : les comptes de démonstration peuvent ouvrir une session sans mot de passe. À éteindre en service.");
    }
    try { await amorcerAdmin(); }
    catch (e) { console.error("Amorçage du compte administrateur impossible :", e.message); }
  } else {
    if (!TOKENS.length) console.warn("ATTENTION : aucun jeton dans API_TOKENS — toutes les écritures seront refusées (503).");
    if (!DEMO_ACCOUNTS) console.warn("AUTH_MODE=demo avec DEMO_ACCOUNTS=false : personne ne pourrait se connecter ; le jeu de démonstration reste autorisé (DEMO_ACCOUNTS n'a de sens qu'avec AUTH_MODE=password).");
  }
  // LE COMMUTATEUR DE DÉMONSTRATION : on dit à l'exploitant ce que les postes
  // recevront, puisqu'il n'est plus réglable depuis l'application.
  console.log(DEMO_JEU
    ? `Démonstration : ALLUMÉE — le jeu fictif est installé par les postes (DEMO=${DEMO_BRUT || "déduit du mode"}). À éteindre (DEMO=false) pour une installation réelle.`
    : "Démonstration : éteinte — les postes partent d'un référentiel vierge, sans donnée fictive.");
  // Les réglages déclaratifs : ce que le `.env` impose au référentiel, et ce qui
  // a été REFUSÉ. Une valeur refusée n'est jamais appliquée en silence — elle le
  // sera aussi dans `GET /v1/config`, pour l'administrateur.
  console.log(`Réglages déclaratifs du référentiel : ${Object.keys(OPTIONS.valeurs).length} variable(s) posée(s).`);
  // L'accès à l'atelier, dit une fois au démarrage : c'est la première chose
  // qu'un exploitant veut vérifier quand il n'arrive plus à entrer.
  console.log(resumeAtelier(OPTIONS.valeurs[CLE_IPS], OPTIONS.valeurs[CLE_MESSAGE]));
  for (const e of OPTIONS.erreurs) console.error(`  REFUSÉE : ${e.variable}=${e.valeur} — ${e.motif}`);
  for (const e of OPTIONS_SERVICE.erreurs) console.error(`  RÉGLAGE DE SERVICE REFUSÉ : ${e.variable} — ${e.motif}`);
  // Le piège qui fait perdre le plus de temps : un conteneur ne relit PAS le
  // `.env` quand on le redémarre. `restart` relance le MÊME conteneur, avec
  // l'environnement figé à sa création ; seul `up -d` (qui recrée) applique un
  // `.env` modifié. Une valeur refusée qui ne correspond pas au fichier est
  // presque toujours cela — on le dit ici, dans le journal de l'exploitant.
  if (OPTIONS.erreurs.length || OPTIONS_SERVICE.erreurs.length) {
    console.error("  Une valeur refusée n'est jamais appliquée. Si elle ne correspond pas au .env, le conteneur a gardé l'environnement de sa CRÉATION : « docker compose up -d » (qui recrée) applique un .env modifié, « docker compose restart » NON.");
  }
  console.log(magasin.type === "fichier"
    ? `Rangement : FICHIERS — dossier « ${DATA_DIR} » (sauvegarde = copie du dossier ; un seul service à la fois).`
    : "Rangement : base de données MySQL / MariaDB.");
  server.listen(PORT, HOST, () => {
    console.log(`${SERVICE} à l'écoute sur http://${HOST}:${PORT}`);
    console.log(`Collections : ${COLLECTIONS.join(", ")}`);
  });
}

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log("\nArrêt…");
    server.close(async () => { try { await magasin.fermer(); } catch (e) {} process.exit(0); });
    setTimeout(() => process.exit(0), 3000);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
