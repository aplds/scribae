# Service de la collectivité (données + signature/publication) — Node 18+.
# Le service n'ouvre aucune connexion sortante : il ne parle qu'à la base, par
# le réseau interne de Docker.
FROM node:20-alpine

WORKDIR /app

# Les dépendances d'abord : la couche est réutilisée tant que package.json ne
# change pas.
COPY package.json ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 8080

# La migration se lance explicitement (`node server.mjs --migrate`) ou via
# AUTO_MIGRATE=true ; jamais implicitement au démarrage.
CMD ["node", "server.mjs"]
