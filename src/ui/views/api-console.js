// ============================================================================
// Onglet « API & journal ».
//
// Deux choses côte à côte :
//   • la description de l'API (OpenAPI 3.1) telle que le SERVICE la publie sur
//     GET /v1/ — avec, pour chaque opération, l'URL, les paramètres, les
//     réponses, et un bouton « Essayer » qui lance un appel réel ;
//   • le journal des échanges : chaque requête envoyée et chaque réponse reçue,
//     y compris les appels sortants vers le prestataire de signature.
// ============================================================================
import { state } from "../state.js";
import { h, clear, button, icon, toast } from "../dom.js";
import { get, call, log, clearLog, onLog, apiStatus, beginFlow } from "../../lib/remote.js";
import { publicationSettings } from "../../lib/eli.js";
import { copyText, todayIso } from "../../lib/util.js";
import { docOfActe } from "./modifier.js";
import { exportAkn } from "../../lib/export.js";

// URL affichée pour l'API : celle du déploiement en auto-hébergement, celle de
// la démonstration.
const BASE = globalThis.__SCRIBA_SELF_HOSTED__
  ? ((globalThis.__SCRIBA_API_BASE__ || "").replace(/\/+$/, "") || globalThis.location.origin)
  : "https://api.valmont-sur-loire.fr";

let journalUnsub = null;
let specLoading = false;
let specLastTry = 0;

