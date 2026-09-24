// ============================================================================
// La signature d'un jeton d'identité (JWS) : RS256/384/512, PS256/384/512,
// ES256/384. C'est la seule opération cryptographique du service qui ne soit pas
// du mot de passe, et c'est celle qui décide si l'annuaire a bien signé ce qu'il
// annonce.
//
// POURQUOI CE MODULE EST À PART. Le port de cryptographie du service vit dans
// `server.mjs` (`cryptoPort`) — c'est là que `node:crypto` est employé, une fois
// pour toutes. La vérification d'une signature de jeton y est importée d'ici
// plutôt qu'écrite sur place, pour une seule raison : ÊTRE ÉPROUVÉE. Le module
// ne dépend que de `node:crypto` — ni base, ni réseau, ni serveur HTTP —, si
// bien qu'une épreuve peut engendrer une VRAIE paire de clés, signer un VRAI
// jeton, et vérifier que le service l'accepte… puis le refuse dès qu'on touche à
// la signature, à l'algorithme ou aux revendications (voir jws.test.mjs).
//
// CE QUI ARRIVE ICI. `alg` est l'algorithme annoncé par l'EN-TÊTE du jeton —
// c'est-à-dire par celui qu'il faut vérifier, donc jamais une autorité ; `cle`
// est une JWK publiée par le fournisseur (`jwks_uri`) ; `donnees` est la chaîne
// signée (« en-tête.revendications », telle quelle, non décodée) ; `signature`
// est la troisième partie du jeton, en base64url.
//
// LES TROIS FAMILLES, ET LEURS PIÈGES.
//   • RS* : RSA, PKCS#1 v1.5. C'est ce que publient le plus souvent Keycloak,
//     LemonLDAP::NG, ADFS, Azure AD ;
//   • PS* : RSA-PSS, avec la longueur de sel de l'algorithme (256 → 32 octets,
//     etc.). Le défaut de Node (sel maximal) ne vérifierait RIEN : la longueur
//     fait partie de ce qui est signé ;
//   • ES* : ECDSA. Le jeton porte la signature en `r‖s` brut (JWS), alors que
//     Node attend du DER par défaut : sans `dsaEncoding: "ieee-p1363"`, une
//     signature parfaitement valide serait refusée — panne silencieuse et
//     difficile à voir.
//
// CE QUI EST REFUSÉ, ET POURQUOI. Tout algorithme hors de ces trois familles
// rend `false` : `none` (jeton non signé — le classique), `HS*` (signature
// symétrique : elle supposerait un secret partagé, que ni ce service ni un
// client public ne détiennent), et tout ce qui n'est pas reconnu. Un JWK dont la
// famille ne correspond pas à l'algorithme rend `false`. Aucun chemin ne rend
// `true` sans avoir vérifié une signature.
//
// La clé n'est jamais conservée : elle est reçue, présentée au constructeur, et
// oubliée.
// ============================================================================
import * as nodeCrypto from "node:crypto";

export const ALGORITHMES_SIGNATURE = ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384"];

export function verifierJws({ alg, cle, donnees, signature } = {}) {
  const a = String(alg || "").toUpperCase();
  const famille = a.startsWith("PS") ? "ps" : a.startsWith("RS") ? "rs" : a.startsWith("ES") ? "es" : "";
  const taille = a.slice(2);
  const hash = { "256": "sha256", "384": "sha384", "512": "sha512" }[taille];
  // ES512 (P-521) n'est pas dans la liste : rien ne l'interdit techniquement,
  // mais aucun fournisseur d'administration rencontré ne le publie — s'il
  // apparaissait, mieux vaut refuser que vérifier à moitié.
  if (!famille || !hash || (famille === "es" && taille === "512")) return false;
  if (typeof nodeCrypto.createVerify !== "function" || typeof nodeCrypto.createPublicKey !== "function") return false;

  // Les JWK publiés portent souvent des membres d'usage (`use`, `alg`, `kid`,
  // `x5c`, `key_ops`…). On ne présente au constructeur que ceux qui DÉCRIVENT la
  // clé : un membre inconnu fait échouer l'import chez certains Node.
  const k = cle && String(cle.kty) === "RSA" && famille !== "es" ? { kty: "RSA", n: cle.n, e: cle.e }
    : cle && String(cle.kty) === "EC" && famille === "es" ? { kty: "EC", crv: cle.crv, x: cle.x, y: cle.y }
      : null;
  if (!k) return false;

  const brut = Buffer.from(String(signature || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");
  try {
    const publique = nodeCrypto.createPublicKey({ key: k, format: "jwk" });
    const verificateur = nodeCrypto.createVerify(hash);
    verificateur.update(String(donnees), "utf8");
    verificateur.end();
    if (famille === "rs") return verificateur.verify({ key: publique, padding: nodeCrypto.constants.RSA_PKCS1_PADDING }, brut);
    if (famille === "ps") return verificateur.verify({ key: publique, padding: nodeCrypto.constants.RSA_PKCS1_PSS_PADDING, saltLength: Number(taille) / 8 }, brut);
    return verificateur.verify({ key: publique, dsaEncoding: "ieee-p1363" }, brut);
  } catch (e) {
    // Une clé illisible, un `alg` incohérent avec la clé (RS256 sur une clé EC,
    // par exemple) : c'est un refus, pas une panne. On ne journalise pas la clé.
    return false;
  }
}

export default verifierJws;
