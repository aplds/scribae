// ============================================================================
// Format de fichier des trames (import / export).
//
// Ce module fabrique le FICHIER D'EXEMPLE documenté (téléchargé depuis l'écran
// Trames) et relit un fichier de trame pour l'importer. Un fichier accepté peut
// contenir :
//   • une seule trame   : { "trame": { … } }  ou  { … } directement ;
//   • plusieurs trames  : { "trames": [ { … }, { … } ] } ou un tableau [ … ].
// Le bloc `aide` (présent dans le fichier d'exemple) n'est pas lu : il documente
// le format pour la personne qui prépare ses trames dans un éditeur de texte.
//
// À l'import, les identifiants (tpl-…, n-…, f-…, r-…, it-…) sont RÉGÉNÉRÉS : un
// fichier peut être recopié, dupliqué ou réutilisé sans risque de collision.
// ============================================================================
import { uid } from "./util.js";
import {
  newNode, newField, newRule, newNote, newTrame,
  NODE_MAP, NODE_TYPES, FIELD_TYPES, RULE_LEVELS, NOTE_KINDS,
} from "./schema.js";

const list = (items, sep = " ; ") => items.map((x) => (typeof x === "string" ? x : `${x.id} — ${x.label}`)).join(sep);

// --------------------------------------------------------------- documentée
const AIDE = {
  "à quoi sert ce fichier": "Ce fichier est un MODÈLE documenté. Recopiez-le, adaptez la partie « trame », puis réimportez-le avec le bouton « Importer une trame » de l'écran Trames. Le bloc « aide » ci-dessous (documentation du format) n'est pas lu à l'import : il ne sert qu'à vous guider, vous pouvez le supprimer.",
  "formes acceptées": "Une trame seule ({ \"trame\": {…} } ou directement {…}), plusieurs trames ({ \"trames\": [ {…}, {…} ] }), ou un tableau. Les identifiants sont régénérés à l'import : vous pouvez les omettre ou les recopier librement.",
  "obligatoire": "Deux éléments seulement : « name » (nom de la trame) et « body » (tableau de blocs non vide). Tout le reste a une valeur par défaut.",
  "propriétés de la trame": {
    name: "Nom affiché de la trame (obligatoire).",
    version: "Étiquette de version libre, ex. « 26.01 ».",
    familyId: "Identifiant d'une famille du référentiel, ou \"\".",
    actTypeId: "Identifiant d'un type d'acte du référentiel (ex. « arrete », « decision », « deliberation », « reglement »).",
    status: "draft | published | archived (défaut : draft).",
    publishable: "true (défaut) ou false. false = trame NON publiable : les actes issus de cette trame (actes individuels : revalorisation d'un traitement, sanction…) sont signés et conservés, mais jamais déposés au recueil et sans identifiant ELI.",
    styleId: "Feuille de style (charte graphique) désignée par la trame, ou \\\"\\\". Vide = automatique : la charte de l'entité signataire, sinon celle de la famille, sinon la feuille générale. Voir l'écran « Feuilles de style ».",
    description: "Texte d'aide affiché sur la carte de la trame.",
    owner: "Service ou personne propriétaire (texte libre).",
    serviceId: "Identifiant d'un service du référentiel, ou \"\" pour une trame générale (tous les services).",
    bureauId: "Identifiant d'un bureau du service, ou \"\".",
    entityIds: "Tableau d'identifiants d'entités concernées ; [] = toutes les entités.",
    fields: "Tableau de champs du formulaire de rédaction (voir « champ »).",
    rules: "Tableau de règles de contrôle (voir « règle »).",
    body: "Tableau ORDONNÉ de blocs qui composent le document (voir « bloc »).",
  },
  bloc: {
    "commun à tous les blocs": "id, type (obligatoire), when (condition d'affichage facultative, ex. \"exists(dateEffet)\"), notes (tableau de commentaires).",
    "text — bloc à texte": "Types title, authority, enact, para, raw : propriété « text ».",
    "blocs à liste": "Types visas et considerants : « items » = [ { id, refId, text, refKind, refScope, chaine, when } ] (refId = référence du référentiel ; laisser \"\" et remplir text pour un texte libre ; chaine: true = les décisions fondant la signature, étage par étage de la chaîne de délégations (la nomination puis la délégation), résolues depuis le référentiel).",
    article: "numMode (\"auto\" | \"manual\"), num (numéro si manual), heading (intitulé facultatif), blocks (blocs imbriqués : para, list, table), when.",
    list: "ordered (booléen), items = [ { id, text, when } ].",
    table: "caption (légende), columns = [\"Colonne 1\", …], rows = [[\"cellule\", …], …].",
    signature: "place (lieu), showFunction (booléen).",
    mention: "mentionId (identifiant d'une mention du référentiel) et/ou textOverride (texte direct). Si les deux sont vides, le bloc n'affiche rien.",
  },
  "types de blocs (body[].type)": list(NODE_TYPES),
  "types de champs (fields[].type)": list(FIELD_TYPES),
  champ: {
    propriétés: "id, label, type, group (regroupement à l'écran), required (booléen), help, placeholder, options (pour choice/multichoice), refKind (pour ref/reflist), qualite (pour signataire), appliesWhen (condition d'affichage).",
    "id du champ": "L'identifiant « id » est AUSSI le nom utilisé dans le texte : un champ { id: \"objet\" } se remplit avec {{objet}}. Choisissez des identifiants simples, sans accent ni espace, et uniques. « signataire » est le champ spécial qui alimente le bloc signature ; « numero », « objet », « dateSignature » et « dateEffet » sont reconnus par le registre.",
    "champ signataire": "Un champ de type « signataire » ne fait pas choisir un nom dans l'annuaire : on y désigne d'abord la FONCTION (la qualité qui donne compétence pour signer — un rôle, ou une délégation de signature), puis, parmi les personnes qui la tiennent, celle qui signe. L'identifiant du champ reste celui d'une personne. La propriété « qualite » fixe la fonction attendue (clé « role:<id de rôle> » ou « del:<id de délégation> ») ; vide, la fonction est laissée au choix de celui qui rédige.",
    types: list(FIELD_TYPES),
  },
  "niveaux de règle (rules[].level)": list(RULE_LEVELS),
  règle: {
    propriétés: "id, level, kind (\"check\" | \"inclusion\"), expr (expression, voir le guide et les exemples ci-dessous), message, ref, author, date.",
    "expressions courantes": [
      "exists(champ) — le champ est rempli",
      "!exists(champ) || … — condition si le champ est rempli",
      "champ1 && champ2 — deux champs obligatoires",
      "matches(numero, '^[0-9]{4}-[0-9]{3}-[A-Z]+$') — format du numéro",
      "diff_days(dateFin, dateDebut) >= 0 — ordre de deux dates",
      "contains(perimetres, 'finances') — une valeur est choisie dans une liste",
    ],
  },
  "natures de commentaire (notes[].kind)": list(NOTE_KINDS),
  commentaire: "id, kind, author, date, text, ruleId. Les commentaires accompagnent la préparation : ils ne sont pas publiés.",
  "jetons de texte {{…}}": "Dans tout texte (title, para, heading, items…), {{chemin}} est remplacé à la compilation : {{objet}}, {{beneficiaire.lastName}}, {{entity.nameWithArt}}, {{dateSignature|date-long}}. Filtres : |upper, |lower, |capitalize, |date-long, |date-short, |money. Conditions : {{dateEffet ? \"le \" + dateEffet : \"au lendemain de la publication\"}}.",
};

