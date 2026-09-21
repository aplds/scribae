// ============================================================================
// Constater une formalité, ou l'existence d'un recours, depuis n'importe quel
// écran.
//
// « Transmis au contrôle de légalité le 12 mars, accusé @ctes n° 2026-0412 » :
// une formalité n'est pas une déduction de l'application, c'est une attestation
// de l'agent. Le formulaire qui la recueille est le même que celui de
// l'échéancier (src/ui/views/execution.js) et celui de la fiche d'un acte
// (src/ui/views/modifier.js) : une seule saisie, une seule journalisation.
//
// Le recours suit la même règle. L'application ne peut pas savoir qu'une requête
// a été déposée : elle le tient de l'agent qui a reçu la pièce, avec sa date
// d'introduction — celle qui ferme le délai de recours contentieux.
// ============================================================================
import { state, touch, journaliser, redrawView, actePubliable, trameById } from "./state.js";
import { h, button, toast, modal } from "./dom.js";
import { textField, selectField } from "./components.js";
import {
  enregistrerFormalite, effacerFormalite, enregistrerRecours, effacerRecours, recoursDe,
  dateExecutoire, aujourdhui,
  TRANSMISSION_MODES, PUBLICATION_MODES, NOTIFICATION_MODES, RECOURS_TYPES, recoursTypeLabel,
} from "../lib/execution.js";
import { envoyerNotification } from "../lib/courriel.js";

const nom = (u) => (u ? [u.firstName, u.lastName].filter(Boolean).join(" ") : "");

export function ouvrirFormulaireFormalite(a, f, { paint = redrawView } = {}) {
  const e = (a.execution || {})[f.id] || {};
  const data = {
    at: e.at || aujourdhui(),
    ref: e.ref || "",
    mode: e.mode || "",
    destinataires: e.destinataires || "",
    courriel: e.courriel || "",
  };
  // Le courriel de notification, quand la formalité le permet : l'agent qui
  // notifie un acte individuel à l'intéressé le fait ordinairement par courriel.
  // Le message part par le serveur SMTP du déploiement ; sans serveur configuré,
  // l'envoi est TRACÉ « non envoyé » (jamais silencieux).
  const adresseConnue = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || "").trim());
  const caseMail = f.id === "notification" ? h("input", { type: "checkbox", checked: adresseConnue(data.courriel) }) : null;
  const courrielInput = f.id === "notification" ? h("input", { class: "fr-input", type: "email", placeholder: "adresse@example.fr", value: data.courriel || (adresseConnue(data.destinataires) ? data.destinataires : "") }) : null;
  const blocMail = f.id === "notification"
    ? h("div", { class: "fr-card fr-card--soft" },
      h("p", { class: "fr-small fr-muted", style: { margin: "0 0 6px" }, text: "Notifier aussi par courriel. Le message part par le serveur SMTP du déploiement ; s'il n'est pas configuré, l'envoi est constaté « non envoyé » au journal de l'acte." }),
      h("label", { class: "fr-check" }, caseMail, "Envoyer l'acte à l'intéressé par courriel"),
      h("div", { class: "fr-field" },
        h("label", { class: "fr-label", text: "Adresse du destinataire" }),
        courrielInput))
    : null;
  const modes = f.id === "transmission" ? TRANSMISSION_MODES : f.id === "notification" ? NOTIFICATION_MODES : PUBLICATION_MODES;
  // Les constantes portent `id` et `label` ; un `<select>` attend `value` et
  // `label`. Sans cette conversion, c'est le LIBELLÉ qui serait enregistré à la
  // place de l'identifiant, et la modalité ne se relirait plus.
  const optionsMode = modes.map((m) => ({ value: m.id, label: m.label }));
  const body = h("div", { class: "fr-stack" },
    h("p", { class: "fr-small fr-muted", text: f.label }),
    textField({ label: "Date de la formalité", type: "date", value: data.at, onChange: (v) => { data.at = v; } }),
    textField({
      label: "Référence", value: data.ref,
      help: f.id === "transmission" ? "Numéro d'accusé de réception, identifiant @ctes, bordereau…" : f.id === "notification" ? "Numéro de recommandé, référence de remise…" : "Référence du recueil (ex. « RAA n° 2026-04 du 16 février 2026 »).",
      onChange: (v) => { data.ref = v; },
    }),
    selectField({ label: "Modalité", value: data.mode, options: optionsMode, onChange: (v) => { data.mode = v; } }),
    f.id === "notification" ? textField({ label: "Destinataire(s)", value: data.destinataires, help: "La personne ou les personnes à qui l'acte a été notifié.", onChange: (v) => { data.destinataires = v; } }) : null,
    blocMail,
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
          if (f.id === "notification") data.courriel = String(courrielInput.value || "").trim();
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
          // Le courriel de notification : il part APRÈS la constatation, et son
          // sort est dit à l'agent — un envoi qui ne part pas ne passe pas
          // inaperçu.
          if (f.id === "notification" && caseMail.checked && data.courriel) {
            const trace = await envoyerNotification("notification_interesse", {
              config: state.config, acte: a, brand: state.config.brand.name,
              destinataires: [{ nom: data.destinataires || "", courriel: data.courriel }],
              complement: `L'acte ${a.numero ? "n° " + a.numero : ""} « ${a.objet || ""} » vous est notifié. Il est exécutoire à compter du ${data.at}.`,
            });
            toast(trace.envoye
              ? "Notification envoyée par courriel à " + data.courriel + "."
              : "Notification non envoyée par courriel : " + (trace.motif || "motif inconnu"),
              trace.envoye ? "success" : "warning");
          }
          if (exe) toast("Formalité enregistrée : l'acte est exécutoire", "success");
          else if (!(f.id === "notification" && caseMail.checked)) toast("Formalité enregistrée", "success");
          close();
          paint();
        },
      }),
    ],
  });
}

