// ============================================================================
// LA REPRISE D'UN ACTE ANCIEN.
//
// Une collectivité qui installe Scribae ne part pas d'un recueil vide : elle a
// des décennies d'actes derrière elle, signés sur papier, publiés à l'affichage
// ou dans un bulletin qu'on ne trouve plus. La REPRISE les fait entrer au
// recueil, pour qu'ils se cherchent et se lisent comme les actes récents — mais
// elle ne les fait pas devenir autre chose que ce qu'ils sont.
//
// Trois règles, et elles tiennent ensemble :
//
//   1. C'est le RÉDACTEUR qui reprend l'acte, et il écrit son texte LIBREMENT.
//      Un acte ancien n'a pas été composé depuis une trame d'aujourd'hui : on ne
//      le fait pas entrer dans un formulaire qui n'existait pas. Le texte se
//      saisit, avec juste assez de repères pour que les articles se
//      reconnaissent (voir `analyserTexteLibre`).
//   2. La DATE DE PUBLICATION se règle À LA MAIN, et elle est nécessairement
//      antérieure au jour où la reprise est déposée. On ne republie pas un acte
//      de 1998 à la date d'aujourd'hui : le recueil mentirait sur sa chronologie
//      — et sur les délais qui courent à compter d'une publication.
//   3. L'ORIGINAL SIGNÉ est joint à la main : c'est le scan, ou le PDF, de la
//      pièce telle qu'elle a été signée. La reprise ne signe rien — elle
//      conserve la preuve de ce qui a été signé.
//
// Ce qui s'ensuit : une reprise est publiée IMMÉDIATEMENT, d'un seul geste, sans
// circuit de signature ni de validation, et elle est publiée À TITRE
// INFORMATIF — le recueil le dit en bas de page (voir `MENTION_REPRISE`). Le
// texte en ligne est une lecture pratique ; ce qui fait foi, c'est l'original
// joint.
//
// Une reprise peut être un ACTE, ou une ANNEXE AUTONOME (`annexe: true`) — un
// règlement intérieur, une charte, un texte qui se consulte pour lui-même. Dans
// les deux cas elle vit au recueil sous son propre identifiant : c'est
// précisément ce qu'une annexe ordinaire ne fait pas, parce qu'une annexe est
// adoptée par un acte, alors qu'un texte ancien repris n'a pas d'acte d'adoption
// dans l'application.
//
// Ce module est PUR : il ne touche ni au DOM, ni au réseau, ni au registre. Il
// dit ce qui est valide et compose le document ; l'écran fait le reste.
// ============================================================================

import { formatDate } from "./util.js";

// La nature technique d'une reprise, portée par l'acte du registre (`acte.kind`).
// Elle la distingue d'un acte rédigé (dont le document se recompile depuis une
// trame), d'un acte importé et d'une version consolidée.
export const KIND_REPRISE = "reprise";

export const estReprise = (a) => !!a && a.kind === KIND_REPRISE;

// Le libellé d'un genre de reprise : ce que le recueil annonce.
export const GENRES = {
  acte: { id: "acte", label: "Acte", short: "Acte", aide: "Un acte pris par l'autorité compétente : délibération, arrêté, décision…" },
  annexe: { id: "annexe", label: "Texte autonome (annexe)", short: "Texte autonome", aide: "Un texte qui se consulte pour lui-même — un règlement intérieur, une charte — et que le recueil publie à part." },
};

export const genreDe = (r) => (r && r.annexe ? GENRES.annexe : GENRES.acte);
export const GENRE_DEFAUT = "acte";

// ------------------------------------------------------------------ la date

