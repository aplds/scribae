# Performance — ce que le service tient, et ce qui l'arrêtait

Ce document rapporte des **mesures**, pas des intuitions. Il dit comment elles ont
été prises, ce qu'elles ont mis au jour, ce qui a été corrigé — et ce qui reste
ouvert, pour que la prochaine campagne commence où celle-ci s'arrête.

Il a été écrit après une campagne de dix scénarios joués avec `src/server/charge/`
(voir son `README.md`). Les chiffres cités viennent de ces rapports, reproductibles
avec `--graine 1` : à graine égale, le trafic est identique d'une campagne à
l'autre.

## 1. Le banc, et ses limites

Le service a été éprouvé **lancé sur place**, avec une base EN MÉMOIRE
(`--sans-base`) : c'est le vrai service (mêmes routes, mêmes sessions, même
anti-CSRF, même sérialisation), mais `mysql2/promise` est remplacé par une base qui
exécute le schéma et **compte les ordres SQL** au lieu de les envoyer à MariaDB.

Ce que cela donne, et ce que cela coûte :

- les latences mesurées sont celles **du service**, pas celles d'un serveur de base
  ni du réseau — c'est bien ce que l'on veut quand on cherche un défaut de service ;
- le **nombre d'ordres SQL** est, lui, une propriété du service : il ne change pas
  d'un moteur de stockage à l'autre, et c'est le chiffre le plus utile au
  développeur ;
- une campagne `--latence 2` ajoute 2 ms par ordre et montre, elle, ce que coûte
  une base distante ;
- ce que le banc ne voit pas : le réseau entre l'agent et le reverse-proxy, le
  rendu du navigateur, et la contention réelle d'un moteur de stockage.

**Ce que le banc a appris à ne pas faire**, et qui est désormais dans l'outil :
donner à tous les postes simulés la **même adresse IP**. Le service compte les
requêtes par adresse pour se protéger ; avec une seule adresse, soixante agents
ressemblaient à un seul agent soixante fois plus bavard, et le limiteur de débit
refusait des gestes parfaitement normaux. Chaque poste porte donc maintenant sa
propre adresse, comme derrière le reverse-proxy du déploiement.

## 2. Le défaut : le gel du matin

### Le scénario

**Soixante postes, tous connectés dans la même seconde** — l'affluence du matin :
40 visiteurs du recueil, 8 lecteurs, 6 rédacteurs, 3 éditeurs, 1 réviseur,
1 signataire, 1 administrateur. Les vingt et un agents ouvrent donc leur session
au même instant, et la campagne dure 60 secondes.

### Avant

| Geste | Appels | p50 | p99 | max |
|---|---|---|---|---|
| `connexion/lecteur` | 8 | **2 619 ms** | 2 619 ms | 2 628 ms |
| `connexion/redacteur` | 6 | 2 619 ms | 2 619 ms | 2 619 ms |
| `public/recueil` | 770 | **0 ms** | **2 616 ms** | 2 617 ms |
| `public/publications` | 228 | 0 ms | 2 616 ms | 2 616 ms |
| `public/publication` | 236 | 0 ms | 2 616 ms | 2 616 ms |
| `public/sante` | 25 | 0 ms | 1 988 ms | 2 615 ms |

Le service répondait très bien — **quand il répondait**. Un visiteur sur cent du
recueil public attendait deux secondes et demie, et le pire cas atteignait 2 628 ms
pour tout le monde, y compris la sonde de santé, y compris les visiteurs anonymes
qui n'ont aucun mot de passe à vérifier.

### La cause

`server.mjs` dérivait le mot de passe avec **`scryptSync`**. `scryptSync` calcule
sur le **fil principal** : pendant environ 130 ms (N = 65536, mesuré sur ce poste),
le service ne répond plus à personne. Vingt et un agents se connectant ensemble,
ces dérivés s'additionnaient en série : 21 × 130 ms ≈ 2,7 s de gel **global**.

