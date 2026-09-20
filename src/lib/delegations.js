// ============================================================================
// Délégations de signature — et l'accord des qualités en genre.
//
// Deux besoins distincts, réunis ici parce qu'ils parlent du même objet : qui
// signe, et de quel droit.
//
// 1. ACCORD EN GENRE. « Le maire » ou « La maire », « Le directeur général des
//    services » ou « La directrice générale des services ». Chaque rôle porte
//    donc ses deux formes (`m` et `f`), la personne dit son genre (déduit de sa
//    civilité, ou forcé — une femme maire peut tenir à « le maire »), et l'on
//    compose l'article : « le »/« la » selon le genre, « l' » devant une
//    voyelle (c'est alors la même forme pour les deux).
//
// 2. CHAÎNE DE DÉLÉGATIONS. Une autorité délègue à quelqu'un, qui
//    sous-délègue — en principe interdit, en pratique dérogatoire. L'acte signé
//    au bout de la chaîne doit dire par quel chemin on y est arrivé :
//
//        Le Maire,
//        Par délégation, l'adjoint au maire en charge de l'urbanisme,
//        Par subdélégation, le chef de bureau Urbanisme,
//        Claire FAURE
//
//    Seul le nom du signataire est imprimé : les qualités des étages
//    intermédiaires sont écrites, mais pas les noms de ceux qui les portent.
//    Chaque étage tient son pouvoir de DÉCISIONS (la délibération donnant
//    délégation au maire, l'arrêté qui nomme l'adjoint, celui qui le
//    sous-délègue…) : renseignées, elles sont visées automatiquement sur l'acte,
//    dans l'ordre de la chaîne. Un DÉLÉGATAIRE en a DEUX — celle qui le nomme à
//    sa fonction et celle qui lui donne la délégation — et l'acte publie leur
//    lien ; l'autorité de tête n'en a qu'une, celle qui fonde son pouvoir.
//    Chacune de ces décisions se désigne d'un acte publié au recueil (le lien
//    est celui du recueil en ligne) ou d'un lien externe. Sans elles deux, la
//    délégation ne s'établit pas : le signataire n'est pas configuré.
//
// Une personne peut recevoir plusieurs délégations (le DGS pour les ressources
// humaines, le DGS pour les finances). `chaineDeSignature` choisit alors celle
// qui relève de l'organisation de l'acte, puis celle qui nomme la famille de la
// trame, puis le type d'acte, puis la plus générale — et à égalité, la première
// déclarée.
//
// 3. AUTORITÉS AUTONOMES. Toutes les chaînes ne descendent pas du maire : un
//    établissement public (un office, un centre de gestion, un syndicat) a sa
//    propre autorité de tête — le président de son conseil d'administration —
//    et sa propre chaîne, parallèle et indépendante de celle de la commune. Une
//    personne sans délégation EST une autorité de tête : son rôle lui donne sa
//    qualité, et l'entité qu'elle engage donne sa formule d'autorité.
// ============================================================================

import { uid, todayIso } from "./util.js";
import { adresseActe } from "./recueil.js";

// ------------------------------------------------------------------- genre
// « f » ou « m ». `accord` sur la personne force la réponse : c'est le cas par
// cas que la civilité ne règle pas (une femme maire appelée « le maire »).
export function genreDe(personne) {
  if (personne?.accord === "m" || personne?.accord === "f") return personne.accord;
  const c = String(personne?.civility || "").toLowerCase();
  if (c.startsWith("madame") || c.startsWith("mme") || c.startsWith("mlle")) return "f";
  return "m";
}

const VOYELLE = /^[aàâäeéèêëiîïoôöuùûüyh]/i;

// « le maire », « la maire », « l'adjoint », « l'adjointe ».
export function avecArticle(qualite, genre, { majuscule = false } = {}) {
  const q = String(qualite || "").trim();
  if (!q) return "";
  const phrase = VOYELLE.test(q) ? "l'" + q : (genre === "f" ? "la " : "le ") + q;
  return majuscule ? phrase.charAt(0).toUpperCase() + phrase.slice(1) : phrase;
}

