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
  (`src/lib/historique-brouillons.js`, vingt versions, restauration).
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
- [ ] **Notification du valideur et résumés.** Le service sait désormais envoyer un courriel
      (voir « Le courriel » ci-dessous) et le parapheur est branché sur la politique de
      notification ; en revanche, il n'y a pas de **résumé quotidien** ni de **relance**
      automatique des formalités en retard : un envoi par événement, à l'instant du geste, voilà
      tout ce qui existe.
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
- [ ] **L'état durable de l'émulateur de serveur de l'ÉDITEUR ne survit pas à tout.** Ce n'est
      pas le logiciel : c'est l'émulateur du générateur non enregistré, dont la mémoire durable
      est recopiée à des moments que nous ne maîtrisons pas (un instantané prélevé pendant
      l'écriture donne un document tronqué), et dont le budget de calcul par requête est serré.
      Mesuré : l'amorçage du recueil passe une quinzaine de publications puis l'émulateur se met
      en quarantaine ; chaque publication pèse ~65 Ko d'état. **Corrigé côté Scribae** : l'écriture
      de l'état marque sa version en DERNIER geste (un instantané pris au milieu se reconnaît sans
      relecture), la lecture contrôle l'en-tête, l'échappement ASCII se fait par plages, et
      l'amorçage s'étale (pause entre deux actes) — voir le détail au § « Jeu de démonstration ».
      Conséquence visible, résiduelle : dans l'**APERÇU**, le recueil public peut être partiel ou
      se revider après un rechargement, alors que le registre local dit toujours les actes publiés.
      Le générateur **enregistré** (service « natif ») et l'**auto-hébergement** (MariaDB,
      `sb_etat`) ne sont pas concernés — et l'**édition statique** (`src/pages/host.js`, IndexedDB,
      sans budget de calcul) publie les quinze actes en treize secondes et les conserve d'un
      rechargement à l'autre : c'est cette forme-là qu'il faut montrer.

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
- [x] **Comptes locaux (mot de passe) sans annuaire (livré).** `AUTH_MODE=password` dans le `.env` :
      comptes vérifiés par le service (dérivé `scrypt`, blocage après échecs, comparaison à temps
      constant), session dans un cookie `HttpOnly` + jeton anti-CSRF, compte d'administration créé
      depuis le `.env`, administration des mots de passe depuis *Comptes et rôles*, mode
      démonstration réglable (`DEMO_ACCOUNTS`). Banc d'essai : `src/server/mysql/comptes.test.mjs`
      (27 épreuves, `npm test`). Reste possible : réinitialisation par l'agent (lien à usage unique
      par courriel — le service de courriel est désormais là, § « La signature simple et le
      courriel »), second facteur (TOTP), journal des connexions, et purges planifiées de
      `sb_session`.
- [ ] **Éprouver la suite de tests Node depuis un vrai Node.** `comptes.test.mjs` a été vérifié
      ici avec un substitut de `node:crypto` (le domaine, lui, est éprouvé), mais
      `npm test` dans `src/server/mysql` n'a pas pu être lancé dans l'atelier : à faire au premier
      `npm install` sur un poste.
