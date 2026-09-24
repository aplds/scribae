import {
  state, touch, navigate, can, visibleActes, actePubliable, actesCorbeille,
  mettreALaCorbeille, journaliser, circuitDe, parapheur as fileParapheur, parapheurActif,
  competenceDeSignature, redrawView, currentUser,
} from "../state.js";
import { h, button, toast, modal, icon } from "../dom.js";
import { post, errorMessage, beginFlow } from "../../lib/remote.js";
import { publicationSettings } from "../../lib/eli.js";
import { download, formatDate } from "../../lib/util.js";
import { confirmDialog, emptyState, isDraftable, abrogationBadge, acteStatutLabel as statutLabel, acteStatutColor as statutColor } from "../components.js";
import { helpLink } from "../components.js";
import { targetLabel } from "../../lib/scope.js";
import { openActe, redigerAbrogation } from "./rediger.js";
import { docOfActe, modifierFromActe, natureOf, ecartsOfActe } from "./modifier.js";
import { exportAkn, exportJsonLd, exportMarkdown, exportStandaloneHtml, exportWordDoc, printDocument } from "../../lib/export.js";
import { boutonsPdfA } from "../pdfa.js";
import { demarrerValidation, etapeActive, etatParapheur } from "../../lib/validation.js";
import { resumeExecution } from "../../lib/execution.js";
import { designationDe, avecArticle } from "../../lib/abrogations.js";
import { natureOfActe, numeroAffiche } from "../../lib/annexes.js";

