// ============================================================================
// Publications — le registre de l'administration.
//
// La face publique de la publication, c'est le RECUEIL (route « #/recueil »,
// voir views/recueil-public.js) : un site sans compte, où chacun lit le texte
// des actes. Cet écran-ci est l'atelier : la liste des publications du service,
// la résolution d'un identifiant ELI, les formats et l'original signé.
//
// La consultation d'une publication emprunte le MÊME rendu que le recueil
// (views/acte-publie.js) : la notice de l'acte, puis son texte présenté dans la
// page. Rien n'est lu dans les données locales de l'application — tout vient du
// service de publication, comme le ferait n'importe quel site.
// ============================================================================
import { state, navigate, redrawView, can, currentUser, touch, journaliser } from "../state.js";
import { h, button, toast, modal, icon } from "../dom.js";
import { emptyState, helpLink } from "../components.js";
import { get, post, apiStatus, errorMessage, beginFlow } from "../../lib/remote.js";
import { verifySignedPackage } from "../../lib/signature.js";
import { download, copyText, formatDate } from "../../lib/util.js";
import { printHtml } from "../../lib/export.js";
import { lienRecueil } from "../../lib/recueil.js";
import { publicationSettings } from "../../lib/eli.js";
import { corpsDeLActe, setListePublications, blocPieces, blocSignature, blocVersions, blocDonneesPubliques } from "./acte-publie.js";
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
      button("Recueil public", { variant: "secondary", icon: "globe", onClick: () => navigate("recueil") }),
      button("Signature & publication", { variant: "secondary", icon: "lock", onClick: () => navigate("signature") }),
      button("Actualiser", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => { st.chargement = false; st.liste = null; redrawView(); } }),
    ),
  ));

  root.appendChild(h("div", { class: "fr-card" },
    h("h2", { class: "fr-card__title", text: "Le recueil public" }),
    h("p", { class: "fr-small fr-muted", text: "Les actes publiés sont consultables par tous, sans compte, dans le recueil public : une recherche, la liste des actes et, pour chacun, son texte — la « version en ligne » d'aujourd'hui. L'identifiant ELI y figure sur chaque acte, et le registre ci-dessous sert à l'administration (métadonnées, formats, original signé)." }),
    h("div", { class: "fr-row" },
      button("Ouvrir le recueil public", { variant: "primary", icon: "globe", onClick: () => navigate("recueil") }),
      button("Copier le lien du recueil", { variant: "secondary", icon: "copy", onClick: async () => { (await copyText(lienRecueil())) ? toast("Lien du recueil copié") : toast("Copie impossible", "warning"); } }),
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
      h("h1", { class: "page-head__title", text: "Acte publié" }),
      h("p", { class: "page-head__sub", text: "Le texte publié au recueil, tel que le public le consulte — l'administration y ajoute les métadonnées, les formats et l'original signé." }),
    ),
    h("div", { class: "page-head__actions" },
      helpLink("publication", "Comment faire ?"),
      button("Recueil public", { variant: "secondary", icon: "globe", onClick: () => navigate("recueil/" + encodeURIComponent(cle)) }),
      button("Registre des publications", { variant: "secondary", icon: "list", onClick: () => navigate("publications") }),
    ),
  ));

  if (st.cle !== cle) {
    st.cle = cle; st.rec = null; st.chargement = true; st.erreur = null; st.verif = null;
    chargerConsultation(st, cle);
  }
  if (st.chargement) { root.appendChild(h("p", { class: "fr-muted", text: "Chargement de l'acte publié…" })); return; }
  if (!st.rec) {
    root.appendChild(emptyState(st.erreur || "Publication introuvable.",
      h("div", { class: "fr-row" },
        button("Réessayer", { variant: "primary", onClick: () => { st.cle = null; redrawView(); } }),
        button("Retour au registre", { variant: "secondary", onClick: () => navigate("publications") }))));
    return;
  }

  const p = st.rec;
  const onglet = (st.onglet = st.onglet || "texte");
  // Les actes publiés déjà lus par le registre : ils servent à résoudre, dans le
  // texte publié, les liens écrits sous forme d'identifiant ELI. À défaut, la
  // liste est demandée au service (voir views/acte-publie.js).
  setListePublications(state.pubRegistre?.liste);
  const { notice, texte } = corpsDeLActe(p);

  root.appendChild(notice);

  const tabs = h("div", { class: "fr-tabs" });
  for (const t of [{ id: "texte", label: "Texte" }, { id: "metadonnees", label: "Métadonnées" }, { id: "versions", label: "Versions" }, { id: "original", label: "Original signé" }]) {
    tabs.appendChild(h("button", {
      class: "fr-tab" + (onglet === t.id ? " fr-tab--active" : ""),
      text: t.label,
      onClick: () => { st.onglet = t.id; redrawView(); },
    }));
  }
  root.appendChild(tabs);

  if (onglet === "texte") {
    root.appendChild(h("div", { class: "recueil-lecture" }, texte));
    root.appendChild(blocPieces(p, { admin: true }));
    root.appendChild(blocSignature(p));
    if (p.ecarts) root.appendChild(h("p", { class: "fr-small fr-muted", text: `${p.ecarts} écart(s) de rédaction par rapport à la trame d'origine.` }));
    if (p.versions && p.versions.length > 1) root.appendChild(blocVersions(p, { href: (k) => "#/publication/" + encodeURIComponent(k) }));
    root.appendChild(blocDonneesPubliques(p));
  } else if (onglet === "metadonnees") {
    root.appendChild(h("div", { class: "fr-card" },
      h("h3", { class: "fr-card__title", text: "Métadonnées de la publication" }),
      h("p", { class: "fr-small fr-muted", text: "Ces métadonnées accompagnent la version en ligne (JSON-LD / vocabulaire ELI)." }),
      h("pre", { class: "fr-mono fr-codebox", text: p.formats.jsonld || "" }),
      h("div", { class: "fr-row" },
        button("Copier", { variant: "tertiary", size: "sm", icon: "copy", onClick: async () => { (await copyText(p.formats.jsonld)) ? toast("Copié") : toast("Copie impossible", "warning"); } }),
        button("Télécharger", { variant: "tertiary", size: "sm", icon: "download", onClick: () => download(fileName(p) + ".jsonld", p.formats.jsonld, "application/ld+json") }))));
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
    root.appendChild(card);
  } else if (p.originalExterne && p.originalExterne.url) {
    // CIRCUIT EXTERNE : l'original est la version signée (un PDF) déposée. On
    // la montre telle qu'elle est mise en ligne, avec la certification de
    // conformité du réviseur — il n'y a pas de signature cryptographique à
    // vérifier.
    const ext = p.originalExterne;
    const cert = ext.certification || {};
    root.appendChild(h("div", { class: "fr-card" },
      h("h3", { class: "fr-card__title", text: "Original signé — version signée (PDF)" }),
      h("p", { class: "fr-small fr-muted", text: "Cet acte a été signé hors de l'application (papier ou outil tiers). La pièce signée déposée est l'original : c'est elle qui est conservée et qui fait foi, et c'est elle que le recueil public montre telle qu'elle a été mise en ligne." }),
      cert.statut === "conforme"
        ? h("p", { class: "recueil-verif is-ok", text: "✓ Conformité certifiée" + (cert.parNom ? " par " + cert.parNom : "") + (cert.le ? " le " + formatDate(String(cert.le).slice(0, 10)) : "") + " — la pièce signée est conforme à la version numérique publiée." })
        : h("p", { class: "recueil-verif " + (cert.statut === "non_conforme" ? "is-ko" : ""), text: cert.statut === "non_conforme" ? "✗ Conformité refusée par le réviseur" + (cert.motif ? " : " + cert.motif : "") : "Conformité non certifiée." }),
      h("div", { class: "fr-row" },
        h("a", { class: "fr-btn fr-btn--secondary", href: ext.url, target: "_blank", rel: "noopener" }, "Ouvrir le PDF dans un onglet"),
        button("Télécharger la version signée", { variant: "secondary", icon: "download", onClick: () => { const a = h("a", { href: ext.url, download: ext.nom || "acte-signe.pdf" }); document.body.appendChild(a); a.click(); a.remove(); } })),
      h("dl", { class: "recueil-dl" },
        h("dt", { text: "Fichier" }), h("dd", { text: ext.nom || "—" }),
        h("dt", { text: "Empreinte SHA-256" }), h("dd", { class: "fr-mono", text: ext.sha256 || "—" }),
        ext.deposeLe ? h("dt", { text: "Déposé le" }) : null, ext.deposeLe ? h("dd", { text: new Date(ext.deposeLe).toLocaleString("fr-FR") }) : null)));
    root.appendChild(docFrame(null, "", ext.url));
  } else {
    root.appendChild(h("div", { class: "fr-card" },
      h("h3", { class: "fr-card__title", text: "Original signé" }),
      h("p", { class: "fr-small fr-muted", text: "L'original signé est la pièce de référence : c'est lui qui est conservé et qui fait foi. La vérification porte sur l'empreinte du document et sur la signature du certificat." }),
      verificationBox(p, st)));
    root.appendChild(docFrame(p.original?.pageHtml, "Original signé indisponible."));
  }

  // Le retrait n'est proposé qu'à qui en a le droit — et il est présenté pour ce
  // qu'il est : un geste exceptionnel, jamais une formalité courante.
  if (can("publications.depublier")) root.appendChild(zoneSensible(p, st));
}