// ------------------------------------------------------------------ recours
// Constater l'existence d'un recours : une requête est partie contre l'acte, et
// l'administration l'a reçue — lettre du requérant, avis d'enregistrement du
// greffe, déféré du préfet. Comme la formalité, ce n'est pas une déduction mais
// une constatation : d'où la date d'introduction, la nature du recours, son
// auteur et sa référence. Enregistrer un recours ferme le délai : l'acte n'est
// plus susceptible de devenir définitif, et il ne peut plus être attesté qu'il
// n'y a pas eu de recours.
export function ouvrirFormulaireRecours(a, { paint = redrawView } = {}) {
  const e = recoursDe(a) || {};
  const data = {
    introduitLe: e.introduitLe || aujourdhui(),
    type: e.type || "contentieux",
    demandeur: e.demandeur || "",
    ref: e.ref || "",
    note: e.note || "",
  };
  const body = h("div", { class: "fr-stack" },
    h("p", { class: "fr-small fr-muted", text: `${a.numero || a.id} — ${a.objet || ""}` }),
    h("p", { class: "fr-small", text: "La date d'introduction est celle de la requête (ou de sa réception, pour un recours gracieux) : elle ferme le délai de recours contentieux, et l'acte reste contesté jusqu'à la décision du juge." }),
    textField({ label: "Date d'introduction", type: "date", value: data.introduitLe, required: true, onChange: (v) => { data.introduitLe = v; } }),
    selectField({ label: "Nature du recours", value: data.type, options: RECOURS_TYPES.map((t) => ({ value: t.id, label: t.label })), onChange: (v) => { data.type = v; } }),
    textField({
      label: "Auteur du recours", value: data.demandeur,
      help: "Le requérant — personne, association, entreprise — ou « préfet » pour un déféré du contrôle de légalité.",
      onChange: (v) => { data.demandeur = v; },
    }),
    textField({
      label: "Référence", value: data.ref,
      help: "Numéro d'enregistrement au greffe (ex. « 2601234 »), lettre recommandée, référence de l'avis de réception…",
      onChange: (v) => { data.ref = v; },
    }),
    textField({
      label: "Observation", rows: 3, value: data.note,
      help: "Ce qu'il faut savoir : moyens soulevés, demande de suspension, audience, désistement, décision rendue…",
      onChange: (v) => { data.note = v; },
    }),
  );
  modal({
    title: e.introduitLe ? "Corriger la mention de recours" : "Enregistrer un recours",
    body,
    actions: (close) => [
      e.introduitLe ? button("Retirer la mention", {
        variant: "tertiary",
        onClick: async () => {
          effacerRecours(a);
          a.updatedAt = new Date().toISOString();
          touch("actes", { rerender: false });
          await journaliser({
            action: "recours.effacement", cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
            detail: "mention de recours retirée : " + (recoursTypeLabel(e.type) || "recours") + " du " + e.introduitLe,
            to: [a.createdBy || "", "role:editeur"],
          });
          toast("Mention retirée : l'acte reprend son état selon le délai de recours", "warning");
          close();
          paint();
        },
      }) : null,
      button("Annuler", { variant: "secondary", onClick: close }),
      button("Enregistrer", {
        variant: "primary", icon: "check",
        onClick: async () => {
          enregistrerRecours(a, { ...data, by: state.user?.id, byName: nom(state.user) });
          a.updatedAt = new Date().toISOString();
          touch("actes", { rerender: false });
          await journaliser({
            action: "recours.enregistrement", cible: "acte", cibleLabel: a.numero || a.id, acteId: a.id,
            detail: `${recoursTypeLabel(data.type) || "Recours"} introduit le ${data.introduitLe}${data.demandeur ? " par " + data.demandeur : ""}${data.ref ? " (réf. " + data.ref + ")" : ""} — délai de recours clos`,
            to: [a.createdBy || "", "role:editeur"],
          });
          toast("Recours enregistré : le délai de recours est clos", "success");
          close();
          paint();
        },
      }),
    ],
  });
}
