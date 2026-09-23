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
>
> Ce jeu fictif est un **commutateur** : le déploiement l'allume (`DEMO=true`, ou le mode « demo »)
> et l'éteint (`DEMO=false`). Éteint, l'outil part d'un **référentiel VIERGE** — aucune donnée
> fictive, aucune mention de la collectivité de démonstration nulle part. La page de démonstration
> publiée ci-dessous, elle, reste **en démonstration**.

## Essayer, sans rien installer

**<https://demo.scribae.eu>** — la démonstration est publiée par **GitHub Pages** (le dépôt fixe
cette adresse par un fichier `CNAME` à sa racine).

L'application s'ouvre sur le **recueil public** — les actes publiés, consultables par tout le monde,
**sans compte**, avec leur identifiant ELI et leur texte — désormais à la **racine du site**.
L'**atelier** (l'interface interne) vit sous `?atelier` — ou `/atelier` sur une installation
auto-hébergée. On y entre par le bouton **Se connecter** (en haut du recueil) : la démonstration
présente **onze comptes fictifs**, par profil, qui s'ouvrent d'un clic — **sans mot de passe**.

**Au tout premier chargement, le recueil se prépare.** Un recueil public ne montre que ce qui est
**réellement publié**, et il n'y a personne pour installer un service de démonstration : la
démonstration le fait donc elle-même — elle dépose ses **dix-sept actes publiés** et ses
**informations** au recueil public. Quelques secondes suffisent, l'écran l'annonce, et la page se
remplit ensuite toute seule (les visites suivantes sont immédiates : c'est déjà fait, et conservé
dans votre navigateur).

| Profil | Ce qu'il montre |
|---|---|
| **Rédacteur** | remplit un acte à partir d'une trame |
| **Éditeur** | valide, signe, publie |
| **Administrateur** | règle le référentiel, écrit les trames, gère les comptes |

**Rien de ce que vous faites là n'est partagé** : tout reste dans votre navigateur, et vous ne
touchez aux données de personne. Pour repartir du jeu d'origine, *Administration › Données ›
Réinstaller la démonstration*.

