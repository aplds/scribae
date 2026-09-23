// ============================================================================
// SEMER UNE CIBLE — de la matière pour une campagne qui veut dire quelque chose.
//
// POURQUOI. Une étude de charge sur un service vide ne mesure que des lectures
// de listes vides : elle ne dit rien du coût réel d'un registre peuplé, d'un
// recueil public garni, ni de la réécriture de l'état de publication. Ce module
// garnit la cible PAR SON API (jamais en écrivant dans les tables) : ce que la
// campagne mesure ensuite est donc le comportement normal du service.
//
// Deux semences, deux natures :
//   • les COLLECTIONS du référentiel (`actes`, `trames`, `informations`) — ce
//     que l'atelier lit à l'ouverture d'une session et que les agents modifient ;
//   • le RECUEIL PUBLIC (`/v1/publications`) — déposé, signé, publié par les
//     routes réelles, avec leur identifiant ELI : c'est ce que lisent les
//     visiteurs, et ce qui fait grossir l'état du service (le point sensible
//     quand la collectivité publie beaucoup).
//
// Volumétrie réglable : `--actes`, `--taille-acte`, `--publications`,
// `--trames`, `--informations`. Les valeurs par défaut approchent le jeu de
// démonstration livré (soixante-neuf actes de quelques dizaines de Kio).
// ============================================================================

const MENTION = "Texte produit par le test de charge de Scribae — donnée de travail, sans valeur juridique.";

// Les articles d'un acte simulé. Des paragraphes de longueur variée, comme un
// vrai acte : c'est la taille du document qui pèse à la lecture.
function corpsDeLEtat(numero, paragraphes) {
  const l = [];
  for (let i = 0; i < paragraphes; i++) {
    l.push(`<article id="art-${i + 1}"><num>Article ${i + 1}</num><paragraph><content><p>La collectivité arrête, à l'article ${i + 1} de l'acte n° ${numero}, les dispositions suivantes. ${MENTION} Les conditions d'application sont précisées par le service compétent, après avis de la commission consultative et information de l'assemblée délibérante.</p></content></paragraph></article>`);
  }
  return l.join("");
}

const aknDe = (numero, objet, articles) => `<?xml version="1.0" encoding="UTF-8"?>
<akomaNtoso xmlns="http://docs.oasis-open.org/legaldocml/ns/akn/3.0">
<act name="acte">
<meta><identification source="#scribae">
<FRBRWork><FRBRthis value="eli:/fr/ar/2026/${numero}"/><FRBRuri value="eli:/fr/ar/2026/${numero}"/><FRBRdate date="2026-01-15" name="signature"/></FRBRWork>
<FRBRExpression><FRBRthis value="eli:/fr/ar/2026/${numero}/fra@2026-01-15"/><FRBRlanguage language="fra"/></FRBRExpression>
</identification><proprieties><p class="objet">${objet}</p></proprieties></meta>
<body><hcontainer name="dispositions"><heading>${objet}</heading>${corpsDeLEtat(numero, articles)}</hcontainer></body>
</act></akomaNtoso>`;

const htmlDe = (numero, objet, articles) => `<article class="acte" data-numero="${numero}"><h1>${objet}</h1><p class="identite">Acte n° ${numero} — donnée de travail du test de charge.</p>${Array.from({ length: articles }, (_, i) => `<h2>Article ${i + 1}</h2><p>La collectivité arrête, à l'article ${i + 1} de l'acte n° ${numero}, les dispositions suivantes. ${MENTION}</p>`).join("")}</article>`;

const texteDe = (numero, objet, articles) => [`Acte n° ${numero}`, objet, ""].concat(Array.from({ length: articles }, (_, i) => `Article ${i + 1}. La collectivité arrête les dispositions suivantes. ${MENTION}`)).join("\n");

// L'empreinte du service est calculée sur le document : on laisse le SERVICE la
// calculer (il ne nous croit pas), on lui rend simplement le même `akn` au retour
// de signature.
function empreinteSimple(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0").repeat(8).slice(0, 64);
}

async function appel(client, pot, chemin, { method = "GET", corps } = {}) {
  const r = await client.envoyer(pot, { method, chemin, corps });
  if (r.status >= 400) {
    throw new Error(`${method} ${chemin} → ${r.status} ${JSON.stringify(r.json || r.texte).slice(0, 200)}`);
  }
  return r.json;
}

