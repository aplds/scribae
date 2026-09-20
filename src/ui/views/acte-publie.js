// ============================================================================
// Un acte publié, présenté comme dans un recueil officiel en ligne.
//
// Le même rendu sert au RECUEIL PUBLIC (un visiteur, sans compte) et à la
// CONSULTATION de l'administration (« Publications (ELI) ») : la notice de
// l'acte — titre, marques, métadonnées —, son texte INTÉGRÉ à la page (plus de
// feuille A4 dans un cadre, un texte qui occupe la largeur disponible, dans la
// police de l'interface), puis ses pièces, sa signature et ses versions.
//
// Ce que le lecteur voit vient de la PUBLICATION : le document gelé au moment
// du dépôt, et rien des données locales. La présentation, elle, est celle du
// recueil : la charte de l'acte habille le papier, pas la version en ligne (voir
// src/lib/recueil.js pour l'extraction du document).
// ============================================================================
import { h, clear, button, toast, modal } from "../dom.js";
import { state, navigate } from "../state.js";
import { formatDate, download, copyText } from "../../lib/util.js";
import { printHtml } from "../../lib/export.js";
import { verifySignedPackage } from "../../lib/signature.js";
import { extraireVersion, CSS_DOCUMENT_WEB, lienRecueil, mentionDeTransmission,
  adresseActe, adresseFichier, urlFormat, hrefActe, hrefFormat, autoHeberge,
  themeLabel,
  FORMATS_OUVERTS, FICHIERS_OUVERTS, texteDePublication, markdownDePublication } from "../../lib/recueil.js";

export const kindLong = (kind) => (kind === "consolidee" ? "Version consolidée"
  : kind === "modificative" ? "Version modificative" : "Version initiale");

export const nomFichier = (rec) => String(rec.numero || rec.cle || "acte").replace(/[^\w-]+/g, "_");

// Le libellé d'une nature d'acte, lu au référentiel.
export function natureLabel(id) {
  if (!id) return "";
  const t = (state.config?.actTypes || []).find((x) => x.id === id);
  return t ? t.label : String(id).charAt(0).toUpperCase() + String(id).slice(1);
}

// ------------------------------------------------------------------ thème
// Le THÈME d'un acte publié : la famille de la trame dont il est issu
// (urbanisme, police, finances…). La publication le porte quand il lui a été
// transmis au dépôt ; à défaut — acte publié avant que le recueil public ne
// classe par thème — on le retrouve par l'ACTE LOCAL, dont la trame dit la
// famille. Ce repli ne vaut que sur un poste qui détient le registre : ailleurs,
// le thème vient de la publication, ou n'est pas affiché.

let cacheThemes = null;
let cacheCle = "";

function indexThemesLocaux() {
  const cle = (state.actes || []).length + ":" + (state.trames || []).length;
  if (cacheThemes && cacheCle === cle) return cacheThemes;
  const familles = new Map((state.trames || []).map((t) => [t.id, t.familyId || ""]));
  const parNumero = new Map();
  const parEli = new Map();
  for (const a of state.actes || []) {
    const fam = familles.get(a.trameId);
    if (!fam) continue;
    if (a.numero) parNumero.set(String(a.numero), fam);
    if (a.eli) parEli.set(String(a.eli), fam);
  }
  cacheThemes = { parNumero, parEli };
  cacheCle = cle;
  return cacheThemes;
}

// L'identifiant du thème d'un acte publié (vide s'il n'y en a pas).
export function themeDePublication(rec) {
  if (!rec) return "";
  if (rec.themeId) return rec.themeId;
  if (rec.theme) return rec.theme;
  const idx = indexThemesLocaux();
  return (rec.numero && idx.parNumero.get(String(rec.numero)))
    || (rec.eliUri && idx.parEli.get(String(rec.eliUri))) || "";
}

// Le libellé du thème, lu au référentiel (un renommage suit donc) ; le libellé
// porté par la publication ne sert que de repli, quand le référentiel ne connaît
// plus cette famille.
export function themeLabelDePublication(rec) {
  return themeLabel(themeDePublication(rec), state.config?.families) || (rec && rec.themeLabel) || "";
}

// ------------------------------------------------------------------ la notice