// ------------------------------------------------------------------- retrait
// RETIRER UN ACTE PUBLIÉ DU RECUEIL. Un acte administratif publié ne se retire
// pas : le retrait est exceptionnel et ne se justifie que par un motif
// technique (dépôt en double, erreur de dépôt, acte publié avant d'être signé…).
// Un acte dont le retrait se justifierait autrement — illégalité, annulation —
// se modifie ou s'abroge : il reste au recueil, avec son historique. C'est
// pourquoi l'avertissement est écrit en grand, que le motif est exigé, et que le
// service le conserve sur l'acte (voir hRetirerPublication).
function zoneSensible(p, st) {
  return h("div", { class: "fr-card pub-danger" },
    h("h2", { class: "fr-card__title", text: "Zone sensible — retirer cet acte du recueil" }),
    avertissementRetrait(),
    h("div", { class: "fr-row" },
      button("Retirer du recueil…", { variant: "danger", icon: "trash", onClick: () => ouvrirRetrait(p, st) })),
    h("p", { class: "fr-small fr-muted", text: "Ce droit est réservé aux administrateurs (permission « Retirer une publication du recueil »). Le retrait est inscrit au journal d'audit, avec son motif." }),
  );
}

// L'avertissement du retrait, en grand : c'est lui qui doit arrêter la main.
function avertissementRetrait() {
  return h("div", { class: "pub-danger__hero" },
    h("p", { class: "pub-danger__alert" },
      icon("warn", 20),
      h("span", { text: "Un acte administratif publié ne se retire jamais." })),
    h("p", { class: "pub-danger__text", text: "Le retrait d'une publication est une mesure exceptionnelle. Seul un motif technique le justifie : dépôt en double, erreur de dépôt, acte publié par erreur avant sa signature, identifiant attribué à tort." }),
    h("p", { class: "pub-danger__text", text: "Un acte dont le retrait se justifierait autrement — illégalité, annulation, contestation — se modifie ou s'abroge : il reste au recueil, avec son historique. Personne ne doit pouvoir douter de ce qui a été publié, ni quand." }),
    h("p", { class: "pub-danger__text", text: "Retirer cet acte le fait disparaître du recueil public sur-le-champ. L'acte redevient « signé » (donc publiable de nouveau), et le motif saisi reste attaché à l'acte et au journal d'audit." }),
  );
}

