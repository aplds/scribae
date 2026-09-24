# TODO — chantiers ouverts

État au moment où ce fichier a été écrit. Ce qui est **fait** est décrit dans
`README.md` et `SPEC.md` ; ce fichier ne liste que ce qui reste.

## Demandes 1.6.1 (livrées en 1.6.1m)

- [x] **Les annexes ne sont plus « prêtes à signer ».** L'onglet Signature leur donne l'étiquette
      « Annexe — ne se signe pas », et elles quittent la file « Ma signature » : une annexe tient
      son autorité de l'acte qui l'adopte, et n'a rien à faire dans la file d'un signataire
      (`fileSignature`, `src/lib/signataires.js`).
- [x] **Le fil de parcours.** Les étapes d'un acte — rédaction, parapheur, révision, signature,
      publication — sont calculées une fois (`parcoursDeActe`, `src/lib/parcours.js`) et dessinées
      par un objet partagé (`bandeauParcours`, `src/ui/parcours.js`) sur la rédaction, le circuit
      de signature, le parapheur, la révision et la fiche d'un acte. Le fil montre le titulaire de
      chaque porte, les étapes du circuit **vues de l'intérieur** (nature et porteur), et la
      position de la révision («après le parapheur · avant la signature»).
- [x] **Relecture des écrans, circuit par circuit** (contre-vérification demandée après la
      livraison) : le circuit a été parcouru de bout en bout à l'écran — soumission, vérification,
      visa — et chaque étape a été regardée sur les écrans concernés. Trois défauts corrigés :
      (1) une porte **passée sans être franchie** (acte signé et publié sans trace de révision)
      s'affichait comme « la porte ouverte » — elle est désormais « **non franchie** », dans le fil
      comme dans les marches du circuit et sur la fiche (`marquerEtats`, `stepEl`) ; (2) la note du
      fil s'isolait à droite au lieu de se ranger sous les puces ; (3) le maillon « › » entre deux
      phases se retrouvait seul en tête de ligne quand le fil se replie — il appartient maintenant
      à la phase qu'il précède.

Reste ouvert :

- [ ] **Le fil de parcours au REGISTRE.** Le fil est affiché partout où l'on ouvre un acte, mais le
      **registre** (`src/ui/views/actes.js`, et `src/ui/views/corbeille.js`) n'en montre encore que
      le seul statut. Une colonne — ou une infobulle sur la pastille d'état — « porte en cours »
      éviterait d'ouvrir chaque acte pour savoir où il en est.

## Demandes 1.6.0 (livrées en 1.6.0)

