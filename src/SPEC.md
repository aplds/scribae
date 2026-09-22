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

### 2.1 Administration (`config`)

```js
{
  brand:      { name, shortName, color, colorDark, documentFont, baseUri, logoUrl },
  vocab:      { enact:"DÉCIDE", articleLabel:"Article", recitalsLabel:"Considérant",
                visasLabel:"Vu", recoursLabel, publicationLabel },
  numbering:  { pattern:"{year}-{seq}-{entityCode}", seq:400, pad:3, year:2026,
                eliPattern:"{baseUri}/eli/{actType}/{year}/{seq}/{entityCode}",
                source:"interne",        // "interne" | "externe" (voir § 2.1 bis)
                externe:{ transport:"relais", url, method:"POST", headers, body,
                          valeur:"records[0].id", reference, pattern:"", timeoutMs:15000 } },
  entities:   [ { id, code, name, legalName, seatCity, kind, orgRefs:[refId], tribunal } ],
  people:     [ { id, civility, firstName, lastName, entityId, roles:[roleId],
                  accord:"",  // ""|"m"|"f" — force l'accord en genre de la qualité
                  fondementRefId,  // refId de la décision fondant son pouvoir de signer (autorité de tête)
                  refs:[{ kind, label }] } ],
  services:   [ { id, code, name, entityId, bureaux:[ { id, name } ] } ],
  roles:      [ { id, label, m, f } ],   // deux formes : « maire »/« maire », « directeur… »/« directrice… »
  delegations:[ { id, fromId, toId, qualiteM, qualiteF, matieres, familyId, actTypeId,
                  entityId, acteRefId, acte, du, au, active } ], // délégations de signature, chaînables (sous-délégation) ;
                                                     // entityId = l'organisation dans le nom de laquelle elle est donnée
                                                     // acteRefId = la décision qui l'a consentie (acte = intitulé libre à défaut)
  refs:       [ { id, kind, label, scope, active, source, date, abrogatedBy } ],
  mentions:   [ { id, kind:"recours"|"publication", label, text } ],
  families:   [ { id, label, description } ],  // famille de trames = « thème » du recueil : `description`
                                               // est la phrase de présentation publique du thème (accueil du recueil)
  circuits:   [ { id, label, description, active, trameIds:[], familyIds:[], entityIds:[],
                  steps:[ { id, label, role:"editeur"|"administrateur",
                            kind:"accord"|"avis", serviceScoped, optional, help } ] } ],
                                            // n'ont d'effet que si `experimental.parapheur` (ci-dessous)
  delais:     { recoursMois:2, transmissionJours:15, publicationJours:10, notificationJours:8 },
  experimental:{ parapheur:false, controleLegalite:false },
                                            // fonctions expérimentales (Administration › Expérimentale) :
                                            // le parapheur est ÉTEINT par défaut — `circuitFor` ne
                                            // résout alors aucun circuit (voir § 2.8.1) ; la
                                            // transmission au contrôle de légalité est ÉTEINTE par
                                            // défaut — l'étape ne s'intercale pas entre la signature
                                            // et la publication (voir § 2.8.2 bis)
  styles:     [ { id, label, general, entityIds:[], familyIds:[], …présentation } ],
  actTypes:   [ { id, label, aknElement } ],
  colors:     [...]
}
```

### 2.1 bis Numérotation : séquence interne, ou service externe

Le numéro d'un acte a **deux sources possibles**, réglées dans Administration › Numérotation :

| Source | Ce qui se passe |
|---|---|
| `interne` (défaut) | le numéro est composé sur la **séquence du référentiel** (`numbering.seq`), incrémentée à chaque réservation depuis l'écran de rédaction |
| `externe` | le numéro est **demandé à un service** au moment de rédiger ; c'est le service qui l'attribue |

Le second cas est celui d'une collectivité qui **numérote ailleurs** : un document **Grist** (la
création d'une ligne y attribue le numéro), un tableur en ligne, un référentiel interne.

**Le numéro est composé de la même façon dans les deux cas** : `numbering.pattern` reçoit le
jeton `{seq}`, qui vaut le rang local (source interne) ou **la valeur rendue par le service**
(source externe). La valeur rendue est complétée par des zéros **si c'est un entier**
(`{seq}` = `012` pour `12` avec `pad:3`) ; une valeur déjà mise en forme (« 2026/0412 ») est
reprise telle quelle. `numbering.externe.pattern` permet de donner au numéro externe un motif
propre ; le jeton `{valeur}` y porte la valeur brute du service.

**L'appel.** `numbering.externe` décrit une requête HTTP :

| Champ | Rôle |
|---|---|
| `transport` | `relais` (par le relais HTTP de l'hôte — contourne CORS) ou `direct` (appel du navigateur, l'API devant autoriser l'origine) |
| `url`, `method` | l'adresse et la méthode. Grist : `POST /api/docs/{docId}/tables/{table}/records` |
| `headers` | un « Nom: valeur » par ligne — c'est là que va l'authentification (`Authorization: Bearer …`) |
| `body` | le corps JSON (POST/PUT/PATCH) — Grist attend `{"records":[{"fields":{…}}]}` |
| `valeur`, `reference` | **où lire** dans la réponse JSON : le numéro, et la référence de la ligne créée |
| `pattern`, `timeoutMs` | motif propre au numéro externe, et délai d'attente |

Les **jetons** sont remplacés dans l'url, les en-têtes et le corps : `{valeur}` `{entityCode}`
`{entity}` `{year}` `{seq}` `{objet}` `{date}` `{trameId}` `{actTypeId}`. Seuls les jetons
connus sont remplacés : les accolades d'un corps JSON traversent la substitution intactes. Les
chemins de lecture acceptent la notation de Grist (`records[0].id`).

**Ce que l'application retient.** La **référence** de la ligne créée est conservée sur l'acte
(`acte.numeroSource = { source:"externe", ref, valeur, at, par, parName }`), affichée sur la
fiche de l'acte, et l'attribution entre au **journal d'audit**
(`numero.attribution_externe`). L'échange lui-même est journalisé, requête et réponse, avec les
appels au prestataire de signature et au contrôle de légalité (voir § 2.6) : il apparaît dans la
console « API & journal » sous le service « Numérotation ».

**Ce que l'application ne fait pas.** Elle ne rattrape pas un service injoignable : l'appel
échoue, le numéro n'est pas attribué, l'acte reste sans numéro — le rédacteur voit le message
d'erreur. Elle ne demande **jamais** un numéro en silence : le geste est celui du rédacteur
(« Demander le numéro »), et un numéro déjà obtenu ne se redemande pas sans confirmation, car
la ligne créée chez le service reste consommée même si l'acte n'est jamais enregistré. Le
bouton **« Tester l'appel »** du référentiel prévient, pour la même raison, que l'essai crée
une ligne.

**Deux précautions à l'installation.** L'API de Grist **n'accepte pas** l'en-tête
`Authorization` depuis un navigateur tiers : soit l'origine de l'application est déclarée
**origine de confiance** chez Grist et l'on utilise `direct`, soit l'on passe par le `relais`
(qui contourne CORS, mais voit la clé passer). Et la **clé d'API est conservée dans le
référentiel** : elle part dans les sauvegardes JSON et, en base partagée, dans la base commune.
Il faut donc une clé restreinte au strict nécessaire (création sur la seule table de
numérotation).

### 2.2 Trame (`trame`)

```js
{
  id, name, version, familyId, actTypeId, status,
  description, owner, entityIds:[] , serviceId, bureauId,
  nature,                  // "acte" (défaut) | "annexe" — un document adopté par un autre (§ 2.2.4)
  adoptionVisa,            // annexe : rappeler l'acte d'adoption en tête des visas (true par défaut)
  reglement,               // annexe : true = RÈGLEMENT, publié à part au recueil à titre informatif (§ 2.2.4 ter)
  divisions: [],           // l'échelle des divisions de CETTE trame (§ 2.2.3) ; vide = échelle livrée
  publishable,             // true par défaut ; false = trame non publiable
  styleId,                 // feuille de style (charte) désignée, "" = automatique
  circuitId,               // circuit de validation désigné, "" = automatique, "aucun" = pas de parapheur
  transmission,            // "" (règle générale) | "requise" | "aucune" — transmission au contrôle de légalité
  notification,            // "" (règle générale) | "requise" | "aucune" — notification aux intéressés
  fields: [ Field ], rules: [ Rule ], body: [ Node ]
}

Niveau = { level, label, num }   // un échelon de division : « Livre »/roman, « Titre »/roman…

Field = { id, label, type, required, group, help, placeholder, options,
          format, refKind, appliesWhen }

Rule  = { id, level:"blocking"|"warning"|"info", kind:"check"|"inclusion",
          target, expr, message, ref, author, date }

Node  = { id, type, ...propriétés..., when, notes:[Note], amend }

Note  = { id, author, date, kind:"legal"|"instruction"|"question"|"watch",
          text, quote, ruleId }
```

`Note` est un **commentaire de préparation** posé sur un bloc — il peut citer un **passage**
(§ 2.2.5).

Types de nœuds : `title`, `authority`, `visas`, `considerants`, `enact`, `division`,
`article`, `para`, `list`, `table`, `signature`, `mention`, `raw`.

Un `division` porte `level` (son échelon dans `trame.divisions`), `numMode`
(`auto` | `manual`), `num`, `heading`, et **`blocks`** — qui contient ses articles et ses
divisions imbriquées. Un `article` a la même forme (`heading`, `blocks`).

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

#### 2.2.1 bis Importer un document (.docx, .odt)

Un éditeur importe son modèle d'acte **tel qu'il l'a écrit** dans un traitement de texte. Le
bouton « Importer une trame » accepte aussi bien un **document Word** (`.docx`) qu'un
**document LibreOffice** (`.odt`) — la distinction se fait sur l'extension, un document étant
binaire quand un fichier de trames est du texte. `src/lib/doc-import.js` ouvre l'archive ZIP
sans aucune dépendance (repérage de l'EOCD, lecture du répertoire central,
`DecompressionStream("deflate-raw")`) et lit le XML avec le `DOMParser` du navigateur :
`word/document.xml` pour Word (`word/numbering.xml` distinguant liste numérotée et liste à
puces), `content.xml` pour LibreOffice (les `text:list-style` jouant le même rôle). Le texte est
pris **tel qu'il se présente** : les passages supprimés par une révision Word ne sont pas
importés.

`trameDepuisBlocs` reconnaît la structure d'un acte administratif et en fait une trame :

| Élément du document | Ce qu'il devient |
| --- | --- |
| Ligne de la collectivité (mairie, département, établissement…) | bloc **Autorité** (la ligne d'État « RÉPUBLIQUE FRANÇAISE » n'est retenue qu'à défaut) |
| Intitulé, avec son numéro, sa date et son « portant … » | bloc **Intitulé**, où ils deviennent `{{numero}}`, `{{dateSignature}}` et `{{objet}}` — l'objet donnant aussi son **nom** à la trame |
| « Vu … » | bloc **Visas** (un élément par ligne) |
| « Considérant … » | bloc **Considérants** |
| « ARRÊTE », « DÉCIDE »… | bloc **Formule d'édiction** — c'est lui qui détermine le **type d'acte** de la trame |
| « Article N », « Article 1er » | blocs **Article** (`numMode: "auto"` si la numérotation suit 1..n, `"manual"` sinon) ; un intitulé d'article n'est retenu que s'il est court et ne finit pas par un point |
| Styles de titre, « Livre/Titre/Chapitre/Section N » | blocs **Division**, à l'échelon correspondant |
| Listes du traitement de texte, et numérotations écrites à la main (« 1° », « 1) », « a) ») | blocs **Liste** (`degree`, `parenth`, `lalpha`, `decimal`) |
| Tableaux | blocs **Tableau** (première ligne d'en-tête si ses cellules sont des libellés courts) |
| Mention de recours (contentieux, tribunal administratif, deux mois…) | bloc **Mention** (`textOverride`) |
| « Fait à … » | bloc **Signature** — le signataire du document n'est **jamais** repris : il vient du champ « Signataire » |

Les **champs** créés sont les cinq canoniques (`numero`, `objet`, `dateSignature`, `dateEffet`,
`signataire`) **et** un champ par jeton `{{…}}` trouvé dans le document — cherché sur les blocs
**bruts**, avant toute tokenisation de l'intitulé, pour ne pas prendre les jetons écrits par
l'import lui-même pour des jetons d'origine.

L'import **n'enregistre rien**. `trameDepuisFichier` rend `{ trame, issues, avertissements,
kind, nom }` ; l'interface (`src/ui/import-trame.js`) pose la trame dans `state.trameImport`,
ouvre l'adresse réservée `trame/__import__` (`IMPORT_ID`) et affiche d'abord une fenêtre de
**points à vérifier** — chaque décision de lecture est signalée plutôt que tue (« le bloc
Autorité reprend la ligne du document », « le signataire n'a pas été repris », « l'intitulé a été
relié aux champs »…). L'éditeur affiche alors une **bannière** et deux gestes : « Enregistrer la
trame » (elle entre au registre en **brouillon**) ou « Abandonner l'import ». Un document sans
texte exploitable (image seule), un fichier d'un autre format ou une archive illisible sont
refusés, sans rien écrire.

#### 2.2.1 ter Mise à disposition des services

**Une trame reste en brouillon tant qu'un éditeur ne l'a pas mise à disposition.** C'est la règle
générale de l'application : un modèle se prépare à l'abri, puis s'ouvre.

- **Ce qu'elle change.** `trameDisponible(trame)` (`src/lib/schema.js`) répond
  `trame.status === "published"`. L'écran **« Rédiger un acte »** ne propose que
  `visibleTrames().filter(trameDisponible)`, et `renderRediger` **refuse** l'ouverture directe
  d'une trame non disponible — sauf pour un **éditeur** (qui doit pouvoir essayer son modèle) et
  pour une **rédaction déjà commencée** (retirer la trame sous les pieds de celui qui écrit
  serait absurde).
- **Le geste.** `mettreTrameADisposition` / `retirerTrame` (`src/ui/state.js`) posent le statut,
  horodatent la mise à disposition et **journalisent** (`trame.disponible` / `trame.retiree`).
  Le bouton est le même partout — carte de la trame, bannière et en-tête de l'éditeur de trame,
  champ « Statut » de l'onglet « Trame » — et vit une seule fois
  (`src/ui/mise-a-disposition.js`), avec sa confirmation. « Retirer » ne touche **jamais** les
  actes déjà rédigés à partir de la trame : ils portent leur propre copie du texte et des valeurs.
- **Ce qu'on voit.** Le badge du statut `published` dit « **Mise à disposition** »
  (`statusBadge`, `src/ui/components.js`) ; un brouillon porte une bande de tête dans l'éditeur de
  trame (« les services ne la voient pas ») et une ligne d'explication sur sa carte.
- **Ce qui arrive en brouillon.** Une trame **créée**, **dupliquée** ou **importée**. Le jeu de
  démonstration, lui, livre ses trames déjà mises à disposition ; et un fichier JSON qui déclare
  ses trames `published` les met à disposition à l'import (l'interface le signale alors
  explicitement).

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
  titleFont, titleSize, titleWeight, titleCase, titleAlign,
  titleRule,                                 // none | line | double | underline | box
  titleBoxSides,                             // côtés de l'encadré : « tblr » (voir plus bas)
  titleColor, titleSpacing, titleMargin,

  // formule d'autorité
  authorityAlign, authorityItalic, authoritySize,

  // intitulés d'article
  headingFont, headingSize, headingWeight, headingColor, headingCase,
  headingRule,                               // none | line | dotted | box
  headingBoxSides,                           // côtés de l'encadré : « tblr »
  articleNumberLayout,                       // inline | block | margin

  // visas et considérants
  visasIndent, visasBullet, visasLabelStyle, recitalsIndent, recitalsItalic,

  // listes — la puce des listes à puces (ul), la numérotation des listes numérotées (ol)
  listMarker, listNumbering, listIndent,

  // filets, encadrés, tableaux — chaque encadré trace les côtés choisis (`…BoxSides`)
  ruleStyle, ruleWidth, articleDivider, enactStyle, enactCase, enactBoxSides,
  mentionStyle, mentionSize, mentionItalic, mentionBoxSides,
  tableStyle, tableFontSize, tableCellPadding, tableCaptionAlign, tableCaptionCase,

  // signature
  signatureAlign, signatureStyle, signatureBoxSides, signatureSpace, signatureWidth,
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
individuel, charte graphique de l'État, Marianne-like) donnent un point de départ complet, sans
toucher au nom, au rattachement ni au logo de la feuille. Les deux derniers reprennent la **charte
graphique de l'État** (bleu France `#000091`, typographie Marianne, en-tête et filet) : le préréglage
`etat` est **réservé à l'État et à ses opérateurs** — la police Marianne et le bloc-marque étant
réservés, le logiciel ne les livre pas, l'administration les ajoute —, tandis que `marianne`
reprend la même sobriété **sans les éléments réservés** (Arial, identité de la collectivité), pour
toute administration. Chacun porte son étiquette dans la liste (« réservé », « libre »).

**Les polices** (`fontFamily`, `titleFont`, `headingFont`) se choisissent dans une **liste
fermée** — `FONT_CHOICES` dans `src/lib/styles.js`, rangée par familles (à empattements, sans
empattement, à chasse fixe) : des polices **répandues sur les postes**, donc sans
téléchargement ni dépendance réseau, chacune avec sa **pile CSS complète et ses replis** (une
même famille ne s'appelle pas pareil d'un système à l'autre). Le champ
(`fontField`, `src/ui/components.js`) garde une porte de sortie — « Autre (police
personnalisée) » — pour une police propre à la collectivité ou une pile CSS complète : la
feuille range **toujours la pile**, jamais un identifiant d'entrée, si bien qu'une charte
exportée puis importée ailleurs nomme exactement la même police. `titleFont` et `headingFont`
proposent en outre « Héritée » : l'intitulé reprend alors la police du corps.

**L'intitulé de l'acte** (`titleRule`) comme les **intitulés d'article** (`headingRule`)
acceptent l'option `box` : l'intitulé est alors **encadré** — filet du style et de la couleur
des filets de la charte (`ruleStyle`, `ruleWidth`, `ruleColor`). C'est la même marque
d'encadrement que la formule d'édiction (`enactStyle: box`), les mentions (`mentionStyle: box`)
et le bloc de signature (`signatureStyle: box`).

**Chaque encadré choisit ses côtés.** `titleBoxSides`, `headingBoxSides`, `enactBoxSides`,
`mentionBoxSides`, `signatureBoxSides` portent une chaîne sur `tblr` — chaque lettre allume un
côté (haut, droite, bas, gauche). La clé absente vaut l'encadré complet ; **vide**, l'encadré est
ouvert de partout. `styleCss` n'écrit donc pas le raccourci `border` mais un `border-…` par côté
retenu (`boxSides`), si bien qu'un filet se pose seul sous un intitulé, ou qu'un encadré s'ouvre
du côté où le texte respire.

**Les listes** se déclinent en deux familles, que la trame distingue **bloc par bloc**
(`ordered` sur un nœud `list`, réglé dans l'inspecteur de l'éditeur de trame) et que la charte
habille séparément : `listMarker` pour la puce des listes à puces (`ul`), `listNumbering` pour la
numérotation des listes numérotées (`ol`) — `decimal` (« 1. »), `degree` (« 1° »), `parenth`
(« 1) »), `lalpha` (« a) »), `ualpha` (« A) »), `lroman` (« i. »), `uroman` (« I. »), `none`. Les
numérotations sur mesure sont des règles `@counter-style` qui **étendent** le compteur natif et
n'en changent que le suffixe (`COUNTER_STYLES`) ; le navigateur, le PDF et le HTML autonome les
honorent, Word — qui ignore ces règles — rend alors la numérotation par défaut.

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

#### 2.2.3 Divisions : livre, titre, chapitre, section…

Un texte long ne se compose pas seulement d'articles : il se range en **livres**, **titres**,
**chapitres**, **sections**. Le vocabulaire et le nombre d'échelons n'appartiennent pas au
logiciel — ils appartiennent à la **trame** : `trame.divisions` est l'**échelle**, une entrée par
échelon (`level` croissant, 1 = le plus haut) avec le **mot imprimé** (`label`, libre :
« Partie », « Chapitre liminaire », « Section »…) et sa **numérotation**
(`num` : `roman` | `decimal` | `letter` | `aucun`). Une échelle vide n'est pas « aucune
division » : c'est l'échelle livrée (`NIVEAUX_DEFAUT` — Livre/Titre en romains, Chapitre/Section
en arabes), de sorte qu'une trame ordinaire peut poser un `division` sans rien régler.

