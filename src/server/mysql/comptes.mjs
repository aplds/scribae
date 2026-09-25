// ============================================================================
// Comptes et sessions — le domaine « mot de passe » du service.
//
// Le service peut exiger, à la place d'un jeton d'API, une **vraie connexion** :
// un identifiant, un mot de passe, une session. Trois choses vivent ici, et rien
// d'autre :
//
//   • les MOTS DE PASSE — jamais conservés en clair, jamais renvoyés. Seul un
//     dérivé `scrypt` (N, r, p et sel tirés au hasard, propres à chaque compte)
//     est écrit dans `sb_motdepasse` ;
//   • les SESSIONS — un jeton de 32 octets tiré au hasard, remis au navigateur
//     dans un cookie `HttpOnly`, dont la BASE ne connaît que l'empreinte
//     SHA-256 (`sb_session`). Dérobé, le contenu de la table ne permet pas de
//     se connecter ;
//   • la PORTE D'ENTRÉE (`route`) — le contrat REST de `/v1/auth/…`, appelé par
//     `server.mjs` : connexion LOCALE (identifiant et mot de passe), connexion
//     par l'ANNUAIRE de la collectivité (le service est alors le client OIDC :
//     la découverte, l'échange du code et la vérification du jeton se font
//     ici — voir annuaire-service.mjs — et c'est bien une session de CE
//     service qui s'ouvre), déconnexion, session courante, changement de mot
//     de passe, administration des comptes.
//
// Le module est PUR : il ne connaît ni HTTP, ni MySQL, ni `node:crypto`. On lui
// injecte sa persistance (`store`), sa cryptographie (`crypto`) et son horloge
// (`now`) — comme `actes.mjs` reçoit son empreinte. C'est ce qui le rend
// éprouvable sans base ni réseau (`comptes.test.mjs`), et c'est aussi ce qui
// garantit qu'aucun secret ne se cache dans son code.
//
// Le port `crypto` est volontairement étroit — ce que `server.mjs` remplit avec
// `node:crypto`, et les tests avec une autre implémentation :
//   randomBytes(n)               → Uint8Array de n octets aléatoires
//   scrypt(mdp, sel, {N,r,p,keylen}) → Uint8Array dérivé, ou PROMESSE de dérivé
//   sha256(texte)                → empreinte hexadécimale
//   b64(octets) / deb64(texte)   → base64 standard
//   meme(a, b)                   → comparaison à TEMPS CONSTANT
//   verifierJws({alg, cle, donnees, signature}) → la signature d'un jeton
//     d'identité est-elle la bonne ? (`cle` est une JWK du fournisseur)
//
// `scrypt` PEUT rendre une promesse, et c'est ce que fait le service : `await`
// devant un dérivé synchrone ne coûte rien, un dérivé lent rend la main. Ce
// module ne présume donc jamais de la façon dont le dérivé est calculé — il
// l'attend. Voir le commentaire du port dans `server.mjs`.
//
// Les comptes eux-mêmes (nom, rôles, rattachement) restent dans le référentiel
// de l'application — collection `users` — pour qu'un compte créé ici soit un
// compte de l'application comme un autre. Ce module ne conserve QUE ce qui ne
// doit pas sortir du serveur : le dérivé du mot de passe et les sessions.
//
// Sécurité (ce que ce module met en œuvre, et ce qu'il ne prétend pas être) :
//   • `scrypt` à coût paramétrable (SCRYPT_N) : une attaque par dictionnaire sur
//     la base volée coûte cher, par mot de passe et par sel ;
//   • comparaison à TEMPS CONSTANT (mots de passe et jetons de session) ;
//   • même travail cryptographique et même message quand l'identifiant est
//     inconnu (pas d'énumération des comptes) ;
//   • blocage progressif du compte après plusieurs échecs (SEUIL_ECHECS) ;
//   • jeton de session aléatoire, renouvelé à chaque connexion, avec expiration ;
//   • jeton « anti-CSRF » (double envoi cookie + en-tête) pour les écritures.
// Ce n'est PAS : une authentification à deux facteurs, ni un annuaire, ni une
// protection contre un poste de travail compromis. Pour cela, brancher l'annuaire
// de la collectivité (voir src/lib/oidc.js).
// ============================================================================

import {
  annuaireAccepte, annuaireEffectif, estObjet, partieLocale, revendicationsVersCompte,
  compteApplique, verifierConnexionAnnuaire, decouvrir,
} from "./annuaire-service.mjs";

export const MDP_MIN_LONGUEUR = 12;
export const MDP_MAX_LONGUEUR = 1024;
export const SESSION_JOURS_DEFAUT = 12;
export const SESSION_JOURS_MAX = 90;
export const COOKIE_SESSION = "scribae_session";
export const COOKIE_CSRF = "scribae_csrf";
export const SEUIL_ECHECS = 5;
export const BLOCAGE_MAX_MS = 15 * 60 * 1000;
export const SCRYPT_DEFAUT = { N: 65536, r: 8, p: 1 };

// ------------------------------------------------------------------ utilitaires
export const normaliserLogin = (v) => String(v == null ? "" : v).trim().toLowerCase();

// Un mot de passe acceptable : assez long, et sans lien évident avec le compte.
// On ne prétend pas mesurer l'entropie : on écarte le pire (le login lui-même,
// les suites de touches, les mots de passe les plus répandus).
const MDP_COURANTS = new Set([
  "azertyuiopqs", "qwertyuiopas", "0123456789ab", "motdepasse12", "password1234",
  "administrateur", "administrateur1", "azerty123456", "qwerty123456", "1234567890ab",
  "motdepasse1!", "changeme1234", "scribae12345",
]);
export function motDePasseFaible(login, motDePasse, min = MDP_MIN_LONGUEUR) {
  const mdp = String(motDePasse == null ? "" : motDePasse);
  const l = normaliserLogin(login);
  if (mdp.length < min) return `Le mot de passe doit comporter au moins ${min} caractères.`;
  if (mdp.length > MDP_MAX_LONGUEUR) return `Le mot de passe ne peut pas dépasser ${MDP_MAX_LONGUEUR} caractères.`;
  if (MDP_COURANTS.has(mdp.toLowerCase())) return "Ce mot de passe figure parmi les plus répandus : choisissez-en un autre.";
  // Un mot de passe bâti sur l'identifiant (même allongé de chiffres) se devine :
  // on compare sans tenir compte de la casse ni des séparateurs, pour que
  // « y.dubois2026! » soit refusé comme « ydubois ».
  const compact = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (l && compact(l).length >= 4 && compact(mdp).includes(compact(l))) {
    return "Le mot de passe ne peut pas reprendre l'identifiant du compte.";
  }
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(mdp)).length;
  if (classes < 3) return "Mêlez au moins trois sortes de caractères : minuscules, majuscules, chiffres, symboles.";
  return null;
}

