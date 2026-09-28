// ============================================================================
// Jeu d'appels COMMUN aux deux implémentations du service — la conformité.
//
// Scribae a DEUX services qui parlent le même contrat : celui de la
// démonstration, embarqué dans la page (`index.html`, `<script
// type="text/x-server-plugin">`), et celui de l'auto-hébergement
// (`src/server/mysql/`, Node + MariaDB). Deux implémentations, deux jeux de
// tests séparés — et rien qui garantisse qu'elles répondent la même chose : une
// route ajoutée d'un côté, un code d'erreur changé de l'autre, et le contrat
// dérive sans que personne ne le voie. C'est l'écart NC-I-010 de l'audit, et
// cette liste est sa réponse.
//
// Chaque appel est décrit ICI une fois, avec ce que le contrat exige — et le
// même jeu s'exécute :
//   • dans un test Node, contre le service de démonstration chargé en mémoire
//     (`tests/conformite-service.test.mjs`) ;
//   • dans le NAVIGATEUR, contre le service que l'application utilise
//     réellement (`tests/parcours.mjs`, transport de `lib/remote.js`) ;
//   • contre une installation auto-hébergée, en lui donnant son adresse
//     (`SCRIBA_CONFORMITE_URL`), pour comparer les deux à la même aune.
//
// Ce que les appels vérifient est le CONTRAT, pas l'implémentation : des
// statuts attendus exacts là où le contrat est net (une ressource inconnue est
// un 404), et une CLASSE de statut là où deux installations peuvent légitimement
// différer (un service non provisionné refuse une écriture en 401 ou 403) —
// mais jamais un 5xx, jamais une route de sécurité ouverte.
// ============================================================================

// Un corps dont la forme est vérifiée : on regarde la CLÉ, pas la valeur (les
// valeurs dépendent du jeu de données de l'installation).
const aCle = (cle) => ({ type: "cle", cle });
const tableau = (cle) => ({ type: "tableau", cle });
const refuse = { type: "classe", classes: ["4xx"] };

