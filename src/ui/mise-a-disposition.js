// ============================================================================
// Mettre une trame à disposition des services — et la retirer.
//
// Une trame se prépare à l'abri. Tant qu'un éditeur ne l'a pas MISE À
// DISPOSITION, elle reste un brouillon que nul autre que l'atelier ne voit, et
// aucun service ne peut rédiger à partir d'elle. C'est la règle générale de
// l'application, et le geste qui la lève engage : les services rédigeront des
// actes officiels sur ce modèle.
//
// Le geste se fait à deux endroits — la carte de la trame dans la liste, et la
// tête de l'éditeur de trame — donc il vit ici, une seule fois, avec sa
// confirmation. Voir `mettreTrameADisposition` / `retirerTrame` (ui/state.js)
// pour la mutation elle-même, qui journalise le fait.
// ============================================================================
import { state, mettreTrameADisposition, retirerTrame, trameEstDisponible } from "./state.js";
import { button, toast } from "./dom.js";
import { confirmDialog } from "./components.js";

export { trameEstDisponible };

// Le bouton, dans ses deux états. `variant` et `size` sont laissés à l'appelant :
// la carte de la liste et la bannière de l'éditeur ne lui donnent pas la même
// importance, mais c'est le même geste.
export function boutonDisponibilite(trame, { variant = "secondary", size = "", court = false } = {}) {
  if (trameEstDisponible(trame)) {
    return button(court ? "Retirer" : "Retirer la mise à disposition", {
      variant: "tertiary", size, icon: "lock",
      title: "Retirer la trame : elle redevient un brouillon, invisible des services",
      onClick: () => retirerMiseADisposition(trame),
    });
  }
  return button("Mettre à disposition", {
    variant, size, icon: "partage",    title: trame.status === "archived"
      ? "Sortir la trame des archives et la mettre à disposition des services"
      : "Ouvrir la trame aux services : ils pourront rédiger des actes à partir d'elle",
    onClick: () => mettreADisposition(trame),
  });
}

// Mettre à disposition : la confirmation insiste sur ce qu'il faut avoir relu,
// parce que c'est le dernier moment où l'on voit la trame seul — après, elle est
// entre les mains des services.
export async function mettreADisposition(trame, { redraw = () => {} } = {}) {
  const ok = await confirmDialog(
    "Mettre la trame à disposition",
    `« ${trame.name} » deviendra visible des services de son périmètre, qui pourront rédiger des actes à partir d'elle.` +
      " Relisez d'abord son texte, ses questions et ses contrôles : c'est exactement ce que les services auront sous les yeux.",
    { confirmLabel: "Mettre à disposition" },
  );
  if (!ok) return false;
  await mettreTrameADisposition(trame);
  toast("Trame mise à disposition des services", "success");
  redraw();
  return true;
}

// Retirer : la trame redevient un brouillon. Les actes déjà rédigés à partir
// d'elle ne sont pas touchés — ils portent leur propre copie du texte et des
// valeurs — et le message le dit, pour éviter le malentendu.
export async function retirerMiseADisposition(trame, { redraw = () => {} } = {}) {
  const n = state.actes.filter((a) => a.trameId === trame.id && !a.deletedAt).length;
  const ok = await confirmDialog(
    "Retirer la trame",
    `« ${trame.name} » redevient un brouillon : les services ne la verront plus, et ne pourront plus partir d'elle.` +
      (n ? ` Les ${n} acte(s) déjà rédigés à partir d'elle ne sont pas touchés — ils gardent leur texte et leurs valeurs.` : ""),
    { confirmLabel: "Retirer", danger: true },
  );
  if (!ok) return false;
  await retirerTrame(trame);
  toast("Trame retirée — de nouveau en brouillon", "warning");
  redraw();
  return true;
}
