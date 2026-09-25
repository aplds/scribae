# L'API REST de Scribae

Scribae expose tout ce qu'il sait faire par une API REST en JSON. C'est elle que le navigateur interroge quand vous travaillez, c'est elle qu'un script d'import, un logiciel de gestion documentaire ou un tableur peuvent interroger à leur tour, et c'est elle qu'il faut connaître pour brancher un prestataire de signature électronique.

Cette référence est **engendrée depuis le code** (`src/lib/api-reference.js`, par `node scripts/generer-api.mjs`) : elle décrit exactement la surface que le service répond, ni plus ni moins. Le même document alimente l'écran « API REST » de l'application, où un panneau de commande permet d'envoyer une requête et de lire la réponse sans quitter la page.

## Deux familles, une même porte

Les routes se rangent en deux familles, servies par la même façade et le même contrôle d'accès :

- la **persistance partagée** — `/v1/db/…` : le référentiel, les trames, les actes et les comptes, enregistrement par enregistrement, avec révisions et détection de conflits. C'est ce que le navigateur synchronise en continu ;
- le **domaine** — `/v1/actes/…`, `/v1/signatures/…`, `/v1/publications/…` : le dépôt d'un acte finalisé, l'ouverture d'un circuit de signature, la publication au recueil et les identifiants persistants (ELI). C'est ce qu'un script ou un prestataire appelle.

S'y ajoutent les routes de **service** (`/v1/config`, `/v1/auth/…`, `/v1/courriel`) et les **adresses publiques du site** (`/recueil`, `/robots.txt`, `/llms.txt`, `/sitemap.xml`), qui ne passent pas par `/v1/`.

Un déploiement autonome (Docker) sert les deux familles depuis son propre domaine. Dans la version hébergée, seules les routes marquées « auto-hébergé » ci-dessous sont servies par votre installation : la persistance partagée et la plateforme sont prises en charge par le service.

## Adresses, en-têtes, conventions

Les chemins ci-dessous sont relatifs à la base de l'API. Sous Docker, la base est l'adresse de votre déploiement suivie de `/v1`, par exemple `https://actes.maville.fr/v1`. Tous les échanges sont en JSON (`content-type: application/json`), sauf mention contraire.

```bash
curl -X GET 'https://api.exemple.fr/v1/health' \
  -H 'accept: application/json'
```

En mode hébergé ou en mode annuaire (OIDC), l'appelant s'authentifie par l'en-tête `authorization: Bearer <jeton>`. En mode mot de passe, la session est portée par un cookie ; les écritures exigent alors le jeton anti-CSRF renvoyé par `GET /v1/auth/session`. Les clés d'API se créent dans « Référentiel › Autorisation » ; leur rôle détermine ce qu'elles peuvent faire.

Une opération annoncée sous un rôle exige **au moins** ce rôle : `admin` peut tout ce que peut `editeur`, et ainsi de suite.

## Service

Santé du service et description machine (OpenAPI).

### `GET /v1/health` — État du service

Le service répond-il, quelle version, combien d'objets il détient (actes déposés, circuits, publications). C'est l'appel qu'on fait d'abord quand « rien ne marche » : il distingue une API injoignable d'une API qui refuse une requête.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/health' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le service est là |

| Champ | Type | Description |
|---|---|---|
| statut | string | « ok » |
| version | string | Version du service |
| objets | object | { actes, signatures, publications } |

### `GET /v1/` — Description OpenAPI 3.1

La description machine de toute l'API, au format OpenAPI : noms d'opérations, schémas de corps, réponses. C'est ce document que les outils (Postman, Insomnia, un client généré) lisent, et ce qui alimente l'onglet « API & journal ».

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le document OpenAPI |

### `GET /v1/config` — Réglages de référentiel et état du prestataire

Les variables de RÉFÉRENTIEL posées dans le `.env` du déploiement, sous forme de chemins pointés, et les valeurs REFUSÉES avec leur motif — les variables de l'annuaire (`SCRIBA_ANNUAIRE_*`) comprises. Y figure aussi l'état du prestataire de signature (transport, adresse, niveau, chemins, et un booléen disant si la clé est là — jamais la clé). Aucun secret ne sort par cette route : elle sert à l'écran de connexion avant toute session.

- **Authentification** : publique
- **Service** : auto-hébergé

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/config' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Réglages, erreurs, état du prestataire |

| Champ | Type | Description |
|---|---|---|
| variables | object | { "brand.name": "…", "numbering.pad": 3 } |
| erreurs | array | Variables refusées : variable, valeur, motif |
| prestataire | object | État du prestataire : actif, url, niveau, cle (booléen), motif |

## Autorisation

Le provisionnement du service, les clés d'API et leurs rôles, le journal d'audit.

### `GET /v1/auth/etat` — État de l'autorisation du service

