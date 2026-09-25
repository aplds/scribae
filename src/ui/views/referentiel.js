import { state, touch, applyBrand, redrawView, navigate, setUsers, resetDemoUsers, can, applyAuthMode, journalPour, oublierBulletinsRecueil } from "../state.js";
import { h, clear, button, toast, icon, modal } from "../dom.js";
import { download, pickFile, uid, todayIso, copyText } from "../../lib/util.js";
import * as cles from "../../lib/cles-service.js";
import { textField, selectField, choiceField, fontField, confirmDialog, sectionHeader, helpLink } from "../components.js";
import { clearAll, saveConfig } from "../../lib/store.js";
import * as db from "../../lib/db/index.js";
import { seedConfig, seedTrames } from "../../lib/seed.js";
import { amendVocab } from "../../lib/amend.js";
import { abrogationVocab } from "../../lib/abrogations.js";
import { newService, newBureau } from "../../lib/scope.js";
import { ENTITY_KINDS, newEntite } from "../../lib/organigramme.js";
import { newConseil } from "../../lib/conseils.js";
import { newCircuit, newStep, STEP_ROLES, STEP_KINDS, STEP_TARGETS, natureEtape, etapeDefauts, etapeCible } from "../../lib/validation.js";
import { newCompetence, competenceLabel } from "../../lib/revision.js";
import { DELAIS_DEFAUT } from "../../lib/execution.js";
import { CONTROLE_LEGALITE } from "../../lib/legalite.js";
import { publicationSettings } from "../../lib/eli.js";
import { chargerAcces, acces, CLE_IPS, CLE_MESSAGE, MESSAGE_DEFAUT } from "../../lib/atelier-acces.js";
import { VARIABLES_CSS, EXEMPLE_CSS, PORTEE_CSS } from "../../lib/informations.js";
import { TYPES_RECUEIL_EXTERNE, newRecueilExterne, RENVOIS_RECOMMANDES, MENTIONS_PUBLIQUES, MENTIONS_DEFAUT, mentionsParDefaut } from "../../lib/recueil.js";
import { LICENCE_DEFAUT } from "../../lib/recueil.js";
import {
  CADENCES_BULLETIN, UNITES_BULLETIN, bulletinReglages, libelleCadence,
  adresseBulletins, adresseFluxBulletin,
} from "../../lib/bulletins.js";
import * as bs from "../../lib/bulletins-service.js";
import {
  signatureSettings, SIGNATURE_MODES, SIGNATURE_API_DEFAUT, trameModeLabel,
  circuitPour, circuitsDisponibles, modeLabel,
  circuitElectroniqueSimule, motifCircuitSimule, prestataireDuService,
} from "../../lib/externe.js";
import { EVENEMENTS, courrielSettings, etatService as etatCourriel, envoyerTest, evenementDe } from "../../lib/courriel.js";
import { ASSISTANTS, assistantSettings, assistantIdentite, reglerAssistant, reinitialiserAssistant, moteurDe, repondre, nouvelIdPrompt } from "../../lib/assistant.js";
import { DEMO_TEXT } from "../notice.js";
import { demoActif, demoRegleParLeDeploiement } from "../../lib/demo.js";
import { optionsDeployees, poseParLeDeploiement } from "../../lib/deploiement-config.js";
import { post, errorMessage } from "../../lib/remote.js";
import { comptesDuDeploiement, sessionDeService } from "../../lib/auth.js";
import { cleService } from "../../lib/cle-service.js";
import { annuairePanel } from "../oidc.js";
import {
  numberingSettings, demanderNumero, relaisDisponible,
  SOURCES, TRANSPORTS, METHODES, JETONS, EXTERNE_DEFAUT, GABARIT_GRIST, PORTEES,
} from "../../lib/numbering.js";

const TABS = [
  { id: "identite", label: "Identité" },
  { id: "vocabulaire", label: "Vocabulaire" },
  { id: "numerotation", label: "Numérotation" },
  { id: "entites", label: "Entités" },
  { id: "assemblees", label: "Assemblées" },
  { id: "services", label: "Services" },
  { id: "personnes", label: "Personnes" },
  { id: "roles", label: "Rôles" },
  { id: "refs", label: "Références" },
  { id: "mentions", label: "Mentions" },
  { id: "familles", label: "Familles" },
  { id: "acttypes", label: "Types d'actes" },
  { id: "circuits", label: "Circuits de validation" },
  { id: "delais", label: "Exécution & délais" },
  { id: "signature", label: "Signature" },
  { id: "courriel", label: "Courriel" },
  { id: "publication", label: "Publication" },
  { id: "assistants", label: "Assistants" },
  { id: "experimental", label: "Expérimentale" },
  { id: "annuaire", label: "Annuaire (OIDC)" },
  { id: "base", label: "Base de données" },
  { id: "journal", label: "Journal d'audit" },
  { id: "donnees", label: "Données" },
];

export function renderReferentiel(root) {
  const ui = (state.ui = state.ui || {});
  ui.refTab = ui.refTab || "identite";

  root.appendChild(h("div", { class: "page-head" },
    h("div", { class: "page-head__text" },
      h("h1", { class: "page-head__title", text: "Administration" }),
      h("p", { class: "page-head__sub", text: "Tout ce qui est configurable : marques, entités, services et bureaux, personnes, rôles, références juridiques, mentions, numérotation, vocabulaire. Rien de tout cela n'est codé dans l'application." }),
    ),
    h("div", { class: "page-head__actions" }, helpLink("administrateurs", "Aide")),
  ));

  const tabs = h("div", { class: "fr-tabs" });
  for (const t of TABS) {
    tabs.appendChild(h("button", {
      class: "fr-tab" + (ui.refTab === t.id ? " fr-tab--active" : ""),
      text: t.label,
      onClick: () => { ui.refTab = t.id; redraw(); },
    }));
  }
  root.appendChild(tabs);
  const body = h("div");
  root.appendChild(body);

  function redraw() { redrawView(); }

  const c = state.config;
  const save = () => { touch("config", { rerender: false }); applyBrand(); };

  if (ui.refTab === "identite") {
    // Deux emblèmes, la même saisie : celui du fond clair, et celui du fond
    // sombre — employé quand le poste de travail est en thème sombre (voir
    // `brandLogoUrl`, src/lib/theme.js). Une démonstration embarque les siens
    // sous forme de data URL (image intégrée au référentiel) : le champ paraît
    // alors vide, et une saisie la remplace. L'aperçu du second se pose sur le
    // fond sombre de l'application, sans quoi on ne verrait pas ce que l'on
    // règle — un logo clair sur fond clair ne se distingue pas d'une image
    // cassée.
    const champEmbleme = (label, cle, help, fond) => {
      const url = c.brand[cle] || "";
      const integre = url.startsWith("data:");
      return h("div", { class: "fr-grid fr-grid--2" },
        textField({
          label,
          value: integre ? "" : url,
          placeholder: integre ? "logo intégré à la démonstration" : "",
          help: integre ? "La démonstration embarque un logo (image intégrée au référentiel). Saisissez une URL ici pour le remplacer." : help,
          onChange: (v) => { c.brand[cle] = v.trim() || (integre ? url : ""); save(); redraw(); },
        }),
        url ? h("div", { class: "fr-row", style: { alignItems: "center", gap: "10px", paddingTop: "22px" } },
          h("img", { src: url, alt: "", style: { height: "40px", borderRadius: "var(--radius)", border: "1px solid var(--border)", padding: "2px", background: fond } }),
          button("Retirer", { variant: "tertiary", size: "sm", onClick: () => { c.brand[cle] = ""; save(); redraw(); } }),
        ) : null,
      );
    };
    body.appendChild(card("Marque et identité de l'organisation", "Ces valeurs alimentent l'en-tête de l'application et les métadonnées des actes. La couleur pilote les tokens du design system.",
      textField({ label: "Nom", value: c.brand.name, onChange: (v) => { c.brand.name = v; save(); } }),
      textField({ label: "Nom court (initiale du bandeau)", value: c.brand.shortName, onChange: (v) => { c.brand.shortName = v; save(); } }),
      textField({ label: "Base des URI (ELI)", value: c.brand.baseUri, help: "Ex. https://www.exemple.fr/eli", onChange: (v) => { c.brand.baseUri = v; save(); } }),
      h("div", { class: "fr-grid fr-grid--2" },
        textField({ label: "Couleur principale", value: c.brand.color, onChange: (v) => { c.brand.color = v; save(); redraw(); } }),
        textField({ label: "Couleur principale (survol)", value: c.brand.colorDark, onChange: (v) => { c.brand.colorDark = v; save(); } }),
      ),
      h("div", { class: "fr-row" },
        h("span", { class: "fr-badge", style: { background: c.brand.color, color: "#fff" }, text: "aperçu" }),
        h("button", { class: "fr-btn fr-btn--primary", text: "Bouton principal" }),
        h("button", { class: "fr-btn fr-btn--secondary", text: "Bouton secondaire" }),
      ),
      champEmbleme("URL du logo (facultatif)", "logoUrl", "Ex. https://www.exemple.fr/logo.png", ""),
      champEmbleme("URL du logo en thème sombre (facultatif)", "logoUrlDark", "Employé quand l'application est en thème sombre, à la place du logo ci-dessus. Vide : le logo ordinaire sert dans les deux thèmes.", "#1b1e26"),
      textField({ label: "Police d'interface", value: c.brand.uiFont || "", onChange: (v) => { c.brand.uiFont = v; save(); } }),
      fontField({ label: "Police des documents", value: c.brand.documentFont || "", help: "Valeur de repli, quand une feuille de style ne dit rien — et police du papier des écrits qui ne sont pas des actes (états, attestations). La présentation des actes se règle par feuille de style.", onChange: (v) => { c.brand.documentFont = v; save(); } }),
      can("trames.styles") ? h("p", { class: "fr-hint", style: { margin: "2px 0 0" } },
        "La charte graphique des actes — polices, logo, en-tête, diviseurs — se règle dans ",
        button("Feuilles de style", { variant: "tertiary", size: "sm", onClick: () => navigate("styles") }),
        ".",
      ) : null,
    ));
    body.appendChild(card("Contact d'aide", "Ces coordonnées apparaissent dans le guide, à la fin des chapitres, sous « Besoin d'aide ? ». Laissez vide si vous ne voulez rien afficher.",
      h("div", { class: "fr-grid fr-grid--2" },
        textField({ label: "Service ou personne à contacter", value: c.brand.supportName || "", onChange: (v) => { c.brand.supportName = v; save(); } }),
        textField({ label: "Téléphone", value: c.brand.supportPhone || "", onChange: (v) => { c.brand.supportPhone = v; save(); } }),
      ),
      textField({ label: "Adresse électronique", value: c.brand.supportEmail || "", onChange: (v) => { c.brand.supportEmail = v; save(); } }),
    ));
    body.appendChild(card("Mention de démonstration",
      "Le mode de démonstration — « cette installation montre un jeu fictif » — est décidé par le DÉPLOIEMENT (`DEMO` dans le `.env` du service ; voir src/lib/demo.js). Éteint, l'outil est une page vierge : aucune donnée fictive, aucune mention de collectivité fictive, nulle part. Tant qu'il est allumé, un bandeau en tête de l'application — et sur le recueil public — rappelle que l'installation n'est pas en production : données fictives, signature électronique simulée.",
      demoRegleParLeDeploiement()
        ? h("p", { class: "fr-small fr-muted", text: demoActif(c)
            ? "Démonstration ACTIVE sur cette installation (réglage du déploiement) : le jeu fictif et les comptes de démonstration sont installés."
            : "Démonstration DÉSACTIVÉE sur cette installation (réglage du déploiement) : l'outil part d'une page vierge. Pour revenir en arrière, changez DEMO dans le .env du service." })
        : choiceField({
            label: "Afficher le bandeau « Démonstration »",
            value: c.brand.demo !== false,
            options: [{ value: true, label: "Afficher" }, { value: false, label: "Masquer" }],
            help: "Réglage du référentiel (il suit les données exportées et importées) : il ne s'applique que quand le déploiement ne dit rien — aperçu en ligne, page statique. Il ne décide pas du jeu fictif, qui vient du déploiement (`DEMO`).",
            onChange: (v) => { c.brand.demo = v; touch("config"); },
          }),
      textField({
        label: "Texte du bandeau", value: c.brand.demoText || "", rows: 2,
        placeholder: DEMO_TEXT,
        help: "Laissez vide pour revenir au texte d'origine. Utile pour dire « recette », « bac à sable »…",
        onChange: (v) => {
          c.brand.demoText = v; save();
          const live = document.querySelector(".app-demo__text");
          if (live) live.textContent = v.trim() || DEMO_TEXT;
        },
      }),
    ));
    // LA MENTION DE L'ÉDITEUR DU LOGICIEL. Elle vit dans les trois pieds de page —
    // recueil public, atelier, écran de connexion (voir src/ui/mention.js). Le
    // réglage est ici, avec la marque, parce que c'est une affaire d'identité :
    // une collectivité a sa charte, et le recueil peut être intégré dans un
    // portail qui porte déjà la mention.
    body.appendChild(card("Mention de l'éditeur du logiciel",
      "Les pieds de page portent « Propulsé par Scribae — GPLv3 », avec le lien vers la documentation du logiciel. Scribae est un logiciel libre, publié sous licence GPL-3.0 : la mention dit d'où vient l'application, et où trouver ses explications.",
      choiceField({
        label: "Afficher la mention dans les pieds de page",
        value: c.brand.mentionScribae !== false,
        options: [{ value: true, label: "Afficher" }, { value: false, label: "Masquer" }],
        help: "Réglage du référentiel (il suit les données exportées et importées). Éteint, plus aucune mention de l'éditeur n'apparaît : ni sur le recueil public, ni dans l'atelier, ni à l'écran de connexion.",
        onChange: (v) => {
          c.brand.mentionScribae = v; save();
          // Le pied de l'atelier appartient à la COQUILLE, que le redessin d'une
          // vue ne reconstruit pas : on l'éteint et on le rallume sur-le-champ —
          // même geste que le texte du bandeau de démonstration ci-dessus.
          const live = document.querySelector(".app-pied");
          if (live) live.hidden = v === false;
          redraw();
        },
      }),
    ));
  }

  if (ui.refTab === "vocabulaire") {
    body.appendChild(card("Vocabulaire des actes", "Les intitulés produits dans les documents. Adaptez-les à votre pratique rédactionnelle.",
      textField({ label: "Formule d'édiction", value: c.vocab.enact, onChange: (v) => { c.vocab.enact = v; save(); } }),
      textField({ label: "Intitulé d'article", value: c.vocab.articleLabel, onChange: (v) => { c.vocab.articleLabel = v; save(); } }),
      textField({ label: "Préfixe de visa", value: c.vocab.visasLabel, onChange: (v) => { c.vocab.visasLabel = v; save(); } }),
      textField({ label: "Ponctuation de fin de visa", value: c.vocab.visaSeparator ?? ",", onChange: (v) => { c.vocab.visaSeparator = v; save(); } }),
      textField({ label: "Préfixe de considérant", value: c.vocab.recitalsLabel, onChange: (v) => { c.vocab.recitalsLabel = v; save(); } }),
    ));

    // Tournures de la modification d'acte : elles produisent l'acte modificatif.
    c.vocab.amendment = { ...amendVocab(c) };
    const am = c.vocab.amendment;
    const amField = (key, label, help) => textField({
      label, value: am[key], help,
      onChange: (v) => { am[key] = v; save(); },
    });
    body.appendChild(card("Modification d'acte — tournures",
      "Ces phrases composent l'acte modificatif. Jetons remplacés : {designation} {designationLower} {numero} {date} {target} (l'acte modifié, seul) {targetInSentence} (l'acte modifié, dans une phrase) {article} {newArticle} {dateEffet} {authority}.",
      h("div", { class: "fr-grid fr-grid--2" },
        amField("designation", "Nature de l'acte par défaut", "Ex. Décision, Arrêté, Délibération."),
        amField("targetInSentence", "L'acte modifié, dans une phrase", "Ex. « la {designationLower} n°{numero} du {date} » ou « l'arrêté n°{numero} du {date} »."),
      ),
      amField("title", "Intitulé de l'acte modificatif"),
      amField("replace", "Remplacement d'un article"),
      amField("abrogate", "Abrogation d'un article"),
      amField("insertAfter", "Insertion d'un article après"),
      amField("insertBefore", "Insertion d'un article avant"),
      amField("append", "Ajout en fin de dispositif"),
      amField("entry", "Article d'entrée en vigueur"),
      amField("entryDefault", "Entrée en vigueur sans date d'effet"),
      amField("execution", "Article d'exécution"),
      amField("considerant", "Considérant proposé par défaut"),
      amField("consolidatedNotice", "Avertissement de la version consolidée"),
      h("div", { class: "fr-grid fr-grid--2" },
        amField("trailTitle", "Titre du tableau des modifications"),
        textField({
          label: "Colonnes du tableau", value: (am.trailHead || []).join(" | "),
          onChange: (v) => { am.trailHead = v.split("|").map((s) => s.trim()); save(); },
        }),
      ),
      h("p", { class: "fr-small fr-muted", style: { margin: "10px 0 0" },
        text: "Ces trois mentions s'affichent sous l'intitulé d'un article dans la version consolidée lorsque le suivi des modifications n'est pas affiché (option décochée par défaut). Jetons : {designationThe} (« la décision »), {designation}, {designationLower}, {numero}, {date}." }),
      h("div", { class: "fr-grid fr-grid--2" },
        amField("mentionReplace", "Mention d'un article modifié"),
        amField("mentionAbrogate", "Mention d'un article abrogé"),
      ),
      h("div", { class: "fr-grid fr-grid--2" },
        amField("mentionInsert", "Mention d'un article inséré"),
        amField("mentionThen", "Liaison entre deux modifications successives"),
      ),
      h("div", { class: "fr-grid fr-grid--2" },
        amField("renumberNotice", "Avertissement de renumérotation", "S'ajoute à l'avertissement de la version consolidée quand les articles ont été renumérotés d'un bout à l'autre."),
        amField("abrogationNotice", "Avertissement d'un acte abrogé dans son ensemble", "Affiché quand TOUTES les dispositions de l'acte ont été abrogées."),
      ),
    ));

    // Tournures de l'abrogation PRÉVUE par un acte : la clause de fin de
    // dispositif par laquelle un acte abroge un autre acte, ou l'un de ses
    // articles. Elle prend effet à l'ENTRÉE EN VIGUEUR de l'acte qui la porte
    // (voir src/lib/abrogations.js et l'onglet « Abrogations » de la rédaction).
    c.vocab.abrogation = { ...abrogationVocab(c) };
    const ab = c.vocab.abrogation;
    const abField = (key, label, help) => textField({
      label, value: ab[key], help,
      onChange: (v) => { ab[key] = v; save(); },
    });
    body.appendChild(card("Abrogation — tournures",
      "La clause par laquelle un acte prévoit l'abrogation d'un autre acte, ou d'un article d'un autre acte. Jetons : {target} (l'acte visé, dans une phrase) {targetCap} (le même, en tête de phrase) {abroge} (« abrogé » / « abrogée », accordé) {article} {articleLabel} {self} (« le présent arrêté ») {selfDe} (« du présent arrêté ») {designation} {designationLower} {designationThe}.",
      abField("heading", "Intitulé de l'article d'abrogation"),
      abField("acte", "Abrogation d'un acte entier"),
      abField("article", "Abrogation d'un article"),
      abField("texte", "Acte visé qui n'est pas dans l'application"),
    ));
  }

  if (ui.refTab === "numerotation") {
    body.appendChild(numerotationPanel(save, redraw));
  }

  if (ui.refTab === "entites") {
    body.appendChild(listPanel({
      title: "Entités", help: "Commune, établissements publics, associations, services : toute structure citée ou signataire d'un acte. Le code alimente la numérotation.",
      items: c.entities, factory: () => newEntite(),
      fields: (rec) => [
        { key: "code", label: "Code", type: "text" },
        { key: "kind", label: "Nature", type: "select", options: ENTITY_KINDS.map((k) => ({ value: k.id, label: k.label })) },
        { key: "name", label: "Nom", type: "text" },
        { key: "nameWithArt", label: "Nom avec article (dans une phrase)", type: "text", help: "Ex. « la commune de … », avec l'article qui convient." },
        { key: "authorityFormula", label: "Formule d'autorité", type: "text", help: "Ligne d'en-tête de l'acte, ex. « Le maire de … »." },
        { key: "legalName", label: "Dénomination juridique", type: "text" },
        { key: "seatCity", label: "Ville du siège", type: "text" },
        { key: "tribunal", label: "Tribunal administratif compétent", type: "text" },
        {
          key: "autonome", label: "Entité autonome (personnalité morale propre)", type: "boolean",
          help: "Décochez pour une structure qui agit au nom d'une autre : une régie municipale, un service doté d'un directeur. Elle garde son signataire principal, ses services et ses actes.",
        },
        { key: "parentId", label: "Entité de rattachement", type: "select", options: c.entities.filter((e) => e.id !== rec.id).map((e) => ({ value: e.id, label: e.name })), placeholder: "—", help: "Sert au rattachement d'une entité non autonome, et à l'ordre de l'organigramme." },
        {
          key: "signerPersonId", label: "Signataire principal", type: "select",
          placeholder: "— Aucun —",
          options: (c.people || []).map((p) => ({ value: p.id, label: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id })),
          help: "La personne qui signe les actes de cette entité quand la trame n'en désigne aucun. Le même réglage existe dans l'écran Organigramme, au clic sur l'entité.",
        },
        {
          key: "signerRoleId", label: "Qualité du signataire principal", type: "select",
          placeholder: "— Sa qualité usuelle —",
          options: (c.roles || []).map((r) => ({ value: r.id, label: r.label })),
          help: "La qualité sous laquelle il signe, quand elle diffère de son rôle habituel.",
        },
      ],
      save,
    }));
  }

  if (ui.refTab === "services") {
    body.appendChild(servicesPanel(save, redraw));
  }
  if (ui.refTab === "assemblees") {
    body.appendChild(listPanel({
      title: "Assemblées délibérantes", help: "Les conseils dont émanent les actes d'assemblée — le conseil municipal d'une commune, le conseil d'administration d'un établissement public. La ligne d'autorité d'une délibération est celle de l'assemblée (« Le conseil municipal de … ») ; l'acte est signé par le président de cette assemblée, dont vous choisissez ici la qualité (le maire, le président du conseil d'administration…). Une trame devient un acte d'assemblée par son réglage « Acte d'assemblée », dans l'éditeur de trame.",
      items: (c.councils = c.councils || []),
      factory: () => newConseil({ entityId: c.entities[0]?.id || "" }),
      fields: () => [
        { key: "code", label: "Code", type: "text", help: "Repère court (CM, CA…)." },
        { key: "entityId", label: "Entité de rattachement", type: "select", options: c.entities.map((e) => ({ value: e.id, label: e.name })), help: "C'est l'entité de l'acte qui détermine l'assemblée retenue par défaut." },
        { key: "name", label: "Nom de l'assemblée", type: "text", help: "Ex. « Conseil municipal de … »." },
        { key: "authorityFormula", label: "Formule d'autorité (ligne d'en-tête de l'acte)", type: "text", help: "Ex. « Le conseil municipal de … ». C'est ce que rend le jeton {{autorite}}." },
        { key: "signerRoleId", label: "Qualité qui signe", type: "select", options: c.roles.map((r) => ({ value: r.id, label: r.label })), placeholder: "—", help: "Le rôle sous lequel l'acte est signé : le maire pour un conseil municipal, le président du conseil d'administration pour un établissement public. Le nom du signataire vient, lui, du champ « Signataire » de la trame." },
        { key: "actif", label: "En activité", type: "boolean" },
      ],
      save,
    }));
  }

  if (ui.refTab === "personnes") {
    body.appendChild(listPanel({
      title: "Personnes", help: "Signataires et bénéficiaires d'actes. Chaque personne peut porter des références (acte de nomination, contrat…) et la décision qui fonde son pouvoir de signer, visée automatiquement sur les actes où elle est l'autorité.",
      items: c.people, factory: () => ({ id: uid("p"), civility: "Madame", firstName: "", lastName: "", entityId: c.entities[0]?.id || "", roles: [], accord: "", fondementRefId: "" }),
      fields: () => [
        { key: "civility", label: "Civilité", type: "select", options: ["Madame", "Monsieur", "Monsieur le", "Madame la"] },
        { key: "firstName", label: "Prénom", type: "text" },
        { key: "lastName", label: "Nom", type: "text" },
        { key: "entityId", label: "Entité", type: "select", options: c.entities.map((e) => ({ value: e.id, label: e.name })), placeholder: "—" },
        { key: "roles", label: "Rôles", type: "multichoice", options: c.roles.map((r) => ({ value: r.id, label: r.label })) },
        {
          key: "accord", label: "Accord des qualités", type: "select", placeholder: "",
          help: "Déduit de la civilité. À forcer au cas par cas : certaines femmes maire tiennent à « le maire » plutôt qu'à « la maire ».",
          options: [
            { value: "", label: "Automatique (d'après la civilité)" },
            { value: "m", label: "Masculin — « le maire »" },
            { value: "f", label: "Féminin — « la maire »" },
          ],
        },
        {
          key: "fondementRefId", label: "Décision fondant son pouvoir de signer", type: "select",
          placeholder: "— Aucune —", options: refsDecision(c),
          help: "La décision par laquelle cette personne tient sa compétence — la délibération qui donne délégation au maire, une élection… Elle est visée sur les actes qu'elle signe, en tête des décisions de délégation, et l'acte publié porte son lien si la référence a une adresse (Administration › Références).",
        },
      ],
      save,
    }));
  }

  if (ui.refTab === "roles") {
    body.appendChild(listPanel({
      title: "Rôles", help: "Fonctions utilisables pour qualifier une personne. Chaque rôle porte ses deux formes, masculine et féminine : c'est d'elles que vient l'accord des qualités dans les actes (« Le maire » / « La maire »). Le libellé, lui, n'est qu'un repère de liste — il ne s'imprime jamais.",
      items: c.roles, factory: () => ({ id: uid("role"), label: "Nouveau rôle", m: "", f: "" }),
      fields: () => [
        { key: "label", label: "Libellé (repère de liste)", type: "text" },
        { key: "m", label: "Qualité au masculin", type: "text", help: "Sans article : « maire », « directeur général des services », « adjoint au maire »." },
        { key: "f", label: "Qualité au féminin", type: "text", help: "Sans article : « maire », « directrice générale des services », « adjointe au maire »." },
      ],
      save,
    }));
  }

  if (ui.refTab === "refs") {
    body.appendChild(listPanel({
      title: "Références juridiques et actes", help: "Textes et actes réutilisables dans les visas. Une référence rattachée à une entité est retenue automatiquement quand la trame demande « la référence de cette nature pour l'entité signataire ».",
      items: c.refs, factory: () => ({ id: uid("ref"), kind: "decret", label: "", entityId: "", scope: "all", active: true, source: "" }),
      fields: (rec) => [
        { key: "kind", label: "Nature", type: "text", help: "Ex. decret, arrete, decision, deliberation, reglement" },
        { key: "label", label: "Intitulé complet", type: "textarea" },
        { key: "entityId", label: "Entité rattachée", type: "select", options: c.entities.map((e) => ({ value: e.id, label: e.name })), placeholder: "— toutes —" },
        { key: "scope", label: "Portée", type: "select", options: [{ value: "all", label: "Générale" }, { value: "entity", label: "Par entité" }] },
        { key: "active", label: "En vigueur", type: "boolean" },
        { key: "source", label: "Adresse (lien vers le texte)", type: "text", help: "L'adresse où le texte se lit. Les visas qui citent cette référence — et les décisions de délégation qui la désignent — la portent sur l'acte publié : le lecteur clique, sur le web comme en PDF. Facultative pour une citation sans adresse." },
      ],
      save,
    }));
  }

  if (ui.refTab === "mentions") {
    body.appendChild(listPanel({
      title: "Mentions", help: "Blocs de texte réutilisables (voies et délais de recours, publication, portée informationnelle). Les jetons {{…}} y sont interprétés.",
      items: c.mentions, factory: () => ({ id: uid("men"), kind: "publication", label: "", text: "" }),
      fields: () => [
        { key: "kind", label: "Nature", type: "select", options: [{ value: "recours", label: "Voies et délais de recours" }, { value: "publication", label: "Publication" }, { value: "notification", label: "Notification (acte individuel)" }, { value: "autre", label: "Autre" }] },
        { key: "label", label: "Libellé", type: "text" },
        { key: "text", label: "Texte", type: "textarea", rows: 4 },
      ],
      save,
    }));
  }

  if (ui.refTab === "familles") {
    body.appendChild(listPanel({
      title: "Familles d'actes", help: "Classement des trames (nominations, délégations, tarifs…). Chaque famille est un THÈME du recueil public : c'est par elle que les lecteurs parcourent les actes publiés. La présentation s'affiche sous le libellé, sur la page d'accueil du recueil.",
      items: c.families, factory: () => ({ id: uid("fam"), label: "Nouvelle famille", description: "" }),
      fields: () => [
        { key: "label", label: "Libellé", type: "text" },
        { key: "description", label: "Présentation du thème", type: "textarea", rows: 2, help: "Une phrase qui dit ce que regroupe ce thème, à l'attention du public. Facultative." },
      ],
      save,
    }));
  }

  if (ui.refTab === "acttypes") {
    body.appendChild(listPanel({
      title: "Types d'actes", help: "Nature juridique de l'acte ; le type alimente les métadonnées et la référence ELI.",
      items: c.actTypes, factory: () => ({ id: "nouveau", label: "Nouveau type", aknElement: "act" }),
      fields: () => [
        { key: "id", label: "Identifiant", type: "text" },
        { key: "label", label: "Libellé", type: "text" },
        { key: "aknElement", label: "Élément Akoma Ntoso", type: "text" },
      ],
      save,
    }));
  }

  if (ui.refTab === "annuaire") {
    body.appendChild(annuairePanel(save, redraw, card));
  }

  if (ui.refTab === "base") {
    body.appendChild(databasePanel());
  }

  if (ui.refTab === "circuits") {
    body.appendChild(circuitsPanel(save, redraw));
  }

  if (ui.refTab === "delais") {
    body.appendChild(delaisPanel(save, redraw));
  }

  if (ui.refTab === "signature") {
    body.appendChild(signaturePanel(save, redraw));
  }

  if (ui.refTab === "courriel") {
    body.appendChild(courrielPanel(save, redraw));
  }

  if (ui.refTab === "publication") {
    body.appendChild(publicationPanel(save, redraw));
  }

  if (ui.refTab === "assistants") {
    body.appendChild(assistantsPanel(save, redraw));
  }

  if (ui.refTab === "experimental") {
    body.appendChild(experimentalPanel(save, redraw));
  }

  if (ui.refTab === "journal") {
    body.appendChild(journalPanel());
  }

  if (ui.refTab === "donnees") {
    body.appendChild(card("Données", "Sauvegarde et restauration complètes : référentiel, trames, actes et comptes. Un fichier suffit pour installer l'application dans une autre structure.",
      h("div", { class: "fr-row" },
        button("Exporter tout (JSON)", { variant: "primary", icon: "download", onClick: exportAll }),
        button("Importer un fichier", { variant: "secondary", icon: "upload", onClick: importAll }),
      ),
      h("hr", { class: "fr-sep" }),
      h("p", { class: "fr-small fr-muted", text: `Actuellement : ${c.entities.length} entités · ${(c.services || []).length} services · ${c.people.length} personnes · ${c.refs.length} références · ${state.trames.length} trames · ${state.actes.length} actes · ${(state.reprises || []).length} reprises · ${state.users.length} comptes.` }),
      h("div", { class: "fr-row" },
        button("Vider le référentiel", { variant: "secondary", danger: true, onClick: resetConfig }),
        button("Réinstaller le jeu de démonstration", { variant: "tertiary", onClick: resetAll }),
        button("Repartir d'un référentiel vierge", { variant: "tertiary", danger: true, onClick: resetVierge }),
      ),
      h("p", { class: "fr-small fr-muted", text: `« Repartir d'un référentiel vierge » efface le référentiel, les trames et les actes — et, sur le service partagé, actes déposés, circuits et publications ; l'application redémarre ensuite sur un référentiel neuf. Les COMPTES sont conservés quand la connexion passe par le service de la collectivité (comptes locaux ou annuaire) : leurs mots de passe sont gardés par lui, hors du référentiel. C'est la sortie de démonstration : si la démonstration est allumée par le déploiement (\`DEMO\` dans le .env du service), le jeu fictif sera réinstallé au démarrage suivant — éteignez d'abord ce réglage.` }),
      optionsDeployees() && Object.keys(optionsDeployees().variables).length
        ? h("p", { class: "fr-small", text: `Réglages posés par le déploiement (fichier .env) : ${Object.keys(optionsDeployees().variables).length}. Ils s'appliquent par-dessus le référentiel à chaque démarrage — une valeur saisie ici ne les remplace pas ; une variable retirée du .env n'est plus imposée au lancement suivant. La liste est dans « Documentation technique › Variables de déploiement ».` })
        : null,
      h("hr", { class: "fr-sep" }),
      h("p", { class: "fr-small fr-muted", text: "Les comptes et leurs rôles se gèrent dans « Comptes et rôles »." }),
      h("p", { class: "fr-small fr-muted", text: "Le mode de connexion — comptes de l'application, ou annuaire de la collectivité (OIDC) — se règle dans l'onglet « Annuaire (OIDC) », où l'annuaire peut aussi être proposé en SECONDE PORTE à côté de la porte ordinaire. Brancher l'annuaire désactive automatiquement les comptes de démonstration. Le mode « comptes locaux » (identifiant et mot de passe) est, lui, un réglage du déploiement (`AUTH_MODE=password` dans le `.env` du service), et prime sur le référentiel ; le reste de l'annuaire se pose par les variables `SCRIBA_ANNUAIRE_*` du même fichier." }),
      h("p", { class: "fr-small fr-muted", text: "Le rangement des données — stockage de ce navigateur, service partagé, ou base MySQL / MariaDB de la collectivité — se règle dans l'onglet « Base de données »." }),
      h("div", { class: "fr-row" },
        button("Comptes et rôles", { variant: "secondary", icon: "lock", onClick: () => navigate("comptes") }),
        button("Base de données", { variant: "secondary", icon: "grid", onClick: () => { ui.refTab = "base"; redraw(); } }),
      ),
    ));
  }
}

