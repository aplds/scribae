import { safeEval } from "./expr.js";
import { formatDate, formatMoney, capitalize, titleCase, getPath, isDate, todayIso } from "./util.js";
import { overrideNode, ecarts as ecartsOf } from "./redaction.js";
import { enrichirSignataire } from "./delegations.js";
import { champFonction, roleDeFonction } from "./fonctions.js";
import { abrogationsDe, blocsAbrogation } from "./abrogations.js";

// --------------------------------------------------------------------------
// Contexte d'évaluation / d'interpolation
// --------------------------------------------------------------------------
// Le signataire arrive tantôt comme identifiant (`values.signataire = "p-faure"`,
// le cas des actes enregistrés), tantôt comme objet déjà résolu (aperçu d'une
// feuille de style, acte modificatif). On le ramène toujours à la personne du
// référentiel : c'est là que vivent sa civilité, ses rôles et son accord.
function personneDuReferentiel(config, valeur, deja) {
  const id = typeof valeur === "string" ? valeur : valeur?.id || deja?.id;
  if (id) {
    const p = (config.people || []).find((x) => x.id === id);
    if (p) return p;
  }
  return deja && typeof deja === "object" && (deja.lastName || deja.firstName) ? deja : null;
}

// La formule d'autorité d'une entité peut porter `{qualite}` : on y met la
// qualité de l'autorité de tête, accordée en genre — « Le maire de … » devient
// « La maire de … ». Une entité qui n'y fait pas appel garde son texte tel quel.
function formuleAutorite(entite, ctx) {
  const f = String(entite.authorityFormula || `L'autorité compétente de ${entite.nameWithArt || entite.name}`);
  if (!f.includes("{qualite}")) return f;
  const q = ctx.signataire?.autorite?.qualiteArticleMaj || ctx.signataire?.qualiteArticleMaj || "L'autorité compétente";
  return f.replace(/\{qualite\}/g, q);
}

export function buildContext(config, values = {}, extra = {}) {
  const ctx = { ...values, config, today: todayIso(), ...extra };
  const trame = extra.trame;
  const fields = trame?.fields || [];
  const enrich = (p) => (p ? { ...p, fonction: (config.roles || []).find((r) => r.id === p?.roles?.[0])?.label || "" } : p);
  for (const f of fields) {
    const v = values[f.id];
    if (v == null || v === "") continue;
    if (f.type === "person") ctx[f.id] = enrich((config.people || []).find((p) => p.id === v) || null);
    else if (f.type === "entity") ctx[f.id] = (config.entities || []).find((e) => e.id === v) || null;
    else if (f.type === "ref") ctx[f.id] = (config.refs || []).find((r) => r.id === v)?.label || v;
    else if (f.type === "reflist") ctx[f.id] = (Array.isArray(v) ? v : [v]).map((id) => (config.refs || []).find((r) => r.id === id)?.label).filter(Boolean);
  }
  // L'entité est lue en premier : elle détermine dans quelle organisation le
  // signataire tient sa délégation — une chaîne d'établissement autonome ne se
  // mêle pas à celle de la commune. Voir src/lib/delegations.js.
  const entId = values.__entityId || extra.entityId;
  // Le signataire est résolu AVANT les entités : sa qualité accordée alimente la
  // formule d'autorité de l'entité.
  //
  // La FONCTION retenue par le rédacteur (voir src/lib/fonctions.js) peut
  // désigner le rôle sous lequel il signe : une personne qui porte plusieurs
  // rôles signe alors sous celui-là. La fonction est rangée à côté du champ
  // (« signataireFonction »), le champ lui-même restant l'identifiant de la
  // personne — tout le reste de l'application continue de la lire ainsi.
  const champSig = (fields || []).find((f) => f.type === "signataire" || f.id === "signataire");
  const cleFonction = values[champFonction(champSig?.id || "signataire")] || values.signataireFonction || "";
  ctx.signataire = enrichirSignataire(
    config,
    personneDuReferentiel(config, values.signataire, ctx.signataire),
    {
      familyId: trame?.familyId || "", actTypeId: trame?.actTypeId || "",
      entityId: entId || "", date: values.dateSignature || "",
      roleId: roleDeFonction(cleFonction),
    },
  );
  const rawEntity = (config.entities || []).find((e) => e.id === entId) || null;
  const withDefaults = (e) => (e ? {
    ...e,
    nameWithArt: e.nameWithArt || e.name,
    authorityFormula: formuleAutorite(e, ctx),
  } : null);
  ctx.entity = withDefaults(rawEntity);
  const rawOrg = (config.entities || []).find((e) => e.kind === "etablissement" || e.kind === "commune") || rawEntity;
  ctx.org = withDefaults(rawOrg);
  return ctx;
}

