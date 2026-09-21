---
titre: Prompt d'audit complet — Scribae
version: 1.0
date: 2026-09-21
cible: https://perchance.org/scribae
objet: Cadre d'audit et contrat de sortie pour produire le rapport d'audit de Scribae
reutilisable: oui (voir §0)
stockage: src/audit/PROMPT-AUDIT-SCRIBAE.md
---

# Prompt d'audit complet — Scribae

**Objet de ce document.** Ce document **est** le prompt. Il ne contient pas l'audit :
il le cadre, le rôle par rôle, section par section, et fixe le contrat de sortie du
rapport. L'audit lui-même est produit par l'agent à qui ce prompt est donné.

**Cible auditée.** `https://perchance.org/scribae` — éditeur de trames d'actes
administratifs : préparation des modèles par les administrateurs, remplissage par les
services, validation interne, signature, transmission au contrôle de légalité,
publication au recueil public sous identifiant ELI, export Akoma Ntoso / Schematron /
JSON-LD / HTML imprimable, assistants par moteur de langage. Démonstrateur configuré
pour une collectivité fictive (mairie de Valmont-sur-Loire).

---

## §0 — Mode d'emploi (réutilisation du prompt)

- **Pour lancer un audit.** Adresser à l'agent le message suivant, sans le modifier :

  > « Lis `src/audit/PROMPT-AUDIT-SCRIBAE.md` et exécute l'audit qu'il décrit,
  > intégralement, en respectant son contrat de sortie (§7 et §8). »

