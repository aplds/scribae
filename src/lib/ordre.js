// ============================================================================
// L'ORDRE des blocs d'un document.
//
// Dans un document, les blocs ne se contentent pas d'exister : ils se SUIVENT.
// La trame fixe l'ordre de départ — c'est elle qui décide qu'un article vient
// après un autre —, mais ce n'est pas toujours l'ordre dans lequel le document
// se rédige : on découvre en écrivant qu'un article doit passer avant, qu'un
// livre doit venir en tête, qu'une section se lit mieux à la fin.
//
// L'ordre choisi est donc une DONNÉE de la rédaction, rangée à part, sous
// `values.__ordre`, indexée par CONTENEUR :
//
//     __ordre = { "body": [2, 0, 1], "body.3.blocks": [1, 0, 2] }
//
// Chaque case est la suite des RANGS D'ORIGINE des blocs du conteneur, dans
// l'ordre où ils doivent se lire. Un conteneur sans entrée suit simplement
// l'ordre de la trame : on n'écrit rien tant qu'on n'a rien déplacé, de sorte
// qu'une trame remaniée plus tard ne laisse pas derrière elle un ordre figé.
//
// Les conteneurs sont : le corps du document (`body`), et les blocs de chaque
// DIVISION (`body.3.blocks`) — une division range des articles, un article range
// des paragraphes, qu'il n'y a pas lieu de réordonner.
//
// Tout se dit en RANGS D'ORIGINE, jamais en positions à l'écran : un bloc
// masqué par sa condition n'occupe pas de place à l'écran, mais garde son rang
// — les deux listes ne se superposeraient donc pas. Le rang d'un bloc est le
// dernier segment de son adresse (`body.3` → rang 3).
//
// Rien ici ne connaît le DOM : les écrans lisent et écrivent ce module, la
// compilation l'applique (voir src/lib/compile.js).
// ============================================================================

export const ordreDe = (values) => ((values && values.__ordre && typeof values.__ordre === "object") ? values.__ordre : {});

// Les rangs des blocs AJOUTÉS par la rédaction dans un conteneur (voir
// lib/structure.js). Lus ici sans importer le module de structure, qui a besoin
// de l'ordre : leurs rangs sont synthétiques — ils commencent après le dernier
// bloc de la trame — et cohabitent donc avec les rangs d'origine.
const rangsAjoutes = (values, containerPath) => {
  const box = values && values.__ajouts;
  const list = box && box[containerPath];
  return Array.isArray(list) ? list.map((a) => Number(a.rang)).filter(Number.isInteger) : [];
};

// L'ordre d'un conteneur, complété s'il est incomplet : les blocs qu'il ne
// mentionne pas (ajoutés à la trame, ou ajoutés par la rédaction) gardent leur
// place relative, à la suite de ceux qu'il mentionne.
export function ordreConteneur(values, containerPath, count) {
  const stored = ordreDe(values)[containerPath];
  const tous = Array.from({ length: count }, (_, i) => i);
  // Les ajouts de la rédaction : leur rang est toujours valide, il ne se déduit
  // pas du nombre de blocs de la trame.
  const ajoutes = rangsAjoutes(values, containerPath);
  const valide = (n) => Number.isInteger(n) && n >= 0 && (n < count || ajoutes.includes(n));
  if (!Array.isArray(stored) || !stored.length) return [...tous, ...ajoutes.filter((n) => n >= count)];
  const vus = [];
  for (const i of stored) {
    const n = Number(i);
    if (valide(n) && !vus.includes(n)) vus.push(n);
  }
  for (const i of [...tous, ...ajoutes]) if (!vus.includes(i)) vus.push(i);
  return vus;
}

export const aOrdre = (values, containerPath) => {
  const o = ordreDe(values)[containerPath];
  return Array.isArray(o) && o.length > 0;
};

// Les conteneurs dont l'ordre a été touché (pour l'annoncer au rédacteur).
export function ordresModifies(values) {
  const o = ordreDe(values);
  return Object.keys(o).filter((k) => Array.isArray(o[k]) && o[k].length);
}

const ecrire = (values, containerPath, ordre) => {
  values.__ordre = values.__ordre || {};
  values.__ordre[containerPath] = ordre;
  return true;
};

// Le rang d'origine d'un bloc, lu sur son adresse.
export const rangDe = (path) => {
  const m = String(path || "").match(/(\d+)$/);
  return m ? Number(m[1]) : -1;
};

// Déplace le bloc de rang `deRang` à la place qu'occupe celui de rang
// `versRang` (les autres se décalent). `versRang` nul = à la fin.
export function deplacerVers(values, containerPath, count, deRang, versRang) {
  const ordre = ordreConteneur(values, containerPath, count);
  const i = ordre.indexOf(Number(deRang));
  if (i < 0) return false;
  const [x] = ordre.splice(i, 1);
  const j = versRang == null ? ordre.length : ordre.indexOf(Number(versRang));
  ordre.splice(j < 0 ? ordre.length : j, 0, x);
  return ecrire(values, containerPath, ordre);
}

// Remet un conteneur (ou tout le document) dans l'ordre de la trame.
export function rangerCommeLaTrame(values, containerPath = "") {
  if (!values || !values.__ordre) return;
  if (!containerPath) { delete values.__ordre; return; }
  for (const k of Object.keys(values.__ordre)) {
    if (k === containerPath || k.startsWith(containerPath + ".")) delete values.__ordre[k];
  }
}

// Applique un ordre écrit à une liste de blocs COMPILÉS : chaque bloc porte son
// `path`, dont le dernier segment est son rang d'origine.
export function appliquerOrdre(list, ordre) {
  if (!Array.isArray(ordre) || !ordre.length) return list;
  const parRang = new Map();
  for (const n of list) {
    const r = rangDe(n?.path);
    if (r >= 0) parRang.set(r, n);
  }
  const out = [];
  for (const i of ordre) { const n = parRang.get(Number(i)); if (n !== undefined) { out.push(n); parRang.delete(Number(i)); } }
  for (const n of list) if (!out.includes(n)) out.push(n);   // bloc hors ordre (condition, ajout)
  return out;
}
