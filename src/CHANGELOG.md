# Journal des versions

Historique des versions livrées de **Scribae** (éditeur de trames et d'actes
administratifs). Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
numéros `MAJEUR.MINEUR.CORRECTIF` ([semver](https://semver.org/lang/fr/)).

## Comment ce fichier fonctionne

- **Une version n'existe qu'une fois figée**, c'est-à-dire déposée sur GitHub. On
  incrémente le numéro et on ouvre l'entrée datée **au moment de livrer**, pas avant.
- **Entre deux livraisons GitHub**, chaque correction achevée reçoit une **note de
  version intermédiaire** : le correctif du moment, suivi d'une **lettre** — `1.3.1a`,
  `1.3.1b`, … — et datée. Ce ne sont pas des publications : elles ne touchent pas
  `APP_VERSION`, et la livraison GitHub suivante les reprend sous sa propre entrée,
  sans les lettres.
- Le travail en cours se décrit sous **Non publié** tant qu'il n'a pas reçu sa note
  intermédiaire ; cette section est vide le reste du temps.
- Le numéro courant est celui de `APP_VERSION` dans `src/lib/version.js` — c'est la
  source unique du numéro. **La première entrée datée SANS lettre de ce fichier doit
  lui correspondre** ; en cas de divergence, c'est ce fichier qui dit la vérité. Les
  entrées intermédiaires, plus récentes, viennent au-dessus d'elle.
- Rubriques : `Ajouté`, `Modifié`, `Corrigé`, `Retiré`, `Sécurité`. Une entrée ne
  garde que les rubriques qu'elle utilise.
- On décrit le **changement visible** (ce que l'utilisateur constate, ou ce que
  l'exploitant doit savoir), pas la liste des fichiers touchés.

## [Non publié]

Rien pour l'instant : le travail achevé reçoit une note intermédiaire (voir ci-dessous).


## [1.6.1b] — 2026-09-23 — La démonstration a son adresse, et l'éditeur sa mention

Deux choses au même moment : la démonstration publiée passe sous son **propre nom de domaine**, et
le logiciel dit **d'où il vient**.

**demo.scribae.eu.** La démonstration servie en statique par GitHub Pages répond désormais à
**<https://demo.scribae.eu>**, et le dépôt **fixe cette adresse** : un fichier `CNAME` à la racine
(livré avec l'export) porte le nom. C'est le seul réglage que la persistance de la démonstration
demande — et il tient à une règle du navigateur, pas du logiciel : **le stockage est attaché à
l'adresse du site**. Une démonstration servie sous deux adresses (le domaine et l'adresse
`*.github.io`) constitue donc **deux installations distinctes** — deux référentiels, deux recueils,
et un visiteur qui change d'adresse ne retrouve pas son travail. Une seule adresse publiée, donc, et
c'est celle-là qu'on communique ; la démonstration garde ensuite ce qu'on y fait d'une visite à
l'autre, tant que l'on revient par la même. Un fork, lui, doit remplacer ce `CNAME` ou le supprimer.

**« Propulsé par Scribae — GPLv3 ».** Les **trois pieds de page** de l'application — le recueil
public, l'atelier et l'écran de connexion — portent la mention de l'éditeur du logiciel, le nom
renvoyant à sa **documentation**. Scribae est un logiciel libre, publié sous licence GPL-3.0 : la
mention dit d'où vient l'outil. Elle se règle, et s'éteint : une collectivité a sa charte, et le
recueil peut être intégré dans un portail qui porte déjà sa propre signature.

### Ajouté

- **La mention de l'éditeur du logiciel, dans les trois pieds de page.** Elle est écrite **une seule
  fois** (`src/ui/mention.js`) et lue par le recueil public (`pied`, `src/ui/views/recueil-public.js`),
  l'atelier (la coquille, `src/ui/app.js`) et l'écran de connexion (`src/ui/views/connexion.js`) :
  les trois ne peuvent donc pas diverger. Elle est **discrète** — petit texte, ton effacé, lien
  souligné vers <https://doc.scribae.eu> —, et s'efface quand l'écran occupe toute la hauteur
  (l'éditeur de trame, `.app--plein`) : la feuille ne partage pas sa place.
- **Le réglage, dans le référentiel** — Administration › Identité, carte « Mention de l'éditeur du
  logiciel » : **afficher** ou **masquer**, la mention étant affichée tant qu'on n'y a pas touché
  (`config.brand.mentionScribae`). Le geste se voit **sur-le-champ**, sans recharger : le pied de
  l'atelier appartient à la coquille, que le redessin d'une vue ne reconstruit pas.
- **Le `CNAME` de la démonstration** — `demo.scribae.eu`, une ligne, à la racine du dépôt. Sa
  recette est écrite dans `src/README.md` (« Exporter le dépôt GitHub »), avec ce qu'il implique :
  une adresse publiée, et une seule.

### Modifié

- **L'adresse de la démonstration, partout où elle est écrite** — `src/README.md`,
  `src/docs/GITHUB.md` (le `README.md` du dépôt) et `src/docs/ADMINISTRATION.md` (§ 7.6) passent de
  l'adresse `*.github.io` du dépôt à **<https://demo.scribae.eu>**.
- **Ce que la démonstration conserve, et sous quelle adresse** — c'est dit là où un visiteur le lit
  (l'encart de `docs/GITHUB.md`), et là où l'exploitant le cherche (`docs/ADMINISTRATION.md` § 7.6,
  « L'adresse décide du stockage ») : le stockage d'un navigateur est attaché à l'**origine** du
  site, donc à son adresse.
- **L'installation par pages, chez un tiers** (`docs/GITHUB.md`) : le pas à pas des pages GitHub
  gagne le **nom de domaine** (enregistrement DNS, *Enforce HTTPS* — l'application signe dans le
  navigateur, ce qui l'exige) et l'avertissement sur le `CNAME` du dépôt, qu'un fork doit changer.
- **Le guide, côté recueil public** (`src/wiki.js`, chapitre « Publier l'acte ») : une note explique
  la mention et son réglage, à la suite de celle des mentions du bas de page.

## [1.6.1a] — 2026-09-23 — Le service démarre : le courriel ne l'arrête plus

La 1.6.0 ne **démarrait pas** en auto-hébergement. Le service appliquait bien le schéma, joignait bien
la base, annonçait son état — puis **s'arrêtait aussitôt** :

```
ReferenceError: etatCourriel is not defined
    at main (file:///app/server.mjs:1857:15)
```

`docker compose` le relançait, et la boucle recommençait (« api-1 exited with code 1 (restarting) »).
La faute était à la **dernière ligne du démarrage** : l'affichage de l'état du **courriel** — ajouté
avec le bulletin, dont les numéros partent par courriel — lisait `etatCourriel` alors que l'état
n'était jamais demandé au module. Il l'est maintenant, exactement comme celui du prestataire de
signature imprimé juste en dessous. La ligne s'affiche, et le service reste debout.

### Corrigé

- **Le service auto-hébergé démarre de nouveau** (`src/server/mysql/server.mjs`) : l'état du courriel
  est lu une fois (`courriel.etat()`) avant d'être imprimé — « notifications actives », avec l'hôte,
  le port, le chiffrement et l'expéditeur, ou le **motif** de l'inactivité (SMTP absent, adresse
  d'expédition absente, envoi éteint). Aucune variable d'environnement ne change, aucun réglage n'est
  à reprendre : la 1.6.0 se répare par la seule mise à jour de l'image.
- **Trois défauts du même genre, dans l'interface.** Le champ **Texte** d'un visa (inspecteur du bloc
  « Visas », mode « Je tape le texte moi-même ») appelait le rafraîchissement du papier sans lui
  transmettre le contexte de l'éditeur : la saisie échouait. Ce choix de mode restait par ailleurs
  **sans effet** sur un visa neuf — aucun champ ne s'ouvrait, faute d'un champ renseigné pour dire le
  mode : le champ « Texte » s'affiche maintenant dès qu'aucun autre mode n'est renseigné. Enfin, le
  panneau **« Recueil ouvert »** d'un acte publié, sur un déploiement auto-hébergé, citait
  `hrefFichier` sans l'avoir importé : la liste des fichiers n'apparaissait pas. Les trois sont
  réparés.

## [1.6.0] — 2026-09-22 — Le bulletin des actes : le recueil devient un Journal officiel

Le recueil publie **au fil de l'eau** : un acte paraît, il a son adresse, il est là. C'est ce qu'il
faut pour retrouver un acte précis — mais ce n'est pas ainsi qu'une collectivité **communique**. Un
arrêté qui entre en vigueur « à la parution » se cite par le **numéro** qui l'a porté, un conseil
municipal a sa **séance**, un marché son **mois**. Bref : à côté du fil, il manquait le
**rendez-vous**.

Scribae tient maintenant ce rendez-vous. La collectivité **ouvre un bulletin** (ou un Journal
officiel, ou un bulletin officiel — le nom est le sien), lui donne une **cadence** et un **jour de
parution**, et le service fait le reste : il clôt chaque période échue, **rassemble les actes
publiés** sur cette période, les classe **par entité puis par thématique**, leur donne un **numéro**,
et le diffuse — une **sous-page du recueil** par numéro, un **flux RSS et Atom**, et un **courriel
aux abonnés**.

Deux principes ont commandé la conception. **Une période sans acte ne donne aucun bulletin** : il n'y
a pas de numéro vide, et la numérotation suit les numéros **parus** — une collectivité silencieuse
en août ne laisse pas un trou dans sa collection. Et **rien ne se fait à la main** : la passe du
service clôt, compose et expédie toute seule, au démarrage puis toutes les dix minutes, de sorte
qu'un service arrêté une semaine rattrape son retard sans que personne ne clique.

### Ajouté

- **Le bulletin (ou Journal) des actes.** *Administration › Bulletin* (permission `bulletin.gerer`,
  rôles administrateur et éditeur) : ouverture du bulletin, **cadence** — quotidienne,
  hebdomadaire, **bimensuelle** (1er→15 puis 16→fin de mois), mensuelle, bimestrielle,
  trimestrielle, semestrielle, annuelle, ou **personnalisée** (« toutes les N unités », ancrée sur
  une date) —, **jour de parution**, titre, titre des numéros, sous-titre, en-tête et pied des
  courriels, expéditeur et adresse de réponse. Une cadence **illisible retombe sur « mensuelle »**
  plutôt que d'arrêter le service.
- **Le moteur du bulletin, au service** — `src/server/mysql/bulletins.mjs` (écrit sans dépendance à
  Node : `sha256` et l'horloge lui sont injectés) : périodes et cadences, composition des numéros
  (classement **par entité puis par thématique** , avec « (sans entité) » en dernier), consolidation
  (un acte publié deux fois n'y figure qu'une fois), mise en service **bornée** (la plus ancienne
  publication détenue, mais pas au-delà de soixante périodes, pour qu'un recueil de dix ans ne fasse
  pas paraître cent numéros d'un coup), élagage, abonnés, file d'envoi. **44 épreuves** le couvrent
  (`bulletins.test.mjs`, `actes-bulletins.test.mjs`).
- **Les pages publiques du bulletin, sans JavaScript** — `/recueil/bulletins` (les numéros parus, et
  l'abonnement), `/recueil/bulletins/<période>` (un numéro, dans son classement), ses représentations
  **`.json`**, **`.md`** et **`.txt`** — le même jeu de formats que les actes —, et les **flux**
  `/recueil/bulletins.rss` et `/recueil/bulletins.atom`. Le **sommaire** du recueil annonce la
  cadence et la **prochaine parution** ; l'accueil affiche les derniers numéros ; le pied de page y
  renvoie.
- **L'abonnement par courriel, à double consentement.** L'inscription demande l'adresse, puis le
  lien d'un **courriel de confirmation** : sans ce second geste, aucune inscription n'a lieu. Chaque
  numéro porte un lien de **désabonnement** en un clic, que l'administration peut aussi faire à la
  place de l'intéressé. L'**en-tête et le pied** des messages viennent du référentiel, et le service
  **tient la file d'envoi** : par petits paquets (quarante par passe par défaut), avec trois
  tentatives étalées pour une livraison refusée, et le motif au journal quand elle échoue.
- **Le flux RSS 2.0 et Atom 1.0** des numéros parus, XML **échappé** (un objet contenant « & » ou
  « < » ne casse pas le fil), borné à vingt entrées, chacune portant le numéro, sa période, son
  résumé et son contenu.
- **Les variables du déploiement** — `SCRIBA_BULLETIN_ACTIF`, `_TITRE`, `_TITRE_BULLETIN`,
  `_SOUS_TITRE`, `_CADENCE`, `_PARUTION_JOURS` (référentiel) et `SCRIBA_PUBLIQUE_URL`,
  `SCRIBA_BULLETIN_MAX`, `_MAX_ABONNES`, `_ENVOIS_PASSE`, `_INTERVALLE_MIN` (service) : une
  installation peut ouvrir et régler son bulletin **sans passer par l'interface**. `VARIABLES.md`
  (113 variables) et `env.example` les documentent.
- **Les adresses du service dans la référence d'API** (`docs/API.md`) : le groupe **Bulletin des
  actes** (état public, un numéro, abonnement, confirmation, désabonnement) et ses codes d'erreur.

### Modifié

- **La démonstration ouvre son bulletin.** La fiction de Valmont-sur-Loire paraît un numéro par mois
  (le 5), et la démonstration **compose ses numéros échus au démarrage**, par le même geste que
  l'écran d'administration : une fonction qui se découvre doit se **voir**. Le service de
  démonstration n'ayant pas de serveur SMTP, l'abonnement y reste **fermé** — et la page publique
  dit **pourquoi**, au lieu de laisser un formulaire échouer.
- **La copie de l'état public est oubliée dès qu'un réglage la périme.** Un réglage du bulletin ou
  un geste d'administration invalide l'état que le recueil garde en mémoire (cadence, numéros
  parus, flux), et le **flux** — adresse machine — relit l'état frais avant de se composer : une
  page publique ouverte pendant qu'on ouvre le bulletin ne continue plus d'afficher un recueil sans
  bulletin.
- **`docs/ADMINISTRATION.md`** porte un § « Le bulletin (ou Journal) des actes » : les cadences et
  leurs périodes, le jour de parution, ce que voit le public, l'abonnement et les **données
  personnelles** qu'il suppose, ce qu'il faut au service pour envoyer (SMTP **et** adresse publique),
  et comment l'éprouver en quatre vérifications.

### Corrigé

- **Le flux RSS n'était pas refermé.** Le `<channel>` du flux du service s'ouvrait sans que
  `</channel>` le ferme : le document n'était pas du XML valide, et un lecteur de flux le rejetait en
  bloc — sans que rien ne le dise ici, puisque toutes les balises ouvrantes s'y trouvaient. Les
  épreuves du flux vérifient désormais la **fermeture** du document (RSS et Atom), pas seulement son
  ouverture.
- **L'écran du bulletin interrogeait le service sans jeton.** La lecture du tableau de bord et les
  gestes d'administration partaient sans clé d'écriture : le service répondait `401`, et l'écran
  restait vide alors que tout fonctionnait. Le jeton est joint dès que le poste en détient un (et
  omis quand une **session** ouvre le droit, cette identité voyageant dans le cookie).
- **Le lien de la page publique, dans le flux Atom**, porte son rôle (`rel="alternate"`, type
  `text/html`) au lieu de le laisser deviner.

### Sécurité

- **Rien du bulletin n'expose les abonnés.** Les adresses publiques ne disent jamais **qui** est
  inscrit : elles ne rendent ni la liste, ni le nombre, et une adresse **déjà confirmée** reçoit
  simplement un nouveau courriel de confirmation — jamais un « vous êtes déjà inscrit ». Les jetons
  de confirmation et de désabonnement sont **dérivés d'un secret tiré au hasard** (SHA-256) et ne
  portent aucune donnée ; un jeton inconnu ne répond que « invalide ».
- **Le désabonnement demande deux gestes.** Un courriel ne se désabonne pas du seul fait d'être
  **ouvert** ou scanné : le lien montre une page, et c'est un second clic qui retire l'inscription.
- **Le service ne conserve que le nécessaire** : l'adresse, le nom **facultatif**, les dates et
  l'état (en attente, confirmé, retiré). Les fiches retirées sont élaguées les premières, et le
  retrait d'un abonné est réservé à l'administrateur.

## [1.5.4a] — 2026-09-22 — Le service ne gèle plus quand les agents arrivent ensemble

Une collectivité qui compte une vingtaine d'agents remarque la même chose chaque matin : à l'heure
où tout le monde se connecte, **l'application entière se fige quelques secondes**. Pas seulement
les connexions — les fiches déjà ouvertes, la recherche, et jusqu'au **recueil public**, consulté
par des visiteurs qui n'ont aucun mot de passe à faire vérifier. Un visiteur sur cent attendait
deux secondes et demie, et le maximum mesuré atteignait **2 628 ms** pour tout le monde.

La cause n'était ni la base, ni le volume des actes, ni le réseau : le service vérifiait les mots de
passe avec **`scryptSync`**, un calcul qui s'exécute **sur le fil principal** — celui qui sert toutes
les requêtes. Chaque dérivation immobilisait donc le service entier pendant environ 130 ms
(`SCRYPT_N=65536`), et vingt et un agents se connectant dans la même seconde additionnaient leurs
calculs en série : 21 × 130 ms ≈ 2,7 s de gel **global**.

La vérification des mots de passe n'a pas changé de nature : seul son **exécution** ne bloque plus
personne.

### Corrigé

- **Le dérivé de mot de passe ne bloque plus le service.** `src/server/mysql/server.mjs` emploie
  `scrypt` **asynchrone** (pool de fils de Node) à la place de `scryptSync`. Le format des dérivés
  est inchangé : **aucun mot de passe n'a été réécrit, aucune base n'a besoin d'être touchée**. Mesuré
  sur la même charge (60 postes, 21 connexions simultanées, 60 s) : le p99 du recueil public passe de
  **2 616 ms à 15 ms**, et le temps de connexion du pire agent de 2 619 ms à 665 ms.
- **Le domaine des comptes attend le dérivé sans présumer de sa forme.**
  `scellerMotDePasse` / `verifierMotDePasse` (`src/server/mysql/comptes.mjs`) deviennent asynchrones
  et attendent le résultat : un port de cryptographie synchrone continue de fonctionner, un port
  asynchrone aussi. Le **dérivé factice** (celui qui donne à une tentative sur un identifiant inconnu
  le même coût qu'une tentative réelle) est désormais **engagé au démarrage** du service — le calcul
  se fait pendant l'installation, et le coût d'une vérification à vide reste identique.

### Ajouté

- **Un outil d'étude de charge** — `src/server/charge/` (`node src/server/charge/charge.mjs`) : des
  postes simulés à **tous les rôles** plus le public du recueil, des sessions réelles, l'anti-CSRF,
  une cible semée par l'API (actes, trames, informations, publications ELI), et un rapport qui classe
  les gestes du pire au meilleur (p50, p95, p99, max), avec le **nombre d'ordres SQL** adressés à la
  base. Il sait éprouver un déploiement existant (`--url`) comme lancer le service sur place avec une
  base en mémoire (`--sans-base`), et simuler une base distante (`--latence`).
- **Le compte rendu des mesures** — `src/docs/PERFORMANCE.md` : dix scénarios (affluence, matinée
  étalée, saturation, écriture, base distante), les chiffres avant et après, et ce qui reste ouvert.

### Modifié

- **`UV_THREADPOOL_SIZE` rejoint le `.env` et le `docker-compose.yml`.** C'est le réglage qui décide
  combien de dérivés avancent en même temps ; les 4 fils par défaut de Node suffisent à une arrivée
  étalée, mais une collectivité où beaucoup d'agents se connectent à la même minute gagnera à le
  porter à 8 ou 16. Il est lu au lancement du processus — voir `src/docs/ADMINISTRATION.md` § 7.5 bis.

### Sécurité

- **Rien n'a été affaibli.** Le coût du dérivé (`SCRYPT_N`), le sel par compte, la comparaison à
  temps constant, le même message pour un identifiant inconnu et le blocage après échecs sont
  inchangés — le dérivé factice continue d'être vérifié pour chaque tentative sur un compte
  inexistant, au même coût.

## [1.5.3d] — 2026-09-22 — Le schéma suit le compte, et le service se rétablit

Réparer le compte de la base ne suffisait pas. Le service continuait d'afficher

```
Base de données indisponible
Access denied for user 'scriba'@'172.19.0.3' (using password: YES)
```

et, au premier essai de connexion, il répondait

```
Table 'scriba.sb_record' doesn't exist
```

Ce sont **deux** pannes, et il fallait les deux gestes pour en sortir. Le service `db-init` alignait
le **compte** mais n'appliquait jamais le **schéma** : une base dont le compte vient d'être réparé
reste sans tables, puisque la migration ne court qu'au démarrage du service — et celle de ce
démarrage-là avait échoué avant la réparation. L'état du déploiement, lui, était un **verdict de
démarrage** : le bandeau « base indisponible » ne se rejouait jamais, ni pour confirmer une
réparation, ni pour signaler le schéma manquant. Le geste que ce bandeau conseillait (« `docker
compose run --rm db-init` ») réparait donc le compte en laissant la base inutilisable — et le
bandeau à l'écran.

### Ajouté

- **`db-init` applique le schéma après avoir aligné le compte.** `node server.mjs --reconcilier`
  remet le compte applicatif au mot de passe du `.env`, **puis** applique `schema.sql` avec ce compte
  tout neuf. Les deux pannes vont en effet de pair — une réparation qui s'arrête au compte laisse
  `Table 'scriba.sb_record' doesn't exist` au premier écran — et `schema.sql` ne contient que des
  `CREATE TABLE IF NOT EXISTS` et des vues : le geste ne **détruit** rien, même sur une base en
  service. Un seul `docker compose run --rm db-init` suffit désormais à remettre une base d'aplomb.
- **Le service rééprouve la base à la demande, et se rétablit sans être recréé.** Quand l'état dit
  que la base est en panne, `GET /v1/auth/config` — le seul appel que fait l'écran de connexion —
  déclenche, au plus une fois toutes les cinq secondes : l'application du schéma si `AUTO_MIGRATE`,
  une épreuve de santé, le réamorçage du compte d'administration s'il avait échoué **faute de base**,
  et le rechargement de l'état. Une panne réparée pendant que le service tourne n'exige donc plus de
  le recréer. L'écran de connexion, de son côté, redemande cet état après un essai refusé : le bandeau
  se corrige sans recharger la page.
- **`standalone-entrypoint.sh` fait les deux mêmes gestes au démarrage** de l'image autonome, quand
  `DB_ROOT_PASSWORD` lui est fourni (le mot de passe root n'est lu que là, et le conteneur ne touche à
  rien sans lui). C'est le pendant de `db-init` pour qui n'utilise pas Compose.

### Corrigé

- **L'état de signature et de publication ne peut plus être effacé par accident.** Un service qui a
  démarré sans pouvoir lire son état garde, en mémoire, un état **vide** : l'écrire aurait remplacé
  celui de la base — la pire perte possible, parce que silencieuse. Ces écritures répondent désormais
  `503 etat_degrade` jusqu'à ce que la base revienne, instant où le service recharge son état
  lui-même.
- **Une requête qui échoue sur la base est notée comme un changement d'état du déploiement** (table
  absente, identifiants refusés) : le bandeau de l'écran de connexion porte alors le remède juste, et
  la réépreuve décrite plus haut a lieu au chargement suivant.
- **Le remède affiché pour des tables absentes** dit le geste unique — `docker compose run --rm
  db-init`, qui répare compte **et** schéma — au lieu d'une migration suivie d'une recréation du
  conteneur. `README.md` (pile et service), `ADMINISTRATION.md`, `DOCKER.md`, `env.example` et le
  wiki des variables disent la même chose : le compte **et** le schéma suivent le `.env`, le service
  se rétablit seul, et seul le mot de passe **root** reste figé à la création du dossier de données.

## [1.5.3c] — 2026-09-22 — Le compte de la base suit le `.env`

Toute installation dont le mot de passe de base avait changé depuis le premier démarrage se heurtait
à une porte fermée, sans que rien ne dise pourquoi :

```
Access denied for user 'scriba'@'172.19.0.3' (using password: YES)
```

Ce n'était ni le compte d'administration, ni le `.env` : MariaDB ne crée le compte applicatif qu'au
**premier** démarrage d'un dossier de données **vierge**, et jamais ensuite. Changer `DB_PASSWORD`
ne changeait donc rien en base, et le service — qui, lui, lisait bien le `.env` — se voyait refuser
l'accès. La pile **repose** désormais ce mot de passe à chaque démarrage : c'est le `.env` qui fait
foi, comme pour les réglages déclaratifs.

### Ajouté

- **Le compte applicatif est aligné sur le `.env` à chaque démarrage** (service `db-init`, avant le
  service). Il ne touche à **aucune** donnée : ni table, ni contenu — il crée la base et le compte
  s'ils manquent, leur donne le mot de passe et les droits du `.env`, et s'arrête. C'est le seul
  moment où le service parle à la base en **root** (`DB_ROOT_PASSWORD`) ; s'il n'y parvient pas
  (mot de passe root périmé, base externe), il le **dit** dans son journal et ne bloque rien.
  À la main : `docker compose run --rm db-init`, ou `node server.mjs --reconcilier`.
- **`server/mysql/compte-base.mjs`** : les ordres SQL qui font cet alignement, à part et **purs** —
  donc éprouvés sans base (`compte-base.test.mjs`), apostrophes, barres obliques inverses et
  identifiants compris : un mot de passe contenant « `'; DROP DATABASE …` » reste une valeur, jamais
  une commande.

### Modifié

- **Le remède affiché par l'application** (et le journal du service) pour un refus de la base dit
  désormais le geste juste : aligner le compte sur le `.env` — et non chercher l'ancien mot de passe
  dans l'environnement du conteneur. `docker compose down -v` reste le **dernier** recours, pour le
  seul cas où le mot de passe root lui-même est perdu.
- **`DB_HOST` et `DB_PORT` du `.env` sont honorés par la pile** : brancher une base hors du compose
  (README § 5) fonctionne maintenant comme le document le décrit — le service du compose les
  imposait auparavant, et la variable du `.env` restait sans effet.
- Le tableau « Dépannage » (README de la pile, ADMINISTRATION, DOCKER), `env.example` et le wiki des
  variables disent ce que fait `db-init`, et que `DB_PASSWORD` se change **dans le `.env`**.

## [1.5.3b] — 2026-09-22 — La façade se construit, au lieu de se monter

La pile `docker compose` refusait de démarrer sur certaines machines : le conteneur `web` restait
en boucle sur

```
find: /docker-entrypoint.d/40-scriba-web.sh: Permission denied
[emerg] open() "/etc/nginx/conf.d/default.conf" failed (13: Permission denied)
```

Ce n'est pas un droit du fichier qu'on corrigerait quelque part : **`stat` lui-même est refusé**
(le script d'amorçage de l'image ne voit même pas que le fichier existe), et `root` dans le
conteneur n'y peut rien — la machine (étiquette SELinux ou AppArmor, système de fichiers réseau,
partage de machine virtuelle, espace de noms d'utilisateurs) **interdit au conteneur de lire ce que
l'hôte lui monte**. La pile ne monte donc plus aucun fichier de l'hôte : la façade et le code
entrent dans une image **construite**, comme le service.

### Modifié

- **La façade est une image construite** (`server/web/Dockerfile`, sur `nginx:alpine`) : les
  réglages d'nginx, le script d'amorçage, la coquille et le **code de l'application** y entrent,
  avec leurs droits. Rien du dossier de l'hôte n'est monté : le démarrage ne dépend plus ni des
  droits des fichiers, ni du système de fichiers, ni de l'étiquette de sécurité de la machine qui
  héberge. Après une mise à jour du code, `docker compose up -d --build` reconstruit la façade
  (`src/server/README.md` § 8) ; son § 9 bis dit comment remonter le code le temps d'un correctif.
- **Le schéma n'est plus monté dans MariaDB : c'est le service qui l'applique** (`AUTO_MIGRATE=true`
  par défaut dans la pile). MariaDB ne rejoue ses scripts d'amorçage que sur un dossier de données
  **vierge** : un dossier déjà initialisé gardait une base sans tables, et rien ne le disait.
  `schema.sql` ne contient que des `CREATE TABLE IF NOT EXISTS` et des vues — l'appliquer à chaque
  démarrage ne touche pas aux données. Une base externe reçoit le schéma de la même façon.
- **Les droits sont rétablis dans l'image** (`chmod a+rX` sur le code et les modèles, dans les deux
  façons de déployer) : une arborescence arrivée en 0700 — une archive décompressée, un dépôt cloné
  sous un umask sévère — ne peut plus donner des 403 dans le navigateur, le processus de travail de
  nginx n'étant pas root.
- `APP_DIR` n'est plus nécessaire à la pile : le dépôt sert de **contexte de construction**. La
  variable reste documentée pour qui veut monter le code à la main.

### Corrigé

- **Le conteneur `web` démarre là où les montages sont refusés**, et les deux façons de déployer
  (pile Compose et image autonome) suivent désormais la même règle : le conteneur ne lit rien de
  l'hôte. `src/docs/DOCKER.md` § 9 bis explique la panne, sa cause et le remède (`:z`) pour qui
  tient à un montage.

## [1.5.3a] — 2026-09-22 — Le recueil de démonstration se remplit tout seul

Une démonstration neuve montrait un recueil public **vide** — « Aucun acte publié pour
l'instant », et pas un seul billet — alors que sa fiction déclare dix-sept actes publiés et quatre
informations. Ce n'était pas une question de données, mais de geste : le recueil public ne lit que
le **service de publication**, et une démonstration ne provisionnait jamais le sien (un service
sans clé est en lecture seule), ni ne lui déposait ses billets. Le premier visiteur voyait donc un
site vide, ce qui est le contraire de ce qu'une démonstration doit montrer.

### Ajouté

- **La démonstration provisionne elle-même son service.** Au premier démarrage, en silence, la clé
  d'administration du service est tirée par le poste (elle ne vit qu'au poste, comme toute clé
  d'écriture), rangée dans les réglages locaux, et les actes peuvent être publiés. Le geste est
  celui de l'administrateur (Administration › Base de données), fait ici pour la démonstration —
  une installation **réelle** n'est jamais concernée.
- **Le recueil public relit le registre du poste quand le service se tait.** Les publications
  rendues à la publication sont gardées sur leurs actes (`src/lib/publications-locales.js`), et le
  recueil s'en sert à défaut : un service remis à zéro, un aperçu qui reconstruit son état ou une
  page hors ligne ne font plus disparaître des actes réellement publiés. Le service reste la
  source ; c'est le même enregistrement, relu.
- **« Le recueil se prépare »** au premier lancement d'une démonstration : plutôt que d'annoncer
  « aucun acte publié » pendant les quelques secondes que prend le dépôt, la page dit ce qu'elle
  fait — et se redessine d'elle-même quand c'est fini.

### Corrigé

- **Les billets de l'atelier atteignent le recueil public.** En régime local — celui de la
  démonstration —, ils ne quittaient pas le poste : la rubrique *Informations* restait vide, et sa
  page absente du pied de page. La démonstration les dépose au service, comme elle dépose ses
  actes, et le recueil les montre à tous.
- **L'échec d'un dépôt après un provisionnement réussi** ne condamne plus toute la session : la
  clé du service n'est plus tenue pour acquise une fois pour toutes. Un service provisionné puis
  remis à zéro (l'aperçu de l'éditeur reconstruit son état) voyait ses dépôts refusés
  `403 service_non_provisionne` jusqu'au rechargement de la page.
- **L'amorçage n'attend plus pour rien** là où le service n'a pas de budget de calcul à ménager
  (édition statique, auto-hébergement) : le recueil public se remplit en quelques secondes au lieu
  d'une trentaine.

## [1.5.3] — 2026-09-22 — L'accès public passe à la racine, l'atelier se restreint à un réseau

Quatre demandes reçues ensemble, livrées ensemble. L'espace public et l'atelier cessent de
partager une adresse : le recueil s'installe à la **racine** du site, l'atelier se **demande** —
et peut ne s'ouvrir qu'à certains réseaux.

### Ajouté

- **L'atelier se restreint à une liste d'adresses.** `SCRIBA_ATELIER_IPS` (fichier `.env` du
  service) ou *Administration › Publication › Accès à l'atelier* : une adresse (`10.0.0.24`), un
  préfixe (`192.168.0.0/16`), un champ (`10.0.0.0-10.0.0.255`) ou une plage abrégée (`10.0.0.*`),
  une entrée par ligne ou séparées par des virgules, `#` pour un commentaire. **La décision
  appartient au SERVICE**, jamais au navigateur : hors de la liste, toutes les routes de
  l'atelier répondent **403 `atelier_hors_reseau`** — le recueil public, lui, reste ouvert à tout
  le monde. Une liste **vide** ouvre l'atelier ; une liste **illisible** le ferme (fail-closed) et
  se signale — jamais d'ouverture silencieuse par faute de frappe. Le message de refus se règle
  (`SCRIBA_ATELIER_MESSAGE`), et l'écran porte un **simulateur** (« et si j'arrivais de là ? »).
- **Les actes RÉSERVÉS AUX AGENTS s'affichent sur le recueil public** pour une personne
  **authentifiée** venant d'une **adresse autorisée** — l'intranet, par exemple. Le service les
  sert, la page les signale (« Réservé aux agents ») et dit à l'agent qu'il les voit à ce titre ;
  un agent en télétravail reste un lecteur du recueil public.
- **Une feuille de style de collectivité** pour le site public (Administration › Publication ›
  Apparence) : du CSS libre, porté sur `.recueil`, appliqué **avant** le premier rendu (pas de
  clignotement de la charte par défaut) et **après** les feuilles de l'application — il l'emporte
  donc, y compris sur `--recueil-largeur`. La table des variables honorées est donnée à l'écran.
- **Les sous-pages de l'espace public** : mentions légales, conditions de réutilisation,
  accessibilité — chacune à son adresse (`?page=legales`, `?page=reutilisation`,
  `?page=accessibilite`), avec titre, description, adresse canonique et fil d'Ariane. Chaque
  mention se règle en texte, en **lien** vers celle du site principal de la collectivité, ou
  s'éteint.
- **Les « Informations » du recueil** : des billets publiés par l'administration — actualités,
  avis, communications —, comme un blog : titre, date, auteur, résumé, texte en Markdown, drapeau
  **épinglé**, aperçu, publication/dépublication. Ils forment une rubrique de la page d'accueil
  (les trois derniers) et une page complète (`?page=informations`), chaque billet ayant son
  adresse (`?info=<slug>`). Le service les sert par une route publique dédiée
  (`GET /v1/informations`) : un brouillon ne sort jamais. La rubrique se renomme (« Actualités »)
  ou s'éteint. Permission `informations.gerer` (éditeur, administrateur).

### Modifié

- **L'espace public est à la RACINE** — `https://recueil.exemple.fr/`, et non plus « `?recueil` ».
  C'est l'adresse que l'on communique ; les adresses des actes, des sous-pages et des billets
  restent portées par la requête (`?acte=`, `?eli=`, `?page=`, `?info=`), donc **rien à ajouter au
  serveur web**.
- **L'atelier se demande** : « `?atelier` » sur une page statique (GitHub Pages), « `/atelier` » sur
  une installation auto-hébergée — nginx sert alors le même `index.html`. C'est ce qui permet de
  restreindre l'atelier à un réseau sans fermer le recueil au public.
- **L'interface publique du recueil est reprise** : en-tête collant, entrée avec recherche et
  chiffres du recueil, bande « Informations », carrousel des derniers actes, thèmes, registre
  complet, et un pied de page qui porte ses pages, sa licence et la **porte de l'application** —
  « Se connecter » pour un visiteur, « Retour à l'application » pour un agent.

### Corrigé

- **La liste des informations de l'atelier montre les brouillons** : l'ordre du recueil public ne
  connaît que les billets publiés, et le réutiliser faisait disparaître tout brouillon — le filtre
  « Brouillons » n'avait alors rien à filtrer, et un billet écrit mais non publié devenait
  introuvable dans l'écran qui sert à l'écrire.
- **Une mention en mode « lien » s'affiche** (le paragraphe était vide : l'élément passé en second
  argument de `h()` était pris pour les attributs).
- **La feuille de style de la collectivité l'emporte vraiment** : posée dans l'en-tête, elle
  passait avant le `<link>` de `index.html` et perdait contre lui.

### Sécurité

- **Une liste d'adresses illisible FERME l'atelier** au lieu de l'ouvrir : une faute de frappe dans
  `SCRIBA_ATELIER_IPS` ne doit pas laisser la porte que l'on croyait gardée. Une liste venue du
  `.env` n'est jamais remplacée en silence par le réglage de l'interface — elle apparaît, refusée,
  et se voit (`erreurs`), et le journal de démarrage le dit.
- La liste s'applique aussi aux actes **réservés aux agents** : être connecté ne suffit pas, il
  faut venir d'une adresse autorisée.

## [1.5.2g] — 2026-09-22 — L'acte publié suit une feuille de style web, et l'export produit un PDF/A

### Ajouté

- **L'export PDF/A** — la forme normalisée pour la **conservation** de longue durée. Les écrans
  d'export (*Exporter…*, la fiche d'un acte, la modification, la version consolidée, l'original
  signé) proposent **PDF/A-2b** (le défaut, bâti sur PDF 1.7) et **PDF/A-1b** (bâti sur PDF 1.4,
  pour les systèmes qui n'acceptent que la première version de la norme). Le fichier est une
  **mise en page réelle**, faite par l'application (`src/lib/pdfa.js`) : mêmes marges, même police,
  mêmes filets, même bloc de signature que l'aperçu — il **embarque ses polices** (Source Serif 4 et
  Source Sans 3, sous licence OFL, dans `src/pdfa/`), sa **règle de couleur** (profil sRGB), sa
  **langue** (`fr-FR`), ses **métadonnées** et son identifiant ELI. Une table, une annexe, une
  version consolidée s'y composent comme sur le papier, et la pagination est recalculée.

### Modifié

- **L'interface web publique des actes ne suit plus les feuilles de style.** L'acte publié au
  recueil se présente selon une **feuille de style web**, la même pour tous
  (`CSS_DOCUMENT_WEB`, `src/lib/recueil.js`) : deux entités qui suivent deux chartes différentes —
  en-tête, logo, police, filets, couleurs, marges — voient désormais leurs actes **à l'identique**
  sur le site public. La charte graphique habille le **papier** (aperçu, « Imprimer / PDF », Word,
  page autonome, PDF/A), pas la page du recueil. Le document publié perd donc l'attribut
  `data-sheet`, l'en-tête et le pied de sa charte ; les réglages de bloc (paragraphe encadré,
  filets et bandes d'un tableau) suivent, eux, le **thème du recueil**.
- **Le PDF/A succède à « Export PDF/A certifié »** dans la feuille de route : la chaîne est livrée,
  sa conformité reste à valider sur un déploiement (`veraPDF`).

## [1.5.2f] — 2026-09-22 — Des clés d'API à rôles, comptes de service

### Ajouté

- **Les clés d'API à rôles : des comptes de service pour l'API.** L'administrateur crée, depuis
  *Administration › Base de données*, une clé d'API en choisissant son **rôle** (lecteur, rédacteur,
  éditeur, administrateur, prestataire) et son **libellé**. La clé se présente ensuite en en-tête
  `Authorization: Bearer …` et n'ouvre que les routes de son rôle : une clé de lecture ne peut pas
  publier, une clé de rédaction ne peut pas gérer les clés. C'est un **compte de service** : le
  référentiel l'ignore, et elle n'apparaît ni dans « Comptes et rôles », ni dans les personnes, ni
  dans l'annuaire. Le service n'en conserve que l'empreinte **SHA-256** — la valeur est tirée par le
  poste et ne s'affiche qu'**une fois**, au moment de sa création.
- **Le journal d'audit du service** (`GET /v1/journal`) : chaque geste sensible — dépôt, signature,
  publication, retrait, épinglage, provisionnement et gestion des clés — y laisse une ligne, et
  chaque ligne **scelle la précédente par son empreinte** (le champ `scelle` révèle une chaîne
  rompue). Les 2 000 dernières entrées sont conservées, et le journal s'exporte depuis son écran
  pour être archivé hors du service.
- **Les routes d'administration des clés** : `GET /v1/auth/etat` (publique — dit si le service est
  administrable et par quel mode : `session` en mode « mot de passe » ou annuaire, `service` quand
  il faut la première clé), `POST /v1/auth/bootstrap` (dépôt de la **première** clé),
  `GET`/`POST /v1/auth/cles` et `POST /v1/auth/cles/{id}/revoquer`. Le service refuse de révoquer la
  **dernière** clé d'administration (409 `derniere_cle_admin`), sans quoi il ne serait plus
  administrable.

### Modifié

- **Les actes déposés ne se lisent plus anonymement.** `/v1/actes` et ses suites exigent désormais
  un rôle au moins **lecteur** — une session, ou une clé de service : c'était une lecture anonyme,
  et c'était un défaut. Le **recueil public**, lui, reste ouvert.

## [1.5.2e] — 2026-09-22 — Le recueil sait réserver un acte aux agents

### Ajouté

- **Un acte publié peut être réservé aux agents connectés.** L'éditeur de trame porte la case
  « Réserver la diffusion aux agents connectés » (onglet « Trame »), et le formulaire de publication
  la reprend **acte par acte**. L'acte reste *publié* — identifiant ELI, version en ligne, pièces,
  versions successives —, mais le **recueil public ne le sert qu'aux porteurs d'une session ou d'une
  clé de service** : un visiteur anonyme ne le trouve ni dans la liste, ni à son adresse, ni dans
  `recueil.json`, ni dans `llms.txt`, ni dans le `sitemap.xml`. Usage type : une circulaire interne,
  une consigne aux agents de la collectivité.
- **La mention au recueil public.** Le bloc « Vous ne trouvez pas ce que vous cherchez ? » paraît
  désormais **toujours**, et rappelle que certains actes — circulaires, consignes — ne s'adressent
  qu'aux **agents** : il faut se connecter pour les consulter. La version en ligne porte un bandeau
  « Réservé aux agents », chaque élément de la liste en porte le badge, et le détail est journalisé.

## [1.5.2d] — 2026-09-22 — L'export n'est plus le but, « Soumettre au circuit » est le geste

### Modifié

- **L'interface du rédacteur montre le chemin, et met en avant le bon geste.** Un **parcours** est
  affiché en tête de l'atelier — Rédiger → Soumettre au circuit → Révision → Signer → Publier — avec
  l'étape courante et les suivantes, pour qu'un novice ne prenne pas l'export pour l'aboutissement.
  Le **geste du moment** est proposé à la suite du document dans un bouton **principal**
  (« Soumettre au circuit », ou « Aller à la signature » quand l'acte est validé et que l'on peut
  signer).
- **L'export passe au troisième rang.** Il reste disponible — il sert à imprimer ou à transmettre
  hors de l'application — mais sous une forme **discrète**, accompagnée d'une phrase qui dit ce
  qu'il est : « ce n'est pas la fin du parcours ».

## [1.5.2c] — 2026-09-22 — Le parapheur vise une personne ou un service, et les circuits se lisent un par un

### Ajouté

- **Une étape de circuit peut viser un rôle, une personne nommée ou un service.** L'administrateur
  choisit, pour chaque marche, « qui porte l'étape » : le **rôle** habituel (le défaut du circuit),
  une **personne** désignée, ou un **service** — qui n'a pas besoin de faire partie de la chaîne de
  décision. Les champs correspondants n'apparaissent que selon le choix, pour ne pas encombrer.
- **Une vue récapitulative des circuits.** *Administration › Circuits* liste désormais les circuits
  sous forme de **récapitulatif**, et ouvre une **sous-vue par circuit** : les circuits ne s'empilent
  plus à la suite sur la même page, ce qui rendait la lecture longue et la comparaison difficile.

## [1.5.2b] — 2026-09-22 — L'organigramme s'édite dès le rôle d'éditeur

### Modifié

- **L'éditeur administre l'organigramme.** Une nouvelle permission `organigramme.gerer`
  (administrateur **et** éditeur) ouvre l'ajout et le retrait des **services** et des **bureaux**,
  ainsi que le réglage de leurs rattachements. L'ajout ou la suppression d'une **entité**, elle,
  reste à l'**administrateur** — mais un éditeur peut régler les relations descendantes (les
  services et bureaux qu'elle porte).
- Les retraits opérés depuis le référentiel (détachement d'un service, rattachement d'un bureau)
  sont **tracés au journal d'audit**, comme le reste des gestes d'administration.

## [1.5.2a] — 2026-09-22 — Un service peut dépendre d'un autre service

### Ajouté

- **Un service peut dépendre d'un autre service, ou du bureau d'un autre service.** L'organigramme
  ne connaissait que l'entité ; il accepte désormais un **rattachement** d'un service à un autre
  service — ou au bureau d'un autre service —, et la hiérarchie ainsi formée est montrée dans
  l'arbre des entités et services.
- **Le périmètre suit la chaîne.** Les agents affectés à un service **en haut de chaîne** voient
  tous les actes de la chaîne **en contrebas** : sur l'atelier, le périmètre d'un service couvre le
  service lui-même **et ses descendants**. Le libellé de périmètre dit en clair ce qu'il couvre.

## [1.5.2] — 2026-09-22 — L'organigramme s'édite, le recueil se réserve, et l'API a ses clés

Six demandes reçues ensemble, livrées ensemble.

### Ajouté

- **Une publication peut être réservée aux agents** (drapeau `reserve`, posé sur la trame ou sur
  l'acte au moment de publier) : l'acte reste publié — identifiant ELI, page, versions —, mais le
  recueil public ne le sert qu'aux porteurs d'une **session** ou d'une **clé de service**. Le bloc
  « Vous ne trouvez pas ce que vous cherchez ? » paraît en toutes circonstances et le rappelle.
- **Un service peut dépendre d'un autre service** (ou du bureau d'un autre service) : le périmètre
  suit la chaîne, si bien qu'un agent affecté en **haut de chaîne** voit les actes de tout ce qui
  pend en dessous.
- **Des clés d'API à rôles**, créées par l'administrateur : des **comptes de service** (invisibles
  dans « Comptes et rôles », ni dans l'annuaire) qui n'ouvrent que les routes de leur rôle, et un
  **journal d'audit scellé** tenu par le service (`GET /v1/journal`).
- **Une étape de circuit peut viser une personne nommée ou un service**, et non plus seulement un
  rôle ; les circuits se lisent désormais en **récapitulatif**, avec une sous-vue par circuit.

### Modifié

- **L'organigramme s'édite dès le rôle d'éditeur** (permission `organigramme.gerer` : services et
  bureaux ; l'ajout ou la suppression d'une entité reste à l'administrateur).
- **L'atelier du rédacteur affiche le parcours** (Rédiger → Soumettre au circuit → Révision →
  Signer → Publier) et met en avant le **geste du moment** ; l'export, discret, n'est plus présenté
  comme l'aboutissement.
- **Les actes déposés ne se lisent plus anonymement** : `/v1/actes` exige au moins le rôle
  `lecteur` (le recueil public, lui, reste ouvert).

## [1.5.1] — 2026-09-22 — La barre de gauche suit la vie de l'acte

### Modifié

- **La barre de gauche est rangée en six rubriques, dans l'ordre de la vie de l'acte** :
  **Produire** (trames, rédiger, modifier, registre des actes, corbeille), **Valider** (parapheur,
  révision), **Publier** (signature et publication, exécution et délais, publications ELI, recueil
  public), **Organisation** (organigramme, délégations, chrono de numérotation), **Configurer**
  (administration, feuilles de style) et **Aide** (guide, API REST, documentation technique).
  « Produire » mêlait jusqu'ici les gestes de production et les **référentiels** de la
  collectivité : on y trouvait les délégations et l'organigramme, qui ne se fabriquent pas dans
  l'atelier. Ces trois écrans — qui composent la collectivité, qui signe à la place de qui,
  comment on numérote — sont désormais réunis sous **Organisation**, à côté des réglages et non
  parmi les gestes du quotidien. La **corbeille**, elle, quitte « Configurer » : ce sont les
  actes et les trames **retirés du registre**, que tout rédacteur peut consulter et rétablir —
  elle appartient à l'atelier. Le **parapheur** et la **révision** forment leur propre rubrique
  (« Valider ») plutôt que de s'aligner à la suite de la rédaction.
- **Rien ne change d'adresse.** Les écrans gardent le même identifiant de route (`#/actes`,
  `#/delegations`…) : les liens déjà partagés continuent d'aboutir, et la barre continue de se
  filtrer par profil (une rubrique dont aucune entrée n'est permise disparaît).

## [1.5.0] — 2026-09-22 — Les documents qui ne font pas droit, et le parapheur achevé

### Ajouté

- **Les documents non juridiques se publient au recueil.** Trois natures de
  document nouvelles se choisissent sur une trame : le **verbatim d'assemblée**
  (le compte rendu intégral d'une séance), la **déclaration** (un texte pris
  devant ou par l'assemblée) et le **vœu** (une motion : l'assemblée demande,
  elle ne décide pas). Ces documents se signent et se **publient comme les
  actes** — ils reçoivent leur identifiant ELI et se consultent au recueil public,
  où les administrés les cherchent —, mais ils **ne font pas droit** : leur
  publication n'emporte **ni opposabilité, ni entrée en vigueur, ni délai de
  recours**. Le recueil les présente comme des **documents** (encadré « Document
  non opposable » à la place de la mention d'opposabilité, classement sous
  « Documents »), leur notice porte la mention « document, non opposable », le
  JSON-LD **omet** la date d'entrée en vigueur, la version Markdown dit la même
  chose, et l'**attestation de non-recours** explique qu'aucun délai ne court à
  leur encontre. Ni transmission au contrôle de légalité, ni notification aux
  intéressés ne les concernent : l'écran du caractère exécutoire les présente
  comme « Document — non opposable », sans échéance. Trois trames de
  démonstration les illustrent (verbatim de séance, déclaration, vœu), dont deux
  sont publiées au recueil de démonstration.
- **Le rapport de conformité du réviseur suit la règle.** Un document qui ne fait
  pas droit n'est plus jugé sur son « dispositif en articles » — le rapport
  réclamait un article 1er que la nature du document exclut. Le contrôle porte
  désormais sur ce qu'il doit porter : son **texte** (« Texte du document — n
  paragraphe(s) »), et le rapport ne lui annonce ni opposabilité ni entrée en
  vigueur (« Document publiable — déposé au recueil »). La marche de publication
  du circuit de signature dit de même « Publié au recueil », et « En attente de
  publication au recueil », au lieu de la formule de l'acte opposable.

### Modifié

- **Le parapheur a trois natures d'étape — vérification, visa, signature — et il
  sort des fonctions expérimentales.** L'ancien couple « bon pour accord / avis »
  est remplacé par une nature d'étape, choisie par l'administrateur pour chaque
  marche du circuit :
  - la **Vérification** — le contrôle du dossier avant tout engagement : c'est
    la marche du **réviseur**, et elle ouvre désormais le circuit général ;
  - le **Visa** — le « bon pour accord » qui engage le service ou la direction ;
  - la **Signature** — le signataire marque son accord, et le circuit s'achève.
  Chaque nature appelle un rôle par défaut (réviseur, éditeur, signataire), que
  l'administrateur peut changer ; la restriction au service de l'acte suit la
  nature. Les circuits anciens restent lus : une étape « bon pour accord » est
  tenue pour un visa, une étape « avis » pour une vérification. Le circuit
  général de la démonstration **s'ouvre par la vérification du réviseur**.
- **Le parapheur n'est plus une fonction expérimentale.** Le circuit de
  validation avant signature est désormais une fonction ordinaire : il n'est plus
  masqué derrière un réglage, l'écran « Fonctions expérimentales » le présente
  comme actif, et le réglage `experimental.parapheur` n'est plus servi — il reste
  lu (toujours vrai) pour ne pas casser un référentiel antérieur. Un référentiel
  qui ne veut pas de parapheur écarte le circuit sur ses trames
  (« Aucune validation ») ou désactive le circuit concerné.
- Le **signataire d'un circuit** se choisit par sa **fonction** dans l'acte, et
  le circuit de l'office se termine par la marche de **signature** du signataire
  de l'office, au lieu d'un visa.
- Documentation (README, SPEC, wiki embarqué, ADMINISTRATION, GITHUB, DOCKER)
  alignée sur les trois natures d'étape et sur la sortie du régime expérimental.

### Corrigé

- **L'écran « Signature & publication » ne plante plus à l'ouverture.** L'onglet
  du référentiel de signature appelait une fonction sous un nom mal orthographié
  et levait une erreur au premier affichage : la page « Circuit de signature » et
  « API du prestataire » s'affichent désormais normalement.

## [1.4.0] — 2026-09-22 — L'organigramme, le chrono, deux emblèmes et l'API documentée

### Ajouté

- **Le signataire principal d'une entité.** Chaque entité — la commune, un
  établissement, une régie — peut désigner la personne qui signe ses actes quand
  la trame n'en désigne aucun : son maire, son président, son directeur. La
  qualité sous laquelle elle signe s'y ajoute, sans écraser un choix fait sur la
  trame. C'est ce signataire que la compilation retient par défaut ; une entité
  qui n'en a pas le signale, plutôt que de produire un acte sans signature.
- **L'organigramme des entités, des services et des bureaux.** Un écran nouveau
  (`Organigramme`, à côté des Délégations, dont il reprend la toile) montre la
  structure au nom de laquelle les actes sont pris : l'entité, ses services, et
  les bureaux auxquels les comptes sont rattachés — en arbre ou en liste, avec
  une fiche par maille où tout se règle sans quitter l'écran. Une entité est
  **autonome** (elle a sa personnalité morale : la commune, le CCAS, la caisse
  des écoles, l'office) ou **rattachée** à une autre (le cas d'une régie
  municipale — le cinéma, par exemple —, sans personnalité morale propre, mais
  avec son directeur, son service et ses actes). L'écran dit aussi les entités
  hors arbre : celles dont le rattachement forme une boucle, qu'il faut corriger.
- **Le chrono de numérotation.** L'ensemble des numéros attribués se lit
  désormais dans un écran : le rang, l'entité et le type d'acte, le numéro
  composé, l'état de l'acte, ses dates et son rédacteur — et, avec eux, les
  **rangs jamais attribués** et les **numéros annulés**, pour qu'un trou dans la
  suite s'explique. Compteurs en tête, filtres (année, entité, type d'acte,
  état, rédacteur, texte), tri par colonne, et **export CSV ou XLSX** du
  résultat filtré, engendré sans aucune dépendance. Le passage à l'année
  suivante s'y fait d'un bouton, et « Annuler le rang » libère une attribution
  faite par erreur — le chrono ne renumérote jamais de lui-même.
- **Deux emblèmes en en-tête des actes.** Outre le logo de gauche, la feuille de
  style accepte un second emblème, à droite du filet (la marque de l'État, d'un
  partenaire, d'une délégation), avec sa propre hauteur. Vide, l'emplacement
  n'existe pas et le document se présente comme avant.
- **L'autorité de l'acte peut être en gras.** Le réglage de la formule d'autorité
  passe d'une case « italique » à un choix de graisse : normal, italique, gras,
  ou gras italique. Une feuille enregistrée avant ce choix conserve exactement
  son rendu — c'est « Hérité » qui le dit.
- **Les réglages de l'API du prestataire de signature.** En production, le
  circuit électronique se règle enfin : *Administration › Signature* reçoit un
  bloc « API du prestataire » — transport, adresse, prestataire, niveau de
  signature, adresse de notification, délai, et les quatre points de terminaison
  (document, signataires, démarrage, statut). On le pose à la main, ou on le
  déclare dans le `.env` du déploiement (`SCRIBA_SIGNATURE_API_*`), qui l'emporte.
  Le service appelle alors réellement le prestataire pour ouvrir le circuit ; la
  **clé d'API**, elle, ne quitte jamais le serveur (`SCRIBA_SIGNATURE_API_CLE`) et
  n'apparaît nulle part dans le référentiel. Tant qu'aucune adresse n'est
  renseignée, le circuit reste simulé — et l'écran le dit.
- **La référence complète de l'API REST, avec son panneau de commande.** Un écran
  `API REST` décrit toutes les routes du service — rôle exigé, paramètres, corps,
  réponses, champs notables, exemple cURL —, et permet de **jouer la requête pour
  de vrai** : on choisit l'opération, on ajuste le chemin et le corps, on envoie,
  et la réponse s'affiche avec son code et sa durée. L'appel passe par le même
  chemin que l'application : il figure donc dans « API & journal ». La même
  description engendre `docs/API.md`, consultable dans *Documentation technique*,
  et il n'y a qu'une source pour les deux : `src/lib/api-reference.js`.

### Modifié

- **Annuaire branché, comptes locaux toujours ouverts.** Activer `AUTH_MODE=oidc`
  fermait la porte aux comptes créés à la main — le compte d'administration du
  `.env` compris —, alors que c'est précisément ce compte qui sert quand
  l'annuaire est injoignable. L'écran de connexion propose désormais, sous le
  bouton de l'annuaire, un bloc **« Ou par un compte local »** : le compte du
  `.env` et les comptes locaux y entrent, quel que soit le mode. La session
  qu'ils ouvrent est reconnue par le service (`comptes_locaux` de
  `GET /v1/auth/config`), et l'administration des comptes le dit.
- **Le jeu de démonstration** porte ses signataires principaux, son drapeau
  d'autonomie, et une entité rattachée de plus : la régie du cinéma municipal,
  son directeur, son service et ses deux bureaux. Un référentiel de démonstration
  déjà installé les reçoit par mise à niveau, sans être remis à zéro.

### Corrigé

- **Une couleur de marque illisible ne dégrade plus l'interface.** Une valeur
  incomplète dans *Administration › Identité* (ou reprise d'un import) rendait
  `var(--brand)` invalide : liens, pastilles et filets perdaient leur couleur
  les uns après les autres, sans qu'aucun message ne le signale. L'application
  retombe désormais sur le bleu de la République, comme si la couleur n'était
  pas réglée.

## [1.3.2f] — 2026-09-22 — La pastille de base ne dit plus « erreur » pendant la connexion

### Corrigé

- **« base : erreur » s'affichait alors que la base répondait.** La pastille de l'en-tête ne
  connaissait que trois états et donnait le mot de l'erreur à tout ce qui n'était ni
  « disponible » ni « injoignable » — y compris l'état d'un service qu'on interroge encore. Elle a
  désormais un mot par état : « base partagée », « base hors ligne », « base : erreur », et
  « base : connexion… » tant que la réponse n'est pas là. On ne crie plus à la panne avant
  d'avoir demandé.
- **Le motif d'une panne ne se lisait qu'en infobulle.** Sur *Administration › Base de données*,
  l'état est maintenant suivi du message du service écrit noir sur blanc : un exploitant qui doit
  recopier une erreur n'a plus à survoler une pastille.

## [1.3.2g] — 2026-09-22 — Les écritures passent par la session dès que le service le dit

### Corrigé

- **Des écritures refusées (403) alors que les lectures passaient, la pastille au rouge à chaque
  geste.** Le pilote de persistance est bâti au démarrage, sur le régime que la PAGE annonce (le
  `.env` du déploiement, recopié dans `config.js`) ; le service, lui, ne dit le sien qu'ensuite
  (`GET /v1/auth/config`). Quand les deux diffèrent — un `.env` muet sur `AUTH_MODE`, par
  exemple —, l'application continuait de se présenter avec un jeton et SANS l'en-tête anti-CSRF :
  le service, en mode « mot de passe », servait les LECTURES (il trouve la session dans le cookie)
  mais refusait chaque ÉCRITURE (`csrf_invalide`) — la pastille passait au rouge, et rien ne
  s'enregistrait sur la base. L'application refait désormais son pilote dès que le service a
  annoncé son mode : la session et l'anti-CSRF entrent en service, et les écritures aboutissent.
- **Le fichier compose annonçait au navigateur un mode VIDE quand le `.env` ne disait rien**, alors
  que le service, lui, démarre en `password` : c'est précisément la divergence décrite ci-dessus.
  Le service `web` porte désormais le même défaut que le service `api` (`AUTH_MODE` par défaut :
  `password`).
- Le `README` du service disait encore que `AUTH_MODE=demo` était le défaut : c'est `password`. Il
  rappelle aussi que la variable vaut pour le service **et** pour la façade, qui l'annonce au
  navigateur.
- Le message d'un refus d'écriture dit maintenant ce que le service a répondu, au lieu de supposer
  une session expirée.

## [1.3.2h] — 2026-09-22 — Le jeton d'API n'est plus présenté comme nécessaire en mode « mot de passe »

### Corrigé

- **Le champ « Jeton d'API » s'affichait avec la valeur du gabarit (`0000…0`) sur une installation
  qui n'en a pas besoin.** En mode « mot de passe », la porte est la session de l'agent : le jeton
  du `.env` n'est ni lu ni envoyé, et celui que porte `env.example` (une suite de zéros) n'est
  qu'un exemple. Le champ disparaît dans ce mode, remplacé par la phrase qui dit ce qui ouvre
  vraiment.
- **Le bouton « Tester la connexion » annonçait un échec à un service qui fonctionnait.** Il
  éprouvait le jeton, que ce mode n'utilise pas ; il éprouve désormais ce qui ouvre : la session
  (cookie) et l'anti-CSRF.

## [1.3.2i] — 2026-09-22 — L'état de la base ne refait plus l'écran

### Corrigé

- **La page se redessinait à chaque changement d'état de la base, et la saisie en cours y perdait
  son champ.** Chaque écriture qui aboutissait — ou qui échouait — faisait reconstruire
  l'application entière : une base qui va et vient (un service qui refuse les écritures, un réseau
  qui hésite) faisait donc clignoter l'écran toutes les quelques secondes, et le champ qu'un agent
  était en train de remplir était désélectionné à chaque fois. Le changement d'état ne remplace plus
  que la **pastille de l'en-tête** ; *Administration › Base de données*, seul écran qui montre
  l'état en clair, continue de s'y tenir à jour sans reconstruire le reste.

## [1.3.2j] — 2026-09-22 — Le curseur survit au redessin

### Corrigé

- **Compléter un champ était difficile : certains champs se redessinent pendant la saisie**, et le
  curseur — avec la fin de ce qui était tapé — était perdu au milieu d'une adresse ou d'un intitulé.
  Un redessin reprend désormais **le champ, la position du curseur, le texte sélectionné et le
  défilement** ; changer d'écran, lui, commence bien en haut de page, sans rien reprendre de
  l'écran qu'on quitte.

## [1.3.2k] — 2026-09-22 — L'état de la base ne ment plus

### Corrigé

- **« Erreur de connexion » affiché pendant que « Tester la connexion » annonçait une réussite.** Les
  deux ne parlaient pas de la même chose. L'état est un **constat daté** : il vient du dernier geste
  qui a parlé à la base, et rien ne le recalculait — une pastille rouge vieille d'une panne déjà
  réparée restait donc affichée. Le bouton, lui, n'interrogeait que la route de santé
  (`/v1/db/health`), qui ne demande **ni session ni anti-CSRF** : elle répond 200 même quand le service
  refuse ensuite chaque écriture. L'écran pouvait ainsi montrer, côte à côte, une pastille rouge,
  « 75 écritures en attente » et « Connexion réussie » — aucune des trois lignes n'étant fausse, mais
  chacune répondant à une question différente, et aucune n'expliquant quoi faire.
- **L'état est repris en compte là où il s'affiche** : *Administration › Base de données* l'éprouve à
  son ouverture (et après un essai réussi) au lieu de montrer un constat qui peut dater. Un service
  qui ne rend aucun message n'y laisse plus une pastille rouge sans motif : le code HTTP est écrit.

### Ajouté

- **Le test de connexion éprouve désormais l'ÉCRITURE** — une synchronisation VIDE (aucun
  enregistrement, donc rien de déposé), qui traverse toute la garde du service : session, anti-CSRF,
  rôle, transaction. Le résultat tient en deux lignes : *Le service répond*, puis *La base accepte les
  écritures* — c'est la seconde qui dit pourquoi un geste ne s'enregistre pas. L'essai porte sur le
  réglage **en service**, ou sur celui **affiché** si l'on vient de modifier les champs, et il le
  précise ; son résultat survit au redessin qui suit.

## [1.3.2m] — 2026-09-22 — « csrf_invalide » ne se lit plus tout seul

### Corrigé

- **Un refus d'écriture s'affichait en CODE, sans phrase.** Le service a TROIS fabriques de réponse
  d'erreur — celle des données (`err(message, options)`), celle des comptes (`err(code, message)`) et
  celle des actes (`err(statut, message)`) — et les deux refus des routes de données
  (`session_absente`, `csrf_invalide`) appelaient la première avec les arguments de la deuxième : la
  phrase française partait dans le vide, l'écran ne montrait plus que « csrf_invalide », et le corps
  de la réponse portait en prime des clés parasites (les lettres de la phrase éclatées une à une).
  L'agent lisait un code sans savoir quoi faire. Les deux refus disent maintenant leur phrase, et le
  code voyage à part (`code`), où l'écran peut le reconnaître sans l'afficher.

### Ajouté

- **Le jeton anti-CSRF ne dépend plus de l'hôte de la page.** `document.cookie` ne montre que les
  cookies de l'hôte de la page : quand l'application est servie par un hôte et le service par un
  autre — une « Adresse du service de données » renseignée, un `API_BASE` posé dans le `.env` —, le
  navigateur envoie bien le cookie du service, mais le JavaScript de la page ne peut pas le lire. La
  session était valide, les lectures passaient, et chaque ÉCRITURE était refusée (`csrf_invalide`)
  sans que rien ne le dise — c'est exactement le « 77 écritures en attente » d'un poste qui ne peut
  rien transmettre. Le service rend désormais le jeton **avec la session**
  (`GET /v1/auth/session` ; la connexion le rendait déjà), et le repose en cookie s'il a disparu ;
  l'application le garde et l'envoie dans l'en-tête à défaut du cookie. Le double envoi garde tout
  son sens : aucun autre site ne peut lire cette réponse (aucun en-tête CORS ne l'y autorise).
- **Un refus d'écriture nomme sa cause, et le geste qui la répare.** Exemple, pour un service sur un
  autre hôte : « La page ne peut pas lire son jeton anti-CSRF : le service est sur l'hôte
  « donnees… » et l'application sur « app… » — laissez l'Adresse du service de données vide (le
  service du déploiement est servi sur le même domaine, sous /v1/) ». La même phrase s'affiche sous
  les verdicts de *Tester la connexion* dès que l'essai d'écriture est refusé, et sous l'état quand
  un renvoi de la file est refusé pour cette raison.

## [1.3.2l] — 2026-09-22 — Les écritures en attente se voient, se renvoient, ou s'abandonnent

### Corrigé

- **La file des écritures en attente grossissait sans rien dire.** Un service injoignable une
  demi-heure laissait soixante-quinze écritures à renvoyer — un battement de cœur toutes les
  vingt-cinq secondes — sans que rien n'indique lesquelles, depuis quand, ni pourquoi elles ne
  partaient pas. La file range maintenant **une écriture par collection** : toutes les différences
  d'une même collection sont calculées sur le même index serveur, et rien n'en a été appliqué, si bien
  que la plus récente porte tout ce que les précédentes demandaient. Soixante-quinze écritures d'un
  même poste redeviennent une seule.
- **Un renvoi qui échoue le dit.** Il ne laissait la pastille sur un état antérieur (« base
  disponible » alors que rien ne passait) : il rapporte désormais ce que la base a répondu — un refus
  définitif (session, anti-CSRF) ne se répare pas en attendant, une panne réseau si.
- **Le renvoi ne dépend plus d'une lecture.** La file n'était rejouée que si une lecture ou un
  contrôle de santé passaient par là : un poste laissé sur un écran immobile gardait ses écritures des
  heures, même après le retour de la base. Elle est representée toutes les trente secondes, et au
  retour du réseau.
- **Un réglage enregistré ne conserve plus les clés de l'appel qui l'a posé** (`silent`, par
  exemple) : la façade n'accepte que les trois réglages qu'elle connaît (`mode`, `url`, `token`), à
  l'écriture comme à la relecture.

### Ajouté

- **L'écran montre la file, et permet d'agir.** Sous l'état : ce qui attend (par collection, avec les
  libellés), depuis quand, et le motif du dernier refus — message du service et code HTTP compris.
  Deux gestes : *Renvoyer maintenant* (qui refait le pilote au passage, pour qu'un refus d'anti-CSRF
  ne se répète pas à l'identique) et *Abandonner ces écritures*, avec confirmation. L'écran dit aussi
  ce qu'une file signifie : ces écritures ne sont **pas** dans la base, et les autres postes ne les
  voient pas encore.

## [1.3.2n] — 2026-09-22 — La file ne s'arrête plus au premier refus, et la connexion rend son jeton

### Corrigé

- **Une seule écriture définitivement refusée bloquait toute la file derrière elle.** Le renvoi
  parcourait les écritures en attente dans l'ordre et s'arrêtait à la première qui échouait. Une
  entrée que le service refuse par nature — une écriture de `users` ou de `config` mise de côté par
  une session d'administrateur, rejouée après qu'un compte ordinaire a pris la place du poste :
  `403 droit_requis` — ne repartait donc JAMAIS, et les collections suivantes (les actes que l'agent
  venait d'écrire, son journal, sa présence) non plus. « Renvoyer maintenant » échouait à
  l'identique, et il ne restait que « Abandonner ces écritures », qui perd le travail de tout le
  monde. Chaque entrée est désormais essayée : celles qui échouent restent en attente (rien n'est
  perdu), celles qui peuvent passer passent, et le motif dit le premier refus **et** ce qui a été
  transmis malgré tout.
- **Les deux cookies de la connexion partaient sur une seule ligne d'en-tête.** La session et son
  jeton anti-CSRF sont posés ensemble (`Set-Cookie`), mais la protection d'en-têtes transformait
  toute valeur en chaîne : les deux cookies se retrouvaient joints par une virgule —
  « scribae_session=…; Path=/…,scribae_csrf=…; Path=/… » —, une valeur invalide (`Set-Cookie` est
  le seul en-tête qu'on ne peut pas replier) que les navigateurs n'interprètent que par tolérance,
  chacun avec son heuristique de découpage. Un en-tête à plusieurs valeurs reste maintenant un
  tableau jusqu'à `writeHead` (Node écrit une ligne par valeur), et une valeur douteuse est écartée
  seule au lieu d'emporter les autres.
- **Une application servie par une autre ORIGINE que le service ne pouvait pas écrire.** Le service
  déclarait bien les origines autorisées (`CORS_ORIGINS`), mais sans
  `access-control-allow-credentials` : le navigateur refuse alors la réponse à toute requête en
  `credentials: "include"` — c'est-à-dire à toutes les écritures en mode « mot de passe », où la
  session vit dans un cookie. Le refus, côté navigateur, ressemblait à une panne réseau : l'écriture
  était rangée en attente (« Serveur de données injoignable ») et l'exploitant cherchait une coupure
  qui n'existait pas. L'en-tête est posé quand une origine précise est autorisée (jamais avec `*`,
  que la spécification interdit de combiner avec les cookies), `x-csrf-token` est déclaré dans
  `access-control-allow-headers` — sans quoi le contrôle préalable échoue et la requête n'atteint
  jamais le service — et `DELETE`, utilisé pour retirer un mot de passe, dans
  `access-control-allow-methods`.
- **La connexion ne rendait pas son jeton anti-CSRF**, contrairement à `/v1/auth/session` (note
  1.3.2m) : sur un service, l'application gardait donc un jeton vide jusqu'à sa première relecture
  de session, et les écritures de DÉMARRAGE — celles qui suivent immédiatement la connexion —
  partaient sans en-tête et étaient refusées. La connexion (et la connexion de démonstration)
  rendent désormais le jeton dans leur réponse, comme la session, et le jeton gardé en mémoire est
  oublié à la déconnexion.
- **Un refus de rôle se lisait sans phrase.** `droit_requis` (une collection réservée aux
  administrateurs) et `force_reserve_admin` n'avaient aucune explication : l'écran disait « la base
  a refusé », et le seul conseil était de se reconnecter — alors que le geste juste est de se
  reconnecter **en administrateur**, ou d'abandonner cette écriture-là. Ces refus ont maintenant
  leur phrase, comme `csrf_invalide` ; `session_absente` dit aussi la piste du cookie (service sur
  un autre site), `jeton_invalide` celle du jeton d'API, et l'écran *Base de données* nomme la
  **collection** refusée dans le motif du dernier renvoi.
- **Un pilote bâti pendant un redémarrage du service ne se réparait jamais.** Le mode du service est
  lu au démarrage (`GET /v1/auth/config`) ; si cet appel échoue, le pilote reste bâti sur le seul
  présage de la page, sans session ni anti-CSRF, et chaque écriture était refusée **pour toujours**
  — aucune relecture du mode n'était prévue, seule une relecture de la page réparait. La façade
  répare désormais à la demande (`reparerPilote`) : elle redemande son mode au service, relit la
  session (dont le jeton anti-CSRF), refait le pilote si le régime a changé, et rejoue l'écriture
  une fois — au premier refus `csrf_invalide` ou `session_absente`, comme au renvoi d'une écriture
  en attente ou sur « Renvoyer maintenant ». La réparation est unique par renvoi (et espacée de
  vingt secondes en automatique) pour ne pas marteler un service qui refuse, et le renvoi de la
  file ne peut plus se demander à lui-même la réparation en cours.

**Points ouverts, non corrigés ici** : l'audit ciblé du 2026-09-22 en laisse six, documentés et
chiffrés dans `src/docs/AUDIT-BUGS-2026-09-22.md` — `GET /v1/db/health` publique qui décrit
l'infrastructure, le mode « Service de démonstration » proposé en auto-hébergement, une entrée
refusée réessayée toutes les trente secondes, les migrations d'administration tentées par un
compte ordinaire, l'absence d'avertissement avant un montage inter-site, et la présence qui
amplifie les états d'erreur.

## [1.3.2p] — 2026-09-22 — Repartir de zéro ne ferme plus la porte

### Corrigé

- **« Repartir d'un référentiel vierge » effaçait les COMPTES du service — le compte
  d'administration compris.** Le référentiel et les comptes vivent dans les mêmes collections :
  le bouton vidait donc la collection `users`. Or les mots de passe ne sont pas dans le
  référentiel : ils vivent chez le service (table `sb_motdepasse`), qui les garde. Le compte
  d'administration disparaissait, son mot de passe restait orphelin — et l'installation n'avait
  plus **personne** pour se connecter. Comme la documentation recommande de retirer
  `ADMIN_PASSWORD` du `.env` une fois le mot de passe changé depuis l'application, plus rien ne
  pouvait la réparer : ni l'amorçage (qui refuse de créer un compte sans mot de passe), ni la
  commande `--mot-de-passe` (qui refusait un compte absent). Le geste laisse désormais les
  comptes **intacts** quand ils appartiennent au déploiement — comptes locaux à mot de passe, ou
  agents de l'annuaire (`comptesDuDeploiement`, `clearAll({ garderComptes })`) : la remise à zéro
  efface le référentiel, les trames et les actes, pas les accès. En démonstration, les comptes
  restent ceux du jeu fictif, et partent avec lui.
- **Le service RÉTABLIT son compte d'administration au démarrage.** Si le référentiel n'a plus le
  compte déclaré par `ADMIN_LOGIN` alors que le service garde encore son mot de passe, le compte
  est réécrit — même identifiant, rôle administrateur, et le mot de passe **conservé**, jamais
  remplacé. Une installation enfermée dehors se rouvre donc d'elle-même au redémarrage du
  service, sans toucher au `.env`. La réparation ne joue que pour l'identifiant dérivé du login
  d'`ADMIN_LOGIN` (celui que l'amorçage attribue) : un mot de passe resté sous un autre
  identifiant n'invente aucun compte.
- **La commande de secours crée le compte au lieu de le refuser.** `printf '%s' "$MDP" | node
  server.mjs --mot-de-passe <identifiant>` refusait un compte absent du référentiel — c'est-à-dire
  exactement le cas où l'on n'a plus que cette commande. Elle **crée** désormais le compte (rôle
  administrateur, nom et adresse d'`ADMIN_NOM` / `ADMIN_EMAIL`), et vérifie la politique du mot de
  passe **avant** toute écriture : un mot de passe refusé ne laisse pas derrière lui un compte sans
  accès. Le refus de l'amorçage, lui, dit maintenant les deux gestes qui réparent vraiment
  (`ADMIN_PASSWORD` dans le `.env`, **puis** recréation du conteneur — un redémarrage ne relit pas
  le `.env` —, ou la commande de secours).

### Modifié

- **Les textes suivent le nouveau comportement** : la fenêtre de confirmation dit si les comptes
  sont conservés et pourquoi, et le panneau « Données » ne promet plus d'effacer « tout, comptes
  compris ».

## [1.3.2o] — 2026-09-22 — L'emblème peut avoir sa variante pour le thème sombre

### Ajouté

- **Un second emblème, pour le fond sombre.** L'emblème du référentiel est dessiné pour un fond
  blanc — un blason aux traits sombres, un logo noir détouré — et, posé sur le fond sombre de
  l'application, il devenait illisible ou bavait dans le décor. L'administration peut donc
  désormais prévoir **deux emblèmes** : celui du fond clair (`brand.logoUrl`, inchangé), et sa
  variante (`brand.logoUrlDark`, Administration › Identité, « URL du logo en thème sombre »). La
  variante prend la place de l'emblème ordinaire **partout où l'emblème s'affiche dans
  l'application** : l'en-tête de l'atelier, l'écran de connexion (l'avatar de structure du
  premier compte) et le recueil public. Laissée vide, elle ne change rien : l'emblème ordinaire
  sert dans les deux thèmes, comme avant.
- **Le déploiement peut la poser** (`SCRIBA_IDENTITE_EMBLEME_SOMBRE` du `.env`, ajoutée au
  registre `src/server/mysql/variables.mjs` et au wiki `src/docs/VARIABLES.md`), comme les autres
  réglages d'identité.
- **Le jeu de démonstration porte les deux variantes de son blason** (`src/lib/seed.js`) : même
  écu, mais le galon s'éclaircit — le reste du dessin (ciel, soleil, monts, eau) étant clair, il
  tient sur les deux fonds. Un référentiel de démonstration qui n'a pas encore la variante la
  reçoit par `migrateDemoLogoDark` (`src/lib/store.js`), sans toucher à un emblème choisi par
  l'administrateur.

### Modifié

- **Le choix de l'emblème se fait au RENDU, pas par une requête média.** `prefers-color-scheme`
  aurait été le raccourci tentant, et il est faux ici : le thème de l'application n'est pas celui
  du système — l'agent peut l'imposer depuis le menu du compte, et la requête média l'ignorerait.
  Chaque écran qui montre l'emblème l'appelle donc par `brandLogoUrl(brand)` (`src/lib/theme.js`)
  et se redessine au changement d'apparence (`applyBrand`, `emit`), comme il le fait déjà pour la
  couleur de marque.
- **Le papier ne change pas.** Les pièces d'exécution et les documents compilés gardent l'emblème
  ordinaire : une pièce imprimée sort sur du papier blanc, et son aperçu doit montrer le document
  tel qu'il sera imprimé — c'est déjà la règle pour la couleur de marque.

## [1.3.2] — 2026-09-22 — La connexion aboutit, et chaque panne du service est nommée

### Corrigé

- **« Erreur interne du service » à la connexion, avec les BONS identifiants.** L'ouverture d'une
  session écrivait ses dates dans `sb_session` sous la forme ISO de JavaScript
  (`2026-10-04T12:34:56.789Z`) ; un `DATETIME` de MySQL / MariaDB attend
  `AAAA-MM-JJ hh:mm:ss[.fff]` et **refuse** cette forme — l'`INSERT` levait, et la connexion avec
  lui. Le signe qui ne trompe pas : un mot de passe FAUX répondait normalement (« Identifiant ou mot
  de passe incorrect », un 401), un mot de passe JUSTE tombait en erreur interne, puisque seule une
  connexion réussie écrit une session. Le magasin remet désormais ses dates en objets `Date`, et la
  connexion à la base est déclarée en UTC (`timezone: "Z"`) : les échéances font l'aller-retour
  exactement, et la comparaison des délais reste juste. Le même défaut touchait la date de blocage
  d'un compte (`bloque_jusqua`) et la purge des sessions échues — silencieusement, celle-là, parce
  qu'elle est rattrapée.
- **Un `.env` corrigé restait sans effet après un `docker compose restart`.** `restart` relance le
  MÊME conteneur, avec l'environnement figé à sa création : seul `up -d` (qui recrée) applique un
  fichier modifié. L'exploitant lisait donc des refus incompréhensibles — un `MDP_MIN_LONGUEUR`
  refusé « valeur minimale : 8 » alors que le fichier portait 12, un `ADMIN_PASSWORD` refusé pour sa
  longueur alors qu'il en comptait dix-huit. Le journal ajoute désormais, à côté de toute valeur
  refusée, le rappel qui débloque : **recréer** le service, non le redémarrer. Le conseil
  d'installation ne dit plus « redémarrer » là où il faut recréer (création du compte
  d'administration, application du schéma), et le dépannage porte les deux commandes de
  vérification — `docker compose config` (ce que compose calcule, `.env` compris) et
  `docker compose exec api env` (ce que le conteneur porte) — pour comparer AVANT d'accuser le
  fichier. Le `README` du service rappelait par ailleurs que `AUTH_MODE=demo` est le défaut : c'est
  `password` (le `.env` livré et le compose le posent ainsi).
- **« Access denied for user 'scriba'@… » après un `.env` corrigé, alors que la base répondait
  AVANT.** Le mot de passe d'un compte MariaDB est posé à la **création** du dossier de données :
  corriger `DB_PASSWORD` / `MARIADB_*` ensuite ne le change pas — et recréer l'API lui fait
  présenter le mot de passe neuf, que la base refuse. Le service conseillait « vérifiez DB_USER /
  DB_PASSWORD », ce qui n'aide pas quand on vient précisément de les vérifier. Il nomme maintenant
  la cause, le geste qui répare **sans rien perdre** (remettre l'ancien mot de passe — il est encore
  dans l'environnement du conteneur de base) et celui qui efface (dossier de données vierge). Le
  dépannage porte la commande qui relit cet ancien mot de passe, et rappelle qu'un conteneur `web`
  arrêté suffit à rendre la page inaccessible, indépendamment de la base.
- **« Aucun compte d'administration installé », alors que `ADMIN_LOGIN` et `ADMIN_PASSWORD`
  étaient bel et bien renseignés.** L'écran de connexion portait ce titre dès que l'amorçage avait
  échoué, sans distinguer POURQUOI : il en accusait le `.env`, quand la cause était la base — un
  référentiel de comptes injoignable, table des comptes absente (schéma non appliqué). L'agent
  partait donc corriger une configuration qui n'avait rien de faux. Le service porte désormais le
  fait (`adminPanne`, dans `GET /v1/auth/config`) et l'écran dit la même chose que devant une base
  absente : « Base de données indisponible », le motif, et le remède. Un `ADMIN_PASSWORD`
  réellement refusé par la politique garde, lui, son message et son écran. Le remède rappelle
  aussi le geste qui complète : créer les tables ne suffit pas — le compte d'administration du
  `.env` n'est créé **qu'au démarrage** du service, qu'il faut donc recréer.
- **« Table 'scriba.sb_record' doesn't exist » ne proposait d'abord que l'effacement.** C'est
  pourtant le symptôme d'une première installation à demi faite : la base répond, mais le schéma
  n'y a jamais été appliqué — MariaDB ne rejoue ses scripts d'amorçage que sur un dossier de
  données VIERGE, si bien qu'un dossier initialisé avant que `schema.sql` n'y soit monté reste
  sans tables. Le bandeau de l'écran de connexion (et la réponse `503` de `/v1/db/health`, qui
  porte le même texte) dit maintenant le geste exact — `node server.mjs --migrate`, qui n'efface
  RIEN, ou `AUTO_MIGRATE=true` le temps d'un démarrage — et ne mentionne
  `docker compose down -v`, destructeur, que pour le seul cas qui l'exige : un dossier de données
  initialisé avant qu'on y monte le schéma, quand ces données peuvent être perdues. Un message qui
  propose d'effacer la base avant de proposer de la compléter est un message dangereux. La cause
  « la base n'existe pas » (`DB_NAME` qui ne correspond à rien) a son propre remède, distinct de
  « les identifiants sont refusés » et de « le schéma manque » : trois pannes qu'un même conseil
  confondait.

## [1.3.1] — 2026-09-22 — Délégations, service fiable, réglages déclaratifs

### Ajouté

- **Le guide a un chapitre « Les délégations de signature ».** L'assistant Plume répondait « je ne
  sais pas » à « comment créer une délégation de signature ? » : la matière existait, mais noyée
  dans le chapitre « Préparer et faire évoluer une trame », trop long pour tenir dans ce que
  l'assistant reçoit d'un chapitre. Le chapitre lui est consacré — créer une délégation, les deux
  décisions qui la fondent, la suspendre, les établissements autonomes — et il est désigné comme le
  chapitre de l'écran Délégations.
- **L'organigramme des délégations est un canvas.** On le déplace en le saisissant au curseur, la
  molette règle le cran, et une barre flottante fait les deux — `−`, pourcentage, `+`,
  « Ajuster ». L'arbre s'ouvre à 100 % (le réduire pour le faire tenir entier rendrait ses noms
  illisibles) ; « Ajuster » en donne la vue d'ensemble d'un clic. Un appui sans mouvement reste un
  clic : la fiche de l'acteur s'ouvre comme avant.
- **Le document en rédaction et la trame ouverte se zooment.** Même barre sur la feuille ;
  Ctrl + molette (ou le pincement d'un pavé tactile) y règle aussi le cran, tandis que la molette
  nue continue de faire défiler la page. La feuille s'ajuste d'elle-même à la largeur disponible au
  premier affichage, comme avant, mais le cran choisi ne se perd plus d'un redessin à l'autre.
- **La démonstration est un SEUL commutateur : `DEMO` (déploiement, `.env`).** Jusqu'ici, deux
  notions distinctes cohabitaient : le déploiement décidait de la **connexion** (`AUTH_MODE`,
  `DEMO_ACCOUNTS`), et le référentiel (`brand.demo`) du **bandeau**. Résultat : même en service
  réel, l'application semait et affichait une collectivité fictive. Désormais `DEMO=true` (ou le
  mode « demo », ou `DEMO_ACCOUNTS=true`) installe le jeu livré ; `DEMO=false` fait de l'outil une
  **page vierge** : aucune entité, assemblée, service, personne, rôle, référence, famille, trame,
  acte ni compte, et **aucune mention de la collectivité fictive** nulle part — identité neutre,
  emblème neutre, aide et métadonnées comprises. La première page invite à construire le
  référentiel.
- **« Repartir d'un référentiel vierge »** (Administration › Données) : efface le référentiel, les
  trames, les actes et les comptes du poste, **et** — sur le service partagé — les actes déposés,
  les circuits de signature et les publications (route `POST /v1/admin/purge`, réservée à
  l'administration). C'est la sortie de démonstration : sans elle, basculer `DEMO=false` laisserait
  les données fictives en place, et les publications au recueil public.
- Le champ `DEMO` et le commutateur sont documentés dans les `env.example`, le guide et
  `docs/ADMINISTRATION.md`.
- **Les réglages du référentiel se déclarent dans le `.env`.** Jusqu'ici, l'identité de la
  collectivité, le vocabulaire des actes, la numérotation, les délais, le recueil public et les
  fonctions expérimentales ne se réglaient qu'un clic après l'autre dans l'interface. Le
  déploiement peut désormais les **poser** — `SCRIBA_IDENTITE_NOM`, `SCRIBA_DELAI_RECOURS_MOIS`,
  `SCRIBA_RECUEIL_OPPOSABILITE`, `SCRIBA_PARAPHEUR`… — et ils s'appliquent par-dessus le référentiel
  à chaque démarrage, sans qu'un administrateur ait à les saisir. Une variable vide ou absente ne
  change rien ; une valeur **refusée** (type, choix, borne) n'est **jamais** appliquée en silence :
  elle est journalisée par le service et rendue par `GET /v1/config`.
- **Un registre unique décrit les variables.** `src/server/mysql/variables.mjs` porte, pour chaque
  variable du `.env`, sa portée (service ou référentiel), son type, ses bornes et son rôle. Pour en
  ajouter une : un descripteur, une ligne dans `env.example`, puis régénérer le wiki. La validation
  et le transport au navigateur en découlent — rien à tenir en double.
- **Un wiki des variables.** `src/docs/VARIABLES.md` est **engendré** depuis ce registre
  (`node src/scripts/generer-variables.mjs` : 89 variables) et se lit dans l'application
  (*Documentation technique › Variables de déploiement*). Les secrets (`SMTP_PASS`, `ADMIN_PASSWORD`,
  `API_TOKEN`…) n'y montrent jamais de valeur.
- **Une image Docker autonome.** `src/server/Dockerfile` bâtit un conteneur UNIQUE — service Node,
  façade nginx et code de l'application — publiable sur un registre (Docker Hub, GHCR) et lançable
  d'une commande, sans le dossier du dépôt. `src/docs/DOCKER.md` détaille construction, publication
  (mono- et multi-architecture), lancement et exploitation.
- **Le service valide aussi ses propres variables.** Les réglages de service (`COOKIE_SECURE`,
  `DEMO_ACCOUNTS`, `DEMO`, `AUTO_MIGRATE`) sont lus par le registre : il n'existe plus qu'une
  interprétation par variable, et une valeur douteuse tombe sur le défaut au lieu d'être devinée.

### Modifié

- **L'éditeur de trame occupe désormais toute la fenêtre.** Sa coquille s'allongeait avec son
  contenu (une longue page), si bien que les volets — plan, inspecteur, feuille — ne défilaient
  jamais sur place, alors qu'ils sont écrits pour cela. Ils défilent maintenant dans la fenêtre, et
  le canvas de la feuille a une vraie fenêtre à déplacer.
- **`config.brand.demo` survit comme miroir du déploiement** (il voyage avec les données exportées et
  importées) mais ne décide plus de rien : toutes les décisions passent par `demoActif()`
  (`src/lib/demo.js`). Quand aucun déploiement ne parle (aperçu en ligne, page statique), c'est lui
  qui fait foi. La démonstration active ne change pas d'un iota : même jeu, même bandeau, mêmes
  comptes.
- **`GET /v1/config`** rend les réglages posés (chemins pointés) et les valeurs refusées ; route
  publique, sans secret. L'administration (onglet « Données ») signale combien de réglages le
  déploiement impose.
- **La configuration de l'image Compose suit le registre** : le service `api` reçoit tout le `.env`
  (`env_file`), si bien qu'une variable `SCRIBA_*` ajoutée n'a plus à être recopiée dans le
  `docker-compose.yml`.

### Corrigé

- **Les refus du service s'affichaient « Erreur 403 », sans le motif.** Le service répond
  `{ erreur: "…" }` ; l'application ne lisait que `message` et `error.message`, si bien que
  TOUT refus — service non provisionné, clé invalide, rôle insuffisant, acte non signé — se
  réduisait à un code, muet sur ce qu'il fallait faire. Le motif du service s'affiche désormais tel
  quel. C'est ce qui rend lisible, par exemple, « Ce service n'est pas encore provisionné : aucune
  clé d'écriture n'a été déposée… ».
- **Impossible de créer une délégation de signature quand la décision se saisit à la main.** L'écran
  Délégations demande bien deux décisions — la nomination, puis la délégation —, chacune devant
  porter son **intitulé** ET son **lien**. Mais le champ d'adresse n'apparaissait qu'après avoir
  choisi « Lien externe » : laissée sur « Non renseignée » (l'état initial), la décision laissait
  remplir l'intitulé sans offrir où que ce soit pour écrire l'adresse — et « Créer la délégation »
  refusait alors la délégation en réclamant ce lien, sans que rien ne dise où le saisir. L'adresse
  se saisit désormais chaque fois que la source choisie n'en fournit pas : décision encore sans
  source, ou **référence du référentiel qui ne porte pas la sienne**. Saisir une adresse fait de la
  décision un **lien externe**, et la pastille « D'où vient la décision » le dit à la frappe.
- **La fiche d'une délégation neuve ignorait le délégataire qu'on venait de choisir.** Sa tête
  continuait d'afficher « Délégataire à choisir » — et la section « Compte et signature
  électronique » ne s'ouvrait pas — tant que la fiche n'était pas refermée puis rouverte ; elle
  suit désormais le choix, comme l'aperçu de signature qui, lui, était juste.
- **La fiche d'une délégation suspendue annonçait « Aucune décision renseignée », alors que les deux
  décisions étaient bel et bien saisies** : c'est la suspension qui les neutralise. Elle dit
  maintenant qu'elle est **hors d'effet**, pourquoi (suspendue, échue, à venir), et comment la
  rétablir.
- **« Ajouter une sous-délégation » refermait la fiche du parent** qu'on était en train de lire pour
  ouvrir un formulaire neuf : la chaîne sous les yeux était perdue. La nouvelle fiche s'ouvre
  **par-dessus**, et la première se redessine — la sous-délégation créée comprise — quand la seconde
  se referme. « Échap » ne referme plus que la fenêtre du dessus.
- **L'épinglage disait mal son état.** Le bouton d'un acte déjà à la une gardait le libellé
  « Épingler à la une du recueil public ». Le drapeau vit sur la **publication** pour un acte publié
  — c'est elle que lit le visiteur — et sur l'**acte** pour un acte encore en circuit, et les deux
  peuvent diverger (publication reprise du service, par exemple). Le libellé, la punaise allumée et
  la pastille « à la une » se lisent maintenant sur l'un **ou** l'autre.
- **« Signataire sans adresse » renvoyait au mauvais écran.** Le message envoyait renseigner
  l'adresse « au référentiel », où le référentiel des personnes n'a **pas** de champ courriel :
  l'adresse vit sur le **compte** (« Comptes et rôles »), ou vient de l'annuaire. Le message dit
  désormais ce qui manque au juste — le compte, son courriel, ou le rapprochement — et ouvre
  l'écran où le corriger.
- **Les compteurs s'accordent.** « 1 règles », « 1 champs » : les compteurs de la liste des trames et
  de l'atelier de trame accordaient au pluriel quel que soit le nombre. Ils s'accordent désormais, et
  la phrase « Il manque ici décision de nomination… » porte son article : « la décision de nomination
  (intitulé et lien) et la décision de délégation (lien) ».
- **« Imprimer / PDF » n'immobilise plus l'éditeur.** L'impression partait d'un `window.print()`
  **dans la page de l'application** quand l'onglet dédié n'avait pas pu s'ouvrir ; ce geste bloque
  le fil d'exécution de la page qui l'appelle, si bien que l'aperçu de l'éditeur restait figé tant
  que la boîte d'impression était ouverte. Le document n'est plus jamais imprimé depuis la page : il
  part dans un onglet — qui déclenche lui-même son impression — ou, si le navigateur refuse la
  fenêtre, au **téléchargement** (« ouvrez la page et imprimez-la »).
- **La fiche JSON-LD publiée avec chaque acte portait `"eli:type_document": ""`,** et son autorité
  sans identifiant : le **type d'acte** et l'**entité** n'étaient pas repris dans l'enregistrement
  de publication. Ils le sont.
- **L'amorçage de démonstration ne publiait les actes de la fiction que si TOUS les actes du
  registre étaient des actes de démonstration** : une seule rédaction d'essai — même un brouillon —
  suffisait à laisser le recueil public **vide**, alors que l'écran « Publications (ELI) » en
  listait neuf. Le critère porte désormais sur la **provenance de chaque acte** : seuls les actes
  `acte-demo-…` sont publiés par l'amorçage, quelle que soit la composition du reste du registre.
  La mise à la une, que le service porte sur la publication, est en outre reprise sur l'acte local.
- **Le service auto-hébergé terminait sur CHAQUE réponse.** Une valeur d'en-tête HTTP ne peut pas
  contenir de caractère non-ASCII, et le service signait toutes ses réponses du nom
  « Scribae — service de la collectivité » (tiret cadratin, accents) : `res.writeHead` levait
  `ERR_INVALID_CHAR`, l'exception n'était pas rattrapée, et le processus sortait. Le conteneur
  redémarrait en boucle, nginx servait une page 502, et l'écran de connexion affichait « Le service
  des comptes a refusé la demande. » au lieu d'un vrai refus d'identifiants. L'en-tête porte
  désormais un jeton ASCII (`x-service: scribae`) ; **toutes** les valeurs d'en-tête passent par un
  filtre qui écarte celles qu'un serveur refuserait, et un en-tête refusé se rabat sur un jeu
  minimal au lieu d'abattre le service. Une requête quelconque ne termine donc plus le processus.
- **Un compte d'administration non créé le restait en silence.** Quand `ADMIN_PASSWORD` ne
  satisfaisait pas la politique (12 caractères, trois classes de caractères, ni l'identifiant, ni un
  mot de passe courant), le service refusait de créer le compte et se contentait de l'écrire dans
  ses journaux : l'agent ne voyait qu'« Identifiant ou mot de passe incorrect ». L'état de
  l'amorçage est maintenant **porté jusqu'à l'écran de connexion** (compte d'administration créé ?
  sinon, pourquoi) — comme l'état de la base, quand elle est injoignable ou que son schéma manque.
- **Un démarrage dégradé ne se confond plus avec un registre vide.** Si la base ne répond pas, le
  service le journalise, le dit au client, et ne laisse pas croire à une installation sans données.
- **Un écran ne casse plus quand la réponse n'est pas du JSON.** Une réponse en 502 (page HTML de
  nginx) posait un corps illisible, et « Le recueil est momentanément indisponible » devenait
  « Cannot read properties of null (reading 'publications') ».
- **Le provisionnement d'un service neuf échouait sans recours quand le service se reconstruisait.**
  Le canal se ferme en cours d'opération (code 1011 : l'environnement d'édition recharge son état),
  et le geste se soldait par « WebSocket closed (code 1011) » — sans dire que rien n'avait été écrit,
  ni qu'il suffisait de réessayer. Le provisionnement **rejoue désormais la même clé** (en tirer une
  autre laisserait le service ouvert avec une clé que le poste ne détient pas), reconnaît un service
  « déjà provisionné » quand c'est bien **sa** clé qui l'a ouvert (la réponse a pu se perdre alors
  que le dépôt avait abouti), et, s'il échoue encore, le dit en français. Le service, lui, se
  **reconnecte de lui-même** après une fermeture 1011, au lieu de laisser l'application en erreur
  jusqu'au geste suivant.
- **Les tests du webhook de signature étaient rouges** avant ces travaux (le webhook est devenu
  authentifié, et la réponse au dépôt est devenue concise) : ils portent désormais leur jeton, et
  vérifient aussi qu'un webhook non authentifié est refusé.

## [1.3.0] — 2026-09-21 — Les actes d'assemblée

### Sécurité

- **Le service n'a plus aucune clé écrite dans le code.** Jusqu'ici, la clé d'écriture qui autorisait
  les dépôts, les signatures et les publications était inscrite **en clair dans l'application** —
  donc lisible par quiconque ouvrait la page ou consultait sa source — et ce seul mot de passe
  ouvrait **toutes** les routes, y compris la réécriture des comptes. Un service neuf s'ouvre
  désormais **en lecture seule** : il sert le recueil public, et rien d'autre. La **première clé**
  se dépose une seule fois, depuis *Administration › Base de données* (« Provisionner le service »),
  et c'est le **poste qui la tire au hasard** : le service n'en conserve que l'**empreinte
  SHA-256**, jamais la valeur, et l'écran la montre **une seule fois** — perdue, elle ne se
  remplace qu'en réinstallant l'état du service. Chaque clé porte un **rôle** — `administrateur`,
  `editeur`, `redacteur`, `lecteur`, et `prestataire` pour la seule notification de signature — et
  **chaque route dit le rôle qu'elle exige** : un poste muni d'une clé de rédaction ne peut ni
  publier, ni épingler, ni toucher aux comptes. Les clés se créent (une par poste : « Générer une
  clé de poste »), se listent et se **révoquent** ; le service refuse de révoquer la **dernière clé
  d'administration**, pour ne pas se verrouiller lui-même.

- **Les collections ne se lisent plus sans clé.** Les **comptes** (identifiant, courriel, rôles,
  rattachements, préférences), la configuration et le journal étaient lisibles par **n'importe
  qui** — la route ne demandait aucun jeton. Cette lecture est fermée, et une **sensibilité par
  collection** la règle : les trames et les métadonnées sont publiques, les comptes ne le sont ni en
  lecture ni en écriture. Le public garde exactement ce qui est public : la santé du service, le
  **registre du recueil** (`/v1/publications`), la résolution des identifiants ELI, et l'état de
  l'autorisation (`/v1/auth/etat`, qui ne dit que « provisionné » ou non, et les rôles existants).

- **Le webhook du prestataire de signature est authentifié.** La route qui reçoit l'acte signé était
  **publique** : un tiers pouvait fabriquer un paquet signé portant le nom et la fonction de son
  choix, le présenter, et faire passer un acte à « signée » — puis le publier. Elle exige désormais
  une clé de rôle `prestataire` (ou d'administration), et **le document déposé ne se lit plus sans
  clé** non plus : c'est l'intégrité du circuit qui l'exige, non la commodité.

- **Les documents déposés ne sont plus lisibles par tout le monde.** Les actes dits
  **individuels** — une revalorisation, une sanction — que la loi ne veut pas voir publiés étaient
  protégés **à la publication** mais pas **à la lecture** : leur texte intégral se lisait depuis le
  service, numéro et objet compris. La lecture du dépôt, des circuits de signature et des
  transmissions exige maintenant une clé ; seules les **publications** restent ouvertes — c'est
  exactement ce que la publicité de l'acte suppose.

- **La page d'un acte publié n'exécute plus de code.** La version en ligne reçue du service était
  insérée telle quelle dans la page du recueil : une publication malveillante (ou fautive) faisait
  donc exécuter du script à **tout visiteur** — sur la page d'accueil de la collectivité. Le
  fragment passe désormais par un **assainissement** : liste blanche de balises et d'attributs
  (`<script>`, `<iframe>`, gestionnaires d'événements `on…`, adresses `javascript:`, `vbscript:`
  et `data:text/html` sont retirés), adresses d'images et de liens contrôlées. Le texte publié
  légitime — paragraphes, listes, tableaux, emphases, images — traverse intact.

- **La clé du moteur de langage ne vit plus dans le référentiel.** Elle était enregistrée avec la
  configuration de l'assistant — donc **dans les exports de données et les sauvegardes de la base**.
  C'est un secret : il ne se sauvegarde pas avec les données qu'il permet d'exploiter. Elle est
  désormais conservée **par poste**, dans le stockage du navigateur (comme l'apparence), retirée de
  la configuration à la lecture comme à l'écriture, et **absente de tout export**. Les postes qui
  doivent interroger un moteur saisissent la leur ; l'aide du champ le dit.

- **Ce que le service laisse comme trace.** Chaque geste sensible — dépôt d'acte, ouverture de
  circuit de signature, notification reçue, transmission, publication, retrait, épinglage,
  provisionnement et gestion des clés — laisse une ligne dans un **journal tenu par le SERVICE**,
  et non par le poste qui a fait le geste. Les lignes sont **chaînées par empreinte SHA-256** :
  chacune scelle la précédente et son contenu, si bien qu'une modification rompt la chaîne — et
  l'écran le dit (« Chaîne intègre » / « Chaîne ROMPUE »). Le journal se lit depuis
  *Administration › Base de données* (« Journal d'audit du service »).

- **Le durcissement de l'API et de la façade.** La comparaison des clés est **à temps constant**
  (une comparaison naïve laisserait mesurer l'empreinte attendue, octet par octet) ; chaque réponse
  porte `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` et `Referrer-Policy` ; la
  façade nginx refuse de se laisser **encadrer par un autre site** (`frame-ancestors 'self'`,
  `X-Frame-Options: SAMEORIGIN`) et reprend ses en-têtes sur les chemins qui posent les leurs.

- **À l'installation, les valeurs par défaut sont sûres.** Le déploiement auto-hébergé démarre en
  **comptes locaux avec mot de passe** (`AUTH_MODE=password`) : plus de comptes sans mot de passe
  par simple oubli. Le **CORS est fermé par défaut** (`CORS_ORIGINS` vide : aucun en-tête n'est
  posé, aucun autre site ne peut appeler l'API pour le compte d'un agent). Les images Docker
  (`node:20-alpine`, `mariadb:11`, `nginx:alpine`) sont **épinglées par empreinte** — deux
  installations à deux dates ne partent plus de deux logiciels différents — et la version de
  `mysql2` est **fixée**. Chaque jeton d'API porte désormais un **rôle** (`libellé|rôle:empreinte`),
  au lieu d'un jeton unique tout-puissant.

### Ajouté

- **Une licence, écrite noir sur blanc.** Le dépôt portait un fichier `LICENSE` en GPL-3.0, mais la
  page publique annonçait « tous droits réservés », et rien ne disait ce qu'il en était du **code
  produit par l'IA**. `src/LICENSE.md` tranche les trois objets, qui n'ont ni le même auteur ni le
  même régime : le **logiciel** (GPL-3.0, le fichier `LICENSE` restant à la racine du dépôt), les
  **actes publiés** — qui ne relèvent pas de la licence du logiciel mais de la loi : la
  réutilisation se règle par la **mention de réutilisation** du recueil, par défaut la **Licence
  Ouverte 2.0** (CRPA, art. L. 321-1 et L. 322-6) —, et le **code produit par l'IA**, placé sous la
  même licence que le reste, ses dépendances gardant les leurs (une seule : `mysql2`, MIT). La
  section « Licence » de la page publique du dépôt dit désormais la même chose, et le document se
  lit dans l'application (*Documentation technique › Licence*).

- **Un socle de vérification, exécutable sans navigateur.** Le pari d'architecture — le métier ne
  touche ni au DOM ni au réseau — devient vérifiable : `npm test` éprouve les modules **purs**
  (expressions, assainissement du fragment publié, numérotation, version), `npm run lint` **parse
  tout le JavaScript du dépôt** (`node --check`, sans aucune dépendance : du code qui ne se parse
  pas ne s'exécute pas), et `npm run verifier` enchaîne les deux. Un **pipeline d'intégration
  continue** (`.github/workflows/ci.yml`) les exécute à chaque envoi, avec les tests du domaine du
  service. Tout est décrit dans `src/docs/INDUSTRIALISATION.md`, y compris ce qui **reste à mettre
  en place** (verrou de dépendances, analyse statique, tests de parcours).

- **L'identifiant ELI est une adresse : les liens ELI d'un acte publié mènent à l'acte, dans
  l'instance.** Un acte cite ses fondements par leur **identifiant ELI** (« eli:/fr/arr/2026/0464/vsl ») —
  c'est le visa d'adoption d'une annexe, ou le visa qui rappelle l'acte modificatif. Un identifiant
  n'est pourtant pas une adresse : aucun navigateur ne sait l'ouvrir, et le lien d'un acte publié ne
  menait donc nulle part. Le recueil, lui, **connaît ses actes** : il traduit l'identifiant en
  l'adresse de l'acte visé, et le lecteur reste dans l'instance — la mention écrite (« l'arrêté
  n°… du …, qui l'adopte ») ne change pas, seul le lien devient réel. Deux règles simples : un
  identifiant désigne l'**acte** (et non une version), donc c'est la version **en vigueur** qui est
  atteinte ; un identifiant que le recueil **ne connaît pas** (acte non publié, ou publié ailleurs)
  reste une **mention**, sans lien — un lien qui ne mène nulle part vaut moins que pas de lien. La
  même traduction se fait côté service sur un déploiement auto-hébergé, où la page publiée est servie
  en HTML **sans JavaScript** (voir `src/server/mysql/actes.mjs`).

- **L'identifiant ELI s'ouvre aussi comme une adresse.** Un lecteur qui a un ELI sous les yeux — dans
  un courrier, dans une citation, dans les données ouvertes — l'ouvre désormais d'un clic : sur un
  déploiement auto-hébergé, `/eli/arr/2026/0464/vsl` redirige vers la page de l'acte (le service sait
  résoudre l'identifiant sans JavaScript) ; ailleurs, l'adresse passe par la page (`?eli=…`). Le bloc
  **« Recueil ouvert »** de chaque acte porte cette adresse, à côté de l'adresse de référence et des
  représentations lisibles par machine ; un identifiant inconnu du recueil le dit clairement, plutôt
  que d'échouer en silence.

- **La signature simple : signer dans l'application, sans prestataire branché ni papier.**
  Toutes les collectivités n'ont pas de prestataire branché en API, et toutes ne veulent pas faire
  circuler du papier. Le circuit **simple** comble ce vide : le signataire ouvre l'acte dans Scribae,
  relit le document, coche une déclaration et **signe avec son compte**. La signature est
  cryptographique et horodatée comme dans le circuit électronique (même paquet, même empreinte
  SHA-256, même certificat de démonstration), et le service **vérifie l'empreinte** avant
  d'enregistrer le retour. Ce qui change, c'est ce qui l'accompagne : le nom, la fonction,
  l'**adresse électronique**, le compte, le moyen d'authentification, le poste et l'horodatage sont
  consignés dans la part **INTERNE** de l'original (voir ci-dessous), et les courriels adressés au
  titre de l'acte y sont joints — c'est la trace de **qui** a signé, **quand**, et **de quoi il a
  été averti**. Le circuit se règle comme les autres : Administration › Signature (circuit général),
  ou par trame (`simple_impose`, `simple_autorise`). Le dossier de signature simple s'ouvre depuis
  « Ma signature » (« Vérifier et signer ») comme depuis le circuit de l'acte, et se consulte après
  coup par « Dossier de signature (interne)… ».

- **L'original signé se partage en deux : une part PUBLIQUE, une part INTERNE.** Ce que le recueil
  donne à lire et ce que la collectivité doit pouvoir produire ne sont pas la même chose. La
  **part publique** — diffusée au recueil public, dans l'export JSON de l'original, dans les
  publications et par toutes les routes ouvertes — ne porte que le **nom**, la **fonction** et la
  **date** du signataire ; la **part interne** porte les **mentions nominatives** (adresse
  électronique, personne du référentiel, compte de l'application, compte de signature,
  authentification, poste, adresse réseau) et la **trace des courriels**. Elle est déposée avec la
  publication, rangée au registre, et **n'est servie par aucune route publique** : elle se lit dans
  l'application (« Dossier de signature (interne)… ») ou par la route **protégée**
  `GET /v1/actes/{id}/dossier-signature`, qui exige le jeton. Le circuit électronique en bénéficie
  aussi : ses signataires sont réduits de la même façon.

- **Notification par courriel — le service sait parler à un serveur SMTP.** Scribae n'envoie pas de
  courriel lui-même : il **demande** au service de le faire, et c'est le service qui parle au
  **serveur SMTP** de la collectivité (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_REPLY_TO` — voir `src/server/mysql/env.example`).
  Le **mot de passe SMTP ne quitte jamais le serveur** : l'application ne le voit pas, et l'écran
  d'administration ne montre que l'état de la chaîne. Le moteur SMTP est écrit pour l'occasion
  (`src/server/mysql/smtp.mjs`, RFC 5321/2045/2047 : EHLO, STARTTLS, AUTH LOGIN et PLAIN, encodage
  du sujet, corps en texte **et** en HTML) : pas de dépendance, donc rien à auditer d'autre que ce
  fichier. Six événements peuvent donner lieu à un message — acte à signer, acte signé, acte publié,
  acte à valider, acte à réviser, notification à l'intéressé —, chacun activable, avec un nom
  d'expéditeur, une adresse de réponse et une copie systématique ; Administration › **Courriel**
  règle la politique, montre l'état du serveur et permet un **message d'essai**. Un courriel qui ne
  part pas n'est jamais subi : il est **tracé « non envoyé »**, avec son motif, au journal **et**
  dans le dossier interne de l'acte concerné.

- **Un RÈGLEMENT annexé se publie aussi à part, au recueil, à titre informatif.** Tout ce qu'un acte
  adopte en annexe n'a pas la même valeur : un règlement intérieur, un règlement d'usage — un texte
  **normatif** — se consulte pour lui-même, comme un **code**, et non seulement dans la délibération
  qui l'adopte. Une trame d'annexe peut donc être déclarée **Règlement** (case « C'est un RÈGLEMENT :
  le publier aussi à part, au recueil », onglet « Trame ») : à la publication de l'acte qui l'adopte,
  l'annexe est déposée au recueil sous **son propre identifiant stable** (`eli:/fr/reg/…`, créé au
  premier acte d'adoption puis conservé — les publications successives en sont les **versions**, et
  c'est la dernière qui est en vigueur). La page du règlement se présente comme celle d'un texte
  informatif : ni opposabilité, ni « publié le », ni original signé — seule la décision d'adoption
  fait foi —, mais ses visas (dont celui de son adoption, qui est un lien), son identifiant, son
  thème et l'acte qui l'adopte. Le règlement compte ainsi parmi les publications : il se cherche, se
  classe par thème, et son identifiant s'ouvre directement (`?eli=eli:/fr/reg/2026/0418/vsl`, ou
  `/eli/reg/…` sur un déploiement serveur).

### Modifié

- **La documentation dit enfin ce que l'outil fait.** Le guide affirmait que l'assistant « ne signe
  pas à votre place et n'envoie pas les messages » : c'est faux depuis que le circuit de signature
  **simple** existe et que le service sait parler à un SMTP. La page publique affirmait que
  « l'application n'envoie rien à un service tiers » : les assistants interrogent bien un moteur de
  langage, et c'est maintenant dit, avec le tableau des données transmises et de leur destinataire
  (RGPD, art. 13 et 28). La spécification rangeait encore l'assistant dans le **hors périmètre**
  alors qu'il est livré et actif. La documentation d'exploitation écrit noir sur blanc **ce que la
  démonstration n'est pas** : ni un mode de conservation (son état est évinçé par ancienneté, sans
  sauvegarde), ni un service (les dépôts y sont partagés) — une installation qui produit des actes
  réels n'utilise qu'un service dédié ou sa propre base.

- **Une annexe ne porte plus ni l'autorité compétente ni la mention de publication au recueil.** Une
  annexe n'émane pas d'une autorité : elle est **adoptée** par un acte, et c'est cet acte qui se
  publie. Le compilateur retire donc de son document l'**autorité** (« La maire de … ») et la
  **mention de publication au recueil** (« Le présent arrêté est publié au recueil… ») — le bloc de
  signature l'était déjà. Les **visas** sont en revanche conservés : un règlement se fonde sur des
  textes, et le visa de son adoption (« Vu la délibération n°…, qui l'adopte ») le rattache à sa
  décision, où il devient un lien.
- **La recherche du recueil efface ce qui n'est pas un résultat.** Dès qu'une recherche est en
  cours — frappe dans l'entrée, ou choix d'un thème —, le carrousel « Derniers actes administratifs
  publiés » et la grille « Parcourir par thème » s'effacent au profit des seuls résultats ; ils
  reviennent quand on efface la recherche ou les filtres.
- **Le circuit de signature se lit à trois niveaux, et le choix du rédacteur est conservé.** Le
  sélecteur « Circuit de signature » de la rédaction, comme l'aide de l'administration, décrivent
  désormais les **trois** circuits (électronique, simple, externe) ; les trames peuvent imposer ou
  autoriser le circuit simple, en plus des réglages existants. Un acte **engagé** dans un circuit y
  reste, quel que soit le réglage général : le dépôt au service étant commun aux circuits
  électronique et simple, l'acte engagé dans le circuit simple n'est plus relu comme
  « électronique ».
- **Les dossiers d'administration gagnent l'onglet « Courriel »** et l'aide du circuit de signature
  décrit les trois circuits, les cas où l'un s'impose, et ce que chacun laisse au public.

### Corrigé

- **Un acte dont la lecture échoue n'est plus condamné à « Acte introuvable ».** Un service qui
  n'avait pas répondu dans le délai (canal encore froid, page qui vient de se charger) faisait
  afficher « Acte introuvable » — et la lecture n'était jamais retentée. L'écran distingue
  désormais la **panne passagère** de l'acte inconnu (« Le recueil est momentanément
  indisponible »), et propose de **réessayer** ; l'adresse par identifiant ELI (`?eli=…`) suit la
  même règle quand le registre n'a pas pu être lu.

- **L'aperçu du document dans la fenêtre de signature ne débordait pas de son cadre.** Le cadre
  (« 38 vh ») n'avait pas de hauteur contrainte sur son enfant : c'est la fenêtre entière qui
  défilait, et l'aperçu n'en était plus un. Le cadre est désormais celui qui défile.

- **L'espace public porte ses mentions légales et ses mentions d'accessibilité.** Le bas de page du
  recueil se ferme désormais sur ce que la loi attend d'un site public : des **mentions légales**, qui
  rappellent à quelles conditions un acte administratif est **publié, exécutoire et opposable** — la
  publication et la transmission au représentant de l'État valant naissance de l'opposabilité
  (article L. 2131-1 du code général des collectivités territoriales), et le **délai de recours de deux
  mois** à compter de la publication (article R. 421-1 du code de justice administrative) —, et des
  **mentions d'accessibilité**, qui rappellent les obligations du service de communication publique en
  ligne prévues par l'article 47 de la loi n° 2005-102 du 11 février 2005, l'existence de la
  **déclaration d'accessibilité** et du schéma pluriannuel, et la possibilité de **signaler un
  obstacle** — jusqu'à saisir le Défenseur des droits.
  L'administration **écrit** ces mentions (Administration › **Publication** › « Mentions du recueil
  public »), les remplace par un **simple lien** — les mentions légales du site principal de la
  collectivité, sa déclaration d'accessibilité —, ou les **désactive** ; chacune se règle
  indépendamment. Le texte saisi se replie sous son titre dans le pied de page : présent dans la page,
  mais sans envahir le bas du recueil. La démonstration montre les **deux formes** : les mentions
  légales de la Ville de Valmont-sur-Loire y sont écrites, et l'accessibilité renvoie à la déclaration
  publiée sur le site principal.

- **La démonstration est celle d'une collectivité d'une certaine importance.** Le jeu de données
  livré (mairie fictive de Valmont-sur-Loire) passe de dix-sept à **soixante-six actes**, répartis
  sur **vingt et une trames** — nominations et délégations de signature, arrêtés de police, permis
  de construire, marchés d'un établissement autonome, régies, subventions, engagements de dépense,
  avenants, concessions funéraires, occupations du domaine public, environnement, périscolaire,
  conventions, chartes — et il met en avant ce qu'une collectivité montre d'abord :
  - les **ANNEXES**, c'est-à-dire les documents *adoptés*, qui ne se signent ni ne se publient pour
    eux-mêmes : le **règlement d'accès à la restauration scolaire**, la **grille tarifaire des
    services municipaux** (le prix du repas de cantine, de l'accueil du matin et du soir), le
    règlement intérieur du conseil municipal, la charte de la participation citoyenne, et les
    documents joints à une manifestation (plan de circulation et de stationnement, programme,
    déroulé de la cérémonie). Leur texte suit l'original signé de l'acte qui les adopte ;
  - les **ÉVÉNEMENTS À VENIR** : la **fête du village** « Valmont en fête », le **marché de Noël**
    et la **cérémonie commémorative du 11 novembre**, chacun organisé par un arrêté du maire, avec
    son emprise, ses mesures de police et ses annexes — les actes qu'un administré vient consulter.
  Le **recueil public** s'ouvre donc sur quinze actes publiés, dont quatre à la une (le règlement
  de la restauration scolaire, la grille tarifaire, la fête du village et le marché de Noël), et
  huit thèmes. Le registre, lui, montre tout le reste : actes prêts, en attente de révision,
  incomplets ou revenus en brouillon, pour que chaque écran de l'atelier ait de quoi travailler.

- **Le recueil renvoie vers les autres recueils, et vers les sites de référence.** Une collectivité
  n'arrive pas vierge : elle a souvent tenu, avant Scribae, d'**autres recueils**. L'administrateur
  peut désormais les déclarer (Administration › **Publication › Recueils extérieurs et renvois**),
  sous trois natures : un recueil **« bis »** — tenu à part pour une raison technique (une entité
  autonome, un périmètre séparé) —, un recueil **inactif** — qui n'est plus alimenté —, pour lequel
  on précise la **période** couverte (« actes publiés du … au … »), plusieurs recueils inactifs
  pouvant se succéder au fil des changements de logiciel, et un **site de référence** (Légifrance,
  service-public.gouv.fr). Chaque renvoi porte un **libellé**, une **adresse** et une **précision**
  facultative ; on les ordonne et on les retire, et un bouton **« Rétablir les renvois livrés »**
  fait revenir Légifrance et service-public.gouv.fr. Ces renvois s'affichent **en bas de page** de
  l'espace public et **à la fin des résultats de recherche**, sous le titre **« Vous ne trouvez pas
  ce que vous recherchez ? »** — jamais deux fois sur la même page. Le **guide** en explique l'usage
  (chapitre « Publier l'acte »).

- **Un document Word ou LibreOffice devient une trame.** Le bouton **« Importer une trame »**
  accepte désormais un **document Word** (`.docx`) ou **LibreOffice** (`.odt`), en plus du
  fichier de trames JSON. L'application **relit le document** — sans rien installer — et en
  reconnaît la structure d'un acte : ligne d'autorité (celle de la collectivité, la ligne d'État
  n'étant retenue qu'à défaut), intitulé (dont le numéro, la date et le « portant … » deviennent
  `{{numero}}`, `{{dateSignature}}` et `{{objet}}`, et dont l'objet donne son nom à la trame),
  visas, considérants, formule d'édiction (qui décide du **type d'acte**), articles, divisions
  (Livre, Titre, Chapitre, Section), listes — celles du traitement de texte comme celles écrites
  à la main en « 1° », « 1) », « a) » —, tableaux, mention de recours et bloc de signature. Le
  signataire du document n'est jamais repris (il vient du champ « Signataire »). **Rien n'est
  enregistré** : la trame proposée s'ouvre dans l'éditeur, précédée d'une bande qui le rappelle,
  accompagnée de ses **points à vérifier** (ce que la relecture a décidé, et ce qu'elle n'a pas
  su faire), et l'éditeur choisit de l'enregistrer ou de l'abandonner. Une lecture automatique
  propose, elle ne décide pas.

- **Une trame reste en brouillon jusqu'à sa mise à disposition.** C'est la règle générale : un
  modèle se prépare à l'abri, puis s'ouvre. Tant qu'un éditeur n'a pas cliqué **« Mettre à
  disposition »**, la trame n'apparaît pas dans **« Rédiger un acte »** et son ouverture directe
  est refusée (sauf à un éditeur, qui doit pouvoir essayer son modèle, et sauf pour une rédaction
  déjà commencée). Le bouton — carte de la trame, bannière et en-tête de l'éditeur de trame,
  champ **« Statut »** de l'onglet « Trame » — est le même partout, et le geste inverse
  (« **Retirer** ») rebascule la trame en brouillon sans toucher aux actes déjà rédigés à partir
  d'elle. Les deux sont inscrits au **journal** (`trame.disponible` / `trame.retiree`). Une trame
  **créée, dupliquée ou importée** arrive donc toujours en brouillon ; le badge de son statut dit
  « **Mise à disposition** », et l'éditeur de trame porte une bande de tête quand elle est encore
  en brouillon.

- **Épingler un acte, et le recueil public le met à la une.** L'onglet **Actes** porte, sur
  chaque acte publiable, un bouton **punaise** (permission `publications.epingler`, rôles
  administrateur et éditeur) qui le fait entrer — ou sortir — de la bande **« À la une »** du
  **recueil public**. La bande s'affiche sur la page d'accueil du recueil, au-dessus du carrousel
  des derniers actes (qui, lui, ne les répète pas) : c'est la place d'un **règlement intérieur**,
  d'une charte, du document qu'un visiteur vient chercher. Elle s'efface dès qu'une recherche ou
  un filtre est posé, et ne montre que les versions en vigueur. On peut épingler un acte **avant**
  sa publication : son drapeau part avec la version déposée. Le drapeau suit l'**ACTE** (son
  identifiant ELI), non la version publiée : un acte **modifié ou consolidé reste à la une** — la
  route `POST /v1/publications/{cle}/epingle` le pose sur toutes les versions et la publication
  suivante l'hérite. Le geste est réversible, audit-é au journal (`publication.epingle` /
  `publication.desepingle`), et le service auto-hébergé (Node/MySQL) comme celui de
  l'environnement d'édition l'exposent à l'identique ; le jeu de démonstration épingle la
  délibération qui adopte le règlement intérieur.

- **Chaque bloc de texte a désormais ses propres réglages — et un tableau ou une liste s'éditent
  vraiment.** Un **paragraphe** règle son alignement, son retrait (alinéa, ou paragraphe entier en
  retrait) et son encadré ; une **liste** choisit ses puces (ronde, creuse, carrée, tiret, aucune)
  ou sa numérotation (« 1. », « 1° », « 1) », « a) », « A) », « i. », « I. ») et son numéro de
  départ ; un **tableau** place sa légende au-dessus ou au-dessous, affiche ou non sa ligne
  d'en-tête, se dessine en quadrillage, en lignes horizontales seules ou en lignes alternées, et
  aligne ses cellules ; des **considérants** reçoivent la formule qui les introduit (« Considérant
  que… », jamais répétée si le texte la porte déjà), leur ponctuation finale et le choix de se lire
  d'un seul alinéa. Tout se règle **bloc par bloc** — dans l'éditeur de trame (onglet « Ce bloc »)
  comme par la rédaction (panneau « Mise en forme ») — et la valeur « comme la feuille de style »
  laisse la charte de la collectivité décider : c'est ce que fait tout bloc qui ne demande rien de
  particulier, y compris ceux qui existaient avant cette version. Les réglages suivent partout :
  aperçu, atelier, PDF, Word, HTML autonome, Markdown, Akoma Ntoso, et les réglages ajustés par la
  rédaction sont signalés comme des écarts, lus en clair (« MODÈLE 1° 2° 3° / VOUS a) b) c) »).
  L'aperçu d'édition montre le réglage aussitôt — la formule et la ponctuation des considérants y
  sont écrites en gris, telles que le compilateur les ajoutera.

- **Un tableau s'édite dans le document, une liste aussi.** Dans l'éditeur de trame, le tableau de
  l'aperçu n'est plus une image : chaque case se réécrit (jetons de champs compris), une gouttière
  offre d'**insérer ou retirer** chacune de ses colonnes et chacune de ses lignes, et une barre
  ajoute une colonne ou une ligne à la fin ; l'inspecteur donne en plus la **grille complète** —
  une case par cellule, et de quoi déplacer, retirer ou ajouter lignes et colonnes. Une liste gagne
  les mêmes gestes sur chacun de ses éléments (« + » pour insérer le suivant, corbeille pour le
  retirer) et se termine par « Ajouter un élément ». Aucune de ces commandes n'appartient à l'acte :
  l'impression les efface toutes.

- **Des vrais comptes, avec mot de passe — sans annuaire et sans service à installer.** Une
  collectivité qui n'a pas d'annuaire à brancher pouvait jusqu'ici soit choisir un compte dans une
  liste (démonstration), soit brancher OpenID Connect. Il y a désormais un troisième mode, activé
  dans le `.env` du déploiement (`AUTH_MODE=password`) : **identifiant et mot de passe**, que le
  service vérifie lui-même, et une **session** dans un cookie `HttpOnly`. Rien ne fuit : le service
  ne conserve qu'un **dérivé `scrypt`** scellé (sel et paramètres compris dans la chaîne), jamais le
  mot de passe ; la comparaison est à temps constant ; le message ne dit jamais si l'identifiant
  existe ; après cinq échecs le compte se ferme un instant (de plus en plus longtemps, plafond
  15 minutes). Côté navigateur, l'écran de connexion gagne l'identifiant, le mot de passe avec son
  œil, et un **jeton anti-CSRF** accompagne chaque écriture (double envoi cookie + en-tête), parce
  que le cookie de session, lui, est invisible du JavaScript. Le **compte d'administration** se
  configure dans le `.env` (`ADMIN_LOGIN`, `ADMIN_PASSWORD`) et se crée au premier démarrage ; il
  crée ensuite les autres depuis *Comptes et rôles* — chaque nouveau compte enchaîne sur la remise
  de son mot de passe, et un compte sans mot de passe ne peut pas se connecter. Un administrateur
  enfermé dehors se dépêtre en ligne de commande :
  `node server.mjs --mot-de-passe <identifiant>` (le mot de passe est lu sur l'entrée standard). La
  fenêtre d'administration d'un compte dit l'état de son mot de passe (défini, provisoire, bloqué,
  dernière remise, tentatives manquées) et permet d'en **engendrer un provisoire** — le service le
  montre **une seule fois**, à transmettre par un canal sûr, et exige son changement à la première
  connexion. Le **mode démonstration** se règle dans le même `.env` (`DEMO_ACCOUNTS`) : fermé par
  défaut en mode mot de passe, il peut rester ouvert pour une recette — l'écran de connexion garde
  alors le raccourci « choisir un compte », servi par le service. Les jetons d'API ne sont plus
  acceptés dans ce mode : une écriture sans session est refusée, un jeton écrit dans une page
  publique ne pouvant rien protéger.

- **L'atelier de rédaction se pilote comme un traitement de texte.** Quatre gestes manquaient, et
  ils sont là. **Cliquer un bloc ouvre ses options** dans le panneau de droite : un onglet « Bloc »
  apparaît, avec ce que le bloc est (article, division, paragraphe, visas…), d'où il vient, son
  **intitulé**, son **numéro** (automatique ou écrit à la main), son **échelon** pour une division,
  ses **éléments** (les visas, les considérants, les items d'une liste, qu'on y écrit, qu'on y
  déplace et qu'on y supprime), ce qu'on peut **ajouter dedans**, et de quoi le déplacer ou le
  retirer. **Supprimer un bloc se fait d'un clic** : la corbeille est sur le bloc lui-même, et
  « Contrôle & écarts » le rétablit à tout moment — le bloc n'est jamais retiré de la trame, il est
  retiré du document. **Ajouter un paragraphe, un visa, un considérant ou un élément** se fait sans
  quitter le document : un « + » sur chaque élément insère le suivant, un bouton « Ajouter un visa »
  ferme chaque liste, et le panneau du bloc propose les ajouts qui ont un sens à cet endroit-là. Ce
  qui est ajouté ou retiré est un **geste de rédaction, non une modification du modèle** : la trame
  reste intacte, et l'onglet « Contrôle & écarts » tient la liste de ce qui a changé — chaque ligne
  pouvant être rétablie ou retirée d'un clic. Enfin, une **bibliothèque de variables** ouvre le
  panneau de droite : les champs de la trame et les informations que l'application remplit seule
  (la collectivité, le signataire, la date, le numéro…), cherchables, et qu'on **glisse dans le
  document** — ou qu'on clique pour les poser d'un clic dans le texte. Les blocs d'un même article
  reçoivent, au passage, la même barre d'outils que ceux du corps du document : ils se déplacent,
  se commentent et se suppriment comme les autres.
- **Réorganiser le document, d'un geste.** Dans l'atelier de rédaction, chaque bloc du document —
  un article, une division, un visa, un considérant, une mention — se **déplace** désormais pour de
  bon : deux flèches sur le bloc, ou une prise pour le **glisser** à sa place (la poignée, ou le
  numéro de l'article, qui est la prise naturelle : c'est ce qu'on vise en pensant « cet
  article-là »). Le texte déplacé est **renuméroté** — remonter l'article 3 en tête en fait
  l'article 1er —, mais seuls les numéros que l'application attribue bougent : un numéro écrit à
  la main reste ce qu'il est. Le déplacement est un geste de rédaction, pas une modification de la
  trame : le modèle est intact, et l'onglet « Contrôle » dit ce qui a bougé et le défait d'un clic
  (« Ranger comme la trame »). Un bloc de tête (l'intitulé, l'auteur de l'acte) ne se déplace pas :
  il est à sa place par nature.
- **Les divisions : un texte ne se compose pas que d'articles.** Une trame peut désormais ranger
  son contenu en **Livres, Titres, Chapitres, Sections** — et sous le mot qu'elle veut (« Partie »,
  « Chapitre liminaire », « Annexe »…), puisque **l'échelle des divisions appartient à la trame**,
  non au logiciel : l'onglet « Trame » de l'éditeur en règle le nombre d'échelons, le mot de
  chacun et sa façon de numéroter (chiffres romains, arabes, lettres, ou rien). La hiérarchie est
  ainsi **pré-intégrée au modèle** : dans le document, une division se place à l'un de ces
  échelons, en contient d'autres ou des articles, et la numérotation suit — « Livre Ier »,
  « Titre Ier », « Titre II », « Livre II »… puis le compte repart pour chaque échelon ouvert.
- **Les annexes : un document adopté par un autre, publié à part.** Un règlement intérieur adopté
  par une délibération, une grille tarifaire adoptée par une décision : le document **annexé** ne
  tient pas son existence de lui-même. Une trame peut donc se déclarer de nature **Annexe**
  (onglet « Trame »), et trois choses s'ensuivent. À la rédaction, l'annexe **désigne l'acte qui
  l'adopte**, et cet acte **lui est rappelé en tête de ses visas** (« Vu la délibération n°… du …,
  qui l'adopte ; ») ; réciproquement, l'acte qui adopte **annonce ses annexes** à la fin de son
  dispositif. À la fiche de l'acte, un encart dit **d'où le document vient** (l'acte d'adoption) et
  **ce qu'il annexe**, avec un lien vers l'autre fiche. En ligne, la version publiée porte le même
  encart, puisque l'annexe est publiée **séparément**, sous son propre identifiant ELI.
- **Modifier une annexe : l'adoption d'une nouvelle rédaction.** Une annexe ne se modifie pas
  article par article comme un acte ordinaire. L'écran « Modifier » ouvre donc, pour elle, le
  régime qui lui convient : l'acte modificatif **adopte la nouvelle rédaction** de l'annexe
  (« … portant adoption de la nouvelle rédaction du règlement intérieur n°… »), l'article premier
  énonce cette adoption, et le texte, présenté **en suivi des modifications**, part avec l'acte
  comme une annexe à publier. L'annexe est ensuite modifiée par ce même chemin, et sa fiche
  enregistre l'acte qui vient de l'adopter. La modification **classique** (mention expresse,
  article par article) reste à un clic : c'est elle que demande parfois une décision qui vise
  expressément tel article.
- **La démonstration montre le mécanisme.** Deux trames et deux actes s'ajoutent à la
  démonstration : une **délibération** et le **règlement intérieur** qu'elle adopte — un document
  de nature « Annexe », rangé en **Titres** et **Chapitres**, muni du **visa de son acte
  d'adoption**, annoncé en fin de dispositif de la délibération, publié **séparément** sous son
  propre identifiant ELI. Les trames de division et d'annexe ne sont plus seulement décrites :
  elles se visitent.

- **L'assistant répond même sans moteur de langage.** Quand aucun moteur n'est branché — sur une
  page servie en statique (GitHub Pages), ou un déploiement sans API —, Plume et Publia ne
  restent plus muets : ils **cherchent** la réponse dans ce qu'ils savent. Plume rend le chapitre
  du guide qui traite de la question, avec son lien ; Publia retrouve les actes publiés qui y
  correspondent, avec leurs dates, leur identifiant ELI et leur lien — et l'acte que le lecteur
  consulte passe devant. Aucun appel réseau, aucune clé, rien à installer : rien de ce que l'on
  demande ne sort du navigateur. Ce sont des **extraits, pas des réponses rédigées**, et l'écran
  le dit dans une note discrète ; dès qu'une adresse de moteur est renseignée (ou sur Perchance),
  la rédaction reprend la main sans qu'on ait rien d'autre à changer.

- **Signer sur papier (ou par un outil tiers) : le circuit de signature externe.** Tout ne passe pas
  par un prestataire branché en API. Beaucoup de collectivités font signer leurs actes **sur
  papier** — ou par un outil que l'application ne pilote pas. Un second circuit existe donc, qui
  n'appelle **aucune** API de signature : le rédacteur « **envoie à signature** », ce qui veut ici
  dire **télécharger** le document prêt à signer (une page A4, avec son **bordereau de remise** :
  référence, objet, entité, trame, empreinte du document remis et marche à suivre) ; le signataire
  signe **hors de l'application** (stylo, ou outil tiers) ; le rédacteur **rentre la version signée
  dans la base** — « **Ajouter la version signée** », un **PDF**, dont l'empreinte SHA-256 est
  calculée à la volée et le fichier déposé ; et le **réviseur certifie la conformité** de la
  **pièce signée** avec la version numérique qui sera publiée. Son contrôle change de nature : dans
  ce circuit, il ne porte plus sur le texte **avant** signature, mais sur le document **signé** —
  c'est ce qui garantit que ce qui est publié est bien ce qui a été signé. La certification est
  entourée de garde-fous : elle se donne point par point (signataire, conformité du texte,
  intégrité de la pièce, date), un **refus** exige un motif écrit et renvoie l'acte attendre une
  version signée conforme, et une **nouvelle** version signée annule la certification précédente.
  Le circuit se règle à **deux niveaux**, et rien n'est codé en dur : **globalement**
  (Administration › Signature : circuit électronique, le défaut historique, ou circuit externe),
  et **par trame** (onglet « Trame » de l'éditeur : *suivre le réglage général*, *circuit externe
  **imposé***, *circuit externe **autorisé*** — le rédacteur choisit alors, acte par acte, entre
  les deux —, ou *circuit électronique imposé*). Un acte **déjà engagé** dans un circuit y reste
  quoi qu'il arrive ensuite : changer le réglage ne déplace pas un acte en cours de route. Sur le
  **recueil public**, l'« original » d'un acte ainsi signé n'est plus un paquet JSON mais **la
  version signée elle-même** : le PDF est montré dans la page, tel qu'il a été mis en ligne, avec
  l'attestation de conformité du réviseur — c'est **lui** qui fait foi, le texte en ligne n'en
  étant qu'une lecture pratique. Le service tient les mêmes règles de son côté (nouvelles routes
  `POST /v1/actes/{id}/signature-externe` et `POST /v1/actes/{id}/conformite`, refus de publier
  tant que la version signée manque — 409 `version_signee_absente` — ou que la conformité n'est
  pas certifiée quand un réviseur est compétent — 409 `conformite_non_certifiee`) ; et les actes
  dont la conformité est à certifier sont **ouverts aux réviseurs compétents**, même hors de leur
  périmètre, sans quoi leur contrôle ne pourrait jamais s'exercer.

- **Commenter un article, ou un passage — et ne plus pouvoir rater un commentaire.** Le commentaire
  d'une trame se posait par l'inspecteur, sur le bloc sélectionné ; en dehors de ce panneau, il ne
  se voyait nulle part. Deux gestes lui rendent sa place, et l'un ne va pas sans l'autre.
  **On commente ce qu'on voit** : un bouton « commenter » est posé sur chaque bloc de la page, et —
  pour viser une phrase précise — il suffit de **sélectionner le passage** dans le document, ce qui
  fait apparaître une pastille **« Commenter »** qui ouvre la fenêtre d'écriture **en citant le
  passage choisi**. **On ne peut plus les manquer** : le commentaire s'affiche **dans la page**,
  sous le bloc qu'il vise, en bande nettement distincte du texte de l'acte (fond coloré, filet
  pointillé, nature et auteur rappelés, passage cité en italique) ; un **repère de marge** numéroté
  marque chaque bloc commenté ; l'en-tête de l'éditeur annonce le compte et ouvre la liste d'un
  clic ; et un onglet **« Commentaires »** les rassemble tous, rangés par bloc, chacun menant au
  passage qu'il vise. À la **rédaction**, les consignes laissées par les administrateurs
  apparaissent de la même façon **sous le passage concerné**, en lecture seule, avec un onglet
  « Consignes » et un compteur cliquable dans l'en-tête de l'acte : le rédacteur ne peut plus les
  ignorer. Le passage cité accompagne le commentaire partout — aperçu, inspecteur, exports Akoma
  Ntoso et Markdown, rapport de conformité.

### Modifié

- **La page d'accueil du logiciel est le recueil public.** Ouvrir l'adresse de l'installation
  — sans ancre ni paramètre — menait à l'atelier : un visiteur tombait donc sur l'écran de
  connexion, et l'installation se présentait par sa porte de service. C'est le **recueil des actes
  publiés** qui s'ouvre désormais : la page que le public peut lire, et que l'on peut citer. La
  route par défaut est `recueil` (`src/ui/state.js`), si bien que le premier chargement, l'adresse
  nue, l'ancre vide (`#/`) et **toute adresse inconnue** — une ancre mal recopiée, un écran qui
  n'existe plus — mènent à la page d'accueil du site, et non à l'atelier (`normaliserRoute`,
  `src/ui/app.js`). L'atelier reste à un clic : la porte **« Se connecter »** de l'en-tête du
  recueil, ou l'ancre `#/trames` (que l'application n'écrit jamais elle-même). L'écran de connexion
  n'est pas pour autant un cul-de-sac : il porte une porte **« Consulter le recueil public »**. Rien
  d'autre ne change : le recueil ne suppose aucun compte, et un agent connecté y lit exactement ce
  que lit un passant.

- **L'emblème de la commune a été redessiné.** Le blason de la ville fictive de Valmont-sur-Loire
  — un écu français, un soleil d'or, deux monts et la Loire — était juste dans ses parties mais
  approximatif dans son dessin : des rais trop longs et trop écartés du disque solaire, des cimes
  enneigées trop fines, et des filets clairs là où deux aplats voisins partageaient un bord.
  Il est repris : rais courts et rapprochés, cimes enneigées lisibles, galon unique, et un liseré
  de leur propre couleur sur les cimes et les bandes d'eau — c'est ce liseré qui efface le filet
  que l'anticrénelage laisse entre deux aplats. L'emblème paraît dans l'en-tête, sur l'écran de
  connexion, dans le guide et sur le recueil public ; c'est le référentiel qui le porte
  (`brand.logoUrl`), et un référentiel de démonstration reprend celui du jeu livré.

- **L'amorçage du recueil public se fait par étapes, et sait reprendre.** Publier la démonstration
  demande de déposer puis de publier chaque acte sur le service, un par un. Les actes s'enchaînaient
  sans respiration, et le service — tenu à un budget de calcul soutenu — finissait par refuser ses
  gestionnaires. L'amorçage marque désormais une **pause entre deux actes**, s'arrête après deux
  échecs consécutifs plutôt que d'attendre une réponse qui ne viendra pas, et reprend au démarrage
  suivant là où il s'était arrêté (ce que le service détient déjà n'est jamais redéposé). Il publie
  par ailleurs **quinze actes choisis** — les six annexes, les trois événements, et un document de
  chacune des autres familles — au lieu de tous ceux que la fiction déclare publiés : la
  démonstration s'ouvre plus vite, et le recueil montre toujours toute la variété.

- **La connexion ne charge plus rien avant d'avoir identifié l'agent.** En mode « comptes locaux »,
  le référentiel est protégé : l'application interroge d'abord le service (`GET /v1/auth/config`),
  et ne demande **aucune donnée** tant qu'aucune session n'est ouverte — l'écran de connexion se
  dessine avec la marque par défaut, et la liste des comptes ne vient plus du référentiel mais de la
  session ouverte. Corollaire : un référentiel neuf, sur un déploiement qui ferme les comptes de
  démonstration, ne reçoit **plus** les comptes fictifs (ils n'auraient pas de mot de passe) ; un
  nouveau compte créé dans *Comptes et rôles* enchaîne directement sur la remise de son mot de
  passe ; et « Ouvrir une session » (le raccourci de démonstration d'une ligne du tableau) disparaît
  dans ce mode, puisque seule une session ouverte par le service donne accès aux données. Le menu du
  compte porte « **Changer mon mot de passe** » et « Se déconnecter » (au lieu de « Changer de
  compte »), et le changement de mot de passe est proposé d'office quand le mot de passe est
  provisoire — sans jamais enfermer l'agent, qui peut reporter le geste.
- **Une annexe ne se signe pas : son texte suit l'acte qui l'adopte.** Jusqu'ici, une annexe (un
  règlement intérieur adopté par une délibération, une grille tarifaire adoptée par une décision)
  était traitée comme un acte à part entière : elle se signait, se publiait sous son propre
  identifiant ELI, et l'acte qui l'adoptait se contentait de l'annoncer. Ce n'est pas la règle :
  **l'annexe ne tient pas son autorité d'elle-même**. C'est **l'acte qui l'adopte** qui est signé, et
  **l'original signé de cet acte est désormais suivi du texte de l'annexe**, dans le même document,
  à la suite de la signature et **sur une page neuve**. Concrètement : le document d'une annexe ne
  porte plus de bloc de signature et son atelier ne demande plus de signataire (son champ de date
  devient « Date d'adoption ») ; l'acte d'adoption affiche le texte de ses annexes **en lecture
  seule sous le document**, avec un bouton qui mène à l'annexe dans son propre acte ; l'écran
  « Signature & publication » d'une annexe ne propose plus ni envoi en signature ni publication —
  il renvoie vers l'acte d'adoption ; et les exports (HTML, Word, Markdown, Akoma Ntoso
  `<attachments>`, impression) portent cette partie annexée. Le rapport de conformité et le schéma
  Schematron savent qu'une annexe n'a ni signataire ni bloc de signature. La **nature du document**
  voyage aussi avec l'export Akoma Ntoso (`<ia:nature>`, relu à l'import), et **le lecteur AKN
  signale** — au lieu de le taire — qu'un fichier est suivi du texte de ses annexes
  (`<attachments>`) : une annexe demeure un acte à part, joint à son acte d'adoption depuis le
  registre. Dans la démonstration, le
  règlement intérieur n'est plus signé ni publié à part : c'est la délibération qui l'adopte (et son
  original) qui les porte.

- **Les écarts à la trame se lisent désormais par nature.** Un écart n'était qu'un texte réécrit.
  L'onglet « Contrôle & écarts » distingue maintenant trois choses, chacune dite avec ses mots et
  défaite d'un clic : les **réécritures** (« modèle » / « vous »), les **réglages de bloc
  modifiés** (l'échelon d'une division, sa numérotation) et les **changements de structure** (un
  bloc ou un élément ajouté, un passage retiré). Rien n'est bloqué : ce qu'un rédacteur adapte est
  conservé, et ce qu'il ajoute ou retire est conservé aussi — mais jamais sans trace.

- **L'acte est nommé comme le référentiel le nomme.** La fiche d'un acte, et les actes
  modificatifs qui le visent, l'appellent désormais par son **appellation** — « Règlement
  intérieur n° 2026-77 » plutôt que « Acte n° 2026-77 », « Vu la délibération n°… du… » plutôt que
  par un mot générique. L'appellation vient du **type d'acte** de la trame
  (Administration › Référentiel › Types d'actes) : c'est le vocabulaire de la collectivité, et il
  commande aussi le genre de l'article défini (« le règlement », « la délibération », « l'arrêté »).

- **La page d'accueil du dépôt dit ce que font les assistants, et comment les brancher.** La
  section « Installer » (GitHub Pages) précise qu'à cette forme les assistants répondent **sans
  moteur de langage** — ils retrouvent le chapitre du guide ou l'acte publié — et comment donner
  à une collectivité des réponses rédigées, en renseignant l'adresse de son API de langage
  (Administration › Assistants).

- **Le guide montre l'atelier tel qu'il est.** Les deux captures du chapitre « Écrire un acte, pas
  à pas » (« L'écran de rédaction » et « Le panneau Contrôle & écarts ») dataient d'avant la
  bibliothèque de variables, l'onglet « Bloc » et les outils de structure : elles sont refaites, et
  leurs repères numérotés montrent désormais la barre d'outils d'un bloc, la bibliothèque de
  variables, le panneau du bloc désigné et les trois registres du contrôle.

- **Le guide et l'onglet « Annuaire » expliquent les trois façons de se connecter.** Un
  administrateur qui cherche où se règlent les comptes à mot de passe trouve la réponse là où il
  cherche : le chapitre du guide s'intitule désormais **« Ouvrir les sessions : annuaire, ou comptes
  locaux »**, et y décrit les **comptes locaux** (identifiant, mot de passe, mot de passe provisoire
  à changer à la première connexion) à côté de l'annuaire, en rappelant que ce mode **n'a pas
  d'écran** — il se règle dans le `.env` du déploiement (`AUTH_MODE=password`,
  `ADMIN_LOGIN`/`ADMIN_PASSWORD`, `DEMO_ACCOUNTS`). Dans **Administration › Annuaire (OIDC)**, le
  mode « Comptes locaux (mot de passe) » **n'est plus offert au choix du référentiel** — un mode qui
  dépend du service ne s'y décide pas, et le proposer aurait pu enfermer dehors un administrateur
  exigeant un mot de passe que rien ne vérifie ; et quand le déploiement l'impose, l'onglet l'annonce
  et précise que les comptes de démonstration sont, là aussi, l'affaire du `.env`.

- **Une annexe n'a plus de numéro.** C'est la suite logique de son régime : puisqu'elle n'est ni
  signée ni publiée pour elle-même, elle n'occupe aucune place au recueil — un numéro n'aurait rien
  à identifier. Son identité, c'est la **décision** qui la fait exister : celle qui l'**adopte**,
  celle qui en adopte la **nouvelle rédaction** (sa modification) ou celle qui l'**abroge**. Là où
  un acte ordinaire montre « n° 2026-416-VSL », l'annexe montre à quoi elle tient — « **Annexe à la
  délibération n° 2026-416-VSL du 24 septembre 2026** » sur sa fiche, « annexe à 2026-416-VSL » dans
  le registre, « **Annexe — Règlement intérieur du conseil municipal** » dans une liste. Elle garde
  un identifiant **interne** (liens, historique), invisible du lecteur. Concrètement : l'atelier ne
  lui propose **ni champ ni variable** de numéro (donc **aucun numéro n'est consommé**, dans
  l'application comme auprès d'un service de numérotation), la compilation ne lui donne **pas d'ELI**
  et son Schematron ne réclame pas de numéro, et les tournures de modification la désignent par sa
  décision : « portant adoption de la nouvelle rédaction **du règlement (la délibération n° … du …)** ».
  La trame du règlement, dans la démonstration, en est dépouillée.

### Corrigé

- **La formule d'un considérant ne se répète plus.** Un considérant dont le texte commence par
  l'**élision** de la formule du bloc — « **Considérant qu'**il est nécessaire… » sous la formule
  « Considérant que » — recevait la formule une seconde fois, et le document signé s'ouvrait sur
  « Considérant que Considérant qu'il est nécessaire… ». Le moteur d'assemblage compare désormais le
  début du texte à la formule **élidée** comme à la formule entière, ainsi qu'à ses ponctuations
  (« Considérant, ») : un considérant qui porte déjà la formule la garde telle qu'elle est écrite,
  et rien ne s'y ajoute. Deux actes du jeu de démonstration portaient la faute dans leur document
  signé ; un nouveau jeu de données les régénère.

- **Le recueil de démonstration se remplit même quand le service répond en retard.** L'amorçage
  part au démarrage, en même temps que le reste de l'application : si la page est alors occupée (un
  jeu de démonstration à reconstruire, un registre volumineux à écrire) ou que le canal du service
  n'est pas encore ouvert, la première lecture du recueil échouait, et le recueil restait **vide de
  toute la session** — rien à démontrer. Cet amorçage est désormais **repris** quelques fois, à
  intervalles croissants, tant qu'il reste des actes à publier ; comme il ne redépose jamais ce que
  le service détient déjà, une reprise ne produit ni doublon ni republication.

- **L'état durable du service ne se relit plus corrompu.** Le service de démonstration range tout
  son état dans un document JSON unique, écrit dans la mémoire durable qui lui est allouée. Deux
  défauts se conjuguaient : l'écriture se faisait sur place, si bien qu'un instantané prélevé au
  milieu du geste (l'environnement peut en prendre à tout moment) donnait un document tronqué —
  relu ensuite en entier, pour rien, jusqu'à épuiser le budget de calcul d'un gestionnaire ; et
  l'état, plein d'accents, traversait une couche de persistance qui n'est pas garantie binaire. La
  version est désormais **effacée avant la première écriture et rétablie en dernier** : un état
  relu au milieu du geste se reconnaît à sa version, sans rien relire. La lecture contrôle
  l'en-tête (le document commence toujours par `{"v"` et finit par `}`) avant toute lecture de
  masse, et l'échappement ASCII — qui protège les accents — se fait par plages, sans expression
  régulière : c'était le poste le plus coûteux de l'écriture. `GET /v1/health` publie enfin
  `utilise` (la place occupée) à côté de `capacite`, pour voir venir un état trop gros.

- **Le glisser-déposer ne dépend plus du navigateur, et il fonctionne au doigt.** Déplacer un bloc
  dans l'éditeur de trame reposait sur le glisser-déposer HTML5 : il ne répond pas au doigt (ni
  sur iOS, ni de façon fiable sur Android), et le navigateur **interrompt le geste dès que la
  source quitte le document** — ce qui arrive précisément ici, un re-rendu pouvant suivre la perte
  du focus d'un bloc en cours d'édition. Le geste passait alors pour mort. Le moteur
  (`src/ui/dnd.js`) s'appuie désormais sur les **pointer events** : souris, doigt et stylet suivent
  le même chemin, et le geste ne dépend plus d'une API capricieuse. Deux gains d'usage au passage :
  **le bloc entier se saisit** (poignée ⠿, intitulé, marges) au lieu d'une poignée de quelques
  pixels — un appui dans le texte continue d'y placer le curseur, et un appui sur un bouton de la
  barre d'outils fait ce que dit ce bouton ; et une **étiquette suit le pointeur** pendant le
  geste, en disant ce qu'on déplace (le doigt, lui, n'a pas de curseur). La hauteur des barres
  « + » ne change plus pendant le glisser : le document ne se décale plus sous le pointeur, et
  l'on dépose là où l'on visait.
- **Un glisser ne peut plus vider une place dans la trame.** L'adresse d'un bloc saisi était relue
  au lâcher sans vérifier qu'elle désignait encore quelque chose : quand l'arbre avait bougé
  entre-temps, le déplacement retirait une place **vide** et la réinsérait — la trame se corrompait,
  et l'éditeur refusait ensuite de s'ouvrir (« Cannot read properties of undefined »). Le
  déplacement vérifie désormais la source, et les parcours de trame (rendu, commentaires) ignorent
  une place vide plutôt que d'échouer.

- **L'intitulé d'un acte modificatif ne dit plus « de le ».** Quand l'appellation de l'acte modifié
  était un nom masculin non élidé (« le règlement »), la phrase de l'acte modificatif donnait
  « portant modification **de le** règlement » : le « de » n'était pas contracté avec l'article. Il
  passe désormais par la forme contractée (« de la décision », « du règlement », « de l'arrêté »).
  Le défaut ne se voyait pas avec les appellations que la démonstration emploie (délibération,
  décision, arrêté, toutes féminines ou élidées) ; il est apparu avec les annexes, qui sont
  désignées par leur décision d'adoption (voir ci-dessus).

- **Le service annonçait un délai de blocage sans le transmettre.** Quand une connexion était
  refusée parce que le compte venait d'être fermé après plusieurs échecs, le service calculait bien
  le nombre de secondes à attendre (`retry-after`)… et le perdait en chemin : sa fabrique de
  réponses d'erreur n'acceptait pas d'en-têtes. L'agent voyait « trop de tentatives » sans savoir
  combien de temps patienter. Trouvé par le nouveau banc d'essai du domaine des comptes
  (`comptes.test.mjs`, `npm test` dans `src/server/mysql`) — 27 épreuves sans base ni réseau, qui
  couvrent le scellement, le blocage, l'expiration d'une session, l'anti-CSRF et les droits.
- **Un bloc ajouté hors article sort dans tous les formats.** Un paragraphe, une liste ou un
  tableau posé directement dans le corps du texte (ou dans une division) par la rédaction —
  désormais possible depuis l'atelier — s'affichait bien à l'écran et à l'impression, mais
  disparaissait du **Markdown** et de l'**Akoma Ntoso** : ces deux écritures ne parcouraient que le
  contenu des articles. Le Markdown les écrit maintenant comme les blocs d'un article (les
  marques de modification suivent), et l'Akoma Ntoso les range dans un `<block>` générique que la
  relecture reprend à l'import — un aller-retour du document ne perd plus ce que la rédaction a
  ajouté. Les paragraphes, listes et tableaux posés dans une **division** sont couverts par le même
  chemin.
- **Sur GitHub Pages, les éléments cachés le sont vraiment.** L'application masque ce qui ne sert
  pas en posant l'attribut `hidden` ; c'est la plateforme Perchance qui en faisait une règle de
  style, et une page servie en statique ne l'a pas. Un panneau dont la fermeture faisait
  `display: flex` restait donc **ouvert** : le panneau de conversation de l'assistant ne se
  fermait pas, sa zone de saisie s'affichait même sans moteur, et le bouton « Arrêter »
  apparaissait avant toute génération. La feuille de style reprend la règle manquante
  (`[hidden] { display: none !important; }`), ce qui rétablit partout le même comportement qu'à
  l'éditeur.
- **Un article rangé dans une division retrouve son numéro et son intitulé.** Dans l'atelier de
  rédaction, les articles placés en Titres ou Chapitres s'affichaient comme de simples
  paragraphes : ni numéro, ni intitulé, et pas de prise pour les déplacer. Le rendu des articles
  est désormais le même partout dans le document — un article se déplace aussi **à l'intérieur**
  d'une division, et se renumérote.
- **La liste des annexes survit à l'Akoma Ntoso.** Le document annonçait ses annexes à l'écran et
  dans le Markdown, mais l'export Akoma Ntoso les perdait. Elles y sont maintenant portées par un
  bloc `<attachments>` — l'élément prévu pour les documents adoptés et annexés —, chacune avec son
  intitulé et son identifiant ELI.
- **Un texte structuré n'est plus importé comme vide.** Rouvrir un acte rangé en divisions depuis
  son Akoma Ntoso signalait à tort qu'aucun article n'avait été trouvé, la recherche ne regardant
  qu'à la racine du corps ; elle descend maintenant dans les divisions.
- **Un texte rangé en divisions se modifie comme les autres.** L'écran « Modifier » n'atteignait
  que les articles du corps : les articles placés dans un **Titre** ou un **Chapitre** (un
  règlement intérieur, par exemple) n'étaient ni modifiables, ni abrogeables — la modification
  d'un tel texte était impossible. Les divisions sont désormais parcourues partout où le sont les
  articles (l'ordre **imprimé** du document, `flatNodes`) : l'éditeur de modification rend
  éditables les articles de division, un article inséré « après » l'un d'eux prend place **dans
  cette division**, « ajouter en fin de dispositif » entre dans la **dernière** division quand le
  texte s'y termine, « abroger tout l'acte » et « tout renuméroter » les couvrent, et la version
  consolidée y marque ses ajouts et suppressions. Le **rapport de conformité** compte aussi ces
  articles, au lieu de les ignorer.
- **« …l'adoption de la nouvelle rédaction DU règlement intérieur… ».** Les tournures d'adoption
  d'une annexe enchâssaient l'appellation de la cible sans contracter l'article : l'acte
  modificatif annonçait « …portant adoption de la nouvelle rédaction **de le** règlement
  intérieur… ». Un jeton `{targetDe}` (« du règlement intérieur n°… », « de la délibération
  n°… », « de l'arrêté n°… ») corrige l'intitulé, l'objet et l'article premier de l'acte
  modificatif.
- **Sur un écran étroit, l'atelier ne garde plus les marges de la page A4.** Les marges réglées
  dans la charte (2 à 3 cm de chaque côté) laissaient, sur un téléphone, une colonne de texte de
  quelques mots par ligne. L'atelier de rédaction les réduit en deçà de 1100 px de large : la mise
  en page de la page — celle de l'impression et des exports — reste inchangée.
- **Les commentaires ont désormais leur onglet, et le bloc renvoie à eux.** L'inspecteur de
  l'éditeur de trame prend un cinquième onglet, **« Commentaires »**, qui porte le compte et
  rassemble tous ceux de la trame (auparavant, ils étaient enterrés au bas de l'onglet « Ce
  bloc ») ; l'onglet « Ce bloc » n'en garde qu'un renvoi, avec le compte du bloc sélectionné. Le
  commentaire est aussi plus complet : il peut **citer un passage** (`quote`), conservé à
  l'import/export du fichier de trame, dans l'Akoma Ntoso (relu par `akn.js`), le Markdown et le
  rapport de conformité. Le format de fichier des trames documente la nouvelle clé.

### Ajouté

- **Les actes d'assemblée — les délibérations des conseils.** Un acte n'émane pas toujours d'une
  personne : une **délibération** émane d'une **assemblée** — le conseil municipal d'une commune, le
  conseil d'administration d'un établissement public. Ces actes ont désormais leur ligne d'autorité
  propre : ils portent **« Le conseil municipal de … »**, « Le conseil d'administration de … » — et
  non la formule d'une personne — tandis qu'ils sont **signés par le président de l'assemblée** : le
  maire, pour un conseil municipal ; le président du conseil d'administration, pour un établissement.
  Une trame qui produit un acte d'assemblée se déclare par le réglage **« Acte d'assemblée —
  délibération »**, dans l'inspecteur de trame.

- **L'écran « Administration › Assemblées ».** Les conseils se décrivent comme le reste du
  référentiel : pour chacun, son **entité de rattachement**, son **nom**, sa **formule d'autorité**
  (la ligne d'en-tête de l'acte) et la **qualité qui signe** — le maire, ou le président du conseil
  d'administration. C'est ce dernier choix qui rend la règle **configurable par assemblée**, sans
  toucher au code : un conseil municipal fait signer son maire, un conseil d'administration son
  président.

- **Le jeton `{{autorite}}`.** Les trames d'acte d'assemblée le posent dans leur ligne d'autorité :
  il rend la formule de l'**assemblée** quand l'acte en émane, et celle de l'**entité** sinon. Les
  jetons `{{conseil.name}}`, `{{conseil.authorityFormula}}` et `{{conseil.signerQualite}}` — proposés
  dans l'éditeur des trames d'assemblée — disent l'assemblée elle-même.

- **Le contrôle de conformité dit l'assemblée.** Le rapport du réviseur constate que l'acte émane
  d'une assemblée, rend sa formule d'autorité, et **vérifie que le signataire — ou un délégataire de
  sa chaîne — tient bien la qualité appelée** par l'assemblée : un signataire hors compétence est
  signalé.

- **La trame « Délibération du conseil d'administration ».** Le jeu de démonstration gagne cette
  seconde délibération, celle de l'office public de l'habitat : elle montre une assemblée qui n'est
  pas le conseil municipal, et une signature qui n'est pas celle du maire.

- **L'export du journal d'audit du service.** La fenêtre du journal, dans *Administration › Base de
  données*, gagne un bouton **« Exporter (JSON) »** : le journal append-only se télécharge pour être
  archivé hors du service (le service n'en conserve que les **2 000 dernières entrées** — la
  rétention est désormais dite dans la fenêtre).

- **Un analyseur de style sans dépendance** (`npm run style`, et `npm run lint` l'appelle). Écrit en
  quelques lignes de Node, il refuse `debugger` et signale les déclarations `var` et les traces
  `console.log` laissées dans le code client — sans installer le moindre paquet.

### Modifié

- **L'écrasement sans contrôle de révision (`force`) est réservé à l'administration.** La
  synchronisation d'une collection acceptait `force` de **tout rôle d'écriture** : un poste muni d'une
  clé de rédaction pouvait écraser en silence l'écriture d'un autre. Le geste — une reprise de
  données — exige maintenant le rôle **administrateur**, il est **journalisé**, et les autres rôles
  reçoivent le conflit au lieu de l'écraser. Même règle côté service auto-hébergé.

- **Une transmission au contrôle de légalité simulée le dit.** Quand aucun appel sortant n'a eu lieu
  (le cas de la démonstration), l'accusé de réception est marqué **« simulation »**, et la mention
  portée sur le document est **qualifiée** (« mention de démonstration — transmission simulée, sans
  appel sortant ») : on ne prend plus un certificat fabriqué pour un certificat opposable. Une
  intégration @ctes réelle lèvera le marqueur.

- **L'identifiant ELI et son adresse ne se confondent plus.** Le recueil nomme désormais, d'un côté,
  l'**identifiant** (`eli:/fr/…`, non résoluble tel quel) et, de l'autre, l'**adresse ELI** HTTP qui
  en dérive — celle qui se cite et s'ouvre. La règle vit dans un point unique (`eliAdresse`), d'où
  elle alimente aussi le `FRBRuri` du document Akoma Ntoso.

- **`src/lib/revisions.js` devient `src/lib/historique-brouillons.js`.** L'ancien nom jouxtait
  `revision.js` (le circuit de révision avant signature) pour un objet tout différent — l'historique
  de travail des brouillons. Le renommage lève l'ambiguïté.

- **Le libellé du geste d'épinglage suit l'état de l'acte.** Un libellé unique — « Épingler à la une
  du recueil public » / « Retirer de la une du recueil public » —, et la distinction « dès sa
  publication » réservée aux actes **non publiés** : on ne lit plus qu'un acte publié serait épinglé
  « dès sa publication ».

- **La démonstration publique est servie en statique, sur GitHub Pages —
  <https://aplds.github.io/scribae>.** Sans serveur applicatif, tout y travaille dans le
  **navigateur du visiteur** : rien n'y est **partagé entre visiteurs**, et ce qui y est conservé
  peut disparaître (effacement des données du site, capacité bornée du service embarqué). Le
  README du dépôt et `docs/ADMINISTRATION.md` (§ 7.6) le disent désormais, et n'envoient plus vers
  l'espace d'édition.

## [1.2.0] — 2026-09-20 — Signer par délégation

Cette livraison fait de la **signature** une qualité à part entière : elle **découle d'une
désignation** dans l'organigramme des délégations, elle se donne **avec son compte**, et elle
s'appuie sur les **décisions** qui fondent le pouvoir de chaque étage de la chaîne — nommément
visées sur l'acte, avec leur lien, sur le web comme en PDF. La présentation du logiciel expose
désormais les **obligations du CRPA** auxquelles il répond, et les feuilles de style gagnent deux
modèles aux couleurs de l'État.

### Ajouté

- **Deux modèles de charte aux couleurs de l'État.** Les **Feuilles de style** gagnent deux modèles
  de départ : « **Charte graphique de l'État** » — bleu France (#000091), typographie Marianne,
  en-tête et filet —, **réservé à l'État et à ses opérateurs** (la police Marianne et le
  bloc-marque étant réservés, le logiciel ne les livre pas : l'administration les ajoute), et
  « **Marianne-like** », la même sobriété et les mêmes couleurs **sans les éléments réservés**, en
  Arial et avec l'identité de la collectivité, utilisable par toute administration. Chaque modèle
  porte son étiquette dans la liste (« réservé », « libre »).
- **Le nom et l'icône des assistants se règlent.** L'administrateur change, dans **Administration ›
  Assistants**, le **nom** et l'**icône** de chaque assistant — un champ pour l'un, une adresse
  d'image pour l'autre, avec un aperçu vivant. L'interface suit **partout** : la pastille, le
  panneau, la bulle d'invitation et le menu du compte. Un champ laissé vide rend la main aux
  valeurs livrées (« Plume », « Publia ») : l'application ne montre jamais un assistant sans nom
  ni sans visage. Le réglage suit l'export du référentiel, comme le reste.
- **Chaque agent peut masquer un assistant pour son seul compte.** Le menu du compte porte un bloc
  **Assistants** — deux boutons, avec l'icône de chacun —, à côté du choix d'apparence. C'est une
  **préférence de poste**, comme l'apparence claire ou sombre : elle ne touche pas au réglage de
  l'installation, vaut par compte (deux agents qui partagent un poste gardent chacun la leur) et
  survit au rechargement. À défaut de réglage, l'assistant est **allumé**. Le réglage
  *Éteint* de l'Administration reste, lui, une décision pour **tout le monde**.
- **Les assistants renvoient par des liens que l'on clique.** Plume termine sa réponse par le
  **lien du chapitre du guide** qui répond à la question ; Publia recopie le **lien d'un acte** du
  recueil. Ces liens s'ouvrent **dans l'application**, sans recharger la page ni ouvrir d'onglet.
  Le moteur ne fabrique aucun lien : il recopie ceux qu'on lui donne, déjà libellés. Et **Publia
  sait quel acte est consulté** : quand un lecteur ouvre un acte du recueil, l'assistant reçoit sa
  fiche, ses versions publiées et son texte, et **répond d'abord sur cet acte** — ce qu'il prévoit,
  sa portée, ses dates, ses modifications, ses évolutions — même si la question n'est pas posée.
- **La qualité de « Signataire ».** Un signataire n'est pas un agent comme un autre : c'est
  l'auteur de l'acte, celui dont la signature engage la collectivité. L'application distingue
  désormais cette **qualité** des autres **profils d'accès** : elle ne se choisit pas dans une
  liste, elle **découle d'une désignation**. Dès qu'une personne est désignée quelque part dans
  l'**organigramme des délégations** — comme autorité qui délègue, ou comme délégataire qui
  signera —, le compte rattaché à cette personne reçoit la qualité de **Signataire**, sans qu'il
  faille être administrateur : un **éditeur** qui désigne quelqu'un dans l'écran Délégations la
  lui attribue de la même façon. La qualité est **cumulable**, comme celle de **Réviseur** : elle
  n'enlève aucun profil, elle ajoute la qualité de signer. Elle ouvre l'écran **Signature &
  publication** (onglet « Ma signature ») et les gestes de signature.
- **Un signataire ne voit, dans l'atelier, que les actes relevant de son champ de compétence.**
  C'est la conséquence directe de la qualité : les actes dont la signature relève de lui — ceux
  qu'il **signe lui-même**, et ceux que signent ses **délégataires**, car c'est alors sa propre
  signature qui est engagée, par délégation puis subdélégation — lui sont ouverts, et ceux-là
  seulement. Le champ de compétence se lit dans la **chaîne de signature** de l'acte : y figurer,
  à quelque étage, c'est être compétent. Le registre des actes le dit quand la liste contient des
  actes venus de la compétence plutôt que du périmètre administratif.
- **Un signataire signe avec son compte, et son compte se rapproche de l'outil de signature.**
  L'annuaire de la collectivité (OIDC) délivre le compte de l'application **et** provisionne le
  même agent sur l'**outil de signature** : deux rapprochements en découlent, que l'application
  rend explicites. La **personne du référentiel** — celle qui porte la qualité — est rattachée à
  son **compte** (Comptes et rôles › « **Personne du référentiel — qui signe** »), et ce compte
  est rapproché du **compte de l'outil** que l'annuaire lui connaît. L'état du rapprochement se
  lit et se corrige à trois endroits : la **fiche** de l'acteur dans l'écran **Délégations**, la
  **fiche du compte** (Comptes et rôles) et l'onglet **« Ma signature »**. Un signataire sans
  compte, dont le compte est désactivé, sans adresse, ou non rapproché, ne peut pas signer — la
  signature serait anonyme : l'application le dit au moment où on le désigne (sous le champ du
  signataire, à la rédaction), et sur l'écran de signature. Le panneau de l'outil affiche le
  **compte de signature** retenu et avertit quand il manque.
- **L'onglet « Ma signature ».** Un signataire ouvre l'écran **Signature & publication** sur son
  propre onglet : son **identité de signataire** (la personne qu'il tient, sa qualité, son compte,
  l'état du rapprochement), les **actes qui attendent sa signature** — avec le geste *Déposer et
  signer* ou *Signer* pour chacun —, et les **actes signés au titre de sa signature**, c'est-à-dire
  ceux dont la signature est engagée par ses délégataires. Les deux listes ne contiennent que des
  actes de son champ de compétence.
- **Signer un acte est une permission à part entière.** Elle ne se confond plus avec la
  publication : `actes.signer` ouvre l'écran de signature et les gestes qui engagent la signature,
  tandis que `signature.gerer` reste la conduite de la **publication** (recueil, identifiant ELI,
  formalités, transmission). Un signataire peut donc signer sans pouvoir publier.

- **L'organigramme des délégations de signature est un écran de plein droit, visible par tous.**
  Il quitte les réglages de l'Administration pour un écran **Délégations**, dans le menu. On y
  voit d'un coup d'œil **qui peut signer à la place de qui** : chaque chaîne part de son autorité
  de tête et descend, de délégation en sous-délégation. Un nœud reste court — nom, qualité,
  organisation, rang — et **un clic ouvre la fiche** de l'acteur : le pouvoir reçu (délégant,
  organisation, décision), l'étendue (famille, type d'acte, matières), les dates, et **la
  signature que cela produira** — les lignes « Le Maire, / Par délégation, … » et les visas,
  recalculés à la frappe. L'écran est **visible par tous les comptes** ; seuls les
  **administrateurs et les éditeurs** peuvent le modifier (les autres lisent la même fiche, sans
  les champs de saisie). Deux présentations au choix : **organigramme** (qui défile
  horizontalement sur un écran étroit) ou **liste** indentée. Créer une délégation passe par un
  **brouillon** — le référentiel n'est écrit qu'à la confirmation —, et une délégation dont le
  délégant est vide, inconnu ou forme un cycle est signalée « non rattachée ».
- **Le signataire se choisit par sa fonction, et non par son nom.** Au moment de désigner qui
  signera l'acte, l'application ne propose plus un annuaire de noms mais un **choix en deux
  temps** : la **fonction** d'abord — la qualité qui donne compétence pour signer —, puis, **parmi
  les personnes qui la tiennent**, celle qui signe. Les fonctions proposées viennent du
  référentiel : les **rôles** (Administration › Rôles) et les **délégations de signature**
  (écran **Délégations**), groupées « Fonctions (rôles) » et « Par délégation de
  signature ». Seules apparaissent celles qui ont du sens **pour cet acte** : une délégation
  donnée dans le nom d'une autre organisation ne s'affiche jamais, et une délégation limitée à une
  famille ou à un type d'acte ne s'affiche que sur ces actes. Quand une fonction ne peut être
  tenue que par une personne — le cas d'une délégation —, celle-ci est retenue d'office ; quand
  plusieurs personnes la tiennent, c'est au rédacteur de désigner qui signe. La chaîne de
  délégations et les décisions visées restent affichées sous le champ, et la qualité imprimée ne
  change pas : elle vient de la délégation quand il y en a une.
- **L'éditeur de trame peut fixer la fonction attendue du signataire.** La question du signataire
  porte un réglage **« Fonction attendue »** (« Maire », « Adjoint au maire », une délégation
  précise…). Le modèle fixe alors la qualité — c'est le cas de l'arrêté portant délégation de
  signature, que le maire signe toujours —, et le rédacteur ne fait plus que désigner qui la
  tient. Rien n'est bloqué : il peut toujours écarter cette fonction, et le signataire déjà retenu
  sur un acte reste proposé même s'il n'a pas la qualité attendue.
- **Les listes numérotées prennent la numérotation de l'usage administratif — « 1° 2° 3° ».**
  La charte distingue désormais la **puce** des listes à puces et la **numérotation** des listes
  numérotées : huit formats au choix (« 1. », « 1° », « 1) », « a) », « A) », « i. », « I. »,
  aucune), réglés dans les **Feuilles de style** (rubrique « Listes »). Surtout, le rédacteur peut
  enfin **choisir le genre de chaque liste** — « À puces » ou « Numérotée » — dans l'inspecteur de
  l'éditeur de trame : un même acte peut donc mêler une énumération « 1° 2° 3° » à une liste de
  puces. C'est la charte qui décide ensuite de leur apparence, et l'acte type de l'aperçu porte
  une liste de chaque genre pour montrer les deux réglages.
- **Les encadrés tracent désormais les côtés que l'on veut.** Chaque présentation « Encadré » —
  intitulé de l'acte, intitulé d'article, formule d'édiction, mentions, bloc de signature —
  propose quatre cases (haut, droite, bas, gauche) : un filet se pose ainsi seul sous un intitulé,
  ou l'encadré s'ouvre du côté où le texte respire.
- **Un compte authentifié sans rôle n'est plus refusé : il est accueilli en visiteur.** Un agent
  que l'annuaire reconnaît mais dont **aucun groupe** ne correspond à un rôle de l'application —
  ou un compte dont les rôles ont été retirés — n'est plus arrêté à la porte : la session
  s'ouvre, l'application constate qu'il n'a **aucun accès**, et lui présente un **écran qui le lui
  explique** — qui est connecté, les **groupes reçus de l'annuaire**, le **contact du service qui
  gère l'application**, et deux boutons : **Consulter l'espace public** (le recueil) et
  **Changer de compte**. Le rôle **« Visiteur »** matérialise cet état (aucune permission) : il
  s'attribue comme les autres dans **Comptes et rôles**, la matrice des droits lui donne sa
  colonne, et un visiteur n'entre ni dans la navigation, ni dans la présence collaborative.
- **Le recueil public est la porte d'entrée de l'application.** Pour qui n'a pas de compte, le
  recueil *est* l'interface : son en-tête propose désormais **« Se connecter »** — un bouton, et
  non plus un simple lien — qui ouvre l'écran de connexion (comptes de l'application ou annuaire,
  selon le référentiel). Un agent connecté y garde **« Retour à l'application »**, et un visiteur
  sans rôle y trouve **« Mon accès »**, qui mène à l'écran d'explication.
- **Le recueil public s'ouvre sur une vraie page d'accueil, et se parcourt par matière.** La liste
  des actes publiés ne s'ouvre plus sur un formulaire : la page présente d'abord l'organisation et
  sa phrase d'accueil, puis un **carrousel « Derniers actes administratifs publiés »** — les actes
  **en vigueur**, du plus récent au plus ancien, que l'on fait défiler par flèches ou au doigt,
  une carte par acte mettant en avant sa **matière** —, et une **grille des thèmes**, une tuile par
  matière présente au recueil (urbanisme, police, finances…), avec son libellé, sa phrase de
  présentation et son nombre d'actes. Cliquer une tuile **filtre** la liste sur ce thème (le second
  clic la dé-filtre) ; la **recherche** et les filtres fins — **thème**, nature, année, entité —
  restent sous la grille, où la liste se range par année. La liste et la page d'un acte affichent
  désormais la **matière de l'acte** (son thème), mise en avant. Le thème d'un acte est la
  **famille de sa trame** ; sa **phrase de présentation** s'édite dans Administration › Familles
  (« Présentation du thème »). Une installation **auto-hébergée** sert la même page sans
  JavaScript : l'accueil y est rendu par le service (carrousel en défilement CSS, thèmes en grille,
  actes rangés par thème), et `llms.txt` et `recueil.json` annoncent les thèmes.
- **Un rôle « Réviseur » contrôle les actes entre la décision d'envoyer et l'envoi.**
  Le réviseur s'intercale entre le geste du rédacteur (« Envoyer en signature ») et l'envoi
  effectif : il reçoit pour chaque acte un **rapport de conformité** (contrôles de la trame,
  structure du document, visas et références, mentions et publicité, écarts et annotations),
  peut **corriger** l'acte, puis le **valider** — l'acte part alors en signature — ou le
  **rejeter**, et l'acte **revient en brouillon chez son rédacteur avec le motif** du rejet.
  Les actes à réviser se suivent dans un nouvel écran **Révision**
  (« À réviser par moi », « En attente d'un autre réviseur », « Révisés », « Rejetés »), avec le
  dossier de la révision à côté du rapport. Le rôle **se cumule** avec les autres : un éditeur
  peut être *éditeur* **et** *réviseur*. Sa **compétence** — certains services, familles de
  trames, types d'actes ou entités — se règle sur le compte (Comptes et rôles), ou se donne à un
  **service entier**, ou à certains de ses bureaux, sur le service lui-même (Administration ›
  Services, « Qualité de réviseur ») : c'est le cas d'un service des affaires juridiques dont les
  agents contrôlent les actes des autres services. **Sans réviseur compétent, la révision n'existe
  pas** : l'acte part directement en signature, exactement comme avant. La révision porte sur le
  **texte exact** de l'acte (son empreinte est mémorisée) : s'il est réécrit après coup — par le
  rédacteur ou par le réviseur qui corrige une faute de frappe —, l'application le détecte, la
  révision devient **caduque** et doit être reprise ; c'est ce qui garantit que l'acte signé est
  bien celui qui a été contrôlé. Le service de signature applique la même règle de son côté : il
  refuse d'ouvrir un circuit sur un acte dont la révision n'est pas faite (409,
  `revision_incomplete`), comme il le fait déjà pour le parapheur.
- **Les actes publiés s'ouvrent aux moteurs de recherche et aux agents.** Un acte du recueil a
  désormais une **adresse de référence** stable — son identifiant ELI sous le recueil — et des
  **représentations lisibles par machine** : JSON (métadonnées, ELI et texte), **Markdown** (la
  structure de l'acte, la plus lisible pour un agent), texte brut et Akoma Ntoso. Sur une
  installation **auto-hébergée**, le service les sert lui-même, en pages HTML rendues sans
  JavaScript : `/recueil` (la liste), `/recueil/<clé>` (un acte), `/recueil/<clé>.json` — et
  `.md`, `.txt`, `.akn` —, plus les fichiers que lisent les moteurs et les agents : `/llms.txt`,
  `/recueil.json`, `/sitemap.xml` et `/robots.txt`. Ailleurs (démonstration statique, plateforme),
  la page porte les mêmes adresses en **paramètres de requête** (`?recueil=1`, `?acte=<clé>`,
  `&format=md`) : il faut alors un lecteur qui exécute le JavaScript. Rien n'est à activer — le
  recueil public change simplement d'adresses (les anciennes ancres `#/recueil…` laissent place à
  `?recueil=1` et `?acte=<clé>`, lisibles par une machine). Chaque page du recueil **se décrit**
  — titre, description, adresse canonique, une adresse par représentation, et les données
  structurées JSON-LD de la publication — et chaque acte **donne ses adresses à copier** (bloc
  « Recueil ouvert », sous le texte), au public comme à l'administration. Le texte publié en
  Markdown et en texte brut accompagne maintenant la publication : le service le sert tel quel, et
  la page sait le reconstituer pour les publications antérieures. Point de vigilance : ces
  représentations **ne portent pas les notes de préparation** — c'est l'acte qui est publié, pas
  les notes de l'atelier.
- **Les feuilles de style proposent une liste de polices, et les intitulés peuvent être encadrés.**
  Les trois polices d'une charte — corps du texte, intitulé de l'acte, intitulés d'article — se
  choisissent désormais dans une **liste**, rangée par familles (à empattements, sans empattement,
  à chasse fixe), au lieu d'un champ libre où il fallait écrire soi-même la pile CSS. Ce sont des
  polices **présentes sur les postes** : rien à installer, et la même police à l'écran, dans le
  PDF, dans le fichier Word et sur la version publiée — chacune est accompagnée de ses replis,
  car une même famille ne s'appelle pas pareil d'un système à l'autre. Le choix **« Autre (police
  personnalisée) »** reste ouvert, pour une police propre à la collectivité. La **même liste**
  sert au champ « Police des documents » de l'Administration. Par ailleurs, l'**intitulé de l'acte** et
  les **intitulés d'article** acceptent la présentation **« Encadré »** : l'intitulé s'inscrit
  alors dans un filet — du style et de la couleur des filets de la charte — comme la formule
  d'édiction ou les mentions.
- **La numérotation des actes peut s'adosser à un service externe.** Jusqu'ici, le numéro d'un
  acte était pris dans la séquence de l'application. Une collectivité qui **numérote déjà
  ailleurs** — le cas d'école étant un document **Grist**, où la **création d'une ligne attribue
  le numéro** — peut désormais faire attribuer le numéro par ce service (Administration ›
  Numérotation › *Attribution du numéro*). À l'écran de rédaction, le bouton devient **« Demander
  le numéro »** : la demande part, avec un indicateur d'attente, et le numéro rendu par le service
  remplit le champ. Le référentiel règle tout l'appel — **adresse**, **méthode**, **en-têtes**
  (c'est là que va la clé d'API), **corps de la requête**, et surtout **où lire la réponse**
  (par exemple `records[0].id`) — avec les jetons `{objet}`, `{entityCode}`, `{year}`… et un
  **préréglage Grist** qui pose la forme attendue. Un bouton **« Tester l'appel »** éprouve le
  réglage, en annonçant qu'un essai de POST crée réellement une ligne. La **référence de la ligne
  créée** est conservée sur l'acte, affichée sur sa fiche, et l'attribution entre au **journal
  d'audit** ; l'échange lui-même est journalisé, requête et réponse, dans « API & journal »,
  comme les appels au prestataire de signature. Deux points à savoir avant de s'en servir :
  l'API de **Grist refuse l'en-tête `Authorization`** d'une origine de navigateur qu'elle ne
  connaît pas — la demande passe donc par le **relais HTTP** de l'hébergement (elle peut aussi
  passer en direct, si l'origine de l'application est déclarée origine de confiance chez
  Grist) ; et la **clé d'API est conservée dans le référentiel**, donc dans les sauvegardes et
  la base partagée — mieux vaut une clé restreinte à la seule table de numérotation.
