// ============================================================================
// Appliquer les abrogations qu'un acte a prévues.
//
// Un acte peut prévoir l'abrogation d'un autre acte — ou d'un article d'un
// autre acte (voir src/lib/abrogations.js). Cette abrogation prend effet au
// jour de l'ENTRÉE EN VIGUEUR de l'acte qui la prévoit, et non au jour de sa
// publication : c'est le moment que ce module attend pour la rendre réelle.
//
// Ce que « rendre réelle » veut dire, ici :
//   • l'acte visé DANS SON ENSEMBLE reçoit la marque de son abrogation
//     (`abrogePar`) : le registre le dit, et sa fiche le rappelle ;
//   • un ARTICLE visé est abrogé dans une nouvelle VERSION CONSOLIDÉE de l'acte
//     qui le porte — exactement comme le ferait un acte modificatif, le tableau
//     des modifications désignant l'acte abrogeant. Cette version part ensuite
//     à la publication, comme toute consolidation.
//
// L'opération est idempotente : chaque entrée d'abrogation reçoit sa date
// d'application (`appliedAt`) et n'est jamais appliquée deux fois. Elle est
// silencieuse — on ne prévient personne d'un fait qui découle du texte — mais
// elle entre au JOURNAL, parce que c'est un fait du dossier.
// ============================================================================
import { state, touch, journaliser } from "./state.js";
import { fullName } from "../lib/users.js";
import { uid } from "../lib/util.js";
import { compile } from "../lib/compile.js";
import { entreeEnVigueur, aujourdhui } from "../lib/execution.js";
import { abrogationsDe, designationDe as designationDeActe } from "../lib/abrogations.js";
import { newAmend, planAmendments, buildConsolidated, articleKey } from "../lib/amend.js";

// Le document d'un acte : celui qu'il transporte (acte importé, modificatif,
// consolidation), ou celui que sa trame compile.
function docOf(acte) {
  if (!acte) return null;
  if (acte.doc) return acte.doc;
  const trame = state.trames.find((t) => t.id === acte.trameId);
  if (!trame) return null;
  return compile(trame, acte.values || {}, state.config, { overrides: acte.overrides });
}

export function designationDe(acte) {
  return designationDeActe(acte, state.config, state.trames.find((t) => t.id === acte?.trameId));
}

const auteurCourant = () => ({ by: state.user?.id || "", byName: state.user ? fullName(state.user) : "" });

// Applique toutes les abrogations arrivées à leur terme. Rend la liste de ce
// qui a été fait (vide si rien n'était dû).
export async function appliquerAbrogations() {
  const config = state.config;
  const jour = aujourdhui();
  const faits = [];
  for (const a of state.actes || []) {
    if (a.deletedAt) continue;
    const list = abrogationsDe(a);
    if (!list.length) continue;
    const date = entreeEnVigueur(a, config);
    // Tant que l'acte n'est pas publié, sa date d'entrée en vigueur n'est pas
    // connue : rien ne peut être appliqué, et l'abrogation reste « prévue ».
    if (!date || date > jour) continue;
    for (const abr of list) {
      if (abr.appliedAt) continue;
      const fait = appliquer(a, abr, date);
      abr.appliedAt = new Date().toISOString();
      abr.appliedOn = date;
      if (fait) faits.push(fait);
    }
  }
  if (faits.length) {
    touch("actes");
    for (const f of faits) {
      await journaliser({
        action: "abrogation.appliquee", cible: "acte", cibleLabel: f.label, acteId: f.acteId,
        detail: f.detail, to: [],
      }).catch(() => {});
    }
  }
  return faits;
}

