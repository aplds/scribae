// ============================================================================
// Le bouchon `mysql2/promise` — une base en mémoire partagée par le processus.
//
// Le service importe `mysql2/promise` et appelle `createPool` / `createConnection`.
// Le crochet `crochets.mjs` amène ici ; ce module fabrique UNE base (celle de
// `faux-mysql.mjs`) et la présente sous le contrat de `mysql2`.
//
// La base est exposée dans `globalThis.__SCRIBA_BASE__` : c'est par là que
// l'outil de charge la sonde (ordres SQL comptés, mot de passe du compte,
// contenu des tables) sans qu'aucune ligne du service n'ait à le savoir.
//
// `SCRIBA_CHARGE_LATENCE` (millisecondes par ordre SQL) simule une base
// distante : c'est le moyen le plus direct de voir ce que coûte au service un
// aller-retour, et de distinguer le coût de sa LOGIQUE de celui du réseau.
// ============================================================================

import { creerBase } from "./faux-mysql.mjs";

const lireLatence = () => {
  if (typeof process === "undefined" || !process.env) return 0;
  return Number(process.env.SCRIBA_CHARGE_LATENCE) || 0;
};

export const base = creerBase({ latenceMs: lireLatence() });
export const createPool = (cfg) => base.createPool(cfg);
export const createConnection = (cfg) => base.createConnection(cfg);

try { globalThis.__SCRIBA_BASE__ = base; } catch (e) { /* environnement sans globalThis : sans objet */ }

export default { createPool, createConnection };