// Le dérivé conservé : `scrypt$N$r$p$sel$empreinte` (base64 standard). Le sel et
// l'empreinte sont binaires ; les paramètres voyagent AVEC le dérivé, ce qui
// permettra de durcir le coût plus tard sans invalider les comptes existants.
//
// Asynchrone : le coût du dérivé ne doit pas arrêter le service (voir le port de
// `server.mjs`). Le format du dérivé, lui, ne change pas — les comptes déjà
// scellés restent lisibles.
export async function scellerMotDePasse(crypto, motDePasse, params = SCRYPT_DEFAUT) {
  const { N, r, p } = params;
  const sel = crypto.randomBytes(16);
  const cle = await crypto.scrypt(String(motDePasse), sel, { N, r, p, keylen: 32 });
  return ["scrypt", N, r, p, crypto.b64(sel), crypto.b64(cle)].join("$");
}

export function lireScelle(crypto, scelle) {
  const parts = String(scelle || "").split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const N = Number(parts[1]), r = Number(parts[2]), p = Number(parts[3]);
  if (!(N > 0 && r > 0 && p > 0)) return null;
  try {
    return { N, r, p, sel: crypto.deb64(parts[4]), cle: crypto.deb64(parts[5]) };
  } catch (e) { return null; }
}

// Vérifie un mot de passe. `needsRehash` signale un dérivé scellé avec des
// paramètres plus faibles que ceux du service : la connexion réussie est
// l'occasion de le recalculer (voir `connexion`).
export async function verifierMotDePasse(crypto, motDePasse, scelle, params = SCRYPT_DEFAUT) {
  const lu = lireScelle(crypto, scelle);
  if (!lu) return { ok: false, needsRehash: false };
  let cle;
  try { cle = await crypto.scrypt(String(motDePasse), lu.sel, { N: lu.N, r: lu.r, p: lu.p, keylen: lu.cle.length }); }
  catch (e) { return { ok: false, needsRehash: false }; }
  const ok = crypto.meme(cle, lu.cle);
  const needsRehash = ok && (lu.N < params.N || lu.r < params.r || lu.p < params.p);
  return { ok, needsRehash };
}

// Un mot de passe provisoire lisible et copiable : 4 groupes de 4 caractères,
// sans lettres ni chiffres que l'on confond (0/O, 1/l/I). Réservé aux remises
// par un administrateur (changement exigé à la première connexion).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
export function genererMotDePasse(crypto, longueur = 16) {
  const octets = crypto.randomBytes(longueur);
  let out = "";
  for (let i = 0; i < longueur; i++) out += ALPHABET[octets[i] % ALPHABET.length];
  return out.replace(/(.{4})(?=.)/g, "$1-");
}

// Le rôle d'application d'un compte : `roles` fait foi, `role` en est le reflet
// (même règle que src/lib/users.js, réduite à ce dont le serveur a besoin).
export const rolesDe = (compte) => {
  const l = Array.isArray(compte?.roles) ? compte.roles.filter(Boolean) : [];
  if (l.length) return l;
  return compte?.role ? [compte.role] : [];
};
export const estAdmin = (compte) => rolesDe(compte).includes("administrateur");

// ------------------------------------------------------------------ cookies
// Un en-tête `Cookie` → un objet. Tolérant : un cookie illisible est ignoré
// plutôt que de faire échouer la requête.
export function lireCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(part.slice(i + 1).trim()); } catch (e) { out[k] = part.slice(i + 1).trim(); }
  }
  return out;
}