- **Ce que l'agent doit faire, dans cet ordre :**
  1. charger ce prompt **et** ses annexes (`src/audit/README.md`,
     `src/audit/REGISTRE-NON-CONFORMITES.md`) ;
  2. **reprendre** le registre des non-conformités et le rapport d'audit le plus récent
     présent dans `src/audit/rapports/` (s'il en existe un) ;
  3. exécuter l'audit en suivant la méthode §5 (durée minimale : **une heure**, §5.2) ;
  4. écrire le rapport dans `src/audit/rapports/AUDIT-SCRIBAE-AAAA-MM-JJ.md` (§8) ;
  5. mettre à jour `src/audit/REGISTRE-NON-CONFORMITES.md` (§6.4) ;
  6. **joindre le rapport à sa réponse finale** en markdown (`attach_file`) ;
  7. **ne rien corriger** : un audit constate et propose ; il ne modifie ni `main.pjs`,
     ni `index.html`, ni le reste de `src/`.

- **Ce que ce prompt n'est pas.** Ce n'est ni un référentiel de conformité exhaustif,
  ni un jugement pré-écrit. Les constats sont produits par l'agent, à partir des
  preuves qu'il collecte dans l'outil (§5.3).

- **Versionnage.** Toute évolution du cadre d'audit (ajout d'un chapitre, d'une
  exigence, d'un auditeur, changement de cotation) incrémente `version` dans
  l'en-tête ci-dessus et ajoute une entrée datée au §10.

---

## §1 — Mission

Produire un **rapport d'audit complet** de Scribae, à la fois :

- **sur ce qui est conforme** — ce qui satisfait une exigence, une norme, un besoin
  exprimé — et **sur ce qui ne l'est pas** ;
- **sur ce qui est non conforme**, qualifié (mineur / majeur), justifié par une preuve
  et accompagné d'une **proposition à réaliser** concrète, chiffrable et priorisée ;
- **sur les propositions** : le rapport se termine par un plan d'action hiérarchisé
  (horizons, effort, impact, porteur, dépendances), exploitable directement par le
  service prescripteur.

Le rapport est un **livrable** : il est écrit en markdown, **stocké dans `src/`** et
**joint à la réponse** de l'agent.

L'audit est **pluridisciplinaire** : quatre auditeurs, quatre chapitres, une même
matière (l'outil), quatre regards irréductibles l'un à l'autre.

---

## §2 — Périmètre

### §2.1 Dans le périmètre

- `main.pjs`, `index.html` (y compris le script `type="text/x-server-plugin"`), et
  **l'intégralité** du dossier `src/` (code, documentation, données de démonstration) ;
- l'application **à l'exécution** : parcours réels, écrans, workflows, exports,
  API, persistance, assistants ;
- les **interfaces** : pages publiques et espace atelier, responsive, impression ;
- les **données** : celles des actes, celles du recueil public, la démonstration ;
- la **documentation** : `src/README.md`, `SPEC.md`, `CHANGELOG.md`, guide intégré.

### §2.2 Hors périmètre (à mentionner, sans en faire des non-conformités)

- les composants de la plateforme Perchance elle-même (moteur, hébergement,
  plugins tiers) — mais **leur usage par Scribae** est dans le périmètre ;
- le prestataire de signature externe et les services tiers appelés — mais la
  **manière dont Scribae s'y branche** est dans le périmètre ;
- l'infrastructure de la collectivité cliente.

### §2.3 Distinction à tenir

Le rapport distingue systématiquement :
**l'outil de démonstration** (ce qui tourne sur `perchance.org/scribae`, avec ses
limites assumées : IndexedDB comme pilote local, pas de SMTP, etc.) et
**le déploiement cible** (service auto-hébergé, base MySQL/MariaDB, SMTP, jeton d'API).
La confusion entre les deux est elle-même un objet d'audit (§4.2).

---

## §3 — Corpus de référence et normes

L'auditeur rattache chaque constat à une exigence. Références mobilisables selon le
chapitre (à vérifier dans leur version en vigueur) :

- **Actes administratifs** : CGCT (élaboration, publicité, transmission,
  art. L.2121-1 s. et L.2131-1 s.), Code des relations entre le public et
  l'administration (entrée en vigueur, publicité, motivation), vadémécum du contrôle
  de légalité, procédures de télétransmission.
- **Signature et preuve** : règlement eIDAS (UE) n° 910/2014 et ses niveaux,
  décret relatif à la signature électronique, horodatage, NF Z42-013 (archivage
  électronique), référentiel d'interopérabilité (RGI).
- **Normalisation et open data** : Akoma Ntoso (OASIS LegalDocML), ELI, JSON-LD /
  Schema.org, licence ouverte, obligations de réutilisation des données publiques.
- **Sécurité et données** : RGPD (UE 2016/679) et loi Informatique et Libertés,
  recommandations CNIL (minimisation, durées de conservation, sécurité, AIPD),
  référentiel général de sécurité (RGS), guides ANSSI (hygiène informatique,
  authentification, journalisation, TLS), ISO/IEC 27001/27002,
  OWASP Top 10 et OWASP ASVS.
- **Accessibilité et qualité** : loi n° 2005-102, RGAA 4.1, WCAG 2.1 AA, EN 301 549 ;
  ISO/IEC 25010 (qualité du produit logiciel), ISO/IEC 25040 (évaluation) ;
  cahier des charges du service prescripteur (voir `src/SPEC.md` s'il existe).

L'auditeur ne cite une norme que s'il peut **rattacher un constat précis** à un de ses
critères. Une référence générale et non rattachée est une faute de méthode (§9).

---

## §4 — Les quatre auditeurs

Chaque auditeur ouvre un **chapitre**. Chaque chapitre est subdivisé en **sections**
(les listes ci-dessous sont le **socle minimal** ; l'auditeur peut en ajouter, il ne
peut pas en retirer sans le justifier dans le rapport).

Chaque chapitre se termine par : les **points conformes**, les **non-conformités**, les
**propositions à réaliser** propres à ce regard.

### §4.1 Chapitre I — Le directeur des systèmes d'information (DSI)

- **Profil / posture.** Informaticien sénior, hostilité déclarée au « vibe coding ».
  Registre direct, factuel, sans complaisance ; il ne note pas l'intention, il note le
  code et l'exploitation. Il a ouvert `src/` et a décidé de juger l'outil comme un
  logiciel destiné à durer et à être repris par d'autres que son auteur.
- **Question directrice.** « Est-ce que je peux faire tourner, faire évoluer, faire
  auditer et reprendre ça sans l'auteur, dans dix ans, avec une équipe ? »
- **Sections :**
  - **I.1 Architecture et découpage** — front / service / persistance ;
    responsabilités ; couplage ; points d'entrée ; dette de conception.
  - **I.2 Qualité et lisibilité du code** — conventions, taille des fichiers, code
    mort, duplication, commentaires utiles, homogénéité.
  - **I.3 Environnements, tests, industrialisation** — séparation démo / recette /
    production ; tests automatisés ; intégration et déploiement continus ;
    reproductibilité des versions.
  - **I.4 Dépendances et chaîne d'approvisionnement** — plugins Perchance, imports
    CDN, dépendances implicites, épinglage de versions, vulnérabilités des composants.
  - **I.5 Gouvernance du code** — versionnage (`APP_VERSION`), changelog, revue,
    traçabilité des modifications, propriété intellectuelle du code produit par l'IA.
  - **I.6 Exploitation** — performance, montée en charge, observabilité, sauvegarde,
    plan de reprise, gestion des incidents.
  - **I.7 Souveraineté, hébergement, réversibilité** — où vivent le code et les
    données, dépendance à un tiers, portabilité, verrouillage, plan de sortie.
  - **I.8 Documentation et reprise par un tiers** — transfert de compétences,
    documentation d'architecture, d'exploitation et de contribution.

### §4.2 Chapitre II — Le responsable de la sécurité des systèmes d'information (RSSI)

- **Profil / posture.** Plutôt jeune, méthodique, raisonnement d'attaquant :
  il ne se demande pas si le code est joli, mais **ce qu'un tiers malveillant peut en
  faire**. Il audite les données, les workflows **et** les interfaces (une interface
  est une surface d'attaque). Il arrive avec deux constats majeurs déjà formés
  (voir §4.2, « points d'entrée »), qu'il doit **confirmer, qualifier et documenter**,
  sans se contenter de les recopier.
- **Question directrice.** « Qui peut faire quoi, à qui, avec quelles données, et
  qu'est-ce qui reste comme trace ? »
- **Points d'entrée déjà signalés (à confirmer et qualifier par l'audit) :**
  - **démo et production insuffisamment segmentées** : frontières floues entre
    l'environnement de démonstration et l'environnement cible ; risque de fuite,
    de confusion de données et de manipulation ;
  - **usurpation possible du signataire** : rien n'empêche, en l'état, de faire signer
    à la place du signataire d'origine — le circuit de signature n'oppose pas
    l'identité du signataire à celle de l'opérateur.
- **Sections :**
  - **II.1 Cartographie et classification des données** — quelles données entrent,
    circulent, sortent ; données à caractère personnel ; secret des délibérations.
  - **II.2 Comptes, authentification, habilitations** — création, secret, robustesse,
    rôles, séparation des pouvoirs, principe du moindre privilège, comptes de service.
  - **II.3 Sécurité applicative** — injections, XSS par les templates et les contenus
    d'actes, traversées de chemins, désérialisation, SSRF, gestion des erreurs ;
    revue ligne à ligne du service (`type="text/x-server-plugin"`).
  - **II.4 Sécurité de l'API** — jetons, portée, exposition des routes, public /
    protégé, limitation de débit, énumération d'identifiants, CORS.
  - **II.5 Signature, intégrité et non-répudiation** — empreintes, horodatage,
    chaîne du document signé, **usurpation du signataire**, confusion d'identité,
    circuit externe (PDF déposé, certification de conformité).
  - **II.6 Segmentation des environnements** — démonstration / recette / production ;
    cloisonnement des données ; réversibilité ; absence de collisions d'identifiants
    et de secrets entre environnements.
  - **II.7 Journalisation, traçabilité, preuve** — quoi est journalisé, qui peut lire
    et modifier le journal, conservation, horodatage, inaltérabilité.
  - **II.8 Secrets et configuration** — clés, jetons, mots de passe : où sont-ils,
    sont-ils lisibles publiquement (le code servi est public), comment sont-ils
    renouvelés.
  - **II.9 Protection des données à caractère personnel** — minimisation, finalité,
    durées, droits des personnes, sous-traitance, transferts, analyse d'impact.
  - **II.10 Continuité, gestion des incidents, homologation** — sauvegardes,
    restauration, procédure d'incident, démarche d'homologation (RGS/ANSSI).

### §4.3 Chapitre III — Le qualiticien

- **Profil / posture.** Minutieux, obsédé par la cohérence. Il vient contrôler
  **l'accessibilité** et **les interfaces** : chaque alignement compte, chaque
  workflow compte. Il vérifie que l'outil est **compréhensible par tous les
  utilisateurs**, **complet par rapport à son cahier des charges**, et que les
  interfaces et fonctionnalités sont **cohérentes entre elles**. Il ne tolère pas le
  « presque ».
- **Question directrice.** « Est-ce que tout est là, est-ce que c'est accessible à
  tous, et est-ce que tout se comporte de la même façon ? »
- **Sections :**
  - **III.1 Complétude fonctionnelle** — chaque exigence du cahier des charges
    (`SPEC.md`, README, promesses de l'accueil, guide intégré), confrontée au réel :
    présente / partielle / absente, sans oubli.
  - **III.2 Accessibilité (RGAA 4.1 / WCAG 2.1 AA)** — structure et titres,
    contrastes, navigation clavier et ordre de tabulation, focus visible, formulaires
    et étiquettes, messages d'erreur, images et alternatives, tableaux, ARIA,
    tests avec lecteur d'écran.
  - **III.3 Ergonomie et parcours** — workflows de bout en bout, nombre d'étapes,
    charge cognitive, retour utilisateur, prévention et récupération des erreurs.
  - **III.4 Cohérence des interfaces** — design system, composants, états (vide,
    chargement, erreur, succès), vocabulaire, libellés, icônes, ordre des actions.
  - **III.5 Compréhension et aide** — messages, aide contextuelle, guide intégré,
    langue, orthographe, ton ; compréhension par un non-spécialiste.
  - **III.6 Robustesse et adaptation** — responsive (mobile / tablette / poste),
    navigateurs, agrandissement du texte, impression et export imprimable.
  - **III.7 Qualité mesurée** — critères d'acceptation, indicateurs, cohérence entre
    ce qui est annoncé et ce qui est rendu.
  - **III.8 Documentation utilisateur et formation** — exhaustivité, justesse vs.
    l'écran réel, support de formation.

### §4.4 Chapitre IV — Le directeur des affaires juridiques et du service des assemblées

- **Profil / posture.** Service prescripteur principal, commanditaire de l'outil.
  Exige la **conformité réglementaire**, la **sécurité juridique des actes** de sa
  collectivité, la **collaboration** entre services et l'**amélioration de la qualité
  du droit produit**. Il raisonne en valeur juridique, en risque contentieux et en
  service rendu à l'administration. Il défend aussi la soutenabilité : formation,
  adoption, coût.
- **Question directrice.** « Est-ce que les actes produits ici sont juridiquement
  sûrs, opposables, archivables, et est-ce que ça améliore vraiment ce que produit
  mon administration ? »
- **Sections :**
  - **IV.1 Conformité des actes et du cycle réglementaire** — élaboration, publicité,
    entrée en vigueur, opposabilité, transmission au contrôle de légalité,
    délais, abrogation et modification.
  - **IV.2 Interopérabilité et normes** — Akoma Ntoso, ELI, JSON-LD, HTML, exports ;
    fidélité et complétude des exports vs. ce qui est affiché.
  - **IV.3 Sécurité juridique et valeur probante** — intégrité, authenticité,
    chaîne de signature et de conservation, version signée, archivage légal,
    horodatage, distinction original / version en ligne / version consolidée.
  - **IV.4 Cycle de vie de l'acte** — de la trame au recueil public, y compris
    versions consolidées et modificatives, retrait exceptionnel, traçabilité.
  - **IV.5 Collaboration et gouvernance** — rôles, circuits de validation, parapheur,
    délégations, relecture, concurrence d'accès.
  - **IV.6 Qualité du droit produit** — qualité des trames, contrôles de conformité,
    contrôle de légalité interne, cohérence rédactionnelle, doctrine.
  - **IV.7 Transparence, données ouvertes et protection** — recueil public, licences,
    réutilisation, articulation avec la protection des données et le secret.
  - **IV.8 Valeur d'usage et soutenabilité** — adéquation au besoin, coût, adoption,
    formation, dépendance, évolutivité.

---

## §5 — Méthode

### §5.1 Phases

1. **Cadrage** (rapport, registre antérieur, périmètre, cahier des charges).
2. **Exploration statique** — lecture du code et de la documentation.
3. **Exploration dynamique** — exécution de l'outil, parcours réels, tests ciblés.
4. **Instruction** — qualification des non-conformités, recherche de preuves,
   hiérarchisation.
5. **Rédaction** — rapport et registre.
6. **Restitution** — synthèse, plan d'action, pièces jointes.

### §5.2 Durée

**Une heure au minimum.** Budget indicatif : ~10 min de cadrage, ~15 min par chapitre
(quatre chapitres), ~10 min de synthèse et de plan d'action, plus le temps de rédaction.
Le rapport **rend compte du temps réellement passé** (Annexe C) : un audit expédié en
dix minutes est un audit non conforme à ce prompt.

### §5.3 Preuves

Tout constat — conforme ou non conforme — s'appuie sur une preuve, au choix :

- une **citation de code** avec référence `fichier:ligne` (`src/lib/...:123`) ;
- une **action reproductible** dans l'outil (chemin de clics, requête, jeu de données) ;
- une **capture** ou une **observation d'écran** (décrire ce qui est vu et pourquoi) ;
- une **source normative** précisément rattachée au constat.

L'auditeur **exécute réellement** l'outil (prévisualisation en direct, rechargement,
parcours, exports, test des rôles, test des viewports, navigation au clavier). Il ne
déduit pas d'une lecture de code ce qu'un écran montre. Il ne déclare jamais
conforme ou non conforme ce qu'il n'a pas pu vérifier : il écrit alors
**« non vérifié »** et explique pourquoi.

### §5.4 Périmètre de la vérification dynamique

- Rôles et parcours : administrateur de trames, rédacteur, valideur, signataire,
  responsable de publication, visiteur public (sans compte) ;
- chaîne complète : trame → acte → validation → signature (électronique **et**
  externe) → transmission → publication → recueil public → ELI ;
- cas limites : acte non publiable, contrôle de légalité requis, certification de
  conformité, retrait exceptionnel, version consolidée, concurrence d'accès ;
- interfaces : poste, tablette, mobile ; navigation au clavier ; agrandissement ;
  impression.

---

## §6 — Qualification et registre des non-conformités

### §6.1 Grille de cotation

| Cote | Définition | Effet attendu |
|---|---|---|
| **Bloquante** | Empêche la mise en service, la sécurité juridique ou la sécurité tout court. | Correction avant toute exploitation réelle. |
| **Majeure** | Défaut de conformité ou de sécurité avéré, à impact réel, mais contournable. | Correction planifiée et suivie. |
| **Mineure** | Écart réel mais d'impact limité, gênant la qualité ou l'usage. | Correction dans un lot d'amélioration. |
| **Observation** | Point de vigilance, risque futur, ou bonne pratique manquante. | À instruire, sans correction obligatoire. |
| **Point conforme** | Satisfait une exigence. | À préserver ; à documenter. |

La cotation tient compte de **la probabilité**, de **l'impact** et de **la
réversibilité**. Une non-conformité est cotée au niveau du **chapitre qui l'instruit**
en premier ; les recoupements entre chapitres sont signalés, non dupliqués.

### §6.2 Forme

Chaque non-conformité reçoit un identifiant **stable** de la forme
`NC-<chapitre romain>-<numéro sur trois chiffres>` (ex. `NC-II-003`), réutilisé d'un
audit à l'autre : une non-conformité garde son identifiant tant qu'elle n'est pas levée.

### §6.3 Fiche

Chaque non-conformité est décrite selon les champs du registre (§6.4) : identifiant,
gravité, chapitre et section, constat, exigence de référence, preuve, recommandation,
effort, priorité, échéance, statut, origine.

### §6.4 Registre persistant

Le registre **`src/audit/REGISTRE-NON-CONFORMITES.md`** est **cumulatif**. Règles :

- une entrée **ne se supprime jamais** ; son **statut** évolue :
  `Ouverte` → `En cours` → `Levée` (avec date et preuve) ;
  `Régression` si une non-conformité levée réapparaît ;
  `Acceptée` si le risque est explicitement assumé (avec qui l'a assumé et pourquoi) ;
  `Obsolète` si le périmètre a disparu (avec justification) ;
- à chaque audit, l'agent **reprend** les entrées ouvertes, **revérifie** chacune
  (l'état a-t-il changé ?), puis **ajoute** les nouvelles ;
- l'agent **incrémente** le tableau « historique des audits » du registre.

Un rapport qui n'actualise pas le registre est incomplet.

---

## §7 — Structure imposée du rapport

Le rapport suit exactement ce plan. Les titres sont en français.

1. **En-tête** — date, version de Scribae (`APP_VERSION`), périmètre, méthode, durée,
   auditeurs, référence des pièces.
2. **Synthèse pour la direction** — une page au plus : appréciation générale, note par
   chapitre, **les dix risques majeurs**, la trajectoire recommandée.
3. **Chapitre I — Systèmes d'information (DSI)** — sections I.1 à I.8, chacune avec
   ses points conformes, ses non-conformités (renvoi vers la fiche et le registre) et
   ses propositions.
4. **Chapitre II — Sécurité des systèmes d'information (RSSI)** — sections II.1 à II.10,
   même structure, y compris le traitement explicite des deux points d'entrée (§4.2).
5. **Chapitre III — Qualité, accessibilité et expérience (qualiticien)** — sections
   III.1 à III.8, même structure ; la III.1 comporte un **tableau de complétude**
   exigence par exigence.
6. **Chapitre IV — Conformité et valeur juridiques (DAJ / assemblées)** — sections
   IV.1 à IV.8, même structure.
7. **Chapitre V — Synthèse transversale** — recoupements entre chapitres, risques
   systémiques, contradictions, arbitrages à rendre par le prescripteur.
8. **Plan d'action — propositions à réaliser** — chaque proposition : identifiant,
   description, non-conformités couvertes, bénéfice, effort, coût indicatif,
   porteur, dépendances, horizon. Classement par horizon :
   **0–30 jours** (urgences et gains rapides), **30–90 jours**, **90–180 jours**,
   **au-delà**. Inclure une estimation d'effort au moins qualitative.
9. **Annexe A — Registre des non-conformités** (extrait cumulé, identique au fichier
   de registre).
10. **Annexe B — Grille de cotation** (rappel du §6.1).
11. **Annexe C — Journal d'audit** — chronologie, temps passé par chapitre, liste des
    vérifications effectuées, liste de ce qui **n'a pas pu être vérifié** et pourquoi.

Chaque section de chapitre utilise, dans cet ordre, les sous-titres :
**Constat**, **Points conformes**, **Non-conformités**, **Recommandations**.

---

## §8 — Contrat de sortie

- **Format** : markdown, en français, structuré selon §7, lisible par un décideur
  comme par un technicien.
- **Ton** : celui de chaque auditeur (§4), mais toujours professionnel, étayé, sans
  attaque personnelle ni jugement de valeur sur les personnes.
- **Longueur** : proportionnée au nombre de constats ; « complet » veut dire exhaustif
  sur le fond, pas verbeux sur la forme.
- **Stockage** : `src/audit/rapports/AUDIT-SCRIBAE-AAAA-MM-JJ.md`.
- **Registre** : `src/audit/REGISTRE-NON-CONFORMITES.md` mis à jour (§6.4).
- **Joint à la réponse** : le rapport est **attaché** à la réponse finale de l'agent
  (`attach_file`), en plus d'être stocké.
- **Aucune correction de l'outil** pendant l'audit.
- **Front matter du rapport** (en tête de fichier) :

  ```
  ---
  titre: Audit Scribae — AAAA-MM-JJ
  version_outil: <APP_VERSION>
  duree: <hh:mm>
  chapitres: 4
  non_conformites: <nombre> (bloquantes <n>, majeures <n>, mineures <n>, observations <n>)
  points_conformes: <nombre>
  propositions: <nombre>
  registre: src/audit/REGISTRE-NON-CONFORMITES.md
  precedent: <chemin du rapport précédent, ou —>
  ---
  ```

---

## §9 — Règles de conduite de l'auditeur

1. **Preuve ou silence.** Pas de constat sans preuve (§5.3). Distinguer
   explicitement le **fait**, l'**hypothèse** et l'**opinion**.
2. **Rien d'inventé.** Ne pas attribuer au code ou à l'écran ce qui n'a pas été
   observé. Utiliser « non vérifié » le cas échéant.
3. **Aucune correction.** L'audit constate et propose ; il ne modifie pas l'outil.
4. **Un premier constat n'est pas une conclusion.** Les points d'entrée du §4.2 sont
   à confirmer, qualifier et documenter — pas à recopier.
5. **Symétrie.** Traiter le conforme avec le même sérieux que le non conforme.
6. **Utilité.** Toute non-conformité majeure ou bloquante est accompagnée d'une
   proposition réalisable.
7. **Sobriété normative.** Ne citer une norme que si un constat s'y rattache.
8. **Séparation des registres.** Tenir les voix des quatre auditeurs distinctes ;
   ne pas fusionner leurs appréciations.
9. **Confidentialité.** Le rapport est un document de travail : ne pas y recopier de
   données à caractère personnel réelles, ni de secrets (jetons, clés), même
   aperçus dans le code ou l'environnement.
10. **Reprise.** Lire le registre et le rapport antérieurs avant de commencer ; ne
    jamais repartir de zéro.

---

## §10 — Journal des versions du prompt

| Version | Date | Auteur | Moyen | Changement |
|---|---|---|---|---|
| 1.0 | 2026-09-21 | — | — | Création : quatre auditeurs, méthode, cotation, contrat de sortie, registre. |
