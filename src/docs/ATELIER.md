# Travailler dans l'atelier — la méthode, les règles, les garde-fous

**À lire avant la première modification, et à relire à chaque session.** Ce document ne dit pas
ce que fait l'application (c'est `src/SPEC.md` et `src/README.md`) ni comment on la déploie
(c'est `src/docs/ADMINISTRATION.md`) : il dit **comment on travaille ici**, ce qu'on n'a pas le
droit de casser, et **comment on prouve** qu'on n'a rien cassé.

Il s'adresse à n'importe qui reprend le dépôt — un humain, ou un agent dont la mémoire s'arrête
à chaque tour. **Il est écrit pour être suffisant à lui seul** : si vous ne lisez qu'un document
avant d'écrire une ligne, lisez celui-ci.

> **L'atelier, c'est l'édition en ligne sur Perchance** (`main.pjs`, `index.html` et `src/`).
> C'est la **copie de travail** ; le **dépôt GitHub** est la copie **publiée** (voir
> `src/README.md` § « Flux de travail : Perchance ↔ GitHub »). Les deux ne diffèrent que par la
> **disposition des fichiers** : dans l'atelier, tout voisine sous `src/` (c'est le seul arbre que
> la plateforme conserve d'une séance à l'autre) ; dans le dépôt, l'outillage est remonté à la
> racine (`scripts/`, `tests/`). Un fichier ne vit qu'à **un** endroit, et l'export fait le
> rangement.

---

## 0. Le résumé qu'on peut lire seul

**Les dix garde-fous** (§ 1) : ne rien publier sans qu'on vous le demande · ne jamais écrire à la
main un document engendré · une règle, une seule implémentation · aucune dépendance nouvelle ·
tout en français · le métier sans DOM ni réseau · recharger l'aperçu après chaque série
d'écritures · toute variable a sa ligne dans les deux `env.example` · une livraison laisse une
trace (changelog + version) · **ne jamais dire « terminé » sans preuve**.

**La boucle** (§ 2) : lire le fichier canonique → écrire le minimum au bon endroit → **vérifier**
(§ 3 à § 6) → laisser la trace (§ 7) → relire l'écran (§ 6).

**La vérification, en un appel** (§ 3) :

```js
// dans l'outil `execute_js` de l'agent, avec un délai généreux (timeoutMs ≥ 1 500 000)
const src = await fs.readTextFile("src/scripts/harnais-atelier.mjs");
const h = await import(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
return h.texte(await h.verifier({ fs }));    // syntaxe + style + épreuves, chiffres commentés
```

---

## 1. Les garde-fous

Ce sont des règles **du projet**, pas des préférences. Chacune a été payée par un incident : la
colonne « pourquoi » n'est pas décorative.

| Garde-fou | Pourquoi | Où c'est tenu |
|---|---|---|
| **Ne rien publier ni enregistrer sans demande explicite.** | L'atelier porte une version **non enregistrée** : l'enregistrer fige un nom, et un nom ne se défait pas — les données rangées sous l'ancien nom (base locale, galerie, commentaires) deviennent inaccessibles. Une livraison est un geste de l'utilisateur. | `src/README.md` § « Flux de travail » |
| **Ne jamais modifier à la main un fichier engendré.** | Le modifier à la main le fait diverger de sa source, et l'épreuve qui le garde échouera **plus tard**, loin de la cause. | `src/docs/VARIABLES.md`, `src/docs/API.md`, `src/server/mysql/logiciel-engendre.mjs` — régénérés par `scripts/generer-*.mjs` (§ 7) |
| **Une règle, une seule implémentation.** | Deux copies d'une même règle divergent en silence, et l'on corrige celle que personne ne lit. | Table des points de vérité : `src/docs/REPRISE.md` § 2 |
| **Aucune dépendance nouvelle.** | Le dépôt se vérifie avec Node seul : pas de chaîne d'approvisionnement à auditer, pas d'installation à recréer. La seule dépendance est `mysql2`, pour le service. | `src/AGENTS.md` § « Les règles du projet » |
| **Le métier ne touche ni au DOM ni au réseau.** | C'est ce qui rend le domaine éprouvable sans navigateur (et donc éprouvable **ici**). Les effets passent par des ports injectés. | `src/lib/**` pur, `src/ui/**` pour l'écran |
| **Tout est en français**, commentaires compris ; un commentaire dit le **pourquoi**. | Le dépôt est lu par des agents de collectivités ; un commentaire qui paraphrase le code est du bruit. | tout le dépôt |
| **Après une série d'écritures : recharger l'aperçu avant de conclure quoi que ce soit.** | Les fichiers ne sont **pas** appliqués à la page tant qu'on ne l'a pas rechargée : on croit voir la nouvelle version et l'on regarde l'ancienne. | § 3 et § 6 |
| **Toute variable de déploiement décrite a sa ligne dans les deux `env.example`.** | Une variable non documentée est une variable que personne ne réglera — et la panne sera silencieuse. | `src/server/env.example` **et** `src/server/mysql/env.example`, éprouvé par `src/server/mysql/variables.test.mjs` |
| **Une livraison laisse une trace** : une entrée datée dans `src/CHANGELOG.md`, le même numéro dans `APP_VERSION` (`src/lib/version.js`), et **les documents que le changement rend faux**. | Un numéro réutilisé, ou un document périmé, coûte plus cher que le changement lui-même. | `src/CHANGELOG.md` (son en-tête dit la convention) |
| **Ne jamais dire « terminé » sans preuve**, et ne jamais annoncer un chiffre qu'on n'a pas mesuré. | Un rapport sans preuve est une dette : quelqu'un d'autre la paiera. | § 3 à § 6, § 9 |

