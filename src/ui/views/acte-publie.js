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
import { get } from "../../lib/remote.js";
import { formatDate, download, copyText } from "../../lib/util.js";
import { printHtml } from "../../lib/export.js";
import { assainirHtml } from "../../lib/sanitize.js";
import { verifySignedPackage } from "../../lib/signature.js";
import { qualificationSignature } from "../../lib/qualification-signature.js";
import { extraireVersion, CSS_DOCUMENT_WEB, lienRecueil, mentionDeTransmission,
  adresseActe, adresseFichier, urlFormat, hrefActe, hrefFormat, hrefFichier, autoHeberge,
  adresseEli, hrefEli, estEliUri, resoudreLiensEli,
  themeLabel,
  FORMATS_OUVERTS, FICHIERS_OUVERTS, texteDePublication, markdownDePublication } from "../../lib/recueil.js";

// -------------------------------------------------------- les identifiants ELI
// Un document publié cite un autre acte par son identifiant ELI (voir
// src/lib/recueil.js, « liens par l'identifiant ELI »). Pour le traduire en
// adresse, il faut la liste des actes publiés : le recueil et le registre la
// détiennent, et la posent ici (`setListePublications`) ; à défaut — une page
// ouverte directement sur un acte — la liste est demandée au service, une fois,
// comme le ferait n'importe quel lecteur du recueil.
let listeEli = null;
let demandeListe = null;

export function setListePublications(liste) {
  if (Array.isArray(liste)) listeEli = liste;
}

function listePourEli() {
  if (Array.isArray(listeEli)) return Promise.resolve(listeEli);
  if (!demandeListe) {
    demandeListe = get("/v1/publications", { label: "Recueil public", source: "lecture" })
      .then((r) => {
        listeEli = (r.ok && r.body && r.body.publications) || [];
        return listeEli;
      })
      .catch(() => { demandeListe = null; return null; });
  }
  return demandeListe;
}

// Résout les liens ELI d'un bloc de document publié. Sans liste, la résolution
// est différée : elle repasse quand la liste arrive — l'acte cité existe
// peut-être, et rien ne sert de le déclarer absent avant de le savoir.
function lierEli(box) {
  if (!resoudreLiensEli(box, { liste: listeEli }).differe) return;
  listePourEli().then((liste) => { if (liste) resoudreLiensEli(box, { liste }); });
}