// --------------------------------------------------------------------------
// Interpolation {{ expression | filtre }}
// --------------------------------------------------------------------------
const FILTERS = {
  upper: (v) => String(v ?? "").toUpperCase(),
  lower: (v) => String(v ?? "").toLowerCase(),
  capitalize: (v) => capitalize(v),
  title: (v) => titleCase(v),
  trim: (v) => String(v ?? "").trim(),
  "date-long": (v) => formatDate(v, "date-long"),
  "date-short": (v) => formatDate(v, "date-short"),
  "date-month": (v) => formatDate(v, "date-month"),
  "date-iso": (v) => formatDate(v, "date-iso"),
  money: (v) => formatMoney(v),
  number: (v) => (v === "" || v == null ? "" : String(v)),
};

function splitFilters(body) {
  const parts = body.split("|");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "" && out.length && i + 1 < parts.length) {
      out[out.length - 1] += "||" + parts[i + 1];
      i++;
    } else out.push(parts[i]);
  }
  return out;
}

export function interpolate(text, ctx, opts = {}) {
  const { onMissing, missing } = opts;
  if (text == null) return "";
  return String(text).replace(/\{\{([\s\S]*?)\}\}/g, (raw, body) => {
    const r = resolveToken(body, ctx);
    let out;
    if (r.empty) {
      out = opts.placeholder ?? "";
      if (missing) missing.push(r.expr);
      if (onMissing) onMissing(r.expr);
      if (opts.markMissing) out = "⟦" + r.expr + "⟧";
    } else {
      out = r.value;
    }
    return String(out ?? "");
  });
}

// Résolution d'un jeton `expression | filtre | filtre`.
function resolveToken(body, ctx) {
  const parts = splitFilters(String(body));
  const expr = parts.shift().trim();
  const r = safeEval(expr, ctx);
  let value = r.ok ? r.value : (getPath(ctx, expr) ?? undefined);
  if (value == null || value === "") return { expr, value: "", empty: true, filters: parts };
  if (isDate(value) && !parts.length) value = formatDate(value, "date-long");
  for (const f of parts) {
    const fn = FILTERS[f.trim()];
    if (fn) value = fn(value);
  }
  return { expr, value: String(value ?? ""), empty: false, filters: parts };
}

// Même interprétation que `interpolate`, mais en conservant la structure du
// texte : l'éditeur WYSIWYG a besoin de savoir quelle portion du texte vient
// d'un jeton (et lequel) pour la rendre cliquable. `inner` est l'intérieur brut
// du jeton, réutilisé tel quel pour reconstituer la source à l'enregistrement.
export function templateParts(text, ctx, opts = {}) {
  const parts = [];
  const s = String(text ?? "");
  const re = /\{\{([\s\S]*?)\}\}/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push({ t: "text", v: s.slice(last, m.index) });
    const r = resolveToken(m[1], ctx);
    if (r.empty && opts.missing) opts.missing.push(r.expr);
    parts.push({ t: "tok", expr: r.expr, inner: m[1], value: r.value, empty: r.empty });
    last = m.index + m[0].length;
  }
  if (last < s.length) parts.push({ t: "text", v: s.slice(last) });
  return parts;
}

// --------------------------------------------------------------------------
// Référentiel : visas
// --------------------------------------------------------------------------
function findScopedRef(config, refKind, entityId) {
  return (config.refs || []).find((r) => r.kind === refKind && r.entityId === entityId && r.active !== false)
    || (config.refs || []).find((r) => r.kind === refKind && !r.entityId && r.active !== false);
}

function resolveVisaItem(item, ctx, config) {
  if (item.text) return interpolate(item.text, ctx);
  if (item.refKind) {
    const ref = findScopedRef(config, item.refKind, ctx.entity?.id);
    return ref ? ref.label : "";
  }
  if (item.refId) {
    const id = interpolate(item.refId, ctx);
    return (config.refs || []).find((r) => r.id === id)?.label || "";
  }
  return "";
}

export function numberedLabel(config, n) {
  const label = config.vocab?.articleLabel || "Article";
  return `${label} ${n === 1 ? "1er" : n}`;
}

