# Audit visuel des interfaces — Scribae

| Champ | Valeur |
|---|---|
| Campagne | **Visuelle** — le regard du **qualiticien** (chapitre III : complétude, accessibilité, ergonomie, cohérence, compréhension) |
| Date | **2026-09-28** |
| Version auditée | **1.6.3f** (`src/lib/version.js`), état du dépôt à cette date |
| Périmètre | Les **28 écrans** de l'atelier et des pages publiques (voir § 2), en thème **clair** et **sombre**, à **1440 × 900** et à **390 × 844** ; **et** la correspondance entre ce que l'écran promet et ce que le logiciel fait (habilitations, états, compteurs, vocabulaire) |
| Méthode | Application **réelle** (aperçu Perchance, compte administrateur `u-dubois`), mesures instrumentées **dans la page** (sonde JavaScript : débordements, tailles rendues, noms accessibles, contrastes calculés, cibles tactiles), **captures relues une par une** par un modèle de vision, puis **un parcours au compte rédacteur** (`u-bernard`) pour éprouver les habilitations |
| Durée | Une séance de mesure (28 écrans, deux passages) et une relecture des captures ; ~3 h équivalent humain |
| Auditeur | Le **qualiticien** du cadre d'audit (§ 4.3 de `PROMPT-AUDIT-SCRIBAE.md`) |
| Pièces | `src/docs/UI-UX.md` (la doctrine d'interface, référence des promesses), `src/wiki.js` (le guide intégré), `src/tests/parcours.mjs` (29 parcours), le registre |
| Effet | **Neuf fiches ouvertes** : 1 majeure, 5 mineures, 3 observations (NC-III-009 à NC-III-017) |

> **Ce que cet audit ne fait pas.** Il ne corrige rien (règle du cadre, `src/audit/README.md`) :
> il constate, il prouve, il propose. Il ne remplace pas une campagne complète à quatre regards ;
> il n'en instruit qu'un, celui des interfaces.

> **Post-scriptum du 2026-09-28 (livraison 1.6.3g) — les neuf fiches sont levées.** Ce rapport
> décrit l'état **à sa date** et n'est pas réécrit (règle du cadre : « aucune correction »). Les
> neuf fiches qu'il a ouvertes — NC-III-009 à NC-III-017 — ont été **levées dans la même journée**
> par la livraison **1.6.3g**, chacune avec sa mesure, et l'arbitrage **C10** est tranché (les
> boutons de ligne de « Modifier un acte » repassent en secondaires, comme au registre). La preuve
> de chaque levée vit dans sa fiche, au `REGISTRE-NON-CONFORMITES.md` ; le détail des changements
> visibles est au `CHANGELOG.md`.
>
> La **mesure de clôture** a par ailleurs trouvé ce que ce rapport tenait pour conforme : des
> **identifiants d'ancre dupliqués** sur l'écran Documentation (la chronique des versions répète
> ses rubriques « Corrigé », « Modifié »…). Corrigé dans le même lot — les ancres des titres sont
> désormais numérotées (`src/ui/markdown.js`), et le sommaire compte de la même façon : le relevé de
> clôture porte **0 identifiant dupliqué** sur les 27 routes.

---

## 1. Synthèse pour la direction

**L'application tient debout.** Les contrôles de tenue d'écran passent tous : sur les 28 écrans,
**aucun ne déborde horizontalement**, les **244 images** affichées sont **toutes** chargées et
**toutes** pourvues d'une alternative, **aucun identifiant de DOM n'est dupliqué**, et aucun texte de
la chrome ne descend sous **13 px** — la promesse de la revue d'interface (P1) est tenue, écran par
écran. Les habilitations correspondent au menu : un rédacteur
voit **9 entrées sur 4 rubriques** (P8), les quatre écrans qui lui sont fermés le **renvoient** à la
rédaction au lieu de lui montrer un écran vide, et le panneau de l'assistant est **fermé au
chargement** (P7). Le vocabulaire des états est juste dans le registre, le chrono, le suivi
d'exécution et l'écran des modifications.

