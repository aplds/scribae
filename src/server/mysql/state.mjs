// ============================================================================
// Persistance de l'état du service de signature et de publication.
//
// L'état (actes déposés, circuits, publications, clés d'idempotence) forme un
// document JSON unique. Il est conservé **dans la base de la collectivité**
// (`sb_etat`) plutôt que sur le disque du conteneur : il suit donc les mêmes
// sauvegardes, la même réplication et le même PRA que le reste, et il survit au
// remplacement d'un conteneur.
//
// Écriture : `saveState` remplace le document d'un bloc (une ligne, un UPDATE).
// C'est volontaire : l'état est petit (quelques centaines de Kio), les écritures
// sont rares (une par dépôt, signature ou publication) et un document unique
// évite toute écriture partielle.
// ============================================================================

import { emptyState } from "./actes.mjs";

const NAME = "service";

export async function loadState(pool) {
  try {
    const [rows] = await pool.query("SELECT payload FROM sb_etat WHERE name = ?", [NAME]);
    if (!rows.length) return emptyState();
    const parsed = JSON.parse(rows[0].payload);
    return { ...emptyState(), ...parsed };
  } catch (e) {
    // Table absente (schéma non migré) ou document illisible : on démarre sur un
    // état vide plutôt que de refuser de servir.
    console.error("État du service indisponible, démarrage à vide :", e.message);
    return emptyState();
  }
}

export async function saveState(pool, json) {
  await pool.query(
    `INSERT INTO sb_etat (name, payload, revision) VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE payload = VALUES(payload), revision = revision + 1`,
    [NAME, json],
  );
  return true;
}