// ------------------------------------------------------------- base de données
// On ne range pas ici des données : on choisit *où* elles vivent. Le réglage
// est propre au poste (il n'est pas exporté avec le référentiel) : chaque poste
// peut viser la même base partagée.
//
// C'est le SEUL écran qui montre l'état de la base en clair : il s'y abonne donc
// (l'en-tête, lui, se contente de sa pastille — voir `rafraichirPastilleBase`,
// src/ui/app.js). Refaire la coquille à chaque changement d'état faisait
// clignoter l'écran, et perdre le curseur de qui saisissait une adresse de
// service ou un jeton.
let stopSuiviBase = null;
function suivreEtatDeLaBase() {
  if (stopSuiviBase) { stopSuiviBase(); stopSuiviBase = null; }
  stopSuiviBase = db.onStatus(() => {
    if (state.route.view === "referentiel" && state.ui?.refTab === "base") redrawView();
  });
}

function databasePanel() {
  const ui = state.ui;
  ui.dbDraft = ui.dbDraft || { ...db.getSettings() };
  const d = ui.dbDraft;

  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Base de données" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Où sont rangés le référentiel, les trames, les actes et les comptes. En démonstration, le stockage du navigateur suffit ; en exploitation, l'application se branche sur la base de la collectivité (MySQL / MariaDB) et tous les postes travaillent alors sur les mêmes données." }));

  const active = db.getSettings();
  const st = db.status();
  const live = h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", alignItems: "center", margin: "10px 0 18px", minHeight: "22px" } });
  // L'essai le plus récent est gardé dans l'état de l'ÉCRAN : un redessin — un
  // changement d'état de la base en déclenche un — ne doit pas effacer la
  // réponse qu'on vient d'obtenir. C'est justement quand la base hésite qu'on
  // relit cet essai.
  for (const noeud of renduEssai(ui.dbEssai)) live.appendChild(noeud);

  wrap.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", alignItems: "center" } },
    h("span", { class: "fr-badge fr-badge--info", text: "En service : " + db.modeById(active.mode).label }),
    stateBadge(db.status()),
    db.pendingCount() ? h("span", { class: "fr-badge fr-badge--warning", text: `${db.pendingCount()} écriture(s) en attente de la base` }) : null,
    h("div", { class: "fr-spacer" }),
    button("Tester la connexion", {
      variant: "secondary", size: "sm", icon: "refresh",
      onClick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        clear(live);
        live.appendChild(h("span", { class: "fr-small fr-muted", text: "Test en cours…" }));
        const res = await db.test(d);
        // DEUX questions, deux réponses : le service répond-il, et accepte-t-il
        // d'ÉCRIRE ? La route de santé ne demande ni session ni anti-CSRF : elle
        // peut répondre 200 pendant que la base refuse chaque geste — l'écran
        // montrait alors « Connexion réussie » à côté d'une pastille rouge et
        // d'une file d'écritures en attente (voir CHANGELOG, note 1.3.2k).
        ui.dbEssai = { ...res, dirty, at: new Date().toISOString(), partage: db.modeById(d.mode).shared, base: d.mode === "external" ? (d.url || "") : "" };
        clear(live);
        for (const noeud of renduEssai(ui.dbEssai)) live.appendChild(noeud);
        btn.disabled = false;
        // L'essai vient de répondre sur ce réglage : l'état montré plus haut peut
        // donc être repris en compte — rien ne le recalcule tout seul, et une
        // pastille rouge vieille d'une panne réparée resterait affichée.
        if (!dirty) await db.health().catch(() => {});
      },
    }),
  ));
  wrap.appendChild(live);
  // Le motif de l'état, écrit noir sur blanc : la pastille ne le porte qu'en
  // infobulle, et un exploitant qui doit recopier un message d'erreur ne
  // devrait pas avoir à survoler une pastille pour le lire.
  if (st.state !== "ok" && st.detail) {
    wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 14px" }, text: st.detail }));
  }

  // Les écritures en attente : ce qui attend, depuis quand, ce que la base a
  // répondu au dernier renvoi — et les deux gestes. C'est la même question que
  // l'état, juste au-dessus : « 75 écritures en attente » sans dire lesquelles,
  // ni pourquoi elles ne partent pas, ni comment les renvoyer, ne se répare pas
  // (voir CHANGELOG, note 1.3.2l).
  const attente = db.pendingInfo();
  if (attente.count) wrap.appendChild(blocEnAttente(attente));

  const fields = h("div");
  const paintFields = () => {
    clear(fields);
    if (d.mode === "external") {
      fields.appendChild(textField({
        label: "Adresse du service de données", value: d.url || "", placeholder: "https://donnees.valmont-sur-loire.fr",
        help: "L'URL de base du serveur déployé (voir src/server/README.md). Laissez vide si l'application est servie par ce même serveur — c'est le cas du déploiement auto-hébergé ; sinon les chemins /v1/db/… y sont ajoutés.",
        onChange: (v) => { d.url = v.trim(); },
      }));
      // Mode « comptes locaux (mot de passe) » : la porte est la SESSION du
      // service (identifiant et mot de passe, cookie), et les écritures portent
      // l'anti-CSRF de la page — le jeton d'API n'est PAS utilisé. Le champ
      // disparaît : il laissait croire qu'un jeton (souvent le gabarit du
      // `.env`, une suite de zéros) était en service, et qu'il fallait le
      // corriger pour que la base réponde.
      if (sessionDeService(state.config)) {
        fields.appendChild(h("p", { class: "fr-small fr-muted", text: "Ce déploiement ouvre les données par une SESSION (identifiant et mot de passe) : aucun jeton d'API n'est nécessaire. C'est la session de l'agent, et elle seule, qui autorise la lecture et l'écriture — le service refuse une écriture sans elle." }));
      } else {
        fields.appendChild(textField({
          label: "Jeton d'API", value: d.token || "",
          help: "Jeton d'écriture remis par l'administrateur de la base. Seule son empreinte SHA-256 est conservée côté serveur.",
          onChange: (v) => { d.token = v.trim(); },
        }));
      }
    } else if (d.mode === "service") {
      fields.appendChild(textField({
        label: "Clé d'écriture du service", value: d.token || "", type: "password",
        help: "Le service ne conserve que l'empreinte SHA-256 de cette clé : elle n'est inscrite ni dans l'application, ni dans le référentiel, ni dans les exports. Sans clé, ce poste lit le recueil public mais n'écrit rien.",
        onChange: (v) => { d.token = v.trim(); },
      }));
      const etat = h("div", { class: "fr-small fr-muted", text: "Vérification de l'état du service…" });
      const gestes = h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", marginTop: "8px" } });
      fields.appendChild(etat);
      fields.appendChild(gestes);
      const cleEnService = () => d.token || db.getSettings().token || "";
      const montrerCle = (valeur, titre) => {
        const contenu = h("div", {},
          h("p", { class: "fr-small", text: "Conservez cette clé : elle n'est affichée qu'ici — le service n'en connaît que l'empreinte. Si vous la perdez, il faudra réinstaller l'état du service pour la remplacer." }),
          h("code", { class: "fr-mono", style: { display: "block", wordBreak: "break-all", padding: "10px", background: "var(--background-alt-grey, #eee)" }, text: valeur }),
        );
        const dlg = modal({
          title: titre, body: contenu,
          actions: (close) => [button("Copier la clé", { variant: "primary", icon: "copy", onClick: async () => { (await copyText(valeur)) ? toast("Clé copiée") : toast("Copie impossible", "warning"); } }), button("Fermer", { onClick: close })],
        });
        return dlg;
      };
      cles.etatService().then((e) => {
        if (!e.ok) { etat.textContent = "État du service indisponible : " + e.detail; return; }
        if (!e.provisionne) {
          etat.textContent = "Ce service n'a encore aucune clé : il est en LECTURE SEULE (le recueil public reste servi). Le premier dépôt de clé l'ouvre — à faire sans attendre sur une démonstration ouverte.";
          gestes.appendChild(button("Provisionner le service", {
            variant: "primary", size: "sm", icon: "lock",
            onClick: async () => {
              const res = await cles.provisionnerService({ label: "Administrateur" });
              if (!res.ok) { toast(res.detail, "error"); return; }
              d.token = res.cle;
              await db.setSettings({ token: res.cle }, { silent: true });
              toast("Service provisionné", "success");
              montrerCle(res.cle, "Clé d'administration du service");
              redrawView();
            },
          }));
        } else {
          etat.textContent = "Service provisionné : chaque clé en circulation porte un rôle (administrateur, editeur, redacteur, lecteur, prestataire) et n'ouvre que les routes de ce rôle.";
          gestes.appendChild(button("Voir les clés", {
            variant: "secondary", size: "sm", icon: "list",
            onClick: async () => {
              const r = await cles.listerCles(cleEnService());
              if (!r.ok) { toast(r.detail, "error"); return; }
              const contenu = h("div", { class: "fr-small" });
              if (!r.cles.length) contenu.appendChild(h("p", { text: "Aucune clé." }));
              for (const c of r.cles) {
                contenu.appendChild(h("div", { class: "fr-row", style: { gap: "8px", alignItems: "center", padding: "4px 0", flexWrap: "wrap" } },
                  h("code", { class: "fr-mono", text: c.id }),
                  h("span", { class: "fr-badge fr-badge--info", text: c.role }),
                  h("span", { text: c.label || "" }),
                  h("div", { class: "fr-spacer" }),
                  button("Révoquer", {
                    variant: "tertiary", size: "sm",
                    onClick: async () => {
                      const res = await cles.revoquerCle(c.id, cleEnService());
                      res.ok ? toast("Clé révoquée", "success") : toast(res.detail, "error");
                    },
                  })));
              }
              modal({ title: "Clés du service", body: contenu, actions: (close) => [button("Fermer", { onClick: close })] });
            },
          }));
          gestes.appendChild(button("Créer une clé d'API", {
            variant: "secondary", size: "sm", icon: "plus",
            title: "Créer une clé d'API : un compte de SERVICE, avec le rôle de votre choix",
            onClick: async () => {
              // Le rôle et le libellé se CHOISISSENT : une clé de service n'a pas
              // toujours à pouvoir tout faire. Une clé de lecture suffit à une
              // reprise de données ; une clé d'écriture sert à un poste, ou à un
              // outil tiers. Ces clés ne sont PAS des comptes du référentiel :
              // elles n'apparaissent ni dans « Comptes et rôles », ni dans les
              // personnes, ni dans l'annuaire.
              const etat = { label: "", role: "editeur" };
              const corps = h("div", { class: "fr-stack" },
                h("p", { class: "fr-small fr-muted", text: "Une clé d'API est un COMPTE DE SERVICE : un script, un poste ou un outil tiers s'en sert à la place d'une personne. Elle ne figure nulle part dans « Comptes et rôles » — le référentiel l'ignore. Le service n'en conserve que l'empreinte SHA-256 : elle ne s'affiche qu'UNE fois, au moment de sa création." }),
                textField({ label: "Libellé (pour la reconnaître plus tard)", value: "", onChange: (v) => { etat.label = v; } }),
                selectField({
                  label: "Rôle de la clé", value: etat.role,
                  options: [
                    { value: "lecteur", label: "Lecteur — consulter les actes déposés" },
                    { value: "redacteur", label: "Rédacteur — déposer et publier des actes" },
                    { value: "editeur", label: "Éditeur — publier, épingler, retirer" },
                    { value: "administrateur", label: "Administrateur — tout, y compris les clés" },
                    { value: "prestataire", label: "Prestataire — notification de signature seulement" },
                  ],
                  help: "Le rôle commande les routes que la clé ouvre : donnez-lui le moins de droits possible.",
                  onChange: (v) => { etat.role = v; },
                }));
              const dlg = modal({
                title: "Créer une clé d'API", body: corps,
                actions: (close) => [
                  button("Renoncer", { variant: "secondary", onClick: close }),
                  button("Créer la clé", {
                    variant: "primary", icon: "lock",
                    onClick: async () => {
                      const r = await cles.creerCle({ role: etat.role, label: etat.label || "Clé de service", token: cleEnService() });
                      if (!r.ok) { toast(r.detail, "error"); return; }
                      close();
                      montrerCle(r.cle, "Clé d'API — rôle " + r.role);
                    },
                  }),
                ],
              });
            },
          }));
          gestes.appendChild(button("Journal d'audit du service", {
            variant: "secondary", size: "sm", icon: "list",
            onClick: async () => {
              const r = await cles.journalService({ token: cleEnService() });
              if (!r.ok) { toast(r.detail, "error"); return; }
              const contenu = h("div", { class: "fr-small" });
              contenu.appendChild(h("p", { text: `Chaîne ${r.scelle ? "intègre" : "ROMPUE"} — ${r.total} entrée(s) conservée(s).` }));
              contenu.appendChild(h("p", { class: "fr-small fr-muted", text: "Journal APPEND-ONLY tenu par le service : chaque ligne scelle la précédente par son empreinte SHA-256. Rétention : les 2 000 dernières entrées (les plus anciennes sortent). Exportez-le régulièrement pour l'archiver hors du service." }));
              for (const e of r.entrees.slice().reverse()) contenu.appendChild(h("div", { text: `${e.le} · ${e.geste} · ${e.detail}` }));
              modal({
                title: "Journal d'audit du service", body: contenu,
                actions: (close) => [
                  button("Exporter (JSON)", {
                    variant: "secondary", icon: "download",
                    onClick: () => download(`journal-service-${new Date().toISOString().slice(0, 10)}.json`,
                      JSON.stringify({ service: "journal d'audit", exporteLe: new Date().toISOString(), scelle: r.scelle, total: r.total, entrees: r.entrees }, null, 2)),
                  }),
                  button("Fermer", { onClick: close }),
                ],
              });
            },
          }));
        }
      });
    }
  };

  wrap.appendChild(choiceField({
    label: "Mode de persistance",
    value: d.mode,
    options: db.MODES.map((m) => ({ value: m.id, label: m.label })),
    onChange: (v) => { d.mode = v; redrawView(); },
  }));
  wrap.appendChild(h("p", { class: "fr-hint", text: db.modeById(d.mode).help }));
  wrap.appendChild(fields);
  paintFields();

  const dirty = d.mode !== active.mode
    || (d.mode !== "local" && ((d.url || "") !== (active.url || "") || (d.token || "") !== (active.token || "")));
  wrap.appendChild(h("div", { class: "fr-row", style: { marginTop: "10px" } },
    button("Appliquer et recharger", {
      variant: "primary", icon: "check", disabled: !dirty,
      onClick: async () => {
        await db.setSettings({ mode: d.mode, url: d.url || "", token: d.token || "" }, { silent: true });
        toast("Base de données enregistrée — rechargement…", "success");
        location.reload();
      },
    }),
    dirty ? h("span", { class: "fr-small fr-muted", text: "Le changement prend effet au rechargement de l'application." }) : h("span", { class: "fr-small fr-muted", text: "Réglage à jour." }),
  ));

  wrap.appendChild(h("hr", { class: "fr-sep" }));
  wrap.appendChild(h("h3", { style: { fontSize: ".95rem", margin: "0 0 6px" }, text: "Transfert de données" }));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Pour installer la base, ou pour repartir des données d'un poste : ces deux opérations travaillent sur les données affichées à l'écran." }));

  const counts = h("p", { class: "fr-small fr-muted" });
  const c = state.config;
  counts.textContent = `À l'écran : ${c.entities.length} entités · ${(c.services || []).length} services · ${state.trames.length} trames · ${state.actes.length} actes · ${(state.reprises || []).length} reprises · ${state.users.length} comptes.`;

  const report = h("div", { class: "fr-small" });
  const showReport = (rows, verb) => {
    clear(report);
    const bad = rows.filter((r) => !r.ok);
    report.appendChild(h("p", { class: bad.length ? "fr-error-text" : "fr-small", text: bad.length ? `${verb} : ${bad.length} collection(s) en échec — ${bad.map((b) => b.name + " (" + b.error + ")").join(", ")}` : `${verb} : terminé.` }));
  };

  wrap.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", marginTop: "8px" } },
    button(db.isShared() ? "Envoyer les données à la base" : "Copier vers le stockage local", {
      variant: "secondary", icon: "upload",
      onClick: async () => {
        const rows = await db.push({ config: state.config, trames: state.trames, actes: state.actes, reprises: state.reprises, users: state.users });
        const bad = rows.filter((r) => !r.ok);
        if (bad.length) { showReport(rows, "Envoi"); toast("Envoi partiel — voir le détail", "error"); }
        else { clear(report); report.appendChild(h("p", { class: "fr-small", text: "Envoi terminé : le référentiel, les trames, les actes et les comptes ont été écrits dans la base." })); toast("Données envoyées à la base", "success"); }
        redrawView();
      },
    }),
    button("Récupérer depuis la base", {
      variant: "secondary", icon: "download",
      disabled: !db.isShared(),
      onClick: async () => {
        const ok = await confirmDialog("Récupérer depuis la base", "Les données affichées seront remplacées par celles de la base de données. Les modifications non enregistrées sur ce poste seront perdues.", { confirmLabel: "Récupérer" });
        if (!ok) return;
        const res = await db.pull();
        const rows = Object.entries(res).map(([name, r]) => ({ name, ...r }));
        showReport(rows, "Récupération");
        if (res.config?.ok) { state.config = res.config.value; applyBrand(); }
        if (res.trames?.ok) state.trames = res.trames.value || [];
        if (res.actes?.ok) state.actes = res.actes.value || [];
        if (res.reprises?.ok) state.reprises = res.reprises.value || [];
        if (res.users?.ok) { state.users = res.users.value || []; await setUsers(state.users); }
        toast("Données récupérées depuis la base", "success");
        redrawView();
      },
    }),
  ));
  wrap.appendChild(counts);
  wrap.appendChild(report);
  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "10px" }, text: "La session et les réglages de ce poste restent locaux. Le jeton de la base n'est jamais exporté avec le référentiel." }));

  suivreEtatDeLaBase();
  // L'état affiché date du DERNIER geste : rien ne le recalcule. Un écran qui
  // MONTRE l'état doit donc l'éprouver à son ouverture — sinon une pastille
  // rouge, vieille d'une panne déjà réparée, reste affichée à côté d'un test de
  // connexion réussi, et l'écran se contredit (voir CHANGELOG, note 1.3.2k).
  if (db.status().state !== "ok" && Date.now() - derniereVerificationBase > 5000) {
    derniereVerificationBase = Date.now();
    db.health().catch(() => {});
  }
  return wrap;
}

