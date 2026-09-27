# La collaboration — deux personnes sur le même acte

Jusqu'à la 1.6.1, Scribae servait plusieurs postes, mais chacun travaillait en
aveugle : deux personnes tenant le même acte s'écrasaient l'une l'autre, et rien
ne le disait. Depuis la **1.6.2**, le service annonce ses changements, chaque poste
relit ce qui lui manque, les brouillons se partagent, et un conflit d'écriture se
**fusionne** au lieu d'écraser.

Ce document décrit le modèle, ce qui est préservé en cas de conflit, ce qui n'est
pas temps réel — et ce que l'exploitant doit avoir pour que cela fonctionne.

## 1. Où cela s'active, et où cela ne s'active pas

La synchronisation ne s'active **que** lorsque la persistance est le **service**
(installation auto-hébergée : voir `docs/DOCKER.md`, `docs/ADMINISTRATION.md`).
Elle ne s'active jamais sur la **démonstration statique**, dont le stockage est
celui du navigateur : là, il n'y a qu'un poste par définition, et rien ne change.

Le branchement tient en une condition (`src/ui/flux.js`) : le stockage est partagé
et son pilote est `service:http`. Partout ailleurs le flux est **absent**, et
l'application se comporte exactement comme avant.

Le témoin de l'en-tête (`.collab-synchro`) dit lequel des trois états on vit :

| État | Ce que cela veut dire |
| --- | --- |
| **temps réel** | le flux est ouvert ; les changements des autres arrivent d'eux-mêmes |
| **veille** | le flux est fermé ou en cours de reprise (onglet en arrière-plan, réseau) ; il se rouvre tout seul |
| **absent** | ce service ne propose pas de flux (version antérieure, ou démonstration) ; rien n'est réessayé en boucle |

## 2. Le flux : le service annonce, le poste relit

`GET /v1/db/flux` tient une connexion ouverte (SSE) et n'y fait passer **que**
l'annonce d'un changement :

```
data: {"type":"collection","collection":"actes","revision":41,"n":2,"ids":["ACTE-…","ACTE-…"]}
```

Jamais de contenu : ni document, ni valeur — seulement la **collection**, sa
**révision**, le nombre d'enregistrements touchés et leurs identifiants. Chaque
poste relit ensuite ce qui lui manque par la route de lecture habituelle, **avec
ses propres droits**. C'est ce qui garde une seule autorité (le service) et une
seule vérité (la base), et c'est aussi ce qui fait que le flux n'a rien à
modérer : il ne transporte pas de données.

- **Un poste lent est abandonné, pas attendu.** Un abonné dont le tampon est plein
  ne reçoit pas l'évènement : il reçoit `{"type":"resync"}`, qui veut dire
  « relis tout ». Le service ne garde donc aucune file par abonné : sa mémoire est
  bornée par le nombre d'abonnés, pas par la lenteur du plus lent.