- **Noter l'existence d'un recours, et sa date d'introduction.** Un acte exécutoire peut être
  contesté, et l'administration l'apprend par la pièce qu'elle reçoit. L'échéancier
  (**Exécution & délais**, onglet **Recours**) permet désormais de **constater ce recours** :
  **date d'introduction**, **nature** (gracieux, hiérarchique, contentieux, référés, déféré du
  préfet), **auteur**, **référence** (n° de requête, avis de réception) et une observation libre.
  La date d'introduction **ferme le délai de recours contentieux** : l'acte passe au statut
  **« Recours introduit — contentieux en cours »** — il n'est plus *définitif* une fois le délai
  échu, et il le reste **jusqu'à la décision du juge**. La mention se **corrige** ou se **retire**
  (journalisée dans les deux cas). L'échéancier distingue donc les **recours ouverts** (le délai
  court encore) des **recours introduits**, et son compteur les compte séparément. Le jeu de
  démonstration porte un **permis de construire contesté** devant le tribunal administratif.
- **L'attestation de non-recours, pour un acte définitif.** Quand le délai de recours est échu
  **et** qu'aucun recours n'est enregistré, l'échéancier propose de **délivrer une attestation de
  non-recours** : une pièce sur papier A4, à imprimer ou à enregistrer en PDF, qui identifie
  l'acte, atteste qu'**aucun recours n'a été porté à la connaissance de la collectivité**,
  rappelle les **formalités par lesquelles l'acte est devenu exécutoire** et la **date
  d'expiration du délai**, et se présente **prête à signer** (qualités et nom de l'autorité,
  emplacement du cachet). Une attestation ne pouvant certifier qu'il n'y a pas eu de recours, la
  pièce **refuse de se produire** pour tout autre acte (délai en cours, formalité manquante,
  recours enregistré) : elle dit alors pourquoi. La délivrance est inscrite au **journal**.
