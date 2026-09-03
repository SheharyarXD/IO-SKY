# IO SKY — production container image.
#
# Milestone 3 §3.2. The plan's deployment workstream is blocked on one client
# decision: which hosting provider (RM-74). That decision determines *where*
# this runs, not *how* it is built — so everything except the choice itself is
# done here. Any host that runs a container (Fly, Railway, Render, Cloud Run,
# ECS, a plain VPS) can deploy this image unchanged.
#
# Build:  docker build -t iosky:local .
# Run:    docker run -p 3000:3000 --env-file .env iosky:local
#
# Multi-stage so the runtime image carries neither the toolchain nor the dev
# dependencies. The build stage needs everything; the runtime stage needs the
# compiled output and production dependencies only.

# ---------------------------------------------------------------------------
# Stage 1 — build
# ---------------------------------------------------------------------------
FROM node:22-slim AS builder

# pnpm via corepack, pinned by package.json's "packageManager" field so the
# image cannot silently build with a different resolver than local or CI.
RUN corepack enable

WORKDIR /app

# Copy manifests first so the dependency layer is cached independently of
# source changes — editing a component should not re-download the tree.
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .

# Build args, surfaced by /health/version so a running instance can report
# exactly which commit is live. The rollback plan (§8) depends on being able
# to confirm which build is serving.
ARG GIT_COMMIT_SHA=unknown
ARG BUILD_TIMESTAMP=unknown
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA
ENV BUILD_TIMESTAMP=$BUILD_TIMESTAMP

# Typecheck before bundling. A container that builds but does not compile is
# worse than a failed build, because it fails later and further from the cause.
RUN pnpm run check
RUN pnpm run build

# RM-82: fail the image build if a credential ended up in the artifact. Vite
# inlines every VITE_-prefixed variable into the client bundle, so a
# mis-prefixed secret is absent from source and still public once shipped.
# Running this here means such an image can never be produced, let alone
# pushed to a registry.
RUN node scripts/scan-build-artifact.mjs

# Re-resolve to production dependencies only. Done after the build because the
# build itself needs vite, esbuild and typescript.
RUN pnpm prune --prod

# ---------------------------------------------------------------------------
# Stage 2 — runtime
# ---------------------------------------------------------------------------
FROM node:22-slim AS runtime

ENV NODE_ENV=production
# Bound explicitly rather than left to the app's port-scan fallback: in a
# container the port must be deterministic, or the host's port mapping and
# health checks point at the wrong place.
ENV PORT=3000

WORKDIR /app

# Run unprivileged. The node image ships a `node` user for exactly this; a
# process that never needs root should never have it.
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

USER node

EXPOSE 3000

# Container-level health check. Hosts that read Docker health status get it for
# free; those with their own probes should point at /health (liveness) and
# /health/ready (readiness) — see server/_core/healthRoute.ts for why the two
# are separate and why liveness must not touch the database.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
