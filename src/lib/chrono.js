// ============================================================================
// LE CHRONO DE NUMÉROTATION — le registre des numéros attribués.
//
// Un « chrono » est la suite des numéros qu'une administration a tirés, dans
// l'ordre : c'est lui qui fait foi quand on cherche « l'acte n° 2026-412 ». Ce
// module le reconstitue à partir de ce que l'application sait déjà — les actes
// enregistrés, leurs numéros, leur état, leurs dates et leurs auteurs — et le
// complète de deux choses que les actes seuls ne montrent pas :
//
//   • les numéros ANNULÉS (`numbering.annules`) : un numéro tiré puis abandonné,
//     avec son motif, plutôt qu'un trou inexpliqué ;
//   • les rangs LIBRES : les numéros qui manquent entre le premier et le dernier
//     rang d'une année donnée — ceux qu'on n'a jamais tirés.
//
// Il ne connaît ni le DOM ni l'état de l'application : il reçoit les actes et le
// référentiel, et rend des lignes. L'écran « Chrono de numérotation »
// (src/ui/views/chrono.js) les trie, les filtre et les exporte.
// ============================================================================
import { numberingSettings, sequenceCourante, seqDeNumero, anneeDeNumero, entiteCodeDeNumero } from "./sequence.js";
import { estAbroge } from "./abrogations.js";
import { natureOfActe } from "./annexes.js";
import { formatDate } from "./util.js";

// Les états d'une ligne du chrono. Les sept premiers sont ceux d'un acte
// (voir ACTE_STATUTS) ; les trois derniers sont propres au chrono : un numéro
// annulé, un rang libre, et un numéro attribué par un service externe (dont
// l'application ne connaît pas le rang).
export const ETATS_CHRONO = {
  brouillon: { label: "Brouillon", color: "warning", famille: "acte" },
  pret: { label: "Prêt", color: "info", famille: "acte" },
  exporte: { label: "Exporté", color: "success", famille: "acte" },
  en_signature: { label: "En signature", color: "warning", famille: "acte" },
  signee: { label: "Signé", color: "success", famille: "acte" },
  publie: { label: "Publié", color: "success", famille: "acte" },
  en_attente: { label: "En attente de publication", color: "info", famille: "acte" },
  abroge: { label: "Abrogé", color: "error", famille: "acte" },
  annule: { label: "Numéro annulé", color: "error", famille: "annule" },
  libre: { label: "Rang libre", color: "info", famille: "libre" },
  externe: { label: "Attribué par un service", color: "info", famille: "acte" },
};

export const etat = (cle) => ETATS_CHRONO[cle] || { label: cle || "—", color: "info", famille: "acte" };

// L'état d'un acte, pour le chrono : son statut, ou « abrogé » quand il l'est
// (une abrogation en vigueur prime sur « publié »).
export function etatDunActe(acte) {
  if (!acte) return "brouillon";
  if (estAbroge(acte)) return "abroge";
  return acte.statut || "brouillon";
}

// Les colonnes du chrono — une seule déclaration, qui sert au tableau de
// l'écran COMME aux exports CSV et XLSX (voir `tableauDe`).
export const COLONNES_CHRONO = [
  { cle: "numero", label: "Numéro", largeur: 18, tri: (l) => l.numero || "" },
  { cle: "seq", label: "Rang", largeur: 8, tri: (l) => (l.seq == null ? -1 : l.seq), num: true },
  { cle: "annee", label: "Année", largeur: 8, tri: (l) => l.annee || 0, num: true },
  { cle: "entite", label: "Entité", largeur: 22, tri: (l) => l.entite || "" },
  { cle: "type", label: "Type", largeur: 16, tri: (l) => l.typeLabel || "" },
  { cle: "objet", label: "Objet", largeur: 46, tri: (l) => l.objet || "" },
  { cle: "trame", label: "Trame", largeur: 26, tri: (l) => l.trame || "" },
  { cle: "etat", label: "État", largeur: 18, tri: (l) => etat(l.etat).label },
  { cle: "dateSignature", label: "Date de signature", largeur: 16, tri: (l) => l.dateSignature || "" },
  { cle: "creeLe", label: "Créé le", largeur: 14, tri: (l) => l.creeLe || "" },
  { cle: "majLe", label: "Modifié le", largeur: 14, tri: (l) => l.majLe || "" },
  { cle: "redacteur", label: "Rédacteur", largeur: 22, tri: (l) => l.redacteur || "" },
  { cle: "source", label: "Source", largeur: 14, tri: (l) => l.source || "" },
  { cle: "reference", label: "Référence externe", largeur: 20, tri: (l) => l.reference || "" },
];