- **L'état des formalités, en PDF, pour tout acte signé.** Quel que soit l'état de l'acte —
  formalités en cours, exécutoire, contesté, définitif —, l'échéancier permet d'**exporter le
  détail des formalités et de leurs dates** : un tableau (formalité, requise ou non, **date**,
  **référence**, **modalité**, **constatée par**), le **certificat de transmission** s'il existe,
  puis la **situation** (date d'exécutoire, délai de recours, recours éventuel). C'est la pièce de
  suivi du dossier — celle qu'on classe au dossier ou qu'on joint à une demande de subvention.
- **Le bandeau de démonstration s'affiche aussi sur le recueil public.** Un visiteur qui consulte
  les actes publiés d'une installation de démonstration en est désormais averti : le bandeau
  orange « Démonstration » coiffe le recueil, comme il coiffe l'atelier et l'écran de connexion
  (avec le lien *Réglage* pour un administrateur connecté ; le visiteur, lui, ne voit que la
  mention). Il reste commandé par le même réglage — Administration › Identité › **Mention de
  démonstration** — et disparaît donc en même temps partout.
- **L'original signé se consulte depuis le recueil public, à la demande.** La page d'un acte
  n'affiche pas l'original d'office : un bouton **« Voir l'original signé »** l'ouvre dans une
  **fenêtre**, où l'on peut aussi l'**imprimer ou l'enregistrer en PDF**. La pièce est le texte
  tel qu'il a été signé, suivi de son bloc de signature (identité, certificat, empreinte,
  horodatage) — c'est elle qui fait foi ; le texte publié n'en est qu'une lecture pratique.
  L'original n'était jusqu'ici accessible que depuis l'administration.