export const kindLong = (kind) => (kind === "consolidee" ? "Version consolidée"
  : kind === "modificative" ? "Version modificative"
  : kind === "informative" ? "Texte informatif"
  : "Version initiale");

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
//
// Un RÈGLEMENT (publication informative — voir `kindLong`) se présente à part :
// sa place au recueil n'est pas celle d'un acte opposable, et sa notice le dit.
// Elle ne mentionne donc NI LA PUBLICATION AU RECUEIL (« Publié le », « Recueil »,
// « Entrée en vigueur »), qui ne le concerne pas — il n'est pas publié pour être
// opposable —, ni son AUTORITÉ (le document, lui, ne porte plus la formule
// d'autorité : voir src/lib/compile.js). Elle donne ce qui l'identifie et le
// rattache à sa décision d'adoption : sa nature, son identifiant, sa date, et
// l'acte qui l'adopte.
export function notice(rec, v) {
  const informative = rec.informative === true;
  // Un DOCUMENT NON JURIDIQUE (verbatim, déclaration, vœu) est publié au
  // recueil, mais ne fait pas droit : sa notice le dit, et n'affiche pas
  // d'entrée en vigueur — il n'en a pas.
  const nonJuridique = rec.juridique === false;
  // LA QUALIFICATION DE LA SIGNATURE : ce que vaut la signature de cet acte. Un
  // acte signé « en simple » — dans l'application, avec un compte — ou signé par
  // un prestataire SIMULÉ ne doit pas se présenter comme qualifié : la notice le
  // dit, d'une pastille et d'une phrase (voir src/lib/qualification-signature.js
  // et NC-IV-001). Une publication informative n'est pas signée : rien à dire.
  const sig = rec.signature || {};
  const qual = qualificationSignature({
    niveau: sig.niveau,
    simule: rec.signatureSimulee === true || !!(sig.prestataire && sig.prestataire.demonstration),
    prestataire: sig.prestataire,
  });
  const titre = (v && v.docTitre) || rec.objet || rec.titre || rec.numero || "Acte";
  const theme = themeLabelDePublication(rec);
  const marques = h("div", { class: "recueil-notice__marques" },
    theme ? h("span", { class: "recueil-badge recueil-badge--theme", "data-theme-id": themeDePublication(rec), text: theme }) : null,
    rec.nature ? h("span", { class: "recueil-badge recueil-badge--nature", text: natureLabel(rec.nature) }) : null,
    h("span", { class: "recueil-badge recueil-badge--version", text: kindLong(rec.kind) }),
    nonJuridique ? h("span", { class: "recueil-badge recueil-badge--note", text: "document, non opposable" }) : null,
    !informative && qual.avertissement ? h("span", { class: "recueil-badge recueil-badge--note", text: qual.label }) : null,
    h("span", { class: "recueil-badge recueil-badge--" + (rec.latest ? "ok" : "note"), text: rec.latest ? (informative ? "texte en vigueur" : nonJuridique ? "dernière version" : "version en vigueur") : "version antérieure" }));

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
  if (informative) {
    // Le règlement n'a pas de « publication » à lui : il n'a qu'une ADOPTION.
    const a = rec.adoption || {};
    champ("Texte adopté par", [a.designation, a.numero ? "n° " + a.numero : "", a.date ? "du " + formatDate(a.date) : ""].filter(Boolean).join(" "));
    champ("Date du texte", formatDate(rec.dateDocument));
  } else {
    champ("Date de l'acte", formatDate(rec.dateDocument));
    champ("Publié le", formatDate(rec.datePublication));
    if (nonJuridique) champ("Portée", "Document non opposable");
    else champ("Entrée en vigueur", formatDate(rec.dateOpposabilite));
    champ("Recueil", rec.recueil);
  }

  return h("header", { class: "recueil-notice" },
    marques,
    h("h1", { class: "recueil-notice__titre", text: titre }),
    [rec.entityName, informative ? "" : rec.auteur].filter(Boolean).join(" · ")
      ? h("p", { class: "recueil-notice__sous", text: [rec.entityName, informative ? "" : rec.auteur].filter(Boolean).join(" · ") }) : null,
    informative
      ? h("p", { class: "recueil-notice__info", text: "Texte publié à titre informatif. Il n'est pas signé et ne se publie pas pour lui-même : seule la décision qui l'adopte fait foi, et son texte suit l'original signé de cette décision." })
      : nonJuridique
        ? h("p", { class: "recueil-notice__info", text: "Document publié au recueil pour être porté à la connaissance de tous. Il n'a pas de portée juridique propre : il ne crée ni droits ni obligations, aucune entrée en vigueur ne s'y attache, et aucun délai de recours ne court à compter de sa publication." })
        : null,
    // La phrase qui qualifie la signature : elle n'apparaît que lorsqu'il y a
    // quelque chose à dire (signature non qualifiée, prestataire simulé).
    !informative && qual.avertissement ? h("p", { class: "recueil-notice__info", text: qual.mention }) : null,
    meta);
}

// ------------------------------------------------------------------ le texte

