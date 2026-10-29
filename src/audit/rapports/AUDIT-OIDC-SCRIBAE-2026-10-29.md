---
titre: Audit du branchement d'annuaire (OIDC) — Scribae
date: 2026-10-29
version_auditee: 1.6.3w (branche dev, commit 45bfc79)
perimetre: Authentification par l'annuaire — OpenID Connect, code d'autorisation + PKCE
cadre: src/audit/PROMPT-AUDIT-SCRIBAE.md
---

# Audit du branchement d'annuaire (OIDC) — 29 octobre 2026

Lecture ciblée du mécanisme complet de connexion par l'annuaire : le client OIDC
du **service** (`src/server/mysql/annuaire-service.mjs`), sa moitié
**navigateur** (`src/lib/oidc.js`), le port de signature (`jws.mjs`) et les
épreuves qui les tiennent. Verdict en une phrase : **le mécanisme est conforme,
relu de bout en bout et couvert par des épreuves réelles ; il ne porte aucune
non-conformité bloquante.** Deux fiches sont proposées au registre (NC-II-018,
NC-II-019), une correction de commentaire, et un plan d'action en deux étapes
Code (§ 6).

## 1. Périmètre et méthode

Fichiers lus en entier, sur la branche `dev` (commit `45bfc79`, version 1.6.3w) :

- `src/server/mysql/annuaire-service.mjs` — le client OIDC côté service (module pur) ;
- `src/server/mysql/annuaire-service.test.mjs` — ses épreuves sur fournisseur simulé ;
- `src/server/mysql/jws.mjs` et `jws.test.mjs` — le port de vérification de signature et ses épreuves à vraies clés ;
- `src/lib/oidc.js` — la moitié navigateur (redirection, `state`/`nonce`/PKCE, remise du code au service).

