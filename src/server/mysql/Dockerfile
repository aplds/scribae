# Service de la collectivité (données + signature/publication) — Node 20.
# Le service parle à la base par le réseau interne de Docker, et aux tiers que
# l'exploitant lui a déclarés : prestataire de signature, contrôle de légalité,
# annuaire OIDC (découverte), et le relais HTTP (`POST /v1/relais`, liste
# blanche `SCRIBA_RELAIS_HOTES`). Aucune autre sortie n'est ouverte.
#
# L'image de base est ÉPINGLÉE PAR EMPREINTE (et non par simple étiquette) : une
# étiquette comme `20-alpine` désigne ce que le registre publie ce jour-là, si
# bien que deux constructions séparées dans le temps ne produisent pas le même
# artefact. Pour reprendre l'étiquette courante : `docker buildx imagetools
# inspect node:20-alpine` donne la nouvelle empreinte.
FROM node:20-alpine@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

WORKDIR /app

# Les dépendances d'abord : la couche est réutilisée tant que les manifestes ne
# changent pas. Quand `package-lock.json` est présent (ce qu'exige une
# installation reproductible — voir l'audit, NC-I-002), `npm ci` installe
# EXACTEMENT l'arbre verrouillé ; sinon on retombe sur `npm install`.
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

COPY . .

# Le service n'a rien à écrire dans son image : le rangement par fichiers vit
# dans `DATA_DIR` (un volume en déploiement), et tout le reste part dans les
# journaux. Il tourne donc en `node`, pas en root — c'est lui qui analyse les
# requêtes, et un processus qui analyse l'entrée du réseau n'a pas à pouvoir
# tout faire. L'utilisateur `node` (uid 1000) existe dans l'image de base.
RUN mkdir -p /app/data && chown -R node:node /app

ENV NODE_ENV=production
EXPOSE 8080
USER node

# La santé du service : le processus répond-il, base comprise ? `HEALTHCHECK`
# fait de `depends_on: service_healthy` une vraie porte (voir
# `docker-compose.yml`), et d'un service bloqué un conteneur à recréer. Le port
# est celui du service (`PORT`, 8080 par défaut).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'8080')+'/v1/health').then(function(r){process.exit(r.ok?0:1)}).catch(function(){process.exit(1)})"

# La migration se lance explicitement (`node server.mjs --migrate`) ou via
# AUTO_MIGRATE=true ; jamais implicitement au démarrage.
CMD ["node", "server.mjs"]
