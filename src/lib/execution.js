// ============================================================================
// Caractère exécutoire et délais.
//
// Un acte signé n'est pas encore exécutoire : il le devient quand il réunit les
// formalités qui le rendent opposable. Ces formalités ne sont pas les mêmes pour
// tous les actes :
//
//   • la TRANSMISSION au contrôle de légalité (préfecture / @ctes) — presque
//     toujours requise, elle fait courir le délai de deux mois du préfet ;
//   • la PUBLICATION au recueil des actes administratifs — requise pour tout
//     acte qui est un acte administratif destiné au public ;
//   • la NOTIFICATION aux intéressés — requise pour un acte individuel
//     (revalorisation, sanction, nomination…), puisqu'il ne concerne qu'une
//     personne et ne se publie pas.
//
// La date d'exécutoire est la date à laquelle la DERNIÈRE formalité requise est
// accomplie. C'est de là, et non de la signature ni de la seule publication,
// que court le délai de recours contentieux (deux mois par défaut).
//
// Rien n'est codé en dur : les délais sont un réglage du référentiel
// (`config.delais`), et une trame peut écarter une formalité quand elle ne la
// concerne pas (`trame.transmission`, `trame.notification`).
//
// Ce module est pur : il ne connaît ni le DOM ni l'état de l'application.
// ============================================================================

import { formatDate } from "./util.js";
import { natureJuridiqueDe } from "./schema.js";

export const DELAIS_DEFAUT = {
  recoursMois: 2,          // délai de recours contentieux (deux mois)
  transmissionJours: 15,   // objectif de transmission au contrôle de légalité
  publicationJours: 10,    // objectif de publication après signature
  notificationJours: 8,    // objectif de notification après signature
};

export const TRANSMISSION_MODES = [
  { id: "ctes", label: "Télétransmission (@ctes / Démarches simplifiées)" },
  { id: "prefecture", label: "Envoi à la préfecture (courrier / dépôt)" },
  { id: "sous_prefecture", label: "Envoi à la sous-préfecture" },
  { id: "arrete_controle", label: "Remise contre récépissé" },
  { id: "autre", label: "Autre" },
];

export const PUBLICATION_MODES = [
  { id: "recueil", label: "Recueil des actes administratifs" },
  { id: "affichage", label: "Affichage public" },
  { id: "site", label: "Publication sur le site internet" },
  { id: "autre", label: "Autre" },
];

export const NOTIFICATION_MODES = [
  { id: "lettre_recommandee", label: "Lettre recommandée avec avis de réception" },
  { id: "remise_contre_decharge", label: "Remise contre décharge" },
  { id: "portail", label: "Mise à disposition dans un espace personnel" },
  { id: "courriel", label: "Courrier électronique" },
  { id: "voie_hierarchique", label: "Voie hiérarchique" },
  { id: "autre", label: "Autre" },
];

export const DISPENSES = [
  { id: "", label: "Selon la règle générale" },
  { id: "requise", label: "Toujours requise" },
  { id: "aucune", label: "Jamais requise" },
];

export function delais(config) {
  const d = config?.delais || {};
  const n = (v, def) => {
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? x : def;
  };
  return {
    recoursMois: n(d.recoursMois, DELAIS_DEFAUT.recoursMois),
    transmissionJours: n(d.transmissionJours, DELAIS_DEFAUT.transmissionJours),
    publicationJours: n(d.publicationJours, DELAIS_DEFAUT.publicationJours),
    notificationJours: n(d.notificationJours, DELAIS_DEFAUT.notificationJours),
  };
}

// ------------------------------------------------------------------- dates
const iso = (s) => String(s || "").slice(0, 10);

export function addMonths(dateIso, months) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso(dateIso));
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const jour = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + Number(months || 0));
  // 31 janvier + 1 mois = 28/29 février (et non le 2 ou 3 mars).
  if (d.getUTCDate() < jour) d.setUTCDate(0);
  return d.toISOString().slice(0, 10);
}

