# Scribae — administration technique

Documentation destinée aux **administrateurs** du logiciel : responsables informatiques de
la collectivité, intégrateurs, exploitants. Elle décrit ce que fait le logiciel, où vivent
les données, comment le sécuriser, l'exploiter et le sauvegarder, et comment passer de la
démonstration (page statique) à une installation de service auto-hébergée.

- Pour **installer** l'application (Docker, base, TLS) : `../server/README.md`.
- Pour **adapter le contenu** (entités, trames, vocabulaire) : guide intégré à l'application
  (« Guide ») et `../SPEC.md`.
- Pour **utiliser** l'application au quotidien : guide intégré à l'application.

Ce document est aussi **lisible dans l'application** : menu « Documentation technique »
(également accessible en bas du « Guide »). C'est bien ce fichier qui est affiché, tel quel —
la version de référence reste celle du dépôt.

---

## 1. Vue d'ensemble

Scribae est un éditeur de **trames** et d'**actes administratifs**. Il est
structure-agnostique : tout ce qui est propre à la collectivité (entités, services, personnes,
références juridiques, numérotation, vocabulaire, couleurs, polices) vit dans un
**référentiel** éditable et exportable — rien n'est codé en dur.

Le logiciel se compose de **deux moitiés indépendantes** :

| Moitié | Ce qu'elle fait | Où elle tourne |
|---|---|---|
| **L'application** (client) | trames, rédaction, compilation Akoma Ntoso, exports, écrans | dans le navigateur, chargée depuis un serveur web |
| **Le service** | persistance partagée, dépôt des actes, signature, publication, ELI | sur un serveur Node, devant une base MySQL/MariaDB |

Cette séparation est le point à retenir : **l'application n'a aucune donnée en dur et
n'écrit jamais directement en base**. Elle ne connaît qu'un *contrat REST* (`/v1/…`) et un
réglage par poste (adresse + jeton). On peut donc la servir indifféremment depuis un
hébergement statique (la démonstration est servie ainsi, depuis GitHub Pages) ou depuis son
propre serveur.

### Deux façons de faire tourner l'application

| | **Mode démonstration (statique)** | **Mode auto-hébergé (service)** |
|---|---|---|
| Application servie par | GitHub Pages (site statique) | nginx (conteneur `web`) |
| Stockage local | IndexedDB du navigateur | IndexedDB du navigateur |
| Données partagées | service partagé de démonstration (50 Mio durables), **s'il est joignable** ; sinon stockage du navigateur seulement | MariaDB de la collectivité |
| Signature / publication | service de démonstration, **s'il est joignable** | service Node (`src/server/mysql/`) |
| Dépend d'un service distant | oui, pour les fonctions partagées (base commune, signature, publication) | **non** |

Le mode démonstration ne sert qu'à **essayer** le logiciel : il sert le client en statique, et
les fonctions qui supposent un service restent disponibles tant qu'un service est joignable.
Le mode auto-hébergé est le mode de service.

**Ce que la page fournit elle-même.** Dans le mode démonstration statique, les deux services
attendus par le client sont installés par **`src/pages/host.js`** : le stockage est une base
IndexedDB du navigateur, et le service (dépôt, signature, publication, base partagée) est le
**script serveur embarqué dans `index.html`**, relu dans le DOM et exécuté dans la page, avec
un état durable dans IndexedDB. Deux conséquences pour l'exploitant :

- **rien n'est partagé entre postes** : l'état du service est propre au navigateur, comme le
  mode local. La démonstration ne convient donc pas à un travail à plusieurs ;
- **tout fonctionne sans réseau**, y compris la signature (ECDSA par `crypto.subtle`, qui
  exige un contexte sécurisé : HTTPS).

### Architecture de l'installation auto-hébergée

```
                    réseau interne Docker « interne »        réseau local (option)
navigateur ──►  web (nginx)  ──►  api (Node)  ──►  db (MariaDB)  ◄── serveur MySQL externe
  HTTPS            :80              :8080            :3306
   │                 │                 │                │
   │  /src/…  le code de l'application  │                │
   │  /v1/…   l'API du service ─────────┘                │
   │                                                    └─ volume « donnees »
   └─ stockage du navigateur : session, miroir hors ligne, certificats de signature
```

`api` et `db` ne publient aucun port : ils ne sont joignables que sur le réseau interne.
Si la base est hébergée ailleurs sur le réseau local, `DB_HOST` désigne son adresse (voir
`../server/README.md` § 5).

---