function ouvrirRetrait(p, st) {
  const ta = h("textarea", { class: "fr-textarea", rows: 3, placeholder: "ex. dépôt en double : le même acte a été publié deux fois" });
  const cb = h("input", { type: "checkbox" });
  const confirmer = button("Retirer du recueil", { variant: "danger", icon: "trash", disabled: true });
  const maj = () => { confirmer.disabled = !(ta.value.trim().length >= 8 && cb.checked); };
  ta.addEventListener("input", maj);
  cb.addEventListener("change", maj);
  confirmer.addEventListener("click", async () => {
    confirmer.disabled = true;
    const fait = await retirer(p, ta.value.trim(), st);
    if (fait) m.close(); else confirmer.disabled = false;
  });
  const m = modal({
    wide: true,
    title: `Retirer du recueil — ${p.numero || p.cle}`,
    body: h("div", { class: "fr-stack" },
      avertissementRetrait(),
      h("div", { class: "fr-field" },
        h("label", { class: "fr-label", text: "Motif technique du retrait (obligatoire)" }),
        h("p", { class: "fr-hint", text: "Décrivez la raison technique. Ce motif sera conservé sur l'acte et inscrit au journal d'audit." }),
        ta),
      h("label", { class: "fr-check" }, cb, "Je comprends qu'un acte administratif publié ne doit jamais être retiré, et que seul un motif technique justifie ce retrait."),
    ),
    actions: (close) => [
      button("Renoncer", { variant: "secondary", onClick: close }),
      confirmer,
    ],
  });
}

