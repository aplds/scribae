// ============================================================================
// LE CONTRÔLE DE LÉGALITÉ — l'appel sortant, côté SERVICE.
//
// La télétransmission (@ctes) adresse l'acte signé au représentant de l'État
// par une API D'ENVOI. L'accusé de réception que cette API délivre vaut
// CERTIFICAT INFORMATIQUE de transmission :
//
//     « Transmis au contrôle de légalité le 22 janvier 2026 à 09 h 14 »
//
// Ce module est le seul endroit du service qui appelle réellement cette API. Il
// vit côté service pour la même raison que le prestataire de signature
// (signature.mjs) : la CLÉ de télétransmission (`SCRIBA_CONTROLE_LEGALITE_API_CLE`)
// ne doit jamais quitter le serveur — un navigateur, une page ouverte, un
// journal de poste la laisserait fuir.
//
// Les réglages viennent du `.env` du déploiement (variables
// `SCRIBA_CONTROLE_LEGALITE_*`, voir variables.mjs), et de là seulement : ils
// sont reçus par `createControleLegalite({ api, cle })` :
//
//   transport        service | demonstration — « demonstration » n'appelle rien
//   url              racine de l'API d'envoi (@ctes, ou le concentrateur local)
//   chemin           point de terminaison de la transmission, relatif à `url`
//   destinataire     le libellé du destinataire, porté au certificat
//   mode             le vocabulaire du canal (« ctes »)
//   timeoutMs        délai maximal d'un appel
//
// Le service TRANSMET, et c'est tout : il ne fabrique jamais l'accusé de
// réception. Quand l'API n'est pas branchée — faute d'adresse ou de clé —, le
// service le DIT (motif), et l'appelant (actes.mjs) en tire un certificat
// marqué `demonstration: true`, dont la mention porte la réserve. C'est la
// distinction que l'audit exige (NC-IV-004) : jamais un certificat d'apparence
// réelle sans appel réel.
//
// Module pur (aucune dépendance à Node hors `fetch`, disponible depuis Node 18) :
// il s'éprouve seul, avec un `fetchImpl` de banc, et `server.mjs` l'injecte dans
// `actes.mjs`.
// ============================================================================

const texte = (v) => (v === undefined || v === null ? "" : String(v).trim());

const joindre = (base, chemin) => String(base || "").replace(/\/+$/, "") + "/" + String(chemin || "").replace(/^\/+/, "");

// Le premier champ non vide parmi les chemins possibles. Le vocabulaire d'un
// concentrateur @ctes n'est pas normalisé : on lit les formes connues, sans
// exiger d'un outil existant qu'il renomme ses champs.
const premier = (objet, noms) => {
  for (const n of noms) {
    const v = n.split(".").reduce((o, k) => (o == null ? o : o[k]), objet);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return "";
};

export function createControleLegalite({ api = {}, cle = "", fetchImpl = fetch, journal = () => {} } = {}) {
  const reglages = () => ({
    transport: api.transport === "demonstration" ? "demonstration" : "service",
    url: texte(api.url),
    chemin: texte(api.chemin) || "/transmissions",
    destinataire: texte(api.destinataire) || "Préfecture — contrôle de légalité",
    mode: texte(api.mode) || "ctes",
    timeoutMs: Math.max(1000, Number(api.timeoutMs) || 20000),
  });

  // La transmission est RÉELLEMENT branchée quand le transport est « service »,
  // qu'une adresse est renseignée ET que la clé est là : une adresse sans clé
  // n'ouvrirait qu'un guichet anonyme, ce qu'un contrôle de légalité refuse.
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
      chemin: r.chemin,
      destinataire: r.destinataire,
      mode: r.mode,
      timeoutMs: r.timeoutMs,
      cle: !!texte(cle),
      motif: !texte(r.url)
        ? "aucune adresse d'API de contrôle de légalité : la transmission reste simulée"
        : r.transport === "demonstration"
          ? "transport « demonstration » : aucun appel sortant"
          : !texte(cle)
            ? "clé d'API absente (SCRIBA_CONTROLE_LEGALITE_API_CLE) : le service n'appelle pas le contrôle de légalité"
            : "",
    };
  };

  async function appeler(url, corps, { timeoutMs } = {}) {
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    const duree = Math.max(1000, Number(timeoutMs) || reglages().timeoutMs);
    const minuteur = ctrl ? setTimeout(() => ctrl.abort(), duree) : null;
    const t0 = Date.now();
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers: {
          "accept": "application/json",
          "content-type": "application/json",
          // La clé ne sort que d'ici, et seulement vers l'API @ctes.
          "authorization": "Bearer " + texte(cle),
          "x-scribae-service": "controle-legalite",
        },
        body: JSON.stringify(corps),
        signal: ctrl ? ctrl.signal : undefined,
      });
      const brut = await res.text();
      let data = null;
      try { data = brut ? JSON.parse(brut) : null; } catch (e) { data = null; }
      journal({ url, statut: res.status, ms: Date.now() - t0, reference: texte(premier(data, ["reference", "accuseReception", "id"])) });
      return { status: res.status, ok: res.ok, data, texte: brut };
    } catch (e) {
      if (e && e.name === "AbortError") {
        throw new Error(`Le contrôle de légalité n'a pas répondu en ${Math.round(duree / 1000)} s.`);
      }
      journal({ url, statut: 0, ms: Date.now() - t0, erreur: String((e && e.message) || e) });
      throw new Error(`Contrôle de légalité injoignable : ${(e && e.message) || e}`);
    } finally {
      if (minuteur) clearTimeout(minuteur);
    }
  }

  // --------------------------------------------------------------------------
  // TRANSMETTRE un acte signé, et rendre l'accusé de réception.
  //
  // Rend `{ reference, recuLe, statut, brute }` — ou LÈVE, en le disant : un
  // refus du contrôle de légalité n'est jamais converti en certificat. C'est
  // l'appelant qui décide quoi en faire ; ce module n'écrit aucun état.
  // --------------------------------------------------------------------------
  async function transmettre({ acteId = "", numero = "", objet = "", nature = "", entityName = "", dateSignature = "", akn = "", empreinte = "", urlDocument = "", auteur = "", entite = "", destinataire = "" } = {}) {
    if (!actif()) throw new Error(etat().motif || "Le contrôle de légalité n'est pas configuré.");
    const r = reglages();
    const url = joindre(r.url, r.chemin);
    const res = await appeler(url, {
      acteId, numero, objet, nature, entityName, dateSignature,
      destinataire: texte(destinataire) || r.destinataire,
      mode: r.mode,
      auteur, entite,
      empreinte,
      document: { format: "akn", contenu: akn, url: urlDocument || undefined },
    });
    if (!res.ok) {
      const detail = res.texte ? " — " + res.texte.slice(0, 240) : "";
      throw new Error(`Le contrôle de légalité a refusé la transmission (${res.status})${detail}.`);
    }
    const reference = texte(premier(res.data, ["reference", "accuseReception", "numeroAR", "referenceAR", "id"]));
    if (!reference) throw new Error("Le contrôle de légalité a accepté la transmission, mais n'a rendu aucune référence d'accusé de réception.");
    const recuLe = texte(premier(res.data, ["recuLe", "dateReception", "horodatage", "date", "receivedAt"])) || new Date().toISOString();
    const destinataireRecu = texte(premier(res.data, ["destinataire", "autorite", "service"])) || texte(destinataire) || r.destinataire;
    return { reference, recuLe, destinataire: destinataireRecu, statut: res.status, brute: res.data };
  }

  return { actif, etat, transmettre, reglages };
}