// ------------------------------------------------------------- trame d'exemple
// Trame complète et valide, qui sert de point de départ : elle emploie la plupart
// des types de blocs, des champs, une règle de chaque niveau et un commentaire.
function exampleTrame() {
  return {
    name: "Arrêté — autorisation d'occupation temporaire du domaine public (exemple)",
    version: "26.01",
    familyId: "",
    actTypeId: "arrete",
    status: "draft",
    publishable: true,
    styleId: "",
    description: "Modèle d'exemple fourni avec l'application : il illustre la structure attendue. Remplacez-le, ou partez de zéro.",
    owner: "Affaires générales",
    serviceId: "",
    bureauId: "",
    entityIds: [],
    fields: [
      { id: "numero", label: "Numéro de l'acte", type: "text", group: "Identification", required: true, help: "Chrono attribué par le registre. L'identifiant « id » du champ est aussi le nom utilisé dans le texte : {{numero}}." },
      { id: "objet", label: "Objet", type: "textarea", group: "Identification", required: true },
      { id: "dateSignature", label: "Date de signature", type: "date", group: "Identification", required: true },
      { id: "demandeur", label: "Demandeur", type: "text", group: "Occupation", required: true },
      { id: "lieu", label: "Emplacement", type: "text", group: "Occupation", required: true },
      { id: "debut", label: "Début de l'occupation", type: "date", group: "Occupation", required: true },
      { id: "fin", label: "Fin de l'occupation", type: "date", group: "Occupation", required: true },
      { id: "redevance", label: "Redevance annuelle", type: "money", group: "Occupation", required: false },
      { id: "signataire", label: "Signataire", type: "signataire", group: "Signature", required: true, qualite: "role:maire", help: "La fonction attendue : c'est elle qui donne compétence pour signer. Le rédacteur choisira ensuite, parmi les personnes qui la tiennent, celle qui signe. Laissez « qualite » vide pour le laisser choisir la fonction lui-même." },
    ],
    rules: [
      { id: "r-1", level: "blocking", expr: "exists(demandeur) && exists(lieu)", message: "Le demandeur et l'emplacement sont obligatoires.", author: "Affaires générales", date: "" },
      { id: "r-2", level: "blocking", expr: "!exists(debut) || !exists(fin) || diff_days(fin, debut) >= 0", message: "La fin de l'occupation ne peut pas précéder son début.", author: "Affaires générales", date: "" },
      { id: "r-3", level: "warning", expr: "exists(numero) && matches(numero, '^[0-9]{4}-[0-9]{3}-[A-Z]+$')", message: "Le numéro devrait suivre le format AAAA-NNN-CODE (ex. 2026-401-VSL).", author: "Affaires générales", date: "" },
    ],
    body: [
      { id: "n-1", type: "title", text: "Arrêté n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}", when: "", notes: [] },
      { id: "n-2", type: "authority", text: "{{entity.authorityFormula}}", when: "", notes: [] },
      {
        id: "n-3", type: "visas", when: "", notes: [],
        items: [
          { id: "it-1", refId: "", text: "Vu le code général de la propriété des personnes publiques, notamment ses articles L. 2122-1 et suivants ;", when: "" },
          { id: "it-2", refId: "", text: "Vu la demande présentée par l'intéressé ;", when: "" },
        ],
      },
      {
        id: "n-4", type: "considerants", when: "", notes: [],
        items: [{ id: "it-3", text: "Considérant que l'occupation sollicitée est compatible avec l'affectation du domaine public ;", when: "" }],
      },
      { id: "n-5", type: "enact", text: "ARRÊTE", when: "", notes: [] },
      {
        id: "n-6", type: "article", numMode: "auto", num: "1er", heading: "Objet de l'autorisation", when: "",
        notes: [{ id: "c-1", kind: "instruction", author: "Affaires générales", date: "", ruleId: "", text: "Vérifier que l'emplacement relève bien du domaine public communal avant de délivrer l'autorisation." }],
        blocks: [
          { id: "n-6-1", type: "para", text: "Une autorisation d'occupation temporaire du domaine public est délivrée à {{demandeur}} pour l'emplacement suivant : {{lieu}}.", when: "", notes: [] },
          {
            id: "n-6-2", type: "list", ordered: false, when: "", notes: [],
            items: [
              { id: "it-4", text: "du {{debut|date-long}} au {{fin|date-long}} ;", when: "" },
              { id: "it-5", text: "moyennant une redevance annuelle de {{redevance|money}}.", when: "exists(redevance)" },
            ],
          },
        ],
      },
      {
        id: "n-7", type: "article", numMode: "auto", heading: "Conditions particulières", when: "exists(redevance)", notes: [],
        blocks: [{ id: "n-7-1", type: "para", text: "La redevance est payable d'avance, sur titres de recettes émis par le comptable public.", when: "", notes: [] }],
      },
      { id: "n-8", type: "signature", place: "{{entity.seatCity}}", showFunction: true, when: "", notes: [] },
      { id: "n-9", type: "mention", mentionId: "", textOverride: "Le présent arrêté sera publié au recueil des actes administratifs de la commune.", when: "", notes: [] },
    ],
  };
}

