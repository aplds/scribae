// ============================================================================
// Signature & publication — LA PRÉSENTATION DU CIRCUIT.
//
// Les marches d'un circuit de signature, telles que l'écran les montre : chaque
// porte (acte finalisé, parapheur, révision, dépôt, envoi, signature, contrôle
// de légalité, publication), son état, ses dates, ses empreintes. C'est un
// module de PRÉSENTATION : il n'appelle aucun service et ne modifie rien — il
// lit l'acte, rend la liste des marches, et `stepEl` les dessine.
//
// Détaché de `signature.js` (voir NC-I-003) pour que ce dernier reste lisible :
// les GESTES (envoyer en signature, signer, publier) vivent là-bas, la
// DESCRIPTION du circuit vit ici. Le vocabulaire de la publication
// (`pubNonJuridique` et ses dérivés) accompagne ces marches, puisque c'est lui
// qui les intitule.
// ============================================================================
import { state, controleLegaliteParApi, controleLegaliteDeclaratif, revisionRequisePour } from "../state.js";
import { h } from "../dom.js";
import { apiStatus } from "../../lib/remote.js";
import { formatDate } from "../../lib/util.js";
import { natureOfActe } from "../../lib/annexes.js";
import { etapesDuCircuit } from "../../lib/parcours.js";
import { normalizeUrl } from "../../lib/eli.js";
import { natureJuridiqueDe } from "../../lib/schema.js";
import { PRESTATAIRE } from "../../lib/signature.js";
import {
  versionSignee, certificationDe, dossierSimple, signeeSimple,
  dossierInterneSignature, signeeInterne,
} from "../../lib/externe.js";
import { destinataireDeCompte } from "../../lib/courriel.js";

// ---------------------------------------------- publier, oui ; faire droit, non
// Un verbatim de séance, une déclaration, un vœu se publient au recueil sans
// jamais devenir opposables. Ces trois aides disent la chose d'un seul endroit,
// pour que les marches du circuit, le journal et la notification s'accordent :
// quand la publication porte `juridique:false`, on n'annonce ni opposabilité ni
// date d'entrée en vigueur — on dit « publié », et « document non opposable ».
export const pubNonJuridique = (p) => !!p && p.juridique === false;
const titreEtapePublication = (p) => (pubNonJuridique(p) ? "Publié au recueil" : "Publié et opposable");
const lignesEtapePublication = (p) => [`ELI ${p.eliUri}`, pubNonJuridique(p) ? "Document non opposable" : `Opposable le ${formatDate(p.dateOpposabilite)}`];
// La publication pas encore franchie : elle n'existe pas encore, mais la nature
// du document dit déjà ce qu'elle sera — un verbatim, une déclaration, un vœu
// se publient « au recueil », sans opposabilité. Sans cela, la marche porterait
// « Publié et opposable » avant même que l'acte ne soit publié.
const publicationAttendue = (acte) => acte.publication || { juridique: natureJuridiqueDe(acte) };
const lignesAttentePublication = (p) => (pubNonJuridique(p)
  ? ["En attente de publication au recueil", "Document non opposable"]
  : ["En attente de publication"]);

export function statusBadgeEl() {
  const s = apiStatus();
  const map = {
    online: ["success", "Service joignable"],
    connecting: ["info", "Connexion au service…"],
    offline: ["warning", "Reconnexion au service…"],
    error: ["error", "Service en erreur"],
    blocked: ["error", "Service refusé (adresse non autorisée)"],
    unavailable: ["warning", "Service indisponible ici"],
  };
  const [color, label] = map[s.status] || map.unavailable;
  return h("span", { id: "api-status", class: "fr-badge fr-badge--" + color, title: s.detail || "", text: label });
}

// L'acte sur lequel s'ouvre le circuit : le premier qui attend encore un geste
// (rédigé, non signé, sans contrôle bloquant) ; à défaut, le dernier acte signé,
// plutôt que le premier de la liste (qui peut être un brouillon incomplet). Une
// ANNEXE ne suit pas le circuit de signature : elle est écartée du choix par
// défaut, même si elle reste dans la liste (pour qu'on puisse lire pourquoi).
export function defaultCircuitActe(acts, docs) {
  const estAnnexe = (a) => natureOfActe(a, state.trames) === "annexe";
  const signed = (a) => !!(a.original || a.statut === "signee" || a.statut === "publie");
  const blocking = (a) => (a.issues || docs.get(a.id)?.issues || []).some((i) => i.level === "blocking");
  const candidats = acts.filter((a) => !estAnnexe(a));
  return candidats.find((a) => !signed(a) && !blocking(a) && a.kind !== "consolide")
    || candidats.find((a) => !signed(a) && !blocking(a))
    || candidats.find(signed)
    || candidats[0]
    || acts[0];
}

