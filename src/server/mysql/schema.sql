-- ============================================================================
-- Scribae — schéma de la base de données des actes
-- Compatible MySQL 5.7+ / 8.x et MariaDB 10.2+ (moteur InnoDB, utf8mb4).
--
-- Le modèle suit celui de l'application : le document (une trame, un acte, un
-- compte, ou le référentiel entier) est conservé dans `sb_record.payload`, et
-- ses champs utiles aux recherches sont recopiés dans des colonnes indexées
-- (`numero`, `statut`, `service_id`, `bureau_id`, `entity_id`). Le service
-- (server.mjs) tient ces colonnes à jour à chaque écriture : elles ne sont
-- jamais saisies à la main.
--
-- Toute écriture laisse une trace dans `sb_journal` : c'est le registre des
-- modifications, consultable en SQL (qui a touché quoi, quand).
-- ============================================================================

SET NAMES utf8mb4;

-- Une ligne par collection : le compteur de révision est incrémenté à chaque
-- écriture. Il sert à dater les changements d'ensemble (synthèses, exports).
CREATE TABLE IF NOT EXISTS sb_collection (
  name       VARCHAR(64)     NOT NULL,
  revision   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un enregistrement : un objet identifié de l'application.
--   collection='config' → un seul enregistrement, d'id 'self'
--   collection='trames' → un enregistrement par trame (id = id de la trame)
--   collection='actes'  → un enregistrement par acte
--   collection='users'  → un enregistrement par compte
-- `revision` est la version de l'enregistrement : le client la renvoie à
-- l'écriture, ce qui permet de refuser un écrasement concurrent.
CREATE TABLE IF NOT EXISTS sb_record (
  collection VARCHAR(64)  NOT NULL,
  id         VARCHAR(191) NOT NULL,
  revision   BIGINT UNSIGNED NOT NULL DEFAULT 1,
  ord        INT          NOT NULL DEFAULT 0,
  payload    LONGTEXT     NOT NULL,
  numero     VARCHAR(64)  NULL,
  statut     VARCHAR(64)  NULL,
  service_id VARCHAR(64)  NULL,
  bureau_id  VARCHAR(64)  NULL,
  entity_id  VARCHAR(64)  NULL,
  kind       VARCHAR(64)  NULL,
  updated_by VARCHAR(191) NULL,
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (collection, id),
  KEY idx_sb_record_ordre   (collection, ord),
  KEY idx_sb_record_statut  (collection, statut),
  KEY idx_sb_record_numero  (collection, numero),
  KEY idx_sb_record_service (collection, service_id),
  KEY idx_sb_record_maj     (collection, updated_at),
  CONSTRAINT fk_sb_record_collection FOREIGN KEY (collection) REFERENCES sb_collection (name) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Registre des modifications : une ligne par enregistrement écriture/supprimé.
CREATE TABLE IF NOT EXISTS sb_journal (
  id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  collection VARCHAR(64)  NOT NULL,
  record_id  VARCHAR(191) NOT NULL,
  action     VARCHAR(16)  NOT NULL,
  revision   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  actor      VARCHAR(191) NULL,
  remote_ip  VARCHAR(64)  NULL,
  at         DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sb_journal_collection (collection, at),
  KEY idx_sb_journal_record (collection, record_id, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- État du service de signature et de publication : un document JSON unique
-- (actes déposés, circuits, publications, clés d'idempotence). Conservé en base
-- pour suivre les sauvegardes et survivre au remplacement d'un conteneur.
CREATE TABLE IF NOT EXISTS sb_etat (
  name       VARCHAR(64)  NOT NULL,
  payload    LONGTEXT     NOT NULL,
  revision   BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Vues de lecture : le registre des actes et la liste des trames, en clair.
CREATE OR REPLACE VIEW v_acte AS
SELECT r.id AS acte_id,
       r.numero, r.statut, r.service_id, r.bureau_id, r.entity_id, r.kind,
       r.revision, r.updated_at, r.updated_by,
       JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.objet'))         AS objet,
       JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.dateSignature')) AS date_signature,
       JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.createdByName')) AS redacteur
FROM sb_record r
WHERE r.collection = 'actes';

CREATE OR REPLACE VIEW v_trame AS
SELECT r.id AS trame_id,
       r.statut, r.service_id, r.bureau_id, r.kind,
       r.revision, r.updated_at, r.updated_by,
       JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.name'))    AS nom,
       JSON_UNQUOTE(JSON_EXTRACT(r.payload, '$.version')) AS version
FROM sb_record r
WHERE r.collection = 'trames';

-- Vue de synthèse : l'état de chaque collection.
CREATE OR REPLACE VIEW v_collection AS
SELECT c.name, c.revision, c.updated_at, COUNT(r.id) AS enregistrements
FROM sb_collection c
LEFT JOIN sb_record r ON r.collection = c.name
GROUP BY c.name, c.revision, c.updated_at;