Route PUBLIQUE : dit si le service est administrable (`provisionne` — soit une session l'administre, soit il a reçu sa première clé), les rôles que peuvent porter les clés, et par quel mode il s'administre (`session` en mode « mot de passe » ou par annuaire, `service` quand il faut déposer la première clé). N'apprend rien des clés elles-mêmes.

- **Authentification** : publique
- **Service** : plateforme

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/auth/etat' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | { provisionne, roles, mode } |

| Champ | Type | Description |
|---|---|---|
| provisionne | booléen | Le service est-il administrable ? |
| mode | string | session \| service |
| roles | array | Les rôles qu'une clé peut porter |

### `POST /v1/auth/bootstrap` — Provisionner le service (première clé)

Geste d'INSTALLATION : dépose la PREMIÈRE clé d'administration d'un service neuf, quand il n'en a encore aucune. Une seule fois — un service déjà pourvu répond 409 `service_deja_provisionne`. La clé est tirée par le client ; le service n'en conserve que l'empreinte SHA-256.

- **Authentification** : publique
- **Service** : plateforme

**Corps de la requête**

```json
{
  "cle": "<clé tirée au hasard, 32 caractères ou plus>",
  "label": "Administrateur",
  "role": "administrateur"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/bootstrap' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -d '{"cle":"<clé tirée au hasard, 32 caractères ou plus>","label":"Administrateur","role":"administrateur"}'
```

| Code | Signification |
|---|---|
| 201 | Service provisionné |
| 409 | Déjà provisionné (service_deja_provisionne) |
| 422 | Clé trop courte (cle_trop_courte) |

### `GET /v1/auth/cles` — Lister les clés d'API

Les clés d'API que le service accepte : leur identifiant, leur libellé, leur rôle et leur date de création — jamais la valeur, ni l'empreinte (c'est le client qui tire la clé, et n'en transmet que l'empreinte SHA-256). Ces clés sont des COMPTES DE SERVICE : elles n'apparaissent nulle part dans le référentiel.

- **Authentification** : administrateur
- **Service** : plateforme

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/auth/cles' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Les clés |
| 403 | Rôle administrateur requis |

### `POST /v1/auth/cles` — Créer une clé d'API

Enregistre une clé (son empreinte SHA-256) et son rôle. Le rôle commande les routes que la clé ouvre : `lecteur` ne peut pas publier, `redacteur` ne peut pas gérer les clés, `prestataire` n'ouvre que la notification de signature.

- **Authentification** : administrateur
- **Service** : plateforme

**Corps de la requête**

```json
{
  "cle": "<la clé, 32 caractères ou plus — le service n'en garde que l'empreinte>",
  "role": "redacteur",
  "label": "Intégration intranet"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/cles' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"cle":"<la clé, 32 caractères ou plus — le service n'en garde que l'empreinte>","role":"redacteur","label":"Intégration intranet"}'
```

| Code | Signification |
|---|---|
| 201 | Clé créée |
| 422 | Clé trop courte (cle_trop_courte) |

### `POST /v1/auth/cles/{id}/revoquer` — Révoquer une clé

- **Authentification** : administrateur
- **Service** : plateforme

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de la clé |

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/cles/ACT-12/revoquer' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Clé révoquée |
| 404 | Clé inconnue |
| 409 | Dernière clé d'administration (derniere_cle_admin) |

### `GET /v1/journal` — Journal d'audit du service

Le journal APPEND-ONLY tenu par le service (et non par le poste) : chaque geste sensible y laisse une ligne, et chaque ligne scelle la précédente par une empreinte. Modifier une ligne rompt la chaîne, ce que le champ `scelle` révèle.

- **Authentification** : administrateur
- **Service** : plateforme

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/journal' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Les dernières entrées, et l'état du scellement |

## Comptes et sessions

Le mode d'authentification, l'ouverture de session, les mots de passe locaux.

### `GET /v1/auth/config` — Mode d'authentification du service

Le mode du déploiement (`AUTH_MODE` : demo, password, oidc), si les comptes locaux sont ouverts (`comptesLocaux`), si les données se lisent par une session (`session`), le commutateur de démonstration, et l'état du déploiement (base joignable, compte d'administration amorcé). Porte aussi les RÉGLAGES DE L'ANNUAIRE de la collectivité (`annuaire` : fournisseur, portées, correspondance des groupes, seconde porte, points de terminaison) : le service les relit du référentiel et applique par-dessus les variables `SCRIBA_ANNUAIRE_*` du `.env`. C'est nécessaire parce qu'en mode « comptes locaux » le référentiel n'est lisible qu'avec une session, et l'écran de connexion vient avant. En mode « demo » seulement, la liste des comptes de démonstration. Aucun secret.

- **Authentification** : publique
- **Service** : auto-hébergé

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/auth/config' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Mode, état, réglages de l'annuaire, comptes de démonstration éventuels |

| Champ | Type | Description |
|---|---|---|
| auth | string | demo \| password \| oidc |
| comptesLocaux | booléen | La connexion identifiant + mot de passe est-elle ouverte ? |
| annuaire | objet\|null | Réglages publics de l'annuaire (liste blanche, jamais de secret) |
| annuaireService | booléen\|null | Le service sait-il ouvrir une session d'annuaire ? (vrai = c'est lui le client OIDC : la seconde porte est proposée même quand les données se lisent par une session) |
| adminAmorce | booléen\|null | Le compte d'administration du .env peut-il se connecter ? |

### `POST /v1/auth/connexion` — Ouvrir une session

Vérifie l'identifiant et le mot de passe, puis pose deux cookies : la session (HttpOnly) et le jeton anti-CSRF. Le message est identique pour un identifiant inconnu et un mot de passe faux ; le compte se bloque progressivement après plusieurs échecs.

- **Authentification** : publique
- **Service** : auto-hébergé

**Corps de la requête**

```json
{
  "login": "j.mercier",
  "motDePasse": "••••••••••"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/connexion' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -d '{"login":"j.mercier","motDePasse":"••••••••••"}'
```

| Code | Signification |
|---|---|
| 200 | Session ouverte |
| 401 | Identifiants invalides |
| 429 | Compte bloqué quelques instants |

### `POST /v1/auth/annuaire` — Ouvrir une session par l'annuaire de la collectivité

C'est le SERVICE qui est le client OIDC : il découvre le fournisseur, échange le code d'autorisation (avec le vérificateur PKCE que le navigateur a gardé), vérifie le jeton d'identité (signature par le JWKS du fournisseur, émetteur, audience, validité, nonce), en tire le compte (groupes → rôle, services et entité), l'écrit au référentiel, puis ouvre SA session — les mêmes cookies que la connexion par mot de passe. Aucun appel ne part du navigateur vers le fournisseur : le fournisseur n'a donc pas besoin d'autoriser le CORS (c'est ce qui fait fonctionner un annuaire qui ne l'ouvre pas), et l'agent lit les actes comme tout le monde.

- **Authentification** : publique
- **Service** : auto-hébergé

**Corps de la requête**

```json
{
  "code": "…",
  "verifier": "…",
  "redirectUri": "https://actes.maville.fr/",
  "nonce": "…"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/annuaire' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -d '{"code":"…","verifier":"…","redirectUri":"https://actes.maville.fr/","nonce":"…"}'
```

| Code | Signification |
|---|---|
| 200 | Session ouverte ; `checks` dit ce qui a été vérifié, `created`/`linked` si le compte a été créé ou repris |
| 401 | Code invalide, échange refusé, ou fournisseur injoignable |
| 403 | Jeton refusé, ou compte inconnu et création automatique éteinte |
| 404 | Aucun annuaire branché sur ce service |
| 503 | Le service n'a pas le moyen d'appeler un fournisseur |

| Champ | Type | Description |
|---|---|---|
| code | string | Le code d'autorisation reçu du fournisseur |
| verifier | string | Le vérificateur PKCE (code_verifier), détenu par le navigateur |
| redirectUri | string | La même adresse de retour que celle de la demande d'autorisation |
| nonce | string | Le nonce de la demande, que le jeton doit porter |

### `POST /v1/auth/annuaire/decouverte` — Éprouver l'annuaire (bouton « Découverte »)

Le SERVICE lit `/.well-known/openid-configuration` chez le fournisseur et rend les points de terminaison. C'est le bouton « Vérifier la découverte du fournisseur » de l'administration : l'appel partant du service et non du navigateur, un annuaire sans en-têtes CORS se branche comme les autres. Un administrateur (session) peut faire éprouver l'adresse qu'il vient de saisir (`issuer`) et des points de terminaison à la main (`endpoints`) ; tout autre appelant n'obtient que ce que le service a déjà enregistré.

- **Authentification** : publique
- **Service** : auto-hébergé

**Corps de la requête**

```json
{
  "issuer": "https://annuaire.maville.fr/realms/agents",
  "endpoints": {
    "authorization": "https://…/auth",
    "token": "https://…/token"
  }
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/annuaire/decouverte' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -d '{"issuer":"https://annuaire.maville.fr/realms/agents","endpoints":{"authorization":"https://…/auth","token":"https://…/token"}}'
```