let derniereVerificationBase = 0;

function stateBadge(st) {
  const map = {
    ok: ["success", "Base disponible"],
    offline: ["warning", "Service injoignable"],
    error: ["error", "Erreur de connexion"],
    unknown: ["info", "État inconnu"],
  };
  const [color, label] = map[st.state] || map.unknown;
  return h("span", { class: `fr-badge fr-badge--${color}`, title: st.detail || "", text: label });
}

// Une ligne de verdict d'essai : la question posée, et le mot du service.
// « oui » et « non » disent l'essentiel ; le message du service dit le reste.
function ligneEssai(question, ok, detail) {
  return h("div", { class: "fr-row", style: { gap: "8px", alignItems: "baseline", flexWrap: "wrap" } },
    h("span", { class: `fr-badge fr-badge--${ok ? "success" : "error"}`, text: question }),
    detail ? h("span", { class: "fr-small fr-muted", text: detail }) : null,
  );
}

// Le rendu d'un essai de connexion, hors du panneau : il sert à l'afficher au
// moment de l'essai ET à le reprendre après un redessin — un verdict qui
// s'efface tout seul ne sert à rien.
function renduEssai(essai) {
  if (!essai) return [];
  const echec = essai.ecriture && !essai.ecriture.ok;
  // Le refus est constaté ; la PISTE dit quoi faire. Sans elle, « csrf_invalide »
  // ne dit rien à personne (voir CHANGELOG, note 1.3.2m).
  const piste = echec ? db.expliquerRefus({ code: essai.ecriture.code, base: essai.base }) : "";
  return [
    ligneEssai(essai.partage === false ? "Le stockage du navigateur répond" : "Le service répond", !!essai.ok, essai.detail || ""),
    essai.ecriture ? ligneEssai("La base accepte les écritures", !!essai.ecriture.ok, essai.ecriture.detail || "") : null,
    piste ? h("p", { class: "fr-small fr-muted", style: { flexBasis: "100%", margin: "2px 0 0" }, text: piste }) : null,
    h("span", { class: "fr-small fr-muted", text: `${essai.dirty
      ? "Essai porté sur le réglage AFFICHÉ : « Appliquer et recharger » le mettra en service"
      : "Essai porté sur le réglage en service"}${essai.at ? ` — ${depuisQuand(essai.at)}` : ""}.` }),
  ].filter(Boolean);
}

// « il y a douze minutes » : l'âge d'une attente se lit mieux en durée qu'en
// date — c'est ce qui dit si la panne dure depuis deux minutes ou deux jours.
function depuisQuand(iso) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "un moment";
  const minutes = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} minute${minutes > 1 ? "s" : ""}`;
  const heures = Math.floor(minutes / 60);
  if (heures < 24) return `il y a ${heures} heure${heures > 1 ? "s" : ""}`;
  const jours = Math.floor(heures / 24);
  return `il y a ${jours} jour${jours > 1 ? "s" : ""}`;
}

// Le bloc des écritures en attente : ce qui attend, depuis quand, et ce que la
// base a répondu. Les deux gestes sont ici, à côté du motif, parce que c'est le
// seul endroit d'où l'on peut agir : renvoyer (« la base répond de nouveau »),
// ou abandonner (« ces écritures-là ne partiront jamais »).
function blocEnAttente(info) {
  const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)", margin: "0 0 14px" } });
  box.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", alignItems: "center" } },
    h("span", { class: "fr-badge fr-badge--warning", text: `${info.count} écriture(s) en attente de la base` }),
    h("span", { class: "fr-small fr-muted", text: `en attente depuis ${depuisQuand(info.depuis)}` }),
  ));
  box.appendChild(h("p", { class: "fr-small", style: { margin: "8px 0 0" },
    text: `Par collection : ${info.collections.map((c) => `${c.label} (${c.count})`).join(" · ")}.` }));
  if (info.derniereErreur) {
    // Le nom de la collection refusée est dans le motif : sans lui, « la base a
    // refusé le renvoi » ne dit pas QUOI renvoyer — et c'est justement ce qu'il
    // faut corriger (ou abandonner) quand le refus est définitif.
    const label = (info.collections.find((c) => c.name === info.derniereErreur.collection) || {}).label
      || (db.COLLECTIONS[info.derniereErreur.collection] || {}).label || info.derniereErreur.collection;
    box.appendChild(h("p", { class: "fr-error-text fr-small", style: { margin: "4px 0 0" },
      text: `Dernier renvoi refusé ${depuisQuand(info.derniereErreur.at)}${label ? ` (${label})` : ""} : ${info.derniereErreur.message}` +
        (info.derniereErreur.status ? ` (HTTP ${info.derniereErreur.status})` : "") }));
  }
  box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" },
    text: "Ces écritures sont gardées sur CE poste et renvoyées automatiquement dès que la base répond (toutes les trente secondes). Tant qu'elles attendent, elles ne sont PAS dans la base : les autres postes ne les voient pas encore." }));
  box.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", gap: "8px", marginTop: "8px" } },
    button("Renvoyer maintenant", {
      variant: "primary", size: "sm", icon: "refresh",
      onClick: async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        // Le pilote peut avoir été bâti sur un présage périmé du mode (voir
        // `reparerPilote`) : on répare à la demande — mode redemandé au service,
        // jeton anti-CSRF relu avec la session, pilote refait — sinon un refus
        // d'anti-CSRF ou de session se répéterait à l'identique.
        await db.reparerPilote({ force: true }).catch(() => {});
        const r = await db.flushPending();
        // Le bloc est reconstruit juste après : c'est LUI qui porte le motif du
        // refus (« Dernier renvoi refusé… »). Le toast, lui, dit que le geste a
        // bien eu lieu — sans quoi un échec identique au précédent ne se verrait
        // pas.
        if (r.error) toast("Le renvoi a échoué : la base a refusé ces écritures", "error");
        else toast(`${r.flushed} écriture(s) transmises à la base`, "success");
        btn.disabled = false;
        redrawView();
      },
    }),
    button("Abandonner ces écritures", {
      variant: "tertiary", size: "sm", danger: true,
      onClick: async () => {
        const ok = await confirmDialog("Abandonner les écritures en attente",
          `Les ${info.count} écriture(s) gardées sur ce poste ne seront pas renvoyées à la base. Ce poste repart de ce que la base contient : les modifications faites hors ligne et non transmises seront perdues.`,
          { confirmLabel: "Abandonner" });
        if (!ok) return;
        const n = await db.viderPending();
        toast(`${n} écriture(s) abandonnée(s)`, "warning");
        redrawView();
      },
    }),
  ));
  return box;
}

function card(title, sub, ...children) {
  return h("div", { class: "fr-card", style: { maxWidth: "900px" } },
    h("h2", { class: "fr-card__title", text: title }),
    sub ? h("p", { class: "fr-card__sub", text: sub }) : null,
    ...children);
}

// -------------------------------------------------------------- services
// Les services sont l'échelon auquel les comptes sont rattachés, et chaque
// service regroupe des bureaux. Les bureaux sont donc édités *dans* le service
// (liste imbriquée) plutôt que dans un onglet séparé.
function servicesPanel(save, redraw) {
  const c = state.config;
  c.services = c.services || [];
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Services et bureaux" }),
    button("Ajouter un service", {
      variant: "secondary", size: "sm", icon: "plus",
      onClick: () => { c.services.push(newService({ entityId: c.entities?.[0]?.id || "" })); save(); redraw(); },
    }),
  ));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Un service regroupe des bureaux. Les comptes sont rattachés à des services : par défaut, un compte a accès à tous les bureaux de son service, et l'administrateur peut ensuite restreindre son accès à certains bureaux (onglet « Comptes et rôles »). Un service peut aussi DÉPENDRE d'un autre service, ou du bureau d'un autre service : ce rattachement — qui élargit le périmètre des agents du service de tête — se pose dans l'écran Organigramme." }));

  const listEl = h("div", { class: "fr-stack", style: { marginTop: "10px" } });
  wrap.appendChild(listEl);

  const counts = (serviceId) => state.users.filter((u) => (u.memberships || []).some((m) => m.serviceId === serviceId)).length;

  if (!c.services.length) listEl.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun service. Sans service, les trames restent générales et tous les comptes voient tout." }));

  c.services.forEach((rec, i) => {
    rec.bureaux = rec.bureaux || [];
    const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
    box.appendChild(h("div", { class: "fr-row" },
      h("strong", { class: "fr-small", text: `${rec.code || "?"} — ${rec.name || "Sans nom"}` }),
      h("span", { class: "fr-badge", text: `${rec.bureaux.length} bureau${rec.bureaux.length > 1 ? "x" : ""}` }),
      h("span", { class: "fr-badge fr-badge--info", text: `${counts(rec.id)} compte(s)` }),
      h("div", { class: "fr-spacer" }),
      button("", { variant: "tertiary", icon: "up", size: "sm", title: "Monter", onClick: () => { if (i > 0) { const [x] = c.services.splice(i, 1); c.services.splice(i - 1, 0, x); save(); redraw(); } } }),
      button("", { variant: "tertiary", icon: "down", size: "sm", title: "Descendre", onClick: () => { if (i < c.services.length - 1) { const [x] = c.services.splice(i, 1); c.services.splice(i + 1, 0, x); save(); redraw(); } } }),
      button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Supprimer le service", onClick: () => removeService(rec, save, redraw) }),
    ));
    box.appendChild(h("div", { class: "fr-grid fr-grid--2" },
      textField({ label: "Code", value: rec.code || "", help: "Abréviation affichée dans les listes (ex. DSI).", onChange: (v) => { rec.code = v; save(); } }),
      textField({ label: "Nom du service", value: rec.name || "", onChange: (v) => { rec.name = v; save(); } }),
    ));
    if (c.entities?.length) {
      box.appendChild(selectField({
        label: "Entité de rattachement", value: rec.entityId || "", placeholder: "—",
        options: c.entities.map((e) => ({ value: e.id, label: e.name })),
        onChange: (v) => { rec.entityId = v; save(); },
      }));
    }

    box.appendChild(h("span", { class: "fr-label", style: { marginTop: "8px" }, text: "Bureaux" }));
    if (!rec.bureaux.length) box.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun bureau : tout le service est traité d'un seul tenant." }));
    for (const b of rec.bureaux) {
      box.appendChild(h("div", { class: "fr-row", style: { gap: "6px", flexWrap: "nowrap" } },
        h("input", {
          class: "fr-input", style: { flex: "1 1 auto", minWidth: "0" }, value: b.name || "",
          placeholder: "Nom du bureau",
          on: { input: (e) => { b.name = e.target.value; save(); } },
        }),
        button("", {
          variant: "tertiary", icon: "trash", size: "sm", title: "Supprimer le bureau",
          onClick: () => removeBureau(rec, b, save, redraw),
        }),
      ));
    }
    box.appendChild(h("div", { class: "fr-row", style: { marginTop: "6px" } },
      button("Ajouter un bureau", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { rec.bureaux.push(newBureau()); save(); redraw(); } }),
    ));

    box.appendChild(reviseurBlock(rec, save, redraw));
    listEl.appendChild(box);
  });
  return wrap;
}

// QUALITÉ DE RÉVISEUR portée par un service : ses agents contrôlent les actes
// avant leur signature — c'est ainsi qu'un service des affaires juridiques
// révise les actes des autres services. Une compétence sans filtre vaut « tous
// les services, tous les actes » ; restreindre la qualité à certains bureaux
// n'engage que les agents de ces bureaux. Voir src/lib/revision.js.
//
// Ce bloc n'ÉCRIT `rec.reviseur` que si l'administrateur s'en sert : un service
// sans qualité de réviseur ne doit pas se retrouver affublé d'un réglage vide
// dans le référentiel — et donc dans son export JSON.
function reviseurBlock(rec, save, redraw) {
  const c = state.config;
  const actif = rec.reviseur?.actif === true;
  const ecrire = (patch) => {
    if (!rec.reviseur) rec.reviseur = newCompetence({ actif: true, bureaux: [] });
    Object.assign(rec.reviseur, patch);
    save(); redraw();
  };

  const box = h("div", { class: "service-reviseur" },
    h("label", { class: "fr-check" },
      h("input", { type: "checkbox", checked: actif, on: { change: (e) => {
        if (e.target.checked) { ecrire({ actif: true }); return; }
        if (rec.reviseur) { rec.reviseur.actif = false; save(); }
        redraw();
      } } }),
      h("span", {}, h("strong", { text: "Qualité de réviseur" }),
        h("span", { class: "fr-small fr-muted", text: " — les agents de ce service contrôlent les actes avant leur signature." }))),
  );
  if (!actif) return box;

  const cur = rec.reviseur;
  box.appendChild(h("p", { class: "fr-hint", text: "Ne rien cocher vaut « tous les services, tous les actes » : c'est le cas d'un service qui contrôle l'ensemble des actes de la collectivité. Ce que ce service révise : " + competenceLabel(c, cur) + "." }));
  if (rec.bureaux.length) box.appendChild(choiceField({
    label: "Bureaux concernés", value: cur.bureaux, multi: true,
    help: "Vide : tout le service. Sinon, seuls les agents de ces bureaux tiennent la qualité.",
    options: rec.bureaux.map((b) => ({ value: b.id, label: b.name || b.id })),
    onChange: (v) => ecrire({ bureaux: v }),
  }));
  const champ = (label, value, options, help, apply) => options.length
    ? choiceField({ label, value, multi: true, help, options, onChange: apply })
    : null;
  box.appendChild(champ("Services dont les actes relèvent de ce réviseur", cur.services,
    (c.services || []).map((s) => ({ value: s.id, label: (s.code ? s.code + " — " : "") + s.name })),
    "Vide : tous les services.", (v) => ecrire({ services: v })));
  box.appendChild(champ("Familles de trames", cur.familyIds,
    (c.families || []).map((f) => ({ value: f.id, label: f.label })),
    "Vide : toutes.", (v) => ecrire({ familyIds: v })));
  box.appendChild(champ("Types d'actes", cur.actTypes,
    (c.actTypes || []).map((t) => ({ value: t.id, label: t.label })),
    "Vide : tous.", (v) => ecrire({ actTypes: v })));
  box.appendChild(champ("Entités signataires", cur.entityIds,
    (c.entities || []).map((e) => ({ value: e.id, label: (e.code ? e.code + " — " : "") + e.name })),
    "Vide : toutes.", (v) => ecrire({ entityIds: v })));
  return box;
}

async function removeService(rec, save, redraw) {
  const n = state.users.filter((u) => (u.memberships || []).some((m) => m.serviceId === rec.id)).length;
  const ok = await confirmDialog("Supprimer le service",
    `« ${rec.code || "?"} — ${rec.name} » sera retiré du référentiel.${n ? ` ${n} compte(s) y sont rattachés : ce rattachement sera également supprimé.` : ""}`,
    { confirmLabel: "Supprimer", danger: true });
  if (!ok) return;
  // Les services qui PENDAIENT sous celui-ci (ou sous l'un de ses bureaux)
  // remontent à la racine de leur entité : ils ne disparaissent pas avec lui.
  const bureaux = rec.bureaux || [];
  for (const s of state.config.services) {
    if (s.parentId === rec.id || bureaux.some((b) => b.id === s.parentId)) s.parentId = "";
  }
  state.config.services = state.config.services.filter((s) => s.id !== rec.id);
  let touchedUsers = false;
  for (const u of state.users) {
    if ((u.memberships || []).some((m) => m.serviceId === rec.id)) {
      u.memberships = u.memberships.filter((m) => m.serviceId !== rec.id);
      touchedUsers = true;
    }
  }
  if (touchedUsers) await setUsers(state.users);
  save(); redraw();
}

async function removeBureau(service, bureau, save, redraw) {
  const n = state.users.filter((u) => (u.memberships || []).some((m) => Array.isArray(m.bureaux) && m.bureaux.includes(bureau.id))).length;
  const ok = await confirmDialog("Supprimer le bureau",
    `« ${bureau.name || "Bureau"} » sera retiré du service « ${service.name} ».${n ? ` Son retrait élargit l'accès de ${n} compte(s) restreint(s) à certains bureaux.` : ""}`,
    { confirmLabel: "Supprimer", danger: true });
  if (!ok) return;
  // Un service qui pendait sous ce bureau remonte au service qui le porte.
  for (const s of state.config.services) if (s.parentId === bureau.id) s.parentId = service.id;
  service.bureaux = service.bureaux.filter((b) => b.id !== bureau.id);
  let touchedUsers = false;
  for (const u of state.users) for (const m of u.memberships || []) {
    if (Array.isArray(m.bureaux) && m.bureaux.includes(bureau.id)) { m.bureaux = m.bureaux.filter((id) => id !== bureau.id); touchedUsers = true; }
  }
  if (touchedUsers) await setUsers(state.users);
  save(); redraw();
}

function listPanel({ title, help, items, fields, factory, save }) {
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: title }),
    button("Ajouter", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { items.push(factory()); save(); rerenderPanel(); } }),
  ));
  if (help) wrap.appendChild(h("p", { class: "fr-card__sub", text: help }));
  const listEl = h("div", { class: "fr-stack" });
  wrap.appendChild(listEl);
  renderRows();
  function rerenderPanel() { clear(listEl); renderRows(); }

  function renderRows() {
    if (!items.length) { listEl.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun élément." })); return; }
    items.forEach((rec, i) => {
      const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
      box.appendChild(h("div", { class: "fr-row" },
        h("strong", { class: "fr-small", text: String(rec.label || rec.name || rec.id || ("#" + (i + 1))).slice(0, 70) }),
        h("div", { class: "fr-spacer" }),
        button("", { variant: "tertiary", icon: "up", size: "sm", title: "Monter", onClick: () => { if (i > 0) { const [x] = items.splice(i, 1); items.splice(i - 1, 0, x); save(); rerenderPanel(); } } }),
        button("", { variant: "tertiary", icon: "down", size: "sm", title: "Descendre", onClick: () => { if (i < items.length - 1) { const [x] = items.splice(i, 1); items.splice(i + 1, 0, x); save(); rerenderPanel(); } } }),
        button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Supprimer", onClick: async () => {
          const ok = await confirmDialog("Supprimer", "Cet élément sera retiré du référentiel.", { confirmLabel: "Supprimer", danger: true });
          if (ok) { items.splice(i, 1); save(); rerenderPanel(); }
        } }),
      ));
      for (const f of fields(rec)) {
        const set = (v) => { rec[f.key] = v; save(); };
        if (f.type === "textarea") box.appendChild(textField({ label: f.label, value: rec[f.key] || "", rows: f.rows || 3, help: f.help, onChange: set }));
        else if (f.type === "boolean") box.appendChild(h("label", { class: "fr-check" }, (() => { const cb = h("input", { type: "checkbox", checked: !!rec[f.key] }); cb.addEventListener("change", () => set(cb.checked)); return cb; })(), f.label));
        else if (f.type === "select") box.appendChild(selectField({ label: f.label, value: rec[f.key] || "", help: f.help, placeholder: f.placeholder ?? "—", options: (f.options || []).map(normOpt), onChange: set }));
        else if (f.type === "multichoice") box.appendChild(choiceField({ label: f.label, value: rec[f.key] || [], help: f.help, multi: true, options: (f.options || []).map(normOpt), onChange: set }));
        else box.appendChild(textField({ label: f.label, value: rec[f.key] ?? "", help: f.help, onChange: set }));
      }
      listEl.appendChild(box);
    });
  }
  return wrap;
}

const normOpt = (o) => (typeof o === "string" ? { value: o, label: o } : o);

// Les références qui peuvent fonder un pouvoir de signer : des décisions et
// autres actes, pas des codes ni des règlements — on ne tient pas un pouvoir de
// signer du code général des collectivités territoriales.
const refsDecision = (c) => (c.refs || [])
  .filter((r) => r.active !== false && !["code", "reglement", "instruction"].includes(r.kind))
  .map((r) => ({ value: r.id, label: (r.label || r.id).slice(0, 110) }));

// ------------------------------------------------------------------ données
function exportAll() {
  download(`referentiel-actes-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({
    kind: "actes-app", version: 1,
    exportedAt: new Date().toISOString(),
    config: state.config, trames: state.trames, actes: state.actes, reprises: state.reprises, users: state.users,
  }, null, 2));
}

async function importAll() {
  const f = await pickFile(".json");
  if (!f) return;
  try {
    const d = JSON.parse(f.text);
    if (d.config) { state.config = d.config; await saveConfig(state.config); applyBrand(); }
    if (Array.isArray(d.trames)) state.trames = d.trames;
    if (Array.isArray(d.actes)) state.actes = d.actes;
    if (Array.isArray(d.reprises)) state.reprises = d.reprises;
    touch("trames"); touch("actes"); touch("reprises");
    if (Array.isArray(d.users) && d.users.length) await setUsers(d.users);
    // Le référentiel importé peut changer le mode d'authentification (annuaire
    // ou comptes de l'application) : on réapplique, sinon les comptes de
    // démonstration resteraient actifs alors que l'annuaire est branché.
    await applyAuthMode();
    toast("Données importées", "success");
  } catch (e) {
    toast("Import impossible : " + e.message, "error");
  }
}