- [x] **Le bulletin (ou Journal) des actes.** La collectivité **ouvre un bulletin** et lui donne
      une **cadence** (quotidienne, hebdomadaire, bimensuelle — deux numéros par mois —,
      mensuelle, bimestrielle, trimestrielle, semestrielle, annuelle, ou **personnalisée** :
      toutes les N unités, ancrée sur une date) et un **jour de parution**. Chaque numéro
      **rassemble les actes publiés sur sa période**, classés **par entité puis par thématique**,
      et **une période sans publication ne donne aucun numéro**. Le bulletin se diffuse par une
      **sous-page par numéro** au recueil public (avec `.json`, `.md`, `.txt`), par un **flux RSS
      2.0 et Atom 1.0**, et par **courriel aux abonnés** (abonnement à **double consentement**,
      désabonnement d'un clic). Le service clôt les périodes, compose les numéros et vide sa
      **file d'envoi** à chaque passe (au démarrage, puis toutes les dix minutes) ; le numéro de
      la période en cours se lit en **aperçu provisoire**, sans adresse publique, et n'est jamais
      adressé. Moteur : `src/server/mysql/bulletins.mjs` (44 épreuves avec
      `bulletins.test.mjs` et `actes-bulletins.test.mjs`), pages publiques dans
      `src/server/mysql/actes.mjs`, écran d'administration `src/ui/views/bulletin.js`,
      réglages `config.publication.bulletin`, variables `SCRIBA_BULLETIN_*` et
      `SCRIBA_PUBLIQUE_URL`.

Reste ouvert, par ordre d'intérêt :

- [ ] **Un numéro en PDF.** Le bulletin se sert en HTML, JSON, Markdown et texte, mais **pas en
      PDF** : or c'est la forme qu'une collectivité affiche, archive et joint à un courrier. Les
      pièces du projet savent déjà produire un **PDF/A** (`src/pdfa/`) ; un numéro de bulletin
      y trouverait tout naturellement sa place, avec sa page de garde et son sommaire.
- [ ] **Un bulletin par entité (ou un recueil « bis »).** Le recueil public connaît déjà les
      recueils extérieurs et les recueils « bis » (un office public de l'habitat tient ses actes
      à part) ; le bulletin, lui, n'en connaît qu'**un** par service. Une collectivité dont
      l'établissement satellite publie son propre bulletin devrait pouvoir l'ouvrir sur le même
      service, avec ses abonnés et son flux.
- [ ] **Purge des demandes jamais confirmées.** Une demande d'abonnement non confirmée reste en
      `attente` indéfiniment : le service élague d'abord les fiches **retirées** et borne le
      nombre d'abonnés, mais rien ne retire une adresse inscrite puis jamais confirmée. Une
      **purge au bout de quelques semaines** (avec son compte rendu au journal) serait plus
      propre au regard de la protection des données.
- [ ] **Modèles de message du bulletin.** L'en-tête et le pied du courriel viennent du
      référentiel (`entete`, `pied`, `expediteurNom`, `repondreA`), mais le **corps** est écrit
      dans le code (`enveloppeHtml`, `src/server/mysql/bulletins.mjs`). Des modèles éditables,
      comme ceux des six notifications, le rendraient adaptable sans toucher au logiciel.
- [ ] **Adresser un numéro à un seul abonné.** « Adresser aux abonnés » écrit à toute la liste ;
      réadresser à **une** personne (après un rejet de son serveur de messagerie, par exemple)
      demande aujourd'hui de passer par le journal. Un geste dans le tableau de bord, avec
      l'historique des livraisons de cet abonné, serait la suite logique.
- [ ] **Un flux pour le recueil lui-même.** Le bulletin a son RSS et son Atom ; le **fil
      d'actualité du recueil** (les actes publiés au fil de l'eau, et les billets d'informations)
      n'en a pas, alors que c'est ce que suivrait un lecteur de flux qui ne veut pas attendre la
      clôture d'une période.

## Performance (relevé en 1.5.4a, voir `docs/PERFORMANCE.md`)

Le gel des connexions simultanées est corrigé (dérivé de mot de passe asynchrone).
Ce que la campagne de charge a montré **sans le corriger** :

- [ ] **La vérification de session coûte deux lectures** (la session, puis le compte)
      à chaque requête authentifiée — 17 ms sur une base à 2 ms de latence. Un cache
      court par jeton de session le supprimerait, au prix d'un délai de propagation
      pour la révocation. À mesurer avant de trancher : la révocation immédiate est
      une propriété de sécurité, pas un détail.
- [ ] **Une lecture de collection coûte une dizaine d'ordres SQL.** S'il s'agit d'un
      balayage ligne par ligne, c'est le prochain gisement de performance.
- [ ] **Chiffrer `UV_THREADPOOL_SIZE`** (8 et 16) sur le scénario d'affluence, plutôt
      que de le recommander de principe.

## Demandes 1.5.3 (livrées en 1.5.3)

Quatre demandes reçues ensemble, autour d'une même idée : **l'espace public et
l'atelier cessent de partager une adresse**, et l'atelier peut se fermer à un
réseau.

- [x] **1. L'espace public passe à la RACINE ; l'atelier se demande.** Le recueil
      s'ouvre à `/` (`https://recueil.exemple.fr/`), ses actes gardant leur adresse
      en requête (`?acte=`, `?eli=`) ; l'atelier se demande — `?atelier` sur une
      page statique, `/atelier` sur une installation auto-hébergée (nginx sert le
      même `index.html`). Rien à ajouter au serveur web pour les sous-pages
      (`?page=…`) ni pour les billets (`?info=…`).
- [x] **2. Restreindre l'atelier à certaines adresses (liste blanche).** Deux
      réglages, le `.env` l'emportant : `SCRIBA_ATELIER_IPS` /
      `SCRIBA_ATELIER_MESSAGE`, puis `publication.atelier.ips` /
      `.message` dans le référentiel (Administration › Publication › Accès à
      l'atelier). Adresse, préfixe, champ ou plage abrégée ; entrée incomprise
      **signalée**, jamais ignorée. La décision appartient au **service** (seul à
      voir l'adresse de l'appelant) : hors liste, 403 `atelier_hors_reseau` sur
      toutes les routes de l'atelier, le recueil public restant ouvert. La liste
      du `.env` n'est jamais remplacée en silence ; une liste **illisible ferme**
      l'atelier (fail-closed) ; l'écran porte un **simulateur** d'adresse.
- [x] **3. Les actes réservés s'affichent au public pour un agent authentifié
      venant d'une IP autorisée.** `estAgent` = identité **et** (pas de
      restriction **ou** adresse autorisée) : un agent connecté les voit sur le
      recueil public, signalés « Réservé aux agents » ; un agent en télétravail
      ne les voit pas, et l'écran le lui dit.
- [x] **4. Interface publique modernisée, CSS de la collectivité, « Se
      connecter », mentions et accessibilité en sous-pages.** En-tête collant,
      entrée avec recherche et chiffres, bande « Informations », carrousel,
      thèmes, registre, pied de page avec ses pages, sa licence et la porte de
      l'application ; feuille de style libre (`config.publication.css`) portée sur
      `.recueil`, posée avant le premier rendu et après les feuilles de
      l'application ; mentions légales, conditions de réutilisation et
      accessibilité **en sous-pages** (`?page=…`), chacune avec titre,
      description, adresse canonique et fil d'Ariane.
- [x] **4 bis. Publier des « Informations » sur le recueil (billets).** Une
      collection `informations`, servie au public par `GET /v1/informations`
      (billets publiés seulement), un écran d'atelier (permission
      `informations.gerer`), une rubrique sur la page d'accueil et une page
      complète, chaque billet ayant son adresse (`?info=<slug>`).

## Demandes 1.5.3a (livrées en 1.5.3a)

- [x] **La démonstration montre enfin quelque chose au public.** Le recueil public
      d'une démonstration neuve était vide — « Aucun acte publié pour l'instant »,
      pas un billet — alors que sa fiction déclare dix-sept actes publiés et quatre
      informations. Le recueil lit le service de publication, et une démonstration
      ne provisionnait jamais le sien (un service sans clé est en lecture seule),
      ni ne lui déposait ses billets : la démonstration prend maintenant les deux
      gestes elle-même (`assurerServiceDemo`, `amorcerInformations`), et le recueil
      relit le registre du poste quand le service se tait
      (`src/lib/publications-locales.js`). Au premier lancement, la page annonce
      « Le recueil se prépare » au lieu de nier ce qu'elle va montrer.

## Reste à faire (petits chantiers ouverts)