**Ce qui ne va pas tient en une phrase : l'application dit ce qu'elle fait, mais elle ne le dit pas
toujours deux fois de la même façon — et deux fois, elle le dit trop petit.**

1. **Les étiquettes de formulaire ne nomment pas les champs** (NC-III-009, majeure).
   `src/ui/dom.js:190` pose `<label for="…">` avec un `id` que **presque aucun appelant ne fournit**,
   et le champ lui-même n'a pas d'`id` : **55 champs** sur **5 écrans** (40 aux Feuilles de style,
   9 à l'Administration, 3 à l'API, 2 aux Informations, 1 dans l'éditeur de trame) sont, pour un
   lecteur d'écran, des champs **sans nom** — et cliquer leur étiquette visible ne les active pas.
2. **Un même état porte deux mots et deux couleurs** selon l'écran (NC-III-011).
   `src/ui/components.js:358` dit « **Prêt** » en bleu et « **Exporté** » en **vert** ;
   `src/ui/views/signature.js:68` dit « **Prêt à signer** » et « **Exporté** » en **bleu**. Trois
   autres copies existent (`src/lib/chrono.js:28`, `src/ui/views/modifier.js:333`,
   `src/ui/global-search.js:175`). C'est exactement ce que le dépôt s'interdit par ailleurs
   (« une règle, une seule mise en œuvre »).
3. **Le texte le plus important est celui qu'on coupe.** L'**objet** d'un acte — ce par quoi on le
   reconnaît — est tronqué avec des points de suspension **sans attribut `title`** à 56 endroits
   (parapheur, révision, signature, exécution) ; 13 étiquettes du plan de l'éditeur de trame le sont
   aussi (NC-III-010). Le chrono, lui, donne le texte complet au survol : la bonne pratique existe
   dans le dépôt, elle n'est pas appliquée partout.
4. **Deux pastilles ne disent rien** : « i » et « ! » (20 et 14 occurrences sur l'écran
   Exécution & délais, `src/ui/views/execution.js:136`), là où le logiciel dispose d'un jeu
   d'icônes dessinées (NC-III-012).

**Les dix risques, du plus grave au moins grave** : (1) inaccessibilité des formulaires ;
(2) vocabulaire d'état multiple ; (3) textes tronqués sans recours ; (4) contrastes insuffisants sur
la **page publique** ; (5) structure de titres incohérente ; (6) pastilles illisibles ; (7) cibles
tactiles sous 24 px ; (8) repères d'édition à 10,6 px ; (9) aide à la demande absente là où la
doctrine l'annonce ; (10) densité d'actions identiques sur « Modifier un acte » (72 boutons
principaux).

**Trajectoire recommandée** : un **lot de correction court** — les points 1, 3, 4, 6, 7, 8 sont des
retouches localisées (un helper, une propriété CSS, un attribut, une pastille) ; le point 2 demande
de **choisir une seule source des états** et de supprimer les copies ; le point 5 et le point 10
demandent un arbitrage de doctrine, pas du code.

---

## 2. Ce qui a été mesuré

**Les écrans.** Les 28 écrans suivants ont été ouverts, mesurés et capturés (thème clair, barre
dépliée, 1440 × 900, compte administrateur) :

`recueil` (page publique) · `connexion` · `trames` · `trame/tpl-nomination` (éditeur) ·
`rediger` (choix) · `rediger/tpl-nomination` (rédaction) · `modifier` · `actes` ·
`acte/acte-demo-401` · `reprises` · `corbeille` · `parapheur` · `revision` · `signature` ·
`execution` · `publications` · `informations` · `bulletin` · `organigramme` · `delegations` ·
`chrono` · `referentiel` · `styles` · `aide` · `aide/ouvrir` · `api` · `docs` · `comptes`.

**Ce que la sonde relève, sur chaque écran** : débordement horizontal (zone de contenu et fenêtre),
éléments interactifs plus petits que **24 × 24 px**, éléments interactifs **sans nom accessible**,
tailles de police **réellement rendues** (histogramme, minimum), **contraste calculé** de chaque
nœud de texte contre son fond effectif (seuils WCAG : 4,5:1, ou 3:1 au-delà de 18,66 px — 14 px en
gras), textes **coupés** (`scrollWidth > clientWidth`) avec ou sans attribut `title`, pastilles par
carte et par ligne, étiquettes de champ associées ou non, images sans alternative et cassées,
identifiants dupliqués.

**Résultats de tenue d'écran** — dans tous les cas, la colonne « coupés » sépare les textes coupés
**sans** `title` (perte d'information) de ceux qui **en ont** un (troncature assumée) :

| Écran | `h1` | Débord. | Textes coupés (sans `title`) | Champs sans nom | Police minimale | Contrastes sous le seuil | Boutons principaux |
|---|---:|---:|---|---:|---:|---:|---:|
| Recueil public | 1 | 0 | 0 | 0 / 4 | 13 | **8** | 2 |
| Connexion | 1 | 0 | 0 | 0 / 0 | 13 | 0 | — |
| Trames d'actes | 1 | 0 | 0 | 0 / 3 | 13 | 0 | 29 |
| Éditeur de trame | **0** | 0 | **13 (13)** | 1 / 2 | **11,4** | 1 | 3 |
| Rédiger — choix | 1 | 0 | 0 | 0 / 1 | 13 | 0 | 27 |
| Rédaction | **2** | 0 | 0 | 0 / 1 | **10,6** | 2 | 4 |
| Modifier un acte | 1 | 0 | 0 | 0 / 0 | 13 | 0 | **72** |
| Actes (registre) | 1 | 0 | 0 | 0 / 3 | 13 | 0 | 3 |
| Détail d'un acte | **2** | 0 | 0 | 0 / 0 | 13 | 4 | 5 |
| Reprises d'actes anciens | 1 | 0 | 0 | 0 / 0 | 13 | 0 | 4 |
| Corbeille | 1 | 0 | 0 | 0 / 0 | 13 | 0 | 2 |
| Parapheur | 1 | 0 | **5 (5)** | 0 / 1 | 13 | 4 | 3 |
| Révision | 1 | 0 | **2 (2)** | 0 / 1 | 13 | 4 | 3 |
| Signature & publication | 1 | 0 | **17 (17)** | 0 / 0 | 13 | 3 | 3 |
| Exécution & délais | 1 | 0 | **32 (32)** | 0 / 0 | 13 | 0 | 2 |
| Publications (ELI) | 1 | 0 | 0 | 0 / 1 | 13 | 0 | 4 |
| Informations publiées | 1 | 0 | 0 | **2 / 9** | 13 | 0 | 3 |
| Bulletin | 1 | 0 | 0 | 0 / 0 | 13 | 0 | 3 |
| Organigramme | 1 | 0 | 0 | 0 / 0 | 13 | 0 | 3 |
| Délégations | 1 | 0 | 0 | 0 / 0 | 13 | 0 | 3 |
| Chrono de numérotation | 1 | 0 | 18 (**0**) | 0 / 4 | 13 | 0 | 2 |
| Administration | 1 | 0 | 0 | **9 / 14** | 13 | 0 | 3 |
| Feuilles de style | **2** | 0 | 0 | **40 / 75** | 13 | 0 | 3 |
| Guide d'utilisation | 1 | 0 | 0 | 0 / 1 | 13 | 0 | 3 |
| Guide — un chapitre (`ouvrir`) | 1 | 0 | 0 | 0 / 0 | 13 | 0 | 4 |
| API REST | 1 | 0 | 0 | **3 / 3** | 13 | 0 | 3 |
| Documentation technique | **2** | 0 | 0 | 0 / 0 | 13 | 0 | 2 |
| Comptes et rôles | 1 | 0 | 0 | 0 / 0 | 13 | 0 | 3 |

**Les états vides** ont été visités (reprises : « Aucune reprise pour l'instant » + le geste pour
commencer ; corbeille : « La corbeille est vide. Un acte ou une trame supprimé arrive ici, et peut
être rétabli à tout moment. ») : les deux disent quoi faire ou ce qui se passera. **Conforme.**

**Petit écran (390 × 844)** : la barre de gauche tient sur une ligne, la rangée d'actions d'une
carte (bouton principal + « ⋯ ») reste sur une ligne sans chevauchement — vérifié sur la liste des
trames, à l'œil et par mesure (`overflow-x` = 0).

---

## 3. Les constats

### C1 — Les étiquettes visibles ne nomment pas les champs *(NC-III-009, majeure)*

**Cause unique, à `src/ui/dom.js:190`** :

```js
if (label) wrap.appendChild(h("label", { class: "fr-label", for: id }, label, …));
```

`id` vient de `opts.id`, que presque aucun appelant ne fournit ; le contrôle, lui, n'a pas d'`id`.
L'étiquette est donc **affichée à côté** du champ sans lui être **associée**.

**Mesuré** : 40 champs sans nom aux Feuilles de style, 9 à l'Administration, 3 à l'API REST
(les trois du panneau de commande), 2 aux Informations publiées (Titre, Date), 1 dans l'éditeur de
trame (le `textarea` de l'inspecteur, dont l'étiquette « Texte » est un `span`). Exemple vérifié :
`<div class="fr-field">` → `<label class="fr-label">Nom</label>` → `<input class="fr-input">` sans
`id` ni `for`.

**Impact** : RGAA 4.1 / WCAG 2.1 AA (11.1 « étiquettes de champs »). Un lecteur d'écran annonce un
champ sans nom ; un utilisateur voyant qui clique l'étiquette n'atteint pas le champ. C'est le
**seul défaut d'accessibilité bloquant** de la campagne — et le plus mécanique à corriger.

### C2 — Un même état, deux mots et deux couleurs *(NC-III-011, mineure)*

| | `pret` | `exporte` |
|---|---|---|
| `src/ui/components.js:358` (`ACTE_STATUTS`) | « Prêt », bleu | « Exporté », **vert** |
| `src/ui/views/signature.js:68` (`STATUTS`) | « **Prêt à signer** », bleu | « Exporté », **bleu** |

Trois autres copies du même vocabulaire : `src/lib/chrono.js:28` (`ETATS_CHRONO`, huit états
recopiés à l'identique + trois propres au chrono), `src/ui/views/modifier.js:333` (une table sans
`exporte`), `src/ui/global-search.js:175` (des synonymes en minuscules, pour la recherche — celle-là
est légitime).

**Non observable dans le jeu de démonstration** : aucun acte n'est à l'état « exporté », donc la
divergence de couleur reste latente ; elle se verrait le jour où une collectivité exporte un acte
sans le signer. La divergence de mot, elle, se voit : l'écran du registre dit « Prêt » là où
l'écran de signature dit « Prêt à signer » pour le même acte.

### C3 — L'objet d'un acte est coupé sans moyen de le lire *(NC-III-010, mineure)*

56 éléments `span.sig-item__obj` (parapheur 5, révision 2, signature 17, exécution 32) portent
`text-overflow: ellipsis; white-space: nowrap; overflow: hidden` **sans attribut `title`** ; dans
l'éditeur de trame, 13 `span.outline__label` / `span.puce__label` (« L'autorité de l'acte
(l'assemblée, ou la col… », mesuré 131 px de large pour 303 px de texte).

**Le contre-exemple est dans le dépôt** : `td.chrono-objet` (18 occurrences) porte la même
troncature **et** un `title` avec le texte complet. La règle existe ; elle n'est pas appliquée.

### C4 — Des contrastes sous le seuil, sur la page publique et dans l'éditeur *(NC-III-013, mineure)*

- **Recueil public** : `span.recueil-carte__theme` à **3,21:1** et **4,04:1** (thème de l'acte, 13 px,
  fond teinté) — seuil 4,5:1 — et `span.recueil-pied__sep` à **3,11:1**. C'est la page que voit un
  administré.
- **Éditeur de trame** : `button.blk__annot-flag` à **3,28:1** (le compteur d'annotations d'un bloc).
- **Fils d'Ariane** : les séparateurs « › » (`span.pc-parcours__sep`) à **2,88:1** à **3,11:1** sur
  six écrans. Ils sont décoratifs — mais ils ne sont **pas** masqués aux lecteurs d'écran, et ils
  sont, à ce titre, du texte.

Tous les autres textes de la chrome passent les seuils (mesure nœud par nœud, fond effectif calculé).

### C5 — La structure des titres change d'un écran à l'autre *(NC-III-014, mineure)*

- `rediger/<trame>` (rédaction), `acte/<id>` (détail) et `styles` : **deux `h1`** — celui de l'écran
  et celui du **document affiché dans le papier** (« Arrêté n°2026-401-VSL du… »).
- `trame/<id>` (**l'éditeur de trame**) : **aucun `h1`** ; les titres visibles sont des `h2`/`h3`.
  C'est le seul écran de l'atelier sans titre de niveau 1.

### C6 — Deux pastilles qui ne disent rien *(NC-III-012, mineure)*

`src/ui/views/execution.js:136` :

```js
text: alerte.niveau === "info" ? "i" : "!"
```

Mesuré sur Exécution & délais : **20 pastilles « i »** et **14 pastilles « ! »**, sans attribut
`title`, à côté de pastilles qui, elles, portent un mot (« Formalités en cours », « Accomplie »).
Le logiciel possède un jeu d'icônes dessinées (`src/ui/dom.js`, `info`, `warn`), employé partout
ailleurs. Relecture à l'aveugle d'une capture par un tiers : « le sens de “i” reste ambigu ».

### C7 — Des cibles plus petites que 24 px *(NC-III-015, observation)*

WCAG 2.2 AA (2.5.8 « taille de la cible ») demande 24 × 24 px. Le cadre d'audit cite WCAG 2.1 AA :
ce n'est donc pas une non-conformité **à la lettre**, mais l'exigence monte, et les mesures sont
là :

| Élément | Taille | Présent sur |
|---|---|---|
| `summary.aide-ecran__titre` (« À quoi sert cet écran ? ») | 145 × **21** | 20 écrans |
| `button.app-nav__group--ouvrable` (dépliant « Réglages ») | 191 × **20** | tous les écrans |
| `button.registre__deplie` (ouvrir une ligne du registre) | 22 × 22 | Actes (25×) |
| `button.editor__counts` (« 8 champs · 3 règles · 1 commentaire ») | 228 × **20** | Éditeur de trame |
| `button.insert-bar__btn` (« + » entre deux blocs) | 22 × 16 | Éditeur, rédaction |
| `button.blk__note` (commenter un bloc) | 16 × 16 | Éditeur |
| `button.piece__btn` (ajouter/retirer un élément) | 15 × 15 | Éditeur, rédaction |
| `a.docs-toc__link` (entrée du sommaire) | 200 × 23 | Documentation |

Les cases à cocher (13 × 13) ne sont **pas** comptées : elles sont enfermées dans leur `<label>`,
qui est la cible réelle. Conforme.

### C8 — Le plus petit texte du logiciel est un repère d'édition *(NC-III-016, observation)*

La doctrine (P1) promet qu'« aucun texte de la **chrome** ne descend sous 13 px ». C'est **vrai** :
tout ce qui est sous 13 px est dans le `.paper`, c'est-à-dire dans le document. Mais deux de ces
textes ne sont pas le document : ils **expliquent** le document.

- `span.rw-tok__hint` à **10,56 px** (« Bénéficiaire », « Fonction », « valeur non trouvée ») et
  **11,19 px** (« Numéro de l'acte », « Objet ») — les repères posés sur les champs variables de
  l'écran de **rédaction**, ceux qui disent à l'agent quel champ il remplit.
- `span.chip` à **11,4 px** dans l'aperçu et l'éditeur (noms de variables techniques :
  `beneficiaire.civility`, `entity.authorityFormula`).

Pour un public de non-informaticiens, ce sont les textes les plus précieux du produit, et ce sont
les plus petits.

### C9 — L'aide à la demande n'est pas partout où la doctrine l'annonce *(NC-III-017, observation)*

`src/docs/UI-UX.md` (P4) : « les **vingt-trois** écrans de l'atelier ont été convertis » au bouton
« ? ». Mesuré : **20** écrans portent `.aide-ecran__titre`. Quatre écrans ne l'ont pas —
`modifier`, `trame/<id>` (éditeur), `rediger/<id>` (rédaction), `acte/<id>` (détail) — et trois
d'entre eux affichent leur explication **en clair, en permanence** (par exemple `modifier` :
« Ce que produit une modification »), c'est-à-dire l'inverse de la règle. Les deux écrans hors
atelier (`recueil`, `aide`) sont hors sujet.

### C10 — Soixante-douze boutons principaux sur un seul écran *(observation, sans fiche)*

« Modifier un acte » : `Actes du registre` liste 69 actes, **chacun avec un bouton bleu plein**
(« Modifier » ou « Modifier l'annexe »), soit **72 boutons principaux** sur l'écran. Le registre des
actes (`actes`) emploie pour le même geste un bouton **secondaire** (`fr-btn--secondary fr-btn--sm`).
La doctrine P2 dit « une action principale par écran, une par carte » : elle est respectée carte par
carte et violée écran par écran. **Arbitrage de doctrine, non défaut** — je le consigne ici et le
laisse hors du registre, faute d'exigence tranchée.

---

## 4. Les points conformes

Traité avec le même sérieux que le reste (règle de symétrie du cadre) :

- **Tenue d'écran** : aucun débordement horizontal sur les 28 écrans (`scrollWidth == clientWidth`
  de la zone de contenu), aucune image cassée (`naturalWidth > 0` partout), aucun identifiant du
  DOM dupliqué, aucun champ sans nom **autre** que les 55 de C1.
- **Typographie** : 13 px partout dans la chrome, y compris sur les 20 écrans les plus denses.
- **États** : une seule pastille de statut par ligne de registre et par carte de la liste des
  trames (P3), en français.
- **Habilitations** (correspondance interface ↔ fonctionnement interne, éprouvée au compte
  `u-bernard`, rédacteur + signataire) : **9 entrées sur 4 rubriques**, barre dépliée = 12 entrées ;
  `referentiel`, `trames`, `comptes`, `styles` **redirigent** vers la rédaction au lieu de
  s'ouvrir ; `chrono`, `delegations`, `organigramme` s'ouvrent (permission nulle, comme documenté).
  Le groupe « Réglages » s'ouvre tout seul quand l'écran courant en fait partie.
- **Compteurs** : le registre annonce « N actes — 25 affichés » et la pagination en affiche bien 25 ;
  les 69 actes du jeu de démonstration correspondent à `state.actes.length`.
- **États vides** : reprises et corbeille disent quoi faire, avec le geste à portée.
- **Assistant** (P7) : les deux panneaux (`Plume`, `Publia`) sont **fermés** au chargement (0 × 0,
  `hidden`).
- **Chronique de troncature** : les 18 textes coupés du chrono portent un `title` — la bonne
  pratique, à généraliser (C3).
- **Recueil public** : aucune troncature invisible, aucune image cassée, 13 px minimum, thème clair
  et sombre.

---

## 5. Ce qui n'a **pas** été vérifié

- **La navigation au clavier et le focus visible** : non éprouvés (ni test au lecteur d'écran réel).
  Les noms accessibles, les contrastes, les tailles de cible et la structure des titres l'ont été —
  c'est le cœur de l'accessibilité, mais pas la totalité.
- **L'ordre de tabulation**, les messages d'erreur de formulaire, les `aria-live` : non mesurés.
- **Le rendu sur les navigateurs autres que celui de l'aperçu** (un seul moteur, ici).
- **Les états transitoires** (chargement, erreur réseau, hors-ligne) : seuls les états « chargé » et
  « vide » ont été observés ; `hors-reseau` et `sans-acces` n'ont pas été atteints faute de compte
  « visiteur » dans le jeu de démonstration.
- **Les 23 onglets de l'Administration** : seul l'onglet courant a été mesuré (les 9 champs sans nom
  appartiennent à celui-là ; d'autres onglets peuvent en ajouter).
- **Le thème sombre** : relu à l'œil sur les écrans clés (trames, carte, guide) et sur les captures
  de cette campagne pour la liste des modèles ; les 28 écrans n'ont pas été remesurés en sombre.
- Les **impressions de relecture** qui n'ont pas résisté à la vérification (chevauchements, icônes
  vides de l'organigramme, markdown brut) ne sont **pas** reportées : la sonde les a démenties.

---

## 6. Plan d'action proposé

| Priorité | Fiche | Geste | Effort |
|---|---|---|---|
| 1 | NC-III-009 | `field()` (`src/ui/dom.js`) : engendrer un `id` quand il n'est pas fourni et le **poser sur le contrôle** ; traiter à part les contrôles composites (`fontField`, `styles-sides`, `styles-color-row`) par `aria-labelledby`. | Faible |
| 1 | NC-III-013 | Passer les jetons de couleur concernés au niveau de contraste requis (thème d'une carte du recueil, drapeau d'annotation) ; ajouter `aria-hidden` aux séparateurs « › ». | Faible |
| 2 | NC-III-010 | Poser un `title` (ou un repli au survol) là où le texte est coupé : `sig-item__obj`, `outline__label`, `puce__label`. | Faible |
| 2 | NC-III-012 | Remplacer « i » / « ! » par les icônes du jeu (`info`, `warn`) et donner la raison de l'alerte en `title`. | Faible |
| 3 | NC-III-011 | Décider la **source unique** des états d'acte (`ACTE_STATUTS`), supprimer les copies (`chrono`, `modifier`) et aligner l'écran de signature ; trancher « Prêt » **ou** « Prêt à signer ». | Moyen |
| 3 | NC-III-014 | Un seul `h1` par écran : le titre de l'écran ; le titre du document affiché passe en `h2` (ou reçoit `role="presentation"`) et l'éditeur de trame gagne son `h1`. | Faible |
| 4 | NC-III-015 | Porter les cibles à 24 × 24 px (aide d'écran, dépliant « Réglages », ligne du registre, boutons du papier). | Moyen |
| 4 | NC-III-016 | Fixer un plancher de 13 px pour les repères d'édition (`rw-tok__hint`, `chip` d'aperçu) — le document, lui, garde sa typographie. | Faible |
| 5 | NC-III-017 | Convertir les trois écrans qui affichent encore leur explication en clair (`modifier`, éditeur, rédaction) ou corriger la phrase de la doctrine. | Faible |
| — | C10 | Arbitrer la doctrine des actions principales dans une **liste** (registre vs écran des modifications). | — |

---

## 7. Journal d'audit

| Quand | Quoi |
|---|---|
| 2026-09-28 | Campagne visuelle, sur la version **1.6.3f**. 28 écrans ouverts et mesurés à 1440 × 900 (thème clair), 390 × 844 pour les écrans de liste ; 2 passages (mesure instrumentée, puis relecture des captures) ; un parcours au compte rédacteur pour éprouver les habilitations. Neuf fiches ouvertes : NC-III-009 à NC-III-017. |
| 2026-09-28 | Le registre est mis à jour (synthèse, fiches, `mis_a_jour`) ; **aucune correction n'est apportée** (règle du cadre d'audit). |
| 2026-09-28 | **Livraison 1.6.3g — les neuf fiches de cette campagne sont LEVÉES**, chacune avec sa mesure, et l'arbitrage C10 est tranché (boutons de ligne de « Modifier un acte » repassés en secondaires, 72 → 3 boutons principaux). Relevé de clôture sur 27 routes (1 440 × 900, compte administrateur) : 0 champ sans nom, 0 coupure sans `title`, 1 `h1` par écran, 0 texte sous le seuil de contraste, plancher 13 px, 0 débordement. Ce rapport n'est **pas réécrit** (il décrit l'état à sa date) : la preuve de chaque levée vit dans sa fiche, au registre. |

> **Note de traçabilité.** Les captures et les mesures brutes de cette campagne vivaient dans
> l'espace de travail de la séance (`scratch/audit-*`), qui n'est pas livré ; les chiffres cités
> sont ceux du tableau du § 2, et chaque constat est reproductible : il suffit d'ouvrir l'écran
> nommé et de poser la mesure indiquée en preuve.