// Qualité brute (sans article) d'un rôle, accordée en genre.
export function qualiteDeRole(config, roleId, genre = "m") {
  const r = (config?.roles || []).find((x) => x.id === roleId);
  if (!r) return "";
  const propre = genre === "f" ? r.f : r.m;
  return String(propre || r.m || r.f || r.label || "").trim();
}

// Qualité d'une personne quand aucune délégation ne la qualifie autrement : son
// premier rôle — ou celui qu'on lui DÉSIGNE. C'est le cas quand le rédacteur a
// choisi une fonction précise (voir src/lib/fonctions.js) : une personne qui
// porte plusieurs rôles signe alors sous celui de la fonction retenue.
export function qualitePersonne(config, personne, roleId = "") {
  if (!personne) return "";
  const id = roleId || (personne.roles || [])[0];
  return qualiteDeRole(config, id, genreDe(personne)) || personne.fonction || "";
}

// -------------------------------------------------------------- délégations
export function newDelegation(patch = {}) {
  return {
    id: uid("del"),
    fromId: "",          // le délégant : l'autorité qui délègue
    toId: "",            // le délégataire
    qualiteM: "",        // « adjoint au maire en charge de l'urbanisme »
    qualiteF: "",
    matieres: "",        // à quoi elle sert (texte libre, pour les humains)
    familyId: "",        // famille de trames concernée (facultatif : cible le choix)
    actTypeId: "",       // type d'acte concerné (facultatif)
    entityId: "",        // organisation dans le nom de laquelle elle est donnée
    // LES DEUX DÉCISIONS qui fondent la délégation — voir plus bas. Chacune se
    // désigne d'un acte publié au recueil (`…Cle`), d'une référence du
    // référentiel (`…RefId`) ou d'un lien externe (`…Url`), et porte son
    // intitulé (`nomination`, `acte`). `…Source` dit LAQUELLE des trois — elle
    // est rangée, pour qu'un choix encore vide (« acte publié », mais pas encore
    // choisi) ne se confonde pas avec « non renseignée ». Sans les deux
    // décisions, la délégation ne s'établit pas : le signataire n'est pas
    // configuré.
    nominationRefId: "", // la décision de nomination, dans le référentiel
    nomination: "",      // son intitulé
    nominationCle: "",   // …ou l'acte publié au recueil qui la porte
    nominationUrl: "",   // …ou l'adresse d'un lien externe
    nominationSource: "", // "publication" | "lien" | "ref" | ""
    acteRefId: "",       // la décision de délégation, dans le référentiel
    acte: "",            // son intitulé
    acteCle: "",         // …ou l'acte publié au recueil qui la porte
    acteUrl: "",         // …ou l'adresse d'un lien externe
    acteSource: "",      // "publication" | "lien" | "ref" | ""
    du: "",
    au: "",
    active: true,
    ...patch,
  };
}

const personneParId = (config, id) => (config?.people || []).find((p) => p.id === id) || null;

// L'organisation dans le nom de laquelle la délégation est donnée. C'est celle
// du délégant — on délègue dans le cadre de l'organisation dont on relève — sauf
// mention explicite (`entityId`). C'est ce qui rend les chaînes INDÉPENDANTES :
// la chaîne d'un établissement autonome (le président de son conseil
// d'administration, puis son directeur) ne se mêle jamais à celle de la commune,
// même quand une même personne y tient des délégations des deux côtés.
export function entiteDeDelegation(config, del) {
  if (!del) return "";
  if (del.entityId) return del.entityId;
  return personneParId(config, del.fromId)?.entityId || "";
}

export function qualiteDeDelegation(del, genre = "m") {
  if (!del) return "";
  const propre = genre === "f" ? del.qualiteF : del.qualiteM;
  return String(propre || del.qualiteM || del.qualiteF || "").trim();
}

export function enVigueur(del, date = todayIso()) {
  if (del.active === false) return false;
  if (del.du && String(del.du) > date) return false;
  if (del.au && String(del.au) < date) return false;
  return true;
}

// Les délégations qui aboutissent à cette personne (elle en est le délégataire).
export function delegationsVers(config, personId, date = todayIso()) {
  return (config?.delegations || []).filter((d) => d.toId === personId && enVigueur(d, date));
}