Ce que la campagne de contrôle montre sans ambiguïté : avec la **même charge**, mais
les connexions **étalées sur 30 secondes**, tout retombe à sa place — 131 ms par
connexion, recueil à 1 ms au p99, aucun point d'attention. Ce n'était donc ni le
nombre d'agents, ni le volume de données, ni la base : c'était l'instant où tout le
monde se connecte.

### Après

Le port de cryptographie de `server.mjs` emploie désormais **`scrypt` asynchrone**
(le même calcul, exécuté par le pool de fils de libuv). Le format des dérivés est
inchangé : les mots de passe déjà enregistrés restent valides, et rien n'a été
réécrit en base.

| Geste | Appels | p50 | p99 | max |
|---|---|---|---|---|
| `connexion/lecteur` | 8 | **209 ms** | 275 ms | 275 ms |
| `connexion/redacteur` | 6 | 404 ms | 534 ms | 534 ms |
| `connexion/editeur` | 3 | 534 ms | 660 ms | 663 ms |
| `connexion/administrateur` | 1 | 664 ms | 665 ms | 665 ms |
| `public/recueil` | 800 | 0 ms | **15 ms** | 16 ms |
| `public/acte` | 32 | 0 ms | 15 ms | 15 ms |

**Le p99 du recueil public passe de 2 616 ms à 15 ms** (le centuple), et le temps de
connexion du pire agent de 2 619 ms à 665 ms. Le service ne gèle plus : la file
d'attente des dérivés n'immobilise plus que ceux qui attendent leur mot de passe.

Les 665 ms qui restent sont la **queue de la file**, et elle a une explication
simple : le pool de fils de libuv compte **4 fils par défaut**. Vingt et un dérivés de
130 ms s'écoulent donc en 6 vagues ≈ 780 ms au pire. C'est un réglage
d'exploitation, pas un défaut de code — voir § 5.

## 3. Les cinq scénarios

Tous sur 60 actes, 25 trames, 8 informations et 12 publications de recueil. « Avant »
et « Après » désignent le mode de dérivation du mot de passe : c'est la **seule**
variable qui change entre les deux colonnes.

| Scénario | Postes | Réglages | Avant | Après |
|---|---|---|---|---|
| **1. Affluence du matin** | 60 | 60 s, connexions simultanées | 13 points d'attention ; recueil p99 2 616 ms | 5 points d'attention ; recueil p99 15 ms |
| **2. Matinée étalée** | 60 | 60 s, montée 30 s | recueil p99 1 ms, connexion 131 ms | identique |
| **3. Saturation** | 41 | 20 s, pensée 0 | 2 432 req/s ; connexion p50 1 450 ms | 3 212 req/s ; connexion p50 294 ms |
| **4. Écriture pleine** | 21 | 45 s, enregistrement des actes | 0 erreur ; recueil p99 2 ms | identique |
| **5. Base distante** | 31 | 30 s, 2 ms par ordre SQL | 1,3 ordre/requête ; 24 % du temps en base | identique |

### Scénario 2 — l'étalement suffit

C'est le contrôle du défaut : mêmes 60 postes, mêmes 60 secondes, mais les
connexions s'étalent sur 30 secondes. Résultat **identique avant et après** :
connexion à 131 ms (le seul coût du dérivé), recueil à 1 ms au p99, aucun point
d'attention. Une collectivité de soixante agents n'a donc pas de problème de
capacité : elle a (avait) un problème **d'affluence**.

### Scénario 3 — la saturation

41 postes sans temps de pensée, pendant 20 secondes : **3 212 requêtes par seconde**,
64 343 requêtes, **aucune erreur réseau, aucun 5xx**. Le débit progresse de 32 % par
rapport à l'état antérieur, parce que le service ne perd plus de temps à geler.

