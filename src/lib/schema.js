import { uid } from "./util.js";
import { emptyAuth } from "./auth.js";
import { EXTERNE_DEFAUT } from "./numbering.js";
import { ABROGATION_DEFAUT } from "./abrogations.js";
import { mentionsParDefaut } from "./recueil.js";

export const NODE_TYPES = [
  { id: "title", label: "Intitulé", hint: "Titre de l'acte", akn: "heading", single: true, icon: "t" },
  { id: "authority", label: "Autorité", hint: "Auteur de l'acte", akn: "p" },
  { id: "visas", label: "Visas", hint: "Liste des « Vu »", icon: "v" },
  { id: "considerants", label: "Considérants", hint: "Motivation de l'acte", icon: "c" },
  { id: "enact", label: "Formule d'édiction", hint: "DÉCIDE / ARRÊTE", icon: "e" },
  { id: "division", label: "Division", hint: "Livre, titre, chapitre, section…", icon: "list" },
  { id: "article", label: "Article", hint: "Article du dispositif", icon: "a" },
  { id: "para", label: "Paragraphe", hint: "Texte libre", icon: "p" },
  { id: "list", label: "Liste", hint: "Énumération", icon: "l" },
  { id: "table", label: "Tableau", hint: "Grille / annexe", icon: "g" },
  { id: "signature", label: "Bloc signature", hint: "Lieu, date, signataire", icon: "s" },
  { id: "mention", label: "Mention", hint: "Recours, publication (bloc réutilisable)", icon: "m" },
  { id: "raw", label: "Bloc libre", hint: "Texte non structuré", icon: "r" },
];

export const NODE_MAP = Object.fromEntries(NODE_TYPES.map((n) => [n.id, n]));

// ---------------------------------------------------------------------------
// Hiérarchie du document : l'échelle des divisions.
//
// Un texte long ne se compose pas seulement d'articles : il se range en
// LIVRES, TITRES, CHAPITRES, SECTIONS… — parfois en « Parties », en « Chapitres
// liminaires », en « Sections » numérotées 1°, en articles sans division du
// tout. Le vocabulaire et le nombre d'échelons appartiennent donc à la TRAME,
// non au logiciel : `trame.divisions` est l'échelle, une entrée par échelon
// (`level` croissant : 1 = le plus haut), avec le mot qui s'imprime et la façon
// de numéroter. Une trame sans échelle reçoit celle-ci, qui est l'usage le plus
// courant ; il suffit d'un échelon pour un texte qui ne connaît que des titres.
//
// Un bloc de type `division` porte son échelon (`level`) et son intitulé
// (`heading`) : la hiérarchie est donc PRÉ-INTÉGRÉE à la trame, et la
// numérotation se déduit de la place de chaque échelon dans l'échelle.
// ---------------------------------------------------------------------------
export const NIVEAUX_DEFAUT = [
  { level: 1, label: "Livre", num: "roman" },
  { level: 2, label: "Titre", num: "roman" },
  { level: 3, label: "Chapitre", num: "decimal" },
  { level: 4, label: "Section", num: "decimal" },
];

export const NUM_STYLES = [
  { id: "roman", label: "Chiffres romains (Ier, II, III)" },
  { id: "decimal", label: "Chiffres arabes (1, 2, 3)" },
  { id: "letter", label: "Lettres (A, B, C)" },
  { id: "aucun", label: "Sans numéro" },
];

// Nature du document qu'une trame produit. Un « acte » est le cas ordinaire :
// une décision qui vit par elle-même. Une « annexe » est un document ADOPTÉ par
// un autre — un règlement intérieur adopté par une délibération, un tableau
// tarifaire adopté par une décision : l'annexe ne se signe ni ne se publie pour
// elle-même, c'est l'acte qui l'adopte qui est signé, et son original est suivi
// du texte de l'annexe (voir src/lib/annexes.js et src/lib/annexe-docs.js).
export const ACTE_NATURES = [
  { id: "acte", label: "Acte", hint: "Une décision qui vit par elle-même." },
  { id: "annexe", label: "Annexe", hint: "Un document adopté par un autre : il ne se signe pas, et son texte suit l'acte qui l'adopte." },
];

