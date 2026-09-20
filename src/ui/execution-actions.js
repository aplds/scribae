// ============================================================================
// Constater une formalité, depuis n'importe quel écran.
//
// « Transmis au contrôle de légalité le 12 mars, accusé @ctes n° 2026-0412 » :
// une formalité n'est pas une déduction de l'application, c'est une attestation
// de l'agent. Le formulaire qui la recueille est le même que celui de
// l'échéancier (src/ui/views/execution.js) et celui de la fiche d'un acte
// (src/ui/views/modifier.js) : une seule saisie, une seule journalisation.
// ============================================================================
import { state, touch, journaliser, redrawView, actePubliable, trameById } from "./state.js";
import { h, button, toast, modal } from "./dom.js";
import { textField, selectField } from "./components.js";
import {
  enregistrerFormalite, effacerFormalite, dateExecutoire, aujourdhui,
  TRANSMISSION_MODES, PUBLICATION_MODES, NOTIFICATION_MODES,
} from "../lib/execution.js";

const nom = (u) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "");

export function ouvrirFormulaireFormalite(a, f, { paint = redrawView } = {}) {
  const e = (a.execution || {})[f.id] || {};
  const data = {
    at: e.at || aujourdhui(),
    ref: e.ref || "",
    mode: e.mode || "",
    destinataires: e.destinataires || "",
  };
  const modes = f.id === "transmission" ? TRANSMISSION_MODES : f.id === "notification" ? NOTIFICATION_MODES : PUBLICATION_MODES;
  const body = h("div", { class: "fr-stack" },
    h("p", { class: "fr-small fr-muted", text: f.label }),
    textField({ label: "Date de la formalité", type: "date", value: data.at, onChange: (v) => { data.at = v; } }),
    textField({
      label: "Référence", value: data.ref,
      help: f.id === "transmission" ? "Numéro d'accusé de réception, identifiant @ctes, bordereau…" : f.id === "notification" ? "Numéro de recommandé, référence de remise…" : "Référence du recueil (ex. « RAA n° 2026-04 du 16 février 2026 »).",
      onChange: (v) => { data.ref = v; },
    }),
    selectField({ label: "Modalité", value: data.mode, options: modes, onChange: (v) => { data.mode = v; } }),
    f.id === "notification" ? textField({ label: "Destinataire(s)", value: data.destinataires, help: "La personne ou les personnes à qui l'acte a été notifié.", onChange: (v) => { data.destinataires = v; } }) : null,
    f.id === "publication" ? h("p", { class: "fr-hint", text: "Renseignez ce formulaire pour une publication constatée hors de la chaîne ELI (recueil papier, affichage, site internet). Lorsque l'acte est publié depuis l'écran « Signature & publication », la formalité se constate d'elle-même." }) : null,
  );
  modal({
    title: "Enregistrer la formalité",
    body,
    actions: (close) => [
      e.at ? button("Effacer la constatation", {
        variant: "tertiary",
        onClick: async () => {
          effacerFormalite(a, f.id);
          a.updatedAt = new Date().toISOString();
          touch("actes", { rerender: false });
          await journaliser({ action: "formalite.effacement", cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id, detail: "constatation effacée : " + f.label, to: [] });
          toast("Constatation effacée", "warning");
          close();
          paint();
        },
      }) : null,
      button("Annuler", { variant: "secondary", onClick: close }),
      button("Enregistrer", {
        variant: "primary", icon: "check",
        onClick: async () => {
          enregistrerFormalite(a, f.id, { ...data, by: state.user?.id, byName: nom(state.user) });
          a.updatedAt = new Date().toISOString();
          const opts = { publiable: actePubliable(a), trame: trameById(a.trameId) };
          const exe = dateExecutoire(a, opts);
          touch("actes", { rerender: false });
          await journaliser({
            action: "formalite." + f.id, cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
            detail: `${f.label} : ${data.at}${data.ref ? " (réf. " + data.ref + ")" : ""}${exe ? " — acte exécutoire" : ""}`,
            to: [a.createdBy || "", "role:editeur"],
          });
          toast(exe ? "Formalité enregistrée : l'acte est exécutoire" : "Formalité enregistrée", "success");
          close();
          paint();
        },
      }),
    ],
  });
}