// Ce qu'un recueil officiel met en tête : le titre de l'acte, ses marques
// (nature, version), et son bloc de métadonnées — ELI, dates, recueil.
export function notice(rec, v) {
  const titre = (v && v.docTitre) || rec.objet || rec.titre || rec.numero || "Acte";
  const theme = themeLabelDePublication(rec);
  const marques = h("div", { class: "recueil-notice__marques" },
    theme ? h("span", { class: "recueil-badge recueil-badge--theme", "data-theme-id": themeDePublication(rec), text: theme }) : null,
    rec.nature ? h("span", { class: "recueil-badge recueil-badge--nature", text: natureLabel(rec.nature) }) : null,
    h("span", { class: "recueil-badge recueil-badge--version", text: kindLong(rec.kind) }),
    h("span", { class: "recueil-badge recueil-badge--" + (rec.latest ? "ok" : "note"), text: rec.latest ? "version en vigueur" : "version antérieure" }));

  const meta = h("dl", { class: "recueil-meta" });
  const champ = (label, valeur, cls) => {
    if (valeur === undefined || valeur === null || valeur === "") return;
    meta.appendChild(h("div", { class: "recueil-meta__item" },
      h("dt", { text: label }), h("dd", { class: cls || "" }, valeur)));
  };
  champ("Thème", theme);
  champ("Numéro", rec.numero);
  champ("Identifiant ELI", rec.eliUri ? h("code", { text: rec.eliUri }) : "", "recueil-meta__eli");
  champ("Nature", natureLabel(rec.nature));
  champ("Date de l'acte", formatDate(rec.dateDocument));
  champ("Publié le", formatDate(rec.datePublication));
  champ("Entrée en vigueur", formatDate(rec.dateOpposabilite));
  champ("Recueil", rec.recueil);

  return h("header", { class: "recueil-notice" },
    marques,
    h("h1", { class: "recueil-notice__titre", text: titre }),
    [rec.entityName, rec.auteur].filter(Boolean).join(" · ")
      ? h("p", { class: "recueil-notice__sous", text: [rec.entityName, rec.auteur].filter(Boolean).join(" · ") }) : null,
    meta);
}

// ------------------------------------------------------------------ le texte

// Le texte publié, posé DANS la page. Sa charte n'est PAS appliquée : la
// version en ligne suit l'apparence du recueil, et `CSS_DOCUMENT_WEB` donne au
// document les styles de lecture du web.
export function lecture(rec, v) {
  const box = h("div", { class: "recueil-acte" });
  box.appendChild(h("style", { text: CSS_DOCUMENT_WEB }));
  const doc = h("div", { class: "recueil-doc" });
  doc.innerHTML = v.html || "<p>Le texte de cet acte n'est pas disponible.</p>";
  box.appendChild(doc);
  // Le certificat de transmission accompagne la version publiée ; s'il manque
  // au document (publication antérieure), on le repose ici.
  if (v.transmis) {
    const t = h("div", { class: "recueil-transmis" });
    t.innerHTML = v.transmis;
    box.appendChild(t);
  } else if (mentionDeTransmission(rec.transmission)) {
    box.appendChild(h("div", { class: "transmis" },
      h("strong", { text: "Contrôle de légalité" }),
      h("span", { text: mentionDeTransmission(rec.transmission) })));
  }
  return box;
}

// Le texte et sa notice, en un bloc : c'est la page d'un acte.
export function corpsDeLActe(rec) {
  const v = extraireVersion(rec.formats && rec.formats.html);
  return { v, notice: notice(rec, v), texte: lecture(rec, v) };
}

// ------------------------------------------------------------------ les blocs

function bloc(titre, ...enfants) {
  return h("section", { class: "recueil-bloc" },
    h("h2", { class: "recueil-bloc__title", text: titre }),
    ...enfants);
}

export function blocPieces(rec, { admin = false } = {}) {
  const box = h("div", { class: "recueil-pieces" });
  const ajouter = (label, icone, onClick) => box.appendChild(button(label, { variant: "secondary", icon: icone, onClick }));
  if (admin) ajouter("Voir dans le recueil public", "globe", () => navigate("recueil/" + encodeURIComponent(rec.cle)));
  ajouter("Copier le lien de cet acte", "copy", async () => {
    (await copyText(lienRecueil(rec.cle))) ? toast("Lien de l'acte copié") : toast("Copie impossible", "warning");
  });
  ajouter("Imprimer / PDF", "download", () => printHtml(rec.formats && rec.formats.html));
  ajouter("Akoma Ntoso (.akn.xml)", "download", () => download(nomFichier(rec) + ".akn.xml", rec.formats.akn, "application/xml"));
  ajouter("JSON-LD (ELI)", "download", () => download(nomFichier(rec) + ".jsonld", rec.formats.jsonld, "application/ld+json"));
  ajouter("Markdown (.md)", "download", () => download(nomFichier(rec) + ".md", markdownDePublication(rec), "text/markdown"));
  ajouter("Texte seul (.txt)", "download", () => download(nomFichier(rec) + ".txt", texteDePublication(rec), "text/plain"));
  if (rec.original) {
    ajouter("Original signé (JSON)", "lock", () => download(nomFichier(rec) + "-original-signe.json",
      JSON.stringify({ ...rec.original, document: { akn: rec.formats.akn, sha256: rec.original.sha256 } }, null, 2), "application/json"));
  }
  return bloc("Pièces et formats", box);
}

