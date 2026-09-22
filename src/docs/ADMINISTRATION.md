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
| **Actes** | `/v1/actes…`, `/v1/signatures…`, `/v1/webhooks/signature`, `/v1/actes/{id}/transmission`, `/v1/publications…`, `/v1/eli/…`, `/v1/health`, `GET /v1/` (OpenAPI) | table `sb_etat` |

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

### 3.5 Mise à disposition des trames (brouillon → services)

Le champ `status` d'une trame vaut `draft`, `published` ou `archived`. **`published` veut dire,
pour une trame, « mise à disposition des services »** : c'est le seul objet qui porte cet état,
et c'est ce que lit `trameDisponible(trame)` (`src/lib/schema.js`). La règle est simple : **une
trame reste en brouillon tant qu'un éditeur ne l'a pas mise à disposition**, et un brouillon
n'est visible que de l'atelier — l'écran « Rédiger un acte » ne propose que les trames mises à
disposition, et l'ouverture directe d'un brouillon est refusée (deux exceptions : un éditeur, et
une rédaction déjà commencée, qui doit pouvoir se terminer).

Les gestes (`mettreTrameADisposition` / `retirerTrame`, `src/ui/state.js`) écrivent le statut,
horodatent la mise à disposition (`publishedAt`, `publishedBy`) et **journalisent**
(`trame.disponible` / `trame.retiree` — visibles dans Administration › Journal d'audit).
`retirerTrame` ne touche **jamais** les actes déjà produits : chacun porte sa propre copie du
texte compilé et des valeurs saisies. Une trame **créée, dupliquée ou importée** arrive toujours
en `draft` ; le jeu de démonstration livre les siennes en `published`, et un fichier JSON qui les
déclare `published` les met à disposition à l'import (l'interface le signale). L'état `archived`
n'est, lui, proposé à personne — ni aux services, ni comme modèle à qui que ce soit — et se
quitte par la même mise à disposition.

---

## 4. Comptes, rôles et périmètre

### 4.1 Rôles

| Rôle | Ce qu'il ouvre |
|---|---|
| **Administrateur** | tout, y compris le référentiel, les comptes, l'API et le journal ; il voit tout, quel que soit le service |
| **Éditeur** | les trames de son périmètre (créer, modifier, commenter) et les **feuilles de style** (charte graphique des actes) ; rédiger et gérer les actes de son périmètre |
| **Rédacteur** | rédiger un acte à partir d'une trame de son périmètre et mener les actions associées (enregistrer, signer) — **uniquement ses propres actes** ; il choisit son modèle dans « Rédiger un acte » (le registre des trames, `trames.voir`, est réservé aux éditeurs et aux administrateurs) |
| **Réviseur** | **qualité cumulable** (elle ne remplace pas un profil) : contrôler les actes avant leur signature (rapport de conformité, correction, validation, rejet motivé). Elle s'exerce dans le **champ de compétence** du compte ou d'un service (voir § 4.5) |
| **Signataire** | **qualité cumulable** (elle ne remplace pas un profil) : la **qualité de signer**. Elle **découle d'une désignation** — dès qu'une personne est désignée dans l'organigramme des **Délégations** (comme délégant ou délégataire), le compte rattaché à cette personne la reçoit, même si la désignation est faite par un éditeur. Elle ouvre l'onglet **« Ma signature »** et restreint la vue de l'atelier au **champ de compétence** du signataire (les actes dont sa signature relève). Un signataire **signe avec son compte**, rapproché du compte que l'outil de signature lui connaît (voir § 4.5) |
| **Visiteur** | aucun accès : l'atelier ne lui est pas ouvert, il ne lui reste que l'**espace public** (le recueil). C'est l'état d'un compte authentifié dont aucun rôle d'application n'est reconnu (voir § 4.4) |

Les dix-sept permissions (`trames.voir`, `trames.gerer`, `trames.styles`, `actes.rediger`,
`actes.valider`, `actes.gerer`, `actes.tous`, `actes.reviser`, `actes.signer`, `signature.gerer`,
`delegations.gerer`, `publications.depublier`, `publications.epingler`,
`referentiel.gerer`, `comptes.gerer`, `api.gerer`, `docs.voir`) sont la **source unique** du
contrôle d'accès et de la matrice affichée dans l'écran « Comptes et rôles ».

**`actes.signer`** (signer un acte) et **`signature.gerer`** (conduire la publication — recueil,
identifiant ELI, formalités, transmission) sont **deux permissions distinctes** : un signataire
peut signer sans pouvoir publier.

À noter : **`delegations.gerer`** ne garde que la **modification** de l'organigramme des
délégations : l'écran, lui, est visible par **tous les comptes** (voir § 5.5 quater), et un
compte qui n'a pas la permission y lit exactement la même fiche, sans les champs de saisie.
**`publications.depublier`** (retirer un acte du recueil) est réservée à
l'**administrateur**, et c'est un geste **exceptionnel** — un acte administratif publié ne se
retire pas ; seul un motif technique le justifie. Le service exige ce motif et le conserve sur
l'acte.

### 4.2 Périmètre (services et bureaux)

Le rôle dit ce qu'un compte peut *faire* ; le **périmètre** dit *sur quoi*. Une trame et un
acte portent un service (`serviceId`) et, au besoin, un bureau (`bureauId`) ; `null` = général.
Un compte porte des rattachements (`memberships`) : un service avec tous ses bureaux, ou une
liste de bureaux restreinte. Un compte rattaché à tous les services est **transverse**. Seul
l'administrateur échappe au périmètre.

### 4.3 Authentification

Trois modes. Deux se règlent dans le **référentiel** (`config.auth`, onglet **Annuaire (OIDC)**),
donc exportés et importés avec lui ; le troisième se règle dans le **`.env` du déploiement** (§ 4.3
bis), parce qu'il engage le service lui-même :

| Mode | Où il se règle | Ce qui se passe |
|---|---|---|
| **Comptes de l'application** (défaut) | référentiel | L'écran de connexion liste les comptes et un clic ouvre la session, **sans mot de passe** (simulation d'annuaire). C'est le mode de démonstration. |
| **Annuaire de la collectivité (OIDC)** | référentiel | La session s'ouvre chez le fournisseur d'identité ; le rôle et le périmètre viennent des groupes de l'agent. Les comptes de démonstration sont **désactivés automatiquement**. Les **comptes locaux restent joignables** (voir ci-dessous). |
| **Comptes locaux (mot de passe)** | `.env` (`AUTH_MODE=password`) | De **vrais comptes** : identifiant + mot de passe, vérifiés par le service, session dans un cookie. Le compte d'administration est créé au premier démarrage depuis le `.env`. C'est le mode d'une installation auto-hébergée **sans annuaire**. |

**Le mode « comptes de l'application » n'est pas de la sécurité.** En service, il faut :

1. soit **brancher l'annuaire** (§ 4.4) — c'est ce qui donne une identité vérifiée à chaque agent ;
2. soit activer les **comptes locaux** (§ 4.3 bis) — une vraie vérification de mot de passe, tenue
   par le service, hors du navigateur ;
3. et, dans tous les cas, **ne pas exposer l'application n'importe où** : la placer derrière le
   réseau de la collectivité, un VPN ou un portail d'authentification reste la première barrière.

**Deux portes, pas une.** Brancher l'annuaire ferme les comptes de démonstration, mais **pas** les
comptes locaux : sous le bouton de l'annuaire, l'écran de connexion offre un bloc « **Ou par un
compte local** », par lequel entrent le **compte d'administration du `.env`** (`ADMIN_LOGIN` /
`ADMIN_PASSWORD`, § 4.3 bis) et les comptes locaux créés à la main. C'est la **porte de service** de
l'installation : sans elle, une panne du fournisseur d'identité — réseau, incident, rendez-vous
manqué — laisserait la collectivité sans personne pour ouvrir une session, l'administrateur
compris. Le service annonce lui-même cette disponibilité (`GET /v1/auth/config` → `comptesLocaux`,
vrai dès que le service tient les mots de passe, c'est-à-dire hors mode démonstration) : c'est donc
le **déploiement** qui décide, et non le navigateur. Pour la refermer tout à fait, il faudrait que le
service ne détienne **aucun** compte local — ne pas créer de compte d'administration (`ADMIN_PASSWORD`
vide) et n'attribuer de mot de passe à personne : la porte disparaît alors, avec ce qu'elle protège.

### 4.3 bis Comptes locaux (mot de passe) — sans annuaire

C'est le mode des collectivités qui n'ont pas d'annuaire à brancher, ou qui n'en veulent pas : une
**vraie** authentification, avec un mot de passe que le service de la collectivité vérifie lui-même.

```
navigateur ──(identifiant + mot de passe)──► service ──► dérivé scrypt, en base
         ◄──(cookie de session HttpOnly)────
```