// ---------------------------------------------------------------------------
// Paramètres propres aux blocs de texte.
//
// Un paragraphe, une liste, un tableau, des considérants ne se ressemblent pas :
// chacun porte ses propres réglages, réglables bloc par bloc dans l'éditeur de
// trame (onglet « Ce bloc »). Ces réglages sont TOUS facultatifs : une valeur
// absente vaut le défaut — et pour la liste comme pour le tableau, un défaut
// VIDE signifie « comme la feuille de style », ce qui laisse la charte de la
// collectivité décider pour les blocs qui ne demandent rien de particulier.
//
//   para  : alignement, alinéa (retrait de première ligne), encadré ;
//   list  : marqueur des listes à puces, numérotation des listes numérotées,
//           numéro de départ ;
//   table : position de la légende, ligne d'en-tête, disposition, alignement ;
//   considérants : formule placée devant chaque considérant, ponctuation
//           finale, ou tout d'un seul alinéa.
//
// Ces valeurs sont honorées par le rendu (`lib/render.js`), par la compilation
// (`lib/compile.js`), par les exports (Markdown, Akoma Ntoso, HTML autonome,
// Word) et par les deux écrans d'édition (trame et rédaction).
// ---------------------------------------------------------------------------
export const BLOC_DEFAUT = {
  para: { align: "", indent: "", boxed: false },
  list: { ordered: false, marker: "", numbering: "", start: 1 },
  table: { captionPos: "top", head: true, layout: "", align: "" },
  considerants: { formule: "", fin: "", inline: false },
};

// Les vocabulaires ci-dessus sont indexés par `id` : c'est l'identifiant qui vit
// dans les données. Les champs de formulaire, eux, attendent `{ value, label }`
// (voir `selectField` / `choiceField`). Cette fonction fait la passerelle, pour
// qu'un vocabulaire ne soit pas recopié en double à chaque écran.
export const choixDe = (liste) => liste.map(({ id, label }) => ({ value: id, label }));

export const PARA_ALIGNS = [
  { id: "", label: "Comme la feuille de style" },
  { id: "justify", label: "Justifié" },
  { id: "left", label: "Fer à gauche" },
  { id: "center", label: "Centré" },
  { id: "right", label: "Fer à droite" },
];

// Le retrait d'un paragraphe : aucun, l'alinéa classique (première ligne), ou
// le bloc entier en retrait — la mise en exergue d'une citation, par exemple.
export const PARA_INDENTS = [
  { id: "", label: "Comme la feuille de style" },
  { id: "none", label: "Aucun retrait" },
  { id: "first", label: "Alinéa (première ligne)" },
  { id: "all", label: "Paragraphe entier en retrait" },
];

// La marque d'une liste à puces. `""` = le marqueur de la feuille de style.
export const LIST_MARKERS = [
  { id: "", label: "Comme la feuille de style" },
  { id: "disc", label: "• Puce ronde" },
  { id: "circle", label: "◦ Puce creuse" },
  { id: "square", label: "▪ Puce carrée" },
  { id: "dash", label: "– Tiret" },
  { id: "none", label: "Aucun marqueur" },
];

// La numérotation d'une liste numérotée. `""` = celle de la feuille de style.
export const LIST_NUMBERINGS = [
  { id: "", label: "Comme la feuille de style" },
  { id: "decimal", label: "1. 2. 3." },
  { id: "degree", label: "1° 2° 3°" },
  { id: "parenth", label: "1) 2) 3)" },
  { id: "lalpha", label: "a) b) c)" },
  { id: "ualpha", label: "A) B) C)" },
  { id: "lroman", label: "i. ii. iii." },
  { id: "uroman", label: "I. II. III." },
  { id: "none", label: "Aucune numérotation" },
];

