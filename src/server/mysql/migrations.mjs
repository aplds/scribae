// ============================================================================
// Migrations versionnées du schéma.
//
// `schema.sql` est IDEMPOTENT : on peut le rejouer sans risque, et c'est ce qui
// a longtemps fait office de migration. Mais il ne laisse aucune trace : rien ne
// dit à quelle version une base se trouve, ni si un fichier a été modifié après
// coup, ni quand une évolution est passée. Cette table comble ce manque :
//
//   1. `sb_migrations` (version, nom, empreinte, date) ;
//   2. une liste ORDONNÉE de migrations, chacune appliquée UNE fois ;
//   3. le socle (`schema.sql`) EST la version 1 : une base neuve le reçoit comme
//      les autres, et une base antérieure au mécanisme le reçoit une fois.
//
// LA RÈGLE POUR LA SUITE : on ne MODIFIE plus `schema.sql` pour faire évoluer
// une base en service — une base qui l'a déjà appliqué ne le rejouerait pas. Une
// évolution ajoute une entrée à `MIGRATIONS` (un fichier `migrations/NNN-….sql`
// à côté de `schema.sql`), et c'est tout. L'empreinte conservée prévient quand
// une migration déjà appliquée a changé depuis : la base et les fichiers ne
// disent alors plus la même chose, et le journal le signale.
//
// Le module est PUR : la connexion (`query`) et la lecture de fichier
// (`lireFichier`) sont injectées, ce qui le rend éprouvable sans base ni réseau.
// ============================================================================

export const TABLE_MIGRATIONS = "sb_migrations";

// Créée AVANT tout le reste : c'est elle qui dit ce qui a déjà été appliqué. Le
// socle la recrée de son côté (`IF NOT EXISTS`) pour que le schéma se lise seul.
export const SQL_TABLE_MIGRATIONS = `CREATE TABLE IF NOT EXISTS sb_migrations (
  version      INT UNSIGNED NOT NULL,
  nom          VARCHAR(191) NOT NULL,
  checksum     CHAR(64)     NOT NULL,
  appliquee_le DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (version)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`;

// LA LISTE DES MIGRATIONS, dans l'ordre. `fichier` est relatif au dossier du
// service (`src/server/mysql/`) ; `sql` permet une migration d'une seule
// instruction écrite ici, sans fichier.
export const MIGRATIONS = [
  { version: 1, nom: "socle", fichier: "schema.sql" },
];

// Les migrations déjà appliquées, indexées par version. La table est créée au
// passage : une base neuve comme une base ancienne la reçoit ici, avant toute
// lecture — c'est la seule instruction qui doive passer deux fois.
export async function migrationsAppliquees(query) {
  await query(SQL_TABLE_MIGRATIONS);
  const [lignes] = await query("SELECT version, nom, checksum FROM sb_migrations");
  const faites = new Map();
  for (const l of lignes || []) faites.set(Number(l.version), l);
  return faites;
}

// Applique les migrations manquantes et rend le compte. `journal` reçoit
// (niveau, message) — le service y branche sa sortie ; les épreuves y branchent
// une liste. Une migration dont l'empreinte a changé depuis son application
// n'est PAS rejouée : elle est signalée, et la base reste en l'état.
export async function appliquerMigrations({ query, lireFichier, sha256, journal = () => {} }) {
  const faites = await migrationsAppliquees(query);
  const appliquees = [];
  for (const m of MIGRATIONS) {
    const sql = m.fichier ? await lireFichier(m.fichier) : String(m.sql || "");
    const checksum = sha256(sql);
    const deja = faites.get(m.version);
    if (deja) {
      if (String(deja.checksum) !== checksum) {
        journal("avertissement", `Migration ${m.version} (« ${m.nom} ») : le fichier a changé depuis son application (base ${String(deja.checksum).slice(0, 12)}…, fichier ${checksum.slice(0, 12)}…). La base n'est pas rejouée — ajoutez une migration.`);
      }
      continue;
    }
    await query(sql);
    await query("INSERT INTO sb_migrations (version, nom, checksum) VALUES (?, ?, ?)", [m.version, m.nom, checksum]);
    appliquees.push(m.version);
    journal("appliquee", `Migration ${m.version} — ${m.nom}.`);
  }
  return { appliquees, total: MIGRATIONS.length, aJour: faites.size + appliquees.length };
}