## 2. Ce qui tourne où

### 2.1 L'application (navigateur)

- **Aucun serveur d'application** : ce sont des modules ES natifs, sans étape de build. nginx
  sert `src/` tel quel ; le navigateur exécute.
- **Compilation, exports, import Akoma Ntoso** se font *dans le navigateur* : le poste de
  travail n'envoie au service que ce qui doit être partagé (référentiel, trames, actes,
  comptes) et ce qui doit être signé ou publié.
- **Stockage local du navigateur** (IndexedDB) : session de connexion, réglages de persistance
  du poste, miroir des dernières lectures, file d'écritures différées, certificats de
  signature. Rien de tout cela n'est partagé entre postes. En auto-hébergement, la base locale
  porte le nom `scriba-publicus` ; en démonstration, elle est rattachée à l'adresse du site.

### 2.2 Le service (Node)

Un seul processus HTTP, deux familles de ressources :

| Famille | Ressources | Persistance |
|---|---|---|
| **Données** | `/v1/db/health`, `/v1/db/collections/{collection}`, `/v1/db/collections/{collection}/sync` | tables `sb_record` / `sb_collection` / `sb_journal` |
| **Actes** | `/v1/actes…`, `/v1/signatures…`, `/v1/webhooks/signature`, `/v1/publications…`, `/v1/eli/…`, `/v1/health`, `GET /v1/` (OpenAPI) | table `sb_etat` |

Il n'ouvre **aucune connexion sortante** : il ne parle qu'à la base.

### 2.3 La base (MariaDB / MySQL)

Quatre tables et trois vues, toutes en `utf8mb4` / InnoDB :

| Objet | Rôle |
|---|---|
| `sb_collection` | une ligne par collection, avec son compteur de révision |
| `sb_record` | **le cœur** : un enregistrement par trame, acte, compte ou objet du référentiel ; le document est conservé **octet pour octet** dans `payload`, ses champs utiles étant recopiés dans des colonnes indexées (`numero`, `statut`, `service_id`, `bureau_id`, `entity_id`, `kind`) |
| `sb_journal` | piste d'audit : qui a écrit quoi, quand, depuis quelle adresse |
| `sb_etat` | l'état du service de signature et de publication (actes déposés, circuits, publications, clés d'idempotence), en un document JSON |
| `v_acte`, `v_trame`, `v_collection` | vues de lecture en clair (registre des actes, liste des trames, état de chaque collection) |

`payload` est un `LONGTEXT` et **non** un type `JSON` : le type `JSON` de MySQL renormalise
les clés, ce qui ferait croire à l'application que le document a changé à chaque
aller-retour. Les colonnes indexées sont recopiées par le service à chaque écriture — elles
ne sont jamais saisies à la main.

---

## 3. Modèle de données, synchronisation et conflits

### 3.1 Collections et enregistrements

L'application manipule huit **collections** : `config` (le référentiel, objet unique),
`meta` (singleton), `trames`, `actes`, `users`, `journal` (le journal d'audit de
l'application), `presence` (la présence des postes) — listes d'objets identifiés par `id` —
et `session` (**strictement locale**, jamais transmise). L'unité d'échange est
l'**enregistrement** : un objet de liste, ou l'objet unique d'un singleton.

`journal` et `presence` sont **silencieuses** : leurs conflits ne déclenchent pas de message
(ce sont des flux d'événements, pas des documents — une version « gagnante » y est sans
conséquence), et le service MySQL ne les recopie pas dans `sb_journal` (les y inscrire
produirait un bruit continu : la présence écrit toutes les 25 secondes par poste). Voir § 7.3.

### 3.2 Synchronisation par différences, avec révisions

À chaque écriture, le client compare le document à l'**index connu du serveur** (comparaison
JSON canonique) et n'envoie que les enregistrements réellement modifiés, chacun muni de la
**révision** qu'il connaissait.

Le serveur refuse tout enregistrement dont la révision ne correspond plus — quelqu'un d'autre
l'a modifié entre-temps — et **renvoie sa version**. C'est un **conflit** : l'application
reprend la version de la base en le signalant (message), plutôt que d'écraser en silence le
travail d'un autre poste. Deux postes qui touchent des éléments *différents* ne se gênent
jamais ; deux postes qui touchent *le même* objet voient le second perdre sa modification
au profit de la base.

C'est une politique volontaire (« la base gagne »). Une fusion par champ pour les objets longs
est un chantier ouvert (voir § 12).

### 3.3 Hors ligne