export function renderApiTab(root, ctx) {
  const ui = (state.api = state.api || { sansJeton: false, ouvert: null });
  const settings = publicationSettings(state.config);
  const grid = h("div", { class: "api-grid" });
  const left = h("div", { class: "fr-stack" });
  const right = h("div", { class: "fr-stack" });
  grid.appendChild(left); grid.appendChild(right);
  root.appendChild(grid);

  // -------------------------------------------------------------- entête
  const aCle = !!settings.jetonDemonstration;
  const tokenBox = h("code", {
    class: "fr-mono api-token",
    text: aCle ? (ui.revele ? settings.jetonDemonstration : mask(settings.jetonDemonstration)) : "(aucune clé sur ce poste)",
  });
  left.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "API REST du service" }),
    h("p", { class: "fr-small fr-muted", text: "Le recueil public et la résolution des identifiants ELI sont ouverts à tous. Tout le reste — référentiel, actes déposés, comptes, journal — exige une clé d'API, et chaque clé porte un rôle qui commande les routes qu'elle peut appeler." }),
    h("div", { class: "api-base" },
      h("span", { class: "fr-small fr-muted", text: "URL de base" }),
      h("code", { class: "fr-mono", text: BASE }),
      h("button", { class: "fr-btn fr-btn--tertiary fr-btn--sm", onClick: async () => { (await copyText(BASE)) ? toast("URL copiée") : toast("Copie impossible", "warning"); } }, icon("copy", 13), h("span", { text: "Copier" }))),
    h("div", { class: "api-base" },
      h("span", { class: "fr-small fr-muted", text: "Clé du poste" }),
      tokenBox,
      aCle ? h("button", { class: "fr-btn fr-btn--tertiary fr-btn--sm", onClick: () => { ui.revele = !ui.revele; ctx.paint(); } }, icon("lock", 13), h("span", { text: ui.revele ? "Masquer" : "Révéler" })) : null,
      aCle ? h("button", { class: "fr-btn fr-btn--tertiary fr-btn--sm", onClick: async () => { (await copyText(settings.jetonDemonstration)) ? toast("Clé copiée") : toast("Copie impossible", "warning"); } }, icon("copy", 13), h("span", { text: "Copier" })) : null),
    !aCle ? h("p", { class: "fr-small fr-muted", text: "Ce poste ne détient aucune clé : les routes protégées répondent 401/403. La clé se règle dans Administration › Base de données (provisionnement du service ou jeton du serveur externe)." }) : null,
    h("label", { class: "fr-check", style: { marginTop: "8px" } },
      h("input", { type: "checkbox", checked: ui.sansJeton, onChange: (e) => { ui.sansJeton = e.target.checked; ctx.paint(); } }),
      "Simuler un client sans clé (les routes protégées répondent alors 401)"),
  ));

  // ------------------------------------------------------- description API
  const specCard = h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Description de l'API (OpenAPI)" }),
      button("Recharger", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => { state.apiSpec = null; chargerSpec(ctx.paint); } })),
  );
  left.appendChild(specCard);
  if (!state.apiSpec) {
    specCard.appendChild(h("p", { class: "fr-small fr-muted", text: apiStatus().status === "online" ? "Chargement de la description…" : "Le service n'est pas joignable pour l'instant." }));
    if (!specLoading && Date.now() - specLastTry > 5000) chargerSpec(ctx.paint);
  } else {
    const paths = state.apiSpec.paths || {};
    const groupes = {};
    for (const [path, ops] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(ops)) {
        const tag = (op.tags && op.tags[0]) || "Autres";
        (groupes[tag] = groupes[tag] || []).push({ path, method, op });
      }
    }
    for (const [tag, ops] of Object.entries(groupes)) {
      specCard.appendChild(h("h3", { class: "api-group", text: tag }));
      for (const { path, method, op } of ops) {
        specCard.appendChild(h("details", { class: "api-op", open: ui.ouvert === op.operationId },
          h("summary", { onClick: () => { ui.ouvert = ui.ouvert === op.operationId ? null : op.operationId; } },
            h("span", { class: "api-method api-method--" + method, text: method.toUpperCase() }),
            h("code", { class: "fr-mono", text: "/v1" + path.replace(/^\/v1/, "") }),
            h("span", { class: "api-op__sum", text: op.summary || "" }),
            op.security && op.security.length ? h("span", { class: "fr-badge fr-badge--warning", text: "jeton" }) : h("span", { class: "fr-badge fr-badge--info", text: "public" })),
          h("div", { class: "api-op__body" },
            h("p", { class: "fr-small", text: op.description || "" }),
            op.parameters?.length ? h("div", {},
              h("p", { class: "fr-small fr-muted", text: "Paramètres" }),
              h("ul", { class: "fr-small" }, ...op.parameters.map((p) => h("li", {}, h("code", { class: "fr-mono", text: p.name }), " — " + (p.description || p.schema?.type || ""))))) : null,
            op.requestBody ? h("div", {},
              h("p", { class: "fr-small fr-muted", text: "Corps de la requête" }),
              h("ul", { class: "fr-small" }, ...Object.entries(op.requestBody.content?.["application/json"]?.schema?.properties || {})
                .map(([k, v]) => h("li", {}, h("code", { class: "fr-mono", text: k }), " — " + (v.description || v.type || ""))))) : null,
            h("p", { class: "fr-small fr-muted", text: "Réponses" }),
            h("ul", { class: "fr-small" }, ...Object.entries(op.responses || {}).map(([code, r]) => h("li", {}, h("code", { class: "fr-mono", text: code }), " — " + (r.description || "")))),
            h("div", { class: "fr-row" }, boutonEssayer(op, ctx)),
          )));
      }
    }
    specCard.appendChild(h("p", { class: "fr-small fr-muted", text: `${Object.keys(paths).length} chemins exposés · OpenAPI ${state.apiSpec.openapi}` }));
  }

  // --------------------------------------------------------------- journal
  const journalCard = h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Journal des échanges" }),
      button("Vider", { variant: "tertiary", size: "sm", icon: "trash", onClick: () => { clearLog(); } })),
    h("p", { class: "fr-small fr-muted", text: "Chaque ligne est un échange réel : la requête envoyée et la réponse reçue. Les appels en bleu vont au service ; ceux en violet partent vers le prestataire de signature, ceux en vert vers l'API d'envoi du contrôle de légalité, et ceux en orange vers le service de numérotation." }),
  );
  const journalBox = h("div", { class: "api-journal" });
  journalCard.appendChild(journalBox);
  right.appendChild(journalCard);

  // ---------------------------------------------------------- actions rapides
  const rapide = h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Actions rapides" }),
    h("p", { class: "fr-small fr-muted", text: "Les mêmes appels que ceux de l'écran « Circuit de signature », lancés à la main pour les observer." }),
  );
  const rows = h("div", { class: "fr-row" });
  rapide.appendChild(rows);
  const simple = (label, method, path, body, opts) => rows.appendChild(button(label, {
    variant: "secondary", size: "sm",
    disabled: apiStatus().status !== "online",
    onClick: async () => { try { await call(method, path, { body, ...(opts || {}) }); ctx.paint(); } catch (e) { toast(String(e.message || e), "error"); } },
  }));
  simple("GET /v1/health", "GET", "/v1/health");
  simple("GET /v1/actes", "GET", "/v1/actes");
  simple("GET /v1/signatures", "GET", "/v1/signatures");
  simple("GET /v1/publications", "GET", "/v1/publications");
  right.appendChild(rapide);

  function paintJournal() {
    if (!journalBox.isConnected) { if (journalUnsub) { journalUnsub(); journalUnsub = null; } return; }
    clear(journalBox);
    const entries = log.slice(-60).reverse();
    if (!entries.length) {
      journalBox.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun échange pour l'instant. Lancez une action rapide ou envoyez un acte en signature." }));
      return;
    }
    for (const e of entries) journalBox.appendChild(entryEl(e));
  }

  paintJournal();
  if (journalUnsub) journalUnsub();
  journalUnsub = onLog(paintJournal);

  function boutonEssayer(op, c) {
    const ex = exemplePour(op.operationId);
    if (!ex) return h("span", { class: "fr-small fr-muted", text: ex === null ? "" : "Exemple indisponible : il n'y a pas encore d'objet à interroger." });
    const settings2 = publicationSettings(state.config);
    return button("Essayer", {
      variant: "primary", size: "sm", icon: "code",
      disabled: apiStatus().status !== "online",
      onClick: async () => {
        const flow = beginFlow("Essai depuis la documentation");
        try {
          const res = await call(ex.method, ex.path, {
            body: ex.body,
            token: ui.sansJeton || !ex.auth ? null : settings2.jetonDemonstration,
            flow, label: (op.summary || op.operationId), source: "console",
          });
          toast(`${ex.method} ${ex.path} → ${res.status}`, res.ok ? "success" : "warning");
        } catch (e) { toast(String(e.message || e), "error"); }
        c.paint();
      },
    });
  }
}

