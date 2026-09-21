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

## [1.3.0] — 2026-09-21 — Les actes d'assemblée

### Sécurité

- **Le service n'a plus aucune clé écrite dans le code.** Jusqu'ici, la clé d'écriture qui autorisait
  les dépôts, les signatures et les publications était inscrite **en clair dans l'application** —
  donc lisible par quiconque ouvrait la page ou consultait sa source — et ce seul mot de passe
  ouvrait **toutes** les routes, y compris la réécriture des comptes. Un service neuf s'ouvre
  désormais **en lecture seule** : il sert le recueil public, et rien d'autre. La **première clé**
  se dépose une seule fois, depuis *Administration › Base de données* (« Provisionner le service »),
  et c'est le **poste qui la tire au hasard** : le service n'en conserve que l'**empreinte
  SHA-256**, jamais la valeur, et l'écran la montre **une seule fois** — perdue, elle ne se
  remplace qu'en réinstallant l'état du service. Chaque clé porte un **rôle** — `administrateur`,
  `editeur`, `redacteur`, `lecteur`, et `prestataire` pour la seule notification de signature — et
  **chaque route dit le rôle qu'elle exige** : un poste muni d'une clé de rédaction ne peut ni
  publier, ni épingler, ni toucher aux comptes. Les clés se créent (une par poste : « Générer une
  clé de poste »), se listent et se **révoquent** ; le service refuse de révoquer la **dernière clé
  d'administration**, pour ne pas se verrouiller lui-même.

- **Les collections ne se lisent plus sans clé.** Les **comptes** (identifiant, courriel, rôles,
  rattachements, préférences), la configuration et le journal étaient lisibles par **n'importe
  qui** — la route ne demandait aucun jeton. Cette lecture est fermée, et une **sensibilité par
  collection** la règle : les trames et les métadonnées sont publiques, les comptes ne le sont ni en
  lecture ni en écriture. Le public garde exactement ce qui est public : la santé du service, le
  **registre du recueil** (`/v1/publications`), la résolution des identifiants ELI, et l'état de
  l'autorisation (`/v1/auth/etat`, qui ne dit que « provisionné » ou non, et les rôles existants).

