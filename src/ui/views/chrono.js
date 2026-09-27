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
import { h, button, toast, modal, select, textInput } from "../dom.js";
import { selectField, textField, confirmDialog, emptyState, helpLink, pageTitle } from "../components.js";
import { download, formatDate } from "../../lib/util.js";
import { blobCsv, blobXlsx } from "../../lib/xlsx.js";
import { numberingSettings } from "../../lib/sequence.js";
import {
  COLONNES_CHRONO, ETATS_CHRONO, FILTRES_VIDES, etat as etatChrono,
  lignesChrono, rangsLibres, filtrerTrier, resumeChrono, tableauDe, nomFichierChrono,
} from "../../lib/chrono.js";

const FILTRE_VIDE_RESUME = (f) => Object.values(f).filter((v) => v && v !== true).length === 0;

// Combien de lignes du chrono s'affichent d'abord. Le chrono réel en compte des
// milliers : les rendre toutes faisait trente-neuf mille pixels de page.
const CHRONO_PAGE = 25;

function filtres() {
  const ui = (state.ui = state.ui || {});
  ui.chronoFiltres = { ...FILTRES_VIDES, ...(ui.chronoFiltres || {}) };
  ui.chronoTri = ui.chronoTri || { cle: "seq", sens: "desc" };
  ui.chronoAffiches = ui.chronoAffiches || CHRONO_PAGE;
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
      pageTitle("Chrono de numérotation" , "Tous les numéros attribués : leur rang, l'entité et le type d'acte concernés, l'état de l'acte, ses dates et son rédacteur. Les rangs jamais attribués et les numéros annulés y figurent aussi — un trou du chrono s'explique. Cliquez un en-tête pour trier, une ligne pour ouvrir l'acte." ),
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
  // LA BARRE DU CHRONO (revue d'interface, P5). Le chrono est le plus long des
  // écrans (trente-neuf mille pixels) : ses filtres restent donc EN HAUT du
  // défilement, réduits à ce qu'on pose neuf fois sur dix — la recherche, l'état,
  // l'entité, l'année. Le reste (type d'acte, source, dates, rangs libres et
  // numéros annulés) vit derrière « Plus de filtres », et le compte suit.
  const optionsEntites = [...new Set(lignes.map((l) => l.entityCode).filter(Boolean))]
    .sort().map((code) => ({ value: code, label: (c.entities || []).find((e) => e.code === code)?.name || code }));
  const optionsAnnees = [...new Set(lignes.map((l) => l.annee).filter(Boolean))].sort().map((a) => ({ value: String(a), label: String(a) }));
  const optionsTypes = (c.actTypes || []).map((t) => ({ value: t.id, label: t.label }));
  const optionsEtats = Object.entries(ETATS_CHRONO).map(([id, v]) => ({ value: id, label: v.label }));

  const poser = (patch) => { Object.assign(state.ui.chronoFiltres, patch); state.ui.chronoAffiches = CHRONO_PAGE; redrawView(); };
  const reinit = () => { state.ui.chronoFiltres = { ...FILTRES_VIDES }; state.ui.chronoAffiches = CHRONO_PAGE; redrawView(); };
  const plusDeFiltres = ui.chronoPlus === true;

  const champ = (label, control) => h("div", { class: "liste-barre__champ" },
    h("label", { class: "fr-label", text: label }), control);
  const barre = h("div", { class: "liste-barre chrono-barre no-print" },
    champ("Recherche", textInput(f.q, (v) => poser({ q: v }), { placeholder: "Numéro, objet, trame, rédacteur…" })),
    champ("État", select([{ value: "", label: "Tous les états" }, ...optionsEtats], f.statut, (v) => poser({ statut: v }))),
    champ("Entité", select([{ value: "", label: "Toutes les entités" }, ...optionsEntites], f.entityCode, (v) => poser({ entityCode: v }))),
    champ("Année", select([{ value: "", label: "Toutes les années" }, ...optionsAnnees], f.annee, (v) => poser({ annee: v }))),
    h("div", { class: "liste-barre__champ liste-barre__champ--gestes" },
      button(plusDeFiltres ? "Moins de filtres" : "Plus de filtres", {
        variant: "tertiary", size: "sm", icon: plusDeFiltres ? "up" : "down",
        onClick: () => { state.ui.chronoPlus = !plusDeFiltres; redrawView(); },
      }),
      button(ui.chronoToutesColonnes ? "Colonnes essentielles" : "Toutes les colonnes", {
        variant: "tertiary", size: "sm", icon: ui.chronoToutesColonnes ? "left" : "right",
        title: ui.chronoToutesColonnes
          ? "Revenir aux six colonnes de lecture"
          : "Afficher les " + (COLONNES_CHRONO.length - 6) + " autres colonnes (type, trame, dates, rédacteur, source, référence)",
        onClick: () => { state.ui.chronoToutesColonnes = !ui.chronoToutesColonnes; redrawView(); },
      }),
      !FILTRE_VIDE_RESUME(f) ? button("Réinitialiser", { variant: "tertiary", size: "sm", icon: "refresh", onClick: reinit }) : null),
  );
  root.appendChild(barre);

  if (plusDeFiltres) {
    const box = h("div", { class: "fr-card fr-card--soft chrono-filtres" });
    const grille = h("div", { class: "chrono-filtres__grid" });
    grille.appendChild(selectField({ label: "Type d'acte", value: f.type, placeholder: "— tous —", options: optionsTypes, onChange: (v) => poser({ type: v }) }));
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
  }

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

  // LES COLONNES AUSSI SE CHOISISSENT (revue d'interface, P5). Un chrono porte
  // quatorze colonnes : à l'écran, six suffisent à retrouver une ligne — le
  // numéro, le rang, l'entité, l'objet, l'état et la date de signature. Les huit
  // autres (type, trame, dates de création et de modification, rédacteur,
  // source, référence) restent à un clic, et partent toujours entières dans les
  // exports CSV et XLSX.
  const CELLULES = {
    numero: (l) => h("td", {}, h("span", { class: "fr-mono", text: l.numero || (l.etat === "libre" ? "rang " + l.seq + " libre" : "—") })),
    seq: (l) => h("td", {}, l.seq == null ? h("span", { class: "fr-muted", text: "—" }) : String(l.seq)),
    annee: (l) => h("td", {}, l.annee ? String(l.annee) : "—"),
    entite: (l) => h("td", {}, l.entite || "—"),
    type: (l) => h("td", {}, l.typeLabel || "—"),
    objet: (l) => h("td", { class: "chrono-objet", title: l.objet || "" }, l.objet || (l.etat === "libre" ? l.observation || "—" : "—")),
    trame: (l) => h("td", {}, l.trame || "—"),
    etat: (l) => { const e = etatChrono(l.etat); return h("td", {}, h("span", { class: "fr-badge fr-badge--" + e.color, text: e.label })); },
    dateSignature: (l) => h("td", {}, l.dateSignature ? formatDate(l.dateSignature) : "—"),
    creeLe: (l) => h("td", {}, l.creeLe ? formatDate(l.creeLe) : "—"),
    majLe: (l) => h("td", {}, l.majLe ? formatDate(l.majLe) : "—"),
    redacteur: (l) => h("td", {}, l.redacteur || "—"),
    source: (l) => h("td", {}, l.source === "externe" ? "Service externe" : "Interne"),
    reference: (l) => h("td", {}, l.reference || "—"),
  };
  const COLONNES_ESSENTIELLES = ["numero", "seq", "entite", "objet", "etat", "dateSignature"];
  const toutesColonnes = ui.chronoToutesColonnes === true;
  const colonnes = toutesColonnes
    ? COLONNES_CHRONO
    : COLONNES_CHRONO.filter((col) => COLONNES_ESSENTIELLES.includes(col.cle));

  const head = h("tr", {}, ...colonnes.map((col) => h("th", {
    class: "chrono-th" + (tri.cle === col.cle ? " is-sorted" : ""),
    title: "Trier par « " + col.label + " »",
    onClick: () => basculerTri(col.cle),
  }, col.label, tri.cle === col.cle ? h("span", { class: "chrono-th__sens", text: tri.sens === "asc" ? " ▲" : " ▼" }) : null)),
    peutGerer ? h("th", { class: "chrono-th chrono-th--act" }, "") : null);

  const affiches = visibles.slice(0, ui.chronoAffiches);
  const tbody = h("tbody");
  for (const l of affiches) {
    const estLibre = l.etat === "libre";
    const estAnnule = l.etat === "annule";
    const ouvrable = !!l.acteId && !estLibre && !estAnnule;
    tbody.appendChild(h("tr", {
      class: "chrono-tr" + (estLibre ? " chrono-tr--libre" : "") + (estAnnule ? " chrono-tr--annule" : "") + (ouvrable ? " chrono-tr--clic" : ""),
      title: ouvrable ? "Ouvrir l'acte" : (l.observation || ""),
      onClick: ouvrable ? (() => { state.ui.openActeId = l.acteId; navigate("acte/" + l.acteId); }) : null,
    },
      ...colonnes.map((col) => (CELLULES[col.cle] || (() => h("td", {}, "—")))(l)),
      peutGerer ? h("td", { class: "chrono-td--act" },
        estLibre ? button("Annuler le numéro", {
          variant: "tertiary", size: "sm", icon: "trash",
          onClick: (ev) => { ev.stopPropagation(); annulerRangDialog(l); },
        }) : null) : null,
    ));
  }
  const table = h("div", { class: "chrono-table-wrap" },
    h("table", { class: "fr-table chrono-table" }, h("thead", {}, head), tbody));
  root.appendChild(h("p", { class: "liste-compte", text: visibles.length + " ligne" + (visibles.length > 1 ? "s" : "") + " — " + affiches.length + " affichée" + (affiches.length > 1 ? "s" : "") + (lignes.length !== visibles.length ? " (sur " + lignes.length + " au total)" : "") + (toutesColonnes ? "" : " · " + (COLONNES_CHRONO.length - colonnes.length) + " colonnes masquées") }));
  root.appendChild(table);

  // Le chrono se déroule sur des milliers de lignes : on n'en affiche que ce
  // qu'un écran porte, et on allonge à la demande (revue d'interface, P5).
  const plusEl = h("div", { class: "liste-plus no-print" });
  const restantes = visibles.length - affiches.length;
  if (restantes > 0) {
    plusEl.appendChild(button("Afficher les " + Math.min(CHRONO_PAGE, restantes) + " suivantes", {
      variant: "secondary", size: "sm", icon: "down",
      onClick: () => { state.ui.chronoAffiches += CHRONO_PAGE; redrawView(); },
    }));
    plusEl.appendChild(button("Afficher les 200 suivantes", {
      variant: "tertiary", size: "sm",
      onClick: () => { state.ui.chronoAffiches += 200; redrawView(); },
    }));
    plusEl.appendChild(button("Tout afficher (" + visibles.length + ")", {
      variant: "tertiary", size: "sm",
      onClick: () => { state.ui.chronoAffiches = visibles.length; redrawView(); },
    }));
  }
  root.appendChild(plusEl);
  // --------------------------------------------------------- gestes d'écriture
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
  // Le motif se retient à la FRAPPE : `textField` rend le CONTENEUR du champ
  // (libellé, aide, saisie), pas l'`<input>` — lire `motifInput.value` donnait
  // toujours `undefined`, et le motif saisi n'était jamais enregistré.
  let motif = "";
  const motifInput = textField({
    label: "Motif", placeholder: "Numéro tiré sur un acte abandonné, erreur de saisie…",
    onChange: (v) => { motif = v; },
  });
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
            motif: motif.trim() || "Rang jamais attribué", at: new Date().toISOString(),
            par: state.user ? state.user.id : "",
          });
          c.numbering = { ...(c.numbering || {}), annules: list };
          touch("config", { rerender: false });
          journaliser({ action: "numerotation.annule", cible: "referentiel", cibleLabel: `Rang ${ligne.seq}/${ligne.annee}`, detail: motif.trim() });
          close();
          toast("Rang déclaré annulé.", "success");
          redrawView();
        },
      }),
    ],
  });
}

export const _interne = { FILTRE_VIDE_RESUME };
