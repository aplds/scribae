// ============================================================================
// Amorçage du recueil public (démonstration).
//
// Le recueil public ne montre que ce qui a été RÉELLEMENT publié : il lit le
// service de publication, comme le ferait n'importe quel visiteur. Une
// démonstration neuve n'aurait donc rien à montrer — les actes de démonstration
// sont signés, mais aucun n'est publié.
//
// Ce module fait le geste, une fois, au premier démarrage : les actes que la
// fiction de démonstration déclare publiés (ils portent une constatation de
// publication, avec sa référence de recueil — voir src/lib/demo-actes.js) sont
// publiés par le MÊME chemin que l'écran de signature. Le service attribue
// l'identifiant ELI, l'acte devient « publié » au registre local — les deux
// états restent d'accord, puisqu'ils viennent du même appel.
//
// Trois choses, et pas une de plus :
//   • le SERVICE est provisionné par la démonstration elle-même, une fois
//     (`assurerServiceDemo`) : sans clé, un service neuf est en lecture seule,
//     donc rien ne peut être publié — c'était la cause première du recueil vide ;
//   • les BILLETS de la fiction sont déposés au service (`amorcerInformations`),
//     sans quoi la rubrique Informations n'apparaissait jamais au public ;
//   • les ACTES que la fiction déclare publiés sont publiés par le MÊME chemin
//     que l'écran de signature, et leur fiche complète est gardée sur l'acte.
//
// C'est un amorçage de DÉMONSTRATION, et rien d'autre : il ne s'exécute que sur
// le jeu de démonstration intact, il est idempotent (un acte déjà publié au
// service est seulement repris au registre local), et il est silencieux — un
// service injoignable est repris quelques fois de plus (voir `planifierReprise`)
// avant de laisser le recueil tel quel.
// ============================================================================
import { state, touch, actePubliable, oublierBulletinsRecueil, oublierInformationsRecueil, redrawView } from "./state.js";
import { demoActif } from "../lib/demo.js";
import { get, post, beginFlow, bodyOf } from "../lib/remote.js";
import { publicationSettings } from "../lib/eli.js";
import { cleService } from "../lib/cle-service.js";
import { etatService, provisionnerService } from "../lib/cles-service.js";
import * as db from "../lib/db/index.js";
import { docOfActe } from "./views/modifier.js";
import { publierActeDuSeed } from "./views/signature.js";

let enCours = false;
// Instant où l'amorçage courant a commencé. Un amorçage ne se laisse pas
// interrompre de l'extérieur ; si le service disparaît en cours de route (canal
// fermé, service suspendu), la boucle peut mettre du temps à s'en apercevoir et
// le drapeau resterait levé, interdisant toute nouvelle tentative. Passé ce
// délai, l'amorçage précédent est donc réputé perdu.
let enCoursDepuis = 0;
const DELAI_AMORCAGE = 180000;
// Pause entre deux actes de l'amorçage. Le service est tenu à un budget de
// CALCUL soutenu (de l'ordre de 250 ms par seconde de temps réel) : déposer,
// signer et publier un acte en chaîne en consomme une part, et les enchaîner
// sans respirer épuise le budget — le service finit alors par refuser ses
// gestionnaires. Une pause entre deux actes étale la dépense : l'amorçage prend
// quelques secondes de plus, et aboutit.
const PAUSE_AMORCAGE = 800;
// Ce budget n'existe QUE sur la plateforme. Le service embarqué de l'édition
// statique et le service auto-hébergé (nginx + MySQL) n'ont rien à étaler : les
// faire attendre ne protégeait rien et retardait le recueil public d'une
// trentaine de secondes. La pause est donc celle du service qui la réclame.
const pauseAmorcage = () => (globalThis.__SCRIBA_STATIC__ || globalThis.__SCRIBA_SELF_HOSTED__ ? 0 : PAUSE_AMORCAGE);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------------------ le service
// Une démonstration SE PROVISIONNE ELLE-MÊME son service.
//
// Un service neuf est en LECTURE SEULE tant qu'aucune clé n'y a été déposée, et
// c'est l'administrateur qui pose la première (Administration › Base de
// données). Or une démonstration n'a personne : son recueil public restait donc
// vide, faute de pouvoir publier quoi que ce soit — c'est tout le problème que
// ce module résout, mais il ne pouvait pas le résoudre sans clé.
//
// Le geste d'installation est donc fait ici, une fois, en silence : le service
// reçoit une clé d'administration tirée au hasard par le poste (la clé ne vit
// qu'au poste, comme toute clé d'écriture — voir src/lib/cles-service.js), elle
// est rangée dans les réglages locaux, et l'amorçage peut publier.
//
// Rien de tout cela ne concerne une installation RÉELLE : le commutateur de
// démonstration commande le geste (voir `jeuDeDemonstration`), et une
// installation réelle laisse le provisionnement à son administrateur.
let preparation = null;