Les seuls refus (429) sont ceux du **limiteur de débit**, et ils sont le fait d'un
agent simulé qui écrit plus de 600 fois par minute sur la même route : c'est
exactement ce que le limiteur doit faire. Une trentaine d'agents réels, avec un
temps de lecture humain, n'y arrivent pas.

### Scénario 4 — l'écriture n'est pas le problème

21 postes, dont les neuf agents **enregistrent réellement** (`--ecriture pleine`,
45 secondes : actes et lignes de journal, plus la collection de chacun pour l'éditeur et
l'administrateur) : 2,1 ordres SQL par requête, aucune erreur, recueil public à 2 ms.
Le chemin d'écriture (synchronisation par différences, journal, verrous de
révision) ne se voit pas à cette échelle.

### Scénario 5 — le coût d'une base lointaine

31 postes, mais **chaque ordre SQL coûte 2 ms** (base distante, ou chargée). Le
service adresse alors **1,3 ordre SQL par requête HTTP**, et passe **près d'un quart
de son temps (23,7 %) à attendre la base**. Les routes en souffrent
proportionnellement : une lecture de collection passe de ~1 ms à **21 ms** au p50,
et une vérification de session à **17 ms**.

Rien à corriger ici — c'est le prix d'un aller-retour — mais deux choses se lisent
dans ces chiffres : le service est **bavard** en petits ordres (une session
coûte deux lectures : la session, puis le compte), et le **recueil public, lui, ne
paie rien** (1,6 ms au p99) : les publications sont tenues en mémoire et écrites à
la base par blocs, à chaque changement. C'est ce qui rend le recueil public
insensible à la latence de la base — et c'est un choix à préserver.

## 4. Ce qui a été corrigé

