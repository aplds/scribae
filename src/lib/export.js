import { esc, slug, download } from "./util.js";
import { parseExpr } from "./expr.js";
import { renderDocument, personSignatureName, personRoleLines, documentToHtml } from "./render.js";
import { amendmentMentions, amendmentMention } from "./amend.js";
import { A4_WIDTH, A4_HEIGHT, A4_MARGIN, A4_BREAK_CSS } from "./paper.js";
import { styleForDoc, styleCss, paperMargins } from "./styles.js";

// Marges du document Word : Word travaille en centimètres et ne connaît pas
// `@page{margin:20mm}` — la charte, elle, exprime ses marges en millimètres.
const wordMargin = (style) => {
  const m = paperMargins(style);
  const cm = (mm) => (Math.round((mm / 10) * 100) / 100) + "cm";
  return `${cm(m.top)} ${cm(m.right)} ${cm(m.bottom)} ${cm(m.left)}`;
};

const AKN_NS = "http://docs.oasis-open.org/legaldocml/ns/akn/3.0";

// La marque d'une liste à puces en Markdown, quand le bloc a choisi la sienne
// (voir `paramsBloc`, lib/schema.js). Markdown ne connaît qu'une puce ; on
// prend celle du bloc quand elle a un équivalent visuel, la puce ordinaire
// sinon.
const MARQUE_MD = { disc: "-", circle: "-", square: "-", dash: "–", none: "" };

// Échappement d'une valeur d'attribut (le contenu HTML a `esc` ; une adresse
// posée dans `href` doit aussi voir ses guillemets et ses esperluettes échappés).
const escAttr = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ==========================================================================
// Akoma Ntoso 3.0
// ==========================================================================