async function resetConfig() {
  const ok = await confirmDialog("Vider le référentiel", "Entités, personnes, rôles, références, mentions, familles et types d'actes seront remis à zéro. Les trames et les actes sont conservés.", { confirmLabel: "Vider", danger: true });
  if (!ok) return;
  const keep = { brand: state.config.brand, numbering: state.config.numbering, vocab: state.config.vocab };
  state.config = { ...state.config, entities: [], services: [], people: [], roles: [], refs: [], mentions: [], families: [], actTypes: state.config.actTypes.length ? state.config.actTypes : [{ id: "decision", label: "Décision", aknElement: "act" }] };
  touch("config");
  toast("Référentiel vidé");
}

async function resetAll() {
  const ok = await confirmDialog("Réinstaller la démonstration", "Référentiel, trames, actes et comptes locaux seront remplacés par le jeu de données initial.", { confirmLabel: "Réinstaller", danger: true });
  if (!ok) return;
  await clearAll();
  state.config = seedConfig();
  state.trames = seedTrames();
  state.actes = [];
  state.reprises = [];
  touch("config"); touch("trames"); touch("actes"); touch("reprises");
  await resetDemoUsers();
  applyBrand();
  toast("Jeu de démonstration réinstallé", "success");
}

// Repartir d'un référentiel VIERGE : la SORTIE de démonstration. Ce bouton ne
// remet pas le jeu fictif — il l'efface, partout. Le recueil public lit le
// SERVICE : vider le seul navigateur laisserait les publications de
// démonstration en ligne, donc on purge d'abord le service, puis le stockage
// local, et l'application redémarre : `bootstrap()` sème alors un référentiel
// vierge — ou le jeu de démonstration, si le déploiement l'allume encore (voir
// src/lib/demo.js).
async function resetVierge() {
  // Les COMPTES du DÉPLOIEMENT — comptes locaux tenus par le service, ou agents
  // de l'annuaire — ne partent pas avec le référentiel : leurs mots de passe
  // vivent chez le service, hors du référentiel, et les effacer ici laissait
  // l'installation sans personne pour se connecter, le compte d'administration
  // compris (voir `comptesDuDeploiement`, src/lib/auth.js). La fenêtre de
  // confirmation le dit, puisque le bouton promettait jusqu'ici d'effacer
  // « tout, comptes compris ».
  const garderComptes = comptesDuDeploiement();
  const ok = await confirmDialog(
    "Repartir d'un référentiel vierge",
    "Tout est effacé : référentiel, trames, actes"
      + (garderComptes ? "" : ", comptes")
      + ", et — sur le service partagé — actes déposés, circuits de signature et publications."
      + (garderComptes
        ? " Les COMPTES, eux, sont CONSERVÉS : leurs mots de passe sont gardés par le service, et les effacer ici ne les supprimerait pas — l'installation se retrouverait sans personne pour se connecter, votre compte compris. Supprimez ceux qui n'ont plus lieu d'être dans « Comptes et rôles »."
        : "")
      + " L'installation repart d'une page blanche, à construire. Action irréversible.",
    { confirmLabel: "Repartir à zéro", danger: true },
  );
  if (!ok) return;
  const purge = await purgerService();
  if (!purge.ok) {
    // Le service a REFUSÉ (ou la purge a échoué) : sans cela, on laisserait la
    // fiction en ligne. On s'arrête et on le dit, plutôt que de faire semblant.
    toast("Le service n'a pas pu être purgé : " + purge.detail, "error");
    return;
  }
  if (purge.avertissement) {
    // Le poste va être vidé, mais le service ne connaît pas la purge (service
    // plus ancien que l'application, le plus souvent) : ses publications
    // resteront en ligne. On le dit AVANT d'effacer, et l'agent décide.
    const continuer = await confirmDialog(
      "Le service n'a pas de purge",
      purge.avertissement + " Le référentiel de ce poste peut malgré tout être vidé : l'application rechargera un référentiel vierge.",
      { confirmLabel: "Vider quand même", danger: true },
    );
    if (!continuer) return;
  }
  await clearAll({ garderComptes });
  location.reload();
}

// La purge du service (actes déposés, circuits, publications). Il faut la clé
// d'écriture — remise au poste par le déploiement, sinon celle du jeu de
// démonstration du référentiel — sauf en mode « mot de passe », où c'est la
// session de l'agent qui ouvre le droit (voir src/lib/remote.js).
async function purgerService() {
  const token = sessionDeService(state.config)
    ? null
    : (cleService() || publicationSettings(state.config).jetonDemonstration || null);
  try {
    const r = await post("/v1/admin/purge", { confirmation: "repurge" }, { token, label: "Remise à zéro du service" });
    if (r.ok) return { ok: true };
    // Aucun service joignable (aperçu hors ligne, transport en échec) : il n'y a
    // rien à purger de ce côté.
    if (r.status === 0) return { ok: true, absent: true };
    // Un service qui ne connaît pas la route (version antérieure à celle de
    // l'application) : on continue, mais on le DIT — ses publications, elles,
    // subsistent.
    if (r.status === 404 || r.status === 405) {
      return { ok: true, avertissement: "Le service n'a pas la route de purge (POST /v1/admin/purge) — il est antérieur à cette version de l'application, ou il l'a refusée : les actes déposés et les publications déjà en ligne ne seront pas effacés." };
    }
    return { ok: false, detail: errorMessage(r) };
  } catch (e) {
    // Transport injoignable : le service est absent, pas en faute.
    return { ok: true, absent: true, detail: (e && e.message) || String(e) };
  }
}

// ------------------------------------------------- circuits de validation
// Un circuit est une DONNÉE du référentiel, pas une règle codée : c'est ici
// qu'on décide du chemin que suit un acte avant la signature, et de qui le
// valide. Le parapheur (src/lib/validation.js) ne fait que l'appliquer — un
// référentiel sans circuit n'a donc aucun parapheur, ce qui préserve le
// comportement d'origine.
// La fiche d'un circuit s'ouvre à part (une « sous-vue ») : la liste des
// circuits reste lisible quand ils sont nombreux, là où les empiler faisait une
// page interminable. La liste dit l'essentiel — actif, nombre d'étapes, à quoi
// il s'applique — et un clic ouvre la fiche complète.
const ciblageResume = (cir) => {
  const n = (a) => (Array.isArray(a) ? a.filter(Boolean).length : 0);
  const parts = [];
  if (n(cir.trameIds)) parts.push(n(cir.trameIds) + " trame(s)");
  if (n(cir.familyIds)) parts.push(n(cir.familyIds) + " famille(s)");
  if (n(cir.entityIds)) parts.push(n(cir.entityIds) + " entité(s)");
  return parts.length ? parts.join(" · ") : "tous les actes";
};

const etapesResume = (cir) => (cir.steps || []).map((s) => natureEtape(s.kind).label).join(" → ");

function circuitsPanel(save, redraw) {
  const c = state.config;
  c.circuits = c.circuits || [];
  const ui = (state.ui = state.ui || {});
  const wrap = h("div", { class: "fr-stack", style: { maxWidth: "980px" } });
  const paint = () => { save(); redraw(); };

  const ouvert = (c.circuits || []).find((x) => x.id === ui.circuitOuvert) || null;
  if (ouvert) {
    wrap.appendChild(h("div", { class: "fr-row", style: { alignItems: "center" } },
      button("Tous les circuits", { variant: "tertiary", size: "sm", icon: "left", onClick: () => { ui.circuitOuvert = ""; redraw(); } }),
      h("span", { class: "fr-small fr-muted", text: "Fiche d'un circuit de validation" })));
    wrap.appendChild(circuitCard(ouvert, c.circuits.indexOf(ouvert), paint, { seul: true }));
    return wrap;
  }

  wrap.appendChild(h("div", { class: "fr-card" },
    h("div", { class: "fr-row" },
      h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Circuits de validation" }),
      button("Nouveau circuit", { variant: "secondary", size: "sm", icon: "plus", onClick: () => {
        const cir = newCircuit();
        c.circuits.push(cir);
        paint();
        ui.circuitOuvert = cir.id;
        redraw();
      } }),
    ),
    h("p", { class: "fr-card__sub", text: "Le chemin que suit un acte avant d'être signé : une suite d'étapes, chacune d'une nature — vérification, visa ou signature — et confiée à un rôle, à une personne nommée ou à un service. Les étapes sont séquentielles, et un circuit s'ouvre en principe par la vérification du réviseur. Un circuit sans ciblage s'applique à tous les actes ; un circuit ciblé l'emporte sur lui. Sans circuit, les actes partent directement en signature." }),
  ));

  if (!c.circuits.length) {
    wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun circuit : les actes partent en signature sans validation préalable." }));
  }
  for (const [i, cir] of c.circuits.entries()) wrap.appendChild(ligneCircuit(cir, i, paint, () => { ui.circuitOuvert = cir.id; redraw(); }));
  return wrap;
}

// Une ligne du récapitulatif : ce qu'il faut pour choisir, et rien de plus.
function ligneCircuit(cir, i, paint, ouvrir) {
  const c = state.config;
  const etapes = cir.steps || [];
  return h("div", { class: "fr-card recapitulatif" },
    h("div", { class: "fr-row" },
      button(cir.label || "Circuit sans nom", { variant: "secondary", size: "sm", icon: "right", onClick: ouvrir }),
      h("span", { class: "fr-badge fr-badge--" + (cir.active === false ? "warning" : "success"), text: cir.active === false ? "inactif" : "actif" }),
      h("span", { class: "fr-small fr-muted", text: etapes.length + " étape(s)" }),
      h("span", { class: "fr-small fr-muted", text: ciblageResume(cir) }),
      h("div", { class: "fr-spacer" }),
      button("", { variant: "tertiary", size: "sm", icon: "up", title: "Monter", onClick: () => { if (i === 0) return; const [x] = c.circuits.splice(i, 1); c.circuits.splice(i - 1, 0, x); paint(); } }),
      button("", { variant: "tertiary", size: "sm", icon: "down", title: "Descendre", onClick: () => { if (i >= c.circuits.length - 1) return; const [x] = c.circuits.splice(i, 1); c.circuits.splice(i + 1, 0, x); paint(); } }),
    ),
    etapes.length ? h("p", { class: "fr-small fr-muted", text: etapesResume(cir) }) : h("p", { class: "fr-small fr-muted", text: "Aucune étape : ce circuit n'ouvrira pas de parapheur." }),
  );
}

function circuitCard(cir, i, paint, opts = {}) {
  const c = state.config;
  const garder = () => touch("config", { rerender: false });
  const fermer = () => { state.ui.circuitOuvert = ""; redrawView(); };
  const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });

  box.appendChild(h("div", { class: "fr-row" },
    h("strong", { text: cir.label || "Circuit sans nom" }),
    h("span", { class: "fr-badge fr-badge--" + (cir.active === false ? "warning" : "success"), text: cir.active === false ? "inactif" : "actif" }),
    h("span", { class: "fr-small fr-muted", text: (cir.steps || []).length + " étape(s)" }),
    h("div", { class: "fr-spacer" }),
    opts.seul ? null : button("", { variant: "tertiary", size: "sm", icon: "up", title: "Monter", onClick: () => { if (i === 0) return; const [x] = c.circuits.splice(i, 1); c.circuits.splice(i - 1, 0, x); paint(); } }),
    opts.seul ? null : button("", { variant: "tertiary", size: "sm", icon: "down", title: "Descendre", onClick: () => { if (i >= c.circuits.length - 1) return; const [x] = c.circuits.splice(i, 1); c.circuits.splice(i + 1, 0, x); paint(); } }),
    button("", { variant: "tertiary", size: "sm", icon: "trash", title: "Supprimer", onClick: async () => {
      const ok = await confirmDialog("Supprimer le circuit", `« ${cir.label} » cessera de s'appliquer aux nouveaux actes. Les circuits déjà ouverts sur des actes en cours restent inchangés.`, { confirmLabel: "Supprimer", danger: true });
      if (!ok) return;
      c.circuits.splice(i, 1);
      if (opts.seul) fermer();
      else paint();
    } }),
  ));

  box.appendChild(textField({ label: "Libellé", value: cir.label || "", onChange: (v) => { cir.label = v; garder(); } }));
  box.appendChild(textField({ label: "Description", value: cir.description || "", rows: 2, help: "À quoi sert ce circuit (facultatif).", onChange: (v) => { cir.description = v; garder(); } }));

  const actif = h("input", { type: "checkbox", checked: cir.active !== false });
  actif.addEventListener("change", () => { cir.active = actif.checked; paint(); });
  box.appendChild(h("label", { class: "fr-check" }, actif, "Circuit actif (un circuit inactif ne s'applique à aucun nouvel acte)"));

  // ------------------------------------------------------------- ciblage
  box.appendChild(sectionHeader("À quels actes ce circuit s'applique-t-il ?"));
  box.appendChild(h("p", { class: "fr-small fr-muted", text: "Sans aucune sélection, le circuit s'applique à tous les actes (circuit général de l'établissement). Dès qu'un ciblage est posé, le circuit ne s'applique qu'aux actes correspondants — et il l'emporte sur un circuit général." }));
  box.appendChild(choiceField({
    label: "Trames concernées", value: cir.trameIds || [], multi: true,
    options: state.trames.map((t) => ({ value: t.id, label: t.name })),
    onChange: (v) => { cir.trameIds = v; garder(); },
  }));
  box.appendChild(choiceField({
    label: "Familles d'actes", value: cir.familyIds || [], multi: true,
    options: (c.families || []).map((f) => ({ value: f.id, label: f.label || f.id })),
    onChange: (v) => { cir.familyIds = v; garder(); },
  }));
  box.appendChild(choiceField({
    label: "Entités signataires", value: cir.entityIds || [], multi: true,
    options: (c.entities || []).map((e) => ({ value: e.id, label: e.name })),
    onChange: (v) => { cir.entityIds = v; garder(); },
  }));

  // ------------------------------------------------------------- étapes
  box.appendChild(sectionHeader("Étapes du circuit",
    button("Ajouter une étape", { variant: "tertiary", size: "sm", icon: "plus", onClick: () => { (cir.steps = cir.steps || []).push(newStep()); paint(); } })));
  if (!(cir.steps || []).length) {
    box.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune étape : ce circuit n'ouvrira pas de parapheur." }));
  }
  (cir.steps || []).forEach((s, j) => box.appendChild(etapeEdit(s, j, cir, paint)));
  return box;
}

function etapeEdit(s, j, cir, paint) {
  const c = state.config;
  const garder = () => touch("config", { rerender: false });
  const sub = h("div", { class: "fr-card", style: { background: "var(--bg)" } });
  sub.appendChild(h("div", { class: "fr-row" },
    h("strong", { class: "fr-small", text: `Étape ${j + 1} — ${s.label || ""} · ${etapeCible(s, state.config)}` }),
    h("div", { class: "fr-spacer" }),
    button("", { variant: "tertiary", size: "sm", icon: "up", title: "Monter", onClick: () => { if (j === 0) return; const [x] = cir.steps.splice(j, 1); cir.steps.splice(j - 1, 0, x); paint(); } }),
    button("", { variant: "tertiary", size: "sm", icon: "down", title: "Descendre", onClick: () => { if (j >= cir.steps.length - 1) return; const [x] = cir.steps.splice(j, 1); cir.steps.splice(j + 1, 0, x); paint(); } }),
    button("", { variant: "tertiary", size: "sm", icon: "trash", title: "Supprimer", onClick: () => { cir.steps.splice(j, 1); paint(); } }),
  ));
  sub.appendChild(textField({ label: "Intitulé de l'étape", value: s.label || "", onChange: (v) => { s.label = v; garder(); } }));
  // La NATURE vient en premier : c'est elle qui commande le sens de l'étape, et
  // son rôle naturel. Changer la nature fait suivre le rôle et l'intitulé tant
  // qu'ils sont restés ceux de la nature précédente — un réglage voulu à la main
  // n'est jamais écrasé.
  sub.appendChild(selectField({
    label: "Nature", value: natureEtape(s.kind).id,
    help: natureEtape(s.kind).hint,
    options: STEP_KINDS.map((k) => ({ value: k.id, label: k.label })),
    onChange: (v) => {
      const avant = etapeDefauts(s.kind);
      const apres = etapeDefauts(v);
      if (s.role === avant.role) s.role = apres.role;
      if (s.label === avant.label) s.label = apres.label;
      if (s.serviceScoped === avant.serviceScoped) s.serviceScoped = apres.serviceScoped;
      s.kind = natureEtape(v).id;
      garder();
      paint();
    },
  }));
  // À QUI l'étape est confiée : un rôle (le cas ordinaire), une personne nommée
  // du référentiel, ou un service. Le service est utile aux circuits qui ne
  // passent pas par la chaîne de décision — « la direction des finances »,
  // « les affaires juridiques » —, et la personne nommée, aux visas nominatifs.
  const cible = s.targetType || "role";
  sub.appendChild(selectField({
    label: "Qui porte l'étape", value: cible,
    help: "Un rôle : tout compte qui le porte peut franchir l'étape. Une personne nommée : seule la sienne (le compte rattaché à cette personne). Un service : tout agent qui en relève, rattachement compris.",
    options: STEP_TARGETS.map((t) => ({ value: t.id, label: t.label })),
    onChange: (v) => { s.targetType = v; garder(); paint(); },
  }));
  if (cible === "personne") {
    sub.appendChild(selectField({
      label: "Personne", value: s.personId || "",
      options: (c.people || []).map((p) => ({ value: p.id, label: [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id })),
      placeholder: "— Choisir la personne —",
      help: "C'est le compte rattaché à cette personne (Administration › Comptes et rôles, « Personne du référentiel ») qui verra l'étape dans son parapheur.",
      onChange: (v) => { s.personId = v; garder(); },
    }));
  } else if (cible === "service") {
    sub.appendChild(selectField({
      label: "Service", value: s.serviceId || "",
      options: (c.services || []).map((x) => ({ value: x.id, label: (x.code ? x.code + " — " : "") + x.name })),
      placeholder: "— Choisir le service —",
      help: "Tout agent de ce service — ou d'un service au-dessus, par le rattachement — peut franchir l'étape.",
      onChange: (v) => { s.serviceId = v; garder(); },
    }));
  } else {
    sub.appendChild(selectField({
      label: "Rôle attendu", value: s.role || etapeDefauts(s.kind).role,
      help: "Qui tient cette étape. Le rôle naturel de la nature choisie est proposé, mais rien ne l'impose : l'administrateur tient de toute façon n'importe quelle étape, comme recours.",
      options: STEP_ROLES.map((r) => ({ value: r.id, label: r.label })),
      onChange: (v) => { s.role = v; garder(); },
    }));
  }
  const scope = h("input", { type: "checkbox", checked: s.serviceScoped !== false });
  scope.addEventListener("change", () => { s.serviceScoped = scope.checked; garder(); });
  sub.appendChild(h("label", { class: "fr-check" }, scope, "Le valideur doit relever du service de l'acte"));
  const opt = h("input", { type: "checkbox", checked: !!s.optional });
  opt.addEventListener("change", () => { s.optional = opt.checked; garder(); });
  sub.appendChild(h("label", { class: "fr-check" }, opt, "Étape facultative (elle peut être passée)"));
  sub.appendChild(textField({ label: "Consigne affichée au valideur", value: s.help || "", rows: 2, onChange: (v) => { s.help = v; garder(); } }));
  return sub;
}

// ------------------------------------------------------------ numérotation
// D'où vient le numéro d'acte. Deux sources : la séquence de l'application, ou
// un service externe à qui on le DEMANDE au moment de rédiger. Le cas d'usage
// courant est un document Grist : la création d'une ligne y attribue le numéro,
// et le service renvoie la ligne créée. La composition du numéro et
// l'identifiant ELI se règlent juste à côté ; le détail de l'appel est dans
// src/lib/numbering.js.
function numerotationPanel(save, redraw) {
  const c = state.config;
  const n = (c.numbering = { ...numberingSettings(c) });
  const ext = (n.externe = { ...EXTERNE_DEFAUT, ...(n.externe || {}) });
  const externe = n.source === "externe";
  const wrap = h("div", { class: "fr-stack", style: { maxWidth: "900px" } });

  wrap.appendChild(card("Source du numéro",
    "Qui attribue le numéro de l'acte. La séquence de l'application suffit à la plupart des collectivités ; celles qui numérotent ailleurs — dans un document Grist, un tableur en ligne, un référentiel interne — font attribuer le numéro par ce service.",
    choiceField({
      label: "Attribution du numéro", value: n.source, options: SOURCES,
      onChange: (v) => { n.source = v; save(); redraw(); },
    }),
    n.source === "externe"
      ? h("p", { class: "fr-small fr-muted", text: "Le numéro n'est plus réservé dans l'application : il est demandé au service au moment de rédiger, et la ligne créée chez le service fait foi. L'application conserve la référence de cette ligne sur l'acte." })
      : h("p", { class: "fr-small fr-muted", text: "Le numéro est pris dans la séquence réglée ci-dessous, incrémentée à chaque réservation depuis l'écran de rédaction." }),
    externe ? externeBloc(ext, save, redraw) : null,
  ));

  const seqFields = h("div", { class: "fr-grid fr-grid--2" });
  if (externe) {
    seqFields.appendChild(textField({
      label: "Motif du numéro attribué par le service", value: ext.pattern,
      help: "Vide, c'est le motif principal qui s'applique. Le jeton {valeur} y reçoit la valeur rendue par le service.",
      onChange: (v) => { ext.pattern = v; save(); },
    }));
    seqFields.appendChild(textField({
      label: "Longueur de la séquence", type: "number", value: String(n.pad),
      help: "Nombre de chiffres du rang, quand le service rend un nombre : avec 3, la valeur 12 donne « 012 » ; une valeur plus longue n'est pas tronquée.",
      onChange: (v) => { n.pad = Number(v) || 3; save(); },
    }));
  } else {
    seqFields.appendChild(textField({
      label: "Prochain numéro de séquence", type: "number", value: String(n.seq),
      help: "Incrémenté d'un à chaque numéro réservé depuis l'écran de rédaction.",
      onChange: (v) => { n.seq = Number(v) || 0; save(); },
    }));
    seqFields.appendChild(textField({
      label: "Longueur de la séquence", type: "number", value: String(n.pad),
      help: "Nombre de chiffres du rang : 3 donne « 0412 ».",
      onChange: (v) => { n.pad = Number(v) || 3; save(); },
    }));
  }

  const compo = h("div", { class: "fr-grid fr-grid--2" },
    textField({
      label: "Motif du numéro", value: n.pattern,
      help: externe
        ? "Jetons : {valeur} {year} {seq} {entityCode} {entity} {objet} {date}. {seq} reçoit la valeur du service, complétée par des zéros si c'est un nombre."
        : "Jetons : {year} {seq} {entityCode}",
      onChange: (v) => { n.pattern = v; save(); },
    }),
    textField({
      label: "Année de référence", type: "number", value: String(n.year),
      help: "Alimente le jeton {year} — l'année de la numérotation, pas forcément l'année civile.",
      onChange: (v) => { n.year = Number(v) || new Date().getFullYear(); save(); },
    }),
  );

  const carte = card("Composition du numéro",
    "Le motif compose le numéro de l'acte à partir de ses jetons ; il vaut pour les deux sources.",
    compo, seqFields);
  wrap.appendChild(carte);

  // La PORTÉE du chrono : un compteur unique, un par entité, ou un par type
  // d'acte. Chaque portée a son propre compteur (`numbering.sequences`), ce qui
  // permet d'attribuer un numéro par entité sans rien ressaisir : une portée qui
  // n'a pas encore de compteur repart de la séquence générale.
  wrap.appendChild(card("Portée du chrono",
    "À quoi se rattache la séquence : à toute la collectivité, à chaque entité, ou à chaque type d'acte. C'est ce qui décide si deux actes pris le même jour portent des rangs consécutifs ou repartent chacun de leur côté.",
    choiceField({
      label: "Une séquence", value: n.portee, options: PORTEES,
      help: "Une collectivité qui numérote « arrêtés » et « délibérations » dans deux suites distinctes choisit « par type d'acte » ; une commune qui numérote séparément chaque établissement choisit « par entité ».",
      onChange: (v) => { n.portee = v; save(); redraw(); },
    }),
    h("p", { class: "fr-small fr-muted", text: n.portee === "global"
      ? "Un seul chrono : tous les actes de la collectivité partagent la suite, quels que soient leur entité et leur type."
      : n.portee === "entite"
        ? "Un chrono par entité : chaque code d'entité a sa propre séquence, et son propre rang. Le motif du numéro gagne à comporter le jeton {entityCode}, sans quoi deux entités composeraient le même numéro."
        : "Un chrono par type d'acte : chaque type a sa propre séquence. Le motif gagne à comporter le jeton {actTypeId}." }),
    h("p", { class: "fr-small" },
      button("Voir le chrono de numérotation", { variant: "secondary", size: "sm", icon: "list", onClick: () => navigate("chrono") }),
      h("span", { class: "fr-small fr-muted", text: " — tous les numéros attribués, leur état, les trous et les numéros annulés, avec tri, filtres et export CSV / XLSX." })),
  ));

  wrap.appendChild(card("Identifiant ELI",
    "Le motif ELI compose l'identifiant persistant et les URI de publication. Il ne dépend pas de la source du numéro.",
    textField({ label: "Motif ELI", value: n.eliPattern, help: "Jetons : {baseUri} {actTypeId} {year} {seq} {entityCode}", onChange: (v) => { n.eliPattern = v; save(); } }),
  ));

  return wrap;
}

// Le bloc de l'API externe : l'adresse, l'authentification, la requête, et la
// lecture de la réponse. On peut tout régler à la main ; le bouton « Pré-remplir
// pour Grist » pose la forme attendue par l'API de Grist.
function externeBloc(ext, save, redraw) {
  const box = h("div", { class: "fr-stack", style: { borderTop: "1px solid var(--border)", marginTop: "16px", paddingTop: "16px" } });

  box.appendChild(h("div", { class: "fr-row", style: { flexWrap: "wrap", alignItems: "center" } },
    h("strong", { style: { flex: "1 1 auto" }, text: "Service de numérotation" }),
    !relaisDisponible()
      ? h("span", { class: "fr-badge fr-badge--warning", text: "relais indisponible ici" })
      : null,
    button("Pré-remplir pour Grist", {
      variant: "tertiary", size: "sm", icon: "check",
      onClick: () => { Object.assign(ext, GABARIT_GRIST); save(); redraw(); },
    })));

  box.appendChild(selectField({
    label: "Transport", value: ext.transport, options: TRANSPORTS,
    help: relaisDisponible()
      ? "Le relais atteint un service qui refuserait l'appel d'un navigateur, mais les en-têtes — clé comprise — transitent par lui. L'appel direct ne passe par personne, et exige que le service autorise l'origine de l'application (CORS)."
      : "Le relais n'est pas disponible dans cet environnement (il vient de l'hébergement). Seul l'appel direct est possible, et l'API doit alors autoriser l'origine de l'application (CORS).",
    onChange: (v) => { ext.transport = v; save(); redraw(); },
  }));

  box.appendChild(textField({
    label: "Adresse de l'API", value: ext.url,
    placeholder: "https://docs.getgrist.com/api/docs/VOTRE_DOCUMENT/tables/Numerotation/records",
    help: "Les jetons y sont remplacés : {year} {entityCode} {entity} {objet} {date} {trameId} {actTypeId}.",
    onChange: (v) => { ext.url = v.trim(); save(); redraw(); },
  }));

  box.appendChild(selectField({
    label: "Méthode", value: ext.method, options: METHODES,
    help: "Créer une ligne (POST) est le moyen le plus courant de faire attribuer un numéro : le service rend alors la ligne créée.",
    onChange: (v) => { ext.method = v; save(); redraw(); },
  }));

  box.appendChild(textField({
    label: "En-têtes de la requête", value: ext.headers, rows: 3,
    help: "Un « Nom: valeur » par ligne. L'authentification se met ici — par exemple « Authorization: Bearer … ». Les jetons y sont remplacés.",
    onChange: (v) => { ext.headers = v; save(); },
  }));

  if (["POST", "PUT", "PATCH"].includes(String(ext.method).toUpperCase())) {
    box.appendChild(textField({
      label: "Corps de la requête", value: ext.body, rows: 5,
      help: 'JSON, jetons remplacés. Grist attend {"records":[{"fields":{…}}]}.',
      onChange: (v) => { ext.body = v; save(); },
    }));
  }

  box.appendChild(h("div", { class: "fr-grid fr-grid--2" },
    textField({
      label: "Chemin de la valeur du numéro", value: ext.valeur,
      help: "Où lire le numéro dans la réponse : « records[0].id », ou « records[0].fields.Numero ».",
      onChange: (v) => { ext.valeur = v; save(); },
    }),
    textField({
      label: "Chemin de la référence (facultatif)", value: ext.reference,
      help: "L'identifiant de la ligne créée, conservé sur l'acte et au journal, pour retrouver l'attribution chez le service.",
      onChange: (v) => { ext.reference = v; save(); },
    }),
  ));

  box.appendChild(textField({
    label: "Délai d'attente (secondes)", type: "number", value: String(Math.round((Number(ext.timeoutMs) || EXTERNE_DEFAUT.timeoutMs) / 1000)),
    help: "Passé ce délai, la demande échoue : le numéro n'est pas attribué, et l'acte reste sans numéro.",
    onChange: (v) => { ext.timeoutMs = Math.max(1, Number(v) || 15) * 1000; save(); },
  }));

  const live = h("div", { class: "fr-small fr-muted", style: { flex: "1 1 260px" } });
  box.appendChild(h("div", { class: "fr-row", style: { alignItems: "center" } },
    button("Tester l'appel", {
      variant: "secondary", size: "sm", icon: "refresh", disabled: !ext.url,
      onClick: (e) => tester(e.currentTarget, ext, live),
    }),
    live));

  box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" },
    text: "Jetons disponibles : " + JETONS.map(([j, quoi]) => `${j} — ${quoi}`).join(" · ") + "." }));
  box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "4px 0 0" },
    text: "La clé d'API est conservée dans le référentiel : elle part donc dans les sauvegardes JSON et, en base partagée, dans la base commune. Restreignez les droits de la clé chez le service (création sur la seule table de numérotation)." }));

  return box;
}

