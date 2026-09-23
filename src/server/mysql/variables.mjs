// ============================================================================
// Registre des VARIABLES DE DÉPLOIEMENT — une seule source de vérité.
//
// Le fichier `.env` du déploiement auto-hébergé (voir server/env.example) tient
// deux sortes de réglages :
//
//   • des réglages de SERVICE (base de données, comptes, jetons, SMTP, limites),
//     lus par `server.mjs` lui-même ;
//   • des réglages de RÉFÉRENTIEL (identité, vocabulaire, numérotation, délais,
//     recueil, fonctions expérimentales) qui, jusqu'ici, ne se réglaient que
//     dans l'interface, un clic après l'autre. Ce module les rend DÉCLARATIFS :
//     le déploiement les pose, le service les valide, et l'application les
//     applique à chaque démarrage — sans qu'un administrateur ait à les saisir.
//
// Ce fichier EST la déclaration. Pour ajouter une variable, on ajoute UN
// descripteur à `VARIABLES` : le wiki (`src/docs/VARIABLES.md`, engendré par
// `scripts/generer-variables.mjs`), la validation et le transport vers le
// navigateur en découlent — il n'y a rien d'autre à tenir à jour.
//
// Module PUR : aucune dépendance, ni à Node, ni au navigateur. Il s'éprouve
// seul (`variables.test.mjs`).
// ============================================================================

// ------------------------------------------------------------------ types
//   texte    une chaîne, telle quelle (les espaces de bord sont retirés) ;
//   entier   un nombre entier, borné par `min` / `max` quand ils sont donnés ;
//   booleen  true/false, « oui/non », « 1/0 », « vrai/faux », « on/off » ;
//   choix    l'une des valeurs de `choix` ;
//   couleur  une couleur hexadécimale (#abc ou #aabbcc) ;
//   url      une adresse http(s) — la barre oblique finale est retirée ;
//   liste    des valeurs séparées par des virgules, rangées en tableau.
//
// `portee` :
//   referentiel  réglage d'application — validé PUIS transmis au navigateur par
//                `GET /v1/config`, qui l'applique par-dessus le référentiel ;
//   service      réglage du service — validé et journalisé, mais jamais envoyé
//                au navigateur (il peut porter un secret).
//
// `secret` : la valeur ne doit JAMAIS figurer dans un journal, une réponse d'API
// ni le wiki (on n'en montre que le rôle).
//
// `cle` : chemin, en notation pointée, dans l'objet `config` de l'application.
//          Il n'est requis que pour la portée « referentiel ».

