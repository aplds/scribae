// ============================================================================
// Une BASE MySQL EN MÉMOIRE — le minimum qui fait tourner le service.
//
// POURQUOI CE MODULE EXISTE. Éprouver le service (`server.mjs`) sous charge
// demande une base. Installer MySQL et MariaDB sur chaque poste de mise au point
// — ou dans chaque chaîne d'intégration — est une dépense qui n'apprend rien :
// ce qu'on veut mesurer, c'est le SERVICE (son routage, ses requêtes, son coût
// en mémoire), pas le moteur de stockage. Ce module remplace `mysql2/promise`
// par une base en mémoire qui comprend EXACTEMENT les ordres que le service lui
// adresse — pas plus.
//
// CE QU'IL FAIT, ET CE QU'IL NE FAIT PAS.
//   • Il tient `sb_collection`, `sb_record`, `sb_journal`, `sb_etat`,
//     `sb_motdepasse`, `sb_session`, `sb_courriel` et les trois vues ;
//   • il applique `schema.sql` (les `CREATE TABLE IF NOT EXISTS` et les
//     `CREATE OR REPLACE VIEW`), si bien que les scénarios d'installation
//     (schéma absent, compte refusé, réparation) restent jouables ;
//   • il COMPTE chaque ordre par table et par genre : c'est cette mesure qui
//     intéresse l'étude de charge, car le nombre d'allers-retours SQL d'un geste
//     de l'application est une propriété du SERVICE, indépendante du moteur.
//   • Il ne fait PAS de verrouillage (`SELECT … FOR UPDATE` est honoré comme un
//     SELECT ordinaire), pas de transactions isolées (le `rollback` remet les
//     lignes écrites depuis `beginTransaction`), pas d'index.
//
// CONSÉQUENCE À NE PAS OUBLIER quand on lit un rapport : avec une vraie base,
// deux écritures simultanées sur la même collection se SÉRIALISENT (MySQL prend
// un verrou sur la ligne de `sb_collection`). Le SERVICE les sérialise lui aussi,
// désormais, par une file PAR COLLECTION (voir magasin-mysql.mjs) : le banc et la
// production disent donc la même chose sur ce point. Les temps mesurés ici
// restent un PLANCHER pour le reste : ils disent le coût du service, pas celui du
// serveur de base.
// `--latence` ajoute un délai par ordre, pour éprouver un service posé sur une
// base distante.
//
// Module PUR (ni Node, ni réseau) : il se teste comme le reste du domaine.
// ============================================================================

const ER_ACCESS_DENIED = "ER_ACCESS_DENIED_ERROR";
const ER_NO_SUCH_TABLE = "ER_NO_SUCH_TABLE";

const TABLES = ["sb_collection", "sb_record", "sb_journal", "sb_etat", "sb_motdepasse", "sb_session", "sb_courriel", "sb_migrations"];
const VUES = ["v_acte", "v_trame", "v_collection"];

const err = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });

