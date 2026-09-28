# Revue d'interface — constats et propositions

> **À qui ce document s'adresse.** Aux personnes qui décident de l'apparence de
> Scribae, et à l'agent qui reprendra ce chantier. Il décrit **ce qui a été
> mesuré**, **ce qui a été livré**, et **ce qui a été proposé** — dans cet ordre, et
> sans mélange : un constat n'est pas une décision.
>
> **État au 2026-09-26 : les huit propositions sont livrées** (P0 à P8), chacune
> avec son épreuve de parcours — la suite en compte **vingt-cinq**. Les constats
> du § 3 sont conservés **tels qu'ils ont été mesurés**, avant les changements ;
> chaque proposition du § 4 dit, après son intitulé, ce qui a été fait.
>
> Les maquettes citées (§ 6) ont été produites pour la revue et remises avec elle
> (images comparatives « aujourd'hui / proposition »).

## 1. Comment cette revue a été faite

1. **Les écrans, un par un.** Les vingt-quatre écrans de l'atelier et des pages
   publiques ont été ouverts dans l'application réelle, capturés à **1440 × 1000**
   (premier écran visible) et relus visuellement — en thème clair et en thème
   sombre (le thème suit le poste, les deux existent).
2. **Ce qui se mesure.** Sur chaque écran : hauteur réelle du contenu, nombre de
   boutons, de champs, de pastilles, de cartes, de tableaux, de liens, de nœuds
   du DOM, répartition des tailles de texte réellement affichées. Ces chiffres
   sont dans les tableaux ci-dessous : ils ne dépendent pas d'une impression.
3. **Les parcours.** Vérification que chaque écran du menu correspond à un geste
   du métier, que rien n'est atteignable seulement par un lien caché, et
   qu'aucun écran ne se termine sans suite possible. Résultat : **le découpage
   est juste** (Produire → Valider → Publier → Organisation → Configurer → Aide —
   depuis la revue, ces deux dernières se rangent sous **Réglages**, P8),
   et le vocabulaire des rubriques suit la vie de l'acte. Les problèmes sont de
   FORME, pas d'architecture.

## 2. Le problème, en chiffres

| Écran | Hauteur du contenu | Boutons | Pastilles | Remarque |
|---|---:|---:|---:|---|
| Trames (26 modèles) | 3 475 px | 156 | 116 | ≈ 6 boutons et 4 pastilles par modèle |
| Rédiger (choix du modèle) | 3 389 px | 62 | 120 | les mêmes compteurs, une deuxième fois |
| Actes (registre) | **11 990 px** | **555** | **331** | 9 colonnes, aucun filtre visible |
| Signature & publication | 6 203 px | 77 | 71 | |
| Exécution & délais | 3 452 px | 43 | 65 | 5 compteurs en tête |
| Chrono de numérotation | **39 719 px** | 414 | **472** | 11 colonnes, 10 235 nœuds |
| Feuilles de style | 8 953 px | 95 | 1 | 92 champs en une seule page |
| Administration | 2 141 px (onglet courant) | 33 | 1 | **23 onglets** |
| Documentation technique | **93 192 px** | 16 | — | 207 titres, 205 liens, 1 seul défilement |
| Documentation technique | 75 917 caractères | | | affichés d'un bloc |

> Ces chiffres sont ceux de la revue, **avant** les changements du § 4 : le
> registre, le chrono et la documentation technique ont été paginés depuis, et
> l'échelle typographique a été ramenée à cinq jetons.

**La typographie.** Le CSS compte **439 déclarations de taille de police**, pour
**58 valeurs distinctes** ; **215 d'entre elles (49 %) sont en dessous de 13 px**,
jusqu'à 9,6 px. Le corps de texte des composants est à 14 px, les explications
sous les champs à 12,5 px, les pastilles à 11,5 px. Or le public visé — un agent
de 55 ans, non informaticien — lit confortablement à partir de **16 px**, et
jamais en dessous de 13 px (c'est la règle du système de design de l'État, dont
Scribae suit déjà les couleurs et les composants). → *Livré (P1) : l'échelle est
ramenée à **cinq jetons** (`--t-xs` … `--t-xl`), et **plus aucun texte de la
chrome ne descend sous 13 px** ; les titres les plus hauts restent à 1,25–1,75 rem.*

## 3. Les huit constats

**C1 — Le sommaire ne s'efface jamais.** La barre de gauche fait 232 px et porte
12 à 22 entrées : sur un écran de rédaction, c'est 16 % de la largeur donnée à un
sommaire permanent. Elle défilait d'ailleurs avec la page : sur les écrans longs
(11 990 px pour le registre, 39 719 px pour le chrono), **elle avait disparu quand
on est arrivé au contenu**. → *Livré : repliable (P0), puis la coquille fixe
(voir P0, « livré aussi »).*

**C2 — Le texte est trop petit, et l'échelle est éclatée.** Voir § 2. La
conséquence pour ce public n'est pas « c'est moins joli » : c'est qu'on ne lit
pas les explications — et les explications portent ici des choses importantes
(ce qui est bloquant, ce qui engage la collectivité). → *Livré (P1).*

**C3 — Tout est montré en même temps.** Chaque écran présente **toutes** les
actions qu'il sait faire, au même niveau. Un modèle de trame propose six boutons
(Éditer, Rédiger, Mettre à disposition, Dupliquer, Exporter, Supprimer) : rien ne
dit lequel est le geste courant (Rédiger). Au parapheur, les boutons de décision
(« Donner mon visa », « Refuser ») sont **en bas** de la colonne de droite, sous
la ligne de flottaison : l'action est là, mais il faut la chercher. → *Livré
(P2, P3) : une seule pastille et un seul geste par carte, le reste derrière
« ⋯ ».*

**C4 — Les pastilles et les compteurs se comptent par centaines.** 331 pastilles
dans le registre, 472 dans le chrono, 116 dans la liste des trames. Chaque objet
porte son statut, sa nature, son écart, son nombre de champs, son nombre de
règles, sa date. Quand tout est signalé, plus rien ne ressort. → *Livré (P3) :
une pastille de statut en tête, les autres informations en ligne de mentions.*

**C5 — L'explication est écrite PARTOUT.** Chaque écran ouvre sur un paragraphe
de présentation de deux à cinq lignes, puis un encadré « À quoi sert cet écran »,
puis les alertes. Ces textes sont justes et bien écrits — mais ils occupent le
premier écran, et personne ne les lit deux fois. L'aide doit venir **au moment du
doute**, pas à l'ouverture. → *Livré (P4), étendu en 1.6.3g : les vingt-quatre
écrans de l'atelier rangent leur explication derrière un bouton « ? ».*

**C6 — Les écrans n'en finissent pas.** 11 990 px pour un registre de 400 actes,
39 719 px pour le chrono, 93 192 px pour la documentation : un seul défilement,
aucune barre de filtres qui reste en place, aucune pagination, aucun moyen de
« reprendre là où j'étais ». C'est la première cause d'abandon sur ce genre
d'outil. → *Livré (P5) : barres de liste collantes, pagination de 25 lignes,
colonnes essentielles au registre et au chrono.*

**C7 — L'assistant flotte par-dessus le contenu.** Le panneau « Plume propose »
est en position fixe, en bas à droite, sur **tous** les écrans : il recouvre la
colonne de droite (les champs d'identification en rédaction, le tableau du chrono,
l'aperçu des feuilles de style). Un objet qui masque le travail est vécu comme une
gêne, même quand son contenu est utile.

**C8 — La couleur ne hiérarchise plus.** Bleu institutionnel, violet, vert,
orange, jaune : ils servent tour à tour au statut, à la nature, à l'alerte, à la
démonstration et à l'aide. À l'écran, cinq familles de couleurs cohabitent, et le
bandeau de démonstration — légitime — ajoute sa teinte à toutes les pages. En
production, ce bandeau disparaît : le constat porte donc sur le reste.

**C9 — Sur un téléphone, le menu occupait l'écran.** Sous 760 px, la barre passe
à l'horizontale, mais ses entrées restaient en pleine largeur : les **vingt-deux
entrées s'empilaient** (une par ligne, mesuré : **1 025 px de menu** avant le
premier mot de la page). → *Livré : une seule ligne, que l'on fait défiler du
doigt (55 px de haut).*

## 4. Propositions

Chaque proposition dit **ce qui change**, **pourquoi**, et **ce que cela coûte**.
Toutes ont été **livrées** (l'intitulé le rappelle, et un paragraphe dit ce qui a
été fait).

### P0 — La barre de gauche se replie *(livré)*
Le bouton de repli est posé **au pied de la barre**, derrière un filet : c'est le
commandement de la barre elle-même, et là il ne se dispute pas la place de la
première rubrique (le bouton était d'abord en tête, ce que l'usage a démenti).
Repliée, la barre devient une colonne d'icônes de **58 px** (les libellés restent
lus par les lecteurs d'écran, et le titre du bouton les donne à la souris,
rubrique par rubrique). La préférence est **propre au poste** (`lib/prefs.js`) :
elle ne part pas dans le référentiel, chacun garde la sienne. Sans préférence
posée, un écran étroit (moins de 1 100 px — portable, fenêtre réduite) part
replié. Gain : **174 px** de largeur pour le document.

