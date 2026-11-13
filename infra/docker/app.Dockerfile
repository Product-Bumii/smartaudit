# Production images for api, worker and web (multi-stage, single Dockerfile, select with --target).
#   docker build -f infra/docker/app.Dockerfile --target api    -t smartaudit-api .
#   docker build -f infra/docker/app.Dockerfile --target worker -t smartaudit-worker .
#   docker build -f infra/docker/app.Dockerfile --target web    -t smartaudit-web .

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NG_CLI_ANALYTICS=false CI=true
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/llm/package.json packages/llm/
COPY packages/mail/package.json packages/mail/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY . .
# API, migrations, seed and worker are bundled (with their dependencies) into single .cjs files.
RUN npm run build -w apps/api && npm run build -w apps/worker && npm run build -w apps/web

FROM node:24-bookworm-slim AS api
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://localhost:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--enable-source-maps", "dist/server.cjs"]

FROM node:24-bookworm-slim AS worker
WORKDIR /app
ENV NODE_ENV=production
# TODO(Fase 3): install LibreOffice headless here to convert Word reports to PDF.
COPY --from=build /app/apps/worker/dist ./dist
USER node
CMD ["node", "--enable-source-maps", "dist/main.cjs"]

FROM caddy:2-alpine AS web
COPY infra/caddy/web.Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist/web/browser /srv
EXPOSE 80
