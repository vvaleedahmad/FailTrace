FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
COPY apps/api-server/package.json apps/api-server/package.json
RUN npm ci --workspace apps/api-server --include-workspace-root

FROM deps AS build
COPY apps/api-server apps/api-server
RUN npm run build --workspace apps/api-server

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
COPY apps/api-server/package.json apps/api-server/package.json
RUN npm ci --workspace apps/api-server --include-workspace-root --omit=dev

COPY --from=build /app/apps/api-server/dist apps/api-server/dist

WORKDIR /app/apps/api-server
EXPOSE 4000
CMD ["node", "dist/src/server.js"]
