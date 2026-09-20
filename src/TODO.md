# TODO — chantiers ouverts

État au moment où ce fichier a été écrit. Ce qui est **fait** est décrit dans
`README.md` et `SPEC.md` ; ce fichier ne liste que ce qui reste.

## Circuits de validation, exécution, registre et collaboration (livrés — suite possible)

Livré en une fois, quatre manques qui tenaient ensemble (un acte n'était ni
validé, ni exécutoire, ni retrouvable, ni partagé) :

- **Parapheur** — `src/lib/validation.js` (circuit = donnée du référentiel :
  étapes séquentielles, rôle, bon pour accord ou avis, ciblage trame / famille /
  entité) ; `src/ui/views/parapheur.js` (file « à valider par moi / en cours /
  validés / renvoyés ») ; `src/ui/parapheur-actions.js` (les gestes partagés par
  l'écran et par la fiche d'acte) ; décisions, observations, reprise de circuit,
  et **empreinte du texte validé** : réécrire l'acte après validation rend celle-ci
  caduque. Le service de signature refuse (409 `validation_incomplete`) d'ouvrir un
  circuit sur un acte non validé.
  C'est une **fonction expérimentale, éteinte par défaut** (`experimental.parapheur`,
  Administration › Expérimentale) : beaucoup de collectivités ont déjà leur propre
  circuit interne, en amont de « Envoyer en signature ». Éteint, `circuitFor` ne
  résout aucun circuit et tout le parapheur disparaît de l'interface ; l'activer
  régénère les actes de démonstration pour que l'écran ne soit pas vide.
