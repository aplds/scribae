// ============================================================================
// Guide d'utilisation (« wiki ») — contenu rédactionnel uniquement.
//
// Public visé : un agent administratif qui utilise peu l'informatique (Word et
// la messagerie, sans plus). Règles d'écriture, à respecter si vous modifiez ce
// fichier :
//   - phrases courtes, un geste par étape, on commence par un verbe ;
//   - pas de jargon sans explication immédiate (voir le glossaire) ;
//   - on rassure : ce qui se passe si on se trompe, où sont les fichiers, etc.
//
// Les illustrations sont des captures de l'application (voir SHOTS). Elles sont
// produites avec html2canvas sur l'application en fonctionnement, puis déposées
// via l'outil d'hébergement de fichiers : les URL ci-dessous sont permanentes.
// Pour refaire une capture : mettre l'application dans l'état voulu, appeler
// html2canvas(élément).toDataURL(), téléverser, puis reporter ici l'URL et les
// repères numérotés (x/y en pourcentage de l'image).
// ============================================================================

// Marqueur de mise en forme : **gras** et `code`.
export const SHOTS = {
  trames: {
    url: "https://user.uploads.dev/file/fd08159782c59a2c00ff2b8668538def.png",
    caption: "La liste des modèles. C'est le point de départ.",
    marks: [
      { n: 1, x: 8, y: 15.1, w: 14.4, h: 4.7, label: "Le menu : tout part d'ici" },
      { n: 2, x: 30.6, y: 54.3, w: 26.3, h: 34.6, label: "Une carte = un modèle d'acte" },
      { n: 3, x: 32.6, y: 55.4, w: 5.6, h: 4.1, label: "Le bouton « Rédiger » de ce modèle" },
      { n: 4, x: 23.9, y: 55.4, w: 10.5, h: 4.1, label: "« Ouvrir l'éditeur » : corriger le modèle (administrateurs et éditeurs)" },
    ],
  },
  rediger: {
    url: "https://user.uploads.dev/file/db4e17b8b36cb0091620d62a53c5bee9.png",
    caption: "L'écran de rédaction : le document est votre feuille de travail.",
    marks: [
      { n: 1, x: 8, y: 13, w: 14.4, h: 3, label: "Le menu : tout part d'ici" },
      { n: 2, x: 37.2, y: 12, w: 19.4, h: 2.6, label: "L'entité concernée : la structure au nom de laquelle l'acte est pris" },
      { n: 3, x: 72.2, y: 12, w: 17.5, h: 2.6, label: "Enregistrer, puis Exporter… juste à côté" },
      { n: 4, x: 44.3, y: 60.5, w: 53.6, h: 76.1, label: "Le document : on écrit dedans et on clique les pastilles" },
      { n: 5, x: 31.7, y: 28.4, w: 6.5, h: 1.2, label: "Une pastille : cliquez-la pour renseigner le champ" },
      { n: 6, x: 46.2, y: 55.1, w: 43.6, h: 1.4, label: "Un passage réécrit : barre orange, mention « hors trame »" },
      { n: 7, x: 85.4, y: 28.3, w: 26.4, h: 27.7, label: "Le panneau : les contrôles de la trame et les passages réécrits" },
    ],
  },
  conformite: {
    url: "https://user.uploads.dev/file/780540bde8ae74b601b55a6ecc88a5ac.png",
    caption: "Le panneau « Contrôle & écarts » : les contrôles de la trame, puis les passages réécrits.",
    marks: [

    ],
  },
  export: {
    url: "https://user.uploads.dev/file/317346bb6d212794411b5b9ca2575bdd.png",
    caption: "La fenêtre d'export. Dans presque tous les cas : « Imprimer / PDF ».",
    marks: [
      { n: 1, x: 34, y: 39.4, w: 8.9, h: 2.6, label: "Imprimer / PDF : le document à signer et à envoyer" },
      { n: 2, x: 34, y: 36.1, w: 8.8, h: 2.6, label: "HTML complet : la page web de l'acte (rarement utile)" },
      { n: 3, x: 41.7, y: 32.7, w: 24.3, h: 2.6, label: "Formats techniques : archives, publication, informaticiens" },
    ],
  },
  actes: {
    url: "https://user.uploads.dev/file/c671d0f2cd93e7daa97ad81d0c087821.png",
    caption: "Le registre des actes enregistrés.",
    marks: [
      { n: 1, x: 20.7, y: 18.5, w: 6.4, h: 3.8, label: "Le numéro de l'acte" },
      { n: 2, x: 34.7, y: 18.5, w: 21.5, h: 3.8, label: "L'objet, en une ligne" },
      { n: 3, x: 54.8, y: 18.5, w: 4.8, h: 3.8, label: "« conforme » ou « N écart(s) » : ce qui a été réécrit par rapport au modèle" },
      { n: 4, x: 71.9, y: 18.5, w: 4.9, h: 3.8, label: "L'état : brouillon, prêt, exporté…" },
      { n: 5, x: 90.2, y: 25.8, w: 16.8, h: 10.6, label: "Reprendre la rédaction · Voir · Modifier · Exporter · Supprimer" },
    ],
  },
  editor: {
    url: "https://user.uploads.dev/file/b78b16373dc94d2840469d7342fa5923.png",
    caption: "L'éditeur de trame : trois colonnes (le plan, la page, l'inspecteur).",
    marks: [
      { n: 1, x: 24.8, y: 54.8, w: 17.4, h: 90.4, label: "Le plan : les morceaux du document (cliquez pour en sélectionner un)" },
      { n: 2, x: 54.9, y: 54.8, w: 42.9, h: 90.4, label: "La page : le document lui-même, modifiable en cliquant dedans" },
      { n: 3, x: 88.2, y: 54.8, w: 23.6, h: 90.4, label: "L'inspecteur : les réglages du morceau sélectionné" },
      { n: 4, x: 61.9, y: 18.9, w: 1.4, h: 1.1, label: "Un petit « + » insère un morceau à cet endroit" },
    ],
  },
  signature: {
    url: "https://user.uploads.dev/file/c76d6bc6b44e979e95d9a7eb006ff2c6.png",
    caption: "Le circuit de signature : à gauche l'acte, à droite les étapes franchies.",
    marks: [
      { n: 1, x: 36.5, y: 35.3, w: 38.1, h: 4, label: "L'acte à envoyer : cliquez-le pour le sélectionner" },
      { n: 2, x: 77.7, y: 47.8, w: 39.5, h: 34.3, label: "Les cinq étapes : la coche verte marque ce qui est franchi" },
      { n: 3, x: 77.7, y: 72.4, w: 41.9, h: 9.5, label: "Les actions : envoyer en signature, ou publier l'acte signé" },
      { n: 4, x: 84.9, y: 9.6, w: 7.9, h: 3.7, label: "L'état du service de signature" },
    ],
  },
  publication: {
    url: "https://user.uploads.dev/file/7499080dfe6b8b8e16f983f091e73ea6.png",
    caption: "La version en ligne d'un acte publié, telle que le public la consulte.",
    marks: [
      { n: 1, x: 84.5, y: 9.7, w: 14.2, h: 1.3, label: "L'identifiant ELI : la référence permanente de l'acte" },
      { n: 2, x: 86.8, y: 20.3, w: 23.6, h: 7.2, label: "Publié le… et l'entrée en vigueur : les deux dates de l'opposabilité" },
      { n: 3, x: 86.8, y: 31, w: 23.6, h: 12.8, label: "Les pièces disponibles, dont l'original signé" },
      { n: 4, x: 45.7, y: 17.7, w: 56.4, h: 2.2, label: "Texte, métadonnées, versions, original signé" },
    ],
  },
};

