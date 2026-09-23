// ============================================================================
// L'export PDF/A — le bouton.
//
// La fabrication du fichier est dans `src/lib/pdfa.js` : la mise en page, les
// polices embarquées, la règle de couleur et les métadonnées. Ici, on branche
// le geste : un bouton qui montre son attente, fabrique le fichier, le
// télécharge, et le dit.
//
// Le PDF/A n'est pas un « PDF » ordinaire : c'est la forme normalisée pour la
// CONSERVATION. Le fichier porte ses polices, sa règle de couleur (sRGB) et ses
// métadonnées, et reste lisible dans vingt ans tel qu'il a été produit. Deux
// niveaux sont proposés : PDF/A-2b (le défaut, bâti sur PDF 1.7) et PDF/A-1b
// (bâti sur PDF 1.4, pour les systèmes qui n'acceptent que le premier).
//
// Le bouton se désactive tout seul pendant la fabrication — plusieurs secondes
// la première fois, le temps d'aller chercher les polices et pdf-lib.
// ============================================================================
import { h, button, toast } from "./dom.js";
import { styleForDoc } from "../lib/styles.js";
import { telechargerPdfA, nomPdfA } from "../lib/pdfa.js";

// Le nom du fichier : « 2026-401-VSL-pdfa-2b.pdf », ou le préfixe demandé.
function nomFichier(doc, part, base) {
  const suffixe = part === 1 ? "pdfa-1b" : "pdfa-2b";
  if (!base) return nomPdfA(doc, suffixe);
  return String(base).replace(/[^\w-]+/g, "_") + "-" + suffixe + ".pdf";
}

// Un bouton « PDF/A ». `part` choisit le niveau (2 par défaut) ; `base` impose
// le préfixe du nom de fichier ; `disabled` l'assujettit aux mêmes contrôles
// que les autres exports ; `onDone` est appelé après un téléchargement réussi.
export function boutonPdfA(doc, config, {
  part = 2, base = "", label = "", variant = "secondary", icon = "archive",
  size = "", disabled = false, title = "", onDone,
} = {}) {
  const texte = label || (part === 1 ? "PDF/A-1b" : "PDF/A");
  const estBloque = () => disabled || !doc;
  const btn = button(texte, {
    variant, size, icon,
    disabled: estBloque(),
    title: title || "Télécharger un PDF/A — la forme normalisée pour la conservation (polices, couleurs et métadonnées embarquées)",
    onClick: async () => {
      if (estBloque()) return;
      btn.disabled = true;
      // L'attente : la pastille tournante est le même signe que partout ailleurs
      // dans l'application (voir `reserveNumber`, ui/views/rediger.js).
      btn.appendChild(h("span", { class: "spinner", "aria-hidden": "true" }));
      try {
        const style = styleForDoc(config, doc);
        const res = await telechargerPdfA(doc, config, {
          style, part, nom: nomFichier(doc, part, base),
        });
        toast(`PDF/A téléchargé : ${res.fichier} (${Math.round(res.taille / 1024)} Ko)`, "success");
        onDone?.(res);
      } catch (e) {
        console.error("Export PDF/A :", e);
        toast("Le PDF/A n'a pas pu être fabriqué — " + (e?.message || "erreur inconnue"), "error");
      } finally {
        btn.querySelector(".spinner")?.remove();
        btn.disabled = estBloque();
      }
    },
  });
  return btn;
}

// Les deux niveaux côte à côte : PDF/A-2b (le défaut) et PDF/A-1b. C'est ce que
// montre la fenêtre d'export, où la place ne manque pas.
export function boutonsPdfA(doc, config, opts = {}) {
  return [
    boutonPdfA(doc, config, opts),
    boutonPdfA(doc, config, { ...opts, part: 1, icon: null, label: "PDF/A-1b" }),
  ];
}
