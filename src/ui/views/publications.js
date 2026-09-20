// ============================================================================
// Publications — la partie publique.
//
// C'est le pendant « citoyen » de la publication : un registre consultable et,
// pour chaque acte, sa version en ligne, ses métadonnées (ELI, dates, recueil),
// et l'original signé. Rien n'est lu dans les données locales de l'application :
// tout vient du service de publication, comme le ferait n'importe quel site.
// ============================================================================
import { state, navigate, redrawView } from "../state.js";
import { h, clear, button, icon, toast, modal } from "../dom.js";
import { emptyState, helpLink } from "../components.js";
import { get, apiStatus, beginFlow } from "../../lib/remote.js";
import { verifySignedPackage } from "../../lib/signature.js";
import { download, copyText, formatDate } from "../../lib/util.js";
import { printHtml } from "../../lib/export.js";
import { ouvrirPage } from "./signature.js";

export function renderPublications(root, params) {
  if (params && params.id) { renderConsultation(root, params); return; }
  renderRegistre(root);
}

// ------------------------------------------------------------------ registre

function renderRegistre(root) {
  const st = (state.pubRegistre = state.pubRegistre || { chargement: false });
  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Publications" }),
      h("p", { class: "page-head__sub", text: "Recueil des actes publiés : versions en ligne, identifiants ELI, dates d'opposabilité et originaux signés." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("publication", "Comment faire ?"),
      button("Signature & publication", { variant: "secondary", icon: "lock", onClick: () => navigate("signature") }),
      button("Actualiser", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => { st.chargement = false; st.liste = null; redrawView(); } }),
    ),
  ));

  // Résolution directe d'un ELI collé
  const input = h("input", { class: "fr-input", placeholder: "eli:/fr/dec/2026/0401/iam", value: st.saisie || "" });
  input.addEventListener("input", () => { st.saisie = input.value; });
  root.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Résoudre un identifiant ELI" }),
    h("p", { class: "fr-small fr-muted", text: "Un identifiant ELI (European Legislation Identifier) désigne l'acte de façon stable : il ne change ni avec son adresse, ni avec ses versions." }),
    h("div", { class: "fr-row" },
      h("div", { style: { flex: "1 1 320px" } }, input),
      button("Résoudre", { variant: "primary", icon: "eye", onClick: () => resoudre(st.saisie, root) }),
    ),
  ));

  if (!st.liste && !st.chargement) {
    st.chargement = true;
    get("/v1/publications", { label: "Registre des publications", source: "lecture" })
      .then((r) => { st.liste = r.ok ? r.body.publications || [] : []; st.erreur = r.ok ? null : (r.body && r.body.erreur); })
      .catch((e) => { st.erreur = String(e.message || e); st.liste = []; })
      .finally(() => { st.chargement = false; redrawView(); });
  }

  if (st.chargement) { root.appendChild(h("p", { class: "fr-muted", text: "Chargement du registre…" })); return; }
  if (st.erreur) {
    root.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
      h("p", { class: "fr-alert__title", text: "Registre indisponible" }), h("p", { class: "fr-small", text: st.erreur }),
      h("p", { class: "fr-small", text: apiStatus().status === "offline" ? "Le service est en cours de reconnexion." : "" })));
    return;
  }
  if (!st.liste?.length) {
    root.appendChild(emptyState("Aucune publication pour l'instant. Publiez un acte signé depuis l'écran « Signature & publication »."));
    return;
  }

  const table = h("table", { class: "fr-table pub-table" },
    h("thead", {}, h("tr", {},
      h("th", { text: "Identifiant local" }),
      h("th", { text: "Objet" }),
      h("th", { text: "ELI" }),
      h("th", { text: "Publié le" }),
      h("th", { text: "Opposable le" }),
      h("th", { text: "Version" }),
      h("th", {}))));
  const tb = h("tbody");
  for (const p of st.liste) {
    tb.appendChild(h("tr", {},
      h("td", { class: "fr-mono", text: p.numero || "—" }),
      h("td", { text: p.objet || "" }),
      h("td", { class: "fr-mono fr-small", text: p.eliUri || "" }),
      h("td", { class: "fr-small", text: formatDate(p.datePublication) }),
      h("td", { class: "fr-small", text: formatDate(p.dateOpposabilite) }),
      h("td", {},
        h("span", { class: "fr-badge fr-badge--" + (p.latest ? "success" : "info"), text: p.latest ? "en vigueur" : "antérieure" }),
        h("div", { class: "fr-small fr-muted", text: kindLabelOf(p.kind) })),
      h("td", {}, button("Consulter", { variant: "secondary", size: "sm", icon: "eye", onClick: () => navigate("publication/" + encodeURIComponent(p.cle)) })),
    ));
  }
  table.appendChild(tb);
  root.appendChild(h("div", { class: "fr-table-wrap" }, table));
  root.appendChild(h("p", { class: "fr-small fr-muted", text: `${st.liste.length} publication(s). Seul l'original signé fait foi ; la version en ligne est diffusée à titre informatif.` }));
}