// Le texte publié, posé DANS la page. Sa charte n'est PAS appliquée : la
// version en ligne suit la feuille de style WEB du recueil (`CSS_DOCUMENT_WEB`,
// marquée par `doc-web`) — deux entités aux chartes différentes présentent donc
// leurs actes à l'identique ici. L'en-tête, le logo et le pied de la charte ont
// été écartés à l'extraction (voir `extraireVersion`, lib/recueil.js).
export function lecture(rec, v) {
  const box = h("div", { class: "recueil-acte doc-web" });
  box.appendChild(h("style", { text: CSS_DOCUMENT_WEB }));
  const doc = h("div", { class: "recueil-doc" });
  // Le texte publié vient du recueil, donc d'une donnée que cette page n'a pas
  // produite : il est ASSAINI avant d'être posé (voir src/lib/sanitize.js). Un
  // HTML sans script, sans gestionnaire d'événement et sans adresse
  // `javascript:` — sinon un client pourrait faire exécuter son code au
  // visiteur du recueil public.
  doc.innerHTML = assainirHtml(v.html) || "<p>Le texte de cet acte n'est pas disponible.</p>";
  box.appendChild(doc);
  // Le certificat de transmission accompagne la version publiée ; s'il manque
  // au document (publication antérieure), on le repose ici.
  if (v.transmis) {
    const t = h("div", { class: "recueil-transmis" });
    t.innerHTML = assainirHtml(v.transmis);
    box.appendChild(t);
  } else if (mentionDeTransmission(rec.transmission)) {
    box.appendChild(h("div", { class: "transmis" },
      h("strong", { text: "Contrôle de légalité" }),
      h("span", { text: mentionDeTransmission(rec.transmission) })));
  }
  // L'acte publié cite ses fondements par leur identifiant ELI : c'est ici
  // qu'ils deviennent des liens, et qu'ils mènent à l'acte visé DANS l'instance.
  lierEli(box);
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
  if (rec.originalExterne && rec.originalExterne.url) {
    const ext = rec.originalExterne;
    box.appendChild(h("a", { class: "fr-btn fr-btn--secondary", href: ext.url, target: "_blank", rel: "noopener" }, "Version signée (PDF)"));
    ajouter("Télécharger la version signée", "download", () => { const a = h("a", { href: ext.url, download: ext.nom || "acte-signe.pdf" }); document.body.appendChild(a); a.click(); a.remove(); });
  }
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
    // L'identifiant ELI a DEUX formes, et on ne les confond pas (voir P-18) :
    // l'identifiant (« eli:/fr/… »), clé stable qui ne se résout pas telle
    // quelle ; et l'ADRESSE HTTP qui en dérive, celle qui se cite et s'ouvre.
    estEliUri(rec.eliUri) ? ligneAdresse("Adresse ELI (HTTP) — l'acte par son identifiant, version en vigueur", adresseEli(rec.eliUri), hrefEli(rec.eliUri), cle, "", rec.eliUri) : null,
    estEliUri(rec.eliUri) ? h("div", { class: "recueil-adresse" },
      h("code", { class: "recueil-adresse__url", text: rec.eliUri }),
      h("span", { class: "recueil-adresse__label", text: "Identifiant ELI (forme « eli:/fr/… », non résoluble tel quel)" }),
    ) : null,
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
// le recueil est une application, ses liens ne doivent pas la recharger. Une
// adresse ELI n'a pas de gestionnaire propre : c'est l'intercepteur du recueil
// qui la reconnaît (« ?eli=… ») et ouvre l'acte — comme le ferait le service
// sur un déploiement auto-hébergé (« /eli/… »).
function ligneAdresse(label, url, href, cle, ext, eli) {
  const a = h("a", { class: "recueil-adresse__url", href, text: url });
  if (eli) a.dataset.eli = eli;
  else a.addEventListener("click", (e) => {
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

// L'ORIGINAL. Deux cas, et le recueil montre dans les deux ce qui fait foi :
//
//   • circuit ÉLECTRONIQUE — l'original est le paquet signé (document gelé +
//     signature + horodatage) ; il ne se déploie pas d'office, on l'ouvre d'un
//     bouton, dans une fenêtre, pour le lire ou l'imprimer ;
//   • circuit EXTERNE (papier ou outil tiers) — l'original est la VERSION
//     SIGNÉE déposée, un PDF. C'est lui qui est « mis en ligne » : le recueil
//     l'affiche tel quel, avec l'attestation de conformité du réviseur.
export function blocOriginal(rec) {
  const ext = rec.originalExterne;
  if (ext && ext.url) return blocOriginalExterne(rec, ext);
  const html = rec.original && rec.original.pageHtml;
  if (!html) return null;
  return bloc("Original signé",
    h("p", { class: "recueil-side__note", text: "L'original signé est la pièce de référence : c'est lui qui fait foi, avec sa signature et son horodatage. La version en ligne lue ci-dessus n'en est qu'une lecture pratique. Ouvrez-le pour le lire, l'imprimer ou l'enregistrer en PDF." }),
    h("div", { class: "recueil-pieces" },
      button("Voir l'original signé", { variant: "secondary", icon: "eye", onClick: () => ouvrirOriginalSigne(html, rec.numero) })));
}

// La version signée d'un acte du circuit externe, montrée telle qu'elle a été
// mise en ligne : le PDF, dans la page. C'est la pièce que le lecteur doit
// pouvoir ouvrir et comparer au texte.
function blocOriginalExterne(rec, ext) {
  const cert = ext.certification || {};
  const conforme = cert.statut === "conforme";
  return bloc("Original signé — version signée (PDF)",
    h("p", { class: "recueil-side__note", text: "Cet acte a été signé hors de l'application (signature manuscrite, ou outil tiers). Le document ci-dessous est la VERSION SIGNÉE telle qu'elle a été déposée et mise en ligne : c'est elle qui fait foi. La version en ligne lue ci-dessus n'en est qu'une lecture pratique." }),
    conforme
      ? h("p", { class: "recueil-verif is-ok", text: "✓ Conformité certifiée par le réviseur" + (cert.parNom ? " (" + cert.parNom + ")" : "") + (cert.le ? " le " + formatDate(String(cert.le).slice(0, 10)) : "") + " : la pièce signée est conforme à la version numérique publiée." })
      : null,
    h("div", { class: "recueil-pdf" },
      h("iframe", { class: "recueil-pdf__frame", src: ext.url, title: "Version signée (PDF)" }),
      h("p", { class: "recueil-side__note" },
        h("a", { class: "recueil-lien", href: ext.url, target: "_blank", rel: "noopener" }, "Ouvrir le PDF dans un onglet"),
        h("span", { text: " — si le document ne s'affiche pas ici, c'est qu'il est à télécharger." }))),
    h("dl", { class: "recueil-dl" },
      h("dt", { text: "Fichier" }), h("dd", { text: ext.nom || "version signée.pdf" }),
      ext.deposeLe ? h("dt", { text: "Déposé le" }) : null, ext.deposeLe ? h("dd", { text: new Date(ext.deposeLe).toLocaleString("fr-FR") }) : null,
      ext.sha256 ? h("dt", { text: "Empreinte SHA-256" }) : null, ext.sha256 ? h("dd", { class: "fr-mono", text: ext.sha256 }) : null,
      conforme && cert.empreinte ? h("dt", { text: "Empreinte du texte (version numérique)" }) : null,
      conforme && cert.empreinte ? h("dd", { class: "fr-mono", text: cert.empreinte }) : null),
    h("div", { class: "recueil-pieces" },
      button("Télécharger la version signée", { variant: "secondary", icon: "download", onClick: () => { const a = h("a", { href: ext.url, download: ext.nom || "acte-signe.pdf" }); document.body.appendChild(a); a.click(); a.remove(); } })));
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
  // Un RÈGLEMENT (publication informative) n'a pas de signature propre : c'est
  // l'acte qui l'adopte qui est signé, et sa signature qui lui donne son
  // autorité — le recueil le dit sur la page du règlement, pas ici.
  if (rec.informative === true) return null;
  // Circuit externe : la signature est manuscrite (ou apposée par un outil
  // tiers). Il n'y a pas de certificat à vérifier — ce qui se vérifie, c'est la
  // certification de conformité du réviseur, qui atteste que la pièce signée
  // correspond à la version numérique publiée.
  if (rec.originalExterne && rec.originalExterne.url) return blocSignatureExterne(rec);
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

// La signature d'un acte du circuit externe : manuscrite, ou apposée par un
// outil tiers. La page dit ce qui a été signé, par qui, et rappelle
// l'attestation du réviseur — puisque c'est elle, et non une signature
// cryptographique, qui engage la conformité de la pièce publiée.
function blocSignatureExterne(rec) {
  const ext = rec.originalExterne || {};
  const cert = ext.certification || {};
  const s = rec.signature || {};
  const dl = h("dl", { class: "recueil-dl" });
  const ligne = (k, v) => { if (v === undefined || v === null || v === "") return; dl.appendChild(h("dt", { text: k })); dl.appendChild(h("dd", { text: String(v) })); };
  ligne("Signataire", (s.signataires || []).map((x) => [x.nom, x.fonction].filter(Boolean).join(" — ")).filter(Boolean).join(", ") || "—");
  ligne("Signé hors application", s.signeLe ? new Date(s.signeLe).toLocaleString("fr-FR") : "—");
  ligne("Mode de signature", "Signature manuscrite ou outil tiers (circuit externe, sans API)");
  ligne("Empreinte de la pièce signée", ext.sha256 || "—");
  ligne("Fichier déposé", ext.nom || "—");
  ligne("Déposé le", ext.deposeLe ? new Date(ext.deposeLe).toLocaleString("fr-FR") : "—");

  const certBox = (cert && cert.statut)
    ? h("div", { class: "recueil-certif" },
      h("h3", { class: "recueil-certif__titre", text: "Certification de conformité" }),
      h("p", { class: "recueil-certif__statut recueil-verif " + (cert.statut === "conforme" ? "is-ok" : "is-ko"), text: cert.statut === "conforme"
        ? "✓ La pièce signée a été certifiée conforme à la version numérique publiée."
        : "✗ La conformité de la pièce signée a été refusée." }),
      h("p", { class: "fr-small fr-muted", text: [cert.parNom ? "Par " + cert.parNom : "", cert.le ? "le " + new Date(cert.le).toLocaleString("fr-FR") : ""].filter(Boolean).join(" · ") }),
      cert.empreinte ? h("p", { class: "recueil-side__note" }, h("span", { text: "Empreinte du texte certifié : " }), h("code", { text: cert.empreinte })) : null,
      (cert.points || []).length ? h("ul", { class: "recueil-certif__points" }, ...cert.points.map((p) => h("li", { text: POINTS_CERTIFICATION[p] || p }))) : null,
      cert.remarque ? h("p", { class: "recueil-side__note", text: "Observation : " + cert.remarque }) : null)
    : null;

  return bloc("Signature (circuit externe)", dl,
    h("p", { class: "recueil-side__note", text: "L'acte a été signé hors de l'application. La signature est donc vérifiée par comparaison : c'est la pièce signée, montrée ci-dessus comme l'original, qui fait foi." }),
    certBox);
}

// Les points de contrôle de la certification, tels que le réviseur les a
// cochés : la traduction affichée sur le recueil public.
const POINTS_CERTIFICATION = {
  signataire: "La pièce signée porte la signature du signataire désigné, avec sa qualité apparente.",
  texte: "Le texte signé est identique, au fond et à la forme, à la version numérique publiée.",
  complet: "Le document est complet : toutes les pages sont présentes, sans rature ni surcharge.",
  date: "La date de signature portée sur la pièce est cohérente avec l'acte.",
};

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
