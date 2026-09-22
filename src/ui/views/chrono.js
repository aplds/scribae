// ============================================================================
// Écran « Chrono de numérotation ».
//
// Le registre des numéros : chaque acte enregistré, avec son numéro, son RANG,
// son ENTITÉ, son TYPE, son ÉTAT, ses DATES et son RÉDACTEUR — plus les rangs
// jamais attribués (les trous) et les numéros annulés. On y trie (clic sur un
// en-tête), on y filtre (recherche, entité, année, type, état, période), et on
// l'exporte en CSV ou en XLSX.
//
// L'écran ne fait que MONTRER : il lit `lib/chrono.js`, qui reconstitue le
// registre à partir des actes et du référentiel. Les deux gestes d'écriture —
// passer à l'année suivante, annuler un rang — sont réservés à l'administration
// et journalisés.
// ============================================================================
import { state, redrawView, navigate, can, touch, journaliser } from "../state.js";
import { h, button, toast, modal } from "../dom.js";
import { selectField, textField, confirmDialog, emptyState, helpLink } from "../components.js";
import { download, formatDate } from "../../lib/util.js";
import { blobCsv, blobXlsx } from "../../lib/xlsx.js";
import { numberingSettings } from "../../lib/sequence.js";
import {
  COLONNES_CHRONO, ETATS_CHRONO, FILTRES_VIDES, etat as etatChrono,
  lignesChrono, rangsLibres, filtrerTrier, resumeChrono, tableauDe, nomFichierChrono,
} from "../../lib/chrono.js";

const FILTRE_VIDE_RESUME = (f) => Object.values(f).filter((v) => v && v !== true).length === 0;

function filtres() {
  const ui = (state.ui = state.ui || {});
  ui.chronoFiltres = { ...FILTRES_VIDES, ...(ui.chronoFiltres || {}) };
  ui.chronoTri = ui.chronoTri || { cle: "seq", sens: "desc" };
  return { f: ui.chronoFiltres, tri: ui.chronoTri, ui };
}

