// ============================================================================
// Le choix du signataire, par la fonction.
//
// Un seul geste, deux temps : on choisit d'abord la FONCTION (la qualité qui
// donne compétence pour signer l'acte), puis, parmi les personnes qui ont
// qualité pour cette fonction, celle qui signe. Jamais un annuaire de noms :
// une liste de fonctions d'abord, parce que c'est elle qui décide du droit de
// signer — le nom n'en est que la conséquence.
//
// Le catalogue des fonctions vient du référentiel (voir src/lib/fonctions.js) :
// les rôles, puis les délégations qui s'appliquent à l'acte. Quand une fonction
// ne peut être tenue que par une personne, celle-ci est retenue d'office : il
// n'y a pas lieu de faire choisir parmi un seul nom.
//
// Le champ de la trame peut désigner la fonction attendue (`field.qualite`) :
// la liste s'ouvre alors sur elle, sans que le rédacteur soit écarté — il peut
// toujours en changer, rien n'est bloqué.
// ============================================================================
import { h, clear } from "./dom.js";
import { state } from "./state.js";
import { personName } from "../lib/render.js";
import { genreDe, qualitePersonne } from "../lib/delegations.js";
import {
  fonctionsDeSignature, personnesAyantQualite, fonctionParCle, fonctionPourPersonne,
  libelleFonction, qualiteDeFonction, roleDeFonction,
} from "../lib/fonctions.js";
import { compteDePersonne, etatRapprochement } from "../lib/signataires.js";

const option = (value, label, selected, title) => {
  const o = h("option", { value, text: label });
  if (title) o.title = title;
  if (selected) o.selected = true;
  return o;
};

const select = (cls, onChange) => {
  const s = h("select", { class: "fr-select" + (cls ? " " + cls : "") });
  s.addEventListener("change", () => onChange(s.value));
  return s;
};