async function preparerService() {
  const etat = await etatService().catch(() => ({ ok: false }));
  if (!etat.ok) return false;
  if (etat.provisionne) return true;
  // La clé déjà réglée sur ce poste est REJOUÉE : le service a pu être remis à
  // zéro (l'aperçu de l'éditeur reconstruit son état) alors que le poste garde
  // la clé. En tirer une nouvelle laisserait une clé orpheline dans les
  // réglages, et l'ancienne inutile.
  const res = await provisionnerService({ cle: cleService() || undefined, label: "Démonstration" });
  if (!res.ok) return false;
  await db.setSettings({ token: res.cle }, { silent: true });
  return true;
}

// Le verdict n'est PAS retenu pour toute la session : un service peut être
// provisionné, puis remis à zéro pendant que la page vit (l'aperçu de l'éditeur
// reconstruit son état), et une clé gardée « bonne » ferait échouer en silence
// tout ce qui suit — c'est précisément ce qu'on a vu : des dépôts refusés 403
// « service_non_provisionne » après un provisionnement réussi. On redemande donc
// l'état à chaque amorçage ; l'appel ne coûte rien, et il est dédoublonné tant
// qu'un précédent est en vol.
async function assurerServiceDemo() {
  if (preparation) return preparation;
  preparation = preparerService().finally(() => { preparation = null; });
  return preparation;
}

// Les BILLETS du recueil public : le service les sert par `/v1/informations`,
// mais il ne connaît que ceux qu'on lui a déposés. En régime « service »,
// l'atelier les y écrit lui-même (la collection fait partie de sa base) ; en
// régime LOCAL — celui de la démonstration —, les billets ne quittent pas le
// poste, et le recueil public n'en montrait donc aucun : l'onglet Informations
// restait vide, et sa page absente du pied de page.
//
// La démonstration les dépose donc, comme elle dépose ses actes. Le dépôt n'a
// lieu que si le service en est dépourvu ou en désaccord : comparer avant
// d'écrire évite de réécrire — et de journaliser — à chaque démarrage.
const empreinteBillet = (b) => JSON.stringify(Object.keys(b || {}).sort().map((k) => [k, b[k]]));

async function amorcerInformations({ silencieux = true } = {}) {
  if (!jeuDeDemonstration()) return 0;
  // En régime « service », la collection EST la base de l'atelier : c'est lui
  // qui écrit, et projeter une copie locale par-dessus écraserait son travail.
  if (!db.isLocalMode()) return 0;
  const billets = (state.informations || []).filter((b) => b && b.id);
  if (!billets.length) return 0;
  if (!(await assurerServiceDemo())) return 0;
  const token = cleService();
  if (!token) return 0;
  try {
    const lu = await get("/v1/db/collections/informations", { token, label: "Informations de la démonstration", source: "lecture" });
    if (!lu.ok) return 0;
    const records = bodyOf(lu).records || [];
    const auService = new Map(records.map((r) => [String(r.id), r.payload]));
    const meme = auService.size === billets.length
      && billets.every((b) => auService.has(String(b.id)) && empreinteBillet(auService.get(String(b.id))) === empreinteBillet(b));
    if (meme) return 0;
    const upserts = billets.map((b, i) => ({ id: String(b.id), ord: i, payload: b }));
    const auLocal = new Set(billets.map((b) => String(b.id)));
    const deletes = records.filter((r) => !auLocal.has(String(r.id))).map((r) => ({ id: String(r.id) }));
    // `force` est le geste de REPRISE de données (réservé à l'administration) :
    // c'est bien de cela qu'il s'agit — la copie du service doit dire ce que dit
    // l'atelier, et le service est ici un miroir, non la source.
    const res = await post("/v1/db/collections/informations/sync", { force: true, upserts, deletes }, { token, label: "Dépôt des informations (démonstration)" });
    if (!res.ok) return 0;
    // Le recueil avait pu lire une liste vide : on l'invalide pour qu'il relise.
    // Et on le REDESSINE : l'invalidation seule ne suffisait pas — rien ne
    // relançait la lecture, et la rubrique des informations, oubliée, ne
    // revenait plus jamais (le dépôt, lui, n'a lieu qu'une fois). Voir
    // `oublierInformationsRecueil` (src/ui/state.js) et `rafraichir`
    // (src/ui/views/recueil-public.js), qui réarme les lectures.
    oublierInformationsRecueil();
    redrawView();
    return upserts.length;
  } catch (e) {
    if (!silencieux) console.warn("Dépôt des informations (démonstration) :", e);
    return 0;
  }
}