| Code | Signification |
|---|---|
| 200 | Les points de terminaison retenus, et leur source (découverte ou manuel) |
| 404 | Aucun annuaire branché sur ce service |
| 502 | Découverte impossible (fournisseur injoignable, document incomplet) |
| 503 | Le service n'a pas le moyen d'appeler un fournisseur |

### `GET /v1/auth/session` — Session courante

Rend le compte de la session ouverte, ou 401. C'est l'appel que fait l'application au démarrage pour savoir si la session tient encore.

- **Authentification** : publique
- **Service** : auto-hébergé

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/auth/session' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le compte de la session |
| 401 | Session absente ou expirée |

### `POST /v1/auth/deconnexion` — Fermer la session

Efface la session en base et les cookies. Le cookie HttpOnly ne peut pas être effacé par la page : c'est le service qui le fait — et qui invalide la session.

- **Authentification** : publique
- **Service** : auto-hébergé

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/deconnexion' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Session fermée |

### `POST /v1/auth/mot-de-passe` — Changer son mot de passe

Exige le mot de passe actuel. Les autres sessions ne sont pas fermées : aucune session n'est privilégiée par rapport à une autre.

- **Authentification** : publique
- **Service** : auto-hébergé

**Corps de la requête**

```json
{
  "motDePasseActuel": "••••••••••",
  "motDePasse": "••••••••••••"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/mot-de-passe' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -d '{"motDePasseActuel":"••••••••••","motDePasse":"••••••••••••"}'
```

| Code | Signification |
|---|---|
| 200 | Mot de passe changé |
| 400 | Mot de passe actuel incorrect |
| 422 | Nouveau mot de passe trop faible |

### `GET /v1/auth/comptes` — État des mots de passe

Pour chaque compte : mot de passe défini ou non, changement exigé, date, échecs, blocage. AUCUN dérivé n'est renvoyé — ni le mot de passe, ni son empreinte.

- **Authentification** : administrateur
- **Service** : auto-hébergé

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/auth/comptes' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | État des comptes |
| 403 | Rôle administrateur requis |

### `POST /v1/auth/comptes/{id}/mot-de-passe` — Définir ou remettre un mot de passe

Définit le mot de passe d'un compte, ou le REMET. Sans `motDePasse` dans le corps, le service en ENGENDRE un (16 caractères, à changer à la première connexion) et ne le rend qu'ici, une seule fois : c'est la remise d'un accès à un agent.

- **Authentification** : administrateur
- **Service** : auto-hébergé

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant du compte |

**Corps de la requête**

```json
{
  "motDePasse": "••••••••••••",
  "mustChange": true
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/auth/comptes/ACT-12/mot-de-passe' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"motDePasse":"••••••••••••","mustChange":true}'
```

