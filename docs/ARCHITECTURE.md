# Architecture

## Overview

```
 Browser (apps/web)                          API (apps/api)                     Infrastructure
┌──────────────────────────┐   /api/v1    ┌──────────────────────────────┐   ┌──────────────┐
│ React Router pages       │ ───────────▶ │ Fastify routes               │──▶│ PostgreSQL   │
│ TanStack Query cache     │   JSON +     │  ├─ zod validation (shared)  │   └──────────────┘
│ react-three-fiber viewer │   multipart  │  ├─ Drizzle ORM              │   ┌──────────────┐
└──────────────────────────┘              │  ├─ StorageDriver ───────────┼──▶│ Local disk   │
            ▲                             │  └─ ProviderRegistry ────────┼──▶│ (S3 later)   │
            │ types + schemas             └──────────────────────────────┘   └──────────────┘
 packages/shared  ◀───────────────────────────── types + schemas            External AI APIs
                                                                            (later phases)
```

## Domain model

```
Project 1───* Space 1───* MediaAsset
                    1───* PointOfInterest
                    1───* ReconstructionJob ──▶ MediaAsset ids (input_media_ids)
```

- **Project**: a customer site or portfolio, such as an office campus or a mall.
- **Space**: one capturable unit: a room, floor, building or outdoor area. Every space has its
  own local coordinate frame, in metres with Y up. POIs, and later the reconstructed geometry,
  are expressed in that frame.
- **MediaAsset**: an uploaded photo or video. The bytes live in object storage. The database row
  holds the metadata and the SHA-256 checksum.
- **PointOfInterest**: a named, categorised position. `source` is `manual` in Phase 1, and
  `ai_detected` is reserved for the vision pipeline.
- **ReconstructionJob**: one request to an external reconstruction provider, with its status
  lifecycle (`queued → processing → succeeded | failed | cancelled`).

Deleting a project or space cascades in the database. The API first collects the storage keys
it needs, deletes the rows, and then removes the blobs.

## Key decisions

**A TypeScript monorepo with a shared contract package.** `@namma/shared` holds Zod schemas that
the API uses for validation and the web app uses for types. The package exports its source
through a custom `@namma/source` condition. Vite, Vitest, tsx and `tsc` resolve that condition,
so development needs no build step, while production Node loads the compiled `dist/`.

**Fastify with explicit dependency injection.** `buildApp(ctx)` receives its configuration,
database, storage driver and provider registry. Tests build the real app against a real Postgres
database and a temporary storage directory, and inject test doubles only at the provider seam.

**Drizzle ORM with committed SQL migrations.** The schema in `apps/api/src/db/schema.ts` is the
source of truth. `pnpm db:generate` writes reviewable SQL to `apps/api/drizzle/`. The server
applies migrations on boot, and the tests apply them to a freshly created schema.

**Uploads are streamed and checked by their contents.** Multipart parts stream straight to disk.
On the way, the API computes the SHA-256 and the size and captures the first bytes of the file.
It rejects a file when its magic bytes don't match the declared MIME type, and also rejects
empty, oversized and unsupported files. Any rejection rolls back the whole upload, including
files already written. Captures are served with `Range` support so videos can be scrubbed, and
with immutable caching keyed on the checksum.

**Storage behind an interface.** `StorageDriver` (`put`, `get` with an optional range, `delete`,
`exists`, `healthCheck`) currently has a local-disk implementation that guards against path
traversal. An S3-compatible driver can replace it without touching the routes.

**AI behind provider contracts.** `ReconstructionProvider` and `VisionProvider` in
`src/providers/types.ts` define the integration surface. The registry is empty in Phase 1, and
the API and UI both make that state visible instead of hiding it.

**A viewer built for the real thing.** The 3D view already works in the space's metric frame:
a 1 m grid, orbit controls, POI markers, and placing points by raycasting onto the floor plane.
Reconstructed meshes or Gaussian splats will load into the same scene, so the POIs and navigation
built now will carry over unchanged. The viewer is lazy-loaded to keep three.js out of the main
bundle.

## Error contract

Every error response has this shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Request validation failed", "details": [...] } }
```

| Code                      | HTTP |
| ------------------------- | ---- |
| `VALIDATION_ERROR`        | 400  |
| `NOT_FOUND`               | 404  |
| `CONFLICT`                | 409  |
| `PAYLOAD_TOO_LARGE`       | 413  |
| `UNSUPPORTED_MEDIA_TYPE`  | 415  |
| `PROVIDER_NOT_CONFIGURED` | 503  |
| `INTERNAL_ERROR`          | 500  |

## Testing

- `packages/shared`: unit tests for the schemas.
- `apps/api`: unit tests for config, content sniffing and storage, plus integration tests that
  call the real Fastify app through `inject` against Postgres. These cover CRUD, cascades, upload
  validation and rollback, range requests, POI search (including escaping of LIKE wildcards),
  and the reconstruction flow, both with no provider and with a test-double provider.
- `apps/web`: tests for the API client and page-level component tests (jsdom and Testing
  Library, with `fetch` mocked).
