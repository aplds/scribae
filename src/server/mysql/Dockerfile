# Service de la collectivité (données + signature/publication) — Node 20.
# Le service n'ouvre aucune connexion sortante : il ne parle qu'à la base, par
# le réseau interne de Docker.
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

ENV NODE_ENV=production
EXPOSE 8080

# La migration se lance explicitement (`node server.mjs --migrate`) ou via
# AUTO_MIGRATE=true ; jamais implicitement au démarrage.
CMD ["node", "server.mjs"]
