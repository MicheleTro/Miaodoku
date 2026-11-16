# Bradoku: un'unica immagine con API (Fastify) e frontend compilato (Svelte).
FROM node:22-alpine
WORKDIR /app
RUN corepack enable

# dipendenze prima del codice, per sfruttare la cache
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps apps
RUN pnpm build

ENV NODE_ENV=production \
    PORT=3000 \
    PGLITE_DIR=/data/pglite
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["pnpm", "start"]
