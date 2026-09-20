// ============================================================================
// Recherche globale.
//
// Un seul index, construit à la demande à partir de ce que l'application a sous
// la main — actes, trames, personnes, services, références, comptes, chapitres
// du guide — et interrogé par une seule fonction. L'index est reconstruit à
// chaque ouverture de la recherche : les documents changent souvent (un acte
// enregistré, une trame publiée), et un index périmé serait pire qu'un index
// lent.
//
// La recherche porte sur les TITRES (numéro, objet, nom) et sur un TEXTE
// SECONDAIRE (le document compilé pour un acte, la description pour une trame,
// la nature pour une référence). Les résultats sont classés : ce qui commence
// par la requête d'abord, ce qui la contient dans son titre ensuite, le reste
// après.
//
// Ce module est pur : il reçoit des tableaux, il rend des groupes.
// ============================================================================

export const KIND_LABELS = {
  acte: "Actes",
  trame: "Trames",
  personne: "Personnes",
  service: "Services",
  reference: "Références",
  compte: "Comptes",
  guide: "Guide",
};

export const KIND_ORDER = ["acte", "trame", "personne", "service", "reference", "compte", "guide"];

// Repli des accents et de la casse : « requisition » doit trouver
// « Réquisition ». Utilisé partout, y compris pour les identifiants.
export function normaliser(s) {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function entree({ kind, id, titre, sous = "", texte = "", route, badge = "", statut = "", extra = {} }) {
  return { kind, id, titre: titre || "", sous, texte, route, badge, statut, extra };
}

// ------------------------------------------------------------------- index
export function construireIndex({
  config, actes = [], trames = [], personnes = [], references = [], services = [],
  comptes = [], guide = [], textes = {}, libelleService = (s) => s, libellePersonne = (p) => p,
} = {}) {
  const out = [];
  for (const a of actes) {
    const svc = a.serviceId ? libelleService(a.serviceId, a.bureauId) : "acte général";
    out.push(entree({
      kind: "acte", id: a.id,
      titre: [a.numero ? "n° " + a.numero : "acte sans numéro", a.objet].filter(Boolean).join(" — "),
      sous: [svc, a.entityName || "", a.dateSignature || ""].filter(Boolean).join(" · "),
      texte: textes[a.id] || "",
      route: "acte/" + a.id,
      statut: a.statut || "",
      extra: { numero: a.numero || "", objet: a.objet || "" },
    }));
  }
  for (const t of trames) {
    const fam = (config?.families || []).find((f) => f.id === t.familyId)?.label || "";
    out.push(entree({
      kind: "trame", id: t.id,
      titre: t.name,
      sous: [fam, "v" + (t.version || ""), t.serviceId ? libelleService(t.serviceId, t.bureauId) : "trame générale"].filter(Boolean).join(" · "),
      texte: [t.description, t.owner, ...(t.fields || []).map((f) => f.label)].join(" "),
      route: "trame/" + t.id,
      badge: t.status || "",
    }));
  }
  for (const p of personnes) {
    const ent = (config?.entities || []).find((e) => e.id === p.entityId);
    out.push(entree({
      kind: "personne", id: p.id,
      titre: [p.civility, p.firstName, p.lastName].filter(Boolean).join(" "),
      sous: [ent?.name, (p.roles || []).map((r) => (config?.roles || []).find((x) => x.id === r)?.label).filter(Boolean).join(", ")].filter(Boolean).join(" · "),
      route: "referentiel",
      extra: { tab: "personnes" },
    }));
  }
  for (const s of services) {
    out.push(entree({
      kind: "service", id: s.id,
      titre: [s.code, s.name].filter(Boolean).join(" — "),
      sous: (s.bureaux || []).map((b) => b.name).join(" · "),
      route: "referentiel",
      extra: { tab: "services" },
    }));
  }
  for (const r of references) {
    out.push(entree({
      kind: "reference", id: r.id,
      titre: r.label,
      sous: [r.kind, r.scope, r.source].filter(Boolean).join(" · "),
      route: "referentiel",
      extra: { tab: "refs" },
    }));
  }
  for (const c of comptes) {
    out.push(entree({
      kind: "compte", id: c.id,
      titre: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.login,
      sous: [c.login, c.email].filter(Boolean).join(" · "),
      route: "comptes",
    }));
  }
  for (const g of guide) {
    out.push(entree({
      kind: "guide", id: g.id,
      titre: g.title,
      sous: "Guide d'utilisation",
      texte: g.text || "",
      route: "aide/" + g.id,
    }));
  }
  return out;
}

// ---------------------------------------------------------------- recherche
// Score : 3 = le titre commence par la requête, 2 = un mot du titre commence par
// la requête, 1 = la requête apparaît dans le titre, 0.5 = dans le texte
// secondaire. Renvoie les groupes dans l'ordre `KIND_ORDER`, chaque groupe trié
// par score puis par titre.
export function chercher(index, requete, { limit = 6 } = {}) {
  const q = normaliser(requete).trim();
  if (q.length < 2) return [];
  const resultats = [];
  for (const e of index) {
    const titre = normaliser(e.titre);
    const texte = normaliser(e.texte);
    const sous = normaliser(e.sous);
    let score = 0;
    if (titre.startsWith(q)) score = 3;
    else if (new RegExp("(^|[^a-z0-9])" + echapper(q)).test(titre)) score = 2;
    else if (titre.includes(q)) score = 1;
    else if (sous.includes(q)) score = 0.8;
    else if (texte.includes(q)) score = 0.5;
    if (score > 0) resultats.push({ ...e, score });
  }
  resultats.sort((a, b) => b.score - a.score || a.titre.localeCompare(b.titre, "fr", { numeric: true }));
  const groupes = [];
  for (const kind of KIND_ORDER) {
    const items = resultats.filter((r) => r.kind === kind).slice(0, limit);
    if (items.length) groupes.push({ kind, label: KIND_LABELS[kind], items });
  }
  return groupes;
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Surligne les occurrences dans un texte déjà échappé pour le HTML.
export function surligner(texte, requete) {
  const t = String(texte ?? "");
  const q = String(requete || "").trim();
  if (!q) return t;
  const idx = normaliser(t).indexOf(normaliser(q));
  if (idx < 0) return t;
  return t.slice(0, idx) + "\u0001" + t.slice(idx, idx + q.length) + "\u0002" + t.slice(idx + q.length);
}
