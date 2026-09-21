// ============================================================================
// Les documents ANNEXÉS, joints à l'acte qui les adopte.
//
// Une annexe ne se signe pas : c'est l'acte qui l'adopte qui est signé, et
// c'est sa signature qui donne à l'annexe son autorité. L'original de l'acte
// d'adoption est donc SUIVI du document annexé — dans le même document, à la
// suite de la signature, sur une page à lui. C'est ce que dit ce module :
//
//   • `annexesJointes(values, registre)`  quels documents sont annexés à l'acte
//     (l'acte du registre et sa trame, puis son document compilé) ;
//   • `libellePartAnnexe(...)`            l'intitulé d'une annexe dans le
//     document (« Annexe — Règlement intérieur du conseil municipal »). Une
//     annexe n'a pas de numéro propre : voir src/lib/annexes.js.
//
// Le lien est noué à la RÉDACTION : `values.__annexes` porte l'identification
// figée de l'annexe (voir src/lib/annexes.js). L'identification ne dit que de
// quoi l'on parle ; le TEXTE, lui, vient de l'acte annexé lui-même — celui du
// registre, dont les valeurs ne bougent plus une fois enregistré (une
// modification produit un acte modificatif et une version consolidée, jamais
// une réécriture de l'acte d'origine).
//
// La résolution se fait donc au dernier moment, là où le registre est connu
// (`docOfActe` dans l'interface, la rédaction, l'amorçage de démonstration) :
// le document compilé porte alors `doc.annexeDocs`, et les sorties — écran,
// impression, HTML, Word, Markdown, Akoma Ntoso, original signé, version en
// ligne publiée — l'écrivent à la suite de l'acte, sans rien savoir du
// registre.
// ============================================================================
import { compile } from "./compile.js";
import { annexesDe, libelleAnnexe } from "./annexes.js";

// Les documents annexés à l'acte décrit par `values`. Une annexe sans acte au
// registre (identifiant vidé, acte supprimé, trame disparue) est simplement
// omise : le document ne peut pas joindre ce qu'il n'a pas.
//
// `acteId` est l'acte qui porte le lien : il est écarté de ses propres annexes
// (un acte ne s'annexe pas à lui-même).
export function annexesJointes(source, { actes, trames, config, acteId } = {}) {
  // `source` est soit les valeurs de l'acte (`values.__annexes`), soit
  // directement la liste d'identifications qu'un document porte déjà
  // (`doc.meta.annexes` — le cas d'un acte modificatif, dont le document est
  // bâti, non compilé).
  const out = [];
  for (const ref of (Array.isArray(source) ? source.filter(Boolean) : annexesDe(source))) {
    const id = ref && ref.acteId;
    if (!id || id === acteId) continue;
    const acte = (actes || []).find((a) => a && a.id === id && !a.deletedAt);
    if (!acte) continue;
    const trame = (trames || []).find((t) => t && t.id === acte.trameId);
    if (!trame) continue;
    let doc = null;
    try {
      doc = compile(trame, acte.values || {}, config, { overrides: acte.overrides });
    } catch (e) {
      continue;
    }
    // L'identification FIGÉE au moment où l'annexe a été jointe : c'est elle
    // qu'on imprime (elle porte la décision d'adoption, l'objet et la date),
    // même si l'annexe a changé depuis : le document d'adoption doit rester
    // celui qu'il était.
    out.push({ ref, acte, trame, doc, libelle: libellePartAnnexe(ref, acte, config) });
  }
  return out;
}

// L'intitulé de l'annexe, tel qu'il s'écrit dans le document de l'acte : le même
// que dans la liste des annexes — « Annexe — Règlement intérieur du conseil
// municipal ». Une annexe n'ayant pas de numéro, l'identification figée porte sa
// décision d'adoption, son objet et sa date, et c'est d'elle qu'on tire le nom.
export function libellePartAnnexe(ref, acte, config) {
  return libelleAnnexe(ref || acte, config);
}