**Ce que le service garde.** Jamais un mot de passe : un **dérivé `scrypt`** (`scrypt$N$r$p$sel$empreinte`),
sel et paramètres compris dans la chaîne scellée — la même empreinte ne se rejoue donc pas d'une
installation à l'autre, et deux agents ayant choisi le même mot de passe n'ont pas le même dérivé.
Ce qui protège : le coût du calcul (`SCRYPT_N`), le **blocage après 5 échecs** (croissant, jusqu'à
15 minutes), la **comparaison à temps constant**, et le **même message** quand l'identifiant est
inconnu (on n'énumère pas les comptes).

**Ce que le navigateur garde.** Un **jeton de session** dans un cookie `HttpOnly` (invisible du
JavaScript de la page : elle ne peut pas le lire, donc pas le voler par une injection), et un
jeton **anti-CSRF** dans un second cookie lisible, que la page renvoie en en-tête à chaque
écriture — un autre site ne peut pas le lire, ni poser d'en-tête personnalisé, donc ne peut pas
agir à la place de l'agent. La session expire au bout de `SESSION_DAYS` jours, et chaque connexion
renouvelle son jeton.

**Mise en service :**

```bash
cd src/server
cp env.example .env
#   AUTH_MODE=password
#   ADMIN_LOGIN=admin
#   ADMIN_PASSWORD=<long, unique — la clé de l'installation>
#   DEMO_ACCOUNTS=false
#   DEMO=false                  # aucune donnée fictive : l'outil part d'un référentiel vierge
#   COOKIE_SECURE=true          # false seulement pour un essai en clair (http://…)
docker compose up -d --build
docker compose logs -f api      # « Compte administrateur créé depuis .env »
```

> **Le dossier de données ne s'initialise qu'une fois.** Les variables `MARIADB_*` de
> `docker-compose.yml` ne créent la base, l'utilisateur et le schéma que lorsque le **volume est
> vide** — au tout premier démarrage. Ensuite, modifier `DB_*` ou `MARIADB_*` ne change **ni** le
> schéma **ni** le compte d'administration déjà créés. Pour rejouer schéma **et** amorçage sur un
> dossier vierge :
>
> ```bash
> docker compose down -v && docker compose up -d --build
> ```
>
> `-v` supprime le volume : **toutes les données sont perdues**. À réserver à une installation
> neuve, ou après une sauvegarde.

**Si l'écran de connexion refuse, sachez distinguer les causes.** Le service **n'installe pas** de
compte d'administration quand `ADMIN_PASSWORD` ne respecte pas la politique : au moins
`MDP_MIN_LONGUEUR` caractères (`12` par défaut), au moins **trois** sortes de caractères
(minuscules, majuscules, chiffres, symboles), ni l'identifiant du compte, ni un mot de passe
courant. Sans ce compte, **aucune session** ne peut s'ouvrir. Ce n'est donc pas « un mot de passe
mal saisi » : l'écran de connexion l'annonce désormais en clair, parce qu'il lit
`GET /v1/auth/config`, qui porte :

| Champ | Sens |
| --- | --- |
| `adminAmorce` | `true` un compte d'administration peut se connecter ; `false` l'amorçage a échoué ; `null` sans objet (mode démo) |
| `adminMotif` | pourquoi l'amorçage a échoué (mot de passe refusé, `ADMIN_LOGIN` vide, compte sans mot de passe…) |
| `adminPanne` | cet échec est une **panne** — le référentiel des comptes était injoignable (schéma non appliqué, base absente) — et non un refus de configuration. L'écran le dit alors comme une panne de base, jamais « aucun compte d'administration installé » |
| `adminAvertissement` | l'amorçage a réussi, mais avec une réserve (compte sans le rôle administrateur) |
| `baseDisponible` | `true`/`false` la base répond ; `null` pas encore éprouvée |
| `baseMessage` / `baseRemede` | le motif de l'indisponibilité, et le remède à appliquer |

Le journal du service (`docker compose logs api`) redit le même motif. Un **démarrage dégradé** —
base injoignable, schéma non migré — est également journalisé et signalé à l'écran : le service ne
sort plus en boucle de redémarrage, et il ne se contente plus d'un « registre vide » silencieux.

> **`COOKIE_SECURE` (défaut `true`) interdit la session en `http://`.** Le navigateur refuse de
> renvoyer un cookie `Secure` sur une liaison en clair : aucune session ne s'ouvre. Pour un essai en
> clair (`http://serveur:8080`), mettez `COOKIE_SECURE=false` **le temps de l'essai**, puis remettez
> `true` — en production, TLS est de toute façon obligatoire (§ 6.2).

Le compte d'administration est créé **au premier démarrage** : le service l'inscrit au référentiel
et lui pose le mot de passe de `ADMIN_PASSWORD`. Ensuite ce mot de passe **n'est plus relu** — le
service ne réécrit jamais un mot de passe existant : on le change depuis *Comptes et rôles*
(menu du compte › *Changer mon mot de passe*), ou en ligne de commande, pour un administrateur qui
se serait enfermé dehors :

```bash
docker compose exec api node server.mjs --mot-de-passe admin   # demande le mot de passe (entrée masquée : stdin)
```

Cette commande est la **porte de secours** : si le compte a **disparu du référentiel** — remise à
zéro des collections, import de données sans les comptes —, elle **crée** le compte (rôle
administrateur) au lieu de le refuser, et vérifie la politique du mot de passe avant toute
écriture. Le service fait mieux encore, de lui-même : **au démarrage**, si le compte déclaré par
`ADMIN_LOGIN` manque au référentiel alors que le service garde encore son mot de passe, il le
**rétablit** — même identifiant, rôle administrateur, mot de passe **conservé** (jamais remplacé).
C'est ce qui rouvre une installation que « Repartir d'un référentiel vierge » avait laissée sans
personne pour se connecter (voir plus bas) : le redémarrage du service suffit.

C'est aussi ainsi qu'on **remet un accès** à un agent : *Comptes et rôles* › bouton **Mot de passe**
d'une ligne. Le service **engendre** alors un mot de passe provisoire (groupes de 4 caractères, sans
caractères confondables), le **montre une seule fois** — notez-le, il n'est pas conservé — et exige
qu'il soit changé à la première connexion. Un compte **sans mot de passe** ne peut pas se connecter :
c'est le geste de fermeture d'un compte dont l'agent est parti (son compte reste au référentiel, avec
ses actes).

**Créer les comptes.** Le compte d'administration se connecte, puis crée les autres dans
*Comptes et rôles* — nom, identifiant, rôle, périmètre, puis mot de passe. Le référentiel (qui porte
les rôles et les périmètres) reste dans l'application ; **seuls les mots de passe** vivent dans les
tables `sb_motdepasse` et `sb_session`, à côté.

**Le mode démonstration est un SEUL commutateur**, `DEMO` (voir `src/server/env.example`). Il
commande **tout le jeu fictif** : identité, entités, services, personnes, rôles, références,
trames, actes et comptes de démonstration.

- `DEMO=false` : l'application part d'un **référentiel vierge** — aucune donnée fictive, aucune
  mention de collectivité fictive nulle part. C'est le réglage d'une installation réelle.
- `DEMO=true` (ou `AUTH_MODE=demo`, ou `DEMO_ACCOUNTS=true`) : le jeu fictif est installé, et le
  bandeau « Démonstration » s'affiche dans l'application et sur le recueil public.

`DEMO_ACCOUNTS` ne règle plus que le **raccourci de connexion** : à `true`, l'écran de connexion
garde « choisir un compte » (pratique pour une recette, **à ne pas laisser en service**) ; à
`false` (le défaut en mode mot de passe), il faut un identifiant et un mot de passe.

**Une installation déjà peuplée par la démonstration** ne se nettoie pas en changeant `DEMO` : les
données fictives resteraient en place, et les publications au recueil public. Le geste est
*Administration › Données › « Repartir d'un référentiel vierge »* : il vide le poste **et** le
service (actes déposés, circuits de signature, publications).

En mode « comptes locaux » (et en mode annuaire), ce geste **conserve les comptes** : leurs mots de
passe sont gardés par le service (`sb_motdepasse`), hors du référentiel, et les effacer aurait
laissé l'installation sans personne pour se connecter — le compte d'administration compris. Le
service rétablit du reste son compte d'administration au démarrage si le référentiel l'a perdu et
que son mot de passe est resté, et `node server.mjs --mot-de-passe <identifiant>` le recrée s'il
n'existe plus (mot de passe lu sur l'entrée standard). Pour supprimer un compte, passez par
*Comptes et rôles*.

**Ce qu'il faut savoir avant de s'engager :**

- le mot de passe circule du navigateur au service : **TLS obligatoire** en production (cookie
  `Secure`) — voir § 6.2 ;
- les tables `sb_motdepasse` et `sb_session` **font partie de la sauvegarde** (§ 8) : sans elles,
  plus personne ne se connecte ;
- une session vit dans la **base** : restaurer une sauvegarde ancienne peut donc rouvrir une
  session qui avait été fermée, et rend un mot de passe changé depuis. C'est un point à regarder
  si l'on restaure pour autre chose qu'un incident ;
- `--mot-de-passe` **ferme les sessions** du compte (le changement de mot de passe les invalide) ;
- il n'y a **ni second facteur, ni réinitialisation par courriel** : la remise passe par
  l'administrateur, à la voix ou par un canal sûr. Pour aller au-delà, brancher l'annuaire (§ 4.4).

### 4.4 Brancher l'annuaire (OpenID Connect)

Tout se règle dans **Administration › Annuaire (OIDC)**, sans redéploiement. Aucun secret n'est
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

**Quand il n'y a pas d'annuaire.** Utilisez les **comptes locaux (mot de passe)** (§ 4.3 bis) :
c'est une vraie authentification, tenue par le service, sans rien à installer de plus. Le mode
« comptes de l'application » ne reste, lui, qu'un mode de démonstration.

### 4.5 Compétence de révision, et qualité de signataire

Deux rôles sont des **qualités cumulables** : elles ne remplacent pas un profil, elles
s'ajoutent à lui. Toutes deux restreignent la vue de l'atelier à un **champ de compétence** :
le compte y voit les actes qui le concernent — quel que soit son périmètre administratif.

**La révision** (`Réviseur`). Le compte porte en outre une **compétence de révision**
(*Comptes et rôles › Modifier › Compétence de réviseur*) : services (et certains de leurs
bureaux), familles de trames, trames, types d'actes, entités. Une compétence **vide** vaut
« tous les services, tous les actes ». Un acte n'est révisé que s'il existe un réviseur
**compétent** pour lui ; sans réviseur compétent, la révision n'a pas lieu et l'acte part
directement en signature. Un **service** aussi peut se voir attribuer la compétence
(*Administration › Services › Compétence de révision*), auquel cas tous les comptes qui lui
sont rattachés en héritent.

**Le signataire.** Un signataire est l'**auteur de l'acte** : celui dont la signature engage
la collectivité. Trois conséquences, qu'il faut connaître pour l'exploiter.

1. **La qualité découle d'une désignation.** Elle ne se coche pas dans une liste : dès qu'une
   personne est désignée dans l'organigramme des **Délégations** — comme délégant, ou comme
   délégataire qui signera —, le compte rattaché à cette personne reçoit la qualité de
   **Signataire**. La désignation peut être faite par un **éditeur** : l'écran Délégations est
   modifiable par les administrateurs **et** les éditeurs (§ 5.5 quater), et désigner
   quelqu'un donne la qualité sans passer par les *Comptes et rôles*.
