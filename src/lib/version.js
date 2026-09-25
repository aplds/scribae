// ============================================================================
// Version du logiciel et suivi des livraisons.
//
// SOURCE UNIQUE du numéro de version : il vit ici, et nulle part ailleurs. Ne
// pas le confondre avec les autres numéros du dépôt, qui désignent des formats
// et non le logiciel :
//
//   • `SERVICE_VERSION` (index.html)      — la version du service d'API ;
//   • `STATE_VERSION` (index.html)        — le format de l'état durable du service ;
//   • `SEED_VERSION` (src/lib/store.js)   — la version du jeu de démonstration.
//
// Convention de versionnement (voir `src/CHANGELOG.md`, et « Flux de travail :
// Perchance ↔ GitHub » dans `src/README.md`) :
//
//   • une version n'existe qu'une fois FIGÉE — c'est-à-dire déposée sur GitHub.
//     On ouvre et on date l'entrée du changelog à ce moment-là, jamais avant ;
//   • entre deux livraisons, le travail achevé reçoit une NOTE INTERMÉDIAIRE
//     dans le changelog (`1.3.1a`, `1.3.1b`…) : un numéro de correctif suivi
//     d'une lettre, daté. Une note n'est pas forcément un brouillon : elle peut
//     être publiée à son tour, et elle EST alors la version courante ;
//   • `APP_VERSION` reproduit donc le titre de la PREMIÈRE entrée datée du
//     changelog, lettre comprise. Si les deux divergent, c'est le changelog qui
//     dit la vérité, et il faut corriger `APP_VERSION`.
// ============================================================================

export const APP_VERSION = "1.6.1w";

// Date de la version courante (ISO, AAAA-MM-JJ).
export const APP_RELEASED = "2026-09-29";

// Le changelog est un fichier du dépôt, pas une donnée recopiée dans le code :
// l'écran « Documentation technique » le lit tel quel (comme README/SPEC/TODO).
export const CHANGELOG_PATH = "src/CHANGELOG.md";

export const versionLabel = (version = APP_VERSION) => "v" + version;

// Date lisible à la française, sans dépendre de lib/util (module volontairement
// sans aucune dépendance : il est importé par la coquille au démarrage).
export function releasedLabel(date = APP_RELEASED) {
  const [y, m, d] = String(date || "").split("-");
  return d ? `${d}/${m}/${y}` : String(date || "");
}

// Étiquette complète, telle qu'affichée dans l'interface : « Scribae v1.0.1 ».
export const versionBadge = (name = "") => [name, versionLabel()].filter(Boolean).join(" ").trim();
