import { safeEval } from "./expr.js";
import { formatDate, formatMoney, capitalize, titleCase, getPath, isDate, todayIso, uid } from "./util.js";
import { overrideNode, ecarts as ecartsOf, reglagesEcarts } from "./redaction.js";
import { estSupprime, suppressions, ajoutsDe, sousSuppression } from "./structure.js";
import { enrichirSignataire } from "./delegations.js";
import { conseilPourActe, enrichirConseil } from "./conseils.js";
import { champFonction, roleDeFonction, fonctionRole } from "./fonctions.js";
import { signatairePrincipal } from "./organigramme.js";
import { abrogationsDe, blocsAbrogation } from "./abrogations.js";
import { niveauDe, numeroNiveau, paramsBloc, appliquerFormule } from "./schema.js";
import { annexesDe, adoptionDe, visaAdoption, nodeAnnexes } from "./annexes.js";
import { ordreDe, ordresModifies, appliquerOrdre } from "./ordre.js";

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
  // L'acte qui ADOPTE ce document (le cas d'une annexe), et les annexes jointes
  // à ce document : les deux sont des identifications figées, rangées avec les
  // valeurs de l'acte (voir src/lib/annexes.js).
  ctx.adoption = adoptionDe(values);
  ctx.annexes = annexesDe(values);
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
  // LE SIGNATAIRE PRINCIPAL DE L'ENTITÉ (Administration › Entités, et écran
  // Organigramme) : la personne désignée pour signer les actes de cette entité
  // — son directeur, son maire, son président. Elle sert de signataire PAR
  // DÉFAUT quand la trame n'en désigne aucun : un acte pris sans signataire
  // explicite porte alors la signature de l'autorité de l'entité, au lieu de
  // n'en porter aucune. La qualité désignée avec elle joue le rôle d'une
  // fonction choisie (`fonction:`), sans écraser un choix du rédacteur.
  const sigDefaut = signatairePrincipal(config, entId);
  // Le signataire est résolu AVANT les entités : sa qualité accordée alimente la
  // formule d'autorité de l'entité.
  //
  // La FONCTION retenue par le rédacteur (voir src/lib/fonctions.js) peut
  // désigner le rôle sous lequel il signe : une personne qui porte plusieurs
  // rôles signe alors sous celui-là. La fonction est rangée à côté du champ
  // (« signataireFonction »), le champ lui-même restant l'identifiant de la
  // personne — tout le reste de l'application continue de la lire ainsi.
  const champSig = (fields || []).find((f) => f.type === "signataire" || f.id === "signataire");
  const cleFonction = values[champFonction(champSig?.id || "signataire")] || values.signataireFonction
    || (sigDefaut?.roleId ? fonctionRole(sigDefaut.roleId) : "");
  ctx.signataire = enrichirSignataire(
    config,
    personneDuReferentiel(config, values.signataire || sigDefaut?.personne?.id, ctx.signataire),
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
  // L'ASSEMBLÉE (le cas d'un acte d'assemblée — une délibération). L'acte peut
  // désigner son conseil (`__conseilId`) ; à défaut, c'est l'assemblée de son
  // entité. Quand l'acte émane d'une assemblée, la ligne d'autorité rendue par
  // le jeton `{{autorite}}` est celle du conseil — « Le conseil municipal de … »
  // —, non celle de l'autorité personne. Voir src/lib/conseils.js.
  const conseilId = values.__conseilId || extra.conseilId || trame?.conseilId || "";
  const estAssemblee = !!(trame?.assemblee || conseilId);
  ctx.conseil = estAssemblee
    ? enrichirConseil(config, conseilPourActe(config, { entityId: entId, conseilId }), { signataire: ctx.signataire })
    : null;
  // L'autorité de l'acte : l'assemblée si l'acte en émane, sinon l'entité. C'est
  // cette valeur que le jeton `{{autorite}}` rend dans les trames.
  ctx.autorite = ctx.conseil ? ctx.conseil.authorityFormula : (ctx.entity?.authorityFormula || "");
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
  // Une ANNEXE n'est pas un acte signé : c'est l'acte qui l'adopte qui est signé,
  // et c'est sa signature qui lui donne son autorité. Elle ne porte donc ni bloc
  // de signature, ni qualité de signataire à renseigner — et son original est
  // imprimé à la suite de l'acte qui l'adopte (voir src/lib/annexe-docs.js).
  const estAnnexeDoc = trame.nature === "annexe";

  // --- champs
  for (const f of trame.fields || []) {
    if (f.appliesWhen && !safeEval(f.appliesWhen, ctx).value) continue;
    // Le signataire d'une annexe, c'est celui de l'acte d'adoption : la question
    // n'a pas lieu d'être, et son absence n'est pas un manque.
    if (estAnnexeDoc && f.type === "signataire") continue;
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
  // Compteurs des échelons de division (Livre, Titre, Chapitre…). Un échelon
  // ouvert remet à zéro ceux qui le suivent — « Chapitre 1 » puis, un nouveau
  // Titre venu, « Chapitre 1 » de nouveau.
  const niveauCounters = new Map();
  let divisionCounter = 0;
  // Écarts de TEXTE (réécritures) : eux seuls marquent un bloc comme « hors
  // trame ». Les écarts de RÉGLAGE (échelon, numérotation) sont signalés aussi,
  // mais ils ne salissent pas la lecture du document.
  const ecartList = ecartsOf(trame, overrides, config).filter((e) => !sousSuppression(values, e.addr));
  const reglageList = reglagesEcarts(trame, overrides).filter((e) => !sousSuppression(values, e.path));
  const ecartAddrs = new Set(ecartList.map((e) => e.addr));
  const isEcart = (path) => ecartAddrs.has(path)
    || [...ecartAddrs].some((a) => a.startsWith(path + "."));
  // Les ÉLÉMENTS d'une liste (visas, considérants, liste) : on y ajoute ceux que
  // le rédacteur a posés dans ce conteneur-là, puis on applique l'ordre retenu
  // — le même mécanisme que pour les blocs, et le même que pour un déplacement.
  const ordonnerPieces = (items, path, resolveAjout) => {
    for (const a of ajoutsDe(values, `${path}.items`)) {
      const addr = `${path}.items.${a.rang}`;
      if (estSupprime(values, addr)) continue;
      const it = resolveAjout(a, addr);
      if (it) items.push(it);
    }
    const ord = ordreDe(values)[`${path}.items`];
    return (Array.isArray(ord) && ord.length) ? appliquerOrdre(items, ord) : items;
  };

  const resolveNode = (rawNode, path) => {
    // Un bloc que le rédacteur a retiré du document : il n'est pas résolu — donc
    // pas affiché, pas compté, pas exporté. Rien n'est retiré de la trame : un
    // « Rétablir » le rend tel qu'il était (voir lib/structure.js).
    if (estSupprime(values, path)) return null;
    // Le rédacteur peut avoir réécrit le texte de la trame : on applique ses
    // écarts au bloc avant de l'interpréter. Les jetons `{{…}}` qu'il n'a pas
    // touchés continuent d'être résolus normalement.
    const node = overrideNode(rawNode, path, overrides);
    if (node.when && !safeEval(node.when, ctx).value) return null;
    const out = { ...node, path, children: [] };
    // Les réglages propres au bloc (alignement, marqueur de liste, disposition
    // du tableau, formule des considérants…) sont posés ici, complétés par
    // leurs défauts : le rendu et les exports les trouvent ensuite sur le nœud
    // résolu, sans avoir à connaître la structure de la trame. Voir
    // `paramsBloc` (lib/schema.js).
    Object.assign(out, paramsBloc(node));
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
        (node.items || []).forEach((it, j) => {
          const addr = `${path}.items.${j}`;
          if (estSupprime(values, addr)) return;
          if (it.when && !safeEval(it.when, ctx).value) return;
          // « Les décisions fondant la signature » : un visa par décision et par
          // acteur de la chaîne, du sommet vers le signataire — la nomination
          // puis la délégation pour chaque délégataire. Chaque visa porte son
          // LIEN (le recueil, ou l'adresse externe) : c'est lui que le document
          // publie, sur le web comme en PDF. Voir src/lib/delegations.js.
          if (it.chaine && !it.text) {
            for (const d of ctx.signataire?.decisions || []) {
              items.push({ id: `${it.id}:${d.refId || d.label}`, text: finir(d.label), lien: d.lien || "" });
            }
            return;
          }
          const t = finir(resolveVisaItem(it, ctx, config));
          if (t) items.push({ id: it.id, text: t, path: addr });
        });
        out.items = ordonnerPieces(items, path, (a, addr) => {
          if (a.node.when && !safeEval(a.node.when, ctx).value) return null;
          return { id: a.id, text: finir(interp(a.node.text || "")), path: addr, ajout: true };
        });
        break;
      }
      case "considerants": case "list": {
        const items = [];
        const p = paramsBloc(node);
        // La formule du bloc (« Considérant que ») et sa ponctuation finale
        // s'appliquent au texte de chaque élément — jamais ajoutées deux fois :
        // `appliquerFormule` laisse intact un texte qui porte déjà la formule.
        const finir = (t) => {
          const s = String(t || "").trim();
          if (!s || !p.fin) return s;
          return /[.;,:]$/.test(s) ? s : s + p.fin;
        };
        (node.items || []).forEach((it, j) => {
          const addr = `${path}.items.${j}`;
          if (estSupprime(values, addr)) return;
          if (it.when && !safeEval(it.when, ctx).value) return;
          const brut = interp(it.text);
          if (brut.trim() === "") return;
          items.push({ id: it.id, text: finir(appliquerFormule(p.formule, brut)), path: addr });
        });
        out.items = ordonnerPieces(items, path, (a, addr) => {
          if (a.node.when && !safeEval(a.node.when, ctx).value) return null;
          const brut = interp(a.node.text || "");
          if (brut.trim() === "") return null;
          return { id: a.id, text: finir(appliquerFormule(p.formule, brut)), path: addr, ajout: true };
        });
        break;
      }
      case "table":
        out.columns = (node.columns || []).map(interp);
        out.rows = (node.rows || []).map((r) => r.map(interp));
        out.caption = interp(node.caption || "");
        break;
      case "division": {
        divisionCounter++;
        out.eId = node.eId || `div_${divisionCounter}`;
        out.level = Math.max(1, Number(node.level) || 1);
        const niveau = niveauDe(trame, out.level);
        out.levelLabel = niveau.label || "Division";
        if (node.numMode === "manual") {
          out.numLabel = interp(node.num || "");
        } else {
          const n = (niveauCounters.get(out.level) || 0) + 1;
          niveauCounters.set(out.level, n);
          for (const k of [...niveauCounters.keys()]) if (k > out.level) niveauCounters.delete(k);
          const rang = numeroNiveau(n, niveau.num);
          out.numLabel = [out.levelLabel, rang].filter(Boolean).join(" ");
          out.niveau = n;
        }
        out.heading = interp(node.heading || "");
        out.blocks = resolveBlocks(node, out, path);
        break;
      }
      case "article": {
        articleCounter++;
        // eId stable : c'est lui qui permet de viser un article dans un acte
        // modificatif (et de le reprendre dans la version consolidée).
        out.eId = node.eId || `art_${articleCounter}`;
        out.numLabel = node.numMode === "auto" ? numberedLabel(config, articleCounter) : interp(node.num || "");
        out.heading = interp(node.heading || "");
        out.blocks = resolveBlocks(node, out, path);
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

  // Les blocs contenus dans un article ou une division : même résolution, avec
  // un identifiant stable par bloc (c'est lui qui permet de viser un paragraphe
  // dans une modification d'acte).
  const resolveBlocks = (node, out, path) => {
    const container = `${path}.blocks`;
    const list = (node.blocks || [])
      .map((b, i) => {
        const r = resolveNode(b, `${container}.${i}`);
        // Un article ou une division tient son identifiant de son propre rang
        // (`art_2`, `div_3`) ; les autres blocs le tiennent de leur conteneur.
        if (r && !r.eId) r.eId = b.eId || `${out.eId}__p_${i + 1}`;
        return r;
      })
      .filter(Boolean);
    // Les blocs AJOUTÉS par le rédacteur dans cet article ou cette division.
    for (const a of ajoutsDe(values, container)) {
      const r = resolveNode(a.node, `${container}.${a.rang}`);
      if (r) { if (!r.eId) r.eId = a.node?.eId || `aj_${a.id}`; list.push(r); }
    }
    return list;
  };

  // --- l'ordre des blocs
  // Le rédacteur peut avoir rangé autrement les blocs du document (un article
  // remonté avant un autre, un chapitre déplacé) : l'ordre choisi vit à part,
  // dans `values.__ordre`, et s'applique ICI, une fois les blocs résolus. Rien
  // n'est déplacé dans la trame : seule la lecture change. Voir src/lib/ordre.js.
  const ordre = ordreDe(values);
  const ordonner = (list, containerPath) => {
    const ord = ordre[containerPath];
    const out = (Array.isArray(ord) && ord.length) ? appliquerOrdre(list, ord) : list;
    for (const n of out) if (n.blocks) n.blocks = ordonner(n.blocks, `${n.path}.blocks`);
    return out;
  };
  // Renumérotation des articles et des divisions APRÈS réordonnancement : les
  // numéros suivent l'ordre imprimé. Seuls les numéros automatiques bougent —
  // un numéro écrit à la main (« Article R. 1 ») reste ce que le rédacteur a
  // écrit. Les identifiants (`eId`) ne changent pas : ils sont la mémoire des
  // blocs, pas leur rang.
  const renumeroter = (list) => {
    let art = 0;
    const niveaux = new Map();
    const walk = (l) => {
      for (const n of l) {
        if (n.type === "article") {
          art++;
          if (n.numMode === "auto") n.numLabel = numberedLabel(config, art);
        } else if (n.type === "division" && n.numMode !== "manual") {
          const niveau = niveauDe(trame, n.level);
          const k = (niveaux.get(n.level) || 0) + 1;
          niveaux.set(n.level, k);
          for (const key of [...niveaux.keys()]) if (key > n.level) niveaux.delete(key);
          n.numLabel = [niveau.label || "Division", numeroNiveau(k, niveau.num)].filter(Boolean).join(" ");
          n.niveau = k;
        }
        if (n.blocks) walk(n.blocks);
      }
    };
    walk(list);
  };
  const corps = (trame.body || []).map((n, i) => resolveNode(n, `body.${i}`)).filter(Boolean);
  // Les blocs AJOUTÉS au corps par le rédacteur (voir lib/structure.js).
  for (const a of ajoutsDe(values, "body")) {
    const r = resolveNode(a.node, `body.${a.rang}`);
    if (r) { if (!r.eId) r.eId = a.node?.eId || `aj_${a.id}`; corps.push(r); }
  }
  // Une ANNEXE ne porte pas les blocs qui appartiennent à un ACTE : trois d'entre
  // eux sont donc écartés ici, en un seul point.
  //
  //   • le bloc de SIGNATURE — le document annexé ne se signe pas : c'est l'acte
  //     qui l'adopte qui est signé, et sa signature qui lui donne son autorité
  //     (voir `estAnnexeDoc` ci-dessus) ;
  //   • l'AUTORITÉ — la ligne qui dit de quelle autorité émane l'acte (« Le
  //     maire de … ») : une annexe n'émane pas d'une autorité, elle est ADOPTÉE
  //     par un acte, et c'est cet acte qui porte la formule d'autorité ;
  //   • la MENTION DE PUBLICATION AU RECUEIL (« Le présent arrêté est publié au
  //     recueil… ») : une annexe ne se publie pas elle-même — c'est l'acte qui
  //     l'adopte qui est publié, et cette phrase y suffit.
  //
  // Ce qui reste — intitulé, VISAS, articles, divisions, mentions de recours —
  // est le texte du document adopté, tel qu'il s'imprime à la suite de l'acte
  // d'adoption. Les visas sont conservés : un règlement se fonde sur des textes,
  // et le visa de son adoption (« Vu la délibération n°…, qui l'adopte ») est ce
  // qui le rattache à son acte. Voir src/lib/annexes.js.
  const ecarteDAnnexe = (n) => estAnnexeDoc
    && (n.type === "signature" || n.type === "authority" || (n.type === "mention" && n.kind === "publication"));
  const nodes = ordonner(corps, "body").filter((n) => !ecarteDAnnexe(n));
  const ordresTouches = ordresModifies(values);
  if (ordresTouches.length) {
    issues.push({
      id: "ordre-modifie", level: "info",
      message: `L'ordre des blocs a été modifié par rapport à la trame (${ordresTouches.length} endroit${ordresTouches.length > 1 ? "s" : ""}). La trame elle-même n'est pas changée.`,
    });
    // Les numéros suivent l'ordre IMPRIMÉ. Sans cela, un article remonté avant
    // un autre se lirait « Article 2, Article 1er » : le déplacement est un
    // geste de rédaction, il renumérote le dispositif. Les numéros ÉCRITS À LA
    // MAIN ne bougent pas — seul ce que l'application numérotait se renumérote.
    renumeroter(nodes);
  }

  // --- l'annexe : le visa de son adoption
  // Un document annexé se lit toujours à la suite de l'acte qui l'adopte : le
  // visa qui le rappelle vient donc EN TÊTE de ses visas, et il est écrit par
  // l'application (il n'appartient pas à la trame de le composer, puisque c'est
  // la rédaction qui choisit l'acte d'adoption). Voir src/lib/annexes.js.
  const adoption = adoptionDe(values);
  if (adoption && trame.nature === "annexe" && trame.adoptionVisa !== false) {
    const texte = visaAdoption(adoption, config);
    if (texte) {
      const visa = nodes.find((n) => n.type === "visas");
      const item = { id: "visa-adoption", text: texte, lien: adoption.eli || "", adoption: true };
      if (visa) visa.items = [item, ...(visa.items || [])];
      else {
        const i = Math.max(nodes.findIndex((n) => n.type === "authority"), nodes.findIndex((n) => n.type === "title")) + 1;
        nodes.splice(Math.max(0, i), 0, { id: uid("n"), type: "visas", items: [item], path: "adoption", notes: [] });
      }
    }
  }

  // --- les annexes : la liste de ce qui est annexé à l'acte
  // L'acte qui adopte un ou plusieurs documents les ANNONCE à la fin de son
  // dispositif, par leur intitulé : c'est ce qui rend l'annexe trouvable depuis
  // l'acte, et son TEXTE suit l'acte, à la suite de la signature (voir
  // src/lib/annexe-docs.js).
  const annexes = annexesDe(values);
  if (annexes.length) {
    const resolved = nodeAnnexes(annexes, config);
    const at = nodes.findIndex((n) => n.type === "signature" || n.type === "mention");
    if (at < 0) nodes.push(resolved); else nodes.splice(at, 0, resolved);
  }

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
  const sansContenu = (n) => (n.blocks || []).some((b) =>
    (b.type === "list" || b.type === "table") ? (b.items || b.rows || []).length > 0 : String(b.text || "").trim() !== "");
  const walkContenu = (list) => (list || []).forEach((n) => {
    if (n.type === "article" && !sansContenu(n)) {
      issues.push({ id: "struct-" + n.path, level: "warning", message: `${n.numLabel} est sans contenu : clause conditionnelle non remplie ou article à compléter.` });
    }
    if (n.blocks) walkContenu(n.blocks);
  });
  walkContenu(nodes);

  // --- ce que la rédaction a changé à la STRUCTURE du document
  // Un bloc retiré, un paragraphe ajouté : ce sont des actes de rédaction, au
  // même titre qu'une réécriture. On les annonce (aux administrateurs, comme au
  // rédacteur) sans jamais les bloquer. Voir lib/structure.js.
  const nbSupprimes = suppressions(values).length;
  const nbAjouts = Object.values(values?.__ajouts || {}).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0);
  if (nbSupprimes || nbAjouts) {
    issues.push({
      id: "structure-modifiee", level: "info",
      message: [
        nbAjouts ? `${nbAjouts} bloc(s) ou élément(s) ajouté(s) par la rédaction` : "",
        nbSupprimes ? `${nbSupprimes} passage(s) retiré(s) par la rédaction` : "",
      ].filter(Boolean).join(" · ") + ". La trame elle-même n'est pas modifiée.",
    });
  }

  // Une ANNEXE n'a pas de numéro propre, et donc pas d'ELI : son texte suit la
  // décision qui l'adopte, et c'est CETTE décision qui est publiée (voir
  // src/lib/annexes.js). Le numéro qu'un brouillon ancien pourrait encore
  // porter est écarté ici, en un seul point, pour que ni le document ni ses
  // exports ne le montrent. `estAnnexeDoc` est posé plus haut (l'atelier en a
  // déjà besoin pour écarter le champ « signataire »).
  const numero = estAnnexeDoc ? "" : (values.numero || "");
  const seq = (String(numero).match(/^\d{4}-(\d+)/) || [])[1]
    || sequenceCourante(config, { entity: ctx.entity, actTypeId: trame.actTypeId });
  const eliPattern = estAnnexeDoc ? "" : config.numbering.eliPattern
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
      // L'appellation de l'acte, telle que le référentiel la nomme (« Arrêté »,
      // « Délibération », « Règlement intérieur ») : c'est elle qui sert à le
      // désigner dans une phrase (« Vu la délibération n°… du … »), et à
      // intituler sa fiche. Voir src/lib/amend.js (`targetPhrase`).
      designation: (config.actTypes || []).find((t) => t.id === trame.actTypeId)?.label || values.designation || "",
      // « acte » ou « annexe » : la nature du document, qui commande sa
      // modification (voir src/lib/annexes.js) et ce qu'en dit le recueil.
      nature: trame.nature === "annexe" ? "annexe" : "acte",
      // L'acte qui l'adopte, s'il est connu de la rédaction (annexe).
      adoption: adoptionDe(values) || undefined,
      // Les documents annexés à cet acte (vignettes d'identification figées).
      annexes: annexesDe(values).length ? annexesDe(values) : undefined,
      // Feuille de style désignée par la trame (facultatif). Vide, l'habillage
      // se déduit de l'entité puis de la famille — voir src/lib/styles.js.
      styleId: trame.styleId || "",
      entity: ctx.entity,
      org: ctx.org,
      // L'assemblée délibérante, quand l'acte en émane (délibérations) — sa
      // formule d'autorité et la qualité du signataire qu'elle appelle.
      conseil: ctx.conseil || undefined,
      autorite: ctx.autorite || "",
      signataire: ctx.signataire,
      dateSignature: values.dateSignature || "",
      dateEffet: values.dateEffet || "",
      eli: eliPattern,
      generatedAt: new Date().toISOString(),
    },
    ctx,
    nodes,
    // Les documents ANNEXÉS, résolus par l'appelant qui connaît le registre
    // (`src/lib/annexe-docs.js`) : l'acte d'adoption est suivi de leur texte,
    // dans le même document. Voir render.js et export.js.
    annexeDocs: Array.isArray(opts.annexes) && opts.annexes.length ? opts.annexes : undefined,
    notes,
    issues,
    missing: [...new Set(missing)],
    overrides: { ...overrides },
    // Réécritures et réglages modifiés : les deux sont des écarts, présentés
    // ensemble (un réglage porte `reglage: true`).
    ecarts: [...ecartList, ...reglageList],
  };
}

// Le numéro proposé par la séquence interne, et la relecture d'un numéro composé,
// vivent dans le noyau pur `lib/sequence.js` (motif, portée, compteurs) : on les
// réexporte ici, où les écrans les ont toujours trouvés.
export { nextNumero, composerNumeroInterne, prochainNumeroLibre, numerosPris, seqDeNumero, anneeDeNumero, entiteCodeDeNumero, numberingSettings, incrementerSequence, fixerSequence, sequenceCourante, cleSequence, annulerNumero } from "./sequence.js";
import { sequenceCourante } from "./sequence.js";

export const blockingIssues = (issues) => (issues || []).filter((i) => i.level === "blocking");
