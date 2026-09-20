# Journal des versions

Historique des versions livrées de **Scribae** (éditeur de trames et d'actes
administratifs). Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) ;
numéros `MAJEUR.MINEUR.CORRECTIF` ([semver](https://semver.org/lang/fr/)).

## Comment ce fichier fonctionne

- **Une version n'existe qu'une fois figée**, c'est-à-dire déposée sur GitHub. On
  incrémente le numéro et on ouvre l'entrée datée **au moment de livrer**, pas avant.
- Le travail en cours n'a pas de numéro : il se décrit sous **Non publié**, et cette
  section est vidée dans la nouvelle entrée au moment de figer.
- Le numéro courant est celui de `APP_VERSION` dans `src/lib/version.js` — c'est la
  source unique du numéro. **La première entrée datée de ce fichier doit lui
  correspondre** ; en cas de divergence, c'est ce fichier qui dit la vérité.
- Rubriques : `Ajouté`, `Modifié`, `Corrigé`, `Retiré`, `Sécurité`. Une entrée ne
  garde que les rubriques qu'elle utilise.
- On décrit le **changement visible** (ce que l'utilisateur constate, ou ce que
  l'exploitant doit savoir), pas la liste des fichiers touchés.

## [Non publié]

- Rien en cours.

## [1.0.1] — 2026-09-20 — Collaboration : audit et correctif de la cloche

Audit complet des écrans et des services, en éprouvant la collaboration en direct
dans l'aperçu.

### Corrigé

- **La cloche de notifications n'affichait jamais les faits ciblant un rôle ou un
  service** (`role:…`, `service:…`) : le filtre de portée n'était pas alimenté par
  les actes visibles du compte (`src/ui/state.js`). Un dépôt au parapheur destiné aux
  administrateurs apparaît désormais aux administrateurs — et un fait ciblant un
  autre rôle reste filtré (vérifié dans l'aperçu).
- README : « onze permissions » — la table `PERMS` en compte onze depuis l'ajout de
  `api.gerer`, la documentation en annonçait dix.

### Ajouté

- Ce journal des versions, et la version du logiciel affichée dans l'application
  (menu du compte, écran « Documentation technique ») — `src/lib/version.js`.

## [1.0.0] — 2026-09-20 — Version 1 fonctionnelle

Première version figée. L'application couvre la chaîne complète d'un acte, de la
trame à la publication opposable. Démonstrateur configuré pour une collectivité
**fictive** (mairie de Valmont-sur-Loire) : rien de réel dans le jeu livré.

### Ajouté

- **Trames** : registre (liste, création, duplication, import/export JSON), éditeur
  de trame (plan, page éditable en place, inspecteur : blocs, champs, règles, trame,
  commentaires et règles signés du service de leur auteur).
- **Rédaction** : choix de l'acte à rédiger (brouillon en cours, acte enregistré,
  trame avec recherche), document éditable en place (WYSIWYG, pastilles de champs),
  écarts « hors trame » conservés et signalés (jamais bloquants), panneau
  « À compléter » / « Contrôle & écarts », enregistrement, historique des brouillons
  (vingt versions, restauration).
- **Exports** (format A4 pour l'impression et le PDF) : Akoma Ntoso 3.0, Schematron,
  JSON-LD/ELI, HTML autonome, Word (`.doc`), Markdown, JSON, impression.
- **Actes** : registre (numéro, objet, nature, conformité à la trame, statut,
  parapheur, exécution, corbeille réversible), fiche d'acte, recherche globale
  (Ctrl+K ou « / » : actes, trames, personnes, services, références, comptes, guide).
- **Parapheur** : circuits de validation du référentiel (étapes séquentielles, bon
  pour accord ou avis, ciblage trame/famille/entité), décisions motivées, empreinte du
  texte validé (une réécriture rend la validation caduque), file « à valider par moi ».
- **Exécution & délais** : échéancier des formalités (transmission au contrôle de
  légalité, publication, notification), date d'exécutoire, délai de recours, alertes
  de retard, constatations horodatées.
- **Signature & publication** : dépôt auprès du service (API REST), circuit de
  signature auprès du prestataire, original signé **réellement vérifiable**
  (ECDSA P-256 + SHA-256, horodatage), publication au recueil avec identifiant ELI,
  version en ligne, opposabilité, registre public, actes non publiables (individuels).
- **Modifier un acte** : édition en place de l'acte en vigueur, acte modificatif et
  version consolidée générés d'un seul geste, mentions « Modifié/Abrogé/Ajouté par »,
  suivi des modifications en option, versions publiées d'un même ELI (supplantation
  sans effacement).
- **Référentiel** (17 onglets) : identité et marque, vocabulaire, numérotation, entités,
  services et bureaux, personnes, rôles, références, mentions, familles, types d'actes,
  circuits de validation, exécution & délais, annuaire (OIDC), base de données, journal
  d'audit, données (export/import/vidage).
- **Feuilles de style** : charte graphique par entité/famille, marges du papier,
  en-tête/pied, filets, encadrés, tableaux, signature, cadre, préréglages, aperçu par
  le même code que les exports, édition directe WYSIWYG sur le style.
- **Comptes, rôles et périmètre** : trois rôles, onze permissions, périmètre par
  service/bureau, écran de connexion, gestion des comptes, garde-fous.
- **Annuaire (OIDC)** : flux code d'autorisation + PKCE, vérification du jeton
  (émetteur, audience, validité, nonce, signature JWKS), groupes → rôles, périmètre par
  revendications, création ou reprise des comptes, désactivation réversible des comptes
  de démonstration, annuaire d'essai intégré.
- **Collaboration** : présence des postes, verrou souple de rédaction, journal d'audit
  (300 derniers faits, filtrable), notifications et cloche.
- **Persistance** : façade à trois pilotes (locale IndexedDB, service partagé,
  serveur MySQL/MariaDB), synchronisation par enregistrement avec révisions, détection
  de conflits, miroir hors ligne, file d'écritures différées.
- **Apparence** claire / sombre (préférence de poste).
- **Guide d'utilisation** intégré (19 chapitres, glossaire, dépannage, impression) et
  **documentation technique** lue depuis les fichiers du dépôt.
- **Auto-hébergement** : pile Docker nginx + service Node + MariaDB, édition web de
  l'application, documentation d'exploitation et de sécurité.

### Limites assumées de cette version

- Le prestataire de signature est **simulé** (cryptographie réelle, certificat non
  qualifié eIDAS) ; aucun appel sortant réel.
- L'API de signature/publication est servie par le script serveur embarqué dans
  `index.html` (démonstration) ; son adresse n'est réglable que par le déploiement,
  pas depuis l'interface.
- La collaboration n'a pas de service dédié : elle repose sur la base partagée et sur
  un sondage (pas d'édition simultanée, verrou souple seulement).
- PDF/A certifié et bordereau SEDA : non livrés (voir `src/TODO.md`).