async function resoudre(saisie, root) {
  const brut = String(saisie || "").trim();
  const m = brut.match(/eli:\/fr\/(.+)/) || brut.match(/^\/?fr\/(.+)/);
  if (!m) { toast("Saisissez un identifiant ELI, par exemple eli:/fr/dec/2026/0401/iam", "warning"); return; }
  const flow = beginFlow("Résolution d'un ELI");
  try {
    const res = await get("/v1/eli/" + m[1].replace(/\s+/g, ""), { flow, label: "Résolution ELI " + brut });
    if (!res.ok) { toast(res.body?.erreur || "ELI inconnu", "error"); return; }
    const cle = res.body.ressource || ("/v1/publications/" + encodeURIComponent(res.body.enVigueur.cle));
    navigate("publication/" + encodeURIComponent(res.body.enVigueur.cle));
  } catch (e) { toast(String(e.message || e), "error"); }
}

// --------------------------------------------------------------- consultation

function renderConsultation(root, params) {
  const st = (state.pubConsult = state.pubConsult || {});
  const cle = decodeURIComponent(params.id);
  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Version en ligne" }),
      h("p", { class: "page-head__sub", text: "Acte publié au recueil. Consultable par son identifiant ELI." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("publication", "Comment faire ?"),
      button("Registre des publications", { variant: "secondary", icon: "list", onClick: () => navigate("publications") }),
    ),
  ));

  if (st.cle !== cle) {
    st.cle = cle; st.rec = null; st.chargement = true; st.erreur = null; st.verif = null;
    chargerConsultation(st, cle);
  }
  if (st.chargement) { root.appendChild(h("p", { class: "fr-muted", text: "Chargement de la version en ligne…" })); return; }
  if (!st.rec) {
    root.appendChild(emptyState(st.erreur || "Publication introuvable.",
      h("div", { class: "fr-row" },
        button("Réessayer", { variant: "primary", onClick: () => { st.cle = null; redrawView(); } }),
        button("Retour au registre", { variant: "secondary", onClick: () => navigate("publications") }))));
    return;
  }

  const p = st.rec;
  const onglet = (st.onglet = st.onglet || "texte");

  // Bandeau « publication officielle »
  root.appendChild(h("div", { class: "pub-head" },
    h("div", { class: "pub-head__left" },
      h("span", { class: "pub-head__recueil", text: p.recueil || "Recueil des actes administratifs" }),
      h("span", { class: "fr-badge fr-badge--info", text: p.nature || "Acte" }),
      h("span", { class: "fr-badge fr-badge--" + (p.kind === "consolidee" ? "success" : p.kind === "modificative" ? "warning" : "info"), text: kindLabelOf(p.kind) }),
      h("span", { class: "fr-badge fr-badge--" + (p.latest ? "success" : "warning"), text: p.latest ? "version en vigueur" : "version antérieure" }),
    ),
    h("div", { class: "pub-head__eli" },
      h("span", { class: "fr-small fr-muted", text: "ELI" }),
      h("code", { class: "fr-mono", text: p.eliUri }),
      h("button", { class: "fr-btn fr-btn--tertiary fr-btn--sm", onClick: async () => { (await copyText(p.eliUri)) ? toast("ELI copié") : toast("Copie impossible", "warning"); } }, icon("copy", 13), h("span", { text: "Copier" }))),
  ));

  root.appendChild(h("h2", { class: "pub-title", text: p.objet || p.numero }));
  root.appendChild(h("p", { class: "fr-small fr-muted", text: [p.numero && "n° " + p.numero, p.entityName, p.auteur].filter(Boolean).join(" · ") }));

  // Colonnes : texte + métadonnées
  const grid = h("div", { class: "pub-grid" });
  const main = h("div", {});
  const aside = h("div", {});
  grid.appendChild(main); grid.appendChild(aside);
  root.appendChild(grid);

  // dates / opposabilité
  aside.appendChild(h("div", { class: "oppo" },
    h("strong", { text: "Opposabilité" }),
    h("dl", { class: "pub-dl" },
      h("dt", { text: "Signé le" }), h("dd", { text: formatDate(p.dateDocument) }),
      h("dt", { text: "Publié le" }), h("dd", { text: formatDate(p.datePublication) }),
      h("dt", { text: "Entrée en vigueur" }), h("dd", {}, h("strong", { text: formatDate(p.dateOpposabilite) })),
    ),
    h("p", { class: "fr-small", style: { margin: "6px 0 0" }, text: p.opposabiliteRule ? "Règle : " + p.opposabiliteRule + "." : "" }),
  ));

  aside.appendChild(h("div", { class: "fr-card" },
    h("h3", { class: "fr-card__title", text: "Pièces et formats" }),
    h("div", { class: "fr-stack" },
      button("Original signé", { variant: "primary", icon: "lock", onClick: () => { st.onglet = "original"; redrawView(); } }),
      button("Version en ligne (HTML)", { variant: "secondary", icon: "eye", onClick: () => ouvrirPage(p.formats.html, "Version en ligne") }),
      button("Imprimer / PDF", { variant: "secondary", icon: "download", onClick: () => printHtml(p.formats.html) }),
      button("Akoma Ntoso (.akn.xml)", { variant: "secondary", icon: "download", onClick: () => download(fileName(p) + ".akn.xml", p.formats.akn, "application/xml") }),
      button("JSON-LD (ELI)", { variant: "secondary", icon: "download", onClick: () => download(fileName(p) + ".jsonld", p.formats.jsonld, "application/ld+json") }),
    ),
  ));

  aside.appendChild(h("div", { class: "fr-card" },
    h("h3", { class: "fr-card__title", text: "Signature" }),
    h("dl", { class: "pub-dl" },
      h("dt", { text: "Signataire" }), h("dd", { text: (p.signature?.signataires || []).map((s) => s.nom).filter(Boolean).join(", ") || "—" }),
      h("dt", { text: "Le" }), h("dd", { text: p.signature?.signeLe ? new Date(p.signature.signeLe).toLocaleString("fr-FR") : "—" }),
      h("dt", { text: "Algorithme" }), h("dd", { text: p.signature?.algorithme || "—" }),
      h("dt", { text: "Prestataire" }), h("dd", { text: p.signature?.prestataire?.nom || "—" }),
      h("dt", { text: "Empreinte" }), h("dd", { class: "fr-mono fr-small", text: (p.original?.sha256 || "").slice(0, 32) + "…" }),
    ),
  ));

  if (p.ecarts) {
    aside.appendChild(h("p", { class: "fr-small fr-muted", text: `${p.ecarts} écart(s) de rédaction par rapport à la trame d'origine.` }));
  }

  // onglets
  const tabs = h("div", { class: "fr-tabs" });
  for (const t of [{ id: "texte", label: "Texte" }, { id: "metadonnees", label: "Métadonnées" }, { id: "versions", label: "Versions" }, { id: "original", label: "Original signé" }]) {
    tabs.appendChild(h("button", {
      class: "fr-tab" + (onglet === t.id ? " fr-tab--active" : ""),
      text: t.label,
      onClick: () => { st.onglet = t.id; redrawView(); },
    }));
  }
  main.appendChild(tabs);

  if (onglet === "texte") {
    main.appendChild(docFrame(p.formats.html));
  } else if (onglet === "metadonnees") {
    main.appendChild(h("div", { class: "fr-card" },
      h("h3", { class: "fr-card__title", text: "Métadonnées de la publication" }),
      h("p", { class: "fr-small fr-muted", text: "Ces métadonnées accompagnent la version en ligne (JSON-LD / vocabulaire ELI)." }),
      h("pre", { class: "fr-mono fr-codebox", text: p.formats.jsonld || "" }),
      h("div", { class: "fr-row" },
        button("Copier", { variant: "tertiary", size: "sm", icon: "copy", onClick: async () => { (await copyText(p.formats.jsonld)) ? toast("Copié") : toast("Copie impossible", "warning"); } }),
        button("Télécharger", { variant: "tertiary", size: "sm", icon: "download", onClick: () => download(fileName(p) + ".jsonld", p.formats.jsonld, "application/ld+json") })),
    ));
  } else if (onglet === "versions") {
    const card = h("div", { class: "fr-card" }, h("h3", { class: "fr-card__title", text: "Historique des versions publiées sous ce même ELI" }));
    card.appendChild(h("p", { class: "fr-small fr-muted", text: "Un même identifiant ELI désigne l'acte dans le temps : quand l'acte est modifié, la version consolidée est publiée sous ce même identifiant et devient la version en vigueur. Les versions antérieures restent consultables — rien n'est effacé." }));
    const versions = (p.versions?.length ? [...p.versions] : [p])
      .sort((x, y) => String(x.dateDocument || "").localeCompare(String(y.dateDocument || "")) || String(x.publieeLe || "").localeCompare(String(y.publieeLe || "")));
    versions.forEach((v, i) => {
      const last = i === versions.length - 1;
      card.appendChild(h("div", { class: "pub-version" + (v.cle === p.cle ? " is-on" : "") },
        h("div", {},
          h("strong", { text: `${kindLabelOf(v.kind)} — ${formatDate(v.dateDocument)}` }),
          h("p", { class: "fr-small fr-muted", text: `Publiée le ${formatDate(v.datePublication)}${v.recueil ? " · " + v.recueil : ""}` })),
        h("div", { class: "fr-row" },
          last
            ? h("span", { class: "fr-badge fr-badge--success", text: "version en vigueur" })
            : h("span", { class: "fr-badge fr-badge--warning", text: "supplantée" }),
          v.cle === p.cle
            ? h("span", { class: "fr-badge fr-badge--info", text: "consultée" })
            : button("Consulter", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("publication/" + encodeURIComponent(v.cle)) }))));
    });
    main.appendChild(card);
  } else {
    main.appendChild(h("div", { class: "fr-card" },
      h("h3", { class: "fr-card__title", text: "Original signé" }),
      h("p", { class: "fr-small fr-muted", text: "L'original signé est la pièce de référence : c'est lui qui est conservé et qui fait foi. La vérification porte sur l'empreinte du document et sur la signature du certificat." }),
      verificationBox(p, st),
    ));
    main.appendChild(docFrame(p.original?.pageHtml, "Original signé indisponible."));
  }
}

