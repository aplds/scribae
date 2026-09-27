// ============================================================================
// SIGNATURE INTERNE (serveur) — la clé vit sur le serveur, et n'en sort jamais.
//
// Jusqu'ici, toutes les signatures de Scribae se décidaient dans le navigateur :
// la clé privée était engendrée par le POSTE (signature « simple », ou
// prestataire simulé), et le service ne faisait que vérifier une empreinte. Cela
// suffit à prouver l'intégrité, pas à tenir une clé à l'abri : elle est dans le
// navigateur, exportable, et rien ne l'empêche d'en sortir.
//
// Ce module est l'autre voie : le SERVICE détient la clé privée du signataire,
// scellée au repos, et c'est lui qui signe. Le navigateur ne voit jamais la clé
// — seulement l'original signé, sa clé PUBLIQUE et son certificat.
//
// CE QUI EN FAIT UNE SIGNATURE « AVANCÉE » (eIDAS, art. 26) :
//   • la clé privée est sous le contrôle exclusif du signataire (le service agit
//     pour lui, la clé ne quitte pas le coffre) ;
//   • le certificat identifie le signataire et est ÉMIS par une autorité ;
//   • la signature est liée au document (elle porte sur l'Akoma Ntoso et son
//     empreinte SHA-256), et toute altération la rompt.
// Elle n'est QUALIFIÉE que si l'autorité d'émission est un prestataire de
// confiance qualifié (voir `qualification-signature.js`) : ce module sait tenir
// aussi bien un émetteur interne qu'un certificat d'AC qualifiée.
//
// POURQUOI W E B C R Y P T O, ET NON `node:crypto` :
//   • la signature produite ici doit être vérifiable par le RECUEIL PUBLIC, qui
//     tourne dans un navigateur (`verifySignedPackage`) — or le navigateur attend
//     une signature ECDSA au format IEEE P1363 (r‖s concaténés), quand
//     `node:crypto` rend du DER ; et sa clé publique au format JWK ;
//   • `crypto.subtle` existe des DEUX côtés (navigateur, et Node ≥ 18) : le même
//     code signe au service et se vérifie au recueil, sans conversion ;
//   • le port est INJECTÉ (`{ subtle }`), comme partout ailleurs dans le service :
//     ce module reste PUR et s'éprouve sans Node.
//
// CE QUE CE MODULE NE FAIT PAS : il n'écrit rien de lui-même, n'ouvre aucun
// fichier, ne connaît ni Node ni le réseau. Le COFFRE qu'il remplit est un objet
// ordinaire qui lui est INJECTÉ (il vit dans l'état durable du service) ; la clé
// de scellement vient du `.env` (`SCRIBA_SIGNATURE_KV_KEY`) ; le journal est une
// fonction reçue. Les routes qui décident QUI signe sont dans `actes.mjs`, le
// branchement des ports dans `server.mjs`, et la fabrique `createSignatureInterne`
// ci-dessous tient la règle du coffre — une seule fois, pour les deux services.
// ============================================================================

export const ID_SERVICE = "scribae-interne";
export const ALGORITHME = "ECDSA P-256 / SHA-256";
export const FORMAT_ORIGINAL = "application/vnd.actes.original-signe+json";
export const FORMAT_DOSSIER = "application/vnd.actes.dossier-signature+json";

// La validité d'un certificat interne. Large par défaut : un acte signé il y a
// deux ans doit rester vérifiable aujourd'hui, et le certificat embarqué dans
// l'original ne se renouvelle pas.
export const VALIDITE_JOURS = 365 * 5;

