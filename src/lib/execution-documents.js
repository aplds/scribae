// ============================================================================
// Les pièces de l'exécution : l'état des formalités, et l'attestation de
// non-recours.
//
// Ce ne sont pas des actes : elles ne portent aucun texte normatif, elles
// CONSTATENT. L'état des formalités relève ce qui a été fait, quand, sous quelle
// référence et par qui — c'est la pièce qu'on classe au dossier ou qu'on joint à
// un dossier de subvention. L'attestation de non-recours certifie, pour un acte
// définitif, qu'aucun recours n'a été introduit contre lui : elle se délivre à
// un tiers qui demande à en avoir la preuve.
//
// Comme les actes, ces pièces s'impriment sur du papier A4 (src/lib/paper.js) et
// se délivrent en PDF par l'impression du navigateur (voir `printHtml` dans
// src/lib/export.js). Elles ne portent pas la charte graphique de l'acte : elles
// ne sont pas l'acte, mais un écrit administratif de l'entité — d'où leur
// en-tête propre, réduit à l'identité de la collectivité.
//
// Ce module est pur : il rend des chaînes HTML, et ne connaît ni le DOM, ni
// l'état de l'application.
// ============================================================================

import { esc, formatDate } from "./util.js";
import { A4_WIDTH, A4_HEIGHT, A4_MARGIN, A4_MARGIN_PRINT } from "./paper.js";
import {
  formalites, statutExecution, dateExecutoire, dateLimiteRecours, delais, aujourdhui,
  recoursDe, recoursTypeLabel,
  TRANSMISSION_MODES, PUBLICATION_MODES, NOTIFICATION_MODES,
} from "./execution.js";
import { personRoleLines, personSignatureName } from "./render.js";

// ------------------------------------------------------------------ outillage

const dateLongue = (x) => (x ? formatDate(String(x).slice(0, 10), "date-long") : "—");
const heure = (d) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const EN_MOTS = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze"];
const enMots = (n) => EN_MOTS[Number(n)] || String(n);

const MODES = { transmission: TRANSMISSION_MODES, publication: PUBLICATION_MODES, notification: NOTIFICATION_MODES };
// Le mode est enregistré par son identifiant. On tolère le libellé — les
// dossiers constitués avant cette règle en portent un — plutôt que de le perdre
// silencieusement à l'impression.
const modeLabel = (id, mode) => {
  const liste = MODES[id] || [];
  const trouve = liste.find((m) => m.id === mode);
  return trouve ? trouve.label : (liste.some((m) => m.label === mode) ? mode : "");
};

// Les identifiants sont longs et sans espaces : on leur donne des points de
// coupure (`<wbr>` après chaque séparateur) pour qu'ils se replient dans la
// colonne au lieu de déborder de la page.
const identifiantHtml = (v) => esc(v).replace(/([/@:])/g, "$1<wbr>");

// L'identité de l'acte telle qu'elle s'écrit en tête d'une pièce : sa nature,
// son numéro, son objet, sa date. Le document compilé porte tout cela ; un acte
// importé peut n'avoir qu'un numéro et un objet — on retombe alors sur l'acte.
function identiteActe(acte, doc, config) {
  const m = doc?.meta || {};
  const ent = m.entity || {};
  return {
    nature: (config?.actTypes || []).find((t) => t.id === m.actTypeId)?.label || "",
    numero: acte?.numero || m.numero || "",
    objet: acte?.objet || m.objet || "",
    dateSignature: String(acte?.dateSignature || m.dateSignature || "").slice(0, 10),
    entite: ent.nameWithArt || ent.name || config?.brand?.name || "",
    entiteNom: ent.legalName || ent.name || config?.brand?.name || "",
    ville: ent.seatCity || "",
    eli: m.eli || acte?.publication?.eliUri || "",
  };
}

