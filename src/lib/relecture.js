// ============================================================================
// Une lecture qui ÉCHOUE n'est pas une lecture qui rend VIDE.
//
// L'application lit presque partout un service : le registre public, les
// billets du recueil, le bulletin, les publications de l'atelier, les décisions
// publiées que vise une délégation. Une réponse VIDE est une réponse — « il n'y
// a rien » ; un échec (service injoignable, canal fermé, délai dépassé, service
// en cours de réamorçage) n'en est pas une.
//
// Confondre les deux se paie à l'écran : l'information DISPARAÎT sans le dire,
// et, la lecture « aboutie » restant en mémoire, elle ne revient plus jamais —
// le défaut constaté sur la rubrique « Informations » du recueil public, dont
// la liste vide était gardée après un service muet.
//
// Ce module tient la règle UNE SEULE FOIS : une lecture se souvient de son
// dernier échec, refuse de conclure tant qu'il est récent (de quoi ne pas
// marteler un service en panne, assez court pour qu'une reconnexion se voie),
// et laisse la prochaine occasion la rejouer. Il ne connaît ni le DOM ni le
// réseau — les vues lui passent la main quand l'occasion se présente.
// ============================================================================

// Le délai pendant lequel une lecture qui vient d'échouer n'est pas rejouée.
// Même ordre que les reprises de l'amorçage du recueil (voir
// src/ui/demo-publications.js) : quelques secondes, le temps qu'un service se
// réveille, sans transformer un redessin en boucle d'appels.
export const DELAI_RELECTURE = 6000;

// La veille d'une lecture. Elle ne retient QUE ce que la règle demande : le
// moment du dernier échec.
export function veille() {
  let echecLe = 0;
  return {
    // Peut-on (re)lire ? Non tant qu'un échec récent n'a pas expiré : sans
    // cela, un écran qui se redessine en boucle harcèlerait un service muet.
    get prete() { return !echecLe || Date.now() - echecLe >= DELAI_RELECTURE; },
    // La lecture a échoué : on n'a RIEN conclu, et on repassera.
    echec() { echecLe = Date.now(); },
    // La lecture a abouti — même en rendant une liste vide, qui est une
    // réponse : il n'y a plus rien à repasser.
    succes() { echecLe = 0; },
    get enEchec() { return echecLe > 0; },
  };
}