- Chaque lecture réussie est recopiée dans un **miroir local** : si la base est injoignable,
  l'application démarre quand même sur ces données et affiche « base hors ligne ».
- Les écritures qui échouent **faute de réseau** sont **mises en file** (200 maximum) et
  renvoyées automatiquement dès que la base répond (au chargement suivant ou après un test de
  connexion). Après rejeu, les collections concernées sont relues pour réaligner les révisions.
- Un refus **définitif** (jeton invalide, 401/403) n'est **pas** mis en file : il faut corriger
  le réglage. L'application le signale.
- En cas de conflit au rejeu, la version de la base gagne et le conflit est signalé.

### 3.4 Trames non publiables (actes individuels)

Une trame porte un booléen `publishable` (`true` par défaut). Réglable dans l'onglet « Trame »
de l'éditeur, il vaut `false` pour les trames produisant des **actes individuels**
(revalorisation d'un traitement, sanction disciplinaire, décision nominative…, avec quelques
exceptions) : les actes qui en sont issus sont rédigés, signés et conservés, mais **jamais
publiés** (pas de dépôt au recueil, pas d'ELI). C'est une règle de **domaine**, doublée d'un
garde-fou **côté service** : ne connaissant pas les trames, celui-ci reçoit le drapeau à chaque
dépôt (`POST /v1/actes`, champ `publishable`) et refuse la publication par
`409 acte_non_publiable` — le contrôle vient après celui de la signature
(`409 acte_non_signe`). Le drapeau n'empêche ni la signature, ni l'export, ni l'impression. Il
n'y a pas de texte publié à consolider : ces actes se corrigent directement (pas d'acte
modificatif). L'état est relu à la trame courante, donc déclarer une trame non publiable vaut
aussi pour les actes déjà rédigés à partir d'elle ; les actes sans trame restent publiables.

---

## 4. Comptes, rôles et périmètre

### 4.1 Rôles

| Rôle | Ce qu'il ouvre |
|---|---|
| **Administrateur** | tout, y compris le référentiel, les comptes, l'API et le journal ; il voit tout, quel que soit le service |
| **Éditeur** | les trames de son périmètre (créer, modifier, commenter) et les **feuilles de style** (charte graphique des actes) ; rédiger et gérer les actes de son périmètre |
| **Rédacteur** | rédiger un acte à partir d'une trame de son périmètre et mener les actions associées (enregistrer, signer) — **uniquement ses propres actes** ; il choisit son modèle dans « Rédiger un acte » (le registre des trames, `trames.voir`, est réservé aux éditeurs et aux administrateurs) |

Les onze permissions (`trames.voir`, `trames.gerer`, `trames.styles`, `actes.rediger`,
`actes.valider`, `actes.gerer`, `actes.tous`, `signature.gerer`, `referentiel.gerer`,
`comptes.gerer`, `api.gerer`) sont la **source unique** du contrôle d'accès et de la matrice
affichée dans l'écran « Comptes et rôles ».

### 4.2 Périmètre (services et bureaux)

Le rôle dit ce qu'un compte peut *faire* ; le **périmètre** dit *sur quoi*. Une trame et un
acte portent un service (`serviceId`) et, au besoin, un bureau (`bureauId`) ; `null` = général.
Un compte porte des rattachements (`memberships`) : un service avec tous ses bureaux, ou une
liste de bureaux restreinte. Un compte rattaché à tous les services est **transverse**. Seul
l'administrateur échappe au périmètre.

### 4.3 Authentification

Deux modes, réglés dans le **référentiel** (`config.auth`, onglet **Annuaire (OIDC)**) — donc
exportés et importés avec lui :

