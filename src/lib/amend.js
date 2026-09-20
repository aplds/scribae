// ============================================================================
// Modifications d'un acte (« acte modificatif » et « version consolidée »).
//
// Vocabulaire du module :
//   base      le document modifié (acte du registre, ou fichier importé)
//   amend     UNE modification : elle vise un article (par son eId) et prend
//             l'une des formes  remplacer | abroger | insérer avant | insérer
//             après | ajouter en fin de dispositif
//   plan      la liste des modifications enrichie (article visé, numéro du
//             nouvel article, identifiant stable) — c'est ce que consomment
//             les deux générateurs
//
// Deux sorties, à partir du même plan :
//   buildModificatif()  → l'acte modificatif (un acte à part entière)
//   buildConsolidated() → la version consolidée, marquée des ajouts et
//                         suppressions, avec le tableau des modifications
//
// Aucune donnée d'une organisation particulière n'est codée ici : les tournures
// de phrase viennent du référentiel (`vocab.amendment`), donc de l'utilisateur.
// ============================================================================
import { uid, clone, formatDate, esc } from "./util.js";
import { enrichirSignataire } from "./delegations.js";
import { numberedLabel, buildContext, interpolate } from "./compile.js";

export const AMEND_ACTIONS = [
  { id: "keep", label: "Conserver", hint: "L'article n'est pas touché.", color: "" },
  { id: "replace", label: "Remplacer", hint: "Nouvelle rédaction de l'article.", color: "warning" },
  { id: "abrogate", label: "Abroger", hint: "L'article est supprimé.", color: "error" },
  { id: "insert-after", label: "Insérer un article après", hint: "Nouvel article (bis, ter…).", color: "success" },
  { id: "insert-before", label: "Insérer un article avant", hint: "Nouvel article (bis, ter…).", color: "success" },
  { id: "append", label: "Ajouter en fin de dispositif", hint: "Nouvel article à la suite du dernier.", color: "success" },
];

export const ACTION_MAP = Object.fromEntries(AMEND_ACTIONS.map((a) => [a.id, a]));
export const amendActionLabel = (id) => ACTION_MAP[id]?.label || id;

const DEFAULTS = {
  designation: "Décision",
  title: "{designation} n°{numero} du {date} portant modification de {targetInSentence}",
  target: "{designation} n°{numero} du {date}",
  targetInSentence: "{designationThe} n°{numero} du {date}",
  replace: "L'{article} de {target} est remplacé par les dispositions suivantes :",
  abrogate: "L'{article} de {target} est abrogé.",
  insertAfter: "Après l'{article} de {target}, il est inséré un {newArticle} ainsi rédigé :",
  insertBefore: "Avant l'{article} de {target}, il est inséré un {newArticle} ainsi rédigé :",
  append: "Il est ajouté à {target} un {newArticle} ainsi rédigé :",
  entry: "Les dispositions de {designationThe} entrent en vigueur à compter du {dateEffet}.",
  entryDefault: "Les dispositions de {designationThe} entrent en vigueur au lendemain de sa publication.",
  execution: "L'exécution de {designationThe} est confiée {authorityTo}.",
  considerant: "Considérant qu'il y a lieu de modifier {target} ;",
  consolidatedNotice: "Version consolidée à jour des modifications publiées. Ce document est diffusé à titre informatif : seuls les actes publiés au recueil des actes administratifs font foi.",
  renumberNotice: "Les articles ont été renumérotés : la numérotation du dispositif est continue.",
  abrogationNotice: "L'acte est abrogé dans son ensemble : ses articles ne sont plus en vigueur.",
  trailTitle: "Tableau des modifications",
  trailHead: ["Article", "Modification", "Rédaction"],
  // Mention portée sous l'intitulé d'un article quand le suivi des modifications
  // n'est pas affiché (voir `amendmentMentions`). Jetons : {designationThe}
  // (« la décision »), {designation}, {designationLower}, {numero}, {date}.
  mentionReplace: "Modifié par {designationThe} n°{numero} du {date}",
  mentionAbrogate: "Abrogé par {designationThe} n°{numero} du {date}",
  mentionInsert: "Ajouté par {designationThe} n°{numero} du {date}",
  mentionThen: ", puis ",
};

export function amendVocab(config) {
  return { ...DEFAULTS, ...((config && config.vocab && config.vocab.amendment) || {}) };
}