// Un identifiant SQL : `colonne`, ``table`` — les accents graves se doublent.
const sansAccents = (s) => String(s).replace(/`/g, "").trim();

// Nettoie un ordre : les commentaires `--` d'une ligne sont retirés, les blancs
// ramenés à un espace. C'est ce qui permet d'écrire des expressions régulières
// lisibles plutôt qu'un analyseur syntaxique complet.
function nettoyer(sql) {
  return String(sql)
    .split("\n")
    .map((l) => { const i = l.indexOf("--"); return i >= 0 ? l.slice(0, i) : l; })
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
}

// Découpe un envoi « multi-ordres » (c'est ainsi que `schema.sql` s'applique).
// Les commentaires `--` sont retirés D'ABORD : un point-virgule peut s'y trouver
// (celui du commentaire de `sb_courriel` couperait la définition en deux, et la
// table ne serait jamais créée), et l'on ne coupe ensuite que sur les `;` hors
// chaîne de caractères.
function decouperOrdres(sql) {
  const texte = String(sql);
  const sansCommentaires = [];
  let chaine = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i];
    if (chaine) {
      sansCommentaires.push(c);
      if (c === "'") { if (texte[i + 1] === "'") { sansCommentaires.push(texte[++i]); } else chaine = false; }
      continue;
    }
    if (c === "'") { chaine = true; sansCommentaires.push(c); continue; }
    if (c === "-" && texte[i + 1] === "-") { while (i < texte.length && texte[i] !== "\n") i++; sansCommentaires.push("\n"); continue; }
    sansCommentaires.push(c);
  }
  const ordres = [];
  let courant = "";
  chaine = false;
  const propre = sansCommentaires.join("");
  for (let i = 0; i < propre.length; i++) {
    const c = propre[i];
    if (chaine) {
      courant += c;
      if (c === "'") { if (propre[i + 1] === "'") { courant += propre[++i]; } else chaine = false; }
      continue;
    }
    if (c === "'") { chaine = true; courant += c; continue; }
    if (c === ";") { if (courant.trim()) ordres.push(courant.trim()); courant = ""; continue; }
    courant += c;
  }
  if (courant.trim()) ordres.push(courant.trim());
  return ordres;
}

// Découpe une liste au niveau 0 (les parenthèses et les chaînes protègent).
function decouper(liste) {
  const out = [];
  let niveau = 0;
  let courant = "";
  let chaine = false;
  for (let i = 0; i < liste.length; i++) {
    const c = liste[i];
    if (chaine) {
      courant += c;
      if (c === "'") { if (liste[i + 1] === "'") { courant += liste[++i]; } else chaine = false; }
      continue;
    }
    if (c === "'") { chaine = true; courant += c; continue; }
    if (c === "(") niveau++;
    if (c === ")") niveau--;
    if (c === "," && niveau === 0) { out.push(courant.trim()); courant = ""; continue; }
    courant += c;
  }
  if (courant.trim()) out.push(courant.trim());
  return out;
}

// Un littéral SQL → valeur JS. Les `?` consomment le paramètre suivant.
function litteralOuParam(jeton, params, curseur) {
  const t = String(jeton).trim();
  if (t === "?") return { valeur: params[curseur.i++], consomme: true };
  if (/^NULL$/i.test(t)) return { valeur: null, consomme: false };
  if (/^'.*'$/s.test(t)) return { valeur: t.slice(1, -1).replace(/''/g, "'"), consomme: false };
  if (/^-?\d+$/.test(t)) return { valeur: Number(t), consomme: false };
  if (/^-?\d+\.\d+$/.test(t)) return { valeur: Number(t), consomme: false };
  return { valeur: t, consomme: false };
}

// ----------------------------------------------------------------------------
// Fabrique de base. `latenceMs` simule le coût d'un aller-retour vers une base
// distante ; `journaliser` reçoit chaque ordre (pour instrumenter un scénario).
// ----------------------------------------------------------------------------
export function creerBase({ latenceMs = 0, journaliser = null, moteur = "11.4.4-MariaDB" } = {}) {
  const tables = new Map();
  for (const t of TABLES) tables.set(t, new Map());
  const creees = new Set();          // les tables réellement créées par le schéma
  const autoincrement = new Map([["sb_journal", 0], ["sb_courriel", 0]]);
  const stats = { ordres: 0, parTable: new Map(), parGenre: new Map(), ms: 0 };

  // Les identifiants : le mot de passe du compte applicatif peut être changé par
  // `ALTER USER … IDENTIFIED BY` — c'est ce que fait `--reconcilier`, et c'est
  // ainsi qu'on rejoue la panne « Access denied ».
  const comptes = { root: "ROOT", applicatif: "" };
  let nomBase = "scriba";

  const cle = (collection, id) => collection + "\u0000" + id;

  const compte = (nom) => (nom === "root" ? comptes.root : comptes.applicatif);

  function verifierIdentifiants(cfg) {
    if (!cfg || !cfg.user) return;
    const attendu = compte(cfg.user);
    // Un mot de passe vide à la création de la base : le compte n'existe pas
    // encore, rien à vérifier (le schéma se crée avant les comptes).
    if (attendu === "" && cfg.user !== "root") return;
    if (cfg.password !== attendu) {
      throw err(ER_ACCESS_DENIED, `Access denied for user '${cfg.user}'@'172.19.0.3' (using password: YES)`, { errno: 1045, sqlState: "28000" });
    }
  }

  // Une table citée par un ordre doit exister : sans schéma appliqué, MySQL
  // répond « Table … doesn't exist » — et c'est précisément la panne que les
  // scénarios d'installation doivent reproduire.
  function exigerTable(sql) {
    const vues = new Set(VUES);
    for (const t of TABLES) {
      if (!new RegExp(`\\b${t}\\b`).test(sql)) continue;
      if (!creees.has(t)) throw err(ER_NO_SUCH_TABLE, `Table '${nomBase}.${t}' doesn't exist`, { errno: 1146, sqlState: "42S02" });
    }
    for (const v of vues) {
      if (new RegExp(`\\b${v}\\b`).test(sql) && !creees.has(v)) {
        throw err(ER_NO_SUCH_TABLE, `View '${nomBase}.${v}' doesn't exist`, { errno: 1146, sqlState: "42S02" });
      }
    }
  }

  // Une DÉFINITION DE TABLE : on ne modélise ni types ni index, seulement
  // l'existence, qui est ce dont le service dépend.
  function ddl(sql) {
    const mTable = /^CREATE TABLE IF NOT EXISTS (\w+)/i.exec(sql);
    if (mTable) { if (!creees.has(mTable[1])) creees.add(mTable[1]); return [[], []]; }
    const mTable2 = /^CREATE TABLE (\w+)/i.exec(sql);
    if (mTable2) { creees.add(mTable2[1]); return [[], []]; }
    const mVue = /^CREATE (?:OR REPLACE )?VIEW (\w+)/i.exec(sql);
    if (mVue) { creees.add(mVue[1]); return [[], []]; }
    return null;
  }

  // `INSERT … ON DUPLICATE KEY UPDATE` : les colonnes proposées d'un côté, les
  // valeurs insérées de l'autre. On interprète les affectations de la clause de
  // mise à jour (`col = VALUES(col)`, `col = <littéral>`, `col = col + n`).
  function inserer(table, sql, params) {
    const m = new RegExp(`^INSERT (?:IGNORE )?INTO ${table} \\(([^)]*)\\) VALUES (.*)$`, "is").exec(sql);
    if (!m) return null;
    const colonnes = decouper(m[1]).map(sansAccents);
    let reste = m[2].trim();
    let corps = reste;
    let maj = null;
    const iMaj = reste.search(/ON DUPLICATE KEY UPDATE/i);
    if (iMaj >= 0) {
      corps = reste.slice(0, iMaj).trim();
      maj = reste.slice(iMaj).replace(/^ON DUPLICATE KEY UPDATE /i, "").trim();
    }
    const groupe = /^\(([\s\S]*)\)$/.exec(corps);
    if (!groupe) return null;
    const curseur = { i: 0 };
    const valeurs = decouper(groupe[1]).map((j) => litteralOuParam(j, params, curseur).valeur);

    // `VALUES ?` : un lot de lignes fourni en un seul paramètre (le journal).
    const lot = valeurs.length === 1 && Array.isArray(valeurs[0]) && colonnes.length > 1;
    const lignes = lot ? valeurs[0] : [valeurs];

    let affectees = 0;
    for (const ligne of lignes) {
      if (lot) { /* chaque entrée du lot est un tableau de valeurs, déjà résolu */ }
      const doc = {};
      colonnes.forEach((c, i) => { doc[c] = ligne[i] === undefined ? null : ligne[i]; });
      const cleLigne = doc.token_hash !== undefined ? doc.token_hash
        : doc.version !== undefined ? doc.version
          : doc.name !== undefined ? doc.name
            : doc.user_id !== undefined ? doc.user_id
              : doc.collection !== undefined ? cle(doc.collection, doc.id) : null;
      const table2 = tables.get(table);
      const existe = cleLigne != null && table2.has(cleLigne);
      if (existe && maj) {
        const row = table2.get(cleLigne);
        for (const a of decouper(maj)) {
          const m2 = /^([\w]+) = (.*)$/i.exec(a.trim());
          if (!m2) continue;
          const col = sansAccents(m2[1]);
          const droit = m2[2].trim();
          const mV = /^VALUES\((\w+)\)$/i.exec(droit);
          if (mV) { row[col] = doc[sansAccents(mV[1])]; continue; }
          const mPlus = /^([\w]+) \+ (\d+)$/i.exec(droit);
          if (mPlus) { row[col] = (Number(row[sansAccents(mPlus[1])]) || 0) + Number(mPlus[2]); continue; }
          const mMoins = /^([\w]+) - (\d+)$/i.exec(droit);
          if (mMoins) { row[col] = (Number(row[sansAccents(mMoins[1])]) || 0) - Number(mMoins[2]); continue; }
          // `col = col` : l'affectation de NO-OP, celle dont MySQL et MariaDB se
          // servent pour prendre le verrou EXCLUSIF sans rien changer (voir
          // magasin-mysql.mjs). Sans cette reconnaissance, le repli ci-dessous
          // écrirait la CHAÎNE « col » — la révision de la collection
          // deviendrait un texte, et tout ce qui la lit un nombre. Le test porte
          // sur l'EXISTENCE de la colonne dans la ligne : `NULL`, `0` et les
          // littéraux continuent donc par le repli.
          const mRef = /^([A-Za-z_]\w*)$/i.exec(droit);
          if (mRef && sansAccents(mRef[1]) in row) { row[col] = row[sansAccents(mRef[1])]; continue; }
          row[col] = litteralOuParam(droit, [], { i: 0 }).valeur;
        }
        affectees += 1;
        continue;
      }
      if (existe) { affectees += 1; continue; }   // INSERT IGNORE sur une clé déjà là
      if (autoincrement.has(table)) {
        const suite = autoincrement.get(table) + 1;
        autoincrement.set(table, suite);
        if (doc.id === undefined) doc.id = suite;
      }
      table2.set(cleLigne, doc);
      affectees += 1;
    }
    return [[{ affectedRows: affectees, insertId: autoincrement.get(table) || 0 }, []]];
  }

  // Une seule fonction par famille d'ordres. L'ordre des essais compte : les
  // ordres les plus spécifiques d'abord.
  function executer(sqlBrut, params = []) {
    const sql = nettoyer(sqlBrut);
    if (!sql) return [[], []];
    if (/^SET (NAMES|time_zone)/i.test(sql)) return [[], []];

    const d = ddl(sql);
    if (d) return d;

    // Les ordres d'ADMINISTRATION de la base (le geste `--reconcilier`, et le
    // service `db-init` du compose) : ils ne touchent aucune donnée, mais l'un
    // d'eux — `IDENTIFIED BY` — change le mot de passe du compte applicatif.
    if (/^CREATE DATABASE/i.test(sql)) { const m = /(\w+)/.exec(sql.replace(/^CREATE DATABASE (IF NOT EXISTS )?/i, "")); if (m) nomBase = m[1]; return [[], []]; }
    if (/^CREATE USER/i.test(sql)) return [[], []];
    if (/^ALTER USER/i.test(sql)) {
      const m = /IDENTIFIED BY '((?:[^']|'')*)'/i.exec(sql);
      if (m) comptes.applicatif = m[1].replace(/''/g, "'");
      return [[], []];
    }
    if (/^(GRANT|FLUSH|SET GLOBAL|SET SESSION)/i.test(sql)) return [[], []];

    exigerTable(sql);

    // --- écritures -----------------------------------------------------------
    for (const t of ["sb_collection", "sb_record", "sb_journal", "sb_etat", "sb_motdepasse", "sb_session", "sb_courriel", "sb_migrations"]) {
      if (!new RegExp(`^INSERT [^]*?INTO ${t} `, "i").test(sql)) continue;
      // Le journal arrive en LOT : `INSERT INTO sb_journal (…) VALUES ?`.
      const mLot = /^INSERT INTO sb_journal \(([^)]*)\) VALUES \?$/is.exec(sql);
      if (mLot) {
        const colonnes = decouper(mLot[1]).map(sansAccents);
        const lignes = Array.isArray(params[0]) ? params[0] : [];
        const table2 = tables.get("sb_journal");
        for (const ligne of lignes) {
          const doc = {};
          colonnes.forEach((c, i) => { doc[c] = ligne[i] === undefined ? null : ligne[i]; });
          const suite = autoincrement.get("sb_journal") + 1;
          autoincrement.set("sb_journal", suite);
          doc.id = suite;
          doc.at = new Date().toISOString();
          table2.set(suite, doc);
        }
        return [[{ affectedRows: lignes.length, insertId: autoincrement.get("sb_journal") }, []]];
      }
      const r = inserer(t, sql, params);
      if (r) return r;
    }

    let m = /^UPDATE sb_collection SET revision = \? WHERE name = \?$/i.exec(sql);
    if (!m) m = /^UPDATE sb_collection SET revision = \? WHERE name = '(\w+)'$/i.exec(sql);
    if (m) {
      // Les deux formes : le nom en paramètre, ou écrit en clair (le compte
      // applicatif s'écrit toujours dans la collection `users`).
      const nom = m[1] !== undefined ? m[1] : params[1];
      const row = tables.get("sb_collection").get(nom);
      if (row) { row.revision = Number(params[0]) || 0; return [[{ affectedRows: 1 }, []]]; }
      return [[{ affectedRows: 0 }, []]];
    }
    m = /^UPDATE sb_motdepasse SET echecs = \?, bloque_jusqua = \? WHERE user_id = \?$/i.exec(sql);
    if (m) {
      const row = tables.get("sb_motdepasse").get(String(params[2]));
      if (row) { row.echecs = Number(params[0]) || 0; row.bloque_jusqua = params[1] == null ? null : new Date(params[1]).toISOString(); }
      return [[{ affectedRows: row ? 1 : 0 }, []]];
    }
    m = /^UPDATE sb_session SET last_seen_at = \? WHERE token_hash = \?$/i.exec(sql);
    if (m) {
      const row = tables.get("sb_session").get(String(params[1]));
      if (row) row.last_seen_at = new Date(params[0]).toISOString();
      return [[{ affectedRows: row ? 1 : 0 }, []]];
    }
    m = /^DELETE FROM sb_record WHERE collection = \? AND id = \?$/i.exec(sql);
    if (m) {
      const ok = tables.get("sb_record").delete(cle(params[0], params[1]));
      return [[{ affectedRows: ok ? 1 : 0 }, []]];
    }
    m = /^DELETE FROM sb_motdepasse WHERE user_id = \?$/i.exec(sql);
    if (m) return [[{ affectedRows: tables.get("sb_motdepasse").delete(String(params[0])) ? 1 : 0 }, []]];
    m = /^DELETE FROM sb_session WHERE user_id = \?$/i.exec(sql);
    if (m) {
      let n = 0;
      for (const [k, v] of [...tables.get("sb_session")]) if (String(v.user_id) === String(params[0])) { tables.get("sb_session").delete(k); n++; }
      return [[{ affectedRows: n }, []]];
    }
    m = /^DELETE FROM sb_session WHERE token_hash = \?$/i.exec(sql);
    if (m) return [[{ affectedRows: tables.get("sb_session").delete(String(params[0])) ? 1 : 0 }, []]];
    m = /^DELETE FROM sb_session WHERE expires_at < \?$/i.exec(sql);
    if (m) {
      const limite = new Date(params[0]).getTime();
      let n = 0;
      for (const [k, v] of [...tables.get("sb_session")]) {
        const t = v.expires_at ? new Date(v.expires_at).getTime() : 0;
        if (t && t < limite) { tables.get("sb_session").delete(k); n++; }
      }
      return [[{ affectedRows: n }, []]];
    }

    // --- lectures ------------------------------------------------------------
    if (/^SELECT 1$/i.test(sql)) return [[{ "1": 1 }], []];
    if (/^SELECT VERSION\(\) AS version$/i.test(sql)) return [[{ version: moteur }], []];
    if (/^SELECT name, revision, enregistrements FROM v_collection$/i.test(sql)) {
      const lignes = [];
      for (const [nom, row] of tables.get("sb_collection")) {
        let n = 0;
        for (const r of tables.get("sb_record").values()) if (r.collection === nom) n++;
        lignes.push({ name: nom, revision: Number(row.revision) || 0, enregistrements: n });
      }
      return [lignes, []];
    }
    // Les migrations appliquées (voir migrations.mjs) : la clé est la VERSION de
    // la migration, pas un identifiant d'enregistrement.
    if (/^SELECT version, nom, checksum FROM sb_migrations$/i.test(sql)) {
      const lignes = [...tables.get("sb_migrations").values()]
        .map((r) => ({ version: Number(r.version) || 0, nom: r.nom, checksum: r.checksum }))
        .sort((a, b) => a.version - b.version);
      return [lignes, []];
    }
    m = /^SELECT payload FROM sb_etat WHERE name = \?$/i.exec(sql);
    if (m) { const row = tables.get("sb_etat").get(String(params[0])); return [row ? [{ payload: row.payload }] : [], []]; }
    m = /^SELECT payload FROM sb_record WHERE collection = '(\w+)' AND id = \?$/i.exec(sql);
    if (m) { const row = tables.get("sb_record").get(cle(m[1], params[0])); return [row ? [{ payload: row.payload }] : [], []]; }
    m = /^SELECT revision, ord, payload FROM sb_record WHERE collection = \? AND id = \?$/i.exec(sql);
    if (!m) m = /^SELECT revision, payload FROM sb_record WHERE collection = \? AND id = \?$/i.exec(sql);
    if (m) {
      const row = tables.get("sb_record").get(cle(params[0], params[1]));
      return [row ? [{ revision: Number(row.revision) || 0, ord: Number(row.ord) || 0, payload: row.payload }] : [], []];
    }
    m = /^SELECT id, revision, ord, payload FROM sb_record WHERE collection = \? ORDER BY ord ASC, id ASC$/i.exec(sql);
    if (m) {
      const lignes = [...tables.get("sb_record").values()].filter((r) => r.collection === params[0]);
      lignes.sort((a, b) => (Number(a.ord) || 0) - (Number(b.ord) || 0) || String(a.id).localeCompare(String(b.id)));
      return [lignes.map((r) => ({ id: r.id, revision: Number(r.revision) || 0, ord: Number(r.ord) || 0, payload: r.payload })), []];
    }
    m = /^SELECT revision FROM sb_collection WHERE name = \?/i.exec(sql);
    if (m) { const row = tables.get("sb_collection").get(String(params[0])); return [row ? [{ revision: Number(row.revision) || 0 }] : [], []]; }
    if (/^SELECT revision FROM sb_collection WHERE name = '(\w+)'/i.test(sql)) {
      const row = tables.get("sb_collection").get(RegExp.$1);
      return [row ? [{ revision: Number(row.revision) || 0 }] : [], []];
    }
    if (/^SELECT payload FROM sb_record WHERE collection = 'users' AND id = \?$/i.test(sql)) {
      const row = tables.get("sb_record").get(cle("users", params[0]));
      return [row ? [{ payload: row.payload }] : [], []];
    }
    if (/^SELECT id, payload FROM sb_record WHERE collection = 'users'/i.test(sql)) {
      const voulu = String(params[0] ?? "").toLowerCase();
      for (const r of tables.get("sb_record").values()) {
        if (r.collection !== "users") continue;
        let doc = null;
        try { doc = JSON.parse(r.payload); } catch (e) { doc = null; }
        if (doc && String(doc.login || "").toLowerCase() === voulu) return [[{ id: r.id, payload: r.payload }], []];
      }
      return [[], []];
    }
    if (/^SELECT payload FROM sb_record WHERE collection = 'users' AND JSON_UNQUOTE/i.test(sql)) {
      const lignes = [];
      for (const r of tables.get("sb_record").values()) {
        if (r.collection !== "users") continue;
        let doc = null;
        try { doc = JSON.parse(r.payload); } catch (e) { doc = null; }
        if (doc && doc.source === "demo") lignes.push({ payload: r.payload });
      }
      return [lignes, []];
    }
    m = /^SELECT hash, must_change, echecs, bloque_jusqua FROM sb_motdepasse WHERE user_id = \?$/i.exec(sql);
    if (m) {
      const row = tables.get("sb_motdepasse").get(String(params[0]));
      return [row ? [{ hash: row.hash, must_change: row.must_change ? 1 : 0, echecs: Number(row.echecs) || 0, bloque_jusqua: row.bloque_jusqua || null }] : [], []];
    }
    if (/^SELECT user_id, must_change, echecs, bloque_jusqua, updated_at FROM sb_motdepasse$/i.test(sql)) {
      return [[...tables.get("sb_motdepasse").values()].map((r) => ({
        user_id: r.user_id, must_change: r.must_change ? 1 : 0,
        echecs: Number(r.echecs) || 0, bloque_jusqua: r.bloque_jusqua || null, updated_at: r.updated_at || null,
      })), []];
    }
    m = /^SELECT user_id, expires_at, last_seen_at FROM sb_session WHERE token_hash = \?$/i.exec(sql);
    if (m) {
      const row = tables.get("sb_session").get(String(params[0]));
      return [row ? [{ user_id: row.user_id, expires_at: row.expires_at, last_seen_at: row.last_seen_at }] : [], []];
    }
    if (/^SELECT evenement, acte_id, cible, destinataires, sujet, envoye, motif, acteur, at FROM sb_courriel/i.test(sql)) {
      const limite = Number(params[0]) || 20;
      const lignes = [...tables.get("sb_courriel").values()]
        .sort((a, b) => String(b.at).localeCompare(String(a.at)) || (b.id - a.id))
        .slice(0, limite)
        .map((r) => ({ ...r }));
      return [lignes, []];
    }

    throw err("ER_PARSE_ERROR", `Ordre SQL non reconnu par la base en mémoire : ${sql.slice(0, 160)}`, { errno: 1064 });
  }

  // Une connexion. `multipleStatements` fait courir les ordres séparés par `;`
  // (c'est ainsi que `schema.sql` s'applique en une fois).
  function connexion(cfg, { multipleStatements = false } = {}) {
    verifierIdentifiants(cfg);
    let enTransaction = false;
    const avant = [];
    const repos = async () => {};
    const cx = {
      async query(sql, params) {
        const brut = String(sql);
        const liste = multipleStatements && /;/.test(brut) ? decouperOrdres(brut) : [brut];
        let dernier = [[], []];
        for (const s of liste) {
          stats.ordres += 1;
          const t = { compte: cfg && cfg.user === "root" ? "root" : "applicatif" };
          const genre = /^\s*(INSERT|UPDATE|DELETE)/i.test(s) ? "ecriture" : /^\s*(CREATE|ALTER|DROP|GRANT|FLUSH|SET)/i.test(s) ? "ddl" : "lecture";
          stats.parGenre.set(genre, (stats.parGenre.get(genre) || 0) + 1);
          const table = (/(?:INTO|FROM|UPDATE|TABLE(?: IF NOT EXISTS)?|VIEW)\s+(sb_\w+|v_\w+)/i.exec(s) || [])[1];
          if (table) stats.parTable.set(table, (stats.parTable.get(table) || 0) + 1);
          if (typeof journaliser === "function") journaliser({ sql: s.slice(0, 200), table, genre });
          // L'attente simulée fait partie du COÛT de l'ordre : elle doit donc
          // compter dans le temps passé dans la base, sans quoi un rapport sur
          // base distante annoncerait « 0,1 % du temps » alors que l'aller-retour
          // est précisément ce qu'on cherche à mesurer.
          const t0 = Date.now();
          if (latenceMs > 0) await new Promise((r) => setTimeout(r, latenceMs));
          dernier = executer(s, params || []);
          stats.ms += Date.now() - t0;
          if (enTransaction) avant.push(s);
        }
        return dernier;
      },
      async beginTransaction() { enTransaction = true; },
      async commit() { enTransaction = false; avant.length = 0; },
      async rollback() {
        // Un `rollback` sans journal d'annulation ne peut pas défaire un UPDATE :
        // le service n'y compte que pour repartir d'une connexion saine, et une
        // transaction interrompue dans ce modèle laisse la base telle qu'elle
        // était (les erreurs SQL, elles, surviennent avant l'écriture).
        enTransaction = false;
        avant.length = 0;
        return repos();
      },
      release() {},
      async end() {},
      destroy() {},
    };
    return cx;
  }

  const base = {
    // `mysql.createPool(cfg)` : la file de connexions n'est ici qu'une apparence
    // — les connexions sont créées à la demande et prêtent le même contrat.
    createPool(cfg = {}) {
      verifierIdentifiants(cfg);
      return {
        config: cfg,
        query: (sql, params) => connexion(cfg).query(sql, params),
        getConnection: async () => connexion(cfg, { multipleStatements: !!cfg.multipleStatements }),
        // Le service n'utilise `getConnection` que pour les transactions : la
        // connexion rendue porte donc le contrat complet.
        async end() {},
        on() {},
        escape: (v) => v,
      };
    },
    createConnection(cfg = {}) {
      verifierIdentifiants(cfg);
      return connexion(cfg, { multipleStatements: !!cfg.multipleStatements });
    },
    // Outils d'inspection, pour les scénarios et le rapport de charge.
    stats: () => ({
      ordres: stats.ordres,
      ms: stats.ms,
      parTable: Object.fromEntries([...stats.parTable].sort()),
      parGenre: Object.fromEntries([...stats.parGenre].sort()),
    }),
    reinitialiserStats: () => {
      stats.ordres = 0; stats.ms = 0; stats.parTable = new Map(); stats.parGenre = new Map();
    },
    // Ce que la base contient : de quoi préparer un scénario, ou le vérifier.
    lignes: (table) => [...(tables.get(table) || new Map()).values()].map((r) => ({ ...r })),
    definirMotDePasse: (v) => { comptes.applicatif = String(v); },
    motDePasse: () => comptes.applicatif,
    definirMotDePasseRoot: (v) => { comptes.root = String(v); },
    tablesCreees: () => [...creees].sort(),
    nomBase: () => nomBase,
  };
  return base;
}