// LE RECUEIL OUVERT — ce qui fait d'un acte publié une donnée que les moteurs de
// recherche et les agents (LLMs) peuvent atteindre : son adresse de référence,
// ses représentations lisibles par machine, et — sur un déploiement serveur —
// les fichiers du site. C'est de l'exploitation, pas de la lecture : le bloc
// reste replié, et chaque adresse se copie. Voir src/lib/recueil.js et
// src/server/mysql/actes.mjs pour ce qui les sert.
export function blocDonneesPubliques(rec) {
  const cle = rec.cle;
  const box = h("details", { class: "recueil-donnees" },
    h("summary", { class: "recueil-donnees__resume", text: "Adresses et formats lisibles par machine" }),
    h("p", { class: "fr-small fr-muted", text: "Chaque acte publié a une adresse de référence et des représentations que les moteurs de recherche et les agents savent lire. Ces adresses sont stables : sous cet identifiant ELI, elles désignent toujours la version en vigueur." }),
    ligneAdresse("Adresse de référence", adresseActe(cle), hrefActe(cle), cle),
    ...FORMATS_OUVERTS.map((f) => ligneAdresse(f.label + " — " + f.hint, urlFormat(cle, f.ext), hrefFormat(cle, f.ext), cle, f.ext)));

  // Les fichiers du recueil entier n'existent que là où un serveur les sert : les
  // annoncer sur un déploiement statique promettrait des adresses mortes.
  if (autoHeberge()) {
    box.appendChild(h("h3", { class: "recueil-donnees__titre", text: "Le recueil entier" }));
    box.appendChild(h("p", { class: "fr-small fr-muted", text: "Ce déploiement sert aussi tout le recueil aux robots et aux agents, en fichiers." }));
    for (const f of FICHIERS_OUVERTS) {
      box.appendChild(h("div", { class: "recueil-adresse" },
        h("a", { class: "recueil-adresse__url", href: hrefFichier(f.nom), text: adresseFichier(f.nom) }),
        h("span", { class: "recueil-adresse__label", text: f.hint }),
        boutonCopier(adresseFichier(f.nom))));
    }
  }
  return bloc("Recueil ouvert", box);
}

// Une adresse du recueil ouvert : elle se copie, et elle se suit dans la page —
// le recueil est une application, ses liens ne doivent pas la recharger.
function ligneAdresse(label, url, href, cle, ext) {
  const a = h("a", { class: "recueil-adresse__url", href, text: url });
  a.addEventListener("click", (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate("recueil/" + encodeURIComponent(cle), ext ? { format: ext } : {});
  });
  return h("div", { class: "recueil-adresse" },
    a, h("span", { class: "recueil-adresse__label", text: label }), boutonCopier(url));
}

function boutonCopier(url) {
  return button("Copier", { variant: "tertiary", size: "sm", icon: "copy", onClick: async () => {
    (await copyText(url)) ? toast("Adresse copiée") : toast("Copie impossible", "warning");
  } });
}

// L'ORIGINAL SIGNÉ, à la demande — la pièce de référence : le texte tel qu'il a
// été signé, suivi du bloc de signature (identité, certificat, empreinte,
// horodatage). C'est elle qui fait foi ; la version en ligne lue dans la page
// n'en est qu'une lecture. Le recueil ne la déploie pas d'office : on l'ouvre
// d'un bouton, dans une fenêtre, et on l'y imprime ou l'enregistre en PDF.
export function blocOriginal(rec) {
  const html = rec.original && rec.original.pageHtml;
  if (!html) return null;
  return bloc("Original signé",
    h("p", { class: "recueil-side__note", text: "L'original signé est la pièce de référence : c'est lui qui fait foi, avec sa signature et son horodatage. La version en ligne lue ci-dessus n'en est qu'une lecture pratique. Ouvrez-le pour le lire, l'imprimer ou l'enregistrer en PDF." }),
    h("div", { class: "recueil-pieces" },
      button("Voir l'original signé", { variant: "secondary", icon: "eye", onClick: () => ouvrirOriginalSigne(html, rec.numero) })));
}