2. **Un compte, et un rapprochement.** Le compte qui porte la qualité est rattaché à la
   **personne du référentiel** qu'il tient (*Comptes et rôles › Modifier › Personne du
   référentiel — qui signe*). En production, l'annuaire de la collectivité (OIDC) délivre le
   compte de l'application **et** provisionne le même agent sur l'**outil de signature** : les
   deux doivent être **rapprochés**. Le rapprochement se fait, d'un bouton, à trois endroits :
   la **fiche d'un acteur** dans l'écran **Délégations**, la **fiche du compte** (*Comptes et
   rôles*), et l'onglet **« Ma signature »** de l'écran *Signature & publication*. Il s'écrit
   sur la **personne** (elle suit donc l'export du référentiel) et retient le **compte de
   l'outil de signature** de l'agent. Un signataire **sans compte**, dont le compte est
   désactivé, sans adresse, ou **non rapproché**, ne peut pas signer — la signature serait
   anonyme : l'application l'avertit au moment où on le désigne, et sur l'écran de signature.
3. **Un champ de compétence.** Un signataire ne voit, dans l'atelier, que les actes dont la
   signature relève de lui : ceux qu'il signe lui-même, et ceux que signent ses
   **délégataires** (sa signature y est engagée par délégation ou subdélégation). L'onglet
   **« Ma signature »** lui présente ce qui attend sa signature et ce qui a été signé au titre
   de sa délégation. La qualité étant cumulable, un signataire qui est aussi rédacteur garde
   la vue de son périmètre administratif.

Signer (`actes.signer`) et publier (`signature.gerer`) sont deux permissions **distinctes** :
un signataire signe sans conduire la publication, qui reste le fait du bureau compétent.

---

## 5. Configuration

### 5.1 Réglage de persistance (par poste)

**Administration › Base de données** (réservé à `referentiel.gerer`). Trois modes :

| Mode | Effet |
|---|---|
| **Locale — ce navigateur** | données propres au poste (démonstration) |
| **Service de démonstration — partagé** | l'état durable du service de démonstration ; **ne parle pas à MySQL** ; en auto-hébergement l'option reste affichée mais n'a **aucun service** derrière elle |
| **Serveur externe — MySQL / MariaDB** | la base de la collectivité ; adresse vide = le service du déploiement (même origine) |

Le réglage est **propre au poste** : il n'est jamais exporté avec le référentiel. L'écran
propose *Tester la connexion*, *Envoyer les données à la base*, *Récupérer depuis la base*.

*Tester la connexion* répond sur **deux** lignes, et la seconde est celle qui compte :

| Ligne | La question | Ce qu'elle éprouve |
|---|---|---|
| **Le service répond** | y a-t-il quelqu'un au bout ? | `GET /v1/db/health` — ni session, ni anti-CSRF, ni jeton |
| **La base accepte les écritures** | peut-on enregistrer ? | `POST /v1/db/collections/meta/sync` **vide** : session, anti-CSRF, rôle et transaction compris, sans déposer le moindre enregistrement |

Une pastille rouge peut donc vivre à côté d'un « le service répond » : c'est la **seconde** ligne
qu'il faut lire. L'état affiché est un constat daté — ce que le dernier geste a répondu, rien de
plus ; l'écran le reprend en compte à son ouverture et après un essai réussi.

Quand une écriture n'a pas pu partir (service injoignable, base momentanément indisponible), l'écran
dit **combien** attendent, **dans quelles collections**, **depuis quand**, et **ce que la base a
répondu au dernier renvoi** — puis propose deux gestes : *Renvoyer maintenant*, ou *Abandonner ces
écritures* (avec confirmation). Ces écritures sont **sur le poste**, pas dans la base : les autres
postes ne les voient pas encore. Le renvoi est automatique (toutes les trente secondes, et au retour
du réseau) ; un refus définitif — session expirée, anti-CSRF — ne se répare pas en attendant : il
faut recharger la page, et se reconnecter si cela persiste.

Si l'essai d'écriture est refusé avec `csrf_invalide`, l'écran dit **pourquoi** : le service et
l'application ne sont pas sur le même hôte, et la page ne peut pas lire son jeton anti-CSRF (un
cookie n'est lisible que par les pages de son hôte). Le remède est de **laisser l'adresse vide** —
le service du déploiement est servi sur le même domaine, sous `/v1/` — et, côté service, de vérifier
que `API_BASE` n'est pas renseigné pour rien. Voir `../server/mysql/README.md` § 4.

### 5.2 Variables du service

Toutes les variables sont décrites dans `../server/env.example` et `../server/mysql/env.example`.
Les plus importantes :

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` / `HOST` | `8080` / `0.0.0.0` | écoute du service |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SOCKET` | — | accès à la base |
| `DB_POOL` | `8` | connexions simultanées |
| `API_TOKENS` | — | jetons d'écriture, en `libellé:empreinte_sha256` |
| `CORS_ORIGINS` | *aucune* | origines autorisées à appeler l'API, séparées par des virgules. **Vide = aucune** (une API de service public n'a pas à être appelable en lecture de cookies depuis n'importe quel site). À renseigner seulement si l'application est servie par une **autre origine** que le service : `CORS_ORIGINS=https://actes.exemple.fr`. `*` reste possible, mais il ne transporte **aucune session** (la spécification interdit `access-control-allow-credentials` avec `*`) : il ne convient qu'à un accès sans cookie |
| `MAX_BODY` | `8388608` | taille maximale d'une requête (8 Mio) |
| `MAX_SYNC_RECORDS` | `4000` | enregistrements par synchronisation |
| `MAX_STATE_CHARS` | `8000000` | capacité de l'état signature/publication |
| `MAX_DOC` | `400000` | taille d'un acte déposé |
| `RATE_MAX_WRITES` / `RATE_WINDOW_MS` | `600` / `60000` | limitation de débit des écritures, par IP |
| `AUTO_MIGRATE` | `false` | appliquer `schema.sql` au démarrage |
| `AUTH_MODE` | `demo` dans le service, `password` dans le `.env` livré et le compose | `demo` (comptes de l'application + jetons) ou `password` (comptes locaux : mot de passe + session) — § 4.3 bis. Le `.env` livré pose `password` : c'est le mode d'une installation réelle. Un conteneur lancé **hors** du compose (sans `.env`) retombe, lui, sur `demo` |
| `DEMO_ACCOUNTS` | `false` en mode password | laisse le raccourci « choisir un compte » ouvert (recette) |
| `DEMO` | selon le mode | **commutateur de démonstration** : `true` installe le jeu fictif complet, `false` fait partir l'outil d'un **référentiel vierge**. Vide = `AUTH_MODE=demo` ou `DEMO_ACCOUNTS=true` l'allument, `password` l'éteint |
| `ADMIN_LOGIN` / `ADMIN_PASSWORD` | `admin` / — | compte d'administration créé au **premier** démarrage |
| `ADMIN_NOM`, `ADMIN_EMAIL`, `ADMIN_ENTITY` | — | son nom, son adresse, son entité de rattachement |
| `SESSION_DAYS` | `12` | durée d'une session |
| `MDP_MIN_LONGUEUR` | `12` | longueur minimale d'un mot de passe |
| `SCRYPT_N` | `65536` | coût du calcul du dérivé (durcir ralentit les tentatives) |
| `COOKIE_SECURE` | `true` | `Secure` sur les cookies de session — `false` **seulement** pour un essai en clair |
| `RATE_MAX_CONNEXIONS` | `30` | tentatives de connexion par IP et par fenêtre |
| `SMTP_HOST` | — | serveur de messagerie de la collectivité. **Vide = pas d'envoi** : les notifications sont alors tracées « non envoyées », et l'application reste entièrement utilisable — § 5.5 quinquies |
| `SMTP_PORT` | `587` (`465` si `SMTP_SECURE=ssl`) | port du serveur |
| `SMTP_SECURE` | déduit du port | `ssl` (TLS direct), `starttls` (négocié après EHLO), ou `aucune` (à éviter : identifiants en clair) |
| `SMTP_USER` / `SMTP_PASS` | — | identifiants, si le serveur en exige. **Le mot de passe ne quitte jamais le service** : l'application ne le voit jamais |
| `SMTP_FROM` | — | adresse d'expédition (doit être autorisée par le serveur) |
| `SMTP_FROM_NAME` | — | nom affiché de l'expéditeur, si le référentiel n'en pose pas |
| `SMTP_REPLY_TO` | — | adresse de réponse, si elle diffère de l'expéditeur |
| `SMTP_NOTIF_ACTIVE` | `true` | coupe-circuit général : `false` désactive tout envoi sans toucher au référentiel |
| `SMTP_TLS_INSECURE` | `false` | `true` accepte un certificat non vérifié (dépannage seulement) |
| `SMTP_HELO_NAME` / `SMTP_TIMEOUT_MS` | — / `15000` | nom annoncé en EHLO, délai d'un dialogue SMTP |

**Le prestataire de signature** (§ 5.5 sexies) se règle par des variables de **référentiel** — le
service les valide, puis les transmet au navigateur, qui les applique par-dessus le référentiel
(elles apparaissent donc aussi dans *Administration › Signature*, où elles sont signalées comme
posées par le déploiement) :

| Variable | Défaut | Rôle |
|---|---|---|
| `SCRIBA_SIGNATURE_API_TRANSPORT` | `service` | `service` (le service appelle le prestataire — la clé reste au serveur) ou `demonstration` (circuit simulé, aucun appel sortant) |
| `SCRIBA_SIGNATURE_API_URL` | — | adresse de base de l'API du prestataire. **Vide, le circuit reste simulé** |
| `SCRIBA_SIGNATURE_API_PRESTATAIRE` | `esup-signature` | identifiant technique du prestataire (en-têtes, journal) |
| `SCRIBA_SIGNATURE_API_NIVEAU` | `avancee` | `simple`, `avancee` (certificat) ou `qualifiee` (eIDAS) |
| `SCRIBA_SIGNATURE_API_NOTIFICATION` | — | adresse appelée par le prestataire après signature. Vide : l'adresse du service + `/v1/webhooks/signature` |
| `SCRIBA_SIGNATURE_API_TIMEOUT` | `20000` | délai maximal d'un appel au prestataire (ms) |
| `SCRIBA_SIGNATURE_API_CHEMIN_DOCUMENT` | `/documents` | point de terminaison qui reçoit le document |
| `SCRIBA_SIGNATURE_API_CHEMIN_SIGNATAIRES` | `/documents/{document}/signataires` | ajout d'un signataire |
| `SCRIBA_SIGNATURE_API_CHEMIN_DEMARRER` | `/documents/{document}/demarrer` | démarrage du circuit |
| `SCRIBA_SIGNATURE_API_CHEMIN_STATUT` | `/documents/{document}` | relecture du statut |
| `SCRIBA_SIGNATURE_API_CLE` | — | **SECRET.** La clé que le service présente au prestataire. Elle **ne quitte jamais le serveur** : ni transmise au navigateur, ni journalisée, ni recopiée dans le référentiel ou une sauvegarde de données |

La clé et les points de terminaison dépendent du **produit** : commencez par `GET /v1/health` puis
`GET /v1/config` (qui rend l'état du prestataire : actif ou non, son adresse, son niveau, et un
booléen disant si la clé est là — **jamais la clé**), et éprouvez l'ouverture d'un circuit sur un
acte d'essai avant de l'annoncer aux services.

Variables du conteneur `web` : `HTTP_PORT`, `APP_DIR`, `API_BASE`, `API_TOKEN`,
`CORS_ORIGINS` — plus `AUTH_MODE`, `DEMO_ACCOUNTS` et `DEMO`, qui servent seulement à annoncer le
mode au navigateur avant le premier appel (`web/config.js.template`) : le mode et le commutateur du
**service** restent autoritaires (`GET /v1/auth/config`).

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

### 5.4 Fonctions expérimentales

**Administration › Expérimentale** rassemble les fonctions livrées mais **éteintes par défaut**,
activables d'un clic. Le réglage (`config.experimental`) suit le référentiel exporté et importé.

Il n'y a plus qu'une fonction expérimentale : la **télétransmission au contrôle de légalité**
(l'étape qui s'intercale entre le retour signé et la publication, avec l'accusé de réception de la
préfecture). Le **parapheur**, lui, est **sorti du régime expérimental** : le **circuit de
validation** d'un acte avant sa signature est une fonction ordinaire — l'écran Parapheur et son
entrée de menu, l'onglet « Circuits de validation » de l'Administration, le réglage de circuit
d'une trame et la carte Parapheur d'un acte sont toujours là. Un référentiel qui n'en veut pas
écarte le circuit sur ses trames (« Aucune validation ») ou désactive le circuit concerné.

Le circuit se compose de **trois natures d'étape**, choisies marche par marche :

- la **Vérification** — le contrôle du dossier avant tout engagement. C'est la marche du
  **réviseur**, et c'est elle qui ouvre le circuit général de la démonstration ;
- le **Visa** — le « bon pour accord » qui engage le service ou la direction ;
- la **Signature** — le signataire marque son accord, et le circuit s'achève.

Chaque nature appelle un **rôle par défaut** (réviseur, éditeur, signataire), que l'administrateur
peut changer, ainsi qu'un libellé et la restriction au service de l'acte. Un circuit ancien reste
lu : une étape « bon pour accord » est tenue pour un visa, une étape « avis » pour une
vérification. Le réglage `experimental.parapheur` n'est plus servi ; il reste lu (toujours vrai)
pour ne pas casser un référentiel antérieur.

Le parapheur éteint, le trajet d'un acte est : rédiger → signer → **publication automatique** au
recueil (pour un acte publiable) → suivre les délais. Un acte individuel (trame non publiable)
s'arrête à la signature. La publication automatique se **coupe** d'un réglage (§ 5.5) : éteinte,
l'acte signé attend au registre, et se publie à la main.

La seconde est la **transmission au contrôle de légalité par API** (la *télétransmission*).
Activée, elle **s'intercale automatiquement entre le retour signé et la publication** : le service
adresse l'acte signé à l'**API d'envoi** du contrôle de légalité (`POST /v1/actes/{id}/transmission`,
`src/lib/legalite.js`), reçoit un **accusé de réception** — qui vaut **certificat informatique de
transmission**, mention « Transmis au contrôle de légalité le … à … », avec sa référence et son
**sceau** (empreinte des mentions rapprochée de celle du document) — le **dépose sur le document**
(original signé et version publiée), constate la formalité au nom de l'agent, puis publie l'acte.

L'ordre **signé → transmis → publié** est tenu **côté service**, et non seulement côté client : le
drapeau est transmis au dépôt (`POST /v1/actes`, champ `controleLegalite`), la transmission d'un
acte non signé est refusée (`409 acte_non_signe`), et la publication d'un acte déclaré soumis à
l'étape est refusée tant que la transmission manque (`409 transmission_absente`) — après le
contrôle de signature et avant celui de la date. L'appel est **idempotent** (un acte déjà transmis
renvoie son certificat), et `GET /v1/actes/{id}/transmission` relit le certificat.