- **Le webhook du prestataire de signature est authentifié.** La route qui reçoit l'acte signé était
  **publique** : un tiers pouvait fabriquer un paquet signé portant le nom et la fonction de son
  choix, le présenter, et faire passer un acte à « signée » — puis le publier. Elle exige désormais
  une clé de rôle `prestataire` (ou d'administration), et **le document déposé ne se lit plus sans
  clé** non plus : c'est l'intégrité du circuit qui l'exige, non la commodité.

- **Les documents déposés ne sont plus lisibles par tout le monde.** Les actes dits
  **individuels** — une revalorisation, une sanction — que la loi ne veut pas voir publiés étaient
  protégés **à la publication** mais pas **à la lecture** : leur texte intégral se lisait depuis le
  service, numéro et objet compris. La lecture du dépôt, des circuits de signature et des
  transmissions exige maintenant une clé ; seules les **publications** restent ouvertes — c'est
  exactement ce que la publicité de l'acte suppose.

- **La page d'un acte publié n'exécute plus de code.** La version en ligne reçue du service était
  insérée telle quelle dans la page du recueil : une publication malveillante (ou fautive) faisait
  donc exécuter du script à **tout visiteur** — sur la page d'accueil de la collectivité. Le
  fragment passe désormais par un **assainissement** : liste blanche de balises et d'attributs
  (`<script>`, `<iframe>`, gestionnaires d'événements `on…`, adresses `javascript:`, `vbscript:`
  et `data:text/html` sont retirés), adresses d'images et de liens contrôlées. Le texte publié
  légitime — paragraphes, listes, tableaux, emphases, images — traverse intact.

- **La clé du moteur de langage ne vit plus dans le référentiel.** Elle était enregistrée avec la
  configuration de l'assistant — donc **dans les exports de données et les sauvegardes de la base**.
  C'est un secret : il ne se sauvegarde pas avec les données qu'il permet d'exploiter. Elle est
  désormais conservée **par poste**, dans le stockage du navigateur (comme l'apparence), retirée de
  la configuration à la lecture comme à l'écriture, et **absente de tout export**. Les postes qui
  doivent interroger un moteur saisissent la leur ; l'aide du champ le dit.

- **Ce que le service laisse comme trace.** Chaque geste sensible — dépôt d'acte, ouverture de
  circuit de signature, notification reçue, transmission, publication, retrait, épinglage,
  provisionnement et gestion des clés — laisse une ligne dans un **journal tenu par le SERVICE**,
  et non par le poste qui a fait le geste. Les lignes sont **chaînées par empreinte SHA-256** :
  chacune scelle la précédente et son contenu, si bien qu'une modification rompt la chaîne — et
  l'écran le dit (« Chaîne intègre » / « Chaîne ROMPUE »). Le journal se lit depuis
  *Administration › Base de données* (« Journal d'audit du service »).

- **Le durcissement de l'API et de la façade.** La comparaison des clés est **à temps constant**
  (une comparaison naïve laisserait mesurer l'empreinte attendue, octet par octet) ; chaque réponse
  porte `X-Content-Type-Options: nosniff`, `Cache-Control: no-store` et `Referrer-Policy` ; la
  façade nginx refuse de se laisser **encadrer par un autre site** (`frame-ancestors 'self'`,
  `X-Frame-Options: SAMEORIGIN`) et reprend ses en-têtes sur les chemins qui posent les leurs.

- **À l'installation, les valeurs par défaut sont sûres.** Le déploiement auto-hébergé démarre en
  **comptes locaux avec mot de passe** (`AUTH_MODE=password`) : plus de comptes sans mot de passe
  par simple oubli. Le **CORS est fermé par défaut** (`CORS_ORIGINS` vide : aucun en-tête n'est
  posé, aucun autre site ne peut appeler l'API pour le compte d'un agent). Les images Docker
  (`node:20-alpine`, `mariadb:11`, `nginx:alpine`) sont **épinglées par empreinte** — deux
  installations à deux dates ne partent plus de deux logiciels différents — et la version de
  `mysql2` est **fixée**. Chaque jeton d'API porte désormais un **rôle** (`libellé|rôle:empreinte`),
  au lieu d'un jeton unique tout-puissant.

### Ajouté

- **Une licence, écrite noir sur blanc.** Le dépôt portait un fichier `LICENSE` en GPL-3.0, mais la
  page publique annonçait « tous droits réservés », et rien ne disait ce qu'il en était du **code
  produit par l'IA**. `src/LICENSE.md` tranche les trois objets, qui n'ont ni le même auteur ni le
  même régime : le **logiciel** (GPL-3.0, le fichier `LICENSE` restant à la racine du dépôt), les
  **actes publiés** — qui ne relèvent pas de la licence du logiciel mais de la loi : la
  réutilisation se règle par la **mention de réutilisation** du recueil, par défaut la **Licence
  Ouverte 2.0** (CRPA, art. L. 321-1 et L. 322-6) —, et le **code produit par l'IA**, placé sous la
  même licence que le reste, ses dépendances gardant les leurs (une seule : `mysql2`, MIT). La
  section « Licence » de la page publique du dépôt dit désormais la même chose, et le document se
  lit dans l'application (*Documentation technique › Licence*).

- **Un socle de vérification, exécutable sans navigateur.** Le pari d'architecture — le métier ne
  touche ni au DOM ni au réseau — devient vérifiable : `npm test` éprouve les modules **purs**
  (expressions, assainissement du fragment publié, numérotation, version), `npm run lint` **parse
  tout le JavaScript du dépôt** (`node --check`, sans aucune dépendance : du code qui ne se parse
  pas ne s'exécute pas), et `npm run verifier` enchaîne les deux. Un **pipeline d'intégration
  continue** (`.github/workflows/ci.yml`) les exécute à chaque envoi, avec les tests du domaine du
  service. Tout est décrit dans `src/docs/INDUSTRIALISATION.md`, y compris ce qui **reste à mettre
  en place** (verrou de dépendances, analyse statique, tests de parcours).

- **L'identifiant ELI est une adresse : les liens ELI d'un acte publié mènent à l'acte, dans
  l'instance.** Un acte cite ses fondements par leur **identifiant ELI** (« eli:/fr/arr/2026/0464/vsl ») —
  c'est le visa d'adoption d'une annexe, ou le visa qui rappelle l'acte modificatif. Un identifiant
  n'est pourtant pas une adresse : aucun navigateur ne sait l'ouvrir, et le lien d'un acte publié ne
  menait donc nulle part. Le recueil, lui, **connaît ses actes** : il traduit l'identifiant en
  l'adresse de l'acte visé, et le lecteur reste dans l'instance — la mention écrite (« l'arrêté
  n°… du …, qui l'adopte ») ne change pas, seul le lien devient réel. Deux règles simples : un
  identifiant désigne l'**acte** (et non une version), donc c'est la version **en vigueur** qui est
  atteinte ; un identifiant que le recueil **ne connaît pas** (acte non publié, ou publié ailleurs)
  reste une **mention**, sans lien — un lien qui ne mène nulle part vaut moins que pas de lien. La
  même traduction se fait côté service sur un déploiement auto-hébergé, où la page publiée est servie
  en HTML **sans JavaScript** (voir `src/server/mysql/actes.mjs`).

- **L'identifiant ELI s'ouvre aussi comme une adresse.** Un lecteur qui a un ELI sous les yeux — dans
  un courrier, dans une citation, dans les données ouvertes — l'ouvre désormais d'un clic : sur un
  déploiement auto-hébergé, `/eli/arr/2026/0464/vsl` redirige vers la page de l'acte (le service sait
  résoudre l'identifiant sans JavaScript) ; ailleurs, l'adresse passe par la page (`?eli=…`). Le bloc
  **« Recueil ouvert »** de chaque acte porte cette adresse, à côté de l'adresse de référence et des
  représentations lisibles par machine ; un identifiant inconnu du recueil le dit clairement, plutôt
  que d'échouer en silence.

- **La signature simple : signer dans l'application, sans prestataire branché ni papier.**
  Toutes les collectivités n'ont pas de prestataire branché en API, et toutes ne veulent pas faire
  circuler du papier. Le circuit **simple** comble ce vide : le signataire ouvre l'acte dans Scribae,
  relit le document, coche une déclaration et **signe avec son compte**. La signature est
  cryptographique et horodatée comme dans le circuit électronique (même paquet, même empreinte
  SHA-256, même certificat de démonstration), et le service **vérifie l'empreinte** avant
  d'enregistrer le retour. Ce qui change, c'est ce qui l'accompagne : le nom, la fonction,
  l'**adresse électronique**, le compte, le moyen d'authentification, le poste et l'horodatage sont
  consignés dans la part **INTERNE** de l'original (voir ci-dessous), et les courriels adressés au
  titre de l'acte y sont joints — c'est la trace de **qui** a signé, **quand**, et **de quoi il a
  été averti**. Le circuit se règle comme les autres : Administration › Signature (circuit général),
  ou par trame (`simple_impose`, `simple_autorise`). Le dossier de signature simple s'ouvre depuis
  « Ma signature » (« Vérifier et signer ») comme depuis le circuit de l'acte, et se consulte après
  coup par « Dossier de signature (interne)… ».

- **L'original signé se partage en deux : une part PUBLIQUE, une part INTERNE.** Ce que le recueil
  donne à lire et ce que la collectivité doit pouvoir produire ne sont pas la même chose. La
  **part publique** — diffusée au recueil public, dans l'export JSON de l'original, dans les
  publications et par toutes les routes ouvertes — ne porte que le **nom**, la **fonction** et la
  **date** du signataire ; la **part interne** porte les **mentions nominatives** (adresse
  électronique, personne du référentiel, compte de l'application, compte de signature,
  authentification, poste, adresse réseau) et la **trace des courriels**. Elle est déposée avec la
  publication, rangée au registre, et **n'est servie par aucune route publique** : elle se lit dans
  l'application (« Dossier de signature (interne)… ») ou par la route **protégée**
  `GET /v1/actes/{id}/dossier-signature`, qui exige le jeton. Le circuit électronique en bénéficie
  aussi : ses signataires sont réduits de la même façon.

- **Notification par courriel — le service sait parler à un serveur SMTP.** Scribae n'envoie pas de
  courriel lui-même : il **demande** au service de le faire, et c'est le service qui parle au
  **serveur SMTP** de la collectivité (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`,
  `SMTP_PASS`, `SMTP_FROM`, `SMTP_FROM_NAME`, `SMTP_REPLY_TO` — voir `src/server/mysql/env.example`).
  Le **mot de passe SMTP ne quitte jamais le serveur** : l'application ne le voit pas, et l'écran
  d'administration ne montre que l'état de la chaîne. Le moteur SMTP est écrit pour l'occasion
  (`src/server/mysql/smtp.mjs`, RFC 5321/2045/2047 : EHLO, STARTTLS, AUTH LOGIN et PLAIN, encodage
  du sujet, corps en texte **et** en HTML) : pas de dépendance, donc rien à auditer d'autre que ce
  fichier. Six événements peuvent donner lieu à un message — acte à signer, acte signé, acte publié,
  acte à valider, acte à réviser, notification à l'intéressé —, chacun activable, avec un nom
  d'expéditeur, une adresse de réponse et une copie systématique ; Administration › **Courriel**
  règle la politique, montre l'état du serveur et permet un **message d'essai**. Un courriel qui ne
  part pas n'est jamais subi : il est **tracé « non envoyé »**, avec son motif, au journal **et**
  dans le dossier interne de l'acte concerné.

- **Un RÈGLEMENT annexé se publie aussi à part, au recueil, à titre informatif.** Tout ce qu'un acte
  adopte en annexe n'a pas la même valeur : un règlement intérieur, un règlement d'usage — un texte
  **normatif** — se consulte pour lui-même, comme un **code**, et non seulement dans la délibération
  qui l'adopte. Une trame d'annexe peut donc être déclarée **Règlement** (case « C'est un RÈGLEMENT :
  le publier aussi à part, au recueil », onglet « Trame ») : à la publication de l'acte qui l'adopte,
  l'annexe est déposée au recueil sous **son propre identifiant stable** (`eli:/fr/reg/…`, créé au
  premier acte d'adoption puis conservé — les publications successives en sont les **versions**, et
  c'est la dernière qui est en vigueur). La page du règlement se présente comme celle d'un texte
  informatif : ni opposabilité, ni « publié le », ni original signé — seule la décision d'adoption
  fait foi —, mais ses visas (dont celui de son adoption, qui est un lien), son identifiant, son
  thème et l'acte qui l'adopte. Le règlement compte ainsi parmi les publications : il se cherche, se
  classe par thème, et son identifiant s'ouvre directement (`?eli=eli:/fr/reg/2026/0418/vsl`, ou
  `/eli/reg/…` sur un déploiement serveur).

### Modifié

- **La documentation dit enfin ce que l'outil fait.** Le guide affirmait que l'assistant « ne signe
  pas à votre place et n'envoie pas les messages » : c'est faux depuis que le circuit de signature
  **simple** existe et que le service sait parler à un SMTP. La page publique affirmait que
  « l'application n'envoie rien à un service tiers » : les assistants interrogent bien un moteur de
  langage, et c'est maintenant dit, avec le tableau des données transmises et de leur destinataire
  (RGPD, art. 13 et 28). La spécification rangeait encore l'assistant dans le **hors périmètre**
  alors qu'il est livré et actif. La documentation d'exploitation écrit noir sur blanc **ce que la
  démonstration n'est pas** : ni un mode de conservation (son état est évinçé par ancienneté, sans
  sauvegarde), ni un service (les dépôts y sont partagés) — une installation qui produit des actes
  réels n'utilise qu'un service dédié ou sa propre base.

- **Une annexe ne porte plus ni l'autorité compétente ni la mention de publication au recueil.** Une
  annexe n'émane pas d'une autorité : elle est **adoptée** par un acte, et c'est cet acte qui se
  publie. Le compilateur retire donc de son document l'**autorité** (« La maire de … ») et la
  **mention de publication au recueil** (« Le présent arrêté est publié au recueil… ») — le bloc de
  signature l'était déjà. Les **visas** sont en revanche conservés : un règlement se fonde sur des
  textes, et le visa de son adoption (« Vu la délibération n°…, qui l'adopte ») le rattache à sa
  décision, où il devient un lien.
- **La recherche du recueil efface ce qui n'est pas un résultat.** Dès qu'une recherche est en
  cours — frappe dans l'entrée, ou choix d'un thème —, le carrousel « Derniers actes administratifs
  publiés » et la grille « Parcourir par thème » s'effacent au profit des seuls résultats ; ils
  reviennent quand on efface la recherche ou les filtres.
- **Le circuit de signature se lit à trois niveaux, et le choix du rédacteur est conservé.** Le
  sélecteur « Circuit de signature » de la rédaction, comme l'aide de l'administration, décrivent
  désormais les **trois** circuits (électronique, simple, externe) ; les trames peuvent imposer ou
  autoriser le circuit simple, en plus des réglages existants. Un acte **engagé** dans un circuit y
  reste, quel que soit le réglage général : le dépôt au service étant commun aux circuits
  électronique et simple, l'acte engagé dans le circuit simple n'est plus relu comme
  « électronique ».
- **Les dossiers d'administration gagnent l'onglet « Courriel »** et l'aide du circuit de signature
  décrit les trois circuits, les cas où l'un s'impose, et ce que chacun laisse au public.

### Corrigé

- **Un acte dont la lecture échoue n'est plus condamné à « Acte introuvable ».** Un service qui
  n'avait pas répondu dans le délai (canal encore froid, page qui vient de se charger) faisait
  afficher « Acte introuvable » — et la lecture n'était jamais retentée. L'écran distingue
  désormais la **panne passagère** de l'acte inconnu (« Le recueil est momentanément
  indisponible »), et propose de **réessayer** ; l'adresse par identifiant ELI (`?eli=…`) suit la
  même règle quand le registre n'a pas pu être lu.

- **L'aperçu du document dans la fenêtre de signature ne débordait pas de son cadre.** Le cadre
  (« 38 vh ») n'avait pas de hauteur contrainte sur son enfant : c'est la fenêtre entière qui
  défilait, et l'aperçu n'en était plus un. Le cadre est désormais celui qui défile.

- **L'espace public porte ses mentions légales et ses mentions d'accessibilité.** Le bas de page du
  recueil se ferme désormais sur ce que la loi attend d'un site public : des **mentions légales**, qui
  rappellent à quelles conditions un acte administratif est **publié, exécutoire et opposable** — la
  publication et la transmission au représentant de l'État valant naissance de l'opposabilité
  (article L. 2131-1 du code général des collectivités territoriales), et le **délai de recours de deux
  mois** à compter de la publication (article R. 421-1 du code de justice administrative) —, et des
  **mentions d'accessibilité**, qui rappellent les obligations du service de communication publique en
  ligne prévues par l'article 47 de la loi n° 2005-102 du 11 février 2005, l'existence de la
  **déclaration d'accessibilité** et du schéma pluriannuel, et la possibilité de **signaler un
  obstacle** — jusqu'à saisir le Défenseur des droits.
  L'administration **écrit** ces mentions (Administration › **Publication** › « Mentions du recueil
  public »), les remplace par un **simple lien** — les mentions légales du site principal de la
  collectivité, sa déclaration d'accessibilité —, ou les **désactive** ; chacune se règle
  indépendamment. Le texte saisi se replie sous son titre dans le pied de page : présent dans la page,
  mais sans envahir le bas du recueil. La démonstration montre les **deux formes** : les mentions
  légales de la Ville de Valmont-sur-Loire y sont écrites, et l'accessibilité renvoie à la déclaration
  publiée sur le site principal.

- **La démonstration est celle d'une collectivité d'une certaine importance.** Le jeu de données
  livré (mairie fictive de Valmont-sur-Loire) passe de dix-sept à **soixante-six actes**, répartis
  sur **vingt et une trames** — nominations et délégations de signature, arrêtés de police, permis
  de construire, marchés d'un établissement autonome, régies, subventions, engagements de dépense,
  avenants, concessions funéraires, occupations du domaine public, environnement, périscolaire,
  conventions, chartes — et il met en avant ce qu'une collectivité montre d'abord :
  - les **ANNEXES**, c'est-à-dire les documents *adoptés*, qui ne se signent ni ne se publient pour
    eux-mêmes : le **règlement d'accès à la restauration scolaire**, la **grille tarifaire des
    services municipaux** (le prix du repas de cantine, de l'accueil du matin et du soir), le
    règlement intérieur du conseil municipal, la charte de la participation citoyenne, et les
    documents joints à une manifestation (plan de circulation et de stationnement, programme,
    déroulé de la cérémonie). Leur texte suit l'original signé de l'acte qui les adopte ;
  - les **ÉVÉNEMENTS À VENIR** : la **fête du village** « Valmont en fête », le **marché de Noël**
    et la **cérémonie commémorative du 11 novembre**, chacun organisé par un arrêté du maire, avec
    son emprise, ses mesures de police et ses annexes — les actes qu'un administré vient consulter.
  Le **recueil public** s'ouvre donc sur quinze actes publiés, dont quatre à la une (le règlement
  de la restauration scolaire, la grille tarifaire, la fête du village et le marché de Noël), et
  huit thèmes. Le registre, lui, montre tout le reste : actes prêts, en attente de révision,
  incomplets ou revenus en brouillon, pour que chaque écran de l'atelier ait de quoi travailler.

- **Le recueil renvoie vers les autres recueils, et vers les sites de référence.** Une collectivité
  n'arrive pas vierge : elle a souvent tenu, avant Scribae, d'**autres recueils**. L'administrateur
  peut désormais les déclarer (Administration › **Publication › Recueils extérieurs et renvois**),
  sous trois natures : un recueil **« bis »** — tenu à part pour une raison technique (une entité
  autonome, un périmètre séparé) —, un recueil **inactif** — qui n'est plus alimenté —, pour lequel
  on précise la **période** couverte (« actes publiés du … au … »), plusieurs recueils inactifs
  pouvant se succéder au fil des changements de logiciel, et un **site de référence** (Légifrance,
  service-public.gouv.fr). Chaque renvoi porte un **libellé**, une **adresse** et une **précision**
  facultative ; on les ordonne et on les retire, et un bouton **« Rétablir les renvois livrés »**
  fait revenir Légifrance et service-public.gouv.fr. Ces renvois s'affichent **en bas de page** de
  l'espace public et **à la fin des résultats de recherche**, sous le titre **« Vous ne trouvez pas
  ce que vous recherchez ? »** — jamais deux fois sur la même page. Le **guide** en explique l'usage
  (chapitre « Publier l'acte »).

- **Un document Word ou LibreOffice devient une trame.** Le bouton **« Importer une trame »**
  accepte désormais un **document Word** (`.docx`) ou **LibreOffice** (`.odt`), en plus du
  fichier de trames JSON. L'application **relit le document** — sans rien installer — et en
  reconnaît la structure d'un acte : ligne d'autorité (celle de la collectivité, la ligne d'État
  n'étant retenue qu'à défaut), intitulé (dont le numéro, la date et le « portant … » deviennent
  `{{numero}}`, `{{dateSignature}}` et `{{objet}}`, et dont l'objet donne son nom à la trame),
  visas, considérants, formule d'édiction (qui décide du **type d'acte**), articles, divisions
  (Livre, Titre, Chapitre, Section), listes — celles du traitement de texte comme celles écrites
  à la main en « 1° », « 1) », « a) » —, tableaux, mention de recours et bloc de signature. Le
  signataire du document n'est jamais repris (il vient du champ « Signataire »). **Rien n'est
  enregistré** : la trame proposée s'ouvre dans l'éditeur, précédée d'une bande qui le rappelle,
  accompagnée de ses **points à vérifier** (ce que la relecture a décidé, et ce qu'elle n'a pas
  su faire), et l'éditeur choisit de l'enregistrer ou de l'abandonner. Une lecture automatique
  propose, elle ne décide pas.

- **Une trame reste en brouillon jusqu'à sa mise à disposition.** C'est la règle générale : un
  modèle se prépare à l'abri, puis s'ouvre. Tant qu'un éditeur n'a pas cliqué **« Mettre à
  disposition »**, la trame n'apparaît pas dans **« Rédiger un acte »** et son ouverture directe
  est refusée (sauf à un éditeur, qui doit pouvoir essayer son modèle, et sauf pour une rédaction
  déjà commencée). Le bouton — carte de la trame, bannière et en-tête de l'éditeur de trame,
  champ **« Statut »** de l'onglet « Trame » — est le même partout, et le geste inverse
  (« **Retirer** ») rebascule la trame en brouillon sans toucher aux actes déjà rédigés à partir
  d'elle. Les deux sont inscrits au **journal** (`trame.disponible` / `trame.retiree`). Une trame
  **créée, dupliquée ou importée** arrive donc toujours en brouillon ; le badge de son statut dit
  « **Mise à disposition** », et l'éditeur de trame porte une bande de tête quand elle est encore
  en brouillon.

- **Épingler un acte, et le recueil public le met à la une.** L'onglet **Actes** porte, sur
  chaque acte publiable, un bouton **punaise** (permission `publications.epingler`, rôles
  administrateur et éditeur) qui le fait entrer — ou sortir — de la bande **« À la une »** du
  **recueil public**. La bande s'affiche sur la page d'accueil du recueil, au-dessus du carrousel
  des derniers actes (qui, lui, ne les répète pas) : c'est la place d'un **règlement intérieur**,
  d'une charte, du document qu'un visiteur vient chercher. Elle s'efface dès qu'une recherche ou
  un filtre est posé, et ne montre que les versions en vigueur. On peut épingler un acte **avant**
  sa publication : son drapeau part avec la version déposée. Le drapeau suit l'**ACTE** (son
  identifiant ELI), non la version publiée : un acte **modifié ou consolidé reste à la une** — la
  route `POST /v1/publications/{cle}/epingle` le pose sur toutes les versions et la publication
  suivante l'hérite. Le geste est réversible, audit-é au journal (`publication.epingle` /
  `publication.desepingle`), et le service auto-hébergé (Node/MySQL) comme celui de
  l'environnement d'édition l'exposent à l'identique ; le jeu de démonstration épingle la
  délibération qui adopte le règlement intérieur.

- **Chaque bloc de texte a désormais ses propres réglages — et un tableau ou une liste s'éditent
  vraiment.** Un **paragraphe** règle son alignement, son retrait (alinéa, ou paragraphe entier en
  retrait) et son encadré ; une **liste** choisit ses puces (ronde, creuse, carrée, tiret, aucune)
  ou sa numérotation (« 1. », « 1° », « 1) », « a) », « A) », « i. », « I. ») et son numéro de
  départ ; un **tableau** place sa légende au-dessus ou au-dessous, affiche ou non sa ligne
  d'en-tête, se dessine en quadrillage, en lignes horizontales seules ou en lignes alternées, et
  aligne ses cellules ; des **considérants** reçoivent la formule qui les introduit (« Considérant
  que… », jamais répétée si le texte la porte déjà), leur ponctuation finale et le choix de se lire
  d'un seul alinéa. Tout se règle **bloc par bloc** — dans l'éditeur de trame (onglet « Ce bloc »)
  comme par la rédaction (panneau « Mise en forme ») — et la valeur « comme la feuille de style »
  laisse la charte de la collectivité décider : c'est ce que fait tout bloc qui ne demande rien de
  particulier, y compris ceux qui existaient avant cette version. Les réglages suivent partout :
  aperçu, atelier, PDF, Word, HTML autonome, Markdown, Akoma Ntoso, et les réglages ajustés par la
  rédaction sont signalés comme des écarts, lus en clair (« MODÈLE 1° 2° 3° / VOUS a) b) c) »).
  L'aperçu d'édition montre le réglage aussitôt — la formule et la ponctuation des considérants y
  sont écrites en gris, telles que le compilateur les ajoutera.

- **Un tableau s'édite dans le document, une liste aussi.** Dans l'éditeur de trame, le tableau de
  l'aperçu n'est plus une image : chaque case se réécrit (jetons de champs compris), une gouttière
  offre d'**insérer ou retirer** chacune de ses colonnes et chacune de ses lignes, et une barre
  ajoute une colonne ou une ligne à la fin ; l'inspecteur donne en plus la **grille complète** —
  une case par cellule, et de quoi déplacer, retirer ou ajouter lignes et colonnes. Une liste gagne
  les mêmes gestes sur chacun de ses éléments (« + » pour insérer le suivant, corbeille pour le
  retirer) et se termine par « Ajouter un élément ». Aucune de ces commandes n'appartient à l'acte :
  l'impression les efface toutes.

- **Des vrais comptes, avec mot de passe — sans annuaire et sans service à installer.** Une
  collectivité qui n'a pas d'annuaire à brancher pouvait jusqu'ici soit choisir un compte dans une
  liste (démonstration), soit brancher OpenID Connect. Il y a désormais un troisième mode, activé
  dans le `.env` du déploiement (`AUTH_MODE=password`) : **identifiant et mot de passe**, que le
  service vérifie lui-même, et une **session** dans un cookie `HttpOnly`. Rien ne fuit : le service
  ne conserve qu'un **dérivé `scrypt`** scellé (sel et paramètres compris dans la chaîne), jamais le
  mot de passe ; la comparaison est à temps constant ; le message ne dit jamais si l'identifiant
  existe ; après cinq échecs le compte se ferme un instant (de plus en plus longtemps, plafond
  15 minutes). Côté navigateur, l'écran de connexion gagne l'identifiant, le mot de passe avec son
  œil, et un **jeton anti-CSRF** accompagne chaque écriture (double envoi cookie + en-tête), parce
  que le cookie de session, lui, est invisible du JavaScript. Le **compte d'administration** se
  configure dans le `.env` (`ADMIN_LOGIN`, `ADMIN_PASSWORD`) et se crée au premier démarrage ; il
  crée ensuite les autres depuis *Comptes et rôles* — chaque nouveau compte enchaîne sur la remise
  de son mot de passe, et un compte sans mot de passe ne peut pas se connecter. Un administrateur
  enfermé dehors se dépêtre en ligne de commande :
  `node server.mjs --mot-de-passe <identifiant>` (le mot de passe est lu sur l'entrée standard). La
  fenêtre d'administration d'un compte dit l'état de son mot de passe (défini, provisoire, bloqué,
  dernière remise, tentatives manquées) et permet d'en **engendrer un provisoire** — le service le
  montre **une seule fois**, à transmettre par un canal sûr, et exige son changement à la première
  connexion. Le **mode démonstration** se règle dans le même `.env` (`DEMO_ACCOUNTS`) : fermé par
  défaut en mode mot de passe, il peut rester ouvert pour une recette — l'écran de connexion garde
  alors le raccourci « choisir un compte », servi par le service. Les jetons d'API ne sont plus
  acceptés dans ce mode : une écriture sans session est refusée, un jeton écrit dans une page
  publique ne pouvant rien protéger.

- **L'atelier de rédaction se pilote comme un traitement de texte.** Quatre gestes manquaient, et
  ils sont là. **Cliquer un bloc ouvre ses options** dans le panneau de droite : un onglet « Bloc »
  apparaît, avec ce que le bloc est (article, division, paragraphe, visas…), d'où il vient, son
  **intitulé**, son **numéro** (automatique ou écrit à la main), son **échelon** pour une division,
  ses **éléments** (les visas, les considérants, les items d'une liste, qu'on y écrit, qu'on y
  déplace et qu'on y supprime), ce qu'on peut **ajouter dedans**, et de quoi le déplacer ou le
  retirer. **Supprimer un bloc se fait d'un clic** : la corbeille est sur le bloc lui-même, et
  « Contrôle & écarts » le rétablit à tout moment — le bloc n'est jamais retiré de la trame, il est
  retiré du document. **Ajouter un paragraphe, un visa, un considérant ou un élément** se fait sans
  quitter le document : un « + » sur chaque élément insère le suivant, un bouton « Ajouter un visa »
  ferme chaque liste, et le panneau du bloc propose les ajouts qui ont un sens à cet endroit-là. Ce
  qui est ajouté ou retiré est un **geste de rédaction, non une modification du modèle** : la trame
  reste intacte, et l'onglet « Contrôle & écarts » tient la liste de ce qui a changé — chaque ligne
  pouvant être rétablie ou retirée d'un clic. Enfin, une **bibliothèque de variables** ouvre le
  panneau de droite : les champs de la trame et les informations que l'application remplit seule
  (la collectivité, le signataire, la date, le numéro…), cherchables, et qu'on **glisse dans le
  document** — ou qu'on clique pour les poser d'un clic dans le texte. Les blocs d'un même article
  reçoivent, au passage, la même barre d'outils que ceux du corps du document : ils se déplacent,
  se commentent et se suppriment comme les autres.
- **Réorganiser le document, d'un geste.** Dans l'atelier de rédaction, chaque bloc du document —
  un article, une division, un visa, un considérant, une mention — se **déplace** désormais pour de
  bon : deux flèches sur le bloc, ou une prise pour le **glisser** à sa place (la poignée, ou le
  numéro de l'article, qui est la prise naturelle : c'est ce qu'on vise en pensant « cet
  article-là »). Le texte déplacé est **renuméroté** — remonter l'article 3 en tête en fait
  l'article 1er —, mais seuls les numéros que l'application attribue bougent : un numéro écrit à
  la main reste ce qu'il est. Le déplacement est un geste de rédaction, pas une modification de la
  trame : le modèle est intact, et l'onglet « Contrôle » dit ce qui a bougé et le défait d'un clic
  (« Ranger comme la trame »). Un bloc de tête (l'intitulé, l'auteur de l'acte) ne se déplace pas :
  il est à sa place par nature.
- **Les divisions : un texte ne se compose pas que d'articles.** Une trame peut désormais ranger
  son contenu en **Livres, Titres, Chapitres, Sections** — et sous le mot qu'elle veut (« Partie »,
  « Chapitre liminaire », « Annexe »…), puisque **l'échelle des divisions appartient à la trame**,
  non au logiciel : l'onglet « Trame » de l'éditeur en règle le nombre d'échelons, le mot de
  chacun et sa façon de numéroter (chiffres romains, arabes, lettres, ou rien). La hiérarchie est
  ainsi **pré-intégrée au modèle** : dans le document, une division se place à l'un de ces
  échelons, en contient d'autres ou des articles, et la numérotation suit — « Livre Ier »,
  « Titre Ier », « Titre II », « Livre II »… puis le compte repart pour chaque échelon ouvert.
- **Les annexes : un document adopté par un autre, publié à part.** Un règlement intérieur adopté
  par une délibération, une grille tarifaire adoptée par une décision : le document **annexé** ne
  tient pas son existence de lui-même. Une trame peut donc se déclarer de nature **Annexe**
  (onglet « Trame »), et trois choses s'ensuivent. À la rédaction, l'annexe **désigne l'acte qui
  l'adopte**, et cet acte **lui est rappelé en tête de ses visas** (« Vu la délibération n°… du …,
  qui l'adopte ; ») ; réciproquement, l'acte qui adopte **annonce ses annexes** à la fin de son
  dispositif. À la fiche de l'acte, un encart dit **d'où le document vient** (l'acte d'adoption) et
  **ce qu'il annexe**, avec un lien vers l'autre fiche. En ligne, la version publiée porte le même
  encart, puisque l'annexe est publiée **séparément**, sous son propre identifiant ELI.
- **Modifier une annexe : l'adoption d'une nouvelle rédaction.** Une annexe ne se modifie pas
  article par article comme un acte ordinaire. L'écran « Modifier » ouvre donc, pour elle, le
  régime qui lui convient : l'acte modificatif **adopte la nouvelle rédaction** de l'annexe
  (« … portant adoption de la nouvelle rédaction du règlement intérieur n°… »), l'article premier
  énonce cette adoption, et le texte, présenté **en suivi des modifications**, part avec l'acte
  comme une annexe à publier. L'annexe est ensuite modifiée par ce même chemin, et sa fiche
  enregistre l'acte qui vient de l'adopter. La modification **classique** (mention expresse,
  article par article) reste à un clic : c'est elle que demande parfois une décision qui vise
  expressément tel article.
- **La démonstration montre le mécanisme.** Deux trames et deux actes s'ajoutent à la
  démonstration : une **délibération** et le **règlement intérieur** qu'elle adopte — un document
  de nature « Annexe », rangé en **Titres** et **Chapitres**, muni du **visa de son acte
  d'adoption**, annoncé en fin de dispositif de la délibération, publié **séparément** sous son
  propre identifiant ELI. Les trames de division et d'annexe ne sont plus seulement décrites :
  elles se visitent.

- **L'assistant répond même sans moteur de langage.** Quand aucun moteur n'est branché — sur une
  page servie en statique (GitHub Pages), ou un déploiement sans API —, Plume et Publia ne
  restent plus muets : ils **cherchent** la réponse dans ce qu'ils savent. Plume rend le chapitre
  du guide qui traite de la question, avec son lien ; Publia retrouve les actes publiés qui y
  correspondent, avec leurs dates, leur identifiant ELI et leur lien — et l'acte que le lecteur
  consulte passe devant. Aucun appel réseau, aucune clé, rien à installer : rien de ce que l'on
  demande ne sort du navigateur. Ce sont des **extraits, pas des réponses rédigées**, et l'écran
  le dit dans une note discrète ; dès qu'une adresse de moteur est renseignée (ou sur Perchance),
  la rédaction reprend la main sans qu'on ait rien d'autre à changer.

- **Signer sur papier (ou par un outil tiers) : le circuit de signature externe.** Tout ne passe pas
  par un prestataire branché en API. Beaucoup de collectivités font signer leurs actes **sur
  papier** — ou par un outil que l'application ne pilote pas. Un second circuit existe donc, qui
  n'appelle **aucune** API de signature : le rédacteur « **envoie à signature** », ce qui veut ici
  dire **télécharger** le document prêt à signer (une page A4, avec son **bordereau de remise** :
  référence, objet, entité, trame, empreinte du document remis et marche à suivre) ; le signataire
  signe **hors de l'application** (stylo, ou outil tiers) ; le rédacteur **rentre la version signée
  dans la base** — « **Ajouter la version signée** », un **PDF**, dont l'empreinte SHA-256 est
  calculée à la volée et le fichier déposé ; et le **réviseur certifie la conformité** de la
  **pièce signée** avec la version numérique qui sera publiée. Son contrôle change de nature : dans
  ce circuit, il ne porte plus sur le texte **avant** signature, mais sur le document **signé** —
  c'est ce qui garantit que ce qui est publié est bien ce qui a été signé. La certification est
  entourée de garde-fous : elle se donne point par point (signataire, conformité du texte,
  intégrité de la pièce, date), un **refus** exige un motif écrit et renvoie l'acte attendre une
  version signée conforme, et une **nouvelle** version signée annule la certification précédente.
  Le circuit se règle à **deux niveaux**, et rien n'est codé en dur : **globalement**
  (Administration › Signature : circuit électronique, le défaut historique, ou circuit externe),
  et **par trame** (onglet « Trame » de l'éditeur : *suivre le réglage général*, *circuit externe
  **imposé***, *circuit externe **autorisé*** — le rédacteur choisit alors, acte par acte, entre
  les deux —, ou *circuit électronique imposé*). Un acte **déjà engagé** dans un circuit y reste
  quoi qu'il arrive ensuite : changer le réglage ne déplace pas un acte en cours de route. Sur le
  **recueil public**, l'« original » d'un acte ainsi signé n'est plus un paquet JSON mais **la
  version signée elle-même** : le PDF est montré dans la page, tel qu'il a été mis en ligne, avec
  l'attestation de conformité du réviseur — c'est **lui** qui fait foi, le texte en ligne n'en
  étant qu'une lecture pratique. Le service tient les mêmes règles de son côté (nouvelles routes
  `POST /v1/actes/{id}/signature-externe` et `POST /v1/actes/{id}/conformite`, refus de publier
  tant que la version signée manque — 409 `version_signee_absente` — ou que la conformité n'est
  pas certifiée quand un réviseur est compétent — 409 `conformite_non_certifiee`) ; et les actes
  dont la conformité est à certifier sont **ouverts aux réviseurs compétents**, même hors de leur
  périmètre, sans quoi leur contrôle ne pourrait jamais s'exercer.

- **Commenter un article, ou un passage — et ne plus pouvoir rater un commentaire.** Le commentaire
  d'une trame se posait par l'inspecteur, sur le bloc sélectionné ; en dehors de ce panneau, il ne
  se voyait nulle part. Deux gestes lui rendent sa place, et l'un ne va pas sans l'autre.
  **On commente ce qu'on voit** : un bouton « commenter » est posé sur chaque bloc de la page, et —
  pour viser une phrase précise — il suffit de **sélectionner le passage** dans le document, ce qui
  fait apparaître une pastille **« Commenter »** qui ouvre la fenêtre d'écriture **en citant le
  passage choisi**. **On ne peut plus les manquer** : le commentaire s'affiche **dans la page**,
  sous le bloc qu'il vise, en bande nettement distincte du texte de l'acte (fond coloré, filet
  pointillé, nature et auteur rappelés, passage cité en italique) ; un **repère de marge** numéroté
  marque chaque bloc commenté ; l'en-tête de l'éditeur annonce le compte et ouvre la liste d'un
  clic ; et un onglet **« Commentaires »** les rassemble tous, rangés par bloc, chacun menant au
  passage qu'il vise. À la **rédaction**, les consignes laissées par les administrateurs
  apparaissent de la même façon **sous le passage concerné**, en lecture seule, avec un onglet
  « Consignes » et un compteur cliquable dans l'en-tête de l'acte : le rédacteur ne peut plus les
  ignorer. Le passage cité accompagne le commentaire partout — aperçu, inspecteur, exports Akoma
  Ntoso et Markdown, rapport de conformité.

### Modifié

- **La page d'accueil du logiciel est le recueil public.** Ouvrir l'adresse de l'installation
  — sans ancre ni paramètre — menait à l'atelier : un visiteur tombait donc sur l'écran de
  connexion, et l'installation se présentait par sa porte de service. C'est le **recueil des actes
  publiés** qui s'ouvre désormais : la page que le public peut lire, et que l'on peut citer. La
  route par défaut est `recueil` (`src/ui/state.js`), si bien que le premier chargement, l'adresse
  nue, l'ancre vide (`#/`) et **toute adresse inconnue** — une ancre mal recopiée, un écran qui
  n'existe plus — mènent à la page d'accueil du site, et non à l'atelier (`normaliserRoute`,
  `src/ui/app.js`). L'atelier reste à un clic : la porte **« Se connecter »** de l'en-tête du
  recueil, ou l'ancre `#/trames` (que l'application n'écrit jamais elle-même). L'écran de connexion
  n'est pas pour autant un cul-de-sac : il porte une porte **« Consulter le recueil public »**. Rien
  d'autre ne change : le recueil ne suppose aucun compte, et un agent connecté y lit exactement ce
  que lit un passant.

- **L'emblème de la commune a été redessiné.** Le blason de la ville fictive de Valmont-sur-Loire
  — un écu français, un soleil d'or, deux monts et la Loire — était juste dans ses parties mais
  approximatif dans son dessin : des rais trop longs et trop écartés du disque solaire, des cimes
  enneigées trop fines, et des filets clairs là où deux aplats voisins partageaient un bord.
  Il est repris : rais courts et rapprochés, cimes enneigées lisibles, galon unique, et un liseré
  de leur propre couleur sur les cimes et les bandes d'eau — c'est ce liseré qui efface le filet
  que l'anticrénelage laisse entre deux aplats. L'emblème paraît dans l'en-tête, sur l'écran de
  connexion, dans le guide et sur le recueil public ; c'est le référentiel qui le porte
  (`brand.logoUrl`), et un référentiel de démonstration reprend celui du jeu livré.

- **L'amorçage du recueil public se fait par étapes, et sait reprendre.** Publier la démonstration
  demande de déposer puis de publier chaque acte sur le service, un par un. Les actes s'enchaînaient
  sans respiration, et le service — tenu à un budget de calcul soutenu — finissait par refuser ses
  gestionnaires. L'amorçage marque désormais une **pause entre deux actes**, s'arrête après deux
  échecs consécutifs plutôt que d'attendre une réponse qui ne viendra pas, et reprend au démarrage
  suivant là où il s'était arrêté (ce que le service détient déjà n'est jamais redéposé). Il publie
  par ailleurs **quinze actes choisis** — les six annexes, les trois événements, et un document de
  chacune des autres familles — au lieu de tous ceux que la fiction déclare publiés : la
  démonstration s'ouvre plus vite, et le recueil montre toujours toute la variété.

- **La connexion ne charge plus rien avant d'avoir identifié l'agent.** En mode « comptes locaux »,
  le référentiel est protégé : l'application interroge d'abord le service (`GET /v1/auth/config`),
  et ne demande **aucune donnée** tant qu'aucune session n'est ouverte — l'écran de connexion se
  dessine avec la marque par défaut, et la liste des comptes ne vient plus du référentiel mais de la
  session ouverte. Corollaire : un référentiel neuf, sur un déploiement qui ferme les comptes de
  démonstration, ne reçoit **plus** les comptes fictifs (ils n'auraient pas de mot de passe) ; un
  nouveau compte créé dans *Comptes et rôles* enchaîne directement sur la remise de son mot de
  passe ; et « Ouvrir une session » (le raccourci de démonstration d'une ligne du tableau) disparaît
  dans ce mode, puisque seule une session ouverte par le service donne accès aux données. Le menu du
  compte porte « **Changer mon mot de passe** » et « Se déconnecter » (au lieu de « Changer de
  compte »), et le changement de mot de passe est proposé d'office quand le mot de passe est
  provisoire — sans jamais enfermer l'agent, qui peut reporter le geste.
- **Une annexe ne se signe pas : son texte suit l'acte qui l'adopte.** Jusqu'ici, une annexe (un
  règlement intérieur adopté par une délibération, une grille tarifaire adoptée par une décision)
  était traitée comme un acte à part entière : elle se signait, se publiait sous son propre
  identifiant ELI, et l'acte qui l'adoptait se contentait de l'annoncer. Ce n'est pas la règle :
  **l'annexe ne tient pas son autorité d'elle-même**. C'est **l'acte qui l'adopte** qui est signé, et
  **l'original signé de cet acte est désormais suivi du texte de l'annexe**, dans le même document,
  à la suite de la signature et **sur une page neuve**. Concrètement : le document d'une annexe ne
  porte plus de bloc de signature et son atelier ne demande plus de signataire (son champ de date
  devient « Date d'adoption ») ; l'acte d'adoption affiche le texte de ses annexes **en lecture
  seule sous le document**, avec un bouton qui mène à l'annexe dans son propre acte ; l'écran
  « Signature & publication » d'une annexe ne propose plus ni envoi en signature ni publication —
  il renvoie vers l'acte d'adoption ; et les exports (HTML, Word, Markdown, Akoma Ntoso
  `<attachments>`, impression) portent cette partie annexée. Le rapport de conformité et le schéma
  Schematron savent qu'une annexe n'a ni signataire ni bloc de signature. La **nature du document**
  voyage aussi avec l'export Akoma Ntoso (`<ia:nature>`, relu à l'import), et **le lecteur AKN
  signale** — au lieu de le taire — qu'un fichier est suivi du texte de ses annexes
  (`<attachments>`) : une annexe demeure un acte à part, joint à son acte d'adoption depuis le
  registre. Dans la démonstration, le
  règlement intérieur n'est plus signé ni publié à part : c'est la délibération qui l'adopte (et son
  original) qui les porte.

- **Les écarts à la trame se lisent désormais par nature.** Un écart n'était qu'un texte réécrit.
  L'onglet « Contrôle & écarts » distingue maintenant trois choses, chacune dite avec ses mots et
  défaite d'un clic : les **réécritures** (« modèle » / « vous »), les **réglages de bloc
  modifiés** (l'échelon d'une division, sa numérotation) et les **changements de structure** (un
  bloc ou un élément ajouté, un passage retiré). Rien n'est bloqué : ce qu'un rédacteur adapte est
  conservé, et ce qu'il ajoute ou retire est conservé aussi — mais jamais sans trace.

- **L'acte est nommé comme le référentiel le nomme.** La fiche d'un acte, et les actes
  modificatifs qui le visent, l'appellent désormais par son **appellation** — « Règlement
  intérieur n° 2026-77 » plutôt que « Acte n° 2026-77 », « Vu la délibération n°… du… » plutôt que
  par un mot générique. L'appellation vient du **type d'acte** de la trame
  (Administration › Référentiel › Types d'actes) : c'est le vocabulaire de la collectivité, et il
  commande aussi le genre de l'article défini (« le règlement », « la délibération », « l'arrêté »).

- **La page d'accueil du dépôt dit ce que font les assistants, et comment les brancher.** La
  section « Installer » (GitHub Pages) précise qu'à cette forme les assistants répondent **sans
  moteur de langage** — ils retrouvent le chapitre du guide ou l'acte publié — et comment donner
  à une collectivité des réponses rédigées, en renseignant l'adresse de son API de langage
  (Administration › Assistants).

- **Le guide montre l'atelier tel qu'il est.** Les deux captures du chapitre « Écrire un acte, pas
  à pas » (« L'écran de rédaction » et « Le panneau Contrôle & écarts ») dataient d'avant la
  bibliothèque de variables, l'onglet « Bloc » et les outils de structure : elles sont refaites, et
  leurs repères numérotés montrent désormais la barre d'outils d'un bloc, la bibliothèque de
  variables, le panneau du bloc désigné et les trois registres du contrôle.

- **Le guide et l'onglet « Annuaire » expliquent les trois façons de se connecter.** Un
  administrateur qui cherche où se règlent les comptes à mot de passe trouve la réponse là où il
  cherche : le chapitre du guide s'intitule désormais **« Ouvrir les sessions : annuaire, ou comptes
  locaux »**, et y décrit les **comptes locaux** (identifiant, mot de passe, mot de passe provisoire
  à changer à la première connexion) à côté de l'annuaire, en rappelant que ce mode **n'a pas
  d'écran** — il se règle dans le `.env` du déploiement (`AUTH_MODE=password`,
  `ADMIN_LOGIN`/`ADMIN_PASSWORD`, `DEMO_ACCOUNTS`). Dans **Administration › Annuaire (OIDC)**, le
  mode « Comptes locaux (mot de passe) » **n'est plus offert au choix du référentiel** — un mode qui
  dépend du service ne s'y décide pas, et le proposer aurait pu enfermer dehors un administrateur
  exigeant un mot de passe que rien ne vérifie ; et quand le déploiement l'impose, l'onglet l'annonce
  et précise que les comptes de démonstration sont, là aussi, l'affaire du `.env`.

- **Une annexe n'a plus de numéro.** C'est la suite logique de son régime : puisqu'elle n'est ni
  signée ni publiée pour elle-même, elle n'occupe aucune place au recueil — un numéro n'aurait rien
  à identifier. Son identité, c'est la **décision** qui la fait exister : celle qui l'**adopte**,
  celle qui en adopte la **nouvelle rédaction** (sa modification) ou celle qui l'**abroge**. Là où
  un acte ordinaire montre « n° 2026-416-VSL », l'annexe montre à quoi elle tient — « **Annexe à la
  délibération n° 2026-416-VSL du 24 septembre 2026** » sur sa fiche, « annexe à 2026-416-VSL » dans
  le registre, « **Annexe — Règlement intérieur du conseil municipal** » dans une liste. Elle garde
  un identifiant **interne** (liens, historique), invisible du lecteur. Concrètement : l'atelier ne
  lui propose **ni champ ni variable** de numéro (donc **aucun numéro n'est consommé**, dans
  l'application comme auprès d'un service de numérotation), la compilation ne lui donne **pas d'ELI**
  et son Schematron ne réclame pas de numéro, et les tournures de modification la désignent par sa
  décision : « portant adoption de la nouvelle rédaction **du règlement (la délibération n° … du …)** ».
  La trame du règlement, dans la démonstration, en est dépouillée.

### Corrigé

- **La formule d'un considérant ne se répète plus.** Un considérant dont le texte commence par
  l'**élision** de la formule du bloc — « **Considérant qu'**il est nécessaire… » sous la formule
  « Considérant que » — recevait la formule une seconde fois, et le document signé s'ouvrait sur
  « Considérant que Considérant qu'il est nécessaire… ». Le moteur d'assemblage compare désormais le
  début du texte à la formule **élidée** comme à la formule entière, ainsi qu'à ses ponctuations
  (« Considérant, ») : un considérant qui porte déjà la formule la garde telle qu'elle est écrite,
  et rien ne s'y ajoute. Deux actes du jeu de démonstration portaient la faute dans leur document
  signé ; un nouveau jeu de données les régénère.

- **Le recueil de démonstration se remplit même quand le service répond en retard.** L'amorçage
  part au démarrage, en même temps que le reste de l'application : si la page est alors occupée (un
  jeu de démonstration à reconstruire, un registre volumineux à écrire) ou que le canal du service
  n'est pas encore ouvert, la première lecture du recueil échouait, et le recueil restait **vide de
  toute la session** — rien à démontrer. Cet amorçage est désormais **repris** quelques fois, à
  intervalles croissants, tant qu'il reste des actes à publier ; comme il ne redépose jamais ce que
  le service détient déjà, une reprise ne produit ni doublon ni republication.

- **L'état durable du service ne se relit plus corrompu.** Le service de démonstration range tout
  son état dans un document JSON unique, écrit dans la mémoire durable qui lui est allouée. Deux
  défauts se conjuguaient : l'écriture se faisait sur place, si bien qu'un instantané prélevé au
  milieu du geste (l'environnement peut en prendre à tout moment) donnait un document tronqué —
  relu ensuite en entier, pour rien, jusqu'à épuiser le budget de calcul d'un gestionnaire ; et
  l'état, plein d'accents, traversait une couche de persistance qui n'est pas garantie binaire. La
  version est désormais **effacée avant la première écriture et rétablie en dernier** : un état
  relu au milieu du geste se reconnaît à sa version, sans rien relire. La lecture contrôle
  l'en-tête (le document commence toujours par `{"v"` et finit par `}`) avant toute lecture de
  masse, et l'échappement ASCII — qui protège les accents — se fait par plages, sans expression
  régulière : c'était le poste le plus coûteux de l'écriture. `GET /v1/health` publie enfin
  `utilise` (la place occupée) à côté de `capacite`, pour voir venir un état trop gros.

- **Le glisser-déposer ne dépend plus du navigateur, et il fonctionne au doigt.** Déplacer un bloc
  dans l'éditeur de trame reposait sur le glisser-déposer HTML5 : il ne répond pas au doigt (ni
  sur iOS, ni de façon fiable sur Android), et le navigateur **interrompt le geste dès que la
  source quitte le document** — ce qui arrive précisément ici, un re-rendu pouvant suivre la perte
  du focus d'un bloc en cours d'édition. Le geste passait alors pour mort. Le moteur
  (`src/ui/dnd.js`) s'appuie désormais sur les **pointer events** : souris, doigt et stylet suivent
  le même chemin, et le geste ne dépend plus d'une API capricieuse. Deux gains d'usage au passage :
  **le bloc entier se saisit** (poignée ⠿, intitulé, marges) au lieu d'une poignée de quelques
  pixels — un appui dans le texte continue d'y placer le curseur, et un appui sur un bouton de la
  barre d'outils fait ce que dit ce bouton ; et une **étiquette suit le pointeur** pendant le
  geste, en disant ce qu'on déplace (le doigt, lui, n'a pas de curseur). La hauteur des barres
  « + » ne change plus pendant le glisser : le document ne se décale plus sous le pointeur, et
  l'on dépose là où l'on visait.
- **Un glisser ne peut plus vider une place dans la trame.** L'adresse d'un bloc saisi était relue
  au lâcher sans vérifier qu'elle désignait encore quelque chose : quand l'arbre avait bougé
  entre-temps, le déplacement retirait une place **vide** et la réinsérait — la trame se corrompait,
  et l'éditeur refusait ensuite de s'ouvrir (« Cannot read properties of undefined »). Le
  déplacement vérifie désormais la source, et les parcours de trame (rendu, commentaires) ignorent
  une place vide plutôt que d'échouer.

- **L'intitulé d'un acte modificatif ne dit plus « de le ».** Quand l'appellation de l'acte modifié
  était un nom masculin non élidé (« le règlement »), la phrase de l'acte modificatif donnait
  « portant modification **de le** règlement » : le « de » n'était pas contracté avec l'article. Il
  passe désormais par la forme contractée (« de la décision », « du règlement », « de l'arrêté »).
  Le défaut ne se voyait pas avec les appellations que la démonstration emploie (délibération,
  décision, arrêté, toutes féminines ou élidées) ; il est apparu avec les annexes, qui sont
  désignées par leur décision d'adoption (voir ci-dessus).

- **Le service annonçait un délai de blocage sans le transmettre.** Quand une connexion était
  refusée parce que le compte venait d'être fermé après plusieurs échecs, le service calculait bien
  le nombre de secondes à attendre (`retry-after`)… et le perdait en chemin : sa fabrique de
  réponses d'erreur n'acceptait pas d'en-têtes. L'agent voyait « trop de tentatives » sans savoir
  combien de temps patienter. Trouvé par le nouveau banc d'essai du domaine des comptes
  (`comptes.test.mjs`, `npm test` dans `src/server/mysql`) — 27 épreuves sans base ni réseau, qui
  couvrent le scellement, le blocage, l'expiration d'une session, l'anti-CSRF et les droits.
- **Un bloc ajouté hors article sort dans tous les formats.** Un paragraphe, une liste ou un
  tableau posé directement dans le corps du texte (ou dans une division) par la rédaction —
  désormais possible depuis l'atelier — s'affichait bien à l'écran et à l'impression, mais
  disparaissait du **Markdown** et de l'**Akoma Ntoso** : ces deux écritures ne parcouraient que le
  contenu des articles. Le Markdown les écrit maintenant comme les blocs d'un article (les
  marques de modification suivent), et l'Akoma Ntoso les range dans un `<block>` générique que la
  relecture reprend à l'import — un aller-retour du document ne perd plus ce que la rédaction a
  ajouté. Les paragraphes, listes et tableaux posés dans une **division** sont couverts par le même
  chemin.
- **Sur GitHub Pages, les éléments cachés le sont vraiment.** L'application masque ce qui ne sert
  pas en posant l'attribut `hidden` ; c'est la plateforme Perchance qui en faisait une règle de
  style, et une page servie en statique ne l'a pas. Un panneau dont la fermeture faisait
  `display: flex` restait donc **ouvert** : le panneau de conversation de l'assistant ne se
  fermait pas, sa zone de saisie s'affichait même sans moteur, et le bouton « Arrêter »
  apparaissait avant toute génération. La feuille de style reprend la règle manquante
  (`[hidden] { display: none !important; }`), ce qui rétablit partout le même comportement qu'à
  l'éditeur.
- **Un article rangé dans une division retrouve son numéro et son intitulé.** Dans l'atelier de
  rédaction, les articles placés en Titres ou Chapitres s'affichaient comme de simples
  paragraphes : ni numéro, ni intitulé, et pas de prise pour les déplacer. Le rendu des articles
  est désormais le même partout dans le document — un article se déplace aussi **à l'intérieur**
  d'une division, et se renumérote.
- **La liste des annexes survit à l'Akoma Ntoso.** Le document annonçait ses annexes à l'écran et
  dans le Markdown, mais l'export Akoma Ntoso les perdait. Elles y sont maintenant portées par un
  bloc `<attachments>` — l'élément prévu pour les documents adoptés et annexés —, chacune avec son
  intitulé et son identifiant ELI.
- **Un texte structuré n'est plus importé comme vide.** Rouvrir un acte rangé en divisions depuis
  son Akoma Ntoso signalait à tort qu'aucun article n'avait été trouvé, la recherche ne regardant
  qu'à la racine du corps ; elle descend maintenant dans les divisions.
- **Un texte rangé en divisions se modifie comme les autres.** L'écran « Modifier » n'atteignait
  que les articles du corps : les articles placés dans un **Titre** ou un **Chapitre** (un
  règlement intérieur, par exemple) n'étaient ni modifiables, ni abrogeables — la modification
  d'un tel texte était impossible. Les divisions sont désormais parcourues partout où le sont les
  articles (l'ordre **imprimé** du document, `flatNodes`) : l'éditeur de modification rend
  éditables les articles de division, un article inséré « après » l'un d'eux prend place **dans
  cette division**, « ajouter en fin de dispositif » entre dans la **dernière** division quand le
  texte s'y termine, « abroger tout l'acte » et « tout renuméroter » les couvrent, et la version
  consolidée y marque ses ajouts et suppressions. Le **rapport de conformité** compte aussi ces
  articles, au lieu de les ignorer.
- **« …l'adoption de la nouvelle rédaction DU règlement intérieur… ».** Les tournures d'adoption
  d'une annexe enchâssaient l'appellation de la cible sans contracter l'article : l'acte
  modificatif annonçait « …portant adoption de la nouvelle rédaction **de le** règlement
  intérieur… ». Un jeton `{targetDe}` (« du règlement intérieur n°… », « de la délibération
  n°… », « de l'arrêté n°… ») corrige l'intitulé, l'objet et l'article premier de l'acte
  modificatif.
- **Sur un écran étroit, l'atelier ne garde plus les marges de la page A4.** Les marges réglées
  dans la charte (2 à 3 cm de chaque côté) laissaient, sur un téléphone, une colonne de texte de
  quelques mots par ligne. L'atelier de rédaction les réduit en deçà de 1100 px de large : la mise
  en page de la page — celle de l'impression et des exports — reste inchangée.
- **Les commentaires ont désormais leur onglet, et le bloc renvoie à eux.** L'inspecteur de
  l'éditeur de trame prend un cinquième onglet, **« Commentaires »**, qui porte le compte et
  rassemble tous ceux de la trame (auparavant, ils étaient enterrés au bas de l'onglet « Ce
  bloc ») ; l'onglet « Ce bloc » n'en garde qu'un renvoi, avec le compte du bloc sélectionné. Le
  commentaire est aussi plus complet : il peut **citer un passage** (`quote`), conservé à
  l'import/export du fichier de trame, dans l'Akoma Ntoso (relu par `akn.js`), le Markdown et le
  rapport de conformité. Le format de fichier des trames documente la nouvelle clé.

### Ajouté

- **Les actes d'assemblée — les délibérations des conseils.** Un acte n'émane pas toujours d'une
  personne : une **délibération** émane d'une **assemblée** — le conseil municipal d'une commune, le
  conseil d'administration d'un établissement public. Ces actes ont désormais leur ligne d'autorité
  propre : ils portent **« Le conseil municipal de … »**, « Le conseil d'administration de … » — et
  non la formule d'une personne — tandis qu'ils sont **signés par le président de l'assemblée** : le
  maire, pour un conseil municipal ; le président du conseil d'administration, pour un établissement.
  Une trame qui produit un acte d'assemblée se déclare par le réglage **« Acte d'assemblée —
  délibération »**, dans l'inspecteur de trame.

- **L'écran « Administration › Assemblées ».** Les conseils se décrivent comme le reste du
  référentiel : pour chacun, son **entité de rattachement**, son **nom**, sa **formule d'autorité**
  (la ligne d'en-tête de l'acte) et la **qualité qui signe** — le maire, ou le président du conseil
  d'administration. C'est ce dernier choix qui rend la règle **configurable par assemblée**, sans
  toucher au code : un conseil municipal fait signer son maire, un conseil d'administration son
  président.

- **Le jeton `{{autorite}}`.** Les trames d'acte d'assemblée le posent dans leur ligne d'autorité :
  il rend la formule de l'**assemblée** quand l'acte en émane, et celle de l'**entité** sinon. Les
  jetons `{{conseil.name}}`, `{{conseil.authorityFormula}}` et `{{conseil.signerQualite}}` — proposés
  dans l'éditeur des trames d'assemblée — disent l'assemblée elle-même.

- **Le contrôle de conformité dit l'assemblée.** Le rapport du réviseur constate que l'acte émane
  d'une assemblée, rend sa formule d'autorité, et **vérifie que le signataire — ou un délégataire de
  sa chaîne — tient bien la qualité appelée** par l'assemblée : un signataire hors compétence est
  signalé.

- **La trame « Délibération du conseil d'administration ».** Le jeu de démonstration gagne cette
  seconde délibération, celle de l'office public de l'habitat : elle montre une assemblée qui n'est
  pas le conseil municipal, et une signature qui n'est pas celle du maire.

- **L'export du journal d'audit du service.** La fenêtre du journal, dans *Administration › Base de
  données*, gagne un bouton **« Exporter (JSON) »** : le journal append-only se télécharge pour être
  archivé hors du service (le service n'en conserve que les **2 000 dernières entrées** — la
  rétention est désormais dite dans la fenêtre).

- **Un analyseur de style sans dépendance** (`npm run style`, et `npm run lint` l'appelle). Écrit en
  quelques lignes de Node, il refuse `debugger` et signale les déclarations `var` et les traces
  `console.log` laissées dans le code client — sans installer le moindre paquet.

### Modifié

- **L'écrasement sans contrôle de révision (`force`) est réservé à l'administration.** La
  synchronisation d'une collection acceptait `force` de **tout rôle d'écriture** : un poste muni d'une
  clé de rédaction pouvait écraser en silence l'écriture d'un autre. Le geste — une reprise de
  données — exige maintenant le rôle **administrateur**, il est **journalisé**, et les autres rôles
  reçoivent le conflit au lieu de l'écraser. Même règle côté service auto-hébergé.

- **Une transmission au contrôle de légalité simulée le dit.** Quand aucun appel sortant n'a eu lieu
  (le cas de la démonstration), l'accusé de réception est marqué **« simulation »**, et la mention
  portée sur le document est **qualifiée** (« mention de démonstration — transmission simulée, sans
  appel sortant ») : on ne prend plus un certificat fabriqué pour un certificat opposable. Une
  intégration @ctes réelle lèvera le marqueur.

- **L'identifiant ELI et son adresse ne se confondent plus.** Le recueil nomme désormais, d'un côté,
  l'**identifiant** (`eli:/fr/…`, non résoluble tel quel) et, de l'autre, l'**adresse ELI** HTTP qui
  en dérive — celle qui se cite et s'ouvre. La règle vit dans un point unique (`eliAdresse`), d'où
  elle alimente aussi le `FRBRuri` du document Akoma Ntoso.

- **`src/lib/revisions.js` devient `src/lib/historique-brouillons.js`.** L'ancien nom jouxtait
  `revision.js` (le circuit de révision avant signature) pour un objet tout différent — l'historique
  de travail des brouillons. Le renommage lève l'ambiguïté.

- **Le libellé du geste d'épinglage suit l'état de l'acte.** Un libellé unique — « Épingler à la une
  du recueil public » / « Retirer de la une du recueil public » —, et la distinction « dès sa
  publication » réservée aux actes **non publiés** : on ne lit plus qu'un acte publié serait épinglé
  « dès sa publication ».

## [1.2.0] — 2026-09-20 — Signer par délégation

Cette livraison fait de la **signature** une qualité à part entière : elle **découle d'une
désignation** dans l'organigramme des délégations, elle se donne **avec son compte**, et elle
s'appuie sur les **décisions** qui fondent le pouvoir de chaque étage de la chaîne — nommément
visées sur l'acte, avec leur lien, sur le web comme en PDF. La présentation du logiciel expose
désormais les **obligations du CRPA** auxquelles il répond, et les feuilles de style gagnent deux
modèles aux couleurs de l'État.

### Ajouté

- **Deux modèles de charte aux couleurs de l'État.** Les **Feuilles de style** gagnent deux modèles
  de départ : « **Charte graphique de l'État** » — bleu France (#000091), typographie Marianne,
  en-tête et filet —, **réservé à l'État et à ses opérateurs** (la police Marianne et le
  bloc-marque étant réservés, le logiciel ne les livre pas : l'administration les ajoute), et
  « **Marianne-like** », la même sobriété et les mêmes couleurs **sans les éléments réservés**, en
  Arial et avec l'identité de la collectivité, utilisable par toute administration. Chaque modèle
  porte son étiquette dans la liste (« réservé », « libre »).
- **Le nom et l'icône des assistants se règlent.** L'administrateur change, dans **Administration ›
  Assistants**, le **nom** et l'**icône** de chaque assistant — un champ pour l'un, une adresse
  d'image pour l'autre, avec un aperçu vivant. L'interface suit **partout** : la pastille, le
  panneau, la bulle d'invitation et le menu du compte. Un champ laissé vide rend la main aux
  valeurs livrées (« Plume », « Publia ») : l'application ne montre jamais un assistant sans nom
  ni sans visage. Le réglage suit l'export du référentiel, comme le reste.
- **Chaque agent peut masquer un assistant pour son seul compte.** Le menu du compte porte un bloc
  **Assistants** — deux boutons, avec l'icône de chacun —, à côté du choix d'apparence. C'est une
  **préférence de poste**, comme l'apparence claire ou sombre : elle ne touche pas au réglage de
  l'installation, vaut par compte (deux agents qui partagent un poste gardent chacun la leur) et
  survit au rechargement. À défaut de réglage, l'assistant est **allumé**. Le réglage
  *Éteint* de l'Administration reste, lui, une décision pour **tout le monde**.
- **Les assistants renvoient par des liens que l'on clique.** Plume termine sa réponse par le
  **lien du chapitre du guide** qui répond à la question ; Publia recopie le **lien d'un acte** du
  recueil. Ces liens s'ouvrent **dans l'application**, sans recharger la page ni ouvrir d'onglet.
  Le moteur ne fabrique aucun lien : il recopie ceux qu'on lui donne, déjà libellés. Et **Publia
  sait quel acte est consulté** : quand un lecteur ouvre un acte du recueil, l'assistant reçoit sa
  fiche, ses versions publiées et son texte, et **répond d'abord sur cet acte** — ce qu'il prévoit,
  sa portée, ses dates, ses modifications, ses évolutions — même si la question n'est pas posée.
- **La qualité de « Signataire ».** Un signataire n'est pas un agent comme un autre : c'est
  l'auteur de l'acte, celui dont la signature engage la collectivité. L'application distingue
  désormais cette **qualité** des autres **profils d'accès** : elle ne se choisit pas dans une
  liste, elle **découle d'une désignation**. Dès qu'une personne est désignée quelque part dans
  l'**organigramme des délégations** — comme autorité qui délègue, ou comme délégataire qui
  signera —, le compte rattaché à cette personne reçoit la qualité de **Signataire**, sans qu'il
  faille être administrateur : un **éditeur** qui désigne quelqu'un dans l'écran Délégations la
  lui attribue de la même façon. La qualité est **cumulable**, comme celle de **Réviseur** : elle
  n'enlève aucun profil, elle ajoute la qualité de signer. Elle ouvre l'écran **Signature &
  publication** (onglet « Ma signature ») et les gestes de signature.
- **Un signataire ne voit, dans l'atelier, que les actes relevant de son champ de compétence.**
  C'est la conséquence directe de la qualité : les actes dont la signature relève de lui — ceux
  qu'il **signe lui-même**, et ceux que signent ses **délégataires**, car c'est alors sa propre
  signature qui est engagée, par délégation puis subdélégation — lui sont ouverts, et ceux-là
  seulement. Le champ de compétence se lit dans la **chaîne de signature** de l'acte : y figurer,
  à quelque étage, c'est être compétent. Le registre des actes le dit quand la liste contient des
  actes venus de la compétence plutôt que du périmètre administratif.
- **Un signataire signe avec son compte, et son compte se rapproche de l'outil de signature.**
  L'annuaire de la collectivité (OIDC) délivre le compte de l'application **et** provisionne le
  même agent sur l'**outil de signature** : deux rapprochements en découlent, que l'application
  rend explicites. La **personne du référentiel** — celle qui porte la qualité — est rattachée à
  son **compte** (Comptes et rôles › « **Personne du référentiel — qui signe** »), et ce compte
  est rapproché du **compte de l'outil** que l'annuaire lui connaît. L'état du rapprochement se
  lit et se corrige à trois endroits : la **fiche** de l'acteur dans l'écran **Délégations**, la
  **fiche du compte** (Comptes et rôles) et l'onglet **« Ma signature »**. Un signataire sans
  compte, dont le compte est désactivé, sans adresse, ou non rapproché, ne peut pas signer — la
  signature serait anonyme : l'application le dit au moment où on le désigne (sous le champ du
  signataire, à la rédaction), et sur l'écran de signature. Le panneau de l'outil affiche le
  **compte de signature** retenu et avertit quand il manque.
- **L'onglet « Ma signature ».** Un signataire ouvre l'écran **Signature & publication** sur son
  propre onglet : son **identité de signataire** (la personne qu'il tient, sa qualité, son compte,
  l'état du rapprochement), les **actes qui attendent sa signature** — avec le geste *Déposer et
  signer* ou *Signer* pour chacun —, et les **actes signés au titre de sa signature**, c'est-à-dire
  ceux dont la signature est engagée par ses délégataires. Les deux listes ne contiennent que des
  actes de son champ de compétence.
- **Signer un acte est une permission à part entière.** Elle ne se confond plus avec la
  publication : `actes.signer` ouvre l'écran de signature et les gestes qui engagent la signature,
  tandis que `signature.gerer` reste la conduite de la **publication** (recueil, identifiant ELI,
  formalités, transmission). Un signataire peut donc signer sans pouvoir publier.

- **L'organigramme des délégations de signature est un écran de plein droit, visible par tous.**
  Il quitte les réglages de l'Administration pour un écran **Délégations**, dans le menu. On y
  voit d'un coup d'œil **qui peut signer à la place de qui** : chaque chaîne part de son autorité
  de tête et descend, de délégation en sous-délégation. Un nœud reste court — nom, qualité,
  organisation, rang — et **un clic ouvre la fiche** de l'acteur : le pouvoir reçu (délégant,
  organisation, décision), l'étendue (famille, type d'acte, matières), les dates, et **la
  signature que cela produira** — les lignes « Le Maire, / Par délégation, … » et les visas,
  recalculés à la frappe. L'écran est **visible par tous les comptes** ; seuls les
  **administrateurs et les éditeurs** peuvent le modifier (les autres lisent la même fiche, sans
  les champs de saisie). Deux présentations au choix : **organigramme** (qui défile
  horizontalement sur un écran étroit) ou **liste** indentée. Créer une délégation passe par un
  **brouillon** — le référentiel n'est écrit qu'à la confirmation —, et une délégation dont le
  délégant est vide, inconnu ou forme un cycle est signalée « non rattachée ».
- **Le signataire se choisit par sa fonction, et non par son nom.** Au moment de désigner qui
  signera l'acte, l'application ne propose plus un annuaire de noms mais un **choix en deux
  temps** : la **fonction** d'abord — la qualité qui donne compétence pour signer —, puis, **parmi
  les personnes qui la tiennent**, celle qui signe. Les fonctions proposées viennent du
  référentiel : les **rôles** (Administration › Rôles) et les **délégations de signature**
  (écran **Délégations**), groupées « Fonctions (rôles) » et « Par délégation de
  signature ». Seules apparaissent celles qui ont du sens **pour cet acte** : une délégation
  donnée dans le nom d'une autre organisation ne s'affiche jamais, et une délégation limitée à une
  famille ou à un type d'acte ne s'affiche que sur ces actes. Quand une fonction ne peut être
  tenue que par une personne — le cas d'une délégation —, celle-ci est retenue d'office ; quand
  plusieurs personnes la tiennent, c'est au rédacteur de désigner qui signe. La chaîne de
  délégations et les décisions visées restent affichées sous le champ, et la qualité imprimée ne
  change pas : elle vient de la délégation quand il y en a une.
- **L'éditeur de trame peut fixer la fonction attendue du signataire.** La question du signataire
  porte un réglage **« Fonction attendue »** (« Maire », « Adjoint au maire », une délégation
  précise…). Le modèle fixe alors la qualité — c'est le cas de l'arrêté portant délégation de
  signature, que le maire signe toujours —, et le rédacteur ne fait plus que désigner qui la
  tient. Rien n'est bloqué : il peut toujours écarter cette fonction, et le signataire déjà retenu
  sur un acte reste proposé même s'il n'a pas la qualité attendue.
- **Les listes numérotées prennent la numérotation de l'usage administratif — « 1° 2° 3° ».**
  La charte distingue désormais la **puce** des listes à puces et la **numérotation** des listes
  numérotées : huit formats au choix (« 1. », « 1° », « 1) », « a) », « A) », « i. », « I. »,
  aucune), réglés dans les **Feuilles de style** (rubrique « Listes »). Surtout, le rédacteur peut
  enfin **choisir le genre de chaque liste** — « À puces » ou « Numérotée » — dans l'inspecteur de
  l'éditeur de trame : un même acte peut donc mêler une énumération « 1° 2° 3° » à une liste de
  puces. C'est la charte qui décide ensuite de leur apparence, et l'acte type de l'aperçu porte
  une liste de chaque genre pour montrer les deux réglages.