// L'original signé se consulte dans une fenêtre : le document garde sa page A4,
// et l'on peut l'imprimer ou l'enregistrer en PDF depuis là.
function ouvrirOriginalSigne(html, numero) {
  const w = h("div", { class: "sig-doc-view" });
  w.appendChild(h("iframe", { class: "sig-doc-frame", sandbox: "allow-same-origin", title: "Original signé", srcdoc: html }));
  modal({
    title: "Original signé" + (numero ? " — " + numero : ""),
    wide: true,
    body: w,
    actions: (close) => [
      button("Imprimer / PDF", { variant: "secondary", icon: "download", onClick: () => printHtml(html) }),
      button("Fermer", { variant: "secondary", onClick: close }),
    ],
  });
}

export function blocSignature(rec) {
  const s = rec.signature || {};
  const dl = h("dl", { class: "recueil-dl" });
  const ligne = (k, v) => { if (v === undefined || v === null || v === "") return; dl.appendChild(h("dt", { text: k })); dl.appendChild(h("dd", { text: String(v) })); };
  ligne("Signataire", (s.signataires || []).map((x) => x.nom).filter(Boolean).join(", ") || "—");
  ligne("Signé le", s.signeLe ? new Date(s.signeLe).toLocaleString("fr-FR") : "—");
  ligne("Algorithme", s.algorithme || "—");
  ligne("Prestataire", (s.prestataire && s.prestataire.nom) || "—");
  ligne("Empreinte", (rec.original && rec.original.sha256) ? String(rec.original.sha256).slice(0, 32) + "…" : "—");

  const resultat = h("div", {});
  const box = h("div", { class: "recueil-verif-box" },
    h("div", { class: "recueil-pieces" },
      button("Vérifier la signature", {
        variant: "secondary", icon: "lock",
        onClick: async () => {
          clear(resultat);
          resultat.appendChild(h("p", { class: "recueil-side__note", text: "Vérification en cours…" }));
          const pack = {
            document: { akn: rec.formats.akn, sha256: rec.original && rec.original.sha256 },
            signatures: (rec.original && rec.original.signatures) || [],
            horodatage: rec.original && rec.original.horodatage,
          };
          const r = await verifySignedPackage(pack);
          clear(resultat);
          resultat.appendChild(h("p", { class: "recueil-verif " + (r.ok ? "is-ok" : "is-ko"), text: (r.ok ? "✓ " : "✗ ") + (r.ok ? "Empreinte et signature vérifiées sur la version publiée." : "La signature n'a pas pu être vérifiée.") }));
          for (const c of r.checks || []) resultat.appendChild(h("p", { class: "recueil-side__note", text: (c.ok ? "✓ " : "✗ ") + c.label + " — " + c.detail }));
        },
      })));
  return bloc("Signature électronique", dl, box, resultat);
}

export function blocVersions(rec, { href }) {
  const box = h("div", { class: "recueil-versions" });
  const tri = [...(rec.versions || [rec])]
    .sort((x, y) => String(x.dateDocument || "").localeCompare(String(y.dateDocument || ""))
      || String(x.publieeLe || "").localeCompare(String(y.publieeLe || "")));
  tri.forEach((v, i) => {
    const derniere = i === tri.length - 1;
    const ligne = h("div", { class: "recueil-version" + (v.cle === rec.cle ? " is-on" : "") },
      h("div", { class: "recueil-version__texte" },
        h("strong", { text: kindLong(v.kind) }),
        h("span", { class: "recueil-side__note", text: " du " + formatDate(v.dateDocument) + (v.recueil ? " · " + v.recueil : "") })),
      h("div", { class: "recueil-version__fin" },
        h("span", { class: "recueil-badge recueil-badge--" + (derniere ? "ok" : "note"), text: derniere ? "version en vigueur" : "supplantée" }),
        v.cle === rec.cle
          ? h("span", { class: "recueil-badge recueil-badge--version", text: "consultée" })
          : h("a", { class: "recueil-lien", href: href(v.cle) }, "Consulter")));
    box.appendChild(ligne);
  });
  return bloc("Versions publiées sous le même identifiant", box);
}