| Mode | Ce qui se passe |
|---|---|
| **Comptes de l'application** (défaut) | L'écran de connexion liste les comptes et un clic ouvre la session, **sans mot de passe** (simulation d'annuaire). C'est le mode de démonstration. |
| **Annuaire de la collectivité (OIDC)** | La session s'ouvre chez le fournisseur d'identité ; le rôle et le périmètre viennent des groupes de l'agent. Les comptes de démonstration sont **désactivés automatiquement**. |

**Le mode « comptes de l'application » n'est pas de la sécurité.** En service, il faut :

1. **Ne pas exposer l'application sur Internet.** La placer derrière le réseau de la
   collectivité, un VPN, ou un portail d'authentification — c'est le contrôle d'accès réel ;
2. brancher l'**annuaire** (§ 4.4) — c'est ce qui donne une identité vérifiée à chaque agent ;
3. considérer le **jeton d'API** comme la barrière du service de données (voir § 6) : tant
   qu'il est public, « qui atteint l'application peut écrire en base ».

### 4.4 Brancher l'annuaire (OpenID Connect)

Tout se règle dans **Référentiel › Annuaire (OIDC)**, sans redéploiement. Aucun secret n'est
nécessaire : l'application est un **client public** (PKCE).

**Ce qu'il faut demander à l'administrateur de l'annuaire :**

| Élément | Exemple | Où le saisir |
|---|---|---|
| Adresse de l'émetteur (`iss`) | `https://annuaire.collectivite.fr/realms/agents` | champ *Adresse du fournisseur* |
| Identifiant du client (`client_id`) | `scribae-application` | champ *Identifiant du client* |
| Adresse de retour autorisée | `https://actes.collectivite.fr/` | champ *Adresse de retour* (bouton « Copier l'adresse à déclarer ») |
| Groupes annoncés | `scribae-administrateurs`, `scribae-editeurs`, `scribae-redacteurs` | *Correspondance des groupes* |

À déclarer chez le fournisseur : **client public** (pas de secret), **flux code d'autorisation
avec PKCE (S256)**, adresse de retour **à l'identique**, et l'autorisation des appels depuis le
navigateur (en-têtes CORS sur la découverte, le jeton et les clés). Le bouton **Vérifier la
découverte du fournisseur** lit `/.well-known/openid-configuration` et affiche ce qui a été
trouvé ; si le fournisseur ne l'expose pas à l'application, les points de terminaison se
saisissent à la main (section repliable).

**Mise en service, dans l'ordre :**

1. Régler le fournisseur, puis **Tester une connexion** avec l'**annuaire d'essai** pour voir
   la correspondance des groupes produire les bons rôles (l'annuaire d'essai s'affiche tant
   qu'aucune adresse d'émetteur n'est saisie : on ne reste jamais bloqué) ;
2. se connecter une fois **pour de vrai** et lire l'encart « Connexion à l'annuaire vérifiée »
   (émetteur, audience, validité, nonce, signature : chaque contrôle et son résultat) ;
3. vérifier que l'agent créé a le bon **rôle** et le bon **périmètre** dans *Comptes et rôles* ;
4. **retirer la porte de secours** (*Porte de secours › Retirer*) quand tout est éprouvé : elle
   permet sinon de revenir aux comptes de l'application depuis l'écran de connexion.

**Ce qui change pour les comptes.** Un compte est identifié par son identifiant d'annuaire
(`sub`), à défaut par son adresse : un agent déjà présent est **repris** (il conserve son
historique — actes, trames, commentaires), les autres sont **créés** à leur première connexion
(*Créer les comptes inconnus*). Un agent dont les groupes ne sont reconnus par aucune
correspondance est **refusé** (réglage par défaut, recommandé) — ou reçoit le **rôle de repli**
si vous préférez cette politique. Pour **pré-attribuer** un rôle ou un périmètre avant la
première connexion, utilisez *Pré-enregistrer un agent* avec son adresse exacte.

**Retour en arrière.** Rebrancher le mode « comptes de l'application » **réactive** les comptes
de démonstration désactivés par l'annuaire (les autres restent désactivés). Les comptes créés
ou repris par l'annuaire, eux, restent dans la liste : ils portent le badge **Annuaire**.

**Quand il n'y a pas d'annuaire.** Le mode « comptes de l'application » reste utilisable en
production — c'est alors la protection réseau (§ 4.3) qui tient lieu de contrôle d'accès, et
les comptes se créent à la main dans *Comptes et rôles*.

---

## 5. Configuration

### 5.1 Réglage de persistance (par poste)

**Référentiel › Base de données** (réservé à `referentiel.gerer`). Trois modes :

| Mode | Effet |
|---|---|
| **Locale — ce navigateur** | données propres au poste (démonstration) |
| **Service de démonstration — partagé** | l'état durable du service de démonstration ; **ne parle pas à MySQL** ; en auto-hébergement l'option reste affichée mais n'a **aucun service** derrière elle |
| **Serveur externe — MySQL / MariaDB** | la base de la collectivité ; adresse vide = le service du déploiement (même origine) |

Le réglage est **propre au poste** : il n'est jamais exporté avec le référentiel. L'écran
propose *Tester la connexion*, *Envoyer les données à la base*, *Récupérer depuis la base*.

### 5.2 Variables du service

Toutes les variables sont décrites dans `../server/env.example` et `../server/mysql/env.example`.
Les plus importantes :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` / `HOST` | `8080` / `0.0.0.0` | écoute du service |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SOCKET` | — | accès à la base |
| `DB_POOL` | `8` | connexions simultanées |
| `API_TOKENS` | — | jetons d'écriture, en `libellé:empreinte_sha256` |
| `CORS_ORIGINS` | `*` | origines autorisées à appeler l'API |
| `MAX_BODY` | `8388608` | taille maximale d'une requête (8 Mio) |
| `MAX_SYNC_RECORDS` | `4000` | enregistrements par synchronisation |
| `MAX_STATE_CHARS` | `8000000` | capacité de l'état signature/publication |
| `MAX_DOC` | `400000` | taille d'un acte déposé |
| `RATE_MAX_WRITES` / `RATE_WINDOW_MS` | `600` / `60000` | limitation de débit des écritures, par IP |
| `AUTO_MIGRATE` | `false` | appliquer `schema.sql` au démarrage |

Variables du conteneur `web` : `HTTP_PORT`, `APP_DIR`, `API_BASE`, `API_TOKEN`,
`CORS_ORIGINS`.

### 5.3 Apparence : clair ou sombre (par poste)

Un bouton dans l'en-tête (lune / soleil) bascule l'application en **mode sombre** ; le menu du
compte propose en plus « **Automatique** » (suivre le réglage clair/sombre du système), « Clair »
et « Sombre ». Comme le réglage de persistance (5.1), c'est une **préférence de poste** : elle
est rangée dans le navigateur de l'agent (clé locale `scribae.theme`), n'est pas exportée avec le
référentiel, et ne change rien pour les autres postes. Elle ne modifie **pas** les documents :
le papier des actes — aperçu, PDF, Word, version publiée — reste blanc, comme à l'impression.
Ce qui habille un acte est d'une autre nature : la **charte graphique** (écran « Feuilles de
style », permission `trames.styles`) est, elle, une donnée du **référentiel** : elle se partage,
s'exporte et s'importe.

---

## 6. Sécurité

### 6.1 Jetons d'API

- Le service ne connaît que l'**empreinte SHA-256** des jetons : un jeton en clair ne peut pas
  être extrait de la base ni du code du service.
- Un jeton se génère avec `openssl rand -hex 32`, puis `printf '%s' "$JETON" | sha256sum`
  donne l'empreinte à mettre dans `API_TOKENS`.
- Le **libellé** (`application:…`, `sauvegarde:…`) n'est qu'une commodité : il apparaît dans
  `sb_journal.actor`, ce qui permet de savoir **quel client** a écrit.
- **Prévoyez un jeton par usage** (l'application, un script de reprise, une supervision) :
  révoquer un jeton, c'est retirer une ligne de `API_TOKENS`.

### 6.2 Transport

- **TLS obligatoire** en production : le jeton circule dans l'en-tête `Authorization`. Le
  conteneur `web` écoute en HTTP ; placez un reverse-proxy TLS devant (voir
  `../server/README.md` § 6) et n'exposez pas `HTTP_PORT` sur l'extérieur.
- Un **contexte sécurisé est exigé par la signature** : `crypto.subtle` (WebCrypto) n'existe
  qu'en HTTPS, ou en `http://localhost`. En `http://` sur un autre hôte, la signature
  échoue — ce n'est pas un bug.

### 6.3 Réseau

- `api` et `db` ne publient **aucun port** : ils ne sont joignables que sur le réseau interne
  Docker. Toute la surface exposée passe par la façade `web`.
- **CORS** : quand tout est servi par la même origine (cas du déploiement fourni), `*` suffit.
  Si un autre site doit appeler l'API, listez les origines exactes dans `CORS_ORIGINS` plutôt
  que `*`.
- Si la base est sur le réseau local, restreignez son écoute et l'origine des connexions
  (`'scriba'@'192.168.1.%'`), et n'ouvrez le port 3306 qu'aux hôtes concernés.

### 6.4 Base de données

Le compte applicatif n'a besoin que de :

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON scriba.* TO 'scriba'@'%';
```

Pas de `DROP`, pas de `GRANT OPTION`. Les sauvegardes se font avec le compte `root` ou un
compte dédié, jamais avec le compte applicatif.

### 6.5 Ce qui est public

Le contenu de `src/` (le code de l'application) est public, par construction : il est servi au
navigateur. Le jeton d'écriture remis à l'application (`API_TOKEN`, injecté dans `config.js`)
l'est donc aussi. Tant que ce jeton reste public, **toute personne qui atteint l'application
peut écrire en base** : c'est le contrôle d'accès réseau (VPN, réseau interne, portail) qui
protège l'installation, et non l'écran de connexion. L'annuaire (§ 4.4) donne une identité
vérifiée aux agents, mais l'application reste un **client** : ses contrôles sont des contrôles
d'interface, et la barrière du service de données reste le jeton. Voir § 4.3.

Ne placez **jamais** dans `src/`, `main.pjs`, `index.html` ou `config.js` : mot de passe de
base, clé privée, jeton de production durable, URL de suppression. Les secrets vivent dans
`.env` (non versionné) et dans la configuration du serveur.

### 6.6 Signature électronique

La signature de la démonstration est **réelle cryptographiquement** (ECDSA P-256 + SHA-256,
certificat créé dans le navigateur, horodatage signé, vérification à la consultation) mais
**non qualifiée** : le prestataire est simulé et la chaîne de certification n'est pas eIDAS.
Le service recalcule l'empreinte SHA-256 du document signé et la compare à celle du document
déposé, donc on ne peut pas publier autre chose que ce qui a été signé. Pour une signature
**qualifiée**, il faut brancher le prestataire de la collectivité (point d'extension :
`src/lib/signature.js` côté application, et le domaine `actes.mjs` côté service).

---

## 7. Exploitation

### 7.1 Commandes courantes

```bash
docker compose ps                  # état des trois services
docker compose logs -f api         # journal du service
docker compose restart api         # redémarrage du service (les données sont en base)
docker compose exec api node server.mjs --migrate   # appliquer schema.sql
```

### 7.2 Sonde de santé

`GET /v1/db/health` (public) répond `200` avec l'état de la base et, par collection, le
nombre d'enregistrements et la révision ; `503` si la base n'est pas prête (avec un champ
`remede`). C'est la sonde à utiliser pour la supervision.

```bash
curl -fsS http://127.0.0.1:8080/v1/db/health | head -c 400
```

Points à surveiller : réponse `200` et `collections.actes.records` croissant. Un `503
base_indisponible` signifie que le schéma manque ou que les identifiants sont faux ; un `503
jeton_non_configure` signifie qu'aucun jeton n'est configuré.

### 7.3 Piste d'audit

`sb_journal` conserve, pour chaque écriture, la collection, l'enregistrement, l'action
(`insert`, `update`, `delete`, `force`), la révision, le **libellé du jeton** et l'adresse IP :

```sql
SELECT at, collection, record_id, action, actor, remote_ip
FROM sb_journal
WHERE at > NOW() - INTERVAL 1 DAY
ORDER BY at DESC;
```

Conservez cette table (purge annuelle possible) : c'est la trace des modifications d'actes.
Les collections `presence` et `journal` **ne sont pas** recopiées dans `sb_journal` : la
première écrirait toutes les 25 secondes par poste, la seconde est elle-même un journal.
Leurs enregistrements vivent dans `sb_record`, comme les autres.

### 7.3.1 Journal d'audit de l'application

Les **faits métier** sont dans la collection `journal`, que l'application expose dans
**Référentiel › Journal d'audit** (consultation et recherche plein texte, 300 dernières
entrées). Chaque entrée porte `action`, `cible`, `cibleLabel`, `acteId`, `detail`, `to`
(destinataires de la notification), `by`, `byName`, `role`, `at`. On y lit, en français :
passages au parapheur, bons pour accord et avis, renvois et refus, envois et signatures,
publications, constatations de formalités (et leur effacement), créations et enregistrements
d'actes, retours à une version antérieure, mises à la corbeille, restaurations et
suppressions définitives.

```sql
-- les faits du jour, en clair
SELECT id, JSON_UNQUOTE(JSON_EXTRACT(payload, '$.at'))         AS at,
       JSON_UNQUOTE(JSON_EXTRACT(payload, '$.action'))     AS action,
       JSON_UNQUOTE(JSON_EXTRACT(payload, '$.cibleLabel')) AS cible,
       JSON_UNQUOTE(JSON_EXTRACT(payload, '$.byName'))     AS auteur,
       JSON_UNQUOTE(JSON_EXTRACT(payload, '$.detail'))     AS detail
FROM sb_record
WHERE collection = 'journal'
ORDER BY at DESC
LIMIT 50;
```

La **rétention** n'est pas outillée : le journal est borné à 300 entrées dans l'application
(les plus anciennes sortent au fil de l'eau), et rien ne l'archive. Un export CSV/JSON et une
purge datée sont un chantier ouvert (voir TODO).

### 7.3.2 Présence des postes

La collection `presence` contient un enregistrement par poste connecté (`userId`, `byName`,
`role`, `serviceId`, `at`, `ecran`, `acteId`, `acteLabel`). Un poste est **en ligne** s'il a
battu depuis moins de **70 secondes** ; le battement est de **25 secondes**, suspendu quand
l'onglet est masqué, et un départ propre (`pagehide`) marque l'enregistrement comme ancien.
Deux fenêtres du même navigateur se voient par `BroadcastChannel` ; les autres postes se
voient par sondage de **30 secondes**. Ces enregistrements peuvent être purgés sans risque
(au-delà de quelques minutes, ils sont de toute façon considérés hors ligne) : l'application
les rafraîchit au démarrage.

### 7.4 Requêtes utiles

```sql
-- le registre des actes, en clair
SELECT numero, objet, statut, service_id, updated_at FROM v_acte ORDER BY updated_at DESC;

-- les actes d'un service
SELECT acte_id, numero, objet FROM v_acte WHERE service_id = 'svc-regie';

-- l'état de chaque collection
SELECT * FROM v_collection;
```

### 7.5 Capacité

Un acte pèse quelques dizaines de Kio ; quelques milliers d'actes tiennent dans quelques
centaines de Mio. Les index de `sb_record` suffisent largement à ce volume. Les limites à
connaître : 40 publications conservées et 80 circuits de signature (les plus anciens sont
évincés) — ajustables par `MAX_PUBLIES` / `MAX_SIGNATURES` / `MAX_ACTES` ; 8 Mio par requête
(`MAX_BODY`) ; 400 000 caractères par acte déposé (`MAX_DOC`).

---

## 8. Sauvegardes et restauration

Trois choses à sauvegarder, et une à tester :

1. **La base** (référentiel, trames, actes, comptes, journal, état du service) — c'est
   l'essentiel. Dump logique :

   ```bash
   docker compose exec -T db mariadb-dump -u root -p"$DB_ROOT_PASSWORD" \
     --single-transaction --routines --triggers scriba | gzip > scriba-$(date +%F).sql.gz
   ```

   `--single-transaction` donne un instantané cohérent sans bloquer les écritures (InnoDB).
2. **Le fichier `.env`** (mots de passe, jetons) — conservé **hors** du dépôt et de la
   sauvegarde de la base, dans le coffre à secrets de la collectivité.
3. **Le référentiel exporté** (Référentiel › Données › Export) — ceinture et bretelles :
   c'est un JSON lisible qui permet de reconstruire une installation même sans la base.

**Testez la restauration** au moins une fois par an, sur une base neuve :

```bash
gunzip -c scriba-2026-09-19.sql.gz | docker compose exec -T db \
  mariadb -u root -p"$DB_ROOT_PASSWORD" scriba
```

Le volume `donnees` contient les fichiers de MariaDB : le sauvegarder à chaud **ne remplace
pas** un dump logique. Politique suggérée : dump quotidien, rétention 30 jours + une
sauvegarde mensuelle de longue durée, copie hors site.

---

## 9. Mise à jour

1. Sauvegarder la base (§ 8) ;
2. remplacer le dossier de l'application (le code) ;
3. `docker compose up -d --build` ;
4. `docker compose exec api node server.mjs --migrate` si le schéma a changé ;
5. vérifier `/v1/db/health` et ouvrir l'application.

Les mises à jour **ne touchent pas** aux données : la synchronisation est incrémentale et les
migrations du référentiel (côté application) sont **additives** — un référentiel antérieur
reçoit les nouveautés sans perdre ses données.

---

## 10. Migrer de la démonstration vers l'auto-hébergement

L'application de démonstration et l'installation auto-hébergée manipulent **le même modèle** :
la migration consiste donc à déplacer les données, pas à les convertir.

1. **Déployer** la pile auto-hébergée (`../server/README.md`) — elle peut tourner en parallèle
   sans gêner la démonstration.
2. **Récupérer les données** de la démonstration : soit un export du référentiel
   (Référentiel › Données › Export), soit, si la démonstration utilisait le mode partagé,
   *Récupérer depuis la base* depuis un poste ;
3. **Reporter le référentiel** dans l'installation de service : se connecter en
   administrateur, *Référentiel › Données › Import*, puis **Référentiel › Base de données ›
   Envoyer les données à la base** ;
4. **Régler chaque poste** sur le mode « Serveur externe » avec l'adresse du service et le
   jeton (ou, en auto-hébergement, l'adresse vide et le jeton injecté) ;
5. **Couper la démonstration** : décocher *Référentiel › Identité › Mention de démonstration*,
   et retirer la dépendance à l'environnement d'édition — l'application auto-hébergée ne
   charge plus `main.pjs` ni l'`index.html` d'origine (sa coquille est `src/server/web/index.html`).

> Les **certificats de signature** créés dans un navigateur de démonstration ne se
> transportent pas : en service, ils sont créés par poste (ou remplacés par le certificat du
> prestataire). Les **sessions** sont locales et se recréent à la première connexion.

---

## 11. Dépannage

Le dépannage de l'installation (conteneurs, base, jetons, TLS) est dans
`../server/README.md` § 9. Côté application :

| Symptôme | Cause probable | Remède |
|---|---|---|
| Bandeau « base hors ligne » | service injoignable | vérifier `docker compose ps` ; l'application continue sur son miroir local, les écritures sont mises en file |
| Message de conflit en enregistrant | un autre poste a modifié le même objet | la version de la base a été reprise ; ressaisir la modification |
| Écritures qui ne partent pas | jeton refusé (401/403) | corriger le jeton dans le réglage du poste ; ces refus ne sont pas mis en file |
| Captures / guides sans images | ressources distantes bloquées | vérifier l'accès réseau aux images du guide |
| L'application ne charge pas | `src/` mal monté côté `web` | `APP_DIR` doit désigner le dossier qui contient `src/` et `index.html` |
| Plus personne ne peut se connecter après avoir branché l'annuaire | fournisseur injoignable, ou adresse de retour refusée | ouvrir la **porte de secours** de l'écran de connexion (« L'annuaire est injoignable ? ») pour revenir aux comptes de l'application, puis corriger le réglage |
| « Découverte impossible » dans Référentiel › Annuaire | découverte bloquée (réseau, CORS) | saisir les points de terminaison à la main, et autoriser l'adresse de l'application chez le fournisseur |
| « Jeton d'identité refusé » à la connexion | émetteur, audience, horloge ou signature | lire l'encart de contrôle affiché après une connexion : il nomme le contrôle en échec |

---

## 12. Limites connues et feuille de route

- **Authentification** — deux modes : comptes de l'application (simulation, pour la
  démonstration) ou annuaire de la collectivité en OpenID Connect (§ 4.4). En mode simulé,
  l'installation doit être protégée par le réseau ; en mode annuaire, le jeton d'API du
  service de données reste à rendre non public.
- **Signature non qualifiée** — prestataire simulé (§ 6.6).
- **PDF/A certifié** — le PDF s'obtient par impression du HTML ; la chaîne PDF/A reste à
  valider (veraPDF).
- **Fusion par champ** — un conflit est résolu « la base gagne » ; une fusion par champ (par
  horodatage) serait plus juste pour les objets longs.
- **Journal lisible dans l'application** — le **journal d'audit de l'application** est
  consultable (Référentiel › Journal d'audit) ; c'est le journal **technique** `sb_journal`
  qui se lit encore en SQL (une route `GET /v1/db/journal` reste à faire).
- **Valideurs : pas de suppléance** — une étape du parapheur est ouverte au rôle qui la porte
  (et à tout administrateur, comme recours). Il n'existe pas de délégation nominative
  (vacances, intérim), ni de rattrapage automatique en cas d'absence prolongée.
- **Notifications non envoyées** — le journal porte les destinataires, la cloche les affiche,
  mais rien n'est expédié par courriel ; un résumé quotidien serait à outiller.
- **Verrou de rédaction souple** — deux postes peuvent ouvrir le même acte : l'application
  avertit, elle n'exclut pas. Un verrou exclusif (avec expiration) est un chantier ouvert.
- **Rétention du journal** — borné à 300 entrées dans l'application, sans export ni purge
  datée.
- **Verrouillage du réglage de persistance** — aujourd'hui tout administrateur peut changer le
  mode depuis son poste ; en service, ce réglage mériterait d'être fourni par le déploiement.
- **Bordereau SEDA / VITAM** — non implémenté.
- **Bibliothèque de trames partagée par URL publique** — non implémentée (la synchronisation
  multi-poste, elle, l'est).

Le détail des chantiers ouverts est tenu dans `../TODO.md`.
