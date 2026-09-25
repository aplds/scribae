import { h, icon, button, modal, field as frField, select, clear } from "./dom.js";
import { avecCurseur } from "./focus.js";
import { state, navigate } from "./state.js";
import { servicesInScope, bureauxInScope, coveredBureaux, serviceById, bureauxOf } from "../lib/scope.js";
import { FONT_CHOICES, FONT_VALUES } from "../lib/styles.js";
import { formatDate } from "../lib/util.js";
import { estAbroge, abrogeParDe, avecArticle } from "../lib/abrogations.js";
import { mentionAnnexePartDeLaMere, mentionAnnexesRestantes } from "../lib/abrogation-annexes.js";

// Lien discret vers le chapitre du guide correspondant à l'écran courant.
export function helpLink(chapterId, label = "Aide sur cette page") {
  return h("button", {
    class: "help-link", type: "button", title: "Ouvrir le guide d'utilisation",
    on: { click: () => navigate("aide/" + chapterId) },
  }, icon("info", 14), h("span", { text: label }));
}

// Un champ de saisie dont la FRAPPE peut redessiner ce qui le porte : une fiche
// dont l'en-tête reprend le nom qu'on écrit, un bloc qui se recalcule, un
// formulaire qui se reconstruit. Le nœud est alors remplacé, et la saisie
// perdrait le focus — et la sélection — dès la première lettre. `avecCurseur`
// le rend à sa place une fois le redessin fait : c'est le même remède que pour
// les redessins de vue (voir src/ui/focus.js).
const surSaisie = (onChange) => (e) => {
  if (typeof onChange !== "function") return;
  avecCurseur(() => onChange(e.target.value));
};

export function textField({ label, value, onChange, help, placeholder, required, type = "text", rows }) {
  const input = rows
    ? h("textarea", { class: "fr-textarea", rows, placeholder: placeholder || "", on: { input: surSaisie(onChange) } })
    : h("input", { class: "fr-input", type, value: value ?? "", placeholder: placeholder || "", on: { input: surSaisie(onChange) } });
  if (rows) input.value = value ?? "";
  return frField(label, input, { help, required });
}

export function selectField({ label, value, options, onChange, help, required, placeholder }) {
  const opts = placeholder ? [{ value: "", label: placeholder }, ...options] : options;
  const s = select(opts, value, onChange);
  return frField(label, s, { help, required });
}

// Choix d'une police : la **liste** des polices proposées (rangées par
// familles), plus une porte de sortie — « Autre (police personnalisée)… » —
// pour une police installée sur les postes ou une pile CSS complète. La valeur
// rangée dans la feuille reste la **pile CSS**, jamais un identifiant d'entrée :
// une charte exportée puis importée ailleurs nomme donc exactement la même
// police. `inherit` ajoute « Héritée », pour les polices qui se déduisent du
// corps du texte (une liste fermée n'offrirait pas de valeur vide sans elle).
export function fontField({ label, value, onChange, help, required, inherit = false }) {
  const CUSTOM = "__custom__";
  const current = value == null ? "" : String(value);
  const custom = !!current && !FONT_VALUES.includes(current);

  const list = [];
  if (inherit) list.push({ value: "", label: "Héritée (police du corps)" });
  for (const g of FONT_CHOICES) list.push({ label: g.group, options: g.fonts });
  list.push({ value: CUSTOM, label: custom ? "Autre (police personnalisée) — en cours" : "Autre (police personnalisée)…" });

  const input = h("input", {
    class: "fr-input", value: current, spellcheck: "false",
    placeholder: "'Nom de la police', Arial, sans-serif",
    on: { input: surSaisie(onChange) },
  });
  const extra = h("div", { class: "styles-font__custom", hidden: !custom }, input);

  const sel = select(list, custom ? CUSTOM : current, (v) => {
    if (v === CUSTOM) {
      extra.hidden = false;
      if (!custom) input.value = current;
      input.focus();
      input.select();
      return;
    }
    extra.hidden = true;
    onChange(v);
  });

  return frField(label, h("div", { class: "styles-font" }, sel, extra), { help, required });
}

export function choiceField({ label, value, options, onChange, help, required, multi }) {
  const isOn = (v) => (multi ? (Array.isArray(value) ? value : []).includes(v) : value === v);
  const wrap = h("div", { class: "fr-choices" });
  const paint = () => {
    [...wrap.children].forEach((b, i) => b.classList.toggle("is-on", isOn(options[i].value)));
  };
  for (const o of options) {
    wrap.appendChild(h("button", {
      type: "button", class: "fr-choice" + (isOn(o.value) ? " is-on" : ""),
      on: {
        click: () => {
          if (multi) {
            const arr = Array.isArray(value) ? [...value] : [];
            const i = arr.indexOf(o.value);
            if (i >= 0) arr.splice(i, 1); else arr.push(o.value);
            value = arr; onChange(arr);
          } else { value = o.value; onChange(o.value); }
          paint();
        },
      },
    }, o.label));
  }
  return frField(label, wrap, { help, required });
}

