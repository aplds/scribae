import { bootstrap, saveConfig, saveTrames, saveActes, saveUsers, saveSession, initStorage } from "../lib/store.js";
import * as db from "../lib/db/index.js";
import { seedConfigVierge } from "../lib/seed.js";
import { can as userCan, seedUsers, accountUsable, syncDemoAccounts, fullName, hasRole, rolesOf, roleLabel, estVisiteur } from "../lib/users.js";
import { demoAccountsDisabled, isOidc, sessionDeService, authConfig, setDeploiementAuth, deploiementAuth } from "../lib/auth.js";
import { setDeploiementConfig, appliquerOptions } from "../lib/deploiement-config.js";
import * as motdepasse from "../lib/motdepasse.js";
import { applyOidcUser } from "../lib/oidc.js";
import { inScope } from "../lib/scope.js";
import { tramePublishable, trameDisponible } from "../lib/schema.js";
import { natureOfActe } from "../lib/annexes.js";
import { styleRuntimeCss, generalPageCss } from "../lib/styles.js";
import { isDark, brandColors, lighten } from "../lib/theme.js";
import { debounce } from "../lib/util.js";
import * as collab from "../lib/collab.js";
import { circuitFor, etapePour, validationAJour, validationPourSignature, parapheurActif as parapheurActifConfig } from "../lib/validation.js";
import { circuitPour, modeSignature, certificationDe as certificationDeActe, certificationRequise as certificationRequiseActe, publicationExternePossible, versionSignee as versionSigneeDe } from "../lib/externe.js";
import {
  etatRevision, revisionRequise, reviseursPour, peutReviser, peutTrancherRevision, revisionPourSignature,
  REVISION_STATUTS,
} from "../lib/revision.js";
import { statutExecution, alertes as alertesExecution } from "../lib/execution.js";
import { controleLegaliteActif as controleLegaliteActifConfig } from "../lib/legalite.js";
import { publicationSettings } from "../lib/eli.js";
import { competenceDuCompte, fileSignature as fileSignatureDe } from "../lib/signataires.js";

export const state = {
  config: null,
  trames: [],
  actes: [],
  users: [],
  user: null,
  // La PAGE D'ACCUEIL du site est le RECUEIL PUBLIC, et non l'atelier : c'est la
  // route par défaut, celle qu'on obtient sans ancre et sans paramètre. Un
  // visiteur qui ouvre l'adresse tombe sur les actes publiés ; l'atelier est
  // derrière la porte « Se connecter » du recueil (voir `parseRoute`).
  route: { view: "recueil", params: {} },
  ready: false,
  firstRun: false,
  storageOk: true,
  draft: {},
  // Le mode annoncé par le DÉPLOIEMENT (`GET /v1/auth/config`), quand il y en a
  // un : `{ mode, demo, motDePasseMin, marque }`. Null hors service des comptes
  // (édition en ligne, page statique). Voir src/lib/motdepasse.js.
  deploiement: null,
  // Faut-il demander à l'agent de changer son mot de passe (mot de passe
  // provisoire remis par un administrateur) ? Renseigné à la connexion.
  motDePasseAChanger: false,
};

const listeners = new Set();
export const onChange = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { console.error(e); } });

// Une vue s'enregistre ici pour pouvoir se redessiner toute seule sans que
// chaque module ait besoin de re-rendre la coquille (en-tête + navigation).
let viewRenderer = null;
let renderQueued = false;

export function setViewRenderer(fn) { viewRenderer = fn; }

// Redessine la vue courante. Le redessin est différé d'une micro-tâche et
// coalescé, pour deux raisons :
//  1. un gestionnaire `blur` ne doit jamais reconstruire le DOM pendant que
//     l'éditeur le parcourt ou le vide (sinon `removeChild` lève NotFoundError) ;
//  2. plusieurs demandes dans le même geste utilisateur ne coûtent qu'un rendu.
export function redrawView() {
  if (renderQueued) return;
  renderQueued = true;
  queueMicrotask(() => {
    renderQueued = false;
    try { if (viewRenderer) viewRenderer(); } catch (e) { console.error(e); }
  });
}

const persistConfig = debounce(() => saveConfig(state.config), 400);
const persistTrames = debounce(() => saveTrames(state.trames), 400);
const persistActes = debounce(() => saveActes(state.actes), 400);

export function touch(what = "config", { rerender = true } = {}) {
  if (what === "config") persistConfig();
  if (what === "trames") persistTrames();
  if (what === "actes") persistActes();
  if (rerender) emit();
}

