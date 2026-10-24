---
titre: Audit de fiabilisation (sécurité & maintenance)
cible: aplds/scribae
commit: 0552914ffd0afe78b87aa1a4e74672d741937a96 (1.6.3u)
date: 2026-10-24
auditeur: Vibe (Mistral AI) — analyse statique via le connecteur GitHub
---

# Audit de fiabilisation Scribae — sécurité & maintenance (1.6.3u, 24 oct. 2026)

**Périmètre** : le dépôt au commit `0552914` (1.6.3u, 8 oct. 2026), service auto-hébergé (`src/server/`) et modules de sécurité.
**Méthode** : analyse statique du code source (lecture directe d'une vingtaine de modules, ~900 Ko), recoupement avec le registre des non-conformités interne (v5) et observation de l'état de la CI via l'API GitHub.
**Limite** : aucun test dynamique — ni exécution du service, ni pentest, ni rejeu des épreuves. Les chiffres de couverture cités (506/516) sont ceux du changelog du projet, non remesurés ici.

---

## 1. Verdict global

> **Le socle sécurité est nettement au-dessus du standard d'un projet personnel.** Les choix cryptographiques sont sains, l'hygiène serveur (limitation de débit, CSRF, cookies, SQL paramétré) est cohérente et documentée. Les vrais risques résiduels sont **organisationnels** : absence de relecture externe, un seul mainteneur non-développeur dépendant d'assistants IA, un doublon d'implémentation (démo/service) qui double chaque correction, et des sujets à instruire avant tout déploiement en collectivité (RGPD, sauvegarde/restauration, releases).

Constats chiffrés : 54 non-conformités recensées par le projet, 48 levées ; CI **verte** constatée sur `0552914` (les deux travaux d'épreuves + l'image Docker contre une vraie MariaDB passent) — la fiche NC-I-008 peut être clôturée.

---

## 2. Ce qui est solide (vérifié dans le code)

| Domaine | Constat | Preuve |
|---|---|---|
| Mots de passe | `scrypt` (N=65 536 par défaut, configurable `SCRYPT_N`), sel aléatoire 16 octets **par compte**, scellé versionné `scrypt$N$r$p$sel$clé`, **rehash automatique** à la montée des paramètres, comparaison à **temps constant** (`timingSafeEqual`), fausse vérification anti-énumération des identifiants, verrouillage progressif (429), mots de passe provisoires sans caractères confondables + changement exigé, longueur minimale 12 | `src/server/mysql/comptes.mjs` |
| Sessions | Jeton 32 octets aléatoires, stocké **hashé (SHA-256)** en base — jamais en clair, cookie `HttpOnly` + `Secure` (par défaut) + `SameSite=Lax`, TTL 12 jours, traçabilité IP/user-agent, révocation | `comptes.mjs`, `env.example` (`SESSION_DAYS`, `COOKIE_SECURE`) |
| CSRF | Double envoi cookie + en-tête `x-csrf-token`, exigé sur toutes les écritures | `comptes.mjs` (`csrfValide`, `csrfObligatoire`) |
| Jetons d'API | Conservés en **empreintes** SHA-256, comparaison à temps constant des trois côtés (service, domaine, démo) | `server.mjs:635`, registre NC-II-010 (levée) |
| OIDC | Authorization Code + **PKCE S256** (client public sans secret), `state` et `nonce` aléatoires confrontés, `id_token` vérifié avant session : émetteur, audience, validité, nonce **et signature** (JWKS RS/PS/ES) ; `alg:none` et HS* refusés ; échange et découverte portés par le **service**, jamais par le navigateur | `src/lib/oidc.js`, `src/server/mysql/jws.mjs` |
| SQL | **100 % de requêtes paramétrées** (`mysql2`, placeholders `?`, y compris l'insertion groupée) ; verrous `FOR UPDATE` sur les révisions ; aucune concaténation de SQL trouvée | `magasin-mysql.mjs`, `comptes.mjs`, `actes.mjs` |
| Uploads (pièces) | `MAX_BODY` 8 Mio côté service, plafond client **cohérent et documenté** (5,5 Mo ≈ 7,4 Mio de base64), base64 validé par regex stricte, identifiant 128 bits aléatoires + regex en lecture, rejet 409 si la pièce est citée par une publication | `server.mjs` (routes `/v1/pieces`), `src/lib/fichiers.js` |
| Limitation de débit | 429 par IP sur : connexions (30/min), écritures (600/min), flux (8), courriels ; message identique pour identifiant inconnu et mot de passe faux | `server.mjs:615-616` et routes |
| Façade nginx | `nosniff`, `Referrer-Policy: same-origin`, `frame-ancestors 'self'`, `X-Frame-Options` ; SSE avec `proxy_buffering off` ; l'API n'est joignable **que** via la façade (pas de CORS, pas de port publié sur `api`) | `src/server/nginx.conf` |
| Docker | Image MariaDB **épinglée par digest SHA-256** (pas d'étiquette flottante), secrets exigés à défaut erreur explicite, **aucun port publié pour la base**, `depends_on: condition: service_healthy`, schéma appliqué par le service (pas de script d'amorçage muet), utf8mb4 | `src/server/docker-compose.yml` |
| Signature interne | Clés privées **scellées au repos** (WebCrypto, clé de scellement 32 octets du `.env`), jamais rendues par l'API (`etat()` ne rend que l'état du coffre) | `src/server/mysql/signature-interne.mjs` |
| XSS (recueil public) | Assainissement par analyse DOM + liste blanche (jamais de regex sur du HTML), `rel="noopener noreferrer"` forcé sur les cibles `_blank` | `src/lib/sanitize.js` |
| CI | 3 travaux séparés (syntaxe/style/tests ; service ; **image Docker éprouvée contre une vraie MariaDB**), échecs publiés en annotations, parcours Playwright 27/27, **constatée verte** sur `0552914` | `.github/workflows/ci.yml` |
| Supply-chain | Une seule dépendance (`mysql2` 3.11.3, version exacte + verrou), aucune dépendance applicative : surface d'attaque par paquet quasi nulle | `src/server/mysql/package.json` |

---

## 3. Réserves et risques résiduels

**R1 — Aucune relecture externe du code sensible (risque principal).** Les primitives sont standard (`node:crypto`, WebCrypto : scrypt, SHA-256, RSA/ECDSA), mais l'*assemblage* (gestion des scellés, vérification JWS, assainisseur HTML, coffre de clés) n'a été relu par personne d'autre que des assistants IA. Le risque n'est pas l'algorithme, c'est l'angle mort. *Atténuation* : périmètre de relecture raisonnable — `comptes.mjs`, `jws.mjs`, `sanitize.js`, `signature-interne.mjs` ≈ 45 Ko au total.

**R2 — CSP minimale (assumée, mais sans seconde ligne).** Seul `frame-ancestors` est posé ; aucune restriction sur les scripts. L'unique rempart XSS du recueil public — qui affiche des données saisies par les agents — est `sanitize.js`, écrit maison. *Atténuation* : CSP complète avec nonce sur l'espace public, déployée et éprouvée par déploiement.

**R3 — Pièces stockées en base64 dans la base.** +33 % de volume, sauvegardes gonflées ; acceptable à l'échelle d'un service d'actes, à documenter comme limite. Vérifier la cohérence avec `max_allowed_packet` de MariaDB si `MAX_BODY` est relevé (le compose ne le fixe pas ; défaut MariaDB 11 : 16 Mo — un `MAX_BODY` relevé au-delà casserait l'écriture des grosses pièces de façon peu explicite, code 507).