// La délégation convient-elle à cet acte ? Renvoie son « poids » — d'autant plus
// élevé qu'elle est précise — ou −1 quand elle est hors sujet. Deux règles :
// une délégation donnée dans une organisation ne vaut que pour les actes de
// cette organisation (c'est elle qui rend les chaînes indépendantes), et une
// délégation qui nomme une famille ou un type d'acte ne vaut que pour eux.
// Sert à la fois à choisir la délégation d'un signataire
// (`meilleureDelegation`) et à ne proposer que les fonctions pertinentes
// (src/lib/fonctions.js).
export function scoreDelegation(config, d, { familyId = "", actTypeId = "", entityId = "" } = {}) {
  let n = 0;
  const entite = entiteDeDelegation(config, d);
  if (entite && entityId) {
    if (entite === entityId) n += 8;      // la délégation vise cette organisation
    else return -1;                       // une autre organisation : hors sujet
  } else if (entite) n += 1;              // acte sans entité : on ne tranche pas
  if (d.familyId || d.actTypeId) {
    if (d.familyId && d.familyId === familyId) n += 4;
    else if (d.familyId) return -1;                       // nomme une autre famille
    if (d.actTypeId && d.actTypeId === actTypeId) n += 2;
    else if (d.actTypeId) return -1;                      // nomme un autre type
  } else n += 1;                                          // délégation générale
  return n;
}

// Celle qui s'applique à cet acte : la plus précise (famille, puis type d'acte,
// puis générale). À égalité, l'ordre de déclaration tranche.
function meilleureDelegation(config, personId, opts = {}) {
  const { date = "", ...scope } = opts;
  // Une délégation ne vaut qu'à la date de l'acte : on ne se sert pas, pour un
  // acte de mars, d'une délégation donnée en juin.
  const cands = delegationsVers(config, personId, date || todayIso());
  if (!cands.length) return null;
  const tries = cands.map((d) => ({ d, n: scoreDelegation(config, d, scope) }))
    .filter((x) => x.n >= 0).sort((a, b) => b.n - a.n);
  return (tries[0] || { d: null }).d;
}

// ------------------------------------------------------------ la chaîne
// Du sommet (l'autorité qui a tout délégué) jusqu'au signataire.
// Chaque étape : { person, delegation, niveau }. `delegation` est nulle pour
// l'étape de tête (elle n'a pas été nommée par une délégation, elle est la
// source du pouvoir).
//
// `opts.roleId` désigne le rôle sous lequel le SIGNAITAIRE signe, quand le
// rédacteur a choisi sa fonction (voir src/lib/fonctions.js) : il n'a d'effet
// que si le signataire est lui-même l'autorité de tête — sinon, la qualité
// imprimée vient de la délégation, qui est un fait du référentiel.
export function chaineDeSignature(config, personId, opts = {}) {
  if (!personId) return [];
  const liens = [];
  const vus = new Set();
  let courant = personId;
  for (let i = 0; i < 8; i++) {
    if (!courant || vus.has(courant)) break;   // cycle : on s'arrête là
    vus.add(courant);
    const d = meilleureDelegation(config, courant, opts);
    if (!d) break;
    liens.push({ delegation: d, delegataireId: courant, delegantId: d.fromId });
    courant = d.fromId;
  }
  liens.reverse();   // du sommet vers le signataire

  const etapes = [];
  if (!liens.length) {
    const p = personneParId(config, personId);
    return p ? [{ person: p, delegation: null, niveau: 0, qualite: qualitePersonne(config, p, opts.roleId) }] : [];
  }
  const tete = personneParId(config, liens[0].delegantId);
  if (tete) etapes.push({ person: tete, delegation: null, niveau: 0, qualite: qualitePersonne(config, tete) });
  liens.forEach((l, i) => {
    const p = personneParId(config, l.delegataireId);
    if (!p) return;
    const g = genreDe(p);
    etapes.push({
      person: p,
      delegation: l.delegation,
      niveau: i + 1,
      qualite: qualiteDeDelegation(l.delegation, g) || qualitePersonne(config, p, opts.roleId),
    });
  });
  return etapes;
}

// Les lignes de qualité, telles qu'elles s'impriment au-dessus du nom :
//
//   Le Maire,
//   Par délégation, l'adjoint au maire en charge de l'urbanisme,
//   Par subdélégation, le chef de bureau Urbanisme,
export function lignesQualites(config, personId, opts = {}) {
  return lignesDepuisEtapes(chaineDeSignature(config, personId, opts));
}

