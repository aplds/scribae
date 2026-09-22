// ============================================================================
// LE PRESTATAIRE DE SIGNATURE — l'appel sortant, côté SERVICE.
//
// Le circuit de signature ÉLECTRONIQUE suppose un prestataire joignable (un
// parapheur, ESUP-Signature, l'outil de la collectivité). Ce module est le seul
// endroit qui l'appelle réellement. Il vit côté service pour une raison de
// sécurité : la CLÉ du prestataire (`SCRIBA_SIGNATURE_API_CLE`) ne doit jamais
// quitter le serveur — un navigateur, une page ouverte, un journal de poste la
// laisserait fuir.
//
// Les réglages viennent du référentiel (`config.signature.api`, voir
// src/lib/externe.js) ou, à défaut, du `.env` du déploiement
// (`SCRIBA_SIGNATURE_API_*`, voir variables.mjs) — qui l'emporte. Ils sont
// reçus par `createPrestataire({ api, cle })` :
//
//   transport        service | demonstration — « demonstration » n'appelle rien
//   url              racine de l'API du prestataire
//   prestataire      nom technique du prestataire (journal, en-têtes)
//   niveau           simple | avancee | qualifiee
//   urlNotification  l'adresse que le prestataire appellera après signature
//   timeoutMs        délai maximal d'un appel
//   chemina…         les quatre points de terminaison, relatifs à `url`
//
// Le circuit se déroule en trois appels, ceux que la démonstration simule :
//
//   1. déposer le document  → le prestataire rend un identifiant de dossier
//   2. ajouter le signataire
//   3. démarrer le circuit  → le prestataire rend le LIEN DE SIGNATURE
//
// Puis le prestataire PRÉVIENT le service de son côté
// (`POST /v1/webhooks/signature`, l'adresse `urlNotification`), et le service
// suit l'avancement par `statut()`.
//
// Tout est interrogé de façon défensive : le vocabulaire d'un prestataire n'est
// pas normalisé, et l'on ne peut pas exiger d'un outil existant qu'il renomme
// ses champs. On lit donc plusieurs formes connues, et l'on ÉCHOUE EN LE DISANT
// plutôt que de faire croire à une signature qui n'a pas eu lieu.
//
// Module pur (aucune dépendance à Node hors `fetch`, disponible partout depuis
// Node 18) : il s'éprouve seul, et `server.mjs` l'injecte dans `actes.mjs`.
// ============================================================================

const texte = (v) => (v === undefined || v === null ? "" : String(v).trim());

// Les jetons d'un chemin : {document} {signature} {acte} {numero} — les mêmes
// que la numérotation externe, pour que les deux se lisent pareil.
export function cheminRempli(chemin, jetons = {}) {
  return String(chemin || "").replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,
    (tout, cle) => (cle in jetons ? encodeURIComponent(String(jetons[cle] ?? "")) : tout));
}

const joindre = (base, chemin) => String(base || "").replace(/\/+$/, "") + "/" + String(chemin || "").replace(/^\/+/, "");