| Code | Signification |
|---|---|
| 200 | Mot de passe défini (le provisoire figure dans la réponse s'il a été engendré) |
| 404 | Compte inconnu |
| 422 | Mot de passe trop faible |

### `DELETE /v1/auth/comptes/{id}/mot-de-passe` — Retirer le mot de passe d'un compte

Le compte cesse de pouvoir ouvrir de session, et ses sessions ouvertes sont fermées. Le compte lui-même reste au référentiel.

- **Authentification** : administrateur
- **Service** : auto-hébergé

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant du compte |

**Exemple**

```bash
curl -X DELETE 'https://api.exemple.fr/v1/auth/comptes/ACT-12/mot-de-passe' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Mot de passe retiré |
| 404 | Compte inconnu |

## Persistance partagée

Les collections du référentiel, enregistrement par enregistrement.

### `GET /v1/db/health` — État de la base de données

Le pilote de persistance et le nombre d'enregistrements par collection. C'est l'appel qui dit si la base répond, et qui alimente le badge de l'application.

- **Authentification** : publique
- **Service** : auto-hébergé

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/db/health' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Base disponible |
| 503 | Base non prête (base_indisponible) |

### `GET /v1/db/collections/{collection}` — Lire une collection

Renvoie tous les enregistrements d'une collection, chacun avec sa révision. Les collections sont `config`, `trames`, `actes`, `reprises`, `users`, `meta`, `journal`, `presence`, `informations`. En mode « password » ou « oidc », la lecture exige une session ouverte.

- **Authentification** : lecteur
- **Service** : auto-hébergé

| Paramètre | Type | Description |
|---|---|---|
| collection | string | config \| trames \| actes \| reprises \| users \| meta \| journal \| presence \| informations |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/db/collections/actes' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Les enregistrements de la collection |
| 401 | Session absente |
| 404 | Collection inconnue |

### `POST /v1/db/collections/{collection}/sync` — Synchroniser une collection

Applique des écritures et des suppressions, enregistrement par enregistrement. Chaque écriture porte la révision connue du client : si le service en détient une autre, l'enregistrement est renvoyé en CONFLIT au lieu d'être écrasé — c'est ce qui permet à deux postes d'écrire sans se détruire mutuellement.

- **Authentification** : redacteur
- **Service** : auto-hébergé

| Paramètre | Type | Description |
|---|---|---|
| collection | string | La collection à synchroniser |

**Corps de la requête**

```json
{
  "upserts": [
    {
      "id": "act-1",
      "revision": 4,
      "data": {
        "statut": "pret"
      }
    }
  ],
  "deletes": [],
  "force": false
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/db/collections/actes/sync' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"upserts":[{"id":"act-1","revision":4,"data":{"statut":"pret"}}],"deletes":[],"force":false}'
```

| Code | Signification |
|---|---|
| 200 | Synchronisation appliquée (avec la liste des conflits éventuels) |
| 403 | Rôle insuffisant (ou force sans le rôle administrateur) |
| 413 | Trop d'enregistrements |
| 507 | Base pleine |

## Actes

Dépôt des actes finalisés, suivi, dossier interne.

### `GET /v1/actes` — Lister les actes déposés

Les actes déposés auprès du service, du plus récent au plus ancien : numéro, objet, nature, entité, statut, empreinte, publication et circuit de signature.

- **Authentification** : lecteur
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/actes' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | { actes: [ … ] } |

### `POST /v1/actes` — Déposer un acte finalisé

Reçoit l'acte finalisé (Akoma Ntoso) et le conserve en vue de la signature. Redéposer un document identique encore en circuit renvoie le même acte (200 au lieu de 201). Le champ `publishable: false` rend la publication impossible, même après signature : c'est le cas d'un acte individuel. Le champ `reprise: true` déclare le dépôt comme la REPRISE d'un acte ancien : il autorise sa publication sans signature (voir « Publier un acte au recueil »).

- **Authentification** : redacteur
- **Service** : les deux

**Corps de la requête**

```json
{
  "akn": "<akomaNtoso>…</akomaNtoso>",
  "numero": "1998-042",
  "objet": "Création du service de restauration scolaire",
  "nature": "arrete",
  "entityId": "ent-vsl",
  "entityName": "Ville de Valmont-sur-Loire",
  "dateSignature": "2026-09-22",
  "trameId": "trame-tarifs",
  "publishable": true,
  "controleLegalite": false
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/actes' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"akn":"<akomaNtoso>…</akomaNtoso>","numero":"1998-042","objet":"Création du service de restauration scolaire","nature":"arrete","entityId":"ent-vsl","entityName":"Ville de Valmont-sur-Loire","dateSignature":"2026-09-22","trameId":"trame-tarifs","publishable":true,"controleLegalite":false}'
```

| Code | Signification |
|---|---|
| 201 | Acte déposé |
| 200 | Dépôt identique déjà en circuit (idempotent) |
| 413 | Document trop volumineux |

| Champ | Type | Description |
|---|---|---|
| akn | string | Le document Akoma Ntoso 3.0 (obligatoire) |
| publishable | booléen | false : acte individuel, jamais publié au recueil |
| controleLegalite | booléen | true : la publication attendra la transmission |
| reprise | booléen | true : reprise d'un acte ancien, publiable sans signature |

### `GET /v1/actes/{id}` — Lire un acte déposé

- **Authentification** : lecteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte (ACT-…) |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/actes/ACT-12' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Le résumé de l'acte |
| 404 | Acte inconnu |

### `GET /v1/actes/{id}/document` — Lire le document déposé

Rend le document tel qu'il a été déposé, avec son empreinte SHA-256 — c'est cette empreinte que le service comparera à celle du document signé.

- **Authentification** : lecteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/actes/ACT-12/document' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | { format, document, sha256 } |
| 404 | Acte inconnu |

### `GET /v1/actes/{id}/dossier-signature` — Lire le dossier de signature interne

La PART INTERNE de l'original signé : mentions nominatives du signataire (nom, courriel, compte, moyen d'authentification) et trace des courriels de notification. Ces données ne sont JAMAIS diffusées : elles ne sortent que par cette route, protégée par un jeton ou une session.

- **Authentification** : administrateur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/actes/ACT-12/dossier-signature' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Le dossier interne |
| 404 | Aucun dossier interne (dossier_absent) |

## Signature

Circuits de signature, notification du prestataire, circuits externes.

### `POST /v1/actes/{id}/signature` — Envoyer un acte en signature

Ouvre un circuit de signature auprès du prestataire. Le corps porte les signataires, le niveau demandé, l'adresse de notification et les réglages du prestataire (`api` : transport, adresse, identifiant, niveau, délai, points de terminaison). Quand le transport vaut « service » et qu'une adresse ET une clé sont configurées (SCRIBA_SIGNATURE_API_CLE), c'est le SERVICE qui appelle le prestataire : la réponse porte le lien de signature réel. Sinon le circuit est simulé (`simulation: true`). La clé n'est jamais transmise par le client.

- **Authentification** : redacteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte déposé |

**Corps de la requête**

```json
{
  "signataires": [
    {
      "nom": "Jeanne Mercier",
      "courriel": "j.mercier@exemple.fr",
      "fonction": "Le maire",
      "ordre": 1
    }
  ],
  "niveau": "avancee",
  "urlNotification": "https://actes.exemple.fr/v1/webhooks/signature",
  "api": {
    "transport": "service",
    "url": "https://signature.exemple.fr/api/v1",
    "prestataire": "esup-signature",
    "niveau": "avancee",
    "timeoutMs": 20000,
    "cheminDocument": "/documents",
    "cheminSignataires": "/documents/{document}/signataires",
    "cheminDemarrer": "/documents/{document}/demarrer",
    "cheminStatut": "/documents/{document}"
  }
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/actes/ACT-12/signature' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"signataires":[{"nom":"Jeanne Mercier","courriel":"j.mercier@exemple.fr","fonction":"Le maire","ordre":1}],"niveau":"avancee","urlNotification":"https://actes.exemple.fr/v1/webhooks/signature","api":{"transport":"service","url":"https://signature.exemple.fr/api/v1","prestataire":"esup-signature","niveau":"avancee","timeoutMs":20000,"cheminDocument":"/documents","cheminSignataires":"/documents/{document}/signataires","cheminDemarrer":"/documents/{document}/demarrer","cheminStatut":"/documents/{document}"}}'
```

| Code | Signification |
|---|---|
| 202 | Circuit ouvert |
| 409 | Acte déjà signé, ou validation / révision non achevée |
| 502 | Le prestataire a refusé le circuit (prestataire_indisponible) |

| Champ | Type | Description |
|---|---|---|
| signatureId | string | Identifiant du circuit (SIG-…) |
| lienSignature | string | Le lien de signature chez le prestataire, quand il est branché |
| simulation | booléen | true : aucun appel n'est sorti |

### `GET /v1/signatures` — Lister les circuits de signature

- **Authentification** : lecteur
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/signatures' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | { signatures: [ … ] } |

### `GET /v1/signatures/{id}` — Suivre un circuit

L'état du circuit : en_attente, signee, refusee, rejetee. C'est la route que l'application interroge pour relever le statut — et qui fait revenir l'acte signé quand le prestataire l'a notifié.

- **Authentification** : lecteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant du circuit |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/signatures/ACT-12' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Statut du circuit |
| 404 | Circuit inconnu |

### `GET /v1/signatures/{id}/document-signe` — Récupérer l'acte signé

L'original signé, SANS sa part interne : celle-ci se lit par `/v1/actes/{id}/dossier-signature`.

- **Authentification** : lecteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant du circuit |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/signatures/ACT-12/document-signe' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | L'original signé |
| 404 | Pas encore de document signé |

### `POST /v1/webhooks/signature` — Notification du prestataire (retour signé)

Appelée par le PRESTATAIRE lorsque la signature est apposée. Le service recalcule l'empreinte SHA-256 du document signé et la compare à celle de l'acte déposé : une différence est refusée (409) — la signature n'est jamais acceptée sur un document qui n'est pas celui qui a été déposé. Le rôle exigé est `prestataire` (ou `administrateur`).

- **Authentification** : prestataire
- **Service** : les deux

**Corps de la requête**

```json
{
  "signatureId": "SIG-3",
  "statut": "signee",
  "documentSigne": {
    "document": {
      "akn": "…",
      "sha256": "…"
    },
    "signatures": [
      {
        "signeLe": "2026-09-22T10:12:00Z"
      }
    ]
  }
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/webhooks/signature' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"signatureId":"SIG-3","statut":"signee","documentSigne":{"document":{"akn":"…","sha256":"…"},"signatures":[{"signeLe":"2026-09-22T10:12:00Z"}]}}'
```

| Code | Signification |
|---|---|
| 200 | Signature acceptée |
| 403 | Rôle prestataire requis |
| 409 | Empreinte divergente (signature_rejetee) |

### `POST /v1/actes/{id}/signature-externe` — Déposer la version signée (circuit externe)

Circuit externe — papier, ou outil tiers que l'application ne pilote pas : le client dépose ici le PDF signé et son empreinte SHA-256. Le service n'a pas de signature cryptographique à vérifier : il enregistre la pièce et fait passer l'acte au statut « signée ». Une nouvelle version signée annule la certification de conformité précédente.

- **Authentification** : redacteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte déposé |

**Corps de la requête**

```json
{
  "nom": "acte-signe.pdf",
  "taille": 182345,
  "sha256": "…",
  "url": "https://…/acte-signe.pdf"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/actes/ACT-12/signature-externe' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"nom":"acte-signe.pdf","taille":182345,"sha256":"…","url":"https://…/acte-signe.pdf"}'
```

| Code | Signification |
|---|---|
| 200 | Version signée enregistrée |
| 409 | L'acte ne suit pas le circuit externe (circuit_non_externe) |

### `POST /v1/actes/{id}/conformite` — Certifier (ou refuser) la conformité de la pièce signée

Le RÉVISEUR certifie que la pièce signée est conforme à la version numérique qui sera publiée. Son contrôle porte sur la PIÈCE SIGNÉE, non sur le texte avant signature. Sans certification, la publication est refusée (409 `conformite_non_certifiee`).

- **Authentification** : redacteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte |

**Corps de la requête**

```json
{
  "statut": "conforme",
  "points": [
    "Signature manuscrite présente",
    "Mentions de l'acte conformes"
  ],
  "remarque": ""
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/actes/ACT-12/conformite' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"statut":"conforme","points":["Signature manuscrite présente","Mentions de l'acte conformes"],"remarque":""}'
```

| Code | Signification |
|---|---|
| 200 | Certification enregistrée |

### `POST /v1/actes/{id}/transmission` — Transmettre au contrôle de légalité

L'acte signé part vers l'API d'envoi de la préfecture, qui en accuse réception. L'accusé vaut certificat informatique de transmission, déposé sur le document. Un acte déclaré soumis au contrôle de légalité ne peut PAS être publié avant sa transmission (409 `transmission_absente`).

- **Authentification** : redacteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte |

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/actes/ACT-12/transmission' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Transmission enregistrée |
| 409 | Acte non signé (acte_non_signe) |

### `GET /v1/actes/{id}/transmission` — Lire la transmission

- **Authentification** : lecteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/actes/ACT-12/transmission' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | La transmission |
| 404 | Aucune transmission (transmission_absente) |

## Publication et ELI

Recueil public, identifiants persistants, retrait et épinglage.

### `POST /v1/actes/{id}/publication` — Publier un acte au recueil

Dépose la version en ligne au recueil et attribue l'identifiant ELI. La publication est refusée tant que l'acte n'est pas signé (chaîne d'intégrité), si l'acte a été déclaré non publiable (acte_non_publiable), s'il était soumis au contrôle de légalité et n'a pas été transmis (transmission_absente), et si la date de publication précède la date de signature. Fournir un en-tête « Idempotency-Key » rend l'appel rejouable sans créer de doublon. Le champ `juridique: false` publie un DOCUMENT NON JURIDIQUE (verbatim de séance, déclaration, vœu) : le service n'inscrit alors aucune date d'opposabilité — il l'impose vide —, et le recueil le présente comme un document, sans opposabilité. Les champs `informative: true` et `reprise: true` publient la REPRISE d'un acte ancien : la publication est alors acceptée sans signature, à condition que le dépôt ait lui-même porté `reprise: true` (sinon `acte_non_reprise`), elle ne rend rien opposable, et l'original conservé voyage dans `originalExterne` (le service le garde comme la pièce qui fait foi).

- **Authentification** : redacteur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'acte déposé |

**Corps de la requête**

```json
{
  "html": "<article>…</article>",
  "akn": "…",
  "original": {
    "document": {
      "akn": "…"
    },
    "signatures": []
  },
  "datePublication": "1998-06-12",
  "recueil": "",
  "themeId": "fam-tarifs",
  "themeLabel": "Tarifs",
  "reprise": true,
  "informative": true,
  "originalExterne": {
    "url": "https://…/original.pdf",
    "sha256": "…",
    "nom": "original.pdf"
  },
  "provenance": "Registre des délibérations, 1998"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/actes/ACT-12/publication' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"html":"<article>…</article>","akn":"…","original":{"document":{"akn":"…"},"signatures":[]},"datePublication":"1998-06-12","recueil":"","themeId":"fam-tarifs","themeLabel":"Tarifs","reprise":true,"informative":true,"originalExterne":{"url":"https://…/original.pdf","sha256":"…","nom":"original.pdf"},"provenance":"Registre des délibérations, 1998"}'
```

| Code | Signification |
|---|---|
| 200 | Publication déposée |
| 409 | Chaîne d'intégrité rompue |
| 422 | Date de publication antérieure à la signature |

### `GET /v1/publications` — Lister le recueil

Le registre du recueil public : tous les actes publiés, du plus récent au plus ancien, avec leur identifiant ELI, leur thème et leur date d'opposabilité. C'est cette liste qui alimente le recueil et le plan de site.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/publications' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | { publications: [ … ] } |

### `GET /v1/publications/{cle}` — Lire une publication

L'acte publié et ses versions, la plus récente marquée `latest`. Le dossier interne ne sort JAMAIS par cette route.

- **Authentification** : publique
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| cle | string | Clé de publication |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/publications/2026-412-VSL' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | L'acte publié et ses versions |
| 404 | Publication inconnue |

### `POST /v1/publications/{cle}/retrait` — Retirer une publication

Le retrait ne supprime rien : il retire l'acte du recueil en laissant sa trace (un acte retiré reste citable — c'est ce qui distingue un retrait d'une suppression).

- **Authentification** : administrateur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| cle | string | Clé de publication |

**Corps de la requête**

```json
{
  "motif": "Publication remplacée par l'acte n° 2026-413-VSL"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/publications/2026-412-VSL/retrait' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"motif":"Publication remplacée par l'acte n° 2026-413-VSL"}'
```

| Code | Signification |
|---|---|
| 200 | Publication retirée |

### `POST /v1/publications/{cle}/epingle` — Épingler une publication

Met l'acte en avant en tête du recueil public (l'équivalent d'une une).

- **Authentification** : editeur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| cle | string | Clé de publication |

**Corps de la requête**

```json
{
  "epingle": true
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/publications/2026-412-VSL/epingle' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"epingle":true}'
```

| Code | Signification |
|---|---|
| 200 | Publication épinglée |

### `GET /v1/eli/{actTypeId}/{annee}/{numero}/{entite}` — Résoudre un identifiant ELI

Rend la publication correspondant à un identifiant persistant ELI — la forme citable d'un acte (« eli:/fr/… »). C'est ce que résout un lien stable, des années plus tard.

- **Authentification** : publique
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| actTypeId | string | Type d'acte (arrete, deliberation…) |
| annee | string | Année |
| numero | string | Numéro |
| entite | string | Code de l'entité |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/eli/arrete/2026/412/VSL' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | La publication |
| 404 | ELI inconnu |

### `GET /v1/eli/{actTypeId}/{annee}/{numero}/{entite}/original` — L'original signé d'un acte publié

L'original signé (part publique : document, signatures, horodatage) — ce que le recueil montre comme « l'original ».

- **Authentification** : publique
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| actTypeId | string | Type d'acte |
| annee | string | Année |
| numero | string | Numéro |
| entite | string | Code de l'entité |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/eli/arrete/2026/412/VSL/original' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | L'original signé |
| 404 | ELI inconnu |

### `POST /v1/admin/purge` — Remettre le service à zéro

Vide les actes déposés, les circuits de signature et les publications — le pendant, côté service, du bouton « Repartir d'un référentiel vierge ». Exige `{ "confirmation": "repurge" }` : un appel accidentel ne doit pas l'emporter.

- **Authentification** : administrateur
- **Service** : les deux

**Corps de la requête**

```json
{
  "confirmation": "repurge"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/admin/purge' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"confirmation":"repurge"}'
```

| Code | Signification |
|---|---|
| 200 | Service purgé |
| 400 | Confirmation absente (confirmation_absente) |

## Bulletins

Le Journal des actes : numéros par période, abonnés et flux.

### `GET /v1/bulletins` — État public du bulletin

L'état du bulletin tel qu'un lecteur le voit : ouvert ou non, titre, cadence, prochaine parution, bulletins parus et — si le service a un serveur SMTP ET une adresse publique déclarée — l'ouverture de l'abonnement par courriel. Aucun abonné n'y figure.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/bulletins' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | { actif, titre, cadence, prochaine, bulletins, abonnement } |

### `GET /v1/bulletins/{id}` — Lire un bulletin

Un numéro : son titre, sa période, son rang dans l'année, et ses actes classés par entité puis par thématique. Un numéro provisoire (la période en cours) n'est pas servi ici.

- **Authentification** : publique
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant du bulletin (sa date de début, « 2026-09-01 ») |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/bulletins/ACT-12' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le bulletin |
| 404 | Bulletin inconnu (bulletin_inconnu) |

### `POST /v1/bulletins/abonnement` — Demander l'abonnement au bulletin

Enregistre une demande d'abonnement et adresse un courriel de CONFIRMATION (double consentement) : l'abonnement ne prend effet qu'une fois le lien du message ouvert. La réponse ne dit JAMAIS si l'adresse était déjà inscrite. La page publique du bulletin poste ici depuis un vrai formulaire (`application/x-www-form-urlencoded`), mais l'API attend du JSON.

- **Authentification** : publique
- **Service** : les deux

**Corps de la requête**

```json
{
  "courriel": "lecteur@exemple.fr",
  "nom": "Camille Dupont"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/bulletins/abonnement' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -d '{"courriel":"lecteur@exemple.fr","nom":"Camille Dupont"}'
```

| Code | Signification |
|---|---|
| 202 | Demande enregistrée, courriel de confirmation adressé |
| 409 | Le bulletin n'est pas ouvert sur ce recueil |
| 422 | Adresse électronique invalide |
| 507 | Le nombre maximal d'abonnés est atteint |

### `POST /v1/bulletins/abonnement/confirmation` — Confirmer un abonnement

Le jeton reçu par courriel. Un jeton inconnu répond 404 sans rien révéler de l'existence d'une fiche.

- **Authentification** : publique
- **Service** : les deux

**Corps de la requête**

```json
{
  "jeton": "…"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/bulletins/abonnement/confirmation' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -d '{"jeton":"…"}'
```

| Code | Signification |
|---|---|
| 200 | Abonnement confirmé |
| 404 | Jeton inconnu |

### `POST /v1/bulletins/abonnement/desabonnement` — Se désabonner du bulletin

Le jeton de désabonnement — propre à chaque abonné, et présent au bas de chaque message. Les livraisons encore en file pour cette personne sont retirées dans le même geste.

- **Authentification** : publique
- **Service** : les deux

**Corps de la requête**

```json
{
  "jeton": "…"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/bulletins/abonnement/desabonnement' \
  -H 'accept: application/json' \
  -H 'content-type: application/json' \
  -d '{"jeton":"…"}'
```

| Code | Signification |
|---|---|
| 200 | Désabonnement enregistré |
| 404 | Jeton inconnu |

### `GET /v1/bulletins/administration/tableau` — Tableau de bord du bulletin

L'état vu par l'administration : réglages effectifs, cadences possibles, période en cours et prochaine parution, abonnés (avec leurs liens de désabonnement), file d'envoi en attente, dernières passes, état du serveur SMTP et adresses des flux.

- **Authentification** : editeur
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/bulletins/administration/tableau' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Le tableau de bord |

### `POST /v1/bulletins/administration/generer` — Composer les bulletins échus

Déclenche la passe : elle clôt les périodes échues, compose les numéros qui ont des actes (une période sans publication ne donne pas de bulletin) et vide la file d'envoi. `{ \"enCours\": true }` recompose en plus la période EN COURS à titre PROVISOIRE, pour la relire avant parution — un numéro provisoire n'est jamais adressé aux abonnés.

- **Authentification** : editeur
- **Service** : les deux

**Corps de la requête**

```json
{
  "enCours": false
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/bulletins/administration/generer' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"enCours":false}'
```

| Code | Signification |
|---|---|
| 200 | La passe, et les numéros composés |

### `POST /v1/bulletins/{id}/envoyer` — Adresser un bulletin aux abonnés

Met le numéro en file pour chaque abonné CONFIRMÉ et vide la file tout de suite, sans attendre la passe suivante. Un numéro provisoire ne s'envoie pas (bulletin_provisoire) : les abonnés reçoivent le numéro définitif, à la clôture.

- **Authentification** : editeur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant du bulletin |

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/bulletins/ACT-12/envoyer' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Bulletin mis en file, livraisons tentées |
| 409 | Bulletin provisoire |

### `POST /v1/bulletins/abonnes/{id}/retirer` — Retirer un abonné

Le geste d'administration : retirer une adresse du bulletin sans attendre qu'elle se désabonne elle-même.

- **Authentification** : administrateur
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant de l'abonné |

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/bulletins/abonnes/ACT-12/retirer' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | Abonné retiré |
| 404 | Abonné inconnu (abonne_inconnu) |

## Courriel

État du service SMTP et envoi de notifications.

### `GET /v1/courriel` — État du service de courriel

La configuration SMTP du déploiement — hôte, port, chiffrement, expéditeur, envoi actif ou non — et les derniers envois tentés. AUCUN secret : le mot de passe SMTP ne quitte jamais le serveur.

- **Authentification** : lecteur
- **Service** : auto-hébergé

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/v1/courriel' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON'
```

| Code | Signification |
|---|---|
| 200 | État du service et derniers envois |

### `POST /v1/courriel/envoi` — Envoyer un courriel de notification

Envoie un message par le serveur SMTP de la collectivité (`SMTP_*` du `.env`) et le consigne au journal `sb_courriel`. Le corps du message est fourni par l'application : le service n'invente rien.

- **Authentification** : administrateur
- **Service** : auto-hébergé

**Corps de la requête**

```json
{
  "evenement": "demande_signature",
  "acteId": "ACT-12",
  "destinataires": [
    {
      "nom": "Jeanne Mercier",
      "courriel": "j.mercier@exemple.fr"
    }
  ],
  "sujet": "Acte à signer",
  "texte": "…"
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/courriel/envoi' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"evenement":"demande_signature","acteId":"ACT-12","destinataires":[{"nom":"Jeanne Mercier","courriel":"j.mercier@exemple.fr"}],"sujet":"Acte à signer","texte":"…"}'
```

| Code | Signification |
|---|---|
| 200 | Message remis au serveur SMTP |
| 502 | Le serveur SMTP a refusé |

### `POST /v1/courriel/test` — Envoyer un courriel de test

Vérifie que le service joint bien le serveur SMTP : envoie un message d'essai aux destinataires indiqués, sans passer par la politique de notification de l'application.

- **Authentification** : administrateur
- **Service** : auto-hébergé

**Corps de la requête**

```json
{
  "destinataires": [
    "admin@exemple.fr"
  ]
}
```

**Exemple**

```bash
curl -X POST 'https://api.exemple.fr/v1/courriel/test' \
  -H 'accept: application/json' \
  -H 'authorization: Bearer VOTRE_JETON' \
  -H 'content-type: application/json' \
  -d '{"destinataires":["admin@exemple.fr"]}'
```

| Code | Signification |
|---|---|
| 200 | Message d'essai remis au serveur SMTP |
| 502 | Le serveur SMTP a refusé |

## Adresses publiques du site

Recueil, robots, plan de site — hors /v1/.

### `GET /recueil` — La page du recueil public

La page HTML du recueil (hors /v1/) : c'est l'accueil du site, la page que le public visite et que les moteurs indexent.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/recueil' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | La page du recueil |

### `GET /recueil.json` — L'index du recueil (JSON)

L'index complet du recueil, en JSON : de quoi bâtir un moteur de recherche, un tableau de bord ou une reprise de données.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/recueil.json' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | L'index |

### `GET /robots.txt` — robots.txt

Les consignes d'exploration : le recueil est ouvert à l'indexation, l'atelier ne l'est pas.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/robots.txt' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le fichier |

### `GET /llms.txt` — llms.txt

Le résumé du site à l'attention des agents conversationnels : ce que le recueil contient, et comment le parcourir proprement.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/llms.txt' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le fichier |

### `GET /sitemap.xml` — sitemap.xml

Le plan de site, engendré depuis les publications : chaque acte publié y figure avec son adresse.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/sitemap.xml' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le plan de site |

### `GET /recueil/bulletins` — Les bulletins parus

La page HTML des bulletins : le sommaire des numéros, la cadence, la prochaine parution, et le formulaire d'abonnement — un vrai formulaire, qui fonctionne sans JavaScript en postant sur `/recueil/bulletins/abonnement`. Elle rend 404 si le bulletin est éteint.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/recueil/bulletins' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | La page des bulletins |
| 404 | Bulletin non ouvert |

### `GET /recueil/bulletins/{id}` — Un bulletin, en ligne

Un numéro, en HTML : les entités, leurs thématiques, les actes et leurs liens. Les extensions `.json`, `.md` et `.txt` rendent les mêmes données dans les autres formats.

- **Authentification** : publique
- **Service** : les deux

| Paramètre | Type | Description |
|---|---|---|
| id | string | Identifiant du bulletin |

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/recueil/bulletins/ACT-12' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le bulletin |
| 404 | Bulletin inconnu |

### `GET /recueil/bulletins.rss` — Le flux du bulletin (RSS 2.0)

Une entrée par numéro — c'est la PARUTION que l'on suit, pas l'acte. `.atom` rend le même fil en Atom 1.0.

- **Authentification** : publique
- **Service** : les deux

**Exemple**

```bash
curl -X GET 'https://api.exemple.fr/recueil/bulletins.rss' \
  -H 'accept: application/json'
```

| Code | Signification |
|---|---|
| 200 | Le flux |
| 404 | Bulletin non ouvert |

## Les rôles

Un rôle est un droit d'ensemble. Une clé, un compte ou une session en porte un, et chaque route exige le sien.

| Rôle | Ce qu'il permet |
|---|---|
| lecteur | Lire les actes déposés, les circuits, les publications. |
| redacteur | Déposer un acte, ouvrir un circuit, publier, transmettre. |
| editeur | Épingler une publication, gérer les trames (via la synchronisation). |
| administrateur | Tout, y compris les clés, la purge, le journal et le dossier interne. |
| prestataire | Rien d'autre que la notification de signature (/v1/webhooks/signature). |

## Les codes d'erreur

En cas d'échec, le service répond avec un code HTTP (400, 401, 403, 404, 405, 409, 413, 429, 500, 502) et un corps `{ erreur: { code, message } }`. Le `message` est destiné à l'être humain ; le `code` est destiné au programme, et c'est lui qu'il faut traiter.

| Code | Ce qu'il signifie |
|---|---|
| session_absente | Aucune session ouverte (mode mot de passe ou annuaire), ou session expirée. |
| csrf_invalide | Le jeton anti-CSRF manque ou ne correspond pas : rechargez la page. |
| role_insuffisant | La clé ou le compte n'a pas le rôle qu'exige la route. |
| trop_de_requetes | Trop d'écritures (ou d'essais de connexion) en peu de temps : ralentissez. |
| document_absent | Le corps de la requête n'a pas les champs obligatoires. |
| document_trop_volumineux | Le document dépasse la taille maximale du service. |
| acte_non_signe | Publication ou transmission demandée avant la signature. |
| acte_non_publiable | L'acte a été déposé non publiable (acte individuel). |
| transmission_absente | L'acte est soumis au contrôle de légalité, mais n'a pas été transmis. |
| conformite_non_certifiee | Le circuit externe attend la certification de conformité du réviseur. |
| validation_incomplete | Le circuit de validation (parapheur) n'est pas achevé. |
| revision_incomplete | La révision n'est pas achevée : la signature ne peut pas s'ouvrir. |
| deja_signe | L'acte est déjà signé (ou publié). |
| signature_rejetee | L'empreinte du document signé ne correspond pas à celle du document déposé. |
| prestataire_indisponible | Le service n'a pas pu ouvrir le circuit auprès du prestataire (adresse, clé, réponse). |
| circuit_non_externe | L'acte ne suit pas le circuit externe. |
| publication_inconnue | Aucune publication ne porte cette clé. |
| bulletin_inconnu | Aucun bulletin ne porte cet identifiant (ou il est provisoire, donc sans adresse publique). |
| bulletin_provisoire | Le bulletin couvre une période encore ouverte : il ne s'adresse pas encore aux abonnés. |
| abonne_inconnu | Aucun abonné au bulletin ne porte cet identifiant. |
| date_publication_anterieure | La date de publication précède la date de signature. |
| base_indisponible | La base de données ne répond pas : l'état du service n'est pas lisible. |
| etat_non_ecrit | Le service n'a pas pu écrire son état (disque, base). |
| collection_inconnue | Le nom de collection n'existe pas. |
| force_reserve_admin | L'écrasement sans contrôle de révision est réservé à l'administrateur. |
| ressource_inconnue | L'adresse appelée n'existe pas (404). |
| methode_non_autorisee | L'adresse existe, mais pas pour cette méthode (405). |

## Tableau des routes

| Méthode | Chemin | Rôle | Objet |
|---|---|---|---|
| GET | `/v1/health` | public | État du service |
| GET | `/v1/` | public | Description OpenAPI 3.1 |
| GET | `/v1/config` | public | Réglages de référentiel et état du prestataire |
| GET | `/v1/auth/etat` | public | État de l'autorisation du service |
| POST | `/v1/auth/bootstrap` | public | Provisionner le service (première clé) |
| GET | `/v1/auth/cles` | administrateur | Lister les clés d'API |
| POST | `/v1/auth/cles` | administrateur | Créer une clé d'API |
| POST | `/v1/auth/cles/{id}/revoquer` | administrateur | Révoquer une clé |
| GET | `/v1/journal` | administrateur | Journal d'audit du service |
| GET | `/v1/auth/config` | public | Mode d'authentification du service |
| POST | `/v1/auth/connexion` | public | Ouvrir une session |
| POST | `/v1/auth/annuaire` | public | Ouvrir une session par l'annuaire de la collectivité |
| POST | `/v1/auth/annuaire/decouverte` | public | Éprouver l'annuaire (bouton « Découverte ») |
| GET | `/v1/auth/session` | public | Session courante |
| POST | `/v1/auth/deconnexion` | public | Fermer la session |
| POST | `/v1/auth/mot-de-passe` | public | Changer son mot de passe |
| GET | `/v1/auth/comptes` | administrateur | État des mots de passe |
| POST | `/v1/auth/comptes/{id}/mot-de-passe` | administrateur | Définir ou remettre un mot de passe |
| DELETE | `/v1/auth/comptes/{id}/mot-de-passe` | administrateur | Retirer le mot de passe d'un compte |
| GET | `/v1/db/health` | public | État de la base de données |
| GET | `/v1/db/collections/{collection}` | lecteur | Lire une collection |
| POST | `/v1/db/collections/{collection}/sync` | redacteur | Synchroniser une collection |
| GET | `/v1/actes` | lecteur | Lister les actes déposés |
| POST | `/v1/actes` | redacteur | Déposer un acte finalisé |
| GET | `/v1/actes/{id}` | lecteur | Lire un acte déposé |
| GET | `/v1/actes/{id}/document` | lecteur | Lire le document déposé |
| GET | `/v1/actes/{id}/dossier-signature` | administrateur | Lire le dossier de signature interne |
| POST | `/v1/actes/{id}/signature` | redacteur | Envoyer un acte en signature |
| GET | `/v1/signatures` | lecteur | Lister les circuits de signature |
| GET | `/v1/signatures/{id}` | lecteur | Suivre un circuit |
| GET | `/v1/signatures/{id}/document-signe` | lecteur | Récupérer l'acte signé |
| POST | `/v1/webhooks/signature` | prestataire | Notification du prestataire (retour signé) |
| POST | `/v1/actes/{id}/signature-externe` | redacteur | Déposer la version signée (circuit externe) |
| POST | `/v1/actes/{id}/conformite` | redacteur | Certifier (ou refuser) la conformité de la pièce signée |
| POST | `/v1/actes/{id}/transmission` | redacteur | Transmettre au contrôle de légalité |
| GET | `/v1/actes/{id}/transmission` | lecteur | Lire la transmission |
| POST | `/v1/actes/{id}/publication` | redacteur | Publier un acte au recueil |
| GET | `/v1/publications` | public | Lister le recueil |
| GET | `/v1/publications/{cle}` | public | Lire une publication |
| POST | `/v1/publications/{cle}/retrait` | administrateur | Retirer une publication |
| POST | `/v1/publications/{cle}/epingle` | editeur | Épingler une publication |
| GET | `/v1/eli/{actTypeId}/{annee}/{numero}/{entite}` | public | Résoudre un identifiant ELI |
| GET | `/v1/eli/{actTypeId}/{annee}/{numero}/{entite}/original` | public | L'original signé d'un acte publié |
| POST | `/v1/admin/purge` | administrateur | Remettre le service à zéro |
| GET | `/v1/bulletins` | public | État public du bulletin |
| GET | `/v1/bulletins/{id}` | public | Lire un bulletin |
| POST | `/v1/bulletins/abonnement` | public | Demander l'abonnement au bulletin |
| POST | `/v1/bulletins/abonnement/confirmation` | public | Confirmer un abonnement |
| POST | `/v1/bulletins/abonnement/desabonnement` | public | Se désabonner du bulletin |
| GET | `/v1/bulletins/administration/tableau` | editeur | Tableau de bord du bulletin |
| POST | `/v1/bulletins/administration/generer` | editeur | Composer les bulletins échus |
| POST | `/v1/bulletins/{id}/envoyer` | editeur | Adresser un bulletin aux abonnés |
| POST | `/v1/bulletins/abonnes/{id}/retirer` | administrateur | Retirer un abonné |
| GET | `/v1/courriel` | lecteur | État du service de courriel |
| POST | `/v1/courriel/envoi` | administrateur | Envoyer un courriel de notification |
| POST | `/v1/courriel/test` | administrateur | Envoyer un courriel de test |
| GET | `/recueil` | public | La page du recueil public |
| GET | `/recueil.json` | public | L'index du recueil (JSON) |
| GET | `/robots.txt` | public | robots.txt |
| GET | `/llms.txt` | public | llms.txt |
| GET | `/sitemap.xml` | public | sitemap.xml |
| GET | `/recueil/bulletins` | public | Les bulletins parus |
| GET | `/recueil/bulletins/{id}` | public | Un bulletin, en ligne |
| GET | `/recueil/bulletins.rss` | public | Le flux du bulletin (RSS 2.0) |

---

Document engendré par `node scripts/generer-api.mjs` depuis `src/lib/api-reference.js`. Ne pas modifier à la main : corriger la description, puis régénérer.