export function renderActes(root) {
  const tous = can("actes.tous");
  const list = [...visibleActes()].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  // Un signataire voit, outre ses actes, ceux dont la signature relève de lui :
  // le dire évite de croire à un mélange de registres.
  const signataire = list.some((a) => !tous && a.createdBy !== state.user?.id && competenceDeSignature(a).ok);
  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Actes" }),
      h("p", { class: "page-head__sub", text: tous
        ? "Registre local : actes rédigés, actes importés, actes modificatifs et versions consolidées."
        : signataire
          ? "Vos actes, et ceux dont la signature relève de vous (la vôtre, ou celle que vous avez déléguée). Un administrateur ou un éditeur voit l'ensemble du registre."
          : "Vos actes : les actes que vous avez rédigés dans votre périmètre (service et bureaux). Un administrateur ou un éditeur voit l'ensemble du registre." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("retrouver", "Retrouver un acte"),
      can("actes.gerer") ? helpLink("modifier", "Modifier un acte") : null,
      button("Rédiger un acte", { variant: "primary", icon: "plus", onClick: startRedaction }),
    ),
  ));

  if (!list.length) {
    root.appendChild(emptyState(tous
      ? "Aucun acte enregistré pour l'instant."
      : "Vous n'avez pas encore rédigé d'acte.", button("Commencer", { variant: "primary", onClick: startRedaction })));
    return;
  }

  const table = h("table", { class: "fr-table" },
    h("thead", {}, h("tr", {},
      h("th", { text: "Numéro" }), h("th", { text: "Objet" }), h("th", { text: "Nature" }),
      h("th", { text: "Trame" }), h("th", { text: "Service" }),
      h("th", { text: "Entité" }), h("th", { text: "Signature" }), h("th", { text: "Statut" }),
      parapheurActif() ? h("th", { text: "Parapheur" }) : null,
      h("th", { text: "Exécution" }), h("th", { text: "Publication" }), h("th", {}),
    )),
  );
  const tb = h("tbody");
  let withEcarts = 0;
  for (const a of list) {
    const entity = state.config.entities?.find((e) => e.id === a.entityId);
    const n = natureOf(a);
    const doc = docOfActe(a);
    const editable = canEdit(a);
    const ec = editable ? ecartsOfActe(a) : { count: 0, list: [] };
    if (ec.count) withEcarts++;
    tb.appendChild(h("tr", { title: a.createdByName ? "Rédigé par " + a.createdByName : "" },
      // Une annexe n'a pas de numéro : la colonne renvoie à la décision qui
      // l'adopte (voir `numeroAffiche`, src/lib/annexes.js).
      h("td", { class: "fr-mono", text: numeroAffiche(a, state.config, state.trames) || "—" }),
      h("td", { text: a.objet || doc?.meta?.objet || "—" }),
      h("td", {}, h("span", { class: "fr-badge fr-badge--" + n.color, text: n.label })),
      h("td", {}, !editable
        ? h("span", { class: "fr-small fr-muted", text: "—" })
        : ec.count
          ? h("span", {
            class: "fr-badge fr-badge--warning",
            title: ec.list.map((e) => e.label).join(" · "),
            text: `${ec.count} écart${ec.count > 1 ? "s" : ""}`,
          })
          : h("span", { class: "fr-badge fr-badge--success", text: "conforme" })),
      h("td", { class: "fr-small", text: a.serviceId ? targetLabel(state.config, a.serviceId, a.bureauId) : "Général" }),
      h("td", { class: "fr-small", text: entity?.code || "" }),
      h("td", { class: "fr-small", text: a.dateSignature ? formatDate(a.dateSignature) : "—" }),
      h("td", {}, h("span", { class: "fr-badge fr-badge--" + statutColor(a.statut), text: statutLabel(a.statut) }), abrogationBadge(a)),
      // Où en est l'acte au parapheur : validé, en attente, caduc (le texte a
      // changé depuis la validation), ou hors circuit.
      parapheurActif() ? h("td", {}, celluleParapheur(a)) : null,
      h("td", {}, celluleExecution(a)),
      h("td", {}, [
        a.publication
          ? h("span", { class: "fr-small" },
            h("span", { class: "fr-mono", text: a.publication.eliUri || a.eli || "" }),
            h("br"),
            h("span", { class: "fr-muted", text: a.publication.juridique === false ? "document non opposable" : "opposable le " + formatDate(a.publication.dateOpposabilite) }))
          : !actePubliable(a)
            ? (natureOfActe(a, state.trames) === "annexe"
              ? h("span", { class: "fr-badge fr-badge--info", title: "Annexe : elle ne se signe ni ne se publie pour elle-même. Son texte suit l'acte qui l'adopte, dans l'original signé.", text: "annexe" })
              : h("span", { class: "fr-badge fr-badge--warning", title: "Trame non publiable : l'acte est signé et conservé, mais jamais déposé au recueil.", text: "non publiable" }))
            : h("span", { class: "fr-small fr-muted", text: "—" }),
        // Mis en avant sur l'accueil du recueil public (voir `basculerEpinglage`).
        // Le repère n'est posé qu'une fois l'acte PUBLIÉ : épingler un acte encore
        // en circuit prépare la une, il ne la tient pas — le bouton, lui, reste
        // allumé, et son infobulle dit ce qui va se passer.
        acteEpingle(a) && a.publication ? h("span", { class: "fr-badge fr-badge--info", style: { marginLeft: "6px" }, title: "Mis en avant dans la bande « À la une » du recueil public.", text: "à la une" }) : null,
      ]),
      h("td", {}, h("div", { class: "fr-row" },
        editable ? button("Reprendre", { variant: "secondary", size: "sm", icon: "note", title: "Rouvrir le document pour le modifier", onClick: () => openActe(a) }) : null,
        button(doc ? "Voir" : "Ouvrir", { variant: "tertiary", size: "sm", onClick: () => (doc ? navigate("acte/" + a.id) : openActe(a)) }),
        can("actes.gerer")
          ? ((actePubliable(a) || natureOfActe(a, state.trames) === "annexe")
            ? button(natureOfActe(a, state.trames) === "annexe" ? "Modifier l'annexe" : "Modifier", { variant: "tertiary", size: "sm", icon: "refresh", title: natureOfActe(a, state.trames) === "annexe" ? "Rédiger l'acte modificatif qui adoptera la nouvelle rédaction de l'annexe" : "Rédiger un acte modificatif", onClick: () => modifierFromActe(a) })
            // Un acte non publiable ne se modifie pas par acte modificatif (qui
            // n'existe que pour le texte publié) : on corrige l'acte lui-même.
            : button("Corriger", { variant: "tertiary", size: "sm", icon: "note", title: "Acte non publiable : correction directe, sans acte modificatif", onClick: () => openActe(a) }))
          : null,
        can("actes.signer") ? button("", { variant: "tertiary", icon: "lock", size: "sm", title: "Signer l'acte (ou suivre son circuit)", onClick: () => signer(a) }) : null,
        can("signature.gerer") ? button("", { variant: "tertiary", icon: "check", size: "sm", title: "Enregistrer une formalité d'exécution (transmission, publication, notification)", onClick: () => { state.execution = { ...(state.execution || {}), acteId: a.id }; navigate("execution"); } }) : null,
        button("", { variant: "tertiary", icon: "download", size: "sm", title: "Exporter", onClick: () => quickExport(a) }),
        // ÉPINGLER l'acte : le mettre en avant dans la bande « À la une » du
        // recueil public. La distinction se pose et se retire du même geste.
        peutEpingler(a) ? boutonEpinglage(a) : null,
        can("actes.gerer")
          // Seul un BROUILLON va à la corbeille : un acte signé ou publié est une
          // pièce du dossier. Il ne s'efface pas — il s'ABROGE, par un acte
          // nouveau qui le vise expressément (voir `retirerOuAbroger`).
          ? (isDraftable(a.statut)
            ? button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Mettre à la corbeille", onClick: () => remove(a) })
            : button("", { variant: "tertiary", icon: "x", size: "sm", title: "Retirer du recueil, ou abroger", onClick: () => retirerOuAbroger(a) }))
          : null,
      )),
    ));
  }
  table.appendChild(tb);
  root.appendChild(h("div", { class: "fr-table-wrap" }, table));
  root.appendChild(h("p", { class: "fr-small fr-muted", text: `${list.length} acte(s) · stockage local (IndexedDB). Un acte modifié donne deux nouvelles entrées : l'acte modificatif et la version consolidée. Exportez régulièrement pour partager ou archiver.` }));
  root.appendChild(h("p", { class: "fr-small fr-muted", text: withEcarts
    ? `⚠ ${withEcarts} acte(s) comportent des passages réécrits par rapport à la trame (« Reprendre » pour voir le détail). Un écart n'est pas une faute : adaptez la trame si l'adaptation se répète.`
    : "Aucun acte ne comporte de passage réécrit : les rédactions suivent les trames." }));

  // Ce qui attend un geste : le parapheur et les formalités d'exécution.
  const file = fileParapheur();
  const enAttente = [...list].filter((a) => a.original || a.statut === "signee").filter((a) => {
    const r = resumeExecution(a, state.config, { publiable: actePubliable(a), trame: state.trames.find((t) => t.id === a.trameId) });
    return r.code === "en_attente";
  }).length;
  const corbeille = actesCorbeille().length;
  if (file.aMoi.length || enAttente || corbeille) {
    root.appendChild(h("div", { class: "fr-row actes-relances", style: { marginTop: "4px" } },
      icon("warn", 15),
      file.aMoi.length ? h("span", { class: "fr-small" }, `${file.aMoi.length} acte(s) attendent votre bon pour accord. `, button("Parapheur", { variant: "tertiary", size: "sm", onClick: () => navigate("parapheur") })) : null,
      enAttente ? h("span", { class: "fr-small" }, `${enAttente} acte(s) signé(s) attendent une formalité (transmission, publication, notification). `, button("Échéancier", { variant: "tertiary", size: "sm", onClick: () => navigate("execution") })) : null,
      corbeille ? h("span", { class: "fr-small" }, `${corbeille} acte(s) à la corbeille. `, button("Corbeille", { variant: "tertiary", size: "sm", onClick: () => navigate("corbeille") })) : null,
    ));
  }
}