export function serialiserCookie(name, value, { maxAge = null, httpOnly = false, secure = true, sameSite = "Lax", path = "/" } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push("HttpOnly");
  if (secure) parts.push("Secure");
  if (maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join("; ");
}

// -------------------------------------------------------------------- erreurs
const err = (code, message, extra) => ({ erreur: message, code, ...(extra || {}) });

// ============================================================================
// Persistance MySQL / MariaDB.
//
// Sept requêtes, rassemblées ici pour que la logique au-dessus les ignore.
//
// LES DATES. Un `DATETIME` de MySQL n'est pas une chaîne quelconque : il attend
// « AAAA-MM-JJ hh:mm:ss[.fff] » et refuse l'ISO 8601 de JavaScript (« …T…Z »),
// qu'une écriture en mode strict rejette — un `INSERT` de session échouait donc,
// et la connexion avec lui. Le magasin remet ses dates sous forme d'objets
// `Date`, et la connexion déclare `timezone: "Z"` (voir server.mjs) : MySQL les
// formate et les relit en UTC, exactement dans le même repère que
// `new Date().toISOString()`.
// ============================================================================

const quand = (v) => (v == null || v === "" ? null : new Date(v));
export function createStoreMysql(pool) {
  return {
    async lireCompte(id) {
      const [rows] = await pool.query("SELECT payload FROM sb_record WHERE collection = 'users' AND id = ?", [String(id)]);
      if (!rows.length) return null;
      try { return JSON.parse(rows[0].payload); } catch (e) { return null; }
    },

    // Recherche par identifiant de connexion : c'est le seul champ sur lequel le
    // service interroge la collection des comptes (elle est petite, et son
    // indexation n'apporterait rien).
    async lireCompteParLogin(login) {
      const [rows] = await pool.query(
        `SELECT id, payload FROM sb_record
          WHERE collection = 'users'
            AND LOWER(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.login'))) = LOWER(?)
          LIMIT 1`,
        [String(login)],
      );
      if (!rows.length) return null;
      try { return JSON.parse(rows[0].payload); } catch (e) { return null; }
    },

    // Le compte déjà rattaché à une identité d'annuaire, dans l'ordre où le
    // navigateur le cherche (voir `applyOidcUser`, src/lib/oidc.js) : par
    // l'identifiant du fournisseur (`oidcSub`, la clé stable — un agent qui
    // change de nom d'usage garde son compte, et ses actes), puis par l'adresse
    // électronique, puis par l'identifiant de connexion. Un compte DÉSACTIVÉ est
    // rendu comme les autres : l'annuaire a reconnu la personne, et la reprise
    // le réactive (voir `compteApplique`).
    async lireCompteParOidc({ sub = "", email = "", login = "" } = {}) {
      const essais = [];
      if (String(sub).trim()) essais.push(["JSON_UNQUOTE(JSON_EXTRACT(payload, '$.oidcSub')) = ?", String(sub).trim()]);
      if (String(email).trim()) essais.push(["LOWER(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.email'))) = LOWER(?)", String(email).trim()]);
      if (String(login).trim()) essais.push(["LOWER(JSON_UNQUOTE(JSON_EXTRACT(payload, '$.login'))) = LOWER(?)", String(login).trim()]);
      for (const [condition, valeur] of essais) {
        const [rows] = await pool.query(
          `SELECT payload FROM sb_record WHERE collection = 'users' AND ${condition} LIMIT 1`,
          [valeur],
        );
        if (!rows.length) continue;
        try { const compte = JSON.parse(rows[0].payload); if (compte) return compte; } catch (e) { /* ligne illisible : on essaie la suivante */ }
      }
      return null;
    },

    // Création du compte lui-même (amorçage depuis `.env`, ou première remise
    // d'un mot de passe à un compte qui n'existe pas encore au référentiel).
    // La révision suit celle de la collection, comme le fait `sync` : le client
    // qui lira la collection ensuite verra un enregistrement cohérent.
    async ecrireCompte(compte) {
      // MÊME IDIOME QUE LE MAGASIN (voir magasin-mysql.mjs) : `ON DUPLICATE KEY
      // UPDATE` prend d'emblée le verrou EXCLUSIF sur la ligne de la collection,
      // là où `INSERT IGNORE` commençait par un verrou PARTAGÉ qu'un `UPDATE`
      // devait ensuite élever — deux écritures simultanées se heurtaient alors
      // (`ER_LOCK_DEADLOCK`). `revision = revision` ne change rien : c'est le
      // no-op qui ne sert qu'à prendre le verrou.
      await pool.query("INSERT INTO sb_collection (name, revision) VALUES ('users', 0) ON DUPLICATE KEY UPDATE revision = revision");
      const [[coll]] = await pool.query("SELECT revision FROM sb_collection WHERE name = 'users'");
      const revision = (Number(coll?.revision) || 0) + 1;
      await pool.query(
        `INSERT INTO sb_record (collection, id, revision, ord, payload, statut, entity_id, updated_by)
         VALUES ('users', ?, ?, 0, ?, ?, ?, 'service')
         ON DUPLICATE KEY UPDATE revision = VALUES(revision), payload = VALUES(payload),
           statut = VALUES(statut), entity_id = VALUES(entity_id), updated_by = VALUES(updated_by)`,
        [String(compte.id), revision, JSON.stringify(compte), compte.role || null, compte.entityId || null],
      );
      await pool.query("UPDATE sb_collection SET revision = ? WHERE name = 'users'", [revision]);
      return true;
    },

    // Les comptes du jeu de démonstration, quand le déploiement a laissé le
    // raccourci ouvert : le navigateur en a besoin AVANT toute session, pour
    // dessiner l'écran de connexion (voir `configPublique`). Le référentiel,
    // lui, n'est lisible qu'avec une session — d'où cette porte étroite, qui
    // ne s'ouvre que si l'opérateur l'a demandé (`DEMO_ACCOUNTS=true`).
    async listerComptesDemo() {
      const [rows] = await pool.query(
        `SELECT payload FROM sb_record
          WHERE collection = 'users'
            AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.source')) = 'demo'`,
      );
      return rows.map((r) => { try { return JSON.parse(r.payload); } catch (e) { return null; } }).filter(Boolean);
    },

    async lireMdp(userId) {
      const [rows] = await pool.query("SELECT hash, must_change, echecs, bloque_jusqua FROM sb_motdepasse WHERE user_id = ?", [String(userId)]);
      return rows[0] || null;
    },

    async ecrireMdp(userId, { hash, mustChange = false }) {
      await pool.query(
        `INSERT INTO sb_motdepasse (user_id, hash, must_change, echecs, bloque_jusqua)
         VALUES (?, ?, ?, 0, NULL)
         ON DUPLICATE KEY UPDATE hash = VALUES(hash), must_change = VALUES(must_change),
           echecs = 0, bloque_jusqua = NULL`,
        [String(userId), hash, mustChange ? 1 : 0],
      );
    },

    async majEchecs(userId, { echecs, bloqueJusqua }) {
      await pool.query("UPDATE sb_motdepasse SET echecs = ?, bloque_jusqua = ? WHERE user_id = ?", [
        Number(echecs) || 0, quand(bloqueJusqua), String(userId),
      ]);
    },

    async listerMdp() {
      const [rows] = await pool.query("SELECT user_id, must_change, echecs, bloque_jusqua, updated_at FROM sb_motdepasse");
      return rows.map((r) => ({
        userId: r.user_id, mustChange: !!r.must_change, echecs: Number(r.echecs) || 0,
        bloqueJusqua: r.bloque_jusqua, updatedAt: r.updated_at,
      }));
    },

    async supprimerMdp(userId) {
      await pool.query("DELETE FROM sb_motdepasse WHERE user_id = ?", [String(userId)]);
      await pool.query("DELETE FROM sb_session WHERE user_id = ?", [String(userId)]);
    },

    async creerSession(s) {
      await pool.query(
        "INSERT INTO sb_session (token_hash, user_id, created_at, last_seen_at, expires_at, remote_ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [s.tokenHash, String(s.userId), quand(s.at), quand(s.at), quand(s.expiresAt), s.ip || null, String(s.userAgent || "").slice(0, 255) || null],
      );
    },

    async lireSession(tokenHash) {
      const [rows] = await pool.query("SELECT user_id, expires_at, last_seen_at FROM sb_session WHERE token_hash = ?", [tokenHash]);
      return rows[0] || null;
    },

    async toucherSession(tokenHash, at) {
      await pool.query("UPDATE sb_session SET last_seen_at = ? WHERE token_hash = ?", [quand(at), tokenHash]);
    },

    async supprimerSession(tokenHash) {
      await pool.query("DELETE FROM sb_session WHERE token_hash = ?", [tokenHash]);
    },

    async purgerSessions(at) {
      await pool.query("DELETE FROM sb_session WHERE expires_at < ?", [quand(at)]);
    },
  };
}

// ============================================================================
// Le domaine.
// ============================================================================
export function createComptes({
  store,
  crypto,
  now = () => new Date(),
  sessionJours = SESSION_JOURS_DEFAUT,
  mdpMin = MDP_MIN_LONGUEUR,
  scryptParams = SCRYPT_DEFAUT,
  // Comptes de démonstration autorisés (le raccourci « choisir un compte », sans
  // mot de passe). Éteint par défaut : c'est le réglage de la production.
  demoAutorise = false,
  // Le service exige-t-il une session ? (sinon, il est en mode démonstration à
  // jeton : la porte des comptes reste ouverte pour préparer la bascule.)
  sessionRequise = true,
  // --- l'annuaire de la collectivité (voir annuaire-service.mjs) -------------
  // Ce que le service a PUBLIÉ de l'annuaire (référentiel relu par lui, puis
  // `SCRIBA_ANNUAIRE_*` du `.env` par-dessus), ou `null`. C'est le même
  // document que celui de `GET /v1/auth/config` : un seul chemin pour un seul
  // réglage. Les défauts du navigateur sont appliqués par-dessus ici
  // (`annuaireEffectif`), pour que les deux côtés lisent la même chose.
  lireAnnuaire = async () => null,
  // Le référentiel (`config`), pour le PÉRIMÈTRE : les services et les entités
  // auxquels les revendications de l'annuaire rattachent l'agent.
  lireReferentiel = async () => null,
  // LE RÉSEAU, injecté comme le reste : `httpJson(url, init)` →
  // `{ ok, status, body, text }` (voir le port dans server.mjs). C'est le seul
  // chemin par lequel ce module parle au fournisseur d'identité — et il n'y en
  // a aucun en dehors du service, si bien que les épreuves n'ont pas de réseau
  // à simuler : elles posent un faux.
  httpJson = null,
  // Le mode du déploiement (`AUTH_MODE`) : « oidc » fait de l'annuaire la porte
  // ordinaire ; « password » n'en fait qu'une SECONDE PORTE, ouverte seulement
  // si le référentiel la demande (`auth.annuaire`).
  modeDeploiement = "",
} = {}) {
  // Un dérivé factice, de coût identique : vérifié quand l'identifiant est
  // inconnu, pour que la durée de la réponse ne dise pas si le compte existe.
  //
  // ENGAGÉ dès la construction, et non calculé à la première demande : le dérivé
  // se calcule pendant que le service s'installe (il ne bloque rien : le port de
  // crypto est asynchrone), et une vérification à vide coûte alors EXACTEMENT ce
  // que coûte la vérification d'un compte — sans quoi la toute première tentative
  // sur un identifiant inconnu serait deux fois plus lente, et le temps de
  // réponse trahirait ce que le message s'applique à taire.
  const facticeEngage = scellerMotDePasse(crypto, "scribe-aucun-compte-" + "x".repeat(24), scryptParams)
    .catch(() => scellerMotDePasse(crypto, "scribe-aucun-compte-" + "x".repeat(24), scryptParams));
  const jours = Math.min(Math.max(Number(sessionJours) || SESSION_JOURS_DEFAUT, 1), SESSION_JOURS_MAX);
  const ttlMs = jours * 24 * 3600 * 1000;
  const iso = (d) => (d instanceof Date ? d : new Date(d)).toISOString();
  const ms = (d) => (d == null ? 0 : new Date(d).getTime() || 0);

  // ------------------------------------------------------------------ sessions
  const empreinte = (jeton) => crypto.sha256(String(jeton));

  async function compteDeSession(jeton) {
    if (!jeton) return null;
    const ligne = await store.lireSession(empreinte(jeton));
    if (!ligne) return null;
    if (ms(ligne.expires_at) <= now().getTime()) { await store.supprimerSession(empreinte(jeton)).catch(() => {}); return null; }
    const compte = await store.lireCompte(ligne.user_id);
    if (!compte) return null;
    // La session suit la vie du compte : un compte désactivé perd l'accès
    // immédiatement, sans attendre l'expiration de son jeton.
    if (compte.active === false) return null;
    if (compte.source === "demo" && !demoAutorise) return null;
    return { compte, ligne, jeton };
  }

  async function ouvrirSession(compte, { ip, userAgent } = {}) {
    const jeton = crypto.randomBytes(32).toString("base64url");
    const csrf = crypto.randomBytes(24).toString("base64url");
    const at = iso(now());
    await store.creerSession({
      tokenHash: empreinte(jeton), userId: compte.id, at,
      expiresAt: iso(new Date(now().getTime() + ttlMs)), ip, userAgent,
    });
    // Purge opportuniste : les sessions expirées ne s'accumulent pas.
    store.purgerSessions(at).catch(() => {});
    return { jeton, csrf };
  }

  const cookiesDeSession = (jeton, csrf, { secure }) => [
    serialiserCookie(COOKIE_SESSION, jeton, { httpOnly: true, secure, maxAge: Math.floor(ttlMs / 1000) }),
    // Le jeton anti-CSRF n'est PAS `HttpOnly` : c'est le JavaScript de
    // l'application qui doit pouvoir le relire pour le renvoyer en en-tête.
    serialiserCookie(COOKIE_CSRF, csrf, { httpOnly: false, secure, maxAge: Math.floor(ttlMs / 1000) }),
  ];
  const cookiesEffaces = ({ secure }) => [
    serialiserCookie(COOKIE_SESSION, "", { httpOnly: true, secure, maxAge: 0 }),
    serialiserCookie(COOKIE_CSRF, "", { httpOnly: false, secure, maxAge: 0 }),
  ];

  // ------------------------------------------------------------------- comptes
  // Ce que le service sait d'un mot de passe, SANS le mot de passe : c'est ce que
  // l'écran « Comptes et rôles » affiche, et ce qu'un administrateur peut
  // réinitialiser.
  async function etatComptes() {
    const rows = await store.listerMdp();
    const at = now().getTime();
    return rows.map((r) => ({
      userId: r.userId,
      defini: true,
      mustChange: !!r.mustChange,
      updatedAt: r.updatedAt || null,
      echecs: r.echecs || 0,
      bloqueJusqua: r.bloqueJusqua || null,
      bloque: !!r.bloqueJusqua && ms(r.bloqueJusqua) > at,
    }));
  }

  async function definirMotDePasse(userId, motDePasse, { mustChange = false } = {}) {
    const compte = await store.lireCompte(userId);
    if (!compte) return { ok: false, code: "compte_inconnu", message: "Ce compte n'existe pas au référentiel." };
    const faible = motDePasseFaible(compte.login || userId, motDePasse, mdpMin);
    if (faible) return { ok: false, code: "mot_de_passe_faible", message: faible };
    await store.ecrireMdp(compte.id, { hash: await scellerMotDePasse(crypto, motDePasse, scryptParams), mustChange });
    return { ok: true, userId: compte.id };
  }

  // Une remise par un administrateur : mot de passe tiré au hasard, changé à la
  // première connexion. C'est le geste courant à la création d'un compte.
  async function remettreMotDePasse(userId) {
    const motDePasse = genererMotDePasse(crypto);
    const r = await definirMotDePasse(userId, motDePasse, { mustChange: true });
    if (!r.ok) return r;
    return { ok: true, userId: r.userId, motDePasse };
  }

  async function retirerMotDePasse(userId) {
    const compte = await store.lireCompte(userId);
    if (!compte) return { ok: false, code: "compte_inconnu", message: "Ce compte n'existe pas au référentiel." };
    await store.supprimerMdp(compte.id);
    return { ok: true, userId: compte.id };
  }

  // ------------------------------------------------------------------ connexion
  async function connexion({ login, motDePasse, ip, userAgent, csrf }) {
    const l = normaliserLogin(login);
    const refus = { ok: false, code: "identifiants_invalides", message: "Identifiant ou mot de passe incorrect." };
    if (!l || !motDePasse) return refus;

    const compte = await store.lireCompteParLogin(l);
    const mdp = compte ? await store.lireMdp(compte.id) : null;

    // Compte connu mais bloqué : on le dit, sans vérifier le mot de passe (le
    // blocage protège aussi des tentatives distribuées).
    if (mdp && mdp.bloque_jusqua && ms(mdp.bloque_jusqua) > now().getTime()) {
      const reste = Math.ceil((ms(mdp.bloque_jusqua) - now().getTime()) / 1000);
      return { ok: false, code: "trop_de_tentatives", message: "Trop de tentatives : ce compte est bloqué quelques instants.", retryAfterSec: reste };
    }

    // Le dérivé de comparaison : celui du compte, ou le dérivé factice — engagé
    // au démarrage du service.
    const scelle = (mdp && mdp.hash) || (await facticeEngage);
    const verif = await verifierMotDePasse(crypto, motDePasse, scelle, scryptParams);
    if (!compte || !verif.ok) {
      // L'échec est compté sur le compte, s'il existe : c'est lui que l'on
      // protège. Le message, lui, ne dit jamais si l'identifiant existe.
      if (mdp) {
        const echecs = (Number(mdp.echecs) || 0) + 1;
        const blocage = echecs >= SEUIL_ECHECS
          ? iso(new Date(now().getTime() + Math.min(BLOCAGE_MAX_MS, 5000 * Math.pow(2, Math.min(echecs - SEUIL_ECHECS, 8)))))
          : null;
        await store.majEchecs(compte.id, { echecs, bloqueJusqua: blocage });
      }
      return refus;
    }

    if (compte.active === false) {
      return { ok: false, code: "compte_desactive", message: "Ce compte est désactivé. Adressez-vous à un administrateur de l'application." };
    }
    if (compte.source === "demo" && !demoAutorise) {
      return { ok: false, code: "compte_de_demonstration", message: "Les comptes de démonstration sont désactivés sur ce service." };
    }

    await store.majEchecs(compte.id, { echecs: 0, bloqueJusqua: null });
    // Un dérivé scellé avec des paramètres plus faibles est recalculé au passage.
    await store.ecrireMdp(compte.id, { hash: verif.needsRehash ? await scellerMotDePasse(crypto, motDePasse, scryptParams) : mdp.hash, mustChange: !!mdp.must_change });
    const { jeton, csrf: csrfNeuf } = await ouvrirSession(compte, { ip, userAgent });
    return { ok: true, jeton, csrf: csrfNeuf, utilisateur: compte, mustChange: !!mdp.must_change };
  }

  // Connexion « de démonstration » : le compte est choisi dans la liste, sans
  // mot de passe. Réservée aux comptes du jeu de démonstration, et seulement
  // quand `DEMO_ACCOUNTS=true` l'autorise explicitement.
  async function connexionDemo({ userId, ip, userAgent }) {
    if (!demoAutorise) return { ok: false, code: "demonstration_desactivee", message: "Les comptes de démonstration sont désactivés sur ce service." };
    const compte = await store.lireCompte(userId);
    if (!compte) return { ok: false, code: "compte_inconnu", message: "Compte inconnu." };
    if (compte.active === false) return { ok: false, code: "compte_desactive", message: "Ce compte est désactivé." };
    if (compte.source !== "demo") return { ok: false, code: "compte_non_demonstration", message: "Seuls les comptes de démonstration se connectent ainsi." };
    const { jeton, csrf } = await ouvrirSession(compte, { ip, userAgent });
    return { ok: true, jeton, csrf, utilisateur: compte, mustChange: false };
  }

  async function changerMotDePasse(userId, { ancien, nouveau }) {
    const compte = await store.lireCompte(userId);
    if (!compte) return { ok: false, code: "compte_inconnu", message: "Compte inconnu." };
    const mdp = await store.lireMdp(compte.id);
    if (!mdp) return { ok: false, code: "aucun_mot_de_passe", message: "Ce compte n'a pas encore de mot de passe." };
    const verif = await verifierMotDePasse(crypto, ancien, mdp.hash, scryptParams);
    if (!verif.ok) return { ok: false, code: "ancien_mot_de_passe", message: "Le mot de passe actuel est incorrect." };
    const faible = motDePasseFaible(compte.login || compte.id, nouveau, mdpMin);
    if (faible) return { ok: false, code: "mot_de_passe_faible", message: faible };
    if (normaliserLogin(ancien) === normaliserLogin(nouveau)) return { ok: false, code: "mot_de_passe_identique", message: "Le nouveau mot de passe doit différer de l'ancien." };
    await store.ecrireMdp(compte.id, { hash: await scellerMotDePasse(crypto, nouveau, scryptParams), mustChange: false });
    return { ok: true };
  }

  async function deconnexion(jeton) {
    if (jeton) await store.supprimerSession(empreinte(jeton));
    return { ok: true };
  }

  // ==========================================================================
  // La porte : `/v1/auth/…`.
  //
  // `route(req, ctx)` reçoit `{ method, path, headers, body }` (comme le fait
  // `actes.mjs`) et rend `{ status, headers, body }`. `ctx.sessionRequise` et
  // `ctx.secure` sont posés par le serveur HTTP.
  // ==========================================================================
  const utilisateurPublic = (compte) => compte;

  // ---------------------------------------------- l'annuaire de la collectivité
  // LES RÉGLAGES EFFECTIFS, relus à chaque connexion : un réglage change donc
  // dans l'interface sans qu'on redémarre le service (le cache court est tenu
  // par `annuairePublie`, server.mjs).
  async function annuaireCourant() {
    try {
      return annuaireEffectif({ publie: await lireAnnuaire(), modeDeploiement });
    } catch (e) {
      console.error("[annuaire]", e && e.message);
      return null;
    }
  }

  // L'identifiant de connexion d'un compte créé par l'annuaire : la partie
  // locale de son adresse, rendue UNIQUE (même règle que `uniqueLogin`, à la
  // création d'un compte dans l'application). Deux agents « jean.dupont » de
  // services différents ne doivent pas se disputer le même identifiant : c'est
  // celui des journaux et de la présence, pas de l'authentification.
  async function loginLibre(voulu) {
    const base = normaliserLogin(voulu) || "compte";
    if (!(await store.lireCompteParLogin(base))) return base;
    for (let i = 2; i < 500; i++) if (!(await store.lireCompteParLogin(base + i))) return base + i;
    return base + "-" + crypto.randomBytes(3).toString("hex");
  }

  // L'annuaire branché DÉSACTIVE les comptes de démonstration — un jeu fictif
  // qui garderait des comptes actifs à côté d'un annuaire réel serait une porte
  // dérobée. C'est la même règle que `syncDemoAccounts` côté navigateur
  // (src/lib/auth.js) ; ici, elle est appliquée par le service, car c'est lui
  // qui vient d'authentifier l'agent. La RÉACTIVATION, elle, reste au
  // navigateur : c'est lui qui connaît l'état du réglage (voir `syncDemoAccounts`).
  async function desactiverComptesDemo() {
    const at = iso(now());
    let demo = [];
    try { demo = await store.listerComptesDemo(); } catch (e) { return; }
    for (const compte of demo) {
      if (!compte || (compte.active === false && compte.deactivatedBy === "oidc")) continue;
      await store.ecrireCompte({ ...compte, active: false, deactivatedBy: "oidc", deactivatedAt: at });
    }
  }

  // LA CONNEXION PAR L'ANNUAIRE. Le service est le client OIDC : il découvre le
  // fournisseur, échange le code (avec le vérificateur PKCE que le navigateur a
  // gardé), vérifie le jeton d'identité, en tire un compte, l'écrit au
  // référentiel et ouvre SA session — un cookie `HttpOnly`, exactement comme la
  // connexion par mot de passe. C'est ce qui fait qu'un agent entré par
  // l'annuaire lit les actes comme les autres, et que le fournisseur n'a pas
  // besoin de parler CORS (aucun appel ne part du navigateur).
  async function connexionAnnuaire({ code, verifier, redirectUri = "", nonce = "", ip, userAgent } = {}) {
    const auth = await annuaireCourant();
    if (!auth || !annuaireAccepte(auth)) {
      return { ok: false, code: "annuaire_non_branche", message: "L'annuaire de la collectivité n'est pas branché sur ce service (Administration › Annuaire, ou SCRIBA_ANNUAIRE_* du .env)." };
    }
    if (typeof httpJson !== "function") {
      return { ok: false, code: "reseau_indisponible", message: "Ce service n'a pas le moyen d'appeler un fournisseur d'identité : la connexion par l'annuaire n'est pas disponible ici." };
    }
    if (!String(code || "").trim() || !String(verifier || "").trim()) {
      return { ok: false, code: "code_manquant", message: "Le code d'autorisation et le vérificateur PKCE sont requis." };
    }

    const verdict = await verifierConnexionAnnuaire({ auth, code, verifier, redirectUri, nonce, httpJson, crypto, now });
    if (!verdict.ok) return { ok: false, code: verdict.code, message: verdict.erreur, checks: verdict.checks };

    const referentiel = await lireReferentiel().catch(() => null);
    const sub = String(verdict.claims.sub || "");
    const email = String(verdict.claims.email || verdict.claims.preferred_username || "").trim();
    const existant = await store.lireCompteParOidc({ sub, email, login: partieLocale(email) });
    if (!existant && auth.autoProvision === false) {
      return {
        ok: false, code: "compte_inconnu",
        message: "Aucun compte ne correspond à cette identité (" + (email || sub || "inconnue") + ") et la création automatique est désactivée dans le référentiel. Demandez à un administrateur de pré-enregistrer le compte.",
      };
    }

    const res = revendicationsVersCompte({ referentiel, auth, claims: verdict.claims, existing: existant, now });
    const fiche = compteApplique({ existant, patch: res.patch, principal: res.role });
    if (!existant) {
      fiche.id = "u-" + crypto.randomBytes(6).toString("hex");
      fiche.login = await loginLibre(partieLocale(email) || sub);
      fiche.createdAt = iso(now());
      fiche.memberships = Array.isArray(fiche.memberships) ? fiche.memberships : [];
    }
    fiche.lastLogin = iso(now());
    await store.ecrireCompte(fiche);
    if (auth.disableDemo !== false) await desactiverComptesDemo();

    const { jeton, csrf } = await ouvrirSession(fiche, { ip, userAgent });
    return {
      ok: true, jeton, csrf, utilisateur: fiche,
      checks: verdict.checks, warnings: verdict.warnings,
      created: !existant, linked: existant ? "reprise" : "création",
      role: res.role, visiteur: res.visiteur, reason: res.reason,
    };
  }

  function sessionCourante(req) {
    const cookies = lireCookies(req.headers && req.headers.cookie);
    return {
      jeton: cookies[COOKIE_SESSION] || "",
      csrf: cookies[COOKIE_CSRF] || "",
      entete: String((req.headers && req.headers["x-csrf-token"]) || ""),
    };
  }

  // L'anti-CSRF : le cookie (posé par nous, illisible d'un autre site) doit
  // correspondre à l'en-tête (que seul le JavaScript de notre origine peut
  // poser, car une requête « simple » ne peut pas porter d'en-tête personnalisé).
  function csrfValide(req) {
    const { csrf, entete } = sessionCourante(req);
    if (!csrf || !entete) return false;
    return crypto.meme(String(csrf), String(entete));
  }
  const csrfObligatoire = (req) => ["POST", "PUT", "PATCH", "DELETE"].includes(String(req.method || "GET").toUpperCase());

  const json = (status, body, headers) => ({ status, headers: { "content-type": "application/json; charset=utf-8", ...(headers || {}) }, body });
  const ok = (body, headers) => json(200, body, headers);
  // `ko` porte lui aussi des en-têtes : le refus d'une connexion bloquée annonce
  // `retry-after`, pour que le client sache quand revenir (voir `connexion`).
  const ko = (status, body, headers) => json(status, body, headers);

  // Ce que l'écran de connexion doit savoir AVANT toute session : le mode du
  // service, les règles du mot de passe, et — si le déploiement a laissé le
  // raccourci de démonstration ouvert — les comptes de démonstration, sans
  // lesquels ce raccourci ne pourrait pas exister (le référentiel, lui, n'est
  // lisible qu'avec une session). Rien de secret : un mot de passe n'y figure
  // jamais, et aucun autre compte n'y figure.
  const compteDeDemonstration = (c) => ({
    id: c.id, login: c.login, civility: c.civility,
    firstName: c.firstName, lastName: c.lastName,
    role: c.role, roles: c.roles, entityId: c.entityId,
    memberships: c.memberships, source: c.source, active: c.active !== false,
  });

  async function configPublique() {
    const base = { auth: "password", demo: !!demoAutorise, motDePasseMin: mdpMin, sessionJours: jours, csrf: true };
    if (!demoAutorise) return base;
    let demoComptes = [];
    try {
      demoComptes = (await store.listerComptesDemo())
        .filter((c) => c && c.active !== false)
        .map(compteDeDemonstration);
    } catch (e) { demoComptes = []; /* la démonstration n'est qu'un confort */ }
    return { ...base, demoComptes };
  }

  async function route(req, ctx = {}) {
    const method = String(req.method || "GET").toUpperCase();
    const path = String(req.path || "/");
    const secure = ctx.secure !== false;
    const ip = ctx.ip || "";

    if (path === "/v1/auth/config" && method === "GET") return ok(await configPublique());
    if (path === "/v1/auth" || path === "/v1/auth/") return ok({ service: "Scribe — comptes", auth: "password", demo: !!demoAutorise });

    // ---- connexion : la seule route ouverte sans session ---------------------
    if (path === "/v1/auth/connexion" && method === "POST") {
      const body = req.body || {};
      const res = await connexion({ login: body.login ?? body.identifiant, motDePasse: body.motDePasse ?? body.password, ip, userAgent: (req.headers && req.headers["user-agent"]) || "" });
      if (!res.ok) {
        const headers = res.retryAfterSec ? { "retry-after": String(res.retryAfterSec) } : undefined;
        return ko(res.code === "trop_de_tentatives" ? 429 : 401, err(res.code, res.message), headers);
      }
      // LE JETON ANTI-CSRF VOYAGE AUSSI DANS LE CORPS, ici comme dans
      // `GET /v1/auth/session` : le cookie n'est lisible que par les pages de SON
      // hôte, et une application servie par un autre hôte que le service n'en
      // verrait rien. Sans le jeton dans la réponse, ses PREMIÈRES écritures —
      // celles du démarrage, juste après la connexion — partaient sans en-tête
      // et étaient refusées (`csrf_invalide`), jusqu'à ce qu'une relecture de
      // session le lui rende.
      return ok({ utilisateur: utilisateurPublic(res.utilisateur), mustChange: !!res.mustChange, csrf: res.csrf },
        { "set-cookie": cookiesDeSession(res.jeton, res.csrf, { secure }) });
    }

    if (path === "/v1/auth/demo" && method === "POST") {
      const res = await connexionDemo({ userId: (req.body || {}).userId, ip, userAgent: (req.headers && req.headers["user-agent"]) || "" });
      if (!res.ok) return ko(res.code === "demonstration_desactivee" ? 403 : 401, err(res.code, res.message));
      return ok({ utilisateur: utilisateurPublic(res.utilisateur), mustChange: false, csrf: res.csrf },
        { "set-cookie": cookiesDeSession(res.jeton, res.csrf, { secure }) });
    }

    // ---- connexion par l'ANNUAIRE DE LA COLLECTIVITÉ -------------------------
    // La seule autre route ouverte sans session, à côté de la connexion locale :
    // le retour du fournisseur d'identité arrive ici. Le service échange le
    // code, vérifie le jeton et ouvre la session (voir `connexionAnnuaire`).
    // Le corps porte le code, le vérificateur PKCE (gardé par le navigateur),
    // le `nonce` et l'adresse de retour ; RIEN d'autre : les points de
    // terminaison et l'identifiant du client viennent des réglages du service,
    // jamais du navigateur — un service ne va pas chercher une adresse
    // arbitraire pour le premier venu.
    if (path === "/v1/auth/annuaire" && method === "POST") {
      const body = req.body || {};
      const res = await connexionAnnuaire({
        code: body.code,
        verifier: body.verifier ?? body.code_verifier,
        redirectUri: body.redirectUri ?? body.redirect_uri ?? "",
        nonce: body.nonce ?? "",
        ip,
        userAgent: (req.headers && req.headers["user-agent"]) || "",
      });
      if (!res.ok) {
        // 404 : rien à brancher ; 403 : l'identité est refusée ou inconnue
        // (jeton refusé, compte inconnu et création automatique éteinte) ; 401 :
        // tout le reste (code invalide, fournisseur injoignable, échange refusé).
        const statut = res.code === "annuaire_non_branche" ? 404
          : ["jeton_refuse", "compte_inconnu"].includes(res.code) ? 403
            : res.code === "reseau_indisponible" ? 503 : 401;
        return ko(statut, err(res.code, res.message, res.checks ? { checks: res.checks } : undefined));
      }
      return ok({
        utilisateur: utilisateurPublic(res.utilisateur), mustChange: false, csrf: res.csrf,
        checks: res.checks, warnings: res.warnings,
        created: res.created, linked: res.linked, role: res.role, visiteur: res.visiteur, motif: res.reason || "",
      }, { "set-cookie": cookiesDeSession(res.jeton, res.csrf, { secure }) });
    }

    // ---- éprouver l'annuaire AVANT de s'y connecter --------------------------
    // C'est le bouton « Découverte » de l'administration : le SERVICE lit le
    // document du fournisseur et rend les points de terminaison. L'appel part
    // donc du service, pas du navigateur : un fournisseur sans en-têtes CORS
    // (Keycloak, LemonLDAP, ADFS…) se branche comme les autres.
    //
    // Ce que l'appelant peut demander dépend de qui il est : un ADMINISTRATEUR
    // fait éprouver l'adresse qu'il vient de saisir (et ses points de
    // terminaison à la main, le cas échéant) ; tout autre appelant n'obtient
    // que ce que le service a déjà enregistré — le document de découverte est
    // public, mais le service ne devient pas un relais ouvert pour autant.
    if (path === "/v1/auth/annuaire/decouverte" && method === "POST") {
      const body = req.body || {};
      // L'ORDRE DES DEUX REFUS COMPTE : « rien n'est branché » (404) se dit avant
      // « je ne peux pas appeler » (503) — c'est la cause première, et la seule
      // qui se répare en cliquant dans Administration › Annuaire.
      const configure = await annuaireCourant();
      if (!configure) return ko(404, err("annuaire_non_branche", "L'annuaire de la collectivité n'est pas branché sur ce service."));
      if (typeof httpJson !== "function") return ko(503, err("reseau_indisponible", "Ce service n'a pas le moyen d'appeler un fournisseur d'identité."));
      const session = await compteDeSession(sessionCourante(req).jeton).catch(() => null);
      if (session && csrfObligatoire(req) && !csrfValide(req)) {
        return ko(403, err("csrf_invalide", "Jeton anti-CSRF absent ou incorrect : rechargez la page, puis réessayez."));
      }
      const demande = String(body.issuer || "").trim();
      const endpoints = estObjet(body.endpoints) ? body.endpoints : null;
      const cible = session && estAdmin(session.compte) && (demande || endpoints)
        ? {
          ...configure,
          issuer: demande || (configure.issuer || ""),
          endpoints: endpoints || (configure.endpoints || {}),
        }
        : configure;
      const res = await decouvrir({ auth: cible, httpJson });
      if (!res.ok) return ko(502, err(res.code, res.erreur));
      return ok(res);
    }

    // ---- à partir d'ici : une session est nécessaire -------------------------
    const courante = sessionCourante(req);
    const session = await compteDeSession(courante.jeton).catch(() => null);
    if (!session) {
      // Une session expirée est effacée au passage, pour que le navigateur ne la
      // renvoie pas indéfiniment.
      const headers = courante.jeton ? { "set-cookie": cookiesEffaces({ secure }) } : undefined;
      return json(401, err("session_absente", "Session absente ou expirée : reconnectez-vous."), headers);
    }
    if (csrfObligatoire(req) && !csrfValide(req)) {
      return ko(403, err("csrf_invalide", "Jeton anti-CSRF absent ou incorrect : rechargez la page, puis réessayez."));
    }
    const compte = session.compte;

    if (path === "/v1/auth/session" && method === "GET") {
      // On rafraîchit l'horodatage d'activité (au plus une fois toutes les cinq
      // minutes : ce n'est pas une écriture par requête).
      if (now().getTime() - ms(session.ligne.last_seen_at) > 5 * 60 * 1000) {
        await store.toucherSession(empreinte(courante.jeton), iso(now())).catch(() => {});
      }
      const mdp = await store.lireMdp(compte.id);
      // LE JETON ANTI-CSRF VOYAGE AUSSI DANS LE CORPS. Il vit dans le cookie
      // (double envoi), mais le JavaScript de la page ne peut lire que les
      // cookies de SON hôte : quand l'application est servie par un autre hôte
      // que le service, elle ne peut pas le lire, et chaque écriture était
      // refusée (`csrf_invalide`) alors que la session, elle, était valide. Le
      // service le rend donc ici : l'application le garde et le renvoie dans
      // l'en-tête. Le cookie reste la source, et le double envoi garde son sens —
      // un autre site ne peut pas lire cette réponse (aucun en-tête CORS ne
      // l'autorise).
      const csrf = courante.csrf || crypto.randomBytes(24).toString("base64url");
      // Cookie absent (refusé par le navigateur, session ouverte par un autre
      // outil) : on en repose un, sinon AUCUNE écriture ne passerait jusqu'à la
      // prochaine connexion, sans autre issue que de se reconnecter.
      const entetes = courante.csrf ? undefined
        : { "set-cookie": serialiserCookie(COOKIE_CSRF, csrf, { httpOnly: false, secure, maxAge: Math.floor(ttlMs / 1000) }) };
      return json(200, { utilisateur: utilisateurPublic(compte), mustChange: !!mdp?.must_change, csrf }, entetes);
    }

    if (path === "/v1/auth/deconnexion" && method === "POST") {
      await deconnexion(courante.jeton);
      return ok({ ok: true }, { "set-cookie": cookiesEffaces({ secure }) });
    }

    if (path === "/v1/auth/mot-de-passe" && method === "POST") {
      const body = req.body || {};
      const res = await changerMotDePasse(compte.id, { ancien: body.ancien ?? body.actuel, nouveau: body.nouveau });
      if (!res.ok) return ko(res.code === "mot_de_passe_faible" ? 422 : 400, err(res.code, res.message));
      return ok({ ok: true });
    }

    // ---- administration des comptes -----------------------------------------
    if (path.startsWith("/v1/auth/comptes")) {
      if (!estAdmin(compte)) return ko(403, err("droit_requis", "Cette action demande le rôle administrateur."));

      if (path === "/v1/auth/comptes" && method === "GET") {
        return ok({ comptes: await etatComptes() });
      }

      const mReset = /^\/v1\/auth\/comptes\/([^/]+)\/mot-de-passe$/.exec(path);
      if (mReset) {
        const userId = decodeURIComponent(mReset[1]);
        if (method === "POST") {
          const body = req.body || {};
          const voulu = body.motDePasse ?? body.motDePasseProvisoire;
          // Sans mot de passe proposé, le service en ENGENDRE un et le rend une
          // seule fois : c'est la remise d'un accès à un agent.
          const res = voulu
            ? await definirMotDePasse(userId, voulu, { mustChange: body.mustChange !== false })
            : await remettreMotDePasse(userId);
          if (!res.ok) return ko(res.code === "mot_de_passe_faible" ? 422 : 404, err(res.code, res.message));
          return ok({ userId: res.userId, motDePasse: res.motDePasse || null, provisoire: !voulu });
        }
        if (method === "DELETE") {
          const res = await retirerMotDePasse(userId);
          if (!res.ok) return ko(404, err(res.code, res.message));
          return ok({ ok: true });
        }
      }

      return ko(404, err("ressource_inconnue", "Ressource inconnue : " + path));
    }

    return ko(404, err("ressource_inconnue", "Ressource inconnue : " + path));
  }

  return {
    // Configuration (ASYNCHRONE : quand le raccourci de démonstration est
    // ouvert, elle va lire la liste des comptes de démonstration au référentiel).
    config: configPublique,
    // Portes d'entrée programmatiques (le HTTP passe par `route`)
    connexion, connexionDemo, deconnexion, changerMotDePasse, compteDeSession,
    etatComptes, definirMotDePasse, remettreMotDePasse, retirerMotDePasse,
    // Accès aux comptes du référentiel — pour l'amorçage depuis `.env` et la
    // commande de réinitialisation (voir server.mjs) : le service crée le compte
    // d'administration, il ne se contente pas d'y poser un mot de passe.
    lireCompte: (id) => store.lireCompte(id),
    lireCompteParLogin: (login) => store.lireCompteParLogin(normaliserLogin(login)),
    ecrireCompte: (compte) => store.ecrireCompte(compte),
    // Pour le serveur HTTP
    route,
    // Outils partagés avec le serveur HTTP (cookies, anti-CSRF, session).
    lireCookies, sessionCourante, csrfValide, csrfObligatoire, estAdmin,
    jetonDeSession: (req) => sessionCourante(req).jeton,
    C: { COOKIE_SESSION, COOKIE_CSRF, MDP_MIN_LONGUEUR, SESSION_JOURS: jours },
  };
}