Elle est **désactivée** à l'installation : la télétransmission suppose une **convention** et des
**identifiants d'accès** auprès de la préfecture. Éteinte, rien n'est adressé à l'API, la marche
n'apparaît pas dans le circuit de signature, et la transmission — quand elle est due — se constate
à la main depuis l'échéancier, comme les autres formalités. Les actes **déposés avant l'activation**
ne portent pas cette exigence : seuls les actes signés à partir de l'activation la portent. À
noter : le certificat de transmission est une **pièce du dossier**, pas une signature — il ne
modifie pas le paquet signé, dont l'empreinte reste celle qui a été signée.

### 5.5 Recueil public et publication automatique

**La page d'accueil de l'installation, c'est le recueil public.** Ouvrir l'adresse du logiciel
— `https://actes.votre-collectivite.fr/`, sans ancre ni paramètre — mène au recueil des actes
publiés, et non à l'atelier : c'est la page que le public peut lire, et celle que vous pouvez
communiquer ou afficher. L'atelier s'ouvre par le bouton **Se connecter** de l'en-tête du recueil
(ou par l'adresse suivie de `#/trames`). Un agent qui recharge la page en travaillant revient donc
au recueil, et repart d'un clic : c'est le prix de l'accueil public.

Les réglages de publication vivent dans **Administration › Publication** (ils suivent l'export du
référentiel, comme le reste) :

- **Titre du recueil** — le titre sous lequel les actes sont publiés. Il s'affiche en tête du
  recueil public et sur chaque acte.
- **Publication automatique après signature** (*vrai* par défaut). **Automatique** : dès que la
  signature revient, un acte publiable est publié et devient opposable, sans geste de l'agent.
  **Désactivée** : l'acte signé **ne déclenche plus rien** — ni publication, ni transmission au
  contrôle de légalité — et attend au registre, à publier à la main depuis « Signature &
  publication ». C'est le réglage à retenir pour une administration qui publie dans **son propre
  système** (recueil papier, portail éditorial) et ne veut pas que Scribae dépose les actes à sa
  place. Le fait est inscrit au journal (`publication.automatique_eteinte`). Le réglage coupe le
  geste **automatique**, pas la publication : un acte signé reste publiable à la main.
- **Règle d'opposabilité** — le lendemain de la publication, ou après *n* jours.
- **Recueils extérieurs et renvois** — les **autres recueils** que Scribae ne gère pas : un recueil
  **« bis »** (tenu à part, par exemple pour une entité autonome), un recueil **inactif** — qui
  n'est plus alimenté — avec la **période** qu'il couvre (plusieurs peuvent se succéder après des
  changements de logiciel), et les **sites de référence** (Légifrance, service-public.gouv.fr). On les
  ajoute, les ordonne et les retire ; un bouton **« Rétablir les renvois livrés »** fait revenir
  Légifrance et service-public.gouv.fr. Ils s'affichent **en bas de page** du recueil public et **à la
  fin des résultats de recherche**, sous le titre « Vous ne trouvez pas ce que vous recherchez ? ».
  Selon la plateforme, ce bloc n'apparaît que dans la vue servie par l'application (démonstration) :
  le service auto-hébergé, qui rend `/recueil`, ne connaît pas encore ce réglage (voir `TODO.md`).
- **Mentions du recueil public** — les deux mentions que tout site public porte en bas de page. Les
  **mentions légales** rappellent à quelles conditions un acte est **exécutoire et opposable**
  (publication et transmission au représentant de l'État, article L. 2131-1 du CGCT) et le **délai de
  recours de deux mois** (article R. 421-1 du CJA) ; les **mentions d'accessibilité** rappellent les
  obligations d'accessibilité d'un service en ligne (article 47 de la loi du 11 février 2005, RGAA),
  la **déclaration d'accessibilité** et la façon de **signaler un obstacle**. Chacune se règle
  **indépendamment**, avec trois **présentations** : un **texte** (écrit ici, replié sous son titre en
  bas de page du recueil), un **lien** (le pied de page ne porte qu'un renvoi — vers les mentions
  légales du site principal de la collectivité, par exemple) ou **rien**. Dans le texte, une **ligne
  vide** sépare deux paragraphes et une ligne commençant par **« - »** devient une puce. Un bouton
  **« Rétablir le texte livré »** ramène la mention livrée avec l'application — elle n'est donc jamais
  perdue. Comme les renvois, ces mentions ne sont pour l'instant portées que par la vue servie par
  l'application (voir `TODO.md`).

**Le recueil public** est le site sans compte que les administrés consultent : `…/?recueil=1` (un
acte : `…/?acte=<clé>`). Il
lit le **service de publication** (jamais les données locales) et ne montre que les actes
**réellement publiés**. Dans une administration qui a éteint la publication automatique, il reste
donc vide tant qu'aucun acte n'a été publié à la main. Il n'expose rien d'autre que la structure
(nom, logo, titre du recueil) et le texte publié de chaque acte, avec ses métadonnées ; l'adresse
d'un acte (`…/?acte=<clé>`) se cite et se partage.

**Abrogations et versions, ce que le recueil montre.** Un acte publié ne se supprime pas : il
**s'abroge**, par un acte nouveau qui le vise. Sauf réglage contraire, la page d'un acte rend
**sa version la plus récente** ; une case **« Afficher les versions antérieures »** (offerte
seulement quand il en existe) les fait réapparaître, et une case **« Afficher les articles
abrogés »** révèle les articles abrogés, **barrés** et signalés comme tels. Le retrait est
réservé à l'administrateur, sur **motif technique** seulement ; une fois un acte retiré, il
disparaît du recueil **et** des adresses du recueil ouvert. Les **tournures** de la clause
d'abrogation et les **mentions** de renumérotation se règlent dans **Administration ›
Vocabulaire** (cartes « Abrogation — tournures » et « Modification ») : elles suivent l'export du
référentiel, donc une installation peut les adapter à sa langue juridique. **L'application** des
abrogations (bascule de l'acte visé en *abrogé*, consolidation de l'article) a lieu **au jour de
l'entrée en vigueur** de l'acte abrogeant, non à sa publication : elle est **idempotente** et
rejouée au démarrage comme après chaque publication, si bien qu'une date d'effet future est
honorée sans autre intervention.

**Mettre un acte à la une.** Les administrateurs et les éditeurs peuvent **épingler** un acte
depuis l'onglet **Actes** (bouton punaise, permission `publications.epingler`,
`POST /v1/publications/{cle}/epingle`) : il entre alors dans la bande **« À la une »** de la page
d'accueil du recueil public, au-dessus du carrousel des derniers actes — la place d'un
**règlement intérieur** ou d'une charte, c'est-à-dire d'un document qu'on vient chercher. La
bande s'efface dès qu'une recherche ou un filtre est posé. Le drapeau suit l'**acte** (son
identifiant ELI) : un acte **modifié ou consolidé reste à la une**, et le geste se défait d'un
second clic.

### 5.5 bis Le recueil ouvert : moteurs de recherche et agents

Un acte publié est une **donnée publique**, et ses lecteurs ne sont pas tous humains : les
**moteurs de recherche** le parcourent pour le référencer, les **agents** (assistants, LLMs) le
consultent pour répondre à des questions. Ceux-là **n'exécutent pas** l'application : il leur faut
des **adresses stables** et des **représentations** qu'ils savent lire.

- **En mode auto-hébergé**, le service sert lui-même ces adresses, en pages HTML rendues **sans
  JavaScript** : `/recueil` (la liste), `/recueil/<clé>` (un acte), `/recueil/<clé>.<ext>` (une
  représentation) — plus `/llms.txt` (le recueil présenté aux agents, convention `llms.txt`),
  `/recueil.json` (l'index complet), `/sitemap.xml` (une adresse par acte) et `/robots.txt`.
  nginx route ces chemins vers le service **avant** la page de l'application (voir
  `../server/README.md`). C'est le mode à préférer si l'indexation des actes compte pour vous :
  un robot n'a besoin d'aucun JavaScript.
- **En mode statique** (GitHub Pages, plateforme), il n'y a pas de serveur pour les servir : la
  page porte les mêmes adresses en **paramètres de requête** (`?acte=<clé>&format=md`), que
  l'application rend elle-même. Ces adresses ne sont lisibles que par un lecteur qui **exécute le
  JavaScript** ; les fichiers du recueil (`/llms.txt`, `/sitemap.xml`…) n'existent pas dans ce
  mode.
- **Les représentations** (les deux modes) : **JSON** (métadonnées, identifiant ELI et texte),
  **Markdown** (le texte structuré), **texte brut** et **Akoma Ntoso**. Le texte publié voyage
  avec la publication (`formats.md`, `formats.texte`) ; la page sait aussi le reconstituer à
  partir de la version en ligne, ce qui couvre les publications antérieures. **Les notes de
  préparation en sont écartées** : elles ne sont pas publiées.
