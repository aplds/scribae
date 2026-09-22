// ============================================================================
// LA RÉFÉRENCE DE L'API REST — décrite ici, une fois.
//
// Scribae expose une API REST en deux familles, servies par la même façade :
//
//   • la PERSISTANCE PARTAGÉE — `/v1/db/…` : le référentiel, les trames, les
//     actes, les comptes, enregistrement par enregistrement, avec révisions et
//     détection de conflits ;
//   • le DOMAINE — `/v1/actes/…`, `/v1/signatures/…`, `/v1/publications/…` :
//     dépôt des actes, circuits de signature, publication au recueil et
//     identifiants ELI.
//
// S'y ajoutent les routes de SERVICE (`/v1/config`, `/v1/auth/…`, `/v1/courriel`)
// et les adresses PUBLIQUES du site (`/recueil`, `/robots.txt`, `/llms.txt`,
// `/sitemap.xml`).
//
// Ce module est la description UNIQUE de cette surface : la référence lisible
// (src/docs/API.md, engendrée depuis ce fichier), l'écran « API REST » et son
// panneau de commande, et l'export cURL s'en servent tous les trois — il n'y a
// donc pas de risque qu'ils divergent.
//
// Module PUR : ni DOM, ni réseau, ni état. `curlDe` n'est qu'un assembleur de
// texte ; c'est l'écran qui appelle vraiment (par src/lib/remote.js).
// ============================================================================

// Les groupes, dans l'ordre où on les lit : ce que fait le service d'abord,
// puis la porte (authentification), puis les données, puis le domaine.
export const GROUPES_API = [
  { id: "service", label: "Service", resume: "Santé du service et description machine (OpenAPI)." },
  { id: "autorisation", label: "Autorisation", resume: "Les clés d'API et leurs rôles, le journal d'audit." },
  { id: "comptes", label: "Comptes et sessions", resume: "Le mode d'authentification, l'ouverture de session, les mots de passe locaux." },
  { id: "persistance", label: "Persistance partagée", resume: "Les collections du référentiel, enregistrement par enregistrement." },
  { id: "actes", label: "Actes", resume: "Dépôt des actes finalisés, suivi, dossier interne." },
  { id: "signature", label: "Signature", resume: "Circuits de signature, notification du prestataire, circuits externes." },
  { id: "publication", label: "Publication et ELI", resume: "Recueil public, identifiants persistants, retrait et épinglage." },
  { id: "courriel", label: "Courriel", resume: "État du service SMTP et envoi de notifications." },
  { id: "site", label: "Adresses publiques du site", resume: "Recueil, robots, plan de site — hors /v1/." },
];