**Livré aussi — la coquille fixe** (le « reste à faire » de C1) : l'en-tête, le
sommaire et le pied sont bornés à la fenêtre, et **seule la zone de contenu
défile** (`.app-main`, voir app-base.css). La barre n'emporte donc plus le menu
hors de l'écran au premier défilement, et le pied de la barre reste visible : le
bouton de repli est toujours sous la main. C'est le corps de la barre
(`.app-nav__corps`) qui défile quand ses entrées dépassent la hauteur — quatre-
vingts entrées ne poussent plus la page. Le défilement de la fenêtre reste celui
des écrans qui ne portent pas la coquille (connexion, recueil public).

**Livré aussi — la barre sur petit écran** (constat C9) : sous 760 px, elle tient
désormais sur une seule ligne que l'on fait défiler du doigt (55 px de haut), au
lieu d'empiler ses entrées sur plus de 1 000 px avant le contenu.

### P1 — Une échelle typographique tenue *(livré)*
| Usage | Aujourd'hui | Proposé |
|---|---|---|
| Texte courant, champs | 14 px | **16 px** |
| Libellés de champ | 13,6 px | **15 px** |
| Explications sous un champ | 12,5 px | **14 px** |
| Pastilles, mentions | 11,5 px | **13 px** |
| Plancher absolu | 9,6 px | **13 px** |