// `sansObjet` : la marche n'a pas été franchie alors que l'acte est allé plus
// loin (voir `marquerEtats`, src/lib/parcours.js). Elle se dessine creuse, et sa
// pastille porte un tiret plutôt qu'un numéro : on ne la présente pas comme la
// marche à venir.
export function stepEl(n, title, done, lines, sansObjet) {
  return h("div", { class: "sig-step" + (done ? " is-done" : "") + (sansObjet ? " is-so" : "") },
    h("span", { class: "sig-step__dot", text: done ? "✓" : sansObjet ? "–" : String(n) }),
    h("div", { class: "sig-step__body" },
      h("p", { class: "sig-step__title", text: title }),
      ...(lines || []).map((l) => h("p", { class: "sig-step__line", text: l })),
    ),
  );
}

// Les marches du circuit de signature, dans l'ordre — SANS numérotation : le
// numéro est la position dans cette liste. La marche « Parapheur » n'y figure
// que si un circuit s'applique à l'acte, et la marche « Transmis au
// contrôle de légalité » que si la sienne l'est : la liste, plutôt qu'une suite
// d'appels numérotés à la main, évite un trou dans la numérotation.
//
// LA PLACE DE CHAQUE PORTE. Ces marches ne sont pas interchangeables, et leur
// ordre n'est pas celui qu'on devine : le PARAPHEUR d'abord (le circuit du
// référentiel, achevé), puis la RÉVISION (le contrôle du réviseur compétent),
// puis la signature. La mention de position le dit en toutes lettres, en plus
// du fil de parcours affiché au-dessus (voir src/lib/parcours.js) : c'est ce qui
// répond à « qui passe avant qui, et où est la révision par rapport au
// circuit ? ». Dans le circuit externe, la révision n'est pas en amont : elle
// devient la certification de conformité, APRÈS la signature.
const POSITION_REVISION = "Place : après le parapheur, et avant la signature — le réviseur contrôle le TEXTE, non la pièce signée.";
const POSITION_CERTIFICATION = "Place : après la signature, et avant la publication — le contrôle porte sur la PIÈCE signée déposée.";

// L'acte est-il allé jusqu'à la signature ? Sert à distinguer une marche qui
// ATTEND (l'acte est encore en deçà) d'une marche PASSÉE SANS ÊTRE FRANCHIE
// (l'acte est déjà signé sans elle — donnée d'avant la fonction, ou contrôle non
// requis ce jour-là). On ne présente pas les deux de la même façon.
const acteDejaSigne = (a) => !!(a && (a.original || a.statut === "signee" || a.statut === "publie"));

// Les lignes de la marche « Parapheur » : l'avancement, puis les étapes du
// circuit vues de l'intérieur — leur nature (vérification, visa, signature) et
// qui les tient. Un parapheur ne se réduit pas à un compteur : c'est là que se
// lit l'imbrication avec la révision, puisque le circuit s'ouvre souvent par une
// vérification confiée au réviseur, alors que la révision, elle, est une porte
// distincte, franchie après le circuit.
function lignesParapheur(validation, config) {
  if (!validation) return [];
  return etapesDuCircuit(null, validation, null, config).map((s, i) =>
    `${i + 1}. ${s.label} — ${s.nature}${s.optional ? " (facultative)" : ""} — ${s.titulaire || "titulaire à désigner"} — ${s.fait ? "franchie" : s.statutLabel}`);
}

