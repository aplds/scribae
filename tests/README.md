# Les tests de Scribae

Ce dossier porte les épreuves **transverses** : celles qui ne tiennent pas à un
module en particulier. Les épreuves du **service auto-hébergé** restent à côté de
ce qu'elles éprouvent (`src/server/mysql/*.test.mjs`, `src/server/charge/`), et
celles du **métier** qui ne touchent ni au DOM ni au réseau sont ici.

```sh
npm test                      # depuis la racine du dépôt : ce dossier + le service
node --test tests/            # ce dossier seul
```

| Fichier | Ce qu'il tient |
|---|---|
| `purs.test.mjs` | les modules purs : expressions, assainissement, numérotation, version, comptes, signature… et la **concordance** entre le client et le service (OIDC, champs d'API) |
| `abrogation-annexes.test.mjs` | les annexes d'abrogation |
| `amorcage-demo.test.mjs` | l'amorçage du jeu de démonstration |
| `competence-signature.test.mjs` | **qui signe** (le titulaire de la chaîne, porteur de la qualité), **qui est dans la file** (à signer, suivis, et l'acte sans signataire explicite), et **qui accède** (les qualités cumulées d'un visiteur) |
| `qualification-signature.test.mjs` | la qualification affichée d'une signature (NC-IV-001) |
| `publications-locales.test.mjs` | le repli local du recueil public |
| `pilote-persistance.test.mjs` | la persistance du pilote (base locale et base distante) |
| `original-signe.test.mjs` | la règle « part publique d'un original signé », et sa **copie** dans `index.html` |
| `conformite-service.mjs` | **le jeu d'appels commun** aux deux services (démonstration et auto-hébergé) — ce n'est pas une épreuve, mais le contrat éprouvé |
| `conformite-service.test.mjs` | l'exécution de ce jeu contre le service de démonstration, et la comparaison avec une installation réelle (`SCRIBA_CONFORMITE_URL`) |
| `parcours.mjs` | les **parcours** joués dans le NAVIGATEUR, contre l'application vivante (`lancerParcours()`) — voir `docs/INDUSTRIALISATION.md` § 2 |
| `industrialisation.test.mjs` | **l'outillage lui-même** : il lance `scripts/verifier-style.mjs` tel qu'il est livré et exige le code de sortie 0 (audit, NC-I-008 et NC-I-009) |

## Pourquoi les imports disent `../src/…`

Le dépôt range l'outillage à sa **racine** (`scripts/`, `tests/`) et le code de
l'application sous **`src/`** : c'est la disposition **livrée**, et c'est pour
elle que ces fichiers sont écrits (le code est donc `../src/lib/…`, `../src/ui/…`
et l'outillage `../scripts/…`).

Dans l'atelier, l'outillage vit sous `src/` — `src/tests/` est le seul arbre que
la plateforme conserve d'une séance à l'autre —, et le harnais d'essai y simule
la disposition livrée. `scripts/racine-code.mjs` **constate** la racine du code
au lieu de la supposer : c'est ce qui évite le piège de NC-I-009, où un décalage
entre l'outil et l'arborescence qu'il contrôle avait éteint toutes ses
exemptions.