async function retirer(p, motif, st) {
  const u = currentUser();
  const auteur = [u?.firstName, u?.lastName].filter(Boolean).join(" ") || u?.login || "";
  const flow = beginFlow(`Retrait de publication — ${p.numero || p.cle}`);
  let res;
  try {
    res = await post(`/v1/publications/${encodeURIComponent(p.cle)}/retrait`, { motif, auteur }, {
      token: publicationSettings(state.config).jetonDemonstration,
      flow, label: "Retrait de la publication du recueil",
    });
  } catch (e) { toast(String((e && e.message) || e), "error"); return false; }
  if (!res.ok) { toast(errorMessage(res), "error"); return false; }

  const acte = state.actes.find((a) => a.publication?.cle === p.cle || (p.eliUri && a.eli === p.eliUri));
  if (acte) {
    acte.retraits = (acte.retraits || []).concat([{ cle: p.cle, motif, auteur, le: new Date().toISOString() }]);
    acte.publication = null;
    if (acte.statut === "publie") acte.statut = "signee";
    acte.updatedAt = new Date().toISOString();
    touch("actes", { rerender: false });
  }
  // Le registre et le recueil ont changé : on invalide leurs caches.
  state.pubRegistre = { chargement: false };
  state.pubConsult = {};
  if (state.recueil) { state.recueil.liste = null; state.recueil.actes = {}; }
  await journaliser({
    action: "publication.depublie", cible: "acte", cibleLabel: p.numero || p.cle, acteId: acte?.id,
    detail: `retiré du recueil — motif technique : ${motif}`, to: ["role:administrateur"],
  });
  toast("Acte retiré du recueil. Le retrait est inscrit au journal.", "success");
  navigate("publications");
  return true;
}

// L'original signé du circuit électronique est une page HTML autonome ; la
// version signée du circuit externe est un PDF servi ailleurs (`url`). Dans les
// deux cas, la pièce se montre dans un cadre.
function docFrame(html, vide, url) {
  const wrap = h("div", { class: "pub-frame" });
  const frame = url
    ? h("iframe", { class: "pub-frame__el", src: url, title: "Version signée (PDF)" })
    : h("iframe", { class: "pub-frame__el", sandbox: "allow-same-origin", title: "Document publié", srcdoc: html || `<p>${vide || "Version en ligne indisponible."}</p>` });
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