- **Le retrait d'un acte du recueil, réservé à l'administrateur.** Un acte publié peut être
  retiré du recueil — pour un **motif technique** seulement : dépôt en double, dépôt erroné, acte
  publié avant signature, identifiant attribué à tort. Le geste s'ouvre depuis la consultation
  d'une publication (écran **Publications (ELI)**), sous une **permission dédiée**
  (`publications.depublier`, rôle **administrateur** seul). Il est précédé d'un **avertissement en
  grand** : un acte administratif publié **ne se retire jamais**, et seul un motif technique le
  justifie ; ni le retrait ni l'oubli ne sont un moyen de corriger un acte, qui doit être
  **modifié** ou **abrogé** et rester au recueil. Le **motif technique** est **obligatoire** et
  **conservé** : il est inscrit **sur la fiche de l'acte** et au **journal** (action
  « publication.depublie »). L'acte redevient **signé**, publiable à nouveau, et sa publication
  disparaît du recueil.
- **Les décisions fondant la signature, visées automatiquement.** Chaque étage d'une chaîne de
  délégations tient son pouvoir de **décisions** : l'autorité de tête (le maire), d'une seule — la
  délibération qui lui a donné son pouvoir ; un **délégataire**, de **deux** — la décision de
  **nomination** qui l'a nommé à sa fonction, et la décision de **délégation** qui lui a donné le
  droit de signer. Chacune se renseigne d'un **acte publié au recueil** (le visa portera le lien du
  recueil en ligne), d'un **lien externe** (le texte vit ailleurs : site de la collectivité,
  Légifrance, intranet), ou d'une **référence du référentiel** qui porte son adresse. Renseignées —
  sur la **fiche de la personne** (Administration › Personnes, « Décision fondant son pouvoir de
  signer ») pour l'autorité, et sur chaque **délégation** (écran **Délégations**, « Les
  décisions fondant la signature ») pour les étages suivants —, elles entrent d'elles-mêmes dans les
  **visas** de l'acte, **dans l'ordre — la nomination avant la délégation, à chaque étage** : sur une
  signature par subdélégation, l'acte vise ainsi la délibération du conseil, puis, pour chaque
  étage, la nomination et la délégation. Chaque visa porte son **lien cliquable**, sur le web comme
  en PDF. Un signataire **ne se configure pas** sans ses deux décisions : l'écran Délégations
  **refuse de créer** une délégation dont l'une manque, et une délégation déjà enregistrée sans
  elles est **signalée** (badge « Décisions à compléter », alerte sur la fiche, contrôle de
  conformité à l'attention de la révision). Les visas et les décisions attendues s'affichent **sous
  le champ « Signataire »** pendant la rédaction, et sous chaque délégation de l'arbre
  (écran **Délégations**) : on vérifie la série sans rédiger d'acte pour voir.
- **L'accord des qualités en genre.** « Le maire » ou « **La maire** », « Le directeur général des
  services » ou « **La directrice générale des services** » : la qualité du signataire s'accorde
  désormais avec son genre, dans l'acte comme dans ses exports. Chaque rôle porte ses **deux
  formes** (Administration › Rôles), et l'accord se règle **au cas par cas** sur la fiche de la
  personne (Administration › Personnes). Une femme maire qui tient à être appelée « le maire » se
  règle ainsi en un clic.
- **L'arbre des délégations de signature.** Administration › **Délégations** permet de dire qui peut
  signer à la place de qui, sur autant d'étages que nécessaire — une autorité délègue, le
  délégataire sous-délègue (en principe interdit, en pratique dérogatoire). L'acte signé au bout
  de la chaîne porte alors **toutes les qualités traversées** :

  > Le Maire,
  > Par délégation, l'adjoint au maire en charge de l'urbanisme,
  > Par subdélégation, le chef de bureau Urbanisme,
  > Karim BENALI

  Seul le **Prénom Nom du signataire** s'imprime : les qualités des étages intermédiaires sont
  écrites, jamais les noms de ceux qui les portent. La chaîne suit la famille et le type d'acte de
  la trame, et se voit **sous le champ « Signataire »** au moment de le choisir.
- **La trame « Arrêté — permis de construire »** (service de l'urbanisme) et **un acte de
  démonstration signé** au bout d'une chaîne à trois étages : c'est le cas d'école des
  délégations, visible dès le registre.
- **Les autorités autonomes.** Toutes les chaînes ne descendent pas du maire : un **établissement
  public** a sa propre autorité de tête — le **président de son conseil d'administration** — et sa
  propre chaîne de délégations, parallèle à celle de la commune. Une autorité sans délégation
  entrante signe donc en son nom, avec sa qualité et la formule d'autorité de **son** organisation.
  Chaque délégation est désormais rattachée à une **organisation** (celle de son délégant, ou
  celle que l'administrateur impose — le maire déléguant dans le nom du CCAS qu'il préside) : les
  chaînes ne se mélangent plus d'une structure à l'autre, même quand une même personne y tient des
  délégations des deux côtés. Une délégation n'est retenue qu'**à la date de l'acte** : pas de
  signature en mars sur le fondement d'une délégation donnée en juin.
- **La démonstration en donne le cas complet** : l'**office public de l'habitat**, son président de
  conseil d'administration et sa directrice générale, sa propre trame (passation d'un marché
  public), ses propres visas, son propre circuit de validation, et une décision **signée par
  délégation** — « Le président du conseil d'administration, / Par délégation, la directrice
  générale de l'office, / Nadia MARCHAND ».
- **Les comptes du chef du bureau Urbanisme et de la directrice générale de l'office** dans
  l'annuaire de démonstration.
- **Les fonctions expérimentales** (Administration › **Expérimentale**) : des fonctions livrées,
  mais éteintes par défaut et activables d'un clic. La première est le **parapheur** — le circuit
  de validation des actes avant signature. Il est désormais **désactivé**, car beaucoup de
  collectivités ont déjà leur propre circuit interne, en amont de « Envoyer en signature ».
  Éteint, il disparaît entièrement de l'application (menu, écran, onglet de l'Administration, réglage
  de trame, fiche d'acte) et ne conditionne plus rien ; l'activer reconstruit au passage les actes
  de démonstration, pour que l'écran ne soit pas vide. Les circuits éventuellement enregistrés
  sont conservés.
- **La transmission au contrôle de légalité par API, entre la signature et la publication.**
  Administration › **Expérimentale** reçoit une seconde fonction : la **télétransmission**. Activée,
  l'étape s'intercale **automatiquement** entre le retour signé et la publication — l'acte signé
  part vers l'**API d'envoi** du contrôle de légalité (@ctes), l'accusé de réception de la
  préfecture est **déposé sur le document** (« Transmis au contrôle de légalité le 12 mars 2026 à
  09 h 14 », avec sa référence et son sceau), la formalité se constate d'elle-même, et l'acte est
  publié. L'ordre **signé → transmis → publié** est tenu par le service : un acte déclaré soumis à
  cette étape ne peut pas être publié tant que la transmission manque (409 `transmission_absente`),
  et rien ne se transmet avant la signature (409 `acte_non_signe`).
  **Désactivée par défaut** : la télétransmission suppose une convention et des identifiants
  d'accès auprès de la préfecture. Éteinte, rien n'est envoyé, la marche n'apparaît pas dans le
  circuit de signature, et la transmission — quand elle est due — se constate à la main depuis
  l'échéancier, comme les autres formalités. Les actes déposés avant l'activation ne portent pas
  l'exigence.
- **Le recueil public des actes administratifs.** Les actes publiés sont désormais consultables
  par **tout le monde, sans compte**, à une adresse publique (`…/#/recueil`) où ne figurent que
  la **structure** et ses actes : ni l'interface d'administration, ni le nom du logiciel. On y
  **cherche** un acte (texte libre sur le numéro, l'objet ou la nature ; filtres par nature,
  année et organisation), on parcourt la liste **groupée par année**, et l'on lit **l'acte
  directement dans la page**, présenté comme sur Légifrance : les **marques** (nature, version),
  le **titre** de l'acte, un bloc de **métadonnées** (identifiant ELI, dates, recueil), puis le
  **texte** dans une colonne de lecture — la décision n'est **pas enfermée dans une feuille A4**,
  elle fait partie de la page. Suivent ses **pièces et formats**, sa **signature** (vérifiable)
  et ses **versions**. Chaque acte a sa propre adresse, citable et partageable.
- **Le réglage « Publication automatique après signature »** (Administration › **Publication**, un
  onglet qui rassemble aussi le titre du recueil et la règle d'opposabilité). **Automatique**
  (défaut) : le retour signé publie l'acte, comme avant. **Désactivée** : l'acte signé ne
  déclenche plus rien — ni publication, ni transmission —, il attend au registre, à publier le
  moment venu depuis « Signature & publication ». C'est le réglage d'une administration qui
  publie dans **son propre système** et ne veut pas que l'application dépose les actes à sa
  place. Le fait est inscrit au journal.
- **La démonstration livre un recueil peuplé** : les actes que la fiction déclare publiés sont
  réellement déposés au service au premier démarrage, par le même chemin que l'écran de
  signature, pour que le recueil public ne soit pas vide. Idempotent, silencieux, et réservé au
  jeu de démonstration intact.
- **Deux assistants — « Plume » dans l'atelier, « Publia » sur le recueil public.** Une pastille
  flottante, un peu espiègle (elle propose d'elle-même une question de temps en temps), ouvre une
  conversation : Plume répond sur le **mode d'emploi de l'outil** — où cliquer, dans quel ordre,
  ce que veut dire un message —, Publia répond aux **visiteurs du recueil** sur les actes
  publiés. **Le contenu des actes n'est jamais transmis au moteur de langage** : Plume ne connaît
  que le guide d'utilisation, qui est public, et le nom de l'écran courant ; Publia ne voit que
  ce que le recueil affiche déjà à tout venant. Rien n'est à filtrer, parce que rien ne leur est
  envoyé. Chacun s'**éteint** séparément — éteint, il disparaît complètement — et se règle dans
  **Administration › Assistants**.
- **Le moteur de langage des assistants est interchangeable, et se règle par l'administration.**
  Par défaut, le moteur intégré de Perchance quand il existe, et l'API de la collectivité sinon.
  L'administrateur peut brancher sa propre API (adresse, clé, en-tête, modèle) en **complétions
  de conversation** — OpenAI, Mistral, Groq, OpenRouter, Ollama, LM Studio, vLLM… avec flux de
  réponse — ou en **appel simple** `{ prompt } → { texte }`, avec le relais sans CORS de la
  plateforme en option. Hors de Perchance, c'est le seul moteur possible : l'application s'en
  passe proprement tant qu'aucune adresse n'est réglée — l'assistant explique alors pourquoi,
  au lieu de rester muet.
- **L'administrateur gère les prompts des deux assistants.** Pour chacun, il modifie
  l'**instruction** donnée au moteur (le rôle, ce qu'il ne fait jamais, sa manière de répondre)
  et la liste des **questions proposées** (étiquette du bouton et question envoyée) : il en
  ajoute, en retire, et peut rétablir les réglages livrés. Un bouton « Tester le moteur » dit
  immédiatement si le moteur répond.
- **Le guide de l'application sait retrouver le bon chapitre.** La recherche ignore désormais la
  casse, les accents, la ponctuation et les mots grammaticaux, et rapproche les formes voisines
  (« exporte » retrouve « exporter ») : l'assistant joint ainsi les chapitres qui répondent
  vraiment à la question, et le guide se cherche mieux à la main.
- **Un acte peut désormais ABROGER un autre acte — ou l'un de ses articles.** Pendant la
  rédaction, l'onglet **« Abrogations »** du panneau de droite permet de prévoir, dans le texte
  même de l'acte, l'abrogation d'un acte **du registre** (désigné expressément : nature, numéro,
  date) ou d'un **article** de l'un de ces actes — la clause est composée d'avance (« L'arrêté
  n° … du … est abrogé à compter de l'entrée en vigueur du présent arrêté »), et peut être
  réécrite. Un acte hors de l'application se vise par un texte libre. L'abrogation prend effet au
  jour de l'**entrée en vigueur** de l'acte qui la porte — sa date d'effet, à défaut le lendemain
  de sa publication — et non au jour de la publication : arrivée à ce terme, l'application
  l'applique d'elle-même (marque sur l'acte visé, ou **version consolidée** à publier pour un
  article). Tout se règle dans **Administration › Vocabulaire › Abrogation — tournures**.
- **La corbeille est réservée aux brouillons ; les actes signés et publiés s'abrogent.** Un acte
  qui a quitté l'atelier ne porte plus de bouton corbeille : sur sa ligne du registre, c'est un
  bouton **« Retirer / abroger »** qui explique qu'un acte publié ne s'efface pas et propose de
  **rédiger un acte d'abrogation** (pour un administrateur, il mène aussi au **retrait technique
  du recueil**, réservé aux erreurs de dépôt). Le registre affiche un badge **« abrogé »** (ou
  **« abrogation prévue »**) à côté du statut, et la fiche de l'acte dit en tête par quoi l'acte a
  été abrogé, et à compter de quand.
