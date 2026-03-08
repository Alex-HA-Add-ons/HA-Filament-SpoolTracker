# Home Assistant Add-on Boilerplate

A starter template for building Home Assistant add-ons with a modern full-stack TypeScript architecture.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express, TypeScript |
| **Frontend** | React 19, TypeScript, Vite |
| **Database** | SQLite (default) / PostgreSQL (optional), Prisma ORM |
| **Real-time** | WebSocket (ws) |
| **Package Manager** | pnpm workspaces |
| **Deployment** | Docker, Home Assistant ingress |

## Project Structure

```
├── client/              # React frontend (Vite)
│   └── src/
│       ├── pages/       # Page components
│       ├── components/  # Shared UI components
│       ├── hooks/       # Custom React hooks
│       ├── services/    # API client
│       └── styles/      # Shared CSS
├── server/              # Express backend (TypeScript)
│   ├── routes/          # API routes
│   ├── websocket/       # WebSocket server
│   ├── database/        # Prisma connection (optional)
│   ├── middleware/       # Express middleware
│   ├── prisma/          # Schema & migrations
│   └── utils/           # Logger, utilities
├── types/               # Shared TypeScript types
├── scripts/             # Dev tooling (version bump)
├── config.yaml          # HA add-on config
├── Dockerfile           # Multi-stage Docker build
├── build.yaml           # Multi-arch build targets
├── run.sh               # HA startup script
├── repository.yaml      # HA add-on repository metadata
└── docker-compose.yml   # Optional PostgreSQL for dev
```

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+

### Development Setup

```bash
# Install dependencies
pnpm install

# Copy and configure environment (optional — works without .env)
cp server/config.example.env server/.env

# Generate Prisma client
pnpm prisma:generate

# Start development servers
pnpm dev
```

The client runs on `http://localhost:5173` and proxies API calls to the server on port `3001`.

The server works **without any database** out of the box. To enable database support, set `DATABASE_URL` in `server/.env`:

```bash
# SQLite (simplest, file-based):
DATABASE_URL="file:./data/app.db"

# PostgreSQL (for production workloads):
DATABASE_URL="postgresql://user:password@localhost:5432/mydb"
```

If using PostgreSQL locally, spin it up with `docker compose up -d`.

### Build for Home Assistant

```bash
pnpm addon:build
```

## Features Included

- **Health endpoint** (`/api/health`) with uptime and DB status
- **WebSocket** server with ping/pong and broadcast
- **Prisma ORM** with SQLite default + PostgreSQL option
- **Database-optional** — server boots and runs without any DB configured
- **HA ingress middleware** for seamless panel integration
- **Structured logger** with component namespacing and log levels
- **Dark-themed UI** with CSS custom properties
- **Persistent state hook** (`useStoredState`) for localStorage-backed UI state
- **Axios API client** with retry logic and ingress support
- **Responsive design** with mobile breakpoints
- **Auto version bump** via `simple-git-hooks` pre-commit hook

## Customizing

1. **Add API routes**: Create files in `server/routes/`, mount in `server/routes/index.ts`
2. **Add pages**: Create folders in `client/src/pages/`, import in `App.tsx`
3. **Add DB models**: Edit `server/prisma/schema.prisma`, run migrations
4. **Add shared types**: Edit `types/index.ts`
5. **Add WebSocket events**: Extend `WebSocketManager` and `useWebSocket` hook types
6. **HA config options**: Edit `config.yaml` schema, access in `run.sh` via `bashio::config`

## Database Options

| Option | When to Use |
|--------|-------------|
| **No database** | Simple add-ons that don't need persistence |
| **SQLite** (default) | Most add-ons — zero-config, file lives in `/data/` for HA persistence |
| **PostgreSQL** | Heavy workloads, concurrent writes, or when you already run a PG add-on |

To switch between SQLite and PostgreSQL, change the `provider` in `server/prisma/schema.prisma` and update `DATABASE_URL` accordingly. Note that some Prisma column types differ between providers.

## License

MIT