export function etapesCircuit({ parapheur, validation, para, paraAvancement, circuit, blocking, doc, acte, signed, publiable, rev, controleLegalite, transmission, config }) {
  const etapes = [{
    title: "Acte finalisé",
    done: !!(acte.values || acte.doc),
    lines: [
      blocking.length ? `${blocking.length} contrôle(s) bloquant(s) : la signature est déconseillée` : "Aucun contrôle bloquant",
      doc?.meta?.eli ? "ELI pressenti : " + normalizeUrl(doc.meta.eli) : "",
    ].filter(Boolean),
  }];
  if (parapheur) {
    etapes.push(validation
      ? {
        title: "Parapheur — " + (validation.circuitLabel || "circuit de validation"),
        done: para.ok,
        lines: [
          `${paraAvancement.faites}/${paraAvancement.total} étape(s) franchie(s)`,
          ...lignesParapheur(validation, config),
          para.ok ? "" : para.raison,
        ].filter(Boolean),
      }
      : {
        title: "Parapheur",
        done: true,
        lines: [circuit ? "Aucun circuit ouvert : l'acte part en signature sans validation préalable." : "Aucun circuit ne s'applique à cet acte."],
      });
  }
  // La marche de la révision n'apparaît que si un réviseur est compétent pour
  // l'acte : sans réviseur, il n'y a pas de contrôle à montrer.
  if (rev?.requise) {
    const r = acte.revision;
    // L'acte est déjà signé et la révision n'est pas franchie : la porte a été
    // passée sans être empruntée (donnée antérieure à la fonction, ou contrôle
    // non requis ce jour-là). On le dit, plutôt que d'annoncer une marche qui
    // attendrait encore sur un acte publié.
    const passee = !rev.ok && acteDejaSigne(acte);
    const rejet = r && r.statut === "rejete";
    // Le statut de la révision n'est PAS annoncé « en attente » quand la porte a
    // été passée : il n'attend plus rien, l'acte est signé. Le rejet, lui, est
    // conservé — il explique pourquoi le contrôle n'a pas été franchi.
    const statut = !r ? "Pas encore soumis au réviseur"
      : rejet ? "Rejeté : " + (r.motif || "motif au dossier")
        : r.statut === "en_attente" ? "En attente" + (r.demandeeParNom ? ` (soumis par ${r.demandeeParNom})` : "")
          : `${r.valideParNom || "révisé"} le ${formatDate(String(r.valideLe || "").slice(0, 10))}${r.corrige ? " · texte corrigé" : ""}`;
    etapes.push({
      title: "Révision — contrôle avant signature",
      done: rev.ok,
      sansObjet: passee,
      lines: [
        POSITION_REVISION,
        passee && !rejet ? "" : statut,
        passee ? "Non franchie : l'acte est allé plus loin sans ce contrôle (aucune révision au dossier)." : (rev.ok ? "" : rev.raison),
      ].filter(Boolean),
    });
  }
  etapes.push({
    title: "Déposé au service",
    done: !!acte.api?.acteId,
    lines: acte.api
      ? [`Identifiant ${acte.api.acteId}`, acte.api.sha256 ? "Empreinte SHA-256 " + acte.api.sha256.slice(0, 16) + "…" : ""].filter(Boolean)
      : ["En attente d'envoi"],
  });
  etapes.push({
    title: "Envoyé en signature",
    done: !!(acte.api?.statut && acte.api.statut !== "depose"),
    lines: acte.api?.signataire ? [`Signataire : ${acte.api.signataire}`, `Prestataire : ${PRESTATAIRE.nom}`] : ["En attente"],
  });
  etapes.push({
    title: "Signé",
    done: !!(acte.original || acte.statut === "signee" || acte.statut === "publie"),
    lines: acte.original
      ? [`Signé le ${formatDate(String(acte.original.signatures?.[0]?.signeLe || "").slice(0, 10))}`, (acte.original.signatures?.[0]?.certificat?.sujet || "")]
      : ["En attente de la signature"],
  });
  // La transmission au contrôle de légalité s'intercale ICI : après le retour
  // signé, avant la publication. Elle n'existe que si la fonction est active, et
  // son attente dit le RÉGIME : l'API d'envoi, ou la déclaration du réviseur.
  if (controleLegalite) {
    const attendu = controleLegaliteParApi() ? "En attente de la télétransmission (API @ctes)"
      : controleLegaliteDeclaratif() ? "En attente de la déclaration de transmission du réviseur"
        : "En attente de la constatation de la transmission";
    etapes.push({
      title: "Transmis au contrôle de légalité",
      done: !!transmission,
      lines: transmission
        ? [transmission.certificat?.mention || `Transmis le ${formatDate(transmission.at)}`, transmission.destinataire ? `à ${transmission.destinataire}` : "", transmission.ref ? `réf. ${transmission.ref}` : "", transmission.certificat?.sceau ? `sceau ${String(transmission.certificat.sceau).slice(0, 16)}…` : ""].filter(Boolean)
        : [attendu],
    });
  }
  etapes.push(publiable
    ? {
      title: titreEtapePublication(publicationAttendue(acte)),
      done: acte.statut === "publie" && !!acte.publication,
      lines: acte.publication ? lignesEtapePublication(acte.publication) : lignesAttentePublication(publicationAttendue(acte)),
    }
    : {
      title: "Non publié (acte individuel)",
      done: signed,
      lines: ["La trame a déclaré cet acte non publiable.", "L'acte signé est conservé au registre et notifié à l'intéressé."],
    });
  return etapes;
}

