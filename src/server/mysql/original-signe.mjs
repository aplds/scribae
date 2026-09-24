// ============================================================================
// L'ORIGINAL SIGNÉ — la règle de sa part publique, écrite UNE fois.
//
// Un original signé a DEUX parts :
//
//   • sa part PUBLIQUE — le document figé à la signature, ses signatures, son
//     horodatage, la page qui présente la signature. C'est elle qui part au
//     recueil et que tout le monde peut lire ;
//   • son DOSSIER INTERNE (`interne`) — ce qui identifie le signataire au sens
//     des données personnelles : son adresse électronique, son rattachement à un
//     compte, le compte que l'outil de signature lui connaît, l'état du
//     rapprochement, et la trace des courriels qui lui ont été adressés. Elle
//     reste au registre et ne se lit qu'avec une session
//     (`/v1/actes/{id}/dossier-signature`).
//
// `sansInterne` est LE point unique où la frontière est tracée : c'est la seule
// garantie que rien de nominatif ne fuit par une route qu'on aurait oublié de
// fermer. La règle était écrite deux fois (ici et dans `src/lib/signature.js`,
// sous le nom `partiePublique`) : elle ne l'est plus — les deux l'importent d'ici
// (voir l'audit, NC-I-004).
//
// POURQUOI CE FICHIER EST SOUS `src/server/mysql/` ET NON SOUS `src/lib/` :
// l'image Docker du service se construit avec `src/server/mysql/` pour contexte
// (voir mysql/Dockerfile et docker-compose.yml) — un fichier hors de ce dossier
// n'existerait pas dans l'image. Le navigateur, lui, importe ce module par son
// chemin relatif (`../server/mysql/original-signe.mjs`) : `src/` est servi tel
// quel, et le module est PUR — aucun DOM, aucun accès réseau, aucune dépendance
// — donc les deux s'en servent sans réserve.
//
// Le service de DÉMONSTRATION (`index.html`, `<script type="text/x-server-plugin">`)
// garde sa copie : son contexte d'exécution n'importe pas de modules. Un test la
// tient, elle, pour équivalente au comportement de ce module (voir
// src/tests/original-signe.test.mjs) : la duplication ne peut plus dériver en
// silence.
// ============================================================================

// Les mentions NOMINATIVES du signataire qui ne se publient pas. Ce qui reste —
// nom, fonction — est ce que la signature donne à lire au public.
export const CHAMPS_INTERNES = ["courriel", "personId", "compteId", "compteOutil", "rapproche"];

export function sansInterne(v) {
  if (!v || typeof v !== "object") return v;
  const { interne, ...reste } = v;
  if (!Array.isArray(v.signatures)) return reste;
  return {
    ...reste,
    signatures: v.signatures.map((s) => {
      const sig = { ...((s && s.signataire) || {}) };
      for (const champ of CHAMPS_INTERNES) delete sig[champ];
      return { ...s, signataire: sig };
    }),
  };
}

// Le nom que portait la règle côté application : la même fonction, sous son nom
// d'usage (`partiePublique` de `src/lib/signature.js`, repris par les écrans).
export const partiePublique = sansInterne;