async function tester(btn, ext, live) {
  const methode = String(ext.method || "POST").toUpperCase();
  if (methode !== "GET") {
    const ok = await confirmDialog("Tester l'appel ?",
      "Le test utilise la méthode réglée : il CRÉERA une ligne chez le service, donc consommera un numéro. À réserver aux essais.",
      { confirmLabel: "Tester" });
    if (!ok) return;
  }
  btn.disabled = true;
  clear(live);
  live.appendChild(h("span", { class: "spinner", "aria-hidden": "true" }));
  live.appendChild(h("span", { text: " Appel en cours…" }));
  try {
    const c = state.config;
    const r = await demanderNumero({ ...c, numbering: numberingSettings(c) }, {
      entityId: (c.entities || [])[0]?.id || "",
      objet: "Essai depuis le référentiel",
      date: todayIso(),
    }, { label: "Essai de numérotation" });
    clear(live);
    live.appendChild(h("span", { class: "fr-badge fr-badge--success", text: "numéro obtenu" }));
    live.appendChild(h("span", { text: ` ${r.numero}${r.ref ? " · référence " + r.ref : ""}` }));
    toast("Numéro obtenu : " + r.numero, "success");
  } catch (e) {
    clear(live);
    live.appendChild(h("span", { class: "fr-badge fr-badge--error", text: "échec" }));
    live.appendChild(h("span", { text: " " + String((e && e.message) || e) }));
    toast(String((e && e.message) || e), "error");
  }
  btn.disabled = false;
}

// ------------------------------------------------------------ délais
// Les délais ne sont pas des constantes juridiques universelles : ce sont des
// objectifs de gestion, réglables par la collectivité. Le seul qui soit
// juridiquement structurant est le délai de recours contentieux (deux mois à
// compter de l'exécutoire) — il est ici pour mémoire, et peut être ajusté si
// l'établissement relève d'un régime particulier.
function delaisPanel(save, redraw) {
  const c = state.config;
  const d = (c.delais = { ...DELAIS_DEFAUT, ...(c.delais || {}) });
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Exécution & délais" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Ce qui rend un acte exécutoire, et ce qui fait courir le délai de recours. Ces valeurs alimentent l'échéancier (écran « Exécution & délais ») : elles ne bloquent rien, elles signalent ce qui traîne." }));
  const num = (label, key, help) => textField({
    label, type: "number", value: String(d[key]), help,
    onChange: (v) => { d[key] = Math.max(0, Number(v) || 0); save(); },
  });
  wrap.appendChild(num("Délai de recours contentieux (mois)", "recoursMois",
    "Deux mois à compter de l'exécutoire (transmission au contrôle de légalité, et publication ou notification)."));
  wrap.appendChild(num("Transmission au contrôle de légalité (jours)", "transmissionJours",
    "Objectif : au-delà, l'échéancier signale un retard de transmission."));
  wrap.appendChild(num("Publication au recueil (jours)", "publicationJours",
    "Objectif de publication après la signature."));
  wrap.appendChild(num("Notification (jours)", "notificationJours",
    "Objectif de notification d'un acte individuel après la signature."));
  wrap.appendChild(h("hr", { class: "fr-sep" }));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Les formalités REQUISES pour un acte donné se règlent sur la trame concernée : « transmission » et « notification » peuvent y être déclarées toujours requises ou jamais requises. La publication suit la publiable de la trame. Voir onglet « Trames » de l'éditeur de trame, puis l'écran « Exécution & délais » pour le suivi." }));
  wrap.appendChild(h("div", { class: "fr-row" },
    button("Rétablir les valeurs par défaut", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => { c.delais = { ...DELAIS_DEFAUT }; save(); redraw(); } })));
  return wrap;
}

// ------------------------------------------------------- circuit de signature
// Le circuit de signature de la collectivité. Par défaut, ÉLECTRONIQUE : l'acte
// est déposé auprès du service, puis signé dans l'outil du prestataire, et sa
// signature est vérifiée par empreinte. L'autre circuit — EXTERNE — n'appelle
// aucune API : le rédacteur télécharge le document prêt à signer, le fait signer
// hors de l'application (papier, ou outil tiers), puis dépose la version signée
// en PDF ; le réviseur certifie la conformité de cette pièce avec la version
// numérique qui sera publiée. Voir src/lib/externe.js.
//
// Une TRAME peut trancher autrement : elle impose le circuit externe, ou
// l'autorise seulement (le rédacteur choisit, acte par acte). C'est son onglet
// « Trame » qui le règle.
function signaturePanel(save, redraw) {
  const c = state.config;
  const s = (c.signature = { ...(c.signature || {}) });
  // L'API du prestataire (circuit électronique) : un bloc à part, dont on
  // remplit les manques. La CLÉ n'y figure pas — elle vit au SERVICE
  // (`SCRIBA_SIGNATURE_API_CLE`), et jamais dans le référentiel, qui s'exporte
  // et se partage.
  const api = (s.api = { ...SIGNATURE_API_DEFAUT, ...(s.api || {}) });
  const d = signatureSettings(c);
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Circuit de signature" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Comment les actes sont signés. Le circuit vaut pour toute la collectivité ; une trame peut l'écarter, en imposant ou en autorisant la signature hors application." }));

  wrap.appendChild(choiceField({
    label: "Circuit de signature de la collectivité",
    value: d.mode,
    options: SIGNATURE_MODES.map((m) => ({ value: m.id, label: m.label })),
    help: "Électronique : l'acte est déposé auprès du service puis signé dans l'outil du prestataire, et la signature est vérifiée par empreinte. Simple : le signataire signe dans l'application, avec son compte — aucun prestataire n'est requis, et les mentions nominatives restent dans l'original interne. Externe : le document est téléchargé prêt à signer, signé hors de l'application (papier ou outil tiers), puis la version signée est déposée en PDF — et sa conformité certifiée par le réviseur avant publication.",
    onChange: (v) => { s.mode = v; save(); redraw(); },
  }));
  const mode = SIGNATURE_MODES.find((m) => m.id === d.mode) || SIGNATURE_MODES[0];
  wrap.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { marginTop: "10px" } },
    h("p", { class: "fr-alert__title", text: modeLabel(d.mode) }),
    h("p", { class: "fr-small", text: mode.hint })));

  // ------------------------------------------------ l'API du prestataire
  // Le circuit électronique a besoin d'un prestataire joignable. Ses réglages
  // sont ici ; sa CLÉ, jamais : elle vit dans le `.env` du déploiement
  // (`SCRIBA_SIGNATURE_API_CLE`), parce qu'un référentiel s'exporte, se copie et
  // se partage. Quand cette page est servie par le service de la collectivité,
  // c'est LUI qui sait si le prestataire est réellement branché (il détient la
  // clé) : son état est affiché, et c'est lui qui fait autorité.
  const simule = circuitElectroniqueSimule();
  const svc = prestataireDuService();
  const deploie = (chemin) => poseParLeDeploiement("signature.api." + chemin);
  wrap.appendChild(h("hr", { class: "fr-sep" }));
  wrap.appendChild(sectionHeader("API du prestataire (circuit électronique)"));
  wrap.appendChild(h("div", { class: "fr-alert fr-alert--" + (simule ? "warning" : "success"), style: { marginBottom: "12px" } },
    h("p", { class: "fr-alert__title", text: simule ? "Circuit électronique simulé" : "Prestataire branché" }),
    h("p", { class: "fr-small", text: simule
      ? "Aucun appel ne sort de la collectivité : l'application joue elle-même le prestataire. " + (motifCircuitSimule(c) || "")
      : `Le service appelle « ${svc.prestataire} » à l'adresse ${svc.url} — la clé d'API reste au service, et ne transite jamais par cette page.` }),
    h("p", { class: "fr-small fr-muted", text: simule
      ? "Pour brancher un prestataire : renseignez son adresse ci-dessous (ou dans le .env), réglez le transport sur « service », et posez la clé d'API dans le fichier .env du déploiement (SCRIBA_SIGNATURE_API_CLE). La clé ne se saisit jamais ici : le référentiel s'exporte, se copie et se partage."
      : "Les réglages ci-dessous disent au service QUOI demander au prestataire ; la clé, elle, ne quitte pas le serveur." })));

  wrap.appendChild(h("div", { class: "fr-grid fr-grid--2" },
    choiceField({
      label: "Transport", value: api.transport,
      options: [
        { value: "service", label: "Par le service de la collectivité (la clé reste au serveur)" },
        { value: "demonstration", label: "Simulation locale (aucun appel sortant)" },
      ],
      help: "« Par le service » est le seul transport qui garde la clé d'API côté serveur : c'est le réglage d'une installation réelle. « Simulation locale » sert aux essais et aux démonstrations."
        + (deploie("transport") ? " Posé par le .env : une saisie ici ne tient pas." : ""),
      onChange: (v) => { api.transport = v; save(); redraw(); },
    }),
    textField({
      label: "Adresse de base du prestataire", value: api.url, placeholder: "https://signature.exemple.fr/api/v1",
      help: "La racine de l'API du prestataire. Vide : le circuit électronique reste simulé."
        + (deploie("url") ? " Posée par le .env." : ""),
      onChange: (v) => { api.url = v; save(); },
    }),
    textField({
      label: "Identifiant du prestataire", value: api.prestataire, placeholder: "esup-signature",
      help: "Le nom technique du prestataire : il apparaît sur les dossiers et dans le journal."
        + (deploie("prestataire") ? " Posé par le .env." : ""),
      onChange: (v) => { api.prestataire = v; save(); },
    }),
    selectField({
      label: "Niveau de signature demandé", value: api.niveau,
      options: [
        { value: "simple", label: "Signature simple" },
        { value: "avancee", label: "Signature avancée (certificat)" },
        { value: "qualifiee", label: "Signature qualifiée (eIDAS)" },
      ],
      help: "Le niveau que l'application DEMANDE au prestataire pour les actes de la collectivité. C'est lui qui décide de la valeur juridique de la signature."
        + (deploie("niveau") ? " Posé par le .env." : ""),
      onChange: (v) => { api.niveau = v; save(); },
    }),
    textField({
      label: "Adresse de notification (webhook)", value: api.urlNotification, placeholder: "https://actes.exemple.fr/v1/webhooks/signature",
      help: "L'adresse que le prestataire appellera une fois l'acte signé. Vide : l'adresse du service, suivie de /v1/webhooks/signature."
        + (deploie("urlNotification") ? " Posée par le .env." : ""),
      onChange: (v) => { api.urlNotification = v; save(); },
    }),
    textField({
      label: "Délai d'attente (ms)", type: "number", value: String(api.timeoutMs),
      help: "Temps maximal accordé à un appel au prestataire avant abandon."
        + (deploie("timeoutMs") ? " Posé par le .env." : ""),
      onChange: (v) => { api.timeoutMs = Number(v) || 20000; save(); },
    })));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" }, text: "Points de terminaison du prestataire — relatifs à l'adresse de base. Le jeton {document} reçoit l'identifiant du dossier rendu au dépôt." }));
  wrap.appendChild(h("div", { class: "fr-grid fr-grid--2" },
    textField({
      label: "Chemin — dépôt du document", value: api.cheminDocument, placeholder: "/documents",
      help: "Reçoit le document à signer.",
      onChange: (v) => { api.cheminDocument = v; save(); },
    }),
    textField({
      label: "Chemin — ajout d'un signataire", value: api.cheminSignataires, placeholder: "/documents/{document}/signataires",
      help: "Reçoit les signataires, un par un.",
      onChange: (v) => { api.cheminSignataires = v; save(); },
    }),
    textField({
      label: "Chemin — démarrage du circuit", value: api.cheminDemarrer, placeholder: "/documents/{document}/demarrer",
      help: "Lance le circuit : c'est cet appel qui rend le lien de signature.",
      onChange: (v) => { api.cheminDemarrer = v; save(); },
    }),
    textField({
      label: "Chemin — suivi du circuit", value: api.cheminStatut, placeholder: "/documents/{document}",
      help: "Interrogé pour relire le statut d'un dossier.",
      onChange: (v) => { api.cheminStatut = v; save(); },
    }),
    h("div", { class: "fr-row", style: { gridColumn: "1 / -1" } },
      button("Rétablir les réglages livrés", { variant: "tertiary", size: "sm", icon: "refresh", onClick: () => { s.api = { ...SIGNATURE_API_DEFAUT }; save(); redraw(); } }))));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" },
    text: "La CLÉ du prestataire ne se règle pas ici : elle vit dans le fichier .env du déploiement (SCRIBA_SIGNATURE_API_CLE), où le service la lit au démarrage. Elle n'est jamais transmise à cette page, ni recopiée dans un export du référentiel." }));

  wrap.appendChild(h("hr", { class: "fr-sep" }));
  wrap.appendChild(sectionHeader("Les trois circuits"));
  wrap.appendChild(h("div", { class: "fr-stack" },
    h("div", { class: "fr-card fr-card--soft" },
      h("h3", { class: "fr-card__title", text: "Circuit électronique (prestataire)" }),
      h("p", { class: "fr-small", text: "1. L'acte est déposé auprès du service, qui en calcule l'empreinte." }),
      h("p", { class: "fr-small", text: "2. Le circuit est ouvert auprès du prestataire ; le signataire signe dans l'outil." }),
      h("p", { class: "fr-small", text: "3. Le service vérifie que le document signé a la même empreinte que le document déposé — sinon il refuse." }),
      h("p", { class: "fr-small", text: "4. La publication suit la signature : ELI, dates, original signé." })),
    h("div", { class: "fr-card fr-card--soft" },
      h("h3", { class: "fr-card__title", text: "Signature électronique simple (dans l'application)" }),
      h("p", { class: "fr-small", text: "1. Le signataire désigné ouvre l'acte et vérifie le document ; le service en connaît l'empreinte." }),
      h("p", { class: "fr-small", text: "2. Il signe avec SON compte : signature ECDSA et horodatage, produits dans l'application." }),
      h("p", { class: "fr-small", text: "3. Le service vérifie que le document signé a la même empreinte que le document déposé — sinon il refuse." }),
      h("p", { class: "fr-small", text: "4. Les mentions nominatives (adresse électronique, compte, moyen d'authentification) sont consignées dans l'ORIGINAL INTERNE : elles ne sont jamais diffusées, et le public ne voit que le nom, la fonction et la date." }),
      h("p", { class: "fr-small fr-muted", text: "Aucun prestataire, aucune API tierce : c'est le circuit d'une collectivité qui n'a pas d'outil de signature, ou qui veut signer sans en dépendre." })),
    h("div", { class: "fr-card fr-card--soft" },
      h("h3", { class: "fr-card__title", text: "Circuit externe (sans API)" }),
      h("p", { class: "fr-small", text: "1. Le rédacteur « envoie à signature » : il TÉLÉCHARGE le document prêt à signer (bordereau de remise compris)." }),
      h("p", { class: "fr-small", text: "2. Le document est signé HORS de l'application — papier, ou outil tiers que l'application ne pilote pas." }),
      h("p", { class: "fr-small", text: "3. Le rédacteur RENTRE la version signée : « Ajouter la version signée », un PDF, empreinté en SHA-256." }),
      h("p", { class: "fr-small", text: "4. Le RÉVISEUR CERTIFIE LA CONFORMITÉ de la pièce signée avec la version numérique qui sera publiée — son contrôle porte sur la pièce signée, non sur le texte avant signature." }),
      h("p", { class: "fr-small", text: "5. La publication dépose la version en ligne ET le PDF signé ; sur le recueil public, l'« original » montre ce PDF tel qu'il a été mis en ligne." }))));

  wrap.appendChild(h("hr", { class: "fr-sep" }));
  wrap.appendChild(sectionHeader("Par trame"));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 8px" }, text: "Chaque trame peut suivre le réglage ci-dessus, imposer l'un des circuits (électronique, simple, externe), ou en autoriser un au choix du rédacteur. Ce réglage se fait sur la trame, onglet « Trame », rubrique « Signature »." }));
  const trames = (state.trames || []).slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
  if (!trames.length) {
    wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucune trame." }));
  } else {
    const table = h("table", { class: "fr-table" },
      h("thead", {}, h("tr", {},
        h("th", { text: "Trame" }), h("th", { text: "Réglage" }), h("th", { text: "Circuit retenu" }), h("th", {}))));
    const tb = h("tbody");
    for (const t of trames) {
      const c2 = circuitPour(c, t);
      const dispo = circuitsDisponibles(c, t).map((m) => modeLabel(m));
      tb.appendChild(h("tr", {},
        h("td", { text: t.name || t.id }),
        h("td", { class: "fr-small", text: trameModeLabel(t.signature || "") }),
        h("td", {}, h("span", { class: "fr-badge fr-badge--" + (c2.mode === "externe" ? "warning" : "info"), text: dispo.join(" ou ") + (c2.choix ? " (au choix)" : "") })),
        h("td", {}, button("Éditer la trame", { variant: "tertiary", size: "sm", icon: "doc", onClick: () => navigate("trame/" + t.id) }))));
    }
    table.appendChild(tb);
    wrap.appendChild(h("div", { class: "fr-table-wrap" }, table));
  }
  return wrap;
}