// Le signataire de l'acte, tel qu'il appose sa signature au bas de la pièce :
// ses lignes de qualité (toute la chaîne de délégations) et son nom. À défaut de
// document compilé, on se rabat sur le signataire de l'original signé.
function signataireDe(acte, doc, config) {
  const p = doc?.meta?.signataire;
  if (p) return { lignes: personRoleLines(p, config), nom: personSignatureName(p), qualite: p.qualite || "" };
  const s = (acte?.original?.signatures || [])[0]?.signataire || {};
  return { lignes: s.fonction ? [s.fonction] : [], nom: s.nom || "", qualite: s.fonction || "" };
}

// Le papier commun aux pièces d'exécution : une feuille A4, un en-tête
// d'administration, le corps de la pièce, et la mention de pied qui dit d'où
// elle vient — parce qu'une pièce imprimée circule hors de l'application.
function pagePiece({ titre, entete, corps, pied, config }) {
  const brand = config.brand || {};
  const uiFont = brand.uiFont || "system-ui, sans-serif";
  const logo = brand.logoUrl ? `<img class="exd-logo" src="${esc(brand.logoUrl)}" alt="">` : "";
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${esc(titre)}</title>
<style>
@page{size:A4 portrait;margin:${A4_MARGIN_PRINT}}
:root{--brand:${esc(brand.color || "#000091")}}
*{box-sizing:border-box}
body{margin:0;background:#eef1f5;color:#161616;font-family:${uiFont};font-size:15px;line-height:1.5}
.wrap{width:${A4_WIDTH};max-width:100%;margin:0 auto;padding:20px 0 44px}
.paper{width:100%;min-height:${A4_HEIGHT};background:#fff;padding:${A4_MARGIN};box-shadow:0 1px 4px rgba(0,0,0,.12)}
.exd-entete{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-bottom:2px solid var(--brand);padding-bottom:12px;margin:0 0 22px}
.exd-logo{height:58px;width:auto;display:block;margin:0 0 8px}
.exd-org{font-size:1.02rem;font-weight:700;margin:0}
.exd-org-lignes{margin:3px 0 0;font-size:.82rem;color:#3a3a3a}
.exd-ref{text-align:right;font-size:.82rem;color:#3a3a3a;white-space:nowrap}
.exd-titre{font-size:1.16rem;font-weight:700;text-align:center;letter-spacing:.04em;text-transform:uppercase;margin:6px 0 2px}
.exd-sous{text-align:center;font-size:.86rem;color:#3a3a3a;margin:0 0 22px}
.exd-h2{font-size:.94rem;font-weight:700;margin:22px 0 8px;padding-bottom:3px;border-bottom:1px solid #d5dbe4}
.exd-p{text-align:justify;margin:0 0 .72em}
.exd-list{margin:0 0 1em;padding-left:1.2em}
.exd-list li{text-align:justify;margin-bottom:.22em}
.exd-ident{display:grid;grid-template-columns:32mm 1fr;gap:2px 10px;margin:0 0 1.1em;font-size:.9rem}
.exd-ident dt{color:#5a6472}
.exd-ident dd{margin:0}
.exd-mono{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.9em;word-break:break-all;overflow-wrap:anywhere}
.exd-etat{width:100%;border-collapse:collapse;font-size:.8rem;table-layout:fixed}
.exd-etat th,.exd-etat td{border:1px solid #8993A5;padding:4px 5px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
.exd-etat th{background:#f0f2f6;font-size:.74rem;text-transform:uppercase;letter-spacing:.02em;color:#3a3a3a}
.exd-etat tr.is-done td:first-child{box-shadow:inset 3px 0 0 var(--brand)}
.exd-tag{display:inline-block;font-size:.72rem;border-radius:3px;padding:0 5px;margin-top:3px;border:1px solid #c7cfdb;color:#3a3a3a}
.exd-tag--ok{border-color:#0b5a2b;color:#0b5a2b}
.exd-tag--todo{border-color:#b8860b;color:#8a6508}
.exd-sub{display:block;color:#5a6472;font-size:.95em}
.exd-fait{margin:1.9em 0 .2em}
.exd-sign{display:flex;justify-content:space-between;align-items:flex-start;gap:1.2em;margin-top:.3em}
.exd-cachet{flex:0 0 52mm;height:30mm;border:1px dashed #9aa4b3;border-radius:3px;position:relative}
.exd-cachet span{position:absolute;left:5px;bottom:4px;font-size:.72rem;color:#7a8494}
.exd-sign-blk{flex:0 0 52mm;text-align:center}
.exd-sign-ligne{border-bottom:1px dotted #7a8494;height:44px;margin:6px 0 3px}
.exd-sign-role,.exd-sign-nom{margin:0;white-space:pre-line}
.exd-sign-nom{font-weight:600}
.exd-sign-note{font-size:.78rem;color:#5a6472;margin:0}
.exd-pied{margin-top:26px;border-top:1px solid #d5dbe4;padding-top:10px;font-size:.76rem;color:#5a6472}
.exd-pied p{margin:0 0 3px}
.exd-alerte{border-left:4px solid #b00020;background:#fdf0f2;padding:10px 12px;margin:0 0 1.2em}
@media (max-width:860px){.wrap{padding:12px 0 30px}.paper{padding:1.2cm 1cm;min-height:0}.exd-entete{flex-wrap:wrap}}
@media print{
  body{background:#fff;font-size:11pt}
  .wrap{width:auto;max-width:none;padding:0}
  .paper{width:auto;min-height:0;padding:0;box-shadow:none}
  .exd-h2,.exd-sign,.exd-alerte{break-inside:avoid;page-break-inside:avoid}
  .exd-etat tr{break-inside:avoid;page-break-inside:avoid}
  .exd-etat thead{display:table-header-group}
}
</style></head><body><div class="wrap"><div class="paper">
<div class="exd-entete">
  <div>${logo}<p class="exd-org">${esc(entete.org)}</p>${entete.lignes ? `<p class="exd-org-lignes">${esc(entete.lignes)}</p>` : ""}</div>
  <div class="exd-ref">${entete.ref.map((l) => esc(l)).join("<br>")}</div>
</div>
${corps}
<div class="exd-pied">${pied.map((l) => `<p>${esc(l)}</p>`).join("")}</div>
</div></div></body></html>`;
}

function enteteDe({ acte, doc, config, qui }) {
  const id = identiteActe(acte, doc, config);
  const lignes = [id.entiteNom !== id.entite ? id.entite : "", id.ville].filter(Boolean).join(" — ");
  return {
    org: id.entiteNom || config?.brand?.name || "",
    lignes,
    ref: [`Acte n° ${id.numero || "—"}`, `Édité le ${dateLongue(aujourdhui())}${qui ? " par " + qui : ""}`],
  };
}

// Le bloc d'identification de l'acte, commun aux deux pièces.
function blocIdentite(acte, doc, config) {
  const id = identiteActe(acte, doc, config);
  const lignes = [
    ["Nature", id.nature],
    ["Numéro", id.numero],
    ["Objet", id.objet],
    ["Date de signature", id.dateSignature ? dateLongue(id.dateSignature) : ""],
    ["Entité", id.entiteNom],
    ["Identifiant ELI", id.eli],
  ].filter(([, v]) => v);
  return `<dl class="exd-ident">${lignes.map(([k, v]) =>
    `<dt>${esc(k)}</dt><dd${k === "Identifiant ELI" ? ' class="exd-mono"' : ""}>${k === "Identifiant ELI" ? identifiantHtml(v) : esc(v)}</dd>`).join("")}</dl>`;
}

// Le pied de page : d'où vient la pièce, et ce qu'elle ne remplace pas. La date
// et l'auteur de l'édition y figurent parce qu'une pièce imprimée se classe et
// s'oppose : il faut pouvoir dire qui l'a produite et quand.
function piedDe({ kind, acte, doc, config, qui }) {
  const id = identiteActe(acte, doc, config);
  return [
    `${kind} — acte n° ${id.numero || "—"}${id.eli ? " · " + id.eli : ""}`,
    `Édité depuis le registre des actes de ${id.entiteNom || config?.brand?.name || ""} le ${dateLongue(aujourdhui())} à ${heure(new Date())}${qui ? ", par " + qui : ""}.`,
    "Pièce établie au vu du registre et des constatations de formalités qui y sont enregistrées. Seul l'original signé de l'acte fait foi.",
  ];
}

// ============================================================================
// L'état des formalités
// ============================================================================
export function etatFormalitesHtml({ acte, doc, config, opts = {}, qui = "" }) {
  const f = formalites(acte, opts);
  const st = statutExecution(acte, config, opts);
  const exe = dateExecutoire(acte, opts);
  const limite = dateLimiteRecours(acte, config, opts);
  const recours = recoursDe(acte);
  const d = delais(config);
  const id = identiteActe(acte, doc, config);

  const lignes = f.map((x) => {
    const signature = x.id === "signature";
    const etat = x.fait ? "Accomplie" : x.requis ? "À accomplir" : "Facultative";
    const tag = x.fait ? "ok" : x.requis ? "todo" : "opt";
    // La publication faite par la chaîne ELI porte l'URI de l'acte, pas la
    // référence du recueil : sur une pièce destinée au dossier, c'est la
    // référence du recueil qui parle — l'ELI figure en tête, dans l'identité.
    const ref = signature
      ? (x.ref || "")
      : x.parEli
        ? (acte?.execution?.publication?.ref || "chaîne ELI")
        : x.ref || "";
    const modalite = signature
      ? (acte?.original ? "Signature électronique" : "")
      : modeLabel(x.id, x.mode);
    const par = signature ? "" : (x.byName || "");
    return `<tr class="${x.fait ? "is-done" : ""}">
      <td><strong>${esc(x.label)}</strong><br><span class="exd-tag exd-tag--${tag}">${esc(etat)}</span></td>
      <td>${x.requis ? "Requise" : "Non requise"}</td>
      <td>${x.fait && x.at ? esc(dateLongue(x.at)) : "—"}</td>
      <td>${esc(ref || "—")}${x.parEli ? `<span class="exd-sub">${esc("constatée par la chaîne ELI")}</span>` : ""}${modalite ? `<span class="exd-sub">${esc(modalite)}</span>` : ""}</td>
      <td>${esc(par || "—")}</td>
    </tr>`;
  }).join("");

  const certificat = f.find((x) => x.certificat)?.certificat;
  const situation = [
    ["Date d'exécutoire", exe ? dateLongue(exe) : "Non atteinte : une formalité requise manque"],
    ["Délai de recours contentieux", limite
      ? `${enMots(d.recoursMois)} mois à compter de l'exécutoire — jusqu'au ${dateLongue(limite)}`
      : "Ne court pas : l'acte n'est pas encore exécutoire"],
    ["Situation", st.label],
    ["Recours introduit", recours
      ? `${recoursTypeLabel(recours.type) || "Recours"} le ${dateLongue(recours.introduitLe)}${recours.demandeur ? " — demandeur : " + recours.demandeur : ""}${recours.ref ? " (réf. " + recours.ref + ")" : ""}`
      : st.code === "brouillon" || st.code === "en_attente" ? "Sans objet" : "Aucun recours enregistré"],
  ];

  const corps = `
  <h1 class="exd-titre">État des formalités</h1>
  <p class="exd-sous">${esc([id.nature, id.numero && "n° " + id.numero, id.dateSignature && "du " + dateLongue(id.dateSignature)].filter(Boolean).join(" "))}</p>
  ${blocIdentite(acte, doc, config)}
  <p class="exd-p">Ce relevé reproduit, formalité par formalité, ce que le registre des actes porte : la date à laquelle chaque formalité a été accomplie, la référence sous laquelle elle l'a été, et son auteur. Les formalités requises conditionnent le caractère exécutoire de l'acte ; une formalité qui n'est pas requise peut tout de même avoir été accomplie, et reste au dossier.</p>
  <table class="exd-etat">
    <colgroup><col style="width:56mm"><col style="width:20mm"><col style="width:26mm"><col style="width:42mm"><col style="width:30mm"></colgroup>
    <thead><tr><th>Formalité</th><th>Requise</th><th>Date</th><th>Référence</th><th>Constatée par</th></tr></thead>
    <tbody>${lignes}</tbody>
  </table>
  ${certificat ? `<h2 class="exd-h2">Certificat de transmission</h2>
    <p class="exd-p">${esc(certificat.mention || "Transmission au contrôle de légalité")}${certificat.reference ? " · réf. " + esc(certificat.reference) : ""}${certificat.sceau ? ` · sceau <span class="exd-mono">${esc(String(certificat.sceau).slice(0, 32))}…</span>` : ""}</p>` : ""}
  <h2 class="exd-h2">Délais et situation</h2>
  <dl class="exd-ident">${situation.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
  ${recours?.note ? `<p class="exd-p"><em>Observation : ${esc(recours.note)}</em></p>` : ""}
  <p class="exd-p">Le présent état ne se substitue pas à l'acte : il en rapporte les formalités. Le texte en vigueur et l'original signé se consultent au registre.</p>`;

  return pagePiece({
    titre: `État des formalités — ${id.numero || acte?.id || ""}`,
    entete: enteteDe({ acte, doc, config, qui }),
    corps,
    pied: piedDe({ kind: "État des formalités", acte, doc, config, qui }),
    config,
  });
}

// ============================================================================
// L'attestation de non-recours
//
// Elle ne se délivre que pour un acte DÉFINITIF, c'est-à-dire dont le délai de
// recours contentieux est échu, et contre lequel aucun recours n'est enregistré.
// Hors de ce cas, la fonction le dit au lieu d'attester le faux : un appelant
// mal informé (un écran resté ouvert, une donnée modifiée entre-temps) ne peut
// pas faire produire une attestation mensongère.
// ============================================================================
export function attestationNonRecoursHtml({ acte, doc, config, opts = {}, qui = "" }) {
  const st = statutExecution(acte, config, opts);
  const recours = recoursDe(acte);
  const exe = dateExecutoire(acte, opts);
  const limite = dateLimiteRecours(acte, config, opts);
  const f = formalites(acte, opts);
  const d = delais(config);
  const id = identiteActe(acte, doc, config);
  const signature = signataireDe(acte, doc, config);
  const entite = id.entiteNom || config?.brand?.name || "l'administration";
  const ville = id.ville || "…";
  const demandee = `Attestation de non-recours — ${id.numero || acte?.id || ""}`;

  if (st.code !== "definitif" || recours) {
    const motif = recours
      ? `un recours y est enregistré (${(recoursTypeLabel(recours.type) || "recours").toLowerCase()} du ${dateLongue(recours.introduitLe)})`
      : st.code === "executoire"
        ? `le délai de recours contentieux court encore, jusqu'au ${dateLongue(limite)}`
        : st.code === "en_attente"
          ? "l'acte n'est pas encore exécutoire : une formalité requise manque"
          : "l'acte n'est pas signé";
    return pagePiece({
      titre: demandee,
      entete: enteteDe({ acte, doc, config, qui }),
      corps: `
      <h1 class="exd-titre">Attestation de non-recours</h1>
      <p class="exd-sous">${esc([id.nature, id.numero && "n° " + id.numero, id.dateSignature && "du " + dateLongue(id.dateSignature)].filter(Boolean).join(" "))}</p>
      <div class="exd-alerte"><strong>L'attestation ne peut pas être délivrée pour cet acte :</strong> ${esc(motif)}.</div>
      ${blocIdentite(acte, doc, config)}
      <p class="exd-p">Régularisez le dossier — constatez les formalités manquantes, ou enregistrez le recours s'il y en a un — puis délivrez l'attestation depuis l'écran « Exécution & délais ».</p>`,
      pied: piedDe({ kind: "Attestation de non-recours", acte, doc, config, qui }),
      config,
    });
  }

  // Les formalités requises et accomplies : c'est par elles que l'acte est
  // devenu exécutoire, et c'est de là qu'a couru le délai. Aucune formalité
  // requise (tout est dispensé par la trame) : la signature elle-même fait foi
  // de l'exécutoire.
  const requises = f.filter((x) => x.requis && x.fait && x.id !== "signature");
  const puces = requises.length
    ? requises.map((x) => `${esc(x.label)} le ${esc(dateLongue(x.at))}${x.ref ? " (réf. " + esc(x.ref) + ")" : ""}${x.byName ? ", constatée par " + esc(x.byName) : ""}`)
    : [`Aucune formalité n'était requise : l'acte est exécutoire du fait de sa signature, le ${esc(dateLongue(f.find((x) => x.id === "signature")?.at))}`];
  const listeFormalites = puces.map((t, i) => `<li>${t}${i < puces.length - 1 ? " ;" : "."}</li>`).join("");

  const corps = `
  <h1 class="exd-titre">Attestation de non-recours</h1>
  <p class="exd-sous">${esc([id.nature, id.numero && "n° " + id.numero, id.dateSignature && "du " + dateLongue(id.dateSignature)].filter(Boolean).join(" "))}</p>
  ${blocIdentite(acte, doc, config)}
  <p class="exd-p">Je soussigné(e) <strong>${esc(signature.nom)}</strong>${signature.qualite ? ", " + esc(signature.qualite) + " de " + esc(entite) : ""}, atteste que l'acte dont les caractéristiques précèdent :</p>
  <p class="exd-p"><strong>n'a fait l'objet d'aucun recours gracieux ni contentieux porté à la connaissance de ${esc(entite)}</strong> à la date du présent document.</p>
  <p class="exd-p">L'acte est devenu <strong>exécutoire le ${esc(dateLongue(exe))}</strong>, par l'accomplissement des formalités suivantes :</p>
  <ul class="exd-list">${listeFormalites}</ul>
  <p class="exd-p">Le délai de recours contentieux, de ${esc(enMots(d.recoursMois))} mois, court à compter de cette date. Il a expiré le <strong>${esc(dateLongue(limite))}</strong>, sans qu'aucun recours ait été introduit ni porté à la connaissance de ${esc(entite)}.</p>
  <p class="exd-p">La présente attestation est délivrée au vu du registre des actes et des constatations de formalités qui y sont enregistrées, pour servir et valoir ce que de droit.</p>
  <p class="exd-fait">Fait à ${esc(ville)}, le ${esc(dateLongue(aujourdhui()))}.</p>
  <div class="exd-sign">
    <div class="exd-cachet"><span>Cachet de la collectivité</span></div>
    <div class="exd-sign-blk">
      ${signature.lignes.map((l) => `<p class="exd-sign-role">${esc(l)},</p>`).join("")}
      <p class="exd-sign-nom">${esc(signature.nom)}</p>
      <div class="exd-sign-ligne"></div>
      <p class="exd-sign-note">Signature</p>
    </div>
  </div>`;

  return pagePiece({
    titre: demandee,
    entete: enteteDe({ acte, doc, config, qui }),
    corps,
    pied: piedDe({ kind: "Attestation de non-recours", acte, doc, config, qui }),
    config,
  });
}