**Deux interdits de forme**, qui se paient comptant :

- **jamais deux fois le même numéro de version** (le changelog fait foi) ;
- **jamais `localeCompare` hors du service Node** : le moteur du service de démonstration n'a pas
  d'`Intl`, et il ne se plaint qu'à partir du **deuxième** élément comparé — le défaut a donc vécu
  sans se voir (voir « Pièges » dans `src/AGENTS.md`).

---

## 2. La boucle de travail

Six gestes, dans cet ordre. Sauter le geste 4 est la façon la plus sûre de livrer une régression.

1. **Situer.** Lire `src/AGENTS.md` (il est court) puis, pour la règle visée, chercher son
   **fichier canonique** dans `src/docs/REPRISE.md` § 2. Le registre
   `src/audit/REGISTRE-NON-CONFORMITES.md` dit ce qui est **connu comme non conforme** : le
   lire avant de promettre, et le mettre à jour si l'on lève une fiche.
2. **Décider du périmètre.** Un changement, un sujet. Ne pas renommer un fichier, ne pas
   réorganiser « au passage » : ce qui n'est pas dans la demande n'est pas dans le diff.
3. **Écrire au bon endroit**, et de la façon dont le voisinage est écrit (mêmes conventions,
   mêmes aides, même vocabulaire). Si deux implémentations d'une même règle existent (le service
   de démonstration dans `index.html` et le service auto-hébergé), **les deux** doivent suivre, et
   le jeu de conformité `src/tests/conformite-service.mjs` doit les couvrir.
4. **Vérifier** — dans l'ordre, et sans s'en dispenser :
   - le **harnais** (syntaxe, style, épreuves) : § 3 ;
   - si le **service** change : l'éprouver vivant, dans l'aperçu, sur une seule passe : § 4 ;
   - si un **écran** change : le regarder, en mobile **et** en grand : § 6 ;
   - si un **parcours** est touché : rejouer les parcours du navigateur : § 5.
5. **Laisser la trace** : la documentation que le changement rend fausse, l'entrée du changelog,
   la version (§ 7).
6. **Recharger l'aperçu** et confirmer qu'il n'y a **ni erreur de console ni erreur de
   plateforme** avant de rendre la main (§ 3, « ce que le harnais ne dit pas »).

---

## 3. Vérifier sans terminal : le harnais de l'atelier

L'atelier n'a **ni système de fichiers ni processus** : `npm test`, `node --check` et les
générateurs n'y sont pas lançables tels quels. Le harnais
**`src/scripts/harnais-atelier.mjs`** comble l'écart — et il le fait **sans dupliquer une seule
règle** : il charge les scripts du dépôt **eux-mêmes** et leur fournit des doublures de
`node:fs`, `node:path`, `node:url`, `node:crypto` (les écritures retombant dans `src/`). C'est le
même outillage que celui de la CI, avec d'autres fondations.

### 3.1 Comment on s'en sert

Depuis l'outil **`execute_js`** de l'agent (une passe, un délai généreux : le contrôle lit tout
l'arbre et construit trente-sept fichiers d'épreuves) :

