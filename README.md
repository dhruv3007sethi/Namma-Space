# Namma Space

Namma Space turns indoor spaces into interactive digital twins. You capture a room with a
smartphone, the platform reconstructs it in 3D through external APIs, and you can explore it,
search it and navigate it in the browser.

This repository holds **Phase 1: the project foundation**. It covers the data model, REST API,
media ingestion, the 3D viewer shell, manually placed points of interest (POIs) with search, and
the extension points that the AI phases will plug into.

> **No fake AI.** Phase 1 ships no reconstruction or vision model and returns no simulated
> output. The API reports each AI integration as `configured: false`, and requesting a
> reconstruction returns `503 PROVIDER_NOT_CONFIGURED` until a real provider adapter is
> registered. See [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## What works today

| Area                | Status                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Projects & spaces   | Full CRUD. A space is a room, floor, building or outdoor area, with an optional floor level                                 |
| Capture upload      | Multi-file photo and video upload with progress, SHA-256 checksums, magic-byte checks, size limits and HTTP range streaming |
| 3D viewer           | Three.js scene in the space's metric frame (1 m grid, orbit controls, POI markers, click to place)                          |
| Points of interest  | Manual POIs with category and 3D position, plus search by text, category, project or space                                  |
| Reconstruction jobs | Job model, provider contract, status polling. Disabled until a provider is configured                                       |
| Object detection    | Provider contract only. Disabled until a provider is configured                                                             |
| Navigation          | Not started (planned, see [docs/ROADMAP.md](docs/ROADMAP.md))                                                               |

## Repository layout

```
apps/
  api/        Fastify + Drizzle ORM + PostgreSQL REST API (TypeScript)
    drizzle/  SQL migrations (generated, committed)
    src/      config, db schema, routes, storage drivers, provider contracts
    test/     integration tests against a real Postgres database
  web/        React 19 + Vite + React Router + TanStack Query + react-three-fiber
packages/
  shared/     Zod schemas, domain types and constants shared by the API and the web app
docs/         Architecture, integrations and roadmap
```

## Getting started

Prerequisites: Node.js 22 or later, pnpm 10 (`corepack enable`), and PostgreSQL 16 (Docker is
the easiest way to run it).

```bash
pnpm install
```

```bash
cp .env.example .env
```

```bash
docker compose up -d db
```

```bash
pnpm db:migrate
```

```bash
pnpm dev
```

- Web app: http://localhost:5173
- API: http://localhost:4000 (health check at `/health`)

The API also applies pending migrations on startup. Vite proxies `/api` and `/health` to the
API, so the browser talks to a single origin.

If you use your own Postgres instead of Docker, create a `namma` role and both databases
(`namma_space` and `namma_space_test`), or point `DATABASE_URL` and `TEST_DATABASE_URL` at
databases you already have.

## Scripts

| Command            | What it does                                                             |
| ------------------ | ------------------------------------------------------------------------ |
| `pnpm dev`         | Runs the API (tsx watch) and the web app (Vite) together                 |
| `pnpm test`        | Runs all unit and integration tests (needs `TEST_DATABASE_URL`)          |
| `pnpm typecheck`   | Type-checks every package                                                |
| `pnpm lint`        | Runs ESLint across the monorepo                                          |
| `pnpm format`      | Formats with Prettier                                                    |
| `pnpm build`       | Builds shared → API (`dist/`) → web (`dist/`)                            |
| `pnpm db:generate` | Generates a new SQL migration after you edit `apps/api/src/db/schema.ts` |
| `pnpm db:migrate`  | Applies migrations to `DATABASE_URL`                                     |

The API integration tests **drop and recreate** the schema in `TEST_DATABASE_URL`, so never
point it at a database you want to keep.

## API overview

All routes are under `/api/v1` and return either `{ "data": ... }` or
`{ "error": { "code", "message", "details?" } }`.

| Method & path                                                     | Purpose                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------- |
| `GET /health`                                                     | Liveness, plus database and storage checks           |
| `GET /api/v1/capabilities`                                        | Upload limits, accepted types, AI integration status |
| `GET/POST /api/v1/projects`                                       | List or create projects                              |
| `GET/PATCH/DELETE /api/v1/projects/:id`                           | Read, update or delete a project (cascades)          |
| `GET/POST /api/v1/projects/:id/spaces`                            | List or create spaces in a project                   |
| `GET/PATCH/DELETE /api/v1/spaces/:id`                             | Read, update or delete a space (cascades)            |
| `GET/POST /api/v1/spaces/:id/media`                               | List captures, or upload them (multipart)            |
| `GET/DELETE /api/v1/media/:id`                                    | Read or delete capture metadata                      |
| `GET /api/v1/media/:id/content`                                   | Stream a capture (supports `Range`, `ETag`)          |
| `GET/POST /api/v1/spaces/:id/pois`                                | List or create POIs in a space                       |
| `PATCH/DELETE /api/v1/pois/:id`                                   | Update or delete a POI                               |
| `GET /api/v1/pois/search?q=&category=&projectId=&spaceId=&limit=` | Search POIs                                          |
| `GET/POST /api/v1/spaces/:id/reconstructions`                     | List jobs, or request a reconstruction               |
| `GET /api/v1/reconstructions/:id`                                 | Read a job, refreshing its status from the provider  |

Request and response shapes are defined once, in `packages/shared/src/schemas.ts`.

## Further reading

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the pieces fit together, and the design decisions
- [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md): how to add a reconstruction or vision provider
- [docs/ROADMAP.md](docs/ROADMAP.md): the phases after this one
