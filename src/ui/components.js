import { h, icon, button, modal, field as frField, textInput, select, toast, clear } from "./dom.js";
import { state, navigate } from "./state.js";
import { servicesInScope, bureauxInScope, coveredBureaux, serviceById, bureauxOf } from "../lib/scope.js";

// Lien discret vers le chapitre du guide correspondant à l'écran courant.
export function helpLink(chapterId, label = "Aide sur cette page") {
  return h("button", {
    class: "help-link", type: "button", title: "Ouvrir le guide d'utilisation",
    on: { click: () => navigate("aide/" + chapterId) },
  }, icon("info", 14), h("span", { text: label }));
}

export function textField({ label, value, onChange, help, placeholder, required, type = "text", rows }) {
  const input = rows
    ? h("textarea", { class: "fr-textarea", rows, placeholder: placeholder || "", on: { input: (e) => onChange(e.target.value) } })
    : h("input", { class: "fr-input", type, value: value ?? "", placeholder: placeholder || "", on: { input: (e) => onChange(e.target.value) } });
  if (rows) input.value = value ?? "";
  return frField(label, input, { help, required });
}

export function selectField({ label, value, options, onChange, help, required, placeholder }) {
  const opts = placeholder ? [{ value: "", label: placeholder }, ...options] : options;
  const s = select(opts, value, onChange);
  return frField(label, s, { help, required });
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
  const map = { draft: ["Brouillon", "warning"], published: ["Publiée", "success"], archived: ["Archivée", "info"] };
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
