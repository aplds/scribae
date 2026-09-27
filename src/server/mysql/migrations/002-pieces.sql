-- ============================================================================
-- Migration 2 — LA TABLE DES PIÈCES.
--
-- Les PIÈCES sont les fichiers joints à un acte : l'original signé d'une reprise
-- d'acte ancien (le scan du papier), et la version signée d'un acte mené par le
-- CIRCUIT EXTERNE (le PDF signé hors de l'application). L'application les
-- déposait chez l'hôte de la plateforme ; une installation auto-hébergée n'a pas
-- cet hôte, et les range donc dans son service (voir src/lib/fichiers.js).
--
-- POURQUOI UNE TABLE À PART, ET NON L'ÉTAT. L'état du service (`sb_etat`) est un
-- document JSON relu et réécrit EN ENTIER à chaque écriture : y loger des
-- mégaoctets de scan ferait payer ce poids à chaque dépôt, à chaque publication
-- et à chaque redémarrage. Une pièce est donc une ligne à elle, écrite une fois
-- et lue à la demande — exactement comme le rangement par fichiers la range dans
-- son propre fichier (`pieces/<id>.json`).
--
-- LE CONTENU EST EN BASE64 (`base64`, LONGTEXT) : le même format que celui
-- échangé par l'API, qui lit ses corps en UTF-8. Une colonne binaire aurait
-- obligé le client, le canal temps réel de l'édition en ligne et le rangement
-- par fichiers à connaître deux formes.
--
-- `id` est tiré au hasard (32 caractères hexadécimaux) : l'adresse de la pièce
-- (`/v1/pieces/{id}`) est PUBLIQUE, et ce jeton est le seul droit d'entrée. Une
-- pièce citée par une publication ne peut pas être retirée (voir server.mjs).
--
-- Cette migration est IDEMPOTENTE, comme le socle : la rejouer ne détruit rien.
-- ============================================================================

CREATE TABLE IF NOT EXISTS sb_piece (
  id         CHAR(32)        NOT NULL,
  nom        VARCHAR(240)    NOT NULL,
  type       VARCHAR(80)     NOT NULL DEFAULT 'application/octet-stream',
  taille     BIGINT UNSIGNED NOT NULL DEFAULT 0,
  sha256     VARCHAR(128)    NOT NULL DEFAULT '',
  base64     LONGTEXT        NOT NULL,
  depose_le  DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  depose_par VARCHAR(191)    NULL,
  PRIMARY KEY (id),
  KEY idx_sb_piece_depot (depose_le)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