- **Imports inutilisés : fait (1.6.1p), et tenu par le contrôle de style.** Dix-neuf
  fichiers portaient un import que plus personne n'employait (quarante et une
  mentions : `views/signature.js`, `views/rediger.js`, `ui/components.js`,
  `lib/oidc.js`, `lib/export.js`…). Ils sont nettoyés, et `npm run style` les
  refuse désormais (`scripts/analyse-imports.mjs`, éprouvé dans
  `tests/purs.test.mjs`) : la liste ne peut plus se reformer sans que la CI
  le dise.
- **Le service de démonstration ne voit pas l'adresse de l'appelant** : sa
  réponse le dit (`restriction_appliquee: false` + note), et le simulateur reste
  juste, mais l'aperçu ne peut donc pas montrer la restriction appliquée — c'est
  l'installation auto-hébergée qui décide. À garder en tête en testant : un
  réglage écrit dans l'aperçu ne s'y voit pas appliqué.
- **PDF/A** : conformité à valider sur un déploiement (`veraPDF`), voir plus bas.

## Demandes 1.5.2 (livrées en 1.5.2)

Six demandes reçues ensemble ; chacune touche plusieurs couches, et elles sont
traitées dans cet ordre.

- [x] **1. Recueil public : publications réservées aux agents.** Un acte publié
      peut être **réservé aux personnes connectées** (circulaires internes,
      consignes aux agents). Il reste « publié » (ELI, version en ligne, pièces),
      mais le recueil public ne le sert **qu'aux porteurs d'une session** ; les
      routes ouvertes (`/v1/publications`, `/recueil.json`, `llms.txt`,
      `sitemap.xml`, `/recueil/<clé>`) l'écartent pour un visiteur anonyme. Mention
      en ce sens dans le bloc « Vous ne trouvez pas ce que vous cherchez ? » du recueil.
- [x] **2. Organigramme : services rattachés à un autre service ou au bureau
      d'un autre service.** Un service peut dépendre d'un service, ou du bureau
      d'un autre service (`service.parentId`) ; les agents affectés à un service
      **en haut de chaîne** voient tous les actes de la chaîne en contrebas
      (périmètre = service + descendants).
- [x] **3. Éditeurs et administrateurs éditent l'organigramme.** Ajouter/retirer
      services et bureaux, régler leurs rattachements ; l'ajout ou la suppression
      d'une **entité** reste à l'administrateur. Nouvelle permission
      `organigramme.gerer` (administrateur + éditeur).
- [x] **4. Clés d'API à rôles (comptes de service).** L'administrateur crée, depuis
      l'interface, des clés d'API portant un rôle, qui agissent comme des comptes
      de service **invisibles dans le reste de l'interface** (hors de « Comptes et
      rôles »). Empreinte SHA-256 conservée par le service, jamais la clé.
- [x] **5. Interface du rédacteur : le bon geste au bon moment.** L'export ne doit
      plus paraître l'aboutissement ; « Soumettre au circuit » (ou « Envoyer en
      signature ») doit être le geste mis en avant, avec un chemin lisible
      (rédiger → soumettre → signer/publier).
- [x] **6. Parapheur : étapes visant une personne ou un service, et vue
      récapitulative des circuits.** Une étape peut viser un **rôle**, une
      **personne** nommée ou un **service** (hors chaîne de décision) ; dans
      Administration › Circuits, une **vue récap** liste les circuits et ouvre une
      **sous-vue par circuit** au lieu de les empiler.

## Circuits de validation, exécution, registre et collaboration (livrés — suite possible)

Livré en une fois, quatre manques qui tenaient ensemble (un acte n'était ni
validé, ni exécutoire, ni retrouvable, ni partagé) :

- **Parapheur** — `src/lib/validation.js` (circuit = donnée du référentiel :
  étapes séquentielles, **trois natures d'étape** — vérification, visa, signature —
  chacune appelant un rôle par défaut modifiable, ciblage trame / famille /
  entité) ; `src/ui/views/parapheur.js` (file « à valider par moi / en cours /
  validés / renvoyés ») ; `src/ui/parapheur-actions.js` (les gestes partagés par
  l'écran et par la fiche d'acte) ; décisions, observations, reprise de circuit,
  et **empreinte du texte validé** : réécrire l'acte après validation rend celle-ci
  caduque. Le service de signature refuse (409 `validation_incomplete`) d'ouvrir un
  circuit sur un acte non validé.
  C'est une **fonction ordinaire** (elle n'est plus expérimentale) : le circuit
  général s'ouvre par la **vérification du réviseur**, puis le visa de la direction.
  Un référentiel qui n'en veut pas écarte le circuit sur ses trames (« Aucune
  validation »).
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

