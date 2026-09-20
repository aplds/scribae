# Spécification — Scribae (éditeur de trames et d'actes)

> Application web interne : les **administrateurs** préparent des **trames** d'actes administratifs
> (structure + champs + règles + commentaires) ; les **services** les remplissent ;
> le système **compile** l'acte et l'exporte dans des formats ouverts et normés.

## 1. Contraintes fondatrices

1. **Structure-agnostique.** Aucune donnée d'une organisation réelle n'est codée en dur dans
   la logique. Marques, entités (commune, établissements publics, associations, services), personnes,
   fonctions, numérotation, recueil de publication, juridiction de recours, références
   juridiques, vocabulaire (formule d'édiction, intitulé d'article) : **tout est
   configurable** dans le référentiel, exportable/importable en JSON.
   Le fichier `src/lib/seed.js` n'est qu'un **jeu de données initial** — remplaçable.
   Le jeu livré est **fictif** : il configure l'outil pour la **mairie de Valmont-sur-Loire**
   (commune imaginaire) et ses établissements satellites (CCAS, caisse des écoles). Aucune
   donnée réelle, aucune marque réelle.
2. **Le contenu structuré est la source de vérité.** Le PDF, le HTML, le JSON-LD sont
   des *rendus compilés*, jamais l'original.
3. **Rien ne se perd, et chaque chose est signée de son service.** Les commentaires
   (règles, avertissements, veille normative) font partie du document, sont versionnés et
   exportés — ils ne disparaissent plus à l'export, contrairement aux commentaires Word.
   Leur auteur est le **service** du compte qui les a saisis (jamais l'agent : le service
   porte ses règles au-delà des personnes qui s'y succèdent).
4. **UI sobre inspirée du DSFR**, sans la Marianne ni les polices propriétaires :
   tokens de design (couleurs, rayon, focus, espacements) pilotés par la configuration.
5. **Le texte du rédacteur n'est jamais perdu.** Il écrit dans le document, comme dans un
   traitement de texte. Ce qu'il réécrit par rapport au modèle est conservé, signalé
   (« hors trame ») et visible des administrateurs, mais ne bloque rien : adapter une
   rédaction peut être nécessaire, et c'est aux administrateurs d'en tirer les
   conséquences (faire évoluer la trame).
6. **La chaîne de confiance est vérifiable, pas déclarative.** Un acte ne se publie
   qu'après avoir été signé, et le service de publication recalcule lui-même l'empreinte
   du document signé avant de l'accepter : on ne peut pas publier autre chose que ce qui
   a été signé. La signature (ECDSA P-256) et l'horodatage sont vérifiables par n'importe
   qui à partir du certificat, et l'application refait cette vérification à la
   consultation.
7. **Le rangement est interchangeable, et l'hébergement l'est aussi.** L'application ne
   manipule que des *collections* et ignore son support : stockage du navigateur en
   démonstration, état durable partagé du service, ou base MySQL/MariaDB de la collectivité —
   par le même contrat (voir 2.9). Elle ne dépend, pour tourner, que de deux services
   fournis par son environnement d'exécution, que `src/server/` remplace : le logiciel peut
   donc être déployé sur un serveur dédié auto-hébergé, avec sa propre base (voir 2.9.1). Aucune donnée d'un poste n'est écrasée en
   silence par celle d'un autre.

## 2. Modèle de données

### 2.1 Référentiel (`config`)

```js
{
  brand:      { name, shortName, color, colorDark, documentFont, baseUri, logoUrl },
  vocab:      { enact:"DÉCIDE", articleLabel:"Article", recitalsLabel:"Considérant",
                visasLabel:"Vu", recoursLabel, publicationLabel },
  numbering:  { pattern:"{year}-{seq}-{entityCode}", seq:400, pad:3, year:2026,
                eliPattern:"{baseUri}/eli/{actType}/{year}/{seq}/{entityCode}" },
  entities:   [ { id, code, name, legalName, seatCity, kind, orgRefs:[refId], tribunal } ],
  people:     [ { id, civility, firstName, lastName, entityId, roles:[roleId],
                  refs:[{ kind, label }] } ],
  services:   [ { id, code, name, entityId, bureaux:[ { id, name } ] } ],
  roles:      [ { id, label } ],
  refs:       [ { id, kind, label, scope, active, source, date, abrogatedBy } ],
  mentions:   [ { id, kind:"recours"|"publication", label, text } ],
  families:   [ { id, label } ],
  circuits:   [ { id, label, description, active, trameIds:[], familyIds:[], entityIds:[],
                  steps:[ { id, label, role:"editeur"|"administrateur",
                            kind:"accord"|"avis", serviceScoped, optional, help } ] } ],
  delais:     { recoursMois:2, transmissionJours:15, publicationJours:10, notificationJours:8 },
  styles:     [ { id, label, general, entityIds:[], familyIds:[], …présentation } ],
  actTypes:   [ { id, label, aknElement } ],
  colors:     [...]
}
```

### 2.2 Trame (`trame`)

```js
{
  id, name, version, familyId, actTypeId, status,
  description, owner, entityIds:[] , serviceId, bureauId,
  publishable,             // true par défaut ; false = trame non publiable
  styleId,                 // feuille de style (charte) désignée, "" = automatique
  circuitId,               // circuit de validation désigné, "" = automatique, "aucun" = pas de parapheur
  transmission,            // "" (règle générale) | "requise" | "aucune" — transmission au contrôle de légalité
  notification,            // "" (règle générale) | "requise" | "aucune" — notification aux intéressés
  fields: [ Field ], rules: [ Rule ], body: [ Node ]
}

Field = { id, label, type, required, group, help, placeholder, options,
          format, refKind, appliesWhen }

Rule  = { id, level:"blocking"|"warning"|"info", kind:"check"|"inclusion",
          target, expr, message, ref, author, date }

Node  = { id, type, ...propriétés..., when, notes:[Note], amend }

Note  = { id, author, date, kind:"legal"|"instruction"|"question"|"watch",
          text, ruleId }
```

Types de nœuds : `title`, `authority`, `visas`, `considerants`, `enact`, `article`,
`para`, `list`, `table`, `signature`, `mention`, `raw`.

Dans tout texte : `{{chemin}}` (avec filtres `|upper`, `|lower`, `|capitalize`,
`|date-long`, `|date-short`, `|money`).

#### 2.2.1 Fichier de trame (import / export)

Une trame s'échange en JSON (`src/lib/trame-format.js`). L'export (`exportTrame`) produit
`{ kind: "trame", version: 1, trame }`. À l'import, un fichier peut contenir **une** trame
(`{ "trame": {…} }` ou directement `{…}`), **plusieurs** (`{ "trames": [ … ] }`) ou l'exemple
fourni. Seuls `name` et `body` sont **obligatoires** ; `normalizeTrame` complète le reste avec
les valeurs par défaut (`newTrame`) et régénère tous les identifiants — un fichier peut donc
être recopié ou dupliqué. Le bouton « Fichier d'exemple » télécharge `trame-exemple.json` : un
bloc `aide` documente chaque clé, chaque type de bloc/champ/règle/commentaire et les jetons, et
un bloc `trame` est un exemple complet et valide. Les erreurs bloquantes sont listées avant tout
import ; les corrections automatiques (type inconnu, valeur par défaut) sont signalées après.

#### 2.2.2 Feuille de style (charte graphique des décisions)

Une **feuille de style** décrit la **présentation** d'un acte — jamais son fond. Elle vit dans
le référentiel (`config.styles`) et s'édite dans l'écran « Feuilles de style »
(`trames.styles`) :

```js
FeuilleDeStyle = {
  id, label, general:false, entityIds:[], familyIds:[],

  // papier : marges en millimètres, cadre de page
  pageMarginTop, pageMarginRight, pageMarginBottom, pageMarginLeft,
  frameStyle, frameWidth, frameColor, frameSpace,

  // typographie
  fontFamily, fontSize, lineHeight, justify, letterSpacing, hyphens,
  paraIndent, paraSpacing, articleSpacing,

  // couleurs
  color, ink, muted, ruleColor,

  // intitulé de l'acte
  titleFont, titleSize, titleWeight, titleCase, titleAlign, titleRule,
  titleColor, titleSpacing, titleMargin,

  // formule d'autorité
  authorityAlign, authorityItalic, authoritySize,

  // intitulés d'article
  headingFont, headingSize, headingWeight, headingColor, headingCase,
  headingRule, articleNumberLayout,          // inline | block | margin

  // visas et considérants
  visasIndent, visasBullet, visasLabelStyle, recitalsIndent, recitalsItalic,

  // listes
  listMarker, listIndent,

  // filets, encadrés, tableaux
  ruleStyle, ruleWidth, articleDivider, enactStyle, enactCase,
  mentionStyle, mentionSize, mentionItalic,
  tableStyle, tableFontSize, tableCellPadding, tableCaptionAlign, tableCaptionCase,

  // signature
  signatureAlign, signatureStyle, signatureSpace, signatureWidth,
  signatureFunctionItalic, signatureNameWeight,

  // en-tête et pied de page
  showHeader, logoUrl, logoHeight, logoAlign, headerText, headerRule,
  headerSize, headerItalic, headerCase,
  showFooter, footerText, footerAlign, footerSize, footerItalic,
}
```

Il y a **une** feuille `general: true` (le défaut) et, en plus, des **sous-feuilles** rattachées
facultativement à des **entités** et/ou des **familles d'actes**. La résolution
(`src/lib/styles.js`), du plus précis au plus général :

1. la **trame** (`trame.styleId`, repris dans `doc.meta.styleId`) ;
2. l'**entité** signataire (`doc.meta.entity.id`) ;
3. la **famille** de la trame (`doc.meta.familyId`) ;
4. la **feuille générale**.

Sans aucune feuille (référentiel hérité), `legacyStyleFromBrand()` dérive une feuille de
l'identité de la marque : le comportement historique est préservé. Une feuille enregistrée avant
l'ajout d'un réglage reçoit le défaut de ce réglage (`emptyStyle`), sans migration forcée.

L'écran « Feuilles de style » propose **deux vues sur un même schéma** : « Réglages » (tous les
réglages, par thème) et « **Édition directe** » — un éditeur **WYSIWYG sur le style uniquement** :
on clique l'élément dans l'aperçu (intitulé, tableau, en-tête…), et seuls ses réglages
apparaissent. Le texte de l'acte n'y est jamais modifiable. Des **préréglages**
(`STYLE_PRESETS` : classique préfectoral, moderne, solennel, sobre, recueil communal, acte
individuel) donnent un point de départ complet, sans toucher au nom, au rattachement ni au logo
de la feuille.