function mask(t) {
  const s = String(t || "");
  return s.length > 12 ? s.slice(0, 10) + "••••••••" + s.slice(-4) : s;
}

function chargerSpec(paint) {
  specLoading = true;
  specLastTry = Date.now();
  get("/v1/", { label: "Description OpenAPI", source: "console" })
    .then((res) => { if (res.ok) state.apiSpec = res.body; })
    .catch(() => {})
    .finally(() => { specLoading = false; paint(); });
}

// Exemples d'appel réels, construits à partir de ce que contient le service.
function exemplePour(operationId) {
  const premier = (arr, f) => (arr || []).find(f) || (arr || [])[0] || null;
  switch (operationId) {
    case "sante": return { method: "GET", path: "/v1/health" };
    case "listerActes": return { method: "GET", path: "/v1/actes" };
    case "listerSignatures": return { method: "GET", path: "/v1/signatures" };
    case "listerPublications": return { method: "GET", path: "/v1/publications" };
    case "lireActe": {
      const a = state.actes.find((x) => x.api?.acteId);
      return a ? { method: "GET", path: `/v1/actes/${a.api.acteId}` } : null;
    }
    case "lireDocumentActe": {
      const a = state.actes.find((x) => x.api?.acteId);
      return a ? { method: "GET", path: `/v1/actes/${a.api.acteId}/document` } : null;
    }
    case "suivreSignature": {
      const a = state.actes.find((x) => x.api?.signatureId);
      return a ? { method: "GET", path: `/v1/signatures/${a.api.signatureId}` } : null;
    }
    case "lireDocumentSigne": {
      const a = state.actes.find((x) => x.api?.signatureId && (x.original || x.statut === "signee" || x.statut === "publie"));
      return a ? { method: "GET", path: `/v1/signatures/${a.api.signatureId}/document-signe` } : null;
    }
    case "lireTransmission": {
      // Le service ne connaît que les transmissions qu'il a faites lui-même
      // (celles constatées à la main vivent au dossier, pas chez lui).
      const a = state.actes.find((x) => x.api?.acteId && x.execution?.transmission?.api && x.statut !== "brouillon");
      return a ? { method: "GET", path: `/v1/actes/${a.api.acteId}/transmission` } : null;
    }
    case "deposerActe": {
      const a = state.actes.find((x) => x.trameId) || state.actes[0];
      if (!a) return null;
      const doc = docOfActe(a);
      if (!doc) return null;
      const trame = state.trames.find((t) => t.id === a.trameId);
      return {
        method: "POST", path: "/v1/actes", auth: true,
        body: { akn: exportAkn(doc, state.config, trame), numero: a.numero || doc.meta?.numero || "", objet: a.objet || doc.meta?.objet || "", nature: doc.meta?.actTypeId || "Décision", entityId: doc.meta?.entity?.id || "", entityName: doc.meta?.entity?.name || "", dateSignature: a.dateSignature || doc.meta?.dateSignature || "", trameId: a.trameId || "", ecarts: (a.ecarts || []).length },
      };
    }
    case "envoyerEnSignature": {
      const a = state.actes.find((x) => x.api?.acteId && x.statut !== "signee" && x.statut !== "publie");
      return a ? { method: "POST", path: `/v1/actes/${a.api.acteId}/signature`, auth: true, body: { signataires: [{ nom: a.api.signataire || "Signataire", ordre: 1 }], niveau: "avancee" } } : null;
    }
    case "publierActe": {
      const a = state.actes.find((x) => x.api?.acteId && (x.original || x.statut === "signee"));
      if (!a) return null;
      const doc = docOfActe(a);
      return { method: "POST", path: `/v1/actes/${a.api.acteId}/publication`, auth: true, body: { eliUri: a.eli || "", dateDocument: a.dateSignature || "", datePublication: todayIso(), html: "<p>version en ligne</p>", akn: a.api.akn || (doc ? exportAkn(doc, state.config, state.trames.find((t) => t.id === a.trameId)) : ""), jsonld: "", original: a.original || { format: "application/vnd.actes.original-signe+json", document: { akn: "", sha256: "" } } } };
    }
    case "lirePublication": {
      const a = state.actes.find((x) => x.publication?.cle);
      return a ? { method: "GET", path: "/v1/publications/" + encodeURIComponent(a.publication.cle) } : null;
    }
    case "resoudreEli": {
      const a = state.actes.find((x) => x.publication?.eliUri);
      if (!a) return null;
      const m = a.publication.eliUri.match(/^eli:\/fr\/(.+)$/);
      return m ? { method: "GET", path: "/v1/eli/" + m[1] } : null;
    }
    default: return null;
  }
}