- **Les encadrés tracent désormais les côtés que l'on veut.** Chaque présentation « Encadré » —
  intitulé de l'acte, intitulé d'article, formule d'édiction, mentions, bloc de signature —
  propose quatre cases (haut, droite, bas, gauche) : un filet se pose ainsi seul sous un intitulé,
  ou l'encadré s'ouvre du côté où le texte respire.
- **Un compte authentifié sans rôle n'est plus refusé : il est accueilli en visiteur.** Un agent
  que l'annuaire reconnaît mais dont **aucun groupe** ne correspond à un rôle de l'application —
  ou un compte dont les rôles ont été retirés — n'est plus arrêté à la porte : la session
  s'ouvre, l'application constate qu'il n'a **aucun accès**, et lui présente un **écran qui le lui
  explique** — qui est connecté, les **groupes reçus de l'annuaire**, le **contact du service qui
  gère l'application**, et deux boutons : **Consulter l'espace public** (le recueil) et
  **Changer de compte**. Le rôle **« Visiteur »** matérialise cet état (aucune permission) : il
  s'attribue comme les autres dans **Comptes et rôles**, la matrice des droits lui donne sa
  colonne, et un visiteur n'entre ni dans la navigation, ni dans la présence collaborative.
- **Le recueil public est la porte d'entrée de l'application.** Pour qui n'a pas de compte, le
  recueil *est* l'interface : son en-tête propose désormais **« Se connecter »** — un bouton, et
  non plus un simple lien — qui ouvre l'écran de connexion (comptes de l'application ou annuaire,
  selon le référentiel). Un agent connecté y garde **« Retour à l'application »**, et un visiteur
  sans rôle y trouve **« Mon accès »**, qui mène à l'écran d'explication.