export function exportAkn(doc, config, trame) {
  const m = doc.meta || {};
  const org = m.entity || m.org || {};
  const kind = doc.kind || "original";
  const w = [];
  const p = (s = "") => w.push(s);

  const genDate = String(m.generatedAt || new Date().toISOString()).slice(0, 10);
  const eliWork = m.eli || "";
  // FRBRthis et FRBRuri ne disent pas la même chose : FRBRthis porte
  // l'IDENTIFIANT (l'ELI sous sa forme « eli:/fr/… »), FRBRuri doit porter une
  // URI HTTP CANONIQUE, résoluble par n'importe qui. Les confondre — c'était le
  // cas — rendait la ressource non résoluble à l'extérieur : un système tiers
  // qui suit le FRBRuri tombait sur une chaîne « eli:/fr/… », pas sur une
  // adresse. On dérive donc l'URI HTTP de l'ELI et de la base publique.
  const baseEli = String((config.brand && config.brand.baseUri) || "").replace(/\/+$/, "");
  const eliHttp = baseEli && /^eli:\/fr\//i.test(eliWork)
    ? baseEli + "/eli/" + eliWork.replace(/^eli:\/fr\//i, "")
    : eliWork;
  // Une version consolidée n'est pas un nouvel acte : c'est une autre
  // expression du même « work ». L'URI d'expression porte donc la date de
  // consolidation, pas la date de signature d'origine.
  const exprDate = kind === "consolide"
    ? String((m.consolidated && m.consolidated.at) || m.dateSignature || "").slice(0, 10)
    : (m.dateSignature || "sans-date");
  const eliExprId = `${eliWork}/fra@${exprDate}`;
  const eliExpr = `${eliHttp}/fra@${exprDate}`;
  const eliMan = `${eliExpr}/main.xml`;
  const contains = kind === "consolide" ? "consolidatedVersion" : "originalVersion";

  p('<?xml version="1.0" encoding="UTF-8"?>');
  p(`<akomaNtoso xmlns="${AKN_NS}" xmlns:eli="http://data.europa.eu/eli/ontology#" xmlns:ia="${esc(config.brand.baseUri || "https://exemple.fr")}/ns">`);
  p(`  <act name="${esc(m.actTypeId)}" contains="${contains}" eId="act_1">`);
  p("    <meta>");
  p('      <identification source="#eli">');
  p("        <FRBRWork>");
  p(`          <FRBRthis value="${esc(eliWork)}"/>`);
  p(`          <FRBRuri value="${esc(eliHttp)}"/>`);
  p(`          <FRBRdate date="${esc(m.dateSignature)}" name="document"/>`);
  p(`          <FRBRauthor href="#${esc(org.id || "org")}"/>`);
  p('          <FRBRcountry value="fr"/>');
  p(`          <FRBRnumber value="${esc(m.numero)}"/>`);
  p(`          <FRBRtitle value="${esc(firstTitle(doc) + (kind === "consolide" ? " (version consolidée)" : ""))}"/>`);
  p("        </FRBRWork>");
  p("        <FRBRExpression>");
  p(`          <FRBRthis value="${esc(eliExprId)}"/>`);
  p(`          <FRBRuri value="${esc(eliExpr)}"/>`);
  p(`          <FRBRdate date="${esc(m.dateSignature)}" name="signature"/>`);
  p(`          <FRBRauthor href="#${esc(org.id || "org")}"/>`);
  p('          <FRBRlanguage language="fra"/>');
  p("        </FRBRExpression>");
  p("        <FRBRManifestation>");
  p(`          <FRBRthis value="${esc(eliMan)}"/>`);
  p(`          <FRBRuri value="${esc(eliMan)}"/>`);
  p(`          <FRBRdate date="${esc(genDate)}" name="generation"/>`);  p('          <FRBRauthor href="#logiciel"/>');
  p('          <FRBRformat value="xml"/>');
  p("        </FRBRManifestation>");
  p("      </identification>");

  // références
  const usedRefs = collectUsedRefs(doc, config);
  p('      <references source="#eli">');
  const seen = new Set();
  for (const e of [org, config.entities?.find((x) => x.kind === "etablissement" || x.kind === "commune")].filter(Boolean)) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    p(`        <TLCOrganization eId="${esc(e.id)}" href="#${esc(e.id)}" showAs="${esc(e.name)}"/>`);
  }
  for (const r of usedRefs) {
    const href = r.source ? r.source : `${(config.brand.baseUri || "").replace(/\/$/, "")}/referentiel/${slug(r.id)}`;
    p(`        <original eId="${esc(r.id)}" href="${esc(href)}" showAs="${esc(r.label)}"/>`);
  }
  // relations de modification : l'acte modifié / les actes modificatifs
  if (m.amends && m.amends.numero) {
    p(`        <original eId="amended_act" href="${esc(m.amends.eli || "")}" showAs="${esc([m.amends.title, m.amends.numero && "n°" + m.amends.numero].filter(Boolean).join(" "))}"/>`);
  }
  for (const t of doc.trail || []) {
    p(`        <original eId="mod_${esc(slug(t.numero || "acte"))}" href="${esc(t.eli || "")}" showAs="${esc([t.designation, t.numero && "n°" + t.numero, t.date].filter(Boolean).join(" "))}"/>`);
  }
  p("      </references>");

  // notes des administrateurs (le savoir-faire cesse de disparaître)
  if (doc.notes?.length) {
    p('      <notes source="#preparation">');
    doc.notes.forEach((n, i) => {
      p(`        <note eId="note_${i + 1}" author="${esc(n.author || "")}" date="${esc(n.date || "")}" type="${esc(n.kind)}" data-target="${esc(n.path)}">`);
      p(`          <p>${esc(n.text)}</p>`);
      // Le passage cité vient APRÈS le texte : la première balise <p> d'une note
      // reste son texte, ce que lit la relecture d'Akoma Ntoso (voir akn.js).
      if (n.quote) p(`          <p data-quote="true">${esc(n.quote)}</p>`);      p("        </note>");
    });
    p("      </notes>");
  }

  p('      <lifecycle source="#logiciel">');
  p(`        <eventRef eId="ev_1" date="${esc(genDate)}" source="#logiciel" type="generation"/>`);
  let ev = 1;
  for (const t of doc.trail || []) {
    ev++;
    p(`        <eventRef eId="ev_${ev}" date="${esc(t.date || "")}" source="#logiciel" type="amendment" href="#mod_${esc(slug(t.numero || "acte"))}"/>`);
  }
  if (m.amends && m.amends.numero) {
    ev++;
    p(`        <eventRef eId="ev_${ev}" date="${esc(m.dateSignature || "")}" source="#logiciel" type="amendment" href="#amended_act"/>`);
  }
  p("      </lifecycle>");

  p('      <proprietary source="#logiciel">');
  p("        <ia:preparation>");
  p(`          <ia:numero>${esc(m.numero)}</ia:numero>`);
  p(`          <ia:objet>${esc(m.objet)}</ia:objet>`);
  // La NATURE (« acte » ou « annexe ») suit le document : elle commande la
  // signature — une annexe ne se signe pas. Elle permet donc à un fichier
  // relu de savoir ce qu'il a entre les mains, même hors du registre.
  p(`          <ia:nature>${esc(m.nature || "acte")}</ia:nature>`);
  p(`          <ia:dateSignature>${esc(m.dateSignature)}</ia:dateSignature>`);
  p(`          <ia:dateEffet>${esc(m.dateEffet)}</ia:dateEffet>`);
  p(`          <ia:entite code="${esc(org.code || "")}">${esc(org.name || "")}</ia:entite>`);
  p(`          <ia:trame id="${esc(m.trameId)}" version="${esc(m.trameVersion)}"/>`);
  p(`          <ia:statut>${esc(doc.statut || "brouillon")}</ia:statut>`);
  p(`          <ia:eli>${esc(eliWork)}</ia:eli>`);
  p("        </ia:preparation>");
  // Écarts de rédaction : le texte du document s'écarte de la trame de
  // référence. L'information suit l'acte (elle n'est jamais inventée en AKN
  // standard : elle vit dans le bloc propriétaire).
  if (doc.ecarts?.length) {
    p(`        <ia:redaction conforme="false" ecarts="${doc.ecarts.length}">`);
    p(`          <ia:trameReference id="${esc(m.trameId)}" version="${esc(m.trameVersion)}"/>`);
    for (const e of doc.ecarts) {
      p(`          <ia:ecart emplacement="${esc(e.addr)}" libelle="${esc(e.label)}">`);
      p(`            <ia:redactionTrame>${esc(e.original)}</ia:redactionTrame>`);
      p(`            <ia:redactionActe>${esc(e.current)}</ia:redactionActe>`);
      p("          </ia:ecart>");
    }
    p("        </ia:redaction>");
  }
  // Ce que l'application sait du lien de modification : indispensable pour
  // reconstituer les deux documents au rechargement d'un XML exporté.
  if (m.amends && m.amends.numero) {
    p("        <ia:modification>");
    p(`          <ia:cible numero="${esc(m.amends.numero)}" date="${esc(m.amends.date || "")}" eli="${esc(m.amends.eli || "")}"/>`);
    for (const a of doc.amendments || []) {
      p(`          <ia:articleModifie cible="${esc(a.target || "")}" article="${esc(a.targetLabel || "")}" action="${esc(a.action || "")}" nouveau="${esc(a.newNum || "")}"/>`);
    }
    p("        </ia:modification>");
  }
  if (kind === "consolide") {
    const cons = m.consolidated || {};
    p(`        <ia:consolidation date="${esc(String(cons.at || "").slice(0, 10))}" modifications="${esc(cons.count ?? 0)}">`);
    p(`          <ia:acteOrigine numero="${esc(m.numero)}" date="${esc(m.dateSignature || "")}" eli="${esc(m.eli || "")}"/>`);
    for (const t of doc.trail || []) {
      p(`          <ia:acteModificatif numero="${esc(t.numero || "")}" designation="${esc(t.designation || "")}" date="${esc(t.date || "")}" eli="${esc(t.eli || "")}" modifications="${(t.items || []).length}">`);
      for (const it of t.items || []) {
        p(`            <ia:item article="${esc(it.article || "")}" action="${esc(it.action || "")}" nouveau="${esc(it.newNum || "")}" cible="${esc(it.targetEId || "")}" nouveauEId="${esc(it.newEId || "")}" redaction="${esc(it.detail || "")}"/>`);
      }
      p("          </ia:acteModificatif>");
    }
    p("        </ia:consolidation>");
  }
  p("      </proprietary>");
  p("    </meta>");

  // préambule
  const titleNode = doc.nodes.find((n) => n.type === "title");
  const authorityNode = doc.nodes.find((n) => n.type === "authority");
  const visaNode = doc.nodes.find((n) => n.type === "visas");
  const considNode = doc.nodes.find((n) => n.type === "considerants");
  const enactNode = doc.nodes.find((n) => n.type === "enact");

  if (titleNode) {
    p("    <preface>");
    p(`      <p>${esc(titleNode.text)}</p>`);
    p("    </preface>");
  }
  p("    <preamble>");
  if (authorityNode) {
    p('      <formula name="authority" eId="frm_authority">');
    p(`        <p>${esc(authorityNode.text)}</p>`);
    p("      </formula>");
  }
  if (visaNode?.items?.length) {
    p('      <formula name="visas" eId="frm_visas">');
    for (const it of visaNode.items) {
      // Une décision fondant la signature porte son LIEN : l'Akoma Ntoso le
      // reçoit par un `ref` (c'est l'élément prévu pour cela), ce qui le fait
      // survivre à l'archivage et à l'échange. Voir src/lib/delegations.js.
      const etiquette = esc(config.vocab.visasLabel || "Vu");
      p(it.lien
        ? `        <p>${etiquette} <ref href="${escAttr(it.lien)}">${esc(it.text)}</ref></p>`
        : `        <p>${esc([config.vocab.visasLabel || "Vu", it.text].join(" "))}</p>`);
    }
    p("      </formula>");
  }
  if (considNode?.items?.length) {
    p("      <recitals eId=\"recitals_1\">");
    p(`        <intro><p>${esc(considNode.items[0].text)}</p></intro>`);
    for (const it of considNode.items.slice(1)) p(`        <p>${esc(it.text)}</p>`);
    p("      </recitals>");
  }
  if (enactNode) {
    p('      <formula name="enacting" eId="frm_enacting">');
    p(`        <p>${esc(enactNode.text)}</p>`);
    p("      </formula>");
  }
  p("    </preamble>");

  // corps
  p("    <body>");
  let artIdx = 0;
  // Les divisions du texte (Livre, Titre, Chapitre, Section) deviennent les
  // conteneurs d'Akoma Ntoso correspondants ; l'échelon au-delà du quatrième se
  // range dans un `hcontainer` nommé, faute d'élément normalisé.
  const DIV_TAGS = { 1: "part", 2: "title", 3: "chapter", 4: "section" };
  // Les blocs de texte écrits HORS article (ajoutés au corps ou à une division
  // par la rédaction — voir lib/structure.js) : Akoma Ntoso les range dans un
  // `block` générique, que la lecture (src/lib/akn.js) reprend à l'import.
  const TEXT_BLOCKS = new Set(["para", "raw", "list", "table"]);
  const emitNode = (node, pad) => {
    if (TEXT_BLOCKS.has(node.type)) {
      const eId = node.eId ? ` eId="${esc(node.eId)}"` : "";
      p(`${pad}<block name="disposition"${eId}>`);
      p(indentXml(blockToXml(node, config), pad.length + 2));
      p(`${pad}</block>`);
      return;
    }
    if (node.type === "division") {
      const niveau = Math.min(4, Math.max(1, Number(node.level) || 1));
      const tag = DIV_TAGS[niveau] || "hcontainer";
      const name = DIV_TAGS[niveau] ? "" : ` name="${esc(node.levelLabel || "division")}"`;
      p(`${pad}<${tag}${name} eId="${esc(node.eId || "")}">`);
      p(`${pad}  <num>${esc(node.numLabel || "")}</num>`);
      if (node.heading) p(`${pad}  <heading>${esc(node.heading)}</heading>`);
      for (const b of node.blocks || []) emitNode(b, pad + "  ");
      p(`${pad}</${tag}>`);
      return;
    }
    if (node.type !== "article") return;
    artIdx++;
    const artEId = node.eId || `art_${artIdx}`;
    p(`${pad}<article eId="${esc(artEId)}">`);
    p(`${pad}  <num>${esc(node.numLabel)}</num>`);
    if (node.heading) p(`${pad}  <heading>${esc(node.heading)}</heading>`);
    const blocks = node.blocks || [];
    let i = 0;
    while (i < blocks.length) {
      // La nouvelle rédaction apportée par un acte modificatif est regroupée
      // dans un bloc nommé : la formule d'amendement et le texte qu'elle
      // introduit restent ainsi distincts à la relecture.
      if (blocks[i].quoted) {
        p(`${pad}  <block name="nouvelleRedaction">`);
        while (i < blocks.length && blocks[i].quoted) {
          p(indentXml(blockToXml(blocks[i], config), pad.length + 4));
          i++;
        }
        p(`${pad}  </block>`);
        continue;
      }
      p(`${pad}  <paragraph eId="${esc(blocks[i].eId || `${artEId}__p_${i + 1}`)}">`);
      p(`${pad}    <content>`);
      p(indentXml(blockToXml(blocks[i], config), pad.length + 6));
      p(`${pad}    </content>`);
      p(`${pad}  </paragraph>`);
      i++;
    }
    p(`${pad}</article>`);
  };
  // Un nœud du document ANNEXÉ, écrit pour l'Akoma Ntoso. Ses articles et ses
  // divisions passent par le MÊME chemin que ceux de l'acte (`emitNode` : son
  // texte est capturé ici plutôt qu'écrit) ; les morceaux qui n'existent qu'à la
  // racine d'un acte — intitulé, visas, considérants, formule d'édiction,
  // mentions — sont écrits à plat dans l'attachement, puisque c'est là que le
  // texte de l'annexe est joint. Voir src/lib/annexe-docs.js.
  const annexeNodeXml = (node) => {
    if (node.type === "article" || node.type === "division") {
      const mark = w.length;
      emitNode(node, "");
      const xml = w.slice(mark).join("\n");
      w.length = mark;
      return xml;
    }
    switch (node.type) {
      case "title": return `<heading>${esc(node.text)}</heading>`;
      case "authority": return `<p>${esc(node.text)}</p>`;
      case "enact": return `<p>${esc(node.text)}</p>`;
      case "mention": return `<p>${esc(node.text)}</p>`;
      case "visas":
        return (node.items || []).map((it) => `<p>${esc([config?.vocab?.visasLabel || "Vu", it.text].join(" "))}</p>`).join("\n");
      case "considerants":
        return (node.items || []).map((it) => `<p>${esc(it.text)}</p>`).join("\n");
      // L'annexe ne porte ni signature ni liste d'annexes.
      case "annexes":
      case "signature":
        return "";
      default:
        return blockToXml(node, config);
    }
  };
  doc.nodes.forEach((node) => emitNode(node, "      "));
  p("    </body>");

  // conclusions : signature + mentions
  p("    <conclusions>");
  const sig = doc.nodes.find((n) => n.type === "signature");
  const mentions = doc.nodes.filter((n) => n.type === "mention");
  if (sig) {
    p(`      <p>Fait à ${esc(sig.place)}, le ${esc(sig.date)}</p>`);
    p('      <block name="signature" eId="sig_1">');
    if (sig.signataire) {
      for (const ligne of personRoleLines(sig.signataire, config)) {
        p(`        <p>${esc(ligne)}</p>`);
      }
      p(`        <p>${esc(personSignatureName(sig.signataire))}</p>`);
    }
    p("      </block>");
  }
  for (const mn of mentions) p(`      <p>${esc(mn.text)}</p>`);
  p("    </conclusions>");

  // Les documents ANNEXÉS : l'acte qui en adopte un les annonce à la fin de son
  // dispositif (nœud « annexes », rendu en HTML et en Markdown), et son
  // ORIGINAL est suivi de leur TEXTE — une annexe ne se signe pas : c'est l'acte
  // qui l'adopte qui est signé, et sa signature lui donne son autorité (voir
  // src/lib/annexe-docs.js). En Akoma Ntoso, ces documents sont exactement ce
  // que porte `<attachments>` : ils restent ainsi attachés à l'acte à travers
  // l'archivage et l'échange — identification ET texte.
  const annexesNode = doc.nodes.find((n) => n.type === "annexes");
  const joints = doc.annexeDocs || [];
  if (annexesNode?.items?.length || joints.length) {
    p("    <attachments>");
    joints.forEach((joint, i) => {
      const it = (annexesNode?.items || []).find((x) => x.acteId && x.acteId === joint.acte?.id) || {};
      p(`      <attachment eId="annexe_${i + 1}">`);
      p(`        <heading>${esc(joint.libelle || it.texte || it.designation || "Annexe")}</heading>`);
      // L'intitulé porte déjà l'objet quand l'identification est complète ; ce
      // paragraphe n'est là que pour une identification qui n'aurait rien dit
      // d'autre que l'objet (voir src/lib/annexes.js).
      if (it.objet && !it.texte) p(`        <p>${esc(it.objet)}</p>`);
      if (it.lien) p(`        <ref href="${escAttr(it.lien)}">${esc(it.lien)}</ref>`);
      // Le TEXTE de l'annexe, tel qu'il s'imprime à la suite de l'acte : son
      // intitulé, ses visas, ses articles et divisions, ses mentions — sans
      // signature (elle n'en a pas).
      p('        <block name="texteAnnexe">');
      if (joint.doc) for (const n of joint.doc.nodes || []) p(indentXml(annexeNodeXml(n, config), 10));
      p("        </block>");
      p("      </attachment>");
    });
    // Les annexes annoncées mais absentes du registre (elles n'ont pas pu être
    // résolues) : leur identification seule est conservée, plutôt que rien.
    const connus = new Set(joints.map((j) => j.acte?.id));
    for (const it of annexesNode?.items || []) {
      if (connus.has(it.acteId)) continue;
      p(`      <attachment eId="annexe_${connus.size + 1}">`);
      p(`        <heading>${esc(it.texte || it.designation || "Annexe")}</heading>`);
      if (it.objet && !it.texte) p(`        <p>${esc(it.objet)}</p>`);
      if (it.lien) p(`        <ref href="${escAttr(it.lien)}">${esc(it.lien)}</ref>`);
      p("      </attachment>");
    }
    p("    </attachments>");
  }

  p("  </act>");
  p("</akomaNtoso>");
  return w.join("\n");
}

