// ============================================================================
// Tableur XLSX et CSV — écriture sans aucune dépendance.
//
// Les exports « tableur » de l'application (chrono de numérotation, registre
// des actes) s'ouvrent dans Excel, LibreOffice ou Numbers. Plutôt que d'y
// ajouter une bibliothèque — une dépendance de plus à auditer, à versionner et
// à charger — ce module ÉCRIT le format à la main :
//
//   • CSV  un texte séparé par des points-virgules, précédé du BOM UTF-8 : c'est
//          ce qu'Excel attend sur un poste configuré en français (le séparateur
//          de liste y est « ; », et sans BOM les accents se lisent en mojibake) ;
//   • XLSX un classeur OOXML : un ZIP (méthode « store », sans compression) qui
//          contient les quelques parties XML que tout tableur sait lire —
//          types de contenu, relations, classeur, feuille — plus une feuille de
//          styles minimale (en-tête gras).
//
// Le format ZIP est celui de la spécification PKZIP : en-tête local, données,
// répertoire central, fin de répertoire. Sans compression, aucune bibliothèque
// de déflation n'est nécessaire, et le fichier reste parfaitement valide.
//
// Ce module est PUR : il ne connaît ni le DOM ni le réseau. Il ne fait que
// produire des octets.
// ============================================================================

// ------------------------------------------------------------------- CRC-32
// Table précalculée (polynôme 0xEDB88320), construite une fois.
const TABLE_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = TABLE_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const encoder = () => new TextEncoder();
const utf8 = (s) => encoder().encode(String(s == null ? "" : s));

// --------------------------------------------------------------------- ZIP
// Un seul point d'écriture : une liste `{ nom, donnees }`, rendue en un tableau
// d'octets. Les noms et les données sont en UTF-8 (drapeau 11 du format ZIP).
export function zipStore(fichiers) {
  const morceaux = [];
  const central = [];
  let offset = 0;

  for (const f of fichiers) {
    const nom = utf8(f.nom);
    const donnees = f.donnees instanceof Uint8Array ? f.donnees : utf8(f.donnees);
    const crc = crc32(donnees);
    const taille = donnees.length;

    const local = new Uint8Array(30 + nom.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);      // signature d'en-tête local
    lv.setUint16(4, 20, true);              // version minimale
    lv.setUint16(6, 0x0800, true);          // drapeau : noms en UTF-8
    lv.setUint16(8, 0, true);               // méthode : store
    lv.setUint16(10, 0, true);              // heure (sans objet)
    lv.setUint16(12, 0x21, true);           // date (1er janvier 1980)
    lv.setUint32(14, crc, true);
    lv.setUint32(18, taille, true);         // taille compressée
    lv.setUint32(22, taille, true);         // taille décompressée
    lv.setUint16(26, nom.length, true);
    lv.setUint16(28, 0, true);              // champ « extra » vide
    local.set(nom, 30);

    morceaux.push(local, donnees);

    const cent = new Uint8Array(46 + nom.length);
    const cv = new DataView(cent.buffer);
    cv.setUint32(0, 0x02014b50, true);      // signature d'entrée centrale
    cv.setUint16(4, 20, true);              // version d'écriture
    cv.setUint16(6, 20, true);              // version minimale
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, 0, true);
    cv.setUint16(14, 0x21, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, taille, true);
    cv.setUint32(24, taille, true);
    cv.setUint16(28, nom.length, true);
    cv.setUint16(30, 0, true);              // extra
    cv.setUint16(32, 0, true);              // commentaire
    cv.setUint16(34, 0, true);              // disque
    cv.setUint16(36, 0, true);              // attributs internes
    cv.setUint32(38, 0, true);              // attributs externes
    cv.setUint32(42, offset, true);         // position de l'en-tête local
    cent.set(nom, 46);
    central.push(cent);

    offset += local.length + taille;
  }

  const tailleCentral = central.reduce((n, c) => n + c.length, 0);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054b50, true);        // signature de fin
  fv.setUint16(8, fichiers.length, true);
  fv.setUint16(10, fichiers.length, true);
  fv.setUint32(12, tailleCentral, true);
  fv.setUint32(16, offset, true);

  const total = offset + tailleCentral + fin.length;
  const out = new Uint8Array(total);
  let p = 0;
  for (const m of morceaux) { out.set(m, p); p += m.length; }
  for (const c of central) { out.set(c, p); p += c.length; }
  out.set(fin, p);
  return out;
}

// ------------------------------------------------------------------ XLSX
const escapeXml = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&apos;");

// Une lettre de colonne pour un index 0-based : 0 → A, 25 → Z, 26 → AA.
export function colonneLettre(index) {
  let i = Math.max(0, Math.floor(index));
  let out = "";
  do { out = String.fromCharCode(65 + (i % 26)) + out; i = Math.floor(i / 26) - 1; } while (i >= 0);
  return out;
}