Dans le document, un nœud **`division`** se place à l'un de ces échelons et porte son `heading`.
La **hiérarchie est donc pré-intégrée à la trame** : le rang s'imprime d'après la place de
l'échelon dans l'échelle, non d'après une saisie. La **numérotation suit l'ouverture des
échelons** (`compile.js`) : « Livre Ier », « Titre Ier », « Titre II », « Livre II », « Titre
Ier » — un échelon ouvert remet à zéro ceux qui le suivent. L'ordinal suit l'usage français
(« Livre Ier », non « Livre I »). Les divisions se rendent imbriquées (`render.js`,
`section.doc-division--n<échelon>`, h2…h5), s'exportent en Akoma Ntoso (`part` / `title` /
`chapter` / `section`, `hcontainer` au-delà) et en Markdown, et se relisent (`akn.js`). Dans
l'éditeur de trame, elles se posent depuis la palette (« Division »), s'imbriquent, et
l'onglet « Trame » règle l'échelle (nombre d'échelons, mot, numérotation).

#### 2.2.4 Annexes : le document adopté par un autre

Une **annexe** n'est pas un acte comme les autres : c'est un document **adopté** par un autre, auquel
il est annexé — et c'est cet acte qui lui donne son autorité. **Une annexe ne se signe donc pas** :
c'est l'acte qui l'adopte qui est signé, et **l'original de cet acte est suivi du texte de l'annexe,
dans le même document**, à la suite de la signature et sur une page neuve. Elle n'est ni signée ni
publiée pour elle-même ; la date qu'elle porte est celle de la décision qui l'adopte, et **elle n'a
pas de numéro propre**. Son identité, c'est cette **décision** — celle qui l'adopte, celle qui en
adopte la nouvelle rédaction (§ 2.5), ou celle qui l'abroge : partout où un acte ordinaire montre
« n° 2026-416-VSL », une annexe montre à quoi elle tient (« Annexe à la délibération n° 2026-416-VSL
du 24 septembre 2026 », § 2.2.4 bis). Elle garde en revanche un **identifiant interne** (`id`), pour
les liens et l'historique. L'exemple d'école est le règlement intérieur : une délibération
l'adopte, le règlement lui est annexé, et son texte suit la délibération signée — la délibération
d'adoption figure dans ses visas. Il arrive aussi que l'annexe ne soit qu'un tableau (une grille
tarifaire adoptée par une décision).

Une trame s'en déclare par `trame.nature: "annexe"` (onglet « Trame » de l'éditeur) ; le module
`src/lib/annexes.js` tient tout le vocabulaire du lien — tournures d'adoption, identification
figée de l'autre acte, intitulés des listes — et `src/lib/annexe-docs.js` résout et compose la
**partie annexée** du document (l'annexe imprimée à la suite de l'acte qui l'adopte). Quatre
choses s'ensuivent :

1. **À la rédaction**, l'annexe **désigne l'acte qui l'adopte** (`values.__adoption`) et l'acte
   qui adopte **annonce ses annexes** (`values.__annexes`). Ce qu'on fige est une
   **identification** (nature, numéro, date, objet, `acteId`), non l'acte : sa fiche reste
   la source vivante.
2. **À la compilation** (`compile.js`) : l'annexe reçoit, **en tête de ses visas**, le visa qui
   rappelle son adoption, avec son lien (`{designationThe} n°{numero} du {date}, qui l'adopte`,
   tournure `config.vocab.annexe.visa`, éteignable par `trame.adoptionVisa === false`) ; son
   **bloc de signature est retiré** et le champ `signataire` n'est pas réclamé — une annexe n'a pas
   de signataire propre. L'acte qui adopte reçoit, **à la fin de son dispositif**, le nœud
   `annexes` — la liste de ce qui est annexé, par intitulé. `doc.meta.nature`, `doc.meta.adoption`
   et `doc.meta.annexes` portent ces liens.
3. **La partie annexée du document** : là où le registre est connu (rédaction, écran de l'acte,
   original signé, publications), le document de l'acte d'adoption est complété de
   `doc.annexeDocs` (voir `annexesJointes`, `src/lib/annexe-docs.js`). Toutes les sorties —
   écran, impression, HTML, Word, Markdown, Akoma Ntoso (`<attachments>`), original signé,
   version publiée — écrivent alors le texte de l'annexe **à la suite de la signature**, dans une
   section `.doc-annexe-part` qui commence sur une page neuve, avec la charte de l'acte. En Akoma
   Ntoso, la **nature** du document voyage avec lui (`<ia:nature>`) ; à la relecture, le lecteur
   (`src/lib/akn.js`) **signale** la présence du texte annexé (`<attachments>`) sans le rattacher de
   lui-même : une annexe reste un acte à part, joint à son acte d'adoption depuis le registre.
4. **Sur les fiches et en ligne** : la fiche de l'acte porte un encart qui dit **d'où le document
   vient** (l'acte d'adoption) ou **ce qu'il annexe**, avec un lien vers l'autre fiche ; la
   version publiée (`buildWebVersion`, `src/lib/eli.js`) porte le même encart. L'annexe n'ayant pas
   de publication propre, c'est la version en ligne de **l'acte d'adoption** qui porte son texte.

Une annexe **ne se signe ni ne se publie pour elle-même** : `actePubliable` (`src/ui/state.js`)
répond non pour tout acte de nature « annexe », l'écran de signature le dit et renvoie vers l'acte
d'adoption, et la carte « Annexes adoptées » de l'onglet Publication les rassemble. Elle se
**modifie** par adoption d'une nouvelle rédaction (voir 2.5), et son acte modificatif est suivi du
texte consolidé de l'annexe.

**Modifier une annexe** suit son régime propre (§ 2.5) : l'acte modificatif en **adopte la
nouvelle rédaction**, présentée en suivi des modifications.

#### 2.2.4 bis L'annexe n'a pas de numéro propre

Le corollaire du § 2.2.4 est une règle de **nommage** : une annexe n'a **pas de numéro**. Elle n'a
ni rang ni place au recueil, puisqu'elle n'y est pas déposée ; elle est toujours liée à la décision
qui la fait exister — celle qui l'**adopte**, celle qui en adopte la **nouvelle rédaction** (sa
modification, § 2.5), ou celle qui l'**abroge**. Elle garde un **identifiant interne** (`id` du
registre), qui sert aux liens et à l'historique, mais rien à l'écran ne présente de numéro.

Ce que cela change, concrètement :

1. **La numérotation ne consomme rien.** L'atelier ne montre pas le champ « Numéro de l'acte »
   (`applicableFields`, src/ui/views/rediger.js) ni le bouton de réservation, et la variable
   `{{numero}}` n'est pas proposée ; la trame d'annexe du jeu de démonstration ne porte donc pas ce
   champ (src/lib/seed.js). À la compilation, `compile()` remet le numéro à vide pour une annexe —
   **et l'ELI aussi** : une annexe n'est pas publiée, son adresse de recueil n'existe pas
   (`doc.meta.numero === ""`, `doc.meta.eli === ""`).
2. **L'appellation passe par la décision d'adoption.** `src/lib/annexes.js` compose les deux formes :
   `appellationAnnexe()` (« Annexe à la délibération n° 2026-416-VSL du 24 septembre 2026 ») pour une
   étiquette, `appellationAnnexeDefinie()` (« l'annexe à la délibération n° … ») pour une phrase, et
   `numeroAffiche()` (« annexe à 2026-416-VSL ») pour une colonne de tableau. La liste des annexes
   d'un acte, la partie annexée et les exports s'appuient sur `libelleAnnexe()` (« Annexe —
   Règlement intérieur du conseil municipal ») : une annexe se nomme par ce qu'elle est.
3. **Les tournures de modification la désignent par cette décision.** `targetPhrase()`
   (src/lib/amend.js) produit « le règlement (la délibération n° 2026-416-VSL du 24 septembre 2026) »
   quand la cible n'a pas de numéro : l'acte modificatif dit donc « portant adoption de la nouvelle
   rédaction du règlement (…) », et non « n° à compléter ».
4. **Le schéma et la relecture ne réclament plus de numéro.** Le Schematron ne porte pas l'assertion
   `s-numero` pour une annexe (src/lib/export.js), et la relecture d'un Akoma Ntoso ne signale pas
   son absence (src/lib/akn.js).

#### 2.2.4 ter Les RÈGLEMENTS : la publication informative autonome

Une annexe peut être déclarée **RÈGLEMENT** sur sa trame (`trame.reglement: true`, onglet « Trame » de
l'éditeur — sans effet sur une trame d'acte). Un règlement est un texte **NORMATIF** : un règlement
intérieur, un règlement d'usage. Il ne se lit pas seulement dans l'acte qui l'adopte — il se
**consulte pour lui-même**, comme un **code** : ses articles font droit, et les actes qui l'adoptent
ou le modifient en publient les versions successives. Pour qu'un tel texte soit **facilement
accessible**, le recueil public lui donne une **publication informative autonome**, à côté de sa
place dans l'acte qui l'adopte.

**Ce que l'annexe ne porte plus.** L'annexe n'est pas un acte : le compilateur (`src/lib/compile.js`)
écarte donc de son document, en un seul point, les blocs qui appartiennent à un acte —
**l'AUTORITÉ** (« La maire de … » : une annexe n'émane pas d'une autorité, elle est *adoptée* par un
acte) et la **MENTION DE PUBLICATION AU RECUEIL** (« Le présent arrêté est publié au recueil… » :
une annexe ne se publie pas elle-même). Le **bloc de signature** l'était déjà. Les **VISAS**, en
revanche, sont **conservés** : un règlement se fonde sur des textes, et le visa de son adoption
(« Vu la délibération n°…, qui l'adopte ») est ce qui le rattache à sa décision — il devient un lien
vers l'acte (§ « liens par l'identifiant ELI »).

**Comment elle est publiée.** À la publication d'un acte (`publier`, `src/ui/views/signature.js`),
`publierReglements` publie, dans la foulée, la version en vigueur de chaque règlement annexé :

1. **L'identifiant est créé une fois, puis conservé** sur l'annexe (`annexe.eli`). Il est minté par
   `eliUri()` sur le premier acte qui adopte le règlement — la table `ELI_CODES` lui donne le code
   `reg` (`eli:/fr/reg/2026/0416/vsl`) — et **ne change plus**. C'est lui qui rend les publications
   successives **solidaires** : un règlement modifié est le **MÊME** règlement, et la dernière
   version déposée est celle que le recueil montre (version en vigueur). Un règlement se consulte
   donc, comme un code, à **une adresse stable**.
2. **C'est une publication informative**, pas un acte : le client envoie `informative: true` et
   **aucun original** (le règlement n'est pas signé). Le service l'accepte (`hPublier`,
   `src/server/mysql/actes.mjs` et `index.html`) : `original` et `signature` restent nuls, et la
   publication **ne touche pas à l'état de l'acte déposé** (`acte.statut` / `acte.publication` sont
   laissés tels quels). Tout le reste de la mécanique est celle des actes — clé, ELI, versions,
   épinglage —, et `resumePublication` porte `informative` et `adoption` (l'acte qui l'adopte) pour
   que le recueil les connaisse.
3. **Le texte voyage entier** : la version en ligne (`buildWebVersion`), l'Akoma Ntoso, le JSON-LD,
   le Markdown et le texte brut, comme pour un acte. La page autonome (`buildWebVersion`) se
   présente autrement : pas d'« Opposabilité », pas de « publié le », pas de renvoi à un original
   signé — un encart « Texte informatif » dit que seule la décision d'adoption fait foi.

**Ce que le recueil en montre.** La notice d'une publication informative (`src/ui/views/acte-publie.js`)
ne mentionne **ni la publication au recueil** (« Publié le », « Recueil », « Entrée en vigueur ») —
le règlement n'est pas publié pour être opposable —, **ni une autorité**. Elle donne ce qui
l'identifie : sa **nature**, son **identifiant ELI**, sa date, et **l'acte qui l'adopte**
(« Texte adopté par — Délibération n° 2026-418-VSL du 30 septembre 2026 »). Elle porte les marques
« Texte informatif » et « texte en vigueur », un avertissement (« Texte publié à titre
informatif… »), et **ni bloc de signature ni original**. Le bloc « Versions publiées sous le même
identifiant » y prend tout son sens : ce sont les rédactions successives du règlement. Dès lors,
l'annexe **compte parmi les publications du recueil** : elle se cherche, se classe par thème, et son
identifiant s'ouvre directement (`?eli=eli:/fr/reg/2026/0418/vsl`, ou `/eli/reg/…` sur un
déploiement serveur).

**Une annexe qui n'est pas un règlement** — un tableau, une grille tarifaire — **ne reçoit rien de
tel** : elle reste la partie annexée de l'acte qui l'adopte, et rien de plus. Le drapeau est le seul
qui décide, et il ne vaut que pour une annexe.

#### 2.2.5 Commentaires : annoter un article, citer un passage

Un commentaire (`Note`) est posé sur un **bloc** de la trame — un article, un paragraphe, un
visa… — et **reste dans la page**, sous le bloc qu'il vise. Il porte une **nature** (contrainte
juridique, consigne de rédaction, point à arbitrer, veille normative), un **texte**, son
**auteur** (le **service** du compte, jamais l'agent — § 1.3) et sa date ; il peut en outre citer
un **passage** (`quote`) : la phrase du document sur laquelle il porte.

Deux règles gouvernent le dispositif (`src/ui/annotations.js`) :

1. **On commente ce qu'on voit.** Le commentaire ne se pose pas depuis une liste : un bouton
   « commenter » est posé sur chaque bloc de la page, et **sélectionner un passage** dans le
   document — un paragraphe, une phrase, un membre de phrase — fait apparaître une pastille
   « Commenter » qui ouvre la fenêtre d'écriture **en citant le passage sélectionné**. La citation
   suit le commentaire, dans l'aperçu, dans l'inspecteur et dans les exports.
2. **Un commentaire ne peut pas passer inaperçu.** Il s'affiche dans la page, en **bande
   distincte du texte de l'acte** (fond coloré, filet pointillé, nature et auteur rappelés), sous
   le bloc qu'il vise ; un **repère de marge** numéroté marque chaque bloc commenté ; l'en-tête de
   l'éditeur annonce le compte et ouvre la liste d'un clic ; l'inspecteur a un onglet
   **« Commentaires »** qui les rassemble tous, rangés par bloc, chacun menant au passage visé.
   L'« Aperçu » compilé les reprend à la fin du document (`showNotes`, `notesAppendix`).

**Le rédacteur les voit aussi.** Ils ne servent à rien s'ils restent dans l'atelier de la trame :
à la **rédaction**, chaque commentaire de la trame apparaît en **consigne** sous le passage
concerné (même bande, en lecture seule), l'onglet **« Consignes »** les rassemble, et un bouton
dans l'en-tête de l'acte annonce leur nombre. Ils **ne sont pas publiés** avec l'acte — ils font
partie de la **préparation** —, mais ils accompagnent les exports internes (Akoma Ntoso
`meta/notes` avec `data-target` et le passage cité, Markdown « Notes de préparation ») et le
rapport de conformité reprend les contraintes juridiques et les points à arbitrer.

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
         values: { …, __entityId,
                   __overrides: { [adresse]: "texte source" },
                   __ordre:     { [chemin de conteneur]: [rangs] },  // réordonnancement (§ 2.4.1)
                   __supprimes: { [adresse]: true },                 // blocs retirés du document (§ 2.4.2)
                   __ajouts:    { [conteneur]: [ { id, rang, node } ] },  // blocs et éléments ajoutés (§ 2.4.2)
                   __abrogations: [ … ],                            // § 2.5 bis
                   __adoption:  Ident | null,                       // annexe : l'acte qui l'adopte (§ 2.2.4)
                   __annexes:   [ Ident ] },                        // acte : les documents annexés
         overrides: { [adresse]: "texte source" },   // recopie lisible de __overrides
         ecarts:    [ { addr, label, original, current } ],
         issues: [], eli, createdAt, updatedAt,
         nature: "acte" | "annexe",          // la nature du document (§ 2.2.4)
         adoptePar: Ident | null,            // annexe : l'acte qui l'adopte
         annexes: [ Ident ],                 // acte : les documents annexés
         numeroSource: { source:"externe", ref, valeur, at, par, parName } | null,  // § 2.1 bis : numéro attribué par un service
         execution: {  …formalités constatées (voir § 2.8.2) :
            transmission: { at, ref, mode, byName, api?, certificat? },  // certificat = accusé de réception
            publication:  { at, ref, mode, byName },                    // constatée hors chaîne ELI
            notification: { at, ref, mode, destinataires, byName } } }

Ident = { acteId, numero, designation, date, objet, eli }   // l'identification FIGÉE d'un autre acte (§ 2.2.4)
```

Une **adresse d'emplacement** désigne un texte précis de la trame :

| Adresse | Ce qu'elle désigne |
|---|---|
| `body.3` | le texte du bloc n°3 (`title`, `authority`, `enact`, `para`, `raw`, mention) |
| `body.3.heading` | l'intitulé de l'article n°3, ou de la division n°3 |
| `body.3.blocks.1` | le paragraphe n°1 de l'article n°3 — ou l'article/division n°1 de la division n°3 |
| `body.2.items.0` | le texte du visa / considérant / élément de liste n°0 |
| `body.5.caption` · `.columns.1` · `.rows.0.2` | légende, titre de colonne, cellule |
| `body.7.place` | le lieu du bloc signature |

Une division descend donc aussi loin qu'elle est profonde (`body.3.blocks.0.blocks.2`) : les
adresses restent celles du **document**, et le conteneur de réordonnancement est le chemin de
l'adresse qui les porte (`body`, `body.3.blocks`).

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

#### 2.4.1 Réorganiser le document

Dans l'atelier de rédaction, le document n'est pas figé dans l'ordre du modèle : chaque bloc —
article, division, visa, considérant, mention — **se déplace**. Le geste est direct (deux flèches
sur le bloc, ou une prise pour le **glisser** : la poignée, ou le numéro de l'article, qui est la
prise naturelle — c'est ce qu'on vise en pensant « cet article-là »), et les primitives sont
celles de l'éditeur de trame (`src/ui/dnd.js`). Un bloc de tête (l'intitulé, l'auteur de l'acte)
et la liste des annexes ne se déplacent pas : ils sont à leur place par nature.

L'ordre vit **à part du modèle**, dans `values.__ordre` (`src/lib/ordre.js`) :

```
__ordre = { "body": [0, 1, 4, 3, 2, 5], "body.4.blocks": [1, 0] }
```

Chaque entrée donne, pour un **conteneur** (le corps, ou les `blocks` d'un article/d'une
division), la suite des **rangs d'origine** de ses entrées. Un conteneur sans entrée suit
l'ordre de la trame : le plan ne se matérialise qu'à partir du premier geste. `deplacerVers`
écrit une entrée, `rangerCommeLaTrame` efface tout, `ordresModifies` dit ce qui a bougé.
`compile()` applique l'ordre **après** résolution des blocs (`appliquerOrdre`), puis
**renumérote** articles et divisions dans l'ordre imprimé — sans quoi un article remonté se
lirait à contretemps. Seuls les numéros **automatiques** suivent (`numMode: "auto"`) ; un
numéro écrit à la main reste ce qu'il est, et les **identifiants** (`eId`) ne changent jamais :
ils sont la mémoire des blocs, pas leur rang.

Le réordonnancement est un geste de **rédaction**, non une modification de la trame : la trame
reste intacte, l'onglet « Contrôle » signale les endroits réordonnés (niveau `info`) et propose
de **revenir au modèle** d'un clic. Un acte enregistré conserve son ordre dans ses valeurs.

#### 2.4.2 Ajouter, retirer, régler un bloc (`src/lib/structure.js`)

La trame dit ce que l'acte doit contenir ; l'acte se rédige. Trois gestes de l'atelier touchent
donc à la **structure** du document — jamais à celle du modèle, et jamais sans trace :

| Geste | Ce qui est écrit | Ce qui se passe |
|---|---|---|
| **Retirer un bloc** (corbeille sur le bloc, ou panneau « Bloc ») | `__supprimes[adresse] = true` | le bloc et ses descendants ne sont plus résolus : ni affichés, ni comptés, ni exportés. Ses réécritures ne sont pas effacées — « Rétablir » le rend tel qu'il était |
| **Retirer un élément** (un visa, un considérant) | idem | même mécanisme, à l'adresse de l'élément (`body.2.items.0`) |
| **Ajouter un bloc ou un élément** | `__ajouts[conteneur] ← { id, rang, node }` | le bloc entre dans le document à la place demandée ; son texte vit dans l'ajout lui-même |
| **Régler un bloc** (intitulé, échelon, numérotation) | `__overrides[adresse + `.level` · `.numMode` · `.num` · `.heading`]` | le réglage s'applique à la compilation, et compte parmi les écarts (§ 2.4) |

Un ajout reçoit un **rang synthétique** : il commence après le dernier bloc de la trame de son
conteneur et ne bouge plus. Son adresse est donc de la même forme que celle d'un bloc ordinaire
(`body.5`, `body.3.blocks.2`, `body.2.items.4`) — il se déplace, se commente et se supprime avec
les mêmes outils. `ordreConteneur` (`src/lib/ordre.js`) fait cohabiter ces rangs avec ceux de la
trame ; une insertion **en fin de conteneur** n'écrit aucun ordre (c'est la place naturelle).

Ce qu'un ajout contient se saisit dans l'**ajout**, non dans les écarts : `majAjout` reporte le
texte écrit dans le document sur le nœud de `__ajouts`, et `slotsAjoutes` déclare ces
emplacements pour que leur texte ne soit pas signalé comme « hors trame » — il ne l'est pas, il
n'est pas dans la trame. `compile()` résout les ajouts **après** les blocs du modèle
(`resolveBlocks`, le corps, les listes d'éléments), puis applique l'ordre.

L'onglet **« Contrôle & écarts »** tient les trois registres : réécritures, **réglages** de bloc
(avec leur lecture en clair : « Titre (échelon 1) » / « Chapitre (échelon 2) »), et **structure du
document** (chaque ajout et chaque retrait, avec « Voir et régler » ou « Rétablir »). Un acte
enregistré conserve le tout dans ses valeurs.

Un ajout peut être un **bloc de texte hors article** — un paragraphe, une liste, un tableau posé
dans le corps du document ou dans une division — et non seulement un article, une division ou un
élément de liste. Il appartient alors au même jeu de types que les blocs d'un article
(`para`, `list`, `table`, `raw`) et suit le même chemin partout : le rendu (`src/lib/render.js`),
le Markdown et l'Akoma Ntoso (où il est rangé dans un `<block name="disposition">`, repris à
l'import par `src/lib/akn.js`), l'export HTML/Word et l'impression.

### 2.5 Modification d'un acte

Un acte signé ne se réécrit pas : il se modifie. L'écran « Modifier un acte » n'est pas un
formulaire : c'est **l'acte en vigueur lui-même**, rendu éditable comme dans un traitement
de texte (passages `contenteditable`, abrogation et insertion d'article d'un clic). Chaque
geste est traduit en amendement (`src/lib/amend-edit.js`, adresses stables calculées sur le
document d'origine), puis `buildModificatif` produit l'**acte modificatif** et
`buildConsolidated` la **version consolidée** lorsque la modification est confirmée. Les
**divisions** (§ 2.2.3) ne sont pas un obstacle : les articles d'un texte rangé en Livres, Titres
ou Chapitres s'atteignent comme ceux du corps (`flatNodes`, l'ordre imprimé qui sert à la fois
d'adresses de saisie, de plan de modifications et de numérotation continue) ; un article inséré
« après » un article de division prend place **dans cette division**, et « ajouter en fin de
dispositif » entre dans la **dernière** division quand le texte s'y termine. La version consolidée est présentée par défaut dans sa **seule rédaction en vigueur**, chaque
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

**Modifier une annexe.** Une annexe (§ 2.2.4) ne se modifie pas article par article comme un
acte ordinaire : l'acte modificatif en **adopte la nouvelle rédaction**. C'est le régime ouvert
par défaut par l'écran « Modifier » (`state.modifier.suivi`, décochable) :

- l'**intitulé** de l'acte modificatif devient « … portant adoption de la nouvelle rédaction de
  {l'annexe} » (`annexesVocab().adoptTitle`), et son **objet** de même — la tournure emploie
  `{targetDe}`, l'appellation de la cible *contractée avec « de »* (« portant adoption de la
  nouvelle rédaction **du** règlement intérieur n°… », et non « de le règlement ») ;
- son **article premier** énonce l'adoption, en citant l'annexe (`clauseAdoption`) ; les
  modifications la suivent, **décalées d'un rang** de numérotation ;
- la **nouvelle rédaction** de l'annexe suit l'acte modificatif, comme une **partie annexée** de
  son document signé (`doc.annexeDocs`, voir `src/lib/annexe-docs.js`), et l'action est enregistrée
  dans `modActe.adopteAnnexe` / `doc.meta.adopteAnnexe` ;
- le texte consolidé porte, **en tête de ses visas**, l'acte qui vient de l'adopter — le visa de
  l'adoption précédente est remplacé, non empilé —, et la fiche de l'annexe enregistre ce nouvel
  acte d'adoption (`values.__adoption`, `adoptePar`, `nature`).

La modification **classique** (mention expresse, article par article) reste possible en décochant
la case : c'est elle que demande parfois une décision qui vise expressément tel article.

### 2.5 bis Abrogation d'un acte, ou d'un article

Un acte publié ne se supprime pas : il **s'abroge**, par un acte nouveau qui le vise
expressément. L'application distingue donc deux voies, et ne les confond jamais.

**L'abrogation prévue par un acte.** Un acte peut, par lui-même, prévoir l'abrogation d'un
AUTRE acte — ou de l'un de ses articles. Pendant la rédaction, l'onglet **« Abrogations »**
(`src/ui/views/rediger.js`) tient la liste de ces cibles, rangées dans
`values.__abrogations` :

```
{ id, kind: "acte" | "article" | "texte",
  acteId, numero, designation, date, eli,   // photographie de l'acte visé
  article, articleEId,                      // le cas échéant
  texte,                                    // acte hors de l'application
  clause,                                   // réécriture éventuelle de la clause
  appliedAt, appliedOn }                    // posés le jour de l'application
