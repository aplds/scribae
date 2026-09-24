# Kit de reprise — par où commencer, et ce qui reste ouvert

Ce document s'adresse à qui **reprend le dépôt sans son auteur** : une équipe de
DSI, un prestataire, un agent qui devient mainteneur. Il ne remplace pas
`src/README.md` (l'architecture détaillée) ni `src/SPEC.md` (le comportement
attendu) : il dit **par où entrer**, **où vit chaque règle** (pour qu'on ne la
réécrive pas deux fois), **comment on vérifie** que rien n'a cassé, et **ce qui
n'est pas encore fait** — car un kit de reprise qui tairait ses trous ferait
perdre plus de temps qu'il n'en fait gagner.

> **Le principe du projet, en une phrase.** Scribae est un éditeur d'actes
> administratifs : on décrit une **trame** (un modèle d'arrêté, de délibération…),
> on la **remplit**, on fait passer l'acte par un **circuit de validation**, on le
> **signe**, puis on le **publie** — et le texte publié doit rester **vérifiable**
> des années plus tard. Tout le reste (recueil public, bulletin, contrôle de
> légalité, annuaire) en découle.

---

## 1. Les points d'entrée

| Où | Ce que c'est | Par où commencer la lecture |
|---|---|---|
| `main.pjs` | Le **manifeste** : métadonnées de la page et imports de la plateforme (« Perchance »). Presque vide — c'est voulu. | en entier (court) |
| `index.html` | La **coquille** : le script du service de démonstration (`<script type="text/x-server-plugin">`), le `<div id="app">`, et le module qui démarre l'application. | le bas du fichier (la ligne `import`) |
| `src/ui/app.js` | Le **routeur** de l'application : lit l'adresse, choisit l'écran, gère la session. | `render()` |
| `src/ui/views/` | Un fichier par **écran** (trames, rédaction, signature, recueil public…). | l'écran qui vous intéresse |
| `src/lib/store.js` | L'**amorçage** : pose les données de départ et les migrations additives, puis passe par `src/lib/db/` (jamais le stockage directement). | `demarrer()` |
| `src/lib/db/index.js` | La **façade de persistance** : trois pilotes (navigateur, service partagé, MySQL), différences, miroir hors ligne, file d'écritures différées. | l'en-tête, puis `sync` |
| `src/server/mysql/server.mjs` | Le **service auto-hébergé** (Node + son rangement — MariaDB, ou un dossier de fichiers) : routage HTTP, autorisation, magasin. | `handle()` |
| `src/server/mysql/actes.mjs` | Le **domaine** signature/publication, **pur** (sans Node, sans réseau, sans base) — c'est le cœur métier du service. | en-tête, puis `hPublier` |
| `src/pages/host.js` · `src/server/web/host.js` | Les **hôtes d'exécution** : ils fournissent le stockage et le canal du service hors de l'environnement d'édition. | en-tête |

**Deux modes de déploiement, un seul code d'application :**

- **édition statique** (GitHub Pages) : `src/pages/host.js` fournit un stockage
  IndexedDB et un service **simulé** (le script serveur de `index.html`) ;
- **auto-hébergement** (Docker) : `src/server/web/host.js` fournit le même
  stockage et fait passer les appels par HTTP vers l'API Node (`src/server/mysql/`).

L'application ne sait pas dans lequel des deux elle tourne : elle interroge
`src/lib/hosts.js`, et `src/lib/remote.js` choisit le transport.

---

## 2. Un seul point de vérité par règle

La reprise se joue surtout là : **une règle ne doit exister qu'une fois**. Les
fiches ci-dessous sont les endroits où chercher avant d'écrire quoi que ce soit.

| Règle | Fichier canonique | Qui l'utilise |
|---|---|---|
| **Part publique d'un original signé** (ce qui ne se diffuse pas) | `src/server/mysql/original-signe.mjs` | `src/lib/signature.js`, `src/server/mysql/actes.mjs` |
| **Qualification d'une signature** (« simple, non qualifiée » / « qualifiée ») | `src/lib/qualification-signature.js` | écrans, version publiée, JSON-LD, notice du recueil |
| **Effet d'une abrogation** (article, acte, annexe) | `src/lib/abrogation-annexes.js` · `src/lib/abrogations.js` | atelier de rédaction, application des abrogations |
| **Recueil public** : mentions du pied de page, renvois extérieurs, licence, fichiers ouverts | `src/lib/recueil.js` | vue du recueil, service auto-hébergé (via la publication) |
| **Variables de déploiement** (type, bornes, rôle, transport) | `src/server/mysql/variables.mjs` | validation du `.env`, `src/docs/VARIABLES.md` (engendré), `GET /v1/config` |
| **Description de l'API REST** | `src/lib/api-reference.js` | écran « API REST », `src/docs/API.md` (engendré), `src/server/mysql/actes.mjs` (OpenAPI) |
| **Migrations du schéma** | `src/server/mysql/migrations.mjs` + `schema.sql` (le socle) | `node server.mjs --migrate` |
| **Rangement des données** (collections, révisions, conflits, journal) | `src/server/mysql/magasin.mjs` (le contrat et l'algorithme) + `magasin-mysql.mjs` / `magasin-fichier.mjs` | `server.mjs`, `comptes.mjs`, `--migrate` / `--reconcilier` |
| **Chats des pages d'erreur** (quel code illustre quel code, l'adresse, le repli par classe) | `src/server/mysql/chats-erreur.mjs` | `actes.mjs` (recueil), `src/lib/chats-erreur.js` (le poste), `src/ui/chats-erreur.js` (le rendu) |

Deux règles sont **tolérées en double**, pour une raison d'exécution, et
**tenues par un test** plutôt que par la discipline :

- le service de **démonstration** (`index.html`) ne peut pas importer de modules :
  il garde sa copie de `sansInterne` et de son empreinte SHA-256. Le test
  `tests/original-signe.test.mjs` extrait ces fonctions du fichier et les
  compare au module et à `node:crypto` — la duplication ne peut pas dériver en
  silence (audit, NC-I-004) ;
- l'empreinte SHA-256 existe en trois variantes **pour trois environnements**
  (WebCrypto dans le navigateur, `node:crypto` dans le service, implémentation
  pure en JavaScript dans le service de démonstration, qui n'a ni l'une ni
  l'autre). Ce ne sont pas trois règles, mais trois moyens.

---

## 3. Vérifier avant de livrer

Aucune dépendance n'est nécessaire pour le premier travail : **Node ≥ 20** suffit.

```sh
npm run lint        # syntaxe de tout le JavaScript du dépôt
npm test            # épreuves des modules purs + domaines du service
npm run verifier    # les deux, dans l'ordre  ← c'est ce que la CI exécute
```

À quoi s'ajoutent deux vérifications qui demandent un **navigateur** (l'aperçu de
l'éditeur, ou un poste) :

- **les épreuves de parcours** — le trajet réel dépôt → signature → publication →
  recueil, et le contrat du service, exécutés **contre le service vivant** :
  `tests/parcours.mjs` (`lancerParcours`), et `tests/conformite-service.mjs`
  (le jeu d'appels commun aux **deux** implémentations du service) ;
- **l'apparence** — les écrans sensibles (recueil public, atelier) se relisent à
  l'écran, en mobile comme en grand.

> **Le piège à connaître.** L'édition en ligne recharge la page **à chaque
> modification** : une durée de vie d'état qui semblait stable peut se perdre. Les
> épreuves de parcours attendent explicitement ce qu'elles observent au lieu de
> supposer qu'un rendu est terminé. Voir `src/docs/INDUSTRIALISATION.md` (§ les
> parcours) pour la marche à suivre.

---

## 4. Livrer

### 4.1. Le dépôt GitHub (édition statique)

Le dépôt est servi **tel quel** : rien n'est compilé. L'outillage est rangé **à sa place attendue** — à la racine — et le code de
l'application sous `src/`. L'export range chaque source à sa place et ne la
recopie pas dans `src/` (une table complète, et la recette, sont dans
`src/README.md` § « Exporter le dépôt GitHub ») :

| Élément | À la racine du dépôt |
|---|---|
| `src/docs/GITHUB.md` | `README.md` |
| `src/package.json` | `package.json` |
| `src/github/ci.yml` | `.github/workflows/ci.yml` |
| `src/github/gitignore` | `.gitignore` |
| `src/scripts/**`, `src/tests/**` | `scripts/**`, `tests/**` |
| `src/AGENTS.md`, `src/CLAUDE.md` | `AGENTS.md`, `CLAUDE.md` |

Le site publié a besoin, à la racine, de `index.html`, `main.pjs`, `src/**`, et
d'un `.nojekyll` (pour que GitHub Pages serve `src/` sans transformation). Le
domaine se règle par un fichier `CNAME`.

### 4.2. L'auto-hébergement (Docker)

```sh
cd src/server
cp env.example .env      # renseignez les mots de passe et les jetons
docker compose up -d --build
```

Quatre services : `db` (MariaDB), `db-init` (le compte applicatif au mot de passe
du `.env`, puis le schéma), `api` (Node), `web` (nginx). **Aucun fichier de
l'hôte n'est monté** : tout est cuit dans les images, par choix (voir
`src/server/docker-compose.yml`, en-tête). Le détail est dans
`src/docs/ADMINISTRATION.md` et `src/server/README.md`.

Points à ne pas manquer à la mise en service :

- **`AUTH_MODE`** : par défaut `password` (comptes locaux, session par cookie).
  `demo` sert aux essais et **ne protège rien** ;
- **le jeton d'écriture n'est pas servi au navigateur** en mode session : la
  façade le retire de `config.js`, et `web/host.js` refuse de le lire ;
- **TLS** : la pile s'arrête à HTTP. Le reverse-proxy TLS est à la charge de
  l'exploitant (et `COOKIE_SECURE=true` l'exige en production).

---

## 5. Ce qui n'est pas couvert (à lire avant de promettre)

Ces points sont **connus, écrits et suivis** — ils ne doivent pas surprendre en
cours de reprise. Le registre complet est `src/audit/REGISTRE-NON-CONFORMITES.md`,
et les chantiers `src/TODO.md`.

1. **La signature n'a pas de valeur probante pleine** (NC-IV-001). Le certificat
   est engendré dans le navigateur, la clé privée y reste, et la vérification
   prouve l'**intégrité**, pas l'**identité** du signataire. Brancher une chaîne
   qualifiée (eIDAS) ou un cachet serveur est un chantier à part entière.
2. **La télétransmission au contrôle de légalité est simulée** (NC-IV-004) : le
   certificat produit le dit désormais explicitement, mais aucun appel réel
   n'a lieu.
3. **Le service de démonstration n'est pas conservatoire** (NC-II-012) : son état
   durable s'évince par ancienneté, et il n'a ni sauvegarde ni restauration. La
   conservation, c'est l'auto-hébergement.
4. **La reprise par un tiers reste freinée par la taille** de quelques fichiers
   (NC-I-003) : la documentation et les gros modules de vue sont progressivement
   découpés, mais le travail n'est pas terminé.
5. **L'analyse statique reste volontairement pauvre** (NC-I-002) : la syntaxe et
   quelques règles de style, rien de plus — pas de vérificateur de types.
6. **Le service parle le même contrat en deux endroits** (NC-I-010) : la
   démonstration et l'auto-hébergement. Le jeu d'appels de
   `tests/conformite-service.mjs` est ce qui les empêche de diverger ; toute
   route ajoutée d'un côté doit être ajoutée à ce jeu.
7. **TLS, sauvegarde planifiée, sonde de supervision et migrations versionnées**
   sont décrits dans `src/TODO.md` § auto-hébergement — les migrations sont
   désormais versionnées, le reste reste à faire.