- **Le recueil public s'ouvre sur une vraie page d'accueil, et se parcourt par matière.** La liste
  des actes publiés ne s'ouvre plus sur un formulaire : la page présente d'abord l'organisation et
  sa phrase d'accueil, puis un **carrousel « Derniers actes administratifs publiés »** — les actes
  **en vigueur**, du plus récent au plus ancien, que l'on fait défiler par flèches ou au doigt,
  une carte par acte mettant en avant sa **matière** —, et une **grille des thèmes**, une tuile par
  matière présente au recueil (urbanisme, police, finances…), avec son libellé, sa phrase de
  présentation et son nombre d'actes. Cliquer une tuile **filtre** la liste sur ce thème (le second
  clic la dé-filtre) ; la **recherche** et les filtres fins — **thème**, nature, année, entité —
  restent sous la grille, où la liste se range par année. La liste et la page d'un acte affichent
  désormais la **matière de l'acte** (son thème), mise en avant. Le thème d'un acte est la
  **famille de sa trame** ; sa **phrase de présentation** s'édite dans Administration › Familles
  (« Présentation du thème »). Une installation **auto-hébergée** sert la même page sans
  JavaScript : l'accueil y est rendu par le service (carrousel en défilement CSS, thèmes en grille,
  actes rangés par thème), et `llms.txt` et `recueil.json` annoncent les thèmes.