export const VARIABLES = [
  // ========================================================== RÉFÉRENTIEL
  // --- Identité -------------------------------------------------------------
  {
    env: "SCRIBA_IDENTITE_NOM", cle: "brand.name", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Nom de la collectivité",
    description: "Le nom qui s'affiche en tête de l'application, du recueil public et des documents.",
    exemple: "Ville d'Exemple",
  },
  {
    env: "SCRIBA_IDENTITE_SIGLE", cle: "brand.shortName", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Nom court",
    description: "Sigle ou forme brève, repris là où la place manque (onglets, pied de page).",
    exemple: "VE",
  },
  {
    env: "SCRIBA_IDENTITE_ADRESSE", cle: "brand.baseUri", portee: "referentiel",
    type: "url", groupe: "Identité",
    libelle: "Adresse de base",
    description: "Racine publique du site. Elle préfixe les identifiants ELI (« {baseUri}/eli/… »).",
    exemple: "https://actes.exemple.fr",
  },
  {
    env: "SCRIBA_IDENTITE_COULEUR", cle: "brand.color", portee: "referentiel",
    type: "couleur", groupe: "Identité",
    libelle: "Couleur principale",
    description: "Couleur d'accent de l'interface et des documents produits.",
    exemple: "#000091",
  },
  {
    env: "SCRIBA_IDENTITE_COULEUR_SOMBRE", cle: "brand.colorDark", portee: "referentiel",
    type: "couleur", groupe: "Identité",
    libelle: "Couleur principale (survol)",
    description: "Variante employée pour les états survolés et les contrastes.",
    exemple: "#1212ff",
  },
  {
    env: "SCRIBA_IDENTITE_EMBLEME", cle: "brand.logoUrl", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Emblème",
    description: "Adresse de l'emblème, ou data URL. Vide : aucun emblème n'est affiché.",
    exemple: "https://www.exemple.fr/blason.svg",
  },
  {
    env: "SCRIBA_IDENTITE_EMBLEME_SOMBRE", cle: "brand.logoUrlDark", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Emblème (thème sombre)",
    description: "Emblème de rechange, employé quand le poste de travail est en thème sombre. Vide : l'emblème ordinaire sert dans les deux thèmes.",
    exemple: "https://www.exemple.fr/blason-clair.svg",
  },
  {
    env: "SCRIBA_IDENTITE_POLICE_INTERFACE", cle: "brand.uiFont", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Police de l'interface",
    description: "Famille de caractères de l'application (interface).",
    exemple: "system-ui, Arial, sans-serif",
  },
  {
    env: "SCRIBA_IDENTITE_POLICE_DOCUMENT", cle: "brand.documentFont", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Police des documents",
    description: "Famille de caractères des actes compilés et imprimés.",
    exemple: "Georgia, 'Times New Roman', serif",
  },
  {
    env: "SCRIBA_SUPPORT_NOM", cle: "brand.supportName", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Service de contact",
    description: "Le service auquel un lecteur s'adresse (pied de page du recueil).",
    exemple: "Service des affaires générales",
  },
  {
    env: "SCRIBA_SUPPORT_TELEPHONE", cle: "brand.supportPhone", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Téléphone de contact",
    description: "Numéro affiché dans le pied de page du recueil. Facultatif.",
    exemple: "01 23 45 67 89",
  },
  {
    env: "SCRIBA_SUPPORT_COURRIEL", cle: "brand.supportEmail", portee: "referentiel",
    type: "texte", groupe: "Identité",
    libelle: "Courriel de contact",
    description: "Adresse affichée dans le pied de page du recueil. Facultatif.",
    exemple: "actes@exemple.fr",
  },

  // --- Vocabulaire ----------------------------------------------------------
  {
    env: "SCRIBA_VOCAB_ENACTE", cle: "vocab.enact", portee: "referentiel",
    type: "texte", groupe: "Vocabulaire",
    libelle: "Verbe d'édiction",
    description: "Le mot qui introduit le dispositif (« ARRÊTE », « DÉCIDE », « DÉLIBÈRE »).",
    exemple: "ARRÊTE",
  },
  {
    env: "SCRIBA_VOCAB_ARTICLE", cle: "vocab.articleLabel", portee: "referentiel",
    type: "texte", groupe: "Vocabulaire",
    libelle: "Libellé d'article",
    description: "Le mot qui désigne un article du dispositif.",
    exemple: "Article",
  },
  {
    env: "SCRIBA_VOCAB_CONSIDERANT", cle: "vocab.recitalsLabel", portee: "referentiel",
    type: "texte", groupe: "Vocabulaire",
    libelle: "Libellé de considérant",
    description: "Le mot qui introduit les considérants.",
    exemple: "Considérant",
  },
  {
    env: "SCRIBA_VOCAB_VISA", cle: "vocab.visasLabel", portee: "referentiel",
    type: "texte", groupe: "Vocabulaire",
    libelle: "Libellé de visa",
    description: "Le mot qui introduit les visas (« Vu », « Vus »).",
    exemple: "Vu",
  },
  {
    env: "SCRIBA_VOCAB_AUTEUR", cle: "vocab.authorLine", portee: "referentiel",
    type: "texte", groupe: "Vocabulaire",
    libelle: "Ligne d'autorité par défaut",
    description: "Mention d'autorité d'une trame qui n'en porte pas d'autre.",
    exemple: "L'autorité compétente",
  },
  {
    env: "SCRIBA_VOCAB_RECOURS", cle: "vocab.recoursLabel", portee: "referentiel",
    type: "texte", groupe: "Vocabulaire",
    libelle: "Libellé des voies de recours",
    description: "Titre du bloc qui rappelle les délais et voies de recours.",
    exemple: "Voies et délais de recours",
  },
  {
    env: "SCRIBA_VOCAB_PUBLICATION", cle: "vocab.publicationLabel", portee: "referentiel",
    type: "texte", groupe: "Vocabulaire",
    libelle: "Libellé de publication",
    description: "Titre du bloc qui rappelle la publication et l'opposabilité.",
    exemple: "Publication",
  },

  // --- Numérotation ---------------------------------------------------------
  {
    env: "SCRIBA_NUMERO_MOTIF", cle: "numbering.pattern", portee: "referentiel",
    type: "texte", groupe: "Numérotation",
    libelle: "Motif du numéro",
    description: "Gabarit du numéro d'acte. Jetons : {year} {seq} {entityCode} {actTypeId}.",
    exemple: "{year}-{seq}-{entityCode}",
  },
  {
    env: "SCRIBA_NUMERO_REMPLISSAGE", cle: "numbering.pad", portee: "referentiel",
    type: "entier", min: 1, max: 10, groupe: "Numérotation",
    libelle: "Chiffres de la séquence",
    description: "Nombre de chiffres du numéro de séquence (remplissage par des zéros).",
    exemple: "3",
  },
  {
    env: "SCRIBA_NUMERO_ANNEE", cle: "numbering.year", portee: "referentiel",
    type: "entier", min: 2000, max: 2100, groupe: "Numérotation",
    libelle: "Année de numérotation",
    description: "Année inscrite dans le numéro. Réglée au 1er janvier, ou laissée à l'année courante.",
    exemple: "2026",
  },
  {
    env: "SCRIBA_NUMERO_SEQUENCE", cle: "numbering.seq", portee: "referentiel",
    type: "entier", min: 1, groupe: "Numérotation",
    libelle: "Prochain numéro",
    description: "Valeur de départ de la séquence (au premier numéro tiré de l'application).",
    exemple: "1",
  },
  {
    env: "SCRIBA_NUMERO_ELI", cle: "numbering.eliPattern", portee: "referentiel",
    type: "texte", groupe: "Numérotation",
    libelle: "Motif de l'identifiant ELI",
    description: "Gabarit de l'identifiant ELI. Jetons : {baseUri} {actTypeId} {year} {seq} {entityCode}.",
    exemple: "{baseUri}/eli/{actTypeId}/{year}/{seq}/{entityCode}",
  },
  {
    env: "SCRIBA_NUMERO_SOURCE", cle: "numbering.source", portee: "referentiel",
    type: "choix", choix: ["interne", "externe"], groupe: "Numérotation",
    libelle: "Source du numéro",
    description: "« interne » : la séquence ci-dessus. « externe » : un service tiers (Grist, tableur) attribue le numéro.",
    exemple: "interne",
  },
  {
    env: "SCRIBA_NUMERO_ENTITE_ELI", cle: "numbering.eliEntity", portee: "referentiel",
    type: "booleen", groupe: "Numérotation",
    libelle: "Code d'entité dans l'ELI",
    description: "Ajoute le code de l'entité au chemin ELI. Éteint pour un identifiant unique par acte.",
    exemple: "true",
  },

  // --- Délais ---------------------------------------------------------------
  {
    env: "SCRIBA_DELAI_RECOURS_MOIS", cle: "delais.recoursMois", portee: "referentiel",
    type: "entier", min: 1, max: 12, groupe: "Délais et exécution",
    libelle: "Délai de recours (mois)",
    description: "Délai de recours contentieux rappelé sur chaque acte (2 mois par défaut).",
    exemple: "2",
  },
  {
    env: "SCRIBA_DELAI_TRANSMISSION_JOURS", cle: "delais.transmissionJours", portee: "referentiel",
    type: "entier", min: 0, max: 90, groupe: "Délais et exécution",
    libelle: "Transmission au contrôle de légalité (jours)",
    description: "Délai accordé pour transmettre l'acte au représentant de l'État.",
    exemple: "15",
  },
  {
    env: "SCRIBA_DELAI_PUBLICATION_JOURS", cle: "delais.publicationJours", portee: "referentiel",
    type: "entier", min: 0, max: 90, groupe: "Délais et exécution",
    libelle: "Publication (jours)",
    description: "Délai accordé pour publier l'acte après sa signature.",
    exemple: "10",
  },
  {
    env: "SCRIBA_DELAI_NOTIFICATION_JOURS", cle: "delais.notificationJours", portee: "referentiel",
    type: "entier", min: 0, max: 90, groupe: "Délais et exécution",
    libelle: "Notification (jours)",
    description: "Délai accordé pour notifier l'acte aux intéressés.",
    exemple: "8",
  },

  // --- Recueil public -------------------------------------------------------
  {
    env: "SCRIBA_RECUEIL_TITRE", cle: "publication.recueil", portee: "referentiel",
    type: "texte", groupe: "Recueil public",
    libelle: "Titre du recueil",
    description: "Titre porté en tête du recueil public des actes.",
    exemple: "Recueil des actes administratifs",
  },
  {
    env: "SCRIBA_RECUEIL_AUTO", cle: "publication.auto", portee: "referentiel",
    type: "booleen", groupe: "Recueil public",
    libelle: "Publication automatique",
    description: "Allumé, l'acte est publié dès son retour signé. Éteint, chaque publication est un geste délibéré.",
    exemple: "true",
  },
  {
    env: "SCRIBA_RECUEIL_OPPOSABILITE", cle: "publication.opposabilite.mode", portee: "referentiel",
    type: "choix", choix: ["lendemain", "jours"], groupe: "Recueil public",
    libelle: "Entrée en vigueur",
    description: "« lendemain » : opposable le lendemain de la publication. « jours » : après le nombre de jours réglé.",
    exemple: "lendemain",
  },
  {
    env: "SCRIBA_RECUEIL_OPPOSABILITE_JOURS", cle: "publication.opposabilite.jours", portee: "referentiel",
    type: "entier", min: 0, max: 60, groupe: "Recueil public",
    libelle: "Entrée en vigueur (jours)",
    description: "Nombre de jours quand l'entrée en vigueur est réglée « jours ».",
    exemple: "1",
  },

  // --- Bulletin des actes ----------------------------------------------------
  // Le BULLETIN (ou Journal) rassemble les actes publiés par PÉRIODE et les
  // diffuse : une sous-page du recueil par numéro, un flux RSS/Atom, un courriel
  // aux abonnés (voir src/server/mysql/bulletins.mjs et actes.mjs). Ces réglages
  // disent QUOI publier et À QUELLE CADENCE ; les bornes du service (conservé,
  // expédié, intervalle des passes) sont dans « Bulletin des actes (service) ».
  {
    env: "SCRIBA_BULLETIN_ACTIF", cle: "publication.bulletin.actif", portee: "referentiel",
    type: "booleen", groupe: "Bulletin des actes",
    libelle: "Bulletin allumé",
    description: "Allumé, le recueil publie un numéro à chaque clôture de période et ouvre l'abonnement par courriel. Éteint, les adresses du bulletin n'existent pas.",
    exemple: "true",
  },
  {
    env: "SCRIBA_BULLETIN_TITRE", cle: "publication.bulletin.titre", portee: "referentiel",
    type: "texte", groupe: "Bulletin des actes",
    libelle: "Titre du bulletin",
    description: "Titre porté par le bulletin : en-tête des pages, objet des courriels, titre du flux.",
    exemple: "Bulletin officiel des actes",
  },
  {
    env: "SCRIBA_BULLETIN_TITRE_BULLETIN", cle: "publication.bulletin.titreBulletin", portee: "referentiel",
    type: "texte", groupe: "Bulletin des actes",
    libelle: "Titre de chaque numéro",
    description: "Titre de chaque numéro, précédant le rang et la période (« … n° 12 — septembre 2026 »). Vide : le titre du bulletin sert.",
    exemple: "Bulletin des actes",
  },
  {
    env: "SCRIBA_BULLETIN_SOUS_TITRE", cle: "publication.bulletin.sousTitre", portee: "referentiel",
    type: "texte", groupe: "Bulletin des actes",
    libelle: "Sous-titre",
    description: "Phrase d'introduction du bulletin : sous les pages, en tête du courriel, dans la description du flux.",
    exemple: "Les actes administratifs de la collectivité, rassemblés par période.",
  },
  {
    env: "SCRIBA_BULLETIN_CADENCE", cle: "publication.bulletin.cadence", portee: "referentiel",
    type: "choix", choix: ["quotidienne", "hebdomadaire", "bimensuelle", "mensuelle", "bimestrielle", "trimestrielle", "semestrielle", "annuelle", "personnalisee"], groupe: "Bulletin des actes",
    libelle: "Cadence de parution",
    description: "La périodicité du bulletin. « bimensuelle » paraît deux fois par mois (1er–15, puis 16–fin). « personnalisee » (toutes les N unités) se règle dans l'interface.",
    exemple: "mensuelle",
  },
  {
    env: "SCRIBA_BULLETIN_PARUTION_JOURS", cle: "publication.bulletin.parutionJours", portee: "referentiel",
    type: "entier", min: 0, max: 31, groupe: "Bulletin des actes",
    libelle: "Jour de parution",
    description: "Jour du mois où paraît le bulletin, une fois sa période close (0 : dès le premier jour permis).",
    exemple: "1",
  },

  // --- Accès à l'atelier -----------------------------------------------------
  // Une commune peut n'ouvrir l'atelier qu'à son intranet. La liste est
  // appliquée par le SERVICE (voir src/server/mysql/atelier.mjs et ips.mjs) : le
  // navigateur ne décide jamais de son propre droit d'entrer. Elle vaut aussi
  // pour les actes RÉSERVÉS AUX AGENTS, qui ne sont montrés au recueil public
  // qu'aux personnes connectées venant d'une adresse autorisée.
  {
    env: "SCRIBA_ATELIER_IPS", cle: "publication.atelier.ips", portee: "referentiel",
    type: "liste", groupe: "Accès à l'atelier",
    libelle: "Adresses autorisées à entrer dans l'atelier",
    description: "Liste blanche d'adresses ou de champs d'adresses, séparés par des virgules : adresse (« 192.168.1.24 »), préfixe CIDR (« 10.0.0.0/8 », « 2001:db8::/32 »), champ (« 10.0.0.0-10.0.0.255 ») ou plage abrégée (« 10.0.0.* »). Vide : l'atelier est ouvert à toutes les adresses. Renseignée, l'atelier n'est accessible que depuis ces adresses — et les actes réservés aux agents ne sont montrés qu'à elles.",
    exemple: "10.0.0.0/8, 192.168.1.0/24",
  },
  {
    env: "SCRIBA_ATELIER_MESSAGE", cle: "publication.atelier.message", portee: "referentiel",
    type: "texte", groupe: "Accès à l'atelier",
    libelle: "Message affiché hors du réseau autorisé",
    description: "La phrase expliquée à qui tente d'entrer depuis une adresse non autorisée. Vide : le message livré avec l'application sert.",
    exemple: "L'atelier est ouvert depuis le réseau de la collectivité. Depuis l'extérieur, consultez le recueil public.",
  },

  // --- Signature ------------------------------------------------------------
  {
    env: "SCRIBA_SIGNATURE_MODE", cle: "signature.mode", portee: "referentiel",
    type: "choix", choix: ["electronique", "simple", "externe"], groupe: "Signature",
    libelle: "Circuit de signature",
    description: "« electronique » : prestataire par API. « simple » : signature dans l'application. « externe » : document signé hors ligne puis déposé. Une trame peut trancher autrement.",
    exemple: "electronique",
  },
  // --- Signature : l'API du prestataire -------------------------------------
  // Le circuit électronique suppose un prestataire joignable. Son adresse, son
  // identifiant, le niveau de signature demandé et ses points de terminaison se
  // règlent ici (ou dans Administration › Signature) — la CLÉ, elle, reste au
  // service (`SCRIBA_SIGNATURE_API_CLE`, plus bas) : c'est un secret.
  {
    env: "SCRIBA_SIGNATURE_API_TRANSPORT", cle: "signature.api.transport", portee: "referentiel",
    type: "choix", choix: ["service", "demonstration"], groupe: "Signature — API",
    libelle: "Transport du circuit électronique",
    description: "« service » : c'est le service de la collectivité qui appelle le prestataire — seul moyen de garder la clé d'API côté serveur. « demonstration » : le circuit est simulé localement (aucun appel sortant).",
    exemple: "service",
  },
  {
    env: "SCRIBA_SIGNATURE_API_URL", cle: "signature.api.url", portee: "referentiel",
    type: "url", groupe: "Signature — API",
    libelle: "Adresse de base du prestataire",
    description: "Racine de l'API du prestataire de signature. Vide, le circuit électronique reste en simulation : rien ne sort de la collectivité.",
    exemple: "https://signature.exemple.fr/api/v1",
  },
  {
    env: "SCRIBA_SIGNATURE_API_PRESTATAIRE", cle: "signature.api.prestataire", portee: "referentiel",
    type: "texte", groupe: "Signature — API",
    libelle: "Identifiant du prestataire",
    description: "Nom technique du prestataire (il sert aux en-têtes et au journal).",
    exemple: "esup-signature",
  },
  {
    env: "SCRIBA_SIGNATURE_API_NIVEAU", cle: "signature.api.niveau", portee: "referentiel",
    type: "choix", choix: ["simple", "avancee", "qualifiee"], groupe: "Signature — API",
    libelle: "Niveau de signature demandé",
    description: "Niveau demandé au prestataire pour les actes de la collectivité : signature simple, avancée (certificat), ou qualifiée (eIDAS).",
    exemple: "avancee",
  },
  {
    env: "SCRIBA_SIGNATURE_API_NOTIFICATION", cle: "signature.api.urlNotification", portee: "referentiel",
    type: "texte", groupe: "Signature — API",
    libelle: "Adresse de notification (webhook)",
    description: "L'adresse que le prestataire appellera une fois l'acte signé. Vide : l'adresse du service, suivie de /v1/webhooks/signature.",
    exemple: "https://actes.exemple.fr/v1/webhooks/signature",
  },
  {
    env: "SCRIBA_SIGNATURE_API_TIMEOUT", cle: "signature.api.timeoutMs", portee: "referentiel",
    type: "entier", min: 1000, max: 120000, groupe: "Signature — API",
    libelle: "Délai d'attente du prestataire (ms)",
    description: "Temps maximal accordé à un appel au prestataire avant abandon.",
    exemple: "20000",
  },
  {
    env: "SCRIBA_SIGNATURE_API_CHEMIN_DOCUMENT", cle: "signature.api.cheminDocument", portee: "referentiel",
    type: "texte", groupe: "Signature — API",
    libelle: "Chemin — dépôt du document",
    description: "Point de terminaison qui reçoit le document à signer, relatif à l'adresse de base. Aucun jeton.",
    exemple: "/documents",
  },
  {
    env: "SCRIBA_SIGNATURE_API_CHEMIN_SIGNATAIRES", cle: "signature.api.cheminSignataires", portee: "referentiel",
    type: "texte", groupe: "Signature — API",
    libelle: "Chemin — ajout d'un signataire",
    description: "Point de terminaison qui reçoit les signataires. Jeton {document} : l'identifiant rendu au dépôt.",
    exemple: "/documents/{document}/signataires",
  },
  {
    env: "SCRIBA_SIGNATURE_API_CHEMIN_DEMARRER", cle: "signature.api.cheminDemarrer", portee: "referentiel",
    type: "texte", groupe: "Signature — API",
    libelle: "Chemin — démarrage du circuit",
    description: "Point de terminaison qui lance le circuit de signature. Jeton {document}.",
    exemple: "/documents/{document}/demarrer",
  },
  {
    env: "SCRIBA_SIGNATURE_API_CHEMIN_STATUT", cle: "signature.api.cheminStatut", portee: "referentiel",
    type: "texte", groupe: "Signature — API",
    libelle: "Chemin — suivi du circuit",
    description: "Point de terminaison interrogé pour relire le statut d'un circuit. Jeton {document}.",
    exemple: "/documents/{document}",
  },

  // --- Fonctions et assistants ---------------------------------------------
  // Le parapheur n'est plus un interrupteur (1.5.0) : il vit dans l'onglet
  // « Circuits de validation », et ce sont les circuits enregistrés qui
  // décident. Il n'a donc plus de variable de déploiement.
  {
    env: "SCRIBA_CONTROLE_LEGALITE", cle: "experimental.controleLegalite", portee: "referentiel",
    type: "booleen", groupe: "Fonctions",
    libelle: "Contrôle de légalité",
    description: "Active la transmission de l'acte signé au représentant de l'État par API. Éteint par défaut.",
    exemple: "false",
  },
  {
    env: "SCRIBA_ASSISTANT_ATELIER", cle: "assistant.atelier.actif", portee: "referentiel",
    type: "booleen", groupe: "Fonctions",
    libelle: "Assistant de l'atelier (« Plume »)",
    description: "Allumé, l'assistant d'aide à l'atelier est proposé ; éteint, il n'apparaît pas.",
    exemple: "true",
  },
  {
    env: "SCRIBA_ASSISTANT_PUBLIC", cle: "assistant.public.actif", portee: "referentiel",
    type: "booleen", groupe: "Fonctions",
    libelle: "Assistant du recueil (« Publia »)",
    description: "Allumé, l'assistant du recueil public est proposé ; éteint, il n'apparaît pas.",
    exemple: "true",
  },

  // ============================================================== SERVICE
  // --- Base de données ------------------------------------------------------
  {
    env: "DB_HOST", portee: "service", type: "texte", groupe: "Base de données",
    libelle: "Hôte de la base", defaut: "127.0.0.1",
    description: "Nom d'hôte du serveur MariaDB / MySQL (celui du service `db` en Compose : `db`).",
    exemple: "db",
  },
  {
    env: "DB_PORT", portee: "service", type: "entier", min: 1, max: 65535, groupe: "Base de données",
    libelle: "Port de la base", defaut: "3306",
    description: "Port d'écoute de MariaDB / MySQL.", exemple: "3306",
  },
  {
    env: "DB_USER", portee: "service", type: "texte", groupe: "Base de données",
    libelle: "Compte applicatif", defaut: "scriba",
    description: "Compte avec lequel l'application se connecte à la base.", exemple: "scriba",
  },
  {
    env: "DB_PASSWORD", portee: "service", type: "texte", secret: true, groupe: "Base de données",
    libelle: "Mot de passe de la base",
    description: "Mot de passe du compte applicatif. La pile REMET le compte de la base à cette valeur à chaque démarrage (service `db-init`, qui a besoin de DB_ROOT_PASSWORD) et lui applique ensuite le schéma (`schema.sql`) : c'est ici, et nulle part ailleurs, qu'il se change. SECRET : ne jamais le versionner.",
  },
  {
    env: "DB_NAME", portee: "service", type: "texte", groupe: "Base de données",
    libelle: "Nom de la base", defaut: "scriba",
    description: "Base qui contient les tables du service.", exemple: "scriba",
  },
  {
    env: "DB_POOL", portee: "service", type: "entier", min: 1, max: 128, groupe: "Base de données",
    libelle: "Taille du pool", defaut: "8",
    description: "Nombre de connexions simultanées à la base.", exemple: "8",
  },
  {
    env: "DB_SOCKET", portee: "service", type: "texte", groupe: "Base de données",
    libelle: "Socket Unix",
    description: "Chemin d'une socket Unix, au lieu de DB_HOST/DB_PORT.", exemple: "/run/mysqld/mysqld.sock",
  },
  {
    env: "DB_ROOT_PASSWORD", portee: "service", type: "texte", secret: true, groupe: "Base de données",
    libelle: "Mot de passe root MariaDB",
    description: "Employé par le conteneur `db` à la CRÉATION du dossier de données, et, à chaque démarrage, par l'ALIGNEMENT du compte applicatif sur DB_PASSWORD puis l'application du schéma (`docker compose run --rm db-init`, ou `node server.mjs --reconcilier`). SECRET.",
  },

  // --- Authentification -----------------------------------------------------
  {
    env: "AUTH_MODE", portee: "service", type: "choix", choix: ["password", "oidc", "demo"], groupe: "Authentification",
    libelle: "Mode d'authentification", defaut: "password",
    description: "« password » : vrais comptes locaux (mot de passe vérifié par le service, session par cookie). « oidc » : l'annuaire de la collectivité (OpenID Connect) — MAIS les comptes locaux restent ouverts, et c'est ce qui donne accès au compte d'administration déclaré ici : les deux portes coexistent. « demo » : comptes choisis dans une liste, sans mot de passe — essai seulement.",
    exemple: "password",
  },
  {
    env: "DEMO", portee: "service", type: "booleen", groupe: "Authentification",
    libelle: "Commutateur de démonstration",
    description: "Allumé, le jeu fictif complet est installé et le bandeau « Démonstration » s'affiche. Éteint, l'outil est une page vierge. Vide : AUTH_MODE=demo ou DEMO_ACCOUNTS=true l'allument.",
    exemple: "false",
  },
  {
    env: "DEMO_ACCOUNTS", portee: "service", type: "booleen", groupe: "Authentification",
    libelle: "Comptes de démonstration",
    description: "Laisse le raccourci « choisir un compte » ouvert en mode `password`. À laisser à false en service.",
    exemple: "false",
  },
  {
    env: "ADMIN_LOGIN", portee: "service", type: "texte", groupe: "Authentification",
    libelle: "Identifiant d'administration", defaut: "admin",
    description: "Identifiant du compte d'administration créé au premier démarrage (mode `password`).",
    exemple: "admin",
  },
  {
    env: "ADMIN_PASSWORD", portee: "service", type: "texte", secret: true, groupe: "Authentification",
    libelle: "Mot de passe d'administration",
    description: "Mot de passe du compte d'administration, créé au premier démarrage. Doit respecter la politique (MDP_MIN_LONGUEUR, trois classes de caractères). SECRET.",
  },
  {
    env: "ADMIN_NOM", portee: "service", type: "texte", groupe: "Authentification",
    libelle: "Nom de l'administrateur", defaut: "Administrateur",
    description: "Nom porté par le compte d'administration.", exemple: "Administrateur",
  },
  {
    env: "ADMIN_EMAIL", portee: "service", type: "texte", groupe: "Authentification",
    libelle: "Courriel de l'administrateur",
    description: "Adresse du compte d'administration. Facultative.", exemple: "admin@exemple.fr",
  },
  {
    env: "ADMIN_ENTITY", portee: "service", type: "texte", groupe: "Authentification",
    libelle: "Entité de l'administrateur",
    description: "Code de l'entité à laquelle rattacher le compte d'administration, si besoin.",
  },
  {
    env: "SESSION_DAYS", portee: "service", type: "entier", min: 1, max: 365, groupe: "Sessions et mots de passe",
    libelle: "Durée de session (jours)", defaut: "12",
    description: "Durée de validité d'une session ouverte.", exemple: "12",
  },
  {
    env: "MDP_MIN_LONGUEUR", portee: "service", type: "entier", min: 8, max: 128, groupe: "Sessions et mots de passe",
    libelle: "Longueur minimale du mot de passe", defaut: "12",
    description: "Longueur minimale exigée par la politique de mot de passe.", exemple: "12",
  },
  {
    env: "SCRYPT_N", portee: "service", type: "entier", min: 4096, max: 1048576, groupe: "Sessions et mots de passe",
    libelle: "Coût du dérivé scrypt", defaut: "65536",
    description: "Coût du calcul scrypt (plus haut = plus lent à deviner, et plus lent à vérifier).",
    exemple: "65536",
  },
  {
    env: "COOKIE_SECURE", portee: "service", type: "booleen", groupe: "Sessions et mots de passe",
    libelle: "Cookie de session « Secure »", defaut: "true",
    description: "true en production (HTTPS). Avec true, une session ne peut pas s'ouvrir en http:// — mettre false seulement le temps d'un essai en clair.",
    exemple: "true",
  },

  // --- Jetons d'API ---------------------------------------------------------
  {
    env: "API_TOKENS", portee: "service", type: "texte", secret: true, groupe: "Jetons d'API",
    libelle: "Jetons acceptés en écriture",
    description: "« libellé|rôle:empreinte_sha256 », séparés par des virgules. Les jetons de DÉPLOIEMENT du service : utiles en mode demo (où aucune session n'existe) ; facultatifs en mode password, où les clés d'API créées dans l'application les remplacent. SECRET.",
  },
  {
    env: "API_TOKEN", portee: "service", type: "texte", secret: true, groupe: "Jetons d'API",
    libelle: "Jeton remis à l'application",
    description: "Le même jeton, en clair, remis au conteneur web. Doit correspondre à une empreinte de API_TOKENS (facultatif : laissez vide si les clés d'API de l'application suffisent). SECRET.",
  },
  {
    env: "SCRIBA_SIGNATURE_API_CLE", portee: "service", type: "texte", secret: true, groupe: "Signature — API",
    libelle: "Clé d'API du prestataire de signature",
    description: "La clé que le service présente au prestataire (en-tête Authorization). Elle ne quitte JAMAIS le serveur : elle n'est ni transmise au navigateur, ni journalisée, ni recopiée dans le référentiel. Sans elle, le service n'appelle pas le prestataire en production. SECRET.",
  },
  {
    env: "CORS_ORIGINS", portee: "service", type: "liste", groupe: "Façade HTTP",
    libelle: "Origines autorisées (CORS)",
    description: "Origines de navigateur autorisées à appeler l'API, séparées par des virgules. Vide = aucune (l'application est servie par la même origine).",
    exemple: "https://actes.exemple.fr",
  },
  {
    env: "API_BASE", portee: "service", type: "texte", groupe: "Façade HTTP",
    libelle: "Adresse de l'API vue du navigateur",
    description: "Renseignée si l'API est sur une autre origine que l'application. Vide = même origine.",
    exemple: "https://actes.exemple.fr",
  },
  {
    env: "HTTP_PORT", portee: "service", type: "entier", min: 1, max: 65535, groupe: "Façade HTTP",
    libelle: "Port publié sur l'hôte", defaut: "8080",
    description: "Port publié par le conteneur web (à placer derrière un reverse-proxy TLS).", exemple: "8080",
  },
  {
    env: "APP_DIR", portee: "service", type: "texte", groupe: "Façade HTTP",
    libelle: "Dossier de l'application", defaut: "../../",
    description: "Dossier qui contient « src/ » et index.html. Sans objet par défaut : la pile Compose et l'image autonome EMBARQUENT le code (le monter sert à travailler sur le code sans reconstruire, voir src/server/README.md § 9 bis).",
  },
  {
    env: "PORT", portee: "service", type: "entier", min: 1, max: 65535, groupe: "Service",
    libelle: "Port d'écoute du service", defaut: "8080",
    description: "Port sur lequel le service Node écoute (interne).", exemple: "8080",
  },
  {
    env: "HOST", portee: "service", type: "texte", groupe: "Service",
    libelle: "Interface d'écoute", defaut: "0.0.0.0",
    description: "Interface réseau du service Node.", exemple: "0.0.0.0",
  },
  {
    env: "AUTO_MIGRATE", portee: "service", type: "booleen", groupe: "Service",
    libelle: "Migration au démarrage", defaut: "false",
    description: "Applique le schéma au démarrage, et à chaque fois que le service se rétablit après une panne de base (il la rééprouve de lui-même). À réserver aux installations maîtrisées : la migration se lance normalement à la main.",
    exemple: "false",
  },

  // --- Limites et débit -----------------------------------------------------
  {
    env: "MAX_BODY", portee: "service", type: "entier", min: 1024, groupe: "Limites et débit",
    libelle: "Taille maximale d'une requête (octets)", defaut: "8388608",
    description: "Taille maximale du corps d'une requête HTTP (8 Mio par défaut).", exemple: "8388608",
  },
  {
    env: "MAX_SYNC_RECORDS", portee: "service", type: "entier", min: 1, groupe: "Limites et débit",
    libelle: "Enregistrements par synchronisation", defaut: "4000",
    description: "Borne du lot d'enregistrements échangés avec l'application.", exemple: "4000",
  },
  {
    env: "MAX_STATE_CHARS", portee: "service", type: "entier", min: 1000, groupe: "Limites et débit",
    libelle: "Taille de l'état signature/publication", defaut: "8000000",
    description: "Borne de l'état conservé par le service (actes, circuits, publications).", exemple: "8000000",
  },
  {
    env: "MAX_DOC", portee: "service", type: "entier", min: 1000, groupe: "Limites et débit",
    libelle: "Taille d'un acte déposé", defaut: "400000",
    description: "Borne du document d'un acte déposé.", exemple: "400000",
  },
  {
    env: "MAX_PUBLIES", portee: "service", type: "entier", min: 1, groupe: "Limites et débit",
    libelle: "Publications conservées", defaut: "40",
    description: "Nombre de publications conservées par le service.", exemple: "40",
  },
  {
    env: "MAX_SIGNATURES", portee: "service", type: "entier", min: 1, groupe: "Limites et débit",
    libelle: "Circuits de signature conservés", defaut: "80",
    description: "Nombre de circuits de signature conservés.", exemple: "80",
  },
  {
    env: "MAX_ACTES", portee: "service", type: "entier", min: 1, groupe: "Limites et débit",
    libelle: "Actes conservés", defaut: "80",
    description: "Nombre d'actes conservés par le service.", exemple: "80",
  },
  {
    env: "RATE_WINDOW_MS", portee: "service", type: "entier", min: 1000, groupe: "Limites et débit",
    libelle: "Fenêtre de débit (ms)", defaut: "60000",
    description: "Durée de la fenêtre de limitation du débit.", exemple: "60000",
  },
  {
    env: "RATE_MAX_WRITES", portee: "service", type: "entier", min: 1, groupe: "Limites et débit",
    libelle: "Écritures par fenêtre", defaut: "600",
    description: "Nombre maximal d'écritures par fenêtre et par adresse.", exemple: "600",
  },
  {
    env: "RATE_MAX_CONNEXIONS", portee: "service", type: "entier", min: 1, groupe: "Limites et débit",
    libelle: "Tentatives de connexion par fenêtre", defaut: "30",
    description: "Nombre maximal de tentatives de connexion par fenêtre et par adresse.", exemple: "30",
  },

  // --- Courriel -------------------------------------------------------------
  {
    env: "SMTP_HOST", portee: "service", type: "texte", groupe: "Courriel",
    libelle: "Serveur SMTP",
    description: "Hôte du serveur d'envoi. Vide : Scribae fonctionne, mais les notifications sont constatées « non envoyées ».",
    exemple: "smtp.exemple.fr",
  },
  {
    env: "SMTP_PORT", portee: "service", type: "entier", min: 1, max: 65535, groupe: "Courriel",
    libelle: "Port SMTP", defaut: "587",
    description: "587 (soumission + STARTTLS), 465 (TLS direct), 25 (relais local).", exemple: "587",
  },
  {
    env: "SMTP_SECURE", portee: "service", type: "choix", choix: ["auto", "starttls", "ssl", "aucune"], groupe: "Courriel",
    libelle: "Chiffrement SMTP", defaut: "auto",
    description: "Mode de chiffrement de la liaison SMTP.", exemple: "auto",
  },
  {
    env: "SMTP_USER", portee: "service", type: "texte", groupe: "Courriel",
    libelle: "Identifiant SMTP",
    description: "Compte d'envoi (vide pour un relais sans authentification).",
  },
  {
    env: "SMTP_PASS", portee: "service", type: "texte", secret: true, groupe: "Courriel",
    libelle: "Mot de passe SMTP",
    description: "Mot de passe du compte d'envoi. SECRET.",
  },
  {
    env: "SMTP_FROM", portee: "service", type: "texte", groupe: "Courriel",
    libelle: "Adresse d'expédition",
    description: "Adresse affichée comme expéditeur.", exemple: "ne-pas-repondre@exemple.fr",
  },
  {
    env: "SMTP_FROM_NAME", portee: "service", type: "texte", groupe: "Courriel",
    libelle: "Nom d'expédition",
    description: "Nom affiché à côté de l'adresse d'expédition.", exemple: "Recueil des actes — Ma collectivité",
  },
  {
    env: "SMTP_REPLY_TO", portee: "service", type: "texte", groupe: "Courriel",
    libelle: "Adresse de réponse",
    description: "Adresse de réponse proposée aux destinataires. Facultative.",
  },
  {
    env: "SMTP_NOTIF_ACTIVE", portee: "service", type: "booleen", groupe: "Courriel",
    libelle: "Notifications actives", defaut: "true",
    description: "Éteint l'envoi sans effacer la configuration.", exemple: "true",
  },
  {
    env: "SMTP_TLS_INSECURE", portee: "service", type: "booleen", groupe: "Courriel",
    libelle: "Accepter un certificat non vérifiable", defaut: "false",
    description: "ESSAI seulement : accepte un certificat SMTP non vérifiable.", exemple: "false",
  },
  {
    env: "SMTP_HELO_NAME", portee: "service", type: "texte", groupe: "Courriel",
    libelle: "Nom annoncé en EHLO",
    description: "Nom annoncé au serveur SMTP. Défaut : SMTP_HOST.",
  },
  {
    env: "SMTP_TIMEOUT_MS", portee: "service", type: "entier", min: 1000, groupe: "Courriel",
    libelle: "Délai d'attente SMTP (ms)", defaut: "20000",
    description: "Délai d'attente maximal d'une conversation SMTP.", exemple: "20000",
  },

  // --- Bulletin des actes (service) ------------------------------------------
  // Ce que le SERVICE fait du Bulletin : où il est publié, ce qu'il en conserve
  // et à quel rythme il expédie. Les réglages de FOND (allumé, titre, cadence)
  // sont dans le groupe « Bulletin des actes » (portée référentiel).
  {
    env: "SCRIBA_PUBLIQUE_URL", portee: "service", type: "url", groupe: "Bulletin des actes (service)",
    libelle: "Adresse publique du recueil",
    description: "Adresse publique du recueil (par exemple « https://actes.exemple.fr »). C'est elle qui donne leurs liens aux bulletins adressés par courriel et au flux, puisque le service, quand il compose seul, ne voit pas l'adresse du lecteur. Sans elle, l'abonnement par courriel n'est pas ouvert.",
    exemple: "https://actes.exemple.fr",
  },
  {
    env: "SCRIBA_BULLETIN_MAX", portee: "service", type: "entier", min: 1, max: 600, defaut: "60", groupe: "Bulletin des actes (service)",
    libelle: "Bulletins conservés",
    description: "Nombre de bulletins conservés dans l'état du service : les plus anciens sont élagués au-delà. Il borne aussi la remontée initiale, pour qu'un recueil de dix ans ne fasse pas paraître cent numéros d'un coup.",
    exemple: "60",
  },
  {
    env: "SCRIBA_BULLETIN_MAX_ABONNES", portee: "service", type: "entier", min: 1, max: 200000, defaut: "2000", groupe: "Bulletin des actes (service)",
    libelle: "Abonnés au bulletin",
    description: "Nombre maximal d'abonnés au bulletin sur ce service. Au-delà, une nouvelle demande est refusée — sans dire qui est déjà inscrit.",
    exemple: "2000",
  },
  {
    env: "SCRIBA_BULLETIN_ENVOIS_PASSE", portee: "service", type: "entier", min: 1, max: 2000, defaut: "40", groupe: "Bulletin des actes (service)",
    libelle: "Livraisons par passe",
    description: "Nombre de courriels de bulletin expédiés à chaque passe : borne le temps passé en envoi d'un seul coup. Une livraison refusée est réessayée à la passe suivante, trois fois au total.",
    exemple: "40",
  },
  {
    env: "SCRIBA_BULLETIN_INTERVALLE_MIN", portee: "service", type: "entier", min: 1, max: 1440, defaut: "10", groupe: "Bulletin des actes (service)",
    libelle: "Intervalle des passes (minutes)",
    description: "Fréquence de la passe qui clôt les périodes échues, compose les numéros et vide la file d'envoi. Une passe a lieu aussi à chaque démarrage du service, qui rattrape ainsi son retard seul.",
    exemple: "10",
  },
];