- **Ce qui est exposé** est exactement ce qui est publié : les mêmes textes que la version en
  ligne, les mêmes métadonnées, et **rien** de l'atelier (ni trame, ni brouillon, ni compte, ni
  journal). Un acte **retiré** du recueil disparaît aussi de ces adresses.
- **La page se décrit** : titre, description, adresse canonique, une adresse par représentation et
  les données structurées JSON-LD. Les actes publiés se donnent donc à référencer sans réglage
  particulier, et chaque acte porte ses adresses à **copier** (bloc « Recueil ouvert », sous le
  texte) — dans le recueil public comme dans l'écran « Publications (ELI) » de l'administration.

### 5.5 ter Les assistants (« Plume » et « Publia »)

L'application livre deux assistants en langage naturel, réglés dans **Administration ›
Assistants** (le réglage suit l'export du référentiel, comme le reste) :

- **Plume**, dans l'atelier, explique le **mode d'emploi** de l'outil ;
- **Publia**, sur le recueil public, répond aux visiteurs à propos des **actes publiés**.

**Le nom et l'icône.** Chaque assistant porte un **nom** et une **icône** que vous changez ici
même : un champ pour le nom, une adresse d'image pour l'icône, et un aperçu qui suit la frappe.
L'interface les reprend **partout** — la pastille, le panneau, la bulle d'invitation, le menu du
compte. Laissez un champ **vide** pour revenir à ce que l'application livre (« Plume », « Publia »
et leurs portraits) : un assistant ne s'affiche jamais sans nom ni sans visage. Le réglage suit
l'export du référentiel, comme le reste.

**Ce qui sort de l'installation.** C'est le point à connaître avant d'allumer un assistant :

- **Plume n'envoie jamais le contenu d'un acte.** La connaissance qu'il reçoit est le **guide
  d'utilisation** (livré avec l'application, public) et le **nom de l'écran courant** — rien
  d'autre. Les fonctions qui composent sa question ne lisent ni les actes, ni les trames, ni les
  comptes : il n'y a rien à filtrer, parce que rien ne leur est transmis. En revanche, **ce que
  l'utilisateur écrit dans la zone de saisie part au moteur** : c'est un dialogue, et un agent qui
  collerait un extrait d'acte l'enverrait de son propre geste. L'interface le rappelle sous la
  zone de saisie.
- **Publia n'envoie que des données publiques** : les métadonnées des actes publiés, et le texte
  des dix plus récents — exactement ce que le recueil affiche déjà à qui le demande.

**Le moteur de langage.** Trois réglages, par assistant :

| Réglage | Ce qu'il fait |
|---|---|
| **Automatique** (défaut) | le moteur intégré s'il existe (Perchance), l'adresse personnalisée sinon |
| **Intégré (Perchance)** | le plugin `ai-text` de la plateforme ; **indisponible hors de Perchance** |
| **Personnalisé (API)** | l'API de la collectivité : adresse, clé, en-tête, modèle |

Deux protocoles sont acceptés pour l'API personnalisée : **complétions de conversation**
(`messages` rôle/contenu, avec flux SSE ou réponse JSON — OpenAI, Mistral, Groq, OpenRouter,
Ollama, LM Studio, vLLM, et la plupart des services souverains) et **appel simple**
(`{ prompt } → { texte }`). **Le service doit accepter les appels venus de l'origine de
l'application (CORS)** ; sinon, l'option **relais sans CORS** fait passer la requête par la
plateforme — à n'activer que si le service est bien le vôtre, puisque le relais voit alors passer
la requête (et la clé).

**Hors de Perchance** (édition statique GitHub Pages, auto-hébergement), il n'y a **pas** de
moteur intégré : un assistant en mode *Automatique* ou *Intégré* n'a donc pas de moteur, et
l'interface le dit (« L'assistant n'a pas de moteur », avec le renvoi vers l'Administration).
Renseignez une **adresse personnalisée** pour le faire fonctionner : c'est le seul chemin hors de
Perchance, et il laisse les échanges sur votre réseau.

**Instruction et questions proposées.** Pour chaque assistant, l'administrateur modifie
l'**instruction** envoyée au moteur (le rôle, ce qu'il ne fait jamais, sa manière de répondre —
« laissez vide » rétablit le texte livré) et la liste des **questions proposées** : une étiquette
de bouton et la question envoyée, ajoutables et supprimables. Une question tirée au sort est
soufflée dans une petite bulle, une fois par chargement. Le bouton **Tester le moteur** dit
immédiatement si le moteur répond, et **Rétablir les réglages livrés** efface les écarts.

**Les réponses renvoient par des liens.** Plume termine par le lien du **chapitre du guide** qui
répond à la question ; Publia recopie le lien de l'**acte** dont il parle. Le lecteur clique, et
l'application ouvre le chapitre ou l'acte **dans la page**, sans la recharger ni ouvrir d'onglet.
Ce qui est demandé au moteur est précisément de **ne jamais composer d'adresse** — ni de parler de
« clé », de « paramètre » ou d'identifiant technique : le lecteur clique, il ne compose rien. Et
sur le recueil, quand un visiteur a ouvert un acte, **Publia le sait** : il reçoit la fiche de cet
acte, **toutes ses versions publiées** et son texte, et l'instruction lui demande de répondre
**d'abord sur lui** — ce qu'il prévoit, sa portée, ses dates, ses modifications. C'est la question
que se pose le lecteur, même s'il ne la formule pas. Ce comportement ne se règle pas : il tient à
ce que l'assistant **sait**, et non à un réglage.

**La clé d'API du moteur.** C'est un **secret**, et il est traité comme tel : la clé **n'est pas
rangée dans le référentiel** — elle ne figure donc ni dans l'export de données (« Exporter tout
(JSON) »), ni dans une sauvegarde de la base, ni dans un export de référentiel vers un autre
poste. Elle est conservée **par poste**, dans le stockage local du navigateur qui la saisit
(réglage local, comme l'apparence claire ou sombre) ; un déploiement auto-hébergé peut aussi la
remettre par l'environnement. Utilisez une clé **dédiée à cet usage** et **révocable** plutôt
qu'une clé d'administration générale, et saisissez-la sur les seuls postes qui doivent interroger
le moteur.

**Ce que le transfert implique (RGPD, art. 13 et 28).** Le point à instruire avant d'allumer un
assistant, noir sur blanc :

| Question | Réponse |
|---|---|
| Qui reçoit la question ? | le **moteur réglé** : le moteur intégré de la plateforme Perchance quand il existe, sinon l'**API** que vous renseignez (votre fournisseur, ou votre propre service) |
| Pour quelle finalité ? | répondre à la question posée dans l'interface — rien d'autre |
| Quelles données partent ? | la **question écrite par l'utilisateur** ; pour Publia, des **extraits d'actes publiés** (donc publics par nature). Aucun contenu d'acte non publié, aucune donnée de compte, aucune donnée de brouillon |
| Où sont-elles traitées ? | là où est le moteur — **hors Union européenne** pour le moteur intégré de la plateforme ; selon votre contrat pour une API souveraine |
| Combien de temps ? | selon la politique du moteur ; Scribae n'en conserve **rien** |

Une **analyse d'impact** n'est requise qu'en cas de traitement à grande échelle ou de données
sensibles : ici, la question posée par un agent à un assistant de mode d'emploi n'entre pas, par
elle-même, dans ce champ — mais c'est à la collectivité de le constater et de l'écrire dans son
registre.

**Et si l'on ne veut aucun transfert ?** **Éteignez les deux assistants** : plus aucune question ne
part. Le recueil et l'atelier ne sont pas pour autant muets — hors moteur, les assistants
répondent par **recherche documentaire locale** (le chapitre du guide, ou les actes publiés) et
l'écran le dit dans une note discrète : rien ne sort du navigateur.

**Éteindre un assistant.** Le réglage *Éteint* le fait disparaître complètement de son interface
— pas de pastille, pas de panneau — et plus aucune question n'est transmise. Les deux s'éteignent
séparément. Ce réglage vaut pour **toute l'installation** ; chaque agent peut en outre **masquer**
un assistant **pour son seul compte**, dans le menu de son nom (bloc « Assistants ») — une
préférence de poste, comme l'apparence claire ou sombre, qu'il retrouve à chaque connexion et qui
ne touche pas au référentiel.

### 5.5 quater L'organigramme des délégations de signature

L'écran **Délégations**, dans le menu de l'atelier, montre **qui peut signer à la place de qui** :
chaque chaîne part d'une **autorité de tête** (le maire, le président d'un établissement
autonome) et descend, de délégation en sous-délégation. Deux présentations, au choix :
**organigramme** (qui défile horizontalement sur un écran étroit) ou **liste** indentée. Cliquer
un acteur ouvre sa **fiche** : le pouvoir reçu (délégant, organisation, décision de délégation),
son étendue (famille de trames, type d'acte, matières), ses dates, et **la signature que cela
produira** — les lignes de qualité et les décisions visées, recalculées à la frappe.

**Ne pas confondre les deux organigrammes.** Celui-ci montre les **chaînes de signature** ; l'écran
**Organigramme**, lui, montre la **structure** — entité → service → bureau (voir `../SPEC.md`
§ 2.7.1). Une entité peut y être déclarée **autonome** ou **rattachée** à une autre (une régie
municipale, sans personnalité morale propre, mais avec son directeur, son service et ses actes), et
porter un **signataire principal** : la personne qui signe ses actes **quand la trame n'en désigne
aucun** — le maire pour la commune, la directrice pour le CCAS, le directeur pour la régie. Ce
signataire par défaut ne remplace ni un signataire désigné sur la trame, ni une **délégation** : les
deux se combinent, la chaîne de délégation restant souveraine quand elle existe.

**Qui peut quoi.** L'écran est **visible par tous les comptes** : savoir qui peut signer n'est pas
une donnée réservée. Le **modifier** est gardé par la permission `delegations.gerer`, accordée
aux **administrateurs et aux éditeurs** ; un compte qui ne l'a pas lit exactement la même fiche,
sans les champs de saisie — et l'écran le lui dit, d'une pastille « Consultation ».

**Ce qui compte pour l'exploitant.** Ces chaînes sont ce qui décide des **signataires proposés**
dans la rédaction (le choix se fait **par fonction**, voir § 4.1) et des **visas** imprimés au bas
de l'acte : une délégation donnée dans le nom d'une autre organisation ne s'applique jamais aux
actes de la première, et une délégation limitée à une famille ou à un type d'acte ne s'applique
qu'à eux. Une délégation **suspendue** ou **hors de ses dates** reste visible dans
l'organigramme, signalée comme telle, mais ne s'applique plus : c'est ce qui permet de vérifier
un acte signé l'an dernier sans rouvrir le référentiel. Les délégations dont le délégant est
vide, inconnu ou forme un cycle sont listées « **non rattachées** » sous l'organigramme.

**Les deux décisions d'un délégataire.** Un signataire ne se configure pas sans ses décisions de
**nomination** et de **délégation** : la fiche les demande toutes les deux, et « Créer la
délégation » les refuse tant qu'il en manque une. Chacune se renseigne d'un **acte publié au
recueil** (le visa portera le lien du recueil en ligne), d'un **lien externe** (le texte est
ailleurs : site de la collectivité, Légifrance, intranet), ou d'une **référence du référentiel**
qui porte son adresse de source. Dans tous les cas, l'acte publié — sur le web comme en PDF —
porte l'intitulé et le **lien cliquable** de la décision. Les délégations **déjà enregistrées**
avant cette règle ne sont pas refusées : elles sont **signalées** (badge « Décisions à compléter »
sur l'organigramme et sur la fiche, alerte sur la fiche, et contrôle de conformité **à
l'attention** de l'écran de révision). L'autorité de tête, elle, garde sa seule « Décision
fondant son pouvoir de signer », renseignée sur sa **fiche de personne** (Administration ›
Personnes).