// ------------------------------------------------------------------ courriel
// Les notifications par courriel : l'expéditeur, la copie systématique, et
// quels événements donnent lieu à un message. La POLITIQUE est ici, dans le
// référentiel ; le SERVEUR SMTP, lui, se règle dans le `.env` du déploiement
// (`SMTP_*`, voir src/server/mysql/env.example). L'application n'a jamais accès
// au serveur SMTP, ni à son mot de passe : cet écran en montre l'ÉTAT, jamais
// les secrets, et permet d'envoyer un message d'essai pour vérifier la chaîne.
function courrielPanel(save, redraw) {
  const c = state.config;
  const d = courrielSettings(c);
  const reglages = (c.courriel = { ...(c.courriel || {}) });
  const evs = (reglages.evenements = { ...d.evenements });
  const wrap = h("div", { class: "fr-stack", style: { maxWidth: "900px" } });

  const carte = h("div", { class: "fr-card" });
  carte.appendChild(h("h2", { class: "fr-card__title", text: "Notifications par courriel" }));
  carte.appendChild(h("p", { class: "fr-card__sub", text: "Ce que Scribae annonce par courriel, et sous quel expéditeur. Le message part par le serveur SMTP de la collectivité : sa configuration (hôte, port, identifiants) est celle du déploiement, pas du référentiel — l'application ne voit jamais le mot de passe." }));
  carte.appendChild(choiceField({
    label: "Notifications par courriel",
    value: d.actif !== false,
    options: [{ value: true, label: "Activées" }, { value: false, label: "Désactivées" }],
    help: "Désactivées, aucun courriel n'est adressé : chaque envoi est alors constaté « non envoyé » au journal de l'acte, avec son motif. C'est le réglage d'un déploiement qui n'a pas (ou pas encore) de serveur SMTP.",
    onChange: (v) => { reglages.actif = v === true; save(); },
  }));
  carte.appendChild(textField({
    label: "Nom affiché de l'expéditeur", value: reglages.expediteurNom ?? d.expediteurNom,
    help: "Le nom qui apparaît chez le destinataire, devant l'adresse d'expédition du déploiement (SMTP_FROM). Ex. « Recueil des actes — Mairie ».",
    onChange: (v) => { reglages.expediteurNom = v; save(); },
  }));
  carte.appendChild(textField({
    label: "Adresse de réponse", value: reglages.repondreA ?? d.repondreA,
    help: "L'adresse où répondre. Laissez vide si les messages ne doivent pas être répondus (l'objet et le pied de page le disent alors).",
    onChange: (v) => { reglages.repondreA = v; save(); },
  }));
  carte.appendChild(textField({
    label: "Copie systématique", value: reglages.copieService ?? d.copieService,
    help: "Une adresse mise en copie de TOUS les envois — la boîte du service, par exemple. Facultatif.",
    onChange: (v) => { reglages.copieService = v; save(); },
  }));

  carte.appendChild(h("hr", { class: "fr-sep" }));
  carte.appendChild(sectionHeader("Événements notifiés"));
  const evBox = h("div", { class: "fr-stack" });
  for (const ev of EVENEMENTS) {
    const cb = h("input", { type: "checkbox", checked: evs[ev.id] === true });
    cb.addEventListener("change", () => { evs[ev.id] = cb.checked; save(); });
    evBox.appendChild(h("label", { class: "fr-check" }, cb,
      h("span", {},
        h("strong", { text: ev.label }),
        h("span", { class: "fr-small fr-muted", text: " — à " + ev.destinataires }))));
  }
  carte.appendChild(evBox);
  wrap.appendChild(carte);

  // ------------------------------------------------- l'état du service SMTP
  const carteService = h("div", { class: "fr-card fr-card--soft" });
  wrap.appendChild(carteService);
  const carteJournal = h("div", { class: "fr-card fr-card--soft" });
  wrap.appendChild(carteJournal);

  const rendreEtat = (st) => {
    clear(carteService);
    carteService.appendChild(h("h3", { class: "fr-card__title", text: "Serveur SMTP du déploiement" }));
    if (st.joignable === false) {
      carteService.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
        h("p", { class: "fr-alert__title", text: "Service injoignable depuis ce poste" }),
        h("p", { class: "fr-small", text: st.raison || "Le service partagé ne répond pas : l'état réel du serveur SMTP ne peut pas être lu ici." })));
    } else if (st.disponible) {
      carteService.appendChild(h("div", { class: "fr-alert fr-alert--success" },
        h("p", { class: "fr-alert__title", text: "Envoi opérationnel" }),
        h("p", { class: "fr-small", text: `Les messages partent par ${st.hote}:${st.port} (${libelleChiffrement(st.securise)}), sous l'adresse ${st.expediteur}${st.authentifie ? " (authentifié)" : " (sans authentification)"}.` })));
    } else {
      carteService.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
        h("p", { class: "fr-alert__title", text: "Envoi de courriel non configuré" }),
        h("p", { class: "fr-small", text: st.raison || "Le service n'a pas de serveur SMTP." }),
        h("p", { class: "fr-small fr-muted", text: "Renseignez SMTP_HOST, SMTP_FROM (et, s'il en faut, SMTP_USER / SMTP_PASS) dans le .env du service, puis redémarrez-le. Voir src/server/mysql/env.example." })));
    }
    if (st.hote) {
      carteService.appendChild(h("div", { class: "sig-cert" },
        h("h3", { text: "Réglage en service" }),
        h("p", { class: "fr-small", style: { margin: "2px 0" } }, h("span", { class: "fr-muted", text: "Hôte : " }), h("span", { class: "fr-mono", text: st.hote + ":" + st.port })),
        h("p", { class: "fr-small", style: { margin: "2px 0" } }, h("span", { class: "fr-muted", text: "Chiffrement : " }), h("span", { text: libelleChiffrement(st.securise) })),
        h("p", { class: "fr-small", style: { margin: "2px 0" } }, h("span", { class: "fr-muted", text: "Expédition : " }), h("span", { class: "fr-mono", text: st.expediteur || "—" })),
        h("p", { class: "fr-small", style: { margin: "2px 0" } }, h("span", { class: "fr-muted", text: "Configuration : " }), h("span", { class: "fr-mono", text: "SMTP_* du .env (le mot de passe n'est jamais transmis à l'application)" }))));
    }
    // Le message d'essai : à soi-même par défaut.
    const adresse = h("input", { class: "fr-input", type: "email", value: state.user?.email || "", placeholder: "adresse@commune.fr" });
    const boutonTest = button("Envoyer un courriel de test", { variant: "secondary", icon: "mail", disabled: !st.disponible });
    boutonTest.addEventListener("click", async () => {
      const a = adresse.value.trim();
      if (!a) { toast("Indiquez une adresse pour le message de test.", "warning"); return; }
      boutonTest.disabled = true; boutonTest.textContent = "Envoi en cours…";
      const r = await envoyerTest(c, a);
      boutonTest.disabled = false; boutonTest.textContent = "Envoyer un courriel de test";
      if (r.envoye) toast("Message de test accepté par le serveur SMTP.", "success");
      else toast("Message de test NON envoyé : " + (r.motif || "refus du service."), "error");
      chargerJournal();
    });
    carteService.appendChild(h("hr", { class: "fr-sep" }));
    carteService.appendChild(h("p", { class: "fr-small", text: "Vérifier la chaîne : un message d'essai part par le même chemin que les notifications." }));
    carteService.appendChild(h("div", { class: "fr-row" }, adresse, boutonTest));
  };

  const libelleChiffrement = (m) => m === "ssl" ? "TLS direct (SSL)" : m === "starttls" ? "STARTTLS" : "aucun chiffrement";

  const chargerJournal = async () => {
    clear(carteJournal);
    carteJournal.appendChild(h("h3", { class: "fr-card__title", text: "Derniers envois" }));
    let st = null;
    try { st = await etatCourriel({ force: true }); } catch (e) { /* déjà signalé */ }
    const lignes = (st && st.derniers) || [];
    if (!lignes.length) {
      carteJournal.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun envoi enregistré pour l'instant." }));
      return;
    }
    const table = h("table", { class: "fr-table" },
      h("thead", {}, h("tr", {}, h("th", { text: "Quand" }), h("th", { text: "Événement" }), h("th", { text: "Destinataires" }), h("th", { text: "Objet" }), h("th", { text: "Résultat" }))));
    const tb = h("tbody");
    for (const l of lignes) {
      tb.appendChild(h("tr", {},
        h("td", { class: "fr-small", text: l.at ? new Date(l.at).toLocaleString("fr-FR") : "" }),
        h("td", { class: "fr-small", text: (evenementDe(l.evenement)?.label) || l.evenement || "" }),
        h("td", { class: "fr-small", text: l.destinataires || "—" }),
        h("td", { class: "fr-small", text: l.sujet || "—" }),
        h("td", {}, h("span", { class: "fr-badge fr-badge--" + (l.envoye ? "success" : "error"), text: l.envoye ? "envoyé" : "non envoyé", title: l.motif || "" }))));
    }
    table.appendChild(tb);
    carteJournal.appendChild(h("div", { class: "fr-table-wrap" }, table));
  };

  etatCourriel({ force: true }).then(rendreEtat).catch((e) => {
    clear(carteService);
    carteService.appendChild(h("p", { class: "fr-small", text: "État du service indisponible : " + String((e && e.message) || e) }));
  });
  chargerJournal();

  return wrap;
}

// ------------------------------------------------------- publication au recueil
// Le recueil des actes administratifs — son titre, la règle d'entrée en
// vigueur, et surtout L'AUTOMATISME : faut-il publier l'acte dès le retour
// signé ? Une administration qui publie déjà dans son propre système ne le veut
// pas ; elle éteint cet automatisme ici, et l'acte signé s'arrête au registre.
function publicationPanel(save, redraw) {
  const c = state.config;
  const d = publicationSettings(c);
  const p = (c.publication = { ...(c.publication || {}) });
  const opp = (p.opposabilite = { ...d.opposabilite });
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Publication au recueil" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Ce que produit la publication d'un acte : le recueil auquel il est déposé, et à partir de quand il devient opposable. Le recueil lui-même se consulte publiquement, sans compte — l'écran « Publications (ELI) » en donne le lien." }));

  wrap.appendChild(textField({
    label: "Titre du recueil", value: p.recueil ?? d.recueil,
    help: "Le titre sous lequel les actes sont publiés : « Recueil des actes administratifs », « Recueil des actes de la commune »… Il s'affiche en tête du recueil public et sur chaque acte.",
    onChange: (v) => { p.recueil = v; save(); },
  }));

  wrap.appendChild(h("hr", { class: "fr-sep" }));

  wrap.appendChild(choiceField({
    label: "Publication automatique après signature",
    value: d.auto !== false,
    options: [{ value: true, label: "Automatique (défaut)" }, { value: false, label: "Désactivée" }],
    help: "Automatique : dès que la signature revient, un acte publiable est publié au recueil (et devient opposable). Désactivée : l'acte signé reste au registre — la publication n'a lieu que si on la demande depuis l'écran « Signature & publication ». C'est le réglage d'une administration qui publie dans son propre système, ou qui garde la main sur chaque dépôt.",
    onChange: (v) => { p.auto = v === true; save(); redraw(); },
  }));
  wrap.appendChild(h("p", { class: "fr-small fr-muted" },
    h("span", { text: d.auto !== false
      ? "Actuellement : le retour signé publie l'acte. "
      : "Actuellement : le retour signé n'entraîne aucune publication — les actes signés attendent, dans « Signature & publication ». " }),
    button("Ouvrir le recueil public", { variant: "tertiary", size: "sm", icon: "globe", onClick: () => navigate("recueil") })));

  wrap.appendChild(h("hr", { class: "fr-sep" }));

  wrap.appendChild(sectionHeader("Entrée en vigueur"));
  wrap.appendChild(selectField({
    label: "Règle d'opposabilité", value: opp.mode,
    options: [{ value: "lendemain", label: "Le lendemain de la publication" }, { value: "jours", label: "Après un nombre de jours" }],
    help: "La date d'entrée en vigueur — donc le point de départ du délai de recours — se calcule à partir de la date de publication. Elle reste modifiable acte par acte au moment de publier.",
    onChange: (v) => { opp.mode = v; save(); redraw(); },
  }));
  if (opp.mode === "jours") {
    wrap.appendChild(textField({
      label: "Nombre de jours après la publication", type: "number", value: String(opp.jours ?? 1),
      onChange: (v) => { opp.jours = Math.max(0, Number(v) || 0); save(); },
    }));
  }
  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "2px 0 0" }, text: "Le recueil public est le pendant « citoyen » de la publication : il ne demande aucun compte, et ne montre que les actes réellement publiés. Sa présentation suit la charte de la structure (Administration › Identité) et la feuille de style de chaque acte." }));
  return h("div", { class: "fr-stack" }, wrap, recueilsExternesBloc(save, redraw), mentionsPubliquesBloc(save, redraw),
    apparencePubliqueBloc(save, redraw), bulletinBloc(reglageDuBulletin(save), redraw), accesAtelierBloc(save, redraw));
}

// ENREGISTRER UN RÉGLAGE DU BULLETIN, c'est aussi en OUBLIER les copies : le
// référentiel est lu par le service (qui compose et qui diffuse), et le recueil
// public garde en mémoire ce qu'il a lu de lui. Sans cet oubli, l'écran du
// Bulletin et la page publique continueraient d'afficher ce qui n'est plus vrai
// — un bulletin éteint qu'on vient d'allumer, une cadence qu'on vient de
// changer (voir src/lib/bulletins-service.js, `oublier`).
function reglageDuBulletin(save) {
  return () => {
    bs.oublier();
    oublierBulletinsRecueil();
    save();
  };
}

// ------------------------------------------------------- le Bulletin des actes
// Le recueil publie au fil de l'eau ; le BULLETIN le rassemble par PÉRIODE et le
// diffuse — une sous-page du recueil par numéro, un flux RSS et Atom, un courriel
// aux abonnés. Ce bloc règle CE QU'ON PUBLIE et À QUELLE CADENCE ; les gestes
// (composer, adresser) et les abonnés sont sur leur propre écran
// (« Administration › Bulletin », voir src/ui/views/bulletin.js).
//
// Rien n'est calculé ici : la cadence est une UNITÉ et un PAS, exactement comme
// le moteur du service les compte (voir src/lib/bulletins.js et
// src/server/mysql/bulletins.mjs).
function bulletinBloc(save, redraw) {
  const p = (state.config.publication = state.config.publication || {});
  const b = (p.bulletin = p.bulletin || {});
  const d = bulletinReglages(state.config);
  const cadence = d.cadence;
  const personnalisee = cadence.id === "personnalisee";

  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Bulletin des actes" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Le Journal des actes : le recueil rassemblé par période, publié sur son propre jeu de pages, suivi par un flux RSS et Atom, et adressé par courriel à ses abonnés. Une période sans publication ne donne aucun numéro. "
    + "Il demande le service de données (le courriel et le flux viennent de lui) : en mode local, il n'est pas disponible." }));

  wrap.appendChild(choiceField({
    label: "Bulletin", value: d.actif,
    options: [{ value: true, label: "Ouvert" }, { value: false, label: "Éteint (défaut)" }],
    help: "Ouvert : le recueil publie un numéro à la clôture de chaque période, sa page devient publique et l'abonnement par courriel s'ouvre. Éteint : les adresses du bulletin n'existent pas — le recueil reste exactement ce qu'il était.",
    onChange: (v) => { b.actif = v === true; save(); redraw(); },
  }));

  if (d.actif) {
    wrap.appendChild(textField({
      label: "Titre du bulletin", value: b.titre ?? d.titre,
      help: "Le titre porté par le bulletin : en-tête des pages, objet des courriels, titre du flux.",
      onChange: (v) => { b.titre = v; save(); },
    }));
    wrap.appendChild(textField({
      label: "Titre de chaque numéro", value: b.titreBulletin || "", placeholder: d.titre,
      help: "Le titre de chaque numéro, devant le rang et la période — par exemple « Bulletin officiel » donne « Bulletin officiel n° 12 — septembre 2026 ». Vide : le titre du bulletin sert.",
      onChange: (v) => { b.titreBulletin = v; save(); redraw(); },
    }));
    wrap.appendChild(textField({
      label: "Sous-titre", value: b.sousTitre ?? d.sousTitre,
      help: "Une phrase d'introduction : sous les pages, en tête du courriel, et comme description du flux.",
      onChange: (v) => { b.sousTitre = v; save(); },
    }));

    wrap.appendChild(h("hr", { class: "fr-sep" }));
    wrap.appendChild(sectionHeader("Cadence de parution"));
    wrap.appendChild(selectField({
      label: "Cadence", value: cadence.id,
      options: CADENCES_BULLETIN.map((c) => ({ value: c.id, label: c.label })),
      help: "La périodicité du bulletin. Chaque période donne UN numéro, s'il y a des actes publiés dedans. « Bimensuelle » paraît deux fois par mois (1er–15, puis 16–fin) : c'est la cadence des bulletins municipaux.",
      onChange: (v) => {
        const c = CADENCES_BULLETIN.find((x) => x.id === v);
        b.cadence = c && c.id !== "personnalisee"
          ? { id: c.id, unite: "", pas: 0, ancre: "" }
          : { id: "personnalisee", unite: cadence.unite || "mois", pas: cadence.pas || 1, ancre: cadence.ancre || "" };
        save(); redraw();
      },
    }));
    if (personnalisee) {
      wrap.appendChild(selectField({
        label: "Unité", value: cadence.unite,
        options: UNITES_BULLETIN.map((u) => ({ value: u.id, label: u.label })),
        onChange: (v) => { b.cadence = { id: "personnalisee", unite: v, pas: v === "demi-mois" ? 1 : cadence.pas, ancre: cadence.ancre || "" }; save(); redraw(); },
      }));
      wrap.appendChild(textField({
        label: "Toutes les", type: "number", value: String(cadence.pas),
        help: cadence.unite === "demi-mois" ? "Le demi-mois vaut toujours 1 : la découpe est 1→15, puis 16→fin." : "Un entier de 1 à 60.",
        onChange: (v) => { b.cadence = { id: "personnalisee", unite: cadence.unite, pas: Number(v) || 1, ancre: cadence.ancre || "" }; save(); redraw(); },
      }));
      wrap.appendChild(textField({
        label: "Ancrage (facultatif)", value: cadence.ancre || "", placeholder: "AAAA-MM-JJ",
        help: "La date à partir de laquelle les périodes se comptent. Utile pour caler une cadence longue (un trimestre qui commence en février, une année scolaire) : c'est la période qui CONTIENT cette date qui sert de repère.",
        onChange: (v) => { b.cadence = { id: "personnalisee", unite: cadence.unite, pas: cadence.pas, ancre: /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim()) ? String(v).trim() : "" }; save(); redraw(); },
      }));
    }
    wrap.appendChild(textField({
      label: "Jour de parution", type: "number", value: String(d.parutionJours),
      help: "Le jour du mois où le numéro paraît, une fois sa période close (0 : dès le premier jour permis). Il décale la parution, jamais la période couverte.",
      onChange: (v) => { b.parutionJours = Math.max(0, Math.min(31, Number(v) || 0)); save(); },
    }));
    wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Cadence lue : " + libelleCadence(cadence) + ". Titre d'un numéro : « " + (d.titreBulletin || d.titre) + " n° 12 — septembre 2026 »." }));
  }

  wrap.appendChild(h("hr", { class: "fr-sep" }));
  wrap.appendChild(sectionHeader("Courriel du bulletin"));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", text: "Le bulletin part par le serveur SMTP de la collectivité (Administration › Courriel, et SMTP_HOST dans le .env du service). Sans SMTP, l'abonnement reste fermé — la page et le flux, eux, fonctionnent." }));
  wrap.appendChild(textField({
    label: "En-tête du message", value: b.entete ?? d.entete, rows: 3,
    help: "Quelques lignes en tête de chaque courriel (l'objet du message reste le titre du numéro).",
    onChange: (v) => { b.entete = v; save(); },
  }));
  wrap.appendChild(textField({
    label: "Pied du message", value: b.pied ?? d.pied, rows: 3,
    help: "Le pied de chaque courriel. Y rappeler l'adresse de la collectivité, ou la mention légale que vous devez porter.",
    onChange: (v) => { b.pied = v; save(); },
  }));
  wrap.appendChild(textField({
    label: "Nom de l'expéditeur", value: b.expediteurNom || "", placeholder: "Service des affaires générales",
    help: "Le nom affiché à la place de l'adresse d'expédition. Facultatif.",
    onChange: (v) => { b.expediteurNom = v; save(); },
  }));
  wrap.appendChild(textField({
    label: "Adresse de réponse", value: b.repondreA || "", placeholder: "actes@exemple.fr",
    help: "L'adresse à laquelle un abonné écrit s'il répond au bulletin. Facultatif.",
    onChange: (v) => { b.repondreA = v; save(); },
  }));

  if (d.actif) {
    wrap.appendChild(h("p", { class: "fr-small", style: { marginTop: "10px" } },
      h("span", { class: "fr-muted", text: "Adresse publique : " }),
      h("a", { class: "fr-link", href: adresseBulletins(), target: "_blank", rel: "noopener", text: adresseBulletins() }),
      h("span", { class: "fr-muted", text: " · flux : " }),
      h("a", { class: "fr-link", href: adresseFluxBulletin("rss"), target: "_blank", rel: "noopener", text: adresseFluxBulletin("rss") })));
  }
  wrap.appendChild(h("p", { class: "fr-small fr-muted" },
    button("Ouvrir l'écran du Bulletin", { variant: "secondary", size: "sm", icon: "list", onClick: () => navigate("bulletin") }),
    h("span", { text: " — la composition des numéros, les abonnés et les envois." })));
  return wrap;
}

// ------------------------------------------------- l'apparence du site public
// Une collectivité a une charte : deux couleurs, une police, une largeur. Le
// site public la porte, l'atelier garde l'apparence du logiciel. On ne demande
// pas de réécrire la feuille du recueil : on pose une feuille LIBRE, écrite ici,
// injectée après celle de l'application et limitée au conteneur du site public
// (`.recueil`) — voir `cssPersonnalisee` (src/lib/recueil.js) et `VARIABLES_CSS`
// (src/lib/informations.js).
//
// Le texte est du CSS : il ne peut pas exécuter de code, et il n'est écrit que
// par un administrateur. La liste des variables n'est qu'une aide — une
// collectivité peut viser n'importe quel élément de la page.
function apparencePubliqueBloc(save, redraw) {
  const p = (state.config.publication = state.config.publication || {});
  const infos = (p.informations = p.informations || { actif: true, titre: "", intro: "" });

  const zone = h("textarea", {
    class: "fr-textarea code-area", rows: 14, spellcheck: "false",
    placeholder: EXEMPLE_CSS,
    "aria-label": "Feuille de style du site public",
    on: { input: (e) => { p.css = e.target.value; save(); } },
  });
  zone.value = p.css || "";

  const variables = h("div", { class: "fr-table-wrap" },
    h("table", { class: "fr-table fr-small" },
      h("thead", {}, h("tr", {}, h("th", { text: "Variable" }), h("th", { text: "Ce qu'elle change" }))),
      h("tbody", {}, ...VARIABLES_CSS.map((v) => h("tr", {},
        h("td", {}, h("code", { class: "fr-mono", text: v.nom })),
        h("td", { text: v.role }))))));

  const bloc = card("Apparence du site public",
    "La feuille de style de la collectivité s'ajoute à celle du recueil : ses couleurs, sa police, la largeur de son contenu. Elle ne s'applique QU'AU site public — l'atelier garde l'apparence du logiciel.",
    h("div", { class: "fr-field" },
      h("label", { class: "fr-label", text: "Feuille de style (CSS)" }),
      h("p", { class: "fr-hint", text: `Écrivez du CSS ordinaire. La portée utile est « ${PORTEE_CSS} », le conteneur du site public : les variables ci-dessous s'y posent, et tout élément de la page peut s'y viser.` }),
      zone),
    h("div", { class: "fr-row" },
      button("Exemple : une couleur et une largeur", { variant: "tertiary", size: "sm", icon: "palette", onClick: () => { zone.value = EXEMPLE_CSS; p.css = EXEMPLE_CSS; save(); } }),
      button("Vider", { variant: "tertiary", size: "sm", icon: "trash", onClick: () => { zone.value = ""; p.css = ""; save(); } }),
      h("div", { class: "fr-spacer" }),
      button("Ouvrir le recueil public", { variant: "secondary", size: "sm", icon: "globe", onClick: () => navigate("recueil") })),
    h("details", { class: "fr-details" },
      h("summary", { class: "fr-small", text: "Les variables que le recueil honore" }),
      variables));

  // ------------------------------- la rubrique « Informations » du recueil
  const bInfos = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
  bInfos.appendChild(h("div", { class: "fr-row" },
    h("strong", { class: "fr-small", text: "Rubrique « Informations »" }),
    h("div", { class: "fr-spacer" }),
    button("Écrire les informations", { variant: "tertiary", size: "sm", icon: "bulle", onClick: () => navigate("informations") })));
  bInfos.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 10px" }, text: "Les billets publiés par la collectivité (actualités, avis, communications) apparaissent sur le recueil public : les trois derniers en page d'accueil, tous dans la page « Informations ». Une collectivité peut renommer la rubrique — « Actualités », « Communications » — ou l'éteindre." }));
  bInfos.appendChild(choiceField({
    label: "Afficher la rubrique sur le recueil public",
    value: infos.actif !== false,
    options: [{ value: true, label: "Affichée" }, { value: false, label: "Éteinte" }],
    help: "Éteinte, la rubrique disparaît du recueil public et de son pied de page — les billets restent dans l'atelier, et se republient d'un clic.",
    onChange: (v) => { infos.actif = v === true; save(); redraw(); },
  }));
  if (infos.actif !== false) {
    bInfos.appendChild(textField({
      label: "Titre de la rubrique", value: infos.titre || "",
      placeholder: "Informations",
      help: "Le titre affiché — « Informations », « Actualités », « Communications »… à défaut, « Informations ».",
      onChange: (v) => { infos.titre = v; save(); },
    }));
    bInfos.appendChild(textField({
      label: "Chapeau", value: infos.intro || "", rows: 3,
      placeholder: "Les nouvelles de la commune : travaux, réunions publiques, événements.",
      help: "La phrase qui présente la rubrique, sous son titre.",
      onChange: (v) => { infos.intro = v; save(); },
    }));
  }
  bloc.appendChild(h("hr", { class: "fr-sep" }));
  bloc.appendChild(bInfos);

  // ------------------------------------- les chats des pages d'erreur
  // Une option de CONfort, éteinte par défaut : elle illustre les pages
  // d'erreur — celles de l'atelier comme celles du recueil public — d'une
  // photographie de http.cat. Le libellé dit franchement le transfert : afficher
  // l'image, c'est demander à un site tiers, depuis le navigateur du visiteur.
  // Voir src/server/mysql/chats-erreur.mjs (la règle) et src/ui/chats-erreur.js
  // (le rendu côté atelier).
  const bChats = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
  bChats.appendChild(h("div", { class: "fr-row" },
    h("strong", { class: "fr-small", text: "Pages d'erreur" }),
    h("div", { class: "fr-spacer" }),
    button("Voir http.cat", { variant: "tertiary", size: "sm", icon: "globe", onClick: () => window.open("https://http.cat", "_blank", "noopener") })));
  bChats.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 10px" }, text: "Une page d'erreur — « acte introuvable », atelier fermé depuis cette adresse, panne d'affichage — peut être illustrée d'une photographie de chat, choisie selon le code de l'erreur. C'est un ornement : ce que la page doit dire, elle le dit de toute façon." }));
  bChats.appendChild(choiceField({
    label: "Illustrer les pages d'erreur d'un chat (http.cat)",
    value: p.chatsErreur === true,
    options: [{ value: true, label: "Affichés" }, { value: false, label: "Éteints" }],
    help: "Éteints (le défaut), les pages d'erreur restent sobres. Affichés, elles demandent une image au service public http.cat : le navigateur du visiteur ouvre alors une connexion vers ce site, qui voit son adresse IP et la page d'où il vient. À n'allumer qu'en connaissance de cause.",
    onChange: (v) => { p.chatsErreur = v === true; save(); redraw(); },
  }));
  bloc.appendChild(h("hr", { class: "fr-sep" }));
  bloc.appendChild(bChats);
  return bloc;
}