```

Un acte **du registre** se désigne expressément (une liste, pas une saisie) : nature, numéro
et date sont une **photographie** prise à ce moment-là, car la clause d'un acte signé ne se
réécrit pas. Un acte que l'application ne connaît pas ne se vise que par un texte libre — elle
ne pourra pas le marquer abrogé. `src/lib/abrogations.js` (module **pur**) compose la clause à
partir du vocabulaire `config.vocab.abrogation` ; `compile.js` l'insère en **article de
dispositif**, juste avant le bloc de signature, sous un numéro ordinaire.

La clause dit que l'abrogation prend effet **à l'entrée en vigueur** de l'acte qui la porte, et
non à sa publication : `entreeEnVigueur(acte, config)` (`src/lib/execution.js`) rend la date
d'effet déclarée, et à défaut le lendemain de la publication (ou le délai réglé dans
Administration › Publication). Arrivée à ce terme, `src/ui/abrogations-apply.js`
(**idempotent**, marqueur `appliedAt`) applique l'abrogation :

- acte visé **dans son ensemble** → `abrogePar` sur l'acte visé (`enAttente` tant que l'acte
  abrogeant n'est pas publié, puis effectif) ;
- **article** visé → une **version consolidée** de l'acte qui le porte est construite par les
  mêmes mécanismes que l'acte modificatif (`planAmendments` + `buildConsolidated`, action
  `abrogate`), marquée `pendingConsolidation` et `abrogationPar`, et part à la publication.

L'application tourne au démarrage (`src/ui/app.js`) et après chaque publication
(`src/ui/views/signature.js`) ; chaque application entre au journal
(`abrogation.appliquee`).

**Abroger l'acte entier depuis une modification.** L'écran de modification propose aussi
**« Abroger tout l'acte »** (panneau « L'acte entier ») : l'acte modificatif abroge alors tous
les articles, et la version consolidée porte l'avertissement `abrogationNotice`.

**Renumérotation.** Les mêmes mécanismes servent à **réattribuer un numéro** à un article
(refusé s'il est occupé : `numbersUsed`) et à **« tout renuméroter »** (`applyRenumbering`,
option `renum` de `buildConsolidated`). Un article abrogé n'occupe pas de rang : quand la
numérotation est rendue continue, les articles abrogés dont le numéro est repris par un article
en vigueur quittent le texte consolidé.

**Corbeille, retrait, abrogation.** Seuls les actes **non signés** (`isDraftable`) peuvent
être mis à la corbeille. Pour un acte signé ou publié, le registre remplace le bouton corbeille
par **« Retirer / abroger »** : il propose de rédiger un acte d'abrogation (l'intention voyage
jusqu'à l'écran de rédaction par `state.redigerIntent`, et le rédacteur choisit la trame qui la
portera), et — pour un administrateur — mène au **retrait technique du recueil**, mesure
exceptionnelle réservée aux erreurs de dépôt (`POST /v1/publications/{cle}/retrait`).
Le registre et la fiche de l'acte portent le badge **« abrogé »** ou **« abrogation prévue »**
(`abrogationBadge`, `abrogationPhrase` dans `src/ui/components.js`).

**Ce que le recueil public en montre.** Le recueil présente chaque acte **dans sa version la
plus récente** : la liste, ses compteurs et les tuiles de thème partent des publications en
vigueur (`publicationsEnVigueur`), et une case **« Afficher les versions antérieures »**
(visible seulement s'il y en a) les rouvre. Sur la page d'un acte, l'**article abrogé** garde
son intitulé et la mention de l'acte qui l'a abrogé ; sa **rédaction** est conservée dans la
version en ligne (`renderDocument` avec `opts.abrogations` la range dans un bloc
`.doc-abroge-corps`) mais masquée, et la case **« Afficher les articles abrogés »** la révèle.
La page publiée, elle, et son impression, ne la montrent jamais (`buildWebVersion`,
`CSS_DOCUMENT_WEB`).

### 2.6 Signature et publication (démonstration)

Deux écrans, deux services distincts de l'éditeur :

**Signature.** L'application est un **client de l'API REST** du service ; elle n'écrit rien
elle-même. Le service expose :

| Méthode | Ressource | Rôle |
|---|---|---|
| `POST` | `/v1/actes` | déposer l'acte finalisé (Akoma Ntoso) ; idempotent tant que le circuit est ouvert |
| `POST` | `/v1/actes/{id}/signature` | ouvrir un circuit auprès du prestataire → `202` + `signatureId` |
| `POST` | `/v1/actes/{id}/signature-externe` | *(circuit externe)* déclarer la **version signée** déposée (PDF + empreinte) → `201` + statut `signee` |
| `POST` | `/v1/actes/{id}/conformite` | *(circuit externe)* enregistrer la **certification de conformité** du réviseur → `201` |
| `POST` | `/v1/webhooks/signature` | notification entrante du prestataire : retour de l'acte signé |
| `GET` | `/v1/signatures/{id}`, `/v1/signatures/{id}/document-signe` | suivre le circuit, récupérer l'original signé (**part publique** seulement) |
| `GET` | `/v1/actes/{id}/dossier-signature` | lire la **part interne** de l'original (mentions nominatives, courriels) — exige le jeton |
| `GET` | `/v1/courriel` | état de la chaîne d'envoi du service (hôte, expéditeur, disponible ou non) — **sans aucun secret** |
| `POST` | `/v1/courriel/envoi` | demander l'envoi d'une notification par courriel (le service parle au serveur SMTP) |
| `POST` | `/v1/courriel/test` | message d'essai de l'écran d'administration |
| `POST` | `/v1/actes/{id}/transmission` | télétransmettre l'acte signé au contrôle de légalité → `201` + certificat *(fonction expérimentale, § 2.8.2 bis)* |
| `GET` | `/v1/actes/{id}/transmission` | relire le certificat de transmission |
| `POST` | `/v1/actes/{id}/publication` | publier et attribuer l'ELI |
| `POST` | `/v1/publications/{cle}/retrait` | retirer un acte du recueil (motif technique exigé, administrateur seul) |
| `POST` | `/v1/publications/{cle}/epingle` | épingler un acte à la « une » du recueil public (corps `{ epingle, auteur }`) |
| `GET` | `/v1/publications`, `/v1/publications/{cle}`, `/v1/eli/{...}` | registre public et résolution ELI |
| `POST` | `/v1/admin/purge` | **remettre le service à zéro** (actes déposés, circuits, publications ; corps `{ confirmation: "repurge" }`, administrateur seul) — le pendant, côté service, de « Repartir d'un référentiel vierge » |
| `GET` | `/v1/config` | **réglages de référentiel posés par le `.env`** (identité, vocabulaire, numérotation, délais, recueil, fonctions), sous forme de chemins pointés, avec les valeurs refusées ; public, sans secret (§ 2.7 bis.3) |

Les lectures sont publiques ; les écritures exigent `Authorization: Bearer <jeton>`
(`401` sans jeton, `403` si le jeton est invalide, `429` au-delà de 90 écritures par
minute et par réseau, `409` pour un acte déjà signé **ou dont le circuit de validation
n'est pas achevé** (`409 validation_incomplete` — voir § 2.8.1) **ou dont la
transmission au contrôle de légalité manque** (`409 transmission_absente` — voir
§ 2.8.2 bis), `422` si la date de publication précède la signature, `422 motif_absent` si le
motif d'un retrait du recueil manque).
`POST /v1/actes/{id}/publication` accepte un en-tête `Idempotency-Key`.

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
rien n'est lu dans les données locales. Le recueil public et la consultation d'une
publication rendent le texte **dans la page** (§ 2.6 bis).

L'**encart des annexes** (§ 2.2.4) fait partie de la version en ligne : le document publié dit
s'il est lui-même une annexe — et de quel acte — ou quels documents il annexe. C'est nécessaire,
puisque l'annexe n'a pas de publication propre : c'est la version en ligne de **l'acte qui
l'adopte** qui porte son texte, et c'est par cet encart, et par le visa d'adoption du document,
que le lecteur remonte de l'un à l'autre. Le registre public, lui, n'exploite pas encore ce lien
(voir `TODO.md`).

**Le retour signé publie l'acte.** Le webhook accepté (§ ci-dessus) déclenche la
**transmission au contrôle de légalité** si elle est active (§ 2.8.2 bis), puis la
publication **automatique** de l'acte **publiable** : `publierApresSignature`
(`src/ui/views/signature.js`) publie avec la date du jour — sauf si la date de signature
est à venir, auquel cas c'est elle qui est retenue, la publication ne pouvant précéder la
signature. Un acte **individuel** (`publishable: false`) s'arrête à la signature :
conservé au registre, il est notifié à l'intéressé. La publication manuelle reste offerte
depuis l'onglet « Publication (ELI) » (date, recueil, consolidation) et emprunte le même
`publier()`.

Cet automatisme se **règle** (Administration › Publication, `config.publication.auto`, vrai
par défaut) : éteint, `publierApresSignature` s'arrête après la signature — ni publication,
ni transmission —, et l'acte signé attend au registre (§ 2.6 bis).

Si le service ne connaît pas l'acte au moment de publier (il a redémarré, ou l'acte a été
signé sur un autre poste), le client le **redépose** avec sa signature déjà approuvée —
le service revérifie l'empreinte — puis republie. Dans le circuit externe, le client
rejoue de la même façon la **déclaration de la version signée** et la **certification**,
et il le fait aussi quand le service répond `409 version_signee_absente` ou
`409 conformite_non_certifiee` alors qu'il détient lui-même la pièce et l'attestation :
la publication porte ce que le client a.

#### 2.6 ter Le circuit de signature externe (papier, ou outil tiers)

Le circuit électronique suppose un prestataire joignable en API. Ce n'est pas toujours le
cas : une collectivité peut faire signer ses actes **sur papier**, ou par un outil qu'elle
ne pilote pas (parapheur hors ligne, service web sans API, signature manuscrite scannée).
Un second circuit existe donc, qui **n'appelle aucune API de signature** et se décrit dans
`src/lib/externe.js` :

1. le **rédacteur** « envoie à signature » — ce qui veut dire **télécharger** le document
   prêt à signer (une page A4 précédée d'un **bordereau de remise** : référence, objet,
   entité, trame, date, empreinte du document remis, marche à suivre) ;
2. le signataire signe **hors de l'application** ;
3. le rédacteur **rentre la version signée** — « Ajouter la version signée », un **PDF**
   (contrôle du type, empreinte SHA-256 calculée dans le navigateur, fichier déposé par
   `upload-plugin`) —, et l'acte passe à `signee` ;
4. le **réviseur** compétent **certifie la conformité** de la **pièce signée** avec la
   version numérique qui sera publiée ; son contrôle ne porte donc plus sur le texte
   *avant* signature, mais sur le document *signé* — c'est ce qui garantit que ce qui est
   publié est bien ce qui a été signé ;
5. la publication dépose la version en ligne **et** le PDF signé, qui devient l'« original »
   sur le recueil public.

**Réglage, à deux niveaux.** Le circuit se règle **globalement** (`config.signature.mode`,
Administration › Signature : `electronique` — défaut, comportement historique —, `simple`,
ou `externe`) et **par trame** (`trame.signature`, onglet « Trame » de l'éditeur) :

| `trame.signature` | Effet |
|---|---|
| `""` (défaut) | suit le réglage général |
| `externe_impose` | circuit externe, sans choix possible |
| `externe_autorise` | le rédacteur choisit, **acte par acte**, le circuit externe |
| `simple_impose` | signature simple imposée (dans l'application) |
| `simple_autorise` | le rédacteur choisit, **acte par acte**, la signature simple |
| `electronique` | circuit électronique imposé pour cette trame |

`circuitPour(config, trame)` rend le circuit retenu, `circuitsDisponibles(config, trame)` la
liste de ceux entre lesquels le rédacteur peut réellement trancher, et
`modeSignature(config, trame, acte)` celui de l'acte, en tenant compte de son choix
(`acte.signatureMode`) quand la trame l'autorise. **Un acte déjà engagé dans un circuit y
reste** : `acte.externe` ouvert, `acte.signatureSimple` donnée, ou `acte.api` déposé — avec
`acte.signatureMode === "simple"` ou `acte.api.niveau === "simple"`, puisque le circuit simple
dépose lui aussi l'acte au service (c'est le même dossier, seul le niveau demandé diffère).

**Le dossier sur l'acte** (`acte.externe`) : `statut` (`a_signer`, `signe_depose`,
`certifie`, `refuse`), la trace de la remise (`demandeLe`, `demandeParNom`, `document` avec
son empreinte), la version signée (`signe` : `url`, `sha256`, `nom`, `taille`, `deposeLe`,
`deposeParNom`), la certification (`certification` : `statut`, `par`, `parNom`, `le`,
`empreinte`, `sha256Signe`, `points`, `remarque`, `motif`) et `certificationRequise` —
`true` dès lors qu'un réviseur est compétent pour l'acte.

**Côté service**, c'est lui qui tient l'ordre « version signée → conformité certifiée →
publié » : `hPublier` refuse par `409 version_signee_absente` tant que la pièce manque, et
par `409 conformite_non_certifiee` si `certificationRequise` est vrai et que la
certification n'est pas `conforme`. `hSignatureExterne` **annule** la certification
précédente à chaque nouvelle version signée (elle portait sur l'ancienne pièce), et
`hConformite` refuse une certification dont l'empreinte signée ne correspond pas à la
pièce déposée (`409 certification_incoherente`). Un refus de conformité repasse l'acte au
statut `depose` : il attend une version signée conforme.

**Sur le recueil public**, l'« original » d'un acte du circuit externe n'est plus le paquet
JSON du prestataire, mais la **version signée elle-même** : la page publique affiche le PDF
dans un cadre de lecture, avec son empreinte, sa date de dépôt, et l'attestation de
conformité du réviseur — c'est la pièce **telle qu'elle a été mise en ligne** qui fait foi,
le texte en ligne n'en étant qu'une lecture pratique. La **fiche de l'acte** et l'onglet
« Original signé » de la publication montrent la même pièce, et l'**onglet « Révision »**
gagne une file « **Certifications (signature externe)** » : c'est là que le réviseur trouve
les pièces à certifier. Un acte dont la version signée attend certification est **ouvert
aux réviseurs compétents même hors de leur périmètre** (comme l'est un acte soumis à
révision) : sans quoi leur contrôle ne pourrait pas s'exercer.

**Jeu de démonstration.** Le registre est livré garni (`src/lib/demo-actes.js`) : **soixante-six
actes** sur **vingt et une trames**, dont **quarante-neuf rédigés et posés comme signés** (document
compilé depuis sa trame, exporté en Akoma Ntoso, signé par `buildSignedPackage` — certificat,
ECDSA P-256, horodatage, donc vérifiables), quatorze prêts à signer, trois brouillons incomplets, un
acte **en attente de révision** et un acte **rejeté** en révision, revenu en brouillon avec son
motif. Un acte signé porte en outre la trace d'une **révision validée** (avec correction du
réviseur), et un autre la trace d'un **recours contentieux** introduit. Deux de ces actes sont des
**actes individuels non publiables** (trame `tpl-revalorisation`, `publishable: false`), l'un signé
et l'autre prêt à signer. **Sept** forment le cas de l'**annexe** : un document adopté par un autre
acte (trame de nature `annexe`) — le règlement intérieur du conseil, le règlement d'accès à la
restauration scolaire, la grille tarifaire des services municipaux, la charte de la participation
citoyenne, et les documents joints à une manifestation (plan de circulation et de stationnement,
programme de la fête du village, stationnement et déroulé de la cérémonie du 11 novembre). L'annexe
porte le visa de son acte d'adoption, l'acte l'annonce en fin de dispositif, et **l'original signé
de l'acte est suivi du texte de l'annexe** : l'annexe ne se signe ni ne se publie pour elle-même.
**Quinze** actes sont publiés au recueil (voir `src/ui/demo-publications.js`), dont quatre **à la
une** : le règlement de la restauration scolaire, la grille tarifaire, la fête du village et le
marché de Noël — deux annexes, deux événements. Leurs
**transmissions au
contrôle de légalité** portent leur **certificat** (`certificatTransmission`, mêmes
mentions et même sceau que le service). Ils ne sont posés que sur un registre de
démonstration vide (`SEED_VERSION`, identifiants `acte-demo-*`) : jamais sur un registre
réel.

#### 2.6 quater La signature électronique simple, et l'original à deux parts

Deuxième alternative au prestataire, le circuit **simple** fait signer **dans l'application**,
avec le **compte** du signataire — sans prestataire, sans papier. C'est la réponse au cas
ordinaire d'une collectivité qui n'a ni API de signature branchée, ni envie de faire circuler
des pièces.

**Le geste.** Depuis « Ma signature » (« **Vérifier et signer** ») comme depuis le circuit de
l'acte, `engagerSignatureSimple` franchit les mêmes portes que le circuit électronique
(parapheur, puis révision), **dépose** l'acte au service (`POST /v1/actes`, `signatureMode:
"simple"`), **ouvre** le circuit (`POST /v1/actes/{id}/signature`, `niveau: "simple"`), puis
ouvre la **fenêtre de signature** (`fenetreSignatureSimple`) : le document sous les yeux,
l'identité du signataire (nom, fonction, adresse électronique, compte), l'empreinte du texte, et
une **déclaration à cocher** — « Je déclare avoir vérifié le document ci-dessus et j'engage ma
signature sur son contenu. » Le bouton de signature reste **désactivé** tant que la déclaration
n'est pas cochée.

**La signature.** `signerSimple` produit le même paquet que le circuit électronique
(`buildSignedPackage` : ECDSA P-256 + SHA-256, certificat par navigateur, horodatage signé par une
seconde clé), mais avec `prestataire: null` — il n'y a pas de tiers — et avec la **part interne**
(`dossierSignatureInterne`). Le paquet part au service par `POST /v1/webhooks/signature`, qui
**recalcule l'empreinte** et la compare à celle du document déposé (`409 empreinte_divergente`
sinon) : la vérification ne dépend pas du circuit. L'acte passe à `signee`, puis la publication
suit (`publierApresSignature`), comme pour tout autre circuit.

**Ce qui est conservé, et où.** La signature simple est celle qui porte le plus de mentions
nominatives — c'est dans la nature du procédé. Elles sont donc **partitionnées** :

| Part | Contenu | Diffusion |
|---|---|---|
| **Publique** | nom, fonction, date de signature, empreinte, valeur de signature, certificat, horodatage | recueil public, `GET /v1/publications/{cle}`, export JSON de l'original, `GET /v1/signatures/{id}/document-signe` |
| **Interne** | nom, fonction, **adresse électronique**, `personId`, `compteId`, compte de signature, moyen d'authentification, poste, adresse réseau, horodatage, **courriels** | registre du service (`rec.originalInterne`, jamais servi par une route publique) ; en clair pour qui peut lire l'acte — « Dossier de signature (interne)… » dans l'application, ou `GET /v1/actes/{id}/dossier-signature` (protégée par le jeton) |

`partiePublique(pack)` (pure, `src/lib/signature.js`) est ce qui **retire** : elle supprime la clé
`interne` du paquet et, dans chaque signature, l'adresse électronique, `personId`, `compteId`,
`compteOutil` et l'état de rapprochement. Elle s'applique **aussi au circuit électronique** : un
signataire du prestataire voit sa part publique réduite de la même façon. `dossierInterne(pack)`
et `originalInterneDe(acte)` composent la part interne au moment de la publication.

Le champ `niveau` de la signature (`simple` / `avancee`) dit le procédé employé ; il voyage dans
la publication (`signature.niveau`) et sur l'acte (`acte.signatureSimple.niveau`).

#### 2.6 quinquies Les notifications par courriel, et le serveur SMTP

Scribae **n'envoie pas** de courriel : il **demande** au service de le faire
(`POST /v1/courriel/envoi`), et c'est le service qui parle au **serveur SMTP** de la
collectivité. La séparation est nette, et volontaire : l'application n'a **jamais** accès au
mot de passe SMTP, et `GET /v1/courriel` ne rend que l'**état** de la chaîne (hôte, port,
chiffrement, adresse d'expédition, authentifié ou non, disponible ou non).

**La politique** est une donnée du référentiel (`config.courriel`, Administration ›
**Courriel**, lue par `courrielSettings`) : activation générale, nom d'expéditeur, adresse de
réponse, **copie systématique**, et six **événements** activables — `demande_signature` (au
signataire désigné), `signature_donnee`, `acte_publie` (au rédacteur et aux éditeurs),
`acte_a_valider` (à l'agent dont c'est l'étape), `acte_a_reviser` (aux réviseurs compétents),
`notification_interesse` (aux destinataires désignés). `envoyerNotification(evenement, ctx)`
(`src/lib/courriel.js`) résout les destinataires (par compte, par rôle, adresses valides,
**déduplication** par adresse), écarte ceux qui ont **déjà** été notifiés pour cet acte et cet
événement (les envois réussis seuls comptent comme tels), et **ne lève jamais** : un courriel
qui ne part pas rend une **trace** `{ evenement, destinataires, envoye: false, motif }`.

**Les traces.** Chaque envoi est journalisé (`courriel.envoye` / `courriel.non_envoye`) et
**consigné sur l'acte** (`acte.courriels`), qu'il soit parti ou non : c'est la piste de qui a
été prévenu et quand, elle alimente le **dossier interne** de l'original, et l'écran
« Dossier de signature (interne)… » la montre (les envois manqués en rouge, avec leur motif).

**Le moteur SMTP** (`src/server/mysql/smtp.mjs`) est écrit pour l'occasion, sans dépendance :
RFC 5321 (EHLO, capacités annoncées, `STARTTLS`, `AUTH LOGIN` et `AUTH PLAIN`, `MAIL FROM` /
`RCPT TO` / `DATA` avec le doublement des points), RFC 2047 (encodage du sujet) et RFC 2045
(MIME `multipart/alternative`, base64 par lignes de 76). Il prend un **transport injecté**
(`lireReponse`, `ecrire`, `demarrerTls`, `fermer`), ce qui le rend testable sans réseau.
`src/server/mysql/courriel.mjs` le branche : lecture des `SMTP_*` du `.env`, choix du
chiffrement (`ssl`, `starttls`, ou aucun — déduit du port à défaut de réglage), transport
`net`/`tls`, et l'état rendu sans secret. Le service journalise les envois dans **`sb_courriel`**
(table du schéma) et les expose dans « Derniers envois ».

**En démonstration**, le service embarqué n'a pas de serveur SMTP : `GET /v1/courriel` répond
`disponible: false` avec son motif, `/v1/courriel/envoi` et `/v1/courriel/test` répondent `503`
`courriel_indisponible`, et chaque notification est **tracée « non envoyée »** — l'application
reste entièrement utilisable, et la chaîne se vérifie au premier déploiement. Sur le **service auto-hébergé**, la même route
rend `200` quand le message est remis au serveur SMTP et `502 envoi_refuse` quand celui-ci le
refuse (le motif est rendu tel quel, et l'écran d'administration le montre) ; chaque tentative,
réussie ou non, est consignée dans `sb_courriel`.

#### 2.6 bis Le recueil public des actes

La publication produit deux choses distinctes : le **texte publié** (la version en ligne,
conservée par le service, opposable) et sa **consultation publique** — le **recueil**. Les deux
sont séparés parce qu'ils ne s'adressent pas au même lecteur : l'administration lit le
**registre** (métadonnées, versions d'un même ELI, formats, original signé, vérification de
signature), le public lit le **recueil**.

**Le recueil** (`src/ui/views/recueil-public.js`) est un **site sans compte**, servi par la même
page sous la route `#/recueil` (la liste) et `#/recueil/<clé>` (un acte). Il est rendu **avant la
porte de connexion** (`app.js`, `EST_PUBLIQUE`) : ni écran de connexion, ni cloche, ni rien du
logiciel — seulement la **structure** (son logo, son nom), le **titre du recueil**
(`config.publication.recueil`) et les actes **réellement publiés**. Le **bandeau de
démonstration** (« mention de démonstration », § 2.7 bis) s'y affiche aussi, comme dans l'atelier :
un visiteur doit savoir quand l'installation qu'il consulte est une démonstration. Il ne lit
aucune donnée locale : il **interroge le service** (`GET /v1/publications`), comme le ferait
n'importe quel visiteur.