// --------------------------------------------------------------------------
// Compilation
// --------------------------------------------------------------------------
export function compile(trame, values, config, opts = {}) {
  const missing = [];
  const issues = [];
  const overrides = opts.overrides || values?.__overrides || {};
  const ctx = buildContext(config, values, { trame, entityId: values.__entityId });
  const markMissing = opts.markMissing === true;
  const interp = (t) => interpolate(t, ctx, { markMissing, missing });

  // --- champs
  for (const f of trame.fields || []) {
    if (f.appliesWhen && !safeEval(f.appliesWhen, ctx).value) continue;
    const v = values[f.id];
    const empty = v == null || v === "" || (Array.isArray(v) && !v.length);
    if (f.required && empty) {
      issues.push({ id: "field-" + f.id, level: "blocking", field: f.id, message: `Champ obligatoire non renseigné : ${f.label}` });
    }
    if (f.type === "date" && !empty && !isDate(v)) {
      issues.push({ id: "field-format-" + f.id, level: "blocking", field: f.id, message: `Format de date invalide pour « ${f.label} » (attendu AAAA-MM-JJ).` });
    }
  }

  // --- règles
  for (const r of trame.rules || []) {
    const res = safeEval(r.expr, ctx);
    if (!res.ok) {
      issues.push({ id: r.id, level: "warning", rule: r.id, message: `Règle illisible « ${r.message || r.expr} » : ${res.error}` });
      continue;
    }
    if (r.kind === "inclusion") continue;
    if (!res.value) issues.push({ id: r.id, level: r.level, rule: r.id, message: r.message || r.expr, ref: r.ref, author: r.author });
  }

  // --- corps
  const notes = [];
  let articleCounter = 0;
  const ecartList = ecartsOf(trame, overrides, config);
  const ecartAddrs = new Set(ecartList.map((e) => e.addr));
  const isEcart = (path) => ecartAddrs.has(path)
    || [...ecartAddrs].some((a) => a.startsWith(path + "."));
  const resolveNode = (rawNode, path) => {
    // Le rédacteur peut avoir réécrit le texte de la trame : on applique ses
    // écarts au bloc avant de l'interpréter. Les jetons `{{…}}` qu'il n'a pas
    // touchés continuent d'être résolus normalement.
    const node = overrideNode(rawNode, path, overrides);
    if (node.when && !safeEval(node.when, ctx).value) return null;
    const out = { ...node, path, children: [] };
    if (isEcart(path)) out.ecart = true;
    (node.notes || []).forEach((nt) => notes.push({ ...nt, path, nodeType: node.type }));
    switch (node.type) {
      case "title": case "authority": case "enact": case "para": case "raw":
        out.text = interp(node.text);
        break;
      case "visas": {
        const sep = config.vocab?.visaSeparator ?? ",";
        const finir = (t) => (t && !/[.;]$/.test(t) ? t + sep : t);
        const items = [];
        for (const it of node.items || []) {
          if (it.when && !safeEval(it.when, ctx).value) continue;
          // « Les décisions fondant la signature » : un visa par décision et par
          // acteur de la chaîne, du sommet vers le signataire — la nomination
          // puis la délégation pour chaque délégataire. Chaque visa porte son
          // LIEN (le recueil, ou l'adresse externe) : c'est lui que le document
          // publie, sur le web comme en PDF. Voir src/lib/delegations.js.
          if (it.chaine && !it.text) {
            for (const d of ctx.signataire?.decisions || []) {
              items.push({ id: `${it.id}:${d.refId || d.label}`, text: finir(d.label), lien: d.lien || "" });
            }
            continue;
          }
          items.push({ id: it.id, text: finir(resolveVisaItem(it, ctx, config)) });
        }
        out.items = items.filter((it) => it.text);
        break;
      }
      case "considerants": case "list":
        out.items = (node.items || [])
          .filter((it) => !it.when || safeEval(it.when, ctx).value)
          .map((it) => ({ id: it.id, text: interp(it.text) }))
          .filter((it) => it.text !== "");
        break;
      case "table":
        out.columns = (node.columns || []).map(interp);
        out.rows = (node.rows || []).map((r) => r.map(interp));
        out.caption = interp(node.caption || "");
        break;
      case "article": {
        articleCounter++;
        // eId stable : c'est lui qui permet de viser un article dans un acte
        // modificatif (et de le reprendre dans la version consolidée).
        out.eId = node.eId || `art_${articleCounter}`;
        out.numLabel = node.numMode === "auto" ? numberedLabel(config, articleCounter) : interp(node.num || "");
        out.heading = interp(node.heading || "");
        out.blocks = (node.blocks || [])
          .map((b, i) => {
            const r = resolveNode(b, `${path}.blocks.${i}`);
            if (r) r.eId = b.eId || `${out.eId}__p_${i + 1}`;
            return r;
          })
          .filter(Boolean);
        break;
      }
      case "signature":
        out.place = interp(node.place || "{{entity.seatCity}}");
        out.date = formatDate(values.dateSignature, "date-long");
        out.signataire = ctx.signataire || null;
        break;
      case "mention": {
        const m = (config.mentions || []).find((x) => x.id === node.mentionId);
        out.text = interp(node.textOverride || m?.text || "");
        out.kind = m?.kind || "publication";
        break;
      }
      default:
        out.text = interp(node.text || "");
    }
    return out;
  };

  const nodes = (trame.body || []).map((n, i) => resolveNode(n, `body.${i}`)).filter(Boolean);

  // --- abrogations prévues
  // L'acte peut prévoir, par lui-même, l'abrogation d'un autre acte ou d'un
  // article d'un autre acte. La clause prend place à la fin du dispositif —
  // juste avant le bloc de signature — et dit que l'abrogation prend effet à
  // l'ENTRÉE EN VIGUEUR de l'acte, non à sa publication : la règle est portée
  // par le texte (vocabulaire « abrogation ») et appliquée par l'application
  // (voir ui/abrogations-apply.js). L'emplacement est éditable comme les
  // autres : ses adresses sont `abrogations…`.
  const abrogations = abrogationsDe(values);
  if (abrogations.length) {
    const designation = (config.actTypes || []).find((t) => t.id === trame.actTypeId)?.label || values.designation || "Acte";
    const matiere = blocsAbrogation(abrogations, { config, designation });
    const resolved = resolveNode({
      id: "abrogations", type: "article", abrogation: true, numMode: "auto", heading: matiere.heading,
      blocks: matiere.blocks.map((text, i) => ({ id: `abrogations-b${i}`, type: "para", text, when: "", notes: [] })),
      when: "", notes: [],
    }, "abrogations");
    if (resolved) {
      const at = nodes.findIndex((n) => n.type === "signature" || n.type === "mention");
      if (at < 0) nodes.push(resolved); else nodes.splice(at, 0, resolved);
    }
  }

  // contrôle structurel : un article vide est presque toujours une erreur de trame
  for (const n of nodes) {
    if (n.type !== "article") continue;
    const hasContent = (n.blocks || []).some((b) => (b.type === "list" || b.type === "table" ? (b.items || b.rows || []).length : String(b.text || "").trim() !== ""));
    if (!hasContent) issues.push({ id: "struct-" + n.path, level: "warning", message: `${n.numLabel} est sans contenu : clause conditionnelle non remplie ou article à compléter.` });
  }

  const numero = values.numero || "";
  const seq = (String(numero).match(/^\d{4}-(\d+)/) || [])[1] || config.numbering.seq;
  const eliPattern = config.numbering.eliPattern
    .replace("{baseUri}", (config.brand.baseUri || "").replace(/\/$/, ""))
    .replace("{actTypeId}", trame.actTypeId || "acte")
    .replace("{year}", String(config.numbering.year))
    .replace("{seq}", String(seq))
    .replace("{entityCode}", ctx.entity?.code || "XX");

  if (!markMissing && missing.length) {
    issues.push({ id: "tokens-non-resolus", level: "warning", message: "Référence(s) non résolue(s) dans le texte : " + [...new Set(missing)].join(", ") });
  }

  return {
    meta: {
      numero,
      objet: values.objet || "",
      trameId: trame.id,
      trameName: trame.name,
      trameVersion: trame.version,
      actTypeId: trame.actTypeId || "decision",
      familyId: trame.familyId || "",
      // Feuille de style désignée par la trame (facultatif). Vide, l'habillage
      // se déduit de l'entité puis de la famille — voir src/lib/styles.js.
      styleId: trame.styleId || "",
      entity: ctx.entity,
      org: ctx.org,
      signataire: ctx.signataire,
      dateSignature: values.dateSignature || "",
      dateEffet: values.dateEffet || "",
      eli: eliPattern,
      generatedAt: new Date().toISOString(),
    },
    ctx,
    nodes,
    notes,
    issues,
    missing: [...new Set(missing)],
    overrides: { ...overrides },
    ecarts: ecartList,
  };
}

export function nextNumero(config, entity) {
  const n = config.numbering;
  // Numérotation externe : le numéro ne vient pas de la séquence locale, et
  // l'application ne peut pas le deviner — il se demande au service, au moment
  // de rédiger (voir src/lib/numbering.js). On ne propose donc rien ici.
  if (n.source === "externe") return "";
  const seq = String(n.seq).padStart(n.pad, "0");
  return n.pattern
    .replace("{year}", String(n.year))
    .replace("{seq}", seq)
    .replace("{entityCode}", entity?.code || "XX");
}

export const blockingIssues = (issues) => (issues || []).filter((i) => i.level === "blocking");
