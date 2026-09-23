# Étude de charge — mesurer le service, pas l'impression qu'on en a

Ce dossier contient l'outil qui **met le service à l'épreuve d'une collectivité qui
travaille** : des postes simulés, à tous les rôles, plus le public du recueil, qui
ouvrent des sessions, lisent, cherchent, déposent, synchronisent et publient — puis
un rapport qui classe les gestes du pire au meilleur.

Il n'est pas livré par hasard : c'est cet outil qui a mis au jour le défaut corrigé
en `1.5.4a` — le dérivé de mot de passe qui **gelait tout le service** au moment de
l'affluence du matin (voir `docs/PERFORMANCE.md`).

## Ce qu'il mesure, et ce qu'il ne mesure pas

| Mesuré | Comment |
|---|---|
| Durée de chaque geste (p50, p90, p95, p99, max) | chronomètre par appel, agrégé par geste et par profil |
| Codes de réponse (200, 401, 429, 5xx) et échecs réseau | comptés par geste |
| Débit et volume échangé | requêtes et octets par seconde |
| Nombre d'ordres SQL, par table et par genre | mode `--sans-base` : la base en mémoire les compte |
| Coût d'une base distante | `--latence <ms>` simule un aller-retour par ordre |

**Ce qu'il ne mesure pas** : le coût d'un serveur de base réel (mode `--sans-base`
emploie une base en mémoire), ni le rendu du navigateur, ni le réseau entre
l'agent et le reverse-proxy. Une campagne contre une **vraie adresse** (`--url`)
mesure, elle, l'ensemble de la chaîne — mais ne voit plus le nombre d'ordres SQL.

## Lancer une campagne

Sur le service déjà en place (aucune base à installer, la base est en mémoire) :

```bash
node src/server/charge/charge.mjs --sans-base \
  --profils public=40,lecteur=8,redacteur=6,editeur=3,reviseur=1,signataire=1,administrateur=1 \
  --duree 60 --montee 0 --ecriture flux
```

Contre un déploiement de travail :

```bash
node src/server/charge/charge.mjs \
  --url https://actes.recette.exemple.fr \
  --connexion admin:'<mot de passe>' \
  --profils public=40,redacteur=8 --duree 120 --ecriture flux --confirme
```

**PRUDENCE.** Les campagnes d'écriture (`--ecriture flux` ou `pleine`) **modifient
les données de la cible** : le registre, la présence des postes, le journal. Sur une
adresse qui n'est pas la boucle locale, il faut le dire (`--confirme`). La cible doit
être un **déploiement de travail** — jamais la base de service d'une collectivité.
`--ecriture aucune` (le défaut) ne fait que lire.

`--aide` liste toutes les options (`--profils`, `--duree`, `--pensee`, `--montee`,
`--graine`, `--semence`, `--actes`, `--trames`, `--taille-acte`, `--publications`,
`--latence`, `--comptes`, `--connexion`, `--jeton`, `--sortie`, `--silence`).

## Les quatre réglages qui changent tout

- **`--profils`** — qui est là. Un profil, c'est un métier : ce qu'il regarde, ce
  qu'il écrit, sa cadence. `public` n'ouvre aucune session ; `lecteur`, `redacteur`,
  `editeur`, `reviseur`, `signataire`, `administrateur` en ouvrent une.
- **`--montee`** — l'étalement des connexions. **À zéro, tous les postes se
  connectent dans la même seconde** : c'est l'affluence du matin, et c'est le cas
  que le service doit tenir. À 30 000 ms, c'est une arrivée étalée sur la journée.
- **`--pensee`** — le temps de lecture humaine entre deux gestes. À zéro, le poste
  enchaîne (il rend la main entre deux gestes, mais n'attend pas) : c'est la
  **saturation**.
- **`--ecriture`** — `aucune` (lecture seule), `flux` (la présence des postes et
  leur journal), `pleine` (en plus, l'enregistrement des actes). C'est ce qui sépare
  « le service répond » de « le service enregistre ».

## Comment la cible est semée

Une campagne sur un service vide ne mesure que des listes vides. `--semence` (ou
`--sans-base`) **garnit la cible par son API** — trames, actes du registre,
informations, puis des actes **déposés, signés et publiés par les routes réelles**
(jusqu'à l'identifiant ELI du recueil). Rien n'est écrit dans les tables à la
place du service : ce que la campagne mesure ensuite est le comportement normal.

Les comptes de charge (`charge-edition`, `charge-redaction`, …) sont créés eux
aussi dans le référentiel, avec la source `charge` : ils se repèrent, et se
retirent, sans ambiguïté.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `charge.mjs` | la commande (arguments, cible, semence, rapport) |
| `profils.mjs` | les sept profils et leurs gestes, le tirage pondéré, le fond (battement, sondage) |
| `moteur.mjs` | fait vivre N postes en parallèle : montée, gestes, temps de pensée, mesures |
| `statistiques.mjs` | centiles, agrégat, alertes, rapport Markdown (pur, éprouvable) |
| `client.mjs` | client HTTP : pot à cookies par poste, session, anti-CSRF, reconnaissance |
| `semence.mjs` | la matière : trames, actes, informations, publications par les routes réelles |
| `faux-mysql.mjs` | MySQL en mémoire : exécute le schéma, compte les ordres, simule une latence |
| `mysql-bouchon.mjs` | présente cette base mémoire sous le contrat de `mysql2/promise` |
| `crochets.mjs` | substitue `mysql2/promise` au chargement (mode `--sans-base`) |
| `charge.test.mjs` | l'outil éprouvé lui-même : profils, statistiques, moteur, base en mémoire |

Rien de ces fichiers n'est chargé au démarrage du service : l'outil est à part,
et le service ne l'importe jamais.

## Rejouer les mesures de `docs/PERFORMANCE.md`

Les dix campagnes de l'étude se rejouent avec les mêmes réglages :
`--profils` de chaque scénario, `--duree`, `--pensee`, `--montee`, `--ecriture`, et
`--graine 1` pour que le trafic soit identique d'une campagne à l'autre. Les chiffres
du document ont été relevés sur le service lancé sur place (`--sans-base`), semé de
60 actes, 25 trames et 12 publications.