**Le recueil est aussi la porte d'entrée de l'application.** Pour qui n'a pas de compte, c'est
l'interface de l'installation (§ 2.7.3) : son en-tête porte donc **« Se connecter »** tant
qu'aucune session n'est ouverte — la porte de l'atelier, vue de la rue —, **« Retour à
l'application »** quand une session l'est, et **« Mon accès »** pour un visiteur authentifié sans
rôle. La session ne change rien au recueil lui-même : un agent connecté y lit exactement ce que
lit un passant.

**C'est également la page d'accueil du logiciel** : une adresse sans route — ni ancre, ni
paramètre — ouvre le recueil, jamais l'atelier. La route par défaut de l'application est donc
`recueil` (`src/ui/state.js`), et **une adresse inconnue y ramène** (`normaliserRoute`,
`src/ui/app.js`) : une ancre mal recopiée, ou un écran qui n'existe plus, ne doit pas ouvrir
l'atelier — et encore moins l'écran de connexion. L'atelier s'ouvre par la porte **« Se
connecter »** du recueil, ou par l'ancre `#/trames` — que l'application n'écrit jamais
elle-même : elle n'écrit dans l'adresse que les paramètres du recueil (`?acte=`, `?recueil=1`),
parce que ce sont eux qui donnent à un acte publié une adresse citable.

**La page d'accueil du recueil** — la « page d'accueil de l'interface publique » — n'est pas un
registre : c'est l'entrée d'un site. Elle se lit de haut en bas :

1. **L'entrée** (`hero`) : le nom de la collectivité, le titre du recueil, une phrase qui dit ce
   qu'on y trouve, la **recherche**, et une ligne de chiffres (actes publiés, thèmes, dernière
   publication).
2. **Les derniers actes administratifs publiés** : un **carrousel** (`carrousel`) des actes en
   **vigueur** les plus récents. La piste défile au doigt, à la molette ou par deux **flèches**,
   avec des **points** qui disent où l'on est ; le défilement est **natif** (`scroll-snap`), donc
   il fonctionne même sans JavaScript — les flèches ne sont qu'un confort. Chaque **carte** met
   en avant le **thème** de l'acte (voir plus bas), puis son objet, son numéro et sa date.
3. **Parcourir par thème** (`themesZone`) : une **grille de tuiles**, une par thème présent dans
   le recueil, avec sa **présentation** — le texte écrit dans Administration › Familles — et le
   nombre d'actes. La tuile **filtre** la liste sur son thème (et se dé-filtre au second clic) ;
   elle porte une **teinte** stable, déduite de l'identifiant de la famille, qui n'est qu'un
   repère visuel.
4. **Tous les actes publiés** : la **recherche** et les filtres fins (**thème**, nature, année,
   organisation), puis la liste **groupée par année**.

- **Recherche, thèmes et navigation** (`src/lib/recueil.js`) : un texte libre (numéro, objet,
  nature, thème, entité, ELI), quatre filtres déduits des actes réellement présents (**thème**,
  **nature**, **année**, **organisation**), et une liste **groupée par année** — le recueil se lit
  comme un recueil, et non comme un journal de dépôts. Le filtre « thème » a sa sentinelle
  (`SANS_THEME`) : « les actes sans thème » n'est pas la même chose que « tous les actes ».
- **Le thème d'un acte** est la **famille de sa trame** (`config.families`) : c'est la matière
  dont l'acte traite (« Urbanisme et voirie », « Police administrative », « Finances et budget »…).
  C'est le classement que la page d'accueil met en avant. La publication porte `themeId` et
  `themeLabel`, **transmis au dépôt** par le client (le service ne connaît pas les trames, comme
  pour `publishable`) : `views/signature.js` les envoie au dépôt de l'acte puis à sa publication,
  le service les conserve (`resumePublication`, `ficheActe`) et les rend dans le JSON, le JSON-LD
  (`dcterms:subject`) et l'index du recueil (`indexRecueil.themes`). La **vue** résout le libellé
  au référentiel (renommer une famille suit donc partout) et, pour les actes publiés **avant** que
  le thème ne soit transmis, retrouve la famille par l'**acte local** (`themeDePublication`,
  `views/acte-publie.js`) : ce repli ne vaut que sur un poste qui détient le registre. L'unicité du
  thème dans un acte est celle de sa famille de trame : le choix du thème **se fait donc en
  choisissant la famille de la trame** (Administration › Familles, et « Famille » dans la trame).
- **La présentation d'un thème** (`config.families[].description`) s'édite dans Administration ›
  Familles et s'affiche sous le nom du thème, sur le recueil public.
- **L'acte est rendu dans la page**, jamais dans une fenêtre ni dans une feuille : la version en
  ligne publiée est une page HTML autonome ; on en prélève le **document** (`extraireVersion`),
  **pas sa feuille de style** — la **charte** d'un acte vaut pour le **papier** (PDF, Word, page
  autonome), pas pour la version en ligne. `CSS_DOCUMENT_WEB` pose la présentation web à partir
  des styles de lecture de l'application (`.doc*`, `src/css/app.css`) : la décision n'est donc
  **pas enfermée dans une feuille**, elle fait partie de la page, dans l'apparence du recueil
  (l'interface publique a sa propre personnalisation, indépendante des chartes d'actes). Le
  **texte occupe toute la largeur disponible** et adopte la **police de l'interface**
  (`--font-ui`), pour une lecture homogène avec le reste du site ; la **liste** des actes garde,
  elle, une largeur de lecture. Les jetons de couleur sont ramenés aux valeurs **thémées** du site
  (`--ink-public`, `--brand-public`, copies posées sur `:root` dans `src/css/app.css`) : le texte
  reste lisible en mode sombre, sans redevenir une feuille blanche.
- **La présentation est la même** dans le recueil public et dans la consultation de
  l'administration : `views/acte-publie.js` réunit la **notice** (marques de version, titre, bloc
  de métadonnées), le **texte**, puis les blocs **pièces**, **signature** et **versions**.
- **L'original signé se consulte dans le recueil public, à la demande** : `blocOriginal`
  (`views/acte-publie.js`) ne déploie pas le document d'office — il offre un bouton **« Voir
  l'original signé »** qui l'ouvre dans une **fenêtre**, où on peut aussi l'**imprimer ou
  l'enregistrer en PDF**. La pièce est le document **tel qu'il a été signé** — texte suivi du bloc
  de signature (identité, certificat, empreinte, horodatage) ; le texte en ligne n'en est qu'une
  lecture. L'administration ouvre le même document dans son onglet « Original signé ».
- La consultation d'une publication depuis l'administration (`views/publications.js`) rend le
  **même** corps, par le **même** `corpsDeLActe` ; l'écran « Publications (ELI) » renvoie au
  recueil plutôt que d'ouvrir la page HTML autonome — qui reste pour l'impression, le PDF et le
  téléchargement. Deux adresses à ne pas confondre : `hrefRecueil`/`hrefActe` (adresses **relatives**,
  `?recueil=1` et `?acte=<clé>`) servent à **naviguer** dans la page, `adresseRecueil`/`adresseActe`
  (adresses **absolues**, `perchance.org/<générateur>?acte=<clé>`) à **citer et partager** l'acte —
  et, sur un déploiement serveur, `/recueil` et `/recueil/<clé>` (§ 2.6 ter).

- **Le recueil renvoie vers les recueils qu'il ne gère pas.** Une collectivité arrive rarement
  vierge : elle a tenu, avant Scribae, d'**autres recueils**. Le recueil public le dit donc au
  lecteur, à **deux endroits** — en **bas de page** de l'espace public (`pied`) et **au bout des
  résultats de recherche** (`zoneResultats`, dès qu'un filtre est posé ou que la recherche ne donne
  rien) —, sous le titre **« Vous ne trouvez pas ce que vous recherchez ? »**. Le bloc
  (`blocAilleurs`/`groupeAilleurs`/`itemAilleurs`, `views/recueil-public.js`) liste les renvois en
  deux groupes : **« Autres recueils »** et **« Sites de référence »**. Il n'est **jamais montré
  deux fois sur la même page** : quand le lecteur est dans une recherche, `peindreResultats` masque
  celui du pied de page (attribut `hidden`) — le pied n'étant pas redessiné au fil de la frappe.
  Les renvois sont des **données du référentiel** (`config.publication.recueilsExternes`, voir
  ci-dessous) ; le bloc n'apparaît que s'il en existe **au moins un pourvu d'une adresse**
  (`recueilsExternes(config)` — une entrée à moitié remplie ne s'imprime pas), et l'adresse est
  complétée d'un schéma si l'administration a saisi « www.exemple.fr » (`urlRecueilExterne`).

- **Trois natures de renvoi** (`TYPES_RECUEIL_EXTERNE`, `src/lib/recueil.js`), parce que les trois
  ne se lisent pas de la même façon : un recueil **« bis »** (`bis`) — un recueil parallèle, tenu
  hors de Scribae pour une raison technique (une entité autonome, un périmètre séparé) ; un recueil
  **inactif** (`inactif`) — un recueil qui n'est plus alimenté —, qui porte sa **période**
  (`du`/`au`, toutes deux facultatives) rendue par `periodeRecueil` (« actes publiés du … au … ») :
  c'est ce qui distingue **deux recueils successifs** quand un changement de logiciel en a laissé
  plusieurs derrière lui ; et un **site de référence** (`ressource`) — Légifrance, service-public.gouv.fr
  ou tout autre site utile au lecteur, qui ne contient pas les actes de la collectivité mais les
  textes et les démarches qui les entourent. Le libellé d'un renvoi se pose aussi en **précision**
  facultative (`note`), qui explique au lecteur pourquoi ce recueil existe ou pourquoi il s'est
  arrêté.

- **Ces renvois se règlent** dans Administration › **Publication**, sous la carte **« Recueils
  extérieurs et renvois »** (`recueilsExternesBloc`, `views/referentiel.js`) : libellé, adresse,
  nature, période pour un inactif, précision. On les **ajoute**, les **ordonne** (montée/descente),
  les **retire**. Le modèle et la fabrique vivent dans `src/lib/recueil.js` (`newRecueilExterne`,
  `RENVOIS_RECOMMANDES`) ; Légifrance et service-public.gouv.fr sont livrés comme **entrées ordinaires**
  de la liste — modifiables, retirables —, et un bouton **« Rétablir les renvois livrés »** les fait
  revenir d'un clic. La migration additive `migrateRecueilsExternes` (`src/lib/store.js`) pose une
  **liste vide** sur un référentiel réel et les renvois livrés sur le jeu de démonstration.

**Mentions du pied de page.** L'espace public se termine par ses **mentions** : les **mentions
légales** — qui rappellent à quelles conditions un acte publié est exécutoire et opposable (publication
et transmission au représentant de l'État, article L. 2131-1 du CGCT ; délai de recours de deux mois,
article R. 421-1 du CJA) — et les **mentions d'accessibilité** (article 47 de la loi n° 2005-102 du
11 février 2005, RGAA, déclaration d'accessibilité et voie de recours devant le Défenseur des droits).
Elles suivent le même régime que les renvois : ce sont des **données du référentiel**
(`config.publication.mentions`, voir `src/lib/recueil.js`, `MENTIONS_PUBLIQUES` / `MENTIONS_DEFAUT` /
`mentionsPubliques`), que l'administration écrit, remplace ou éteint.

Chaque mention se présente de **trois façons** (`mode`) : **`texte`** — le texte du référentiel
s'affiche dans un bloc **replié sous son titre** (`<details>`, `blocMentions`) : présent dans la page,
donc trouvable par un moteur comme lisible par un agent, sans noyer le pied de page ; **`lien`** — le
pied de page ne porte qu'un **renvoi** vers la page de la collectivité (les mentions légales du site
principal, la déclaration d'accessibilité, par exemple) ; **`aucune`** — la mention ne s'affiche pas.
Une mention **à moitié remplie ne s'imprime pas** : un lien sans adresse, un texte vide et une mention
éteinte ne rendent rien (`mentionPublique` renvoie `null`) — mieux vaut une mention absente qu'une
rubrique vide ou un lien mort. L'adresse est complétée d'un schéma si l'administration a saisi
« www.exemple.fr » (`urlAvecSchema`, employé aussi par les renvois du recueil). Le texte se découpe en
**blocs** (`blocsMention`) selon deux règles qu'on devine sans les apprendre : une **ligne vide** sépare
deux paragraphes, une ligne qui commence par **« - »** (ou « • », « * », « 1. ») devient une **puce**.
Le rendu habille ces blocs (`.recueil-mention__texte`, `.recueil-mention__liste`, `src/css/app.css`).

Ces mentions se règlent dans Administration › **Publication**, sous la carte **« Mentions du recueil
public »** (`mentionsPubliquesBloc`, `views/referentiel.js`) : présentation (texte / lien / aucune),
titre, texte, libellé et adresse du lien — et un bouton **« Rétablir le texte livré »** par mention, le
texte livré n'étant jamais perdu, seulement recouvert. La migration additive `migrateMentionsPubliques`
(`src/lib/store.js`) pose les mentions **actives** sur un référentiel antérieur — elles rappellent des
règles qui valent pour toute collectivité —, et les textes de la fiction sur le jeu de démonstration :
les mentions légales de la Ville de Valmont-sur-Loire y sont **écrites** (éditeur, directeur de la
publication, tribunal administratif d'Orléans), et l'accessibilité y est un **lien** vers la déclaration
publiée sur le site principal — les deux formes à l'écran.

**Amorçage de la démonstration.** Un service neuf ne contient aucune publication, donc le recueil
serait vide : `src/ui/demo-publications.js` (`amorcerRecueil`, appelé en fin d'amorçage par
`app.js`) publie au premier démarrage les actes que la fiction déclare publiés — ceux qui portent
une constatation de publication —, par le **même chemin** que l'écran de signature
(`publierActeDuSeed`), de sorte que le registre local et le service racontent la même chose. Le
geste vaut pour les actes **signés** comme pour les actes **déjà publiés au registre local** : un
service remis à zéro (état perdu, installation neuve) doit retrouver son recueil, sans quoi le
registre et le recueil se contrediraient. `publierActeDuSeed` ne se fie donc pas au statut local
pour dire « c'est publié » : il retire la publication locale le temps de l'appel et la repose
seulement si le service a **réellement** publié. Le **redépôt** rétablit aussi ce qu'un service
neuf a perdu : la signature (`retablirActe`) et, quand l'acte est soumis au contrôle de légalité,
sa **transmission** — sans quoi le service refuserait la publication (`transmission_absente`,
§ 2.8.2 bis). Idempotent, silencieux, et réservé au jeu de démonstration intact (`acte-demo-*`,
`tpl-*`).

#### 2.6 ter Le recueil ouvert : les moteurs de recherche et les agents

Un acte publié est une **donnée publique** : ce ne sont pas seulement des humains qui la
consultent, ce sont aussi les **moteurs de recherche** et les **agents** (LLMs). Or ces lecteurs-là
n'exécutent pas une application : il leur faut des **adresses stables** et des **représentations
qu'ils savent lire**. C'est ce que le logiciel appelle le **recueil ouvert**, et c'est la raison
d'être des routes décrites ici.

- **Une adresse par acte, et elle ne change pas.** Sur un déploiement auto-hébergé
  (`__SCRIBA_SELF_HOSTED__`), le service sert `/recueil` (la liste), `/recueil/<clé>` (un acte) et
  `/recueil/<clé>.<ext>` (une représentation) : ce sont de **vraies pages HTML**, rendues côté
  serveur, sans JavaScript (`src/server/mysql/actes.mjs`, `pageActe`/`pageRecueil`). Ailleurs —
  démonstration statique, plateforme —, la page porte elle-même ces adresses en **paramètres de
  requête** (`?acte=<clé>`, `&format=md`), lues par `parseRoute` avant toute autre route.
- **Une représentation par usage** (`FORMATS_OUVERTS`, `src/lib/recueil.js`) : **JSON** (métadonnées,
  ELI, texte), **Markdown** (la structure de l'acte — la plus lisible pour un agent), **texte brut**,
  et **Akoma Ntoso** (le document normé). Le texte déposé à la publication voyage avec elle
  (`formats.md`, `formats.texte`) : la représentation publiée dit la même chose que la version en
  ligne, et **les notes de préparation en sont écartées** — c'est l'acte qui est publié, pas
  l'atelier.
- **Les fichiers du recueil** (`FICHIERS_OUVERTS`) : `/llms.txt` (le recueil présenté aux agents,
  convention `llms.txt`), `/recueil.json` (l'index complet), `/sitemap.xml` (une adresse par acte),
  `/robots.txt` (ce qui peut être parcouru). Servis par le service ; annoncés dans le pied du
  recueil **uniquement** là où un serveur les sert.
- **L'accueil du recueil ouvert** (`pageRecueil`, `src/server/mysql/actes.mjs`) suit l'accueil de
  l'application : les derniers actes publiés défilent sur une ligne (`scroll-snap`, sans
  JavaScript), les **thèmes** se présentent en grille — chaque tuile mène à sa section d'actes par
  une ancre —, puis les actes sont rangés **par thème**. Aucune donnée supplémentaire n'est
  nécessaire : `themeId`/`themeLabel` voyagent avec la publication. `indexRecueil` (donc
  `/recueil.json`) publie la liste des thèmes (`id`, libellé, nombre), et `llmsTxt` donne le thème
  de chaque acte.
- **La page se décrit** : titre, description, `rel="canonical"`, un `rel="alternate"` par
  représentation, et les **données structurées** JSON-LD de la publication, posés par
  `publierMeta` (`views/recueil-public.js`) dans le `<head>`. Ces balises portent `data-recueil` :
  `retirerMetaRecueil` les efface quand on quitte le recueil, pour rendre à l'atelier son propre
  titre.
- **Le recueil ouvert se donne à copier** : `blocDonneesPubliques` (`views/acte-publie.js`) replie,
  sous le texte de l'acte, l'**adresse de l'identifiant ELI**, l'adresse de référence et les adresses
  de chaque format, chacune avec son bouton « Copier ». Il est montré au public comme à
  l'administration.
- **L'URL suit la page, jamais l'inverse** : `majUrlRecherche` (`src/ui/state.js`) tient l'adresse
  de la page d'accord avec l'écran affiché, en ne touchant qu'aux clés du recueil (`acte`, `format`,
  `recueil`, `eli`) et en conservant les paramètres de la plateforme et le fragment de l'éditeur. La
  navigation interne ne recharge pas la page : un clic intercepté (`views/recueil-public.js`) suit
  l'adresse du recueil sans quitter l'application — `?acte=<clé>` comme `?eli=<identifiant>`, et
  depuis n'importe quel écran (un acte publié se cite aussi depuis l'atelier).
- **L'identifiant ELI est une adresse** : `resoudreLiensEli` (`src/lib/recueil.js`) traduit les liens
  ELI portés par un document publié — un visa d'adoption, un renvoi à l'acte modificatif — en
  l'adresse de l'acte visé dans l'instance, et la page accepte `?eli=…` (ou `/eli/<code>/<année>/<n°>/<entité>`
  sur un déploiement auto-hébergé) : voir § 2.6 sexies.

 (`config.publication.auto`, Administration › Publication,
**vrai par défaut**). Éteinte, `publierApresSignature` (`views/signature.js`) **s'arrête au retour
signé** : ni publication, ni transmission au contrôle de légalité, l'acte signé attend au
registre, et le fait est journalisé. C'est le réglage d'une administration qui publie dans **son
propre système** et ne veut pas que l'application dépose les actes à sa place. Le réglage régit le
geste *automatique*, pas la publication : un acte signé reste publiable à la main.