// ---------------------------------------------------------------------------
// LE PORT WEB CRYPTO — la seule dépendance du module, et elle est injectée.
//
// Rend des fonctions qui travaillent sur des CHAÎNES (base64, hex) plutôt que
// sur des objets : c'est ce que manipulent le coffre (JSON) et l'original signé,
// et cela rend le port trivial à substituer dans une épreuve.
// ---------------------------------------------------------------------------
export function portWebcrypto(subtle) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const b64 = (octets) => {
    let s = "";
    const u8 = new Uint8Array(octets);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  const deb64 = (texte) => Uint8Array.from(atob(String(texte || "")), (c) => c.charCodeAt(0));
  const hex = (octets) => [...new Uint8Array(octets)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const importPrivee = (jwk) => subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const importPublique = (jwk) => subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);

  return {
    b64,
    deb64,
    hex,
    texte: (octets) => decoder.decode(new Uint8Array(octets)),

    bytesAleatoires(n) {
      const u = new Uint8Array(n);
      crypto.getRandomValues(u);
      return u;
    },

    async sha256Hex(texte) {
      return hex(await subtle.digest("SHA-256", encoder.encode(String(texte ?? ""))));
    },

    // Une paire ECDSA P-256, exportée en JWK : la publique voyage dans le
    // certificat, la privée va au coffre (scellée).
    async genererPaire() {
      const paire = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      return {
        publique: await subtle.exportKey("jwk", paire.publicKey),
        privee: await subtle.exportKey("jwk", paire.privateKey),
      };
    },

    // Signature ECDSA : `subtle.sign` rend du P1363 (r‖s), ce qu'attend le
    // recueil. Rien à convertir.
    async signer(jwkPrivee, texte) {
      const cle = await importPrivee(jwkPrivee);
      return b64(await subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cle, encoder.encode(String(texte ?? ""))));
    },

    async verifier(jwkPublique, texte, valeurB64) {
      try {
        const cle = await importPublique(jwkPublique);
        return await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, cle, deb64(valeurB64), encoder.encode(String(texte ?? "")));
      } catch (e) {
        return false;
      }
    },

    // Scellement au repos : AES-256-GCM, avec l'IV devant et le tag derrière.
    // La clé (32 octets) est fournie par le service (`SCRIBA_SIGNATURE_KV_KEY`).
    async sceller(clair, cleOctets) {
      const cle = await subtle.importKey("raw", cleOctets, { name: "AES-GCM" }, false, ["encrypt"]);
      const iv = this.bytesAleatoires(12);
      const chiffre = await subtle.encrypt({ name: "AES-GCM", iv }, cle, encoder.encode(clair));
      const u8 = new Uint8Array(chiffre);
      return b64(iv) + ":" + b64(u8);
    },

    async desceller(cache, cleOctets) {
      const [ivB64, corpsB64] = String(cache || "").split(":");
      if (!ivB64 || !corpsB64) throw new Error("Sceau illisible");
      const cle = await subtle.importKey("raw", cleOctets, { name: "AES-GCM" }, false, ["decrypt"]);
      const clair = await subtle.decrypt({ name: "AES-GCM", iv: deb64(ivB64) }, cle, deb64(corpsB64));
      return decoder.decode(new Uint8Array(clair));
    },
  };
}