- [ ] **La marque du recueil public avant la session.** En mode `password`, le référentiel n'est pas
      lisible avant la connexion : le recueil public (qui, lui, reste ouvert — `/v1/publications`
      l'est aussi) s'affiche donc avec la marque par défaut au lieu de celle de la collectivité. Le
      service pourrait rendre `marque` (nom, sous-titre, logo) dans `GET /v1/auth/config`, comme le
      prévoit déjà `src/ui/state.js` (`appliquerMarqueDeploiement`).
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
- [x] **Le geste tactile.** **Livré** : le glisser-déposer ne repose plus sur l'API HTML5 — qui ne
      fonctionne pas au doigt — mais sur les **pointer events** (`src/ui/dnd.js`, moteur commun à
      la réserve, aux blocs, aux questions et à la rédaction). Les poignées ⠿ portent seules
      `touch-action: none` : le contact y saisit, partout ailleurs le doigt fait défiler. Voir
      aussi la prise élargie : le bloc entier se saisit, plus seulement sa poignée.
- [x] **Le glisser dans le rédacteur** (`views/wysiwyg.js`) : **livré**. Chaque bloc du document
      (article, division, visa, considérant, mention) porte une poignée et deux flèches, et se
      prend aussi par son **numéro** — la prise naturelle : « cet article-là ». Le dépôt se lit
      « avant / après » selon la moitié survolée, et la renumérotation suit l'ordre imprimé
      (voir `src/lib/ordre.js`, et le paragraphe « Réorganiser le document » de `SPEC.md`).
- [x] **Chaque bloc a ses propres réglages — et les tableaux se remplissent.** **Livré** : un
      paragraphe, une liste, un tableau, des considérants portent désormais leurs paramètres
      (`src/lib/schema.js`, `paramsBloc` — alignement et alinéa du paragraphe, encadré ; puces ou
      numéros, marqueur, numérotation, départ de la liste ; disposition, alignement, en-tête et
      position de la légende du tableau ; formule et ponctuation des considérants), rendus à
      l'identique dans l'aperçu de l'éditeur, l'aperçu compilé, l'atelier de rédaction et les
      exports. Un tableau se remplit **case par case** et sa grille s'ajuste (ajouter ou retirer
      une ligne, une colonne) dans l'éditeur (`views/editor.js`, `tableGridEditor`) ; une liste
      gagne ou perd ses éléments d'un clic. Côté rédaction, ces réglages se posent par bloc
      (« Mise en forme », `views/rediger.js`) et s'écartent du modèle comme les autres valeurs.

## Documents longs, annexes et réorganisation (chantier livré — suite possible)

Livré ensemble, parce que les trois répondaient à la même rigidité : le document n'était qu'une
suite d'articles, il ne se réordonnait pas, et il ne connaissait pas l'**annexe** — un document
adopté par un autre, dont le texte suit l'acte qui l'adopte. Ce qui est en place :