// ------------------------------------------------------------------ outils

const VRAIS = ["true", "1", "oui", "vrai", "yes", "on"];
const FAUX = ["false", "0", "non", "faux", "no", "off"];

// Une valeur brute est-elle VIDE ? Une chaîne d'espaces, ou une chaîne vide,
// vaut « variable non posée » : on ne l'applique pas, et le référentiel garde sa
// valeur. C'est ce qui permet de commenter une ligne du `.env` sans rien casser.
const vide = (v) => v === undefined || v === null || String(v).trim() === "";

function convertir(v, brut) {
  switch (v.type) {
    case "texte":
      return { valeur: brut };
    case "booleen": {
      const t = brut.toLowerCase();
      if (VRAIS.includes(t)) return { valeur: true };
      if (FAUX.includes(t)) return { valeur: false };
      return { erreur: "booléen attendu (true/false, oui/non, 1/0)" };
    }
    case "entier": {
      if (!/^-?\d+$/.test(brut)) return { erreur: "nombre entier attendu" };
      const n = Number(brut);
      if (v.min !== undefined && n < v.min) return { erreur: `valeur minimale : ${v.min}` };
      if (v.max !== undefined && n > v.max) return { erreur: `valeur maximale : ${v.max}` };
      return { valeur: n };
    }
    case "choix":
      if (!Array.isArray(v.choix) || !v.choix.includes(brut)) {
        return { erreur: `valeur attendue parmi : ${(v.choix || []).join(", ")}` };
      }
      return { valeur: brut };
    case "couleur":
      return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(brut)
        ? { valeur: brut }
        : { erreur: "couleur hexadécimale attendue (ex. #000091)" };
    case "url": {
      try {
        const u = new URL(brut);
        if (!/^https?:$/.test(u.protocol)) throw new Error("protocole");
        return { valeur: brut.replace(/\/+$/, "") };
      } catch (e) {
        return { erreur: "adresse http(s) attendue" };
      }
    }
    case "liste":
      return { valeur: brut.split(",").map((s) => s.trim()).filter(Boolean) };
    default:
      return { erreur: `type inconnu : ${v.type}` };
  }
}