**Le retrait du recueil est exceptionnel, et réservé à l'administrateur.** Un acte publié peut,
en dernier recours, être retiré du recueil (`POST /v1/publications/{cle}/retrait`) — pour un
**motif technique** seulement : dépôt en double, dépôt erroné, acte publié avant signature,
identifiant attribué à tort. Le geste est précédé d'un **avertissement en grand** rappelant qu'un
acte administratif publié **ne se retire jamais** : ni le retrait ni l'oubli ne sont un moyen de
corriger un acte, qui doit être **modifié** ou **abrogé** et rester au recueil. Le **motif est
obligatoire** (le service refuse un motif absent, `422 motif_absent`) et **conservé** sur l'acte
(`acte.retraits`) comme au journal. Le retrait efface l'entrée du recueil, ramène l'acte à l'état
**signé** (il redevient publiable) et laisse une trace sur sa fiche. La permission
`publications.depublier` est accordée au seul rôle **administrateur**.

**Épingler un acte : la bande « À la une ».** L'onglet **Actes** porte, sur chaque acte
publiable, un bouton **punaise** (permission `publications.epingler`, rôles administrateur et
éditeur) qui met l'acte **en avant** sur la page d'accueil du recueil public, dans sa bande
**« À la une »** — au-dessus du carrousel des derniers actes, qui ne les répète pas. C'est la
place d'un **règlement intérieur**, d'une charte, du document qu'un visiteur vient chercher ;
à l'inverse d'un acte parmi les derniers publiés, il ne dépend pas de sa date. La bande ne
montre que les versions **en vigueur** et **s'efface** dès qu'une recherche ou un filtre est
posé : le lecteur est alors dans ses résultats, et une mise en avant n'y répond pas.

Le drapeau vit d'abord sur l'**acte** (`acte.epingle`) : on peut donc l'épingler **avant** sa
publication — le dépôt emporte le drapeau avec la version en ligne (`epingle: true` dans
`POST /v1/actes/{id}/publication`), et un acte non publiable ou une annexe n'offre pas le
bouton. Il suit ensuite l'**ACTE** — son identifiant ELI — et non la version déposée :
`POST /v1/publications/{cle}/epingle` le pose sur **toutes** les versions publiées sous cet
identifiant, et une version publiée plus tard l'**hérite** (`hPublier`). Un acte **modifié ou
consolidé reste ainsi à la une**. Le geste est réversible (`epingle: false`), ne touche pas au
texte publié, et s'inscrit au **journal** (`publication.epingle` / `publication.desepingle`).

**Amorçage de la démonstration.** Un service neuf ne contient aucune publication, donc le recueil
serait vide : `src/ui/demo-publications.js` (`amorcerRecueil`, appelé en fin d'amorçage par
`app.js`) publie au premier démarrage les actes que la fiction déclare publiés — ceux qui portent
une constatation de publication —, par le **même chemin** que l'écran de signature
(`publierActeDuSeed`), de sorte que le registre local et le service racontent la même chose.
Idempotent, silencieux, et réservé au jeu de démonstration intact (`acte-demo-*`, `tpl-*`).
Il porte ensuite la **mise à la une** des actes que la fiction déclare épinglés
(`POST /v1/publications/{cle}/epingle`, reposé à chaque amorçage : le service a pu être remis à
zéro) — la délibération qui adopte le règlement intérieur, dans le jeu livré.

#### 2.6 sexies L'identifiant ELI comme adresse, dans l'instance

Un acte publié **cite** d'autres actes par leur **identifiant ELI** : c'est le **visa d'adoption**
d'une annexe (« Vu l'arrêté n°2026-464-VSL du 28 octobre 2026, qui l'adopte ; »), le visa qui
rappelle l'acte **modificatif** dont le texte est consolidé, et la liste des documents annexés. Le
document publié porte donc des liens de la forme `eli:/fr/arr/2026/0464/vsl` (`compile.js`,
`amend.js`, `annexes.js` : le champ `lien` d'un visa).

Or un identifiant n'est **pas une adresse** : aucun navigateur ne sait l'ouvrir. C'est à
l'**instance** de le traduire — elle seule connaît ses actes publiés :

- **Dans la page (recueil et consultation)** : `resoudreLiensEli` (`src/lib/recueil.js`) remplace,
  à l'affichage, l'identifiant par l'adresse de l'acte visé (`hrefActe`), et la mention écrite ne
  change pas : seul le lien devient réel. L'identifiant désigne l'**acte**, jamais une version
  (`indexEli`/`publicationParEli`) : deux versions publiées sous le même identifiant ne désignent
  qu'un acte, et c'est la version **en vigueur** qui est atteinte. Un identifiant que le recueil
  **ne connaît pas** reste une **mention**, sans lien (`.recueil-lien-eli--hors`) : un lien qui ne
  mène nulle part vaut moins que pas de lien. La liste des publications qui permet la traduction est
  posée par les vues (`setListePublications`) ; à défaut, elle est demandée une fois au service et
  la résolution est **différée** jusque-là — jamais tranchée à tort.
- **Dans la page servie par un déploiement auto-hébergé** (`pageActe`,
  `src/server/mysql/actes.mjs`) : le service fait la même traduction côté serveur, parce qu'il
  détient les publications et que la page est servie en HTML **sans JavaScript**.

L'identifiant s'ouvre **aussi comme une adresse**, pour qui l'a sous les yeux sans être dans la
page : sur un déploiement auto-hébergé, `/eli/<code>/<année>/<n°>/<entité>` **redirige** (302) vers
la page de l'acte en vigueur (nginx route `/eli` vers l'API, comme `/recueil`) ; ailleurs, l'adresse
passe par la page (`?eli=…`, clé `eli` de `CLES_PUBLIQUES`, lue par `parseRoute` et traitée par
`views/recueil-public.js`). Un identifiant inconnu le **dit** (« Aucun acte ne porte cet
identifiant »), au lieu d'échouer en silence. Le bloc **« Recueil ouvert »** de chaque acte
(`blocDonneesPubliques`) porte cette adresse (`adresseEli`/`hrefEli`), à côté de l'adresse de
référence et des représentations lisibles par machine.

### 2.7 Comptes et rôles

L'accès à l'application est **authentifié** : on ouvre une session sous un **compte**, et ce
compte porte un **rôle**. Six rôles — trois profils ordinaires, du plus large au plus
restreint, **deux qualités cumulables** (Réviseur, Signataire), et le **Visiteur** :

| Rôle | Vocabulaire | Ce que le rôle ouvre |
|---|---|---|
| **Administrateur** | « l'informaticien » | tout le back-office : référentiel, trames, comptes et rôles, connexion des API ; il **crée et supprime les comptes** et **voit tout, quel que soit le service** |
| **Éditeur** | rédacteur en chef | rédiger les **trames** de son périmètre, les modifier, les commenter, et régler les **feuilles de style** des actes (charte graphique) ; rédiger et gérer les actes de son périmètre |
| **Rédacteur** | agent | **rédiger un acte** à partir d'une trame de son périmètre et mener les actions associées (enregistrer, signer) — **uniquement ses propres actes** ; il choisit son modèle dans « Rédiger un acte » (le registre des trames, `trames.voir`, est réservé aux éditeurs et aux administrateurs) |
| **Réviseur** | la plume qui relit | **cumulable**, il ne remplace pas un profil : il ajoute le **contrôle de l'acte avant sa signature** (§ 2.8.1 bis). Il reçoit un rapport de conformité, peut corriger l'acte, le valider — il part alors en signature — ou le rejeter, l'acte revenant en brouillon chez son rédacteur avec le motif |
| **Signataire** | l'auteur de l'acte | **cumulable**, il ne remplace pas un profil : il ajoute la **qualité de signer** (§ 2.7.2 ter). Il ouvre l'onglet **« Ma signature »** de l'écran Signature & publication, y voit les actes qui attendent sa signature et ceux signés au titre de sa délégation, et ne voit, dans l'atelier, que les actes relevant de son **champ de compétence**. La qualité **découle d'une désignation** : elle est attribuée au compte de la personne dès que celle-ci est désignée dans l'organigramme des **Délégations** (§ 2.8.1) |
| **Visiteur** | l'identité reconnue, sans accès | **aucune permission** : l'atelier ne lui est pas ouvert, il ne lui reste que l'**espace public** (le recueil). C'est l'état d'un compte authentifié dont aucun rôle d'application n'est reconnu (§ 2.7.3) |

**Les qualités « Réviseur » et « Signataire » se cumulent.** Un compte porte une **liste** de
rôles (`user.roles`), dont le premier est le **rôle principal** — celui qui s'affiche, qui classe
et qui est lu par ce qui ne connaît qu'un rôle (annuaire, présence, journal). `user.role` reste
écrit en miroir du principal, et `rolesOf(user)` est la **seule** lecture des rôles : un compte
enregistré avant le cumul (rôle unique) est lu sans migration. Une **qualité cumulable ne peut
jamais devenir principale** (`primaryRoleId` écarte les rôles cumulables) : ajouter la qualité de
réviseur, ou celle de signataire, à un rédacteur ne le transforme pas en « profil réviseur » ou
« profil signataire ».

Le contrôle d'accès repose sur des **permissions** nommées (`trames.voir`, `trames.gerer`,
`trames.styles`, `actes.rediger`, `actes.gerer`, `actes.tous`, `actes.valider`, `actes.reviser`,
`actes.signer`, `signature.gerer`, `delegations.gerer`, `publications.depublier`,
`publications.epingler`, `referentiel.gerer`, `comptes.gerer`, `api.gerer`, `docs.voir`), chacune
accordée à un ensemble de rôles. **Signer** (`actes.signer`) et **publier** (`signature.gerer`)
sont deux permissions distinctes : la première ouvre l'écran de signature et les gestes qui
engagent la signature — un signataire peut donc signer sans pouvoir conduire la publication.
Une seule table dans `src/lib/users.js` (`PERMS`) sert à la fois de **source d'autorité** pour
`can(user, perm)` — qui interroge **tous** les rôles du compte — et de contenu à la **matrice des
droits** affichée dans l'écran « Comptes et
rôles ». Les vues n'ont pas de logique de rôle en dur : elles interrogent `can()`.

**Le rôle et le périmètre sont deux axes distincts.** Le rôle dit ce qu'un compte peut *faire*
(permissions) ; le **périmètre** dit *sur quoi* (services et bureaux). Un rédacteur n'accède
qu'aux trames et actes de son périmètre ; un éditeur également, sauf s'il est **transverse**.
Seul l'administrateur échappe au périmètre (il voit tout). Voir la section « Organisation »
ci-dessous.

Le modèle d'un compte :

```js
{ id, firstName, lastName, login, role, roles, entityId, email,
  personId,                                  // la personne du référentiel que le compte tient
  memberships: [ { serviceId, bureaux } ],   // bureaux: null = tous ceux du service
  revision: { services, trameIds, familyIds, actTypes, entityIds },  // compétence de réviseur
  active, createdAt, lastLoginAt, note }
```

`roles` est la **liste** des rôles (le premier est le principal, miroir de `role`) ;
`revision` est la **compétence de réviseur** du compte — une compétence **vide** vaut « tous les
services, tous les actes » (§ 2.8.1 bis). `personId` rattache le compte à la **personne du
référentiel** qu'il tient : c'est ce lien qui fait qu'un compte **signe** — au nom de cette
personne — et qu'il ne voit, dans l'atelier, que les actes de son **champ de compétence**
(§ 2.7.2 ter). Le rapprochement de ce compte avec celui de l'**outil de signature** se range, lui,
sur la **personne** (`personne.signature = { compteId, courriel, compteOutil, rapprocheLe, par }`) :
la qualité de signataire est une donnée du référentiel, elle suit l'export.

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

Les services/bureaux se décrivent dans **Administration › Services** ; le périmètre se règle dans
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
> (`seedUsers`) crée **onze comptes fictifs** rattachés aux services de Valmont-sur-Loire (dont
> un compte transverse).
>
> Le référentiel peut **brancher l'annuaire de la collectivité** (OpenID Connect) : voir
> § 2.7 bis. Le brancher **désactive automatiquement les comptes de démonstration**.
>
> Une installation **auto-hébergée sans annuaire** peut à la place tenir ses **comptes locaux**
> (identifiant et mot de passe) : c'est le **déploiement** qui l'active, dans le `.env` du
> service (`AUTH_MODE=password`), avec un **compte d'administration** créé depuis le `.env`
> (`ADMIN_LOGIN` / `ADMIN_PASSWORD`) : voir § 2.7 bis.1.

### 2.7.2 Qualités, accord en genre et délégations de signature

**La qualité du signataire s'accorde en genre.** Chaque **rôle** (`config.roles`) porte ses deux
formes — `m` et `f` : « maire »/« maire », « directeur général des services »/« directrice
générale des services », « chef de bureau »/« cheffe de bureau ». Le `label` n'est qu'un repère
de liste : il ne s'imprime jamais. Le **genre** d'une personne se déduit de sa **civilité**, et se
force au besoin par `accord: "m"|"f"` sur sa fiche (Administration › Personnes) — le cas par cas
d'une femme maire qui tient à « le maire ». La qualité se compose avec son article (`avecArticle`) :
« le »/« la », ou « l' » devant une voyelle (même forme dans les deux genres). Le bloc de
signature imprime les qualités puis le **Prénom Nom** du signataire — sans civilité, que la
qualité rend superflue.

**Le signataire se choisit par la FONCTION, non par son nom.** `src/lib/fonctions.js` construit,
pour un acte, le **catalogue des fonctions** qui peuvent le signer : les **rôles** (toutes les
personnes qui portent le rôle ont la fonction) et les **délégations** en vigueur dont le périmètre
convient à l'acte (voir `scoreDelegation` : organisation, famille, type — une délégation d'une
autre organisation, ou visant une autre famille ou un autre type d'acte, est écartée). Chaque
fonction porte ses **personnes** : une clé stable — `role:<id>` ou `del:<id>` — `personnesAyantQualite`
rendant, pour un rôle, ses titulaires, et pour une délégation, les délégataires de **même qualité
dans la même organisation** (plusieurs personnes peuvent tenir une qualité, chacune par sa propre
délégation). Une fonction que personne ne tient est écartée du catalogue.

Le champ de trame correspondant est de **type `signataire`** (les trames antérieures, de type
`person`, sont converties au démarrage par `migrateSignatureFields`). Il garde la valeur
`values.signataire` — l'identifiant d'une personne : tout le reste de l'application continue de la
lire ainsi — et range à côté d'elle, sous **`values.<id>Fonction`**, la **clé de la fonction
retenue** (`champFonction`). La propriété `qualite` du champ fixe facultativement la **fonction
attendue** par la trame (« Maire » pour un arrêté de délégation de signature) : la liste s'ouvre
sur elle, sans jamais écarter le rédacteur. La clé de fonction, quand elle désigne un rôle, est
passée à `enrichirSignataire` (`opts.roleId`) : une personne qui porte plusieurs rôles signe sous
celui de la fonction retenue — sauf si une délégation s'applique, la qualité imprimée venant alors
de la délégation, qui est un fait du référentiel.

L'écran de rédaction (`src/ui/signer-picker.js`) en fait un **choix en deux temps** : la **fonction**
d'abord (groupée « Fonctions (rôles) » / « Par délégation de signature »), puis, **parmi les
personnes qui ont qualité**, celle qui signe. Quand une fonction ne peut être tenue que par une
personne, celle-ci est retenue d'office ; un choix délibéré du rédacteur n'est jamais défait. Le
même sélecteur sert dans la pastille du document, dans l'acte modificatif, et la chaîne de
délégations reste affichée sous le champ.