- **Division** (Livre, Titre, Chapitre, Section…) avec son **échelle par trame**
  (`trame.divisions`, `NIVEAUX_DEFAUT`, `src/lib/schema.js`) ; blocs imbriqués, numérotation
  par échelon avec remise à zéro (`src/lib/compile.js`), rendu (`src/lib/render.js`), exports
  Akoma Ntoso et Markdown récursifs (`src/lib/export.js`), relecture (`src/lib/akn.js`) ;
  éditeur de trame (`src/ui/views/editor.js` : palette « Division », plan imbriqué, inspecteur
  d'échelon, onglet « Trame »).
- **Réorganisation** (`src/lib/ordre.js`, `src/ui/views/wysiwyg.js`) : l'ordre vit dans
  `values.__ordre` (un rang par conteneur), jamais dans la trame ; renumérotation après
  réordonnancement ; signalement dans « Contrôle & écarts » et retour au modèle d'un clic.
- **Annexes** (`src/lib/annexes.js`, `src/lib/annexe-docs.js`, `trame.nature`, `trame.adoptionVisa`) :
  acte d'adoption désigné à la rédaction, visa d'adoption en tête des visas de l'annexe, liste des
  annexes en fin de dispositif de l'acte adoptant, **partie annexée** écrite à la suite de la
  signature de l'acte d'adoption (écran, exports, original signé, version publiée — l'annexe ne se
  signe ni ne se publie pour elle-même), encarts sur les fiches et dans la version en ligne, et
  **modification par adoption** d'une nouvelle rédaction en suivi des modifications
  (`src/lib/amend.js`, `src/ui/views/modifier.js`). Une annexe ne porte **ni autorité compétente ni
  mention de publication au recueil** (son document est celui d'un texte adopté, non d'un acte qui
  émane d'une autorité et se publie) : `compile()` les en écarte, et **conserve les visas**.
  L'annexe déclarée **Règlement** reçoit en outre une **publication informative autonome** — voir
  la section suivante.

Restent ouverts :

- [ ] **Réordonner dans l'écran « Modifier ».** L'atelier de rédaction réordonne ; la
      modification d'un acte **publié** ne le fait pas. Ce n'est pas le même geste : déplacer un
      article d'un acte en vigueur est une **modification de structure**, qui se dit (« les
      articles 3 à 5 deviennent les articles 1 à 3 ») et se consolide. À concevoir comme tel —
      et non en réutilisant `values.__ordre`, qui range un brouillon. La modification **atteint**
      désormais les articles rangés en divisions (`flatNodes`), mais elle ne **réécrit pas
      l'intitulé d'une division** : modifier un Titre, ou déplacer une section, serait la suite
      logique.
- [x] **Les annexes dans le recueil public (règlements).** Fait pour les **règlements** : une annexe
      déclarée `trame.reglement` est publiée **à part** au recueil, à titre informatif, sous son
      propre identifiant `eli:/fr/reg/…` (charge de publication portant `informative` et `adoption`,
      `hPublier` dans `src/server/mysql/actes.mjs` et `index.html` ; page informative dans
      `src/lib/eli.js` et `src/ui/views/acte-publie.js` — voir la section « Les règlements »).
- [ ] **Remonter de l'acte à ses annexes ordinaires, depuis le recueil.** Une annexe **non
      règlement** reste absente du recueil autrement que par le texte de l'acte d'adoption : le
      **registre public** ignore encore le lien `annexes`, et l'on ne peut pas remonter de l'acte à
      ses annexes depuis le recueil. Il faudrait rendre `annexes` dans `src/lib/recueil.js` et les
      présenter (une liste, un encart).
- [ ] **Abroger une annexe.** L'abrogation d'un acte (`src/lib/abrogations.js`) ne dit rien des
      annexes : qu'advient-il du règlement intérieur quand la délibération qui l'a adopté est
      abrogée ? La question est juridique avant d'être technique.
- [ ] **Relire le texte des annexes à l'import.** Un fichier Akoma Ntoso d'acte d'adoption est
      suivi du texte de ses annexes (`<attachments>`), mais `src/lib/akn.js` ne les **compte** que
      pour avertir le lecteur : il ne les rattache pas, parce qu'une annexe est ici un acte à part
      joint depuis le registre (et parce que le texte annexé est écrit « à plat », sans marqueur de
      nature qui permettrait de le relire fidèlement — intitulé, visas et formule d'édiction
      redeviennent des paragraphes). Pour aller plus loin : marquer la nature des blocs dans
      `<attachments>` à l'export, puis les relire et les rattacher à l'acte importé.

- [x] **Un jeu de démonstration pour ces deux nouveautés.** Livré : deux trames (`tpl-deliberation`
      et `tpl-reglement-int`, cette dernière de nature `annexe` et rangée en Titres / Chapitres)
      et **deux actes** qui les emploient — une délibération adoptant le règlement intérieur, et
      le règlement lui-même, adopté par la délibération : **l'original signé de la délibération est
      suivi du texte du règlement**, et l'annexe n'est ni signée ni publiée pour elle-même
      (`acte-demo-416` / `acte-demo-417`). La démonstration *montre* le mécanisme (visa d'adoption,
      liste des annexes, partie annexée, encarts des fiches, divisions) au lieu de le décrire.

## Les règlements : la publication informative autonome (livré — suite possible)

Livré : une annexe peut être déclarée **RÈGLEMENT** sur sa trame (`trame.reglement`, case de
l'onglet « Trame »), et elle est alors **publiée à part au recueil, à titre informatif**, sous son
propre identifiant stable (`eli:/fr/reg/…`). C'est la réponse à un vrai besoin : un règlement
intérieur est un texte **normatif**, qui se consulte pour lui-même, comme un **code**, et non
seulement dans la délibération qui l'a adopté. Ce qui est en place :

- **Le drapeau** (`src/lib/schema.js`, `src/lib/trame-format.js`, `src/ui/views/editor.js`) ;
  `estReglement` / `estReglementActe` (`src/lib/annexes.js`).
- **La publication** (`publierReglements`, `src/ui/views/signature.js`) : à la publication de l'acte
  qui l'adopte, la version en vigueur du règlement est déposée sous `informative: true`, **sans
  original**, sous un identifiant **minté une fois puis conservé** sur l'annexe — les publications
  successives en sont les **versions**. Côté service, `hPublier` accepte l'absence d'original, laisse
  l'état de l'acte déposé intact, et rend `informative` / `adoption` (`src/server/mysql/actes.mjs` et
  `index.html`).
- **Le document** : `compile()` écarte l'autorité et la mention de publication d'une annexe, et
  conserve les visas ; `buildWebVersion` (`src/lib/eli.js`) et la notice (`acte-publié.js` donnent
  une page **informative** — pas d'opposabilité, pas de « publié le », pas d'original, mais
  l'identifiant, le thème et l'acte qui l'adopte.
- **Le jeu de démonstration** : deux règlements (règlement intérieur du conseil, règlement d'accès à
  la restauration scolaire), avec autorité et mention de publication retirées de leurs trames
  (`src/lib/seed.js`).

Restent ouverts :

- [ ] **Consolider un règlement modifié.** Quand un acte modificatif **adopte une nouvelle
      rédaction** d'un règlement, la publication du règlement doit repartir sous le **même ELI** —
      c'est `publierReglements` qui doit le déclencher à la publication du modificatif (aujourd'hui
      elle se déclenche à la publication de l'acte d'adoption, le même chemin devant couvrir ce
      cas). À **éprouver de bout en bout** : délibération → règlement publié à part → modification →
      nouvelle version sous le même identifiant, l'ancienne restant dans l'historique des versions.
- [ ] **Un lien direct de la notice du règlement vers l'acte d'adoption** (aujourd'hui l'acte
      d'adoption est nommé dans la méta, mais pas encore cliquable depuis le recueil).
- [ ] **Règlement et abrogation.** Voir « Abroger une annexe » ci-dessus : que devient le règlement
      publié à part quand la délibération qui l'a adopté est abrogée ? La question est **juridique**
      avant d'être technique — un règlement publié pour lui-même pourrait survivre à son acte
      d'adoption, ou devoir disparaître avec lui.

## Circuit de signature externe (livré — suite possible)

Livré : le second circuit de signature, celui qui n'appelle **aucune API** (`src/lib/externe.js`),
réglable globalement et par trame (imposé / autorisé) ; la remise du document prêt à signer
(bordereau de remise téléchargé), le dépôt de la **version signée** (PDF, empreinte SHA-256,
`upload-plugin`), la **certification de conformité** du réviseur (avec sa file dans l'onglet
Révision et sa visibilité hors périmètre), les garde-fous du service
(`409 version_signee_absente` / `conformite_non_certifiee` / `certification_incoherente`) et la
présentation du **PDF signé comme « original »** sur le recueil public. Voir `SPEC.md` § 2.6 ter.
Le **troisième** circuit — la signature **simple**, donnée dans l'application — est décrit plus
bas (« La signature simple »).

Restent ouverts :

- [ ] **Plusieurs signataires dans le circuit externe.** Le dossier ne connaît qu'**une** pièce
      signée : un acte qui se signe à deux mains (le maire et le préfet, un président et un
      directeur) se signe sur un seul document papier, mais l'application ne sait pas le dire —
      elle n'enregistre qu'un fichier, sans la liste des signataires attendus. Il faudrait
      reprendre la chaîne de signature de `src/lib/signataires.js` et attester, signataire par
      signataire, la présence de la signature sur la pièce.
- [ ] **Lire le PDF signé.** La version signée est conservée et montrée, mais son **texte** n'est
      pas extrait : ni recherche dans la pièce, ni comparaison automatique avec le texte numérique
      (le réviseur compare à l'œil, et l'empreinte ne porte que sur le fichier). Un dépliage
      (pdf.js ou équivalent) permettrait de rapprocher automatiquement les deux textes et de
      signaler au réviseur les passages divergents.
- [ ] **Signature par outil tiers avec API.** Le circuit externe couvre le papier et les outils
      **sans** API. Un outil tiers qui, lui, en a une (mais différente du prestataire branché)
      demanderait un troisième chemin — ou, plus proprement, une **passerelle** déclarée dans le
      référentiel (comme la numérotation, § « La numérotation »).

## La signature simple et le courriel (livrés — suite possible)

Livré : le **troisième circuit**, la signature électronique **simple** (`niveau: "simple"` dans
`src/lib/externe.js`), où le signataire signe **dans l'application** avec son compte — fenêtre de
signature (document, identité, empreinte, déclaration à cocher), paquet signé identique en
cryptographie à celui du circuit électronique, vérification d'empreinte par le service, et
réglage global ou par trame (`simple_impose`, `simple_autorise`). Livré aussi le **partage de
l'original en deux parts** (`partiePublique` / `dossierInterne`, `src/lib/signature.js`) : la part
**interne** — mentions nominatives et trace des courriels — est rangée au registre et servie par
la seule route protégée `GET /v1/actes/{id}/dossier-signature`. Livré enfin le **service de
courriel** : moteur SMTP sans dépendance (`src/server/mysql/smtp.mjs`), `SMTP_*` du `.env`,
politique de notification dans le référentiel (six événements), traçage des envois manqués au
journal **et** sur l'acte, écran Administration › Courriel (état, message d'essai, derniers
envois, table `sb_courriel`). Voir `SPEC.md` § 2.6 quater et § 2.6 quinquies.

Restent ouverts :

- [ ] **Plusieurs signataires dans la signature simple.** La fenêtre ne recueille qu'**une**
      signature, celle du signataire désigné. Un acte signé à plusieurs mains demanderait une
      **liste ordonnée** de signataires, chacun signant à son tour (le document ne partant en
      publication que lorsque le dernier a signé) — la chaîne de `src/lib/signataires.js` en
      donne déjà l'ordre.
- [ ] **Moyens d'authentification plus forts.** `dossierSignatureInterne` constate aujourd'hui
      « compte de l'application — session ouverte ». Le même champ accueillerait sans changement
      un **facteur d'authentification** (TOTP, clé de sécurité, fournisseur d'identité) : c'est
      le naturel d'un procédé dont la valeur probante tient à la solidité de l'identification.
- [ ] **Modèles de message.** Les six notifications ont un sujet et un corps **écrits dans le
      code** (`src/lib/courriel.js`), en texte et en HTML. Des **modèles éditables** dans le
      référentiel — avec variables — les rendraient adaptables sans toucher au code.
- [ ] **File d'attente des envois.** Un courriel qui échoue est tracé, mais **pas rejoué** : un
      serveur de messagerie momentanément indisponible demande une relance manuelle. Une file
      (avec tentatives espacées) le rendrait plus robuste.

## Commentaires de trame (livré — suite possible)

Livré : le commentaire se pose **sur ce qu'on voit** (bouton sur chaque bloc, ou passage sélectionné
dans la page et cité par la pastille « Commenter »), il **s'affiche dans la page** sous le bloc
visé (bande distincte, repère de marge numéroté), l'onglet « Commentaires » les rassemble par bloc,
et le **rédacteur** les lit en consignes sous le passage concerné (onglet « Consignes », compteur
d'en-tête). Voir `SPEC.md` § 2.2.5 et `src/ui/annotations.js`.

Restent ouverts :

- [ ] **Répondre à un commentaire (fil).** Un commentaire est une note isolée : on ne peut pas y
      répondre. Un fil (réponses datées, chacune signée de son service) serait la suite logique
      pour les points à arbitrer, qui se discutent avant d'être tranchés.
- [ ] **Marquer un commentaire comme traité.** Rien ne distingue une consigne appliquée d'une
      consigne en attente : une case « traité » (par qui, quand) permettrait de relire une trame
      en ne voyant que ce qui reste ouvert.
- [ ] **Commenter dans la modification d'un acte publié.** L'atelier de rédaction affiche les
      consignes de la trame ; l'écran « Modifier » (acte en vigueur, `views/amend-editor.js`) ne
      les affiche pas encore — la question se pose pourtant, la modification s'expliquant souvent
      par un commentaire du réviseur.
- [ ] **Le passage cité, suivi dans le temps.** Un commentaire garde le texte qu'il citait
      (`quote`) ; si la phrase est ensuite réécrite dans la trame, le lien devient indicatif. Un
      rapprochement (ou un avertissement « le passage cité a changé ») serait plus fidèle.

## L'atelier de rédaction : le document comme formulaire (chantier livré — suite possible)

Livré : la **bibliothèque de variables** (en haut du panneau de droite, `src/lib/auto-tokens.js` +
`src/ui/views/rediger.js`), glissable dans le document ou posable au clic (`insererJeton`,
`src/ui/views/wysiwyg.js`) ; l'onglet **« Bloc »** ouvert en cliquant un morceau du document
(intitulé, numérotation, échelon, éléments, ajouts, retrait) ; la **suppression d'un bloc ou d'un
élément d'un clic** et leur **ajout** (bloc, paragraphe, visa, considérant, ligne de liste) ; les
outils posés sur **chaque** bloc, y compris ceux d'un article. Le tout vit dans
`src/lib/structure.js` (`values.__supprimes`, `values.__ajouts`) et ne touche jamais la trame.
Voir `SPEC.md` § 2.4.2. Un ajout peut aussi être un **bloc de texte hors article** (paragraphe,
liste, tableau dans le corps ou dans une division) : il sort désormais dans **tous** les formats,
Markdown et Akoma Ntoso compris (`exportMarkdown`/`exportAkn`, relu par `src/lib/akn.js`).

Restent ouverts :

- [ ] **La grille d'un tableau, dans l'atelier.** Une cellule se réécrit, la présentation du
      tableau se règle (« Mise en forme »), mais la grille elle-même (nombre de lignes et de
      colonnes) ne se règle que dans la trame — où elle est désormais complètement éditable. Le
      mécanisme d'ajout côté atelier (`structure.js`, adresses `body.5.rows.0.2`) est en place :
      il reste à lui donner les mêmes gestes (« ajouter une ligne après celle-ci »), et à décider
      ce qu'une colonne ajoutée fait aux lignes existantes.
- [ ] **Créer un champ depuis la rédaction.** La bibliothèque ne propose que les champs de la
      trame. « Il me faudrait un montant ici » est un besoin réel, mais il **modifie le modèle** :
      cela suppose une écriture sur la trame (avec ses droits et sa traçabilité), ou une
      proposition d'évolution soumise aux administrateurs — non un ajout dans le document.
- [ ] **Commenter ce qu'on a soi-même ajouté.** Les consignes de la trame se lisent sous le
      passage ; un bloc **ajouté par la rédaction** ne peut pas recevoir de commentaire (il n'est
      pas dans la trame, donc pas dans l'onglet « Commentaires » de l'éditeur). Utile pourtant :
      « ce paragraphe est à confirmer par le service instructeur ».
- [ ] **Les mêmes gestes dans l'écran « Modifier ».** L'ajout et le retrait d'un passage existent
      déjà dans la modification d'un acte publié (`views/amend-editor.js`), mais le panneau de
      droite n'y a ni « Bloc » ni bibliothèque de variables. L'unification des deux ateliers
      (mêmes composants, mêmes gestes) est la suite logique.
- [ ] **La mise en forme des blocs dans l'écran « Modifier ».** La modification d'un acte publié
      rend elle-même ses listes, ses tableaux et ses paragraphes (`views/amend-editor.js`, `block`)
      et n'y applique pas les réglages du bloc : une liste « 1° », un paragraphe encadré ou un
      tableau en lignes horizontales s'y montrent comme avant. Le rendu manque aussi la légende
      au-dessous et l'absence de ligne d'en-tête (sa ligne d'en-tête porte l'outil « ajouter une
      ligne »). À aligner sur `views/wysiwyg.js` (qui, lui, applique déjà `paramsBloc`).
- [ ] **Regrouper des articles dans une division nouvelle.** On ajoute une division **vide** et on
      y glisse les articles un à un ; créer la division **autour** d'une sélection (« ranger ces
      trois articles en un Chapitre ») serait plus direct.

