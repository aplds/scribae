# Variables de déploiement

Ce document est ENGENDRÉ à partir du registre des variables
(`src/server/mysql/variables.mjs`) par `node scripts/generer-variables.mjs` :
il ne se modifie pas à la main. Pour ajouter une variable, on ajoute un descripteur au
registre, puis on régénère ce fichier.

Deux sortes de réglages vivent dans le fichier `.env` du déploiement :

- les **réglages de service** — base de données, comptes, jetons, courriel, limites —
  lus par le service lui-même ;
- les **réglages de référentiel** — identité, vocabulaire, numérotation, délais, recueil,
  fonctions — **déclaratifs** : le service les valide au démarrage et les transmet au
  navigateur (`GET /v1/config`), qui les applique par-dessus le référentiel à chaque
  démarrage. Une variable posée ici l'emporte donc sur la valeur réglée dans l'interface.
  Elle n'est pas recopiée dans le référentiel : retirée du `.env`, elle n'est plus imposée au
  lancement suivant, et l'interface reprend la main.

Un réglage **absent ou laissé vide** est ignoré : le référentiel garde sa valeur. Une
valeur REFUSÉE (type, choix ou borne) n'est pas appliquée, et le motif est journalisé par le
service au démarrage — il n'y a jamais de repli silencieux sur une valeur approchante.

## Identité

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_IDENTITE_NOM` | référentiel | **Nom de la collectivité** — Le nom qui s'affiche en tête de l'application, du recueil public et des documents. | texte |  | Ville d'Exemple |
| `SCRIBA_IDENTITE_SIGLE` | référentiel | **Nom court** — Sigle ou forme brève, repris là où la place manque (onglets, pied de page). | texte |  | VE |
| `SCRIBA_IDENTITE_ADRESSE` | référentiel | **Adresse de base** — Racine publique du site. Elle préfixe les identifiants ELI (« {baseUri}/eli/… »). | url |  | https://actes.exemple.fr |
| `SCRIBA_IDENTITE_COULEUR` | référentiel | **Couleur principale** — Couleur d'accent de l'interface et des documents produits. | couleur |  | #000091 |
| `SCRIBA_IDENTITE_COULEUR_SOMBRE` | référentiel | **Couleur principale (survol)** — Variante employée pour les états survolés et les contrastes. | couleur |  | #1212ff |
| `SCRIBA_IDENTITE_EMBLEME` | référentiel | **Emblème** — Adresse de l'emblème, ou data URL. Vide : aucun emblème n'est affiché. | texte |  | https://www.exemple.fr/blason.svg |
| `SCRIBA_IDENTITE_EMBLEME_SOMBRE` | référentiel | **Emblème (thème sombre)** — Emblème de rechange, employé quand le poste de travail est en thème sombre. Vide : l'emblème ordinaire sert dans les deux thèmes. | texte |  | https://www.exemple.fr/blason-clair.svg |
| `SCRIBA_IDENTITE_POLICE_INTERFACE` | référentiel | **Police de l'interface** — Famille de caractères de l'application (interface). | texte |  | system-ui, Arial, sans-serif |
| `SCRIBA_IDENTITE_POLICE_DOCUMENT` | référentiel | **Police des documents** — Famille de caractères des actes compilés et imprimés. | texte |  | Georgia, 'Times New Roman', serif |
| `SCRIBA_SUPPORT_NOM` | référentiel | **Service de contact** — Le service auquel un lecteur s'adresse (pied de page du recueil). | texte |  | Service des affaires générales |
| `SCRIBA_SUPPORT_TELEPHONE` | référentiel | **Téléphone de contact** — Numéro affiché dans le pied de page du recueil. Facultatif. | texte |  | 01 23 45 67 89 |
| `SCRIBA_SUPPORT_COURRIEL` | référentiel | **Courriel de contact** — Adresse affichée dans le pied de page du recueil. Facultatif. | texte |  | actes@exemple.fr |

## Vocabulaire

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_VOCAB_ENACTE` | référentiel | **Verbe d'édiction** — Le mot qui introduit le dispositif (« ARRÊTE », « DÉCIDE », « DÉLIBÈRE »). | texte |  | ARRÊTE |
| `SCRIBA_VOCAB_ARTICLE` | référentiel | **Libellé d'article** — Le mot qui désigne un article du dispositif. | texte |  | Article |
| `SCRIBA_VOCAB_CONSIDERANT` | référentiel | **Libellé de considérant** — Le mot qui introduit les considérants. | texte |  | Considérant |
| `SCRIBA_VOCAB_VISA` | référentiel | **Libellé de visa** — Le mot qui introduit les visas (« Vu », « Vus »). | texte |  | Vu |
| `SCRIBA_VOCAB_AUTEUR` | référentiel | **Ligne d'autorité par défaut** — Mention d'autorité d'une trame qui n'en porte pas d'autre. | texte |  | L'autorité compétente |
| `SCRIBA_VOCAB_RECOURS` | référentiel | **Libellé des voies de recours** — Titre du bloc qui rappelle les délais et voies de recours. | texte |  | Voies et délais de recours |
| `SCRIBA_VOCAB_PUBLICATION` | référentiel | **Libellé de publication** — Titre du bloc qui rappelle la publication et l'opposabilité. | texte |  | Publication |