export const APPELS = [
  // --------------------------------------------------------- le service vit
  {
    id: "health",
    methode: "GET", chemin: "/v1/health",
    pourquoi: "le service doit se déclarer vivant",
    attend: { statut: 200, corps: aCle("statut") },
  },
  {
    id: "openapi",
    methode: "GET", chemin: "/v1",
    pourquoi: "la description de l'API (OpenAPI) est ouverte",
    attend: { statut: 200, corps: aCle("openapi") },
  },
  {
    id: "auth-etat",
    methode: "GET", chemin: "/v1/auth/etat",
    pourquoi: "l'état de provisionnement et les rôles connus",
    attend: { statut: 200, corps: aCle("roles") },
  },
  {
    id: "config",
    methode: "GET", chemin: "/v1/config",
    pourquoi: "les réglages posés par le déploiement, ET l'état de ce que le service peut mener — le prestataire de signature (`prestataire`) et le coffre de signature interne (`signatureInterne`) : c'est ce que l'application lit au démarrage pour n'offrir que les circuits réellement menables par ce service (une démonstration n'a pas de coffre et doit le dire)",
    attend: { statut: 200, corps: aCle("variables") },
  },

  // ------------------------------------------------- le recueil public lit
  {
    id: "publications",
    methode: "GET", chemin: "/v1/publications",
    pourquoi: "la liste des publications est ouverte, même vide",
    attend: { statut: 200, corps: tableau("publications") },
  },
  {
    id: "publication-inconnue",
    methode: "GET", chemin: "/v1/publications/inconnue-xyz",
    pourquoi: "une publication inconnue est un 404, avec son code",
    attend: { statut: 404, corps: aCle("code") },
  },
  {
    id: "informations",
    methode: "GET", chemin: "/v1/informations",
    pourquoi: "les billets publiés au recueil",
    attend: { statut: 200, corps: tableau("informations") },
  },
  {
    id: "eli-inconnu",
    methode: "GET", chemin: "/v1/eli/inconnu",
    pourquoi: "un identifiant ELI inconnu est un 404",
    attend: { statut: 404 },
  },
  {
    id: "route-inconnue",
    methode: "GET", chemin: "/v1/route-inconnue-xyz",
    pourquoi: "une route inconnue est un 404, jamais une page HTML",
    attend: { statut: 404, corps: aCle("code") },
  },

  // ------------------------------------- dépublication (retrait technique)
  {
    id: "depublication",
    methode: "POST", chemin: "/v1/publications/inconnue-xyz/retrait", corps: { motif: "épreuve de conformité" },
    pourquoi: "l'application peut retirer une publication du recueil : les DEUX services doivent connaître cette route (le refus d'autorisation est légitime, l'ignorance de la route ne l'est pas)",
    attend: { classe: ["4xx"], sansCode: "ressource_inconnue" },
  },

  // ------------------------------- la reprise d'un acte ancien (sans signature)
  {
    id: "publication-reprise",
    methode: "POST", chemin: "/v1/actes/inconnu/publication",
    corps: {
      html: "x", akn: "<akn/>", eliUri: "eli:/fr/reg/1998/042/iam",
      dateDocument: "1998-06-12", datePublication: "1998-06-12",
      kind: "reprise", informative: true, reprise: true,
    },
    pourquoi: "une reprise d'acte ancien se publie SANS signature, à titre informatif : les DEUX services doivent connaître cette route et le drapeau « reprise » (le refus d'un acte inconnu est légitime, l'ignorance de la route ne l'est pas)",
    attend: { classe: ["4xx"], sansCode: "ressource_inconnue" },
  },

  // ---------------------------- la signature INTERNE (le service signe lui-même)
  {
    id: "signature-interne",
    methode: "POST", chemin: "/v1/actes/inconnu/signature",
    corps: { mode: "interne", signataires: [{ nom: "Épreuve de conformité", courriel: "epreuve@exemple.fr" }] },
    pourquoi: "le circuit INTERNE (le SERVICE signe, avec la clé du signataire gardée scellée dans son coffre) est un circuit que les DEUX services doivent connaître : l'auto-hébergé le mène, la démonstration le refuse franchement (409 `signature_interne_indisponible`) — mais tous deux doivent d'abord savoir qu'un acte inconnu est un 404, et l'ignorance de la route n'est jamais légitime",
    attend: { classe: ["4xx"], sansCode: "ressource_inconnue" },
  },

  // --------------------- la signature EXTERNE (l'acte est signé hors de l'application)
  {
    id: "signature-externe",
    methode: "POST", chemin: "/v1/actes/inconnu/signature-externe",
    corps: { signe: { url: "https://exemple.fr/epreuve-signe.pdf", sha256: "0".repeat(64), nom: "epreuve-signe.pdf" } },
    pourquoi: "le circuit EXTERNE (papier ou outil tiers) est un circuit que les DEUX services doivent connaître : le client y dépose la version signée, et c'est le service qui tient l'ordre « version signée → conformité → publié ». Une route manquante d'un côté faisait échouer le client sur ce côté seulement (défaut corrigé en 1.6.2) — l'ignorance de la route n'est jamais légitime",
    attend: { classe: ["4xx"], sansCode: "ressource_inconnue" },
  },
  {
    id: "conformite",
    methode: "POST", chemin: "/v1/actes/inconnu/conformite",
    corps: { certification: { statut: "conforme", parNom: "Épreuve de conformité" } },
    pourquoi: "la certification de conformité de la version signée (circuit externe) est un geste que les DEUX services doivent connaître : sans elle, la publication d'un acte à certification requise est refusée (409 `conformite_non_certifiee`) des deux côtés",
    attend: { classe: ["4xx"], sansCode: "ressource_inconnue" },
  },

  // ------------------------------ les PIÈCES (les fichiers joints à un acte)
  {
    id: "piece-inconnue",
    methode: "GET", chemin: "/v1/pieces/inconnue-xyz",
    pourquoi: "l'adresse d'une pièce est citée par le recueil public — c'est elle qui montre l'original signé d'un acte ancien, ou la version signée d'un acte du circuit externe —, et une pièce inconnue est un 404 avec son code : les DEUX services doivent connaître cette route (l'application y dépose désormais les fichiers quand l'hôte n'offre pas de dépôt — voir src/lib/fichiers.js)",
    attend: { statut: 404, corps: aCle("code") },
  },
  {
    id: "piece-sans-contenu",
    methode: "POST", chemin: "/v1/pieces", corps: { nom: "épreuve de conformité.pdf" },
    pourquoi: "un dépôt de pièce sans son contenu est refusé par la validation (et non ignoré comme une route inconnue) : le corps est délibérément incomplet pour que le refus soit le même que l'appelant soit autorisé ou non",
    attend: { classe: ["4xx"], sansCode: "ressource_inconnue" },
  },

  // ------------------------------------ les frontières d'autorisation
  {
    id: "ecriture-sans-cle",
    methode: "POST", chemin: "/v1/db/collections/presence/sync", corps: { upserts: [], deletes: [] },
    pourquoi: "une écriture sans clé est refusée",
    attend: refuse,
  },
  {
    id: "depot-sans-cle",
    methode: "POST", chemin: "/v1/actes", corps: { objet: "épreuve de conformité" },
    pourquoi: "un dépôt d'acte sans clé est refusé",
    attend: refuse,
  },
  {
    id: "comptes-sans-cle",
    methode: "GET", chemin: "/v1/db/collections/users",
    pourquoi: "la collection des comptes n'est JAMAIS lisible sans autorisation (NC-II-003)",
    attend: { classe: ["4xx"] },
  },
];