// Un acte rédigé à partir d'une trame présente dans le référentiel peut être
// rouvert dans l'éditeur de rédaction.
function canEdit(a) {
  return !!a.values && state.trames.some((t) => t.id === a.trameId);
}

// ------------------------------------------------- ÉPINGLER AU RECUEIL PUBLIC
// Épingler un acte, c'est le mettre EN AVANT sur la page d'accueil du recueil
// public, dans sa bande « À la une » : la place d'un règlement intérieur, d'une
// charte, d'un document qu'on vient chercher — et non d'un acte parmi d'autres.
//
// Le drapeau vit d'abord sur l'ACTE : on peut donc épingler un acte qui n'est
// PAS ENCORE publié — il sera à la une dès sa publication, le dépôt l'emporte
// avec sa version en ligne (voir views/signature.js). Pour un acte DÉJÀ publié,
// le geste est aussitôt porté au service, qui est la source du recueil ; c'est
// lui que lit le visiteur.
//
// Le service attache le drapeau à l'ACTE — son identifiant ELI —, non à la
// version déposée : un acte modifié reste à la une (voir `hEpinglerPublication`
// et `hPublier`).
//
// Un acte non publiable (acte individuel) ne va pas au recueil, et une annexe
// n'y est publiée que par l'acte qui l'adopte : rien à mettre en avant pour eux,
// donc pas de bouton. C'est `actePubliable` qui le dit.
const peutEpingler = (a) => can("publications.epingler") && actePubliable(a);