// La disposition d'un tableau. `""` = celle de la feuille de style.
export const TABLE_LAYOUTS = [
  { id: "", label: "Comme la feuille de style" },
  { id: "grid", label: "Quadrillage complet" },
  { id: "rows", label: "Lignes horizontales seules" },
  { id: "zebra", label: "Lignes alternées" },
];

export const TABLE_ALIGNS = [
  { id: "", label: "Comme la feuille de style" },
  { id: "left", label: "Fer à gauche" },
  { id: "center", label: "Centré" },
  { id: "right", label: "Fer à droite" },
];

export const TABLE_CAPTION_POS = [
  { id: "top", label: "Au-dessus du tableau" },
  { id: "bottom", label: "Au-dessous du tableau" },
];

export const RECITAL_FINS = [
  { id: "", label: "Aucune (le texte porte sa ponctuation)" },
  { id: ";", label: "Point-virgule « ; »" },
  { id: ".", label: "Point « . »" },
  { id: ",", label: "Virgule « , »" },
];

// Les réglages effectifs d'un bloc : ses valeurs, complétées par les défauts.
// Un bloc hérité d'une version antérieure — qui ne connaît pas ces clés — se
// comporte donc exactement comme avant, jusqu'à ce qu'on lui règle quelque
// chose. C'est le point d'entrée unique de tous les rendus.
export function paramsBloc(node) {
  const defauts = BLOC_DEFAUT[node?.type];
  if (!defauts) return {};
  const out = { ...defauts };
  for (const k of Object.keys(defauts)) {
    const v = node[k];
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

// La formule d'un considérant n'est pas répétée quand le texte la porte déjà :
// un considérant écrit « Considérant que la commune… » garde son texte intact
// quand le bloc est réglé sur la formule « Considérant que ». Cela permet de
// régler la formule sur un bloc EXISTANT sans réécrire ses considérants.
// L'élision compte pour la même formule : « Considérant qu'il… » ne reçoit pas
// un « Considérant que » de plus, pas plus que « Considérant, » n'en reçoit un.
const sansAccent = (s) => String(s).toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
export function appliquerFormule(formule, texte) {
  const f = String(formule || "").trim();
  const t = String(texte || "");
  if (!f) return t;
  const df = sansAccent(t.trimStart());
  const nf = sansAccent(f);
  if (df === nf || df.startsWith(nf + " ") || df.startsWith(nf + ",") || df.startsWith(nf + "'") || df.startsWith(nf + "\u2019")) return t;
  // Formule élidée : « Considérant que » s'écrit « Considérant qu' » devant une
  // voyelle (« qu'il », « qu'une »). Le texte porte alors déjà la formule.
  if (nf.endsWith("e") && (df.startsWith(nf.slice(0, -1) + "'") || df.startsWith(nf.slice(0, -1) + "\u2019"))) return t;
  return f + " " + t;
}
export const natureDe = (trame) => ((trame && trame.nature === "annexe") ? "annexe" : "acte");

// L'échelle d'une trame : la sienne, ou celle livrée avec l'application. Une
// échelle vide n'est pas « aucune division » — c'est l'échelle ordinaire.
export const ladderOf = (trame) => {
  const l = (trame && trame.divisions) || [];
  return l.length ? l.slice().sort((a, b) => a.level - b.level) : NIVEAUX_DEFAUT;
};

// L'échelon d'un bloc de division (le mot imprimé et le style de numéro).
export const niveauDe = (trame, level) =>
  ladderOf(trame).find((n) => Number(n.level) === Number(level)) || { level: Number(level) || 1, label: "Division", num: "decimal" };

const ROMAIN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
export function chiffresRomains(n) {
  let v = Math.max(1, Math.floor(Number(n) || 1));
  let out = "";
  for (const [k, s] of ROMAIN) while (v >= k) { out += s; v -= k; }
  return out;
}

const lettres = (n) => {
  let v = Math.max(1, Math.floor(Number(n) || 1));
  let out = "";
  while (v > 0) { const r = (v - 1) % 26; out = String.fromCharCode(65 + r) + out; v = Math.floor((v - 1) / 26); }
  return out;
};

// Le numéro d'un échelon : « Ier » / « II », « 1 » / « 2 », « A » / « B » — ou
// rien du tout (« Section sans numéro »). L'ordinal du premier rang suit
// l'usage français des textes (`Livre Ier`, `Titre Ier`).
export function numeroNiveau(n, style) {
  if (style === "aucun") return "";
  if (style === "roman") return Number(n) === 1 ? "Ier" : chiffresRomains(n);
  if (style === "letter") return lettres(n);
  return String(n);
}

export const FIELD_TYPES = [
  { id: "text", label: "Texte court" },
  { id: "textarea", label: "Texte long" },
  { id: "date", label: "Date" },
  { id: "choice", label: "Choix unique" },
  { id: "multichoice", label: "Choix multiple" },
  { id: "boolean", label: "Oui / Non" },
  { id: "number", label: "Nombre" },
  { id: "money", label: "Montant" },
  { id: "signataire", label: "Signataire (par fonction)" },
  { id: "person", label: "Personne (référentiel)" },
  { id: "entity", label: "Entité (référentiel)" },
  { id: "ref", label: "Référence juridique (référentiel)" },
  { id: "reflist", label: "Liste de références" },
];

export const NOTE_KINDS = [
  { id: "legal", label: "Contrainte juridique", color: "error" },
  { id: "instruction", label: "Consigne de rédaction", color: "info" },
  { id: "question", label: "Point à arbitrer", color: "warning" },
  { id: "watch", label: "Veille normative", color: "success" },
];

export const RULE_LEVELS = [
  { id: "blocking", label: "Bloquant", color: "error" },
  { id: "warning", label: "Avertissement", color: "warning" },
  { id: "info", label: "Information", color: "info" },
];

export function newNode(type, patch = {}) {
  const n = { id: uid("n"), type, when: "", notes: [], ...patch };
  const d = (key, value) => { if (n[key] === undefined) n[key] = value; };
  switch (type) {
    case "title": d("text", "Décision n°{{numero}} du {{dateSignature|date-long}} portant …"); break;
    case "authority": d("text", "{{signataire.fonction}}"); break;
    case "visas": d("items", [{ id: uid("it"), refId: "", text: "", when: "" }]); break;
    case "considerants":
      // La formule se règle sur le BLOC, non dans chaque considérant : un
      // considérant neuf n'écrit donc que sa substance. La formule n'est pas
      // répétée si un texte la porte déjà (`appliquerFormule`).
      d("formule", "Considérant que");
      d("fin", "");
      d("inline", false);
      d("items", [{ id: uid("it"), text: "", when: "" }]);
      break;
    case "enact": d("text", "DÉCIDE"); break;
    case "division":
      // L'échelon (1 = le plus haut), son intitulé, et le contenu : une
      // division peut contenir des articles comme d'autres divisions.
      d("level", 1);
      d("numMode", "auto");
      d("num", "");
      d("heading", "");
      d("blocks", []);
      break;
    case "article":
      d("numMode", "auto");
      d("num", "1er");
      d("heading", "");
      d("blocks", [newNode("para")]);
      break;
    case "para":
      d("align", "");
      d("indent", "");
      d("boxed", false);
      d("text", "");
      break;
    case "list":
      d("ordered", false);
      d("marker", "");
      d("numbering", "");
      d("start", 1);
      d("items", [{ id: uid("it"), text: "", when: "" }]);
      break;
    case "table":
      d("caption", "");
      d("captionPos", "top");
      d("head", true);
      d("layout", "");
      d("align", "");
      d("columns", ["Colonne 1", "Colonne 2"]);
      d("rows", [["", ""]]);
      break;
    case "signature":
      d("place", "{{entity.seatCity}}");
      d("showFunction", true);
      break;
    case "mention":
      d("mentionId", "");
      d("textOverride", "");
      break;
    case "raw": d("text", ""); break;
  }
  return n;
}

export function newField(patch = {}) {
  return {
    id: uid("f"),
    label: "Nouveau champ",
    type: "text",
    group: "Identification",
    required: true,
    help: "",
    placeholder: "",
    options: [],
    refKind: "",
    format: "",
    // Fonction attendue d'un champ « signataire » : la clé d'une fonction du
    // référentiel (rôle ou délégation — voir src/lib/fonctions.js). Vide, celui
    // qui rédige l'acte choisit lui-même la fonction. Ignorée par les autres
    // types de champ.
    qualite: "",
    appliesWhen: "",
    ...patch,
  };
}

export function newRule(patch = {}) {
  return {
    id: uid("r"),
    level: "blocking",
    kind: "check",
    target: "",
    expr: "",
    message: "",
    ref: "",
    author: "",
    date: "",
    ...patch,
  };
}

export function newNote(patch = {}) {
  return { id: uid("c"), kind: "instruction", author: "", date: "", text: "", quote: "", ruleId: "", ...patch };
}

export function newTrame(patch = {}) {
  const t = {
    id: uid("tpl"),
    name: "Nouvelle trame",
    version: "26.01",
    familyId: "",
    actTypeId: "decision",
    status: "draft",
    // Circuit de validation (parapheur). Vide, le circuit applicable est
    // cherché dans le référentiel (`config.circuits`) par trame, famille et
    // entité ; "aucun" dispense explicitement les actes de cette trame de tout
    // passage au parapheur. Voir src/lib/validation.js.
    circuitId: "",
    // Formalités d'exécution : "" suit la règle générale (transmission
    // requise ; notification requise pour les actes individuels), "requise" ou
    // "aucune" tranche. Voir src/lib/execution.js.
    transmission: "",
    notification: "",
    // `publishable: false` déclare la trame comme NON publiable : les actes qui
    // en sont issus (actes individuels : revalorisation d'un traitement, sanction
    // disciplinaire, etc.) sont rédigés, signés et conservés, mais jamais déposés
    // au recueil des actes administratifs. Le réglage est propre à la trame, donc
    // modifiable sans toucher au code, et vaut par défaut (toute trame « normale »
    // est publiable).
    publishable: true,
    // Feuille de style explicite (facultatif). Vide, l'acte reçoit la feuille
    // de son entité, sinon celle de sa famille, sinon la feuille générale —
    // voir src/lib/styles.js. Le réglage est propre à la trame, donc modifiable
    // sans toucher au code.
    styleId: "",
    description: "",
    owner: "Administrateurs",
    entityIds: [],
    serviceId: "",
    bureauId: "",
    // L'échelle des divisions de la trame : la hiérarchie du document est une
    // DONNÉE de la trame (mots et numérotation libres), non du logiciel. Vide,
    // l'application emploie l'échelle livrée (`NIVEAUX_DEFAUT`). Voir `ladderOf`.
    divisions: [],
    // Nature du document produit : un « acte » (le cas ordinaire), ou une
    // « annexe » — un document adopté PAR un autre, annexé à celui-ci.
    nature: "acte",
    // ACTE D'ASSEMBLÉE : l'acte émane d'une assemblée délibérante (conseil
    // municipal, conseil d'administration…) et non d'une personne. Sa ligne
    // d'autorité est celle de l'assemblée (« Le conseil municipal de … »),
    // tandis que l'acte est signé par le président de cette assemblée — le
    // maire, ou le président du conseil d'administration. L'assemblée se règle
    // dans Administration › Assemblées ; le jeton `{{autorite}}` la rend dans le
    // texte. Voir src/lib/conseils.js.
    assemblee: false,
    // Un RÈGLEMENT est une annexe d'un genre particulier : un texte NORMATIF,
    // que le recueil publie AUSSI pour lui-même, à titre informatif — comme un
    // code, qui se consulte article par article et se met à jour par les actes
    // qui l'adoptent ou le modifient. Le drapeau n'a de sens que sur une annexe
    // (`nature: "annexe"`) ; il commande la publication informative autonome
    // (voir src/lib/annexes.js, `estReglement`, et SPEC § 2.2.4 ter).
    reglement: false,
    // Circuit de signature de la trame (fonction « signature externe ») :
    //   ""                  suit le réglage général (Administration › Signature) ;
    //   "externe_impose"    le circuit externe est OBLIGATOIRE pour cette trame ;
    //   "externe_autorise"  le circuit externe est possible, au choix du rédacteur ;
    //   "electronique"      le circuit électronique est imposé.
    // Voir src/lib/externe.js.
    signature: "",
    fields: [],
    rules: [],
    body: [
      newNode("title"),
      newNode("authority"),
      newNode("visas"),
      newNode("considerants"),
      newNode("enact"),
      newNode("article"),
      newNode("signature"),
    ],
    ...patch,
  };
  t.fields = (patch.fields || t.fields).length ? (patch.fields || t.fields) : defaultFields();
  return t;
}

function defaultFields() {
  return [
    newField({ id: "numero", label: "Numéro de l'acte", type: "text", group: "Identification", help: "Chrono attribué par le registre" }),
    newField({ id: "objet", label: "Objet", type: "text", group: "Identification" }),
    newField({ id: "dateSignature", label: "Date de signature", type: "date", group: "Identification" }),
    newField({ id: "dateEffet", label: "Date d'effet", type: "date", group: "Identification", required: false }),
  ];
}

export const emptyConfig = () => ({
  schemaVersion: 1,
  brand: {
    name: "Mon établissement",
    shortName: "ME",
    color: "#000091",
    colorDark: "#1212ff",
    documentFont: "Georgia, 'Times New Roman', serif",
    baseUri: "https://exemple.fr",
    logoUrl: "",
    uiFont: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    supportName: "",
    supportPhone: "",
    supportEmail: "",
  },
  vocab: {
    enact: "DÉCIDE",
    articleLabel: "Article",
    recitalsLabel: "Considérant",
    visasLabel: "Vu",
    authorLine: "L'autorité compétente",
    recoursLabel: "Voies et délais de recours",
    publicationLabel: "Publication",
    // Tournures de la modification d'acte. Chaque `{jeton}` est remplacé :
    // {designation} {designationLower} {designationThe} (avec son article défini :
    // « la décision », « le règlement », « l'arrêté ») {numero} {date} {target}
    // (l'acte modifié, dans une phrase) {article} {newArticle} {dateEffet}
    // {authority} {authorityTo} (« au maire », « à la directrice »).
    amendment: {
      designation: "Décision",
      title: "{designation} n°{numero} du {date} portant modification de {targetInSentence}",
      target: "{designation} n°{numero} du {date}",
      targetInSentence: "{designationThe} n°{numero} du {date}",
      replace: "L'{article} de {target} est remplacé par les dispositions suivantes :",
      abrogate: "L'{article} de {target} est abrogé.",
      insertAfter: "Après l'{article} de {target}, il est inséré un {newArticle} ainsi rédigé :",
      insertBefore: "Avant l'{article} de {target}, il est inséré un {newArticle} ainsi rédigé :",
      append: "Il est ajouté à {target} un {newArticle} ainsi rédigé :",
      entry: "Les dispositions de {designationThe} entrent en vigueur à compter du {dateEffet}.",
      entryDefault: "Les dispositions de {designationThe} entrent en vigueur au lendemain de sa publication.",
      execution: "L'exécution de {designationThe} est confiée {authorityTo}.",
      considerant: "Considérant qu'il y a lieu de modifier {target} ;",
      consolidatedNotice: "Version consolidée à jour des modifications publiées. Ce document est diffusé à titre informatif : seuls les actes publiés au recueil des actes administratifs font foi.",
      trailTitle: "Tableau des modifications",
      trailHead: ["Article", "Modification", "Rédaction"],
      // Mention portée sous l'intitulé d'un article quand le suivi des
      // modifications n'est pas affiché. Jetons : {designationThe} {designation}
      // {designationLower} {numero} {date}.
      mentionReplace: "Modifié par {designationThe} n°{numero} du {date}",
      mentionAbrogate: "Abrogé par {designationThe} n°{numero} du {date}",
      mentionInsert: "Ajouté par {designationThe} n°{numero} du {date}",
      mentionThen: ", puis ",
      renumberNotice: "Les articles ont été renumérotés : la numérotation du dispositif est continue.",
      abrogationNotice: "L'acte est abrogé dans son ensemble : ses articles ne sont plus en vigueur.",
    },
    // Tournures de l'abrogation PRÉVUE par un acte (clause de fin de dispositif).
    // Jetons : {target} {targetCap} {abroge} {article} {articleLabel} {self}
    // {selfDe} {designation} {designationLower} {designationThe}.
    abrogation: { ...ABROGATION_DEFAUT },
  },
  numbering: {
    pattern: "{year}-{seq}-{entityCode}",
    seq: 1,
    pad: 3,
    year: new Date().getFullYear(),
    eliPattern: "{baseUri}/eli/{actTypeId}/{year}/{seq}/{entityCode}",
    eliEntity: true,
    // Source du numéro : la séquence ci-dessus, ou un service externe (Grist,
    // tableur en ligne…). Voir src/lib/numbering.js.
    source: "interne",
    externe: { ...EXTERNE_DEFAUT },
  },
  entities: [],
  // Assemblées délibérantes (conseils). Un acte d'assemblée — une
  // délibération — émane d'un conseil : sa ligne d'autorité est celle de
  // l'assemblée, et il est signé par le président de cette assemblée (le maire,
  // ou le président du conseil d'administration). Voir src/lib/conseils.js.
  councils: [],
  services: [],
  people: [],
  roles: [],
  refs: [],
  mentions: [],
  families: [],
  // Circuits de validation (parapheur) : des étapes confiées à des rôles, qui
  // décident du passage d'un acte à la signature. Voir src/lib/validation.js.
  circuits: [],
  // Délais et formalités d'exécution : ce qui rend un acte exécutoire (contrôle
  // de légalité, publication, notification) et le délai de recours qui en
  // découle. Voir src/lib/execution.js.
  delais: {
    recoursMois: 2,
    transmissionJours: 15,
    publicationJours: 10,
    notificationJours: 8,
  },
  // Publication au recueil : les réglages qui valent pour toutes les
  // publications (titre du recueil, règle d'entrée en vigueur), et
  // l'automatisme — `auto`, allumé par défaut, publie l'acte dès le retour
  // signé. Voir src/lib/eli.js (publicationSettings) et Administration › Publication.
  publication: {
    recueil: "Recueil des actes administratifs",
    auto: true,
    opposabilite: { mode: "lendemain", jours: 1 },
    // Renvois du recueil public vers d'AUTRES recueils que celui-ci (voir
    // src/lib/recueil.js, `recueilsExternes`) : un ou plusieurs recueils « bis »
    // tenus hors de l'application, un ou plusieurs recueils inactifs — avec la
    // période qu'ils couvrent —, et les sites de référence (Légifrance,
    // service-public.gouv.fr). Ces renvois s'affichent en bas de page de l'espace
    // public et à la fin des résultats de recherche. L'administration les écrit,
    // les ordonne et les retire sans toucher au code.
    recueilsExternes: [],
    // Mentions du pied de page de l'espace public (voir src/lib/recueil.js,
    // `mentionsPubliques`) : les **mentions légales** — qui rappellent les règles
    // de publication, d'exécution et d'opposabilité des actes administratifs — et
    // les **mentions d'accessibilité**. Chacune s'affiche comme un texte, se
    // remplace par un simple lien (les mentions du site principal de la
    // collectivité, par exemple), ou se désactive : l'administration en décide.
    mentions: mentionsParDefaut(),
  },
  // Circuit de signature de la collectivité. `mode` : « electronique » (défaut —
  // le prestataire, par API), ou « externe » (le document est téléchargé, signé
  // hors de l'application, puis déposé en PDF ; le réviseur certifie la
  // conformité avant publication). Une trame peut trancher autrement — imposer
  // ou autoriser le circuit externe — par son réglage `signature`. Voir
  // src/lib/externe.js et Administration › Signature.
  signature: { mode: "electronique" },
  // Mode d'authentification : comptes de l'application (démonstration) ou
  // annuaire de la collectivité (OIDC). Brancher l'annuaire désactive
  // automatiquement les comptes de démonstration. Voir src/lib/auth.js.
  auth: emptyAuth(),
  // Fonctions expérimentales : livrées, mais éteintes par défaut, et activées
  // depuis Administration › Expérimentale.
  //   • `parapheur` fait passer les actes par un circuit de validation de
  //     l'établissement avant la signature (voir src/lib/validation.js) :
  //     beaucoup de collectivités ont déjà leur propre circuit, en amont de
  //     « Envoyer en signature » — d'où le défaut éteint.
  //   • `controleLegalite` transmet l'acte signé au représentant de l'État par
  //     une API d'envoi, entre le retour signé et la publication : l'accusé de
  //     réception du contrôle de légalité est déposé sur le document, puis
  //     l'acte est publié (voir src/lib/legalite.js). Éteint par défaut — la
  //     télétransmission suppose une convention et des identifiants auprès de
  //     la préfecture ; l'administration de la formalité reste possible à la
  //     main depuis l'échéancier.
  experimental: { parapheur: false, controleLegalite: false },
  // Assistants — deux aides en langage naturel, livrées avec l'application :
  //   • « Plume », dans l'atelier, qui explique le MODE D'EMPLOI de l'outil —
  //     et ne reçoit jamais le contenu d'un acte (voir src/lib/assistant.js) ;
  //   • « Publia », sur le recueil public, qui répond sur les actes PUBLIÉS.
  // Ne sont rangés ici que les ÉCARTS aux réglages livrés : un bloc vide veut
  // dire « tout par défaut ». Chacun s'allume ou s'éteint, et le moteur de
  // langage est interchangeable — celui de Perchance, ou celui de la
  // collectivité (adresse d'API, clé, modèle).
  assistant: { atelier: {}, public: {} },
  // Feuilles de style (charte graphique des décisions). La feuille générale est
  // marquée `general: true` ; les autres sont des sous-feuilles rattachées à des
  // entités et/ou des familles. Voir src/lib/styles.js — et, pour le modèle
  // d'une feuille, `emptyStyle()`. Vide, l'application retombe sur l'identité
  // de la marque (comportement historique).
  styles: [],
  actTypes: [
    { id: "decision", label: "Décision", aknElement: "act" },
    { id: "reglement", label: "Règlement intérieur", aknElement: "act" },
    { id: "deliberation", label: "Délibération", aknElement: "act" },
  ],
  audit: [],
});

// Une trame est publiable sauf déclaration contraire explicite. Une trame
// héritée (créée avant l'introduction du réglage) n'a pas la propriété : elle est
// donc considérée comme publiable — c'est le comportement historique.
export const tramePublishable = (trame) => !!trame && trame.publishable !== false;

// Une trame n'est proposée aux services rédacteurs que lorsqu'un éditeur l'a
// MISE À DISPOSITION (« publiée ») : tant qu'elle est en brouillon, elle reste
// l'affaire de l'atelier — on la prépare, on la corrige, on la discute, sans
// qu'un service puisse rédiger à partir d'un modèle inachevé. Le statut porte
// les trois états du cycle de vie : brouillon, mise à disposition, archivée.
export const trameDisponible = (trame) => !!trame && trame.status === "published";

export const validateTrameShape = (trame) => {
  const issues = [];
  if (!trame) issues.push("Trame absente");
  else {
    if (!trame.name) issues.push("La trame doit avoir un nom");
    if (!Array.isArray(trame.body) || !trame.body.length) issues.push("La trame est vide");
    if (!Array.isArray(trame.fields)) issues.push("Champs absents");
  }
  return issues;
};