**Marges du papier** : elles font partie de la feuille (`pageMarginTop`… en millimètres). Dans
les documents exportés, `styleCss` les écrit sur `.paper` (`padding`) **et** dans la règle
`@page` (`paperPageCss`), qui fixe les marges du PDF ; le fichier Word les reçoit via
`wordMargin` (en centimètres). Dans l'aperçu, où `@page` ne peut pas servir (plusieurs papiers
par page), chaque vue pose `--paper-pad` sur son `.paper` (`applyPaper`, `lib/render.js`).
L'impression directe de l'aperçu (Ctrl+P) prend les marges de la feuille **générale**
(`generalPageCss`, injectée dans `#sheet-print-css` par `applySheets`).

`styleCss(style, config, {scope})` produit le CSS de la feuille ; `scope` le confine à un
document (`[data-sheet="…"]`) dans l'aperçu de l'application — les documents portent
`data-sheet` sur leur racine `.doc`. Ce même CSS habille **tous** les rendus, pour que le
document ne se présente pas autrement selon le support :

| Support | Chemin |
|---|---|
| Aperçu de rédaction, de modification, fiche d'acte | `renderDocument` + `styleCss` (scope `[data-sheet]`) injecté par `state.applySheets()` |
| HTML autonome, fichier Word | `documentCss(config, style)` (`src/lib/export.js`) |
| Impression / PDF | `printDocument` → `exportStandaloneHtml` → même CSS |
| Original signé (prestation de signature) | `originalPageHtml(pack, pageHtml, brand, pageCss)` (`src/lib/signature.js`) |
| Version en ligne publiée (ELI) | `buildWebVersion` → `documentCss` (`src/lib/eli.js`) |

L'en-tête (logo + ligne de recueil) et le pied de page font partie du rendu : `renderDocument`
les ajoute au document à partir de la feuille, et leur texte accepte des jetons
(`{{entity.name}}`, `{{numero}}`, `{{dateSignature}}`, `{{objet}}`, `{{actType}}`,
`{{style.label}}`). Un acte type (`sampleDocument`) sert d'aperçu dans l'écran de réglage.
Une feuille s'exporte/s'importe en JSON (`{ "feuille": { … } }`).

### 2.3 Règles (le cœur)

Trois niveaux :
- **blocking** : empêche l'export (« la date d'effet ne peut précéder la signature ») ;
- **warning** : signale sans bloquer ;
- **inclusion** : conditionne la présence d'une clause/un visa/un article.

Les expressions sont écrites dans un **langage d'expression sûr** (`src/lib/expr.js`) :
pas d'`eval`, identifiants résolus dans un contexte, opérateurs
`? : || && ! == != < <= > >= in contains + - * / %`, littéraux, listes, et un jeu
de fonctions (`exists`, `empty`, `len`, `contains`, `matches`, `today`, `date`,
`diff_days`, `money`, `lower`, `upper`, `sum`, `count`, `any`, `all`).

Ce langage sert **les trois usages** : condition d'affichage d'un nœud, contrôle
métier bloquant, et génération partielle de **Schematron** pour la validation
externe du XML.

### 2.4 Acte et écarts de rédaction

Un acte rédigé à partir d'une trame n'est pas seulement un jeu de valeurs :

```js
Acte = { id, trameId, numero, objet, entityId, serviceId, bureauId, dateSignature, statut,
         values: { …, __entityId, __overrides: { [adresse]: "texte source" } },
         overrides: { [adresse]: "texte source" },   // recopie lisible de __overrides
         ecarts:    [ { addr, label, original, current } ],
         issues: [], eli, createdAt, updatedAt }
```

Une **adresse d'emplacement** désigne un texte précis de la trame :

| Adresse | Ce qu'elle désigne |
|---|---|
| `body.3` | le texte du bloc n°3 (`title`, `authority`, `enact`, `para`, `raw`, mention) |
| `body.3.heading` | l'intitulé de l'article n°3 |
| `body.3.blocks.1` | le texte du paragraphe n°1 de l'article n°3 |
| `body.2.items.0` | le texte du visa / considérant / élément de liste n°0 |
| `body.5.caption` · `.columns.1` · `.rows.0.2` | légende, titre de colonne, cellule |
| `body.7.place` | le lieu du bloc signature |

