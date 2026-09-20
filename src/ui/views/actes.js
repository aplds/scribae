import {
  state, touch, navigate, can, visibleActes, actePubliable, actesCorbeille,
  mettreALaCorbeille, journaliser, circuitDe, parapheur as fileParapheur,
} from "../state.js";
import { h, button, toast, modal, icon } from "../dom.js";
import { download, formatDate } from "../../lib/util.js";
import { confirmDialog, emptyState, acteStatutLabel as statutLabel, acteStatutColor as statutColor } from "../components.js";
import { helpLink } from "../components.js";
import { targetLabel } from "../../lib/scope.js";
import { openActe } from "./rediger.js";
import { docOfActe, modifierFromActe, natureOf, ecartsOfActe } from "./modifier.js";
import { exportAkn, exportJsonLd, exportMarkdown, exportStandaloneHtml, exportWordDoc, printDocument } from "../../lib/export.js";
import { demarrerValidation, etapeActive, validationAJour, etatParapheur } from "../../lib/validation.js";
import { resumeExecution } from "../../lib/execution.js";

export function renderActes(root) {
  const tous = can("actes.tous");
  const list = [...visibleActes()].sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Actes" }),
      h("p", { class: "page-head__sub", text: tous
        ? "Registre local : actes rédigés, actes importés, actes modificatifs et versions consolidées."
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
      h("th", { text: "Parapheur" }), h("th", { text: "Exécution" }), h("th", { text: "Publication" }), h("th", {}),
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
      h("td", { class: "fr-mono", text: a.numero || "—" }),
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
      h("td", {}, h("span", { class: "fr-badge fr-badge--" + statutColor(a.statut), text: statutLabel(a.statut) })),
      // Où en est l'acte au parapheur : validé, en attente, caduc (le texte a
      // changé depuis la validation), ou hors circuit.
      h("td", {}, celluleParapheur(a)),
      h("td", {}, celluleExecution(a)),
      h("td", {}, a.publication
        ? h("span", { class: "fr-small" },
          h("span", { class: "fr-mono", text: a.publication.eliUri || a.eli || "" }),
          h("br"),
          h("span", { class: "fr-muted", text: "opposable le " + formatDate(a.publication.dateOpposabilite) }))
        : !actePubliable(a)
          ? h("span", { class: "fr-badge fr-badge--warning", title: "Trame non publiable : l'acte est signé et conservé, mais jamais déposé au recueil.", text: "non publiable" })
          : h("span", { class: "fr-small fr-muted", text: "—" })),
      h("td", {}, h("div", { class: "fr-row" },
        editable ? button("Reprendre", { variant: "secondary", size: "sm", icon: "note", title: "Rouvrir le document pour le modifier", onClick: () => openActe(a) }) : null,
        button(doc ? "Voir" : "Ouvrir", { variant: "tertiary", size: "sm", onClick: () => (doc ? navigate("acte/" + a.id) : openActe(a)) }),
        can("actes.gerer")
          ? (actePubliable(a)
            ? button("Modifier", { variant: "tertiary", size: "sm", icon: "refresh", title: "Rédiger un acte modificatif", onClick: () => modifierFromActe(a) })
            // Un acte non publiable ne se modifie pas par acte modificatif (qui
            // n'existe que pour le texte publié) : on corrige l'acte lui-même.
            : button("Corriger", { variant: "tertiary", size: "sm", icon: "note", title: "Acte non publiable : correction directe, sans acte modificatif", onClick: () => openActe(a) }))
          : null,
        can("signature.gerer") ? button("", { variant: "tertiary", icon: "lock", size: "sm", title: "Envoyer en signature / publier", onClick: () => signer(a) }) : null,
        can("signature.gerer") ? button("", { variant: "tertiary", icon: "check", size: "sm", title: "Enregistrer une formalité d'exécution (transmission, publication, notification)", onClick: () => { state.execution = { ...(state.execution || {}), acteId: a.id }; navigate("execution"); } }) : null,
        button("", { variant: "tertiary", icon: "download", size: "sm", title: "Exporter", onClick: () => quickExport(a) }),
        can("actes.gerer") ? button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Mettre à la corbeille", onClick: () => remove(a) }) : null,
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
// d'une formalité, ou définitif.
function celluleExecution(a) {
  if (!(a.original || a.statut === "signee" || a.statut === "publie")) return h("span", { class: "fr-small fr-muted", text: "—" });
  const r = resumeExecution(a, state.config, { publiable: actePubliable(a), trame: state.trames.find((t) => t.id === a.trameId) });
  return h("span", { class: "fr-small", title: r.texte },
    h("span", { class: "fr-badge fr-badge--" + r.color, text: r.code === "definitif" ? "définitif" : r.code === "executoire" ? "exécutoire" : "en attente" }),
    r.limite ? h("span", { class: "fr-muted", text: " jusqu'au " + formatDate(r.limite, "date-short") }) : null);
}

// La suppression est réversible : l'acte part à la corbeille, d'où il peut
// revenir. C'est ce que dit le dialogue — « supprimer » ne doit pas faire peur.
async function remove(a) {
  const ok = await confirmDialog(
    "Mettre l'acte à la corbeille",
    `L'acte ${a.numero || ""} quittera le registre et l'échéancier, mais rien n'est effacé : il reste dans la corbeille, d'où il peut être rétabli tel quel.`,
    { confirmLabel: "Mettre à la corbeille", danger: true },
  );
  if (!ok) return;
  await mettreALaCorbeille("acte", a);
  toast("Acte placé à la corbeille — il peut être rétabli", "warning");
}