- **Le recueil public montre chaque acte dans sa version la plus récente, et peut révéler les
  articles abrogés.** La liste des actes publiés ne présente plus deux fois le même acte : une
  version antérieure ne s'y trouve que si l'on coche **« Afficher les versions antérieures »**
  (case discrète à côté des filtres, qui n'apparaît que s'il y en a), et les compteurs du recueil
  comme ceux des thèmes suivent la même règle. Sur la page d'un acte, l'**article abrogé** garde
  son intitulé et la mention de l'acte qui l'a abrogé, mais sa rédaction reste masquée : la case
  **« Afficher les articles abrogés »** la révèle, barrée, comme une pièce d'archive. La version
  papier et l'impression ne la montrent jamais.
- **Un article peut être renuméroté, ou le dispositif renuméroté d'un bout à l'autre.** En
  modifiant un acte, le bouton **n°** d'un article lui réattribue un numéro — refusé s'il est déjà
  porté par un autre article — et **« Tout renuméroter »** rend la numérotation continue, ce qui
  est le remède à un acte troué par les abrogations : les articles abrogés dont le numéro est
  repris ne sont alors même plus mentionnés. Les deux gestes vivent dans le panneau **« L'acte
  entier »** de l'écran de modification.
- **Un article s'édite dans sa structure : on y ajoute et on y retire des paragraphes, des lignes
  de liste et des lignes de tableau.** Pendant la modification d'un acte, chaque paragraphe, chaque
  élément de liste et chaque ligne de tableau porte ses outils discrets (**+** / **✕**) ; des barres
  de bloc permettent d'ajouter une ligne ou un paragraphe entier. Le texte ajouté est marqué comme
  tel dans l'acte modificatif et dans la version consolidée.
