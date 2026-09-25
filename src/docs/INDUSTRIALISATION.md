# Industrialisation — vérifier, tester, livrer

Ce document s'adresse au service informatique qui **reprend le dépôt** : il décrit
comment vérifier le code sans navigateur, ce qui est vérifié, et ce qui reste à
mettre en place. Il complète `src/README.md` (architecture) et `GITHUB.md` (mise en
ligne) — voir aussi `src/server/README.md` pour l'exploitation.

> **Où vivent ces fichiers.** Le dépôt est servi **tel quel** : sa racine porte
> `index.html`, `main.pjs`, l'**outillage** (`scripts/`, `tests/`, `package.json`,
> `.github/workflows/ci.yml`) et le **code** sous `src/`. Rien n'est compilé, et
> un fichier ne vit qu'à UN endroit : l'export range chaque source à sa place et
> ne la recopie pas dans `src/` (la table complète est dans `src/README.md`,
> § « Exporter le dépôt GitHub »).
>
> **Dans l'atelier, l'outillage est sous `src/`** (`src/scripts/`, `src/tests/`) :
> c'est le seul arbre que la plateforme conserve d'une séance à l'autre. Il est
> pourtant écrit pour la **disposition livrée** — le code y est `../src/…`,
> l'outillage `../scripts/…` —, et `scripts/racine-code.mjs` constate la racine du
> code au lieu de la supposer. Le harnais de l'atelier (§2) simule cette
> disposition avant de conclure quoi que ce soit.

---

## 1. Ce qui se lance, et comment

Aucune dépendance n'est nécessaire pour le premier travail : la vérification de
syntaxe, le contrôle de style et les tests des modules purs n'utilisent que
**Node** (≥ 20). Les commandes s'exécutent **depuis la racine du dépôt** — c'est
là que vit l'outillage.

```sh
node --version          # ≥ 20
npm run syntaxe         # `node --check` sur TOUT le JavaScript du dépôt
npm run lint            # la syntaxe, puis le style (avertissements tolérés)
npm run style           # le style seul, en mode strict
npm test                # les épreuves (tests/ et le domaine du service)
npm run verifier        # tout, en strict : ce que l'intégration continue exécute
```

| Commande | Ce qu'elle fait | Ce qu'elle attrape |
|---|---|---|
| `npm run syntaxe` | `node --check` sur chaque `.js` / `.mjs` du dépôt (`scripts/verifier-syntaxe.mjs`) | la parenthèse manquante, la chaîne non terminée, la virgule de trop — le **JavaScript qui ne se parse pas** |
| `npm run lint` | la syntaxe, puis `scripts/verifier-style.mjs` en mode ordinaire | les remarques de style, sans faire échouer |
| `npm run style` | le même contrôle, en **strict** | un `var`, un `console.log` de client, un **import jamais employé** : ils font échouer |
| `npm test` | `node --test` sur `tests/`, `src/server/mysql/` et `src/server/charge/` | le comportement des **modules purs** : expressions, assainissement, numérotation, version, comptes, signature… |
| `npm run verifier` | `syntaxe`, `style` (strict) puis `test` | ce que l'**intégration continue** exécute, dans le même ordre |

Le contrôle de syntaxe est **volontairement sans dépendance** : il n'y a pas de
paquet à installer, donc pas de chaîne d'approvisionnement à auditer, et il tourne
partout où Node tourne. C'est le socle, pas la couverture complète.

---

## 2. Les tests purs

Les épreuves transverses vivent dans **`tests/`** (l'outillage est rangé à la racine
du dépôt, à côté de `scripts/`) : `tests/README.md` dit ce que tient chaque fichier,
et pourquoi les imports y sont écrits `../src/…`. Les épreuves du **service** restent
à côté de lui (`src/server/mysql/`, `src/server/charge/`).

`tests/purs.test.mjs` éprouve les modules qui **ne touchent ni au DOM ni au
réseau** — c'est le pari d'architecture de l'application : le métier est
testable sans navigateur.

- `src/lib/expr.js` — le langage d'expression (arithmétique, comparaisons,
  logique, contexte, index, opérateur `in`, refus d'une expression invalide,
  absence d'`eval`) ;
- `src/lib/sanitize.js` — l'assainissement du fragment publié : schémas
  exécutables (`javascript:`, `vbscript:`, `data:text/html`) refusés, contenu
  légitime conservé ;
- `src/lib/numbering.js` — gabarit de numéro, jeton inconnu laissé lisible,
  normalisation de chemin ;
- `src/lib/version.js` — numéro sémantique et libellés.

`tests/publications-locales.test.mjs` éprouve le **repli local du recueil
public** (`src/lib/publications-locales.js`) : seuls les actes réellement publiés
entrent au recueil, les versions d'un même identifiant ELI sont rangées (la plus
récente porte `latest`), un acte réservé aux agents reste caché, et les pièces
d'un acte se lisent aussi bien dans `formats` (fiche complète du service) qu'à
plat (réponse de dépôt — dont le champ `formats` est, lui, la liste des types
MIME).

