# Vantage-ARS: production Node server image.
# Build:  docker build -t vantage-ars .
# Run:    docker compose up -d   (see docker-compose.yml)

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ENV NITRO_PRESET=node-server
RUN npx vite build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    PGLITE_DATA_DIR=/data/pglite
# Server bundle plus what the migrator needs at start-up.
COPY --from=build /app/.output ./.output
COPY --from=build /app/migrations ./migrations
COPY --from=build /app/scripts/migrate.mjs /app/scripts/migration-plan.mjs ./scripts/
# The migrator only needs the Postgres driver; the server bundle is self-contained.
RUN npm init -y >/dev/null && npm install --no-audit --no-fund --omit=dev pg@8.23.0 \
    && npm cache clean --force
RUN mkdir -p /data && chown -R node:node /data
USER node
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1
# Apply Postgres migrations when DATABASE_URL is set (no-op otherwise), then serve.
CMD ["sh", "-c", "node scripts/migrate.mjs && node .output/server/index.mjs"]