function firstTitle(doc) {
  return doc.nodes.find((n) => n.type === "title")?.text || "";
}

function blockToXml(b, config) {
  const inner = rawBlockToXml(b, config);
  const ch = b.change && b.change.kind;
  if (ch === "ins" || ch === "del") {
    const by = b.change.by ? ` by="${esc(b.change.by)}"` : "";
    const date = b.change.date ? ` date="${esc(b.change.date)}"` : "";
    return `<${ch}${date}${by}>\n${inner}\n</${ch}>`;
  }
  return inner;
}

function rawBlockToXml(b, config) {
  switch (b.type) {
    case "para":
      // L'encadré d'un paragraphe se dit en Akoma Ntoso par le conteneur
      // `block name="box"` — l'alignement et le retrait, eux, sont de la mise
      // en page : le format ne les porte pas, et on ne les invente pas.
      return b.boxed
        ? `<block name="box">\n<p>${esc(b.text)}</p>\n</block>`
        : `<p>${esc(b.text)}</p>`;
    case "list": {
      const tag = b.ordered ? "ol" : "ul";
      const start = b.ordered && Number(b.start) > 1 ? ` start="${Number(b.start)}"` : "";
      const items = (b.items || []).map((it) => `<li><p>${esc(it.text)}</p></li>`).join("\n");
      return `<${tag}${start}>\n${items}\n</${tag}>`;
    }
    case "table": {
      const head = `<tr>${(b.columns || []).map((c) => `<th><p>${esc(c)}</p></th>`).join("")}</tr>`;
      const rows = (b.rows || []).map((r) => `<tr>${(b.columns || []).map((_, i) => `<td><p>${esc(r[i] ?? "")}</p></td>`).join("")}</tr>`).join("\n");
      // Sans ligne d'en-tête, les intitulés de colonnes sont la première ligne
      // de données : le tableau n'a plus de `thead`, et la relecture le sait.
      if (b.head === false) {
        const premiere = `<tr>${(b.columns || []).map((c) => `<td><p>${esc(c)}</p></td>`).join("")}</tr>`;
        return `<table>\n<tbody>\n${premiere}\n${rows}\n</tbody>\n</table>`;
      }
      return `<table>\n<thead>${head}</thead>\n<tbody>\n${rows}\n</tbody>\n</table>`;
    }
    default:
      return `<p>${esc(b.text || "")}</p>`;
  }
}

