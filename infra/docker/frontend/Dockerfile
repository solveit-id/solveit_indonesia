# syntax=docker/dockerfile:1
# Solveit Indonesia frontend: React Router 7 static prerender (ssr: false) built with Node 22.
# Build context: the repository root (Dockerfile.dockerignore next to this file allowlists it).
#   dev    Vite dev server with hot reload; the source is bind-mounted (compose.dev.yaml)
#   build  npm ci + npm run build (prerendered HTML in frontend/build/client)
#   prod   only the static files, served by unprivileged nginx (compose.prod.yaml)
# Guides: docs/development/docker-development.md and docs/development/docker-production.md.

ARG NODE_IMAGE=node:22.23.1-bookworm-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.6-alpine

# --- Development ------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS dev

# The `node` user takes the host user's UID/GID (default 1000) so it can write to the
# bind-mounted source on Linux. node_modules is a named volume, created here so it belongs to
# that user.
ARG SOLVEIT_UID=1000
ARG SOLVEIT_GID=1000
RUN set -eux; \
    if [ "$SOLVEIT_GID" != 1000 ]; then groupmod --gid "$SOLVEIT_GID" node; fi; \
    if [ "$SOLVEIT_UID" != 1000 ]; then usermod --uid "$SOLVEIT_UID" --gid "$SOLVEIT_GID" node; fi; \
    mkdir -p /app/node_modules; \
    chown -R node:node /app
COPY --chmod=0755 infra/docker/frontend/entrypoint-dev.sh /usr/local/bin/solveit-entrypoint

WORKDIR /app
USER node
EXPOSE 5173
ENTRYPOINT ["solveit-entrypoint"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]

# --- Static build -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY frontend/ ./

# VITE_* values are public and baked into the HTML and JavaScript at build time; never secrets.
# The inquiry API channel stays off unless the owner approves its activation (AGENTS.md).
ARG VITE_SITE_URL=
ARG VITE_API_BASE_URL=
ARG VITE_INQUIRY_API_ENABLED=false
ARG VITE_GOOGLE_SITE_VERIFICATION=
ENV VITE_SITE_URL=${VITE_SITE_URL} \
    VITE_API_BASE_URL=${VITE_API_BASE_URL} \
    VITE_INQUIRY_API_ENABLED=${VITE_INQUIRY_API_ENABLED} \
    VITE_GOOGLE_SITE_VERIFICATION=${VITE_GOOGLE_SITE_VERIFICATION}
RUN npm run build

# --- Production: static files only, no Node, no source, no dev dependencies -------------------
FROM ${NGINX_IMAGE} AS prod

COPY infra/docker/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/client /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8081/ || exit 1