export function addDays(dateIso, days) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso(dateIso));
  if (!m) return "";
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + Number(days || 0));
  return d.toISOString().slice(0, 10);
}

export const ecartJours = (de, a) => {
  const x = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(de || ""));
  const y = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(a || ""));
  if (!x || !y) return null;
  const d1 = Date.UTC(+x[1], +x[2] - 1, +x[3]);
  const d2 = Date.UTC(+y[1], +y[2] - 1, +y[3]);
  return Math.round((d2 - d1) / 86400000);
};

export const aujourdhui = () => new Date().toISOString().slice(0, 10);

// --------------------------------------------------------------- formalités
// Les formalités d'un acte, dans l'ordre où elles s'enchaînent, avec ce qui est
// ACCOMPLI (les enregistrements portés sur l'acte) et ce qui est REQUIS.
export function formalites(acte, { publiable = true, trame = null } = {}) {
  const e = acte?.execution || {};
  const signeLe = iso(acte?.original?.signatures?.[0]?.signeLe || acte?.signeLe || "");
  const publieLe = iso(acte?.publication?.datePublication || "");
  // Une ANNEXE ne se signe ni ne se publie pour elle-même : elle n'a donc
  // aucune formalité propre. C'est l'acte qui l'adopte qui les accomplit, et
  // c'est de sa signature que court le délai de recours — l'annexe n'ayant pas
  // de vie propre (voir src/lib/annexe-docs.js).
  const annexe = trame?.nature === "annexe";
  // Un DOCUMENT NON JURIDIQUE (verbatim de séance, déclaration, vœu) n'est pas
  // un acte administratif : sa publication au recueil le donne à lire, elle ne
  // le rend ni exécutoire ni opposable. Ni transmission au contrôle de légalité,
  // ni notification aux intéressés ne le concernent — seule la publication est
  // requise (voir src/lib/schema.js, ACTE_NATURES).
  const nonJuridique = trame ? !natureJuridiqueDe(trame) : false;
  // Dispense déclarée par la trame : « aucune » écarte la formalité, « requise »
  // la rend obligatoire même là où la règle générale ne l'exigerait pas.
  const dispense = (v) => (v === "aucune" ? false : v === "requise" ? true : null);
  const transmissionRequise = (annexe || nonJuridique) ? false : (dispense(trame?.transmission) ?? true);
  const notificationRequise = (annexe || nonJuridique) ? false : (dispense(trame?.notification) ?? !publiable);

  return [
    {
      id: "signature",
      label: "Signature",
      court: "signé",
      requis: !annexe,
      fait: !!(acte?.original || acte?.statut === "signee" || acte?.statut === "publie"),
      at: signeLe,
      ref: (acte?.original?.signatures || []).map((s) => s?.signataire?.nom).filter(Boolean).join(", "),
      byName: "",
    },
    {
      id: "transmission",
      label: "Transmission au contrôle de légalité",
      court: "transmis",
      requis: transmissionRequise,
      fait: !!e.transmission?.at,
      at: iso(e.transmission?.at),
      ref: e.transmission?.ref || "",
      mode: e.transmission?.mode || "",
      byName: e.transmission?.byName || "",
      // Certificat informatique de transmission (accusé de réception délivré
      // par le contrôle de légalité) : présent lorsque la transmission a été
      // faite par l'API d'envoi — voir src/lib/legalite.js.
      certificat: e.transmission?.certificat || null,
    },
    {
      // La publication est normalement constatée par la chaîne ELI
      // (`acte.publication`, posée par le service). Elle peut aussi avoir été
      // ENREGISTRÉE à la main (publication antérieure à l'outil, recueil papier,
      // affichage) : `execution.publication` porte alors la date et la référence.
      id: "publication",
      label: "Publication au recueil des actes administratifs",
      court: "publié",
      requis: !!publiable,
      fait: !!(publieLe || e.publication?.at),
      at: publieLe || iso(e.publication?.at),
      ref: acte?.publication?.eliUri || e.publication?.ref || "",
      mode: e.publication?.mode || "",
      parEli: !!publieLe,
      byName: e.publication?.byName || "",
    },
    {
      id: "notification",
      label: "Notification aux intéressés",
      court: "notifié",
      requis: notificationRequise,
      fait: !!e.notification?.at,
      at: iso(e.notification?.at),
      ref: e.notification?.ref || "",
      mode: e.notification?.mode || "",
      destinataires: e.notification?.destinataires || "",
      byName: e.notification?.byName || "",
    },
  ];
}