```js
const src = await fs.readTextFile("src/scripts/harnais-atelier.mjs");
const h = await import(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));

// tout : syntaxe, style, épreuves — dans l'ordre de `npm run verifier`
return h.texte(await h.verifier({ fs }));

// ou ciblé (beaucoup plus rapide : c'est ce qu'on fait pendant un développement)
return h.texte(await h.verifier({ fs, epreuvesAussi: false }));
return await h.epreuves({ fs, cibles: ["src/server/mysql/actes.test.mjs", "src/tests/reprise.test.mjs"] });
```

### 3.2 Ce que rend chaque service

| Appel | Ce qu'il fait | Ce qu'on attend |
|---|---|---|
| `await h.verifier({ fs })` | syntaxe + style + épreuves | `ok: true` (voir § 3.3) |
| `await h.verifier({ fs, epreuvesAussi: false })` | syntaxe + style seuls | `ok: true` |
| `await h.verifierSyntaxe({ fs })` | parse chaque `.js`/`.mjs` de `src/` | `fautes: []` |
| `await h.verifierStyle({ fs })` | exécute **`scripts/verifier-style.mjs` tel que livré** (`--strict`) | `code: 0` |
| `await h.epreuves({ fs })` | toutes les épreuves (`tests/` + le service) | voir § 3.3 |
| `await h.epreuves({ fs, cibles: [...] })` | seulement celles-là | `totalOk === totalTests` sur les fichiers visés |
| `await h.regenerer({ fs })` | les trois générateurs livrés | `ok: true`, fichiers **identiques** s'il n'y avait rien à changer |
| `h.texte(rapport)` | le verdict, en quelques lignes | à rendre tel quel (petit, lisible) |

Le **style** est en mode **strict** (comme la CI) : un `var`, un `console.log` de client, un
**import jamais employé** font échouer. Le message du contrôle nomme le fichier et la ligne.

### 3.3 Les chiffres attendus dans l'atelier

Le harnais **n'est pas Node** : certaines épreuves ne peuvent pas y être justes, et il vaut mieux
les connaître que les redécouvrir. À la version **1.6.3c**, la suite complète donne
**37 fichiers, 421/440**, et les **19 non-verts sont tous connus** :

