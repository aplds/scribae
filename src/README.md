# Scribae — éditeur de trames et d'actes administratifs

Application web pour une administration qui produit des actes :
les **administrateurs** préparent des **trames** (structure + champs + règles + commentaires), les
**services** les remplissent, le système **compile** l'acte et l'exporte dans des formats
ouverts et normés (Akoma Ntoso, Schematron, JSON-LD/ELI, HTML imprimable).

> **Démonstrateur.** Le jeu de données livré est **entièrement fictif** : il configure
> l'outil pour la **mairie de Valmont-sur-Loire**, avec ses entités satellites (CCAS, caisse
> des écoles), ses rôles, ses personnes, ses références (CGCT, CGFP, décret régies…), sa
> numérotation d'arrêtés et son recueil. Rien de réel. Voir `src/lib/seed.js`.

👉 **Lire `SPEC.md` d'abord** : contraintes, modèle de données, langage d'expression,
formats d'export, périmètre.

👉 **Exploitation / auto-hébergement** : `docs/ADMINISTRATION.md` (administrateurs,
exploitants) et `server/README.md` (installation Docker). La démonstration est servie **en
statique, depuis GitHub Pages** ; pour un service de production, le dossier `server/` fournit
la pile complète (nginx + service Node + MySQL/MariaDB) et l'édition web de l'application.

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
4. **Chaque livraison laisse une trace** : incrémenter `APP_VERSION` (`src/lib/version.js`),
   ouvrir une entrée datée dans **`src/CHANGELOG.md`** (rubriques `Ajouté` / `Modifié` /
   `Corrigé` / `Retiré`), et vérifier que la première entrée datée correspond bien à
   `APP_VERSION`. Le changelog est lisible dans l'application — **Documentation technique ›
   Journal des versions** — et dans le dépôt.
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