## Numérotation

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_NUMERO_MOTIF` | référentiel | **Motif du numéro** — Gabarit du numéro d'acte. Jetons : {year} {seq} {entityCode} {actTypeId}. | texte |  | {year}-{seq}-{entityCode} |
| `SCRIBA_NUMERO_REMPLISSAGE` | référentiel | **Chiffres de la séquence** — Nombre de chiffres du numéro de séquence (remplissage par des zéros). | entier (min 1, max 10) |  | 3 |
| `SCRIBA_NUMERO_ANNEE` | référentiel | **Année de numérotation** — Année inscrite dans le numéro. Réglée au 1er janvier, ou laissée à l'année courante. | entier (min 2000, max 2100) |  | 2026 |
| `SCRIBA_NUMERO_SEQUENCE` | référentiel | **Prochain numéro** — Valeur de départ de la séquence (au premier numéro tiré de l'application). | entier (min 1) |  | 1 |
| `SCRIBA_NUMERO_ELI` | référentiel | **Motif de l'identifiant ELI** — Gabarit de l'identifiant ELI. Jetons : {baseUri} {actTypeId} {year} {seq} {entityCode}. | texte |  | {baseUri}/eli/{actTypeId}/{year}/{seq}/{entityCode} |
| `SCRIBA_NUMERO_SOURCE` | référentiel | **Source du numéro** — « interne » : la séquence ci-dessus. « externe » : un service tiers (Grist, tableur) attribue le numéro. | choix : interne ou externe |  | interne |
| `SCRIBA_NUMERO_ENTITE_ELI` | référentiel | **Code d'entité dans l'ELI** — Ajoute le code de l'entité au chemin ELI. Éteint pour un identifiant unique par acte. | booleen |  | true |

## Délais et exécution

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_DELAI_RECOURS_MOIS` | référentiel | **Délai de recours (mois)** — Délai de recours contentieux rappelé sur chaque acte (2 mois par défaut). | entier (min 1, max 12) |  | 2 |
| `SCRIBA_DELAI_TRANSMISSION_JOURS` | référentiel | **Transmission au contrôle de légalité (jours)** — Délai accordé pour transmettre l'acte au représentant de l'État. | entier (min 0, max 90) |  | 15 |
| `SCRIBA_DELAI_PUBLICATION_JOURS` | référentiel | **Publication (jours)** — Délai accordé pour publier l'acte après sa signature. | entier (min 0, max 90) |  | 10 |
| `SCRIBA_DELAI_NOTIFICATION_JOURS` | référentiel | **Notification (jours)** — Délai accordé pour notifier l'acte aux intéressés. | entier (min 0, max 90) |  | 8 |

## Recueil public

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_RECUEIL_TITRE` | référentiel | **Titre du recueil** — Titre porté en tête du recueil public des actes. | texte |  | Recueil des actes administratifs |
| `SCRIBA_RECUEIL_AUTO` | référentiel | **Publication automatique** — Allumé, l'acte est publié dès son retour signé. Éteint, chaque publication est un geste délibéré. | booleen |  | true |
| `SCRIBA_RECUEIL_OPPOSABILITE` | référentiel | **Entrée en vigueur** — « lendemain » : opposable le lendemain de la publication. « jours » : après le nombre de jours réglé. | choix : lendemain ou jours |  | lendemain |
| `SCRIBA_RECUEIL_OPPOSABILITE_JOURS` | référentiel | **Entrée en vigueur (jours)** — Nombre de jours quand l'entrée en vigueur est réglée « jours ». | entier (min 0, max 60) |  | 1 |

## Bulletin des actes

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_BULLETIN_ACTIF` | référentiel | **Bulletin allumé** — Allumé, le recueil publie un numéro à chaque clôture de période et ouvre l'abonnement par courriel. Éteint, les adresses du bulletin n'existent pas. | booleen |  | true |
| `SCRIBA_BULLETIN_TITRE` | référentiel | **Titre du bulletin** — Titre porté par le bulletin : en-tête des pages, objet des courriels, titre du flux. | texte |  | Bulletin officiel des actes |
| `SCRIBA_BULLETIN_TITRE_BULLETIN` | référentiel | **Titre de chaque numéro** — Titre de chaque numéro, précédant le rang et la période (« … n° 12 — septembre 2026 »). Vide : le titre du bulletin sert. | texte |  | Bulletin des actes |
| `SCRIBA_BULLETIN_SOUS_TITRE` | référentiel | **Sous-titre** — Phrase d'introduction du bulletin : sous les pages, en tête du courriel, dans la description du flux. | texte |  | Les actes administratifs de la collectivité, rassemblés par période. |
| `SCRIBA_BULLETIN_CADENCE` | référentiel | **Cadence de parution** — La périodicité du bulletin. « bimensuelle » paraît deux fois par mois (1er–15, puis 16–fin). « personnalisee » (toutes les N unités) se règle dans l'interface. | choix : quotidienne ou hebdomadaire ou bimensuelle ou mensuelle ou bimestrielle ou trimestrielle ou semestrielle ou annuelle ou personnalisee |  | mensuelle |
| `SCRIBA_BULLETIN_PARUTION_JOURS` | référentiel | **Jour de parution** — Jour du mois où paraît le bulletin, une fois sa période close (0 : dès le premier jour permis). | entier (min 0, max 31) |  | 1 |