function lignesDepuisEtapes(etapes) {
  return etapes.map((e, i) => {
    const g = genreDe(e.person);
    const phrase = avecArticle(e.qualite, g, { majuscule: i === 0 });
    if (i === 0) return phrase;
    return (i === 1 ? "Par délégation, " : "Par subdélégation, ") + phrase;
  });
}

// ============================================================================
// Les DÉCISIONS fondant la signature.
//
// Chaque étage de la chaîne tient son pouvoir d'une décision. Pour un
// DÉLÉGATAIRE, il en faut DEUX : celle qui l'a NOMMÉ à sa fonction (l'arrêté de
// nomination de l'adjoint, la délibération qui l'a élu) et celle qui lui a donné
// la DÉLÉGATION de signer. L'autorité de tête, elle, n'en a qu'une : celle qui
// fonde son pouvoir — une délibération du conseil, une élection.
//
// Ces décisions ne sont pas de simples mentions : elles sont des LIENS. On les
// désigne d'un acte PUBLIÉ au recueil — le lien est alors l'adresse du recueil
// en ligne — ou d'un lien externe (le texte est ailleurs : site de la
// collectivité, Légifrance, intranet), ou encore d'une référence du référentiel
// quand celle-ci porte son adresse de source. Dans tous les cas, l'acte publié
// porte l'INTITULÉ et le LIEN : sur le web comme en PDF, le lecteur clique.
//
// Une délégation dont l'une des deux décisions manque NE S'ÉTABLIT PAS : le
// signataire n'est pas configuré (voir `decisionsManquantes` — c'est ce que
// l'écran Délégations refuse de créer, et ce que le contrôle de conformité
// signale sur l'acte).
// ============================================================================

// Les deux décisions d'une délégation. `base` est le nom du champ qui porte
// l'INTITULÉ ; les trois autres champs se déduisent de lui.
export const CHAMPS_DECISION = {
  nomination: { refId: "nominationRefId", cle: "nominationCle", url: "nominationUrl", libelle: "décision de nomination" },
  acte: { refId: "acteRefId", cle: "acteCle", url: "acteUrl", libelle: "décision de délégation" },
};

// L'ordre dans lequel elles se visent : on est nommé avant d'être délégué.
export const DECISIONS = ["nomination", "acte"];

export const libelleChampDecision = (base) => CHAMPS_DECISION[base]?.libelle || base;

// Intitulé d'une décision : la référence du référentiel si elle est désignée,
// sinon le texte libre. Liste vide si l'on n'a rien à viser.
export function libelleDecision(config, refId, texte = "") {
  if (refId) {
    const r = (config?.refs || []).find((x) => x.id === refId);
    if (r && r.label) return String(r.label).trim();
  }
  return String(texte || "").trim();
}

// Un champ d'une décision, quelle que soit la délégation (vide si elle n'existe
// pas encore : une fiche neuve se remplit avant d'entrer au référentiel).
const champDecision = (d, base, quoi) => String((d && CHAMPS_DECISION[base] ? d[CHAMPS_DECISION[base][quoi]] : "") || "").trim();

// D'où vient la décision : un acte publié au recueil, une référence du
// référentiel, un lien externe — ou rien. Le choix est RANGÉ (`…Source`) ; à
// défaut, et pour les délégations enregistrées avant que le champ n'existe, il
// se déduit de celui des trois qui est rempli.
export function sourceDeDecision(d, base) {
  if (!CHAMPS_DECISION[base]) return "";
  const rangee = String((d && d[base + "Source"]) || "").trim();
  if (rangee === "publication" || rangee === "lien" || rangee === "ref") return rangee;
  if (champDecision(d, base, "cle")) return "publication";
  if (champDecision(d, base, "url")) return "lien";
  if (champDecision(d, base, "refId")) return "ref";
  return "";
}

// L'intitulé tel qu'il s'imprime dans un visa (« Vu l'arrêté du… »).
export function intituleDecision(config, d, base) {
  if (!CHAMPS_DECISION[base]) return "";
  return libelleDecision(config, champDecision(d, base, "refId"), String((d && d[base]) || "").trim());
}

