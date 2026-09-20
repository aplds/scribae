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
- **Caractère exécutoire** — `src/lib/execution.js` (formalités requises ou non
  selon la trame, date d'exécutoire = dernière formalité requise accomplie, délai
  de recours contentieux à compter de cette date, alertes de retard) ;
  `src/ui/views/execution.js` (échéancier) ; `src/ui/execution-actions.js` (la
  constatation d'une formalité, partagée avec la fiche d'acte). Une formalité est
  une ATTESTATION de l'agent — l'application ne devine rien.
- **Registre et recherche** — `src/lib/search.js` + `src/ui/global-search.js`
  (recherche globale Ctrl+K / « / », actes, trames, personnes, services,
  références, comptes, aide) ; corbeille (`src/ui/views/corbeille.js`, suppression
  réversible `deletedAt`, restauration, suppression définitive) ; **journal
  d'audit lisible** (Référentiel › Journal d'audit) ; historique des brouillons
  (`src/lib/revisions.js`, vingt versions, restauration).
- **Collaboration** — `src/lib/collab.js` + `src/ui/collab.js` : présence des
  postes (battement 25 s, `BroadcastChannel` + sondage), verrou souple de
  rédaction (« ouvert sur un autre poste »), notifications (cloche) et journal.
  Le journal et la présence sont deux collections du contrat de persistance
  (`journal`, `presence`), sans toast de conflit et sans recopie dans
  `sb_journal` côté MySQL.

Reste à faire, par ordre d'intérêt :

- [ ] **Signer « pour ordre » / délégation.** Aujourd'hui l'étape est ouverte au
      rôle qui la porte (et à tout administrateur, comme recours en cas d'absence).
      Une vraie **suppléance** (vacances, intérim, délégation temporaire) serait la
      suite logique — avec sa trace au journal.
- [ ] **Délégation de signature dans le parapheur.** Le référentiel connaît les
      délégations de signature des actes ; le circuit ne les lit pas encore.
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

## Auto-hébergement (chantier livré — suite possible)

Livré : pile Docker à trois conteneurs (nginx + service Node + MariaDB, réseau interne,
API non publiée), édition web de l'application (`server/web/` : `root.kv` sur IndexedDB,
transport HTTP de `remote.js`), **service unifié** (données `/v1/db/…` et
signature/publication `/v1/…`), état du service en base (`sb_etat`), documentation
d'administration (`docs/ADMINISTRATION.md`) et d'installation (`server/README.md`).

Reste à faire, par ordre d'importance :

- [x] **SSO / annuaire (livré — OIDC).** Le référentiel peut brancher l'annuaire de la
      collectivité en OpenID Connect (`config.auth`, `src/lib/oidc.js`, onglet
      **Référentiel › Annuaire (OIDC)**) : flux code d'autorisation + PKCE, vérification du
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
miroir hors ligne, file d'écritures différées, écran **Référentiel › Base de
données**, service de données Node + `schema.sql` dans `src/server/mysql/`.

Reste à faire, par ordre d'intérêt :

- [ ] **Écriture hors ligne : prévenir plutôt que réconcilier.** Aujourd'hui un
      conflit de rejeu est signalé et la version de la base gagne. Une vraie
      fusion par champ (par `updatedAt`) serait plus juste pour les objets
      longs, mais demande une politique de fusion par type d'objet.
- [~] **Journal lisible dans l'application (partiellement livré).** Le **journal
      d'audit de l'application** (Référentiel › Journal d'audit) est consultable et
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

Livré : `src/lib/demo-actes.js` pose **onze actes** au premier démarrage, dont sept réellement
signés (vérifiables), trois prêts à signer et un brouillon incomplet. Deux de ces actes sont des
**actes individuels non publiables** (trame `tpl-revalorisation`, `publishable: false`), l'un
signé et l'autre prêt à signer. Le jeu est remis à niveau quand `SEED_VERSION` change, et
seulement si les trames et les actes sont ceux de la démonstration (trames `tpl-*`, actes
`acte-demo-*`) : un registre réel n'est jamais touché.

- [ ] **Publications de démonstration.** Le registre public (`GET /v1/publications`) est vide
      au démarrage : l'état du service ne survit pas à un redémarrage. On pourrait, au premier
      démarrage et si le service répond, publier deux ou trois actes de démonstration pour que
      l'écran « Publications » (côté citoyen) soit garni lui aussi — au prix d'un amorçage qui
      dépend du réseau.
- [ ] **Actes de démonstration plus variés.** Le jeu couvre cinq trames (nomination,
      délégation, régie, subvention, revalorisation/non publiable) ; ajouter des trames (état
      civil, voirie, marchés publics) donnerait des actes encore plus divers.
- [ ] **Réinitialiser le jeu de démonstration** depuis le référentiel (bouton « Réinstaller le
      jeu de démonstration »), plutôt que de dépendre d'un changement de `SEED_VERSION` ou de
      `clearAll()`.