// Pose une valeur à un chemin « a.b.c » dans un objet, en créant les niveaux
// manquants. C'est ce que l'application fait des valeurs reçues du service.
export function poser(base, chemin, valeur) {
  const parts = String(chemin).split(".").filter(Boolean);
  if (!parts.length) return base;
  let noeud = base;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (noeud[parts[i]] === null || typeof noeud[parts[i]] !== "object") noeud[parts[i]] = {};
    noeud = noeud[parts[i]];
  }
  noeud[parts[parts.length - 1]] = valeur;
  return base;
}

// Lit un environnement et rend, pour la portée demandée :
//   valeurs        { "chemin.pointé": valeur } — les seules variables POSÉES ;
//   erreurs        [{ variable, valeur, motif }] — refusées, donc NON appliquées ;
//   avertissements [{ variable, motif }].
// Une variable absente ou vide est ignorée : le référentiel garde sa valeur.
export function lireVariables(env = {}, portee = "referentiel") {
  const valeurs = {};
  const erreurs = [];
  const avertissements = [];
  for (const v of VARIABLES) {
    if (v.portee !== portee) continue;
    const brut = env[v.env];
    if (vide(brut)) continue;
    const t = String(brut).trim();
    const r = convertir(v, t);
    if (r.erreur) {
      erreurs.push({ variable: v.env, valeur: v.secret ? "(secret)" : t, motif: r.erreur });
      continue;
    }
    // Un SECRET est validé, puis écarté : la fonction ne rend jamais sa valeur
    // (le service la lit lui-même à la source). C'est ce qui garantit qu'un mot
    // de passe ne peut pas se retrouver dans une réponse d'API ou un journal par
    // simple usage de ce module.
    if (v.secret) continue;
    const cle = portee === "referentiel" ? v.cle : v.env;
    if (!cle) continue;
    valeurs[cle] = r.valeur;
  }
  return { valeurs, erreurs, avertissements };
}