- **Le guide a un chapitre « Abroger un acte, ou l'un de ses articles ».** Il explique les deux
  chemins (le registre, la rédaction), l'effet à l'entrée en vigueur, ce que le registre en dit, et
  ce que le recueil public montre ; le glossaire s'enrichit de l'**abrogation**, de l'**entrée en
  vigueur**, de l'**article abrogé** et du **retrait du recueil**.

### Modifié

- **La présentation du logiciel expose les obligations auxquelles il répond.** La page d'accueil du
  dépôt s'ouvre désormais sur un « **Pourquoi ce logiciel** » : les exigences du **code des
  relations entre le public et l'administration** — la publicité qui conditionne l'**entrée en
  vigueur** d'un acte réglementaire (CRPA, art. L. 221-2 et L. 221-3), la publication au **recueil
  des actes administratifs** (L. 222-1 à L. 222-4), la **publication en ligne** des documents
  administratifs (L. 312-1-1) dans un **standard ouvert** (L. 322-6, L. 321-1), la **protection des
  données** avant mise en ligne (L. 312-1-2) — avec, pour chacune, le renvoi au texte sur Légifrance
  et ce que le logiciel fait pour y répondre. Scribae **outille** ces obligations sans s'y
  substituer : c'est à l'administration de fixer sa politique de publication.
