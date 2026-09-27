// ============================================================================
// LE DÉPÔT DES PIÈCES — les fichiers joints à un acte.
//
// Deux pièces se déposent dans Scribae, et ce module est leur seul point de
// dépôt :
//
//   • l'ORIGINAL SIGNÉ d'une reprise d'acte ancien (le scan du papier) ;
//   • la VERSION SIGNÉE d'un acte mené par le CIRCUIT EXTERNE (le PDF signé
//     hors de l'application).
//
// DEUX DÉPÔTS POSSIBLES, et une seule décision :
//
//   • l'hôte de la plateforme (`root.uploadPlugin`) quand il en offre un : c'est
//     le dépôt de l'édition en ligne, il range le fichier hors de l'application
//     et rend une adresse durable ;
//   • le SERVICE (`POST /v1/pieces`), sinon.
//
// POURQUOI LE SECOND EXISTE. Une installation auto-hébergée n'a pas de
// plateforme de fichiers sous la main : `root.uploadPlugin` n'y existe pas. Un
// dépôt qui ne connaissait que lui échouait donc TOUJOURS en auto-hébergement,
// sur un « root.uploadPlugin is not a function » que le rédacteur ne pouvait ni
// comprendre ni contourner — c'est le défaut que ce module corrige. Le service
// range la pièce à part de son état (voir src/server/mysql/magasin.mjs) et la
// sert à son adresse (`GET /v1/pieces/{id}`), que le client garde sur l'acte et
// que le recueil public cite comme l'original.
//
// UN SEUL FORMAT D'ÉCHANGE : du JSON, avec le contenu en base64. Le canal temps
// réel de l'édition en ligne ne transporte pas de binaire, et l'API REST lit son
// corps en UTF-8 : le base64 est ce qui marche des deux côtés, sans qu'un même
// dépôt ait deux formes selon l'hébergement.
//
// LES LIMITES DIFFÈRENT SELON LE TRANSPORT, et elles se refusent AVANT l'envoi,
// avec un message qui dit quoi faire :
//   • HTTP : le corps d'une requête est borné par `MAX_BODY` du service (8 Mio
//     par défaut), soit environ 5,5 Mo de fichier une fois le base64 passé ;
//   • canal temps réel : un message est borné à 1 Mio, soit environ 600 Ko.
// ============================================================================

import { post, del, bodyOf, errorMessage, transportHTTP } from "./remote.js";
import { hostUpload } from "./hosts.js";

// Les plafonds de fichier, avec une marge sous ceux du transport (le base64
// gonfle de 4/3, et le corps JSON porte aussi le nom, le type et l'empreinte).
export const LIMITE_HTTP = 5500000;    // ≈ 7,4 Mo de corps JSON (MAX_BODY : 8 Mio)
export const LIMITE_SOCKET = 600000;   // ≈ 800 Ko de base64 (message : 1 Mio)

export const limiteDepot = () => (transportHTTP() ? LIMITE_HTTP : LIMITE_SOCKET);

// La même limite, en clair — pour la dire AVANT que le rédacteur ne choisisse
// son fichier (l'aide sous le champ), et non seulement après l'échec.
export const limiteLisible = () => (limiteDepot() / (1024 * 1024)).toFixed(1) + " Mo";

const enMo = (octets) => (Number(octets) / (1024 * 1024)).toFixed(1) + " Mo";

// La limite du moment, dite de façon actionnable : « quel dépôt, quel plafond,
// et quoi faire pour aller au-delà ». Un refus muet (« dépôt impossible ») ne
// laissait aucune prise au rédacteur.
function messageTropLourd(taille) {
  if (transportHTTP()) {
    return `Fichier trop volumineux (${enMo(taille)}) : ce service accepte au plus ${enMo(LIMITE_HTTP)} par pièce. `
      + "Pour relever ce plafond, augmentez MAX_BODY dans le .env du service (et client_max_body_size dans la configuration nginx), puis recréez le conteneur.";
  }
  return `Fichier trop volumineux (${enMo(taille)}) : cet hébergement ne dispose pas de dépôt de fichiers et range les pièces dans l'application, `
    + `qui accepte au plus ${enMo(LIMITE_SOCKET)}. Déployez le service auto-hébergé (voir la documentation Docker) pour déposer des pièces plus lourdes.`;
}

