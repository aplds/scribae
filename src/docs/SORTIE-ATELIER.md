---
titre: Sortie d'atelier (Perchance) — le dépôt devient la seule source de vérité
date: 2026-10-24
statut: en cours — étape 1 en relecture (PR #2), étape 2 faite (doc agent)
auteur: Vibe (Work) — validé par Arno pour exécution par une session Code
---

# Sortie d'atelier — plan de migration

**Pourquoi ce plan.** Le développement ne passe plus par l'atelier Perchance. Objectifs :
une seule source de vérité (ce dépôt, branche `dev`), la CI comme unique juge de qualité,
et la suppression de ce qui n'existait que pour l'atelier. Rien d'autre ne change :
pas de migration technique, pas de réécriture, la stack reste telle quelle.

## Règles pour l'agent d'exécution (session Code)

1. **Une PR = un sujet.** Pas de renommage ni de réorganisation « au passage ».
2. **CI verte avant toute demande de relecture** ; en local, `npm run verifier`.
3. **Ne lire que les fichiers listés par l'étape en cours.** Pas d'exploration hors
   périmètre : le plan dit quoi ouvrir, l'inventaire de l'étape 1 précisera la suite.
4. **La doc avant le code** : `AGENTS.md` doit dire le vrai après chaque PR.
5. **Trace à chaque livraison** : entrée changelog datée + `APP_VERSION` accordé
   (règle du projet), documents rendus faux corrigés.
6. Ne jamais modifier à la main un document engendré (`VARIABLES.md`, `API.md`,
   `logiciel-engendre.mjs`) : corriger la source puis régénérer.

## Étape 0 — Sécuriser les restes (Arno, hors code)

Vérifier dans l'atelier Perchance qu'il ne reste aucun travail postérieur à
1.6.3u (commit `0552914`) non exporté. Si oui : l'exporter vers `dev` AVANT tout.
Sinon, l'atelier peut être abandonné sans perte.

## Étape 1 — Inventaire (PR : lecture seule + une section de ce document)

Recenser et écrire dans la section « Inventaire » ci-dessous, sans modifier
aucun autre fichier :

- `main.pjs` (racine) — l'intégration Perchance (greffons kv, serveur de démo,
  relais, hébergement de fichiers, moteur IA) ;
- `scripts/harnais-atelier.mjs` et tout ce qui n'existe que pour lui ;
- `src/docs/ATELIER.md` ;
- les sections « atelier » de : `AGENTS.md`, `CLAUDE.md`, `README.md` (racine),
  `src/README.md` (flux Perchance ↔ GitHub), `tests/README.md`, autres `src/docs/*` ;
- **à analyser sans décider** : le service de démonstration embarqué dans
  `index.html` (script `type="text/x-server-plugin"`) — déterminer par lecture
  (et non par essai) s'il sert demo.scribae.eu indépendamment de Perchance.

Livrable : la section « Inventaire » remplie (fichiers à modifier / supprimer par
étape, avec le motif en une ligne chacun). Aucune suppression à cette étape.

## Inventaire (à remplir par l'étape 1)

*(vide — sera complété par la PR d'inventaire)*

## Étape 2 — La doc agent dit le nouveau monde (PR)

- `AGENTS.md` : retirer atelier, harnais et flux d'export ; décrire le nouveau flux :
  branche `dev`, une PR par sujet, `npm run verifier` en local, CI verte avant
  relecture ; conserver tout le reste des règles (elles restent vraies) ;
- `CLAUDE.md` : pointer vers `AGENTS.md`, retirer la référence atelier ;
- `src/README.md` : réécrire la section « Flux de travail » ;
- `tests/README.md` et `src/docs/*` : retirer les mentions de l'atelier Perchance
  (liste exacte : celle de l'inventaire).
Trace changelog + `APP_VERSION`.

## Étape 3 — Suppression du legs (PR)

- `git rm main.pjs` ;
- `git rm scripts/harnais-atelier.mjs` (+ tout script qui n'existe que pour lui,
  selon l'inventaire) ;
- `git rm src/docs/ATELIER.md` ;
- `grep -ri "atelier" .` sur les fichiers restants : corriger toute mention de
  l'atelier Perchance.

**Attention, piège nommé** : le mot « atelier » désigne AUSSI un écran de
l'application (chemin `/atelier`, `demandeAtelier`, `SCRIBA_ATELIER_IPS`,
`nginx.conf` location `/atelier`). NE PAS toucher à l'application ni à la façade :
seules les mentions de l'atelier *Perchance* disparaissent.
`npm run verifier` vert + CI verte. Trace changelog + `APP_VERSION`.

## Étape 4 — Décision sur la démonstration (hors de ce chantier)

L'étape 1 apporte le constat (le service de démo embarqué sert-il
demo.scribae.eu sans Perchance ?). Les options — geler en données statiques,
réduire, ou conserver tant que l'épreuve de concordance le tient — sont à
trancher par Arno, dans un chantier distinct. Ce plan se limite à documenter
le constat.

## Étape 5 — Version

Livrer le tout sous une note « Sortie d'atelier » : première entrée datée du
changelog après 1.6.3u (lettre ou nouveau numéro, selon la règle du fichier),
`APP_VERSION` accordé.