// L'adresse de source d'une référence du référentiel (voir Administration ›
// Références) : c'est le lien que portera le visa.
export function lienDeReference(config, refId) {
  if (!refId) return "";
  const r = (config?.refs || []).find((x) => x.id === refId);
  return String(r?.source || "").trim();
}

// L'adresse de la décision : le lien externe s'il est donné, sinon le recueil de
// l'acte publié, sinon l'adresse de source de la référence. Vide = aucune : il
// n'y a alors rien à cliquer, et la décision n'est pas renseignée.
export function lienDecision(config, d, base) {
  if (!CHAMPS_DECISION[base]) return "";
  const url = champDecision(d, base, "url");
  if (url) return url;
  const cle = champDecision(d, base, "cle");
  if (cle) return adresseActe(cle);
  return lienDeReference(config, champDecision(d, base, "refId"));
}

// Une décision est RENSEIGNÉE quand elle s'imprime (un intitulé) ET qu'elle se
// suit (un lien) : c'est ce que l'acte publiera.
export function decisionRenseignee(config, d, base) {
  const intitule = intituleDecision(config, d, base);
  const lien = lienDecision(config, d, base);
  const manque = [];
  if (!intitule) manque.push("intitulé");
  if (!lien) manque.push("lien");
  return { base, libelle: libelleChampDecision(base), intitule, lien, ok: manque.length === 0, manque };
}

// Ce qui manque à une délégation pour s'établir. Vide = elle est complète, et le
// signataire qu'elle désigne est configuré.
export function decisionsManquantes(config, d) {
  if (!d) return [];
  return DECISIONS.map((b) => decisionRenseignee(config, d, b)).filter((x) => !x.ok);
}

export const delegationComplete = (config, d) => decisionsManquantes(config, d).length === 0;

// Les décisions visées par un acte signé au bout de la chaîne, dans l'ordre de
// la chaîne et, pour chaque délégataire, sa nomination puis sa délégation. Une
// décision déjà visée par un étage supérieur n'est pas répétée.
export function decisionsDeSignature(config, personId, opts = {}) {
  const etapes = chaineDeSignature(config, personId, opts);
  const out = [];
  const pousser = (x) => {
    if (!x.label || out.some((d) => d.label === x.label)) return;
    out.push(x);
  };
  for (const e of etapes) {
    for (const d of decisionsDunEtape(config, e)) {
      pousser({ niveau: e.niveau, base: d.base, refId: d.refId, label: d.label, lien: d.lien, acteur: nomComplet(e.person) });
    }
  }
  return out;
}

// Les décisions d'un étage de la chaîne : la nomination puis la délégation pour
// un délégataire, le fondement du pouvoir pour l'autorité de tête.
function decisionsDunEtape(config, e) {
  if (!e.delegation) {
    const refId = String(e.person?.fondementRefId || "").trim();
    const label = libelleDecision(config, refId, "");
    return label ? [{ base: "fondement", refId, label, lien: lienDeReference(config, refId) }] : [];
  }
  return DECISIONS
    .map((b) => ({ ...decisionRenseignee(config, e.delegation, b), refId: champDecision(e.delegation, b, "refId") }))
    .filter((x) => x.intitule)
    .map((x) => ({ base: x.base, refId: x.refId, label: x.intitule, lien: x.lien }));
}

const nomComplet = (p) => [p?.civility, p?.firstName, p?.lastName].filter(Boolean).join(" ");