const fill = (tpl, vars) => String(tpl || "").replace(/\{(\w+)\}/g, (m, k) => (vars[k] == null ? "" : String(vars[k])));
const longDate = (v) => formatDate(v, "date-long");
const lcFirst = (s) => { const t = String(s || ""); return t ? t[0].toLowerCase() + t.slice(1) : t; };
const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Genre des appellations d'actes les plus courantes : il commande l'article
// défini (« le règlement », « la délibération », « l'arrêté »). Un mot inconnu
// est traité au féminin s'il se termine comme un nom féminin, au masculin sinon.
const FEMININE_END = /(ion|té|ce|ure|ance|ence|ette|ise|ité)$/;
const GENDER = {
  arrete: "m", reglement: "m", acte: "m", rapport: "m", avenant: "m", marche: "m",
  bail: "m", pouvoir: "m", procesverbal: "m", contrat: "m", protocole: "m", arreteinterministeriel: "m",
};
const bare = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");

export function designationThe(designation) {
  const d = String(designation || "").trim();
  if (!d) return "";
  const lower = lcFirst(d);
  if (/^[aeiouéèêàh]/i.test(lower)) return "l'" + lower;
  const g = GENDER[bare(d)] || (FEMININE_END.test(bare(d)) ? "f" : "m");
  return (g === "f" ? "la " : "le ") + lower;
}