// ---------------------------------------------------------------------------
// UNE OPÉRATION
//   methode      GET | POST | DELETE
//   chemin       le chemin, avec les paramètres entre accolades
//   auth         « public », ou le rôle minimal : lecteur, redacteur, editeur,
//                administrateur, ou « prestataire » (notification seulement)
//   service      « les-deux » (défaut), « auto-heberge », « plateforme »
//   corps        exemple de corps JSON (objet) — facultatif
//   params       paramètres de chemin ou de requête
//   reponses      les codes, et ce qu'ils veulent dire
//   champs        les champs notables de la réponse ou du corps
// ---------------------------------------------------------------------------
export const API_REFERENCE = [
  // =========================================================== Service
  {
    id: "sante", groupe: "service", methode: "GET", chemin: "/v1/health", auth: "public",
    resume: "État du service",
    description: "Le service répond-il, quelle version, combien d'objets il détient (actes déposés, circuits, publications). C'est l'appel qu'on fait d'abord quand « rien ne marche » : il distingue une API injoignable d'une API qui refuse une requête.",
    reponses: [{ code: 200, description: "Le service est là" }],
    champs: [
      { cle: "statut", type: "string", description: "« ok »" },
      { cle: "version", type: "string", description: "Version du service" },
      { cle: "objets", type: "object", description: "{ actes, signatures, publications }" },
    ],
  },
  {
    id: "openapi", groupe: "service", methode: "GET", chemin: "/v1/", auth: "public",
    resume: "Description OpenAPI 3.1",
    description: "La description machine de toute l'API, au format OpenAPI : noms d'opérations, schémas de corps, réponses. C'est ce document que les outils (Postman, Insomnia, un client généré) lisent, et ce qui alimente l'onglet « API & journal ».",
    reponses: [{ code: 200, description: "Le document OpenAPI" }],
  },
  {
    id: "config", groupe: "service", methode: "GET", chemin: "/v1/config", auth: "public",
    resume: "Réglages de référentiel et état du prestataire",
    description: "Les variables de RÉFÉRENTIEL posées dans le `.env` du déploiement, sous forme de chemins pointés, et les valeurs REFUSÉES avec leur motif. Y figure aussi l'état du prestataire de signature (transport, adresse, niveau, chemins, et un booléen disant si la clé est là — jamais la clé). Aucun secret ne sort par cette route : elle sert à l'écran de connexion avant toute session.",
    service: "auto-heberge",
    reponses: [{ code: 200, description: "Réglages, erreurs, état du prestataire" }],
    champs: [
      { cle: "variables", type: "object", description: "{ \"brand.name\": \"…\", \"numbering.pad\": 3 }" },
      { cle: "erreurs", type: "array", description: "Variables refusées : variable, valeur, motif" },
      { cle: "prestataire", type: "object", description: "État du prestataire : actif, url, niveau, cle (booléen), motif" },
    ],
  },

  // ====================================================== Autorisation
  {
    id: "cles-lister", groupe: "autorisation", methode: "GET", chemin: "/v1/auth/cles", auth: "administrateur",
    resume: "Lister les clés d'API",
    service: "plateforme",
    description: "Les clés d'API que le service accepte : leur libellé, leur rôle, et l'empreinte — jamais la clé elle-même, que le service ne connaît pas (c'est le client qui la tire, et n'en transmet que l'empreinte SHA-256).",
    reponses: [{ code: 200, description: "Les clés" }, { code: 403, description: "Rôle administrateur requis" }],
  },
  {
    id: "cles-creer", groupe: "autorisation", methode: "POST", chemin: "/v1/auth/cles", auth: "administrateur",
    resume: "Créer une clé d'API",
    service: "plateforme",
    description: "Enregistre une clé (son empreinte) et son rôle. Le rôle `prestataire` n'ouvre que la notification de signature.",
    corps: { cle: "<empreinte sha256 de la clé>", role: "redacteur", label: "Intégration intranet" },
    reponses: [{ code: 201, description: "Clé créée" }, { code: 422, description: "Clé trop courte (cle_trop_courte)" }],
  },
  {
    id: "cles-revoquer", groupe: "autorisation", methode: "POST", chemin: "/v1/auth/cles/{id}/revoquer", auth: "administrateur",
    resume: "Révoquer une clé",
    service: "plateforme",
    params: [{ nom: "id", type: "string", description: "Identifiant de la clé" }],
    reponses: [{ code: 200, description: "Clé révoquée" }, { code: 404, description: "Clé inconnue" }],
  },
  {
    id: "journal", groupe: "autorisation", methode: "GET", chemin: "/v1/journal", auth: "administrateur",
    resume: "Journal d'audit du service",
    service: "plateforme",
    description: "Le journal APPEND-ONLY tenu par le service (et non par le poste) : chaque geste sensible y laisse une ligne, et chaque ligne scelle la précédente par une empreinte. Modifier une ligne rompt la chaîne, ce que le champ `scelle` révèle.",
    reponses: [{ code: 200, description: "Les dernières entrées, et l'état du scellement" }],
  },

  // ================================================ Comptes et sessions
  {
    id: "auth-config", groupe: "comptes", methode: "GET", chemin: "/v1/auth/config", auth: "public",
    resume: "Mode d'authentification du service",
    service: "auto-heberge",
    description: "Le mode du déploiement (`AUTH_MODE` : demo, password, oidc), si les comptes locaux sont ouverts (`comptesLocaux`), si les données se lisent par une session (`session`), le commutateur de démonstration, et l'état du déploiement (base joignable, compte d'administration amorcé). En mode « demo » seulement, la liste des comptes de démonstration. Aucun secret.",
    reponses: [{ code: 200, description: "Mode, état, comptes de démonstration éventuels" }],
    champs: [
      { cle: "auth", type: "string", description: "demo | password | oidc" },
      { cle: "comptesLocaux", type: "booléen", description: "La connexion identifiant + mot de passe est-elle ouverte ?" },
      { cle: "adminAmorce", type: "booléen|null", description: "Le compte d'administration du .env peut-il se connecter ?" },
    ],
  },
  {
    id: "auth-connexion", groupe: "comptes", methode: "POST", chemin: "/v1/auth/connexion", auth: "public",
    resume: "Ouvrir une session",
    service: "auto-heberge",
    description: "Vérifie l'identifiant et le mot de passe, puis pose deux cookies : la session (HttpOnly) et le jeton anti-CSRF. Le message est identique pour un identifiant inconnu et un mot de passe faux ; le compte se bloque progressivement après plusieurs échecs.",
    corps: { login: "j.mercier", motDePasse: "••••••••••" },
    reponses: [{ code: 200, description: "Session ouverte" }, { code: 401, description: "Identifiants invalides" }, { code: 429, description: "Compte bloqué quelques instants" }],
  },
  {
    id: "auth-session", groupe: "comptes", methode: "GET", chemin: "/v1/auth/session", auth: "public",
    resume: "Session courante",
    service: "auto-heberge",
    description: "Rend le compte de la session ouverte, ou 401. C'est l'appel que fait l'application au démarrage pour savoir si la session tient encore.",
    reponses: [{ code: 200, description: "Le compte de la session" }, { code: 401, description: "Session absente ou expirée" }],
  },
  {
    id: "auth-deconnexion", groupe: "comptes", methode: "POST", chemin: "/v1/auth/deconnexion", auth: "public",
    resume: "Fermer la session",
    service: "auto-heberge",
    description: "Efface la session en base et les cookies. Le cookie HttpOnly ne peut pas être effacé par la page : c'est le service qui le fait — et qui invalide la session.",
    reponses: [{ code: 200, description: "Session fermée" }],
  },
  {
    id: "auth-mdp", groupe: "comptes", methode: "POST", chemin: "/v1/auth/mot-de-passe", auth: "public",
    resume: "Changer son mot de passe",
    service: "auto-heberge",
    description: "Exige le mot de passe actuel. Les autres sessions ne sont pas fermées : aucune session n'est privilégiée par rapport à une autre.",
    corps: { motDePasseActuel: "••••••••••", motDePasse: "••••••••••••" },
    reponses: [{ code: 200, description: "Mot de passe changé" }, { code: 400, description: "Mot de passe actuel incorrect" }, { code: 422, description: "Nouveau mot de passe trop faible" }],
  },
  {
    id: "comptes-etat", groupe: "comptes", methode: "GET", chemin: "/v1/auth/comptes", auth: "administrateur",
    resume: "État des mots de passe",
    service: "auto-heberge",
    description: "Pour chaque compte : mot de passe défini ou non, changement exigé, date, échecs, blocage. AUCUN dérivé n'est renvoyé — ni le mot de passe, ni son empreinte.",
    reponses: [{ code: 200, description: "État des comptes" }, { code: 403, description: "Rôle administrateur requis" }],
  },
  {
    id: "comptes-mdp-definir", groupe: "comptes", methode: "POST", chemin: "/v1/auth/comptes/{id}/mot-de-passe", auth: "administrateur",
    resume: "Définir ou remettre un mot de passe",
    service: "auto-heberge",
    description: "Définit le mot de passe d'un compte, ou le REMET. Sans `motDePasse` dans le corps, le service en ENGENDRE un (16 caractères, à changer à la première connexion) et ne le rend qu'ici, une seule fois : c'est la remise d'un accès à un agent.",
    params: [{ nom: "id", type: "string", description: "Identifiant du compte" }],
    corps: { motDePasse: "••••••••••••", mustChange: true },
    reponses: [{ code: 200, description: "Mot de passe défini (le provisoire figure dans la réponse s'il a été engendré)" }, { code: 404, description: "Compte inconnu" }, { code: 422, description: "Mot de passe trop faible" }],
  },
  {
    id: "comptes-mdp-retirer", groupe: "comptes", methode: "DELETE", chemin: "/v1/auth/comptes/{id}/mot-de-passe", auth: "administrateur",
    resume: "Retirer le mot de passe d'un compte",
    service: "auto-heberge",
    description: "Le compte cesse de pouvoir ouvrir de session, et ses sessions ouvertes sont fermées. Le compte lui-même reste au référentiel.",
    params: [{ nom: "id", type: "string", description: "Identifiant du compte" }],
    reponses: [{ code: 200, description: "Mot de passe retiré" }, { code: 404, description: "Compte inconnu" }],
  },

  // ============================================ Persistance partagée
  {
    id: "db-health", groupe: "persistance", methode: "GET", chemin: "/v1/db/health", auth: "public",
    resume: "État de la base de données",
    service: "auto-heberge",
    description: "Le pilote de persistance et le nombre d'enregistrements par collection. C'est l'appel qui dit si la base répond, et qui alimente le badge de l'application.",
    reponses: [{ code: 200, description: "Base disponible" }, { code: 503, description: "Base non prête (base_indisponible)" }],
  },
  {
    id: "db-lire", groupe: "persistance", methode: "GET", chemin: "/v1/db/collections/{collection}", auth: "lecteur",
    resume: "Lire une collection",
    service: "auto-heberge",
    description: "Renvoie tous les enregistrements d'une collection, chacun avec sa révision. Les collections sont `config`, `trames`, `actes`, `users`, `meta`, `journal`, `presence`. En mode « password » ou « oidc », la lecture exige une session ouverte.",
    params: [{ nom: "collection", type: "string", description: "config | trames | actes | users | meta | journal | presence" }],
    reponses: [{ code: 200, description: "Les enregistrements de la collection" }, { code: 401, description: "Session absente" }, { code: 404, description: "Collection inconnue" }],
  },
  {
    id: "db-sync", groupe: "persistance", methode: "POST", chemin: "/v1/db/collections/{collection}/sync", auth: "redacteur",
    resume: "Synchroniser une collection",
    service: "auto-heberge",
    description: "Applique des écritures et des suppressions, enregistrement par enregistrement. Chaque écriture porte la révision connue du client : si le service en détient une autre, l'enregistrement est renvoyé en CONFLIT au lieu d'être écrasé — c'est ce qui permet à deux postes d'écrire sans se détruire mutuellement.",
    params: [{ nom: "collection", type: "string", description: "La collection à synchroniser" }],
    corps: { upserts: [{ id: "act-1", revision: 4, data: { statut: "pret" } }], deletes: [], force: false },
    reponses: [{ code: 200, description: "Synchronisation appliquée (avec la liste des conflits éventuels)" }, { code: 403, description: "Rôle insuffisant (ou force sans le rôle administrateur)" }, { code: 413, description: "Trop d'enregistrements" }, { code: 507, description: "Base pleine" }],
  },

  // ============================================================== Actes
  {
    id: "actes-lister", groupe: "actes", methode: "GET", chemin: "/v1/actes", auth: "lecteur",
    resume: "Lister les actes déposés",
    description: "Les actes déposés auprès du service, du plus récent au plus ancien : numéro, objet, nature, entité, statut, empreinte, publication et circuit de signature.",
    reponses: [{ code: 200, description: "{ actes: [ … ] }" }],
  },
  {
    id: "actes-deposer", groupe: "actes", methode: "POST", chemin: "/v1/actes", auth: "redacteur",
    resume: "Déposer un acte finalisé",
    description: "Reçoit l'acte finalisé (Akoma Ntoso) et le conserve en vue de la signature. Redéposer un document identique encore en circuit renvoie le même acte (200 au lieu de 201). Le champ `publishable: false` rend la publication impossible, même après signature : c'est le cas d'un acte individuel.",
    corps: { akn: "<akomaNtoso>…</akomaNtoso>", numero: "2026-412-VSL", objet: "Tarifs de la restauration scolaire", nature: "arrete", entityId: "ent-vsl", entityName: "Ville de Valmont-sur-Loire", dateSignature: "2026-09-22", trameId: "trame-tarifs", publishable: true, controleLegalite: false },
    reponses: [{ code: 201, description: "Acte déposé" }, { code: 200, description: "Dépôt identique déjà en circuit (idempotent)" }, { code: 413, description: "Document trop volumineux" }],
    champs: [
      { cle: "akn", type: "string", description: "Le document Akoma Ntoso 3.0 (obligatoire)" },
      { cle: "publishable", type: "booléen", description: "false : acte individuel, jamais publié au recueil" },
      { cle: "controleLegalite", type: "booléen", description: "true : la publication attendra la transmission" },
    ],
  },
  {
    id: "actes-lire", groupe: "actes", methode: "GET", chemin: "/v1/actes/{id}", auth: "lecteur",
    resume: "Lire un acte déposé",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte (ACT-…)" }],
    reponses: [{ code: 200, description: "Le résumé de l'acte" }, { code: 404, description: "Acte inconnu" }],
  },
  {
    id: "actes-document", groupe: "actes", methode: "GET", chemin: "/v1/actes/{id}/document", auth: "lecteur",
    resume: "Lire le document déposé",
    description: "Rend le document tel qu'il a été déposé, avec son empreinte SHA-256 — c'est cette empreinte que le service comparera à celle du document signé.",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte" }],
    reponses: [{ code: 200, description: "{ format, document, sha256 }" }, { code: 404, description: "Acte inconnu" }],
  },
  {
    id: "actes-dossier-inerne", groupe: "actes", methode: "GET", chemin: "/v1/actes/{id}/dossier-signature", auth: "administrateur",
    resume: "Lire le dossier de signature interne",
    description: "La PART INTERNE de l'original signé : mentions nominatives du signataire (nom, courriel, compte, moyen d'authentification) et trace des courriels de notification. Ces données ne sont JAMAIS diffusées : elles ne sortent que par cette route, protégée par un jeton ou une session.",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte" }],
    reponses: [{ code: 200, description: "Le dossier interne" }, { code: 404, description: "Aucun dossier interne (dossier_absent)" }],
  },

  // ========================================================== Signature
  {
    id: "signature-envoyer", groupe: "signature", methode: "POST", chemin: "/v1/actes/{id}/signature", auth: "redacteur",
    resume: "Envoyer un acte en signature",
    description: "Ouvre un circuit de signature auprès du prestataire. Le corps porte les signataires, le niveau demandé, l'adresse de notification et les réglages du prestataire (`api` : transport, adresse, identifiant, niveau, délai, points de terminaison). Quand le transport vaut « service » et qu'une adresse ET une clé sont configurées (SCRIBA_SIGNATURE_API_CLE), c'est le SERVICE qui appelle le prestataire : la réponse porte le lien de signature réel. Sinon le circuit est simulé (`simulation: true`). La clé n'est jamais transmise par le client.",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte déposé" }],
    corps: {
      signataires: [{ nom: "Jeanne Mercier", courriel: "j.mercier@exemple.fr", fonction: "Le maire", ordre: 1 }],
      niveau: "avancee",
      urlNotification: "https://actes.exemple.fr/v1/webhooks/signature",
      api: { transport: "service", url: "https://signature.exemple.fr/api/v1", prestataire: "esup-signature", niveau: "avancee", timeoutMs: 20000, cheminDocument: "/documents", cheminSignataires: "/documents/{document}/signataires", cheminDemarrer: "/documents/{document}/demarrer", cheminStatut: "/documents/{document}" },
    },
    reponses: [
      { code: 202, description: "Circuit ouvert" },
      { code: 409, description: "Acte déjà signé, ou validation / révision non achevée" },
      { code: 502, description: "Le prestataire a refusé le circuit (prestataire_indisponible)" },
    ],
    champs: [
      { cle: "signatureId", type: "string", description: "Identifiant du circuit (SIG-…)" },
      { cle: "lienSignature", type: "string", description: "Le lien de signature chez le prestataire, quand il est branché" },
      { cle: "simulation", type: "booléen", description: "true : aucun appel n'est sorti" },
    ],
  },
  {
    id: "signature-lister", groupe: "signature", methode: "GET", chemin: "/v1/signatures", auth: "lecteur",
    resume: "Lister les circuits de signature",
    reponses: [{ code: 200, description: "{ signatures: [ … ] }" }],
  },
  {
    id: "signature-suivre", groupe: "signature", methode: "GET", chemin: "/v1/signatures/{id}", auth: "lecteur",
    resume: "Suivre un circuit",
    description: "L'état du circuit : en_attente, signee, refusee, rejetee. C'est la route que l'application interroge pour relever le statut — et qui fait revenir l'acte signé quand le prestataire l'a notifié.",
    params: [{ nom: "id", type: "string", description: "Identifiant du circuit" }],
    reponses: [{ code: 200, description: "Statut du circuit" }, { code: 404, description: "Circuit inconnu" }],
  },
  {
    id: "signature-document", groupe: "signature", methode: "GET", chemin: "/v1/signatures/{id}/document-signe", auth: "lecteur",
    resume: "Récupérer l'acte signé",
    description: "L'original signé, SANS sa part interne : celle-ci se lit par `/v1/actes/{id}/dossier-signature`.",
    params: [{ nom: "id", type: "string", description: "Identifiant du circuit" }],
    reponses: [{ code: 200, description: "L'original signé" }, { code: 404, description: "Pas encore de document signé" }],
  },
  {
    id: "signature-webhook", groupe: "signature", methode: "POST", chemin: "/v1/webhooks/signature", auth: "prestataire",
    resume: "Notification du prestataire (retour signé)",
    description: "Appelée par le PRESTATAIRE lorsque la signature est apposée. Le service recalcule l'empreinte SHA-256 du document signé et la compare à celle de l'acte déposé : une différence est refusée (409) — la signature n'est jamais acceptée sur un document qui n'est pas celui qui a été déposé. Le rôle exigé est `prestataire` (ou `administrateur`).",
    corps: { signatureId: "SIG-3", statut: "signee", documentSigne: { document: { akn: "…", sha256: "…" }, signatures: [{ signeLe: "2026-09-22T10:12:00Z" }] } },
    reponses: [{ code: 200, description: "Signature acceptée" }, { code: 403, description: "Rôle prestataire requis" }, { code: 409, description: "Empreinte divergente (signature_rejetee)" }],
  },
  {
    id: "signature-externe", groupe: "signature", methode: "POST", chemin: "/v1/actes/{id}/signature-externe", auth: "redacteur",
    resume: "Déposer la version signée (circuit externe)",
    description: "Circuit externe — papier, ou outil tiers que l'application ne pilote pas : le client dépose ici le PDF signé et son empreinte SHA-256. Le service n'a pas de signature cryptographique à vérifier : il enregistre la pièce et fait passer l'acte au statut « signée ». Une nouvelle version signée annule la certification de conformité précédente.",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte déposé" }],
    corps: { nom: "acte-signe.pdf", taille: 182345, sha256: "…", url: "https://…/acte-signe.pdf" },
    reponses: [{ code: 200, description: "Version signée enregistrée" }, { code: 409, description: "L'acte ne suit pas le circuit externe (circuit_non_externe)" }],
  },
  {
    id: "conformite", groupe: "signature", methode: "POST", chemin: "/v1/actes/{id}/conformite", auth: "redacteur",
    resume: "Certifier (ou refuser) la conformité de la pièce signée",
    description: "Le RÉVISEUR certifie que la pièce signée est conforme à la version numérique qui sera publiée. Son contrôle porte sur la PIÈCE SIGNÉE, non sur le texte avant signature. Sans certification, la publication est refusée (409 `conformite_non_certifiee`).",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte" }],
    corps: { statut: "conforme", points: ["Signature manuscrite présente", "Mentions de l'acte conformes"], remarque: "" },
    reponses: [{ code: 200, description: "Certification enregistrée" }],
  },
  {
    id: "transmission", groupe: "signature", methode: "POST", chemin: "/v1/actes/{id}/transmission", auth: "redacteur",
    resume: "Transmettre au contrôle de légalité",
    description: "L'acte signé part vers l'API d'envoi de la préfecture, qui en accuse réception. L'accusé vaut certificat informatique de transmission, déposé sur le document. Un acte déclaré soumis au contrôle de légalité ne peut PAS être publié avant sa transmission (409 `transmission_absente`).",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte" }],
    reponses: [{ code: 200, description: "Transmission enregistrée" }, { code: 409, description: "Acte non signé (acte_non_signe)" }],
  },
  {
    id: "transmission-lire", groupe: "signature", methode: "GET", chemin: "/v1/actes/{id}/transmission", auth: "lecteur",
    resume: "Lire la transmission",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte" }],
    reponses: [{ code: 200, description: "La transmission" }, { code: 404, description: "Aucune transmission (transmission_absente)" }],
  },

  // =================================================== Publication et ELI
  {
    id: "publier", groupe: "publication", methode: "POST", chemin: "/v1/actes/{id}/publication", auth: "redacteur",
    resume: "Publier un acte au recueil",
    description: "Dépose la version en ligne au recueil et attribue l'identifiant ELI. La publication est refusée tant que l'acte n'est pas signé (chaîne d'intégrité), si l'acte a été déclaré non publiable (acte_non_publiable), s'il était soumis au contrôle de légalité et n'a pas été transmis (transmission_absente), et si la date de publication précède la date de signature. Fournir un en-tête « Idempotency-Key » rend l'appel rejouable sans créer de doublon. Le champ `juridique: false` publie un DOCUMENT NON JURIDIQUE (verbatim de séance, déclaration, vœu) : le service n'inscrit alors aucune date d'opposabilité — il l'impose vide —, et le recueil le présente comme un document, sans opposabilité.",
    params: [{ nom: "id", type: "string", description: "Identifiant de l'acte déposé" }],
    corps: { html: "<article>…</article>", akn: "…", original: { document: { akn: "…" }, signatures: [] }, datePublication: "2026-09-22", recueil: "", themeId: "fam-tarifs", themeLabel: "Tarifs" },
    reponses: [{ code: 200, description: "Publication déposée" }, { code: 409, description: "Chaîne d'intégrité rompue" }, { code: 422, description: "Date de publication antérieure à la signature" }],
  },
  {
    id: "publications-lister", groupe: "publication", methode: "GET", chemin: "/v1/publications", auth: "public",
    resume: "Lister le recueil",
    description: "Le registre du recueil public : tous les actes publiés, du plus récent au plus ancien, avec leur identifiant ELI, leur thème et leur date d'opposabilité. C'est cette liste qui alimente le recueil et le plan de site.",
    reponses: [{ code: 200, description: "{ publications: [ … ] }" }],
  },
  {
    id: "publication-lire", groupe: "publication", methode: "GET", chemin: "/v1/publications/{cle}", auth: "public",
    resume: "Lire une publication",
    description: "L'acte publié et ses versions, la plus récente marquée `latest`. Le dossier interne ne sort JAMAIS par cette route.",
    params: [{ nom: "cle", type: "string", description: "Clé de publication" }],
    reponses: [{ code: 200, description: "L'acte publié et ses versions" }, { code: 404, description: "Publication inconnue" }],
  },
  {
    id: "publication-retirer", groupe: "publication", methode: "POST", chemin: "/v1/publications/{cle}/retrait", auth: "administrateur",
    resume: "Retirer une publication",
    description: "Le retrait ne supprime rien : il retire l'acte du recueil en laissant sa trace (un acte retiré reste citable — c'est ce qui distingue un retrait d'une suppression).",
    params: [{ nom: "cle", type: "string", description: "Clé de publication" }],
    corps: { motif: "Publication remplacée par l'acte n° 2026-413-VSL" },
    reponses: [{ code: 200, description: "Publication retirée" }],
  },
  {
    id: "publication-epingler", groupe: "publication", methode: "POST", chemin: "/v1/publications/{cle}/epingle", auth: "editeur",
    resume: "Épingler une publication",
    description: "Met l'acte en avant en tête du recueil public (l'équivalent d'une une).",
    params: [{ nom: "cle", type: "string", description: "Clé de publication" }],
    corps: { epingle: true },
    reponses: [{ code: 200, description: "Publication épinglée" }],
  },
  {
    id: "eli-resoudre", groupe: "publication", methode: "GET", chemin: "/v1/eli/{actTypeId}/{annee}/{numero}/{entite}", auth: "public",
    resume: "Résoudre un identifiant ELI",
    description: "Rend la publication correspondant à un identifiant persistant ELI — la forme citable d'un acte (« eli:/fr/… »). C'est ce que résout un lien stable, des années plus tard.",
    params: [
      { nom: "actTypeId", type: "string", description: "Type d'acte (arrete, deliberation…)" },
      { nom: "annee", type: "string", description: "Année" },
      { nom: "numero", type: "string", description: "Numéro" },
      { nom: "entite", type: "string", description: "Code de l'entité" },
    ],
    reponses: [{ code: 200, description: "La publication" }, { code: 404, description: "ELI inconnu" }],
  },
  {
    id: "eli-original", groupe: "publication", methode: "GET", chemin: "/v1/eli/{actTypeId}/{annee}/{numero}/{entite}/original", auth: "public",
    resume: "L'original signé d'un acte publié",
    description: "L'original signé (part publique : document, signatures, horodatage) — ce que le recueil montre comme « l'original ».",
    params: [
      { nom: "actTypeId", type: "string", description: "Type d'acte" },
      { nom: "annee", type: "string", description: "Année" },
      { nom: "numero", type: "string", description: "Numéro" },
      { nom: "entite", type: "string", description: "Code de l'entité" },
    ],
    reponses: [{ code: 200, description: "L'original signé" }, { code: 404, description: "ELI inconnu" }],
  },
  {
    id: "purge", groupe: "publication", methode: "POST", chemin: "/v1/admin/purge", auth: "administrateur",
    resume: "Remettre le service à zéro",
    description: "Vide les actes déposés, les circuits de signature et les publications — le pendant, côté service, du bouton « Repartir d'un référentiel vierge ». Exige `{ \"confirmation\": \"repurge\" }` : un appel accidentel ne doit pas l'emporter.",
    corps: { confirmation: "repurge" },
    reponses: [{ code: 200, description: "Service purgé" }, { code: 400, description: "Confirmation absente (confirmation_absente)" }],
  },

  // ============================================================= Courriel
  {
    id: "courriel-etat", groupe: "courriel", methode: "GET", chemin: "/v1/courriel", auth: "lecteur",
    resume: "État du service de courriel",
    service: "auto-heberge",
    description: "La configuration SMTP du déploiement — hôte, port, chiffrement, expéditeur, envoi actif ou non — et les derniers envois tentés. AUCUN secret : le mot de passe SMTP ne quitte jamais le serveur.",
    reponses: [{ code: 200, description: "État du service et derniers envois" }],
  },
  {
    id: "courriel-envoi", groupe: "courriel", methode: "POST", chemin: "/v1/courriel/envoi", auth: "administrateur",
    resume: "Envoyer un courriel de notification",
    service: "auto-heberge",
    description: "Envoie un message par le serveur SMTP de la collectivité (`SMTP_*` du `.env`) et le consigne au journal `sb_courriel`. Le corps du message est fourni par l'application : le service n'invente rien.",
    corps: { evenement: "demande_signature", acteId: "ACT-12", destinataires: [{ nom: "Jeanne Mercier", courriel: "j.mercier@exemple.fr" }], sujet: "Acte à signer", texte: "…" },
    reponses: [{ code: 200, description: "Message remis au serveur SMTP" }, { code: 502, description: "Le serveur SMTP a refusé" }],
  },
  {
    id: "courriel-test", groupe: "courriel", methode: "POST", chemin: "/v1/courriel/test", auth: "administrateur",
    resume: "Envoyer un courriel de test",
    service: "auto-heberge",
    description: "Vérifie que le service joint bien le serveur SMTP : envoie un message d'essai aux destinataires indiqués, sans passer par la politique de notification de l'application.",
    corps: { destinataires: ["admin@exemple.fr"] },
    reponses: [{ code: 200, description: "Message d'essai remis au serveur SMTP" }, { code: 502, description: "Le serveur SMTP a refusé" }],
  },

  // ============================================== Adresses publiques du site
  {
    id: "site-recueil", groupe: "site", methode: "GET", chemin: "/recueil", auth: "public",
    resume: "La page du recueil public",
    description: "La page HTML du recueil (hors /v1/) : c'est l'accueil du site, la page que le public visite et que les moteurs indexent.",
    reponses: [{ code: 200, description: "La page du recueil" }],
  },
  {
    id: "site-recueil-json", groupe: "site", methode: "GET", chemin: "/recueil.json", auth: "public",
    resume: "L'index du recueil (JSON)",
    description: "L'index complet du recueil, en JSON : de quoi bâtir un moteur de recherche, un tableau de bord ou une reprise de données.",
    reponses: [{ code: 200, description: "L'index" }],
  },
  {
    id: "site-robots", groupe: "site", methode: "GET", chemin: "/robots.txt", auth: "public",
    resume: "robots.txt",
    description: "Les consignes d'exploration : le recueil est ouvert à l'indexation, l'atelier ne l'est pas.",
    reponses: [{ code: 200, description: "Le fichier" }],
  },
  {
    id: "site-llms", groupe: "site", methode: "GET", chemin: "/llms.txt", auth: "public",
    resume: "llms.txt",
    description: "Le résumé du site à l'attention des agents conversationnels : ce que le recueil contient, et comment le parcourir proprement.",
    reponses: [{ code: 200, description: "Le fichier" }],
  },
  {
    id: "site-sitemap", groupe: "site", methode: "GET", chemin: "/sitemap.xml", auth: "public",
    resume: "sitemap.xml",
    description: "Le plan de site, engendré depuis les publications : chaque acte publié y figure avec son adresse.",
    reponses: [{ code: 200, description: "Le plan de site" }],
  },
];

