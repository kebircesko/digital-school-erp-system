FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm ci
COPY apps/api apps/api
COPY packages/shared packages/shared
RUN npm run db:generate \
    && npm run build -w @erp/shared \
    && npm run build -w @erp/api

FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl poppler-utils \
    && rm -rf /var/lib/apt/lists/*
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/package*.json ./
RUN mkdir -p /data/backups \
    && chown -R node:node /data /app
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
CMD ["node", "apps/api/dist/main.js"]
