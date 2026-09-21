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

-- Mots de passe des comptes locaux (mode « mot de passe » du service).
--   • jamais de mot de passe en clair, ici ni ailleurs ;
--   • `hash` porte `scrypt$N$r$p$sel$empreinte` : les paramètres voyagent avec
--     le dérivé, ce qui permet de durcir le coût sans invalider les comptes ;
--   • `echecs` / `bloque_jusqua` comptent les tentatives infructueuses : le
--     compte se bloque progressivement (voir src/server/mysql/comptes.mjs) ;
--   • `must_change` exige un changement de mot de passe à la première connexion
--     (remise d'un mot de passe provisoire par un administrateur).
-- Le compte lui-même (nom, rôles, rattachement) reste dans `sb_record`
-- (collection `users`) : cette table ne porte que le secret.
CREATE TABLE IF NOT EXISTS sb_motdepasse (
  user_id       VARCHAR(191) NOT NULL,
  hash          VARCHAR(255) NOT NULL,
  must_change   TINYINT(1)   NOT NULL DEFAULT 0,
  echecs        INT          NOT NULL DEFAULT 0,
  bloque_jusqua DATETIME(3)  NULL,
  updated_at    DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sessions ouvertes (mode « mot de passe »). La base ne conserve que l'EMPREINTE
-- SHA-256 du jeton remis au navigateur : la lire ne permet pas de se connecter.
CREATE TABLE IF NOT EXISTS sb_session (
  token_hash   CHAR(64)     NOT NULL,
  user_id      VARCHAR(191) NOT NULL,
  created_at   DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  last_seen_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  expires_at   DATETIME(3)  NOT NULL,
  remote_ip    VARCHAR(64)  NULL,
  user_agent   VARCHAR(255) NULL,
  PRIMARY KEY (token_hash),
  KEY idx_sb_session_user (user_id, expires_at),
  KEY idx_sb_session_expire (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Journal des courriels : une ligne par envoi tenté — parti, ou refusé (avec son
-- motif). C'est la piste de l'administrateur : « ce courriel est-il parti, à qui,
-- quand, et sinon pourquoi ? ». Le corps du message n'y est PAS conservé (les
-- actes sont au registre ; inutile de dupliquer des données personnelles) : seuls
-- l'événement, les destinataires et le résultat le sont.
CREATE TABLE IF NOT EXISTS sb_courriel (
  id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  evenement     VARCHAR(64)   NOT NULL,
  acte_id       VARCHAR(191)  NULL,
  cible         VARCHAR(191)  NULL,
  destinataires TEXT          NULL,
  sujet         VARCHAR(255)  NULL,
  envoye        TINYINT(1)    NOT NULL DEFAULT 0,
  motif         VARCHAR(500)  NULL,
  acteur        VARCHAR(191)  NULL,
  remote_ip     VARCHAR(64)   NULL,
  at            DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_sb_courriel_at (at),
  KEY idx_sb_courriel_acte (acte_id, at)
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