Cinq tailles nommées (`--t-xs` … `--t-xl`) remplacent les 58 valeurs actuelles ;
le titre d'écran reste à 24 px (l'écart avec le corps passe de 12 px à 8 px, ce
qui calme la page). *Coût : faible (mécanique), risque : faible — c'est du CSS
partagé, à faire classe par classe et à vérifier écran par écran.*

**Livré.** L'échelle est ramenée à **cinq jetons** (`--t-xs` … `--t-xl`) déclarés
dans `:root`, et les **quatre cents** déclarations de `font-size` réparties sur
les dix feuilles `app-*.css` les emploient. Plus aucun texte de la chrome ne
descend sous **13 px**. Quelques titres d'écran restent en 1,25–1,75 rem
(*au-dessus* de l'échelle) : c'est assumé, un titre n'a pas à suivre le corps de
texte.

### P2 — Une action principale par écran, une par carte *(livré)*
Sur chaque carte : **un** bouton (le geste courant), les autres dans un menu
« ⋯ » (Éditer, Dupliquer, Exporter, Supprimer…). Sur chaque écran : le bouton
principal en haut à droite, à côté du titre — le reste en secondaire. Au
parapheur et en révision, la décision remonte **en haut** de la colonne de détail,
et le contenu explicatif passe dessous.
*Coût : moyen. C'est la proposition qui change le plus la sensation de simplicité.*

**Livré.** `mentions()` et `menuButton()` (icône `dots`) donnent la **carte type** :
le geste courant en bouton, le reste derrière « ⋯ ». Les cartes de trame et de
choix, celles du parapheur (les cinq états : à moi, pas mon ressort, circuit
achevé, refusé-renvoyé, validation caduque) et celles de la révision et de la
certification sont passées à ce modèle, la décision remontant **en tête**. Sur
l'espace de rédaction, un seul geste primaire (« Enregistrer »). Deux écarts
assumés : le reste du logiciel n'a pas été repris carte par carte, et « à droite
du titre » n'est vérifié qu'au-delà de 900 px.

**Corrigé en 1.6.3f — le « ⋯ » se voit.** Ranger un geste derrière un menu n'a de
sens que si **le menu se trouve**. Le bouton n'était qu'un dessin nu — trois
points tracés au poids du socle sur un dessin de 16 px, soit des points d'un
pixel — au bout d'une ligne, à droite d'un bouton principal plein : de la
ponctuation. Il est désormais **dessiné en bouton** (cadre, fond, **36 px** de
côté — la hauteur du bouton principal en face —, dessin de 20 px et points
épaissis), **neutre** au repos (l'encre, pas la couleur de marque : il n'y a
qu'un geste principal par carte) et **allumé** au survol comme tant que son menu
est ouvert. La règle vaut pour `menuButton`, donc pour les sept écrans d'un coup.

### P3 — Une pastille par objet, et trois seulement *(livré)*
Une pastille de **statut** (Rédaction, Parapheur, Signé, Publié, Archivé), en
français, une seule. La nature, la famille, le service, les compteurs de champs
et de règles passent dans la fiche, ou dans une ligne de mentions en gris.
*Coût : faible sur les listes, moyen si l'on veut garder l'information accessible
sans ouvrir la fiche (survol, infobulle).*

**Livré.** `mentions()` porte la ligne de mentions en gris — les informations
séparées par des points, chacune pouvant garder son `title` pour le survol ; un
`alerte: true` réserve la couleur d'avertissement à ce qui en vaut vraiment une.
La carte ne garde qu'**une** pastille de statut, en français. C'est ce
qu'éprouve « une pastille par carte ».

### P4 — L'aide à la demande *(livré)*
Le paragraphe de présentation de chaque écran se replie en un lien « À quoi sert
cet écran ? » à droite du titre (une ligne, pas un paragraphe). Les encadrés
pédagogiques longs deviennent des notes dépliables. Le guide reste à un clic
(« Comment faire ? »), au plus près du geste.
*Coût : faible. Le texte n'est pas supprimé — il est déplacé là où on le cherche.*

**Livré.** `aideEcran()` et `pageTitle()` (`src/ui/components.js`) rangent
l'explication derrière un bouton « ? » à droite du titre — une ligne, pas un
paragraphe — et `notePlier()` rend dépliables les encadrés pédagogiques longs.
Les **vingt-quatre** écrans de l'atelier portent l'aide à la demande : les
**quatre** derniers — `modifier`, l'éditeur de trame, la rédaction, le détail
d'un acte — l'ont reçue en 1.6.3g, et le relevé de la campagne visuelle le
vérifie (NC-III-017). L'encadré
« Comment écrire dans le document » de la rédaction est devenu une note pliable. Les
sous-titres de **données** (le nom de la trame, l'identité du document ouverts)
restent affichés, eux : ils disent ce qu'on regarde, non comment s'en servir.

### P5 — Les listes longues redeviennent des listes *(livré)*
Une barre d'outils qui **reste en haut** pendant le défilement : recherche,
filtres (statut, service, année), et le compte (« 128 actes — 25 affichés »).
Pagination ou « Afficher les 25 suivants ». Colonnes limitées à cinq, le reste
derrière un dépliage de ligne. La documentation technique gagne un **sommaire
latéral** plutôt qu'un défilement de 93 000 px.
*Coût : moyen à élevé selon les écrans ; à faire écran par écran, en commençant
par le registre (Actes) et le chrono, les deux plus longs.*

**Livré.** Le **registre des actes** (`src/ui/views/actes.js`) : une barre de
commandes qui reste en haut, un compte (« 69 actes — 25 affichés »), quatre
colonnes essentielles et une **pagination** de 25 lignes, à la place d'un tableau
de soixante-neuf lignes et neuf colonnes. Le **chrono de numérotation**
(`src/ui/views/chrono.js`) : six colonnes essentielles, les quatorze autres à la
demande, filtres et pagination. La **documentation technique**
(`src/ui/views/docs.js`) : le sommaire du document ouvert quitte le fil de lecture
pour la colonne de gauche, où il reste sous les yeux (sous 1100 px, il se replie
en un bloc borné en tête de lecture).

### P6 — L'espace de rédaction (voir maquettes, § 6) *(livré)*
Aujourd'hui : trois colonnes permanentes (menu, document, inspecteur), un bandeau
d'étapes, une bibliothèque de variables, quatre onglets (« À compléter »,
« Consignes », « Abrogations », « Contrôle & écarts »), des pastilles bleues dans
le texte, l'assistant par-dessus.
Proposition :
- **La barre repliée** (P0) rend 174 px au document.
- **L'état de l'acte en une ligne** : « Enregistré à 14 h 32 · brouillon · il
  reste 2 champs » au lieu d'un chapelet de pastilles.
- **Un seul geste mis en avant** : « Enregistrer » ; « Aperçu » et le menu « ⋯ »
  à côté.
- **Le panneau de droite devient un tiroir fermé** portant son compte
  (« Compléter l'acte · 2 ») : il ne s'ouvre que si on l'ouvre, et l'on y
  complète **une chose à la fois** (liste d'avancement 4/6, un champ, deux
  boutons « Plus tard » / « Valider et suivant »). La bibliothèque de variables y
  garde sa place, dans un second onglet.
- **Le contrôle en une ligne en bas** : « ✓ Rien à signaler · 1 passage réécrit »
  au lieu d'un onglet compteur.
- **Une seule couleur d'action** (le bleu institutionnel) et une seule couleur
  d'alerte (l'orangé), sur tout l'écran.
*Coût : élevé (c'est l'écran le plus riche du logiciel). À faire en deux temps :
le « repos » d'abord, le tiroir ensuite.*

**Livré** (les deux temps). L'en-tête ne porte plus qu'un geste primaire
(« Enregistrer »), le reste derrière « ⋯ » ; l'état de l'acte tient en **une
ligne** (`mentions`) au lieu d'un chapelet de pastilles ; le panneau de droite est
devenu un **tiroir fermé** portant son compte (« Compléter l'acte · N »), où l'on
remplit **un champ à la fois** (« Plus tard » / « Valider et suivant »), avec le
repli « Tous les champs (N) » et, dans un second onglet, les variables ; une
**ligne de contrôle** au bas de l'écran suit le défilement ; le fil du parcours
donne la suite en un bouton secondaire.

**Retour d'usage sur ce tiroir** — « appuyer sur Compléter l'acte sans avoir
d'abord choisi une pastille ne fait rien », et « on ne comprend pas que cela fasse
apparaître une barre à droite ». Le geste était bien branché, mais rien ne le
disait : le bouton ne changeait pas d'état et la barre ne se nommait pas.
Désormais le bouton **annonce ce qu'il fait** (icône de panneau, `aria-expanded`,
couleur d'action quand la barre est ouverte), la barre **se nomme** (« Panneau de
rédaction ») et porte **sa propre fermeture**, elle **entre en glissant** depuis la
droite, et l'ouverture **mène quelque part même sans rien avoir désigné** : elle
s'affiche, amène la barre à l'écran quand la mise en page l'empile (≤ 1 100 px),
met en évidence la pastille du champ courant dans le document et y place le
curseur. L'entrée ne joue que sur la position — un onglet en arrière-plan ne fait
pas courir l'horloge des animations, et une entrée en fondu y aurait laissé la
barre invisible, c'est-à-dire le bouton inerte. Enfin, l'état du tiroir se décide
sur ce qui est **réellement affiché** : un désaccord entre le brouillon et l'écran
ne peut plus transformer le premier clic en un geste sans effet.

### P7 — L'assistant se fait oublier *(livré)*
Par défaut, le panneau est **fermé** ; il s'ouvre par le bouton de l'assistant
(ou au clic sur sa pastille), s'affiche **dans** la colonne de droite — jamais
par-dessus le document — et ne se rouvre pas tout seul.
*Coût : faible.*

**Livré.** La **bulle d'invitation** a disparu (élément et minuterie retirés) :
le panneau ne s'ouvre que si on l'ouvre, et il ne se rouvre pas tout seul. Au-delà
de **1200 px**, la page lui **réserve une colonne** à droite
(`body.assist-ouvert { padding-right: 424px }`) plutôt que de le laisser flotter
par-dessus le document ; en deçà de cette largeur, faute de place pour deux
colonnes, il redevient un calque (c'est la seule circonstance où il recouvre).

### P8 — Un menu par métier, pas par objet *(livré)*
Le menu garde ses rubriques (Produire, Valider, Publier) et range
« Organisation » et « Configurer » derrière une seule entrée **« Réglages »**
(dépliée à la demande), réservée aux rôles concernés. Un rédacteur voit alors
**9 entrées sur 4 rubriques** au lieu de 12 sur 6.
*Coût : faible ; à valider, car cela change les habitudes des administrateurs.*

**Livré.** « Organisation » et « Configurer » ne forment plus qu'une rubrique,
**« Réglages »** (cinq entrées), rendue en **bouton dépliable** (`aria-expanded`,
chevron) : elle s'ouvre d'elle-même quand l'écran courant en fait partie — un
écran actif ne se cache jamais — et son état est une **préférence de poste**.
Le menu du rédacteur passe de six rubriques à quatre. Sur téléphone (≤ 760 px),
le groupe garde une puce compacte, sans quoi Organisation et Administration
seraient inatteignables.

## 5. Ce qui n'est pas proposé, et pourquoi

- **Pas de refonte de l'architecture d'information** : le découpage par étapes de
  la vie de l'acte est juste, et il est enseigné par le guide. On allège la
  forme, on ne déplace pas les meubles.
- **Pas de suppression de fonctionnalité** : tout ce qui est dense est utile à
  quelqu'un (le chrono complet est le registre des numéros ; les feuilles de
  style sont un écran d'expert). On les range, on ne les retire pas.
- **Pas de changement de la charte** : les couleurs et les composants suivent le
  système de design de l'État ; on se contente d'en **réduire le nombre de
  couleurs simultanées** à l'écran.

## 6. Les maquettes remises avec la revue

| Image | Ce qu'elle montre |
|---|---|
| `comparaison-nav` | la barre de gauche dépliée (232 px) et repliée (58 px) — **déjà livré** |
| `comparaison-redaction` | l'espace de rédaction aujourd'hui / proposition (P6) |
| `maquette-tiroir` | le tiroir « Compléter l'acte » : un champ à la fois, avancement 4/6 (P6) |
| `comparaison-trames` | la liste des modèles aujourd'hui / proposition (P2, P3, P5) |

Les maquettes sont des **rendus HTML** produits avec les feuilles de style de
l'application (mêmes jetons de couleur, même police, mêmes composants) : ce qui
est montré est réalisable dans le code actuel sans changer de socle.

## 7. Ordre de mise en œuvre suivi

1. **Lot 1 — la lecture** (P0 ✅, P1 ✅, P3 ✅) : ce qui se voit immédiatement pour
   tout le monde, pour un coût faible et un risque faible.
2. **Lot 2 — la rédaction** (P6 ✅, puis P2 ✅ sur les cartes) : le poste de
   travail quotidien des rédacteurs.
3. **Lot 3 — les listes** (P5 ✅, P2 ✅ sur les écrans de validation) : le
   registre, le chrono, la documentation.
4. **Lot 4 — le confort** (P4 ✅, P7 ✅, P8 ✅).

Toutes les propositions ont été livrées. Chacune a reçu son **épreuve de parcours**
(`src/tests/parcours.mjs`) : la suite en compte aujourd'hui **vingt-cinq**, dont
dix nées de cette revue. Elles lisent les vraies classes des écrans et
**remettent l'état** qu'elles ont touché (registre, chrono, tiroir, préférences
du menu) pour ne pas perturber la suite.