// Une valeur de cellule : un nombre reste un nombre (Excel peut le sommer), une
// date ISO devient une date, tout le reste est du texte en ligne.
function cellule(ref, valeur) {
  if (valeur === null || valeur === undefined || valeur === "") return `<c r="${ref}"/>`;
  if (typeof valeur === "number" && Number.isFinite(valeur)) return `<c r="${ref}"><v>${valeur}</v></c>`;
  const iso = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/.test(String(valeur));
  if (iso) {
    const t = Date.parse(String(valeur));
    if (!Number.isNaN(t)) {
      const jours = (t - Date.UTC(1899, 11, 30)) / 86400000;
      return `<c r="${ref}" s="1"><v>${jours.toFixed(6)}</v></c>`;
    }
  }
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(valeur)}</t></is></c>`;
}

const feuilleXml = (nom, lignes) => {
  const body = lignes.map((ligne, r) => {
    const cellules = (ligne || []).map((v, c) => cellule(colonneLettre(c) + (r + 1), v)).join("");
    return `<row r="${r + 1}">${cellules}</row>`;
  }).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `<sheetPr><tabColor rgb="FF000091"/></sheetPr>`
    + `<sheetFormatPr defaultRowHeight="15"/>`
    + `<cols>${[18, 18, 18, 26, 14, 14, 14].map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    + `<sheetData>${body}</sheetData></worksheet>`;
};

// Le classeur, à partir d'une ou plusieurs feuilles : `[{ nom, lignes }]`.
// `lignes` est un tableau de tableaux ; la première ligne est l'en-tête (elle
// reçoit le style gras).
export function xlsx(feuilles, { auteur = "Scribae" } = {}) {
  const liste = (Array.isArray(feuilles) ? feuilles : []).map((f, i) => ({
    nom: String(f.nom || ("Feuille" + (i + 1))).replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || ("Feuille" + (i + 1)),
    lignes: f.lignes || [],
  }));
  const files = [];

  files.push({
    nom: "[Content_Types].xml",
    donnees: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${liste.map((f, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("\n")}
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`,
  });

  files.push({
    nom: "_rels/.rels",
    donnees: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`,
  });

  files.push({
    nom: "docProps/core.xml",
    donnees: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:creator>${escapeXml(auteur)}</dc:creator>
<cp:lastModifiedBy>${escapeXml(auteur)}</cp:lastModifiedBy>
<dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created>
</cp:coreProperties>`,
  });

  files.push({
    nom: "xl/workbook.xml",
    donnees: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${liste.map((f, i) => `<sheet name="${escapeXml(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets>
</workbook>`,
  });

  files.push({
    nom: "xl/_rels/workbook.xml.rels",
    donnees: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${liste.map((f, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("\n")}
<Relationship Id="rId${liste.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  });

  // Deux styles : « 0 » normal, « 1 » en-tête gras sur fond discret (les
  // cellules de date s'en servent aussi pour leur format).
  files.push({
    nom: "xl/styles.xml",
    donnees: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="1"><numFmt numFmtId="164" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF1F8"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`,
  });

  liste.forEach((f, i) => {
    const lignes = f.lignes || [];
    let xml = feuilleXml(f.nom, lignes);
    if (lignes.length) {
      const entete = lignes[0].map((v, c) => {
        const ref = colonneLettre(c) + "1";
        return `<c r="${ref}" s="2" t="inlineStr"><is><t xml:space="preserve">${escapeXml(v)}</t></is></c>`;
      }).join("");
      xml = xml.replace(/<row r="1">.*?<\/row>/, `<row r="1">${entete}</row>`);
    }
    files.push({ nom: `xl/worksheets/sheet${i + 1}.xml`, donnees: xml });
  });

  return zipStore(files);
}

// ------------------------------------------------------------------- CSV
// Le séparateur est le point-virgule et le texte porte le BOM UTF-8 : c'est ce
// qu'Excel attend sur un poste en français. Une valeur qui contient le
// séparateur, un guillemet ou un saut de ligne est mise entre guillemets, ses
// guillemets doublés — la règle de la RFC 4180.
export function csv(lignes, { separateur = ";" } = {}) {
  const celluleCsv = (v) => {
    const s = String(v ?? "");
    return /["\n\r]|^\s|\s$/.test(s) || s.includes(separateur)
      ? '"' + s.replace(/"/g, '""') + '"'
      : s;
  };
  const corps = (lignes || []).map((l) => (l || []).map(celluleCsv).join(separateur)).join("\r\n");
  return "\uFEFF" + corps + "\r\n";
}

// ------------------------------------------------------------------ octets
export const versBlob = (octets, type) => new Blob([octets], { type });
export const blobCsv = (lignes, opts) => versBlob(csv(lignes, opts), "text/csv;charset=utf-8");
export const blobXlsx = (feuilles, opts) =>
  versBlob(xlsx(feuilles, opts), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