export const OPERATION = Object.fromEntries(API_REFERENCE.map((o) => [o.id, o]));
export const operationsDuGroupe = (groupe) => API_REFERENCE.filter((o) => o.groupe === groupe);

// ---------------------------------------------------------------------------
// Les rôles et les codes d'erreur, en clair — le complément indispensable de la
// liste des routes : une route sans son code d'erreur ne se débogue pas.
// ---------------------------------------------------------------------------
export const ROLES_API = [
  { role: "lecteur", droits: "Lire les actes déposés, les circuits, les publications." },
  { role: "redacteur", droits: "Déposer un acte, ouvrir un circuit, publier, transmettre." },
  { role: "editeur", droits: "Épingler une publication, gérer les trames (via la synchronisation)." },
  { role: "administrateur", droits: "Tout, y compris les clés, la purge, le journal et le dossier interne." },
  { role: "prestataire", droits: "Rien d'autre que la notification de signature (/v1/webhooks/signature)." },
];

export const CODES_ERREUR = [
  { code: "session_absente", sens: "Aucune session ouverte (mode mot de passe ou annuaire), ou session expirée." },
  { code: "csrf_invalide", sens: "Le jeton anti-CSRF manque ou ne correspond pas : rechargez la page." },
  { code: "role_insuffisant", sens: "La clé ou le compte n'a pas le rôle qu'exige la route." },
  { code: "trop_de_requetes", sens: "Trop d'écritures (ou d'essais de connexion) en peu de temps : ralentissez." },
  { code: "document_absent", sens: "Le corps de la requête n'a pas les champs obligatoires." },
  { code: "document_trop_volumineux", sens: "Le document dépasse la taille maximale du service." },
  { code: "acte_non_signe", sens: "Publication ou transmission demandée avant la signature." },
  { code: "acte_non_publiable", sens: "L'acte a été déposé non publiable (acte individuel)." },
  { code: "transmission_absente", sens: "L'acte est soumis au contrôle de légalité, mais n'a pas été transmis." },
  { code: "conformite_non_certifiee", sens: "Le circuit externe attend la certification de conformité du réviseur." },
  { code: "validation_incomplete", sens: "Le circuit de validation (parapheur) n'est pas achevé." },
  { code: "revision_incomplete", sens: "La révision n'est pas achevée : la signature ne peut pas s'ouvrir." },
  { code: "deja_signe", sens: "L'acte est déjà signé (ou publié)." },
  { code: "signature_rejetee", sens: "L'empreinte du document signé ne correspond pas à celle du document déposé." },
  { code: "prestataire_indisponible", sens: "Le service n'a pas pu ouvrir le circuit auprès du prestataire (adresse, clé, réponse)." },
  { code: "circuit_non_externe", sens: "L'acte ne suit pas le circuit externe." },
  { code: "publication_inconnue", sens: "Aucune publication ne porte cette clé." },
  { code: "date_publication_anterieure", sens: "La date de publication précède la date de signature." },
  { code: "base_indisponible", sens: "La base de données ne répond pas : l'état du service n'est pas lisible." },
  { code: "etat_non_ecrit", sens: "Le service n'a pas pu écrire son état (disque, base)." },
  { code: "collection_inconnue", sens: "Le nom de collection n'existe pas." },
  { code: "force_reserve_admin", sens: "L'écrasement sans contrôle de révision est réservé à l'administrateur." },
  { code: "ressource_inconnue", sens: "L'adresse appelée n'existe pas (404)." },
  { code: "methode_non_autorisee", sens: "L'adresse existe, mais pas pour cette méthode (405)." },
];

