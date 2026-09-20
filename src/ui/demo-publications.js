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
// service est seulement repris au registre local), et toutes ses erreurs sont
// silencieuses — un service injoignable laisse simplement le recueil vide.
// ============================================================================
import { state, touch, actePubliable } from "./state.js";
import { get } from "../lib/remote.js";
import { publicationSettings } from "../lib/eli.js";
import { docOfActe } from "./views/modifier.js";
import { publierActeDuSeed } from "./views/signature.js";

let enCours = false;

export async function amorcerRecueil({ silencieux = true } = {}) {
  if (enCours) return 0;
  if (!jeuDeDemonstration()) return 0;
  // Les actes que la fiction déclare publiés : signés d'abord, et déjà publiés
  // au registre local ensuite — un service remis à zéro (ou une installation
  // neuve) doit retrouver son recueil, sans quoi le registre local et le recueil
  // public se contrediraient. Le service reste la source : ce qu'il détient n'est
  // ni redéposé ni republié.
  const aPublier = state.actes.filter((a) =>
    !a.deletedAt && (a.statut === "signee" || a.statut === "publie") && a.original && a.execution?.publication && actePubliable(a));
  if (!aPublier.length) return 0;

  enCours = true;
  let publies = 0;
  try {
    // Le service est la source : ce qu'il détient déjà n'est ni redéposé ni
    // republié, il est seulement repris au registre local.
    const res = await get("/v1/publications", { label: "Amorçage du recueil", source: "lecture" });
    const auService = new Map(((res.ok && res.body.publications) || []).map((p) => [String(p.numero || ""), p]));
    const settings = publicationSettings(state.config);

    for (const acte of aPublier) {
      try {
        const deja = auService.get(String(acte.numero || ""));
        if (deja) { await reprendre(acte, deja); publies += 1; continue; }
        const doc = docOfActe(acte);
        if (!doc) continue;
        const datePublication = acte.execution?.publication?.at || acte.dateSignature || "";
        const ok = await publierActeDuSeed(acte, doc, {
          datePublication: datePublication || undefined,
          mode: settings.opposabilite.mode, jours: settings.opposabilite.jours,
          recueil: settings.recueil, publishConsolide: false,
        });
        if (ok) publies += 1;
      } catch (e) {
        if (!silencieux) console.warn("Amorçage du recueil :", e);
      }
    }
    if (publies) {
      // Les écrans qui montrent le recueil avaient peut-être déjà lu : on les
      // force à le relire (le registre public et le recueil public).
      state.pubRegistre = { chargement: false };
      if (state.recueil) { state.recueil.liste = null; state.recueil.actes = {}; }
      touch("actes");
    }
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
  acte.statut = "publie";
  acte.eli = p.eliUri;
  acte.datePublication = p.datePublication;
  acte.dateOpposabilite = p.dateOpposabilite;
  acte.updatedAt = new Date().toISOString();
  touch("actes", { rerender: false });
}

// L'amorçage ne touche QUE le jeu de démonstration : un référentiel repris à la
// main, ou une installation réelle, n'est jamais concerné.
function jeuDeDemonstration() {
  if (state.config?.brand?.demo === false) return false;
  if (!state.actes.length || !state.trames.length) return false;
  return state.actes.every((a) => String(a.id).startsWith("acte-demo-"))
    && state.trames.every((t) => String(t.id).startsWith("tpl-"));
}