> **Revenez toujours par la même adresse.** Ce que vous faites dans la démonstration est
> conservé par **votre navigateur**, sous l'**adresse** par laquelle vous l'avez ouverte — c'est
> ce qui fait que votre travail y est encore à la visite suivante. La démonstration répondant
> aussi à l'adresse `*.github.io` du dépôt, un visiteur qui passe d'une adresse à l'autre ne
> retrouve pas ses données : ce sont **deux stockages distincts**. Prenez **<https://demo.scribae.eu>**
> pour adresse habituelle — c'est celle que le dépôt publie.

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
| **Rédiger** | document éditable en place (WYSIWYG, pastilles de champs), écarts « hors trame » conservés et signalés, contrôles, exports. Un **parcours** affiché en tête rappelle la suite — Rédiger → **Soumettre au circuit** → Révision → Signer → Publier — et le **bouton principal**, sous le document, propose le geste du moment (« Soumettre au circuit », ou « Aller à la signature » une fois l'acte validé) : l'export, qui sert à imprimer ou à transmettre hors de l'application, n'est plus présenté comme l'aboutissement |
| **Actes** | registre : numéro, objet, nature, conformité à la trame, statut, historique des brouillons ; pastille **« abrogé »** / **« abrogation prévue »** ; **corbeille réservée aux brouillons**, les actes signés ou publiés passant par **« Retirer / abroger »** |
| **Délégations** | **organigramme des délégations de signature**, visible par tous les comptes : les chaînes de signature en arbre (autorité de tête, délégations, sous-délégations) ou en liste ; un clic ouvre la **fiche** d'un acteur (pouvoir, étendue, décision, dates, signature obtenue et visas). Le modifier est réservé aux administrateurs et éditeurs |
| **Organigramme** | la structure au nom de laquelle les actes sont pris, à trois niveaux — **entité → service → bureau** —, dans la même toile que les délégations : arbre ou liste, fiche de chaque maille. Une entité est **autonome** (elle a sa personnalité morale) ou **rattachée** à une autre : c'est le cas d'une **régie** municipale, sans personnalité morale propre mais avec son directeur, son service et ses actes. Chaque entité peut désigner son **signataire principal**, qui signe ses actes à défaut de signataire dans le modèle. Un **service** peut en outre **dépendre d'un autre service** (ou du bureau d'un autre service) : l'arbre s'en trouve enrichi, et le **périmètre suit la chaîne** — un agent affecté en haut de chaîne voit les actes de toute la chaîne en contrebas. L'organigramme s'édite dès le rôle d'**éditeur** (services et bureaux ; l'ajout ou la suppression d'une **entité** reste à l'administrateur) |
| **Chrono de numérotation** | **tous les numéros attribués**, avec ce qui explique les trous : les **rangs jamais attribués** et les **numéros annulés** (motif compris). Compteurs, filtres (année, entité, type d'acte, état, source, période, texte), tri par colonne, **export CSV et XLSX** ; portée du chrono — un seul, un par entité ou un par type d'acte —, passage à l'année suivante et annulation d'un rang. Un numéro **n'est jamais attribué deux fois** |
| **Parapheur** | circuit de validation du référentiel avant signature : **trois natures d'étape** — **Vérification** (le contrôle du dossier, marche du réviseur), **Visa** (le bon pour accord qui engage) et **Signature** (l'accord du signataire, qui achève le circuit) —, chacune appelant un rôle par défaut modifiable — ou pouvant viser une **personne nommée** ou un **service** hors chaîne de décision ; ciblage trame / famille / entité, décisions motivées, empreinte du texte validé ; les circuits se lisent en **récapitulatif**, avec une **sous-vue par circuit** |
| **Signature & publication** | dépôt par API REST, **réglages de l'API du prestataire** (adresse, identifiant, niveau de signature, adresse de notification, délai et points de terminaison — posés dans l'administration ou dans le `.env` du déploiement, la **clé restant au serveur**), **trois circuits de signature** — électronique (prestataire branché en API), **simple** (le signataire signe **dans Scribae**, avec son compte, après avoir coché la déclaration), **externe** (papier ou outil tiers) —, original signé vérifiable **partagé en deux parts : publique et interne** (les mentions nominatives et la trace des courriels ne sont jamais diffusées), publication au recueil, identifiant ELI, opposabilité ; onglet **« Ma signature »** pour le signataire — qui signe avec son compte, rapproché du compte de l'outil de signature, et ne voit que les actes de son **champ de compétence** |
| **Recueil public** | site ouvert à tous, **sans compte**, **à la racine du site** : une page d'accueil moderne (entrée, **renvois et bandeau d'informations**, carrousel des derniers actes, grille des **thèmes** = familles de trames, liste par année), une **recherche** qui efface carrousel et thèmes, et chaque acte présenté comme sur Légifrance — titre, version, métadonnées, texte dans la page (pas de feuille à télécharger), pièces et signature vérifiable — l'adresse à communiquer aux administrés. Les actes s'affichent **dans leur version la plus récente**, avec les cases **« Afficher les versions antérieures »** et **« Afficher les articles abrogés »**. Le pied de page porte un bouton **« Se connecter »**, les **sous-pages** (mentions légales, conditions de réutilisation, accessibilité) et les renvois vers les recueils extérieurs et les sites de référence. Une collectivité peut y poser sa **propre feuille de style** (couleurs, police, largeur — *Administration › Publication › Apparence du site public*). Les actes **réservés aux agents** (circulaires internes, consignes) ne sont, eux, servis qu'aux **personnes connectées** — et, si l'atelier est restreint à un réseau, aux personnes connectées **venant d'une adresse autorisée** |
| **Informations du recueil** | les **billets** publiés au recueil public — actualités, avis, communications —, comme un blog : titre, résumé, texte **Markdown**, date, auteur, **épinglage** en tête. Ils ne se signent pas et ne reçoivent pas d'identifiant ELI ; ils apparaissent dans leur **rubrique** (une page à part) et, les plus récents, sur la **page d'accueil**. La rubrique se **renomme** (« Actualités », « Communications »…) ou s'**éteint** (*Administration › Publication › Apparence du site public*) |
| **Bulletin (ou Journal) des actes** | le rendez-vous périodique du recueil : la collectivité **ouvre un bulletin** (*Administration › Bulletin*) et lui donne une **cadence** — quotidienne, hebdomadaire, **bimensuelle** (deux numéros par mois), mensuelle, bimestrielle, trimestrielle, semestrielle, annuelle, ou **personnalisée** (toutes les N unités, ancrée) — et un **jour de parution**. Chaque numéro **rassemble les actes publiés sur sa période**, classés **par entité puis par thématique** ; une période sans publication ne donne **aucun numéro**. Le bulletin se diffuse de trois façons : une **sous-page par numéro** au recueil public (avec ses représentations `.json`, `.md`, `.txt`), un **flux RSS 2.0 et Atom 1.0**, et un **courriel aux abonnés** (abonnement à **double consentement**, désabonnement en un clic). Le service clôt les périodes, compose les numéros et vide sa **file d'envoi** à chaque passe ; un numéro en cours se lit en **aperçu provisoire**, sans adresse publique |
| **Documents non juridiques** | la collectivité publie aussi ce qui n'est pas un acte : **verbatim d'assemblée**, **déclaration**, **vœu**. Ces documents se signent et se **publient au recueil** (identifiant ELI, table des thèmes, version en ligne), mais **ne font pas droit** : ni opposabilité, ni entrée en vigueur, ni délai de recours — le recueil les présente comme des documents, l'attestation de non-recours dit qu'aucun délai ne court, et les formalités d'exécution (contrôle de légalité, notification) ne s'y appliquent pas |
| **Exécution & délais** | formalités (contrôle de légalité, publication, notification), date d'exécutoire, délai de recours, **recours introduit** (date d'introduction, nature, auteur) qui ferme le délai, alertes ; **pièces du dossier** en PDF : état des formalités (tout acte), attestation de non-recours (acte définitif non contesté) ; **télétransmission au contrôle de légalité** *(+fonction expérimentale, éteinte par défaut)* : l'étape s'intercale entre le retour signé et la publication, l'accusé de réception de la préfecture (certificat « Transmis au contrôle de légalité le … à … ») est déposé sur le document, puis l'acte est publié |
| **Modifier un acte** | édition en place de l'acte en vigueur : ajout/retrait de **paragraphe**, de **ligne de liste** ou de **ligne de tableau**, **réattribution de numéro** (numéro libre) ou **« tout renuméroter »** ; acte modificatif + version consolidée, mentions « Modifié/Abrogé/Ajouté par » |
| **Abroger un acte, ou l'un de ses articles** | prévu **dès la rédaction** (y compris un acte non modificatif) : on vise au référentiel un acte — ou tel article d'un acte — à abroger ; la clause s'ajoute au document et l'abrogation prend effet **à l'entrée en vigueur** de l'acte qui la porte, non à sa publication |
| **Administration** | tout ce qui est configurable : identité, entités, services et bureaux, personnes (accord en genre de la qualité, décision fondant le pouvoir de signer), rôles, références, numérotation (**séquence interne, ou numéro attribué par un service externe**), circuits (**trois circuits de signature**), **API du prestataire de signature** (adresse, niveau, notification, délai, points de terminaison), **courriel** (six notifications activables, expéditeur, adresse de réponse, copie systématique, état du **serveur SMTP** du déploiement et message d'essai), **publication** (titre du recueil, publication automatique, opposabilité, **apparence du site public** — la feuille de style de la collectivité —, **rubrique Informations**, **bulletin (ou Journal) des actes** — ouverture, cadence, jour de parution, en-tête et pied des courriels —, **accès à l'atelier** restreint à un réseau), **fonctions expérimentales** (la télétransmission au contrôle de légalité), annuaire (OIDC), base de données |
| **Feuilles de style** | charte graphique des actes : marges, **police** (liste de polices proposées), en-tête, pied, filets, **intitulés encadrés** (côtés au choix), **listes à puces et listes numérotées « 1° 2° 3° »**, tableaux, signature, cadre ; édition directe |
| **Comptes et rôles** | cinq rôles — dont le **Réviseur** et le **Signataire**, qualités **cumulables** — plus le visiteur, sans accès ; **dix-neuf permissions** ; périmètre par service et par bureau ; **personne du référentiel**, rapprochement du compte de l'outil de signature. Retirer un acte du recueil (dépublier) est réservé à l'administrateur, avec un avertissement en grand et un motif technique exigé ; **épingler** un acte (le mettre à la « une » du recueil public) est ouvert à l'administrateur et à l'éditeur. L'**accès à l'atelier** peut être restreint à un réseau (intranet) — l'espace public, lui, reste ouvert |
| **API REST** | la **référence complète du service** — toutes les routes, le rôle exigé, les paramètres, les corps, les réponses et les codes d'erreur, avec un exemple de commande par opération — et un **panneau de commande** pour **jouer la requête pour de vrai** depuis l'application (chemin, corps et jeton modifiables ; la réponse s'affiche avec son code et sa durée). Le même contenu est **engendré** dans `docs/API.md`, consultable dans la documentation technique. Les **clés d'API à rôles** — des **comptes de service** remis à un script, un poste ou un outil tiers, invisibles dans « Comptes et rôles » — se créent depuis l'administration, et le service tient un **journal d'audit scellé** (chaîne SHA-256) |
| **Guide** | wiki intégré (29 chapitres, glossaire, dépannage) + documentation technique lue depuis les fichiers du dépôt |

Formats d'export : **Akoma Ntoso 3.0**, **Schematron**, **JSON-LD / ELI**, **HTML** autonome,
**Word** (`.doc`), **Markdown**, JSON, **PDF/A** (archivage) — les formats « papier » sont tous au
**format A4**.

**Le recueil public a sa propre feuille de style.** La **charte graphique** d'un acte habille le
**papier** (aperçu, PDF, Word, page autonome, PDF/A) : deux entités qui suivent deux chartes
différentes présentent donc leurs actes **à l'identique** sur le site public, qui suit, lui, une
feuille de style **web** unique. Cette feuille de style web peut être **personnalisée par la
collectivité** — couleur d'accent, police, largeur du contenu, ou CSS libre — dans
*Administration › Publication › Apparence du site public*, sans que l'atelier change d'apparence.

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

Les actes publiés se consultent par tout le monde, sans compte, dans le **recueil public**, à la
**racine du site** (un acte par `?acte=<clé>`, une sous-page par `?page=…`, un billet par
`?info=<clé>`) : une page d'accueil, une recherche, la liste par année, et le texte de
chaque acte rendu dans la page, plus les **informations** que la collectivité publie (actualités,
avis, communications). C'est l'adresse à communiquer aux administrés ; l'écran
« Signature & publication » en donne le lien. Les moteurs de recherche et les agents (LLMs) y
accèdent aussi : chaque acte publié a une **adresse de référence** et des **représentations**
lisibles par machine (JSON, Markdown, texte brut, Akoma Ntoso, `&format=…`). Un déploiement
**hébergé sur votre serveur** (voir `ADMINISTRATION.md`, et `../server/README.md` pour la pile) les sert en vraies pages — `/recueil`,
`/recueil/<clé>`, `/recueil/<clé>.json` — et publie `/llms.txt`, `/recueil.json`, `/sitemap.xml`
et `/robots.txt` ; un déploiement statique (GitHub Pages) les rend dans la page, pour
les lecteurs qui exécutent le JavaScript. Le **bulletin des actes**, quand la collectivité
l'ouvre, y ajoute `/recueil/bulletins` (les numéros parus et l'abonnement),
`/recueil/bulletins/<période>` (un numéro) et ses flux `/recueil/bulletins.rss` et `.atom`.