// Fichier complet prêt à télécharger : la documentation d'abord, l'exemple ensuite.
export const exampleTrameFile = () => ({
  kind: "trame-exemple",
  version: 1,
  "lisez-moi": "Fichier d'exemple : recopiez la structure de « trame », puis réimportez le fichier via le bouton « Importer une trame ». Le bloc « aide » documente chaque clé et n'est pas lu à l'import.",
  aide: AIDE,
  trame: exampleTrame(),
});

// -------------------------------------------------------------- normalisation
const asString = (v) => (typeof v === "string" ? v : "");

function normalizeNote(raw, warnings) {
  if (!raw || typeof raw !== "object") return null;
  const n = { ...newNote(), ...raw };
  n.id = asString(raw.id) || n.id;
  if (!NOTE_KINDS.some((k) => k.id === n.kind)) {
    warnings.push(`Nature de commentaire inconnue « ${raw.kind} » remplacée par « instruction »`);
    n.kind = "instruction";
  }
  return n;
}

function normalizeItem(raw, warnings) {
  if (raw == null) return null;
  if (typeof raw === "string") return { id: uid("it"), text: raw, when: "" };
  if (typeof raw !== "object") return null;
  return {
    id: asString(raw.id) || uid("it"), refId: asString(raw.refId), text: asString(raw.text),
    refKind: asString(raw.refKind), refScope: asString(raw.refScope), when: asString(raw.when),
    // Les décisions fondant la signature (voir src/lib/delegations.js).
    chaine: raw.chaine === true,
  };
}