## Autres chantiers (déjà listés dans SPEC § 5)

- [ ] Export PDF/A certifié (chaîne à valider par veraPDF).
- [ ] **Import d'un document : aller plus loin dans la relecture.** La lecture directe du XML
      (`src/lib/doc-import.js`) reconnaît la structure courante d'un acte — autorité, intitulé,
      visas, considérants, formule d'édiction, articles, divisions, listes, tableaux, mention de
      recours, signature. Restent hors de sa portée : l'ancien format **`.doc`** (binaire), les
      documents qui ne marquent leurs titres que par la **mise en forme** (gras, taille) et non
      par un style de titre, les **notes de bas de page**, les **en-têtes et pieds de page**, et
      les **images** (un document fait d'une seule image est refusé, faute de texte). Le tout
      demanderait un vrai convertisseur (lecture des styles effectifs, sortie structurée) plutôt
      que la lecture XML directe.
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

Livré : `src/lib/demo-actes.js` pose **soixante-six actes** au premier démarrage, dont
**quarante-neuf signés** (vérifiables) — trois d'entre eux illustrent la **révision** (un acte en
attente, un acte révisé et validé, un acte rejeté, revenu en brouillon), deux sont des **actes
individuels non publiables** (trame `tpl-revalorisation`, `publishable: false`), et **sept** forment
le cas de l'**annexe** : un document adopté (règlement intérieur du conseil, règlement d'accès à la
restauration scolaire, grille tarifaire des services municipaux, charte de la participation
citoyenne, plan de circulation, programme et déroulé joints à une manifestation) — l'annexe n'est
ni signée ni publiée pour elle-même, son texte suit l'original signé de l'acte qui l'adopte. Le jeu
est remis à niveau quand `SEED_VERSION` change, et
seulement si les trames et les actes sont ceux de la démonstration (trames `tpl-*`, actes
`acte-demo-*`) : un registre réel n'est jamais touché.

