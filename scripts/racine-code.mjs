// ============================================================================
// Où vit le code de l'application — pour l'outillage qui doit le lire.
//
// POURQUOI CE MODULE. Le dépôt range l'outillage à sa RACINE (`scripts/`,
// `tests/`) et le code de l'application sous `src/` — c'est la disposition
// livrée. Dans l'atelier, tout voisine sous `src/` (le seul arbre que la
// plateforme conserve d'une séance à l'autre) : `src/scripts/`, `src/tests/`,
// `src/lib/`. Un script ne peut donc pas déduire la racine du code de sa propre
// place : il la CONSTATE — c'est le dossier qui porte `lib/version.js`.
//
// Les scripts qui l'emploient lisent ainsi le code dans les deux dispositions,
// sans variable d'environnement ni option à retenir. C'est le même raisonnement
// que celui du contrôle de style, où un décalage entre l'outil et la disposition
// qu'il contrôle avait éteint toutes ses exemptions (audit, NC-I-009).
// ============================================================================
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Le dossier qui porte l'outillage : `scripts/` est l'un de ses enfants, et
// `tests/` l'autre. C'est la racine du dépôt dans la disposition livrée, et
// `src/` dans l'atelier.
export const RACINE_OUTILLAGE = fileURLToPath(new URL("..", import.meta.url));

// Le dossier qui porte `lib/`, `ui/`, `pages/`, `server/` — donc tout le code.
export const RACINE_CODE = existsSync(join(RACINE_OUTILLAGE, "lib", "version.js"))
  ? RACINE_OUTILLAGE
  : existsSync(join(RACINE_OUTILLAGE, "src", "lib", "version.js"))
    ? join(RACINE_OUTILLAGE, "src")
    : RACINE_OUTILLAGE;