- **Un rôle « Réviseur » contrôle les actes entre la décision d'envoyer et l'envoi.**
  Le réviseur s'intercale entre le geste du rédacteur (« Envoyer en signature ») et l'envoi
  effectif : il reçoit pour chaque acte un **rapport de conformité** (contrôles de la trame,
  structure du document, visas et références, mentions et publicité, écarts et annotations),
  peut **corriger** l'acte, puis le **valider** — l'acte part alors en signature — ou le
  **rejeter**, et l'acte **revient en brouillon chez son rédacteur avec le motif** du rejet.
  Les actes à réviser se suivent dans un nouvel écran **Révision**
  (« À réviser par moi », « En attente d'un autre réviseur », « Révisés », « Rejetés »), avec le
  dossier de la révision à côté du rapport. Le rôle **se cumule** avec les autres : un éditeur
  peut être *éditeur* **et** *réviseur*. Sa **compétence** — certains services, familles de
  trames, types d'actes ou entités — se règle sur le compte (Comptes et rôles), ou se donne à un
  **service entier**, ou à certains de ses bureaux, sur le service lui-même (Administration ›
  Services, « Qualité de réviseur ») : c'est le cas d'un service des affaires juridiques dont les
  agents contrôlent les actes des autres services. **Sans réviseur compétent, la révision n'existe
  pas** : l'acte part directement en signature, exactement comme avant. La révision porte sur le
  **texte exact** de l'acte (son empreinte est mémorisée) : s'il est réécrit après coup — par le
  rédacteur ou par le réviseur qui corrige une faute de frappe —, l'application le détecte, la
  révision devient **caduque** et doit être reprise ; c'est ce qui garantit que l'acte signé est
  bien celui qui a été contrôlé. Le service de signature applique la même règle de son côté : il
  refuse d'ouvrir un circuit sur un acte dont la révision n'est pas faite (409,
  `revision_incomplete`), comme il le fait déjà pour le parapheur.
- **Les actes publiés s'ouvrent aux moteurs de recherche et aux agents.** Un acte du recueil a
  désormais une **adresse de référence** stable — son identifiant ELI sous le recueil — et des
  **représentations lisibles par machine** : JSON (métadonnées, ELI et texte), **Markdown** (la
  structure de l'acte, la plus lisible pour un agent), texte brut et Akoma Ntoso. Sur une
  installation **auto-hébergée**, le service les sert lui-même, en pages HTML rendues sans
  JavaScript : `/recueil` (la liste), `/recueil/<clé>` (un acte), `/recueil/<clé>.json` — et
  `.md`, `.txt`, `.akn` —, plus les fichiers que lisent les moteurs et les agents : `/llms.txt`,
  `/recueil.json`, `/sitemap.xml` et `/robots.txt`. Ailleurs (démonstration statique, plateforme),
  la page porte les mêmes adresses en **paramètres de requête** (`?recueil=1`, `?acte=<clé>`,
  `&format=md`) : il faut alors un lecteur qui exécute le JavaScript. Rien n'est à activer — le
  recueil public change simplement d'adresses (les anciennes ancres `#/recueil…` laissent place à
  `?recueil=1` et `?acte=<clé>`, lisibles par une machine). Chaque page du recueil **se décrit**
  — titre, description, adresse canonique, une adresse par représentation, et les données
  structurées JSON-LD de la publication — et chaque acte **donne ses adresses à copier** (bloc
  « Recueil ouvert », sous le texte), au public comme à l'administration. Le texte publié en
  Markdown et en texte brut accompagne maintenant la publication : le service le sert tel quel, et
  la page sait le reconstituer pour les publications antérieures. Point de vigilance : ces
  représentations **ne portent pas les notes de préparation** — c'est l'acte qui est publié, pas
  les notes de l'atelier.
- **Les feuilles de style proposent une liste de polices, et les intitulés peuvent être encadrés.**
  Les trois polices d'une charte — corps du texte, intitulé de l'acte, intitulés d'article — se
  choisissent désormais dans une **liste**, rangée par familles (à empattements, sans empattement,
  à chasse fixe), au lieu d'un champ libre où il fallait écrire soi-même la pile CSS. Ce sont des
  polices **présentes sur les postes** : rien à installer, et la même police à l'écran, dans le
  PDF, dans le fichier Word et sur la version publiée — chacune est accompagnée de ses replis,
  car une même famille ne s'appelle pas pareil d'un système à l'autre. Le choix **« Autre (police
  personnalisée) »** reste ouvert, pour une police propre à la collectivité. La **même liste**
  sert au champ « Police des documents » de l'Administration. Par ailleurs, l'**intitulé de l'acte** et
  les **intitulés d'article** acceptent la présentation **« Encadré »** : l'intitulé s'inscrit
  alors dans un filet — du style et de la couleur des filets de la charte — comme la formule
  d'édiction ou les mentions.