- **Une réponse de Publia ne parle plus d'adresses à composer.** L'assistante invitait à consulter
  un acte « en ajoutant sa clé respective après « ?acte= » à l'adresse de consultation » — une
  phrase qui n'a de sens que pour un informaticien. Ce qui est demandé au modèle a changé : il
  **ne parle jamais** de « clé », de « paramètre », de « ?acte= » ni d'identifiant technique, et
  **n'écrit jamais d'adresse** — il recopie le lien de l'acte, libellé, et le lecteur clique. La
  réponse se lit désormais en français ordinaire : l'acte, son numéro, sa date, et le lien pour
  l'ouvrir.
- **L'écran de signature ne montre plus tous les actes, mais ceux du compte qui regarde.** Les
  onglets « Circuit » et « Publication » listaient le registre entier ; ils suivent désormais la
  **visibilité** du compte, la même que celle de l'atelier — le périmètre administratif, la
  compétence de révision, et le **champ de compétence de signature**. Un signataire n'y voit donc
  que ce qui le concerne, et le menu « Signature & publication » s'ouvre à quiconque peut signer,
  publication ou non.
- **L'écran « Référentiel » s'appelle désormais « Administration ».** Le nom change partout où
  l'utilisateur le lit — menu de gauche, en-tête, menu du compte, titre de l'écran, Guide et
  documentation — sans rien déplacer : la destination, les permissions et les données restent les
  mêmes. Le mot **« référentiel »** continue de désigner les **données** elles-mêmes (entités,
  personnes, références, mentions, numérotation…), partout où le propos porte sur le contenu et
  non sur l'écran ; c'est aussi le nom de la table qui les range.