export const COLONNES_PAR_CLE = Object.fromEntries(COLONNES_CHRONO.map((c) => [c.cle, c]));

const jour = (v) => (v ? String(v).slice(0, 10) : "");

// Une ligne par acte enregistré, plus une par numéro annulé du référentiel.
export function lignesChrono(config, actes, trames = []) {
  const n = numberingSettings(config);
  const entites = config?.entities || [];
  const types = config?.actTypes || [];
  const parId = new Map((trames || []).map((t) => [t.id, t]));
  const lignes = [];

  for (const a of actes || []) {
    const numero = String(a.numero || a.values?.numero || "").trim();
    // Un acte sans numéro (brouillon non numéroté, annexe) n'entre pas au
    // chrono : le chrono EST la suite des numéros.
    if (!numero) continue;
    const entite = entites.find((e) => e.id === a.entityId) || {};
    const trame = parId.get(a.trameId) || null;
    const statut = etatDunActe(a);
    const source = a.numeroSource ? "externe" : "interne";
    lignes.push({
      id: a.id,
      acteId: a.id,
      numero,
      seq: seqDeNumero(config, numero),
      annee: anneeDeNumero(config, numero),
      entityCode: entite.code || entiteCodeDeNumero(config, numero) || "",
      entiteId: a.entityId || "",
      entite: entite.name || entiteCodeDeNumero(config, numero) || "",
      typeId: trame?.actTypeId || a.values?.__actTypeId || "",
      typeLabel: (types.find((t) => t.id === (trame?.actTypeId || "")) || {}).label || "",
      objet: a.objet || a.values?.objet || "",
      trame: a.trameName || trame?.name || "",
      trameId: a.trameId || "",
      nature: natureOfActe(a, trames),
      statut,
      etat: statut,
      dateSignature: jour(a.dateSignature || a.values?.dateSignature),
      creeLe: jour(a.createdAt),
      majLe: jour(a.updatedAt),
      redacteur: a.createdByName || "",
      source,
      reference: (a.numeroSource && a.numeroSource.ref) || "",
      eli: a.eli || (a.publication && a.publication.eliUri) || "",
      publie: !!(a.publication || a.statut === "publie"),
      annule: false,
      observation: "",
    });
  }

  for (const an of n.annules || []) {
    lignes.push({
      id: "annule:" + an.numero,
      acteId: "",
      numero: String(an.numero || ""),
      seq: an.seq == null ? seqDeNumero(config, an.numero) : an.seq,
      annee: an.annee == null ? anneeDeNumero(config, an.numero) : an.annee,
      entityCode: an.entityCode || entiteCodeDeNumero(config, an.numero) || "",
      entiteId: "",
      entite: an.entityCode || "",
      typeId: "",
      typeLabel: "",
      objet: "",
      trame: "",
      trameId: "",
      nature: "",
      statut: "annule",
      etat: "annule",
      dateSignature: "",
      creeLe: jour(an.at),
      majLe: jour(an.at),
      redacteur: an.par || "",
      source: "interne",
      reference: "",
      eli: "",
      publie: false,
      annule: true,
      observation: an.motif || "",
    });
  }

  return lignes;
}

// Les rangs LIBRES : pour chaque année représentée dans le chrono, les rangs
// compris entre 1 et le plus haut rang atteint qui n'apparaissent sur aucune
// ligne. On ne « devine » rien au-delà du dernier rang — un chrono qui s'arrête
// à 412 n'a pas 413 à 500 en réserve.
export function rangsLibres(config, lignes) {
  const parAnnee = new Map();
  for (const l of lignes) {
    if (l.seq == null || !l.annee) continue;
    if (!parAnnee.has(l.annee)) parAnnee.set(l.annee, new Map());
    parAnnee.get(l.annee).set(Number(l.seq), l);
  }
  const out = [];
  for (const [annee, pris] of [...parAnnee.entries()].sort((a, b) => a[0] - b[0])) {
    const max = Math.max(...pris.keys());
    for (let i = 1; i <= max; i++) {
      if (pris.has(i)) continue;
      const modele = [...pris.values()][0] || {};
      out.push({
        id: `libre:${annee}:${i}`,
        acteId: "",
        numero: "",
        seq: i,
        annee,
        entityCode: modele.entityCode || "",
        entiteId: modele.entiteId || "",
        entite: modele.entite || "",
        typeId: "", typeLabel: "",
        objet: "", trame: "", trameId: "", nature: "",
        statut: "libre", etat: "libre",
        dateSignature: "", creeLe: "", majLe: "", redacteur: "",
        source: "interne", reference: "", eli: "", publie: false, annule: false,
        observation: "Rang jamais attribué",
      });
    }
  }
  return out;
}