// Le contrôle d'une réponse contre ce que l'appel attend. Rend "" si tout va
// bien, ou la raison du refus — en français, pour être lisible au journal.
//
// UN STATUT 0 N'EST PAS UNE RÉPONSE. Il dit que le service n'a pas parlé du tout
// — canal fermé, service suspendu : l'aperçu de l'éditeur met le sien en
// quarantaine sous une salve trop dense (NC-II-012), et un service éteint ne
// répond rien non plus. Le contrat n'est alors pas ENFREINT, il n'est pas JUGÉ :
// `controler` ne voit pas ces réponses-là, `verifier` les compte à part
// (`injoignable`) et les tient hors des échecs. C'est à l'appelant de conclure
// « sans objet » — et non d'accuser le dépôt pour un hôte qui s'est tu.
function controler(appel, reponse) {
  if (!reponse) return "aucune réponse";
  const { status, body } = reponse;
  if (typeof status !== "number") return "réponse sans statut";
  const a = appel.attend || {};
  if (a.statut !== undefined && status !== a.statut) return `statut ${status} au lieu de ${a.statut}`;
  if (a.classe) {
    const famille = String(Math.floor(status / 100)) + "xx";
    if (!a.classe.includes(famille)) return `statut ${status} hors de ${a.classe.join("/")}`;
  }
  if (a.sansCode && body && body.code === a.sansCode) return `la route n'existe pas côté service (${a.sansCode})`;
  if (a.corps) {
    const c = body;
    if (!c || typeof c !== "object") return "corps absent ou illisible";
    if (a.corps.type === "cle") { if (c[a.corps.cle] === undefined) return `le corps ne porte pas « ${a.corps.cle} »`; }
    if (a.corps.type === "tableau") { if (!Array.isArray(c[a.corps.cle])) return `« ${a.corps.cle} » n'est pas un tableau`; }
  }
  // Un 5xx est toujours une non-conformité : aucune route du contrat ne doit
  // « planter » sur une entrée quelconque.
  if (status >= 500) return `erreur interne (${status})`;
  return "";
}

// Exécute le jeu d'appels sur un transport donné.
//   `appeler(methode, chemin, corps)` → `{ status, body }`
export async function verifier(appeler, { nom = "service" } = {}) {
  const echecs = [];
  const resultats = [];
  for (const appel of APPELS) {
    let reponse = null;
    let plantage = "";
    try {
      reponse = await appeler(appel.methode, appel.chemin, appel.corps);
    } catch (e) {
      plantage = String((e && e.message) || e);
    }
    // Le service n'a pas répondu (statut 0) : rien à juger, et ce n'est pas un
    // écart de contrat — voir l'en-tête de `controler`. On le tient hors des
    // échecs et on le compte, pour que l'appelant puisse dire « sans objet ».
    const injoignable = !plantage && !!reponse && reponse.status === 0;
    const raison = injoignable ? "" : (plantage ? `appel impossible : ${plantage}` : controler(appel, reponse));
    const ligne = { id: appel.id, statut: reponse ? reponse.status : null, code: reponse && reponse.body && reponse.body.code, raison, injoignable };
    resultats.push(ligne);
    if (raison) echecs.push({ ...ligne, pourquoi: appel.pourquoi });
  }
  return {
    nom, total: APPELS.length, ok: APPELS.length - echecs.length, echecs, resultats,
    injoignable: resultats.filter((r) => r.injoignable).length,
  };
}

// Ce que deux installations doivent avoir EN COMMUN : le statut de chaque appel
// du contrat, à l'unité près quand le contrat est net. Sert à comparer la
// démonstration et une installation auto-hébergée quand on peut joindre les
// deux (voir `tests/conformite-service.test.mjs`).
export function comparer(a, b) {
  const parId = new Map((b.resultats || []).map((r) => [r.id, r]));
  const ecarts = [];
  for (const r of a.resultats || []) {
    const autre = parId.get(r.id);
    if (!autre) { ecarts.push({ id: r.id, a: r.statut, b: null, raison: "appel absent de la seconde installation" }); continue; }
    // Deux installations peuvent différer sur une CLASSE (le code exact d'un
    // refus dépend du provisionnement), jamais sur un succès ou un 404.
    const meme = r.statut === autre.statut
      || (r.statut >= 400 && autre.statut >= 400 && r.statut < 500 && autre.statut < 500);
    if (!meme) ecarts.push({ id: r.id, a: r.statut, b: autre.statut, raison: "statuts divergents" });
  }
  return ecarts;
}