**Les délégations de signature** (`config.delegations`) forment un **arbre** : une autorité
(`fromId`) délègue à quelqu'un (`toId`) une **qualité** (`qualiteM`/`qualiteF`, propre à la
délégation et non au rôle : « adjoint au maire **en charge de l'urbanisme** »), pour des matières
données, éventuellement ciblées sur une **famille** et un **type d'acte**, avec sa **décision**
(`acteRefId`, une référence du référentiel ; à défaut l'intitulé libre `acte`) et ses dates
(`du`/`au`). La **sous-délégation** est en principe interdite, mais l'arbre n'est pas borné : elle
est dérogatoire, pas impossible.

**Chaque chaîne relève d'une organisation.** Une délégation est donnée *dans le nom d'une
organisation* : celle de son délégant par défaut (`entiteDeDelegation`), ou celle qu'un `entityId`
explicite impose — le cas du maire qui délègue dans le nom du CCAS qu'il préside.
`meilleureDelegation` **écarte les délégations d'une autre organisation** : la chaîne d'un
établissement ne se mêle pas à celle de la commune, même si une même personne y tient des
délégations des deux côtés. Elle ne retient en outre qu'une délégation **en vigueur à la date de
l'acte** (`values.dateSignature`).

**Les autorités autonomes.** Toutes les chaînes ne descendent pas du maire : un établissement
public (office, centre de gestion, syndicat) a sa propre autorité de tête — le **président de son
conseil d'administration** — et sa propre chaîne, parallèle. Une personne **sans délégation
entrante** est traitée comme une autorité de tête (`signataire.autonome`) : son rôle lui donne sa
qualité, et l'organisation qu'elle engage sa formule d'autorité. La démonstration le montre avec
l'office public de l'habitat (`ent-oph`) : une trame propre (`tpl-marche-oph`), ses références
(`ref-oph-reglement`, `ref-oph-deliberation`), son circuit de validation (`cir-oph`), et une
décision signée par le directeur général sur délégation du président.

**Les décisions fondant la signature** (`decisionsDeSignature`). Chaque étage de la chaîne tient
son pouvoir de **décisions**, que le référentiel désigne : sur une **personne**, le champ
`fondementRefId` dit de quoi elle tient sa compétence quand elle est l'**autorité de tête** (la
délibération qui donne délégation au maire, une élection) ; sur une **délégation**, un **délégataire**
en a DEUX — la **décision de nomination** (`nomination`, l'acte qui l'a nommé à sa fonction) et la
**décision de délégation** (`acte`, celle qui lui a donné le pouvoir de signer). Chacune se
renseigne de deux façons : d'un **acte publié au recueil** (`nominationCle`, `acteCle`, dont le lien
est recalculé au rendu — c'est l'adresse du recueil en ligne) ou d'un **lien externe**
(`nominationUrl`, `acteUrl`, le texte étant ailleurs), ou encore d'une **référence du référentiel**
qui porte son adresse de source (`nominationRefId`, `acteRefId`) ; `nominationSource`/`acteSource`
retient d'où elle vient. `libelleDecision` résout la référence (ou l'intitulé libre) et
`lienDecision` l'adresse, et `decisionsDeSignature` rend la série — une entrée
`{ refId, label, niveau, acteur, lien }` **par décision**, du sommet de la chaîne vers le
signataire (la nomination avant la délégation à chaque étage), **sans répéter** une décision déjà
visée. Une décision n'est **renseignée** que si son **intitulé ET son lien** le sont : `decisionsManquantes`
nomme les manques, et **l'écran Délégations refuse de créer** une délégation dont l'une des deux
n'est pas renseignée — un signataire ne se configure pas sans ses deux décisions. Une **trame** les
insère dans un bloc `visas` par une **entrée de chaîne** (`{ chaine: true }`, écran de l'éditeur de
visas : « Les décisions fondant la signature, étage par étage ») : l'emplacement est celui de la
trame, la série vient du référentiel, et `compile` l'éclate en autant de visas, **chacun porteur de
son lien** — que les exports écrivent en clair : `<a>` (HTML web et imprimable), `<ref href>` (Akoma
Ntoso), `[texte](lien)` (Markdown). Sur une signature par subdélégation (maire → adjoint → chef de
bureau), l'acte vise ainsi, dans l'ordre : la délibération qui a donné son pouvoir au maire, puis,
pour chaque étage, la nomination et la délégation. Une délégation **déjà enregistrée** sans ses deux
décisions n'est pas refusée, mais **signalée** : badge « Décisions à compléter » dans l'organigramme
et sur la fiche, alerte « Délégation incomplète », et contrôle de conformité **à l'attention** de
l'écran de révision.

`src/lib/delegations.js` porte tout le modèle : `genreDe`, `avecArticle`, `qualiteDeRole`,
`qualitePersonne` (rôle forcé facultatif), `newDelegation`, `qualiteDeDelegation`, `delegationsVers`,
`enVigueur`, `scoreDelegation`, `chaineDeSignature`, `lignesQualites`, `libelleDecision`,
`decisionsDeSignature`, `enrichirSignataire`, `arbreDelegations` ; `src/lib/fonctions.js` porte le
catalogue des **fonctions** (`fonctionsDeSignature`, `personnesAyantQualite`, `fonctionPourPersonne`,
`fonctionParCle`, `libelleFonction`, `champFonction`) et `src/ui/signer-picker.js` le sélecteur. La chaîne se remonte de délégation en
délégation (profondeur bornée, garde anti-cycle) : `chaineDeSignature` rend les étages du sommet
vers le signataire, `meilleureDelegation` choisissant, parmi les délégations d'une personne, la
plus précise (organisation, puis famille, puis type d'acte, puis générale). À la compilation,
`buildContext` **lit d'abord l'entité** — c'est elle qui décide de la chaîne applicable — puis
résout le signataire, et pose dans `ctx.signataire` : `genre`, `qualite`, `qualiteArticle(Maj)`,
`delegue`, `autonome`, la chaîne (`chaine`), les décisions visées (`decisions`), les lignes prêtes
(`qualites`) et l'**autorité de tête** (`autorite`, avec son `entiteId`) — celle dont le pouvoir
descend. La formule d'autorité de
l'entité accepte un jeton `{qualite}`, remplacé par la qualité accordée de l'autorité de tête
(« {qualite} de Valmont-sur-Loire » → « Le Maire de Valmont-sur-Loire »).

Le rendu (`render.js` : `personSignatureName`, `personRole`, `personRoleLines`) et les exports
(Akoma Ntoso, Markdown, Word, HTML) impriment successivement :

> Le Maire,
> Par délégation, l'adjoint au maire en charge de l'urbanisme,
> Par subdélégation, le chef de bureau Urbanisme,
> Karim BENALI

Seul le **nom du signataire** s'imprime. L'arbre se règle dans l'écran **Délégations** — un écran de
plein droit de l'atelier, présenté en **organigramme** (ou en liste), où chaque acteur a une **fiche**
détaillée. Il est **visible par tous les comptes**, et **modifiable par les seuls administrateurs et
éditeurs** (permission `delegations.gerer`) ; le rédacteur choisit le signataire **par sa fonction**
(voir plus haut) et voit la chaîne résultante **sous le champ « Signataire »**.

#### 2.7.2 bis L'écran « Délégations »

L'organigramme est un **écran de plein droit** de l'atelier, et non plus un onglet de
l'Administration : savoir qui peut signer à la place de qui n'est pas une donnée réservée.
Il est donc **visible par tous les comptes** (`VIEW_PERMS.delegations = null`), tandis que sa
**modification** est gardée par la permission `delegations.gerer` — accordée aux seuls
administrateurs et éditeurs. Un compte qui ne l'a pas lit exactement la même fiche, sans les
champs de saisie.

Deux présentations, au choix :

- **Organigramme** — l'arbre des chaînes, dessiné en CSS (descentes et barres de fratrie, sans
  élément décoratif) : chaque chaîne part de son **autorité de tête** et descend, de délégation
  en sous-délégation. Un nœud reste **court** — qui, sous quelle qualité, dans quelle
  organisation, avec sa pastille de rang et, le cas échéant, la mention « suspendue », « échue »
  ou « à venir ». Sur un écran étroit, l'arbre **défile horizontalement** plutôt que de tasser
  les cartes.
- **Liste** — la même arborescence, indentée, lisible sans défilement latéral.

Cliquer un nœud ouvre sa **fiche** (une fenêtre) : l'identité et la qualité accordée en genre,
puis **ce que la signature donnera** — les lignes « Le Maire, / Par délégation, … » et les
décisions visées, recalculées à la frappe —, puis le **pouvoir** (délégant, délégataire,
organisation), l'**étendue** (qualités au masculin et au féminin, matières, famille, type
d'acte), la **décision et la durée** (référence ou intitulé libre, dates, état). L'**autorité de
tête** a sa propre fiche : rôle, organisation, décision fondant son pouvoir, liste de ses
délégataires.

**Créer une délégation n'écrit rien avant confirmation.** La fiche d'une délégation neuve
travaille sur un **brouillon** : l'aperçu la lit comme si elle était déjà au référentiel, mais
le référentiel n'est touché qu'au moment de « Créer la délégation » — abandonner la fiche ne
laisse donc aucune délégation vide derrière elle. Une délégation dont le délégant est vide,
inconnu ou forme un cycle n'apparaît dans aucun arbre : elle est signalée « non rattachée »,
sous l'organigramme, ce qui permet de la retrouver et de la corriger.

#### 2.7.2 ter Le signataire : la qualité, le compte, le champ de compétence

Un signataire n'est pas un agent comme un autre : c'est l'**auteur de l'acte**, celui dont la
signature engage la collectivité. L'application en tire trois conséquences, réunies dans
`src/lib/signataires.js` — un module **pur** (ni DOM, ni état).

**1. Une qualité, qui découle d'une désignation.** Le rôle **`signataire`** est **cumulable**
(comme `reviseur`) : il n'enlève aucun profil, il ajoute la qualité de signer. Il ne se choisit
pas dans une liste, il **découle d'une désignation** : dès qu'une personne est désignée dans
l'organigramme des **Délégations** — comme **délégant** ou comme **délégataire** —
`assurerRoleSignataire(users, personId)` attribue la qualité au **compte rattaché à cette
personne** (`user.personId`), sans qu'il faille être administrateur : un **éditeur** (qui peut
modifier les délégations) l'attribue de la même façon. Le geste est idempotent, et journalisé
(`journaliser("role.signataire")`). Le rôle ouvre l'écran **Signature & publication** — par la
permission `actes.signer`, distincte de `signature.gerer` (la publication) —, et son onglet
**« Ma signature »**, qui est l'onglet par défaut d'un signataire.

**2. Un compte, et deux rapprochements.** Un signataire signe **avec son compte**. En production,
l'annuaire de la collectivité (OIDC) délivre le compte de l'application **et** provisionne le même
agent sur l'**outil de signature** : deux rapprochements en découlent.

- la **personne du référentiel** — celle qui porte la qualité — est rattachée à son **compte** de
  l'application par `user.personId` (champ « Personne du référentiel — qui signe » dans
  **Comptes et rôles**) ;
- ce compte est rapproché du **compte de l'outil de signature**, dérivé de façon déterministe par
  `compteOutilDeSignature` (`SIG-<LOGIN>`) pour que le rapprochement ait un objet vérifiable — un
  identifiant, et non une simple case cochée.