// ------------------------------------------------------ l'accès à l'atelier
// Le recueil public est ouvert à tous ; l'atelier peut n'être ouvert qu'à
// certains réseaux — l'intranet d'une commune, par exemple (voir
// src/server/mysql/atelier.mjs et src/server/mysql/ips.mjs). Deux réglages, et
// une seule règle : la LISTE est vide → l'atelier est ouvert ; elle est
// renseignée → seules les adresses qu'elle contient entrent.
//
// La décision appartient au SERVICE, jamais au navigateur : c'est lui qui voit
// l'adresse de l'appelant, et une adresse annoncée par le client ne prouve rien.
// L'écran ne fait que montrer l'état, laisser écrire la liste, et SIMULER une
// adresse (« et si j'arrivais de là ? ») — la réponse venant toujours du service.
//
// Le piège de ce réglage est connu : on peut se fermer la porte à soi-même. Il
// est donc annoncé en clair, et la simulation est là pour l'éprouver AVANT
// d'enregistrer.
function accesAtelierBloc(save, redraw) {
  const p = (state.config.publication = state.config.publication || {});
  const a = (p.atelier = p.atelier || { ips: "", message: "" });
  const imposee = poseParLeDeploiement(CLE_IPS);
  const messageImpose = poseParLeDeploiement(CLE_MESSAGE);

  const zone = h("textarea", {
    class: "fr-textarea code-area", rows: 6, spellcheck: "false",
    placeholder: "10.0.0.0/8\n192.168.1.0/24\n172.16.0.0-172.31.255.255\n…# commentaire",
    "aria-label": "Adresses autorisées à ouvrir l'atelier",
    // L'état montré plus bas est celui du SERVICE : on le lui redemande quand la
    // liste change — sinon le panneau continuerait d'afficher « atelier ouvert »
    // pendant que l'administrateur vient d'écrire une liste blanche. Un délai
    // court regroupe la frappe, et laisse l'enregistrement partir devant.
    on: { input: (e) => { a.ips = e.target.value; save(); planifierEtat(); } },
  });
  zone.value = imposee ? "" : (a.ips || "");

  const champMessage = h("textarea", {
    class: "fr-textarea", rows: 2, spellcheck: "false",
    placeholder: MESSAGE_DEFAUT,
    "aria-label": "Message affiché à une adresse refusée",
    on: { input: (e) => { a.message = e.target.value; save(); } },
  });
  champMessage.value = a.message || "";

  // ------------------------------------------------ l'état, tel que le service le voit
  const etatBox = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
  function majEtat() {
    clear(etatBox);
    const ligne = (label, valeur) => h("p", { class: "fr-small", style: { margin: "0" } },
      h("span", { class: "fr-muted", text: label + " : " }),
      h("span", { class: valeur.mono ? "fr-mono" : "", text: valeur.texte }));
    etatBox.appendChild(h("p", { class: "fr-small", style: { margin: "0 0 6px" } },
      h("span", { class: "fr-badge fr-badge--" + (acces.actif ? "warning" : "success"), text: acces.actif ? "Atelier restreint" : "Atelier ouvert à toutes les adresses" }),
      acces.charge ? null : h("span", { class: "fr-small fr-muted", text: "  (le service n'a pas encore répondu)" })));
    if (acces.source) etatBox.appendChild(ligne("Liste appliquée", { texte: acces.source === "deploiement" ? "celle du déploiement (.env)" : "celle du référentiel" }));
    if (acces.ip) etatBox.appendChild(ligne("Votre adresse, vue du service", { texte: acces.ip, mono: true }));
    if (acces.actif) {
      etatBox.appendChild(ligne("Vous entrez", { texte: acces.autorise
        ? (acces.regle ? "oui — autorisé par " + acces.regle : "oui")
        : "non — cette adresse n'est pas dans la liste" }));
    }
    if ((acces.erreurs || []).length) {
      etatBox.appendChild(h("p", { class: "fr-small", style: { margin: "6px 0 0" } },
        h("span", { class: "fr-badge fr-badge--error", text: acces.erreurs.length + " entrée(s) refusée(s)" })));
      for (const e of acces.erreurs) etatBox.appendChild(ligne("Entrée incomprise", { texte: `« ${e.entree} » — ${e.motif}`, mono: true }));
    }
    if (acces.actif) etatBox.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" }, text: acces.message }));
    // Ce que le service dit de lui-même quand il ne peut pas décider — le cas du
    // service de démonstration de la plateforme, qui ne voit pas l'adresse de
    // l'appelant. Le panneau doit le dire, sinon son « ouvert » passerait pour
    // un mensonge (voir src/lib/atelier-acces.js et index.html).
    if (acces.note) etatBox.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "6px 0 0" }, text: acces.note }));
  }
  majEtat();

  // Redemande son état au service, en regroupant la frappe : la liste enregistrée
  // vient d'être modifiée, et c'est le service qui la juge. Sans cela, le panneau
  // montrerait l'état d'AVANT le changement — « atelier ouvert » sous une liste
  // blanche que l'on vient d'écrire.
  let minuteurEtat = null;
  function planifierEtat() {
    if (minuteurEtat) clearTimeout(minuteurEtat);
    minuteurEtat = setTimeout(async () => {
      minuteurEtat = null;
      await chargerAcces({ silencieuse: true }).catch(() => null);
      majEtat();
    }, 700);
  }

  // ------------------------------------------------------------- le simulateur
  const champEssai = h("input", { class: "fr-input", placeholder: "203.0.113.10", "aria-label": "Adresse à essayer", style: { maxWidth: "220px" } });
  const resultat = h("p", { class: "fr-small", style: { margin: "8px 0 0" } });
  const tester = async () => {
    const ip = champEssai.value.trim();
    if (!ip) return;
    clear(resultat);
    resultat.appendChild(h("span", { class: "fr-small fr-muted", text: "Essai…" }));
    const e = await chargerAcces({ simulee: ip, silencieux: true });
    clear(resultat);
    if (!e) { resultat.appendChild(h("span", { text: "Le service n'a pas répondu : l'essai n'a pas pu être fait." })); return; }
    // Une adresse illisible ne se juge pas : le dire vaut mieux que la déclarer
    // « Refusée », ce qui ferait croire à une règle là où il y a une faute de
    // frappe (le service distingue les deux — voir src/server/mysql/atelier.mjs).
    if (e.connue === false) {
      resultat.appendChild(h("span", { class: "fr-badge fr-badge--info", text: "Adresse illisible" }));
      resultat.appendChild(h("span", { text: ` — « ${ip} » n'est pas une adresse réseau : écrivez-en une (10.0.0.24, 192.168.0.0/16, 10.0.0.0-10.0.0.255…).` }));
      return;
    }
    resultat.appendChild(h("span", { class: "fr-badge fr-badge--" + (e.autorise ? "success" : "error"), text: e.autorise ? "Entre" : "Refusée" }));
    resultat.appendChild(h("span", { text: e.autorise
      ? (e.regle ? " — autorisée par la règle " + e.regle : "")
      : " — cette adresse n'est dans aucun champ de la liste" }));
    if (e.interne && !e.autorise) resultat.appendChild(h("div", { class: "fr-small fr-muted", text: "C'est pourtant un espace réseau réservé (intranet, VPN, partage de connexion) : la liste ne le couvre pas." }));
  };
  champEssai.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); tester(); } });

  const bloc = card("Accès à l'atelier",
    "L'espace public du recueil est ouvert à tout le monde ; l'atelier peut, lui, n'être ouvert qu'à certains réseaux — l'intranet de la commune, par exemple. La liste ci-dessous est appliquée par le SERVICE, sans exception : elle décide de l'accès, et de la visibilité des actes à diffusion restreinte.",
    imposee
      ? h("p", { class: "fr-hint" }, h("strong", { text: "Liste imposée par le déploiement. " }),
      "La variable SCRIBA_ATELIER_IPS est posée dans le fichier .env du service : elle l'emporte sur tout ce qui s'écrit ici, et doit être modifiée dans ce fichier (voir src/server/env.example).")
      : null,
    h("div", { class: "fr-field" },
      h("label", { class: "fr-label", text: "Adresses autorisées (une par ligne, ou séparées par des virgules)" }),
      h("p", { class: "fr-hint", text: "Une adresse (10.0.0.24), un préfixe (192.168.0.0/16), un champ (10.0.0.0-10.0.0.255), une plage abrégée (10.0.0.*). Un « # » ouvre un commentaire. Une entrée incomprise est signalée plus bas — jamais ignorée en silence. Laissez vide pour ouvrir l'atelier à toutes les adresses." }),
      imposee ? null : zone),
    imposee ? h("p", { class: "fr-small fr-mono", style: { margin: "0" }, text: (optionsDeployees().variables[CLE_IPS] || "") || "(vide)" }) : null,
    h("p", { class: "fr-small", style: { margin: "10px 0 6px" } },
      h("strong", { text: "Attention : " }),
      "une liste qui ne couvre pas votre propre adresse vous ferme la porte de l'atelier. Vérifiez votre adresse ci-dessous, et éprouvez la vôtre avant d'enregistrer."),
    h("div", { class: "fr-field" },
      h("label", { class: "fr-label", text: "Message affiché à une adresse refusée" }),
      h("p", { class: "fr-hint", text: "Le texte que voit la personne qui arrive d'un réseau non autorisé — il doit lui dire que le recueil public, lui, reste ouvert." }),
      messageImpose ? null : champMessage),
    messageImpose ? h("p", { class: "fr-small fr-mono", style: { margin: "0" }, text: (optionsDeployees().variables[CLE_MESSAGE] || "") || MESSAGE_DEFAUT }) : null,
    h("div", { class: "fr-field" },
      h("label", { class: "fr-label", text: "Essayer une adresse" }),
      h("p", { class: "fr-hint", text: "La réponse est calculée par le service, avec la liste enregistrée. Rien n'est décidé par le navigateur." }),
      h("div", { class: "fr-row" }, champEssai, button("Essayer", { variant: "secondary", size: "sm", icon: "search", onClick: tester }))),
    resultat,
    etatBox);
  return bloc;
}

// ---------------------------------------------- mentions du recueil public
// Le bas de page de l'espace public porte ses mentions — celles qu'un site
// public affiche au lecteur : les **mentions légales**, qui rappellent les règles
// de publication, d'exécution et d'opposabilité des actes, et les **mentions
// d'accessibilité**. Ce sont des DONNÉES du référentiel
// (`config.publication.mentions`, voir src/lib/recueil.js, `mentionsPubliques`).
//
// Chaque mention se présente de trois façons : un TEXTE écrit ici et déplié en
// bas de page, un simple LIEN (celui des mentions légales du site principal de
// la collectivité, par exemple), ou rien du tout. Le bouton « Rétablir le texte
// livré » ramène une mention à ce que l'application livre — le texte livré n'est
// jamais perdu, il n'est que recouvert.
function mentionsPubliquesBloc(save, redraw) {
  const c = state.config;
  const p = (c.publication = c.publication || {});
  const mentions = (p.mentions = p.mentions || mentionsParDefaut());

  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Mentions du recueil public" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Ce que le bas de page de l'espace public rappelle au lecteur : les mentions légales (les règles de publication et d'opposabilité des actes administratifs) et les mentions d'accessibilité. Chacune s'affiche comme un texte, se remplace par un lien — celui des mentions du site de la collectivité, par exemple — ou ne s'affiche pas." }));

  const paint = () => { save(); redraw(); };
  const modeDe = (m) => (m.mode === "lien" || m.mode === "aucune" ? m.mode : "texte");

  MENTIONS_PUBLIQUES.forEach((def) => {
    const m = (mentions[def.id] = mentions[def.id] || { ...MENTIONS_DEFAUT[def.id] });
    const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });

    box.appendChild(h("div", { class: "fr-row" },
      h("strong", { class: "fr-small", text: def.label }),
      h("div", { class: "fr-spacer" }),
      button("Rétablir le texte livré", {
        variant: "tertiary", size: "sm", icon: "refresh",
        title: "Revenir au texte livré avec l'application",
        onClick: () => { mentions[def.id] = { ...MENTIONS_DEFAUT[def.id] }; paint(); },
      }),
    ));
    box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 10px" }, text: def.hint }));

    box.appendChild(choiceField({
      label: "Présentation en bas de page",
      value: modeDe(m),
      options: [
        { value: "texte", label: "Texte affiché dans la page" },
        { value: "lien", label: "Simple lien vers une autre page" },
        { value: "aucune", label: "Non affichée" },
      ],
      help: "Un texte est écrit ici et se déplie en bas de page du recueil ; un lien n'affiche qu'un renvoi — vers les mentions légales du site principal de la collectivité, par exemple.",
      onChange: (v) => { m.mode = v; paint(); },
    }));

    if (modeDe(m) === "texte") {
      box.appendChild(textField({
        label: "Titre", value: m.titre || def.label,
        help: "Le titre sous lequel la mention se déplie, en bas de page.",
        onChange: (v) => { m.titre = v; save(); },
      }));
      box.appendChild(textField({
        label: "Texte", value: m.texte || "", rows: 10,
        help: "Une ligne vide sépare deux paragraphes ; une ligne qui commence par « - » devient une puce. Les mentions légales gagnent à rappeler les règles de publication et d'opposabilité des actes, et l'accessibilité à dire l'état de conformité et comment signaler un obstacle.",
        onChange: (v) => { m.texte = v; save(); },
      }));
    } else if (modeDe(m) === "lien") {
      box.appendChild(textField({
        label: "Libellé du lien", value: m.lienLabel || "",
        placeholder: "Accessibilité — la déclaration d'accessibilité du site de la collectivité",
        help: "Le texte du lien. À défaut, le titre de la mention est employé.",
        onChange: (v) => { m.lienLabel = v; save(); },
      }));
      box.appendChild(textField({
        label: "Adresse", value: m.lien || "", placeholder: "https://…",
        help: "Le bas de page ne portera que ce lien ; il s'ouvre dans un nouvel onglet.",
        onChange: (v) => { m.lien = v; save(); },
      }));
      if (!String(m.lien || "").trim()) {
        box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0" }, text: "Sans adresse, la mention ne s'affiche pas : mieux vaut pas de mention qu'un lien qui ne mène nulle part." }));
      }
    } else {
      box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0" }, text: "La mention ne figure pas au bas du recueil public." }));
    }

    wrap.appendChild(box);
  });

  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0" },
    text: "Les mentions se lisent en bas de page du recueil public. Sur une installation auto-hébergée, l'espace public rendu par le service ne les porte pas encore — voir TODO.md." }));

  // ------------------------------------------ licence de réutilisation
  // La publicité des conditions de réutilisation est une OBLIGATION (CRPA art.
  // L. 322-1) ; la licence est reprise au bas du recueil public et dans le
  // JSON-LD de chaque acte publié.
  const lic = (p.licence = p.licence || {});
  const boxLicence = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
  boxLicence.appendChild(h("div", { class: "fr-row" },
    h("strong", { class: "fr-small", text: "Licence de réutilisation" }),
    h("div", { class: "fr-spacer" }),
    button("Rétablir la Licence Ouverte 2.0", {
      variant: "tertiary", size: "sm", icon: "refresh",
      title: "Revenir à la licence des informations publiques recommandée par Etalab",
      onClick: () => { delete p.licence; paint(); },
    })));
  boxLicence.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 10px" }, text: "La licence sous laquelle les informations publiées peuvent être réutilisées. Sa publicité est une obligation (code des relations entre le public et l'administration, art. L. 322-1) : elle est affichée au bas du recueil public, et portée par les données ouvertes de chaque acte publié." }));
  boxLicence.appendChild(textField({
    label: "Nom de la licence", value: String(lic.nom || "") || LICENCE_DEFAUT.nom,
    onChange: (v) => { lic.nom = v.trim(); save(); },
  }));
  boxLicence.appendChild(textField({
    label: "Adresse du texte de la licence", value: String(lic.url || "") || LICENCE_DEFAUT.url,
    onChange: (v) => { lic.url = v.trim(); save(); },
  }));
  boxLicence.appendChild(textField({
    label: "Mention de source à afficher", value: String(lic.mention || "") || LICENCE_DEFAUT.mention, rows: 3,
    help: "La phrase rappelée au lecteur au bas du recueil, à côté du nom de la licence.",
    onChange: (v) => { lic.mention = v; save(); },
  }));
  wrap.appendChild(boxLicence);
  return wrap;
}

// -------------------------------------------- recueils extérieurs et renvois
// Le bas de page du recueil public, et la fin de ses résultats de recherche,
// renvoient vers les recueils que Scribae ne gère pas : un recueil « bis » tenu
// à part, ou les recueils inactifs qu'un changement de logiciel a laissés
// derrière lui — parfois plusieurs à la suite. On y ajoute les sites de
// référence (Légifrance, service-public.gouv.fr) : le public qui ne trouve pas son
// acte ici doit pouvoir le chercher ailleurs sans quitter le recueil.
//
// Ces renvois sont des données du référentiel
// (`config.publication.recueilsExternes`, voir src/lib/recueil.js) : l'écran les
// écrit, les ordonne et les retire — rien n'est codé dans la page.
function recueilsExternesBloc(save, redraw) {
  const c = state.config;
  const p = (c.publication = c.publication || {});
  const items = (p.recueilsExternes = p.recueilsExternes || []);

  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("div", { class: "fr-row" },
    h("h2", { class: "fr-card__title", style: { flex: "1 1 auto", margin: 0 }, text: "Recueils extérieurs et renvois" }),
    button("Ajouter un renvoi", { variant: "secondary", size: "sm", icon: "plus", onClick: () => { items.push(newRecueilExterne()); save(); redraw(); } }),
  ));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Les recueils que Scribae ne gère pas, et les sites à consulter : ils s'affichent en bas de page du recueil public, et à la fin de ses résultats de recherche, sous le titre « Vous ne trouvez pas ce que vous recherchez ? »." }));
  wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0 0 10px" }, text: "« Recueil bis » : un recueil parallèle tenu hors de l'application. « Recueil inactif » : un recueil qui n'est plus alimenté — précisez la période qu'il couvre, surtout si plusieurs se succèdent. « Site de référence » : Légifrance, service-public.gouv.fr ou tout autre site utile au lecteur." }));

  const listEl = h("div", { class: "fr-stack" });
  wrap.appendChild(listEl);

  const paint = () => { save(); redraw(); };

  function renderRows() {
    clear(listEl);
    if (!items.length) {
      listEl.appendChild(h("p", { class: "fr-small fr-muted", text: "Aucun renvoi : le recueil public ne renvoie vers rien d'autre. Le bouton ci-dessous rétablit les renvois livrés avec l'application." }));
      return;
    }
    items.forEach((rec, i) => {
      const box = h("div", { class: "fr-card", style: { background: "var(--bg-alt)" } });
      box.appendChild(h("div", { class: "fr-row" },
        h("strong", { class: "fr-small", text: String(rec.label || rec.url || ("#" + (i + 1))).slice(0, 80) }),
        h("div", { class: "fr-spacer" }),
        button("", { variant: "tertiary", icon: "up", size: "sm", title: "Monter", onClick: () => { if (i > 0) { const [x] = items.splice(i, 1); items.splice(i - 1, 0, x); paint(); } } }),
        button("", { variant: "tertiary", icon: "down", size: "sm", title: "Descendre", onClick: () => { if (i < items.length - 1) { const [x] = items.splice(i, 1); items.splice(i + 1, 0, x); paint(); } } }),
        button("", { variant: "tertiary", icon: "trash", size: "sm", title: "Supprimer", onClick: async () => {
          const ok = await confirmDialog("Supprimer ce renvoi", "Il ne s'affichera plus sur le recueil public.", { confirmLabel: "Supprimer", danger: true });
          if (ok) { items.splice(i, 1); paint(); }
        } }),
      ));
      box.appendChild(selectField({
        label: "Nature du renvoi", value: rec.type || "bis",
        options: TYPES_RECUEIL_EXTERNE.map((t) => ({ value: t.id, label: t.label })),
        help: (TYPES_RECUEIL_EXTERNE.find((t) => t.id === (rec.type || "bis")) || {}).hint,
        onChange: (v) => { rec.type = v; paint(); },
      }));
      box.appendChild(textField({
        label: "Libellé", value: rec.label || "",
        placeholder: rec.type === "ressource" ? "Légifrance — le service public de la diffusion du droit" : "Recueil des actes — système précédent (2019-2023)",
        onChange: (v) => { rec.label = v; save(); },
      }));
      box.appendChild(textField({
        label: "Adresse", value: rec.url || "", placeholder: "https://…",
        help: "L'adresse de la page où le recueil se consulte. Le lien s'ouvre dans un nouvel onglet.",
        onChange: (v) => { rec.url = v; save(); },
      }));
      if ((rec.type || "bis") === "inactif") {
        box.appendChild(h("div", { class: "fr-row" },
          textField({ label: "Actes publiés à partir du", type: "date", value: rec.du || "", onChange: (v) => { rec.du = v; save(); } }),
          textField({ label: "…jusqu'au", type: "date", value: rec.au || "", onChange: (v) => { rec.au = v; save(); } }),
        ));
        box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0" }, text: "Les deux bornes sont facultatives : la période s'affiche sous le lien (« actes publiés du … au … ») et dit au lecteur où s'arrête ce recueil." }));
      }
      box.appendChild(textField({
        label: "Précision (facultative)", value: rec.note || "", rows: 2,
        help: "Une phrase qui explique au lecteur pourquoi ce recueil existe — ou pourquoi il s'est arrêté.",
        onChange: (v) => { rec.note = v; save(); },
      }));
      listEl.appendChild(box);
    });
  }
  renderRows();

  const manquants = RENVOIS_RECOMMANDES.filter((r) => !items.some((x) => x.type === r.type && x.url === r.url));
  if (manquants.length) {
    wrap.appendChild(h("hr", { class: "fr-sep" }));
    wrap.appendChild(button("Rétablir les renvois livrés (Légifrance, service-public.gouv.fr)", {
      variant: "tertiary", size: "sm", icon: "refresh",
      onClick: () => { items.push(...manquants.map((r) => ({ ...r }))); paint(); },
    }));
  }
  return wrap;
}