- **Le réglage « Agent sans groupe reconnu » dit ce qu'on ouvre, non si l'on entre.** Ses deux
  valeurs (Administration › Annuaire › *Rôles et périmètre*) s'appellent désormais **« Aucun accès
  (rôle Visiteur) »** et **« Attribuer le rôle de repli »** : dans les deux cas l'agent est
  authentifié par l'annuaire. L'ancien réglage « Refuser la connexion » arrêtait l'agent à la
  porte sans lui dire ce qui lui manquait ; le visiteur, lui, se voit expliquer la situation.
- **Sur le recueil public, la matière d'un acte passe devant sa nature.** Chaque acte de la liste
  et la notice d'un acte affichent d'abord son **thème** — la matière dont il relève (urbanisme,
  police, environnement…) —, la **nature** (arrêté, décision) venant en second ; le thème entre
  aussi dans la recherche. Le recueil se parcourt donc **par matière** avant de se parcourir par
  type d'acte.
- **La charte d'un acte ne s'applique plus à sa version en ligne.** Les actes publiés se lisent
  désormais **sans leur feuille de style** : la **charte** (police, couleurs, en-tête, filets)
  habille le **papier** — PDF, Word, page autonome, original signé — et non la page du recueil.
  Celle-ci suit l'apparence du site, dont la personnalisation est **indépendante** des chartes
  d'actes.
- **La page d'un acte du recueil public se lit sur toute la largeur.** Le texte publié n'est plus
  enfermé dans une colonne étroite : il occupe **toute la largeur disponible**, et s'affiche dans
  la **police de l'interface** — au lieu du sérif de la charte — pour un confort de lecture
  homogène avec le reste du site. La liste des actes, elle, garde sa largeur de lecture ; la page
  HTML autonome et les exports conservent, eux, la typographie de la charte.
- **Le retrait du recueil laisse une trace sur l'acte.** La fiche d'un acte retiré affiche, sous
  « Signature et publication », un avertissement **« Retiré du recueil »** et le **motif** de
  chaque retrait, avec sa date et son auteur.
- **Les visas de délégation s'écrivent une fois pour toutes dans la trame.** Au lieu de citer à la
  main l'arrêté de délégation de l'entité (deux visas figés), un bloc de visas peut demander « **les
  décisions fondant la signature, étage par étage** » : l'emplacement reste celui de la trame, mais
  les décisions viennent du référentiel, suivent le signataire et **portent leur lien**. Un acte
  signé sans délégation ne vise plus que la décision de son autorité ; un acte signé par une autre
  autorité (la secrétaire générale, par exemple) ne vise plus l'arrêté de délégation de quelqu'un
  d'autre.
- **La « version en ligne » se lit dans la page, et le recueil public la remplace.** La
  consultation d'une publication (écran **Publications (ELI)**) n'ouvre plus une fenêtre : elle
  présente l'acte **comme le recueil public** — la marque de sa version, son titre, ses
  métadonnées, son texte intégré à la page — et renvoie vers sa page du recueil. L'écran gagne
  l'accès au recueil (« Ouvrir le recueil public », « Copier le lien du recueil ») et les
  actions « Voir dans le recueil public » et « Copier le lien de cet acte ». La page HTML
  autonome reste — pour l'impression, le PDF et le téléchargement.
- **Les liens internes du recueil sont des ancres.** Suivre un résultat ne recharge plus la
  page publique dans son propre cadre : l'adresse citable (`https://perchance.org/…`, proposée
  par « Copier le lien ») reste distincte du lien de navigation.
- **Le certificat de transmission se voit partout où l'acte se lit** : sur la **fiche de l'acte**
  et dans l'**échéancier d'exécution** (mention, référence, sceau), sur l'**original signé**
  (bloc « Certificat de transmission », dont le sceau est **vérifié à l'affichage**), et
  **sur le document publié** lui-même, sous le texte de l'acte. Le **journal de l'API** distingue
  désormais trois origines : le service, le prestataire de signature, et l'API d'envoi du
  contrôle de légalité.
- **Le bloc de signature** n'imprime plus la civilité du signataire : la qualité, juste au-dessus,
  dit déjà de qui il s'agit. La formule d'autorité de l'entité peut porter un jeton `{qualite}`
  (« {qualite} de Valmont-sur-Loire »), remplacé par la qualité accordée de l'autorité de tête.
- **Le retour signé publie l'acte.** Un acte **publiable** qui revient signé est déposé au recueil
  et reçoit son identifiant ELI **automatiquement** : il n'y a plus de geste de publication à
  faire après la signature. Un acte individuel (trame déclarée non publiable) s'arrête à la
  signature, comme avant : conservé au registre, il est notifié à l'intéressé.
- **La documentation technique est réservée aux administrateurs.** L'écran « Documentation
  technique » (exploitation, installation, sécurité) n'est plus ouvert à tous les comptes : une
  permission `docs.voir` le réserve au rôle **administrateur**. Les autres rôles ne voient plus
  son entrée de menu, ni le renvoi du menu de leur compte, ni l'encart en bas du **Guide** — qui,
  lui, reste ouvert à tous.

### Corrigé

- **Le menu du compte et les formulaires tiennent dans un écran étroit.** Sous 640 px, le menu du
  compte — nom, apparence, assistants, version — sortait de la fenêtre : le bouton auquel il
  s'ancre change de place quand l'en-tête se replie sur plusieurs lignes. Il s'affiche désormais
  comme une **feuille en bas de l'écran**, entièrement visible. De même, les formulaires en deux
  ou trois colonnes dépassaient de la page sous 300 px de large : leurs colonnes se **réduisent**
  au lieu de déborder.
- **Le recueil de démonstration ne reste plus vide après une réinitialisation.** Le réamorçage du
  recueil ne redéposait que les actes encore marqués « signés » dans le poste : un acte **déjà
  publié**, dont l'état local n'est plus « signé », n'était jamais redéposé — le recueil public
  pouvait donc rester vide alors que la fiction annonçait des actes publiés. L'amorçage considère
  désormais aussi les actes **publiés**, et ne rapporte son succès qu'après vérification auprès du
  service (et non sur l'état local, qui pouvait être périmé).
- **Redéposer un acte déjà publié rétablit sa transmission au contrôle de légalité.** Quand le
  contrôle de légalité est actif, republier un acte qui porte déjà un certificat de transmission
  échouait en `transmission_absente` : le dépôt rejoue maintenant la transmission existante avant
  de publier, au lieu de la perdre.
- **La charte générale de la démonstration se présente comme telle.** La feuille livrée avec le
  jeu de démonstration n'était pas marquée « feuille générale » : l'écran la présentait comme une
  sous-feuille non rattachée, alors qu'elle habille bien tous les actes par défaut. Les
  référentiels de démonstration sont corrigés ; un référentiel existant peut se rectifier d'un
  clic, dans « Feuilles de style » › *Rôle* › **Feuille générale**.
- **La modalité d'une formalité est bien enregistrée.** Le formulaire de constatation (transmission,
  publication, notification) conservait le **libellé** choisi (« Télétransmission (@ctes /
  Démarches simplifiées) ») au lieu de son **identifiant** : la modalité ne se relisait plus dans
  les pièces et les listes. Les dossiers qui portent un libellé restent lisibles — l'affichage
  tolère les deux formes.
- **Enregistrer un nouvel acte ne vide plus l'écran de rédaction.** Le premier enregistrement d'un
  acte créé depuis une trame ne « rattachait » pas le brouillon à l'acte qu'il venait de créer : le
  redessin qui suit l'enregistrement repartait d'une **page blanche**, et le rédacteur pouvait
  croire son texte perdu (il était enregistré, mais l'écran ne le montrait plus). Le brouillon suit
  désormais l'acte créé, et une trame changée ne charge plus les valeurs d'un autre acte.

## [1.1.0] — 2026-09-20 — Créer une trame sans mode d'emploi

L'éditeur de trame s'adresse à des agents qui ne sont pas informaticiens : on y **montre** au
lieu de nommer, on **glisse** au lieu de choisir dans une liste, et chaque réglage fréquent est
une carte que l'on clique.

### Ajouté

- **Une réserve d'éléments et le glisser-déposer** dans l'éditeur de trame. Sous le plan, à
  gauche, trois groupes : *Vos champs*, *Rempli automatiquement* (collectivité, signataire,
  date…), *Ajouter un bloc* (intitulé, visas, article, tableau, signature…). On en tire ce que
  l'on veut **directement dans la page** : un champ se pose **au milieu d'une phrase**, à
  l'endroit exact où on le lâche ; un bloc se range **avant ou après** un autre, un trait bleu
  annonçant l'endroit. Un bloc peut aussi être saisi par sa poignée dans le plan, ou dans la
  page, pour être déplacé.
- **Le geste de repli, au clic** — pour qui ne maîtrise pas le glisser : cliquer une puce
  l'« arme », puis cliquer dans le texte suffit. Un bandeau rappelle la consigne tant que le
  geste n'est pas fini, et « Annuler » l'interrompt. Le clic et le glisser mènent au même
  résultat.
- **Le type d'un champ se choisit sur des cartes** : douze cartes illustrées, chacune avec un
  libellé d'usage (« Une date », « Un montant ») et un exemple, au lieu d'une liste déroulante.
- **Les questions du formulaire se replient** : repliées, elles tiennent en une ligne (nom,
  type, « obligatoire ») et le formulaire entier se lit d'un coup d'œil ; dépliées, elles
  livrent leurs réglages, y compris un moyen de placer le champ dans le texte depuis la question
  elle-même.

### Modifié

- **Onglets de l'inspecteur renommés** : « Ce bloc », « Questions », « Contrôles », « Trame » —
  le vocabulaire du code cède la place à celui des services. Le chapitre « Écrire une trame »
  du guide intégré a été récrit en conséquence, et décrit les deux gestes (glisser, ou cliquer
  puis cliquer).
- **Les réglages courts se choisissent d'un clic**, sans menu déroulant : statut d'une trame,
  transmission au contrôle de légalité, notification aux intéressés, gravité d'une règle,
  nature d'un commentaire, provenance d'un visa. Les listes déroulantes ne subsistent que là
  où elles sont inévitables (famille, type d'acte, feuille de style, circuit, référence
  juridique, mention).
- **Page d'accueil du dépôt (`README.md`) récrite pour un lecteur qui veut se servir du
  logiciel** — un agent, un responsable de service, un élu — et non pour un développeur : ce
  que le logiciel fait, comment l'essayer sans rien installer, ce qu'il advient des données,
  et comment l'installer (Pages ou serveur). Les consignes destinées à l'éditeur du générateur
  restent dans `src/README.md`.

### Corrigé

- **Les outils d'un bloc s'affichent à nouveau correctement** : une règle de style héritée
  visait une classe qui n'existe plus, si bien que la poignée de déplacement, les flèches et la
  corbeille formaient une barre constamment visible au lieu d'apparaître sur le bloc survolé ou
  sélectionné.

## [1.0.1] — 2026-09-20 — Collaboration : audit et correctif de la cloche

Audit complet des écrans et des services, en éprouvant la collaboration en direct
dans l'aperçu.

### Corrigé

- **La cloche de notifications n'affichait jamais les faits ciblant un rôle ou un
  service** (`role:…`, `service:…`) : le filtre de portée n'était pas alimenté par
  les actes visibles du compte (`src/ui/state.js`). Un dépôt au parapheur destiné aux
  administrateurs apparaît désormais aux administrateurs — et un fait ciblant un
  autre rôle reste filtré (vérifié dans l'aperçu).
- README : « onze permissions » — la table `PERMS` en compte onze depuis l'ajout de
  `api.gerer`, la documentation en annonçait dix.

### Ajouté

- Ce journal des versions, et la version du logiciel affichée dans l'application
  (menu du compte, écran « Documentation technique ») — `src/lib/version.js`.

## [1.0.0] — 2026-09-20 — Version 1 fonctionnelle

Première version figée. L'application couvre la chaîne complète d'un acte, de la
trame à la publication opposable. Démonstrateur configuré pour une collectivité
**fictive** (mairie de Valmont-sur-Loire) : rien de réel dans le jeu livré.

### Ajouté

- **Trames** : registre (liste, création, duplication, import/export JSON), éditeur
  de trame (plan, page éditable en place, inspecteur : blocs, champs, règles, trame,
  commentaires et règles signés du service de leur auteur).
- **Rédaction** : choix de l'acte à rédiger (brouillon en cours, acte enregistré,
  trame avec recherche), document éditable en place (WYSIWYG, pastilles de champs),
  écarts « hors trame » conservés et signalés (jamais bloquants), panneau
  « À compléter » / « Contrôle & écarts », enregistrement, historique des brouillons
  (vingt versions, restauration).
- **Exports** (format A4 pour l'impression et le PDF) : Akoma Ntoso 3.0, Schematron,
  JSON-LD/ELI, HTML autonome, Word (`.doc`), Markdown, JSON, impression.
- **Actes** : registre (numéro, objet, nature, conformité à la trame, statut,
  parapheur, exécution, corbeille réversible), fiche d'acte, recherche globale
  (Ctrl+K ou « / » : actes, trames, personnes, services, références, comptes, guide).
- **Parapheur** : circuits de validation du référentiel (étapes séquentielles, bon
  pour accord ou avis, ciblage trame/famille/entité), décisions motivées, empreinte du
  texte validé (une réécriture rend la validation caduque), file « à valider par moi ».
- **Exécution & délais** : échéancier des formalités (transmission au contrôle de
  légalité, publication, notification), date d'exécutoire, délai de recours, alertes
  de retard, constatations horodatées.
- **Signature & publication** : dépôt auprès du service (API REST), circuit de
  signature auprès du prestataire, original signé **réellement vérifiable**
  (ECDSA P-256 + SHA-256, horodatage), publication au recueil avec identifiant ELI,
  version en ligne, opposabilité, registre public, actes non publiables (individuels).
- **Modifier un acte** : édition en place de l'acte en vigueur, acte modificatif et
  version consolidée générés d'un seul geste, mentions « Modifié/Abrogé/Ajouté par »,
  suivi des modifications en option, versions publiées d'un même ELI (supplantation
  sans effacement).
- **Référentiel** (17 onglets) : identité et marque, vocabulaire, numérotation, entités,
  services et bureaux, personnes, rôles, références, mentions, familles, types d'actes,
  circuits de validation, exécution & délais, annuaire (OIDC), base de données, journal
  d'audit, données (export/import/vidage).
- **Feuilles de style** : charte graphique par entité/famille, marges du papier,
  en-tête/pied, filets, encadrés, tableaux, signature, cadre, préréglages, aperçu par
  le même code que les exports, édition directe WYSIWYG sur le style.
- **Comptes, rôles et périmètre** : trois rôles, onze permissions, périmètre par
  service/bureau, écran de connexion, gestion des comptes, garde-fous.
- **Annuaire (OIDC)** : flux code d'autorisation + PKCE, vérification du jeton
  (émetteur, audience, validité, nonce, signature JWKS), groupes → rôles, périmètre par
  revendications, création ou reprise des comptes, désactivation réversible des comptes
  de démonstration, annuaire d'essai intégré.
- **Collaboration** : présence des postes, verrou souple de rédaction, journal d'audit
  (300 derniers faits, filtrable), notifications et cloche.
- **Persistance** : façade à trois pilotes (locale IndexedDB, service partagé,
  serveur MySQL/MariaDB), synchronisation par enregistrement avec révisions, détection
  de conflits, miroir hors ligne, file d'écritures différées.
- **Apparence** claire / sombre (préférence de poste).
- **Guide d'utilisation** intégré (19 chapitres, glossaire, dépannage, impression) et
  **documentation technique** lue depuis les fichiers du dépôt.
- **Auto-hébergement** : pile Docker nginx + service Node + MariaDB, édition web de
  l'application, documentation d'exploitation et de sécurité.

### Limites assumées de cette version

- Le prestataire de signature est **simulé** (cryptographie réelle, certificat non
  qualifié eIDAS) ; aucun appel sortant réel.
- L'API de signature/publication est servie par le script serveur embarqué dans
  `index.html` (démonstration) ; son adresse n'est réglable que par le déploiement,
  pas depuis l'interface.
- La collaboration n'a pas de service dédié : elle repose sur la base partagée et sur
  un sondage (pas d'édition simultanée, verrou souple seulement).
- PDF/A certifié et bordereau SEDA : non livrés (voir `src/TODO.md`).
