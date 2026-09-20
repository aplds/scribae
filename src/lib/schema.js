import { uid } from "./util.js";
import { emptyAuth } from "./auth.js";
import { EXTERNE_DEFAUT } from "./numbering.js";
import { ABROGATION_DEFAUT } from "./abrogations.js";

export const NODE_TYPES = [
  { id: "title", label: "Intitulé", hint: "Titre de l'acte", akn: "heading", single: true, icon: "t" },
  { id: "authority", label: "Autorité", hint: "Auteur de l'acte", akn: "p" },
  { id: "visas", label: "Visas", hint: "Liste des « Vu »", icon: "v" },
  { id: "considerants", label: "Considérants", hint: "Motivation de l'acte", icon: "c" },
  { id: "enact", label: "Formule d'édiction", hint: "DÉCIDE / ARRÊTE", icon: "e" },
  { id: "article", label: "Article", hint: "Article du dispositif", icon: "a" },
  { id: "para", label: "Paragraphe", hint: "Texte libre", icon: "p" },
  { id: "list", label: "Liste", hint: "Énumération", icon: "l" },
  { id: "table", label: "Tableau", hint: "Grille / annexe", icon: "g" },
  { id: "signature", label: "Bloc signature", hint: "Lieu, date, signataire", icon: "s" },
  { id: "mention", label: "Mention", hint: "Recours, publication (bloc réutilisable)", icon: "m" },
  { id: "raw", label: "Bloc libre", hint: "Texte non structuré", icon: "r" },
];

export const NODE_MAP = Object.fromEntries(NODE_TYPES.map((n) => [n.id, n]));

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
    case "considerants": d("items", [{ id: uid("it"), text: "Considérant que …", when: "" }]); break;
    case "enact": d("text", "DÉCIDE"); break;
    case "article":
      d("numMode", "auto");
      d("num", "1er");
      d("heading", "");
      d("blocks", [newNode("para")]);
      break;
    case "para": d("text", ""); break;
    case "list":
      d("ordered", false);
      d("items", [{ id: uid("it"), text: "", when: "" }]);
      break;
    case "table":
      d("caption", "");
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
  return { id: uid("c"), kind: "instruction", author: "", date: "", text: "", ruleId: "", ...patch };
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
  },
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
