import { emptyConfig, newNode, newField, newRule, newNote, newTrame } from "./schema.js";
import { seedStyles } from "./styles.js";

// ============================================================================
// Jeu de données initial. RIEN ici n'est utilisé par la logique applicative :
// ces valeurs remplissent le référentiel, qui est éditable et exportable.
// Remplacez-le par le vôtre via Référentiel › Import, ou videz-le.
//
// Ce jeu est celui du démonstrateur : une collectivité FICTIVE, la ville de
// Valmont-sur-Loire (mairie). Aucune donnée réelle n'y figure.
// ============================================================================

// Emblème de la commune fictive (SVG embarqué sous forme de data URL). Il est
// volontairement embarqué plutôt que lu dans `src/assets/` : les bibliothèques
// de capture d'écran (guide imprimable, vignettes) ne savent pas résoudre un
// chemin relatif dans leur copie du document, alors qu'une data URL est
// auto-suffisante.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 72" role="img" aria-label="Ville de Valmont-sur-Loire">
  <defs><clipPath id="ecu"><path d="M32 2 60 11v27c0 15-11.6 26-28 32C15.6 64 4 53 4 38V11Z"/></clipPath></defs>
  <path d="M32 2 60 11v27c0 15-11.6 26-28 32C15.6 64 4 53 4 38V11Z" fill="#eef3fb"/>
  <g clip-path="url(#ecu)">
    <path d="M4 30c9-7 15 3 24-1s17-8 28-3v14c-11-4-19 1-28 5S13 50 4 45Z" fill="#2b6fb3" opacity=".9"/>
    <path d="M4 41c9-6 15 3 24-1s17-8 28-3v6c-11-4-19 1-28 5S13 60 4 55Z" fill="#1b4b7d"/>
    <path d="M4 12c10 5 18 1 28-2s20-2 28 3v9c-9-6-17-1-28 3S13 32 4 27Z" fill="#1f7a44"/>
    <circle cx="44" cy="13" r="6" fill="#f0c419"/>
    <path d="M23 27 32 12l9 15Z" fill="#0f3d2e" opacity=".55"/>
  </g>
  <path d="M32 2 60 11v27c0 15-11.6 26-28 32C15.6 64 4 53 4 38V11Z" fill="none" stroke="#12335c" stroke-width="3"/>