- [x] **Partage entre postes.** L'état du service embarqué vit dans le navigateur : deux
      personnes sur la même démonstration ne voyaient pas le même référentiel. Poser
      `window.__SCRIBA_SERVICE_URL__` **avant** `src/pages/host.js` branche désormais la page
      statique sur un **service distant** (`src/server/`, ou toute installation au même contrat) :
      le stockage local reste (réglages, session, file d'attente), les collections passent par
      l'API, et tous les postes voient le même référentiel. Le service doit autoriser l'origine
      de la page (`CORS_ORIGINS`). Documenté dans `docs/GITHUB.md` (« Travailler à plusieurs tout
      en restant sur GitHub Pages ») ; `__SCRIBA_STATIC_SHARED__` dit au bandeau qu'il ne doit
      pas annoncer « rien n'est partagé ».
- [x] **Bandeau « démonstration statique ».** Le bandeau de tête (atelier **et** recueil public)
      dit maintenant, en édition statique, que la page héberge son propre service et que rien
      n'est partagé entre postes — au lieu de ne le laisser lire que dans le libellé du mode de
      persistance. Relié à un service distant (`__SCRIBA_SERVICE_URL__`), il dit l'inverse : les
      données sont communes (`src/ui/notice.js`).
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
      sans budget de calcul) publie les dix-sept actes en treize secondes et les conserve d'un
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
      Depuis la note **1.6.1n**, les réglages sont présents **dans tous les modes** — l'annuaire
      peut être proposé en **seconde porte**, à côté des comptes locaux ou des comptes de
      l'application — et le `.env` les porte tous (`SCRIBA_ANNUAIRE_*`, 22 variables, validées par
      le registre) ; le service les republie dans `GET /v1/auth/config`, seule façon pour l'écran
      de connexion de les lire en mode « comptes locaux », où le référentiel n'est pas encore
      accessible.
      **Depuis la note 1.6.1p, c'est le SERVICE qui est le client OIDC** : la route
      `POST /v1/auth/annuaire` (voir `src/server/mysql/comptes.mjs` et le branchement dans
      `annuaire-service.mjs`) découvre le fournisseur, échange le code avec le vérificateur PKCE
      que le navigateur a gardé, vérifie le jeton d'identité (JWKS du fournisseur, `iss`, `aud`,
      `exp`, `nonce`, signature RS/PS/ES — voir `jws.mjs`), écrit le compte au référentiel puis
      ouvre une session `sb_session`. L'agent entré par l'annuaire lit donc les actes comme les
      autres, la seconde porte s'ouvre en mode « comptes locaux », et le fournisseur n'a plus
      besoin d'autoriser le CORS : plus aucun appel ne part du navigateur. Les contrôles et la
      correspondance des revendications sont éprouvés séparément (`annuaire-service.test.mjs`,
      `jws.test.mjs`), et leur concordance avec le client du navigateur est tenue par
      `tests/purs.test.mjs`.

      Reste possible, non fait :
      - SAML (les collectivités en ont encore), déconnexion fédérée (`end_session_endpoint`), et
        rafraîchissement de session par `refresh_token`.
- [x] **Comptes locaux (mot de passe) sans annuaire (livré).** `AUTH_MODE=password` dans le `.env` :
      comptes vérifiés par le service (dérivé `scrypt`, blocage après échecs, comparaison à temps
      constant), session dans un cookie `HttpOnly` + jeton anti-CSRF, compte d'administration créé
      depuis le `.env`, administration des mots de passe depuis *Comptes et rôles*, mode
      démonstration réglable (`DEMO_ACCOUNTS`). Banc d'essai : `src/server/mysql/comptes.test.mjs`
      (39 épreuves, `npm test`). Reste possible : réinitialisation par l'agent (lien à usage unique
      par courriel — le service de courriel est désormais là, § « La signature simple et le
      courriel »), second facteur (TOTP), journal des connexions, et purges planifiées de
      `sb_session`.
- [x] **Le commutateur de démonstration (livré).** `DEMO` (`.env`) commande **tout** le jeu fictif :
      allumé, l'installation est une démonstration (bandeau, jeu complet) ; éteint, elle part d'un
      **référentiel vierge** — aucune donnée fictive, aucune mention de la collectivité fictive. Une
      installation déjà peuplée se nettoie par *Administration › Données › « Repartir d'un référentiel
      vierge »* (poste **et** service : `POST /v1/admin/purge`). Reste possible : l'adresse @ctes de
      `CONTROLE_LEGALITE.apiUrl` est une adresse d'**exemple** (la transmission est simulée) — à rendre
      réglable dans le référentiel le jour où une vraie télétransmission sera branchée.
- [x] **Les réglages déclaratifs et l'image autonome (livrés).** Le `.env` peut **poser** les
      réglages de référentiel (identité, vocabulaire, numérotation, délais, recueil, fonctions,
      variables `SCRIBA_*`) : un registre unique (`src/server/mysql/variables.mjs`) les déclare, le
      service les valide et les sert par `GET /v1/config`, l'application les applique par-dessus le
      référentiel, et un wiki engendré (`src/docs/VARIABLES.md`) les documente. `src/server/Dockerfile`
      bâtit par ailleurs une **image autonome** (service + façade + application), décrite dans
      `src/docs/DOCKER.md`. Reste possible : une tâche d'intégration continue qui construit et publie
      l'image (`buildx`, multi-architecture) à chaque version figée, et un `schema.sql` versionné
      pour l'image (aujourd'hui, l'exploitant lance `--migrate` ou pose `AUTO_MIGRATE=true`).
- [ ] **Éprouver la suite de tests depuis un vrai Node.** Le domaine des comptes a été vérifié ici
      avec un substitut de `node:crypto`, et les **277 épreuves des 24 fichiers** y passent
      **fichier par fichier** — c'est ainsi que `node --test` les exécute, chaque fichier dans son
      propre processus (un harnais qui les exécute tous dans le même processus n'est pas
      représentatif). Le verrou du service est désormais livré
      (`src/server/mysql/package-lock.json`, installé par `npm ci`). Reste à le confirmer sur un
      poste outillé, en une commande : `cd src/server/mysql && npm ci && npm test`, puis, à la
      racine, `npm run verifier` — exactement ce que la chaîne d'intégration exécute à chaque envoi.