// ---------------------------------------------------------------------------
// LA CLÉ DE SCELLEMENT — lire `SCRIBA_SIGNATURE_KV_KEY`, la refuser si faible.
//
// Le déploiement peut l'écrire en hexadécimal (64 caractères) ou en base64 :
// les deux se rencontrent dans la nature, et exiger l'une plutôt que l'autre
// n'apporte rien. Rend 32 octets, ou `null` (sceau impossible → mode éteint).
// ---------------------------------------------------------------------------
export function cleDeScellement(texte) {
  const s = String(texte || "").trim();
  if (!s) return null;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return Uint8Array.from(s.match(/../g).map((o) => parseInt(o, 16)));
  try {
    const octets = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    return octets.length === 32 ? octets : null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LES IDENTITÉS — une paire clé + son certificat.
//
// Une clé par SIGNATAIRE (et une pour l'horodatage du service), pas une par
// acte : un certificat qui change à chaque document ne dirait rien de
// l'identité de celui qui signe. Le certificat est embarqué dans chaque
// original, donc il reste vérifiable même si le coffre disparaît.
// ---------------------------------------------------------------------------
export const SUJET = (nom, org, brand) => `CN=${nom || "Signataire"}, OU=${org || brand || "Collectivité"}, O=${brand || "Collectivité"}, C=FR`;
export const EMETTEUR = (brand, autorite) => autorite || `CN=Autorité de certification interne — ${brand || "Collectivité"}, O=${brand || "Collectivité"}, C=FR`;

// `kind` : « signataire » (un signataire donné) ou « horodatage » (le service).
export async function genererIdentite(crypto, {
  kind = "signataire",
  nom = "",
  org = "",
  brand = "",
  autorite = "",
  usage = "",
  valideJours = VALIDITE_JOURS,
  maintenant = new Date(),
} = {}) {
  const paire = await crypto.genererPaire();
  const sujet = kind === "horodatage"
    ? `CN=Horodatage du service — ${brand || "Collectivité"}, O=${brand || "Collectivité"}, C=FR`
    : SUJET(nom, org, brand);
  const numeroSerie = crypto.hex(crypto.bytesAleatoires(8)).toUpperCase();
  const du = new Date(maintenant.getTime() - 1000 * 60 * 60 * 24 * 365 * 3);
  const au = new Date(maintenant.getTime() + 1000 * 60 * 60 * 24 * valideJours);
  const certificat = {
    version: "3",
    sujet,
    emetteur: EMETTEUR(brand, autorite),
    numeroSerie,
    algorithme: ALGORITHME,
    valideDu: du.toISOString(),
    valideAu: au.toISOString(),
    usage: usage || (kind === "horodatage"
      ? "Horodatage d'actes administratifs (service de la collectivité)"
      : "Signature électronique de documents (service de la collectivité)"),
    clePublique: paire.publique,
  };
  certificat.empreinte = await crypto.sha256Hex(JSON.stringify({ sujet: certificat.sujet, ser: numeroSerie, cle: paire.publique }));
  return { kind, certificat, jwk: { publique: paire.publique, privee: paire.privee } };
}

// ---------------------------------------------------------------------------
// L'ORIGINAL SIGNÉ — la MÊME forme que `buildSignedPackage` (src/lib/signature.js).
//
// C'est la contrainte qui rend la signature interne utilisable : le recueil, la
// page « original signé », la vérification et la part publique (`sansInterne`)
// s'appliquent sans une ligne de plus. Seul l'émetteur change — et il est dit.
// ---------------------------------------------------------------------------
export async function signerDocument(crypto, {
  akn,
  identite,
  horodatageIdentite,
  signataire = {},
  reference = "",
  objet = "",
  brand = "",
  niveau = "avancee",
  signeLe = "",
  interne = null,
} = {}) {
  const empreinte = await crypto.sha256Hex(akn || "");
  const dateSignature = signeLe || new Date().toISOString();
  const valeur = await crypto.signer(identite.jwk.privee, akn || "");

  let horodatage = null;
  if (horodatageIdentite) {
    const jeton = empreinte + "|" + dateSignature;
    horodatage = {
      emisPar: "Horodatage du service (signature interne)",
      emisLe: dateSignature,
      algorithme: ALGORITHME,
      empreinte,
      valeur: await crypto.signer(horodatageIdentite.jwk.privee, jeton),
      certificat: horodatageIdentite.certificat,
    };
  }

  const pack = {
    format: FORMAT_ORIGINAL,
    version: 1,
    reference: reference || "",
    objet: objet || "",
    document: { akn: akn || "", sha256: empreinte },
    signatures: [{
      signataire,
      signeLe: dateSignature,
      algorithme: ALGORITHME,
      valeur,
      certificat: identite.certificat,
    }],
    horodatage,
    prestataire: { id: ID_SERVICE, nom: "Signature interne du service", niveau },
  };
  if (interne) pack.interne = { format: FORMAT_DOSSIER, version: 1, ...interne };
  return pack;
}

// ---------------------------------------------------------------------------
// LA VÉRIFICATION — même contrat que `verifySignedPackage` (mêmes libellés, même
// forme de résultat), pour que le service puisse éprouver un original qu'il a
// produit sans dépendre du navigateur.
// ---------------------------------------------------------------------------
export async function verifierOriginal(crypto, pack) {
  const checks = [];
  if (!pack || !pack.document) {
    return { ok: false, checks: [{ label: "Structure de l'original", ok: false, detail: "Document illisible" }] };
  }
  const empreinte = await crypto.sha256Hex(pack.document.akn || "");
  checks.push({
    label: "Intégrité du document",
    ok: empreinte === pack.document.sha256,
    detail: `SHA-256 ${empreinte.slice(0, 16)}… ${empreinte === pack.document.sha256 ? "correspond à l'empreinte signée" : "NE CORRESPOND PAS"}`,
  });
  for (const s of pack.signatures || []) {
    const ok = await crypto.verifier((s.certificat || {}).clePublique, pack.document.akn || "", s.valeur);
    checks.push({
      label: `Signature — ${(s.signataire && s.signataire.nom) || "signataire"}`,
      ok,
      detail: `${s.algorithme || ALGORITHME} · ${ok ? "clé publique du certificat" : "signature invalide pour cette clé"}`,
    });
  }
  const h = pack.horodatage;
  if (h) {
    const ok = await crypto.verifier((h.certificat || {}).clePublique, `${h.empreinte}|${h.emisLe}`, h.valeur);
    checks.push({ label: "Horodatage", ok, detail: `${h.emisPar || ""} · ${ok ? "cohérent avec l'empreinte" : "invalide"}` });
  }
  return { ok: checks.every((c) => c.ok), checks };
}

// ============================================================================
// LE COFFRE ET LA FABRIQUE DU SERVICE.
//
// `createSignatureInterne` assemble ce que le service branche : le port
// WebCrypto, la clé de scellement, le COFFRE (un objet ordinaire de l'état
// durable), et le journal. Elle rend l'objet que `actes.mjs` appelle pour
// signer — et rien de plus : elle ne connaît ni route, ni session, ni réseau.
//
// LE COFFRE ne contient que des clés SCELLÉES (AES-256-GCM) et des certificats
// PUBLICS : il s'écrit donc tel quel dans l'état du service, et un sauvegarde de
// la base ne livre pas de clé privée en clair. Une clé de scellement perdue (ou
// changée) ne compromet pas les actes déjà signés : leur certificat voyage avec
// l'original, et le certificat porte la clé publique qui vérifie la signature.
// Elle oblige en revanche à en engendrer une nouvelle — et le journal le dit.
//
// POURQUOI UNE CLÉ PAR SIGNATAIRE, ET NON PAR ACTE : un certificat qui change à
// chaque document ne dirait rien de l'identité de celui qui signe, et
// l'horodatage perdrait son référentiel. La clé suit donc la PERSONNE
// (`cleCoffre`), comme un certificat de signature suit son titulaire.
// ============================================================================

// La variable du `.env` qui porte la clé de scellement (32 octets).
export const CLE_DE_SCELLEMENT = "SCRIBA_SIGNATURE_KV_KEY";

// La clé de coffre d'un signataire. L'identifiant de PERSONNE vient d'abord : il
// ne change ni avec le compte, ni avec l'adresse électronique, ni avec un
// renommage — c'est ce qui fait qu'un signataire garde SON certificat.
export function cleCoffre(signataire = {}) {
  const brut = signataire.personId || signataire.compteId || signataire.compte || signataire.compteOutil || signataire.courriel || signataire.nom || "signataire";
  return String(brut).trim().toLowerCase().slice(0, 200) || "signataire";
}

// La clé du certificat D'HORODATAGE : une seule par service (elle date les
// actes, elle n'identifie personne).
export const CLE_HORODATAGE = "__horodatage__";

export function createSignatureInterne({
  crypto = null,
  cle = "",
  coffre = {},
  brand = "",
  autorite = "",
  niveau = "avancee",
  maintenant = () => new Date(),
  journal = () => {},
} = {}) {
  const scellement = cleDeScellement(cle);
  const memoire = new Map();

  // Pourquoi la signature interne est éteinte, en une phrase — celle qu'on
  // montre à l'exploitant et à l'agent. Vide quand elle est disponible.
  function motif() {
    if (!crypto) return "Ce service n'a pas de moteur cryptographique (WebCrypto) : la signature interne est éteinte.";
    if (!scellement) {
      return "La signature interne n'est pas configurée sur ce service : la clé de scellement du coffre ("
        + CLE_DE_SCELLEMENT + ", 32 octets en hexadécimal ou en base64) n'est pas renseignée dans le .env. "
        + "Le service de démonstration de la plateforme ne tient pas de coffre : la signature interne n'existe qu'en auto-hébergement.";
    }
    return "";
  }
  const disponible = () => !motif();

  // Une identité (clé + certificat) : celle du coffre, ou une neuve.
  async function identite(signataire = {}, kind = "signataire") {
    const clef = kind === "horodatage" ? CLE_HORODATAGE : cleCoffre(signataire);
    const enMemoire = memoire.get(clef);
    if (enMemoire) return enMemoire;
    const fiche = coffre[clef];
    if (fiche && fiche.cache && fiche.certificat && fiche.certificat.clePublique) {
      try {
        const privee = JSON.parse(await crypto.desceller(fiche.cache, scellement));
        const id = { kind: fiche.kind || kind, certificat: fiche.certificat, jwk: { publique: fiche.certificat.clePublique, privee } };
        memoire.set(clef, id);
        return id;
      } catch (e) {
        journal({ evenement: "coffre_cle_illisible", cle: clef, motif: String((e && e.message) || e) });
      }
    }
    const id = await genererIdentite(crypto, {
      kind,
      nom: signataire.nom,
      org: signataire.entite,
      brand,
      autorite,
      usage: signataire.usage,
      maintenant: maintenant(),
    });
    const cache = await crypto.sceller(JSON.stringify(id.jwk.privee), scellement);
    const quand = maintenant().toISOString();
    coffre[clef] = {
      kind: id.kind, cache, certificat: id.certificat,
      nom: kind === "horodatage" ? "Horodatage du service" : String(signataire.nom || ""),
      sujet: id.certificat.sujet, creeLe: quand, majLe: quand,
    };
    memoire.set(clef, id);
    journal({ evenement: "coffre_cle_engendree", cle: clef, kind: id.kind, nom: coffre[clef].nom, sujet: id.certificat.sujet });
    return id;
  }

  // Le dossier INTERNE de l'original : ce qui identifie nominativement le
  // signataire, et qui n'est jamais publié. La forme est celle du dossier des
  // autres circuits (`dossierSignatureInterne`, src/lib/courriel.js) : les mêmes
  // champs, pour que l'écran du dossier de signature les lise tous pareil.
  function dossierInterne({ signataire = {}, operateur = {}, reference, objet, empreinte, poste, ip }) {
    return {
      reference: reference || "",
      objet: objet || "",
      document: { sha256: empreinte },
      signataire: {
        nom: signataire.nom || "", fonction: signataire.fonction || "", courriel: signataire.courriel || "",
        personId: signataire.personId || "", compteId: signataire.compteId || "",
        compte: signataire.compteOutil || signataire.compte || signataire.compteId || "",
        entite: signataire.entite || "",
      },
      operateur: {
        id: operateur.id || "", nom: operateur.nom || "",
        courriel: operateur.courriel || "", compte: operateur.compte || "",
        // La PERSONNE de l'opérateur, quand le service l'a identifiée : c'est
        // elle qui répond à « qui tenait le clavier ? », distincte du signataire.
        personId: operateur.personId || "",
      },
      authentification: "Clé privée détenue et scellée par le service (signature interne) — la clé n'a jamais quitté le serveur",
      poste: poste || "",
      adresseIp: ip || "",
      courriels: [],
      remarque: "Part non diffusée de l'original signé : mentions nominatives du signataire, poste de l'opérateur et coffre du service. Elle est conservée au registre et n'est servie par aucune route publique.",
    };
  }

  // Le geste : signer un document au nom d'un signataire. Rend l'ORIGINAL SIGNÉ
  // complet (sa part publique ET son dossier interne), dans la même forme que
  // `buildSignedPackage` — le recueil le vérifie sans une ligne de plus.
  //
  // La PAGE de l'original (`pageHtml`) n'est pas produite ici : le service ne
  // sait pas rendre un document dont il n'a que l'Akoma Ntoso. C'est
  // l'application, qui l'a sous les yeux, qui l'ajoute au paquet reçu.
  async function signer({ akn = "", signataire = {}, operateur = {}, reference = "", objet = "", poste = "", ip = "", signeLe = "" } = {}) {
    if (!disponible()) throw new Error(motif());
    const idSignataire = await identite(signataire, "signataire");
    const idHorodatage = await identite({}, "horodatage");
    const empreinte = await crypto.sha256Hex(akn || "");
    const quand = signeLe || maintenant().toISOString();
    const pack = await signerDocument(crypto, {
      akn, identite: idSignataire, horodatageIdentite: idHorodatage,
      signataire: {
        nom: signataire.nom || "", fonction: signataire.fonction || "", courriel: signataire.courriel || "",
        personId: signataire.personId || "", compteId: signataire.compteId || "",
        compteOutil: signataire.compteOutil || signataire.compte || "", entite: signataire.entite || "",
      },
      reference, objet, brand, niveau, signeLe: quand,
      interne: dossierInterne({ signataire, operateur, reference, objet, empreinte, poste, ip }),
    });
    journal({ evenement: "signature_interne", reference, signataire: pack.signatures[0].signataire.nom, empreinte, sujet: idSignataire.certificat.sujet });
    return pack;
  }

  // L'état du coffre, tel que `GET /v1/config` le rend (jamais une clé).
  function etat() {
    const m = motif();
    const fiches = Object.keys(coffre).filter((k) => k !== CLE_HORODATAGE);
    return {
      disponible: !m, motif: m, niveau, algorithme: ALGORITHME,
      signataires: fiches.length, horodatage: !!coffre[CLE_HORODATAGE],
    };
  }

  return { disponible, motif, etat, signer, identite, cleCoffre };
}
