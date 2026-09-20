// ============================================================================
// Les cartes de la révision, partagées.
//
// Le rapport de conformité, le dossier de la révision et la décision du
// réviseur s'affichent à deux endroits : sur l'écran « Révision »
// (src/ui/views/revision.js) et sur la fiche d'un acte
// (src/ui/views/modifier.js), où le rédacteur vient lire le motif d'un rejet.
// Les écrire une fois évite que les deux écrans divergent dans ce qu'ils
// montrent — c'est le même dossier, lu par les mêmes personnes.
//
// Ce module ne lit rien de lui-même : le rapport lui est FOURNI, calculé par
// l'appelant (src/lib/conformite.js). Il ne connaît donc ni les trames ni les
// actes, seulement ce qu'il affiche.
// ============================================================================
import { h, button } from "./dom.js";
import { formatDate } from "../lib/util.js";
import { NIVEAUX, resumeRapport } from "../lib/conformite.js";
import { validerRevisionActe, rejeterRevisionActe } from "./revision-actions.js";

// Une marche du dossier de la révision (même forme que les étapes du parapheur).
export function etapeRevision(titre, fait, ligne) {
  return h("div", { class: "sig-step" + (fait ? " is-done" : "") },
    h("span", { class: "sig-step__dot", text: fait ? "✓" : "•" }),
    h("div", { class: "sig-step__body" },
      h("p", { class: "sig-step__title", text: titre }),
      h("p", { class: "sig-step__line", text: ligne || "en attente" }),
    ),
  );
}

// Le dossier : qui a soumis l'acte, qui a statué, ce qui a été corrigé, et le
// motif d'un rejet — le motif est COMMUNIQUÉ au rédacteur, il est ici chez lui.
export function carteDossierRevision(a, etat) {
  const r = a.revision || {};
  return h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Dossier de révision" }),
    h("div", { class: "sig-steps" },
      etapeRevision("Acte envoyé au réviseur", !!r.demandeeLe,
        [r.demandeeParNom ? `par ${r.demandeeParNom}` : "", r.demandeeLe ? `le ${formatDate(String(r.demandeeLe).slice(0, 10))}` : ""].filter(Boolean).join(" · ")),
      etapeRevision(r.statut === "rejete" ? "Rejeté par le réviseur" : "Révisé", r.statut === "valide" || r.statut === "rejete",
        [
          (r.valideParNom || r.rejeteParNom) || "",
          (r.valideLe || r.rejeteLe) ? `le ${formatDate(String(r.valideLe || r.rejeteLe).slice(0, 10))}` : "",
        ].filter(Boolean).join(" · ") || "en attente de la décision"),
      etapeRevision("Texte contrôlé", r.statut === "valide" || r.statut === "rejete",
        r.corrige ? `corrigé par le réviseur (${r.corrections || 1} version(s) de correction)` : "aucune correction apportée"),
    ),
    r.motif ? h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Motif du rejet — communiqué au rédacteur" }),
      h("p", { class: "fr-small", text: r.motif })) : null,
    etat?.caduque ? h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Révision caduque" }),
      h("p", { class: "fr-small", text: "Le texte de l'acte a été modifié après sa soumission : ce qui a été révisé n'est plus ce que porte l'acte. La révision doit être reprise sur le texte actuel." })) : null,
  );
}

// Le rapport de conformité, groupe par groupe. Il dit aussi ce qui va bien :
// c'est ce qui rend le contrôle lisible d'un coup d'œil.
export function carteRapport(rapport) {
  const c = rapport.compte;
  const box = h("div", { class: "fr-card" });
  box.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Rapport de conformité" }),
    h("span", { class: "fr-badge fr-badge--" + (c.erreurs ? "error" : c.avertissements ? "warning" : "success"), text: resumeRapport(rapport) }),
  ));
  box.appendChild(h("p", { class: "fr-small fr-muted", text: "Établi par les contrôles de l'application : champs obligatoires et règles de la trame, structure du document, visas et références, mentions, publicité, écarts de rédaction et annotations du modèle. Il ne dispense pas de la lecture de l'acte : l'opportunité et la légalité de fond restent à apprécier." }));

  for (const g of rapport.groupes) {
    if (!g.checks.length) continue;
    const aVerifier = g.checks.filter((x) => x.niveau === "erreur" || x.niveau === "attention").length;
    const det = h("details", { class: "rev-rapport__groupe", ...(aVerifier ? { open: true } : {}) });
    det.appendChild(h("summary", {},
      h("span", { class: "rev-rapport__titre", text: g.label }),
      h("span", {
        class: "fr-badge fr-badge--" + (g.checks.some((x) => x.niveau === "erreur") ? "error" : aVerifier ? "warning" : "info"),
        text: aVerifier ? `${aVerifier} point(s) à vérifier` : `${g.checks.length} contrôle(s) conforme(s)`,
      })));
    for (const chk of g.checks) {
      const niv = NIVEAUX[chk.niveau] || NIVEAUX.info;
      det.appendChild(h("div", { class: "rev-check rev-check--" + chk.niveau },
        h("span", { class: "rev-check__dot", title: niv.label, text: niv.icone }),
        h("div", { class: "rev-check__body" },
          h("p", { class: "rev-check__label", text: chk.label }),
          chk.detail ? h("p", { class: "rev-check__detail", text: chk.detail }) : null),
      ));
    }
    box.appendChild(det);
  }
  return box;
}

// La décision du réviseur : elle porte une observation, et le rejet y joint son
// motif. Les gestes passent par les fonctions partagées
// (src/ui/revision-actions.js) : le journal et les notifications sont donc les
// mêmes d'un écran à l'autre.
export function carteDecision(a, rapport, { heading = "h2" } = {}) {
  const zone = h("textarea", { class: "fr-textarea", rows: 3, placeholder: "Observation — obligatoire pour un rejet : c'est elle qui dit au rédacteur quoi corriger" });
  return h("div", { class: "fr-card parapheur-decision" },
    h(heading, { class: "fr-card__title", text: "Décision du réviseur" }),
    h("p", { class: "fr-small fr-muted", text: "Valider envoie l'acte en signature ; rejeter le renvoie en brouillon chez son rédacteur, avec votre motif." }),
    h("label", { class: "fr-label", text: "Observation / motif de rejet" }),
    zone,
    h("div", { class: "fr-row", style: { marginTop: "10px" } },
      button("Valider et envoyer en signature", { variant: "primary", icon: "check", onClick: () => validerRevisionActe(a, { rapport }) }),
      button("Rejeter", { variant: "danger", icon: "x", onClick: () => rejeterRevisionActe(a, zone.value, { rapport }) }),
    ),
  );
}