// L'acte est-il à la une ? Le drapeau vit sur l'ACTE — c'est lui qui prépare la
// une d'un acte encore en circuit — et, pour un acte publié, sur la PUBLICATION
// que détient le service : c'est elle que lit le visiteur. Les deux peuvent
// diverger — une publication déposée ou épinglée par un autre poste, ou reprise
// du service sans que l'acte local l'ait suivi — et le bouton doit dire l'état
// RÉEL de la une, non celui du seul registre local.
export const acteEpingle = (a) => !!a && (a.epingle === true || a.publication?.epingle === true);

// Le libellé du geste d'épinglage : UN SEUL, qui dit l'ÉTAT de l'acte. Épinglé,
// il propose de retirer ; à épingler, il distingue l'acte déjà publié (l'effet
// est immédiat) de l'acte encore en circuit (« dès sa publication »). Voir
// NC-III-006 et P-28.
export const libelleEpinglage = (a) => acteEpingle(a)
  ? "Retirer de la une du recueil public"
  : (a.publication?.cle
    ? "Épingler à la une du recueil public"
    : "Épingler à la une — l'acte y sera mis dès sa publication");

function boutonEpinglage(a) {
  const b = button("", {
    variant: "tertiary", icon: "pin", size: "sm",
    title: libelleEpinglage(a),
    onClick: () => basculerEpinglage(a),
    });
  // Épinglé, le bouton le dit : la punaise reste allumée (voir `.is-on`).
  if (acteEpingle(a)) b.classList.add("is-on");
  return b;
}

export async function basculerEpinglage(a) {
  const epingle = !acteEpingle(a);
  const avant = acteEpingle(a);
  const cle = a.publication?.cle;
  a.epingle = epingle;
  if (a.publication) a.publication = { ...a.publication, epingle };
  // Le service a refusé, ou l'appel n'est pas passé : on remet l'acte ET sa
  // publication dans l'état d'avant (le drapeau est lu sur les deux).
  const restaurer = (v) => {
    a.epingle = v;
    if (a.publication) a.publication = { ...a.publication, epingle: v };
  };
  if (cle) {
    const u = currentUser();
    const auteur = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.login || "";
    const flow = beginFlow(`Épinglage — ${a.numero || a.id}`);
    let res;
    try {
      res = await post(`/v1/publications/${encodeURIComponent(cle)}/epingle`, { epingle, auteur }, {
        token: publicationSettings(state.config).jetonDemonstration,
        flow, label: epingle ? "Mise à la une du recueil" : "Retrait de la une du recueil",
      });
    } catch (e) {
      restaurer(avant);
      toast(String((e && e.message) || e), "error");
      redrawView();
      return;
    }
    if (!res.ok) {
      // Le service fait foi : si l'épinglage n'a pas été accepté, l'acte ne se
      // dit pas épinglé.
      restaurer(avant);
      toast("Le recueil n'a pas été modifié : " + errorMessage(res), "error");
      redrawView();
      return;
    }
    a.publication = { ...a.publication, epingle };
    // Le registre et le recueil avaient peut-être déjà lu : on invalide leurs caches.
    state.pubRegistre = { chargement: false };
    state.pubConsult = {};
    if (state.recueil) { state.recueil.liste = null; state.recueil.actes = {}; }
  }
  a.updatedAt = new Date().toISOString();
  touch("actes", { rerender: false });
  await journaliser({
    action: epingle ? "publication.epingle" : "publication.desepingle",
    cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
    detail: epingle ? "mis à la une du recueil public" : "retiré de la une du recueil public",
  });
  toast(epingle
    ? (cle ? "Acte mis à la une du recueil public" : "Acte épinglé — il sera à la une dès sa publication")
    : "Acte retiré de la une du recueil public", "success");
  redrawView();
}

// Ouvre l'écran de signature avec cet acte déjà sélectionné.
function signer(a) {
  state.signature = { tab: a.statut === "signee" || a.original ? "publication" : "circuit", acteId: a.id };
  navigate("signature");
}