// ------------------------------------------------------------ filtres et tri
export const FILTRES_VIDES = {
  q: "", entityCode: "", annee: "", type: "", statut: "", source: "",
  du: "", au: "", libres: true, annules: true, sansNumero: false,
};

// Applique les filtres puis le tri. Rend une NOUVELLE liste (l'appelant peut
// garder les lignes brutes pour le résumé).
export function filtrerTrier(lignes, filtres = {}, tri = { cle: "seq", sens: "desc" }) {
  const f = { ...FILTRES_VIDES, ...(filtres || {}) };
  const q = String(f.q || "").trim().toLowerCase();
  const out = (lignes || []).filter((l) => {
    if (l.etat === "libre" && !f.libres) return false;
    if (l.etat === "annule" && !f.annules) return false;
    if (f.entityCode && l.entityCode !== f.entityCode) return false;
    if (f.annee && String(l.annee) !== String(f.annee)) return false;
    if (f.type && l.typeId !== f.type) return false;
    if (f.statut && l.etat !== f.statut) return false;
    if (f.source && l.source !== f.source) return false;
    if (f.du && jour(l.dateSignature) < f.du) return false;
    if (f.au && jour(l.dateSignature) > f.au) return false;
    if (q) {
      const blob = [l.numero, l.objet, l.trame, l.entite, l.redacteur, l.reference].join(" ").toLowerCase();
      if (!blob.includes(q)) return false;
    }
    return true;
  });
  const col = COLONNES_PAR_CLE[tri?.cle] || COLONNES_PAR_CLE.seq;
  const sens = tri?.sens === "asc" ? 1 : -1;
  out.sort((a, b) => {
    const va = col.tri(a), vb = col.tri(b);
    let r;
    if (typeof va === "number" && typeof vb === "number") r = va - vb;
    else r = String(va).localeCompare(String(vb), "fr", { numeric: true });
    if (r === 0) r = (a.numero || "").localeCompare(b.numero || "", "fr", { numeric: true });
    return r * sens;
  });
  return out;
}

// Le résumé affiché au-dessus du tableau : ce que le chrono contient, ce qui
// reste à tirer, et l'état de la séquence.
export function resumeChrono(config, lignes) {
  const n = numberingSettings(config);
  const actes = lignes.filter((l) => l.etat !== "libre" && l.etat !== "annule");
  const libres = lignes.filter((l) => l.etat === "libre");
  const annules = lignes.filter((l) => l.etat === "annule");
  const seqMax = actes.reduce((m, l) => Math.max(m, l.seq || 0), 0);
  const parEtat = {};
  for (const l of actes) parEtat[l.etat] = (parEtat[l.etat] || 0) + 1;
  return {
    total: actes.length,
    libres: libres.length,
    annules: annules.length,
    seqMax,
    prochain: sequenceCourante(config, {}),
    portee: n.portee,
    parEtat,
    annees: [...new Set(actes.map((l) => l.annee).filter(Boolean))].sort(),
    entites: [...new Set(actes.map((l) => l.entityCode).filter(Boolean))].sort(),
  };
}

// Les valeurs d'une ligne, dans l'ordre des colonnes : ce que le tableau affiche,
// ce que le CSV écrit et ce que le XLSX pose dans ses cellules. Une seule
// source, donc pas d'écart entre ce qu'on voit et ce qu'on exporte.
export const valeurColonne = (ligne, cle) => {
  if (cle === "etat") return etat(ligne.etat).label;
  if (cle === "annee") return ligne.annee || "";
  return ligne[cle] == null ? "" : ligne[cle];
};

export function tableauDe(lignes, colonnes = COLONNES_CHRONO) {
  const entete = colonnes.map((c) => c.label);
  const corps = lignes.map((l) => colonnes.map((c) => valeurColonne(l, c.cle)));
  return [entete, ...corps];
}

// Le nom de fichier d'un export : « chrono-numerotation-AAAAMMJJ ».
export const nomFichierChrono = (prefixe = "chrono-numerotation") =>
  prefixe + "-" + new Date().toISOString().slice(0, 10).replace(/-/g, "");

// Une date lisible, pour l'affichage (les exports gardent la forme ISO, qu'un
// tableur sait reconnaître comme une date).
export const dateLisible = (v) => (v ? formatDate(v, "date-short") : "");