L'export est un **zip dont la racine EST le dépôt** : `index.html`, `main.pjs`, tout `src/`,
plus trois fichiers ajoutés à la racine — `.nojekyll` (vide, obligatoire pour GitHub Pages),
`.gitignore` et `README.md` (recopie de **`src/docs/GITHUB.md`**, la page d'accueil du dépôt).

Recette : écrire les fichiers dans un zip (outil `execute_js` + `@zip.js/zip.js`, niveau 9,
dates fixes pour un export reproductible), en excluant `node_modules`, `scratch/`, `.git` et
les fichiers système ; ajouter les trois fichiers ci-dessus. Le nom du fichier porte la
version courante — `scribae-v<APP_VERSION>-github.zip` — et l'archive se décompresse **à la
racine** du dépôt.

```sh
git add -A
git commit -m "<titre de l'entrée de changelog de la version>"
git push
```

`src/docs/GITHUB.md` et le `README.md` du dépôt doivent rester **cohérents** : le premier est
la source, le second la copie publiée (c'est ce que l'export recopie).

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
Tout ce qui porte l'identité est regroupé dans **`src/ui/brand.js`** :

- `APP_NAME`, `APP_TAGLINE` — nom et devise, affichés dans l'en-tête (`app.js`) et en tête du
  guide (`views/aide.js`) ;
- `markSvg(size)` / `markEl(size)` — la marque : une **forme pleine** (un document à coin
  coupé) dont le chevron est une **découpe**, en `currentColor`, donc *une seule teinte* qui
  tient sur fond clair comme sur fond sombre (en-tête : noir du texte ; guide : bleu) ;
- `markDataUrl()` — la même marque en data URL à teinte fixe (favicon).

À quoi d'autre toucher si le nom change : `$meta.title` / `description` (`main.pjs`), le
`<link rel="icon">` de `index.html`, le nom des autorités de certification de la
démonstration (`src/lib/signature.js`), et les captures du guide (leur en-tête montre le
nom — voir plus bas).

> **Registre à ne pas confondre** : `brand` dans le référentiel (`seed.js`) est la
> **structure qui utilise l'outil** (la mairie de démonstration) : son nom, son logo, ses
> couleurs. `Scribae` est le **logiciel**. Dans l'en-tête, la gauche est le logiciel
> et la pastille de droite rappelle la structure.

## Bandeau de démonstration

Un **bandeau orange** (« Démonstration » + une phrase, et un lien *Réglage* pour les
administrateurs) est affiché **en tête de l'application** — sur l'écran de connexion comme
dans l'en-tête — tant que le référentiel ne dit pas le contraire : `brand.demo !== false`.
C'est un choix délibéré : une installation neuve, un référentiel importé ou des données
effacées réaffichent le bandeau, donc on ne peut pas se retrouver à produire des actes
« pour de vrai » dans une démonstration par simple oubli.

- **Élément** : `src/ui/notice.js` (`demoNotice()`, `isDemo()`, `DEMO_TEXT`), posé par
  `app.js` (coquille) et par `views/connexion.js` ; styles `.app-demo` dans `app.css`.
- **Réglage** : `Administration › Identité › Mention de démonstration` — *Afficher / Masquer*
  plus un **texte libre** (`brand.demoText`, vide = phrase d'origine). Le basculement
  rafraîchit toute l'application ; la saisie du texte met le bandeau à jour en direct.
- **Portée** : le bandeau marque l'**application** — l'écran de connexion, l'en-tête de
  l'atelier **et le recueil public** — mais **pas les documents produits** (un acte exporté ou
  publié ne porte pas la mention). Si une installation veut marquer aussi ses sorties, c'est un
  autre réglage à ajouter (sortie HTML/Akoma Ntoso).
- Les captures du guide ont été prises **avant** l'introduction du bandeau, volontairement :
  elles montrent l'application en service (bandeau coupé), pas la démonstration. Les repères
  restent valides tels quels.

## État actuel (v1 fonctionnelle)

| Écran | État |
|---|---|
| **Trames** (liste, création, duplication, import/export JSON) | ✅ |
| **Éditeur de trame** (plan / page éditable en place / inspecteur : bloc, champs, règles, trame — commentaires et règles **signés du service** de leur auteur ; administrateurs **et** éditeurs) | ✅ |
| **Rédiger** (choix de l'acte à rédiger — rédaction en cours, acte enregistré, ou trame avec recherche — puis document éditable en place : WYSIWYG, pastilles de champs, écarts « hors trame », panneau « À compléter » / « Contrôle & écarts », exports) | ✅ |
| **Exports** (Akoma Ntoso, Schematron, JSON-LD/ELI, HTML, **Word (.doc)**, Markdown, JSON — tous au **format A4** pour l'impression et le PDF) | ✅ |
| **Actes** (registre local : numéro, objet, nature, conformité à la trame, statut, parapheur, exécution, export ; pastille **« abrogé »** / **« abrogation prévue »** ; **corbeille réservée aux brouillons**, les actes signés ou publiés passant par **« Retirer / abroger »**) | ✅ |
| **Parapheur** — *fonction expérimentale, éteinte par défaut* (circuit de validation du référentiel : étapes séquentielles, bon pour accord ou avis, ciblage trame/famille/entité, décisions motivées, empreinte du texte validé, reprise de circuit ; file « à valider par moi ») | ✅ |
| **Révision** — rôle « Réviseur » **cumulable** : contrôle de l'acte entre l'envoi à signature décidé par le rédacteur et l'envoi effectif (rapport de conformité, correction, validation — elle déclenche l'envoi — ou rejet motivé, l'acte revenant en brouillon) ; **compétence** par compte ou portée par un service (ou certains de ses bureaux), ciblée services/familles/trames/types d'actes/entités ; empreinte du texte révisé ; porte de signature (client et service) | ✅ |
| **Exécution & délais** (échéancier des formalités : transmission au contrôle de légalité, publication, notification ; **recours introduit** et sa date d'introduction ; date d'exécutoire, délai de recours, alertes de retard ; **pièces du dossier** : état des formalités, attestation de non-recours) | ✅ |
| **Recherche globale** (Ctrl+K ou « / » : actes, trames, personnes, services, références, comptes, guide) | ✅ |
| **Corbeille** (suppression réversible des actes **et** des trames, restauration, suppression définitive ; seuls les actes encore en brouillon peuvent y être mis — un acte signé ou publié s'abroge ou se retire du recueil, il ne se supprime pas) | ✅ |
| **Journal d'audit & historique des brouillons** (tous les faits, filtrables ; vingt versions par acte, restauration) | ✅ |
| **Collaboration** (présence des postes, verrou souple de rédaction, notifications et cloche) | ✅ |
| **Modifier un acte** (l'acte en vigueur est **édité en place**, comme dans un traitement de texte : ajout et retrait d'un **paragraphe**, d'une **ligne de liste** ou d'une **ligne de tableau** ; **réattribution d'un numéro** à un article — le numéro doit être libre — ou **« tout renuméroter »** ; la confirmation produit l'acte modificatif + la version consolidée, puis le circuit signature → publication rend la consolidation opposable et supplante l'originale) | ✅ |
| **Abroger un acte, ou l'un de ses articles** (prévu **dès la rédaction** d'un acte, y compris un acte non modificatif : on vise au référentiel l'acte — ou tel article d'un acte — à abroger ; la clause d'abrogation s'ajoute au document, et l'abrogation prend effet **au jour de l'entrée en vigueur** de l'acte qui la porte, non à sa publication ; l'acte abrogé le devient en bloc, l'article abrogé est consolidé) | ✅ |
| **Signature électronique** (dépôt par API REST, circuit auprès du prestataire, retour de l'acte signé et vérification) | ✅ (démonstration) |
| **Le signataire** — rôle « Signataire » **cumulable**, **attribué par la désignation** dans l'organigramme des délégations ; **compte** rapproché de celui de l'outil de signature ; **onglet « Ma signature »** (actes qui attendent sa signature, actes signés au titre de sa délégation) ; **champ de compétence** (l'atelier ne montre que les actes dont sa signature relève) | ✅ |
| **Publication & ELI** (dépôt au recueil, identifiant ELI, opposabilité, original signé, registre de l'administration) | ✅ (démonstration) |
| **Recueil public** (site sans compte : accueil — **carrousel des derniers actes publiés** et **thèmes** par lesquels on parcourt les actes —, recherche et filtres dont le **thème**, liste groupée par année, texte de chaque acte rendu dans la page — les actes s'affichent par défaut **dans leur version la plus récente**, avec une case **« Afficher les versions antérieures »** et une case **« Afficher les articles abrogés »** —, adresse citable) | ✅ |
| **Recueil ouvert** (robots et agents : adresse de référence par acte, représentations JSON / Markdown / texte / Akoma Ntoso, métadonnées de page et JSON-LD, fichiers `llms.txt`, `recueil.json`, `sitemap.xml`, `robots.txt` sur un déploiement serveur) | ✅ |
| **Réglage « Publication automatique »** (Administration › Publication : publier au retour signé, ou laisser l'acte au registre pour une administration qui publie ailleurs) | ✅ |
| **Administration** (identité, vocabulaire, numérotation — **séquence interne ou service externe**, entités, personnes, rôles, **services et bureaux**, références, mentions, familles, types d'actes, données) | ✅ |
| **Feuilles de style** (charte graphique : marges, typographie, couleurs, logo, en-tête, pied, filets, **encadrés à côtés choisis**, **listes à puces et listes numérotées « 1° 2° 3° »**, tableaux, signature, cadre ; préréglages ; résolution trame → entité → famille → générale ; **éditeur direct WYSIWYG sur le style**) | ✅ |
| **Apparence claire / sombre** (bouton d'en-tête, choix « Automatique » dans le menu du compte ; préférence de poste, le papier reste blanc) | ✅ |
| **Assistants « Plume » et « Publia »** (mode d'emploi pour l'atelier, actes publiés pour le recueil ; **nom** et **icône** réglables par l'administrateur, **masquables par chaque agent** dans le menu du compte ; réponses renvoyant par des **liens cliquables** — le chapitre du guide, l'acte du recueil ; Publia connaît l'**acte consulté** et répond d'abord sur lui) | ✅ (démonstration) |
| **Comptes et rôles** (écran de connexion, 6 rôles — dont le **réviseur** et le **signataire**, cumulables, et le **visiteur**, sans accès —, gestion des comptes, **périmètre par service/bureau**, compétence de réviseur, **champ de compétence de signature et rapprochement du compte de l'outil de signature**, contrôle d'accès) | ✅ (démonstration) |
| **Annuaire de la collectivité (OIDC)** (connexion par le fournisseur d'identité, PKCE, vérification du jeton, groupes → rôles, périmètre par revendications, **désactivation automatique des comptes de démonstration**, **écran d'accueil du visiteur sans rôle**, annuaire d'essai intégré) | ✅ |
| **Base de données** (pilotes local / service partagé / **serveur MySQL-MariaDB** externe, synchronisation par enregistrement, conflits, file hors ligne) | ✅ |
| **Auto-hébergement** (pile Docker nginx + service Node + MySQL/MariaDB, édition web de l'application, transport HTTP) | ✅ |
| **Bibliothèque de trames partagée / multi-poste** | ✅ (mode partagé ; export/import JSON toujours disponible) |
| **Guide** (wiki intégré : 21 chapitres, glossaire, dépannage, fiche mémo, impression) | ✅ |
| PDF/A certifié, bordereau SEDA | ⏳ |

### Comptes et rôles

L'accès se fait par un **écran de connexion** (« Qui se connecte ? ») qui liste les comptes
disponibles : la simulation d'annuaire/SSO tient lieu d'authentification (aucun mot de passe
— c'est un démonstrateur). La session choisie est mémorisée (`kv.actesSession`) : recharger la
page reconnecte le dernier compte ; *Changer de compte* (menu du compte) ramène à la liste.

Ce mode (« comptes de l'application ») n'est qu'un des deux : le référentiel peut **brancher
l'annuaire de la collectivité** (OpenID Connect), auquel cas les comptes de démonstration sont
**désactivés automatiquement**. Voir « Annuaire de la collectivité (OIDC) » plus bas.

Cinq rôles d'application — dont **deux qualités cumulables** (Réviseur, Signataire) —, plus le
**Visiteur**, définis **une seule fois** dans `src/lib/users.js` (`ROLES`, classés par rang) :

| Rôle | Rang | Ce que le rôle débloque |
|---|---|---|
| **Administrateur** | 3 | tout, y compris le **référentiel**, les **comptes et rôles**, l'**API & journal** |
| **Éditeur** | 2 | les **trames** (créer, modifier, commenter ; les feuilles de style des actes à venir), rédiger et gérer les actes |
| **Rédacteur** | 1 | rédiger un acte et mener les actions associées (enregistrer, signer) — **uniquement ses actes** ; choisit son modèle dans « Rédiger un acte » (pas d'accès au registre des trames) |
| **Réviseur** | 2 | **cumulable** (il ne remplace pas un profil) : contrôler les actes avant leur signature — rapport de conformité, correction, validation, rejet motivé (voir « La révision ») |
| **Signataire** | 2 | **cumulable** (il ne remplace pas un profil) : la **qualité de signer** (voir « Le signataire »). L'onglet **« Ma signature »**, les actes de son **champ de compétence** dans l'atelier. Il **découle d'une désignation** dans l'organigramme des délégations |
| **Visiteur** | 0 | **aucun accès** : l'atelier ne lui est pas ouvert, il ne lui reste que l'**espace public**. C'est l'état d'un compte authentifié dont aucun rôle n'est reconnu (voir « L'identité reconnue sans rôle ») |

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
(`competenceDeSignature`, `competenceDuCompte`, `fileSignature`, `placeDansChaine`). Signer
(`actes.signer`) est une permission **distincte** de la publication (`signature.gerer`).

Les seize permissions (`PERMS`, `src/lib/users.js`) sont la **source unique** du contrôle
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
- `app.js` filtre la barre de navigation (`NAV[].perm`), la vue (`VIEW_PERMS`) et **replie sur
  le premier écran autorisé** : un rédacteur qui demande `#/referentiel` ou `#/trames` est
  ramené à la rédaction. Le registre des trames est réservé aux éditeurs et aux
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
  bureaux: [{ id, name }] }]`), chacun subdivisé en **bureaux**. Ils se décrivent dans
  **Administration › Services**.
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
  alimente l'onglet **« Ma signature »**.

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

Le référentiel porte le **mode d'authentification** (`config.auth`, `src/lib/auth.js`) :

| Mode | Effet |
|---|---|
| `demo` (défaut) | écran de connexion listant les **comptes de l'application** (démonstration, sans mot de passe) |
| `oidc` | la session s'ouvre chez le **fournisseur d'identité** de la collectivité |

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
« Attribuer le rôle de repli »). `visiteur` ne porte **aucune permission**, et `can()` refuse
tout dès qu'un compte le porte — une qualité cumulée résiduelle (un réviseur dont le groupe a
disparu) ne rouvre pas l'accès, et `applyOidcUser` **efface** ces qualités quand l'annuaire ne
reconnaît aucun rôle.

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

**Écrans** : `src/ui/views/connexion.js` (écran de connexion, deux modes),
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
| Version en ligne publiée (`eli.js`) | colonne de 21 cm | `@page A4`, barres latérales masquées à l'impression |
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

### Actes de démonstration

Le jeu de démonstration ne se limite pas au référentiel et aux trames : il pose **quinze actes**
(`src/lib/demo-actes.js`), dont **dix rédigés et signés**. Ils sont installés au premier
démarrage — et remis à niveau quand `SEED_VERSION` change — uniquement si les trames sont celles
de la démonstration *et* que le registre ne contient que des actes de démonstration
(`acte-demo-*`) : un registre réel, ou enrichi à la main, n'est jamais touché.

Trois d'entre eux illustrent la **révision** : un acte **en attente de révision** (file « à réviser
par moi »), un acte **révisé et validé** (avec une correction du réviseur au dossier), et un acte
**rejeté**, revenu en **brouillon** avec son motif.

Deux de ces actes illustrent les **actes individuels non publiables** (trame `tpl-revalorisation`,
`publishable: false`) : l'un signé, l'autre prêt à signer. Ils sont conservés au registre et ne
passent jamais par la publication (voir plus bas).

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

Les écritures exigent `Authorization: Bearer <jeton>` : le script serveur ne contient que
l'**empreinte SHA-256** du jeton de démonstration, jamais le jeton lui-même. Le jeton en
clair est dans `DEFAULT_PUBLICATION.jetonDemonstration` (`src/lib/eli.js`), donc visible :
c'est une clé de démonstration, pas un secret. En exploitation, chaque client reçoit la
sienne et seule son empreinte est conservée.

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
feuille de style** : la charte habille le **papier** (PDF, Word, page autonome), pas la version en
ligne. `CSS_DOCUMENT_WEB` pose alors la présentation web : les styles de lecture de l'application
(`.doc*`, `app.css`) sont repris et ajustés — police de l'interface, largeur, et jetons ramenés
aux valeurs **thémées** du site (`--ink-public`, `--brand-public`). Le texte n'est donc **pas
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

**Le recueil public** (`src/ui/views/recueil-public.js`, routes `recueil` : `?recueil=1` et
`?acte=<clé>` dans la page, `/recueil` et `/recueil/<clé>` sur un déploiement serveur) est la face
« citoyen » : un site **sans compte** qui ne montre que la
structure et ses actes publiés, et interroge le service comme le ferait un visiteur. Il est
rendu **avant la porte de connexion** (`app.js`, `EST_PUBLIQUE`) : un visiteur qui suit un lien
ne voit ni écran de connexion, ni cloche — mais **le bandeau de démonstration**, quand
l'installation en porte un, s'affiche ici comme ailleurs. Sa **page d'accueil** se lit de haut en
bas : une **entrée** (nom de l'organisation, titre, phrase d'accueil, recherche, ligne de
chiffres), un **carrousel** des **derniers actes publiés en vigueur** (`dernieresPublications`,
`publicationsEnVigueur` — défilement par `scroll-snap`, flèches et pastilles gérées en JS, chaque
carte mettant en avant le **thème** de l'acte), une **grille de thèmes** (`themesZone` : une tuile
par matière, teinte déterminée par `hueDe`, qui **filtre** la liste et se dé-filtre au second
clic), puis la **liste complète** groupée par année, avec ses filtres fins (thème, nature, année,
entité). Le **thème** d'un acte est la **famille de sa trame** — `themeDe`/`themeLabel`
(`lib/recueil.js`) le résolvent depuis la publication, `themeDePublication`/`themeLabelDePublication`
(`views/acte-publie.js`) le retrouvant par l'acte local quand la publication ne le porte pas — et
sa **phrase de présentation** (`config.families[].description`) s'édite dans Administration ›
Familles. La recherche et la liste s'appuient sur `src/lib/recueil.js` (texte libre, facettes
déduites des actes — dont les **thèmes** —, regroupement par année). Deux adresses à ne pas
confondre : `hrefRecueil`/`hrefActe` (relatives, `?recueil=1`,
`?acte=<clé>`) pour **naviguer** dans la page (un lien absolu rechargerait la page publique dans
son propre cadre), et `adresseRecueil`/`adresseActe` (absolues,
`perchance.org/<générateur>?acte=<clé>`) pour **citer et partager** l'acte.

**Le recueil est la porte d'entrée de l'application.** Pour qui n'a pas de compte, le recueil
*est* l'interface de l'installation : son en-tête (`porteApplication`, `views/recueil-public.js`)
porte donc **« Se connecter »** — un bouton, pas un lien gris — tant qu'aucune session n'est
ouverte ; **« Retour à l'application »** quand une session l'est ; et **« Mon accès »** pour un
**visiteur** authentifié sans rôle, qui mène à l'écran d'explication (voir « L'identité reconnue
sans rôle (le visiteur) »). Le recueil lui-même est insensible à la session : un agent connecté y
lit exactement ce que lit un passant.

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
Éteinte, `publierApresSignature` (`views/signature.js`) s'arrête au retour signé : aucune
publication, aucune transmission, l'acte signé attend au registre — le fait est journalisé.
C'est le réglage d'une administration qui publie dans son propre système.

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

**Amorçage du recueil (démonstration).** Le recueil ne montre que ce qui est **réellement
publié** : un service neuf n'aurait donc rien à consulter. `src/ui/demo-publications.js`
(`amorcerRecueil`, appelé en fin d'amorçage par `app.js`) publie, au premier démarrage, les
actes que la fiction déclare publiés — **signés comme déjà publiés au registre local**, un acte
déjà publié n'étant plus « signé » et devant donc être redéposé quand le service a été remis à
zéro — par le **même chemin** que l'écran de signature (`publierActeDuSeed`, `views/signature.js`),
de sorte que le registre local et le service racontent la même chose. Le succès n'est rapporté
qu'après **vérification auprès du service** (et non sur l'état local, qui peut être périmé) ; un
acte qui porte déjà une **transmission au contrôle de légalité** la rejoue avant de publier, sans
quoi le dépôt échouerait en `transmission_absente` quand cette formalité est active.
**Idempotent** (un acte déjà connu du service est seulement repris au registre local) et
**silencieux** : un service injoignable laisse simplement le recueil vide.

**Limites assumées** : le prestataire est simulé, le certificat n'est pas qualifié eIDAS,
et le service conserve au plus 40 publications (les plus anciennes sont évincées) —
`state` est un `Uint8Array` de taille fixe, rangé en JSON sur une vue UTF-16.

### Le parapheur : un acte est validé avant d'être signé

**Fonction expérimentale, éteinte par défaut.** Le parapheur ne s'active que par
**Administration › Expérimentale** (`config.experimental.parapheur`, faux à l'installation). Le
défaut « éteint » est un choix de terrain : beaucoup de collectivités ont déjà leur propre
circuit interne, en amont de « Envoyer en signature ». Éteint, `circuitFor`
(`src/lib/validation.js`) ne résout **aucun** circuit : l'écran Parapheur, son entrée de menu,
l'onglet « Circuits de validation » de l'Administration, le réglage de circuit d'une trame et la
carte Parapheur d'un acte disparaissent (gardés par `parapheurActif`), et la porte de
validation ne s'applique plus ni côté client ni au dépôt (le service ne reçoit pas d'état de
validation). Activer l'option **reconstruit les actes de démonstration**
(`regenerateDemoActes`, `src/ui/state.js`) : ils portent, ou non, leur passage au parapheur
(`src/lib/demo-actes.js`), et la validation ne se génère que si le parapheur est actif — sans
quoi l'écran serait vide. Les circuits enregistrés sont conservés.

Quand il est actif, un acte ne passe pas directement de la rédaction à la signature. `src/lib/validation.js`
définit un **circuit de validation** : une suite d'étapes **séquentielles**, chacune confiée à
un rôle (« bon pour accord » ou simple « avis »), éventuellement réservée au service de
l'acte. Deux principes gouvernent le module :

1. **Rien n'est codé en dur.** Un circuit est une donnée du référentiel
   (`config.circuits`), réglable dans **Administration › Circuits de validation** : nombre
   d'étapes, intitulés, rôles, nature, et **ciblage** (trame nommée, famille d'actes,
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

### La révision : un acte est contrôlé avant d'être envoyé

Le **réviseur** s'intercale entre le geste du rédacteur (« Envoyer en signature ») et l'**envoi
effectif** : le geste **soumet** l'acte au réviseur au lieu de le faire partir. Le réviseur lit
un **rapport de conformité**, corrige l'acte au besoin, puis le **valide** — l'acte part alors en
signature, par le **même chemin** que le bouton d'envoi — ou le **rejette** en motivant, et l'acte
**revient en brouillon** chez son rédacteur avec le motif. C'est **indépendant du parapheur** :
l'ordre est **parapheur → révision → signature** (`pretPourSignature`, `src/ui/state.js`).

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
**Administration › Expérimentale**), comme le parapheur et pour la même raison : la
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
- **Historique des brouillons** (`src/lib/revisions.js`, carte sur la fiche d'un acte) —
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
  Perchance), l'adresse de la collectivité sinon — c'est le réglage qui fonctionne partout ;
- **intégré** : uniquement Perchance ;
- **personnalisé** : l'API de la collectivité (adresse, clé, modèle), en **complétions de
  conversation** façon OpenAI (flux SSE — OpenAI, Mistral, Groq, OpenRouter, Ollama, vLLM,
  LM Studio…) ou en **appel simple** `{ prompt } → { texte }`. Hors de Perchance, c'est le
  seul moteur possible : l'application s'en passe proprement tant qu'aucune adresse n'est
  réglée (l'assistant affiche alors pourquoi, et renvoie à l'Administration).

**Leur nom et leur visage.** L'administrateur change le **nom** et l'**icône** de chacun
(Administration › Assistants) : `assistantIdentite` est la seule source de ce que l'interface
affiche, et la coquille relit ces valeurs à chaque redessin (`identites[qui]`) sans reconstruire
la conversation. Un champ vide rend la main aux valeurs livrées. Chaque agent peut en outre
**masquer** un assistant pour son seul compte, dans le menu de son nom : c'est une **préférence de
poste** (`assistantPref` / `reglerPrefAssistant`, rangée par compte dans le navigateur, hors du
référentiel), et `assistantVisible` croise ce choix avec le réglage *Éteint* de l'installation.

**Le choix des chapitres du guide est un problème de budget, pas de recherche.** Le guide
entier ferait vingt mille jetons, la fenêtre utile en fait six mille : `wiki.js` classe donc
les chapitres par pertinence (`chapitresPertinents`, mots pondérés par leur rareté et titres
comptés double), et `contexteAtelier` joint les trois premiers, ceux de l'écran courant, puis
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

L'application manipule six **collections** (`contract.js`) : `config`
(singleton), `trames`, `actes`, `users` (listes d'objets identifiés par `id`),
`journal` et `presence` (listes — l'audit et la présence des postes),
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

### Hors ligne

En mode partagé, chaque lecture réussie est recopiée dans un **miroir** local
(`kv.actesMirror`) : si la base est injoignable, l'application démarre quand même
avec ces données, et un bandeau le signale. Les écritures qui échouent faute de
réseau sont **mises en file** (`kv.actesPending`) et renvoyées automatiquement
dès que la base répond (au chargement suivant ou après un test de connexion). Un
refus définitif (jeton invalide) n'est pas mis en file : il faut corriger le
réglage.

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
  qu'on relit l'édition statique depuis l'éditeur.

**Publier.** Dépôt → *Settings* → *Pages* → *Source* : *Deploy from a branch*, branche
`main`, dossier `/ (root)`. Le site est à `https://<compte>.github.io/<dépôt>/` ; les chemins
de `index.html` sont relatifs, donc un sous-dossier de projet convient.

> **Un fichier `.nojekyll` vide à la racine est obligatoire.** GitHub fait passer le dépôt
> par Jekyll, qui interprète les `{{…}}` de la documentation (`README.md`, `SPEC.md`,
> `docs/ADMINISTRATION.md`) comme du *Liquid* et **fait échouer la construction** — le site
> ne se publie pas. `.nojekyll` désactive Jekyll. (Autre voie : *Settings → Pages → Source :
> GitHub Actions*, modèle « Static HTML », qui ne passe pas par Jekyll.)

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
src/docs/GITHUB.md        PAGE D'ACCUEIL DU DÉPÔT (recopiée en README.md à la racine par l'export GitHub)
src/CHANGELOG.md          JOURNAL DES VERSIONS (la première entrée datée = la version en service)
src/TODO.md               chantiers ouverts
src/css/app.css           système de design (tokens surchargés par la configuration)
src/lib/
  util.js                 utilitaires (dates françaises, montants, téléchargements, copie…)
  version.js              VERSION DU LOGICIEL (source unique du numéro) + chemin du changelog
  expr.js                 langage d'expression sûr (parseur + évaluateur, sans eval)
  schema.js               types de nœuds/champs/règles + fabriques (dont `newTrame`, `publishable`)
  trame-format.js         format de fichier des trames : exemple documenté + lecture/normalisation à l'import
  seed.js                 JEU DE DONNÉES INITIAL (remplaçable — aucune logique métier)
  demo-actes.js           ACTES DE DÉMONSTRATION (rédigés et signés au premier démarrage)
  demo-publications.js    AMORÇAGE DU RECUEIL (démonstration) : publie les actes que la fiction déclare publiés
  compile.js              contexte, interpolation {{…}}, règles, article par article, écarts
  numbering.js            NUMÉROTATION DES ACTES : séquence interne ou service externe (appel HTTP, jetons, lecture de la réponse, journalisation)
  redaction.js            adresses d'emplacements (slots), application des écarts, repérage
  render.js               rendu DOM du document compilé (aperçu, impression, export HTML ; suivi des modifications ou mentions)
  export.js               Akoma Ntoso 3.0, Schematron, JSON-LD/ELI, Markdown, HTML, Word, impression
  paper.js                LE PAPIER DES DOCUMENTS : A4 (21 × 29,7 cm), marges, sauts de page
  styles.js               FEUILLES DE STYLE (charte graphique) : modèle, polices proposées (FONT_CHOICES), résolution (trame → entité → famille → générale), préréglages, marges du papier, CSS, compteurs de liste (@counter-style), côtés des encadrés, aperçu
  theme.js                APPARENCE (clair / sombre / automatique) : préférence locale, jetons du document, couleur de marque lisible
  akn.js                  LECTURE d'Akoma Ntoso 3.0 (import d'un acte publié, tolérant aux ns)
  amend.js                modification d'acte : plan, acte modificatif, version consolidée, mentions d'article
  abrogations.js          ABROGATION d'un acte ou de l'un de ses articles : vocabulaire de la clause, jetons, désignation d'une cible (nature lue à sa trame), composition de l'article d'abrogation, « abrogé par » et « est abrogé » (module pur)
  amend-edit.js           édition en place : adresses stables des passages, plan déduit de la saisie
  remote.js               CLIENT de l'API REST : connexion, appel, journal des échanges
  signature.js            cryptographie (ECDSA/SHA-256), original signé, prestataire simulé
  eli.js                  identifiant ELI, opposabilité, réglages de publication (recueil, automatisme), JSON-LD
  recueil.js              RECUEIL PUBLIC et RECUEIL OUVERT : extraction du document publié (sans sa charte, qui vaut pour le papier), mise en page web, thèmes des actes (famille de la trame) et thème sans matière, derniers actes publiés en vigueur, recherche/facettes, adresses d'un acte (de navigation et de référence), représentations lisibles par machine (JSON, Markdown, texte, Akoma Ntoso) et fichiers du site (llms.txt, recueil.json, sitemap.xml, robots.txt)
  validation.js           CIRCUIT DE VALIDATION (parapheur, fonction expérimentale — voir `experimental.parapheur`) : circuits du référentiel, étapes, décisions, empreinte du texte validé
  legalite.js             TRANSMISSION AU CONTRÔLE DE LÉGALITÉ par API (fonction expérimentale — voir `experimental.controleLegalite`) : API d'envoi, certificat de transmission (mention, référence, sceau), vérification
  execution.js            CARACTÈRE EXÉCUTOIRE : formalités requises, date d'exécutoire, délai de recours, recours introduit, alertes, constatations
  execution-documents.js  PIÈCES DE L'EXÉCUTION : état des formalités (tout acte), attestation de non-recours (acte définitif non contesté)
  revisions.js            HISTORIQUE DES BROUILLONS : versions successives d'un acte, restauration
  search.js               INDEX ET RECHERCHE : index en mémoire (actes, trames, personnes, services…), requête normalisée
  collab.js               COLLABORATION : présence des postes, verrou souple de rédaction, journal d'audit, notifications
  store.js                AMORÇAGE + migrations additives ; passe par lib/db (aucun accès direct au stockage)
  db/
    index.js              façade de persistance : pilote actif, différences, miroir, file hors ligne, état
    contract.js           collections, enregistrements, diff/merge, comparaison JSON stable, limites
    local.js              pilote « local » : stockage du navigateur (IndexedDB)
    service.js            pilote « service » : contrat REST (transport socket de l'environnement, ou HTTP)
  users.js                COMPTES ET RÔLES : rôles, permissions, contrôle d'accès, comptes de démonstration
  scope.js                ORGANISATION : services, bureaux, périmètre d'un compte (qui voit quoi)
  delegations.js          QUALITÉS DU SIGNATAIRE (accord en genre) ET ARBRE DES DÉLÉGATIONS de signature
  fonctions.js            CATALOGUE DES FONCTIONS DE SIGNATURE (rôles, délégations) et des personnes qui les tiennent
  signataires.js          LE SIGNATAIRE : qualité (attribuée par la désignation), rapprochement personne ↔ compte ↔ outil de signature, champ de compétence (chaîne de signature), file « Ma signature » (module pur)
  hosts.js                OÙ SONT LES SERVICES DE L'HÔTE (stockage, canal du service, relais HTTP sans CORS, moteur de langage intégré) — point unique
  assistant.js            LES DEUX ASSISTANTS (Plume, Publia) : réglages (allumé/éteint, nom et icône réglables, moteur interchangeable — intégré / API personnalisée, flux SSE ou appel simple), préférence de poste (masqué pour soi), connaissances (le guide et ses liens de chapitre pour l'un, les actes publiés, leurs liens et l'acte consulté pour l'autre) et composition de l'invite
  auth.js                 MODE D'AUTHENTIFICATION : comptes de l'application / annuaire (OIDC) — modèle du référentiel
  oidc.js                 CLIENT OIDC : PKCE, jeton d'identité (JWKS), revendications → compte, annuaire d'essai
src/pages/                ÉDITION STATIQUE (GitHub Pages)
  host.js                 fournit les deux services quand la page est servie en statique
src/server/               AUTO-HÉBERGEMENT : pile Docker complète
  README.md               guide d'installation (Docker, réseau, TLS, sauvegardes)
  docker-compose.yml      les trois services : db (MariaDB) + api (Node) + web (nginx)
  nginx.conf              façade : application servie, /v1/ en proxy vers api
  env.example             modèle du .env du déploiement
  web/                    édition web de l'application (chargée hors édition en ligne)
    index.html            coquille (remplace l'index.html d'origine)
    host.js               hôtes d'exécution simulés : root.kv (IndexedDB) et transport HTTP
    config.js.template    adresse + jeton de l'API, remplis au démarrage du conteneur
    entrypoint.sh         prépare /srv/www au démarrage
  mysql/                  LE SERVICE (Node + mysql2, hors application cliente)
    server.mjs            API : /v1/db/… (données) et /v1/… (signature, publication)
    actes.mjs             domaine signature/publication (pur, sans dépendance à Node)
    state.mjs             état du service en base (table sb_etat)
    schema.sql            tables sb_collection / sb_record / sb_journal / sb_etat + vues
    Dockerfile  README.md  env.example  package.json
src/wiki.js               CONTENU du guide d'utilisation (texte, étapes, captures) et, pour l'assistant, le sommaire et le lien de chaque chapitre
src/ui/
  dom.js                  primitives DOM (h, boutons, champs, modale, info-bulle…)
  components.js           compositions (formulaires, dialogues, états vides)
  signer-picker.js        CHOIX DU SIGNATAIRE en deux temps : la fonction, puis qui la tient (sélecteur partagé)
  assistant.js            LES DEUX PASTILLES D'ASSISTANCE (Plume dans l'atelier, Publia sur le recueil) : personnage, bulle d'invitation, panneau de conversation, réponse en flux, liens des réponses suivis dans l'application, questions de l'acte consulté, et le bloc « Assistants » du menu du compte (masquer pour soi)
  dnd.js                  GLISSER-DÉPOSER : primitives partagées (glissable, deposable, conversion d'un point de dépôt en position de curseur)
  brand.js                nom et marque du logiciel (SVG en ligne, currentColor)
  notice.js               bandeau « Démonstration » (affiché tant que brand.demo !== false, dans l'atelier comme sur le recueil public)
  state.js                état global, routeur (sans toucher au hash), persistance différée
  markdown.js             rendu markdown → DOM (documentation technique)
  parapheur-actions.js    GESTES DU PARAPHEUR partagés (soumettre, décider, reprendre, carte de décision)
  execution-actions.js    CONSTATATION D'UNE FORMALITÉ OU D'UN RECOURS, partagée (formulaire + journalisation + exécutoire)
  abrogations-apply.js    APPLICATION DES ABROGATIONS à leur entrée en vigueur (idempotent) : acte entier → « abrogé par », article → version consolidée à publier ; appelé au démarrage et après publication
  global-search.js        RECHERCHE GLOBALE (Ctrl+K ou « / ») : superposition, index, navigation clavier
  collab.js               TÉMOINS DE COLLABORATION dans l'en-tête : présence, cloche de notifications, panneaux
  theme.js                sélecteur d'apparence de la coquille (bouton d'en-tête + menu du compte)
  oidc.js                 annuaire : panneau de connexion, retour du fournisseur, fenêtre d'essai, onglet de l'Administration
  app.js                  coquille, navigation, amorçage
  views/trames.js  editor.js  rediger.js  wysiwyg.js  actes.js  modifier.js
  views/amend-editor.js   l'acte publié rendu éditable (l'équivalent de wysiwyg.js pour la modification)
  views/signature.js      SIGNATURE & PUBLICATION : onglet « Ma signature » (le signataire : son compte, le rapprochement, sa file), circuit de signature + publication ; api-console.js : OpenAPI & journal
  views/publications.js   registre de l'administration et consultation d'une publication (texte rendu dans la page)
  views/recueil-public.js RECUEIL PUBLIC : site sans compte (accueil — carrousel des derniers actes publiés, thèmes par lesquels on parcourt les actes —, recherche et filtres dont le thème, liste par année, texte de l'acte), métadonnées de page (titre, canonical, alternate, JSON-LD) et représentations pour les moteurs et les agents
  views/acte-publie.js    RENDU PARTAGÉ d'un acte publié : notice, texte intégré, pièces, signature, versions, adresses du recueil ouvert
  views/parapheur.js      PARAPHEUR : files d'attente du circuit de validation, décisions, reprise
  views/execution.js      EXÉCUTION & DÉLAIS : échéancier des formalités, recours (délai ouvert ou introduit), actes définitifs, pièces du dossier
  views/corbeille.js      CORBEILLE : actes et trames supprimés (restauration, suppression définitive)
  views/delegations.js    ORGANIGRAMME DES DÉLÉGATIONS : l'arbre des chaînes de signature (organigramme ou liste), et la fiche d'un acteur — pouvoir, étendue, décision, dates, signature obtenue. Visible par tous, modifiable par les seuls administrateurs et éditeurs
  views/referentiel.js  aide.js  connexion.js  comptes.js  docs.js
  views/comptes.js        COMPTES ET RÔLES : liste des comptes, création/modification (profil, périmètre, « Personne du référentiel — qui signe », compétence de réviseur, signature et rapprochement), matrice des droits (16 permissions)
  views/sans-acces.js     ÉCRAN « PAS D'ACCÈS » : compte authentifié sans rôle d'application (visiteur) — explique, donne le contact du service et renvoie vers l'espace public
  views/styles.js         feuilles de style : liste, schéma des réglages (GROUPS), éditeur direct WYSIWYG (REGIONS), champ « côtés d'encadré », aperçu d'un acte type
```

`views/wysiwyg.js` est le moteur du document éditable : il transforme le texte d'un bloc
(jetons `{{…}}` compris) en zones éditables + pastilles cliquables, décide ce qui est
« modifié par rapport à la trame », et ouvre la bulle de saisie du bon type de champ.
`views/rediger.js` l'orchestre : en-tête (entité, badges, Enregistrer/Exporter), panneau
de droite à onglets, enregistrement de l'acte (`values`, `overrides`, `ecarts`).
`views/amend-editor.js` joue le même rôle pour la modification : il rend le **document
publié** éditable (passages `contenteditable` adressés par `amend-edit.js`, outils
d'article, articles insérés) et remonte chaque geste à `views/modifier.js` par
`session.action(...)`.

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
  l'endroit, avant ou après la cible.
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

1. `dataTransfer.getData()` est **vide pendant `dragover`** (règle des navigateurs) : la charge
   utile en cours vit dans une variable de module — fiable ici, un glisser ne quittant jamais la
   page ;
2. une cible qui **refuse** une charge ne doit **pas** appeler `preventDefault()` : le curseur
   « interdit » du navigateur explique le refus mieux qu'un texte ;
3. **`auNiveauEnfant()`** ramène le point de dépôt au niveau des enfants **directs** de la zone.
   Sans lui, viser une pastille existante place le curseur *dans* la pastille : la nouvelle s'y
   imbrique et la lecture du bloc — qui lit le jeton porté par chaque pastille, sans descendre
   dans ses enfants — ne la voit jamais. Le champ paraît alors inséré à l'écran et absent du
   texte enregistré.

Les onglets de l'inspecteur s'appellent **« Ce bloc », « Questions », « Contrôles », « Trame »**
(les identifiants, eux, n'ont pas changé : `bloc`, `champs`, `regles`, `trame`). Le **guide les
nomme de la même façon** (`src/wiki.js`, chapitre *Écrire une trame*) : renommer un onglet oblige
à corriger le guide dans le même mouvement, sinon l'aide désigne un onglet qui n'existe plus.

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

// parler au service comme le fait l'application
const remote = await import("./src/lib/remote.js");
await remote.get("/v1/health");
remote.log;            // le journal : requêtes, réponses, statuts, durées
remote.apiStatus();    // { status: "online" | … }
```

Repères de vérification visuelle : pour l'aperçu, chaque `.paper` doit porter
`--paper-pad` (marges de la feuille) et `data-sheet` (feuille résolue) ; en mode sombre,
`<html data-theme="dark">` et `.paper` doivent garder `--bg: #ffffff` (le papier reste clair) ;
l'écran des feuilles de style se vérifie dans les deux vues (« Réglages » et « Édition
directe »), en 390 × 844 et en 1600 × 950.

## Pièges connus

- **Re-rendu et `blur`** : ne jamais vider ou reconstruire un conteneur de façon
  **synchrone** depuis un gestionnaire `blur` (ni pendant qu'un `removeChild` s'exécute) :
  Chrome lève alors `NotFoundError: Failed to execute 'removeChild' … Perhaps it was
  moved in a 'blur' event handler?`. `clear()` s'appuie sur `replaceChildren()` et
  `redrawView()` diffère/coalesce le rendu.
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