// Le choix de l'acte à rédiger (trame, ou acte déjà commencé) se fait sur
// l'écran « Rédiger un acte » lui-même — voir `renderChooser` (rediger.js).
const startRedaction = () => navigate("rediger");

function quickExport(a) {
  const doc = docOfActe(a);
  if (!doc) { toast("Document indisponible pour cet acte", "error"); return; }
  const base = (a.numero || a.id).replace(/[^\w-]+/g, "_");
  const body = h("div", { class: "fr-stack" },
    h("div", { class: "fr-row" },
      button("Akoma Ntoso", { variant: "secondary", onClick: () => download(base + ".akn.xml", exportAkn(doc, state.config), "application/xml") }),
      button("HTML", { variant: "secondary", onClick: () => download(base + ".html", exportStandaloneHtml(doc, state.config), "text/html") }),
    ),
    h("div", { class: "fr-row" },
      button("JSON-LD", { variant: "secondary", onClick: () => download(base + ".jsonld", exportJsonLd(doc, state.config), "application/ld+json") }),
      button("Markdown", { variant: "secondary", onClick: () => download(base + ".md", exportMarkdown(doc, state.config), "text/markdown") }),
    ),
    h("div", { class: "fr-row" },
      button("Imprimer / PDF", { variant: "secondary", onClick: () => printDocument(doc, state.config, null) }),
      button("Word (.doc)", { variant: "secondary", onClick: () => download(base + ".doc", exportWordDoc(doc, state.config, null), "application/msword") }),
    ),
    h("div", { class: "fr-row" }, ...boutonsPdfA(doc, state.config, { base })),
    h("p", { class: "fr-small fr-muted", text: "Référence ELI : " + (doc.meta.eli || "—") }),
  );
  modal({ title: "Export — " + (a.numero || a.id), body, actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })] });
}

// Où en est l'acte au parapheur. Sans circuit applicable, on le dit plutôt que
// d'afficher un vide ; en attente, on rappelle l'étape ouverte.
function celluleParapheur(a) {
  const etat = etatParapheur(a);
  if (etat) {
    return h("span", { class: "fr-badge fr-badge--" + etat.color, title: "Circuit : " + (a.validation.circuitLabel || ""), text: etat.label });
  }
  const circuit = circuitDe(a);
  if (!circuit) return h("span", { class: "fr-small fr-muted", text: "hors circuit" });
  if (!can("actes.rediger")) return h("span", { class: "fr-badge", text: "à soumettre" });
  return button("Soumettre", {
    variant: "tertiary", size: "sm", icon: "upload",
    title: `Soumettre au circuit « ${circuit.label} » (${circuit.steps.length} étape(s))`,
    onClick: () => soumettreAuCircuit(a),
  });
}

async function soumettreAuCircuit(a) {
  const circuit = circuitDe(a);
  if (!circuit) { toast("Aucun circuit ne s'applique à cet acte.", "warning"); return; }
  demarrerValidation(a, circuit, state.user);
  a.updatedAt = new Date().toISOString();
  const etape = etapeActive(a.validation);
  await journaliser({
    action: "parapheur.depot", cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
    detail: `soumis au circuit « ${circuit.label} »` + (etape ? " — étape « " + etape.label + " »" : ""),
    to: [etape ? (etape.role === "administrateur" ? "role:administrateur" : "role:editeur") : ""].filter(Boolean),
  });
  touch("actes", { rerender: false });
  toast("Acte soumis au circuit de validation", "success");
}

// Où en est l'acte du point de vue de son opposabilité : exécutoire, en attente
// d'une formalité, contesté, ou définitif.
const EXECUTION_COURT = { definitif: "définitif", executoire: "exécutoire", recours: "recours", document: "document" };
function celluleExecution(a) {
  if (!(a.original || a.statut === "signee" || a.statut === "publie")) return h("span", { class: "fr-small fr-muted", text: "—" });
  const r = resumeExecution(a, state.config, { publiable: actePubliable(a), trame: state.trames.find((t) => t.id === a.trameId) });
  const suite = r.code === "recours" && r.recours
    ? "· recours le " + formatDate(r.recours.introduitLe, "date-short")
    : r.limite ? "jusqu'au " + formatDate(r.limite, "date-short") : "";
  return h("span", { class: "fr-small", title: r.texte },
    h("span", { class: "fr-badge fr-badge--" + r.color, text: EXECUTION_COURT[r.code] || "en attente" }),
    suite ? h("span", { class: "fr-muted", text: " " + suite }) : null);
}

