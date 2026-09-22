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
// C'est un amorçage de DÉMONSTRATION, et rien d'autre : il ne s'exécute que sur
// le jeu de démonstration intact, il est idempotent (un acte déjà publié au
// service est seulement repris au registre local), et il est silencieux — un
// service injoignable est repris quelques fois de plus (voir `planifierReprise`)
// avant de laisser le recueil tel quel.
// ============================================================================
import { state, touch, actePubliable } from "./state.js";
import { demoActif } from "../lib/demo.js";
import { get, post, beginFlow, bodyOf } from "../lib/remote.js";
import { publicationSettings } from "../lib/eli.js";
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
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

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

export async function amorcerRecueil({ silencieux = true } = {}) {
  if (enCours && Date.now() - enCoursDepuis < DELAI_AMORCAGE) return 0;
  if (!jeuDeDemonstration()) return 0;
  // Les actes que la fiction déclare publiés : signés d'abord, et déjà publiés
  // au registre local ensuite — un service remis à zéro (ou une installation
  // neuve) doit retrouver son recueil, sans quoi le registre local et le recueil
  // public se contrediraient. Le service reste la source : ce qu'il détient n'est
  // ni redéposé ni republié.
  const aPublier = state.actes.filter((a) =>
    estDemonstration(a) && !a.deletedAt && (a.statut === "signee" || a.statut === "publie") && a.original && a.execution?.publication && actePubliable(a));
  if (!aPublier.length) return 0;

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
          if (ok) publies += 1;
        }
        echecs = 0;
        // La MISE EN AVANT voyage à part : le service la porte par identifiant
        // ELI, et le dépôt ne la connaît que si l'acte l'a déposée avec lui.
        // Un service déjà à jour n'est pas rappelé — l'amorçage reste jouable
        // autant de fois qu'on veut.
        await epinglerAuService(acte, { token: settings.jetonDemonstration, flow });
        await dormir(PAUSE_AMORCAGE);
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
  } catch (e) {
    // Première lecture impossible : le service n'était pas joignable. On repasse
    // (voir `planifierReprise`) — le journal du service garde la trace de
    // l'appel manqué, avec son libellé.
    if (!silencieux) console.warn("Amorçage du recueil :", e);
    planifierReprise();
  } finally {
    enCours = false;
  }
  return publies;
}

// L'acte est déjà au recueil du service : on reprend son enregistrement local,
// pour que le registre des actes et le recueil racontent la même chose.
async function reprendre(acte, resume) {
  if (acte.publication?.cle === resume.cle) return;
  const one = await get("/v1/publications/" + encodeURIComponent(resume.cle), { label: "Publication existante", source: "lecture" });
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