Non relu ici (déjà couvert par l'audit du 2026-10-24) : le câblage des ports
`httpJson`/`crypto` et le filtrage de débit dans `server.mjs`, la route
`POST /v1/auth/annuaire` dans `comptes.mjs` (hormis les fonctions appelées),
la gestion des sessions et du CSRF en aval.

## 2. Le flux, relu de bout en bout

1. **Départ (navigateur).** `buildAuthorizationUrl` tire un vérificateur PKCE
   de 48 octets, en dérive le challenge S256, tire `state` et `nonce`, et pose
   le tout dans `sessionStorage` (l'onglet ferme, le flux disparaît). La
   redirection porte `response_type=code`, `client_id`, `redirect_uri`,
   `scope`, `state`, `nonce`, `code_challenge`.
2. **Retour du fournisseur.** `completeAuthorizationFromUrl` refuse la réponse
   si l'`error` est posé, si aucun code n'est venu, si l'onglet ne connaît pas le
   flux, ou si le `state` reçu diffère de celui tiré — puis EFFACE le flux : un
   aller-retour ne se rejoue pas.
3. **Découverte par le service.** En mode « service client », `discover`
   n'appelle pas le fournisseur depuis le navigateur : il passe par
   `POST /v1/auth/annuaire/decouverte`. Les points de terminaison saisis à la
   main l'emportent sur le document `/.well-known/openid-configuration`, et
   l'épreuve d'une adresse est bornée à ce qu'on lui demande.
4. **Échange du code.** `echangerCode` présente `code` + `code_verifier` +
   `client_id` + `redirect_uri` : un client public sans secret. Un refus du
   fournisseur est expliqué, `invalid_client` compris (le remède PKCE est dit).
5. **Clés et signature.** `lireJwks` lit le JWKS ; `choisirCle` prend la clé du
   `kid` annoncé, sinon la seule clé de la famille (RS/PS → RSA, ES → EC),
   sinon la clé unique — jamais au hasard parmi plusieurs.
6. **Vérification du jeton.** `verifierJeton` refuse `alg: none` et tout `HS*`
   (le service ne détient aucune clé partagée), puis confronte émetteur,
   audience, `exp` (marge 120 s), `iat`, `nonce`, et la signature. Chaque
   contrôle est daté et libellé — avec les MÊMES libellés que côté navigateur :
   un refus dit la même chose des deux côtés.
7. **Profil.** `/userinfo` complète le jeton, jamais ne le conditionne : un
   endpoint absent, lent ou muet ne fait pas échouer une connexion vérifiée.
8. **Compte.** `revendicationsVersCompte` puis `compteApplique` : le rôle du
   premier groupe reconnu devient le rôle principal, les qualités cumulables
   (reviseur, signataire) sont conservées, un agent sans groupe reconnu est
   Visiteur (aucune qualité résiduelle ne lui rouvre un accès), et l'annuaire qui
   n'annonce pas de services n'efface pas le périmètre réglé dans l'application.

## 3. Ce que les épreuves tiennent

- `jws.test.mjs` éprouve avec de **vraies paires de clés** (RSA-2048, EC P-256,
  P-384) que chaque algorithme annoncé (RS256/384/512, PS256/384/512, ES256/384)
  est vérifiable, qu'**un octet changé** dans les données ou la signature suffit
  à refuser, qu'une clé incohérente (RSA annoncée, clé EC présentée) est un
  refus et pas une panne, et que `none`, `HS256`, un algorithme vide ou inventé
  sont refusés sans même chercher une clé. Les trois pièges silencieux d'une
  vérification de signature (encodage ECDSA, sel RSA-PSS, algorithme par défaut)
  sont nommés dans l'en-tête du fichier et tenus par le port.
- `annuaire-service.test.mjs` simule un **fournisseur complet** (découverte,
  échange, JWKS, userinfo) et éprouve que chaque contrôle refusé — émetteur,
  audience, validité, émission, nonce, signature, jeton illisible — suffit à
  refuser la connexion, que les pannes réseau deviennent des réponses (pas des
  exceptions qui monteraient au serveur HTTP), et les règles « revendications →
  compte » : chemin pointé, objet de rôles, premier groupe reconnu, Visiteur,
  repli `default`, périmètre, cumul des qualités.
- `tests/purs.test.mjs` tient la **concordance** des deux implémentations
  (navigateur et service ne peuvent pas importer l'une l'autre, et doivent dire
  la même chose) : toute modification d'un côté demande de relire l'autre.

## 4. Fiches proposées au registre

### NC-II-018 — La connexion par l'annuaire réactive un compte désactivé par un administrateur

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | II.2 — Comptes, authentification, habilitations |
| Constat | `revendicationsVersCompte` pose `active: true` sans égard à l'auteur de la désactivation, et `compteApplique` supprime `deactivatedBy`/`deactivatedAt`. L'épreuve de reprise ne couvre que le compte désactivé **par l'annuaire** (`deactivatedBy: "oidc"`) — le cas voulu, car l'annuaire a reconnu la personne. Mais l'implémentation ne distingue pas : un compte désactivé **par un administrateur** (départ de l'agent, par exemple) est réactivé, avec le rôle de son groupe, à la première connexion par l'annuaire. Le geste d'administration applicative n'est pas opposable ; seul le retrait des groupes de l'annuaire ferme l'accès (le compte devient Visiteur — cette porte-là tient). |
| Exigence de référence | OWASP ASVS V2.5 (cycle de vie des comptes : la désactivation doit priver d'accès) ; ISO/IEC 27001 A.5.18 (droits d'accès retirés ou adaptés en temps voulu). |
| Preuve | `src/server/mysql/annuaire-service.mjs` (`revendicationsVersCompte` : `patch.active = true` inconditionnel ; `compteApplique` : `delete compte.deactivatedBy`, `delete compte.deactivatedAt`) ; `annuaire-service.test.mjs` (épreuve « les qualités cumulables survivent » : le cas couvert porte `deactivatedBy: "oidc"` — aucun cas `deactivatedBy` ≠ "oidc" n'est éprouvé). |
| Recommandation | La reprise ne réactive que ce que l'annuaire avait désactivé : `deactivatedBy === "oidc"`. Un compte désactivé par un administrateur reste inactif, et la connexion est refusée avec un message qui dit où le blocage a été posé. Éprouver les deux cas. Inscrire la règle dans la documentation d'administration (la désactivation applicative ne vaut que contre la connexion par mot de passe). |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | Proposition (à inscrire à l'ouverture de l'étape 1 du plan d'action, § 6) |
| Origine | Audit ciblé OIDC du 2026-10-29 |

### NC-II-019 — Le profil `/userinfo` est fusionné sans contrôle du `sub`

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | II.2 — Comptes, authentification, habilitations |
| Constat | `verifierConnexionAnnuaire` fusionne la réponse de `/userinfo` par-dessus les revendications du jeton vérifié (`claims = { ...claims, ...nettoie }`), sans exiger que le `sub` du profil soit celui du jeton. Un `sub` divergent écraserait l'identité vérifiée et décalerait le rattachement de compte (côté service, `oidcSub` ; la moitié navigateur fait la même fusion). OpenID Connect Core (§5.3.2) exige que le `sub` du userinfo soit celui du jeton d'identité, et que la réponse ne soit pas utilisée sinon. Le risque est faible (le profil est servi sur le même `access_token`, et un fournisseur sain renvoie le même `sub`), mais le contrôle coûte une ligne. |
| Exigence de référence | OpenID Connect Core 1.0 §5.3.2 (UserInfo : le `sub` doit correspondre à celui du jeton d'identité, sinon la réponse ne doit pas être utilisée). |
| Preuve | `src/server/mysql/annuaire-service.mjs` (`verifierConnexionAnnuaire` : fusion sans contrôle du `sub`) ; `src/lib/oidc.js` (`completeAuthorizationFromUrl` : fusion identique) ; `annuaire-service.test.mjs` (l'épreuve du branchement complet éprouve que le profil complète sans écraser — mais le userinfo simulé ne renvoie jamais de `sub`). |
| Recommandation | Le profil ne complète le jeton que si son `sub` est absent ou égal à celui du jeton vérifié ; sinon, la réponse est écartée et un avertissement est émis (la connexion reste valable sur le seul jeton). Des deux côtés — la concordance est tenue par `tests/purs.test.mjs`. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 0–30 jours |
| Statut | Proposition (à inscrire à l'ouverture de l'étape 2 du plan d'action, § 6) |
| Origine | Audit ciblé OIDC du 2026-10-29 |

## 5. Observations sans fiche

- **Commentaire trompeur** (`annuaire-service.mjs`, en-tête) : « le service
  refuse un `state` inconnu » — le service ne voit jamais le `state` ; c'est le
  navigateur qui le confronte (`completeAuthorizationFromUrl`, `src/lib/oidc.js`),
  correctement. Corriger le commentaire à l'occasion d'une PR sur ce fichier.
- **`nonce` facultatif côté service** : `verifierJeton` tolère un nonce absent de
  la requête. Le navigateur en tire toujours un dans le flux nominal ; le service
  pourrait l'exiger quand le jeton en porte un.
- **`redirectUri` vient du corps de la requête** : le fournisseur refuse un
  `redirect_uri` non enregistré, ce qui en fait le garant ; le service pourrait
  le comparer à une origine attendue. Non exploitable seul.
- **Pas de contrôle du schéma des adresses configurées** : un émetteur
  `http://` enverrait code et vérificateur en clair. Contrainte de configuration
  (l'administrateur saisit l'adresse) ; un refus du schéma hors `localhost`
  serait un durcissement.
- **JWKS relu à chaque connexion** (pas de cache) : coût négligeable, et la
  rotation immédiate des clés est un bienfait. Rien à faire.
- **EdDSA (Ed25519) non supporté** : la liste des algorithmes vérifiables
  (`RS*`, `PS*`, `ES256/384`) est tenue identique des deux côtés et éprouvée ;
  un fournisseur ne publiant qu'EdDSA ne se branche pas. Choix documenté et
  raisonnable — le dire dans la documentation d'administration si ce n'est pas
  déjà fait.

## 6. Plan d'action — deux étapes Code (une PR par sujet)

**Étape 1 — NC-II-018** (réactivation conditionnelle) : la reprise ne réactive
que les comptes désactivés par l'annuaire ; un compte désactivé par un
administrateur reste inactif et sa connexion est refusée avec un message qui
dit où le blocage a été posé. Épreuves des deux cas. Inscrire la fiche au
registre (chapitre II) dans la même PR, avec preuves. Relire la moitié
navigateur (`src/lib/oidc.js`) pour la concordance, et `tests/purs.test.mjs`.

**Étape 2 — NC-II-019** (contrôle du `sub` du profil) : la fusion de
`/userinfo` n'a lieu que si son `sub` est absent ou égal à celui du jeton
vérifié ; sinon la réponse est écartée et un avertissement émis. Des deux côtés
(service et navigateur). Épreuves : un userinfo au `sub` divergent n'écrase pas
l'identité. La fiche passe en LEVÉE à la livraison, avec preuve.

Chaque étape : PR vers `dev`, `npm run verifier` vert avant push, CI verte
avant relecture, trace changelog + `APP_VERSION`. Le commentaire trompeur du
§ 5 peut être corrigé dans l'une des deux PR.

## 7. Ce que cet audit ne couvre pas

Le câblage des ports dans `server.mjs` (`httpJson`, `crypto`, horloge), le
filtrage de débit de la route `POST /v1/auth/annuaire` et la politique de
session en aval : couverts par l'audit sécurité & maintenance du 2026-10-24
(`AUDIT-SECURITE-MAINTENANCE-SCRIBAE-2026-10-24.md`), non relus ici. Une
épreuve de bout en bout contre un fournisseur réel (Keycloak de l'homelab,
par exemple) reste à faire à l'exploitation — le module n'a été éprouvé que
contre des fournisseurs simulés et de vraies clés.