`etatRapprochement(config, users, personId)` dit l'état des deux (`{ personne, compte, declare,
courriel, compteOutil, ok, motif }`), `rapprocher` l'écrit sur la **personne**
(`personne.signature = { compteId, courriel, compteOutil, rapprocheLe, par }` — la qualité suit
l'export), `deRapprocher` l'efface. L'état se lit et se corrige à trois endroits : la **fiche d'un
acteur** dans l'écran **Délégations**, la **fiche du compte** (Comptes et rôles), et l'onglet
**« Ma signature »**. Un signataire **sans compte**, dont le compte est **désactivé**, **sans
adresse**, ou **non rapproché**, ne peut pas signer — la signature serait anonyme. L'application
le dit au moment où on le désigne, dans le sélecteur de signataire de la rédaction
(`src/ui/signer-picker.js`, avertissement sous le champ), et le panneau de l'outil de signature
affiche le **compte de signature** retenu.

**3. Un champ de compétence.** Un signataire ne voit, dans l'atelier, que les actes dont la
signature relève de lui : ceux qu'il **signe lui-même**, et ceux que signent ses **délégataires**
— car c'est alors sa propre signature qui est engagée, par délégation puis subdélégation. La
compétence se lit dans la **chaîne de signature** de l'acte (`chaineDeSignature`,
`src/lib/delegations.js`), dans le périmètre de l'acte (organisation, famille de la trame, type
d'acte, date de signature — une délégation limitée à un autre service ou à une autre famille ne
s'y invite pas) :

- `etapesDeSignature(config, acte, trame)` — la chaîne de l'acte (le signataire désigné, lu sur
  `acte.values.signataire`) ;
- `competenceDeSignature(config, acte, trame, personId)` — `{ ok, effectif, rang, etapes }` :
  `effectif` dit que la personne est le **dernier étage** (c'est sa signature que l'acte attend),
  `rang` sa place depuis la tête ;
- `competenceDuCompte` / `peutSignerActe` — la même question posée au compte, par sa personne ;
- `signatairesPourActe(config, users, acte, trame)` — les comptes dont la signature est engagée
  (l'homologue de `reviseursPour` de `src/lib/revision.js`) ;
- `fileSignature(config, user, actes, trameDe)` — ce que l'onglet « Ma signature » met sous les
  yeux : `aSigner` (les actes qui attendent **sa** signature), `engagee` (les actes signés au
  titre de sa délégation, qu'il doit pouvoir suivre) ;
- `placeDansChaine` (« autorité de tête », « par délégation », « par subdélégation ») et
  `situationDeSignature` (ce que la personne signe en général : en son nom, et/ou au titre de ses
  délégations).

`visibleActes()` (`src/ui/state.js`) ouvre au compte, en plus de son périmètre administratif et de
sa compétence de révision, les actes dont sa signature relève (`parSignature`). La qualité étant
**cumulable**, la visibilité est **l'union** de ce que donnent les rôles du compte ; le
**champ de compétence** est ce que la qualité de signataire ajoute — et il est **seul** à décider
de ce que contiennent les deux listes de l'onglet « Ma signature ».

**Le jeu de démonstration.** Les comptes dont la personne figure dans une chaîne de signature
reçoivent la qualité au démarrage (`migrateDemoSignataires`, `src/lib/store.js`) — purement
additif, et réservé au jeu de démonstration, comme les migrations de la révision. La
démonstration montre ainsi la qualité sur les quatre comptes de la commune et de l'office qui
signent, ou dont la signature est engagée (l'adjoint, le chef du bureau Urbanisme, la directrice
du CCAS, la directrice générale de l'office) ; leurs actes non encore rapprochés affichent
l'avertissement et le geste de rapprochement.

#### 2.7.2 quater L'acte qui émane d'une assemblée

Tout acte n'émane pas d'une **personne**. Un **conseil municipal** délibère, un **conseil
d'administration** d'établissement public approuve : la **ligne d'autorité** de l'acte est alors
celle de l'**assemblée** — « Le conseil municipal de Valmont-sur-Loire », « Le conseil
d'administration de l'office public de l'habitat du Valmont » — tandis que l'acte est **signé par
le président de cette assemblée** : le **maire** pour un conseil municipal, le **président du
conseil d'administration** pour un établissement public. L'autorité et le signataire ne se
confondent donc plus : l'une est un **organe collégial**, l'autre une **personne** — et c'est la
délibération elle-même qui est le plus souvent régie ainsi.

**L'assemblée est une donnée du référentiel** (`config.councils`, onglet **Administration ›
Assemblées**, `src/ui/views/referentiel.js`). Chaque conseil se décrit par : son **entité de
rattachement** (`entityId` — le conseil municipal est celui de la commune) ; sa **formule
d'autorité** (`authorityFormula`, la ligne d'en-tête de l'acte) ; la **qualité qui signe**
(`signerRoleId`, un **rôle du référentiel** — `maire`, `president-ca`…) ; et un état **actif**.
Séparer la qualité qui signe du rôle porté par les personnes est ce qui rend le dispositif
**configurable conseil par conseil** : un même établissement peut faire signer son assemblée par
son président, sans toucher au code, et chaque conseil a la sienne. `src/lib/conseils.js` porte le
modèle — `newConseil`, `conseilsActifs`, `conseilsDe`, `conseilPourActe` (l'assemblée retenue pour
un acte : celle qu'on désigne explicitement, sinon la **première assemblée active de l'entité**),
`qualiteSignataireConseil` (la qualité accordée en **genre**, « Le président » / « La présidente »)
et `enrichirConseil` (la formule et la qualité prêtes à l'affichage, avec article et majuscule).

**Une trame déclare qu'elle produit un acte d'assemblée** (`trame.assemblee`, case « Acte
d'assemblée — délibération » dans l'éditeur de trame). À la compilation, `buildContext`
(`src/lib/compile.js`) résout alors `ctx.conseil` — l'assemblée désignée par `values.__conseilId`,
à défaut `extra.conseilId` ou `trame.conseilId`, à défaut la première de l'entité — et pose
`ctx.autorite` sur la **formule de l'assemblée** au lieu de celle de l'entité. La **qualité du
signataire** que l'assemblée appelle est croisée avec le **signataire de la trame** : c'est bien
une personne qui signe, sous la qualité du conseil, et la chaîne de délégations reste applicable.
Les exported `AUTO_TOKENS_CONSEIL` (`src/lib/auto-tokens.js`) exposent dans l'éditeur les jetons
propres à l'assemblée — `{{conseil.name}}`, `{{conseil.authorityFormula}}`, `{{conseil.signerQualite}}`
— en plus du jeton transversal `{{autorite}}`, qui est **le** point de bascule : dans une trame de
personne il rend la formule d'autorité de l'entité, dans une trame d'assemblée celle du conseil.

**La conformité veille sur le couple.** Un contrôle (`src/lib/conformite.js`, `assemblee` — « Acte
d'assemblée ») confirme que la ligne d'autorité est bien celle de l'assemblée, et un second
(`assemblee-signataire`) vérifie que le **signataire — ou un délégataire de sa chaîne — porte
bien le rôle** que l'assemblée appelle ; s'il ne le porte pas, l'acte est **signalé** à l'attention
de l'écran de révision, car la signature n'aurait pas la qualité annoncée.

**Le jeu de démonstration** montre les deux cas : le **conseil municipal** de la commune
(`csl-vsl-cm`, signé par le maire) avec la trame `tpl-deliberation`, et le **conseil
d'administration** de l'office public de l'habitat (`csl-oph-ca`, signé par le président) avec la
trame `tpl-deliberation-ca`.

### 2.7.3 L'identité reconnue sans rôle : le visiteur

**Le recueil public est l'interface de l'installation pour qui n'a pas de compte** (§ 2.6 bis) :
c'est là qu'un visiteur arrive, et c'est de là qu'il se connecte. La porte de l'application, dans
l'en-tête du recueil (`porteApplication`, `views/recueil-public.js`), dit donc **l'état de la
session** :

- **sans session** : « **Se connecter** » — un bouton, non un simple lien, parce que c'est la
  porte de l'application vue de la rue ; il ouvre l'écran de connexion (comptes de l'application
  ou annuaire, selon le référentiel) ;
- **session ouverte** : « Retour à l'application » ;
- **visiteur** (voir ci-dessous) : « Mon accès », qui mène à l'écran d'explication.

**Un compte authentifié dont aucun rôle d'application n'est reconnu est un visiteur.** L'identité
est vérifiée — l'annuaire a reconnu la personne — mais l'application ne lui ouvre **rien** :
`estVisiteur(user)` (`lib/users.js`) est vrai quand le compte n'a aucun rôle, ou porte le rôle
`visiteur`. Ses permissions sont **vides par construction** : `can()` refuse tout dès que le
compte porte `visiteur`, quel que soit le reste — une qualité résiduelle (un réviseur dont le
groupe a disparu) ne doit pas lui rouvrir un accès, et l'annuaire qui ne reconnaît aucun groupe
**efface** les qualités cumulables qu'il portait (`applyOidcUser`, `lib/oidc.js`).

Le rôle ne se contente pas d'être un état : il est **attribuable**. Un administrateur peut donner
le profil « Visiteur » à un compte (Comptes et rôles), et la politique d'annuaire « agent sans
groupe reconnu » peut valoir « aucun accès » (rôle Visiteur) ou un rôle de repli — voir le réglage
« Rôles et périmètre » de l'onglet **Administration › Annuaire**.

**L'écran « pas d'accès »** (`views/sans-acces.js`, monté par `app.js` **avant** la coquille de
l'atelier) remplace alors l'application. Il dit qui est connecté, pourquoi il n'a pas d'accès —
et **les groupes reçus de l'annuaire**, ce qui évite « je suis pourtant dans le bon groupe » —,
donne le **contact du service qui gère l'application** (Administration › Identité, champs
« Contact d'aide »), et propose deux gestes : **Consulter l'espace public** (le recueil) et
**Changer de compte**. Un visiteur n'entre ni dans la présence collaborative, ni dans la
navigation : il n'est pas un poste de travail.

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
   `groups`, `realm_access.roles`…) selon `roleMap`. Aucun groupe reconnu : le compte devient
   **Visiteur** (défaut) ou reçoit le rôle de repli — voir § 2.7.3. Dans les deux cas l'agent
   est authentifié ; ce qui change est ce que l'application lui ouvre (ici, rien). Le périmètre
   (services, entité) suit des revendications dont les codes sont rapprochés du référentiel.
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
fournisseur (`ui/oidc.js`), écran « pas d'accès » du visiteur (`views/sans-acces.js`, § 2.7.3),
onglet **Administration › Annuaire (OIDC)** (mode, fournisseur,
correspondance des groupes, porte de secours), **Comptes et rôles** (provenance des comptes,
actions masquées quand l'annuaire est branché).

#### 2.7 bis.1 Comptes locaux (mot de passe), activés par le déploiement

Une collectivité qui **n'a pas d'annuaire** — une petite commune, une installation d'essai
autonome — peut faire tenir à l'application ses **propres comptes**, protégés par un **mot de
passe**. C'est le mode `password`, et il ne se règle **pas** comme les deux autres : il dépend de
ce que le **service** sait faire, pas du contenu de l'application. Il vit donc dans le `.env` du
déploiement (`AUTH_MODE=password`, voir `src/server/README.md`), et le service l'annonce au
navigateur (`window.__SCRIBA_AUTH__`, puis `GET /v1/auth/config`) : le déploiement est plus fort
que le référentiel, et `authConfig()` (`src/lib/auth.js`) applique son mode **par-dessus**
`config.auth`, où que la configuration soit lue.

**Le compte d'administration vient du `.env`.** `ADMIN_LOGIN` et `ADMIN_PASSWORD` (et
`ADMIN_NOM`, `ADMIN_EMAIL`, `ADMIN_ENTITY`) décrivent l'administrateur initial : au démarrage du
service, `amorcerAdmin()` (`src/server/mysql/server.mjs`) le **crée** s'il n'existe pas — rôle
`administrateur`, mot de passe haché —, ou lui **repose** son mot de passe s'il existe déjà. Un
`ADMIN_PASSWORD` trop faible (moins de `MDP_MIN_LONGUEUR`, ou égal à l'identifiant) est **refusé**
avec son motif — et l'écran de connexion **l'annonce** (`adminAmorce`, `adminMotif`, portés par
`GET /v1/auth/config`), au lieu de laisser croire à de mauvais identifiants. C'est ensuite ce
compte qui, depuis **Comptes et rôles**, crée les autres — et
qui peut changer son mot de passe pour ne plus dépendre du `.env` (recommandé : `ADMIN_PASSWORD`
se retire alors du fichier). Deux réglages voisins, à ne pas confondre : `DEMO_ACCOUNTS` (défaut
**`false`** en mode mot de passe) laisse ou non le raccourci « choisir un compte » de l'écran de
connexion ; **`DEMO`** commande, lui, tout le **jeu fictif** (voir § 2.7 bis.2) — les deux viennent du
déploiement, jamais du référentiel.

**Ce qui protège vraiment.** Le mot de passe est vérifié par le **service** : jamais le
navigateur ne détient de secret, et le référentiel ne conserve **pas** le mot de passe mais son
**empreinte scrypt** (`scrypt$N$r$p$sel$empreinte`, paramètre `SCRYPT_N` réglable) — la
vérification est à **temps constant**. Une session ouvre un **cookie `HttpOnly`** (jeton
aléatoire ; seul son **SHA-256** est en base) dont la durée se règle (`SESSION_DAYS`), et les
écritures passent par un jeton **anti-CSRF** (double envoi). Les tentatives sont **comptées** :
cinq échecs bloquent le compte le temps que le délai croît (plafonné). `COOKIE_SECURE` (défaut
vrai) impose HTTPS — à laisser tel quel en service. Le mode mot de passe est le seul où le
service **refuse** toute lecture ou écriture sans session ouverte ; c'est lui, et non
l'interface, qui fait alors autorité.

Le domaine est un module pur, sans dépendance : `src/server/mysql/comptes.mjs` (politiques,
hachage, sessions, routes `/v1/auth/*`), éprouvé par `src/server/mysql/comptes.test.mjs`. Le
client l'appelle par `src/lib/motdepasse.js`.



### 2.7 bis.2 La démonstration est un commutateur unique

Deux notions cohabitaient, et ne se recouvraient pas : le **déploiement** décidait de la
**connexion** (`AUTH_MODE`, `DEMO_ACCOUNTS`), et le **référentiel** (`brand.demo`) du **bandeau**.
Résultat : même en service réel, l'application semait et affichait une collectivité fictive.

Il n'y a plus qu'une source de vérité, `DEMO` (`.env` du service — voir `src/server/env.example`),
lue par `demoActif()` (`src/lib/demo.js`) ; `config.brand.demo` survit comme **miroir** (il voyage
avec les données exportées/importées et fait foi quand aucun déploiement ne parle : aperçu en
ligne, page statique). Valeur par défaut : `AUTH_MODE=demo` ou `DEMO_ACCOUNTS=true` **allument** la
démonstration ; `DEMO=false` l'**éteint**.

**Allumée**, l'application sème le **jeu fictif livré** (identité, entités, assemblées, services,
personnes, rôles, références, familles, trames, actes, comptes) et affiche le **bandeau orange**
« Démonstration » — en tête de l'application, sur l'écran de connexion, **et sur le recueil
public**. Il marque **l'application, pas les documents** : un acte exporté, publié ou imprimé ne
porte pas la mention. Le **texte** du bandeau reste réglable (`brand.demoText`).

**Éteinte**, l'application part d'un **référentiel VIERGE** (`seedConfigVierge()`,
`src/lib/seed.js`) : identité neutre, aucun blason, vocabulaire, numérotation, délais et mentions
du recueil génériques, collections vides, **et aucune mention de la collectivité fictive** nulle
part — ni à l'écran, ni dans le DOM, ni dans les données servies par l'API, ni dans le guide, ni
dans les métadonnées publiées. Le premier écran affiche une invitation (« Référentiel vierge »,
`viergeNotice()`, `src/ui/notice.js`) qui mène à Administration › Identité.

**Sortir de la démonstration.** `Administration › Données › « Repartir d'un référentiel vierge »`
efface le référentiel, les trames, les actes et les comptes du poste, **et** — sur le service
partagé — les actes déposés, les circuits de signature et les publications (`POST /v1/admin/purge`,
réservé à l'administration) : le recueil public lit le service, donc vider le seul navigateur
laisserait la fiction en ligne.

### 2.7 bis.3 Les réglages déclaratifs du référentiel

Le `.env` du déploiement peut **poser** des réglages qui, sinon, se saisissent dans
l'interface : identité de la collectivité (nom, sigle, adresse de base, couleur, emblème,
polices, service de contact), vocabulaire des actes, numérotation, délais et formalités
d'exécution, recueil public (titre, publication automatique, opposabilité), circuit de
signature, et fonctions (parapheur, contrôle de légalité, assistants). Ces variables —
préfixe `SCRIBA_` pour le référentiel — sont **déclaratives**.

Une seule déclaration les décrit : le registre **`src/server/mysql/variables.mjs`**, qui porte,
pour chaque variable, sa portée (*service* ou *référentiel*), son type, ses bornes, son rôle et
sa valeur d'exemple. Il en découle :

- la **validation** au démarrage du service : une valeur refusée (type, choix ou borne) n'est
  jamais appliquée, et son motif est journalisé — jamais de repli silencieux ;
- le **transport au navigateur** par `GET /v1/config` (route publique, sans secret), que
  l'application applique **par-dessus le référentiel** à chaque démarrage
  (`src/lib/deploiement-config.js`) ; le `.env` l'emporte donc sur l'interface, sans modifier
  le référentiel enregistré : une variable retirée n'est plus imposée au lancement suivant, et
  l'interface reprend la main ;
- le **wiki** `src/docs/VARIABLES.md`, engendré par `node src/scripts/generer-variables.mjs` et
  rendu dans *Documentation technique › Variables de déploiement*.

Une variable vide ou absente ne change rien. Les variables de **service** (base, comptes,
jetons, courriel, limites) sont validées par la même fonction et documentées par le même wiki,
mais ne sont jamais transmises au navigateur ; leurs secrets ne sont jamais rendus par
`lireVariables`, ni recopiés dans une erreur.

## 2.8 Parapheur, exécution et registre

### 2.8.1 Circuit de validation (le parapheur)

Le parapheur est une **fonction expérimentale, éteinte par défaut** (§ 2.1
`experimental.parapheur`) : on l'active dans `Administration › Expérimentale`. Éteint, il
**n'existe pas** pour l'application — `circuitFor` ne résout aucun circuit, l'écran
Parapheur, son entrée de menu, l'onglet « Circuits de validation » de l'Administration, le
réglage de circuit d'une trame et la carte Parapheur de la fiche d'un acte disparaissent
(gardés par `parapheurActif`, `src/lib/validation.js`), la porte de signature ne
s'applique plus, et l'état de validation n'est pas transmis au dépôt. Activer l'option
**régénère les actes de démonstration** (`regenerateDemoActes`, `src/ui/state.js`) : ils
portent, ou non, leur passage au parapheur (`src/lib/demo-actes.js`), et la validation ne
se génère que si l'option est active. Les circuits enregistrés sont conservés ; le réglage
suit le référentiel exporté/importé.

Actif, un acte n'est pas signé à l'issue de sa rédaction : il franchit un **circuit de validation**,
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

### 2.8.1 bis La révision : le contrôle entre la décision d'envoyer et l'envoi

Le **réviseur** s'intercale entre le geste du rédacteur (« Envoyer en signature ») et l'**envoi
effectif**. Le geste du rédacteur ne fait donc pas partir l'acte : il le **soumet** au réviseur
(`demanderRevision`). Le réviseur reçoit un **rapport de conformité** (`src/lib/conformite.js`),
peut **corriger** l'acte, puis :

- le **valider** (`validerRevision`) : l'acte part alors en signature, par le **même chemin** que
  le bouton « Envoyer en signature » (`envoyerEnSignature`, `src/ui/views/signature.js`) ;
- le **rejeter** (`rejeterRevision`) : l'acte **revient en brouillon** chez son rédacteur, et le
  **motif** (obligatoire) lui est communiqué.

Deux principes, les mêmes que le parapheur (`src/lib/revision.js`, module pur) :

**1. Une compétence, pas un rôle vague.** Un acte n'est révisé que s'il existe un **réviseur
compétent** pour lui ; sans réviseur compétent, la révision n'a **pas lieu** et l'acte part
directement en signature (comportement historique préservé — `revisionRequise`). La qualité se
donne de deux façons :

- à un **compte**, par le rôle cumulable « Réviseur » et sa **compétence propre** (`user.revision`) ;
- à un **service entier**, ou à certains de ses **bureaux**, par la déclaration portée sur le
  service (`service.reviseur`, Administration › Services : « Qualité de réviseur ») — le cas d'un
  service des affaires juridiques dont les agents contrôlent les actes des autres services.

Une **compétence** se limite à certains **services** (les services dont les actes relèvent du
réviseur), **familles** de trames, **trames**, **types d'actes** et **entités signataires** ; une
liste vide vaut « tout » (`competenceCouvre`). Les compétences d'un compte sont la **réunion** de
la sienne et de celles des services dont il relève (`competencesDe`).

```js
Competence = { services:[], trameIds:[], familyIds:[], actTypes:[], entityIds:[] }  // vide = tout
Reviseur   = { actif, bureaux:[], ...Competence }        // porté par un service
Revision   = { statut:"en_attente"|"valide"|"rejete",
               demandeeLe, demandeePar, demandeeParNom, empreinte, reviseurs:[],
               laboratoire, corrections, corrige,
               valideLe, validePar, valideParNom, rapport,
               rejeteLe, rejetePar, rejeteParNom, motif }
```

**2. La révision porte sur un texte.** L'**empreinte** du texte soumis (`empreinteTexte`,
`values` + `overrides`, FNV-1a — la même que le parapheur) est mémorisée. Si l'acte est réécrit
après coup — par le rédacteur, ou par le réviseur lui-même avant de valider —, l'empreinte le
dit : la révision devient **caduque** (`revisionAJour`) et doit être reprise. Le dossier de
révision consigne ce que le réviseur a corrigé (`corrige`, `corrections`, mesuré sur l'historique
de travail de l'acte).

**Ordre et portes.** La révision est indépendante du parapheur : l'ordre est **parapheur →
révision → signature**, et la porte d'envoi vérifie d'abord le parapheur, puis la révision
(`pretPourSignature`). Le service de signature applique la même règle de son côté : l'état de la
révision lui est transmis au dépôt (`normaliserRevision`) et il refuse d'ouvrir un circuit sur un
acte dont la révision n'est pas `valide` — `409 revision_incomplete`, ce que la fiche affiche.

**Le recours de l'administrateur.** Un administrateur peut **trancher** n'importe quelle révision
(`peutTrancherRevision`, comme il peut tenir n'importe quelle étape du parapheur), mais son rôle
ne rend pas la révision obligatoire du seul fait qu'il est administrateur : c'est la **compétence**
qui décide de l'existence de la porte.

**Écrans.** L'écran **Révision** (`src/ui/views/revision.js`) présente quatre files — *à réviser
par moi*, *en attente d'un autre réviseur*, *révisés*, *rejetés* — avec, pour l'acte choisi, le
dossier de la révision, le rapport de conformité et la décision. Sur la fiche d'un acte et à
l'en-tête de la rédaction, le rédacteur lit l'état de la révision et le **motif** d'un rejet. Les
gestes partagés vivent dans `src/ui/revision-actions.js`, les cartes dans
`src/ui/revision-cartes.js` (`etatRevision` pour l'état affiché, « caduque » compris).

> **Démonstrateur.** La démonstration livre **deux réviseurs** : Amandine ROUSSEL (affaires
> juridiques, compétente pour tous les services et tous les actes) et Isabelle DAVAL (directrice
> des affaires juridiques, transverse, dont la compétence propre porte sur les actes d'engagement
> financier). Le service **Affaires générales** tient par ailleurs la qualité de réviseur pour ses
> agents. Les actes de démonstration montrent une révision en attente, une révision validée
> (avec correction) et un acte rejeté, revenu en brouillon.

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
*recours*, *définitifs* et *tous*, avec les alertes correspondantes.

Statuts d'exécution : `brouillon` (non signé), `en_attente` (formalités requises manquantes),
`executoire` (recours ouvert), `recours` (recours introduit, voir ci-dessous), `definitif`
(délai de recours échu).

#### 2.8.2 ter Recours introduit, et pièces de l'exécution

**Le recours est un fait, pas une échéance.** L'administration apprend qu'un recours a été
introduit par la pièce qu'elle reçoit (requête enregistrée au greffe, lettre du requérant,
déféré du préfet) ; elle le **note** (`enregistrerRecours`, `src/lib/execution.js`) avec sa
**date d'introduction**, sa **nature** (`RECOURS_TYPES` : gracieux, hiérarchique, contentieux,
référés, déféré préfectoral), son auteur, sa référence et une observation libre. Comme une
formalité, la mention peut être **corrigée** ou **retirée** (journalisée).

```js
acte.execution.recours = {
  introduitLe:"2026-05-20", type:"contentieux",
  demandeur:"M. et Mme VASSEUR (par Me Lorrain)", ref:"requête n° 2601894 — TA d'Orléans",
  note:"…", by, byName, enregistreLe }
```

Un recours **ferme le délai** : l'acte passe au statut `recours` (et non `definitif`), même une
fois le délai expiré, et il le reste **jusqu'à la décision du juge**. Conséquence directe : une
**attestation de non-recours ne peut pas être délivrée** pour un acte contesté — la fonction le
vérifie elle-même et refuse d'attester le faux.

Deux **pièces** se délivrent depuis l'échéancier (`src/lib/execution-documents.js`), imprimées
sur le papier A4 commun (`paper.js`) et enregistrées en PDF par l'impression du navigateur
(`printHtml`, `src/lib/export.js`). Leur en-tête est celui de l'entité (et non la charte de
l'acte) : ce ne sont pas des actes, mais des écrits administratifs de la collectivité.

| Pièce | Pour quel acte | Contenu |
|---|---|---|
| **État des formalités** | **tout acte signé**, quel que soit son état | tableau des formalités (date, référence, modalité, auteur, requise ou non), certificat de transmission éventuel, puis *Délais et situation* (exécutoire, délai, recours) |
| **Attestation de non-recours** | acte **`definitif`** et **sans recours** seulement | identification de l'acte, attestation qu'aucun recours n'a été porté à la connaissance de la collectivité, formalités par lesquelles l'acte est devenu exécutoire, date d'expiration du délai, bloc de signature de l'autorité |

La délivrance d'une pièce est un **fait du dossier** : elle entre au journal
(`document.etat_formalites`, `document.attestation_non_recours`), comme la constatation d'une
formalité.


#### 2.8.2 bis Transmission au contrôle de légalité par API

**Fonction expérimentale, éteinte par défaut** (`experimental.controleLegalite`, Administration ›
Expérimentale). Activée, elle **s'intercale automatiquement entre le retour signé et la
publication** ; éteinte, la transmission reste une **constatation manuelle** (§ 2.8.2) et l'étape
n'existe pas.

```js
CONTROLE_LEGALITE = { id:"controle-legalite", service:"Télétransmission au contrôle de légalité",
                      destinataire:"Préfecture — contrôle de légalité", mode:"ctes",
                      apiUrl:"https://api.ctes.exemple.fr/v1/transmissions" }   // adresse d'EXEMPLE (transmission simulée)
certificat = { nature, emisPar, emisLe, destinataire, reference, algorithme:"SHA-256",
               empreinte,   // SHA-256 du document transmis
               sceau,       // SHA-256 de reference|recuLe|destinataire|empreinte
               mention:"Transmis au contrôle de légalité le 22 janvier 2026 à 09 h 14" }
```

Le déroulé, dans `publierApresSignature()` (`src/ui/views/signature.js`) :

1. l'acte signé est adressé à l'**API d'envoi** — `POST /v1/actes/{id}/transmission` —, ce qui
   **trace aussi l'appel sortant** vers `apiUrl` dans le journal du service (`recordExternal`,
   service `controle-legalite`) ;
2. l'**accusé de réception** revient ; il **vaut certificat informatique de transmission** ;
3. le certificat est **déposé sur le document** — `acte.original.transmission` (l'empreinte du
   paquet signé n'est pas touchée : le certificat est une pièce du dossier, pas une signature) et
   la mention est imprimée sur la **version en ligne** (`buildWebVersion`, `src/lib/eli.js`) ;
4. la formalité est **constatée** au nom de l'agent (`enregistrerFormalite`, avec `certificat`) ;
5. l'acte est **publié** (§ 2.8.2), avec le certificat joint à l'enregistrement de publication.

L'ordre **signé → transmis → publié** est tenu **côté service**, pas seulement côté client : le
drapeau accompagne le dépôt (`POST /v1/actes`, champ `controleLegalite`), la transmission d'un
acte non signé est refusée (`409 acte_non_signe`), et la publication d'un acte soumis à l'étape
est refusée tant que la transmission manque (`409 transmission_absente`) — après le contrôle de
signature, avant celui de la date. La transmission est **idempotente** (un acte déjà transmis
renvoie son certificat), et `GET /v1/actes/{id}/transmission` relit le certificat. Le même
contrat est porté par les deux services (`index.html` et `src/server/mysql/actes.mjs`).

Un acte **déposé avant l'activation** ne porte pas l'exigence : le service le publiera sans
transmission. Le certificat se lit sur la **fiche de l'acte**, dans l'**échéancier**, sur
l'**original signé** (bloc « Certificat de transmission ») et sur le **document publié**.

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
  `tous`. L'écran **Administration › Journal d'audit** affiche tous les faits, du plus récent au
  plus ancien, avec recherche plein texte.
- **Historique des brouillons** — `acte.revisions` (vingt dernières) : à chaque
  enregistrement, l'état **précédent** est conservé (valeurs, écarts, libellé, auteur, date).
  La restauration d'une version archive d'abord l'état courant : **rien ne se perd**. La
  validation, si elle existait, devient caduque et devra être reprise.

Actions journalisées (libellés de l'écran) : `parapheur.depot`, `parapheur.accord`,
`parapheur.passe`, `parapheur.renvoi`, `parapheur.refus`, `parapheur.reprise`,
`revision.depot`, `revision.validation`, `revision.rejet`,
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

### 2.8.5 Les assistants (Plume et Publia)

Deux aides en langage naturel, **désactivables séparément** et réglées dans le référentiel
(`config.assistant.atelier` / `config.assistant.public` — seuls les ÉCARTS aux réglages
livrés y sont rangés) :

| | **Plume** — atelier | **Publia** — recueil public |
|---|---|---|
| Objet | le **mode d'emploi** de l'outil | les **actes publiés** |
| Connaissance | le guide d'utilisation (`src/wiki.js`), public, + le nom de l'écran courant | les publications du registre public : métadonnées, et le texte des dix plus récents |
| Jamais | le contenu d'un acte, d'une trame, d'un brouillon, d'un compte | un brouillon, un acte non publié, un compte |
| Visibilité | atelier, session ouverte, hors recueil | recueil public uniquement |

**Identité réglable.** Le **nom** et l'**icône** de chaque assistant se changent dans le
référentiel (`config.assistant.<qui>.nom` / `.avatar`, une adresse d'image). L'interface les relit
partout — pastille, panneau, bulle d'invitation, menu du compte : elle est construite **une fois**
et son identité est rafraîchie, sans reconstruire la conversation. Un nom ou une icône **vide**
n'est pas un choix : `assistantSettings` retombe sur les valeurs livrées, et `assistantIdentite`
est la seule source de ce que l'interface affiche.

**Préférence de poste.** Chaque agent peut **masquer** un assistant pour son seul compte (menu du
compte), comme l'apparence claire ou sombre : `assistantPref` / `reglerPrefAssistant` rangent ce
choix dans le stockage du navigateur, **par compte** (`scribae.assistant.<qui>.<userId>`), hors du
référentiel — l'absence de réglage vaut **allumé**. Ce n'est pas le réglage *Éteint* de
l'Administration, qui vaut pour toute l'installation. `assistantVisible(config, user, qui)` croise
les deux ; l'interface retire alors la pastille et le panneau, et n'envoie plus rien au moteur.

**Règle de confidentialité.** Ce qui n'est pas dans la colonne « Connaissance » n'est jamais
composé dans l'invite : il n'y a rien à filtrer, parce que rien n'est transmis. L'assistant de
l'atelier ne *peut pas* voir un acte — aucune fonction ne le lui donne, et la connaissance est
construite à partir du seul guide, qui est public.

**Moteur interchangeable** (`Administration › Assistants`) :
`auto` (défaut — le moteur intégré s'il existe, l'adresse personnalisée sinon, le repli
documentaire à défaut),
`integre` (le plugin `ai-text` de Perchance, via `hostGenerateText`),
`personnalise` (API de la collectivité). Deux protocoles sont acceptés : **complétions de
conversation** (`messages` rôle/contenu, flux SSE ou réponse JSON — OpenAI, Mistral, Groq,
OpenRouter, Ollama, vLLM, LM Studio…) et **appel simple** (`{ prompt } → { texte }`). Le
**relais sans CORS** de la plateforme est proposé en option pour un service qui n'autorise
pas l'origine de l'application. Sans moteur disponible — c'est le cas d'une page servie en
statique, et d'un déploiement sans API —, l'assistant ne lève pas : il **explique pourquoi**
et renvoie à l'Administration.

**Repli documentaire.** Faute de moteur de langage, l'assistant répond quand même, par
**recherche dans ce qu'il sait** — et sans le moindre appel réseau : `moteurDe` rend alors
`{ type: "repli" }`, et `repondre` court-circuite la composition de l'invite. Plume classe les
chapitres du guide avec `chapitresPertinents` — la fonction même qui choisit la connaissance
d'un moteur — et met le meilleur **mis à plat** (`chapitreEnTexte`), tronqué sur une fin de ligne
(`suiteTronquee`) pour que son lien reste entier. Comme une question est souvent ambiguë
(« envoyer un acte » : par courriel ? en signature ? à la révision ?), il **nomme les trois
chapitres** retenus, chacun avec son titre et son résumé — un titre bien choisi dit mieux ce que
contient un chapitre que le classement le plus savant — et donne l'extrait du premier ;
`chapitreEnTexte` écrit pour un modèle, ses repères (« [attention] », les illustrations) sont
donc traduits ou retirés avant d'être montrés (`pourLecture`). Faute de chapitre, il renvoie au
chapitre de l'écran courant ou au sommaire. Publia classe les actes publiés (`scoreActe` : métadonnées comptées trois fois, texte
une fois) et rend la fiche d'un acte (`ficheLisible` — nature, numéro, objet, autorité, dates,
ELI, état de rédaction, début du texte, lien) ; l'acte consulté l'emporte à égalité, et faute de
correspondance elle liste les derniers actes publiés. Ce sont des **extraits, pas des réponses
rédigées** : l'écran le dit dans une note (`fr-alert--info`) qui laisse la saisie ouverte —
là où un moteur réclamé mais absent (`aucun`) ferme la saisie et affiche une alerte. C'est ce
qui donne un assistant utile à GitHub Pages, sans clé d'API, sans service à installer, et sans
qu'un mot de la question sorte du navigateur.

**Budget de connaissance.** La fenêtre utile du moteur intégré est de 6 000 jetons ; le guide
entier en ferait 21 000. `chapitresPertinents()` classe les chapitres : ses quatre CHAMPS sont
pondérés (titre ×10, résumé et mots-clés ×7, corps ×1) et chaque mot est pondéré par sa rareté
*dans ce champ* — un mot présent dans tous les titres (« acte ») ne désigne personne, un mot qui
ne vit que dans un seul titre pèse son poids plein. `contexteAtelier` joint les
trois premiers, ceux de l'écran courant, puis un socle, **tronqués plutôt qu'écartés**, avec la
table des matières complète sous les yeux du modèle. Le budget est lu du moteur lui-même
(`getMetaObject().countTokens`) quand il est disponible, estimé sinon.

**Écran.** `src/ui/assistant.js` pose les deux pastilles **hors de la coquille**
(`document.body`), une fois, au démarrage : elles ne sont pas reconstruites aux redessins et
une conversation en cours survit au changement d'écran ; c'est leur visibilité qui suit la
route. Chaque assistant porte une **bulle d'invitation** (une question proposée, tirée au sort,
proposée une fois par chargement) et un **panneau** : accueil, messages, questions proposées,
zone de saisie, arrêt de la génération en cours, effacement.

**Renvois cliquables, et l'acte consulté.** Les réponses renvoient **par des liens**, jamais par
une adresse à composer. `guideSommaire()` suffixe chaque ligne du sommaire de
« `— lien : [titre](#/aide/<id>)` » (`lienChapitre`), et `contexteAtelier` donne le lien du
chapitre courant : Plume termine par ce lien, recopié tel quel. De même, `contextePublic` donne à
chaque acte publié son lien (`hrefActe`, `[numéro — objet](?acte=<clé>)`), que Publia recopie.
Le panneau intercepte les clics sur `a[href]` (`routeInterne`) et ouvre la route **dans
l'application** — `#/aide/<id>` pour le guide, `recueil/<clé>` pour un acte — sans recharger la
page ni ouvrir d'onglet. Ce que le moteur ne fait **jamais** : inventer une adresse, ou parler de
« clé », de « paramètre », d'identifiant technique — le lecteur clique, il ne compose rien.

**L'acte que l'on consulte.** Quand la route est un acte du recueil, `acteConsulte()` (écran) lit
l'acte déjà chargé par la vue — à défaut, le registre ; `contextePublic({ …, acte })` en compose
une section à part : fiche (nature, numéro, objet, autorité, matière, dates, ELI), état de
rédaction (initiale, modificative, consolidée ; en vigueur ou supplantée), **toutes les versions
publiées sous le même identifiant** (celle qui est consultée est marquée), le lien, et le **texte**
(tronqué sur fin de ligne par `suiteTronquee`). L'instruction demande alors de répondre **d'abord
sur cet acte**. Trois questions d'acte (`QUESTIONS_ACTE`) passent en tête des questions proposées.

**Réglages par assistant** : allumé/éteint, **nom** et **icône**, moteur (adresse, clé, en-tête,
modèle, protocole, relais), **instruction** donnée au moteur (rôle et consignes) et **questions
proposées** (étiquette + question), ajoutables et supprimables. « Rétablir les réglages livrés »
efface les écarts.

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
jamais partagé. Écran **Administration › Base de données** (réservé à
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
  et opposabilité sont inchangés ;
- la feuille de style reprend la règle `[hidden] { display: none !important; }` que la
  plateforme injecte : tout le code écrit `el.hidden = true`, et sans cette règle une classe
  qui pose `display: flex` l'emporterait sur le `display: none` du navigateur (sélecteur
  d'attribut 0,1,0 contre sélecteur de type 0,0,1) — un panneau fermé resterait ouvert, un
  bouton sans objet resterait visible ;
- l'assistant n'a **aucun moteur de langage** (le moteur intégré n'existe que sur Perchance) :
  `moteurDe` rend `{ type: "repli" }`, et Plume comme Publia répondent par **recherche
  documentaire** (voir 2.8.5) — sans clé, sans service à installer, et sans qu'un mot de la
  question sorte du navigateur. Un administrateur qui veut des réponses rédigées renseigne
  l'adresse d'une API (Administration › Assistants).

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
1. **Administration** — identité, entités, personnes, rôles, **services et bureaux**, références
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
   gestionnaire et, au besoin, du bureau), duplication, **import d'un document Word (.docx) ou
   LibreOffice (.odt)** en trame, **mise à disposition** des services (brouillon / mise à
   disposition / archivée), export JSON. L'import d'un document **n'enregistre rien** : la trame
   proposée s'ouvre dans l'éditeur (adresse réservée `trame/__import__`), avec ses « points à
   vérifier », et l'éditeur décide de l'enregistrer ou de l'abandonner. Une trame reste en
   **brouillon** — invisible des services — tant qu'un éditeur ne l'a pas **mise à disposition** ;
   le geste inverse (retirer) la referme sans toucher aux actes déjà rédigés, et les deux sont
   journalisés.
3. **Éditeur de trame** (administrateurs et éditeurs) — 3 volets : plan / page WYSIWYG /
   inspecteur. Édition inline ; **réserve d'éléments** sous le plan (champs, informations
   remplies automatiquement, blocs) d'où partent tous les gestes : on **glisse** un champ dans
   le texte — il se pose exactement où on le lâche —, un bloc avant ou après un autre ; le
   **clic** équivaut au glisser (cliquer la puce l'arme, puis cliquer dans le texte), pour qui
   ne maîtrise pas le glisser. Le type d'un champ se choisit **sur des cartes**, jamais dans
   une liste déroulante ; les questions du formulaire forment une liste **repliable**. Le volet
   inspecteur porte quatre onglets — « Ce bloc », « Questions », « Contrôles », « Trame » :
   clauses conditionnelles, commentaires (avec niveau et référence juridique), règles avec test
   immédiat. Commentaires et règles
   sont **signés du service** du compte qui les a saisis (l'auteur n'est pas saisi à la main).
4. **Rédiger** (services) — l'onglet ouvre d'abord le **choix de l'acte à rédiger** : la
   rédaction en cours, un acte enregistré encore modifiable, ou une trame **mise à disposition**
   (liste filtrée par le périmètre **et par la disponibilité**, avec recherche : un modèle en
   brouillon n'est pas proposé, et son ouverture directe est refusée — sauf à un éditeur, ou
   pour une rédaction déjà commencée). Le **document est ensuite le
   formulaire** : page A4 éditable en place,
   pastilles de champs cliquables, saisie possible aussi depuis le panneau de droite
   (« À compléter » / « Contrôle & écarts »). Le **numéro** se réserve de là — bouton
   « Réserver le prochain numéro », ou **« Demander le numéro »** quand la collectivité le fait
   attribuer par un service externe (§ 2.1 bis). Le texte du modèle peut être réécrit : les
   réécritures deviennent des **écarts « hors trame »** (conservés, signalés, non
   bloquants, visibles des administrateurs). Les **blocs du document se déplacent** — deux
   flèches sur le bloc, ou un glisser par la poignée ⠿ ou par le numéro de l'article/division —
   et l'ordre choisi renumérote le dispositif, sans rien changer à la trame (§ 2.4.1). Export
   bloqué seulement par un contrôle
   bloquant de la trame. Si le parapheur est actif, l'en-tête indique **où en est l'acte dans
   son circuit de validation** (« Soumettre au circuit » tant qu'il n'a pas été soumis) et la
   fiche de l'acte porte la carte du parapheur ; éteint, rien de tout cela n'apparaît.
4 bis. **Parapheur** (seulement si `experimental.parapheur`, voir 2.8.1) — l'écran du valideur :
   *à valider par moi*, *en cours*,
   *validés*, *renvoyés ou refusés*. On y donne son **bon pour accord** (ou son avis), on
   **renvoie** l'acte en rédaction, on le **refuse**, ou on **reprend** un circuit — chaque
   décision étant motivée par une observation. Un acte validé puis **réécrit** voit sa
   validation devenir **caduque** : l'écran le dit et propose de reprendre le circuit.
4 ter. **Révision** (seulement s'il existe un réviseur compétent, voir 2.8.1 bis) — l'écran du
   réviseur : *à réviser par moi*, *en attente d'un autre réviseur*, *révisés*, *rejetés*. Le
   réviseur y lit le **rapport de conformité** de l'acte, le **corrige** au besoin, puis le
   **valide** — l'acte part alors en signature — ou le **rejette** en motivant, l'acte revenant
   en brouillon chez son rédacteur. Du côté du rédacteur, « Envoyer en signature » **soumet**
   l'acte au réviseur au lieu de l'envoyer, et l'en-tête de la rédaction comme la fiche de l'acte
   affichent l'état de la révision et le **motif** d'un rejet.
5 bis. **Exécution & délais** — l'échéancier (voir 2.8.2) : *formalités à accomplir*,
   *recours*, *définitifs*, *tous les actes signés*. On y **constate** la transmission
   au contrôle de légalité, la publication (hors chaîne ELI) ou la notification, l'on y
   **note l'existence d'un recours** (date d'introduction, nature, auteur — voir 2.8.2 ter) et
   l'on y **délivre les pièces du dossier** (l'**état des formalités** pour tout acte signé,
   l'**attestation de non-recours** pour un acte définitif que personne n'a contesté) ; on y voit
   la date d'**exécutoire**, le **délai de recours** restant et les retards. Quand la
   **télétransmission** est active (§ 2.8.2 bis), la transmission ne se constate plus à la
   main : elle est faite par l'API d'envoi au retour de la signature, et l'échéancier en
   affiche le **certificat** (« Transmis au contrôle de légalité le … à … », référence,
   sceau).
5 ter. **Délégations** — l'**organigramme des délégations de signature** (voir 2.7.2) : les
   chaînes de signature présentées en **arbre** — une autorité de tête, puis ses délégataires,
   puis les sous-délégations — ou en **liste** indentée sur les écrans étroits. Cliquer un
   acteur ouvre sa **fiche** : le pouvoir reçu (délégant, organisation, décision fondant la
   signature), l'étendue (famille, type d'acte, matières), les dates, et **la signature que
   cela produira** (les lignes de qualité et les visas). Visible par **tous les comptes** ;
   modifiable par les seuls **administrateurs et éditeurs** (`delegations.gerer`) — les autres
   lisent la même fiche, sans les champs de saisie.
5. **Actes** — registre **filtré par le périmètre du compte** : numéro, objet, nature
   (d'origine / modificatif / consolidée / importé), conformité à la trame (« conforme » ou
   « N écart(s) »), entité, **service et bureau**, signature, statut, **parapheur** (colonne
   présente seulement si la fonction expérimentale est active),
   **exécution** ; « Reprendre » rouvre le document, « Voir » l'affiche, « Modifier » lance un
   acte modificatif. Le registre signale ce qui attend un geste (actes à valider, formalités en
   retard, actes à la corbeille) et permet de **mettre un acte à la corbeille** (suppression
   réversible, écran **Corbeille** — voir 2.8.3) — **pour un brouillon seulement** : un acte
   signé ou publié porte à la place **« Retirer / abroger »**, qui propose de rédiger un acte
   d'abrogation (voir 2.5 bis). Le registre affiche le badge **« abrogé »** ou
   **« abrogation prévue »** à côté du statut, et la fiche de l'acte dit par quoi il a été
   abrogé. La **recherche globale** (Ctrl+K ou « / »)
   retrouve n'importe quel acte, trame, personne, service, référence ou compte.
6. **Modifier un acte** — choisir un acte du registre ou importer le fichier de l'acte
   publié ; le document en vigueur s'ouvre **éditable comme dans un traitement de texte**
   (réécrire un article, l'abroger ou le rétablir, insérer un article, **ajouter ou retirer un
   paragraphe, une ligne de liste, une ligne de tableau**, **réattribuer un numéro** ou **tout
   renuméroter**) ; à la confirmation,
   production simultanée de l'**acte modificatif** et de la **version consolidée** (présentée
   par défaut dans sa rédaction en vigueur, mentions sous les articles modifiés ; le suivi des
   modifications s'affiche sur option). Le
   modificatif part en signature puis est publié ; sa publication publie la version
   consolidée, qui **supplante** l'acte initial, lequel demeure accessible via l'historique
   des modifications. Un acte peut aussi **prévoir, dans son propre texte, l'abrogation d'un
   autre acte ou de l'un de ses articles** — onglet « Abrogations » de la rédaction (voir
   2.5 bis). Sur une **annexe** (un règlement intérieur), l'écran ouvre son régime propre :
   l'acte modificatif **adopte la nouvelle rédaction** de l'annexe, en suivi des
   modifications — la case « Modification par adoption » se décoche pour une modification
   classique, article par article (voir 2.2.4).
6 bis. **Annexes** — une trame peut être de nature **Annexe** (onglet « Trame » de l'éditeur) :
   le document est **adopté par un autre** : l'annexe ne se signe ni ne se publie pour
   elle-même, et **son texte suit l'original signé de l'acte qui l'adopte**, à la suite de la
   signature. À la rédaction, on **désigne l'acte d'adoption** (carte « Annexe »), et l'acte qui
   adopte **annonce ses annexes** (carte « Annexes », bouton « Joindre une annexe ») — il en
   affiche alors le texte en lecture seule sous le document. Le visa d'adoption vient en tête des
   visas de l'annexe, la liste des annexes ferme le dispositif de l'acte adoptant, et les fiches
   renvoient de l'un à l'autre (voir 2.2.4 et 2.5). Une annexe déclarée **Règlement**
   (`trame.reglement`, case « C'est un RÈGLEMENT ») est en outre **publiée à part au recueil**, à
   titre informatif, sous un identifiant stable — c'est un texte normatif qu'on consulte pour
   lui-même, comme un code (voir 2.2.4 ter et 8 bis).
7. **Signature & publication** — l'application est cliente de l'API REST du service :
   dépôt de l'acte finalisé, ouverture du circuit auprès du prestataire de signature
   (écran distinct), retour de l'acte signé par notification, suivi du circuit. Un
   onglet « API & journal » montre la description OpenAPI et chaque échange (requête,
   réponse, statut, durée), y compris les appels sortants vers le prestataire.
8. **Publications** — onglet « Publication (ELI) » : versement de la version en ligne au
   recueil, attribution de l'**identifiant ELI**, date de publication et date
   d'opposabilité, conservation de l'original signé. L'écran « Publications (ELI) » est
   le **registre de l'administration** : recherche d'un acte, résolution d'un identifiant
   ELI, consultation du texte (rendu dans la page), des métadonnées, des versions et de
   l'original signé (avec vérification de la signature) ; il donne accès au **recueil
   public**. (permission `signature.gerer`)
8 bis. **Le recueil public** — un **site sans compte** (routes `recueil`, servies avant la porte
   de connexion : `?recueil=1` et `?acte=<clé>` dans la page, `/recueil` et `/recueil/<clé>` sur un
   déploiement serveur). Sa **page d'accueil** se lit comme celle d'un site : une entrée avec la
   recherche, un **carrousel des derniers actes publiés** (le thème mis en avant sur chaque carte),
   les **thèmes** en grille — la matière de chaque acte, par laquelle on accède à ses actes —, puis
   la liste complète groupée par année. Chaque acte s'y lit dans la page, avec ses métadonnées.
   **Dès qu'une recherche est en cours** — on frappe dans l'entrée, ou l'on choisit un thème —, le
   carrousel et la grille des thèmes **s'effacent** au profit des seuls résultats ; ils reviennent
   quand on efface la recherche ou les filtres. Les **règlements** publiés à titre informatif
   (2.2.4 ter) comptent parmi les publications du recueil : ils se cherchent, se classent par thème,
   et leur identifiant s'ouvre directement.
   Le **bas de page** (et le bout de ses résultats de recherche) renvoie vers les recueils qu'il ne
   gère pas — recueils « bis », recueils inactifs avec leur période — et vers les sites de
   référence (Légifrance, service-public.gouv.fr), sous le titre « Vous ne trouvez pas ce que vous
   recherchez ? » ; ces renvois se règlent dans Administration › Publication.
   Rien de l'administration n'y figure,
   seulement la structure et le titre du recueil (voir 2.6 bis). Le **recueil ouvert** (2.6 ter)
   ajoute ce que lisent les moteurs et les agents : une adresse stable par acte, ses
   représentations (JSON, Markdown, texte, Akoma Ntoso), ses métadonnées de page, et les fichiers
   du site (`llms.txt`, `recueil.json`, `sitemap.xml`, `robots.txt`). (public)
9. **Guide** — wiki d'utilisation intégré, écrit pour un agent administratif peu à
   l'aise avec l'informatique (voir section 6).
10. **Documentation technique** — les documents livrés avec le logiciel, lus dans
   l'application : `docs/ADMINISTRATION.md` (exploitation, sécurité, sauvegardes,
   auto-hébergement), `server/README.md` (installation), `SPEC.md`, `README.md`,
   `TODO.md`. Sommaire, recherche visuelle, impression et téléchargement du fichier
   source. **Réservé aux administrateurs** (permission `docs.voir`) : entrée de menu,
   renvoi du menu du compte et encart au bas du « Guide » n'apparaissent que pour eux,
   et toute route `docs` menée par un autre rôle retombe sur le premier écran permis.

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
| Écrire un acte, pas à pas | choisir l'acte à rédiger, compléter le document : pastilles, réécritures, déplacement des blocs, divisions, annexes, enregistrement, export | tous |
| Contrôle & écarts | comprendre les messages et les passages réécrits | tous |
| Enregistrer, imprimer, envoyer | où arrive le fichier, comment le joindre à un courriel | tous |
| Faire valider un acte (le parapheur) | le circuit de validation avant la signature | tous |
| Faire réviser un acte avant sa signature | le contrôle du réviseur : rapport de conformité, correction, validation ou rejet motivé | tous |
| Retrouver un acte | le registre, les statuts, reprendre un brouillon | tous |
| Faire signer un acte | le circuit de signature, le prestataire, l'original signé | tous |
| Publier l'acte (ELI et opposabilité) | version en ligne, identifiant ELI, dates, recueil public | tous |
| Modifier un acte déjà écrit | acte modificatif, version consolidée, import | tous |
| Adopter une annexe (un règlement, un tableau…) | le document adopté par un autre, qui ne se signe ni ne se publie pour lui-même — son texte suit l'acte qui l'adopte : le désigner, le rattacher, le modifier par adoption d'une nouvelle rédaction, et, s'il est déclaré **règlement**, sa publication informative à part au recueil | tous |
| Préparer une trame | l'éditeur de trame, champs, règles, commentaires signés de leur service, divisions (livre, titre, section…) et trames d'annexe | administrateurs et éditeurs |
| Qui peut faire quoi : les comptes et les rôles | se connecter, les six rôles (dont le réviseur et le signataire, cumulables, et le visiteur, sans accès), ce que chacun débloque | tous |
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
- **Assistant de rédaction.** Les deux assistants (Plume, dans l'atelier, et Publia, sur le
  recueil public) sont **livrés** et actifs (voir 2.8 et `src/lib/assistant.js`) : ils
  interrogent un moteur de langage — le moteur intégré de la plateforme, ou celui que
  l'administrateur branche (clé conservée sur le poste, jamais dans le référentiel). Restent
  hors périmètre : la **rédaction automatique du texte d'un acte** par l'assistant, et la
  fourniture d'un moteur par l'application elle-même.
- **Parapheur et exécution — suite.** Le circuit de validation, l'échéancier des formalités,
  la corbeille, le journal d'audit, la recherche globale et la collaboration sont livrés
  (voir 2.8). Restent hors périmètre : la **suppléance** nominative d'un valideur (vacances,
  intérim, délégation temporaire), le **résumé quotidien** des notifications (courriel) et leur
  résumé quotidien, l'**export et la rétention** du journal d'audit, la lecture du journal
  technique `sb_journal` depuis l'application, et le **verrou de rédaction exclusif** (le
  verrou actuel avertit, il n'empêche pas).
- **Suivi du contentieux.** L'échéancier note l'**existence d'un recours** et sa **date
  d'introduction** (§ 2.8.2 ter) et en tire le statut de l'acte ; il ne tient pas le dossier de
  l'instance — mémoires, dates d'audience, jugement. L'issue se consigne dans l'**observation**
  attachée au recours.