// ------------------------------------------------------------ rendu d'un échange

const pretty = (v) => JSON.stringify(clip(v), null, 2);

// Tronque les longues chaînes (documents) pour garder l'affichage lisible.
function clip(v, depth = 0) {
  if (typeof v === "string") return v.length > 300 ? v.slice(0, 300) + ` … [+${v.length - 300} caractères]` : v;
  if (Array.isArray(v)) return v.slice(0, 12).map((x) => clip(x, depth + 1));
  if (v && typeof v === "object") {
    if (depth > 4) return "…";
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = clip(x, depth + 1);
    return o;
  }
  return v;
}

// Le journal mêle quatre origines : l'API du service, le prestataire de
// signature, l'API d'envoi du contrôle de légalité, et le service de
// numérotation (Administration › Numérotation).
const SERVICES = {
  api: { label: "API", kind: "api" },
  prestataire: { label: "Prestataire", kind: "prestataire" },
  "controle-legalite": { label: "Contrôle de légalité", kind: "legalite" },
  numerotation: { label: "Numérotation", kind: "numerotation" },
};
const serviceOf = (e) => SERVICES[e.service] || { label: e.service || "Service", kind: "prestataire" };

function entryEl(e) {
  const isApi = e.service === "api";
  const svc = serviceOf(e);
  const url = isApi ? e.path : e.url;
  const status = e.status || 0;
  const tone = status === 0 ? "error" : status < 300 ? "success" : status < 400 ? "info" : "error";
  return h("details", { class: "api-entry api-entry--" + svc.kind },
    h("summary", {},
      h("span", { class: "api-svc", text: svc.label }),
      h("span", { class: "api-method api-method--" + String(e.method || "GET").toLowerCase(), text: e.method || "GET" }),
      h("code", { class: "fr-mono api-entry__url", text: url }),
      h("span", { class: "fr-badge fr-badge--" + tone, text: status ? String(status) : "échec" }),
      h("span", { class: "fr-small fr-muted api-ms", text: (e.ms != null ? e.ms + " ms" : "") })),
    h("div", { class: "api-entry__body" },
      e.label ? h("p", { class: "fr-small fr-muted", text: e.label }) : null,
      h("p", { class: "fr-small fr-muted", text: e.at ? new Date(e.at).toLocaleTimeString("fr-FR") : "" }),
      h("p", { class: "api-entry__h", text: "Requête" }),
      h("pre", { class: "fr-mono fr-codebox", text: pretty(e.request ?? null) }),
      h("p", { class: "api-entry__h", text: "Réponse" }),
      h("pre", { class: "fr-mono fr-codebox", text: pretty(e.response ?? null) }),
      h("div", { class: "fr-row" },
        button("Copier en cURL", {
          variant: "tertiary", size: "sm", icon: "copy",
          onClick: async () => { (await copyText(curlOf(e))) ? toast("Commande copiée") : toast("Copie impossible", "warning"); },
        }),
        button("Voir la réponse complète", {
          variant: "tertiary", size: "sm", icon: "eye",
          onClick: () => { showFull(e); },
        })),
    ));
}