`__overrides[adresse]` conserve le **texte source** du rédacteur — jetons `{{…}}`
préservés — uniquement lorsqu'il diffère du texte de la trame (sinon la clé est
supprimée). `compile()` applique ces écarts au bloc **avant** de l'interpréter :
remplir un champ (donc la valeur d'un jeton) ne crée jamais d'écart.

Ces écarts sont dits **« hors trame »** : le texte du rédacteur est conservé, signalé,
non bloquant, et visible des administrateurs (registre, fiche de l'acte, éditeur de
trame). Ils sont exportés dans `meta/proprietary/ia:redaction` d'Akoma Ntoso et dans le
JSON de l'acte — **jamais** dans le corps du document publié, et jamais inventés comme
éléments Akoma Ntoso standard. Ils n'entrent pas dans les `issues`, qui restent les
contrôles de la trame.

### 2.5 Modification d'un acte

Un acte signé ne se réécrit pas : il se modifie. L'écran « Modifier un acte » n'est pas un
formulaire : c'est **l'acte en vigueur lui-même**, rendu éditable comme dans un traitement
de texte (passages `contenteditable`, abrogation et insertion d'article d'un clic). Chaque
geste est traduit en amendement (`src/lib/amend-edit.js`, adresses stables calculées sur le
document d'origine), puis `buildModificatif` produit l'**acte modificatif** et
`buildConsolidated` la **version consolidée** lorsque la modification est confirmée. La
version consolidée est présentée par défaut dans sa **seule rédaction en vigueur**, chaque
article modifié portant sous son intitulé la mention de l'acte qui l'a modifié (« Modifié par
la décision n°… du … », « Abrogé par … », « Ajouté par … ») ; l'affichage du **suivi des
modifications** (ajouts et suppressions apparents `ins`/`del` + tableau des modifications) est
une option, décochée par défaut, portée par le document (`meta.consolidated.showChanges`) et
appliquée partout où le document est rendu (aperçu, exports, pièce signée, version en ligne).
L'acte modificatif suit le circuit
ordinaire : signature, puis publication sous son propre ELI. Sa publication publie
automatiquement la version consolidée **sous l'ELI de l'acte d'origine**, qui **supplante**
celui-ci : l'originale reste accessible dans l'historique des modifications (fiche de
l'acte, onglet « Versions » du registre public). Un acte importé (`.akn.xml` ou JSON) est
relu par `src/lib/akn.js`.

### 2.6 Signature et publication (démonstration)

Deux écrans, deux services distincts de l'éditeur :

**Signature.** L'application est un **client de l'API REST** du service ; elle n'écrit rien
elle-même. Le service expose :

| Méthode | Ressource | Rôle |
|---|---|---|
| `POST` | `/v1/actes` | déposer l'acte finalisé (Akoma Ntoso) ; idempotent tant que le circuit est ouvert |
| `POST` | `/v1/actes/{id}/signature` | ouvrir un circuit auprès du prestataire → `202` + `signatureId` |
| `POST` | `/v1/webhooks/signature` | notification entrante du prestataire : retour de l'acte signé |
| `GET` | `/v1/signatures/{id}` | suivre le circuit (`en_attente`, `signee`, `refusee`, `rejetee`) |
| `GET` | `/v1/signatures/{id}/document-signe` | récupérer l'original signé |
| `POST` | `/v1/actes/{id}/publication` | publier et attribuer l'ELI |
| `GET` | `/v1/publications`, `/v1/publications/{cle}`, `/v1/eli/{...}` | registre public et résolution ELI |

Les lectures sont publiques ; les écritures exigent `Authorization: Bearer <jeton>`
(`401` sans jeton, `403` si le jeton est invalide, `429` au-delà de 90 écritures par
minute et par réseau, `409` pour un acte déjà signé **ou dont le circuit de validation
n'est pas achevé** (`409 validation_incomplete` — voir § 2.8.1), `422` si la date de
publication précède la signature). `POST /v1/actes/{id}/publication` accepte un en-tête
`Idempotency-Key`.

**Trames non publiables (actes individuels).** Une trame peut être déclarée
`publishable: false` (onglet « Trame » de l'éditeur ; défaut `true`). Les actes qui en
sont issus — les **actes individuels** : revalorisation d'un traitement, sanction
disciplinaire, décision nominative… avec quelques exceptions — sont rédigés, signés,
conservés et exportés, mais **jamais publiés** : ils ne reçoivent pas d'ELI et ne sont
pas déposés au recueil. Le service ne connaissant pas les trames, le client lui
transmet le drapeau à chaque `POST /v1/actes` (`publishable`) ; `hPublier` refuse alors
la publication par `409 acte_non_publiable` (contrôle après celui de la signature).
L'écran « Publication (ELI) » sépare ces actes dans une file « Actes non publiables
(conservés) » ; ils ne se modifient pas par acte modificatif (rien de publié à
consolider) mais par **correction directe**. L'état se lit à la trame courante, donc
une trame rendue non publiable le devient aussi pour les actes déjà rédigés à partir
d'elle. Les actes sans trame (importés, modificatifs, consolidés) restent publiables.

Le **webhook** n'est pas cru sur parole : le service recalcule l'empreinte SHA-256 du
document signé et la compare à celle du document déposé (`409 empreinte_divergente`
sinon, et le circuit est marqué `rejetee`).

L'**original signé** est un paquet (`application/vnd.actes.original-signe+json`) :
document Akoma Ntoso figé + empreinte, signatures (signataire, certificat, valeur ECDSA
P-256, date), horodatage, et la page HTML consultable. La vérification (empreinte,
signature par la clé publique du certificat, jeton d'horodatage) est refaite à la
consultation.

**Publication.** La publication dépose la **version en ligne** (page HTML autonome),
attribue l'**identifiant ELI** (`eli:/fr/{code}/{année}/{n°}/{entité}`), fixe la **date de
publication** et la **date d'opposabilité** (le lendemain de la publication par défaut,
ou après *n* jours — réglable), et conserve l'original signé. Les versions successives
d'un même acte partagent le même ELI : c'est le même « work », seules les expressions
datées diffèrent. La consultation publique est un client de `GET /v1/publications` :
rien n'est lu dans les données locales.

Si le service ne connaît pas l'acte au moment de publier (il a redémarré, ou l'acte a été
signé sur un autre poste), le client le **redépose** avec sa signature déjà approuvée —
le service revérifie l'empreinte — puis republie.

**Jeu de démonstration.** Le registre est livré garni (`src/lib/demo-actes.js`) : **onze
actes**, dont **sept rédigés et posés comme signés** (document compilé depuis sa trame,
exporté en Akoma Ntoso, signé par `buildSignedPackage` — certificat, ECDSA P-256,
horodatage, donc vérifiables), trois prêts à signer et un brouillon incomplet. Deux de
ces actes sont des **actes individuels non publiables** (trame `tpl-revalorisation`,
`publishable: false`), l'un signé et l'autre prêt à signer. Ils ne sont posés que sur un
registre de démonstration vide (`SEED_VERSION`, identifiants `acte-demo-*`) : jamais sur
un registre réel.

### 2.7 Comptes et rôles

L'accès à l'application est **authentifié** : on ouvre une session sous un **compte**, et ce
compte porte un **rôle**. Trois rôles, du plus large au plus restreint :

| Rôle | Vocabulaire | Ce que le rôle ouvre |
|---|---|---|
| **Administrateur** | « l'informaticien » | tout le back-office : référentiel, trames, comptes et rôles, connexion des API ; il **crée et supprime les comptes** et **voit tout, quel que soit le service** |
| **Éditeur** | rédacteur en chef | rédiger les **trames** de son périmètre, les modifier, les commenter, et régler les **feuilles de style** des actes (charte graphique) ; rédiger et gérer les actes de son périmètre |
| **Rédacteur** | agent | **rédiger un acte** à partir d'une trame de son périmètre et mener les actions associées (enregistrer, signer) — **uniquement ses propres actes** ; il choisit son modèle dans « Rédiger un acte » (le registre des trames, `trames.voir`, est réservé aux éditeurs et aux administrateurs) |

Le contrôle d'accès repose sur des **permissions** nommées (`trames.voir`, `trames.gerer`,
`trames.styles`, `actes.rediger`, `actes.gerer`, `actes.tous`, `signature.gerer`,
`referentiel.gerer`, `comptes.gerer`, `api.gerer`), chacune accordée à un ensemble de rôles.
Une seule table dans `src/lib/users.js` (`PERMS`) sert à la fois de **source d'autorité** pour
`can(user, perm)` et de contenu à la **matrice des droits** affichée dans l'écran « Comptes et
rôles ». Les vues n'ont pas de logique de rôle en dur : elles interrogent `can()`.

**Le rôle et le périmètre sont deux axes distincts.** Le rôle dit ce qu'un compte peut *faire*
(permissions) ; le **périmètre** dit *sur quoi* (services et bureaux). Un rédacteur n'accède
qu'aux trames et actes de son périmètre ; un éditeur également, sauf s'il est **transverse**.
Seul l'administrateur échappe au périmètre (il voit tout). Voir la section « Organisation »
ci-dessous.

Le modèle d'un compte :

```js
{ id, firstName, lastName, login, role, entityId, email,
  memberships: [ { serviceId, bureaux } ],   // bureaux: null = tous ceux du service
  active, createdAt, lastLoginAt, note }
```

### 2.7.1 Organisation : services, bureaux, périmètre

La collectivité se range en **services** (`config.services`), eux-mêmes subdivisés en
**bureaux**. Chaque **trame** et chaque **acte** est affecté à un service (`serviceId`) — et,
si besoin, à un bureau précis (`bureauId`) ; `null` désigne une trame/acte **général**, visible
par tout le monde.

Un compte porte un ou plusieurs **rattachements** (`user.memberships`), chacun à un service :

- `bureaux: null` (ou absent) — l'accès couvre **tous les bureaux** du service. C'est le
  comportement par défaut quand l'administrateur ajoute un compte à un service ;
- `bureaux: ["bur-…"]` — l'accès est **restreint** à ces bureaux seulement, au choix de
  l'administrateur ;
- un compte ajouté à **tous** les services est dit **transverse** : il travaille sans frontière
  de service (cas du directeur des affaires juridiques dans la démonstration).

`src/lib/scope.js` centralise les règles et les libellés : `inScope(target, user)` (admin :
toujours vrai ; cible générale : vrai ; sinon les *memberships* doivent couvrir le service et le
bureau), `serviceById`, `bureauxOf`, `servicesInScope`, `bureauxInScope`, `coveredBureaux`,
`servicesOf`, `scopeLabel`, `primaryServiceName`, `targetLabel`, `newService`, `newBureau`.
`state.js` s'en sert dans `visibleTrames()` et `visibleActes()`.

Les services/bureaux se décrivent dans **Référentiel › Services** ; le périmètre se règle dans
**Comptes et rôles** (colonne « Périmètre », éditeur à cases, boutons « tous les services » /
« retirer tous les accès »). Supprimer un service retire les rattachements correspondants.

Les **migrations** sont **additives** (`store.js`) : un référentiel antérieur à cette notion
reçoit les services de démonstration — les trames de démonstration existantes y sont rattachées
— et les comptes de démonstration sans `memberships` sont re-semés. `SEED_VERSION` reste
inchangé : les migrations sont idempotentes et ne touchent pas aux données d'un utilisateur.

La **session** (identifiant du compte courant) est conservée en `kv` ; un compte désactivé ou
supprimé met fin à la session. Les actes enregistrés mémorisent leur auteur (`createdBy`,
`createdByName`) et leur affectation (`serviceId`, `bureauId`) : le registre d'un rédacteur se
limite à ses actes, et le registre de tout compte se limite à son périmètre.

> **Démonstrateur.** L'authentification est **simulée** par défaut : l'écran de connexion liste
> les comptes et un clic ouvre la session, sans mot de passe. Le jeu de démonstration
> (`seedUsers`) crée **neuf comptes fictifs** rattachés aux services de Valmont-sur-Loire (dont
> un compte transverse).
>
> Le référentiel peut **brancher l'annuaire de la collectivité** (OpenID Connect) : voir
> § 2.7 bis. Le brancher **désactive automatiquement les comptes de démonstration**.

### 2.7 bis Annuaire de la collectivité (OpenID Connect)

Le mode d'authentification est un **réglage du référentiel** (`config.auth`) :
`demo` (comptes de l'application) ou `oidc` (annuaire). Ce réglage voyage avec l'export.

**Exigences.**

1. **Client public.** L'application ne détient **aucun secret** : flux *code d'autorisation*
   avec **PKCE (S256)**, `state` et `nonce` aléatoires par tentative, conservés dans
   `sessionStorage`. Aucun `client_secret` n'est stocké, nulle part.
2. **Vérification avant session.** Le `id_token` est refusé si : algorithme symétrique ou
   `none`, `iss` différent de l'émetteur configuré, `aud` sans l'identifiant client, `exp`
   dépassé, `iat` dans le futur, `nonce` différent, ou signature non vérifiable (clés
   `jwks_uri`, RS/PS/ES) — sauf désactivation explicite de ce dernier contrôle. Chaque
   contrôle est affiché à l'administrateur après une connexion réelle.
3. **Groupes → rôle.** Le rôle est le **premier groupe reconnu** (`roleClaim`, chemin pointé :
   `groups`, `realm_access.roles`…) selon `roleMap`. Aucun groupe reconnu : **refus** (défaut)
   ou rôle de repli. Le périmètre (services, entité) suit des revendications dont les codes
   sont rapprochés du référentiel.
4. **Désactivation automatique des comptes de démonstration.** Brancher l'annuaire
   (`disableDemo`, défaut vrai) désactive les comptes du jeu de démonstration :
   - l'écran de connexion ne les propose plus ;
   - `accountUsable()` les refuse à l'ouverture de session, à la reprise de session au
     démarrage, et dans `login()` ;
   - ils sont marqués « Désactivé (annuaire) » dans **Comptes et rôles**.
   Le calcul est **dérivé du mode** (idempotent, rejoué à chaque démarrage et à chaque écriture
   de la liste) et **réversible** : revenir à `demo` réactive les seuls comptes désactivés par
   ce mécanisme (`deactivatedBy: "oidc"`).
5. **Reprise des comptes existants.** Un compte est identifié par son `sub` d'annuaire, à
   défaut par son adresse (ou son identifiant) : il est alors **repris** — son historique,
   ses actes et ses trames restent les siens — et devient un compte d'annuaire. Un agent
   inconnu est créé si `autoProvision`, sinon refusé avec un message explicite.
6. **Annuaire d'essai.** `test: true` (ou émetteur vide) branche un annuaire local aux mêmes
   revendications, sans réseau (jetons non signés, annoncés comme tels) : il sert à régler la
   correspondance des rôles et à vérifier la désactivation des comptes de démonstration, et
   évite de rester bloqué à l'écran de connexion faute de fournisseur.
7. **Porte de secours.** Un repli depuis l'écran de connexion ramène au mode `demo`
   (`allowRecovery`, défaut vrai), sauf si l'administrateur l'a retiré.

**Portée honnête.** L'application est un client : ces contrôles sont des contrôles
*d'interface*. La barrière réelle reste le **service de données** (jeton d'API, réseau, SSO
placé devant l'application). C'est écrit tel quel dans `docs/ADMINISTRATION.md`.

**Écrans.** Écran de connexion (`views/connexion.js`), panneau de connexion et retour du
fournisseur (`ui/oidc.js`), onglet **Référentiel › Annuaire (OIDC)** (mode, fournisseur,
correspondance des groupes, porte de secours), **Comptes et rôles** (provenance des comptes,
actions masquées quand l'annuaire est branché).



Une installation de démonstration doit **se voir** : un bandeau orange « Démonstration »
(avec une phrase d'explication) est affiché **en tête de l'application**, au-dessus de
l'en-tête, sur l'écran de connexion comme une fois connecté.

Le réglage vit dans le référentiel, sous `brand.demo` (booléen) et `brand.demoText` (texte
libre, facultatif) :

- affiché tant que `brand.demo !== false` — **l'absence du réglage vaut « démonstration »** :
  une installation neuve, un référentiel importé ou des données effacées réaffichent le
  bandeau. On ne peut donc pas produire des actes réels dans une démonstration par simple
  oubli ;
- coupé par l'**administrateur** (`Référentiel › Identité › Mention de démonstration`) au
  moment où l'installation est **adaptée en production** ; le réglage suit le référentiel
  exporté/importé ;
- il marque **l'application, pas les documents** : un acte exporté, publié ou imprimé ne
  porte pas la mention.

## 2.8 Parapheur, exécution et registre

### 2.8.1 Circuit de validation (le parapheur)

Un acte n'est pas signé à l'issue de sa rédaction : il franchit un **circuit de validation**,
défini dans le référentiel (§ 2.1 `circuits`) et résolu par `circuitFor` — le circuit désigné
par la trame, sinon le plus **spécifique** des circuits actifs correspondant à la trame, à sa
famille d'actes et à l'entité signataire. Sans circuit applicable, l'acte part directement en
signature (comportement historique préservé).

```js
Validation = { circuitId, circuitLabel, statut:"en_cours"|"valide"|"refuse"|"renvoye",
               demarreLe, demarrePar, demarreParNom, empreinte, closLe,
               steps:[ { id, label, role, kind:"accord"|"avis", serviceScoped, optional,
                         statut:"en_attente"|"valide"|"refuse"|"renvoye"|"passe",
                         by, byName, at, comment } ] }
```

Règles :

- le circuit est **séquentiel** : seule l'étape ouverte est proposée à la décision ;
- une étape **facultative** peut être passée (`passe`) ; une étape d'**avis** est consultative ;
- un **renvoi** ou un **refus** doit être **motivé** (l'observation est obligatoire) ;
- le circuit est **achevé** quand toutes les étapes obligatoires sont `valide` ou `passe` ;
- l'**empreinte du texte validé** porte sur `values` + `overrides` (FNV-1a 2×32 bits). Si
  l'acte est réécrit après la validation, celle-ci est **caduque** : elle ne vaut plus, et le
  circuit doit être repris ;
- **porte de signature** : un acte dont la validation n'est pas `valide` (ou qui est caduque)
  ne peut pas être envoyé en signature — refus côté client, ET refus du service
  (`409 validation_incomplete`). L'état du parapheur est transmis au dépôt sous une forme
  réduite (statut, libellé, empreinte, `closLe`, sort de chaque étape) ;
- une **reprise de circuit** repart de la première étape ; les décisions précédentes restent
  lisibles dans le journal.

L'écran **Parapheur** présente quatre files : *à valider par moi*, *en cours*, *validés*,
*renvoyés ou refusés* — plus les actes hors circuit. La fiche d'un acte rappelle son circuit,
la trace des décisions (auteur, date, observation) et propose la décision quand l'étape est
de votre ressort.

### 2.8.2 Caractère exécutoire et délais

Un acte signé n'est pas encore **exécutoire**. Il le devient lorsque la dernière **formalité
requise** est accomplie. Trois formalités (`src/lib/execution.js`) :

| Formalité | Requise quand | Effet |
|---|---|---|
| **Transmission** au contrôle de légalité | par défaut oui ; `trame.transmission` peut forcer `requise` ou `aucune` | fait courir le délai de deux mois du représentant de l'État |
| **Publication** au recueil | la trame est `publishable` | rend l'acte opposable aux tiers ; constatée par la chaîne ELI |
| **Notification** aux intéressés | par défaut oui pour un acte **non publiable** (acte individuel) ; `trame.notification` peut forcer | rend l'acte opposable à la personne concernée |

La **date d'exécutoire** est la date de la dernière formalité requise accomplie. Le **délai
de recours contentieux** court de cette date (`config.delais.recoursMois`, deux mois par
défaut). Les autres délais (`transmissionJours`, `publicationJours`, `notificationJours`)
sont des **objectifs de gestion** : ils alimentent les alertes de retard, ils ne bloquent
rien.

Une formalité est une **constatation**, pas une déduction : l'agent l'atteste (date,
référence, modalité, destinataires le cas échéant), l'application l'horodate, la signe de son
auteur et la journalise. Elle peut être **corrigée** ou **effacée** (le journal garde l'un et
l'autre). L'écran **Exécution & délais** classe les actes signés en *formalités à accomplir*,
*recours ouvert*, *définitifs* et *tous*, avec les alertes correspondantes.

Statuts d'exécution : `brouillon` (non signé), `en_attente` (formalités requises manquantes),
`executoire` (recours ouvert), `definitif` (délai de recours échu).

### 2.8.3 Registre : recherche, corbeille, journal, versions

- **Recherche globale** (`GET` n'a pas d'équivalent serveur : l'index est construit en
  mémoire, `src/lib/search.js`) — ouverte par **Ctrl+K** ou **« / »** ; elle indexe actes,
  trames, personnes, services, références, comptes et chapitres du guide, et se pilote au
  clavier (flèches, Entrée, Échap).
- **Corbeille** — la suppression d'un acte ou d'une trame est **réversible** : `deletedAt`,
  `deletedBy`, `deletedByName`. Les listes ordinaires filtrent les objets en corbeille ;
  l'écran **Corbeille** permet la **restauration** et la **suppression définitive** (laquelle
  est journalisée). Les deux gestes écrivent au journal.
- **Journal d'audit** — collection `journal` (300 dernières entrées) : `{ id, at, action,
  cible, cibleLabel, acteId, detail, to, by, byName, role }`. `to` désigne les destinataires
  de la **notification** : un identifiant de compte, `role:<rôle>`, `service:<service>`, ou
  `tous`. L'écran **Référentiel › Journal d'audit** affiche tous les faits, du plus récent au
  plus ancien, avec recherche plein texte.
- **Historique des brouillons** — `acte.revisions` (vingt dernières) : à chaque
  enregistrement, l'état **précédent** est conservé (valeurs, écarts, libellé, auteur, date).
  La restauration d'une version archive d'abord l'état courant : **rien ne se perd**. La
  validation, si elle existait, devient caduque et devra être reprise.

Actions journalisées (libellés de l'écran) : `parapheur.depot`, `parapheur.accord`,
`parapheur.passe`, `parapheur.renvoi`, `parapheur.refus`, `parapheur.reprise`,
`signature.depot`, `signature.signe`, `signature.refus`, `publication.publie`,
`formalite.transmission`, `formalite.publication`, `formalite.notification`,
`formalite.effacement`, `acte.creation`, `acte.enregistrement`, `acte.restauration`,
`corbeille`, `restauration`, `suppression`.

### 2.8.4 Collaboration

Trois signaux, réunis dans la collection `presence` et le journal :

- **Présence** (`src/lib/collab.js`) — un enregistrement par poste (`userId`, `byName`,
  `role`, `serviceId`, `at`, `ecran`, `acteId`, `acteLabel`), battement toutes les **25 s**,
  poste considéré **en ligne** si vu depuis moins de **70 s**. Diffusion par
  `BroadcastChannel` (même navigateur) et sondage de **30 s** ; un départ propre marque
  l'enregistrement comme ancien. Le battement est suspendu quand l'onglet est masqué.
- **Verrou souple de rédaction** — l'écran de rédaction annonce « Cet acte est ouvert sur un
  autre poste » ; c'est un **avertissement**, pas une exclusion : deux personnes peuvent
  travailler sur le même acte, la synchronisation par révision les départagera.
- **Notifications** — la **cloche** de l'en-tête compte les faits non lus destinés au compte
  (`to`), et un panneau les liste ; « tout marquer comme lu » est mémorisé par compte.

`journal` et `presence` sont des collections **silencieuses** : leurs conflits ne
déclenchent pas de toast, et le service MySQL ne les recopie pas dans `sb_journal` (ce sont
elles-mêmes des flux).

## 2.9 Persistance et base de données

L'application ne connaît pas son support de rangement : elle s'adresse à une
**façade de persistance** (`src/lib/db/index.js`) qui délègue à un **pilote**.

| Mode | Pilote | Nature |
|---|---|---|
| **Locale — ce navigateur** (défaut, démonstration) | `db/local.js` (IndexedDB) | non partagé, propre au poste |
| **Service de démonstration — partagé** | `db/service.js`, transport `socket` | partagé via l'état durable du service de démonstration |
| **Serveur externe — MySQL / MariaDB** | `db/service.js`, transport `http` | la base de la collectivité, via `src/server/mysql/` |

**Modèle.** Huit collections : `config`, `meta` (objets uniques), `trames`,
`actes`, `users`, `journal`, `presence` (listes d'objets identifiés par `id`), et
`session` (**strictement locale**). `journal` et `presence` sont **silencieuses** :
leurs conflits ne déclenchent pas de toast (ce sont des flux, pas des documents).
L'unité d'échange est l'**enregistrement** : un objet
de liste, ou l'objet unique d'un singleton (id `self`) ; `ord` porte la position.

**Synchronisation.** Chaque écriture est comparée à l'index connu du serveur
(comparaison JSON canonique) ; seuls les enregistrements modifiés sont envoyés,
chacun avec la **révision** connue du client. Le serveur refuse tout
enregistrement dont la révision a changé et renvoie sa version : c'est un
**conflit**, que l'application reprend en le signalant (le serveur gagne — jamais
d'écrasement silencieux). Les écritures concurrentes sur des enregistrements
*différents* sont indépendantes.

**Résilience.** Miroir local des dernières lectures (`kv.actesMirror`) : la
lecture se poursuit sur les données connues si la base est injoignable. File
d'écritures différées (`kv.actesPending`) rejouée dès que la base répond. Un
refus d'authentification (401/403) n'est jamais mis en file.

**Contrat REST** implémenté par le service de démonstration (`index.html`) et par
le serveur MySQL (`src/server/mysql/server.mjs`) :

```
GET  /v1/db/health                        → { statut, driver, collections:{ nom:{records, revision} } }
GET  /v1/db/collections/{collection}      → { collection, revision, records:[{ id, rev, ord, payload }] }
POST /v1/db/collections/{collection}/sync → { upserts:[{id,rev,ord,payload}], deletes:[{id,rev}], force }
                                          ← { collection, revision, applied:[{id,rev}], conflicts:[{id,rev,ord,payload}|{id,deleted:true}] }
```

Les écritures exigent un jeton (`Authorization: Bearer`) ; le service n'en
conserve que l'empreinte SHA-256. Le serveur MySQL recopie dans des colonnes
indexées les champs utiles aux recherches (`numero`, `statut`, `service_id`,
`bureau_id`, `entity_id`, `kind`) et journalise chaque écriture dans
`sb_journal` : la base demeure interrogeable en SQL (vues `v_acte`, `v_trame`,
`v_collection`).

**Réglage.** `kv.actesDb` — propre au poste, jamais exporté avec le référentiel,
jamais partagé. Écran **Référentiel › Base de données** (réservé à
`referentiel.gerer`) : choix du mode, adresse et jeton, test de connexion,
transfert de données dans les deux sens.

### 2.9.1 Auto-hébergement

L'application ne dépend, pour tourner, que de **deux services** fournis par son environnement
d'exécution ; le dossier `src/server/` les remplace et fournit une installation complète :

| Service d'exécution | Équivalent fourni |
|---|---|
| `root.kv` (stockage clé/valeur local) | `server/web/host.js` — stockage **IndexedDB** du navigateur |
| `root.createServerSocket` (API du service) | **HTTP** vers `/v1/…` (`remote.js`, transport `http`) |

La pile (`server/docker-compose.yml`) réunit trois conteneurs sur un réseau interne : `web`
(nginx, sert l'application et proxy `/v1/`), `api` (le service Node de `server/mysql/`, qui
porte **les deux** familles de ressources — données et signature/publication — et parle à
MySQL) et `db` (MariaDB). Ni `api` ni `db` ne publient de port. La base peut aussi être
hébergée sur le réseau local de la collectivité (`DB_HOST`), ce qui était l'objet de la
requête initiale.

La coquille de cette édition est `server/web/index.html` : l'`index.html` et le `main.pjs`
d'origine ne servent qu'à l'édition en ligne. En auto-hébergement, le mode de persistance par
défaut est « serveur externe » sur la même origine, et le jeton d'écriture est injecté au
démarrage du conteneur.

**Domaine côté service.** `server/mysql/actes.mjs` est le portage du service de signature et de
publication : il est **pur** (aucune dépendance à Node, à MySQL ou au réseau — état, empreinte,
horloge et persistance lui sont injectés), donc testable hors ligne et identique dans les deux
environnements. Son état vit dans la table `sb_etat`.

Références : `src/server/README.md` (installation, réseau, TLS, sauvegardes) et
`src/docs/ADMINISTRATION.md` (sécurité, exploitation, migration, limites).

### 2.9.2 Édition statique (GitHub Pages)

La démonstration peut être servie **en statique**, sans aucun serveur : c'est l'édition
publiée depuis un dépôt. `index.html` porte alors un `<!doctype html>`, un `viewport` et un
titre (sans effet dans l'environnement d'édition), et **`src/pages/host.js`** fournit les
deux services manquants :

| Service attendu | Fourni par l'édition statique |
|---|---|
| `root.kv` | base **IndexedDB** du navigateur (repli en mémoire) |
| `root.createServerSocket` | le **script serveur d'`index.html`**, relu dans le DOM et exécuté dans la page, avec un état durable (IndexedDB) |

Le service hébergé par la page est donc **le code du service lui-même**, sans réimplémentation:
seul son état change de support. Conséquences à retenir :

- l'état du **service** est propre au navigateur : les fonctions partagées ne le sont
  qu'entre les onglets d'un même poste. Le mode de persistance porte donc un libellé adapté
  (« Service embarqué — ce navigateur », `db/index.js`) ;
- la résolution des deux services est centralisée dans **`src/lib/hosts.js`** : c'est le seul
  module qui sait où les chercher, et il donne la priorité à `window.__SCRIBA_HOST__` (posé
  par l'édition statique) sur `root` (posé par l'hébergement) ;
- `window.__SCRIBA_FORCE_STATIC__ = true` avant chargement force ce mode depuis n'importe
  quel hébergement — c'est ainsi qu'on le relit depuis l'éditeur ;
- signature (`crypto.subtle`, donc contexte sécurisé : HTTPS), empreinte, publication, ELI
  et opposabilité sont inchangés.

## 3. Compilation et exports

`compile(trame, values, config, { overrides }) → { meta, nodes, issues, missing, overrides, ecarts }`

`overrides` (défaut : `values.__overrides`) applique les écarts de rédaction au texte des
blocs avant interprétation ; `ecarts` liste les emplacements réellement réécrits.

Exports :
| Format | Contenu |
|---|---|
| **Akoma Ntoso 3.0** (`.akn.xml`) | `act` + `meta/identification` (FRBR work/expression/manifestation, URIs ELI), `references`, `notes` (commentaires, signés de leur service), `preamble` (visas, considérants, formule d'édiction), `body/article`, `conclusions` (signature), `meta/proprietary` (préparation + `ia:redaction` des écarts) |
| **Schematron** (`.sch`) | contraintes structurelles dérivées de la trame + règles métier traduites en XPath quand c'est possible (les autres sont conservées en commentaire, jamais inventées) |
| **JSON-LD / ELI** | métadonnées pour l'open data |
| **HTML** | accessible, sémantique, feuille d'impression **A4** (impression → PDF) |
| **Word** (`.doc`) | document mis en page **A4** (21 × 29,7 cm, marges 2 cm / 1,8 cm) par un en-tête de section Word : ouvrable et modifiable dans Word, LibreOffice ou OpenOffice |
| **JSON** | cycle complet de l'acte (valeurs + modèle compilé) |

**Papier.** Tous ces documents sont au format **A4** (21 × 29,7 cm), avec les mêmes marges
partout — 2 cm en haut et en bas, 1,8 cm à gauche et à droite — que ce soit à l'écran, dans le
fichier exporté (HTML, Word), à l'impression ou dans le PDF. La règle est décrite une seule fois
dans `src/lib/paper.js` (`A4_PAGE_CSS`, `A4_BREAK_CSS`) et reprise par l'aperçu de
l'application (`src/css/app.css`), l'original signé et la version en ligne publiée. Les sauts de
page sont maîtrisés : un titre d'article ne reste pas seul en bas de page, une signature ne se
détache pas de son bloc, une ligne de tableau n'est pas coupée.

À ces exports s'ajoutent les pièces de la publication : la **version en ligne** (page HTML
autonome déposée au recueil), l'**original signé**
(`application/vnd.actes.original-signe+json` : document figé, empreinte, signatures,
certificat, horodatage, page consultable) et les métadonnées **JSON-LD / ELI** de la
publication (`eli:date_publication`, `eli:first_date_entry_in_force`).

## 4. Parcours

0. **Se connecter** — l'écran d'ouverture liste les comptes (« Qui se connecte ? ») ; on
   choisit le sien, et le **rôle** du compte décide de ce qui est permis tandis que son
   **périmètre** décide de ce qui est visible (voir 2.7). Le menu du compte permet de
   **changer de compte** et rappelle le périmètre courant. La session est conservée d'une
   visite à l'autre.
1. **Référentiel** — identité, entités, personnes, rôles, **services et bureaux**, références
   juridiques, mentions, numérotation, vocabulaires. Import/export JSON. L'onglet **Base de
   données** règle le mode de persistance et, le cas échéant, l'adresse et le jeton du
   serveur MySQL / MariaDB (voir 2.9). (administrateurs)
1 bis. **Feuilles de style** — la **charte graphique des décisions** (voir 2.2.2) : une feuille
   générale et des sous-feuilles rattachées à des entités et/ou des familles d'actes, avec
   aperçu en direct, **édition directe du style** (on clique l'élément dans l'aperçu), modèles
   de départ, et export/import JSON. (administrateurs et éditeurs, `trames.styles`)
1 ter. **Apparence (clair / sombre)** — un bouton dans l'en-tête bascule l'application en mode
   sombre ; le menu du compte propose « Automatique » (suivre le système), « Clair » ou
   « Sombre ». C'est une **préférence de poste de travail**, rangée dans le navigateur, pas dans
   le référentiel : elle vaut pour le poste, pas pour la collectivité. Le **papier des actes
   reste blanc** — seul l'habillage de l'application change. (tous les comptes)
2. **Trames** — liste **filtrée par le périmètre du compte**, création (avec choix du service
   gestionnaire et, au besoin, du bureau), duplication, statut (brouillon/publiée/archivée),
   export JSON.
3. **Éditeur de trame** (administrateurs et éditeurs) — 3 volets : plan / page WYSIWYG /
   inspecteur. Édition inline ; insertion de champs, clauses conditionnelles, commentaires
   (avec niveau et référence juridique) ; règles avec test immédiat. Commentaires et règles
   sont **signés du service** du compte qui les a saisis (l'auteur n'est pas saisi à la main).
4. **Rédiger** (services) — l'onglet ouvre d'abord le **choix de l'acte à rédiger** : la
   rédaction en cours, un acte enregistré encore modifiable, ou une trame du référentiel
   (liste filtrée par le périmètre, avec recherche). Le **document est ensuite le
   formulaire** : page A4 éditable en place,
   pastilles de champs cliquables, saisie possible aussi depuis le panneau de droite
   (« À compléter » / « Contrôle & écarts »). Le texte du modèle peut être réécrit : les
   réécritures deviennent des **écarts « hors trame »** (conservés, signalés, non
   bloquants, visibles des administrateurs). Export bloqué seulement par un contrôle
   bloquant de la trame. L'en-tête indique **où en est l'acte dans son circuit de validation**
   (« Soumettre au circuit » tant qu'il n'a pas été soumis) et la fiche de l'acte porte la
   carte du parapheur.
4 bis. **Parapheur** — l'écran du valideur (voir 2.8.1) : *à valider par moi*, *en cours*,
   *validés*, *renvoyés ou refusés*. On y donne son **bon pour accord** (ou son avis), on
   **renvoie** l'acte en rédaction, on le **refuse**, ou on **reprend** un circuit — chaque
   décision étant motivée par une observation. Un acte validé puis **réécrit** voit sa
   validation devenir **caduque** : l'écran le dit et propose de reprendre le circuit.
5 bis. **Exécution & délais** — l'échéancier (voir 2.8.2) : *formalités à accomplir*,
   *recours ouvert*, *définitifs*, *tous les actes signés*. On y **constate** la transmission
   au contrôle de légalité, la publication (hors chaîne ELI) ou la notification, et l'on voit
   la date d'**exécutoire**, le **délai de recours** restant et les retards.
5. **Actes** — registre **filtré par le périmètre du compte** : numéro, objet, nature
   (d'origine / modificatif / consolidée / importé), conformité à la trame (« conforme » ou
   « N écart(s) »), entité, **service et bureau**, signature, statut, **parapheur**,
   **exécution** ; « Reprendre » rouvre le document, « Voir » l'affiche, « Modifier » lance un
   acte modificatif. Le registre signale ce qui attend un geste (actes à valider, formalités en
   retard, actes à la corbeille) et permet de **mettre un acte à la corbeille** (suppression
   réversible, écran **Corbeille** — voir 2.8.3). La **recherche globale** (Ctrl+K ou « / »)
   retrouve n'importe quel acte, trame, personne, service, référence ou compte.
6. **Modifier un acte** — choisir un acte du registre ou importer le fichier de l'acte
   publié ; le document en vigueur s'ouvre **éditable comme dans un traitement de texte**
   (réécrire un article, l'abroger ou le rétablir, insérer un article) ; à la confirmation,
   production simultanée de l'**acte modificatif** et de la **version consolidée** (présentée
   par défaut dans sa rédaction en vigueur, mentions sous les articles modifiés ; le suivi des
   modifications s'affiche sur option). Le
   modificatif part en signature puis est publié ; sa publication publie la version
   consolidée, qui **supplante** l'acte initial, lequel demeure accessible via l'historique
   des modifications.
7. **Signature & publication** — l'application est cliente de l'API REST du service :
   dépôt de l'acte finalisé, ouverture du circuit auprès du prestataire de signature
   (écran distinct), retour de l'acte signé par notification, suivi du circuit. Un
   onglet « API & journal » montre la description OpenAPI et chaque échange (requête,
   réponse, statut, durée), y compris les appels sortants vers le prestataire.
8. **Publications** — onglet « Publication (ELI) » : versement de la version en ligne au
   recueil, attribution de l'**identifiant ELI**, date de publication et date
   d'opposabilité, conservation de l'original signé. L'écran « Publications (ELI) » est
   le **registre public** : recherche d'un acte, résolution d'un identifiant ELI,
   consultation de la version en ligne, des métadonnées, des versions et de l'original
   signé (avec vérification de la signature).
9. **Guide** — wiki d'utilisation intégré, écrit pour un agent administratif peu à
   l'aise avec l'informatique (voir section 6).
10. **Documentation technique** — les documents livrés avec le logiciel, lus dans
   l'application : `docs/ADMINISTRATION.md` (exploitation, sécurité, sauvegardes,
   auto-hébergement), `server/README.md` (installation), `SPEC.md`, `README.md`,
   `TODO.md`. Sommaire, recherche visuelle, impression et téléchargement du fichier
   source. Accessible depuis le menu, et depuis un encart au bas du « Guide ».

## 6. Guide d'utilisation (« wiki »)

Constat de départ : l'outil est destiné à des agents qui utilisent Word et la messagerie,
sans plus. Le vocabulaire du métier (visa, considérant, formule d'édiction, trame) et
celui de l'informatique (export, format, jeton) ne peuvent pas être supposés connus.

Le guide est **dans l'application** (menu « Guide », et un lien « Aide » sur chaque écran),
il est **imprimable** (chapitre seul ou en entier) et **exportable** en fichier HTML
autonome à transmettre aux collègues.

| Chapitre | Objet | Public |
|---|---|---|
| Bienvenue | à quoi sert l'application, ce qu'elle ne fait pas | tous |
| Ouvrir l'application | adresse, favori, les entrées du menu | tous |
| Écrire un acte, pas à pas | choisir l'acte à rédiger, compléter le document : pastilles, réécritures, enregistrement, export | tous |
| Contrôle & écarts | comprendre les messages et les passages réécrits | tous |
| Enregistrer, imprimer, envoyer | où arrive le fichier, comment le joindre à un courriel | tous |
| Retrouver un acte | le registre, les statuts, reprendre un brouillon | tous |
| Faire signer un acte | le circuit de signature, le prestataire, l'original signé | tous |
| Publier l'acte (ELI et opposabilité) | version en ligne, identifiant ELI, dates | tous |
| Modifier un acte déjà écrit | acte modificatif, version consolidée, import | tous |
| Préparer une trame | l'éditeur de trame, champs, règles, commentaires signés de leur service | administrateurs et éditeurs |
| Qui peut faire quoi : les comptes et les rôles | se connecter, les trois rôles, ce que chacun débloque | tous |
| Glossaire | tous les termes, en une phrase | tous |
| Dépannage | les petits ennuis et leur solution | tous |
| Fiche mémo | une page à afficher près du poste | tous |

Principes rédactionnels (à respecter si on complète `src/wiki.js`) : phrases courtes, un
geste par étape commençant par un verbe, pas de jargon sans explication, et toujours
indiquer ce qui se passe en cas d'erreur et où se trouve le fichier produit.

Les illustrations sont des **captures réelles** de l'application, avec repères numérotés
dont les positions sont calculées à partir des éléments de l'interface (voir README).

## 5. Hors périmètre v1 (prochaine étape)

- Export PDF/A certifié (chaîne à valider par veraPDF) : aujourd'hui le PDF s'obtient par
  l'impression du HTML, et l'original signé est un paquet JSON + page HTML. De même,
  l'export **Word** est un `.doc` (HTML balisé pour Word, section A4) et non un `.docx` natif.
- **Signature réellement qualifiée** : la démonstration signe avec un certificat créé dans
  le navigateur (ECDSA P-256, vérifiable) ; la production doit se brancher sur le
  prestataire de la collectivité et sa chaîne de certification eIDAS.
- Bibliothèque de trames partagée par URL publique (lien à ouvrir chez un tiers) — la
  synchronisation multi-poste, elle, est assurée par le mode partagé (2.9).
- Ajout/suppression de blocs par le rédacteur : la rédaction agit sur le **texte** et les
  **champs** ; la structure (articles, clauses, conditions) reste du ressort des
  administrateurs, via l'éditeur de trame et le flux « Modifier un acte ».
- Bordereau SEDA / versement VITAM.
- Assistant de rédaction (ai-text-plugin).
- **Parapheur et exécution — suite.** Le circuit de validation, l'échéancier des formalités,
  la corbeille, le journal d'audit, la recherche globale et la collaboration sont livrés
  (voir 2.8). Restent hors périmètre : la **suppléance** nominative d'un valideur (vacances,
  intérim, délégation temporaire), l'**envoi réel** des notifications (courriel) et leur
  résumé quotidien, l'**export et la rétention** du journal d'audit, la lecture du journal
  technique `sb_journal` depuis l'application, et le **verrou de rédaction exclusif** (le
  verrou actuel avertit, il n'empêche pas).