// ------------------------------------------------------- mode du déploiement
// Interroge le service des comptes, s'il y en a un, et applique le mode qu'il
// annonce. Silencieux quand il n'y a pas de service (édition en ligne, page
// statique) : le mode est alors celui du référentiel.
export async function chargerModeDeploiement() {
  const r = await motdepasse.modeService();
  if (!r.ok || !r.body || !r.body.auth) return null;
  const dep = setDeploiementAuth({
    mode: r.body.auth,
    demo: r.body.demo,
    // Le commutateur de démonstration, tel que le service le dit (`DEMO` du
    // .env, voir src/lib/demo.js). Absent d'un service antérieur : `demoDeploiement`
    // retombe alors sur le mode.
    demoJeu: r.body.demoJeu,
    motDePasseMin: r.body.motDePasseMin,
    marque: r.body.marque || null,
    comptes: r.body.demoComptes || [],
    serveur: true,
    baseDisponible: r.body.baseDisponible,
    baseMessage: r.body.baseMessage,
    baseRemede: r.body.baseRemede,
    adminAmorce: r.body.adminAmorce,
    adminMotif: r.body.adminMotif,
    adminAvertissement: r.body.adminAvertissement,
  });
  // Les réglages de RÉFÉRENTIEL posés par le `.env` (identité, vocabulaire,
  // numérotation, délais, recueil, fonctions) : le service les rend à part,
  // déjà validés. Ils s'appliquent par-dessus le référentiel au démarrage (voir
  // `bootstrap`, src/lib/store.js). Un service antérieur ne connaît pas la
  // route : `setDeploiementConfig(null)` n'applique alors rien.
  const rc = await motdepasse.configService();
  setDeploiementConfig(rc.ok ? rc.body : null);
  state.deploiement = dep;
  return dep;
}

// La marque de la collectivité avant toute session : le service la rend dans
// `GET /v1/auth/config` (nom, sous-titre, emblème — et sa variante pour le thème
// sombre), parce que le référentiel — qui
// la porte vraiment — n'est lisible qu'une fois connecté. C'est ce qui permet à
// l'écran de connexion, et au recueil public, de porter les couleurs de la
// collectivité au lieu de celles de la démonstration.
function appliquerMarqueDeploiement(config) {
  const m = state.deploiement && state.deploiement.marque;
  if (!m || !config || !config.brand) return appliquerOptions(config);
  config.brand = {
    ...config.brand,
    ...(m.name ? { name: m.name } : {}),
    ...(m.tagline ? { tagline: m.tagline } : {}),
    ...(m.logoUrl ? { logoUrl: m.logoUrl } : {}),
    ...(m.logoUrlDark ? { logoUrlDark: m.logoUrlDark } : {}),
    demo: false,
  };
  return appliquerOptions(config);
}

// Charge les données du registre et rouvre la session enregistrée sur ce poste.
async function chargeDonnees() {
  const { config, trames, actes, users, session, firstRun } = await bootstrap();
  state.config = config;
  state.trames = trames;
  state.actes = actes;
  state.users = users;
  const fromSession = session?.userId ? users.find((u) => u.id === session.userId) : null;
  // Un compte désactivé — ou un compte de démonstration alors que l'annuaire est
  // branché — ne rouvre pas de session : on repart de l'écran de connexion.
  state.user = fromSession && accountUsable(state.config, fromSession) ? fromSession : null;
  state.firstRun = firstRun;
  state.ready = true;
  applyBrand();
  emit();
  demarrerPresence();
}

// Présence et journal : démarrés seulement quand une session est ouverte (le
// battement de cœur porte l'identité du compte connecté). Un visiteur, lui,
// n'entre pas dans l'atelier : il ne se signale pas aux postes de travail.
// Voir src/lib/collab.js.
function demarrerPresence() {
  if (state.user && !estVisiteur(state.user)) {
    collab.demarrer(state.user).catch((e) => console.warn("Collaboration indisponible :", e));
  }
}

export async function init() {
  await initStorage();
  // Le service des comptes, s'il existe, dit le mode AVANT tout chargement : en
  // mode « mot de passe », les données ne sont servies qu'à une session ouverte,
  // et l'application ne doit donc rien demander avant de s'être identifiée.
  const dep = await chargerModeDeploiement();
  // Le service vient de dire sous quel régime il tourne : si le pilote de
  // persistance a été bâti sur un autre présage (la page n'annonçait rien, ou
  // annonçait autre chose), on le refait maintenant. En mode « mot de passe »,
  // un pilote à jeton laisserait partir chaque écriture SANS l'anti-CSRF : le
  // service la refuserait (403) tout en servant les lectures — l'état passait
  // au rouge à chaque geste, et rien ne s'enregistrait sur la base. Voir
  // `rafraichirPilote` (src/lib/db/index.js).
  await db.rafraichirPilote().catch(() => {});
  if (dep && dep.mode === "password") {
    // On se donne une identité NEUTRE (le vrai référentiel est protégé) : c'est
    // assez pour dessiner l'écran de connexion, et le service en fournit le nom.
    // Surtout PAS le jeu de démonstration : hors démonstration, l'écran de
    // connexion ne doit laisser filtrer aucune identité fictive (voir
    // src/lib/demo.js).
    state.config = appliquerMarqueDeploiement(seedConfigVierge());
    const s = await motdepasse.sessionCourante();
    if (s.ok && s.body && s.body.utilisateur) {
      await chargeDonnees();
      const u = state.users.find((x) => x.id === s.body.utilisateur.id) || s.body.utilisateur;
      state.user = accountUsable(state.config, u) ? u : null;
      state.motDePasseAChanger = !!s.body.mustChange;
      emit();
      demarrerPresence();
      return;
    }
    state.user = null;
    state.ready = true;
    applyBrand();
    emit();
    return;
  }
  await chargeDonnees();
}

// ------------------------------------------------------------------ comptes
// Le contrôle d'accès est centralisé ici : les vues n'appellent que `can`.
export const can = (perm) => userCan(state.user, perm);
export const isAdmin = () => hasRole(state.user, "administrateur");
export const currentUser = () => state.user;
export const rolesDe = (user = state.user) => rolesOf(user);
export const libelleRoles = (user = state.user) => roleLabel(user);