- [x] **Publications de démonstration.** Fait : `src/ui/demo-publications.js` (`amorcerRecueil`)
      publie au premier démarrage les actes que la fiction déclare publiés, par le même chemin
      que l'écran de signature, pour que le **recueil public** soit garni. Idempotent et
      silencieux ; un service injoignable le laisse simplement vide.
      L'amorçage est en outre **repris** quelques fois, à intervalles croissants (4 s, 10 s,
      20 s, 40 s), tant qu'il reste des actes à publier : au démarrage, la page peut être
      occupée (reconstruction du jeu de démonstration, écriture d'un registre volumineux) et la
      première lecture du recueil échoue avant même d'avoir commencé — le recueil restait alors
      vide pour toute la session.
- [ ] **Les publications de démonstration déjà déposées chez le service ne se rattrapent pas.**
      `amorcerRecueil` reprend un enregistrement existant tel qu'il est (« le service est la
      source ») : une version de la démonstration antérieure au régime des annexes (SEED_VERSION
      ≤ 39) a déposé la délibération **sans** le texte du règlement, et le service, qui ne connaît
      ni la mise à jour ni la suppression d'une publication, continuera de la rendre telle quelle.
      Le registre local, lui, est bien remis à niveau. Un navigateur neuf (ou un service remis à
      zéro) part de la bonne version. À traiter si le sujet devient gênant : une route de purge
      réservée à la démonstration, ou un `dateExpression` distinct pour re-déposer.
