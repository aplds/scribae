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
function controler(appel, reponse) {
  if (!reponse) return "aucune réponse";
  const { status, body } = reponse;
  if (typeof status !== "number") return "réponse sans statut";
  const a = appel.attend || {};
  if (a.statut !== undefined && status !== a.statut) return `statut ${status} au lieu de ${a.statut}`;
  if (a.classe) {
    const famille = status === 0 ? "0" : String(Math.floor(status / 100)) + "xx";
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
    const raison = plantage ? `appel impossible : ${plantage}` : controler(appel, reponse);
    const ligne = { id: appel.id, statut: reponse ? reponse.status : null, code: reponse && reponse.body && reponse.body.code, raison };
    resultats.push(ligne);
    if (raison) echecs.push({ ...ligne, pourquoi: appel.pourquoi });
  }
  return { nom, total: APPELS.length, ok: APPELS.length - echecs.length, echecs, resultats };
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