export const GUIDE = {
  title: "Guide d'utilisation",
  subtitle: "Écrire un acte administratif avec l'application : tout ce qu'il faut savoir, expliqué simplement.",
  updated: "Septembre 2026",
  pathways: [
    { label: "Je débute", hint: "10 minutes, de zéro jusqu'à l'acte envoyé", chapters: ["demarrer", "ouvrir", "rediger", "messages", "export"] },
    { label: "Je m'en sers déjà", hint: "Les raccourcis utiles", chapters: ["rediger", "export", "retrouver", "corbeille", "modifier", "depannage"] },
    { label: "Je valide des actes", hint: "Le parapheur, et ce qui suit", chapters: ["parapheur", "signature", "execution", "mots"] },
    { label: "Je publie un acte", hint: "Signature électronique, ELI, opposabilité, délais", chapters: ["parapheur", "signature", "publication", "execution", "modifier"] },
    { label: "Je prépare les modèles", hint: "Pour les administrateurs", chapters: ["administrateurs", "chartes", "modifier", "mots", "depannage"] },
    { label: "Je gère les comptes", hint: "Qui peut faire quoi, et comment ouvrir un compte", chapters: ["comptes", "annuaire", "administrateurs", "depannage"] },
  ],
  chapters: [
    // ------------------------------------------------------------------ 1
    {
      id: "demarrer",
      title: "Bienvenue : à quoi sert cette application",
      short: "Le principe en deux minutes : un modèle, un formulaire, un acte fini.",
      icon: "info",
      minutes: 2,
      audience: "all",
      keywords: "présentation débuter principe trame modèle acte",
      blocks: [
        { t: "p", text: "Quand il faut nommer quelqu'un, déléguer une signature ou créer une régie, il faut écrire un **acte** : un document officiel, avec des visas, des articles, une signature et un numéro. C'est ce document que cette application vous aide à produire." },
        { t: "p", text: "Avant, on partait d'un modèle au format Word, on le complétait, on le renommait, on l'imprimait. Chacun faisait un peu à sa manière et les conseils donnés par les collègues se perdaient dans les commentaires." },
        { t: "p", text: "Ici, cela se passe en trois temps :" },
        { t: "steps", items: [
          { text: "On choisit un **modèle tout prêt** (on l'appelle une « trame »)." },
          { text: "On **complète le document** en cliquant les champs en pastille." },
          { text: "L'application **écrit l'acte** au bon format, avec le bon numéro, puis on l'**exporte** pour le faire signer." },
        ] },
        { t: "note", kind: "ok", title: "En une phrase", text: "Un modèle, un document à compléter, un acte propre à envoyer. Rien de plus." },
        { t: "note", kind: "warn", title: "Le bandeau « Démonstration » en haut de l'écran", text: "S'il est affiché, vous êtes dans l'**installation de démonstration** : les données sont fictives et la signature électronique est simulée. Le bandeau disparaît quand l'administrateur met l'application en service pour de vrai." },
        { t: "p", text: "Deux choses que l'application **ne fait pas** : elle ne signe pas à votre place, et elle n'envoie pas les messages. L'impression, la signature et l'envoi restent votre travail." },
        { t: "p", text: "Et surtout : elle **n'oublie rien**. Chaque acte enregistré est numéroté et rangé dans un registre qu'on peut consulter des années plus tard." },
        { t: "next", chapter: "ouvrir", label: "Ouvrir l'application et s'y retrouver" },
      ],
    },
    // ------------------------------------------------------------------ 2
    {
      id: "ouvrir",
      title: "Ouvrir l'application et s'y retrouver",
      short: "L'adresse, les cinq boutons du menu, et l'écran de départ.",
      icon: "eye",
      minutes: 3,
      audience: "all",
      keywords: "ouvrir adresse favori menu navigation écran trames sombre apparence thème clair",
      blocks: [
        { t: "p", text: "Ouvrez votre navigateur (Chrome, Edge, Firefox ou Safari) et tapez l'adresse que l'administrateur vous a communiquée. Elle ressemble à `https://mon-organisme.github.io/scribae/`." },
        { t: "note", kind: "info", title: "À faire une fois pour toutes", text: "Pendant que la page est affichée, cliquez sur l'**étoile** à droite de la barre d'adresse (ou faites Ctrl+D). L'adresse est enregistrée dans vos favoris : vous n'aurez plus jamais à la retaper." },
        { t: "shot", shot: "trames" },
        { t: "p", text: "Le menu de gauche sert à tout. Selon votre profil, il contient les boutons suivants :" },
        { t: "terms", items: [
          { term: "Trames", def: "La liste des modèles d'actes, leur création et leur mise à jour. Réservé aux **éditeurs** et aux **administrateurs** : un rédacteur choisit son modèle directement dans « Rédiger un acte »." },
          { term: "Rédiger un acte", def: "Le document à compléter directement. C'est votre écran de travail." },
          { term: "Modifier un acte", def: "Pour corriger un acte déjà signé : on réécrit directement l'acte, et l'application produit un acte modificatif et la version consolidée." },
          { term: "Actes", def: "Le registre : tous les actes que vous avez enregistrés, avec leur numéro." },
          { term: "Référentiel", def: "Les données de la collectivité (entités, personnes, textes de référence). Réservé aux administrateurs : vous n'avez rien à y modifier." },
          { term: "Guide", def: "Ce document, avec une barre de recherche." },
        ] },
        { t: "note", kind: "info", title: "Travailler en clair ou en sombre", text: "Le bouton **lune / soleil** en haut à droite bascule l'application en **mode sombre** — plus confortable le soir ou sur un écran peu lumineux. Le menu de votre compte (à côté) propose aussi « **Automatique** » : l'application suit alors le réglage clair / sombre de votre système. C'est un réglage de **votre** poste de travail : il ne change rien pour vos collègues, et le document — le papier des actes — reste blanc, comme à l'impression." },
        { t: "note", kind: "warn", title: "La règle la plus importante", text: "Rien n'est enregistré avant que vous cliquiez sur **Enregistrer**. Si vous fermez l'onglet en pleine rédaction, tout ce qui n'était pas enregistré est perdu." },
        { t: "next", chapter: "rediger", label: "Écrire un acte, pas à pas" },
      ],
    },
    // ------------------------------------------------------------------ 3
    {
      id: "rediger",
      title: "Écrire un acte, pas à pas",
      short: "Le chapitre principal : vous écrivez directement dans le document.",
      icon: "doc",
      minutes: 8,
      audience: "all",
      keywords: "rédiger écrire document pastille champ compléter numéro entité enregistrer export aperçu word traitement de texte hors trame",
      blocks: [
        { t: "p", text: "C'est le chapitre à lire en premier. Ici, pas de formulaire à part : **le document est votre feuille de travail**. Vous le complétez et vous le corrigez directement, comme dans un traitement de texte." },
        { t: "shot", shot: "rediger" },
        { t: "p", text: "Deux repères suffisent pour s'y retrouver :" },
        { t: "terms", items: [
          { term: "La pastille (bleue, jaune ou pointillée)", def: "C'est un champ prévu par le modèle. Cliquez dessus : une petite fenêtre s'ouvre, vous saisissez, vous cliquez sur « Terminer ». Le texte se met à jour tout seul." },
          { term: "Le texte normal", def: "Cliquez dedans et écrivez : vous pouvez corriger, compléter, effacer, exactement comme dans Word." },
        ] },
        { t: "steps", items: [
          { text: "Dans le menu de gauche, cliquez sur **Rédiger un acte**.", detail: "L'écran de choix s'ouvre : il liste les modèles de votre service, et les actes que vous avez laissés commencés." },
          { text: "Choisissez ce que vous rédigez.", detail: "Cliquez sur **Rédiger** sur la carte du modèle voulu. Si vous aviez déjà commencé un acte, il figure en haut : cliquez sur **Reprendre** (ou sur « Continuer » pour la rédaction en cours). Un champ de recherche filtre les modèles par nom." },
          { text: "En cours de rédaction, le bouton **Changer d'acte** (en haut) ramène à cet écran : rien n'est perdu, votre brouillon vous attend.", detail: "Les éditeurs et les administrateurs peuvent aussi lancer une rédaction depuis la liste des modèles (« Trames »), bouton « Rédiger » de la carte voulue." },
          { text: "Choisissez l'**Entité** concernée, en haut de la page.", detail: "C'est la structure au nom de laquelle l'acte est pris. Le nom de l'autorité qui signe en découle automatiquement." },
          { text: "Renseignez le **numéro** : cliquez la pastille « Numéro de l'acte », ou utilisez le bouton **Réserver le prochain numéro** du panneau de droite.", detail: "Ne le tapez jamais à la main : c'est lui qui garantit qu'aucun acte ne portera deux fois le même numéro." },
          { text: "Cliquez sur chaque **pastille** pour la renseigner, de haut en bas.", detail: "Les pastilles jaunes sont celles qui restent à compléter. Vous pouvez aussi passer par la liste « À compléter » du panneau de droite : les deux sont liés." },
          { text: "Écrivez dans le document tout ce qui doit être adapté.", detail: "Ajouter une phrase, préciser une condition, corriger une formule : c'est permis. Relisez comme vous reliriez une lettre avant de l'envoyer." },
          { text: "Ouvrez l'onglet **Contrôle & écarts** du panneau de droite.", detail: "Vert : tout est bon. Rouge : il manque quelque chose, le message dit quoi. Les passages que vous avez réécrits y sont aussi rappelés." },
          { text: "Cliquez sur **Enregistrer**.", detail: "L'acte entre au registre avec son numéro. Il sera toujours retrouvable, même si vous fermez le navigateur." },
          { text: "Cliquez sur **Exporter…** et choisissez le format.", detail: "Dans presque tous les cas : « Imprimer / PDF ». Voir le chapitre « Enregistrer, imprimer, envoyer »." },
        ] },
        { t: "note", kind: "info", title: "Les trois couleurs des pastilles", text: "Une pastille **bleue** est un champ déjà renseigné. Une pastille **jaune** est un champ encore vide. Une valeur **soulignée d'un pointillé** vient du référentiel (l'entité, le signataire) : elle n'est pas saisie ici." },
        { t: "note", kind: "warn", title: "Si vous réécrivez le texte du modèle", text: "C'est autorisé, et rien ne vous en empêchera. Simplement, l'acte portera la mention **« hors trame »** : les administrateurs verront ce que vous avez changé, et pourront faire évoluer le modèle si votre correction était justifiée. Le panneau de droite liste ces passages et permet de revenir au texte du modèle." },
        { t: "note", kind: "info", title: "Vous pouvez vous arrêter en route", text: "Tant que l'acte est **enregistré**, vous pouvez fermer la page : il vous attend dans le menu **Actes**, bouton « Reprendre »." },
        { t: "next", chapter: "messages", label: "Les messages rouges et orange" },
      ],
    },
    // ------------------------------------------------------------------ 4
    {
      id: "messages",
      title: "Les messages rouges et orange",
      short: "Comprendre le panneau « Contrôle & écarts » et savoir quoi corriger.",
      icon: "warn",
      minutes: 3,
      audience: "all",
      keywords: "conformité contrôle bloquant avertissement erreur rouge orange jeton écart hors trame",
      blocks: [
        { t: "p", text: "Le panneau **Contrôle & écarts**, à droite du document, relit l'acte pour vous, comme le ferait un collègue qui connaît les règles. Il ne vous empêche pas de travailler : il vous prévient avant que le document ne parte." },
        { t: "shot", shot: "conformite" },
        { t: "table", head: ["Le message", "Ce que ça veut dire", "Ce que vous faites"], rows: [
          ["Champ obligatoire non renseigné : …", "Une case obligatoire est encore vide.", "Cliquez la pastille indiquée dans le document, ou la case du panneau « À compléter »."],
          ["Export bloqué par les contrôles", "Le document est incomplet : il ne peut pas partir.", "Lisez les messages rouges, corrigez-les ; l'export se débloque tout seul."],
          ["Contrôle(s) bloquant(s) (pastille rouge)", "Il reste au moins une chose à corriger.", "Corrigez avant d'imprimer ou d'envoyer."],
          ["Références non résolues : …", "Un endroit du texte devait afficher une valeur, mais rien n'a été trouvé.", "Vérifiez que vous avez choisi la bonne personne, la bonne entité et la bonne date."],
          ["Message en orange", "Ce n'est pas interdit, mais il faut vérifier.", "Relisez le passage et corrigez si besoin ; l'export reste possible."],
          ["N écart(s) à la trame (pastille jaune)", "Vous avez réécrit un passage du modèle.", "Rien d'obligatoire : relisez le passage. Le panneau rappelle le texte du modèle et permet de le rétablir d'un clic."],
        ] },
        { t: "note", kind: "ok", title: "Bonne nouvelle", text: "Le numéro et la date sont posés par l'application : vous ne pouvez pas les oublier. Et si vous vous trompez, rien n'est cassé : corrigez la case et **enregistrez** à nouveau." },
        { t: "p", text: "S'il ne vous reste qu'un avertissement orange et que vous êtes sûr de vous, vous pouvez exporter : à vous de juger, c'est un signal, pas une interdiction." },
        { t: "next", chapter: "export", label: "Enregistrer, imprimer, envoyer" },
      ],
    },
    // ------------------------------------------------------------------ 5
    {
      id: "export",
      title: "Enregistrer, imprimer, envoyer",
      short: "Où arrive le fichier, comment l'imprimer et le joindre à un message.",
      icon: "download",
      minutes: 5,
      audience: "all",
      keywords: "exporter imprimer pdf fichier téléchargement mail joindre pièce jointe envoyer",
      blocks: [
        { t: "p", text: "« Exporter », cela veut dire : l'application fabrique un **fichier** que vous pourrez ouvrir, imprimer ou envoyer. Ce fichier arrive dans votre dossier « Téléchargements », comme n'importe quel document téléchargé." },
        { t: "shot", shot: "export" },
        { t: "steps", items: [
          { text: "Cliquez sur **Exporter…** en haut à droite de l'écran.", detail: "Si un contrôle bloquant est en échec, les boutons restent grisés : revenez corriger d'abord." },
          { text: "Cliquez sur **Imprimer / PDF**.", detail: "Un nouvel onglet s'ouvre avec le document présenté proprement, **au format A4**, prêt à imprimer." },
          { text: "Dans cet onglet, imprimez ou enregistrez en PDF.", detail: "Bouton Imprimer, puis, dans la fenêtre de votre système, choisissez « Enregistrer au format PDF » comme imprimante et validez. Gardez le format **A4** et la « taille réelle » (100 %) : c'est la présentation attendue par les services." },
          { text: "Récupérez le fichier dans **Téléchargements**.", detail: "Une petite flèche apparaît parfois en bas de la fenêtre du navigateur : cliquez dessus. Sinon, ouvrez « Téléchargements » (Explorateur de fichiers sous Windows, Finder sur Mac)." },
          { text: "Ouvrez le fichier pour le relire avant de l'envoyer.", detail: "Double-cliquez dessus : il s'ouvre dans votre lecteur de PDF." },
        ] },
        { t: "p", text: "Pour envoyer l'acte à la signature, joignez le **fichier PDF** à un message. Voici où cliquer :" },
        { t: "svg", name: "mail" },
        { t: "steps", items: [
          { text: "Ouvrez votre boîte aux lettres et cliquez sur **Nouveau message**.", detail: "Le bouton est en haut à gauche chez Outlook, Gmail ou Thunderbird." },
          { text: "Remplissez la ligne **À** : l'adresse de la personne qui doit recevoir l'acte.", detail: "Si le nom apparaît tout seul quand vous tapez les premières lettres, cliquez dessus." },
          { text: "Écrivez un **objet** clair : « Acte 2026-401 — pour signature ».", detail: "Cela permettra de retrouver votre message dans une boîte qui en contient des centaines." },
          { text: "Ajoutez une phrase de présentation, courte.", detail: "Par exemple : « Bonjour, veuillez trouver ci-joint l'arrêté de nomination pour signature. »" },
          { text: "Cliquez sur le **trombone** (Joindre un fichier) et choisissez le fichier dans Téléchargements.", detail: "Le nom du fichier doit apparaître sous la ligne d'objet : c'est la preuve qu'il est bien attaché." },
          { text: "Cliquez sur **Envoyer**.", detail: "Si vous ne trouvez pas le trombone, cherchez un bouton « Joindre » ou une icône en forme d'attache-tout." },
        ] },
        { t: "note", kind: "warn", title: "Ne recopiez jamais le texte", text: "N'écrivez pas le contenu de l'acte dans le message. La personne doit recevoir le **document**, en pièce jointe : sans lui, l'acte ne peut être ni signé ni publié." },
        { t: "p", text: "Les autres formats proposés servent plus rarement :" },
        { t: "terms", items: [
          { term: "Imprimer / PDF", def: "Le document final, **au format A4**, à signer ou à envoyer. C'est celui-là qu'on utilise presque toujours." },
          { term: "Word (.doc)", def: "Le même acte dans un fichier que Word (ou LibreOffice) ouvre et met en page **en A4**. À utiliser si vous devez retoucher le texte. Attention : les retouches faites dans Word ne sont pas conservées dans l'application." },
          { term: "HTML complet", def: "La page complète de l'acte, telle qu'elle apparaîtrait sur un site internet. Elle est elle aussi au format A4 : imprimée depuis un navigateur, elle donne le même document que « Imprimer / PDF »." },
          { term: "Markdown", def: "Pour les sites internet et les informaticiens. Vous n'en avez pas besoin." },
          { term: "Akoma Ntoso, Schematron, JSON-LD", def: "Des formats techniques destinés à l'archivage, à la publication et aux logiciels. Vous ne les ouvrez pas vous-même : vous les transmettez si on vous les demande." },
        ] },
        { t: "next", chapter: "parapheur", label: "Faire valider l'acte (le parapheur)" },
      ],
    },
    // --------------------------------------- 5 bis : le parapheur (validation)
    {
      id: "parapheur",
      title: "Faire valider un acte (le parapheur)",
      short: "Avant la signature, l'acte passe par les mains de ceux qui doivent l'approuver.",
      icon: "check",
      minutes: 4,
      audience: "all",
      keywords: "parapheur validation valider circuit bon pour accord avis renvoyer refuser visa chef de service direction reprise",
      blocks: [
        { t: "p", text: "Un acte ne part pas en signature dès qu'il est écrit. Selon l'acte, il doit d'abord recevoir le **bon pour accord** du chef de service, puis le **visa** de la direction — parfois un simple **avis**. C'est ce chemin qu'on appelle le **parapheur**." },
        { t: "p", text: "Tout se passe dans l'écran **Parapheur**, dans le menu de gauche. Le chemin à suivre dépend de l'acte : c'est le référentiel de la collectivité qui le définit, pas vous." },
        { t: "terms", items: [
          { term: "Circuit", def: "La suite d'étapes que l'acte doit franchir (par exemple : chef de service, puis direction générale)." },
          { term: "Bon pour accord", def: "L'étape engage la suite : sans elle, on ne passe pas à la suivante." },
          { term: "Avis", def: "Une étape consultative : elle est conservée au dossier, mais elle n'empêche pas la signature." },
          { term: "Caduque", def: "La validation n'est plus valable, parce que le texte de l'acte a été modifié depuis." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Parapheur** : l'onglet **À valider par moi** montre ce qui attend votre décision." },
          { text: "Cliquez sur l'acte dans la liste de gauche pour lire son circuit et l'étape ouverte." },
          { text: "Écrivez votre **observation** (elle est obligatoire pour un renvoi ou un refus), puis cliquez sur **Bon pour accord**, **Donner l'avis**, **Renvoyer en rédaction** ou **Refuser**." },
          { text: "Quand toutes les étapes obligatoires sont franchies, l'acte est **validé** : il peut partir en signature." },
        ] },
        { t: "note", kind: "warn", title: "Si l'acte est modifié après validation", text: "Le parapheur garde le souvenir du **texte exact** qui a été approuvé. Si quelqu'un réécrit l'acte ensuite, la validation devient **caduque** : l'écran le signale et propose de **reprendre le circuit** depuis la première étape. C'est ce qui garantit qu'on ne signe jamais autre chose que ce qui a été approuvé." },
        { t: "note", kind: "info", title: "Où en est mon acte ?", text: "Pendant la rédaction, l'en-tête de l'écran indique l'état du circuit — et propose « **Soumettre au circuit** » quand l'acte vient d'être enregistré. La fiche de l'acte (depuis le registre) montre la même chose : le circuit, qui a décidé quoi, quand, et les observations." },
        { t: "note", kind: "info", title: "Un acte sans circuit", text: "Certains actes ne passent par aucun parapheur (aucun circuit ne s'applique, ou la trame demande explicitement « aucune validation »). Ils partent alors directement en signature — c'est normal." },
        { t: "next", chapter: "signature", label: "Faire signer l'acte" },
      ],
    },
    // ------------------------------------------- 5 bis : signature et publication
    {
      id: "signature",
      title: "Faire signer un acte",
      short: "Envoyer l'acte au prestataire de signature et récupérer l'acte signé.",
      icon: "lock",
      minutes: 4,
      audience: "all",
      keywords: "signature signer prestataire certificat horodatage webhook circuit original signé",
      blocks: [
        { t: "p", text: "Un acte n'existe vraiment qu'une fois **signé** par la personne qui a le pouvoir de le prendre. L'application envoie l'acte à un service de signature électronique et reçoit en retour l'acte signé." },
        { t: "note", kind: "info", title: "Il faut d'abord l'accord du parapheur", text: "L'acte doit avoir franchi son **circuit de validation** (voir le chapitre « Faire valider un acte »). Sinon, le bouton « Envoyer en signature » reste inactif et l'écran explique pourquoi. Et si l'acte est réécrit après la validation, celle-ci devient caduque : le circuit doit être repris." },
        { t: "p", text: "Pour cela, ouvrez **Signature & publication** dans le menu de gauche, puis l'onglet « Circuit de signature »." },
        { t: "shot", shot: "signature" },
        { t: "terms", items: [
          { term: "Acte finalisé", def: "L'acte est complété et enregistré : plus aucun contrôle bloquant ne s'y oppose." },
          { term: "Prestataire de signature", def: "Le service qui recueille la signature (ESUP-Signature ou équivalent). C'est un autre logiciel, avec ses propres écrans." },
          { term: "Certificat", def: "Le « tampon » électronique du signataire, délivré par une autorité. C'est lui qui permet de vérifier la signature des années plus tard." },
          { term: "Horodatage", def: "La preuve de la date et de l'heure exactes de la signature." },
          { term: "Webhook", def: "Le retour du prestataire : il prévient l'application que la signature est faite et lui remet l'acte signé." },
        ] },
        { t: "steps", items: [
          { text: "Repérez l'acte à signer dans la colonne de gauche et cliquez dessus pour le sélectionner." },
          { text: "Cliquez sur **Envoyer en signature**.", detail: "L'acte part au service, qui calcule son **empreinte** (une sorte de code-barres du document) et ouvre un circuit de signature." },
          { text: "L'écran du prestataire s'ouvre : relisez l'acte, puis cliquez sur **Signer l'acte**.", detail: "C'est le geste de signature : le certificat signe l'empreinte du document, et la date est horodatée." },
          { text: "Le prestataire prévient l'application : l'acte revient signé.", detail: "Le service vérifie au passage que le document signé est bien exactement celui qui avait été déposé. Sinon, il refuse la signature." },
          { text: "L'acte porte alors la mention **Signé** : vous pouvez le publier, ou télécharger l'original signé." },
        ] },
        { t: "note", kind: "info", title: "Si le signataire refuse", text: "Cliquez sur **Refuser** : l'acte revient en rédaction avec la mention « Prêt ». Rien n'est perdu, il suffit de le renvoyer après correction." },
        { t: "note", kind: "warn", title: "La signature de cette installation", text: "Le prestataire est ici une **simulation** : les échanges, la cryptographie et le retour de l'acte signé sont réels et vérifiables, mais le certificat est un certificat de démonstration — il n'a pas la valeur d'une signature qualifiée au sens du règlement eIDAS. En production, l'application est branchée sur le prestataire de la collectivité." },
        { t: "next", chapter: "publication", label: "Publier l'acte et le rendre opposable" },
      ],
    },
    // ------------------------------------------------ 5 ter : publication (ELI)
    {
      id: "publication",
      title: "Publier l'acte (ELI et opposabilité)",
      short: "Mettre l'acte en ligne, lui donner son identifiant ELI et fixer sa date d'opposabilité.",
      icon: "eye",
      minutes: 4,
      audience: "all",
      keywords: "publication publier eli opposabilité opposable recueil version en ligne original signé acte individuel non publiable",
      blocks: [
        { t: "p", text: "Un acte signé n'est pas encore **opposable** : il ne peut être appliqué qu'à partir du moment où il a été publié. C'est la publication qui le rend obligatoire pour tout le monde." },
        { t: "p", text: "L'onglet « Publication (ELI) » fait ce travail : il dépose la **version en ligne** de l'acte au recueil, lui donne son **identifiant ELI** et fixe les dates." },
        { t: "terms", items: [
          { term: "Opposabilité", def: "Le moment à partir duquel l'acte peut être appliqué à tout le monde. Par défaut : le lendemain de la publication." },
          { term: "ELI (European Legislation Identifier)", def: "L'identifiant européen d'un texte : une référence courte et permanente, par exemple `eli:/fr/dec/2026/0402/iar`, qui ne change jamais, même si l'adresse du site change." },
          { term: "Recueil", def: "Le « journal officiel » de la collectivité : la collection dans laquelle les actes sont publiés." },
          { term: "Version en ligne", def: "La page web de l'acte publié, celle que chacun peut consulter." },
          { term: "Original signé", def: "Le document signé, conservé tel quel. C'est lui qui fait foi ; la version en ligne n'est qu'une lecture pratique." },
          { term: "Acte non publiable", def: "Acte individuel (revalorisation d'un traitement, sanction…) dont la trame est déclarée non publiable : signé et conservé au registre, il n'est pas déposé au recueil et ne reçoit pas d'identifiant ELI." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez l'onglet **Publication (ELI)**, puis vérifiez le **recueil** et la **date de publication**.", detail: "La date proposée est celle du jour. Elle ne peut pas être antérieure à la date de signature : l'application vous en avertit." },
          { text: "Choisissez quand l'acte entre en vigueur : le lendemain de la publication, ou après un nombre de jours.", detail: "C'est la date d'opposabilité. « Au lendemain de la publication » est la règle habituelle." },
          { text: "La nature publiée est déterminée par l'acte lui-même : un acte modificatif est publié comme acte modificatif, une version consolidée comme version consolidée.", detail: "Les versions successives d'un même acte se rangent sous le même identifiant ELI : c'est l'identifiant qui est stable, pas l'adresse." },
          { text: "Si l'acte est un acte modificatif, laissez cochée l'option **Publier aussi la version consolidée**.", detail: "Elle est alors publiée sous le même identifiant ELI que l'acte d'origine : elle devient la version en vigueur et supplante l'originale, qui reste consultable dans l'onglet « Versions »." },
          { text: "Cliquez sur **Publier et attribuer l'ELI**." },
          { text: "L'application affiche l'identifiant ELI, l'adresse de la version en ligne et les deux dates.", detail: "Vous pouvez ensuite consulter la version en ligne, télécharger l'original signé et les formats techniques." },
        ] },
        { t: "note", kind: "warn", title: "On ne publie pas un acte non signé", text: "Le service refuse la publication tant que l'acte n'est pas signé (et si la date de publication précède la signature). Ce n'est pas une tracasserie : c'est ce qui garantit que l'acte publié est bien celui qui a été signé." },
        { t: "note", kind: "info", title: "Tous les actes ne se publient pas", text: "Les **actes individuels** (revalorisation d'un traitement, sanction disciplinaire…) relèvent de trames déclarées **non publiables**. Ils sont signés et conservés au registre, mais ne sont **jamais déposés au recueil** : ils n'apparaissent donc pas dans la file « à publier », mais dans la carte « Actes non publiables ». C'est leur **notification** à l'intéressé qui les rend applicables à son égard." },
        { t: "p", text: "Pour relire une publication, ouvrez **Publications (ELI)** dans le menu : le registre public liste les actes publiés, et vous pouvez y coller un identifiant ELI pour retrouver directement un texte." },
        { t: "shot", shot: "publication" },
        { t: "next", chapter: "execution", label: "Rendre l'acte exécutoire (formalités et délais)" },
      ],
    },
    // ------------------------------------ 5 quater : exécution & délais
    {
      id: "execution",
      title: "Rendre l'acte exécutoire (formalités et délais)",
      short: "Transmettre, publier, notifier : ce qui fait qu'un acte s'applique vraiment — et jusqu'à quand il peut être contesté.",
      icon: "warn",
      minutes: 5,
      audience: "all",
      keywords: "exécutoire exécution formalité transmission contrôle de légalité préfecture publication notification délai recours contentieux échéancier constater",
      blocks: [
        { t: "p", text: "Un acte signé n'est pas encore **exécutoire** : il ne s'applique qu'une fois les formalités accomplies. Selon l'acte, il faut le **transmettre** au contrôle de légalité, le **publier** au recueil, ou **notifier** la personne concernée." },
        { t: "p", text: "L'écran **Exécution & délais** montre, pour chaque acte signé, ce qui reste à faire et jusqu'à quand il peut être contesté." },
        { t: "terms", items: [
          { term: "Transmission", def: "L'envoi au contrôle de légalité (préfecture, @ctes). C'est elle qui fait courir le délai de deux mois du représentant de l'État." },
          { term: "Publication", def: "Le dépôt au recueil, qui rend l'acte opposable à tout le monde. Quand l'acte est publié depuis « Signature & publication », cette formalité se constate d'elle-même." },
          { term: "Notification", def: "L'envoi à la personne concernée. Indispensable pour un acte individuel (revalorisation, sanction), qui ne se publie pas." },
          { term: "Exécutoire", def: "La date à laquelle la dernière formalité requise est accomplie. C'est de cette date que part le délai de recours." },
          { term: "Délai de recours", def: "Deux mois, en principe, pour contester l'acte devant le juge. Passé ce délai, l'acte est définitif." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Exécution & délais**, onglet **Formalités à accomplir**." },
          { text: "Cliquez sur l'acte dans la liste de gauche : ses formalités s'affichent, celles qui sont requises et celles qui sont déjà faites." },
          { text: "Cliquez sur **Enregistrer** au bas de la formalité, et renseignez la **date**, la **référence** (numéro d'accusé de réception, référence du recueil…) et, pour une notification, les **destinataires**." },
          { text: "Validez : l'acte devient **exécutoire** si c'était la dernière formalité requise, et l'écran indique la fin du délai de recours." },
        ] },
        { t: "note", kind: "info", title: "Pourquoi c'est vous qui le déclarez", text: "L'application ne peut pas deviner qu'un courrier est parti. Chaque formalité est donc une **constatation** : vous attestez la date et la référence, l'application l'horodate, l'inscrit à votre nom et la garde au dossier." },
        { t: "note", kind: "warn", title: "Retards et délais", text: "L'écran signale les transmissions et publications qui traînent, et les délais de recours qui se referment. Le registre des actes rappelle aussi combien d'actes attendent une formalité." },
        { t: "next", chapter: "retrouver", label: "Retrouver un acte déjà écrit" },
      ],
    },
    // ------------------------------------------------------------------ 6
    {
      id: "retrouver",
      title: "Retrouver un acte déjà écrit",
      short: "Le registre : numéro, objet, état, et reprendre une rédaction.",
      icon: "list",
      minutes: 2,
      audience: "all",
      keywords: "registre actes historique rouvrir reprendre statut brouillon supprimer",
      blocks: [
        { t: "p", text: "Pour retrouver vite un acte, une trame ou une personne, appuyez sur **Ctrl+K** (ou tapez **« / »**) : une fenêtre de recherche s'ouvre par-dessus l'écran. Tapez quelques lettres, choisissez avec les **flèches**, validez avec **Entrée**." },
        { t: "p", text: "Tout ce que vous enregistrez se range dans **Actes**, dans le menu de gauche. La liste est classée du plus récent au plus ancien." },
        { t: "shot", shot: "actes" },
        { t: "terms", items: [
          { term: "Brouillon", def: "L'acte est commencé : il manque encore des informations." },
          { term: "Prêt", def: "Tout est rempli et les contrôles sont passés. Vous pouvez exporter." },
          { term: "En signature", def: "L'acte est parti chez le signataire ; il attend sa signature." },
          { term: "Signé", def: "L'acte porte une signature : il peut être publié au recueil." },
          { term: "Exporté, Publié", def: "Le document est parti. L'acte est considéré comme finalisé." },
          { term: "Abrogé", def: "L'acte n'est plus en vigueur : un autre l'a remplacé." },
        ] },
        { t: "list", items: [
          "**Reprendre** : rouvre le document pour continuer la rédaction ou corriger (le même écran que « Rédiger un acte »).",
          "**Voir** : affiche le document final en lecture seule.",
          "**Colonne « Trame »** : « conforme », ou « N écart(s) » si le texte a été réécrit par rapport au modèle.",
          "**↓ (exporter)** : refait un export sans rien modifier (par exemple pour renvoyer le PDF).",
          "**🗑 (mettre à la corbeille)** : l'acte part à la **corbeille** (rien n'est perdu : on peut le restaurer, voir le chapitre suivant).",
        ] },
        { t: "note", kind: "info", title: "Le registre de démonstration est déjà garni", text: "Pour la démonstration, le registre contient plusieurs actes : des actes **déjà rédigés et signés** (leur signature est vérifiable), deux actes **prêts à signer** et un **brouillon** à compléter. Vous pouvez les ouvrir, les reprendre, les modifier ou les publier — et tout se passe comme si vous les aviez écrits." },
        { t: "note", kind: "warn", title: "Où vivent vos actes", text: "En **mode local** (celui de la démonstration), ils sont enregistrés dans **ce navigateur**, sur **ce poste de travail** : ils ne sont donc pas sur un serveur commun. C'est pourquoi on exporte les actes importants — le fichier, lui, peut être copié, envoyé et archivé. Quand l'administrateur a branché l'application sur la **base partagée** de la collectivité, les actes sont au contraire rangés côté serveur et visibles depuis tous les postes." },
        { t: "next", chapter: "corbeille", label: "La corbeille" },
      ],
    },
    // ------------------------------------------------- 6 ter : la corbeille
    {
      id: "corbeille",
      title: "La corbeille",
      short: "Un acte supprimé n'est pas perdu : il attend à la corbeille.",
      icon: "trash",
      minutes: 2,
      audience: "all",
      keywords: "corbeille supprimer supprimé restaurer restauration définitive effacer récupérer",
      blocks: [
        { t: "p", text: "Quand vous supprimez un acte ou une trame, il ne disparaît pas : il part à la **corbeille**. Rien n'est effacé tant que vous ne le décidez pas explicitement." },
        { t: "steps", items: [
          { text: "Ouvrez **Corbeille** dans le menu de gauche." },
          { text: "Les actes et les trames supprimés y sont listés, avec la date de suppression et le nom de la personne qui les y a mis." },
          { text: "Cliquez sur **Restaurer** pour les remettre à leur place, ou sur **Supprimer définitivement** pour les effacer pour de bon." },
        ] },
        { t: "note", kind: "warn", title: "La suppression définitive est irréversible", text: "L'écran demande une confirmation, et l'effacement est inscrit au **journal** (Référentiel › Journal d'audit), avec son auteur et l'heure." },
        { t: "note", kind: "info", title: "Ce que voit le registre", text: "Les actes à la corbeille n'apparaissent plus dans le registre des actes, ni dans le parapheur, ni dans l'échéancier. Le registre en signale simplement le nombre, avec un lien vers la corbeille." },
        { t: "next", chapter: "modifier", label: "Modifier un acte déjà publié" },
      ],
    },
    // ------------------------------------------------ 6 bis : modifier un acte
    {
      id: "modifier",
      title: "Modifier un acte déjà écrit",
      short: "Éditer directement l'acte publié, puis signer et publier : la version consolidée prend la place de l'originale.",
      icon: "refresh",
      minutes: 7,
      audience: "all",
      keywords: "modifier acte modificatif consolidée consolidation abroger remplacer insérer article rectifier supplanter version en vigueur historique",
      blocks: [
        { t: "p", text: "Un acte déjà signé ou publié ne se corrige pas : on ne réécrit pas un document signé. On le **modifie** par un nouvel acte, qui dit précisément ce qui change." },
        { t: "p", text: "L'application fait ce travail et produit **deux documents** :" },
        { t: "terms", items: [
          { term: "L'acte modificatif", def: "Un acte à part entière, avec son propre numéro, dont chaque article modifie un article de l'acte d'origine." },
          { term: "La version consolidée", def: "L'acte d'origine remis à jour. Elle se lit par défaut dans sa seule rédaction en vigueur, chaque article modifié portant la mention « Modifié par … du … » sous son intitulé ; le suivi des modifications (ajouts et suppressions apparents, tableau récapitulatif à la fin) s'affiche sur demande, depuis l'onglet « Version consolidée »." },
          { term: "La version en vigueur", def: "Une fois l'acte modificatif publié, la version consolidée est publiée sous le même identifiant ELI que l'acte d'origine : elle devient le texte en vigueur et supplante l'originale, qui reste consultable dans l'historique des versions." },
        ] },
        { t: "steps", items: [
          { text: "Dans le menu de gauche, cliquez sur **Modifier un acte**." },
          { text: "Choisissez l'acte à modifier dans la liste, ou importez le fichier de l'acte publié.", detail: "L'import sert lorsque l'acte n'a pas été produit ici : déposez son fichier .akn.xml ou son fichier JSON." },
          { text: "Éditez l'acte directement dans la page, comme dans un traitement de texte.", detail: "Réécrivez un article ; le bouton **abroger** le retire du dispositif ; **+ article après** insère un nouvel article. Ce que vous modifiez est surligné en orange." },
          { text: "Suivez les modifications relevées dans le panneau de droite.", detail: "Chaque ligne dit quel article change et comment ; le bouton « Annuler » écarte une modification sans toucher au reste. Les onglets du bas montrent l'acte modificatif et la version consolidée tels qu'ils seront produits ; sur la version consolidée, la case **Afficher le suivi des modifications** (décochée par défaut) montre — ou masque — les ajouts et les suppressions." },
          { text: "Cliquez sur **Confirmer la modification**, renseignez l'acte modificatif (numéro, date, objet, signataire), puis **Générer les deux actes**.", detail: "Le bouton « Réserver » prend le prochain numéro du registre. Les deux documents entrent au registre : vous pouvez les exporter et les imprimer comme n'importe quel acte." },
          { text: "Envoyez l'acte modificatif en signature, signez-le, puis publiez-le.", detail: "La fenêtre qui s'ouvre après la génération propose directement l'envoi en signature." },
          { text: "À la publication, la version consolidée est publiée en même temps, sous le même identifiant ELI que l'acte d'origine.", detail: "Elle devient la version en vigueur ; l'acte d'origine reste accessible dans l'onglet « Versions » de la publication, et dans l'historique de l'acte." },
        ] },
        { t: "note", kind: "info", title: "L'acte d'origine n'est jamais effacé", text: "Il reste consultable — avec sa signature — et chaque modification laisse une trace : l'acte modificatif qui l'a portée et la version consolidée correspondante. C'est l'**historique des modifications dans le temps**, visible dans la fiche de l'acte et sous son identifiant ELI." },
        { t: "note", kind: "info", title: "Ce qui ne se modifie pas ici", text: "Le préambule (intitulé, visas, considérants) et le bloc de signature appartiennent à l'acte d'origine : la modification porte sur les **articles**. C'est ce que décrit l'acte modificatif, article par article." },
        { t: "note", kind: "warn", title: "Si l'acte d'origine n'a pas été produit ici", text: "Importez son fichier : sans lui, l'application ne sait pas ce qu'elle modifie. Le fichier Akoma Ntoso (.akn.xml) est celui que l'application produit, et celui qu'un administrateur peut vous transmettre." },
        { t: "note", kind: "info", title: "Les écarts de rédaction", text: "Si un rédacteur a adapté le texte d'une trame, l'acte porte la mention **« hors trame »** : le détail de ce qu'il a réécrit reste visible dans le registre des actes et dans les fichiers exportés. C'est un signalement, jamais un blocage." },
        { t: "next", chapter: "mots", label: "Glossaire : les mots employés ici" },
      ],
    },
    // ------------------------------------------------------------------ 7
    {
      id: "administrateurs",
      title: "Préparer et faire évoluer une trame",
      short: "Pour les administrateurs et les éditeurs : l'éditeur de trame et les commentaires qui ne se perdent plus.",
      icon: "gear",
      minutes: 6,
      audience: "admin",
      keywords: "administrateur éditeur trame éditeur de trame bloc champ règle commentaire service auteur version publier base de données mysql mariadb partagé multi-poste serveur persistance importer export exemple json modèle fichier format",
      blocks: [
        { t: "p", text: "Ce chapitre s'adresse aux collègues — administrateurs **et éditeurs** — qui écrivent et mettent à jour les modèles. Les autres peuvent passer au glossaire." },
        { t: "p", text: "Une trame se fabrique dans l'**éditeur de trame** : depuis la liste, cliquez sur « Ouvrir l'éditeur » sur la carte du modèle. L'écran est divisé en trois colonnes." },
        { t: "shot", shot: "editor" },
        { t: "terms", items: [
          { term: "À gauche : le plan", def: "La liste des morceaux du document (intitulé, visas, articles, signature…). Cliquez un morceau pour le sélectionner et le régler à droite." },
          { term: "Au centre : la page", def: "Le document tel qu'il sera imprimé. Cliquez directement dans le texte pour le corriger." },
          { term: "À droite : l'inspecteur", def: "Les réglages du morceau sélectionné, plus les onglets « Champs » (les informations demandées au rédacteur), « Règles » et « Trame »." },
        ] },
        { t: "steps", items: [
          { text: "Pour **ajouter un morceau**, cliquez sur un petit **+** entre deux blocs et choisissez le type.", detail: "Le morceau s'insère exactement à cet endroit ; les flèches ↑ ↓ le déplacent, la corbeille le retire." },
          { text: "Pour **corriger un texte**, cliquez dedans et écrivez.", detail: "Les pastilles bleues sont des **champs** : elles seront remplacées par ce que le rédacteur saisira. Utilisez « Insérer un champ » pour en ajouter un, et les filtres `|date-long`, `|money`… pour la mise en forme." },
          { text: "Pour **expliquer une règle**, ouvrez l'onglet « Bloc » puis « Commentaires », et cliquez sur Ajouter.", detail: "Choisissez la nature : juridique, consigne, question ou veille. Le commentaire est **signé du service** de votre compte (le vôtre, pas votre nom), reste visible dans l'inspecteur, part dans les exports et ne disparaît plus comme un commentaire Word." },
          { text: "Pour **empêcher un oubli**, ouvrez l'onglet « Champs » et cochez « obligatoire » sur la case concernée.", detail: "Le rédacteur est averti, et l'export est bloqué tant que la case est vide." },
          { text: "Pour rendre un paragraphe **facultatif**, remplissez « Condition d'affichage » dans l'inspecteur.", detail: "Le bloc n'apparaîtra que si la condition est vraie — par exemple seulement pour une régie de recettes." },
          { text: "Pour **préparer vos trames en amont** (éditeur de texte, script, hors ligne), cliquez sur « Fichier d'exemple » : le JSON téléchargé documente chaque clé et se réimporte tel quel, via « Importer une trame ».", detail: "Un fichier peut contenir une trame ({ \"trame\": {…} }), plusieurs trames ({ \"trames\": [ {…}, {…} ] }), ou directement une trame. Seuls « name » et « body » sont obligatoires ; les identifiants sont régénérés à l'import. Les erreurs de format sont listées avant tout import, et les points corrigés automatiquement (type inconnu, valeur par défaut) sont signalés." },
          { text: "Quand la trame est prête, **mettez à jour la version** et le statut, puis exportez-la en JSON pour la transmettre.", detail: "Tant qu'une trame reste sur votre poste, personne d'autre ne l'a. Une trame publiée sans version claire est une source de confusion." },
        ] },
        { t: "note", kind: "info", title: "Déclarer une trame non publiable", text: "Dans l'onglet « Trame », la case **« Publiable au recueil des actes administratifs »** est cochée par défaut. Décochez-la pour les trames qui produisent des **actes individuels** (revalorisation d'un traitement, sanction disciplinaire, décision nominative…). Les actes issus de ces trames sont alors rédigés, signés et conservés au registre, mais **jamais** déposés au recueil : le service refuse leur publication, même signés. Réservez cette déclaration aux actes que le droit ne soumet pas à publicité ; la déclaration vaut aussi pour les actes déjà rédigés à partir de la trame." },
        { t: "note", kind: "info", title: "Rien de figé dans le code", text: "Entités, personnes, rôles, références, mentions, vocabulaire de rédaction, numérotation, **circuits de validation** (Référentiel › Circuits de validation) et **délais** (Référentiel › Exécution & délais) : tout se règle dans **Référentiel**. On y change une formule de recours, un type d'acte, ou l'ordre des visas à obtenir sans toucher à l'application." },
        { t: "p", text: "**Où vivent les données.** Par défaut, tout est rangé dans votre navigateur : c'est le mode de démonstration, pratique mais **propre à ce poste**. Pour que plusieurs agents travaillent sur les mêmes trames et les mêmes actes, l'administrateur ouvre **Référentiel › Base de données** et branche l'application sur la base de la collectivité (MySQL / MariaDB) — ou, sans rien installer, sur le **service partagé** de la démonstration." },
        { t: "note", kind: "warn", title: "Changer de base ne déplace pas les documents", text: "Basculer d'un mode à l'autre ne mélange pas les données : ce qui est à l'écran y reste jusqu'à ce que vous cliquiez **Envoyer les données à la base** ou **Récupérer depuis la base**. En cas de doute, exportez d'abord (onglet « Données »), puis transférez." },
        { t: "note", kind: "info", title: "Deux postes, le même acte", text: "Quand la base est partagée, deux personnes peuvent modifier en même temps des éléments **différents** sans se gêner. Si elles touchent le **même** élément, la base refuse le second écrasement : la version enregistrée est reprise et un message le signale — plutôt que de perdre silencieusement le travail de l'autre. L'en-tête montre qui est **présent** (les pastilles) et si un collègue a le **même acte ouvert** ; la **cloche** signale ce qui vous attend — un acte à valider, une signature, une publication." },
        { t: "next", chapter: "mots", label: "Glossaire : les mots employés ici" },
      ],
    },
    // ------------------------------------------------------------------ 8
    {
      id: "chartes",
      title: "Habiller les actes : la charte graphique",
      short: "Feuilles de style : marges, police, logo, filets, en-tête — une charte par entité ou par famille d'actes.",
      icon: "palette",
      minutes: 6,
      audience: "admin",
      keywords: "feuille de style charte graphique police logo en-tête pied de page filet diviseur encadré couleur présentation pdf word aperçu entité famille sous-feuille marges cadre capitales éditeur direct wysiwyg sombre",
      blocks: [
        { t: "p", text: "Un acte, c'est un texte — mais c'est aussi une **apparence** : un logo en tête, une police, des filets, une couleur, des marges. C'est ce que règle l'écran **Feuilles de style**, dans le menu « Configurer ». Rien n'y est codé : chaque collectivité, chaque entité, compose la sienne." },
        { t: "terms", items: [
          { term: "Feuille générale", def: "La charte par défaut, celle de la collectivité. Elle habille **tous** les actes, sauf ceux qu'une sous-feuille vise. Il n'y en a qu'une." },
          { term: "Sous-feuille", def: "Une charte particulière, rattachée facultativement à une **entité** et/ou à une **famille d'actes**. C'est ainsi que le CCAS peut avoir son en-tête sans changer celui de la mairie." },
          { term: "Réglages", def: "La vue exhaustive : tous les réglages, rangés par thème (papier, typographie, intitulé, visas, filets, articles, tableaux, signature, en-tête…)." },
          { term: "Édition directe", def: "L'autre façon de faire, la plus rapide : on **clique l'élément** dans l'aperçu (l'intitulé, un tableau, l'en-tête) et seuls ses réglages apparaissent. Le texte de l'acte n'est jamais modifié." },
          { term: "Modèle de départ", def: "Une présentation complète appliquée d'un clic : « Classique préfectoral », « Moderne », « Solennel », « Sobre », « Recueil communal », « Acte individuel ». Tout reste modifiable ensuite." },
          { term: "Aperçu", def: "À droite de l'écran, un acte type rendu par le **même code** que le PDF et l'export Word. Ce que vous voyez est ce qui sortira." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Feuilles de style** et choisissez une feuille dans la liste de gauche.", detail: "La démonstration en livre trois : la charte générale, celle du CCAS, celle des actes individuels. « Nouvelle sous-feuille » en crée une ; « Dupliquer » part d'une existante." },
          { text: "Cliquez **Édition directe**, en haut de l'écran.", detail: "Le bouton d'affichage passe de « Réglages » à « Édition directe ». Cliquez alors un élément dans l'aperçu — l'intitulé, un tableau, le bloc de signature — : l'encadré bleu montre ce qui est réglé, et seuls ses réglages apparaissent. La barre de pastilles (« Papier », « En-tête », « Signature »…) permet d'atteindre directement une partie du document." },
          { text: "Pour partir d'une base, appliquez un **Modèle de départ**.", detail: "Dans la vue « Réglages » : « Solennel » pose un cadre double et des numéros d'article dans la marge, « Moderne » un bandeau et une police sans empattement, etc. Le nom, le rattachement et le logo de la feuille sont conservés." },
          { text: "Réglez ensuite ce qui fait l'identité du document.", detail: "Marges de page, police et corps, couleurs, en-tête et pied de page, filets, encadrés, tableaux, bloc de signature, cadre de page. Chaque changement se répercute aussitôt dans l'aperçu. Les textes de l'en-tête et du pied acceptent des jetons : {{entity.name}}, {{brand.name}}, {{numero}}, {{objet}}, {{dateSignature}}…" },
          { text: "Rattachez une sous-feuille à ses **entités** et à ses **familles** d'actes.", detail: "Dès qu'une entité ou une famille lui est associée, les actes concernés prennent cette charte — sans qu'on touche à leurs trames." },
          { text: "Pour un acte précis, désignez la feuille depuis l'onglet « Trame » de l'éditeur de trame.", detail: "Le champ « Feuille de style » de la trame l'emporte sur tout le reste. Laissez-le sur « Automatique » dans le cas général." },
          { text: "Vérifiez le résultat sur un vrai acte : **Actes → l'acte → Imprimer / PDF** ou **HTML**.", detail: "L'aperçu, le PDF, l'export Word et la version publiée au recueil appliquent tous la même charte." },
        ] },
        { t: "note", kind: "info", title: "Qui l'emporte", text: "Ordre de priorité : la **trame** (si elle désigne une feuille), puis l'**entité** signataire, puis la **famille** de la trame, puis la **feuille générale**. Autrement dit, la règle la plus précise gagne." },
        { t: "note", kind: "info", title: "Les marges de page", text: "Les marges font partie de la charte (en millimètres) : elles s'appliquent à l'aperçu, au PDF, au fichier Word et à la version publiée. Si vous imprimez directement l'aperçu de l'application (Ctrl+P), c'est la feuille **générale** qui donne ses marges à la page." },
        { t: "note", kind: "info", title: "Ce qui n'est pas dans la charte", text: "La charte ne change **que la présentation**. Le texte, les visas, les articles, le numéro et les dates viennent de la trame et de la rédaction. Habiller un acte ne modifie jamais son contenu — c'est vrai aussi de l'édition directe, où l'on ne peut cliquer que des éléments d'apparence." },
        { t: "note", kind: "warn", title: "Importer et exporter une charte", text: "Une charte s'exporte en JSON (« Exporter la charte ») et s'importe sur un autre poste ou dans une autre collectivité. Elle voyage aussi avec l'export complet du référentiel (Référentiel → Données)." },
        { t: "next", chapter: "mots", label: "Glossaire : les mots employés ici" },
      ],
    },
    // ------------------------------------------------------------------ 9
    {
      id: "mots",
      title: "Glossaire : les mots employés ici",
      short: "Tous les termes de l'application, expliqués en une phrase.",
      icon: "note",
      minutes: 4,
      audience: "all",
      keywords: "glossaire définitions vocabulaire visa considérant trame jeton entité base de données partagé",
      blocks: [
        { t: "p", text: "Les mots du métier et ceux de l'application, dans l'ordre où ils vous viendront. En cas de doute, cherchez le mot dans la barre de recherche du guide." },
        { t: "terms", items: [
          { term: "Acte", def: "Le document officiel signé par l'autorité : une décision, une nomination, une délégation…" },
          { term: "Trame", def: "Le modèle d'acte préparé à l'avance par les administrateurs. On dit aussi « modèle »." },
          { term: "Feuille de style", def: "La charte graphique d'un acte : police, logo, en-tête, filets, encadrés. Une feuille générale sert de défaut ; des sous-feuilles se rattachent à des entités ou à des familles d'actes. Elle ne change que la présentation, jamais le texte." },
          { term: "Rédacteur", def: "La personne qui remplit le formulaire. C'est vous." },
          { term: "Administrateur", def: "La ou les collègues qui écrivent les trames et tiennent le référentiel à jour." },
          { term: "Entité", def: "La commune, l'établissement public ou le service au nom duquel l'acte est pris." },
          { term: "Signataire", def: "La personne qui appose sa signature sur l'acte." },
          { term: "Visa", def: "Les textes et décisions rappelés avant de décider (« Vu le décret… »)." },
          { term: "Considérant", def: "Les raisons de la décision (« Considérant que… »)." },
          { term: "Formule d'édiction", def: "Le mot qui annonce la décision : « DÉCIDE », « ARRÊTE »." },
          { term: "Article", def: "Une partie numérotée de la décision. Un acte doit en comporter au moins un." },
          { term: "Champ (ou jeton)", def: "Un emplacement du modèle rempli automatiquement avec ce que vous saisissez. Il s'affiche en pastille bleue dans l'éditeur." },
          { term: "Numéro (chrono)", def: "Le numéro unique de l'acte, attribué par l'application. On le réserve, on ne le tape pas." },
          { term: "Registre", def: "La liste de tous les actes enregistrés : le menu « Actes »." },
          { term: "Référentiel", def: "La liste des données réutilisables : entités, personnes, rôles, textes de référence, mentions, vocabulaire, numérotation." },
          { term: "Conformité", def: "Le contrôle automatique passé avant l'export." },
          { term: "Écart (hors trame)", def: "Un passage du document qui a été réécrit par rapport au modèle. Le texte réécrit est conservé, mais l'acte le signale aux administrateurs. Ce n'est jamais bloquant." },
          { term: "Acte modificatif", def: "L'acte qui modifie un acte déjà signé : il dit, article par article, ce qui est remplacé, abrogé ou ajouté." },
          { term: "Version consolidée", def: "L'acte d'origine remis à jour de ses modifications. Elle se lit par défaut dans sa rédaction en vigueur, chaque article modifié portant la mention de l'acte qui l'a modifié ; le suivi des modifications (ajouts et suppressions apparents, tableau récapitulatif) est une option. Elle est diffusée à titre d'information : seuls les actes publiés font foi." },
          { term: "Prestataire de signature", def: "Le service extérieur qui recueille la signature électronique (ESUP-Signature ou équivalent). L'application lui envoie l'acte et reçoit l'acte signé en retour." },
          { term: "Empreinte", def: "Une suite de caractères calculée à partir du document (SHA-256). Si le document change d'un seul caractère, l'empreinte change : c'est ce qui prouve qu'un acte n'a pas été modifié." },
          { term: "Certificat", def: "Le « tampon » électronique du signataire, délivré par une autorité. Il permet de vérifier la signature, des années plus tard." },
          { term: "Horodatage", def: "La preuve de la date et de l'heure exactes de la signature." },
          { term: "Circuit de signature", def: "Le parcours d'un acte envoyé en signature : déposé, envoyé, signé (ou refusé)." },
          { term: "Publication", def: "Le dépôt officiel de l'acte : c'est à partir de là qu'il s'impose à tout le monde." },
          { term: "Opposabilité", def: "Le moment à partir duquel l'acte peut être appliqué. Par défaut, le lendemain de sa publication." },
          { term: "ELI", def: "European Legislation Identifier : l'identifiant permanent d'un texte, par exemple `eli:/fr/dec/2026/0402/iar`. C'est lui qu'on cite, plutôt que l'adresse du site." },
          { term: "Recueil", def: "Le « journal officiel » de la collectivité, dans lequel les actes sont publiés." },
          { term: "Version en ligne", def: "La page web de l'acte publié, celle que tout le monde peut consulter." },
          { term: "Original signé", def: "Le document signé, conservé tel quel. C'est lui qui fait foi : la version en ligne n'est qu'une lecture commode." },
          { term: "Acte non publiable", def: "Un acte individuel (revalorisation d'un traitement, sanction, décision nominative…) dont la trame est déclarée **non publiable**. Il est rédigé, signé et conservé au registre, mais il n'est pas déposé au recueil et ne reçoit pas d'identifiant ELI : il est notifié à l'intéressé." },
          { term: "Export", def: "La fabrication d'un fichier à partir de l'acte (PDF, Word, HTML, formats techniques)." },
          { term: "PDF", def: "Le format du fichier à imprimer et à envoyer. C'est celui qu'on joint au message." },
          { term: "A4", def: "Le format de papier habituel des actes (21 × 29,7 cm). Tous les documents de l'application — aperçu, PDF, Word — sont présentés en A4 avec les mêmes marges, pour que l'écran, l'impression et la pièce jointe montrent exactement la même chose." },
          { term: "Mode sombre", def: "L'affichage de l'application sur fond sombre (bouton lune / soleil, en haut à droite ; ou « Automatique » dans le menu du compte, pour suivre le réglage du système). C'est une préférence de poste de travail : elle vaut pour vous seul, et elle ne change pas le document — le papier des actes reste blanc, comme à l'impression." },
          { term: "Word (.doc)", def: "Un fichier que Word (ou LibreOffice) ouvre pour retoucher le texte d'un acte, déjà mis en page en A4." },
          { term: "Akoma Ntoso, ELI, Schematron", def: "Des formats normalisés destinés à l'archivage, à la publication et aux logiciels. Vous les transmettez si on vous les demande, sans les ouvrir." },
          { term: "Auteur d'un commentaire", def: "Le **service** dont le compte a écrit le commentaire — pas la personne. Un service répond de ses modèles et de ses consignes au-delà des agents qui s'y succèdent." },
          { term: "Base de données", def: "L'endroit où sont rangés le référentiel, les trames, les actes et les comptes. En démonstration, c'est le stockage de votre navigateur (donc propre à ce poste) ; en exploitation, la base de la collectivité (MySQL ou MariaDB), partagée par tous les postes." },
          { term: "Mode partagé", def: "Quand l'application est branchée sur une base commune : tous les agents voient les mêmes trames et les mêmes actes. Le bandeau de l'application affiche alors « base partagée »." },
        ] },
        { t: "next", chapter: "depannage", label: "Que faire si… (dépannage)" },
      ],
    },
    // ------------------------------------------------------------------ 9
    {
      id: "depannage",
      title: "Que faire si… (dépannage)",
      short: "Les petits ennuis du quotidien et la solution, tout de suite.",
      icon: "check",
      minutes: 4,
      audience: "all",
      keywords: "problème erreur aide dépannage écran blanc fichier perdu bug",
      blocks: [
        { t: "p", text: "Presque tout se règle en trois gestes : attendre dix secondes, corriger la case signalée, ou recharger la page. Voici les cas les plus fréquents." },
        { t: "faq", items: [
          { q: "L'écran reste vide ou semble bloqué", a: "Attendez dix secondes, puis appuyez sur **F5** (ou le bouton ↻ en haut du navigateur). Vous ne perdez rien de ce qui était enregistré : au pire, il faut refaire la saisie en cours." },
          { q: "J'ai fermé l'onglet sans cliquer sur Enregistrer", a: "La saisie non enregistrée est perdue. C'est la raison pour laquelle il faut cliquer sur **Enregistrer** souvent, même au milieu du travail." },
          { q: "Les boutons d'export sont grisés", a: "Un contrôle bloquant est en échec : le cadre **Conformité** dit lequel. Corrigez la case indiquée ; les boutons se réactivent aussitôt." },
          { q: "Je ne trouve pas le fichier que je viens d'exporter", a: "Regardez en bas de la fenêtre du navigateur : une petite flèche ou une liste de téléchargements y apparaît. Sinon, ouvrez le dossier **Téléchargements** de votre poste de travail." },
          { q: "Rien ne s'ouvre quand je clique sur Imprimer / PDF", a: "Votre navigateur a peut-être bloqué la nouvelle fenêtre. Autorisez les fenêtres surgissantes (pop-up) pour ce site, puis réessayez. En dernier recours, utilisez « HTML complet » et imprimez depuis le navigateur." },
          { q: "Je me suis trompé dans un acte déjà enregistré", a: "Ouvrez-le depuis **Actes** → « Ouvrir », corrigez les cases, puis **Enregistrer** de nouveau. Si l'acte a déjà été signé ou publié, ne le modifiez pas : demandez à l'administrateur s'il faut un acte rectificatif." },
          { q: "Je ne trouve pas le modèle que je cherche", a: "Videz le champ de recherche et remettez les filtres sur « Toutes les familles » et « Tous les statuts ». Le modèle n'est peut-être pas encore publié : demandez-le à l'administrateur." },
          { q: "Je veux travailler depuis un autre ordinateur", a: "Tout dépend du mode de rangement. En **mode partagé** (base de la collectivité), vos trames et vos actes sont visibles depuis n'importe quel poste, avec le même compte. En **mode local** (démonstration), les données ne sont enregistrées que dans le navigateur de votre poste : pour les transférer, exportez — le PDF voyage par courriel, et les administrateurs peuvent exporter/importer l'ensemble depuis **Référentiel → Données**." },
          { q: "Le bandeau affiche « base hors ligne »", a: "L'application n'arrive pas à joindre la base partagée : elle continue de fonctionner avec les dernières données reçues sur ce poste. Vos modifications sont mises de côté et **renvoyées automatiquement** dès que la base répond de nouveau. Vérifiez votre connexion ; si cela dure, prévenez l'administrateur." },
          { q: "Un message d'erreur s'affiche en haut de l'écran", a: "Notez-le ou photographiez l'écran, puis prévenez l'administrateur. N'insistez pas : recharger et recommencer suffit le plus souvent." },
          { q: "Je ne comprends pas un mot", a: "Cherchez-le dans le **glossaire** (chapitre précédent), ou dans la barre de recherche de ce guide." },
        ] },
        { t: "contact" },
        { t: "next", chapter: "memo", label: "Fiche mémo à imprimer" },
      ],
    },
    // ------------------------------------------------------------------ 10
    {
      id: "memo",
      title: "Fiche mémo (à imprimer)",
      short: "Une page à afficher près de l'ordinateur : les gestes et les règles.",
      icon: "check",
      minutes: 1,
      audience: "all",
      keywords: "mémo résumé fiche imprimer aide-mémoire",
      blocks: [
        { t: "p", text: "Cette page tient sur une feuille. Vous pouvez l'imprimer seule avec le bouton ci-dessus, ou la recopier à la main." },
        { t: "stepscard", title: "Écrire un acte, du modèle à la signature", items: [
          "**Rédiger un acte** (menu de gauche)",
          "**Choisir le modèle** dans la liste",
          "**Choisir l'entité**, puis **Réserver un n°**",
          "**Cliquer les pastilles** (jaune = champ à compléter)",
          "**Relire le document** et l'onglet **Contrôle & écarts**",
          "**Enregistrer**, puis **Exporter… → Imprimer / PDF**",
          "**Enregistrer**, puis **faire valider** (Parapheur) et **faire signer** (Signature & publication)",
"Après la signature : **publication** et **formalités** (transmission, notification)",
        ] },
        { t: "stepscard", title: "Les quatre règles d'or", items: [
          "Je clique sur **Enregistrer** avant de fermer l'onglet.",
          "Je ne tape **jamais le numéro** à la main.",
          "Je **joins le PDF** au message, je ne recopie pas le texte.",
          "Si je doute, je lis le message **rouge** : il dit quoi corriger.",
          "Je peux réécrire le texte du modèle, mais ce sera **signalé** aux administrateurs.",
        ] },
        { t: "colors" },
        { t: "contact" },
      ],
    },
    // ------------------------------------------------------------------ 11
    {
      id: "comptes",
      title: "Qui peut faire quoi : les comptes et les rôles",
      short: "Trois profils d'accès : administrateur, éditeur, rédacteur. Le vôtre détermine les écrans et les boutons.",
      icon: "lock",
      minutes: 3,
      audience: "all",
      keywords: "compte rôle profil connexion session administrateur éditeur rédacteur permission accès identifiant se connecter changer de compte service bureau périmètre transverse rattachement",
      blocks: [
        { t: "p", text: "L'application demande d'abord **qui se connecte**. Ce n'est pas une formalité : c'est le compte choisi qui décide de ce que vous pouvez faire — **les écrans que vous voyez** et **les actes que vous pouvez toucher** — et qui signe (au nom de qui) les actes que vous rédigez." },
        { t: "p", text: "Trois profils existent, du plus large au plus étroit. Le profil dit **ce que l'on peut faire** ; le rattachement à un service dit **sur quoi** :" },
        { t: "table", head: ["Profil", "Ce qu'il permet", "Ce qu'il ne permet pas"], rows: [
          ["**Administrateur**", "Tout : référentiel (entités, personnes, références, services et bureaux), comptes et rôles, connexions aux API, sauvegarde et restauration des données. Il voit tout, quel que soit le service.", "—"],
          ["**Éditeur**", "Créer, modifier et commenter les **trames** de son périmètre ; rédiger des actes ; voir et modifier les actes des agents de son périmètre ; envoyer en signature et publier. Il touchera aussi aux **feuilles de style** des actes (à venir).", "Gérer le référentiel, les comptes et les API. Il ne sort pas du périmètre de son service (sauf compte **transverse**)."],
          ["**Rédacteur**", "**Choisir une trame** de son périmètre dans l'écran « Rédiger un acte » et **rédiger l'acte** ; puis les actions qui vont avec : enregistrer, exporter, envoyer en signature, publier.", "Voir le registre des trames (« Trames »), créer, modifier ou dupliquer les trames, gérer le référentiel. Il ne voit **que ses propres actes**, dans son périmètre."],
        ] },
        { t: "p", text: "**Services et bureaux.** Une collectivité se range en **services** (Ressources humaines, État civil, Cabinet…), eux-mêmes subdivisés en **bureaux** (par exemple « Assemblées et actes » et « Courrier et accueil » au sein du Secrétariat général). Chaque agent est rattaché à **un ou plusieurs services**, et chaque **trame** comme chaque **acte** est affecté à un service — et, si besoin, à un bureau précis. Votre périmètre découle de ce rattachement : c'est lui qui décide des trames que l'on vous propose et des actes que vous voyez." },
        { t: "list", items: [
          "Une **trame générale** (sans service) reste visible de tous : ce sont les modèles communs à la collectivité.",
          "Un compte **transverse** a été ajouté à **tous les services** par l'administrateur : il travaille sans frontière de service (c'est le cas, dans la démonstration, du directeur des affaires juridiques).",
          "Par défaut, rattacher un agent à un service lui ouvre **tous les bureaux** de ce service. L'administrateur peut ensuite **restreindre** l'accès à certains bureaux seulement, si l'organisation le demande.",
        ] },
        { t: "note", kind: "info", title: "Aucune trame ne vous est proposée ?", text: "Une trame n'apparaît que si elle relève de votre périmètre, ou si elle est **générale** (sans service). Si l'écran **Trames** (réservé aux éditeurs et aux administrateurs) ou la liste des modèles de **Rédiger un acte** est vide, c'est qu'aucun modèle n'est rattaché à votre service : demandez à un administrateur d'en rattacher un, ou de le rendre général." },
        { t: "note", kind: "info", title: "Où cela se règle", text: "Les **services et bureaux** se décrivent dans **Référentiel › Services**. Le **périmètre** de chaque agent (ses services, et éventuellement tel ou tel bureau) se coche dans **Comptes et rôles**, colonne « Périmètre », avec de grands boutons pour tout cocher ou tout retirer. Un compte marqué **« transverse »** couvre l'ensemble des services." },
        { t: "note", kind: "info", title: "Concrètement", text: "Le menu de gauche et les boutons s'adaptent : ce que votre profil n'autorise pas n'est pas affiché. Le registre, lui, ne liste **que ce qui est dans votre périmètre** ; si un collègue vous envoie un lien vers un écran ou un acte interdit, vous revenez simplement à votre écran de travail — rien ne se casse." },
        { t: "p", text: "**Changer de compte** : cliquez sur votre nom, en haut à droite, puis sur « Changer de compte ». Vous revenez à la liste des comptes." },
        { t: "p", text: "**Gérer les comptes** (administrateur uniquement) : menu de votre nom → « Comptes et rôles ». Vous pouvez y créer un compte, changer son rôle, **régler son périmètre** (les services et, au besoin, les bureaux qu'il couvre), le désactiver ou le supprimer — et y lire la liste exacte des permissions de chaque profil. Deux garde-fous : on ne supprime pas son propre compte, et il doit toujours rester un administrateur actif." },
        { t: "note", kind: "warn", title: "Vos actes restent les vôtres", text: "Un acte garde le nom de l'agent qui l'a rédigé : c'est ce nom qui s'affiche dans le registre et sur la fiche de l'acte. Se connecter avec le compte d'un collègue pour rédiger à sa place est donc **à éviter** — l'acte porterait son nom." },
        { t: "note", kind: "info", title: "Dans cette démonstration", text: "Les neuf comptes livrés sont **fictifs** et l'authentification est **simulée** : on choisit un compte, sans mot de passe. C'est le mode « comptes de l'application ». L'application sait aussi se **brancher sur l'annuaire de la collectivité** (annuaire d'entreprise, OpenID Connect) : le rôle vient alors des groupes de l'agent, et **les comptes de démonstration sont désactivés automatiquement** — voir le chapitre suivant pour les administrateurs." },
        { t: "next", chapter: "demarrer", label: "Revenir au début du guide" },
      ],
    },
    // ------------------------------------------------------------------ 15
    {
      id: "annuaire",
      title: "Brancher l'annuaire de la collectivité",
      short: "Pour les administrateurs : la connexion par l'annuaire d'entreprise (OpenID Connect), et la désactivation automatique des comptes de démonstration.",
      icon: "lock",
      minutes: 5,
      audience: "admin",
      keywords: "annuaire sso oidc openid connect authentification connexion groupes rôle désactiver comptes démonstration fournisseur identité pkce jeton annuaire d'essai clé signature",
      blocks: [
        { t: "p", text: "Par défaut, l'application ouvre les sessions avec **ses propres comptes** : on choisit un compte dans la liste, sans mot de passe. C'est très pratique pour essayer, mais ce n'est pas de la sécurité — c'est un mode de démonstration." },
        { t: "p", text: "Pour de vrai, on **branche l'annuaire** : l'agent se connecte chez le fournisseur d'identité de la collectivité (OpenID Connect), et l'application ouvre la session avec le **rôle** et le **périmètre** que lui donnent ses groupes. Dès que l'annuaire est branché, **les comptes de démonstration sont désactivés automatiquement** : ils ne sont plus proposés, aucune session ne peut s'ouvrir sans passer par l'annuaire, et ils apparaissent « Désactivé (annuaire) » dans *Comptes et rôles*." },
        { t: "note", kind: "warn", title: "C'est un réglage du référentiel", text: "Il est enregistré avec le reste du référentiel : il **suit l'export** des données, et se règle dans **Référentiel › Annuaire (OIDC)**. L'application ne détient aucun secret (elle se déclare en **client public**, avec PKCE) : c'est ce qui rend ce branchement possible sans intervention sur les serveurs." },
        { t: "steps", items: [
          { text: "Ouvrez **Référentiel › Annuaire (OIDC)**, encart « Mode de connexion », et choisissez **Annuaire de la collectivité (OIDC)**.", detail: "Un bandeau vous dit combien de comptes de démonstration viennent d'être désactivés. Si vous étiez connecté avec l'un d'eux, la session se ferme : c'est normal." },
          { text: "Renseignez le **fournisseur** : adresse de l'émetteur, identifiant du client, et l'**adresse de retour** que vous déclarez chez le fournisseur (bouton « Copier l'adresse à déclarer »).", detail: "Le bouton « Vérifier la découverte du fournisseur » lit la configuration publiée et affiche les points de terminaison trouvés. Si le fournisseur ne se laisse pas interroger depuis le navigateur, recopiez-les à la main dans la section repliable." },
          { text: "Réglez la **correspondance des groupes** : quel groupe de l'annuaire donne quel rôle ici.", detail: "Par défaut : `scribae-administrateurs` → Administrateur, `scribae-editeurs` → Éditeur, `scribae-redacteurs` → Rédacteur. Un agent dont aucun groupe n'est reconnu est **refusé** (le réglage sûr) — vous pouvez préférer lui donner un rôle de repli." },
          { text: "**Essayez d'abord sans fournisseur** : tant qu'aucune adresse d'émetteur n'est saisie, l'**annuaire d'essai** prend le relais.", detail: "Il propose des identités fictives avec leurs groupes : vous voyez immédiatement quel rôle chacune recevrait, sans aucun réglage réseau. C'est aussi lui qui vous évite de rester bloqué à l'écran de connexion." },
          { text: "Connectez-vous **pour de vrai**, une fois : l'application affiche ce qu'elle a **vérifié** (émetteur, audience, validité, nonce, signature) et quel rôle elle en a tiré.", detail: "Si un contrôle échoue, le message dit lequel : le plus souvent une horloge décalée, une adresse de retour différente, ou une signature non vérifiable parce que les clés du fournisseur ne sont pas joignables." },
          { text: "Quand tout est éprouvé, **retirez la porte de secours** (encart « Porte de secours »).", detail: "Elle permet sinon, depuis l'écran de connexion, de revenir aux comptes de l'application — utile pendant la mise en service, à retirer ensuite." },
        ] },
        { t: "note", kind: "info", title: "Les agents déjà connus ne perdent rien", text: "Un agent dont l'adresse (ou l'identifiant d'annuaire) correspond à un compte existant **reprend ce compte** : ses actes, ses trames et ses commentaires restent les siens. Les autres sont **créés** à leur première connexion — ou refusés, si vous avez décoché la création automatique. Pour attribuer un rôle ou un périmètre **avant** la première connexion, utilisez *Pré-enregistrer un agent* dans « Comptes et rôles », avec son adresse exacte." },
        { t: "note", kind: "warn", title: "Revenir en arrière", text: "Repasser en mode « Comptes de l'application » **réactive** les comptes de démonstration désactivés par l'annuaire (ceux que vous aviez désactivés à la main le restent). Depuis l'écran de connexion, la **porte de secours** fait la même chose en un clic, si l'annuaire ne répond plus." },
        { t: "note", kind: "info", title: "Où est la vraie barrière ?", text: "Tout cela est un contrôle *d'interface* : le code de l'application est public. La barrière réelle reste le **service de données** — son jeton d'accès et le réseau sur lequel il écoute. L'annuaire dit **qui** est l'agent ; il ne remplace pas la protection du serveur." },
        { t: "next", chapter: "comptes", label: "Qui peut faire quoi : comptes et rôles" },
      ],
    },
  ],
};

export const findChapter = (id) => GUIDE.chapters.find((c) => c.id === id) || null;
export const chapterIndex = (id) => GUIDE.chapters.findIndex((c) => c.id === id);

// Recherche très tolérante : on cherche les mots saisis (au moins 2 lettres)
// dans le titre, les mots-clés et le texte de chaque chapitre.
export function searchGuide(query) {
  const q = String(query || "").trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  return GUIDE.chapters
    .map((c) => {
      const hay = [c.title, c.short, c.keywords, ...plainText(c)].join(" ").toLowerCase();
      const score = words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
      return { chapter: c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.chapter);
}

function plainText(chapter) {
  const out = [];
  const walk = (blocks) => {
    for (const b of blocks || []) {
      if (b.text) out.push(b.text);
      if (b.title) out.push(b.title);
      if (b.caption) out.push(b.caption);
      for (const it of b.items || []) out.push(typeof it === "string" ? it : [it.text, it.detail, it.term, it.def, it.q, it.a, it.label].filter(Boolean).join(" "));
      for (const row of b.rows || []) out.push(row.join(" "));
      if (b.t === "contact") out.push("aide contact téléphone courriel support");
    }
  };
  walk(chapter.blocks);
  return out;
}