// ---------------------------------------------- les marches du circuit externe
// Le circuit SANS API : le document est remis au signataire (téléchargé), signé
// hors de l'application, puis déposé en PDF — et le RÉVISEUR certifie que la
// pièce signée est conforme à la version numérique qui sera publiée. Les
// marches du parapheur restent, quand la fonction est active : elles portent sur
// le texte, en amont, et ne dépendent pas du mode de signature.
export function etapesExterne({ parapheur, validation, para, paraAvancement, circuit, blocking, doc, acte, publiable, config }) {
  const etapes = [{
    title: "Acte finalisé",
    done: !!(acte.values || acte.doc),
    lines: [
      blocking.length ? `${blocking.length} contrôle(s) bloquant(s) : la remise au signataire est déconseillée` : "Aucun contrôle bloquant",
      doc?.meta?.eli ? "ELI pressenti : " + normalizeUrl(doc.meta.eli) : "",
    ].filter(Boolean),
  }];
  if (parapheur) {
    etapes.push(validation
      ? {
        title: "Parapheur — " + (validation.circuitLabel || "circuit de validation"),
        done: para.ok,
        lines: [
          `${paraAvancement.faites}/${paraAvancement.total} étape(s) franchie(s)`,
          ...lignesParapheur(validation, config),
          para.ok ? "" : para.raison,
        ].filter(Boolean),
      }
      : {
        title: "Parapheur",
        done: true,
        lines: [circuit ? "Aucun circuit ouvert : le document est remis au signataire sans validation préalable." : "Aucun circuit ne s'applique à cet acte."],
      });
  }
  // La révision en amont n'est pas une marche de ce circuit : le contrôle du
  // réviseur a lieu APRÈS la signature, sur la pièce signée (marche suivante).
  // Si l'acte a tout de même été révisé, sa trace est conservée ici.
  if (acte.revision) {
    const r = acte.revision;
    etapes.push({
      title: "Révision — contrôle du texte",
      done: r.statut === "valide",
      lines: [
        "Place : le contrôle du texte, s'il a eu lieu, précède la remise au signataire — il ne conditionne pas le circuit externe, dont le contrôle porte sur la pièce signée (marche « certificat » ci-dessous).",
        r.statut === "valide"
          ? `Révisé par ${r.valideParNom || "—"} le ${formatDate(String(r.valideLe || "").slice(0, 10))}`
          : "Révision non aboutie : elle ne conditionne pas le circuit externe (le contrôle porte sur la pièce signée).",
      ],
    });
  }
  etapes.push({
    title: "Document remis au signataire",
    done: !!acte.externe,
    lines: acte.externe
      ? [
        `Remis le ${formatDate(String(acte.externe.demandeLe || "").slice(0, 10))}${acte.externe.demandeParNom ? " par " + acte.externe.demandeParNom : ""}`,
        acte.externe.document?.empreinte ? "Empreinte du document remis " + acte.externe.document.empreinte : "",
        "Signature hors de l'application (papier ou outil tiers).",
      ].filter(Boolean)
      : ["En attente : « Envoyer à signature » télécharge le document prêt à signer."],
  });
  const sg = versionSignee(acte);
  etapes.push({
    title: "Version signée déposée",
    done: !!sg,
    lines: sg
      ? [
        `${sg.nom || "document signé"}${sg.taille ? " (" + tailleLisible(sg.taille) + ")" : ""}`,
        `Déposé le ${formatDate(String(sg.deposeLe || "").slice(0, 10))}${sg.deposeParNom ? " par " + sg.deposeParNom : ""}`,
        sg.sha256 ? "Empreinte SHA-256 " + String(sg.sha256).slice(0, 16) + "…" : "",
      ].filter(Boolean)
      : ["En attente du dépôt de la version signée (PDF)."],
  });
  // La certification de conformité — la marche propre au réviseur dans ce
  // circuit. Elle n'existe que si un réviseur est compétent pour l'acte. Avant
  // la remise du document, le dossier n'existe pas encore : on interroge alors
  // la compétence des réviseurs, pour annoncer la marche à venir.
  const requise = acte.externe ? !!acte.externe.certificationRequise : revisionRequisePour(acte);
  const cert = certificationDe(acte) || {};
  // Même règle que pour la révision : un acte déjà publié sans certification
  // (donnée d'avant la fonction, ou contrôle non requis ce jour-là) a PASSÉ la
  // porte sans l'emprunter. On ne l'annonce pas comme une marche à venir.
  const certPassee = cert.statut !== "conforme" && acte.statut === "publie";
  etapes.push(requise
    ? {
      title: "Conformité certifiée par le réviseur",
      done: cert.statut === "conforme",
      sansObjet: certPassee,
      lines: [
        POSITION_CERTIFICATION,
        cert.statut === "conforme" ? `Certifié conforme par ${cert.parNom || "—"} le ${formatDate(String(cert.le || "").slice(0, 10))}`
          : cert.statut === "non_conforme" ? "Conformité refusée" + (cert.motif ? " : " + cert.motif : "")
            : certPassee ? "" : "En attente : le réviseur compare la pièce signée à la version numérique.",
        certPassee ? "Non franchie : l'acte est publié sans certification au dossier." : "",
        "La certification porte sur la PIÈCE signée, non sur le texte avant signature.",
      ].filter(Boolean),
    }
    : {
      title: "Conformité certifiée par le réviseur",
      done: !!sg,
      lines: ["Aucun réviseur n'est compétent pour cet acte : la certification n'est pas requise.", "L'acte est publié sur la foi de la version signée déposée."],
    });
  etapes.push(publiable
    ? {
      title: titreEtapePublication(publicationAttendue(acte)),
      done: acte.statut === "publie" && !!acte.publication,
      lines: acte.publication ? lignesEtapePublication(acte.publication) : lignesAttentePublication(publicationAttendue(acte)),
    }
    : {
      title: "Non publié (acte individuel)",
      done: !!sg,
      lines: ["La trame a déclaré cet acte non publiable.", "L'acte signé est conservé au registre et notifié à l'intéressé."],
    });
  return etapes;
}

