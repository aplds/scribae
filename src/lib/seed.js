import { emptyConfig, newNode, newField, newRule, newNote, newTrame } from "./schema.js";
import { seedStyles } from "./styles.js";
import { EXTERNE_DEFAUT } from "./numbering.js";
import { RENVOIS_RECOMMANDES, mentionsParDefaut } from "./recueil.js";

// ============================================================================
// Jeu de données initial. RIEN ici n'est utilisé par la logique applicative :
// ces valeurs remplissent le référentiel, qui est éditable et exportable.
// Remplacez-le par le vôtre via Administration › Import, ou videz-le.
//
// Ce jeu est celui du démonstrateur : une collectivité FICTIVE, la ville de
// Valmont-sur-Loire (mairie). Aucune donnée réelle n'y figure.
// ============================================================================

// Emblème de la commune fictive (SVG embarqué sous forme de data URL). Il est
// volontairement embarqué plutôt que lu dans `src/assets/` : les bibliothèques
// de capture d'écran (guide imprimable, vignettes) ne savent pas résoudre un
// chemin relatif dans leur copie du document, alors qu'une data URL est
// auto-suffisante.
//
// Le dessin : l'écu français, en trois plans — un ciel clair, un soleil d'or à
// huit rais, et la Loire qui baigne deux monts. Le champ est découpé par le
// tracé même de l'écu (`clipPath`) : les monts et l'eau s'arrêtent net sur le
// galon, sans bavure. Deux détails de mise au point, appris en regardant le
// rendu : les rais du soleil sont courts et proches du disque (un rai long le
// fait paraître décentré, et son extrémité vient mordre le chef) ; et les cimes
// enneigées comme les bandes d'eau portent un liseré de LEUR PROPRE couleur,
// car deux aplats voisins qui partagent un bord laissent, à l'anticrénelage,
// un filet clair que le liseré recouvre.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 72" role="img" aria-label="Ville de Valmont-sur-Loire">
  <defs>
    <clipPath id="vsl-ecu"><path d="M32 2 60 11v27c0 15-11.6 26-28 32C15.6 64 4 53 4 38V11Z"/></clipPath>
    <linearGradient id="vsl-ciel" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7fbff"/><stop offset="1" stop-color="#cbdff6"/>
    </linearGradient>
    <linearGradient id="vsl-eau" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4b91d3"/><stop offset="1" stop-color="#1b5c92"/>
    </linearGradient>
  </defs>
  <path d="M32 2 60 11v27c0 15-11.6 26-28 32C15.6 64 4 53 4 38V11Z" fill="url(#vsl-ciel)"/>
  <g clip-path="url(#vsl-ecu)">
    <g stroke="#f0bd35" stroke-width="2.4" stroke-linecap="round" fill="none">
      <path d="M32 8.9L32 6.3M32 23.9L32 26.5M24.6 16.4L22 16.4M39.4 16.4L42 16.4M26.7 11.1L24.9 9.3M37.3 21.7L39.1 23.5M37.3 11.1L39.1 9.3M26.7 21.7L24.9 23.5"/>
    </g>
    <circle cx="32" cy="16.4" r="6.5" fill="#f0bd35"/>
    <path d="M5 51 21.5 23.5 38 51Z" fill="#1e7a45"/>
    <path d="M21.5 24.2 15.9 33.6 18.6 31.9 21.5 34.4 24.4 31.9 27.1 33.6Z" fill="#f4f9ff" stroke="#f4f9ff" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M28.5 51 43.5 27.5 58 51Z" fill="#16613a"/>
    <path d="M43.5 28.2 38.1 37.3 40.7 35.6 43.5 38 46.3 35.6 48.9 37.3Z" fill="#dbe7f5" stroke="#dbe7f5" stroke-width="0.8" stroke-linejoin="round"/>
    <path d="M4 48.4C11 44.9 17.5 50.4 25 47.6c7.5-2.8 12.5 3.4 20 1.6 4.2-1 8.4-1.4 11-1.8v26H4Z" fill="url(#vsl-eau)" stroke="url(#vsl-eau)" stroke-width="0.7"/>
    <path d="M4 58.2C11 54.7 17.5 60.2 25 57.4c7.5-2.8 12.5 3.4 20 1.6 4.2-1 8.4-1.4 11-1.8v20H4Z" fill="#1a4f82" stroke="#1a4f82" stroke-width="0.7"/>
  </g>
  <path d="M32 2 60 11v27c0 15-11.6 26-28 32C15.6 64 4 53 4 38V11Z" fill="none" stroke="#12335c" stroke-width="3.4" stroke-linejoin="round"/>
