# One image: the Node server (backend/) serves the built web app and forwards /ragflow/* to RAGFlow.
FROM node:22-alpine AS web
WORKDIR /web
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /server
COPY backend/package*.json ./
RUN npm ci
COPY backend/ .
RUN npx tsc && npm prune --omit=dev

FROM node:22-alpine
WORKDIR /srv/shaul
ENV NODE_ENV=production PORT=3001
COPY --from=server /server/dist ./app
COPY --from=server /server/node_modules ./app/node_modules
RUN echo '{"type":"module"}' > app/package.json
COPY --from=web /web/dist ./web
EXPOSE 3001
USER node
CMD ["node", "app/server.js"]