// ---------------------------------------------------------------------------
// cURL : l'appel que l'on peut recoller dans un terminal, un ticket, ou une
// documentation d'intégration. Le jeton est mis en marqueur — un exemple ne doit
// jamais contenir une vraie clé.
// ---------------------------------------------------------------------------
export function curlDe(op, { base = "https://api.exemple.fr", token = "VOTRE_JETON", base64 = "" } = {}) {
  const chemin = exempleChemin(op, base64);
  const lignes = [
    `curl -X ${op.methode} '${String(base).replace(/\/+$/, "")}${chemin}'`,
    "  -H 'accept: application/json'",
  ];
  if (op.auth && op.auth !== "public") lignes.push(`  -H 'authorization: Bearer ${token}'`);
  if (op.corps) {
    lignes.push("  -H 'content-type: application/json'");
    lignes.push("  -d '" + JSON.stringify(op.corps) + "'");
  }
  return lignes.join(" \\\n");
}

// Le chemin d'exemple : les paramètres entre accolades reçoivent un exemple
// lisible, pour que la commande collée montre à quoi ressemble un appel réel.
const EXEMPLES_PARAM = {
  id: "ACT-12", cle: "2026-412-VSL", collection: "actes",
  actTypeId: "arrete", annee: "2026", numero: "412", entite: "VSL",
};