// Refuse AVANT toute lecture du fichier : on ne calcule pas l'empreinte d'un
// scan de 200 Mo qu'on s'apprêtera à refuser. Lève une erreur lisible.
export function verifierTaille(fichier) {
  const taille = Number((fichier && fichier.size) || 0);
  const limite = limiteDepot();
  if (taille > limite) throw new Error(messageTropLourd(taille));
  return taille;
}

// Le contenu d'un fichier, en base64. Par TRANCHES : `String.fromCharCode(...)`
// sur plusieurs millions d'arguments dépasse la pile d'appel du navigateur.
async function base64De(fichier) {
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const TRANCHE = 0x8000;
  let binaire = "";
  for (let i = 0; i < octets.length; i += TRANCHE) {
    binaire += String.fromCharCode.apply(null, octets.subarray(i, i + TRANCHE));
  }
  return btoa(binaire);
}

// Dépose une pièce et rend de quoi la citer : son ADRESSE (à mettre sur l'acte,
// dans `url`), son empreinte, son nom, sa taille, son type — et, quand c'est le
// service qui la range, son IDENTIFIANT (`pieceId`), qui permet de la retirer.
//
// `sha256` est l'empreinte déjà calculée par l'appelant (l'écran l'affiche avant
// le dépôt) ; à défaut, elle n'est pas renvoyée. Le service la range telle
// qu'on la lui déclare : c'est l'application qui lit le fichier, pas lui.
export async function deposerPiece(fichier, { sha256 = "", token = null } = {}) {
  if (!fichier) throw new Error("Aucun fichier à déposer.");
  verifierTaille(fichier);
  const nom = String(fichier.name || "piece");
  const type = String(fichier.type || "application/octet-stream");
  const taille = Number(fichier.size || 0);

  const hote = hostUpload();
  if (hote) {
    const up = await hote(fichier);
    if (!up || up.error || !up.url) {
      throw new Error("Le dépôt du fichier a été refusé par le service de fichiers de l'hébergement"
        + (up && up.error ? " (" + up.error + ")" : "") + ".");
    }
    return { url: up.url, sha256, nom, taille, type };
  }

  const base64 = await base64De(fichier);
  const res = await post("/v1/pieces", { nom, type, taille, sha256, base64 }, { token, label: "Dépôt d'une pièce" });
  if (!res.ok) throw new Error(errorMessage(res));
  const p = bodyOf(res);
  if (!p.url) throw new Error("Le service n'a pas rendu d'adresse pour la pièce déposée.");
  return {
    url: p.url,
    sha256: p.sha256 || sha256,
    nom: p.nom || nom,
    taille: Number(p.taille) || taille,
    type: p.type || type,
    ...(p.id ? { pieceId: p.id } : {}),
  };
}

// Retire une pièce que le service avait rangée (son identifiant vient de
// `deposerPiece`). C'est un geste de PROPRETÉ — le rédacteur retire l'original
// qu'il venait de joindre —, et il est sans effet si la pièce est déjà citée par
// un acte ou une publication : le service le refuse (409 `piece_referencee`),
// car la retirer laisserait une page du recueil avec un lien mort. On ne fait
// donc pas échouer l'appelant : on rend `false` et l'on continue.
export async function supprimerPiece(pieceId, { token = null } = {}) {
  const id = String(pieceId || "");
  if (!id) return false;
  try {
    const res = await del(`/v1/pieces/${encodeURIComponent(id)}`, { token, label: "Retrait d'une pièce" });
    return res.ok;
  } catch (e) {
    return false;
  }
}