`src/server/mysql/comptes.test.mjs` et `src/server/mysql/actes.test.mjs`
éprouvent le domaine du service (mots de passe scrypt, sessions, anti-CSRF ;
signature et publication) **sans base ni réseau**.

`src/server/charge/charge.test.mjs` éprouve l'**outil d'étude de charge** lui-même
(profils et pondérations, agrégat et centiles, moteur, base en mémoire) : un outil de
mesure qui se trompe donne des chiffres faux avec l'assurance de chiffres vrais.
L'étude qu'il a servie est dans [`PERFORMANCE.md`](PERFORMANCE.md).

`tests/industrialisation.test.mjs` éprouve **l'outillage lui-même**, et non le
logiciel : il lance le contrôle de style tel qu'il est livré, sur l'arborescence
livrée, et exige le code de sortie 0 — en mode ordinaire comme en mode strict —, en
vérant au passage que le parcours a bien **vu** le code (un parcours qui ne trouve
aucun fichier sortirait, lui aussi, en 0). C'est la seule façon d'attraper une faute
qui n'est pas dans une règle mais dans le **chemin des fichiers** : le contrôle a été
longtemps vert dans la copie de travail et rouge dans le dépôt, sans qu'une règle
change (audit du 2026-09-23, NC-I-008 et NC-I-009). Là où aucun processus enfant ne
peut être lancé, l'épreuve se **saute** au lieu d'échouer.

> **Le domaine du service est en partie asynchrone.** `createActesApi(...).route(...)`
> rend le **résultat** d'un gestionnaire ordinaire, ou la **promesse** d'un
> gestionnaire qui appelle quelque chose au-dehors — l'ouverture d'un circuit de
> signature interroge le prestataire (`src/server/mysql/signature.mjs`). Un appelant
> doit donc l'attendre (`await`), comme le fait le serveur HTTP : une épreuve qui lit
> `.body` sur une promesse voit `undefined` et échoue sans rien dire du code éprouvé.

> **Un module qui exigerait un navigateur** (`DOMParser`, `localStorage`) ne fait
> pas tomber la suite : l'import échoue et les tests correspondants sont
> **sautés**. Un test qu'on ne peut pas exécuter ici ne doit pas cacher ceux
> qu'on peut exécuter.

### Les épreuves de parcours, et le contrat commun aux deux services

Deux manques de l'audit sont comblés ici (NC-I-001, NC-I-010) — mais **hors de
`node --test`** : ils demandent le **navigateur**, donc l'application réellement
chargée, et son service.

- **Le contrat du service**, décrit **une fois** dans
  `tests/conformite-service.mjs` : treize appels (santé, OpenAPI, état de
  l'autorisation, registre public, ressource inconnue, résolution ELI, route
  inconnue, dépublication, trois frontières d'autorisation) avec, pour chacun, ce
  que le contrat exige. Le jeu s'exécute :
  - en Node, contre le **service de démonstration** chargé en mémoire
    (`tests/conformite-service.test.mjs`) ;
  - dans le **navigateur**, contre le service que l'application utilise
    (`tests/parcours.mjs`) ;
  - contre une **installation auto-hébergée** quand on lui donne son adresse
    (`SCRIBA_CONFORMITE_URL`), et les deux jeux sont alors **comparés**
    (`comparer`) : deux installations peuvent différer sur la **classe** d'un
    refus, jamais sur un succès ou un 404.

- **Les parcours** (`tests/parcours.mjs`) traversent l'application : dépôt →
  signature → publication → recueil, repli local (service muet), signature
  qualifiée, session, contrat du service, **saisie qui garde le curseur** et
  **écran de connexion soumis par Entrée**. Chaque parcours rend son verdict, et
  `lancerParcours(ctx)` les exécute tous (ou un seul, par `seulement`).

**Comment les lancer.** Ils s'exécutent dans la console du navigateur, sur la page
de l'application (c'est là que les modules réels et le service vivant sont). Le
chemin à importer dépend de l'endroit d'où l'on parle :

```js
// dépôt livré (démonstration statique, auto-hébergement) :
const p = await import("tests/parcours.mjs");
// atelier — la page est servie depuis le sous-domaine du générateur alors que ses
// modules viennent de l'origine de l'éditeur : il FAUT viser cette origine-là.
const p = await import("https://perchance.org/src/tests/parcours.mjs");

const ctx = await p.contexteDeLApercu();            // les modules de l'application, et son transport
await p.lancerParcours(ctx);                        // tous les parcours
await p.lancerParcours(ctx, { seulement: ["recueil-public"] }); // un seul
```

Le parcours `service-contrat` joue, à lui seul, le jeu d'appels de conformité ; les
autres traversent l'application.

> **L'import doit viser la MÊME instance que la page.** Importer le module depuis
> ailleurs (une autre origine que celle des modules de la page) éprouve une
> **seconde** application, à l'état vide : ses verdicts ne disent alors rien.