// Une entrée d'abrogation, appliquée à l'acte qu'elle vise.
function appliquer(acte, abr, date) {
  const cible = state.actes.find((x) => x.id === abr.acteId);
  const marque = {
    acteId: acte.id, numero: acte.numero || "", designation: designationDe(acte),
    date: acte.values?.dateSignature || acte.dateSignature || "", eli: acte.eli || acte.doc?.meta?.eli || "",
    dateEntreeEnVigueur: date, article: abr.article || "",
  };
  if (abr.kind === "texte" || !cible) {
    // L'acte visé n'est pas dans l'application : la clause de l'acte suffit,
    // rien à marquer ici. L'entrée est néanmoins datée (appliquée).
    return { acteId: acte.id, label: acte.numero || acte.id, kind: "texte", detail: `abrogation de ${abr.texte || abr.article || "—"} prévue par ${acte.numero || acte.id} : entrée en vigueur le ${date}` };
  }
  if (abr.kind === "article") {
    return abrogerArticle(acte, cible, abr, marque, date);
  }
  // L'acte entier.
  cible.abrogePar = { ...marque, enAttente: false };
  cible.updatedAt = new Date().toISOString();
  return { acteId: acte.id, label: acte.numero || acte.id, kind: "acte", detail: `abrogation de l'acte ${cible.numero || cible.id} à compter du ${date}` };
}

// L'article visé est abrogé par une NOUVELLE VERSION CONSOLIDÉE de l'acte qui
// le porte : c'est elle, une fois publiée, qui devient la version en vigueur et
// fait disparaître l'article — la même mécanique que l'acte modificatif.
function abrogerArticle(acte, cible, abr, marque, date) {
  const base = docOf(cible);
  if (!base) return null;
  const arts = (base.nodes || []).filter((n) => n.type === "article");
  const node = arts.find((n) => (abr.articleEId && articleKey(n) === abr.articleEId)
    || String(n.numLabel || "").toLowerCase() === String(abr.article || "").toLowerCase()
    || (abr.article && String(n.numLabel || "").toLowerCase().endsWith(String(abr.article).toLowerCase())));
  if (!node) return null;
  const plan = planAmendments(base, [newAmend({ targetEId: articleKey(node), action: "abrogate", targetLabel: node.numLabel || "" })]);
  const m = {
    numero: acte.numero || "", designation: marque.designation,
    objet: `abrogation de l'${(state.config?.vocab?.articleLabel || "Article").toLowerCase()} ${abr.article || ""} de ${cible.numero || "l'acte"}`.trim(),
    dateSignature: marque.date, eli: marque.eli,
  };
  const cons = buildConsolidated(base, plan, m, state.config, { previousTrail: base.trail || [] });
  const now = new Date().toISOString();
  const who = auteurCourant();
  const consActe = {
    id: uid("acte"), kind: "consolide",
    trameId: "", trameName: "Version consolidée",
    numero: cible.numero || base.meta?.numero || "",
    objet: cible.objet || base.meta?.objet || m.objet,
    entityId: cible.entityId || base.meta?.entity?.id || "",
    dateSignature: cible.dateSignature || base.meta?.dateSignature || "",
    serviceId: cible.serviceId || "", bureauId: cible.bureauId || "",
    ...who, statut: "en_attente", createdAt: now, updatedAt: now,
    values: null, doc: cons, eli: cons.meta.eli, issues: [],
    baseId: cible.id, baseEli: cible.eli || base.meta?.eli || "", consolidatesId: cible.id,
    trail: cons.trail, source: "consolidation", pendingConsolidation: true,
    abrogationPar: { acteId: acte.id, numero: acte.numero || "", article: abr.article || "", dateEntreeEnVigueur: date },
  };
  state.actes.push(consActe);
  cible.consolidationIds = [...new Set([...(cible.consolidationIds || []), consActe.id])];
  cible.abrogationsSubies = [...(cible.abrogationsSubies || []), { articleEId: articleKey(node), article: node.numLabel || "", par: marque, consolideId: consActe.id }];
  cible.updatedAt = now;
  abr.consolideId = consActe.id;
  return { acteId: acte.id, label: acte.numero || acte.id, kind: "article", consolideId: consActe.id, detail: `abrogation de l'${(state.config?.vocab?.articleLabel || "article").toLowerCase()} ${abr.article || ""} de l'acte ${cible.numero || cible.id} : version consolidée n° ${consActe.id} créée (à publier)` };
}
