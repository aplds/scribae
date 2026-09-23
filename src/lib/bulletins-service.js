// ============================================================================
// Le Bulletin, vu du navigateur : ce que le SERVICE en dit, et les gestes qu'on
// lui demande.
//
// Le service tient tout — les périodes, les numéros, les abonnés, la file
// d'envoi, le courriel (voir src/server/mysql/bulletins.mjs). L'application ne
// calcule rien et ne décide de rien : elle interroge, elle affiche, elle
// demande. C'est la règle du recueil lui-même — le service est la seule voix
// juste, et deux calculs parallèles finiraient par diverger.
//
// Deux lectures, deux portées :
//   • l'ÉTAT PUBLIC (`GET /v1/bulletins`) — ce que voit un lecteur : la cadence,
//     la prochaine parution, les numéros parus, l'ouverture de l'abonnement ;
//   • le TABLEAU DE BORD (`GET /v1/bulletins/administration/tableau`) — l'état
//     vu de l'administration : réglages effectifs, abonnés, file, envois, SMTP.
//
// Un service absent (mode local, aperçu hors ligne) n'est pas une erreur : le
// module le DIT (`etat.disponible === false`) et les écrans s'en passent, plutôt
// que d'afficher un tableau vide qui passerait pour un bulletin sans numéro.
// ============================================================================
import { get, post, bodyOf, errorMessage } from "./remote.js";
import { sessionDeService } from "./auth.js";
import { cleService } from "./cle-service.js";

// Le jeton d'un geste d'ADMINISTRATION : la clé d'écriture du poste, sauf quand
// une SESSION ouvre le droit (déploiement en mode « mot de passe » ou annuaire) —
// auquel cas l'identité voyage dans le cookie, et un jeton d'API n'a rien à y
// faire (voir src/lib/db/index.js, même règle). Les lectures PUBLIQUES, elles,
// n'en portent jamais : un lecteur du recueil n'a pas de clé.
const jetonAdmin = () => (sessionDeService() ? null : (cleService() || null));

export const etat = {
  disponible: false,      // le service a-t-il répondu ?
  publicEtat: null,       // GET /v1/bulletins
  tableau: null,          // GET /v1/bulletins/administration/tableau
  erreur: "",             // le dernier refus, en clair
  motif: "",              // pourquoi il n'y a pas d'état (service muet, mode local)
};

const listeners = new Set();
export const surBulletins = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const prevenir = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

// L'état PUBLIC du bulletin. `silencieux` évite de crier quand l'écran public
// interroge un service qui ne connaît pas la route (mode local, ancienne
// version du service) : ce n'est pas une panne, c'est une absence.
export async function chargerPublic({ silencieux = false } = {}) {
  try {
    const r = await get("/v1/bulletins", { label: "Bulletin — état public", source: "lecture" });
    if (!r.ok) {
      etat.disponible = false;
      etat.erreur = errorMessage(r);
      if (!silencieux) console.warn("Bulletin : le service a refusé la lecture", etat.erreur);
      return null;
    }
    etat.publicEtat = bodyOf(r);
    etat.disponible = true;
    etat.erreur = "";
    etat.motif = "";
    prevenir();
    return etat.publicEtat;
  } catch (e) {
    if (!silencieux) console.warn("Bulletin : le service n'a pas répondu", e && e.message);
    etat.disponible = false;
    etat.motif = "Le service de données n'a pas répondu.";
    return null;
  }
}

// Le tableau de bord de l'administration. Il demande le rôle « éditeur » : un
// compte qui ne l'a pas reçoit un refus, qu'on rend tel quel.
export async function chargerTableau({ silencieux = false } = {}) {
  try {
    const r = await get("/v1/bulletins/administration/tableau", { token: jetonAdmin(), label: "Bulletin — tableau de bord", source: "lecture" });
    if (!r.ok) {
      etat.erreur = errorMessage(r);
      if (!silencieux) console.warn("Bulletin : tableau de bord refusé", etat.erreur);
      prevenir();
      return null;
    }
    etat.tableau = bodyOf(r);
    etat.disponible = true;
    etat.erreur = "";
    prevenir();
    return etat.tableau;
  } catch (e) {
    if (!silencieux) console.warn("Bulletin : tableau de bord injoignable", e && e.message);
    etat.motif = "Le service de données n'a pas répondu.";
    return null;
  }
}

// Un geste d'administration, puis la relecture du tableau : l'écran ne doit
// jamais montrer l'état d'AVANT le geste qu'on vient de faire.
async function geste(path, corps, libelle) {
  const r = await post(path, corps || {}, { token: jetonAdmin(), label: libelle, source: "application" });
  const body = bodyOf(r);
  if (!r.ok) throw new Error(errorMessage(r) || "Le service a refusé le geste.");
  await chargerTableau({ silencieux: true });
  if (etat.publicEtat) await chargerPublic({ silencieux: true });
  return body;
}

// Composer les numéros échus. `enCours` compose AUSSI la période en cours, à
// titre PROVISOIRE : c'est l'aperçu du numéro qui paraîtra à la clôture.
export const generer = ({ enCours = false } = {}) =>
  geste("/v1/bulletins/administration/generer", { enCours: enCours === true }, enCours ? "Bulletin — composer la période en cours" : "Bulletin — composer les numéros échus");

// Adresser un numéro aux abonnés confirmés, tout de suite.
export const envoyer = (id) => geste("/v1/bulletins/" + encodeURIComponent(id) + "/envoyer", {}, "Bulletin — adresser le numéro");

// Retirer un abonné (le geste d'administration).
export const retirerAbonne = (id) => geste("/v1/bulletins/abonnes/" + encodeURIComponent(id) + "/retirer", {}, "Bulletin — retirer un abonné");

// Les numéros EN ENTIER, par leur identifiant. La page publique en a besoin pour
// composer le FLUX (« ?bulletins=rss ») : un fil porte le contenu de ses
// entrées, et l'état public ne donne que l'abrégé de chaque numéro. Sur un
// déploiement serveur, le flux est un fichier servi par le service : personne ne
// demande jamais ces numéros. Un numéro qui ne répond pas est laissé de côté —
// un fil incomplet vaut mieux qu'un fil vide.
export async function chargerNumeros(ids) {
  const recs = await Promise.all((ids || []).map((id) =>
    get("/v1/bulletins/" + encodeURIComponent(id), { label: "Bulletin " + id, source: "lecture" })
      .then((r) => (r.ok ? bodyOf(r) : null))
      .catch(() => null)));
  return recs.filter(Boolean);
}

// Oublier ce qu'on savait : un redessin d'écran ne doit pas resservir un état
// périmé après un changement de réglage.
export function oublier() {
  etat.publicEtat = null;
  etat.tableau = null;
  etat.erreur = "";
}