export function renderChrono(root) {
  const c = state.config;
  const { f, tri, ui } = filtres();
  const brut = lignesChrono(c, state.actes || [], state.trames || []);
  const lignes = brut.concat(rangsLibres(c, brut));
  const visibles = filtrerTrier(lignes, f, tri);
  const resume = resumeChrono(c, lignes);
  const peutGerer = can("referentiel.gerer");

  // -------------------------------------------------------------- en-tête
  const importerExport = (format) => {
    const nom = nomFichierChrono() + (format === "xlsx" ? ".xlsx" : ".csv");
    try {
      if (format === "xlsx") download(nom, blobXlsx([{ nom: "Chrono", lignes: tableauDe(visibles) }], { auteur: c.brand?.name || "Scribae" }));
      else download(nom, blobCsv(tableauDe(visibles)), "text/csv");
      toast(visibles.length + " ligne(s) exportée(s) en " + format.toUpperCase() + ".", "success");
    } catch (e) {
      toast("Export impossible : " + ((e && e.message) || e), "error");
    }
  };

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Chrono de numérotation" }),
      h("p", { class: "page-head__sub", text: "Tous les numéros attribués : leur rang, l'entité et le type d'acte concernés, l'état de l'acte, ses dates et son rédacteur. Les rangs jamais attribués et les numéros annulés y figurent aussi — un trou du chrono s'explique. Cliquez un en-tête pour trier, une ligne pour ouvrir l'acte." }),
    ),
    h("div", { class: "page-head__actions" },
      button("Export CSV", { variant: "secondary", icon: "download", onClick: () => importerExport("csv") }),
      button("Export XLSX", { variant: "secondary", icon: "download", onClick: () => importerExport("xlsx") }),
      helpLink("administrateurs", "Aide"),
    ),
  ));

  // ------------------------------------------------------------- résumé
  const n = numberingSettings(c);
  const anneeCourante = new Date().getFullYear();
  const carte = (label, valeur, detail, ton) => h("div", { class: "chrono-kpi" + (ton ? " chrono-kpi--" + ton : "") },
    h("span", { class: "chrono-kpi__val", text: String(valeur) }),
    h("span", { class: "chrono-kpi__lab", text: label }),
    detail ? h("span", { class: "chrono-kpi__det", text: detail }) : null);

  const porteeLabel = { global: "un seul chrono", entite: "un chrono par entité", type: "un chrono par type d'acte" }[resume.portee] || resume.portee;
  root.appendChild(h("div", { class: "chrono-kpis" },
    carte("Actes numérotés", resume.total, `années ${resume.annees.join(", ") || "—"}`),
    carte("Dernier rang", resume.seqMax || 0, "rangs attribués", "brand"),
    carte("Prochain numéro", resume.prochain, `année ${n.year} · ${porteeLabel}`),
    carte("Rangs libres", resume.libres, resume.libres ? "jamais attribués" : "aucun trou", resume.libres ? "warning" : ""),
    carte("Numéros annulés", resume.annules, resume.annules ? "rang tiré puis abandonné" : "aucun", resume.annules ? "error" : ""),
  ));

  if (n.year < anneeCourante) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { marginBottom: "16px" } },
      h("p", { class: "fr-alert__title", text: `Le chrono est resté sur l'année ${n.year}` }),
      h("p", { class: "fr-small", text: `Nous sommes en ${anneeCourante} : la séquence propose encore des numéros ${n.year}-… . Passez à l'année ${anneeCourante} pour repartir du rang 1 (l'année et, si la séquence est par entité ou par type, tous les compteurs). Une séquence ne revient jamais en arrière : les numéros déjà attribués restent ce qu'ils sont.` }),
      peutGerer ? h("div", { class: "fr-row" },
        button(`Passer à l'année ${anneeCourante}`, {
          variant: "primary", size: "sm", icon: "refresh",
          onClick: async () => {
            const ok = await confirmDialog("Passer à l'année " + anneeCourante,
              "L'année de numérotation devient " + anneeCourante + " et la séquence repart du rang 1. Les numéros déjà attribués ne changent pas. C'est le geste du 1er janvier.",
              { confirmLabel: "Passer à " + anneeCourante });
            if (!ok) return;
            c.numbering = { ...(c.numbering || {}), year: anneeCourante, seq: 1, sequences: {} };
            touch("config", { rerender: false });
            journaliser({ action: "numerotation.annee", cible: "referentiel", cibleLabel: "Numérotation", detail: `année de numérotation portée à ${anneeCourante} (séquence remise au rang 1)` });
            toast("Numérotation passée à l'année " + anneeCourante + ".", "success");
            redrawView();
          },
        })) : null));
  }

  // ------------------------------------------------------------ les filtres
  const optionsEntites = [...new Set(lignes.map((l) => l.entityCode).filter(Boolean))]
    .sort().map((code) => ({ value: code, label: (c.entities || []).find((e) => e.code === code)?.name || code }));
  const optionsAnnees = [...new Set(lignes.map((l) => l.annee).filter(Boolean))].sort().map((a) => ({ value: String(a), label: String(a) }));
  const optionsTypes = (c.actTypes || []).map((t) => ({ value: t.id, label: t.label }));
  const optionsEtats = Object.entries(ETATS_CHRONO).map(([id, v]) => ({ value: id, label: v.label }));

  const poser = (patch) => { Object.assign(state.ui.chronoFiltres, patch); redrawView(); };
  const reinit = () => { state.ui.chronoFiltres = { ...FILTRES_VIDES }; redrawView(); };

  const box = h("div", { class: "fr-card fr-card--soft chrono-filtres" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Filtrer" }),
      !FILTRE_VIDE_RESUME(f) ? button("Réinitialiser", { variant: "tertiary", size: "sm", icon: "refresh", onClick: reinit }) : null,
      h("span", { class: "fr-small fr-muted", text: `${visibles.length} / ${lignes.length} ligne(s)` }),
    ));
  const grille = h("div", { class: "chrono-filtres__grid" });
  grille.appendChild(textField({ label: "Recherche", value: f.q, placeholder: "Numéro, objet, trame, rédacteur…", onChange: (v) => poser({ q: v }) }));
  grille.appendChild(selectField({ label: "Entité", value: f.entityCode, placeholder: "— toutes —", options: optionsEntites, onChange: (v) => poser({ entityCode: v }) }));
  grille.appendChild(selectField({ label: "Année", value: f.annee, placeholder: "— toutes —", options: optionsAnnees, onChange: (v) => poser({ annee: v }) }));
  grille.appendChild(selectField({ label: "Type d'acte", value: f.type, placeholder: "— tous —", options: optionsTypes, onChange: (v) => poser({ type: v }) }));
  grille.appendChild(selectField({ label: "État", value: f.statut, placeholder: "— tous —", options: optionsEtats, onChange: (v) => poser({ statut: v }) }));
  grille.appendChild(selectField({ label: "Source du numéro", value: f.source, placeholder: "— toutes —", options: [{ value: "interne", label: "Séquence interne" }, { value: "externe", label: "Service externe" }], onChange: (v) => poser({ source: v }) }));
  grille.appendChild(textField({ label: "Signé à partir du", value: f.du, type: "date", onChange: (v) => poser({ du: v }) }));
  grille.appendChild(textField({ label: "Signé jusqu'au", value: f.au, type: "date", onChange: (v) => poser({ au: v }) }));
  box.appendChild(grille);
  const caseACocher = (label, cle, aide) => h("label", { class: "fr-check", title: aide || "" },
    h("input", { type: "checkbox", checked: !!f[cle], onChange: (e) => poser({ [cle]: e.target.checked }) }), label);
  box.appendChild(h("div", { class: "fr-row chrono-filtres__cases" },
    caseACocher("Afficher les rangs libres (trous du chrono)", "libres"),
    caseACocher("Afficher les numéros annulés", "annules"),
  ));
  root.appendChild(box);

  // -------------------------------------------------------------- le tableau
  if (!visibles.length) {
    root.appendChild(emptyState(lignes.length
      ? "Aucune ligne ne correspond aux filtres posés."
      : "Aucun numéro n'a encore été attribué : le chrono se remplit à chaque acte rédigé. Réglez la numérotation dans Administration › Numérotation."));
    return;
  }

  const basculerTri = (cle) => {
    if (tri.cle === cle) tri.sens = tri.sens === "asc" ? "desc" : "asc";
    else { tri.cle = cle; tri.sens = "asc"; }
    redrawView();
  };

  const head = h("tr", {}, ...COLONNES_CHRONO.map((col) => h("th", {
    class: "chrono-th" + (tri.cle === col.cle ? " is-sorted" : ""),
    title: "Trier par « " + col.label + " »",
    onClick: () => basculerTri(col.cle),
  }, col.label, tri.cle === col.cle ? h("span", { class: "chrono-th__sens", text: tri.sens === "asc" ? " ▲" : " ▼" }) : null)),
    peutGerer ? h("th", { class: "chrono-th chrono-th--act" }, "") : null);

  const tbody = h("tbody");
  for (const l of visibles) {
    const e = etatChrono(l.etat);
    const estLibre = l.etat === "libre";
    const estAnnule = l.etat === "annule";
    const ouvrable = !!l.acteId && !estLibre && !estAnnule;
    tbody.appendChild(h("tr", {
      class: "chrono-tr" + (estLibre ? " chrono-tr--libre" : "") + (estAnnule ? " chrono-tr--annule" : "") + (ouvrable ? " chrono-tr--clic" : ""),
      title: ouvrable ? "Ouvrir l'acte" : (l.observation || ""),
      onClick: ouvrable ? (() => { state.ui.openActeId = l.acteId; navigate("acte/" + l.acteId); }) : null,
    },
      h("td", {}, h("span", { class: "fr-mono", text: l.numero || (estLibre ? "rang " + l.seq + " libre" : "—") })),
      h("td", {}, l.seq == null ? h("span", { class: "fr-muted", text: "—" }) : String(l.seq)),
      h("td", {}, l.annee ? String(l.annee) : "—"),
      h("td", {}, l.entite || "—"),
      h("td", {}, l.typeLabel || "—"),
      h("td", { class: "chrono-objet", title: l.objet || "" }, l.objet || (estLibre ? l.observation || "—" : "—")),
      h("td", {}, l.trame || "—"),
      h("td", {}, h("span", { class: "fr-badge fr-badge--" + e.color, text: e.label })),
      h("td", {}, l.dateSignature ? formatDate(l.dateSignature) : "—"),
      h("td", {}, l.creeLe ? formatDate(l.creeLe) : "—"),
      h("td", {}, l.majLe ? formatDate(l.majLe) : "—"),
      h("td", {}, l.redacteur || "—"),
      h("td", {}, l.source === "externe" ? "Service externe" : "Interne"),
      h("td", {}, l.reference || "—"),
      peutGerer ? h("td", { class: "chrono-td--act" },
        estLibre ? button("Annuler le numéro", {
          variant: "tertiary", size: "sm", icon: "trash",
          onClick: (ev) => { ev.stopPropagation(); annulerRangDialog(l); },
        }) : null) : null,
    ));
  }
  const table = h("div", { class: "chrono-table-wrap" },
    h("table", { class: "fr-table chrono-table" }, h("thead", {}, head), tbody));
  root.appendChild(table);

  // --------------------------------------------------------- gestes d'écriture
  if (peutGerer && resume.libres) {
    const libres = visibles.filter((l) => l.etat === "libre");
    root.appendChild(h("p", { class: "fr-small fr-muted", text: libres.length
      ? `${libres.length} rang(s) libre(s) dans la vue. Un rang jamais attribué s'explique : cliquez « Annuler le numéro » sur la ligne pour le déclarer annulé, avec son motif — il cessera d'apparaître comme un trou inexpliqué.`
      : "Les rangs libres s'expliquent depuis leur ligne (bouton « Annuler le numéro »), quand l'administration en connaît le motif." }));
  }
  root.appendChild(h("p", { class: "fr-small fr-muted", text: "Le chrono ne renumérote jamais : un numéro attribué est un fait. Pour un acte dont le numéro est faux, ouvrez l'acte et corrigez son numéro — le rang, lui, reste consommé." }));
}