// Date à laquelle l'acte devient exécutoire : la plus tardive des formalités
// requises accomplies. Vide tant qu'il en manque une.
export function dateExecutoire(acte, opts = {}) {
  // Un document non juridique n'a pas de caractère exécutoire : il n'entre en
  // vigueur pour personne, et aucune date ne s'y attache (voir statutExecution).
  if (opts.trame && !natureJuridiqueDe(opts.trame)) return "";
  const requises = formalites(acte, opts).filter((f) => f.requis);
  if (requises.some((f) => !f.fait || !f.at)) return "";
  const dates = requises.map((f) => f.at).filter(Boolean).sort();
  return dates[dates.length - 1] || "";
}

// Fin du délai de recours contentieux, à compter de l'exécutoire.
export function dateLimiteRecours(acte, config, opts = {}) {
  // Pas de délai de recours contre un document qui ne fait pas droit.
  if (opts.trame && !natureJuridiqueDe(opts.trame)) return "";
  const d = dateExecutoire(acte, opts);
  if (!d) return "";
  return addMonths(d, delais(config).recoursMois);
}

// ------------------------------------------------------------------ entrée en vigueur
// La date à laquelle un acte ENTRE EN VIGUEUR : la date d'effet qu'il déclare,
// et à défaut son opposabilité — le lendemain de la publication, ou après le
// nombre de jours réglé (Administration › Publication). C'est cette date-là,
// et non celle de la publication, qui fait prendre effet les abrogations
// prévues par l'acte (voir src/lib/abrogations.js et ui/abrogations-apply.js).
export function entreeEnVigueur(acte, config) {
  const effet = iso(acte?.values?.dateEffet || acte?.dateEffet || "");
  if (effet) return effet;
  const pub = iso(acte?.publication?.datePublication || acte?.datePublication || "");
  if (!pub) return "";
  const o = (config?.publication && config.publication.opposabilite) || {};
  const jours = o.mode === "jours" ? Math.max(0, Number(o.jours) || 0) : 1;
  return addDays(pub, jours);
}

// ------------------------------------------------------------------ recours
// Le recours RÉELLEMENT introduit contre l'acte : un fait, et non une échéance.
// L'administration le constate au vu de la pièce qu'elle a reçue — requête
// enregistrée au greffe, lettre du requérant, déféré du préfet. La date
// d'introduction est celle qui compte : c'est elle qui ferme le délai de
// recours contentieux, et elle interdit désormais d'attester qu'il n'y a pas eu
// de recours.
export const RECOURS_TYPES = [
  { id: "gracieux", label: "Recours gracieux" },
  { id: "hierarchique", label: "Recours hiérarchique" },
  { id: "contentieux", label: "Recours contentieux" },
  { id: "refere_suspension", label: "Référé-suspension" },
  { id: "refere_liberte", label: "Référé-liberté" },
  { id: "defere_prefectoral", label: "Déféré du préfet" },
  { id: "autre", label: "Autre" },
];

export const recoursTypeLabel = (id) => (RECOURS_TYPES.find((t) => t.id === id) || {}).label || "";

export const recoursDe = (acte) => acte?.execution?.recours || null;

export function enregistrerRecours(acte, { introduitLe, type, demandeur, ref, note, by, byName } = {}) {
  if (!acte) return null;
  acte.execution = acte.execution || {};
  acte.execution.recours = {
    introduitLe: iso(introduitLe) || aujourdhui(),
    type: type || "",
    demandeur: String(demandeur || "").trim(),
    ref: String(ref || "").trim(),
    note: String(note || "").trim(),
    by: by || "",
    byName: byName || "",
    enregistreLe: new Date().toISOString(),
  };
  return acte.execution.recours;
}