Ils **attendent** ce qu'ils observent (une route rendue, un état chargé) au lieu de
supposer qu'un rendu est fini : c'est la seule façon d'être juste sur une
application dont l'affichage suit le réseau. Un parcours qui ne peut pas
s'installer (module absent) est **sauté**, jamais vert par accident.

---

## 3. L'intégration continue

`src/github/ci.yml` (recopié par l'export en `.github/workflows/ci.yml`) exécute
deux travaux à chaque `push` et chaque demande de fusion :

1. **Syntaxe, style et tests** — trois étapes SÉPARÉES (`npm run syntaxe`,
   `npm run style`, `npm test`), pour qu'un échec dise du premier coup laquelle a
   lâché : une chaîne rouge dont personne ne distingue la cause ne rend pas le
   service qu'une chaîne rend (audit, NC-I-008). Le style est en mode **strict** —
   un import jamais employé, un `var`, un `console.log` de client font donc
   échouer la chaîne ;
2. **Service auto-hébergé** — installation des dépendances de `src/server/mysql`
   et ses tests (aucune base requise).

Le second travail installe ses dépendances par **`npm ci`**, sur le verrou
`src/server/mysql/package-lock.json` : chaque paquet est épinglé (version, adresse de
retrait, empreinte SHA-512), et deux constructions successives installent donc
**exactement** le même arbre. `npm ci` refuse de s'exécuter si le verrou et
`package.json` ont divergé : ajouter une dépendance demande un `npm install` local,
et le commit du verrou qui va avec. Les `Dockerfile` du service font le même choix
(`npm ci` dès qu'un verrou est présent, `npm install` sinon).

---

## 4. Ce qui reste à mettre en place

Ces points sont identifiés par l'audit (`src/audit/`) et **non** livrés ici, parce
qu'ils ne peuvent pas être produits hors de l'environnement d'installation :

| Point | Pourquoi il n'est pas livré | Comment le faire |
|---|---|---|
| **`package-lock.json`** | **livré** : le verrou du service (`src/server/mysql/package-lock.json`) est écrit à la main dans l'atelier, à partir du registre npm — chaque empreinte SHA-512 a été **vérifiée contre l'archive réellement retirée** ; il reste à confirmer par un `npm ci` sur un poste outillé (voir §3) | `cd src/server/mysql && npm ci` |
| **Images Docker épinglées** | livré : `node:20-alpine`, `mariadb:11`, `nginx:alpine` sont épinglées **par empreinte** dans `Dockerfile` et `docker-compose.yml` | pour reprendre l'étiquette du jour : `docker buildx imagetools inspect node:20-alpine`, et reportez l'empreinte |
| **Analyse statique** (linter) | **livrée** : `scripts/verifier-style.mjs` (sans dépendance) refuse `debugger`, les `var`, les traces de client, et — depuis la 1.6.1p — les **imports jamais employés** (`scripts/analyse-imports.mjs`, éprouvé). Aucun outil tiers n'est requis ; c'est un choix : un linter ajouterait une chaîne d'approvisionnement à auditer pour des règles que l'on écrit en quelques lignes. Reste à voir : la couverture des règles, à élargir au besoin | `npm run style` (les avertissements font échouer) ; en CI, `npm run verifier` |
| **Tests de parcours** (bout en bout) | **livrés** hors de `node --test` : ils demandent le navigateur (l'application chargée, son service) — voir §2, « les épreuves de parcours ». Un pilotage automatique (Playwright…) reste à prévoir pour les exécuter en intégration continue | `node --test` ne les voit pas ; les lancer dans la console du navigateur (voir §2) |
| **Cibles de couverture** | dépendent de l'outillage choisi | viser d'abord les parcours critiques : dépôt → signature → publication → recueil — c'est ce que `tests/parcours.mjs` exécute |

---

## 5. Version et livraison

- Le numéro de version vit dans **`src/lib/version.js`** (`APP_VERSION`) : c'est
  la source unique, et elle peut porter la **lettre** d'une note intermédiaire
  livrée telle quelle. Le champ `version` de `package.json` n'est qu'un repère
  d'outillage — npm veut là un numéro sémantique — c'est `APP_VERSION` qui fait foi.
- L'historique se tient dans **`src/CHANGELOG.md`** : une section **Non publié**
  décrit le travail en cours ; au moment de figer une version, on l'incrémente et
  on ouvre l'entrée datée.
- **Où chaque fichier vit** : l'export range l'outillage et les fichiers de racine
  à leur place dans le dépôt (`scripts/`, `tests/`, `package.json`,
  `.github/workflows/ci.yml`, `AGENTS.md`, `README.md`) et ne les recopie **pas**
  dans `src/` — un fichier, un seul endroit. La table complète et la recette sont
  dans `src/README.md` (§ « Exporter le dépôt GitHub »).
- Aucun artefact n'est construit : livrer, c'est **déposer le dépôt**.