export async function login(userId) {
  const u = state.users.find((x) => x.id === userId);
  if (!u || !accountUsable(state.config, u)) return false;
  // Quand l'annuaire est branché, seule une session ouverte par l'annuaire est
  // possible : un compte local pré-enregistré attend sa première connexion
  // fédérée (il ne peut pas être choisi dans une liste).
  if (isOidc(state.config) && !u.oidcSub) return false;
  u.lastLogin = new Date().toISOString();
  state.user = u;
  await saveUsers(state.users);
  await saveSession({ userId: u.id, at: u.lastLogin });
  emit();
  if (!estVisiteur(u)) collab.demarrer(u).catch((e) => console.warn("Collaboration indisponible :", e));
  return true;
}

// -------------------------------------------------- connexion par mot de passe
// Le mot de passe ne fait que passer : le SERVICE le vérifie et rend une session
// (cookie `HttpOnly`). Une fois la session ouverte, les données deviennent
// lisibles — c'est seulement alors qu'on charge le registre.
async function ouvrirSessionLocale(utilisateurServeur, { mustChange = false } = {}) {
  await chargeDonnees();
  const u = state.users.find((x) => x.id === utilisateurServeur.id) || utilisateurServeur;
  state.user = accountUsable(state.config, u) ? u : null;
  state.motDePasseAChanger = !!mustChange;
  if (state.user) {
    state.user.lastLogin = new Date().toISOString();
    await saveSession({ userId: state.user.id, at: state.user.lastLogin, via: "motdepasse" });
  }
  emit();
  demarrerPresence();
  return state.user;
}

export async function loginWithPassword(identifiant, motDePasse) {
  const r = await motdepasse.connexion(identifiant, motDePasse);
  if (!r.ok) {
    return { ok: false, code: (r.body && r.body.code) || "connexion_refusee", message: motdepasse.messageErreur(r) };
  }
  const u = await ouvrirSessionLocale(r.body.utilisateur || {}, { mustChange: r.body.mustChange });
  if (!u) return { ok: false, code: "compte_desactive", message: "Ce compte n'est pas utilisable dans l'application." };
  return { ok: true, user: u, mustChange: !!r.body.mustChange };
}

// Le raccourci de démonstration, quand le service l'a laissé ouvert
// (`DEMO_ACCOUNTS=true` avec `AUTH_MODE=password`) : on choisit un compte de
// démonstration, sans mot de passe, et le service ouvre la session.
export async function loginDemoService(userId) {
  const r = await motdepasse.connexionDemo(userId);
  if (!r.ok) return { ok: false, code: (r.body && r.body.code) || "demonstration_refusee", message: motdepasse.messageErreur(r) };
  const u = await ouvrirSessionLocale(r.body.utilisateur || {}, { mustChange: false });
  if (!u) return { ok: false, code: "compte_desactive", message: "Ce compte n'est pas utilisable dans l'application." };
  return { ok: true, user: u };
}

export async function changerMonMotDePasse(ancien, nouveau) {
  const r = await motdepasse.changerMotDePasse(ancien, nouveau);
  if (!r.ok) return { ok: false, message: motdepasse.messageErreur(r) };
  state.motDePasseAChanger = false;
  emit();
  return { ok: true };
}

// Ouverture de session après authentification par l'annuaire (voir
// src/lib/oidc.js) : le compte est créé ou repris à partir des revendications,
// puis la session est ouverte. Rend `{ok, user, created, linked}` ou
// `{ok: false, reason}` — le refus est motivé, l'écran de connexion l'affiche.
export async function loginWithClaims(claims) {
  const res = applyOidcUser(state.config, state.users, claims);
  if (res.denied) return { ok: false, reason: res.reason };
  const sync = syncDemoAccounts(state.config, res.users);
  const u = sync.changed ? sync.users.find((x) => x.id === res.user.id) : res.user;
  u.lastLogin = new Date().toISOString();
  u.oidcSyncedAt = new Date().toISOString();
  state.users = sync.users;
  state.user = u;
  await saveUsers(state.users);
  await saveSession({ userId: u.id, at: u.lastLogin, via: "oidc" });
  emit();
  if (!estVisiteur(u)) collab.demarrer(u).catch((e) => console.warn("Collaboration indisponible :", e));
  return { ok: true, user: u, created: res.created, linked: res.linked, role: res.role };
}

export async function logout() {
  // On quitte proprement : notre présence est retirée (les autres postes ne nous
  // attendent pas 70 secondes), le verrou de rédaction tombe avec elle, et — en
  // mode à session (mot de passe, annuaire) — la SESSION est fermée côté service (le cookie HttpOnly
  // ne peut pas être effacé par le JavaScript de la page : c'est le service qui
  // le fait, et qui invalide le jeton en base).
  await collab.arreter().catch(() => {});
  if (sessionDeService(state.config)) await motdepasse.deconnexion().catch(() => {});
  state.user = null;
  state.motDePasseAChanger = false;
  await saveSession(null);
  emit();
}