// REPRISE. Au démarrage, l'amorçage part en même temps que le reste de
// l'application : si la page est occupée (reconstruction du jeu de
// démonstration, écriture du registre) ou que le canal du service n'est pas
// encore ouvert, la PREMIÈRE lecture du recueil peut échouer avant même d'avoir
// commencé — et un recueil vide ne montre rien. L'amorçage est donc repris un
// peu plus tard, quelques fois seulement, tant qu'il reste des actes à publier.
// Il est idempotent : ce que le service détient déjà n'est ni redéposé ni
// republié, donc une reprise ne fait jamais de doublon.
const REPRISES_MAX = 4;
const ATTENTE_REPRISE = [4000, 10000, 20000, 40000];
let reprises = 0;
let repriseTimer = null;
function planifierReprise() {
  if (repriseTimer || reprises >= REPRISES_MAX) return;
  const attente = ATTENTE_REPRISE[Math.min(reprises, ATTENTE_REPRISE.length - 1)];
  reprises += 1;
  repriseTimer = setTimeout(() => {
    repriseTimer = null;
    amorcerRecueil().catch(() => {});
  }, attente);
}

// L'amorçage est-il en cours ? Le recueil public le demande pour ne pas annoncer
// « aucun acte publié » pendant que la démonstration dépose les siens : au
// premier lancement, le recueil est vide SANS l'être — il le sera dans un
// instant, et le dire vaut mieux que de le nier.
let amorcage = false;
export const amorcageEnCours = () => amorcage;

// LE RÉGLAGE DU BULLETIN (1.6.0). Le bulletin se règle dans Administration ›
// Publication — donc dans le RÉFÉRENTIEL du poste —, mais c'est le SERVICE qui
// tient ses périodes, ses abonnés et ses courriels : c'est lui qui compose les
// numéros et qui les diffuse. En régime LOCAL (celui de la démonstration), le
// référentiel ne quitte pas le poste : sans ce dépôt, le service croirait le
// bulletin éteint, la page publique n'en montrerait rien, et l'écran « Bulletin »
// se contredirait lui-même — exactement le problème que `amorcerInformations`
// résout pour les billets du recueil.
//
// On ne dépose QUE le bloc du bulletin, FUSIONNÉ dans le document de
// configuration du service : le reste de ce que le service détient (quand il
// détient quelque chose) est laissé tel quel.
export async function amorcerBulletin({ silencieux = true } = {}) {
  if (!jeuDeDemonstration()) return 0;
  if (!db.isLocalMode()) return 0;
  const b = state.config && state.config.publication && state.config.publication.bulletin;
  if (!b || typeof b !== "object") return 0;
  if (!(await assurerServiceDemo())) return 0;
  const token = cleService();
  if (!token) return 0;
  try {
    const lu = await get("/v1/db/collections/config", { token, label: "Réglages du bulletin (démonstration)", source: "lecture" });
    if (!lu.ok) return 0;
    const records = bodyOf(lu).records || [];
    const actuel = (records.find((r) => String(r.id) === "self") || {}).payload || {};
    let depose = 0;
    if (empreinteBillet(actuel.publication && actuel.publication.bulletin) !== empreinteBillet(b)) {
      const payload = { ...actuel, publication: { ...(actuel.publication || {}), bulletin: b } };
      const res = await post("/v1/db/collections/config/sync", { force: true, upserts: [{ id: "self", ord: 0, payload }] }, { token, label: "Dépôt des réglages du bulletin (démonstration)" });
      if (!res.ok) return 0;
      depose = 1;
      // L'ÉTAT PUBLIC vient de changer : la copie que le recueil garde (la cadence,
      // les numéros parus, le flux) ne vaut plus rien. On l'oublie et on redessine,
      // sans quoi une page publique ouverte pendant le dépôt continuerait d'ignorer
      // le bulletin jusqu'au chargement suivant — et la démonstration, dont le
      // dépôt suit le démarrage de quelques secondes, montrerait un recueil sans
      // bulletin à un visiteur pourtant arrivé après. C'est le même geste que les
      // écrans d'administration font après un réglage (voir src/ui/views/bulletin.js).
      oublierBulletinsRecueil();
      redrawView();
    }
    return depose;
  } catch (e) {
    if (!silencieux) console.warn("Dépôt des réglages du bulletin :", e);
    return 0;
  }
}