- [ ] **La marque du recueil public avant la session.** En mode `password`, le référentiel n'est pas
      lisible avant la connexion : le recueil public (qui, lui, reste ouvert — `/v1/publications`
      l'est aussi) s'affiche donc avec la marque par défaut au lieu de celle de la collectivité. Le
      service pourrait rendre `marque` (nom, sous-titre, logo) dans `GET /v1/auth/config`, comme le
      prévoit déjà `src/ui/state.js` (`appliquerMarqueDeploiement`).
- [ ] **Rôle d'administrateur par annuaire.** Aujourd'hui l'écran « Comptes et rôles »
      reste la main sur les comptes pré-enregistrés ; un annuaire qui n'annonce aucun groupe
      utile oblige à choisir « refuser » ou un rôle de repli global. Des règles par groupe
      plus fines (plusieurs correspondances, exceptions) seraient la suite logique.
- [x] **Jeton client non public.** Livré : dès que le déploiement administre par session
      (`AUTH_MODE=password` ou `oidc`), la façade ne l'écrit plus dans `config.js`
      (`web/entrypoint.sh`) et l'hôte refuse de le lire (`web/host.js`) ; les écritures passent
      par le cookie de session. Le mode « démonstration » garde sa clé — il n'a rien à protéger.
- [ ] **TLS fourni.** La pile s'arrête à HTTP ; le reverse-proxy TLS est à la charge de
      l'exploitant (un profil Caddy/Traefik pourrait être fourni).
- [ ] **Sauvegarde outillée.** Fournir un service de dump planifié avec rotation, plutôt que
      de laisser la commande dans la documentation.
- [ ] **Sonde de supervision** dédiée (et non `/v1/db/health`, qui interroge la base).
- [x] **Migrations versionnées.** Livré : table `sb_migrations` et liste ordonnée de migrations
      (`src/server/mysql/migrations.mjs`), chacune appliquée une fois et inscrite avec son
      empreinte — une migration modifiée après coup est signalée, jamais rejouée. Le socle
      (`schema.sql`) est la version 1 ; la suite s'AJOUTE (voir `src/docs/REPRISE.md`).

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
- [x] **Le rangement par fichiers (livré — 1.6.1l).** Le service peut se passer de MariaDB :
      `STOCKAGE=fichier` range tout dans un dossier (`DATA_DIR`), en clair. Le protocole est celui
      du magasin (`magasin.mjs`), donc identique à MariaDB — mêmes collections, révisions, conflits
      et journal ; l'algorithme de synchronisation est écrit une fois et partagé. Banc d'essai
      entièrement en mémoire (`magasin-fichier.test.mjs`, 14 épreuves).
- [ ] **Migrer d'un rangement à l'autre, outillé.** Le passage MariaDB ↔ fichiers se fait
      aujourd'hui par **export/import** (Administration › Données) ; une commande de conversion
      (`--exporter-fichiers`, `--importer-fichiers`) épargnerait un aller-retour par l'interface,
      et permettrait une bascule scriptée.
- [ ] **Éprouver le rangement par fichiers par un VRAI service.** Les épreuves du magasin
      tournent en mémoire (disque injecté) : solides sur la logique, elles ne couvrent ni les
      droits du système de fichiers, ni l'écriture atomique réelle, ni le comportement à l'arrêt
      d'un processus. À confirmer sur un poste outillé : `STOCKAGE=fichier DATA_DIR=/tmp/scribae
      node src/server/mysql/server.mjs`, puis un cycle complet (dépôt, signature, publication).
- [ ] **Points ouverts de l'audit ciblé du 22/09/2026** (session, anti-CSRF, file
      d'attente ; détails et propositions dans `src/docs/AUDIT-BUGS-2026-09-22.md`) :
      `GET /v1/db/health` est publique et décrit l'hôte, le port et la version de la
      base — la protéger par une session demande de traiter son `401` comme « session
      requise », et non comme une panne, dans `src/ui/app.js` ; le mode « Service de
      démonstration » reste proposé en auto-hébergement alors qu'il n'y a pas de
      socket (limite de taille plus basse, essai d'écriture absent) ; une entrée
      définitivement refusée est réessayée toutes les trente secondes — à suspendre
      jusqu'à un geste explicite ; les migrations de `bootstrap()` écrivent `users` ou
      `config` même pour un compte ordinaire (refus légitime, mais affiché comme une
      erreur) ; rien n'avertit avant un montage inter-**site**, où le cookie de session
      `SameSite=Lax` ne traverse pas ; la présence (25 s) amplifie les états d'erreur
      à l'écran.
- [ ] **Les mots de passe des comptes supprimés restent chez le service.** Supprimer
      un compte depuis « Comptes et rôles » retire son enregistrement de la collection
      `users`, mais laisse sa ligne dans `sb_motdepasse`. Elle ne peut plus servir
      (la connexion part du compte), mais un compte RECRÉÉ avec le même identifiant
      reprendrait l'ancien mot de passe — et c'est un reste qui traîne dans les
      sauvegardes. La suppression d'un compte devrait donc retirer aussi son mot de
      passe (`retirerMotDePasse` existe déjà : route
      `DELETE /v1/auth/comptes/<id>/mot-de-passe`, utilisée par l'écran du compte).

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

## Zoom et déplacement du contenu : le canvas (livré — suite possible)

Livré : `src/ui/zoom.js` (`cadreZoom`) traite l'organigramme des délégations, la feuille de la
trame et le document en rédaction comme un **canvas** — molette ou boutons pour le cran,
« Ajuster », déplacement au curseur. L'éditeur de trame occupe en outre toute la fenêtre
(`.app--plein`), si bien que ses volets défilent sur place. Voir `README.md` § « Le canvas ».

Restent ouverts :

- [ ] **Le pincement sur écran tactile.** Aujourd'hui le doigt **fait défiler** le canvas (le
      défilement natif, rendu possible par la taille du plateau) et la barre règle le cran ; le
      pincement à deux doigts n'est pas repris. Le capter demanderait de poser `touch-action` et
      d'écrire le geste — au prix du défilement natif, que l'on ne veut pas perdre.
- [ ] **Le cran ne survit pas au rechargement.** Il vit dans `state.ui.zooms` (mémoire de la
      session), comme l'état des écrans. Le mémoriser par poste — comme l'apparence claire/sombre
      (`src/lib/theme.js`) — serait cohérent.
- [ ] **Étendre le canvas aux autres aperçus A4.** « Modifier un acte », l'aperçu des feuilles de
      style et l'écran de signature réduisent encore la feuille par l'ancien ajustement à la
      largeur (`fitPaper`, `src/ui/dom.js`), qui ne sait que **réduire** : on ne peut pas y zoomer.
- [ ] **Réajuster quand l'utilisateur a choisi son cran.** Un cadre réglé à la main (`auto` faux)
      ne se recadre plus quand la largeur change : la feuille reste à sa largeur figée jusqu'à
      « Ajuster ». À raffiner si cela se remarque à l'usage.

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
- [x] **Abroger une annexe.** Tranché et livré : par sa nature. Une annexe **sans publication
      autonome** (un tableau, une grille tarifaire) fait partie de sa décision mère et **s'abroge
      avec elle**, au même jour, sans clause (`abrogePar.parAnnexion`) ; une annexe **autonome**
      (un règlement, `trame.reglement`) **survit** à l'abrogation de sa décision d'adoption, et
      doit être abrogée ou modifiée par un **acte autonome** — l'application le **signale** dès
      la rédaction, puis sur la fiche de l'acte abrogeant et sur celle de l'annexe. Règle :
      `src/lib/abrogation-annexes.js` (pure, éprouvée) ; application :
      `src/ui/abrogations-apply.js` ; documentation : `SPEC.md` § 2.5 bis.
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
- [x] **Règlement et abrogation.** Tranché avec les annexes, et dans le même sens : un règlement
      publié à part **survit** à l'abrogation de la délibération qui l'a adopté — c'est un texte
      normatif, consultable pour lui-même — mais l'application le **dit** et le désigne, pour qu'il
      soit abrogé ou remplacé par un acte autonome (voir « Abroger une annexe »). Reste ouvert, en
      revanche : ce qu'il advient de sa **publication informative** au recueil (une « dépublication »
      du règlement, ou la mention qu'il n'est plus en vigueur, n'est pas encore outillée).

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

- [x] **Export PDF/A** — livré : **PDF/A-2b** (défaut) et **PDF/A-1b**, mis en page par
      l'application elle-même (`src/lib/pdfa.js` : polices et profil sRGB embarqués, XMP,
      `OutputIntents`, langue, métadonnées, identifiant ELI). Chaîne à valider par `veraPDF` sur un
      déploiement réel.
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
- [ ] **Signature réellement qualifiée.** Les réglages sont là (`config.signature.api` :
      transport, adresse, prestataire, niveau, notification, délai et les quatre points de
      terminaison — Administration › Signature, ou les variables `SCRIBA_SIGNATURE_API_*` du
      `.env`), et c'est le **service** qui appelle le prestataire (`server/mysql/signature.mjs`,
      clé `SCRIBA_SIGNATURE_API_CLE`). Reste à l'éprouver contre un prestataire **réel**
      (ESUP-Signature, un parapheur) : le format exact des jetons du document, des signataires
      et du démarrage diffère d'un produit à l'autre, et la notification entrante
      (`POST /v1/webhooks/signature`) mérite d'être vérifiée de bout en bout avec un certificat
      de signature. Point d'entrée : `createPrestataire` (`server/mysql/signature.mjs`).
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
      éclaircie en mode sombre (`--brand`) tandis que le papier reste blanc (`--brand-light`), et
      le référentiel peut porter un **second emblème** pour le fond sombre (`brand.logoUrlDark`,
      résolu par `brandLogoUrl`), qui prend alors la place du logo dans l'en-tête, à l'écran de
      connexion et sur le recueil public — jamais sur le papier.
      Piste : mémoriser la préférence **par compte** (aujourd'hui par poste/navigateur), pour
      la retrouver en changeant de machine.

## Jeu de démonstration (livré — pistes)

Livré : `src/lib/demo-actes.js` pose **soixante-neuf actes** au premier démarrage, dont
**cinquante-deux signés** (vérifiables) — trois d'entre eux illustrent la **révision** (un acte en
attente, un acte révisé et validé, un acte rejeté, revenu en brouillon), trois sont des **documents
non juridiques** (verbatim de séance, déclaration, vœu : publiés au recueil, sans opposabilité — voir
`SPEC.md` § 2.2.4 quater), deux sont des **actes
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
      Les **billets** suivent le même chemin (`amorcerInformations`) : le recueil les avait lus
      avant que le service ne les connaisse, et l'invalidation qui suit le dépôt — sans relecture —
      faisait disparaître la rubrique « Informations » pour de bon, jusqu'au chargement suivant.
      Corrigé en `1.6.1d` : un redessin du recueil réarme ses lectures, et il n'écrit que s'il est
      l'écran affiché — une lecture qui aboutit après coup ne réécrit plus la page par-dessus
      l'atelier.
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
- [x] **Les recueils extérieurs et les mentions sont portés par le service auto-hébergé.** Livré :
      les renvois (« Autres recueils », sites de référence) et les mentions du pied de page
      (légales, conditions de réutilisation, accessibilité) voyagent avec **chaque publication**,
      comme le titre du recueil et le nom de la collectivité — l'application les transmet au dépôt
      (`src/ui/views/signature.js`, `diffusionRecueil`), et le service les rend dans `/recueil`
      (bloc « Vous ne trouvez pas ce que vous recherchez ? », pied de page), `/recueil.json`
      (`renvois`, `mentions`) et `llms.txt`. Couvert par `actes.test.mjs`.
- [ ] **L'état du service de l'environnement d'édition ne survit pas toujours.** Corrigé côté
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
      l'amorçage (`PAUSE_AMORCAGE`) et le choix de **dix-sept actes publiés** plutôt que tous.
      Une troisième, mesurée, couvre le premier : la **reprise** de l'amorçage (voir ci-dessus)
      rattrape l'appel perdu quand la page était occupée — l'attente de vingt secondes de
      `ready()` (src/lib/remote.js) expire alors que le canal s'ouvre normalement, et la reprise
      suivante aboutit.
      La **condition de déclenchement** de l'amorçage a en outre été resserrée (`1.3.1c`) : il ne
      s'exécute plus seulement si *tous* les actes sont ceux de la fiction — un acte écrit à la
      main laissait le recueil vide pour toute la session —, mais publie CHAQUE acte `acte-demo-…`.
      Reste vrai : une mémoire durable vidée (1011) oblige à **reprovisionner** le service avant
      que le moindre dépôt n'aboutisse.
      Piste pour le premier : écrire l'état en **double tampon** (deux copies dans `state`, un
      index actif dans l'en-tête) — un instantané pris au milieu ne trouverait alors que la
      copie précédente, complète. À faire dans `index.html` **et** `src/pages/host.js`
      (`etatUtilise()` lit le même en-tête), avec les tests d'aller-retour correspondants.
      Le service enregistré (service « natif » de la plateforme) et l'auto-hébergement
      (MariaDB, `sb_etat`) ne sont pas concernés.
- [x] **Retirer une publication du recueil** (dépublier) — **livré des deux côtés**. L'écran
      **Publications (ELI)** porte le retrait sous la permission `publications.depublier`
      (administrateur seul) : avertissement en grand, **motif technique obligatoire**, motif
      conservé sur l'acte et inscrit au **journal** d'audit (`publication.depublie`), l'acte
      redevenant *signé*, donc publiable à nouveau. Le **service de l'environnement d'édition**
      (index.html) et le **service Node/MySQL** (`src/server/mysql/actes.mjs`, rôle
      `administrateur`) exposent tous deux `POST /v1/publications/{cle}/retrait` — même règle,
      même trace —, et le jeu d'appels de conformité
      (`tests/conformite-service.mjs`) exige la route des **deux**. Couvert par
      `actes.test.mjs`.
- [x] **Actes de démonstration plus variés.** Fait (SEED_VERSION 45/46, puis 53 pour les
      documents non juridiques) : le jeu couvre
      **vingt-cinq trames** et **soixante-neuf actes** — verbatim de séance, déclaration, vœu,
      nomination, délégation, permis de
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


## Constats d'un essai de bout en bout (22/09/2026)

Essai mené **par l'interface seule** (clics et frappes réelles, en changeant de compte),
sur toute l'application : rédaction, révision, signature, publication, exécution,
délégations, comptes, référentiel, feuilles de style, recherche, assistants, recueil public.

**Les dix constats ci-dessous sont levés** — voir `CHANGELOG.md`, notes intermédiaires
`1.3.1a` à `1.3.1k` :

- [x] **Service non provisionné = tous les circuits bloqués, avec un message opaque.**
      Un service neuf n'a aucune clé d'écriture : dépôt, signature, publication échouent en
      403. Le geste existe (Administration › Base de données, mode « Service de démonstration
      — partagé », bouton « Provisionner le service »), mais `remote.js` ne lisait pas
      `body.erreur` et n'affichait donc que « Erreur 403 ». **Livré (`1.3.1a`)** : le motif du
      service s'affiche tel quel. **Livré aussi (`1.3.1b`)** : le provisionnement rejoue la
      MÊME clé, reconnaît un service « déjà provisionné » quand c'est la sienne, le dit en
      français quand il échoue, et le service se RECONNECTE de lui-même après une fermeture
      1011.
- [x] **Aucun moyen, dans l'interface, de résoudre « le signataire n'a pas de compte ».**
      Un acte dont le signataire désigné est la Maire ne peut être signé par personne tant
      qu'aucun COMPTE n'est rattaché à cette personne : l'écran le dit (« Signataire sans
      adresse… Renseignez son adresse au référentiel »), mais **le référentiel des personnes
      n'a pas de champ courriel** — l'adresse vit sur le compte (Comptes et rôles). **Livré
      (`1.3.1g`)** : le message dit ce qui manque au juste (le compte, son courriel, ou le
      rapprochement) et ouvre « Comptes et rôles ».
- [x] **Le recueil public se vide quand un acte non-démonstration entre au registre.**
      L'amorçage (`src/ui/demo-publications.js`) ne publie les actes de la fiction que si
      TOUS les actes sont `acte-demo-*` : un seul acte écrit à la main (même un brouillon
      d'essai) laisse le recueil public sans rien, alors que l'écran « Publications (ELI) »
      en liste neuf. **Livré (`1.3.1c`)** : le critère porte sur la provenance de CHAQUE acte
      (seuls les `acte-demo-…` sont publiés par l'amorçage).
- [x] **Délégation suspendue : l'aperçu dit « Aucune décision renseignée »** alors que les
      deux décisions sont bel et bien saisies sur la fiche — c'est la suspension qui les
      neutralise. **Livré (`1.3.1d`)** : la fiche dit que la délégation est hors d'effet,
      pourquoi, et comment la rétablir.
- [x] **« Ajouter une sous-délégation » referme la fiche du parent** : on perd la chaîne
      qu'on était en train de lire pour ouvrir un formulaire neuf. **Livré (`1.3.1e`)** : la
      nouvelle fiche s'ouvre par-dessus, la première se redessine à la fermeture, et « Échap »
      ne ferme que la fenêtre du dessus.
- [x] **Épinglage sans état visible** : le bouton d'un acte déjà à la une garde le libellé
      « Épingler à la une du recueil public ». **Livré (`1.3.1f`)** : l'état se lit sur l'acte
      OU sur sa publication, et le libellé, la punaise allumée et la pastille suivent.
- [x] **Petites grammaires d'écran** : « 1 règles » (compteur), « Il manque ici décision de
      nomination (…) ». **Livré (`1.3.1h`)** : les compteurs s'accordent, et la phrase porte
      son article (« la décision de nomination (intitulé et lien) et la décision de délégation
      (lien) »).
- [x] **Assistant Plume : trou de documentation.** « Comment créer une délégation de
      signature ? » répond « je ne sais pas » alors que le guide consacre cinq chapitres au
      sujet ; « Comment exporter un acte en PDF ? » est, lui, parfaitement servi. **Livré
      (`1.3.1k`)** : un chapitre « Les délégations de signature » existe pour lui-même et
      l'écran Délégations le désigne à l'assistant.
- [x] **« Imprimer / PDF »** ouvre un onglet puis lance l'impression (comportement voulu),
      mais fige l'aperçu de l'éditeur pendant que la boîte d'impression est ouverte. **Livré
      (`1.3.1i`)** : plus jamais de `window.print()` dans la page de l'application — onglet
      dédié (qui imprime lui-même) ou téléchargement.
- [x] **JSON-LD ELI : `eli:type_document` vide** (la nature de l'acte n'y est pas reportée).
      **Livré (`1.3.1j`)** : le type d'acte et l'entité voyagent avec la publication.

## Organigramme, chrono, API documentée et signature par API (1.4.0 — livré)

Livrés en une fois, sur demande : le signataire principal, l'organigramme des entités, le chrono
de numérotation, deux emblèmes en en-tête, l'autorité en gras, les réglages de l'API du
prestataire, la référence de l'API REST, et l'accès local en mode annuaire.

- [x] **Signataire principal d'une entité.** `entite.signerPersonId` / `signerRoleId` (fiche de
      l'entité, onglet Entités de l'Administration), lu par `signatairePrincipal`
      (`src/lib/organigramme.js`) et employé par la compilation comme signataire par défaut
      (`buildContext`, `src/lib/compile.js`). Une entité sans signataire principal est signalée,
      plutôt que de produire un acte sans signature.
- [x] **Organigramme entités → services → bureaux.** `src/lib/organigramme.js` (module pur) et
      `src/ui/views/organigramme.js` (route `organigramme`, même toile que les Délégations).
      Une entité est **autonome** (personnalité morale : commune, CCAS, caisse des écoles,
      office) ou **rattachée** (`parentId` + `autonome: false` : une régie sans personnalité
      morale propre, mais avec son directeur, son service et ses actes). Entités hors arbre
      (rattachement cyclique) signalées.
- [x] **Chrono de numérotation.** `src/lib/chrono.js` + `src/ui/views/chrono.js` (route
      `chrono`) : tous les rangs attribués, les rangs jamais attribués et les numéros annulés,
      compteurs, filtres, tri, export **CSV et XLSX sans dépendance** (`src/lib/xlsx.js`),
      passage à l'année suivante et annulation d'un rang. Le noyau de la séquence vit désormais
      dans `src/lib/sequence.js` (portée globale / par entité / par type d'acte, relecture d'un
      numéro composé) et **un numéro n'est plus jamais attribué deux fois**
      (`prochainNumeroLibre` : on enjambe les rangs déjà pris ou annulés).
- [x] **Deux emblèmes en en-tête** (`logoRightUrl`, `logoRightHeight`) et **autorité en gras**
      (`authorityWeight` : normal, italique, gras, gras italique — les feuilles antérieures
      gardant leur rendu par « Hérité »).
- [x] **Réglages de l'API du prestataire de signature** (Administration › Signature et
      `SCRIBA_SIGNATURE_API_*`), appel réel par le service (`server/mysql/signature.mjs`), clé
      jamais exposée.
- [x] **Référence de l'API REST + panneau de commande** (`src/lib/api-reference.js`,
      `src/ui/views/api-reference.js`, et `src/docs/API.md` engendré par
      `scripts/generer-api.mjs`).
- [x] **Mode annuaire : les comptes locaux restent joignables** (`comptesLocaux` rendu par
      `GET /v1/auth/config`, bloc « Ou par un compte local » à la connexion, `accesLocal` /
      `sessionDeService` dans `src/lib/auth.js`).

Ce qui reste ouvert, dans le prolongement :

- [ ] **Le chrono exporté en PDF, et signé.** L'export livré est CSV / XLSX ; un état du chrono
      en PDF (avec la charte de la collectivité) manque, alors qu'un greffe le joint volontiers
      à un dossier.
- [ ] **Rattachement d'un SERVICE à un bureau d'une autre entité.** L'organigramme descend
      entité → service → bureau ; un service partagé entre deux entités (une direction commune)
      demanderait un rattachement multiple, que le modèle ne porte pas.
- [ ] **Numéros en double dans les données existantes.** `prochainNumeroLibre` empêche d'en
      créer de nouveaux, mais rien ne signale les numéros DÉJÀ en double dans un registre
      repris d'un autre outil : le chrono pourrait les mettre en évidence.
- [ ] **Signataire principal et délégations.** Le signataire principal d'une entité sert de
      défaut ; il ne se substitue pas encore à une chaîne de délégation (le visa des décisions
      de nomination et de délégation reste porté par l'arbre des délégations).
- [ ] **Rôles d'annuaire pour les entités rattachées.** Les revendications OIDC donnent un rôle
      et un périmètre ; rattacher un agent à une entité RATTACHÉE (la régie du cinéma) passe
      encore par le compte, à la main.
