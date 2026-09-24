// ============================================================================
// LE MAGASIN — le contrat de stockage du service, et l'algorithme commun.
//
// POURQUOI CE FICHIER EXISTE. Le service range trois choses, et une seule
// question se pose : OÙ ?
//
//   • les COLLECTIONS — référentiel, trames, actes, comptes… enregistrement par
//     enregistrement, avec une révision par enregistrement, une révision par
//     collection, un contrôle de conflit et un journal technique ;
//   • l'ÉTAT de signature et de publication — un document JSON unique ;
//   • les JOURNAUX — le journal technique (qui a écrit quoi) et la trace des
//     courriels expédiés.
//
// Jusqu'ici la réponse était « MariaDB », et elle seule. Une collectivité qui
// n'a pas de serveur de base de données — un poste, une petite mairie, une
// machine où l'on ne veut qu'un seul logiciel à administrer — n'avait donc pas
// de déploiement possible, alors que le volume de données d'un service d'actes
// tient dans quelques mégaoctets. Le magasin FICHIER (voir magasin-fichier.mjs)
// répond à ce cas : `STOCKAGE=fichier` range tout dans un dossier (`DATA_DIR`,
// `./data` par défaut), en clair, sauvegardable par une simple copie.
//
// CE QUI EST PARTAGÉ, ET CE QUI NE L'EST PAS. Le PROTOCOLE est identique pour
// les deux rangements : mêmes collections, mêmes révisions, mêmes conflits,
// même journal. C'est ce que voit l'application — elle ne doit pas pouvoir
// distinguer une installation MariaDB d'une installation à fichiers —, et c'est
// aussi ce qui rend les deux éprouvables par les mêmes épreuves. Ce qui change,
// c'est la seule ÉCRITURE : une transaction SQL d'un côté, un fichier réécrit
// d'un bloc de l'autre. L'algorithme de synchronisation vit donc ICI, une fois,
// et chaque magasin n'apporte que ses primitives (lire, écrire, supprimer,
// journaliser) et la clôture transactionnelle.
//
// LE CONTRAT. Les deux fabriques — `creerMagasinMysql` (magasin-mysql.mjs) et
// `creerMagasinFichier` (magasin-fichier.mjs) — rendent le MÊME objet :
//
//   type                      « mysql » | « fichier »
//   resume                    { driver, partagee, message, base: { hote, port, schema } }
//   store                     le magasin des COMPTES (voir comptes.mjs)
//   lireConfig()              le document du référentiel (collection « config », id « self »)
//   lireEtat()                { etat, degrade } — l'état signature/publication
//   ecrireEtat(json)          remplace l'état d'un bloc
//   lireCollection(nom)       [{ id, rev, ord, payload }], triés (ord, id)
//   lireRevisionCollection(nom)   la révision d'une collection
//   synchroniser({…})         l'écriture par lots : révisions, conflits, journal
//   sante()                   { moteur, collections } — LÈVE si le rangement est injoignable
//   journaliserCourriel(…)    la trace d'un courriel expédié (ou non)
//   derniersCourriels(n)      les dernières traces, du plus récent au plus ancien
//   preparer(journal)         migrations (MySQL), ou création du dossier (fichiers)
//   fermer()                  libère ce qui doit l'être (le pool MySQL)
//
// `sante()` est le seul point qui peut lever en fonctionnement normal : c'est
// lui qui répond à « le rangement est-il joignable ? », et le service s'en sert
// pour son bandeau de panne et son remède (voir server.mjs, `noterBase`).
// ============================================================================

// ------------------------------------------------------------------ projections
// Recopie dans des colonnes indexées les champs utiles aux recherches. Aucune de
// ces colonnes n'est saisie à la main : elles découlent du document. Le magasin
// FICHIER ne s'en sert pas — il n'a pas de colonnes —, mais la RÈGLE (« quels
// champs sont indexés ») n'existe qu'ici : si un jour une recherche s'appuie sur
// une projection, les deux rangements la porteront au même endroit.
export const str = (v) => (v === undefined || v === null || v === "" ? null : String(v).slice(0, 64));