</svg>`;

const LOGO_DATA_URL = "data:image/svg+xml;base64," + btoa(LOGO_SVG.trim());

export function seedConfig() {
  const c = emptyConfig();
  c.brand = {
    name: "Ville de Valmont-sur-Loire",
    shortName: "VSL",
    color: "#000091",
    colorDark: "#1212ff",
    baseUri: "https://www.valmont-sur-loire.fr",
    logoUrl: LOGO_DATA_URL,
    uiFont: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif",
    documentFont: "'Times New Roman', Times, Georgia, serif",
    supportName: "Service des affaires générales",
    supportPhone: "",
    supportEmail: "",
    demo: true,
    demoText: "",
  };
  c.vocab = {
    ...c.vocab,
    enact: "ARRÊTE",
    articleLabel: "Article",
    recitalsLabel: "Considérant",
    visasLabel: "Vu",
    authorLine: "L'autorité compétente",
    recoursLabel: "Voies et délais de recours",
    publicationLabel: "Publication",
    amendment: {
      ...c.vocab.amendment,
      designation: "Arrêté",
      targetInSentence: "{designationThe} n°{numero} du {date}",
    },
  };
  c.numbering = { pattern: "{year}-{seq}-{entityCode}", seq: 401, pad: 3, year: 2026, eliPattern: "{baseUri}/eli/{actTypeId}/{year}/{seq}/{entityCode}", eliEntity: true };
  c.actTypes = [
    { id: "arrete", label: "Arrêté", aknElement: "act" },
    { id: "decision", label: "Décision", aknElement: "act" },
    { id: "deliberation", label: "Délibération", aknElement: "act" },
    { id: "reglement", label: "Règlement", aknElement: "act" },
  ];

  c.roles = [
    { id: "maire", label: "Maire" },
    { id: "adjoint", label: "Adjoint / Adjointe au maire" },
    { id: "dgs", label: "Directeur général / Directrice générale des services" },
    { id: "directeur-service", label: "Directeur / Directrice de service" },
    { id: "secretaire-general", label: "Secrétaire général / Secrétaire générale" },
    { id: "responsable-administratif", label: "Responsable administratif / administrative" },
    { id: "agent", label: "Agent" },
    { id: "regisseur", label: "Régisseur / Régisseuse" },
  ];

  c.entities = [
    {
      id: "ent-vsl", code: "VSL", kind: "commune",
      name: "Ville de Valmont-sur-Loire",
      nameWithArt: "la commune de Valmont-sur-Loire",
      authorityFormula: "Le maire de Valmont-sur-Loire",
      legalName: "Commune de Valmont-sur-Loire",
      seatCity: "Valmont-sur-Loire",
      tribunal: "Orléans",
    },
    {
      id: "ent-ccas", code: "CCAS", kind: "etablissement-public",
      name: "CCAS de Valmont-sur-Loire",
      nameWithArt: "le CCAS de Valmont-sur-Loire",
      authorityFormula: "La présidente du CCAS de Valmont-sur-Loire",
      legalName: "Centre communal d'action sociale de Valmont-sur-Loire",
      seatCity: "Valmont-sur-Loire",
      tribunal: "Orléans",
      parentId: "ent-vsl",
    },
    {
      id: "ent-cde", code: "CDE", kind: "etablissement-public",
      name: "Caisse des écoles de Valmont-sur-Loire",
      nameWithArt: "la Caisse des écoles de Valmont-sur-Loire",
      authorityFormula: "La présidente de la Caisse des écoles de Valmont-sur-Loire",
      legalName: "Caisse des écoles de Valmont-sur-Loire",
      seatCity: "Valmont-sur-Loire",
      tribunal: "Orléans",
      parentId: "ent-vsl",
    },
  ];

  c.services = [
    {
      id: "svc-dgs", code: "DGS", name: "Direction générale des services", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-dgs-pilotage", name: "Pilotage des services" },
        { id: "bur-dgs-rh", name: "Ressources humaines" },
      ],
    },
    {
      id: "svc-sg", code: "SG", name: "Secrétariat général", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-sg-assemblees", name: "Assemblées et actes" },
        { id: "bur-sg-courrier", name: "Courrier et accueil" },
      ],
    },
    {
      id: "svc-ag", code: "AG", name: "Affaires générales", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-ag-juridique", name: "Affaires juridiques" },
        { id: "bur-ag-marches", name: "Marchés publics" },
      ],
    },
    {
      id: "svc-dsi", code: "DSI", name: "Direction des systèmes d'information", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-dsi-exploit", name: "Exploitation et réseaux" },
        { id: "bur-dsi-apps", name: "Applications métier" },
      ],
    },
    {
      id: "svc-cabinet", code: "CAB", name: "Cabinet du maire", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-cab-secretariat", name: "Secrétariat du maire" },
        { id: "bur-cab-communication", name: "Communication" },
      ],
    },
    {
      id: "svc-regie", code: "REG", name: "Régie de recettes", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-reg-principale", name: "Régie principale" },
        { id: "bur-reg-annexes", name: "Régies annexes" },
      ],
    },
    {
      id: "svc-accueil", code: "ACC", name: "Accueil de la mairie", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-acc-physique", name: "Accueil physique" },
        { id: "bur-acc-standard", name: "Standard téléphonique" },
      ],
    },
    {
      id: "svc-social", code: "AS", name: "Action sociale", entityId: "ent-ccas",
      bureaux: [
        { id: "bur-as-domicile", name: "Aide à domicile" },
        { id: "bur-as-general", name: "Action sociale générale" },
      ],
    },
  ];

  c.people = [
    { id: "p-faure", civility: "Madame", firstName: "Claire", lastName: "FAURE", entityId: "ent-vsl", roles: ["maire"], refs: [{ kind: "deliberation", label: "délibération n°2026-014 du 3 avril 2026" }] },
    { id: "p-bernard", civility: "Monsieur", firstName: "Éric", lastName: "BERNARD", entityId: "ent-vsl", roles: ["adjoint"], refs: [] },
    { id: "p-mercier", civility: "Monsieur", firstName: "Julien", lastName: "MERCIER", entityId: "ent-vsl", roles: ["dgs"], refs: [] },
    { id: "p-leclerc", civility: "Madame", firstName: "Sophie", lastName: "LECLERC", entityId: "ent-vsl", roles: ["secretaire-general"], refs: [] },
    { id: "p-roussel", civility: "Madame", firstName: "Amandine", lastName: "ROUSSEL", entityId: "ent-vsl", roles: ["responsable-administratif"], refs: [] },
    { id: "p-garnier", civility: "Monsieur", firstName: "Thomas", lastName: "GARNIER", entityId: "ent-vsl", roles: ["regisseur"], refs: [] },
    { id: "p-martin", civility: "Madame", firstName: "Hélène", lastName: "MARTIN", entityId: "ent-ccas", roles: ["directeur-service"], refs: [] },
    { id: "p-daval", civility: "Madame", firstName: "Isabelle", lastName: "DAVAL", entityId: "ent-vsl", roles: ["directeur-service"], refs: [] },
    { id: "p-leblanc", civility: "Madame", firstName: "Sarah", lastName: "LEBLANC", entityId: "ent-vsl", roles: ["agent"], refs: [] },
  ];

  c.refs = [
    { id: "ref-cgct", kind: "code", label: "le code général des collectivités territoriales, notamment ses articles L. 2122-18 à L. 2122-20", scope: "all", active: true, source: "" },
    { id: "ref-cgfp", kind: "code", label: "le code général de la fonction publique", scope: "all", active: true },
    { id: "ref-crpa", kind: "code", label: "le code des relations entre le public et l'administration", scope: "all", active: true },
    { id: "ref-decret-regies", kind: "decret", label: "le décret n°2019-798 du 26 juillet 2019 relatif aux régies de recettes et d'avances des organismes publics", scope: "all", active: true },
    { id: "ref-decret-gbcp", kind: "decret", label: "le décret n°2012-1246 du 7 novembre 2012 relatif à la gestion budgétaire et comptable publique", scope: "all", active: true },
    { id: "ref-instruction-regies", kind: "instruction", label: "l'instruction codificatrice n°BOFIP-GCP-24-0010 du 3 avril 2024 relative aux régies de recettes et d'avances publiques", scope: "all", active: true },
    { id: "ref-delib-delegation", kind: "deliberation", label: "la délibération du conseil municipal n°2026-014 du 3 avril 2026 donnant délégation au maire", scope: "all", active: true },
    { id: "ref-delib-budget", kind: "deliberation", label: "la délibération du conseil municipal n°2026-021 du 9 avril 2026 portant vote du budget primitif 2026", scope: "all", active: true },
    { id: "ref-ri-conseil", kind: "reglement", label: "le règlement intérieur du conseil municipal", scope: "all", active: true },
  ];

  const delegations = [
    { code: "VSL", id: "ent-vsl", label: "l'arrêté du maire du 10 avril 2026 portant délégation de signature aux adjoints" },
    { code: "CCAS", id: "ent-ccas", label: "l'arrêté du 15 avril 2026 portant délégation de signature à la directrice du CCAS" },
    { code: "CDE", id: "ent-cde", label: "l'arrêté du 15 avril 2026 portant délégation de signature à la directrice de la Caisse des écoles" },
  ];
  for (const d of delegations) {
    c.refs.push({ id: "ref-deleg-" + d.code, kind: "arrete-delegation", entityId: d.id, label: d.label, scope: "entity", active: true });
  }

  c.mentions = [
    {
      id: "men-recours",
      kind: "recours",
      label: "Voies et délais de recours (R.421-1 CJA)",
      text: "Conformément à l'article R.421-1 du code de justice administrative, le présent arrêté peut faire l'objet d'un recours gracieux ou, à défaut, d'un recours contentieux auprès du tribunal administratif de {{entity.tribunal}} dans un délai de deux mois à compter de sa publication.",
    },
    {
      id: "men-publication",
      kind: "publication",
      label: "Publication au recueil des actes administratifs",
      text: "Le présent arrêté est publié au recueil des actes administratifs de {{entity.nameWithArt}}.",
    },
    {
      id: "men-consolidee",
      kind: "publication",
      label: "Portée informationnelle (version consolidée)",
      text: "Le présent document est une version consolidée diffusée à titre informationnel. Les voies et délais de recours applicables sont ceux prévus au sein des arrêtés d'origine et modificatifs.",
    },
    // Actes individuels (trame déclarée non publiable) : l'acte n'est pas déposé
    // au recueil, il est notifié à l'intéressé — c'est la notification qui fait
    // courir le délai de recours.
    {
      id: "men-notification",
      kind: "notification",
      label: "Notification à l'intéressé (acte individuel)",
      text: "Le présent arrêté sera notifié à l'intéressé.",
    },
    {
      id: "men-recours-notification",
      kind: "recours",
      label: "Voies et délais de recours (notification)",
      text: "Conformément à l'article R.421-1 du code de justice administrative, le présent arrêté peut faire l'objet d'un recours gracieux ou, à défaut, d'un recours contentieux auprès du tribunal administratif de {{entity.tribunal}} dans un délai de deux mois à compter de sa notification.",
    },
  ];

  c.families = [
    { id: "fam-nominations", label: "Nominations et affectations" },
    { id: "fam-delegations", label: "Délégations de signature" },
    { id: "fam-organisation", label: "Organisation des services" },
    { id: "fam-police", label: "Police administrative" },
    { id: "fam-etat-civil", label: "État civil" },
    { id: "fam-urbanisme", label: "Urbanisme et voirie" },
    { id: "fam-finances", label: "Finances et budget" },
    { id: "fam-marches", label: "Marchés publics" },
    { id: "fam-rh", label: "Ressources humaines" },
    { id: "fam-associations", label: "Associations et subventions" },
    { id: "fam-regies", label: "Régies" },
    { id: "fam-individuels", label: "Actes individuels (non publiables)" },
  ];
  // Les feuilles de style de la démonstration (voir src/lib/styles.js) : une
  // feuille générale, une charte propre au CCAS, une charte pour les actes
  // individuels. Elles se règlent dans l'écran « Feuilles de style ».
  c.styles = seedStyles();

  // Délais et formalités : ce qui rend un acte exécutoire et le délai de
  // recours qui en découle (voir src/lib/execution.js). Réglables dans
  // Référentiel › Exécution & délais.
  c.delais = {
    recoursMois: 2,          // recours contentieux : deux mois
    transmissionJours: 15,   // objectif de transmission au contrôle de légalité
    publicationJours: 10,    // objectif de publication au recueil
    notificationJours: 8,    // objectif de notification d'un acte individuel
  };

  // Circuits de validation (le parapheur — voir src/lib/validation.js).
  // Trois circuits suffisent à montrer la mécanique : un circuit général ciblé
  // sur la commune, un circuit propre au CCAS, et un circuit allégé pour les
  // actes individuels. La résolution retient le circuit le PLUS SPÉCIFIQUE :
  // une revalorisation (famille « actes individuels ») suit le circuit allégé,
  // pas le circuit général.
  c.circuits = [
    {
      id: "cir-general",
      label: "Circuit général de la commune",
      description: "Bon pour accord du chef de service, puis visa de la direction générale.",
      active: true,
      entityIds: ["ent-vsl"], familyIds: [], trameIds: [],
      steps: [
        {
          id: "etp-chef-service", label: "Bon pour accord du chef de service",
          role: "editeur", kind: "accord", serviceScoped: true, optional: false,
          help: "Le chef du service qui a préparé l'acte vérifie le fond et l'orthographe avant transmission.",
        },
        {
          id: "etp-direction", label: "Visa de la direction générale",
          role: "administrateur", kind: "accord", serviceScoped: false, optional: false,
          help: "Contrôle de légalité interne et engagement de la collectivité.",
        },
      ],
    },
    {
      id: "cir-ccas",
      label: "Circuit du CCAS",
      description: "Bon pour accord du responsable de service, puis avis du secrétariat général.",
      active: true,
      entityIds: ["ent-ccas"], familyIds: [], trameIds: [],
      steps: [
        {
          id: "etp-ccas-chef", label: "Bon pour accord du responsable de service",
          role: "editeur", kind: "accord", serviceScoped: true, optional: false,
          help: "L'action sociale relève du CCAS : le responsable du service concerné engage son budget.",
        },
        {
          id: "etp-ccas-avis", label: "Avis du secrétariat général",
          role: "administrateur", kind: "avis", serviceScoped: false, optional: true,
          help: "Avis facultatif : il n'empêche pas la signature, mais il est conservé au dossier.",
        },
      ],
    },
    {
      id: "cir-individuels",
      label: "Circuit allégé — actes individuels",
      description: "Un seul bon pour accord : les actes individuels ne passent pas par la direction.",
      active: true,
      entityIds: [], familyIds: ["fam-individuels"], trameIds: [],
      steps: [
        {
          id: "etp-individuel", label: "Bon pour accord du responsable des ressources humaines",
          role: "editeur", kind: "accord", serviceScoped: true, optional: false,
          help: "Vérification de l'habilitation, du grade et du montant avant signature.",
        },
      ],
    },
  ];
  return c;
}

const visa = (refId = "", when = "", extra = {}) => ({
  id: "it-" + Math.random().toString(36).slice(2, 7), refId, text: "", when, ...extra,
});
// Visa résolu automatiquement dans le référentiel pour l'entité signataire :
const visaSelf = (refKind, when = "") => ({ id: "it-" + Math.random().toString(36).slice(2, 7), refId: "", refKind, refScope: "self", text: "", when });

export function seedTrames() {
  return [nominationTrame(), delegationTrame(), regieTrame(), subventionTrame(), revalorisationTrame()];
}

function commonHeader(extraFields = []) {
  return [
    newField({ id: "numero", label: "Numéro de l'acte", type: "text", group: "Identification", help: "Format configurable dans le référentiel (numérotation)." }),
    newField({ id: "objet", label: "Objet", type: "textarea", group: "Identification", help: "Complète l'intitulé : « portant … »." }),
    newField({ id: "dateSignature", label: "Date de signature", type: "date", group: "Identification" }),
    newField({ id: "dateEffet", label: "Date d'effet", type: "date", group: "Identification", required: false, help: "À défaut : lendemain de la publication." }),
    newField({ id: "signataire", label: "Signataire", type: "person", group: "Signature" }),
    ...extraFields,
  ];
}

function headerNodes(withConsid = true) {
  const nodes = [
    newNode("title", { text: "Arrêté n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
    newNode("authority", { text: "{{entity.authorityFormula}}" }),
    newNode("visas", {
      items: [
        visa("ref-cgct"),
        visa("ref-cgfp"),
        visa("ref-delib-delegation"),
        visaSelf("arrete-delegation"),
        visa("ref-ri-conseil"),
      ],
    }),
  ];
  if (withConsid) nodes.push(newNode("considerants"));
  nodes.push(newNode("enact", { text: "ARRÊTE" }));
  return nodes;
}

function recoursAndPublication() {
  return [
    newNode("mention", { mentionId: "men-recours" }),
    newNode("mention", { mentionId: "men-publication" }),
  ];
}

// ---------------------------------------------------------------- nomination
function nominationTrame() {
  return newTrame({
    id: "tpl-nomination",
    name: "Arrêté — nomination d'un agent",
    version: "26.05",
    familyId: "fam-nominations",
    actTypeId: "arrete",
    status: "published",
    owner: "Direction générale des services",
    serviceId: "svc-dgs",
    bureauId: "bur-dgs-rh",
    description: "Nomination ou affectation d'un agent dans un service de la commune.",
    fields: commonHeader([
      newField({ id: "beneficiaire", label: "Bénéficiaire", type: "person", group: "Objet de l'acte" }),
      newField({ id: "fonction", label: "Fonction", type: "text", group: "Objet de l'acte" }),
      newField({ id: "service", label: "Service d'affectation", type: "text", group: "Objet de l'acte", required: false }),
    ]),
    rules: [
      newRule({
        id: "r-nomination-1", level: "blocking", expr: "exists(beneficiaire) && exists(fonction)",
        message: "Le bénéficiaire et la fonction sont obligatoires.",
        author: "Direction générale des services", date: "2026-05-01",
      }),
      newRule({
        id: "r-nomination-2", level: "blocking", expr: "!exists(dateEffet) || !exists(dateSignature) || diff_days(dateEffet, dateSignature) >= 0",
        message: "Pas de rétroactivité : la date d'effet ne peut pas précéder la date de signature.",
        ref: "principes généraux du droit", author: "Direction générale des services", date: "2026-05-01",
      }),
      newRule({
        id: "r-nomination-3", level: "warning", expr: "exists(numero) && matches(numero, '^[0-9]{4}-[0-9]{3}-[A-Z]+$')",
        message: "Le numéro devrait suivre le format AAAA-NNN-CODE (ex. 2026-401-VSL).",
        author: "Direction générale des services", date: "2026-05-01",
      }),
    ],
    body: [
      ...headerNodes(),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "{{beneficiaire.civility}} {{beneficiaire.firstName}} {{beneficiaire.lastName}} est nommé(e) aux fonctions de {{fonction}}{{service ? ' — service ' + service : ''}}." })],
        notes: [
          newNote({ kind: "instruction", author: "Direction générale des services", text: "Vérifier que l'agent concerné n'a pas déjà une délégation de signature sur le même périmètre." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [newNode("para", { text: "Le présent arrêté prend effet {{dateEffet ? \"le \" + dateEffet : \"au lendemain de sa publication au recueil des actes administratifs\"}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général des services de {{entity.nameWithArt}} est chargé de l'exécution du présent arrêté." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      ...recoursAndPublication(),
    ],
  });
}

// -------------------------------------------------------------- délégations
function delegationTrame() {
  return newTrame({
    id: "tpl-delegation",
    name: "Arrêté — délégation / subdélégation de signature",
    version: "26.06",
    familyId: "fam-delegations",
    actTypeId: "arrete",
    status: "published",
    owner: "Secrétariat général",
    serviceId: "svc-sg",
    bureauId: "bur-sg-assemblees",
    description: "Délégation de signature à un adjoint ou à un agent, avec périmètres conditionnels.",
    fields: [
      ...commonHeader([
        newField({ id: "delegataire", label: "Délégataire", type: "person", group: "Objet de l'acte" }),
        newField({ id: "fonctionDelegataire", label: "Fonction du délégataire", type: "text", group: "Objet de l'acte" }),
        newField({
          id: "perimetres", label: "Périmètres délégués", type: "multichoice", group: "Objet de l'acte",
          options: ["etat-civil", "urbanisme", "finances", "ressources-humaines", "voirie", "associations", "marches-publics", "scolarite"],
          help: "Chaque périmètre ajoute automatiquement les clauses correspondantes.",
        }),
      ]),
      newField({ id: "typeActe", label: "Nature de la délégation", type: "choice", group: "Objet de l'acte", options: ["delegation", "subdelegation"] }),
    ],
    rules: [
      newRule({ author: "Secrétariat général",}),
      newRule({ author: "Secrétariat général",}),
      newRule({
        id: "r-deleg-3", level: "warning",
        expr: "!contains(perimetres, 'marches-publics') || (delegataire && delegataire.roles && count(delegataire.roles) > 0)",
        message: "La délégation d'une partie de la commande publique est une nouveauté : à signaler aux affaires juridiques.",
        author: "Secrétariat général", date: "2026-06-01",
      }),
    ],
    body: [
      ...headerNodes(false),
      newNode("considerants", { items: [{ id: "c1", text: "Considérant qu'il est nécessaire d'assurer la continuité du fonctionnement du service ;", when: "" }] }),
      newNode("article", {
        numMode: "auto", heading: "Champ de la délégation",
        blocks: [
          newNode("para", { text: "{{typeActe == 'subdelegation' ? 'Subdélégation' : 'Délégation'}} de signature est accordée à {{delegataire.civility}} {{delegataire.firstName}} {{delegataire.lastName}}, {{fonctionDelegataire}}, à l'effet de signer, au nom du maire, les actes suivants :" }),
          newNode("list", {
            items: [
              { id: "i1", text: "Les actes d'état civil et les pièces qui s'y rattachent ;", when: "contains(perimetres, 'etat-civil')" },
              { id: "i2", text: "Les autorisations d'urbanisme dans la limite de 20 000 € de travaux ;", when: "contains(perimetres, 'urbanisme')" },
              { id: "i3", text: "Les actes de gestion budgétaire et comptable, à l'exclusion des marchés publics ;", when: "contains(perimetres, 'finances')" },
              { id: "i4", text: "Les actes de gestion des ressources humaines, à l'exclusion des nominations ;", when: "contains(perimetres, 'ressources-humaines')" },
              { id: "i5", text: "Les autorisations de voirie et d'occupation temporaire du domaine public ;", when: "contains(perimetres, 'voirie')" },
              { id: "i6", text: "Les conventions avec les associations locales et les demandes de subvention ;", when: "contains(perimetres, 'associations')" },
              { id: "i7", text: "Les pièces administratives des marchés publics et accords-cadres ;", when: "contains(perimetres, 'marches-publics')" },
              { id: "i8", text: "Les actes relatifs à la restauration scolaire et aux accueils périscolaires.", when: "contains(perimetres, 'scolarite')" },
            ],
          }),
        ],
        notes: [
          newNote({ kind: "instruction", author: "Secrétariat général", text: "Le nom du délégataire doit être remplacé par la personne qui bénéficie de la subdélégation en l'absence du bénéficiaire initial." }),
          newNote({ kind: "watch", author: "Secrétariat général", text: "Les actes pris au nom de l'État sur le fondement du pouvoir de police du maire demeurent de la compétence du maire." }),
          newNote({ kind: "legal", author: "Secrétariat général", text: "L'intégralité de ce périmètre relève actuellement du maire sans délégation à un agent. Pas de mise en œuvre envisagée en 2026." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Subdélégation",
        blocks: [newNode("para", { text: "Toute subdélégation par le bénéficiaire de la présente délégation est interdite." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général des services de {{entity.nameWithArt}} est chargé de l'exécution du présent arrêté." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      ...recoursAndPublication(),
    ],
  });
}

// ------------------------------------------------------------------- régies
function regieTrame() {
  return newTrame({
    id: "tpl-regie-creation",
    name: "Arrêté — création de régie (recettes et/ou avances)",
    version: "26.09",
    familyId: "fam-regies",
    actTypeId: "arrete",
    status: "published",
    owner: "Régie de recettes",
    serviceId: "svc-regie",
    bureauId: "bur-reg-principale",
    description: "Institution d'une régie de recettes et/ou d'avances, avec clauses conditionnelles (moyens de paiement, plafonds, durée).",
    fields: [
      ...commonHeader([
        newField({ id: "nomRegie", label: "Nom de la régie", type: "text", group: "Objet de l'acte" }),
        newField({ id: "service", label: "Service de rattachement", type: "text", group: "Objet de l'acte" }),
        newField({ id: "typeRegie", label: "Type de régie", type: "choice", group: "Objet de l'acte", options: ["avances", "recettes", "avances-et-recettes"] }),
        newField({ id: "regisseur", label: "Régisseur / Régisseuse", type: "person", group: "Objet de l'acte" }),
        newField({ id: "dateDebut", label: "Date de mise en place", type: "date", group: "Objet de l'acte" }),
        newField({ id: "dateFin", label: "Fin prévisionnelle (régie temporaire)", type: "date", required: false, group: "Objet de l'acte" }),
        newField({ id: "moyensPaiement", label: "Moyens de décaissement", type: "multichoice", group: "Moyens", options: ["numeraire", "cheque", "virement", "carte"], help: "Chaque moyen retenu ajoute les clauses et limites réglementaires correspondantes." }),
        newField({ id: "plafondCheque", label: "Plafond par chèque", type: "money", required: false, group: "Moyens", appliesWhen: "contains(moyensPaiement, 'cheque')" }),
        newField({ id: "montantAvance", label: "Montant de l'avance à consentir", type: "money", required: false, group: "Moyens", appliesWhen: "contains(moyensPaiement, 'numeraire')" }),
        newField({ id: "abroge", label: "Abroge un arrêté antérieur", type: "ref", group: "Suites", required: false }),
      ]),
    ],
    rules: [
      newRule({ author: "Régie de recettes",}),
      newRule({
        id: "r-regie-2", level: "blocking",
        expr: "!exists(dateEffet) || !exists(dateSignature) || diff_days(dateEffet, dateSignature) >= 0",
        message: "L'arrêté ne peut pas être rétroactif : la date d'effet ne peut précéder la date de signature.",
        author: "Régie de recettes",
      }),
      newRule({
        id: "r-regie-3", level: "warning",
        expr: "!contains(moyensPaiement, 'cheque') || !exists(dateDebut) || dateDebut < '2027-07-01'",
        message: "Fin de l'admission des chèques par la DGFiP à l'été 2027 : conserver la limite calendaire sans la modifier.",
        author: "Régie de recettes",
      }),
      newRule({
        id: "r-regie-4", level: "blocking",
        expr: "!exists(dateFin) || !exists(dateDebut) || diff_days(dateFin, dateDebut) <= 3650",
        message: "Durée maximale autorisée pour une régie temporaire : 10 ans (délai réglementaire, ne pas dépasser).",
        author: "Régie de recettes",
      }),
      newRule({
        id: "r-regie-5", level: "warning",
        expr: "!contains(moyensPaiement, 'numeraire') || exists(montantAvance)",
        message: "En cas d'encaissement en numéraire, préciser le montant de l'avance à consentir.",
        author: "Régie de recettes",
      }),
    ],
    body: [
      ...headerNodes(),
      newNode("article", {
        numMode: "auto", heading: "Institution de la régie",
        blocks: [
          newNode("para", { text: "La création de la régie {{typeRegie == 'avances' ? \"d'avances\" : (typeRegie == 'recettes' ? 'de recettes' : \"d'avances et de recettes\")}} de {{entity.nameWithArt}}, dénommée « {{nomRegie}} », rattachée à {{service}}, est approuvée." }),
          newNode("para", { text: "{{regisseur.civility}} {{regisseur.firstName}} {{regisseur.lastName}} est nommé(e) régisseur / régisseuse." }),
          newNode("para", { text: "La régie est mise en place à compter du {{dateDebut|date-long}}.", when: "exists(dateDebut)" }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Nature des opérations",
        blocks: [
          newNode("list", {
            ordered: false,
            items: [
              { id: "r1", text: "Les dépenses non immobilisées de matériel et de fonctionnement, hors marché public écrit, dans la limite de 2 000 € par opération ;", when: "typeRegie != 'recettes'" },
              { id: "r2", text: "Les frais de déplacement temporaire et les avances sur ces frais ;", when: "typeRegie != 'recettes'" },
              { id: "r3", text: "Les produits de toute nature pouvant être encaissés par une régie de recettes ;", when: "typeRegie != 'avances'" },
              { id: "r4", text: "Les secours urgents et exceptionnels.", when: "typeRegie != 'recettes'" },
            ],
          }),
        ],
        notes: [
          newNote({ kind: "legal", author: "Régie de recettes", text: "Garder en tête la typologie acceptable au regard de la réglementation pour lister la nature des dépenses admises (art. 10 du décret du 26/07/2019)." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Moyens de règlement",
        blocks: [
          newNode("list", {
            items: [
              { id: "m1", text: "Numéraire : encaissement dans la limite fixée par la réglementation en vigueur ;", when: "contains(moyensPaiement, 'numeraire')" },
              { id: "m2", text: "Chèques : admissions jusqu'au 30 juin 2027, plafonnés à {{plafondCheque|money}} ;", when: "contains(moyensPaiement, 'cheque')" },
              { id: "m3", text: "Virement sur le compte de dépôt de fonds au Trésor ;", when: "contains(moyensPaiement, 'virement')" },
              { id: "m4", text: "Carte bancaire, uniquement pour les recettes encaissées au guichet.", when: "contains(moyensPaiement, 'carte')" },
            ],
          }),
        ],
        notes: [
          newNote({ kind: "legal", author: "Régie de recettes", text: "Article à conserver pour limiter les moyens de paiement acceptés par la régie. Sinon, par principe, tous les moyens de l'arrêté du 24 décembre 2012 seront admis." }),
          newNote({ kind: "watch", author: "Régie de recettes", text: "Fin d'admission des chèques par la DGFiP à l'été 2027 : si les chèques restent admis, garder la date butoir." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Durée",
        when: "exists(dateFin)",
        blocks: [newNode("para", { text: "La régie est instituée jusqu'au {{dateFin|date-long}}.", when: "exists(dateFin)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Abrogation",
        blocks: [newNode("para", { text: "L'arrêté n°{{abroge}} est abrogé pour l'avenir.", when: "exists(abroge)" })],
        when: "exists(abroge)",
        notes: [
          newNote({ kind: "legal", author: "Régie de recettes", text: "L'ancien arrêté doit rester publié au recueil des actes administratifs : son abrogation n'implique pas sa dépublication." }),
        ],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      ...recoursAndPublication(),
    ],
  });
}

// --------------------------------------------------------------- subventions
// Trame **générale** (aucun service) : elle est visible par tous les services,
// donc par tout rédacteur — c'est le contre-exemple des trois trames
// précédentes, rattachées à un service et à un bureau. Un acte de subvention
// peut en effet relever de plusieurs services (cabinet, action sociale, écoles).
function subventionTrame() {
  return newTrame({
    id: "tpl-subvention",
    name: "Arrêté — attribution d'une subvention à une association",
    version: "26.10",
    familyId: "fam-associations",
    actTypeId: "arrete",
    status: "published",
    owner: "Affaires générales",
    serviceId: "",
    bureauId: "",
    description: "Attribution d'une subvention de fonctionnement ou d'investissement à une association. Trame générale : tout service peut la remplir.",
    fields: commonHeader([
      newField({ id: "association", label: "Association bénéficiaire", type: "text", group: "Objet de l'acte" }),
      newField({ id: "objetSubvention", label: "Objet de la subvention", type: "text", group: "Objet de l'acte", help: "Formule complète, article compris (ex. « des activités périscolaires ») : elle s'insère dans la phrase après « au titre de »." }),
      newField({ id: "montant", label: "Montant attribué", type: "money", group: "Objet de l'acte" }),
      newField({ id: "imputation", label: "Imputation budgétaire", type: "text", group: "Objet de l'acte", required: false, help: "Chapitre et ligne ; laisse l'article dédié hors du document si elle n'est pas connue." }),
    ]),
    rules: [
      newRule({
        id: "r-subvention-1", level: "blocking", expr: "exists(association) && exists(montant)",
        message: "L'association bénéficiaire et le montant attribué sont obligatoires.",
        author: "Affaires générales", date: "2026-06-01",
      }),
      newRule({
        id: "r-subvention-2", level: "blocking", expr: "!exists(dateEffet) || !exists(dateSignature) || diff_days(dateEffet, dateSignature) >= 0",
        message: "Pas de rétroactivité : la date d'effet ne peut pas précéder la date de signature.",
        ref: "principes généraux du droit", author: "Affaires générales", date: "2026-06-01",
      }),
      newRule({
        id: "r-subvention-3", level: "warning", expr: "!exists(montant) || montant > 0",
        message: "Le montant attribué doit être strictement positif.",
        author: "Affaires générales", date: "2026-06-01",
      }),
    ],
    body: [
      ...headerNodes(),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "Une subvention d'un montant de {{montant|money}} est attribuée à l'association {{association}} au titre de {{objetSubvention}}." })],
        notes: [
          newNote({ kind: "instruction", author: "Affaires générales", text: "Vérifier que l'association est à jour de ses obligations déclaratives et qu'une convention ou un dossier de demande est joint au dossier." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Imputation",
        when: "exists(imputation)",
        blocks: [newNode("para", { text: "La dépense est imputée sur le budget de {{entity.nameWithArt}}, à la ligne « {{imputation}} »." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Justification de l'emploi des fonds",
        blocks: [newNode("para", { text: "Le versement de la subvention est subordonné à la production, par l'association, d'un compte rendu d'emploi des fonds dans les six mois suivant la clôture de l'exercice." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [newNode("para", { text: "Le présent arrêté prend effet {{dateEffet ? \"le \" + dateEffet : \"au lendemain de sa publication au recueil des actes administratifs\"}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général des services de {{entity.nameWithArt}} est chargé de l'exécution du présent arrêté." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      ...recoursAndPublication(),
    ],
  });
}

// ----------------------------------------------------- actes individuels
// Trame **non publiable** (`publishable: false`) : elle produit des actes
// individuels — ici la revalorisation du régime indemnitaire d'un agent nommé.
// Ces actes sont rédigés, signés et conservés au registre, mais ne sont jamais
// déposés au recueil des actes administratifs : ils sont notifiés à l'intéressé,
// et c'est la notification qui fait courir le délai de recours. C'est pourquoi
// cette trame emploie les mentions « notification » et non « publication ».
// (Autres exemples d'actes individuels : sanction disciplinaire, décision
// d'avancement, attribution d'une aide nominative — avec quelques exceptions.)
function revalorisationTrame() {
  return newTrame({
    id: "tpl-revalorisation",
    name: "Arrêté — revalorisation du régime indemnitaire d'un agent",
    version: "26.11",
    familyId: "fam-individuels",
    actTypeId: "arrete",
    status: "published",
    publishable: false,
    // Formalités d'exécution (voir src/lib/execution.js) : un acte individuel
    // créateur de droits est TRANSMIS au contrôle de légalité et NOTIFIÉ à
    // l'intéressé — c'est la notification qui fait courir le délai de recours,
    // puisqu'il n'est pas publié. Les deux formalités sont donc déclarées ici.
    transmission: "requise",
    notification: "requise",
    owner: "Direction générale des services",
    serviceId: "svc-dgs",
    bureauId: "bur-dgs-rh",
    description: "Acte individuel : revalorisation du régime indemnitaire (IFSE) d'un agent nommément désigné. Non publiable — l'acte est notifié à l'intéressé et non publié au recueil.",
    fields: commonHeader([
      newField({ id: "beneficiaire", label: "Agent bénéficiaire", type: "person", group: "Objet de l'acte" }),
      newField({ id: "corps", label: "Cadre d'emplois / grade", type: "text", group: "Objet de l'acte", help: "Ex. « rédacteur principal de 1re classe »." }),
      newField({ id: "partVariable", label: "Part variable annuelle (IFSE)", type: "money", group: "Objet de l'acte" }),
      newField({ id: "motif", label: "Motif de la revalorisation", type: "text", group: "Objet de l'acte", required: false, help: "Ex. « prise en compte de l'expérience professionnelle acquise »." }),
    ]),
    rules: [
      newRule({
        id: "r-revalorisation-1", level: "blocking", expr: "exists(beneficiaire) && exists(partVariable)",
        message: "L'agent bénéficiaire et le nouveau montant de la part variable sont obligatoires.",
        author: "Direction générale des services", date: "2026-01-05",
      }),
      newRule({
        id: "r-revalorisation-2", level: "blocking", expr: "!exists(dateEffet) || !exists(dateSignature) || diff_days(dateEffet, dateSignature) >= 0",
        message: "Une revalorisation ne peut pas avoir d'effet rétroactif : la date d'effet ne peut précéder la date de signature.",
        ref: "principes généraux du droit", author: "Direction générale des services", date: "2026-01-05",
      }),
      newRule({
        id: "r-revalorisation-3", level: "warning", expr: "!exists(partVariable) || partVariable <= 4000",
        message: "Vérifier que le montant reste dans les plafonds de l'IFSE votés par l'assemblée délibérante et rappelés au bénéficiaire.",
        author: "Direction générale des services", date: "2026-01-05",
      }),
    ],
    body: [
      ...headerNodes(false),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "{{beneficiaire.civility}} {{beneficiaire.firstName}} {{beneficiaire.lastName}}, {{corps}}, bénéficie d'une revalorisation de son régime indemnitaire." })],
        notes: [
          newNote({ kind: "instruction", author: "Direction générale des services", text: "Acte individuel : il n'est pas publié au recueil. Il est notifié à l'intéressé, et une copie est conservée au dossier de l'agent." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Montant",
        blocks: [
          newNode("para", { text: "La part variable de l'indemnité de fonctions, de sujétions et d'expertise (IFSE) est portée à {{partVariable|money}} par an." }),
          newNode("para", { text: "Motif : {{motif}}.", when: "exists(motif)" }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [
          newNode("para", { text: "Le présent arrêté prend effet à compter du {{dateEffet|date-long}}.", when: "exists(dateEffet)" }),
          newNode("para", { text: "Le présent arrêté prend effet le premier jour du mois suivant sa notification à l'intéressé.", when: "!exists(dateEffet)" }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général des services de {{entity.nameWithArt}} est chargé de l'exécution du présent arrêté." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      newNode("mention", { mentionId: "men-recours-notification" }),
      newNode("mention", { mentionId: "men-notification" }),
    ],
  });
}