export async function setUsers(users) {
  // Les comptes de démonstration restent désactivés tant que l'annuaire est
  // branché, quelle que soit la façon dont la liste a été modifiée (création,
  // modification, import, réinstallation du jeu de démonstration).
  const sync = syncDemoAccounts(state.config, users);
  state.users = sync.users;
  // Un compte désactivé ou supprimé pendant la session : on ferme la session.
  if (state.user) {
    const still = state.users.find((u) => u.id === state.user.id);
    if (!still || !accountUsable(state.config, still)) { await logout(); return; }
    state.user = still;
  }
  await saveUsers(state.users);
  emit();
}

export const resetDemoUsers = async () => setUsers(seedUsers(state.config));

// ------------------------------------------------------------------ annuaire
// Applique le mode d'authentification qui vient d'être réglé : désactive (ou
// réactive) les comptes de démonstration, et ferme la session si le compte
// connecté n'est plus utilisable. Rend de quoi prévenir l'utilisateur.
export async function applyAuthMode() {
  const sync = syncDemoAccounts(state.config, state.users);
  if (sync.changed) {
    state.users = sync.users;
    await saveUsers(state.users);
  }
  // Le compte connecté n'est plus utilisable (compte de démonstration alors que
  // l'annuaire est branché, ou compte désactivé) : on referme la session. Le
  // réglage d'un simple paramètre, lui, ne déconnecte personne.
  const detached = !!state.user && !accountUsable(state.config, state.user);
  if (detached) await logout();
  touch("config");
  return { disabled: sync.disabled.length, restored: sync.restored.length, demoDisabled: demoAccountsDisabled(state.config), detached };
}

// Un rédacteur ne voit que ses actes (et ceux qui n'ont pas d'auteur, hérités
// d'un import : personne ne les « possède »), et chacun ne voit que ce qui
// relève de son périmètre (services et bureaux — voir src/lib/scope.js). Un
// acte à la corbeille ne fait plus partie du registre : il a son propre écran.
export const estCorbeille = (x) => !!x?.deletedAt;

// La SIGNATURE engage son auteur : un signataire voit les actes dont la
// signature relève de lui — les siens, et ceux de ses délégataires (sa
// signature y est engagée par délégation ou subdélégation). C'est ce que dit
// `competenceDuCompte` (src/lib/signataires.js), lu sur la chaîne de signature
// de l'acte. Aucun rôle n'est requis pour CELA : la compétence est un fait du
// référentiel ; la qualité de signataire, elle, ouvre l'écran et fait la file.
export const competenceDeSignature = (acte) =>
  competenceDuCompte(state.config, state.user, acte, trameById(acte?.trameId));

export function visibleActes() {
  const tous = can("actes.tous");
  const me = state.user;
  return state.actes.filter((a) => {
    if (estCorbeille(a)) return false;
    // Un acte SOUMIS À RÉVISION est visible par les réviseurs compétents pour
    // lui, même hors de leur périmètre administratif : c'est le principe même de
    // la compétence (un service des affaires juridiques contrôle les actes des
    // autres services). Un acte qui n'est pas soumis ne leur est pas ouvert.
    const parRevision = !!a.revision && peutReviser(state.config, me, { trame: trameById(a.trameId), acte: a });
    // Le pendant de la révision dans le CIRCUIT EXTERNE : un acte dont la
    // version signée attend (ou a reçu) la certification de conformité est
    // ouvert aux réviseurs compétents, même hors de leur périmètre — sans quoi
    // la certification ne pourrait jamais se faire depuis leur écran. Le
    // contrôle porte sur la pièce signée, mais il faut pouvoir l'atteindre.
    const parCertification = !!(versionSigneeDe(a) && a.statut !== "publie")
      && peutReviser(state.config, me, { trame: trameById(a.trameId), acte: a });
    // Un acte dont MA signature relève m'est ouvert de la même façon : ma
    // personne figure dans sa chaîne de signature.
    const parSignature = !tous && !!a.values?.signataire && competenceDeSignature(a).ok;
    if (!tous && a.createdBy && a.createdBy !== me?.id && !parRevision && !parSignature && !parCertification) return false;
    if (parRevision || parSignature || parCertification) return true;
    return inScope(state.config, me, a);
  });
}

// La file du signataire — ce qui attend sa signature, et ce qui est signé au
// titre de sa délégation. Elle ne regarde que les actes visibles (donc son
// champ de compétence) : un signataire n'y voit rien d'autre.
export const fileSignature = () =>
  fileSignatureDe(state.config, state.user, visibleActes(), (a) => trameById(a.trameId));

// Les trames visibles : celles qui relèvent du périmètre du compte (une trame
// sans service — générale ou héritée — reste visible par tous).
export function visibleTrames() {
  return state.trames.filter((t) => !estCorbeille(t) && inScope(state.config, state.user, t));
}

// ------------------------------------------------------------------ corbeille
// La suppression est RÉVERSIBLE : l'objet est marqué (`deletedAt`) et quitte le
// registre, mais reste dans le document jusqu'à sa suppression définitive. Une
// trame supprimée par erreur, un acte mis de côté : rien n'est perdu par
// inadvertance.
export function actesCorbeille() {
  const tous = can("actes.tous");
  const me = state.user?.id;
  return state.actes.filter((a) => {
    if (!estCorbeille(a)) return false;
    if (!tous && a.createdBy && a.createdBy !== me) return false;
    return inScope(state.config, state.user, a);
  }).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
}