function showFull(e) {
  import("../dom.js").then(({ modal, button }) => {
    modal({
      title: `${e.method} ${e.service === "api" ? e.path : e.url} — réponse ${e.status}`,
      wide: true,
      body: h("div", { class: "fr-stack" },
        h("p", { class: "api-entry__h", text: "Requête" }),
        h("pre", { class: "fr-mono fr-codebox", text: JSON.stringify(e.request, null, 2) }),
        h("p", { class: "api-entry__h", text: "Réponse" }),
        h("pre", { class: "fr-mono fr-codebox", text: JSON.stringify(e.response, null, 2) })),
      actions: (close) => [button("Fermer", { variant: "secondary", onClick: close })],
    });
  });
}

export function curlOf(e) {
  const isApi = e.service === "api";
  const url = isApi ? BASE + e.path : e.url;
  const req = e.request || {};
  // Deux formes d'appel sortant : celui qui DÉCRIT la requête entière (le
  // service de numérotation : url, méthode, en-têtes, corps) et celui qui ne
  // porte que le corps (le prestataire). On les distingue pour que la commande
  // copiée soit exacte dans les deux cas.
  const detaille = !isApi && req && typeof req === "object" && "body" in req && "headers" in req;
  const lines = [`curl -i -X ${e.method || "GET"} '${url}'`];
  if (isApi || detaille) {
    const entetes = req.headers || {};
    if (!Object.keys(entetes).some((k) => k.toLowerCase() === "content-type")) lines.push("  -H 'content-type: application/json'");
    for (const [k, v] of Object.entries(entetes)) {
      if (k.toLowerCase() === "authorization") lines.push(`  -H 'Authorization: ${v}'`);
      else lines.push(`  -H '${k}: ${v}'`);
    }
  }
  const body = isApi ? req.body : (detaille ? req.body : req);
  if (body != null && body !== "") lines.push(`  --data-raw '${JSON.stringify(body)}'`);
  return lines.join(" \\\n");
}