Tout le reste est réglable sans toucher au logiciel : entités, services, personnes, rôles, types
d'actes, mentions, circuits de validation, délais, numérotation et charte graphique vivent dans
**Administration** et dans **Feuilles de style**, et s'exportent avec les données.

## Installer Scribae pour votre collectivité

### La façon la plus simple : GitHub Pages

1. Bouton **Fork**, en haut de cette page : une copie du dépôt est créée sur votre compte.
2. Dans votre copie : **Settings** → **Pages**.
3. *Source* : **Deploy from a branch** ; branche **main**, dossier **/ (root)** ; **Save**.
4. Au bout d'une minute, l'application est en ligne à `https://<votre-compte>.github.io/scribae/`.
5. *(Facultatif)* Pour lui donner une adresse à vous : **Settings** → **Pages** → *Custom
   domain*, en ayant ajouté chez votre hébergeur DNS un enregistrement `CNAME` du nom choisi
   vers `<votre-compte>.github.io`, et en cochant **Enforce HTTPS** — l'application signe dans
   le navigateur (`crypto.subtle`), ce qui exige HTTPS.

Il n'y a **rien à compiler** : le dépôt est servi tel quel, et les chemins sont relatifs, donc un
sous-dossier de projet convient.

> **Ne supprimez pas le fichier `.nojekyll`** à la racine. GitHub fait passer le dépôt par Jekyll,
> qui interprète les accolades doubles de la documentation comme des balises de gabarit et **fait
> échouer la publication**. Ce fichier, même vide, désactive Jekyll.

> **Le fichier `CNAME` de ce dépôt porte `demo.scribae.eu`** : c'est l'adresse sous laquelle les
> auteurs du logiciel publient leur démonstration (voir plus haut). Si vous avez **forké**,
> remplacez-le par votre propre nom de domaine — ou **supprimez-le** — avant d'activer Pages :
> sans cela, votre copie réclamerait une adresse qui n'est pas la vôtre.

Sous cette forme, l'application fonctionne **entièrement dans le navigateur de chaque visiteur** :
les documents restent sur leur poste et ne sont **pas partagés** entre collègues. C'est la bonne
solution pour essayer, pour une démonstration, ou pour un usage individuel. Comme le stockage du
navigateur est attaché à l'**adresse** du site, une même copie servie sous deux adresses (celle de
GitHub et votre domaine) donne **deux installations distinctes** aux yeux du navigateur : servez-la
sous une seule adresse, celle que vous communiquez.

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
- Performance mesurée (charge, latences, réglages) : **`src/docs/PERFORMANCE.md`**

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
- L'export des données (référentiel, trames, actes, JSON, Akoma Ntoso, Word, PDF par impression,
  PDF/A) est disponible à tout moment depuis l'interface : **vous n'êtes jamais prisonnier du
  logiciel**.

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
