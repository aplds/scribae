---
titre: Registre des non-conformités — Scribae
version: 5
cree_le: 2026-09-21
mis_a_jour: 2026-09-30 (1.6.1r et 1.6.1s : NC-II-014 ouverte et levée aussitôt ; 1.6.1t et 1.6.1u : aucune fiche ouverte ; 1.6.1v : aucune fiche ouverte — le deadlock des écritures est corrigé et couvert par des épreuves ; 1.6.1w : aucune fiche nouvelle — la porte de signature de NC-II-006 est renforcée (le titulaire seul, porteur de la qualité) et son parcours complet est rejoué ; 1.6.1x : aucune fiche ouverte — le circuit de signature INTERNE est livré, et il apporte à NC-IV-001 sa première preuve dans l'autre sens ; les dates des notes 1.6.1u à 1.6.1w sont ramenées au 2026-09-26, la date d'une note étant celle de son achèvement ; 1.6.2 : aucune fiche ouverte — le travail à deux est livré (flux de changements `GET /v1/db/flux`, fusion des écritures concurrentes au lieu de l'écrasement, brouillons partagés par la présence), le contrat des deux services est rejoué, et son parcours gagne deux épreuves ; au passage, un défaut du service de démonstration est corrigé — ses billets de recueil échouaient en 500 dès le deuxième billet, `localeCompare` n'existant pas dans le moteur du service ; 1.6.3 : NC-IV-004 passée en LEVÉE — la télétransmission est RÉELLE quand le service est branché (`src/server/mysql/controle-legalite.mjs`, variables `SCRIBA_CONTROLE_LEGALITE_*`, `502 transmission_echec` sur refus, rien d'enregistré), la simulation restant marquée quand aucun appel n'a lieu ; NC-II-006 renforcée — la porte de signature est désormais tenue par le SERVICE (opposition opérateur / signataire, `attribution` vérifiée / déclarée / reprise / compilation, certification de conformité opposée au réviseur) ; 4e campagne d'audit (2026-09-27, version 1.6.3) : NC-IV-004 passée en LEVÉE (télétransmission réelle quand le service est branché), quatre fiches nouvelles — NC-I-017 (les deux copies ont divergé), NC-II-016 (court-circuit de la transmission par une `reference` fournie), NC-II-017 (aucune identité opposable sur le service de démonstration, statut ACCEPTÉE), NC-IV-006 (refus du contrôle de légalité non traités) — et l'historique des audits incrémenté ; 1.6.3a : NC-II-016 passée en LEVÉE — le champ `reference` non documenté qui court-circuitait la transmission au contrôle de légalité est remplacé par une DÉCLARATION nommée, datée et opposée à son auteur, documentée au contrat OpenAPI et journalisée (la transmission se règle désormais en TROIS RÉGIMES : désactivée, déclarative, ou API @ctes avec déclaration par acte) ; NC-II-017 atténuée — le service dit ce qu'il a pu ATTESTER (verifiee / declaree) et l'application ne présente plus comme vérifiée une déclaration simplement enregistrée) ; 1.6.3b : aucune fiche ouverte — la MÉTHODE de travail entre dans le dépôt (`src/docs/ATELIER.md`, le harnais `scripts/harnais-atelier.mjs`), aucune règle métier n'est touchée ; au passage, une affirmation devenue fausse est corrigée dans `README.md` et `docs/INDUSTRIALISATION.md` (le banc d'essai de l'atelier n'est plus « hors du dépôt ») ; 1.6.3c : cinq fiches passent en LEVÉE — NC-I-008 (les deux causes de la chaîne rouge sont corrigées, la chaîne publie son état et éprouve désormais l'IMAGE DOCKER contre une vraie MariaDB à chaque envoi), NC-I-017 (les deux copies sont réalignées par l'export, qui porte la version, le changelog et le registre d'un seul tenant), NC-II-010 (les empreintes de clés d'API se comparent à temps constant des trois côtés : `empreintesEgales` dans le domaine, `timingSafeEqual` au service, `egalConstant` en démonstration), NC-III-008 (la démonstration du projet pose `noindex, nofollow` sur sa seule adresse, et le documente), NC-IV-003 (la divergence ELI ↔ FRBRuri est fermée : FRBRthis porte l'identifiant, FRBRuri l'adresse HTTP dérivée, et le JSON-LD publie `eli:uri`) ; NC-IV-006 passe en OBSOLÈTE — le contrôle de légalité ne REFUSE pas un acte : un refus est un recours contentieux, que le logiciel suit par le délai de recours et la constatation d'un recours introduit (`src/lib/execution.js`), si bien qu'aucun état de dossier n'était à porter dans l'aller-retour de télétransmission ; NC-II-012 passe en ACCEPTÉE — l'aperçu d'édition n'est pas un environnement de démonstration tenable (il le dit), et l'état du service auto-hébergé, lui, vit en base (`sb_etat`) et dans ses fichiers ; deux défauts RÉELS sont corrigés au passage, trouvés en éprouvant la voie MySQL des pièces : la base en mémoire des épreuves ignorait `sb_piece` et rendait le résultat d'une écriture imbriqué d'un niveau de trop, si bien que `supprimerPiece` répondait toujours « rien retiré » ; la version du logiciel est désormais LUE dans `src/lib/version.js` par le script de publication d'image, qui la recopiait ; 1.6.3d : NC-I-008 repasse en RÉGRESSION — la chaîne a été OBSERVÉE sur l'envoi de la 1.6.3c (le travail « Image Docker » passe, les deux travaux d'épreuves échouent), sa première cause est nommée et corrigée (les épreuves lisaient leurs fichiers par un chemin relatif au dossier courant, or le travail « Service auto-hébergé » part de `src/server/mysql`), et la chaîne attache désormais chaque épreuve rouge en annotation publique, ce qui rend instruisable celle qui reste ; les cinq doublons `src/server/` sont retirés du dépôt ; 1.6.3d (suite) : NC-I-002 passe en LEVÉE — les parcours du navigateur sont rejoués dans la chaîne (`src/tests/parcours-navigateur.mjs`, travail `parcours`, 27/27 vérifiés dans l'aperçu) ; le découpage de NC-I-003 est commencé (`src/ui/views/signature-circuit.js`, `signature.js` de 3 994 à 3 566 lignes) ; le constat de performance « une lecture de collection coûte une dizaine d'ordres SQL » est RÉFUTÉ et figé par une épreuve — un seul ordre, de coût indépendant du nombre d'enregistrements ; 1.6.3e : aucune fiche ouverte — l'option d'éditer une trame se retrouve, sous un seul nom (« Éditer la trame », dans le menu « ⋯ » de la carte), et le guide reprend son illustration de la liste des modèles, qui montrait l'écran d'avant la revue d'interface ; 1.6.3f : aucune fiche ouverte — le bouton « ⋯ », seule porte vers les gestes rangés d'une carte, se perdait à l'écran (trois points d'un pixel, sans cadre, au bout d'une ligne, à droite d'un bouton principal plein) : il est redessiné en bouton (36 px de côté, cadre et fond, points plus gras, allumé tant que son menu est ouvert), et l'illustration du guide de la liste des modèles est refaite en conséquence — un geste qu'on ne trouve pas n'est pas un geste livré ; campagne visuelle du 2026-09-28 (version 1.6.3f, chapitre III) : neuf fiches ouvertes — NC-III-009 (majeure : 55 champs de formulaire sans nom accessible, l'étiquette visible n'étant pas associée au contrôle, cause unique à `src/ui/dom.js:190`), NC-III-010 à NC-III-014 (mineures : objet d'acte coupé sans attribut `title` à 69 endroits, vocabulaire et couleurs d'état divergents entre `ACTE_STATUTS` et la table de l'écran de signature, pastilles « i » et « ! » sans signification, contrastes sous le seuil sur la page publique et dans l'éditeur, structure de titres variable — 2 h1 ici, 0 là) et NC-III-015 à NC-III-017 (observations : cibles interactives sous 24 px, repères d'édition à 10,6 px, aide à la demande absente sur quatre écrans contre les vingt-trois annoncés par la doctrine) ; les mesures, écran par écran, sont dans `rapports/AUDIT-VISUEL-SCRIBAE-2026-09-28.md`) ; 1.6.3g : les NEUF fiches de la campagne visuelle (NC-III-009 à NC-III-017) passent en LEVÉE, chacune avec sa mesure, et l'arbitrage C10 (sans fiche) est tranché — les boutons de ligne de « Modifier un acte » repassent en secondaires ; la synthèse est recalculée sur les fiches et ne porte plus aucune fiche ouverte. ; 1.6.3h : aucune fiche ouverte — un contrôle en FLUX DE TRAVAIL (toutes les fonctionnalités, le recueil public et sa cohérence) a trouvé un défaut de la famille « une lecture en échec prise pour une lecture vide », corrigé dans le même lot SANS OUVRIR DE FICHE (défaut trouvé hors campagne, comme les ancres dupliquées de la 1.6.3g) : la règle est tenue une seule fois par src/lib/relecture.js, et le parcours « Les informations du recueil ne s'effacent pas » la garde. La synthèse reste donc sans fichier ouvert ; 1.6.3i : aucune fiche ouverte non plus — un AUDIT VISUEL COMPLET (les trente-trois écrans repris en images, découpés en bandes à résolution native pour l'œil et MESURÉS pour le reste) a trouvé deux informations cachées, de la famille de la 1.6.3h : le BANDEAU DE DÉMONSTRATION écrasé par la coquille bornée à la fenêtre (contenu 40 px dans une boîte de 32 px, seconde ligne « Ne pas produire d'actes réels… » coupée sur TOUS les écrans de l'atelier), et la rubrique « Informations » de l'accueil du recueil ABSENTE tant que la lecture n'avait pas conclu (le visiteur la voyait disparaître puis surgir). Les deux sont corrigés dans le même lot, hors campagne et sans ouvrir de fiche : `flex: none` sur `.app-demo` / `.app-vierge`, et la rubrique s'affiche dès le premier rendu en annonçant « Chargement des informations… » (une rubrique conclue VIDE reste, elle, absente). Un parcours nouveau — « Aucun écran ne rogne son contenu sans le dire » — garde la règle, et ses DENTS ont été éprouvées en rétablissant le défaut à la main (il échoue alors en nommant la mesure). L'audit a par ailleurs ÉCARTÉ, mesures à l'appui, ce que l'œil croyait voir — les « chevauchements » étaient des éléments en ligne passant à la ligne, les « textes coupés » des ellipses volontaires dont le texte entier est dans l'infobulle —, et n'a relevé aucun débordement horizontal sur les vingt-sept vues, ni à 874 px ni à 390 px. La synthèse reste donc sans fiche ouverte. ; 1.6.3j : aucune fiche ouverte — une VÉRIFICATION À LA DEMANDE (« les feuilles de style supportent-elles deux emblèmes en en-tête, un à gauche, un à droite, avec un positionnement réglable ? ») a éprouvé les QUATRE supports d'une charte (aperçu, HTML autonome, fichier Word, PDF/A) et trouvé trois défauts, tous corrigés dans le même lot : le PDF/A — le fichier ARCHIVÉ, celui qui fait foi — ne portait que l'emblème de gauche là où l'aperçu en montrait deux ; sa hauteur d'en-tête réservée était la SOMME de l'emblème et du texte, pourtant posés côte à côte, si bien que le filet de l'en-tête tombait environ un centimètre sous les marques ; le fichier Word empilait les deux marques à gauche, la seconde prenant la hauteur de la première. Trois réglages manquaient pour « positionner » (écart emblème-texte, place du texte ENTRE les deux emblèmes, alignement vertical des emblèmes) — et « Réglages remis aux valeurs par défaut » effaçait le second emblème. La preuve : la page 1 d'un PDF/A de contrôle RENDUE EN IMAGE et regardée, la mesure du vrai rendu dans un hôte hors écran, et un parcours nouveau (le trente-deuxième, `emblemes-entete`) dont les DENTS ont été éprouvées en retirant le rendu du second emblème (il échoue alors en nommant la mesure). La synthèse reste sans fiche ouverte ; **1.6.3k et 1.6.3l (2026-09-30) : aucune fiche NOUVELLE, mais NC-I-008 instruite jusqu'au bout** — la seconde cause du travail « Syntaxe, style et tests » est **nommée et corrigée** (le décodeur base64 **tolérant** de Node rendait lisible un scellé corrompu ; `lireScelle` exige désormais la ré-encodage identique), avec deux autres défauts de la chaîne (le chemin du guetteur d'échecs, ancré à `$GITHUB_WORKSPACE` ; le chemin de la suite de parcours, cherché dans les deux dispositions) — la fiche reste **ouverte** jusqu'à ce qu'un envoi soit VU VERT. **NC-I-003** (découpage des gros modules de vue) et **NC-IV-001** (signature qualifiée) restent **En cours**. L'état durable du service de l'aperçu s'écrit désormais en **double tampon** (la piste de NC-II-012 sur la perte d'état : deux copies, longueurs portées, index actif basculé d'un mot), et un service **MUET** (statut 0) n'est plus compté comme un écart de contrat — les parcours qui en dépendent se déclarent « sans objet », et le relevé porte `service.joignable` ; **1.6.3m (2026-09-30) : aucune fiche ouverte** — la démonstration **rattrape** ses publications (une **expression de date** qui porte la version du jeu, clé d'idempotence comprise, et la **publication informative d'un règlement** suit la même règle), et la charte de démonstration porte ses **deux emblèmes** ; NC-I-008 (en attente d'un envoi vu vert), NC-I-003 et NC-IV-001 restent dans leur état ; **1.6.3n (2026-09-30) : aucune fiche ouverte** — les **illustrations du guide** sont refaites sur l'interface actuelle (repères remesurés), et deux défauts trouvés en les posant sont corrigés et couverts : le **registre vide en accès direct** (`state.ui` manquant) et l'**horodatage brut** de la fiche (`formatDate` strict) ; **1.6.3o (2026-09-30) : aucune fiche ouverte** — la **recherche de l'entrée du recueil** prend toute la largeur (plus de plafond à 640 px), couverte par une épreuve.
cadre: src/audit/PROMPT-AUDIT-SCRIBAE.md
---

# Registre des non-conformités — Scribae

> **Document de travail.** Ce registre recense des non-conformités, dont certaines sont
> **encore ouvertes** : il ne se lit pas seul. Une fiche n'a de sens qu'avec son **statut**, sa
> **preuve** et les **propositions** de la campagne qui l'a établie, dans le cadre d'audit
> (`PROMPT-AUDIT-SCRIBAE.md`) qui définit ses termes. Pour un lecteur pressé : la **synthèse**
> ci-dessous, puis la synthèse et le plan d'action du **rapport le plus récent** (`rapports/`).
> Les fiches se lisent ensuite, une par une.

Registre **cumulatif**. Une entrée ne se supprime jamais ; son **statut** évolue. Les
identifiants sont stables d'un audit à l'autre : une non-conformité garde le sien tant
qu'elle n'est pas levée.

Statuts : `Ouverte` · `En cours` · `Levée` (avec date et preuve) · `Régression` (une
non-conformité levée réapparaît) · `Acceptée` (risque explicitement assumé, par qui et
pourquoi) · `Obsolète` (le périmètre a disparu, avec justification).

Cotation : `Bloquante` · `Majeure` · `Mineure` · `Observation` (voir
`PROMPT-AUDIT-SCRIBAE.md` §6.1).

> **Confidentialité.** Ce registre ne recopie ni donnée à caractère personnel réelle, ni
> secret (jeton, clé, mot de passe). Les secrets aperçus dans le code sont désignés par
> leur **emplacement** (`fichier:ligne`), jamais par leur valeur.

---

## Synthèse

| Cote | Nombre | Ouvertes | En cours | Levées | Régressions | Acceptées | Obsolètes |
|---|---|---|---|---|---|---|---|
| Bloquante | 3 | 0 | 0 | 3 | 0 | 0 | 0 |
| Majeure | 16 | 0 | 1 | 14 | 1 | 0 | 0 |
| Mineure | 18 | 0 | 1 | 16 | 0 | 0 | 1 |
| Observation | 16 | 0 | 0 | 14 | 0 | 2 | 0 |
| **Total** | **53** | **0** | **2** | **47** | **1** | **2** | **1** |

> **État au 2026-09-28 (livraisons 1.6.3d à 1.6.3g, puis campagne visuelle corrigée).** La **campagne
> visuelle** du 2026-09-28 (version 1.6.3f, `rapports/AUDIT-VISUEL-SCRIBAE-2026-09-28.md`) avait
> ouvert **neuf fiches** d'interface — **NC-III-009** (les étiquettes de formulaire ne nomment pas
> 55 champs, majeure), **NC-III-010** à **NC-III-014** (objet d'acte coupé sans recours,
> vocabulaire d'état multiple, pastilles « i »/« ! », contrastes, structure des titres) et
> **NC-III-015** à **NC-III-017** (cibles sous 24 px, repères d'édition à 10,6 px, aide à la demande
> absente sur quatre écrans). **La livraison 1.6.3g les lève toutes les neuf**, chacune avec sa
> mesure, et **l'arbitrage C10** (sans fiche) est tranché dans le même lot : relevé sur 27 routes
> (1 440 × 900, compte administrateur) — **0** champ sans nom, **0** coupure sans `title`,
> **1 `h1`** par écran, **0** texte sous le seuil de contraste, plancher de **13 px**, **0**
> débordement ; les boutons de ligne de « Modifier un acte » repassent en secondaires (**72 → 3**
> boutons principaux). Le registre ne porte donc plus aucune fiche ouverte. Le relevé de clôture a
> de plus trouvé un défaut que la campagne tenait pour conforme — des **ancres de titres
> dupliquées** sur l'écran Documentation —, corrigé dans le même lot **sans ouvrir de fiche**
> (défaut d'interface trouvé hors campagne, comme la relecture de la 1.6.1m). Le **thème sombre** a
> été remesuré sur les 27 routes — le rapport disait ne pas l'avoir fait : **0** texte sous le seuil
> après correction (deux contrastes y tombaient sur des fonds de marque clairs, voir la fiche
> NC-III-013).
> Par ailleurs, **une régression** demeure :
> la chaîne d'intégration est **toujours rouge** (**NC-I-008**). Ce n'est pas un oubli : elle a été
> **observée** sur l'envoi de la 1.6.3c — le travail « Image Docker » **passe**, les deux travaux
> d'épreuves échouent —, sa **première cause** est nommée et corrigée, et la chaîne **nomme
> désormais elle-même** les épreuves qui lâchent (annotations publiques). Les deux restées
> « en cours » sont celles qui demandent ce que le logiciel ne peut pas fournir seul : le
> **découpage** des derniers gros modules de vue (**NC-I-003**, dont la **présentation du circuit de
> signature** est désormais extraite dans `src/ui/views/signature-circuit.js`) et une signature
> **qualifiée** (**NC-IV-001** : un contrat avec un prestataire, pas du code). **NC-I-002 passe en
> LEVÉE** : les **parcours du navigateur** sont rejoués dans la chaîne (travail `parcours`, un vrai
> Chromium, 29 parcours). Les deux « acceptées » sont des limites **nommées** : le démonstrateur ne peut rien
> vérifier de l'identité d'une personne (NC-II-017), et l'aperçu d'édition n'est pas un
> environnement de démonstration tenable (NC-II-012).
>
> **Les trois fiches NC-I-015, NC-I-016 et NC-II-015 viennent d'une autre lignée** : elles ont été
> établies par une campagne menée sur le dépôt publié (rapport du 2026-09-30), dont le registre a
> depuis été **recouvert** ; NC-I-017 raconte l'arbitrage et la reprise. Le passage de 41 à 44
> fiches vient de là, et de là seulement.

> **Note 1.6.3h — aucune fiche ouverte non plus.** Un **contrôle en flux de travail** (toutes les
> fonctionnalités, le recueil public et sa cohérence, demandé après la campagne visuelle) a
> reproduit puis corrigé un défaut de la famille « une lecture en échec prise pour une lecture
> **vide** » : la rubrique **Informations** du recueil public s'effaçait alors que des billets
> étaient publiés au poste, et ne revenait qu'au rechargement de la page (même défaut latent sur le
> registre des publications de l'atelier, les décisions publiées des délégations, le bulletin, et
> la résolution des liens ELI). La règle est tenue **une seule fois** (`src/lib/relecture.js`), le
> défaut est corrigé dans le même lot **sans ouvrir de fiche** — trouvé **hors campagne**, comme
> les ancres de titres dupliquées de la 1.6.3g —, et il est tenu par l'épreuve
> `src/tests/relecture.test.mjs` et par le parcours « Les informations du recueil ne s'effacent
> pas, et se réparent » (le **trentième**). La synthèse reste donc **sans aucune fiche ouverte**.

> Les nombres de cette synthèse sont **recalculés sur les fiches** à chaque campagne *et* à chaque
> traitement d'une proposition du plan d'action. Le premier traitement du 2026-09-23 (livraison
> 1.6.1c) a porté quatre fiches en « Levée » (NC-I-009, NC-II-013, NC-III-005 et NC-III-007, dont la
> régression est réparée) et trois en « En cours » (NC-I-002, NC-I-008, NC-III-008). Le **second
> traitement**, le même jour (livraisons 1.6.1e à 1.6.1k), a porté trois fiches de plus en « Levée »
> (NC-I-001, NC-I-004, NC-I-010) et une en « En cours » (NC-I-003, dont le constat n'est qu'en partie
> traité) ; il a aussi rafraîchi NC-I-002, NC-IV-001 et NC-IV-004, sans changer leur statut. Aucune
> fiche ne porte plus le statut « Régression ». La livraison **1.6.1l** (rangement des données par
> fichiers, chats des pages d'erreur) n'a **changé aucun statut** : elle ajoute des capacités
> optionnelles sans toucher aux constats de la 3e campagne. Elle a en revanche corrigé une phrase
> d'`ADMINISTRATION.md` restée fausse depuis la 1.6.1j (elle disait que le service auto-hébergé ne
> rendait pas les renvois ni les mentions du recueil) : c'est une correction de documentation, et
> aucun identifiant n'a été ouvert pour cela. La livraison **1.6.1m** (le **fil de parcours** :
> `src/lib/parcours.js`, `src/ui/parcours.js`, monté sur cinq écrans ; les **annexes** écartées de
> la file « Ma signature » et étiquetées « Annexe — ne se signe pas ») n'a **changé aucun statut**
> elle non plus : elle répond à deux constats d'usage et ne touche à aucun des constats de la 3e
> campagne. Elle porte en revanche le parc de tests à **286 épreuves sur 25 fichiers** (chacune
> verte, chaque fichier éprouvé **isolément**), et ajoute `src/tests/parcours.test.mjs` (8
> épreuves). Une **relecture écran par écran**, demandée après la livraison, a corrigé trois
> défauts d'affichage de la même famille — une porte **passée sans être franchie** (acte signé et
> publié sans trace de révision) était montrée comme la porte *ouverte*, la note du fil s'isolait
> à droite, et le maillon « › » pouvait se retrouver seul en tête de ligne ; ces défauts sont
> d'INTERFACE, et hors du périmètre des quatre regards de la campagne : aucun identifiant n'a été
> ouvert pour eux. Les mentions « 255 épreuves sur 22 fichiers » que portent les fiches
> **NC-I-001** et **NC-I-003**
> décrivent l'état au moment de la livraison **1.6.1k** et sont datées comme telles ; la présente
> note donne l'état courant, et les fiches ne sont pas réécrites pour autant. La livraison **1.6.1n**
> (les réglages de l'**annuaire OIDC** partout : les quatre cartes de l'onglet « Annuaire »
> proposées dans **tous** les modes, la case « proposer AUSSI la connexion par l'annuaire »
> — la *seconde porte* —, la **publication** de la configuration d'annuaire par le service dans
> `GET /v1/auth/config`, et les **22 variables `SCRIBA_ANNUAIRE_*`** du `.env`) n'a **changé aucun
> statut** elle non plus : elle répond à un constat d'usage (aucun moyen de brancher un OIDC depuis
> l'interface ou le `.env`) et ne touche à aucun des constats de la 3e campagne. Elle porte en
> revanche le parc de tests à **300 épreuves sur 26 fichiers** (chacune verte, chaque fichier
> éprouvé **isolément**), et ajoute `src/server/mysql/annuaire.test.mjs` (6 épreuves). La limite
> qu'elle assume — une session d'annuaire n'ouvre pas la porte des données d'un service à **session**
> (l'échange du jeton d'annuaire contre une session de service reste au programme) — est consignée
> au `TODO.md` plutôt qu'ici : elle relève d'un périmètre futur, et non d'un constat de la campagne. La
> livraison **1.6.1o** (la façade sert enfin les modules `.mjs`) n'a **changé aucun statut** elle non
> plus : c'est un défaut d'**exploitation**, découvert hors campagne — la table des types d'nginx ne
> connaît pas l'extension `mjs` et la servait en `application/octet-stream`, que le navigateur refuse
> pour un module ES : le graphe d'imports cassait et la page restait **blanche**, sans autre indice
> que la console. Il est désormais **tenu par une épreuve** : `src/tests/industrialisation.test.mjs`
> confronte les extensions importées par le client à ce que la façade déclare servir. Le parc de
> tests passe à **301 épreuves sur 26 fichiers** (dont une nouvelle, sautée là où le dépôt n'est pas
> lisible).