| Fichier | Résultat ici | Ce qui manque |
|---|---|---|
| `server/mysql/jws.test.mjs` | 0/5 (**5 sautés**) | un vrai Node (l'épreuve se saute elle-même) |
| `tests/industrialisation.test.mjs` | 0/4 (**4 sautés**) | un **processus** (`spawnSync`) — il n'y en a pas ici |
| `tests/conformite-service.test.mjs` | 2/3 (**1 sauté**) | une installation réelle à comparer (`SCRIBA_CONFORMITE_URL`) |
| `tests/pilote-persistance.test.mjs` | 2/8 (6 échecs) | un service réel, et l'isolation de `node --test` entre fichiers |
| `tests/purs.test.mjs` | 26/28 (1 échec, 1 sauté) | le **réseau** (l'échange OIDC), et des doubles qui se partagent |
| `tests/amorcage-demo.test.mjs` | 1/2 (1 échec) | l'ordre d'amorçage et l'isolation d'un vrai Node |

**Deux chiffres à surveiller** quand on touche au service : `src/server/mysql/actes.test.mjs`
(**32/32**) et `src/server/mysql/controle-legalite.test.mjs` (**9/9**). Ce sont eux qui tiennent la
signature, la publication et la transmission.

Et une épreuve qu'on ne touche pas sans y penser : `src/server/mysql/magasin-mysql.test.mjs`
(**7/7**), qui tient — entre autres — la **voie MySQL des pièces jointes** (`sb_piece`) et la forme
des résultats d'écriture rendus par la base en mémoire.

> **Le reste doit être vert, et le total ne doit pas baisser.** Si un fichier qui était vert
> devient rouge, c'est une régression — la vôtre. Ces six-là ne font pas exception : ils sont un
> **artefact du harnais** (pas de processus, pas de réseau, une isolation de modules qui n'est pas
> celle de `node --test`), et la CI, elle, exécute la suite avec un vrai Node — c'est elle qui fait
> foi.

### 3.4 Ce que le harnais ne dit pas

- **Il ne remplace pas la CI.** La CI exécute `npm run syntaxe` (`node --check`) et `npm test`
  avec un vrai Node ; le harnais en est l'ombre portée dans l'atelier.
- **La syntaxe est vérifiée par le parseur d'esbuild**, pas par `node --check` : même service
  rendu, autre outil (il n'y a pas de processus ici).
- **Il ne voit pas la page.** Une faute de rendu, un écouteur mal détaché, un débordement mobile :
  tout cela se regarde (§ 5, § 6).

---

## 4. Éprouver le service de l'aperçu

Dans l'atelier, le service est **émulé** par le script serveur de `index.html` (un moteur QuickJS
dans un fil séparé). Deux propriétés à retenir :

- il est **éphémère** : son état ne survit pas d'un `page_eval` au suivant ;
- **tout un scénario doit donc tenir dans un seul `page_eval`**.

```js
// une seule passe : provisionner (si besoin), puis appeler
const cles = await import("./src/lib/cles-service.js");
const cs = await import("./src/lib/cle-service.js");
const remote = await import("./src/lib/remote.js");
const K = cles.tirerCle();
cs.definirCleService(K);
await cles.provisionnerService({ cle: K });                       // idempotent
const r = await remote.call("GET", "/v1/health", { token: K });   // comme le fait l'application
return { status: r.status, body: r.body };
```

`remote.call(methode, chemin, { body, token })` est **le même transport que l'application** : ce
que vous éprouvez ici est le chemin réel (voir `src/lib/remote.js`). Le journal de la façade
(`remote.log`) garde la trace des appels.

**Le piège.** Le service de démonstration n'est **pas conservatoire** (NC-II-012) et il se met en
**quarantaine** s'il est surchargé : un scénario qui harcèle le service perd son état, et la panne
ressemble à un défaut du code. Espacez les appels, et refaites le scénario proprement plutôt que
de l'enchaîner sur un état douteux.

---

## 5. Les parcours, au navigateur

Les épreuves de **parcours** (`src/tests/parcours.mjs`) traversent l'application vivante : dépôt
→ signature → publication → recueil. Elles ne s'exécutent **que** dans le navigateur, sur la page
de l'application.

```js
// après un page_refresh (les écritures doivent être appliquées)
const s = await import("./src/ui/state.js");
await s.login("u-dubois");                                   // ⚠ SESSION ADMINISTRATEUR (voir ci-dessous)
const p = await import("./src/tests/parcours.mjs");
const ctx = await p.contexteDeLApercu();
const r = await p.lancerParcours(ctx);                       // 26 parcours attendus
return r.ok + "/" + r.total;
```

- **Il faut une session d'administration** : `login("u-dubois")`. En session d'éditeur
  (`u-roussel`), les quatre parcours d'administration échouent — ce n'est pas une régression,
  c'est le contrôle qui fait son travail.
- Les autres comptes du jeu de démonstration : `u-roussel` (éditeur **et** réviseur, `p-roussel`).
- On peut n'en jouer qu'un : `lancerParcours(ctx, { seulement: ["recueil-public"] })`.
- Les parcours **attendent** ce qu'ils observent (une route rendue, un état chargé) : ne pas
  supposer qu'un rendu est fini parce que l'appel est revenu.

**L'import se fait dans le contexte de la page** : l'outil `page_eval` s'exécute **dans** l'iframe
du générateur, donc les chemins `./src/…` désignent les modules de l'application qui tourne. C'est
essentiel — importer ces modules depuis une **autre origine** éprouverait une **seconde** instance,
à l'état vide, dont les verdicts ne diraient rien. Depuis la console d'un onglet quelconque, il faut
au contraire viser l'origine des modules (voir `src/docs/INDUSTRIALISATION.md` § 2).

Le contrat **commun aux deux services** se vérifie de la même façon, par le parcours
`service-contrat`, ou en Node (voir `src/docs/INDUSTRIALISATION.md` § 2).

---

## 6. Regarder ce qui se voit

Un console propre ne dit **pas** qu'un écran est juste : la mise en page, la lisibilité et le
responsive se regardent.

1. **Appliquer les écritures** : `page_refresh`. Rien de ce qu'on écrit n'est dans la page avant
   cela — et le rechargement est aussi ce qui révèle les **erreurs de plateforme** (celles que le
   moteur Perchance signale et que personne ne voit dans la console).
2. **Cadrer** : `set_viewport_size({ width: 390, height: 844 })` pour un téléphone,
   `{ width: 1920, height: 1080 }` pour un poste. Une application s'adapte : le vérifier dans les
   deux, **avant** de dire terminé — un écran d'atelier doit tenir en 390 px de large comme en
   grand.
3. **Regarder les pixels** : capturer la page — ou un sous-arbre — avec l'aide de capture de
   l'atelier (`await capture()` pour la page, `await capture(el, { scale })` pour un élément), puis
   **lire l'image avec l'outil de vision, en décrivant ce qu'on attend** (« l'en-tête tient sur une
   ligne ; le bouton des notifications est une cloche ; aucun texte sous 13 px »). Une question
   vague reçoit une réponse vague.
4. **Ce qui se mesure se mesure** : `getBoundingClientRect` (positions, débordements,
   chevauchements) est plus sûr qu'une impression — et c'est vérifiable avant/après.

Le projet a ses propres repères de vérification (formats d'export, charte des documents, écrans
sensibles) : ils sont dans `src/README.md` § « Repères de vérification ». Les **pièges de la
capture** (un logo distant fait traîner la capture ; l'en-tête est replié par l'outil sur certains
écrans) sont dans `src/README.md` § « Pièges connus », et il vaut mieux les lire **avant** de
conclure qu'un écran est cassé.

---

## 7. La trace : les documents engendrés, la version, le changelog

**Trois fichiers sont ENGENDRÉS** — on ne les écrit jamais à la main, on corrige **la source** puis
on régénère :

| Engendré | Source de vérité | Générateur |
|---|---|---|
| `src/docs/VARIABLES.md` | le registre `src/server/mysql/variables.mjs` | `scripts/generer-variables.mjs` |
| `src/docs/API.md` | la description `src/lib/api-reference.js` | `scripts/generer-api.mjs` |
| `src/server/mysql/logiciel-engendre.mjs` | `src/lib/version.js` + `src/lib/logiciel.js` | `scripts/generer-logiciel.mjs` |

Dans l'atelier, on les régénère **par le harnais** (les scripts livrés, tels quels) :

```js
return await h.regenerer({ fs });   // → { ok: true, resultats: [...] }
```

Après une régénération, **vérifiez que seul ce qui devait changer a changé** : le harnais écrit
dans `src/`, et une régénération qui produit un fichier différent sans qu'aucune source n'ait
bougé signale une source désynchronisée.

**La livraison, elle, se marque ainsi** (détail : `src/CHANGELOG.md`, en-tête) :

1. une entrée **datée** en tête du changelog, avec un numéro — une **note intermédiaire**
   (`1.6.3c`) suffit entre deux dépôts, et le numéro ne se réutilise jamais ;
2. `APP_VERSION` (`src/lib/version.js`) **dit la même chose** que le titre de la première entrée
   datée ;
3. les documents que le changement rend faux (README, SPEC, TODO, registre d'audit) ;
4. régénérer `logiciel-engendre.mjs` (**il porte la version**) — sinon l'épreuve
   `logiciel-engendre.test.mjs` refuse le miroir périmé.

---

## 8. Le dépôt GitHub (hors atelier)

- **Récupérer** : comparer **d'abord** les versions (lire `src/lib/version.js` et la première
  entrée datée du changelog **du dépôt**), et si le dépôt est plus récent, **reporter son état ici
  à l'identique** avant de toucher à quoi que ce soit. En cas de doute, **demander** : écraser une
  version de l'atelier plus avancée fait perdre du travail.
- **Exporter** : la table complète (ce qui remonte à la racine, ce qui reste sous `src/`) et la
  recette sont dans `src/README.md` § « Exporter le dépôt GitHub ». Un fichier déplacé doit être
  **supprimé** de l'ancien emplacement, sinon on corrige un fichier que personne ne lit.
- **On ne publie pas de son propre chef.** Déposer une version est un geste de l'utilisateur.

---

## 9. Définition de « terminé »

On ne rend la main que lorsque **tout** ce qui suit est vrai. Chaque ligne a une preuve, et la
preuve est un **résultat**, pas une intention.

- [ ] Le changement porte sur **ce qui était demandé**, et rien d'autre (pas de renommage, pas de
      réorganisation « au passage »).