export function projections(collection, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (collection === "actes") {
    return { numero: str(p.numero), statut: str(p.statut), service_id: str(p.serviceId), bureau_id: str(p.bureauId), entity_id: str(p.entityId), kind: str(p.nature) };
  }
  if (collection === "trames") {
    return { numero: null, statut: str(p.status), service_id: str(p.serviceId), bureau_id: str(p.bureauId), entity_id: null, kind: str(p.actTypeId) };
  }
  if (collection === "users") {
    const first = Array.isArray(p.memberships) && p.memberships[0] ? p.memberships[0].serviceId : null;
    return { numero: null, statut: str(p.role), service_id: str(first), bureau_id: null, entity_id: str(p.entityId), kind: null };
  }
  return { numero: null, statut: null, service_id: null, bureau_id: null, entity_id: null, kind: null };
}

// --------------------------------------------------------- l'écriture par lots
// L'ALGORITHME DE SYNCHRONISATION, écrit UNE fois. Il reçoit `t` — l'objet
// transactionnel fourni par le magasin — et rien d'autre : les primitives
// ci-dessous sont les seules choses que les deux rangements aient à savoir
// faire.
//
// `t` : lireRevision(nom), ecrireRevision(nom, n), lireEnregistrement(nom, id),
//       ecrireEnregistrement(nom, { id, rev, ord, payload, projections, actor }),
//       supprimerEnregistrement(nom, id), journaliser([{ collection, recordId,
//       action, revision, actor, ip }]).
//
// `force` écrase sans contrôle de révision : geste de reprise réservé à
// l'administration (voir NC-II-004 et P-17). L'appelant l'a déjà refusé au
// visiteur non administrateur — ici on ne fait que l'honorer.
//
// Le journal technique est facultatif (`trace`), pour les collections qui sont
// elles-mêmes un flux (présence des postes, journal d'audit) : les y inscrire
// produirait un bruit continu sans valeur d'audit.
export async function synchroniser(t, {
  collection,
  upserts = [],
  deletes = [],
  force = false,
  actor = "",
  ip = "",
  trace = true,
} = {}) {
  let revision = await t.lireRevision(collection);
  const applied = [];
  const conflicts = [];
  const journal = [];

  for (const u of upserts) {
    if (!u || u.id === undefined || u.id === null) continue;
    const id = String(u.id).slice(0, 191);
    const cur = await t.lireEnregistrement(collection, id);
    if (!force) {
      if (cur && cur.rev !== (Number(u.rev) || 0)) { conflicts.push({ id, rev: cur.rev, ord: cur.ord, payload: cur.payload }); continue; }
      if (!cur && u.rev) { conflicts.push({ id, deleted: true, rev: 0 }); continue; }
    }
    revision += 1;
    const payload = u.payload === undefined ? null : u.payload;
    await t.ecrireEnregistrement(collection, {
      id, rev: revision, ord: Number(u.ord) || 0, payload,
      projections: projections(collection, payload), actor,
    });
    applied.push({ id, rev: revision });
    journal.push({ collection, recordId: id, action: cur ? (force ? "force" : "update") : "insert", revision, actor, ip });
  }

  for (const d of deletes) {
    if (!d || d.id === undefined || d.id === null) continue;
    const id = String(d.id).slice(0, 191);
    const cur = await t.lireEnregistrement(collection, id);
    if (!cur) continue;
    if (!force && cur.rev !== (Number(d.rev) || 0)) { conflicts.push({ id, rev: cur.rev, ord: cur.ord, payload: cur.payload }); continue; }
    await t.supprimerEnregistrement(collection, id);
    revision += 1;
    applied.push({ id, rev: 0, deleted: true });
    journal.push({ collection, recordId: id, action: "delete", revision, actor, ip });
  }

  // La révision de la collection n'avance QUE si quelque chose a été appliqué :
  // une synchronisation qui n'a produit que des conflits ne change rien, et ne
  // doit donc pas faire croire à une écriture.
  if (applied.length) {
    await t.ecrireRevision(collection, revision);
    if (trace && journal.length) await t.journaliser(journal);
  }
  return { revision, applied, conflicts };
}