export function effacerRecours(acte) {
  if (acte?.execution) delete acte.execution.recours;
}

export const STATUTS_EXECUTION = {
  brouillon: { label: "En préparation", color: "warning" },
  // Un document non juridique publié ne devient pas « exécutoire » : il est au
  // recueil, un point c'est tout. C'est ce que dit cet état.
  document: { label: "Document — non opposable", color: "info" },
  en_attente: { label: "Formalités en cours", color: "info" },
  executoire: { label: "Exécutoire — recours ouvert", color: "success" },
  recours: { label: "Recours introduit — contentieux en cours", color: "warning" },
  definitif: { label: "Définitif — délai de recours échu", color: "success" },
};

export function statutExecution(acte, config, opts = {}) {
  const f = formalites(acte, opts);
  const signe = f.find((x) => x.id === "signature")?.fait;
  if (!signe) return { ...STATUTS_EXECUTION.brouillon, code: "brouillon", formalites: f };
  // Un document non juridique signé et publié ne « devient » rien : il est au
  // recueil, sans opposabilité ni délai de recours. On le dit d'un état à part,
  // plutôt que de le faire passer pour exécutoire.
  if (opts.trame && !natureJuridiqueDe(opts.trame)) {
    return { ...STATUTS_EXECUTION.document, code: "document", formalites: f };
  }
  const requises = f.filter((x) => x.requis);
  const manquantes = requises.filter((x) => !x.fait);
  if (manquantes.length) return { ...STATUTS_EXECUTION.en_attente, code: "en_attente", manquantes, formalites: f };
  const limite = dateLimiteRecours(acte, config, opts);
  const recours = recoursDe(acte);
  // Un recours introduit ferme le délai : l'acte n'est plus « définitif par
  // écoulement du délai », il est contesté — et le reste, fût le délai expiré,
  // jusqu'à ce que le juge ait statué.
  if (recours?.introduitLe) return { ...STATUTS_EXECUTION.recours, code: "recours", limite, recours, formalites: f };
  const jour = aujourdhui();
  if (limite && jour > limite) return { ...STATUTS_EXECUTION.definitif, code: "definitif", limite, formalites: f };
  return { ...STATUTS_EXECUTION.executoire, code: "executoire", limite, formalites: f };
}

// ------------------------------------------------------------------ alertes
// Ce que l'échéancier met en avant : les formalités qui traînent, et les délais
// de recours qui se referment bientôt.
export function alertes(acte, config, opts = {}) {
  const d = delais(config);
  const f = formalites(acte, opts);
  const jour = aujourdhui();
  const signe = f.find((x) => x.id === "signature");
  const out = [];
  const depuis = (date) => (date ? ecartJours(date, jour) : null);

  if (signe.fait) {
    const t = f.find((x) => x.id === "transmission");
    if (t.requis && !t.fait) {
      const j = depuis(signe.at);
      out.push({
        niveau: j != null && j > d.transmissionJours ? "error" : "warning",
        code: "transmission",
        message: j != null && j > d.transmissionJours
          ? `Transmission en retard : ${j} jours depuis la signature (objectif ${d.transmissionJours} jours).`
          : `À transmettre au contrôle de légalité (signé il y a ${j ?? "?"} jour(s)).`,
      });
    }
    const p = f.find((x) => x.id === "publication");
    if (p.requis && !p.fait) {
      const j = depuis(signe.at);
      out.push({
        niveau: j != null && j > d.publicationJours ? "warning" : "info",
        code: "publication",
        message: j != null && j > d.publicationJours
          ? `Publication en souffrance : ${j} jours depuis la signature.`
          : "Publication au recueil à effectuer.",
      });
    }
    const n = f.find((x) => x.id === "notification");
    if (n.requis && !n.fait) {
      const j = depuis(signe.at);
      out.push({
        niveau: j != null && j > d.notificationJours ? "warning" : "info",
        code: "notification",
        message: j != null && j > d.notificationJours
          ? `Notification en attente depuis ${j} jours (l'acte individuel n'est opposable qu'une fois notifié).`
          : "Notification à adresser à l'intéressé : sans elle, l'acte individuel n'est pas opposable.",
      });
    }
  }

  const st = statutExecution(acte, config, opts);
  if (st.code === "executoire" && st.limite) {
    const reste = ecartJours(jour, st.limite);
    if (reste != null && reste <= 20) {
      out.push({
        niveau: reste <= 7 ? "warning" : "info",
        code: "recours",
        message: `Délai de recours contentieux : ${reste} jour(s) restant(s) (jusqu'au ${formatDate(st.limite)}).`,
      });
    }
  }
  // Un recours enregistré n'est pas un retard à rattraper, mais c'est un fait du
  // dossier : un acte contesté ne se traite pas comme un acte dont le délai
  // court encore. On le rappelle donc dans la liste des points à voir.
  if (st.code === "recours" && st.recours) {
    out.push({
      niveau: "info",
      code: "recours_introduit",
      message: `${recoursTypeLabel(st.recours.type) || "Recours"} introduit le ${formatDate(st.recours.introduitLe)} : le délai de recours contentieux est clos.`,
    });
  }
  return out;
}

