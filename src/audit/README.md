# Audit — Scribae

Ce dossier contient le **cadre d'audit** de Scribae et ses **livrables**. Il ne contient
pas l'audit : il contient la méthode, le registre des non-conformités, et les rapports
successifs.

## Contenu

| Fichier | Rôle |
|---|---|
| `PROMPT-AUDIT-SCRIBAE.md` | **Le cadre d'audit** : mission, périmètre, normes, les quatre auditeurs, méthode, cotation, contrat de sortie. C'est le document à donner à un agent pour lancer un audit. |
| `REGISTRE-NON-CONFORMITES.md` | **Le registre cumulatif** des non-conformités. Une entrée ne se supprime jamais : son statut évolue (`Ouverte` → `En cours` → `Levée` / `Régression` / `Acceptée` / `Obsolète`). |
| `rapports/AUDIT-SCRIBAE-AAAA-MM-JJ.md` | **Les rapports d'audit**, un par campagne, datés. Le plus récent est la référence courante. |

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