- **Un battement entretient la connexion.** Un commentaire SSE
  (`: battement`) part toutes les 20 secondes, pour tous les abonnés à la fois.
  Les intermédiaires (nginx, un proxy d'entreprise) ferment volontiers une
  connexion inactive : c'est ce commentaire qui l'empêche.
- **Bornes et rythme.** 256 flux ouverts par service (`flux_sature` au-delà),
  8 ouvertures par adresse et par fenêtre, et la même autorisation que la lecture.
- **Côté poste** (`src/lib/flux.js`), le flux se lit par `fetch` +
  `getReader()` et non par `EventSource` : c'est ce qui permet de porter une clé
  d'API quand le déploiement en exige une. Les trames sont découpées sur la ligne
  vide, et **une trame incomplète est remise au paquet suivant** (un éclatement de
  paquet au mauvais endroit donnerait sinon un flux muet, sans aucune erreur). La
  reprise double son délai (1,2 s → 60 s, plafond), et se réveille à la reprise de
  focus ou au retour du réseau. Un service qui ne connaît pas la route est déclaré
  « absent » et n'est pas réinterrogé avant dix minutes.

## 3. Ce qu'un poste fait d'un évènement

`src/ui/state.js` (section « le temps réel ») applique trois règles :

1. **Ne relire que ce qui a bougé.** L'évènement nomme une collection ; si la
   révision annoncée est celle que le poste connaît déjà — c'est le cas quand il
   vient d'écrire lui-même —, il n'y a rien à faire.
2. **Ne jamais remplacer sous les yeux.** L'enregistrement ouvert dans un éditeur
   (la trame ou l'acte en cours de rédaction) n'est **pas** remplacé. La version
   venue d'ailleurs est retenue (`state.distantes`) et affichée « modifié par
   untel, à telle heure » : c'est la personne qui décide de la reprendre.
3. **Ne pas faire disparaître un travail local.** Un enregistrement créé sur ce
   poste et encore inconnu du service est conservé ; `config` et `users` ne sont
   jamais remplacés d'eux-mêmes (seulement signalés) — les changer sous les pieds
   de l'utilisateur changerait le mode de l'application.

## 4. Le conflit : fusion à trois branches

Le service refuse une écriture dont la révision ne correspond plus : c'est un
**conflit**, et il rend l'enregistrement qu'il détient. Le poste ne renvoie pas
son document tel quel — il le **fusionne** (`src/lib/fusion.js`, puis
`reprendreConflits` dans `src/lib/db/index.js`) :

| Branche | Ce qu'elle est |
| --- | --- |
| `base` | l'état du service **tel que ce poste le connaissait** avant d'écrire |
| `notre` | ce que ce poste veut écrire |
| `leur` | ce que le service détient (rendu par le conflit) |

La fusion est récursive, descend dans les objets, et **reconnaît les listes
identifiées** (les articles, les visas, les items, les questions : tout élément
porteur d'un `id`) : deux personnes qui touchent deux éléments différents gardent
toutes les deux leurs changements. Un seul renvoi est tenté ; s'il échoue encore,
le conflit est rapporté tel quel.

Les cas où l'on ne peut pas deviner :

- **une valeur simple** (un texte, une date, un nombre) touchée des deux côtés :
  c'est **la nôtre** qui est conservée, et le désaccord est signalé — on ne
  remplace pas ce que quelqu'un vient de taper, mais on le lui dit ;
- **une liste non identifiée** (une liste de chaînes, par exemple des entités
  rattachées) : même règle, la nôtre l'emporte, et le désaccord est signalé ;
- **un élément supprimé d'un côté et modifié de l'autre** : le travail de celui
  qui a *modifié* est conservé (une suppression n'est pas un travail à perdre) ;
- **une suppression des deux côtés**, ou d'un côté seulement sans autre
  changement : elle s'applique.

Ce que l'application en dit : le bandeau de collaboration nomme ce qui a été
conservé de part et d'autre (« modifications fusionnées »), et, s'il reste des
désaccords, **lesquels** (« l'objet du document », « visas[vis-2] »…) — jamais le
document entier.

## 5. Les brouillons partagés

Un acte non enregistré n'existe pas dans la base : il n'y a donc rien à relire, et
rien à fusionner. Ce que ce poste est en train de taper voyage pourtant, mais comme
un fait **éphémère** : il est porté par la fiche de **présence** du poste, dans la
même écriture que le battement.

- **Ce qui circule** : les **clés touchées** seulement (et les écarts de
  comparaison), jamais le document — un long acte ne se renvoie pas à chaque
  frappe.
- **Rythme volontairement lent** : la présence s'écrit « vif » pendant une
  rédaction partagée (une écriture au plus toutes les 1,6 s), jamais à chaque
  frappe, jamais deux battements en vol.
- **Ce qui ne circule pas** : au-delà de 24 000 caractères, on ne partage pas.
  Mieux vaut pas de partage qu'un service chargé avec des documents entiers.
- **Ce que le poste fait du brouillon d'autrui** : il remplit les champs que
  l'autre a touchés, **sauf** ceux que vous êtes en train de modifier vous-même,
  et il repaint sans arracher le curseur (il attend que la feuille ait perdu le
  focus, puis réessaie).
- **Ce qui l'efface** : l'enregistrement, la fermeture de l'acte, l'arrêt du poste
  (la présence s'efface), et quelques minutes d'inactivité.

Pour l'éditeur de trame, le partage s'arrête à « untel travaille sur cette
trame » : voir `TODO.md` si l'usage réclame davantage.

## 6. Ce qui n'est PAS temps réel

- **Le verrou n'existe pas.** Deux personnes peuvent modifier le même acte : la
  fusion est là pour rassembler, pas pour empêcher.
- **Ni curseur, ni sélection, ni frappe caractère par caractère.** On partage des
  **valeurs de champ**, pas une session d'édition.
- **La trame** se partage comme l'acte pour ce qui est enregistré, mais son
  brouillon n'est pas partagé champ par champ.
- **Hors ligne**, rien n'est mis en file : les écritures attendent le retour du
  réseau (elles échouent franchement plutôt que d'être rejouées), et la reprise
  se fait par fusion.
- **La démonstration statique** : aucun flux, par construction (§1).

## 7. Pour l'exploitant

Trois choses, et deux seulement sont nouvelles :

1. **Le service auto-hébergé** doit porter la route `GET /v1/db/flux` (elle est
   dans `src/server/mysql/server.mjs`, décrite dans son OpenAPI). Aucun réglage
   nouveau, aucune variable d'environnement : la route suit l'autorisation de
   lecture.
2. **nginx** doit dédier un bloc à cette route : `proxy_buffering off` (sinon la
   réponse est gardée en mémoire et **le flux reste muet, sans aucune erreur**),
   `proxy_read_timeout 3600s`, et `Connection ""` pour ne pas réutiliser la
   connexion amont. Le bloc est déjà écrit dans `src/server/nginx.conf` et
   `src/server/nginx.standalone.conf` — un déploiement existant doit reprendre ces
   deux fichiers.
3. **Le mode mot de passe** exige une session valide pour ouvrir le flux, comme
   pour lire. En mode clé d'API, le flux porte la clé (le client n'utilise pas
   `EventSource`, précisément pour cela).

Pour vérifier sur une installation : ouvrir deux navigateurs (ou deux postes),
se connecter avec deux comptes, ouvrir le même acte dans les deux. Le témoin de
l'en-tête doit dire **temps réel** ; une modification enregistrée d'un côté doit
apparaître de l'autre en une seconde environ ; et un brouillon tapé d'un côté doit
apparaître chez l'autre avec la mention « untel écrit ».

## 8. Où c'est éprouvé

- `src/tests/fusion.test.mjs` — la fusion, hors navigateur : identifiants, ordre
  des listes, suppressions symétriques, profondeur.
- `src/server/mysql/flux.test.mjs` — le concentrateur : diffusion, poste lent
  (resync), abonné mort, plafond, battement, fermeture générale.
- `src/tests/parcours.mjs` — deux épreuves de plus :
  `fusion-sans-perte` (deux postes qui écrivent le même document ne s'effacent
  plus) et `flux-temps-reel` (découpage des trames SSE, trame incomplète remise au
  paquet suivant, `resync` reconnu, service sans flux déclaré « absent »).

Ce qui reste à faire, et qui est écrit dans `TODO.md` : **l'essai à deux
machines** sur une installation réelle (deux navigateurs, nginx compris) — c'est
là que le `proxy_buffering` décide si le flux arrive ou reste muet.
