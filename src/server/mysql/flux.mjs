// ============================================================================
// LE FLUX DU SERVICE — « ce qui vient de changer », poussé aux postes.
//
// POURQUOI CE FICHIER EST PUR. Le hub du flux ne connaît ni HTTP, ni le magasin,
// ni Node : il reçoit des ABONNÉS (un objet qui sait écrire un texte et se
// fermer) et leur pousse des ÉVÈNEMENTS. C'est ce qui le rend éprouvable sans
// serveur, sans réseau et sans base — par `node --test` (flux.test.mjs) comme par
// le harnais d'épreuves du navigateur, qui importe ce module tel quel.
//
// CE QU'IL TRANSPORTE, ET CE QU'IL NE TRANSPORTE PAS. Un évènement porte le NOM
// de la collection qui a changé et sa RÉVISION :
//
//     { type: "collection", collection: "trames", revision: 57, ids: ["tpl-x"] }
//
// Jamais le contenu, jamais une valeur. C'est délibéré, et c'est ce qui rend le
// flux inoffensif : le poste qui le reçoit relit la collection par le chemin
// autorisé (session, jeton, réseau de l'atelier), et un flux divulgué ne dit rien
// de plus que l'état des compteurs, que la route de santé publie déjà.
//
// L'ABONNÉ LENT. Un poste dont le tampon d'écriture est plein (onglet en
// veille, réseau lent) ne doit ni bloquer le service, ni accumuler. Quand une
// écriture est refusée (`ecrire` rend `false`), l'évènement est ABANDONNÉ pour
// cet abonné, et il est marqué : à la première écriture qui repasse, il reçoit un
// `resync` — « relis tout ». Une reprise complète, bornée, vaut mieux qu'une file
// d'évènements sans fin.
// ============================================================================

// Garde-fous. Le nombre d'abonnés d'un service de collectivité se compte en
// dizaines ; la borne existe pour qu'un client qui ouvre des centaines de flux ne
// fasse pas tomber le service.
export const FLUX_MAX_ABONNES = 256;
// Battement de la connexion : un commentaire SSE écrit de loin en loin empêche
// un mandataire (nginx, proxy d'entreprise) de couper une connexion inactive.
export const FLUX_BATTEMENT_MS = 20000;

const texte = (evenement) => "data: " + JSON.stringify(evenement) + "\n\n";

export function creerFlux({ max = FLUX_MAX_ABONNES, journal = () => {} } = {}) {
  const abonnes = new Map();
  let suivant = 0;
  let publies = 0;
  let abandonnes = 0;

  // Abonne un poste. `ecrire(texte)` rend `false` quand le tampon est plein (un
  // `res.write` de Node rend exactement cela) : le hub le traite comme un abonné
  // lent, sans bloquer. Rend `null` quand le service a atteint sa borne.
  function abonner({ ecrire, fermer = () => {} } = {}) {
    if (typeof ecrire !== "function") return null;
    if (abonnes.size >= max) return null;
    suivant += 1;
    const id = "flux-" + suivant;
    abonnes.set(id, { id, ecrire, fermer, lent: false, at: Date.now() });
    return { id, retirer: () => retirer(id) };
  }

  function retirer(id) {
    const a = abonnes.get(id);
    if (!a) return false;
    abonnes.delete(id);
    try { a.fermer(); } catch (e) { journal("abonné " + id + " : fermeture en échec (" + e.message + ")"); }
    return true;
  }

  // L'écriture d'un évènement à UN abonné. Rend `true` s'il est parti.
  function ecrireA(a, t) {
    try {
      if (a.ecrire(t) === false) { a.lent = true; return false; }
      return true;
    } catch (e) {
      // La connexion est morte : on la retire plutôt que de la garder en vie.
      journal("abonné " + a.id + " : écriture en échec (" + e.message + ") — retiré");
      abonnes.delete(a.id);
      return false;
    }
  }

  // Publie un évènement à tous les abonnés. Rend le nombre de postes servis.
  function publier(evenement) {
    const t = texte(evenement);
    let n = 0;
    for (const a of [...abonnes.values()]) {
      // Un abonné marqué lent reçoit d'abord sa reprise : il a manqué au moins un
      // évènement, relire est la seule façon juste de le remettre d'aplomb.
      if (a.lent) {
        if (!ecrireA(a, texte({ type: "resync", raison: "évènements manqués" }))) continue;
        a.lent = false;
      }
      if (ecrireA(a, t)) n += 1;
      else abandonnes += 1;
    }
    publies += 1;
    return n;
  }

  // Appelé quand un abonné redevient écrivable (le `drain` d'une réponse Node) :
  // s'il avait manqué des évènements, on le lui dit TOUT DE SUITE.
  function rendre(id) {
    const a = abonnes.get(id);
    if (!a || !a.lent) return false;
    if (!ecrireA(a, texte({ type: "resync", raison: "tampon libéré" }))) return false;
    a.lent = false;
    return true;
  }

  // Le battement : un commentaire, qui ne réveille aucun traitement côté poste.
  function battement() {
    for (const a of [...abonnes.values()]) ecrireA(a, ": battement\n\n");
    return abonnes.size;
  }

  function fermerTous() {
    const n = abonnes.size;
    for (const a of [...abonnes.values()]) retirer(a.id);
    abonnes.clear();
    return n;
  }

  return {
    abonner,
    retirer,
    publier,
    rendre,
    battement,
    fermerTous,
    compter: () => abonnes.size,
    resume: () => ({ abonnes: abonnes.size, publies, abandonnes, max }),
  };
}
