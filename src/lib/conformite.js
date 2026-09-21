// ============================================================================
// Rapport de conformité d'un acte — la fiche de contrôle du réviseur.
//
// Le réviseur reçoit, pour chaque acte qui lui est soumis, un rapport détaillé
// de ce qui est vérifiable AUTOMATIQUEMENT : les contrôles de la trame (champs
// obligatoires, règles), la structure du document, les visas et les références
// qu'ils appellent, les mentions obligatoires, la publicité de l'acte, les
// écarts de rédaction et les annotations du trame.
//
// Le rapport ne décide de rien : il éclaire. Beaucoup de points ne sont pas
// vérifiables par une machine — l'opportunité, la légalité de fond, le style.
// Le réviseur les apprécie, et c'est lui qui valide ou rejette : le rapport est
// une pièce de son dossier, pas un juge.
//
// Les niveaux sont ceux de l'application :
//   erreur     un contrôle bloquant est en défaut, ou une pièce obligatoire
//              manque : la signature est déconseillée en l'état ;
//   attention  un point à vérifier de près (avertissement de la trame, écart,
//              contrainte juridique, mention vide) ;
//   info       ce qui est bon à savoir (publicité, nombre de visas, versions) ;
//   ok         un contrôle qui passe (le rapport dit aussi ce qui va bien).
//
// Ce module est pur : il ne connaît ni le DOM ni l'état de l'application.
// ============================================================================
import { interpolate } from "./compile.js";
import { articlesOf } from "./amend.js";
import { formatDate } from "./util.js";

export const NIVEAUX = {
  erreur: { label: "Erreur", color: "error", icone: "✗" },
  attention: { label: "À vérifier", color: "warning", icone: "!" },
  info: { label: "Information", color: "info", icone: "i" },
  ok: { label: "Conforme", color: "success", icone: "✓" },
};

const GROUPES = [
  { id: "identite", label: "Identité de l'acte" },
  { id: "trame", label: "Contrôles de la trame" },
  { id: "structure", label: "Structure du document" },
  { id: "refs", label: "Visas et références" },
  { id: "publicite", label: "Mentions et publicité" },
  { id: "redaction", label: "Écarts et annotations" },
];

const texteDe = (n) => String(n?.text || "").trim();

// Une référence « de cette nature pour cette entité » : la plus précise d'abord
// (voir findScopedRef dans src/lib/compile.js — même règle de résolution).
function referencePour(config, kind, entityId) {
  const refs = config?.refs || [];
  return refs.find((r) => r.kind === kind && r.entityId === entityId && r.active !== false)
    || refs.find((r) => r.kind === kind && !r.entityId && r.active !== false)
    || null;
}

