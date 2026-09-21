# Licence — Scribae

Ce document **tranche par écrit** ce que la documentation laissait divergent : la
page publique du dépôt annonçait « tous droits réservés » (`src/docs/GITHUB.md`,
section « Licence ») alors que le dépôt porte un fichier **`LICENSE` en
GPL-3.0**, exclu de l'archive d'export (voir `src/README.md`, « Exporter le dépôt
GitHub »). Il distingue trois objets, qui n'ont ni le même auteur ni le même
régime.

> **Confirmation.** L'arbitrage ci-dessous s'appuie sur ce que le dépôt porte
> déjà. Si le propriétaire entend un autre régime (EUPL 1.2, MIT, Apache 2.0,
> ou « tous droits réservés »), il **remplace le fichier `LICENSE` à la racine du
> dépôt**, puis ajuste ce document et la section « Licence » de
> `src/docs/GITHUB.md` : les trois doivent dire exactement la même chose.

---

## 1. Le LOGICIEL (le code de ce dépôt)

**GNU General Public License, version 3 (GPL-3.0).** Le texte intégral vit à la
**racine du dépôt**, dans le fichier `LICENSE`, qui n'est pas recopié dans
l'archive d'export (voir `src/README.md`).

Conséquence directe : **toute redistribution d'une version modifiée doit rester
sous GPL-3.0**, avec le code source correspondant. Un déploiement interne à une
collectivité n'est pas une distribution ; la mise à disposition du logiciel
modifié à un tiers, si.

La licence déclarée par les manifestes suit : `license` de `src/package.json` et
de `src/server/mysql/package.json` vaut `GPL-3.0-only`.

## 2. Les ACTES PUBLIÉS (le contenu du recueil public)

Les actes administratifs publiés au recueil ne relèvent **pas** de la licence du
logiciel : ils relèvent de la loi. La publicité des **conditions de
réutilisation** d'un document administratif publié en ligne est une
**obligation** (CRPA, articles L. 321-1 et L. 322-6 ; directive (UE) 2019/1024
dite « open data »).

Scribae affiche donc, sur le recueil public, une **mention de réutilisation**
configurable (*Administration › Publication › Mentions du recueil public*). La
valeur livrée par défaut — et celle du jeu de démonstration — est la **Licence
Ouverte 2.0** (Etalab), qui autorise la réutilisation libre, à titre gratuit, y
compris commercial, sous réserve de mention de la source. La mention est reprise
dans les **métadonnées JSON-LD** de chaque acte (`dcterms:license`).

Chaque collectivité adapte cette mention à sa propre politique : les conditions
de réutilisation de ses documents lui appartiennent.

## 3. Le CODE PRODUIT PAR L'IA

Une partie de ce logiciel a été écrite par un **assistant d'IA** sous la
direction du propriétaire du dépôt. Position retenue :

- **le titulaire des droits est le propriétaire du dépôt**, qui a dirigé,
  arbitré et validé la conception comme les choix de réalisation — l'assistant
  est un outil, non un auteur ;
- de ce fait, le code produit est **placé sous la même licence que le reste du
  logiciel** (GPL-3.0), sans régime à part ;
- **aucune licence tierce n'est héritée** de ce fait : le code produit n'intègre
  pas de composant sous licence incompatible. Les dépendances externes, elles,
  gardent leurs licences respectives (voir ci-dessous) ;
- les **dépendances de plateforme** (`ai-text-plugin` pour les assistants,
  stockage clé/valeur, canal du service, relais HTTP) sont **importées par nom**
  depuis Perchance (`main.pjs`) et **ne résident pas** dans ce dépôt.

Table des dépendances du service auto-hébergé (`src/server/mysql/package.json`) :

| Paquet | Version | Licence | Usage |
|---|---|---|---|
| `mysql2` | 3.11.3 (épinglée) | MIT | pilote MySQL/MariaDB |

Le reste du service n'a **aucune dépendance** : le moteur SMTP (`smtp.mjs`), le
scellement `scrypt` des mots de passe, les sessions et l'anti-CSRF sont écrits
pour l'occasion, précisément pour que la surface à auditer tienne dans quelques
fichiers — et pour ne rien hériter d'ailleurs.

---

*Dernière mise à jour : 2026-09-21. Ce document n'est pas un conseil juridique :
il **constate** l'état du dépôt et **le rend cohérent**. La décision appartient
au propriétaire du dépôt.*
