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
- **Réglage** : `Référentiel › Identité › Mention de démonstration` — *Afficher / Masquer*
  plus un **texte libre** (`brand.demoText`, vide = phrase d'origine). Le basculement
  rafraîchit toute l'application ; la saisie du texte met le bandeau à jour en direct.
- **Portée** : le bandeau marque l'application, **pas les documents produits** (un acte
  exporté ou publié ne porte pas la mention). Si une installation veut marquer aussi ses
  sorties, c'est un autre réglage à ajouter (sortie HTML/Akoma Ntoso).
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
| **Actes** (registre local : numéro, objet, nature, conformité à la trame, statut, parapheur, exécution, export, corbeille) | ✅ |
| **Parapheur** (circuit de validation du référentiel : étapes séquentielles, bon pour accord ou avis, ciblage trame/famille/entité, décisions motivées, empreinte du texte validé, reprise de circuit ; file « à valider par moi ») | ✅ |
| **Exécution & délais** (échéancier des formalités : transmission au contrôle de légalité, publication, notification ; date d'exécutoire, délai de recours, alertes de retard) | ✅ |
| **Recherche globale** (Ctrl+K ou « / » : actes, trames, personnes, services, références, comptes, guide) | ✅ |
| **Corbeille** (suppression réversible des actes et des trames, restauration, suppression définitive) | ✅ |
| **Journal d'audit & historique des brouillons** (tous les faits, filtrables ; vingt versions par acte, restauration) | ✅ |
| **Collaboration** (présence des postes, verrou souple de rédaction, notifications et cloche) | ✅ |
| **Modifier un acte** (l'acte en vigueur est **édité en place**, comme dans un traitement de texte ; la confirmation produit l'acte modificatif + la version consolidée, puis le circuit signature → publication rend la consolidation opposable et supplante l'originale) | ✅ |
| **Signature électronique** (dépôt par API REST, circuit auprès du prestataire, retour de l'acte signé et vérification) | ✅ (démonstration) |
| **Publication & ELI** (version en ligne, identifiant ELI, opposabilité, original signé, registre public) | ✅ (démonstration) |
| **Référentiel** (identité, vocabulaire, numérotation, entités, personnes, rôles, **services et bureaux**, références, mentions, familles, types d'actes, données) | ✅ |
| **Feuilles de style** (charte graphique : marges, typographie, couleurs, logo, en-tête, pied, filets, encadrés, tableaux, signature, cadre ; préréglages ; résolution trame → entité → famille → générale ; **éditeur direct WYSIWYG sur le style**) | ✅ |
| **Apparence claire / sombre** (bouton d'en-tête, choix « Automatique » dans le menu du compte ; préférence de poste, le papier reste blanc) | ✅ |
| **Comptes et rôles** (écran de connexion, 3 rôles, gestion des comptes, **périmètre par service/bureau**, contrôle d'accès) | ✅ (démonstration) |
| **Annuaire de la collectivité (OIDC)** (connexion par le fournisseur d'identité, PKCE, vérification du jeton, groupes → rôles, périmètre par revendications, **désactivation automatique des comptes de démonstration**, annuaire d'essai intégré) | ✅ |
| **Base de données** (pilotes local / service partagé / **serveur MySQL-MariaDB** externe, synchronisation par enregistrement, conflits, file hors ligne) | ✅ |
| **Auto-hébergement** (pile Docker nginx + service Node + MySQL/MariaDB, édition web de l'application, transport HTTP) | ✅ |
| **Bibliothèque de trames partagée / multi-poste** | ✅ (mode partagé ; export/import JSON toujours disponible) |
| **Guide** (wiki intégré : 19 chapitres, glossaire, dépannage, fiche mémo, impression) | ✅ |
| PDF/A certifié, bordereau SEDA | ⏳ |

### Comptes et rôles

L'accès se fait par un **écran de connexion** (« Qui se connecte ? ») qui liste les comptes
disponibles : la simulation d'annuaire/SSO tient lieu d'authentification (aucun mot de passe
— c'est un démonstrateur). La session choisie est mémorisée (`kv.actesSession`) : recharger la
page reconnecte le dernier compte ; *Changer de compte* (menu du compte) ramène à la liste.

Ce mode (« comptes de l'application ») n'est qu'un des deux : le référentiel peut **brancher
l'annuaire de la collectivité** (OpenID Connect), auquel cas les comptes de démonstration sont
**désactivés automatiquement**. Voir « Annuaire de la collectivité (OIDC) » plus bas.

Trois rôles, définis **une seule fois** dans `src/lib/users.js` (`ROLES`, classés par rang) :

| Rôle | Rang | Ce que le rôle débloque |
|---|---|---|
| **Administrateur** | 3 | tout, y compris le **référentiel**, les **comptes et rôles**, l'**API & journal** |
| **Éditeur** | 2 | les **trames** (créer, modifier, commenter ; les feuilles de style des actes à venir), rédiger et gérer les actes |
| **Rédacteur** | 1 | rédiger un acte et mener les actions associées (enregistrer, signer) — **uniquement ses actes** ; choisit son modèle dans « Rédiger un acte » (pas d'accès au registre des trames) |

Les onze permissions (`PERMS`, `src/lib/users.js`) sont la **source unique** du contrôle
d'accès *et* de la matrice affichée dans « Comptes et rôles » : `can(user, perm)` est appelée
partout (nav, boutons, routes). Ajouter une permission, c'est ajouter une ligne à `PERMS` et
l'exiger là où c'est utile — la matrice suit toute seule.

- `state.js` expose `can(perm)`, `currentUser()`, `login()`, `logout()`, `visibleActes()` et
  `visibleTrames()` (filtrent selon le **périmètre**, voir ci-dessous ; un rédacteur ne voit
  en outre que les actes dont il est l'auteur ; `actes.tous` montre tous les actes).
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
- Les comptes sont semés par `seedUsers(config)` (`src/lib/users.js`) — **neuf comptes fictifs**
  rattachés aux services de Valmont-sur-Loire ; `store.js` les sème s'il n'y en a pas
  (`SEED_VERSION`), l'export/import JSON du référentiel les inclut, `clearAll()` les efface.

### Organisation : services, bureaux, périmètre

Le **rôle** dit ce qu'un compte peut *faire* ; le **périmètre** dit *sur quoi*. Deux notions
distinctes, l'une ne remplaçant pas l'autre (`src/lib/scope.js`).

- La collectivité se range en **services** (`config.services = [{ id, code, name, entityId,
  bureaux: [{ id, name }] }]`), chacun subdivisé en **bureaux**. Ils se décrivent dans
  **Référentiel › Services**.
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
politique « refuser » ou rôle de repli si aucun groupe n'est reconnu), périmètre = codes de
**services** et d'**entité** rapprochés de ceux du référentiel, identité depuis `sub` / `email`
/ `given_name` / `family_name`. Un compte est identifié par son `sub` d'annuaire, à défaut par
son adresse ou son identifiant : trouvé, il est repris (rôle et périmètre écrasés si
`authoritative`, l'annuaire faisant foi) ; sinon il est **créé** (`autoProvision`), ou la
connexion est refusée avec un message explicite.

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
« Annuaire (OIDC) » du référentiel), `views/comptes.js` (provenance des comptes, actions
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

### Actes de démonstration

Le jeu de démonstration ne se limite pas au référentiel et aux trames : il pose **onze actes**
(`src/lib/demo-actes.js`), dont **sept rédigés et signés**. Ils sont installés au premier
démarrage — et remis à niveau quand `SEED_VERSION` change — uniquement si les trames sont celles
de la démonstration *et* que le registre ne contient que des actes de démonstration
(`acte-demo-*`) : un registre réel, ou enrichi à la main, n'est jamais touché.

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

### Signature & publication (démonstration)

L'application ne signe ni ne publie elle-même : elle est **cliente d'une API REST**
(exposée par le service, embarquée dans `index.html`).
Le transport est un canal WebSocket, mais la forme des échanges est celle d'une API HTTP
(méthode, chemin, en-têtes, corps JSON, statut, en-têtes de réponse) : `src/lib/remote.js`
construit la requête, l'envoie, journalise l'aller-retour, et gère la reconnexion.

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

**Registre public.** `src/ui/views/publications.js` lit `GET /v1/publications` : la
consultation (version en ligne, métadonnées, versions, original signé) ne dépend pas des
données locales — c'est ce qui donne son sens à l'« opposabilité ». La vérification de la
signature (`verifySignedPackage`) est refaite à l'affichage.

**Limites assumées** : le prestataire est simulé, le certificat n'est pas qualifié eIDAS,
et le service conserve au plus 40 publications (les plus anciennes sont évincées) —
`state` est un `Uint8Array` de taille fixe, rangé en JSON sur une vue UTF-16.

### Le parapheur : un acte est validé avant d'être signé

Un acte ne passe pas directement de la rédaction à la signature. `src/lib/validation.js`
définit un **circuit de validation** : une suite d'étapes **séquentielles**, chacune confiée à
un rôle (« bon pour accord » ou simple « avis »), éventuellement réservée au service de
l'acte. Deux principes gouvernent le module :

1. **Rien n'est codé en dur.** Un circuit est une donnée du référentiel
   (`config.circuits`), réglable dans **Référentiel › Circuits de validation** : nombre
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

### Le caractère exécutoire et les délais

Un acte signé n'est pas encore **exécutoire**. `src/lib/execution.js` décrit les formalités
qui le rendent opposable : **transmission** au contrôle de légalité, **publication** au
recueil, **notification** aux intéressés. Chacune est *requise* ou non selon la trame
(`trame.transmission`, `trame.notification` ; la publication suit la déclaration
« publiable ») et selon la nature de l'acte. La **date d'exécutoire** est celle de la
**dernière formalité requise accomplie** — et c'est de là, et non de la signature, que court
le **délai de recours contentieux** (deux mois par défaut, réglable dans
**Référentiel › Exécution & délais**).

Une formalité n'est pas une déduction : c'est une **attestation de l'agent** (« transmis le
12 mars, accusé @ctes n° … »), horodatée et signée de son auteur, conservée au journal. Le
formulaire de constatation vit dans `src/ui/execution-actions.js`, partagé par l'échéancier
et par la fiche de l'acte. L'écran **Exécution & délais** (`src/ui/views/execution.js`)
classe les actes signés en *formalités à accomplir*, *recours ouvert*, *définitifs*, et
signale les retards (transmission et publication en souffrance, délai de recours qui se
referme). La fiche d'un acte en rappelle l'essentiel.

### Registre : recherche globale, corbeille, journal, versions

- **Recherche globale** (`src/lib/search.js`, `src/ui/global-search.js`) — **Ctrl+K** ou
  **« / »** ouvre une superposition qui cherche dans les actes, les trames, les personnes,
  les services, les références, les comptes et le guide, et se pilote au clavier.
- **Corbeille** (`src/ui/views/corbeille.js`) — la suppression d'un acte ou d'une trame est
  **réversible** (`deletedAt`, `deletedBy`) ; les objets partent à la corbeille, en
  reviennent, ou y sont supprimés définitivement. Les listes ordinaires les ignorent.
- **Journal d'audit** (`src/lib/collab.js`, écran **Référentiel › Journal d'audit**) — tous
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

## Persistance et base de données

L'application ne sait pas *où* sont rangées ses données : elle passe par une
**façade de persistance** (`src/lib/db/index.js`) qui choisit un **pilote**.

| Mode | Pilote | Ce que ça donne |
|---|---|---|
| **Locale — ce navigateur** (défaut) | `db/local.js` (IndexedDB) | mode de démonstration : rien à installer, données propres au poste |
| **Service de démonstration — partagé** | `db/service.js`, transport `socket` | l'état durable du service de démonstration tient lieu de base, sans rien installer ; **partagé** entre postes quand la page est servie par la plateforme, **propre au navigateur** dans l'édition statique (le libellé du mode le dit) |
| **Serveur externe — MySQL / MariaDB** | `db/service.js`, transport `http` | la base de la collectivité, via le service de données de `src/server/mysql/` |

Le réglage vit dans `kv.actesDb` — il est **propre au poste** et n'est jamais
exporté avec le référentiel. L'écran **Référentiel › Base de données** le règle,
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
- la résolution des deux services passe par **`src/lib/hosts.js`**, seul endroit qui sait où
  les chercher. `src/pages/host.js` est sans effet dans l'environnement d'édition et dans le
  déploiement auto-hébergé (il ne s'installe que si les deux manquent). Poser
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
main.pjs                  $meta + les deux services d'exécution (stockage local, API du service)
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
  compile.js              contexte, interpolation {{…}}, règles, article par article, écarts
  redaction.js            adresses d'emplacements (slots), application des écarts, repérage
  render.js               rendu DOM du document compilé (aperçu, impression, export HTML ; suivi des modifications ou mentions)
  export.js               Akoma Ntoso 3.0, Schematron, JSON-LD/ELI, Markdown, HTML, Word, impression
  paper.js                LE PAPIER DES DOCUMENTS : A4 (21 × 29,7 cm), marges, sauts de page
  styles.js               FEUILLES DE STYLE (charte graphique) : modèle, résolution (trame → entité → famille → générale), préréglages, marges du papier, CSS, aperçu
  theme.js                APPARENCE (clair / sombre / automatique) : préférence locale, jetons du document, couleur de marque lisible
  akn.js                  LECTURE d'Akoma Ntoso 3.0 (import d'un acte publié, tolérant aux ns)
  amend.js                modification d'acte : plan, acte modificatif, version consolidée, mentions d'article
  amend-edit.js           édition en place : adresses stables des passages, plan déduit de la saisie
  remote.js               CLIENT de l'API REST : connexion, appel, journal des échanges
  signature.js            cryptographie (ECDSA/SHA-256), original signé, prestataire simulé
  eli.js                  identifiant ELI, opposabilité, version en ligne, JSON-LD de publication
  validation.js           CIRCUIT DE VALIDATION (parapheur) : circuits du référentiel, étapes, décisions, empreinte du texte validé
  execution.js            CARACTÈRE EXÉCUTOIRE : formalités requises, date d'exécutoire, délai de recours, alertes, constatations
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
  hosts.js                OÙ SONT LES DEUX SERVICES D'EXÉCUTION (stockage, canal du service) — point unique
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
src/wiki.js               CONTENU du guide d'utilisation (texte, étapes, captures)
src/ui/
  dom.js                  primitives DOM (h, boutons, champs, modale, info-bulle…)
  components.js           compositions (formulaires, dialogues, états vides)
  brand.js                nom et marque du logiciel (SVG en ligne, currentColor)
  notice.js               bandeau « Démonstration » (affiché tant que brand.demo !== false)
  state.js                état global, routeur (sans toucher au hash), persistance différée
  markdown.js             rendu markdown → DOM (documentation technique)
  parapheur-actions.js    GESTES DU PARAPHEUR partagés (soumettre, décider, reprendre, carte de décision)
  execution-actions.js    CONSTATATION D'UNE FORMALITÉ partagée (formulaire + journalisation + exécutoire)
  global-search.js        RECHERCHE GLOBALE (Ctrl+K ou « / ») : superposition, index, navigation clavier
  collab.js               TÉMOINS DE COLLABORATION dans l'en-tête : présence, cloche de notifications, panneaux
  theme.js                sélecteur d'apparence de la coquille (bouton d'en-tête + menu du compte)
  oidc.js                 annuaire : panneau de connexion, retour du fournisseur, fenêtre d'essai, onglet du référentiel
  app.js                  coquille, navigation, amorçage
  views/trames.js  editor.js  rediger.js  wysiwyg.js  actes.js  modifier.js
  views/amend-editor.js   l'acte publié rendu éditable (l'équivalent de wysiwyg.js pour la modification)
  views/signature.js      circuit de signature + publication ; api-console.js : OpenAPI & journal
  views/publications.js   registre public et consultation d'une version en ligne
  views/parapheur.js      PARAPHEUR : files d'attente du circuit de validation, décisions, reprise
  views/execution.js      EXÉCUTION & DÉLAIS : échéancier des formalités, recours ouverts, actes définitifs
  views/corbeille.js      CORBEILLE : actes et trames supprimés (restauration, suppression définitive)
  views/referentiel.js  aide.js  connexion.js  comptes.js  docs.js
  views/styles.js         feuilles de style : liste, schéma des réglages (GROUPS), éditeur direct WYSIWYG (REGIONS), aperçu d'un acte type
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

`views/docs.js` est la **documentation technique** (menu « Documentation technique », et un
encart en bas du guide) : elle lit les documents du dépôt — `CHANGELOG.md`,
`docs/ADMINISTRATION.md`, `server/README.md`, `SPEC.md`, `README.md`, `TODO.md` — et les
affiche dans l'application
(`ui/markdown.js` les rend en DOM : titres, listes, tableaux, blocs de code), avec sommaire,
impression et téléchargement. Les documents ne sont pas recopiés dans le code : c'est le
fichier qui fait foi, et il est lu tel quel.

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
  qu'un point de départ : le bouton *Référentiel › Données › Vider* le supprime.
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