</svg>`;

const LOGO_DATA_URL = "data:image/svg+xml;base64," + btoa(LOGO_SVG.trim());

// La variante du thème sombre : MÊME écu, mais le galon s'éclaircit. Un trait
// bleu nuit posé sur le fond sombre de l'application disparaîtrait, et l'écu
// flotterait sans contour ; le reste du dessin — ciel, soleil, monts, eau — est
// clair et tient sur les deux fonds. On ne retouche donc que le contour, et par
// remplacement de la seule chaîne concernée : redessiner l'écu en double ferait
// diverger les deux emblèmes à la première retouche du dessin.
const LOGO_SVG_SOMBRE = LOGO_SVG.replace('stroke="#12335c" stroke-width="3.4"', 'stroke="#cfe0f5" stroke-width="3.4"');
const LOGO_DATA_URL_SOMBRE = "data:image/svg+xml;base64," + btoa(LOGO_SVG_SOMBRE.trim());

export function seedConfig() {
  const c = emptyConfig();
  c.brand = {
    name: "Ville de Valmont-sur-Loire",
    shortName: "VSL",
    color: "#000091",
    colorDark: "#1212ff",
    baseUri: "https://www.valmont-sur-loire.fr",
    logoUrl: LOGO_DATA_URL,
    logoUrlDark: LOGO_DATA_URL_SOMBRE,
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
  c.numbering = { pattern: "{year}-{seq}-{entityCode}", seq: 401, pad: 3, year: 2026, eliPattern: "{baseUri}/eli/{actTypeId}/{year}/{seq}/{entityCode}", eliEntity: true, source: "interne", externe: { ...EXTERNE_DEFAUT } };
  c.actTypes = [
    { id: "arrete", label: "Arrêté", aknElement: "act" },
    { id: "decision", label: "Décision", aknElement: "act" },
    { id: "deliberation", label: "Délibération", aknElement: "act" },
    { id: "reglement", label: "Règlement", aknElement: "act" },
    { id: "convention", label: "Convention", aknElement: "act" },
    { id: "charte", label: "Charte", aknElement: "act" },
    // Les DOCUMENTS D'ASSEMBLÉE qui se publient sans faire droit : le verbatim
    // d'une séance, une déclaration, un vœu. Ce sont les types d'acte que
    // portent les trames de nature « verbatim », « declaration » et « voeu »
    // (voir src/lib/schema.js) — le type nomme le document, la nature dit sa
    // portée.
    { id: "compte-rendu", label: "Compte rendu", aknElement: "doc" },
    { id: "declaration", label: "Déclaration", aknElement: "doc" },
    { id: "voeu", label: "Vœu", aknElement: "doc" },
  ];

  // Chaque rôle porte ses DEUX formes : `m` et `f`. C'est d'elles que vient
  // l'accord des qualités dans les actes (« Le maire » / « La maire »,
  // « Le directeur général des services » / « La directrice générale des
  // services »). Le libellé (`label`) n'est qu'un repère de liste : il ne
  // s'imprime jamais. Voir src/lib/delegations.js.
  c.roles = [
    { id: "maire", label: "Maire", m: "Maire", f: "Maire" },
    { id: "adjoint", label: "Adjoint / Adjointe au maire", m: "adjoint au maire", f: "adjointe au maire" },
    { id: "dgs", label: "Directeur général / Directrice générale des services", m: "directeur général des services", f: "directrice générale des services" },
    { id: "directeur-service", label: "Directeur / Directrice de service", m: "directeur de service", f: "directrice de service" },
    { id: "secretaire-general", label: "Secrétaire général / Secrétaire générale", m: "secrétaire général", f: "secrétaire générale" },
    { id: "responsable-administratif", label: "Responsable administratif / administrative", m: "responsable administratif", f: "responsable administrative" },
    { id: "chef-de-bureau", label: "Chef / Cheffe de bureau", m: "chef de bureau", f: "cheffe de bureau" },
    { id: "president", label: "Président / Présidente", m: "président", f: "présidente" },
    { id: "president-ca", label: "Président / Présidente du conseil d'administration", m: "président du conseil d'administration", f: "présidente du conseil d'administration" },
    { id: "directeur-general", label: "Directeur général / Directrice générale", m: "directeur général", f: "directrice générale" },
    { id: "agent", label: "Agent", m: "agent", f: "agente" },
    { id: "regisseur", label: "Régisseur / Régisseuse", m: "régisseur", f: "régisseuse" },
  ];

  c.entities = [
    {
      id: "ent-vsl", code: "VSL", kind: "commune",
      name: "Ville de Valmont-sur-Loire",
      nameWithArt: "la commune de Valmont-sur-Loire",
      // `{qualite}` est remplacé à la compilation par la qualité de l'autorité,
      // accordée en genre (« Le maire » / « La maire »). Voir src/lib/delegations.js.
      authorityFormula: "{qualite} de Valmont-sur-Loire",
      legalName: "Commune de Valmont-sur-Loire",
      seatCity: "Valmont-sur-Loire",
      tribunal: "Orléans",
      // AUTONOME : la commune est une personne morale à part entière. Son
      // SIGNATAIRE PRINCIPAL est son maire — la personne qui signe ses actes
      // quand la trame n'en désigne aucune, sous sa qualité de maire (voir
      // src/lib/compile.js et src/lib/organigramme.js).
      autonome: true,
      signerPersonId: "p-faure",
      signerRoleId: "maire",
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
      // Le CCAS a SA personnalité morale : il est autonome, même s'il figure
      // sous la commune dans l'organigramme. Ses actes sont signés par sa
      // directrice, qui tient sa compétence d'une délégation de la présidente
      // (voir `ref-ccas-deliberation` plus bas).
      autonome: true,
      signerPersonId: "p-martin",
      signerRoleId: "directeur-service",
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
      // La caisse des écoles est, elle aussi, une personne morale distincte :
      // autonome, et présidée par sa propre présidente.
      autonome: true,
      signerPersonId: "p-lefevre",
      signerRoleId: "president",
    },
    {
      // Établissement public AUTONOME : son autorité de tête n'est pas le maire,
      // mais le président de son conseil d'administration, et sa chaîne de
      // délégations (président → directeur général) est indépendante de celle de
      // la commune. `{qualite}` y prend la qualité de cette autorité de tête.
      id: "ent-oph", code: "OPH", kind: "etablissement-public",
      name: "Office public de l'habitat du Valmont",
      nameWithArt: "l'office public de l'habitat du Valmont",
      authorityFormula: "{qualite} de l'office public de l'habitat du Valmont",
      legalName: "Office public de l'habitat du Valmont",
      seatCity: "Valmont-sur-Loire",
      tribunal: "Orléans",
      autonome: true,
      signerPersonId: "p-lambert",
      signerRoleId: "president-ca",
    },
    {
      // LA RÉGIE DU CINÉMA — le cas que le rattachement existe pour décrire :
      // elle n'a PAS de personnalité morale propre (c'est une régie de la
      // commune, dotée seulement de l'autonomie financière), mais elle a son
      // directeur, son service et ses actes. `autonome: false` dit qu'elle est
      // rattachée ; `parentId` dit à quoi. Son signataire principal est son
      // directeur, et non le maire.
      id: "ent-cinema", code: "CIN", kind: "etablissement",
      name: "Régie du cinéma municipal",
      nameWithArt: "la régie du cinéma municipal",
      authorityFormula: "{qualite} de la régie du cinéma municipal",
      legalName: "Régie du cinéma municipal de Valmont-sur-Loire",
      seatCity: "Valmont-sur-Loire",
      tribunal: "Orléans",
      parentId: "ent-vsl",
      autonome: false,
      signerPersonId: "p-chevalier",
      signerRoleId: "directeur-service",
    },
  ];

  // ASSEMBLÉES DÉLIBÉRANTES. Un acte d'assemblée — une délibération — émane
  // d'un conseil : sa ligne d'autorité est celle de l'assemblée, et il est signé
  // par le président de celle-ci. La commune a son conseil municipal, présidé par
  // le maire ; l'office a son conseil d'administration, présidé par son
  // président. Le choix de la qualité qui signe est propre à chaque assemblée.
  // Voir src/lib/conseils.js.
  c.councils = [
    {
      id: "csl-vsl-cm", code: "CM", entityId: "ent-vsl",
      name: "Conseil municipal de Valmont-sur-Loire",
      authorityFormula: "Le conseil municipal de Valmont-sur-Loire",
      signerRoleId: "maire",
      actif: true,
    },
    {
      id: "csl-oph-ca", code: "CA", entityId: "ent-oph",
      name: "Conseil d'administration de l'office public de l'habitat du Valmont",
      authorityFormula: "Le conseil d'administration de l'office public de l'habitat du Valmont",
      signerRoleId: "president-ca",
      actif: true,
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
      // Le service tient la QUALITÉ DE RÉVISEUR : ses agents contrôlent les
      // actes de TOUS les services avant leur signature — c'est le cas d'un
      // service des affaires juridiques. Une compétence sans filtre
      // (`services: []`, `familyIds: []`…) vaut « tous les services, tous les
      // actes » ; `bureaux: []` vaut « tout le service ». Régler la qualité sur
      // certains bureaux seulement restreindrait les agents concernés.
      reviseur: { actif: true, bureaux: [], services: [], trameIds: [], familyIds: [], actTypes: [], entityIds: [] },
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
      id: "svc-urb", code: "URB", name: "Aménagement et urbanisme", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-urb-urbanisme", name: "Urbanisme" },
        { id: "bur-urb-voirie", name: "Voirie et espaces publics" },
      ],
    },
    // Les services de la vie quotidienne : école et restauration, fêtes et vie
    // associative, cadre de vie et environnement, police municipale, finances et
    // commande publique. Une collectivité de la taille de Valmont les réunit
    // tous ; c'est ce qui donne à la démonstration la variété de ses actes.
    {
      id: "svc-education", code: "EDU", name: "Éducation, enfance et jeunesse", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-edu-restauration", name: "Restauration scolaire" },
        { id: "bur-edu-periscolaire", name: "Accueils périscolaires" },
        { id: "bur-edu-jeunesse", name: "Jeunesse et animations" },
      ],
    },
    {
      id: "svc-culture", code: "CUL", name: "Culture, fêtes et vie associative", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-cul-fetes", name: "Fêtes et cérémonies" },
        { id: "bur-cul-associations", name: "Vie associative" },
        { id: "bur-cul-bibliotheque", name: "Bibliothèque municipale" },
      ],
    },
    {
      id: "svc-environnement", code: "ENV", name: "Cadre de vie et environnement", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-env-proprete", name: "Propreté urbaine" },
        { id: "bur-env-espaces", name: "Espaces verts" },
        { id: "bur-env-eau", name: "Eau et assainissement" },
      ],
    },
    {
      id: "svc-police", code: "PM", name: "Police municipale et prévention", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-pol-police", name: "Police municipale" },
        { id: "bur-pol-administratif", name: "Police administrative" },
      ],
    },
    {
      id: "svc-finances", code: "FIN", name: "Finances et commande publique", entityId: "ent-vsl",
      bureaux: [
        { id: "bur-fin-budget", name: "Budget et comptabilité" },
        { id: "bur-fin-marches", name: "Commande publique" },
      ],
    },
    {
      id: "svc-cde", code: "CDE", name: "Caisse des écoles — services", entityId: "ent-cde",
      bureaux: [
        { id: "bur-cde-restauration", name: "Restauration scolaire" },
        { id: "bur-cde-administration", name: "Administration et comptabilité" },
      ],
    },
    {
      id: "svc-social", code: "AS", name: "Action sociale", entityId: "ent-ccas",
      bureaux: [
        { id: "bur-as-domicile", name: "Aide à domicile" },
        { id: "bur-as-general", name: "Action sociale générale" },
      ],
    },
    {
      id: "svc-oph", code: "OPH", name: "Direction générale de l'office", entityId: "ent-oph",
      bureaux: [
        { id: "bur-oph-dg", name: "Direction générale" },
        { id: "bur-oph-patrimoine", name: "Patrimoine et travaux" },
      ],
    },
    {
      // La régie n'a pas de personnalité morale, mais elle a bel et bien ses
      // services : c'est ce que l'organigramme doit montrer. Le rattachement se
      // lit sur l'ENTITÉ (`parentId`, `autonome`), jamais sur le service.
      id: "svc-cinema", code: "CIN", name: "Exploitation du cinéma municipal", entityId: "ent-cinema",
      bureaux: [
        { id: "bur-cin-programmation", name: "Programmation et accueil du public" },
        { id: "bur-cin-technique", name: "Cabine et technique" },
      ],
    },
  ];

  c.people = [
    // Le maire tient son pouvoir du conseil municipal : cette décision fonde sa
    // signature et se vise sur ses actes, en tête de ses délégations.
    { id: "p-faure", civility: "Madame", firstName: "Claire", lastName: "FAURE", entityId: "ent-vsl", roles: ["maire"], refs: [], fondementRefId: "ref-delib-delegation" },
    { id: "p-bernard", civility: "Monsieur", firstName: "Éric", lastName: "BERNARD", entityId: "ent-vsl", roles: ["adjoint"], refs: [] },
    { id: "p-mercier", civility: "Monsieur", firstName: "Julien", lastName: "MERCIER", entityId: "ent-vsl", roles: ["dgs"], refs: [] },
    { id: "p-leclerc", civility: "Madame", firstName: "Sophie", lastName: "LECLERC", entityId: "ent-vsl", roles: ["secretaire-general"], refs: [] },
    { id: "p-roussel", civility: "Madame", firstName: "Amandine", lastName: "ROUSSEL", entityId: "ent-vsl", roles: ["responsable-administratif"], refs: [] },
    { id: "p-garnier", civility: "Monsieur", firstName: "Thomas", lastName: "GARNIER", entityId: "ent-vsl", roles: ["regisseur"], refs: [] },
    { id: "p-martin", civility: "Madame", firstName: "Hélène", lastName: "MARTIN", entityId: "ent-ccas", roles: ["directeur-service"], refs: [] },
    { id: "p-daval", civility: "Madame", firstName: "Isabelle", lastName: "DAVAL", entityId: "ent-vsl", roles: ["directeur-service"], refs: [] },
    { id: "p-leblanc", civility: "Madame", firstName: "Sarah", lastName: "LEBLANC", entityId: "ent-vsl", roles: ["agent"], refs: [] },
    { id: "p-benali", civility: "Monsieur", firstName: "Karim", lastName: "BENALI", entityId: "ent-vsl", roles: ["chef-de-bureau"], serviceId: "svc-urb", bureauId: "bur-urb-urbanisme", refs: [] },
    // L'office public de l'habitat : une autorité autonome et son directeur
    // général. Le président du conseil d'administration ne tient sa compétence
    // d'aucune délégation de la commune : il EST l'autorité de tête de l'office.
    { id: "p-lambert", civility: "Monsieur", firstName: "Pascal", lastName: "LAMBERT", entityId: "ent-oph", roles: ["president-ca"], refs: [] },
    { id: "p-marchand", civility: "Madame", firstName: "Nadia", lastName: "MARCHAND", entityId: "ent-oph", roles: ["directeur-general"], refs: [] },
    { id: "p-roy", civility: "Monsieur", firstName: "Lucas", lastName: "ROY", entityId: "ent-oph", roles: ["agent"], serviceId: "svc-oph", bureauId: "bur-oph-patrimoine", refs: [] },

    // Les adjoints au maire et les agents des services de la vie quotidienne.
    // Chaque adjoint a son domaine, et donc sa propre délégation de signature
    // (voir `c.delegations`) : un acte pris dans sa matière porte sa qualité, et
    // le maire reste l'autorité dont la chaîne descend.
    { id: "p-morel", civility: "Monsieur", firstName: "Antoine", lastName: "MOREL", entityId: "ent-vsl", roles: ["adjoint"], refs: [] },
    { id: "p-masson", civility: "Madame", firstName: "Chantal", lastName: "MASSON", entityId: "ent-vsl", roles: ["adjoint"], refs: [] },
    { id: "p-rolland", civility: "Madame", firstName: "Isabelle", lastName: "ROLLAND", entityId: "ent-vsl", roles: ["adjoint"], refs: [] },
    { id: "p-vidal", civility: "Monsieur", firstName: "Hugo", lastName: "VIDAL", entityId: "ent-vsl", roles: ["adjoint"], refs: [] },
    { id: "p-petit", civility: "Madame", firstName: "Nathalie", lastName: "PETIT", entityId: "ent-vsl", roles: ["directeur-service"], serviceId: "svc-education", bureauId: "bur-edu-restauration", refs: [] },
    { id: "p-girard", civility: "Monsieur", firstName: "Serge", lastName: "GIRARD", entityId: "ent-vsl", roles: ["chef-de-bureau"], serviceId: "svc-education", bureauId: "bur-edu-restauration", refs: [] },
    { id: "p-fontaine", civility: "Madame", firstName: "Chloé", lastName: "FONTAINE", entityId: "ent-vsl", roles: ["agent"], serviceId: "svc-education", bureauId: "bur-edu-restauration", refs: [] },
    { id: "p-pages", civility: "Madame", firstName: "Léa", lastName: "PAGES", entityId: "ent-vsl", roles: ["agent"], serviceId: "svc-education", bureauId: "bur-edu-periscolaire", refs: [] },
    { id: "p-baron", civility: "Madame", firstName: "Laure", lastName: "BARON", entityId: "ent-vsl", roles: ["directeur-service"], serviceId: "svc-culture", bureauId: "bur-cul-fetes", refs: [] },
    { id: "p-arnaud", civility: "Monsieur", firstName: "Damien", lastName: "ARNAUD", entityId: "ent-vsl", roles: ["chef-de-bureau"], serviceId: "svc-culture", bureauId: "bur-cul-fetes", refs: [] },
    { id: "p-fournier", civility: "Monsieur", firstName: "Louis", lastName: "FOURNIER", entityId: "ent-vsl", roles: ["directeur-service"], serviceId: "svc-environnement", bureauId: "bur-env-espaces", refs: [] },
    { id: "p-guerin", civility: "Monsieur", firstName: "Marc", lastName: "GUÉRIN", entityId: "ent-vsl", roles: ["chef-de-bureau"], serviceId: "svc-police", bureauId: "bur-pol-police", refs: [] },
    { id: "p-leroy", civility: "Madame", firstName: "Anne", lastName: "LEROY", entityId: "ent-vsl", roles: ["directeur-service"], serviceId: "svc-finances", bureauId: "bur-fin-budget", refs: [] },
    { id: "p-delacroix", civility: "Monsieur", firstName: "Pierre", lastName: "DELACROIX", entityId: "ent-vsl", roles: ["chef-de-bureau"], serviceId: "svc-finances", bureauId: "bur-fin-marches", refs: [] },
    { id: "p-lefevre", civility: "Madame", firstName: "Christine", lastName: "LEFÈVRE", entityId: "ent-cde", roles: ["president"], refs: [] },
    // Le directeur de la régie du cinéma : la régie n'a pas de personnalité
    // morale, mais elle a un directeur — c'est lui qui signe ses actes.
    { id: "p-chevalier", civility: "Monsieur", firstName: "Olivier", lastName: "CHEVALIER", entityId: "ent-cinema", roles: ["directeur-service"], serviceId: "svc-cinema", refs: [] },
    // Des administrés : pétitionnaires d'urbanisme, preneurs d'une concession
    // funéraire, organisateurs d'une manifestation. Ils ne signent rien — ils
    // sont la partie nommée dans l'acte.
    { id: "p-chauvet", civility: "Monsieur", firstName: "Rémi", lastName: "CHAUVET", entityId: "ent-vsl", roles: [], refs: [] },
    { id: "p-bertin", civility: "Madame", firstName: "Sylvie", lastName: "BERTIN", entityId: "ent-vsl", roles: [], refs: [] },
    { id: "p-aubert", civility: "Monsieur", firstName: "Denis", lastName: "AUBERT", entityId: "ent-vsl", roles: [], refs: [] },
    { id: "p-michel", civility: "Monsieur", firstName: "Franck", lastName: "MICHEL", entityId: "ent-vsl", roles: [], refs: [] },
  ];

  // Délégations de signature : maire → adjoint à l'urbanisme → chef du bureau
  // Urbanisme. La démonstration montre ainsi une chaîne à trois étages, la
  // sous-délégation n'étant admise qu'en cas d'absence de l'adjoint. Voir
  // l'écran « Délégations » et src/lib/delegations.js.
  //
  // Chaque délégation s'établit par DEUX décisions : celle qui NOMME le
  // délégataire à sa fonction, et celle qui lui donne la DÉLÉGATION. L'acte
  // signé au bout de la chaîne les vise, et publie leur LIEN (web et PDF). Les
  // décisions de délégation sont des références du référentiel, dont l'adresse
  // de source est renseignée ; les nominations sont désignées par leur intitulé
  // et une adresse. Les adresses de la démonstration sont fictives, comme le
  // reste du jeu : elles pointent le site de la collectivité imaginaire.
  c.delegations = [
    {
      id: "del-urbanisme-adjoint",
      fromId: "p-faure", toId: "p-bernard",
      qualiteM: "adjoint au maire en charge de l'urbanisme",
      qualiteF: "adjointe au maire en charge de l'urbanisme",
      matieres: "autorisations d'urbanisme, permis de construire, enseignes et publicité",
      familyId: "fam-urbanisme", actTypeId: "arrete",
      acteRefId: "ref-deleg-VSL",
      acte: "arrêté du maire du 10 avril 2026 portant délégation de signature aux adjoints",
      nomination: "l'arrêté du maire du 2 avril 2026 portant nomination d'Éric BERNARD en qualité d'adjoint au maire en charge de l'urbanisme",
      nominationUrl: "https://www.valmont-sur-loire.fr/actes/2026-arr-0402-nomination-adjoint-urbanisme.pdf",
      du: "2026-04-10", au: "2027-04-10",
      active: true,
    },
    {
      id: "del-urbanisme-bureau",
      fromId: "p-bernard", toId: "p-benali",
      qualiteM: "chef de bureau Urbanisme",
      qualiteF: "cheffe de bureau Urbanisme",
      matieres: "instruction des autorisations d'urbanisme, en cas d'absence de l'adjoint",
      familyId: "fam-urbanisme", actTypeId: "arrete",
      acteRefId: "ref-deleg-bureau",
      acte: "arrêté de l'adjoint au maire du 15 avril 2026 portant subdélégation de signature",
      nomination: "l'arrêté du maire du 3 novembre 2025 portant nomination de Karim BENALI en qualité de chef du bureau Urbanisme",
      nominationUrl: "https://www.valmont-sur-loire.fr/actes/2025-arr-1103-nomination-chef-bureau-urbanisme.pdf",
      du: "2026-04-15", au: "2027-04-15",
      active: true,
    },
    {
      // Chaîne INDÉPENDANTE de la commune : le président du conseil
      // d'administration de l'office délègue au directeur général, dans le cadre
      // de l'office (l'entité du délégant). Aucun rapport avec la chaîne
      // maire → adjoint → chef de bureau : c'est ce que rend possible le
      // rattachement de chaque délégation à son organisation.
      id: "del-oph-direction",
      fromId: "p-lambert", toId: "p-marchand",
      qualiteM: "directeur général de l'office",
      qualiteF: "directrice générale de l'office",
      matieres: "toutes les matières relevant de l'office public de l'habitat",
      familyId: "", actTypeId: "",
      acteRefId: "ref-oph-deliberation",
      acte: "délibération du conseil d'administration de l'office du 5 mai 2026 portant délégation de signature au directeur général",
      nomination: "l'arrêté du président du conseil d'administration de l'office du 5 mai 2026 portant nomination de Nadia MARCHAND en qualité de directrice générale",
      nominationUrl: "https://www.oph-valmont.fr/actes/2026-arr-0505-nomination-directrice-generale.pdf",
      du: "2026-05-05", au: "2027-05-05",
      active: true,
    },
    {
      // Délégation donnée par le maire DANS LE NOM DU CCAS, qu'il préside de
      // droit : c'est le cas où l'organisation ne se déduit pas du délégant, et
      // pourquoi la délégation porte son propre rattachement. Elle ne s'applique
      // qu'aux actes du CCAS, jamais à ceux de la commune.
      id: "del-ccas-direction",
      fromId: "p-faure", toId: "p-martin",
      entityId: "ent-ccas",
      qualiteM: "directeur du CCAS de Valmont-sur-Loire",
      qualiteF: "directrice du CCAS de Valmont-sur-Loire",
      matieres: "les actes courants du centre communal d'action sociale",
      familyId: "", actTypeId: "",
      acteRefId: "ref-ccas-deliberation",
      acte: "délibération du conseil d'administration du CCAS du 15 janvier 2026 portant délégation de signature à la directrice",
      nomination: "l'arrêté du maire du 5 janvier 2026 portant nomination de Hélène MARTIN en qualité de directrice du CCAS",
      nominationUrl: "https://www.valmont-sur-loire.fr/ccas/actes/2026-arr-0105-nomination-directrice.pdf",
      du: "2026-01-15", au: "2027-01-15",
      active: true,
    },

    // Quatre chaînes parallèles, une par domaine : le maire délègue à ses
    // adjoints, et chacun signe les actes de SA matière. La décision de
    // délégation est la même pour tous (l'arrêté du 10 avril 2026 portant
    // délégation de signature aux adjoints) ; seule la nomination change, une
    // par adjoint. C'est ce qui fait qu'un arrêté scolaire porte la qualité de
    // l'adjoint aux affaires scolaires, et une fête celle de l'adjoint à la vie
    // associative — sans que le rédacteur ait rien à choisir.
    {
      // La délégation la plus générale : celle du maire à son directeur général
      // des services, pour les actes de gestion courante. Elle ne nomme ni
      // famille ni type d'acte — c'est ce qui la fait choisir en DERNIER recours,
      // quand aucune délégation de domaine ne s'applique (voir `scoreDelegation`,
      // src/lib/delegations.js).
      id: "del-dgs-gestion",
      fromId: "p-faure", toId: "p-mercier",
      qualiteM: "directeur général des services",
      qualiteF: "directrice générale des services",
      matieres: "actes de gestion courante et de fonctionnement des services",
      familyId: "", actTypeId: "",
      acteRefId: "ref-deleg-dgs",
      acte: "arrêté du maire du 12 avril 2026 portant délégation de signature au directeur général des services",
      nomination: "l'arrêté du maire du 2 janvier 2026 portant nomination de Julien MERCIER en qualité de directeur général des services",
      nominationUrl: "https://www.valmont-sur-loire.fr/actes/2026-arr-0102-nomination-directeur-general.pdf",
      du: "2026-04-12", au: "2027-04-12",
      active: true,
    },
    {
      id: "del-ecoles-adjoint",
      fromId: "p-faure", toId: "p-morel",
      qualiteM: "adjoint au maire en charge des affaires scolaires",
      qualiteF: "adjointe au maire en charge des affaires scolaires",
      matieres: "affaires scolaires, restauration scolaire et accueils périscolaires",
      familyId: "fam-scolarite", actTypeId: "",
      acteRefId: "ref-deleg-VSL",
      acte: "arrêté du maire du 10 avril 2026 portant délégation de signature aux adjoints",
      nomination: "l'arrêté du maire du 2 avril 2026 portant nomination d'Antoine MOREL en qualité d'adjoint au maire en charge des affaires scolaires",
      nominationUrl: "https://www.valmont-sur-loire.fr/actes/2026-arr-0402-nomination-adjoint-ecoles.pdf",
      du: "2026-04-10", au: "2027-04-10",
      active: true,
    },
    {
      id: "del-vie-locale-adjoint",
      fromId: "p-faure", toId: "p-masson",
      qualiteM: "adjoint au maire en charge de la vie associative et des festivités",
      qualiteF: "adjointe au maire en charge de la vie associative et des festivités",
      matieres: "fêtes, cérémonies, vie associative et manifestations",
      familyId: "fam-vie-locale", actTypeId: "",
      acteRefId: "ref-deleg-VSL",
      acte: "arrêté du maire du 10 avril 2026 portant délégation de signature aux adjoints",
      nomination: "l'arrêté du maire du 2 avril 2026 portant nomination de Chantal MASSON en qualité d'adjointe au maire en charge de la vie associative et des festivités",
      nominationUrl: "https://www.valmont-sur-loire.fr/actes/2026-arr-0402-nomination-adjointe-vie-associative.pdf",
      du: "2026-04-10", au: "2027-04-10",
      active: true,
    },
    {
      id: "del-environnement-adjoint",
      fromId: "p-faure", toId: "p-rolland",
      qualiteM: "adjoint au maire en charge de l'environnement et du cadre de vie",
      qualiteF: "adjointe au maire en charge de l'environnement et du cadre de vie",
      matieres: "propreté, espaces verts, eau, assainissement et nuisances",
      familyId: "fam-environnement", actTypeId: "",
      acteRefId: "ref-deleg-VSL",
      acte: "arrêté du maire du 10 avril 2026 portant délégation de signature aux adjoints",
      nomination: "l'arrêté du maire du 2 avril 2026 portant nomination d'Isabelle ROLLAND en qualité d'adjointe au maire en charge de l'environnement et du cadre de vie",
      nominationUrl: "https://www.valmont-sur-loire.fr/actes/2026-arr-0402-nomination-adjointe-environnement.pdf",
      du: "2026-04-10", au: "2027-04-10",
      active: true,
    },
    {
      id: "del-finances-adjoint",
      fromId: "p-faure", toId: "p-vidal",
      qualiteM: "adjoint au maire en charge des finances",
      qualiteF: "adjointe au maire en charge des finances",
      matieres: "budget, commande publique et engagements de dépense",
      familyId: "fam-finances", actTypeId: "",
      acteRefId: "ref-deleg-VSL",
      acte: "arrêté du maire du 10 avril 2026 portant délégation de signature aux adjoints",
      nomination: "l'arrêté du maire du 2 avril 2026 portant nomination d'Hugo VIDAL en qualité d'adjoint au maire en charge des finances",
      nominationUrl: "https://www.valmont-sur-loire.fr/actes/2026-arr-0402-nomination-adjoint-finances.pdf",
      du: "2026-04-10", au: "2027-04-10",
      active: true,
    },
  ];

  c.refs = [
    { id: "ref-cgct", kind: "code", label: "le code général des collectivités territoriales, notamment ses articles L. 2122-18 à L. 2122-20", scope: "all", active: true, source: "" },
    { id: "ref-cgfp", kind: "code", label: "le code général de la fonction publique", scope: "all", active: true },
    { id: "ref-crpa", kind: "code", label: "le code des relations entre le public et l'administration", scope: "all", active: true },
    { id: "ref-decret-regies", kind: "decret", label: "le décret n°2019-798 du 26 juillet 2019 relatif aux régies de recettes et d'avances des organismes publics", scope: "all", active: true },
    { id: "ref-decret-gbcp", kind: "decret", label: "le décret n°2012-1246 du 7 novembre 2012 relatif à la gestion budgétaire et comptable publique", scope: "all", active: true },
    { id: "ref-instruction-regies", kind: "instruction", label: "l'instruction codificatrice n°BOFIP-GCP-24-0010 du 3 avril 2024 relative aux régies de recettes et d'avances publiques", scope: "all", active: true },
    { id: "ref-delib-delegation", kind: "deliberation", label: "la délibération du conseil municipal n°2026-014 du 3 avril 2026 donnant délégation au maire", scope: "all", active: true, source: "https://www.valmont-sur-loire.fr/deliberations/2026-014.pdf" },
    { id: "ref-delib-budget", kind: "deliberation", label: "la délibération du conseil municipal n°2026-021 du 9 avril 2026 portant vote du budget primitif 2026", scope: "all", active: true },
    { id: "ref-ri-conseil", kind: "reglement", label: "le règlement intérieur du conseil municipal", scope: "all", active: true },
    // Les codes qui fondent les actes de la vie quotidienne : police de la
    // circulation, sécurité des manifestations, urbanisme, école, hygiène
    // alimentaire, environnement. Une trame vise ceux de sa matière.
    { id: "ref-code-route", kind: "code", label: "le code de la route, notamment ses articles R. 411-1 et suivants", scope: "all", active: true },
    { id: "ref-csi", kind: "code", label: "le code de la sécurité intérieure, notamment son article L. 211-1", scope: "all", active: true },
    { id: "ref-code-urbanisme", kind: "code", label: "le code de l'urbanisme", scope: "all", active: true },
    { id: "ref-code-education", kind: "code", label: "le code de l'éducation", scope: "all", active: true },
    { id: "ref-code-environnement", kind: "code", label: "le code de l'environnement", scope: "all", active: true },
    { id: "ref-code-sante-publique", kind: "code", label: "le code de la santé publique, notamment ses articles L. 1321-1 et suivants", scope: "all", active: true },
    { id: "ref-code-securite-civile", kind: "code", label: "le code de la sécurité civile", scope: "all", active: true },
    { id: "ref-cg3p", kind: "code", label: "le code général de la propriété des personnes publiques", scope: "all", active: true },
    // Les délibérations de l'assemblée dont les actes se réclament : le programme
    // des festivités, les tarifs de l'année, le budget. Ce sont des textes du
    // référentiel, avec leur adresse de source — comme les décisions de
    // délégation.
    { id: "ref-delib-festivites", kind: "deliberation", label: "la délibération du conseil municipal n° 2026-031 du 9 avril 2026 portant approbation du programme des festivités 2026", scope: "all", active: true, source: "https://www.valmont-sur-loire.fr/deliberations/2026-031.pdf" },
    { id: "ref-delib-tarifs", kind: "deliberation", label: "la délibération du conseil municipal n° 2026-038 du 18 juin 2026 portant fixation des tarifs municipaux", scope: "all", active: true, source: "https://www.valmont-sur-loire.fr/deliberations/2026-038.pdf" },
    { id: "ref-delib-cantine", kind: "deliberation", label: "la délibération du conseil municipal n° 2024-022 du 12 juillet 2024 portant adoption du précédent règlement de la restauration scolaire", scope: "all", active: true, source: "https://www.valmont-sur-loire.fr/deliberations/2024-022.pdf" },
    // Les marchés de la commune, visés par les actes qui les font vivre
    // (avenants, décisions d'attribution).
    { id: "ref-deleg-dgs", kind: "arrete-delegation", entityId: "ent-vsl", scope: "entity", active: true, label: "l'arrêté du maire du 12 avril 2026 portant délégation de signature au directeur général des services", source: "https://www.valmont-sur-loire.fr/actes/2026-arr-0412-delegation-directeur-general.pdf" },
    { id: "ref-marche-voirie", kind: "marche", label: "le marché public n° 2026-022 du 4 mai 2026 portant réfection de la voirie communale", scope: "all", active: true, source: "https://www.valmont-sur-loire.fr/marches/2026-022.pdf" },
    { id: "ref-marche-energie", kind: "marche", label: "le marché public n° 2025-041 du 3 novembre 2025 portant fourniture d'électricité et de gaz", scope: "all", active: true, source: "https://www.valmont-sur-loire.fr/marches/2025-041.pdf" },
  ];

  // Références propres à l'office public de l'habitat : une entité autonome a
  // SES textes, que la trame de l'office cite comme « visa de l'entité
  // signataire » (voir compile.js, `findScopedRef`). Les instances de la commune
  // continuent d'utiliser les références générales.
  c.refs.push(
    { id: "ref-ccp", kind: "code", label: "le code de la commande publique, notamment ses articles L. 2122-1 et suivants", scope: "all", active: true },
    { id: "ref-oph-reglement", kind: "reglement", entityId: "ent-oph", scope: "entity", active: true, label: "l'arrêté du président du conseil d'administration de l'office du 12 janvier 2026 portant règlement intérieur" },
    { id: "ref-oph-deliberation", kind: "deliberation", entityId: "ent-oph", scope: "entity", active: true, label: "la délibération du conseil d'administration de l'office du 5 mai 2026 portant délégation de signature au directeur général", source: "https://www.oph-valmont.fr/actes/2026-del-0505-delegation-signature.pdf" },
    // Les décisions de délégation, désignées comme telles : ce sont elles que
    // les actes signés au bout d'une chaîne visent automatiquement. Leur
    // « URL de la source » est le lien que portera le visa sur l'acte publié.
    { id: "ref-deleg-bureau", kind: "arrete-delegation", entityId: "ent-vsl", scope: "entity", active: true, label: "l'arrêté de l'adjoint au maire du 15 avril 2026 portant subdélégation de signature au chef du bureau Urbanisme", source: "https://www.valmont-sur-loire.fr/actes/2026-arr-0415-subdelegation-urbanisme.pdf" },
    { id: "ref-ccas-deliberation", kind: "deliberation", entityId: "ent-ccas", scope: "entity", active: true, label: "la délibération du conseil d'administration du CCAS du 15 janvier 2026 portant délégation de signature à la directrice", source: "https://www.valmont-sur-loire.fr/ccas/actes/2026-del-0115-delegation-signature.pdf" },
  );

  const delegations = [
    { code: "VSL", id: "ent-vsl", label: "l'arrêté du maire du 10 avril 2026 portant délégation de signature aux adjoints", source: "https://www.valmont-sur-loire.fr/actes/2026-arr-0410-delegation-adjoints.pdf" },
    { code: "CCAS", id: "ent-ccas", label: "l'arrêté du 15 avril 2026 portant délégation de signature à la directrice du CCAS", source: "https://www.valmont-sur-loire.fr/ccas/actes/2026-arr-0415-delegation-signature.pdf" },
    { code: "CDE", id: "ent-cde", label: "l'arrêté du 15 avril 2026 portant délégation de signature à la directrice de la Caisse des écoles", source: "https://www.valmont-sur-loire.fr/ecoles/actes/2026-arr-0415-delegation-signature.pdf" },
  ];
  for (const d of delegations) {
    c.refs.push({ id: "ref-deleg-" + d.code, kind: "arrete-delegation", entityId: d.id, label: d.label, scope: "entity", active: true, source: d.source });
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
    // Un arrêté de police ne s'affiche pas comme un acte de gestion : il se
    // PUBLICITÉ sur le terrain même où il s'applique, par la signalisation et
    // par l'affichage. C'est cette mention-là que portent les actes de police.
    {
      id: "men-affichage",
      kind: "publication",
      label: "Publication, affichage et signalisation",
      text: "Le présent arrêté est publié au recueil des actes administratifs de {{entity.nameWithArt}} et affiché en mairie. Sa mise en œuvre sur la voie publique est assurée par la signalisation réglementaire mise en place par les services de la commune.",
    },
    // La manifestation : l'arrêté est notifié à l'organisateur, qui en tire ses
    // obligations, et publié pour les tiers.
    {
      id: "men-organisateur",
      kind: "notification",
      label: "Notification à l'organisateur",
      text: "Le présent arrêté est notifié à l'organisateur de la manifestation, qui est chargé d'en faire connaître les prescriptions aux personnes participant à l'événement.",
    },
  ];

  // Les familles de trames : ce sont elles que le recueil public présente comme
  // les THÈMES des actes (voir src/lib/recueil.js). Le libellé et la présentation
  // sont édités dans Administration › Familles ; une famille sans présentation
  // s'affiche seule, avec son seul libellé.
  c.families = [
    { id: "fam-nominations", label: "Nominations et affectations", description: "Nominations, mutations et fins de fonctions des agents de la collectivité." },
    { id: "fam-delegations", label: "Délégations de signature", description: "Délégations consenties par l'autorité territoriale, et leurs retraits." },
    { id: "fam-organisation", label: "Organisation des services", description: "Organisation, fonctionnement et création des services et des régies." },
    { id: "fam-police", label: "Police administrative", description: "Décisions du maire au titre de ses pouvoirs de police." },
    { id: "fam-etat-civil", label: "État civil", description: "Actes et décisions de l'état civil." },
    { id: "fam-urbanisme", label: "Urbanisme et voirie", description: "Autorisations d'urbanisme, accès, voirie et occupation du domaine public." },
    { id: "fam-finances", label: "Finances et budget", description: "Budget, tarifs, retraitements comptables et décisions budgétaires." },
    { id: "fam-marches", label: "Marchés publics", description: "Marchés, accords-cadres, avenants et actes d'engagement de la collectivité." },
    { id: "fam-rh", label: "Ressources humaines", description: "Décisions individuelles et collectives relatives au personnel." },
    { id: "fam-associations", label: "Associations et subventions", description: "Conventions, subventions et soutien aux associations et structures locales." },
    { id: "fam-regies", label: "Régies", description: "Création, organisation et tarifs des régies de la collectivité." },
    { id: "fam-scolarite", label: "Écoles, enfance et jeunesse", description: "Restauration scolaire, accueils périscolaires, jeunesse et éducation." },
    { id: "fam-vie-locale", label: "Vie locale et événements", description: "Fêtes, cérémonies, marchés, jumelages et animations de la commune." },
    { id: "fam-environnement", label: "Environnement et cadre de vie", description: "Propreté, espaces verts, eau, nuisances et qualité de la vie quotidienne." },
    { id: "fam-domaine-public", label: "Domaine public", description: "Occupations du domaine public, terrasses, emprises et mobilier communal." },
    { id: "fam-individuels", label: "Actes individuels (non publiables)", description: "Décisions individuelles qui ne sont pas publiées au recueil (elles se notifient)." },
    { id: "fam-seances", label: "Séances et documents d'assemblée", description: "Verbatims de séance, déclarations et vœux : des documents publiés au recueil, mais qui ne font pas droit." },
  ];
  // Les feuilles de style de la démonstration (voir src/lib/styles.js) : une
  // feuille générale, une charte propre au CCAS, une charte pour les actes
  // individuels. Elles se règlent dans l'écran « Feuilles de style ».
  c.styles = seedStyles();

  // Délais et formalités : ce qui rend un acte exécutoire et le délai de
  // recours qui en découle (voir src/lib/execution.js). Réglables dans
  // Administration › Exécution & délais.
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
  //
  // Chaque étape a une NATURE — vérification, visa ou signature — et un rôle.
  // Le circuit général s'ouvre par la vérification du RÉVISEUR (le contrôle du
  // dossier avant tout engagement), puis vient le visa de la direction. Le
  // circuit de l'office va jusqu'à la signature, portée par le signataire.
  c.circuits = [
    {
      id: "cir-general",
      label: "Circuit général de la commune",
      description: "Vérification du réviseur, puis visa de la direction générale.",
      active: true,
      entityIds: ["ent-vsl"], familyIds: [], trameIds: [],
      steps: [
        {
          id: "etp-verif-reviseur", label: "Vérification du dossier",
          role: "reviseur", kind: "verification", serviceScoped: false, optional: false,
          help: "Le réviseur — le service des affaires juridiques, ici — contrôle que le dossier est complet, l'acte conforme et les visas réunis, avant tout engagement.",
        },
        {
          id: "etp-direction", label: "Visa de la direction générale",
          role: "administrateur", kind: "visa", serviceScoped: false, optional: false,
          help: "Contrôle de légalité interne et engagement de la collectivité.",
        },
      ],
    },
    {
      id: "cir-ccas",
      label: "Circuit du CCAS",
      description: "Visa du responsable de service, puis vérification facultative du secrétariat général.",
      active: true,
      entityIds: ["ent-ccas"], familyIds: [], trameIds: [],
      steps: [
        {
          id: "etp-ccas-chef", label: "Visa du responsable de service",
          role: "editeur", kind: "visa", serviceScoped: true, optional: false,
          help: "L'action sociale relève du CCAS : le responsable du service concerné engage son budget.",
        },
        {
          id: "etp-ccas-avis", label: "Vérification du secrétariat général",
          role: "administrateur", kind: "verification", serviceScoped: false, optional: true,
          help: "Vérification facultative : elle n'empêche pas la signature, mais elle est conservée au dossier.",
        },
      ],
    },
    {
      id: "cir-individuels",
      label: "Circuit allégé — actes individuels",
      description: "Une seule vérification : les actes individuels ne passent pas par la direction.",
      active: true,
      entityIds: [], familyIds: ["fam-individuels"], trameIds: [],
      steps: [
        {
          id: "etp-individuel", label: "Vérification du responsable des ressources humaines",
          role: "editeur", kind: "verification", serviceScoped: true, optional: false,
          help: "Vérification de l'habilitation, du grade et du montant avant signature.",
        },
      ],
    },
    {
      // L'office a SON circuit, calé sur son entité : ses décisions ne passent
      // pas par la direction générale de la commune, mais par la sienne — et le
      // signataire de l'office y marque son accord avant la signature.
      id: "cir-oph",
      label: "Circuit de l'office public de l'habitat",
      description: "Visa du responsable de service, puis signature par le signataire de l'office.",
      active: true,
      entityIds: ["ent-oph"], familyIds: [], trameIds: [],
      steps: [
        {
          id: "etp-oph-service", label: "Visa du responsable de service",
          role: "editeur", kind: "visa", serviceScoped: true, optional: false,
          help: "Le responsable du service qui a préparé le marché vérifie le dossier avant transmission.",
        },
        {
          id: "etp-oph-direction", label: "Signature de l'acte",
          role: "signataire", kind: "signature", serviceScoped: false, optional: false,
          help: "Le signataire de l'office marque son accord pour signer : le circuit est alors achevé, et l'acte passe à la signature.",
        },
      ],
    },
  ];

  // Recueils extérieurs et renvois du recueil public (voir src/lib/recueil.js,
  // `recueilsExternes`). La démonstration montre les trois natures : un recueil
  // « bis » — tenu à part, par exemple pour une entité autonome —, DEUX recueils
  // inactifs qui se succèdent (un changement de logiciel en 2024), chacun avec
  // la période qu'il couvre, et les deux sites de référence livrés avec
  // l'application (Légifrance et service-public.gouv.fr). Ils s'affichent en bas de
  // page de l'espace public et à la fin des résultats de recherche.
  c.publication.recueilsExternes = [
    {
      id: "rex-bis-ccas", type: "bis",
      label: "Recueil des actes du CCAS de Valmont-sur-Loire (recueil « bis »)",
      url: "https://www.valmont-sur-loire.fr/ccas/recueil-des-actes",
      note: "Les actes du centre communal d'action sociale sont tenus dans un recueil à part.",
      du: "", au: "",
    },
    {
      id: "rex-inactif-2009", type: "inactif",
      label: "Recueil des actes — ancien système (2009-2018)",
      url: "https://archives.valmont-sur-loire.fr/actes-2009-2018",
      note: "Consultable aux archives municipales.",
      du: "2009-01-01", au: "2018-12-31",
    },
    {
      id: "rex-inactif-2019", type: "inactif",
      label: "Recueil des actes — système précédent (2019-2023)",
      url: "https://www.valmont-sur-loire.fr/recueil-2019-2023",
      note: "N'a plus été alimenté après le changement de logiciel de 2024.",
      du: "2019-01-01", au: "2023-12-31",
    },
    ...RENVOIS_RECOMMANDES.map((r) => ({ ...r })),
  ];

  // Mentions du pied de page du recueil public (voir src/lib/recueil.js,
  // `mentionsPubliques`). La démonstration les montre DANS LES DEUX FORMES que
  // l'écran de réglage propose : les mentions légales s'affichent comme un texte
  // — celui d'une commune qui rappelle ses obligations, avec ses propres
  // références (l'éditeur, le directeur de la publication, le tribunal
  // administratif de rattachement) —, tandis que l'accessibilité renvoie à la
  // déclaration publiée sur le site principal de la ville : c'est le geste le
  // plus courant, et il montre à quoi ressemble un renvoi.
  c.publication.mentions = mentionsParDefaut();
  c.publication.mentions.legales.texte = [
    "Le présent recueil des actes administratifs est édité par la Ville de Valmont-sur-Loire (Hôtel de ville, place de la République, 45210 Valmont-sur-Loire). Son directeur de la publication est le maire, autorité territoriale de la commune.",
    "Publication et opposabilité. Les actes pris par les autorités de la commune sont exécutoires de plein droit dès qu'il a été procédé à leur publication ou à leur affichage, ainsi qu'à leur transmission au représentant de l'État dans le département (article L. 2131-1 du code général des collectivités territoriales). Une fois ces formalités accomplies, ils sont opposables aux tiers. La date à laquelle chaque acte devient exécutoire figure sur la page qui le diffuse, sous la rubrique « Opposabilité ».",
    "Recours. Les délais et voies de recours applicables sont rappelés sur la page de chaque acte. À défaut de mention contraire, un recours gracieux peut être adressé à Monsieur le Maire de Valmont-sur-Loire, et un recours contentieux au tribunal administratif d'Orléans, dans un délai de deux mois à compter de la publication (article R. 421-1 du code de justice administrative). Le recours gracieux formé dans ce délai l'interrompt : un nouveau délai de deux mois court à compter de la réponse de la commune.",
    "Conservation des originaux. Les actes signés sont conservés par la Ville et peuvent être consultés sur demande adressée au service des affaires générales (Hôtel de ville, place de la République, 45210 Valmont-sur-Loire). La version diffusée dans ce recueil ne se substitue pas au document signé, qui seul peut être opposé ou invoqué.",
  ].join("\n\n");
  c.publication.mentions.accessibilite.mode = "lien";
  c.publication.mentions.accessibilite.lien = "https://www.valmont-sur-loire.fr/accessibilite";
  c.publication.mentions.accessibilite.lienLabel = "Accessibilité — la déclaration d'accessibilité du site de la Ville";
  return c;
}

const visa = (refId = "", when = "", extra = {}) => ({
  id: "it-" + Math.random().toString(36).slice(2, 7), refId, text: "", when, ...extra,
});
// Visa résolu automatiquement dans le référentiel pour l'entité signataire :
const visaSelf = (refKind, when = "") => ({ id: "it-" + Math.random().toString(36).slice(2, 7), refId: "", refKind, refScope: "self", text: "", when });
// Les décisions fondant la signature (voir src/lib/delegations.js) : par
// étage de la chaîne, la nomination puis la délégation. L'emplacement est
// fixé par la trame, les décisions viennent du référentiel.
const visaChaine = () => ({ id: "it-" + Math.random().toString(36).slice(2, 7), refId: "", text: "", when: "", chaine: true });

// Le référentiel d'une installation HORS démonstration : une page vierge.
//
// Ce n'est pas « le jeu livré, vidé » : c'est le squelette que l'application
// sait faire fonctionner (vocabulaire, numérotation, délais, mentions du recueil
// génériques…), avec une IDENTITÉ NEUTRE — ni nom de collectivité, ni blason —
// et aucune donnée de fiction : ni entités, ni assemblées, ni services, ni
// personnes, ni rôles, ni références, ni familles, ni trames, ni actes.
// L'emblème neutre est celui de l'application (aucun `logoUrl`), et le premier
// écran invite à construire le référentiel (voir src/ui/notice.js).
//
// Voir src/lib/demo.js : c'est `demoActif()` qui décide lequel des deux
// référentiels `bootstrap()` installe.
export function seedConfigVierge() {
  const c = emptyConfig();
  c.brand = {
    ...c.brand,
    demo: false,
    demoText: "",
  };
  return c;
}

export function seedTrames() {
  return [
    nominationTrame(), delegationTrame(), permisTrame(), marcheTrame(), regieTrame(), subventionTrame(), revalorisationTrame(),
    reglementTrame(), deliberationTrame(), deliberationCATrame(),
    verbatimTrame(), declarationTrame(), voeuTrame(),
    policeTrame(), environnementTrame(), evenementTrame(), periscolaireTrame(),
    cantineTrame(), grilleTarifaireTrame(), annexeTrame(),
    conventionTrame(), avenantTrame(), achatTrame(), occupationTrame(), concessionTrame(),
  ];
}

function commonHeader(extraFields = [], { fonction = "" } = {}) {
  return [
    newField({ id: "numero", label: "Numéro de l'acte", type: "text", group: "Identification", help: "Format configurable dans le référentiel (numérotation)." }),
    newField({ id: "objet", label: "Objet", type: "textarea", group: "Identification", help: "Complète l'intitulé : « portant … »." }),
    newField({ id: "dateSignature", label: "Date de signature", type: "date", group: "Identification" }),
    newField({ id: "dateEffet", label: "Date d'effet", type: "date", group: "Identification", required: false, help: "À défaut : lendemain de la publication." }),
    // Le signataire se choisit par sa FONCTION, jamais par son nom : on désigne
    // la qualité qui donne compétence (maire, adjoint au maire, chef de bureau…),
    // puis, parmi les personnes qui la tiennent, celle qui signe. Voir
    // src/lib/fonctions.js et src/ui/signer-picker.js. `fonction` fixe la
    // qualité attendue quand la trame la connaît d'avance — l'exemple de
    // l'arrêté de délégation de signature, que le maire signe toujours.
    newField({ id: "signataire", label: "Signataire", type: "signataire", group: "Signature", qualite: fonction }),
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
        // Les décisions qui fondent la signature : la délibération donnant
        // délégation au maire, puis, à chaque étage de la chaîne, la décision
        // de nomination et celle de délégation, dans l'ordre (voir
        // src/lib/delegations.js).
        visaChaine(),
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
      ], { fonction: "role:maire" }),
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

// ---------------------------------------------------------------- urbanisme
// Trame rattachée au service « Aménagement et urbanisme » et à son bureau
// « Urbanisme ». C'est elle qui donne à voir la chaîne de délégations de la
// démonstration : le maire a délégué à l'adjoint à l'urbanisme, qui a
// sous-délégé au chef du bureau Urbanisme. Un acte de cette famille signé par
// Karim BENALI porte donc les trois lignes de qualité — l'autorité, la
// délégation, la subdélégation — et seul le nom du signataire s'imprime.
// Voir src/lib/delegations.js et l'écran « Délégations ».
function permisTrame() {
  return newTrame({
    id: "tpl-permis-construire",
    name: "Arrêté — permis de construire",
    version: "26.12",
    familyId: "fam-urbanisme",
    actTypeId: "arrete",
    status: "published",
    owner: "Service de l'urbanisme",
    serviceId: "svc-urb",
    bureauId: "bur-urb-urbanisme",
    description: "Autorisation d'urbanisme délivrée au nom de la commune : accord, prescriptions et modalités d'affichage.",
    fields: commonHeader([
      newField({ id: "demandeur", label: "Demandeur", type: "person", group: "Objet de l'acte" }),
      newField({ id: "adresseTerrain", label: "Adresse du terrain", type: "text", group: "Objet de l'acte" }),
      newField({ id: "parcelle", label: "Références cadastrales", type: "text", group: "Objet de l'acte", help: "Ex. « section AB n° 214 »." }),
      newField({ id: "natureTravaux", label: "Nature des travaux", type: "textarea", group: "Objet de l'acte", help: "Description reprise dans l'article 1er, après « aux fins de »." }),
      newField({ id: "surfacePlancher", label: "Surface de plancher créée (m²)", type: "money", group: "Objet de l'acte", required: false }),
      newField({ id: "prescriptions", label: "Prescriptions particulières", type: "textarea", group: "Prescriptions", required: false, help: "Si elle est vide, l'article des prescriptions n'est pas imprimé." }),
    ]),
    rules: [
      newRule({
        id: "r-permis-1", level: "blocking", expr: "exists(demandeur) && exists(objet) && exists(natureTravaux)",
        message: "Le demandeur, l'objet et la nature des travaux sont obligatoires.",
        author: "Service de l'urbanisme", date: "2026-05-01",
      }),
      newRule({
        id: "r-permis-2", level: "blocking", expr: "!exists(dateEffet) || !exists(dateSignature) || diff_days(dateEffet, dateSignature) >= 0",
        message: "Une autorisation ne peut pas être rétroactive : la date d'effet ne peut précéder la date de signature.",
        ref: "principes généraux du droit", author: "Service de l'urbanisme", date: "2026-05-01",
      }),
      newRule({
        id: "r-permis-3", level: "warning", expr: "!exists(surfacePlancher) || surfacePlancher <= 10000",
        message: "Au-delà de 10 000 m² de surface de plancher, vérifier la compétence de l'autorité (État, commune, EPCI).",
        author: "Service de l'urbanisme", date: "2026-05-01",
      }),
    ],
    body: [
      ...headerNodes(),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "Le permis de construire est accordé à {{demandeur.civility}} {{demandeur.firstName}} {{demandeur.lastName}} pour {{natureTravaux}} sur un terrain situé {{adresseTerrain}}, cadastré {{parcelle}}{{surfacePlancher ? ', portant création de ' + surfacePlancher + ' m² de surface de plancher' : ''}}." })],
        notes: [
          newNote({ kind: "instruction", author: "Service de l'urbanisme", text: "Vérifier l'avis du service instructeur et la conformité au règlement local d'urbanisme avant signature." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Prescriptions",
        when: "exists(prescriptions)",
        blocks: [newNode("para", { text: "Le présent permis est délivré sous réserve du respect des prescriptions suivantes : {{prescriptions}}", when: "exists(prescriptions)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Affichage et validité",
        blocks: [
          newNode("para", { text: "Le pétitionnaire est tenu d'afficher, sur le terrain dès la notification de la présente décision, un panneau rectangulaire mentionnant sa qualité, le nom du bénéficiaire, la date et le numéro de la décision, ainsi que la surface du projet." }),
          newNode("para", { text: "L'arrêté est affiché en mairie pendant deux mois." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [newNode("para", { text: "Le présent arrêté prend effet {{dateEffet ? \"le \" + dateEffet : \"à compter de sa notification au pétitionnaire\"}}." })],
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

// ------------------------------------------------------- établissement autonome
// Trame d'un établissement public AUTONOME — l'office public de l'habitat. Son
// autorité de tête n'est pas le maire, mais le président de son conseil
// d'administration, et la délégation que celui-ci a donnée à son directeur
// général forme une chaîne parallèle à celle de la commune. Les visas de
// l'office sont ses propres textes (`ref-oph-reglement`, `ref-oph-deliberation`,
// résolus comme « visa de l'entité signataire »).
function marcheTrame() {
  return newTrame({
    id: "tpl-marche-oph",
    name: "Décision — passation d'un marché public",
    version: "26.13",
    familyId: "fam-marches",
    actTypeId: "decision",
    status: "published",
    owner: "Direction générale de l'office",
    serviceId: "svc-oph",
    bureauId: "bur-oph-patrimoine",
    entityIds: ["ent-oph"],
    description: "Passation d'un marché public par un établissement public autonome, signée par le directeur général sur délégation du président du conseil d'administration.",
    fields: commonHeader([
      newField({ id: "objetMarche", label: "Objet du marché", type: "text", group: "Objet de l'acte", help: "Formule complète : elle suit « portant » dans l'intitulé et « le marché portant » dans l'article 1er." }),
      newField({ id: "titulaire", label: "Titulaire", type: "text", group: "Objet de l'acte" }),
      newField({ id: "montant", label: "Montant (HT)", type: "money", group: "Objet de l'acte" }),
      newField({ id: "procedure", label: "Procédure", type: "choice", group: "Objet de l'acte", options: ["mapa", "appel-offres-ouvert", "procedure-adaptee"] }),
      newField({ id: "duree", label: "Durée d'exécution", type: "text", group: "Objet de l'acte", required: false, help: "Ex. « huit mois à compter de l'ordre de service »." }),
    ]),
    rules: [
      newRule({
        id: "r-marche-1", level: "blocking", expr: "exists(titulaire) && exists(objetMarche) && exists(montant)",
        message: "Le titulaire, l'objet et le montant du marché sont obligatoires.",
        author: "Direction générale de l'office", date: "2026-05-05",
      }),
      newRule({
        id: "r-marche-2", level: "blocking", expr: "!exists(dateEffet) || !exists(dateSignature) || diff_days(dateEffet, dateSignature) >= 0",
        message: "Pas de rétroactivité : la date d'effet ne peut pas précéder la date de signature.",
        ref: "principes généraux du droit", author: "Direction générale de l'office", date: "2026-05-05",
      }),
      newRule({
        id: "r-marche-3", level: "warning",
        expr: "!exists(montant) || procedure != 'appel-offres-ouvert' || montant >= 40000",
        message: "L'appel d'offres ouvert n'est obligatoire qu'au-delà de 40 000 € HT : en deçà, le marché à procédure adaptée suffit.",
        ref: "code de la commande publique", author: "Direction générale de l'office", date: "2026-05-05",
      }),
    ],
    body: [
      newNode("title", { text: "Décision n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{entity.authorityFormula}}" }),
      newNode("visas", {
        items: [
          visa("ref-ccp"),
          visaSelf("reglement"),
          // La délibération du conseil d'administration qui délègue au directeur
          // général de l'office : c'est la décision fondant sa signature.
          visaChaine(),
        ],
      }),
      newNode("considerants", {
        items: [
          { id: "c1", text: "Considérant que le conseil d'administration a autorisé le lancement de la consultation ;", when: "" },
          { id: "c2", text: "Considérant que les offres ont été examinées conformément au règlement de la consultation ;", when: "" },
        ],
      }),
      newNode("enact", { text: "DÉCIDE" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "Le marché portant {{objetMarche}} est attribué à {{titulaire}} pour un montant de {{montant|money}} hors taxes, selon {{procedure == 'mapa' ? 'la procédure adaptée' : (procedure == 'appel-offres-ouvert' ? \"un appel d'offres ouvert\" : 'une procédure adaptée')}}." })],
        notes: [
          newNote({ kind: "instruction", author: "Direction générale de l'office", text: "Vérifier que la consultation a été publiée et que le titulaire a produit ses attestations fiscales et sociales avant la notification." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution du marché",
        blocks: [newNode("para", { text: "Le titulaire exécutera le marché {{duree ? 'sur une durée de ' + duree : 'dans les conditions prévues par le règlement de la consultation'}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [newNode("para", { text: "La présente décision prend effet {{dateEffet ? \"le \" + dateEffet : \"à compter de sa notification au titulaire\"}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général de {{entity.nameWithArt}} est chargé de l'exécution de la présente décision." })],
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

// ============================================================================
// Le RÈGLEMENT INTÉRIEUR : une ANNEXE, un texte LONG, et un RÈGLEMENT.
//
// Trois choses s'y montrent d'un coup. D'abord sa NATURE : `nature: "annexe"` —
// c'est un document ADOPTÉ par un autre (la délibération ci-dessous), auquel il
// est annexé : son texte suit l'original signé de l'acte qui l'adopte (voir
// src/lib/annexe-docs.js). Le visa de son adoption lui est ajouté en tête de ses
// visas par la compilation, et l'acte qui l'adopte annonce ses annexes à la fin
// de son dispositif (voir src/lib/annexes.js). Ensuite sa FORME : un règlement se
// range en Titres et Chapitres, non en une suite d'articles — d'où l'échelle
// `divisions` de cette trame (Titre en chiffres romains, Chapitre en chiffres
// arabes) et ses nœuds `division` imbriqués (voir SPEC § 2.2.3). Enfin sa QUALITÉ
// de RÈGLEMENT : `reglement: true` en fait un texte NORMATIF, publié À PART au
// recueil à titre informatif (voir `nature: "reglement"` dans SPEC § 2.2.4 ter).
//
// L'annexe n'a ni AUTORITÉ ni MENTION DE PUBLICATION AU RECUEIL : ces blocs
// appartiennent à l'acte qui l'adopte, et la compilation les écarte pour toute
// annexe (voir src/lib/compile.js). Elle garde ses VISAS — un règlement se fonde
// sur des textes, et le visa d'adoption le rattache à sa délibération.
// ============================================================================
function reglementTrame() {
  const art = (heading, text) => newNode("article", { numMode: "auto", heading, blocks: [newNode("para", { text })] });
  const div = (level, heading, blocks) => newNode("division", { level, numMode: "auto", heading, blocks });
  return newTrame({
    id: "tpl-reglement-int",
    name: "Règlement intérieur du conseil (annexe)",
    version: "26.01",
    familyId: "fam-organisation",
    actTypeId: "reglement",
    status: "published",
    nature: "annexe",
    // Un RÈGLEMENT : le recueil en donne une publication informative autonome,
    // à côté de sa place dans la délibération qui l'adopte (voir SPEC § 2.2.4 ter).
    reglement: true,
    // L'échelle de CETTE trame : deux échelons, numérotés librement.
    divisions: [
      { level: 1, label: "Titre", num: "roman" },
      { level: 2, label: "Chapitre", num: "decimal" },
    ],
    owner: "Secrétariat général",
    serviceId: "svc-sg",
    bureauId: "bur-sg-assemblees",
    description: "Règlement intérieur du conseil municipal : un document adopté par une délibération, dont le texte suit la délibération qui l'adopte. Range son texte en Titres et Chapitres.",
    // Une annexe ne se signe pas : son « signataire » est celui de l'acte qui
    // l'adopte, et son texte ne porte pas de bloc de signature (voir
    // src/lib/compile.js). Le champ n'a donc pas lieu d'être ici, et le champ de
    // date porte la date de l'acte qui l'adopte.
    // Elle n'a pas non plus de NUMÉRO propre : elle s'identifie par la décision
    // qui l'adopte, et le champ « Numéro de l'acte » n'a rien à y faire (voir
    // src/lib/annexes.js).
    fields: commonHeader([])
      .filter((f) => f.type !== "signataire" && f.id !== "numero")
      .map((f) => (f.id === "dateSignature"
        ? { ...f, label: "Date d'adoption", help: "La date de l'acte qui adopte ce document : elle figure sur son identité au registre et dans son intitulé." }
        : f)),
    rules: [
      newRule({
        id: "r-reglement-1", level: "warning", expr: "!exists(dateEffet) || !exists(dateSignature) || diff_days(dateEffet, dateSignature) >= 0",
        message: "La date d'effet d'un règlement ne peut pas précéder sa date d'adoption.",
        ref: "principes généraux du droit", author: "Secrétariat général", date: "2026-01-05",
      }),
    ],
    body: [
      newNode("title", { text: "Règlement intérieur de {{entity.nameWithArt}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visa("ref-cgfp")] }),
      newNode("considerants"),
      div(1, "La tenue des séances", [
        div(2, "Les séances ordinaires", [
          art("Périodicité", "Le conseil municipal se réunit en séance ordinaire au moins une fois par trimestre, sur convocation de son maire."),
          art("Convocation et ordre du jour", "La convocation, accompagnée de l'ordre du jour et des pièces nécessaires, est adressée aux conseillers trois jours francs au moins avant la séance. Dans les cas d'urgence, ce délai est réduit à un jour franc."),
        ]),
        div(2, "La police de l'assemblée", [
          art("Présidence", "Le maire ouvre et clôt la séance, dirige les débats et en assure la police. En cas d'absence, il est remplacé par un adjoint dans l'ordre du tableau."),
          art("Compte rendu", "Le compte rendu de la séance est affiché à la mairie dans les huit jours qui suivent la séance et tenu à la disposition du public."),
        ]),
      ]),
      div(1, "Les droits et obligations des conseillers", [
        div(2, "La participation aux travaux", [
          art("Commissions", "Chaque conseiller est membre de droit de la commission qu'il a choisi de présider, et peut assister aux travaux de toute autre commission avec voix consultative."),
          art("Questions orales", "Les conseillers peuvent poser des questions orales au maire en fin de séance. Une réponse est apportée au plus tard à la séance suivante."),
        ]),
        div(2, "La déontologie", [
          art("Abstention", "Tout conseiller intéressé à une affaire soumise au conseil doit s'abstenir de participer au vote et quitter la salle au moment du débat et du vote."),
        ]),
      ]),
    ],
  });
}

// ============================================================================
// LES DÉLIBÉRATIONS — les ACTES D'ASSEMBLÉE.
//
// Une délibération émane d'une ASSEMBLÉE, non d'une personne : sa ligne
// d'autorité est celle du conseil (« Le conseil municipal de … », « Le conseil
// d'administration de … »), et elle est signée par le PRÉSIDENT de cette
// assemblée — le maire, pour un conseil municipal ; le président du conseil
// d'administration, pour un établissement public. Le réglage `assemblee: true`
// de la trame est ce qui appelle l'assemblée ; le jeton `{{autorite}}` en rend
// la formule telle qu'elle est réglée dans Administration › Assemblées, et la
// qualité qui signe s'y choisit assemblée par assemblée (voir src/lib/conseils.js).
//
// La délibération municipale ADOPTE ici un document annexé (le règlement
// intérieur) : le lien se noue à la RÉDACTION (carte « Annexes », bouton
// « Joindre une annexe »), qui remplit `values.__annexes` — c'est ce qui fait
// annoncer le document à la fin du dispositif, et suivre son texte après la
// signature (voir src/lib/annexe-docs.js).
// ============================================================================
function deliberationTrame() {
  return newTrame({
    id: "tpl-deliberation",
    name: "Délibération du conseil municipal",
    version: "26.01",
    familyId: "fam-organisation",
    actTypeId: "deliberation",
    status: "published",
    owner: "Secrétariat général",
    serviceId: "svc-sg",
    bureauId: "bur-sg-assemblees",
    assemblee: true,
    description: "Délibération de l'assemblée : elle peut adopter un règlement ou une charte, et le document adopté lui est annexé.",
    fields: commonHeader([]),
    body: [
      newNode("title", { text: "Délibération n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{autorite}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visaChaine()] }),
      newNode("considerants"),
      newNode("enact", { text: "DÉLIBÈRE" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "Le conseil municipal adopte le document annexé à la présente délibération ; son texte suit la présente délibération dans l'original signé." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [newNode("para", { text: "La présente délibération prend effet {{dateEffet ? \"le \" + dateEffet : \"au lendemain de sa publication au recueil des actes administratifs\"}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le maire de {{entity.nameWithArt}} est chargé de l'exécution de la présente délibération." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      ...recoursAndPublication(),
    ],
  });
}

// La délibération d'un CONSEIL D'ADMINISTRATION d'établissement public : même
// mécanique, autre assemblée. C'est le président du conseil d'administration
// qui signe, et l'assemblée délibère pour l'établissement. Le texte renvoie à
// l'assemblée par le jeton, non par un mot en dur : la même trame servirait un
// autre établissement, avec son propre conseil.
function deliberationCATrame() {
  return newTrame({
    id: "tpl-deliberation-ca",
    name: "Délibération du conseil d'administration",
    version: "26.01",
    familyId: "fam-organisation",
    actTypeId: "deliberation",
    status: "published",
    owner: "Direction de l'office",
    entityIds: ["ent-oph"],
    assemblee: true,
    description: "Délibération d'un conseil d'administration d'établissement public : elle émane de l'assemblée, et c'est son président qui la signe.",
    fields: commonHeader([]),
    body: [
      newNode("title", { text: "Délibération n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{autorite}}" }),
      newNode("visas", { items: [visaChaine()] }),
      newNode("considerants"),
      newNode("enact", { text: "DÉLIBÈRE" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "Le conseil d'administration approuve les dispositions qui font l'objet de la présente délibération." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [newNode("para", { text: "La présente délibération prend effet {{dateEffet ? \"le \" + dateEffet : \"au lendemain de sa publication\"}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le président du conseil d'administration de {{entity.nameWithArt}} est chargé de l'exécution de la présente délibération." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      ...recoursAndPublication(),
    ],
  });
}

// ============================================================================
// LES DOCUMENTS D'ASSEMBLÉE QUI NE FONT PAS DROIT.
//
// La collectivité publie bien des choses qui ne sont pas des actes : le compte
// rendu intégral d'une séance, une déclaration faite devant l'assemblée, un
// vœu. Ce sont des DOCUMENTS — les administrés les cherchent au recueil —, mais
// ils ne créent ni droits ni obligations. Leur nature (`nature: "verbatim"`,
// `"declaration"`, `"voeu"`) le dit à l'application : la publication les dépose
// au recueil sans opposabilité, sans entrée en vigueur et sans délai de recours
// (voir src/lib/eli.js et src/lib/execution.js). Ces trames sont donc
// PUBLIABLES — c'est tout leur intérêt — mais leur corps n'a ni visas, ni
// considérants, ni « articles » : c'est un texte qu'on donne à lire, non un
// dispositif qui décide.
// ============================================================================
function corpsDocumentAssemblee({ titre, mention }) {
  return [
    newNode("title", { text: titre }),
    newNode("authority", { text: "{{autorite}}" }),
    newNode("para", { text: mention }),
  ];
}

// Le VERBATIM : le compte rendu intégral des débats d'une séance.
function verbatimTrame() {
  return newTrame({
    id: "tpl-verbatim",
    name: "Verbatim de séance du conseil municipal (document)",
    version: "26.01",
    familyId: "fam-seances",
    actTypeId: "compte-rendu",
    status: "published",
    owner: "Secrétariat général",
    serviceId: "svc-sg",
    bureauId: "bur-sg-assemblees",
    assemblee: true,
    nature: "verbatim",
    description: "Compte rendu intégral d'une séance du conseil municipal : le texte des débats, publié au recueil pour être lu — sans opposabilité.",
    fields: [
      ...commonHeader([]).filter((f) => f.id !== "dateEffet"),
      newField({ id: "dateSeance", label: "Date de la séance", type: "date", group: "Séance" }),
      newField({ id: "numeroSeance", label: "Numéro de séance", type: "text", required: false, group: "Séance", help: "Ex. « séance ordinaire du 22 septembre ». Paraît sous la présidence." }),
      newField({ id: "presidence", label: "Présidence de séance", type: "text", required: false, group: "Séance" }),
      newField({ id: "ordreDuJour", label: "Ordre du jour", type: "textarea", group: "Séance", help: "Une ligne par point examiné." }),
      newField({ id: "compteRendu", label: "Compte rendu des débats", type: "textarea", group: "Débats", help: "Le texte intégral des échanges : c'est le verbatim proprement dit." }),
    ],
    rules: [
      newRule({ id: "r-verbatim-1", level: "blocking", expr: "exists(dateSeance) && exists(compteRendu)", message: "La date de la séance et le compte rendu des débats sont obligatoires.", author: "Secrétariat général", date: "2026-09-01" }),
    ],
    body: [
      ...corpsDocumentAssemblee({
        titre: "Verbatim de la séance du conseil municipal du {{dateSeance|date-long}}",
        mention: "{{numeroSeance ? numeroSeance + \". \" : \"\"}}{{presidence ? \"Séance présidée par \" + presidence + \". \" : \"\"}}Le présent document rapporte le texte intégral des débats de la séance. Il est publié au recueil pour être porté à la connaissance de tous : il ne fait pas droit, et n'est donc pas opposable.",
      }),
      newNode("para", { text: "{{ordreDuJour}}", when: "exists(ordreDuJour)" }),
      newNode("para", { text: "{{compteRendu}}", when: "exists(compteRendu)" }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
    ],
  });
}

// La DÉCLARATION : un texte pris devant ou par l'assemblée, publié pour être lu
// — une déclaration de groupe, une déclaration liminaire, une prise de position.
function declarationTrame() {
  return newTrame({
    id: "tpl-declaration",
    name: "Déclaration devant l'assemblée (document)",
    version: "26.01",
    familyId: "fam-seances",
    actTypeId: "declaration",
    status: "published",
    owner: "Secrétariat général",
    serviceId: "svc-sg",
    bureauId: "bur-sg-assemblees",
    assemblee: true,
    nature: "declaration",
    description: "Déclaration prise devant l'assemblée (déclaration de groupe, déclaration liminaire, prise de position) : publiée au recueil, sans portée juridique propre.",
    fields: [
      ...commonHeader([]).filter((f) => f.id !== "dateEffet"),
      newField({ id: "auteurDeclaration", label: "Auteur de la déclaration", type: "text", group: "Déclaration", help: "Le groupe, l'élu ou la personne qui déclare." }),
      newField({ id: "contexte", label: "Circonstance", type: "textarea", required: false, group: "Déclaration", help: "À quel moment et à quel propos la déclaration a été prise." }),
      newField({ id: "texte", label: "Texte de la déclaration", type: "textarea", group: "Déclaration" }),
    ],
    rules: [
      newRule({ id: "r-declaration-1", level: "blocking", expr: "exists(auteurDeclaration) && exists(texte)", message: "L'auteur et le texte de la déclaration sont obligatoires.", author: "Secrétariat général", date: "2026-09-01" }),
    ],
    body: [
      ...corpsDocumentAssemblee({
        titre: "Déclaration du {{dateSignature|date-long}}",
        mention: "{{auteurDeclaration ? \"Déclaration de \" + auteurDeclaration + \". \" : \"\"}}{{contexte ? contexte + \" \" : \"\"}}Ce texte est publié au recueil pour être porté à la connaissance de tous. Il engage son auteur, non la collectivité : il ne fait pas droit, et n'est donc pas opposable.",
      }),
      newNode("para", { text: "{{texte}}", when: "exists(texte)" }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
    ],
  });
}

// Le VŒU : une motion de l'assemblée. L'assemblée DEMANDE, elle ne décide pas —
// le vœu se publie, il ne s'exécute pas.
function voeuTrame() {
  return newTrame({
    id: "tpl-voeu",
    name: "Vœu de l'assemblée (document)",
    version: "26.01",
    familyId: "fam-seances",
    actTypeId: "voeu",
    status: "published",
    owner: "Secrétariat général",
    serviceId: "svc-sg",
    bureauId: "bur-sg-assemblees",
    assemblee: true,
    nature: "voeu",
    description: "Vœu ou motion de l'assemblée : adopté et publié, mais l'assemblée demande — elle ne décide pas. Sans force exécutoire.",
    fields: [
      ...commonHeader([]).filter((f) => f.id !== "dateEffet"),
      newField({ id: "destinataire", label: "Destinataire du vœu", type: "text", group: "Vœu", help: "À qui l'assemblée adresse sa demande (l'État, la région, le département…)." }),
      newField({ id: "expose", label: "Exposé", type: "textarea", required: false, group: "Vœu", help: "Les motifs du vœu." }),
      newField({ id: "demande", label: "Demande de l'assemblée", type: "textarea", group: "Vœu" }),
    ],
    rules: [
      newRule({ id: "r-voeu-1", level: "blocking", expr: "exists(destinataire) && exists(demande)", message: "Le destinataire et la demande de l'assemblée sont obligatoires.", author: "Secrétariat général", date: "2026-09-01" }),
    ],
    body: [
      ...corpsDocumentAssemblee({
        titre: "Vœu de l'assemblée du {{dateSignature|date-long}}",
        mention: "{{destinataire ? \"Adressé à \" + destinataire + \". \" : \"\"}}L'assemblée émet le vœu qui suit. Elle demande, elle ne décide pas : ce document est publié au recueil comme la position de l'assemblée, et n'a pas de force exécutoire.",
      }),
      newNode("para", { text: "{{expose}}", when: "exists(expose)" }),
      newNode("para", { text: "{{demande}}", when: "exists(demande)" }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
    ],
  });
}

// ============================================================================
// LA POLICE ADMINISTRATIVE.
//
// L'arrêté de police est l'acte le plus courant d'une mairie : circulation,
// stationnement, sécurité, salubrité. Il a une particularité que la trame
// traduit : la police administrative appartient au MAIRE et ne se délègue pas à
// un agent — d'où la fonction imposée au champ « signataire » (`role:maire`),
// qui laisse au rédacteur le choix de la personne, non de la qualité. Une seule
// trame sert à tous les motifs : le motif, la voie et les mesures sont des
// VALEURS, et le dispositif s'y adapte.
// ============================================================================
function policeTrame() {
  return newTrame({
    id: "tpl-police",
    name: "Arrêté — police administrative (circulation, sécurité, salubrité)",
    version: "26.14",
    familyId: "fam-police",
    actTypeId: "arrete",
    status: "published",
    owner: "Police municipale et prévention",
    serviceId: "svc-police",
    bureauId: "bur-pol-administratif",
    description: "Mesure de police du maire : circulation, stationnement, sécurité ou salubrité sur la voie publique. Le maire en est l'autorité, sans délégation possible.",
    fields: [
      ...commonHeader([
        newField({
          id: "motif", label: "Motif de la mesure", type: "choice", group: "Objet de l'acte",
          options: ["travaux", "securite", "salubrite", "stationnement", "environnement", "manifestation"],
          help: "Le motif commande les visas de l'arrêté (code de la route, code de la sécurité intérieure, code de l'environnement).",
        }),
        newField({ id: "voie", label: "Voie ou emplacement concerné", type: "text", group: "Objet de l'acte", help: "Formule introduite par une préposition : « rue des Tilleuls, entre la place du Marché et le pont »." }),
        newField({ id: "dateDebut", label: "Début de la mesure", type: "date", group: "Objet de l'acte" }),
        newField({ id: "dateFin", label: "Fin de la mesure", type: "date", required: false, group: "Objet de l'acte", help: "Vide : la mesure est permanente, jusqu'à son abrogation." }),
        newField({ id: "mesures", label: "Mesures prescrites", type: "textarea", group: "Dispositif", help: "Le texte de l'article 1er : une phrase par prescription." }),
        newField({ id: "derogations", label: "Dérogations", type: "textarea", required: false, group: "Dispositif", help: "Vide : l'article des dérogations n'est pas imprimé." }),
      ], { fonction: "role:maire" }),
    ],
    rules: [
      newRule({ id: "r-police-1", level: "blocking", expr: "exists(voie) && exists(mesures)", message: "La voie concernée et les mesures prescrites sont obligatoires.", author: "Police municipale et prévention", date: "2026-05-01" }),
      newRule({ id: "r-police-2", level: "blocking", expr: "!exists(dateFin) || !exists(dateDebut) || diff_days(dateFin, dateDebut) >= 0", message: "La fin de la mesure ne peut pas précéder son début.", author: "Police municipale et prévention", date: "2026-05-01" }),
      newRule({ id: "r-police-3", level: "warning", expr: "motif != 'manifestation' || (exists(dateDebut) && exists(dateFin))", message: "Une mesure prise pour une manifestation porte ses dates de début et de fin.", author: "Police municipale et prévention", date: "2026-05-01" }),
      newRule({ id: "r-police-4", level: "warning", expr: "!contains(mesures, 'interdite') || exists(derogations)", message: "Une interdiction générale gagne à prévoir ses dérogations : les véhicules de secours, les riverains, les livraisons.", author: "Police municipale et prévention", date: "2026-05-01" }),
    ],
    body: [
      ...headerNodes(),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "{{mesures}}" })],
        notes: [
          newNote({ kind: "legal", author: "Police municipale et prévention", text: "La mesure de police doit être nécessaire et proportionnée au trouble qu'elle prévient : c'est le contrôle que le juge administratif exerce sur l'arrêté." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Champ d'application et durée",
        blocks: [
          newNode("para", { text: "Les dispositions du présent arrêté s'appliquent {{voie}}." }),
          newNode("para", { text: "Elles prennent effet {{dateDebut ? \"le \" + dateDebut : \"à compter de sa publication\"}}{{dateFin ? \" et sont applicables jusqu'au \" + dateFin : \" jusqu'à leur abrogation\"}}.", when: "exists(dateDebut) || exists(dateFin)" }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Dérogations",
        when: "exists(derogations)",
        blocks: [newNode("para", { text: "Sont toutefois autorisés, dans les conditions fixées par le service : {{derogations}}", when: "exists(derogations)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur de la police municipale et le directeur général des services de {{entity.nameWithArt}} sont chargés, chacun en ce qui le concerne, de l'exécution du présent arrêté." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      newNode("mention", { mentionId: "men-recours" }),
      newNode("mention", { mentionId: "men-affichage" }),
    ],
  });
}

// Le CADRE DE VIE : déchets, eau, nuisances, espaces publics. Ces mesures sont,
// elles aussi, des mesures de police du maire — la trame est donc DÉRIVÉE de
// celle de la police administrative, dont elle change seulement l'identité, le
// service, la matière (le thème du recueil) et les textes visés. La dériver
// plutôt que la recopier évite que les deux s'écartent à la première correction.
function environnementTrame() {
  const t = policeTrame();
  t.id = "tpl-environnement";
  t.name = "Arrêté — police du cadre de vie (déchets, eau, nuisances)";
  t.version = "26.24";
  t.familyId = "fam-environnement";
  t.serviceId = "svc-environnement";
  t.bureauId = "bur-env-proprete";
  t.owner = "Cadre de vie et environnement";
  t.description = "Mesure de police du maire en matière de cadre de vie : déchets et propreté, eau, nuisances, espaces publics. Le maire en est l'autorité, sans délégation possible.";
  const motif = t.fields.find((f) => f.id === "motif");
  if (motif) {
    motif.options = ["dechets", "eau", "nuisances", "proprete", "espaces-verts"];
    motif.help = "Le motif commande les visas de l'arrêté : code de l'environnement, code de la santé publique, code général des collectivités territoriales.";
  }
  const visas = t.body.find((n) => n.type === "visas");
  if (visas) {
    visas.items = [visa("ref-cgct"), visa("ref-code-environnement"), visa("ref-code-sante-publique"), visaChaine()];
  }
  const execution = t.body.find((n) => n.type === "article" && n.heading === "Exécution");
  if (execution) {
    execution.blocks = [newNode("para", { text: "Le directeur général des services et le responsable du service du cadre de vie de {{entity.nameWithArt}} sont chargés, chacun en ce qui le concerne, de l'exécution du présent arrêté." })];
  }
  const notes = t.body.find((n) => n.type === "article" && n.numMode === "auto" && !n.heading);
  if (notes && notes.notes && notes.notes[0]) {
    notes.notes[0] = newNote({ kind: "legal", author: "Cadre de vie et environnement", text: "La mesure doit être nécessaire et proportionnée au trouble qu'elle prévient ; les prescriptions doivent pouvoir être exécutées avec les moyens du service." });
  }
  return t;
}

// L'ACCUEIL PÉRISCOLAIRE : l'organisation des temps d'accueil du matin, du soir,
// du mercredi et des vacances. Un acte d'organisation, pris chaque année avant
// la rentrée, qui décrit des services OUVERTES ou non — chaque service retenu
// ajoute sa ligne à l'article d'organisation.
function periscolaireTrame() {
  return newTrame({
    id: "tpl-periscolaire",
    name: "Arrêté — organisation des accueils périscolaires",
    version: "26.25",
    familyId: "fam-scolarite",
    actTypeId: "arrete",
    status: "published",
    owner: "Éducation, enfance et jeunesse",
    serviceId: "svc-education",
    bureauId: "bur-edu-periscolaire",
    description: "Organisation de l'accueil du matin, du soir, du mercredi et des vacances : services ouverts, horaires, lieux, encadrement et modalités d'inscription.",
    fields: commonHeader([
      newField({ id: "anneeScolaire", label: "Année scolaire", type: "text", group: "Objet de l'acte", help: "Ex. « 2026-2027 »." }),
      newField({ id: "dateRentree", label: "Date de rentrée", type: "date", group: "Objet de l'acte" }),
      newField({
        id: "services", label: "Services ouverts", type: "multichoice", group: "Dispositif",
        options: ["matin", "soir", "mercredi", "vacances"],
        help: "Chaque service retenu ajoute sa ligne à l'article d'organisation.",
      }),
      newField({ id: "lieuAccueil", label: "Lieu d'accueil", type: "text", group: "Dispositif", help: "Ex. « le groupe scolaire Jean-Moulin »." }),
      newField({ id: "encadrement", label: "Encadrement", type: "textarea", required: false, group: "Dispositif", help: "Vide : l'article de l'encadrement n'est pas imprimé." }),
      newField({ id: "horaires", label: "Dispositions particulières", type: "textarea", required: false, group: "Dispositif" }),
    ]),
    rules: [
      newRule({ id: "r-peri-1", level: "blocking", expr: "exists(anneeScolaire) && exists(dateRentree) && count(services) > 0", message: "L'année scolaire, la date de rentrée et au moins un service ouvert sont obligatoires.", author: "Éducation, enfance et jeunesse", date: "2026-06-01" }),
      newRule({ id: "r-peri-2", level: "warning", expr: "!contains(services, 'mercredi') || exists(encadrement)", message: "L'accueil du mercredi suppose un encadrement qualifié : décrivez-le.", author: "Éducation, enfance et jeunesse", date: "2026-06-01" }),
      newRule({ id: "r-peri-3", level: "warning", expr: "!exists(dateEffet) || diff_days(dateEffet, dateRentree) >= 0", message: "L'organisation doit prendre effet au plus tôt à la rentrée, pour que les familles aient l'information à temps.", author: "Éducation, enfance et jeunesse", date: "2026-06-01" }),
    ],
    body: [
      ...headerNodes(),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "Les accueils périscolaires de {{entity.nameWithArt}} sont organisés, pour l'année scolaire {{anneeScolaire}}, à compter du {{dateRentree}}, dans les conditions fixées par le présent arrêté." })],
        notes: [
          newNote({ kind: "instruction", author: "Éducation, enfance et jeunesse", text: "Adresser l'arrêté aux directeurs des écoles et aux représentants des parents avant la fin de l'année scolaire : les familles en ont besoin pour organiser leur rentrée." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Services ouverts",
        blocks: [newNode("list", {
          items: [
            { id: "p1", text: "l'accueil du matin, de 7 h 30 à 8 h 20, dans les locaux de {{lieuAccueil}} ;", when: "contains(services, 'matin')" },
            { id: "p2", text: "l'accueil du soir, de 16 h 30 à 18 h 30, avec une étude surveillée de 16 h 30 à 17 h 30 ;", when: "contains(services, 'soir')" },
            { id: "p3", text: "l'accueil du mercredi après-midi, de 13 h 30 à 18 heures, pour les enfants des écoles élémentaires ;", when: "contains(services, 'mercredi')" },
            { id: "p4", text: "l'accueil de loisirs sans hébergement pendant les vacances scolaires, du lundi au vendredi, de 7 h 30 à 18 h 30.", when: "contains(services, 'vacances')" },
          ],
        })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Encadrement",
        when: "exists(encadrement)",
        blocks: [newNode("para", { text: "{{encadrement}}", when: "exists(encadrement)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Inscriptions",
        blocks: [newNode("para", { text: "Les enfants sont inscrits par leurs représentants légaux auprès du service de l'éducation, au plus tard le 10 juillet pour la rentrée de septembre. L'inscription est renouvelée à chaque année scolaire et vaut pour l'ensemble des services ouverts." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Tarifs et facturation",
        blocks: [newNode("para", { text: "Les tarifs des accueils périscolaires sont ceux fixés par la délibération tarifaire du conseil municipal. La facturation est mensuelle et établie sur la base des présences enregistrées." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Dispositions particulières",
        when: "exists(horaires)",
        blocks: [newNode("para", { text: "{{horaires}}", when: "exists(horaires)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [newNode("para", { text: "Le présent arrêté prend effet {{dateEffet ? \"le \" + dateEffet : \"à compter de sa publication\"}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général des services et la directrice de l'éducation, de l'enfance et de la jeunesse de {{entity.nameWithArt}} sont chargés, chacun en ce qui le concerne, de l'exécution du présent arrêté." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      ...recoursAndPublication(),
    ],
  });
}

// ============================================================================
// LA MANIFESTATION ET L'ÉVÉNEMENT.
//
// Une fête de village, un marché de Noël, un carnaval : l'arrêté qui les
// organise autorise l'occupation du domaine public ET règle les suites de
// l'événement — circulation détournée, stationnement réservé, sonorisation
// contenue, buvette autorisée, secours prévus. Les mesures sont des CHOIX
// (`multichoice`) : chaque case cochée ajoute l'article correspondant, et
// l'arrêté ne porte donc que les prescriptions de l'événement qu'il organise.
// C'est la trame de la fête du village.
// ============================================================================
function evenementTrame() {
  return newTrame({
    id: "tpl-evenement",
    name: "Arrêté — organisation d'une manifestation ou d'un événement",
    version: "26.15",
    familyId: "fam-vie-locale",
    actTypeId: "arrete",
    status: "published",
    owner: "Culture, fêtes et vie associative",
    serviceId: "svc-culture",
    bureauId: "bur-cul-fetes",
    description: "Autorisation et organisation d'une manifestation : emprise sur le domaine public, circulation, stationnement, sécurité, sonorisation, débit de boissons.",
    fields: commonHeader([
      newField({ id: "nomEvenement", label: "Nom de l'événement", type: "text", group: "Objet de l'acte" }),
      newField({ id: "organisateur", label: "Organisateur", type: "text", group: "Objet de l'acte", help: "La personne ou l'association qui porte l'événement." }),
      newField({ id: "dateDebut", label: "Début de l'événement", type: "date", group: "Objet de l'acte" }),
      newField({ id: "dateFin", label: "Fin de l'événement", type: "date", required: false, group: "Objet de l'acte", help: "Vide : l'événement tient en une journée." }),
      newField({ id: "lieu", label: "Lieu", type: "text", group: "Objet de l'acte", help: "Formule introduite par « sur » ou « à »." }),
      newField({ id: "emprise", label: "Emprise sur le domaine public", type: "textarea", required: false, group: "Dispositif", help: "Vide : l'article de l'occupation n'est pas imprimé." }),
      newField({
        id: "mesures", label: "Mesures de police à prévoir", type: "multichoice", group: "Dispositif",
        options: ["circulation", "stationnement", "sonorisation", "buvette", "restauration", "secours", "pyrotechnie"],
        help: "Chaque mesure retenue ajoute l'article correspondant au dispositif.",
      }),
      newField({ id: "securite", label: "Dispositif de sécurité", type: "textarea", required: false, group: "Dispositif" }),
      newField({ id: "obligations", label: "Obligations particulières de l'organisateur", type: "textarea", required: false, group: "Dispositif" }),
    ]),
    rules: [
      newRule({ id: "r-evenement-1", level: "blocking", expr: "exists(nomEvenement) && exists(organisateur) && exists(dateDebut)", message: "Le nom de l'événement, son organisateur et sa date de début sont obligatoires.", author: "Culture, fêtes et vie associative", date: "2026-05-01" }),
      newRule({ id: "r-evenement-2", level: "blocking", expr: "!exists(dateFin) || diff_days(dateFin, dateDebut) >= 0", message: "La fin de l'événement ne peut pas précéder son début.", author: "Culture, fêtes et vie associative", date: "2026-05-01" }),
      newRule({ id: "r-evenement-3", level: "warning", expr: "!contains(mesures, 'pyrotechnie') || exists(securite)", message: "Un spectacle pyrotechnique suppose un dispositif de sécurité décrit : renseignez-le.", ref: "code de la sécurité civile", author: "Culture, fêtes et vie associative", date: "2026-05-01" }),
      newRule({ id: "r-evenement-4", level: "warning", expr: "!contains(mesures, 'buvette') || !contains(mesures, 'restauration')", message: "Buvette et restauration relèvent de régimes différents : vérifier le classement de l'établissement temporaire.", author: "Culture, fêtes et vie associative", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "Arrêté n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{entity.authorityFormula}}" }),
      newNode("visas", {
        items: [
          visa("ref-cgct"), visa("ref-code-route"), visa("ref-csi"), visa("ref-code-securite-civile"),
          visa("ref-delib-festivites"), visaChaine(),
        ],
      }),
      newNode("considerants"),
      newNode("enact", { text: "ARRÊTE" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", {
          text: "{{organisateur}} est autorisé(e) à organiser {{nomEvenement}} {{lieu}}{{dateDebut ? \" le \" + dateDebut : \"\"}}{{dateFin ? \" et le \" + dateFin : \"\"}}.",
        })],
        notes: [
          newNote({ kind: "instruction", author: "Culture, fêtes et vie associative", text: "Joindre au dossier la demande de l'organisateur, le programme et le plan des installations : l'annexe de la fête suit l'arrêté signé." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Occupation du domaine public",
        when: "exists(emprise)",
        blocks: [newNode("para", { text: "L'occupation du domaine public est autorisée dans les conditions suivantes : {{emprise}}", when: "exists(emprise)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Circulation et stationnement",
        when: "contains(mesures, 'circulation') || contains(mesures, 'stationnement')",
        blocks: [newNode("para", {
          text: "Pendant toute la durée de la manifestation, la circulation est réglementée sur les voies concernées et le stationnement y est {{contains(mesures, 'stationnement') ? \"interdit, à l'exception des véhicules de secours et de service\" : \"maintenu dans les conditions habituelles\"}}.",
          when: "contains(mesures, 'circulation') || contains(mesures, 'stationnement')",
        })],
        notes: [
          newNote({ kind: "legal", author: "Culture, fêtes et vie associative", text: "Le détournement des voies et l'interdiction de stationner relèvent de l'arrêté de police du maire : la mesure est prise ici dans le même acte que l'autorisation, ce qui est l'usage pour une fête." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Sécurité et secours",
        when: "contains(mesures, 'secours') || exists(securite)",
        blocks: [
          newNode("para", { text: "Un dispositif de sécurité et de secours est mis en place par l'organisateur, en liaison avec la police municipale et le service départemental d'incendie et de secours.", when: "contains(mesures, 'secours')" }),
          newNode("para", { text: "{{securite}}", when: "exists(securite)" }),
        ],
        notes: [
          newNote({ kind: "watch", author: "Culture, fêtes et vie associative", text: "La commission de sécurité doit rendre son avis pour toute installation recevant du public : l'avis est joint au dossier." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Sonorisation",
        when: "contains(mesures, 'sonorisation')",
        blocks: [newNode("para", {
          text: "La sonorisation est autorisée de 10 heures à minuit. Les niveaux sonores sont réglés de manière à ne pas troubler la tranquillité du voisinage ; le maire peut ordonner la réduction du niveau sonore ou l'arrêt de la sonorisation en cas de trouble constaté.",
          when: "contains(mesures, 'sonorisation')",
        })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Débit de boissons et restauration",
        when: "contains(mesures, 'buvette') || contains(mesures, 'restauration')",
        blocks: [newNode("para", {
          text: "{{contains(mesures, 'buvette') && contains(mesures, 'restauration') ? \"La vente de boissons et la restauration temporaire sont autorisées\" : (contains(mesures, 'buvette') ? \"La vente de boissons est autorisée\" : \"La restauration temporaire est autorisée\")}} dans le cadre de la manifestation, aux emplacements réservés à cet effet.",
          when: "contains(mesures, 'buvette') || contains(mesures, 'restauration')",
        })],
        notes: [
          newNote({ kind: "legal", author: "Culture, fêtes et vie associative", text: "La buvette d'une association peut bénéficier d'une licence temporaire ; la restauration relève des règles d'hygiène alimentaire." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Spectacle pyrotechnique",
        when: "contains(mesures, 'pyrotechnie')",
        blocks: [newNode("para", {
          text: "Le spectacle pyrotechnique est autorisé sous réserve que le tir soit réalisé par un artificier titulaire du certificat de qualification et que la zone de sécurité soit interdite au public. Le dispositif est déclaré en préfecture par l'organisateur.",
          when: "contains(mesures, 'pyrotechnie')",
        })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Obligations de l'organisateur",
        blocks: [newNode("list", {
          items: [
            { id: "o1", text: "souscrire une assurance de responsabilité civile couvrant l'ensemble de la manifestation et en justifier avant sa tenue ;", when: "" },
            { id: "o2", text: "assurer la surveillance des installations et des accès, et respecter les consignes de la commission de sécurité ;", when: "" },
            { id: "o3", text: "installer la signalisation temporaire prescrite par le service de la voirie ;", when: "" },
            { id: "o4", text: "laisser l'emprise libre de tout obstacle à l'issue de la manifestation et remettre les lieux en état ;", when: "" },
          ],
        })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Obligations particulières",
        when: "exists(obligations)",
        blocks: [newNode("para", { text: "{{obligations}}", when: "exists(obligations)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur de la police municipale, le directeur général des services et le directeur du service des fêtes de {{entity.nameWithArt}} sont chargés, chacun en ce qui le concerne, de l'exécution du présent arrêté." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      newNode("mention", { mentionId: "men-organisateur" }),
      newNode("mention", { mentionId: "men-affichage" }),
    ],
  });
}

// ============================================================================
// LES ANNEXES.
//
// Une annexe ne se signe pas : c'est la délibération qui l'adopte qui est
// signée, et son texte suit l'original signé (voir src/lib/annexes.js et
// src/lib/annexe-docs.js). C'est pourquoi ces trames n'ont ni champ « Numéro »
// ni champ « Signataire », et que leur date s'appelle « Date d'adoption ».
// ============================================================================

// Un document ADOPTÉ, qu'on dépose à part : le règlement de la restauration
// scolaire, tenu en Titres et Chapitres. C'est le document que le recueil public
// met en avant par la délibération qui l'adopte.
function cantineTrame() {
  const art = (heading, text) => newNode("article", { numMode: "auto", heading, blocks: [newNode("para", { text })] });
  const div = (level, heading, blocks) => newNode("division", { level, numMode: "auto", heading, blocks });
  return newTrame({
    id: "tpl-reglement-cantine",
    name: "Règlement de la restauration scolaire (annexe)",
    version: "26.16",
    familyId: "fam-scolarite",
    actTypeId: "reglement",
    status: "published",
    nature: "annexe",
    // Un RÈGLEMENT, lui aussi : un texte normatif que le recueil publie pour
    // lui-même, à titre informatif (voir SPEC § 2.2.4 ter).
    reglement: true,
    serviceId: "svc-education",
    bureauId: "bur-edu-restauration",
    owner: "Éducation, enfance et jeunesse",
    divisions: [
      { level: 1, label: "Titre", num: "roman" },
      { level: 2, label: "Chapitre", num: "decimal" },
    ],
    description: "Le règlement d'accès au service de restauration scolaire : inscriptions, régimes particuliers, tarifs, facturation, discipline. Adopté par une délibération, son texte suit l'acte qui l'adopte.",
    fields: commonHeader([])
      .filter((f) => f.type !== "signataire" && f.id !== "numero")
      .map((f) => (f.id === "dateSignature"
        ? { ...f, label: "Date d'adoption", help: "La date de l'acte qui adopte le règlement : elle figure sur son identité au registre et dans son intitulé." }
        : f)),
    rules: [
      newRule({ id: "r-cantine-1", level: "warning", expr: "!exists(dateEffet) || !exists(dateSignature) || diff_days(dateEffet, dateSignature) >= 0", message: "Le règlement ne peut pas avoir d'effet avant son adoption.", ref: "principes généraux du droit", author: "Éducation, enfance et jeunesse", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "Règlement de la restauration scolaire de {{entity.nameWithArt}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visa("ref-code-education"), visa("ref-code-sante-publique"), visa("ref-delib-cantine")] }),
      newNode("considerants"),
      div(1, "L'accès au service de restauration", [
        div(2, "Les élèves bénéficiaires", [
          art("Principe", "Le service de restauration scolaire est accessible, dans la limite des places disponibles, à tout élève inscrit dans une école publique de la commune."),
          art("Élèves de passage", "Les élèves scolarisés hors de la commune et accueillis temporairement dans une classe peuvent être admis au service, sur décision du service de l'éducation et pour la seule durée de leur accueil."),
          art("Enfants porteurs d'un handicap", "L'accès au service est garanti aux enfants en situation de handicap. Les adaptations nécessaires — aide au repas, régime adapté, accompagnement — sont organisées avec la famille et le service de l'éducation."),
        ]),
        div(2, "Les inscriptions et les radiations", [
          art("Dossier d'inscription", "L'inscription est annuelle. Elle suppose un dossier complet : fiche d'inscription signée par le représentant légal, fiche sanitaire, attestation d'assurance scolaire et, le cas échéant, les justificatifs ouvrant droit au tarif réduit."),
          art("Période d'inscription", "Les inscriptions sont reçues du 15 juin au 10 juillet pour l'année scolaire suivante. Les demandes parvenues après cette période sont satisfaites dans la limite des places disponibles."),
          art("Radiation", "L'inscription prend fin à la radiation de l'élève de l'école, à son départ de la commune, sur demande écrite du représentant légal, ou lorsque l'élève cesse de fréquenter le service sans motif pendant plus d'un mois."),
        ]),
      ]),
      div(1, "Le fonctionnement du service", [
        div(2, "Les repas", [
          art("Composition des repas", "Chaque repas comprend une entrée, un plat garni, un produit laitier et un dessert. Les menus sont affichés dans chaque école et publiés sur le site de la commune."),
          art("Régimes particuliers", "Les enfants présentant une allergie alimentaire ou une intolérance attestée par un certificat médical bénéficient d'un repas adapté. Le certificat est renouvelé chaque année scolaire."),
          art("Qualité et traçabilité", "La commune met en œuvre les principes de la maîtrise sanitaire — traçabilité des denrées, chaîne du froid, plan de maîtrise sanitaire — et privilégie, à qualité égale, les produits locaux et de saison."),
        ]),
        div(2, "Les horaires et l'encadrement", [
          art("Horaires", "Le service fonctionne les jours d'école, de 11 h 45 à 13 h 30. Les élèves y accèdent à l'issue de la classe du matin et rejoignent leur classe à l'enseignement de l'après-midi."),
          art("Encadrement", "L'encadrement est assuré par des agents communaux, dans les conditions d'effectifs prévues par la réglementation. Les élèves accèdent au restaurant scolaire dans le calme, sous la conduite de leur enseignant."),
          art("Comportement des convives", "Les convives sont tenus à la politesse, au respect des autres et du personnel, et à la propreté. Le calme est de rigueur pendant le service."),
        ]),
      ]),
      div(1, "La tarification et la facturation", [
        div(2, "Les tarifs", [
          art("Fixation des tarifs", "Les tarifs du service sont fixés chaque année par le conseil municipal. Ils distinguent le tarif de droit commun du tarif réduit, dont l'attribution tient compte du quotient familial."),
          art("Tarif réduit", "Le tarif réduit est accordé sur présentation de l'attestation de quotient familial de la Caisse d'allocations familiales ou, à défaut, des justificatifs de ressources de la famille."),
        ]),
        div(2, "La facturation et le recouvrement", [
          art("Facturation", "La facturation est mensuelle et établie à terme échu, sur la base des repas effectivement pris par l'élève."),
          art("Absences", "Toute absence de plus de deux jours consécutifs est signalée au service. Un repas non annulé au moins quarante-huit heures à l'avance reste dû."),
          art("Impayés", "En cas d'impayé persistant, le maire adresse au représentant légal une mise en demeure. À défaut de régularisation, l'élève peut être suspendu de l'accès au service sur décision du maire, sans préjudice du recouvrement de la créance."),
        ]),
      ]),
      div(1, "La sécurité, l'hygiène et la protection des données", [
        div(2, "La sécurité alimentaire", [
          art("Contrôle sanitaire", "Les services de contrôle de l'État ont libre accès aux locaux de restauration et aux documents de traçabilité. Les prélèvements et analyses ordonnés dans ce cadre sont conservés au dossier."),
          art("Traitement des incidents", "Tout incident — intoxication suspectée, corps étranger, rupture de la chaîne du froid — est déclaré le jour même au service de l'éducation, qui en informe le maire et les autorités sanitaires."),
        ]),
        div(2, "Les données personnelles", [
          art("Données collectées", "Les données des élèves et de leurs représentants sont collectées pour la seule gestion du service : inscription, facturation, suivi des régimes particuliers. Elles ne sont communiquées qu'aux personnes habilitées."),
          art("Conservation", "Les données sont conservées pendant la durée de la scolarité et, pour les pièces de facturation, pendant la durée légale de conservation des pièces comptables."),
        ]),
      ]),
    ],
  });
}

// Le TABLEAU des tarifs, adopté lui aussi par une délibération : une annexe faite
// d'une grille, comme il s'en pratique pour tous les tarifs municipaux d'un
// exercice. Le tableau est un bloc du document (voir NODE_TYPES › « table »).
function grilleTarifaireTrame() {
  return newTrame({
    id: "tpl-grille-tarifaire",
    name: "Grille tarifaire (annexe)",
    version: "26.17",
    familyId: "fam-finances",
    actTypeId: "deliberation",
    status: "published",
    nature: "annexe",
    serviceId: "svc-finances",
    bureauId: "bur-fin-budget",
    owner: "Finances et commande publique",
    description: "Le tableau des tarifs municipaux de l'exercice, adopté par une délibération : il suit l'acte qui l'adopte.",
    fields: [
      ...commonHeader([])
        .filter((f) => f.type !== "signataire" && f.id !== "numero")
        .map((f) => (f.id === "dateSignature" ? { ...f, label: "Date d'adoption", help: "La date de la délibération qui adopte la grille." } : f)),
      newField({ id: "intitule", label: "Intitulé de la grille", type: "text", group: "Identification", help: "Ex. « Grille tarifaire des services municipaux — exercice 2026-2027 »." }),
    ],
    rules: [
      newRule({ id: "r-grille-1", level: "warning", expr: "exists(intitule)", message: "Sans intitulé, la grille ne peut pas être nommée dans la liste des annexes.", author: "Finances et commande publique", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "{{intitule}}" }),
      newNode("authority", { text: "{{entity.authorityFormula}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visa("ref-delib-tarifs")] }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [
          newNode("para", { text: "Les tarifs des services municipaux applicables à compter du 1er septembre 2026 sont fixés conformément au tableau ci-après." }),
          newNode("table", {
            caption: "{{intitule}}",
            layout: "rows",
            align: "left",
            columns: ["Prestation", "Tarif — Valmontois", "Tarif — hors commune"],
            rows: [
              ["Restauration scolaire — repas", "3,90 €", "7,20 €"],
              ["Accueil périscolaire du matin", "1,50 €", "3,00 €"],
              ["Accueil périscolaire du soir", "2,20 €", "4,40 €"],
              ["Accueil de loisirs sans hébergement — journée", "8,50 €", "16,00 €"],
              ["Cantine des personnels municipaux — repas", "6,30 €", "—"],
              ["Location de la salle des fêtes — week-end", "180,00 €", "330,00 €"],
              ["Location du barnum communal — journée", "45,00 €", "90,00 €"],
              ["Droit de place au marché — mètre linéaire et par jour", "2,40 €", "2,40 €"],
              ["Concession funéraire quinzennaire — case de deux places", "420,00 €", "—"],
              ["Reproduction de documents d'urbanisme — par page A3", "1,20 €", "1,20 €"],
            ],
          }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Entrée en vigueur",
        blocks: [newNode("para", { text: "La présente grille prend effet le 1er septembre 2026. Elle s'applique jusqu'au 31 août 2027." })],
      }),
      newNode("mention", { mentionId: "men-publication" }),
    ],
  });
}

// Le document JOINT, au cas par cas : un plan de circulation, un programme, un
// plan de sécurité, une liste d'emplacements. C'est l'annexe fourre-tout de la
// démonstration — trois paragraphes, pour que le texte ait de la place, et trois
// champs vides qui n'impriment rien.
function annexeTrame() {
  return newTrame({
    id: "tpl-annexe-joint",
    name: "Annexe — document joint à un acte",
    version: "26.18",
    familyId: "fam-organisation",
    actTypeId: "arrete",
    status: "published",
    nature: "annexe",
    serviceId: "svc-sg",
    bureauId: "bur-sg-assemblees",
    owner: "Secrétariat général",
    description: "Annexe générique : un document joint à un acte (plan de circulation, programme, plan de sécurité, liste). Son texte suit l'acte qui l'adopte.",
    fields: [
      ...commonHeader([])
        .filter((f) => f.type !== "signataire" && f.id !== "numero")
        .map((f) => (f.id === "dateSignature" ? { ...f, label: "Date d'adoption", help: "La date de l'acte auquel le document est annexé." } : f)),
      newField({ id: "intitule", label: "Intitulé du document", type: "text", group: "Identification", help: "Ex. « Plan de circulation et de stationnement ». L'intitulé paraît seul sur une page." }),
      newField({ id: "chapeau", label: "Chapeau", type: "textarea", required: false, group: "Contenu" }),
      newField({ id: "partie1", label: "Texte — première partie", type: "textarea", required: false, group: "Contenu" }),
      newField({ id: "partie2", label: "Texte — deuxième partie", type: "textarea", required: false, group: "Contenu", help: "Vide : le paragraphe n'est pas imprimé." }),
      newField({ id: "partie3", label: "Texte — troisième partie", type: "textarea", required: false, group: "Contenu", help: "Vide : le paragraphe n'est pas imprimé." }),
    ],
    rules: [
      newRule({ id: "r-annexe-1", level: "blocking", expr: "exists(intitule)", message: "L'intitulé du document est obligatoire : c'est lui qui l'annonce dans la liste des annexes.", author: "Secrétariat général", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "{{intitule}}" }),
      newNode("para", { text: "{{chapeau}}", when: "exists(chapeau)" }),
      newNode("para", { text: "{{partie1}}", when: "exists(partie1)" }),
      newNode("para", { text: "{{partie2}}", when: "exists(partie2)" }),
      newNode("para", { text: "{{partie3}}", when: "exists(partie3)" }),
      newNode("mention", { mentionId: "men-publication" }),
    ],
  });
}

// La CONVENTION : le document par lequel la commune s'engage avec un autre. Sa
// structure n'est pas celle d'un acte unilatéral — « entre … et …, il a été
// convenu ce qui suit » — mais l'application la traite comme un acte : elle est
// rédigée, signée, publiée et citée au recueil comme les autres.
function conventionTrame() {
  return newTrame({
    id: "tpl-convention",
    name: "Convention — coopération, partenariat et jumelage",
    version: "26.19",
    familyId: "fam-vie-locale",
    actTypeId: "convention",
    status: "published",
    owner: "Culture, fêtes et vie associative",
    serviceId: "svc-culture",
    bureauId: "bur-cul-associations",
    description: "Convention entre la commune et un partenaire : objets de coopération, engagements réciproques, durée, suivi.",
    fields: commonHeader([
      newField({ id: "partenaire", label: "Partie signataire", type: "text", group: "Objet de l'acte", help: "Ex. « la commune de Saint-Aubin-sur-Rive »." }),
      newField({ id: "objetConvention", label: "Objet de la convention", type: "text", group: "Objet de l'acte", help: "Formule complète : elle suit « portant »." }),
      newField({
        id: "domaines", label: "Domaines de coopération", type: "multichoice", group: "Dispositif",
        options: ["echanges-scolaires", "manifestations-culturelles", "vie-associative", "sport", "patrimoine", "cooperation-technique"],
        help: "Chaque domaine retenu ajoute l'engagement correspondant à la convention.",
      }),
      newField({ id: "duree", label: "Durée", type: "text", group: "Dispositif", required: false, help: "Ex. « cinq ans à compter de sa signature »." }),
      newField({ id: "contribution", label: "Contribution financière de la commune", type: "money", group: "Dispositif", required: false }),
      newField({ id: "renouvellement", label: "Renouvellement", type: "choice", group: "Dispositif", required: false, options: ["tacite", "express"] }),
    ], { fonction: "role:maire" }),
    rules: [
      newRule({ id: "r-convention-1", level: "blocking", expr: "exists(partenaire) && exists(objetConvention)", message: "La partie signataire et l'objet de la convention sont obligatoires.", author: "Culture, fêtes et vie associative", date: "2026-05-01" }),
      newRule({ id: "r-convention-2", level: "warning", expr: "count(domaines) > 0", message: "Aucun domaine de coopération n'est retenu : la convention n'a pas d'engagement.", author: "Culture, fêtes et vie associative", date: "2026-05-01" }),
      newRule({ id: "r-convention-3", level: "warning", expr: "!exists(contribution) || contribution <= 50000", message: "Au-delà de 50 000 €, la convention relève d'une délibération préalable de l'assemblée.", author: "Culture, fêtes et vie associative", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "Convention n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{entity.authorityFormula}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visa("ref-delib-festivites"), visaChaine()] }),
      newNode("considerants"),
      newNode("para", { text: "Entre {{entity.nameWithArt}}, représentée par son maire, d'une part, et {{partenaire}}, d'autre part, il a été convenu ce qui suit :" }),
      newNode("enact", { text: "IL A ÉTÉ CONVENU CE QUI SUIT" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "Objet",
        blocks: [newNode("para", { text: "La présente convention a pour objet {{objetConvention}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Engagements réciproques",
        blocks: [newNode("list", {
          items: [
            { id: "e1", text: "organiser chaque année des échanges entre les écoles des deux communes ;", when: "contains(domaines, 'echanges-scolaires')" },
            { id: "e2", text: "se tenir mutuellement informées de leurs manifestations culturelles et y associer leurs habitants ;", when: "contains(domaines, 'manifestations-culturelles')" },
            { id: "e3", text: "faciliter les rencontres entre les associations locales et la circulation de leurs initiatives ;", when: "contains(domaines, 'vie-associative')" },
            { id: "e4", text: "soutenir les rencontres sportives entre les clubs et les écoles des deux communes ;", when: "contains(domaines, 'sport')" },
            { id: "e5", text: "coopérer à la connaissance et à la mise en valeur de leur patrimoine ;", when: "contains(domaines, 'patrimoine')" },
            { id: "e6", text: "échanger leurs bonnes pratiques et leurs agents sur les sujets d'intérêt commun.", when: "contains(domaines, 'cooperation-technique')" },
          ],
        })],
        notes: [
          newNote({ kind: "instruction", author: "Culture, fêtes et vie associative", text: "Les engagements retenus seront suivis par le comité prévu à l'article du suivi : tenir la liste à jour, elle sert de programme de travail." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Suivi de la convention",
        blocks: [newNode("para", { text: "Un comité de suivi, composé de représentants de chacune des parties, se réunit au moins une fois par an pour dresser le bilan des actions conduites et arrêter celles de l'année à venir." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Contribution financière",
        when: "exists(contribution)",
        blocks: [newNode("para", { text: "La commune prend à sa charge les frais de sa participation à hauteur de {{contribution|money}}, imputés sur son budget de fonctionnement.", when: "exists(contribution)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Durée, révision et résiliation",
        blocks: [
          newNode("para", { text: "La convention est conclue {{duree ? \"pour une durée de \" + duree : \"pour une durée de trois ans à compter de sa signature\"}}. Elle peut être révisée par avenant signé des deux parties." }),
          newNode("para", { text: "Elle est renouvelable {{renouvellement == 'express' ? \"par accord exprès des parties\" : \"par tacite reconduction pour une durée égale\"}} et peut être résiliée à tout moment par l'une des parties, avec un préavis de trois mois notifié par écrit." }),
        ],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      newNode("mention", { mentionId: "men-publication" }),
    ],
  });
}

// L'AVENANT : la vie d'un marché après sa signature. La trame conduit la
// décision qui le conclut, selon la nature de l'avenant — prolongation,
// modification technique ou variation du montant.
function avenantTrame() {
  return newTrame({
    id: "tpl-avenant",
    name: "Décision — avenant à un marché public",
    version: "26.20",
    familyId: "fam-marches",
    actTypeId: "decision",
    status: "published",
    owner: "Finances et commande publique",
    serviceId: "svc-finances",
    bureauId: "bur-fin-marches",
    description: "Avenant à un marché en cours : prolongation de délai, modification technique ou variation du montant.",
    fields: commonHeader([
      newField({ id: "marche", label: "Marché concerné", type: "ref", group: "Objet de l'acte", help: "Le marché visé au référentiel ; son intitulé complet est repris au visa." }),
      newField({ id: "titulaire", label: "Titulaire", type: "text", group: "Objet de l'acte" }),
      newField({ id: "objetAvenant", label: "Objet de l'avenant", type: "text", group: "Objet de l'acte", help: "Formule complète : elle suit « l'avenant » dans l'article 1er." }),
      newField({ id: "natureAvenant", label: "Nature de l'avenant", type: "choice", group: "Objet de l'acte", options: ["prolongation", "modification-technique", "variation-montant"] }),
      newField({ id: "montantAvenant", label: "Montant de l'avenant (HT)", type: "money", group: "Dispositif", required: false }),
      newField({ id: "nouveauMontant", label: "Nouveau montant du marché (HT)", type: "money", group: "Dispositif", required: false }),
      newField({ id: "prolongation", label: "Prolongation du délai", type: "text", group: "Dispositif", required: false, help: "Ex. « trois mois à compter de la date d'achèvement contractuelle »." }),
    ]),
    rules: [
      newRule({ id: "r-avenant-1", level: "blocking", expr: "exists(titulaire) && exists(objetAvenant) && exists(natureAvenant)", message: "Le titulaire, l'objet et la nature de l'avenant sont obligatoires.", author: "Finances et commande publique", date: "2026-05-01" }),
      newRule({ id: "r-avenant-2", level: "warning", expr: "!exists(montantAvenant) || !exists(nouveauMontant) || nouveauMontant >= montantAvenant", message: "Le nouveau montant du marché ne peut pas être inférieur au montant de l'avenant : vérifier les montants.", author: "Finances et commande publique", date: "2026-05-01" }),
      newRule({ id: "r-avenant-3", level: "warning", expr: "natureAvenant != 'prolongation' || exists(prolongation)", message: "Un avenant de prolongation doit dire la durée qu'il ajoute.", ref: "code de la commande publique", author: "Finances et commande publique", date: "2026-05-01" }),
      newRule({ id: "r-avenant-4", level: "warning", expr: "!exists(montantAvenant) || montantAvenant <= 200000", message: "Une variation de cette ampleur peut bouleverser l'économie du marché : vérifier le seuil.", ref: "code de la commande publique", author: "Finances et commande publique", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "Décision n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{entity.authorityFormula}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visa("ref-ccp"), visa("ref-marche-voirie"), visaChaine()] }),
      newNode("considerants"),
      newNode("enact", { text: "DÉCIDE" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", {
          text: "Est approuvé l'avenant au marché portant {{marche}} conclu avec {{titulaire}}, ayant pour objet {{objetAvenant}}.",
        })],
        notes: [
          newNote({ kind: "instruction", author: "Finances et commande publique", text: "Vérifier que la modification ne bouleverse pas l'économie du marché : au-delà, une nouvelle procédure est nécessaire." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Montants",
        when: "exists(montantAvenant) || exists(nouveauMontant)",
        blocks: [
          newNode("para", { text: "Le montant de l'avenant est de {{montantAvenant|money}} hors taxes.", when: "exists(montantAvenant)" }),
          newNode("para", { text: "Le montant du marché, avenant compris, est porté à {{nouveauMontant|money}} hors taxes.", when: "exists(nouveauMontant)" }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Délai d'exécution",
        when: "exists(prolongation)",
        blocks: [newNode("para", { text: "Le délai d'exécution du marché est prolongé de {{prolongation}}.", when: "exists(prolongation)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Effets et exécution",
        blocks: [
          newNode("para", { text: "Les autres clauses du marché demeurent inchangées. La présente décision prend effet à compter de sa notification au titulaire." }),
          newNode("para", { text: "Le directeur général des services de {{entity.nameWithArt}} est chargé de l'exécution de la présente décision." }),
        ],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      newNode("mention", { mentionId: "men-recours" }),
      newNode("mention", { mentionId: "men-publication" }),
    ],
  });
}

// L'ENGAGEMENT DE DÉPENSE : l'achat courant, la dépense de fonctionnement que la
// collectivité engage et impute. C'est le plus modeste des actes financiers, et
// l'un des plus nombreux.
function achatTrame() {
  return newTrame({
    id: "tpl-decision-achat",
    name: "Décision — engagement d'une dépense",
    version: "26.21",
    familyId: "fam-finances",
    actTypeId: "decision",
    status: "published",
    owner: "Finances et commande publique",
    serviceId: "svc-finances",
    bureauId: "bur-fin-budget",
    description: "Engagement d'une dépense d'achat courant : fournisseur, objet, montant et imputation budgétaire.",
    fields: commonHeader([
      newField({ id: "fournisseur", label: "Fournisseur", type: "text", group: "Objet de l'acte" }),
      newField({ id: "objetAchat", label: "Objet de l'achat", type: "text", group: "Objet de l'acte", help: "Formule complète : elle suit « pour » dans l'article 1er." }),
      newField({ id: "montant", label: "Montant (HT)", type: "money", group: "Objet de l'acte" }),
      newField({ id: "imputation", label: "Imputation budgétaire", type: "text", group: "Objet de l'acte", help: "Chapitre et ligne, ex. « 60623 — alimentation »." }),
      newField({ id: "procedure", label: "Procédure", type: "choice", group: "Objet de l'acte", options: ["achat-direct", "bon-de-commande", "mapa"] }),
    ]),
    rules: [
      newRule({ id: "r-achat-1", level: "blocking", expr: "exists(fournisseur) && exists(objetAchat) && exists(montant)", message: "Le fournisseur, l'objet et le montant de l'achat sont obligatoires.", author: "Finances et commande publique", date: "2026-05-01" }),
      newRule({ id: "r-achat-2", level: "warning", expr: "montant <= 40000", message: "Au-delà de 40 000 €, une procédure formalisée est nécessaire : vérifier le classement de l'achat.", ref: "code de la commande publique", author: "Finances et commande publique", date: "2026-05-01" }),
      newRule({ id: "r-achat-3", level: "blocking", expr: "exists(imputation)", message: "L'imputation budgétaire est obligatoire : sans elle, la dépense ne peut pas être mandatée.", author: "Finances et commande publique", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "Décision n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{entity.authorityFormula}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visa("ref-decret-gbcp"), visa("ref-delib-budget"), visaChaine()] }),
      newNode("considerants"),
      newNode("enact", { text: "DÉCIDE" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", { text: "Est engagée une dépense de {{montant|money}} hors taxes auprès de {{fournisseur}}, pour {{objetAchat}}." })],
        notes: [
          newNote({ kind: "instruction", author: "Finances et commande publique", text: "Vérifier que le crédit est disponible sur la ligne d'imputation avant l'engagement, et que le fournisseur a produit ses pièces (attestation de vigilance, extrait d'immatriculation)." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Imputation",
        blocks: [newNode("para", { text: "La dépense est imputée sur le budget de {{entity.nameWithArt}}, à la ligne « {{imputation}} »." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général des services de {{entity.nameWithArt}} est chargé de l'exécution de la présente décision et de la liquidation de la dépense." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      newNode("mention", { mentionId: "men-recours" }),
      newNode("mention", { mentionId: "men-publication" }),
    ],
  });
}

// L'OCCUPATION DU DOMAINE PUBLIC : la terrasse du café, l'emprise du chantier,
// l'étalage du marché. L'acte autorise, fixe l'emplacement, la durée et la
// redevance.
function occupationTrame() {
  return newTrame({
    id: "tpl-occupation",
    name: "Arrêté — occupation temporaire du domaine public",
    version: "26.22",
    familyId: "fam-domaine-public",
    actTypeId: "arrete",
    status: "published",
    owner: "Aménagement et urbanisme",
    serviceId: "svc-urb",
    bureauId: "bur-urb-voirie",
    description: "Autorisation d'occuper le domaine public : terrasse, étalage, emprise de chantier, mobilier. L'acte fixe l'emplacement, la durée et la redevance.",
    fields: commonHeader([
      newField({ id: "beneficiaire", label: "Bénéficiaire", type: "text", group: "Objet de l'acte", help: "La personne ou l'entreprise autorisée." }),
      newField({ id: "natureOccupation", label: "Nature de l'occupation", type: "choice", group: "Objet de l'acte", options: ["terrasse", "etalage", "chantier", "mobilier", "manifestation"] }),
      newField({ id: "emplacement", label: "Emplacement", type: "text", group: "Objet de l'acte", help: "Formule introduite par une préposition : « sur la place du Marché, devant le n° 12 »." }),
      newField({ id: "superficie", label: "Superficie occupée (m²)", type: "money", required: false, group: "Objet de l'acte" }),
      newField({ id: "dateDebut", label: "Début de l'occupation", type: "date", group: "Objet de l'acte" }),
      newField({ id: "dateFin", label: "Fin de l'occupation", type: "date", required: false, group: "Objet de l'acte" }),
      newField({ id: "redevance", label: "Redevance annuelle", type: "money", required: false, group: "Dispositif" }),
      newField({ id: "conditions", label: "Conditions particulières", type: "textarea", required: false, group: "Dispositif" }),
    ], { fonction: "role:maire" }),
    rules: [
      newRule({ id: "r-occupation-1", level: "blocking", expr: "exists(beneficiaire) && exists(emplacement) && exists(dateDebut)", message: "Le bénéficiaire, l'emplacement et la date de début sont obligatoires.", author: "Aménagement et urbanisme", date: "2026-05-01" }),
      newRule({ id: "r-occupation-2", level: "blocking", expr: "!exists(dateFin) || diff_days(dateFin, dateDebut) >= 0", message: "La fin de l'occupation ne peut pas précéder son début.", author: "Aménagement et urbanisme", date: "2026-05-01" }),
      newRule({ id: "r-occupation-3", level: "warning", expr: "!exists(superficie) || superficie <= 50", message: "Au-delà de 50 m², l'occupation peut relever d'une autorisation d'urbanisme : vérifier le dossier.", author: "Aménagement et urbanisme", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "Arrêté n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{entity.authorityFormula}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visa("ref-cg3p"), visa("ref-ri-conseil"), visaChaine()] }),
      newNode("considerants"),
      newNode("enact", { text: "ARRÊTE" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", {
          text: "{{beneficiaire}} est autorisé(e) à occuper le domaine public {{emplacement}}, pour {{natureOccupation == 'terrasse' ? \"l'installation d'une terrasse\" : (natureOccupation == 'etalage' ? \"l'installation d'un étalage\" : (natureOccupation == 'chantier' ? \"l'emprise d'un chantier\" : (natureOccupation == 'mobilier' ? \"l'installation d'un mobilier\" : \"l'organisation d'une manifestation\")))}}{{superficie ? ', sur une superficie de ' + superficie + ' m²' : ''}}.",
        })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Durée",
        blocks: [newNode("para", { text: "L'autorisation est accordée du {{dateDebut|date-long}}{{dateFin ? \" au \" + dateFin : \" jusqu'à son retrait\"}}." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Redevance",
        when: "exists(redevance)",
        blocks: [newNode("para", { text: "L'occupation donne lieu au paiement d'une redevance annuelle de {{redevance|money}}, exigible d'avance.", when: "exists(redevance)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Conditions particulières",
        when: "exists(conditions)",
        blocks: [newNode("para", { text: "{{conditions}}", when: "exists(conditions)" })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Obligations du bénéficiaire",
        blocks: [newNode("list", {
          items: [
            { id: "b1", text: "maintenir libre un passage d'au moins 1,40 mètre pour les piétons et ne rien entreposer sur la chaussée ;", when: "" },
            { id: "b2", text: "respecter l'aspect et l'implantation autorisés, ainsi que les prescriptions d'accessibilité ;", when: "" },
            { id: "b3", text: "remettre les lieux en leur état primitif à la fin de l'autorisation, à ses frais.", when: "" },
          ],
        })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général des services de {{entity.nameWithArt}} est chargé de l'exécution du présent arrêté, qui vaut titre d'occupation du domaine public." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      newNode("mention", { mentionId: "men-recours" }),
      newNode("mention", { mentionId: "men-publication" }),
    ],
  });
}

// LA CONCESSION FUNÉRAIRE : un acte d'état civil et de gestion du cimetière,
// comme une commune en signe chaque semaine.
function concessionTrame() {
  return newTrame({
    id: "tpl-concession",
    name: "Décision — concession funéraire",
    version: "26.23",
    familyId: "fam-etat-civil",
    actTypeId: "decision",
    status: "published",
    owner: "Accueil de la mairie",
    serviceId: "svc-accueil",
    bureauId: "bur-acc-physique",
    description: "Délivrance d'une concession funéraire dans le cimetière communal : emplacement, type, durée et tarif acquitté.",
    fields: commonHeader([
      newField({ id: "concessionnaire", label: "Concessionnaire", type: "person", group: "Objet de l'acte" }),
      newField({ id: "emplacement", label: "Emplacement", type: "text", group: "Objet de l'acte", help: "Ex. « carré C, rangée 4, case 12 »." }),
      newField({ id: "typeConcession", label: "Type de concession", type: "choice", group: "Objet de l'acte", options: ["pleine-terre", "caveau", "columbarium"] }),
      newField({ id: "dureeConcession", label: "Durée de la concession", type: "choice", group: "Objet de l'acte", options: ["cinq-ans", "quinze-ans", "trente-ans", "cinquante-ans"] }),
      newField({ id: "montant", label: "Montant acquitté", type: "money", group: "Objet de l'acte" }),
    ]),
    rules: [
      newRule({ id: "r-concession-1", level: "blocking", expr: "exists(concessionnaire) && exists(emplacement) && exists(montant)", message: "Le concessionnaire, l'emplacement et le montant acquitté sont obligatoires.", author: "Accueil de la mairie", date: "2026-05-01" }),
      newRule({ id: "r-concession-2", level: "warning", expr: "typeConcession != 'columbarium' || dureeConcession != 'cinquante-ans'", message: "La durée de cinquante ans est réservée aux concessions de plein droit ; vérifier la durée applicable au columbarium.", ref: "code général des collectivités territoriales", author: "Accueil de la mairie", date: "2026-05-01" }),
    ],
    body: [
      newNode("title", { text: "Décision n°{{numero}} du {{dateSignature|date-long}} portant {{objet}}" }),
      newNode("authority", { text: "{{entity.authorityFormula}}" }),
      newNode("visas", { items: [visa("ref-cgct"), visaChaine()] }),
      newNode("considerants"),
      newNode("enact", { text: "DÉCIDE" }),
      newNode("article", {
        numMode: "auto", num: "1er", heading: "",
        blocks: [newNode("para", {
          text: "Il est délivré à {{concessionnaire.civility}} {{concessionnaire.firstName}} {{concessionnaire.lastName}} une concession {{typeConcession == 'caveau' ? 'de caveau' : (typeConcession == 'columbarium' ? 'de columbarium' : 'de pleine terre')}} portant sur l'emplacement {{emplacement}} du cimetière communal, pour une durée de {{dureeConcession == 'cinq-ans' ? 'cinq ans' : (dureeConcession == 'quinze-ans' ? 'quinze ans' : (dureeConcession == 'trente-ans' ? 'trente ans' : 'cinquante ans'))}}.",
        })],
        notes: [
          newNote({ kind: "instruction", author: "Accueil de la mairie", text: "Vérifier que l'emplacement est libre au registre du cimetière, et que le montant de la concession a bien été encaissé avant la délivrance du titre." }),
        ],
      }),
      newNode("article", {
        numMode: "auto", heading: "Redevance",
        blocks: [newNode("para", { text: "Le concessionnaire a acquitté la somme de {{montant|money}} au titre de la concession. Le renouvellement pourra être sollicité dans l'année précédant son expiration." })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Obligations du concessionnaire",
        blocks: [newNode("list", {
          items: [
            { id: "c1", text: "entretenir l'emplacement et les constructions qui y sont édifiées, et le maintenir en bon état de propreté ;", when: "" },
            { id: "c2", text: "faire connaître au service de l'état civil tout changement d'adresse ou de titulaire ;", when: "" },
            { id: "c3", text: "respecter le règlement intérieur du cimetière et les prescriptions de l'autorité municipale.", when: "" },
          ],
        })],
      }),
      newNode("article", {
        numMode: "auto", heading: "Exécution",
        blocks: [newNode("para", { text: "Le directeur général des services de {{entity.nameWithArt}} est chargé de l'exécution de la présente décision." })],
      }),
      newNode("signature", { place: "{{entity.seatCity}}" }),
      newNode("mention", { mentionId: "men-recours" }),
      newNode("mention", { mentionId: "men-publication" }),
    ],
  });
}
