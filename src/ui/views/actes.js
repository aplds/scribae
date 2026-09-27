import {
  state, touch, navigate, can, visibleActes, actePubliable, actesCorbeille,
  mettreALaCorbeille, journaliser, circuitDe, parapheur as fileParapheur, parapheurActif,
  competenceDeSignature, redrawView, currentUser,
} from "../state.js";
import { h, button, toast, modal, icon, select, textInput, clear } from "../dom.js";
import { post, errorMessage, beginFlow } from "../../lib/remote.js";
import { publicationSettings } from "../../lib/eli.js";
import { download, formatDate } from "../../lib/util.js";
import { confirmDialog, emptyState, isDraftable, abrogationBadge, acteStatutLabel as statutLabel, acteStatutColor as statutColor, mentions, menuButton, pageTitle } from "../components.js";
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
      pageTitle("Actes" , tous
        ? "Registre local : actes rédigés, actes importés, actes modificatifs et versions consolidées."
        : signataire
          ? "Vos actes, et ceux dont la signature relève de vous (la vôtre, ou celle que vous avez déléguée). Un administrateur ou un éditeur voit l'ensemble du registre."
          : "Vos actes : les actes que vous avez rédigés dans votre périmètre (service et bureaux). Un administrateur ou un éditeur voit l'ensemble du registre." ),
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

  // ========================================================= LE REGISTRE
  // Quatre cents actes ne se lisent pas d'un seul défilement : on y CHERCHE.
  // La barre d'outils reste en haut (recherche, filtres, compte), vingt-cinq
  // lignes s'affichent, et le reste de ce qu'un acte savait dire — sa trame, son
  // service, son entité, sa signature, ses écarts, où il en est au parapheur, à
  // l'exécution et au recueil — se déplie sous la ligne, à la demande. La ligne,
  // elle, ne porte plus qu'un statut, une ligne de mentions et un geste.
  // (Revue d'interface, P3 et P5.)
  const ui = (state.ui.registre = state.ui.registre || { q: "", statut: "", service: "", annee: "", affiches: 25 });
  const ouverts = ui.ouverts instanceof Set ? ui.ouverts : (ui.ouverts = new Set());

  const anneeDe = (a) => {
    const an = String(a.dateSignature || a.createdAt || a.updatedAt || "").slice(0, 4);
    return /^\d{4}$/.test(an) ? an : "";
  };
  const annees = [...new Set(list.map(anneeDe).filter(Boolean))].sort().reverse();
  const servicesPresents = [...new Set(list.map((a) => a.serviceId).filter(Boolean))]
    .map((id) => ({ id, label: targetLabel(state.config, id, "") }))
    .sort((x, y) => x.label.localeCompare(y.label));
  const statutsPresents = [...new Set(list.map((a) => a.statut || "brouillon"))];
  const trameDe = (a) => state.trames.find((t) => t.id === a.trameId);
  const execDe = (a) => (a.original || a.statut === "signee" || a.statut === "publie")
    ? resumeExecution(a, state.config, { publiable: actePubliable(a), trame: trameDe(a) })
    : null;

  function filtrer() {
    const q = (ui.q || "").trim().toLowerCase();
    return list.filter((a) => {
      if (ui.statut && (a.statut || "brouillon") !== ui.statut) return false;
      if (ui.service && a.serviceId !== ui.service) return false;
      if (ui.annee && anneeDe(a) !== ui.annee) return false;
      if (!q) return true;
      const texte = [
        a.numero, a.objet, a.values?.objet, trameDe(a)?.name, a.createdByName,
        a.serviceId ? targetLabel(state.config, a.serviceId, a.bureauId) : "",
        natureOf(a).label,
      ].filter(Boolean).join(" ").toLowerCase();
      return texte.includes(q);
    });
  }

  // La barre d'outils : la recherche d'abord (c'est ce qu'on fait d'un registre),
  // puis trois filtres qui répondent aux trois questions qu'on se pose — quel
  // statut, quel service, quelle année —, et le compte sous la barre.
  const champ = (label, control) => h("div", { class: "liste-barre__champ" },
    h("label", { class: "fr-label", text: label }), control);
  const barre = h("div", { class: "liste-barre no-print" },
    champ("Rechercher", textInput(ui.q, (v) => { ui.q = v; ui.affiches = 25; peindre(); }, { placeholder: "numéro, objet, trame, service…" })),
    statutsPresents.length > 1 ? champ("Statut", select([{ value: "", label: "Tous les statuts" }, ...statutsPresents.map((s) => ({ value: s, label: statutLabel(s) }))], ui.statut, (v) => { ui.statut = v; ui.affiches = 25; peindre(); })) : null,
    servicesPresents.length > 1 ? champ("Service", select([{ value: "", label: "Tous les services" }, ...servicesPresents.map((s) => ({ value: s.id, label: s.label }))], ui.service, (v) => { ui.service = v; ui.affiches = 25; peindre(); })) : null,
    annees.length > 1 ? champ("Année", select([{ value: "", label: "Toutes les années" }, ...annees.map((an) => ({ value: an, label: an }))], ui.annee, (v) => { ui.annee = v; ui.affiches = 25; peindre(); })) : null,
  );

  const tb = h("tbody");
  const compteEl = h("p", { class: "liste-compte" });
  const plusEl = h("div", { class: "liste-plus" });
  const table = h("table", { class: "fr-table" },
    h("thead", {}, h("tr", {},
      h("th", { scope: "col", text: "Numéro" }),
      h("th", { scope: "col", text: "Objet" }),
      h("th", { scope: "col", text: "Statut" }),
      h("th", { scope: "col", class: "registre__gestes-col", text: "Actions" }),
    )),
  );

  // CE QUE LA LIGNE NE DIT PLUS, et qu'on lit à la demande : la fiche dépliée.
  function detailsDe(a) {
    const entity = state.config.entities?.find((e) => e.id === a.entityId);
    const doc = docOfActe(a);
    const editable = canEdit(a);
    const ec = editable ? ecartsOfActe(a) : { count: 0, list: [] };
    const exec = execDe(a);
    const php = parapheurActif() ? etatParapheur(a) : null;
    const fait = (label, valeur) => h("div", { class: "registre__fait" },
      h("dt", { text: label }), h("dd", {}, valeur || h("span", { class: "fr-muted", text: "—" })));
    return h("tr", { class: "registre__details" },
      h("td", { colspan: "4" },
        h("dl", { class: "registre__fiche" },
          fait("Nature", natureOf(a).label),
          fait("Trame", trameDe(a)?.name),
          fait("Service", a.serviceId ? targetLabel(state.config, a.serviceId, a.bureauId) : "Général"),
          fait("Entité", entity?.name || entity?.code),
          fait("Signature", a.dateSignature ? formatDate(a.dateSignature, "date-long") : null),
          fait("Parapheur", php ? (a.validation?.circuitLabel ? a.validation.circuitLabel + " — " + php.label : php.label) : "aucun circuit applicable"),
          fait("Exécution", exec?.texte),
          fait("Publication", a.publication
            ? [
              h("span", { class: "fr-mono", text: a.publication.eliUri || a.eli || "" }),
              h("span", { class: "fr-muted", text: a.publication.juridique === false ? " · document non opposable" : " · opposable le " + formatDate(a.publication.dateOpposabilite) }),
            ]
            : (natureOfActe(a, state.trames) === "annexe"
              ? "annexe : elle suit l'acte qui l'adopte"
              : (actePubliable(a) ? "pas encore déposé au recueil" : "acte non publiable : il n'est jamais déposé"))),
          fait("Écarts", ec.count ? ec.list.map((e) => e.label).join(" · ") : "aucun passage réécrit"),
          doc ? fait("Document", a.updatedAt ? "mis à jour le " + formatDate(a.updatedAt, "date-long") : null) : null,
        ),
      ));
  }

  function ligneDe(a) {
    const entity = state.config.entities?.find((e) => e.id === a.entityId);
    const doc = docOfActe(a);
    const editable = canEdit(a);
    const ec = editable ? ecartsOfActe(a) : { count: 0, list: [] };
    const exec = execDe(a);
    const php = parapheurActif() ? etatParapheur(a) : null;
    const annexe = natureOfActe(a, state.trames) === "annexe";
    const ouvert = ouverts.has(a.id);
    return h("tr", { class: "registre__ligne" + (ouvert ? " is-ouvert" : ""), title: a.createdByName ? "Rédigé par " + a.createdByName : "" },
      h("td", { class: "fr-mono registre__numero" },
        h("button", {
          class: "registre__deplie", type: "button", "aria-expanded": ouvert ? "true" : "false",
          title: ouvert ? "Masquer le détail" : "Afficher le détail de l'acte",
          on: { click: () => { if (ouvert) ouverts.delete(a.id); else ouverts.add(a.id); peindre(); } },
        }, icon(ouvert ? "down" : "right", 15)),
        h("span", { text: numeroAffiche(a, state.config, state.trames) || "—" })),
      h("td", { class: "registre__objet-cell" },
        h("span", { class: "registre__objet", text: a.objet || doc?.meta?.objet || "—" }),
        mentions([
          natureOf(a).label,
          trameDe(a)?.name,
          a.serviceId ? targetLabel(state.config, a.serviceId, a.bureauId) : "Général",
          entity?.code,
          a.dateSignature ? "signé le " + formatDate(a.dateSignature) : null,
          ec.count ? { text: ec.count + " écart" + (ec.count > 1 ? "s" : ""), alerte: true, title: ec.list.map((e) => e.label).join(" · ") } : null,
          php ? { text: php.label, alerte: php.color === "error", title: a.validation?.circuitLabel ? "Circuit : " + a.validation.circuitLabel : "" } : null,
          exec && exec.code === "en_attente" ? { text: "formalité à faire", alerte: true, title: exec.texte } : null,
          a.publication
            ? "publié"
            : (!actePubliable(a)
              ? { text: annexe ? "annexe" : "non publiable", alerte: !annexe, title: annexe ? "Elle ne se signe ni ne se publie pour elle-même : son texte suit l'acte qui l'adopte." : "Trame non publiable : l'acte est signé et conservé, mais jamais déposé au recueil." }
              : null),
          acteEpingle(a) && a.publication ? "à la une" : null,
        ])),
      h("td", {}, h("span", { class: "fr-badge fr-badge--" + statutColor(a.statut), text: statutLabel(a.statut) }), abrogationBadge(a)),
      h("td", { class: "registre__gestes" }, h("div", { class: "fr-row", style: { justifyContent: "flex-end" } },
        editable
          ? button("Reprendre", { variant: "secondary", size: "sm", icon: "note", title: "Rouvrir le document pour le modifier", onClick: () => openActe(a) })
          : button(doc ? "Voir" : "Ouvrir", { variant: "secondary", size: "sm", onClick: () => (doc ? navigate("acte/" + a.id) : openActe(a)) }),
        menuButton([
          editable ? { label: doc ? "Voir l'acte" : "Ouvrir l'acte", icon: "eye", onClick: () => (doc ? navigate("acte/" + a.id) : openActe(a)) } : null,
          can("actes.gerer")
            ? ((actePubliable(a) || annexe)
              ? { label: annexe ? "Modifier l'annexe" : "Modifier", icon: "refresh", title: annexe ? "Rédiger l'acte modificatif qui adoptera la nouvelle rédaction de l'annexe" : "Rédiger un acte modificatif", onClick: () => modifierFromActe(a) }
              : { label: "Corriger", icon: "note", title: "Acte non publiable : correction directe, sans acte modificatif", onClick: () => openActe(a) })
            : null,
          can("actes.signer") ? { label: "Signer", icon: "lock", title: "Signer l'acte (ou suivre son circuit)", onClick: () => signer(a) } : null,
          can("signature.gerer") ? { label: "Formalité d'exécution", icon: "check", title: "Enregistrer une formalité (transmission, publication, notification)", onClick: () => { state.execution = { ...(state.execution || {}), acteId: a.id }; navigate("execution"); } } : null,
          { label: "Exporter", icon: "download", onClick: () => quickExport(a) },
          peutEpingler(a) ? {
            label: acteEpingle(a) ? "Retirer de la une du recueil" : "Mettre à la une du recueil",
            icon: "pin", title: "La bande « À la une » du recueil public", onClick: () => basculerEpinglage(a),
          } : null,
          can("actes.gerer") ? { separator: true } : null,
          can("actes.gerer")
            ? (isDraftable(a.statut)
              ? { label: "Mettre à la corbeille", icon: "trash", danger: true, onClick: () => remove(a) }
              : { label: "Retirer du recueil, ou abroger", icon: "x", danger: true, onClick: () => retirerOuAbroger(a) })
            : null,
        ], { title: "Autres gestes sur cet acte" }),
      )),
    );
  }

  function peindre() {
    clear(tb);
    const lignes = filtrer();
    const vues = lignes.slice(0, ui.affiches);
    for (const a of vues) {
      tb.appendChild(ligneDe(a));
      if (ouverts.has(a.id)) tb.appendChild(detailsDe(a));
    }
    if (!vues.length) {
      tb.appendChild(h("tr", {}, h("td", { colspan: "4" },
        emptyState("Aucun acte ne correspond à cette recherche.", button("Effacer les filtres", {
          variant: "secondary",
          onClick: () => { ui.q = ""; ui.statut = ""; ui.service = ""; ui.annee = ""; ui.affiches = 25; redrawView(); },
        })))));
    }
    const restants = lignes.length - vues.length;
    const nom = " acte" + (lignes.length > 1 ? "s" : "");
    compteEl.textContent = restants > 0
      ? lignes.length + nom + " — " + vues.length + " affiché" + (vues.length > 1 ? "s" : "")
      : lignes.length + nom;
    clear(plusEl);
    if (restants > 0) {
      plusEl.appendChild(button("Afficher les " + Math.min(25, restants) + " suivants", {
        variant: "secondary", size: "sm", icon: "down",
        onClick: () => { ui.affiches += 25; peindre(); },
      }));
      plusEl.appendChild(button("Tout afficher (" + lignes.length + ")", {
        variant: "tertiary", size: "sm",
        onClick: () => { ui.affiches = lignes.length; peindre(); },
      }));
    }
  }

  root.appendChild(barre);
  root.appendChild(compteEl);
  table.appendChild(tb);
  root.appendChild(h("div", { class: "fr-table-wrap" }, table));
  root.appendChild(plusEl);
  let withEcarts = 0;
  for (const a of list) {
    if (canEdit(a) && ecartsOfActe(a).count) withEcarts++;
  }
  peindre();
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
