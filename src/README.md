# Scribae — éditeur de trames et d'actes administratifs

Application web pour une administration qui produit des actes :
les **administrateurs** préparent des **trames** (structure + champs + règles + commentaires), les
**services** les remplissent, le système **compile** l'acte et l'exporte dans des formats
ouverts et normés (Akoma Ntoso, Schematron, JSON-LD/ELI, HTML imprimable).

> **Démonstrateur.** Le jeu de données livré est **entièrement fictif** : il configure
> l'outil pour la **mairie de Valmont-sur-Loire**, avec ses entités satellites (CCAS, caisse
> des écoles), ses rôles, ses personnes, ses références (CGCT, CGFP, décret régies…), sa
> numérotation d'arrêtés et son recueil. Rien de réel. Voir `src/lib/seed.js` (référentiel et
> trames) et `src/lib/demo-actes.js` (les actes).
>
> Le jeu fait vivre une **collectivité d'une certaine importance** : **soixante-neuf actes** sur
> **vingt-cinq trames**, dont dix-sept publiés au recueil public. Il met en avant ce que la
> collectivité montre d'abord — les **annexes** (le règlement d'accès à la restauration scolaire
> et la grille tarifaire des services municipaux, entre autres : un document adopté ne se signe
> pas, son texte suit l'original de l'acte qui l'adopte) et les **événements à venir** (la fête
> du village, le marché de Noël, la cérémonie du 11 novembre).

👉 **Lire `SPEC.md` d'abord** : contraintes, modèle de données, langage d'expression,
formats d'export, périmètre.

👉 **Exploitation / auto-hébergement** : `docs/ADMINISTRATION.md` (administrateurs,
exploitants) et `server/README.md` (installation Docker). La démonstration publique est servie
**en statique, depuis GitHub Pages** — **<https://demo.scribae.eu>** ; pour un service de
production, le dossier `server/` fournit la pile complète (nginx + service Node + MySQL/MariaDB)
et l'édition web de l'application.

## Flux de travail : Perchance ↔ GitHub

**Consigne de travail permanente. À lire avant toute modification du code.**

1. **Le développement se fait ici, sur Perchance.** `main.pjs`, `index.html` et `src/` sont la
   copie de travail : c'est là qu'on écrit, qu'on essaie et qu'on vérifie dans l'aperçu.
   Rien d'autre ne compte tant que la version n'est pas figée.
2. **Les versions finalisées sont déposées sur GitHub.** Le dépôt est la référence *publiée* :
   une version n'existe qu'une fois poussée là-bas. C'est l'utilisateur qui dépose (ou qui
   demande de préparer le dépôt) — on ne considère jamais une version comme livrée sans cela.
3. **L'utilisateur peut fournir un lien GitHub** (dépôt, dossier, fichier, archive). Dans ce
   cas, **avant d'écrire la moindre ligne** :
   - **comparer** les deux états : lire dans le dépôt `src/lib/version.js` (`APP_VERSION` et
     `APP_RELEASED`) et la **première entrée datée** de `src/CHANGELOG.md`, puis les comparer à
     ceux d'ici ;
   - **GitHub au même niveau, ou en retard** → on travaille ici normalement, sur la copie
     Perchance ;
   - **GitHub plus récent** → **on met d'abord Perchance à jour depuis GitHub** : récupérer les
     fichiers du dépôt, les réécrire **à l'identique** dans `src/`, `main.pjs` et `index.html`,
     vérifier que l'application tourne encore (aperçu live, console sans erreur, un écran de
     chaque famille), **puis seulement** traiter la demande en cours. On ne fusionne pas à
     moitié : c'est le dépôt qui fait foi, on le reporte tel quel.
   - En cas de doute sur la fraîcheur, **demander** plutôt que d'écraser : une version Perchance
     plus avancée qui écrase le dépôt fait perdre du travail.
4. **Chaque livraison laisse une trace** : ouvrir une entrée datée dans
   **`src/CHANGELOG.md`** (rubriques `Ajouté` / `Modifié` / `Corrigé` / `Retiré`) et vérifier
   que `APP_VERSION` (`src/lib/version.js`) correspond **au titre de la première entrée datée**,
   lettre comprise. Le changelog est lisible dans l'application — **Documentation technique ›
   Journal des versions** — et dans le dépôt.
   **Entre deux livraisons**, le travail achevé ne reste pas sans trace : chaque correction
   reçoit une **note de version intermédiaire** dans le changelog — un numéro de correctif
   suivi d'une lettre (`1.3.1a`, `1.3.1b`…), datée. Un lot **publié sous une note
   intermédiaire** est une version comme une autre : `APP_VERSION` la porte alors telle quelle.
5. **Ne jamais livrer deux fois le même numéro.** Si le dépôt a déjà le numéro d'ici, c'est
   qu'une livraison a eu lieu : incrémenter avant de figer, jamais réutiliser.

### Récupérer un dépôt GitHub (recette)

- **Un fichier** : `https://raw.githubusercontent.com/<compte>/<dépôt>/<branche>/<chemin>`
  (par exemple `.../main/src/lib/version.js`) — à enregistrer dans `scratch/` puis à comparer
  avec le fichier de `src/`.
- **Le dépôt entier** :
  `https://github.com/<compte>/<dépôt>/archive/refs/heads/<branche>.zip` → décompresser dans
  `scratch/` (outil `execute_js` + `@zip.js/zip.js`) et comparer fichier par fichier avec
  `src/`.
- **Comparer avant de copier** : le dépôt peut contenir ce qui n'appartient pas à l'édition
  Perchance (outillage, `node_modules`, artefacts de build, `.git`). `src/` ne doit recevoir
  que ce que le générateur sert réellement (voir « Workspace » dans les notes de l'agent).
- Le dépôt contient aussi `.nojekyll` (obligatoire pour GitHub Pages, voir plus bas) : sa
  présence dans le dépôt ne veut pas dire qu'il doit exister dans `src/`.

### Exporter le dépôt GitHub (recette)

L'export est un **zip dont la racine EST le dépôt**. C'est la racine qui est lue par un
intégrateur, par une forge et par un agent : l'outillage y est donc rangé **à sa place
attendue**, et le code de l'application sous `src/`.

| Dans l'atelier | À la racine du dépôt | Pourquoi |
|---|---|---|
| `src/scripts/**` | `scripts/**` | l'outillage se lance depuis la racine (`npm run lint`, `npm test`) |
| `src/tests/**` | `tests/**` | les épreuves transverses (voir `tests/README.md`) |
| `src/compose-exemple/**` | `compose-exemple/**` | l'exemple de premier déploiement, que l'administrateur cherche à la racine |
| `src/package.json` | `package.json` | le manifeste, lu par npm et par la forge |
| `src/github/ci.yml` | `.github/workflows/ci.yml` | la chaîne d'intégration |
| `src/github/gitignore` | `.gitignore` | |
| `src/docs/GITHUB.md` | `README.md` | la page d'accueil du dépôt |
| `src/AGENTS.md` | `AGENTS.md` | les consignes d'un agent qui reprend le dépôt |
| `src/CLAUDE.md` | `CLAUDE.md` | le pointeur de Claude Code vers `AGENTS.md` |
| `index.html`, `main.pjs` | `index.html`, `main.pjs` | la page et son code, servis par GitHub Pages |
| *(écrit par l'export)* | `CNAME`, `.nojekyll` | l'adresse publiée, et de quoi empêcher Jekyll |
| tout le reste de `src/` | `src/**` | l'application, servie telle quelle par le navigateur |

**Un fichier, un seul exemplaire.** Une source recopiée à la racine **ne reste pas** dans
`src/` : le dépôt ne porte ni deux `package.json` ni deux outils — un doublon ferait corriger
le mauvais fichier en silence. L'export **exclut** donc de l'arbre `src/` tout ce qu'il déplace
(`scripts/`, `tests/`, `compose-exemple/`, `package.json`, `github/`, `AGENTS.md`, `CLAUDE.md`,
`docs/GITHUB.md`). Conséquence pour une mise à jour : ce qui a changé de place doit être
**supprimé** du dépôt
(`git rm -r src/scripts src/tests src/compose-exemple src/github src/package.json src/docs/GITHUB.md`)
avant de décompresser le zip par-dessus — sinon les anciens chemins demeurent, et l'on corrige un
fichier que personne ne lit.

**Dans l'atelier, l'outillage vit sous `src/`** (`src/scripts/`, `src/tests/`) : c'est le seul
arbre que la plateforme conserve d'une séance à l'autre. Il est pourtant **écrit pour la
disposition livrée** — le code y est `../src/…`, l'outillage `../scripts/…`. Trois choses le
rendent tenable : `tests/README.md` le dit à qui ouvre un fichier d'épreuve, `scripts/racine-code.mjs`
**constate** la racine du code au lieu de la supposer, et le harnais de l'atelier **simule la
disposition livrée** (voir `docs/INDUSTRIALISATION.md` § 2).

Recette : écrire les fichiers dans un zip (outil `execute_js` + `@zip.js/zip.js`, niveau 9,
dates fixes pour un export reproductible), en excluant `node_modules`, `scratch/`, `.git` et
les fichiers système, en appliquant la table ci-dessus (et en écartant de `src/` ce qu'elle
déplace). Le nom du fichier porte la version courante — `scribae-v<APP_VERSION>-github.zip` — et
l'archive se décompresse **à la racine** du dépôt.

Les fichiers sont écrits en **0644**, sauf les scripts (`*.sh`), qui doivent l'être en
**0755** : c'est ce que `git` enregistre (le bit exécutable), et ce qu'une décompression
ordinaire restitue. `@zip.js/zip.js` n'écrit que 0644 — le mode se corrige après coup dans
les **attributs externes** des entrées de l'annuaire central du zip (champ `external file
attributes`, 16 bits de poids fort), en laissant le reste de l'archive intact.

Le zip porte en outre **`package.json`** (recopie de `src/package.json`) et
**`.github/workflows/ci.yml`** (recopie de `src/github/ci.yml`) : la racine est lue par
l'intégrateur et par la forge, `src/` par le navigateur. Les commandes du manifeste désignent
l'outillage **là où il vit dans le dépôt** (`scripts/…`, `tests/`, `src/server/mysql/`) : rien
n'est dupliqué, et `npm run verifier` fonctionne **depuis la racine**. `scripts/verifier-syntaxe.mjs`
et `scripts/verifier-style.mjs` retrouvent leur arborescence tout seuls, qu'ils soient lancés
depuis la racine du dépôt livré ou depuis l'atelier, où tout voisine sous `src/`.

Le `.gitignore` ajouté à la racine vaut ceci — il est recopié de
`src/github/gitignore`, qui en est la source (comme `ci.yml`), et il ignore
`data/` : le dossier du rangement par FICHIERS (`STOCKAGE=fichier`) contient les
actes, les comptes et les sessions, et n'a rien à faire dans un dépôt public. Le
`.env` n'est **jamais** commité : il porte les secrets de déploiement (voir
`docs/VARIABLES.md`, qui ne montre aucune valeur).

```gitignore
# Dépendances
node_modules/

# Secrets de déploiement — jamais commités (voir src/server/env.example)
.env
.env.local

# Données du service en « rangement par fichiers » (STOCKAGE=fichier) : elles
# contiennent le référentiel, les actes, les comptes et les sessions. Elles
# n'ont rien à faire dans un dépôt public, et se sauvegardent en copiant le
# dossier (voir docs/ADMINISTRATION.md, § Rangement des données).
data/

# Fichiers système
.DS_Store
Thumbs.db
*~

# Réglages LOCAUX des assistants de code (Claude Code, Mistral Vibe) : ils
# dépendent du poste et de la session. Les instructions PARTAGÉES, elles, sont
# versionnées : AGENTS.md (lu par les deux) et CLAUDE.md.
.claude/settings.local.json
.vibe/
```

Le `CNAME` ajouté à la racine vaut ceci — **une ligne**, sans schéma ni barre oblique. C'est
l'adresse à laquelle GitHub Pages sert la démonstration (voir « Démonstration statique »
ci-dessus), et par conséquent **l'origine** à laquelle le stockage des visiteurs est attaché.
La changer — ou publier la même page sous une seconde adresse — revient à ouvrir une
démonstration **neuve** : les données d'un visiteur restent attachées à l'adresse où il les a
produites. Un fork remplace ce fichier, ou le supprime.

```cname
demo.scribae.eu
```

Le dépôt porte aussi des fichiers que l'export **ne contient pas** : `LICENSE` (GPL-3.0), le
dossier `.git/`, et d'éventuels fichiers tiers. On décompresse donc l'archive **par-dessus un
clone existant**, jamais dans un dossier vidé au préalable — sinon on supprime la licence.

```sh
git add -A
git commit -m "<titre de l'entrée de changelog de la version>"
git push
```

`src/docs/GITHUB.md` et le `README.md` du dépôt doivent rester **cohérents** : le premier est
la source, le second la copie publiée (c'est ce que l'export recopie).

**Vérifier et tester avant de livrer** — `npm run verifier` (syntaxe, style, épreuves), la CI, et
ce qui reste à mettre en place : `docs/INDUSTRIALISATION.md`. Des fichiers de `src/` sont
destinés à la **racine du dépôt** et y sont recopiés par l'export (`package.json`,
`scripts/`, `tests/`, `github/ci.yml` → `.github/workflows/ci.yml`, `AGENTS.md`,
`CLAUDE.md`) — même convention que `docs/GITHUB.md` (→ `README.md`).

**Destinataire de `docs/GITHUB.md` : un tiers qui veut *se servir* du logiciel** — un agent, un
responsable de service, un élu curieux —, **jamais un développeur**, et surtout jamais la
personne qui édite ce générateur. Conséquence : on n'y parle **ni de Perchance, ni de `src/`,
ni du flux de travail, ni des recettes d'export, ni de `APP_VERSION`** — tout cela vit ici ou
dans `SPEC.md`. On y parle de ce que le logiciel fait, de la façon de l'essayer, de ce qu'il
advient des données, et de la façon de l'installer (Pages ou serveur). Les seuls renvois
techniques admis sont `src/server/README.md` et `src/docs/ADMINISTRATION.md`, qui s'adressent
au service informatique du lecteur — et l'on dit à qui ils s'adressent. **Toute consigne
destinée à l'éditeur du générateur reste dans ce fichier-ci.**

## Identité du logiciel (nom + marque)

Le logiciel s'appelle **Scribae** (pluriel latin de *scriba* : les rédacteurs d'actes).
Tout ce qui porte l'identité s'écrit dans **deux modules**, et deux seulement :

- **`src/lib/logiciel.js`** — ce que le logiciel dit de lui-même : le **nom** (`APP_NAME`), la
  **licence** (`LICENCE`) et l'**adresse de sa documentation** (`DOCUMENTATION`). Le module est
  *pur*, sans aucune dépendance : c'est ce qui permet au **service** de le lire aussi — sa
  bannière de démarrage annonce les trois mêmes valeurs (voir `src/server/README.md`) ;
- **`src/ui/brand.js`** — la **devise** (`APP_TAGLINE`, affichée dans l'en-tête `app.js` et en
  tête du guide `views/aide.js`) et la **marque** :
  - `markSvg(size)` / `markEl(size)` — la marque : une **forme pleine** (un document à coin
  coupé) dont le chevron est une **découpe**, en `currentColor`, donc *une seule teinte* qui
  tient sur fond clair comme sur fond sombre (en-tête : noir du texte ; guide : bleu) ;
  - `markDataUrl()` — la même marque en data URL à teinte fixe (favicon).

Le nom est **réexporté** par `src/ui/brand.js`, la licence et la documentation par
`src/ui/mention.js` : l'interface n'a donc qu'un module d'identité à connaître, et les trois pieds
de page ne peuvent pas diverger de la bannière du service.

À quoi d'autre toucher si le nom change : `$meta.title` / `description` (`main.pjs`), le
`<link rel="icon">` de `index.html`, le nom des autorités de certification de la
démonstration (`src/lib/signature.js`), et les captures du guide (leur en-tête montre le
nom — voir plus bas). Et **régénérer le miroir du service** (`node scripts/generer-logiciel.mjs`,
voir `src/server/README.md`) : sans quoi le journal du conteneur continuerait d'annoncer l'ancien
nom.

> **Registre à ne pas confondre** : `brand` dans le référentiel (`seed.js`) est la
> **structure qui utilise l'outil** (la mairie de démonstration) : son nom, son logo, ses
> couleurs. `Scribae` est le **logiciel**. Dans l'en-tête, la gauche est le logiciel
> et la pastille de droite rappelle la structure.

## Démonstration, ou référentiel vierge

La démonstration est décidée par le **DÉPLOIEMENT** : un seul commutateur, **`DEMO`** dans le
`.env` du service (voir `src/server/env.example`). La question se tranche à **un seul endroit**,
`demoActif()` (`src/lib/demo.js`) ; `config.brand.demo` n'en est qu'un **miroir** — il voyage avec
les données exportées et importées, et fait foi quand aucun déploiement ne parle (aperçu en ligne,
page statique).

- **Allumée** (le défaut de l'aperçu en ligne ; `DEMO=true`, ou `AUTH_MODE=demo`, ou
  `DEMO_ACCOUNTS=true`) : l'application sème le **jeu fictif livré** — identité, entités,
  assemblées, services, personnes, rôles, références, familles, trames, actes et comptes — et
  affiche le **bandeau orange** « Démonstration ».
- **Éteinte** (`DEMO=false`) : l'application part d'un **référentiel VIERGE**
  (`seedConfigVierge()`, `src/lib/seed.js`) — identité neutre (« Mon établissement », aucun
  blason), vocabulaire, numérotation, délais et mentions du recueil génériques — et **aucune
  donnée de fiction** : les collections restent vides, `bootstrap()` ne sème ni trame, ni acte,
  ni personne, ni compte. Le premier écran invite à construire le référentiel.

Le bandeau :

- **Élément** : `src/ui/notice.js` (`demoNotice()`, `viergeNotice()`, `isDemo()`, `DEMO_TEXT`),
  posé par `app.js` (coquille) et par `views/connexion.js` ; styles `.app-demo` et `.app-vierge`
  dans `app.css`. Le bandeau de démonstration l'emporte : les deux ne s'affichent jamais ensemble.
- **Réglage du texte** : `Administration › Identité › Mention de démonstration` — un **texte
  libre** (`brand.demoText`, vide = phrase d'origine) ; le choix *Afficher / Masquer* ne subsiste,
  comme réglage du référentiel, que quand **aucun déploiement** ne parle (aperçu, page statique).
- **Portée** : le bandeau marque l'**application** — l'écran de connexion, l'en-tête de
  l'atelier **et le recueil public** — mais **pas les documents produits** (un acte exporté ou
  publié ne porte pas la mention).
- Les captures du guide ont été prises **avant** l'introduction du bandeau, volontairement :
  elles montrent l'application en service (bandeau coupé), pas la démonstration. Les repères
  restent valides tels quels.

**Sortir de la démonstration.** `Administration › Données › « Repartir d'un référentiel
vierge »` efface le référentiel, les trames et les actes du poste, **et** — sur le
service partagé — les actes déposés, les circuits de signature et les publications (route
`POST /v1/admin/purge`, réservée à l'administration) : sans cela, basculer `DEMO=false`
laisserait les données fictives en place, et les publications au recueil public.

Les **comptes** suivent leur propriétaire (note 1.3.2p). En démonstration — et sans service —, ils
font partie du jeu fictif et partent avec lui. Quand la connexion passe par le **service**
(comptes locaux à mot de passe, ou annuaire), ils sont **CONSERVÉS** : leurs mots de passe vivent
chez lui (`sb_motdepasse`), **hors du référentiel**, si bien que les effacer ne supprimait aucun
accès — et l'installation se retrouvait sans personne pour se connecter, le compte
d'administration compris. C'est `comptesDuDeploiement()` (`src/lib/auth.js`) qui tranche, et
`clearAll({ garderComptes })` (`src/lib/store.js`) qui exécute. Le service **rétablit d'ailleurs
son compte d'administration** au démarrage si le référentiel l'a perdu et que son mot de passe est
resté (`src/server/mysql/amorcage.mjs` — mot de passe conservé, jamais remplacé), et la commande
de secours `printf '%s' "$MDP" | node server.mjs --mot-de-passe <identifiant>` **crée** le compte
s'il n'existe plus.

## Réglages déclaratifs (`.env`)

Le déploiement peut **poser** des réglages de référentiel qui, sinon, se saisissent dans
l'interface : identité, vocabulaire des actes, numérotation, délais, recueil public, fonctions.
Une seule déclaration les décrit — le registre **`src/server/mysql/variables.mjs`**, qui porte
leur portée, leur type, leurs bornes et leur rôle. Il en découle la validation (au démarrage
du service), le transport au navigateur (`GET /v1/config`) et le wiki des variables
(`src/docs/VARIABLES.md`, engendré par `node scripts/generer-variables.mjs`).

Côté client, `src/lib/deploiement-config.js` reçoit ces réglages et `bootstrap()`
(`src/lib/store.js`) les applique **par-dessus le référentiel** — en mémoire seulement : le
`.env` l'emporte, mais le référentiel enregistré reste celui de l'administrateur ; une variable
retirée n'est plus imposée au lancement suivant, et l'interface reprend la main. C'est le même
principe que `AUTH_MODE` pour le mode de connexion (voir `src/lib/auth.js`).

## État actuel (v1 fonctionnelle)

| Écran | État |
|---|---|
| **Trames** (liste, création, duplication, import/export JSON) | ✅ |
| **Éditeur de trame** (plan / page éditable en place / inspecteur : bloc, champs, règles, trame — commentaires et règles **signés du service** de leur auteur ; administrateurs **et** éditeurs ; bloc **« Division »** pour un texte long, **échelle des divisions** réglable — nombre d'échelons, mot imprimé, numérotation —, et **nature du document** : acte ou annexe) — **les commentaires se posent sur ce qu'on voit** (bouton sur chaque bloc, ou **passage sélectionné dans la page** et cité par la pastille « Commenter ») et **se voient dans la page**, sous le bloc visé, avec repère de marge, compteur d'en-tête et onglet « Commentaires » | ✅ |
| **Rédiger** (choix de l'acte à rédiger — rédaction en cours, acte enregistré, ou trame avec recherche — puis document éditable en place : WYSIWYG, pastilles de champs, **bibliothèque de variables glissables**, **blocs déplaçables — flèches et glisser-déposer, avec renumérotation** —, **ajout et retrait d'un bloc ou d'un élément d'un seul clic**, **clic sur un bloc → onglet « Bloc »** (intitulé, numérotation, échelon, éléments, ajouts, retrait), **divisions** (Livre, Titre, Section…) et leurs cartes **« Annexe » / « Annexes »**, **consignes de la trame affichées sous le passage concerné** (onglet « Consignes » et compteur d'en-tête), écarts « hors trame » — réécritures, réglages et structure —, panneau « À compléter » / « Contrôle & écarts », exports) | ✅ |
| **Exports** (Akoma Ntoso, Schematron, JSON-LD/ELI, HTML, **Word (.doc)**, Markdown, JSON — tous au **format A4** pour l'impression et le PDF) | ✅ |
| **Actes** (registre local : numéro, objet, nature, conformité à la trame, statut, parapheur, exécution, export ; pastille **« abrogé »** / **« abrogation prévue »** ; **corbeille réservée aux brouillons**, les actes signés ou publiés passant par **« Retirer / abroger »**) | ✅ |
| **Annexes** (un document adopté par un autre — règlement, tableau : **pas de numéro propre**, pas de signature ; son texte suit l'acte qui l'adopte, dans le même original signé ; identification par la décision d'adoption — « Annexe à la délibération n° … » ; ni autorité ni mention de publication au recueil, mais les **visas** sont conservés ; modification par **adoption d'une nouvelle rédaction**, en suivi des modifications) | ✅ |
| **Règlements** (une annexe déclarée **Règlement** sur sa trame est en outre publiée **à part au recueil, à titre informatif** : texte normatif qu'on consulte pour lui-même, comme un **code**, sous son propre identifiant stable `eli:/fr/reg/…` — les publications successives en sont les **versions**, la dernière déposée étant en vigueur ; page sans opposabilité ni original, mais avec l'acte qui l'adopte ; il se cherche et se classe par thème au recueil) | ✅ (démonstration) |
| **Parapheur** (circuit de validation du référentiel : étapes séquentielles à **trois natures** — vérification, visa, signature —, chacune confiée à un rôle, ciblage trame/famille/entité, décisions motivées, empreinte du texte validé, reprise de circuit ; file « à valider par moi ») | ✅ |
| **Documents non juridiques** (verbatim d'assemblée, déclaration, vœu : signés et **publiés au recueil** sous identifiant ELI, mais **sans opposabilité, sans entrée en vigueur et sans délai de recours** — le recueil les présente comme des documents) | ✅ |
| **Reprises d'actes anciens** (les actes antérieurs à la mise en service du recueil : texte écrit **librement**, **date de publication d'origine nécessairement antérieure au jour**, **original signé joint** à la main — PDF ou scan, empreinte SHA-256 —, et **publication d'un seul geste**, sans circuit de signature, **à titre informatif** ; **mention au bas de la page publiée** disant que seul l'original conservé fait foi ; identifiant ELI daté de l'**année du numéro d'origine** ; **textes autonomes** — règlement intérieur, charte — repris sous l'identifiant d'un règlement ; registre **à part** des actes ; permission `actes.reprendre`, rédacteurs seulement) | ✅ |
| **Révision** — rôle « Réviseur » **cumulable** : contrôle de l'acte entre l'envoi à signature décidé par le rédacteur et l'envoi effectif (rapport de conformité, correction, validation — elle déclenche l'envoi — ou rejet motivé, l'acte revenant en brouillon) ; **compétence** par compte ou portée par un service (ou certains de ses bureaux), ciblée services/familles/trames/types d'actes/entités ; empreinte du texte révisé ; porte de signature (client et service) | ✅ |
| **Exécution & délais** (échéancier des formalités : transmission au contrôle de légalité, publication, notification ; **recours introduit** et sa date d'introduction ; date d'exécutoire, délai de recours, alertes de retard ; **pièces du dossier** : état des formalités, attestation de non-recours) | ✅ |
| **Recherche globale** (Ctrl+K ou « / » : actes, trames, personnes, services, références, comptes, guide) | ✅ |
| **Corbeille** (suppression réversible des actes **et** des trames, restauration, suppression définitive ; seuls les actes encore en brouillon peuvent y être mis — un acte signé ou publié s'abroge ou se retire du recueil, il ne se supprime pas) | ✅ |
| **Journal d'audit & historique des brouillons** (tous les faits, filtrables ; vingt versions par acte, restauration) | ✅ |
| **Collaboration** (présence des postes, verrou souple de rédaction, notifications et cloche) | ✅ |
| **Modifier un acte** (l'acte en vigueur est **édité en place**, comme dans un traitement de texte : ajout et retrait d'un **paragraphe**, d'une **ligne de liste** ou d'une **ligne de tableau** ; **réattribution d'un numéro** à un article — le numéro doit être libre — ou **« tout renuméroter »** ; la confirmation produit l'acte modificatif + la version consolidée, puis le circuit signature → publication rend la consolidation opposable et supplante l'originale) | ✅ |
| **Abroger un acte, ou l'un de ses articles** (prévu **dès la rédaction** d'un acte, y compris un acte non modificatif : on vise au référentiel l'acte — ou tel article d'un acte — à abroger ; la clause d'abrogation s'ajoute au document, et l'abrogation prend effet **au jour de l'entrée en vigueur** de l'acte qui la porte, non à sa publication ; l'acte abrogé le devient en bloc, l'article abrogé est consolidé) | ✅ |
| **Signature électronique** — réglages de l'**API du prestataire** (transport, adresse, prestataire, niveau de signature, adresse de notification, délai, et les quatre points de terminaison : document, signataires, démarrage, statut) posés dans l'Administration ou déclarés dans le `.env` (`SCRIBA_SIGNATURE_API_*`), la **clé restant au service** (`SCRIBA_SIGNATURE_API_CLE`, jamais dans le référentiel ni dans une réponse) ; ouverture réelle du circuit par le **service**, retour de l'acte signé et vérification par empreinte | ✅ (démonstration hors service) |
| **Signature électronique simple** — signer **dans l'application**, sans prestataire : fenêtre de signature (document, identité du signataire, empreinte, **déclaration à cocher**), signature cryptographique et horodatée, **trace nominative** (nom, fonction, adresse électronique, compte, moyen d'authentification, poste) conservée dans l'**original interne** ; réglage **global** ou **par trame** (*imposée* / *autorisée*) | ✅ (démonstration) |
| **Original signé à deux parts** — **part publique** (nom, fonction, date, empreinte, certificat, horodatage : ce que voit le recueil, l'export JSON et les routes ouvertes) et **part interne** (mentions nominatives, authentification, poste, courriels : rangée au registre, servie par la seule route protégée `GET /v1/actes/{id}/dossier-signature`, lue par « Dossier de signature (interne)… ») | ✅ (démonstration) |
| **Notifications par courriel** (six événements activables — acte à signer, signé, publié, à valider, à réviser, notification à l'intéressé —, expéditeur, adresse de réponse, copie systématique ; le service parle au **serveur SMTP** du `.env`, `SMTP_*` ; message d'essai ; un envoi qui échoue est tracé « non envoyé » au journal **et** au dossier interne de l'acte) | ✅ (service auto-hébergé ; indisponible en démonstration) |
| **Circuit de signature externe** — signer **sans API** (papier, outil tiers) : réglage **global** ou **par trame** (*imposé* / *autorisé*), **téléchargement** du document prêt à signer (bordereau de remise), dépôt de la **version signée** en PDF (empreinte SHA-256, hébergement), **certification de conformité** par le réviseur (file dédiée dans « Révision »), publication tenant l'ordre « version signée → conforme → publié » (`409 version_signee_absente` / `conformite_non_certifiee`) et **version signée montrée comme l'original** sur le recueil public | ✅ (démonstration) |
| **Le signataire** — rôle « Signataire » **cumulable**, **attribué par la désignation** dans l'organigramme des délégations ; **compte** rapproché de celui de l'outil de signature ; **onglet « Ma signature »** (actes qui attendent sa signature, actes signés au titre de sa délégation) ; **champ de compétence** (l'atelier ne montre que les actes dont sa signature relève) | ✅ |
| **Publication & ELI** (dépôt au recueil, identifiant ELI, opposabilité, original signé, registre de l'administration) | ✅ (démonstration) |
| **Recueil public** (site sans compte : accueil — **carrousel des derniers actes publiés** et **thèmes** par lesquels on parcourt les actes, **effacés dès qu'une recherche est en cours** pour ne laisser que les résultats —, recherche et filtres dont le **thème**, liste groupée par année, texte de chaque acte rendu dans la page — les actes s'affichent par défaut **dans leur version la plus récente**, avec une case **« Afficher les versions antérieures »** et une case **« Afficher les articles abrogés »** —, adresse citable ; les **règlements** publiés à titre informatif y comptent parmi les publications ; les actes **réservés aux agents** — `reserve` — en sont écartés pour un visiteur anonyme, qui doit se connecter) | ✅ |
| **Recueil ouvert** (robots et agents : adresse de référence par acte, représentations JSON / Markdown / texte / Akoma Ntoso, métadonnées de page et JSON-LD, fichiers `llms.txt`, `recueil.json`, `sitemap.xml`, `robots.txt` sur un déploiement serveur) | ✅ |
| **Bulletin (ou Journal) des actes** (Administration › Bulletin : la collectivité **ouvre** son bulletin, lui donne une **cadence** — quotidienne, hebdomadaire, bimensuelle, mensuelle, bimestrielle, trimestrielle, semestrielle, annuelle, ou **personnalisée** — et un **jour de parution** ; chaque numéro **rassemble les actes publiés sur sa période**, classés **par entité puis par thématique**, et **une période sans publication ne donne aucun numéro** ; diffusion par **sous-page par numéro** au recueil public — `.json`, `.md`, `.txt` —, par **flux RSS 2.0 et Atom 1.0**, et par **courriel aux abonnés** — double consentement, désabonnement d'un clic ; le service **clôt les périodes, compose et expédie** à chaque passe, et le numéro en cours se lit en **aperçu provisoire**) | ✅ (démonstration : le service de démonstration n'a pas de SMTP, l'abonnement y reste fermé et le dit) |
| **Recueils extérieurs et renvois** (Administration › Publication : recueils **« bis »** tenus hors de Scribae, recueils **inactifs** avec leur **période** — plusieurs peuvent se succéder —, et **sites de référence** Légifrance / service-public.gouv.fr ; affichés en bas de page de l'espace public et au bout des résultats de recherche, « **Vous ne trouvez pas ce que vous recherchez ?** ») | ✅ |
| **Mentions du recueil public** (Administration › Publication : **mentions légales** rappelant les règles de publication et d'opposabilité des actes — L. 2131-1 CGCT, R. 421-1 CJA — et **mentions d'accessibilité** — loi du 11 février 2005, RGAA, Défenseur des droits —, écrites par l'administrateur, remplacées par un **lien** vers le site de la collectivité, ou **désactivées** ; repliées sous leur titre en bas de page du recueil) | ✅ |
| **Mention de l'éditeur du logiciel** (les trois pieds de page — recueil public, atelier, écran de connexion — portent « **Propulsé par Scribae — GPLv3** », le nom renvoyant à la documentation du logiciel ; Administration › Identité permet de l'**éteindre**) | ✅ |
| **Réglage « Publication automatique »** (Administration › Publication : publier au retour signé, ou laisser l'acte au registre pour une administration qui publie ailleurs) | ✅ |
| **Administration** (identité, vocabulaire, numérotation — **séquence interne ou service externe**, entités, personnes, rôles, **services et bureaux**, références, mentions, familles, types d'actes, données) | ✅ |
| **Chrono de numérotation** (tous les rangs attribués — année, entité, type d'acte, numéro composé, état de l'acte, dates, rédacteur —, **rangs jamais attribués** et **numéros annulés** avec leur motif ; compteurs, filtres, tri par colonne, **export CSV et XLSX** ; portée du chrono — un seul, un par entité ou un par type d'acte —, **passage à l'année suivante** et annulation d'un rang ; un numéro n'est **jamais attribué deux fois**) | ✅ |
| **Organigramme** (entités → services → bureaux, en arbre ou en liste, même toile que les délégations : fiche de chaque maille, **signataire principal** d'une entité, **entité autonome ou rattachée** à une autre — le cas d'une régie sans personnalité morale propre mais avec son directeur, ses services et ses actes —, entités hors arbre signalées) | ✅ |
| **API REST documentée, avec panneau de commande** (*Aide › API REST*, et `docs/API.md` engendré) : toutes les routes du service — rôle exigé, paramètres, corps, réponses, champs notables, exemple cURL —, et la possibilité de **jouer la requête pour de vrai** depuis l'application (chemin, corps et jeton modifiables, réponse avec code et durée ; l'appel figure dans « API & journal ») | ✅ |
| **Feuilles de style** (charte graphique : marges, typographie, couleurs, **deux emblèmes en en-tête — à gauche et à droite du filet**, chacun sa hauteur, en-tête, pied, filets, **encadrés à côtés choisis**, **listes à puces et listes numérotées « 1° 2° 3° »**, tableaux, signature, cadre ; **graisse de la formule d'autorité** — normal, italique, **gras**, gras italique —, les feuilles enregistrées avant ce choix gardant leur rendu ; préréglages ; résolution trame → entité → famille → générale ; **éditeur direct WYSIWYG sur le style**) | ✅ |
| **Apparence claire / sombre** (bouton d'en-tête, choix « Automatique » dans le menu du compte ; préférence de poste, le papier reste blanc) | ✅ |
| **Assistants « Plume » et « Publia »** (mode d'emploi pour l'atelier, actes publiés pour le recueil ; **nom** et **icône** réglables par l'administrateur, **masquables par chaque agent** dans le menu du compte ; réponses renvoyant par des **liens cliquables** — le chapitre du guide, l'acte du recueil ; Publia connaît l'**acte consulté** et répond d'abord sur lui) | ✅ (démonstration) |
| **Comptes et rôles** (écran de connexion, 6 rôles — dont le **réviseur** et le **signataire**, cumulables, et le **visiteur**, sans accès —, gestion des comptes, **périmètre par service/bureau**, compétence de réviseur, **champ de compétence de signature et rapprochement du compte de l'outil de signature**, contrôle d'accès) | ✅ (démonstration) |
| **Annuaire de la collectivité (OIDC)** (connexion par le fournisseur d'identité, PKCE, vérification du jeton, groupes → rôles, périmètre par revendications, **désactivation automatique des comptes de démonstration**, **écran d'accueil du visiteur sans rôle**, annuaire d'essai intégré ; **les comptes locaux restent joignables** — le bloc « Ou par un compte local » de l'écran de connexion donne accès au **compte d'administration du `.env`** et aux comptes créés à la main, même annuaire injoignable) | ✅ |
| **Comptes locaux (mot de passe)** (mode `AUTH_MODE=password` du `.env` : dérivé `scrypt` — jamais le mot de passe —, blocage après échecs, session en cookie `HttpOnly` + anti-CSRF, compte d'administration créé depuis le `.env`, remise d'un mot de passe provisoire depuis *Comptes et rôles*, mode démonstration réglable) | ✅ |
| **Base de données** (pilotes local / service partagé / **serveur MySQL-MariaDB** externe, synchronisation par enregistrement, conflits, file hors ligne) | ✅ |
| **Auto-hébergement** (pile Docker nginx + service Node + MySQL/MariaDB, édition web de l'application, transport HTTP) | ✅ |
| **Bibliothèque de trames partagée / multi-poste** | ✅ (mode partagé ; export/import JSON toujours disponible) |
| **Guide** (wiki intégré : 30 chapitres — dont le chrono de numérotation, l'organigramme, l'API REST, les informations du recueil et les reprises d'actes anciens —, glossaire, dépannage, fiche mémo, impression) | ✅ |
| **Export PDF/A** (PDF/A-2b et PDF/A-1b : mise en page réelle par l'application — marges, police, filets, tableaux, annexes, signature —, **polices et profil sRGB embarqués**, langue, métadonnées et identifiant ELI ; la conformité reste à valider par `veraPDF` sur un déploiement) | ✅ |
| Bordereau SEDA | ⏳ |

### Comptes et rôles

L'accès se fait par un **écran de connexion** (« Qui se connecte ? ») qui liste les comptes
disponibles : la simulation d'annuaire/SSO tient lieu d'authentification (aucun mot de passe
— c'est un démonstrateur). La session choisie est mémorisée (`kv.actesSession`) : recharger la
page reconnecte le dernier compte ; *Changer de compte* (menu du compte) ramène à la liste.

Ce mode (« comptes de l'application ») n'est qu'un des trois : le référentiel peut **brancher
l'annuaire de la collectivité** (OpenID Connect), auquel cas les comptes de démonstration sont
**désactivés automatiquement** ; et le **déploiement** peut exiger de **vrais comptes locaux, avec
mot de passe** (`AUTH_MODE=password` dans le `.env`), le service vérifiant alors les mots de passe
et ouvrant les sessions. Voir « Annuaire de la collectivité (OIDC) » et « Comptes locaux
(mot de passe) » plus bas.

Cinq rôles d'application — dont **deux qualités cumulables** (Réviseur, Signataire) —, plus le
**Visiteur**, définis **une seule fois** dans `src/lib/users.js` (`ROLES`, classés par rang) :

| Rôle | Rang | Ce que le rôle débloque |
|---|---|---|
| **Administrateur** | 3 | tout, y compris le **référentiel**, les **comptes et rôles**, l'**API & journal** |
| **Éditeur** | 2 | les **trames** (créer, modifier, commenter ; les feuilles de style des actes à venir), rédiger et gérer les actes |
| **Rédacteur** | 1 | rédiger un acte et mener les actions associées (enregistrer, signer) — **uniquement ses actes** ; choisit son modèle dans « Rédiger un acte » (pas d'accès au registre des trames) |
| **Réviseur** | 2 | **cumulable** (il ne remplace pas un profil) : contrôler les actes avant leur signature — rapport de conformité, correction, validation, rejet motivé (voir « La révision ») |
| **Signataire** | 2 | **cumulable** (il ne remplace pas un profil) : la **qualité de signer** (voir « Le signataire »). L'onglet **« Ma signature »**, les actes de son **champ de compétence** dans l'atelier. Il **découle d'une désignation** dans l'organigramme des délégations |
| **Visiteur** | 0 | **aucun accès** : l'atelier ne lui est pas ouvert, il ne lui reste que l'**espace public**. C'est l'état d'un compte authentifié dont aucun rôle n'est reconnu (voir « L'identité reconnue sans rôle »). Une **qualité cumulée** (signataire, réviseur) l'emporte sur ce profil : elle lui rouvre le seul écran qu'elle commande, et rien d'autre |

**Les qualités `Réviseur` et `Signataire` se cumulent.** Un compte porte une **liste** de rôles
(`user.roles`) dont le premier est le **rôle principal** (celui qui s'affiche et que lisent
l'annuaire, la présence et le journal) ; `user.role` reste écrit en miroir, et `rolesOf(user)` est
la **seule** lecture des rôles — un compte à rôle unique reste lu sans migration.
`primaryRoleId` **écarte les rôles cumulables** du choix du principal : ajouter la qualité de
réviseur, ou celle de signataire, à un rédacteur ne le transforme pas en « profil réviseur » ou
« profil signataire ». `estCumulable`, `setRoles`, `toggleRole`, `badgesOf`, `permsOfUser` et
`ROLE_ORDER`/`ROLES_CUMULABLES` portent tout cela.

**Le signataire** (`src/lib/signataires.js`) — l'auteur de l'acte, celui dont la signature engage
la collectivité. Sa qualité **découle d'une désignation** : dès qu'une personne est désignée dans
l'organigramme des **Délégations** (comme délégant ou comme délégataire), `assurerRoleSignataire`
attribue le rôle au **compte rattaché à cette personne** (`user.personId`) — sans qu'il faille
être administrateur (un éditeur, qui modifie les délégations, l'attribue de la même façon). Un
signataire **signe avec son compte** : la **personne du référentiel** est rattachée à son compte,
et ce compte est **rapproché du compte de l'outil de signature** (`etatRapprochement`,
`rapprocher`, `deRapprocher`, `compteOutilDeSignature` — le rapprochement s'écrit sur la
personne : `personne.signature`). Enfin, son **champ de compétence** : il ne voit, dans l'atelier,
que les actes dont la signature relève de lui — les siens et ceux de ses **délégataires**
(`competenceDeSignature`, `competenceDuCompte`, `fileSignature`, `placeDansChaine`). **Signer n'est
pas envoyer** : `envoyerEnSignature` (permission `actes.signer`, partagée avec les rédacteurs, les
éditeurs et les réviseurs) dépose l'acte et ouvre le circuit ; la signature, elle, est apposée par le
**titulaire** de l'étape — le dernier étage de la chaîne — **et** seulement s'il porte la qualité
(`peutSignerEffectivement`, le contrôle unique des trois gestes de signature). Signer (`actes.signer`)
est aussi une permission **distincte** de la publication (`signature.gerer`).

Les dix-neuf permissions (`PERMS`, `src/lib/users.js`) sont la **source unique** du contrôle
d'accès *et* de la matrice affichée dans « Comptes et rôles » : `can(user, perm)` est appelée
partout (nav, boutons, routes) et interroge **tous** les rôles du compte. Ajouter une permission,
c'est ajouter une ligne à `PERMS` et l'exiger là où c'est utile — la matrice suit toute seule.
Une **vue** peut aussi être ouverte à tous (entrée `null` dans `VIEW_PERMS`) tout en gardant sa
*modification* derrière une permission : c'est le cas de `delegations` (`delegations.gerer`).

- `state.js` expose `can(perm)`, `currentUser()`, `login()`, `logout()`, `visibleActes()` et
  `visibleTrames()` (filtrent selon le **périmètre**, voir ci-dessous ; un rédacteur ne voit
  en outre que les actes dont il est l'auteur ; `actes.tous` montre tous les actes).
  `visibleActes()` ouvre en outre au compte les actes dont sa **compétence de révision**
  (`peutReviser`) ou sa **compétence de signature** (`competenceDeSignature`) relève —
  `fileSignature()` rend la file de l'onglet « Ma signature ».
- `app.js` porte la barre de gauche (`NAV`), rangée en six rubriques — **Produire** (trames,
  rédaction, modification, registre, corbeille), **Valider** (parapheur, révision), **Publier**
  (signature et publication, exécution et délais, publications ELI, recueil public),
  **Organisation** (organigramme, délégations, chrono), **Configurer** (administration,
  feuilles de style) et **Aide** (guide, API REST, documentation technique) : l'ordre suit la
  vie de l'acte, et les référentiels de la collectivité ne sont pas rangés parmi les gestes de
  production. Il filtre la barre (`NAV[].perm`), la vue (`VIEW_PERMS`) et **replie sur
  le premier écran autorisé** : un rédacteur qui demande `#/referentiel` ou `#/trames` est
  ramené à la rédaction. Une vue **inconnue** est ramenée, elle, à la page d'accueil du site —
  le recueil public (`normaliserRoute`). Le registre des trames est réservé aux éditeurs et aux
  administrateurs (`trames.voir`) ; un rédacteur choisit son modèle dans « Rédiger un acte »
  (`visibleTrames()`, qui n'est pas filtré par la permission mais par le périmètre).
- Les actes enregistrés portent `createdBy` / `createdByName` (auteur affiché dans le registre
  et la fiche de l'acte), ainsi que `serviceId` / `bureauId` (leur affectation).
- L'écran **Comptes et rôles** (`views/comptes.js`, réservé à `comptes.gerer`) liste les comptes
  (état, dernier accès), permet d'en créer/désactiver/supprimer, d'**ouvrir une session** à la
  place d'un compte, de **régler son périmètre** (voir ci-dessous), et de **réinstaller les
  comptes de démonstration**. Garde-fous : on ne supprime pas son propre compte et il reste
  toujours au moins un administrateur actif.
- Les comptes sont semés par `seedUsers(config)` (`src/lib/users.js`) — **onze comptes fictifs**
  rattachés aux services de Valmont-sur-Loire ; `store.js` les sème s'il n'y en a pas
  (`SEED_VERSION`), l'export/import JSON du référentiel les inclut, `clearAll()` les efface.

### Organisation : services, bureaux, périmètre

Le **rôle** dit ce qu'un compte peut *faire* ; le **périmètre** dit *sur quoi*. Deux notions
distinctes, l'une ne remplaçant pas l'autre (`src/lib/scope.js`).

- La collectivité se range en **services** (`config.services = [{ id, code, name, entityId,
  parentId, bureaux: [{ id, name }] }]`), chacun subdivisé en **bureaux**. Ils se décrivent dans
  **Administration › Services**.
- Un service peut **dépendre d'un autre service**, ou du **bureau d'un autre service**
  (`service.parentId`) : l'organigramme n'est pas seulement une entité portant des services, c'est
  un **arbre**. Le **périmètre suit la chaîne** — `servicesRattachesA` et `coveredBureaux`
  (`src/lib/scope.js`) : le périmètre d'un service couvre **ce service et ses descendants**, si bien
  qu'un agent affecté en **haut de chaîne** voit tous les actes de la chaîne **en contrebas**, et
  `scopeLabel` dit en clair ce que le périmètre couvre.
- L'**organigramme s'édite dès le rôle d'éditeur** (permission `organigramme.gerer`, portée par
  l'administrateur **et** l'éditeur) : ajouter ou retirer un **service** ou un **bureau**, régler
  leurs **rattachements**. L'ajout ou la suppression d'une **entité**, elle, reste à
  l'**administrateur** — un éditeur n'en règle que les relations descendantes. Les retraits opérés
  depuis le référentiel sont tracés au **journal d'audit**. C'est l'écran
  `src/ui/views/organigramme.js` qui porte l'arbre, et `src/ui/views/referentiel.js` le panneau
  « Services » qui les crée.
- Un compte porte ses rattachements : `user.memberships = [{ serviceId, bureaux }]`, où
  `bureaux` vaut `null` (ou est absent) pour **tous les bureaux** du service, ou une liste
  d'`id` pour **restreindre** l'accès à certains bureaux seulement.
- Les **trames** (`trame.serviceId` / `trame.bureauId`) et les **actes** (`acte.serviceId` /
  `acte.bureauId`) portent la même affectation. `null` = **général** : une trame générale est
  visible par tout le monde.
- `inScope(target, user)` tranche (admin : toujours vrai ; `serviceId` nul : vrai ; sinon un
  membership doit couvrir le service et le bureau). `servicesInScope`, `bureauxInScope`,
  `coveredBureaux`, `scopeLabel`, `targetLabel`, `primaryServiceName` alimentent l'interface.
- Un compte **transverse** (`allServicesMemberships()`, tous les services cochés) travaille
  sans frontière de service : c'est le cas, dans la démonstration, du directeur des affaires
  juridiques.
- **Migrations additives** (`store.js`) : un référentiel antérieur à cette notion reçoit les
  services de démonstration (les trames existantes y sont rattachées) ; les comptes de
  démonstration sans `memberships` sont re-semés. `SEED_VERSION` n'est **pas** incrémenté :
  ces migrations sont idempotentes et laissent intactes les données d'un utilisateur.

En production, l'écran de connexion serait remplacé par le SSO / l'annuaire de la
collectivité, et `users.js` ne garderait que la table des rôles et permissions.

### Le choix du signataire : par la fonction, jamais par le nom

`src/lib/fonctions.js` et `src/ui/signer-picker.js` portent une règle de conception : **on ne
désigne pas un signataire dans un annuaire de noms**. On choisit d'abord la **fonction** — la
qualité qui donne compétence pour signer l'acte — puis, **parmi les personnes qui la tiennent**,
celle qui signe.

- **Le catalogue des fonctions** (`fonctionsDeSignature`) réunit les **rôles** du référentiel
  (toutes les personnes qui portent le rôle ont la fonction) et les **délégations** en vigueur dont
  le périmètre convient à l'acte (`scoreDelegation` : organisation, famille, type d'acte — une
  délégation d'une autre organisation, ou visant une autre famille, est écartée). Chaque fonction
  est désignée par une clé stable — `role:<id>` ou `del:<id>` — et porte ses **personnes**
  (`personnesAyantQualite`) : les titulaires du rôle, ou les délégataires de **même qualité dans la
  même organisation** — plusieurs personnes peuvent tenir une qualité, chacune par sa propre
  délégation. Une fonction que personne ne tient est écartée.
- **Le champ de trame** est de type **`signataire`** (les trames antérieures, de type `person`, sont
  converties au démarrage — `migrateSignatureFields`, `store.js`). Il garde `values.signataire` =
  l'identifiant d'une personne, ce qui laisse *tout le reste* de l'application inchangé, et range à
  côté, sous `values.<id>Fonction` (`champFonction`), la **clé de la fonction retenue**. La
  propriété `qualite` du champ fixe facultativement la **fonction attendue** par la trame : dans la
  démonstration, l'arrêté portant délégation de signature est signé « par le maire ».
- **Le sélecteur** (`signerPicker`) fait le choix en deux temps — la fonction (groupée « Fonctions
  (rôles) » / « Par délégation de signature »), puis la personne. Quand une fonction ne peut être
  tenue que par une personne, celle-ci est retenue d'office ; un choix délibéré du rédacteur n'est
  jamais défait. Le même sélecteur sert dans la pastille du document (`wysiwyg.js`) et dans l'acte
  modificatif (`modifier.js`).
- **La qualité imprimée** ne change pas : elle vient de la délégation quand il y en a une (c'est un
  fait du référentiel). Le rôle retenu ne tranche que dans l'autre cas — une personne qui porte
  plusieurs rôles signe sous celui de la fonction choisie (`enrichirSignataire`, `opts.roleId`).

### Le signataire

`src/lib/signataires.js` — module **pur** — tient tout ce qui distingue l'auteur de l'acte d'un
agent ordinaire :

- **La qualité** (`ROLE_SIGNATAIRE`) est **cumulable** et **découle d'une désignation** :
  `assurerRoleSignataire(users, personId)` l'attribue au compte rattaché à la personne dès qu'elle
  est désignée dans l'organigramme des **Délégations** (délégant ou délégataire) — y compris quand
  la désignation est faite par un **éditeur**. Le jeu de démonstration en fait autant au démarrage
  (`migrateDemoSignataires`, `store.js`, additif et réservé à la démo).
- **Le rapprochement.** `etatRapprochement` dit où en est un signataire (`{ personne, compte,
  declare, courriel, compteOutil, ok, motif }`) ; `rapprocher` / `deRapprocher` l'écrivent sur la
  **personne** (`personne.signature`, donc exportable) ; `compteDePersonne` /
  `compteOutilDeSignature` font les deux liens. Il se corrige depuis **Délégations** (fiche d'un
  acteur), **Comptes et rôles** (fiche du compte, champ « Personne du référentiel — qui signe ») et
  **Ma signature**.
- **Le champ de compétence.** `competenceDeSignature`, `competenceDuCompte`, `peutSignerActe`,
  `signatairesPourActe`, `fileSignature`, `placeDansChaine`, `situationDeSignature` lisent la
  **chaîne de signature** de l'acte : un signataire ne voit que les actes dont sa signature relève
  — les siens et ceux de ses délégataires. `visibleActes()` en tient compte, et `fileSignature()`
  alimente l'onglet **« Ma signature »**. Le signataire EFFECTIF d'un acte est celui que l'acte
  désigne (`values.signataire`), ou, à défaut, le **signataire principal de son entité** — un acte
  pris sans désignation a donc bel et bien un signataire, et il entre dans sa file.
- **Qui signe, et qui envoie.** `peutSignerEffectivement(config, user, acte, trame)` est le
  **contrôle unique** de la signature : il exige d'être le **titulaire** (le dernier étage de la
  chaîne, `effectif`) **et** de porter la **qualité** (`ROLE_SIGNATAIRE`). Un délégant figure dans
  la chaîne sans être le titulaire ; un réviseur, un éditeur, un administrateur peuvent ENVOYER
  l'acte (`envoyerEnSignature`), non l'engager. Les trois gestes de signature — simple,
  électronique, dépôt d'une version signée — le traversent, et l'outil du prestataire comme la
  fenêtre de signature simple ne s'ouvrent que pour le titulaire. `fileSignature` distingue ce qu'il
  a **à signer** (`aSigner` : il est titulaire, l'acte n'est pas signé) de ce qu'il **suit**
  (`engagee` : les actes signés au titre de sa délégation).

### Qualités du signataire et délégations de signature

`src/lib/delegations.js` réunit deux choses qui parlent du même objet — **qui signe, et de quel
droit** :

- **L'accord en genre.** Chaque **rôle** du référentiel porte ses deux formes (`m` et `f` :
  « maire »/« maire », « directeur général des services »/« directrice générale des services ») ;
  le `label` n'est qu'un repère de liste et ne s'imprime jamais. Le genre d'une personne se déduit
  de sa **civilité**, et se force par `accord: "m"|"f"` sur sa fiche (Administration › Personnes) —
  le cas par cas d'une femme maire qui tient à « le maire ». `avecArticle` compose « le »/« la »,
  ou « l' » devant une voyelle. Le bloc de signature imprime la qualité accordée puis le
  **Prénom Nom** du signataire, sans civilité (`personSignatureName`, `render.js`).
- **L'arbre des délégations** (`config.delegations`, écran **Délégations** — un écran de plein
  droit, visible par tous les comptes, modifiable par les seuls administrateurs et éditeurs ;
  voir `src/ui/views/delegations.js`). Une
  autorité délègue une **qualité** (propre à la délégation — « adjoint au maire *en charge de
  l'urbanisme* ») à un délégataire, pour des matières données, éventuellement ciblées sur une
  famille et un type d'acte, et rattachée à une **organisation**. Le délégataire peut
  **sous-déléguer** : c'est dérogatoire, et l'arbre n'est pas borné. `chaineDeSignature` remonte la
  chaîne (profondeur bornée, garde anti-cycle) ; `arbreDelegations` la rend pour l'écran.
  **Désigner quelqu'un ici lui attribue la qualité de signataire** (délégant comme délégataire) :
  voir « Le signataire » (`src/lib/signataires.js`).

**Chaque chaîne est indépendante.** Une délégation est donnée *dans le nom d'une organisation* :
par défaut celle de son délégant (`entiteDeDelegation`), ou celle qu'un `entityId` explicite
impose — le cas du maire qui délègue dans le nom du CCAS qu'il préside. À la lecture,
`meilleureDelegation` **écarte d'emblée les délégations d'une autre organisation** : la chaîne d'un
établissement ne se mêle jamais à celle de la commune, même si une même personne y tient des
délégations des deux côtés. Une délégation n'est retenue qu'à la **date de l'acte**
(`values.dateSignature`) : on ne signe pas en mars sur le fondement d'une délégation donnée en juin.

**Les autorités autonomes.** Toutes les chaînes ne descendent pas du maire : un établissement
public — un office, un centre de gestion, un syndicat — a sa propre autorité de tête, le
**président de son conseil d'administration**, et sa propre chaîne, parallèle à celle de la
commune. Une personne **sans délégation entrante** est traitée comme une autorité de tête
(`signataire.autonome`) : son rôle lui donne sa qualité, et l'organisation qu'elle engage donne sa
formule d'autorité.

À la compilation (`compile.js`), l'entité est lue **en premier** (c'est elle qui décide de la
chaîne applicable), puis le signataire : `ctx.signataire` porte `genre`, `qualite`,
`qualiteArticle(Maj)`, `delegue`, `autonome`, `chaine`, `qualites` (les lignes prêtes) et `autorite`
(l'autorité de tête, avec son `entiteId`). La formule d'autorité de l'entité accepte un jeton
`{qualite}`, remplacé par la qualité accordée de l'autorité de tête. Le document — aperçu,
impression, Word, HTML, Akoma Ntoso, Markdown — imprime alors les qualités traversées et, seul, le
nom du signataire :

> Le Maire,
> Par délégation, l'adjoint au maire en charge de l'urbanisme,
> Par subdélégation, le chef de bureau Urbanisme,
> Karim BENALI

Le rédacteur voit la chaîne résultante **sous le champ « Signataire »** de l'écran de rédaction.
La démonstration en donne le cas d'école : un **permis de construire** (trame
`tpl-permis-construire`) signé par le chef du bureau Urbanisme, qui tient sa compétence du maire
par l'adjoint à l'urbanisme. Elle donne aussi l'autre cas, l'**autorité autonome** : une décision de
l'**office public de l'habitat** (trame `tpl-marche-oph`, entité `ent-oph`) signée par sa directrice
générale sur délégation du président de son conseil d'administration — une chaîne qui ne remonte
pas au maire :

> Le président du conseil d'administration,
> Par délégation, la directrice générale de l'office,
> Nadia MARCHAND

Sa formule d'autorité (« {qualite} de l'office public de l'habitat du Valmont ») et ses visas sont
les **siens** (`ref-oph-reglement`, `ref-oph-deliberation`) ; son acte suit aussi son **propre
circuit de validation** (`cir-oph`).

**Les décisions fondant la signature.** Chaque étage de la chaîne tient son pouvoir de décisions :
l'autorité de tête, de celle qui lui a donné son pouvoir ; un **délégataire**, de **deux** — la
décision de **nomination** qui l'a nommé à sa fonction, et la décision de **délégation** qui lui a
donné le pouvoir de signer. Chacune se renseigne d'un **acte publié au recueil**, d'un **lien
externe**, ou d'une **référence du référentiel** qui porte son adresse ; de toute façon l'acte publié
(web et PDF) porte l'intitulé **et le lien cliquable**. Renseigné sur la **fiche de la personne**
(`fondementRefId`, « Décision fondant son pouvoir de signer ») et sur chaque **délégation**
(`nomination`/`acteRefId`), l'ensemble entre de lui-même dans les **visas** de l'acte — voir
`decisionsDeSignature`. Une **trame** l'appelle par une entrée de chaîne (`{ chaine: true }`) dans un
bloc `visas` : l'emplacement est celui de la trame, la série vient du référentiel. Une délégation
dont l'une des deux décisions manque **ne peut pas être créée** — et si elle a été enregistrée avant,
elle est **signalée** (badge, alerte, contrôle de conformité). Sur une signature par subdélégation
(maire → adjoint → chef de bureau), l'acte vise ainsi dans l'ordre la délibération qui a donné son
pouvoir au maire, puis, à chaque étage, la nomination et la délégation. La démonstration les porte :
`p-faure` (délibération du conseil), et les quatre délégations de `seed.js`.

## Annuaire de la collectivité (OIDC)

Le **mode d'authentification** se lit à deux endroits, et le second fait autorité :

| Mode | Où il se règle | Effet |
|---|---|---|
| `demo` (défaut) | référentiel (`config.auth`) | écran de connexion listant les **comptes de l'application** (démonstration, sans mot de passe) |
| `oidc` | référentiel (`config.auth`) | la session s'ouvre chez le **fournisseur d'identité** de la collectivité |
| `password` | **déploiement** (`AUTH_MODE` dans le `.env` du service) | **comptes locaux** : identifiant + mot de passe vérifiés par le service, session dans un cookie |

**L'annuaire se règle partout, et peut être une SECONDE PORTE.** Depuis la note **1.6.1n**, les
réglages de l'annuaire sont disponibles **dans tous les modes** — les quatre cartes de
Administration › Annuaire (mode de connexion, fournisseur d'identité, rôles et périmètre, porte de
secours) sont toujours affichées — et le `.env` les porte tous (`SCRIBA_ANNUAIRE_*`, 22 variables
déclaratives, validées par le registre `src/server/mysql/variables.mjs`). L'annuaire peut en outre
être proposé **en seconde porte**, à côté de la porte ordinaire (comptes locaux, ou comptes de
l'application) : `auth.annuaire` dans le référentiel, ou `SCRIBA_ANNUAIRE_SECONDE_PORTE=true` ;
l'écran de connexion propose alors les deux (`annuairePropose`, `annuaireSecondePorte`,
`annuaireFermePour` dans `src/lib/auth.js`, `src/ui/views/connexion.js`). En mode « comptes
locaux », le référentiel n'étant lisible qu'avec une session, c'est le SERVICE qui publie les
réglages (`GET /v1/auth/config`, champ `annuaire`, liste blanche : `src/server/mysql/annuaire.mjs`)
— sans quoi l'écran de connexion, qui vient avant, ne saurait jamais que l'annuaire est branché.

Le mode `password` est un mode de **déploiement** : c'est le service qui détient les dérivés de mot
de passe et qui ouvre les sessions, il est donc seul à savoir si la porte est un jeton ou un
identifiant. Il est annoncé au navigateur par `GET /v1/auth/config` (`src/lib/motdepasse.js`,
`setDeploiementAuth` dans `src/lib/auth.js`), et posé en amont par `web/config.js.template` →
`host.js` (`window.__SCRIBA_AUTH__`). En mode `password` :

- **rien n'est chargé avant la session** : `state.init()` (`src/ui/state.js`) lit le mode, dessine
  l'écran de connexion avec la marque par défaut, puis n'appelle `chargeDonnees()` qu'après avoir
  obtenu une session (cookie) — le référentiel n'est pas lisible sans elle ;
- l'écran de connexion est `panneauMotDePasse()` (`src/ui/mot-de-passe.js`) ; les comptes de
  démonstration, quand le déploiement les laisse ouverts, sont **annoncés par le service**
  (`demoComptes`), puisque le référentiel est hors d'atteinte ;
- le formulaire de connexion est un vrai `<form>` et « Se connecter » en est le **bouton de
  soumission** : la touche Entrée, depuis l'identifiant comme depuis le mot de passe, emprunte le
  même chemin que le clic (un formulaire à plusieurs champs et **sans** bouton de soumission n'est
  pas soumis implicitement par le navigateur) ;
- les écritures portent le jeton anti-CSRF (`enteteCsrf()`, cookie `scribae_csrf`) et les appels se
  font en `credentials: "include"` (`src/lib/db/service.js`, `src/lib/remote.js`) ;
- l'écran **Comptes et rôles** gagne une colonne « Mot de passe » et la fenêtre d'administration des
  mots de passe (`dialogueMotDePasseCompte`) — voir `src/server/mysql/comptes.mjs`, et le banc
  d'essai `src/server/mysql/comptes.test.mjs`.

**Deux portes, pas une.** Le mode d'authentification dit la porte ORDINAIRE, pas la seule porte.
Un annuaire est un service extérieur : s'il est injoignable (incident, réseau, panne du
fournisseur), l'installation ne doit pas se trouver sans personne pour entrer — à commencer par
son administrateur. Le SERVICE le dit donc explicitement au navigateur
(`GET /v1/auth/config` rend `comptesLocaux` : vrai en mode `password` **et** en mode `oidc`, faux
en démonstration), et l'écran de connexion propose alors, **sous** le bouton de l'annuaire, le
bloc « **Ou par un compte local** » (`blocLocal()`, `src/ui/views/connexion.js`) : le **compte
d'administration déclaré dans le `.env`** (`SCRIBA_ADMIN_*`, voir `server/mysql/amorcage.mjs`) et
les comptes locaux créés à la main y entrent, par identifiant et mot de passe. La même vérité
(`comptesLocaux`) commande le panneau « Comptes et rôles » — qui affiche alors la colonne
« Mot de passe » — et le module `src/lib/auth.js` expose les deux prédicats : `accesLocal(config)`
(les comptes locaux sont joignables) et `sessionDeService(config)` (la session est portée par le
service et doit donc être fermée à la déconnexion, `logout` dans `src/ui/state.js`).

**Qui fait la connexion : le SERVICE (depuis 1.6.1p).** Le service de la collectivité est le
**client OIDC** : `annuaire-service.mjs` (module pur : le réseau entre par un port `httpJson`, la
cryptographie par le port `crypto`) découvre le fournisseur, échange le code avec le vérificateur
PKCE que le navigateur a gardé, vérifie le jeton d'identité (`jws.mjs` : RS/PS/ES, clés du
`jwks_uri`), en tire le compte (les règles de `src/lib/oidc.js` reprises à l'identique), l'écrit au
référentiel, puis ouvre **sa** session — les mêmes cookies que la connexion par mot de passe
(`POST /v1/auth/annuaire`, `comptes.mjs`). Le navigateur ne fait plus que ce qu'il est seul à
pouvoir faire : rediriger, garder `state`/`nonce`/vérificateur, confronter le `state` au retour, et
adopter la session rendue (`connexionParLeService`, `loginWithAnnuaireSession`).

Deux conséquences : **le fournisseur n'a pas besoin d'ouvrir le CORS** (aucun appel ne part du
navigateur — auparavant, un annuaire d'administration qui n'ouvre pas le CORS faisait répondre
« Découverte impossible (Failed to fetch) »), et un agent entré par l'annuaire **lit les actes**,
y compris sur un service réglé sur ses propres sessions. Le service publie ce qu'il sait faire
(`annuaireService`, `GET /v1/auth/config`) : c'est ce drapeau qui décide si la seconde porte est
proposée (`annuairePropose`, `annuaireFermePour`, `src/lib/auth.js`) ; tant qu'il est faux ou absent
(service antérieur), la porte n'est **pas proposée** et l'onglet dit quoi mettre à jour. Les
libellés des contrôles affichés après connexion sont comparés à ceux du client du navigateur par
`tests/purs.test.mjs`.

**Brancher l'annuaire désactive automatiquement les comptes de démonstration**
(`disableDemo`, actif par défaut) : ils ne sont plus proposés à la connexion, ne peuvent plus
ouvrir de session (garde-fou `accountUsable()`, appliqué aussi bien à l'écran de connexion
qu'à `login()` et à la reprise de session au démarrage), et sont marqués « Désactivé
(annuaire) » dans « Comptes et rôles ». L'opération est **réversible** :
`syncDemoAccounts(config, users)` — idempotent, exécuté à chaque démarrage (`store.js`) et à
chaque écriture de la liste (`state.setUsers`) — ne réactive que les comptes désactivés *par
ce mécanisme* (`deactivatedBy: "oidc"`) ; ceux qu'un administrateur avait désactivés à la main
le restent. Un compte de démonstration dont l'adresse correspond à une identité de l'annuaire
est **repris** par l'annuaire (il change de provenance et cesse d'être un compte de
démonstration) : il conserve son historique, ses actes et ses trames.

### Le client (`src/lib/oidc.js`)

Client **public**, sans secret, sans bibliothèque : flux *code d'autorisation* + **PKCE
(S256)**, `state` et `nonce` tirés au hasard par tentative et rangés dans `sessionStorage`
(le flux meurt avec l'onglet), découverte `/.well-known/openid-configuration` (ou points de
terminaison saisis à la main), échange du code par `fetch` en
`application/x-www-form-urlencoded`.

Le `id_token` est **vérifié avant toute ouverture de session** (et chaque contrôle est affiché
à l'administrateur après une connexion réelle) : algorithme (asymétrique seulement — `none` et
`HS*` sont refusés, un client public ne détient aucune clé partagée), `iss`, `aud`, `exp`,
`iat`, `nonce`, puis **signature** contre les clés publiées (`jwks_uri`, RS/PS/ES via
`crypto.subtle`). Un jeton non vérifiable est refusé par défaut (`requireSignature`).

Traduction des revendications en compte (`applyOidcUser`) : rôle = **premier groupe reconnu**
(`roleClaim`, chemin pointé — `groups`, `realm_access.roles`… ; correspondance `roleMap` ;
politique « aucun accès » ou rôle de repli si aucun groupe n'est reconnu — voir ci-dessous),
périmètre = codes de
**services** et d'**entité** rapprochés de ceux du référentiel, identité depuis `sub` / `email`
/ `given_name` / `family_name`. Un compte est identifié par son `sub` d'annuaire, à défaut par
son adresse ou son identifiant : trouvé, il est repris (rôle et périmètre écrasés si
`authoritative`, l'annuaire faisant foi) ; sinon il est **créé** (`autoProvision`), ou la
connexion est refusée avec un message explicite.

### L'identité reconnue sans rôle (le visiteur)

Quand l'annuaire **authentifie** un agent mais qu'**aucun** de ses groupes ne correspond à un
rôle (`mapRole`, `src/lib/oidc.js`), la session s'ouvre quand même : le compte prend le rôle
**`visiteur`** (ou le rôle de repli, selon la politique « Agent sans groupe reconnu » de
Administration › Annuaire — les deux valeurs y sont désormais « Aucun accès (rôle Visiteur) » et
« Attribuer le rôle de repli »). `visiteur` ne porte **aucune permission** : `can()` refuse tout
ce que les profils ordinaires ouvriraient dès qu'un compte le porte. **Une exception, et une
seule** : les **qualités cumulées** (signataire, réviseur). Elles ne disent pas ce qu'un agent fait
de sa journée, elles ajoutent un pouvoir — et c'est précisément ce qu'on peut attendre d'un compte
extérieur, comme un élu dont la signature engage l'acte. Elles rouvrent donc le seul écran qu'elles
commandent (`permissionsDeQualites`, `estVisiteur`), et rien d'autre. Côté annuaire, `applyOidcUser`
**efface** ces qualités quand aucun groupe n'est reconnu : un visiteur venu de l'annuaire reste sans
accès. Un compte **local** marqué « Visiteur » auquel on donne explicitement la qualité de
signataire, lui, entre — et ne voit que les actes où sa signature est engagée.

`estVisiteur(user)` (`lib/users.js`) est la question posée **avant** d'ouvrir l'atelier
(`app.js`, `renderRoot`) : la coquille n'est pas construite, et `views/sans-acces.js` prend sa
place. Cet écran dit qui est connecté, pourquoi l'accès est fermé — groupes reçus de l'annuaire
compris —, donne le **contact du service qui gère l'application** (`brand.supportName` /
`supportPhone` / `supportEmail`, Administration › Identité) et propose **Consulter l'espace public**
(`navigate("recueil")`) et **Changer de compte** (`logout()`). Un visiteur ne démarre pas la
présence collaborative (`state.loginWithClaims`), et le contrôle de connexion par annuaire
(`showAuthControl`) ne lui est pas imposé : sa page porte déjà l'information.

Le rôle **`visiteur`** est un rôle comme les autres dans `ROLES`/`ROLE_ORDER` : il s'attribue
depuis **Comptes et rôles** (profil principal), figure dans la matrice des droits (aucune case),
et peut servir de rôle de repli dans le réglage de l'annuaire.

### L'annuaire d'essai intégré

`test: true` (ou aucune adresse d'émetteur saisie) branche un **annuaire d'essai local** :
mêmes revendications, même code d'attribution des rôles, aucun appel réseau — de quoi régler
la correspondance des groupes et vérifier la désactivation des comptes de démonstration sans
fournisseur. Ses jetons ne sont **pas** signés (`alg: TEST`) et sont annoncés comme tels : ce
n'est pas une authentification. C'est aussi un **filet de sécurité** : on ne peut pas se
retrouver bloqué à l'écran de connexion faute de fournisseur configuré.

### Porte de secours

Depuis l'écran de connexion, un repli (« L'annuaire est injoignable ? ») ramène au mode
« comptes de l'application » — un administrateur peut le retirer (`allowRecovery: false`) une
fois l'annuaire éprouvé. **À dire sans détour** : l'application étant un client, tout ceci est
un contrôle *d'interface* ; la barrière réelle reste le service de données (jeton d'API,
réseau, SSO placé devant l'application). Voir `docs/ADMINISTRATION.md` § 4.

**Où l'éprouver.** Le flux suppose que l'**adresse de retour** soit réellement chargée par le
navigateur, paramètres compris (`?code=…&state=…`) : testez le fournisseur **sur la page
déployée**, dans un vrai onglet (l'aperçu d'un environnement d'édition peut ne pas suivre la
redirection). L'annuaire d'essai, lui, fonctionne partout.

**Écrans** : `src/ui/views/connexion.js` (écran de connexion, trois modes : jetons de
démonstration, comptes locaux à mot de passe, annuaire — le mode mot de passe se réglant au
déploiement, voir § Comptes et rôles et § Auto-hébergement),
`src/ui/oidc.js` (`loginPanel`, retour du fournisseur, fenêtre de l'annuaire d'essai, onglet
« Annuaire (OIDC) » de l'Administration), `views/comptes.js` (provenance des comptes, actions
adaptées).

### Rédaction « hors trame »

Le rédacteur travaille **dans le document** (pas dans un formulaire séparé) : il clique les
pastilles de champ et réécrit le texte comme dans un traitement de texte. Toute réécriture
d'un texte issu de la trame est un **écart** :

- le texte du rédacteur est **conservé** (jamais écrasé) ;
- il est **signalé** — barre orange dans le document, badge « N écart(s) à la trame »,
  onglet « Contrôle & écarts » avec comparaison modèle/acte et bouton *Revenir à la trame* ;
- il est **visible des administrateurs** — colonne « Trame » du registre, carte « Écarts à
  la trame » de la fiche de l'acte, section « Rédaction des actes issus de cette trame »
  dans l'éditeur de trame ;
- il est **non bloquant** (un écart n'est pas un contrôle) et **exporté** dans
  `meta/proprietary/ia:redaction` d'Akoma Ntoso, jamais dans le corps du document.

Mécanique : `values.__overrides` associe une **adresse d'emplacement** stable
(`body.5.blocks.0`, `body.2.items.1`, `body.6.rows.0.2`, `body.7.place`…) au **texte source**
réécrit, jetons `{{…}}` préservés. `compile()` applique ces écarts au bloc avant de
l'interpréter ; remplir un champ ne modifie donc jamais la source et ne crée jamais d'écart.

### La numérotation : la séquence de l'application, ou un service externe

Le numéro d'un acte se prend soit dans la **séquence du référentiel**, soit auprès d'un
**service externe** (Administration › Numérotation). Le second cas est celui d'une collectivité qui
numérote déjà ailleurs — le cas d'école étant un document **Grist**, où la **création d'une
ligne attribue le numéro**.

`src/lib/numbering.js` porte tout cela, et rien d'autre :

- `numberingSettings(config)` complète `config.numbering` par ses défauts (source `interne`,
  gabarit externe vide) : un référentiel antérieur s'ouvre sans migration ;
- `demanderNumero(config, ctx)` compose la requête (url, en-têtes, corps, avec les jetons
  `{valeur}` `{entityCode}` `{year}` `{seq}` `{objet}` `{date}`…), l'envoie, lit la réponse au
  chemin réglé (`records[0].id`), et rend la valeur, le numéro composé et la référence ;
- `reserverNumero(config, entity, ctx)` est le point d'entrée de l'écran de rédaction : la
  séquence interne ou le service, sous la même forme de retour.

**Deux transports** : `relais` (par un `fetch` sans CORS fourni par l'hôte —
`hostSuperFetch()`, `src/lib/hosts.js`) ou `direct` (appel du navigateur). Le relais est le
transport par défaut : l'API de **Grist refuse l'en-tête `Authorization`** d'une origine qu'elle
ne connaît pas, et n'accepte donc pas l'appel direct d'un navigateur sans que l'origine de
l'application soit déclarée **origine de confiance** chez Grist.

**Appel montant = un fait, donc une trace.** Chaque échange passe par `recordExternal`
(`src/lib/remote.js`, service `numerotation`) : il apparaît dans « API & journal » avec la
requête et la réponse, aux côtés des appels au prestataire de signature et au contrôle de
légalité. L'attribution entre aussi au **journal d'audit**
(`numero.attribution_externe`), et la **référence de la ligne créée** reste sur l'acte
(`acte.numeroSource`), affichée sur sa fiche.

**Ce que le module ne fait pas** : il n'incrémente ni n'écrit rien dans le référentiel (c'est
l'appelant qui le fait, comme pour la séquence interne), et il ne retente pas un appel échoué —
une requête POST qui crée une ligne ne doit jamais être rejouée à l'aveugle, sous peine de
consommer deux numéros. Un numéro déjà obtenu ne se redemande pas sans confirmation, et le
bouton « Tester l'appel » de l'Administration annonce qu'un essai de POST crée réellement une ligne.

Dans l'interface : le panneau de l'Administration (`numerotationPanel`, `views/referentiel.js`) avec
son **préréglage Grist**, et l'écran de rédaction (`views/rediger.js`), dont le bouton devient
**« Demander le numéro »** — avec un indicateur d'attente, le message d'erreur du service le
cas échéant, et la possibilité de **redemander** un numéro (sous confirmation) si le premier
n'a pas servi. Le même geste existe dans « Modifier un acte » pour l'acte modificatif.

### La séquence interne : un noyau pur, et un numéro qui ne se donne pas deux fois

La séquence interne tenait dans `src/lib/numbering.js`, mêlée à l'appel du service externe. Elle
a son propre module : **`src/lib/sequence.js`**, sans AUCUNE importation (c'est ce qui évite un
cycle entre la compilation et la numérotation externe). Il porte :

- le **motif** du numéro (`{year}-{seq}-{entityCode}`, `{actTypeId}`…), le **remplissage** des
  zéros (`pad`), l'**année** de référence, la **séquence** (le rang du prochain numéro) et sa
  **PORTÉE** — `global` (un seul chrono pour la collectivité), `entite` (un chrono par code
  d'entité) ou `type` (un chrono par type d'acte) ;
- la **relecture** d'un numéro composé (`seqDeNumero`, `anneeDeNumero`, `entiteCodeDeNumero`) :
  c'est elle qui permet à l'écran du chrono de classer, filtrer et repérer les trous sans que
  l'administration décrive deux fois son motif ;
- l'**annulation** d'un numéro (`annulerNumero`) : le rang n'est pas recyclé — une séquence
  administrative ne revient pas en arrière —, il entre au chrono comme « annulé », avec son motif ;
- `composerNumeroInterne`, `nextNumero` (le numéro tel qu'il se lit aujourd'hui) et surtout
  **`prochainNumeroLibre`** : le numéro proposé est un numéro **libre**. On part du compteur et
  l'on avance tant que le numéro composé est déjà porté par un acte, ou annulé. Sans cette garde,
  un compteur resté en arrière — numéros attribués hors de l'application, reprise d'un autre
  outil, passage d'année — proposerait un numéro déjà pris, et le registre porterait deux actes
  du même numéro ;
- **`fixerSequence(config, rang, {…})`** : le seul endroit où le compteur avance. Une réservation
  l'appelle avec le rang RENDU (et non « le suivant »), si bien qu'elle enjambe les numéros pris ;
  le compteur ne recule jamais. `incrementerSequence` en est le cas ordinaire (+1).

`src/lib/numbering.js` réexporte ce noyau (les écrans n'ont donc qu'un module à connaître) et
ajoute l'appel au service externe. `src/lib/compile.js` réexporte lui aussi les mêmes noms, pour
l'atelier : le numéro d'un document, le numéro proposé par défaut dans « Modifier un acte »
et le rang du chrono sortent donc tous de la même composition.

### L'écran du chrono de numérotation

**`src/lib/chrono.js`** (module pur) reconstitue le chrono à partir de ce que l'application sait
déjà — les actes, leurs numéros, leur état, leurs dates et leurs auteurs — et le complète de deux
choses que les actes seuls ne montrent pas : les **numéros annulés** (`numbering.annules`) et les
**rangs libres** (les rangs jamais tirés, entre 1 et le plus haut rang atteint d'une année : on ne
devine rien au-delà du dernier rang). `lignesChrono`, `rangsLibres`, `filtrerTrier`, `resumeChrono`,
et **`COLONNES_CHRONO`** — une seule déclaration de colonnes, qui sert au tableau de l'écran COMME
aux exports : ce qu'on voit et ce qu'on exporte ne peuvent pas diverger.

L'écran (`src/ui/views/chrono.js`, route `chrono`) présente des **compteurs** (actes numérotés,
dernier rang, prochain numéro, rangs libres, numéros annulés), des **filtres** (année, entité, type
d'acte, état, source, période, texte, et les deux cases « rangs libres » / « numéros annulés »),
un **tri par colonne** (clic sur l'en-tête), et l'**export CSV ou XLSX** du résultat filtré. Les
deux états qui ne sont pas des actes ordinaires ont leur présentation propre : le rang libre est
grisé et en italique, le numéro annulé est barré — un trou dans le chrono doit s'expliquer au
premier regard. Le **passage à l'année suivante** s'y fait d'un bouton (quand le chrono est resté
sur l'année précédente), et **« Annuler le rang »** libère une attribution faite par erreur.

L'écriture XLSX n'a **aucune dépendance** : `src/lib/xlsx.js` écrit un vrai classeur (archive ZIP
en magasin, `[Content_Types].xml`, feuille, styles minimaux, chaînes partagées) et le CSV, avec
son BOM, pour qu'Excel reconnaisse l'UTF-8 et les accents.

### Le papier des documents : A4

Tous les documents de l'application sont des actes administratifs **français** : ils se lisent
et s'impriment sur du **papier A4 (21 × 29,7 cm)**, avec les mêmes marges partout — 2 cm en
haut et en bas, 1,8 cm à gauche et à droite (soit `margin:20mm 18mm` pour l'imprimante).

`src/lib/paper.js` est la **source unique** de cette règle (`A4_WIDTH`, `A4_HEIGHT`,
`A4_MARGIN`, `A4_PAGE_CSS`, `A4_BREAK_CSS`) ; `src/css/app.css` en reprend les nombres pour
l'aperçu de l'application (une feuille de style ne peut pas importer un module). Elle vaut pour :

| Sortie | Papier | Marges / sauts de page |
|---|---|---|
| Aperçu de rédaction (`src/css/app.css`, `.paper`) | 21 cm × 29,7 cm à l'écran | `padding:2cm 1.8cm` ; à l'impression, `@page A4` + bloc vidé de ses marges |
| HTML autonome (`exportStandaloneHtml`) | feuille A4 sur fond gris | `@page A4` et `break-*` dans la feuille embarquée |
| Word (`exportWordDoc`, `.doc`) | section Word A4 portrait | `@page WordSection1{size:21.0cm 29.7cm;margin:2.0cm 1.8cm}` |
| Impression / PDF (`printDocument` → `printHtml`) | onglet du HTML autonome | `@page A4` |
| Original signé (`signature.js`) | feuille A4 | `@page A4` |
| Version en ligne publiée (`eli.js`) | page autonome : colonne de 21 cm | `@page A4`, barres latérales masquées à l'impression — le texte posé DANS la page du recueil, lui, occupe toute la largeur |
| Guide (`guidePrintableHtml`) | `width:21cm` | `@page A4`, un chapitre par page |

Les sauts de page sont explicites : un titre d'article ne reste pas seul en bas de page, une
signature ne se détache pas de son bloc, une ligne de tableau n'est pas coupée. Les deux
écritures (`break-*` et `page-break-*`) sont données, les moteurs d'impression n'honorant
que l'une ou l'autre selon leur version.

### La charte graphique des documents (feuilles de style)

La présentation d'un acte — **marges de page**, police, corps, couleurs, logo, en-tête, pied de
page, filets (diviseurs), encadrés, tableaux, bloc de signature, **cadre de page**, capitales,
numéros d'article… — est une **donnée du référentiel**, pas du code : `src/lib/styles.js` définit
le modèle (`emptyStyle`), la **résolution** (trame → entité → famille → feuille générale,
`resolveStyle`/`styleForDoc`), les **préréglages** (`STYLE_PRESETS`, `applyPreset`) et la
génération du CSS (`styleCss`, `styleRuntimeCss`). L'écran `src/ui/views/styles.js` les règle,
avec un aperçu d'un acte type (`sampleDocument`) rendu par le **même** code que les exports.

**Deux préréglages suivent la charte graphique de l'État** (bleu France `#000091`, typographie
Marianne, en-tête et filet) : `etat` — **réservé à l'État et à ses opérateurs**, la police
Marianne et le bloc-marque n'étant pas livrables, l'administration les ajoute ; il porte la
pastille « réservé » — et `marianne` — la même sobriété **sans les éléments réservés** (Arial,
identité de la collectivité), pastille « libre ». Chaque préréglage peut porter un `badge`
(et `badgeKind: "warning"`), rendu par `presetCard`. Référence de la charte :
<https://www.info.gouv.fr/marque-de-letat/charte-graphique-introduction>.

Les **polices** se choisissent dans une **liste fermée** — `FONT_CHOICES`, rangée par familles
(à empattements, sans empattement, à chasse fixe) : des polices **répandues sur les postes**,
donc sans téléchargement ni dépendance réseau, chacune avec sa pile CSS complète et ses replis.
Le champ (`fontField`, `src/ui/components.js`) garde une porte de sortie — « Autre (police
personnalisée) » — pour une police de la collectivité ou une pile CSS : la feuille range
toujours la **pile**, jamais un identifiant d'entrée, de sorte qu'une charte exportée puis
importée ailleurs nomme la même police. L'**intitulé de l'acte** (`titleRule`) comme les
**intitulés d'article** (`headingRule`) acceptent l'option `box` : l'intitulé est alors
**encadré** (filet du style et de la couleur des filets de la charte). Un encadré choisit ses
**côtés** (`titleBoxSides`, `headingBoxSides`, `enactBoxSides`, `mentionBoxSides`,
`signatureBoxSides` — une chaîne sur `tblr`, vide = ouvert de partout) : `styleCss` écrit alors
un `border-…` par côté retenu plutôt que le raccourci `border` (`boxSides`).

Les **listes** se déclinent en deux familles, que la trame distingue bloc par bloc (`ordered`
sur un nœud `list`, réglé par « Type de liste » dans l'inspecteur de l'éditeur de trame) et que
la charte habille séparément : `listMarker` pour la puce des listes à puces (`ul`),
`listNumbering` pour la numérotation des listes numérotées (`ol`) — `decimal` (« 1. »), `degree`
(« 1° »), `parenth` (« 1) »), `lalpha` (« a) »), `ualpha` (« A) »), `lroman` (« i. »), `uroman`
(« I. »), `none`. Les numérotations sur mesure (`COUNTER_STYLES`) sont des règles
`@counter-style` qui étendent le compteur natif et n'en changent que le suffixe : le navigateur,
le PDF et le HTML autonome les honorent ; Word, qui ignore ces règles, rend la numérotation par
défaut. L'acte type de l'aperçu (`sampleDocument`) porte une liste de chaque genre, pour que
l'écran montre les deux réglages.

Chaque document rendu porte `data-sheet="<id>"` sur sa racine `.doc` ; l'aperçu de
l'application confine donc chaque charte à ses propres documents (`[data-sheet="…"] .doc-…`),
injectées par `state.applySheets()` dans une feuille `#sheet-css`. Les exports et la
publication, qui n'ont qu'un document par page, utilisent le CSS non confiné de
`documentCss(config, style)` — de sorte que l'écran, le PDF, Word, l'original signé et la
version publiée présentent **exactement** la même chose. Ajouter une propriété de présentation
demande donc trois gestes : un défaut dans `emptyStyle`, une règle dans `styleCss`, un champ
dans le **schéma** de l'écran des feuilles de style (`GROUPS` — cf. ci-dessous). Les feuilles
enregistrées avant l'ajout d'un réglage sont **normalisées à l'ouverture** de l'écran
(`emptyStyle(s)`), et `styleCss` applique de toute façon les défauts : une charte ancienne
reste imprimable, et rien n'est migré de force.

**L'en-tête peut porter DEUX emblèmes.** Le premier (`logoUrl`, à gauche, hauteur `logoHeight`)
existait ; le second (`logoRightUrl`, hauteur `logoRightHeight` — vide, celle du premier) est
nouveau. `documentSheetHeader` (`src/lib/render.js`) pose alors la classe
`doc-sheet-header--duo` et rend le texte d'en-tête flexible, pour que la marque de gauche et la
marque de droite se répondent aux deux bouts du filet (`styleCss` écrit
`.doc-sheet-header--duo .doc-sheet-logo--right { margin-left: auto }`). C'est le cas d'une charte
qui associe l'emblème de la collectivité à celui de l'État, d'un partenaire ou d'une délégation.
Emplacement vide : rien n'est rendu, et le document se présente exactement comme avant.
`logoAlign` (`data-align`) continue de régler l'alignement de l'ensemble.

**La formule d'autorité peut être en gras.** Elle ne se réglait qu'en italique ou en normal
(`authorityItalic`, une case) ; elle a désormais une **graisse** (`authorityWeight`) : « Hérité »,
normal, italique, **gras**, ou gras italique. La valeur « Hérité » traduit l'ancien booléen — une
feuille enregistrée avant ce réglage garde donc son rendu, et rien n'est migré de force (même
principe que pour les autres réglages ajoutés après coup).


L'écran a **deux vues, un seul schéma** : « Réglages » (tous les groupes, `GROUPS`) et
« Édition directe », l'éditeur **WYSIWYG sur le style uniquement**. Dans cette seconde vue, un
clic dans l'aperçu remonte l'arbre DOM depuis l'élément touché jusqu'à une classe connue
(`REGION_BY_CLASS`) pour identifier la **région** visée (`.doc-title` → « Intitulé »,
`.doc-table` → « Tableaux »…), et seuls les groupes de cette région (`REGIONS`) sont présentés.
Le texte de l'acte n'est jamais modifiable par ce chemin : on ne règle que l'apparence.

**Marges de page** : la feuille porte ses marges en millimètres (`pageMarginTop`…,
`paperMargins`). Dans un document exporté, `styleCss` les écrit à la fois sur `.paper`
(`padding`) et dans la règle `@page` (`paperPageCss`) — c'est elle qui fixe les marges du PDF.
Dans l'aperçu de l'application (où `@page` ne peut pas servir : plusieurs papiers cohabitent
dans une page), c'est la variable CSS `--paper-pad` que pose chaque vue via `applyPaper`
(`src/lib/render.js`), et que `src/css/app.css` lit dans la règle `.paper`. Word, qui raisonne
en centimètres, reçoit ses marges par `wordMargin`. L'impression directe de l'aperçu (Ctrl+P)
utilise, elle, les marges de la feuille **générale** (`generalPageCss`, injectée dans
`#sheet-print-css`).

**Word** : `exportWordDoc` produit un document **HTML balisé pour Word** (extension `.doc`,
`application/msword`) — Word, LibreOffice et OpenOffice l'ouvrent directement et le mettent en
page selon l'en-tête de section ci-dessus. Le format `.doc` est choisi pour rester modifiable
sans zip `.docx`, et pour être ouvrable par n'importe quel traitement de texte de service.
Word ignore `flex` : la signature y est remise en deux colonnes flottantes.

Vérification : `page_eval` sur le HTML exporté, dans un cadre de 21 cm — `.paper` doit mesurer
exactement 793,7 px de large (21 cm à 96 dpi), 1122,5 px de haut (29,7 cm) et porter les
`padding` de la feuille (75,6 px / 68 px par défaut, soit 2 cm / 1,8 cm).

### L'export PDF/A (archivage)

**À quoi ça sert.** Le « PDF » que l'on obtient par impression est un PDF *de commodité* : il
dépend de la machine qui l'a produit (ses polices, sa colorimétrie) et peut mal vieillir. Le
**PDF/A** (ISO 19005) est la forme **normalisée pour la conservation** : le fichier porte tout ce
qu'il faut pour rester identique dans vingt ans — ses **polices embarquées**, sa **règle de
couleur**, sa **langue** et ses **métadonnées**. C'est la forme que demandent les services
d'archivage. Deux niveaux sont proposés depuis les écrans d'export : **PDF/A-2b** (le défaut,
bâti sur PDF 1.7) et **PDF/A-1b** (bâti sur PDF 1.4, pour les systèmes qui n'acceptent que la
première version de la norme).

**Où c'est branché.** `src/ui/pdfa.js` porte le geste — un bouton qui montre son attente, fabrique
le fichier et le télécharge — et il est posé à côté de « Imprimer / PDF » dans tous les écrans qui
exportaient déjà l'acte : la fenêtre *Exporter…* de la rédaction (les deux niveaux), la fiche d'un
acte, la modification (acte modificatif et version consolidée), et l'original signé.

**Comment c'est fait.** `src/lib/pdfa.js` est un **metteur en page** : c'est l'application qui
compose le fichier, et non le navigateur. Elle lit la même charte que l'aperçu
(`styleForDoc` + `planDeCharte`) et en tire les marges, le corps, l'interligne, les couleurs, les
filets, le cadre de page, l'en-tête et le pied (avec leur logo, rasterisé au passage), les
tableaux, les listes, les divisions, les articles, la formule d'édiction, les mentions, le bloc de
signature et les annexes. pdf-lib et fontkit sont chargés **à la demande** depuis `esm.sh` — rien
n'est téléchargé au démarrage. Le fichier reçoit ensuite son paquet **XMP** (`pdfaid:part`,
`pdfaid:conformance`, identifiant ELI), son **`OutputIntents`** avec le profil sRGB, sa langue
(`fr-FR`), son **identifiant de fichier** et ses métadonnées ; pour PDF/A-1, les trois caractères
de version de l'en-tête sont corrigés en `%PDF-1.4` après coup (même longueur, donc aucun décalage
dans le fichier).

**Les ressources.** `src/pdfa/` contient ce que le fichier embarque : quatre variantes de
**Source Serif 4**, quatre de **Source Sans 3** (SIL Open Font License — `LICENSE-POLICES.txt`) et
le profil **sRGB** (CC0). La norme interdit de dépendre d'une police non embarquée : le PDF/A ne
peut donc pas employer la police de la charte, il en prend une **proche** et l'embarque (voir
`src/pdfa/README.md`, qui porte aussi la recette de reconstruction).

**Reste à faire.** Faire **valider la conformité par `veraPDF`** sur un déploiement réel
(`src/TODO.md`).

### Clair ou sombre (apparence du poste de travail)

`src/lib/theme.js` tient la préférence d'affichage — `auto` (défaut, suit le système),
`light`, `dark` — rangée dans le **stockage local du navigateur** (clé `scribae.theme`), et
non dans le référentiel : c'est un réglage de poste, chacun choisit le sien. Elle pose
`<html data-theme="light|dark">` (et `color-scheme`, pour que les contrôles natifs suivent).
Un script en tête d'`index.html` l'applique **avant tout rendu**, pour éviter l'éclair blanc
du chargement ; c'est la seule copie de la clé de stockage (elle est citée dans les deux
fichiers). Les deux palettes sont des jetons dans `src/css/app.css` (bloc `[data-theme="dark"]`
en tête de fichier).

La **chrome** s'assombrit, **le papier reste blanc** : `[data-theme="dark"] .paper` rétablit
les jetons clairs pour tout ce qu'il contient (pastilles de champ, notes, boutons des blocs
éditables) — un acte s'imprime sur du papier blanc, et l'aperçu doit montrer le document tel
qu'il sortira. La couleur de la collectivité étant souvent très foncée (l'illisible bleu
`#000091` sur fond sombre), `applyBrand` la pose **éclaircie** dans `--brand` en mode sombre,
et garde la teinte d'origine dans `--brand-light` — c'est elle que reprend le papier. L'UI du
sélecteur est dans `src/ui/theme.js` (bouton de l'en-tête `themeButton`, choix complet dans le
menu du compte `themeChooser`), utilisée par la coquille **et** par l'écran de connexion.

**L'emblème du référentiel suit le thème.** Un logo dessiné pour un fond blanc — blason aux traits
sombres, logo noir détouré — devient illisible sur le fond sombre. Le référentiel peut donc porter
un **second emblème**, `brand.logoUrlDark` (Administration › Identité, « URL du logo en thème
sombre »), employé quand le thème courant est sombre ; laissé vide, l'emblème ordinaire sert dans
les deux thèmes. Le choix se fait **au rendu**, par `brandLogoUrl(brand)` (`src/lib/theme.js`), et
non par une requête média `prefers-color-scheme` : le thème de l'application n'est pas celui du
système, l'agent peut l'imposer, et la requête média l'ignorerait. Les trois écrans qui montrent
l'emblème l'appellent donc ainsi — l'en-tête (`src/ui/app.js`), l'écran de connexion
(`src/ui/comptes-liste.js`, l'avatar de structure du premier compte) et le recueil public
(`src/ui/views/recueil-public.js`) — et se redessinent au changement d'apparence (`applyBrand`,
`emit`). **Le papier ne change pas** : les pièces d'exécution (`src/lib/execution-documents.js`),
les documents compilés et la charte gardent l'emblème ordinaire, sur fond blanc — c'est déjà la
règle pour la couleur de marque. Le jeu de démonstration embarque ses deux variantes
(`LOGO_SVG` / `LOGO_SVG_SOMBRE`, `src/lib/seed.js` : même écu, galon éclairci), et un référentiel de
démonstration qui n'a pas encore la variante la reçoit par `migrateDemoLogoDark` (`src/lib/store.js`).

### Choisir l'acte à rédiger, et l'auteur des contributions

**L'onglet « Rédiger un acte » ouvre un choix** (`renderChooser`, `src/ui/views/rediger.js`),
et non plus la première trame de la liste : la rédaction laissée en cours (`state.rediger`),
les actes enregistrés encore modifiables (`isDraftable` — tout statut sauf signé / publié /
abrogé — filtrés par `visibleActes()`), puis les trames du périmètre (`visibleTrames()`) avec
une recherche par nom, description, famille ou service. Sans quoi un service qui compte
plusieurs modèles ne pouvait pas choisir lequel ouvrir. En cours de rédaction, le bouton
**« Changer d'acte »** ramène à cet écran sans perdre le brouillon ; `#/rediger/<trameId>`
reste la route de l'éditeur, `resetDraft()` repart de zéro, `openActe()` rouvre un acte
enregistré. Le registre des actes (« Rédiger un acte », « Commencer ») mène au même écran
(`startRedaction`, `src/ui/views/actes.js`) — l'ancien choix modal des trames a été supprimé.

**Import / export des trames (`src/lib/trame-format.js`).** L'écran Trames propose
**« Fichier d'exemple »** : le JSON téléchargé (`trame-exemple.json`) est un modèle documenté —
un bloc `aide` décrit chaque clé, chaque type de bloc/champ/règle/commentaire et les jetons
`{{…}}`, et un bloc `trame` est un exemple complet et valide, réimportable tel quel. Un fichier
accepté peut contenir une trame (`{ "trame": {…} }`), plusieurs (`{ "trames": [ … ] }`), ou
directement une trame : seuls `name` et `body` sont obligatoires. `readTrameFile` relit le
fichier, `normalizeTrame` complète chaque trame avec les valeurs par défaut (`newTrame`) et
**régénère tous les identifiants** (tpl-, n-, f-, r-, it- : un fichier peut être recopié ou
dupliqué sans collision). Les **erreurs bloquantes** sont listées avant tout import ; les
**points corrigés automatiquement** (type de bloc ou de champ inconnu, valeur par défaut) sont
signalés après import. L'export d'une trame (`exportTrame`) garde le format
`{ kind: "trame", version: 1, trame }`.

**Importer un document Word ou LibreOffice comme trame (`src/lib/doc-import.js`).** Un service
possède souvent son modèle d'acte sous la forme d'un fichier `.docx` ou `.odt`. Le bouton
« Importer une trame » distingue les formats par l'extension (`pickBinaryFile`) : un document
passe par l'import de document, un `.json`/`.txt` par le format de fichier des trames ci-dessus.
Les deux formats sont des **archives ZIP de XML** : `ouvrirArchive` (repérage de l'EOCD, lecture
du répertoire central, `DecompressionStream("deflate-raw")`) les ouvre **sans aucune
dépendance**, et le `DOMParser` du navigateur lit `word/document.xml` (.docx — `word/numbering.xml`
disant si une liste est numérotée ou à puces) ou `content.xml` (.odt — les `text:list-style`
jouant le même rôle). `lireDocument` rend des **blocs bruts** (`p`, `h`, `li`, `table`), que
`trameDepuisBlocs` met en trame : ligne d'autorité (celle de la **collectivité** ; « RÉPUBLIQUE
FRANÇAISE » n'est retenue qu'à défaut), intitulé — le numéro, la date et le « portant … » du
document d'origine devenant `{{numero}}`, `{{dateSignature}}` et `{{objet}}`, et l'objet donnant
son **nom** à la trame —, visas, considérants, formule d'édiction (qui décide du **type d'acte**),
articles (`numMode: "auto"` si la numérotation suit 1..n, sinon conservée), divisions (styles de
titre, « Livre/Titre/Chapitre/Section »), listes (celles du traitement de texte **et** les
numérotations écrites à la main « 1° », « 1) », « a) » → `degree` / `parenth` / `lalpha`),
tableaux, mention de recours, signature (le signataire du document n'est **jamais** repris : il
vient du champ « Signataire »). Un intitulé d'article n'est retenu que s'il est court et ne finit
pas par un point — « Article 1er. Madame X est nommée… » n'a pas d'intitulé, seulement un texte.
Le résultat passe par `normalizeTrame`, comme l'import JSON, et les **jetons déjà écrits** dans le
document font foi (on les cherche sur les blocs **bruts**, avant toute tokenisation de l'intitulé).
Chaque décision de lecture est **signalée plutôt que tue** : `trameDepuisFichier` rend les
problèmes bloquants et les « points à vérifier ». Piège notable : `\b` ne fonctionne pas après une
lettre accentuée (« collectivité », « fait à ») — `ENTITE` et le motif de signature s'en gardent.

**L'import d'un document n'enregistre rien (`src/ui/import-trame.js`).** La trame proposée vit
dans `state.trameImport` et s'ouvre à l'adresse réservée `trame/__import__` (`IMPORT_ID`), où
l'éditeur affiche en tête une **bannière** (« Trame importée de … — rien n'est encore
enregistré ») et les deux seuls gestes : « Enregistrer la trame » (`enregistrerImport` la pousse
dans `state.trames`, en **brouillon**) ou « Abandonner l'import ». Une trame est un modèle
officiel : un document reçu ne peut pas entrer au registre sans qu'un humain l'ait relu — et la
trame importée n'a rien à voir avec celle qu'on éditait juste avant (`state.editor` est remis à
zéro, `Rédiger` disparaît de l'en-tête, faute d'existence au registre).

**Mise à disposition (`src/ui/mise-a-disposition.js`, `trameDisponible` dans `src/lib/schema.js`).**
Une trame reste en **brouillon** tant qu'un éditeur ne l'a pas **mise à disposition** : les
services ne la voient pas, et ne peuvent pas rédiger à partir d'elle. Côté rédaction,
`renderChooser` ne propose que `visibleTrames().filter(trameDisponible)`, et `renderRediger`
refuse une trame non disponible — sauf pour un **éditeur** (qui doit pouvoir essayer son modèle
avant de l'ouvrir) ou une **rédaction déjà commencée** (retirer la trame sous les pieds de celui
qui écrit serait absurde). Le geste est le même partout — carte de la trame, bannière et en-tête
de l'éditeur, champ « Statut » de l'onglet « Trame » — parce qu'il vit une seule fois :
`mettreTrameADisposition` / `retirerTrame` (`src/ui/state.js`) posent `status: "published"` /
`"draft"` et **journalisent** (`trame.disponible` / `trame.retiree`, libellés dans
`src/ui/collab.js` et `src/ui/views/referentiel.js`). Retirer ne touche jamais les actes déjà
rédigés (ils portent leur propre copie du texte et des valeurs). Le badge du statut `published`
dit « **Mise à disposition** » (`statusBadge`, `src/ui/components.js`) — c'est le seul objet qui
le porte. Une trame créée, dupliquée ou importée arrive toujours en brouillon ; seules les trames
du jeu de démonstration sont mises à disposition, et un fichier JSON qui les déclare `published`
le reste (l'import le signale alors explicitement).

**L'auteur d'une contribution est le service du compte connecté**, jamais l'agent qui l'a
saisie. `authorLabel(config, user)` (`src/lib/scope.js`) renvoie le nom du premier service du
compte (« Secrétariat général », « Affaires générales »…). La règle s'applique aux
commentaires et aux règles de trame (`authorOf()`, `src/ui/views/editor.js`), à l'`owner`
d'une trame créée depuis l'interface (`src/ui/views/trames.js`) et au jeu de démonstration
(`src/lib/seed.js`). L'auteur n'est plus un champ de saisie dans l'inspecteur : il s'affiche
en clair (« Auteur : Secrétariat général · 2026-09-19 »). Les exports (Akoma Ntoso
`meta/notes`, Markdown) et l'annexe de notes du document portent donc des noms de services.
Les libellés et couleurs des statuts d'acte sont, eux, définis une seule fois dans
`src/ui/components.js` (`ACTE_STATUTS`, `acteStatutLabel/Color/Badge`, `isDraftable`).

### Les divisions : un texte long se range en livres, titres, chapitres…

Un texte long ne se compose pas seulement d'articles : il se range en **livres**, **titres**,
**chapitres**, **sections**. Le vocabulaire et le nombre d'échelons sont une donnée de la
**trame**, non du logiciel : `trame.divisions` est l'**échelle** — une entrée par échelon
(`{ level, label, num }`, `level` croissant : 1 = le plus haut), le **mot imprimé** étant libre
(« Livre », « Partie », « Chapitre liminaire », « Section »…) et la **numérotation** au choix
(`roman`, `decimal`, `letter`, `aucun`). Une échelle vide n'est pas « aucune division » : c'est
l'échelle livrée, `NIVEAUX_DEFAUT` (`src/lib/schema.js` — Livre/Titre en romains,
Chapitre/Section en arabes), de sorte qu'une trame ordinaire peut poser un nœud `division` sans
rien régler. L'échelle se règle dans l'**onglet « Trame »** de l'éditeur (`echelleEditor`,
`src/ui/views/editor.js`) : ajouter/retirer un échelon, le renommer, le monter/descendre, choisir
sa numérotation.

Le nœud `division` (`newNode("division")`) porte `level`, `numMode` (`auto` | `manual`), `num`,
`heading` et **`blocks`** — c'est-à-dire ses articles et ses divisions imbriquées, à l'infini.
`compile()` (`src/lib/compile.js`) tient un **compteur par échelon** : un échelon ouvert remet à
zéro ceux qui le suivent (« Livre Ier », « Titre Ier », « Titre II », « Livre II », « Titre
Ier »). L'ordinal suit l'usage français (`numeroNiveau` : « Ier » au premier rang, non « I »).
Le rendu (`render.js`) imbrique des `<section class="doc-division doc-division--n<échelon>">`
avec h2→h5 ; les exports Akoma Ntoso et Markdown sont récursifs (`export.js` : `part`, `title`,
`chapter`, `section`, puis `hcontainer`), et `akn.js` les relit. Dans l'éditeur de trame, la
palette propose **« Division »**, le plan est récursif et l'inspecteur règle échelon,
numérotation et intitulé.

### Réorganiser le document : flèches et glisser-déposer

L'atelier de rédaction ne fige pas l'ordre du modèle : chaque bloc — article, division, visa,
considérant, mention — se **déplace** (`src/lib/ordre.js`, `src/ui/views/wysiwyg.js`). Trois
gestes, tous directs : les deux **flèches** posées sur le bloc, le **glisser par la poignée ⠿**,
et le **glisser par le numéro** de l'article ou de la division — la prise naturelle, puisque
c'est ce qu'on vise en pensant « cet article-là » (`armerPrise`). Le dépôt se lit « avant /
après » selon la moitié survolée du bloc cible. Les blocs de tête (intitulé, auteur de l'acte) et
la liste des annexes sont **fixes** : ils sont à leur place par nature. Au doigt, la poignée ⠿
est la prise : elle seule porte `touch-action: none`, si bien que le reste du document continue
de défiler sous le doigt.

L'ordre vit **hors de la trame**, dans `values.__ordre` : `{ [chemin de conteneur]: [rangs
d'origine] }` — `"body"` pour le corps, `"body.3.blocks"` pour les blocs d'un article ou d'une
division. `deplacerVers` écrit une entrée, `rangerCommeLaTrame` efface tout, `ordresModifies`
dit ce qui a bougé (rangé sous un onglet « Contrôle & écarts », avec un bouton **« Ranger comme
la trame »**). `compile()` applique l'ordre **après** la résolution des blocs (`appliquerOrdre`),
puis **renumérote** articles et divisions dans l'ordre imprimé (`renumeroter`) : remonter
l'article 3 en tête en fait l'article 1er. Seuls les numéros **automatiques** bougent
(`numMode: "auto"`) ; un numéro écrit à la main reste ce qu'il est, et les **identifiants**
(`eId`) ne changent jamais — ils sont la mémoire des blocs, pas leur rang. Un ordre modifié est
signalé par une `issue` de niveau `info` (« L'ordre des blocs a été modifié… »), jamais
bloquante.

### Le panneau de droite : le bloc désigné, la bibliothèque de variables

Trois choses vivent dans la colonne de droite de l'atelier (`src/ui/views/rediger.js`), et non
plus seulement la liste des champs :

1. **La bibliothèque de variables**, en haut et toujours ouverte. Elle liste les **champs de la
   trame** (`{{objet}}`, `{{dateEffet}}`…) et les **informations que l'application remplit seule**
   (`AUTO_TOKENS`, `src/lib/auto-tokens.js` : collectivité, siège, signataire, numéro, date en
   toutes lettres), avec un champ de recherche. Une variable se **glisse dans le document** et
   s'insère exactement où on la lâche (`deposable`/`rangeDans`, `src/ui/dnd.js` → `insererJeton`,
   `src/ui/views/wysiwyg.js`) — ou se **clique**, puis se pose d'un clic dans le texte : les zones
   éditables du document (`editableRegion`) acceptent le dépôt comme celles de l'éditeur de trame.
   Poser un jeton réécrit le texte source de l'emplacement, donc **crée un écart** — c'est exact :
   le document ne suit plus le modèle.
2. **L'onglet « Bloc »**, qui s'ouvre dès qu'on **clique un bloc** dans la page (le clic ne
   redessine pas le document : le curseur de saisie ne doit pas être volé). Il dit ce que le bloc
   est, d'où il vient (« Bloc de la trame » / « Bloc ajouté par la rédaction »), et règle tout ce
   qui le concerne : **intitulé**, **numérotation** (automatique ou écrite à la main), **échelon**
   pour une division, **mise en forme** (alignement, retrait, encadré d'un paragraphe ; marque et
   numérotation d'une liste ; légende, en-tête, disposition d'un tableau ; formule, ponctuation et
   alinéa unique des considérants), **éléments** (les visas, considérants et items d'une liste,
   qu'on y écrit, qu'on y monte/descend et qu'on y supprime), **ajouts** permis à cet endroit,
   **monter / descendre / retirer**. C'est le pendant rédaction de l'inspecteur de l'éditeur de
   trame.
3. **« Contrôle & écarts »**, qui distingue désormais trois registres : les réécritures, les
   **réglages de bloc** modifiés (lus en clair : « Titre (échelon 1) » / « Chapitre (échelon 2) »,
   « MODÈLE 1° 2° 3° / VOUS a) b) c) » pour une numérotation de liste) et la **structure du
   document**.

### Ajouter, retirer, régler un bloc : `src/lib/structure.js`

La trame dit ce que l'acte doit contenir ; l'acte se rédige. Retirer un article sans objet, ajouter
un paragraphe, insérer un visa : ces gestes touchent la **structure** du DOCUMENT, jamais celle du
modèle, et ils sont rangés avec les valeurs de l'acte :

- `values.__supprimes[adresse] = true` — le bloc (ou l'élément : `body.2.items.0`) et ses
  descendants ne sont plus résolus : ni affichés, ni comptés, ni exportés. Les réécritures de son
  texte ne sont **pas** effacées : « Rétablir » le rend tel qu'il était.
- `values.__ajouts[conteneur] ← { id, rang, node }` — un bloc (ou un élément de liste) ajouté par
  le rédacteur. Son **rang est synthétique** : il commence après le dernier bloc de la trame du
  conteneur, ce qui lui donne une adresse de la même forme que les autres (`body.11`,
  `body.3.blocks.2`, `body.2.items.4`) — il se déplace, se commente et se supprime avec les mêmes
  outils. Le texte de l'ajout **vit dans l'ajout** (`majAjout` le reporte depuis le document,
  `slotsAjoutes` déclare ses emplacements pour qu'ils ne soient pas dits « hors trame ») : il n'y a
  pas de modèle derrière lui. Une insertion en **fin** de conteneur n'écrit aucun ordre — c'est la
  place naturelle ; `ordreConteneur` (`src/lib/ordre.js`) fait cohabiter les rangs synthétiques
  avec ceux de la trame.

`compile()` en tient compte partout : `resolveNode` abandonne un bloc retiré (avant même de
compter l'article suivant : la renumérotation suit), `resolveBlocks` et les listes d'éléments
résolvent les ajouts du conteneur, puis `appliquerOrdre` place le tout. Les blocs et éléments
AJOUTÉS sont marqués (`it.ajout`, `path`) pour que l'atelier sache quelle adresse est éditable et
laquelle vient du référentiel. Côté interface, les outils sont **sur le bloc** (ajouter après,
retirer, options) et **sur chaque élément** (`+` / corbeille, visibles au survol, jamais imprimés
— voir `@media print`), le « + » du bloc ouvrant un menu **contextuel** (un article n'accueille pas
une signature), et chaque liste se termine par « Ajouter un visa / un considérant / un élément ».

Ce qu'on peut ajouter n'est pas seulement un article, une division ou un élément de liste : un
**bloc de texte** (`para`, `list`, `table`, `raw`) peut être posé dans le corps du document ou dans
une division. Ces blocs sortent dans **tous** les formats — rendu, impression, HTML, Word,
Markdown et Akoma Ntoso (`<block name="disposition">`, repris à l'import par `src/lib/akn.js`) :
`emitBloc` (`exportMarkdown`) et `emitNode` (`exportAkn`) les traitent comme les blocs d'un
article.

### Les réglages propres à chaque bloc : `paramsBloc` (`src/lib/schema.js`)

Un paragraphe, une liste, un tableau, des considérants ne se ressemblent pas : chacun porte donc ses
propres réglages — et **seulement les siens**. Ils se règlent bloc par bloc dans l'éditeur de trame
(onglet « Ce bloc », `renderBlockInspector`) comme par la rédaction (panneau « Mise en forme »,
`paintBloc`), et ils s'appliquent partout : aperçu de l'éditeur, atelier de rédaction, document
compilé, impression, Word, HTML autonome, Markdown, Akoma Ntoso.

| bloc | réglages | ce qu'ils font |
| --- | --- | --- |
| **paragraphe** (`para`) | `align` (justifié / fer à gauche / centré / fer à droite), `indent` (aucun / alinéa / paragraphe entier en retrait), `boxed` (encadré) | `text-align` en ligne et classes `doc-p--indent-*`, `doc-p--boxed` |
| **liste** (`list`) | `ordered` (puces ou numérotée), `marker` (•, ◦, ▪, tiret, aucun), `numbering` (1., 1°, 1), a), A), i., I., aucune), `start` (numéro de départ) | `list-style-type` en ligne, `start` sur le `<ol>` |
| **tableau** (`table`) | `captionPos` (légende au-dessus / au-dessous), `head` (ligne d'en-tête ou non), `layout` (quadrillage / lignes horizontales seules / lignes alternées), `align` | classes `doc-table--*` |
| **considérants** (`considerants`) | `formule` (placée devant chacun), `fin` (ponctuation finale), `inline` (tous dans le même alinéa) | texte des éléments résolu par `compile()` |

Quatre principes, et pas un de plus :

- **Une valeur vide veut dire « comme la feuille de style ».** Un bloc qui ne demande rien suit la
  charte de la collectivité (`src/lib/styles.js`) ; un bloc réglé explicitement fait exception, pour
  lui seul. C'est ce que permettent les listes d'options de `schema.js` (`PARA_ALIGNS`, `LIST_MARKERS`,
  `LIST_NUMBERINGS`, `TABLE_LAYOUTS`, `TABLE_ALIGNS`, `TABLE_CAPTION_POS`, `RECITAL_FINS`).
- **Un réglage de bloc l'emporte sur la charte, mais la suit.** Les règles vivent en double —
  `src/css/app.css` (aperçu) et `documentCss` (`src/lib/export.js`, exports) — avec un sélecteur qui
  part de `.doc` pour passer devant une feuille confinée (`[data-sheet="…"] .doc-table th`), et des
  couleurs prises aux **variables** que la feuille pose sur `.doc` (`--doc-rule`, `--doc-grid`,
  `--doc-neutral`, `--doc-soft`) : un encadré suit donc la charte, il ne code pas sa couleur.
  L'aperçu éditable de l'éditeur de trame enveloppe lui aussi ses blocs dans un conteneur `.doc`
  (`renderEditableBody`) : sans lui, les classes de réglage, posées sur le DOM, ne s'appliqueraient
  pas à l'écran — on réglerait un paragraphe encadré sans rien voir changer.
- **Les compteurs sont déclarés une fois pour toutes.** `styleCss` émet les six `@counter-style`
  (`1°`, `1)`, `a)`, `A)`, `i.`, `I.`) et pas seulement celui de la feuille : une liste peut choisir
  sa numérotation bloc par bloc sans qu'on touche à la charte.
- **La formule ne se répète pas.** `appliquerFormule` place la formule d'un considérant devant son
  texte *sauf s'il la commence déjà* : on peut donc régler la formule sur un bloc EXISTANT, dont les
  considérants sont déjà écrits « Considérant que… », sans réécrire un seul mot. L'**élision** compte
  pour la même formule : « Considérant **qu'**il est nécessaire… » ne reçoit pas un « Considérant
  que » de plus, non plus qu'un considérant qui commence par « Considérant, ». La formule et la
  ponctuation finale que le compilateur ajoute sont **montrées** dans l'aperçu éditable de l'éditeur
  de trame (`.doc-recitals__formule`, `.doc-recitals__fin`, en gris : elles ne se rédigent pas là) et
  dans l'atelier de rédaction — le rédacteur lit la phrase qu'il signe, il ne la devine pas.

Un bloc hérité d'une version antérieure de la trame ne porte pas ces clés : `paramsBloc` les complète
par leurs défauts, donc il se comporte **exactement** comme avant, jusqu'à ce qu'on lui règle quelque
chose. `newNode` les écrit en revanche pour tout bloc neuf (les données se lisent alors toutes
seules) — sauf `formule`, qu'un considérant neuf reçoit à « Considérant que ».

**Éditer un tableau ou une liste, en place.** Dans l'éditeur de trame, le tableau de l'aperçu EST le
formulaire : chaque case se réécrit (`editable`, jetons compris), une gouttière (`.tbl-tools`,
`.tbl-tools-td`) porte « insérer / retirer » sur chaque colonne et chaque ligne, et la barre
`.tbl__bar` ajoute une colonne ou une ligne à la fin — le même dispositif que l'éditeur de
modification (`.amend-th__tools`, `views/amend-editor.js`). L'inspecteur offre en plus la **grille**
complète (`tableGridEditor`) : une case par cellule, un bouton par geste (déplacer une colonne ou une
ligne, la retirer, en ajouter). Une liste montre les mêmes gestes sur ses éléments (« + » et
corbeille, `.piece__tools` — les boutons de l'atelier) et se termine par « Ajouter un élément ». Rien
de tout cela n'appartient à l'acte : `@media print` les efface tous.

**Côté rédaction**, les mêmes réglages se règlent bloc par bloc (panneau « Mise en forme ») et sont
enregistrés comme des **écarts de réglage** : la trame ne bouge pas, les administrateurs les voient
dans « Contrôle & écarts », lus en clair (« MODÈLE 1° 2° 3° / VOUS a) b) c) »). Le contrat est dans
`REGLAGES_PAR_TYPE` / `valeurReglage` (`src/lib/redaction.js`) — un réglage dit *comment* une valeur
se reporte sur le nœud, `reglagesEcarts` dit *comment* on la raconte. Régler un bloc sur la valeur
qu'il portait déjà n'écrit aucun écart.

### Modifier un acte : édition en place, puis consolidation

Un acte signé ne se réécrit pas : on le **modifie**. L'écran « Modifier un acte »
(`src/ui/views/modifier.js`) n'est donc pas un formulaire : c'est **l'acte lui-même,
éditable**. Le document en vigueur est rendu en colonne de gauche avec des passages
`contenteditable` ; on réécrit un article comme dans un traitement de texte, on l'**abroge**
(ou on le rétablit) d'un clic, on **insère** un article après un autre ou en fin de
dispositif. Le préambule (intitulé, visas, considérants) et le bloc de signature ne sont pas
modifiables : la modification porte sur les **articles**, et c'est ce que dit l'acte
modificatif, article par article.

**De l'édition au plan de modifications.** `src/lib/amend-edit.js` fait le lien :

- chaque passage éditable porte une **adresse stable** calculée sur le document d'origine
  (`n3` nœud 3, `n3.h` son intitulé, `n3.b1` bloc 1, `n3.b1.i0` un item de liste, `n3.b1.t2.0`
  une cellule de tableau, `n2.v1` un visa). La table `edits` (adresse → texte) est la seule
  mémoire de la saisie : la page peut être reconstruite autant de fois qu'il faut sans rien
  perdre, et rien ne dépend de la position du curseur ;
- `deriveAmendments()` compare le texte retenu au texte publié et produit le plan
  (remplacer / abroger / insérer / ajouter) que consomment `buildModificatif` et
  `buildConsolidated` (`src/lib/amend.js`) — exactement les mêmes fonctions qu'auparavant ;
- le récapitulatif du panneau de droite est ce plan, ligne à ligne, avec un bouton
  « Annuler » par modification ;
- `cleanDoc()` part du **texte en vigueur** : d'une version consolidée déjà publiée, il
  retire les passages supprimés (barrés), les marques de modification et la bannière, mais
  conserve le **tableau des modifications** — qui sera complété par la nouvelle
  consolidation (`previousTrail`). C'est ce qui permet d'enchaîner les modifications : chaque
  consolidation reprend l'historique de la précédente.

**Le panneau de droite** ne redessine pas l'acte : il **liste les modifications relevées**
(une entrée par amendement — article, nature, nouvelle rédaction —, avec un bouton
« Annuler » pour revenir en arrière), puis montre l'aperçu des deux actes à onglets et leurs
exports. La colonne étant étroite, l'aperçu est une vignette : « Agrandir » l'ouvre dans une
fenêtre large, à la taille réelle du papier.

**Le suivi des modifications est une option d'affichage de la version consolidée**, décochée
par défaut. Décochée, la consolidation se lit comme le seul texte en vigueur (les passages
supprimés ne sont pas rendus) et chaque article touché porte, en italique sous son intitulé,
la mention de l'acte qui l'a modifié — « Modifié par la décision n°… du … », « Abrogé par … »
ou « Ajouté par … » (tournures du référentiel : `vocab.amendment.mentionReplace`,
`mentionAbrogate`, `mentionInsert`). Les mentions sont construites sur le **tableau des
modifications accumulé** (`amendmentMentions()` dans `src/lib/amend.js`) : un article modifié
plusieurs fois les enchaîne (« …, puis modifié par … »), et un article inséré est désigné par
son propre `eId` (les items du tableau portent désormais `newEId`, en plus de `targetEId`).
Cochée, l'option rend l'affichage historique : ajouts et suppressions apparents (`ins`/`del`),
fond d'article modifié et **tableau des modifications** en fin de document. Le tableau est
exporté en Akoma Ntoso (`<ia:item … cible="…" nouveauEId="…">`, `<ia:acteModificatif …
designation="…">`) et relu à l'import (`src/lib/akn.js`) : une consolidation importée conserve
ses mentions.

Le choix est **porté par le document** (`doc.meta.consolidated.showChanges`) : `renderDocument`
le prend par défaut (`opts.showChanges` permet de forcer), donc l'aperçu, les exports (HTML,
Word, Markdown), le document signé et la **version en ligne publiée** montrent tous la même
chose. Il se règle sur l'onglet « Version consolidée » de l'écran de modification (avant
génération) et sur la fiche de l'acte (`renderActeDetail`, pour une consolidation non encore
publiée).

**Le circuit.** À la confirmation (« Confirmer la modification » : numéro — bouton
« Réserver » —, nature, dates, entité, signataire, objet, considérants, visas), les deux
actes sont **générés d'un seul geste** et liés entre eux (`baseId`, `consolidateId` /
`modificatifId`) :

| Acte produit | Nature | Statut de départ | Ce qu'il devient |
|---|---|---|---|
| Acte modificatif | `kind: "modificatif"` | `pret` | signé, puis publié **sous son propre ELI** |
| Version consolidée | `kind: "consolide"` | `en_attente` | publiée **sous l'ELI de l'acte d'origine** dès que l'acte modificatif est publié |

La fenêtre de résultat propose directement l'**envoi en signature** de l'acte modificatif
(l'écran Signature s'ouvre sur lui). La publication de la version consolidée est
**automatique** : l'écran de publication l'annonce et laisse une case « Publier aussi la
version consolidée » (cochée par défaut). `publierConsolide()` (`views/signature.js`)
dépose la consolidation, ouvre son circuit, la signe auprès du prestataire (démonstration),
puis la publie.

**« Supplante », sans effacer.** La version consolidée est publiée sous le **même identifiant
ELI** que l'acte d'origine, et **datée du jour de la consolidation** (et non de la signature
de l'acte d'origine). C'est cette date qui décide de la version en vigueur : le service trie
les versions d'un même ELI par date d'expression puis de publication (`versionsOf`,
`latestOf`) ; l'originale reste dans la liste. La consultation publique (`publications.js`)
affiche donc un onglet **Versions** où la consolidation est « version en vigueur » et
l'originale « supplantée » — et la fiche de l'acte (`renderActeDetail`) porte un
**Historique des modifications** : l'acte d'origine, chaque acte modificatif, chaque
consolidation, avec leur statut et leur version publiée. Rien n'est supprimé.

**Structure : paragraphes, listes et tableaux.** Le même écran sait ajouter et retirer de la
matière dans un article. `src/lib/amend-edit.js` tient une seconde couche d'adresses — la
**mise en forme** du document (`layout`) — où chaque emplacement éditable a un *slot* :
`addSlot` / `dropSlot` pour insérer ou retirer un paragraphe, une ligne de liste
(`n3.b1.l2`) ou une ligne de tableau (`n3.b1.r2`), et `hasAdded` / `clearStructureUnder` pour
les marquer. Le rédacteur les manie par les outils discrets du document (`+ §`, `+` une
ligne, `✕`), et par les barres de bloc (`+ ligne`, `+ §`, `✕ bloc`). Le texte ajouté entre
dans l'acte modificatif comme une insertion, et la consolidation le marque en `ins`.

**Renumérotation.** Le même plan d'amendements porte la réattribution d'un numéro
(`mod.renumerote`, par identifiant d'article : le numéro est refusé s'il est déjà pris, ce que
vérifie `numbersUsed()`), et l'option **« tout renuméroter »** (`mod.renumeroteTout`). Les
deux descendent jusqu'à `applyRenumbering()` (`src/lib/amend.js`), qui s'applique au texte
consolidé **après** les insertions : un article abrogé n'occupe pas de rang, et quand la
numérotation devient continue, ceux dont le numéro est repris quittent le document.

**Les textes en divisions se modifient comme les autres.** Un règlement rangé en **Livres,
Titres et Chapitres** (§ « Les divisions » ci-dessous) se modifie article par article : la
modification descend dans les divisions. C'est `flatNodes()` (`src/lib/amend.js`) qui le permet —
l'ordre **imprimé** des nœuds, divisions comprises, parcouru en profondeur. Cet ordre unique sert
à trois choses à la fois : l'échelle des **adresses de saisie** (`n3`, `n3.b1`, lues par
`amend-edit.js` et `views/amend-editor.js`, qui rendent les articles de division comme ceux du
corps), le **plan des modifications** (`articlesOf()` le réutilise : l'article visé est retrouvé
par son `eId`, où qu'il soit rangé), et la **numérotation continue** du dispositif
(`applyRenumbering`). Dans `buildConsolidated()`, l'application du plan est récursive : un
`del`/`ins` se pose sur l'article de division, un article inséré « après » y prend place, et
« ajouter en fin de dispositif » entre dans la **dernière** division quand le texte s'y termine.
`cleanDoc()` (retrait des marques de consolidation) et le **rapport de conformité**
(`rapportConformite`, qui compte les articles) descendent eux aussi dans l'arbre.

### Les annexes : un document adopté par un autre

Une **annexe** est un document **adopté** par un autre — et c'est cet acte qui lui donne son
autorité. **L'annexe ne se signe donc pas** : c'est l'acte qui l'adopte qui est signé, et
**l'original de cet acte est suivi du texte de l'annexe, dans le même document**, à la suite de la
signature et sur une page neuve. Elle n'est ni signée ni publiée pour elle-même (le service le
refuserait) ; la date qu'elle porte est celle de la décision qui l'adopte, et **elle n'a pas de
numéro propre** : son identité, c'est cette décision-là — celle qui l'adopte, celle qui en adopte la
nouvelle rédaction, ou celle qui l'abroge. Elle garde un identifiant **interne**, mais rien à
l'écran ne présente de numéro (voir la section « Identifier une annexe »). L'exemple d'école : une délibération adopte un **règlement intérieur**, le
règlement lui est annexé, et son texte suit la délibération signée — la délibération d'adoption
figurant dans ses visas. Il arrive aussi que l'annexe ne soit qu'un **tableau** (une grille
tarifaire adoptée par une décision).

**Le modèle.** `src/lib/annexes.js` tient tout le vocabulaire du lien — les tournures
d'adoption (`ADOPTION_DEFAUT`, recouvrables par `config.vocab.annexe`), l'identification figée
d'un acte (`identification()` → `{ acteId, numero, designation, date, objet, eli }`), les
lectures (`annexesDe`, `adoptionDe`, `natureOfActe`, `estAnnexe`), le visa (`visaAdoption`), la
clause (`clauseAdoption`) et le nœud de liste (`nodeAnnexes`). `src/lib/annexe-docs.js` tient la
**partie annexée** : `annexesJointes()` résout, là où le registre est connu, les documents qu'un
acte annexe (leur acte, leur trame, leur document **compilé**, leur intitulé), et
`libellePartAnnexe()` compose l'intitulé imprimé (« Annexe — Règlement intérieur du conseil
municipal »). Une trame se déclare
par `trame.nature: "annexe"` (onglet « Trame », champ **« Nature du document »**) ; la case
**« Rappeler l'acte d'adoption dans les visas »** porte `trame.adoptionVisa` (vrai par défaut).
Une trame ancienne n'a pas ce champ : `natureOfActe()` la lit alors sur sa trame, et rien n'est
migré.

**À la rédaction** (`src/ui/views/rediger.js`) : une annexe affiche la carte **« Annexe »** —
un sélecteur de l'**acte d'adoption**, alimenté par les actes du registre qui ne sont pas
eux-mêmes des annexes — et l'acte ordinaire la carte **« Annexes »**, avec **« Joindre une
annexe »**. Ce qu'on enregistre est une **identification figée** (`values.__adoption`,
`values.__annexes`), reportée sur l'acte (`adoptePar`, `annexes`, `nature`). Le brouillon
compile son document par `compileDoc()`, qui joint **toujours** ses annexes (`annexeDocs`) : les
exports partent donc complets. Le texte des annexes est montré **en lecture seule** sous le
document (`.rx-annexe-paper`), avec un bouton qui mène à l'annexe dans son propre acte — il ne se
rédige pas ici. Le champ `signataire` d'une trame d'annexe est écarté de l'atelier
(`applicableFields`), comme il l'est de la compilation — et le champ `numero` l'est aussi, ainsi que
la variable `{{numero}}` de la bibliothèque (voir « Identifier une annexe »).

**À la compilation** (`src/lib/compile.js`) : si la trame est une annexe, le **visa d'adoption**
est inséré **en tête** des visas (avec son lien) — `{designationThe} n°{numero} du {date}, qui
l'adopte ;` —, le mot « Vu » étant posé par l'étiquette des visas ; le **bloc de signature est
retiré** du document et le champ `signataire` n'est pas réclamé (une annexe n'a pas de signataire
propre) ; `doc.meta.nature` porte `"annexe"`. Si l'acte porte des annexes, un nœud **`annexes`** est
inséré **avant la signature**, listant chaque document par son intitulé. `doc.annexeDocs` (posé par
l'appelant, voir plus haut) porte leur texte. `rapportConformite()` (`src/lib/conformite.js`) et
`exportSchematron()` (`src/lib/export.js`) tiennent compte de l'annexe : ni signataire, ni bloc de
signature, la date étant présentée comme **date d'adoption**.

**La partie annexée du document.** `renderDocument()` (`src/lib/render.js`), `exportMarkdown`,
`exportAkn` (`<attachments>` et son `<block name="texteAnnexe">`), `exportStandaloneHtml` et
`exportWordDoc` (`src/lib/export.js`), l'original signé et la version publiée — toutes les sorties
écrivent, après la signature, une section **`.doc-annexe-part`** qui commence **sur une page
neuve** (`break-before: page`), avec la **charte de l'acte** (une seule feuille de style par
document exporté) et **sans signature**. Le lecteur AKN (`src/lib/akn.js`) s'en tient là : il ne
relit que les conclusions pour « Fait à …, le … », et il **signale** — sans la rattacher tout seul,
car une annexe est un acte à part joint depuis le registre — la présence du texte des annexes dans
`<attachments>` (`compteAttachments`), ainsi que la nature du document (`<ia:nature>`). `docOfActe()`
(`src/ui/views/modifier.js`) est le
point où les annexes sont résolues pour l'écran de l'acte, l'écran de signature et les
publications ; l'amorçage de démonstration les résout de même (`src/lib/demo-actes.js`).

**Sur les fiches et en ligne.** `annexesCard()` (`src/ui/views/modifier.js`) pose sur la fiche
de l'acte un encart qui dit **d'où le document vient** (« Annexe », l'acte d'adoption, avec un
lien vers sa fiche) ou **ce qu'il annexe** (« Documents annexés (n) ») ; le bouton d'action y
devient **« Modifier l'annexe »** (une annexe se modifie par adoption, non par correction directe —
`actePubliable()` répond non pour elle, et les écrans qui s'en servent distinguent explicitement
l'annexe). `buildWebVersion()` (`src/lib/eli.js`) ajoute le même encart à la **version en ligne**.
Une annexe ordinaire n'a **pas de publication propre** : c'est la version en ligne de **l'acte
d'adoption** qui porte son texte, et c'est par l'encart et par le visa du document que le lecteur
remonte de l'un à l'autre. Les enregistrements de publication (`src/ui/views/signature.js`) portent
`adoption` et `annexes` pour cela. Le **registre public** n'exploite pas encore ce lien (voir
`TODO.md`). Un **RÈGLEMENT**, lui, a bien une publication propre — informative —, sous sa propre
adresse (voir « Les règlements : une annexe publiée à part au recueil »).

**Ni signée, ni publiée.** `actePubliable()` (`src/ui/state.js`) répond non pour tout acte de nature
« annexe » — d'où, partout, un message propre (« une annexe ne se signe pas », elle renvoie vers
l'acte d'adoption) à la place du circuit.
L'écran de signature (`renderCircuit`) remplace le circuit par un encart qui renvoie vers l'acte
d'adoption, ses actions et sa file de publication ; `amorcerRecueil()` ne publie jamais une annexe
**pour elle-même** (un règlement est publié à la faveur de l'acte qui l'adopte, voir plus bas) ;
`exportSchematron` ne réclame pas son bloc de signature. **L'autorité ni la mention de publication
au recueil** ne figurent dans le document d'une annexe : `compile()` les en écarte (une annexe est
adoptée, elle n'émane pas d'une autorité et ne se publie pas elle-même), tandis que les **visas**
sont conservés.

**Modifier une annexe.** Le régime est propre : l'acte modificatif en **adopte la nouvelle
rédaction**, présentée en suivi des modifications. `startSession()` (`modifier.js`) détecte
l'annexe (`doc.meta.nature`), ouvre le mode `suivi` par défaut et pré-remplit l'objet avec
`adoptObjet` ; le panneau « L'acte entier » porte la case **« Modification par adoption (suivi
des modifications) »**, décochable pour revenir à la modification **classique** (mention
expresse, article par article). `buildModificatif()` (`src/lib/amend.js`) compose alors
l'intitulé `adoptTitle`, place la **clause d'adoption en article premier** (`clauseAdoption`) et
**décale d'un rang** la numérotation des modifications. La nouvelle rédaction **suit l'acte
modificatif** : son document est complété de `annexeDocs` (le texte consolidé qui vient d'être
adopté), et c'est cet original signé qui la porte. La version consolidée reçoit, en tête de
ses visas, l'acte qui vient de l'adopter — le visa d'adoption précédent est **remplacé**, non
empilé —, et la fiche de l'annexe retient ce nouvel acte (`values.__adoption`, `adoptePar`,
`nature`).

### Les règlements : une annexe publiée à part au recueil

Toutes les annexes ne se valent pas. Un **tableau**, une **grille tarifaire** ne vivent que dans
l'acte qui les adopte. Un **règlement intérieur**, un **règlement d'usage** — un texte **normatif** —
se consultent **pour eux-mêmes** : comme un **code**, ils font droit indépendamment de la décision
qui les a fait naître, et l'on veut les trouver, à jour, sans connaître la délibération qui les
porte. C'est une **valeur normative** qui justifie une **publication informative autonome** : le
recueil en donne une version consultable **à part**, à côté de la place du texte dans l'acte qui
l'adopte.

**Le drapeau.** Tout part de la trame : une annexe peut être déclarée **Règlement**
(`trame.reglement: true`, case **« C'est un RÈGLEMENT : le publier aussi à part, au recueil »** de
l'onglet « Trame », sans effet sur une trame d'acte). `src/lib/annexes.js` en expose la lecture —
`estReglement(trame)` (`nature === "annexe" && reglement === true`) et `estReglementActe(acte,
trames)` (le même, à partir d'un acte). Le drapeau suit la **trame**, et la nature du document est
le **seul** juge : une annexe non déclarée ne reçoit rien, et un acte n'est jamais concerné.

**La publication.** À la publication de l'acte qui l'adopte (`publier`, `src/ui/views/signature.js`),
`publierReglements(acte, doc, …)` dépose **dans la foulée** la version en vigueur de chaque
règlement annexé. Deux règles la distinguent :

1. **L'identifiant est minté une fois, puis conservé** sur l'annexe (`annexe.eli`), par `eliUri()`
   sur le **premier** acte qui l'adopte — la table `ELI_CODES` lui donne le code `reg`
   (`eli:/fr/reg/2026/0416/vsl`). Il **ne change plus** : c'est lui qui rend les publications
   successives **solidaires** (un règlement modifié est le **MÊME** règlement), et c'est lui qui
   donne au texte une **adresse stable**, comme un code. `rec.informative` et `rec.adoption` (l'acte
   qui l'adopte) partent avec la publication, et l'identifiant d'idempotence de l'appel
   (`${eli}@${datePublication}-informative`) empêche tout doublon.
2. **C'est une publication informative** : le client envoie `informative: true` et **aucun
   original** (le règlement n'est pas signé). Le service l'accepte (`hPublier`,
   `src/server/mysql/actes.mjs` et `index.html`) : `original` et `signature` restent nuls, et la
   publication **ne touche pas à l'état de l'acte déposé** (`acte.statut` / `acte.publication` sont
   laissés tels quels — c'est le même chemin pour un acte modifié, dont le règlement ne doit pas
   écraser la version en vigueur). Tout le reste est la mécanique ordinaire — clé, ELI, versions,
   épinglage.

**Ce qu'on en voit.** Sur le document, c'est `compile.js` qui distingue : une annexe perd
**l'autorité** et la **mention de publication au recueil**, mais **garde ses visas** — et le visa de
son adoption (« Vu la délibération n°…, qui l'adopte ») devient un **lien** vers l'acte. Sur le
recueil, `buildWebVersion()` (`src/lib/eli.js`) présente un texte informatif : pas d'«
Opposabilité », pas de « publié le », pas de renvoi à un original — un encart le dit (« Texte
publié à titre informatif… ») — mais son identifiant, son thème et l'**acte qui l'adopte**. La
notice (`src/ui/views/acte-publie.js`) suit : marques « Texte informatif » et « texte en vigueur »,
méta réduite à ce qui **identifie** le texte, ni signature ni original. Le bloc « Versions publiées
sous le même identifiant » y prend tout son sens : ce sont les rédactions successives du règlement.
L'écran de signature, lui, annonce sur la carte **« Annexes adoptées »** l'avancement de la
publication du règlement et un bouton **« Voir au recueil »**.

**À l'écran et en données.** C'est la case de l'onglet « Trame » (`src/ui/views/editor.js`) ; la
trame la porte (`reglement` dans `src/lib/schema.js` et `src/lib/trame-format.js`) ; le jeu de
démonstration en déclare deux (**règlement intérieur du conseil** et **règlement d'accès à la
restauration scolaire**), avec l'autorité et la mention de publication retirées de leurs trames
(`src/lib/seed.js`). Le règlement se cherche et se classe par thème comme les actes, et son
identifiant s'ouvre directement (`?eli=eli:/fr/reg/2026/0418/vsl`, ou `/eli/reg/…` sur un
déploiement serveur). **Suite connue** : la **consolidation** d'un règlement modifié est republiée
sous le même ELI par l'acte modificatif (à éprouver — voir `TODO.md`).

### Les documents qui ne font pas droit

Tout ce qu'une collectivité met au recueil n'est pas un **acte**. Le **verbatim d'une séance** (le
compte rendu intégral des débats), une **déclaration** prise devant ou par l'assemblée, un **vœu**
(une motion : l'assemblée demande, elle ne décide pas) sont des **documents** — les administrés les
cherchent, et ils ont leur place au recueil —, mais ils **ne créent ni droits ni obligations**.

**La nature se choisit sur la trame.** Le champ **« Nature du document »** de l'onglet « Trame »
(`src/ui/views/editor.js`) propose cinq valeurs, dont trois nouvelles
(`ACTE_NATURES`, `src/lib/schema.js`) : `acte` et `annexe` **font droit** ; `verbatim`,
`declaration` et `voeu` **non** (`juridique: false`). La lecture passe par trois aides :
`natureDe(trame)` (l'identifiant, tout inconnu ramené à `acte`), `natureDocs(id)` (le descripteur)
et `natureJuridiqueDe(trame)` (« fait-il droit ? »).

**Ils vivent par eux-mêmes — contrairement à une annexe.** Un verbatim, une déclaration, un vœu se
**signent** comme un acte, se **numérotent**, reçoivent un **identifiant ELI** et se **publient au
recueil**. Ce qui change, c'est la **portée** de la publication : `juridique: false` voyage **avec
la publication** (`record.juridique`, puis le corps envoyé au service) et commande, partout :

- **Pas d'opposabilité, pas d'entrée en vigueur, pas de délai de recours.** `publier`
  (`src/ui/views/signature.js`) n'inscrit **aucune** date d'opposabilité ni règle d'entrée en
  vigueur ; le **service** force `dateOpposabilite: ""` de son côté (il ne croit pas le client sur
  ce point — `src/server/mysql/actes.mjs`, et l'émulateur `index.html`).
- **Pas de formalités d'exécution.** `formalites` (`src/lib/execution.js`) tient la transmission au
  contrôle de légalité et la notification pour **non requises** — ces documents ne sont pas des
  actes administratifs —, `statutExecution` rend l'état **« Document — non opposable »**
  (`code: "document"`), `dateExecutoire` et `dateLimiteRecours` rendent **vide**, et les écrans
  (registre, échéancier, fiche) comme les pièces du dossier (**état des formalités**,
  **attestation de non-recours**) le disent. L'onglet « Trame » masque d'ailleurs les deux
  réglages de formalités pour une nature non juridique.
- **Le recueil les présente comme des documents.** La version en ligne (`buildWebVersion`,
  `src/lib/eli.js`) remplace la mention d'opposabilité par un encadré **« Document non opposable »**
  et classe le fil d'Ariane sous **« Documents »** ; le **JSON-LD** omet la clé
  `eli:first_date_entry_in_force` ; la notice du recueil (`src/ui/views/acte-publie.js`) porte la
  marque « document, non opposable » et un champ **« Portée »** au lieu d'« Entrée en vigueur » ;
  le Markdown, l'écran « Publications » et les fiches s'accordent.

**Rien n'est codé pour un document en particulier** : la nature est une **donnée** de la trame, et
c'est elle qui décide de la portée. Publier ses verbatims au recueil ne demande donc aucun
paramétrage : on choisit la nature, le reste suit. Le jeu de démonstration en montre trois (voir
« Actes de démonstration »).

### La reprise d'un acte ancien

Une installation neuve n'a pas un recueil vide : la collectivité a derrière elle des décennies
d'actes — délibérations, arrêtés, règlements — signés sur papier, publiés à l'affichage ou dans un
bulletin qu'on ne trouve plus. L'écran **Reprises d'actes anciens** les fait entrer au recueil
public, pour qu'on les **trouve** et qu'on les **lise** — sans les faire passer pour ce qu'ils ne
sont pas. Ses règles pures sont dans **`src/lib/reprise.js`**, son écran dans
**`src/ui/views/reprises.js`**, ses reprises dans la collection **`reprises`** (jamais dans
`state.actes`).

**Trois règles, et elles tiennent ensemble.**

1. **C'est le rédacteur qui reprend l'acte, et il écrit son texte LIBREMENT.** Un acte de 1998 n'a
   pas été composé dans une trame d'aujourd'hui : on ne l'enferme pas dans un formulaire qui
   n'existait pas. `analyserTexteLibre` n'attend que trois repères — une ligne blanche sépare les
   blocs, une ligne qui est **exactement** un intitulé d'article (« Article 3 », « Article 3 —
   Objet ») ouvre un article, « `#` » / « `##` » / « `###` » ouvrent une division, « `-` » / « `*` »
   / « `•` » font une liste. Tout le reste est un paragraphe : le texte d'un acte se **colle** sans
   être réécrit.
2. **La date de publication d'origine se règle à la main, et reste nécessairement antérieure au
   jour.** `dateMaxReprise` est la veille, `dateRepriseValide` la vérifie, `validerReprise` refuse
   le geste. On ne republie pas un acte de 1998 à la date d'aujourd'hui : le recueil mentirait sur
   sa chronologie, et ferait courir des délais de recours à compter du jour. Le champ de date porte
   la borne (`max`) et l'aperçu dit ce qui manque.
3. **L'original signé est joint à la main.** `carteOriginal` calcule l'empreinte **SHA-256** du
   fichier (`crypto.subtle`) et le dépose par `upload-plugin` ; la pièce est gardée sur la reprise
   (adresse, empreinte, taille, qui l'a déposée). C'est elle qui **fait foi** — la reprise ne signe
   rien, elle conserve la preuve de ce qui a été signé.

**La publication est immédiate, et informative.** `publier` fait le **dépôt** (`POST /v1/actes`,
avec `reprise: true`) puis la **publication** (`POST /v1/actes/{id}/publication`, avec
`informative: true`, `reprise: true`, et `originalExterne` qui porte la pièce conservée), dans la
foulée du bouton. Le service accepte la publication **sans signature** sur un acte **déclaré
reprise** au dépôt ; un client qui prétendrait publier une reprise sur un acte déposé autrement est
refusé (`acte_non_reprise`, 409). Aucune opposabilité, aucun délai : `dateOpposabilite` reste vide,
et l'état de l'acte déposé n'est pas touché.

**L'identifiant ELI est daté de l'acte, non du jour.** `numeroPourEli` garde le numéro d'origine
(« 1998-042 »), `anneeDuNumero` en prend l'année, et c'est elle qui bâtit l'adresse de recueil
(`eli:/fr/arr/1998/0042/vsl`). Un numéro sans année se voit recomposer une séquence stable (les
chiffres restants, ou une empreinte FNV-1a du numéro et du titre) : deux reprises ne se disputent
jamais la même adresse. Le **numéro d'origine est donc requis**, avec l'intitulé, le texte, la date
et l'original.

**Un texte autonome se reprend aussi** (`annexe: true`) : un règlement intérieur, une charte, un
texte qui se consulte **pour lui-même**. `actTypeEli` lui donne le type `reglement`, et son
identifiant est celui d'un règlement (`eli:/fr/reg/1996/0001/vsl`). C'est ce qui distingue une
reprise d'une **annexe ordinaire** : celle-ci est adoptée par un acte **vivant dans l'application**,
tandis qu'un texte ancien repris n'a, ici, aucun acte d'adoption.

**La mention de bas de page est l'exigence centrale.** `MENTION_REPRISE` est la phrase unique que le
lecteur trouve **au bas de la page publiée** (`buildWebVersion`, `.foot`) et que le recueil reprend
dans un encadré en fin d'article (`blocMentionReprise`) ; `MENTION_REPRISE_COURTE` en est la variante
des vignettes et du **JSON-LD** (`rdfs:comment`). La notice, elle, est celle d'un acte augmentée de
ce qui dit qu'il en est une — marques « Reprise d'un acte ancien », « texte informatif »,
« reprise publiée », **date de publication d'origine**, date d'entrée au recueil, **provenance**,
qui a fait la reprise, et la phrase de mise en garde —, sans rien de la **signature** (l'acte ancien
a été signé hors de l'application) ni de l'**entrée en vigueur**. Le fil d'Ariane la classe sous
« Reprises d'actes anciens » (page publiée **et** recueil), le panneau « Original signé » mène à la
pièce conservée, et la **liste du recueil** la signale d'une marque « reprise ». `signatureDe`
(`src/lib/publications-locales.js`) rend **nul** pour une reprise : sa pièce jointe n'est pas une
signature « externe ».

**Ce qu'une reprise n'est pas.** Elle ne suit aucun circuit — ni parapheur, ni révision, ni
signature, ni transmission au contrôle de légalité —, elle ne se **modifie** pas et ne s'**abroge**
pas (une reprise publiée se **retire** et se reprend), et elle vit dans sa **propre collection** :
elle ne se mêle ni aux listes d'actes, ni au chrono, ni à la recherche des actes en cours. Le geste
est **réservé aux rédacteurs** : permission **`actes.reprendre`** (rôles de `actes.rediger`), et un
rédacteur ne voit que **ses** reprises (`reprisesVisibles`).

### Identifier une annexe : pas de numéro propre

Une annexe n'a **pas de numéro**. Elle n'occupe aucune place au recueil (elle n'y est pas déposée),
et elle est **toujours** liée à une décision : celle qui l'**adopte**, celle qui en adopte la
**nouvelle rédaction** (sa modification), ou celle qui l'**abroge**. Elle garde son **identifiant
interne** (`id` du registre — liens, historique, corbeille), mais rien à l'écran ne présente de
numéro.

Tout part de `src/lib/annexes.js` :

- `numeroAffiche(a, config, trames)` — ce qu'on écrit dans une colonne « Numéro » : le numéro de
  l'acte, ou, pour une annexe, **`annexe à 2026-416-VSL`** (registre, listes « Modifier » et
  « Reprendre ») ;
- `appellationAnnexe(a, config)` — l'étiquette : **« Annexe à la délibération n° 2026-416-VSL du
  24 septembre 2026 »** (fiche, encart de signature, corbeille) ;
- `appellationAnnexeDefinie(a, config)` — la forme de phrase : **« l'annexe à la délibération n° … »**,
  pour « Modifier l'annexe à … » ou « … les articles de l'annexe à … » (`acteLabel`) ;
- `refDecision(d)` — le renvoi nu à une décision : « la délibération n° … du … » ;
- `libelleAnnexe(annexe, config)` — le nom dans une liste : **« Annexe — Règlement intérieur du
  conseil municipal »** (aucun numéro, aucune date).

Et là où un acte serait numéroté :

- **La numérotation ne consomme rien.** `applicableFields` (rédaction) écarte le champ `numero` et
  la bibliothèque de variables n'offre pas `{{numero}}` ; l'éditeur de trame non plus
  (`autoTokensDe`, `sampleValues`). La trame d'annexe de la démonstration ne porte donc pas ce
  champ (`seed.js`).
- **Pas d'ELI.** À la compilation, `compile()` met `meta.numero` à vide **et** n'applique pas
  `eliPattern` pour une annexe : `meta.eli === ""`. `exportSchematron()` écarte l'assertion
  `s-numero`, et la relecture AKN ne signale pas l'absence de numéro (`akn.js`).
- **Les tournures la désignent par la décision.** `targetPhrase()` (`src/lib/amend.js`) rend « le
  règlement (la délibération n° 2026-416-VSL du 24 septembre 2026) » : l'acte modificatif dit donc
  « portant adoption de la nouvelle rédaction du règlement (…) », et non « n° à compléter ».

### Abroger un acte, ou l'un de ses articles

Un acte publié ne se supprime pas : il **s'abroge**, par un acte nouveau qui le vise
expressément. `src/lib/abrogations.js` — module **pur**, sans DOM ni état — porte la matière
de cette clause et son vocabulaire (`config.vocab.abrogation` : `acte`, `article`, `texte`,
`heading`), avec les jetons `{target}` / `{targetCap}` / `{abroge}` / `{selfDe}`… Il expose
aussi `designationDe()` (la nature d'un acte, lue à sa trame), `estAbroge()` et
`abrogeParDe()`.

**Prévoir l'abrogation pendant la rédaction.** L'onglet **« Abrogations »** de l'écran de
rédaction (`views/rediger.js`) range les cibles dans `values.__abrogations` : `kind:
"acte" | "article" | "texte"`, la **photographie** de l'acte visé (`numero`, `designation`,
`date`, `eli`) — car la clause d'un acte signé ne se réécrit pas —, `article` + `articleEId`,
un `texte` libre, et une `clause` réécrite si le rédacteur la corrige. `compile.js` compose
l'article (`blocsAbrogation`) et l'insère **juste avant le bloc de signature** sous un numéro
ordinaire. Les clauses engendrées sont inscrites dans l'inventaire des emplacements
(`sources`), pour que les corriger dans le document ne soit pas signalé comme un écart
« hors trame ».

**Appliquer, au jour de l'entrée en vigueur.** `entreeEnVigueur(acte, config)`
(`src/lib/execution.js`) rend la date d'effet déclarée, à défaut le lendemain de la
publication (ou le délai réglé) : c'est **cette** date, et non celle de la publication, que
`src/ui/abrogations-apply.js` attend. Le module est **idempotent** (`appliedAt` sur chaque
entrée) et s'exécute au démarrage (`ui/app.js`) et après chaque publication
(`views/signature.js`). Une cible « acte entier » reçoit `abrogePar` (`enAttente` tant que
l'acte abrogeant n'est pas publié) ; une cible « article » donne lieu à une **version
consolidée** de l'acte qui le porte, construite par `planAmendments` + `buildConsolidated`
(action `abrogate`) exactement comme un acte modificatif, marquée `pendingConsolidation` et
`abrogationPar`, et destinée à la publication. Chaque application entre au journal
(`abrogation.appliquee`).

**Corbeille, retrait, abrogation.** Seuls les brouillons (`isDraftable`) vont à la corbeille.
Sur un acte signé ou publié, le registre (`views/actes.js`) remplace le bouton corbeille par
**« Retirer / abroger »** : un dialogue explique la règle, montre ce que visera l'acte à
rédiger, et propose de le rédiger (`redigerAbrogation()` dépose `state.redigerIntent` puis
ouvre le choix de trame — l'intention s'applique à l'ouverture du brouillon) ; pour un
administrateur, il mène aussi au **retrait technique du recueil** (erreur de dépôt). Les badges
**« abrogé »** / **« abrogation prévue »** viennent de `abrogationBadge()` et
`abrogationPhrase()` (`src/ui/components.js`) — registre, liste de reprise, choix de l'acte à
modifier, et fiche de l'acte.

**Ce que le recueil en montre.** Sur l'espace en ligne (`views/recueil-public.js`), la liste,
ses compteurs et les tuiles de thème partent des **publications en vigueur**
(`publicationsEnVigueur`) : chaque acte ne s'y présente qu'une fois, dans sa version la plus
récente ; une case **« Afficher les versions antérieures »** (visible seulement s'il y en a)
les rouvre. Sur la page d'un acte, l'**article abrogé** garde son intitulé et la mention de
l'acte qui l'a abrogé ; sa rédaction est conservée dans la version en ligne — `renderDocument`
avec `opts.abrogations` la range dans `.doc-abroge-corps` — mais masquée (`CSS_DOCUMENT_WEB`),
et la case **« Afficher les articles abrogés »** la révèle, barrée. `buildWebVersion`
(`src/lib/eli.js`) est le seul à demander cette conservation ; la page publiée et son
impression ne la montrent jamais.

**La bande « À la une ».** Les actes **épinglés** — `estEpinglee` / `publicationsEpinglees`
(`src/lib/recueil.js`) — ouvrent la page d'accueil du recueil, dans une bande posée **au-dessus
du carrousel** (`aLaUne`, `views/recueil-public.js`), qui ne les répète pas. Elle ne montre que
les versions **en vigueur**, et s'**efface** dès qu'une recherche ou un filtre est posé
(`filtreActif`, appliqué par `peindreResultats`) — le lecteur est alors dans ses résultats. Le
geste se pose depuis l'onglet **Actes** (bouton punaise, `basculerEpinglage`,
`views/actes.js`), il voyage jusqu'au service par `POST /v1/publications/{cle}/epingle`, et il
suit l'**ACTE** (identifiant ELI) : voir « Publication » plus bas.

### Actes de démonstration

Le jeu de démonstration ne se limite pas au référentiel et aux trames : il pose **soixante-neuf
actes** sur **vingt-cinq trames** (`src/lib/demo-actes.js`), dont **cinquante-deux rédigés et
signés**. Ils sont installés au premier démarrage — et remis à niveau quand `SEED_VERSION` change —
uniquement si les trames sont celles de la démonstration *et* que le registre ne contient que des
actes de démonstration (`acte-demo-*`) : un registre réel, ou enrichi à la main, n'est jamais
touché.

Trois d'entre eux illustrent la **révision** : un acte **en attente de révision** (file « à réviser
par moi »), un acte **révisé et validé** (avec une correction du réviseur au dossier), et un acte
**rejeté**, revenu en **brouillon** avec son motif.

Deux de ces actes illustrent les **actes individuels non publiables** (trame `tpl-revalorisation`,
`publishable: false`) : l'un signé, l'autre prêt à signer. Ils sont conservés au registre et ne
passent jamais par la publication (voir plus bas).

**Trois actes** illustrent les **documents qui ne font pas droit** (`acte-demo-467` à `469`) : un
**verbatim de séance** du conseil municipal et un **vœu** de l'assemblée, tous deux **publiés au
recueil**, et une **déclaration** signée qui attend sa publication. Leurs trames
(`tpl-verbatim`, `tpl-declaration`, `tpl-voeu`, famille `fam-seances`) portent la nature
`verbatim` / `declaration` / `voeu` : le recueil les présente comme des **documents**, sans
opposabilité, sans entrée en vigueur et sans délai de recours (voir « Les documents qui ne font
pas droit » plus bas).

**Sept actes** forment le cas de l'**annexe**, qui est ce que la démonstration met en avant avec
les événements : le **règlement intérieur du conseil** (`acte-demo-417`, adopté par
`acte-demo-416`), le **règlement d'accès à la restauration scolaire** (`acte-demo-419`, adopté par
`acte-demo-418`), la **grille tarifaire des services municipaux** — dont le prix du repas de
cantine (`acte-demo-463`, adoptée par `acte-demo-462`) —, la **charte de la participation
citoyenne** (`acte-demo-459`), et les documents joints à une manifestation : le plan de
circulation et de stationnement et le programme de la fête du village (`acte-demo-425` et
`426`, joints à `acte-demo-424`), le stationnement et le déroulé de la cérémonie du 11 novembre
(`acte-demo-465`, joint à `acte-demo-464`). Une annexe est de nature `annexe` et sa trame n'a ni
champ « Numéro » ni champ « Signataire » (sa date s'appelle « Date d'adoption ») : le lien est
figé à la façon de la rédaction (`values.__annexes` / `values.__adoption`, voir `src/lib/annexes.js`) —
l'annexe porte le **visa de l'acte qui l'adopte** en tête de ses visas, l'acte **annonce l'annexe**
en fin de dispositif, et **l'original signé de l'acte est suivi du texte de l'annexe** : l'annexe
ne se signe ni ne se publie pour elle-même.
Quatre actes sont **épinglés** (`epingle: true` dans `src/lib/demo-actes.js`) et composent la
bande **« À la une »** du recueil public : le règlement de la restauration scolaire, la grille
tarifaire, la fête du village et le marché de Noël — deux annexes, deux événements. Le drapeau est
porté au service à l'amorçage (`demo-publications.js`).

Les actes signés ne sont pas des coquilles : le document est **compilé depuis sa trame**,
exporté en Akoma Ntoso, puis signé par le **même chemin de code** que l'écran de signature
(`buildSignedPackage` : certificat, ECDSA P-256, horodatage). Leur original se vérifie donc
réellement, empreinte comprise — c'est ce que fait « Publications » à la consultation. Trois
actes complètent le tableau : deux prêts à signer (dont un que l'on peut envoyer en signature
pour dérouler le circuit) et un brouillon incomplet, pour que la file « À compléter » ait de
quoi travailler.

Comme l'état du service ne survit pas à un redémarrage, publier un acte signé qu'il ne connaît
pas le fait d'abord **redéposer** avec sa signature déjà approuvée (`retablirActe`,
`views/signature.js`) : le service revérifie l'empreinte, comme dans le circuit normal. C'est le
même réflexe que la passerelle du prestataire, qui redépose le document quand son dossier a
disparu.

Les actes que la fiction **déclare publiés** portent une constatation de publication
(`execution.publication`) : ce sont eux que le **recueil public** doit montrer. Comme un service
neuf n'en contient aucun, `src/ui/demo-publications.js` les y dépose au premier démarrage (voir
« Registre et recueil » ci-dessous).

### Signature & publication (démonstration)

L'application ne signe ni ne publie elle-même : elle est **cliente d'une API REST**
(exposée par le service, embarquée dans `index.html`).
Le transport est un canal WebSocket, mais la forme des échanges est celle d'une API HTTP
(méthode, chemin, en-têtes, corps JSON, statut, en-têtes de réponse) : `src/lib/remote.js`
construit la requête, l'envoie, journalise l'aller-retour, et gère la reconnexion.

**Qui signe.** L'écran a deux visages. Celui du **rédacteur** ou du bureau de la publication
(onglets « Circuit », « Publication (ELI) », « API »), et celui du **signataire** : l'onglet
**« Ma signature »** (premier onglet d'un compte qui porte la qualité de signataire), d'où il
signe les actes qui l'attendent et suit ceux signés au titre de sa délégation. Le signataire
signe **avec son compte**, rapproché de celui que l'outil de signature lui connaît (voir « Le
signataire », plus haut). Les listes des onglets « Circuit » et « Publication » suivent la
**visibilité du compte** : on n'y voit pas d'acte qu'on ne pourrait pas voir dans l'atelier.

Le déroulé d'une signature :

1. `POST /v1/actes` — l'acte finalisé (Akoma Ntoso) est déposé ; le service en calcule
   l'empreinte SHA-256 (implémentation synchrone incluse dans le script serveur : le
   serveur n'a ni `crypto` ni `TextEncoder`).
2. `POST /v1/actes/{id}/signature` — un circuit est ouvert (`202`, `signatureId`).
3. **Passerelle** vers le prestataire (`src/lib/signature.js`, objet `prestataire`) :
   dépôt du document, ajout du signataire, démarrage. En production ces appels sortants
   sont émis par le serveur ; ici la passerelle s'exécute dans le navigateur et les
   appels sont tracés dans le journal (« Prestataire »).
4. Le signataire signe dans l'écran du prestataire : **la cryptographie est réelle**
   (WebCrypto, ECDSA P-256 + SHA-256, certificat créé une fois par navigateur et
   conservé dans `kv.actesCertificats`, horodatage signé par une seconde clé).
5. `POST /v1/webhooks/signature` — le prestataire renvoie l'acte signé. Le service
   **recalcule l'empreinte** et la compare à celle du document déposé : refus `409` sinon.
6. `POST /v1/actes/{id}/publication` — publication : ELI, version en ligne, dates.
   Refus `409` si l'acte n'est pas signé **ou s'il a été déclaré non publiable**, `422` si la
   date de publication précède la signature. Un en-tête `Idempotency-Key` rend l'appel rejouable.

**Le retour signé publie l'acte.** L'étape 6 n'est pas laissée à l'agent : dès que le retour
de signature est accepté (étape 5), `publierApresSignature` (`src/ui/views/signature.js`)
publie **automatiquement** l'acte **publiable** — date de publication du jour, sauf si la date
de signature est à venir, auquel cas c'est cette date qui est retenue (la publication ne peut
pas précéder la signature). Un acte **individuel** (trame déclarée non publiable) s'arrête à la
signature : conservé au registre, il est notifié à l'intéressé. La publication manuelle reste
possible depuis l'onglet « Publication (ELI) » (choix de la date, du recueil, de la
consolidation), et c'est le même `publier()` que l'automatisme emprunte.

**Le circuit externe — signer sans API.** Le déroulé ci-dessus suppose un prestataire
joignable. Ce n'est pas toujours le cas : beaucoup de collectivités font signer **sur papier**,
ou par un outil qu'elles ne pilotent pas. `src/lib/externe.js` décrit ce **second circuit**, qui
n'appelle **aucune** API de signature : le rédacteur « envoie à signature » — c'est-à-dire
**télécharge** le document prêt à signer, une page A4 précédée d'un **bordereau de remise** (`documentPretsASigner`,
`views/signature.js`) —, le signataire signe hors de l'application, le rédacteur **rentre la
version signée** (« Ajouter la version signée », un PDF dont l'empreinte SHA-256 est calculée
dans le navigateur et le fichier déposé par `upload-plugin`), et le **réviseur certifie la
conformité** de la **pièce signée** avec la version numérique publiée. Le service suit (routes
`POST /v1/actes/{id}/signature-externe` et `POST /v1/actes/{id}/conformite`) et refuse de publier
tant que la version signée manque (`409 version_signee_absente`) ou que la conformité n'est pas
certifiée quand un réviseur est compétent (`409 conformite_non_certifiee`). Le circuit se règle
**globalement** (`config.signature`, Administration › Signature) ou **par trame**
(`trame.signature` : suivre le général, imposé, autorisé — le rédacteur choisit alors acte par
acte —, ou électronique imposé) ; un acte **déjà engagé** dans un circuit y reste. Côté écrans :
la fiche de l'acte montre la version signée, l'onglet « Révision » gagne une file
« Certifications (signature externe) », et le **recueil public** montre le **PDF signé** comme
l'« original », tel qu'il a été mis en ligne. Le détail est dans `SPEC.md` (§ 2.6 ter).

**La signature électronique simple — signer dans l'application, sans prestataire.** Deuxième
alternative au prestataire, `src/lib/externe.js` porte aussi un mode **`simple`** : le signataire
signe **dans Scribae**, avec son compte. Le geste ouvre la **fenêtre de signature**
(`fenetreSignatureSimple`, `views/signature.js`) : le document sous les yeux, l'identité du
signataire (nom, fonction, adresse, compte), l'empreinte du texte, et une **déclaration à
cocher** — « je déclare avoir vérifié le document et j'engage ma signature ». La cryptographie
est celle du circuit électronique (`buildSignedPackage` : ECDSA P-256 + SHA-256, certificat par
navigateur, horodatage signé), et le service vérifie l'empreinte de la même façon
(`POST /v1/webhooks/signature`). Ce qui change est ce que la signature **emporte** : ses mentions
nominatives et la trace des courriels vont dans la part **interne** de l'original, jamais dans la
publication. Le circuit se règle comme les autres (`config.signature.mode = "simple"`, ou
`trame.signature` : `simple_impose`, `simple_autorise`), et `circuitsDisponibles()` dit ce que le
rédacteur peut réellement trancher. Le geste s'y sépare en **deux temps** : **envoyer** en
signature — déposer l'acte, ouvrir le circuit, prévenir le signataire — appartient à la
**rédaction** (c'est par lui que le réviseur, en validant l'acte, le fait partir) ; **signer**
n'appartient qu'au **titulaire** de l'étape, porteur de la qualité de signataire
(`peutSignerEffectivement`, `lib/signataires.js`). La fenêtre de signature ne s'ouvre que pour lui :
tout autre compte est prévenu que l'acte est parti et attend la signature de son titulaire.

**L'original signé se partage en deux.** `partiePublique(pack)` (pure, `src/lib/signature.js`)
retire d'un paquet signé ce qui n'a pas à être diffusé : la part **interne** (`interne`) et, dans
chaque signature, l'adresse électronique du signataire, son `personId`, son `compteId`, son compte
d'outil et son état de rapprochement. Ce qui reste — **nom, fonction, date, empreinte, valeur de
signature, certificat, horodatage** — est ce que le recueil public, `GET /v1/publications/{cle}`,
l'export JSON de l'original et `GET /v1/signatures/{id}/document-signe` donnent à voir. La part
interne suit une autre route : `originalInterneDe(acte)` la compose (identité nominative, moyen
d'authentification, poste, adresse réseau, horodatage, **courriels**), `publier()` la dépose avec
`originalInterne` au dépôt de publication, le service la **range au registre** (`rec.originalInterne`
et `acte.originalInterne`, `src/server/mysql/actes.mjs`) et ne la sert que par la route
**protégée** `GET /v1/actes/{id}/dossier-signature` (jeton). À l'écran, elle se lit par
« Dossier de signature (interne)… » (`voirDossierInterne`). Le circuit **électronique** en
bénéficie aussi : `partiePublique` s'y applique comme au circuit simple.

**Les notifications par courriel : c'est le service qui parle au serveur SMTP.** L'application
n'a **jamais** accès au serveur SMTP ni à son mot de passe : elle demande au service d'envoyer
(`POST /v1/courriel/envoi`), et le service parle au serveur de la collectivité. `src/lib/courriel.js`
porte la **politique** — une donnée du référentiel (`config.courriel` : activation, nom
d'expéditeur, adresse de réponse, copie systématique, et six événements : `demande_signature`,
`signature_donnee`, `acte_publie`, `acte_a_valider`, `acte_a_reviser`, `notification_interesse`)
— et la résolution des destinataires (comptes, rôles, déduplication par adresse, anti-doublon par
acte et par événement). `src/server/mysql/smtp.mjs` est le **moteur SMTP** (RFC 5321/2045/2047,
écrit pour l'occasion, sans dépendance : EHLO, STARTTLS, AUTH LOGIN et PLAIN, encodage du sujet,
corps texte **et** HTML) ; `courriel.mjs` lit `SMTP_*` dans le `.env` et l'alimente ; le service
journalise chaque envoi (`sb_courriel`). Un courriel qui ne part pas est **tracé « non envoyé »**,
avec son motif, au journal **et** sur l'acte (`acte.courriels`) — donc dans son dossier interne.
En démonstration, le service embarqué ne connaît pas de serveur SMTP : `GET /v1/courriel` répond
`disponible: false` avec son motif, et chaque envoi est constaté « non envoyé ».

**Cet automatisme se règle** (« Publication automatique après signature », Administration ›
Publication, `config.publication.auto`, vrai par défaut). Éteint, `publierApresSignature`
s'arrête immédiatement après la signature : ni publication, ni transmission au contrôle de
légalité, et l'acte signé attend au registre — le fait est journalisé. C'est le réglage d'une
administration qui publie dans son propre système ; il coupe le geste **automatique**, pas la
publication, qui reste possible à la main.

**Trames non publiables (actes individuels).** Une trame porte un booléen `publishable`
(`newTrame`, `src/lib/schema.js`), coché par défaut et réglable dans l'onglet « Trame » de
l'éditeur. Décochez-le pour les trames qui produisent des **actes individuels** (revalorisation
d'un traitement, sanction disciplinaire, décision nominative…), avec quelques exceptions. Le
statut est **propagé** jusqu'au service : il ne connaît pas les trames, donc le client le lui
transmet à chaque `POST /v1/actes` (`publishable: actePubliable(acte)`, `views/signature.js`),
et `hPublier` le refuse par un `409 acte_non_publiable`. Les actes concernés suivent tout de
même le circuit (rédaction, signature, conservation, export) ; ils ne reçoivent pas d'ELI, ne
sont pas déposés au recueil, et l'écran « Publication (ELI) » les range dans une carte « Actes
non publiables (conservés) » au lieu de la file à publier. Comme il n'y a pas de texte publié à
consolider, ils ne se modifient pas par acte modificatif : le registre propose « Corriger »
(réécriture directe) et non « Modifier ». L'état se lit à la **trame courante**
(`actePubliable`, `src/ui/state.js`) : déclarer une trame non publiable vaut aussi pour les
actes déjà rédigés à partir d'elle. Les actes sans trame (importés, modificatifs, consolidés)
restent publiables.

Les écritures exigent `Authorization: Bearer <clé>` : le script serveur ne contient **aucun
secret** — pas même l'empreinte d'une clé inscrite dans le code servi, puisqu'il n'y en a
plus. Les clés sont remises par un administrateur (Administration › Base de données), seule
leur **empreinte SHA-256** est conservée dans l'état privé du service, et chacune porte un
**rôle** (`administrateur`, `editeur`, `redacteur`, `lecteur`, `prestataire`) qui commande
les routes qu'elle peut appeler. L'administrateur en crée **autant qu'il en faut**, chacune
avec son **rôle** et son **libellé**, et peut **révoquer** une clé d'un clic ; le service refuse
de révoquer la **dernière** clé d'administration (409 `derniere_cle_admin`), sans quoi il ne serait
plus administrable. Ce sont des **comptes de service** : le référentiel les ignore, elles
n'apparaissent ni dans « Comptes et rôles », ni parmi les personnes, ni dans l'annuaire. Un service
neuf n'accepte aucun jeton : il reste en
**lecture seule** (le recueil public et la résolution des ELI sont servis) tant qu'il n'a
pas été **provisionné** (`POST /v1/auth/bootstrap`, faisable une seule fois depuis l'écran
Base de données). En mode « mot de passe » ou par annuaire, l'administration se fait par la
**session** de l'administrateur — `GET /v1/auth/etat` le dit, sans rien apprendre des clés —, et le
provisionnement initial n'a pas lieu d'être. Le service tient enfin un **journal d'audit scellé**
(`GET /v1/journal`) : chaque geste sensible — dépôt, signature, publication, retrait, épinglage,
gestion des clés — y laisse une ligne qui **scelle la précédente par son empreinte**, et les
2 000 dernières entrées sont conservées. Seules les ressources PUBLIQUES se lisent sans clé : le recueil
(`/v1/publications`, `/v1/eli/…`), la santé du service et l'OpenAPI. Les actes déposés, les
circuits de signature, les comptes et le journal exigent une clé, et `/v1/db/collections/users`
ou `config` en écriture exigent le rôle **administrateur** — c'est ce qui ferme l'élévation de
privilèges qui consistait à réécrire la collection des comptes. `POST /v1/admin/purge` (rôle
administrateur, corps `{ confirmation: "repurge" }`) **remet le service à zéro** : c'est le
pendant, côté service, du bouton « Repartir d'un référentiel vierge » — le recueil public lisant
le service, vider le seul navigateur laisserait les publications de démonstration en ligne. Cette
purge ne touche **ni les comptes ni leurs mots de passe** (tables `sb_record`/`sb_motdepasse`) :
elle vide le dépôt, pas les accès — c'est le même principe que le bouton côté application, qui
épargne les comptes quand ils appartiennent au déploiement (note 1.3.2p).

Deux détails de fonctionnement : les **certificats sont créés par titulaire** (`certificate()`
les indexe par sujet : deux signataires ont deux certificats, comme sur deux postes de
signature) — leur validité encadre largement la date de signature pour que les actes de
démonstration, datés de plusieurs mois, restent cohérents. Et les actions de l'écran sont
réévaluées quand l'état du service change (`onStatus`) : un bouton calculé pendant la connexion
ne reste pas désactivé.

**Registre et recueil.** `src/ui/views/publications.js` lit `GET /v1/publications` pour
l'administration : la liste des publications, leurs métadonnées, les versions d'un même ELI,
les formats et l'original signé — rien n'est lu dans les données locales, c'est ce qui donne
son sens à l'« opposabilité ». La vérification de la signature (`verifySignedPackage`) est
refaite à l'affichage.

**Un acte publié se présente comme sur Légifrance.** `extraireVersion` (`src/lib/recueil.js`)
prélève de la page publiée le **document** (`.doc`) et le certificat de transmission, et **pas sa
feuille de style** : la charte habille le **papier** (aperçu, PDF, Word, page autonome, PDF/A), pas
la version en ligne. L'extraction retire même l'attribut `data-sheet` du document et écarte
l'en-tête et le pied de la charte, sans quoi les règles confinées que l'application tient à jour
pour l'aperçu (`[data-sheet="…"]`, `styleRuntimeCss`) le ré-habilleraient. `CSS_DOCUMENT_WEB` est
alors la **feuille de style web** de l'acte publié : **la même pour tous**, autosuffisante, elle
n'emprunte rien à la charte de l'entité — si bien que **deux entités qui suivent deux chartes
différentes présentent leurs actes à l'identique** sur le site public. Elle s'accorde seulement au
**thème public** du recueil (`--ink-public`, `--brand-public`, `--font-ui`, `--border-strong`…,
posés sur `:root` dans `src/css/app.css`, avec des valeurs de repli), et repose les jetons de bloc
(`--doc-rule`, `--doc-grid`, `--doc-neutral`…) sur ces mêmes valeurs. Le texte n'est donc **pas
enfermé dans une feuille** : il fait partie de la page, dans l'apparence du recueil. La page HTML
autonome reste — pour l'impression, le PDF et le téléchargement.

**Le rendu de l'acte est partagé.** `src/ui/views/acte-publie.js` réunit ce que le recueil public
et la consultation de l'administration ont en commun : `corpsDeLActe` (la **notice** — marques,
titre, bloc de métadonnées — et le **texte**), `blocPieces`, `blocSignature`, `blocVersions`.
La même présentation sert donc aux deux, l'administration ajoutant ses actions (formats, original
signé, onglets « Métadonnées » / « Versions » / « Original signé »). Le **texte** publié s'affiche
sur **toute la largeur disponible**, dans la **police de l'interface** (`CSS_DOCUMENT_WEB`,
`lib/recueil.js`), tandis que la **liste** des actes garde une largeur de lecture (`.recueil-main`
contre `.recueil--acte`, `css/app.css`). `blocOriginal` porte l'**original signé** — la pièce de
référence — **à la demande** : un bouton « Voir l'original signé » l'ouvre dans une fenêtre (le
document tel qu'il a été signé), avec son impression en PDF ; il est appelé par le recueil public
(l'administration, elle, l'ouvre dans son onglet « Original signé »).

**Le recueil public** (`src/ui/views/recueil-public.js`) est la face
« citoyen » : un site **sans compte**, à la **RACINE** du site, qui ne montre que la
structure et ses actes publiés, et interroge le service comme le ferait un visiteur. Il est
rendu **avant la porte de connexion** (`app.js`, `EST_PUBLIQUE`) : un visiteur qui suit un lien
ne voit ni écran de connexion, ni cloche — mais **le bandeau de démonstration**, quand
l'installation en porte un, s'affiche ici comme ailleurs. Ses **adresses** sont celles d'un site :
la racine pour l'accueil, puis les clés du recueil — `?acte=<clé>`, `?eli=<identifiant>`,
`?page=<sous-page>`, `?info=<billet>` — dans la page, et leurs équivalents servis en HTML par un
déploiement auto-hébergé (`/recueil`, `/recueil/<clé>`, `/eli/<code>/<année>/<n°>/<entité>`).
L'**atelier** se **demande** (`?atelier`, ou `/atelier` sur un déploiement), et c'est cette
séparation qui permet de le restreindre à un réseau (voir « L'atelier peut n'être ouvert qu'à un
réseau ») sans fermer le recueil au public. Sa **page d'accueil** se lit de haut en
bas : une **entrée** (nom de l'organisation, titre, phrase d'accueil, recherche, ligne de
chiffres), la **bande des informations** publiées (`informationsZone` — les trois derniers billets,
masquée si la rubrique est éteinte ou sans billet publié), la bande **« À la une »** des actes **épinglés** (`aLaUne`, `publicationsEpinglees` —
masquée dès qu'un filtre est posé, et absente de la démo quand rien n'est épinglé), un
**carrousel** des **derniers actes publiés en vigueur** (`dernieresPublications`,
`publicationsEnVigueur` — défilement par `scroll-snap`, flèches et pastilles gérées en JS, chaque
carte mettant en avant le **thème** de l'acte), une **grille de thèmes** (`themesZone` : une tuile
par matière, teinte déterminée par `hueDe`, qui **filtre** la liste et se dé-filtre au second
clic), puis la **liste complète** groupée par année, avec ses filtres fins (thème, nature, année,
entité). Le carrousel et la grille des thèmes ne sont pas un décor permanent : **dès qu'une
recherche est en cours** — on frappe dans l'entrée, ou l'on choisit un thème —, `peindreResultats`
les **masque** (`sectionCarrousel` / `sectionThemes`, attribut `hidden`) pour laisser les seuls
résultats sous l'entrée ; ils reviennent quand on efface la recherche ou les filtres. Les
**règlements** publiés à titre informatif (voir plus haut) comptent parmi ces publications : ils se
cherchent, se classent par thème, et leur identifiant `eli:/fr/reg/…` s'ouvre comme les autres. Le **thème** d'un acte est la **famille de sa trame** — `themeDe`/`themeLabel`
(`lib/recueil.js`) le résolvent depuis la publication, `themeDePublication`/`themeLabelDePublication`
(`views/acte-publie.js`) le retrouvant par l'acte local quand la publication ne le porte pas — et
sa **phrase de présentation** (`config.families[].description`) s'édite dans Administration ›
Familles. La recherche et la liste s'appuient sur `src/lib/recueil.js` (texte libre, facettes
déduites des actes — dont les **thèmes** —, regroupement par année ; l'**identifiant ELI** d'un
acte se cherche comme ses autres champs). Deux adresses à ne pas
confondre : `hrefRecueil`/`hrefActe` (relatives, la racine du site et ses clés — `?acte=<clé>`) pour
**naviguer** dans la page (un lien absolu rechargerait la page publique dans
son propre cadre), et `adresseRecueil`/`adresseActe` (absolues,
`perchance.org/<générateur>?acte=<clé>`) pour **citer et partager** l'acte. En **bas de page** —
et au bout des résultats de recherche —, le recueil renvoie vers les recueils qu'il ne gère pas et
vers les sites de référence : voir « Le recueil renvoie vers les recueils qu'il ne gère pas ».

**Les sous-pages de l'espace public.** Les mentions du pied de page ne sont plus un bloc replié :
chacune a **sa page** — mentions légales (`?page=legales`), conditions de réutilisation
(`?page=reutilisation`), accessibilité (`?page=accessibilite`) —, et la rubrique des informations
la sienne (`?page=informations`). `PAGES_PUBLIQUES`/`estPagePublique`/`pagePublique`/`adressePage`/
`hrefPage` (`src/lib/recueil.js`) les nomment, `pagePubliqueVue` les rend, et `filSousPage` leur
donne un **fil d'Ariane** quand `metaSousPage` leur pose un titre, une description et une
**adresse canonique** — une sous-page se cite et s'indexe comme un acte. Une mention garde ses
trois présentations (`texte`, `lien`, `aucune`) : en mode `lien`, la page ne porte que le renvoi
vers celle de la collectivité. Une adresse **inconnue** (`?page=…`) rend « Cette page n'existe pas »
— jamais l'accueil en silence.

**Les informations publiées** (`src/lib/informations.js`, `views/informations.js`) sont les
**billets** de la collectivité — actualités, avis, communications —, publiés au recueil comme des
articles de blog : titre, date, auteur, résumé, texte en Markdown, épinglage. Elles forment une
**collection** du service (`informations`, `informations: 1` dans le contrat de la base) servie par
une route publique dédiée — `GET /v1/informations`, qui ne rend que les billets `publie: true` ;
un brouillon ne sort que vers une identité d'`editeur` au moins (`COLLECTIONS_EDITEUR`,
`src/server/mysql/server.mjs`). Le module pur porte les **deux ordres**, et c'est volontaire :
`informationsOrdonnees` est celui du **site** (épinglés d'abord, puis du plus récent au plus
ancien — il ne connaît que les billets publiés), `informationsDeLAtelier` celui de l'**écran**
(tous les billets, brouillons compris) : réutiliser le premier dans l'écran ferait disparaître les
brouillons de la liste, et le filtre « Brouillons » n'aurait rien à filtrer. `manquePourPublier`
(un titre, un texte, une date) garde la publication : publier est un **geste**, pas une case. Le
service de démonstration les sert de la même façon (`hInformations`, `index.html`), et le jeu de
démonstration en livre quatre (`src/lib/demo-informations.js`) — trois publiés, dont un épinglé, et
un brouillon, pour que les deux états se voient.

**La feuille de style de la collectivité** (`config.publication.css`) est le CSS libre que
l'administration écrit dans Administration › Publication › **Apparence du site public**
(`apparencePubliqueBloc`, `views/referentiel.js`) : `cssPersonnalisee` (`src/lib/recueil.js`) la
pose dans un `<style id="recueil-css-personnalisee">`, **avant le premier rendu**
(`poserCssPersonnalisee`, appelé au début de `renderRecueilPublic`) et **à la fin du corps** — la
feuille de l'application est chargée deux fois (le `<link>` d'`index.html` et le module de style),
et un `<style>` d'en-tête passerait avant le `<link>` : une charte qui reprend
`--recueil-largeur` n'aurait alors aucun effet. `retirerMetaRecueil` la retire en quittant le
recueil : l'atelier garde l'apparence du logiciel. `VARIABLES_CSS` (`src/lib/informations.js`)
donne la table des variables que le recueil honore, et l'écran propose un exemple et un bouton
« Vider ».

**Certains actes ne s'adressent qu'aux agents.** Une publication peut être **réservée aux personnes
connectées** (drapeau `reserve` : circulaires internes, consignes aux agents) — la case se pose sur
la **trame** et se reprend **acte par acte** au formulaire de publication. Elle reste *publiée*
(identifiant ELI, version en ligne, pièces, versions successives), mais le **recueil public ne la
sert qu'aux porteurs d'une session ou d'une clé de service — **et venant d'une adresse autorisée**
quand l'accès à l'atelier est restreint (voir « L'atelier peut n'être ouvert qu'à un réseau ») :
être connecté ne suffit pas, il faut venir du **réseau**. Un visiteur anonyme ne la trouve ni
dans la liste, ni à son adresse, ni dans `recueil.json`, `llms.txt` ou `sitemap.xml`. Pour qui y a
droit, elle se présente comme les autres, avec un badge **« Réservé aux agents »** dans la liste et
un bandeau sur la version en ligne. Le bloc **« Vous ne trouvez pas ce que vous cherchez ? »** du
recueil paraît désormais **en toutes circonstances** et le rappelle : certains actes ne sont
consultables qu'après connexion. Un agent **connecté** mais venu d'un autre réseau voit, lui, la
note `noteReserve` qui lui dit pourquoi il ne les voit pas.

**L'atelier peut n'être ouvert qu'à un réseau.** L'espace public est ouvert à tout le monde ;
l'atelier peut, lui, se limiter aux **adresses** de la collectivité — l'intranet, par exemple.
Deux réglages, une seule règle : `SCRIBA_ATELIER_IPS` (et `SCRIBA_ATELIER_MESSAGE`) dans le `.env`
du **déploiement**, `publication.atelier.ips` (et `.message`) dans le **référentiel** —
Administration › Publication › **« Accès à l'atelier »** (`accesAtelierBloc`,
`views/referentiel.js`). Le `.env` **l'emporte** : c'est lui qui survit à une remise à zéro du
référentiel, et le seul qu'un exploitant puisse poser avant la première connexion — l'écran le
dit, et n'offre alors qu'une lecture du réglage. Le format est celui des adresses réseau
(`src/server/mysql/ips.mjs` : adresse, préfixe `192.168.0.0/16`, champ `10.0.0.0-10.0.0.255`,
plage abrégée `10.0.0.*`, commentaire après `#`), et **une entrée incomprise est signalée**
(« Entrée incomprise » : l'écriture de l'exploitant et le motif), jamais ignorée en silence.
`src/server/mysql/atelier.mjs` porte la règle, et c'est la même dans le service de démonstration
(`etatAtelier`, `ipLire`/`ipListe`/`ipEntreeQui`, `index.html`) : liste **vide** → ouvert ; liste
**demandée** → seules ses adresses entrent, et une liste **entièrement illisible FERME** l'atelier
(« fail-closed ») au lieu de l'ouvrir — une faute de frappe ne doit pas laisser la porte que l'on
croyait gardée. La décision est prise par le **service seul** (le seul qui voit l'adresse réelle :
`adresseDeLEntete`, premier maillon de `X-Forwarded-For` ou adresse de la prise) : hors de la
liste, toutes les routes de l'atelier répondent `403 atelier_hors_reseau`, et jamais un 404 muet.
L'application ne fait que **refléter** cet état (`src/lib/atelier-acces.js` : `chargerAcces`,
`acces`, `atelierRestreint`, `horsReseau`, `agentsAvecActesReserves` ; l'écran `hors-reseau` pour
l'agent qui arrive d'ailleurs) et le **simuler** (`?ip=` sur `GET /v1/atelier/acces`) : un
navigateur ne décide jamais de son propre droit d'entrer. Le service de démonstration de la
plateforme, lui, ne voit pas l'adresse de l'appelant : sa réponse le dit
(`restriction_appliquee: false` et une **note**), et le simulateur reste juste — c'est aussi ce qui
explique, dans l'aperçu, qu'un réglage écrit ici ne se voie pas appliqué.

**L'identifiant ELI est une adresse, et les liens ELI mènent à l'acte.** Un acte publié cite ses
fondements par leur identifiant (`eli:/fr/arr/2026/0464/vsl`) : c'est le **visa d'adoption** d'une
annexe, ou le visa qui rappelle un acte modificatif (`src/lib/compile.js`, `amend.js`,
`annexes.js` — le champ `lien` d'un visa). Un identifiant n'est pas une adresse pour autant :
`resoudreLiensEli` (`src/lib/recueil.js`) le **traduit**, à l'affichage, en l'adresse de l'acte
visé — `hrefActe` de sa version **en vigueur** (`indexEli`/`publicationParEli` : l'identifiant
désigne l'**acte**, pas une version ; deux versions publiées sous le même identifiant ne
désignent qu'un acte). Un identifiant que le recueil **ne connaît pas** reste une **mention**
(`.recueil-lien-eli--hors`, sans lien). La liste des publications qui permet la traduction est
posée par les vues (`setListePublications`, `views/acte-publie.js`, appelée par
`recueil-public.js` et `publications.js`) ; à défaut — une page ouverte directement sur un acte —
elle est demandée une fois au service, et la résolution est **différée** jusque-là
(`differe`), jamais tranchée à tort. Le pendant serveur existe pour la page publiée servie en HTML
sans JavaScript (`resoudreLiensEli`, `src/server/mysql/actes.mjs`), et l'identifiant s'ouvre aussi
comme adresse : `/eli/<code>/<année>/<n°>/<entité>` (302 vers la page de l'acte) sur un
déploiement auto-hébergé, `?eli=…` dans la page ailleurs (`adresseEli`/`hrefEli`). Le bloc
**« Recueil ouvert »** de chaque acte (`blocDonneesPubliques`) porte cette adresse, à côté de
l'adresse de référence et des représentations lisibles par machine.

**Le recueil est la porte d'entrée de l'application.** Pour qui n'a pas de compte, le recueil
*est* l'interface de l'installation : son en-tête (`porteApplication`, `views/recueil-public.js`)
porte donc **« Se connecter »** — un bouton, pas un lien gris — tant qu'aucune session n'est
ouverte ; **« Retour à l'application »** quand une session l'est ; et **« Mon accès »** pour un
**visiteur** authentifié sans rôle, qui mène à l'écran d'explication (voir « L'identité reconnue
sans rôle (le visiteur) »). Le recueil lui-même est insensible à la session : un agent connecté y
lit exactement ce que lit un passant.

**C'est la page d'accueil du logiciel.** La route **par défaut** de l'application est `recueil`
(`state.route`, `src/ui/state.js`) : ouvrir l'adresse de l'installation — sans ancre ni
paramètre —, une ancre vide (`#/`), ou une **adresse inconnue**, ouvre le recueil, et non
l'atelier (`normaliserRoute`, `src/ui/app.js` : une vue qui n'est ni dans `VIEWS` ni publique
ramène au recueil). L'atelier s'ouvre par la porte **« Se connecter »** du recueil ou par le
drapeau `?atelier` (le chemin `/atelier` sur un déploiement auto-hébergé, où nginx sert le même
`index.html`) — l'application n'écrit **jamais** ce drapeau d'elle-même (`navigate`/`majUrlRecherche`) :
elle ne touche à l'adresse que pour y poser les paramètres du recueil (`?acte=<clé>`, `?page=…`,
`?info=<clé>`), seuls garants de l'adresse citable d'un acte publié. Conséquence assumée : un agent
qui recharge la page depuis l'atelier revient à la page d'accueil, et retrouve l'atelier d'un
clic.

**Le recueil ouvert** est la même face, tournée vers les **moteurs de recherche et les agents
(LLMs)**, qui n'exécutent pas une application : il leur faut des **adresses stables** et des
**représentations lisibles**. `src/lib/recueil.js` les fabrique (`FORMATS_OUVERTS` — JSON,
Markdown, texte, Akoma Ntoso —, `FICHIERS_OUVERTS` — `llms.txt`, `recueil.json`, `sitemap.xml`,
`robots.txt` —, `adresseActe`, `urlFormat`, `hrefActe`, `hrefFormat`) ; `src/server/mysql/actes.mjs`
les **sert** sur un déploiement auto-hébergé, et `src/lib/recueil.js` sait aussi les dériver du
document publié (`markdownDePublication`, `texteDePublication`, `jsonDePublication`) quand la page
les rend elle-même (`?acte=<clé>&format=md`). `publierMeta` (`views/recueil-public.js`) pose dans
le `<head>` le titre, la description, le `canonical`, un `alternate` par format et les données
structurées JSON-LD, marqués `data-recueil` pour que `retirerMetaRecueil` les efface en quittant
le recueil. `blocDonneesPubliques` (`views/acte-publie.js`) donne ces adresses à **copier**, sous
le texte de l'acte, au public comme à l'administration. Le texte publié voyage avec la
publication (`formats.md`, `formats.texte`) — **sans les notes de préparation** : c'est l'acte qui
est publié, pas l'atelier (`exportMarkdown(doc, config, { notes: false })`).

**La publication automatique se règle.** Administration › **Publication** (`publicationPanel`,
`views/referentiel.js`) porte le titre du recueil, la règle d'opposabilité et
**« Publication automatique après signature »** (`config.publication.auto`, vrai par défaut).
Le même panneau porte les cartes du recueil public — **« Recueils extérieurs et renvois »**,
**« Mentions du recueil public »**, **« Apparence du site public »** (la feuille de style de la
collectivité et les réglages de la rubrique *Informations*) et **« Accès à l'atelier »** (la liste
d'adresses autorisées, le message de refus, l'état vu par le service et le simulateur).
Éteinte, `publierApresSignature` (`views/signature.js`) s'arrête au retour signé : aucune
publication, aucune transmission, l'acte signé attend au registre — le fait est journalisé.
C'est le réglage d'une administration qui publie dans son propre système.

**Le recueil renvoie vers les recueils qu'il ne gère pas.** Une collectivité arrive rarement
vierge : elle a tenu, avant Scribae, d'**autres recueils**. Administration › **Publication** porte
donc, sous `publicationPanel` (`views/referentiel.js`, `recueilsExternesBloc`), la liste
**« Recueils extérieurs et renvois »** (`config.publication.recueilsExternes`, modèle et fabrique
dans `src/lib/recueil.js` : `recueilsExternes`, `newRecueilExterne`, `TYPES_RECUEIL_EXTERNE`,
`RENVOIS_RECOMMANDES`). Chaque entrée a une **nature** — `bis` (un recueil parallèle tenu hors de
l'application), `inactif` (un recueil qui n'est plus alimenté, avec sa **période** `du`/`au` :
plusieurs peuvent se succéder après des changements de logiciel) ou `ressource` (un **site de
référence** : Légifrance, service-public.gouv.fr) —, un **libellé**, une **adresse** et une
**précision** facultative. Les renvois sont **ordonnés** (montée/descente) et **retirables** ; un
bouton **« Rétablir les renvois livrés »** fait revenir Légifrance et service-public.gouv.fr s'ils ont
été supprimés. La liste est purement déclarative : rien n'est codé dans la page.

Ils s'affichent à **deux endroits**, jamais deux fois sur la même page : en **bas de page** de
l'espace public (`pied`, `views/recueil-public.js`), et **au bout des résultats de recherche**
(`zoneResultats`, quand un filtre est posé ou que la recherche ne donne rien), sous le titre
**« Vous ne trouvez pas ce que vous recherchez ? »** (`blocAilleurs`/`groupeAilleurs`/
`itemAilleurs` — les renvois inactifs portent leur période sous leur badge, `periodeRecueil`).
Quand le lecteur est dans une recherche, le bloc du pied de page est masqué par `peindreResultats`
(attribut `hidden`) pour ne pas le répéter. Le bloc n'apparaît que s'il y a au moins un renvoi
`recueilsExternes` **pourvu d'une adresse** (une entrée à moitié remplie ne s'imprime pas).
Le **migration additive** `migrateRecueilsExternes` (`src/lib/store.js`) pose une liste vide sur un
référentiel réel et les renvois livrés sur la démonstration.

**L'espace public porte ses mentions.** Le bas de page du recueil se ferme sur les **mentions
légales** — qui rappellent à quelles conditions un acte publié est exécutoire et opposable
(publication et transmission au représentant de l'État, article L. 2131-1 du CGCT ; recours de deux
mois, article R. 421-1 du CJA) — et sur les **mentions d'accessibilité** (article 47 de la loi
n° 2005-102 du 11 février 2005, RGAA, déclaration d'accessibilité, Défenseur des droits). Même régime
que les renvois : des **données du référentiel** (`config.publication.mentions`, `src/lib/recueil.js` :
`MENTIONS_PUBLIQUES`, `MENTIONS_DEFAUT`, `mentionsPubliques`), réglées dans Administration ›
**Publication** sous **« Mentions du recueil public »** (`mentionsPubliquesBloc`). Chaque mention a
trois **présentations** (`mode`) : `texte` — le texte se **replie sous son titre** (`<details>`,
`blocMentions`) : présent dans la page, donc lisible par un agent comme par un moteur, sans noyer le
pied de page ; `lien` — un simple **renvoi** vers la page de la collectivité (les mentions légales du
site principal, la déclaration d'accessibilité) ; `aucune` — rien. Comme pour les renvois, une mention
**à moitié remplie ne s'imprime pas** (`mentionPublique` renvoie `null`). Le texte se découpe en blocs
(`blocsMention`) : **ligne vide** = nouveau paragraphe, ligne commençant par **« - »** = puce. Un
bouton **« Rétablir le texte livré »** ramène une mention à ce que l'application livre.
`migrateMentionsPubliques` (`src/lib/store.js`) pose les mentions **actives** sur un référentiel
antérieur, et les textes de la fiction sur la démonstration (mentions légales écrites pour la Ville de
Valmont-sur-Loire, accessibilité en **lien**) : les deux formes se voient à l'écran.

**Le bulletin (ou Journal) des actes : le recueil, en numéros.** Le recueil publie au **fil de
l'eau** ; le **bulletin** rassemble. Une collectivité qui veut un rendez-vous régulier — « parue au
bulletin de mars » se cite plus commodément que « publiée le 12 mars » — **ouvre** son bulletin
(*Administration › Bulletin*, permission `bulletin.gerer`, rôles administrateur et éditeur) et lui
donne une **cadence**. `src/lib/bulletins.js` porte le vocabulaire des périodes (les cadences
nommées — quotidienne, hebdomadaire, **bimensuelle** : 1er→15 puis 16→fin —, bimestrielle,
trimestrielle, semestrielle, annuelle — et la cadence **personnalisée**, « toutes les N unités »,
ancrée sur une date), et `bulletinReglages` (`config.publication.bulletin`) les réglages : ouverture,
titre, titre de chaque numéro, sous-titre, cadence, **jour de parution**, et l'en-tête, le pied,
l'expéditeur et l'adresse de réponse des courriels.

Le **moteur** vit au service (`src/server/mysql/bulletins.mjs`, sans dépendance à Node — `sha256` et
l'horloge lui sont injectés), et c'est lui qui décide : il **clôt** les périodes échues, **compose**
les numéros (les actes de la période, classés **par entité puis par thématique**), tient les
**abonnés** et la **file d'envoi**. Une période **sans publication ne donne aucun numéro** — pas de
numéro vide, et la numérotation suit les numéros **parus** (un « n° 3 » manquant ne se voit jamais).
Le service appelle sa passe **au démarrage**, puis à intervalle régulier
(`SCRIBA_BULLETIN_INTERVALLE_MIN`, dix minutes) : une collectivité n'a rien à cliquer, et un service
arrêté une semaine rattrape seul son retard (borné à soixante périodes et à `SCRIBA_BULLETIN_MAX`
numéros conservés). Le **numéro de la période en cours** se lit en **aperçu provisoire** — sans
adresse publique, jamais adressé — et devient définitif à la clôture.

Le bulletin se **diffuse** par trois voies, et l'écran d'administration donne les trois adresses à
copier : la **sous-page** `/recueil/bulletins` (les numéros parus) et `/recueil/bulletins/<période>`
(un numéro, dans son classement), les **représentations** `.json`, `.md`, `.txt` d'un numéro, le
**flux RSS 2.0 et Atom 1.0** (`/recueil/bulletins.rss`, `.atom` — XML **échappé**, entrées bornées à
vingt), et le **courriel aux abonnés**. L'**abonnement** demande **deux gestes** (l'adresse, puis le
lien du courriel de confirmation : sans lui, aucune inscription n'a lieu), le **désabonnement** se
fait d'un clic depuis chaque message — en **deux temps**, un courriel ne devant pas se désabonner
par le seul fait d'être ouvert —, et l'administration peut **retirer** un abonné. Le service ne
conserve que l'adresse, le nom facultatif, les dates et l'état ; les adresses publiques ne disent
jamais **qui** est inscrit (une adresse déjà confirmée reçoit simplement un nouveau courriel de
confirmation). L'abonnement ne s'ouvre qu'avec un **serveur SMTP** (`SMTP_HOST`) **et** l'adresse
publique du recueil (`SCRIBA_PUBLIQUE_URL`) : le service compose seul, la nuit, sans navigateur, et
ne voit donc pas l'adresse du lecteur — c'est celle des réglages qui donne leurs liens aux numéros
adressés. Sans elles, l'écran le dit et la page publique aussi (le motif est affiché au lecteur,
plutôt que de laisser un formulaire échouer).

**Côté poste**, deux modules prennent le relais quand il n'y a pas de serveur : `src/lib/bulletins-service.js`
interroge le service (`chargerPublic`, `chargerTableau`, `generer`, `envoyer`, `retirerAbonne`,
`chargerNumeros`) et ne confond pas **un service muet** avec un bulletin vide (`etat.disponible`) ;
`src/lib/bulletins-formats.js` compose les représentations d'un numéro (texte, Markdown, JSON,
flux RSS et Atom) — un **miroir** du moteur, justifié en tête de fichier : sur un déploiement
auto-hébergé, c'est le service qui sert ces octets, et la page n'a pas à s'en mêler. La copie que le
recueil garde de l'état public (cadence, numéros parus, flux) est **oubliée** dès qu'un réglage ou un
geste d'administration la périme (`oublierBulletinsRecueil`, `src/ui/state.js`), et le **flux**,
adresse machine, relit l'état frais avant de se composer. En démonstration, le **service de
démonstration** est le miroir du moteur (`index.html`), le bulletin de la fiction est **ouvert**
(cadence mensuelle) et ses numéros échus sont composés au démarrage : la démonstration *montre* le
bulletin au lieu de le décrire.

**Le retrait du recueil est un dernier recours, réservé à l'administrateur.** La consultation
d'une publication (`views/publications.js`) ferme sur une **zone sensible** (permission
`publications.depublier`) qui ouvre le retrait : un acte publié y est retiré du recueil
(`POST /v1/publications/{cle}/retrait`) pour un **motif technique** — dépôt en double, dépôt
erroné, acte publié avant signature, identifiant attribué à tort. Le geste est dominé par un
**avertissement en grand** : un acte administratif publié **ne se retire jamais**, et seul un
motif technique le justifie ; corriger un acte, c'est le **modifier** ou l'**abroger**, jamais le
retirer. Le motif est **obligatoire** et **conservé** (`acte.retraits`), l'acte redevient
**signé** — donc publiable à nouveau —, et la trace du retrait s'affiche sur sa **fiche**
(`views/modifier.js`) comme au **journal** (`publication.depublie`).

**Épingler un acte : la mise en avant du recueil public.** L'onglet **Actes** porte sur chaque
acte publiable un bouton **punaise** (`boutonEpinglage`, `basculerEpinglage`,
`views/actes.js` ; icône `pin` de `ui/dom.js` ; permission `publications.epingler`, rôles
administrateur et éditeur) : il met l'acte dans la bande **« À la une »** de l'accueil du
recueil. Le drapeau vit d'abord sur l'**acte** (`acte.epingle`) — on peut donc épingler un acte
**avant** sa publication, son dépôt l'emportant (`views/signature.js`, `publier()` ajoute
`epingle: true` au corps) —, puis sur chaque **enregistrement de publication** du service. Le
geste emprunte `POST /v1/publications/{cle}/epingle` (corps `{ epingle, auteur }`, réponse
`{ ...resume, epingle, versions }`) dès que l'acte a une `publication.cle` ; un acte non encore
publié n'appelle rien, le drapeau partira avec le dépôt. **Le drapeau suit l'ACTE, non la
version** : la route le pose sur **toutes** les versions publiées sous l'identifiant ELI, et
`hPublier` le fait **hériter** à la version suivante (un règlement intérieur modifié reste à la
une). Le registre local, lui, est marqué (`a.epingle`, accusé de réception seulement : un échec
du service est annulé), les caches du registre public et du recueil sont invalidés, et le geste
est journalisé (`publication.epingle` / `publication.desepingle`).

**Amorçage du recueil (démonstration).** Le recueil ne montre que ce qui est **réellement
publié** : un service neuf n'aurait donc rien à consulter. `src/ui/demo-publications.js`
(`amorcerRecueil`, appelé en fin d'amorçage par `app.js`) fait, au premier démarrage, les trois
gestes qui manquaient à une démonstration :

1. **provisionner le service** (`assurerServiceDemo`) — un service sans clé est en **lecture
   seule**, donc rien ne peut y être publié ; la démonstration tire donc elle-même la clé
   d'administration (côté poste, comme toute clé d'écriture : seul son empreinte vit au service) et
   la range dans les réglages locaux. Le verdict n'est pas retenu pour la session : un service
   peut être provisionné puis remis à zéro pendant qu'une page vit, et une clé tenue pour acquise
   ferait échouer en silence les dépôts suivants (`403 service_non_provisionne`) ;
2. **déposer les billets** (`amorcerInformations`) — en régime **local**, l'atelier n'écrit pas
   dans la collection du service : les informations restaient au poste, et la rubrique du recueil
   public restait vide. Le dépôt n'a lieu que si le service en est dépourvu ou en désaccord
   (comparaison des empreintes), pour ne pas réécrire ni journaliser à chaque démarrage ;
3. **publier les actes** que la fiction déclare publiés — **signés comme déjà publiés au registre
   local**, un acte déjà publié n'étant plus « signé » et devant donc être redéposé quand le
   service a été remis à zéro — par le **même chemin** que l'écran de signature
   (`publierActeDuSeed`, `views/signature.js`), de sorte que le registre local et le service
   racontent la même chose. Le succès n'est rapporté qu'après **vérification auprès du service**
   (et non sur l'état local, qui peut être périmé) ; un acte qui porte déjà une **transmission au
   contrôle de légalité** la rejoue avant de publier, sans quoi le dépôt échouerait en
   `transmission_absente`. Chaque publication réussie est **relue** en fiche complète et gardée sur
   l'acte (la réponse de dépôt ne porte ni les formats, ni l'original signé).

**Idempotent** (un acte déjà connu du service est seulement repris au registre local) et
**silencieux** : un service injoignable ne remplit pas le recueil, mais ne gêne rien. L'amorçage
est de plus **repris** quelques fois, à intervalles croissants, tant qu'il reste des actes à
publier : lancé au démarrage, il peut trouver la page occupée (jeu de démonstration à reconstruire,
registre volumineux à écrire) et la première lecture du service échoue avant même d'avoir
commencé. Entre deux actes, il **respire** (`PAUSE_AMORCAGE`) — le service de la plateforme est
tenu à un budget de calcul soutenu, et publier dix-sept actes en chaîne l'épuise ; ce budget
n'existant ni dans l'édition statique ni en auto-hébergement, la pause y est nulle, et le recueil
se remplit en quelques secondes.

**Le recueil public relit le registre du poste quand le service se tait**
(`src/lib/publications-locales.js`). Les publications gardées sur les actes sont relues pour
reconstituer la notice (`publicationsLocales`, avec le rangement des versions par identifiant ELI)
et la fiche complète d'un acte (`publicationLocale`) : un service remis à zéro, un aperçu qui
reconstruit son état ou une page hors ligne ne font plus disparaître des actes réellement publiés.
Ce n'est pas une seconde source de vérité — c'est le **même** enregistrement, gardé au poste. La
règle de diffusion est appliquée à l'identique (`reserve` : un acte à diffusion restreinte n'est
montré qu'à un agent connecté venu d'un réseau autorisé). Les informations suivent la même
logique, mais seulement en régime **local** : en régime « service », la collection du service EST
la base de l'atelier, et fusionner ferait ressurgir un billet que l'atelier vient de dépublier.
Pendant le premier dépôt, la page d'accueil dit **« Le recueil se prépare »** (`amorcageEnCours`)
plutôt que d'annoncer « aucun acte publié », et se redessine d'elle-même.

**Un redessin du recueil réarme ses lectures, et il ne se redessine que s'il est affiché.** Le
recueil public ne se contente pas d'oublier une donnée invalidée (le dépôt des billets, un réglage
du bulletin) : `rafraichir` (`src/ui/views/recueil-public.js`) relance ses trois lectures, qui sont
idempotentes, sans quoi la rubrique oubliée ne revenait jamais — c'est le défaut corrigé en
`1.6.1d`. Et il n'écrit que si la **route** porte encore le recueil : une lecture lancée à
l'affichage peut aboutir après que le lecteur est passé à l'atelier, et le recueil se réécrivait
alors par-dessus l'écran où l'on était. L'application enregistre le redessin public tant qu'il est
à l'écran (`setViewRenderer`, `src/ui/app.js`), pour qu'une invalidation venue de l'atelier
l'atteigne vraiment.

**Limites assumées** : le prestataire est simulé, le certificat n'est pas qualifié eIDAS,
et le service conserve au plus 40 publications (les plus anciennes sont évincées) —
`state` est un `Uint8Array` de taille fixe, rangé en JSON sur une vue UTF-16.

### Le parapheur : un acte est validé avant d'être signé

Le circuit de validation (le parapheur) est une **fonction ordinaire** : l'écran Parapheur, son
entrée de menu, l'onglet « Circuits de validation » de l'Administration, le réglage de circuit
d'une trame et la carte Parapheur d'un acte sont toujours là. Un référentiel qui n'en veut pas
écarte le circuit sur ses trames (« Aucune validation ») ou désactive le circuit concerné ;
`parapheurActif` (`src/lib/validation.js`) rend donc toujours vrai, et le réglage
`experimental.parapheur` — qui n'est plus servi — reste lu (toujours vrai) pour ne pas casser un
référentiel antérieur.

Un acte ne passe pas directement de la rédaction à la signature. `src/lib/validation.js`
définit un **circuit de validation** : une suite d'étapes **séquentielles**, chacune portant une
**nature** et confiée à un **rôle**, éventuellement réservée au service de l'acte. Les trois
natures d'étape sont :

- la **Vérification** (`verification`) — le contrôle du dossier avant tout engagement : la
  marche du **réviseur**, qui ouvre le circuit général de la démonstration ;
- le **Visa** (`visa`) — le « bon pour accord » qui engage le service ou la direction ;
- la **Signature** (`signature`) — le signataire marque son accord, et le circuit s'achève.

Chaque nature appelle un **rôle par défaut** (vérification → `reviseur`, visa → `editeur`,
signature → `signataire`), un libellé et la restriction au service : ce sont les valeurs
proposées quand on ajoute une étape, et l'administrateur peut les changer. Un circuit **ancien**
reste lu — `natureEtape` ramène `accord` à `visa` et `avis` à `verification` —, et les circuits
de la démonstration sont mis au nouveau vocabulaire par `migrateCircuitsNatures`
(`src/lib/store.js`). Deux principes gouvernent le module :

1. **Rien n'est codé en dur.** Un circuit est une donnée du référentiel
   (`config.circuits`), réglable dans **Administration › Circuits de validation** : nombre
   d'étapes, intitulés, natures, rôles, et **ciblage** (trame nommée, famille d'actes,
   entité). Un circuit sans ciblage est le circuit général ; un circuit ciblé l'emporte.
   Un référentiel sans circuit n'a aucun parapheur — le comportement d'origine est préservé.
2. **La validation porte sur un TEXTE.** Le circuit mémorise l'**empreinte** du texte
   validé. Si le rédacteur réécrit ensuite l'acte, la validation devient **caduque** et
   doit être reprise : c'est ce qui empêche de faire signer autre chose que ce qui a été
   approuvé. Le service de signature applique la même règle : il refuse (409
   `validation_incomplete`) d'ouvrir un circuit sur un acte non validé, et l'état du
   parapheur lui est transmis au dépôt (champs sûrs seulement : statut, libellé du circuit,
   empreinte, sort de chaque étape).

L'écran **Parapheur** (`src/ui/views/parapheur.js`) est le bureau du valideur : *à valider
par moi*, *en cours*, *validés*, *renvoyés*. Les gestes — soumettre, décider, reprendre —
vivent dans `src/ui/parapheur-actions.js`, partagés avec la fiche d'un acte
(`src/ui/views/modifier.js`), pour que les deux écrans ne divergent jamais dans ce qu'ils
journalisent ou notifient. Un renvoi ou un refus doit être **motivé** ; les décisions et
observations restent lisibles dans le circuit, sur la fiche de l'acte.

**Une étape peut viser une personne nommée, ou un service.** Le rôle n'est plus la seule façon de
confier une marche : l'administrateur choisit, pour chaque étape, **qui la porte** — le **rôle**
habituel (la valeur par défaut), une **personne** désignée, ou un **service** — qui n'a pas besoin
de faire partie de la chaîne de décision. Les champs correspondants n'apparaissent qu'au choix
retenu, pour ne pas encombrer la marche. C'est le même circuit, décrit plus finement
(`src/ui/views/referentiel.js`, « Circuits de validation »).

**Les circuits se lisent un par un.** L'écran les présente d'abord sous forme de
**récapitulatif**, et ouvre une **sous-vue par circuit** (« Tous les circuits », puis le détail de
celui qu'on choisit) au lieu de les empiler à la suite sur la même page — la comparaison de deux
circuits, ou la relecture d'un circuit ciblé, n'exige plus de traverser tous les autres.

### La révision : un acte est contrôlé avant d'être envoyé

Le **réviseur** s'intercale entre le geste du rédacteur (« Envoyer en signature ») et l'**envoi
effectif** : le geste **soumet** l'acte au réviseur au lieu de le faire partir. Le réviseur lit
un **rapport de conformité**, corrige l'acte au besoin, puis le **valide** — l'acte part alors en
signature, par le **même chemin** que le bouton d'envoi — ou le **rejette** en motivant, et l'acte
**revient en brouillon** chez son rédacteur avec le motif. C'est **indépendant du parapheur** :
l'ordre est **parapheur → révision → signature** (`pretPourSignature`, `src/ui/state.js`).

**Le fil de parcours — où chaque porte se situe.** Ce chemin est calculé une fois pour toutes
(`parcoursDeActe`, `src/lib/parcours.js`, module **pur**) et dessiné par un objet partagé
(`bandeauParcours`, `src/ui/parcours.js`, styles `.pc-parcours`) : une puce par phase —
rédaction, parapheur, révision, signature, publication — dans l'ordre **réel**, la phase courante
mise en avant, le **titulaire** de chacune, et les étapes du circuit **vues de l'intérieur** (leur
nature et qui les porte). Quand la révision s'intercale, sa puce porte sa position en toutes
lettres (« après le parapheur · avant la signature ») ; dans le circuit **externe**, la révision
cède la place à la **certification de conformité**, APRÈS la signature. Une porte que l'acte a
**passée sans la franchir** (un acte signé et publié sans trace de révision, par exemple) ne
s'affiche ni comme « en cours » ni comme « à venir » : elle est **non franchie** — puce creuse —
et cette lecture vaut aussi pour les marches du circuit de signature (`stepEl`,
`src/ui/views/signature.js`) et pour la carte « Révision » de la fiche d'un acte. Le fil s'affiche
sur la rédaction (`src/ui/views/rediger.js`), le circuit de signature (`src/ui/views/signature.js`), le
parapheur (`src/ui/views/parapheur.js`) et la révision (`src/ui/views/revision.js`) : les quatre
écrans disent ainsi la même chose du même acte. Une **annexe** a son propre fil — rédaction →
adoption → publication informative pour un règlement —, qui rappelle qu'elle ne se signe pas, et
la liste des actes de l'écran de signature lui donne l'étiquette « Annexe — ne se signe pas » au
lieu de « Prêt à signer ».

`src/lib/revision.js` est **pur** (ni DOM ni état) :

- **Compétence.** Un acte n'est révisé que s'il existe un réviseur **compétent** pour lui ; sans
  réviseur compétent, la révision n'a **pas lieu** et l'acte part directement en signature
  (`revisionRequise`) — le comportement d'origine est préservé. La qualité se donne **à un
  compte** (rôle cumulable « Réviseur » + `user.revision`) ou **à un service** (ou à certains de
  ses bureaux) par `service.reviseur`, réglé dans **Administration › Services** (« Qualité de
  réviseur ») — le cas d'un service des affaires juridiques qui contrôle les actes des autres
  services. Une compétence cible des **services**, **familles** de trames, **trames**, **types
  d'actes** et **entités** ; une liste vide vaut « tout ». `competenceCouvre`, `competencesDe`
  (réunion des compétences du compte), `reviseursPour`, `peutReviser`, `peutTrancherRevision`
  (recours de l'administrateur), `competenceLabel`.
- **Texte révisé.** L'**empreinte** du texte soumis (`empreinteTexte`, partagée avec le
  parapheur) est mémorisée : réécrire l'acte après coup rend la révision **caduque**
  (`revisionAJour`, `etatRevision`) et elle doit être reprise. `demanderRevision`,
  `validerRevision`, `rejeterRevision`.
- **Rapport de conformité** (`src/lib/conformite.js`, `rapportConformite`) : ce qui est
  vérifiable automatiquement — identité de l'acte, contrôles de la trame, structure du document,
  visas et références, mentions et publicité, écarts et annotations — groupé, avec un compte
  d'erreurs, d'avertissements, d'informations et de contrôles conformes. Il **éclaire**, il ne
  décide pas.

**Écrans et gestes partagés.** `src/ui/views/revision.js` (quatre files : *à réviser par moi*,
*en attente d'un autre réviseur*, *révisés*, *rejetés*) ; `src/ui/revision-actions.js`
(`soumettreARevision`, `validerRevisionActe`, `rejeterRevisionActe` — la validation appelle
`envoyerEnSignature` avec `ouvrirOutil: false`) ; `src/ui/revision-cartes.js` (dossier, rapport,
décision — partagés avec la fiche d'un acte, `src/ui/views/modifier.js`). L'en-tête de la
rédaction (`src/ui/views/rediger.js`) et la fiche affichent l'état et le **motif** d'un rejet.

**Porte côté service.** L'état réduit de la révision (`normaliserRevision`, index.html) est
transmis au dépôt de l'acte, et le service refuse d'ouvrir un circuit de signature sur un acte
dont la révision n'est pas `valide` : `409 revision_incomplete`.

### Le caractère exécutoire et les délais

Un acte signé n'est pas encore **exécutoire**. `src/lib/execution.js` décrit les formalités
qui le rendent opposable : **transmission** au contrôle de légalité, **publication** au
recueil, **notification** aux intéressés. Chacune est *requise* ou non selon la trame
(`trame.transmission`, `trame.notification` ; la publication suit la déclaration
« publiable ») et selon la nature de l'acte. La **date d'exécutoire** est celle de la
**dernière formalité requise accomplie** — et c'est de là, et non de la signature, que court
le **délai de recours contentieux** (deux mois par défaut, réglable dans
**Administration › Exécution & délais**).

Une formalité n'est pas une déduction : c'est une **attestation de l'agent** (« transmis le
12 mars, accusé @ctes n° … »), horodatée et signée de son auteur, conservée au journal. Le
formulaire de constatation vit dans `src/ui/execution-actions.js`, partagé par l'échéancier
et par la fiche de l'acte. L'écran **Exécution & délais** (`src/ui/views/execution.js`)
classe les actes signés en *formalités à accomplir*, *recours*, *définitifs*, et
signale les retards (transmission et publication en souffrance, délai de recours qui se
referme). La fiche d'un acte en rappelle l'essentiel.

**Le recours, lui, est un fait et non une échéance.** L'administration l'apprend par la pièce
qu'elle reçoit ; elle le **note** — date d'introduction, nature (gracieux, hiérarchique,
contentieux, référés, déféré préfectoral), auteur, référence, observation — et cette date
**ferme le délai** : l'acte passe au statut *recours introduit*, il n'est plus « définitif par
écoulement du délai », et il le reste jusqu'à la décision du juge. Un acte contesté ne peut donc
pas faire l'objet d'une **attestation de non-recours** : la fonction refuse d'attester le faux.

Deux **pièces** se délivrent depuis l'échéancier (`src/lib/execution-documents.js`), sur le
papier A4 commun et en PDF par l'impression du navigateur — leur en-tête est celui de l'entité,
non la charte de l'acte, car ce ne sont pas des actes :

* l'**état des formalités** — pour **tout acte signé** : le tableau des formalités (date,
  référence, modalité, auteur, requise ou non), le certificat de transmission s'il existe, puis
  la situation (exécutoire, délai, recours) ;
* l'**attestation de non-recours** — pour un acte **définitif** et **sans recours** : elle
  identifie l'acte, atteste qu'aucun recours n'a été porté à la connaissance de la collectivité,
  rappelle les formalités par lesquelles l'acte est devenu exécutoire et la date d'expiration du
  délai, et se présente prête à signer (bloc de signature de l'autorité, emplacement du cachet).

Chaque délivrance entre au **journal** : une pièce sortie du registre est un fait du dossier.

### La transmission au contrôle de légalité par API (fonction expérimentale)

**Fonction expérimentale, éteinte par défaut** (`config.experimental.controleLegalite`,
**Administration › Expérimentale**) : elle reste **la seule fonction expérimentale**, parce que la
télétransmission suppose une convention et des identifiants d'accès auprès de la préfecture.
Éteinte, rien n'est envoyé, la marche n'apparaît pas dans le circuit de signature, et la
transmission reste une **constatation manuelle** (§ ci-dessus).

Activée, l'étape **s'intercale entre le retour signé et la publication**
(`publierApresSignature`, `src/ui/views/signature.js`) :

1. `POST /v1/actes/{id}/transmission` — l'acte signé part vers l'**API d'envoi**
   (`CONTROLE_LEGALITE.apiUrl`, `src/lib/legalite.js`) ; l'appel sortant est **tracé** dans le
   journal du service (`recordExternal`, service `controle-legalite`) ;
2. l'**accusé de réception** revient et **vaut certificat informatique de transmission** —
   mention « Transmis au contrôle de légalité le … à … », référence `AR-…`, `empreinte`
   (SHA-256 du document transmis) et **sceau** (`sha256(reference|recuLe|destinataire|empreinte)`,
   recalculable par `verifierCertificatTransmission`) ;
3. le certificat est **déposé sur le document** : `acte.original.transmission` — **l'empreinte
   du paquet signé n'est pas touchée**, le certificat est une pièce du dossier, pas une
   signature — et la mention s'imprime sur la **version en ligne** (`buildWebVersion`). Le
   **sceau est vérifié à l'affichage** de l'original signé (`verifierCertificatTransmission`) ;
4. la formalité est constatée au nom de l'agent (`enregistrerFormalite`, champ `certificat`) ;
5. l'**acte est publié**, certificat joint à l'enregistrement de publication.

L'ordre **signé → transmis → publié** est tenu par le **service**, pas seulement par le
client : le drapeau est transmis au dépôt (`POST /v1/actes`, `controleLegalite`),
`hTransmettre` refuse un acte non signé (`409 acte_non_signe`), `hPublier` refuse un acte
soumis à l'étape et non transmis (`409 transmission_absente`) — après le contrôle de
signature, avant celui de la date — et la transmission est **idempotente**
(`GET /v1/actes/{id}/transmission` relit le certificat). Les deux services portent le même
contrat (`index.html` et `src/server/mysql/actes.mjs`, testé par `actes.test.mjs`).

Un acte **déposé avant l'activation** ne porte pas l'exigence. Les transmissions de
démonstration (`src/lib/demo-actes.js`) portent leur certificat, calculé par le même
`certificatTransmission()` : la démonstration ne court-circuite rien.

### Registre : recherche globale, corbeille, journal, versions

- **Recherche globale** (`src/lib/search.js`, `src/ui/global-search.js`) — **Ctrl+K** ou
  **« / »** ouvre une superposition qui cherche dans les actes, les trames, les personnes,
  les services, les références, les comptes et le guide, et se pilote au clavier.
- **Corbeille** (`src/ui/views/corbeille.js`) — la suppression d'un acte ou d'une trame est
  **réversible** (`deletedAt`, `deletedBy`) ; les objets partent à la corbeille, en
  reviennent, ou y sont supprimés définitivement. Les listes ordinaires les ignorent.
  **Seuls les actes encore modifiables** (`isDraftable` : brouillon, « prêt ») peuvent y être
  mis ; un acte signé ou publié n'a plus le bouton corbeille — il se **retire du recueil** ou
  s'**abroge**, par un acte nouveau (voir « Abroger un acte, ou l'un de ses articles »).
- **Journal d'audit** (`src/lib/collab.js`, écran **Administration › Journal d'audit**) — tous
  les faits de l'installation, du plus récent au plus ancien, filtrables : soumissions au
  parapheur, décisions, signatures, publications, constatations de formalités, mises à la
  corbeille. Les 300 derniers sont conservés.
- **Historique des brouillons** (`src/lib/historique-brouillons.js`, carte sur la fiche d'un acte) —
  chaque enregistrement conserve l'état **précédent** (valeurs et écarts), avec sa date, son
  auteur et son libellé. Les vingt dernières versions sont gardées, et l'on peut **revenir à
  l'une d'elles** : l'état courant est archivé au passage, rien ne se perd. C'est un
  historique de *travail* — la mémoire juridique de l'acte, elle, est dans les versions
  publiées et dans le journal.

### Collaboration : présence, verrou de rédaction, notifications

`src/lib/collab.js` tient les trois signaux qui font qu'un poste n'est pas seul :

- la **présence** (battement toutes les 25 s, considéré en ligne après 70 s ; diffusion par
  `BroadcastChannel` et sondage de 30 s, pour que deux fenêtres du même poste se voient) ;
- le **verrou souple de rédaction** : quand un acte est ouvert ailleurs, l'éditeur l'annonce
  (« Cet acte est ouvert sur un autre poste ») — il avertit, il n'empêche pas ;
- les **notifications** : le journal porte ses destinataires (`to` accepte un identifiant de
  compte, `role:…`, `service:…` ou `tous`), et la **cloche** de l'en-tête affiche les faits
  non lus qui concernent le compte.

`src/ui/collab.js` monte ces témoins dans la barre de l'application (pastilles de présence,
cloche et panneau). Le journal et la présence sont deux **collections** du contrat de
persistance (`journal`, `presence`) : elles sont marquées silencieuses (pas de toast de
conflit), et le service MySQL ne les recopie pas dans son journal technique — ce sont
elles-mêmes des flux.

### Les assistants : « Plume » dans l'atelier, « Publia » sur le recueil

Deux aides en langage naturel, livrées avec l'application (Administration › Assistants) :

- **Plume**, dans l'atelier, explique le **mode d'emploi** de l'outil — où cliquer, quoi faire
  dans quel ordre, ce que veut dire un message ;
- **Publia**, sur le recueil public, répond aux visiteurs à propos des **actes publiés**.

**Ce qu'ils savent, et rien d'autre.** La connaissance de Plume est le **guide d'utilisation**
(`src/wiki.js`), qui est public — il est livré avec l'application —, plus le nom de l'écran
courant. **Le contenu d'un acte, d'une trame, d'un brouillon ou d'un compte ne lui est jamais
transmis** : il n'y a rien à filtrer, parce que rien ne lui est envoyé. Publia ne reçoit que
les **actes publiés** (leurs métadonnées, et le texte des plus récents) tels que le registre
public les donne — c'est exactement ce que le recueil affiche à tout venant.

`src/lib/assistant.js` porte les deux assistants et **la façade du moteur** :
`repondre()` compose l'invite — instruction, connaissances, conversation, tâche — puis la
confie au moteur. Le moteur est **interchangeable** (Administration › Assistants) :

- **automatique** (défaut) : le moteur intégré quand il existe (le plugin `ai-text` de
  Perchance), l'adresse de la collectivité sinon, le **repli documentaire** à défaut — c'est
  le réglage qui fonctionne partout ;
- **intégré** : uniquement Perchance ;
- **personnalisé** : l'API de la collectivité (adresse, clé, modèle), en **complétions de
  conversation** façon OpenAI (flux SSE — OpenAI, Mistral, Groq, OpenRouter, Ollama, vLLM,
  LM Studio…) ou en **appel simple** `{ prompt } → { texte }`. C'est le seul moyen d'obtenir
  des réponses **rédigées** hors de Perchance ; une adresse vide est signalée comme une
  configuration à corriger.

**Le repli documentaire : répondre sans moteur.** Faute de moteur de langage — page servie en
statique (GitHub Pages), déploiement sans API —, `moteurDe` rend `{ type: "repli" }` et
`repondre` ne compose **aucune invite** : l'assistant cherche la réponse **ici**, dans le
navigateur, sans le moindre appel réseau. Il cherche dans la matière même qu'un moteur
recevrait : `chapitresPertinents` pour Plume (les trois chapitres retenus, nommés par leur titre
et leur résumé — c'est le titre, plus que le classement, qui dit au lecteur lequel est le sien —,
puis le premier mis à plat par `chapitreEnTexte`, ses repères de modèle traduits par
`pourLecture` et son texte tronqué sur une fin de ligne pour que son lien reste entier),
`scoreActe` pour Publia (métadonnées comptées trois fois, texte une fois ;
l'acte consulté passe devant à égalité), rendu par `ficheLisible`. Ce sont des **extraits, pas
des réponses rédigées** : le panneau l'annonce dans une note (`fr-alert--info`) qui laisse la
saisie ouverte — à distinguer de `aucun`, où la saisie disparaît et où l'alerte dit ce qui
manque. C'est ce qui donne un assistant utile à une démonstration statique, sans clé d'API et
sans qu'un mot de la question sorte du navigateur.

**Leur nom et leur visage.** L'administrateur change le **nom** et l'**icône** de chacun
(Administration › Assistants) : `assistantIdentite` est la seule source de ce que l'interface
affiche, et la coquille relit ces valeurs à chaque redessin (`identites[qui]`) sans reconstruire
la conversation. Un champ vide rend la main aux valeurs livrées. Chaque agent peut en outre
**masquer** un assistant pour son seul compte, dans le menu de son nom : c'est une **préférence de
poste** (`assistantPref` / `reglerPrefAssistant`, rangée par compte dans le navigateur, hors du
référentiel), et `assistantVisible` croise ce choix avec le réglage *Éteint* de l'installation.

**Le choix des chapitres du guide est un problème de budget, pas de recherche.** Le guide
entier ferait vingt mille jetons, la fenêtre utile en fait six mille : `wiki.js` classe donc
les chapitres par pertinence (`chapitresPertinents` : titre ×10, résumé et mots-clés ×7, corps
×1, chaque mot pondéré par sa rareté *dans ce champ*), et `contexteAtelier` joint les trois
premiers, ceux de l'écran courant, puis
un socle — tronqués plutôt qu'écartés, avec la **table des matières complète** sous les yeux
du modèle pour qu'il puisse renvoyer au bon chapitre.

`src/ui/assistant.js` est la coquille d'écran : une pastille flottante (le personnage), une
bulle qui propose une question de temps en temps — le clin d'œil à l'aide contextuelle
d'autrefois —, et un panneau de conversation. Les deux pastilles vivent **hors de la
coquille de l'application** (posées au démarrage dans `document.body`) : elles ne sont pas
reconstruites aux redessins, donc une conversation en cours ne se perd pas quand on change
d'écran — c'est leur **visibilité** qui suit la route (jamais sur le recueil public pour
Plume, jamais ailleurs que sur le recueil pour Publia). Les deux s'éteignent séparément
(`config.assistant.<qui>.actif`), et l'instruction comme les questions proposées se règlent
par assistant.

**Les réponses renvoient par des liens cliquables.** Plume termine par le **lien du chapitre** du
guide — `guideSommaire()` donne à chaque ligne « — lien : `[titre](#/aide/<id>)` » —, Publia
recopie le **lien d'un acte** (`hrefActe`, « `[numéro — objet](?acte=<clé>)` »). Le panneau les
intercepte (`routeInterne`) et les ouvre **dans l'application**, sans recharger la page : `#/aide/…`
mène au chapitre, `recueil/<clé>` à l'acte. Le moteur n'écrit jamais d'adresse — il recopie,
libellé, ce qu'on lui donne, et ne parle ni de « clé » ni de « paramètre ». Et quand un **acte du
recueil est ouvert**, `contextePublic` reçoit en plus l'**acte consulté** (sa fiche, toutes ses
versions publiées, son texte) : l'instruction demande alors de répondre **d'abord sur lui** — ce
qu'il prévoit, sa portée, ses dates, ses modifications —, ce qui est la question que se pose le
lecteur même s'il ne la formule pas. Trois questions d'acte passent en tête des suggestions.

## Persistance et base de données

L'application ne sait pas *où* sont rangées ses données : elle passe par une
**façade de persistance** (`src/lib/db/index.js`) qui choisit un **pilote**.

| Mode | Pilote | Ce que ça donne |
|---|---|---|
| **Locale — ce navigateur** (défaut) | `db/local.js` (IndexedDB) | mode de démonstration : rien à installer, données propres au poste |
| **Service de démonstration — partagé** | `db/service.js`, transport `socket` | l'état durable du service de démonstration tient lieu de base, sans rien installer ; **partagé** entre postes quand la page est servie par la plateforme, **propre au navigateur** dans l'édition statique (le libellé du mode le dit) |
| **Serveur externe — MySQL / MariaDB** | `db/service.js`, transport `http` | la base de la collectivité, via le service de données de `src/server/mysql/` |

Le réglage vit dans `kv.actesDb` — il est **propre au poste** et n'est jamais
exporté avec le référentiel. L'écran **Administration › Base de données** le règle,
teste la connexion, et assure le transfert (envoyer / récupérer).

### Le modèle : collections et enregistrements

L'application manipule ces **collections** (`contract.js`) : `config`
(singleton), `trames`, `actes`, `reprises` (les actes anciens repris — voir « La
reprise d'un acte ancien »), `users`, `informations` (listes d'objets identifiés
par `id`), `journal` et `presence` (listes — l'audit et la présence des postes),
`meta` (singleton) et `session` (**local seulement** — jamais transmise).

Un **enregistrement** est l'unité d'échange : un objet de liste, ou l'objet
unique d'une collection singleton (rangé sous l'id `self`). `ord` porte la
position, donc l'ordre d'affichage.

### Synchronisation par différences

À chaque écriture, la façade compare le document à son dernier **index connu du
serveur** (comparaison JSON *stable* : l'ordre des clés n'entre pas en jeu) et
n'envoie que les enregistrements réellement modifiés — `upserts` et `deletes`,
chacun muni de la **révision** que le client connaissait.

Le serveur refuse un enregistrement dont la révision ne correspond plus
(quelqu'un d'autre l'a modifié entre-temps) et **renvoie sa version** : c'est un
**conflit**. L'application reprend alors la version de la base — en la signalant
— plutôt que d'écraser en silence le travail d'un autre poste. Deux postes qui
touchent des éléments *différents* ne se gênent jamais.

Les écritures d'une **même collection** se suivent, une à la fois : la façade
sérialise par collection (`db/index.js`), et le service fait de même de son côté
(`server/mysql/magasin-mysql.mjs`). Sans cela, deux écritures parties ensemble —
le battement de cœur et une action de l'agent, la reprise automatique pendant une
saisie — lisaient le même index connu, calculaient le même delta et se
rejouaient l'une l'autre ; chacune ne voyait pas ce que l'autre venait d'écrire.
Deux collections distinctes, elles, continuent d'écrire en parallèle.

### Hors ligne

En mode partagé, chaque lecture réussie est recopiée dans un **miroir** local
(`kv.actesMirror`) : si la base est injoignable, l'application démarre quand même
avec ces données, et un bandeau le signale. Les écritures qui échouent faute de
réseau sont **mises en file** (`kv.actesPending`) et renvoyées dès que la base
répond — toutes les trente secondes, au retour du réseau, et sur un renvoi demandé
à la main. Un refus définitif (session, anti-CSRF) n'est pas mis en file : il faut
corriger le réglage.

Trois règles gouvernent cette file ; l'écran *Base de données* les rend visibles
(ce qui attend, depuis quand, ce que la base a répondu au dernier renvoi, et les
gestes *Renvoyer maintenant* / *Abandonner ces écritures*) :

- **une écriture par collection** : les différences d'une collection sont toutes
  calculées sur le même index serveur, et rien n'en a été appliqué tant que la file
  n'a pas été vidée — la plus récente porte donc tout ce que les précédentes
  demandaient, et davantage. Soixante-quinze battements de cœur d'un même poste y
  tiennent en une écriture ;
- **un renvoi n'est pas arrêté par la première entrée refusée** : chaque entrée est
  essayée, celles qui échouent restent (rien n'est perdu), et le motif du premier
  refus est rapporté avec ce qui a été transmis malgré tout. S'arrêter au premier
  refus laissait une seule écriture définitivement refusée — une écriture de
  `users` ou de `config` mise de côté par une session d'administrateur, rejouée
  après qu'un compte ordinaire a pris la place du poste (`403 droit_requis`) —
  bloquer TOUTE la file derrière elle, à jamais ;
- **le motif est conservé** (`kv.actesPending`, clé `meta`) : sans lui, une file
  muette grossit toute seule et l'exploitant ne peut ni savoir pourquoi, ni quoi
  corriger. Le motif nomme la collection refusée, et la phrase qui dit le geste.

Un renvoi interroge rarement un pilote juste : quand le service refuse une
écriture par `csrf_invalide` ou `session_absente`, l'application **répare** le
pilote avant de renoncer (`reparerPilote`, `src/lib/db/index.js`) — elle redemande
son mode au service (`GET /v1/auth/config`), relit la session et son jeton
anti-CSRF, refait le pilote si le régime a changé, et rejoue l'écriture une fois.
Sans cela, une page chargée pendant un redémarrage du service restait bloquée sur
un pilote sans anti-CSRF jusqu'au prochain rechargement de la page.

### Le service de données (contrat REST)

Trois routes, implémentées **deux fois** — par le service partagé de démonstration
(embarqué dans `index.html`) et par le server MySQL/MariaDB de `src/server/mysql/` :

| Route | Rôle |
|---|---|
| `GET /v1/db/health` | état du service et de chaque collection |
| `GET /v1/db/collections/{collection}` | tous les enregistrements, avec leur révision |
| `POST /v1/db/collections/{collection}/sync` | `upserts` / `deletes` / `force` → `applied` + `conflicts` |

Les écritures exigent `Authorization: Bearer <jeton>` ; le service ne conserve
que l'**empreinte SHA-256** du jeton, jamais sa valeur. Le serveur MySQL tient à
jour, à chaque écriture, des colonnes indexées (`numero`, `statut`,
`service_id`…) recopiées du document, et journalise tout dans `sb_journal` :
la base reste donc **interrogeable en SQL** sans jamais saisir ces colonnes à la
main. Voir `src/server/mysql/README.md` (le service et sa base) et
`src/server/README.md` (installation Docker, jetons, TLS, sauvegardes).

> **Éprouver une connexion ne se fait pas par la santé de la base.**
> `GET /v1/db/health` ne demande ni session ni anti-CSRF : elle répond 200 même
> quand le service refuse ensuite chaque écriture — d'où un écran qui annonçait
> « Connexion réussie » à côté d'une pastille rouge. Le bouton *Tester la
> connexion* envoie donc **aussi** une synchronisation VIDE
> (`POST /v1/db/collections/meta/sync`, `upserts: []`, `deletes: []`) : elle
> traverse toute la garde — session, anti-CSRF, rôle, transaction — sans déposer
> le moindre enregistrement (voir `essaiEcriture`, `src/lib/db/service.js`).

> **Ce que le service de démonstration ne peut pas faire** : son bac à sable
> n'ouvre aucune connexion sortante. Il ne peut donc **pas** parler à MySQL — il
> n'est là que comme base partagée de démonstration. C'est précisément pour cela
> que le serveur externe existe, et que les deux parlent le même contrat.

### Démonstration statique (GitHub Pages)

La démonstration est servie **en statique** : aucune installation, aucun serveur. Le dépôt
publié tel quel suffit — `index.html` (qui porte un `<!doctype html>`, un `viewport` et un
titre) et `src/`.

Deux services manquent alors à l'appel, et **`src/pages/host.js` les fournit** :

| Service attendu | Ce que fait l'édition statique |
|---|---|
| `root.kv` (stockage par dossier) | une base **IndexedDB** du navigateur (repli en mémoire), celle du mode « local » |
| `root.createServerSocket` (API du service) | le **script serveur d'`index.html`, relu dans le DOM et exécuté dans la page**, avec un état durable (IndexedDB) |

Autrement dit, l'édition statique **ne réimplémente rien** : le service qui dépose, signe et
publie est le code du service lui-même, hébergé par l'onglet au lieu d'un serveur. Ce qui
change, et qu'il faut savoir :

- l'état du service est **propre au navigateur** — les fonctions dites « partagées » ne le
  sont qu'entre les onglets d'un même poste. Le mode de persistance s'y appelle donc
  « Service embarqué — ce navigateur » (voir `db/index.js`) ;
- tout le parcours fonctionne **sans réseau** : signature ECDSA (`crypto.subtle`, donc
  HTTPS obligatoire), contrôle d'empreinte, publication, ELI, opposabilité ;
- la résolution des services de l'hôte passe par **`src/lib/hosts.js`**, seul endroit qui sait
  où les chercher — le stockage, le canal du service, et le relais HTTP sans CORS dont la
  numérotation externe a besoin (indisponible hors de l'édition en ligne : voir « La
  numérotation » ci-dessus). `src/pages/host.js` est sans effet dans l'environnement d'édition
  et dans le déploiement auto-hébergé (il ne s'installe que si les services manquent). Poser
  `window.__SCRIBA_FORCE_STATIC__ = true` avant son exécution force l'inverse : c'est ainsi
  qu'on relit l'édition statique depuis l'éditeur ;
- **la plateforme ne pose pas ses règles de style.** Tout le code masque en posant l'attribut
  `hidden` (`el.hidden = true`), jamais `style.display` : c'est la plateforme Perchance qui
  fournit la règle `[hidden] { display: none }`. Une page statique ne l'a pas, et une classe
  qui pose `display: flex` l'emporte alors sur le `display: none` du navigateur (sélecteur
  d'attribut 0,1,0 contre sélecteur de type 0,0,1) — un panneau « fermé » restait ouvert.
  `app.css` reprend donc la règle (`[hidden] { display: none !important; }`) : c'est ce qui
  rend la fermeture du panneau de l'assistant effective hors de Perchance ;
- **l'assistant n'a pas de moteur de langage** : `moteurDe` rend `{ type: "repli" }`, et
  Plume comme Publia répondent par **recherche documentaire** dans le guide (ou dans les actes
  publiés) — sans réseau, sans clé, rien à installer. Voir « Les assistants » plus haut.

**Publier.** Dépôt → *Settings* → *Pages* → *Source* : *Deploy from a branch*, branche
`main`, dossier `/ (root)`. Le site est à `https://<compte>.github.io/<dépôt>/` ; les chemins
de `index.html` sont relatifs, donc un sous-dossier de projet convient.

**L'adresse de la démonstration est fixée dans le dépôt** : le fichier `CNAME` de l'export
porte `demo.scribae.eu`, et c'est là que la démonstration publiée répond. Un nom de domaine se
branche dans *Settings → Pages → Custom domain* (avec, chez l'hébergeur DNS, un enregistrement
`CNAME` du nom vers `<compte>.github.io`, et *Enforce HTTPS* — l'application signe dans le
navigateur, ce qui exige HTTPS) ; GitHub écrit alors ce même fichier. **Un fork doit remplacer
ou supprimer ce `CNAME`** : sans cela, sa copie réclamerait une adresse qui n'est pas la sienne.

**L'adresse fait le stockage.** Le stockage du navigateur est attaché à l'**origine** du site :
la démonstration servie sous son domaine et la même servie sous `https://<compte>.github.io/…`
sont, pour le navigateur, **deux installations distinctes** — deux référentiels, deux recueils,
et un visiteur qui change d'adresse ne retrouve pas son travail. C'est la raison du `CNAME` :
**une seule** adresse publiée, et c'est celle-là qu'on communique. Servir la même page sous un
second nom ne partage rien (pour un état partagé entre postes, il faut le service : voir plus
bas, et `docs/ADMINISTRATION.md` § 7.6).

> **Un fichier `.nojekyll` vide à la racine est obligatoire.** GitHub fait passer le dépôt
> par Jekyll, qui interprète les `{{…}}` de la documentation (`README.md`, `SPEC.md`,
> `docs/ADMINISTRATION.md`) comme du *Liquid* et **fait échouer la construction** — le site
> ne se publie pas. `.nojekyll` désactive Jekyll. (Autre voie : *Settings → Pages → Source :
> GitHub Actions*, modèle « Static HTML », qui ne passe pas par Jekyll.)

**La démonstration n'est pas indexée — volontairement.** Ses actes sont **fictifs** (mairie de
Valmont-sur-Loire) : une fiche lue dans un résultat de recherche se prendrait pour un acte réel. Le
bootstrap d'`index.html` pose donc `<meta name="robots" content="noindex, nofollow">` quand la page est
servie depuis **le domaine de la démonstration du projet** (`demo.scribae.eu`, la même adresse que le
`CNAME`), et depuis lui seul : une **instance auto-hébergée** — ou un fork sous son propre nom — reste
indexable, comme son recueil ouvert le suppose. Un `robots.txt` à la racine a été **écarté à dessein** :
il serait hérité par chaque fork, alors que le `robots.txt` appartient au déploiement qui le publie
(l'installation auto-hébergée publie le sien, avec ses actes et son plan — voir `docs/ADMINISTRATION.md`).

### Auto-hébergement

Rien n'attache l'application à ces deux hébergements de démonstration : elle ne dépend que de
deux services fournis par l'environnement d'exécution, et le déploiement de `server/web/` les
remplace par les siens — une base **IndexedDB** pour le stockage, et l'API REST du service
pour le reste. C'est le mode de **service** : plusieurs postes travaillent alors sur la même
base, partagée.

| Service d'exécution | Équivalent auto-hébergé |
|---|---|
| `root.kv` (stockage clé/valeur local) | `server/web/host.js` — une base **IndexedDB** du navigateur |
| `root.createServerSocket` (API du service) | appels `fetch` directs vers `/v1/…` (nginx → service Node) |

`server/web/index.html` est la coquille de cette édition (l'`index.html` d'origine ne sert
qu'à l'édition en ligne, comme `main.pjs`). `remote.js` choisit son transport : le canal de
l'environnement s'il existe, sinon HTTP si `window.__SCRIBA_SELF_HOSTED__` est posé par le
déploiement. Le mode de persistance par défaut y devient « serveur externe » sur la **même
origine**, et le jeton d'écriture est injecté au démarrage du conteneur (voir
`server/web/config.js.template`).

Installation, réseau, TLS : `server/README.md`. Sécurité, sauvegardes, exploitation,
migration depuis la démonstration : `docs/ADMINISTRATION.md`.

## Architecture

```
main.pjs                  $meta + les imports de la plateforme (stockage, canal du service, relais HTTP)
index.html                coquille : script serveur (LE SERVICE) + <link> + <div id="app"> + module
src/SPEC.md               spécification
src/docs/ADMINISTRATION.md  DOCUMENTATION D'ADMINISTRATION ET D'EXPLOITATION (auto-hébergement, sécurité, sauvegardes)
src/docs/API.md           RÉFÉRENCE DE L'API REST (engendrée par scripts/generer-api.mjs, lue par « Documentation technique »)
src/docs/VARIABLES.md     VARIABLES DE DÉPLOIEMENT (engendré par scripts/generer-variables.mjs)
src/docs/INDUSTRIALISATION.md  VÉRIFIER, TESTER, LIVRER (outillage, intégration continue, épreuves de parcours)
src/docs/REPRISE.md       KIT DE REPRISE : points d'entrée, « un seul point de vérité par règle », recettes de livraison, et ce qui n'est pas couvert
src/docs/AUDIT-BUGS-2026-09-22.md  AUDIT CIBLÉ : session, anti-CSRF, file d'attente, état de la base (constats corrigés et points ouverts)
src/docs/PERFORMANCE.md   PERFORMANCE MESURÉE : le gel des connexions simultanées, ce qui l'a corrigé, les scénarios et les chiffres avant/après
src/docs/GITHUB.md        PAGE D'ACCUEIL DU DÉPÔT (recopiée en README.md à la racine par l'export GitHub)
src/CHANGELOG.md          JOURNAL DES VERSIONS (la première entrée datée = la version en service)
src/TODO.md               chantiers ouverts
src/css/app.css           feuille de style : l'ENTRÉE — elle importe dix parties (app-base.css, app-atelier.css, …), dans l'ordre d'origine
src/css/app-*.css         les parties de la feuille, découpées par sujet (socle, atelier, guide, rédaction, signature, comptes, sombre, registre, recueil, outils) — voir docs/REPRISE.md
src/lib/
  util.js                 utilitaires (dates françaises, montants, téléchargements, copie, choix d'un fichier texte ou binaire…)
  version.js              VERSION DU LOGICIEL (source unique du numéro) + chemin du changelog
  logiciel.js             IDENTITÉ DU LOGICIEL : son nom, sa licence et l'adresse de sa documentation — la seule déclaration ; les pieds de page, la marque et la bannière de démarrage du service la lisent (module pur)
  expr.js                 langage d'expression sûr (parseur + évaluateur, sans eval)
  schema.js               types de nœuds/champs/règles + fabriques (dont `newTrame`, `publishable`, le nœud `division` et l'échelle des divisions `NIVEAUX_DEFAUT` / `ladderOf` / `numeroNiveau`, la nature de document `natureDe`, la disponibilité d'une trame `trameDisponible`)
  trame-format.js         format de fichier des trames : exemple documenté + lecture/normalisation à l'import
  doc-import.js           IMPORTER UN DOCUMENT COMME TRAME : lecture d'un .docx / .odt sans dépendance (archive ZIP + XML), blocs bruts, reconnaissance de la structure d'un acte (autorité, intitulé tokenisé, visas, considérants, formule d'édiction, articles, divisions, listes, tableaux, mention de recours, signature) et points à vérifier (module pur, sans DOM hors DOMParser)
  seed.js                 JEU DE DONNÉES INITIAL (remplaçable — aucune logique métier), et `seedConfigVierge()` : le référentiel NEUTRE d'une installation hors démonstration
  demo.js                 LE COMMUTATEUR DE DÉMONSTRATION : `demoActif()` (source unique de vérité, alimentée par le déploiement), `demoRegleParLeDeploiement()`, `referentielVierge()` et `registreVierge()`
  deploiement-config.js   RÉGLAGES DÉCLARATIFS DU .env : `setDeploiementConfig()` (ce que rend `GET /v1/config`), `appliquerOptions()` (les pose dans le référentiel au démarrage), `poseParLeDeploiement()` — le registre des variables vit côté service (`server/mysql/variables.mjs`)
  demo-actes.js           ACTES DE DÉMONSTRATION (rédigés et signés au premier démarrage)
  publications-locales.js PUBLICATIONS LOCALES : relit, à défaut de service, les enregistrements de publication gardés sur les actes (notice, versions par identifiant ELI, fiche complète) — c'est ce que le recueil public affiche quand le service se tait
  compile.js              contexte, interpolation {{…}}, règles, article par article, divisions (numérotation par échelon), écarts, ordre du document et renumérotation, visas et annexes (pour une annexe : ni autorité ni mention de publication au recueil, visas conservés)
  ordre.js                RÉORDONNANCEMENT DU DOCUMENT : l'ordre vit dans `values.__ordre` (un rang par conteneur), appliqué à la compilation — `deplacerVers`, `rangerCommeLaTrame`, `ordresModifies` (module pur) ; les rangs SYNTHÉTIQUES des ajouts (structure.js) y cohabitent avec ceux de la trame
  structure.js            STRUCTURE DU DOCUMENT : les blocs et éléments que la RÉDACTION retire (`values.__supprimes`) ou ajoute (`values.__ajouts`, rang synthétique, texte porté par l'ajout), avec leur intégration à l'ordre — `supprimer`, `retablir`, `ajouterA`, `ajoutPour`, `retirerAjoutPour`, `majAjout`, `slotsAjoutes` (module pur)
  numbering.js            NUMÉROTATION DES ACTES : séquence interne ou service externe (appel HTTP, jetons, lecture de la réponse, journalisation)
  sequence.js             LE NOYAU DE LA SÉQUENCE INTERNE, sans aucune importation : motif, remplissage, année, portée (globale / par entité / par type), compteurs, numéros annulés, relecture d'un numéro composé, `prochainNumeroLibre` (un numéro ne se donne pas deux fois) et `fixerSequence`
  chrono.js               LE CHRONO DE NUMÉROTATION : les lignes (actes, rangs libres, numéros annulés), les compteurs, les filtres, le tri et la déclaration des colonnes partagée par le tableau et les exports (module pur)
  xlsx.js                 ÉCRITURE D'UN CLASSEUR XLSX ET D'UN CSV, sans aucune dépendance (ZIP en magasin, chaînes partagées, BOM)
  redaction.js            adresses d'emplacements (slots), application des écarts (réécritures ET réglages de bloc : échelon, numérotation), repérage
  auto-tokens.js          les jetons AUTOMATIQUES (ce que l'application remplit seule : collectivité, signataire, date, numéro) — partagés par l'éditeur de trame et l'atelier de rédaction
  render.js               rendu DOM du document compilé (aperçu, impression, export HTML ; suivi des modifications ou mentions)
  export.js               Akoma Ntoso 3.0, Schematron, JSON-LD/ELI, Markdown, HTML, Word, impression
  pdfa.js                 EXPORT PDF/A (archivage) : metteur en page du fichier — marges, polices EMBARQUÉES, filets, encadrés, tableaux, listes, divisions, articles, mentions, signature, annexes, en-tête et pied de la charte — puis assemblage PDF/A (XMP, OutputIntents sRGB, langue, identifiant de fichier, métadonnées, ELI) ; pdf-lib et fontkit chargés à la demande
  paper.js                LE PAPIER DES DOCUMENTS : A4 (21 × 29,7 cm), marges, sauts de page
  styles.js               FEUILLES DE STYLE (charte graphique) : modèle, polices proposées (FONT_CHOICES), résolution (trame → entité → famille → générale), préréglages, marges du papier, CSS, compteurs de liste (@counter-style), côtés des encadrés, aperçu
  theme.js                APPARENCE (clair / sombre / automatique) : préférence locale, jetons du document, couleur de marque et emblème du référentiel lisibles (`brandLogoUrl`)
  akn.js                  LECTURE d'Akoma Ntoso 3.0 (import d'un acte publié, tolérant aux ns)
  amend.js                modification d'acte : plan, acte modificatif, version consolidée, mentions d'article (les divisions sont parcourues par flatNodes : articlesOf et buildConsolidated y descendent)
  abrogations.js          ABROGATION d'un acte ou de l'un de ses articles : vocabulaire de la clause, jetons, désignation d'une cible (nature lue à sa trame), composition de l'article d'abrogation, « abrogé par » et « est abrogé » (module pur)
  annexes.js              LES ANNEXES : le vocabulaire du lien (adoption d'un document par un autre), l'identification figée d'un acte, le visa d'adoption, la clause et le nœud de liste, et le drapeau RÈGLEMENT (`estReglement` / `estReglementActe` : une annexe normative, publiée à part au recueil à titre informatif — voir signature.js) — la modification « en suivi » passant, elle, par amend.js (module pur)
  annexe-docs.js          LES ANNEXES (suite) : la PARTIE ANNEXÉE du document — quels documents un acte annexe, leur document compilé et leur intitulé, pour que leur texte suive l'original signé de l'acte qui les adopte (module pur)
  amend-edit.js           édition en place : adresses stables des passages (rang dans l'ordre imprimé, divisions comprises), plan déduit de la saisie
  remote.js               CLIENT de l'API REST : connexion, appel, journal des échanges
  api-reference.js        LA DESCRIPTION DE L'API REST, une seule fois : les groupes, les opérations (méthode, chemin, rôle, corps, réponses, champs), les rôles, les codes d'erreur, l'export cURL et le sommaire des routes — ce qui alimente l'écran « API REST » ET `docs/API.md` (engendré)
  signature.js            cryptographie (ECDSA/SHA-256), original signé, prestataire simulé
  externe.js              CIRCUIT DE SIGNATURE EXTERNE (sans API) : réglage global et par trame (imposé / autorisé), résolution du circuit d'un acte, dossier de la version signée (statut, empreinte, certification de conformité du réviseur) et conditions de publication (module pur)
  eli.js                  identifiant ELI, opposabilité, réglages de publication (recueil, automatisme), JSON-LD, et la VERSION EN LIGNE — opposable pour un acte, **informative** pour un règlement (ni opposabilité ni original, mais l'acte qui l'adopte)
  recueil.js              RECUEIL PUBLIC et RECUEIL OUVERT : extraction du document publié (sans sa charte — `data-sheet`, en-tête et pied retirés —, la charte valant pour le papier), **FEUILLE DE STYLE WEB** (`CSS_DOCUMENT_WEB`, la MÊME pour tous les actes : deux entités aux chartes différentes se présentent à l'identique en ligne), mise en page web, thèmes des actes (famille de la trame) et thème sans matière, derniers actes publiés en vigueur, actes épinglés (bande « À la une »), recherche/facettes, adresses d'un acte (de navigation et de référence), représentations lisibles par machine (JSON, Markdown, texte, Akoma Ntoso) et fichiers du site (llms.txt, recueil.json, sitemap.xml, robots.txt)
  validation.js           CIRCUIT DE VALIDATION (le parapheur, fonction ordinaire) : circuits du référentiel, étapes à trois natures (vérification, visa, signature), décisions, empreinte du texte validé
  parcours.js             LE PARCOURS D'UN ACTE : les phases de son chemin dans leur ORDRE RÉEL (rédaction → parapheur → révision → signature → publication ; dans le circuit externe, certification de conformité après la signature), le titulaire de chacune, les étapes du circuit vues de l'intérieur, et la position de la révision (« après le parapheur, avant la signature ») — le fil que dessinent les écrans (module pur)
  chats-erreur.js         LES CHATS DES PAGES D'ERREUR : ré-exporte la règle du service (`server/mysql/chats-erreur.mjs` — quel code illustre quel code, l'adresse de l'image, le repli par classe) et ajoute la LECTURE DU RÉGLAGE (`chatsErreurActifs(config)` sur `config.publication.chatsErreur`, éteint par défaut) — l'application et le service ne peuvent donc pas diverger (module pur)
  informations.js         LES INFORMATIONS DU RECUEIL PUBLIC (les billets : actualités, avis, communications) : le modèle d'un billet, les DEUX ordres — celui du SITE (`informationsPubliees`/`informationsOrdonnees` : épinglés d'abord, brouillons exclus) et celui de l'ATELIER (`informationsDeLAtelier` : tous, brouillons compris, sinon le filtre « Brouillons » n'aurait rien à filtrer) —, le résumé, le temps de lecture, ce qu'il faut pour publier (`manquePourPublier`), les réglages de la rubrique, la PORTÉE du CSS de la collectivité et les variables que le recueil honore (module pur)
  reprise.js              LA REPRISE D'UN ACTE ANCIEN : le genre (un acte, ou un texte AUTONOME — un règlement intérieur, une charte), la DATE DE PUBLICATION D'ORIGINE (nécessairement antérieure au jour — `dateMaxReprise` est la veille), ce qui empêche de publier (`validerReprise`), le numéro d'origine et son ANNÉE qui datent l'identifiant ELI (`numeroPourEli`), la lecture du TEXTE LIBRE (articles, divisions, listes — `analyserTexteLibre`), le document d'aperçu, et la MENTION portée au bas de la page publiée (`MENTION_REPRISE` — module pur)
  bulletins.js            LE BULLETIN (ou Journal) DES ACTES, VU DU POSTE : le vocabulaire des CADENCES (nommées, plus « personnalisée » : toutes les N unités, ancrée), les réglages (`bulletinReglages`, titre, sous-titre, jour de parution, en-tête et pied des courriels), les adresses publiques (les mêmes que le service sert) et les libellés de période
  bulletins-formats.js    LES REPRÉSENTATIONS D'UN NUMÉRO côté poste : texte, Markdown, JSON et FLUX (RSS 2.0 et Atom 1.0) — MIROIR de ce que le service compose (`server/mysql/bulletins.mjs`) et justifié en tête de fichier : sur un déploiement auto-hébergé, c'est le SERVICE qui sert ces octets ; ici, la page les compose, faute de serveur
  bulletins-service.js    LE BULLETIN VU DU SERVICE : `chargerPublic` (l'état public — cadence, prochaine parution, numéros parus, ouverture de l'abonnement), `chargerTableau` (le tableau de bord), les gestes d'administration (`generer`, `envoyer`, `retirerAbonne`) et `chargerNumeros` (les numéros EN ENTIER, pour composer le flux). Un service absent n'est pas une erreur : le module le DIT (`etat.disponible === false`) et les écrans s'en passent
  demo-informations.js    LES BILLETS DE DÉMONSTRATION (trois publiés — dont un épinglé — et un brouillon, pour que les deux états se voient)
  atelier-acces.js        L'ACCÈS À L'ATELIER, VU DU NAVIGATEUR : l'état que le service rend (`/v1/atelier/acces`), ses clés de réglage (`CLE_IPS`/`CLE_MESSAGE`), `chargerAcces` (et la SIMULATION d'une adresse), `atelierRestreint`, `horsReseau`, `agentsAvecActesReserves` — un reflet, jamais une décision : c'est le service qui voit l'adresse (voir `server/mysql/atelier.mjs`)
  legalite.js             TRANSMISSION AU CONTRÔLE DE LÉGALITÉ par API (fonction expérimentale — voir `experimental.controleLegalite`) : API d'envoi, certificat de transmission (mention, référence, sceau), vérification
  execution.js            CARACTÈRE EXÉCUTOIRE : formalités requises, date d'exécutoire, délai de recours, recours introduit, alertes, constatations
  execution-documents.js  PIÈCES DE L'EXÉCUTION : état des formalités (tout acte), attestation de non-recours (acte définitif non contesté)
  historique-brouillons.js HISTORIQUE DES BROUILLONS : versions successives d'un acte, restauration
  search.js               INDEX ET RECHERCHE : index en mémoire (actes, trames, personnes, services…), requête normalisée
  collab.js               COLLABORATION : présence des postes (battements FUSIONNÉS — un seul en vol, un unique rattrapage si l'écran a changé), verrou souple de rédaction, journal d'audit, notifications
  store.js                AMORÇAGE + migrations additives ; passe par lib/db (aucun accès direct au stockage)
  db/
    index.js              façade de persistance : pilote actif, différences, miroir, file hors ligne, état
    contract.js           collections, enregistrements, diff/merge, comparaison JSON stable, limites
    local.js              pilote « local » : stockage du navigateur (IndexedDB)
    service.js            pilote « service » : contrat REST (transport socket de l'environnement, ou HTTP)
  users.js                COMPTES ET RÔLES : rôles, permissions, contrôle d'accès, comptes de démonstration
  scope.js                ORGANISATION : services, bureaux, périmètre d'un compte (qui voit quoi)
  delegations.js          QUALITÉS DU SIGNATAIRE (accord en genre) ET ARBRE DES DÉLÉGATIONS de signature
  organigramme.js         L'ORGANIGRAMME entités → services → bureaux : les formes d'entité (`ENTITY_KINDS`), l'entité neuve, la PERSONNALITÉ MORALE (`autonome`, `parentId` : une régie rattachée à la commune), le SIGNATAIRE PRINCIPAL, l'arbre, les entités hors arbre et les compteurs de l'écran (module pur)
  fonctions.js            CATALOGUE DES FONCTIONS DE SIGNATURE (rôles, délégations) et des personnes qui les tiennent
  signataires.js          LE SIGNATAIRE : qualité (attribuée par la désignation), rapprochement personne ↔ compte ↔ outil de signature, champ de compétence (chaîne de signature), file « Ma signature » (module pur)
  conseils.js             LES ASSEMBLÉES DÉLIBÉRANTES : les conseils du référentiel (conseil municipal, conseil d'administration) — entité de rattachement, formule d'autorité de la ligne d'en-tête, et la QUALITÉ QUI SIGNE (un rôle du référentiel, configurable conseil par conseil) ; résolution de l'assemblée d'un acte et qualification en genre du signataire (module pur)
  hosts.js                OÙ SONT LES SERVICES DE L'HÔTE (stockage, canal du service, relais HTTP sans CORS, moteur de langage intégré) — point unique
  assistant.js            LES DEUX ASSISTANTS (Plume, Publia) : réglages (allumé/éteint, nom et icône réglables, moteur interchangeable — intégré / API personnalisée / repli documentaire, flux SSE ou appel simple), préférence de poste (masqué pour soi), connaissances (le guide et ses liens de chapitre pour l'un, les actes publiés, leurs liens et l'acte consulté pour l'autre), composition de l'invite et repli documentaire (recherche dans le guide ou dans les actes publiés, sans réseau)
  auth.js                 MODE D'AUTHENTIFICATION : comptes de l'application / annuaire (OIDC) / comptes locaux (mot de passe) — modèle du référentiel, PRESAGE du déploiement, et autorité du service ; LA SECONDE PORTE (`annuaire`, `annuairePropose`, `annuaireFermePour`, `ANNUAIRE_CLES` : l'annuaire proposé À CÔTÉ de la porte ordinaire, et les réglages que le service publie)
  motdepasse.js           CLIENT DU SERVICE DES COMPTES : /v1/auth/… (connexion, session, mot de passe, état des comptes) + jeton anti-CSRF
  oidc.js                 CLIENT OIDC : PKCE, jeton d'identité (JWKS), revendications → compte, annuaire d'essai
  cle-service.js          CLÉ DU SERVICE (porteur) : la clé d'écriture n'est jamais inscrite dans le code — le déploiement la remet, ou un administrateur la saisit ; ce module n'est que le porteur en mémoire que les vues interrogent
  cles-service.js         PROVISIONNEMENT ET CLÉS DU SERVICE : /v1/auth/etat, /v1/auth/bootstrap, /v1/auth/cles (+ révocation) et /v1/journal — la clé est TIRÉE PAR LE POSTE (crypto.getRandomValues), le service n'en garde que l'empreinte SHA-256
  sanitize.js             ASSAINISSEMENT DU FRAGMENT PUBLIÉ : liste blanche de balises et d'attributs (retire `<script>`, `<iframe>`, les gestionnaires d'événements, les schémas `javascript:`/`vbscript:`/`data:text/html`) et contrôle des adresses (`adresseSure`) — appliqué à la version en ligne reçue du service avant toute insertion
src/pages/                ÉDITION STATIQUE (GitHub Pages)
  host.js                 fournit les deux services quand la page est servie en statique
src/server/               AUTO-HÉBERGEMENT : pile Docker complète
  README.md               guide d'installation (Docker, réseau, TLS, sauvegardes)
  docker-compose.yml      les QUATRE services : db (MariaDB) + db-init (le compte
                          applicatif au mot de passe du .env, PUIS le schéma) +
                          api (Node) + web (nginx) — aucun fichier de l'hôte
                          monté : les trois derniers sont CONSTRUITS
  docker-compose.fichier.yml  LA MÊME PILE SANS MARIADB : deux services (api + web) et un seul
                          dossier monté (`./data`), pour le rangement par fichiers
                          (`STOCKAGE=fichier`) — un fichier à part, car le compose principal
                          exige `DB_PASSWORD`/`DB_ROOT_PASSWORD` à l'interpolation
  nginx.conf              façade : application servie, /v1/ en proxy vers api (cuit dans l'image de web)
  Dockerfile              IMAGE AUTONOME : le service, la façade et le code en un conteneur
  env.example             modèle du .env du déploiement
  web/                    édition web de l'application (chargée hors édition en ligne)
    Dockerfile            la façade : nginx + nos réglages + la coquille + le code de l'application
    index.html            coquille (remplace l'index.html d'origine)
    host.js               hôtes d'exécution simulés : root.kv (IndexedDB) et transport HTTP
    config.js.template    adresse + jeton de l'API, remplis au démarrage du conteneur
    entrypoint.sh         prépare /srv/www au démarrage (entre dans l'image sous
                          /docker-entrypoint.d/40-scriba-web.sh)
  mysql/                  LE SERVICE (Node + mysql2, hors application cliente)
    server.mjs            API : /v1/db/… (données) et /v1/… (signature, publication) + porte /v1/auth/… (comptes)
    banniere.mjs          LA BANNIÈRE DE DÉMARRAGE : marque et nom dessinés en caractères d'imprimante, puis version, licence et adresse de la documentation — lue par server.mjs, composée par un module pur
    banniere.test.mjs     banc d'essai de la bannière : cadre fermé et de largeur constante, ASCII pur hors la mention, version jamais écrite en dur (npm test)
    logiciel-engendre.mjs MIROIR ENGENDRÉ de l'identité du logiciel (nom, version, licence, documentation) — `node scripts/generer-logiciel.mjs` : l'image du service ne contient que ce dossier, elle ne peut donc pas lire `src/lib/logiciel.js`. NE PAS MODIFIER À LA MAIN
    logiciel-engendre.test.mjs  épreuve du miroir : il doit dire exactement ce que disent `src/lib/version.js` et `src/lib/logiciel.js` (npm test)
    actes.mjs             domaine signature/publication (pur, sans dépendance à Node)
    atelier.mjs           ACCÈS À L'ATELIER : la liste d'adresses autorisées (déploiement puis référentiel), l'état rendu à l'application (`etat` : `actif`, `autorise`, `regle`, `erreurs`, `connue`, `source`), le corps du refus (403 `atelier_hors_reseau`) et la ligne du journal de démarrage — une liste DEMANDÉE mais illisible FERME l'atelier (module pur)
    atelier.test.mjs      banc d'essai de l'accès à l'atelier (npm test)
    ips.mjs               ADRESSES RÉSEAU : lire et écrire une adresse (IPv4, IPv6), un préfixe, un champ, une plage abrégée, une liste (commentaires compris), dire si une adresse est interne, et l'adresse de l'appelant (`adresseDeLEntete` : premier maillon de X-Forwarded-For, ou adresse de la prise) — module pur
    ips.test.mjs          banc d'essai des adresses réseau (npm test)
    comptes.mjs           domaine des comptes locaux : mot de passe scrypt, sessions, anti-CSRF (pur, crypto injectée)
    comptes.test.mjs      banc d'essai du domaine des comptes (npm test)
    magasin.mjs           LE MAGASIN — LE CONTRAT DE STOCKAGE DU SERVICE ET L'ALGORITHME COMMUN : le protocole est le MÊME pour les deux rangements (collections, révisions, conflits, journal), seule l'ÉCRITURE change — `synchroniser(t, {…})` vit donc ici, une fois, piloté par les primitives de la transaction `t` ; porte aussi `str`/`projections` (les colonnes indexées) (module pur)
    magasin-mysql.mjs     LE RANGEMENT MARIADB : l'adaptateur du magasin (import dynamique de `mysql2/promise` — le pilote est INJECTABLE pour les épreuves, pool, transaction SQL, schéma et migrations, `reconcilierCompte`) — c'est le rangement PAR DÉFAUT ; les écritures d'une collection passent par une file PAR COLLECTION, la ligne de collection est créée par `INSERT … ON DUPLICATE KEY UPDATE revision = revision` (verrou EXCLUSIF pris d'emblée), et une transaction heurtée (`ER_LOCK_DEADLOCK`, `ER_LOCK_WAIT_TIMEOUT`) est rejouée en entier
    magasin-fichier.mjs   LE RANGEMENT PAR FICHIERS (`STOCKAGE=fichier`) : tout dans un dossier (`DATA_DIR`, `./data` par défaut), EN CLAIR — état, collections, journal, courriels, secrets ; écriture atomique (temporaire + renommage) et SÉRIALISÉE par une file interne ; disque injecté (`io`) pour s'éprouver en mémoire ; mime les FORMES du magasin SQL (comme `createStoreMysql`) pour que le domaine ne voie aucune différence
    magasin-fichier.test.mjs  banc d'essai du rangement par fichiers, entièrement en mémoire — insert, conflit de révision, `force`, suppression, ordre, état, comptes, mots de passe et sessions, santé, écritures concurrentes (npm test)
    magasin-mysql.test.mjs  banc d'essai du rangement MySQL sur la base EN MÉMOIRE (`charge/faux-mysql.mjs`) — sérialisation par collection, collections distinctes en parallèle, reprise sur `ER_LOCK_DEADLOCK`, refus de rejouer une erreur étrangère, idiome SQL de prise de verrou exclusive (npm test)
    chats-erreur.mjs      LES CHATS DES PAGES D'ERREUR (http.cat), LA RÈGLE ÉCRITE UNE FOIS : le catalogue des codes réellement publiés, le repli par classe (`codeChat`), l'adresse (`urlChat`) et ce qu'une page doit dire (`chatPour` → code, url, alt, légende) — partagé par le service (`actes.mjs`) et le navigateur (`lib/chats-erreur.js`) ; l'option est éteinte par défaut (module pur)
    chats-erreur.test.mjs banc d'essai de la règle des chats d'erreur : bornes, repli par classe, adresses, légendes (npm test)
    state.mjs             état du service en base (table sb_etat)
    compte-base.mjs       LE COMPTE APPLICATIF DE LA BASE : les ordres SQL qui le (re)mettent au mot de passe du .env (module pur)
    compte-base.test.mjs  épreuves de l'échappement SQL et des ordres (npm test)
    variables.mjs         REGISTRE DES VARIABLES DE DÉPLOIEMENT : une seule déclaration — le wiki engendré (`docs/VARIABLES.md`), la validation du `.env` et le transport vers le navigateur en découlent (module pur)
    annuaire.mjs          L'ANNUAIRE DE LA COLLECTIVITÉ VU DU SERVICE : ce que le service PUBLIE de l'annuaire (liste blanche — aucun secret, c'est un client OIDC public), référentiel relu par lui et variables `SCRIBA_ANNUAIRE_*` par-dessus ; c'est ce qui permet à l'écran de connexion de savoir l'annuaire branché en mode « comptes locaux », où le référentiel n'est pas lisible (module pur)
    annuaire.test.mjs     épreuves de la publication de l'annuaire : liste blanche, précédence du `.env`, correspondance écartée si douteuse (npm test)
    annuaire-service.mjs  LE SERVICE COMME CLIENT OIDC (depuis 1.6.1p) : découverte du fournisseur, échange du code (vérificateur PKCE du navigateur), vérification du jeton d'identité, revendications → compte (règles de `src/lib/oidc.js` reprises À L'IDENTIQUE) — le réseau entre par `httpJson`, la crypto par `crypto`, l'horloge par `now` (module pur)
    annuaire-service.test.mjs  épreuves du client OIDC avec un fournisseur SIMULÉ : découverte (dont points de terminaison à la main), échange, JWKS, chaque contrôle du jeton refusé, rôles/visiteur, périmètre, qualités cumulables (npm test)
    jws.mjs               VÉRIFICATION DE LA SIGNATURE D'UN JETON D'IDENTITÉ (JWS) : RS/PS/ES, clés JWK du fournisseur — isolé pour être éprouvé avec de vraies clés et de vraies signatures
    jws.test.mjs          épreuves de la signature : vraies paires de clés, chaque algorithme annoncé, un octet changé, clé de mauvaise famille, `alg: none`/`HS256` refusés, membres d'usage du JWK (npm test)
    entetes.mjs           en-têtes de la façade (CORS, sécurité, cache)
    smtp.mjs              LE PROTOCOLE SMTP à l'état pur (aucune dépendance) : le réseau et la configuration lui sont injectés sous forme d'un transport — il s'éprouve donc seul
    courriel.mjs          COURRIEL, LA PART RÉSEAU : la socket (TCP ou TLS), la configuration SMTP, l'envoi et le journal des envois — le mot de passe SMTP ne sort jamais de ce module
    signature.mjs         CLIENT DU PRESTATAIRE DE SIGNATURE : provisionne le document, ajoute les signataires, démarre le circuit, relit le statut — la clé d'API ne quitte jamais ce module
    amorcage.mjs          amorçage du service (compte d'administration du `.env`, clés)
    schema.sql            tables sb_collection / sb_record / sb_journal / sb_etat + vues
    Dockerfile  README.md  env.example  package.json  package-lock.json
  charge/                 ÉTUDE DE CHARGE : postes simulés à tous les rôles + le public, et rapport
    README.md             comment s'en servir, ce qu'il mesure, ce qu'il ne mesure pas
    charge.mjs            LA COMMANDE (--url ou --sans-base, --profils, --duree, --montee, --pensee, --ecriture…)
    profils.mjs           LES SEPT PROFILS et leurs gestes, le tirage pondéré, le fond (présence, journal)
    moteur.mjs            fait vivre N postes en parallèle : montée, gestes, mesures
    statistiques.mjs      centiles, agrégat, alertes, rapport Markdown (pur, éprouvable)
    client.mjs            client HTTP : un pot à cookies par poste, session, anti-CSRF, une adresse par poste
    semence.mjs           la matière : trames, actes, informations, publications par les routes réelles
    faux-mysql.mjs        MySQL EN MÉMOIRE : exécute le schéma et les MIGRATIONS (`sb_migrations`), compte les ordres, simule une latence
    mysql-bouchon.mjs     présente cette base mémoire sous le contrat de `mysql2/promise`
    crochets.mjs          substitue `mysql2/promise` au chargement (mode --sans-base)
    charge.test.mjs       l'outil éprouvé lui-même (npm test)
src/wiki.js               CONTENU du guide d'utilisation (texte, étapes, captures) et, pour l'assistant, le sommaire et le lien de chaque chapitre
src/pdfa/                 RESSOURCES DE L'EXPORT PDF/A (voir src/pdfa/README.md) : les polices embarquées (Source Serif 4, Source Sans 3 — OFL) et le profil colorimétrique sRGB (CC0), chargés à la demande
src/ui/
  dom.js                  primitives DOM (h, boutons, champs, modale, info-bulle…)
  components.js           compositions (formulaires, dialogues, états vides)
  annotations.js          LES COMMENTAIRES D'UNE TRAME : la bande posée sous le bloc commenté (nature, auteur, date, passage cité, crayon et corbeille), la fenêtre d'écriture, la pastille « Commenter » qui suit une sélection de texte, le repère de marge et la mise en évidence d'un bloc — partagé par l'éditeur de trame (où l'on écrit) et la rédaction (où on les lit)
  signer-picker.js        CHOIX DU SIGNATAIRE en deux temps : la fonction, puis qui la tient (sélecteur partagé)
  assistant.js            LES DEUX PASTILLES D'ASSISTANCE (Plume dans l'atelier, Publia sur le recueil) : personnage, bulle d'invitation, panneau de conversation, réponse en flux, liens des réponses suivis dans l'application, questions de l'acte consulté, et le bloc « Assistants » du menu du compte (masquer pour soi)
  pdfa.js                 LE BOUTON DE L'EXPORT PDF/A : montre son attente, fabrique le fichier (lib/pdfa.js), le télécharge et le dit — posé à côté de « Imprimer / PDF » dans les écrans d'export, deux niveaux (PDF/A-2b, PDF/A-1b)
  dnd.js                  GLISSER-DÉPOSER : primitives partagées sur les POINTER EVENTS (glissable, deposable, conversion d'un point de dépôt en position de curseur) — souris, doigt et stylet d'un seul chemin
  brand.js                devise et marque du logiciel (SVG en ligne, currentColor) — le nom vient de lib/logiciel.js, dont il est réexporté
  chats-erreur.js         LES CHATS DES PAGES D'ERREUR, VUS DE L'ATELIER : `chatErreurEl(code)` rend la figure (image de http.cat + légende + source) si l'administration a allumé l'option (`config.publication.chatsErreur`), `null` sinon — les vues n'ont donc qu'à dire QUEL code illustre leur panne (module de rendu, voir lib/chats-erreur.js)
  notice.js               bandeaux de tête : « Démonstration » (si le déploiement l'allume) et « Référentiel vierge » (démonstration éteinte et référentiel vide), dans l'atelier comme sur le recueil public
  state.js                état global, routeur (sans toucher au hash), persistance différée, corbeille et mise à disposition d'une trame (gestes journalisés)
  markdown.js             rendu markdown → DOM (documentation technique)
  import-trame.js         OUVRIR LA TRAME PROPOSÉE PAR UN IMPORT DE DOCUMENT : l'adresse réservée `trame/__import__`, la lecture du fichier, la fenêtre des points à vérifier, et l'enregistrement ou l'abandon (rien n'est écrit avant)
  mise-a-disposition.js   METTRE UNE TRAME À DISPOSITION DES SERVICES — ET LA RETIRER : le bouton (carte de trame, bannière de l'éditeur) et les deux confirmations ; l'écriture, elle, est dans state.js
  parapheur-actions.js    GESTES DU PARAPHEUR partagés (soumettre, décider, reprendre, carte de décision)
  execution-actions.js    CONSTATATION D'UNE FORMALITÉ OU D'UN RECOURS, partagée (formulaire + journalisation + exécutoire)
  abrogations-apply.js    APPLICATION DES ABROGATIONS à leur entrée en vigueur (idempotent) : acte entier → « abrogé par », article → version consolidée à publier ; appelé au démarrage et après publication
  demo-publications.js    AMORÇAGE DU RECUEIL (démonstration) : provisionne le service (une démonstration n'a pas d'administrateur), dépose les billets, publie les actes que la fiction déclare publiés, relit et garde leur fiche complète, et porte au service la mise à la une des actes épinglés
  global-search.js        RECHERCHE GLOBALE (Ctrl+K ou « / ») : superposition, index, navigation clavier
  collab.js               TÉMOINS DE COLLABORATION dans l'en-tête : présence, cloche de notifications, panneaux
  theme.js                sélecteur d'apparence de la coquille (bouton d'en-tête + menu du compte)
  zoom.js                 ZOOM ET DÉPLACEMENT d'un contenu : l'organigramme, la feuille de la trame et le document en rédaction se traitent comme un canvas — molette ou boutons pour le cran, « Ajuster », déplacement au curseur (voir « Le canvas »)
  oidc.js                 annuaire : panneau de connexion, retour du fournisseur, fenêtre d'essai, onglet de l'Administration
  mot-de-passe.js         COMPTES LOCAUX (écrans) : formulaire de connexion (identifiant, mot de passe, œil), fenêtre « changer mon mot de passe », fenêtre d'administration d'un mot de passe (poser, engendrer un provisoire, retirer) et l'état des mots de passe pour la table des comptes
  comptes-liste.js        LA LISTE DES COMPTES telle qu'elle se présente à la connexion (groupes par profil, ligne de compte) — partagée par l'écran de connexion et le raccourci de démonstration
  app.js                  coquille, navigation, amorçage — et la ROUTE PAR DÉFAUT : le recueil public (page d'accueil), une vue inconnue y ramenant (`normaliserRoute`)
  views/trames.js  editor.js  rediger.js  wysiwyg.js  actes.js  modifier.js
  views/amend-editor.js   l'acte publié rendu éditable (l'équivalent de wysiwyg.js pour la modification)
  views/signature.js      SIGNATURE & PUBLICATION : onglet « Ma signature » (le signataire : son compte, le rapprochement, sa file), les DEUX circuits (électronique ; externe — document prêt à signer téléchargé, version signée PDF déposée, certification de conformité du réviseur) + publication ; api-console.js : OpenAPI & journal
  views/publications.js   registre de l'administration et consultation d'une publication (texte rendu dans la page)
  views/informations.js   INFORMATIONS DU RECUEIL (atelier) : liste des billets (recherche, filtre publié/brouillon) et billet ouvert — titre, date, auteur, résumé, texte en Markdown, aperçu au rendu réel, publier / dépublier / supprimer (permission `informations.gerer`)
  views/reprises.js       REPRISES D'ACTES ANCIENS (permission `actes.reprendre` — rédacteurs) : la liste des reprises (numéro, intitulé, genre, date d'origine, état), l'atelier d'une reprise (intitulé, genre acte/texte autonome, nature, numéro d'origine, date de publication d'origine, entité, thème, provenance, texte libre), l'APERÇU de la version en ligne tel que le recueil la montrera, la mention portée au bas de la page, la carte de l'ORIGINAL SIGNÉ (dépôt, empreinte SHA-256, ouverture, retrait) et la PUBLICATION D'UN SEUL GESTE — dépôt puis publication, sans circuit de signature
  views/bulletin.js       LE BULLETIN (atelier, permission `bulletin.gerer`) : l'état du service en six chiffres (cadence, période en cours, prochaine parution, numéros parus, abonnés, envois en file), les TROIS ADRESSES publiques (page, flux RSS, flux Atom — copiables), les gestes (« Composer les numéros échus », « Voir un aperçu du numéro en cours »), le tableau des numéros (période, actes, envoi, formats `.json .md .txt`, « Adresser aux abonnés »), la liste des abonnés (confirmés, en attente, retirés) et l'état du serveur de courriel
  views/hors-reseau.js    ÉCRAN « ATELIER HORS RÉSEAU » : l'accès à l'atelier est restreint, et l'adresse d'où l'on vient n'est pas dans la liste — l'écran le dit, rappelle que le recueil public reste ouvert, et donne le message réglé par la collectivité
  views/recueil-public.js RECUEIL PUBLIC : site sans compte, à la RACINE du site (accueil — bande des informations publiées, bande « À la une » des actes épinglés, carrousel des derniers actes publiés, thèmes par lesquels on parcourt les actes —, recherche et filtres dont le thème, liste par année, texte de l'acte), SOUS-PAGES (mentions légales, conditions de réutilisation, accessibilité, informations) avec leur adresse, métadonnées de page (titre, canonical, alternate, JSON-LD), FEUILLE DE STYLE DE LA COLLECTIVITÉ (posée avant le premier rendu, à la fin du corps) et représentations pour les moteurs et les agents
  views/acte-publie.js    RENDU PARTAGÉ d'un acte publié : notice, texte intégré, pièces, signature, versions, adresses du recueil ouvert
  views/parapheur.js      PARAPHEUR : files d'attente du circuit de validation, décisions, reprise
  views/execution.js      EXÉCUTION & DÉLAIS : échéancier des formalités, recours (délai ouvert ou introduit), actes définitifs, pièces du dossier
  views/corbeille.js      CORBEILLE : actes et trames supprimés (restauration, suppression définitive)
  views/delegations.js    ORGANIGRAMME DES DÉLÉGATIONS : l'arbre des chaînes de signature (organigramme ou liste), et la fiche d'un acteur — pouvoir, étendue, décision, dates, signature obtenue. Visible par tous, modifiable par les seuls administrateurs et éditeurs
  views/organigramme.js   ORGANIGRAMME DES ENTITÉS, DES SERVICES ET DES BUREAUX : la toile de l'écran des délégations, réemployée, mais pour la structure au nom de laquelle les actes sont pris — arbre ou liste, fiche d'une entité (forme, code, personnalité morale, rattachement, signataire principal), d'un service (bureaux) ou d'un bureau
  views/chrono.js         CHRONO DE NUMÉROTATION : compteurs, filtres, tableau triable (rangs libres et numéros annulés compris), export CSV / XLSX, passage à l'année suivante et annulation d'un rang
  views/api-reference.js  API REST : l'index des routes et la fiche de chacune, plus le PANNEAU DE COMMANDE (chemin, corps, jeton, envoi réel, réponse et durée, export cURL) et le mémento des rôles et des codes d'erreur
  views/referentiel.js  aide.js  connexion.js  comptes.js  docs.js
  views/comptes.js        COMPTES ET RÔLES : liste des comptes, création/modification (profil, périmètre, « Personne du référentiel — qui signe », compétence de réviseur, signature et rapprochement), matrice des droits (19 permissions)
  views/sans-acces.js     ÉCRAN « PAS D'ACCÈS » : compte authentifié sans rôle d'application (visiteur) — explique, donne le contact du service et renvoie vers l'espace public
  views/styles.js         feuilles de style : liste, schéma des réglages (GROUPS), éditeur direct WYSIWYG (REGIONS), champ « côtés d'encadré », aperçu d'un acte type
src/audit/                CADRE ET LIVRABLES D'AUDIT (voir src/audit/README.md) : le prompt d'audit, le registre cumulatif des non-conformités, et les rapports
  PROMPT-AUDIT-SCRIBAE.md le cadre : mission, périmètre, normes, les quatre auditeurs, méthode, cotation, contrat de sortie
  REGISTRE-NON-CONFORMITES.md  registre cumulatif (identifiants stables, statuts : Ouverte / En cours / Levée / Régression / Acceptée / Obsolète)
  rapports/               les rapports datés, un par campagne
  README.md               mode d'emploi du cadre
src/tests/                TESTS QUI S'EXÉCUTENT SANS NAVIGATEUR — dans le dépôt livré : `tests/` (voir src/tests/README.md)
  README.md               pourquoi ces fichiers sont écrits pour la disposition LIVRÉE (le code y est `../src/…`), et ce que tient chacun
  purs.test.mjs           tests des modules purs : expressions, assainissement, numérotation, version — et, depuis la 1.6.1p, le contrat des champs que le client lit du service, ainsi que la règle des imports jamais employés (les modules exigeant un navigateur font SAUTER leurs tests au lieu de faire tomber la suite)
  industrialisation.test.mjs  L'OUTILLAGE éprouvé lui-même : lance le contrôle de style tel qu'il est livré, sur l'arborescence livrée, exige le code de sortie 0 (ordinaire et strict) et vérifie que le parcours a bien vu tout le code — une faute de chemin ne se voit pas dans le code, elle se voit à l'exécution (il se saute là où aucun processus enfant n'est possible)
  publications-locales.test.mjs  tests du repli local du recueil public : seuls les actes publiés entrent au recueil, les versions d'un même ELI sont rangées (la plus récente porte `latest`), un acte réservé reste caché, et les pièces se lisent aussi bien dans `formats` qu'à plat
  conformite-service.mjs  LE JEU D'APPELS COMMUN aux deux services (démonstration et auto-hébergé) — le contrat, pas une épreuve ; conformite-service.test.mjs l'exécute contre la démonstration et le compare à une installation réelle (`SCRIBA_CONFORMITE_URL`)
  parcours.mjs            LES PARCOURS joués dans le NAVIGATEUR, contre l'application vivante (`lancerParcours()`) — voir docs/INDUSTRIALISATION.md § 2
  parcours.test.mjs  abrogation-annexes.test.mjs  amorcage-demo.test.mjs  qualification-signature.test.mjs  original-signe.test.mjs  pilote-persistance.test.mjs  reprise.test.mjs
src/scripts/              L'OUTILLAGE — dans le dépôt livré : `scripts/`
  verifier-syntaxe.mjs    `npm run syntaxe` : `node --check` sur tout le JavaScript du dépôt, sans aucune dépendance ; parcourt le dossier qui porte l'outillage (la racine du dépôt, ou tout l'arbre dans l'atelier)
  verifier-style.mjs      `npm run lint` (avertissements tolérés) et `npm run style` (`--strict` : ils font échouer) : analyse sans dépendance — REFUSE `debugger` hors outillage, SIGNALE `var` et `console.log` dans le code client, ET les imports jamais employés (partout, via `analyse-imports.mjs`) ; les exemptions sont écrites relativement à la RACINE DU CODE, ce qui les rend justes dans les deux dispositions
  analyse-imports.mjs     MODULE PUR de la règle précédente : rend les noms importés que le reste du fichier n'emploie jamais, avec le numéro de ligne — éprouvé dans `tests/purs.test.mjs`
  racine-code.mjs         OÙ VIT LE CODE (`RACINE_CODE`, `RACINE_OUTILLAGE`) : le dossier qui porte `lib/version.js` — CONSTATÉ, jamais supposé (il est `src/` dans le dépôt, et la racine de l'outillage dans l'atelier)
  generer-variables.mjs   engendre `src/docs/VARIABLES.md` depuis le registre des variables (`src/server/mysql/variables.mjs`)
  generer-api.mjs         engendre `src/docs/API.md` depuis la description de l'API (`src/lib/api-reference.js`) — le document et l'écran « API REST » ne peuvent donc pas diverger
  generer-logiciel.mjs    engendre `src/server/mysql/logiciel-engendre.mjs` depuis `src/lib/version.js` et `src/lib/logiciel.js` : l'image du service, qui ne contient que son dossier, peut ainsi annoncer la version RÉELLE dans sa bannière de démarrage
src/compose-exemple/      EXEMPLE DE PREMIER DÉPLOIEMENT — dans le dépôt livré : `compose-exemple/` : MariaDB et l'image publiée `aplds/scribae`, deux services, rien à construire (docker-compose.yml, env.example, README.md)
src/github/               SOURCES DES FICHIERS DE RACINE DU DÉPÔT (l'export les recopie, ils ne restent pas sous src/) :
  ci.yml                  → `<racine>/.github/workflows/ci.yml` : syntaxe, style (strict) et épreuves, puis le service auto-hébergé
  gitignore               → `<racine>/.gitignore` : dépendances, secrets de déploiement (`.env*`) et dossier de données `data/` — voir la section « Exporter le dépôt GitHub »
src/AGENTS.md             → `<racine>/AGENTS.md` : ce qu'un agent (Claude Code, Mistral Vibe…) doit savoir AVANT de toucher au dépôt
src/CLAUDE.md             → `<racine>/CLAUDE.md` : le pointeur de Claude Code vers `AGENTS.md`
src/package.json          MANIFESTE DU DÉPÔT (l'export le recopie à la racine) : `npm run lint`, `npm run style`, `npm test`, `npm run verifier`
src/LICENSE.md            LICENCE, ARBITRÉE : logiciel sous GPL-3.0 (le fichier `LICENSE` vit à la racine du dépôt), réutilisation des actes sous Licence Ouverte 2.0, position sur le code produit par l'IA et table des dépendances
```

`views/wysiwyg.js` est le moteur du document éditable : il transforme le texte d'un bloc
(jetons `{{…}}` compris) en zones éditables + pastilles cliquables, décide ce qui est
« modifié par rapport à la trame », et ouvre la bulle de saisie du bon type de champ. C'est lui
aussi qui **arme le déplacement des blocs** : chaque bloc composable — ceux du corps, ceux d'une
division **et ceux d'un article** — est enveloppé d'un `.mv` (poignée ⠿, deux flèches ↑ ↓, « +
Ajouter après », corbeille, « Options »), et `armerPrise()` rend le **numéro** de l'article ou de
la division glissable à son tour — les blocs fixes (`FIXES` : intitulé, auteur, liste des annexes)
en sont exclus. Il accepte aussi le **dépôt d'une variable** dans ses zones éditables
(`insererJeton`), affiche les outils de chaque **élément de liste** (un visa, un considérant :
« + » et corbeille au survol) et le bouton qui ferme chaque liste (« Ajouter un visa »). Le clic
sur un bloc le **désigne** (`rx.selectBlock`) sans redessiner la page.
`views/rediger.js` l'orchestre : en-tête (entité, badges, Enregistrer), panneau
de droite (bibliothèque de variables, onglets « Bloc », « À compléter », « Consignes »,
« Abrogations », « Contrôle & écarts »), enregistrement de l'acte (`values`, `overrides`,
`ecarts`), et la **suite du parcours** — un **parcours** en tête de page (Rédiger → Soumettre au
circuit → Révision → Signer → Publier, l'étape courante marquée) et, à la suite du document, le
**geste du moment en bouton principal** : « Soumettre au circuit », ou « Aller à la signature »
quand l'acte est validé et que l'on peut signer. L'**export** n'est plus présenté comme
l'aboutissement : il reste disponible, discret, avec la phrase qui dit ce qu'il est (« ce n'est pas
la fin du parcours »). C'est lui qui porte les gestes de **structure** : il reçoit les demandes du document
(`rx.supprimer`, `rx.ajouterElement`, `rx.menuAjout`, `rx.onCommit`) et écrit dans
`src/lib/structure.js`.
`views/amend-editor.js` joue le même rôle pour la modification : il rend le **document
publié** éditable (passages `contenteditable` adressés par `amend-edit.js`, outils
d'article, articles insérés) et remonte chaque geste à `views/modifier.js` par
`session.action(...)`. Les **divisions** y sont rendues et parcourues : les articles d'un Titre
ou d'un Chapitre s'éditent comme ceux du corps (à ceci près que l'**intitulé d'une division** est
lu, non réécrit, par une modification).

`views/docs.js` est la **documentation technique**, **réservée aux administrateurs**
(permission `docs.voir`) : son entrée de menu, le renvoi du menu du compte et l'encart en bas
du guide n'apparaissent que pour eux. C'est de l'exploitation, de l'installation et de la
sécurité — pas de la rédaction d'actes. Elle lit les documents du dépôt — `CHANGELOG.md`,
`docs/ADMINISTRATION.md`, `server/README.md`, `SPEC.md`, `README.md`, `TODO.md` — et les
affiche dans l'application
(`ui/markdown.js` les rend en DOM : titres, listes, tableaux, blocs de code), avec sommaire,
impression et téléchargement. Les documents ne sont pas recopiés dans le code : c'est le
fichier qui fait foi, et il est lu tel quel.

### L'éditeur de trame : glisser-déposer, jamais « liste déroulante »

**Règle de conception, non négociable.** Le public visé est un agent de bureau, souvent peu à
l'aise avec l'informatique. Tout geste de l'éditeur de trame doit se comprendre **sans mode
d'emploi** et sans vocabulaire technique. Concrètement : on **montre** au lieu de **nommer**, on
**glisse** au lieu de **choisir dans une liste**, et tout réglage fréquent est une **carte que
l'on clique**, pas un menu à dérouler. Un futur passage sur ce fichier ne doit pas revenir en
arrière sans une bonne raison.

Ce qui existe :

- **La réserve** (colonne de gauche, sous le plan : `paletteEl`) est le point de départ de tous
  les glissers, en trois groupes — *Vos champs*, *Rempli automatiquement*, *Ajouter un bloc*.
  Chaque élément est une **puce** (`puce()`), à la fois glissable et cliquable.
- **Trois gestes de glisser** : glisser un *champ* dans le texte d'un bloc (la pastille
  s'insère **exactement là où on la lâche**) ; glisser un *bloc neuf* depuis la réserve ; glisser
  un *bloc existant* (depuis le plan ou le document) pour le ranger — un trait bleu montre
  l'endroit, avant ou après la cible. Le bloc se saisit **tout entier** — poignée ⠿, intitulé,
  marges : il n'y a pas de poignée minuscule à viser. Un appui **dans le texte** d'un bloc, lui,
  y place le curseur (le texte reste sélectionnable), et un appui sur un bouton de la barre
  d'outils fait ce que dit ce bouton.
- **Le geste de repli**, pour qui ne maîtrise pas le glisser : **cliquer** la puce l'« arme »,
  puis **cliquer** dans le texte. Un bandeau (`.editor__arme`) rappelle où l'on en est, et
  « Annuler » interrompt. Le clic vaut le glisser : les deux chemins mènent au même résultat et
  sont documentés ensemble dans le guide.
- **Le type d'un champ se choisit sur des cartes** (`typeCards`) : douze cartes, chacune avec un
  dessin, un libellé d'usage (« Une date », « Un montant ») et un exemple. Jamais de liste
  déroulante pour cela.
- **Les questions du formulaire** (onglet *Questions*) sont des cartes **repliables**
  (`<details class="fcard">`) : repliées, elles tiennent en une ligne (nom, type) et le
  formulaire entier se lit d'un coup d'œil ; dépliées, elles livrent leurs réglages. L'état
  ouvert/fermé vit dans `ed.champsOuverts` (un `Set` d'identifiants) — **pas** dans le DOM,
  parce que chaque réglage redessine l'inspecteur : sans cela la carte se refermerait au moment
  même où l'on clique un type.
- **Il ne reste de liste déroulante que pour les listes longues** — famille, type d'acte,
  feuille de style, circuit, référence juridique, mention —, qu'on ne peut pas présenter
  autrement. Créer une trame ne demande d'en ouvrir aucune.

**`src/ui/dnd.js`** porte les primitives (`glissable`, `deposable`, `moitie`, `rangeDans`,
`insererAuRange`). Trois choses apprises à la dure, à ne pas réapprendre :

1. **Le glisser-déposer HTML5 a été abandonné** — il ne fonctionne pas au doigt, et le navigateur
   l'interrompt dès que la source quitte le document (ce qui arrive ici à chaque re-rendu). Le
   moteur s'appuie sur les **pointer events** : souris, doigt et stylet d'un seul chemin, et
   éprouvable par des événements synthétiques. Il ne dit pas non plus où l'on lâche, alors qu'un
   `elementFromPoint` le dit ;
2. **Le clic reste un clic, et le texte reste sélectionnable.** Rien n'est saisi avant quelques
   pixels de mouvement ; et un appui DANS une zone éditable ne déplace pas le bloc — c'est
   pourquoi le bloc entier peut être une prise sans que l'on perde la sélection à la souris. Une
   prise déclarée `auDoigt` (les poignées ⠿) reçoit `touch-action: none` : ailleurs, le doigt
   continue de faire défiler le document ;
3. **`auNiveauEnfant()`** ramène le point de dépôt au niveau des enfants **directs** de la zone.
   Sans lui, viser une pastille existante place le curseur *dans* la pastille : la nouvelle s'y
   imbrique et la lecture du bloc — qui lit le jeton porté par chaque pastille, sans descendre
   dans ses enfants — ne la voit jamais. Le champ paraît alors inséré à l'écran et absent du
   texte enregistré.

Les onglets de l'inspecteur s'appellent **« Ce bloc », « Commentaires », « Questions », « Contrôles »,
« Trame »** (les identifiants : `bloc`, `commentaires`, `champs`, `regles`, `trame`). Le **guide les
nomme de la même façon** (`src/wiki.js`, chapitre *Préparer et faire évoluer une trame*) :
renommer un onglet oblige à corriger le guide dans le même mouvement, sinon l'aide désigne un
onglet qui n'existe plus.

### Le canvas : zoomer et déplacer ce qui ne tient pas

Trois écrans montrent un contenu plus large que leur colonne — l'**organigramme des
délégations** (un arbre large), la **feuille de la trame** et le **document en cours de
rédaction** (une page A4). Plutôt que d'imposer un défilement horizontal, ils sont traités comme
un **canvas** : une barre flottante (`.zoom__bar`) règle le cran — `−`, pourcentage, `+`,
« Ajuster » — et le fond se saisit au curseur pour se déplacer.

Tout est dans **`src/ui/zoom.js`** (`cadreZoom`), et repose sur une idée simple : le contenu est
posé dans un **plateau** dont la taille en pixels vaut `taille naturelle × cran`, le contenu
lui-même étant **hors flux** et réduit par `transform: scale()`. C'est ce plateau qui RÉSERVE la
place du contenu réduit : les barres de défilement et le défilement tactile du navigateur restent
donc normaux, et rien n'est jamais rogné. Poser le `transform` sur un élément en flux n'aurait
réservé aucune place — un grand vide, ou un débordement sans barre de défilement.

Deux modes, pour deux gestes :

- **`canvas`** (l'organigramme) : la molette règle le cran, on saisit l'arbre n'importe où pour le
  déplacer (un appui sans mouvement reste un clic : la fiche s'ouvre), et le cadre est une fenêtre
  de hauteur bornée. L'arbre s'ouvre à **100 %** — le réduire pour le faire tenir entier rendrait
  ses noms illisibles —, et « Ajuster » en donne la vue d'ensemble ;
- **`feuille`** (le document, la trame) : seul **Ctrl + molette** zoome (la molette nue continue de
  faire défiler la page, comme partout ; le pincement d'un pavé tactile arrive sous cette même
  forme), et la feuille s'ajuste d'elle-même à la largeur disponible au premier affichage. On ne
  saisit que le fond ou la marge : le texte reste sélectionnable et un bouton reste un bouton.

Deux pièges sont traités dans le module, et méritent d'y rester : la largeur naturelle est
**mesurée** en effaçant le temps de la mesure la taille du plateau ET la largeur du contenu (sans
quoi une feuille **fluide** — `width: 100%`, le cas des écrans étroits — se mesurerait d'après le
plateau, qui se règle lui-même d'après la mesure, et fondrait à chaque dessin) ; puis cette largeur
est **figée en pixels** sur le contenu, que `ResizeObserver` surveille pour que le plateau suive un
document qui grandit (un article ajouté, une division ouverte). Le cran et le défilement sont rangés
dans `state.ui.zooms[cle]` : un écran se redessine souvent, et le cran choisi ne s'y perd pas.

L'éditeur de trame occupe par ailleurs **toute la fenêtre** (`.app--plein`, posé sur la coquille
quand la route est `trame`) : ses volets défilent sur place au lieu d'allonger la page — c'est aussi
ce qui donne au canvas de la feuille une vraie fenêtre à déplacer. Sans cette borne, la coquille
(`min-height: 100vh`) s'allongeait avec le contenu.

### Les commentaires : commenter ce qu'on voit, et ne pas pouvoir les manquer

**Autre règle de conception, non négociable** (elle vient d'un reproche d'usage : « le système de
commentaire n'est pas facile d'utilisation », et « les commentaires ne sont pas visibles par les
éditeurs »). Un commentaire de trame obéit à deux exigences, tenues par `src/ui/annotations.js` :

1. **On commente ce qu'on voit.** Trois chemins, tous partant de la page : le bouton « commenter »
   de la barre d'outils d'un bloc (l'article, le paragraphe que l'on regarde) ; la **sélection de
   texte** dans le document, qui fait apparaître une pastille « Commenter » **citant le passage**
   (`note.quote`) ; l'onglet « Commentaires », qui agit sur le bloc sélectionné.
2. **Ils se voient dans la page.** La bande des commentaires est rendue **sous le bloc visé**
   (`annotationStrip`), en lecture seule à la rédaction et éditable dans l'atelier de trame ; un
   **repère de marge** numéroté (`blk__annot-flag`) marque le bloc ; l'en-tête de l'éditeur annonce
   le compte et ouvre la liste ; l'aperçu compilé les reprend en fin de document (`showNotes`).
   À la **rédaction**, la même bande porte les consignes de la trame sous le passage concerné
   (`attacherConsignes`, dans `views/wysiwyg.js`), avec l'onglet « Consignes » et un compteur
   cliquable dans l'en-tête de l'acte.

Le passage cité suit le commentaire partout : bande, inspecteur, Akoma Ntoso (`<p data-quote>`,
relu par `akn.js`), Markdown et rapport de conformité.

### Le guide d'utilisation (src/wiki.js + src/ui/views/aide.js)

Le public visé n'est pas technique : **tout le texte du guide vit dans `src/wiki.js`**, sous
forme de chapitres et de blocs (`p`, `steps`, `note`, `terms`, `faq`, `table`, `shot`,
`svg`, `colors`, `contact`). On peut donc corriger une explication sans toucher au code.
Règles d'écriture : voir l'en-tête de `src/wiki.js` et la section 6 de `SPEC.md`.

Les captures (`SHOTS`) sont des images réelles de l'application, déposées par
l'hébergement de fichiers. Chaque repère porte `x`, `y` (centre) et `w`, `h` (taille), en
pourcentage de l'image : les positions sont **mesurées sur le DOM** au moment de la
capture (`getBoundingClientRect` de l'élément visé, relativement au cadre capturé), jamais
estimées à l'œil. Recette pour refaire une capture :

```js
// dans la console de l'aperçu, après avoir mis l'application dans l'état voulu
const { default: h2c } = await import("https://esm.sh/html2canvas@1.4.1?bundle");
const root = document.querySelector(".app-main");           // cadre capturé
const rect = (sel) => {                                     // repère en %
  const r = root.getBoundingClientRect(), e = document.querySelector(sel).getBoundingClientRect();
  return { x: (e.left + e.width / 2 - r.left) / r.width * 100, y: (e.top + e.height / 2 - r.top) / r.height * 100,
           w: e.width / r.width * 100, h: e.height / r.height * 100 };
};
(await h2c(root, { scale: 1, backgroundColor: "#fff" })).toDataURL("image/png"); // → téléverser, puis reporter l'URL et rect(...) dans SHOTS
```

Deux pièges, déjà rencontrés :

- **Le cadre capturé est `#app`** (et `document.body` pour une fenêtre modale, qui vit
  hors de `#app` dans `.fr-modal-overlay`). Les repères se calculent alors relativement à
  ce même élément.
- **Un `<iframe srcdoc>` n'est pas rendu** par html2canvas (il apparaît blanc). Pour la
  capture de la consultation publique, le document est d'abord rendu à part
  (`h2c(iframe.contentDocument.documentElement, …)`), puis l'iframe est **remplacée
  temporairement** par une `<img>` de même boîte avant la capture du cadre.
- **html2canvas, pas snapdom.** L'aide `snapshot.js` (qui s'appuie sur snapdom) rend mal les
  conteneurs *flex* : dans une capture d'en-tête, elle replie `.app-header__tools` sur une
  deuxième ligne et laisse la droite vide. Pour toute image contenant l'en-tête, utiliser
  `html2canvas` — c'est ce qui a produit les images du guide (`scale: 2` sur `#app`, à
  **1440×900**, soit 2880 px de large).
- **Le recadrage de l'en-tête bat la reprise d'état.** Quand seule l'identité change
  (nom, marque, ou la pastille de compte affichée à droite), il est inutile de refaire les
  huit mises en situation : la hauteur de l'en-tête (58 px) et tout ce qui est en dessous sont
  inchangés, donc les repères restent valides. On capture **une** bande d'en-tête en 2880×116
  (`scale: 2`, en-tête à `y 0..115`) et on la recopie en haut de chaque ancienne image (les
  pixels sous `y = 116` sont identiques — vérifié par comparaison ligne à ligne). C'est ainsi
  que les captures du guide ont été mises à jour pour montrer la **pastille de compte**
  (« Yann DUBOIS / Administrateur »). Deux exceptions : l'image de la fenêtre d'export est
  assombrie par le voile de la modale (recopier la bande à 50 % de noir), et celle du chapitre
  « messages » est un recadrage du panneau (pas d'en-tête du tout).

Ces captures sont aussi la raison pour laquelle le logo de la marque est une **data URL**
embarquée dans `seed.js` : les bibliothèques de capture recopient le document et n'y
résolvent pas un chemin relatif (`src/...`).

Le guide s'imprime (chapitre seul ou complet) via un onglet dédié, et
`window.__guidePrintableHtml(scope)` renvoie le document HTML autonome (CSS inliné, images
distantes) — c'est ce qui sert à produire le fichier à diffuser.

### Principes

- **Structure-agnostique** : aucune donnée d'une organisation réelle n'est dans la logique.
  Entités, personnes, rôles, références juridiques, mentions, numérotation, vocabulaire,
  couleurs et polices vivent dans le référentiel (éditable, exportable). `seed.js` n'est
  qu'un point de départ : le bouton *Administration › Données › Vider* le supprime.
  Le jeu livré est **fictif** : la mairie de *Valmont-sur-Loire* (voir plus bas).
- **Le texte porte des jetons** : `{{champ}}`, filtres `|date-long`, `|money`, `|upper`…
  Les expressions complètes sont acceptées (`{{dateEffet ? "le " + dateEffet : "…"}}`).
- **Les règles sont exécutables** : `blocking` bloque l'export, `warning` avertit,
  `inclusion` (ou `when` sur un nœud) conditionne la présence d'une clause. Le même
  langage sert aux conditions d'affichage et à la génération Schematron.
- **Références contextuelles** : un visa peut demander « la référence de telle nature
  pour l'entité signataire » — la bonne référence est sélectionnée automatiquement
  (ex. l'arrêté de délégation de signature de l'entité signataire).
- **Les commentaires des administrateurs ne disparaissent plus** : ils sont stockés dans le modèle,
  visibles dans l'inspecteur, exportés dans `meta/notes` d'Akoma Ntoso et dans l'annexe
  de préparation du HTML. (C'est la différence centrale avec un commentaire Word.)
- **UI sobre inspirée du DSFR** (tokens, composants, focus, rayon 4 px) sans Marianne,
  sans police propriétaire : couleurs et polices viennent de `brand`.

## Conventions de code

- Modules ES natifs, **aucune étape de build**. Tout est chargé depuis `src/`.
- `h(tag, attrs, ...children)` pour construire le DOM ; `id`s suffixés par leur type
  (`Btn`, `El`, `Ctn`, `Input`).
- `h()` gère `on:{}, dataset:{}, style:{}`, `text`, `html`, et tout attribut `onXxx`
  dont la valeur est une **fonction** (`onClick`, `onChange`, `onInput` → vrai
  écouteur). Les valeurs `null/false` sont ignorées (pratique pour les conditions).
- Les vues exportent `renderX(root, params)`. Un re-rendu local passe par
  `redrawView()` (`state.js`) : **différé d'une micro-tâche et coalescé**, pour qu'aucun
  gestionnaire `blur` ne reconstruise le DOM en pleine mutation. La persistance passe
  toujours par `touch("config"|"trames"|"actes")`, avec `{ rerender: false }` quand un
  `redrawView()` suit (sinon on paie deux rendus pour un seul geste).
- **Un redessin ne coûte jamais son curseur à l'agent** : la coquille (`ui/app.js`,
  `renderRoot`) et la vue (`drawView`) passent par `avecCurseur()` (`ui/focus.js`), qui
  reprend le champ, la sélection et le défilement après coup — sauf changement d'écran,
  où la clé de route a changé et où rien n'est repris.
  La **frappe** aussi : `textField` (`ui/components.js`) enveloppe sa saisie dans
  `avecCurseur()`, parce qu'un formulaire peut se redessiner à chaque lettre — l'en-tête de
  la fiche « Nouvelle entité » suit le nom qu'on écrit.
- **L'état de la persistance ne refait pas l'écran** : `db.onStatus` ne remplace que la
  pastille de l'en-tête (`rafraichirPastilleBase`, `ui/app.js`). Un écran qui l'affiche en
  clair s'y abonne lui-même (voir `views/referentiel.js`).
- **Un verdict d'écran survit au redessin** : ce qui vient d'être mesuré — le résultat d'un
  essai de connexion, par exemple — est rangé dans `state.ui` et rendu par une fonction
  pure (`renduEssai`), pour que le redessin provoqué par l'état qu'il vient de changer ne
  l'efface pas. Un verdict qui s'efface tout seul ne sert à rien.
- **Le service a TROIS fabriques de réponse d'erreur**, et elles n'ont pas la même signature :
  `err(message, options)` dans `src/server/mysql/server.mjs`, `err(code, message)` dans
  `comptes.mjs`, `err(statut, message)` dans `actes.mjs`. Les confondre ne casse pas le service :
  ça envoie la phrase dans le vide et ne laisse que le code à l'écran (c'est ainsi que
  « csrf_invalide » s'affichait seul, cf. CHANGELOG 1.3.2m). Vérifier l'ordre des arguments au
  moment d'écrire, et lire le `.erreur` du corps pour savoir ce que l'agent verra.
- Les styles de capture (mise en image de la page) supposent le CSS **inliné** : `app.js`
  recopie la feuille de style dans un `<style>` au démarrage.

## Repères de vérification

```js
// compiler une trame de démonstration
const { compile } = await import("./src/lib/compile.js");
const config = await root.kv.actesConfig.get("data");
const trames = await root.kv.actesTrames.get("data");
const doc = compile(trames[0], { __entityId: config.entities[0].id, numero: "2026-401-IAM" }, config);
doc.issues;  // contrôles
exportAkn(doc, config, trames[0]);  // XML

// la charte d'un acte : quelle feuille s'applique, et son CSS
const styles = await import("./src/lib/styles.js");
styles.styleForDoc(config, doc).label;          // feuille résolue
styles.paperMargins(styles.styleForDoc(config, doc));  // { top, right, bottom, left } en mm
styles.styleCss(styles.styleForDoc(config, doc), config);  // CSS non confiné (exports)
document.getElementById("sheet-css").textContent;          // CSS confiné (aperçu)

// l'export PDF/A, SANS rien télécharger : les octets
const pdfa = await import("./src/lib/pdfa.js");
const octets = await pdfa.creerPdfA({ doc, config, style: styles.styleForDoc(config, doc), part: 2 });
new TextDecoder().decode(octets.slice(0, 8));   // « %PDF-1.7 » — et « %PDF-1.4 » pour part: 1

// la version EN LIGNE : la charte ne doit pas y paraître, et le <style> est le même pour tous
const eli = await import("./src/lib/eli.js");
const html = eli.buildWebVersion({ doc, config, record: { eliUri: "eli:/…", numero: doc.meta.numero } });
html.includes("data-sheet");                    // false
html.includes(styles.styleForDoc(config, doc).ruleColor || "#000091");  // false — aucune couleur de charte

// parler au service comme le fait l'application
const remote = await import("./src/lib/remote.js");
await remote.get("/v1/health");
remote.log;            // le journal : requêtes, réponses, statuts, durées
remote.apiStatus();    // { status: "online" | … }

// la page d'accueil du site : le recueil public (voir src/ui/app.js)
location.hash = "";            // sans ancre ni paramètre…
scribae.state.route.view;      // …"recueil" — jamais l'atelier
location.hash = "#/pas-un-ecran";  // une ancre inconnue ramène au recueil
```

Repères de vérification visuelle : pour l'aperçu, chaque `.paper` doit porter
`--paper-pad` (marges de la feuille) et `data-sheet` (feuille résolue) ; en mode sombre,
`<html data-theme="dark">` et `.paper` doivent garder `--bg: #ffffff` (le papier reste clair) ;
l'écran des feuilles de style se vérifie dans les deux vues (« Réglages » et « Édition
directe »), en 390 × 844 et en 1600 × 950.

Vérifier l'outillage depuis l'atelier : l'aperçu du navigateur n'a ni système de
fichiers ni processus, il ne peut donc pas lancer `scripts/verifier-style.mjs` tel
qu'il est livré. On monte la disposition livrée dans un système de fichiers
virtuel (la table ci-dessus), les modules Node (`node:fs`, `node:path`,
`node:url`, `node:child_process`) sont remplacés par des bouchons, le script
passe par esbuild, et les écritures reviennent dans `src/`. Les épreuves, elles,
se lancent **un fichier par processus** (`node --test` les isole, et un bouchon
qui fuit d'un fichier à l'autre fausse le suivant). Ce banc vit hors du dépôt :
il n'y a rien à y chercher dans `scripts/` ni dans `tests/`.

Deux pièges de cet environnement : `node:url` n'y est pas traduisible
(`fileURLToPath` jette), les épreuves qui s'en servent se **sautent** — c'est le
cas des onze sauts attendus ; et `import.meta.url` doit être servi sous une
adresse `file://` virtuelle, sans quoi `new URL("..", import.meta.url)` calcule
faux.

## Pièges connus

- **Une feuille de style écrite dans un littéral gabarit ne peut pas contenir de backtick** —
  et `\00a0` (échappement octal) y est refusé aussi. `CSS_DOCUMENT_WEB`
  (`src/lib/recueil.js`) et le `<style>` de `buildWebVersion` (`src/lib/eli.js`) sont
  écrits ainsi : un commentaire CSS qui cite un nom de variable entre accents graves
  **termine le littéral** et casse tout le module (`Expected ";" but found …`). Écrivez
  « CSS_DOCUMENT_WEB » sans accents graves, et `\u00a0` plutôt que `\00a0`.
- **Re-rendu et `blur`** : ne jamais vider ou reconstruire un conteneur de façon
  **synchrone** depuis un gestionnaire `blur` (ni pendant qu'un `removeChild` s'exécute) :
  Chrome lève alors `NotFoundError: Failed to execute 'removeChild' … Perhaps it was
  moved in a 'blur' event handler?`. `clear()` s'appuie sur `replaceChildren()` et
  `redrawView()` diffère/coalesce le rendu.
- **Redessin et curseur** : un conteneur reconstruit pendant une saisie perd le champ et
  la position du curseur. C'est repris par `avecCurseur()` (`ui/focus.js`) sur les chemins
  de rendu qui passent par lui (`renderRoot`, `drawView`) — et, depuis 1.6.1u, sur la
  **saisie elle-même**, que `textField` (`ui/components.js`) enveloppe. Un `clear()` fait à
  la main — le `.paper` de l'éditeur de trame, par exemple (`refreshPaper`,
  `views/editor.js`) — n'en bénéficie pas : n'y reconstruisez pas la zone où l'agent écrit.
- **L'état d'une base est un CONSTAT DATÉ** : `db.status()` dit ce que le dernier geste a
  répondu, rien de plus — rien ne le recalcule en boucle. Un écran qui l'affiche doit donc
  l'éprouver lui-même (`db.health()` à l'ouverture, et après un essai réussi), sinon il
  montre une panne déjà réparée à côté d'un test qui réussit. Et **une santé qui répond ne
  prouve pas qu'une écriture passe** : ces deux questions ont leurs routes, et seule une
  synchronisation vide dit la seconde (voir `essaiEcriture`, `src/lib/db/service.js`).
- **Un cookie n'est lisible que par les pages de SON hôte** (`document.cookie`). Une
  application servie par un hôte et un service sur un autre envoient donc tous les cookies
  (le navigateur les envoie) mais ne peuvent pas LIRE le jeton anti-CSRF : la session est
  valide, les lectures passent, et chaque écriture est refusée. C'est pourquoi le jeton
  voyage aussi dans le corps de `/v1/auth/session` **et de la connexion** et que
  `src/lib/motdepasse.js` le garde (voir CHANGELOG 1.3.2m et 1.3.2n) : ne jamais dépendre
  de la lecture d'un cookie pour cette valeur. Corollaire : deux `Set-Cookie` (session +
  anti-CSRF) partent ensemble à la connexion — un en-tête à plusieurs valeurs doit rester un
  TABLEAU jusqu'à `writeHead` (`entetesSurs`, `src/server/mysql/entetes.mjs`) ; jointes par
  une virgule, elles forment une valeur invalide que les navigateurs ne lisent que par
  tolérance.
- **Un autre hôte et une autre ORIGINE ne demandent pas la même chose.** Un service sur
  un autre *hôte* du même domaine fonctionne (les cookies partent), mais une autre
  *origine* exige, côté service, `access-control-allow-credentials: true` en plus de
  l'origine autorisée (`CORS_ORIGINS`) et de `x-csrf-token` dans
  `access-control-allow-headers` — sans quoi le contrôle préalable échoue et l'écriture est
  rangée en file comme une panne réseau (« Serveur de données injoignable »). `CORS_ORIGINS=*`
  ne peut PAS transporter de session : la spécification interdit l'en-tête `credentials`.
- **Le mode du service est un FAIT qui peut arriver en retard** : le pilote est bâti au
  démarrage sur ce que la page annonce, et `GET /v1/auth/config` — qui fait autorité — peut
  échouer (service en train de redémarrer). Un pilote ainsi bâti sans anti-CSRF refuse
  chaque écriture pour toujours si rien ne redemande le mode : c'est le rôle de
  `reparerPilote` (`src/lib/db/index.js`, appelé au premier refus `csrf_invalide` /
  `session_absente` et par *Renvoyer maintenant*). Ne jamais construire un chemin
  d'écriture qui suppose que le mode annoncé à l'initialisation est le bon.
- **Dialogues** : `confirmDialog`/`promptDialog` doivent trancher la promesse **avant**
  de fermer la modale, car `close()` déclenche `onClose` (donc le refus) — sinon elles
  se résolvent toujours à `false`/`null` et l'action demandée ne se produit jamais.
- **Débordement du papier** : `.paper` porte `overflow-wrap: break-word` et `.chip` est
  `white-space: pre-wrap; max-width: 100%`, sinon une longue expression ternaire
  (`{{dateEffet ? "le " + dateEffet : "au lendemain de …"}}`) dépasse la page A4.
- **Reset hérité** : la page reçoit une feuille de style normalisée
  (`normalize.css` + un reset). Elle est plus spécifique que le `*` global : notamment
  `input[type="search"] { box-sizing: content-box }` (0,1,1) fait déborder de 24 px tout
  champ en `width: 100%`. D'où la règle `input.fr-input, select.fr-select,
  textarea.fr-textarea { box-sizing: border-box }` et sa variante qualifiée
  `input[type="search"].fr-input`. Même piège que pour les couleurs de boutons.
- **Impression** : `printHtml` (appelé par `printDocument`) ouvre un onglet dédié (repli
  iframe + `print()`). La page imprimée porte son propre `@page A4` (`paper.js`) : ne jamais
  compter sur les marges du bloc, c'est `@page` qui fait la page.
  En test automatisé, `window.print()` **bloque** la page : ne pas appeler sans
  interaction utilisateur.
- **Captures d'écran** : utiliser l'aide de capture du harnais d'édition (`snapshot.js` de
  `ai-agent` : `await capture()` pour la page entière, `await capture(el, {scale})` pour un sous-arbre).
  **Sauf si l'en-tête est dans le cadre** : snapdom y replie la barre d'outils (voir la
  section du guide) — prendre `html2canvas` à la place.
  Attention : un **logo distant** fait **traîner la capture** (le helper tente de le convertir en
  data URL et se heurte au CORS) — mettre `config.brand.logoUrl = ""` en mémoire avant de
  capturer. `IntersectionObserver` ne se déclenche pas dans l'aperçu, et l'import de `snapdom`
  peut rester bloqué : ne pas construire de logique là-dessus. Les repères (`x`, `y` centre,
  `w`, `h`) se mesurent **sur le DOM** (`getBoundingClientRect` de l'élément visé, en
  pourcentage de la page capturée), jamais à l'œil.
- **Import relatif erroné** : depuis `src/ui/views/`, `../../lib/export.js` est le bon chemin.
  Un chemin faux (`../lib/…`) fait échouer **tout** le graphe de modules : `#app` reste vide,
  `state.ready` reste faux, la remontée d'erreurs du moteur est vide, et Chrome affiche un
  « Failed to fetch dynamically imported module » trompeur. Après chaque rechargement,
  vérifier `document.querySelector("#app").children.length`.
- **`let`/`const` avant initialisation** : seules les **fonctions** sont hissées. Une fonction
  de rendu appelée pendant le rendu initial qui lit une variable déclarée plus bas lève
  `Cannot access 'x' before initialization` (rencontré avec des alias comme `paintTabs` ou
  `counterEls`). Déclarer ces variables avant le premier appel de rendu.
- **Ne pas reconstruire le DOM depuis un `blur`** (voir plus haut) : c'est aussi vrai pour le
  document éditable — le `blur` d'une zone de texte se contente d'enregistrer l'écart et de
  rafraîchir le panneau **en différé**, sinon le bouton que le rédacteur vient de cliquer
  serait détruit avant de recevoir son clic.
- `localStorage`/`kv` sont liés à l'**origine** qui sert l'application : changer d'adresse
  change l'accès au stockage (les données deviennent inaccessibles) — exporter avant de changer.

### Service (script serveur)

- **Ordre des paramètres du RPC** : `self.rpc.nom(infos, data)` — le **premier** argument
  est `{conn}`, le **second** est ce que le client a envoyé. Inversé, le serveur reçoit un
  objet et répond `Requête illisible (JSON attendu)`.
- **Le serveur ne connaît ni `crypto`, ni `TextEncoder`, ni `JSON` « chaud »** : l'empreinte
  SHA-256 et l'encodage UTF-8 sont écrits à la main dans le script serveur. Toute
  modification de `sha256Hex` doit être recoupée avec `crypto.subtle.digest` côté client
  (déposer un document puis comparer les empreintes).
- **La longueur de l'état tient sur 32 bits** (`STATE_VERSION` 2, en-tête de 4 unités
  UTF-16 : version, longueur en deux unités, réservé). Ne pas revenir à une seule unité : à
  l'origine la longueur était rangée dans `U16[1]`, donc elle **débordait au-delà de 65 535
  caractères** — `saveDb` écrivait une longueur fausse, `loadDb` relisait un JSON tronqué et
  repartait de zéro, en silence. C'est un piège qui ne se voit qu'avec de gros états (un
  référentiel un peu fourni dépasse vite 64 Kio) : il a été trouvé par une écriture de
  120 000 caractères, qui revenait tronquée après rechargement. `src/pages/host.js`
  (`etatUtilise`) lit la même longueur — les deux doivent rester d'accord.
- **L'aperçu non enregistré utilise un serveur émulé** : son état (50 Mio) disparaît à
  chaque rechargement de la page. Après un `page_refresh`, il faut donc refaire le parcours
  pour observer une publication. La version publiée en ligne, elle, utilise le
  vrai service et garde son état. Dans l'édition statique, l'état est conservé dans
  IndexedDB : il survit aux rechargements (voir `src/pages/host.js`).
- **Taille des messages** : un message WebSocket est limité à 1 Mio. `remote.js` refuse
  au-delà de 900 000 caractères et le service au-delà de 400 000 caractères de document ;
  les charges utiles d'une publication font ~100 Kio.
- **Jeton** : le script serveur ne contient que l'empreinte du jeton. Si on change le jeton
  dans `DEFAULT_PUBLICATION`, il faut aussi changer `CLE_JETON` côté serveur, sinon toutes
  les écritures répondent `403`.
- **Double encodage des clés de publication** : la clé contient un `@`. Un paramètre de
  route arrive encodé (`%40`) : le décoder une fois avant de le ré-encoder pour l'URL de
  l'API, sinon on demande `%2540` et le service répond `404`.
- **Un acte déjà signé n'est jamais re-déposé** : l'idempotence par empreinte ne vaut que
  pour les documents encore en circuit (`depose`, `en_signature`). Si l'interface dit
  « Erreur 409 » à l'envoi en signature, c'est que l'acte visé est déjà signé : c'est le
  comportement attendu, pas un bug.
