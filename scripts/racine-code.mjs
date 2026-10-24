// ============================================================================
// Où vit le code de l'application — pour l'outillage qui doit le lire.
//
// POURQUOI CE MODULE. Le dépôt range l'outillage à sa RACINE (`scripts/`,
// `tests/`) et le code de l'application sous `src/`. Un script ne peut pas
// déduire la racine du code de sa propre place : il la CONSTATE — c'est le
// dossier qui porte `lib/version.js`.
//
// Les scripts qui l'emploient lisent ainsi le code sans variable
// d'environnement ni option à retenir. C'est le même raisonnement que celui du
// contrôle de style, où un décalage entre l'outil et l'arborescence qu'il
// contrôle avait éteint toutes ses exemptions (audit, NC-I-009).
// ============================================================================
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Le dossier qui porte l'outillage : `scripts/` est l'un de ses enfants, et
// `tests/` l'autre — c'est la racine du dépôt.
export const RACINE_OUTILLAGE = fileURLToPath(new URL("..", import.meta.url));

// Le dossier qui porte `lib/`, `ui/`, `pages/`, `server/` — donc tout le code.
export const RACINE_CODE = join(RACINE_OUTILLAGE, "src");