> La livraison **1.6.1p** (le service devient le client OIDC : découverte, échange du code,
> vérification du jeton et ouverture de SA session — l'échange du jeton d'annuaire contre une session
> de service, jusqu'ici inscrit au `TODO.md`, est donc **fait**) n'a **changé aucun statut** : elle
> ferme une limite assumée et répond à un constat d'exploitation (« Découverte impossible (Failed to
> fetch) », causé par le CORS du fournisseur), sans toucher aux constats de la 3e campagne. La limite
> qu'elle ferme était consignée ici comme relevant d'un périmètre futur : elle est désormais
> **tenue par des épreuves** (`annuaire-service.test.mjs`, `jws.test.mjs`, et la concordance des deux
> implémentations dans `src/tests/purs.test.mjs`). Cette note a d'ailleurs été l'occasion d'un
> **défaut de câblage** : le drapeau `annuaireService`, publié par le service, n'était pas transmis au
> client par `chargerModeDeploiement` (non plus que `comptesLocaux`, `session` et `adminPanne`) — le
> client se croyait donc devant un service antérieur, et le symptôme d'origine subsistait, service à
> jour. Corrigé, et désormais tenu par une épreuve qui confronte **les champs que le client lit du
> service** à ceux qu'il lui transmet. La même passe a fermé deux autres constats du même genre — un
> constat de la fiche **NC-I-002** et un écart de documentation : l'**analyse statique** refuse
> maintenant les *imports jamais employés* (`src/scripts/analyse-imports.mjs`, éprouvé ; dix-neuf
> fichiers en portaient quarante et une mentions), et `RATE_MAX_CONNEXIONS` — décrite au wiki,
> absente des deux modèles de `.env` — a sa ligne dans `src/server/mysql/env.example`, avec une
> épreuve qui tient la règle « un descripteur, une ligne dans `env.example` » pour tout le registre.