- **Révision** — `src/lib/revision.js` (rôle « Réviseur » **cumulable**, compétence
  par compte ou portée par un service — ou certains de ses bureaux —, ciblage
  services / familles / trames / types d'actes / entités ; `en_attente`, `valide`,
  `rejete` ; **empreinte du texte révisé**) ; `src/lib/conformite.js` (le **rapport de
  conformité** remis au réviseur) ; `src/ui/views/revision.js` (file « à réviser par
  moi / en attente d'un autre réviseur / révisés / rejetés ») ; `src/ui/revision-actions.js`
  et `src/ui/revision-cartes.js` (gestes et cartes partagés avec la fiche d'acte). Le
  geste du rédacteur **soumet** l'acte au lieu de l'envoyer ; le réviseur le **corrige**,
  le **valide** (l'acte part alors en signature) ou le **rejette** (l'acte revient en
  brouillon, avec le motif). Sans réviseur compétent, la révision **n'a pas lieu**. Ordre
  **parapheur → révision → signature** ; le service refuse (409 `revision_incomplete`)
  d'ouvrir un circuit sur un acte non révisé.
- **Caractère exécutoire** — `src/lib/execution.js` (formalités requises ou non
  selon la trame, date d'exécutoire = dernière formalité requise accomplie, délai
  de recours contentieux à compter de cette date, recours introduit qui ferme le
  délai, alertes de retard) ; `src/ui/views/execution.js` (échéancier) ;
  `src/ui/execution-actions.js` (la constatation d'une formalité **et d'un
  recours**, partagée avec la fiche d'acte) ; `src/lib/execution-documents.js`
  (l'état des formalités et l'attestation de non-recours). Une formalité — comme
  un recours — est une ATTESTATION de l'agent : l'application ne devine rien.
- **Transmission au contrôle de légalité par API** — `src/lib/legalite.js` : l'étape
  s'intercale entre le retour signé et la publication (`POST /v1/actes/{id}/transmission`),
  l'accusé de réception vaut certificat de transmission (« Transmis au contrôle de légalité
  le … à … », référence, empreinte, sceau) et est déposé sur le document ; l'ordre
  signé → transmis → publié est tenu par le service (`409 transmission_absente`,
  `409 acte_non_signe`). **Fonction expérimentale, éteinte par défaut**
  (`experimental.controleLegalite`, Administration › Expérimentale) : la télétransmission
  suppose une convention et des identifiants auprès de la préfecture ; éteinte, la
  transmission se constate à la main.
- **Registre et recherche** — `src/lib/search.js` + `src/ui/global-search.js`
  (recherche globale Ctrl+K / « / », actes, trames, personnes, services,
  références, comptes, aide) ; corbeille (`src/ui/views/corbeille.js`, suppression
  réversible `deletedAt`, restauration, suppression définitive) ; **journal
  d'audit lisible** (Administration › Journal d'audit) ; historique des brouillons
  (`src/lib/revisions.js`, vingt versions, restauration).
- **Collaboration** — `src/lib/collab.js` + `src/ui/collab.js` : présence des
  postes (battement 25 s, `BroadcastChannel` + sondage), verrou souple de
  rédaction (« ouvert sur un autre poste »), notifications (cloche) et journal.
  Le journal et la présence sont deux collections du contrat de persistance
  (`journal`, `presence`), sans toast de conflit et sans recopie dans
  `sb_journal` côté MySQL.

Reste à faire, par ordre d'intérêt :

- [x] **Délégation de signature des actes (livré).** Le référentiel porte l'arbre
      des délégations (`config.delegations`, écran Délégations) et l'acte
      signé au bout de la chaîne imprime les qualités traversées, seul le nom du
      signataire étant écrit (voir `src/lib/delegations.js`). Les chaînes sont
      rattachées à une organisation : un établissement autonome (l'office public
      de l'habitat de la démonstration) a SA propre autorité de tête et sa propre
      chaîne, indépendante de celle de la commune.
- [ ] **Numérotation externe : le relais hors de l'environnement d'édition.** Le relais HTTP
      sans CORS (`hostSuperFetch()`) vient de l'hébergement : il existe dans l'édition en
      ligne, pas dans le déploiement `src/server/`. Une installation auto-hébergée ne peut
      donc appeler un service de numérotation qu'en **appel direct**, avec l'origine de
      l'application déclarée origine de confiance chez le service. La suite serait un
      **relais côté service** (un `/v1/proxy` qui reprend une adresse, des en-têtes et un
      corps, avec une liste d'hôtes autorisés) posé par `src/server/web/host.js` dans
      `__SCRIBA_HOST__` — la clé ne sortirait alors pas du serveur de la collectivité.
- [ ] **Numérotation externe : une source par entité.** Le référentiel ne porte qu'UNE source
      (`config.numbering.source`, avec `config.numbering.externe`) pour toutes les entités : la
      table de numérotation distingue les entités par le jeton `{entityCode}`. Une collectivité
      qui numérote chaque établissement dans un **document distinct** (une table Grist par
      office) aurait besoin d'une source par entité — le point d'accroche est
      `numberingSettings()` (`src/lib/numbering.js`), qui décide aujourd'hui de la source.
- [ ] **Numérotation externe : reprendre un numéro déjà attribué.** Rien n'empêche de rejouer
      la demande après un échec (le service a pu créer la ligne sans que la réponse arrive) :
      une **clé d'idempotence** portée par la requête, ou la lecture de la dernière ligne
      créée, éviterait de consommer deux numéros. À traiter le jour où une collectivité
      numérote réellement par API.
- [ ] **Télétransmission : adresse et identifiants du contrôle de légalité.** L'API d'envoi
      est aujourd'hui une constante du module (`CONTROLE_LEGALITE`, `src/lib/legalite.js`) et
      une simulation côté service. En exploitation, il faudrait la **configurer dans le
      référentiel** (adresse, identifiants, format attendu par la préfecture) et gérer les
      **refus** du contrôle de légalité (rejet, demande d'observations) — l'aller-retour
      complet, aujourd'hui réduit à l'accusé de réception.
- [ ] **Vérifier un certificat de transmission depuis le registre.** Le sceau est vérifié à
      l'affichage de l'**original signé** (`verifierCertificatTransmission` : SHA-256 des
      mentions rapproché de l'empreinte du document). La même vérification depuis la
      **publication** (côté citoyen, où le certificat est joint au document publié) serait la
      suite logique.
- [ ] **Suppléance dans le parapheur.** L'étape du parapheur reste ouverte au rôle
      qui la porte (et à tout administrateur, comme recours en cas d'absence) ; le
      circuit ne lit pas encore les délégations. Une vraie **suppléance** (vacances,
      intérim, délégation temporaire) serait la suite logique — avec sa trace au
      journal.
- [ ] **Suppléance de réviseur.** Comme pour le parapheur, la révision n'est ouverte qu'aux
      réviseurs **compétents** (et à tout administrateur, comme recours) ; une **suppléance**
      (absence, intérim) qui élargirait temporairement la compétence — avec sa trace au journal —
      serait la suite logique.
- [ ] **Révision des versions consolidées.** Une version consolidée ne suit pas le chemin de
      révision (elle est publiée avec l'acte modificatif qui l'a produite). Le rapport de
      conformité pourrait néanmoins être établi pour l'acte modificatif, qui, lui, est révisé.
- [ ] **compétence par bureau sur le compte.** La compétence d'un compte se règle aujourd'hui par
      service, famille, trame, type d'acte et entité ; le **bureau** n'est réglable que sur la
      qualité portée par un service. Un ciblage par bureau côté compte compléterait la finesse.
- [ ] **Notification du valideur.** Le journal prévient d'un dépôt au parapheur,
      mais rien n'est envoyé par courriel : il faudrait un envoi réel (service de
      messagerie) ou un résumé quotidien.
- [ ] **Journal : export et rétention.** Le journal d'audit est consultable et
      filtrable ; l'export (CSV/JSON), la rétention légale et la purge ne sont pas
      outillés.
- [ ] **Recherche : index inversé et recherche floue.** L'index est construit en
      mémoire à l'ouverture et la recherche est par sous-chaîne (accents
      normalisés). Un index tolérant aux fautes serait plus confortable sur un
      gros registre.
- [ ] **Verrou de rédaction strict.** Le verrou actuel est SOUPLE : il avertit, il
      n'empêche pas. Un verrou exclusif (avec expiration) serait la suite, au prix
      d'un risque de blocage si un poste meurt.

## Édition statique (livrée — suite possible)

Livré : service **hébergé dans la page** (`src/pages/host.js` : `root.kv` sur IndexedDB, et
le script serveur d'`index.html` relu dans le DOM puis exécuté avec un état durable),
résolution unique des services (`src/lib/hosts.js`), `index.html` autonome (`<!doctype html>`,
`viewport`, titre), libellé du mode adapté. Toute la chaîne (dépôt → signature ECDSA →
publication → ELI) fonctionne sans serveur, y compris après rechargement.

- [ ] **Partage entre postes.** L'état du service embarqué vit dans le navigateur : deux
      personnes sur la même démonstration ne voient pas le même référentiel. Un service
      hébergé ailleurs (le déploiement `src/server/`, ou une API publique) le permettrait :
      il suffit de poser `window.__SCRIBA_SELF_HOSTED__` et l'adresse avant `host.js`.
- [ ] **Bandeau « démonstration statique ».** Signaler dans l'interface que rien n'est
      partagé (aujourd'hui : le libellé du mode de persistance seulement).
- [ ] **L'état durable de l'émulateur de serveur de l'ÉDITEUR se réinitialise.** Ce n'est pas
      le logiciel : c'est l'émulateur à une tabulation (générateur non enregistré) qui, au-delà
      d'une ou deux publications (chaque enregistrement porte le document publié, l'Akoma
      Ntoso, le JSON-LD, le Markdown, le texte et la page de l'original signé), rend un état
      illisible au chargement suivant — « État illisible, réinitialisation » — et repart à
      vide. Conséquence visible : dans l'APERÇU, le recueil public se vide après un
      rechargement, alors que le registre local dit toujours les actes publiés. Le générateur
      enregistré (service « natif ») et l'auto-hébergement (MariaDB, `sb_etat`) ne sont pas
      concernés. Signalé à la plateforme (rapport `cc69c32c`). Rien à corriger côté Scribae en
      attendant : re-publier un ou deux actes pour regarnir l'aperçu.

## Auto-hébergement (chantier livré — suite possible)

Livré : pile Docker à trois conteneurs (nginx + service Node + MariaDB, réseau interne,
API non publiée), édition web de l'application (`server/web/` : `root.kv` sur IndexedDB,
transport HTTP de `remote.js`), **service unifié** (données `/v1/db/…` et
signature/publication `/v1/…`), état du service en base (`sb_etat`), documentation
d'administration (`docs/ADMINISTRATION.md`) et d'installation (`server/README.md`).

Reste à faire, par ordre d'importance :

- [x] **SSO / annuaire (livré — OIDC).** Le référentiel peut brancher l'annuaire de la
      collectivité en OpenID Connect (`config.auth`, `src/lib/oidc.js`, onglet
      **Administration › Annuaire (OIDC)**) : flux code d'autorisation + PKCE, vérification du
      jeton (émetteur, audience, validité, nonce, signature JWKS), groupes → rôles,
      périmètre par revendications, reprise ou création des comptes. Le brancher **désactive
      automatiquement les comptes de démonstration**, de façon réversible (`syncDemoAccounts`).
      Reste possible, non fait : SAML (les collectivités en ont encore), déconnexion fédérée
      (`end_session_endpoint`), et rafraîchissement de session par `refresh_token`.
- [ ] **Rôle d'administrateur par annuaire.** Aujourd'hui l'écran « Comptes et rôles »
      reste la main sur les comptes pré-enregistrés ; un annuaire qui n'annonce aucun groupe
      utile oblige à choisir « refuser » ou un rôle de repli global. Des règles par groupe
      plus fines (plusieurs correspondances, exceptions) seraient la suite logique.
- [ ] **Jeton client non public.** Le jeton d'écriture est injecté dans `config.js`, donc
      servi à tout visiteur ; il faudrait l'échanger contre un jeton de session après
      authentification (l'annuaire donne maintenant l'identité de départ).
- [ ] **TLS fourni.** La pile s'arrête à HTTP ; le reverse-proxy TLS est à la charge de
      l'exploitant (un profil Caddy/Traefik pourrait être fourni).
- [ ] **Sauvegarde outillée.** Fournir un service de dump planifié avec rotation, plutôt que
      de laisser la commande dans la documentation.
- [ ] **Sonde de supervision** dédiée (et non `/v1/db/health`, qui interroge la base).
- [ ] **Migrations versionnées.** `schema.sql` est idempotent mais sans numéro de version ;
      une table de migrations rendrait les évolutions traçables.

## Base de données (chantier livré — suite possible)

Livré : façade de persistance à trois pilotes (local / service partagé / serveur
MySQL-MariaDB), synchronisation par enregistrement avec révisions et conflits,
miroir hors ligne, file d'écritures différées, écran **Administration › Base de
données**, service de données Node + `schema.sql` dans `src/server/mysql/`.

Reste à faire, par ordre d'intérêt :

- [ ] **Écriture hors ligne : prévenir plutôt que réconcilier.** Aujourd'hui un
      conflit de rejeu est signalé et la version de la base gagne. Une vraie
      fusion par champ (par `updatedAt`) serait plus juste pour les objets
      longs, mais demande une politique de fusion par type d'objet.
- [~] **Journal lisible dans l'application (partiellement livré).** Le **journal
      d'audit de l'application** (Administration › Journal d'audit) est consultable et
      filtrable, et la collection `journal` est synchronisée. Ce qui manque est le
      journal **technique** de la base (`sb_journal`, côté MySQL) : les collections
      `presence` et `journal` n'y sont plus recopiées (c'était du bruit), mais il
      n'existe toujours pas de route `GET /v1/db/journal` pour lire `sb_journal`
      sans SQL. À ajouter si la piste d'audit doit couvrir aussi les écritures
      faites hors de l'application.
- [ ] **Normalisation optionnelle pour le reporting.** Les colonnes indexées
      (`numero`, `statut`, `service_id`…) suffisent aux recherches courantes ;
      un entrepôt (fait, articles) demanderait des tables normalisées alimentées
      par le même point d'écriture.
- [ ] **Verrouillage du réglage.** Aujourd'hui tout administrateur peut changer
      le mode de persistance depuis son poste. En exploitation, ce réglage
      mériterait d'être protégé (mot de passe, ou fourni par le déploiement).
- [ ] **Pilote local plus riche.** Le mode local repose sur le stockage du
      navigateur (IndexedDB). Un pilote SQLite/OPFS donnerait des requêtes locales — utile
      seulement si le mode local devait devenir autre chose qu'une démonstration.

## Éditeur de trame : l'intuitivité (chantier en cours)

Le public visé n'a **aucune compétence informatique**. La règle de conception est écrite dans
`src/README.md` (« L'éditeur de trame : glisser-déposer, jamais liste déroulante ») : montrer
plutôt que nommer, glisser plutôt que choisir dans une liste. Livré en v1.1.0 : la réserve, le
glisser-déposer, le geste de repli au clic, les cartes de type, les questions repliables et les
onglets renommés. Restent ouverts :

- [ ] **Un premier pas guidé.** À l'ouverture d'une trame neuve, dire quoi faire (« prenez un
      intitulé dans la réserve », « créez votre première question ») plutôt que de montrer un
      squelette silencieux.
- [ ] **Créer une trame sans formulaire.** La fenêtre « Nouvelle trame » demande encore une
      **famille** et un **type d'acte** en listes déroulantes : les proposer en cartes, ou les
      déduire d'un modèle de départ.
- [ ] **Modèles de départ de trame** (arrêté individuel, décision, délibération…) : partir d'un
      exemple est plus simple que d'un document vide.
- [ ] **Ranger les questions par groupe.** Les groupes existent dans le modèle (`field.group`) et
      organisent le formulaire du rédacteur, mais l'onglet « Questions » les ignore encore.
- [ ] **Annuler / rétablir** dans l'éditeur de trame : supprimer un bloc est aujourd'hui
      définitif — la corbeille de l'accueil ne rattrape qu'une *trame*, jamais un bloc.
- [ ] **Le geste tactile.** Le glisser-déposer HTML5 **ne fonctionne pas au doigt** (ni sur iOS,
      ni de façon fiable sur Android) : c'est le geste de repli (clic, puis clic) qui couvre les
      tablettes. Le mériterait : un glisser fondé sur les *pointer events*, dans `src/ui/dnd.js`.
- [ ] **Le glisser dans le rédacteur** (`views/wysiwyg.js`) : l'éditeur de trame glisse, la
      rédaction non — les mêmes primitives y serviraient.

## Autres chantiers (déjà listés dans SPEC § 5)

- [ ] Export PDF/A certifié (chaîne à valider par veraPDF).
- [ ] **Word `.docx` / PDF natif.** L'export Word livré est un `.doc` (HTML balisé pour Word,
      section A4) : un `.docx` natif, et un PDF produit sans passer par l'imprimante du
      navigateur, restent à faire.
- [ ] Signature réellement qualifiée (brancher le prestataire de la collectivité).
- [ ] Bibliothèque de trames partagée par URL publique.
- [x] **Gestion des feuilles de style des actes.** Livré : `src/lib/styles.js` (modèle,
      résolution trame → entité → famille → feuille générale, préréglages, CSS) et l'écran
      `src/ui/views/styles.js` (`trames.styles`) — feuille générale + sous-feuilles rattachées
      à des entités/familles, **marges de page**, cadre de page, typographie fine (interlettrage,
      retraits, coupure des mots), intitulé, formule d'autorité, visas et considérants, filets,
      listes, formule d'édiction, mentions, tableaux, signature, logo, en-tête, pied, couleur —
      plus **l'édition directe du style** (on clique l'élément dans l'aperçu : WYSIWYG sur le
      style uniquement), les **modèles de départ** (`STYLE_PRESETS`), l'aperçu en direct et
      l'export/import JSON. Pistes : charte par **service** (aujourd'hui entité et famille
      seulement), polices embarquées dans `src/assets/`, en-tête/pied répétés à chaque page
      imprimée (`@page` margin boxes, non supportées par tous les moteurs), **numérotation des
      pages**, filigrane (« COPIE », « EXPÉDITION »), charte différente pour la première page.
- [x] **Apparence claire / sombre.** Livré : `src/lib/theme.js` (préférence de poste rangée
      dans le navigateur, `auto`/`light`/`dark`, application avant tout rendu depuis
      `index.html`), palettes dans `src/css/app.css` (jetons `[data-theme="dark"]`), bouton dans
      l'en-tête et choix dans le menu du compte (`src/ui/theme.js`) ; la couleur de marque est
      éclaircie en mode sombre (`--brand`) tandis que le papier reste blanc (`--brand-light`).
      Piste : mémoriser la préférence **par compte** (aujourd'hui par poste/navigateur), pour
      la retrouver en changeant de machine.

## Jeu de démonstration (livré — pistes)

Livré : `src/lib/demo-actes.js` pose **quinze actes** au premier démarrage, dont **dix signés**
(vérifiables) — trois d'entre eux illustrent la **révision** (un acte en attente, un acte révisé
et validé, un acte rejeté, revenu en brouillon), et deux sont des **actes individuels non
publiables** (trame `tpl-revalorisation`, `publishable: false`). Le jeu est remis à niveau quand `SEED_VERSION` change, et
seulement si les trames et les actes sont ceux de la démonstration (trames `tpl-*`, actes
`acte-demo-*`) : un registre réel n'est jamais touché.

- [x] **Publications de démonstration.** Fait : `src/ui/demo-publications.js` (`amorcerRecueil`)
      publie au premier démarrage les actes que la fiction déclare publiés, par le même chemin
      que l'écran de signature, pour que le **recueil public** soit garni. Idempotent et
      silencieux ; un service injoignable le laisse simplement vide.
- [~] **Retirer une publication du recueil** (dépublier) — **livré dans l'application**, **reste à
      porter au service auto-hébergé**. L'écran **Publications (ELI)** porte le retrait sous la
      permission `publications.depublier` (administrateur seul) : avertissement en grand, **motif
      technique obligatoire**, motif conservé sur l'acte et inscrit au **journal** d'audit
      (`publication.depublie`), l'acte redevenant *signé*, donc publiable à nouveau ; le **service
      de l'environnement d'édition** (index.html) expose la route
      `POST /v1/publications/{cle}/retrait`. Ce qui manque : le **service Node/MySQL**
      (`src/server/mysql/actes.mjs`) n'expose pas cette route — sur une pile auto-hébergée, le
      geste aboutit à une erreur. À ajouter là-bas (même règle : motif exigé, trace au journal,
      l'acte redevient *signé*), et à couvrir par `actes.test.mjs`.
- [ ] **Actes de démonstration plus variés.** Le jeu couvre sept trames (nomination,
      délégation, permis de construire, marché d'un établissement autonome, régie, subvention,
      revalorisation/non publiable) ; ajouter des trames (état civil, voirie, marchés publics de
      la commune) donnerait des actes encore plus divers.
- [ ] **Réinitialiser le jeu de démonstration** depuis le référentiel (bouton « Réinstaller le
      jeu de démonstration »), plutôt que de dépendre d'un changement de `SEED_VERSION` ou de
      `clearAll()`.
