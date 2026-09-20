# Scribae

**Éditeur de trames et d'actes administratifs.** Les administrateurs préparent des
**trames** (structure, champs, règles, commentaires), les services les remplissent, le
logiciel **compile** l'acte, le fait passer au **parapheur**, le **signe**, le **publie** et
l'exporte dans des formats ouverts et normés : **Akoma Ntoso 3.0**, **Schematron**,
**JSON-LD/ELI**, HTML imprimable (format A4), Word, Markdown.

![Interface de Scribae](https://user.uploads.dev/file/39e80c075f4725348ce5c5d6df3e4dfb.png)

> **Démonstration.** Le jeu de données livré est **entièrement fictif** : il configure
> l'outil pour la **mairie de Valmont-sur-Loire** (entités, services et bureaux, personnes,
> rôles, références juridiques, numérotation, recueil). Rien de réel. La signature
> électronique est **réellement vérifiable** (ECDSA P-256 / SHA-256), mais son certificat est
> un certificat de démonstration, non qualifié au sens du règlement eIDAS, et le prestataire
> de signature est **simulé**.

## Essayer

- **En ligne, sans rien installer** : <https://perchance.org/scribae> — ou n'importe quel
  déploiement statique de ce dépôt (GitHub Pages).
- **En local** : servir ce dossier avec n'importe quel serveur de fichiers statiques
  (`python3 -m http.server`, `npx serve`…) puis ouvrir `index.html`. Ouvrir le fichier
  directement (`file://`) ne fonctionne pas : les modules ES et `fetch` exigent une origine.

Aucune étape de build : le dossier est servi tel quel.

## Ce que fait le logiciel

| Écran | Rôle |
|---|---|
| **Trames** | modèles d'actes : structure, champs, règles exécutables, commentaires, import/export JSON |
| **Éditeur de trame** | plan, page éditable en place, inspecteur (blocs, champs, règles, trame) |
| **Rédiger** | document éditable en place (WYSIWYG, pastilles de champs), écarts « hors trame » conservés et signalés, contrôles, exports |
| **Actes** | registre : numéro, objet, nature, conformité à la trame, statut, historique des brouillons |
| **Parapheur** | circuit de validation du référentiel (étapes, rôles, ciblage), décisions motivées, empreinte du texte validé |
| **Signature & publication** | dépôt par API REST, circuit de signature, original signé vérifiable, publication au recueil, identifiant ELI, opposabilité |
| **Exécution & délais** | formalités (contrôle de légalité, publication, notification), date d'exécutoire, délai de recours, alertes |
| **Modifier un acte** | édition en place de l'acte en vigueur, acte modificatif + version consolidée, mentions « Modifié/Abrogé/Ajouté par » |
| **Référentiel** | tout ce qui est configurable : identité, entités, services et bureaux, personnes, rôles, références, numérotation, circuits, annuaire (OIDC), base de données |
| **Feuilles de style** | charte graphique des actes : marges, typographie, en-tête, pied, tableaux, signature, cadre ; édition directe |
| **Comptes et rôles** | trois rôles, onze permissions, périmètre par service et par bureau |
| **Guide** | wiki intégré (19 chapitres, glossaire, dépannage) + documentation technique lue depuis les fichiers du dépôt |

Formats d'export : **Akoma Ntoso 3.0**, **Schematron**, **JSON-LD / ELI**, **HTML** autonome,
**Word** (`.doc`), **Markdown**, JSON — tous au **format A4** pour l'impression et le PDF.

## Contenu du dépôt