// Les destinataires « côté administration » d'un acte : son rédacteur, et les
// comptes qui portent le rôle d'éditeur — ceux qu'un retour signé intéresse.
export function destinatairesAdministration(acte) {
  const createur = state.users.find((u) => u.id === acte.createdBy);
  return [createur, ...state.users.filter((u) => u.id !== createur?.id && (u.roles || [u.role] || []).includes("editeur"))]
    .map((u) => destinataireDeCompte(u)).filter(Boolean);
}

// Les marches du circuit simple — et du circuit INTERNE, qui suit les mêmes
// portes : pas de remise, pas de dépôt de PDF, pas de certification. Le document
// est vérifié puis signé, et le dossier interne est la dernière marche avant la
// publication. Ce qui les distingue tient en un mot : DANS l'application, la clé
// est sur le poste du signataire ; par le SERVICE, elle est dans son coffre.
export function etapesSimple({ parapheur, validation, para, paraAvancement, circuit, blocking, doc, acte, publiable, rev, config, interne = false }) {
  const etapes = [{
    title: "Acte finalisé",
    done: !!(acte.values || acte.doc),
    lines: [
      blocking.length ? `${blocking.length} contrôle(s) bloquant(s) : la signature est déconseillée` : "Aucun contrôle bloquant",
      doc?.meta?.eli ? "ELI pressenti : " + normalizeUrl(doc.meta.eli) : "",
    ].filter(Boolean),
  }];
  if (parapheur) {
    etapes.push(validation
      ? {
        title: "Parapheur — " + (validation.circuitLabel || "circuit de validation"),
        done: para.ok,
        lines: [
          `${paraAvancement.faites}/${paraAvancement.total} étape(s) franchie(s)`,
          ...lignesParapheur(validation, config),
          para.ok ? "" : para.raison,
        ].filter(Boolean),
      }
      : {
        title: "Parapheur",
        done: true,
        lines: [circuit ? "Aucun circuit ouvert : l'acte part en signature sans validation préalable." : "Aucun circuit ne s'applique à cet acte."],
      });
  }
  if (rev?.requise) {
    const r = acte.revision;
    const passee = !rev.ok && acteDejaSigne(acte);
    const statut = !r ? "Pas encore soumis au réviseur"
      : r.statut === "rejete" ? "Rejeté : " + (r.motif || "motif au dossier")
        : r.statut === "en_attente" ? "En attente" + (r.demandeeParNom ? ` (soumis par ${r.demandeeParNom})` : "")
          : `${r.valideParNom || "révisé"} le ${formatDate(String(r.valideLe || "").slice(0, 10))}`;
    etapes.push({
      title: "Révision — contrôle avant signature",
      done: rev.ok,
      sansObjet: passee,
      lines: [
        POSITION_REVISION,
        passee && !(r && r.statut === "rejete") ? "" : statut,
        passee ? "Non franchie : l'acte est allé plus loin sans ce contrôle (aucune révision au dossier)." : (rev.ok ? "" : rev.raison),
      ].filter(Boolean),
    });
  }
  const d = (interne ? dossierInterneSignature(acte) : dossierSimple(acte)) || {};
  etapes.push({
    title: interne ? "Signé par le service (coffre interne)" : "Signé dans l'application",
    done: interne ? signeeInterne(acte) : signeeSimple(acte),
    lines: (interne ? signeeInterne(acte) : signeeSimple(acte))
      ? [
        `Signé le ${formatDate(String(d.signeLe || "").slice(0, 10), "date-long")}`,
        d.parNom ? (interne ? "Par " : "Par ") + d.parNom : "",
        d.empreinte ? "Empreinte SHA-256 " + String(d.empreinte).slice(0, 16) + "…" : "",
        interne ? "La clé privée n'a jamais quitté le coffre du service." : "",
      ].filter(Boolean)
      : [interne
        ? "En attente : le signataire vérifie le document, puis le service signe avec la clé qu'il détient."
        : "En attente : le signataire vérifie le document, puis le signe avec son compte."],
  });
  etapes.push({
    title: "Dossier de signature (interne)",
    done: !!(d.interne && d.interne.signataire),
    lines: d.interne
      ? [
        d.interne.signataire?.courriel ? "Adresse du signataire : " + d.interne.signataire.courriel : "",
        d.interne.authentification || "",
        "Ces mentions ne sont pas diffusées : le public ne voit que le nom, la fonction et la date.",
      ].filter(Boolean)
      : [interne
        ? "Constitué par le service à la signature (identité, certificat, poste de l'opérateur, authentification)."
        : "Constitué à la signature (adresse, compte, moyen d'authentification)."],
  });
  etapes.push({
    title: "Déposé au service",
    done: !!acte.api?.acteId,
    lines: acte.api ? [`Identifiant ${acte.api.acteId}`, acte.api.sha256 ? "Empreinte SHA-256 " + acte.api.sha256.slice(0, 16) + "…" : ""].filter(Boolean) : ["En attente du dépôt (au premier geste de signature)."],
  });
  etapes.push(publiable
    ? {
      title: titreEtapePublication(publicationAttendue(acte)),
      done: acte.statut === "publie" && !!acte.publication,
      lines: acte.publication ? lignesEtapePublication(acte.publication) : lignesAttentePublication(publicationAttendue(acte)),
    }
    : {
      title: "Non publié (acte individuel)",
      done: signeeSimple(acte),
      lines: ["La trame a déclaré cet acte non publiable.", "L'acte signé est conservé au registre et notifié à l'intéressé."],
    });
  return etapes;
}

export const tailleLisible = (n) => {
  const b = Number(n) || 0;
  if (b < 1024) return b + " o";
  if (b < 1024 * 1024) return Math.round(b / 1024) + " Ko";
  return (b / 1024 / 1024).toFixed(1) + " Mo";
};
