# Development image: dependencies installed for Linux; sources are bind-mounted by docker-compose.dev.yml.
FROM node:24-bookworm-slim
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
