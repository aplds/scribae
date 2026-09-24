// ============================================================================
// LES CHATS DES PAGES D'ERREUR (http.cat) — la règle, écrite une fois.
//
// UNE PAGE D'ERREUR EST UN MOMENT DÉSAGRÉABLE : on cherchait un acte, on tombe
// sur « introuvable » ; on s'est trompé d'adresse ; le service n'a pas répondu.
// Le service public http.cat publie une photographie de chat par code HTTP —
// c'est son objet, et c'est fait pour être lié depuis une page d'erreur. Poser
// l'une de ces images sur nos pages d'erreur les rend moins sèches, sans rien
// retirer à ce qu'elles doivent dire.
//
// C'EST UNE OPTION, ÉTEINTE PAR DÉFAUT, que l'administration allume
// (`config.publication.chatsErreur`). Deux raisons, et la seconde suffirait :
//
//   • une page d'erreur d'un service public n'a pas à être gaie — certaines
//     collectivités préfèrent la sobriété, et c'est leur site ;
//   • LIER UNE IMAGE, C'EST LA DEMANDER À UN TIERS. Le navigateur du visiteur
//     ouvre alors une connexion vers http.cat, qui voit son adresse IP, et le
//     `Referer` de la page. Ce n'est pas un appel que l'on fait à la légère :
//     l'option est donc éteinte par défaut, son libellé le dit, et l'écran
//     d'administration renvoie vers la documentation de ce transfert.
//
// LE REPLI PAR CLASSE. http.cat ne publie pas toutes les combinaisons de codes
// — `299` n'existe pas, alors que `599` existe. Plutôt que de lier une adresse
// qui rendra le 404 de son propre service (une image de chat 404 sur une page
// qui n'est pas un 404, c'est-à-dire un mensonge), on choisit ICI le code
// EFFECTIVEMENT SERVI : le code demandé s'il est publié, sinon le représentant
// de sa classe (`1xx` → 100, `2xx` → 200, `3xx` → 300, `4xx` → 400, `5xx` →
// 500). Le code affiché, lui, reste celui de la page : l'image ne fait
// qu'illustrer.
//
// POURQUOI CE FICHIER EST SOUS `src/server/mysql/` ET NON SOUS `src/lib/` :
// l'image Docker du service se construit avec `src/server/mysql/` pour contexte
// (voir mysql/Dockerfile) — un fichier hors de ce dossier n'existerait pas dans
// l'image. Le navigateur, lui, l'importe par son chemin relatif
// (`../server/mysql/chats-erreur.mjs`) : le module est PUR — aucun DOM, aucun
// accès réseau, aucune dépendance — donc les deux s'en servent sans réserve.
// C'est le même arrangement que `original-signe.mjs`.
// ============================================================================

// L'adresse du service. Une seule constante : un déploiement qui voudrait
// héberger sa propre copie n'a qu'ici à changer d'adresse.
export const CHAT_SOURCE = "https://http.cat";

// Les codes que http.cat publie réellement (relevé dans son dépôt, dossier
// `public/images`). C'est ce qui permet le repli par classe ci-dessous : lier
// un code absent servirait l'image du 404 de http.cat, avec le code 404.
//
// Le « 0 » figure au catalogue — http.cat le publie — mais n'est jamais rendu :
// ce n'est pas l'erreur d'une page, seulement la vignette d'accueil du site.
// `codeChat` refuse tout ce qui sort de 100–599, et donc le 0 avec le reste.
export const CODES_CHAT = [
  0, 100, 101, 102, 103, 200, 201, 202, 203, 204, 205, 206, 207, 208, 214, 226,
  300, 301, 302, 303, 304, 305, 307, 308,
  400, 401, 402, 403, 404, 405, 406, 407, 408, 409, 410, 411, 412, 413, 414,
  415, 416, 417, 418, 419, 420, 421, 422, 423, 424, 425, 426, 428, 429, 431,
  444, 450, 451, 495, 496, 497, 498, 499,
  500, 501, 502, 503, 504, 506, 507, 508, 509, 510, 511, 521, 522, 523, 525,
  530, 599,
];

const PUBLIES = new Set(CODES_CHAT);

// Le représentant d'une classe de codes : le repli quand le code exact n'est pas
// publié. C'est ce qui garantit qu'une image servie est toujours celle du code
// annoncé.
const REPRESENTANT = { 1: 100, 2: 200, 3: 300, 4: 400, 5: 500 };

// Le code EFFECTIVEMENT servi par http.cat pour un code voulu. `null` si la
// valeur n'est pas un code HTTP plausible (négatif, énorme, non numérique) : on
// ne lie alors rien du tout — mieux vaut pas d'image qu'un 404 de http.cat.
export function codeChat(code) {
  const n = Number(code);
  if (!Number.isFinite(n)) return null;
  const c = Math.trunc(n);
  if (c < 100 || c > 599) return null;
  if (PUBLIES.has(c)) return c;
  return REPRESENTANT[Math.floor(c / 100)] || null;
}

// L'adresse de l'image, ou `null`. C'est l'adresse courte et documentée de
// http.cat (`/404`), qui répond directement l'image — pas besoin d'aller la
// chercher dans son dossier `images/`.
export function urlChat(code) {
  const c = codeChat(code);
  return c === null ? null : `${CHAT_SOURCE}/${c}`;
}

// La légende par défaut de quelques codes que nous servons vraiment. Le
// vocabulaire est celui du service et des pages : « Accès refusé » pour un
// atelier fermé, « Page introuvable » pour un acte absent. Un code absent de
// cette table reçoit une légende neutre (« Erreur 507 »), jamais l'inverse.
const LEGENDES = {
  400: "Requête incorrecte",
  401: "Authentification requise",
  403: "Accès refusé",
  404: "Page introuvable",
  410: "Page retirée",
  418: "Je suis une théière",
  429: "Trop de demandes",
  451: "Indisponible pour raisons légales",
  500: "Erreur du serveur",
  502: "Passerelle en panne",
  503: "Service indisponible",
  504: "Délai dépassé",
};

// Ce qu'une page d'erreur a besoin de savoir : le code affiché (celui de la
// page, pas celui de l'image), l'adresse de l'image, son texte de remplacement
// (l'`alt`, qui décrit l'image à qui ne la voit pas) et sa légende. `options`
// permet à une page de dire autre chose — l'`alt` par défaut parle du chat, pas
// de l'erreur, et c'est volontaire : l'image est un ornement, pas l'information.
export function chatPour(code, options = {}) {
  const c = codeChat(code);
  if (c === null) return null;
  const affiche = Number(code);
  return {
    code: c,
    affiche: Number.isFinite(affiche) ? Math.trunc(affiche) : c,
    url: urlChat(c),
    alt: options.alt || `Photographie de chat illustrant l'erreur ${c} (http.cat)`,
    legende: options.legende || LEGENDES[c] || `Erreur ${c}`,
    source: CHAT_SOURCE,
  };
}