// Un résumé d'une ligne pour le registre : « exécutoire le 12 mars · recours
// jusqu'au 12 mai ».
export function resumeExecution(acte, config, opts = {}) {
  const st = statutExecution(acte, config, opts);
  const exe = dateExecutoire(acte, opts);
  if (st.code === "document") {
    return { code: st.code, label: st.label, color: st.color, exe: "", limite: "", texte: "document publié au recueil, non opposable" };
  }
  if (st.code === "recours") {
    const r = st.recours || {};
    return {
      code: st.code, label: st.label, color: st.color, exe, limite: st.limite, recours: r,
      texte: `exécutoire le ${formatDate(exe)} · ${(recoursTypeLabel(r.type) || "recours").toLowerCase()} introduit le ${formatDate(r.introduitLe)}`,
    };
  }
  if (st.code === "executoire" || st.code === "definitif") {
    const suite = st.limite
      ? (st.code === "definitif"
        ? ` · délai de recours échu le ${formatDate(st.limite)}`
        : ` · recours jusqu'au ${formatDate(st.limite)}`)
      : "";
    return {
      code: st.code, label: st.label, color: st.color,
      exe, limite: st.limite,
      texte: `exécutoire le ${formatDate(exe)}${suite}`,
    };
  }
  if (st.code === "en_attente") {
    return {
      code: st.code, label: st.label, color: st.color, exe: "", limite: "",
      texte: "en attente : " + st.manquantes.map((m) => m.court).join(", "),
    };
  }
  return { code: st.code, label: st.label, color: st.color, exe: "", limite: "", texte: "acte non signé" };
}

// Enregistre une formalité. L'appelant décide de la date et de la référence :
// c'est une constatation, pas une déduction — l'application n'a aucun moyen de
// savoir seule qu'un courrier est parti. Une formalité accomplie par une API
// (transmission au contrôle de légalité) porte en plus son certificat et les
// mentions de l'appel : la constatation est alors faite par le service.
export function enregistrerFormalite(acte, id, { at, ref, mode, destinataires, certificat, api, by, byName } = {}) {
  if (!["transmission", "publication", "notification"].includes(id)) return null;
  acte.execution = acte.execution || {};
  acte.execution[id] = {
    at: at || aujourdhui(),
    ref: String(ref || "").trim(),
    mode: mode || "",
    ...(destinataires !== undefined ? { destinataires: String(destinataires || "").trim() } : {}),
    ...(certificat ? { certificat } : {}),
    ...(api ? { api } : {}),
    by: by || "",
    byName: byName || "",
    enregistreLe: new Date().toISOString(),
  };
  return acte.execution[id];
}

export function effacerFormalite(acte, id) {
  if (!acte?.execution) return;
  delete acte.execution[id];
}