export function tramesCorbeille() {
  return state.trames.filter((t) => estCorbeille(t) && inScope(state.config, state.user, t))
    .sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
}

export async function mettreALaCorbeille(type, obj) {
  const at = new Date().toISOString();
  obj.deletedAt = at;
  obj.deletedBy = state.user?.id || "";
  obj.deletedByName = state.user ? fullName(state.user) : "";
  await journaliser({
    action: "corbeille", cible: type, cibleLabel: libelleObjet(type, obj),
    acteId: type === "acte" ? obj.id : "",
    detail: "placé à la corbeille", to: [],
  });
  touch(type === "acte" ? "actes" : "trames");
  return obj;
}

export async function restaurer(type, obj) {
  delete obj.deletedAt;
  delete obj.deletedBy;
  delete obj.deletedByName;
  await journaliser({
    action: "restauration", cible: type, cibleLabel: libelleObjet(type, obj),
    acteId: type === "acte" ? obj.id : "",
    detail: "restauré depuis la corbeille", to: [],
  });
  touch(type === "acte" ? "actes" : "trames");
  return obj;
}

// Suppression définitive : l'objet quitte le document. Réservée à qui peut
// gérer des actes (ou des trames) — la corbeille n'est pas une porte dérobée.
export async function supprimerDefinitivement(type, obj) {
  const liste = type === "acte" ? state.actes : state.trames;
  const i = liste.findIndex((x) => x.id === obj.id);
  if (i < 0) return false;
  await journaliser({
    action: "suppression", cible: type, cibleLabel: libelleObjet(type, obj),
    detail: "supprimé définitivement", to: [],
  });
  liste.splice(i, 1);
  touch(type === "acte" ? "actes" : "trames");
  return true;
}

const libelleObjet = (type, obj) =>
  type === "acte" ? (obj.numero || obj.objet || obj.id) : (obj.name || obj.id);

// ------------------------------------------------- mise à disposition d'une trame
// Une trame se prépare à l'abri : tant qu'un éditeur ne l'a pas MISE À
// DISPOSITION, elle n'existe que pour l'atelier, et aucun service ne peut
// rédiger à partir d'elle. C'est le statut « published » de la trame, mais le
// geste mérite son nom : c'est celui qui engage les services qui s'en serviront.
// Le retour est possible (« retirer ») — un modèle se corrige, et une trame
// retirée redevient un brouillon, invisible des services, sans rien perdre.
export const trameEstDisponible = (trame) => trameDisponible(trame);

export async function mettreTrameADisposition(trame) {
  if (!trame) return false;
  const etaitArchivee = trame.status === "archived";
  trame.status = "published";
  trame.publishedAt = new Date().toISOString();
  trame.publishedBy = state.user?.id || "";
  await journaliser({
    action: "trame.disponible", cible: "trame", cibleLabel: libelleObjet("trame", trame),
    detail: etaitArchivee
      ? "sortie des archives et mise à disposition des services"
      : "mise à disposition des services",
    to: [],
  });
  touch("trames");
  return true;
}

export async function retirerTrame(trame) {
  if (!trame) return false;
  trame.status = "draft";
  delete trame.publishedAt;
  await journaliser({
    action: "trame.retiree", cible: "trame", cibleLabel: libelleObjet("trame", trame),
    detail: "retirée : de nouveau en brouillon, invisible des services",
    to: [],
  });
  touch("trames");
  return true;
}

// --------------------------------------------------------------- journal
// Une seule fonction pour écrire dans le registre des faits : elle complète
// l'entrée avec le compte courant, l'écrit et rafraîchit les pastilles.
export async function journaliser(entry) {
  try {
    return await collab.journaliser({ by: state.user?.id || "", byName: state.user ? fullName(state.user) : "", ...entry });
  } catch (e) {
    console.warn("Journal indisponible :", e);
    return null;
  }
}

// --------------------------------------------------------------- parapheur
// Le circuit de validation (le « parapheur ») n'est plus une fonction
// expérimentale (1.5.0) : il est toujours disponible, et ce sont les circuits
// enregistrés dans le référentiel qui décident. Un référentiel sans circuit
// n'a aucun parapheur — les actes partent alors directement en signature.
// `parapheurActif()` reste le point d'entrée du reste de l'interface.
export const parapheurActif = () => parapheurActifConfig(state.config);

// La transmission automatique au contrôle de légalité est elle aussi une
// fonction expérimentale (Administration › Expérimentale) : éteinte par défaut,
// aucun acte n'est télétransmis, et l'étape ne s'intercale pas entre la
// signature et la publication (voir src/lib/legalite.js).
export const controleLegaliteActif = () => controleLegaliteActifConfig(state.config);

// La publication automatique au recueil (Administration › Publication) : allumée
// par défaut, elle publie l'acte dès le retour signé. Éteinte, l'acte signé
// s'arrête au registre — c'est le réglage d'une administration qui publie dans
// son propre système, et se sert du recueil pour autre chose (ou pas du tout).
export const publicationAuto = () => publicationSettings(state.config).auto !== false;

// La transmission enregistrée sur un acte : la formalité et, si elle a été
// faite par l'API d'envoi, son certificat.
export const transmissionDe = (acte) => acte?.execution?.transmission || null;