- [ ] **Le recueil public et le texte des annexes.** Voir plus haut : `adoption` / `annexes` ne
      voyagent pas encore jusqu'au service.
- [ ] **Les recueils extérieurs ne sont pas portés par le service auto-hébergé.** Les renvois du
      recueil public (« Autres recueils », sites de référence — voir § 2.6 bis du SPEC) sont un
      réglage **côté application** (`config.publication.recueilsExternes`) et s'affichent dans la vue
      du recueil (`views/recueil-public.js`) — celle qu'on voit en démonstration. Sur une pile
      **auto-hébergée**, l'espace public est rendu par le **service** (`/recueil`, `llms.txt`,
      `recueil.json` — `src/server/mysql/actes.mjs`), qui ne connaît pas le référentiel : le bloc
      n'y figure donc pas encore. À traiter si le sujet compte : porter le réglage au service
      (dépôt `recueilsExternes` avec chaque publication, comme `recueil`/`brandName`, ou route de
      réglage du recueil), puis le rendre dans `pageRecueil` (bas de page) et `indexRecueil`/
      `llmsTxt`, et couvrir par `actes.test.mjs`.
- [ ] **Les mentions légales et d'accessibilité ne sont pas portées par le service auto-hébergé.**
      Même cause que ci-dessus : `config.publication.mentions` (voir § 2.6 bis du SPEC) est un réglage
      **côté application**, rendu par `blocMentions` dans `views/recueil-public.js` — la vue qu'on voit
      en démonstration. Sur une pile auto-hébergée, `/recueil` est rendu par le service
      (`src/server/mysql/actes.mjs`), qui ne connaît pas le référentiel : le bas de page y perd les
      mentions. À traiter avec le même dépôt que les renvois (mentions et recueils extérieurs voyagent
      ensemble : ils viennent du même écran, et se rendent au même endroit), puis à couvrir par
      `actes.test.mjs`.
