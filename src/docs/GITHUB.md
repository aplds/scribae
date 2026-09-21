# Scribae

**Éditeur de trames et d'actes administratifs.** Les administrateurs préparent des **trames**
(structure, champs, règles, commentaires), les services les remplissent, le logiciel **compile**
l'acte, le **signe**, le **publie** — automatiquement dès la signature pour un acte publiable — et
l'exporte dans des formats
ouverts et normés : **Akoma Ntoso 3.0**, **Schematron**, **JSON-LD/ELI**, HTML imprimable (format
A4), Word, Markdown.

![Le recueil public, page d'accueil de Scribae](https://user.uploads.dev/file/06d748c1bac8b420d52e7572cc6d66f0.jpg)

![L'atelier de Scribae](https://user.uploads.dev/file/39e80c075f4725348ce5c5d6df3e4dfb.png)

> **Démonstration.** Le jeu de données livré est **entièrement fictif** : il configure l'outil pour
> la **mairie de Valmont-sur-Loire** (entités, services et bureaux, personnes, rôles, références
> juridiques, numérotation, recueil). Rien de réel. La signature électronique est **réellement
> vérifiable** (ECDSA P-256 / SHA-256), mais son certificat est un certificat de démonstration, non
> qualifié au sens du règlement eIDAS, et le prestataire de signature est **simulé**.

## Essayer, sans rien installer

**<https://aplds.github.io/scribae>** — la démonstration est publiée par **GitHub Pages**.

L'application s'ouvre sur le **recueil public** — les actes publiés, consultables par tout le monde,
**sans compte**, avec leur identifiant ELI et leur texte. Pour entrer dans l'atelier, cliquez sur
**Se connecter** (en haut du recueil) : la démonstration présente **onze comptes fictifs**, par
profil, qui s'ouvrent d'un clic — **sans mot de passe**.

| Profil | Ce qu'il montre |
|---|---|
| **Rédacteur** | remplit un acte à partir d'une trame |
| **Éditeur** | valide, signe, publie |
| **Administrateur** | règle le référentiel, écrit les trames, gère les comptes |

**Rien de ce que vous faites là n'est partagé** : tout reste dans votre navigateur, et vous ne
touchez aux données de personne. Pour repartir du jeu d'origine, *Administration › Données ›
Réinstaller la démonstration*.

## Pourquoi ce logiciel

Un acte administratif n'engage l'administration et ne s'impose aux administrés qu'à partir du
moment où il a été **publié** : la publicité n'est pas un détail de procédure, c'est elle qui rend
l'acte **opposable** et qui fixe son **entrée en vigueur**. Le **code des relations entre le public
et l'administration** (CRPA) en fait une condition de légalité, et il impose, depuis 2016, de
**publier en ligne** les documents administratifs dans des formats réutilisables.

Scribae est né de là. Un acte doit être **rédigé**, **présenté**, **signé**, **publié au recueil**,
**transmis** et **donné à lire** ; fait à la main, ce circuit produit des fichiers Word, des PDF
scannés et des recueils que ni les administrés ni les moteurs de recherche ne peuvent exploiter.
Scribae part des **trames** — les modèles d'actes écrits une fois par le service —, compile le
document, le signe, le publie, et livre les formats ouverts : rien n'est ressaisi, rien n'est
enfermé dans un format propriétaire.

### Les exigences du CRPA, et ce que le logiciel en fait

| L'exigence | Le texte | Dans Scribae |
| --- | --- | --- |
| **La publicité conditionne l'entrée en vigueur** : un acte réglementaire entre en vigueur le lendemain de l'accomplissement des formalités de publicité. | [L. 221-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031367544), [L. 221-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031367546) | La publication est une **étape du logiciel** : sa date est enregistrée sur l'acte, l'application calcule la **date d'exécutoire** et l'opposabilité, et suit les délais (transmission, notification, recours). |
| **Publication au recueil des actes administratifs** de l'autorité (le CRPA renvoie, pour les collectivités, au code général des collectivités territoriales). | [L. 222-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044190686), [L. 222-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044190680), [L. 222-3](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000044190672), [L. 222-4](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031367602) | Le **recueil public** : chaque acte publié y reçoit une **adresse citable** et un **identifiant ELI**, et se consulte **sans compte**, dans sa version en vigueur. |
| **Publication au Journal officiel** pour les actes de l'État, et équivalence de la publication électronique d'un bulletin officiel. | [L. 221-9](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031367567), [L. 221-17](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031367581) | L'export **Akoma Ntoso** et l'identifiant **ELI** préparent la publication officielle ; la version publiée est conservée avec l'original signé. |
| **Publication en ligne obligatoire** des documents administratifs : documents communiqués, répertoire, bases de données, données d'intérêt économique, social, sanitaire ou environnemental. | [L. 312-1-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033205512), [L. 300-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031367689) | Le recueil public **est** la publication en ligne de l'acte, et il en expose des **représentations lisibles par machine** : JSON, Markdown, texte brut, Akoma Ntoso. |
| **Standard ouvert, aisément réutilisable**, et publicité des conditions de réutilisation. | [L. 322-6](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033219056), [L. 321-1](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033219044) | Tous les exports sont dans des **standards ouverts** (Akoma Ntoso 3.0, Schematron, JSON-LD/ELI, HTML, Markdown, Word) : téléchargeables, réutilisables, sans dépendance à l'éditeur. |
| **Protection des données personnelles** avant toute mise en ligne (occultation, anonymisation), et publication sans indexation par les moteurs de recherche pour certains actes individuels. | [L. 312-1-2](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033205514), [L. 221-14](https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000031677770) | Le logiciel distingue les actes **publiables** des actes **individuels**, qui sont **notifiés** et non publiés ; un déploiement serveur publie `robots.txt` et la carte du recueil, et les pages portent leurs métadonnées. |
| **Opposabilité et preuve de la publication.** | — | L'**original signé** est conservé et sa signature est **vérifiable** (ECDSA P-256 / SHA-256) ; le **journal d'audit** enregistre chaque geste, et la version publiée reste consultable. |

> Scribae **outille** ces obligations, il ne s'y substitue pas : c'est à l'administration de fixer
> sa politique de publication — ce qu'elle publie, ce qu'elle occulte, ce qu'elle notifie — et de
> vérifier sa conformité. Le logiciel lui donne les moyens de le faire sans ressaisie.

Et pour la **forme** : les **Feuilles de style** habillent les actes. L'État et ses opérateurs y
retrouvent la **charte graphique de l'État** (bleu France, typographie Marianne, en-tête et filet) ;
les collectivités, une variante **inspirée de cette charte sans ses éléments réservés**.

## Ce que fait le logiciel

| Écran | Rôle |
|---|---|
| **Trames** | modèles d'actes : structure, champs, règles exécutables, commentaires, import/export JSON |
| **Éditeur de trame** | plan, page éditable en place, réserve d'éléments à glisser, inspecteur (bloc, questions, contrôles, trame) |
| **Rédiger** | document éditable en place (WYSIWYG, pastilles de champs), écarts « hors trame » conservés et signalés, contrôles, exports |
| **Actes** | registre : numéro, objet, nature, conformité à la trame, statut, historique des brouillons ; pastille **« abrogé »** / **« abrogation prévue »** ; **corbeille réservée aux brouillons**, les actes signés ou publiés passant par **« Retirer / abroger »** |
| **Délégations** | **organigramme des délégations de signature**, visible par tous les comptes : les chaînes de signature en arbre (autorité de tête, délégations, sous-délégations) ou en liste ; un clic ouvre la **fiche** d'un acteur (pouvoir, étendue, décision, dates, signature obtenue et visas). Le modifier est réservé aux administrateurs et éditeurs |
| **Parapheur** *(fonction expérimentale, éteinte par défaut)* | circuit de validation du référentiel (étapes, rôles, ciblage), décisions motivées, empreinte du texte validé — à activer dans *Administration › Expérimentale* |
| **Signature & publication** | dépôt par API REST, **trois circuits de signature** — électronique (prestataire branché en API), **simple** (le signataire signe **dans Scribae**, avec son compte, après avoir coché la déclaration), **externe** (papier ou outil tiers) —, original signé vérifiable **partagé en deux parts : publique et interne** (les mentions nominatives et la trace des courriels ne sont jamais diffusées), publication au recueil, identifiant ELI, opposabilité ; onglet **« Ma signature »** pour le signataire — qui signe avec son compte, rapproché du compte de l'outil de signature, et ne voit que les actes de son **champ de compétence** |
| **Recueil public** | site ouvert à tous, **sans compte** : recherche des actes publiés, liste par année, et chaque acte présenté comme sur Légifrance — titre, version, métadonnées, texte dans la page (pas de feuille à télécharger), pièces et signature vérifiable — l'adresse à communiquer aux administrés. Les actes s'affichent **dans leur version la plus récente**, avec les cases **« Afficher les versions antérieures »** et **« Afficher les articles abrogés »** |
| **Exécution & délais** | formalités (contrôle de légalité, publication, notification), date d'exécutoire, délai de recours, **recours introduit** (date d'introduction, nature, auteur) qui ferme le délai, alertes ; **pièces du dossier** en PDF : état des formalités (tout acte), attestation de non-recours (acte définitif non contesté) ; **télétransmission au contrôle de légalité** *(+fonction expérimentale, éteinte par défaut)* : l'étape s'intercale entre le retour signé et la publication, l'accusé de réception de la préfecture (certificat « Transmis au contrôle de légalité le … à … ») est déposé sur le document, puis l'acte est publié |
| **Modifier un acte** | édition en place de l'acte en vigueur : ajout/retrait de **paragraphe**, de **ligne de liste** ou de **ligne de tableau**, **réattribution de numéro** (numéro libre) ou **« tout renuméroter »** ; acte modificatif + version consolidée, mentions « Modifié/Abrogé/Ajouté par » |
| **Abroger un acte, ou l'un de ses articles** | prévu **dès la rédaction** (y compris un acte non modificatif) : on vise au référentiel un acte — ou tel article d'un acte — à abroger ; la clause s'ajoute au document et l'abrogation prend effet **à l'entrée en vigueur** de l'acte qui la porte, non à sa publication |
| **Administration** | tout ce qui est configurable : identité, entités, services et bureaux, personnes (accord en genre de la qualité, décision fondant le pouvoir de signer), rôles, références, numérotation (**séquence interne, ou numéro attribué par un service externe**), circuits (**trois circuits de signature**), **courriel** (six notifications activables, expéditeur, adresse de réponse, copie systématique, état du **serveur SMTP** du déploiement et message d'essai), **publication** (titre du recueil, publication automatique, opposabilité), **fonctions expérimentales** (le parapheur), annuaire (OIDC), base de données |
| **Feuilles de style** | charte graphique des actes : marges, **police** (liste de polices proposées), en-tête, pied, filets, **intitulés encadrés** (côtés au choix), **listes à puces et listes numérotées « 1° 2° 3° »**, tableaux, signature, cadre ; édition directe |
| **Comptes et rôles** | cinq rôles — dont le **Réviseur** et le **Signataire**, qualités **cumulables** — plus le visiteur, sans accès ; **dix-sept permissions** ; périmètre par service et par bureau ; **personne du référentiel**, rapprochement du compte de l'outil de signature. Retirer un acte du recueil (dépublier) est réservé à l'administrateur, avec un avertissement en grand et un motif technique exigé ; **épingler** un acte (le mettre à la « une » du recueil public) est ouvert à l'administrateur et à l'éditeur |
| **Guide** | wiki intégré (24 chapitres, glossaire, dépannage) + documentation technique lue depuis les fichiers du dépôt |

Formats d'export : **Akoma Ntoso 3.0**, **Schematron**, **JSON-LD / ELI**, **HTML** autonome,
**Word** (`.doc`), **Markdown**, JSON — tous au **format A4** pour l'impression et le PDF.

## Comment s'en servir

Un **guide intégré** décrit chaque écran, pas à pas, dans la langue des services : bouton **Guide**
du menu de gauche. C'est le mode d'emploi — il ne suppose aucune connaissance informatique.

Le trajet d'un acte, en une ligne :

> **rédiger** → **contrôler** → **signer** → **publier au recueil** (automatique pour un acte
> publiable) → **suivre les délais** (contrôle de légalité, notification, recours). Une collectivité
> qui veut un circuit de validation interne avant la signature active le **parapheur**
> (*Administration › Expérimentale*) ; une collectivité qui télétransmet au contrôle de légalité par
> API active la **transmission au contrôle de légalité**, qui s'intercale alors automatiquement
> entre la signature et la publication. Une collectivité qui publie déjà dans **son propre
> système** éteint la **publication automatique** (*Administration › Publication*) : l'acte signé
> attend alors au registre, et se publie à la main — ou pas. Une collectivité qui **numérote déjà
> dans un autre logiciel** — un document **Grist**, un tableur en ligne, un référentiel interne —
> peut de même faire **attribuer le numéro par ce service** (*Administration › Numérotation*) :
> l'application le lui demande au moment de rédiger, et la ligne créée chez lui fait foi.

Les actes publiés se consultent par tout le monde, sans compte, dans le **recueil public**
(`?recueil=1`, un acte par `?acte=<clé>`) : une recherche, la liste par année, et le texte de
chaque acte rendu dans la page. C'est l'adresse à communiquer aux administrés ; l'écran
« Signature & publication » en donne le lien. Les moteurs de recherche et les agents (LLMs) y
accèdent aussi : chaque acte publié a une **adresse de référence** et des **représentations**
lisibles par machine (JSON, Markdown, texte brut, Akoma Ntoso, `&format=…`). Un déploiement
**hébergé sur votre serveur** (voir `ADMINISTRATION.md`, et `../server/README.md` pour la pile) les sert en vraies pages — `/recueil`,
`/recueil/<clé>`, `/recueil/<clé>.json` — et publie `/llms.txt`, `/recueil.json`, `/sitemap.xml`
et `/robots.txt` ; un déploiement statique (GitHub Pages) les rend dans la page, pour
les lecteurs qui exécutent le JavaScript.

Tout le reste est réglable sans toucher au logiciel : entités, services, personnes, rôles, types
d'actes, mentions, circuits de validation, délais, numérotation et charte graphique vivent dans
**Administration** et dans **Feuilles de style**, et s'exportent avec les données.

## Installer Scribae pour votre collectivité

### La façon la plus simple : GitHub Pages

1. Bouton **Fork**, en haut de cette page : une copie du dépôt est créée sur votre compte.
2. Dans votre copie : **Settings** → **Pages**.
3. *Source* : **Deploy from a branch** ; branche **main**, dossier **/ (root)** ; **Save**.
4. Au bout d'une minute, l'application est en ligne à `https://<votre-compte>.github.io/scribae/`.

Il n'y a **rien à compiler** : le dépôt est servi tel quel, et les chemins sont relatifs, donc un
sous-dossier de projet convient.

> **Ne supprimez pas le fichier `.nojekyll`** à la racine. GitHub fait passer le dépôt par Jekyll,
> qui interprète les accolades doubles de la documentation comme des balises de gabarit et **fait
> échouer la publication**. Ce fichier, même vide, désactive Jekyll.

Sous cette forme, l'application fonctionne **entièrement dans le navigateur de chaque visiteur** :
les documents restent sur leur poste et ne sont **pas partagés** entre collègues. C'est la bonne
solution pour essayer, pour une démonstration, ou pour un usage individuel.

Les **assistants** (Plume dans l'atelier, Publia au recueil) y fonctionnent **sans moteur de
langage** : ils ne rédigent pas de réponse, ils **retrouvent** le chapitre du guide ou l'acte
publié qui répond à la question, et y conduisent par un lien. Pour des réponses rédigées,
branchez l'API de langage de votre collectivité — un service compatible avec l'API des
complétions de conversation, ou un simple appel `{ prompt } → { texte }` (*Administration ›
Assistants*, adresse et clé). Les questions ne sont alors envoyées qu'à ce service-là.

### Pour travailler à plusieurs postes : votre propre serveur

Pour que trames et actes soient partagés par tout un service, deux voies :

- **le service compagnon livré dans ce dépôt** (`src/server/`) : une pile Docker — nginx, service
  Node, base MariaDB — qui s'installe en quelques minutes ;
- **la base de données de la collectivité** : si elle exploite déjà MySQL ou MariaDB, l'application
  s'y branche depuis *Administration › Base de données*.

- Installation pas à pas : **`src/server/README.md`**
- Exploitation, données, sécurité, sauvegardes, migration : **`src/docs/ADMINISTRATION.md`**

Ces deux documents s'adressent à votre service informatique.

## Vos données

- **Aucun compte en ligne n'est nécessaire.** En revanche, deux mécanismes peuvent sortir de la
  page : les **assistants** (Plume, Publia), qui transmettent la question — et rien du contenu de
  vos actes — au moteur de langage réglé (un moteur intégré quand il est disponible, ou celui que
  vous branchez) ; et la **notification par courriel**, quand un service SMTP est configuré sur un
  déploiement auto-hébergé. Tout le reste travaille en local.
- Par défaut, tout est enregistré **dans le navigateur** : c'est ce qui rend la démonstration
  immédiate, mais aussi ce qui la rend **propre à un poste**.
- La **signature électronique** est calculée localement et l'original signé est vérifiable par
  n'importe qui ; la publication passe par l'API de l'application (ou d'un prestataire, si l'on en
  branche un).
- L'export des données (référentiel, trames, actes, JSON, Akoma Ntoso, Word, PDF par impression) est
  disponible à tout moment depuis l'interface : **vous n'êtes jamais prisonnier du logiciel**.

## Version

Le logiciel porte un numéro de version, affiché au bas du menu du compte. L'historique détaillé,
version par version, est dans **`src/CHANGELOG.md`** et se lit aussi dans l'application
(*Documentation technique › Journal des versions*).

## Licence

Le **logiciel** (le code de ce dépôt) est distribué sous **GNU General Public License, version 3**
— voir le fichier `LICENSE`. Toute version modifiée redistribuée reste sous cette licence.

Les **actes publiés** au recueil ne relèvent pas de cette licence : ce sont des documents
administratifs, et leurs conditions de réutilisation sont affichées **sur le recueil lui-même**
(mention configurable — par défaut la **Licence Ouverte 2.0**, conformément aux articles
L. 321-1 et L. 322-6 du CRPA).