// Contraction de la préposition « à » avec l'article défini : « à le maire » ne
// se dit pas — « au maire », « aux adjoints », « à la directrice ».
export function withPreposition(authority) {
  const a = String(authority || "").trim();
  if (!a) return "";
  if (/^les\s/i.test(a)) return "aux " + a.slice(4);
  if (/^le\s/i.test(a)) return "au " + a.slice(3);
  if (/^la\s/i.test(a)) return "à la " + a.slice(3);
  if (/^l['’]/i.test(a)) return "à " + lcFirst(a);
  return "à " + lcFirst(a);
}

export const newAmend = (patch = {}) => ({
  id: uid("amd"),
  targetEId: "",
  action: "keep",
  heading: "",
  blocks: [],
  note: "",
  ...patch,
});

// ------------------------------------------------------------------ articles
export const articlesOf = (doc) => (doc?.nodes || []).filter((n) => n.type === "article");
export const articleKey = (a) => a?.eId || a?.path || a?.id || "";

const NUM_RE = /(\d+(?:-\d+)*)\s*$/;
export function numericToken(label) {
  const s = String(label || "").replace(/\s*(er|ère)\.?\s*$/i, "").trim();
  const m = s.match(NUM_RE);
  return m ? m[1] : "";
}

function subToken(token, k) {
  if (!token) return String(k);
  if (token.includes("-")) {
    const parts = token.split("-");
    const last = Number(parts.pop());
    return [...parts, last + k].join("-");
  }
  return `${token}-${k}`;
}

// ---------------------------------------------------------------------- plan
// Enrichit la liste des modifications : article visé, numéro du nouvel article,
// identifiant stable du nouvel article. Les numéros sont calculés à partir des
// numéros réellement présents dans l'acte (donc jamais en double).
export function planAmendments(base, amends, opts = {}) {
  const arts = articlesOf(base);
  const index = new Map(arts.map((a, i) => [articleKey(a), i]));
  const usedNums = new Set(arts.map((a) => numericToken(a.numLabel)).filter(Boolean));
  const usedEIds = new Set(arts.map(articleKey));
  const counters = new Map();
  const baseInfo = {
    numero: base?.meta?.numero || "",
    dateSignature: base?.meta?.dateSignature || "",
    designation: opts.designation || base?.meta?.designation || "",
  };
  const eidFor = (num) => {
    const base0 = "art_" + String(num).replace(/[^0-9a-zA-Z]+/g, "_");
    let c = base0;
    let k = 1;
    while (usedEIds.has(c)) c = `${base0}_${++k}`;
    usedEIds.add(c);
    return c;
  };
  const lastToken = arts.length ? (numericToken(arts[arts.length - 1].numLabel) || String(arts.length)) : "0";
  let appended = 0;

  return (amends || []).filter(Boolean).map((a) => {
    const key = a.targetEId;
    const i = index.has(key) ? index.get(key) : null;
    const target = i == null ? null : arts[i];
    const row = { ...a, target, targetIndex: i, newNum: "", newEId: "", base: baseInfo };
    if (a.action === "insert-before" || a.action === "insert-after") {
      const tok = numericToken(target?.numLabel) || String((i ?? 0) + 1);
      let k = (counters.get(tok) || 0) + 1;
      let num = subToken(tok, k);
      while (usedNums.has(num)) { k++; num = subToken(tok, k); }
      counters.set(tok, k);
      usedNums.add(num);
      row.newNum = num;
    } else if (a.action === "append") {
      appended++;
      const head = Number(String(lastToken).split("-")[0]) || arts.length;
      let n = head + appended;
      while (usedNums.has(String(n))) n++;
      usedNums.add(String(n));
      row.newNum = String(n);
    }
    if (row.newNum) row.newEId = eidFor(row.newNum);
    return row;
  });
}

// Libellé de l'article visé, tel qu'il s'écrit dans une phrase
// (« Article 3 » → « article 3 »).
function articleRef(target, config) {
  const label = config?.vocab?.articleLabel || "Article";
  const lc = String(label).toLowerCase();
  const raw = String(target?.numLabel || "").trim();
  if (!raw) return lc + " " + (target?.num || "?");
  return raw.replace(new RegExp("^\\s*" + escapeRe(label) + "\\s*", "i"), lc + " ");
}

function amendVars(a, config) {
  const V = amendVocab(config);
  const b = a.base || {};
  const designation = b.designation || V.designation;
  const vars = {
    designation,
    designationLower: lcFirst(designation),
    designationThe: designationThe(designation),
    numero: b.numero || "à compléter",
    date: longDate(b.dateSignature),
    article: articleRef(a.target, config),
    newArticle: (config?.vocab?.articleLabel || "Article").toLowerCase() + " " + (a.newNum || "?"),
  };
  vars.target = fill(V.target, vars);
  vars.targetInSentence = fill(V.targetInSentence, vars);
  return vars;
}

// Tournure de la phrase d'amendement (l'« article 1er » de l'acte modificatif).
export function leadSentence(a, config) {
  const V = amendVocab(config);
  const v = amendVars(a, config);
  const t = v.targetInSentence;
  switch (a.action) {
    case "replace": return fill(V.replace, { ...v, target: t });
    case "abrogate": return fill(V.abrogate, { ...v, target: t });
    case "insert-after": return fill(V.insertAfter, { ...v, target: t });
    case "insert-before": return fill(V.insertBefore, { ...v, target: t });
    case "append": return fill(V.append, { ...v, target: t });
    default: return "";
  }
}

export function summaryOf(action, a, config) {
  const tok = a?.newNum ? ` (${config?.vocab?.articleLabel || "Article"} ${a.newNum})` : "";
  switch (action) {
    case "replace": return "Rédaction remplacée";
    case "abrogate": return "Article abrogé";
    case "insert-after": return "Article inséré après" + tok;
    case "insert-before": return "Article inséré avant" + tok;
    case "append": return "Article ajouté en fin de dispositif" + tok;
    default: return "Sans modification";
  }
}

const firstText = (a) => {
  const b = (a.blocks || [])[0];
  if (!b) return "";
  if (b.type === "list") return (b.items || []).map((i) => i.text).filter(Boolean)[0] || "";
  if (b.type === "table") return (b.rows || [])[0]?.map?.((c) => c || "").join(" — ") || "";
  return b.text || "";
};

// ------------------------------------------------- identité de l'acte produit
// Le signataire d'un acte modificatif est enrichi comme partout ailleurs :
// qualité accordée en genre et chaîne de délégations comprises — la chaîne
// relevant de l'organisation de l'acte (voir src/lib/delegations.js).
function enrichPerson(config, id, entityId = "") {
  const p = (config.people || []).find((x) => x.id === id);
  return p ? enrichirSignataire(config, p, { entityId }) : null;
}

function entityOf(config, id, fallback) {
  const e = (config.entities || []).find((x) => x.id === id);
  if (e) return e;
  if (fallback) return fallback;
  return (config.entities || [])[0] || {};
}

function sequenceOf(numero, config) {
  return (String(numero || "").match(/^\d{4}-(\d+)/) || [])[1] || config.numbering.seq;
}

export function buildEli(config, { numero, entityCode, actTypeId }) {
  return String(config.numbering.eliPattern || "")
    .replace("{baseUri}", String(config.brand?.baseUri || "").replace(/\/$/, ""))
    .replace("{actTypeId}", actTypeId || "acte")
    .replace("{year}", String(config.numbering.year))
    .replace("{seq}", String(sequenceOf(numero, config)))
    .replace("{entityCode}", entityCode || "XX");
}

// ------------------------------------------------------------- acte modificatif
export function buildModificatif(base, plan, m, config) {
  const V = amendVocab(config);
  const changes = plan.filter((a) => a.action !== "keep");
  const entity = entityOf(config, m.entityId, base.meta?.entity);
  const ctx = buildContext(config, { numero: m.numero, dateSignature: m.dateSignature, dateEffet: m.dateEffet }, { entityId: m.entityId });
  const nodes = [];
  const id = (t, patch) => ({ id: uid("n"), type: t, when: "", notes: [], ...patch });

  // intitulé et chapeau
  const des = m.designation || V.designation;
  const baseVars = {
    designation: des,
    designationLower: lcFirst(des),
    designationThe: designationThe(des),
    numero: base.meta?.numero || "à compléter",
    date: longDate(base.meta?.dateSignature),
  };
  const targetStandalone = fill(V.target, baseVars);
  const targetSentence = fill(V.targetInSentence, baseVars);
  nodes.push(id("title", {
    text: fill(V.title, {
      ...baseVars,
      numero: m.numero || "à compléter",
      date: longDate(m.dateSignature),
      target: targetStandalone,
      targetInSentence: targetSentence,
    }),
  }));
  nodes.push(id("authority", { text: ctx.entity?.authorityFormula || entity.authorityFormula || "" }));

  const visas = [{ id: uid("it"), refId: "", text: lcFirst(targetSentence), when: "" }];
  for (const v of (m.visas || []).filter(Boolean)) visas.push({ id: uid("it"), refId: "", text: v, when: "" });
  nodes.push(id("visas", { items: visas }));

  const considerants = (m.considerants || []).filter(Boolean);
  if (considerants.length) nodes.push(id("considerants", { items: considerants.map((t) => ({ id: uid("it"), text: t, when: "" })) }));
  nodes.push(id("enact", { text: config.vocab?.enact || "DÉCIDE" }));

  // article par article : un article de l'acte modificatif par modification
  changes.forEach((a, i) => {
    const eId = `art_${i + 1}`;
    const blocks = [{ id: uid("n"), type: "para", text: leadSentence(a, config), eId: `${eId}__p_1`, when: "", notes: [] }];
    if (a.action !== "abrogate") {
      (a.blocks || []).forEach((b, j) => {
        blocks.push({ ...clone(b), id: uid("n"), eId: `${eId}__p_${j + 2}`, quoted: true, change: null, when: "", notes: [] });
      });
    }
    nodes.push(id("article", {
      eId,
      numMode: "fixed",
      num: String(i + 1),
      numLabel: numberedLabel(config, i + 1),
      heading: a.heading || "",
      blocks,
      amendment: { target: a.target ? articleKey(a.target) : "", targetLabel: a.target?.numLabel || "", action: a.action, newNum: a.newNum || "" },
    }));
  });

  // dispositions finales (facultatives)
  let extra = changes.length + 1;
  if (m.addEntry !== false) {
    const desM = m.designation || V.designation;
    const text = m.dateEffet
      ? fill(V.entry, { designationLower: lcFirst(desM), designationThe: designationThe(desM), dateEffet: longDate(m.dateEffet) })
      : fill(V.entryDefault, { designationLower: lcFirst(desM), designationThe: designationThe(desM) });
    nodes.push(id("article", {
      eId: `art_${extra}`, numMode: "fixed", num: String(extra), numLabel: numberedLabel(config, extra),
      heading: "", blocks: [{ id: uid("n"), type: "para", text, eId: `art_${extra}__p_1`, when: "", notes: [] }],
    }));
    extra++;
  }
  if (m.addExecution !== false) {
    const authority = lcFirst(ctx.entity?.authorityFormula || entity.authorityFormula || "");
    nodes.push(id("article", {
      eId: `art_${extra}`, numMode: "fixed", num: String(extra), numLabel: numberedLabel(config, extra),
      heading: "",
      blocks: [{ id: uid("n"), type: "para", text: fill(V.execution, { designationLower: lcFirst(m.designation || V.designation), designationThe: designationThe(m.designation || V.designation), authority, authorityTo: withPreposition(authority) }), eId: `art_${extra}__p_1`, when: "", notes: [] }],
    }));
  }

  // signature et mentions
  nodes.push(id("signature", {
    place: entity.seatCity || base.meta?.entity?.seatCity || "",
    date: longDate(m.dateSignature),
    signataire: enrichPerson(config, m.signataireId, entity.id),
    showFunction: true,
  }));
  for (const mn of config.mentions || []) {
    if (mn.kind !== "recours" && mn.kind !== "publication") continue;
    nodes.push(id("mention", { mentionId: mn.id, textOverride: "", text: interpolate(mn.text || "", ctx), kind: mn.kind }));
  }

  const eli = buildEli(config, { numero: m.numero, entityCode: entity.code, actTypeId: base.meta?.actTypeId });
  return {
    kind: "modificatif",
    meta: {
      numero: m.numero || "",
      objet: m.objet || "",
      designation: m.designation || V.designation,
      dateSignature: m.dateSignature || "",
      dateEffet: m.dateEffet || "",
      statut: "pret",
      eli,
      trameId: "",
      trameName: "Modification d'acte",
      trameVersion: "",
      actTypeId: base.meta?.actTypeId || "acte",
      entity, org: base.meta?.org || entity, signataire: enrichPerson(config, m.signataireId, entity.id),
      generatedAt: new Date().toISOString(),
      amends: {
        numero: base.meta?.numero || "",
        date: base.meta?.dateSignature || "",
        eli: base.meta?.eli || "",
        title: firstTitleOf(base),
      },
    },
    nodes,
    notes: [],
    issues: [],
    missing: [],
    amendments: changes.map((a) => ({
      target: a.target ? articleKey(a.target) : "",
      targetLabel: a.target?.numLabel || "",
      action: a.action,
      newNum: a.newNum || "",
    })),
  };
}

// ------------------------------------------------------------ version consolidée
function insertedArticle(a, m, config, base) {
  const label = config?.vocab?.articleLabel || "Article";
  return {
    id: uid("n"),
    type: "article",
    eId: a.newEId || uid("art"),
    numMode: "fixed",
    num: a.newNum,
    numLabel: `${label} ${a.newNum}`,
    heading: a.heading || "",
    blocks: (a.blocks || []).map((b) => ({ ...clone(b), id: uid("n"), change: null, quoted: false, when: "", notes: [] })),
    change: { kind: "ins", by: m.numero || "", designation: m.designation || "", date: m.dateSignature || "", eli: m.eli || "", base: base.meta?.numero || "" },
    when: "",
    notes: [],
  };
}

// ---------------------------------------------------------- renumérotation
// Le numéro d'un article peut être RÉATTRIBUÉ lors d'une modification. Deux
// gestes, deux portées :
//   • un numéro donné à un article (`renum.map`, par identifiant d'article) —
//     il doit être libre, ce que l'écran vérifie ;
//   • « tout renuméroter » (`renum.all`) : la numérotation devient continue,
//     ce qui est le remède à un acte troué par les abrogations. Les articles
//     abrogés dont le numéro est repris par un article en vigueur ne sont
//     alors même plus mentionnés — ils quittent le texte consolidé.
// Un article abrogé n'occupe pas de rang, donc ne consomme pas de numéro.
function abbreviated(node) {
  return node?.type === "article" && node.change?.action === "abrogate";
}

export function applyRenumbering(nodes, renum, config) {
  const ren = renum || {};
  const map = ren.map || {};
  const label = (num) => numberedLabel(config, num);
  const list = nodes || [];
  if (ren.all) {
    let i = 0;
    const pris = new Set();
    for (const n of list) {
      if (n.type !== "article" || abbreviated(n)) continue;
      i += 1;
      pris.add(String(i));
      n.num = String(i);
      n.numLabel = label(i);
    }
    return list.filter((n) => !(abbreviated(n) && pris.has(numericToken(n.numLabel))));
  }
  for (const n of list) {
    if (n.type !== "article") continue;
    const num = map[articleKey(n)];
    if (!num) continue;
    n.num = String(num);
    n.numLabel = label(num);
  }
  return list;
}

export function buildConsolidated(base, plan, m, config, opts = {}) {
  const V = amendVocab(config);
  const changes = plan.filter((a) => a.action !== "keep");
  const byTarget = new Map();
  for (const a of changes) {
    if (a.action === "append") continue;
    if (!byTarget.has(a.targetEId)) byTarget.set(a.targetEId, []);
    byTarget.get(a.targetEId).push(a);
  }
  const mark = { by: m.numero || "", designation: m.designation || "", date: m.dateSignature || "", eli: m.eli || "", base: base.meta?.numero || "" };
  const nodes = [];

  for (const node of base.nodes || []) {
    if (node.type !== "article") { nodes.push(clone(node)); continue; }
    const list = byTarget.get(articleKey(node)) || [];
    for (const a of list.filter((x) => x.action === "insert-before")) nodes.push(insertedArticle(a, m, config, base));
    const rep = list.find((x) => x.action === "replace");
    const abr = list.find((x) => x.action === "abrogate");
    if (rep) {
      const art = clone(node);
      art.blocks = [
        ...(node.blocks || []).map((b) => ({ ...clone(b), id: uid("n"), change: { kind: "del", ...mark } })),
        ...(rep.blocks || []).map((b) => ({ ...clone(b), id: uid("n"), change: { kind: "ins", ...mark } })),
      ];
      art.change = { kind: "mod", ...mark, action: "replace" };
      nodes.push(art);
    } else if (abr) {
      const art = clone(node);
      art.blocks = (node.blocks || []).map((b) => ({ ...clone(b), id: uid("n"), change: { kind: "del", ...mark } }));
      art.change = { kind: "del", ...mark, action: "abrogate" };
      nodes.push(art);
    } else {
      nodes.push(clone(node));
    }
    for (const a of list.filter((x) => x.action === "insert-after")) nodes.push(insertedArticle(a, m, config, base));
  }

  const appends = changes.filter((a) => a.action === "append");
  if (appends.length) {
    const at = nodes.findIndex((n) => n.type === "signature" || n.type === "mention");
    const insertAt = at < 0 ? nodes.length : at;
    nodes.splice(insertAt, 0, ...appends.map((a) => insertedArticle(a, m, config, base)));
  }

  // Renumérotation (réattribution d'un numéro, ou numérotation continue) : elle
  // s'applique au texte consolidé, donc APRÈS les insertions.
  const ordered = applyRenumbering(nodes, opts.renum, config);
  const renumerote = !!(opts.renum && (opts.renum.all || Object.keys(opts.renum.map || {}).length));

  // L'acte est-il abrogé DANS SON ENSEMBLE ? Toutes ses dispositions sont alors
  // retirées : la version consolidée le dit, au lieu de laisser croire à une
  // suite d'abrogations d'articles sans lien.
  const arts = (base.nodes || []).filter((n) => n.type === "article");
  const abroge = arts.length > 0 && arts.every((n) => changes.some((a) => a.action === "abrogate" && a.target && articleKey(a.target) === articleKey(n)));

  const entry = {
    numero: m.numero || "",
    designation: m.designation || V.designation,
    date: m.dateSignature || "",
    eli: m.eli || "",
    objet: m.objet || "",
    items: changes.map((a) => ({
      article: a.target ? (a.target.numLabel || "Article") : `Article ${a.newNum}`,
      targetEId: a.target ? articleKey(a.target) : "",
      // L'article INSÉRÉ : c'est lui que la mention désigne, pas son voisin
      // (l'article d'accroche, qui n'est pas modifié par l'insertion).
      newEId: a.newEId || "",
      action: a.action,
      actionLabel: summaryOf(a.action, a, config),
      detail: firstText(a),
      newNum: a.newNum || "",
    })),
  };
  const trail = [...(opts.previousTrail || base.trail || []), entry];

  // La notice de consolidation dit ce que le texte est : une mise à jour, un
  // acte renuméroté, ou un acte abrogé tout entier.
  const notice = [fill(V.consolidatedNotice, {
    designationLower: lcFirst(m.designation || V.designation),
    base: base.meta?.numero || "",
  })];
  if (abroge) notice.push(V.abrogationNotice);
  else if (renumerote) notice.push(V.renumberNotice);

  return {
    kind: "consolide",
    meta: {
      ...clone(base.meta),
      eli: base.meta?.eli || "",
      statut: base.meta?.statut || "publie",
      generatedAt: new Date().toISOString(),
      consolidated: {
        at: new Date().toISOString(),
        by: m.numero || "",
        eli: m.eli || "",
        date: m.dateSignature || "",
        count: changes.length,
        // Le suivi des modifications (ajouts/suppressions apparents + tableau)
        // est une OPTION d'affichage de la version consolidée, désactivée par
        // défaut. Le choix est porté par le document : c'est lui qui décide de
        // la présentation de l'aperçu, des exports et de la version en ligne.
        showChanges: opts.showChanges === true,
        // Ce que la consolidation a fait de particulier : l'acte est abrogé
        // dans son ensemble, et/ou ses articles ont été renumérotés.
        abrogation: abroge,
        renumber: renumerote,
      },
    },
    nodes: ordered,
    notes: [],
    issues: [],
    missing: [],
    trail,
    consolidationNotice: notice.join(" "),
  };
}

export function firstTitleOf(doc) {
  return (doc?.nodes || []).find((n) => n.type === "title")?.text || "";
}

// L'acte d'origine tel qu'on le désigne dans une phrase : « la décision n°… du … ».
export function targetPhrase(base, designation, config) {
  const V = amendVocab(config);
  const des = designation || base?.meta?.designation || V.designation;
  return fill(V.targetInSentence, {
    designation: des,
    designationLower: lcFirst(des),
    designationThe: designationThe(des),
    numero: base?.meta?.numero || "à compléter",
    date: longDate(base?.meta?.dateSignature),
  });
}

// Considérant proposé par défaut dans l'acte modificatif (le rédacteur le modifie).
export function defaultConsiderant(base, designation, config) {
  const V = amendVocab(config);
  return fill(V.considerant, { target: targetPhrase(base, designation, config) });
}

// Petit récapitulatif texte, utilisé par l'aperçu et le récit des modifications.
export function planSummary(plan, config) {
  return plan
    .filter((a) => a.action !== "keep")
    .map((a) => ({
      article: a.target ? (a.target.numLabel || "") : "",
      actionLabel: summaryOf(a.action, a, config),
      detail: firstText(a),
      newNum: a.newNum || "",
    }));
}

// ------------------------------------------------------------------ mentions
// La version consolidée peut être rendue SANS le suivi des modifications : elle
// est alors le texte en vigueur, chaque article touché portant sous son intitulé
// la seule mention de l'acte qui l'a modifié (« Modifié par la décision n°… du
// … »). Ces mentions se lisent dans le tableau des modifications accumulé : un
// article modifié plusieurs fois en porte la chaîne complète.
const mentionTemplate = (action, V) =>
  action === "abrogate" ? V.mentionAbrogate : action === "replace" ? V.mentionReplace : V.mentionInsert;

function mentionText(tpl, info, V) {
  const designation = info.designation || V.designation;
  return fill(tpl, {
    designation,
    designationLower: lcFirst(designation),
    designationThe: designationThe(designation),
    numero: info.numero || "—",
    date: longDate(info.date),
  });
}

// Repli quand l'article n'a pas de trace dans le tableau des modifications : la
// marque portée par le nœud lui-même (c'est le cas des articles insérés par une
// consolidation produite avant que le tableau ne relève leur identifiant).
function mentionFromChange(ch, config) {
  if (!ch) return "";
  const V = amendVocab(config);
  const action = ch.action || (ch.kind === "del" ? "abrogate" : ch.kind === "ins" ? "insert-after" : "replace");
  return mentionText(mentionTemplate(action, V), { designation: ch.designation, numero: ch.by, date: ch.date }, V);
}

// Table des mentions, indexée par l'identifiant de l'article qui les porte.
export function amendmentMentions(doc, config) {
  const V = amendVocab(config);
  const map = new Map();
  for (const entry of doc?.trail || []) {
    for (const it of entry.items || []) {
      const fresh = it.action === "insert-after" || it.action === "insert-before" || it.action === "append";
      const key = fresh ? it.newEId : it.targetEId;
      if (!key) continue;
      const text = mentionText(mentionTemplate(it.action, V), entry, V);
      map.set(key, map.has(key) ? map.get(key) + V.mentionThen + lcFirst(text) : text);
    }
  }
  return map;
}

// Mention à porter sous l'article `node` (chaîne vide si l'article n'a jamais
// été modifié). Les marques de jeton {%nom%} ne sont pas utilisées ici : elles
// servent aux trames, non à la consolidation.
export function amendmentMention(node, mentions, config) {
  return mentions?.get(node?.eId) || mentionFromChange(node?.change, config);
}

export { fill as fillTemplate, esc as escapeXml };