function indentXml(xml, n) {
  const pad = " ".repeat(n);
  return xml.split("\n").map((l) => pad + l).join("\n");
}

function collectUsedRefs(doc, config) {
  const visa = doc.nodes.find((n) => n.type === "visas");
  const ids = new Set();
  for (const it of visa?.items || []) {
    const found = (config.refs || []).find((r) => r.label === it.text.replace(/,$/, "") || r.label === it.text);
    if (found) ids.add(found.id);
  }
  return [...ids].map((id) => (config.refs || []).find((r) => r.id === id)).filter(Boolean);
}

// ==========================================================================
// Schematron — traduction partielle et honnête des règles métier
// ==========================================================================

export function exportSchematron(doc, config, trame) {
  const rules = trame.rules || [];
  // Une ANNEXE ne porte pas de signature : elle tient son autorité de l'acte qui
  // l'adopte, dont l'original est suivi de son texte. Le schéma ne réclame donc
  // pas de bloc de signature pour elle (voir src/lib/annexe-docs.js).
  const estAnnexe = doc?.meta?.nature === "annexe";
  const translated = [];
  const untranslated = [];
  for (const r of rules) {
    if (r.kind === "inclusion") continue;
    const t = translateToXPath(r.expr);
    if (t) translated.push({ rule: r, xpath: t });
    else untranslated.push(r);
  }
  const w = [];
  const p = (s = "") => w.push(s);
  p('<?xml version="1.0" encoding="UTF-8"?>');
  p('<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xslt2">');
  p(`  <title>Contrôles — ${esc(trame.name)} v${esc(trame.version)}</title>`);
  p(`  <ns prefix="akn" uri="${AKN_NS}"/>`);
  p(`  <ns prefix="ia" uri="${esc(config.brand.baseUri)}/ns"/>`);
  p(`  <!-- Vérifier la conformité du document contre le schéma akn-core 3.0 avant application. -->`);
  p('  <pattern id="structure">');
  p('    <rule context="/akn:akomaNtoso/akn:act">');
  p('      <assert test="akn:preface/akn:p" id="s-title">L\'intitulé de l\'acte est absent (preface/p).</assert>');
  // Une annexe n'a pas de numéro propre : le schéma ne le réclame pas pour
  // elle (voir src/lib/annexes.js).
  if (!estAnnexe) p('      <assert test="akn:meta/akn:proprietary/ia:preparation/ia:numero != \'\'" id="s-numero">Le numéro de l\'acte est absent.</assert>');
  p(`      <assert test="akn:meta/akn:proprietary/ia:preparation/ia:dateSignature != ''" id="s-date">${estAnnexe ? "La date d'adoption est absente." : "La date de signature est absente."}</assert>`);
  p('      <assert test="count(akn:body//akn:article) &gt;= 1" id="s-articles">L\'acte ne comporte aucun article.</assert>');
  p('      <assert test="akn:preamble/akn:formula[@name=\'enacting\']" id="s-enacting">La formule d\'édiction est absente.</assert>');
  if (estAnnexe) {
    p('      <!-- Annexe : pas de bloc de signature — c\'est l\'acte qui l\'adopte qui est signé. -->');
  } else {
    p('      <assert test="akn:conclusions/akn:block[@name=\'signature\']" id="s-signature">Le bloc de signature est absent.</assert>');
  }
  p('    </rule>');
  p('    <rule context="/akn:akomaNtoso/akn:act/akn:body//akn:article">');
  p('      <assert test="akn:num != \'\'" id="s-art-num">Article sans numéro.</assert>');
  p('      <assert test="akn:paragraph/akn:content/*" id="s-art-content">Article sans contenu.</assert>');
  p('    </rule>');
  p('  </pattern>');
  if (translated.length) {
    p('  <pattern id="regles-metier">');
    p('    <rule context="/akn:akomaNtoso/akn:act">');
    for (const { rule, xpath } of translated) {
      const tag = rule.level === "blocking" ? "assert" : "report";
      const test = tag === "report" ? negateForReport(xpath) : xpath;
      p(`      <${tag} test="${esc(test)}" id="${esc(rule.id)}">${esc(rule.message || rule.expr)}</${tag}>`);
    }
    p('    </rule>');
    p('  </pattern>');
  }
  if (untranslated.length) {
    p("  <!-- Règles exprimées dans le langage d'expression de l'application, non traduisibles");
    p("       automatiquement en XPath sur le document AKN. À contrôler au moment de la rédaction : -->");
    for (const r of untranslated) {
      p(`  <!-- [${esc(r.level)}] ${esc(r.message || "")} :: ${esc(r.expr)} -->`);
    }
  }
  p("</schema>");
  return w.join("\n");
}

