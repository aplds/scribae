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
    url: "https://user.uploads.dev/file/3873dd6c553f5ae3c76cc880d7663b54.png",
    caption: "L'écran de rédaction : le document est votre feuille de travail, et le panneau de droite suit le bloc que vous désignez.",
    marks: [
      { n: 1, x: 8, y: 14.8, w: 15, h: 2.6, label: "Le menu : tout part d'ici" },
      { n: 2, x: 37.3, y: 14.1, w: 19.4, h: 2.4, label: "L'entité concernée : la structure au nom de laquelle l'acte est pris" },
      { n: 3, x: 90.3, y: 14.1, w: 9.2, h: 2.4, label: "« Enregistrer » quand l'acte est prêt — « Exporter… », à gauche, choisit le format" },
      { n: 4, x: 44.3, y: 58.3, w: 53.6, h: 66.9, label: "Le document : on écrit dedans et on clique les pastilles" },
      { n: 5, x: 44, y: 72.9, w: 42.9, h: 1.6, label: "Un passage réécrit : fond orangé, mention « hors trame »" },
      { n: 6, x: 60.3, y: 47, w: 9.7, h: 1.8, label: "La barre d'outils d'un bloc : déplacer, ajouter, retirer, voir ses options" },
      { n: 7, x: 85.4, y: 25.9, w: 26.4, h: 14.7, label: "La bibliothèque de variables : glissez-en une dans le texte" },
      { n: 8, x: 85.4, y: 55.9, w: 26.4, h: 44.2, label: "Le panneau du bloc désigné : ses réglages, ses éléments, ses ajouts" },
    ],
  },
  conformite: {
    url: "https://user.uploads.dev/file/24a7ce5a8ad2d4b3fadd6f7b4467325a.png",
    caption: "Le panneau « Contrôle & écarts » : ce que vous avez ajouté ou retiré, ce que la trame exige, et ce que vous avez réécrit.",
    marks: [
      { n: 1, x: 85.4, y: 36, w: 26.4, h: 4.2, label: "Les onglets du panneau : compléter, consignes, abrogations, contrôle & écarts" },
      { n: 2, x: 85.4, y: 46.8, w: 24, h: 14.3, label: "Structure du document : ce que vous avez ajouté ou retiré, et de quoi le rétablir" },
      { n: 3, x: 85.4, y: 55.9, w: 24, h: 1.6, label: "Contrôles de la trame : ce que le modèle exige" },
      { n: 4, x: 85.4, y: 64.2, w: 24, h: 12.8, label: "Écarts à la trame : ce que vous avez réécrit, et le retour au modèle d'un clic" },
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
    caption: "La consultation d'un acte publié dans l'application : son texte rendu dans la page, et ses métadonnées.",
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
    { label: "Je m'en sers déjà", hint: "Les raccourcis utiles", chapters: ["rediger", "export", "retrouver", "chrono", "corbeille", "modifier", "annexes", "depannage"] },
    { label: "Je valide des actes", hint: "Le parapheur, la révision, et ce qui suit", chapters: ["parapheur", "revision", "delegations", "signature", "signature-externe", "execution", "mots"] },
    { label: "Je publie un acte", hint: "Signature (électronique ou papier), ELI, opposabilité, délais", chapters: ["parapheur", "signature", "signature-externe", "publication", "informations", "execution", "modifier", "annexes", "abrogations"] },
    { label: "J'informe le public", hint: "Les billets du recueil public : actualités, avis, communications", chapters: ["publication", "informations", "administrateurs"] },
    { label: "Je prépare les modèles", hint: "Pour les administrateurs", chapters: ["administrateurs", "organigramme", "delegations", "chrono", "chartes", "annexes", "modifier", "mots", "depannage"] },
    { label: "Je gère les comptes", hint: "Qui peut faire quoi, et comment ouvrir un compte", chapters: ["comptes", "organigramme", "delegations", "annuaire", "administrateurs", "depannage"] },
    { label: "Je branche un autre logiciel", hint: "L'API, les clés et les rôles", chapters: ["api", "comptes", "administrateurs"] },
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
        { t: "note", kind: "warn", title: "Le bandeau « Démonstration » en haut de l'écran", text: "S'il est affiché, cette installation **joue un jeu de démonstration** : les données sont fictives et la signature électronique est simulée. Il apparaît dans l'atelier, sur l'écran de connexion **et sur le recueil public**, pour que personne ne s'y trompe. Le bandeau, comme le jeu fictif lui-même, dépend du **déploiement** : c'est le service (réglage `DEMO` du `.env`) qui l'allume ou l'éteint — une installation partie d'un **référentiel vierge** ne le montre pas." },
        { t: "p", text: "Ce que l'application fait, et ce qu'elle ne fait pas. Elle **rédige**, **numérote** et **range** l'acte ; elle peut aussi le **faire signer** (signature électronique simple, dans l'application) et **notifier** les parties par courriel — quand un service de courriel est branché sur le déploiement. Elle ne se substitue pas à l'autorité signataire pour autant : seule une personne **compétente** — le signataire désigné par l'acte, ou un délégataire en vigueur dans sa chaîne de signature — peut apposer la signature, et le nom signé est celui que porte l'acte, jamais celui du premier venu. Sur l'**installation de démonstration**, la signature est simulée et n'est pas opposable." },
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
      keywords: "ouvrir adresse favori menu navigation écran trames sombre apparence thème clair délégation délégations organigramme signer signature subdélégation",
      blocks: [
        { t: "p", text: "Ouvrez votre navigateur (Chrome, Edge, Firefox ou Safari) et tapez l'adresse que l'administrateur vous a communiquée. Elle ressemble à `https://mon-organisme.github.io/scribae/`." },
        { t: "note", kind: "info", title: "À faire une fois pour toutes", text: "Pendant que la page est affichée, cliquez sur l'**étoile** à droite de la barre d'adresse (ou faites Ctrl+D). L'adresse est enregistrée dans vos favoris : vous n'aurez plus jamais à la retaper." },
        { t: "note", kind: "info", title: "Deux portes à la même adresse", text: "La même adresse sert l'**espace public** — le recueil des actes publiés, que tout le monde consulte **sans compte** — et l'**atelier**. C'est l'**espace public** qui s'ouvre **par défaut** : ouvrir l'adresse du logiciel (sans ancre ni paramètre) mène au recueil des actes publiés, et non à l'atelier — c'est la page que l'on peut communiquer. Depuis le recueil, le bouton **Se connecter** (dans son en-tête) ouvre la connexion : vos **comptes de l'application**, ou l'**annuaire** de la collectivité, selon le réglage. Une fois connecté, la même place propose **Retour à l'application**." },
        { t: "shot", shot: "trames" },
        { t: "p", text: "Le menu de gauche sert à tout. Il est rangé en **six rubriques**, dans l'ordre de la vie de l'acte : **Produire** (écrire un acte), **Valider** (le circuit d'avant-signature), **Publier** (signer, publier au recueil, suivre les délais), **Organisation** (qui compose la collectivité, qui signe à la place de qui, les numéros), **Configurer** (les réglages d'administration) et **Aide**. Selon votre profil, il contient les boutons suivants :" },
        { t: "terms", items: [
          { term: "Trames", def: "La liste des modèles d'actes, leur création et leur mise à jour. Réservé aux **éditeurs** et aux **administrateurs** : un rédacteur choisit son modèle directement dans « Rédiger un acte »." },
          { term: "Rédiger un acte", def: "Le document à compléter directement. C'est votre écran de travail." },
          { term: "Modifier un acte", def: "Pour corriger un acte déjà signé : on réécrit directement l'acte, et l'application produit un acte modificatif et la version consolidée." },
          { term: "Actes", def: "Le registre : tous les actes que vous avez enregistrés, avec leur numéro." },
          { term: "Corbeille", def: "Ce qui a été **retiré du registre** : les actes et les trames supprimés y restent tant qu'ils ne sont pas supprimés définitivement, et peuvent être **rétablis** à tout moment. Supprimer pour de bon est réservé à qui peut gérer les actes ou les trames." },
          { term: "Signature & publication", def: "L'écran de la signature électronique et de la publication au recueil. Un **signataire** y arrive sur son propre onglet, **« Ma signature »**, d'où il signe les actes qui l'attendent ; les autres profils y suivent le **circuit** et la **publication (ELI)**." },
          { term: "Organigramme", def: "La **structure de la collectivité** : chaque entité, ses services et leurs bureaux. Visible par **tout le monde** ; seuls les administrateurs et les éditeurs peuvent le modifier." },
          { term: "Délégations", def: "L'**organigramme des délégations de signature** : qui peut signer à la place de qui, sous quelle qualité. Cliquez un acteur pour ouvrir sa fiche (pouvoir reçu, étendue, décision, dates, et la signature que cela produira). Visible par **tout le monde** ; seuls les administrateurs et les éditeurs peuvent le modifier." },
          { term: "Chrono de numérotation", def: "Tous les numéros que la collectivité a attribués, dans l'ordre — avec les **rangs jamais attribués** (les trous) et les **numéros annulés**, pour que rien ne s'explique tout seul." },
          { term: "Administration", def: "Les données de la collectivité (entités, personnes, textes de référence). Réservé aux administrateurs : vous n'avez rien à y modifier." },
          { term: "Guide", def: "Ce document, avec une barre de recherche." },
        ] },
        { t: "note", kind: "info", title: "Travailler en clair ou en sombre", text: "Le bouton **lune / soleil** en haut à droite bascule l'application en **mode sombre** — plus confortable le soir ou sur un écran peu lumineux. Le menu de votre compte (à côté) propose aussi « **Automatique** » : l'application suit alors le réglage clair / sombre de votre système. C'est un réglage de **votre** poste de travail : il ne change rien pour vos collègues, et le document — le papier des actes — reste blanc, comme à l'impression. L'administrateur peut prévoir, pour le fond sombre, un **second emblème** (Administration › Identité) : un logo dessiné pour le blanc se lit mal sur un fond sombre, et l'application prend alors la variante ; le papier, lui, garde toujours l'emblème ordinaire." },
        { t: "note", kind: "info", title: "Plume, le petit assistant", text: "En bas à droite, une **pastille** avec un personnage : c'est **Plume**, l'assistant de l'atelier. Cliquez-la et posez votre question en français — « comment j'exporte un acte ? », « que veut dire ce message ? ». Plume connaît le **mode d'emploi** de l'outil (ce guide), et **rien d'autre** : il ne voit ni vos actes, ni vos brouillons, ni vos collègues. Quand un chapitre répond à votre question, il vous en donne le **lien** : cliquez, vous y êtes. Il propose aussi une question de temps en temps dans une petite bulle. L'administrateur peut **l'éteindre** (il n'apparaît alors pas) ou lui donner un autre **nom et une autre icône** (Administration › Assistants) ; et vous, vous pouvez le **masquer pour votre seul compte** dans le menu de votre nom, sous « Assistants » — un confort de poste, comme le thème clair ou sombre." },
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
      keywords: "tableau lignes colonnes mise en forme alignement encadré formule rédiger écrire document pastille champ compléter numéro entité enregistrer export aperçu word traitement de texte hors trame déplacer réorganiser glisser flèches article ordre renuméroter division livre titre chapitre section partie annexe consigne commentaire supprimer retirer ajouter paragraphe visa considérant insérer variable bibliothèque glisser-déposer bloc options échelon intitulé",
      blocks: [
        { t: "p", text: "C'est le chapitre à lire en premier. Ici, pas de formulaire à part : **le document est votre feuille de travail**. Vous le complétez et vous le corrigez directement, comme dans un traitement de texte." },
        { t: "shot", shot: "rediger" },
        { t: "p", text: "Deux repères suffisent pour s'y retrouver :" },
        { t: "terms", items: [
          { term: "La pastille (bleue, jaune ou pointillée)", def: "C'est un champ prévu par le modèle. Cliquez dessus : une petite fenêtre s'ouvre, vous saisissez, vous cliquez sur « Terminer ». Le texte se met à jour tout seul." },
          { term: "Le texte normal", def: "Cliquez dedans et écrivez : vous pouvez corriger, compléter, effacer, exactement comme dans Word." },
        ] },
        { t: "steps", items: [
          { text: "Dans le menu de gauche, cliquez sur **Rédiger un acte**.", detail: "L'écran de choix s'ouvre : il liste les modèles **mis à disposition** pour votre service, et les actes que vous avez laissés commencés. Un modèle encore en préparation par les administrateurs n'y figure pas : tant qu'une trame n'est pas mise à disposition, personne ne rédige à partir d'elle." },
          { text: "Choisissez ce que vous rédigez.", detail: "Cliquez sur **Rédiger** sur la carte du modèle voulu. Si vous aviez déjà commencé un acte, il figure en haut : cliquez sur **Reprendre** (ou sur « Continuer » pour la rédaction en cours). Un champ de recherche filtre les modèles par nom." },
          { text: "En cours de rédaction, le bouton **Changer d'acte** (en haut) ramène à cet écran : rien n'est perdu, votre brouillon vous attend.", detail: "Les éditeurs et les administrateurs peuvent aussi lancer une rédaction depuis la liste des modèles (« Trames »), bouton « Rédiger » de la carte voulue." },
          { text: "Choisissez l'**Entité** concernée, en haut de la page.", detail: "C'est la structure au nom de laquelle l'acte est pris. Le nom de l'autorité qui signe en découle automatiquement." },
          { text: "Renseignez le **numéro** : cliquez la pastille « Numéro de l'acte », ou utilisez le bouton du panneau de droite.", detail: "Ne le tapez jamais à la main : c'est lui qui garantit qu'aucun acte ne portera deux fois le même numéro. Le bouton dit **« Réserver le prochain numéro »** quand l'application tient la séquence ; il dit **« Demander le numéro »** quand la collectivité numérote dans un autre logiciel (Administration › Numérotation) — l'application interroge alors ce service, et le numéro attribué s'inscrit tout seul. Dans ce second cas, ne redemandez pas un numéro sans raison : la ligne créée chez le service reste consommée, même si l'acte n'est pas enregistré." },
          { text: "Cliquez sur chaque **pastille** pour la renseigner, de haut en bas.", detail: "Les pastilles jaunes sont celles qui restent à compléter. Vous pouvez aussi passer par la liste « À compléter » du panneau de droite : les deux sont liés." },
          { text: "Écrivez dans le document tout ce qui doit être adapté.", detail: "Ajouter une phrase, préciser une condition, corriger une formule : c'est permis. Relisez comme vous reliriez une lettre avant de l'envoyer." },
          { text: "Déplacez ce qui n'est pas à sa place.", detail: "Chaque morceau du document s'attrape : sa **poignée ⠿**, ou son **numéro** (« Article 2 » — c'est ce qu'on vise en pensant « cet article-là »). Glissez-le au-dessus ou au-dessous d'un autre morceau, ou servez-vous des deux **flèches** posées sur le bloc. Un article remonté **change de numéro** : c'est l'ordre imprimé qui compte. Le modèle, lui, n'est pas touché, et le panneau « Contrôle & écarts » propose de tout remettre dans l'ordre d'origine." },
          { text: "Cliquez un morceau du document pour voir **tout ce qui le concerne**.", detail: "L'onglet **« Bloc »** s'ouvre dans le panneau de droite : ce que le morceau est (un article, une division, un paragraphe, des visas…), son **intitulé**, son **numéro** (automatique, ou écrit à la main), son **échelon** s'il s'agit d'une division (Titre, Chapitre…), ses **éléments** (les visas, les considérants, les lignes de liste : vous les y écrivez, les montez ou les descendez, les supprimez), et les boutons **Monter**, **Descendre** et **Retirer du document**." },
          { text: "Retirez ce qui est sans objet — **d'un seul clic**.", detail: "La petite **corbeille** est posée sur chaque morceau (elle apparaît quand vous passez la souris dessus). Un paragraphe de trop, un visa qui ne s'applique pas : cliquez, il disparaît du document. Il n'est **pas** retiré du modèle : l'onglet **« Contrôle & écarts »**, rubrique « Structure du document », le liste et le **rétablit** d'un clic si vous vous êtes trompé." },
          { text: "Ajoutez ce qui manque : un paragraphe, un visa, un considérant.", detail: "Au bout de chaque liste, un bouton **« Ajouter un visa »**, **« Ajouter un considérant »**, **« Ajouter un élément »** ; entre deux éléments, un petit **+** insère le suivant ; et sur chaque morceau, le **+** de sa barre d'outils propose ce que cet endroit peut accueillir (un paragraphe dans un article, une division dans le corps…). Ce que vous ajoutez appartient au **document**, non au modèle — les administrateurs le verront signalé comme un ajout, et vous pouvez le retirer à tout moment." },
          { text: "Insérez une **variable** dans le texte.", detail: "La **bibliothèque de variables** est en haut du panneau de droite : les champs du modèle et les informations que l'application connaît déjà (la collectivité, le signataire, la date, le numéro…). **Glissez** la variable dans la phrase, à l'endroit voulu ; ou **cliquez-la**, puis cliquez dans le texte. Le champ de recherche la retrouve par son nom." },
          { text: "Ouvrez l'onglet **Contrôle & écarts** du panneau de droite.", detail: "Vert : tout est bon. Rouge : il manque quelque chose, le message dit quoi. Vous y retrouvez, séparément, les passages que vous avez **réécrits**, les **réglages de bloc** que vous avez changés (un échelon, une numérotation) et ce que vous avez **ajouté ou retiré** — chacun pouvant être remis à l'état du modèle d'un clic." },
          { text: "Cliquez sur **Enregistrer**.", detail: "L'acte entre au registre avec son numéro. Il sera toujours retrouvable, même si vous fermez le navigateur." },
          { text: "Cliquez sur **Exporter…** et choisissez le format.", detail: "Dans presque tous les cas : « Imprimer / PDF ». Voir le chapitre « Enregistrer, imprimer, envoyer »." },
        ] },
        { t: "note", kind: "info", title: "Les trois couleurs des pastilles", text: "Une pastille **bleue** est un champ déjà renseigné. Une pastille **jaune** est un champ encore vide. Une valeur **soulignée d'un pointillé** vient du référentiel (l'entité, le signataire) : elle n'est pas saisie ici." },
        { t: "note", kind: "info", title: "Un texte long se range en parties", text: "Certains actes ne se composent pas seulement d'articles : ils sont rangés en **Livres, Titres, Chapitres, Sections** (ou sous le mot que la collectivité a choisi — « Partie », « Chapitre liminaire »…). Ces divisions viennent du **modèle**, et la numérotation « Livre Ier », « Titre Ier », « Titre II »… se pose toute seule, en suivant l'ordre du texte. Vous les déplacez comme le reste, et vous réécrivez leur intitulé d'un clic." },
        { t: "note", kind: "info", title: "Régler la présentation d'un bloc, et remplir un tableau", text: "Cliquez un **paragraphe**, une **liste**, un **tableau** ou des **considérants** : le panneau de droite propose, sous **« Mise en forme »**, de quoi les ajuster — aligner un paragraphe ou l'encadrer, changer la numérotation d'une liste, placer la légende d'un tableau au-dessus ou au-dessous, régler la ponctuation des considérants. Rien n'est bloqué, mais ce sont des **écarts au modèle** : les administrateurs les voient dans « Contrôle & écarts », et le bouton « Revenir à la trame » les annule. Un **tableau** se remplit d'ailleurs directement dans le document : cliquez une case et écrivez — la gouttière posée à droite de chaque ligne ajoute ou retire une ligne, celle de la ligne d'en-tête une colonne." },
        { t: "note", kind: "info", title: "Quand le document est une annexe", text: "Un **règlement intérieur** adopté par une délibération, une **grille tarifaire** adoptée par une décision : l'annexe ne tient pas son autorité d'elle-même, **elle n'a pas de numéro propre** (elle s'identifie par la décision qui l'adopte) et **elle ne se signe pas**. Si le modèle est de nature **Annexe**, le panneau de droite vous demande **l'acte qui l'adopte** — et ne vous propose ni numéro ni signataire ; le visa « Vu la délibération n°… du …, qui l'adopte » se pose alors en tête des visas, et si l'acte d'adoption a déjà été écrit ici, vous pouvez aussi **lui rattacher** l'annexe (bouton « Joindre une annexe ») : son texte suivra cet acte dans l'original signé. Et si le modèle est en outre déclaré **Règlement**, l'annexe sera **aussi publiée à part au recueil, à titre informatif** — un texte normatif se consulte pour lui-même, comme un code. Voir le chapitre « Adopter une annexe »." },
        { t: "note", kind: "info", title: "Quand l'acte émane d'une assemblée — une délibération", text: "Une **délibération** n'émane pas d'une personne, mais d'une **assemblée** : le **conseil municipal**, ou le **conseil d'administration** d'un établissement. Sa ligne d'autorité se lit alors « **Le conseil municipal de …** », « Le conseil d'administration de … », et l'acte est **signé par le président de l'assemblée** — le maire, pour un conseil municipal ; le président du conseil d'administration, pour un établissement. Vous n'avez rien à régler : le modèle (déclaré « acte d'assemblée » par l'administrateur) appelle l'assemblée de l'entité choisie. Le contrôle de conformité, lui, signale un signataire qui ne tient pas la qualité appelée par l'assemblée. Les assemblées et la qualité qui les signe se règlent dans **Administration › Assemblées**." },
        { t: "note", kind: "info", title: "Les consignes laissées dans le modèle", text: "Les administrateurs peuvent avoir posé des **commentaires** dans le modèle : « vérifier l'avis du service instructeur », « point à arbitrer »… Vous ne pouvez pas les manquer : ils s'affichent **dans le document**, sous le passage qu'ils visent, dans un encadré violet distinct du texte de l'acte. L'en-tête annonce leur nombre (« N consignes de la trame ») et ouvre la liste d'un clic ; l'onglet **« Consignes »** du panneau de droite les rassemble, avec le lien qui mène au passage. Ces consignes servent à rédiger : elles ne sont pas publiées avec l'acte." },
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
        { t: "note", kind: "info", title: "Exporter n'est pas la fin du parcours", text: "L'export sert à **imprimer** un acte ou à le **transmettre hors de l'application**. Pour le faire **avancer**, ce n'est pas là qu'il faut cliquer : dans l'atelier, un **parcours** rappelle les étapes — Rédiger → **Soumettre au circuit** → Révision → Signer → Publier —, et le **bouton principal** placé sous le document propose le geste du moment (« Soumettre au circuit », ou « Aller à la signature »). L'export reste là, discret : il ne fait pas signer l'acte." },
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
        { t: "p", text: "**Faut-il un PDF pour archiver ?** Il existe un format fait pour la **conservation de longue durée**, le **PDF/A** : le fichier porte tout ce qu'il faut pour se relire dans vingt ans — ses **polices**, ses **couleurs**, sa **langue**, ses **métadonnées**. C'est la forme que demandent les **services d'archives**." },
        { t: "note", kind: "info", title: "PDF, ou PDF/A ?", text: "Pour **signer et envoyer** l'acte : « **Imprimer / PDF** ». Pour **archiver** l'acte, ou le remettre à un service d'archives : « **PDF/A** », bouton placé juste en dessous dans la même fenêtre. Le PDF/A, lui, se télécharge **directement** : pas d'onglet à ouvrir, pas d'imprimante à choisir, pas de réglage A4 à vérifier." },
        { t: "p", text: "Les autres formats proposés servent plus rarement :" },
        { t: "terms", items: [
          { term: "Imprimer / PDF", def: "Le document final, **au format A4**, à signer ou à envoyer. C'est celui-là qu'on utilise presque toujours." },
          { term: "PDF/A", def: "La forme d'**archivage** : un PDF qui porte ses polices, ses couleurs, sa langue et ses métadonnées, fait pour être conservé longtemps. Deux versions sont proposées : **PDF/A-2b** (la plus courante) et **PDF/A-1b** (pour les systèmes qui n'acceptent que l'ancienne norme). Le fichier se télécharge d'un clic, sans passer par l'imprimante." },
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
      keywords: "parapheur validation valider circuit vérification vérifier visa bon pour accord signature réviseur signataire renvoyer refuser chef de service direction reprise",
      blocks: [
        { t: "note", kind: "info", title: "Toujours disponible, et sans circuit il ne fait rien", text: "Le parapheur est une pièce ordinaire de l'application : l'écran est toujours là. Ce sont les **circuits enregistrés dans le référentiel** qui décident — un référentiel sans circuit n'a aucun parapheur, et les actes partent directement en signature. Les circuits se règlent dans **Administration › Circuits de validation**." },
        { t: "p", text: "Un acte ne part pas en signature dès qu'il est écrit. Selon l'acte, il doit d'abord franchir un **circuit** : on **vérifie** que le dossier est complet et l'acte conforme, on **vise** (on donne son bon pour accord), et l'on **signe**. C'est ce chemin qu'on appelle le **parapheur**." },
        { t: "p", text: "En principe, un circuit s'ouvre par la **vérification du réviseur** — c'est le contrôle d'avant la signature — et se referme sur la signature. Tout se passe dans l'écran **Parapheur**, dans le menu de gauche : le chemin à suivre dépend de l'acte, c'est le référentiel qui le définit, pas vous." },
        { t: "terms", items: [
          { term: "Circuit", def: "La suite d'étapes que l'acte doit franchir (par exemple : vérification du réviseur, puis visa de la direction générale)." },
          { term: "Vérification", def: "Une étape de contrôle : on vérifie que le dossier est complet et l'acte conforme, sans se prononcer sur le fond. C'est en principe l'étape du réviseur." },
          { term: "Visa", def: "Une étape d'accord : elle engage son porteur, et la suite en dépend." },
          { term: "Signature", def: "La dernière étape : le signataire marque son accord pour signer ; le circuit est alors achevé, et l'acte passe à la signature." },
          { term: "Facultative", def: "Une étape qui peut être passée : elle est conservée au dossier, mais elle n'empêche pas la signature." },
          { term: "Caduque", def: "La validation n'est plus valable, parce que le texte de l'acte a été modifié depuis." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Parapheur** : l'onglet **À valider par moi** montre ce qui attend votre décision." },
          { text: "Cliquez sur l'acte dans la liste de gauche pour lire son circuit et l'étape ouverte." },
          { text: "Écrivez votre **observation** (elle est obligatoire pour un renvoi ou un refus), puis cliquez sur le geste de l'étape — **Vérifier**, **Donner mon visa**, **Marquer prêt à signer** — ou sur **Renvoyer en rédaction** / **Refuser**." },
          { text: "Quand toutes les étapes obligatoires sont franchies, l'acte est **validé** : il peut partir en signature." },
        ] },
        { t: "note", kind: "warn", title: "Si l'acte est modifié après validation", text: "Le parapheur garde le souvenir du **texte exact** qui a été approuvé. Si quelqu'un réécrit l'acte ensuite, la validation devient **caduque** : l'écran le signale et propose de **reprendre le circuit** depuis la première étape. C'est ce qui garantit qu'on ne signe jamais autre chose que ce qui a été approuvé." },
        { t: "note", kind: "info", title: "Où en est mon acte ?", text: "Pendant la rédaction, l'en-tête de l'écran indique l'état du circuit — et propose « **Soumettre au circuit** » quand l'acte vient d'être enregistré. La fiche de l'acte (depuis le registre) montre la même chose : le circuit, qui a décidé quoi, quand, et les observations." },
        { t: "note", kind: "info", title: "Le fil de parcours — chaque porte à sa place", text: "Sur l'écran de **rédaction**, le **circuit de signature**, le **parapheur**, la **révision** et la **fiche d'un acte**, une ligne de puces montre tout le chemin : *Rédaction → Parapheur → Révision → Signature → Publication*, la porte en cours mise en avant, et **qui** tient chacune. Sous le parapheur, ses **étapes vues de l'intérieur** disent leur nature (vérification, visa, signature) et leur porteur. L'ordre n'est pas celui qu'on devine : le **parapheur passe d'abord**, la **révision ensuite**, la **signature** après — et, dans le circuit **externe**, la révision prend la forme d'une **certification de conformité**, après la signature. Une porte que l'acte a **passée sans la franchir** — un acte déjà signé et publié, dont le dossier ne porte aucune trace de révision — est marquée « **non franchie** » (puce creuse) : elle n'attend rien, l'acte est allé plus loin." },
        { t: "note", kind: "info", title: "Un acte sans circuit", text: "Certains actes ne passent par aucun parapheur (aucun circuit ne s'applique, ou la trame demande explicitement « aucune validation »). Ils partent alors directement en signature — c'est normal." },
        { t: "next", chapter: "revision", label: "Contrôler l'acte avant l'envoi (la révision)" },
      ],
    },
    // -------------------------------- 5 bis : la révision (contrôle avant envoi)
    {
      id: "revision",
      title: "Faire réviser un acte avant sa signature",
      short: "Le contrôle qui s'intercale entre la décision d'envoyer et l'envoi effectif.",
      icon: "eye",
      minutes: 4,
      audience: "all",
      keywords: "révision réviseur relire contrôler conformité rapport corriger valider rejeter rejet motif brouillon compétence service",
      blocks: [
        { t: "p", text: "Certaines collectivités confient à un **réviseur** le soin de relire un acte **entre le moment où son rédacteur décide de l'envoyer en signature et le moment où il part réellement**. Le réviseur lit l'acte, en reçoit un **rapport de conformité**, le corrige s'il le faut, puis le **valide** — l'acte part alors en signature — ou le **rejette**, et l'acte revient en brouillon chez son rédacteur avec le motif du rejet." },
        { t: "note", kind: "info", title: "Après le parapheur, avant la signature", text: "L'ordre réel est **parapheur → révision → signature** : la révision est une porte **distincte** du circuit de validation, et elle ne le remplace pas. Quand un circuit s'applique à l'acte, il doit être **achevé** avant que la révision ne commence. Le **fil de parcours**, affiché en tête de l'écran de révision (et sur la rédaction, le circuit de signature, le parapheur et la fiche de l'acte), montre la place de chaque porte et qui la tient." },
        { t: "note", kind: "info", title: "La révision n'existe que si quelqu'un en est chargé", text: "S'il n'y a **aucun réviseur compétent** pour un acte, il n'y a pas de révision : l'acte part directement en signature. La qualité de réviseur se règle dans **Comptes et rôles** (le rôle « Réviseur », qui se cumule avec les autres), ou sur un **service entier** dans **Administration › Services** — c'est le cas d'un service des affaires juridiques qui contrôle les actes de tous les autres services." },
        { t: "p", text: "Tout se passe dans l'écran **Révision**, dans le menu de gauche, quand votre compte en a la qualité." },
        { t: "terms", items: [
          { term: "Rapport de conformité", def: "Ce que les contrôles de l'application ont vérifié : champs obligatoires et règles de la trame, structure du document, visas et références, mentions obligatoires, publicité, écarts de rédaction. Pour un **document qui ne fait pas droit** (verbatim de séance, déclaration, vœu), le contrôle porte sur son **texte** — il n'a pas de dispositif en articles, et le rapport ne lui annonce ni opposabilité ni entrée en vigueur. Il ne remplace pas votre lecture : l'opportunité et la légalité de fond restent à apprécier." },
          { term: "Compétence", def: "Ce sur quoi un réviseur est compétent : certains services, certaines familles de trames, certains types d'actes, certaines entités. Ne rien restreindre vaut « tous les services, tous les actes »." },
          { term: "Révision caduque", def: "Le texte de l'acte a été modifié depuis la révision : ce qui a été contrôlé n'est plus ce que porte l'acte. La révision doit être reprise." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Révision**. L'onglet « À réviser par moi » montre les actes qui relèvent de votre compétence.", detail: "Les onglets « En attente », « Validées » et « Rejets » montrent la file : ce qui attend, ce qui a été validé, ce qui a été rejeté." },
          { text: "Cliquez sur l'acte : lisez le **rapport de conformité**, groupe par groupe, et l'acte lui-même." },
          { text: "Corrigez directement l'acte si nécessaire.", detail: "Les corrections passent par l'historique de travail de l'acte : elles sont conservées, et le dossier de révision indique qu'il y a eu correction." },
          { text: "Écrivez votre **observation**, puis cliquez sur **Valider et envoyer en signature** — ou sur **Rejeter**.", detail: "Le motif de rejet est obligatoire : c'est lui qui dit au rédacteur ce qu'il doit corriger. Il lui est communiqué, et son acte revient en brouillon." },
        ] },
        { t: "note", kind: "warn", title: "Ce qui part en signature est ce qui a été révisé", text: "La révision porte sur le **texte exact** de l'acte. Si l'acte est réécrit après coup — par le rédacteur ou par le réviseur —, l'application le détecte : la révision devient **caduque**, et l'acte ne peut pas être envoyé sans une nouvelle révision. C'est ce qui garantit que l'acte signé est bien celui qui a été contrôlé." },
        { t: "note", kind: "info", title: "Côté rédacteur", text: "Le rédacteur voit l'état de la révision dans l'en-tête de son acte. Quand un réviseur a corrigé le texte, il en est informé ; quand l'acte est rejeté, il lit le **motif** et peut reprendre son acte." },
        { t: "next", chapter: "signature", label: "Faire signer l'acte" },
      ],
    },
    // ------------------------------------------- 5 bis : signature et publication
    {
      id: "signature",
      title: "Faire signer un acte",
      short: "Envoyer l'acte au prestataire de signature (circuit électronique) et récupérer l'acte signé — ou, quand on est signataire, signer depuis l'onglet « Ma signature ».",
      icon: "lock",
      minutes: 4,
      audience: "all",
      keywords: "signature signer signataire ma signature onglet rapprochement compte outil de signature prestataire certificat horodatage webhook circuit original signé électronique",
      blocks: [
        { t: "p", text: "Un acte n'existe vraiment qu'une fois **signé** par la personne qui a le pouvoir de le prendre. L'application envoie l'acte à un service de signature électronique et reçoit en retour l'acte signé." },
        { t: "note", kind: "info", title: "Trois façons de signer", text: "Ce chapitre décrit le circuit **électronique** — l'acte part à un prestataire branché en API et revient signé. Il en existe deux autres, selon l'équipement de votre collectivité : la **signature électronique simple**, où le signataire signe **dans l'application**, avec son compte (voir « Signer dans l'application (signature simple) »), et le **circuit externe**, sur papier ou par un outil tiers (voir « Signer sur papier (ou par un outil tiers) »). L'écran du circuit dit toujours lequel s'applique à l'acte que vous avez ouvert, et d'où vient ce choix." },
        { t: "note", kind: "info", title: "S'il y a un parapheur ou une révision", text: "Quand un **circuit de validation** s'applique à l'acte (voir **Administration › Circuits de validation**), l'acte doit d'abord le franchir — voir le chapitre « Faire valider un acte » : sinon, le bouton « Envoyer en signature » reste inactif et l'écran explique pourquoi. Et si l'acte est réécrit après la validation, celle-ci devient caduque. De même, quand un **réviseur** est compétent pour l'acte, celui-ci doit être **révisé** avant l'envoi (voir le chapitre « Faire réviser un acte »). Ni circuit ni révision : l'acte part directement en signature." },
        { t: "note", kind: "info", title: "Les annexes ne se signent pas", text: "Si l'acte que vous avez ouvert est une **annexe** — un règlement intérieur adopté par une délibération —, l'écran vous le dit et vous renvoie vers son **acte d'adoption** : il n'y a ici ni envoi en signature, ni publication. Une annexe tient son autorité de l'acte qui l'adopte, et son texte suit l'original signé de cet acte. C'est donc **l'acte d'adoption** qu'il faut envoyer en signature. Voir le chapitre « Adopter une annexe »." },
        { t: "p", text: "Pour cela, ouvrez **Signature & publication** dans le menu de gauche, puis l'onglet « Circuit de signature »." },
        { t: "note", kind: "info", title: "Si vous êtes vous-même signataire : l'onglet « Ma signature »", text: "Un compte qui porte la **qualité de Signataire** ouvre cet écran sur son propre onglet, **« Ma signature »**. Vous y voyez **qui vous êtes** pour l'application (la personne que vous tenez, votre qualité, votre compte, et l'état de son **rapprochement** avec l'outil de signature), puis deux listes : les **actes qui attendent votre signature** — avec, pour chacun, le bouton *Déposer et signer* ou *Signer* —, et les **actes signés au titre de votre signature**, c'est-à-dire ceux que vos délégataires ont signés sous votre pouvoir. Vous n'y voyez que les actes de votre **champ de compétence**. La qualité de Signataire **découle d'une désignation** : elle s'attribue d'elle-même dès que vous êtes désigné dans l'organigramme des **Délégations**, comme délégant ou comme délégataire. Si le bandeau annonce que votre compte **n'est pas encore rapproché** de l'outil de signature, un bouton suffit — en production, c'est l'annuaire de la collectivité qui a créé les deux comptes." },
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
          { text: "Le retour signé **publie** l'acte : s'il est publiable, il est déposé au recueil et reçoit son identifiant ELI sans autre geste.", detail: "Un acte individuel (trame déclarée non publiable) s'arrête à la signature : il est conservé au registre et notifié à l'intéressé." },
        ] },
        { t: "note", kind: "info", title: "Si la télétransmission est activée", text: "Quand l'administrateur a activé la **transmission au contrôle de légalité** (Administration › Expérimentale), une étape s'intercale **entre le retour signé et la publication** : l'acte signé part vers l'API d'envoi du contrôle de légalité, son **certificat de transmission** est déposé sur le document, puis l'acte est publié. La marche correspondante apparaît dans le circuit. Tant que la transmission n'a pas abouti, l'acte n'est pas publié." },
        { t: "note", kind: "info", title: "Si le signataire refuse", text: "Cliquez sur **Refuser** : l'acte revient en rédaction avec la mention « Prêt ». Rien n'est perdu, il suffit de le renvoyer après correction." },
        { t: "note", kind: "warn", title: "La signature de cette installation", text: "Le prestataire est ici une **simulation** : les échanges, la cryptographie et le retour de l'acte signé sont réels et vérifiables, mais le certificat est un certificat de démonstration — il n'a pas la valeur d'une signature qualifiée au sens du règlement eIDAS. En production, l'application est branchée sur le prestataire de la collectivité." },
        { t: "next", chapter: "publication", label: "Publier l'acte et le rendre opposable" },
      ],
    },
    // --------------------------------- 5 bis (bis) : le circuit externe (papier)
    {
      id: "signature-externe",
      title: "Signer sur papier (ou par un outil tiers)",
      short: "Le second circuit de signature : télécharger le document prêt à signer, le faire signer hors de l'application, rentrer la version signée en PDF — et faire certifier sa conformité par le réviseur.",
      icon: "lock",
      minutes: 5,
      audience: "all",
      keywords: "signature externe papier manuscrite scan outil tiers sans api télécharger document prêt à signer bordereau version signée pdf ajouter la version signée déposer conformité certifier certification réviseur empreinte circuit imposé autorisé réglage",
      blocks: [
        { t: "p", text: "Toutes les collectivités ne signent pas avec un prestataire branché en API. Beaucoup signent **sur papier** — ou avec un outil que l'application ne pilote pas. L'application prévoit donc **deux circuits** : le circuit **électronique** (l'acte part au prestataire et revient signé, chapitre précédent), et le circuit **externe**, décrit ici. Dans le circuit externe, l'application **n'appelle aucun service de signature** : c'est vous qui faites circuler le document." },
        { t: "note", kind: "info", title: "Quel circuit s'applique à mon acte ?", text: "C'est un **réglage**, jamais une règle cachée. Le circuit de la collectivité se règle dans **Administration › Signature** ; une **trame** peut ensuite l'écarter, dans l'onglet « Trame » de l'éditeur : *suivre le réglage général*, *circuit externe **imposé*** (aucun choix pour cette trame), *circuit externe **autorisé*** (le rédacteur choisit, acte par acte) ou *circuit électronique imposé*. L'écran du circuit affiche en tête lequel s'applique, et d'où il vient (« réglage général » ou « réglé par la trame »)." },
        { t: "p", text: "Le circuit externe se déroule en quatre gestes." },
        { t: "steps", items: [
          { text: "**Envoyer à signature** — c'est-à-dire **télécharger le document prêt à signer**.", detail: "Le fichier téléchargé est une page A4 imprimable, précédée d'un **bordereau de remise** : référence, objet, entité, trame, date et **empreinte** du document remis, et la marche à suivre. Imprimez-le (ou transmettez-le à l'outil tiers) et faites-le signer hors de l'application." },
          { text: "**Faire signer** le document, sur papier ou dans l'outil tiers.", detail: "L'application n'y assiste pas : c'est le principe de ce circuit." },
          { text: "**Ajouter la version signée** — rentrer la pièce signée dans la base.", detail: "Au format **PDF** : le document signé scanné, ou le PDF produit par l'outil tiers. L'application calcule son **empreinte SHA-256** au moment du dépôt : c'est elle qui attache la pièce à l'acte. L'acte passe alors au statut « signé »." },
          { text: "**Certifier la conformité** — le geste du **réviseur**.", detail: "Un réviseur compétent pour l'acte compare la **pièce signée** (le PDF) à la **version numérique** qui sera publiée, puis déclare qu'elles concordent. C'est ce contrôle qui remplace, dans ce circuit, la révision d'avant signature : il ne porte pas sur le texte avant signature, mais sur le document **signé**." },
        ] },
        { t: "note", kind: "warn", title: "La certification ne se donne pas à la légère", text: "Le réviseur coche **chaque point** qu'il a vérifié (la signature du signataire désigné, l'identité du texte, la complétude de la pièce, la cohérence de la date) avant de pouvoir certifier. S'il **refuse**, il doit écrire **ce qui ne concorde pas** : l'acte attend alors une version signée conforme, et la publication reste fermée. Déposer une **nouvelle** version signée **annule** la certification précédente — elle portait sur l'ancienne pièce." },
        { t: "note", kind: "info", title: "Quand la certification n'est pas requise", text: "S'il n'existe **aucun réviseur compétent** pour l'acte, il n'y a personne pour certifier : la version signée déposée suffit, et la publication suit. L'écran du circuit le dit clairement (« aucun réviseur n'est compétent pour cet acte »), et la marche de certification n'apparaît pas." },
        { t: "p", text: "Où le réviseur trouve-t-il les pièces à certifier ? Dans **Révision**, un onglet **« Certifications (signature externe) »** rassemble les actes dont la version signée attend sa décision. Il y voit la pièce signée, la version numérique, les deux empreintes, et le rapport de conformité de l'application. Le geste est **aussi** offert depuis l'écran **Signature & publication** (encart « Versions signées en attente de certification »)." },
        { t: "note", kind: "info", title: "Ce que le public voit", text: "Sur le **recueil public**, l'« original » d'un acte signé de cette façon n'est pas un paquet de données : c'est **la version signée elle-même**, montrée dans la page **telle qu'elle a été mise en ligne**, avec sa date de dépôt, son empreinte et l'attestation de conformité du réviseur. C'est elle qui fait foi ; le texte affiché à l'écran n'en est qu'une lecture pratique." },
        { t: "terms", items: [
          { term: "Document prêt à signer", def: "Le document compilé, précédé de son bordereau de remise : ce que l'on imprime et fait signer. À ne pas confondre avec la version qui sera publiée." },
          { term: "Version signée", def: "Le PDF signé hors de l'application, déposé dans la base. C'est lui « l'original » de l'acte dans ce circuit." },
          { term: "Empreinte SHA-256", def: "Le « code-barres » du fichier : il prouve qu'un document n'a pas changé depuis son dépôt. La pièce signée et la certification qui s'y rapporte portent la même." },
          { term: "Certification de conformité", def: "L'attestation du réviseur : la pièce signée correspond bien à la version numérique publiée. C'est ce qui remplace la révision d'avant signature quand l'acte a été signé dehors." },
          { term: "Circuit imposé / autorisé", def: "Imposé : la trame n'offre que ce circuit. Autorisé : la trame permet les deux, et le rédacteur tranche pour chaque acte." },
        ] },
        { t: "next", chapter: "publication", label: "Publier l'acte et le rendre opposable" },
      ],
    },
    // ------------------------ 5 bis (ter) : la signature simple (dans l'appli)
    {
      id: "signature-simple",
      title: "Signer dans l'application (signature simple)",
      short: "Le troisième circuit : le signataire signe dans Scribae, avec son compte, après avoir vérifié le document — sans prestataire et sans papier.",
      icon: "lock",
      minutes: 4,
      audience: "all",
      keywords: "signature simple électronique simple dans l'application sans prestataire sans api signer vérifier et signer fenêtre de signature déclaration cocher identité compte courriel dossier interne original interne non diffusé mentions nominatives traçabilité trois circuits",
      blocks: [
        { t: "p", text: "Toutes les collectivités n'ont pas de prestataire de signature branché en API, et toutes ne veulent pas faire circuler du papier. La **signature électronique simple** est le circuit fait pour elles : le signataire signe **dans Scribae**, avec son compte, après avoir relu le document." },
        { t: "note", kind: "info", title: "Le troisième des trois circuits", text: "L'application en propose trois, et l'écran du circuit dit toujours lequel s'applique : **électronique** (l'acte part à un prestataire et revient signé), **simple** (le signataire signe ici — c'est ce chapitre), **externe** (le document est téléchargé, signé hors de l'application, et le PDF signé est déposé — voir « Signer sur papier »). Le réglage se fait dans **Administration › Signature**, et une **trame** peut ensuite l'imposer ou l'autoriser, comme pour le circuit externe." },
        { t: "p", text: "Le déroulé est court, parce que le signataire est déjà là." },
        { t: "steps", items: [
          { text: "Le signataire ouvre **Signature & publication › Ma signature** et clique **Vérifier et signer**.", detail: "C'est le même geste depuis l'onglet « Circuit de signature » : l'acte est **déposé** au service, le circuit est **ouvert**, et la fenêtre de signature s'affiche. Comme pour tout envoi en signature, le circuit de validation (s'il s'en applique un) et la **révision** doivent avoir été franchis." },
          { text: "Il **relit le document** dans la fenêtre.", detail: "La fenêtre montre le document, **ce qu'il** engage (nom, fonction, adresse électronique, compte), l'**empreinte SHA-256** du texte signé, et ce que la signature emporte." },
          { text: "Il **coche la déclaration** — « Je déclare avoir vérifié le document ci-dessus et j'engage ma signature sur son contenu. »", detail: "Tant qu'elle n'est pas cochée, le bouton de signature reste **inactif**. Ce n'est pas une formalité : c'est ce que la signature atteste, et ce que le dossier conservera." },
          { text: "Il clique **Signer l'acte**.", detail: "La signature est réelle et vérifiable — même cryptographie (ECDSA P-256 et SHA-256) et même horodatage que dans le circuit électronique. Le service **recalcule l'empreinte** du document reçu et la compare à celle du document déposé : si les deux diffèrent, il refuse la signature." },
          { text: "L'acte est **signé**, puis **publié** s'il est publiable.", detail: "Le retour signé publie l'acte automatiquement, comme pour tout autre circuit : identifiant ELI, date d'opposabilité. Un acte individuel (trame non publiable) s'arrête à la signature et est notifié à l'intéressé." },
        ] },
        { t: "note", kind: "ok", title: "Ce que le public voit — et ce qu'il ne voit pas", text: "C'est ici que ce circuit se distingue, et c'est une garantie, pas un détail. La signature simple fait l'objet de **deux parts** : la part **publique** — le **nom**, la **fonction** et la **date** du signataire, avec l'empreinte et le certificat — est seule diffusée (recueil public, exports, versions en ligne) ; la part **interne** — **adresse électronique**, compte, moyen d'authentification, poste, horodatage et **courriels envoyés** — est **rangée au registre** et n'est **servie par aucune adresse publique**. Elle se lit dans l'application : sur l'acte, le bouton **« Dossier de signature (interne)… »** l'affiche en entier. Le circuit électronique en bénéficie de la même façon : de son paquet signé ne sortent, pour le public, que le nom, la fonction et la date." },
        { t: "note", kind: "warn", title: "Le signataire a besoin d'une adresse électronique", text: "La signature simple est **nominative** : elle trace qui a signé, avec quelle adresse et sur quel compte. Si le signataire désigné n'a pas d'adresse électronique, l'application **s'arrête** et le dit — une signature sans identité complète ne serait pas une trace. L'adresse se renseigne sur sa **fiche** (Administration › Personnes) ou vient de son **compte**." },
        { t: "note", kind: "info", title: "Vérifier plus tard qu'une signature est valable", text: "Comme pour les autres circuits : l'empreinte du document, la signature par la clé publique du certificat et le jeton d'horodatage sont **revérifiés à la consultation**. Le bouton **Voir l'original signé** affiche la pièce telle qu'elle a été signée. Dans cette installation de démonstration, le certificat est un certificat de démonstration : la cryptographie est réelle, mais il n'a pas la valeur d'une signature qualifiée au sens du règlement eIDAS." },
        { t: "note", kind: "warn", title: "L'acte publié DIT ce que vaut sa signature", text: "Un acte signé « en simple » n'est pas un acte signé au sens plein : le règlement européen sur l'identification électronique (eIDAS, règlement (UE) n° 910/2014) réserve l'équivalent d'une signature manuscrite à la seule signature **qualifiée**. L'acte publié le dit donc lui-même, sous son texte : un encadré **« Signature simple — non qualifiée »** rappelle dans quelles conditions la signature a été donnée et sur quoi repose la valeur probante de l'acte (l'original conservé, et la vérifiabilité de sa signature). Le recueil public porte la même mention, et le JSON-LD la transporte pour les machines (`eli:signature_level`). Le prestataire **simulé** de la démonstration est nommé de la même façon : rien de ce qui n'est pas qualifié ne se présente comme qualifié." },
        { t: "terms", items: [
          { term: "Signature simple", def: "La signature donnée dans l'application, par le signataire, avec son compte — sans prestataire et sans papier. C'est le procédé que le droit appelle « signature électronique simple »." },
          { term: "Déclaration", def: "La phrase que le signataire coche avant de signer : elle atteste qu'il a vérifié le document et engage sa signature sur son contenu." },
          { term: "Part publique", def: "Ce que tout le monde peut voir d'une signature : le nom, la fonction, la date — et l'empreinte du document." },
          { term: "Dossier interne", def: "Ce qui n'est pas diffusé : l'adresse électronique, le compte, le moyen d'authentification, le poste, et les courriels adressés au titre de l'acte. Il est conservé au registre et lisible dans l'application (et par la route protégée du service)." },
          { term: "Empreinte SHA-256", def: "Le « code-barres » du document signé : c'est lui que la signature engage, et c'est lui que le service revérifie au retour." },
        ] },
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
      keywords: "publication publier eli opposabilité opposable recueil recueil public site sans compte theme thème matière famille carrousel derniers actes accueil épingler punaise à la une mise en avant règlement intérieur charte version en ligne original signé acte individuel non publiable retrait retirer dépublier robot moteur de recherche llms.txt sitemap données ouvertes markdown json akoma ntoso adresse autres recueils recueil bis recueil inactif inactif renvoi renvois légifrance service-public.gouv.fr service public vous ne trouvez pas mentions légales accessibilité accessibles rgaa déclaration défenseur des droits lien mentions du site principal éditeur opposabilité recours verbatim compte rendu séance débats vœu voeu motion document non opposable non juridique nature",
      blocks: [
        { t: "p", text: "Un acte signé n'est pas encore **opposable** : il ne peut être appliqué qu'à partir du moment où il a été publié. C'est la publication qui le rend obligatoire pour tout le monde." },
        { t: "p", text: "L'onglet « Publication (ELI) » fait ce travail : il dépose la **version en ligne** de l'acte au recueil, lui donne son **identifiant ELI** et fixe les dates." },
        { t: "terms", items: [
          { term: "Opposabilité", def: "Le moment à partir duquel l'acte peut être appliqué à tout le monde. Par défaut : le lendemain de la publication." },
          { term: "ELI (European Legislation Identifier)", def: "L'identifiant européen d'un texte : une référence courte et permanente, par exemple `eli:/fr/dec/2026/0402/iar`, qui ne change jamais, même si l'adresse du site change. C'est aussi un **lien** : le recueil le traduit en l'acte qu'il désigne (voir « Un identifiant ELI est un lien »)." },
          { term: "Recueil", def: "Le « journal officiel » de la collectivité : la collection dans laquelle les actes sont publiés." },
          { term: "Recueil public", def: "Le site ouvert à tous où les actes publiés se consultent, **sans compte** : on y cherche un acte et l'on y lit son texte, comme sur Légifrance. C'est la vitrine de la collectivité ; l'application, elle, reste l'outil de travail." },
          { term: "Recueil ouvert", def: "Ce que le recueil donne aux **moteurs de recherche** et aux **agents** (LLMs) : une adresse stable par acte, et le même acte dans des formats qu'ils savent lire — JSON, Markdown, texte brut, Akoma Ntoso." },
          { term: "Recueil « bis », recueil inactif", def: "Deux recueils que Scribae **ne gère pas**, mais vers lesquels le recueil public renvoie, en bas de page et à la fin des résultats de recherche. Un recueil **« bis »** est tenu à part (une entité autonome, un périmètre séparé) ; un recueil **inactif** n'est plus alimenté — on indique la **période** qu'il couvre, et plusieurs peuvent se succéder si le logiciel a changé. Ces renvois se règlent dans **Administration › Publication › Recueils extérieurs et renvois**." },
          { term: "À la une", def: "La bande de la page d'accueil du recueil public où figurent les actes **épinglés** — ceux que l'administration met en avant. C'est la place d'un **règlement intérieur**, d'une charte, du document qu'un visiteur vient chercher." },
          { term: "Mentions légales, mentions d'accessibilité", def: "Les deux mentions que l'espace public affiche **en bas de page**. Les **mentions légales** rappellent à quelles conditions un acte est exécutoire et opposable (publication et transmission au représentant de l'État, recours de deux mois) ; les **mentions d'accessibilité** rappellent les obligations d'accessibilité du service en ligne et comment signaler un obstacle. Elles se règlent dans **Administration › Publication › Mentions du recueil public** : on y écrit un texte, on le remplace par un **lien** (les mentions légales du site principal de la collectivité, par exemple) ou on l'éteint." },
          { term: "Version en ligne", def: "La page web de l'acte publié, celle que chacun peut consulter." },
          { term: "Original signé", def: "Le document signé, conservé tel quel. C'est lui qui fait foi ; la version en ligne n'est qu'une lecture pratique." },
          { term: "Acte non publiable", def: "Acte individuel (revalorisation d'un traitement, sanction…) dont la trame est déclarée non publiable : signé et conservé au registre, il n'est pas déposé au recueil et ne reçoit pas d'identifiant ELI." },
          { term: "Document non juridique", def: "Un document que la collectivité publie au recueil sans qu'il fasse droit : **verbatim d'assemblée** (le compte rendu intégral d'une séance), **déclaration**, **vœu**. Il se signe et se publie comme un acte (identifiant ELI compris), mais sa publication ne le rend **ni opposable, ni exécutoire** : il n'a **pas d'entrée en vigueur**, et **aucun délai de recours** ne court à son encontre. C'est la **nature** choisie sur la trame (« Nature du document ») qui le déclare." },
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
        { t: "note", kind: "info", title: "Les annexes ne se publient pas non plus — sauf les RÈGLEMENTS", text: "Une **annexe** ordinaire — un tableau, une grille tarifaire — ne se publie pas pour elle-même : c'est l'**acte qui l'adopte** qui est publié, et son original signé comprend le texte de l'annexe. Elle figure donc dans un encart à part, « Annexes adoptées », d'où l'on rejoint son acte d'adoption. **Exception** : une annexe déclarée **Règlement** sur sa trame est **aussi** publiée **à part, à titre informatif**, sous son propre identifiant (voir le chapitre « Adopter une annexe ») — parce que son texte normatif se consulte pour lui-même, comme un code." },
        { t: "note", kind: "info", title: "Les documents qui ne font pas droit", text: "Tout ce que la collectivité publie n'est pas un **acte**. Un **verbatim de séance** (le compte rendu intégral des débats), une **déclaration** prise devant l'assemblée, un **vœu** (une motion : l'assemblée demande, elle ne décide pas) se **signent** et se **publient au recueil** comme les actes — ils y reçoivent leur identifiant ELI et s'y consultent —, mais ils **ne font pas droit** : leur publication n'emporte **ni opposabilité, ni entrée en vigueur, ni délai de recours**, et ni la transmission au contrôle de légalité ni la notification ne les concernent. Le recueil les présente comme des **documents** (l'encadré annonce « Document non opposable »), et l'attestation de non-recours explique qu'aucun délai ne court à leur encontre. Ce qui le dit, c'est la **nature du document**, choisie sur la trame (onglet « Trame », champ **Nature du document**) : **Verbatim d'assemblée**, **Déclaration** ou **Vœu**. Sur la carte de publication, aucune règle d'entrée en vigueur n'est alors proposée : il n'y en a pas." },
        { t: "p", text: "Le retour signé publie l'acte : dès que la signature revient, un acte publiable est **déposé au recueil automatiquement**, sans autre geste de votre part. Une administration qui publie déjà dans son propre système peut **éteindre cet automatisme** (Administration › Publication) : l'acte signé attend alors au registre, et se publie à la main le moment venu." },
        { t: "note", kind: "info", title: "Le recueil public", text: "Les actes publiés se consultent par **tout le monde, sans compte**, dans le **recueil public** : un site qui ne montre que votre structure et ses actes. Sa **page d'accueil** se lit comme celle d'un vrai site : une entrée qui dit ce qu'on y trouve, la **recherche**, un **carrousel des derniers actes publiés** (chaque carte met en avant le **thème** de l'acte), puis les **thèmes** — les familles de trames — qui donnent accès aux actes par matière (urbanisme, police, finances…), et enfin la liste complète par année. Chaque acte s'y lit comme sur Légifrance — son titre, sa version, ses métadonnées (thème, identifiant ELI, dates d'opposabilité, recueil), puis son **texte présenté dans la page** (l'acte n'est pas enfermé dans une feuille à télécharger) —, avec ses pièces, sa signature vérifiable et ses versions. Le visiteur peut aussi ouvrir l'**original signé** — la pièce telle qu'elle a été signée — d'un bouton : elle s'affiche alors dans une fenêtre, où il peut l'imprimer ou l'enregistrer en PDF. C'est cette pièce qui fait foi. C'est l'adresse à communiquer ; l'écran « Publications (ELI) » donne un bouton **Ouvrir le recueil public** et permet d'en **copier le lien**. La **recherche** y est le premier geste : dès que l'on tape quelque chose dans l'entrée — ou que l'on choisit un thème —, le carrousel et la grille des thèmes **s'effacent** pour ne laisser que les résultats sous l'entrée ; ils reviennent quand on efface la recherche, ou d'un clic sur **Effacer les filtres**. Un **règlement** publié à part, à titre informatif (voir « Adopter une annexe »), se trouve au recueil comme les actes : il se cherche, se classe par thème, et son identifiant s'ouvre directement." },
        { t: "note", kind: "info", title: "Réserver un acte aux agents", text: "Un acte peut être **réservé aux personnes connectées** — une circulaire interne, une consigne aux agents. La case se pose sur la **trame** (onglet « Trame » de l'éditeur, « Réserver la diffusion aux agents connectés ») ou, **acte par acte**, au moment de la publication. L'acte reste **publié** — il a son identifiant ELI, sa page, ses versions —, mais le **recueil public ne le montre qu'aux personnes connectées** : un visiteur anonyme ne le trouve ni dans la liste, ni à son adresse, ni dans les fichiers destinés aux moteurs de recherche. Le bloc « Vous ne trouvez pas ce que vous cherchez ? » du bas de page le rappelle : certains actes ne sont consultables qu'après **connexion**. Et si la collectivité a **restreint l'atelier à certains réseaux** (voir « Restreindre l'atelier à un réseau », chez les administrateurs), la réservation se double de la même condition : un acte réservé ne s'ouvre qu'à une personne **à la fois connectée et venue d'une adresse autorisée** — depuis l'intranet, par exemple. Hors d'un réseau autorisé, même connecté, on ne le voit pas." },
        { t: "note", kind: "info", title: "Les autres recueils, et les renvois", text: "Le recueil public ne prétend pas tout contenir. Une collectivité a souvent tenu, avant Scribae, **d'autres recueils** : un recueil **« bis »**, monté à part pour une raison technique (une entité autonome, un périmètre séparé), ou des recueils **inactifs** que des changements de logiciel ont laissés derrière eux — parfois **plusieurs à la suite**. Le public, lui, cherche un acte, pas l'histoire des prestataires : en **bas de page** de l'espace public — et à la **fin des résultats de recherche**, sous le titre **« Vous ne trouvez pas ce que vous recherchez ? »** — le recueil indique donc **où chercher ailleurs**, avec la **période** couverte par chaque recueil inactif (« actes publiés du … au … »). Il renvoie aussi vers les **sites de référence** — **Légifrance** et **service-public.gouv.fr** —, où toute question de droit trouve sa réponse. Ces renvois se règlent dans **Administration › Publication › Recueils extérieurs et renvois** : on y écrit un **libellé**, une **adresse**, une **nature** (« recueil bis », « recueil inactif », « site de référence ») et, pour un recueil inactif, sa **période**. Le bouton **Rétablir les renvois livrés** fait revenir Légifrance et service-public.gouv.fr si on les a supprimés." },
        { t: "note", kind: "info", title: "Les mentions du bas de page", text: "Un site public se termine par ses **mentions**, et le recueil public les porte **en bas de page** — chacune avec **sa propre page**, à son adresse (une page se cite, se partage et s'indexe). Les **mentions légales** rappellent à quelles conditions un acte est **exécutoire et opposable** : la publication et la transmission au représentant de l'État (article L. 2131-1 du code général des collectivités territoriales), puis le **délai de recours de deux mois** à compter de la publication (article R. 421-1 du code de justice administrative). Les **conditions de réutilisation** rappellent la licence sous laquelle les informations publiées peuvent être réutilisées (Licence Ouverte par défaut). Les **mentions d'accessibilité** rappellent les obligations d'accessibilité d'un service de communication publique en ligne (article 47 de la loi du 11 février 2005, référentiel RGAA), l'existence de la **déclaration d'accessibilité** et du schéma pluriannuel, et la façon de **signaler un obstacle** — jusqu'à saisir le Défenseur des droits. Ces textes sont **livrés prêts à l'emploi**, et se règlent dans **Administration › Publication › Mentions du recueil public**. Pour chacun, vous avez **trois choix** : le **texte** s'affiche en toutes lettres sur sa page ; un **lien** le remplace par un simple renvoi — c'est ce qu'on fait quand la collectivité tient déjà ses mentions légales sur le site principal de la mairie ; ou **rien du tout**, si votre situation demande de ne pas l'afficher (la page n'existe alors pas, et le sommaire du pied de page ne la liste pas). Le bouton **Rétablir le texte livré** ramène la mention livrée avec l'application, qu'on n'écrase donc jamais vraiment." },
        { t: "note", kind: "info", title: "La mention « Propulsé par Scribae »", text: "Le pied de page du recueil public — comme celui de l'atelier et de l'écran de connexion — porte la **mention de l'éditeur du logiciel** : « **Propulsé par Scribae — GPLv3** », le nom de l'outil renvoyant à sa **documentation**. Scribae est un **logiciel libre**, publié sous licence GPL-3.0 : la mention dit d'où vient l'application. Une collectivité peut l'**éteindre** — Administration › Identité, carte « Mention de l'éditeur du logiciel » : un site public a sa charte, et peut être intégré dans un portail qui porte déjà sa propre signature." },
        { t: "note", kind: "info", title: "Publia, l'assistant du recueil", text: "Le recueil public a, lui aussi, son assistant : **Publia** (une pastille en bas à droite). Le visiteur lui pose ses questions en français — « quels sont les derniers actes ? », « qu'est-ce que l'identifiant ELI ? » — et, dès qu'il a **un acte ouvert**, Publia le sait : elle répond d'abord sur **cet** acte (ce qu'il prévoit, sa portée, ses dates, ses modifications, ses versions) et donne le **lien** pour l'ouvrir. Elle ne connaît que les **actes publiés** : cette aide est publique, comme le recueil lui-même. Comme Plume, elle a un **nom** et une **icône** qui se règlent dans **Administration › Assistants**, et elle peut y être **éteinte** pour tout le monde." },
        { t: "note", kind: "info", title: "Le recueil donne accès à l'application", text: "Pour qui n'a pas de compte, le recueil **est** l'entrée de l'application : son en-tête porte un bouton **Se connecter** (comptes de l'application ou annuaire, selon le référentiel). Une fois connecté, la même place propose **Retour à l'application** — et un agent authentifié à qui aucun rôle ne donne accès y trouve **Mon accès**, un écran qui le lui explique et le renvoie vers le recueil. C'est également la **page d'accueil** de l'installation : ouvrir l'adresse du logiciel (sans ancre, ni paramètre) mène **ici**, sur les actes publiés — c'est l'adresse que vous pouvez communiquer et afficher —, et non à l'atelier. L'atelier s'ouvre par ce bouton **Se connecter** ; un agent qui recharge la page revient donc au recueil, et repart d'un clic. L'atelier a d'ailleurs **sa propre adresse** — `/atelier` sur une installation hébergée, `?atelier` sur la démonstration — : un agent peut la mettre en favori et y revenir directement. Quand la collectivité a **restreint l'atelier à certains réseaux** (voir le chapitre des administrateurs), une visite depuis une autre adresse n'ouvre pas l'atelier : une page l'explique, et rappelle que le **recueil public, lui, reste ouvert à tous**." },
        { t: "note", kind: "info", title: "Les thèmes du recueil", text: "Le **thème** d'un acte est la **famille de sa trame** : c'est ce classement qui donne au recueil sa page d'accueil par matière. Le **libellé** et la **présentation** de chaque thème s'écrivent dans **Administration › Familles** — la présentation est la phrase affichée sous le nom du thème, sur le recueil public. Le thème est transmis au dépôt de l'acte, puis à sa publication : renommer une famille suffit à renommer le thème partout dans le recueil." },
        { t: "p", text: "Pour relire une publication, ouvrez **Publications (ELI)** dans le menu : le registre liste les actes publiés, et vous pouvez y coller un identifiant ELI pour retrouver directement un texte. Le texte s'affiche **dans la page**, et un bouton mène à la page du recueil public du même acte." },
        { t: "note", kind: "info", title: "Les moteurs de recherche et les agents lisent aussi le recueil", text: "Le recueil n'est pas lu que par des humains : les **moteurs de recherche** le parcourent pour référencer vos actes, et les **agents** (assistants, LLMs) le consultent pour répondre à des questions. Ces lecteurs-là n'exécutent pas l'application : il leur faut des **adresses** et des **formats**. Chaque acte publié a donc, à côté de sa page habituelle, une **adresse de référence** stable — la même tant que l'identifiant ELI ne change pas — et plusieurs **représentations** : **JSON** (les métadonnées, l'identifiant ELI et le texte), **Markdown** (le texte structuré, le plus lisible par un agent), **texte brut** et le document normé **Akoma Ntoso**. Vous les trouvez sous le texte de chaque acte, dans le bloc **« Recueil ouvert »** : chaque adresse se copie d'un bouton. Sur une installation hébergée sur votre propre serveur, ces adresses sont de vraies pages (`/recueil`, `/recueil/<clé>`, `/recueil/<clé>.json`…), et le recueil entier se donne aussi à lire aux robots : `/llms.txt` (sa présentation), `/recueil.json` (l'index), `/sitemap.xml` (le plan) et `/robots.txt` (ce qui peut être parcouru). Rien à régler : c'est la publication elle-même qui ouvre l'acte." },
        { t: "note", kind: "info", title: "Un identifiant ELI est un lien", text: "Quand un acte en cite un autre — le visa d'une annexe (« Vu l'arrêté n°… du …, qui l'adopte »), le renvoi à l'acte qui l'a modifié —, la citation porte l'**identifiant ELI** de l'acte visé. Et ce n'est pas un identifiant en l'air : dans le recueil, la citation est **cliquable** et mène **à l'acte**, sur place. L'identifiant désigne l'**acte** (et non une version) : c'est donc toujours la version **en vigueur** qui s'ouvre. Si l'acte cité n'est **pas publié** chez vous — un texte venu d'ailleurs —, la mention reste, mais **sans lien** : mieux vaut une référence sans lien qu'un lien qui ne mène nulle part. L'identifiant s'ouvre aussi **directement**, comme une adresse : collez `…/eli/arr/2026/0464/vsl` dans votre navigateur (installation sur votre serveur) ou `?eli=eli:/fr/arr/2026/0464/vsl` (démonstration), et vous arrivez sur l'acte. Le bloc **« Recueil ouvert »**, sous le texte de chaque acte, donne cette adresse prête à copier." },
        { t: "note", kind: "warn", title: "Un acte publié ne se retire jamais", text: "Retirer un acte du recueil est un **dernier recours**, réservé à l'**administrateur**, et pour un **motif technique** seulement : dépôt en double, dépôt erroné, acte publié avant signature, identifiant attribué à tort. Ce n'est **pas** une façon de corriger un acte : un acte qu'on veut changer se **modifie** (acte modificatif), un acte qu'on veut annuler s'**abroge** — dans les deux cas il **reste au recueil**, car le public a pu le lire et s'y fier. Le geste s'ouvre depuis la consultation d'une publication, sous un **avertissement en grand**, et exige un **motif écrit**, conservé sur l'acte et au journal. L'acte redevient alors « signé », et peut être publié à nouveau." },
        { t: "note", kind: "info", title: "Mettre un acte à la une", text: "Certains actes méritent mieux qu'une place parmi les derniers publiés : le **règlement intérieur**, la charte, le document qu'un visiteur vient chercher. Dans l'onglet **Actes**, le bouton **punaise** (à droite de la ligne, près d'Exporter) **épingle** l'acte : il prend place dans la bande **« À la une »** de la page d'accueil du recueil public, au-dessus du carrousel. Le même bouton l'en retire. On peut épingler un acte **avant** sa publication : il sera à la une dès qu'il sera publié. Et comme l'épinglage suit l'**acte** — son identifiant ELI — et non la version publiée, un acte **modifié ou consolidé reste à la une**. Le geste demande la permission « Mettre un acte en avant sur le recueil public » (administrateur ou éditeur)." },
        { t: "shot", shot: "publication" },
        { t: "next", chapter: "informations", label: "Publier une information (actualité)" },
      ],
    },
    // -------------------- 5 ter bis : les informations du recueil public
    // Ce chapitre existe pour lui-même : la rubrique « Informations » (les
    // billets publiés au recueil public, comme un blog) n'est pas un onzième
    // onglet de la publication d'actes — elle a son écran, sa permission, et
    // ses règles propres. Voir src/ui/views/informations.js et
    // src/lib/informations.js.
    {
      id: "informations",
      title: "Publier une information (actualité)",
      short: "Les nouvelles qui ne sont pas des actes : un avis, un changement d'horaires, une réunion publique.",
      icon: "note",
      minutes: 3,
      audience: "all",
      keywords: "information informations actualité actualités communication communiqué communiquer news blog billet bulletin épingle épingler épinglée à la une publier dépublier brouillon recueil public rubrique apparence renommer éteindre titre chapeau intro résumé markdown auteur date adresse ?info= page=informations chat chats http.cat erreur erreurs page d'erreur 404 ornement",
      blocks: [
        { t: "p", text: "Tout ce qu'une collectivité affiche au public n'est pas un **acte**. Une **réunion publique**, un **changement d'horaires**, des **travaux**, une **fermeture exceptionnelle** : ce sont des **informations**, et un acte ne se signe pas pour les dire. L'écran **Informations** (dans le menu) sert à les écrire et à les **publier au recueil public** — comme les billets d'un blog." },
        { t: "p", text: "Une information ne se signe pas, ne se numérote pas et ne reçoit **aucun identifiant ELI** : c'est ce qui la rend simple. Elle porte un **titre**, une **date**, un **auteur**, un **résumé** facultatif et un **texte**." },
        { t: "terms", items: [
          { term: "Information (ou billet)", def: "Une nouvelle publiée au recueil public sans être un acte : actualité, avis, communication. Elle n'a ni numéro, ni signataire, ni circuit de validation." },
          { term: "Brouillon", def: "Une information **écrite mais non publiée**. Elle n'existe que dans l'atelier : le public ne la voit jamais." },
          { term: "Épinglée", def: "Une information mise **en tête** de la rubrique — et de la page d'accueil du recueil — avant les plus récentes. C'est la place de l'avis qui compte." },
          { term: "Adresse du billet", def: "L'adresse publique du billet, faite de son titre (`?info=marche-de-noel`). Elle se fige à la publication : retoucher le titre ensuite ne casse pas les liens déjà partagés." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Informations** dans le menu, puis cliquez sur **Nouvelle information**.", detail: "L'écran fait deux colonnes : à gauche la liste des billets — avec une **recherche** et un filtre **Toutes / Publiées / Brouillons** —, à droite le billet ouvert. Écrire une information demande la permission « informations.gerer »." },
          { text: "Remplissez le **titre**, la **date** et l'**auteur**, puis, si vous voulez, un **résumé**.", detail: "Le résumé est ce que l'on voit du billet dans la liste et sur la page d'accueil. Sans résumé, l'application affiche le début du texte." },
          { text: "Écrivez le **texte** du billet.", detail: "La mise en forme est du **Markdown**, comme ailleurs dans l'application : `#` pour un titre, `**gras**`, `-` pour une puce, `>` pour une citation, une barre verticale pour un tableau. Une adresse écrite dans le texte devient un lien." },
          { text: "Cliquez sur **Aperçu** pour voir le billet tel qu'il apparaîtra au public.", detail: "L'aperçu dit aussi ce qui manque encore — un titre, un texte — quand le billet ne peut pas être publié." },
          { text: "Quand le billet est prêt, cliquez sur **Publier**.", detail: "Le bouton **refuse un billet sans titre ou sans texte** : une carte vide n'a rien à faire au recueil. Publier est un **geste**, pas une case ; tant qu'on ne l'a pas fait, le billet reste un brouillon." },
        ] },
        { t: "note", kind: "info", title: "Où l'information apparaît", text: "Un billet publié se voit **aussitôt** sur le recueil public : il figure dans la rubrique **Informations** — une page à part, listée en bas de page —, et les plus récents, les **épinglés d'abord**, sont montrés en **page d'accueil**. Le visiteur lit le billet à son **adresse propre** (`?info=<titre-du-billet>`), que l'atelier donne à copier par le bouton **Voir**. La **date** ordonne la rubrique : le plus récent en tête, sauf les épinglés." },
        { t: "note", kind: "info", title: "Épingler un billet", text: "La case **Épinglée en tête** fait passer un billet **avant** les plus récents, dans la rubrique comme sur la page d'accueil : c'est la place d'un avis important, d'une information qui doit rester visible. La décocher laisse le billet publié, à sa place dans l'ordre des dates." },
        { t: "note", kind: "info", title: "Un brouillon ne quitte jamais l'atelier", text: "Un billet **non publié** n'est servi à personne : ni dans la rubrique, ni à son adresse, ni dans les fichiers destinés aux moteurs de recherche. **Dépublier** un billet le retire du site sans le détruire : il redevient un brouillon, et se republie d'un clic. **Supprimer**, à l'inverse, l'efface pour de bon, après confirmation." },
        { t: "note", kind: "info", title: "Renommer la rubrique, ou l'éteindre", text: "Le nom de la rubrique se règle dans **Administration › Publication**, carte **Apparence du site public**, encart **Rubrique « Informations »** : on y écrit son **titre** (« Informations », « Actualités », « Communications »…), son **chapeau** — la phrase qui la présente —, et on peut **éteindre** la rubrique. Éteinte, elle disparaît du site public et de son pied de page ; les billets, eux, restent dans l'atelier et se republient d'un clic. C'est là aussi que se règle la **feuille de style de la collectivité** : les billets publiés en suivent l'apparence, comme le reste du recueil." },
        { t: "note", kind: "info", title: "Les chats des pages d'erreur (option)", text: "La même carte **Apparence du site public** porte une option de confort, **éteinte par défaut** : *Illustrer les pages d'erreur d'un chat (http.cat)*. Allumée, les pages d'erreur — « acte introuvable », « page introuvable », atelier fermé depuis cette adresse, panne d'affichage — montrent une **photographie de chat**, choisie selon le code de l'erreur (404, 403, 503…). C'est un simple ornement : la page dit de toute façon ce qu'elle a à dire. **L'image est demandée à un site tiers**, `http.cat` : en l'affichant, le navigateur du visiteur ouvre une connexion vers ce site, qui voit alors son **adresse IP** et la page d'où il vient. C'est ce qui justifie que l'option soit éteinte par défaut — ne l'allumez qu'en connaissance de cause. Le réglage suit le recueil : le service public l'applique à partir de la **prochaine publication**." },
        { t: "note", kind: "warn", title: "Une information ne fait pas droit", text: "Ne cherchez pas à publier une **décision** sous forme d'information. Ce qui a un effet juridique — un arrêté, une délibération, une décision — se **rédige**, se **signe** et se publie comme un **acte**, avec son numéro et son identifiant ELI. La rubrique Informations ne sert qu'à ce qui **informe** : elle ne rend rien opposable, n'ouvre aucun délai de recours, et n'est jamais transmise au contrôle de légalité." },
        { t: "faq", items: [
          { q: "Puis-je publier une information sans la signer ?", a: "Oui — et c'est même la règle : une information n'est pas un acte. Elle ne se signe pas, ne se numérote pas, ne reçoit pas d'identifiant ELI, et ne suit aucun circuit de validation. Seuls les actes passent par la signature, la publication et l'exécution." },
          { q: "Une information change de titre : son adresse change-t-elle ?", a: "Non, pas après sa publication. L'adresse se déduit du titre **tant que le billet est un brouillon** ; dès qu'il est publié, elle ne bouge plus — un lien déjà partagé continue de mener au billet, même si vous retouchez le titre." },
          { q: "Peut-on préparer une information à l'avance ?", a: "Oui : écrivez le brouillon et donnez-lui sa **date**. Tant qu'il n'est pas publié, personne ne le voit ; le jour venu, publiez-le. C'est la date que vous avez saisie qui s'affiche et qui ordonne la rubrique." },
        ] },
        { t: "next", chapter: "execution", label: "Rendre l'acte exécutoire (formalités et délais)" },
      ],
    },
    // ------------------------------------ 5 quater : exécution & délais
    {
      id: "execution",
      title: "Rendre l'acte exécutoire (formalités et délais)",
      short: "Transmettre, publier, notifier : ce qui fait qu'un acte s'applique vraiment — et qui peut le contester.",
      icon: "warn",
      minutes: 7,
      audience: "all",
      keywords: "exécutoire exécution formalité transmission contrôle de légalité préfecture publication notification délai recours contentieux échéancier constater recours introduit requête greffe déféré attestation non-recours état des formalités pièce PDF",
      blocks: [
        { t: "p", text: "Un acte signé n'est pas encore **exécutoire** : il ne s'applique qu'une fois les formalités accomplies. Selon l'acte, il faut le **transmettre** au contrôle de légalité, le **publier** au recueil, ou **notifier** la personne concernée." },
        { t: "p", text: "L'écran **Exécution & délais** montre, pour chaque acte signé, ce qui reste à faire et jusqu'à quand il peut être contesté. C'est aussi là que l'on **note l'existence d'un recours** contre un acte, et que l'on **délivre les pièces** du dossier." },
        { t: "terms", items: [
          { term: "Transmission", def: "L'envoi au contrôle de légalité (préfecture, @ctes). C'est elle qui fait courir le délai de deux mois du représentant de l'État." },
          { term: "Certificat de transmission", def: "L'accusé de réception du contrôle de légalité, qui porte la mention « Transmis au contrôle de légalité le … à … ». Il est déposé sur le document." },
          { term: "Publication", def: "Le dépôt au recueil, qui rend l'acte opposable à tout le monde. Quand l'acte est publié depuis « Signature & publication », cette formalité se constate d'elle-même." },
          { term: "Notification", def: "L'envoi à la personne concernée. Indispensable pour un acte individuel (revalorisation, sanction), qui ne se publie pas." },
          { term: "Exécutoire", def: "La date à laquelle la dernière formalité requise est accomplie. C'est de cette date que part le délai de recours." },
          { term: "Délai de recours", def: "Deux mois, en principe, pour contester l'acte devant le juge. Passé ce délai, l'acte est définitif." },
          { term: "Recours introduit", def: "Un recours a réellement été déposé contre l'acte (requête au tribunal, recours gracieux, déféré du préfet). Sa **date d'introduction** ferme le délai : l'acte n'est plus « définitif », il est **contesté** jusqu'à la décision du juge." },
          { term: "État des formalités", def: "La pièce qui relève, formalité par formalité, ce qui a été fait, **quand**, sous quelle **référence** et par qui. Elle s'exporte en PDF pour **tout acte signé**." },
          { term: "Attestation de non-recours", def: "La pièce qui certifie qu'**aucun recours** n'a été porté à la connaissance de la collectivité contre un acte **définitif**. Elle se remet à un tiers qui en fait la demande." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Exécution & délais**, onglet **Formalités à accomplir**." },
          { text: "Cliquez sur l'acte dans la liste de gauche : ses formalités s'affichent, celles qui sont requises et celles qui sont déjà faites." },
          { text: "Cliquez sur **Enregistrer** au bas de la formalité, et renseignez la **date**, la **référence** (numéro d'accusé de réception, référence du recueil…) et, pour une notification, les **destinataires**." },
          { text: "Validez : l'acte devient **exécutoire** si c'était la dernière formalité requise, et l'écran indique la fin du délai de recours." },
        ] },
        { t: "stepscard", title: "Noter l'existence d'un recours", items: [
          "Ouvrez l'onglet **Recours** et cliquez sur l'acte (il y figure soit parce que le délai court encore, soit parce qu'un recours y est déjà noté).",
          "Cliquez sur **Enregistrer un recours** (ou **Un recours a été introduit**).",
          "Renseignez la **date d'introduction** — celle de la requête, ou de sa réception pour un recours gracieux —, la **nature** du recours, son **auteur**, sa **référence** et, au besoin, une **observation**.",
          "Validez : l'acte passe en **« Recours introduit »**, et ne pourra plus être attesté sans recours. La mention se **corrige** ou se **retire** par « Corriger la mention » (chaque geste est inscrit au journal).",
        ] },
        { t: "table", head: ["Pièce à délivrer", "Pour quel acte", "Ce qu'elle contient"], rows: [
          ["**État des formalités**", "tout acte signé, quel que soit son état", "le tableau des formalités : requise ou non, **date**, référence, modalité, auteur — puis le certificat de transmission s'il existe, et la situation (exécutoire, délai, recours)"],
          ["**Attestation de non-recours**", "un acte **définitif** que personne n'a contesté", "l'identité de l'acte, l'attestation qu'aucun recours n'a été porté à votre connaissance, les formalités qui l'ont rendu exécutoire, la date d'expiration du délai, et le bloc de signature de l'autorité"],
        ] },
        { t: "p", text: "Les deux pièces s'ouvrent dans un nouvel onglet : imprimez-les, ou enregistrez-les en PDF (**« Enregistrer au format PDF »** dans la fenêtre d'impression). Leur délivrance est inscrite au journal." },
        { t: "note", kind: "info", title: "Pourquoi c'est vous qui le déclarez", text: "L'application ne peut pas deviner qu'un courrier est parti, ni qu'une requête a été déposée. Chaque formalité — comme chaque recours — est donc une **constatation** : vous attestez la date et la référence, l'application l'horodate, l'inscrit à votre nom et la garde au dossier." },
        { t: "note", kind: "info", title: "Notifier l'intéressé par courriel", text: "Une notification se fait rarement par la poste seule. Quand la collectivité a branché l'envoi de courriels (l'administrateur le règle dans **Administration › Courriel**), l'étape de notification propose **« Envoyer l'acte à l'intéressé par courriel »** : vous indiquez l'adresse, et le message part par le **serveur de messagerie de la collectivité**. Chaque envoi est **tracé sur l'acte** — adresse, date, objet, et résultat. Attention : le courriel est un **moyen**, pas la preuve ; c'est toujours **vous** qui constatez la notification, avec sa date et sa référence. Un courriel qui n'a pas pu partir est tracé **« non envoyé »**, avec son motif, au journal et au dossier de l'acte : vous le voyez, et vous pouvez le renvoyer." },
        { t: "note", kind: "info", title: "Quand la transmission passe par l'API", text: "Si l'administrateur a activé la **télétransmission** (Administration › Expérimentale), la transmission ne se constate plus à la main : l'acte signé part vers l'**API d'envoi** du contrôle de légalité, qui accuse réception. Le **certificat de transmission** — « Transmis au contrôle de légalité le … à … », avec sa référence et son sceau — est alors déposé sur le document, et la formalité se constate d'elle-même. Si elle est activée, elle est **désactivée par défaut** et ne s'applique qu'aux actes signés après son activation.", },
        { t: "note", kind: "warn", title: "Retards et délais", text: "L'écran signale les transmissions et publications qui traînent, et les délais de recours qui se referment. Un acte **contesté** y est signalé à part : il ne se traite pas comme un acte dont le délai court encore. Le registre des actes rappelle aussi combien d'actes attendent une formalité." },
        { t: "faq", items: [
          { q: "Le délai est expiré : puis-je délivrer une attestation de non-recours ?", a: "Oui, si **aucun recours** n'est enregistré contre l'acte : c'est le bouton **Attestation de non-recours (PDF)** de la carte « Recours ». Si un recours a été introduit — même gracieux —, l'attestation ne peut pas être délivrée : elle certifierait le faux. L'application le vérifie et refuse de la produire." },
          { q: "Un recours a été classé ou retiré : que faire de la mention ?", a: "La mention reste au dossier : elle dit qu'un recours a existé, ce qui est un fait. Ouvrez **Corriger la mention** pour la compléter (l'issue du recours se note dans l'**observation**). Si la mention a été portée par erreur, **Retirez-la** : le geste est inscrit au journal." },
          { q: "Pourquoi l'état des formalités n'a-t-il pas la charte de mon acte ?", a: "Parce que ce n'est pas l'acte : c'est un écrit administratif de la collectivité. L'état et l'attestation portent donc l'**en-tête de l'entité**, sur le même papier A4, et non la feuille de style de l'acte." },
        ] },
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
      keywords: "registre actes historique rouvrir reprendre statut brouillon supprimer épingler punaise à la une recueil",
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
          "**📌 (épingler)** : met l'acte en avant dans la bande **« À la une »** du recueil public (voir le chapitre « Publier l'acte »). Le même bouton l'en retire. Ce bouton n'existe que pour un acte **publiable**, et seulement si vous en avez la permission.",
          "**🗑 (mettre à la corbeille)** : l'acte part à la **corbeille** (rien n'est perdu : on peut le restaurer, voir le chapitre suivant). Ce bouton n'existe que pour un **brouillon ou un acte prêt** : un acte signé ou publié ne s'efface pas, il s'**abroge** (voir le chapitre « Abroger un acte »).",
        ] },
        { t: "note", kind: "info", title: "Le registre de démonstration est déjà garni", text: "Sur une installation de démonstration, le registre contient plusieurs actes : des actes **déjà rédigés et signés** (leur signature est vérifiable), deux actes **prêts à signer** et un **brouillon** à compléter. Vous pouvez les ouvrir, les reprendre, les modifier ou les publier — et tout se passe comme si vous les aviez écrits." },
        { t: "note", kind: "warn", title: "Où vivent vos actes", text: "En **mode local** — le rangement par défaut, sans serveur raccordé —, ils sont enregistrés dans **ce navigateur**, sur **ce poste de travail** : ils ne sont donc pas sur un serveur commun. C'est pourquoi on exporte les actes importants — le fichier, lui, peut être copié, envoyé et archivé. Quand l'administrateur a branché l'application sur la **base partagée** de la collectivité, les actes sont au contraire rangés côté serveur et visibles depuis tous les postes." },
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
        { t: "note", kind: "warn", title: "Seuls les brouillons vont à la corbeille", text: "Un acte **signé** ou **publié** n'a plus le bouton corbeille : c'est une pièce du dossier, et un acte administratif publié ne s'efface pas — il s'**abroge**, par un acte nouveau qui le vise (voir le chapitre « Abroger un acte »). Le seul retrait possible pour un acte publié est un **retrait technique du recueil** (dépôt en double, erreur de dépôt), réservé aux administrateurs et soumis à un motif écrit." },
        { t: "steps", items: [
          { text: "Ouvrez **Corbeille** dans le menu de gauche." },
          { text: "Les actes et les trames supprimés y sont listés, avec la date de suppression et le nom de la personne qui les y a mis." },
          { text: "Cliquez sur **Restaurer** pour les remettre à leur place, ou sur **Supprimer définitivement** pour les effacer pour de bon." },
        ] },
        { t: "note", kind: "warn", title: "La suppression définitive est irréversible", text: "L'écran demande une confirmation, et l'effacement est inscrit au **journal** (Administration › Journal d'audit), avec son auteur et l'heure." },
        { t: "note", kind: "info", title: "Ce que voit le registre", text: "Les actes à la corbeille n'apparaissent plus dans le registre des actes, ni dans le parapheur, ni dans l'échéancier. Le registre en signale simplement le nombre, avec un lien vers la corbeille." },
        { t: "next", chapter: "modifier", label: "Modifier un acte déjà publié" },
      ],
    },
    // ------------------------------------ 6 quater : abroger un acte
    {
      id: "abrogations",
      title: "Abroger un acte, ou l'un de ses articles",
      short: "Faire cesser un acte de produire effet : la clause d'abrogation, son effet à l'entrée en vigueur, et ce que le recueil en montre.",
      icon: "x",
      minutes: 5,
      audience: "all",
      keywords: "abroger abrogation abrogé abrogée retirer retrait recueil article abrogé entrée en vigueur clause vieillissement remplacer caduc",
      blocks: [
        { t: "p", text: "Un acte peut cesser de produire effet sans être effacé : il est **abrogé**. L'abrogation se fait toujours par un **acte nouveau**, publié, qui **vise expressément** l'acte — ou l'article — qu'il abroge. C'est une règle de droit, et l'application la suit : rien ne disparaît, tout se lit." },
        { t: "note", kind: "warn", title: "Un acte publié ne se supprime pas", text: "Vous ne trouverez pas de bouton « corbeille » sur un acte signé ou publié : personne ne doit pouvoir douter de ce qui a été publié, ni quand. Le bouton des actes signés et publiés s'appelle **« Retirer / abroger »** (icône ✕) et propose de **rédiger un acte d'abrogation**. Seul un **retrait technique du recueil** — dépôt en double, erreur de dépôt — reste possible, pour les administrateurs, avec un motif écrit." },
        { t: "p", text: "**Deux chemins mènent à l'abrogation.**" },
        { t: "terms", items: [
          { term: "Depuis le registre", def: "Sur la ligne de l'acte, cliquez sur **✕ (Retirer / abroger)** : l'application vous dit ce que visera l'acte à rédiger, puis vous choisissez la **trame** qui le portera. La clause d'abrogation est alors prévue d'avance." },
          { term: "Depuis la rédaction", def: "Quand vous rédigez un acte, l'onglet **« Abrogations »** du panneau de droite permet de prévoir, dans le texte même de l'acte, l'abrogation d'un autre acte du registre — ou d'un seul de ses articles." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez l'onglet **« Abrogations »** du panneau de droite, pendant la rédaction, et cliquez sur **Prévoir une abrogation**." },
          { text: "Choisissez l'objet : **un acte du registre**, **un article d'un acte du registre**, ou **un acte qui n'est pas dans l'application** (il se vise alors par son texte)." },
          { text: "Désignez l'acte dans la liste — c'est sa **désignation exacte** (nature, numéro, date) que la clause reprendra. Le panneau montre en dessous la phrase qui figurera dans l'acte.", detail: "Un acte du registre se vise **expressément** : l'application sait de quoi il s'agit, et pourra appliquer l'abrogation le jour venu. Un acte qu'elle ne connaît pas ne peut être visé que par un texte libre — elle ne pourra pas le marquer abrogé." },
          { text: "Au besoin, **réécrivez la clause** : le champ « Réécrire la clause » remplace la phrase type, et vous pouvez aussi corriger la clause directement dans le document.", detail: "Un article d'abrogation apparaît alors en fin de dispositif, juste avant le bloc de signature : « **L'arrêté n° … du … est abrogé à compter de l'entrée en vigueur du présent arrêté.** »" },
        ] },
        { t: "note", kind: "info", title: "L'effet court de l'ENTRÉE EN VIGUEUR, pas de la publication", text: "C'est ce que dit la clause, et c'est ce que fait l'application. L'entrée en vigueur d'un acte, c'est la **date d'effet** qu'il déclare ; à défaut, le lendemain de sa publication (ou le délai réglé dans Administration › Publication). Tant que ce jour n'est pas arrivé, l'abrogation est **annoncée** sans être opposable ; le jour venu, l'application l'applique : l'acte visé **dans son ensemble** reçoit sa marque d'abrogation au registre, un **article** visé donne lieu à une **version consolidée** de son acte — comme le ferait un acte modificatif — qui part à la publication." },
        { t: "note", kind: "warn", title: "Abroger un acte qui ADOPTE une annexe", text: "La réponse dépend de l'annexe, et elle est simple. Une annexe qui **n'a pas de publication autonome** — un tableau, une grille tarifaire — est une partie de la décision qui l'adopte : elle est **abrogée avec elle**, sans qu'aucune clause n'ait à la viser. Une annexe **publiée à part** — un règlement — vit sa propre vie : l'abrogation de sa décision d'adoption **ne l'emporte pas**. Elle reste en vigueur, et l'application vous le **signale** : d'abord dans le panneau des abrogations, au moment où vous choisissez l'acte visé, puis sur la fiche de l'acte que vous avez publié. Pour retirer ou modifier un règlement, il faut un **acte autonome** qui l'abroge ou l'adopte à nouveau." },
        { t: "note", kind: "info", title: "Ce que le registre en dit", text: "Un acte abrogé porte, à côté de son statut, un badge **« abrogé »** (ou **« abrogation prévue »** tant que l'effet n'est pas acquis) ; sa fiche l'explique en tête, avec l'acte qui l'a abrogé, sa date, et la date d'effet. Survolez le badge pour lire la phrase entière." },
        { t: "note", kind: "info", title: "Abroger un acte ENTIER depuis une modification", text: "Quand vous **modifiez** un acte (voir le chapitre précédent), le panneau de droite propose **« Abroger tout l'acte »** : l'acte modificatif abrogera alors tous les articles, et la version consolidée le dira (« L'acte est abrogé dans son ensemble »). C'est l'abrogation par voie de modification ; l'onglet « Abrogations » de la rédaction, lui, sert aux abrogations qu'un acte prévoit pour un **autre** acte." },
        { t: "note", kind: "info", title: "Le recueil public et les articles abrogés", text: "Sur l'espace en ligne, un acte se lit toujours dans sa **version la plus récente**. Un article abrogé garde son intitulé — la numérotation continue d'en dépendre — et la mention de l'acte qui l'a abrogé, mais sa **rédaction** ne s'affiche pas : une case **« Afficher les articles abrogés »**, en tête de l'acte, la révèle (barrée, comme une pièce d'archive). Sur la page des actes publiés, la liste présente chaque acte **une seule fois**, dans sa rédaction en vigueur ; une case discrète, dans les filtres, fait réapparaître les **versions antérieures** lorsqu'il y en a." },
        { t: "faq", items: [
          { q: "J'ai abrogé un acte, mais il est encore dans le recueil public. Est-ce normal ?", a: "Oui. Un acte publié reste au recueil — c'est la trace de ce qui a été publié. Ce qui change, c'est son **état** : il est marqué abrogé, et l'acte qui l'abroge, lui aussi publié, porte la clause. Le retrait pur et simple du recueil n'est pas la voie de l'abrogation : il est réservé aux erreurs techniques de dépôt." },
          { q: "Puis-je abroger un article dont je ne connais pas le numéro ?", a: "Ouvrez le panneau « Abrogations » et choisissez **« un article d'un acte du registre »** : l'application liste les articles de l'acte choisi, avec leur intitulé. Vous désignez l'article dans la liste — le numéro est repris pour vous." },
          { q: "L'acte visé n'est pas dans l'application. Que faire ?", a: "Choisissez **« un acte qui n'est pas dans l'application »** et écrivez sa désignation (« l'arrêté préfectoral n° 12-345 du 3 mars 2019 »). La clause sera juste, mais l'application ne pourra pas marquer cet acte comme abrogé : elle ne le connaît pas." },
          { q: "Un article abrogé peut-il reprendre du service ?", a: "Non : un article abrogé ne se rétablit pas. S'il faut de nouveau cette règle, elle revient par un **acte nouveau** — ou par une modification qui insère un article, éventuellement sous un autre numéro." },
        ] },
        { t: "next", chapter: "mots", label: "Glossaire : les mots employés ici" },
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
        { t: "next", chapter: "annexes", label: "Adopter une annexe (règlement, tableau…)" },
      ],
    },
    // ------------------------------------------- 6 ter : adopter une annexe
    {
      id: "annexes",
      title: "Adopter une annexe (un règlement, un tableau…)",
      short: "Un document adopté par un autre : il n'a pas de numéro et ne se signe pas — son texte suit l'acte qui l'adopte. Comment on le rédige, et comment il se modifie.",
      icon: "doc",
      minutes: 6,
      audience: "all",
      keywords: "annexe annexer adoption adopter règlement intérieur tableau grille tarifaire délibération visa suivre l'acte nouvelle rédaction suivi des modifications pas de signature pas de numéro numéro propre réimporter import akoma ntoso règlement normatif texte normatif publication informative à part autonome recueil eli reg code autorité mention publication visas",
      blocks: [
        { t: "p", text: "Un certain nombre de documents n'existent pas par eux-mêmes : un **règlement intérieur** est adopté par une délibération, une **grille tarifaire** par une décision. Le document adopté **n'a pas de numéro propre** : rien ne l'identifie que la **décision qui l'adopte** (celle qui en adopte la nouvelle rédaction, ou celle qui l'abroge). Et il **ne se signe pas** : c'est l'**acte qui l'adopte** qui est signé, et l'original de cet acte est **suivi du texte de l'annexe**, dans le même document. C'est cette signature-là qui donne à l'annexe son autorité et sa place au recueil." },
        { t: "p", text: "L'application connaît ce lien, dans les deux sens : l'annexe **rappelle l'acte qui l'adopte**, et l'acte qui adopte **annonce ses annexes** — puis les donne à lire, à la suite de sa signature." },
        { t: "terms", items: [
          { term: "L'annexe", def: "Le document adopté (le règlement, le tableau). Sa trame est de nature **Annexe** — c'est ce que les administrateurs règlent dans l'éditeur de trame, onglet « Trame », champ « Nature du document ». Son atelier ne demande donc **ni numéro ni signataire** : elle s'identifie par la décision qui l'adopte, et son document ne porte pas de bloc de signature." },
          { term: "L'acte d'adoption", def: "La délibération, l'arrêté, la décision qui adopte l'annexe. C'est un acte ordinaire, qui suit son chemin habituel : rédaction, signature, publication — et c'est son original signé qui porte le texte de l'annexe." },
          { term: "Le visa d'adoption", def: "La phrase posée en tête des visas de l'annexe : « Vu la délibération n°… du …, qui l'adopte ». Elle est écrite par l'application, à partir de l'acte que vous avez désigné." },
        ] },
        { t: "steps", items: [
          { text: "**Rédigez d'abord l'acte d'adoption** — la délibération —, comme n'importe quel acte, et **enregistrez-le**.", detail: "C'est lui que l'annexe désignera. Il n'a pas besoin d'être signé : il suffit qu'il existe au registre." },
          { text: "**Rédigez l'annexe** : choisissez un modèle de nature « Annexe » et cliquez sur « Rédiger ».", detail: "S'il n'en existe pas encore, un administrateur la crée depuis l'éditeur de trame (onglet « Trame » : « Nature du document » → « Annexe »)." },
          { text: "Dans le panneau de droite, carte **« Annexe »**, désignez **l'acte d'adoption**.", detail: "L'application écrit alors le visa : « Vu la délibération n°… du …, qui l'adopte », en tête des visas du règlement. Laissez vide tant que l'adoption n'est pas décidée : l'annexe se rédige très bien sans." },
          { text: "**Rattachez l'annexe à l'acte** (facultatif mais utile) : ouvrez la délibération en rédaction, carte **« Annexes »**, bouton **« Joindre une annexe »**.", detail: "L'acte annonce alors, à la fin de son dispositif, les documents qu'il annexe — par leur intitulé — et **son texte suit l'acte à la suite de la signature**. C'est ce qui les rend trouvables depuis l'acte." },
          { text: "**Signez et publiez l'acte d'adoption.** L'annexe n'a rien à signer.", detail: "C'est l'original signé de la délibération qui comprend le texte du règlement : vous le voyez dans « Voir l'original signé », et la version publiée au recueil le porte aussi. Une annexe ordinaire ne se publie pas pour elle-même — le service le refuserait." },
        ] },
        { t: "note", kind: "info", title: "Ce que dit la fiche de l'acte", text: "La fiche d'une annexe porte un encart **« Annexe »** : « Ce document est adopté par … », avec un lien vers la fiche de l'acte d'adoption. La fiche de la délibération, elle, porte l'encart **« Documents annexés »**. Vous passez ainsi de l'un à l'autre d'un clic." },
        { t: "note", kind: "info", title: "Une annexe ne se retrouve pas dans la file du signataire", text: "L'écran **Signature** affiche les annexes avec l'étiquette « **Annexe — ne se signe pas** » — jamais « prêt à signer » —, et l'onglet **Ma signature** ne les liste jamais : leur présence laisserait croire à un geste en attente. C'est l'**acte d'adoption** qui figure dans la file, et c'est lui qu'on signe. Le **fil de parcours** d'une annexe le dit à sa façon : *Rédaction → Adoption par l'acte → Publication informative* (pour un règlement), sans signature ni révision." },
        { t: "note", kind: "info", title: "Un RÈGLEMENT se consulte aussi à part, au recueil", text: "Un **règlement intérieur**, un **règlement d'usage** n'est pas un simple tableau : c'est un texte **normatif**, qui fait droit **par lui-même** — comme un **code**, il se consulte pour lui-même, sans passer par la délibération qui l'a adopté. L'administrateur peut donc le déclarer **Règlement** sur sa trame (onglet « Trame », case **« C'est un RÈGLEMENT : le publier aussi à part, au recueil »**) : à la publication de l'acte qui l'adopte, le règlement est déposé **aussi** au recueil public, sous **son propre identifiant** (par exemple `eli:/fr/reg/2026/0418/vsl`), à titre **informatif** — seul le texte adopté fait foi, et c'est la décision d'adoption qui le porte. Il se cherche et se classe par thème comme les actes, et son identifiant s'ouvre directement. Sa page ne mentionne ni « publié le », ni opposabilité, ni original signé : elle dit sa nature, son identifiant, sa date et l'acte qui l'adopte. Une **grille tarifaire** ou un **tableau**, à l'inverse, reste la partie annexée de son acte et rien d'autre." },
        { t: "note", kind: "info", title: "Le règlement se met à jour au recueil, comme un acte", text: "Le drapeau **Règlement** se pose sur la **trame**, une fois pour toutes : tous les actes issus de cette annexe, et toutes leurs rédactions successives, se publient de la même façon. À chaque publication de l'acte qui l'adopte (ou qui en adopte la nouvelle rédaction), la **version en vigueur** du règlement est redéposée sous le **même identifiant**, comme les versions successives d'un acte sous son ELI : le lecteur qui suit l'identifiant voit toujours la dernière rédaction, et l'historique des versions reste accessible." },
        { t: "note", kind: "warn", title: "Une annexe ne se modifie pas comme un acte ordinaire", text: "On ne réécrit pas un article d'un règlement intérieur par un « l'article 3 est remplacé par… » comme on le ferait d'un arrêté. L'usage est que l'acte modificatif **adopte la nouvelle rédaction** de l'annexe : il dit « Est adoptée la nouvelle rédaction du règlement intérieur…, telle qu'elle résulte des modifications suivantes », et le texte, présenté avec ses ajouts et ses suppressions apparents, **suit l'acte modificatif signé**." },
        { t: "note", kind: "info", title: "Comment on la modifie, en pratique", text: "Ouvrez l'annexe et cliquez sur **« Modifier l'annexe »**. L'écran « Modifier » s'ouvre avec le bon régime déjà choisi : la case **« Modification par adoption (suivi des modifications) »** est cochée. Modifiez le texte directement dans la page, puis **Générer les deux actes** : l'application produit l'acte d'adoption de la nouvelle rédaction et la version à jour de l'annexe. La fiche de l'annexe retient alors l'acte qui vient de l'adopter." },
        { t: "note", kind: "info", title: "Sauf mention expresse", text: "Il arrive qu'une décision vise **expressément** tel article de l'annexe (« l'article 12 du règlement intérieur est remplacé par… »). Décochez alors la case : l'application produit une modification **classique**, article par article. Les deux voies coexistent, et c'est le rédacteur qui choisit." },
        { t: "note", kind: "info", title: "Réimporter un acte d'adoption", text: "Un fichier Akoma Ntoso d'acte d'adoption est **suivi du texte de ses annexes** — c'est ainsi qu'il a été exporté. À l'import, l'application vous le **signale**, mais elle ne le rattache pas d'elle-même : une annexe reste, ici, un acte à part, joint depuis le registre. Importez l'annexe (ou retrouvez-la au registre) et rattachez-la à l'acte d'adoption — son texte suivra de nouveau l'original signé." },
        { t: "next", chapter: "mots", label: "Glossaire : les mots employés ici" },
      ],
    },
    // ------------------------------------------------------------------ 7
    {
      id: "administrateurs",
      title: "Préparer et faire évoluer une trame",
      short: "Pour les administrateurs et les éditeurs : l'éditeur de trame, les commentaires qui ne se perdent plus, et le choix du signataire par sa fonction.",
      icon: "gear",
      minutes: 7,
      audience: "admin",
      keywords: "administrateur éditeur trame éditeur de trame bloc champ règle commentaire service auteur version publier base de données mysql mariadb partagé multi-poste serveur persistance importer export exemple json modèle fichier format qualité signataire fonction rôle choisir signataire genre accord délégation subdélégation maire adjoint arbre décision pouvoir fondement visa liste puces numérotée numérotation énumération numérotation numéro séquence tableau lignes colonnes cellule légende quadrillé zébré encadré alinéa retrait alignement formule considérant ponctuation externe grist api clé jeton relais division livre titre chapitre section partie hiérarchie échelon nature annexe adoption word docx odt libreoffice document importer conversion relire brouillon brouillons mise à disposition mettre à disposition publier retirer visible invisible disponible recueil recueils extérieurs renvoi renvois recueil bis recueil inactif légifrance service-public vous ne trouvez pas",
      blocks: [
        { t: "p", text: "Ce chapitre s'adresse aux collègues — administrateurs **et éditeurs** — qui écrivent et mettent à jour les modèles. Les autres peuvent passer au glossaire." },
        { t: "p", text: "Une trame se fabrique dans l'**éditeur de trame** : depuis la liste, cliquez sur « Ouvrir l'éditeur » sur la carte du modèle. L'écran est divisé en trois colonnes." },
        { t: "shot", shot: "editor" },
        { t: "terms", items: [
          { term: "À gauche : le plan et la réserve", def: "Le plan : la liste des morceaux du document (intitulé, visas, articles, signature…). Cliquez-en un pour le régler à droite, ou attrapez-le pour le déplacer. **Dessous, la réserve** : tout ce qui peut être inséré — vos questions, les renseignements que l'application remplit seule, et les morceaux de document." },
          { term: "Au centre : la page", def: "Le document tel qu'il sera imprimé. Cliquez directement dans le texte pour le corriger, et **glissez-y les éléments de la réserve** à l'endroit exact où ils doivent aller." },
          { term: "À droite : l'inspecteur", def: "Les réglages de ce qui est sélectionné, en cinq onglets : « Ce bloc », « Commentaires » (tout ce que la trame porte comme explications), « Questions » (ce qui sera demandé au rédacteur), « Contrôles » et « Trame »." },
        ] },
        { t: "steps", items: [
          { text: "Pour **ajouter un morceau**, prenez-le dans la réserve — groupe « Ajouter un bloc », à gauche — et **glissez-le dans la page**.", detail: "Un trait bleu montre où il se posera : au-dessus ou au-dessous du morceau survolé, selon l'endroit où vous lâchez. Vous pouvez aussi cliquer le petit **+** placé entre deux blocs : un menu s'ouvre et le morceau s'insère exactement là. Pour le ranger ensuite, **attrapez le morceau lui-même** — sa poignée ⠿, son intitulé, sa marge : tout le bloc se saisit, sauf son texte (un appui dans le texte y place le curseur). Faites-le glisser, ou servez-vous des flèches ↑ ↓." },
          { text: "Pour **poser une question au rédacteur**, créez-la dans l'onglet « Questions », puis **glissez son nom dans le texte**.", detail: "Un champ est un trou dans la phrase : « Arrêté n° ⬤ du ⬤ portant ⬤ » — l'agent le remplira. Si le glisser vous paraît difficile, **cliquez** le nom du champ puis **cliquez dans le texte** : le résultat est identique. Une bande bleue « Cliquez dans le document à l'endroit où insérer… » vous rappelle où vous en êtes, et le bouton « Annuler » interrompt le geste." },
          { text: "Pour **corriger un texte**, cliquez dedans et écrivez.", detail: "Les pastilles bleues sont des **champs** : elles seront remplacées par ce que le rédacteur saisira. Les filtres `|date-long`, `|money`… mettent la valeur en forme." },
          { text: "Pour une **liste**, choisissez « À puces » ou « Numérotée » dans l'inspecteur.", detail: "Un bloc de liste s'insère et se remplit comme un paragraphe, et **chaque élément s'ajoute et se retire dans la page** : survolez une ligne, le « + » insère l'élément suivant, la corbeille les retire. Une fois la liste sélectionnée, l'inspecteur propose son **genre**, sa **marque** — la puce, ou la numérotation « 1° 2° 3° », « a) b) c) »… — et son **numéro de départ**. Laissez « comme la feuille de style » pour suivre la charte (Feuilles de style, rubrique « Listes ») : ce réglage vaut pour toutes les listes. Choisissez une marque pour faire exception, sur cette liste-là seulement." },
          { text: "Pour un **tableau**, cliquez dans ses cases et écrivez.", detail: "Un tableau ne se dessine pas à la main : il se remplit. Chaque case s'écrit directement dans la page ; la gouttière posée à droite de chaque ligne, et les boutons de la ligne d'en-tête, **insèrent ou retirent une ligne ou une colonne** — et la barre sous le tableau en ajoute une à la fin. L'inspecteur donne en plus la **grille complète**, une case par cellule, pour déplacer une colonne ou une ligne : c'est plus commode quand le tableau est large. Rien de ces commandes n'est imprimé : elles ne font pas partie de l'acte. La **légende** (au-dessus ou au-dessous), la **ligne d'en-tête**, le **dessin** (quadrillage, lignes horizontales seules, lignes alternées) et l'**alignement des cellules** se règlent dans l'inspecteur." },
          { text: "Pour **mettre en forme un paragraphe**, ouvrez son onglet « Ce bloc » : alignement, retrait, encadré.", detail: "« Comme la feuille de style » laisse la charte décider — c'est le cas de tous les paragraphes qui ne demandent rien. Un choix explicite — centré, fer à droite, alinéa, paragraphe entier en retrait, encadré — ne s'applique qu'à **ce paragraphe-là**." },
          { text: "Pour des **considérants**, réglez la formule une fois pour toutes.", detail: "Écrivez « Considérant que » dans **« Formule placée devant chaque considérant »** : chaque considérant n'écrit alors que sa substance, et la formule se pose devant à l'impression — sans jamais se répéter sur un considérant qui la porte déjà. Le même onglet règle leur **ponctuation finale** (« ; », « . ») et leur disposition, **un par paragraphe ou tous suivis**. La formule et la ponctuation s'affichent déjà dans l'aperçu, en gris : elles s'ajoutent à la lecture, pas à votre texte." },
          { text: "Pour **expliquer une règle**, commentez le passage concerné : cliquez le petit bouton **commentaire** posé sur le morceau (à droite, dans sa barre d'outils), ou — pour viser une phrase précise — **sélectionnez-la** dans la page : une pastille « Commenter » apparaît, et le commentaire **cite** le passage choisi.", detail: "Choisissez la nature : contrainte juridique, consigne de rédaction, point à arbitrer ou veille normative. Le commentaire est **signé du service** de votre compte (le vôtre, pas votre nom). Il s'affiche **dans la page, sous le morceau qu'il vise** — un fond coloré et un filet pointillé le distinguent du texte de l'acte —, un **repère bleu numéroté** marque le morceau dans la marge, et l'onglet **« Commentaires »** les rassemble tous, rangés par morceau. Vous ne pouvez donc plus les manquer, et eux non plus ne disparaissent plus comme un commentaire Word : ils partent dans les exports." },
          { text: "Pour **empêcher un oubli**, ouvrez l'onglet « Questions », dépliez « Réglages avancés » sur la question concernée, et cochez « Réponse obligatoire ».", detail: "Le rédacteur est averti, et l'export est bloqué tant que la case est vide." },
          { text: "Pour rendre un paragraphe **facultatif**, remplissez « Condition d'affichage » dans l'inspecteur.", detail: "Le bloc n'apparaîtra que si la condition est vraie — par exemple seulement pour une régie de recettes." },
          { text: "Pour **préparer vos trames en amont** (éditeur de texte, script, hors ligne), cliquez sur « Fichier d'exemple » : le JSON téléchargé documente chaque clé et se réimporte tel quel, via « Importer une trame ».", detail: "Un fichier peut contenir une trame ({ \"trame\": {…} }), plusieurs trames ({ \"trames\": [ {…}, {…} ] }), ou directement une trame. Seuls « name » et « body » sont obligatoires ; les identifiants sont régénérés à l'import. Les erreurs de format sont listées avant tout import, et les points corrigés automatiquement (type inconnu, valeur par défaut) sont signalés." },
          { text: "Vous avez déjà le modèle sous forme de **document Word ou LibreOffice** ? Importez-le : bouton « Importer une trame », puis choisissez le fichier `.docx` ou `.odt`.", detail: "L'application **relit le document** et en propose une trame : intitulé, autorité, visas, considérants, formule d'édiction, articles, listes, tableaux, mention de recours et signature sont reconnus — et le numéro, la date et l'objet du document d'origine deviennent des **questions** ({{numero}}, {{dateSignature}}, {{objet}}), ce qui fait d'un document daté un modèle réutilisable. **Rien n'est enregistré à ce stade** : la trame s'ouvre dans l'éditeur, précédée d'une bande bleue qui le rappelle, et c'est vous qui décidez — « Enregistrer la trame » l'ajoute au registre, « Abandonner l'import » la jette. Avant l'ouverture, une fenêtre liste les **points à vérifier** : ce que la relecture a décidé, et ce qu'elle n'a pas su faire." },
          { text: "Quand la trame est prête, **mettez-la à disposition** des services.", detail: "Relisez-la d'abord — texte, questions, contrôles, commentaires — et mettez à jour sa **version**. Le bouton « Mettre à disposition » (sur sa carte, en tête de l'éditeur, ou dans l'onglet « Trame » au champ « Statut ») l'ouvre alors aux services de son périmètre ; jusque-là, elle n'était visible que de l'atelier. Pour la refermer le temps d'une correction, le bouton « Retirer » la rebascule en brouillon — les actes déjà rédigés à partir d'elle ne sont pas touchés. Exportez-la en JSON si vous voulez la transmettre : le fichier se réimporte, avec ses trames, sur un autre poste." },
        ] },
        { t: "note", kind: "info", title: "Vos commentaires guident le rédacteur", text: "Un commentaire ne reste pas dans l'atelier : **le rédacteur le voit**, dans son document, sous le passage concerné (encadré « Consigne de la trame »), et l'onglet **« Consignes »** de sa rédaction les rassemble tous, avec le lien qui mène au passage. C'est ce qui remplace les conseils qui se perdaient dans les commentaires d'un fichier Word — sauf qu'ici, personne ne peut les manquer, et qu'ils ne sont **jamais publiés** avec l'acte." },
        { t: "note", kind: "info", title: "Un texte long : les divisions (livre, titre, chapitre, section)", text: "Un règlement, un code, un long arrêté ne se composent pas seulement d'articles : ils se rangent en **Livres, Titres, Chapitres, Sections**. Prenez **« Division »** dans la réserve de blocs et glissez-la dans la page : elle se place au premier échelon, contient des articles et d'autres divisions (une division se glisse **dans** une autre), et se règle dans l'inspecteur — l'« Échelon » qu'elle occupe, la façon de la numéroter, et son intitulé. C'est l'onglet **« Trame »** qui porte l'**échelle** de la trame : le nombre d'échelons, le **mot imprimé** de chacun (« Livre », « Titre », « Partie », « Chapitre liminaire », « Section »…) et sa **numérotation** (chiffres romains, arabes, lettres, ou rien). Une trame qui n'y touche pas suit l'échelle livrée — Livre, Titre, Chapitre, Section. L'intitulé et les numéros se composent **tout seuls** dans le document : « Livre Ier », « Titre Ier », « Titre II », « Livre II »…, un nouvel échelon remettant à zéro ceux qui le suivent." },
        { t: "note", kind: "info", title: "Une trame d'annexe (un document adopté par un autre)", text: "Le champ **« Nature du document »** de l'onglet « Trame » distingue deux familles. Ce qui **fait droit** : un **Acte** (une décision qui vit par elle-même) et une **Annexe** (un document adopté par un autre) — le règlement intérieur adopté par une délibération, la grille tarifaire adoptée par une décision. Et ce qui **se publie sans faire droit** : le **Verbatim d'assemblée**, la **Déclaration** et le **Vœu** — trois documents que la collectivité publie au recueil, mais qui ne sont ni opposables ni exécutoires (voir le chapitre « Publier l'acte »). Une annexe ne se signe ni ne se publie pour elle-même : c'est l'acte qui l'adopte qui est signé, et son texte suit cet acte. Les actes issus d'une trame d'annexe ne se modifient pas comme les autres : leur fiche propose « **Modifier l'annexe** », et l'acte modificatif en adopte la nouvelle rédaction. Une case apparaît alors, **« Rappeler l'acte d'adoption dans les visas »** (cochée) : c'est elle qui pose, en tête des visas de l'annexe, la phrase qui cite l'acte adoptant. Une seconde case, **« C'est un RÈGLEMENT : le publier aussi à part, au recueil »**, ne concerne que les annexes **normatives** (un règlement intérieur, un règlement d'usage) : cochée, elle fait **publier l'annexe à part au recueil, à titre informatif**, sous son propre identifiant, à chaque publication de l'acte qui l'adopte — son texte se consulte alors pour lui-même, comme un code. Laissez-la décochée pour un tableau, une grille tarifaire. Le chapitre **« Adopter une annexe »** décrit le travail du côté du rédacteur." },
        { t: "note", kind: "info", title: "Déclarer une trame non publiable", text: "Dans l'onglet « Trame », la case **« Publiable au recueil des actes administratifs »** est cochée par défaut. Décochez-la pour les trames qui produisent des **actes individuels** (revalorisation d'un traitement, sanction disciplinaire, décision nominative…). Les actes issus de ces trames sont alors rédigés, signés et conservés au registre, mais **jamais** déposés au recueil : le service refuse leur publication, même signés. Réservez cette déclaration aux actes que le droit ne soumet pas à publicité ; la déclaration vaut aussi pour les actes déjà rédigés à partir de la trame." },
        { t: "note", kind: "info", title: "La qualité du signataire s'accorde en genre", text: "Au bas de l'acte, la qualité vient du **rôle** du signataire, accordée au genre de la personne : « Le maire » ou « **La maire** », « Le directeur général des services » ou « **La directrice générale des services** ». Chaque rôle porte donc ses deux formes (Administration › Rôles), et l'accord se règle **au cas par cas** sur la fiche de la personne (Administration › Personnes › Accord) : une femme maire peut tenir à être appelée « le maire ». Le document n'imprime que la qualité accordée et le **Prénom Nom** du signataire — la civilité n'y figure pas." },
        { t: "note", kind: "info", title: "Le signataire se choisit par la FONCTION, jamais par son nom", text: "Au moment de désigner qui signera l'acte, l'application ne propose pas un annuaire de noms : elle demande d'abord la **fonction** — la qualité qui donne compétence pour signer — puis, **parmi les personnes qui la tiennent**, celle qui signe. Les fonctions proposées viennent du référentiel : les **rôles** (Administration › Rôles : « Maire », « Adjoint au maire », « Directeur général des services »…) et les **délégations de signature** (écran **Délégations** : « adjoint au maire en charge de l'urbanisme », « chef de bureau Urbanisme »…). Seules apparaissent les fonctions qui ont du sens **pour cet acte** : une délégation donnée dans le nom d'une autre organisation ne s'affiche jamais, et une délégation limitée à une famille ou à un type d'acte ne s'affiche que sur ces actes. Quand une fonction ne peut être tenue que par une personne — le cas d'une délégation —, celle-ci est retenue d'office ; quand plusieurs personnes la tiennent (deux adjoints, par exemple), c'est au rédacteur de désigner qui signe. Dans l'**éditeur de trame**, la question du signataire peut porter une **« Fonction attendue »** : le modèle fixe alors la qualité — « Maire » pour un arrêté portant délégation de signature, par exemple — et le rédacteur n'a plus qu'à désigner qui la tient. Rien n'est bloqué : le rédacteur peut toujours écarter cette fonction, et le signataire déjà retenu sur un acte reste proposé même s'il n'a pas la qualité attendue." },
        { t: "note", kind: "info", title: "Délégations et subdélégations de signature", text: "Quand une autorité délègue sa signature — et que le délégataire sous-délègue à son tour, par dérogation — l'acte doit dire par quel chemin la compétence est venue. Réglez l'arbre dans l'écran **Délégations** : chaque délégation nomme un délégant, un délégataire, la qualité sous laquelle il signe, l'**organisation** dans le nom de laquelle elle est donnée, et facultativement la **famille** et le **type d'acte** visés. L'acte signé au bout de la chaîne porte alors toutes les qualités traversées : « Le Maire, / Par délégation, l'adjoint au maire en charge de l'urbanisme, / Par subdélégation, le chef de bureau Urbanisme, / Karim BENALI ». Seul le **nom du signataire** s'imprime : les qualités des étages intermédiaires sont écrites, jamais les noms de ceux qui les portent. Le rédacteur **voit la chaîne sous le champ « Signataire »** au moment de le choisir. **Désigner quelqu'un dans cet organigramme lui attribue la qualité de Signataire** (au délégant comme au délégataire), sans passer par « Comptes et rôles » : c'est cette qualité qui ouvre à l'intéressé l'onglet **« Ma signature »** et son **champ de compétence** — les actes dont sa signature relève. La désignation peut être faite par un **éditeur** comme par un administrateur." },
        { t: "note", kind: "info", title: "Les décisions qui fondent la signature sont visées d'elles-mêmes", text: "Chaque étage d'une chaîne de délégations tient son pouvoir de **décisions** : l'autorité de tête, d'une seule — celle qui lui a donné son pouvoir, la délibération du conseil pour le maire par exemple ; un **délégataire**, de **deux** — la décision de **nomination** qui l'a nommé à sa fonction, et la décision de **délégation** qui lui a donné le droit de signer. La première se renseigne sur la **fiche de la personne** (Administration › Personnes, « Décision fondant son pouvoir de signer ») ; les deux autres, sur chaque **délégation** (écran **Délégations**, fiche du délégataire, « Les décisions fondant la signature »). Chacune se désigne d'un **acte publié au recueil** (le lien est celui du recueil en ligne), d'un **lien externe** (un texte qui vit ailleurs), ou d'une **référence du référentiel** qui porte son adresse. Un signataire ne se configure pas sans ses deux décisions : « Créer la délégation » les refuse tant qu'il en manque une. Lorsqu'une trame appelle, dans ses visas, « les décisions fondant la signature », l'acte les imprime **dans l'ordre — la nomination avant la délégation, à chaque étage** : un acte signé par subdélégation vise ainsi la délibération qui a donné son pouvoir au maire, puis, pour chaque étage, la nomination et la délégation. Chaque visa porte son **lien cliquable**, sur le web comme en PDF. Rien n'est visé pour un acteur dont une décision n'est pas renseignée ; on vérifie la série sous le champ « Signataire » et sous chaque délégation de l'arbre, sans rédiger d'acte pour voir." },
        { t: "note", kind: "info", title: "Les établissements autonomes ont leur propre chaîne", text: "Toutes les chaînes ne descendent pas du maire. Un **établissement public** — un office, un centre de gestion, un syndicat — a sa propre autorité de tête, le **président de son conseil d'administration**, et sa propre chaîne de délégations, indépendante de celle de la commune : une délégation donnée dans le nom d'un établissement ne s'applique **qu'aux actes de cet établissement**. C'est le rattachement de chaque délégation à son **organisation** qui garantit cette indépendance, même quand une même personne tient des délégations des deux côtés. La formule d'autorité de l'entité (Administration › Entités) peut porter le jeton `{qualite}` : il est alors remplacé par la qualité de l'autorité de tête de l'établissement — « Le Président du conseil d'administration de l'office … »." },
        { t: "note", kind: "info", title: "Le numéro peut venir d'un autre logiciel", text: "Par défaut, l'application tient la **séquence** des numéros : le rédacteur réserve le suivant. Une collectivité qui numérote déjà ailleurs — un document **Grist**, un tableur en ligne, un référentiel interne — peut faire **attribuer le numéro par ce service** : c'est le réglage « Attribution du numéro » de **Administration › Numérotation**. L'application demande alors le numéro au moment de rédiger (le bouton devient « Demander le numéro »), et **la ligne créée chez le service fait foi** : sa référence est conservée sur l'acte et au journal. Le réglage porte l'adresse de l'API, l'authentification, le corps de la requête et l'endroit où lire la réponse ; un bouton **« Tester l'appel »** permet de l'éprouver — attention, un essai crée réellement une ligne, donc consomme un numéro. Deux points à connaître : la **clé d'API est conservée dans le référentiel** (donc dans les sauvegardes : prenez une clé restreinte au strict nécessaire), et l'appel passe par le **relais** de l'hébergement, car un navigateur ne peut pas appeler Grist directement." },
        { t: "note", kind: "info", title: "Rien de figé dans le code", text: "Entités, personnes, rôles, références, mentions, vocabulaire de rédaction, numérotation, **circuits de validation** (Administration › Circuits de validation), **délais** (Administration › Exécution & délais) et **recueil** (Administration › Publication : titre du recueil, publication automatique après signature, règle d'opposabilité, les **recueils extérieurs et renvois** du bas de page public, les **mentions légales et d'accessibilité** de ce même bas de page, l'**apparence du site public** et son accès) : tout se règle dans **Administration**. On y change une formule de recours, un type d'acte, ou l'ordre des visas à obtenir sans toucher à l'application." },
        { t: "note", kind: "info", title: "Restreindre l'atelier à un réseau (liste d'adresses)", text: "L'espace public du recueil est **ouvert à tout le monde** ; l'**atelier**, lui, peut n'être ouvert qu'à certains réseaux — c'est le cas d'une commune qui ne travaille que depuis son **intranet**. Le réglage est dans **Administration › Publication**, carte **Accès à l'atelier** : une **liste d'adresses** (une par ligne, ou séparées par des virgules) et le **message** affiché à qui arrive d'un réseau refusé. La liste accepte une **adresse** (`10.0.0.24`), un **préfixe** (`192.168.0.0/16`), un **champ** (`10.0.0.0-10.0.0.255`) ou une **plage abrégée** (`10.0.0.*`) ; un « # » ouvre un commentaire. **Laissée vide, elle ouvre l'atelier à toutes les adresses.** La décision appartient au **service**, jamais au navigateur : c'est lui qui voit l'adresse de l'appelant, et une adresse annoncée par le client ne prouve rien. L'écran ne fait que montrer l'état, laisser écrire la liste, et **simuler** une adresse (« et si j'arrivais de là ? ») — la réponse venant toujours du service. Le recueil public, lui, reste ouvert : c'est le bouton **Se connecter** qui mène à l'atelier." },
        { t: "note", kind: "warn", title: "On peut se fermer la porte à soi-même", text: "Une liste qui ne couvre pas **votre** adresse vous **ferme l'atelier** — y compris à vous, administrateur. **Éprouvez la vôtre** avec « Essayer une adresse » **avant** d'enregistrer. Si vous vous êtes fermé dehors, on reprend la main **dans le fichier `.env`** du service (`SCRIBA_ATELIER_IPS`, `SCRIBA_ATELIER_MESSAGE`) : la variable du déploiement **l'emporte** sur ce qui est écrit dans l'écran, et l'écran le signale quand elle est posée. Une liste **entièrement illisible** — aucun élément compréhensible — non plus n'ouvre pas l'atelier : elle le **ferme**, car mieux vaut fermer la porte devant une liste fautive que l'ouvrir à tout le monde ; une entrée incomprise, elle, est **signalée** dans l'écran, jamais ignorée en silence. Sur une installation hébergée sur votre propre serveur, le serveur web peut poser une **seconde barrière** devant `/atelier` (voir `src/server/nginx.conf`) : le service applique déjà la règle, celle-ci est facultative." },
        { t: "note", kind: "info", title: "Les actes réservés suivent la même règle", text: "Quand l'atelier est restreint à certains réseaux, la **réservation d'un acte aux agents** se double de la condition de réseau : un acte réservé n'est visible que d'une personne **connectée ET venue d'une adresse autorisée**. C'est ce qui permet de montrer les **actes internes** au recueil pour qui travaille dans l'intranet, sans les donner au public (voir « Réserver un acte aux agents », dans le chapitre de la publication)." },
        { t: "note", kind: "info", title: "Les billets du recueil public", text: "La rubrique **Informations** du recueil public — les actualités, les avis, les communications — s'écrit dans son propre écran, **Informations** (voir « Publier une information »). Son **titre**, son **chapeau** et son **interrupteur** se règlent dans **Administration › Publication › Apparence du site public** ; c'est là aussi que la collectivité pose sa **feuille de style** (couleurs, police, largeur du site public), qui habille le recueil et les billets sans toucher à l'atelier." },
        { t: "p", text: "**Où vivent les données.** Par défaut, tout est rangé dans votre navigateur : c'est le mode local, pratique mais **propre à ce poste**. Pour que plusieurs agents travaillent sur les mêmes trames et les mêmes actes, l'administrateur ouvre **Administration › Base de données** et branche l'application sur la base de la collectivité (MySQL / MariaDB) — ou, sans rien installer, sur le **service partagé** de la démonstration." },
        { t: "note", kind: "warn", title: "Changer de base ne déplace pas les documents", text: "Basculer d'un mode à l'autre ne mélange pas les données : ce qui est à l'écran y reste jusqu'à ce que vous cliquiez **Envoyer les données à la base** ou **Récupérer depuis la base**. En cas de doute, exportez d'abord (onglet « Données »), puis transférez." },
        { t: "note", kind: "info", title: "Deux postes, le même acte", text: "Quand la base est partagée, deux personnes peuvent modifier en même temps des éléments **différents** sans se gêner. Si elles touchent le **même** élément, la base refuse le second écrasement : la version enregistrée est reprise et un message le signale — plutôt que de perdre silencieusement le travail de l'autre. L'en-tête montre qui est **présent** (les pastilles) et si un collègue a le **même acte ouvert** ; la **cloche** signale ce qui vous attend — un acte à valider, une signature, une publication." },
        { t: "note", kind: "info", title: "Ce que l'import d'un document reconnaît — et ce qu'il ne devine pas", text: "Les documents Word (`.docx`) et LibreOffice (`.odt`) sont relus **sans rien installer** : l'application ouvre l'archive, lit le texte tel qu'il se présente (les passages supprimés par une révision Word sont ignorés) et y cherche la structure d'un acte — la ligne d'autorité, l'intitulé, les visas, les considérants, la formule d'édiction (« ARRÊTE », « DÉCIDE »…), les articles, les divisions (Livre, Titre, Chapitre, Section), les listes (numérotées ou à puces, qu'elles viennent du traitement de texte ou qu'elles soient écrites à la main en « 1° », « 1) », « a) »), les tableaux, la mention de recours et le bloc de signature. Le **type d'acte** (arrêté, délibération, règlement…) est déduit de la formule d'édiction, et la trame prend un **nom** fait du type et de l'objet — jamais de la date du document d'origine. Ce que l'import **ne fait pas** : il ne devine pas ce qui n'est pas écrit. Le signataire du document n'est pas repris (il vient du champ « Signataire », choisi par la rédaction), l'en-tête d'État (« RÉPUBLIQUE FRANÇAISE ») est écarté au profit de la ligne de la collectivité, et un article dont la suite est une phrase (« Article 1er. Madame X est nommée… ») n'a pas d'intitulé — la phrase devient le texte de l'article. La fenêtre des points à vérifier dit chacun de ces choix ; un document sans texte exploitable est refusé, et rien n'est enregistré." },
        { t: "note", kind: "warn", title: "Un brouillon n'est visible que de l'atelier", text: "C'est la règle générale : une trame reste en **brouillon** tant qu'un éditeur ne l'a pas **mise à disposition**. Un brouillon n'apparaît pas dans « Rédiger un acte », et un service qui suivrait un lien direct vers lui est arrêté par un message clair. Créer, dupliquer ou importer une trame donne donc toujours un brouillon : on la prépare à l'abri, puis on l'ouvre. La pastille **« Mise à disposition »** et la bande de tête de l'éditeur disent à tout moment où l'on en est, et les deux gestes — mettre à disposition, retirer — sont inscrits au **journal**." },
        { t: "next", chapter: "delegations", label: "Les délégations de signature" },
      ],
    },
    // ------------------------------- 7 bis : les délégations de signature
    // Ce chapitre existe pour lui-même, et non noyé dans « Préparer et faire
    // évoluer une trame » : c'est le seul endroit du guide qui répond à
    // « comment créer une délégation de signature ? » — et l'assistant de
    // l'atelier (Plume) ne reçoit que les chapitres qui tiennent dans son
    // budget, donc un chapitre trop long finissait tronqué avant d'y arriver.
    {
      id: "delegations",
      title: "Les délégations de signature (qui signe à la place de qui)",
      short: "L'organigramme : créer une délégation, la suspendre, et les deux décisions qui la fondent.",
      icon: "org",
      minutes: 5,
      audience: "admin",
      keywords: "délégation délégations déléguer subdélégation sous-délégation organigramme chaîne de signature autorité de tête délégant délégataire qualité pouvoir décision nomination délégation arrêté publier au recueil lien externe suspendre suspendue rompre état dates rapprochement signataire créer ajouter modifier supprimer",
      blocks: [
        { t: "p", text: "Une autorité peut **déléguer sa signature** : le maire à un adjoint, le président de conseil d'administration à son directeur. L'écran **Délégations**, dans le menu de gauche, porte cet **organigramme** : *qui* peut signer à la place de *qui*, et sous quelle **qualité**. Il est visible par **tout le monde** ; seuls les **administrateurs** et les **éditeurs** peuvent le modifier." },
        { t: "p", text: "Ce que l'écran règle, l'acte le dit : un acte signé au bout d'une chaîne porte toutes les qualités traversées, seul le nom du signataire étant imprimé — « Le Maire, / Par délégation, l'adjoint au maire en charge de l'urbanisme, / Karim BENALI »." },
        { t: "terms", items: [
          { term: "Autorité de tête", def: "Celle dont le pouvoir descend — elle signe en son nom propre et ne tient sa signature d'aucune délégation. C'est le cas d'un maire, mais aussi du président d'un établissement autonome." },
          { term: "Délégant / délégataire", def: "Celui qui donne la délégation, et celui qui la reçoit (qui signera « par délégation »). Une autorité ne se délègue pas sa propre signature." },
          { term: "Qualité", def: "Ce qui s'imprime sous le nom de l'autorité de tête : « adjoint au maire en charge de l'urbanisme », « cheffe de bureau Urbanisme ». Elle se saisit au masculin **et** au féminin — l'application compose ensuite « le » ou « la » selon le genre du délégataire." },
          { term: "Sous-délégation", def: "Le délégataire délègue à son tour : l'acte porte alors « Par subdélégation… ». C'est dérogatoire, mais l'arbre n'est pas borné." },
          { term: "Les deux décisions", def: "Un délégataire tient son pouvoir de DEUX décisions : celle qui le **nomme** à sa fonction, et celle qui lui **donne la délégation**. Sans elles deux, la délégation ne s'établit pas." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Délégations**, puis cliquez sur **Nouvelle délégation** (ou « Ajouter une sous-délégation » dans la fiche d'un acteur, pour prolonger une chaîne existante)." },
          { text: "Choisissez le **délégant** — l'autorité qui donne le pouvoir — puis le **délégataire**.", detail: "Le champ « Organisation, dans le nom de laquelle elle est donnée » est déjà rempli : une délégation donnée dans une autre organisation ne s'applique pas aux actes de celle-ci." },
          { text: "Écrivez la **qualité du délégataire**, au masculin et au féminin.", detail: "Sans article : l'application écrit « l'adjoint… » ou « la maire… » selon le genre du délégataire." },
          { text: "Restreignez si besoin : une **famille de trames** ou un **type d'acte** visés.", detail: "Une délégation qui nomme une famille ne vaut que pour les actes de cette famille ; laissée vide, elle vaut pour tous." },
          { text: "Renseignez les **deux décisions fondant la signature** : la décision de nomination, puis la décision de délégation.", detail: "Chacune se désigne d'un **acte publié au recueil** (le lien est celui du recueil en ligne), d'une **référence du référentiel** qui porte son adresse, ou d'un **lien externe**. Chacune porte son intitulé ET son adresse : c'est ce que l'acte visera. La fenêtre montre, à droite, l'aperçu de la signature que la délégation produira — c'est le meilleur moyen de vérifier avant d'enregistrer." },
          { text: "Cliquez sur **Créer la délégation**.", detail: "Le bouton refuse tant qu'une des deux décisions manque : une délégation sans ses décisions n'établirait pas le pouvoir de signer." },
        ] },
        { t: "note", kind: "info", title: "Désigner quelqu'un ici lui donne la qualité de Signataire", text: "La désignation vaut qualité, pour le **délégant** comme pour le **délégataire** : elle n'exige pas de passer par « Comptes et rôles ». C'est cette qualité qui ouvre à l'intéressé l'onglet **« Ma signature »** et son champ de compétence — les actes dont sa signature relève. Pour qu'il puisse effectivement signer, son **compte** doit être rattaché à sa personne et muni d'un **courriel**, puis **rapproché** de l'outil de signature : le geste se fait dans sa fiche (section « Compte et signature électronique »), dans « Comptes et rôles », ou depuis « Ma signature »." },
        { t: "note", kind: "info", title: "Suspendre, dater, reprendre", text: "Une délégation porte un **état** et, si on le souhaite, des **dates** (« en vigueur du… au… »). **Suspendue**, ou hors de ses dates, elle reste dans l'organigramme — elle est **signalée**, jamais cachée — mais elle ne s'applique plus : les actes repartent de l'autorité de tête, et la fiche le dit dans l'aperçu. Pour la rétablir, remettez-la « En vigueur » ou corrigez ses dates, dans « La durée et l'état »." },
        { t: "note", kind: "info", title: "Chaque établissement a sa propre chaîne", text: "Un **établissement public** — un office, un centre de gestion, un syndicat — a sa propre autorité de tête et sa propre chaîne de délégations, **indépendante** de celle de la commune : une délégation donnée dans le nom d'un établissement ne vaut que pour les actes de cet établissement. C'est le rattachement de chaque délégation à son organisation qui le garantit, même quand une même personne tient des délégations des deux côtés." },
        { t: "note", kind: "info", title: "Suivre la chaîne, lire une fiche", text: "L'organigramme se lit en arbre (ou en **liste** indentée, par le bouton de présentation — plus commode sur un écran étroit). Un clic sur un acteur ouvre sa **fiche** : le pouvoir reçu, son étendue, les décisions, les dates, la signature obtenue et les visas qu'elle produira. La fiche d'un délégataire liste ses **sous-délégations**, et « Ajouter une sous-délégation » ouvre le formulaire **par-dessus** la fiche : la chaîne qu'on lisait reste là." },
        { t: "next", chapter: "signature", label: "Faire signer un acte" },
      ],
    },
    // ------------------------------------------------------------------ 8
    {
      id: "organigramme",
      title: "L'organigramme : entités, services et bureaux",
      short: "La structure au nom de laquelle les actes sont pris.",
      icon: "org",
      minutes: 4,
      audience: "all",
      keywords: "organigramme entité entités service services bureau bureaux régie autonome rattachée rattachement signataire principal directeur structure arbre",
      blocks: [
        { t: "p", text: "Un acte n'est jamais pris par une personne seule : il est pris **au nom d'une organisation**. C'est cette organisation que l'écran **Organigramme** décrit, à trois niveaux." },
        { t: "terms", items: [
          { term: "Entité", def: "L'organisation elle-même : la commune, le CCAS, la caisse des écoles, l'office… ou une régie." },
          { term: "Service", def: "Un service de cette entité : « Direction générale des services », « Action sociale »… C'est à un service qu'un dossier est rattaché. Un service peut aussi **dépendre d'un autre service** (ou du bureau d'un autre service) : la direction générale coiffe ainsi ses directions rattachées." },
          { term: "Bureau", def: "La maille fine d'un service : « Pilotage des services », « Accueil du public »… C'est là qu'un compte est rattaché." },
          { term: "Entité autonome", def: "Elle a sa propre personnalité morale : elle agit en son nom. C'est le cas ordinaire." },
          { term: "Entité rattachée", def: "Elle n'a pas de personnalité morale propre et agit au nom d'une autre. Une **régie** municipale, par exemple : elle a pourtant son directeur, ses services et ses actes." },
          { term: "Signataire principal", def: "La personne qui signe les actes d'une entité quand aucun signataire n'est désigné sur le modèle : son maire, son président, son directeur." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Organigramme** dans le menu de gauche. L'arbre part des entités ; chaque entité porte ses services, et chaque service ses bureaux." },
          { text: "Basculez entre **Organigramme** et **Liste** selon ce que vous cherchez : l'arbre montre la structure, la liste se parcourt plus vite." },
          { text: "Cliquez un nœud pour ouvrir sa **fiche** : forme, code, nom, dénomination légale, personnalité morale, rattachement, et — pour une entité — son **signataire principal** ; pour un service, le **service ou le bureau dont il dépend**." },
          { text: "Dans la fiche d'un service, ajoutez ou retirez ses **bureaux** sans quitter l'écran." },
        ] },
        { t: "note", kind: "info", title: "Tout le monde peut le consulter", text: "Savoir qui existe et qui signe n'est pas un secret : l'organigramme est ouvert à tous les comptes. Le modifier demande les droits d'administration habituels : les **administrateurs** et les **éditeurs** ajoutent ou retirent les **services** et les **bureaux** et règlent leurs rattachements ; l'ajout ou la suppression d'une **entité** reste aux **administrateurs**." },
        { t: "note", kind: "info", title: "Un service qui dépend d'un autre", text: "Un service peut **dépendre d'un autre service**, ou du **bureau d'un autre service** : l'organigramme en fait un **arbre**, et le périmètre suit la chaîne — un agent affecté à un service de **tête de chaîne** voit les actes de **tout ce qui pend en dessous**. C'est ce qu'une direction attend : affectée à la direction générale, elle suit les actes de ses directions rattachées." },
        { t: "note", kind: "warn", title: "Un rattachement qui tourne en rond", text: "Si deux entités se rattachent l'une à l'autre, elles ne peuvent pas figurer dans l'arbre : l'écran les liste à part, sous « Entités hors arbre ». Ouvrez leur fiche pour corriger le rattachement." },
        { t: "p", text: "Le **signataire principal** évite qu'un acte sorte sans signature : quand le modèle (la **trame**) ne désigne personne, c'est lui qui signe — sous la qualité que vous avez indiquée avec lui. Un signataire désigné sur la trame reste prioritaire, et une **délégation** de signature n'est pas court-circuitée pour autant." },
        { t: "next", chapter: "delegations", label: "Les délégations de signature" },
      ],
    },
    {
      id: "chrono",
      title: "Le chrono de numérotation (retrouver un numéro)",
      short: "Tous les numéros attribués, et les trous, expliqués.",
      icon: "list",
      minutes: 4,
      audience: "all",
      keywords: "chrono numérotation numéro rang séquence trou rang libre annulé annuler export csv xlsx excel trier filtrer",
      blocks: [
        { t: "p", text: "Le **chrono** est la suite des numéros que la collectivité a tirés, dans l'ordre. C'est lui qui fait foi quand on cherche « l'acte n° 2026-412 ». L'écran **Chrono de numérotation** le montre en entier." },
        { t: "terms", items: [
          { term: "Rang", def: "Le numéro d'ordre dans la séquence : 412, dans « 2026-412-VSL »." },
          { term: "Rang libre", def: "Un rang que personne n'a jamais tiré. Il figure au chrono pour expliquer un trou — la suite saute un numéro, et l'on sait pourquoi." },
          { term: "Numéro annulé", def: "Un numéro tiré puis abandonné, avec son motif. Il n'est pas réattribué : le chrono le montre barré." },
          { term: "Portée du chrono", def: "Un seul chrono pour toute la collectivité, ou un chrono par entité, ou un par type d'acte. C'est un réglage de l'administration." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Chrono de numérotation**. Les compteurs de tête disent l'essentiel : actes numérotés, dernier rang, prochain numéro, rangs libres, numéros annulés." },
          { text: "Filtrez : par année, par entité, par type d'acte, par état, par période, ou en tapant un mot (un objet, un numéro)." },
          { text: "Cliquez l'en-tête d'une colonne pour **trier** ; cliquez de nouveau pour inverser le sens." },
          { text: "Cliquez une ligne pour **ouvrir l'acte** concerné." },
          { text: "Cliquez **Export CSV** ou **Export XLSX** pour emporter le résultat filtré dans un tableur." },
        ] },
        { t: "note", kind: "info", title: "Le chrono ne renumérote jamais", text: "Un numéro attribué est un fait : il reste ce qu'il est. Pour un acte dont le numéro est faux, ouvrez l'acte et corrigez son numéro — le rang, lui, reste consommé." },
        { t: "note", kind: "warn", title: "« Annuler le rang » ne rend pas le numéro", text: "Ce bouton (réservé aux administrateurs) déclare qu'un rang n'a pas servi : il n'est plus proposé, et il apparaît au chrono comme annulé, avec son motif. Un numéro annulé n'est jamais redonné à un autre acte." },
        { t: "note", kind: "info", title: "Nouvelle année", text: "Quand le chrono est resté sur une année passée, un bouton propose de **passer à l'année en cours** : l'année de référence change et la séquence repart au rang 1. Les numéros déjà attribués restent ce qu'ils sont." },
        { t: "next", chapter: "administrateurs", label: "Préparer et faire évoluer une trame" },
      ],
    },
    {
      id: "chartes",
      title: "Habiller les actes : la charte graphique",
      short: "Feuilles de style : marges, police, logo, filets, en-tête — une charte par entité ou par famille d'actes.",
      icon: "palette",
      minutes: 6,
      audience: "admin",
      keywords: "feuille de style charte graphique police liste des polices logo en-tête pied de page filet diviseur encadré intitulé encadré bordures côtés couleur présentation liste à puces liste numérotée numérotation 1° énumération aperçu entité famille sous-feuille marges cadre capitales éditeur direct wysiwyg sombre",
      blocks: [
        { t: "p", text: "Un acte, c'est un texte — mais c'est aussi une **apparence** : un logo en tête, une police, des filets, une couleur, des marges. C'est ce que règle l'écran **Feuilles de style**, dans le menu « Configurer ». Rien n'y est codé : chaque collectivité, chaque entité, compose la sienne." },
        { t: "terms", items: [
          { term: "Feuille générale", def: "La charte par défaut, celle de la collectivité. Elle habille **tous** les actes, sauf ceux qu'une sous-feuille vise. Il n'y en a qu'une." },
          { term: "Sous-feuille", def: "Une charte particulière, rattachée facultativement à une **entité** et/ou à une **famille d'actes**. C'est ainsi que le CCAS peut avoir son en-tête sans changer celui de la mairie." },
          { term: "Réglages", def: "La vue exhaustive : tous les réglages, rangés par thème (papier, typographie, intitulé, visas, filets, articles, tableaux, signature, en-tête…)." },
          { term: "Édition directe", def: "L'autre façon de faire, la plus rapide : on **clique l'élément** dans l'aperçu (l'intitulé, un tableau, l'en-tête) et seuls ses réglages apparaissent. Le texte de l'acte n'est jamais modifié." },
          { term: "Modèle de départ", def: "Une présentation complète appliquée d'un clic : « Classique préfectoral », « Moderne », « Solennel », « Sobre », « Recueil communal », « Acte individuel », « Charte graphique de l'État » (réservé à l'État et à ses opérateurs) et « Marianne-like » (la même sobriété, sans les éléments réservés). Tout reste modifiable ensuite." },
          { term: "Police", def: "Le corps du texte, l'intitulé et les intitulés d'article ont chacun la leur, choisie dans une **liste** rangée par familles (à empattements, sans empattement, à chasse fixe) : des polices présentes sur les postes, donc sans rien installer. « Autre (police personnalisée) » permet une police propre à la collectivité ou une pile CSS complète." },
          { term: "Encadré", def: "Une marque de l'intitulé — comme le soulignement ou le filet. L'intitulé de l'acte et les intitulés d'article peuvent être **encadrés** d'un filet, qui prend le style et la couleur des filets de la charte. La formule d'édiction (« ARRÊTE »), les mentions et le bloc de signature connaissent le même encadré. Chaque encadré se règle **côté par côté** (« Bordures de l'encadré » : haut, droite, bas, gauche) : un seul filet se pose ainsi sous un intitulé, ou l'encadré s'ouvre d'un côté." },
          { term: "Listes", def: "Un acte comporte souvent des listes : à puces pour une énumération libre, **numérotées** pour un « 1° 2° 3° » réglementaire. C'est la trame qui décide, bloc par bloc, du genre de chaque liste (dans l'inspecteur, « Type de liste ») ; la charte dit ensuite à quoi elles ressemblent — la puce d'un côté, la numérotation de l'autre (« 1. », « 1° », « 1) », « a) », « A) », « i. », « I. »)." },
          { term: "Second emblème", def: "L'en-tête peut porter **deux** marques : celle de gauche (l'emblème habituel) et une **seconde, à droite** du filet — la marque de l'État, d'un partenaire, d'une délégation. Chacune a sa hauteur. Laissée vide, la seconde n'existe pas et le document se présente comme avant." },
          { term: "Graisse de l'autorité", def: "La **formule d'autorité** (« Le maire de… », « La présidente du CCAS de… ») se règle en **graisse** : normale, italique, **grasse**, ou grasse italique. C'est elle qui ouvre le dispositif de l'acte ; la mettre en gras la détache sans la dénaturer. Une feuille enregistrée avant ce réglage conserve exactement son rendu (« Hérité »)." },
          { term: "Aperçu", def: "À droite de l'écran, un acte type rendu par le **même code** que le PDF et l'export Word. Ce que vous voyez est ce qui sortira." },
        ] },
        { t: "steps", items: [
          { text: "Ouvrez **Feuilles de style** et choisissez une feuille dans la liste de gauche.", detail: "Sur une installation de démonstration, trois feuilles sont livrées : la charte générale, celle du CCAS, celle des actes individuels. « Nouvelle sous-feuille » en crée une ; « Dupliquer » part d'une existante." },
          { text: "Cliquez **Édition directe**, en haut de l'écran.", detail: "Le bouton d'affichage passe de « Réglages » à « Édition directe ». Cliquez alors un élément dans l'aperçu — l'intitulé, un tableau, le bloc de signature — : l'encadré bleu montre ce qui est réglé, et seuls ses réglages apparaissent. La barre de pastilles (« Papier », « En-tête », « Signature »…) permet d'atteindre directement une partie du document." },
          { text: "Pour partir d'une base, appliquez un **Modèle de départ**.", detail: "Dans la vue « Réglages » : « Solennel » pose un cadre double et des numéros d'article dans la marge, « Moderne » un bandeau et une police sans empattement, etc. Deux modèles suivent la **charte graphique de l'État** (bleu France, typographie Marianne, en-tête et filet) : « Charte graphique de l'État » — **réservé à l'État et à ses opérateurs**, la police Marianne et le bloc-marque n'étant pas livrés — et « Marianne-like », la même sobriété sans les éléments réservés, avec vos couleurs et votre identité, utilisable par toute administration. Le nom, le rattachement et le logo de la feuille sont conservés." },
          { text: "Réglez ensuite ce qui fait l'identité du document.", detail: "Marges de page, police et corps, couleurs, en-tête et pied de page, filets, encadrés, tableaux, bloc de signature, cadre de page. Les polices se choisissent dans une liste, rangée par familles — « Autre » pour une police propre à la collectivité ; l'intitulé de l'acte et les intitulés d'article peuvent être **encadrés**, et l'on choisit alors les **côtés** tracés ; les listes numérotées prennent ici leur numérotation (« 1° 2° 3° »…). Chaque changement se répercute aussitôt dans l'aperçu. Les textes de l'en-tête et du pied acceptent des jetons : {{entity.name}}, {{brand.name}}, {{numero}}, {{objet}}, {{dateSignature}}…" },
          { text: "Rattachez une sous-feuille à ses **entités** et à ses **familles** d'actes.", detail: "Dès qu'une entité ou une famille lui est associée, les actes concernés prennent cette charte — sans qu'on touche à leurs trames." },
          { text: "Pour un acte précis, désignez la feuille depuis l'onglet « Trame » de l'éditeur de trame.", detail: "Le champ « Feuille de style » de la trame l'emporte sur tout le reste. Laissez-le sur « Automatique » dans le cas général." },
          { text: "Vérifiez le résultat sur un vrai acte : **Actes → l'acte → Imprimer / PDF** ou **HTML**.", detail: "L'aperçu, le PDF, l'export Word, la page HTML autonome et le **PDF/A** appliquent tous la même charte. La **page du recueil public**, elle, ne l'applique pas (voir la note ci-dessous)." },
        ] },
        { t: "note", kind: "info", title: "La charte habille le papier, pas le recueil", text: "La charte s'applique à l'**aperçu**, au **PDF**, au fichier **Word**, à la **page HTML autonome**, à l'**original signé** et au **PDF/A** — le papier, en somme. La **page du recueil public**, celle que tout le monde consulte en ligne, ne l'applique **pas** : tous les actes publiés y suivent **une seule feuille de style web**, celle du site. Deux entités qui ont deux chartes très différentes — en-tête, logo, police, couleurs, marges — présentent donc leurs actes **à l'identique** sur le recueil. C'est voulu : la charte est l'identité d'un **document**, le recueil est un **site**." },
        { t: "note", kind: "info", title: "Qui l'emporte", text: "Ordre de priorité : la **trame** (si elle désigne une feuille), puis l'**entité** signataire, puis la **famille** de la trame, puis la **feuille générale**. Autrement dit, la règle la plus précise gagne." },
        { t: "note", kind: "info", title: "Les marges de page", text: "Les marges font partie de la charte (en millimètres) : elles s'appliquent à l'aperçu, au PDF, au fichier Word et à la page autonome — le papier. Si vous imprimez directement l'aperçu de l'application (Ctrl+P), c'est la feuille **générale** qui donne ses marges à la page." },
        { t: "note", kind: "info", title: "Ce qui n'est pas dans la charte", text: "La charte ne change **que la présentation**. Le texte, les visas, les articles, le numéro et les dates viennent de la trame et de la rédaction. Habiller un acte ne modifie jamais son contenu — c'est vrai aussi de l'édition directe, où l'on ne peut cliquer que des éléments d'apparence." },
        { t: "note", kind: "warn", title: "Importer et exporter une charte", text: "Une charte s'exporte en JSON (« Exporter la charte ») et s'importe sur un autre poste ou dans une autre collectivité. Elle voyage aussi avec l'export complet du référentiel (Administration → Données)." },
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
      keywords: "glossaire définitions vocabulaire visa considérant trame mise à disposition brouillon import word docx odt libreoffice jeton entité base de données partagé",
      blocks: [
        { t: "p", text: "Les mots du métier et ceux de l'application, dans l'ordre où ils vous viendront. En cas de doute, cherchez le mot dans la barre de recherche du guide." },
        { t: "terms", items: [
          { term: "Acte", def: "Le document officiel signé par l'autorité : une décision, une nomination, une délégation…" },
          { term: "Trame", def: "Le modèle d'acte préparé à l'avance par les administrateurs. On dit aussi « modèle »." },
          { term: "Mise à disposition", def: "Le geste qui **ouvre une trame aux services**. Tant qu'une trame n'est pas mise à disposition, elle reste un **brouillon** : elle n'apparaît pas dans « Rédiger un acte », et personne d'autre que l'atelier ne la voit. Le bouton « Mettre à disposition » est sur la carte de la trame et en tête de l'éditeur ; le bouton « Retirer » la ramène en brouillon — les actes déjà rédigés à partir d'elle ne sont pas touchés. Les deux gestes sont inscrits au journal." },
          { term: "Import d'un document", def: "Faire d'un document **Word** (`.docx`) ou **LibreOffice** (`.odt`) une **trame**. L'application relit le document et en reconnaît la structure — intitulé, autorité, visas, considérants, articles, listes, tableaux, signature —, puis propose la trame dans l'éditeur **sans l'enregistrer** : on la garde ou on la jette. Un document n'est jamais un modèle publié d'office." },
          { term: "Feuille de style", def: "La charte graphique d'un acte : police, logo, en-tête, filets, encadrés, numérotation des listes. Une feuille générale sert de défaut ; des sous-feuilles se rattachent à des entités ou à des familles d'actes. Elle ne change que la présentation, jamais le texte." },
          { term: "Rédacteur", def: "La personne qui remplit le formulaire. C'est vous." },
          { term: "Administrateur", def: "La ou les collègues qui écrivent les trames et tiennent le référentiel à jour." },
          { term: "Entité", def: "La commune, l'établissement public ou le service au nom duquel l'acte est pris." },
          { term: "Assemblée délibérante", def: "Le **conseil** dont certains actes émanent : le **conseil municipal** d'une commune, le **conseil d'administration** d'un établissement public. Une délibération n'est pas prise par une personne mais par l'assemblée — sa ligne d'autorité se lit « Le conseil municipal de … » —, et elle est **signée par le président de l'assemblée** : le maire, ou le président du conseil d'administration. Laquelle des deux qualités signe se règle **par assemblée**, dans **Administration › Assemblées** (voir src/lib/conseils.js)." },
          { term: "Signataire", def: "La personne qui appose sa signature sur l'acte. Elle se désigne **par sa fonction** — la qualité qui donne compétence pour signer — et non par son nom : on choisit d'abord la fonction, puis, parmi les personnes qui la tiennent, celle qui signe. Un compte qui porte la **qualité de Signataire** (cumulable, attribuée dès que la personne est désignée dans l'organigramme des délégations) ouvre l'onglet **« Ma signature »** : il y signe avec **son compte**, rapproché de celui de l'outil de signature, et ne voit dans l'atelier que les actes de son champ de compétence." },
          { term: "Rapprochement", def: "Le lien entre les deux « moi » d'un signataire : sa **personne** au référentiel, son **compte** dans l'application, et le **compte que l'outil de signature** lui connaît. En production, l'annuaire de la collectivité crée les deux comptes ; les rapprocher (un bouton, depuis « Ma signature », la fiche du compte ou la fiche de l'acteur dans les Délégations) est ce qui permet à la signature d'être nominative plutôt qu'anonyme." },
          { term: "Champ de compétence", def: "Ce sur quoi un signataire est compétent : les actes dont **sa signature** relève — ceux qu'il signe lui-même, et ceux que signent ses **délégataires** (sa signature y est engagée par délégation ou subdélégation). C'est la part du registre qu'il voit dans l'atelier." },
          { term: "Qualité cumulable", def: "Un rôle qui ne remplace pas le profil du compte mais **s'ajoute** à lui : **Réviseur** (contrôler un acte avant sa signature) et **Signataire** (le signer). Un compte peut donc être, par exemple, éditeur **et** réviseur, ou rédacteur **et** signataire." },
          { term: "Visa", def: "Les textes et décisions rappelés avant de décider (« Vu le décret… »)." },
          { term: "Décision fondant la signature", def: "L'acte par lequel un signataire tient son pouvoir de signer : la délibération qui donne délégation au maire, l'arrêté qui nomme un adjoint, celui qui le sous-délègue. Un délégataire en a **deux** — sa nomination et sa délégation. Renseignées sur la personne (le pouvoir de l'autorité de tête) ou sur la délégation, elles se visent d'elles-mêmes sur les actes signés, avec leur lien, dans l'ordre de la chaîne." },
          { term: "Considérant", def: "Les raisons de la décision (« Considérant que… »)." },
          { term: "Formule d'édiction", def: "Le mot qui annonce la décision : « DÉCIDE », « ARRÊTE »." },
          { term: "Article", def: "Une partie numérotée de la décision. Un acte doit en comporter au moins un." },
          { term: "Division", def: "Un morceau de document qui en contient d'autres : un **Livre**, un **Titre**, un **Chapitre**, une **Section**, une **Partie**… Le mot et le nombre d'échelons appartiennent à la **trame**, et la hiérarchie y est pré-intégrée : dans le document, une division se place à un échelon, en contient d'autres ou des articles, et la numérotation (« Livre Ier », « Titre II »…) se déduit de cette place." },
          { term: "Annexe", def: "Un document **adopté par un autre** : le règlement intérieur adopté par une délibération, la grille tarifaire adoptée par une décision. Une trame peut être de nature « Annexe » ; le document **n'a alors pas de numéro propre** — il s'identifie par la décision qui l'adopte —, rappelle en tête de ses visas l'acte qui l'adopte, et **ne se signe pas** : c'est l'acte qui l'adopte qui est signé, et l'original de cet acte est suivi de son texte. Il se modifie par **adoption d'une nouvelle rédaction** (voir « Acte modificatif »), non article par article." },
          { term: "Acte d'adoption", def: "L'acte qui **adopte** une annexe : la délibération pour le règlement intérieur, la décision pour la grille tarifaire. Il est un acte ordinaire, et il **annonce ses annexes** à la fin de son dispositif, puis **porte leur texte** à la suite de sa signature ; l'annexe, de son côté, le **rappelle dans ses visas**." },
          { term: "Règlement", def: "Deux sens à ne pas confondre. C'est d'abord un **type d'annexe** : un texte **normatif** — un règlement intérieur, un règlement d'usage —, qui fait droit par lui-même et non seulement dans la décision qui l'adopte. C'est aussi le nom de la **publication informative autonome** qu'un tel texte reçoit au recueil public, sous son propre identifiant (`eli:/fr/reg/…`) : son texte **en vigueur** s'y consulte pour lui-même, comme un **code**, et les publications successives en sont les **versions**. Cette publication n'est ni signée ni opposable : seule la décision d'adoption fait foi, et la page du règlement le dit. Voir « Adopter une annexe »." },
          { term: "Champ (ou jeton)", def: "Un emplacement du modèle rempli automatiquement avec ce que vous saisissez. Il s'affiche en pastille bleue dans l'éditeur." },
          { term: "Numéro (chrono)", def: "Le numéro unique de l'acte. Il est attribué par l'application, qui en tient la séquence ; on le **réserve**, on ne le tape pas. Dans une collectivité qui numérote dans un autre logiciel (un document **Grist**, par exemple), c'est ce logiciel qui l'attribue : on le **demande** alors depuis l'écran de rédaction." },
          { term: "Service de numérotation", def: "Le logiciel extérieur qui attribue le numéro, quand la collectivité n'utilise pas la séquence de l'application : un document **Grist**, un tableur en ligne, un référentiel interne. On le règle dans **Administration › Numérotation** : l'application lui demande le numéro au moment de rédiger, et la **ligne créée** chez lui fait foi." },
          { term: "Registre", def: "La liste de tous les actes enregistrés : le menu « Actes »." },
          { term: "Administration", def: "La liste des données réutilisables : entités, assemblées délibérantes, personnes, rôles, textes de référence, mentions, vocabulaire, numérotation." },
          { term: "Conformité", def: "Le contrôle automatique passé avant l'export." },
          { term: "Écart (hors trame)", def: "Un passage du document qui a été réécrit par rapport au modèle. Le texte réécrit est conservé, mais l'acte le signale aux administrateurs. Ce n'est jamais bloquant." },
          { term: "Acte modificatif", def: "L'acte qui modifie un acte déjà signé : il dit, article par article, ce qui est remplacé, abrogé ou ajouté. Pour une **annexe** (un règlement, un tableau), il ne procède pas article par article : il **adopte la nouvelle rédaction** du document, présentée avec ses ajouts et ses suppressions apparents — sauf mention expresse visant tel article, auquel cas la modification reste classique." },
          { term: "Version consolidée", def: "L'acte d'origine remis à jour de ses modifications. Elle se lit par défaut dans sa rédaction en vigueur, chaque article modifié portant la mention de l'acte qui l'a modifié ; le suivi des modifications (ajouts et suppressions apparents, tableau récapitulatif) est une option. Elle est diffusée à titre d'information : seuls les actes publiés font foi." },
          { term: "Abrogation", def: "Le fait de faire cesser un acte — ou l'un de ses articles — de produire effet. Elle se fait par un **acte nouveau**, publié, qui **vise expressément** ce qu'il abroge ; elle prend effet au jour de l'**entrée en vigueur** de cet acte, et non à sa publication. Un acte publié ne s'efface pas : il reste au recueil, marqué comme abrogé." },
          { term: "Entrée en vigueur", def: "Le jour où un acte commence à produire effet : la **date d'effet** qu'il déclare, et à défaut le lendemain de sa publication — ou le délai réglé dans Administration › Publication. C'est cette date qui fait courir les abrogations prévues par l'acte." },
          { term: "Article abrogé", def: "Un article qui n'est plus en vigueur. Il garde son numéro — la numérotation ne se referme pas — et la mention de l'acte qui l'a abrogé ; sa rédaction n'est plus lue que sur demande (« Afficher les articles abrogés », dans le recueil public)." },
          { term: "Retrait du recueil", def: "Un geste **technique** et exceptionnel : dépôt en double, erreur de dépôt. Il ne sert jamais à faire cesser un acte de produire effet — c'est l'abrogation qui le fait. Réservé aux administrateurs, et soumis à un motif écrit." },
          { term: "Prestataire de signature", def: "Le service extérieur qui recueille la signature électronique (ESUP-Signature ou équivalent). L'application lui envoie l'acte et reçoit l'acte signé en retour." },
          { term: "Empreinte", def: "Une suite de caractères calculée à partir du document (SHA-256). Si le document change d'un seul caractère, l'empreinte change : c'est ce qui prouve qu'un acte n'a pas été modifié." },
          { term: "Certificat", def: "Le « tampon » électronique du signataire, délivré par une autorité. Il permet de vérifier la signature, des années plus tard." },
          { term: "Horodatage", def: "La preuve de la date et de l'heure exactes de la signature." },
          { term: "Circuit de signature", def: "Le parcours d'un acte envoyé en signature : déposé, envoyé, signé (ou refusé)." },
          { term: "Publication", def: "Le dépôt officiel de l'acte : c'est à partir de là qu'il s'impose à tout le monde." },
          { term: "Opposabilité", def: "Le moment à partir duquel l'acte peut être appliqué. Par défaut, le lendemain de sa publication." },
          { term: "Exécutoire", def: "Un acte est **exécutoire** quand la dernière formalité requise est accomplie : il s'applique vraiment. C'est de cette date — et non de la signature — que court le délai de recours (écran « Exécution & délais »)." },
          { term: "Délai de recours", def: "Le temps pendant lequel l'acte peut être contesté devant le juge : **deux mois** en principe, à compter de la date d'exécutoire. Passé ce délai sans recours, l'acte est **définitif**." },
          { term: "Recours introduit", def: "Un recours a réellement été déposé contre un acte (requête au tribunal, recours gracieux, déféré du préfet). Sa **date d'introduction** ferme le délai : l'acte n'est plus « définitif », il est **contesté** jusqu'à la décision du juge. On le note depuis l'échéancier." },
          { term: "Attestation de non-recours", def: "La pièce qui certifie qu'**aucun recours** n'a été porté à la connaissance de la collectivité contre un acte **définitif**. Elle se délivre en PDF depuis l'échéancier, pour un tiers qui en fait la demande. Un acte contesté ne peut pas en faire l'objet." },
          { term: "État des formalités", def: "La pièce qui relève, pour un acte signé, chaque formalité d'exécution avec sa **date**, sa **référence**, sa modalité et son auteur — plus la situation (exécutoire, délai, recours). Elle s'exporte en PDF et se classe au dossier." },
          { term: "ELI", def: "European Legislation Identifier : l'identifiant permanent d'un texte, par exemple `eli:/fr/dec/2026/0402/iar`. C'est lui qu'on cite, plutôt que l'adresse du site — et c'est aussi une adresse : dans le recueil, un acte cité par son identifiant ELI s'ouvre d'un clic." },
          { term: "Recueil", def: "Le « journal officiel » de la collectivité, dans lequel les actes sont publiés." },
          { term: "Retrait du recueil", def: "L'effacement d'un acte du recueil, en **dernier recours** et sur **motif technique** (dépôt en double, dépôt erroné, acte publié avant signature, identifiant attribué à tort). Réservé à l'**administrateur**, il laisse une trace sur l'acte et au journal. Ce n'est **pas** une façon de corriger un acte : pour cela, on le **modifie** ou on l'**abroge**, et il reste au recueil." },
          { term: "Version en ligne", def: "La page web de l'acte publié, celle que tout le monde peut consulter." },
          { term: "Original signé", def: "Le document signé, conservé tel quel. C'est lui qui fait foi : la version en ligne n'est qu'une lecture commode." },
          { term: "Acte non publiable", def: "Un acte individuel (revalorisation d'un traitement, sanction, décision nominative…) dont la trame est déclarée **non publiable**. Il est rédigé, signé et conservé au registre, mais il n'est pas déposé au recueil et ne reçoit pas d'identifiant ELI : il est notifié à l'intéressé." },
          { term: "Export", def: "La fabrication d'un fichier à partir de l'acte (PDF, Word, HTML, formats techniques)." },
          { term: "PDF", def: "Le format du fichier à imprimer et à envoyer. C'est celui qu'on joint au message." },
          { term: "A4", def: "Le format de papier habituel des actes (21 × 29,7 cm). Tous les documents de l'application — aperçu, PDF, Word — sont présentés en A4 avec les mêmes marges, pour que l'écran, l'impression et la pièce jointe montrent exactement la même chose." },
          { term: "Mode sombre", def: "L'affichage de l'application sur fond sombre (bouton lune / soleil, en haut à droite ; ou « Automatique » dans le menu du compte, pour suivre le réglage du système). C'est une préférence de poste de travail : elle vaut pour vous seul, et elle ne change pas le document — le papier des actes reste blanc, comme à l'impression. L'administrateur peut associer à ce fond sombre un **second emblème** (Administration › Identité), qui remplace alors le logo ordinaire dans l'application — jamais sur le papier." },
          { term: "Word (.doc)", def: "Un fichier que Word (ou LibreOffice) ouvre pour retoucher le texte d'un acte, déjà mis en page en A4." },
          { term: "Akoma Ntoso, ELI, Schematron", def: "Des formats normalisés destinés à l'archivage, à la publication et aux logiciels. Vous les transmettez si on vous les demande, sans les ouvrir." },
          { term: "Auteur d'un commentaire", def: "Le **service** dont le compte a écrit le commentaire — pas la personne. Un service répond de ses modèles et de ses consignes au-delà des agents qui s'y succèdent." },
          { term: "Base de données", def: "L'endroit où sont rangés le référentiel, les trames, les actes et les comptes. En mode local (sans serveur raccordé), c'est le stockage de votre navigateur (donc propre à ce poste) ; en exploitation, la base de la collectivité (MySQL ou MariaDB), partagée par tous les postes." },
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
      keywords: "problème erreur aide dépannage écran blanc fichier perdu bug import docx odt word libreoffice brouillon mise à disposition modèle introuvable",
      blocks: [
        { t: "p", text: "Presque tout se règle en trois gestes : attendre dix secondes, corriger la case signalée, ou recharger la page. Voici les cas les plus fréquents." },
        { t: "faq", items: [
          { q: "L'écran reste vide ou semble bloqué", a: "Attendez dix secondes, puis appuyez sur **F5** (ou le bouton ↻ en haut du navigateur). Vous ne perdez rien de ce qui était enregistré : au pire, il faut refaire la saisie en cours." },
          { q: "J'ai fermé l'onglet sans cliquer sur Enregistrer", a: "La saisie non enregistrée est perdue. C'est la raison pour laquelle il faut cliquer sur **Enregistrer** souvent, même au milieu du travail." },
          { q: "Les boutons d'export sont grisés", a: "Un contrôle bloquant est en échec : le cadre **Conformité** dit lequel. Corrigez la case indiquée ; les boutons se réactivent aussitôt." },
          { q: "Je ne trouve pas le fichier que je viens d'exporter", a: "Regardez en bas de la fenêtre du navigateur : une petite flèche ou une liste de téléchargements y apparaît. Sinon, ouvrez le dossier **Téléchargements** de votre poste de travail." },
          { q: "Rien ne s'ouvre quand je clique sur Imprimer / PDF", a: "Votre navigateur a peut-être bloqué la nouvelle fenêtre. Autorisez les fenêtres surgissantes (pop-up) pour ce site, puis réessayez. En dernier recours, utilisez « HTML complet » et imprimez depuis le navigateur." },
          { q: "Je me suis trompé dans un acte déjà enregistré", a: "Ouvrez-le depuis **Actes** → « Ouvrir », corrigez les cases, puis **Enregistrer** de nouveau. Si l'acte a déjà été signé ou publié, ne le modifiez pas : demandez à l'administrateur s'il faut un acte rectificatif." },
          { q: "Je ne trouve pas le modèle que je cherche", a: "Videz le champ de recherche et remettez les filtres sur « Toutes les familles » et « Tous les statuts ». Le modèle n'est peut-être pas encore **mis à disposition** : une trame en brouillon n'apparaît pas dans « Rédiger un acte ». Demandez à l'administrateur de la mettre à disposition." },
          { q: "On m'a importé un document Word, mais rien n'apparaît dans « Rédiger un acte »", a: "C'est normal, et c'est voulu. Un document importé (Word ou LibreOffice) devient une trame **en brouillon**, que l'on relit d'abord dans l'éditeur ; elle n'est proposée aux services qu'après le geste **« Mettre à disposition »**. Ouvrez la liste des trames : la carte porte la pastille « Brouillon » et le bouton qui l'ouvre." },
          { q: "L'import d'un document a échoué", a: "Vérifiez qu'il s'agit bien d'un **.docx** ou d'un **.odt** (et non d'un ancien **.doc**, ni d'un fichier enregistré « en texte »). Un document sans texte exploitable — une image seule, un tableau vide — ne peut pas devenir une trame : le message le dit, et rien n'est enregistré." },
          { q: "Je veux travailler depuis un autre ordinateur", a: "Tout dépend du mode de rangement. En **mode partagé** (base de la collectivité), vos trames et vos actes sont visibles depuis n'importe quel poste, avec le même compte. En **mode local** (démonstration), les données ne sont enregistrées que dans le navigateur de votre poste : pour les transférer, exportez — le PDF voyage par courriel, et les administrateurs peuvent exporter/importer l'ensemble depuis **Administration → Données**." },
          { q: "Le bandeau affiche « base hors ligne »", a: "L'application n'arrive pas à joindre la base partagée : elle continue de fonctionner avec les dernières données reçues sur ce poste. Vos modifications sont mises de côté et **renvoyées automatiquement** dès que la base répond de nouveau. Vérifiez votre connexion ; si cela dure, prévenez l'administrateur." },
          { q: "Je me connecte et l'application me dit que je n'ai pas accès", a: "Votre identité a bien été reconnue, mais aucun rôle ne vous ouvre l'atelier (vous êtes **Visiteur**). L'écran affiche les groupes reçus de l'annuaire : s'il vous en manque un, c'est là qu'est la réponse. Adressez-vous au **service qui gère l'application** (ses coordonnées sont sur cet écran) pour obtenir le rôle qui correspond à votre travail. En attendant, le bouton « Consulter l'espace public » vous amène au recueil des actes publiés, ouvert à tous." },
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
      short: "Trois profils d'accès — administrateur, éditeur, rédacteur —, deux qualités qui se cumulent (réviseur, signataire), et le visiteur, qui n'a aucun accès. Le vôtre détermine les écrans et les boutons.",
      icon: "lock",
      minutes: 3,
      audience: "all",
      keywords: "compte rôle profil connexion session administrateur éditeur rédacteur réviseur signataire signature signer rapprochement outil de signature en son nom qualité cumul cumulable visiteur accès refusé permission accès identifiant se connecter changer de compte service bureau périmètre transverse rattachement",
      blocks: [
        { t: "p", text: "L'application demande d'abord **qui se connecte**. Ce n'est pas une formalité : c'est le compte choisi qui décide de ce que vous pouvez faire — **les écrans que vous voyez** et **les actes que vous pouvez toucher** — et qui signe (au nom de qui) les actes que vous rédigez." },
        { t: "p", text: "Trois profils existent, du plus large au plus étroit. Le profil dit **ce que l'on peut faire** ; le rattachement à un service dit **sur quoi** :" },
        { t: "table", head: ["Profil", "Ce qu'il permet", "Ce qu'il ne permet pas"], rows: [
          ["**Administrateur**", "Tout : référentiel (entités, personnes, références, services et bureaux), comptes et rôles, connexions aux API, sauvegarde et restauration des données. Il voit tout, quel que soit le service.", "—"],
          ["**Éditeur**", "Créer, modifier et commenter les **trames** de son périmètre ; rédiger des actes ; voir et modifier les actes des agents de son périmètre ; envoyer en signature et publier. Il touchera aussi aux **feuilles de style** des actes (à venir).", "Gérer le référentiel, les comptes et les API. Il ne sort pas du périmètre de son service (sauf compte **transverse**)."],
          ["**Rédacteur**", "**Choisir une trame** de son périmètre dans l'écran « Rédiger un acte » et **rédiger l'acte** ; puis les actions qui vont avec : enregistrer, exporter, envoyer en signature, publier.", "Voir le registre des trames (« Trames »), créer, modifier ou dupliquer les trames, gérer le référentiel. Il ne voit **que ses propres actes**, dans son périmètre."],
        ] },
        { t: "p", text: "**Le réviseur, un rôle qui se cumule.** Le rôle **Réviseur** ne s'ajoute pas à la liste des profils : il **se cumule** avec un autre profil. Un éditeur des affaires juridiques peut ainsi être *éditeur* **et** *réviseur* : il rédige comme un éditeur, et il contrôle en plus les actes avant leur signature (voir le chapitre « Faire réviser un acte »). Sa **compétence** — les services, familles, types d'actes et entités qu'il révise — se règle sur son compte ; quand la qualité appartient à un **service entier** (ou à certains de ses bureaux), elle se règle sur le service, dans **Administration › Services**." },
        { t: "p", text: "**Le signataire, l'auteur de l'acte.** La qualité **Signataire** se cumule elle aussi : elle ne remplace aucun profil, elle ajoute le **pouvoir de signer**. Elle ne se coche pas dans une liste : elle **découle d'une désignation**. Dès qu'une personne est désignée dans l'organigramme des **Délégations** — comme l'autorité qui délègue, ou comme celui qui signera —, le compte rattaché à cette personne reçoit la qualité, même si la désignation est faite par un éditeur. Concrètement, un signataire **signe avec son compte** : en production, l'annuaire de la collectivité délivre le compte de l'application **et** provisionne le même agent sur l'**outil de signature**, et les deux doivent être **rapprochés** (un bouton, depuis « Ma signature », depuis la fiche du compte, ou depuis celle de l'acteur dans les Délégations). Enfin, un signataire ne voit dans l'atelier **que les actes relevant de son champ de compétence** : ceux qu'il signe lui-même, et ceux que signent ses **délégataires**." },
        { t: "p", text: "**Le visiteur, un compte sans aucun accès.** Un agent peut s'authentifier sans qu'aucun rôle ne lui soit reconnu : c'est le cas, avec l'annuaire, quand aucun de ses groupes ne correspond à un rôle de l'application. Il devient **Visiteur** : sa session est bien ouverte, mais l'atelier ne lui est pas ouvert — il arrive sur un écran qui le lui explique, donne le contact du service qui gère l'application, et le renvoie vers **l'espace public** (le recueil, consultable sans compte). Le profil « Visiteur » s'attribue comme les autres dans **Comptes et rôles**." },
        { t: "p", text: "**Services et bureaux.** Une collectivité se range en **services** (Ressources humaines, État civil, Cabinet…), eux-mêmes subdivisés en **bureaux** (par exemple « Assemblées et actes » et « Courrier et accueil » au sein du Secrétariat général). Chaque agent est rattaché à **un ou plusieurs services**, et chaque **trame** comme chaque **acte** est affecté à un service — et, si besoin, à un bureau précis. Votre périmètre découle de ce rattachement : c'est lui qui décide des trames que l'on vous propose et des actes que vous voyez." },
        { t: "list", items: [
          "Une **trame générale** (sans service) reste visible de tous : ce sont les modèles communs à la collectivité.",
          "Un compte **transverse** a été ajouté à **tous les services** par l'administrateur : il travaille sans frontière de service (c'est le cas, dans le jeu de démonstration, du directeur des affaires juridiques).",
          "Par défaut, rattacher un agent à un service lui ouvre **tous les bureaux** de ce service. L'administrateur peut ensuite **restreindre** l'accès à certains bureaux seulement, si l'organisation le demande.",
        ] },
        { t: "note", kind: "info", title: "Aucune trame ne vous est proposée ?", text: "Une trame n'apparaît que si elle relève de votre périmètre, ou si elle est **générale** (sans service). Si l'écran **Trames** (réservé aux éditeurs et aux administrateurs) ou la liste des modèles de **Rédiger un acte** est vide, c'est qu'aucun modèle n'est rattaché à votre service : demandez à un administrateur d'en rattacher un, ou de le rendre général." },
        { t: "note", kind: "info", title: "Où cela se règle", text: "Les **services et bureaux** se décrivent dans **Administration › Services**. Le **périmètre** de chaque agent (ses services, et éventuellement tel ou tel bureau) se coche dans **Comptes et rôles**, colonne « Périmètre », avec de grands boutons pour tout cocher ou tout retirer. Un compte marqué **« transverse »** couvre l'ensemble des services." },
        { t: "note", kind: "info", title: "Concrètement", text: "Le menu de gauche et les boutons s'adaptent : ce que votre profil n'autorise pas n'est pas affiché. Le registre, lui, ne liste **que ce qui est dans votre périmètre** ; si un collègue vous envoie un lien vers un écran ou un acte interdit, vous revenez simplement à votre écran de travail — rien ne se casse." },
        { t: "p", text: "**Changer de compte** : cliquez sur votre nom, en haut à droite, puis sur « Changer de compte ». Vous revenez à la liste des comptes." },
        { t: "p", text: "**Gérer les comptes** (administrateur uniquement) : menu de votre nom → « Comptes et rôles ». Vous pouvez y créer un compte, changer son rôle, **régler son périmètre** (les services et, au besoin, les bureaux qu'il couvre), lui ajouter une **qualité de réviseur** et en régler la compétence, lui **rattacher la personne du référentiel** qu'il tient (c'est ce qui lui permet de signer en son nom) et **rapprocher son compte de l'outil de signature**, le désactiver ou le supprimer — et y lire la liste exacte des permissions de chaque profil. Deux garde-fous : on ne supprime pas son propre compte, et il doit toujours rester un administrateur actif." },
        { t: "note", kind: "warn", title: "Vos actes restent les vôtres", text: "Un acte garde le nom de l'agent qui l'a rédigé : c'est ce nom qui s'affiche dans le registre et sur la fiche de l'acte. Se connecter avec le compte d'un collègue pour rédiger à sa place est donc **à éviter** — l'acte porterait son nom." },
        { t: "note", kind: "info", title: "Sur une installation de démonstration", text: "Les onze comptes livrés sont **fictifs** et l'authentification est **simulée** : on choisit un compte, sans mot de passe. C'est le mode « comptes de l'application ». L'application connaît **deux autres façons d'ouvrir une session**, décidées par le service qui l'héberge : les **comptes locaux** — un identifiant et un mot de passe, tenus par le service, pour une installation sans annuaire — et l'**annuaire de la collectivité** (annuaire d'entreprise, OpenID Connect), où le rôle vient des groupes de l'agent. Dans ces deux modes, **les comptes de démonstration sont désactivés automatiquement** — voir le chapitre suivant pour les administrateurs." },
        { t: "next", chapter: "demarrer", label: "Revenir au début du guide" },
      ],
    },
    // ------------------------------------------------------------------ 15
    {
      id: "annuaire",
      title: "Ouvrir les sessions : annuaire, ou comptes locaux",
      short: "Pour les administrateurs : les trois façons de se connecter — comptes de l'application, comptes locaux à mot de passe (réglés dans le `.env` du service), ou annuaire d'entreprise (OpenID Connect), y compris en **seconde porte** à côté des deux autres.",
      icon: "lock",
      minutes: 7,
      audience: "admin",
      keywords: "annuaire sso oidc openid connect authentification connexion groupes rôle désactiver comptes démonstration fournisseur identité pkce jeton annuaire d'essai clé signature mot de passe local compte local .env déploiement auto-hébergé identifiant scrypt session cookie csrf administrateur admin seconde porte SCRIBA_ANNUAIRE declaratif variables cors découverte client oidc service",
      blocks: [
        { t: "p", text: "Par défaut, l'application ouvre les sessions avec **ses propres comptes** : on choisit un compte dans la liste, sans mot de passe. C'est très pratique pour essayer, mais ce n'est pas de la sécurité — c'est un mode de démonstration." },
        { t: "p", text: "Pour de vrai, deux voies s'ouvrent, selon que la collectivité a un **annuaire d'entreprise** ou non." },
        { t: "p", text: "**Avec un annuaire, on le branche** : l'agent se connecte chez le fournisseur d'identité de la collectivité (OpenID Connect), et l'application ouvre la session avec le **rôle** et le **périmètre** que lui donnent ses groupes. Dès que l'annuaire est branché, **les comptes de démonstration sont désactivés automatiquement** : ils ne sont plus proposés, aucune session ne peut s'ouvrir sans passer par l'annuaire, et ils apparaissent « Désactivé (annuaire) » dans *Comptes et rôles*." },
        { t: "p", text: "**Sans annuaire, l'application tient elle-même ses comptes locaux.** Chaque agent a un **identifiant et un mot de passe**, vérifiés par le service de la collectivité (c'est lui qui garde les données, et lui seul voit le mot de passe). On se connecte depuis l'écran de connexion, comme sur n'importe quel site ; un mot de passe provisoire remis par l'administrateur doit être **changé à la première connexion**. C'est le mode d'une installation auto-hébergée simple — et c'est sans doute celui que vous lisez si personne n'a configuré d'annuaire." },
        { t: "p", text: "**L'annuaire peut aussi être une SECONDE PORTE.** Il n'est pas obligé d'être la porte principale : dans **Administration › Annuaire (OIDC)**, la case *« Proposer AUSSI la connexion par l'annuaire »* le propose **à côté** de la porte ordinaire (comptes locaux, ou comptes de l'application) — l'écran de connexion affiche alors les deux, la porte ordinaire d'abord. C'est ce qu'il faut pour ouvrir l'annuaire **sans** renoncer aux comptes locaux. Les réglages de l'annuaire sont d'ailleurs **toujours affichés**, quel que soit le mode, et chaque champ posé par le fichier `.env` le dit." },
        { t: "note", kind: "info", title: "Tout l'annuaire se pose aussi dans le `.env`", text: "Les variables **`SCRIBA_ANNUAIRE_*`** (émetteur, identifiant du client, portées, adresse de retour, correspondance des groupes écrite `groupe=rôle`, politique des agents sans groupe, périmètre, points de terminaison, seconde porte, porte de secours) permettent d'équiper **tout un parc d'un coup**, sans cliquer dans chaque interface — et c'est même le **seul moyen de brancher l'annuaire en mode « comptes locaux »**, où le référentiel n'est lisible qu'après la connexion : le service **relit** ces réglages et les **publie** pour l'écran de connexion (aucun secret n'y passe : c'est un client OIDC public, qui n'en détient aucun). La liste complète est dans **Documentation technique › Variables de déploiement**." },
        { t: "note", kind: "warn", title: "La connexion par l'annuaire se fait chez le service", text: "Depuis la version **1.6.1p**, c'est le **service de la collectivité** qui est le client OIDC : il découvre le fournisseur, échange le code (le navigateur lui remet le code et le vérificateur PKCE, qu'il est seul à détenir) et vérifie le jeton avant d'ouvrir **sa** session. Deux conséquences : un annuaire d'entreprise qui **n'ouvre pas le CORS** se branche sans rien changer chez lui (auparavant, la découverte répondait « Failed to fetch » — c'était le navigateur qui refusait, pas l'adresse qui était fausse), et un agent entré par l'annuaire **lit les actes** comme tout le monde, y compris sur un service réglé sur ses propres sessions. Sur un service antérieur à 1.6.1p, la seconde porte n'est pas proposée quand les données se lisent par une session (l'écran d'administration dit quoi mettre à jour). Le jeton d'accès et le jeton d'identité ne traversent jamais le navigateur." },
        { t: "note", kind: "warn", title: "Les comptes locaux se règlent au déploiement, pas dans l'application", text: "Il n'y a **pas d'écran** pour les activer : c'est le fichier **`.env`** du service qui décide (`AUTH_MODE=password`), car lui seul sait si un mot de passe est exigé. Le **compte d'administration** vient de là aussi (`ADMIN_LOGIN`, `ADMIN_PASSWORD`) : il est créé à l'ouverture, puis il **crée les autres comptes** dans **Comptes et rôles** et change son mot de passe pour ne plus dépendre du fichier. Les **comptes de démonstration** se ferment de la même façon (`DEMO_ACCOUNTS=false`, le défaut dans ce mode). Enfin, le **jeu de démonstration** entier — la collectivité fictive, ses trames, ses actes — s'éteint par `DEMO=false` : l'outil part alors d'un **référentiel vierge**, à construire (voir *Installation* et *Prise en main*). Tout est détaillé dans **Installation** (le `README.md` du service de données). Le même fichier peut aussi **poser** l'identité de la collectivité, le vocabulaire des actes, la numérotation, les délais, le recueil et les fonctions expérimentales (variables **`SCRIBA_*`**) : ces réglages s'appliquent par-dessus le référentiel, et leur liste complète est dans **Documentation technique › Variables de déploiement**. Si le compte d'administration disparaît du référentiel — une remise à zéro, un import de données sans les comptes —, le service le **rétablit au démarrage suivant** (son mot de passe, gardé par le service, reste valable), et la commande `--mot-de-passe` sait le recréer au besoin." },
        { t: "note", kind: "info", title: "Ce qui rend un compte local solide", text: "Le mot de passe **n'est jamais conservé** : seul son **empreinte** (scrypt) est en base, et la comparaison se fait à temps constant. La session ouvre un **cookie `HttpOnly`** (un jeton aléatoire, dont seul l'empreinte est gardée) ; les tentatives sont **comptées** — quelques échecs bloquent le compte un moment —, et les écritures sont protégées contre le **faux envoi de formulaire** (CSRF). `COOKIE_SECURE` exige HTTPS : laissez-le allumé en service. C'est le service qui refuse une requête sans session : l'interface n'est que la façade, la barrière est côté serveur — voir l'encadré « Où est la vraie barrière ? » plus bas." },
        { t: "note", kind: "info", title: "L'administrateur local garde sa porte", text: "Brancher l'annuaire ne ferme pas les **comptes locaux** : sous le bouton de l'annuaire, l'écran de connexion offre un bloc « **Ou par un compte local** ». C'est par là qu'entrent le **compte d'administration du fichier `.env`** et les comptes locaux créés à la main — **même si l'annuaire est injoignable** (panne, réseau, fournisseur indisponible). Sans cela, une panne d'annuaire laisserait l'installation sans personne pour ouvrir la session, l'administrateur compris. Ces comptes ne sont proposés que si le service les connaît ; en mode démonstration, il n'y en a aucun." },
        { t: "note", kind: "warn", title: "Réglage du référentiel (mode annuaire)", text: "Il est enregistré avec le reste du référentiel : il **suit l'export** des données, et se règle dans **Administration › Annuaire (OIDC)**. L'application ne détient aucun secret (elle se déclare en **client public**, avec PKCE) : c'est ce qui rend ce branchement possible sans intervention sur les serveurs." },
        { t: "steps", items: [
          { text: "Ouvrez **Administration › Annuaire (OIDC)**, encart « Mode de connexion », et choisissez **Annuaire de la collectivité (OIDC)**.", detail: "Un bandeau vous dit combien de comptes de démonstration viennent d'être désactivés. Si vous étiez connecté avec l'un d'eux, la session se ferme : c'est normal." },
          { text: "Renseignez le **fournisseur** : adresse de l'émetteur, identifiant du client, et l'**adresse de retour** que vous déclarez chez le fournisseur (bouton « Copier l'adresse à déclarer »).", detail: "Le bouton « Vérifier la découverte du fournisseur » lit la configuration publiée et affiche les points de terminaison trouvés. L'interrogation est faite **par le service**, pas par le navigateur : un fournisseur qui refuse les appels d'une autre origine se branche donc sans rien changer chez lui. Si un point de terminaison manque, recopiez-les à la main dans la section repliable." },
          { text: "Réglez la **correspondance des groupes** : quel groupe de l'annuaire donne quel rôle ici.", detail: "Par défaut : `scribae-administrateurs` → Administrateur, `scribae-editeurs` → Éditeur, `scribae-redacteurs` → Rédacteur. Un agent dont aucun groupe n'est reconnu est accueilli comme **visiteur** (aucun accès) : il arrive sur un écran qui lui explique la situation et le renvoie vers l'espace public. Vous pouvez préférer lui donner un rôle de repli." },
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
    {
      id: "api",
      title: "L'API REST : brancher un autre logiciel",
      short: "Ce que l'application expose, et comment l'essayer sans risque.",
      icon: "doc",
      minutes: 6,
      audience: "admin",
      keywords: "api rest route endpoint interface jeton clé curl json openapi intégration interconnexion panneau commande documentation webhook",
      blocks: [
        { t: "p", text: "Tout ce que l'application fait, son **API** le fait : c'est par elle que le navigateur lit et écrit les données. Un autre logiciel — un tableur, un outil de gestion documentaire, un script d'import — peut donc s'y brancher, avec une **clé d'API** et un rôle." },
        { t: "p", text: "L'écran **Aide › API REST** décrit toute cette surface : chaque route, le rôle qu'elle exige, ce qu'elle attend et ce qu'elle répond, avec un exemple de commande prêt à recoller." },
        { t: "steps", items: [
          { text: "Ouvrez **Aide › API REST**. À gauche, les routes groupées par sujet (service, autorisation, comptes, données, actes, signature, publication, courriel) ; à droite, la fiche de celle que vous regardez." },
          { text: "Choisissez une opération, ajustez si besoin le **chemin** (des identifiants d'exemple sont proposés), et le **corps** de la requête s'il y en a un." },
          { text: "Indiquez un **jeton** si le service en demande un, puis cliquez **Envoyer la requête**." },
          { text: "Lisez la **réponse** : son code, sa durée, et son contenu. Le bouton **Copier en cURL** vous donne la commande équivalente, à coller dans un terminal ou dans un ticket." },
        ] },
        { t: "note", kind: "warn", title: "Un envoi écrit vraiment", text: "Le panneau de commande appelle le service pour de bon. Une requête d'écriture **modifie les données** : relisez le chemin et le corps avant de cliquer. Tous les appels figurent ensuite, avec leur requête et leur réponse, dans **API & journal**." },
        { t: "terms", items: [
          { term: "Clé d'API", def: "Le mot de passe d'un logiciel. L'administrateur la crée dans Administration › Base de données (bouton « Créer une clé d'API »), en lui donnant un rôle et un libellé : c'est un compte de SERVICE, qui n'apparaît ni dans « Comptes et rôles » ni dans l'annuaire, et qui ne peut pas faire plus que son rôle. La clé n'est affichée qu'UNE fois, à sa création." },
          { term: "Rôle", def: "Lecteur, rédacteur, éditeur, administrateur — et « prestataire », réservé à la notification de signature. Une route exige un rôle minimal." },
          { term: "Code d'erreur", def: "Quand une requête échoue, la réponse porte un code lisible par un programme (acte_non_signe, role_insuffisant…) : c'est lui qu'il faut traiter, pas le message." },
        ] },
        { t: "note", kind: "info", title: "Une clé n'est pas un compte, et tout est journalisé", text: "Une clé d'API n'est pas un compte d'agent : elle sert à un **script**, un **poste** ou un **outil tiers**, et le référentiel l'ignore. On la **révoque** d'un clic (le service refuse de révoquer la dernière clé d'administration, sans quoi il ne serait plus administrable). Le service tient en outre un **journal d'audit scellé** — chaque ligne scelle la précédente par son empreinte —, lisible par l'administration : il est fait pour être **exporté** et archivé hors du service." },
        { t: "note", kind: "info", title: "La même référence, dans la documentation", text: "L'écran de documentation technique rend **docs/API.md**, engendré depuis la même description que l'écran : le document et l'application ne peuvent pas se contredire. Il est fait pour être joint à un dossier d'intégration." },
        { t: "next", chapter: "comptes", label: "Qui peut faire quoi : comptes et rôles" },
      ],
    },
  ],
};

export const findChapter = (id) => GUIDE.chapters.find((c) => c.id === id) || null;
export const chapterIndex = (id) => GUIDE.chapters.findIndex((c) => c.id === id);

// Recherche très tolérante : on cherche les mots saisis (au moins 3 lettres)
// dans le titre, les mots-clés et le texte de chaque chapitre. La casse, les
// accents et la ponctuation sont ignorés — « exporte », « exporter » et
// « export » se retrouvent —, et les mots grammaticaux (le, de, que, comment…)
// ne comptent pas : ce sont eux qui, sinon, feraient remonter tous les
// chapitres à égalité. Si la recherche stricte ne rend rien, on réessaie sans
// filtre, comme avant : mieux vaut un résultat approximatif que pas de résultat.
const MOTS_GRAMMATICAUX = new Set([
  "les", "des", "une", "que", "qui", "quoi", "dont", "pour", "avec", "dans", "sans", "sur", "sous",
  "comment", "pourquoi", "quand", "est", "sont", "ete", "etre", "fait", "faire", "peut", "peuvent",
  "plus", "pas", "non", "oui", "vous", "nous", "mon", "mes", "ton", "tes", "son", "ses", "cette",
  "cet", "ces", "aux", "par", "quel", "quelle", "quels", "quelles", "tout", "tous", "toute", "toutes",
  "donc", "alors", "aussi", "mais", "comme", "bien", "tres", "deja", "encore", "jamais", "toujours",
  "avoir", "elle", "ils", "elles", "leur", "leurs", "meme", "quand", "apres", "avant", "entre",
]);

export const sansAccents = (s) => String(s == null ? "" : s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

// Les mots d'une question, ramenés à leur forme comparable : sans casse, sans
// accents, sans ponctuation, et sans les mots grammaticaux — ce sont eux qui,
// sinon, feraient remonter tous les chapitres à égalité.
export function motsCles(query) {
  const q = sansAccents(String(query || "").trim());
  if (q.length < 2) return [];
  const strict = [...new Set(q.split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !MOTS_GRAMMATICAUX.has(w)))];
  if (strict.length) return strict;
  return [...new Set(q.split(/[^a-z0-9]+/).filter((w) => w.length >= 2))];
}

// « exporte » doit retrouver « exporter » : on accepte aussi le mot privé de sa
// terminaison. Au-delà de sept lettres, un mot français garde son radical.
export function contientMot(hay, w) {
  if (hay.includes(w)) return true;
  const racine = w.length >= 7 ? w.slice(0, w.length - 2) : w;
  return racine !== w && hay.includes(racine);
}

// Les textes comparables d'un chapitre — calculés une fois, puis gardés : le
// guide est une constante, et la recherche le parcourt à chaque frappe.
//
// On garde les CHAMPS SÉPARÉS (titre, résumé, mots-clés, corps) : un mot du
// TITRE désigne le chapitre bien plus sûrement qu'un mot du corps, et les
// mots-clés sont là pour ça — « signature » dans les mots-clés du chapitre
// « Faire signer un acte » vaut mieux que « signature » perdu dans un
// paragraphe. La pondération est dans `chapitresPertinents`.
const memoTextes = new Map();
function texteDe(chapter, champ, calcul) {
  const cle = champ + ":" + chapter.id;
  let t = memoTextes.get(cle);
  if (t === undefined) { t = calcul(); memoTextes.set(cle, t); }
  return t;
}
const texteTitre = (c) => texteDe(c, "titre", () => sansAccents(c.title));
const texteCourt = (c) => texteDe(c, "court", () => sansAccents(c.short));
const texteMotsCles = (c) => texteDe(c, "mots", () => sansAccents(c.keywords));
const texteCorps = (c) => texteDe(c, "corps", () => sansAccents([...plainText(c)].join(" ")));
const texteTete = (c) => texteDe(c, "tete", () => sansAccents([c.title, c.short, c.keywords].filter(Boolean).join(" ")));
function texteNormalise(chapter) {
  return texteTete(chapter) + " " + texteCorps(chapter);
}

export function searchGuide(query) {
  const words = motsCles(query);
  if (!words.length) return [];
  return GUIDE.chapters
    .map((c) => ({ chapter: c, score: words.reduce((n, w) => n + (contientMot(texteNormalise(c), w) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((x) => x.chapter);
}

// Les chapitres qui RÉPONDENT le mieux à une question, pour l'assistant de
// l'atelier. Deux idées, et elles suffisent :
//   • les champs d'un chapitre sont pondérés : le TITRE dit de quoi il parle
//     (×10), le résumé et les mots-clés aussi mais moins sûrement (×7), le corps
//     de texte seulement quand rien d'autre ne répond (×1) ;
//   • chaque mot est pondéré par sa rareté DANS CE CHAMP : un mot présent dans
//     tous les titres — « acte » — ne désigne personne ; « exporte »,
//     « parapheur » ou « délégation », si. Un mot qui ne vit que dans un seul
//     titre pèse donc dix fois son champ.
const CHAMPS = [
  { poids: 10, texte: texteTitre },
  { poids: 7, texte: texteCourt },
  { poids: 7, texte: texteMotsCles },
  { poids: 1, texte: texteCorps },
];

export function chapitresPertinents(query, max = 3) {
  const words = motsCles(query);
  if (!words.length) return [];
  const chapitres = GUIDE.chapters;
  const scores = chapitres.map(() => 0);
  for (const { poids, texte } of CHAMPS) {
    const textes = chapitres.map(texte);
    for (const w of words) {
      const dedans = textes.map((t) => contientMot(t, w));
      const df = dedans.reduce((n, ok) => n + (ok ? 1 : 0), 0);
      if (!df) continue;
      const points = poids / df;
      dedans.forEach((ok, i) => { if (ok) scores[i] += points; });
    }
  }
  return chapitres
    .map((c, i) => ({ chapter: c, score: scores[i] }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, max)
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

// ------------------------------------------------------------------ mise à plat
// Le guide, mis à plat pour un moteur de langage : du texte suivi, sans la mise
// en forme d'écran (un modèle lit du texte, pas des encadrés). C'est la matière
// de l'assistant de l'atelier — la seule qu'il reçoive, avec la question posée
// (voir src/lib/assistant.js).
const aPlat = (s) => String(s == null ? "" : s).replace(/\*\*/g, "").replace(/`/g, "").replace(/\s+/g, " ").trim();

function blocAPlat(b) {
  switch (b.t) {
    case "p": return aPlat(b.text);
    case "note":
      return "[" + (b.kind === "warn" ? "attention" : b.kind === "ok" ? "à retenir" : "info") + "] "
        + [aPlat(b.title), aPlat(b.text)].filter(Boolean).join(" : ");
    case "steps":
    case "stepscard": {
      const tete = b.title ? aPlat(b.title) + "\n" : "";
      return tete + (b.items || []).map((it, i) => (i + 1) + ". " + aPlat(typeof it === "string" ? it : it.text)).join("\n");
    }
    case "terms": return (b.items || []).map((it) => "- " + aPlat(it.term) + " : " + aPlat(it.def)).join("\n");
    case "list": return (b.items || []).map((it) => "- " + aPlat(typeof it === "string" ? it : it.text)).join("\n");
    case "faq": return (b.items || []).map((it) => "Question : " + aPlat(it.q) + "\nRéponse : " + aPlat(it.a)).join("\n");
    case "table": {
      const lignes = [b.caption ? aPlat(b.caption) : "", (b.head || []).map(aPlat).join(" | "),
        ...(b.rows || []).map((r) => r.map(aPlat).join(" | "))];
      return lignes.filter(Boolean).join("\n");
    }
    case "shot": return "(illustration du guide : " + aPlat(b.shot) + ")";
    case "contact": return "(Le guide affiche ici le contact du service, réglé dans Administration › Identité.)";
    default: return b.text ? aPlat(b.text) : "";
  }
}

// Un chapitre entier, en texte suivi.
export function chapitreEnTexte(c) {
  if (!c) return "";
  const entete = "## " + aPlat(c.title) + (c.short ? " — " + aPlat(c.short) : "");
  const corps = (c.blocks || []).map(blocAPlat).filter(Boolean).join("\n");
  return entete + "\n" + corps;
}

// Le lien d'un chapitre, tel qu'il se clique DANS l'application : « #/aide/<id> ».
// C'est cette forme — et elle seule — que l'assistant recopie dans ses réponses ;
// le panneau de conversation l'intercepte et l'ouvre sans recharger la page.
export const lienChapitre = (chapitre) => {
  const id = typeof chapitre === "string" ? chapitre : chapitre && chapitre.id;
  const c = typeof chapitre === "string" ? findChapter(chapitre) : chapitre;
  if (!id || !c) return "";
  return "[" + aPlat(c.title) + "](#/aide/" + id + ")";
};

// La table des matières, une ligne par chapitre : elle permet à l'assistant de
// savoir ce qui existe — et de renvoyer au bon chapitre par son LIEN — même quand
// le chapitre détaillé n'a pas été joint.
export function guideSommaire() {
  return GUIDE.chapters
    .map((c) => "- " + aPlat(c.title) + (c.short ? " : " + aPlat(c.short) : "") + " — lien : " + lienChapitre(c))
    .join("\n");
}