- [ ] La règle touchée n'existe **qu'une fois** ; si le service est concerné, **les deux**
      implémentations suivent (et le jeu de conformité couvre la route).
- [ ] `h.verifier({ fs, epreuvesAussi: false })` → **syntaxe 0 faute**, **style code 0**.
- [ ] `h.epreuves({ fs })` → **aucun fichier autrefois vert n'est rouge** ; les 19 non-verts
      connus (§ 3.3) sont les seuls.
- [ ] Si un écran a changé : il a été **regardé**, en **390 px** et en **grand**.
- [ ] Si le service a changé : il a été **éprouvé vivant** dans l'aperçu (§ 4), et le journal
      `remote.log` ne porte rien d'inattendu.
- [ ] Si les parcours sont touchés : `lancerParcours` rend **26/26** en session d'administration.
- [ ] Les **documents engendrés** sont régénérés si leur source a bougé.
- [ ] Toute **variable** nouvelle a sa ligne dans les **deux** `env.example`.
- [ ] La **trace** est posée : changelog daté + `APP_VERSION` accordé + documents corrigés.
- [ ] L'aperçu a été **rechargé** et ne signale **ni erreur de console ni erreur de plateforme**.
- [ ] Le compte rendu **énonce les chiffres mesurés** et dit ce qui n'a pas été vérifié.