// ------------------------------------------------------------------ actions
// « Annuler un rang » : le rang n'a jamais servi, et l'administration le déclare
// tel — avec son motif. Il reste au chrono, dans l'état « annulé ».
export function annulerRangDialog(ligne) {
  const motifInput = textField({ label: "Motif", placeholder: "Numéro tiré sur un acte abandonné, erreur de saisie…" });
  const boite = h("div", { class: "fr-stack" },
    h("p", { text: `Le rang ${ligne.seq} de l'année ${ligne.annee}${ligne.entityCode ? " (" + ligne.entityCode + ")" : ""} n'a jamais servi. Le déclarer annulé l'explique, sans le remettre à disposition : le chrono ne revient pas en arrière.` }),
    motifInput,
  );
  modal({
    title: "Annuler le rang " + ligne.seq,
    body: boite,
    actions: (close) => [
      button("Annuler", { variant: "secondary", onClick: close }),
      button("Déclarer annulé", {
        variant: "primary",
        onClick: () => {
          const c = state.config;
          const list = [...((c.numbering && c.numbering.annules) || [])];
          list.push({
            numero: "", seq: ligne.seq, annee: ligne.annee, entityCode: ligne.entityCode || "",
            motif: motifInput.value || "Rang jamais attribué", at: new Date().toISOString(),
            par: state.user ? state.user.id : "",
          });
          c.numbering = { ...(c.numbering || {}), annules: list };
          touch("config", { rerender: false });
          journaliser({ action: "numerotation.annule", cible: "referentiel", cibleLabel: `Rang ${ligne.seq}/${ligne.annee}`, detail: motifInput.value || "" });
          close();
          toast("Rang déclaré annulé.", "success");
          redrawView();
        },
      }),
    ],
  });
}

export const _interne = { FILTRE_VIDE_RESUME };
