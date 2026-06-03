# syntax=docker/dockerfile:1

ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest

# Node bits must match the image CPU (aarch64, amd64, …). Do NOT pin ARG TARGETPLATFORM to
# linux/amd64 — Supervisor builds with `--platform linux/arm64` but does not pass TARGETPLATFORM;
# a wrong default yields amd64 Node on arm64 and `Exec format error` when RUN invokes node.
# With buildx, `FROM node:…` inherits the request `--platform` for this stage (same as BASE_FROM).
FROM node:22-alpine AS node_upstream

# ---------------------------------------------------------------------------
# Shared stack: Home Assistant OS + Node + pnpm — used by builder and runtime.
# Native deps (e.g. better-sqlite3) compile against this libc/musl in builder and
# load on the same stack at runtime (no Alpine-vs-HA mismatch).
# ---------------------------------------------------------------------------
FROM $BUILD_FROM AS base

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN apk add --no-cache bash curl && rm -rf /var/cache/apk/*

# Node/npm from official image; stage arch follows `docker buildx build --platform …` (must match HA base).
COPY --from=node_upstream /usr/local/bin/node /usr/local/bin/node
COPY --from=node_upstream /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
    && npm install -g pnpm@11

# ---------------------------------------------------------------------------
# Build stage — extends base with toolchain only (not shipped in final image).
# ---------------------------------------------------------------------------
FROM base AS builder

ENV CI=1

RUN apk add --no-cache git python3 make g++ && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json pnpm-*.yaml ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY types/package.json ./types/

# pnpm 11 + lockfile v9; allowBuilds whitelists native install scripts
RUN pnpm install --frozen-lockfile

# Copy source code
COPY server/ ./server/
COPY client/ ./client/
COPY types/ ./types/

# Generate Prisma client (essential for TypeScript types)
RUN pnpm --filter @ha-addon/server db:generate

# Build all packages in the workspace
RUN pnpm build

# ---------------------------------------------------------------------------
# Production — same base as builder; no duplicate Node/pnpm install.
# ---------------------------------------------------------------------------
FROM base

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/package*.json /app/pnpm-*.yaml ./
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/client/package.json ./client/
COPY --from=builder /app/types/package.json ./types/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server ./server
COPY --from=builder /app/client/dist ./client/dist
COPY --from=builder /app/types ./types

# Copy and setup startup scripts
COPY run.sh /run.sh
COPY run-standalone.sh /run-standalone.sh
RUN chmod +x /run.sh /run-standalone.sh

# Create data directory for persistence
RUN mkdir -p /data

# Ports are handled by Home Assistant ingress and port mapping
# No need to EXPOSE when using ingress system

# Start the application
CMD ["/run.sh"]
