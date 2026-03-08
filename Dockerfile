ARG BUILD_FROM=ghcr.io/home-assistant/amd64-base:latest

# Build stage
FROM node:20-alpine AS builder

RUN apk add --no-cache bash curl git python3 make g++ && rm -rf /var/cache/apk/*
RUN npm install -g pnpm@8

WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json pnpm-*.yaml ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY types/package.json ./types/

# Install dependencies (handle lockfile version differences)
RUN pnpm install --force || pnpm install

# Copy source code
COPY server/ ./server/
COPY client/ ./client/
COPY types/ ./types/

# Generate Prisma client (essential for TypeScript types)
RUN pnpm --filter @ha-addon/server db:generate

# Build all packages in the workspace
RUN pnpm build

# Production stage
FROM $BUILD_FROM

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Copy Node.js from build stage so native modules (better-sqlite3) match the exact runtime version
COPY --from=builder /usr/local/bin/node /usr/local/bin/node
COPY --from=builder /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -sf /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx

RUN apk add --no-cache bash curl && rm -rf /var/cache/apk/*
RUN npm install -g pnpm@8

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

# Copy and setup startup script
COPY run.sh /run.sh
RUN chmod +x /run.sh

# Create data directory for persistence
RUN mkdir -p /data

# Ports are handled by Home Assistant ingress and port mapping
# No need to EXPOSE when using ingress system

# Start the application
CMD ["/run.sh"] 