// Traduction (volontairement limitée, jamais inventée) vers XPath 2.0 sur le document AKN.
function translateToXPath(src) {
  let ast;
  try { ast = parseExpr(src); } catch { return null; }
  return x(ast);
  function x(n) {
    switch (n.k) {
      case "lit":
        return typeof n.v === "number" ? String(n.v) : `'${String(n.v).replace(/'/g, "''")}'`;
      case "not": { const a = x(n.e); return a ? `not(${a})` : null; }
      case "and": { const a = x(n.l), b = x(n.r); return a && b ? `(${a} and ${b})` : null; }
      case "or": { const a = x(n.l), b = x(n.r); return a && b ? `(${a} or ${b})` : null; }
      case "cmp": {
        const a = x(n.l), b = x(n.r);
        if (!a || !b) return null;
        const op = n.op === "===" ? "=" : n.op === "!==" ? "!=" : n.op === "==" ? "=" : n.op;
        return `(${a} ${op} ${b})`;
      }
      case "name":
        return `akn:meta/akn:proprietary/ia:preparation/ia:${n.name}/text()`;
      case "call": {
        const arg = n.args[0];
        if (n.name === "exists" || n.name === "empty") {
          const a = x(arg);
          if (!a) return null;
          const test = `${a} != ''`;
          return n.name === "exists" ? test : `not(${test})`;
        }
        if (n.name === "matches") {
          const [a, b] = n.args.map(x);
          return a && b ? `matches(${a}, ${b})` : null;
        }
        if (n.name === "diff_days") {
          const [a, b] = n.args.map(x);
          return a && b ? `(xs:date(${a}) - xs:date(${b})) div xs:dayTimeDuration('P1D')` : null;
        }
        return null;
      }
      case "arith": {
        const a = x(n.l), b = x(n.r);
        if (!a || !b) return null;
        const notEmpty = `(${a} != '' and ${b} != '')`;
        const op = n.op === "=" ? "=" : n.op;
        return `(${notEmpty} and (number(${a}) ${op} number(${b})))`;
      }
      case "cond": return null;
      default: return null;
    }
  }
}

function negateForReport(xpath) {
  return `not(${xpath})`;
}

// ==========================================================================
// JSON-LD (ELI + schema.org)
// ==========================================================================
export function exportJsonLd(doc, config) {
  const m = doc.meta;
  const org = m.entity || m.org || {};
  const kind = doc.kind || "original";
  return JSON.stringify({
    "@context": { eli: "http://data.europa.eu/eli/ontology#", schema: "https://schema.org/", dcterms: "http://purl.org/dc/terms/" },
    "@type": "eli:LegalResource",
    "@id": m.eli,
    "eli:title": firstTitle(doc) + (kind === "consolide" ? " (version consolidée)" : ""),
    "eli:date_document": m.dateSignature,
    "eli:date_publication": m.dateSignature,
    "eli:id_local": m.numero,
    "eli:type_document": m.actTypeId,
    "eli:passed_by": { "@id": org.id, "schema:name": org.name },
    "eli:jurisdiction": "FR",
    "eli:language": "fra",
    "eli:is_realized_by": { "@type": "eli:Format", "eli:format": "application/akn+xml", "eli:language": "fra" },
    ...(m.amends && m.amends.eli ? { "eli:amends": { "@id": m.amends.eli, "eli:id_local": m.amends.numero, "eli:date_document": m.amends.date } } : {}),
    ...(doc.trail?.length ? {
      "eli:amended_by": doc.trail.map((t) => ({ "@id": t.eli || undefined, "eli:id_local": t.numero, "eli:date_document": t.date, "eli:description": (t.items || []).map((i) => `${i.article || ""} : ${i.actionLabel || ""}`).join(" ; ") })),
    } : {}),
    ...(kind === "consolide" && (m.consolidated?.at) ? { "eli:consolidation_date": String(m.consolidated.at).slice(0, 10) } : {}),
    "dcterms:description": m.objet,
    "dcterms:creator": { "@type": "schema:Organization", "schema:name": config.brand.name },
    "schema:legislationIdentifier": m.numero,
  }, null, 2);
}