// Le wiki des variables, en Markdown — engendré par scripts/generer-variables.mjs
// et écrit dans src/docs/VARIABLES.md. Il décrit AUSSI BIEN les réglages du
// service que ceux du référentiel : c'est la référence unique du déploiement.
export function wikiMarkdown() {
  const groupes = [];
  for (const v of VARIABLES) {
    const nom = v.groupe || (v.portee === "service" ? "Service" : "Référentiel");
    let g = groupes.find((x) => x.nom === nom);
    if (!g) { g = { nom, variables: [] }; groupes.push(g); }
    g.variables.push(v);
  }
  const esc = (s) => String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\n/g, " ");
  const code = (s) => "`" + esc(s) + "`";
  const lignes = [];
  lignes.push("# Variables de déploiement");
  lignes.push("");
  lignes.push("Ce document est ENGENDRÉ à partir du registre des variables");
  lignes.push("(`src/server/mysql/variables.mjs`) par `node src/scripts/generer-variables.mjs` :");
  lignes.push("il ne se modifie pas à la main. Pour ajouter une variable, on ajoute un descripteur au");
  lignes.push("registre, puis on régénère ce fichier.");
  lignes.push("");
  lignes.push("Deux sortes de réglages vivent dans le fichier `.env` du déploiement :");
  lignes.push("");
  lignes.push("- les **réglages de service** — base de données, comptes, jetons, courriel, limites —");
  lignes.push("  lus par le service lui-même ;");
  lignes.push("- les **réglages de référentiel** — identité, vocabulaire, numérotation, délais, recueil,");
  lignes.push("  fonctions — **déclaratifs** : le service les valide au démarrage et les transmet au");
  lignes.push("  navigateur (`GET /v1/config`), qui les applique par-dessus le référentiel à chaque");
  lignes.push("  démarrage. Une variable posée ici l'emporte donc sur la valeur réglée dans l'interface.");
  lignes.push("  Elle n'est pas recopiée dans le référentiel : retirée du `.env`, elle n'est plus imposée au");
  lignes.push("  lancement suivant, et l'interface reprend la main.");
  lignes.push("");
  lignes.push("Un réglage **absent ou laissé vide** est ignoré : le référentiel garde sa valeur. Une");
  lignes.push("valeur REFUSÉE (type, choix ou borne) n'est pas appliquée, et le motif est journalisé par le");
  lignes.push("service au démarrage — il n'y a jamais de repli silencieux sur une valeur approchante.");
  lignes.push("");
  for (const g of groupes) {
    lignes.push(`## ${g.nom}`);
    lignes.push("");
    lignes.push("| Variable | Portée | Rôle | Type | Défaut | Exemple |");
    lignes.push("|---|---|---|---|---|---|");
    for (const v of g.variables) {
      const portee = v.portee === "service" ? "service" : "référentiel";
      let type = v.type;
      if (v.type === "choix" && v.choix) type += " : " + v.choix.join(" ou ");
      if (v.type === "entier" && (v.min !== undefined || v.max !== undefined)) {
        type += ` (${v.min !== undefined ? "min " + v.min : ""}${v.min !== undefined && v.max !== undefined ? ", " : ""}${v.max !== undefined ? "max " + v.max : ""})`;
      }
      const exemple = v.secret ? "(secret)" : (v.exemple || "");
      const defaut = v.defaut || "";
      lignes.push(`| ${code(v.env)} | ${portee} | **${esc(v.libelle)}** — ${esc(v.description)} | ${esc(type)} | ${esc(defaut)} | ${esc(exemple)} |`);
    }
    lignes.push("");
  }
  lignes.push("## Écrire une valeur");
  lignes.push("");
  lignes.push("Une valeur est lue TELLE QUELLE après retrait des espaces de bord. Les commentaires");
  lignes.push("occupent leur propre ligne — un commentaire en fin de ligne n'est retiré par tous les");
  lignes.push("lecteurs de `.env`.");
  lignes.push("");
  lignes.push("    SCRIBA_IDENTITE_NOM=Ville d'Exemple");
  lignes.push("    SCRIBA_IDENTITE_ADRESSE=https://actes.exemple.fr");
  lignes.push("    SCRIBA_DELAI_RECOURS_MOIS=2");
  lignes.push("    SCRIBA_RECUEIL_OPPOSABILITE=jours");
  lignes.push("    SCRIBA_NUMERO_REMPLISSAGE=3");
  lignes.push("");
  return lignes.join("\n");
}
