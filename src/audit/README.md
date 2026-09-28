# Audit — Scribae

Ce dossier contient le **cadre d'audit** de Scribae et ses **livrables**. Il ne contient
pas l'audit : il contient la méthode, le registre des non-conformités, et les rapports
successifs.

> **Ce dossier est un document de travail.** Le registre porte des non-conformités
> **encore ouvertes**, et un rapport décrit l'état d'un outil **à sa date** : rien ici n'est une
> certification. Une fiche lue sans son **statut**, sans sa **preuve** et sans les **propositions**
> qui l'accompagnent se cite à contresens — commencez donc par la **synthèse** du registre et le
> **plan d'action** du rapport le plus récent, et ne descendez aux fiches qu'ensuite. Les statuts
> évoluent (une non-conformité peut être levée depuis) ; les fiches, elles, ne sont jamais
> effacées.

## Contenu

| Fichier | Rôle |
|---|---|
| `PROMPT-AUDIT-SCRIBAE.md` | **Le cadre d'audit** : mission, périmètre, normes, les quatre auditeurs, méthode, cotation, contrat de sortie. C'est le document à donner à un agent pour lancer un audit. |
| `REGISTRE-NON-CONFORMITES.md` | **Le registre cumulatif** des non-conformités. Une entrée ne se supprime jamais : son statut évolue (`Ouverte` → `En cours` → `Levée` / `Régression` / `Acceptée` / `Obsolète`). |
| `rapports/AUDIT-SCRIBAE-AAAA-MM-JJ.md` | **Les rapports d'audit**, un par campagne, datés. Le plus récent est la référence courante. |

## Les rapports présents, et la « lignée » qu'ils racontent

| Rapport | Campagne | Version auditée |
|---|---|---|
| `rapports/AUDIT-SCRIBAE-2026-09-21.md` | 1re | avant 1.6.1 |
| `rapports/AUDIT-SCRIBAE-2026-09-21b.md` | 2e | 1.6.0 |
| `rapports/AUDIT-SCRIBAE-2026-09-23.md` | 3e | 1.6.1 |
| `rapports/AUDIT-SCRIBAE-2026-09-27.md` | 4e | 1.6.3 |
| `rapports/AUDIT-SCRIBAE-2026-09-29.md` | 4e (autre lignée) | 1.6.1w |
| `rapports/AUDIT-SCRIBAE-2026-09-30.md` | 5e (autre lignée) | 1.6.1w |
| `rapports/AUDIT-VISUEL-SCRIBAE-2026-09-28.md` | **visuelle** — le chapitre III seul (le qualiticien) | 1.6.3f |

Le rapport **visuel** du 2026-09-28 est le premier qui **n'instruit qu'un regard** : les
interfaces, l'accessibilité et la cohérence, écran par écran, mesures instrumentées à l'appui. Il
est la **référence courante** pour tout ce qui touche à l'écran (ses dix fiches sont **NC-III-009**
à **NC-III-017**) ; il ne remplace pas une campagne à quatre regards.

Deux **lignées** ont travaillé en parallèle sur ce dépôt (voir **NC-I-017** dans le registre) :
celle de l'atelier, qui a mené les campagnes des 21, 23 et 27 septembre, et une seconde, qui a
mené celles des 29 et 30 septembre sur une autre copie (version 1.6.1w). La comparaison du
2026-09-27 a montré que le dépôt sert désormais la **lignée de l'atelier** (la plus avancée :
1.6.3c), et que les fichiers de l'autre lignée lui **manquaient** : ses deux rapports sont
conservés ici (c'est une **pièce**, pas une référence courante), et les trois fiches qu'elle avait
établies et que le registre avait perdues — NC-I-015, NC-I-016, NC-II-015 — y sont **rétablies**.

> Le rapport du **2026-09-30** est arrivé **corrompu** dans le dépôt (1 497 octets de contrôle à la
> place des caractères accentués : en-tête, titres, tableaux et plans lisibles, corps non). Il est
> remplacé ici par une **reprise** qui le dit, rassemble ce qui s'en lit encore, et n'invente rien.

## Lancer un audit

Adresser à l'agent, sans le modifier, le message suivant :

> « Lis `src/audit/PROMPT-AUDIT-SCRIBAE.md` et exécute l'audit qu'il décrit,
> intégralement, en respectant son contrat de sortie (§7 et §8). »

L'agent doit, dans cet ordre :

1. charger le prompt **et** ses annexes (ce fichier, le registre) ;
2. **reprendre** le registre et le rapport le plus récent présent dans `rapports/` ;
3. exécuter l'audit en suivant la méthode du prompt (durée minimale : une heure) ;
4. écrire le rapport dans `rapports/AUDIT-SCRIBAE-AAAA-MM-JJ.md` ;
5. mettre à jour le registre (statuts, nouvelles entrées, historique des audits) ;
6. **joindre le rapport** à sa réponse finale (en markdown) ;
7. **ne rien corriger** : un audit constate et propose ; il ne modifie ni `main.pjs`, ni
   `index.html`, ni le reste de `src/`.

## Règles

- **Preuve ou silence** : tout constat s'appuie sur une preuve (citation `fichier:ligne`,
  action reproductible, observation d'écran, ou source normative rattachée). Ce qui n'a pas
  pu être vérifié est marqué **« non vérifié »**.
- **Symétrie** : le conforme est traité avec le même sérieux que le non conforme.
- **Confidentialité** : le rapport et le registre ne recopient ni données à caractère
  personnel réelles, ni secrets (jetons, clés, mots de passe) aperçus dans le code.
- **Identifiants stables** : `NC-<chapitre romain>-<numéro sur trois chiffres>`. Une
  non-conformité garde son identifiant tant qu'elle n'est pas levée.
- **Aucune correction** : l'audit ne touche pas à l'outil.
