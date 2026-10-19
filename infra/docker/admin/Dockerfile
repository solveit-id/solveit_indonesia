# syntax=docker/dockerfile:1
# Solveit Indonesia admin console (admin/): React and Vite, Node 22.
# Build context: the repository root (Dockerfile.dockerignore next to this file allowlists it).
#   dev    Vite dev server with hot reload and the same-origin /api/v1/admin proxy; the source
#          and the shared website design files are bind-mounted (compose.dev.yaml)
#   build  npm ci, the production build (admin/dist), its build checks, and the nginx security
#          headers generated from admin/security-policy.ts
#   prod   only the static files, served by unprivileged nginx (compose.prod.yaml, service admin,
#          behind the private admin listener admin-gateway; B3.2d, not deployed)
# Guides: docs/development/docker-development.md and docs/development/docker-production.md.

ARG NODE_IMAGE=node:22.23.1-bookworm-slim
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.30.6-alpine

# --- Development ------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS dev

# The `node` user takes the host user's UID/GID (default 1000) so it can write to the
# bind-mounted source on Linux. node_modules is a named volume, created here so it belongs to
# that user. The admin reads four website files in place (vite.config.ts sharedDesignSources),
# so the layout mirrors the repository: /workspace/admin next to /workspace/frontend.
ARG SOLVEIT_UID=1000
ARG SOLVEIT_GID=1000
RUN set -eux; \
    if [ "$SOLVEIT_GID" != 1000 ]; then groupmod --gid "$SOLVEIT_GID" node; fi; \
    if [ "$SOLVEIT_UID" != 1000 ]; then usermod --uid "$SOLVEIT_UID" --gid "$SOLVEIT_GID" node; fi; \
    mkdir -p /workspace/admin/node_modules /workspace/frontend; \
    chown -R node:node /workspace
COPY --chmod=0755 infra/docker/admin/entrypoint-dev.sh /usr/local/bin/solveit-entrypoint

WORKDIR /workspace/admin
USER node
EXPOSE 5174
ENTRYPOINT ["solveit-entrypoint"]
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5174", "--strictPort"]

# --- Static build -----------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build

WORKDIR /workspace/admin
COPY admin/package.json admin/package-lock.json ./
RUN npm ci --no-audit --no-fund

# The four website files the console reads in place (docs/project-structure.md 7.1), at the
# same relative path as in the repository. They exist only in this build stage.
COPY frontend/src/styles/tokens.css /workspace/frontend/src/styles/tokens.css
COPY frontend/src/assets/fonts/archivo-solveit.woff2 /workspace/frontend/src/assets/fonts/archivo-solveit.woff2
COPY frontend/src/components/brand/logo-paths.ts /workspace/frontend/src/components/brand/logo-paths.ts
COPY frontend/public/favicon.svg /workspace/frontend/public/favicon.svg
COPY admin/ ./

# Type checking and tests run in Admin CI on the same source; the image runs the production
# build and its checks (CSP meta, no inline script, no external origin, no source map, no
# component reference, initial JS budget). A failed check fails the image build.
RUN set -eux; \
    npx vite build; \
    node scripts/check-build.mjs; \
    node scripts/write-nginx-headers.mjs /workspace/security-headers.conf

# --- Production: static files only, no Node, no source, no dev dependencies -------------------
FROM ${NGINX_IMAGE} AS prod

COPY infra/docker/nginx/admin.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/security-headers.conf /etc/nginx/solveit/admin-security-headers.conf
COPY --from=build /workspace/admin/dist /usr/share/nginx/html

EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -q -O /dev/null http://127.0.0.1:8081/ || exit 1