// COMPOSER LES NUMÉROS DU BULLETIN. Le service le fait de lui-même au démarrage,
// puis à intervalle régulier (voir `passeBulletins`, src/server/mysql/server.mjs) :
// c'est la CADENCE qui fait paraître les numéros, sans que personne ne les
// demande. La démonstration n'a pas de passe de fond — quelqu'un doit donc le
// faire à sa place, et ce quelqu'un, c'est l'amorçage du recueil : il compose
// APRÈS avoir publié (un bulletin se compose des publications, pas avant elles),
// et de nouveau chaque fois qu'une passe publie de nouveaux actes. Sans cela, le
// bulletin serait ouvert sans qu'aucun numéro ne paraisse jamais, et la page
// publique se lirait comme une promesse vide.
let compositionFaite = false;
async function composerBulletins() {
  const token = cleService();
  if (!token) return 0;
  try {
    const res = await post("/v1/bulletins/administration/generer", {}, { token, label: "Composition des numéros du bulletin (démonstration)" });
    // Le drapeau ne se pose que sur un ACCORD du service : une composition
    // refusée (service remis à zéro en cours de route) doit pouvoir être rejouée
    // par la reprise de l'amorçage.
    if (res.ok) compositionFaite = true;
    return res.ok ? 1 : 0;
  } catch (e) {
    // Silencieux : le service a pu repartir entre-temps, l'amorçage s'en aperçoit
    // par ailleurs (et les numéros se composeront à la reprise).
    return 0;
  }
}

