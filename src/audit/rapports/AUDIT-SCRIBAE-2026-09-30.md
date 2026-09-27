---
titre: Reprise du rapport d'audit du 2026-09-30 (lignée publiée) — document corrompu, reconstitué
version_outil: 1.6.3c
version_document: 1
statut: reprise — ne remplace pas l'original, qui n'est pas lisible
precedent: src/audit/rapports/AUDIT-SCRIBAE-2026-09-29.md
registre: src/audit/REGISTRE-NON-CONFORMITES.md
---

# Reprise du rapport du 2026-09-30 — « 5e campagne » de la lignée publiée

> **Ce fichier n'est PAS le rapport du 2026-09-30.** Il le remplace dans le dépôt parce que
> l'original y est **corrompu** : sur 51 265 octets, **1 497 octets de contrôle** (0x02, 0x06,
> 0x07, 0x08, 0x10, 0x16, 0x18, 0x19, 0x1A, 0x1B, 0x1E, 0x14, 0x19…) occupent la place des
> caractères accentués et des tirets. L'en-tête, les titres, les tableaux et les plans se lisent ;
> le corps, non. Aucune reconstitution n'est possible sans inventer : on ne réécrit pas un audit.
> Ce qui suit est **le peu qui se lit**, et ce qu'il est advenu de ses propositions.

## 1. Ce que l'original déclarait (en-tête lisible)

| Champ | Valeur |
|---|---|
| Date de la campagne | 2026-09-30 |
| Version auditée | **1.6.1w** (`src/lib/version.js`), commit `bcd07ed` |
| Campagne | **5e campagne** de cette lignée-là, après le rapport du 2026-09-29 |
| Non-conformités | **39** (0 bloquante, 13 majeures, 11 mineures, 15 observations), après ajout |
| Points conformes | 165 |
| Propositions | 18 |
| Registre | `src/audit/REGISTRE-NON-CONFORMITES.md` — celui de cette lignée, depuis recouvert |

Ses notes par chapitre, telles qu'elles se lisent : DSI **8 / 10** (« CI GitHub toujours rouge »,
verrou de dépendances absent à la racine), RSSI **9,5 / 10** (« aucune non-conformité bloquante
ouverte ; balise `noindex` non déployée »), qualiticien **9,5 / 10** (« démonstration non indexable
en code »), DAJ **8,5 / 10** (« ELI à unifier, signature qualifiée, télétransmission réelle
restent en cours »).

## 2. Les trois fiches établies par cette campagne (rétablies au registre)

| Fiche | Cotation | Objet |
|---|---|---|
| **NC-I-015** | Majeure | Absence de verrou de dépendances à la racine pour l'outillage |
| **NC-I-016** | Majeure | Le chemin des tests dans `package.json` à la racine est incorrect pour la CI |
| **NC-II-015** | Majeure | La balise `noindex` est présente dans `index.html` mais non déployée sur la démonstration |

Ces trois fiches **existent de nouveau** dans le registre (avec leur statut d'aujourd'hui), parce
que le registre de leur lignée a été recouvert et que rien d'autre ne les portait. C'est
l'opération « récupérer de l'autre ce qui manque » de la recommandation P-48 : voir **NC-I-017**.

## 3. Ses quatre propositions immédiates (P-31 à P-34), et ce qu'elles sont devenues

| Proposition (telle qu'elle se lit) | État au 2026-09-27 (livraison 1.6.3c) |
|---|---|
| **P-31** — Commiter `package-lock.json` à la racine | **Faite** : un verrou (lockfileVersion 3) est livré à la racine ; le champ `version` du manifeste passe à `0.0.0`, le numéro du logiciel vivant dans `src/lib/version.js`. |
| **P-32** — Corriger le chemin des tests dans `package.json` (`tests/` → `./tests/`) | **Faite** : `node --test ./tests/ ./src/server/mysql/ ./src/server/charge/`. C'était la cause de chaîne rouge que la lignée de l'atelier ne voyait pas. |
| **P-33** — Vérifier et corriger la condition `location.hostname` de la balise `noindex` | **Sans objet** : la condition était juste (`index.html`, `location.hostname === "demo.scribae.eu"`) ; c'est le **déploiement** qui manquait. |
| **P-34** — Déployer la correction sur GitHub Pages | **Faite** : la page publiée porte la balise, vérifié le 2026-09-27 (`GET https://demo.scribae.eu/`). |

Trois de ces propositions étaient donc **la même que celles de la lignée de l'atelier**, sous
d'autres numéros — ce qui est précisément ce que coûte une divergence de registres : le même
travail, découvert deux fois, et corrigé une fois.

## 4. Ce que cette ligne décrivait de son état, et qui ne correspond plus

L'original auditait **1.6.1w** (commit `bcd07ed`) : un état où la CI était rouge, où le verrou de
la racine manquait, et où la démonstration n'avait pas la balise. La lignée de l'atelier a depuis
livré **1.6.2** (travail à deux), **1.6.3** (télétransmission réelle, signature tenue par le
service), **1.6.3a** (trois régimes de contrôle de légalité), **1.6.3b** (la méthode de travail
entre dans le dépôt) et **1.6.3c** (l'image Docker éprouvée à chaque envoi). Les trois fiches
ci-dessus sont donc **fermées** dans le registre d'aujourd'hui, et l'arbitrage entre les deux
lignées est écrit dans **NC-I-017**.

## 5. Ce qui reste de ce rapport, et pourquoi il est conservé

Il n'est pas conservé pour ses constats — ils sont périmés ou repris. Il l'est pour **deux leçons**
que la seule lignée de l'atelier n'aurait pas données :

1. **Un correctif écrit n'est pas un correctif en service.** La balise `noindex` existait dans le
   fichier depuis la 1.6.1l ; elle n'a fermé sa fiche qu'une fois **la page servie** vérifiée.
   C'est la règle que la fiche NC-II-015 porte maintenant.
2. **Le même défaut se trouve deux fois** quand deux lignées travaillent sans se lire : la CI
   rouge a été instruite deux fois, et l'un des deux diagnostics — les chemins de `node --test`
   sans préfixe `./` — manquait à l'atelier. Comparer avant d'écrire n'est pas une formalité de
   gouvernance : c'est une source de correctifs.