export function rapportConformite(doc, { config = {}, trame = null, acte = null, publiable = true } = {}) {
  const a = acte || {};
  const vals = a.values || {};
  const meta = doc?.meta || {};
  const nodes = doc?.nodes || [];
  // Une ANNEXE n'est pas un acte signé : elle est adoptée par un autre, et c'est
  // cet acte qui est signé — son texte suit l'acte d'adoption dans l'original
  // signé (voir src/lib/annexe-docs.js). Les contrôles de signature sont donc
  // sans objet pour elle, et le rapport ne les réclame pas.
  const estAnnexe = meta.nature === "annexe";
  const parId = {};
  const groupes = GROUPES.map((g) => (parId[g.id] = { ...g, checks: [] }));
  const check = (groupe, id, niveau, label, detail = "") =>
    parId[groupe].checks.push({ id, niveau, label, detail });

  const noeud = (type) => nodes.find((n) => n.type === type);
  const duTitre = (type) => (trame?.body || []).find((n) => n.type === type) || null;

  // ------------------------------------------------------------ identité
  const numero = vals.numero || meta.numero || "";
  check("identite", "numero", numero ? "ok" : "erreur",
    numero ? `Numéro attribué — n° ${numero}` : "Aucun numéro attribué",
    numero ? "" : "Le numéro identifie l'acte dans le registre et compose son identifiant ELI : il doit être attribué avant la signature.");

  const objet = String(vals.objet || meta.objet || "").trim();
  check("identite", "objet", objet ? "ok" : "erreur",
    objet ? "Objet renseigné" : "Objet manquant",
    objet || "L'objet de l'acte doit être renseigné : il est repris dans les métadonnées de la publication.");

  const dateSignature = vals.dateSignature || meta.dateSignature || "";
  if (estAnnexe) {
    check("identite", "date-signature", dateSignature ? "ok" : "erreur",
      dateSignature ? "Date d'adoption renseignée" : "Date d'adoption manquante",
      dateSignature ? formatDate(dateSignature, "date-long") : "L'annexe porte la date de l'acte qui l'adopte : elle figure sur son identité au registre et dans son intitulé.");
  } else {
    check("identite", "date-signature", dateSignature ? "ok" : "erreur",
      dateSignature ? "Date de signature renseignée" : "Date de signature manquante",
      dateSignature ? formatDate(dateSignature, "date-long") : "Le document porte la date de signature au bas de l'acte.");
  }

  const dateEffet = vals.dateEffet || "";
  if (dateEffet && dateSignature && dateEffet < dateSignature) {
    check("identite", "date-effet", "attention", "La date d'effet précède la date de signature",
      `Entrée en vigueur le ${formatDate(dateEffet, "date-long")}, signature le ${formatDate(dateSignature, "date-long")}.`);
  } else if (dateEffet) {
    check("identite", "date-effet", "ok", "Date d'effet renseignée", formatDate(dateEffet, "date-long"));
  } else {
    check("identite", "date-effet", "info", "Aucune date d'effet",
      "L'entrée en vigueur suivra la règle générale : le lendemain de la publication, sauf disposition contraire.");
  }

  const entite = meta.entity;
  check("identite", "entite", entite ? "ok" : "erreur",
    entite ? "Entité signataire identifiée" : "Aucune entité signataire résolue",
    entite ? entite.name : "Le document ne se rattache à aucune entité du référentiel : la formule d'autorité et la valeur juridique de l'acte en dépendent.");

  const signataire = meta.signataire;
  if (estAnnexe) {
    check("identite", "signataire", "info", "Annexe — pas de signataire propre",
      "Une annexe ne se signe pas : c'est l'acte qui l'adopte qui est signé, et sa signature lui donne son autorité. Le texte de l'annexe suit cet acte dans l'original signé.");
  } else {
    check("identite", "signataire", signataire ? "ok" : "erreur",
      signataire ? "Signataire identifié" : "Aucun signataire identifié",
      signataire
        ? [[signataire.civility, signataire.firstName, signataire.lastName].filter(Boolean).join(" "), signataire.delegue ? "par délégation" : ""].filter(Boolean).join(" · ")
        : "Un acte sans signataire identifié ne peut pas être signé : il faut renseigner l'autorité.");
  }

  // Une délégation de la chaîne dont une décision manque n'établit pas
  // solidement le pouvoir de signer : les deux décisions — la nomination et la
  // délégation — se désignent sur la fiche de la délégation (écran Délégations)
  // par un acte publié au recueil ou par un lien externe, et l'acte publié les
  // vise avec leur lien. On le signale sans bloquer : une installation
  // antérieure peut avoir des délégations à compléter, et l'acte reste signable.
  const chainesIncompletes = signataire?.delegationsIncompletes || [];
  if (chainesIncompletes.length) {
    check("identite", "chaine-delegation", "attention",
      chainesIncompletes.length > 1 ? `${chainesIncompletes.length} délégations sans leurs décisions` : "Une délégation sans ses décisions",
      chainesIncompletes.map((x) => `${x.acteur} — ${x.manque.join(" et ")}`).join(" ; ")
        + ". Une délégation de signature s'établit par ses deux décisions : complétez la fiche du délégataire dans l'écran Délégations.");
  }

  // Un ACTE D'ASSEMBLÉE (délibération) émane d'un conseil : sa ligne d'autorité
  // est celle de l'assemblée, et l'acte est signé par le président de celle-ci.
  // On le constate, et l'on vérifie que le signataire — ou un délégataire de sa
  // chaîne — tient bien la qualité que l'assemblée appelle (le maire, le
  // président du conseil d'administration…). Voir src/lib/conseils.js.
  const conseil = meta.conseil;
  if (conseil && !estAnnexe) {
    check("identite", "assemblee", "ok", `Acte d'assemblée — ${conseil.name || "assemblée"}`,
      `La ligne d'autorité est celle de l'assemblée : « ${conseil.authorityFormula || ""} ».`);
    if (conseil.signerRoleId) {
      const ids = [signataire?.id, ...((signataire?.chaine || []).map((c) => c.id))].filter(Boolean);
      const porte = ids.some((id) => ((config.people || []).find((p) => p.id === id)?.roles || []).includes(conseil.signerRoleId));
      const role = (config.roles || []).find((r) => r.id === conseil.signerRoleId);
      check("identite", "assemblee-signataire", porte ? "ok" : "attention",
        porte ? `Signataire compétent pour l'assemblée — ${role?.label || conseil.signerRoleId}` : "Le signataire ne porte pas la qualité appelée par l'assemblée",
        porte ? "" : `L'assemblée « ${conseil.name || ""} » fait signer sous la qualité « ${role?.label || conseil.signerRoleId} » : vérifiez que le signataire — ou un délégataire de sa chaîne — tient bien ce rôle (Administration › Personnes).`);
    }
  }

  const typeActe = (config.actTypes || []).find((t) => t.id === meta.actTypeId);  check("identite", "type", typeActe ? "ok" : "attention",
    typeActe ? "Type d'acte reconnu — " + typeActe.label : "Type d'acte inconnu du référentiel",
    typeActe ? "" : `Le type « ${meta.actTypeId || "—"} » n'est pas dans le référentiel : la nature de l'acte et sa référence ELI peuvent être inexactes.`);

  // ------------------------------------------------------------ trame
  const issues = doc?.issues || [];
  if (!issues.length) {
    check("trame", "aucun", "ok", "Aucun contrôle de la trame en défaut");
  } else {
    issues.forEach((it, i) => {
      const niveau = it.level === "blocking" ? "erreur" : it.level === "warning" ? "attention" : "info";
      check("trame", "issue-" + (it.id || i) + "-" + i, niveau, it.message || it.id || "Contrôle de la trame",
        it.field ? `Champ concerné : ${(trame?.fields || []).find((f) => f.id === it.field)?.label || it.field}` : "");
    });
  }

  // ------------------------------------------------------------ structure
  const titre = noeud("title");
  check("structure", "intitule", texteDe(titre) ? "ok" : "erreur",
    texteDe(titre) ? "Intitulé de l'acte" : "Intitulé manquant",
    texteDe(titre));

  if (duTitre("authority")) {
    const autorite = noeud("authority");
    check("structure", "autorite", texteDe(autorite) ? "ok" : "attention",
      texteDe(autorite) ? "Ligne d'autorité" : "Ligne d'autorité vide",
      texteDe(autorite) || "La trame prévoit une ligne d'autorité : la formule n'a pas pu être composée (entité ou qualité manquante).");
  }

  if (duTitre("enact")) {
    const enact = noeud("enact");
    check("structure", "formule", texteDe(enact) ? "ok" : "erreur",
      texteDe(enact) ? `Formule d'édiction — « ${texteDe(enact)} »` : "Formule d'édiction manquante");
  }

  // Les articles du dispositif, divisions comprises : un règlement rangé en
  // Titres et Chapitres a bien un dispositif, et il compte.
  const articles = articlesOf(doc);
  check("structure", "dispositif", articles.length ? "ok" : "erreur",
    articles.length ? `Dispositif composé de ${articles.length} article(s)` : "Aucun article au dispositif",
    articles.length ? articles.map((x) => x.numLabel).filter(Boolean).join(" · ") : "Un acte sans dispositif ne décide rien.");

  const sansContenu = articles.filter((x) => !(x.blocks || []).some((b) => (
    (b.type === "list" ? (b.items || []).length : b.type === "table" ? (b.rows || []).length : String(b.text || "").trim() !== "") )));
  if (sansContenu.length) {
    check("structure", "articles-vides", "attention",
      `${sansContenu.length} article(s) sans contenu`,
      sansContenu.map((x) => x.numLabel || "article").join(" · ") + " — clause conditionnelle non remplie, ou article resté à compléter.");
  }

  const blocSignature = noeud("signature");
  if (estAnnexe) {
    check("structure", "signature", "info", "Annexe — pas de bloc de signature",
      "L'annexe ne porte pas de signature : elle tient son autorité de l'acte qui l'adopte, dont l'original est suivi de son texte.");
  } else {
    check("structure", "signature", blocSignature ? "ok" : "erreur",
      blocSignature ? "Bloc de signature" : "Bloc de signature manquant",
      blocSignature ? [blocSignature.place, blocSignature.date].filter(Boolean).join(" · ") : "Le document doit porter le lieu, la date et le signataire.");
  }

  // ------------------------------------------------------ visas et références
  const visas = noeud("visas");
  const visasTrame = duTitre("visas");
  const itemsTrame = (visasTrame?.items || []);
  if (itemsTrame.length) {
    const produits = visas?.items || [];
    if (produits.length) {
      check("refs", "visas", "ok", `${produits.length} visa(s) portés sur l'acte`, produits.map((v) => v.text).join(" · ").slice(0, 400));
    } else {
      check("refs", "visas-vides", "attention", "Aucun visa porté sur l'acte",
        "La trame prévoit des visas, mais aucun n'a pu être composé : vérifier les références « de cette nature pour l'entité » et les champs conditionnels.");
    }
    const entityId = meta.entity?.id || "";
    for (const it of itemsTrame) {
      if (it.refKind && !referencePour(config, it.refKind, entityId)) {
        check("refs", "visa-refkind-" + it.id, "attention",
          `Le visa « ${it.refKind} » ne trouve aucune référence`,
          `Aucune référence de nature « ${it.refKind} » n'est en vigueur dans le référentiel pour cette entité : le visa sera absent de l'acte.`);
      }
      if (it.refId && !it.refKind) {
        const id = interpolate(it.refId, doc?.ctx || {});
        const ref = (config.refs || []).find((r) => r.id === id);
        if (ref && ref.active === false) {
          check("refs", "visa-ref-" + it.id, "attention", `Référence citée retirée du référentiel — ${ref.label}`,
            "Le visa cite une référence déclarée comme n'étant plus en vigueur : à vérifier.");
        }
      }
    }
  }

  // ------------------------------------------------------ mentions & publicité
  const mentions = nodes.filter((n) => n.type === "mention");
  for (const n of mentions) {
    if (!texteDe(n)) {
      check("publicite", "mention-vide-" + n.path, "attention", "Mention prévue par la trame restée vide",
        `Le bloc de mention (${n.kind || "nature non précisée"}) est vide à la compilation : vérifier le libellé choisi dans le référentiel.`);
    }
  }
  if (publiable) {
    check("publicite", "publiable", "info", "Acte publiable — déposé au recueil",
      `Il recevra son identifiant ELI (${meta.eli || "à composer"}) et sera opposable à sa publication.`);
  } else {
    check("publicite", "non-publiable", "info", "Acte individuel non publiable",
      "La trame est déclarée non publiable : l'acte est conservé au registre et notifié à l'intéressé, sans passer par le recueil.");
  }

  // ------------------------------------------------------ écarts & annotations
  const ecarts = a.ecarts || doc?.ecarts || [];
  if (ecarts.length) {
    check("redaction", "ecarts", "attention", `${ecarts.length} écart(s) à la trame`,
      ecarts.slice(0, 6).map((e) => e.label || e.addr).filter(Boolean).join(" · ") + (ecarts.length > 6 ? " …" : ""));
  } else {
    check("redaction", "ecarts-aucun", "ok", "Aucun écart à la trame");
  }
  for (const n of (doc?.notes || [])) {
    if (n.kind !== "legal" && n.kind !== "question") continue;
    check("redaction", "note-" + n.id, n.kind === "legal" ? "attention" : "info",
      (n.kind === "legal" ? "Contrainte juridique de la trame" : "Point à arbitrer signalé par la trame") + (n.author ? ` (${n.author})` : ""),
      (n.quote ? "« " + n.quote + " » — " : "") + (n.text || ""));
  }
  const nbVersions = (a.revisions || []).length;
  if (nbVersions) check("redaction", "versions", "info", `${nbVersions} version(s) de travail dans l'historique de l'acte`);

  // ------------------------------------------------------------ synthèse
  const tous = groupes.flatMap((g) => g.checks);
  const compte = {
    erreurs: tous.filter((c) => c.niveau === "erreur").length,
    avertissements: tous.filter((c) => c.niveau === "attention").length,
    infos: tous.filter((c) => c.niveau === "info").length,
    ok: tous.filter((c) => c.niveau === "ok").length,
  };
  return {
    le: new Date().toISOString(),
    groupes,
    compte,
    conforme: compte.erreurs === 0,
    publiable: !!publiable,
  };
}

// Phrase de synthèse, telle qu'elle se lit en tête du rapport.
export function resumeRapport(rapport) {
  const c = rapport?.compte || {};
  if (!rapport) return "";
  if (c.erreurs) return `${c.erreurs} erreur(s)` + (c.avertissements ? ` et ${c.avertissements} point(s) à vérifier` : "");
  if (c.avertissements) return `Conforme, avec ${c.avertissements} point(s) à vérifier`;
  return "Conforme aux contrôles automatiques";
}