function normalizeField(raw, warnings, where) {
  if (!raw || typeof raw !== "object") { warnings.push(`${where} : champ ignoré (objet attendu)`); return null; }
  const f = { ...newField(), ...raw };
  f.id = asString(raw.id) || f.id;
  if (!FIELD_TYPES.some((t) => t.id === f.type)) {
    warnings.push(`${where} : type de champ inconnu « ${raw.type} » remplacé par « text »`);
    f.type = "text";
  }
  f.required = f.required !== false;
  f.options = Array.isArray(f.options) ? f.options.slice() : [];
  return f;
}

function normalizeRule(raw, warnings, where) {
  if (!raw || typeof raw !== "object") { warnings.push(`${where} : règle ignorée (objet attendu)`); return null; }
  const r = { ...newRule(), ...raw };
  r.id = asString(raw.id) || r.id;
  if (!RULE_LEVELS.some((l) => l.id === r.level)) {
    warnings.push(`${where} : niveau de règle inconnu « ${raw.level} » remplacé par « blocking »`);
    r.level = "blocking";
  }
  return r;
}

function normalizeNode(raw, warnings, where) {
  if (!raw || typeof raw !== "object") { warnings.push(`${where} : bloc ignoré (objet attendu)`); return null; }
  const type = asString(raw.type);
  if (!type) { warnings.push(`${where} : bloc sans « type » ignoré`); return null; }
  if (!NODE_MAP[type]) { warnings.push(`${where} : type de bloc inconnu « ${type} » ignoré`); return null; }
  const n = newNode(type, {});
  for (const k of Object.keys(raw)) {
    if (k === "id" || k === "type" || k === "notes" || k === "blocks" || k === "items" || k === "rows") continue;
    n[k] = raw[k];
  }
  n.id = asString(raw.id) || n.id;
  n.when = asString(raw.when);
  n.notes = Array.isArray(raw.notes) ? raw.notes.map((x) => normalizeNote(x, warnings)).filter(Boolean) : [];
  if (type === "article") {
    n.blocks = Array.isArray(raw.blocks) ? raw.blocks.map((b, i) => normalizeNode(b, warnings, `${where}.blocks[${i}]`)).filter(Boolean) : [];
  } else if (type === "visas" || type === "considerants" || type === "list") {
    n.items = Array.isArray(raw.items) ? raw.items.map((it) => normalizeItem(it, warnings)).filter(Boolean) : [];
  } else if (type === "table") {
    n.columns = Array.isArray(raw.columns) ? raw.columns.slice() : [];
    n.rows = Array.isArray(raw.rows) ? raw.rows : [];
  }
  return n;
}