// L'écran « Bulletin » l'appelle avant de lire, et avant chaque geste : les
// réglages qu'un administrateur vient d'écrire doivent être ceux que le service
// applique. Sur une installation réelle, la fonction ne fait rien (le référentiel
// EST chez le service, qui lit donc les réglages tout seul).
export async function amorcerRecueil({ silencieux = true } = {}) {
  if (enCours && Date.now() - enCoursDepuis < DELAI_AMORCAGE) return 0;
  if (!jeuDeDemonstration()) return 0;
  amorcage = true;
  // Le SERVICE d'abord : une démonstration neuve n'a pas de clé, et un service
  // sans clé est en lecture seule — sans ce geste, rien ne peut être publié, ni
  // acte ni billet (voir `assurerServiceDemo`).
  await assurerServiceDemo();
  // Les billets se déposent même quand il ne reste aucun acte à publier : ce
  // sont deux contenus distincts du recueil public.
  await amorcerInformations({ silencieux });
  // Le RÉGLAGE DU BULLETIN suit le même chemin que les billets : le service en a
  // besoin pour composer, et l'atelier, lui, travaille en local.
  await amorcerBulletin({ silencieux });
  // Les actes que la fiction déclare publiés : signés d'abord, et déjà publiés
  // au registre local ensuite — un service remis à zéro (ou une installation
  // neuve) doit retrouver son recueil, sans quoi le registre local et le recueil
  // public se contrediraient. Le service reste la source : ce qu'il détient n'est
  // ni redéposé ni republié.
  const aPublier = state.actes.filter((a) =>
    estDemonstration(a) && !a.deletedAt && (a.statut === "signee" || a.statut === "publie") && a.original && a.execution?.publication && actePubliable(a));
  if (!aPublier.length) {
    amorcage = false;
    // Rien à publier, mais le service peut détenir des publications que ce poste
    // ne connaît plus (registre local remis à zéro) : le bulletin, lui, se
    // compose de ce que le SERVICE détient.
    if (!compositionFaite) await composerBulletins();
    return 0;
  }

  enCours = true;
  enCoursDepuis = Date.now();
  let publies = 0;
  try {
    // Le service est la source : ce qu'il détient déjà n'est ni redéposé ni
    // republié, il est seulement repris au registre local.
    const res = await get("/v1/publications", { label: "Amorçage du recueil", source: "lecture" });
    const auService = new Map((bodyOf(res).publications || []).map((p) => [String(p.numero || ""), p]));
    const settings = publicationSettings(state.config);
    const flow = beginFlow("Amorçage du recueil (démonstration)");

    // Deux échecs de suite : le service ne répond plus (canal fermé, service
    // suspendu). On s'arrête là plutôt que d'attendre, acte après acte, une
    // réponse qui ne viendra pas — l'amorçage sera repris au prochain
    // démarrage, et les actes déjà publiés ne seront pas republiés.
    let echecs = 0;
    let interrompu = false;
    for (const acte of aPublier) {
      if (echecs >= 2) { interrompu = true; break; }
      try {
        const deja = auService.get(String(acte.numero || ""));
        if (deja) {
          await reprendre(acte, deja);
          publies += 1;
        } else {
          const doc = docOfActe(acte);
          if (!doc) continue;
          const datePublication = acte.execution?.publication?.at || acte.dateSignature || "";
          const ok = await publierActeDuSeed(acte, doc, {
            datePublication: datePublication || undefined,
            mode: settings.opposabilite.mode, jours: settings.opposabilite.jours,
            recueil: settings.recueil, publishConsolide: false,
          });
          if (ok) {
            publies += 1;
            // L'enregistrement rendu par le dépôt est AMPUTÉ : la réponse de
            // publication ne porte ni les formats, ni l'original signé. On relit
            // la fiche complète et on la garde sur l'acte, pour que le recueil
            // puisse s'en servir si le service venait à se taire (voir
            // src/lib/publications-locales.js).
            await reprendre(acte, { cle: acte.publication && acte.publication.cle }, { force: true });
          }
        }
        echecs = 0;
        // La MISE EN AVANT voyage à part : le service la porte par identifiant
        // ELI, et le dépôt ne la connaît que si l'acte l'a déposée avec lui.
        // Un service déjà à jour n'est pas rappelé — l'amorçage reste jouable
        // autant de fois qu'on veut.
        await epinglerAuService(acte, { token: settings.jetonDemonstration, flow });
        await dormir(pauseAmorcage());
      } catch (e) {
        echecs += 1;
        if (!silencieux) console.warn("Amorçage du recueil :", e);
      }
    }
    if (publies) {
      // Les écrans qui montrent le recueil avaient peut-être déjà lu : on les
      // force à le relire (le registre public et le recueil public).
      state.pubRegistre = { chargement: false };
      if (state.recueil) { state.recueil.liste = null; state.recueil.actes = {}; }
      touch("actes");
      // Un amorçage qui aboutit rend son crédit à la reprise : une interruption
      // ultérieure (session longue) pourra de nouveau être rattrapée.
      reprises = 0;
      if (repriseTimer) { clearTimeout(repriseTimer); repriseTimer = null; }
    } else {
      // Rien n'a pu être publié : le service n'était pas joignable au moment où
      // l'amorçage s'est présenté (voir `planifierReprise`). On repasse plus tard
      // plutôt que de laisser le recueil vide pour toute la session.
      planifierReprise();
    }
    // Amorçage interrompu en cours de route (le service a cessé de répondre) :
    // le recueil est incomplet, on repasse pour les actes qui manquent.
    if (interrompu) planifierReprise();
    // LE BULLETIN, EN DERNIER : ses numéros se composent des publications, donc
    // après elles — et de nouveau si cette passe vient d'en publier (une reprise
    // de l'amorçage en publie au fil de l'eau).
    if (publies || !compositionFaite) await composerBulletins();
  } catch (e) {
    // Première lecture impossible : le service n'était pas joignable. On repasse
    // (voir `planifierReprise`) — le journal du service garde la trace de
    // l'appel manqué, avec son libellé.
    if (!silencieux) console.warn("Amorçage du recueil :", e);
    planifierReprise();
  } finally {
    enCours = false;
    amorcage = false;
  }
  return publies;
}