```
index.html            page servie : en-tête du document, script du service, CSS, module
main.pjs              façade Perchance (édition en ligne uniquement — inerte ici)
src/
  SPEC.md             SPÉCIFICATION FONCTIONNELLE (à lire en premier)
  README.md           NOTES DE DÉVELOPPEMENT : architecture, conventions, pièges, flux de travail
  CHANGELOG.md        JOURNAL DES VERSIONS (la première entrée datée = la version en service)
  TODO.md             chantiers ouverts
  docs/
    ADMINISTRATION.md   exploitation : données, sécurité, sauvegardes, migration
    GITHUB.md           la source de cette page d'accueil (recopiée en README.md à la racine
                        du dépôt lors de l'export — garder les deux cohérents)
  css/app.css         système de design (surchargé par la configuration)
  lib/                trame, compilation, rendu, exports, styles, ELI, signature, validation,
                      exécution, collaboration, comptes, persistance (local / service / MySQL)
  ui/                 coquille, routeur, composants et vues
  wiki.js             contenu du guide d'utilisation
  pages/host.js       édition statique : fournit les deux services sans serveur
  server/             AUTO-HÉBERGEMENT : pile Docker nginx + service Node + MariaDB
.nojekyll             désactive Jekyll (obligatoire pour GitHub Pages, voir plus bas)
```

`main.pjs` n'existe que pour l'édition en ligne (Perchance) : il déclare les deux imports de
la plateforme (`kv`, `createServerSocket`). Sur GitHub Pages, ce sont `src/pages/host.js`
(IndexedDB + service embarqué dans la page) puis, en auto-hébergement, `src/server/` (nginx +
service Node + MariaDB) qui fournissent ces deux services.

## Mise en ligne (GitHub Pages)

Dépôt → **Settings** → **Pages** → *Source* : **Deploy from a branch**, branche `main`,
dossier **/ (root)**. Le site est à `https://<compte>.github.io/<dépôt>/` — les chemins de
`index.html` sont relatifs, donc un sous-dossier de projet convient.

> **Le fichier `.nojekyll` à la racine est obligatoire.** GitHub fait passer le dépôt par
> Jekyll, qui interprète les accolades doubles des documents (`README.md`, `SPEC.md`,
> `docs/ADMINISTRATION.md` — elles y servent d'exemples de jetons) comme du *Liquid* et
> **fait échouer la construction** : le site ne se publie pas. `.nojekyll`, même vide,
> désactive Jekyll. (Autre voie : *Settings → Pages → Source : GitHub Actions*, modèle
> « Static HTML », qui ne passe pas par Jekyll.)

En édition statique, le service de signature/publication est **hébergé par l'onglet** : toutes
les fonctions marchent sans réseau, mais les données dites « partagées » restent **propres à
chaque navigateur**. Pour travailler à plusieurs postes sur la même base, déployez
`src/server/` (voir `src/server/README.md`) ou branchez une base MySQL/MariaDB depuis
**Référentiel › Base de données**.

## Version et suivi

- Le numéro de version du logiciel vit dans **`src/lib/version.js`** (`APP_VERSION`).
- **`src/CHANGELOG.md`** tient l'historique, version par version. La **première entrée
  datée** est la version en service ; elle doit correspondre à `APP_VERSION`.
- Une version n'existe qu'une fois **figée** (déposée sur ce dépôt) : on incrémente au moment
  de livrer, jamais avant.
- Le changelog est aussi lisible **dans l'application** : *Documentation technique ›
  Journal des versions*, et la version en service est rappelée au bas du menu du compte.
- Pour une *release* GitHub, le texte de l'entrée correspondante du changelog fait très bien
  l'affaire : reprendre son titre et ses listes.

## Développement

- **Sans étape de build** : modules ES natifs, `src/` seul est chargé. Modifier un fichier,
  recharger la page.
- **Architecture, conventions de code et pièges connus** : `src/README.md` — c'est le point
  d'entrée pour reprendre le projet.
- **Périmètre fonctionnel et partis pris** : `src/SPEC.md`.
- **Flux de travail** (où l'on code, comment les versions sont figées, comment comparer ce
  dépôt à l'édition en ligne) : `src/README.md`, section « Flux de travail : Perchance ↔
  GitHub ».
- **Exploitation, sécurité, sauvegardes** : `src/docs/ADMINISTRATION.md`.

## Licence

Aucune licence n'est accordée par défaut : tous droits réservés au propriétaire du dépôt.
Ajouter un fichier `LICENSE` pour en choisir une.