**R4 — Route publique des pièces protégée par le secret seul.** `/v1/pieces/{id}` est publique, l'identifiant aléatoire (128 bits) étant le seul droit d'entrée — documenté et acceptable, mais sans expiration ni révocation des liens.

**R5 — Cookies `Secure` et premier démarrage en HTTP.** Un déploiement test en HTTP pur (sans reverse proxy TLS) rend la connexion silencieusement impossible. Le levier existe (`COOKIE_SECURE=false`) mais le symptôme est piégeux — c'est le genre de panne qu'évoque l'issue #1 (« ça ne marche pas en Docker ») et qu'un parcours CI de premier démarrage en mode `password` sur l'image Docker éliminerait.

**R6 — Limitation de débit en mémoire (`Map`).** Perdue au redémarrage, inopérante multi-instances. Sans objet en mono-serveur — à documenter comme contrainte d'architecture.

**R7 — Pas de second facteur.** Mode `password` sans 2FA ; l'annuaire OIDC est la réponse naturelle en collectivité, à exiger dans la doc d'exploitation si le compte admin est à distance.

**R8 — RGPD à instruire avant tout déploiement.** Sessions et journal conservent **IP et user-agent** des agents (finalité légitime : traçabilité des écritures d'actes), mais : registre des traitements, durées de conservation, purge des sessions expirées, information des agents. Rien de bloquant, rien de fait non plus.

**R9 — Le mode `demo` ne protège rien** (assumé). Le risque résiduel est une erreur de configuration de production ; une bannière de démarrage refusant `DEMO=true` combiné à `AUTH_MODE=password` + port publié serait une barrière de plus.

---

## 4. Maintenance et gouvernance

**M1 — Facteur bus = 1, doublé d'un risque d'outil.** Le projet dépend d'un seul humain non-développeur et d'assistants IA dont le moteur change. Point à créditer : `AGENTS.md`, `src/docs/REPRISE.md` et le harnais d'épreuves sans terminal sont **écrits pour transférer le projet à n'importe quel agent** — la continuité est préparée, ce qui est rare.

**M2 — Le code vit en deux endroits.** L'« atelier » (Perchance) et le dépôt GitHub, alignés à l'export ; la dérive a déjà donné une non-conformité (NC-I-017, levée mais structurellement récurrente). Toute livraison doit repasser par l'export : un coût fixe à chaque série. *Note : le présent rapport est déposé directement sur GitHub (branche `dev`) — il doit être importé dans l'atelier à la prochaine session pour ne pas recréer la divergence.*

**M3 — Le registre d'audit prend du retard sur le code.** Registre arrêté à 1.6.3o (30 sept.) ; code à 1.6.3u (8 oct.). La NC-I-008 (CI rouge) est **de facto résolue** — CI verte constatée sur `0552914` — mais non clôturée au registre. La règle « une livraison laisse une trace » est violée par ses propres versions récentes.

**M4 — Versionnage non standard, une seule release.** Les notes intermédiaires `1.6.3a…u` ne sont pas du semver (assumé) ; **une seule release GitHub** existe (1.6.1q). Une collectivité ne peut pas épingler une version sans tag ni archive. Priorité avant toute présentation : tags + releases + archive signée (SHA-256 publiée).

**M5 — Le doublon d'implémentation est le premier multiplicateur de coût.** L'API existe deux fois (service de démonstration embarqué dans `index.html`, 212 Ko, et service auto-hébergé, `server.mjs` 157 Ko), tenues ensemble par une épreuve de concordance — bien, mais chaque correction est appliquée deux fois. Gros fichiers restants : `src/ui/views/signature.js` ~3 566 lignes (NC-I-003, en cours), `seed.js` 180 Ko, `api-reference.js` 77 Ko.

**M6 — PDF/A jamais soumis à un vérificateur indépendant.** `pdfa.js` (71 Ko) est écrit main et le projet le reconnaît : veraPDF n'est jamais passé. Pour un produit dont **le fichier archive fait foi**, c'est la première chose qu'un archiviste testera.

**M7 — Sauvegarde / restauration.** Documentation d'exploitation présente (`src/docs/ADMINISTRATION.md`, non relu ici) ; à instruire : une restauration **éprouvée** (test de repli documenté, daté), pas seulement des sauvegardes.

---

## 5. Convergence avec le registre interne

- Constats indépendants qui recoupent le registre : NC-I-003 (gros modules, **en cours**), NC-IV-001 (signature non qualifiée, **en cours**), NC-I-015/016 (verrou de dépendances racine, chemin de tests — signalés le 25 sept., **toujours ouverts au dernier commit**).
- Deux points où ce rapport va plus loin que le registre : R2 (CSP sans seconde ligne de défense) et M4 (absence de releases), qui ne figurent pas comme fiches.
- Un point où le registre est en retard : NC-I-008 devrait passer **Levée** (CI verte observée le 8 oct. 2026).

---

## 6. Plan d'action hiérarchisé

### 0–30 jours (avant d'en parler à qui que ce soit)
1. Clore NC-I-008 au registre et rattraper la trace 1.6.3p–1.6.3u.
2. Reproduire et corriger l'issue #1 : pistes de diagnostic (fichier > 5,5 Mo ; premier démarrage en HTTP sans TLS + cookies `Secure` ; cohérence `max_allowed_packet`/`MAX_BODY`), et **ajouter à la CI un parcours de premier démarrage en mode `password`** (connexion + dépôt d'une pièce via l'image Docker).
3. Corriger NC-I-015/016 (verrou de dépendances racine, chemin de tests).
4. Publier une release GitHub de la version courante : tag, archive, empreinte SHA-256, notes extraites du changelog.

### 30–90 jours
5. Revue de code externe ciblée (R1) : `comptes.mjs`, `jws.mjs`, `sanitize.js`, `signature-interne.mjs` — 45 Ko, périmètre d'une journée de relecture.
6. CSP complète sur l'espace public (R2), éprouvée par parcours Playwright.
7. RGPD (R8) : registre des traitements, durées de conservation, purge des sessions expirées, information des agents.
8. Restauration éprouvée (M7) : un test de repli documenté et daté.

### 90 jours et plus
9. Décision de fond sur le doublon démo/service (M5) : restreindre l'API de démonstration, ou la générifier.
10. veraPDF en épreuve CI sur le PDF/A (M6).
11. 2FA ou exigence d'annuaire OIDC pour l'administration à distance (R7).
12. Feuille de route de légitimation : SILL / ADULLACT / homologation — **après** les points 1–8.

---

## 7. Ce que cet audit n'a pas vérifié

- Aucune exécution : le service n'a pas été lancé, les épreuves n'ont pas été rejouées, pas de test d'intrusion dynamique.
- Modules non lus : `pdfa.js`, `xlsx.js`, `doc-import.js` (imports de documents — piste à garder pour l'issue #1), `ui/oidc.js` (42 Ko), `actes.mjs` (208 Ko), la documentation d'exploitation.
- La conformité juridique du circuit de signature/publication relève d'une compétence juridique et d'un tiers certificateur pour la valeur probante (NC-IV-001).

---

*Rapport d'analyse statique réalisé le 24 oct. 2026 sur `0552914` (1.6.3u) — Vibe (Mistral AI), connecteur GitHub. Toute levée de fiche doit l'être avec preuve, pas avec intention.*