- [~] **L'état du service de l'environnement d'édition ne survit pas toujours.** Corrigé côté
      **format** : le document durable du service (`index.html`, `loadDb`/`saveDb`) n'est plus
      relu corrompu — l'écriture efface la version AVANT de recopier et la rétablit en dernier
      (un instantané pris au milieu se reconnaît à sa version, sans relecture), la lecture
      contrôle l'en-tête avant toute lecture de masse, et l'échappement ASCII se fait par
      plages (l'ancienne expression régulière coûtait, à elle seule, une part du budget de
      calcul d'une requête). `GET /v1/health` publie désormais `utilise` (place occupée) à côté
      de `capacite`, pour voir venir un état trop gros.
      **Reste à creuser** : dans l'aperçu, l'amorçage du recueil s'interrompt encore parfois en
      route — le service émulé semble prélever un instantané de `state` sans égard pour le
      gestionnaire en cours, et il est tenu à un **budget de calcul soutenu** (≈ 250 ms par
      seconde). Deux mesures atténuent déjà le second point : la pause entre deux actes de
      l'amorçage (`PAUSE_AMORCAGE`) et le choix de **quinze actes publiés** plutôt que vingt-huit.
      Une troisième, mesurée, couvre le premier : la **reprise** de l'amorçage (voir ci-dessus)
      rattrape l'appel perdu quand la page était occupée — l'attente de vingt secondes de
      `ready()` (src/lib/remote.js) expire alors que le canal s'ouvre normalement, et la reprise
      suivante aboutit.
      Piste pour le premier : écrire l'état en **double tampon** (deux copies dans `state`, un
      index actif dans l'en-tête) — un instantané pris au milieu ne trouverait alors que la
      copie précédente, complète. À faire dans `index.html` **et** `src/pages/host.js`
      (`etatUtilise()` lit le même en-tête), avec les tests d'aller-retour correspondants.
      Le service enregistré (service « natif » de la plateforme) et l'auto-hébergement
      (MariaDB, `sb_etat`) ne sont pas concernés.
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
- [x] **Actes de démonstration plus variés.** Fait (SEED_VERSION 45/46) : le jeu couvre
      **vingt et une trames** et **soixante-six actes** — nomination, délégation, permis de
      construire, marché d'un établissement autonome, régie, subvention, revalorisation
      (non publiable), délibération, règlements (conseil, restauration scolaire), grille
      tarifaire, police, manifestation et événement, convention, avenant, engagement de
      dépense, occupation du domaine public, concession funéraire, environnement,
      périscolaire, charte, annexe générique. La démonstration met en avant les **annexes**
      (sept) et les **événements à venir** (fête du village, marché de Noël, cérémonie du
      11 novembre), comme une collectivité les montre.
- [ ] **Réinitialiser le jeu de démonstration** depuis le référentiel (bouton « Réinstaller le
      jeu de démonstration »), plutôt que de dépendre d'un changement de `SEED_VERSION` ou de
      `clearAll()`.
