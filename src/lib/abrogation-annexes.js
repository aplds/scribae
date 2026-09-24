// ============================================================================
// Abroger un acte : qu'advient-il de ses ANNEXES ?
//
// C'est une question de droit avant d'être une question de code, et la réponse
// tient à la façon dont une annexe est publiée :
//
//   • une annexe qui n'a PAS de publication autonome — un tableau, une grille
//     tarifaire, un état annexé — est une PARTIE de la décision qui l'adopte :
//     elle n'existe que par elle, ne se publie que dans son texte, et elle est
//     donc **abrogée avec elle**, au même jour, sans qu'aucune clause n'ait à
//     la viser ;
//   • une annexe AUTONOME — un règlement, publié pour lui-même au recueil sous
//     son propre identifiant (`trame.reglement`, voir src/lib/annexes.js) — vit
//     sa propre vie : elle n'est **pas** emportée par l'abrogation de sa
//     décision d'adoption. Pour la retirer ou la changer, il faut un ACTE
//     AUTONOME (une délibération, un règlement) qui l'abroge ou l'adopte à
//     nouveau. L'application ne l'oublie pas : elle le SIGNALE, parce que
//     l'abrogation de la décision mère laisse sinon un texte en vigueur auquel
//     plus personne ne pense.
//
// Ce module porte cette règle seule, en fonctions PURES : il reçoit des actes
// et des trames, et rend ce que l'abrogation emporte, et ce qu'elle laisse. Il
// ne touche ni au DOM, ni au registre, ni au service.
// ============================================================================
import { annexesDe, estReglementActe } from "./annexes.js";

// Les deux sortes d'annexe, du point de vue de l'abrogation.
export const SORTES = {
  PART: "part",             // partie de la décision mère : abrogée avec elle
  AUTONOME: "autonome",     // publiée à part : survit, et doit être traitée à part
};

export const SORTE_LABEL = {
  [SORTES.PART]: "Partie de la décision mère",
  [SORTES.AUTONOME]: "Texte autonome (publié à part)",
};

// La sorte d'une annexe : sa TRAME dit si elle reçoit une publication autonome.
// Sans trame (annexe importée, ou trame supprimée), on ne lui en prête pas : le
// droit ne se devine pas, et une annexe sans publication autonome n'en a pas.
export function sorteAnnexe(annexeActe, trames) {
  return estReglementActe(annexeActe, trames) ? SORTES.AUTONOME : SORTES.PART;
}

// Les annexes d'un acte, RÉSOLUES en actes du registre : la liste des annexes
// n'est qu'une identification figée, c'est l'acte qui porte la trame (donc la
// sorte) et son identifiant ELI (donc son adresse publique).
export function annexesResolues(acteCible, { actes = [], trames = [] } = {}) {
  const refs = annexesDe(acteCible && acteCible.values);
  const out = [];
  for (const ref of refs) {
    const a = actes.find((x) => x && x.id === ref.acteId && !x.deletedAt);
    // Une annexe dont l'acte a disparu du registre reste citée : on la rend
    // telle quelle, sans sorte — on ne peut plus dire ce qu'elle est devenue.
    out.push({
      ref,
      acte: a || null,
      id: (a && a.id) || ref.acteId || "",
      numero: (a && a.numero) || ref.numero || "",
      designation: ref.designation || (a && a.designation) || "",
      eli: (a && a.eli) || ref.eli || "",
      sorte: a ? sorteAnnexe(a, trames) : SORTES.PART,
    });
  }
  return out;
}

// CE QUE L'ABROGATION D'UN ACTE FAIT À SES ANNEXES.
//
//   emportees   les annexes qui font partie de la décision mère : elles sont
//               abrogées avec elle, au même jour ;
//   autonomes   les annexes publiées à part : elles SURVIVENT, et l'application
//               doit le dire — c'est un avertissement, pas un détail.
export function effetAbrogationSurAnnexes(acteCible, { actes = [], trames = [] } = {}) {
  const toutes = annexesResolues(acteCible, { actes, trames });
  return {
    emportees: toutes.filter((a) => a.sorte === SORTES.PART),
    autonomes: toutes.filter((a) => a.sorte === SORTES.AUTONOME),
    toutes,
  };
}

// La phrase du JOURNAL, quand une annexe est emportée avec sa décision mère.
export function phraseAnnexeEmportee(annexe, decision) {
  const cible = [annexe.designation || "annexe", annexe.numero ? "n° " + annexe.numero : ""].filter(Boolean).join(" ");
  const par = [(decision && decision.numero) || "la décision mère"].filter(Boolean).join(" ");
  return `annexe ${cible} abrogée avec ${par} : elle n'a pas de publication autonome, elle fait partie de cette décision`;
}

// La phrase du JOURNAL, quand une annexe autonome survit à l'abrogation.
export function phraseAnnexeAutonome(annexe) {
  const cible = [annexe.designation || "texte", annexe.numero ? "n° " + annexe.numero : ""].filter(Boolean).join(" ");
  return `le texte autonome ${cible}${annexe.eli ? " (" + annexe.eli + ")" : ""} survit à l'abrogation : publié pour lui-même, il doit être abrogé ou modifié par un acte autonome`;
}

// Ce que l'application affiche au rédacteur qui PRÉVOIT l'abrogation d'un acte
// (avant toute entrée en vigueur) : les annexes autonomes ne seront pas
// emportées. Rend "" quand il n'y a rien à dire.
export function avertissementAnnexesAutonomes(acteCible, { actes = [], trames = [] } = {}) {
  const { autonomes } = effetAbrogationSurAnnexes(acteCible, { actes, trames });
  if (!autonomes.length) return "";
  const liste = autonomes.map((a) => [a.designation || "texte", a.numero ? "n° " + a.numero : ""].filter(Boolean).join(" ")).join(", ");
  return `Cet acte publie à part : ${liste}. L'abrogation ne l'emporte pas — un texte autonome doit être abrogé ou modifié par un acte autonome.`;
}

// La même chose, pour l'acte ABROGEANT, une fois l'abrogation appliquée : ce qui
// reste à traiter, tel qu'il est rangé sur l'acte (`annexesAutonomesRestantes`).
export function mentionAnnexesRestantes(acte) {
  const restantes = (acte && acte.annexesAutonomesRestantes) || [];
  if (!restantes.length) return "";
  const liste = restantes.map((a) => [a.designation || "texte", a.numero ? "n° " + a.numero : ""].filter(Boolean).join(" ")).join(", ");
  return `Cet acte abroge une décision qui publiait à part : ${liste}. Ce texte autonome reste en vigueur — il doit être abrogé ou modifié par un acte autonome.`;
}

// La mention portée par une ANNEXE emportée : elle n'a pas été abrogée par une
// clause qui la visait, mais par l'effet de l'abrogation de sa décision mère.
export function mentionAnnexePartDeLaMere(acte) {
  const m = acte && acte.abrogePar;
  if (!m || m.parAnnexion !== true) return "";
  return "Cet acte est une annexe sans publication autonome : il fait partie de la décision qui l'adopte, et il est abrogé avec elle, sans clause distincte.";
}
