# Journal des versions

Historique des versions livrées de **Scribae** (éditeur de trames et d'actes
administratifs). Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
numéros `MAJEUR.MINEUR.CORRECTIF` ([semver](https://semver.org/lang/fr/)).

## Comment ce fichier fonctionne

- **Une version n'existe qu'une fois figée**, c'est-à-dire déposée sur GitHub. On
  incrémente le numéro et on ouvre l'entrée datée **au moment de livrer**, pas avant.
- Le travail en cours n'a pas de numéro : il se décrit sous **Non publié**, et cette
  section est vidée dans la nouvelle entrée au moment de figer.
- Le numéro courant est celui de `APP_VERSION` dans `src/lib/version.js` — c'est la
  source unique du numéro. **La première entrée datée de ce fichier doit lui
  correspondre** ; en cas de divergence, c'est ce fichier qui dit la vérité.
- Rubriques : `Ajouté`, `Modifié`, `Corrigé`, `Retiré`, `Sécurité`. Une entrée ne
  garde que les rubriques qu'elle utilise.
- On décrit le **changement visible** (ce que l'utilisateur constate, ou ce que
  l'exploitant doit savoir), pas la liste des fichiers touchés.

## [Non publié]

*(Rien pour l'instant : la prochaine livraison se décrira ici.)*

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