export function personSelect({ label, value, onChange, help, required, placeholder = "— Sélectionner —" }) {
  return selectField({
    label, value, required, help, placeholder,
    options: (state.config.people || []).map((p) => ({
      value: p.id,
      label: [p.civility, p.firstName, p.lastName].filter(Boolean).join(" ") + (p.entityId ? ` (${state.config.entities.find((e) => e.id === p.entityId)?.code || ""})` : ""),
    })),
    onChange,
  });
}

export function entitySelect({ label, value, onChange, help, required, placeholder = "— Sélectionner —" }) {
  return selectField({
    label, value, required, help, placeholder,
    options: (state.config.entities || []).map((e) => ({ value: e.id, label: `${e.name}${e.code ? " (" + e.code + ")" : ""}` })),
    onChange,
  });
}

export function refSelect({ label, value, onChange, help, required, kinds, placeholder = "— Sélectionner —" }) {
  const list = (state.config.refs || []).filter((r) => !kinds || kinds.includes(r.kind));
  return selectField({
    label, value, required, help, placeholder,
    options: list.map((r) => ({ value: r.id, label: r.label.length > 90 ? r.label.slice(0, 90) + "…" : r.label })),
    onChange,
  });
}

export function refKindSelect({ label, value, onChange, help }) {
  const kinds = [...new Set((state.config.refs || []).map((r) => r.kind))];
  return selectField({
    label, value, help, placeholder: "— Nature de référence —",
    options: kinds.map((k) => ({ value: k, label: k })),
    onChange,
  });
}

