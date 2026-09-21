# Industrialisation — vérifier, tester, livrer

Ce document s'adresse au service informatique qui **reprend le dépôt** : il décrit
comment vérifier le code sans navigateur, ce qui est vérifié, et ce qui reste à
mettre en place. Il complète `src/README.md` (architecture) et `GITHUB.md` (mise en
ligne) — voir aussi `src/server/README.md` pour l'exploitation.

> **Où vivent ces fichiers.** Le dépôt est servi **tel quel** : la racine contient
> `main.pjs`, `index.html` et le dossier `src/`. Deux fichiers de ce dossier sont
> destinés à la **racine du dépôt** et doivent y être recopiés à la mise en place
> (même convention que `src/docs/GITHUB.md`, recopié en `README.md`) :
>
> | Fichier dans `src/` | Emplacement dans le dépôt |
> |---|---|
> | `src/package.json` | `package.json` (racine) |
> | `src/github/ci.yml` | `.github/workflows/ci.yml` |
>
> Cette copie n'est qu'une convention de rangement : le dépôt reste du HTML et du
> JavaScript servis en l'état, et **rien n'est compilé**.

---

## 1. Ce qui se lance, et comment

Aucune dépendance n'est nécessaire pour le premier travail : la vérification de
syntaxe et les tests des modules purs n'utilisent que **Node** (≥ 20).

```sh
node --version          # ≥ 20
npm run lint            # syntaxe de TOUT le JavaScript du dépôt
npm test                # tests des modules purs + domaine du service
npm run verifier        # les deux, dans l'ordre
```

| Commande | Ce qu'elle fait | Ce qu'elle attrape |
|---|---|---|
| `npm run lint` | `node --check` sur chaque `.js` / `.mjs` du dépôt (`src/scripts/verifier-syntaxe.mjs`) | la parenthèse manquante, la chaîne non terminée, la virgule de trop — le **JavaScript qui ne se parse pas** |
| `npm test` | `node --test` sur `src/tests/` et `src/server/mysql/` | le comportement des **modules purs** : expressions, assainissement, numérotation, version, comptes, signature |
| `npm run verifier` | les deux | ce que l'intégration continue exécute |

Le contrôle de syntaxe est **volontairement sans dépendance** : il n'y a pas de
paquet à installer, donc pas de chaîne d'approvisionnement à auditer, et il tourne
partout où Node tourne. C'est le socle, pas la couverture complète.

---

## 2. Les tests purs

`src/tests/purs.test.mjs` éprouve les modules qui **ne touchent ni au DOM ni au
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

`src/server/mysql/comptes.test.mjs` et `src/server/mysql/actes.test.mjs`
éprouvent le domaine du service (mots de passe scrypt, sessions, anti-CSRF ;
signature et publication) **sans base ni réseau**.

> **Un module qui exigerait un navigateur** (`DOMParser`, `localStorage`) ne fait
> pas tomber la suite : l'import échoue et les tests correspondants sont
> **sautés**. Un test qu'on ne peut pas exécuter ici ne doit pas cacher ceux
> qu'on peut exécuter.

---

## 3. Intégration continue

`src/github/ci.yml` (à recopier en `.github/workflows/ci.yml`) exécute deux
travaux à chaque `push` et chaque demande de fusion :

1. **Syntaxe et tests** — `npm run lint` puis `npm test` ;
2. **Service auto-hébergé** — installation des dépendances de `src/server/mysql`
   et ses tests (aucune base requise).

Le second travail utilise `npm install` **faute de `package-lock.json`
versionné** ; il passera à `npm ci` — qui installe exactement l'arbre verrouillé —
dès que le verrou sera commité (voir §4).

---

## 4. Ce qui reste à mettre en place

Ces points sont identifiés par l'audit (`src/audit/`) et **non** livrés ici, parce
qu'ils ne peuvent pas être produits hors de l'environnement d'installation :

| Point | Pourquoi il n'est pas livré | Comment le faire |
|---|---|---|
| **`package-lock.json`** | le verrou se calcule en installant les paquets (`npm install`), ce que l'atelier ne fait pas | `cd src/server/mysql && npm install` puis commiter `package-lock.json` — le `Dockerfile` et la CI passeront alors à `npm ci` |
| **Images Docker épinglées** | livré : `node:20-alpine`, `mariadb:11`, `nginx:alpine` sont épinglées **par empreinte** dans `Dockerfile` et `docker-compose.yml` | pour reprendre l'étiquette du jour : `docker buildx imagetools inspect node:20-alpine`, et reportez l'empreinte |
| **Analyse statique** (linter) | aucun outil livré ; le contrôle de syntaxe couvre le minimum | ajouter `eslint` une fois le verrou en place, et l'appeler dans la CI |
| **Tests de parcours** (bout en bout) | ils demandent un navigateur piloté (Playwright…), donc une installation | à prévoir après le premier lot de tests purs |
| **Cibles de couverture** | dépendent de l'outillage choisi | viser d'abord les parcours critiques : dépôt → signature → publication → recueil |

---

## 5. Version et livraison

- Le numéro de version vit dans **`src/lib/version.js`** (`APP_VERSION`) : c'est
  la source unique. Le `version` de `package.json` le suit.
- L'historique se tient dans **`src/CHANGELOG.md`** : une section **Non publié**
  décrit le travail en cours ; au moment de figer une version, on l'incrémente et
  on ouvre l'entrée datée.
- Aucun artefact n'est construit : livrer, c'est **déposer le dépôt**.