// Le circuit applicable à un acte : celui de sa trame, résolu dans le référentiel.
export const circuitDe = (acte) => circuitFor(state.config, { trame: trameById(acte?.trameId), acte });

// L'étape que le compte courant peut franchir sur cet acte (null sinon).
export const etapeAParachever = (acte) => etapePour(acte, state.user, state.config);

// Les actes qui attendent un geste de ma part, puis ceux en cours chez d'autres.
export function parapheur() {
  if (!parapheurActif()) return { aMoi: [], enCours: [], valides: [], rejets: [], horsCircuit: visibleActes() };
  const tous = visibleActes();
  const aMoi = [];
  const enCours = [];
  const valides = [];
  const rejets = [];
  for (const a of tous) {
    const v = a.validation;
    if (!v) continue;
    if (!validationAJour(a)) { enCours.push(a); continue; }
    if (v.statut === "en_cours") {
      if (etapeAParachever(a)) aMoi.push(a); else enCours.push(a);
    } else if (v.statut === "valide") valides.push(a);
    else rejets.push(a);
  }
  const tri = (l) => l.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { aMoi: tri(aMoi), enCours: tri(enCours), valides: tri(valides), rejets: tri(rejets), horsCircuit: tous.filter((a) => !a.validation) };
}

// Un acte peut-il être envoyé en signature du point de vue du parapheur ?
// Aucun circuit applicable : la question ne se pose pas — la réponse est oui.
export const pretPourParapheur = (acte) => (parapheurActif() ? validationPourSignature(acte) : { ok: true, raison: "" });

// --------------------------------------------------------------- révision
// La révision s'intercale entre l'envoi décidé par le rédacteur et l'envoi
// effectif (voir src/lib/revision.js). Elle n'existe que s'il y a un réviseur
// compétent pour l'acte : sans réviseur, aucune porte, et l'acte part
// directement en signature.
const cibleDe = (acte) => ({ trame: trameById(acte?.trameId), acte });

// Les comptes compétents pour réviser cet acte — ceux à qui il est annoncé.
export const reviseursDe = (acte) => reviseursPour(state.config, state.users, cibleDe(acte));
// Cet acte doit-il passer par un réviseur ?
export const revisionRequisePour = (acte) => revisionRequise(state.config, state.users, cibleDe(acte));
// Le compte courant est-il COMPÉTENT pour cet acte (la compétence, elle, ne
// s'improvise pas : elle décide de l'obligation de réviser)...
export const reviseurDe = (acte) => peutReviser(state.config, state.user, cibleDe(acte));
// ...et peut-il TRANCHER ? Un administrateur le peut toujours : il est le
// recours quand le réviseur compétent est absent, comme pour le parapheur.
export const peutTrancher = (acte) => peutTrancherRevision(state.config, state.user, cibleDe(acte));
export const etatRevisionDe = (acte) => etatRevision(acte);
export const revisionPour = (acte) => revisionPourSignature(state.config, state.users, acte, trameById(acte?.trameId));
export const etatsRevision = REVISION_STATUTS;

// La file du réviseur : ce qui m'attend, ce qui attend un autre réviseur, ce qui
// a été révisé, ce qui a été rejeté. Un acte n'y entre qu'une fois SOUMIS : tant
// que le rédacteur ne l'a pas envoyé, il ne regarde pas le réviseur.
export function fileRevision() {
  const tous = visibleActes();
  const aReviser = [], attente = [], valides = [], rejets = [];
  const signe = (a) => !!(a.original || a.statut === "signee" || a.statut === "publie");
  for (const a of tous) {
    if (a.kind === "consolide") continue;
    const r = a.revision;
    if (!r) continue;
    if (!revisionRequisePour(a)) continue;
    if (r.statut === "en_attente") (peutTrancher(a) ? aReviser : attente).push(a);
    else if (r.statut === "rejete") rejets.push(a);
    else if (!signe(a)) valides.push(a);
  }
  const tri = (l) => l.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { aReviser: tri(aReviser), attente: tri(attente), valides: tri(valides), rejets: tri(rejets) };
}

// Un acte peut-il être envoyé en signature : parapheur d'abord, révision
// ensuite. Rend `{ ok, raison, requise }` — `requise` dit si une révision était
// due sur cet acte (`revisionPourSignature`), ce que le service de signature
// reçoit pour refuser d'ouvrir un circuit sur un acte non révisé.
export function pretPourSignature(acte) {
  const para = pretPourParapheur(acte);
  if (!para.ok) return { ...para, requise: false };
  return revisionPour(acte);
}

// ------------------------------------------------------ signature externe
// Le circuit de signature peut être ÉLECTRONIQUE (l'API du prestataire — le
// comportement historique) ou EXTERNE (papier ou outil tiers : le document est
// téléchargé, signé hors de l'application, puis déposé en PDF). Le réglage est
// général (Administration › Signature) et la trame peut trancher — imposer ou
// autoriser le circuit externe. Voir src/lib/externe.js.
export const circuitSignatureDe = (acte) => circuitPour(state.config, trameById(acte?.trameId));
export const modeSignatureDe = (acte) => modeSignature(state.config, trameById(acte?.trameId), acte);
export const estCircuitExterne = (acte) => modeSignatureDe(acte) === "externe";