// ------------------------------------------------------- fonctions expérimentales
// Des fonctions livrées avec l'application, mais éteintes par défaut : elles ne
// conviennent pas à toutes les organisations, et leur comportement peut encore
// évoluer. L'administrateur les active en connaissance de cause — le réglage
// suit les données exportées et importées.
function experimentalPanel(save, redraw) {
  const c = state.config;
  const x = (c.experimental = c.experimental || { parapheur: true, controleLegalite: false });
  if (x.controleLegalite === undefined) x.controleLegalite = false;
  // Le parapheur n'est plus expérimental (1.5.0) : il vit dans l'onglet
  // « Circuits de validation », et son réglage est la présence de circuits.
  if (x.parapheur === false) x.parapheur = true;
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "900px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Fonctions expérimentales" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: "Ces fonctions sont livrées avec l'application, mais éteintes par défaut : elles ne conviennent pas à toutes les organisations, et leur comportement peut encore changer. Activez-les en connaissance de cause." }));
  wrap.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { marginBottom: "12px" } },
    h("p", { class: "fr-alert__title", text: "Le parapheur est désormais une fonction ordinaire" }),
    h("p", { class: "fr-small", text: "Le circuit de validation n'est plus expérimental : il est toujours disponible, et ce sont les circuits enregistrés dans le référentiel qui décident. Un référentiel sans circuit n'a aucun parapheur — les actes partent directement en signature." }),
    h("div", { class: "fr-row" },
      button("Régler les circuits de validation", {
        variant: "secondary", size: "sm", icon: "check",
        onClick: () => { state.ui.refTab = "circuits"; redraw(); },
      }))));

  // La transmission au contrôle de légalité : une étape de plus, entre le
  // retour signé et la publication, qui passe par l'API d'envoi de la
  // préfecture (voir src/lib/legalite.js). Éteinte, rien n'est envoyé et la
  // formalité se constate à la main depuis l'échéancier, comme avant.
  wrap.appendChild(choiceField({
    label: "Transmission au contrôle de légalité (télétransmission @ctes)",
    value: !!x.controleLegalite,
    options: [{ value: true, label: "Activée — API d'envoi" }, { value: false, label: "Désactivée (par défaut)" }],
    help: "L'étape s'intercale automatiquement entre le retour signé et la publication : l'acte signé est télétransmis à l'API d'envoi du contrôle de légalité, l'accusé de réception de la préfecture est déposé sur le document (« Transmis au contrôle de légalité le … à … »), puis l'acte est publié. Tant que la transmission n'a pas abouti, l'acte n'est pas publié. La télétransmission suppose une convention et des identifiants d'accès auprès de la préfecture : laissez désactivé si vous n'en avez pas.",
    onChange: async (v) => {
      x.controleLegalite = v;
      // La transmission ne change que la chaîne automatique : aucun acte de
      // démonstration n'a besoin d'être reconstruit (les transmissions déjà
      // constatées, elles, restent au dossier).
      touch("config");
    },
  }));
  if (x.controleLegalite) {
    wrap.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "La transmission au contrôle de légalité est activée" }),
      h("p", { class: "fr-small", text: `Chaque acte signé sera télétransmis à « ${CONTROLE_LEGALITE.destinataire} » par l'API d'envoi (${CONTROLE_LEGALITE.apiUrl}), puis publié. Le certificat de transmission est déposé sur l'original signé et sur la version publiée.` }),
      h("p", { class: "fr-small fr-muted", text: "Les actes déposés AVANT l'activation ne portent pas cette exigence : le service les publiera sans transmission. Les actes signés à partir de maintenant la portent." }),
      h("div", { class: "fr-row" },
        button("Régler les délais d'exécution", { variant: "secondary", size: "sm", icon: "gear", onClick: () => { state.ui.refTab = "delais"; redraw(); } }),
        button("Ouvrir l'échéancier", { variant: "tertiary", size: "sm", icon: "list", onClick: () => navigate("execution") }))));
  } else {
    wrap.appendChild(h("p", { class: "fr-small fr-muted", style: { marginTop: "10px" },
      text: "Transmission désactivée : rien n'est adressé à l'API du contrôle de légalité, et l'étape ne s'intercale pas entre la signature et la publication. La transmission — quand votre organisation en a l'obligation — se constate à la main, depuis la fiche de l'acte ou l'échéancier." }));
  }
  return wrap;
}

// ------------------------------------------------------------------ assistants
// Deux aides en langage naturel, livrées avec l'application : « Plume », dans
// l'atelier, qui explique le mode d'emploi de l'outil — sans jamais recevoir le
// contenu d'un acte — et « Publia », sur le recueil public, qui répond sur les
// actes publiés. On règle ici ce qui doit l'être : s'ils répondent ou non, quel
// moteur de langage les fait parler, l'instruction qu'ils reçoivent, et les
// questions qu'ils proposent. Voir src/lib/assistant.js.
const CE_QU_IL_SAIT = {
  atelier: "Le guide d'utilisation de l'application, et le nom de l'écran où se trouve l'agent. Jamais le contenu des actes, des trames, des brouillons ou des comptes : rien de tout cela ne lui est transmis.",
  public: "Les actes PUBLIÉS au recueil — ce que le recueil montre déjà à tout visiteur. Ni brouillon, ni acte non publié, ni compte.",
};

function assistantsPanel(save, redraw) {
  const wrap = h("div", { class: "fr-stack", style: { maxWidth: "1000px" } });
  wrap.appendChild(card("Deux assistants, deux savoirs",
    "Plume, dans l'atelier, explique le mode d'emploi de l'outil ; Publia, sur le recueil public, répond sur les actes publiés. Chacun ne reçoit que ce qu'il a le droit de savoir : aucune question n'emporte le contenu d'un acte, et l'assistant de l'atelier ne peut pas en voir — rien ne lui est jamais transmis.",
    h("p", { class: "fr-small fr-muted", text: "Le moteur de langage qui les fait parler est interchangeable : celui de Perchance, quand il est disponible, ou celui de la collectivité — une adresse d'API, une clé, un nom de modèle. C'est ce qui permet de les faire fonctionner hors de Perchance, ou de garder les échanges sur son propre réseau." }),
    h("p", { class: "fr-small fr-muted", text: "Le NOM et L'ICÔNE de chaque assistant se changent ci-dessous : l'interface suit partout — pastille, panneau, bulle d'invitation. Le nom et l'icône livrés sont rappelés en repère." }),
    h("p", { class: "fr-small fr-muted", text: "Les deux s'éteignent séparément : éteint, un assistant disparaît complètement de son interface — pas de pastille, pas de panneau. Cette décision vaut pour toute l'installation ; chaque agent peut en outre masquer un assistant allumé pour son seul compte, dans le menu de son nom." })));
  wrap.appendChild(carteAssistant("atelier", save, redraw));
  wrap.appendChild(carteAssistant("public", save, redraw));
  return wrap;
}

function carteAssistant(qui, save, redraw) {
  const livré = ASSISTANTS[qui];
  const s = assistantSettings(state.config, qui);
  const a = assistantIdentite(state.config, qui);
  // Le réglage BRUT (celui du référentiel), et non la valeur effective : un champ
  // vide doit se voir comme vide — c'est ainsi qu'on revient à ce qui est livré.
  const brut = (cle) => String(((state.config.assistant || {})[qui] || {})[cle] || "");
  const ecrire = (patch) => { reglerAssistant(state.config, qui, patch); save(); };
  const box = h("div", { class: "fr-card" });

  box.appendChild(h("h2", { class: "fr-card__title", style: { display: "flex", alignItems: "center", gap: "10px" } },
    h("img", { class: "assist-admin__avatar", src: a.avatar, alt: "", style: { width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover", flex: "none" } }),
    h("span", { text: a.nom + " — " + a.titre })));
  box.appendChild(h("p", { class: "fr-card__sub", text: "Ce qu'il sait : " + CE_QU_IL_SAIT[qui] }));

  box.appendChild(choiceField({
    label: "Disponibilité",
    value: s.actif !== false,
    options: [{ value: true, label: "Allumé" }, { value: false, label: "Éteint" }],
    help: "Éteint, l'assistant disparaît de son interface et ne peut plus être ouvert. Aucune question n'est alors transmise à un moteur de langage.",
    // `touch` (et non `save`) : éteindre l'assistant doit le faire disparaître
    // sur-le-champ — c'est la coquille entière qu'il faut redessiner, pas
    // seulement cet écran.
    onChange: (v) => { ecrire({ actif: v }); touch("config"); redraw(); },
  }));

  box.appendChild(h("hr", { class: "fr-sep" }));
  box.appendChild(sectionHeader("Nom et icône"));
  box.appendChild(h("p", { class: "fr-small fr-muted", text: "Le nom se lit partout où l'assistant se montre, et son icône est une image (une adresse, ou une image convertie en adresse). Laissez un champ vide pour revenir à ce que l'application livre." }));
  const apercu = h("div", { class: "assist-admin__apercu" },
    h("img", { class: "assist-admin__apercu-img", src: a.avatar, alt: "" }),
    h("span", { class: "assist-admin__apercu-nom", text: a.nom }));
  const majApercu = () => {
    const neuf = assistantIdentite(state.config, qui);
    apercu.querySelector(".assist-admin__apercu-img").src = neuf.avatar;
    apercu.querySelector(".assist-admin__apercu-nom").textContent = neuf.nom;
  };
  box.appendChild(apercu);
  box.appendChild(h("div", { class: "fr-grid fr-grid--2" },
    textField({
      label: "Nom", value: brut("nom"), placeholder: livré.nom,
      help: "Le nom livré est « " + livré.nom + " ».",
      onChange: (v) => { ecrire({ nom: v }); majApercu(); },
    }),
    textField({
      label: "Icône (adresse de l'image)", value: brut("avatar"), placeholder: livré.avatar,
      help: "Une adresse d'image (PNG, JPG, SVG…) ou une image encodée en « data: ». L'icône livrée sert de repère tant que le champ est vide.",
      onChange: (v) => { ecrire({ avatar: v }); majApercu(); },
    })));

  box.appendChild(h("hr", { class: "fr-sep" }));
  box.appendChild(choiceField({
    label: "Moteur de langage",
    value: s.moteur,
    options: [
      { value: "auto", label: "Automatique" },
      { value: "integre", label: "Intégré (Perchance)" },
      { value: "personnalise", label: "Personnalisé (API)" },
    ],
    help: "Automatique : le moteur intégré quand il est disponible (sur Perchance), l'adresse ci-dessous sinon, et à défaut une recherche dans le guide — c'est le réglage qui fonctionne partout. Intégré : uniquement Perchance. Personnalisé : uniquement l'adresse ci-dessous, ce qui laisse les échanges sur votre réseau.",
    onChange: (v) => { ecrire({ moteur: v }); redraw(); },
  }));

  const moteur = moteurDe(state.config, qui);
  if (moteur.type === "aucun") {
    box.appendChild(h("div", { class: "fr-alert fr-alert--warning", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Aucun moteur disponible" }),
      h("p", { class: "fr-small", text: moteur.raison })));
  } else if (moteur.type === "repli") {
    // Pas de moteur, et ce n'est pas une erreur : l'assistant répond par
    // recherche documentaire (voir src/lib/assistant.js). On le dit, et on dit
    // ce que l'on peut faire pour obtenir des réponses rédigées.
    box.appendChild(h("div", { class: "fr-alert fr-alert--info", style: { marginTop: "10px" } },
      h("p", { class: "fr-alert__title", text: "Réponses sans moteur de langage" }),
      h("p", { class: "fr-small", text: moteur.raison }),
      h("p", { class: "fr-small", text: "Pour des réponses rédigées, renseignez ci-dessous l'adresse d'une API (le moteur intégré, lui, n'existe que sur Perchance)." })));
  }

  if (s.moteur !== "integre") {
    box.appendChild(h("hr", { class: "fr-sep" }));
    box.appendChild(sectionHeader("Moteur personnalisé"));
    box.appendChild(h("p", { class: "fr-small fr-muted", text: "L'API de la collectivité. Deux formes sont prises en charge : l'API des complétions de conversation (messages rôle/contenu, flux SSE — OpenAI, Mistral, Groq, OpenRouter, Ollama, vLLM, LM Studio…) et un appel simple qui reçoit « prompt » et rend « texte »." }));
    box.appendChild(textField({
      label: "Adresse du service", value: s.url, placeholder: "https://llm.mon-organisme.fr/v1/chat/completions",
      help: "L'adresse complète de l'API. Le service doit accepter les appels venus de cette page (CORS) — sinon, activez le relais ci-dessous.",
      onChange: (v) => ecrire({ url: v.trim() }),
    }));
    box.appendChild(selectField({
      label: "Forme de l'API", value: s.protocole,
      options: [{ value: "openai", label: "Complétions de conversation (/chat/completions)" }, { value: "texte", label: "Appel simple ({ prompt } → { texte })" }],
      onChange: (v) => { ecrire({ protocole: v }); redraw(); },
    }));
    box.appendChild(textField({
      label: "Modèle (facultatif)", value: s.modele, placeholder: "ex. mistral-large, llama3.1:70b",
      help: "Transmis tel quel. Laissez vide si le service n'en attend pas.",
      onChange: (v) => ecrire({ modele: v.trim() }),
    }));
    box.appendChild(h("div", { class: "fr-grid fr-grid--2" },
      textField({
        label: "Clé d'accès (facultative)", type: "password", value: s.cle, placeholder: "— aucune —",
        help: "Conservée sur CE poste uniquement (stockage du navigateur), jamais dans le référentiel ni dans un export de données. Un autre poste doit saisir la sienne. Utilisez une clé dédiée à cet usage, que vous pouvez révoquer.",
        onChange: (v) => ecrire({ cle: v }),
      }),
      selectField({
        label: "En-tête qui porte la clé", value: s.entete,
        options: [{ value: "authorization", label: "Authorization: Bearer …" }, { value: "x-api-key", label: "x-api-key: …" }, { value: "aucune", label: "Ne pas envoyer de clé" }],
        onChange: (v) => ecrire({ entete: v }),
      }),
    ));
    box.appendChild(choiceField({
      label: "Passer par le relais sans CORS",
      value: s.relais === true,
      options: [{ value: false, label: "Non (appel direct)" }, { value: true, label: "Oui" }],
      help: "Un service qui n'autorise pas l'origine de l'application restera injoignable depuis le navigateur (règle CORS). Le relais de la plateforme contourne cette limite ; il n'existe que sur Perchance. À n'activer que si le service est bien le vôtre : le relais voit alors passer la requête.",
      onChange: (v) => { ecrire({ relais: v }); redraw(); },
    }));
  }

  box.appendChild(h("hr", { class: "fr-sep" }));
  box.appendChild(sectionHeader("Instruction donnée au moteur"));
  box.appendChild(textField({
    label: "Rôle et consignes", rows: 10, value: s.instruction,
    help: "Le texte qui ouvre chaque échange : ce que l'assistant est, ce qu'il ne fait jamais, et sa manière de répondre. Laissez vide pour revenir à l'instruction livrée.",
    onChange: (v) => ecrire({ instruction: v }),
  }));

  box.appendChild(h("hr", { class: "fr-sep" }));
  box.appendChild(promptsAssistant(qui, s, ecrire, redraw));

  box.appendChild(h("hr", { class: "fr-sep" }));
  const resultat = h("div", { class: "assist-essai" });
  box.appendChild(h("div", { class: "fr-row" },
    button("Tester le moteur", {
      variant: "secondary", size: "sm", icon: "refresh",
      onClick: async (ev) => {
        const b = ev.currentTarget;
        b.disabled = true;
        clear(resultat);
        resultat.appendChild(h("p", { class: "fr-small fr-muted", text: "Test en cours…" }));
        try {
          const publications = qui === "public" ? (state.recueil?.liste || []) : null;
          const question = qui === "public" ? "Quels actes sont publiés au recueil ?" : "À quoi sert cette application, en deux phrases ?";
          const texte = await repondre({ config: state.config, qui, question, publications });
          clear(resultat);
          resultat.appendChild(h("div", { class: "fr-alert fr-alert--success" },
            h("p", { class: "fr-alert__title", text: "Le moteur a répondu" }),
            h("p", { class: "fr-small", text: texte || "(réponse vide)" })));
        } catch (e) {
          clear(resultat);
          resultat.appendChild(h("div", { class: "fr-alert fr-alert--warning" },
            h("p", { class: "fr-alert__title", text: "Pas de réponse" }),
            h("p", { class: "fr-small", text: (e && (e.raison || e.message)) || String(e) })));
        } finally { b.disabled = false; }
      },
    }),
    button("Rétablir les réglages livrés", {
      variant: "tertiary", size: "sm", icon: "refresh",
      onClick: async () => {
        if (!(await confirmDialog("Rétablir les réglages livrés de " + a.nom + " ?", "Le nom, l'icône, le moteur, l'instruction et les prompts proposés reviennent à ce que l'application livre. Vos modifications sont perdues ; les préférences des agents (assistant masqué pour leur compte) ne sont pas touchées."))) return;
        reinitialiserAssistant(state.config, qui);
        save();
        redraw();
        toast("Réglages de " + a.nom + " rétablis.");
      },
    })));
  box.appendChild(resultat);
  return box;
}

function promptsAssistant(qui, s, ecrire, redraw) {
  const box = h("div", { class: "fr-stack" });
  const liste = Array.isArray(s.prompts) ? s.prompts : [];
  box.appendChild(sectionHeader("Questions proposées (" + liste.length + ")"));
  box.appendChild(h("p", { class: "fr-small fr-muted", style: { margin: "0" },
    text: (!liste.length
      ? "Aucune question proposée : l'assistant n'affiche que sa zone de saisie."
      : "Ces questions s'affichent sous forme de boutons à l'ouverture de l'assistant, et l'une d'elles est soufflée de temps en temps dans une petite bulle. Elles servent d'exemples — l'agent peut toujours écrire la sienne.") }));
  liste.forEach((p, i) => {
    box.appendChild(h("div", { class: "assist-prompt" },
      h("div", { class: "assist-prompt__tete" },
        h("span", { class: "assist-prompt__num", text: String(i + 1) }),
        h("div", { class: "assist-prompt__etiquette" },
          textField({
            label: "Étiquette du bouton", value: p.label,
            placeholder: "ex. Comment rédiger un acte ?",
            onChange: (v) => { p.label = v; ecrire({ prompts: liste }); },
          })),
        h("button", {
          class: "fr-btn fr-btn--tertiary fr-btn--icon fr-btn--sm", type: "button", title: "Supprimer cette question",
          on: { click: () => { ecrire({ prompts: liste.filter((x) => x !== p) }); redraw(); } },
        }, icon("trash", 15))),
      textField({
        label: "Question posée à l'assistant", rows: 2, value: p.texte,
        placeholder: "ex. Comment est-ce que je rédige un acte à partir d'une trame ?",
        onChange: (v) => { p.texte = v; ecrire({ prompts: liste }); },
      })));
  });
  box.appendChild(h("div", { class: "fr-row" },
    button("Ajouter une question", {
      variant: "secondary", size: "sm", icon: "plus",
      onClick: () => { ecrire({ prompts: [...liste, { id: nouvelIdPrompt(), label: "Nouvelle question", texte: "" }] }); redraw(); },
    })));
  return box;
}

// --------------------------------------------------------- journal d'audit
// Le journal n'est pas un fichier technique : c'est le registre des faits de
// l'installation, lisible par un administrateur — qui a soumis, qui a validé,
// qui a signé, qui a publié, qui a constaté une formalité. Les 300 derniers
// faits sont conservés ; au-delà, le plus ancien sort.
function journalPanel() {
  const entries = journalPour({ user: state.user, tous: true });
  const wrap = h("div", { class: "fr-card", style: { maxWidth: "1100px" } });
  wrap.appendChild(h("h2", { class: "fr-card__title", text: "Journal d'audit" }));
  wrap.appendChild(h("p", { class: "fr-card__sub", text: `Les faits de l'installation, du plus récent au plus ancien : soumissions au parapheur, décisions, signatures, publications, constatations de formalités, mises à la corbeille. Chaque entrée porte son auteur et son horodatage. ${entries.length} entrée(s) conservée(s).` }));

  const q = h("input", { class: "fr-input", type: "search", placeholder: "Filtrer (numéro, objet, auteur, action…)" });
  wrap.appendChild(h("div", { class: "fr-field" }, h("label", { class: "fr-label", text: "Rechercher" }), q));
  const liste = h("div", { class: "journal-liste" });
  wrap.appendChild(liste);

  function paint() {
    const needle = q.value.trim().toLowerCase();
    clear(liste);
    const filtrees = needle
      ? entries.filter((e) => [e.action, actionLabel(e.action), e.byName, e.role, e.cibleLabel, e.detail, e.cible, e.numero].filter(Boolean).join(" ").toLowerCase().includes(needle))
      : entries;
    if (!filtrees.length) {
      liste.appendChild(h("p", { class: "fr-small fr-muted", text: entries.length ? "Aucun fait ne correspond à cette recherche." : "Aucun fait enregistré pour l'instant." }));
      return;
    }
    for (const e of filtrees) liste.appendChild(journalLine(e));
  }
  q.addEventListener("input", paint);
  paint();
  return wrap;
}

function journalLine(e) {
  const acte = e.acteId ? state.actes.find((a) => a.id === e.acteId) : null;
  return h("div", { class: "journal-line" },
    h("div", { class: "journal-line__when" },
      h("strong", { text: new Date(e.at).toLocaleDateString("fr-FR") }),
      h("span", { class: "fr-small fr-muted", text: new Date(e.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) })),
    h("div", { class: "journal-line__body" },
      h("div", { class: "fr-row" },
        h("span", { class: "fr-badge fr-badge--" + actionColor(e.action), text: actionLabel(e.action) }),
        e.cibleLabel ? h("strong", { class: "fr-small", text: e.cibleLabel }) : null),
      h("p", { class: "fr-small", text: e.detail || "" }),
      h("p", { class: "fr-small fr-muted", text: [
        e.byName ? "par " + e.byName + (e.role ? ` (${e.role})` : "") : "",
        (e.to || []).length ? "→ " + (e.to || []).map(libelleTo).join(", ") : "",
      ].filter(Boolean).join(" · ") })),
    acte ? button("Voir l'acte", { variant: "tertiary", size: "sm", icon: "eye", onClick: () => navigate("acte/" + acte.id) }) : null,
  );
}

const JOURNAL_ACTIONS = {
  "parapheur.depot": ["Passage au parapheur", "info"],
  "parapheur.accord": ["Bon pour accord", "success"],
  "parapheur.passe": ["Étape passée", "info"],
  "parapheur.refus": ["Refus au parapheur", "error"],
  "parapheur.renvoi": ["Renvoi en rédaction", "warning"],
  "parapheur.reprise": ["Reprise du circuit", "warning"],
  "revision.depot": ["Envoi en révision", "info"],
  "revision.validation": ["Révision", "success"],
  "revision.rejet": ["Rejet en révision", "warning"],
  "signature.depot": ["Envoi en signature", "info"],
  "signature.signe": ["Signature", "success"],
  "signature.refus": ["Signature refusée", "warning"],
  "publication.publie": ["Publication", "success"],
  "publication.depublie": ["Retrait du recueil", "error"],
  "publication.epingle": ["Mise à la une", "info"],
  "publication.desepingle": ["Retrait de la une", "warning"],
  "formalite.transmission": ["Transmission au contrôle de légalité", "info"],
  "formalite.publication": ["Publication constatée", "info"],
  "formalite.notification": ["Notification", "info"],
  "formalite.effacement": ["Constatation effacée", "warning"],
  "recours.enregistrement": ["Recours enregistré", "warning"],
  "recours.effacement": ["Mention de recours retirée", "warning"],
  "numero.attribution_externe": ["Numéro attribué par un service", "info"],
  "document.etat_formalites": ["État des formalités délivré", "info"],
  "document.attestation_non_recours": ["Attestation de non-recours délivrée", "info"],
  "acte.creation": ["Création d'acte", "info"],
  "acte.enregistrement": ["Enregistrement d'acte", "info"],
  "acte.restauration": ["Retour à une version", "warning"],
  "corbeille": ["Mise à la corbeille", "warning"],
  "restauration": ["Restauration", "success"],
  "suppression": ["Suppression définitive", "error"],
  "trame.disponible": ["Trame mise à disposition", "success"],
  "trame.retiree": ["Trame retirée", "warning"],
  "referentiel.entite": ["Organigramme — entité", "info"],
  "referentiel.service": ["Organigramme — service", "info"],
  "referentiel.bureau": ["Organigramme — bureau", "info"],
};

const actionLabel = (a) => (JOURNAL_ACTIONS[a] ? JOURNAL_ACTIONS[a][0] : (a || "Fait"));
const actionColor = (a) => (JOURNAL_ACTIONS[a] ? JOURNAL_ACTIONS[a][1] : "info");
const libelleTo = (v) => (String(v).startsWith("role:") ? "rôle " + String(v).slice(5) : String(v).startsWith("service:") ? "service " + String(v).slice(8) : String(v).startsWith("personne:") ? "personne " + String(v).slice(9) : v);
