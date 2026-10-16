# syntax=docker/dockerfile:1
# Solveit Indonesia admin console (admin/): React and Vite, Node 22.
# Build context: the repository root (Dockerfile.dockerignore next to this file allowlists it).
#   dev    Vite dev server with hot reload and the same-origin /api/v1/admin proxy; the source
#          and the shared website design files are bind-mounted (compose.dev.yaml)
# The production image and the private admin listener arrive with B3.2d; nothing here is
# deployable yet. Guide: docs/development/docker-development.md.

ARG NODE_IMAGE=node:22.23.1-bookworm-slim

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