export function exempleChemin(op, base64 = "") {
  return String(op.chemin || "").replace(/\{([^}]+)\}/g, (tout, nom) => EXEMPLES_PARAM[nom] || (base64 || nom));
}

// Le tableau des routes, pour l'export Markdown (src/docs/API.md).
export function tableauDesRoutes() {
  const lignes = ["| Méthode | Chemin | Rôle | Objet |", "|---|---|---|---|"];
  for (const o of API_REFERENCE) {
    lignes.push(`| ${o.methode} | \`${o.chemin}\` | ${o.auth === "public" ? "public" : o.auth} | ${o.resume} |`);
  }
  return lignes.join("\n");
}

// ---------------------------------------------------------------------------
// LE DOCUMENT — `src/docs/API.md` est ENGENDRÉ depuis ce module par
// `node src/scripts/generer-api.mjs`. On ne l'écrit donc jamais à la main : on
// corrige une opération ici, et on régénère. Le fichier livré, l'écran
// « API REST » et le panneau de commande lisent ainsi tous la même description,
// et ne peuvent pas diverger.
//
// Les titres de niveau 2 et 3 sont ceux que l'écran de documentation transforme
// en sommaire (voir `outlineOf` dans `ui/markdown.js`) : leur libellé compte.
// ---------------------------------------------------------------------------
const mdCellule = (s) => String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\n/g, " ");