export function signerPicker({
  field = null, config, scope = {}, personId = "", fonctionKey = "",
  onPerson = () => {}, onFonction = () => {}, showQualite = false,
}) {
  const wrap = h("div", { class: "signer" });
  const attendue = String(field?.qualite || "");
  const personneParId = (id) => (config?.people || []).find((p) => p.id === id) || null;
  // La fonction retenue : celle de l'acte, celle que la trame attend, ou celle
  // que le référentiel déduit de la personne déjà choisie.
  let cle = String(fonctionKey || "") || attendue || fonctionPourPersonne(config, personId, scope) || "";
  let personne = String(personId || "");
  const corps = h("div", { class: "signer__corps" });
  wrap.appendChild(corps);

  function dessiner(autoselect = false) {
    clear(corps);
    const catalogue = fonctionsDeSignature(config, scope);
    // La fonction en cours n'est pas dans le catalogue (délégation hors du
    // périmètre de l'acte, rôle retiré du référentiel…) : on la réaffiche pour
    // ne pas la perdre, et pour que le rédacteur puisse en changer sciemment.
    let courante = catalogue.find((f) => f.key === cle) || null;
    if (cle && !courante) courante = fonctionParCle(config, cle, scope);

    const personnes = courante ? personnesAyantQualite(config, courante, scope) : [];
    const temoin = personnes.find((p) => p.id === personne) || personnes[0];
    const genre = temoin ? genreDe(temoin) : "m";
    // Quand une fonction ne peut être tenue que par une personne, celle-ci est
    // retenue d'office — il n'y a pas lieu de faire choisir parmi un seul nom.
    // Un choix délibéré du rédacteur n'est jamais défait : il arrive qu'il
    // efface le nom pour reprendre la désignation plus tard.
    if (autoselect && courante && !personne && personnes.length === 1) {
      personne = personnes[0].id;
      onPerson(personne);
    }

    const toutes = courante && !catalogue.some((f) => f.key === courante.key)
      ? [courante, ...catalogue] : catalogue;
    const roles = toutes.filter((f) => f.kind === "role");
    const delegations = toutes.filter((f) => f.kind === "delegation");

    // ------------------------------------------------------------- fonction
    const selFonction = select("signer__fonction", (v) => {
      cle = v;
      onFonction(v);
      // Changer de fonction, c'est désigner de nouveau : si la nouvelle ne peut
      // être tenue que par une personne, elle est retenue d'office.
      const candidats = v ? personnesAyantQualite(config, fonctionParCle(config, v, scope) || {}, scope) : [];
      if (!candidats.some((p) => p.id === personne)) {
        personne = candidats.length === 1 ? candidats[0].id : "";
        onPerson(personne);
      }
      dessiner();
    });
    selFonction.appendChild(option("", "— Choisir une fonction —", !cle));
    // Le libellé court (la qualité seule) tient dans la liste ; le libellé long
    // (avec l'autorité délégante) reste en infobulle, et l'ordre des groupes dit
    // déjà s'il s'agit d'un rôle ou d'une délégation.
    const court = (f) => {
      const q = qualiteDeFonction(f, genre);
      return q.charAt(0).toUpperCase() + q.slice(1);
    };
    if (roles.length) {
      const g = h("optgroup", { label: "Fonctions (rôles)" });
      for (const f of roles) g.appendChild(option(f.key, court(f), f.key === cle, libelleFonction(config, f, { genre })));
      selFonction.appendChild(g);
    }
    if (delegations.length) {
      const g = h("optgroup", { label: "Par délégation de signature" });
      for (const f of delegations) g.appendChild(option(f.key, court(f), f.key === cle, libelleFonction(config, f, { genre })));
      selFonction.appendChild(g);
    }
    if (courante) selFonction.title = libelleFonction(config, courante, { genre });
    corps.appendChild(h("div", { class: "fr-field signer__bloc" },
      h("label", { class: "fr-label", text: "Fonction" }),
      selFonction));

    // ------------------------------------------------------------ signataire
    const selPersonne = select("signer__personne", (v) => {
      personne = v;
      onPerson(v);
      dessiner();
    });
    if (!courante) {
      selPersonne.disabled = true;
      selPersonne.appendChild(option("", "Choisissez d'abord la fonction", true));
    } else {
      selPersonne.appendChild(option("", "— Choisir —", !personne));
      for (const p of personnes) selPersonne.appendChild(option(p.id, personName(p), p.id === personne));
      // La personne retenue peut n'avoir plus qualité (référentiel modifié
      // depuis) : on la garde dans la liste plutôt que de l'effacer en silence.
      if (personne && !personnes.some((p) => p.id === personne)) {
        const orpheline = personneParId(personne);
        if (orpheline) selPersonne.appendChild(option(orpheline.id, personName(orpheline) + " (hors fonction)", true));
      }
    }
    corps.appendChild(h("div", { class: "fr-field signer__bloc" },
      h("label", { class: "fr-label", text: courante && courante.kind === "delegation" ? "Qui signe sous cette délégation" : "Qui signe" }),
      selPersonne));

    const infos = [];
    if (courante) {
      infos.push(courante.kind === "role"
        ? `${personnes.length} personne${personnes.length > 1 ? "s" : ""} peu${personnes.length > 1 ? "vent" : "t"} tenir cette fonction.`
        : "Délégation de signature : la qualité imprimée au bas de l'acte est celle que la délégation donne.");
    }
    if (attendue && cle && cle === attendue) infos.push("Fonction attendue par la trame.");
    if (showQualite && personne) {
      const q = (courante && qualiteDeFonction(courante, genre)) || qualitePersonne(config, personneParId(personne), roleDeFonction(cle));
      if (q) infos.push("Qualité au bas de l'acte : " + q);
    }
    if (infos.length) corps.appendChild(h("p", { class: "fr-hint signer__info", text: infos.join(" ") }));

    // Un signataire sans compte ne peut pas signer : le dire au moment où on le
    // désigne vaut mieux que le découvrir au dépôt (voir src/lib/signataires.js).
    if (personne) {
      const p = personneParId(personne);
      const compte = compteDePersonne(state.users, personne);
      if (p && (!compte || compte.active === false)) {
        corps.appendChild(h("p", { class: "fr-hint signer__info signer__info--warn",
          text: "Cette personne n'a pas de compte : elle ne pourra pas signer cet acte. Rapprochez-la de son compte dans « Comptes et rôles »." }));
      } else if (p) {
        const etat = etatRapprochement(config, state.users, personne);
        if (!etat.ok) corps.appendChild(h("p", { class: "fr-hint signer__info signer__info--warn",
          text: "Ce signataire n'a pas encore été rapproché de l'outil de signature : le rapprochement se fait depuis « Ma signature », ou sa fiche dans l'organigramme des délégations." }));
      }
    }
  }

  dessiner(true);
  return wrap;
}