// Le premier champ non vide parmi les chemins possibles. Les prestataires
// nomment leurs choses différemment : on lit les formes courantes, sans exiger
// un format particulier.
const premier = (objet, noms) => {
  for (const n of noms) {
    const v = n.split(".").reduce((o, k) => (o == null ? o : o[k]), objet);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

export function createPrestataire({ api = {}, cle = "", fetchImpl = fetch, journal = () => {} } = {}) {
  const reglages = () => ({
    transport: api.transport === "demonstration" ? "demonstration" : "service",
    url: texte(api.url),
    prestataire: texte(api.prestataire) || "esup-signature",
    niveau: ["simple", "avancee", "qualifiee"].includes(api.niveau) ? api.niveau : "avancee",
    urlNotification: texte(api.urlNotification),
    timeoutMs: Math.max(1000, Number(api.timeoutMs) || 20000),
    chemins: {
      document: texte(api.cheminDocument) || "/documents",
      signataires: texte(api.cheminSignataires) || "/documents/{document}/signataires",
      demarrer: texte(api.cheminDemarrer) || "/documents/{document}/demarrer",
      statut: texte(api.cheminStatut) || "/documents/{document}",
    },
  });

  // Le prestataire est RÉELLEMENT branché quand le transport est « service »,
  // qu'une adresse est renseignée ET que la clé est là : une adresse sans clé
  // n'ouvrirait que des dossiers anonymes, ce qu'un parapheur refuse.
  const actif = () => {
    const r = reglages();
    return r.transport !== "demonstration" && !!r.url && !!texte(cle);
  };

  // L'ÉTAT, tel qu'on le montre à l'exploitant — jamais la clé elle-même.
  const etat = () => {
    const r = reglages();
    return {
      actif: actif(),
      transport: r.transport,
      url: r.url,
      prestataire: r.prestataire,
      niveau: r.niveau,
      urlNotification: r.urlNotification,
      timeoutMs: r.timeoutMs,
      chemins: r.chemins,
      cle: !!texte(cle),
      motif: !texte(r.url)
        ? "aucune adresse de prestataire : le circuit électronique reste en simulation"
        : r.transport === "demonstration"
          ? "transport « demonstration » : aucun appel sortant"
          : !texte(cle)
            ? "clé d'API absente (SCRIBA_SIGNATURE_API_CLE) : le service n'appelle pas le prestataire"
            : "",
    };
  };

  async function appeler(methode, url, corps, { timeoutMs } = {}) {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const duree = Math.max(1000, Number(timeoutMs) || reglages().timeoutMs);
    const minuteur = ctrl ? setTimeout(() => ctrl.abort(), duree) : null;
    const t0 = Date.now();
    try {
      const res = await fetchImpl(url, {
        method: methode,
        headers: {
          "accept": "application/json",
          ...(corps ? { "content-type": "application/json" } : {}),
          // La clé ne sort que d'ici, et seulement vers le prestataire.
          "authorization": "Bearer " + texte(cle),
          "x-scribae-service": reglages().prestataire,
        },
        body: corps ? JSON.stringify(corps) : undefined,
        signal: ctrl ? ctrl.signal : undefined,
      });
      const brut = await res.text();
      let data = null;
      try { data = brut ? JSON.parse(brut) : null; } catch (e) { data = null; }
      const out = { status: res.status, ok: res.ok, data, texte: brut };
      journal({ methode, url, statut: res.status, ms: Date.now() - t0 });
      return out;
    } catch (e) {
      if (e && e.name === "AbortError") {
        throw new Error(`Le prestataire de signature n'a pas répondu en ${Math.round(duree / 1000)} s.`);
      }
      journal({ methode, url, statut: 0, ms: Date.now() - t0, erreur: String(e && e.message || e) });
      throw new Error(`Prestataire de signature injoignable : ${(e && e.message) || e}`);
    } finally {
      if (minuteur) clearTimeout(minuteur);
    }
  }

  const echec = (etape, res) => {
    const detail = res && res.texte ? " — " + res.texte.slice(0, 240) : "";
    return new Error(`Le prestataire de signature a refusé ${etape} (${res ? res.status : "?"})${detail}.`);
  };

  // --------------------------------------------------------------------------
  // PROVISIONNER un circuit : les trois appels, dans l'ordre. Rend
  // { document, lienSignature, prestataire, etapes, brute } — ou lève, en
  // disant quelle étape a échoué. L'appelant (actes.mjs) décide quoi en faire :
  // ce module n'écrit aucun état.
  // --------------------------------------------------------------------------
  async function provisionner({ akn, reference = "", numero = "", objet = "", acteId = "", empreinte = "", signataires = [] } = {}) {
    if (!actif()) throw new Error(etat().motif || "Le prestataire de signature n'est pas configuré.");
    const r = reglages();
    const jetons = { acte: acteId, numero, reference };
    const urlDocument = joindre(r.url, cheminRempli(r.chemins.document, jetons));

    const dep = await appeler("POST", urlDocument, {
      reference, numero, objet, empreinte,
      niveau: r.niveau,
      urlNotification: r.urlNotification || undefined,
      document: { format: "akn", contenu: akn },
    });
    if (!dep.ok) throw echec("le dépôt du document", dep);
    const document = texte(premier(dep.data, ["id", "documentId", "document.id", "dossier", "reference"]));
    if (!document) throw new Error("Le prestataire a reçu le document, mais n'a rendu aucun identifiant de dossier.");

    for (const s of signataires) {
      const urlSig = joindre(r.url, cheminRempli(r.chemins.signataires, { ...jetons, document }));
      const ajout = await appeler("POST", urlSig, {
        nom: s.nom || "", courriel: s.courriel || "", fonction: s.fonction || "",
        ordre: s.ordre || 1, compte: s.compte || "", niveau: s.niveau || r.niveau,
      });
      if (!ajout.ok) throw echec("l'ajout d'un signataire", ajout);
    }

    const urlDemarrer = joindre(r.url, cheminRempli(r.chemins.demarrer, { ...jetons, document }));
    const debut = await appeler("POST", urlDemarrer, { urlNotification: r.urlNotification || undefined, niveau: r.niveau });
    if (!debut.ok) throw echec("le démarrage du circuit", debut);

    const lienSignature = texte(premier(debut.data, ["lienSignature", "urlSignature", "signatureUrl", "lien", "url"])
      || premier(dep.data, ["lienSignature", "urlSignature", "signatureUrl", "lien", "url"]));

    return {
      document,
      lienSignature,
      prestataire: { id: r.prestataire, nom: r.prestataire, baseUrl: r.url, niveau: r.niveau, outil: "prestataire" },
      etapes: { depot: dep.status, demarrage: debut.status },
      brute: debut.data,
    };
  }

  // Le STATUT d'un dossier, tel que le prestataire le publie. On ne traduit pas
  // son vocabulaire : on rend son état brut avec les quelques clés connues, et
  // l'appelant décide. Un statut illisible n'est jamais assimilé à « signée ».
  async function statut({ document } = {}) {
    if (!actif()) throw new Error(etat().motif || "Le prestataire de signature n'est pas configuré.");
    const r = reglages();
    const url = joindre(r.url, cheminRempli(r.chemins.statut, { document }));
    const res = await appeler("GET", url, null);
    if (!res.ok) throw echec("la lecture du statut", res);
    return {
      statut: texte(premier(res.data, ["statut", "status", "etat", "state"])),
      signe: premier(res.data, ["signe", "signeLe", "dateSignature", "completedAt"]) || "",
      lienSignature: texte(premier(res.data, ["lienSignature", "urlSignature", "signatureUrl", "lien", "url"])),
      brute: res.data,
    };
  }

  return { actif, etat, provisionner, statut, reglages };
}
