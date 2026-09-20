// ============================================================================
// Corbeille — les objets retirés du registre, et leur retour possible.
//
// La suppression est RÉVERSIBLE. Un acte mis de côté, une trame devenue
// inutile : ils quittent le registre, mais restent dans les données jusqu'à leur
// suppression définitive. Rien n'est perdu par inadvertance — et supprimer
// définitivement n'est pas à la portée de tout le monde.
// ============================================================================
import {
  state, navigate, redrawView, can, actesCorbeille, tramesCorbeille,
  restaurer, supprimerDefinitivement,
} from "../state.js";
import { h, button, toast } from "../dom.js";
import { confirmDialog, emptyState, helpLink } from "../components.js";
import { formatDate } from "../../lib/util.js";
import { targetLabel } from "../../lib/scope.js";

export function renderCorbeille(root) {
  const actes = actesCorbeille();
  const trames = tramesCorbeille();
  const paint = () => redrawView();
  const gActes = can("actes.gerer");
  const gTrames = can("trames.gerer");

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Corbeille" }),
      h("p", { class: "page-head__sub", text: "Ce qui a été retiré du registre : actes et trames y restent tant qu'ils n'ont pas été supprimés définitivement. Un objet restauré retrouve sa place, son historique et ses formalités." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("corbeille", "Comment faire ?"),
      button("Registre des actes", { variant: "secondary", icon: "list", onClick: () => navigate("actes") }),
    ),
  ));

  if (!actes.length && !trames.length) {
    root.appendChild(emptyState("La corbeille est vide. Un acte ou une trame supprimé arrive ici, et peut être rétabli à tout moment."));
    return;
  }

  if (actes.length) {
    root.appendChild(section(
      "Actes",
      "Un acte à la corbeille ne figure plus dans le registre : il ne compte ni dans les relances, ni dans l'échéancier.",
      actes.map((a) => ligne({
        titre: (a.numero || "acte sans numéro") + " — " + (a.objet || ""),
        sous: [a.serviceId ? targetLabel(state.config, a.serviceId, a.bureauId) : "acte général", a.statut || ""].filter(Boolean).join(" · "),
        deletedAt: a.deletedAt, deletedByName: a.deletedByName,
        onRestaurer: () => restaurer("acte", a).then(() => { toast("Acte restauré", "success"); paint(); }),
        onSupprimer: gActes ? () => supprimer("acte", a, paint) : null,
      })),
    ));
  }

  if (trames.length) {
    root.appendChild(section(
      "Trames",
      "Une trame à la corbeille ne peut plus servir de modèle ; les actes déjà rédigés à partir d'elle restent au registre et s'affichent normalement.",
      trames.map((t) => ligne({
        titre: t.name,
        sous: [t.serviceId ? targetLabel(state.config, t.serviceId, t.bureauId) : "trame générale", "v" + (t.version || "")].join(" · "),
        deletedAt: t.deletedAt, deletedByName: t.deletedByName,
        onRestaurer: () => restaurer("trame", t).then(() => { toast("Trame restaurée", "success"); paint(); }),
        onSupprimer: gTrames ? () => supprimer("trame", t, paint) : null,
      })),
    ));
  }
}

function section(titre, aide, lignes) {
  return h("div", { style: { marginTop: "18px" } },
    h("div", { class: "page-head" },
      h("div", { class: "page-head__text" },
        h("h2", { class: "page-head__title", style: { fontSize: "1.15rem" }, text: `${titre} (${lignes.length})` }),
        h("p", { class: "page-head__sub", text: aide })),
    ),
    h("div", { class: "fr-table-wrap" }, h("table", { class: "fr-table" },
      h("thead", {}, h("tr", {}, h("th", { text: "Objet" }), h("th", { text: "Retiré le" }), h("th", { text: "Par" }), h("th", {}))),
      h("tbody", {}, ...lignes),
    )));
}

function ligne({ titre, sous, deletedAt, deletedByName, onRestaurer, onSupprimer }) {
  return h("tr", {},
    h("td", {}, h("strong", { text: titre }), h("p", { class: "fr-small fr-muted", style: { margin: 0 }, text: sous })),
    h("td", { class: "fr-small", text: formatDate(String(deletedAt || "").slice(0, 10)) }),
    h("td", { class: "fr-small", text: deletedByName || "—" }),
    h("td", {}, h("div", { class: "fr-row" },
      button("Restaurer", { variant: "secondary", size: "sm", icon: "refresh", onClick: onRestaurer }),
      onSupprimer ? button("Supprimer définitivement", { variant: "tertiary", size: "sm", icon: "trash", onClick: onSupprimer }) : null)),
  );
}

async function supprimer(type, obj, paint) {
  const nom = obj.numero || obj.objet || obj.name || obj.id;
  const ok = await confirmDialog(
    "Supprimer définitivement",
    `« ${nom} » sera retiré des données. Cette fois, rien ne permet de le retrouver : l'export du référentiel et la sauvegarde de la base sont les seuls recours.`,
    { confirmLabel: "Supprimer définitivement", danger: true },
  );
  if (!ok) return;
  await supprimerDefinitivement(type, obj);
  toast("Objet supprimé définitivement", "warning");
  paint();
}