## Accès à l'atelier

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_ATELIER_IPS` | référentiel | **Adresses autorisées à entrer dans l'atelier** — Liste blanche d'adresses ou de champs d'adresses, séparés par des virgules : adresse (« 192.168.1.24 »), préfixe CIDR (« 10.0.0.0/8 », « 2001:db8::/32 »), champ (« 10.0.0.0-10.0.0.255 ») ou plage abrégée (« 10.0.0.* »). Vide : l'atelier est ouvert à toutes les adresses. Renseignée, l'atelier n'est accessible que depuis ces adresses — et les actes réservés aux agents ne sont montrés qu'à elles. | liste |  | 10.0.0.0/8, 192.168.1.0/24 |
| `SCRIBA_ATELIER_MESSAGE` | référentiel | **Message affiché hors du réseau autorisé** — La phrase expliquée à qui tente d'entrer depuis une adresse non autorisée. Vide : le message livré avec l'application sert. | texte |  | L'atelier est ouvert depuis le réseau de la collectivité. Depuis l'extérieur, consultez le recueil public. |

## Signature

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_SIGNATURE_MODE` | référentiel | **Circuit de signature** — « electronique » : prestataire par API. « simple » : signature dans l'application. « externe » : document signé hors ligne puis déposé. Une trame peut trancher autrement. | choix : electronique ou simple ou externe |  | electronique |