// ============================================================================
// Ce que la compilation pose dans le contexte sous `signataire` : le signataire
// enrichi — genre, qualité accordée, chaîne complète, décisions visées, lignes
// prêtes à imprimer, et l'autorité de tête (celle dont le pouvoir descend, celle
// que nomme l'acte dans sa formule d'autorité).
// ============================================================================
export function enrichirSignataire(config, personne, opts = {}) {
  if (!personne) return null;
  let etapes = chaineDeSignature(config, personne.id, opts);
  if (!etapes.length) {
    etapes = [{ person: personne, delegation: null, niveau: 0, qualite: qualitePersonne(config, personne, opts.roleId) }];
  }
  const tete = etapes[0];
  const dernier = etapes[etapes.length - 1];
  const genre = genreDe(personne);
  const qualite = dernier.qualite || qualitePersonne(config, personne, opts.roleId);
  const nomDe = (p) => [p.civility, p.firstName, p.lastName].filter(Boolean).join(" ");
  return {
    ...personne,
    genre,
    qualite,
    qualiteArticle: avecArticle(qualite, genre),
    qualiteArticleMaj: avecArticle(qualite, genre, { majuscule: true }),
    fonction: qualite,
    delegue: etapes.length > 1,
    // Vrai quand le signataire est lui-même l'autorité de tête : aucune
    // délégation ne le rattache à une autre. C'est le cas d'une autorité
    // autonome (le président d'un conseil d'administration), comme celui d'un
    // signataire isolé — dans les deux cas, l'acte ne porte pas de mention
    // « Par délégation ».
    autonome: etapes.length <= 1,
    autorite: {
      id: tete.person.id,
      nom: nomDe(tete.person),
      genre: genreDe(tete.person),
      qualite: tete.qualite,
      qualiteArticle: avecArticle(tete.qualite, genreDe(tete.person)),
      qualiteArticleMaj: avecArticle(tete.qualite, genreDe(tete.person), { majuscule: true }),
      // L'organisation dont cette autorité relève : la « tête » de la chaîne
      // n'est pas nécessairement celle de la commune.
      entiteId: tete.person.entityId || "",
    },
    chaine: etapes.map((e) => ({
      niveau: e.niveau,
      id: e.person.id,
      nom: nomDe(e.person),
      genre: genreDe(e.person),
      qualite: e.qualite,
      qualiteArticle: avecArticle(e.qualite, genreDe(e.person)),
      delegationId: e.delegation?.id || null,
      acte: libelleDecision(config, e.delegation?.acteRefId, e.delegation?.acte || ""),
      nomination: e.delegation ? libelleDecision(config, e.delegation.nominationRefId, e.delegation.nomination || "") : "",
      // Les décisions de CET étage, avec leur lien : c'est ce que l'acte publie.
      decisions: decisionsDunEtape(config, e),
    })),
    // Les délégations de la chaîne dont une des deux décisions manque : le
    // pouvoir de signer ne s'établit pas par elles (voir le contrôle de
    // conformité, et l'écran Délégations qui refuse de les créer).
    delegationsIncompletes: etapes
      .filter((e) => e.delegation)
      .map((e) => ({ acteur: nomDe(e.person), delegationId: e.delegation.id || "", manque: decisionsManquantes(config, e.delegation).map((x) => x.libelle) }))
      .filter((x) => x.manque.length),
    // Les décisions fondant la signature : par étage de la chaîne, et dans
    // l'ordre du sommet vers le signataire, la nomination puis la délégation
    // — c'est ce que l'acte vise (« Vu … »).
    decisions: decisionsDeSignature(config, personne.id, opts),
    qualites: lignesDepuisEtapes(etapes),
  };
}

// ------------------------------------------------------------------ lecture
// L'arbre des délégations tel qu'on l'affiche : chaque racine (une autorité qui
// délègue sans avoir reçu de délégation) porte ses délégataires, qui portent les
// leurs. La profondeur n'est pas limitée — les sous-délégations sont
// dérogatoires, pas impossibles.
export function arbreDelegations(config) {
  const del = (config?.delegations || []);
  const enfants = new Map();
  for (const d of del) {
    if (!enfants.has(d.fromId)) enfants.set(d.fromId, []);
    enfants.get(d.fromId).push(d);
  }
  const delegataires = new Set(del.map((d) => d.toId));
  const racines = [...enfants.keys()].filter((id) => !delegataires.has(id));
  const brancher = (personId, niveau, vus) =>
    (enfants.get(personId) || []).map((d) => {
      const p = personneParId(config, d.toId);
      const suite = p && !vus.has(p.id) ? brancher(p.id, niveau + 1, new Set([...vus, p.id])) : [];
      return { delegation: d, person: p, niveau, entiteId: entiteDeDelegation(config, d), enfants: suite };
    });
  return racines.map((id) => ({
    person: personneParId(config, id),
    id,
    entiteId: personneParId(config, id)?.entityId || "",
    niveau: 0,
    enfants: brancher(id, 1, new Set([id])),
  })).filter((r) => r.person);
}