// Le mot de passe des comptes de charge : conforme aux règles du service
// (longueur, trois sortes de caractères, et jamais l'identifiant du compte).
export const MDP_DE_CHARGE = "Scribae!Mesure-2026";

// Les comptes dont une campagne a besoin : un par rôle, plus un visiteur sans
// rôle (qui n'a accès qu'au recueil public). Ils sont créés DANS le référentiel
// de la cible et portent la source « charge » : ils se repèrent donc, et se
// retirent, sans ambiguïté.
export const ROLES_DE_CHARGE = [
  { role: "editeur", login: "charge-edition" },
  { role: "redacteur", login: "charge-redaction" },
  { role: "reviseur", login: "charge-revision" },
  { role: "signataire", login: "charge-signature" },
  { role: "lecteur", login: "charge-lecture" },
];

// Crée les comptes de charge et leur donne un mot de passe : les postes simulés
// se connectent ensuite POUR DE VRAI (le service dérive le mot de passe à chaque
// connexion — c'est un coût que la campagne doit voir).
export async function semerComptes(client, pot, roles = ROLES_DE_CHARGE) {
  const comptes = roles.map((r) => ({
    id: r.login,
    login: r.login,
    civility: "",
    firstName: "Compte",
    lastName: "de charge",
    role: r.role,
    roles: [r.role],
    active: true,
    memberships: [],
    source: "charge",
  }));
  await appel(client, pot, "/v1/db/collections/users/sync", {
    method: "POST",
    corps: { upserts: comptes.map((c, i) => ({ id: c.id, rev: null, ord: i, payload: c })), deletes: [], force: true },
  });
  const out = {};
  for (const c of comptes) {
    await appel(client, pot, `/v1/auth/comptes/${encodeURIComponent(c.id)}/mot-de-passe`, {
      method: "POST",
      corps: { motDePasse: MDP_DE_CHARGE, mustChange: false },
    });
    out[c.role] = { login: c.login, motDePasse: MDP_DE_CHARGE, userId: c.id };
  }
  return out;
}