- **La numérotation des actes peut s'adosser à un service externe.** Jusqu'ici, le numéro d'un
  acte était pris dans la séquence de l'application. Une collectivité qui **numérote déjà
  ailleurs** — le cas d'école étant un document **Grist**, où la **création d'une ligne attribue
  le numéro** — peut désormais faire attribuer le numéro par ce service (Administration ›
  Numérotation › *Attribution du numéro*). À l'écran de rédaction, le bouton devient **« Demander
  le numéro »** : la demande part, avec un indicateur d'attente, et le numéro rendu par le service
  remplit le champ. Le référentiel règle tout l'appel — **adresse**, **méthode**, **en-têtes**
  (c'est là que va la clé d'API), **corps de la requête**, et surtout **où lire la réponse**
  (par exemple `records[0].id`) — avec les jetons `{objet}`, `{entityCode}`, `{year}`… et un
  **préréglage Grist** qui pose la forme attendue. Un bouton **« Tester l'appel »** éprouve le
  réglage, en annonçant qu'un essai de POST crée réellement une ligne. La **référence de la ligne
  créée** est conservée sur l'acte, affichée sur sa fiche, et l'attribution entre au **journal
  d'audit** ; l'échange lui-même est journalisé, requête et réponse, dans « API & journal »,
  comme les appels au prestataire de signature. Deux points à savoir avant de s'en servir :
  l'API de **Grist refuse l'en-tête `Authorization`** d'une origine de navigateur qu'elle ne
  connaît pas — la demande passe donc par le **relais HTTP** de l'hébergement (elle peut aussi
  passer en direct, si l'origine de l'application est déclarée origine de confiance chez
  Grist) ; et la **clé d'API est conservée dans le référentiel**, donc dans les sauvegardes et
  la base partagée — mieux vaut une clé restreinte à la seule table de numérotation.
- **Noter l'existence d'un recours, et sa date d'introduction.** Un acte exécutoire peut être
  contesté, et l'administration l'apprend par la pièce qu'elle reçoit. L'échéancier
  (**Exécution & délais**, onglet **Recours**) permet désormais de **constater ce recours** :
  **date d'introduction**, **nature** (gracieux, hiérarchique, contentieux, référés, déféré du
  préfet), **auteur**, **référence** (n° de requête, avis de réception) et une observation libre.
  La date d'introduction **ferme le délai de recours contentieux** : l'acte passe au statut
  **« Recours introduit — contentieux en cours »** — il n'est plus *définitif* une fois le délai
  échu, et il le reste **jusqu'à la décision du juge**. La mention se **corrige** ou se **retire**
  (journalisée dans les deux cas). L'échéancier distingue donc les **recours ouverts** (le délai
  court encore) des **recours introduits**, et son compteur les compte séparément. Le jeu de
  démonstration porte un **permis de construire contesté** devant le tribunal administratif.
- **L'attestation de non-recours, pour un acte définitif.** Quand le délai de recours est échu
  **et** qu'aucun recours n'est enregistré, l'échéancier propose de **délivrer une attestation de
  non-recours** : une pièce sur papier A4, à imprimer ou à enregistrer en PDF, qui identifie
  l'acte, atteste qu'**aucun recours n'a été porté à la connaissance de la collectivité**,
  rappelle les **formalités par lesquelles l'acte est devenu exécutoire** et la **date
  d'expiration du délai**, et se présente **prête à signer** (qualités et nom de l'autorité,
  emplacement du cachet). Une attestation ne pouvant certifier qu'il n'y a pas eu de recours, la
  pièce **refuse de se produire** pour tout autre acte (délai en cours, formalité manquante,
  recours enregistré) : elle dit alors pourquoi. La délivrance est inscrite au **journal**.