// ==========================================================================
// Markdown (relecture, diffusion interne)
// ==========================================================================
export function exportMarkdown(doc, config, opts = {}) {
  // Même option que le rendu du document : sans le suivi des modifications, le
  // Markdown ne montre que le texte en vigueur, avec la mention sous l'intitulé.
  // Les notes de préparation, elles, ne sortent que si l'appelant les demande
  // (`notes: true`) : elles ne font pas partie de l'acte, et le Markdown sert
  // aussi de représentation PUBLIÉE (voir `src/ui/views/signature.js`).
  const tracking = doc.meta?.consolidated?.showChanges === true;
  const mentions = tracking ? null : amendmentMentions(doc, config);
  // Un document rendu comme ANNEXE d'un autre ne porte pas de signature : c'est
  // l'acte qui l'adopte qui est signé (voir src/lib/annexe-docs.js).
  const sansSignature = opts.sansSignature === true;
  const lines = [];
  if (doc.kind === "consolide" && doc.consolidationNotice) lines.push("> " + doc.consolidationNotice, "");
  // Un bloc de texte (paragraphe, liste, tableau) : la rédaction en écrit dans
  // les articles, et peut en ajouter directement au corps de l'acte ou dans une
  // division (voir lib/structure.js). Les deux se lisent de la même façon, d'où
  // ce seul chemin d'écriture.
  const emitBloc = (b) => {
    if (!tracking && b.change?.kind === "del") return;
    if (b.type === "list") {
      // Liste numérotée ou à puces : la marque du bloc, quand elle a un sens en
      // Markdown (« • », « – »), sinon la puce ordinaire.
      const puce = b.ordered ? "1." : (MARQUE_MD[b.marker] || "-");
      lines.push(...(b.items || []).map((i) => puce + " " + mdWrap(b.change, i.text)), "");
    } else if (b.type === "table") {
      const legende = b.caption && b.captionPos === "bottom" ? "Tableau : " + b.caption : "";
      if (b.caption && b.captionPos !== "bottom") lines.push("**" + b.caption + "**", "");
      lines.push("| " + (b.columns || []).join(" | ") + " |");
      // Sans ligne d'en-tête, le tableau n'a pas de rangée de séparation : la
      // première ligne est une ligne de données comme les autres.
      if (b.head !== false) lines.push("| " + (b.columns || []).map(() => "---").join(" | ") + " |");
      for (const r of b.rows || []) lines.push("| " + (b.columns || []).map((_, i) => r[i] ?? "").join(" | ") + " |");
      if (legende) lines.push("", "*" + legende + "*");
      lines.push("");
    } else if (b.type === "para" && b.boxed) lines.push("> " + mdWrap(b.change, b.text), "");
    else lines.push(mdWrap(b.change, b.text), "");
  };
  // Les divisions s'écrivent en titres de niveau décroissant ; leur contenu
  // (articles, listes, tableaux) suit, récursivement.
  const emit = (n, depth = 0) => {
    switch (n.type) {
      case "title": lines.push("# " + n.text, ""); break;
      case "authority": lines.push("*" + n.text + "*", ""); break;
      case "visas": lines.push(...n.items.map((i) => "- " + [config.vocab.visasLabel, i.lien ? "[" + i.text + "](" + i.lien + ")" : i.text].join(" ")), ""); break;
      case "considerants":
        // Les considérants d'un bloc « en un seul alinéa » forment un seul
        // paragraphe de citation, comme au rendu.
        if (n.inline && n.items.length) lines.push("> " + n.items.map((i) => i.text).join(" "), "");
        else lines.push(...n.items.map((i) => "> " + i.text), "");
        break;
      case "enact": lines.push("**" + n.text + "**", ""); break;
      case "division": {
        lines.push("#".repeat(Math.min(6, 2 + depth)) + " " + [n.numLabel, n.heading].filter(Boolean).join(" – "), "");
        for (const b of n.blocks || []) emit(b, depth + 1);
        break;
      }
      case "annexes": {
        lines.push("#".repeat(Math.min(6, 2 + depth)) + " " + (config?.vocab?.annexe?.sectionTitle || "Annexes"), "");
        // `texte` porte déjà l'intitulé complet (« Annexe — … ») ; l'objet n'est
        // là qu'en repli (voir src/lib/annexes.js).
        for (const it of n.items || []) lines.push("- " + (it.texte || it.objet || "Annexe") + (it.lien ? " (" + it.lien + ")" : ""));
        lines.push("");
        break;
      }
      case "article": {
        lines.push("#".repeat(Math.min(6, 2 + depth)) + " " + n.numLabel + (n.heading ? " – " + n.heading : ""), "");
        if (!tracking) {
          const mention = amendmentMention(n, mentions, config);
          if (mention) lines.push("*" + mention + "*", "");
          if (n.change?.action === "abrogate") break;
        } else if (n.change) {
          lines.push(mdChangeNote(n.change), "");
        }
        for (const b of n.blocks || []) emitBloc(b);
        break;
      }
      // Un bloc de texte écrit hors de tout article — la rédaction peut en
      // ajouter un directement au corps de l'acte, ou dans une division.
      case "para":
      case "raw":
      case "list":
      case "table":
        emitBloc(n);
        break;
      case "signature":
        if (sansSignature) break;
        lines.push(`Fait à ${n.place}, le ${n.date}`, "", ...personRoleLines(n.signataire, config), personSignatureName(n.signataire), "");
        break;
      case "mention": lines.push("> " + n.text, ""); break;
      default: break;
    }
  };
  for (const n of doc.nodes) emit(n);
  // Les documents ANNEXÉS : l'original de l'acte d'adoption est SUIVI de leur
  // texte — une annexe ne se signe pas, c'est l'acte qui l'adopte qui est signé
  // et qui lui donne son autorité (voir src/lib/annexe-docs.js). Ils se lisent
  // donc ici, à la suite de l'acte, avant les notes de préparation (qui, elles,
  // n'appartiennent qu'à l'atelier).
  for (const joint of doc.annexeDocs || []) {
    lines.push("---", "", "**" + (joint.libelle || "Annexe") + "**", "");
    if (joint.doc) {
      lines.push(...exportMarkdown(joint.doc, config, { ...opts, notes: false, sansSignature: true }).split("\n"), "");
    }
  }
  // Les notes de préparation accompagnent les exports internes (c'est le
  // savoir-faire de l'atelier) ; l'appelant les écarte (`notes: false`) quand le
  // Markdown sert de représentation PUBLIÉE — elles ne font pas partie de
  // l'acte. Voir `src/ui/views/signature.js`.
  if (opts.notes !== false && doc.notes?.length) {
    lines.push("---", "", "## Notes de préparation", "");
    for (const n of doc.notes) lines.push(`- **[${n.kind}]**${n.quote ? " « " + n.quote + " »" : ""} ${n.text}${n.author ? " — " + n.author : ""}`);
  }
  if (tracking && doc.trail?.length) {
    lines.push("---", "", "## " + (doc.trailTitle || (config.vocab?.amendment?.trailTitle) || "Tableau des modifications"), "");
    for (const e of doc.trail) {
      lines.push(`**${e.designation || "Acte"} n° ${e.numero || "—"} du ${e.date || ""}**`, "");
      lines.push("| Article | Modification | Rédaction |", "| --- | --- | --- |");
      for (const it of e.items || []) lines.push(`| ${it.article || "—"} | ${it.actionLabel || ""} | ${String(it.detail || "").replace(/\|/g, "\\|")} |`);
      lines.push("");
    }
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}

const mdWrap = (ch, text) => {
  const t = String(text ?? "");
  if (!ch) return t;
  if (ch.kind === "del") return `~~${t}~~`;
  if (ch.kind === "ins") return `**${t}**`;
  return t;
};

const mdChangeNote = (ch) =>
  `*(modifié${ch.by ? " par " + ch.by : ""}${ch.date ? " le " + ch.date : ""})*`;

export function exportAknHtmlPreview(doc, config, trame) {
  const akn = exportAkn(doc, config, trame);
  return akn.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ==========================================================================
// Mise en page des documents — A4
//
// Un acte administratif se lit et s'imprime sur du papier A4 (21 × 29,7 cm).
// Le papier, ses marges et les règles de saut de page sont décrits une seule
// fois dans `paper.js` ; ils sont repris ici (HTML autonome, Word), dans
// l'aperçu de l'application (`src/css/app.css`), dans l'original signé
// (`signature.js`) et dans la version en ligne publiée (`eli.js`).
// ==========================================================================

// Feuille de style du document lui-même (le contenu de `.doc`), partagée par le
// HTML autonome et le fichier Word. Les règles de base ci-dessous sont la mise
// en page historique ; `styleCss` ajoute par-dessus l'habillage de la charte du
// document (police, couleurs, filets, encadrés…), qui l'emporte.
export function documentCss(config, style) {
  const docFont = style?.fontFamily || config.brand.documentFont || "serif";
  const uiFont = config.brand.uiFont || "system-ui, sans-serif";
  return `
.doc{font-family:${docFont};font-size:11pt;line-height:1.5;color:#111}
.doc-title{font-size:1.06em;font-weight:700;text-align:center;margin:0 0 .9em}
.doc-authority{margin:0 0 .8em}
.doc-visas{margin:0 0 .9em;padding-left:0;list-style:none}
.doc-visas li{text-align:justify;margin-bottom:.25em}
/* Une décision fondant la signature est un LIEN (recueil en ligne ou adresse
   externe) : il se signale par un soulignement discret, sans crier plus fort
   que le texte de l'acte. Le PDF imprimé depuis le navigateur garde le lien. */
.doc-visas-link{color:inherit;text-decoration:underline;text-decoration-color:#9aa0b4;text-underline-offset:2px}
.doc-visas-link:hover{text-decoration-color:currentColor}
.doc-recitals{margin:0 0 .9em}.doc-recitals p{text-align:justify;margin:0 0 .4em}
.doc-enact{text-align:center;font-weight:700;margin:1em 0}
.doc-article{margin-bottom:1em}
.doc-article-head{font-size:1em;font-weight:700;margin:0 0 .35em}
.doc-p{text-align:justify;margin:0 0 .55em}
.doc-list{margin:0 0 .7em;padding-left:1.4em}.doc-list li{text-align:justify;margin-bottom:.25em}
.doc-table-wrap{margin:0 0 .8em;overflow-x:auto}
.doc-table-caption{font-size:.9em;margin:0 0 .3em;font-style:italic}
.doc-table{border-collapse:collapse;width:100%;font-size:.92em}
.doc-table th,.doc-table td{border:1px solid #8993A5;padding:3px 6px;text-align:left;vertical-align:top}
.doc-table th{background:#f0f0f0}
.doc-signature{margin-top:1.6em;display:flex;justify-content:space-between;align-items:flex-end;gap:1em}
.doc-signature-place{margin:0}
.doc-signature-block{text-align:center;min-width:40%}
.doc-signature-role,.doc-signature-name{margin:0;white-space:pre-line}
.doc-mention{text-align:justify;font-size:.92em;margin:1em 0 0}
.doc-quote{margin:.3em 0 .7em;padding:0 0 0 14px;border-left:2px solid #c9c9c9}
.doc-quote::before{content:"\\00AB\\00A0"}
.doc-quote::after{content:"\\00A0\\00BB"}
.doc-ins{background:#e8f6ec;box-shadow:inset 0 0 0 1px #b8e0c4}
.doc-del{background:#fbeceb;box-shadow:inset 0 0 0 1px #f0c9c7}
.doc-del .doc-p,.doc-del p,.doc-del li,.doc-del h2{text-decoration:line-through;color:#7a7a7a}
.doc-mod{background:#fff8e6}
.doc-amend-mention{font-style:italic;font-size:.92em;color:#555;margin:-.15em 0 .55em}
.doc-consolidation{border:1px solid #d9c98b;background:#fffdf3;padding:10px 12px;margin:0 0 1.2em;font-family:${uiFont};font-size:.82rem}
.doc-consolidation__title{margin:0 0 4px;font-weight:700}
.doc-consolidation__notice,.doc-consolidation__meta{margin:0 0 3px}
.doc-consolidation__hint{margin:6px 0 0}
.doc-trail{margin-top:2.2em;border-top:1px solid #c9c9c9;padding-top:12px}
.doc-trail__title{font-size:.95em;margin:0 0 8px}
.doc-trail__entry{margin:.7em 0 .3em;font-weight:700;font-size:.9em}
.doc-trail__table{font-size:.8em}
/* Les réglages propres aux blocs (retrait et encadré d'un paragraphe, filets
   d'un tableau, légende au-dessous… — voir paramsBloc, src/lib/schema.js).
   Un réglage de BLOC est un choix explicite : il l'emporte sur la feuille de
   style. Les mêmes règles vivent dans l'aperçu (src/css/app.css) — les deux
   doivent rester d'accord. */
.doc .doc-p--boxed{border:1px solid var(--doc-rule,#8993A5);padding:.5em .7em}
.doc .doc-p--indent-first{text-indent:1.5em}
.doc .doc-p--indent-none{text-indent:0}
.doc .doc-p--indent-all{margin-left:1.5em}
.doc .doc-recitals--inline p{margin:0}
.doc .doc-table--rows th,.doc .doc-table--rows td{border:0;border-bottom:1px solid var(--doc-grid,#8993A5)}
.doc .doc-table--rows th{background:transparent;border-bottom:2px solid var(--doc-rule,#8993A5)}
.doc .doc-table--zebra tbody tr:nth-child(even){background:var(--doc-neutral,#f0f0f0)}
.doc .doc-table--center th,.doc .doc-table--center td{text-align:center}
.doc .doc-table--right th,.doc .doc-table--right td{text-align:right}
.doc-table-wrap > .doc-table + .doc-table-caption{margin:.3em 0 0}
/* La partie ANNEXÉE : l'annexe imprimée à la suite de l'acte qui l'adopte (voir
   src/lib/annexe-docs.js). Elle commence sur une PAGE neuve : l'acte se signe,
   puis les documents qu'il adopte suivent — sans signature à eux, puisque
   c'est celle de l'acte qui leur donne leur autorité. */
.doc-annexe-part{break-before:page;page-break-before:always;margin-top:18px}
.doc-annexe-part__head{border-top:1px solid #8993A5;padding-top:8px;margin:0 0 .9em}
.doc-annexe-part__label{font-size:.72em;text-transform:uppercase;letter-spacing:.08em;color:#555;margin:0}
.doc-annexe-part__title{font-weight:700;margin:.12em 0 0}
${style ? styleCss(style, config) : ""}
`;
}

// Le papier et ses marges sont décrits dans `paper.js` : aperçu, HTML autonome,
// Word, PDF et impression partagent le même A4.
export function exportStandaloneHtml(doc, config, trame) {
  const uiFont = config.brand.uiFont || "system-ui, sans-serif";
  const style = styleForDoc(config, doc);
  const rules = `
:root{--brand:${config.brand.color || "#000091"}}
*{box-sizing:border-box}
body{margin:0;background:#f6f6f6;color:#111;font-family:${uiFont};font-size:16px}
.wrap{width:${A4_WIDTH};max-width:100%;margin:0 auto;padding:24px 0 60px}
.paper{width:100%;min-height:${A4_HEIGHT};background:#fff;padding:${A4_MARGIN};box-shadow:0 1px 3px rgba(0,0,0,.12)}
.meta{border-left:3px solid var(--brand);padding:10px 14px;background:#fff;margin:0 0 18px;font-size:.85rem;color:#333}
.meta code{word-break:break-all}
${documentCss(config, style)}
${A4_BREAK_CSS}
@media (max-width:860px){.wrap{padding:12px 0 40px}.paper{padding:1.2cm 1cm;min-height:0}}
@media print{
  body{background:#fff}
  .wrap{width:auto;max-width:none;padding:0}
  .paper{width:auto;min-height:0;padding:0;box-shadow:none}
  .meta{display:none}
}
`;
  const meta = `<div class="meta">
    <strong>${esc(config.brand.name)} — acte compilé</strong><br>
    Référence ELI : <code>${esc(doc.meta.eli)}</code><br>
    Charte : ${esc(style.label || "feuille générale")}<br>
    Trame ${esc(doc.meta.trameName)} v${esc(doc.meta.trameVersion)} · généré le ${esc(doc.meta.generatedAt.slice(0, 10))}
  </div>`;
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>${esc(firstTitle(doc))}</title>
<style>${rules}</style>
</head><body><div class="wrap">${meta}<div class="paper">${documentToHtml(doc, config, { style })}</div></div></body></html>`;
}

// Word (.doc) : un document HTML que Word (comme LibreOffice ou OpenOffice)
// ouvre et met en page selon l'en-tête de section ci-dessous — A4 portrait,
// marges de 2 cm / 1,8 cm, même papier et même corps de texte que l'aperçu et
// que le PDF. Le format `.doc` (une page HTML balisée pour Word) évite le zip
// `.docx` : c'est le format d'échange des services, et il reste modifiable.
export function exportWordDoc(doc, config, trame) {
  const style = styleForDoc(config, doc);
  const docFont = style.fontFamily || config.brand.documentFont || "serif";
  // Word ne connaît ni `flex` ni `gap` : la signature est remise en deux
  // colonnes flottantes. Les fonds des versions consolidées (texte ajouté /
  // supprimé) sont réaffirmés, Word les interprétant avec ses propres règles.
  const wordLayout = `
body{margin:0;color:#111;font-family:${docFont};font-size:11pt;line-height:1.5}
.doc-signature{display:block;margin-top:1.6em}
.doc-signature-place{float:${style.signatureAlign === "left" ? "right" : "left"};width:48%;margin:0}
.doc-signature-block{float:${style.signatureAlign === "left" ? "left" : "right"};width:48%;min-width:0;text-align:center}
.doc-table-wrap{overflow:visible}
.doc-table th,.doc-table td{border:solid #8993A5 1pt}
.doc-consolidation{border:solid #d9c98b 1pt;background:#fffdf3}
.doc-ins{background:#e8f6ec}.doc-del{background:#fbeceb}
.doc-title{page-break-after:avoid}
/* L'annexe commence sur une page neuve, comme à l'impression (voir documentCss). */
.doc-annexe-part{page-break-before:always}
.doc-annexe-part__head{border-top:solid #8993A5 .75pt;padding-top:6px;margin:0 0 .8em}
.doc-annexe-part__label{font-size:.72em;text-transform:uppercase;letter-spacing:.08em;color:#555;margin:0}
.doc-annexe-part__title{font-weight:700;margin:.1em 0 0}
.doc-sheet-header{border:0;padding-bottom:6px}
.doc-sheet-header img{height:${style.logoHeight || "42"}px}
`;
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8">
<meta name="ProgId" content="Word.Document">
<meta name="Generator" content="${esc(config.brand.name || "Scribae")}">
<title>${esc(firstTitle(doc))}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
<style>
@page WordSection1{size:21.0cm 29.7cm;margin:${wordMargin(style)};mso-page-orientation:portrait;mso-header-margin:1.0cm;mso-footer-margin:1.0cm;mso-paper-source:0}
div.WordSection1{page:WordSection1}
${documentCss(config, style)}
${wordLayout}
</style></head>
<body lang="FR"><div class="WordSection1">${documentToHtml(doc, config, { style })}</div></body></html>`;
}

// Impression d'une page HTML autonome (acte compilé, original signé, version en
// ligne) : le document part dans un ONGLET DÉDIÉ, qui déclenche lui-même la
// boîte d'impression. C'est là tout l'intérêt : imprimer depuis la page de
// l'application (l'ancien repli « iframe cachée + window.print() ») FIGEAIT
// l'aperçu de l'éditeur tant que la boîte d'impression restait ouverte —
// `window.print()` bloque le fil d'exécution de la page qui l'appelle, et
// c'était donc celle de l'agent. Le repli n'imprime donc JAMAIS depuis ici : il
// télécharge la page, à charge pour l'agent de l'ouvrir et de l'imprimer.
//
// Renvoie le mode employé : "onglet", "telechargement" ou "echec".
export function printHtml(html, { titre = "" } = {}) {
  const page = avecImpressionAuto(html);
  let win = null;
  try { win = window.open("", "_blank"); } catch (e) { win = null; }
  if (win) {
    try {
      win.document.open();
      win.document.write(page);
      win.document.close();
      try { win.focus(); } catch (e) { /* le navigateur décide */ }
      return "onglet";
    } catch (e) { /* la fenêtre ne se laisse pas écrire : on télécharge */ }
  }
  try {
    download(nomPageImprimable(titre), page, "text/html");
    return "telechargement";
  } catch (e) {
    return "echec";
  }
}

// La page emporte son propre geste d'impression : c'est ELLE qui ouvre la boîte
// d'impression, une fois ses styles posés — jamais l'onglet de l'application.
function avecImpressionAuto(html) {
  const script = "<script>window.addEventListener(\"load\",function(){setTimeout(function(){try{window.print();}catch(e){}},250);});</" + "script>";
  const t = String(html || "");
  return /<\/body>/i.test(t) ? t.replace(/<\/body>/i, script + "</body>") : t + script;
}

const nomPageImprimable = (nom) => {
  const n = String(nom || "").trim().replace(/[^\w.-]+/g, "_");
  if (/\.html?$/i.test(n)) return n;
  return (n || "acte") + ".html";
};

// Le document compilé, prêt à imprimer (ou à enregistrer en PDF).
export function printDocument(doc, config, trame) {
  const base = String(doc?.meta?.numero || doc?.meta?.designation || "acte").replace(/[^\w-]+/g, "_");
  return printHtml(exportStandaloneHtml(doc, config, trame), { titre: base + ".html" });
}
