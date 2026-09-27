// ============================================================================
// Préférences d'AFFICHAGE, propres au poste.
//
// Ce que l'agent règle pour SON confort — la barre de gauche repliée, et demain
// la taille du texte — ne se range pas dans le référentiel : ce n'est pas une
// donnée de la collectivité, cela ne s'exporte pas, et deux collègues devant le
// même acte peuvent vouloir deux affichages différents. C'est le même parti pris
// que le thème clair/sombre (voir lib/theme.js) et que la préférence d'affichage
// des assistants (voir lib/assistant.js) : une clé `localStorage`, un repli
// silencieux quand le poste n'a pas de stockage (navigation privée, iframe
// restreinte) — l'application doit rester utilisable, sans préférence.
//
// Les valeurs sont des CHAÎNES : `prefBool` / `setPrefBool` sont là pour que
// personne n'ait à se souvenir de « 1 » plutôt que de « true ».
// ============================================================================

const PREFIXE = "scribae.pref.";

export function pref(nom, defaut = null) {
  try {
    const v = localStorage.getItem(PREFIXE + nom);
    return v === null ? defaut : v;
  } catch (e) {
    return defaut;
  }
}

export function setPref(nom, valeur) {
  try {
    if (valeur === null || valeur === undefined) localStorage.removeItem(PREFIXE + nom);
    else localStorage.setItem(PREFIXE + nom, String(valeur));
  } catch (e) { /* poste sans stockage : la préférence ne survivra pas au rechargement */ }
}

export const prefBool = (nom, defaut = false) => pref(nom, defaut ? "1" : "0") === "1";

export const setPrefBool = (nom, v) => setPref(nom, v ? "1" : "0");

// La préférence est-elle POSÉE ? Sert à distinguer « l'agent a choisi de
// déplier » de « l'agent n'a rien choisi, on suit la largeur de l'écran ».
export const prefPosee = (nom) => pref(nom, null) !== null;