**Créer une délégation n'écrit rien avant confirmation** : la fiche d'une délégation neuve
travaille sur un brouillon, et le référentiel n'est touché qu'au moment de « Créer la
délégation ».

### 5.5 quater bis Les assemblées délibérantes (les conseils)

Beaucoup d'actes n'émanent pas d'une **personne** mais d'une **assemblée** : le **conseil
municipal**, le **conseil d'administration** d'un établissement public. C'est le cas des
**délibérations**, dont la ligne d'autorité est celle du conseil — « Le conseil municipal de
Valmont-sur-Loire » — alors que l'acte est **signé par le président de cette assemblée** : le
**maire** pour un conseil municipal, le **président du conseil d'administration** pour un
établissement public. L'autorité de l'acte et le signataire ne se confondent plus.

L'onglet **Administration › Assemblées** tient la liste des conseils de l'installation. Chaque
conseil se décrit par son **entité de rattachement** (le conseil municipal est celui de la
commune ; le conseil d'administration, celui de l'établissement), sa **formule d'autorité** (la
ligne d'en-tête de l'acte, telle qu'elle s'imprime) et la **qualité qui signe** : la **fonction**
du référentiel sous laquelle l'assemblée fait signer ses actes (« Maire », « Président /
Présidente du conseil d'administration »…). Ce dernier réglage est ce qui rend le dispositif
**configurable conseil par conseil** : chaque assemblée a la sienne, sans toucher au code.

**Ce qui compte pour l'exploitant.** Une trame produit un **acte d'assemblée** par sa case « Acte
d'assemblée — délibération » (éditeur de trame) : la ligne d'autorité de ses actes devient alors
celle de l'assemblée de l'entité, tandis que le signataire reste **une personne** — le
président du conseil, choisi dans la trame — dont la chaîne de délégations continue de
s'appliquer. Une trame de délibération est fournie dans le jeu de démonstration (conseil municipal
et conseil d'administration), et la conformité signale un acte dont le signataire ne **porte pas**
la qualité appelée par son assemblée : la signature n'aurait alors pas la qualité annoncée.

### 5.5 quinquies Le courriel : notifications et serveur SMTP

Scribae **n'envoie pas** de courriel lui-même. L'application **demande** au service de le faire
(`POST /v1/courriel/envoi`), et c'est le **service** qui parle au serveur de messagerie de la
collectivité. La séparation est nette, et c'est une règle de sécurité : **le mot de passe SMTP
ne quitte jamais le service**. L'application ne le voit pas, ne le transporte pas, ne le range
pas ; l'écran d'administration ne montre que l'**état** de la chaîne (`GET /v1/courriel` :
hôte, port, chiffrement, adresse d'expédition, authentifié ou non).

**Ce qui se règle où.**

| Niveau | Où | Ce qu'on y règle |
|---|---|---|
| **Le serveur** | `.env` du service (`SMTP_*`, § 5.2) | hôte, port, chiffrement, identifiants, adresse d'expédition — ce que le service doit savoir pour **parler** au serveur |
| **La politique** | Administration › **Courriel** (`config.courriel`, dans le référentiel) | notifications activées ou non, **nom affiché** de l'expéditeur, **adresse de réponse**, **copie systématique**, et les **six événements** notifiés |

Le partage est délibéré : la **politique** suit le référentiel (elle s'exporte, s'importe, se
sauvegarde avec lui) et se règle **sans toucher au serveur** ; la **connexion** reste au `.env`,
parce qu'elle porte un secret. Les `SMTP_*` sont documentées dans `../server/mysql/env.example`
(et `../server/env.example`), et le tableau du § 5.2 en résume les valeurs et les défauts.

**Les six événements.** Chacun s'active indépendamment : *acte à signer* (au signataire désigné),
*acte signé* et *acte publié* (au rédacteur et aux éditeurs), *acte à valider* (à l'agent dont
c'est l'étape du parapheur), *acte à réviser* (aux réviseurs compétents), et *notification à
l'intéressé* (aux destinataires désignés par l'agent, depuis l'écran « Exécution & délais »).
Les destinataires sont résolus **par compte et par rôle**, les adresses invalides écartées, les
doublons supprimés, et un même acte n'est pas notifié deux fois pour le même événement.

**Quand rien ne part.** Le service répond `disponible: false` — parce que `SMTP_HOST` est vide,
parce que `SMTP_NOTIF_ACTIVE=false`, ou parce que l'installation n'a pas de service (démo). Dans
ce cas, **chaque** notification est **tracée « non envoyée »**, avec son motif, au **journal**
et sur l'**acte** (`acte.courriels`, donc dans son dossier interne) : rien n'échoue en silence,
et l'application reste entièrement utilisable. C'est le réglage normal d'une installation qui n'a
pas encore de serveur de messagerie.