// Le dossier de signature externe de l'acte : la version signée déposée, la
// certification du réviseur, et l'état de la publication du point de vue de ce
// circuit.
export const versionSigneeDeActe = (acte) => versionSigneeDe(acte);
export const certificationDeActeExterne = (acte) => certificationDeActe(acte);
export const certificationRequisePour = (acte) => certificationRequiseActe(acte);
export const publicationExterneDe = (acte) => publicationExternePossible(acte);

// La certification de conformité est le geste du RÉVISEUR : elle suit la même
// compétence que la révision. Un administrateur reste le recours.
export const peutCertifier = (acte) => peutTrancher(acte);

// La file du réviseur pour le circuit externe : les versions signées déposées
// qui attendent une certification de conformité.
export function fileCertification() {
  const tous = visibleActes();
  const aCertifier = [], attente = [], certifies = [];
  for (const a of tous) {
    if (!estCircuitExterne(a)) continue;
    if (!versionSigneeDe(a)) continue;
    if (!certificationRequisePour(a)) continue;
    const statut = (certificationDeActe(a) || {}).statut;
    if (statut === "conforme") certifies.push(a);
    else if (peutCertifier(a)) aCertifier.push(a);
    else attente.push(a);
  }
  const tri = (l) => l.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return { aCertifier: tri(aCertifier), attente: tri(attente), certifies: tri(certifies) };
}

// -------------------------------------------------------------- exécution
export const executionDe = (acte) => statutExecution(acte, state.config, { publiable: actePubliable(acte), trame: trameById(acte?.trameId) });
export const alertesDe = (acte) => alertesExecution(acte, state.config, { publiable: actePubliable(acte), trame: trameById(acte?.trameId) });

// ------------------------------------------------------------ collaboration
// La couche de collaboration (présence, verrou de rédaction, journal) est
// ré-exportée ici pour que les vues n'aient qu'un seul module à connaître.
export const signalerEcranCollab = (ecran, opts) => collab.signalerEcran(ecran, opts);
export const signalerRedaction = (id, label) => collab.signalerRedaction(id, label);
export const libererRedaction = () => collab.libererRedaction();
export const quiRedige = (acteId) => collab.quiRedige(acteId);
export const presencesActives = () => collab.presencesActives();
export const enLigne = () => collab.enLigne();
export const journalPour = (opts) => collab.journalPour(opts);
export const notifications = (opts) => collab.notifications(state.user, { actesVisibles: visibleActes(), ...opts });
export const marquerVu = () => collab.marquerVu(state.user?.id);
export const surChangementCollab = (fn) => collab.surChangement(fn);
export const rafraichirCollab = () => collab.rafraichir();

export const userById = (id) => state.users.find((u) => u.id === id);

export function applyBrand() {
  const b = state.config?.brand || {};
  const r = document.documentElement.style;
  // La couleur de la marque est adaptée au thème : un bleu très foncé est
  // illisible sur un fond sombre. `--brand-light` garde la teinte d'origine —
  // c'est elle que reprennent les papiers (`[data-theme="dark"] .paper`), qui
  // restent clairs.
  if (b.color) r.setProperty("--brand-light", b.color);
  const bc = brandColors(b.color);
  if (bc.brand) r.setProperty("--brand", bc.brand);
  if (bc.soft) r.setProperty("--brand-soft", bc.soft);
  else r.removeProperty("--brand-soft");
  if (b.colorDark) r.setProperty("--brand-dark", isDark() ? lighten(b.colorDark, 0.7) : b.colorDark);
  if (b.uiFont) r.setProperty("--font-ui", b.uiFont);
  if (b.documentFont) r.setProperty("--font-doc", b.documentFont);
  applySheets();
}

// Les feuilles de style (charte graphique) des documents vivent dans une
// feuille <style> à part, tenue à jour ici : chaque feuille est confinée à ses
// propres documents (`[data-sheet="…"]`), de sorte que l'aperçu montre, sur le
// même écran, plusieurs chartes sans qu'elles se mélangent. Rejouée à chaque
// changement du référentiel — elle est idempotente.
// Une seconde feuille porte la règle `@page` : quand on imprime directement
// l'aperçu (Ctrl+P), c'est la charte GÉNÉRALE qui donne ses marges à la page.
export function applySheets() {
  if (!state.config) return;
  let el = document.getElementById("sheet-css");
  if (!el) {
    el = document.createElement("style");
    el.id = "sheet-css";
    document.head.appendChild(el);
  }
  el.textContent = styleRuntimeCss(state.config);
  let page = document.getElementById("sheet-print-css");
  if (!page) {
    page = document.createElement("style");
    page.id = "sheet-print-css";
    document.head.appendChild(page);
  }
  page.textContent = "@media print{" + generalPageCss(state.config) + "}";
}

const ROUTE_WITH_ID = ["trame", "rediger", "acte", "aide", "modifier", "publication", "docs", "recueil"];

// Les clés que l'URL porte pour le recueil public : par elles, un acte publié a
// une adresse citable (« ?acte=… », « ?eli=… »), que les moteurs peuvent suivre.
// L'identifiant ELI est lui-même une adresse de l'instance (voir
// src/lib/recueil.js, `adresseEli`) : elle désigne l'acte — et sa version en
// vigueur — sans rien dire des adresses internes du recueil.
const CLES_PUBLIQUES = ["acte", "format", "recueil", "eli"];