## Signature — API

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_SIGNATURE_API_TRANSPORT` | référentiel | **Transport du circuit électronique** — « service » : c'est le service de la collectivité qui appelle le prestataire — seul moyen de garder la clé d'API côté serveur. « demonstration » : le circuit est simulé localement (aucun appel sortant). | choix : service ou demonstration |  | service |
| `SCRIBA_SIGNATURE_API_URL` | référentiel | **Adresse de base du prestataire** — Racine de l'API du prestataire de signature. Vide, le circuit électronique reste en simulation : rien ne sort de la collectivité. | url |  | https://signature.exemple.fr/api/v1 |
| `SCRIBA_SIGNATURE_API_PRESTATAIRE` | référentiel | **Identifiant du prestataire** — Nom technique du prestataire (il sert aux en-têtes et au journal). | texte |  | esup-signature |
| `SCRIBA_SIGNATURE_API_NIVEAU` | référentiel | **Niveau de signature demandé** — Niveau demandé au prestataire pour les actes de la collectivité : signature simple, avancée (certificat), ou qualifiée (eIDAS). | choix : simple ou avancee ou qualifiee |  | avancee |
| `SCRIBA_SIGNATURE_API_NOTIFICATION` | référentiel | **Adresse de notification (webhook)** — L'adresse que le prestataire appellera une fois l'acte signé. Vide : l'adresse du service, suivie de /v1/webhooks/signature. | texte |  | https://actes.exemple.fr/v1/webhooks/signature |
| `SCRIBA_SIGNATURE_API_TIMEOUT` | référentiel | **Délai d'attente du prestataire (ms)** — Temps maximal accordé à un appel au prestataire avant abandon. | entier (min 1000, max 120000) |  | 20000 |
| `SCRIBA_SIGNATURE_API_CHEMIN_DOCUMENT` | référentiel | **Chemin — dépôt du document** — Point de terminaison qui reçoit le document à signer, relatif à l'adresse de base. Aucun jeton. | texte |  | /documents |
| `SCRIBA_SIGNATURE_API_CHEMIN_SIGNATAIRES` | référentiel | **Chemin — ajout d'un signataire** — Point de terminaison qui reçoit les signataires. Jeton {document} : l'identifiant rendu au dépôt. | texte |  | /documents/{document}/signataires |
| `SCRIBA_SIGNATURE_API_CHEMIN_DEMARRER` | référentiel | **Chemin — démarrage du circuit** — Point de terminaison qui lance le circuit de signature. Jeton {document}. | texte |  | /documents/{document}/demarrer |
| `SCRIBA_SIGNATURE_API_CHEMIN_STATUT` | référentiel | **Chemin — suivi du circuit** — Point de terminaison interrogé pour relire le statut d'un circuit. Jeton {document}. | texte |  | /documents/{document} |
| `SCRIBA_SIGNATURE_API_CLE` | service | **Clé d'API du prestataire de signature** — La clé que le service présente au prestataire (en-tête Authorization). Elle ne quitte JAMAIS le serveur : elle n'est ni transmise au navigateur, ni journalisée, ni recopiée dans le référentiel. Sans elle, le service n'appelle pas le prestataire en production. SECRET. | texte |  | (secret) |

## Annuaire (OIDC)

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_ANNUAIRE_SECONDE_PORTE` | référentiel | **Proposer l'annuaire en seconde porte** — Allumé, l'écran de connexion propose l'annuaire de la collectivité EN PLUS de la porte ordinaire (comptes locaux, ou comptes de l'application) : les deux façons d'entrer coexistent. Éteint (le défaut), la porte ordinaire reste seule — c'est le mode « oidc » qui fait de l'annuaire la porte ordinaire, et il ne se règle pas ici (AUTH_MODE, portée service). La porte n'est ouverte que si l'émetteur ET l'identifiant du client sont renseignés. | booleen |  | true |
| `SCRIBA_ANNUAIRE_ESSAI` | référentiel | **Annuaire d'essai intégré** — Allumé, la connexion passe par l'annuaire d'essai INTÉGRÉ (des identités fictives, des jetons non signés) au lieu du fournisseur : aucun appel réseau, et le mécanisme des rôles s'exerce quand même. Ce n'est PAS une authentification : à ne garder que le temps d'un branchement ou d'une démonstration. | booleen |  | false |
| `SCRIBA_ANNUAIRE_ISSUER` | référentiel | **Adresse de l'émetteur (iss)** — L'adresse du fournisseur d'identité, telle qu'elle figure dans ses jetons (revendication `iss`), sans le `/.well-known/openid-configuration`. Elle sert à la découverte des points de terminaison ET à la vérification du jeton. | texte |  | https://annuaire.collectivite.fr/realms/agents |
| `SCRIBA_ANNUAIRE_CLIENT_ID` | référentiel | **Identifiant du client (client_id)** — L'application déclarée chez le fournisseur, en CLIENT PUBLIC (sans secret), avec le flux code d'autorisation et PKCE (S256). Il doit être déclaré chez le fournisseur avec l'adresse de retour à l'identique. | texte |  | scribae-application |
| `SCRIBA_ANNUAIRE_SCOPES` | référentiel | **Portées demandées (scope)** — Les portées de la demande d'autorisation, séparées par des espaces. « openid » est indispensable ; « profile » et « email » fournissent le nom et l'adresse de l'agent. | texte |  | openid profile email |
| `SCRIBA_ANNUAIRE_REDIRECT_URI` | référentiel | **Adresse de retour (redirect_uri)** — L'adresse à laquelle le fournisseur renvoie l'agent après l'authentification. Elle doit être déclarée À L'IDENTIQUE chez le fournisseur. Vide : l'adresse de la page courante, ce qui convient à la plupart des installations. | texte |  | https://actes.collectivite.fr/ |
| `SCRIBA_ANNUAIRE_PROMPT` | référentiel | **Invite (prompt)** — Le paramètre `prompt` de la demande d'autorisation. Vide en général ; « select_account » force le choix du compte à chaque connexion (utile sur un poste partagé ou un fournisseur qui garde la session ouverte). | texte |  | select_account |
| `SCRIBA_ANNUAIRE_ROLE_CLAIM` | référentiel | **Revendication des groupes** — Le chemin, en notation pointée, de la revendication qui porte les groupes de l'agent : « groups », « roles », « realm_access.roles »… Le PREMIER groupe reconnu par la correspondance ci-dessous décide du rôle. | texte |  | groups |
| `SCRIBA_ANNUAIRE_ROLES` | référentiel | **Correspondance des groupes → rôles** — Les couples « groupe=rôle » séparés par des virgules. Les rôles sont ceux de l'application : visiteur, redacteur, reviseur, signataire, editeur, administrateur. C'est le PREMIER groupe reconnu, dans l'ordre annoncé par le fournisseur, qui décide. | correspondance (« groupe=rôle », séparés par des virgules) |  | scribae-administrateurs=administrateur, scribae-editeurs=editeur, scribae-redacteurs=redacteur |
| `SCRIBA_ANNUAIRE_SANS_GROUPE` | référentiel | **Agent sans groupe reconnu** — « deny » (le défaut, recommandé) : l'agent est bien authentifié par l'annuaire, mais aucun de ses groupes ne correspond — il prend le rôle Visiteur, et l'application ne lui ouvre rien. « default » : il reçoit le rôle de repli ci-dessous (utile pendant une mise en service). | choix : deny ou default |  | deny |
| `SCRIBA_ANNUAIRE_ROLE_DEFAUT` | référentiel | **Rôle de repli** — Le rôle attribué à un agent dont aucun groupe n'est reconnu, quand la politique ci-dessus vaut « default ». Le rôle le plus étroit est le bon : « redacteur » pour un agent qui n'a rien demandé, « visiteur » pour ne lui ouvrir aucun accès. | choix : visiteur ou redacteur ou reviseur ou signataire ou editeur ou administrateur |  | redacteur |
| `SCRIBA_ANNUAIRE_SERVICE_CLAIM` | référentiel | **Revendication des services** — Le chemin de la revendication qui porte le ou les codes de service de l'agent (ex. DSI, SG, CCAS). Ces codes sont rapprochés de ceux du référentiel : ils décident du périmètre, c'est-à-dire des actes que l'agent voit. | texte |  | services |
| `SCRIBA_ANNUAIRE_ENTITE_CLAIM` | référentiel | **Revendication de l'entité** — Le chemin de la revendication qui porte le code de l'entité de rattachement de l'agent (ex. VSL, CCAS), rapproché des entités du référentiel. | texte |  | entity |
| `SCRIBA_ANNUAIRE_AUTORITAIRE` | référentiel | **Les groupes de l'annuaire font foi** — Allumé (le défaut), le rôle et le périmètre sont REPRIS de l'annuaire à chaque connexion : c'est l'annuaire qui administre les droits, et un changement de groupe s'applique dès la connexion suivante. Éteint, l'annuaire authentifie seulement, et les rôles réglés dans « Comptes et rôles » sont conservés. | booleen |  | true |
| `SCRIBA_ANNUAIRE_PROVISION` | référentiel | **Créer les comptes inconnus** — Allumé (le défaut), un agent de l'annuaire qui n'a pas encore de compte en reçoit un à sa première connexion. Éteint, il faut pré-enregistrer son adresse (ou son identifiant d'annuaire) dans « Comptes et rôles » — c'est le réglage d'une collectivité qui veut maîtriser qui entre. | booleen |  | true |
| `SCRIBA_ANNUAIRE_USERINFO` | référentiel | **Compléter par /userinfo** — Allumé (le défaut), les revendications du jeton sont complétées par l'appel à `userinfo` — utile quand les groupes n'y figurent pas. Éteint, seul le jeton d'identité est lu. | booleen |  | true |
| `SCRIBA_ANNUAIRE_SIGNATURE` | référentiel | **Exiger la vérification de la signature** — Allumé (le défaut), un jeton d'identité dont la signature n'a pas pu être vérifiée contre les clés publiées (`jwks_uri`) est REFUSÉ. À n'éteindre qu'en connaissance de cause, et jamais en service. | booleen |  | true |
| `SCRIBA_ANNUAIRE_AUTORISATION_URL` | référentiel | **Point de terminaison — autorisation** — À renseigner SEULEMENT si le fournisseur n'expose pas `/.well-known/openid-configuration`, ou si le service ne le joint pas (adresse interne, certificat, pare-feu) : recopiez l'adresse depuis sa documentation. | texte |  | https://annuaire.collectivite.fr/realms/agents/protocol/openid-connect/auth |
| `SCRIBA_ANNUAIRE_JETON_URL` | référentiel | **Point de terminaison — jeton** — Le point de terminaison qui échange le code d'autorisation contre les jetons (c'est le SERVICE qui l'appelle). À renseigner seulement si la découverte n'aboutit pas. | texte |  | https://annuaire.collectivite.fr/realms/agents/protocol/openid-connect/token |
| `SCRIBA_ANNUAIRE_JWKS_URL` | référentiel | **Point de terminaison — clés de signature (jwks)** — Les clés publiques qui servent à vérifier la signature des jetons. Sans elles (et sans découverte), la signature ne peut pas être vérifiée : le jeton est alors refusé si `SCRIBA_ANNUAIRE_SIGNATURE` est allumé. | texte |  | https://annuaire.collectivite.fr/realms/agents/protocol/openid-connect/certs |
| `SCRIBA_ANNUAIRE_USERINFO_URL` | référentiel | **Point de terminaison — informations utilisateur (userinfo)** — Le point de terminaison qui rend les revendications complémentaires (groupes, services, entité). À renseigner seulement si la découverte n'aboutit pas. | texte |  | https://annuaire.collectivite.fr/realms/agents/protocol/openid-connect/userinfo |
| `SCRIBA_ANNUAIRE_SECOURS` | référentiel | **Porte de secours de l'écran de connexion** — Allumée (le défaut), l'écran de connexion offre un repli « L'annuaire est injoignable ? » qui ramène l'installation sur les comptes de l'application. À retirer une fois l'annuaire éprouvé — sans elle, une panne du fournisseur ferme la porte à tout le monde. Rappel : depuis 1.6.1p c'est le SERVICE qui mène la connexion à l'annuaire ; ce repli demeure un contrôle d'INTERFACE, et la barrière réelle est la session que le service exige à chaque appel. | booleen |  | false |

## Fonctions

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_CONTROLE_LEGALITE` | référentiel | **Contrôle de légalité** — Active la transmission de l'acte signé au représentant de l'État par API. Éteint par défaut. | booleen |  | false |
| `SCRIBA_ASSISTANT_ATELIER` | référentiel | **Assistant de l'atelier (« Plume »)** — Allumé, l'assistant d'aide à l'atelier est proposé ; éteint, il n'apparaît pas. | booleen |  | true |
| `SCRIBA_ASSISTANT_PUBLIC` | référentiel | **Assistant du recueil (« Publia »)** — Allumé, l'assistant du recueil public est proposé ; éteint, il n'apparaît pas. | booleen |  | true |

## Rangement des données

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `STOCKAGE` | service | **Rangement des données** — « mysql » (le défaut) : tout dans MariaDB — une base partagée, sauvegardée et répliquée comme le reste. « fichier » : tout dans un dossier (DATA_DIR), EN CLAIR, sans aucune base de données à administrer — pour un poste, une petite collectivité, ou une sauvegarde par simple copie de dossier. Le rangement par fichiers suppose UN service sur UNE machine (voir docs/ADMINISTRATION.md). | choix : mysql ou fichier | mysql | fichier |
| `DATA_DIR` | service | **Dossier de données (rangement par fichiers)** — Le dossier qui porte TOUT le rangement quand STOCKAGE=fichier : état, collections, journal, courriels, sessions. Il est créé au démarrage s'il manque, et doit être accessible en écriture par le compte du service. SAUVEGARDER = copier ce dossier (voir le LISEZ-MOI qu'il contient). Sans objet quand STOCKAGE=mysql. | texte | ./data | /var/lib/scribae |

## Base de données

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `DB_HOST` | service | **Hôte de la base** — Nom d'hôte du serveur MariaDB / MySQL (celui du service `db` en Compose : `db`). | texte | 127.0.0.1 | db |
| `DB_PORT` | service | **Port de la base** — Port d'écoute de MariaDB / MySQL. | entier (min 1, max 65535) | 3306 | 3306 |
| `DB_USER` | service | **Compte applicatif** — Compte avec lequel l'application se connecte à la base. | texte | scriba | scriba |
| `DB_PASSWORD` | service | **Mot de passe de la base** — Mot de passe du compte applicatif. La pile REMET le compte de la base à cette valeur à chaque démarrage (service `db-init`, qui a besoin de DB_ROOT_PASSWORD) et lui applique ensuite le schéma (`schema.sql`) : c'est ici, et nulle part ailleurs, qu'il se change. SECRET : ne jamais le versionner. | texte |  | (secret) |
| `DB_NAME` | service | **Nom de la base** — Base qui contient les tables du service. | texte | scriba | scriba |
| `DB_POOL` | service | **Taille du pool** — Nombre de connexions simultanées à la base. | entier (min 1, max 128) | 8 | 8 |
| `DB_SOCKET` | service | **Socket Unix** — Chemin d'une socket Unix, au lieu de DB_HOST/DB_PORT. | texte |  | /run/mysqld/mysqld.sock |
| `DB_ROOT_PASSWORD` | service | **Mot de passe root MariaDB** — Employé par le conteneur `db` à la CRÉATION du dossier de données, et, à chaque démarrage, par l'ALIGNEMENT du compte applicatif sur DB_PASSWORD puis l'application du schéma (`docker compose run --rm db-init`, ou `node server.mjs --reconcilier`). SECRET. | texte |  | (secret) |

## Authentification

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `AUTH_MODE` | service | **Mode d'authentification** — « password » : vrais comptes locaux (mot de passe vérifié par le service, session par cookie). « oidc » : l'annuaire de la collectivité (OpenID Connect) — MAIS les comptes locaux restent ouverts, et c'est ce qui donne accès au compte d'administration déclaré ici : les deux portes coexistent. « demo » : comptes choisis dans une liste, sans mot de passe — essai seulement. | choix : password ou oidc ou demo | password | password |
| `DEMO` | service | **Commutateur de démonstration** — Allumé, le jeu fictif complet est installé et le bandeau « Démonstration » s'affiche. Éteint, l'outil est une page vierge. Vide : AUTH_MODE=demo ou DEMO_ACCOUNTS=true l'allument. | booleen |  | false |
| `DEMO_ACCOUNTS` | service | **Comptes de démonstration** — Laisse le raccourci « choisir un compte » ouvert en mode `password`. À laisser à false en service. | booleen |  | false |
| `ADMIN_LOGIN` | service | **Identifiant d'administration** — Identifiant du compte d'administration créé au premier démarrage (mode `password`). | texte | admin | admin |
| `ADMIN_PASSWORD` | service | **Mot de passe d'administration** — Mot de passe du compte d'administration, créé au premier démarrage. Doit respecter la politique (MDP_MIN_LONGUEUR, trois classes de caractères). SECRET. | texte |  | (secret) |
| `ADMIN_NOM` | service | **Nom de l'administrateur** — Nom porté par le compte d'administration. | texte | Administrateur | Administrateur |
| `ADMIN_EMAIL` | service | **Courriel de l'administrateur** — Adresse du compte d'administration. Facultative. | texte |  | admin@exemple.fr |
| `ADMIN_ENTITY` | service | **Entité de l'administrateur** — Code de l'entité à laquelle rattacher le compte d'administration, si besoin. | texte |  |  |

## Sessions et mots de passe

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SESSION_DAYS` | service | **Durée de session (jours)** — Durée de validité d'une session ouverte. | entier (min 1, max 365) | 12 | 12 |
| `MDP_MIN_LONGUEUR` | service | **Longueur minimale du mot de passe** — Longueur minimale exigée par la politique de mot de passe. | entier (min 8, max 128) | 12 | 12 |
| `SCRYPT_N` | service | **Coût du dérivé scrypt** — Coût du calcul scrypt (plus haut = plus lent à deviner, et plus lent à vérifier). | entier (min 4096, max 1048576) | 65536 | 65536 |
| `COOKIE_SECURE` | service | **Cookie de session « Secure »** — true en production (HTTPS). Avec true, une session ne peut pas s'ouvrir en http:// — mettre false seulement le temps d'un essai en clair. | booleen | true | true |

## Jetons d'API

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `API_TOKENS` | service | **Jetons acceptés en écriture** — « libellé\|rôle:empreinte_sha256 », séparés par des virgules. Les jetons de DÉPLOIEMENT du service : utiles en mode demo (où aucune session n'existe) ; facultatifs en mode password, où les clés d'API créées dans l'application les remplacent. SECRET. | texte |  | (secret) |
| `API_TOKEN` | service | **Jeton remis à l'application** — Le même jeton, en clair, remis au conteneur web. Doit correspondre à une empreinte de API_TOKENS (facultatif : laissez vide si les clés d'API de l'application suffisent). SECRET. | texte |  | (secret) |

## Façade HTTP

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `CORS_ORIGINS` | service | **Origines autorisées (CORS)** — Origines de navigateur autorisées à appeler l'API, séparées par des virgules. Vide = aucune (l'application est servie par la même origine). | liste |  | https://actes.exemple.fr |
| `API_BASE` | service | **Adresse de l'API vue du navigateur** — Renseignée si l'API est sur une autre origine que l'application. Vide = même origine. | texte |  | https://actes.exemple.fr |
| `HTTP_PORT` | service | **Port publié sur l'hôte** — Port publié par le conteneur web (à placer derrière un reverse-proxy TLS). | entier (min 1, max 65535) | 8080 | 8080 |
| `APP_DIR` | service | **Dossier de l'application** — Dossier qui contient « src/ » et index.html. Sans objet par défaut : la pile Compose et l'image autonome EMBARQUENT le code (le monter sert à travailler sur le code sans reconstruire, voir src/server/README.md § 9 bis). | texte | ../../ |  |

## Service

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `PORT` | service | **Port d'écoute du service** — Port sur lequel le service Node écoute (interne). | entier (min 1, max 65535) | 8080 | 8080 |
| `HOST` | service | **Interface d'écoute** — Interface réseau du service Node. | texte | 0.0.0.0 | 0.0.0.0 |
| `AUTO_MIGRATE` | service | **Migration au démarrage** — Applique le schéma au démarrage, et à chaque fois que le service se rétablit après une panne de base (il la rééprouve de lui-même). À réserver aux installations maîtrisées : la migration se lance normalement à la main. | booleen | false | false |

## Limites et débit

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `MAX_BODY` | service | **Taille maximale d'une requête (octets)** — Taille maximale du corps d'une requête HTTP (8 Mio par défaut). | entier (min 1024) | 8388608 | 8388608 |
| `MAX_SYNC_RECORDS` | service | **Enregistrements par synchronisation** — Borne du lot d'enregistrements échangés avec l'application. | entier (min 1) | 4000 | 4000 |
| `MAX_STATE_CHARS` | service | **Taille de l'état signature/publication** — Borne de l'état conservé par le service (actes, circuits, publications). | entier (min 1000) | 8000000 | 8000000 |
| `MAX_DOC` | service | **Taille d'un acte déposé** — Borne du document d'un acte déposé. | entier (min 1000) | 400000 | 400000 |
| `MAX_PUBLIES` | service | **Publications conservées** — Nombre de publications conservées par le service. | entier (min 1) | 40 | 40 |
| `MAX_SIGNATURES` | service | **Circuits de signature conservés** — Nombre de circuits de signature conservés. | entier (min 1) | 80 | 80 |
| `MAX_ACTES` | service | **Actes conservés** — Nombre d'actes conservés par le service. | entier (min 1) | 80 | 80 |
| `RATE_WINDOW_MS` | service | **Fenêtre de débit (ms)** — Durée de la fenêtre de limitation du débit. | entier (min 1000) | 60000 | 60000 |
| `RATE_MAX_WRITES` | service | **Écritures par fenêtre** — Nombre maximal d'écritures par fenêtre et par adresse. | entier (min 1) | 600 | 600 |
| `RATE_MAX_CONNEXIONS` | service | **Tentatives de connexion par fenêtre** — Nombre maximal de tentatives de connexion par fenêtre et par adresse. | entier (min 1) | 30 | 30 |

## Courriel

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SMTP_HOST` | service | **Serveur SMTP** — Hôte du serveur d'envoi. Vide : Scribae fonctionne, mais les notifications sont constatées « non envoyées ». | texte |  | smtp.exemple.fr |
| `SMTP_PORT` | service | **Port SMTP** — 587 (soumission + STARTTLS), 465 (TLS direct), 25 (relais local). | entier (min 1, max 65535) | 587 | 587 |
| `SMTP_SECURE` | service | **Chiffrement SMTP** — Mode de chiffrement de la liaison SMTP. | choix : auto ou starttls ou ssl ou aucune | auto | auto |
| `SMTP_USER` | service | **Identifiant SMTP** — Compte d'envoi (vide pour un relais sans authentification). | texte |  |  |
| `SMTP_PASS` | service | **Mot de passe SMTP** — Mot de passe du compte d'envoi. SECRET. | texte |  | (secret) |
| `SMTP_FROM` | service | **Adresse d'expédition** — Adresse affichée comme expéditeur. | texte |  | ne-pas-repondre@exemple.fr |
| `SMTP_FROM_NAME` | service | **Nom d'expédition** — Nom affiché à côté de l'adresse d'expédition. | texte |  | Recueil des actes — Ma collectivité |
| `SMTP_REPLY_TO` | service | **Adresse de réponse** — Adresse de réponse proposée aux destinataires. Facultative. | texte |  |  |
| `SMTP_NOTIF_ACTIVE` | service | **Notifications actives** — Éteint l'envoi sans effacer la configuration. | booleen | true | true |
| `SMTP_TLS_INSECURE` | service | **Accepter un certificat non vérifiable** — ESSAI seulement : accepte un certificat SMTP non vérifiable. | booleen | false | false |
| `SMTP_HELO_NAME` | service | **Nom annoncé en EHLO** — Nom annoncé au serveur SMTP. Défaut : SMTP_HOST. | texte |  |  |
| `SMTP_TIMEOUT_MS` | service | **Délai d'attente SMTP (ms)** — Délai d'attente maximal d'une conversation SMTP. | entier (min 1000) | 20000 | 20000 |

## Bulletin des actes (service)

| Variable | Portée | Rôle | Type | Défaut | Exemple |
|---|---|---|---|---|---|
| `SCRIBA_PUBLIQUE_URL` | service | **Adresse publique du recueil** — Adresse publique du recueil (par exemple « https://actes.exemple.fr »). C'est elle qui donne leurs liens aux bulletins adressés par courriel et au flux, puisque le service, quand il compose seul, ne voit pas l'adresse du lecteur. Sans elle, l'abonnement par courriel n'est pas ouvert. | url |  | https://actes.exemple.fr |
| `SCRIBA_BULLETIN_MAX` | service | **Bulletins conservés** — Nombre de bulletins conservés dans l'état du service : les plus anciens sont élagués au-delà. Il borne aussi la remontée initiale, pour qu'un recueil de dix ans ne fasse pas paraître cent numéros d'un coup. | entier (min 1, max 600) | 60 | 60 |
| `SCRIBA_BULLETIN_MAX_ABONNES` | service | **Abonnés au bulletin** — Nombre maximal d'abonnés au bulletin sur ce service. Au-delà, une nouvelle demande est refusée — sans dire qui est déjà inscrit. | entier (min 1, max 200000) | 2000 | 2000 |
| `SCRIBA_BULLETIN_ENVOIS_PASSE` | service | **Livraisons par passe** — Nombre de courriels de bulletin expédiés à chaque passe : borne le temps passé en envoi d'un seul coup. Une livraison refusée est réessayée à la passe suivante, trois fois au total. | entier (min 1, max 2000) | 40 | 40 |
| `SCRIBA_BULLETIN_INTERVALLE_MIN` | service | **Intervalle des passes (minutes)** — Fréquence de la passe qui clôt les périodes échues, compose les numéros et vide la file d'envoi. Une passe a lieu aussi à chaque démarrage du service, qui rattrape ainsi son retard seul. | entier (min 1, max 1440) | 10 | 10 |

## Écrire une valeur

Une valeur est lue TELLE QUELLE après retrait des espaces de bord. Les commentaires
occupent leur propre ligne — un commentaire en fin de ligne n'est retiré par tous les
lecteurs de `.env`.

    SCRIBA_IDENTITE_NOM=Ville d'Exemple
    SCRIBA_IDENTITE_ADRESSE=https://actes.exemple.fr
    SCRIBA_DELAI_RECOURS_MOIS=2
    SCRIBA_RECUEIL_OPPOSABILITE=jours
    SCRIBA_NUMERO_REMPLISSAGE=3
    SCRIBA_ANNUAIRE_ROLES=scribae-administrateurs=administrateur, scribae-editeurs=editeur

