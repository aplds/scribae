// ============================================================================
// Domaine « signature et publication » — portage du service de la plateforme.
//
// Ce module est le cœur métier de l'API : dépôt des actes, circuits de
// signature, notification du prestataire, publication et résolution ELI. Il est
// **pur** : aucune dépendance à Node, à MySQL ou au réseau. Tout ce qui vient du
// dehors est injecté —
//
//   state    l'état mutable (actes, signatures, publications)
//   sha256   une empreinte SHA-256 synchrone (crypto de Node, ou l'implémentation
//            embarquée côté plateforme)
//   now      l'horloge
//   save     la persistance : renvoie false si la capacité est dépassée
//
// Il expose `route(req, ctx)` où `req` est `{ method, path, headers, body }` et
// `ctx` fournit l'autorisation (`authorize`) et la limitation de débit (`rate`).
// Le serveur HTTP (`server.mjs`) n'a plus qu'à traduire : c'est ce qui garantit
// que le service auto-hébergé et celui de la plateforme se comportent pareil.
// ============================================================================

const SERVICE = "Service de signature et de publication";
const SERVICE_VERSION = "1.0.0";

export function emptyState() {
  return { v: 1, seq: 0, actes: {}, signatures: {}, publies: {}, idem: {} };
}

export function createActesApi({
  state,
  sha256,
  now = () => new Date().toISOString(),
  save,                       // (json) → true si l'état a été accepté
  maxDoc = 400000,
  maxPublies = 40,
  maxSignatures = 80,
  maxActes = 80,
}) {
  const db = state;
  let dirty = null;           // dernier état sérialisé, en attente d'écriture

  const nowIso = () => now();
  const today = () => nowIso().slice(0, 10);

  function persist() {
    const s = JSON.stringify(db);
    if (!save || save(s)) { dirty = s; return true; }
    return false;
  }

  function nextId(prefix, table) {
    let n = (db.seq || 0) + 1;
    let id;
    do { id = prefix + "-" + String(n).padStart(4, "0"); n++; } while (table[id]);
    db.seq = n;
    return id;
  }

  // Éviction : on ne garde que les plus récentes (la plus ancienne sort d'abord).
  function evince(table, max, dateKey) {
    const keys = Object.keys(table);
    if (keys.length <= max) return;
    keys.sort((a, b) => String(table[a][dateKey] || "").localeCompare(String(table[b][dateKey] || "")));
    for (const k of keys.slice(0, keys.length - max)) delete table[k];
  }

  function slug(s) {
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();
  }

  const ok = (status, body, headers) => ({ status, headers: headers || {}, body });
  const err = (status, message, extra, headers) => ({ status, headers: headers || {}, body: { erreur: message, ...(extra || {}) } });

  // -------------------------------------------------------------- projections
  function resumeActe(a) {
    return { id: a.id, numero: a.numero, objet: a.objet, nature: a.nature, entityName: a.entityName, dateSignature: a.dateSignature, statut: a.statut, sha256: a.sha256, deposeLe: a.deposeLe, signatureId: a.signatureId || null, publication: a.publication || null };
  }
  function resumeSignature(s) {
    return { id: s.id, acteId: s.acteId, numero: s.numero, statut: s.statut, signataires: s.signataires, creeLe: s.creeLe, signeLe: s.signeLe || null, motif: s.motif || null, empreinte: (s.documentSigne && s.documentSigne.document && s.documentSigne.document.sha256) || null };
  }
  function resumePublication(p, latest) {
    return { cle: p.cle, eli: p.eli, eliUri: p.eliUri, url: p.url, numero: p.numero, nature: p.nature, objet: p.objet, entityName: p.entityName, dateDocument: p.dateDocument, datePublication: p.datePublication, dateOpposabilite: p.dateOpposabilite, kind: p.kind, recueil: p.recueil, publieeLe: p.publieeLe, latest: !!latest, versions: p.versions || [] };
  }

  function clePublication(eliUri, dateExpr) {
    return slug(eliUri.replace(/^eli:\/fr\//, "")) + "@" + (dateExpr || today());
  }

  function versionsOf(eliUri) {
    const all = Object.keys(db.publies).map((k) => db.publies[k]).filter((p) => p.eliUri === eliUri);
    all.sort((a, b) => String(a.dateDocument || "").localeCompare(String(b.dateDocument || "")) || String(a.publieeLe || "").localeCompare(String(b.publieeLe || "")));
    return all;
  }
  function latestOf(eliUri) {
    const v = versionsOf(eliUri);
    return v.length ? v[v.length - 1] : null;
  }

  const eliKey = (p) => "eli:/fr/" + [p.code, p.annee, p.numero, p.entite].filter(Boolean).join("/");

  // ------------------------------------------------------------------ OpenAPI
  function openapi() {
    return {
      openapi: "3.1.0",
      info: {
        title: SERVICE,
        version: SERVICE_VERSION,
        description: "API de dépôt, de signature électronique et de publication des actes administratifs. Les lectures sont publiques ; les écritures exigent un jeton d'API (Authorization: Bearer).",
      },
      servers: [{ url: "/", description: "Service de la collectivité" }],
      security: [],
      paths: {
        "/v1/health": { get: { operationId: "sante", summary: "État du service", description: "Vérifie que le service répond et donne le nombre d'objets conservés.", tags: ["Service"], responses: { 200: { description: "Service disponible" } } } },
        "/v1/actes": {
          get: { operationId: "listerActes", summary: "Lister les actes déposés", tags: ["Actes"], responses: { 200: { description: "Liste des actes finalisés reçus par le service" } } },
          post: {
            operationId: "deposerActe", summary: "Déposer un acte finalisé", tags: ["Actes"],
            description: "Reçoit l'acte finalisé (Akoma Ntoso) et le conserve en vue de la signature. Redéposer un document identique encore en circuit renvoie le même acte (200 au lieu de 201).",
            security: [{ bearerAuth: [] }],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["akn"], properties: { akn: { type: "string", description: "Le document Akoma Ntoso 3.0" }, numero: { type: "string" }, objet: { type: "string" }, nature: { type: "string" }, entityId: { type: "string" }, entityName: { type: "string" }, dateSignature: { type: "string", format: "date" }, trameId: { type: "string" }, ecarts: { type: "integer" } } } } } },
            responses: { 201: { description: "Acte déposé" }, 200: { description: "Acte déjà déposé (idempotent)" }, 401: { description: "Jeton absent" }, 403: { description: "Jeton invalide" }, 413: { description: "Document trop volumineux" } },
          },
        },
        "/v1/actes/{id}": { get: { operationId: "lireActe", summary: "Lire un acte déposé", tags: ["Actes"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "L'acte et ses métadonnées" }, 404: { description: "Acte inconnu" } } } },
        "/v1/actes/{id}/document": { get: { operationId: "lireDocumentActe", summary: "Télécharger le document Akoma Ntoso", tags: ["Actes"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Document au format application/akn+xml" }, 404: { description: "Acte inconnu" } } } },
        "/v1/actes/{id}/signature": {
          post: {
            operationId: "envoyerEnSignature", summary: "Envoyer un acte en signature", tags: ["Signature"],
            description: "Ouvre un circuit de signature auprès du prestataire (ESUP-Signature ou équivalent). Le service renvoie immédiatement un identifiant de circuit ; ce sont le prestataire (par notification) puis le suivi qui feront évoluer l'état.",
            security: [{ bearerAuth: [] }],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { signataires: { type: "array", items: { type: "object", properties: { nom: { type: "string" }, courriel: { type: "string" }, fonction: { type: "string" }, ordre: { type: "integer" } } } }, niveau: { type: "string", enum: ["simple", "avancee", "qualifiee"] }, urlNotification: { type: "string", description: "URL appelée par le prestataire à l'issue de la signature" } } } } } },
            responses: { 202: { description: "Circuit ouvert" }, 404: { description: "Acte inconnu" }, 409: { description: "Acte déjà signé" }, 401: { description: "Jeton absent" } },
          },
        },
        "/v1/webhooks/signature": {
          post: {
            operationId: "notifierSignature", summary: "Notification du prestataire (retour de l'acte signé)", tags: ["Signature"],
            description: "Appelée par le prestataire lorsque la signature est apposée. Le service recalcule l'empreinte SHA-256 du document signé et la compare à celle de l'acte déposé : une différence est refusée (409), la signature n'est jamais acceptée sur un document qui n'est pas celui qui a été déposé.",
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["signatureId", "documentSigne"], properties: { signatureId: { type: "string" }, statut: { type: "string", enum: ["signee", "refusee"] }, documentSigne: { type: "object", description: "L'original signé (document + signatures + horodatage)" } } } } } },
            responses: { 200: { description: "Notification acceptée" }, 404: { description: "Circuit inconnu" }, 409: { description: "Empreinte du document signé différente de celle déposée" } },
          },
        },
        "/v1/signatures": { get: { operationId: "listerSignatures", summary: "Lister les circuits de signature", tags: ["Signature"], responses: { 200: { description: "Circuits ouverts" } } } },
        "/v1/signatures/{id}": { get: { operationId: "suivreSignature", summary: "Suivre un circuit de signature", tags: ["Signature"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Statut du circuit (en_attente, signee, refusee, rejetee)" }, 404: { description: "Circuit inconnu" } } } },
        "/v1/signatures/{id}/document-signe": { get: { operationId: "lireDocumentSigne", summary: "Récupérer l'acte signé", tags: ["Signature"], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "L'original signé" }, 404: { description: "Acte signé non disponible" } } } },
        "/v1/actes/{id}/publication": {
          post: {
            operationId: "publierActe", summary: "Publier l'acte signé et attribuer son ELI", tags: ["Publication"],
            description: "Dépose la version en ligne au recueil et attribue l'identifiant ELI. La publication est refusée (409) tant que l'acte n'est pas signé : c'est la chaîne d'intégrité, et refusée (422) si la date de publication précède la date de signature. Fournir un en-tête « Idempotency-Key » rend l'appel rejouable sans créer de doublon.",
            security: [{ bearerAuth: [] }],
            requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["html", "akn", "original"], properties: { recueil: { type: "string" }, datePublication: { type: "string", format: "date" }, opposabilite: { type: "object", properties: { mode: { type: "string", enum: ["lendemain", "jours"] }, jours: { type: "integer" } } }, kind: { type: "string", enum: ["originale", "consolidee", "modificative"] }, html: { type: "string", description: "La version en ligne" }, akn: { type: "string" }, jsonld: { type: "string" }, original: { type: "object", description: "L'original signé" } } } } } },
            responses: { 201: { description: "Publié : ELI attribué" }, 200: { description: "Appel rejoué (Idempotency-Key)" }, 404: { description: "Acte inconnu" }, 409: { description: "Acte non signé" }, 422: { description: "Version en ligne manquante" } },
          },
        },
        "/v1/publications": { get: { operationId: "listerPublications", summary: "Registre public des publications", tags: ["Publication"], responses: { 200: { description: "Publications, de la plus récente à la plus ancienne" } } } },
        "/v1/publications/{cle}": { get: { operationId: "lirePublication", summary: "Lire une publication (version en ligne, formats, original)", tags: ["Publication"], parameters: [{ name: "cle", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Publication complète" }, 404: { description: "Publication inconnue" } } } },
        "/v1/eli/{code}/{annee}/{numero}/{entite}": { get: { operationId: "resoudreEli", summary: "Résoudre un identifiant ELI", tags: ["Publication"], description: "Renvoie la version en vigueur et l'historique des versions publiées sous le même ELI.", parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" } }, { name: "annee", in: "path", required: true, schema: { type: "string" } }, { name: "numero", in: "path", required: true, schema: { type: "string" } }, { name: "entite", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "La version en vigueur et ses versions" }, 404: { description: "ELI inconnu" } } } },
      },
      components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } } },
    };
  }

  // ------------------------------------------------------------------ routage
  const lireActe = (id) => db.actes[id] || null;
  const lireSignature = (id) => db.signatures[id] || null;
  const lirePublication = (cle) => db.publies[cle] || null;

  function hSante() {
    return ok(200, {
      statut: "ok", service: SERVICE, version: SERVICE_VERSION, maintenant: nowIso(),
      objets: { actes: Object.keys(db.actes).length, signatures: Object.keys(db.signatures).length, publications: Object.keys(db.publies).length },
    });
  }

  function hDeposerActe(ctx) {
    const b = ctx.body || {};
    if (!b.akn || typeof b.akn !== "string") return err(400, "Le corps de la requête doit contenir le document `akn`.", { code: "document_absent" });
    if (b.akn.length > maxDoc) return err(413, `Document trop volumineux (${b.akn.length} caractères, maximum ${maxDoc}).`, { code: "document_trop_volumineux" });
    const sha = sha256(b.akn);
    // Idempotence « en vol » : redéposer un document déjà reçu et encore en
    // circuit renvoie le même acte. Un acte déjà signé ou publié n'est jamais
    // renvoyé : un nouveau circuit s'ouvre sur un nouveau dépôt.
    for (const id in db.actes) {
      const a = db.actes[id];
      if (a.sha256 === sha && (a.statut === "depose" || a.statut === "en_signature")) {
        return ok(200, { id, href: "/v1/actes/" + id, sha256: sha, deposeLe: a.deposeLe, idempotent: true }, { location: "/v1/actes/" + id });
      }
    }
    const id = nextId("ACT", db.actes);
    const acte = {
      id, akn: b.akn, sha256: sha,
      numero: b.numero || "", objet: b.objet || "", nature: b.nature || "Acte",
      entityId: b.entityId || "", entityName: b.entityName || "",
      dateSignature: b.dateSignature || "", trameId: b.trameId || "", ecarts: b.ecarts || 0,
      statut: "depose", deposeLe: nowIso(),
    };
    db.actes[id] = acte;
    evince(db.actes, maxActes, "deposeLe");
    if (!persist()) { delete db.actes[id]; return err(507, "Le service n'a plus de place disponible."); }
    return ok(201, { id, href: "/v1/actes/" + id, sha256: sha, statut: acte.statut, deposeLe: acte.deposeLe }, { location: "/v1/actes/" + id });
  }

  function hEnvoyerEnSignature(ctx) {
    const acte = lireActe(ctx.params.id);
    if (!acte) return err(404, "Acte déposé inconnu : " + ctx.params.id);
    if (acte.statut === "signee" || acte.statut === "publie") return err(409, "Cet acte est déjà signé (" + acte.statut + ").", { code: "deja_signe" });
    const b = ctx.body || {};
    const signataires = Array.isArray(b.signataires) && b.signataires.length ? b.signataires : [{ nom: "Signataire non précisé" }];
    const id = nextId("SIG", db.signatures);
    const sig = {
      id, acteId: acte.id, numero: acte.numero, acteSha256: acte.sha256,
      statut: "en_attente", signataires, niveau: b.niveau || "avancee",
      urlNotification: b.urlNotification || "/v1/webhooks/signature",
      prestataire: b.prestataire || "esup-signature", creeLe: nowIso(), documentSigne: null,
    };
    db.signatures[id] = sig;
    acte.statut = "en_signature";
    acte.signatureId = id;
    evince(db.signatures, maxSignatures, "creeLe");
    if (!persist()) { delete db.signatures[id]; acte.statut = "depose"; return err(507, "Le service n'a plus de place disponible."); }
    return ok(202, {
      signatureId: id,
      statut: "en_attente",
      acteId: acte.id,
      empreinte: acte.sha256,
      signataires,
      lienSignature: (b.basePrestataire || "") + "/signature/" + id,
      relevé_apres_secondes: 20,
      prestataire: {
        id: "esup-signature", nom: "ESUP-Signature (simulation)", baseUrl: b.basePrestataire || "", niveau: sig.niveau,
        document: "/documents", signataires: "/documents/{id}/signataires", demarrer: "/documents/{id}/demarrer", statut: "/documents/{id}",
      },
      notifications: { url: sig.urlNotification, evenement: "signature.terminee" },
    }, { location: "/v1/signatures/" + id });
  }

  function hWebhookSignature(ctx) {
    const b = ctx.body || {};
    const sig = lireSignature(b.signatureId);
    if (!sig) return err(404, "Circuit de signature inconnu : " + (b.signatureId || "(absent)"));
    if (b.statut === "refusee") { sig.statut = "refusee"; sig.motif = b.motif || "Signature refusée par le signataire"; persist(); return ok(200, { recu: true, signatureId: sig.id, statut: sig.statut }); }
    const pack = b.documentSigne;
    if (!pack || !pack.document || typeof pack.document.akn !== "string") return err(400, "Notification invalide : `documentSigne.document.akn` est attendu.", { code: "document_absent" });
    const acte = lireActe(sig.acteId);
    if (!acte) return err(404, "Acte d'origine introuvable pour ce circuit.");
    // Contrôle d'intégrité fait par le service lui-même : le document signé doit
    // être exactement le document déposé.
    const sha = sha256(pack.document.akn);
    if (sha !== acte.sha256) {
      sig.statut = "rejetee";
      sig.motif = "Empreinte du document signé différente de celle du document déposé";
      persist();
      return err(409, "Signature refusée : le document signé ne correspond pas au document déposé.", {
        code: "empreinte_divergente",
        empreinte_deposee: acte.sha256,
        empreinte_signee: sha,
      });
    }
    sig.statut = "signee";
    sig.documentSigne = pack;
    sig.signeLe = (pack.signatures && pack.signatures[0] && pack.signatures[0].signeLe) || nowIso();
    acte.statut = "signee";
    acte.signeLe = sig.signeLe;
    if (!persist()) return err(507, "Le service n'a plus de place disponible.");
    return ok(200, { recu: true, signatureId: sig.id, acteId: acte.id, statut: "signee", signeLe: sig.signeLe, empreinte: sha });
  }

  function hPublier(ctx) {
    const acte = lireActe(ctx.params.id);
    if (!acte) return err(404, "Acte déposé inconnu : " + ctx.params.id);
    if (acte.statut !== "signee" && acte.statut !== "publie") {
      return err(409, "Un acte ne peut être publié qu'après signature.", { code: "acte_non_signe", statut: acte.statut });
    }
    const b = ctx.body || {};
    if (!b.html || !b.akn) return err(422, "La version en ligne (`html`) et le document Akoma Ntoso (`akn`) sont requis pour publier.", { code: "version_en_ligne_absente" });
    if (!b.original) return err(422, "L'original signé (`original`) est requis : c'est lui qui est conservé et opposable.", { code: "original_absent" });
    const idem = ctx.headers["idempotency-key"] || ctx.headers["Idempotency-Key"];
    if (idem && db.idem[idem]) {
      const p = lirePublication(db.idem[idem]);
      if (p) return ok(200, { ...resumePublication(p, latestOf(p.eliUri) === p), idempotent: true });
    }
    const eliUri = b.eliUri || "";
    if (!eliUri) return err(422, "L'identifiant ELI (`eliUri`) est requis.", { code: "eli_absent" });
    const datePublication = b.datePublication || today();
    const dateDocument = b.dateDocument || acte.dateSignature || "";
    if (dateDocument && datePublication < dateDocument) {
      return err(422, "La date de publication ne peut pas précéder la date de signature de l'acte.", { code: "date_publication_anterieure", dateDocument, datePublication });
    }
    const dateExpr = b.dateExpression || dateDocument || datePublication;
    const cle = clePublication(eliUri, dateExpr + "-" + (b.kind || "originale"));
    if (db.publies[cle]) return ok(200, { ...resumePublication(db.publies[cle], true), idempotent: true });

    const rec = {
      cle, eli: eliUri, eliUri, url: b.url || "", work: b.work || "",
      numero: b.numero || acte.numero, nature: b.nature || acte.nature, objet: b.objet || acte.objet,
      entityId: acte.entityId, entityName: acte.entityName, entityCode: b.entityCode || "",
      dateDocument, datePublication, dateOpposabilite: b.dateOpposabilite || "",
      opposabiliteRule: b.opposabiliteRule || "", recueil: b.recueil || "", auteur: b.auteur || "",
      kind: b.kind || "originale", brandName: b.brandName || "",
      sha256: sha256(b.akn), formats: { html: b.html, akn: b.akn, jsonld: b.jsonld || "" },
      original: {
        format: (b.original && b.original.format) || "application/vnd.actes.original-signe+json",
        sha256: (b.original && b.original.document && b.original.document.sha256) || "",
        pageHtml: (b.original && b.original.pageHtml) || "",
        signatures: (b.original && b.original.signatures) || [],
        horodatage: (b.original && b.original.horodatage) || null,
        signaturesUrl: "/v1/eli/" + slug(eliUri.replace(/^eli:\/fr\//, "")) + "/original",
      },
      signature: {
        prestataire: (b.original && b.original.prestataire) || null,
        niveau: b.niveau || "avancee",
        signataires: ((b.original && b.original.signatures) || []).map((s) => ({ nom: s.signataire && s.signataire.nom, fonction: s.signataire && s.signataire.fonction })),
        signeLe: (b.original && b.original.signatures && b.original.signatures[0] && b.original.signatures[0].signeLe) || "",
        algorithme: (b.original && b.original.signatures && b.original.signatures[0] && b.original.signatures[0].algorithme) || "",
      },
      ecarts: acte.ecarts || 0,
      signataireActe: b.auteur || "",
      publieeLe: nowIso(), misAJourLe: nowIso(),
    };
    db.publies[cle] = rec;
    if (idem) db.idem[idem] = cle;
    acte.statut = "publie";
    acte.publication = cle;
    evince(db.publies, maxPublies, "publieeLe");
    if (!persist()) { delete db.publies[cle]; return err(507, "Le service n'a plus de place disponible."); }
    const versions = versionsOf(eliUri).map((p) => resumePublication(p, false));
    return ok(201, {
      cle, eli: eliUri, eliUri, url: rec.url,
      numero: rec.numero, nature: rec.nature, objet: rec.objet,
      dateDocument, datePublication, dateOpposabilite: rec.dateOpposabilite,
      opposabilite: rec.opposabiliteRule,
      recueil: rec.recueil,
      versions,
      ressource: "/v1/publications/" + encodeURIComponent(cle),
      original: { format: rec.original.format, sha256: rec.original.sha256, signatures: rec.signature.signataires.length, href: rec.original.signaturesUrl },
      formats: ["text/html", "application/akn+xml", "application/ld+json", rec.original.format],
    }, { location: "/v1/publications/" + encodeURIComponent(cle) });
  }

  function hResoudreEli(ctx) {
    const eliUri = eliKey(ctx.params);
    const versions = versionsOf(eliUri);
    if (!versions.length) return err(404, "Aucune publication ne porte l'identifiant " + eliUri + ".", { code: "eli_inconnu" });
    const enVigueur = versions[versions.length - 1];
    return ok(200, {
      eli: eliUri, eliUri, enVigueur: resumePublication(enVigueur, true),
      versions: versions.map((p, i) => resumePublication(p, i === versions.length - 1)),
      texte: { html: enVigueur.formats.html, akn: enVigueur.formats.akn, jsonld: enVigueur.formats.jsonld },
      original: enVigueur.original,
      ressource: "/v1/publications/" + encodeURIComponent(enVigueur.cle),
    }, { "content-location": "/v1/publications/" + encodeURIComponent(enVigueur.cle) });
  }

  const ROUTES = [
    { m: "GET", p: /^\/v1\/health$/, f: hSante, tag: "service" },
    { m: "GET", p: /^\/v1\/?$/, f: () => ok(200, openapi()), tag: "service" },
    { m: "GET", p: /^\/v1\/actes$/, auth: "public", f: () => ok(200, { actes: Object.keys(db.actes).map((k) => resumeActe(db.actes[k])).sort((a, b) => String(b.deposeLe).localeCompare(String(a.deposeLe))) }) },
    { m: "POST", p: /^\/v1\/actes$/, auth: "jeton", ecrit: true, f: hDeposerActe },
    { m: "GET", p: /^\/v1\/actes\/([^/]+)$/, f: (ctx) => { const a = lireActe(ctx.params.id); return a ? ok(200, resumeActe(a)) : err(404, "Acte déposé inconnu : " + ctx.params.id); } },
    { m: "GET", p: /^\/v1\/actes\/([^/]+)\/document$/, f: (ctx) => { const a = lireActe(ctx.params.id); return a ? ok(200, { id: a.id, format: "application/akn+xml", document: a.akn, sha256: a.sha256 }) : err(404, "Acte déposé inconnu : " + ctx.params.id); } },
    { m: "POST", p: /^\/v1\/actes\/([^/]+)\/signature$/, auth: "jeton", ecrit: true, f: hEnvoyerEnSignature },
    { m: "POST", p: /^\/v1\/actes\/([^/]+)\/publication$/, auth: "jeton", ecrit: true, f: hPublier },
    { m: "GET", p: /^\/v1\/signatures$/, f: () => ok(200, { signatures: Object.keys(db.signatures).map((k) => resumeSignature(db.signatures[k])).sort((a, b) => String(b.creeLe).localeCompare(String(a.creeLe))) }) },
    { m: "GET", p: /^\/v1\/signatures\/([^/]+)\/document-signe$/, f: (ctx) => { const s = lireSignature(ctx.params.id); return s && s.documentSigne ? ok(200, { signatureId: s.id, acteId: s.acteId, documentSigne: s.documentSigne }) : err(404, "Aucun document signé pour ce circuit : " + ctx.params.id); } },
    { m: "GET", p: /^\/v1\/signatures\/([^/]+)$/, f: (ctx) => { const s = lireSignature(ctx.params.id); return s ? ok(200, resumeSignature(s)) : err(404, "Circuit de signature inconnu : " + ctx.params.id); } },
    { m: "POST", p: /^\/v1\/webhooks\/signature$/, auth: "public", ecrit: true, f: hWebhookSignature },
    { m: "GET", p: /^\/v1\/publications$/, f: () => {
        const all = Object.keys(db.publies).map((k) => db.publies[k]);
        const latestKeys = new Set(all.map((p) => latestOf(p.eliUri)).filter(Boolean).map((p) => p.cle));
        return ok(200, { publications: all.map((p) => resumePublication(p, latestKeys.has(p.cle))).sort((a, b) => String(b.publieeLe).localeCompare(String(a.publieeLe))) });
      } },
    { m: "GET", p: /^\/v1\/publications\/([^/]+)$/, f: (ctx) => {
        const cle = decodeURIComponent(ctx.params.cle);
        const p = lirePublication(cle);
        if (!p) return err(404, "Publication inconnue : " + cle, { code: "publication_inconnue" });
        const versions = versionsOf(p.eliUri).map((x) => resumePublication(x, latestOf(x.eliUri) === x));
        return ok(200, { ...p, latest: latestOf(p.eliUri) === p, versions });
      } },
    { m: "GET", p: /^\/v1\/eli\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)\/original$/, f: (ctx) => {
        const eliUri = eliKey(ctx.params);
        const p = latestOf(eliUri);
        return p ? ok(200, { eli: eliUri, cle: p.cle, original: p.original, signature: p.signature }) : err(404, "ELI inconnu : " + eliUri);
      } },
    { m: "GET", p: /^\/v1\/eli\/([^/]+)\/([^/]+)\/([^/]+)\/([^/]+)$/, f: hResoudreEli },
  ];

  // `ctx` : { authorize(headers) → null | {status, body, code}, rate(req) → bool }
  function route(req, ctx = {}) {
    const method = String(req.method || "GET").toUpperCase();
    const path = String(req.path || "/");
    const q = path.indexOf("?");
    const clean = q >= 0 ? path.slice(0, q) : path;
    const headers = req.headers || {};

    let cheminTrouve = false;
    for (const r of ROUTES) {
      const m = r.p.exec(clean);
      if (!m) continue;
      cheminTrouve = true;
      if (r.m !== method) continue;
      if (r.auth === "jeton" && typeof ctx.authorize === "function") {
        const bad = ctx.authorize(headers);
        if (bad) return bad;
      }
      if (r.ecrit && typeof ctx.rate === "function" && ctx.rate(req)) {
        return err(429, "Trop de requêtes d'écriture : ralentissez (limite : 90 par minute).", { code: "trop_de_requetes" }, { "retry-after": "60" });
      }
      const params = { 0: m[0] };
      if (m[1] !== undefined) { params.id = m[1]; params.cle = m[1]; }
      if (m[2] !== undefined) { params.code = m[1]; params.annee = m[2]; params.numero = m[3]; params.entite = m[4]; }
      return r.f({ params, body: req.body, headers, conn: req.conn, path: clean });
    }
    return cheminTrouve
      ? err(405, "Méthode " + method + " non autorisée sur " + clean, { code: "methode_non_autorisee" })
      : null;   // hors du domaine de ce module (le serveur décide : 404 ou autre route)
  }

  // État à écrire après la requête (null s'il n'y a rien à faire).
  const takeDirty = () => { const d = dirty; dirty = null; return d; };

  return { route, takeDirty, openapi, emptyState };
}