> La livraison **1.6.1q** (l'outillage prend ses quartiers à la racine du dépôt) ferme **une
> fiche : NC-I-007** passe en « Levée » — l'outillage vit désormais là où un intégrateur, une
> forge et un agent le cherchent (`scripts/`, `tests/`, `package.json`, `.github/workflows/ci.yml`),
> le code restant sous `src/`. Elle ne répond à aucun constat de la 3e campagne, mais elle ferme
> précisément le décalage qui avait **désarmé les exemptions du contrôle de style** (NC-I-009), et
> elle ajoute ce qu'il faut pour qu'un agent reprenne le dépôt sans le casser : `AGENTS.md`,
> `CLAUDE.md`, `tests/README.md`, et un manifeste dont les commandes partent de la racine. Avant
> livraison, l'outillage a été **éprouvé dans les deux dispositions** (livrée et atelier) : 210
> fichiers analysés par le contrôle de style, aucune remarque, en mode ordinaire comme en mode
> strict, et les 346 épreuves de 28 fichiers, chacune verte, chaque fichier éprouvé isolément. Le
> parc d'épreuves est donc **inchangé** — cette livraison range, elle n'ajoute pas de règle.
> Le parc passe à **346 épreuves sur 28 fichiers**
> (11 sautées là où le dépôt n'est pas lisible ou `node:crypto` est incomplet), et `comptes.test.mjs`
> passe de 27 à **39 épreuves**.

> La livraison **1.6.1r** (un **exemple de déploiement** à la racine du dépôt : `compose-exemple/`,
> deux services et trois commandes, rien à construire) n'a **changé aucun statut** : elle ne touche à
> aucun des constats de la 3e campagne.

> La livraison **1.6.1s** — la **reprise des actes anciens** — ouvre **une fiche, NC-II-014**, et la
> porte aussitôt en « **Levée** ». Le défaut n'est pas venu de la campagne mais du travail lui-même :
> en ajoutant la collection `reprises` au magasin **local** du navigateur (`src/lib/db/local.js`), il
> est apparu que la table des dossiers ne déclarait **pas** `informations` (présente depuis la
> 1.5.3) : le proxy de stockage range une collection sous le nom de sa propriété, si bien que toute
> collection non déclarée écrivait dans le **même dossier partagé** (`undefined`). `informations` y
> vivait donc, et `reprises` aurait écrit **par-dessus**. Le dossier de chacune est désormais déclaré,
> `dossierDe()` ne renvoie plus d'alias pour une collection inconnue (repli en mémoire seulement), et
> les données héritées sont reprises une fois, sans perte. La fiche porte le constat, la preuve et la
> recommandation — c'est un écart de **fiabilité** (intégrité des données locales) qu'un audit aurait
> relevé tôt ou tard, et il est désormais tenu par une épreuve. Le parc de tests passe à **358
> épreuves sur 29 fichiers** (11 sautées là où le dépôt n'est pas lisible), chacune verte, chaque
> fichier éprouvé isolément — dont `src/tests/reprise.test.mjs` (9 épreuves) et deux épreuves de plus
> pour le service (`src/server/mysql/actes.test.mjs`).

> La livraison **1.6.3** — les **accès API réels**, et la signature qu'on ne peut pas prendre —
> porte **une fiche en « Levée »**, **NC-IV-004** : la télétransmission au contrôle de légalité
> n'est plus simulée quand le service est branché (`src/server/mysql/controle-legalite.mjs`, un vrai
> `POST` vers l'API d'envoi du `.env`, la clé restant au serveur, un refus rendant `502
> transmission_echec` sans rien enregistrer) ; la simulation, quand aucun appel n'a lieu, reste
> **marquée** (`demonstration: true` et sa réserve). Elle **renforce NC-II-006** sans le rouvrir : la
> porte de signature est désormais tenue par le **SERVICE** (`porteSignature`, opposition opérateur /
> signataire dès que le service identifie les personnes, `403 signature_non_habilitée` sinon), la
> **certification de conformité** est opposée de même au réviseur, et la reprise comme la compilation
> — qui ne sont pas des signatures — sont **réservées à l'administration** avec leur attribution
> (`reprise` / `compilation`). Elle ne change le statut d'aucune autre fiche, et n'en ouvre aucune :
> ce qui reste — les **refus du contrôle de légalité** (rejet, demande d'observations) — est un
> périmètre futur, consigné au `TODO.md`. Épreuves ajoutées : `controle-legalite.test.mjs` (9) et
> cinq cas d'`actes.test.mjs` ; le parcours gagne **`signature-hors-competence`** (26e), qui balaie
> les **759 paires** acte × compte et vérifie qu'aucun bouton de signature ne s'offre hors
> compétence.

> **4e campagne d'audit (2026-09-27, version 1.6.3).** Elle porte **NC-IV-004 en « Levée »** (la
> télétransmission est réelle quand le service est branché) et **renforce NC-II-006** (la porte de
> signature est tenue par le service, non plus seulement par l'interface). Elle ouvre **quatre
> fiches** : **NC-I-017** (la copie de travail et la copie publiée ont divergé — versions,
> changelogs et registres d'audit différents ; Majeure), **NC-II-016** (la formalité de
> télétransmission se court-circuite par une `reference` fournie ; Mineure), **NC-II-017** (sur le
> service de démonstration, aucune identité ne peut être opposée au signataire — limite **Acceptée**
> du démonstrateur ; Observation) et **NC-IV-006** (les refus du contrôle de légalité ne sont pas
> traités, et le client n'a jamais parlé à une vraie passerelle ; Mineure). Le rapport est
> `rapports/AUDIT-SCRIBAE-2026-09-27.md`.

> La livraison **1.6.3a** — la **transmission au contrôle de légalité se règle en trois régimes** —
> ferme **une fiche : NC-II-016** passe en « Levée ». Le champ `reference` non documenté, qui
> permettait à un appel direct de fabriquer un certificat simulé **sans aucun appel** et de lever
> ainsi la porte de publication, est **retiré**. Il est remplacé par une **déclaration** — nommée,
> datée, portant son auteur et un motif facultatif —, exigée pour publier un acte soumis à la
> formalité, **documentée au contrat OpenAPI des deux services**, et **opposée à son auteur** par le
> service quand il identifie les personnes (`403 declaration_non_habilitée`) comme à la liste des
> réviseurs de l'acte. Le même chantier répond à l'instruction « trois voies possibles » : la
> transmission est **désactivée**, **déclarative** (un réviseur atteste, avant publication, à qui et
> à quelle date — aucun appel sortant), ou **par API @ctes** — chaque acte pouvant en outre être
> déclaré. La fiche NC-II-016 garde son constat et sa preuve ; seule sa **recommandation** (nommer ou
> retirer le champ) est satisfaite, et par sa première branche. Ce qui reste de NC-IV-006 — les
> **refus** du contrôle de légalité — reste ouvert, consigné au `TODO.md`. Au passage, **NC-II-017** (limite acceptée du démonstrateur) est **atténuée dans ses effets** : le service dit ce qu'il a pu attester (`attribution: "verifiee"` quand il oppose la déclaration à l'opérateur, `"declaree"` quand il ne le peut pas), et l'application cesse de présenter comme vérifiée une déclaration qu'il n'a pu qu'enregistrer — la limite demeure (le démonstrateur n'identifie pas les personnes), mais elle ne se déguise plus en garantie. Épreuves ajoutées :
> `controle-legalite.test.mjs` (9) et deux cas d'`actes.test.mjs` (32).

## Historique des audits

| Date | Rapport | Auditeur | Version outil | NC ouvertes | NC levées | NC nouvelles |
|---|---|---|---|---|---|---|
| 2026-09-21 | `rapports/AUDIT-SCRIBAE-2026-09-21.md` | Audit initial (quatre regards : DSI, RSSI, qualiticien, DAJ) | 1.2.0 | 0 | 0 | 27 |
| 2026-09-21 | `rapports/AUDIT-SCRIBAE-2026-09-21b.md` | Audit 2e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), parcours par l'interface | 1.2.0 | 6 | 18 | 3 |
| 2026-09-23 | `rapports/AUDIT-SCRIBAE-2026-09-23.md` | Audit 3e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), dépôt GitHub, démonstration publiée et chaîne d'intégration | 1.6.0 | 16 | 0 | 6 |
| 2026-09-27 | `rapports/AUDIT-SCRIBAE-2026-09-27.md` | Audit 4e campagne (quatre regards : DSI, RSSI, qualiticien, DAJ), accès réseau réels et porte de signature (interface et service) | 1.6.3 | 11 | 1 | 4 |

---

# Fiches

## Chapitre I — Systèmes d'information (DSI)

### NC-I-001 — Aucun test automatisé du code client

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Environnements, tests, industrialisation |
| Constat | Le code de l'application (`main.pjs`, `index.html`, 124 fichiers sous `src/`, ~66 400 lignes) n'a **aucun test automatisé**. Seuls deux fichiers de tests existent, et ils ne couvrent que le service auto-hébergé : `src/server/mysql/comptes.test.mjs`, `src/server/mysql/actes.test.mjs`. Aucun test ne couvre la compilation, les exports, la numérotation, les délais, la signature, la persistance ou les vues. |
| Exigence de référence | ISO/IEC 25010 (maintenabilité, fiabilité) ; ISO/IEC 25040 (évaluation) ; bonne pratique d'industrialisation. |
| Preuve | Recherche `*.test.*` / `*.spec.*` : deux occurrences, toutes deux sous `src/server/mysql/` (`package.json` déclare `"test": "node --test"`). Aucun test sous `src/lib/` ni `src/ui/`. |
| Recommandation | Introduire une base de tests exécutables hors navigateur sur les modules **purs** (`src/lib/compile.js`, `expr.js`, `execution.js`, `numbering.js`, `eli.js`, `akn.js`, `export.js`, `amend.js`), puis des tests de bout en bout sur les parcours. Voir proposition P-03. |
| Effort | Élevé (chantier progressif) |
| Priorité | Haute |
| Échéance | 90 jours (base), au-delà (couverture complète) |
| Statut | **Levée** (2026-09-23, livraisons 1.6.1e à 1.6.1k) — le code client est désormais éprouvé : **22 fichiers de tests, 255 épreuves**, chacune verte, chaque fichier éprouvé **isolément** (comme `node --test`), auxquels s'ajoutent les **épreuves de parcours** (navigateur, `src/tests/parcours.mjs`) et le **jeu d'appels de conformité** commun aux deux services (`src/tests/conformite-service.mjs`, voir NC-I-010). Les cinq échecs de `src/server/mysql/actes.test.mjs` relevés pendant la campagne n'étaient pas un défaut du domaine mais **de l'épreuve** : elle lisait `.body` sur la promesse rendue par un gestionnaire asynchrone (l'ouverture du circuit de signature), sans l'attendre — l'épreuve est corrigée, et le cas est désormais documenté (`docs/INDUSTRIALISATION.md` §2). **Réserve explicite** : les parcours ne tournent pas **en intégration continue** (aucun moteur de navigateur dans la chaîne) — ils se rejouent à la main dans l'aperçu de l'atelier ; ce reste est suivi par NC-I-002 et NC-I-008. |
| Origine | Audit 2026-09-21 |

### NC-I-002 — Aucune chaîne d'intégration/déploiement, aucune analyse statique, aucun verrou de dépendances

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Industrialisation ; I.4 — Chaîne d'approvisionnement |
| Constat | Aucun fichier d'intégration continue (`.github/` absent), aucun linter/formateur (`.eslintrc`, `tsconfig`, `.editorconfig` absents), aucun `package-lock.json`. Le `Dockerfile` du service exécute `npm install --omit=dev` sans verrou, et la dépendance est déclarée en plage (`mysql2: "^3.11.3"`). Les images de base sont des **étiquettes flottantes** (`node:20-alpine`, `mariadb:11`, `nginx:alpine`), sans empreinte. Deux développeurs ou deux dates peuvent donc produire deux artefacts différents. |
| Exigence de référence | ISO/IEC 27002 (gestion des dépendances, maîtrise des changements) ; bonne pratique de reproductibilité des livraisons. |
| Preuve | Absence de `.github/`, `package-lock.json`, `.eslintrc*`, `tsconfig*` (inventaire du dépôt) ; `src/server/mysql/Dockerfile:5` (`FROM node:20-alpine`) ; `src/server/mysql/package.json` (`"mysql2": "^3.11.3"`) ; `src/server/docker-compose.yml` (`image: mariadb:11`, `image: nginx:alpine`). |
| Recommandation | Ajouter un pipeline minimal (lint + `node --test`), committer le `package-lock.json`, épingler les images par digest, fixer les étiquettes de dépendances. Voir P-03. |
| Effort | Moyen |
| Priorité | Haute |
| Échéance | 90 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3d) — les trois livrables du constat sont en place, et **éprouvés par une exécution réelle de la chaîne** (quatre envois observés, `GET /actions/runs`). Surtout, ce qui manquait **à cette fiche** — un moteur de navigateur dans la chaîne — est livré : `src/tests/parcours-navigateur.mjs` rejoue les **29 parcours** dans un vrai Chromium (serveur de fichiers local, applications montées en édition statique, session d'administration, verdict + annotations `::error::` + capture d'écran en artefact), et le travail `parcours` de `src/github/ci.yml` l'exécute — **avisant**, pour ne pas ajouter de rouge à une chaîne qui l'est déjà par ailleurs (NC-I-008). Vérifié dans l'aperçu : **29/29** sur un profil vierge. La **rougeur** de la chaîne n'est pas le sujet de cette fiche : elle est suivie par NC-I-008. Journal de la fiche : (2026-09-23 ; revu après traitement de P-31 et P-32, puis après les livraisons 1.6.1e à 1.6.1p) — le **verrou de dépendances est livré** : `src/server/mysql/package-lock.json` (12 paquets, versions épinglées, empreintes SHA-512 **vérifiées contre les archives réellement retirées** du registre npm), et la chaîne comme les `Dockerfile` installent par `npm ci`. Les deux causes de la chaîne rouge sont identifiées et corrigées (voir NC-I-008). Le parc de tests est passé à **255 épreuves sur 22 fichiers** (voir NC-I-001). L'**analyse statique est livrée** (1.6.1p) : `src/scripts/verifier-style.mjs` refuse `debugger`, les `var`, les traces de client, et désormais les **imports jamais employés** (`src/scripts/analyse-imports.mjs`, éprouvé dans `src/tests/purs.test.mjs`) — **aucun outil tiers**, c'est un choix d'approvisionnement (voir INDUSTRIALISATION §4). Reste à constater une exécution **réelle** de la chaîne, ce qui demande un envoi sur le dépôt. À noter : la dépendance était déjà épinglée (`mysql2: "3.11.3"`, sans plage) ; la preuve du constat ci-dessus citait `"^3.11.3"`, qui n'est plus l'état du fichier. **Observation (2026-09-28, 1.6.3d)** : les cinq doublons `src/server/` ont été **retirés du dépôt** (par le `git rm` de la recette d'export ; `GET /git/trees/main?recursive=1` ne les porte plus), et le manifeste racine comme son verrou sont en place. La chaîne a été **exécutée** (quatre envois), et la présente livraison y ajoute le **quatrième** livrable attendu : les parcours du navigateur. L'exécution **mécanique** est donc constatée ; sa **réussite** reste à obtenir, et c'est NC-I-008. |
| Origine | Audit 2026-09-21 |

### NC-I-003 — Fichiers monolithiques : la reprise par un tiers est freinée

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | I.2 — Qualité et lisibilité du code ; I.8 — Documentation et reprise |
| Constat | Plusieurs fichiers concentrent une part disproportionnée de la matière : `src/css/app.css` (3 146 lignes), `src/ui/views/signature.js` (3 135 lignes), `src/SPEC.md` (2 702 lignes), `src/README.md` (2 672 lignes), `src/lib/seed.js` (2 455), `src/ui/views/rediger.js` (2 196), `src/ui/views/editor.js` (2 137), `src/lib/demo-actes.js` (2 033), `src/ui/views/referentiel.js` (2 009). La documentation de référence est un **unique** `README.md` de ~215 Ko, qui mêle mode d'emploi, doctrine, recettes d'exploitation et notes de conception. |
| Exigence de référence | ISO/IEC 25010 (maintenabilité : modularité, analysabilité) ; objectif de reprise par une équipe sans l'auteur (question directrice I). |
| Preuve | Inventaire `wc` du dépôt (`src/README.md` 2 672 lignes / ~214 Ko ; `src/SPEC.md` 2 702 / ~196 Ko ; `src/css/app.css` 3 146 ; `src/ui/views/signature.js` 3 135). |
| Recommandation | Scinder la documentation en un `README.md` d'entrée + des documents thématiques (`ARCHITECTURE.md`, `EXPLOITATION.md`, `DOCTRINE.md`), et découper les gros modules de vue en sous-composants. Voir P-04. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **En cours** (2026-09-23, livraisons 1.6.1e à 1.6.1k ; revu le 2026-09-28, livraison 1.6.3d) — le constat est **en partie** traité : `src/css/app.css` (3 609 lignes) n'est plus un monolithe mais une **entrée de dix `@import`** vers dix parties (`src/css/app-*.css`, chacune avec son en-tête ; découpage vérifié octet à octet contre l'ancien fichier), et `src/docs/REPRISE.md` détache la reprise du reste de la documentation. Restent volumineux : `src/README.md` 3 926 lignes, `src/SPEC.md` 3 845, `src/ui/views/referentiel.js` 3 418, `src/ui/views/signature.js` 3 566. **1.6.3d — le découpage est commencé** : la **présentation du circuit de signature** — les marches, leurs états, leurs dates et empreintes, et le vocabulaire de publication qui les intitule (`statusBadgeEl`, `defaultCircuitActe`, `stepEl`, `etapesCircuit`, `etapesExterne`, `etapesSimple`, `destinatairesAdministration`, `tailleLisible`, `pubNonJuridique`…) — a quitté `src/ui/views/signature.js` pour `src/ui/views/signature-circuit.js` (454 lignes, dont l'en-tête dit ce qui y vit et ce qui n'y vit pas). `signature.js` passe de **3 994 à 3 566 lignes** (−427) ; les GESTES (envoyer en signature, signer, publier) y restent. Aucun cycle d'imports n'a été introduit. Filets : 240 fichiers sans faute de syntaxe, aucune remarque de style, 448/459 épreuves vertes, et les **trois circuits** (simple, interne, externe) rendus à l'écran dans l'aperçu. Le reste de `signature.js` et `referentiel.js` restent à découper. |
| Origine | Audit 2026-09-21 |

### NC-I-004 — Une même règle implémentée trois fois (partie publique de l'original, empreinte)

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | I.1 — Architecture ; I.2 — Duplication |
| Constat | La règle « la part publique d'un original signé est le paquet privé de son dossier interne et des mentions nominatives » est écrite **trois fois**, indépendamment : `sansInterne()` dans `index.html` (service de démonstration), `sansInterne()` dans `src/server/mysql/actes.mjs`, et `partiePublique()` dans `src/lib/signature.js`. Chacune supprime la même liste de champs. De même, SHA-256 synchrone est défini deux fois (`sha256Hex` dans `index.html`, `sha256Hex` dans `src/lib/signature.js`). |
| Exigence de référence | Principe DRY ; ISO/IEC 25010 (maintenabilité : modifiability). |
| Preuve | `index.html` (`function sansInterne`), `src/server/mysql/actes.mjs` (`sansInterne`), `src/lib/signature.js` (`export function partiePublique`). |
| Recommandation | Extraire un module « original signé » unique, partagé (généré/recopié à l'identique côté serveur), et une seule implémentation d'empreinte. Voir P-04. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-23, livraison 1.6.1k) — la règle « part publique d'un original signé » a désormais **un seul point de vérité** : `src/server/mysql/original-signe.mjs` (`CHAMPS_INTERNES`, `sansInterne`, `partiePublique`), importé par `src/lib/signature.js` (qui ré-exporte `partiePublique`) et par `src/server/mysql/actes.mjs` (les implémentations locales sont supprimées). La copie du service de démonstration (`index.html`) ne peut plus dériver : `src/tests/original-signe.test.mjs` (5 épreuves) extrait `sansInterne`/`sha256Hex` (plus `utf8Bytes` et `K256`) de `index.html` et les compare au module partagé et à `node:crypto`. Le module est rangé sous `src/server/mysql/` et non `src/lib/` à dessein : le contexte Docker du service n'embarque que ce dossier. |
| Origine | Audit 2026-09-21 |

### NC-I-005 — Nommage ambigu et propriété intellectuelle non définie

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | I.2 — Lisibilité ; I.5 — Gouvernance du code |
| Constat | Deux modules voisins portent des noms quasi identiques pour des objets sans rapport : `src/lib/revision.js` (circuit de **révision** d'un acte avant signature) et `src/lib/revisions.js` (historique des brouillons). Par ailleurs, aucun fichier `LICENSE` n'est présent : la documentation (`src/docs/GITHUB.md`, section « Licence ») indique « tous droits réservés au propriétaire du dépôt », sans préciser les droits sur le code **produit par l'IA**. |
| Exigence de référence | Bonne pratique de gouvernance ; question directrice I (« propriété intellectuelle du code produit par l'IA »). |
| Preuve | `src/lib/revision.js` (exports `peutReviser`, `demanderRevision`, `validerRevision`…) et `src/lib/revisions.js` (exports `ajouterRevision`, `restaurerRevision`) ; absence de `LICENSE` ; `src/docs/GITHUB.md` section « Licence ». |
| Recommandation | Renommer l'un des deux modules (`historique-brouillons.js`), et statuer par écrit sur la licence et sur les droits attachés au code généré. Voir P-04 et P-12. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — la licence est tranchée (`src/LICENSE.md` : GPL-3.0 pour le logiciel, Licence Ouverte 2.0 pour les données) et `src/docs/GITHUB.md` est réaligné ; `src/lib/revisions.js` est renommé `src/lib/historique-brouillons.js` (imports et documentation suivis), ce qui lève l'ambiguïté avec `src/lib/revision.js`. |
| Origine | Audit 2026-09-21 |

### NC-I-006 — Observabilité et exploitation du service de démonstration

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | I.6 — Exploitation |
| Constat | Le service de démonstration (`index.html`) n'offre qu'un `console.log` serveur et un point de santé `GET /v1/health` (avec indicateur de capacité utile — bon point). Son état durable est un tampon de taille fixe évidé par ancienneté (`MAX_ACTES 80`, `MAX_PUBLIES 40`, `MAX_SIGNATURES 80`) : une publication peut donc disparaître du recueil public par simple pression. Aucune procédure de sauvegarde/restauration n'est prévue pour ce mode (elle existe, en revanche, pour l'auto-hébergé — `src/docs/ADMINISTRATION.md` § 8). |
| Exigence de référence | ISO/IEC 27002 (journalisation, sauvegarde) ; ISO/IEC 25010 (fiabilité, disponibilité). |
| Preuve | `index.html` (`hSante`, `evince`, constantes `MAX_*`) ; `src/docs/ADMINISTRATION.md` § 7.2, § 8. |
| Recommandation | Documenter explicitement que le mode démonstration **n'est pas** un mode de conservation, et interdire son usage en service réel. Voir P-11. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — le mode démonstration est explicitement présenté comme non conservatoire dans `src/docs/ADMINISTRATION.md` § 7.5 et § 7.6 (« la démonstration n'est pas un service »). |
| Origine | Audit 2026-09-21 |

### NC-I-007 — L'outillage d'industrialisation vit dans `src/`, pas à la racine du dépôt

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | I.3 — Environnements, tests, industrialisation ; I.5 — Gouvernance du code |
| Constat | Les trois briques d'industrialisation livrées par la campagne 2 — contrôle de syntaxe (`src/scripts/verifier-syntaxe.mjs`), tests hors navigateur (`src/tests/purs.test.mjs`) et chaîne d'intégration (`src/github/ci.yml`) — sont rangées **sous `src/`**, c'est-à-dire dans l'arborescence servie de la page, et non à la racine du dépôt. Or c'est la racine qui est lue par un intégrateur ou une forge : ni `package.json`, ni `\.github/workflows/`, ni `tests/` n'y figurent. L'outillage livré n'est donc pas là où on l'attend, et la CI n'est pas active. |
| Exigence de référence | Bonne pratique d'industrialisation ; ISO/IEC 25010 (maintenabilité, reproductibilité) ; objectif de reprise par un tiers. |
| Preuve | La table de l'export (`src/README.md` § « Exporter le dépôt GitHub ») range chaque source à sa place : `src/scripts/**` → `scripts/**`, `src/tests/**` → `tests/**`, `src/package.json` → `package.json`, `src/github/ci.yml` → `.github/workflows/ci.yml`, `src/AGENTS.md` → `AGENTS.md` ; et l'export ne les recopie plus dans `src/`. Commandes lancées **depuis la racine** : `npm run verifier` (346 épreuves, 28 fichiers, chacune verte, chaque fichier éprouvé isolément ; contrôle de style éprouvé dans les deux dispositions, 210 fichiers, aucune remarque, ordinaire comme strict). Avant : `src/package.json`, `src/scripts/verifier-syntaxe.mjs`, `src/tests/purs.test.mjs`, `src/github/ci.yml` — et l'absence des mêmes fichiers à la racine du dépôt. |
| Recommandation | Recopier l'outillage à la racine du dépôt lors de la publication (ou documenter le lien), et trancher le rangement. Voir P-27. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-23, livraison 1.6.1q) — l'outillage est rangé **à la racine du dépôt** (`scripts/`, `tests/`, `package.json`, `.github/workflows/ci.yml`, `AGENTS.md`, `CLAUDE.md`) et le code de l'application sous `src/` ; l'export range chaque source à sa place et **ne la recopie plus** dans `src/` — un fichier, un seul endroit. Les scripts **constatent** la racine du code (`scripts/racine-code.mjs`) au lieu de la supposer, ce qui les rend justes dans les deux dispositions (dépôt et atelier). L'outillage est désormais là où un intégrateur, une forge et un agent le cherchent : `npm run verifier` part de la racine, et la CI nomme l'étape qui lâche. |
| Origine | Audit 2026-09-21b |

### NC-I-008 — La chaîne d'intégration continue est rouge depuis sa mise en service

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Environnements, tests, industrialisation |
| Constat | Le contrôle mécanique livré ne protège rien : sur le dépôt publié, le workflow « Intégration continue » a été déclenché à chaque envoi et a échoué **quatre fois sur quatre** (envois `a18a876`, `d1cb19a`, `5086a22`, `efaade3`). Les deux travaux échouent : « Syntaxe et tests » (étape « Vérifier la syntaxe de tout le JavaScript », code de sortie 1) et « Service auto-hébergé » (étape « Tests du domaine des comptes et de la signature »). Un voyant rouge permanent ne se distingue plus d'une panne réelle : c'est l'inverse du service qu'une chaîne rend. |
| Exigence de référence | ISO/IEC 25010 (fiabilité, maintenabilité) ; bonne pratique d'intégration continue — une chaîne rouge équivaut à une chaîne absente. |
| Preuve | API GitHub, `GET /repos/aplds/scribae/actions/runs` : quatre exécutions « Intégration continue » sur `main`, toutes `conclusion: failure` ; `GET /actions/runs/{id}/jobs` : « Syntaxe et tests » en échec à l'étape 4, « Service auto-hébergé » en échec à l'étape 5. Première cause reproduite en atelier (voir NC-I-009). Journaux d'exécution **non lisibles** sans droits d'administration sur le dépôt (403 « Must have admin rights to Repository ») : la cause du second travail n'a pas pu être instruite dans cette campagne. **Observation du 2026-09-28 (1.6.3d)** : `GET /actions/runs?per_page=8` montre **quatre exécutions de `ci.yml`** (`1.6.1w`, campagne d'audit, `1.6.3b`, `1.6.3c`), toutes rouges sur les deux travaux d'épreuves ; sur l'envoi `82802c5` (`1.6.3c`, `run_number: 14`), `GET /runs/36323585161/jobs` donne « Image Docker, construite et mise en service » **`success`** (étapes 4 à 6), « Service auto-hébergé » **`failure`** (étape 5) et « Syntaxe, style et tests » **`failure`** (étape 6). L'arbre du dépôt confirme aussi le `git rm` des cinq doublons (`/git/trees/main?recursive=1` : plus aucun `src/server/{index.html,main.pjs,package.json,.gitignore,.nojekyll}`). Les journaux restent illisibles sans droits : c'est pourquoi la chaîne publie désormais ses échecs en **annotations**. |
| Recommandation | Rendre la chaîne verte avant toute communication publique (P-31, P-32), publier son état (badge dans le README, P-38), et traiter un échec comme un arrêt de livraison. |
| Effort | Faible (premier travail : cause identifiée) à moyen (second travail : cause à instruire) |
| Priorité | Très haute |
| Échéance | 0–30 jours |
| Statut | **Régression** (2026-09-28, livraison 1.6.3d) — l'observation promise a eu lieu, et elle a dit la vérité : l'envoi `82802c5` (1.6.3c du 2026-09-27) exécute **trois travaux**, dont le troisième — « Image Docker, construite et mise en service » — **passe** (santé, schéma et migrations, coquille servie, code de l'application servi, `config.js` engendré), tandis que les **deux travaux d'épreuves échouent** encore. La fiche repasse donc en « Régression », comme elle l'avait elle-même annoncé. Ce qui a changé, c'est qu'on peut enfin savoir **pourquoi** : le journal n'était lisible que par un administrateur du dépôt, et la chaîne attache désormais chaque épreuve rouge en **annotation** (`scripts/annoncer-echecs.sh`), publique et interrogeable. La **première cause** est nommée : l'épreuve des modèles de `.env` (`src/server/mysql/variables.test.mjs`) cherchait `src/server/env.example` par un chemin relatif au **dossier courant**, or le travail « Service auto-hébergé » part de `src/server/mysql` (son `working-directory`) — elle ne trouvait que le modèle du service et déclarait manquantes les cinq variables qui ne vivent que dans celui du dépôt (`DB_ROOT_PASSWORD`, `API_TOKEN`, `API_BASE`, `HTTP_PORT`, `APP_DIR`), cinq échecs certains à chaque envoi ; les chemins de lecture des épreuves sont maintenant **ancrés à l'adresse du fichier** (`import.meta.url`), ce qu'un `working-directory` ne peut plus déplacer — **corrigée** en 1.6.3d. La cause du travail « Syntaxe, style et tests », qui part de la racine, n'est **pas encore nommée** : les annotations du prochain envoi la nommeront. **Recoupement du 2026-09-28** : trois hypothèses ont été éliminées — `variables.test.mjs` passe depuis la racine, `industrialisation.test.mjs` porte bien son groupe de capture (`(/\\.([a-z0-9]+)$/i.exec(spec) || [])[1]`) et ses deux assertions nginx passent, aucun des 61 fichiers du travail racine ne résout mal ses imports, et aucune API Node ≥ 21 n'y est employée (`purs.test.mjs` saute `DOMParser` en Node). La cause n'est donc ni un import mort, ni une épreuve d'environnement. **Nommée à la 1.6.3k (2026-09-30)**, en interrogeant les **annotations du dépôt** (`api.github.com/repos/aplds/scribae/commits/{sha}/check-runs`) au lieu du journal, resté inaccessible (403) : l'envoi `670b2c86` (1.6.3d) échoue sur `not ok 190 — la vérification refuse un mauvais mot de passe, un scellé illisible, un dérivé incohérent`. Le décodeur base64 de **Node** est tolérant (il ignore les caractères hors alphabet et ne lève jamais) : un scellé corrompu se décodait en quelques octets, et `lireScelle` (`src/server/mysql/comptes.mjs`) le rendait lisible. **Corrigé** — `lireScelle` exige désormais la **ré-encodage identique** des deux parts. Un **harnais plus sévère que Node** (la doublure d'`atob` de l'atelier levait là où Node ne lève pas) **cachait** le défaut : `src/scripts/harnais-atelier.mjs` décode maintenant comme Node, faute de quoi l'atelier rendait verte une épreuve que la chaîne voyait rouge. **Deux autres défauts** ont été trouvés par la même lecture : le travail « Service auto-hébergé » échouait en **127** parce que `annoncer-echecs.sh` était cité par un chemin (`../../scripts/…`) qui n'existe que dans l'atelier — ancré désormais à `$GITHUB_WORKSPACE` ; et le travail « Parcours critiques » importait `/src/tests/parcours.mjs`, un 404 dans le dépôt où `tests/` est à la racine — les deux dispositions sont désormais cherchées. **Ce qui reste** : voir la CI **verte** sur un envoi, les annotations ne rejouant pas une correction avant qu'elle soit déposée. La fiche reste **ouverte** jusque-là. |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-I-009 — Le contrôle de style ne reconnaît pas ses exemptions dans la disposition livrée

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | I.3 — Industrialisation ; I.2 — Qualité et lisibilité du code |
| Constat | `verifier-style.mjs` choisit le dossier à analyser en cherchant `src/` **à côté de lui-même** : dans la copie de travail comme dans le dépôt livré, l'outillage vit sous `src/`, donc `dossierCode` vaut « . » et le parcours produit des chemins préfixés par « ./ » (`./scripts/verifier-style.mjs`, `./server/mysql/server.mjs`). Or les exemptions sont écrites pour une autre disposition (`scripts/…`, `pages/host.js`, `server/…`) : plus aucune ne s'applique. Conséquence directe : les trois lignes du script qui contiennent le mot `debugger` (dans ses propres commentaires et dans sa règle) sont comptées comme **erreurs**, et le script sort en code 1 — c'est le premier échec de la chaîne (NC-I-008). Conséquence secondaire : le code du service, censé être exempté de l'avertissement `console.log`, ne l'est plus. |
| Exigence de référence | ISO/IEC 25010 (fiabilité, maintenabilité) ; cohérence entre l'outil de contrôle et la disposition qu'il contrôle. |
| Preuve | `src/scripts/verifier-style.mjs:23-31` (choix de `dossierCode` et commentaire d'intention), `:36` (`const rel = dir ? dir + sep + e.name : e.name`), `:44-45` (exemptions), `:70` (le garde `!chemin.startsWith("scripts" + sep)`). Reproduction en atelier, disposition livrée : `relScript = "./scripts/verifier-style.mjs"`, `exempteScript = false`, `exempteServeur = false`, nombre d'erreurs comptées = 3, code de sortie attendu = 1. |
| Recommandation | Normaliser le chemin avant comparaison (retirer un éventuel préfixe « ./ », comparer à la racine nue) et ajouter une épreuve qui exécute les deux contrôles sur la disposition livrée (P-31). |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-23) — le dossier analysé est le **parent de l'outillage** (le code du projet, que l'on soit dans la copie de travail ou dans le dépôt livré), avec repli d'un cran si l'outillage remonte un jour à la racine ; les chemins rendus sont relatifs à cette racine, **sans préfixe « ./ »**, et les exemptions s'appliquent de nouveau. Preuve : reproduction des deux états sur la disposition livrée — avant, code de sortie 1, **3 erreurs** (`debugger` compté dans l'outillage lui-même) et **95 avertissements** (exemptions mortes, dont `./server/web/host.js`) ; après, code de sortie 0, **180 fichiers, aucune remarque**, en mode ordinaire comme en mode `--strict`. Épreuve de non-régression : `src/tests/industrialisation.test.mjs` (3 épreuves) exécute le contrôle tel qu'il est livré et vérifie qu'il a bien **vu** le code. |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-I-010 — L'API est implémentée deux fois (démonstration et service auto-hébergé)

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | I.1 — Architecture et découpage ; I.2 — Duplication |
| Constat | L'API du service est **implémentée deux fois** : une fois dans le service de démonstration (`index.html`, script `type="text/x-server-plugin"` : routes, rôles, journal, quota, courriel, purge), une fois dans le service auto-hébergé (`src/server/mysql/*.mjs` : `actes.mjs`, `bulletins.mjs`, `server.mjs`, `comptes.mjs`…). Les deux rendent les mêmes routes, mais avec deux persistances (état binaire en mémoire, base MariaDB) et **deux jeux de tests différents** : seuls ceux du serveur existent (`src/server/mysql/*.test.mjs`), la démonstration n'est couverte par rien. Les corrections de cette revue de code ont dû être appliquées deux fois — le registre le documente (`NC-II-004` : « des deux côtés (service de démonstration `index.html` et `src/server/mysql/server.mjs`) ») —, et rien ne garantit mécaniquement que les deux réponses restent identiques. |
| Exigence de référence | ISO/IEC 25010 (maintenabilité) ; principe « une règle, une implémentation » ; §2.3 du cadre d'audit (distinguer la démonstration du déploiement cible sans les confondre). |
| Preuve | `index.html` (constantes `SERVICE`, `MAX_PUBLIES`, table `ROUTES`, `egalConstant`, `journaliser`, `hSante`) face à `src/server/mysql/server.mjs`, `actes.mjs` (mêmes routes `/v1/actes…`), `src/server/mysql/*.test.mjs` (11 fichiers) — aucun test de la démonstration. |
| Recommandation | Faire de la démonstration un **adaptateur** du même domaine (persistance injectée), ou, à défaut, définir une **épreuve de conformité** exécutée contre les deux implémentations (jeu d'appels commun) pour rendre toute divergence visible (P-37). |
| Effort | Élevé (extraction du domaine) ; faible pour l'épreuve de conformité |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-23, livraison 1.6.1i) — la recommandation est satisfaite par sa **branche « à défaut »** : un **jeu d'appels commun** (`src/tests/conformite-service.mjs`, 13 appels dont la dépublication) est joué **contre les deux implémentations** — en Node sur le service auto-hébergé, et dans le navigateur sur le service de démonstration —, et peut être comparé à une installation réelle par la variable `SCRIBA_CONFORMITE_URL`. Une divergence de réponse entre les deux devient donc visible mécaniquement. Réserve assumée : les deux implémentations **subsistent** (la démonstration n'est pas devenue un adaptateur du domaine) — c'est le choix de ne pas extraire le domaine côté démonstration qui reste consigné ici. **Complément (1.6.2)** : la couverture du jeu laissait **deux routes** hors de son champ — `POST /v1/actes/{id}/signature-externe` et `POST /v1/actes/{id}/conformite` —, et le service Node les ignorait (404) alors que la démonstration les servait : une divergence de la classe visée ici a donc vécu sans être vue, et a été trouvée par un contrôle manuel du circuit externe sur un déploiement. Le service auto-hébergé porte désormais les deux routes, et le jeu les couvre des deux côtés (15 appels). |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-I-015 — Absence de verrou de dépendances à la racine pour l'outillage

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.4 — Dépendances et chaîne d'approvisionnement ; I.3 — Reproductibilité |
| Constat | Le manifeste de la **racine** du dépôt (`package.json`, celui qui commande l'outillage — `scripts/`, `tests/`) n'était accompagné d'**aucun `package-lock.json`**. Pour une installation qui déclare des dépendances, cela veut dire que deux constructions à deux dates peuvent partir de deux arbres différents ; ici, il faut le dire franchement, le manifeste de la racine ne déclare **aucune** dépendance, et la seule du dépôt (`mysql2`) est verrouillée là où elle vit (`src/server/mysql/package-lock.json`, `mysql2@3.11.3`). Le constat reste fondé sur la forme : `npm ci` **refuse** de tourner sans verrou, y compris sur un manifeste sans dépendance — un intégrateur qui suit la pratique courante (`npm ci` avant `npm test`) échouait donc faute de fichier, non faute de dépendance. |
| Exigence de référence | ISO/IEC 25010 (reproductibilité) ; NC-I-002 ; bonne pratique npm (`npm ci` sur un verrou commité). |
| Preuve | `src/package.json` (aucune rubrique `dependencies`) et absence de `src/package-lock.json` ; `src/server/mysql/package-lock.json` (verrou v3, `mysql2@3.11.3`) ; rapport `rapports/AUDIT-SCRIBAE-2026-09-30.md`, fiche NC-I-015 et proposition **P-31** (« commiter `package-lock.json` à la racine »), relevées sur le dépôt publié. |
| Recommandation | Commiter un verrou à la racine (P-31), et faire dire au manifeste que le numéro du logiciel ne vit pas chez lui. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-27, livraison 1.6.3c) — le dépôt porte désormais `package-lock.json` à sa racine (lockfileVersion 3, aucun paquet à verrouiller), si bien que `npm ci` y fonctionne. Le champ `version` du manifeste passe à `0.0.0` : le numéro du LOGICIEL vit dans `src/lib/version.js` (source unique), et il annonçait encore `1.6.2` — une copie qui était déjà fausse. |
| Origine | Audit 2026-09-30 (5e campagne, autre lignée) — voir NC-I-017 |

### NC-I-016 — Le chemin des tests du manifeste racine ne convient pas à `node --test`

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.3 — Environnements, tests, industrialisation |
| Constat | Le script `test` du manifeste racine passait ses chemins **sans préfixe** : `node --test tests/ src/server/mysql/ src/server/charge/`. Or `node --test` résout ses arguments comme des **spécificateurs de module** (la même résolution qu'un `import`) : un chemin qui ne commence ni par `./` ni par `/` n'est pas un chemin relatif, c'est le nom d'un **paquet** — et la chaîne échoue alors que tous les fichiers de test existent, sous le nez. C'est une cause possible, à elle seule suffisante, d'une chaîne rouge dont le remède était sous les yeux. |
| Exigence de référence | ISO/IEC 25010 (fiabilité, maintenabilité) ; NC-I-008 ; documentation de `node --test`. |
| Preuve | `src/package.json` (script `test`, avant correction) ; rapport `rapports/AUDIT-SCRIBAE-2026-09-30.md`, fiche NC-I-016 et proposition **P-32** (« `tests/` → `./tests/` »), relevées sur la chaîne d'intégration du dépôt publié. |
| Recommandation | Préfixer les trois chemins (P-32), et laisser la règle dans le fichier qui la porte. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-27, livraison 1.6.3c) — `"test": "node --test ./tests/ ./src/server/mysql/ ./src/server/charge/"`. |
| Origine | Audit 2026-09-30 (5e campagne, autre lignée) — voir NC-I-017 |

### NC-I-017 — La copie de travail et la copie publiée ont divergé (version, changelog, registre d'audit)

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | I.5 — Gouvernance du code ; I.3 — Reproductibilité ; I.8 — Documentation |
| Constat | La **copie publiée** (dépôt `aplds/scribae`, servie aussi par `https://demo.scribae.eu`) et la **copie de travail** (celle qui a été auditée) ne racontent pas la même histoire. La copie publiée sert `APP_VERSION = "1.6.1w"` (`APP_RELEASED = "2026-09-29"`), dont la première entrée datée de changelog est `[1.6.1w] — 2026-09-29`, et son **registre d'audit est en version 5** (`mis_a_jour: 2026-09-30`, **39 fiches**, annonçant des campagnes 4 et 5 et des fiches `NC-I-015`, `NC-I-016`, `NC-II-015`). La copie de travail est en **1.6.3** (`2026-09-27`), avec un registre **version 3** (37 fiches, trois campagnes). Une **lignée** de développement et d'audit existe donc du côté publié que la copie de travail ne contient pas — et réciproquement. Le README prescrit pourtant de **comparer** avant d'écrire et de ne jamais livrer deux fois le même numéro : la divergence rend ces règles inopérantes. |
| Exigence de référence | ISO/IEC 27001 (maîtrise de la configuration) ; ISO/IEC 25010 (maintenabilité, exactitude) ; règle interne « Flux de travail : Perchance ↔ GitHub » (`src/README.md`). |
| Preuve | `raw.githubusercontent.com/aplds/scribae/main/src/lib/version.js` → `APP_VERSION = "1.6.1w"` (`2026-09-29`) ; première entrée datée de `.../src/CHANGELOG.md` → `## [1.6.1w] — 2026-09-29` (le changelog publié ne contient **ni `1.6.2` ni `1.6.3`**) ; `https://demo.scribae.eu/src/audit/REGISTRE-NON-CONFORMITES.md` → `version: 5`, `mis_a_jour: 2026-09-30 … 39 fiches`, fiches `NC-I-015`, `NC-I-016`, `NC-II-015` ; copie de travail : `src/lib/version.js` → `1.6.3`, `src/CHANGELOG.md` → `## [1.6.3] — 2026-09-27`, registre `version: 3`, 37 fiches. |
| Recommandation | **Choisir la lignée qui fait foi**, récupérer de l'autre ce qui manque (registre et rapports des campagnes absentes, ou les livraisons `1.6.2`/`1.6.3` selon l'arbitrage), republier **une seule** copie, puis vérifier que `APP_VERSION` et la première entrée datée du changelog concordent **des deux côtés**. Voir P-48. |
| Effort | Moyen |
| Priorité | Très haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-27, livraison 1.6.3c) — la divergence est **tranchée, réparée, et ce qui manquait a été récupéré**. (1) **La lignée qui fait foi est celle de l'atelier** (la plus avancée : 1.6.3c), et le dépôt la sert désormais : comparaison faite le 2026-09-27 (`GET /repos/aplds/scribae/git/trees/main?recursive=1`, 325 fichiers) — il porte exactement les 317 de l'export 1.6.3b, plus la `LICENSE`, plus **huit entrées de la lignée publiée** : les deux rapports d'audit du 2026-09-29 et du 2026-09-30, et les cinq doublons périmés de `src/server/` (voir NC-I-002 et le `TODO.md` : leur retrait est un `git rm`, il ne se fait pas par l'export). (2) **Ce qui manquait à l'atelier est entré** : les deux rapports sont repris dans `src/audit/rapports/`, et les **trois fiches** que son registre portait en plus — NC-I-015 (verrou de dépendances à la racine), NC-I-016 (chemin des tests du manifeste racine), NC-II-015 (`noindex` non déployée) — sont **rétablies** dans le présent registre, avec leurs preuves d'origine. C'est la branche « récupérer de l'autre ce qui manque » de la recommandation P-48, et elle a payé : **NC-I-016 nomme une cause de chaîne rouge que l'atelier ne voyait pas** (les chemins de `node --test` sans préfixe `./`), corrigée en 1.6.3c. (3) **La perte est dite, et non maquillée** : le rapport du 2026-09-30 se lit **corrompu dans le dépôt** (1 497 octets de contrôle à la place des caractères accentués — en-tête, titres, tableaux et plans se lisent, le corps non) ; sa reprise le déclare en tête de fichier, et ne prétend pas être l'original. (4) **La règle qui manquait est écrite** : la recette d'export de `README.md` demande désormais de **comparer avec le dépôt AVANT d'écrire** (version, changelog, registre) — sans quoi un export recouvre un registre plus récent, ce qui est arrivé ici. |
| Origine | Audit 2026-09-27 (4e campagne) — vu en cadrant la campagne sur le dépôt publié. *Note : les identifiants `NC-I-011` à `NC-I-016` sont employés par la lignée publiée pour d'autres objets ; la présente fiche prend le numéro suivant libre (`017`) pour ne pas recouvrir une fiche existante ailleurs.* |

