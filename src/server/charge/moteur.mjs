// ============================================================================
// LE MOTEUR DE CHARGE — des postes simulés, une horloge, des mesures.
//
// CE QU'IL FAIT. Il fait vivre N postes en parallèle. Chacun ouvre sa session,
// puis répète : un geste tiré de son profil (lecture du recueil, du registre,
// enregistrement d'un acte…), un temps de PENSÉE, et — toutes les 25 et 30
// secondes — le trafic que le poste émet sans que personne ne le touche (le
// battement de présence, le sondage du journal). Chaque appel est chronométré et
// rangé dans l'agrégat.
//
// CE QU'IL NE FAIT PAS. Il ne connaît ni HTTP, ni le service : `requete` et
// `ouvrirPoste` lui sont FOURNIS. C'est ce qui permet de l'éprouver sans réseau
// (tests) et de l'employer contre une vraie adresse (le client HTTP de
// `client.mjs`) comme contre un service lancé sur place (`charge.mjs`,
// `--sans-base`).
//
// LA MONTÉE (`monteeMs`) étale les ouvertures de session : à zéro, tous les
// postes se connectent dans la même seconde — c'est le cas le plus dur pour le
// service (le dérivé de mot de passe est coûteux), et celui qu'on veut pouvoir
// mesurer. À plusieurs secondes, on simule l'arrivée étalée d'une matinée.
// ============================================================================

import { creerAgregat, noter } from "./statistiques.mjs";
import { mulberry32, penser, tirerEtapes } from "./profils.mjs";

const rien = () => {};

export async function lancerCharge({
  plan,
  ouvrirPoste = async () => ({}),
  requete,
  contexte = {},
  dureeMs = 60000,
  penseeMs = 1500,
  graine = 1,
  monteeMs = 0,
  ecriture = "aucune",
  maintenant = () => Date.now(),
  dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
  doitContinuer = () => true,
  journal = rien,
  surPas = rien,
}) {
  const agregat = creerAgregat();
  const etapes = [];
  let n = 0;
  for (const entree of plan) {
    for (let i = 0; i < entree.effectif; i++) {
      n += 1;
      etapes.push({ index: n, profil: entree.profil, alea: mulberry32(graine * 7919 + n), memoire: {}, ecriture });
    }
  }
  const effectif = etapes.length;
  const debut = maintenant();

  async function jouerEtape(poste, e, contexte) {
    let demande = null;
    try { demande = e.construire(poste, contexte); } catch (err) { return; }
    if (!demande) return;
    const t0 = maintenant();
    let statut = 0;
    let octets = 0;
    let erreur = "";
    let corps = null;
    try {
      const r = await requete(poste, demande);
      statut = r && r.status ? r.status : 0;
      octets = (r && r.octets) || 0;
      corps = (r && r.json) || null;
      // Un 5xx est une PANNE du service (pas un refus de l'appelant) : on le
      // compte comme un échec, au même titre qu'une connexion perdue.
      if (statut >= 500) erreur = "service";
    } catch (err) {
      erreur = String((err && err.message) || err);
    }
    noter(agregat, { etape: e.nom, profil: poste.profil.id, ms: maintenant() - t0, statut, octets, erreur });
    if (e.apres && !erreur) {
      try { e.apres(poste, { status: statut, json: corps, octets }, contexte); } catch (err) { /* une étape n'apprend rien : sans conséquence */ }
    }
  }

  async function vivre(poste) {
    // La montée : le poste attend son tour avant d'ouvrir sa session.
    if (monteeMs > 0) {
      const ordre = (poste.index - 1) / Math.max(1, effectif - 1);
      await dormir(ordre * monteeMs);
    }
    // On charge la matière AVANT de bâtir les étapes : le poste sait alors sur
    // quoi il travaille (ses actes, ses trames).
    let profilEtapes = [];
    try { profilEtapes = poste.profil.etapes(contexte, { ecriture }) || []; } catch (err) { journal("profil " + poste.profil.id + " : " + err.message); }
    let fond = [];
    try { fond = poste.profil.fond(contexte, { ecriture }) || []; } catch (err) { /* fond facultatif */ }

    if (poste.profil.session) {
      const t0 = maintenant();
      try {
        const ouverture = await ouvrirPoste(poste);
        Object.assign(poste, ouverture || {});
        noter(agregat, { etape: "connexion/" + poste.profil.id, profil: poste.profil.id, ms: maintenant() - t0, statut: 200, octets: 0, erreur: "" });
      } catch (err) {
        noter(agregat, { etape: "connexion/" + poste.profil.id, profil: poste.profil.id, ms: maintenant() - t0, statut: 0, octets: 0, erreur: String((err && err.message) || err) });
        return;   // sans session, le poste ne peut rien faire : il s'arrête là.
      }
    }
    // Son ACTE : un par poste (chacun travaille sur le sien, comme un vrai
    // rédacteur). Le tourniquet évite que tous se disputent le même
    // enregistrement — la contention, elle, se mesure autrement (--force).
    if (contexte.actes && contexte.actes.length) poste.memoire.acte = contexte.actes[(poste.index - 1) % contexte.actes.length];

    const fin = debut + dureeMs;
    const dernier = new Map();
    while (maintenant() < fin && doitContinuer()) {
      for (const f of fond) {
        const t = dernier.get(f.nom) || debut;
        if (maintenant() - t < f.periodeMs) continue;
        dernier.set(f.nom, maintenant());
        for (const e of f.etapes) await jouerEtape(poste, e, contexte);
      }
      const e = tirerEtapes(profilEtapes, poste.alea);
      if (e) await jouerEtape(poste, e, contexte);
      surPas(agregat, debut);
      // Le temps de pensée, et À DÉFAUT un tour de boucle rendu à la boucle
      // d'événements. Sans cela, un poste « sans temps de pensée » (`--pensee 0`)
      // ne rendrait JAMAIS la main : enchaînant des promesses déjà résolues, il
      // garderait la file des micro-tâches pleine, et aucun minuteur ne
      // s'exécuterait plus — ni celui du service, ni celui de la campagne. Ce
      // n'est pas de la charge, c'est un blocage de l'outil : un vrai poste, lui,
      // laisse toujours passer un tour entre deux gestes.
      const pause = penser(penseeMs, poste.alea);
      await dormir(Math.max(0, pause));
    }
  }

  await Promise.all(etapes.map((p) => vivre(p)));
  const fin = maintenant();
  agregat.debut = debut;
  agregat.fin = fin;
  return { agregat, effectif, debut, fin, contexte };
}