// Transforme un objet brut en trame utilisable. `issues` = problèmes bloquants
// (la trame est alors refusée) ; `warnings` = points importés mais à vérifier.
export function normalizeTrame(raw) {
  const issues = [];
  const warnings = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { trame: null, issues: ["La trame doit être un objet JSON."], warnings };
  }
  const t = { ...newTrame({ body: [] }) };
  t.id = uid("tpl");
  t.name = asString(raw.name).trim();
  if (!t.name) issues.push("« name » est requis (nom de la trame).");
  t.version = asString(raw.version) || "26.01";
  t.familyId = asString(raw.familyId);
  t.actTypeId = asString(raw.actTypeId) || "decision";
  t.status = ["draft", "published", "archived"].includes(raw.status) ? raw.status : "draft";
  t.publishable = raw.publishable !== false;
  t.styleId = asString(raw.styleId);
  t.description = asString(raw.description);
  t.owner = asString(raw.owner) || "Administrateurs";
  t.serviceId = asString(raw.serviceId);
  t.bureauId = asString(raw.bureauId);
  t.entityIds = Array.isArray(raw.entityIds) ? raw.entityIds.slice() : [];
  t.fields = Array.isArray(raw.fields)
    ? raw.fields.map((f, i) => normalizeField(f, warnings, `fields[${i}]`)).filter(Boolean)
    : [];
  t.rules = Array.isArray(raw.rules)
    ? raw.rules.map((r, i) => normalizeRule(r, warnings, `rules[${i}]`)).filter(Boolean)
    : [];
  if (!Array.isArray(raw.body)) {
    issues.push("« body » est requis (tableau de blocs).");
    t.body = [];
  } else {
    t.body = raw.body.map((b, i) => normalizeNode(b, warnings, `body[${i}]`)).filter(Boolean);
    if (!t.body.length) issues.push("« body » ne contient aucun bloc valide.");
  }
  return { trame: issues.length ? null : t, issues, warnings };
}

// Lit un fichier texte et renvoie les trames acceptées + les problèmes rencontrés.
export function readTrameFile(text) {
  const issues = [];
  const warnings = [];
  if (typeof text !== "string" || !text.trim()) return { trames: [], issues: ["Le fichier est vide."], warnings };
  let data;
  try {
    data = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (e) {
    return { trames: [], issues: ["JSON invalide : " + e.message], warnings };
  }
  let raws;
  if (Array.isArray(data)) raws = data;
  else if (data && Array.isArray(data.trames)) raws = data.trames;
  else if (data && data.trame && typeof data.trame === "object") raws = [data.trame];
  else raws = [data];
  if (!raws.length) return { trames: [], issues: ["Aucune trame trouvée dans le fichier."], warnings };
  const multi = raws.length > 1;
  const tag = (m, i) => (multi ? `Trame ${i + 1} : ${m}` : m);
  const trames = [];
  raws.forEach((raw, i) => {
    const res = normalizeTrame(raw);
    res.issues.forEach((m) => issues.push(tag(m, i)));
    res.warnings.forEach((m) => warnings.push(tag(m, i)));
    if (res.trame) trames.push(res.trame);
  });
  return { trames, issues, warnings };
}