**Vérifier la chaîne.** Administration › Courriel montre l'état du serveur (hôte, port,
chiffrement, adresse d'expédition), permet d'envoyer un **message d'essai** (bouton inactif tant
que l'envoi n'est pas configuré), et liste les **derniers envois** depuis la table `sb_courriel`
(quand, quel événement, quels destinataires, quel objet, envoyé ou non, avec le motif en cas
d'échec). Un envoi de test ne passe pas par la politique de notification : c'est un essai, pas un
événement.

**Le moteur SMTP** (`src/server/mysql/smtp.mjs`) est écrit pour l'occasion et **sans
dépendance** : EHLO et capacités annoncées, `STARTTLS`, `AUTH LOGIN` et `AUTH PLAIN`, `MAIL
FROM` / `RCPT TO` / `DATA` avec le doublement des points, sujet encodé (RFC 2047), corps en texte
**et** en HTML (multipart/alternative, base64 par lignes de 76). Il reçoit un **transport
injecté** (`lireReponse`, `ecrire`, `demarrerTls`, `fermer`), ce qui permet de le tester sans
réseau — et c'est ainsi qu'il a été vérifié. Le mot de passe n'apparaît dans aucun journal.

### 5.5 sexies Le prestataire de signature (le circuit électronique par API)

Le circuit électronique suppose un prestataire **joignable** : un parapheur, ESUP-Signature,
l'outil de la collectivité. Deux choses le mettent en service : une **adresse**, et une **clé**.

**Où cela se règle.** Dans *Administration › Signature*, encart **« API du prestataire (circuit
électronique) »** ; ou, pour un déploiement, par les variables `SCRIBA_SIGNATURE_API_*` du
`.env` (voir § 5.2) — qui **l'emportent** sur le référentiel, et que l'écran signale comme telles
pour qu'on ne saisisse pas dans le vide. L'écran indique d'un coup d'œil si le circuit est
**branché** ou **simulé**, et pourquoi.

**La clé ne quitte jamais le serveur.** C'est la raison d'être du réglage `transport = "service"` :
c'est le SERVICE qui appelle le prestataire (`server/mysql/signature.mjs`), jamais le poste de
travail. La clé (`SCRIBA_SIGNATURE_API_CLE`, variable de **service**, marquée *secret*) n'est ni
transmise au navigateur, ni journalisée, ni comprise dans l'export des données du référentiel. Un
`transport = "demonstration"`, ou une **adresse vide**, laisse le circuit **simulé** : l'application
joue le prestataire sur le poste, et rien ne sort de la collectivité. C'est l'état d'une
installation qui n'a pas encore de prestataire — rien n'est cassé, mais aucun acte n'est
réellement signé par un tiers.

**Ce que le service appelle.** À l'ouverture d'un circuit (`POST /v1/actes/{id}/signature`), le
service **provisionne le document**, **ajoute les signataires**, **démarre le circuit**, avec les
quatre points de terminaison réglés (le jeton `{document}` y porte l'identifiant rendu au dépôt) et
un **délai** d'attente. La réponse de l'application porte alors le `dossier`, le `lienSignature`
(la fenêtre du prestataire, affichée à l'agent), et l'état du prestataire. En cas d'échec, le
service répond `502 prestataire_indisponible` — adresse erronée, clé refusée, réponse illisible :
c'est ce code qu'il faut chercher dans la console « API & journal », qui garde la requête, la
réponse, le statut et la durée.

**Comment l'éprouver.** Renseignez l'adresse, le prestataire, le niveau et la clé ; puis, sur un
**acte d'essai** (jamais un acte réel), déclenchez « Envoyer en signature ». Trois vérifications
dans l'ordre : (1) `GET /v1/config` annonce le prestataire `actif` avec `cle: true` ; (2) le
journal « API & journal » montre un appel **sortant** vers l'adresse réglée, avec un statut
`2xx` ; (3) l'agent voit la **fenêtre du prestataire** s'ouvrir, et non l'outil de démonstration
embarqué. Si le journal montre une simulation, c'est que l'adresse est vide, le transport réglé
sur `demonstration`, ou que le service n'a pas la clé.

**Ce que le prestataire doit accepter.** L'adresse de **notification** : le prestataire la
rappellera une fois l'acte signé (`POST /v1/webhooks/signature`). Laissée vide, le service
compose l'adresse de son propre domaine, suivie de `/v1/webhooks/signature` ; elle doit être
joignable **depuis l'extérieur**, en HTTPS, et la convention avec le prestataire doit prévoir le
format de cette notification (l'application accepte le retour signé et **revérifie l'empreinte**
du document avant de le tenir pour signé).

### 5.6 Numérotation : séquence interne, ou service externe

Par défaut, l'application tient elle-même la **séquence** des numéros d'acte
(`config.numbering.seq`), réservée depuis l'écran de rédaction. Une collectivité qui **numérote
déjà ailleurs** — un document **Grist**, un tableur en ligne, un référentiel interne — peut faire
**attribuer le numéro par ce service** : **Administration › Numérotation** › *Attribution du
numéro* › **API externe**.

Le réglage (`config.numbering.source` et `config.numbering.externe`) suit le référentiel exporté
et importé, comme le reste. Il porte :

- le **transport** : `relais` (par le relais HTTP de l'hébergement, qui contourne CORS — c'est le
  transport par défaut, et le seul praticable avec l'API de **Grist**, qui refuse l'en-tête
  `Authorization` d'une origine de navigateur inconnue) ou `direct` (appel du navigateur, l'API
  devant autoriser l'origine de l'application) ;
- l'**adresse**, la **méthode**, les **en-têtes** (c'est là que va la clé d'API) et le **corps**
  de la requête, avec les jetons `{entityCode}`, `{year}`, `{objet}`, `{date}`… ;
- **où lire la réponse** : le chemin du numéro (`records[0].id` pour Grist) et celui de la
  **référence** de la ligne créée ;
- le **motif** propre au numéro externe (facultatif) et le **délai d'attente**.

Un bouton **« Tester l'appel »** éprouve le réglage depuis le référentiel (il prévient qu'un essai
en POST crée réellement une ligne, donc consomme un numéro). La **référence de la ligne créée**
est conservée sur l'acte (`acte.numeroSource`) et l'attribution entre au **journal d'audit**
(`numero.attribution_externe`) ; l'échange lui-même est journalisé, requête et réponse, dans
« API & journal » sous le service « Numérotation ».

**Deux points d'exploitation.** La **clé d'API est conservée dans le référentiel** — donc dans
les sauvegardes JSON (§ 8) et, en base partagée, dans la base commune : prenez une clé
**restreinte à la seule table de numérotation**, et traitez les exports de référentiel comme des
documents sensibles. Et le **relais HTTP vient de l'hébergement** : il existe dans l'édition en
ligne, **pas dans le déploiement `src/server/`** — une installation auto-hébergée doit donc soit
déclarer l'origine de l'application **origine de confiance** chez le service et utiliser l'appel
direct, soit attendre un relais côté service (voir `src/TODO.md`).


#### La séquence interne, et le chrono

La séquence interne a son propre noyau (`src/lib/sequence.js`, module pur) : le **motif** du
numéro, le remplissage, l'**année** de référence, la séquence, et sa **PORTÉE** — un seul chrono
pour la collectivité (`global`, le défaut), un chrono **par entité** (`entite`), ou un chrono **par
type d'acte** (`type`). Le réglage se fait dans *Administration › Numérotation*, qui en donne un
aperçu (« Portée du chrono ») et ouvre l'écran du chrono. Une portée qui n'a pas encore de compteur
part de la séquence générale : passer d'un chrono global à des chronos par entité ne demande rien
à ressaisir.

**Un numéro n'est jamais attribué deux fois.** Le numéro proposé par la réservation est un numéro
**libre** : la séquence part du compteur et **avance** tant que le numéro composé est déjà porté par
un acte, ou déclaré annulé. C'est ce qui rattrape un compteur resté en arrière — des numéros
attribués hors de l'application, des données reprises d'un autre outil, un passage d'année. Le
compteur ne **recule jamais**, et il est fixé **après** le rang réservé.

**L'écran « Chrono de numérotation »** (menu de gauche, à côté des Actes) montre l'ensemble des
numéros attribués — et, avec eux, les deux choses qui expliquent les trous : les **rangs jamais
attribués** et les **numéros annulés**, avec leur motif. Compteurs en tête, filtres (année, entité,
type d'acte, état, source, période, texte), **tri par colonne**, et **export CSV ou XLSX** du
résultat filtré — l'export est engendré sans aucune dépendance, et le CSV porte son BOM pour
qu'Excel reconnaisse les accents. Deux gestes d'administration s'y trouvent aussi : le **passage à
l'année suivante** (l'année de référence change, la séquence repart au rang 1) et l'**annulation
d'un rang** — qui ne rend pas le numéro disponible, mais l'inscrit au chrono comme annulé. Aucun
geste ne renumérote : un numéro attribué est un fait.


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

> En mode **comptes locaux** (`AUTH_MODE=password`), les jetons d'API ne sont **plus acceptés** :
> c'est la session de l'agent qui porte l'autorisation, et une écriture sans session est refusée
> (401). Un jeton écrit dans la page est public ; il ne peut pas protéger une donnée. `API_TOKENS`
> peut donc rester vide dans ce mode.

### 6.1 bis Mots de passe et sessions

- **Ce qui est conservé** : un dérivé `scrypt` (sel et paramètres compris), jamais le mot de passe.
  Le coût se règle par `SCRYPT_N` — le durcir ralentit les tentatives d'un attaquant qui aurait
  volé la base, au prix de quelques centaines de millisecondes à la connexion.
- **Blocage progressif** : cinq échecs ferment le compte quelques secondes, puis de plus en plus
  longtemps (plafond : 15 minutes). La tentative est comptée sur le **compte**, pas sur l'IP — un
  attaquant réparti sur plusieurs machines n'y échappe donc pas, et le message ne dit jamais si
  l'identifiant existe.
- **Sessions** : seul le **SHA-256 du jeton** est en base (`sb_session`) ; le jeton lui-même n'existe
  que dans le cookie `HttpOnly` du navigateur. Une session ne se « récupère » donc pas depuis un
  dump de la base.
- **Anti-CSRF** : toute écriture exige l'en-tête `x-csrf-token`, égal au cookie `scribae_csrf` (que
  seul le JavaScript de l'origine peut relire). Sans lui : 403. La lecture, elle, passe avec le seul
  cookie de session.
- **Fermer l'accès d'un agent** : *Comptes et rôles* › **Mot de passe** › *Retirer* — ses sessions
  sont fermées dans le même geste. Désactiver le compte (bouton *Désactiver*) produit le même effet
  immédiat, sans toucher au mot de passe.
- **Ce qui reste hors de portée** : pas de second facteur, pas de réinitialisation par courriel, pas
  de détection d'usurpation. Un poste de travail compromis (ou un mot de passe partagé) n'est pas
  vu par le service. Pour cela : annuaire (§ 4.4).

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
- **CORS** : quand tout est servi par la même origine (cas du déploiement fourni), **rien à
  faire** : par défaut le service n'autorise aucune origine, et le navigateur n'en appelle
  aucune autre. Si l'application est servie par une autre origine, listez-la **exactement**
  dans `CORS_ORIGINS` (`https://actes.exemple.fr`) — `*` ne transporte aucune session, et les
  écritures en mode « mot de passe » en ont une (voir § 4.3 bis).
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

De même, la **documentation technique** (écran « Documentation technique ») est réservée aux
administrateurs par la permission `docs.voir`, mais ses fichiers (`src/docs/ADMINISTRATION.md`,
`server/README.md`, `SPEC.md`…) vivent dans `src/` et sont donc **publics**. La restriction cache
l'entrée de l'écran aux autres rôles — c'est un confort d'interface, pas un secret : n'y écrivez
jamais un identifiant, une clé ou une adresse à protéger (voir le paragraphe suivant).

Ne placez **jamais** dans `src/`, `main.pjs`, `index.html` ou `config.js` : mot de passe de
base, clé privée, jeton de production durable, URL de suppression. Les secrets vivent dans
`.env` (non versionné) et dans la configuration du serveur.

**Le recueil public, lui, est public par destination.** La route `recueil` (`?recueil=1`,
`?acte=<clé>`) ne demande aucun
compte : elle sert les actes **publiés** — et rien d'autre (ni brouillons, ni actes signés non
publiés) — à quiconque atteint l'adresse. C'est le propre d'un recueil des actes administratifs.
Si l'installation est exposée sur Internet, c'est donc le recueil qui est visible, avec les textes
qui y ont été déposés : ne publiez que ce qui doit l'être (cf. § 3.4, trames non publiables), et
n'oubliez pas que la **publication automatique** (§ 5.5) dépose les actes dès la signature —
coupez-la si la publication doit passer par votre propre système. Le **recueil ouvert** (§ 5.5
bis) étend cette visibilité aux **moteurs de recherche** et aux **agents** : sur un déploiement
auto-hébergé, le service expose `/robots.txt`, `/llms.txt`, `/sitemap.xml` et une adresse par
acte, sans JavaScript. Tout ce qui est publié est donc **indexable** — ce qui est le but d'un
recueil, mais qui doit être su avant de publier un acte dont la publicité est restreinte.

**Ce qui n'est jamais public : la part interne de l'original signé.** Publier un acte ne veut pas
dire tout publier de sa signature. L'original signé se partage en deux (voir § 6.6) : la part
**publique** — nom, fonction, date du signataire, empreinte et certificat — part au recueil et
par toutes les routes ouvertes ; la part **interne** — adresse électronique du signataire,
compte de l'application et compte de signature, moyen d'authentification, poste, adresse réseau,
horodatage détaillé, et la **trace des courriels** adressés au titre de l'acte — est rangée au
registre avec la publication, et **n'est servie par aucune route publique**. Elle se lit par la
route **protégée** `GET /v1/actes/{id}/dossier-signature` (jeton) et, dans l'application, par le
bouton « Dossier de signature (interne)… ». Autrement dit : un visiteur du recueil ne peut pas
déduire l'adresse électronique d'un signataire de la seule lecture des publications.

### 6.6 Signature électronique

La signature de la démonstration est **réelle cryptographiquement** (ECDSA P-256 + SHA-256,
certificat créé dans le navigateur, horodatage signé, vérification à la consultation) mais
**non qualifiée** : le prestataire est simulé et la chaîne de certification n'est pas eIDAS.
Le service recalcule l'empreinte SHA-256 du document signé et la compare à celle du document
déposé, donc on ne peut pas publier autre chose que ce qui a été signé. Pour une signature
**qualifiée**, il faut brancher le prestataire de la collectivité (point d'extension :
`src/lib/signature.js` côté application, et le domaine `actes.mjs` côté service).

**Trois circuits**, réglés globalement (Administration › **Signature**) ou par trame
(`trame.signature`) : `electronique` (défaut — l'acte part au prestataire et revient signé),
`simple` (le signataire signe **dans l'application**, avec son compte), `externe` (le document est
téléchargé, signé hors de l'application, et le PDF signé est déposé après certification du
réviseur). Un acte **engagé** dans un circuit y reste : changer un réglage ne déplace pas un acte
en cours.

**La signature simple est la plus nominative** — c'est dans la nature du procédé —, et c'est
pourquoi elle est celle dont l'original est le plus strictement partitionné. `partiePublique(pack)`
(`src/lib/signature.js`) retire du paquet la clé `interne` et, dans chaque signature, l'adresse
électronique, `personId`, `compteId`, `compteOutil` et l'état de rapprochement. Cette fonction
s'applique **aussi** au circuit électronique : de son paquet signé ne sortent, pour le public,
que le nom, la fonction et la date. `dossierInterne(pack)` / `originalInterneDe(acte)` composent
la part conservée, déposée avec la publication et servie par la seule route protégée
(§ 6.5).

**Ce que `src/` ne doit jamais contenir**, ici comme ailleurs : un mot de passe SMTP, un jeton de
production, une clé privée. Le script serveur de `index.html` est **public** — tout ce qu'on y
met est lisible par quiconque ouvre la page ou télécharge la source. Les `SMTP_*` vivent donc
dans le `.env` du service, et le script serveur embarqué (démonstration) n'en a aucun : il répond
`courriel_indisponible`, ce qui est le comportement attendu.

---

## 7. Exploitation

### 7.1 Commandes courantes

```bash
docker compose ps                  # état des trois services
docker compose logs -f api         # journal du service
docker compose restart api         # relance le service SANS relire le .env (les données sont en base)
docker compose up -d --force-recreate api   # recrée le service : applique un .env modifié
docker compose exec api node server.mjs --migrate   # appliquer schema.sql
```

Le schéma s'applique **sans rien effacer** (`schema.sql` est idempotent). Si l'écran de
connexion affiche `Table '…sb_record' doesn't exist`, la base répond mais n'a jamais reçu le
schéma — le cas d'un dossier de données initialisé **avant** que `schema.sql` n'y soit monté
(MariaDB ne rejoue ses scripts d'amorçage que sur un dossier vierge), ou d'une base externe
fournie nue. La commande ci-dessus le corrige, `AUTO_MIGRATE=true` aussi (le temps d'un
démarrage) ; `docker compose down -v`, lui, **efface** la base : il ne se justifie que si les
données peuvent être perdues. **Recréez ensuite le service** (`docker compose up -d
--force-recreate api`) : le compte d'administration du `.env` n'est créé qu'au démarrage — sans
cette recréation, la connexion répondra « aucun compte d'administration installé » alors que le
`.env` est correct. Attention : `docker compose restart` **relance le conteneur sans relire le
`.env`** ; seul `up -d` (qui recrée) applique un fichier modifié.

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
**Administration › Journal d'audit** (consultation et recherche plein texte, 300 dernières
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

> **Ce service n'est pas, non plus, un service d'archivage** : les bornes ci-dessus sont des
> **bornes d'exploitation courante**, pas des durées de conservation. Ce que la collectivité
> doit conserver au titre de l'archivage (et sous quel format d'archivage — paquet
> d'archivage, NF Z42-013) relève de sa politique d'archivage et se traite **en dehors** de
> Scribae : d'où l'export permanent des actes, de leurs originaux signés et du journal.

### 7.6 La démonstration publique n'est pas un service

La démonstration publique (<https://aplds.github.io/scribae>) est une **édition statique** :
la page est servie par **GitHub Pages**, sans aucun serveur applicatif. Les deux services que
l'application attend sont alors fournis **dans le navigateur** (`src/pages/host.js`) — un
stockage `IndexedDB`, et le service de signature et de publication **embarqué**, relu depuis
`index.html` et exécuté dans l'onglet. Trois choses, en particulier, y diffèrent d'un service :

1. **tout reste dans le navigateur du visiteur.** Rien n'est déposé chez un tiers, et rien
   n'est **partagé entre visiteurs** : le recueil public de la démonstration est celui de
   chacun, et les fonctions dites « partagées » du service ne le sont qu'entre les **onglets
   d'un même poste** (le libellé du mode le dit dans l'application). C'est ce qui rend la
   démonstration sûre à essayer — mais un **registre commun** y est impossible, et une
   collectivité qui produit des actes **réels** installe le service (§ 1) ou branche la base
   de son organisation (§ 5) ;
2. **ce qui y est conservé peut disparaître** : le stockage du navigateur peut être vidé
   (navigation privée, effacement des données du site), et l'état du service embarqué a une
   capacité **bornée**, le plus ancien étant **évincé** à mesure (`MAX_ACTES`, `MAX_PUBLIES`,
   `MAX_SIGNATURES` dans `index.html`). Une publication peut donc quitter le recueil par
   simple pression, sans intervention. **Ce n'est pas un mode de conservation**, et il n'y
   existe **ni sauvegarde ni restauration** (elles existent, elles, ci-dessus, § 8) ;
3. **il n'y a pas d'accès SMTP** : les notifications par courriel y sont constatées « non
   envoyées », avec leur motif.

La démonstration sert à essayer, à montrer et à former — jamais à conserver.

---

## 8. Sauvegardes et restauration

Trois choses à sauvegarder, et une à tester :

1. **La base** (référentiel, trames, actes, comptes, journal, état du service) — c'est
   l'essentiel. En mode **comptes locaux**, les tables `sb_motdepasse` (les dérivés) et
   `sb_session` (les sessions ouvertes) en font partie : un dump sans elles rendrait
   l'installation inaccessible. Dump logique :

   ```bash
   docker compose exec -T db mariadb-dump -u root -p"$DB_ROOT_PASSWORD" \
     --single-transaction --routines --triggers scriba | gzip > scriba-$(date +%F).sql.gz
   ```

   `--single-transaction` donne un instantané cohérent sans bloquer les écritures (InnoDB).
2. **Le fichier `.env`** (mots de passe, jetons) — conservé **hors** du dépôt et de la
   sauvegarde de la base, dans le coffre à secrets de la collectivité.
3. **Le référentiel exporté** (Administration › Données › Export) — ceinture et bretelles :
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
2. remplacer le dossier de l'application (le code) — dans un clone du dépôt : `git pull` ;
3. `docker compose up -d --build` ;
4. `docker compose exec api node server.mjs --migrate` si le schéma a changé ;
5. vérifier `/v1/db/health` et ouvrir l'application.

Les mises à jour **ne touchent pas** aux données : la synchronisation est incrémentale et les
migrations du référentiel (côté application) sont **additives** — un référentiel antérieur
reçoit les nouveautés sans perdre ses données.

Une exception, mécanique et sans perte : le champ **« signataire »** des trames anciennes est de
type `person` (une liste de noms) ; au premier démarrage, il devient de type **`signataire`** — la
fonction d'abord, puis les personnes qui la tiennent. Le champ garde la même valeur (l'identifiant
d'une personne) : seuls la façon de le renseigner et l'écran changent.

---

## 10. Migrer de la démonstration vers l'auto-hébergement

L'application de démonstration et l'installation auto-hébergée manipulent **le même modèle** :
la migration consiste donc à déplacer les données, pas à les convertir.

1. **Déployer** la pile auto-hébergée (`../server/README.md`) — elle peut tourner en parallèle
   sans gêner la démonstration.
2. **Récupérer les données** de la démonstration : soit un export du référentiel
   (Administration › Données › Export), soit, si la démonstration utilisait le mode partagé,
   *Récupérer depuis la base* depuis un poste ;
3. **Reporter le référentiel** dans l'installation de service : se connecter en
   administrateur, *Administration › Données › Import*, puis **Administration › Base de données ›
   Envoyer les données à la base** ;
4. **Régler chaque poste** sur le mode « Serveur externe » avec l'adresse du service et le
   jeton (ou, en auto-hébergement, l'adresse vide et le jeton injecté) ;
5. **Couper la démonstration** : décocher *Administration › Identité › Mention de démonstration*,
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
| « Aucun compte d'administration installé » **alors que** `ADMIN_LOGIN` et `ADMIN_PASSWORD` sont renseignés | le compte n'a pas pu être **créé** : soit la table des comptes n'existe pas (schéma non appliqué) — l'écran le dit comme une panne de base, remède compris —, soit le mot de passe **reçu par le service** ne respecte pas la politique (le journal donne le motif exact) | appliquer le schéma puis **recréer** le service (`docker compose up -d --force-recreate api`) ; l'amorçage n'a lieu qu'au démarrage |
| Une valeur refusée au démarrage (« RÉGLAGE DE SERVICE REFUSÉ », « REFUSÉE ») qui **ne correspond pas** au `.env` | le conteneur a gardé l'environnement de sa **création** : `docker compose restart` relance le même conteneur sans relire le `.env` | `docker compose config` (ce que compose calcule, `.env` compris), `docker compose exec api env \| grep SCRIBA_` (ce que le conteneur porte), puis `docker compose up -d --force-recreate api` |
| Message de conflit en enregistrant | un autre poste a modifié le même objet | la version de la base a été reprise ; ressaisir la modification |
| Écritures qui ne partent pas | jeton refusé (401/403) en mode à jeton | corriger le jeton dans le réglage du poste ; ces refus ne sont pas mis en file |
| Écritures refusées **alors que les lectures passent**, et pastille « base : erreur » à chaque geste | le poste se présente avec un **jeton** là où le service attend une **session** (mode « mot de passe ») : l'écriture part sans l'anti-CSRF, et le service la refuse (`csrf_invalide`). Cas d'un `.env` muet sur `AUTH_MODE` : le navigateur n'est alors prévenu de rien | `docker compose logs web` dit le mode annoncé (« mode : password » ou « mode : référentiel ») ; poser `AUTH_MODE=password` dans le `.env` puis **recréer** le service `web`. Une application à jour (**1.3.2** et au-delà) reprend d'elle-même le mode que le service annonce, sans ce réglage |
| Captures / guides sans images | ressources distantes bloquées | vérifier l'accès réseau aux images du guide |
| L'application ne charge pas (page inaccessible) | conteneur `web` arrêté, ou `src/` mal monté côté `web` | `docker compose ps` (les trois services doivent être *running*) et `docker compose logs web` ; `APP_DIR` doit désigner le dossier qui contient `src/` et `index.html`. Le service d'API, lui, peut être en refus de base sans empêcher la page de s'afficher |
| `Access denied for user 'scriba'@…` après avoir modifié le `.env` | le mot de passe **en base** est celui de la **création** du dossier de données : changer `DB_PASSWORD` ne le change pas après coup (voir § 7.1 et le § 9 de `../server/README.md`) | remettre l'ancien `DB_PASSWORD`, ou repartir d'un dossier de données vierge (`docker compose down -v && docker compose up -d`) si les données peuvent être perdues |
| Plus personne ne peut se connecter après avoir branché l'annuaire | fournisseur injoignable, ou adresse de retour refusée | ouvrir la **porte de secours** de l'écran de connexion (« L'annuaire est injoignable ? ») pour revenir aux comptes de l'application, puis corriger le réglage |
| « Découverte impossible » dans Administration › Annuaire | découverte bloquée (réseau, CORS) | saisir les points de terminaison à la main, et autoriser l'adresse de l'application chez le fournisseur |
| « Jeton d'identité refusé » à la connexion | émetteur, audience, horloge ou signature | lire l'encart de contrôle affiché après une connexion : il nomme le contrôle en échec |

---

## 12. Limites connues et feuille de route

- **Authentification** — trois modes : comptes de l'application (simulation, pour la
  démonstration), comptes locaux à mot de passe (§ 4.3 bis, réglé par le `.env` du service), ou
  annuaire de la collectivité en OpenID Connect (§ 4.4). En mode simulé, l'installation doit être
  protégée par le réseau ; en mode annuaire, le jeton d'API du service de données reste à rendre
  non public. Il reste à faire : réinitialisation du mot de passe par l'agent, second facteur
  (TOTP), journal des connexions, et purge planifiée des sessions.
- **Signature non qualifiée** — prestataire simulé (§ 6.6).
- **PDF/A certifié** — le PDF s'obtient par impression du HTML ; la chaîne PDF/A reste à
  valider (veraPDF).
- **Fusion par champ** — un conflit est résolu « la base gagne » ; une fusion par champ (par
  horodatage) serait plus juste pour les objets longs.
- **Journal lisible dans l'application** — le **journal d'audit de l'application** est
  consultable (Administration › Journal d'audit) ; c'est le journal **technique** `sb_journal`
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
