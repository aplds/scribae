// ============================================================================
// Acte modificatif : sa clôture est celle de l'acte modifié — `node --test`.
//
// Un acte modificatif est un acte comme les autres : il se referme comme
// l'acte qu'il modifie (voies de recours, publication). Prendre toutes les
// mentions du référentiel y ajoutait des doublons contradictoires — voire la
// mention « version consolidée », qui n'a rien à y faire — là où l'acte
// d'origine n'en porte que deux.
// ============================================================================
import test from "node:test";
import assert from "node:assert/strict";

async function charger(chemin) {
  try { return await import(chemin); }
  catch (e) { return null; }
}

const config = () => ({
  entities: [{ id: "ent-vsl", name: "Ville de Valmont-sur-Loire", code: "VSL", seatCity: "Valmont-sur-Loire" }],
  mentions: [
    { id: "men-recours", kind: "recours", label: "Voies de recours", text: "RECOURS publication." },
    { id: "men-publication", kind: "publication", label: "Publication", text: "PUBLICATION recueil." },
    { id: "men-consolidee", kind: "publication", label: "Portée informationnelle", text: "CONSOLIDEE informationnel." },
    { id: "men-recours-notification", kind: "recours", label: "Recours notification", text: "RECOURS notification." },
    { id: "men-affichage", kind: "publication", label: "Affichage", text: "AFFICHAGE mairie." },
  ],
  numbering: {},
  brand: {},
  vocab: {},
});

const noeud = (type, patch = {}) => ({ id: "n-base", type, when: "", notes: [], ...patch });

const base = () => ({
  kind: "original",
  meta: {
    numero: "2026-429-VSL", designation: "Arrêté", dateSignature: "2026-11-25",
    entity: { id: "ent-vsl", name: "Ville de Valmont-sur-Loire", code: "VSL" },
  },
  nodes: [
    noeud("title", { text: "Arrêté" }),
    noeud("article", { eId: "art_1", numLabel: "Article 1er", blocks: [noeud("para", { text: "Ancienne rédaction." })] }),
    noeud("signature", {}),
    noeud("mention", { mentionId: "men-recours", kind: "recours", text: "RECOURS publication." }),
    noeud("mention", { mentionId: "men-affichage", kind: "publication", text: "AFFICHAGE mairie." }),
  ],
});

const plan = () => ([
  {
    action: "replace", targetEId: "art_1",
    target: { eId: "art_1", numLabel: "Article 1er" },
    blocks: [{ type: "para", text: "Nouvelle rédaction." }],
    heading: "",
  },
]);

const meta = () => ({
  numero: "2026-473-VSL", designation: "Arrêté", dateSignature: "2026-10-01",
  entityId: "ent-vsl", objet: "Modification", addEntry: false, addExecution: false,
  visas: [], considerants: [],
});

const mentionsDe = (doc) => (doc.nodes || []).filter((n) => n.type === "mention").map((n) => n.text);

test("modificatif : il se referme comme l'acte modifié", async (t) => {
  const amend = await charger("../src/lib/amend.js");
  if (!amend) return t.skip("module indisponible hors navigateur");
  const doc = amend.buildModificatif(base(), plan(), meta(), config());
  assert.deepEqual(mentionsDe(doc), ["RECOURS publication.", "AFFICHAGE mairie."]);
  assert.ok(!mentionsDe(doc).join(" ").includes("CONSOLIDEE"), "aucune mention « version consolidée » sur un modificatif");
});

test("modificatif : sans mentions sur la base, la paire standard", async (t) => {
  const amend = await charger("../src/lib/amend.js");
  if (!amend) return t.skip("module indisponible hors navigateur");
  const b = base();
  b.nodes = b.nodes.filter((n) => n.type !== "mention");
  const doc = amend.buildModificatif(b, plan(), meta(), config());
  assert.deepEqual(mentionsDe(doc), ["RECOURS publication.", "PUBLICATION recueil."]);
});

test("consolidee : elle garde les mentions de l'acte", async (t) => {
  const amend = await charger("../src/lib/amend.js");
  if (!amend) return t.skip("module indisponible hors navigateur");
  const doc = amend.buildConsolidated(base(), plan(), { ...meta(), eli: "" }, config(), {});
  assert.deepEqual(mentionsDe(doc), ["RECOURS publication.", "AFFICHAGE mairie."]);
});