| Fichier | Changement | Pourquoi |
|---|---|---|
| `src/server/mysql/server.mjs` | `scryptSync` → `scrypt` asynchrone | supprimer le gel global pendant les dérivés |
| `src/server/mysql/comptes.mjs` | `scellerMotDePasse` / `verifierMotDePasse` deviennent asynchrones (le port peut rendre une promesse) ; le dérivé factice est **engagé au démarrage** | le domaine attend le dérivé sans présumer de la façon dont il est calculé ; une vérification à vide garde exactement le coût d'une vérification réelle |
| `src/server/mysql/comptes.test.mjs` | tests asynchrones + un test qui fixe le contrat « le port peut rendre une promesse » | qu'un retour au dérivé synchrone ne passe pas inaperçu |
| `src/server/charge/moteur.mjs` | un poste **rend toujours la main** entre deux gestes, même à `--pensee 0` | sans cela, un poste sans pause garde la file des micro-tâches pleine et **aucun minuteur ne s'exécute** — pas même ceux du service mesuré : la campagne mesurait son propre blocage |
| `src/server/charge/statistiques.mjs` | le minimum et le maximum d'un seau se calculent **en boucle**, jamais par `Math.min(…valeurs)` | la saturation range des dizaines de milliers de durées dans un même seau ; l'étalement d'un tel tableau en arguments fait sauter la pile |
| `src/server/charge/faux-mysql.mjs` | la latence simulée **compte dans le temps passé dans la base** | sans quoi un rapport sur base distante annonçait « 0,1 % du temps » alors que l'aller-retour est précisément ce qu'on mesure |
| `src/server/charge/client.mjs` | chaque poste porte sa propre adresse (`x-forwarded-for`) | ne pas faire accuser le limiteur de débit d'avoir refusé des gestes normaux |
| `src/server/mysql/magasin-mysql.mjs` | la ligne de collection est créée par `INSERT … ON DUPLICATE KEY UPDATE revision = revision` (verrou **exclusif** d'emblée) ; les écritures d'une collection passent par une **file**, et une transaction heurtée est **rejouée** | `INSERT IGNORE` prenait un verrou **partagé** qu'il fallait ensuite élever en exclusif : deux écritures simultanées de la même collection se heurtaient (`ER_LOCK_DEADLOCK`), saturaient le pool de connexions et faisaient paraître le service **figé** |
| `src/server/mysql/comptes.mjs` | même idiome à l'écriture d'un compte | la même élévation de verrou y guettait |
| `src/lib/db/index.js` | les écritures d'une **même collection** se suivent, une à la fois | deux écritures concurrentes partaient du même index connu, calculaient le même delta et se rejouaient l'une l'autre |
| `src/lib/collab.js` | les battements de cœur de présence sont **fusionnés** (un en vol, un seul rattrapage) | l'intervalle, le retour de visibilité, le changement d'écran et l'ouverture d'un brouillon écrivaient `presence` à répétition |
| `src/server/charge/faux-mysql.mjs` | la base en mémoire connaît `sb_migrations` (création, insertion, lecture par version) | `migrations.mjs` interroge cette table depuis que les migrations sont versionnées : `--sans-base` échouait à l'application du schéma, et aucune campagne ne pouvait se jouer |
| `src/server/charge/charge.test.mjs` | une épreuve tient l'interprétation de `sb_migrations` | qu'un ajout de migration ne la casse pas en silence |

## 5. Les réglages qui en découlent

- **`UV_THREADPOOL_SIZE`** — c'est lui qui décide combien de dérivés de mot de passe
  avancent en même temps. Les 4 fils par défaut suffisent à une arrivée étalée ; une
  collectivité où **beaucoup d'agents se connectent à la même minute** gagnera à le
  porter à 8 ou 16. À poser dans l'environnement du conteneur (`docker-compose.yml`),
  avant le démarrage de Node : la valeur est lue au lancement, et n'est pas
  modifiable ensuite.
- **La mémoire, en regard du pool.** Un dérivé réclame `128 × SCRYPT_N × r` octets —
  **~64 Mio** aux valeurs par défaut — et les dérivés **en cours** se cumulent : 8 fils
  ≈ 512 Mio, 16 fils ≈ 1 Gio. Ouvrir le pool sur une machine qui n'a pas la mémoire
  pour le tenir échange une file d'attente contre un échangeur : sur une petite
  machine, il vaut mieux **baisser `SCRYPT_N`** que multiplier les fils.
- **`SCRYPT_N`** — le coût du dérivé. Le durcir protège mieux en cas de vol de base,
  et allonge d'autant la file de connexions : les deux se règlent ensemble.
- **`RATE_MAX_CONNEXIONS`** (30 par minute et par adresse) — c'est lui qui borne,
  avant tout calcul, une attaque par force brute sur les mots de passe. Il mérite de
  rester bas.
- **`MAX_PUBLIES`** (40) — le recueil est tenu en mémoire : c'est ce qui le rend
  insensible à la latence de la base, et c'est aussi ce qui borne sa taille.

## 6. Ce qui reste ouvert

Pistes, par ordre d'intérêt, pour une prochaine campagne :

1. **La vérification de session coûte deux lectures** (la session, puis le compte) à
   chaque requête authentifiée. Sur une base distante, cela pèse 17 ms par appel.
   Un cache court (quelques secondes) par jeton de session le supprimerait — au prix
   d'un délai de propagation pour la révocation d'une session. À mesurer avant de
   trancher : la révocation immédiate est une propriété de sécurité, pas un détail.
2. **Une lecture de collection coûte une dizaine d'ordres.** S'il s'agit d'un
   balayage ligne par ligne, c'est le prochain gisement de performance — et la
   campagne `--latence` est faite pour le montrer.
3. **Le seuil d'alerte du moteur** (1000 ms au p99) mérite d'être resserré quand le
   service sera au vert partout : les 665 ms de file d'attente des connexions ne
   sont pas visibles avec un seuil d'une seconde.
4. **Reprendre la campagne 1 avec `UV_THREADPOOL_SIZE=8` et `=16`** pour chiffrer le
   réglage plutôt que de le recommander de principe.
