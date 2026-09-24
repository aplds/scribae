// ============================================================================
// Les publications LOCALES — ce que le recueil public montre quand le service
// se tait.
//
// Le recueil public lit le SERVICE de publication : un acte n'y est là que s'il
// a été réellement publié, et c'est le service qui attribue l'identifiant ELI et
// conserve l'original. Cette règle ne change pas, et ce module ne la remplace
// pas : il ne sert qu'à défaut.
//
// Pourquoi un défaut est nécessaire : la démonstration n'a pas toujours un
// service sous la main. L'aperçu de l'éditeur héberge un service qui se
// reconstruit et perd son état, une page servie hors ligne n'en a aucun, et un
// service qu'on vient de remettre en route répond « vide » — le recueil
// affichait alors « Aucun acte publié pour l'instant » alors que les actes de la
// fiction sont, eux, bel et bien publiés. Rien de ce qui est publié ne doit
// disparaître du recueil parce que le service est momentanément absent.
//
// La matière première est LOCALE et vient du service lui-même : l'enregistrement
// rendu à la publication est conservé sur l'acte qui l'a produite
// (`acte.publication` — voir `publier`, src/ui/views/signature.js, et
// `reprendre`, src/ui/demo-publications.js). Relire ces enregistrements n'est
// donc pas ouvrir une seconde source de vérité : c'est le même enregistrement,
// gardé au poste, relu quand le service ne répond pas.
//
// Module PUR : il ne touche ni au DOM, ni au service, ni au registre — il reçoit
// une liste d'actes et rend des enregistrements de publication.
// ============================================================================

import { niveauDepuisCircuit } from "./qualification-signature.js";

const texte = (v) => String(v == null ? "" : v);
const cmp = (a, b) => (texte(a) < texte(b) ? -1 : texte(a) > texte(b) ? 1 : 0);

// La signature d'un acte publié, telle que le recueil la présente. La publication
// du service fait foi quand elle est là ; à défaut — recueil d'une page statique,
// publication antérieure à la qualification — on la déduit de l'ACTE, qui porte
// le circuit employé (`signatureSimple`, `externe`, `signatureMode`, `api`).
function signatureDe(acte, p) {
  if (p && p.signature) return p.signature;
  const circuit = acte.signatureSimple || acte.signatureMode === "simple" || (acte.api && acte.api.niveau === "simple") ? "simple"
    : acte.externe || (acte.publication && acte.publication.originalExterne) ? "externe"
    : acte.api && acte.api.acteId ? "electronique"
    : "";
  const niveau = niveauDepuisCircuit(circuit);
  if (!niveau) return null;
  return {
    niveau,
    prestataire: null,
    signataires: acte.signeParNom ? [{ nom: acte.signeParNom, fonction: "" }] : [],
    signeLe: acte.signeLe || (acte.signatureSimple && acte.signatureSimple.signeLe) || "",
    algorithme: "",
  };
}

// Un acte PORTE une publication : le dépôt a été fait, le service a attribué
// l'identifiant ELI, et le registre local le dit « publié ». Un acte seulement
// signé, un brouillon, un acte à la corbeille : rien de tout cela n'appartient
// au recueil public — c'est la même règle que celle du service.
export const actePublie = (a) => !!a && !a.deletedAt && a.statut === "publie" && !!a.publication && !!a.publication.cle;

// La part « notice » d'une publication, telle que le service la rend
// (`resumePublication`, index.html) : c'est ce que le recueil lit pour dresser sa
// liste. Les champs absents de l'enregistrement local sont repris de l'acte —
// le registre local ne garde pas deux fois la même chose.
function noticeDe(acte) {
  const p = acte.publication || {};
  const eliUri = texte(p.eliUri || p.eli);
  return {
    cle: texte(p.cle),
    eli: eliUri,
    eliUri,
    url: texte(p.url),
    numero: texte(p.numero || acte.numero),
    nature: texte(p.nature || acte.nature),
    themeId: texte(p.themeId || acte.themeId),
    themeLabel: texte(p.themeLabel || acte.themeLabel),
    objet: texte(p.objet || acte.objet),
    entityName: texte(p.entityName),
    dateDocument: texte(p.dateDocument || acte.dateSignature),
    datePublication: texte(p.datePublication || acte.datePublication),
    dateOpposabilite: texte(p.dateOpposabilite || acte.dateOpposabilite),
    kind: texte(p.kind) || "originale",
    recueil: texte(p.recueil),
    publieeLe: texte(p.publieeLe),
    latest: true,
    epingle: p.epingle === true || acte.epingle === true,
    reserve: p.reserve === true,
    transmission: p.transmission || null,
    // La signature et sa QUALIFICATION : l'enregistrement de publication les
    // porte (« simple », « avancee », « qualifiee », « externe ») ; un
    // enregistrement antérieur — ou le recueil d'une page statique, où le
    // service peut manquer — les déduit de l'ACTE, qui sait par quel circuit il
    // a été signé. Sans cette reprise, un acte signé « en simple » se
    // présenterait sans mention, donc comme un acte signé tout court.
    signature: signatureDe(acte, p),
    versions: [],
    informative: p.informative === true,
    adoption: p.adoption || null,
    ...(p.juridique === false ? { juridique: false } : {}),
    ...(p.natureDoc ? { natureDoc: p.natureDoc } : {}),
    originalExterne: p.originalExterne || null,
  };
}