// ---------------------------------------------------------------------------
// La semence. `compte` : `{ actes, trames, informations, publications,
// tailleActe }`. Rend un résumé (ce qui a été créé), pour le rapport.
// ---------------------------------------------------------------------------
export async function semer(client, pot, {
  actes = 60, trames = 25, informations = 8, publications = 12, tailleActe = 45000,
  entite = "commune-de-charge", code = "ar", annee = "2026",
} = {}) {
  const resume = { actes: 0, trames: 0, informations: 0, publications: 0, erreurs: [] };
  const articles = Math.max(3, Math.min(120, Math.round(tailleActe / 1200)));

  // --- les trames -----------------------------------------------------------
  const listeTrames = [];
  for (let i = 1; i <= trames; i++) {
    listeTrames.push({
      id: `tpl-charge-${String(i).padStart(3, "0")}`,
      name: `Trame de charge n° ${i}`,
      actTypeId: "at-arrete",
      status: "publie",
      serviceId: null,
      bureauId: null,
      version: 1,
      fields: [
        { id: "objet", label: "Objet", type: "text" },
        { id: "visas", label: "Visas", type: "textarea" },
        { id: "signataire", label: "Signataire", type: "signataire" },
      ],
      plan: [{ type: "paragraph", text: "Article 1. Objet de l'acte." }],
    });
  }
  await appel(client, pot, "/v1/db/collections/trames/sync", {
    method: "POST",
    corps: { upserts: listeTrames.map((t, i) => ({ id: t.id, rev: null, ord: i, payload: t })), deletes: [], force: true },
  });
  resume.trames = listeTrames.length;

  // --- les actes du registre ------------------------------------------------
  const listeActes = [];
  for (let i = 1; i <= actes; i++) {
    const numero = `${annee}-${String(i).padStart(4, "0")}`;
    const objet = `Acte de charge n° ${numero} portant dispositions diverses`;
    listeActes.push({
      id: `acte-charge-${String(i).padStart(4, "0")}`,
      numero,
      objet,
      nature: "Arrêté",
      statut: i % 5 === 0 ? "signe" : "brouillon",
      trameId: listeTrames[(i - 1) % listeTrames.length].id,
      serviceId: null,
      bureauId: null,
      entityId: entite,
      dateSignature: "2026-01-15",
      createdBy: "charge",
      createdByName: "Test de charge",
      sha256: empreinteSimple(numero),
      values: { objet, visas: MENTION, signataire: "" },
      texte: texteDe(numero, objet, articles),
    });
  }
  // Par lots : un lot de 200 enregistrements tient dans une requête, et le
  // service refuse au-delà de `MAX_SYNC_RECORDS`.
  for (let i = 0; i < listeActes.length; i += 200) {
    const lot = listeActes.slice(i, i + 200);
    await appel(client, pot, "/v1/db/collections/actes/sync", {
      method: "POST",
      corps: { upserts: lot.map((a, j) => ({ id: a.id, rev: null, ord: i + j, payload: a })), deletes: [], force: true },
    });
  }
  resume.actes = listeActes.length;

  // --- les informations du recueil ------------------------------------------
  const listeInfos = [];
  for (let i = 1; i <= informations; i++) {
    listeInfos.push({
      id: `info-charge-${String(i).padStart(3, "0")}`,
      titre: `Information de charge n° ${i}`,
      texte: `${MENTION} Cette communication est publiée au recueil pour la campagne de mesure.`,
      date: `2026-0${1 + (i % 9)}-1${i % 9}`,
      auteur: "Test de charge",
      publie: true,
    });
  }
  if (listeInfos.length) {
    await appel(client, pot, "/v1/db/collections/informations/sync", {
      method: "POST",
      corps: { upserts: listeInfos.map((x, i) => ({ id: x.id, rev: null, ord: i, payload: x })), deletes: [], force: true },
    });
    resume.informations = listeInfos.length;
  }

  // --- le recueil public : dépôt, signature, publication ---------------------
  // Chaque publication traverse les routes RÉELLES : c'est ce qui donne au
  // recueil sa matière, et c'est aussi le geste le plus coûteux du service (il
  // réécrit l'état complet à chaque fois).
  for (let i = 1; i <= publications; i++) {
    const numero = `${annee}-${String(900 + i).padStart(4, "0")}`;
    const objet = `Acte publié de charge n° ${numero}`;
    const akn = aknDe(numero, objet, articles);
    try {
      const depot = await appel(client, pot, "/v1/actes", {
        method: "POST",
        corps: { akn, numero, objet, nature: "Arrêté", themeId: "theme-charge", themeLabel: "Charge", entityId: entite, entityName: "Collectivité de charge", dateSignature: "2026-01-15" },
      });
      const id = depot.id;
      const ouverture = await appel(client, pot, `/v1/actes/${id}/signature`, {
        method: "POST",
        corps: { signataires: [{ nom: "Signataire de charge", fonction: "Maire", ordre: 1 }], niveau: "simple", api: { transport: "demonstration" } },
      });
      await appel(client, pot, "/v1/webhooks/signature", {
        method: "POST",
        corps: {
          signatureId: ouverture.signatureId,
          statut: "signee",
          documentSigne: {
            document: { akn, sha256: depot.sha256 },
            signatures: [{ signataire: { nom: "Signataire de charge", fonction: "Maire" }, signeLe: "2026-01-16T09:00:00.000Z", algorithme: "SHA-256" }],
            horodatage: { at: "2026-01-16T09:00:00.000Z", source: "test de charge" },
          },
        },
      });
      await appel(client, pot, `/v1/actes/${id}/publication`, {
        method: "POST",
        corps: {
          html: htmlDe(numero, objet, articles),
          akn,
          md: texteDe(numero, objet, articles),
          texte: texteDe(numero, objet, articles),
          jsonld: JSON.stringify({ "@id": `eli:/fr/${code}/${annee}/${numero}/${entite}`, titre: objet }),
          eliUri: `eli:/fr/${code}/${annee}/${numero}/${entite}`,
          dateDocument: "2026-01-15",
          datePublication: "2026-01-16",
          dateOpposabilite: "2026-01-17",
          themeId: "theme-charge",
          themeLabel: "Charge",
          recueil: "Recueil des actes de la collectivité de charge",
          kind: "originale",
          numero,
          nature: "Arrêté",
          objet,
          entityCode: entite,
          original: {
            format: "application/vnd.actes.original-signe+json",
            document: { akn, sha256: depot.sha256 },
            signatures: [{ signataire: { nom: "Signataire de charge", fonction: "Maire" }, signeLe: "2026-01-16T09:00:00.000Z", algorithme: "SHA-256" }],
            horodatage: { at: "2026-01-16T09:00:00.000Z", source: "test de charge" },
          },
        },
      });
      resume.publications += 1;
    } catch (e) {
      resume.erreurs.push(`publication ${i} : ${e.message}`);
    }
  }

  return resume;
}