// L'acte est déjà au recueil du service : on reprend son enregistrement local,
// pour que le registre des actes et le recueil racontent la même chose.
//
// `force` relit la fiche même quand le registre local croit déjà la détenir :
// c'est ce qu'il faut après une publication, dont la réponse est incomplète (ni
// formats, ni original signé) — voir `publicationsLocales`.
async function reprendre(acte, resume, { force = false } = {}) {
  const cle = resume && resume.cle;
  if (!cle) return;
  if (!force && acte.publication?.cle === cle) return;
  // La lecture porte le jeton du service : c'est l'amorçage, qui agit avec la
  // clé de l'installation — sans lui, une publication RÉSERVÉE AUX AGENTS
  // répondrait « inconnue » à un appel anonyme.
  const one = await get("/v1/publications/" + encodeURIComponent(resume.cle), { token: publicationSettings(state.config).jetonDemonstration, label: "Publication existante", source: "lecture" });
  if (!one.ok) return;
  const p = one.body;
  acte.publication = { ...p, html: p.formats?.html || "", akn: p.formats?.akn || "", jsonld: p.formats?.jsonld || "" };
  // La mise à la une vit sur la PUBLICATION chez le service : on la reprend
  // aussi sur l'acte, pour que le bouton de la liste dise son état (voir
  // `libelleEpinglage`, src/ui/views/actes.js).
  acte.epingle = p.epingle === true;
  acte.statut = "publie";
  acte.eli = p.eliUri;
  acte.datePublication = p.datePublication;
  acte.dateOpposabilite = p.dateOpposabilite;
  acte.updatedAt = new Date().toISOString();
  touch("actes", { rerender: false });
}

// La mise à la une ne voyage PAS dans le dépôt : c'est un geste à part, posé
// par identifiant ELI (voir `POST /v1/publications/{cle}/epingle`). L'amorçage
// la porte donc après coup, pour les actes que la fiction déclare épinglés.
//
// Le geste est REPOSÉ à chaque amorçage, sans regarder ce que le registre local
// croit : le service est la source, et il a pu être remis à zéro (ou n'avoir
// jamais reçu la publication) pendant que l'acte local, lui, se dit publié et
// épinglé. La route est idempotente, et un acte absent du service répond 404 —
// avalé, comme tout le reste de l'amorçage.
async function epinglerAuService(acte, { token, flow }) {
  const cle = acte.publication?.cle;
  if (!acte.epingle || !cle) return;
  try {
    const res = await post(
      "/v1/publications/" + encodeURIComponent(cle) + "/epingle",
      { epingle: true, auteur: "Démonstration" },
      { token, flow, label: "Mise à la une (démonstration)" },
    );
    if (res.ok) { acte.publication = { ...acte.publication, epingle: true }; touch("actes", { rerender: false }); }
  } catch (e) {
    // Silencieux : l'amorçage de démonstration ne gêne jamais l'application.
  }
}

// L'amorçage ne touche QUE le jeu de démonstration : un référentiel repris à la
// main, ou une installation réelle, n'est jamais concerné.
//
// Le critère porte sur la PROVENANCE de chaque acte, non sur la composition du
// registre entier : exiger que TOUS les actes soient `acte-demo-*` faisait
// disparaître le recueil public dès qu'un seul acte écrit à la main entrait au
// registre (une rédaction d'essai, un brouillon) — alors que la démonstration,
// elle, n'avait pas changé. Un acte de la fiction est reconnu à son
// identifiant (`acte-demo-…`) ; c'est lui, et lui seul, que l'amorçage publie.
const estDemonstration = (a) => String(a?.id || "").startsWith("acte-demo-");
const jeuDeDemonstration = () => {
  if (!demoActif(state.config)) return false;
  if (!state.actes.length || !state.trames.length) return false;
  return state.actes.some(estDemonstration) && state.trames.some((t) => String(t.id).startsWith("tpl-"));
};