// Le registre local, rangé comme celui du service : les versions d'un même
// identifiant ELI vont ensemble, et la plus récente porte `latest` — c'est elle
// que le recueil présente, les précédentes restant consultables dans
// l'historique de la fiche de l'acte (voir `publicationLocale`).
//
// `reserveVue` dit ce que le LECTEUR a le droit de voir : un acte à diffusion
// restreinte n'appartient au recueil que pour un agent connecté venu d'un réseau
// autorisé — la règle du service, appliquée ici faute de mieux.
export function publicationsLocales(actes, { reserveVue = false } = {}) {
  const parEli = new Map();
  for (const acte of actes || []) {
    if (!actePublie(acte)) continue;
    const n = noticeDe(acte);
    if (n.reserve && !reserveVue) continue;
    const famille = n.eliUri || n.cle;
    if (!parEli.has(famille)) parEli.set(famille, []);
    parEli.get(famille).push(n);
  }
  const liste = [];
  for (const versions of parEli.values()) {
    versions.sort((a, b) => cmp(a.dateDocument, b.dateDocument) || cmp(a.publieeLe, b.publieeLe));
    versions.forEach((v, i) => { v.latest = i === versions.length - 1; });
    // Le service joint à chaque version la liste de ses sœurs (l'historique de
    // l'identifiant) : on la reconstitue sans jamais laisser un enregistrement
    // se contenir lui-même — le recueil la parcourt pour le bloc « Versions ».
    const historique = versions.map((v) => ({ ...v, versions: [] }));
    for (const v of versions) v.versions = historique;
    liste.push(...versions);
  }
  // Du plus récemment publié au plus ancien : l'ordre du recueil.
  liste.sort((a, b) => cmp(b.publieeLe || b.datePublication, a.publieeLe || a.datePublication));
  return liste;
}

// Les PIÈCES d'une publication : la version en ligne, le document Akoma Ntoso,
// le JSON-LD, le Markdown et le texte brut. Elles ont deux origines selon le
// chemin qui a mené à la publication :
//   • la fiche complète du service les range sous `formats` ;
//   • la réponse de DÉPÔT les pose à plat (`html`, `akn`…) — mais son propre
//     champ `formats`, lui, est la liste des types MIME offerts. Confondre les
//     deux fait disparaître le texte de l'acte : c'est pourquoi on ne lit
//     `formats` que lorsqu'il est bien un objet de pièces.
function piecesDe(p) {
  const enPlace = p && p.formats && !Array.isArray(p.formats) ? p.formats : {};
  return {
    html: texte(enPlace.html || p.html),
    akn: texte(enPlace.akn || p.akn),
    jsonld: texte(enPlace.jsonld || p.jsonld),
    md: texte(enPlace.md || p.md),
    texte: texte(enPlace.texte || p.texte),
  };
}

// La FICHE complète d'un acte publié : ce que le recueil affiche sur la page de
// l'acte — sa version en ligne, ses formats, son original signé. Le service la
// rend par `/v1/publications/{clé}` ; à défaut, l'enregistrement gardé sur l'acte
// porte les mêmes pièces (elles y ont été rangées à la publication).
export function publicationLocale(actes, cle, { reserveVue = false } = {}) {
  const c = texte(cle);
  if (!c) return null;
  const acte = (actes || []).find((a) => actePublie(a) && texte(a.publication.cle) === c);
  if (!acte) return null;
  const p = acte.publication;
  const rec = noticeDe(acte);
  if (rec.reserve && !reserveVue) return null;
  rec.formats = piecesDe(p);
  rec.original = p.original || null;
  // (La signature, et sa qualification, viennent de la notice : voir `signatureDe`.)
  rec.versions = publicationsLocales(actes, { reserveVue }).filter((x) => x.eliUri && x.eliUri === rec.eliUri);
  return rec;
}

// La liste locale des INFORMATIONS publiées : des billets, que le service ne
// connaît que s'ils lui ont été déposés (voir `amorcerInformations`,
// src/ui/demo-publications.js). Un brouillon n'y entre jamais — c'est la règle
// du recueil public, et elle vaut aussi ici.
export function informationsLocales(informations) {
  return (informations || []).filter((i) => i && i.publie === true);
}