- **L'état des formalités, en PDF, pour tout acte signé.** Quel que soit l'état de l'acte —
  formalités en cours, exécutoire, contesté, définitif —, l'échéancier permet d'**exporter le
  détail des formalités et de leurs dates** : un tableau (formalité, requise ou non, **date**,
  **référence**, **modalité**, **constatée par**), le **certificat de transmission** s'il existe,
  puis la **situation** (date d'exécutoire, délai de recours, recours éventuel). C'est la pièce de
  suivi du dossier — celle qu'on classe au dossier ou qu'on joint à une demande de subvention.
- **Le bandeau de démonstration s'affiche aussi sur le recueil public.** Un visiteur qui consulte
  les actes publiés d'une installation de démonstration en est désormais averti : le bandeau
  orange « Démonstration » coiffe le recueil, comme il coiffe l'atelier et l'écran de connexion
  (avec le lien *Réglage* pour un administrateur connecté ; le visiteur, lui, ne voit que la
  mention). Il reste commandé par le même réglage — Administration › Identité › **Mention de
  démonstration** — et disparaît donc en même temps partout.
- **L'original signé se consulte depuis le recueil public, à la demande.** La page d'un acte
  n'affiche pas l'original d'office : un bouton **« Voir l'original signé »** l'ouvre dans une
  **fenêtre**, où l'on peut aussi l'**imprimer ou l'enregistrer en PDF**. La pièce est le texte
  tel qu'il a été signé, suivi de son bloc de signature (identité, certificat, empreinte,
  horodatage) — c'est elle qui fait foi ; le texte publié n'en est qu'une lecture pratique.
  L'original n'était jusqu'ici accessible que depuis l'administration.
- **Le retrait d'un acte du recueil, réservé à l'administrateur.** Un acte publié peut être
  retiré du recueil — pour un **motif technique** seulement : dépôt en double, dépôt erroné, acte
  publié avant signature, identifiant attribué à tort. Le geste s'ouvre depuis la consultation
  d'une publication (écran **Publications (ELI)**), sous une **permission dédiée**
  (`publications.depublier`, rôle **administrateur** seul). Il est précédé d'un **avertissement en
  grand** : un acte administratif publié **ne se retire jamais**, et seul un motif technique le
  justifie ; ni le retrait ni l'oubli ne sont un moyen de corriger un acte, qui doit être
  **modifié** ou **abrogé** et rester au recueil. Le **motif technique** est **obligatoire** et
  **conservé** : il est inscrit **sur la fiche de l'acte** et au **journal** (action
  « publication.depublie »). L'acte redevient **signé**, publiable à nouveau, et sa publication
  disparaît du recueil.
- **Les décisions fondant la signature, visées automatiquement.** Chaque étage d'une chaîne de
  délégations tient son pouvoir de **décisions** : l'autorité de tête (le maire), d'une seule — la
  délibération qui lui a donné son pouvoir ; un **délégataire**, de **deux** — la décision de
  **nomination** qui l'a nommé à sa fonction, et la décision de **délégation** qui lui a donné le
  droit de signer. Chacune se renseigne d'un **acte publié au recueil** (le visa portera le lien du
  recueil en ligne), d'un **lien externe** (le texte vit ailleurs : site de la collectivité,
  Légifrance, intranet), ou d'une **référence du référentiel** qui porte son adresse. Renseignées —
  sur la **fiche de la personne** (Administration › Personnes, « Décision fondant son pouvoir de
  signer ») pour l'autorité, et sur chaque **délégation** (écran **Délégations**, « Les
  décisions fondant la signature ») pour les étages suivants —, elles entrent d'elles-mêmes dans les
  **visas** de l'acte, **dans l'ordre — la nomination avant la délégation, à chaque étage** : sur une
  signature par subdélégation, l'acte vise ainsi la délibération du conseil, puis, pour chaque
  étage, la nomination et la délégation. Chaque visa porte son **lien cliquable**, sur le web comme
  en PDF. Un signataire **ne se configure pas** sans ses deux décisions : l'écran Délégations
  **refuse de créer** une délégation dont l'une manque, et une délégation déjà enregistrée sans
  elles est **signalée** (badge « Décisions à compléter », alerte sur la fiche, contrôle de
  conformité à l'attention de la révision). Les visas et les décisions attendues s'affichent **sous
  le champ « Signataire »** pendant la rédaction, et sous chaque délégation de l'arbre
  (écran **Délégations**) : on vérifie la série sans rédiger d'acte pour voir.
- **L'accord des qualités en genre.** « Le maire » ou « **La maire** », « Le directeur général des
  services » ou « **La directrice générale des services** » : la qualité du signataire s'accorde
  désormais avec son genre, dans l'acte comme dans ses exports. Chaque rôle porte ses **deux
  formes** (Administration › Rôles), et l'accord se règle **au cas par cas** sur la fiche de la
  personne (Administration › Personnes). Une femme maire qui tient à être appelée « le maire » se
  règle ainsi en un clic.
- **L'arbre des délégations de signature.** Administration › **Délégations** permet de dire qui peut
  signer à la place de qui, sur autant d'étages que nécessaire — une autorité délègue, le
  délégataire sous-délègue (en principe interdit, en pratique dérogatoire). L'acte signé au bout
  de la chaîne porte alors **toutes les qualités traversées** :

  > Le Maire,
  > Par délégation, l'adjoint au maire en charge de l'urbanisme,
  > Par subdélégation, le chef de bureau Urbanisme,
  > Karim BENALI

  Seul le **Prénom Nom du signataire** s'imprime : les qualités des étages intermédiaires sont
  écrites, jamais les noms de ceux qui les portent. La chaîne suit la famille et le type d'acte de
  la trame, et se voit **sous le champ « Signataire »** au moment de le choisir.
- **La trame « Arrêté — permis de construire »** (service de l'urbanisme) et **un acte de
  démonstration signé** au bout d'une chaîne à trois étages : c'est le cas d'école des
  délégations, visible dès le registre.
- **Les autorités autonomes.** Toutes les chaînes ne descendent pas du maire : un **établissement
  public** a sa propre autorité de tête — le **président de son conseil d'administration** — et sa
  propre chaîne de délégations, parallèle à celle de la commune. Une autorité sans délégation
  entrante signe donc en son nom, avec sa qualité et la formule d'autorité de **son** organisation.
  Chaque délégation est désormais rattachée à une **organisation** (celle de son délégant, ou
  celle que l'administrateur impose — le maire déléguant dans le nom du CCAS qu'il préside) : les
  chaînes ne se mélangent plus d'une structure à l'autre, même quand une même personne y tient des
  délégations des deux côtés. Une délégation n'est retenue qu'**à la date de l'acte** : pas de
  signature en mars sur le fondement d'une délégation donnée en juin.
- **La démonstration en donne le cas complet** : l'**office public de l'habitat**, son président de
  conseil d'administration et sa directrice générale, sa propre trame (passation d'un marché
  public), ses propres visas, son propre circuit de validation, et une décision **signée par
  délégation** — « Le président du conseil d'administration, / Par délégation, la directrice
  générale de l'office, / Nadia MARCHAND ».
- **Les comptes du chef du bureau Urbanisme et de la directrice générale de l'office** dans
  l'annuaire de démonstration.
- **Les fonctions expérimentales** (Administration › **Expérimentale**) : des fonctions livrées,
  mais éteintes par défaut et activables d'un clic. La première est le **parapheur** — le circuit
  de validation des actes avant signature. Il est désormais **désactivé**, car beaucoup de
  collectivités ont déjà leur propre circuit interne, en amont de « Envoyer en signature ».
  Éteint, il disparaît entièrement de l'application (menu, écran, onglet de l'Administration, réglage
  de trame, fiche d'acte) et ne conditionne plus rien ; l'activer reconstruit au passage les actes
  de démonstration, pour que l'écran ne soit pas vide. Les circuits éventuellement enregistrés
  sont conservés.
- **La transmission au contrôle de légalité par API, entre la signature et la publication.**
  Administration › **Expérimentale** reçoit une seconde fonction : la **télétransmission**. Activée,
  l'étape s'intercale **automatiquement** entre le retour signé et la publication — l'acte signé
  part vers l'**API d'envoi** du contrôle de légalité (@ctes), l'accusé de réception de la
  préfecture est **déposé sur le document** (« Transmis au contrôle de légalité le 12 mars 2026 à
  09 h 14 », avec sa référence et son sceau), la formalité se constate d'elle-même, et l'acte est
  publié. L'ordre **signé → transmis → publié** est tenu par le service : un acte déclaré soumis à
  cette étape ne peut pas être publié tant que la transmission manque (409 `transmission_absente`),
  et rien ne se transmet avant la signature (409 `acte_non_signe`).
  **Désactivée par défaut** : la télétransmission suppose une convention et des identifiants
  d'accès auprès de la préfecture. Éteinte, rien n'est envoyé, la marche n'apparaît pas dans le
  circuit de signature, et la transmission — quand elle est due — se constate à la main depuis
  l'échéancier, comme les autres formalités. Les actes déposés avant l'activation ne portent pas
  l'exigence.
- **Le recueil public des actes administratifs.** Les actes publiés sont désormais consultables
  par **tout le monde, sans compte**, à une adresse publique (`…/#/recueil`) où ne figurent que
  la **structure** et ses actes : ni l'interface d'administration, ni le nom du logiciel. On y
  **cherche** un acte (texte libre sur le numéro, l'objet ou la nature ; filtres par nature,
  année et organisation), on parcourt la liste **groupée par année**, et l'on lit **l'acte
  directement dans la page**, présenté comme sur Légifrance : les **marques** (nature, version),
  le **titre** de l'acte, un bloc de **métadonnées** (identifiant ELI, dates, recueil), puis le
  **texte** dans une colonne de lecture — la décision n'est **pas enfermée dans une feuille A4**,
  elle fait partie de la page. Suivent ses **pièces et formats**, sa **signature** (vérifiable)
  et ses **versions**. Chaque acte a sa propre adresse, citable et partageable.
- **Le réglage « Publication automatique après signature »** (Administration › **Publication**, un
  onglet qui rassemble aussi le titre du recueil et la règle d'opposabilité). **Automatique**
  (défaut) : le retour signé publie l'acte, comme avant. **Désactivée** : l'acte signé ne
  déclenche plus rien — ni publication, ni transmission —, il attend au registre, à publier le
  moment venu depuis « Signature & publication ». C'est le réglage d'une administration qui
  publie dans **son propre système** et ne veut pas que l'application dépose les actes à sa
  place. Le fait est inscrit au journal.
- **La démonstration livre un recueil peuplé** : les actes que la fiction déclare publiés sont
  réellement déposés au service au premier démarrage, par le même chemin que l'écran de
  signature, pour que le recueil public ne soit pas vide. Idempotent, silencieux, et réservé au
  jeu de démonstration intact.
- **Deux assistants — « Plume » dans l'atelier, « Publia » sur le recueil public.** Une pastille
  flottante, un peu espiègle (elle propose d'elle-même une question de temps en temps), ouvre une
  conversation : Plume répond sur le **mode d'emploi de l'outil** — où cliquer, dans quel ordre,
  ce que veut dire un message —, Publia répond aux **visiteurs du recueil** sur les actes
  publiés. **Le contenu des actes n'est jamais transmis au moteur de langage** : Plume ne connaît
  que le guide d'utilisation, qui est public, et le nom de l'écran courant ; Publia ne voit que
  ce que le recueil affiche déjà à tout venant. Rien n'est à filtrer, parce que rien ne leur est
  envoyé. Chacun s'**éteint** séparément — éteint, il disparaît complètement — et se règle dans
  **Administration › Assistants**.
- **Le moteur de langage des assistants est interchangeable, et se règle par l'administration.**
  Par défaut, le moteur intégré de Perchance quand il existe, et l'API de la collectivité sinon.
  L'administrateur peut brancher sa propre API (adresse, clé, en-tête, modèle) en **complétions
  de conversation** — OpenAI, Mistral, Groq, OpenRouter, Ollama, LM Studio, vLLM… avec flux de
  réponse — ou en **appel simple** `{ prompt } → { texte }`, avec le relais sans CORS de la
  plateforme en option. Hors de Perchance, c'est le seul moteur possible : l'application s'en
  passe proprement tant qu'aucune adresse n'est réglée — l'assistant explique alors pourquoi,
  au lieu de rester muet.
- **L'administrateur gère les prompts des deux assistants.** Pour chacun, il modifie
  l'**instruction** donnée au moteur (le rôle, ce qu'il ne fait jamais, sa manière de répondre)
  et la liste des **questions proposées** (étiquette du bouton et question envoyée) : il en
  ajoute, en retire, et peut rétablir les réglages livrés. Un bouton « Tester le moteur » dit
  immédiatement si le moteur répond.
- **Le guide de l'application sait retrouver le bon chapitre.** La recherche ignore désormais la
  casse, les accents, la ponctuation et les mots grammaticaux, et rapproche les formes voisines
  (« exporte » retrouve « exporter ») : l'assistant joint ainsi les chapitres qui répondent
  vraiment à la question, et le guide se cherche mieux à la main.
- **Un acte peut désormais ABROGER un autre acte — ou l'un de ses articles.** Pendant la
  rédaction, l'onglet **« Abrogations »** du panneau de droite permet de prévoir, dans le texte
  même de l'acte, l'abrogation d'un acte **du registre** (désigné expressément : nature, numéro,
  date) ou d'un **article** de l'un de ces actes — la clause est composée d'avance (« L'arrêté
  n° … du … est abrogé à compter de l'entrée en vigueur du présent arrêté »), et peut être
  réécrite. Un acte hors de l'application se vise par un texte libre. L'abrogation prend effet au
  jour de l'**entrée en vigueur** de l'acte qui la porte — sa date d'effet, à défaut le lendemain
  de sa publication — et non au jour de la publication : arrivée à ce terme, l'application
  l'applique d'elle-même (marque sur l'acte visé, ou **version consolidée** à publier pour un
  article). Tout se règle dans **Administration › Vocabulaire › Abrogation — tournures**.
- **La corbeille est réservée aux brouillons ; les actes signés et publiés s'abrogent.** Un acte
  qui a quitté l'atelier ne porte plus de bouton corbeille : sur sa ligne du registre, c'est un
  bouton **« Retirer / abroger »** qui explique qu'un acte publié ne s'efface pas et propose de
  **rédiger un acte d'abrogation** (pour un administrateur, il mène aussi au **retrait technique
  du recueil**, réservé aux erreurs de dépôt). Le registre affiche un badge **« abrogé »** (ou
  **« abrogation prévue »**) à côté du statut, et la fiche de l'acte dit en tête par quoi l'acte a
  été abrogé, et à compter de quand.
- **Le recueil public montre chaque acte dans sa version la plus récente, et peut révéler les
  articles abrogés.** La liste des actes publiés ne présente plus deux fois le même acte : une
  version antérieure ne s'y trouve que si l'on coche **« Afficher les versions antérieures »**
  (case discrète à côté des filtres, qui n'apparaît que s'il y en a), et les compteurs du recueil
  comme ceux des thèmes suivent la même règle. Sur la page d'un acte, l'**article abrogé** garde
  son intitulé et la mention de l'acte qui l'a abrogé, mais sa rédaction reste masquée : la case
  **« Afficher les articles abrogés »** la révèle, barrée, comme une pièce d'archive. La version
  papier et l'impression ne la montrent jamais.