// ------------------------------------------------------------------ périmètre
// Champs « Service et bureau » : le service restreint la liste des bureaux.
// `onChange(serviceId, bureauId)` est appelé à chaque changement ; le champ
// bureau est reconstruit quand le service change (le bureau choisi est remis à
// blanc, puisqu'il appartenait à l'ancien service).
export function orgFields({ serviceId = "", bureauId = "", onChange, label = "Service", help, required, generalLabel = "— Aucun service (trame générale) —" }) {
  const wrap = h("div", { class: "fr-stack" });
  const bField = h("div");
  let svcId = serviceId || "";
  let burId = bureauId || "";

  const paintBureaux = () => {
    clear(bField);
    if (!svcId) return;
    const bureaux = bureauxInScope(state.config, state.user, svcId);
    const rest = coveredBureaux(state.config, state.user, svcId);
    const hint = rest && bureaux.length < bureauxOf(serviceById(state.config, svcId)).length
      ? "Votre périmètre ne couvre qu'une partie des bureaux de ce service."
      : null;
    bField.appendChild(frField("Bureau", bureaux.length
      ? select([{ value: "", label: "Tout le service (tous les bureaux)" }, ...bureaux.map((b) => ({ value: b.id, label: b.name }))],
          burId, (v) => { burId = v; onChange(svcId, v); })
      : h("p", { class: "fr-small fr-muted", text: "Ce service ne comporte aucun bureau." }), { help: hint }));
  };

  wrap.appendChild(frField(label, select(
    [{ value: "", label: generalLabel }, ...servicesInScope(state.config, state.user).map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` }))],
    svcId,
    (v) => { svcId = v; burId = ""; onChange(svcId, ""); paintBureaux(); },
  ), { required, help }));
  wrap.appendChild(bField);
  paintBureaux();
  return wrap;
}

export function confirmDialog(title, message, { confirmLabel = "Confirmer", danger = false } = {}) {
  return new Promise((resolve) => {
    // `close()` déclenche `onClose` (donc un refus) : il faut donc trancher
    // AVANT de fermer, sinon la promesse se résout toujours à false.
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    const m = modal({
      title,
      body: h("p", { text: message }),
      actions: (close) => [
        button("Annuler", { variant: "secondary", onClick: () => { done(false); close(); } }),
        button(confirmLabel, { variant: danger ? "danger" : "primary", onClick: () => { done(true); close(); } }),
      ],
      onClose: () => done(false),
    });
  });
}

export function promptDialog(title, label, value = "") {
  return new Promise((resolve) => {
    let settled = false;
    const done = (v) => { if (!settled) { settled = true; resolve(v); } };
    let input;
    const m = modal({
      title,
      body: h("div", {},
        h("label", { class: "fr-label", text: label }),
        (input = h("input", { class: "fr-input", value, on: { keydown: (e) => { if (e.key === "Enter") { done(input.value.trim()); m.close(); } } } })),
      ),
      actions: (close) => [
        button("Annuler", { variant: "secondary", onClick: () => { done(null); close(); } }),
        button("Valider", { variant: "primary", onClick: () => { const v = input.value.trim(); done(v); close(); } }),
      ],
      onClose: () => done(null),
    });
  });
}

export function sectionHeader(title, right) {
  return h("div", { class: "fr-row", style: { margin: "0 0 8px" } },
    h("h3", { style: { margin: 0, flex: "1 1 auto", fontSize: ".95rem" }, text: title }),
    right || null);
}

export function emptyState(message, action) {
  return h("div", { class: "fr-card", style: { textAlign: "center", padding: "32px 16px" } },
    h("p", { class: "fr-muted", style: { margin: 0 }, text: message }),
    action ? h("div", { style: { marginTop: "12px" } }, action) : null);
}

export function statusBadge(status) {
  // Le seul objet qui porte ce badge est la TRAME : « publiée » y veut dire
  // « mise à disposition des services », et le mot doit le dire — c'est la
  // nuance entre un document qu'on range et un modèle qu'on ouvre aux autres.
  const map = { draft: ["Brouillon", "warning"], published: ["Mise à disposition", "success"], archived: ["Archivée", "info"] };
  const [label, color] = map[status] || map.draft;
  return h("span", { class: "fr-badge fr-badge--" + color, text: label });
}

// Statuts d'un acte : libellés et couleurs définis une seule fois (registre des
// actes, choix de l'acte à rédiger…).
export const ACTE_STATUTS = {
  brouillon: { label: "Brouillon", color: "warning" },
  pret: { label: "Prêt", color: "info" },
  exporte: { label: "Exporté", color: "success" },
  en_signature: { label: "En signature", color: "warning" },
  signee: { label: "Signé", color: "success" },
  publie: { label: "Publié", color: "success" },
  en_attente: { label: "En attente de publication", color: "info" },
  abroge: { label: "Abrogé", color: "error" },
};

export const acteStatutLabel = (s) => ACTE_STATUTS[s]?.label || s || "Brouillon";
export const acteStatutColor = (s) => ACTE_STATUTS[s]?.color || "warning";
export const acteStatutBadge = (s) => h("span", { class: "fr-badge fr-badge--" + acteStatutColor(s), text: acteStatutLabel(s) });

// Un acte encore modifiable dans l'éditeur de rédaction : un acte signé ou
// publié ne se réécrit pas, il se modifie (acte modificatif + version consolidée).
export const isDraftable = (s) => !["signee", "publie", "en_attente", "abroge"].includes(s || "brouillon");

// ------------------------------------------------ abrogations subies
// La marque d'une abrogation subie par un acte : « abrogé » dès qu'elle a pris
// effet, « abrogation prévue » tant que l'acte qui la porte n'est pas entré en
// vigueur (voir src/lib/abrogations.js). Elle s'accroche au badge de statut.
export const abrogationBadge = (a) => {
  const m = abrogeParDe(a);
  if (!m) return null;
  const par = [avecArticle(m.designation || "acte"), m.numero ? "n° " + m.numero : "", m.date ? "du " + formatDate(m.date, "date-long") : ""].filter(Boolean).join(" ");
  const quand = m.dateEntreeEnVigueur ? `, à compter du ${formatDate(m.dateEntreeEnVigueur, "date-long")}` : "";
  return estAbroge(a)
    ? h("span", { class: "fr-badge fr-badge--error", style: { marginLeft: "5px" }, title: `Abrogé par ${par}${quand}.`, text: "abrogé" })
    : h("span", { class: "fr-badge fr-badge--warning", style: { marginLeft: "5px" }, title: `L'abrogation prendra effet à l'entrée en vigueur de ${par}.`, text: "abrogation prévue" });
};

// La phrase complète, pour une fiche d'acte : ce que l'abrogation dit, et par
// quoi l'acte a été abrogé.
export const abrogationPhrase = (a) => {
  const m = abrogeParDe(a);
  if (!m) return "";
  const par = [avecArticle(m.designation || "acte"), m.numero ? "n° " + m.numero : "", m.date ? "du " + formatDate(m.date, "date-long") : ""].filter(Boolean).join(" ");
  // Une annexe sans publication autonome est emportée par l'abrogation de sa
  // décision mère : on le DIT, parce que le lecteur, lui, ne voit aucune clause
  // viser cet acte (voir src/lib/abrogation-annexes.js).
  const annexe = mentionAnnexePartDeLaMere(a);
  if (estAbroge(a)) {
    return `Cet acte a été abrogé par ${par}${m.article ? `, à l'exception de son article ${m.article}` : ""}${m.dateEntreeEnVigueur ? `, à compter du ${formatDate(m.dateEntreeEnVigueur, "date-long")}` : ""}.`
      + (annexe ? " " + annexe : "");
  }
  return `Une abrogation de cet acte est prévue par ${par}. Elle prendra effet au jour de l'entrée en vigueur de cet acte.`
    + (annexe ? " " + annexe : "");
};

// Ce qu'il RESTE à traiter après une abrogation : les annexes publiées à part,
// que l'abrogation de leur décision d'adoption laisse en vigueur. Elles sont
// rangées sur l'acte abrogeant (`annexesAutonomesRestantes`, voir
// ui/abrogations-apply.js). La phrase est vide quand il n'y a rien à signaler —
// l'immense majorité des actes.
export const annexesRestantesPhrase = (a) => mentionAnnexesRestantes(a);