// L'URL suit la page du recueil — jamais l'inverse : c'est ce qui donne à un
// acte publié une adresse que l'on partage. Les paramètres de la plateforme
// (`__generatorLastEditTime`…) et le fragment de l'environnement d'édition sont
// conservés : on ne touche qu'aux nôtres, et l'échec est sans conséquence
// (l'écran, lui, est déjà rendu).
export function majUrlRecherche(params = {}) {
  try {
    const qs = new URLSearchParams(location.search || "");
    for (const k of CLES_PUBLIQUES) qs.delete(k);
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const s = qs.toString();
    history.replaceState(history.state, "", location.pathname + (s ? "?" + s : "") + location.hash);
  } catch (e) { /* l'adresse est un confort, pas une condition */ }
}

// Décode une part d'adresse sans jamais lever : une adresse mal formée ne doit
// pas casser la navigation.
const decoder = (s) => { try { return decodeURIComponent(s); } catch (e) { return String(s); } };

export function navigate(path, extra = {}) {
  const raw = String(path).replace(/^#?\/?/, "");
  const [view, ...rest] = raw.split("/");
  const params = { ...extra };
  // `rest[0]` arrive encodé (les liens le sont) ; `params.id` garde cet encodage
  // — c'est la convention des vues, qui décodent — tandis que l'adresse écrite
  // dans la barre du navigateur porte, elle, une seule couche d'encodage.
  const id = ROUTE_WITH_ID.includes(view) && rest[0] ? rest[0] : "";
  if (id) params.id = id;
  // Sans destination nommée, on va là où mène le site : la page d'accueil, le
  // recueil public (voir `state.route`).
  state.route = { view: view || "recueil", params };
  majUrlRecherche(view === "recueil"
    ? (id ? { acte: decoder(id), format: params.format }
      : params.eli ? { eli: params.eli }
        : { recueil: "1" })
    : {});
  emit();
}

// Compatibilité : accepte un lien profond #/… sans jamais écrire dans le hash
// (l'environnement d'édition utilise le hash pour ses propres besoins).
//
// Sans ancre ni paramètre, la route reste celle qui est en place — et, au
// chargement, c'est la route PAR DÉFAUT : le recueil public, la page d'accueil
// du site. On ne force donc rien ici : c'est `state.route` qui porte l'accueil,
// et cette fonction ne fait que reconnaître les adresses que l'on connaît.
export function parseRoute() {
  // Le recueil public d'abord : c'est par la requête qu'un acte publié a son
  // adresse (« ?acte=<clé> », « ?recueil=1 », « ?eli=<identifiant> »), et un
  // visiteur qui suit ce lien ne doit voir ni l'écran de connexion, ni le
  // recueil vide.
  const qs = new URLSearchParams(location.search || "");
  const acte = qs.get("acte");
  if (acte) {
    // `params.id` suit la convention des vues (encodé) ; l'adresse, elle, n'en
    // porte qu'une couche — voir `navigate`.
    state.route = { view: "recueil", params: { id: encodeURIComponent(acte), format: qs.get("format") || "" } };
    emit();
    return;
  }
  // L'identifiant ELI comme adresse : le recueil le traduit en acte (voir
  // src/ui/views/recueil-public.js).
  const eli = qs.get("eli");
  if (eli) {
    state.route = { view: "recueil", params: { eli } };
    emit();
    return;
  }
  if (qs.has("recueil")) {
    state.route = { view: "recueil", params: {} };
    emit();
    return;
  }
  const ancre = location.hash || "";
  // Ni ancre, ni ancre étrangère : rien à faire (voir le commentaire ci-dessus).
  if (!ancre.startsWith("#/")) return;
  const raw = ancre.replace(/^#\/?/, "");
  const [view, ...rest] = raw.split("/");
  const params = {};
  if (ROUTE_WITH_ID.includes(view) && rest[0]) params.id = rest[0];
  // Une ancre vide (« #/ ») est l'accueil du site : le recueil public.
  state.route = { view: view || "recueil", params };
  emit();
}

export const trameById = (id) => state.trames.find((t) => t.id === id);

// Un acte est publiable si sa trame ne l'a pas déclaré non publiable. Les actes
// sans trame (importés, actes modificatifs, versions consolidées) restent
// publiables : ils ne relèvent pas d'un acte individuel. La question se pose au
// moment de la publication, donc on la lit à la trame COURANTE : déclarer une
// trame non publiable vaut aussi pour les actes déjà rédigés à partir d'elle.
//
// Une ANNEXE, elle, n'est jamais publiée pour elle-même : elle ne se signe pas,
// et c'est l'acte qui l'adopte qui est publié — son original étant suivi du
// texte de l'annexe (voir src/lib/annexe-docs.js).
export function actePubliable(a) {
  if (!a) return true;
  if (natureOfActe(a, state.trames) === "annexe") return false;
  const t = a.trameId ? state.trames.find((x) => x.id === a.trameId) : null;
  if (t) return tramePublishable(t);
  return a.publishable !== false;
}
export const entityById = (id) => state.config?.entities?.find((e) => e.id === id);
export const personById = (id) => state.config?.people?.find((p) => p.id === id);
export const refById = (id) => state.config?.refs?.find((r) => r.id === id);
export const acteById = (id) => state.actes.find((a) => a.id === id);