const mdTableau = (entetes, lignes) => {
  const out = [
    "| " + entetes.join(" | ") + " |",
    "|" + entetes.map(() => "---").join("|") + "|",
  ];
  for (const ligne of lignes) out.push("| " + ligne.map(mdCellule).join(" | ") + " |");
  return out.join("\n");
};

export function markdownApi({ base = "https://api.exemple.fr" } = {}) {
  const out = [];
  const p = (texte) => out.push(texte, "");

  p("# L'API REST de Scribae");
  p("Scribae expose tout ce qu'il sait faire par une API REST en JSON. C'est elle "
    + "que le navigateur interroge quand vous travaillez, c'est elle qu'un script "
    + "d'import, un logiciel de gestion documentaire ou un tableur peuvent "
    + "interroger à leur tour, et c'est elle qu'il faut connaître pour brancher un "
    + "prestataire de signature électronique.");
  p("Cette référence est **engendrée depuis le code** (`src/lib/api-reference.js`, "
    + "par `node src/scripts/generer-api.mjs`) : elle décrit exactement la surface "
    + "que le service répond, ni plus ni moins. Le même document alimente l'écran "
    + "« API REST » de l'application, où un panneau de commande permet d'envoyer "
    + "une requête et de lire la réponse sans quitter la page.");

  p("## Deux familles, une même porte");
  p("Les routes se rangent en deux familles, servies par la même façade et le "
    + "même contrôle d'accès :");
  out.push("- la **persistance partagée** — `/v1/db/…` : le référentiel, les "
    + "trames, les actes et les comptes, enregistrement par enregistrement, avec "
    + "révisions et détection de conflits. C'est ce que le navigateur synchronise "
    + "en continu ;");
  out.push("- le **domaine** — `/v1/actes/…`, `/v1/signatures/…`, "
    + "`/v1/publications/…` : le dépôt d'un acte finalisé, l'ouverture d'un circuit "
    + "de signature, la publication au recueil et les identifiants persistants "
    + "(ELI). C'est ce qu'un script ou un prestataire appelle.");
  out.push("");
  p("S'y ajoutent les routes de **service** (`/v1/config`, `/v1/auth/…`, "
    + "`/v1/courriel`) et les **adresses publiques du site** (`/recueil`, "
    + "`/robots.txt`, `/llms.txt`, `/sitemap.xml`), qui ne passent pas par "
    + "`/v1/`.");
  p("Un déploiement autonome (Docker) sert les deux familles depuis son propre "
    + "domaine. Dans la version hébergée, seules les routes marquées "
    + "« auto-hébergé » ci-dessous sont servies par votre installation : la "
    + "persistance partagée et la plateforme sont prises en charge par le service.");

  p("## Adresses, en-têtes, conventions");
  p("Les chemins ci-dessous sont relatifs à la base de l'API. Sous Docker, la base "
    + "est l'adresse de votre déploiement suivie de `/v1`, par exemple "
    + "`https://actes.maville.fr/v1`. Tous les échanges sont en JSON "
    + "(`content-type: application/json`), sauf mention contraire.");
  out.push("```bash");
  out.push(`curl -X GET '${base}/v1/health' \\`);
  out.push("  -H 'accept: application/json'");
  out.push("```");
  out.push("");
  p("En mode hébergé ou en mode annuaire (OIDC), l'appelant s'authentifie par "
    + "l'en-tête `authorization: Bearer <jeton>`. En mode mot de passe, la session "
    + "est portée par un cookie ; les écritures exigent alors le jeton anti-CSRF "
    + "renvoyé par `GET /v1/auth/session`. Les clés d'API se créent dans "
    + "« Référentiel › Autorisation » ; leur rôle détermine ce qu'elles peuvent "
    + "faire.");
  p("Une opération annoncée sous un rôle exige **au moins** ce rôle : "
    + "`admin` peut tout ce que peut `editeur`, et ainsi de suite.");

  for (const groupe of GROUPES_API) {
    const operations = operationsDuGroupe(groupe.id);
    if (!operations.length) continue;
    p("## " + groupe.label);
    p(groupe.resume);
    for (const op of operations) {
      p("### `" + op.methode + " " + op.chemin + "` — " + op.resume);
      if (op.description) p(op.description);
      out.push("- **Authentification** : " + (op.auth === "public" ? "publique" : op.auth));
      out.push("- **Service** : " + (
        op.service === "auto-heberge" ? "auto-hébergé"
          : op.service === "plateforme" ? "plateforme"
            : "les deux"
      ));
      out.push("");
      if (op.params && op.params.length) {
        p(mdTableau(["Paramètre", "Type", "Description"],
          op.params.map((x) => [x.nom, x.type, x.description])));
      }
      if (op.corps) {
        p("**Corps de la requête**");
        out.push("```json", JSON.stringify(op.corps, null, 2), "```", "");
      }
      p("**Exemple**");
      out.push("```bash", curlDe(op, { base }), "```", "");
      if (op.reponses && op.reponses.length) {
        p(mdTableau(["Code", "Signification"],
          op.reponses.map((r) => [String(r.code), r.description])));
      }
      if (op.champs && op.champs.length) {
        p(mdTableau(["Champ", "Type", "Description"],
          op.champs.map((c) => [c.cle, c.type, c.description])));
      }
    }
  }

  p("## Les rôles");
  p("Un rôle est un droit d'ensemble. Une clé, un compte ou une session en porte "
    + "un, et chaque route exige le sien.");
  p(mdTableau(["Rôle", "Ce qu'il permet"],
    ROLES_API.map((r) => [r.role, r.droits])));

  p("## Les codes d'erreur");
  p("En cas d'échec, le service répond avec un code HTTP (400, 401, 403, 404, 405, "
    + "409, 413, 429, 500, 502) et un corps `{ erreur: { code, message } }`. Le "
    + "`message` est destiné à l'être humain ; le `code` est destiné au programme, "
    + "et c'est lui qu'il faut traiter.");
  p(mdTableau(["Code", "Ce qu'il signifie"],
    CODES_ERREUR.map((e) => [e.code, e.sens])));

  p("## Tableau des routes");
  p(tableauDesRoutes());
  p("---");
  p("Document engendré par `node src/scripts/generer-api.mjs` depuis "
    + "`src/lib/api-reference.js`. Ne pas modifier à la main : corriger la "
    + "description, puis régénérer.");

  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd();
}