// La version publiée est affichée dans un cadre : c'est bien le document déposé
// (page autonome), et le cadre prend la hauteur du document pour rester lisible.
function docFrame(html, vide) {
  const wrap = h("div", { class: "pub-frame" });
  const frame = h("iframe", { class: "pub-frame__el", sandbox: "allow-same-origin", title: "Document publié", srcdoc: html || `<p>${vide || "Version en ligne indisponible."}</p>` });
  wrap.appendChild(frame);
  const fit = () => {
    try {
      const d = frame.contentDocument;
      if (!d || !d.documentElement) return;
      frame.style.height = Math.max(320, Math.min(6000, d.documentElement.scrollHeight + 8)) + "px";
    } catch (e) { /* cadre isolé : on garde la hauteur par défaut */ }
  };
  frame.addEventListener("load", fit);
  setTimeout(fit, 60);
  setTimeout(fit, 400);
  return wrap;
}

function verificationBox(p, st) {
  const box = h("div", { class: "fr-stack" });
  const result = h("div", {});
  box.appendChild(h("div", { class: "fr-row" },
    button(st.verif ? "Revérifier la signature" : "Vérifier la signature", {
      variant: "primary", icon: "lock",
      onClick: async () => {
        const pack = { document: { akn: p.formats.akn, sha256: p.original?.sha256 }, signatures: p.original?.signatures || [], horodatage: p.original?.horodatage };
        st.verif = { enCours: true, checks: [] };
        redrawView();
        const r = await verifySignedPackage(pack);
        st.verif = { enCours: false, ok: r.ok, checks: r.checks };
        redrawView();
      },
    }),
    button("Télécharger l'original (JSON)", {
      variant: "secondary", icon: "download",
      onClick: () => download(fileName(p) + "-original-signe.json", JSON.stringify({ ...p.original, document: { akn: p.formats.akn, sha256: p.original?.sha256 } }, null, 2), "application/json"),
    }),
    p.original?.pageHtml && button("Imprimer / PDF", {
      variant: "secondary", icon: "download",
      onClick: () => printHtml(p.original.pageHtml),
    })));
  if (st.verif?.enCours) box.appendChild(h("p", { class: "fr-muted", text: "Vérification en cours…" }));
  if (st.verif?.checks?.length) {
    box.appendChild(h("div", { class: "fr-alert fr-alert--" + (st.verif.ok ? "success" : "error") },
      h("p", { class: "fr-alert__title", text: st.verif.ok ? "Signature vérifiée" : "Signature non vérifiée" }),
      ...st.verif.checks.map((c) => h("p", { class: "fr-small" },
        h("strong", { text: (c.ok ? "✓ " : "✗ ") + c.label + " — " }), c.detail)),
    ));
  }
  return box;
}

const fileName = (p) => String(p.numero || p.cle || "acte").replace(/[^\w-]+/g, "_");
const kindLabelOf = (kind) => (kind === "consolidee" ? "Version consolidée" : kind === "modificative" ? "Acte modificatif" : "Version originale");

function chargerConsultation(st, cle) {
  get("/v1/publications/" + encodeURIComponent(cle), { label: "Consultation de la publication", source: "lecture" })
    .then((r) => { if (r.ok) st.rec = r.body; else st.erreur = r.body?.erreur || `Publication introuvable (${r.status}).`; })
    .catch((e) => { st.erreur = String(e.message || e); })
    .finally(() => { st.chargement = false; redrawView(); });
}