---

## 10. Les pièges de l'atelier (ce qui se paie comptant)

- **Une écriture n'est pas appliquée tant que la page n'est pas rechargée.** Conclure avant est la
  faute la plus coûteuse, parce qu'elle est **invisible** : on regarde l'ancienne version.
- **Un accent grave dans un littéral gabarit le termine.** Les feuilles de style écrites en
  littéraux gabarits (`src/lib/recueil.js`, `src/lib/eli.js`, et les doublures du harnais) ne
  peuvent pas contenir d'accent grave — même dans un commentaire. Un accent grave de trop casse
  le module entier (`Expected ";" but found …`).
- **Un `#!` (shebang) doit être neutralisé avant d'être importé** comme module : c'est ce que fait
  le harnais. Le shebang en tête d'un script est normal, au milieu d'un module il est fatal.
- **Le service de l'aperçu est éphémère et peut se mettre en quarantaine** : un scénario = un
  `page_eval` (§ 4).
- **Les dialogues natifs (`confirm`, `alert`, `prompt`) bloquent l'aperçu** : avant de piloter un
  geste qui en ouvre un, le remplacer par une doublure dans la même page.
- **Un `import()` dynamique isolé** : deux fichiers d'épreuves qui importent le même module par
  une chaîne calculée obtiennent deux instances — d'où quelques-uns des écarts connus du § 3.3.
- **Ne pas construire de correction sur `IntersectionObserver`** ni supposer qu'une animation est
  passée : interroger le DOM (`getBoundingClientRect`, un texte, un attribut) — c'est observable.
- **Le vocabulaire.** « Atelier » = l'édition en ligne (ici) ; « dépôt » = GitHub ; « service »
  = le service de signature et de publication, en deux implémentations ; « recueil » = la
  publication publique. Employer les mots du projet, pas des synonymes.

---

## 11. Toucher aux assistants (le moteur de langage)

Les deux assistants (celui de l'atelier, celui du recueil) passent par **un seul point d'entrée**
— `src/lib/assistant.js` (`repondre({ …, onChunk })`) — qui résout lui-même le moteur : intégré
(le greffon de la plateforme), personnalisé (celui qu'une collectivité branche) ou repli sans
moteur. **On n'appelle jamais `generateText` directement depuis une vue** : cela contournerait le
choix du moteur, les connaissances et le repli. `src/lib/hosts.js` est le seul à le toucher.

Quatre règles quand on écrit ou corrige une invite :

1. **Jamais le contenu des actes dans une invite** : ce qui part chez un moteur tiers, ce sont
   les connaissances et l'historique de la conversation, pas les documents de la collectivité
   (voir l'en-tête de `main.pjs` et `src/docs/GITHUB.md` § « Vos données »).
2. **Ordonner l'invite pour le cache de préfixe** : d'abord ce qui est **identique** d'un appel à
   l'autre (le rôle, les consignes, les connaissances), puis ce qui **s'ajoute** (l'historique),
   et **en dernier** ce qui change à chaque appel (la question, l'écran, l'acte en cours). C'est
   ce qui rend la réponse rapide — la partie commune est calculée une fois.
3. **Diffuser la réponse** (`onChunk`) plutôt que de l'attendre : le texte apparaît au fil de
   l'eau, et l'on peut le lire avant la fin.
4. **Toujours un indicateur animé, visible, près de la fin du texte** : la génération peut durer
   une minute, et peut **s'arrêter quelques secondes** en cours de route. Un texte qui cesse sans
   indicateur a l'air terminé — et il ne l'est pas.