// La date du jour en ISO (« AAAA-MM-JJ »). Elle vient du poste : la reprise est
// une saisie, pas une donnée du service.
export function dateDuJour(maintenant = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${maintenant.getFullYear()}-${p(maintenant.getMonth() + 1)}-${p(maintenant.getDate())}`;
}

// La date la PLUS RÉCENTE qu'une reprise peut porter : la veille du jour. La
// règle est stricte (« nécessairement antérieure ») : republier un acte ancien à
// la date du jour le ferait entrer dans le champ des délais de recours, et le
// recueil daterait d'aujourd'hui un acte de 1998.
export function dateMaxReprise(maintenant = new Date()) {
  const d = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate());
  d.setDate(d.getDate() - 1);
  return dateDuJour(d);
}

export function dateRepriseValide(date, { maintenant = new Date() } = {}) {
  const s = String(date || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return s < dateDuJour(maintenant);
}

// ------------------------------------------------------------------ contrôle

// Ce qui empêche de publier une reprise, dit champ par champ — l'écran les
// affiche sous les champs concernés, et refuse le geste s'il en reste un.
//   `numero`   l'identifiant d'origine : c'est lui qui bâtit l'ELI. Deux
//              reprises sans numéro porteraient la même adresse, et se
//              supplanteraient au recueil — on l'exige donc.
export function validerReprise(r, { maintenant = new Date() } = {}) {
  const erreurs = [];
  const pousser = (champ, message) => erreurs.push({ champ, message });
  if (!String(r?.titre || "").trim()) pousser("titre", "L'intitulé de l'acte est requis.");
  if (!String(r?.numero || "").trim()) pousser("numero", "Le numéro d'origine est requis : c'est lui qui donne à l'acte son adresse au recueil.");
  if (!String(r?.texte || "").trim()) pousser("texte", "Le texte de l'acte est requis.");
  if (!r?.datePublication) pousser("datePublication", "La date de publication d'origine est requise.");
  else if (!dateRepriseValide(r.datePublication, { maintenant })) pousser("datePublication", "La date de publication doit être antérieure à aujourd'hui (au plus tard le " + formatDate(dateMaxReprise(maintenant)) + ").");
  if (!r?.original?.url) pousser("original", "L'original signé doit être joint (PDF, ou image scannée).");
  return erreurs;
}

export const repriseValide = (r, opts) => validerReprise(r, opts).length === 0;

// ------------------------------------------------------------------ l'ELI

// Le type d'acte qui porte l'identifiant ELI : le type choisi pour un acte, et
// le RÈGLEMENT pour un texte autonome — un règlement intérieur repris n'est pas
// une délibération, et son adresse de recueil doit le dire (`eli:/fr/reg/…`).
export const actTypeEli = (r) => (r && r.annexe ? "reglement" : (r && r.actTypeId) || "acte");

// L'année du numéro d'origine, quand il en porte une (« 1998-042 » → 1998) :
// c'est l'année qui date l'acte au recueil, non celle du jour.
export const anneeDuNumero = (numero) => (String(numero || "").match(/(\d{4})/) || [])[1] || "";

// Empreinte courte (FNV-1a) : elle ne sert qu'à donner un numéro de séquence
// STABLE et distinctif à un acte ancien qui n'en porte pas — deux reprises sans
// numéro ne doivent pas se disputer la même adresse de recueil.
function empreinte4(s) {
  let h = 0x811c9dc5;
  for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return String(h % 10000).padStart(4, "0");
}

// Le numéro qui bâti l'identifiant ELI. Un acte ancien est numéroté à
// l'ancienne (« 1998-042 », « 1998/42 ») : on garde son numéro tel quel. Sinon
// on recompose une séquence : l'année vient du numéro ou, à défaut, de la date
// de publication ; la séquence, des chiffres restants ou d'une empreinte du
// numéro et du titre. L'ELI reste ainsi daté du bon siècle, et unique.
export function numeroPourEli(r) {
  const n = String(r?.numero || "").trim();
  const m = n.match(/^(\d{4})\s*[-/]\s*(\d+)/);
  if (m) return `${m[1]}-${m[2]}`;
  const anneeDunumero = (n.match(/\b(1[89]\d{2}|20\d{2})\b/) || [])[1] || "";
  const annee = anneeDunumero || String(r?.datePublication || "").slice(0, 4);
  const reste = n.replace(/\b(1[89]\d{2}|20\d{2})\b/, "");
  const chiffres = (reste.match(/\d+/) || [])[0] || "";
  const seq = chiffres || empreinte4(n + "|" + (r?.titre || ""));
  return annee ? `${annee}-${seq}` : n;
}

// ------------------------------------------------------------------ le texte

// La ligne d'un article : « Article 1er », « ARTICLE 12 — Durée », « Art. 5 :
// Objet ». Le numéro peut être un ordinal (« 1er », « premier »), un numéro
// bis/ter, ou « unique ». Il faut que TOUTE la ligne soit l'intitulé : une
// phrase qui commence par « Article 5 du règlement s'applique… » n'est pas un
// intitulé, et reste un paragraphe.
const RE_ARTICLE = /^(articles?|art\.?)\s+([0-9]+[^\s—–:\-]*|[^\s—–:\-]+)\s*(?:[—–:\-]\s*(.*))?$/i;
// Une division : « # TITRE I », « ## Chapitre 2 », « ### Section 1 ».
const RE_DIVISION = /^(#{1,3})\s+(.+?)\s*$/;
// Un élément de liste : « - … », « * … », « • … ».
const RE_ITEM = /^[-*•]\s+(.+)$/;

// L'intitulé d'un article, composé comme le fait le compilateur
// (`numberedLabel`, src/lib/compile.js) : « Article 1er », « Article 12 ».
function labelArticle(articleLabel, jeton) {
  const n = String(jeton || "").trim();
  const mot = n === "1" ? "1er" : n;
  return `${articleLabel} ${mot}`;
}

// Le texte libre saisi par le rédacteur, tourné en blocs de document.
//
// Le format est volontairement pauvre — il ne s'agit pas d'un langage, mais de
// trois repères qui suffisent à un acte ancien :
//
//   • une ligne blanche sépare les blocs ;
//   • une ligne qui commence par « # », « ## » ou « ### » ouvre une division
//     (titre, chapitre, section) ;
//   • une ligne qui est exactement un intitulé d'article (« Article 3 »,
//     « Article 3 — Objet ») ouvre un article ; les lignes qui suivent en sont
//     le texte, jusqu'à l'article suivant ;
//   • une ligne qui commence par « - », « * » ou « • » est un élément de liste.
//
// Tout le reste est un paragraphe : les lignes consécutives se replient en un
// seul paragraphe, comme dans un texte. C'est ce qui permet de coller le texte
// d'un acte sans le réécrire.
export function analyserTexteLibre(texte, { articleLabel = "Article" } = {}) {
  const nodes = [];
  // La pile des conteneurs ouverts : une division (niveau 1 à 3) ou un article
  // (niveau « infini », donc refermé par toute division). C'est le bloc courant
  // qui reçoit ce qui suit.
  const pile = [];
  const cible = () => (pile.length ? pile[pile.length - 1].node.blocks : nodes);
  let para = [];
  let items = [];
  const viderPara = () => { if (para.length) { cible().push({ type: "para", text: para.join(" ") }); para = []; } };
  const viderItems = () => { if (items.length) { cible().push({ type: "list", items: items.map((t) => ({ text: t })) }); items = []; } };
  const vider = () => { viderPara(); viderItems(); };

  for (const brut of String(texte || "").replace(/\r\n?/g, "\n").split("\n")) {
    const ligne = brut.trim();
    if (!ligne) { vider(); continue; }

    const div = RE_DIVISION.exec(ligne);
    if (div) {
      vider();
      const level = div[1].length;
      while (pile.length && pile[pile.length - 1].level >= level) pile.pop();
      const node = { type: "division", level, heading: div[2], blocks: [] };
      cible().push(node);
      pile.push({ level, node });
      continue;
    }

    const art = RE_ARTICLE.exec(ligne);
    if (art) {
      vider();
      // Un article referme l'article précédent, et vit dans la division
      // courante — il n'ouvre pas de division à lui.
      while (pile.length && pile[pile.length - 1].level > 3) pile.pop();
      const node = { type: "article", numLabel: labelArticle(articleLabel, art[2]), heading: art[3] || "", blocks: [] };
      cible().push(node);
      pile.push({ level: Infinity, node });
      continue;
    }

    const item = RE_ITEM.exec(ligne);
    if (item) { viderPara(); items.push(item[1]); continue; }

    viderItems();
    para.push(ligne);
  }
  vider();
  return nodes;
}

// Le document d'une reprise : un titre, puis le texte analysé. Il ne porte ni
// autorité ni visa ni signature — le rédacteur écrit ce qu'il veut, et l'acte
// ancien n'est pas re-signé ici. `eliHttp` est l'adresse de recueil (elle sert
// aux exports, notamment Akoma Ntoso).
export function docReprise(reprise, { config = {}, entity = null, eliHttp = "" } = {}) {
  const r = reprise || {};
  const titre = String(r.titre || "").trim();
  const type = (config.actTypes || []).find((t) => t.id === (r.annexe ? "reglement" : r.actTypeId));
  const nodes = [];
  if (titre) nodes.push({ type: "title", text: titre });
  nodes.push(...analyserTexteLibre(r.texte, { articleLabel: (config.vocab && config.vocab.articleLabel) || "Article" }));
  return {
    kind: KIND_REPRISE,
    meta: {
      numero: r.numero || "",
      objet: r.objet || titre,
      designation: type?.label || r.designation || "Acte",
      actTypeId: r.annexe ? "reglement" : (r.actTypeId || "decision"),
      familyId: r.familyId || "",
      nature: "acte",
      entity: entity || undefined,
      org: entity || undefined,
      autorite: "",
      signataire: null,
      dateSignature: r.datePublication || "",
      dateEffet: "",
      eli: eliHttp || "",
      generatedAt: new Date().toISOString(),
    },
    nodes,
    notes: [],
    issues: [],
    ecarts: [],
  };
}

// ------------------------------------------------------------------ la mention

// Ce que le lecteur DOIT savoir, et qui revient au bas de la page publiée :
// l'acte est là pour être connu, pas pour fonder un droit devant un juge. Une
// reprise n'a pas été signée par l'application, sa publication ne fait courir
// aucun délai, et seul l'original conservé par la collectivité fait foi.
export const MENTION_REPRISE =
  "Acte publié à titre informatif uniquement : il s'agit de la reprise d'un acte antérieur à la mise en service du recueil. "
  + "La présente version en ligne n'a pas de valeur juridique propre et n'ouvre aucun délai de recours ; "
  + "seul l'original signé, conservé par la collectivité et joint à cette page, fait foi.";

// La variante courte, pour une vignette ou une ligne de liste.
export const MENTION_REPRISE_COURTE = "Acte publié à titre informatif (reprise d'un acte antérieur).";