## Chapitre II — Sécurité des systèmes d'information (RSSI)

### NC-II-001 — Le jeton d'écriture de l'API est publié dans le code client, et sa portée est globale

| Champ | Valeur |
|---|---|
| Gravité | **Bloquante** |
| Chapitre / section | II.8 — Secrets et configuration ; II.6 — Segmentation des environnements |
| Constat | Le service (`<script type="text/x-server-plugin">` de `index.html`) n'a qu'**un seul** mode d'autorisation pour les écritures : un jeton porteur, dont seule l'empreinte SHA-256 est en dur (`CLE_JETON`). Or le jeton lui-même est **en clair, dans le code côté client** (`DEFAULT_PUBLICATION.jetonDemonstration`), donc lisible par quiconque ouvre la page ou consulte la source, et de surcroît affiché (masquable) dans la console API de l'application. Un tiers anonyme peut donc obtenir ce jeton et appeler toutes les routes d'écriture : dépôt d'acte, ouverture de circuit de signature, transmission, publication au recueil, épinglage, et **synchronisation de n'importe quelle collection** (dont `users` et `config`). |
| Exigence de référence | OWASP ASVS (V2 authentification, V4 contrôle d'accès, V6 cryptographie) ; RGS ; ANSSI (hygiène informatique — pas de secret dans un canal non protégé). |
| Preuve | `index.html:66` (`const CLE_JETON = "…"` — valeur non recopiée ici) ; `src/lib/eli.js:42` (`jetonDemonstration`, en clair, côté client) ; `src/ui/views/api-console.js:39` (jeton affiché dans l'interface) ; test dynamique : `POST /v1/db/collections/presence/sync` avec `Authorization: Bearer <jeton de démonstration>` → **200**, enregistrement créé puis relu. |
| Recommandation | Traiter ce jeton comme **compromis par construction**. En production : un jeton par client, jamais dans le code servi (injection par le déploiement), portée et permissions par route, rotation, révocation. Voir P-01. |
| Effort | Élevé (mais le déploiement auto-hébergé fournit déjà la brique `API_TOKENS`) |
| Priorité | Très haute |
| Échéance | 0–30 jours (au minimum : neutraliser le service de démonstration derrière une instance non publique) |
| Statut | **Levée** (2026-09-21b) — plus aucun secret dans le code servi : la clé est engendrée côté client (`crypto.getRandomValues`), seule son empreinte SHA-256 est conservée (`src/lib/cle-service.js`) ; un service neuf est en lecture seule (`GET /v1/auth/etat` → `provisionne:false`) ; les clés portent un rôle. Vérifié à l'écran (provisionnement, liste, révocation) puis à l'API (403 `service_non_provisionne`). |
| Origine | Audit 2026-09-21 |

### NC-II-002 — La signature d'un acte est forgeable (webhook non authentifié, intégrité reposant sur une empreinte publique)

| Champ | Valeur |
|---|---|
| Gravité | **Bloquante** |
| Chapitre / section | II.5 — Signature, intégrité et non-répudiation |
| Constat | La route `POST /v1/webhooks/signature` est **publique** (aucun jeton, aucune signature de prestataire, aucun HMAC, pas de liste d'IP). Le service y « valide » une signature en comparant l'empreinte SHA-256 du document fourni à celle de l'acte déposé — or le document déposé est lui-même **lisible sans authentification** (`GET /v1/actes/{id}/document`). Un tiers anonyme peut donc : déposer un acte, ouvrir un circuit, **fabriquer** un paquet signé portant le nom et la fonction de son choix, le présenter sur le webhook et faire passer l'acte à « signée ». Le scénario a été reproduit de bout en bout, y compris la **publication au recueil public** avec attribution d'un identifiant ELI (publication ensuite retirée par l'auditeur pour nettoyage). |
| Exigence de référence | Règlement eIDAS (UE) 910/2014 ; OWASP ASVS (V4 contrôle d'accès, V7 journalisation/intégrité) ; exigence de non-répudiation. |
| Preuve | `index.html` (route `POST /v1/webhooks/signature`, `auth: "public"` ; `hWebhookSignature`, seul contrôle = `sha256Hex(document) !== acte.sha256`) ; `index.html` (route `GET /v1/actes/{id}/document`, sans `auth`) ; test reproduit : dépôt `ACT-…` (201) → `GET …/document` sans jeton (200) → `POST …/signature` (202) → `POST /v1/webhooks/signature` **sans en-tête** (200, `statut: signee`, signataire arbitraire) → `POST …/publication` (201, acte visible au recueil). Même conception dans `src/server/mysql/actes.mjs` (route `auth: "public"`). |
| Recommandation | Authentifier l'appelant du webhook (secret partagé/HMAC, mTLS, ou vérification d'un JWT du prestataire), restreindre la lecture du document déposé, et exiger la vérification cryptographique du paquet signé (clé publique du certificat attendu). Voir P-02. |
| Effort | Élevé |
| Priorité | Très haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-21b) — le webhook exige une clé de rôle `prestataire` ou `administrateur`, et le document déposé une clé de rôle `lecteur`. Vérifié : appel sans clé refusé. |
| Origine | Audit 2026-09-21 (confirme et qualifie le point d'entrée « usurpation du signataire » du prompt §4.2) |

### NC-II-003 — Les collections du référentiel sont lisibles sans authentification

| Champ | Valeur |
|---|---|
| Gravité | **Bloquante** |
| Chapitre / section | II.1 — Cartographie et classification des données ; II.4 — Sécurité de l'API |
| Constat | `GET /v1/db/collections/{collection}` ne demande **aucun** jeton. Quand le service détient des données — c'est le mode « service de démonstration » que la documentation propose (« rien à installer, partagé »), et le mode auto-hébergé en `AUTH_MODE=demo` — cette route rend l'intégralité des enregistrements, **comptes compris** (login, courriel, rôles, rattachements, préférences), ainsi que les trames, les actes, le journal et la configuration (qui peut contenir la clé d'un moteur de langage). |
| Exigence de référence | RGPD (art. 5, 32) ; OWASP ASVS V4 ; CNIL (sécurité des données, minimisation). |
| Preuve | `index.html` (route `GET /v1/db/collections/([a-z]+)`, **sans** `auth` ; `hDbCollection` renvoie `payload` complet) ; test reproduit : écriture d'un enregistrement de sonde via `POST …/sync` avec jeton, puis `GET /v1/db/collections/presence` **sans en-tête** → **200**, enregistrement complet renvoyé. Comparer : `src/server/mysql/server.mjs` protège, lui, ces routes par session ou jeton. |
| Recommandation | Exiger une authentification (et une autorisation par collection) sur toute lecture de collection autre que strictement publique ; ne jamais exposer `users`/`config`. Voir P-01. |
| Effort | Moyen |
| Priorité | Très haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-21b) — collections classées par sensibilité (`DBC_LECTURE`/`DBC_ECRITURE`), `users` et `config` réservés à l'administration ; lecture sans clé refusée. Vérifié à l'API. |
| Origine | Audit 2026-09-21 |

### NC-II-004 — Aucun modèle d'autorisation par rôle côté service : un unique jeton « tout-puissant »

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.2 — Comptes, authentification, habilitations ; II.4 — Sécurité de l'API |
| Constat | Le service ne connaît pas les rôles. Toutes les écritures partagent le même contrôle (`authFail`) : présence de jeton, empreinte correcte, rien de plus. `POST /v1/db/collections/users/sync` accepte donc de **réécrire la collection des comptes** — y compris y insérer un compte `administrateur` — dès lors qu'on présente le jeton (cf. NC-II-001). Le champ `force: true`, qui contourne le contrôle de révision, est également accepté sans condition. Les permissions (`PERMS`, `src/lib/users.js`) ne sont appliquées que dans l'interface, qui est publique et donc contournable. |
| Exigence de référence | OWASP ASVS V4 (contrôle d'accès au niveau serveur, moindre privilège) ; RGS ; recommandation « la barrière est côté serveur ». |
| Preuve | `index.html` (`authFail` ; table `ROUTES` : toutes les écritures `auth: "jeton"` sans distinction ; `hDbSync` accepte `b.force`) ; `src/lib/users.js` (`PERMS`, table de permissions purement **client**) ; `src/ui/views/referentiel.js` (l'écran « Comptes et rôles » s'appuie sur `can(...)`). Comparer : `src/server/mysql/server.mjs` refuse, lui, l'écriture de `users`/`config` à un non-admin (`COLLECTIONS_ADMIN`, 403). |
| Recommandation | Porter les rôles **dans le service** (jeton par porteur rattaché à un rôle, ou sessions), et refuser côté serveur toute écriture hors périmètre. Voir P-01. |
| Effort | Élevé |
| Priorité | Haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — les rôles sont appliqués côté serveur, chaque route déclarant le rôle requis ; vérifié avec une clé `lecteur` (200 sur `/v1/actes`, 403 `role_insuffisant` sur `users`, `journal`, `cles`, `deposit`, `sync`). La réserve sur `force:true` est levée : le contournement du contrôle de révision est **réservé au rôle `administrateur`** (403 `force_reserve_admin`) et **journalisé** (`sync_force`), des deux côtés (service de démonstration `index.html` et `src/server/mysql/server.mjs`, `sync(…, estAdmin)`) ; les descriptions OpenAPI sont alignées. |
| Origine | Audit 2026-09-21 |

### NC-II-005 — Les actes individuels (non publiables) sont exposés publiquement

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.1 — Classification ; II.9 — Protection des données à caractère personnel |
| Constat | Le client dépose au service les actes dits « individuels » en les marquant `publishable: false` (revalorisation d'un traitement, sanction, etc.) — précisément parce qu'ils ne doivent pas être publiés au recueil. Mais `GET /v1/actes` (liste) et `GET /v1/actes/{id}/document` (document Akoma Ntoso complet) sont **publiques** : le numéro, l'objet et **le texte intégral** de ces actes sont donc accessibles à quiconque. La protection ne joue que sur la **publication**, pas sur la lecture du dépôt. |
| Exigence de référence | RGPD (art. 5.1.c minimisation, 32) ; CRPA L. 312-1-2 / L. 221-14 (occultation, actes individuels) ; Loi Informatique et Libertés. |
| Preuve | `src/ui/views/signature.js` (`corpsDepot`, `publishable: actePubliable(acte)`) ; `index.html` (routes `GET /v1/actes` `auth: "public"` ; `GET /v1/actes/{id}/document` **sans** `auth` ; `hPublier` refuse en revanche `publishable: false`) ; `src/server/mysql/actes.mjs` (mêmes routes). Non vérifié : absence, dans le jeu de démonstration, d'un acte individuel déjà déposé permettant la reproduction en direct. |
| Recommandation | Protéger la lecture des actes non publiés (session ou jeton) et ne réserver la lecture ouverte qu'aux publications. Voir P-05. |
| Effort | Moyen |
| Priorité | Haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — la lecture des actes non publiés et des documents déposés exige une clé ; seule la publication reste ouverte. Vérifié : `GET /v1/actes` sans clé refusé. |
| Origine | Audit 2026-09-21 |

### NC-II-006 — Usurpation du signataire : l'identité signée est celle de l'acte, non celle de l'opérateur

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.2 — Habilitations ; II.5 — Signature, confusion d'identité |
| Constat | Le geste de signature (« signature simple », dans l'application) repose sur `auteurDe(acte, doc)`, qui prend le **signataire désigné par l'acte** (`doc.meta.signataire`) — il ne consulte jamais le compte connecté. La fenêtre de signature affiche cette identité et fait attester « En signant, vous engagez votre signature sur ce document » : un opérateur qui n'est ni le signataire ni un délégataire peut donc apposer la signature **au nom d'un autre**. Le contrôle amont (`engagerSignatureSimple`) ne vérifie que le parapheur et la révision, jamais la compétence de l'opérateur. L'action n'est gardée que par la permission `actes.signer`, accordée notamment au rôle **Rédacteur**. Le certificat produit est engendré dans le navigateur de l'opérateur, au nom déclaré (cf. NC-IV-001). |
| Exigence de référence | OWASP ASVS V2/V4 ; exigence de non-répudiation ; principe de séparation des pouvoirs. |
| Preuve | `src/ui/views/signature.js:1412` (`auteurDe` — lit `doc.meta.signataire`) ; `src/ui/views/signature.js:1248` (`signerSimple` — `signataire: auteur`) ; `src/ui/views/signature.js:1133` (`engagerSignatureSimple` — aucune vérification de compétence) ; `src/ui/app.js:90` (`signature: "actes.signer"`) ; `src/lib/users.js` (`actes.signer` inclut `redacteur`). Vérifié en direct : l'écran « Signature & publication » est ouvert au compte rédacteur (page_eval). Non vérifié : exécution complète du scénario d'usurpation (l'acte de test du périmètre était soumis à révision, ce qui a interrompu le parcours). **1.6.3** : `src/server/mysql/actes.mjs` (`porteSignature`, `hWebhookSignature`, certificat de conformité) ; `src/ui/views/signature.js` (`enregistrerCertification`, `certifierConformite`, `publierConsolide`, `retablirActe`) ; parcours `signature-hors-competence` (`src/tests/parcours.mjs`). |
| Recommandation | Comparer l'identité de l'opérateur à la chaîne de signature de l'acte (le module `competenceDuCompte` existe déjà) et **refuser** la signature hors compétence ; journaliser l'opérateur distinctement du signataire. Voir P-06. |
| Effort | Moyen |
| Priorité | Très haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — porte de compétence posée sur les trois chemins de signature (`src/ui/views/signature.js:1150`, `:1264`, `:2187`), opérateur tracé dans le dossier interne. Parcours complet non rejoué (aucun acte en attente de signature au jeu de démonstration) : le refus est établi par les messages et la lecture de code. **Renforcée (1.6.1w)** — la porte ne se contentait pas d'« être dans la chaîne » : elle exige désormais d'être le **titulaire** (dernier étage) **et** de porter la qualité de signataire (`peutSignerEffectivement`, `src/lib/signataires.js`), et l'outil du prestataire comme la fenêtre de signature simple ne s'ouvrent que pour lui. Le parcours complet est cette fois **rejoué dans l'aperçu** : un administrateur lié à l'autorité de tête, et un délégant, se voient **refuser** la signature de l'acte d'un autre (journal `essai` de séance) ; un acte validé par son réviseur part bien en signature, et le titulaire la donne. **Renforcée (1.6.3)** — la porte est désormais tenue par le **SERVICE** lui-même, et non seulement par l'interface : dès que le service identifie les personnes (`AUTH_MODE=password` ou `oidc`), `porteSignature` (`src/server/mysql/actes.mjs`) **oppose l'opérateur au signataire** — un `POST /v1/webhooks/signature` joué hors de l'interface avec un jeton valide ne peut plus engager la signature d'autrui (`403 signature_non_habilitée`, circuit `rejetee` ; `signataire_non_identifie` / `signature_sans_identite` dans les cas voisins), et le **nom** imprimé vient du référentiel du service, jamais du corps. La **certification de conformité** a la même porte (`403 conformite_non_habilitée`), et la reprise comme la compilation — qui ne sont pas des signatures — sont **réservées à l'administration** (`attribution` : `reprise` / `compilation`). Le parcours **`signature-hors-competence`** (26e) balaie les **759 paires** acte × compte du jeu de démonstration et vérifie qu'aucun bouton de signature ne s'offre sur un acte hors compétence. |
| Origine | Audit 2026-09-21 (confirme et qualifie le point d'entrée « usurpation du signataire » du prompt §4.2) |

### NC-II-007 — Injection HTML stockée dans le recueil public (XSS)

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.3 — Sécurité applicative |
| Constat | La page d'un acte publié insère la version en ligne reçue du service par `innerHTML`, sans assainissement : `doc.innerHTML = v.html`. Le contenu publié n'est pas vérifié côté service. Un tiers qui peut publier (cf. NC-II-001 / NC-II-002) peut donc faire exécuter du script à **tout visiteur** du recueil public — la page d'accueil de la collectivité. Le rendu des documents **compilés** dans l'atelier, lui, est sain (construction par nœuds texte, `src/lib/render.js`). |
| Exigence de référence | OWASP Top 10 (A03:2021 Injection) ; OWASP ASVS V5 (validation, encodage) ; RGPD (sécurité). |
| Preuve | `src/ui/views/acte-publie.js:186` (`doc.innerHTML = v.html …`) ; à l'inverse, `src/lib/render.js` (usage de `textContent` / `createTextNode`) ; test : publication acceptée avec un `html` arbitraire (cf. NC-II-002, reproductible). |
| Recommandation | Assainir la version en ligne avant insertion (liste blanche de balises/attributs), ou la reconstruire depuis l'Akoma Ntoso à l'affichage, et servir une politique de sécurité du contenu (CSP). Voir P-07. |
| Effort | Moyen |
| Priorité | Haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — version en ligne assainie avant insertion (`src/lib/sanitize.js` `assainirHtml`, appliqué dans `src/ui/views/acte-publie.js:192` et `:198`). Vérifié à l'écran : aucun `script`, attribut `on…` ni `iframe` dans le contenu rendu d'un acte publié. |
| Origine | Audit 2026-09-21 |

### NC-II-008 — Clé d'accès d'un moteur de langage conservée en clair dans le référentiel

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | II.8 — Secrets et configuration |
| Constat | Le réglage « Assistants » permet de saisir la clé de l'API de langage de la collectivité. Elle est écrite telle quelle dans le référentiel (`config.assistants[…].cle`), donc dans la collection `config` : exportée avec les données, et — en mode service — lisible sans jeton (cf. NC-II-003). Le champ est de type `password` dans le formulaire, mais la valeur est stockée en clair. |
| Exigence de référence | OWASP ASVS V6 (gestion des secrets) ; ANSSI ; ISO/IEC 27002. |
| Preuve | `src/ui/views/referentiel.js:1812` (champ « Clé d'accès », `type: "password"`, `value: s.cle`) ; `src/lib/assistant.js` (`cle`, `entetesDe`) ; `src/lib/db/contract.js` (collections partagées). L'aide du champ signale elle-même que la clé « apparaît dans un export de données » (transparence — à porter au crédit). |
| Recommandation | Sortir les secrets du référentiel : stockage local à l'installation, variable d'environnement du déploiement, ou coffre ; ne jamais les inclure dans un export ni dans une collection lisible. Voir P-08. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90 jours |
| Statut | **Levée** (2026-09-21b) — la clé du moteur est conservée dans le stockage local du navigateur (`src/lib/assistant.js` `cleMoteur`/`reglerCleMoteur`, migration des référentiels existants) et exclue des exports et des collections (`sansSecrets`, `src/lib/store.js`). |
| Origine | Audit 2026-09-21 |

### NC-II-009 — Défaut de durcissement HTTP et CORS permissif par défaut

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | II.3 — Sécurité applicative ; II.4 — Sécurité de l'API |
| Constat | Le service de démonstration ne pose aucun en-tête de sécurité (`Content-Security-Policy`, `X-Content-Type-Options`, `Referrer-Policy`…). L'échantillon de configuration du déploiement auto-hébergé place `CORS_ORIGINS=*` par défaut, et `AUTH_MODE=demo` par défaut (comptes sans mot de passe). |
| Exigence de référence | OWASP ASVS V14 (configuration) ; RGS ; guides ANSSI. |
| Preuve | `src/server/docker-compose.yml` (`CORS_ORIGINS: ${CORS_ORIGINS:-*}`, `AUTH_MODE: ${AUTH_MODE:-demo}`) ; absence de directive d'en-têtes de sécurité dans `src/server/nginx.conf` (à confirmer) ; `index.html` (réponses JSON sans en-tête de durcissement). |
| Recommandation | Fournir des valeurs par défaut sûres (CORS restreint à l'origine de l'application, `AUTH_MODE=password` recommandé à l'installation), et une CSP stricte. Voir P-09. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — valeurs par défaut sûres (`AUTH_MODE=password`, `CORS_ORIGINS=` vide), en-têtes de sécurité dans le service et dans `src/server/nginx.conf` (`frame-ancestors 'self'`), images épinglées par empreinte. |
| Origine | Audit 2026-09-21 |

### NC-II-010 — Comparaison de jeton non à temps constant ; limitation de débit et journal partiels

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.7 — Journalisation ; II.4 — Sécurité de l'API |
| Constat | La vérification du jeton compare deux chaînes par `!==` (`sha256Hex(...) !== CLE_JETON`), non à temps constant (risque théorique très faible ici, le secret étant de toute façon public). La limitation de débit (90 écritures/minute, par `conn.net[3]`) ne couvre pas les lectures. Le « journal » (collection `journal`) est une donnée applicative écrite par le même canal que le reste : il **n'est ni inaltérable ni signé**, et son export/rétention est explicitement hors périmètre (`src/SPEC.md` § 5). |
| Exigence de référence | OWASP ASVS (V2, V7) ; recommandations CNIL/ANSSI sur la traçabilité. |
| Preuve | `index.html` (`authFail`, `allowWrite`, `hSante`) ; `src/SPEC.md` § 5 (« export et rétention du journal d'audit » hors périmètre) ; `src/docs/ADMINISTRATION.md` § 7.3.1. |
| Recommandation | Journal d'audit append-only côté serveur, horodaté, exportable et conservé ; comparaison à temps constant. Voir P-10. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-27, livraison 1.6.3c) — la comparaison est désormais à **temps constant partout** : `empreintesEgales` dans le domaine (`src/server/mysql/actes.mjs`, JavaScript pur — ce module n'a ni Node ni WebCrypto), `crypto.timingSafeEqual` au service (`server.mjs`), `egalConstant` en démonstration (`index.html`). Les deux autres points du constat sont des **choix de périmètre, assumés et nommés** : la limitation de débit couvre les écritures et non les lectures, et c'est voulu — un **recueil ouvert** est fait pour être moissonné (moteurs, agents), le brider contredirait la promesse ; l'**export et la rétention** du journal d'audit restent hors périmètre (`SPEC.md` § 5) et suivis au `TODO.md`. |
| Origine | Audit 2026-09-21 |

### NC-II-011 — Transfert des questions d'assistance vers un moteur tiers

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.9 — Protection des données à caractère personnel |
| Constat | Les deux assistants (« Plume », « Publia ») transmettent leur invite et l'historique de conversation à un moteur de langage : par défaut le moteur intégré de la plateforme quand il est disponible, sinon l'API configurée. L'atelier n'y joint jamais le contenu des actes (le module l'affirme et c'est cohérent — le contexte vient du guide), mais **la question posée par l'agent** y passe, et l'interface l'avertit (« N'y mettez pas d'informations confidentielles »). Le recueil public, lui, transmet des extraits d'actes **publiés** (donc publics). Aucune mention de sous-traitance/transfert n'est fournie dans la documentation publique (cf. NC-IV-002). |
| Exigence de référence | RGPD art. 13 et 28 (information, sous-traitance, transferts) ; CNIL (AIPD si nécessaire). |
| Preuve | `src/lib/assistant.js` (`repondre`, `viaMoteurIntegre`, `viaMoteurPersonnalise`, `contexteAtelier`, `contextePublic`) ; `src/lib/assistant.js` (notes affichées à l'utilisateur) ; `main.pjs` (`generateText = {import:ai-text-plugin}`). |
| Recommandation | Documenter le transfert (destinataire, finalité, base légale, localisation), et proposer l'extinction par défaut. Voir P-08. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 90 jours |
| Statut | **Levée** (2026-09-21b) — le transfert au moteur est documenté (art. 13 et 28 : `src/docs/ADMINISTRATION.md` § 5.5ter, tableau des sous-traitances et des durées). |
| Origine | Audit 2026-09-21 |

### NC-II-012 — Le service d'aperçu perd son état sous charge modeste (démonstration non conservatoire)

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.6 — Segmentation des environnements ; I.6 — Exploitation |
| Constat | Dans l'**aperçu d'édition**, le service embarqué **redémarre et perd l'intégralité de son état** dès que l'activité dépasse un seuil modeste. Reproduit trois fois : après **deux** publications (≈ 209 Ko d'état pour une capacité annoncée de 26 Mio), toute opération suivante échoue par `WebSocket closed (code 1011)`, puis `GET /v1/health` rend `objets:{actes:0,signatures:0,publications:0}` et `GET /v1/auth/etat` rend `provisionne:false` — **la clé de provisionnement est perdue avec le reste**. Interruptions observées : à la 2ᵉ opération avec 1,2 s d'espacement, à la 3ᵉ avec 4 s, puis encore à la 3ᵉ avec 50 s d'espacement entre deux évaluations distinctes. En revanche, **une publication isolée réussit systématiquement** (476 ms pour dépôt + signature + webhook + publication). |
| Exigence de référence | ISO/IEC 25010 (fiabilité, disponibilité) ; ISO/IEC 27002 (continuité) ; RGS (disponibilité) ; cadre §2.3 (distinction démonstration / production). |
| Preuve | `index.html` (routes, `saveDb`, `MAX_CHARS`) ; journaux des appels : `POST /v1/actes` → 201, `POST /v1/actes/ACT-0001/signature` → 202, `POST /v1/webhooks/signature` → 200, `POST /v1/actes/ACT-0001/publication` → 201, puis `POST /v1/actes` → `WebSocket closed (code 1011)` ; `GET /v1/health` avant : `utilise:106759` / `:208748` ; après : `utilise:4`, `objets:0`. Recette d'amorçage : `src/ui/demo-publications.js` (`PAUSE_AMORCAGE`, `REPRISES_MAX`). |
| Recommandation | (a) **Documenter** que l'aperçu d'édition n'est pas un environnement de démonstration tenable : l'écrire comme tel, et renvoyer à l'instance enregistrée ; (b) **vérifier et documenter** la persistance des clés au redémarrage du service auto-hébergé (état en base, `sb_etat`) ; (c) si la perte d'état se reproduisait **sur un service en service**, la traiter comme un incident de disponibilité (le service redevient silencieusement en lecture seule). Voir P-27 et P-29. |
| Effort | Faible (documentation) à moyen (diagnostic du moteur de démonstration) |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Acceptée** (2026-09-27, livraison 1.6.3c) — le risque est explicitement assumé, et nommé : l'**aperçu d'édition n'est pas un environnement de démonstration tenable**, et il le dit désormais noir sur blanc (`docs/ATELIER.md` § 4 : « le service de l'aperçu est éphémère et peut se mettre en quarantaine ; un scénario = un `page_eval` »), en renvoyant à l'instance **enregistrée** pour une démonstration qui dure. La partie (b) de la recommandation est **vérifiée par lecture** : sur un service auto-hébergé, rien de ce qui compte ne se perd au redémarrage — l'état durable vit en base (`sb_etat`) ou dans `DATA_DIR`, les clés (jetons d'API, clé de scellement du coffre de signature) viennent du `.env`, et le schéma comme les migrations s'appliquent au démarrage (`AUTO_MIGRATE`) ou à la main (`--migrate`). La démonstration publiée range son état dans le navigateur de chaque visiteur (IndexedDB) : le risque est déplacé, jamais celui d'un service en production. |
| Origine | Audit 2026-09-21b |

### NC-II-013 — Le registre d'audit et ses non-conformités ouvertes sont publiés dans le dépôt

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.1 — Cartographie et classification des données ; II.7 — Journalisation, traçabilité |
| Constat | Le cadre d'audit, le registre et les rapports sont **dans le dépôt public** (`src/audit/**`), donc lisibles et clonables par tous, y compris par un lecteur qui découvre le projet — et le dépôt va être communiqué sur des forums. Le registre y expose en clair des non-conformités **encore ouvertes** : la valeur probante de la signature (NC-IV-001), la télétransmission simulée (NC-IV-004), le service de démonstration non conservatoire (NC-II-012). Hors du cadre qui les encadre (`PROMPT-AUDIT-SCRIBAE.md`, statuts, propositions), ces fiches se citent à contresens. |
| Exigence de référence | ISO/IEC 27001/27002 (classification de l'information) ; loyauté de la présentation d'un livrable public. |
| Preuve | `GET /repos/aplds/scribae/contents/` : `src/` est publié tel quel ; `src/audit/REGISTRE-NON-CONFORMITES.md` et `src/audit/rapports/AUDIT-SCRIBAE-2026-09-2*md` s'y trouvent (2 rapports, 1 registre, 1 cadre). |
| Recommandation | Chapeauter le registre et chaque rapport d'une note « document de travail, non-conformités en cours de traitement, voir le cadre d'audit », renvoyer depuis le README du dépôt à la **synthèse** plutôt qu'aux fiches, et dater l'état de la chaîne (P-34). |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-23) — le chapeau « **document de travail** » ouvre le présent registre, `src/audit/README.md` et chacun des trois rapports ; `docs/GITHUB.md` (le README du dépôt) porte une section **Audit** qui renvoie à `src/audit/README.md`, à la **synthèse** et au **plan d'action** du rapport le plus récent, en avertissant qu'une fiche lue hors de son cadre se cite à contresens. Dater l'état de la chaîne dans la fiche de tête du dépôt reste à faire : c'est la proposition P-38, échéance 30–90 jours. |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-II-014 — Le magasin local range plusieurs collections dans un même dossier

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.1 — Cartographie et classification des données ; II.5 — Intégrité des données |
| Constat | Le pilote de persistance **local** (IndexedDB) range chaque collection dans son propre dossier, par une table écrite à la main. Cette table ne déclarait ni `informations` (collection ajoutée en 1.5.3) ni `reprises` : le proxy de stockage range une collection sous le **nom de sa propriété**, donc `FOLDERS[name]` valant `undefined`, **toutes les collections non déclarées écrivaient dans le même dossier partagé** (clé `undefined`). Les billets du recueil public vivaient donc dans ce dossier commun, et la nouvelle collection `reprises` y aurait écrit **par-dessus** — la perte n'a pas été observée dans la version livrée (`informations` était la seule collection non déclarée en usage), mais elle était ouverte à la première collection ajoutée sans toucher la table. |
| Exigence de référence | ISO/IEC 25010 (fiabilité, intégrité) ; ISO/IEC 27002 (protection des données) ; RGPD (exactitude). |
| Preuve | `src/lib/db/local.js` (table `FOLDERS`, `dossierDe`) ; relevé dans l'aperçu de l'atelier : `kv["undefined"]` contenait les quatre billets de démonstration (`info-demo-*`) et `kv["actesReprises"]` était vide — après correction, `informations` est migré une fois vers `actesInformations` et `reprises` vit dans `actesReprises`, sans perte. |
| Recommandation | Déclarer **chaque** collection de `contract.js` dans la table des dossiers ; faire échouer `dossierDe` **sans aliasing** pour une collection inconnue (repli en mémoire, et non écriture dans un dossier partagé) ; reprendre une fois les données héritées du dossier commun, en les marquant pour ne pas les confondre. Tenu par une épreuve (`src/tests/reprise.test.mjs`). |
| Effort | Faible |
| Priorité | Haute |
| Échéance | Faite |
| Statut | **Levée** (2026-09-25, livraison 1.6.1s) — les dossiers `informations` et `reprises` sont déclarés, `dossierDe` ne renvoie plus d'alias pour une collection inconnue, et les données héritées du dossier commun sont reprises une fois (`HERITAGE`, `reprendreHeritage`). |
| Origine | Constat de développement (ajout de la collection `reprises`), hors campagne |

### NC-II-015 — La balise `noindex` était présente dans le code, mais non déployée

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | II.6 — Segmentation des environnements ; III.2 — Publication |
| Constat | Le logiciel pose `noindex, nofollow` sur la seule adresse de la démonstration du projet (la règle est dans `index.html`, sur `location.hostname === "demo.scribae.eu"`), mais **la page réellement servie** ne la portait pas : le déploiement publié datait d'avant le correctif. Un correctif écrit n'est pas un correctif en service, et une démonstration entièrement fictive restait donc indexable. |
| Exigence de référence | Maîtrise de l'indexation d'une démonstration ; ISO/IEC 25010 (utilisabilité). |
| Preuve | **Avant** : `GET https://demo.scribae.eu/` sans `meta[name=robots]` (constat de la campagne du 2026-09-30). **Après** : `GET https://demo.scribae.eu/` du 2026-09-27 rend, dès ses premières lignes de script, `robots.name = "robots"`, `robots.content = "noindex, nofollow"`, sous la condition `location.hostname === "demo.scribae.eu"` ; `GET /robots.txt` reste un 404 de GitHub Pages (décision assumée, voir NC-III-008). |
| Recommandation | Vérifier la condition, puis **déployer** (P-33 et P-34). |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-27, livraison 1.6.3c) — vérifié sur la page PUBLIÉE : le déploiement qui a suivi la livraison 1.6.3b l'a apportée. Une leçon à garder : pour une publication statique, la fiche se ferme **sur la page servie**, jamais sur le fichier du dépôt — c'est la vérification qui a manqué ici, et c'est celle qui compte. |
| Origine | Audit 2026-09-30 (5e campagne, autre lignée) — voir NC-I-017 |

### NC-II-016 — La télétransmission au contrôle de légalité se court-circuite par une référence fournie

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | II.4 — Sécurité de l'API ; IV.1 — Cycle réglementaire (transmission) |
| Constat | La route `POST /v1/actes/{id}/transmission` (rôle `redacteur`) honore un champ `reference` du corps : quand il est fourni, l'appel réel à l'API du contrôle de légalité **n'a pas lieu**, et le certificat est fabriqué localement avec `demonstration: true`. Comme l'acte se retrouve doté d'une `transmission`, le contrôle de publication (`409 transmission_absente`) est **levé** : un acte soumis au contrôle de légalité peut donc être publié **sans que la formalité ait été accomplie**, par un appel d'API direct, hors de l'interface. Le certificat porte la réserve « simulée » (un lecteur n'est pas trompé), mais la formalité obligatoire est contournée, et le corps de cette route n'est pas décrit dans `docs/API.md` : le champ est **non documenté**. |
| Exigence de référence | CGCT (L. 2131-1 s. : transmission obligatoire) ; OWASP ASVS V4 (contrôle d'accès fonctionnel) ; cohérence entre le contrat OpenAPI et le comportement. |
| Preuve | **Au constat (1.6.3)** : `src/server/mysql/actes.mjs` (`hTransmettre` : `if (!reference && controleLegalite && controleLegalite.actif())` et `const demonstration = !appelReel;`) ; `src/lib/api-reference.js` (la route de transmission **n'avait pas** de champ `corps` décrivant `reference`) ; `src/docs/API.md` (idem). Non reproduit dynamiquement (l'aperçu sert un service non branché) : établi par lecture de code. **Après correction (1.6.3a)** : le champ `reference` a **disparu** de `hTransmettre` (les deux services) au profit de `declaration`, décrite au contrat OpenAPI ; tenu par `src/server/mysql/actes.test.mjs` (32/32, dont un cas de déclaration sans API et un cas d'opposition identité / compétence) et `src/server/mysql/controle-legalite.test.mjs` (9/9). |
| Recommandation | **Retirer** le champ, ou le **nommer** et l'exiger comme une « constatation hors application » explicite (champ dédié, motif, journal, et refus de lever `transmission_absente` sans cette déclaration), puis l'inscrire au contrat OpenAPI. Voir P-47. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | Faite |
| Statut | **Levée** (2026-09-27, livraison 1.6.3a) — le champ `reference` non documenté est **retiré** : la transmission se **DÉCLARE** désormais (`POST /v1/actes/{id}/transmission`, corps `declaration`), avec date et destinataire **requis** (`422 declaration_incomplete` sinon), un auteur **nommé** et opposé à l'opérateur — et à la liste `revision.reviseurs` de l'acte — par le service (`403 declaration_non_habilitée`), un motif consigné et une mention de certificat qui nomme le déclarant. La route est **décrite au contrat OpenAPI des deux services**, la déclaration est **journalisée**, et la publication d'un acte soumis reste refusée sans transmission (`409 transmission_absente`) : la porte ne se lève donc plus que sur une déclaration **habilitée**, documentée et attribuée. La transmission se règle en outre en trois régimes (`config.controleLegalite.mode` : `desactive`, `declaratif`, `api`). |
| Origine | Audit 2026-09-27 (4e campagne) |

### NC-II-017 — Sur le service de démonstration, aucune identité ne peut être opposée au signataire

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | II.2 — Comptes, authentification, habilitations ; II.5 — Usurpation du signataire ; II.6 — Segmentation |
| Constat | La porte de signature (`porteSignature`) n'oppose l'opérateur au signataire que quand le **service identifie les personnes** (`ctx.sessionRequise === true`, c'est-à-dire un déploiement à `AUTH_MODE=password` ou par annuaire). Sur le service de **démonstration** de la plateforme, les comptes vivent dans le navigateur : le service n'a **aucune** identité à opposer. Un appelant muni d'une **clé de service** y dépose donc un paquet signé **au nom de n'importe quelle personne**, et la signature porte l'attribution `declaree` (le service dit qu'il n'a rien pu vérifier, non que c'est vrai). C'est la seule limite qui subsiste du point d'entrée « usurpation du signataire » du cadre ; elle est **propre au démonstrateur** et disparaît sur le service auto-hébergé. |
| Exigence de référence | OWASP ASVS V2/V4 ; règlement eIDAS (UE) n° 910/2014 (identification du signataire) ; §2.3 du cadre (distinguer démonstration et déploiement cible). |
| Preuve | `src/server/mysql/actes.mjs` (`porteSignature` : `if (!ctx || ctx.sessionRequise !== true) return { ...brut, attribution: "declaree" }`) ; `GET /v1/auth/etat` sur l'aperçu → `mode: "demonstration"` (vérifié dynamiquement) ; bienfait symétrique : `actes.test.mjs` (30/30) exerce la branche à session (opposition effective). |
| Recommandation | Limite **assumée** pour la démonstration (jeu fictif, bandeau, attribution `declaree`). La **nommer partout où une signature s'affiche** (pastille « signature déclarée (démonstration) » portée par l'acte, en plus du bandeau), et rappeler dans le guide et le README que la garantie n'existe qu'avec un service qui identifie les personnes. Voir P-53. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Acceptée** (2026-09-27) — limite du **démonstrateur**, assumée par l'éditeur du logiciel et **documentée** (SPEC § 2.7.2 ter, `GET /v1/config`, attribution `declaree`) ; elle ne s'applique **pas** au service auto-hébergé, où `porteSignature` oppose l'opérateur au signataire. |
| Origine | Audit 2026-09-27 (4e campagne) — instruction du second point d'entrée du cadre (§4.2). |

## Chapitre III — Qualité, accessibilité et expérience (qualiticien)

### NC-III-001 — La documentation contredit l'outil sur des points fonctionnels

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | III.8 — Documentation utilisateur ; III.5 — Compréhension |
| Constat | Trois contradictions relevées, chacune vérifiable : **(a)** le guide intégré affirme qu'« elle ne signe pas à votre place, et elle n'envoie pas les messages », alors que le circuit de **signature simple** fait signer dans l'application et que le service de **courriel** envoie (sur un déploiement doté d'un SMTP) six notifications ; **(b)** `src/SPEC.md` § 5 range encore l'« Assistant de rédaction (ai-text-plugin) » dans le **hors périmètre**, alors que les assistants sont livrés, documentés et **actifs par défaut** ; **(c)** `src/docs/GITHUB.md` affirme que « l'application n'envoie rien à un service tiers », alors que les assistants interrogent un moteur de langage (intégré, donc tiers, sur la plateforme). |
| Exigence de référence | RGAA/qualité documentaire ; ISO/IEC 25010 (exactitude fonctionnelle) ; exigence d'« exhaustivité et justesse vs. l'écran réel » (III.8). |
| Preuve | `src/wiki.js` (chapitre « demarrer » : texte « ne signe pas à votre place… ») face à `src/ui/views/signature.js` (`engagerSignatureSimple`, `signerSimple`) et `src/lib/courriel.js` ; `src/SPEC.md` § 5 (item « Assistant de rédaction (ai-text-plugin) ») face à `main.pjs` (`generateText`) et `src/lib/store.js` (activation par défaut) ; `src/docs/GITHUB.md` section « Vos données ». |
| Recommandation | Rebaser la documentation sur l'état réel : corriger le chapitre « demarrer », déplacer l'assistant hors de la liste « hors périmètre », nuancer la phrase sur les services tiers. Voir P-11. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-21b) — guide intégré (`src/wiki.js`), `src/SPEC.md` § 5 et `src/docs/GITHUB.md` réalignés sur l'état réel (signature simple, courriel, assistants hors du « hors périmètre », services tiers). |
| Origine | Audit 2026-09-21 |

### NC-III-002 — Absence de lien d'évitement sur le recueil public

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.2 — Accessibilité (RGAA 4.1) |
| Constat | Le recueil public n'offre aucun lien d'évitement ni d'accès rapide au contenu principal, alors qu'il comporte un en-tête, un bloc de recherche, un carrousel, une grille de thèmes et une longue liste d'actes avant le contenu. Un utilisateur au clavier ou au lecteur d'écran doit parcourir toute la navigation. |
| Exigence de référence | RGAA 4.1, critère **12.7** (lien d'évitement) ; WCAG 2.1 (2.4.1 Bypass Blocks). |
| Preuve | Inspection du DOM du recueil public (`page_eval`) : aucun `a[href^="#"]` de type « aller au contenu » ; décompte des liens d'évitement = 0. Aucun repère `nav` non plus. |
| Recommandation | Ajouter un lien « Aller au contenu » visible à la prise de focus, pointant vers `<main>`. Voir P-13. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — lien d'évitement « Aller au contenu » et cible `<main id="recueil-contenu" tabindex="-1">` présents au recueil. Vérifié : nœud, `href`, cible et règle CSS ; révélation visuelle non observable (le document de l'aperçu n'obtient jamais le focus clavier). |
| Origine | Audit 2026-09-21 |

### NC-III-003 — Cibles tactiles insuffisantes sur les contrôles du carrousel

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.2 — Accessibilité ; III.6 — Adaptation (mobile) |
| Constat | Les points de pagination du carrousel « À la une » sont des boutons de **8 × 8 px** (10 × 10 px pour le premier) ; la croix d'effacement de la recherche mesure 15 × 18 px ; le bouton de fermeture de la bulle d'assistance 16 × 16 px. Ces cibles sont bien en deçà des 24 × 24 px attendus (WCAG 2.2 AA, 2.5.8) et des 44 × 44 px recommandés sur mobile. Les libellés `aria-label` sont, eux, présents (bon point). |
| Exigence de référence | WCAG 2.2 AA (2.5.8 Target Size Minimum) ; EN 301 549 ; ergonomie mobile. |
| Preuve | `page_eval` à 390 px de large : mesures `getBoundingClientRect()` des boutons `.recueil-carrousel__point` (8 × 8), `.recueil-recherche__x` (15 × 18), `.assist__bulle-fermer` (16 × 16). |
| Recommandation | Porter la zone cliquable à 24 × 24 px minimum (padding transparent ou pseudo-élément). Voir P-13. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — cibles tactiles portées à 24 × 24 px au minimum et **mesurées** à 390 px (points de carrousel, croix de recherche). |
| Origine | Audit 2026-09-21 |

### NC-III-004 — Incohérence d'alignement dans le recueil public

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.4 — Cohérence des interfaces |
| Constat | Le corps de la page est aligné à gauche, mais la note de pied de page (`.recueil-pied__note`) est centrée, ce qui produit une rupture visuelle et une lisibilité moindre pour un paragraphe de plusieurs lignes. |
| Exigence de référence | Bonne pratique de design system ; ISO/IEC 25010 (cohérence). |
| Preuve | `page_eval` : `getComputedStyle(document.querySelector(".recueil-pied__note")).textAlign === "center"` alors que `body` et les autres blocs de texte valent `left`. |
| Recommandation | Aligner la note sur le reste du contenu (gauche). Voir P-13. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-21b) — note de pied de page alignée à gauche, mesurée (`getComputedStyle(...).textAlign === "left"`). |
| Origine | Audit 2026-09-21 |

### NC-III-005 — Le titre du document n'est pas posé par l'atelier ; repères de navigation incomplets

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.2 — Accessibilité ; III.5 — Compréhension |
| Constat | Dans l'atelier, le `document.title` interne reste celui de la coquille (« Perchance ») — le recueil, lui, pose bien son titre. Aucun repère ARIA de navigation (`nav`, `role="navigation"`) n'est présent sur le recueil public ; les régions sont en revanche correctement balisées (`header`, `main`, `footer`). |
| Exigence de référence | RGAA 4.1 (8.5/8.6 titre de page ; 12.x repères) ; ARIA Authoring Practices. |
| Preuve | `page_eval` : `document.title` = « Perchance » sur écran d'atelier ; `document.title` = « Recueil des actes administratifs — … » sur le recueil ; comptage des `nav` = 0. |
| Recommandation | Poser le titre du document par écran dans l'atelier ; ajouter un repère de navigation explicite. Voir P-13. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-23, après traitement de P-36) — la régression est réparée : le `nav` de l'atelier porte son repère (« Navigation principale de l'atelier »), mesuré dans l'aperçu, et le titre de document reste posé par écran. Historique : levée le 2026-09-21b, régression constatée le 2026-09-23 (suivie sous NC-III-007), réparée le 2026-09-23. |
| Origine | Audit 2026-09-21 |

### NC-III-006 — Le libellé de la punaise n'indique pas l'état de l'acte

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.4 — Cohérence des interfaces |
| Constat | Le geste d'épinglage porte **deux libellés** selon l'emplacement, et l'infobulle ignore l'état de l'acte : dans la liste des actes, **41 boutons** portent le titre « Épingler — l'acte sera à la « une » dès sa publication », y compris sur un acte **déjà publié** (où l'effet est immédiat) ; la rangée d'actions de la même ligne porte le titre « Mettre à la « une » du recueil public ». Après épinglage, le bouton ne change pas de libellé (« Épingler » reste « Épingler », sans passage au « Désépingler » attendu). |
| Exigence de référence | ISO/IEC 25010 (cohérence, utilisabilité) ; RGAA/WCAG (intitulés explicites) ; exigence III.4 du cadre. |
| Preuve | Relevé `page_eval` de la liste des actes (`button[title]` : 41 occurrences du même libellé, dont la ligne `2026-403-VSL`, statut « Publié ») ; même ligne, bouton d'action « Mettre à la « une » du recueil public » ; après clic, toast « Acte mis à la une du recueil public » et `epingle:true` au service, sans changement de libellé. |
| Recommandation | Un libellé unique, adapté à l'état : « Épingler à la une » / « Retirer de la une », avec la distinction utile (« dès sa publication » réservée aux actes non publiés). Voir P-28. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-21b) — le libellé de la punaise est désormais **unique et adapté à l'état** (`libelleEpinglage`, `src/ui/views/actes.js`) : « Épingler à la une du recueil public » / « Retirer de la une du recueil public », la distinction « l'acte y sera mis dès sa publication » n'étant portée que pour un acte **non encore publié** ; les deux emplacements de la liste des actes s'accordent. |
| Origine | Audit 2026-09-21b |

### NC-III-007 — La navigation de l'atelier a perdu son repère (régression de NC-III-005)

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.2 — Accessibilité (RGAA 4.1) |
| Constat | Le repère de navigation de l'atelier est perdu : le seul `nav` visible de l'atelier (`nav.app-nav`) n'a **ni** `aria-label` **ni** `aria-labelledby` (relevé dans l'aperçu). L'autre moitié de NC-III-005 tient toujours : le titre de document est posé par écran (« Trames — Ville de Valmont-sur-Loire »). Le recueil public, lui, est correctement repéré. |
| Exigence de référence | RGAA 4.1 (12.6 : les zones de regroupement de liens doivent être identifiables ; 9.2) ; WCAG 2.1 SC 1.3.1. |
| Preuve | `page_eval` : atelier → `[{classes: "app-nav", label: null, labelledby: null}]` ; recueil public → `[{label: "Navigation principale du recueil"}, {label: "Pages du site"}]` (conformes). Constat levé le 2026-09-21b (« repère `nav aria-label` ajouté ; mesurés sur 4 écrans »). |
| Recommandation | Reposer l'`aria-label` sur le `nav` de l'atelier (par exemple « Navigation de l'atelier ») et l'épingler par une épreuve, comme les deux repères du recueil (P-36). |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-23) — le `nav.app-nav` de l'atelier porte `aria-label="Navigation principale de l'atelier"` (`src/ui/app.js`, à côté des deux repères déjà conformes du recueil). Preuve : relevé dans l'aperçu, `nav` de l'atelier → `{ label: "Navigation principale de l'atelier" }` (l'`aria-label` est posé), et aucune autre zone de liens sans repère dans l'atelier. |
| Origine | Audit 2026-09-23 (régression d'une non-conformité levée le 2026-09-21b) |

### NC-III-008 — La démonstration publiée est indexable par les moteurs

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.6 — Robustesse et adaptation ; IV.7 — Transparence (renvoi) |
| Constat | `https://demo.scribae.eu/robots.txt` répond **404** (page 404 de GitHub Pages) et le `index.html` servi ne porte **aucune** balise `robots` : la démonstration — un jeu de données entièrement fictif, confié à une commune imaginaire, et qui se réinitialise — est donc indexable. Une fiche d'arrêté fictive peut apparaître dans un résultat de recherche et se lire comme un acte réel. Dans l'aperçu Perchance, la plateforme pose `noindex, nofollow` : le risque n'existe que sur le déploiement statique. |
| Exigence de référence | Bonnes pratiques de publication (maîtrise de l'indexation d'une démonstration) ; ISO/IEC 25010 (utilisabilité). |
| Preuve | `HEAD https://demo.scribae.eu/robots.txt` → 404 (`contentType: text/html`, page 404 GitHub Pages) ; `GET https://demo.scribae.eu/index.html` (178 325 octets) → aucune occurrence de `robots`/`noindex` hors descriptions d'API ; aperçu : `meta[name="robots"]` = « noindex, nofollow », posée par la plateforme et non par le logiciel. |
| Recommandation | Livrer, **dans la démonstration statique seulement**, un `robots.txt` ou une balise `noindex` — le logiciel auto-hébergé, lui, doit rester indexable (c'est même une promesse du recueil ouvert) — et le documenter dans `docs/GITHUB.md` (P-33). |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-27, livraison 1.6.3c) — la balise `noindex, nofollow` est posée par le logiciel sur la **seule** adresse de la démonstration du projet, et elle est **en service** : vérifié sur la page publiée (`GET https://demo.scribae.eu/`, 209 660 octets, le 2026-09-27). Le `robots.txt` de la racine reste **écarté à dessein** : il appartiendrait au déploiement, et chaque fork l'hériterait ; une instance auto-hébergée publie le sien (voir `docs/GITHUB.md` et `src/server/README.md`). La même vérification ferme **NC-II-015**. |
| Origine | Audit 2026-09-23 (3e campagne) |

### NC-III-009 — Les étiquettes de formulaire ne nomment pas les champs

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | III.2 — Accessibilité (RGAA 4.1 / WCAG 2.1 AA) ; III.4 — Cohérence des interfaces (renvoi) |
| Constat | Les champs de formulaire sont rendus par un helper unique qui pose une **étiquette visible** à côté du contrôle, mais **sans l'associer** à lui : le `<label for="…">` reçoit l'`id` de `opts.id`, que presque aucun appelant ne fournit, et le contrôle lui-même n'a pas d'`id`. Un lecteur d'écran annonce donc « champ de saisie » sans nom, et cliquer l'étiquette visible ne place pas le curseur dans le champ. **55 champs** sont dans ce cas, sur **5 écrans** : 40 aux Feuilles de style, 9 à l'Administration, 3 à l'API REST, 2 aux Informations publiées, 1 dans l'éditeur de trame (le `textarea` de l'inspecteur, dont l'étiquette « Texte » est un `span`). Les contrôles **composites** (choix de police, côtés de marge, couleur) empilent plusieurs contrôles derrière une étiquette : leur correction demande un `aria-labelledby` sur le contrôle visé, pas un simple `for`. |
| Exigence de référence | RGAA 4.1 — critère 11.1 (« Chaque champ de formulaire a-t-il une étiquette ? ») ; WCAG 2.1 AA 1.3.1 et 4.1.2 ; EN 301 549 (9.2.4.6). |
| Preuve | `src/ui/dom.js:190` — `if (label) wrap.appendChild(h("label", { class: "fr-label", for: id }, label, …))`, `id` venant de `opts.id`. Mesure dans l'application (aperçu, version 1.6.3f, 2026-09-28, 1440 × 900, compte administrateur) : relevé de chaque `input`/`select`/`textarea` visible, nom accessible recalculé selon la spécification (aria-label, texte, `label[for]`, `label` ancêtre, `placeholder`, `title`) — Administation 9/14 sans nom, Feuilles de style 40/75, API REST 3/3, Informations publiées 2/9, éditeur de trame 1/2. Exemple : `<div class="fr-field"><label class="fr-label">Nom</label><input class="fr-input" type="text"></div>`. |
| Recommandation | Dans `field()` (`src/ui/dom.js`) : **engendrer** un identifiant quand `opts.id` est absent (compteur de module), le poser **sur le contrôle**, et garder le `for` ; pour les contrôles composites, poser l'identifiant sur le contrôle porteur et un `aria-labelledby` sur les sous-contrôles. Vérifier les 23 onglets de l'Administration, dont seul l'onglet courant a été mesuré. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — `field()` (`src/ui/dom.js`) engendre l'identifiant quand l'appelant n'en donne pas, le pose **sur le contrôle** et garde le `for` ; les contrôles composites reçoivent un `aria-labelledby`, les groupes de boutons un `role="group"`. Les contrôles bâtis à la main d'une dizaine de modules passent désormais par ce helper (`promptDialog`, `execution-actions`, `parapheur-actions`, `revision-cartes`, `signer-picker`, `reprises`, `referentiel`, `signature`, `wysiwyg`, `comptes`, `rediger`). Mesure (2026-09-28, 1 440 × 900, 27 routes) : **0** champ sans nom accessible — 55 étaient mesurés à l'ouverture, dont 40 aux Feuilles de style. Deux métriques sont données, parce qu'elles ne lisent pas la même chose : la métrique **complète**, qui résout `aria-labelledby` comme le veut la spécification du nom accessible, donne **0** sur les 27 routes ; la **seule heuristique du relevé d'ouverture** (`aria-label`, `label[for]`, `label` ancêtre, `placeholder`, `title` — elle ne lit pas `aria-labelledby`) en laisse **12** : les contrôles **composites** des Feuilles de style (10), un `select` composite du référentiel (1) et le `textarea` de l'inspecteur de trame (1), nommés par `aria-labelledby` (le relevé résout leur nom : « Couleur du cadre », « Police du corps », « Texte »…). L'identifiant engendré est **dérivé de l'étiquette** (« Nom » → `champ-nom`) et non d'un compteur monotone, parce que le curseur est retrouvé après un redessin par le chemin **et la signature** du champ, qui comprend son `id` : un identifiant neuf à chaque rendu faisait perdre le focus à la première lettre — le parcours `saisie-garde-le-focus` l'a attrapé, et le corrige (aucun identifiant dupliqué sur l'écran mesuré). Les 23 onglets de l'Administration restent hors relevé (seul l'onglet courant a été mesuré) : ils emploient tous le même helper, mais la réserve est dite. |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

### NC-III-010 — L'objet d'un acte est coupé sans moyen de le lire

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.3 — Ergonomie et parcours ; III.4 — Cohérence des interfaces |
| Constat | Sur quatre écrans de travail, l'**objet** de l'acte — ce par quoi on le reconnaît dans une liste — est tronqué avec des points de suspension **sans attribut `title`** : rien ne permet de lire le texte entier sans ouvrir l'acte. **56** éléments `span.sig-item__obj` (parapheur 5, révision 2, signature 17, exécution 32) portent `text-overflow: ellipsis` + `white-space: nowrap` + `overflow: hidden` sans titre. Le même défaut touche **13** étiquettes de l'éditeur de trame : 3 `span.outline__label` (le texte d'un bloc dans le plan) et 10 `span.puce__label` (la palette), dont l'exemple mesuré « L'autorité de l'acte (l'assemblée, ou la col… » occupe 303 px dans un cadre de 131 px. Le chrono fait déjà les choses bien : ses 18 `td.chrono-objet` coupés portent tous leur `title`. |
| Exigence de référence | ISO/IEC 25010 (utilisabilité — exploitabilité) ; RGAA 4.1 (critère 13.x sur les contenus tronqués : l'information ne doit pas être perdue) ; doctrine du dépôt `src/docs/UI-UX.md` (P3, lisibilité de l'objet d'un acte). |
| Preuve | Mesure dans l'application (2026-09-28, 1440 × 900) : pour chaque nœud de texte visible, comparaison `scrollWidth` > `clientWidth` (87 éléments coupés au total), puis relevé de l'attribut `title` — 69 sans, 18 avec (ces 18 étant les `td.chrono-objet`). Relevé complémentaire : `getComputedStyle` → `text-overflow: ellipsis`, `white-space: nowrap`, `overflow: hidden`. |
| Recommandation | Poser le texte complet en `title` (ou un repli lisible) partout où l'objet est tronqué — la pratique existe déjà dans `src/ui/views/chrono.js` —, et faire de même pour les étiquettes du plan et de la palette de l'éditeur de trame. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — deux helpers partagés (`objetDeListe()`, `etiquetteCourte()`, `src/ui/components.js`) posent le texte entier en `title`, appliqués à `sig-item__obj` (parapheur, révision, signature, exécution) et aux étiquettes du plan et de la palette de l'éditeur de trame (`outline__label`, `puce__label`), qui recopiaient chacune leur règle. Mesure : **0** élément coupé sans `title` sur les 27 routes (69 l'étaient à l'ouverture). |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

### NC-III-011 — Un même état d'acte porte deux mots et deux couleurs

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.4 — Cohérence des interfaces |
| Constat | Le vocabulaire des états d'un acte est **recopié** dans plusieurs modules, avec des divergences visibles : l'état `pret` s'affiche « **Prêt** » sur le registre, le chrono, le détail et l'écran des modifications, mais « **Prêt à signer** » sur l'écran de signature ; l'état `exporte` est **vert** (`success`) dans `ACTE_STATUTS` et **bleu** (`info`) dans la table de l'écran de signature. Cinq tables coexistent : `src/ui/components.js:358` (`ACTE_STATUTS`), `src/lib/chrono.js:28` (`ETATS_CHRONO`, les huit états recopiés à l'identique), `src/ui/views/signature.js:68` (`STATUTS`), `src/ui/views/modifier.js:333` (table locale, sans `exporte`), `src/ui/global-search.js:175` (synonymes en minuscules, pour la recherche — celle-là est légitime). C'est la règle du dépôt (« une règle, une seule mise en œuvre », appliquée par exemple au libellé « Éditer la trame » en 1.6.3e) qui n'est pas tenue ici. |
| Exigence de référence | ISO/IEC 25010 (cohérence, maintenabilité) ; RGAA 4.1 (critère 8.x : homogénéité du vocabulaire) ; `src/docs/UI-UX.md` (P3, une pastille par objet, en français). |
| Preuve | Lecture des cinq tables (`src/ui/components.js:358-366`, `src/lib/chrono.js:28-40`, `src/ui/views/signature.js:68-76`, `src/ui/views/modifier.js:332-339`, `src/ui/global-search.js:175`) ; relevé des pastilles rendues écran par écran (registre : « Prêt » 6 fois, « Signé » 17, « Brouillon » 1, « Publié » 1 ; signature : « Prêt à signer » 7 fois, « Signé » 35, « Publié » 17, « Brouillon » 3). La divergence de **couleur** n'est pas observable dans le jeu de démonstration (aucun acte « exporté ») : elle est constatée par lecture du code. |
| Recommandation | Décider la **source unique** des états d'acte (naturellement `ACTE_STATUTS`, déjà exporté par `src/ui/components.js`), y ramener les copies (`chrono` peut n'ajouter que ses trois états propres ; `modifier` et `signature` doivent lire, non recopier), et trancher le mot : « Prêt » **ou** « Prêt à signer », mais un seul. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — **source unique** `src/lib/statuts-acte.js` (ni DOM, ni état d'application), que `src/lib/chrono.js` (qui n'y ajoute que ses trois états propres), `src/ui/views/signature.js` et `src/ui/views/modifier.js` **lisent** au lieu de la recopier ; `src/ui/components.js` la ré-exporte, de sorte que les appelants existants ne changent pas. Les synonymes de la recherche (`src/ui/global-search.js`) restent à part : c'est leur place. Les deux arbitrages sont tranchés et écrits dans le module : l'état `pret` s'affiche « **Prêt** » — le mot de la majorité des écrans et du glossaire, celui qui tient dans une colonne de registre (l'étape de validation garde, elle, son verdict « Prêt à signer », qui est une autre notion — `src/lib/validation.js`) — et l'état `exporte` garde la couleur `success`. |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

### NC-III-012 — Les pastilles d'alerte affichent « i » et « ! »

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.4 — Cohérence des interfaces ; III.5 — Compréhension et aide |
| Constat | Sur l'écran **Exécution & délais**, une alerte d'acte est signalée par une pastille dont le texte est la **lettre** « i » (information) ou « ! » (avertissement), sans attribut `title` : **20 pastilles « i » et 14 « ! »** mesurées à l'écran, posées à côté de pastilles qui, elles, portent un mot (« Formalités en cours », « Accomplie », « Non requise »). Le sens de « i » n'est donné nulle part ; une relecture à l'aveugle d'une capture ne le retrouve pas. Le logiciel dispose pourtant d'un jeu d'icônes dessinées (`src/ui/dom.js`, `info`, `warn`) employé partout ailleurs. |
| Exigence de référence | RGAA 4.1 (critère 8.4 : lisibilité des messages ; 10.x) ; WCAG 2.1 AA 1.4.1 (l'information ne doit pas reposer sur un signe ambigu) ; ISO/IEC 25010 (compréhensibilité). |
| Preuve | `src/ui/views/execution.js:136` — `text: alerte.niveau === "info" ? "i" : "!"` ; relevé des pastilles rendues sur l'écran `execution` (2026-09-28) : `{"i": 20, "!": 14}` ; les nœuds n'ont ni `title` ni `aria-label`. |
| Recommandation | Remplacer les lettres par les icônes du jeu (`icon("info")`, `icon("warn")`) et donner la raison de l'alerte en `title` — le texte de l'alerte est déjà calculé par le module d'exécution. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — `src/ui/views/execution.js` rend `icon("info"|"warn", 13)` et porte la raison de l'alerte en `title`, en `role="img"` et en `aria-label` : l'icône est nommée, elle ne redevient pas muette faute de `title`. Mesure : **0** pastille de lettre « i » ou « ! » sur l'écran d'exécution (20 et 14 à l'ouverture). |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

### NC-III-013 — Contrastes insuffisants sur la page publique et dans l'éditeur

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.2 — Accessibilité (RGAA 4.1 / WCAG 2.1 AA, critère 3.2 « contrastes ») |
| Constat | Trois familles de textes passent sous le seuil de contraste : (1) sur le **recueil public**, le thème d'une carte (`span.recueil-carte__theme`, 13 px) descend à **3,21:1** et **4,04:1** pour un seuil de 4,5:1 — c'est la page que consulte un administré ; (2) dans l'**éditeur de trame**, le drapeau d'annotations d'un bloc (`button.blk__annot-flag`, 13 px) est à **3,28:1** ; (3) les **séparateurs de fil d'Ariane** (`span.pc-parcours__sep`, le « › », 14 px) sont entre **2,88:1** et **3,11:1** sur six écrans — décoratifs, mais **non masqués** aux lecteurs d'écran, donc du texte au sens des règles. |
| Exigence de référence | RGAA 4.1 — critères 3.2 et 3.3 ; WCAG 2.1 AA 1.4.3 ; EN 301 549 (9.1.4.3). |
| Preuve | Mesure dans l'application (2026-09-28, 1440 × 900) : pour chaque nœud de texte visible, calcul du contraste WCAG entre la couleur calculée du texte et la **première** couleur de fond opaque remontée par les ancêtres ; seuil appliqué 4,5:1 (3:1 au-delà de 18,66 px, ou 14 px en gras). Écrans concernés et occurrences (le relevé dépend du contenu affiché ; recueil : **8 à 10** selon les cartes) : recueil — les thèmes de carte (`recueil-carte__theme`, 3,21:1 et 4,04:1) et le séparateur de pied (`recueil-pied__sep`, 3,11:1) ; éditeur de trame 1 (`blk__annot-flag`, 3,28:1) ; rédaction 2, parapheur 4, révision 4, signature 3, détail d'acte 4 — les séparateurs de fil d'Ariane (`pc-parcours__sep`, 2,88:1 à 3,11:1). |
| Recommandation | Reprendre les jetons employés par ces trois familles (fond teinté de la carte du recueil, drapeau d'annotation) pour atteindre 4,5:1, et poser `aria-hidden="true"` sur les séparateurs de fil d'Ariane — ils sont déjà décoratifs pour l'œil. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 0–30 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — `.recueil-carte__theme` passe à `hsl(var(--h) 62% 27%)`, le séparateur de pied du recueil à `var(--ink-muted)`, et les séparateurs du fil de parcours (`src/ui/parcours.js`) reçoivent `aria-hidden="true"` : décoratifs pour l'œil, ils cessent d'être du texte pour les règles. Le drapeau d'annotation demandait un correctif de **spécificité** autant que de couleur : un reset de la plateforme (`button:not([disabled]) { color: inherit }`) écrasait toute règle à une seule classe, et le « 1 » du compteur reprenait la couleur du texte — la règle double désormais sa classe (`.blk__annot-flag.blk__annot-flag`), comme le fait `.fr-btn--primary`. Mesure : **0** texte sous le seuil de contraste sur les 27 routes. Le **thème sombre**, que le rapport n'avait pas remesuré (il le disait : « les 28 écrans n'ont pas été remesurés en sombre »), l'a été pour ce lot : **deux** textes blancs sur un fond de marque **clair** y tombaient — la puce de la porte « en cours » du fil de parcours (3,0:1) et le point de l'étape ouverte du circuit de signature (3,0:1, et 1,7:1 pour l'étape franchie sur le vert clair). Les trois prennent l'encre sombre que le mode sombre réserve déjà aux fonds de marque (`src/css/app-sombre.css`) : 6,2:1 et 10,9:1. Relevé de clôture en sombre : **0** texte sous le seuil sur les 27 routes. |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

### NC-III-014 — La structure des titres change d'un écran à l'autre

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | III.2 — Accessibilité (structure et titres) |
| Constat | Le nombre de titres de niveau 1 dépend de l'écran : **deux `h1`** sur la rédaction (`rediger/<trame>`), le détail d'un acte (`acte/<id>`) et les Feuilles de style — celui de l'écran, plus le titre du **document affiché dans le papier** (« Arrêté n°2026-401-VSL du… ») ; et **aucun `h1`** dans l'**éditeur de trame** (`trame/<id>`), dont les titres visibles sont des `h2`/`h3`. Pour un lecteur d'écran, la page n'a donc pas toujours de titre de niveau 1, et en a parfois deux. |
| Exigence de référence | RGAA 4.1 — critère 9.1 (hiérarchie des titres) ; WCAG 2.1 AA 1.3.1 et 2.4.6. |
| Preuve | Relevé des `h1`–`h4` écran par écran (2026-09-28) : `rediger/tpl-nomination`, `acte/acte-demo-401` et `styles` → 2 `h1` (le second dans `.paper`, classe `doc-title`) ; `trame/tpl-nomination` → 0 `h1` ; les 24 autres écrans → 1 `h1`. |
| Recommandation | Un seul `h1` par écran : le titre de l'écran. Le titre du document affiché dans l'aperçu ne doit pas être un `h1` de la page (`h2`, ou `role="presentation"` sur le conteneur), et l'éditeur de trame doit porter son `h1` (le nom de la trame, aujourd'hui en `h2`). |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — `rang()` et l'option `apercu` (`src/lib/render.js`) décalent d'un cran les titres d'un document **affiché dans** un écran, et tous les rendus en aperçu de l'atelier comme des fenêtres le demandent (`editor`, `modifier`, `rediger`, `reprises`, `signature`, `styles`) ; l'écran Documentation passe `decalage: 1` à `renderMarkdown` (`src/ui/markdown.js`), qui décale **balise et classe** — le titre du document n'est plus dessiné à la taille d'un titre de page —, et l'éditeur de trame gagne son `h1` (`h1.editor__titre`). Mesure : **1 `h1`** sur chacune des 27 routes (il y en avait 2 sur trois écrans, et 0 dans l'éditeur). |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

### NC-III-015 — Des cibles interactives plus petites que 24 px

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.2 — Accessibilité (ergonomie de la cible) ; III.3 — Ergonomie |
| Constat | Huit familles de commandes mesurent moins de 24 px dans une dimension, dont deux présentes sur presque tout le logiciel : le **dépliant « Réglages »** de la barre de gauche (191 × **20** px) et l'**aide d'écran** « ? À quoi sert cet écran ? » (145 × **21** px, sur 20 écrans). S'y ajoutent, dans les listes et dans le document : `button.registre__deplie` 22 × 22 (ouvrir une ligne du registre, 25 fois par écran), `button.editor__counts` 228 × 20, `button.insert-bar__btn` 22 × 16, `button.blk__note` 16 × 16, `button.piece__btn` 15 × 15, `a.docs-toc__link` 200 × 23. Les cases à cocher (13 × 13) ne sont **pas** concernées : elles sont enfermées dans leur `<label>`, qui est la cible réelle. |
| Exigence de référence | WCAG **2.2** AA 2.5.8 (« Target Size (Minimum) », 24 × 24 px) — critère **postérieur** à la version 2.1 citée par le cadre d'audit, d'où la cotation en observation ; RGAA 4.1 (critère 13.6, zones de clic) ; ISO/IEC 9241-400. |
| Preuve | Mesure dans l'application (2026-09-28, 1440 × 900) : dimensions rendues (`getBoundingClientRect`) de chaque élément interactif visible ; liste ci-dessus. Les boutons du papier (`.paper`) sont ceux de l'édition d'un bloc, révélés au survol. |
| Recommandation | Porter ces huit familles à 24 × 24 px au moins (hauteur surtout : la largeur est souvent suffisante) ; pour les commandes du document, élargir la zone cliquable sans grossir l'icône. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — les huit familles de la fiche sont portées au-dessus de 24 px, et la mesure du lot en a trouvé **trois de plus** : la barre de zoom (`.zoom__pct`, `.zoom__btn--fit`) et le bouton « Ajouter une pièce » (`.piece__add`) faisaient 23,5 px, et les puces du panneau d'annotation (`.annot__add`, `.annot__btn`) étaient sous le seuil. Le repère de marge du commentaire garde sa pastille de 16 px mais gagne une **zone cliquable de 24 × 24** (`::after { inset: -4px }`) : c'est la recommandation même de la fiche. Deux points de mesure à connaître : les commandes du **document** font 24 px dans les coordonnées de la feuille — vérifié à **100 % de zoom** —, l'aperçu réduisant la feuille pour la faire tenir (≈ 75 % ici), comme tout visualiseur ; et restent sous 24 px, **hors du périmètre du critère** : les liens en pleine phrase (WCAG 2.5.8, exception « dans un texte ») et les cases à cocher de 13 px enfermées dans leur `<label>`, qui est la cible réelle (la fiche les écartait déjà). |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

### NC-III-016 — Les repères d'édition sont les plus petits textes du logiciel

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.2 — Accessibilité (lisibilité) ; III.5 — Compréhension et aide |
| Constat | La doctrine P1 (`src/docs/UI-UX.md`) promet qu'« aucun texte de la **chrome** ne descend sous 13 px » : la promesse est tenue à la lettre — tous les textes sous 13 px vivent dans le `.paper`, c'est-à-dire dans le document. Mais deux d'entre eux **ne sont pas le document** : ils l'expliquent. Les repères des champs variables de l'écran de **rédaction** (`span.rw-tok__hint` : « Numéro de l'acte », « Objet », « Bénéficiaire », « valeur non trouvée ») sont à **10,56 px** (5 occurrences) et **11,19 px** (2) ; les pastilles de variables de l'aperçu et de l'éditeur (`span.chip`) sont à **11,4 px** (`beneficiaire.civility`, `entity.authorityFormula`…). Ce sont, pour un public non informaticien, les textes qui rendent la rédaction compréhensible — et les plus petits de l'application. |
| Exigence de référence | RGAA 4.1 (critère 10.7 : lisibilité du contenu) ; WCAG 2.1 AA 1.4.4 (redimensionnement) ; `src/docs/UI-UX.md` P1 (« plancher absolu 13 px »). |
| Preuve | Relevé des tailles **réellement rendues** (`getComputedStyle().fontSize`) sur les nœuds de texte, écran par écran (2026-09-28) : rédaction → minimum 10,56 px (5 nœuds), puis 11,19 px (2) ; éditeur de trame → 11,44 px (14 `chip`) et 12,13 px (3 `chip`) ; tous les autres écrans → minimum **13 px**. La distinction « chrome / papier » est vérifiée par la présence d'un ancêtre `.paper`. |
| Recommandation | Fixer un plancher de 13 px pour les repères d'édition posés dans le document (`rw-tok__hint`, `chip` d'aperçu) — la typographie du document lui-même (le corps de l'acte) reste ce qu'elle est, c'est le document. |
| Effort | Faible |
| Priorité | Moyenne |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — plancher de 13 px posé pour les repères d'édition (`span.rw-tok__hint` de la rédaction, `span.chip` de l'aperçu et de l'éditeur) : ce ne sont pas le document, ils l'expliquent, et la typographie du **corps de l'acte** n'est pas touchée. Mesure : minimum rendu **13 px** sur les 27 routes, **0** valeur sous 13 px (10,56 px et 11,4 px à l'ouverture). |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

### NC-III-017 — L'aide à la demande manque sur quatre écrans, contre la doctrine

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | III.5 — Compréhension et aide ; III.1 — Complétude fonctionnelle |
| Constat | La doctrine P4 (`src/docs/UI-UX.md`) affirme que « les **vingt-trois** écrans de l'atelier ont été convertis » à l'aide à la demande (le bouton « ? », `.aide-ecran__titre`). Mesure : **20** écrans le portent. Quatre ne l'ont pas — `modifier`, `trame/<id>` (éditeur), `rediger/<id>` (rédaction), `acte/<id>` (détail) — et trois d'entre eux affichent leur explication **en clair et en permanence** (« Ce que produit une modification » sur `modifier`), soit exactement ce que P4 a fait disparaître ailleurs. Les deux écrans hors atelier (`recueil`, `aide`) ne sont pas concernés. |
| Exigence de référence | Bonne pratique d'interface (`src/docs/UI-UX.md`, P4 : « le texte n'est pas supprimé — il est déplacé là où on le cherche ») ; ISO/IEC 25010 (apprenabilité) ; RGAA 4.1 (critère 12.x, aide). |
| Preuve | Relevé de `document.querySelector(".aide-ecran__titre")` sur les 28 écrans (2026-09-28) : présent sur 20, absent sur `modifier`, `trame/tpl-nomination`, `rediger/tpl-nomination`, `acte/acte-demo-401`, plus `recueil`, `aide`, `aide/ouvrir`. |
| Recommandation | Soit convertir ces trois écrans d'atelier (l'usage est le même que sur les 20 autres), soit corriger la phrase de la doctrine et écrire **pourquoi** ces écrans-là gardent leur explication visible. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-28, livraison 1.6.3g) — les quatre écrans qui ne l'avaient pas ont reçu l'aide à la demande (`aideEcran()`, `pageTitle()`) : `modifier` (ses trois vues), l'éditeur de trame, la rédaction et le détail d'un acte. L'encadré « Ce que produit une modification » de `modifier` a été retiré et son texte rejoint le bouton « ? » : le texte n'est pas perdu, il est déplacé là où on le cherche. Mesure : l'aide est présente sur les **24 routes d'atelier** mesurées (les trois routes hors atelier — `aide`, `aide/ouvrir`, `recueil` — ne sont pas concernées). La doctrine P4 (`src/docs/UI-UX.md`) est corrigée : elle annonçait vingt-trois écrans, il y en a **vingt-quatre**. |
| Origine | Audit visuel 2026-09-28 (campagne visuelle, chapitre III) |

## Chapitre IV — Conformité et valeur juridiques (DAJ / assemblées)

### NC-IV-001 — L'identité du signataire n'est pas garantie (certificat auto-engendré, clé privée en clair)

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | IV.3 — Sécurité juridique et valeur probante |
| Constat | Dans les circuits « simple » et « externe », la signature est produite par un certificat **créé dans le navigateur**, au nom du signataire **déclaré par l'acte** (et non vérifié), et la clé privée correspondante est conservée en clair (JWK exportable) dans le stockage du navigateur. La vérification (`verifySignedPackage`) est donc auto-référente : elle prouve qu'un paquet n'a pas été altéré depuis sa confection, **pas** qui l'a signé. Le certificat n'est pas qualifié au sens d'eIDAS, ce que la documentation indique honnêtement (« certificat de démonstration ») ; il n'en reste pas moins que l'interface affiche « Signé », « signature horodatée et vérifiable », ce qui peut laisser croire à un acte juridiquement scellé. |
| Exigence de référence | Règlement eIDAS (UE) 910/2014 et ses niveaux ; décret relatif à la signature électronique ; NF Z42-013 ; RGI. |
| Preuve | `src/lib/signature.js` (`buildSignedPackage`, `certificate` — `subject: (brand, who) => …`, `writeCert` conservant `privateKey` en clair ; `verifySignedPackage`) ; `src/ui/views/signature.js:1412` et `:1248` (l'identité vient de l'acte) ; `src/wiki.js` (la note reconnaît le certificat de démonstration). |
| Recommandation | En production, brancher une signature **qualifiée** (prestataire, cachet serveur ou porte-clés matériel), et n'attribuer le mot « signé » qu'à une signature dont l'identité est vérifiée côté serveur. Adoucir, dès la démonstration, le vocabulaire (« signature de démonstration », non opposable). Voir P-06 et P-10. |
| Effort | Élevé |
| Priorité | Haute |
| Échéance | 90–180 jours |
| Statut | **En cours** (2026-09-23 ; complété en 1.6.1g, puis en 1.6.1x) — la recommandation « **adoucir le vocabulaire** » est **livrée** : `src/lib/qualification-signature.js` qualifie chaque signature, et l'acte publié porte sous son texte un encadré **« Signature simple — non qualifiée »** (`src/ui/views/acte-publie.js`, `src/lib/eli.js`) ; le recueil public reprend la mention et le JSON-LD la transporte (`eli:signature_level`), le prestataire **simulé** étant nommé de la même façon (`src/wiki.js`). En **1.6.1x**, un quatrième circuit répond au constat par l'autre bout : la **signature interne** (`src/server/mysql/signature-interne.mjs`) fait signer le SERVICE — la clé privée du signataire est engendrée côté serveur, **scellée au repos** (AES-256-GCM sous `SCRIBA_SIGNATURE_KV_KEY`) et **ne quitte jamais le serveur**, le poste ne recevant que la clé publique, le certificat et l'horodatage. C'est la première signature du logiciel dont la clé n'est pas dans le navigateur. Le service de **démonstration**, qui ne tient pas de coffre, refuse alors franchement de signer « au nom du service » (`409 signature_interne_indisponible`, `index.html` — `hEnvoyerEnSignature`) au lieu de simuler, comme le fait l'auto-hébergé sans clé de scellement (`src/server/mysql/actes.mjs`, `hSignerInterne`) ; l'Administration › Signature dit « Coffre fermé » avec son motif. Le fond demeure pour les autres circuits : dans le circuit **simple** et dans le circuit électronique **simulé**, le certificat reste **auto-engendré dans le navigateur** et la clé privée conservée en clair dans l'enregistrement local (`src/lib/signature.js`, export JWK) ; l'opérateur est tracé et sa compétence vérifiée, la **non-répudiation n'est pas établie** — seule une signature **qualifiée**, adossée à un prestataire de confiance, la donnerait (la signature interne est **avancée** au sens d'eIDAS, mais l'autorité d'émission est interne, donc elle n'est pas qualifiée). |
| Origine | Audit 2026-09-21 |

### NC-IV-002 — Absence de licence de réutilisation au recueil, et licence logicielle indéfinie

| Champ | Valeur |
|---|---|
| Gravité | Majeure |
| Chapitre / section | IV.7 — Transparence, données ouvertes et protection |
| Constat | Le recueil public expose des actes en formats ouverts (HTML, JSON-LD/ELI, Markdown, Akoma Ntoso) mais **n'indique nulle part les conditions de réutilisation** : aucun texte de licence (Licence Ouverte / Etalab ou autre), aucun lien dans le pied de page. Le code du logiciel, de son côté, ne porte aucun fichier `LICENSE` (la documentation publique indique « tous droits réservés »). Or la publicité des conditions de réutilisation est une obligation légale pour les documents administratifs publiés en ligne. |
| Exigence de référence | CRPA art. L. 322-6 (publicité des conditions de réutilisation) et L. 321-1 ; directive (UE) 2019/1024 dite « open data ». |
| Preuve | Recherche dans `src/ui/views/recueil-public.js`, `src/ui/views/acte-publie.js`, `src/css/app.css` : aucune occurrence de « licence »/« réutilisation » dans le recueil ; `src/docs/GITHUB.md` section « Licence » ; absence de fichier `LICENSE`. |
| Recommandation | Afficher une licence de réutilisation sur le recueil (et dans les métadonnées JSON-LD), et choisir une licence pour le logiciel. Voir P-12. |
| Effort | Faible |
| Priorité | Haute |
| Échéance | 30–90 jours |
| Statut | **Levée** (2026-09-21b) — licence de réutilisation affichée au recueil et inscrite dans le JSON-LD (`dcterms:license`, `eli:uri`) ; licence logicielle tranchée (`src/LICENSE.md`, GPL-3.0). |
| Origine | Audit 2026-09-21 |

### NC-IV-003 — Identifiant ELI non résoluble ; divergence entre l'ELI et l'URI du document

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | IV.2 — Interopérabilité et normes |
| Constat | L'identifiant ELI produit est de la forme `eli:/fr/arr/2026/0464/vsl` : une chaîne de type URN, **non déréférençable** (aucun schéma `http(s)`, aucune autorité). Les recommandations ELI attendent un identifiant **adressable**. De plus, l'ELI stocké sur la publication (`eliUri`) et l'URI portée par le document Akoma Ntoso (`FRBRthis` / `FRBRuri`, `https://www.valmont-sur-loire.fr/eli/arrete/2026/464/VSL`) **ne coïncident pas** : deux identités pour un même acte. |
| Exigence de référence | ELI (European Legislation Identifier), ligne directrice ELI/FR ; OASIS LegalDocML (Akoma Ntoso). |
| Preuve | `src/lib/eli.js` (`eliUri` construit `"eli:/fr/" + …`) ; expérimentation `page_eval` : publications lues au service — `eliUri: "eli:/fr/arr/2026/0464/vsl"` et, dans le même acte, `FRBRthis value="https://www.valmont-sur-loire.fr/eli/arrete/2026/464/VSL"` ; `src/server/mysql/actes.mjs` (`eliKey`, même format). |
| Recommandation | Uniformiser l'identifiant : une URI ELI HTTP(S) canonique, identique dans la publication, le JSON-LD et l'Akoma Ntoso, et effectivement résolue par le recueil. Voir P-14. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90 jours |
| Statut | **Levée** (2026-09-27, livraison 1.6.3c) — les deux moitiés du constat sont traitées. (1) La **divergence est fermée** : `FRBRthis` porte l'**identifiant** (`eli:/fr/…`, forme stable) et `FRBRuri` l'**adresse HTTP canonique dérivée** de la base publique (`src/lib/export.js`), tandis que le JSON-LD publie `@id` (l'identifiant) **et** `eli:uri` (l'adresse) — un système tiers qui suit l'adresse tombe sur le recueil, où `/eli/…` est servi. (2) La **non-résolubilité de l'identifiant** est un **choix nommé**, écrit dans le module (`src/lib/eli.js`) : la recommandation ELI distingue l'identifiant de l'adresse, et le logiciel publie les deux. En faire une URI HTTP canonique **changerait les identifiants déjà publiés** (tous les ELI du recueil) : la bascule est consignée au `TODO.md`, à trancher avec la collectivité, jamais par un effet de bord. |
| Origine | Audit 2026-09-21 |

### NC-IV-004 — La télétransmission au contrôle de légalité est simulée et fabrique son propre certificat

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | IV.1 — Cycle réglementaire (transmission) ; IV.3 — Valeur probante |
| Constat | L'étape de transmission au contrôle de légalité « appelle » une API dont l'adresse est fictive et dont l'accusé de réception est **fabriqué localement** (référence, horodatage et « sceau » SHA-256 engendrés par le service lui-même). L'acte publié porte alors la mention « Transmis au contrôle de légalité le … », présentée comme un certificat informatique de transmission. La fonction est éteinte par défaut et documentée comme expérimentale, mais la mention produite est visuellement celle d'une transmission réelle. |
| Exigence de référence | Vadémécum du contrôle de légalité ; procédures de télétransmission (actes soumis au contrôle) ; exigence de preuve. |
| Preuve | `index.html` (`CONTROLE_LEGALITE`, `certificatTransmission`, `hTransmettre` — `api: { url: …, statut: 202 }` sans appel sortant) ; `src/lib/legalite.js` (production de la même mention côté client) ; `src/lib/eli.js` (`transmissionBlock`). |
| Recommandation | Exiger la preuve de l'appel réel (réponse de l'API, ou dépôt d'un accusé obtenu hors application) et marquer distinctement les mentions de démonstration. Voir P-10. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 90–180 jours |
| Statut | **Levée** (2026-09-27, 1.6.3) — la transmission est **réelle quand le service est branché** : `src/server/mysql/controle-legalite.mjs` (`createControleLegalite`) appelle l'API d'envoi du `.env` (`SCRIBA_CONTROLE_LEGALITE_URL`, `SCRIBA_CONTROLE_LEGALITE_API_CLE`, chemin, destinataire, délai), en `Authorization: Bearer` et sous `AbortController` ; le certificat conservé est **celui que l'API a rendu**, et un refus rend `502 transmission_echec` — **rien n'est enregistré**, la transmission se rejoue, l'échec n'est jamais converti en certificat. Sans adresse ni clé — et sur le service de démonstration —, l'appel n'a pas lieu : le certificat porte `demonstration: true` et sa mention porte la réserve (`mentionDeTransmissionSimulee`, 1.6.1g), et la version publiée reprend cette précision (`src/lib/recueil.js`). `GET /v1/config` publie l'état (`controleLegalite`), Administration › Expérimentale l'affiche. Épreuves : `src/server/mysql/controle-legalite.test.mjs` (9) et cinq cas d'`actes.test.mjs` (transmission réelle, refus sans enregistrement, rejeu). Reste hors de cette fiche — et suivi au `TODO.md` — la gestion des **refus** de la préfecture (rejet, demande d'observations), aujourd'hui réduits à un `502` rejouable. |
| Origine | Audit 2026-09-21 |

### NC-IV-005 — Version consolidée : opposabilité et articulation à clarifier

| Champ | Valeur |
|---|---|
| Gravité | Observation |
| Chapitre / section | IV.4 — Cycle de vie de l'acte |
| Constat | Le recueil distingue bien les natives, les consolidées et les modificatives (`kind`), et la page d'une version consolidée porte la mention « diffusé à titre informatif ». En revanche, la date d'opposabilité et le statut exécutoire affichés pour une version consolidée ne sont pas explicités comme ceux de l'acte **d'origine modifié** : un lecteur peut hésiter sur ce qui, de la consolidation ou de l'original, fait foi — l'information existe mais demande à être rendue plus explicite. |
| Exigence de référence | Distinction original / version en ligne / version consolidée (doctrine administrative, bonnes pratiques de publication). |
| Preuve | `src/lib/eli.js` (`buildWebVersion`, mention « Texte de l'acte à jour des modifications publiées, diffusé à titre informatif » ; `kind === "consolidee"`) ; `src/lib/recueil.js` (`corpsPublie`, versions). |
| Recommandation | Afficher sur la version consolidée la mention « ne fait pas foi » reliée à l'original signé sous le même ELI, avec sa date. Voir P-14. |
| Effort | Faible |
| Priorité | Faible |
| Échéance | 180 jours et au-delà |
| Statut | **Levée** (2026-09-21b) — la version consolidée porte la mention « Version consolidée — ne fait pas foi » et un lien ELI vers l'original ; vérifié à l'écran. |

### NC-IV-006 — Les refus du contrôle de légalité ne sont pas traités, et le client n'a jamais parlé à une vraie passerelle

| Champ | Valeur |
|---|---|
| Gravité | Mineure |
| Chapitre / section | IV.1 — Cycle réglementaire (transmission) ; IV.3 — Sécurité juridique |
| Constat | La télétransmission est désormais **réelle** quand le service est branché (NC-IV-004 levée), mais l'aller-retour s'arrête à l'accusé de réception. Or la préfecture ne se contente pas d'accuser réception : elle peut **rejeter** l'acte, ou **demander des observations**, dans un délai et selon un format qui n'est pas traité. Aujourd'hui, tout refus rend un `502 transmission_echec` **rejouable** : l'agent n'a aucun état de dossier (« rejeté », « observations demandées »), aucun motif à porter au certificat, aucun geste prescrit. Par ailleurs, le client (`controle-legalite.mjs`) n'a jamais été confronté à une **vraie** passerelle @ctes : la lecture des champs d'accusé (`reference`, `recuLe`, `destinataire`) est **défensive** (elle essaie plusieurs noms de champs), ce qui est sage, mais non validé. |
| Exigence de référence | Vadémécum du contrôle de légalité (rejet, demande d'observations, délais) ; procédures de télétransmission ; exigence de preuve et de traçabilité. |
| Preuve | `src/server/mysql/controle-legalite.mjs` (`transmettre` : lève sur `!res.ok` et sur l'absence de référence ; `premier(res.data, ["reference", "accuseReception", …])`) ; `src/server/mysql/actes.mjs` (`hTransmettre` : `return err(502, … { code: "transmission_echec" })`) ; `TODO.md` (chantier « Télétransmission : les refus du contrôle de légalité »). Aucun accès @ctes dans l'atelier : **non vérifié** contre une vraie passerelle. |
| Recommandation | Traiter les **refus** : un état du dossier (transmis / rejeté / observations demandées), le motif porté au certificat, un geste de l'agent (correction, nouvelle transmission, abandon motivé), et sa trace au journal. Puis **éprouver** le client contre une vraie passerelle ou un banc reproduisant le format @ctes. Voir P-46 et P-49. |
| Effort | Moyen |
| Priorité | Moyenne |
| Échéance | 30–90 jours (P-46) ; 90–180 jours (P-49) |
| Statut | **Obsolète** (2026-09-27, livraison 1.6.3c) — **décision du commanditaire, et elle est juste** : *le contrôle de légalité ne peut pas refuser*. Il n'a donc pas de « rejet » à porter dans l'application. Il **accuse réception** — c'est ce que la télétransmission obtient, et c'est ce que le certificat conserve —, et s'il conteste l'acte, il forme un **recours contentieux** (un déféré), qui suit un autre chemin : le logiciel le connaît déjà, par le **délai de recours contentieux** et la constatation d'un recours introduit (`src/lib/execution.js`, `ui/execution-actions.js`). Aucun état de dossier n'était donc à ajouter, aucun motif à porter au certificat, aucun geste à prescrire : le périmètre visé par cette fiche **n'existe pas**. Reste, séparée, l'observation sur la passerelle réelle — le client n'a jamais parlé à une vraie @ctes, et sa lecture des champs d'accusé est **défensive** ; elle se traite à l'exploitation, et le `TODO.md` la porte. |
| Origine | Audit 2026-09-27 (4e campagne) |
| Origine | Audit 2026-09-21 |