- **Un article peut être renuméroté, ou le dispositif renuméroté d'un bout à l'autre.** En
  modifiant un acte, le bouton **n°** d'un article lui réattribue un numéro — refusé s'il est déjà
  porté par un autre article — et **« Tout renuméroter »** rend la numérotation continue, ce qui
  est le remède à un acte troué par les abrogations : les articles abrogés dont le numéro est
  repris ne sont alors même plus mentionnés. Les deux gestes vivent dans le panneau **« L'acte
  entier »** de l'écran de modification.
- **Un article s'édite dans sa structure : on y ajoute et on y retire des paragraphes, des lignes
  de liste et des lignes de tableau.** Pendant la modification d'un acte, chaque paragraphe, chaque
  élément de liste et chaque ligne de tableau porte ses outils discrets (**+** / **✕**) ; des barres
  de bloc permettent d'ajouter une ligne ou un paragraphe entier. Le texte ajouté est marqué comme
  tel dans l'acte modificatif et dans la version consolidée.
- **Le guide a un chapitre « Abroger un acte, ou l'un de ses articles ».** Il explique les deux
  chemins (le registre, la rédaction), l'effet à l'entrée en vigueur, ce que le registre en dit, et
  ce que le recueil public montre ; le glossaire s'enrichit de l'**abrogation**, de l'**entrée en
  vigueur**, de l'**article abrogé** et du **retrait du recueil**.

### Modifié

- **La présentation du logiciel expose les obligations auxquelles il répond.** La page d'accueil du
  dépôt s'ouvre désormais sur un « **Pourquoi ce logiciel** » : les exigences du **code des
  relations entre le public et l'administration** — la publicité qui conditionne l'**entrée en
  vigueur** d'un acte réglementaire (CRPA, art. L. 221-2 et L. 221-3), la publication au **recueil
  des actes administratifs** (L. 222-1 à L. 222-4), la **publication en ligne** des documents
  administratifs (L. 312-1-1) dans un **standard ouvert** (L. 322-6, L. 321-1), la **protection des
  données** avant mise en ligne (L. 312-1-2) — avec, pour chacune, le renvoi au texte sur Légifrance
  et ce que le logiciel fait pour y répondre. Scribae **outille** ces obligations sans s'y
  substituer : c'est à l'administration de fixer sa politique de publication.
- **Une réponse de Publia ne parle plus d'adresses à composer.** L'assistante invitait à consulter
  un acte « en ajoutant sa clé respective après « ?acte= » à l'adresse de consultation » — une
  phrase qui n'a de sens que pour un informaticien. Ce qui est demandé au modèle a changé : il
  **ne parle jamais** de « clé », de « paramètre », de « ?acte= » ni d'identifiant technique, et
  **n'écrit jamais d'adresse** — il recopie le lien de l'acte, libellé, et le lecteur clique. La
  réponse se lit désormais en français ordinaire : l'acte, son numéro, sa date, et le lien pour
  l'ouvrir.
- **L'écran de signature ne montre plus tous les actes, mais ceux du compte qui regarde.** Les
  onglets « Circuit » et « Publication » listaient le registre entier ; ils suivent désormais la
  **visibilité** du compte, la même que celle de l'atelier — le périmètre administratif, la
  compétence de révision, et le **champ de compétence de signature**. Un signataire n'y voit donc
  que ce qui le concerne, et le menu « Signature & publication » s'ouvre à quiconque peut signer,
  publication ou non.
- **L'écran « Référentiel » s'appelle désormais « Administration ».** Le nom change partout où
  l'utilisateur le lit — menu de gauche, en-tête, menu du compte, titre de l'écran, Guide et
  documentation — sans rien déplacer : la destination, les permissions et les données restent les
  mêmes. Le mot **« référentiel »** continue de désigner les **données** elles-mêmes (entités,
  personnes, références, mentions, numérotation…), partout où le propos porte sur le contenu et
  non sur l'écran ; c'est aussi le nom de la table qui les range.
- **Le réglage « Agent sans groupe reconnu » dit ce qu'on ouvre, non si l'on entre.** Ses deux
  valeurs (Administration › Annuaire › *Rôles et périmètre*) s'appellent désormais **« Aucun accès
  (rôle Visiteur) »** et **« Attribuer le rôle de repli »** : dans les deux cas l'agent est
  authentifié par l'annuaire. L'ancien réglage « Refuser la connexion » arrêtait l'agent à la
  porte sans lui dire ce qui lui manquait ; le visiteur, lui, se voit expliquer la situation.
- **Sur le recueil public, la matière d'un acte passe devant sa nature.** Chaque acte de la liste
  et la notice d'un acte affichent d'abord son **thème** — la matière dont il relève (urbanisme,
  police, environnement…) —, la **nature** (arrêté, décision) venant en second ; le thème entre
  aussi dans la recherche. Le recueil se parcourt donc **par matière** avant de se parcourir par
  type d'acte.
- **La charte d'un acte ne s'applique plus à sa version en ligne.** Les actes publiés se lisent
  désormais **sans leur feuille de style** : la **charte** (police, couleurs, en-tête, filets)
  habille le **papier** — PDF, Word, page autonome, original signé — et non la page du recueil.
  Celle-ci suit l'apparence du site, dont la personnalisation est **indépendante** des chartes
  d'actes.
- **La page d'un acte du recueil public se lit sur toute la largeur.** Le texte publié n'est plus
  enfermé dans une colonne étroite : il occupe **toute la largeur disponible**, et s'affiche dans
  la **police de l'interface** — au lieu du sérif de la charte — pour un confort de lecture
  homogène avec le reste du site. La liste des actes, elle, garde sa largeur de lecture ; la page
  HTML autonome et les exports conservent, eux, la typographie de la charte.
- **Le retrait du recueil laisse une trace sur l'acte.** La fiche d'un acte retiré affiche, sous
  « Signature et publication », un avertissement **« Retiré du recueil »** et le **motif** de
  chaque retrait, avec sa date et son auteur.
- **Les visas de délégation s'écrivent une fois pour toutes dans la trame.** Au lieu de citer à la
  main l'arrêté de délégation de l'entité (deux visas figés), un bloc de visas peut demander « **les
  décisions fondant la signature, étage par étage** » : l'emplacement reste celui de la trame, mais
  les décisions viennent du référentiel, suivent le signataire et **portent leur lien**. Un acte
  signé sans délégation ne vise plus que la décision de son autorité ; un acte signé par une autre
  autorité (la secrétaire générale, par exemple) ne vise plus l'arrêté de délégation de quelqu'un
  d'autre.
- **La « version en ligne » se lit dans la page, et le recueil public la remplace.** La
  consultation d'une publication (écran **Publications (ELI)**) n'ouvre plus une fenêtre : elle
  présente l'acte **comme le recueil public** — la marque de sa version, son titre, ses
  métadonnées, son texte intégré à la page — et renvoie vers sa page du recueil. L'écran gagne
  l'accès au recueil (« Ouvrir le recueil public », « Copier le lien du recueil ») et les
  actions « Voir dans le recueil public » et « Copier le lien de cet acte ». La page HTML
  autonome reste — pour l'impression, le PDF et le téléchargement.
- **Les liens internes du recueil sont des ancres.** Suivre un résultat ne recharge plus la
  page publique dans son propre cadre : l'adresse citable (`https://perchance.org/…`, proposée
  par « Copier le lien ») reste distincte du lien de navigation.
- **Le certificat de transmission se voit partout où l'acte se lit** : sur la **fiche de l'acte**
  et dans l'**échéancier d'exécution** (mention, référence, sceau), sur l'**original signé**
  (bloc « Certificat de transmission », dont le sceau est **vérifié à l'affichage**), et
  **sur le document publié** lui-même, sous le texte de l'acte. Le **journal de l'API** distingue
  désormais trois origines : le service, le prestataire de signature, et l'API d'envoi du
  contrôle de légalité.
- **Le bloc de signature** n'imprime plus la civilité du signataire : la qualité, juste au-dessus,
  dit déjà de qui il s'agit. La formule d'autorité de l'entité peut porter un jeton `{qualite}`
  (« {qualite} de Valmont-sur-Loire »), remplacé par la qualité accordée de l'autorité de tête.
- **Le retour signé publie l'acte.** Un acte **publiable** qui revient signé est déposé au recueil
  et reçoit son identifiant ELI **automatiquement** : il n'y a plus de geste de publication à
  faire après la signature. Un acte individuel (trame déclarée non publiable) s'arrête à la
  signature, comme avant : conservé au registre, il est notifié à l'intéressé.
- **La documentation technique est réservée aux administrateurs.** L'écran « Documentation
  technique » (exploitation, installation, sécurité) n'est plus ouvert à tous les comptes : une
  permission `docs.voir` le réserve au rôle **administrateur**. Les autres rôles ne voient plus
  son entrée de menu, ni le renvoi du menu de leur compte, ni l'encart en bas du **Guide** — qui,
  lui, reste ouvert à tous.

### Corrigé

- **Le menu du compte et les formulaires tiennent dans un écran étroit.** Sous 640 px, le menu du
  compte — nom, apparence, assistants, version — sortait de la fenêtre : le bouton auquel il
  s'ancre change de place quand l'en-tête se replie sur plusieurs lignes. Il s'affiche désormais
  comme une **feuille en bas de l'écran**, entièrement visible. De même, les formulaires en deux
  ou trois colonnes dépassaient de la page sous 300 px de large : leurs colonnes se **réduisent**
  au lieu de déborder.
- **Le recueil de démonstration ne reste plus vide après une réinitialisation.** Le réamorçage du
  recueil ne redéposait que les actes encore marqués « signés » dans le poste : un acte **déjà
  publié**, dont l'état local n'est plus « signé », n'était jamais redéposé — le recueil public
  pouvait donc rester vide alors que la fiction annonçait des actes publiés. L'amorçage considère
  désormais aussi les actes **publiés**, et ne rapporte son succès qu'après vérification auprès du
  service (et non sur l'état local, qui pouvait être périmé).
- **Redéposer un acte déjà publié rétablit sa transmission au contrôle de légalité.** Quand le
  contrôle de légalité est actif, republier un acte qui porte déjà un certificat de transmission
  échouait en `transmission_absente` : le dépôt rejoue maintenant la transmission existante avant
  de publier, au lieu de la perdre.
- **La charte générale de la démonstration se présente comme telle.** La feuille livrée avec le
  jeu de démonstration n'était pas marquée « feuille générale » : l'écran la présentait comme une
  sous-feuille non rattachée, alors qu'elle habille bien tous les actes par défaut. Les
  référentiels de démonstration sont corrigés ; un référentiel existant peut se rectifier d'un
  clic, dans « Feuilles de style » › *Rôle* › **Feuille générale**.
- **La modalité d'une formalité est bien enregistrée.** Le formulaire de constatation (transmission,
  publication, notification) conservait le **libellé** choisi (« Télétransmission (@ctes /
  Démarches simplifiées) ») au lieu de son **identifiant** : la modalité ne se relisait plus dans
  les pièces et les listes. Les dossiers qui portent un libellé restent lisibles — l'affichage
  tolère les deux formes.
- **Enregistrer un nouvel acte ne vide plus l'écran de rédaction.** Le premier enregistrement d'un
  acte créé depuis une trame ne « rattachait » pas le brouillon à l'acte qu'il venait de créer : le
  redessin qui suit l'enregistrement repartait d'une **page blanche**, et le rédacteur pouvait
  croire son texte perdu (il était enregistré, mais l'écran ne le montrait plus). Le brouillon suit
  désormais l'acte créé, et une trame changée ne charge plus les valeurs d'un autre acte.

## [1.1.0] — 2026-09-20 — Créer une trame sans mode d'emploi

L'éditeur de trame s'adresse à des agents qui ne sont pas informaticiens : on y **montre** au
lieu de nommer, on **glisse** au lieu de choisir dans une liste, et chaque réglage fréquent est
une carte que l'on clique.

### Ajouté

- **Une réserve d'éléments et le glisser-déposer** dans l'éditeur de trame. Sous le plan, à
  gauche, trois groupes : *Vos champs*, *Rempli automatiquement* (collectivité, signataire,
  date…), *Ajouter un bloc* (intitulé, visas, article, tableau, signature…). On en tire ce que
  l'on veut **directement dans la page** : un champ se pose **au milieu d'une phrase**, à
  l'endroit exact où on le lâche ; un bloc se range **avant ou après** un autre, un trait bleu
  annonçant l'endroit. Un bloc peut aussi être saisi par sa poignée dans le plan, ou dans la
  page, pour être déplacé.
- **Le geste de repli, au clic** — pour qui ne maîtrise pas le glisser : cliquer une puce
  l'« arme », puis cliquer dans le texte suffit. Un bandeau rappelle la consigne tant que le
  geste n'est pas fini, et « Annuler » l'interrompt. Le clic et le glisser mènent au même
  résultat.
- **Le type d'un champ se choisit sur des cartes** : douze cartes illustrées, chacune avec un
  libellé d'usage (« Une date », « Un montant ») et un exemple, au lieu d'une liste déroulante.
- **Les questions du formulaire se replient** : repliées, elles tiennent en une ligne (nom,
  type, « obligatoire ») et le formulaire entier se lit d'un coup d'œil ; dépliées, elles
  livrent leurs réglages, y compris un moyen de placer le champ dans le texte depuis la question
  elle-même.

### Modifié

- **Onglets de l'inspecteur renommés** : « Ce bloc », « Questions », « Contrôles », « Trame » —
  le vocabulaire du code cède la place à celui des services. Le chapitre « Écrire une trame »
  du guide intégré a été récrit en conséquence, et décrit les deux gestes (glisser, ou cliquer
  puis cliquer).
- **Les réglages courts se choisissent d'un clic**, sans menu déroulant : statut d'une trame,
  transmission au contrôle de légalité, notification aux intéressés, gravité d'une règle,
  nature d'un commentaire, provenance d'un visa. Les listes déroulantes ne subsistent que là
  où elles sont inévitables (famille, type d'acte, feuille de style, circuit, référence
  juridique, mention).
- **Page d'accueil du dépôt (`README.md`) récrite pour un lecteur qui veut se servir du
  logiciel** — un agent, un responsable de service, un élu — et non pour un développeur : ce
  que le logiciel fait, comment l'essayer sans rien installer, ce qu'il advient des données,
  et comment l'installer (Pages ou serveur). Les consignes destinées à l'éditeur du générateur
  restent dans `src/README.md`.

### Corrigé

- **Les outils d'un bloc s'affichent à nouveau correctement** : une règle de style héritée
  visait une classe qui n'existe plus, si bien que la poignée de déplacement, les flèches et la
  corbeille formaient une barre constamment visible au lieu d'apparaître sur le bloc survolé ou
  sélectionné.

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