// La suppression est réversible : l'acte part à la corbeille, d'où il peut
// revenir. C'est ce que dit le dialogue — « supprimer » ne doit pas faire peur.
// Elle n'est proposée que pour un BROUILLON : un acte signé ou publié a quitté
// l'atelier, et ce qui est signé ne s'efface pas.
async function remove(a) {
  const ok = await confirmDialog(
    "Mettre l'acte à la corbeille",
    `L'acte ${a.numero || ""} quittera le registre et l'échéancier, mais rien n'est effacé : il reste dans la corbeille, d'où il peut être rétabli tel quel.` +
    ` Cet acte n'est ni signé ni publié : c'est encore un brouillon.`,
    { confirmLabel: "Mettre à la corbeille", danger: true },
  );
  if (!ok) return;
  await mettreALaCorbeille("acte", a);
  toast("Acte placé à la corbeille — il peut être rétabli", "warning");
}

// RETIRER OU ABROGER UN ACTE SIGNÉ. Un acte qui a quitté l'atelier ne se met pas
// à la corbeille ; deux voies le concernent, et elles ne se confondent pas :
//   • l'ABROGATION — un acte nouveau, publié, qui le vise expressément. C'est la
//     voie normale : elle laisse au recueil la trace de ce qui a été publié, et
//     de ce qui l'a fait cesser ;
//   • le RETRAIT du recueil — un geste TECHNIQUE et exceptionnel (dépôt en
//     double, erreur de dépôt), réservé aux administrateurs, qui ne se justifie
//     jamais par l'illégalité ou la contestation (voir views/publications.js).
function retirerOuAbroger(a) {
  const publie = a.statut === "publie" || !!a.publication;
  const cible = {
    kind: "acte", acteId: a.id, numero: a.numero || "",
    designation: designationDe(a, state.config, state.trames.find((t) => t.id === a.trameId)),
    date: a.dateSignature || a.values?.dateSignature || "",
    eli: a.eli || docOfActe(a)?.meta?.eli || "",
  };
  const body = h("div", { class: "fr-stack" },
    h("div", { class: "fr-alert fr-alert--warning" },
      h("p", { class: "fr-alert__title", text: publie ? "Un acte publié ne se supprime pas : il s'abroge" : "Un acte signé ne se supprime pas : il s'abroge" }),
      h("p", { class: "fr-small", text: publie
        ? "Cet acte est publié : il reste au recueil, avec son historique, et personne ne doit pouvoir douter de ce qui a été publié. Pour le faire cesser de produire effet, la voie normale est un ACTE D'ABROGATION — un acte nouveau, publié, qui le vise expressément. L'abrogation prendra effet à l'entrée en vigueur de cet acte, non à sa publication."
        : "Cet acte est signé : il est une pièce du dossier. Pour le faire cesser de produire effet, la voie normale est un ACTE D'ABROGATION — un acte nouveau, publié, qui le vise expressément." })),
    h("div", { class: "fr-card fr-card--soft" },
      h("h3", { class: "rx-h3", style: { marginTop: 0 }, text: "Ce que visera l'acte à rédiger" }),
      h("p", { class: "fr-small", style: { margin: 0 }, text: `${avecArticle(cible.designation)}${cible.numero ? " n° " + cible.numero : ""}${cible.date ? " du " + formatDate(cible.date, "date-long") : ""} — ${a.objet || docOfActe(a)?.meta?.objet || "sans objet"}` }),
      h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" },
        text: "Vous choisirez ensuite la trame de l'acte d'abrogation ; la clause est prévue d'avance dans son panneau « Abrogations », où vous pourrez la restreindre à un seul article de cet acte." })),
  );
  modal({
    title: `Retirer ou abroger — ${a.numero || a.objet || a.id}`,
    wide: true,
    body,
    actions: (close) => [
      publie && can("publications.depublier") && a.publication?.cle
        ? button("Retrait technique du recueil…", {
          variant: "tertiary", icon: "trash",
          onClick: () => { close(); navigate("publication/" + encodeURIComponent(a.publication.cle)); },
        })
        : null,
      button("Fermer", { variant: "secondary", onClick: close }),
      button("Rédiger un acte d'abrogation", { variant: "primary", icon: "note", onClick: () => { close(); redigerAbrogation(cible); } }),
    ].filter(Boolean),
  });
}
