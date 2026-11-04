# Roadmap

## Phase 1: foundation (this repository)

- Monorepo, shared contracts, linting, formatting, CI
- PostgreSQL schema and migrations for projects, spaces, media, POIs and reconstruction jobs
- REST API with validation, structured errors, health checks and capability reporting
- Streamed and verified photo/video ingestion with local storage
- Web app: project and space management, capture upload and gallery, 3D viewer shell, manual
  POIs, POI search
- Provider contracts for reconstruction and vision, disabled until configured

## Phase 2: 3D reconstruction

- First real reconstruction adapter (Gaussian splatting or photogrammetry API)
- Background job runner and polling or webhooks; import of output assets into storage
- Load the reconstructed mesh or splat into the viewer, aligned to the space frame
- S3-compatible storage driver and signed URLs

## Phase 3: AI scene understanding

- Vision adapter for detecting furniture, doors and windows in captures
- Lift detections into 3D using camera poses, as `ai_detected` POIs for the user to review
- Review UI for accepting, editing or rejecting detected objects

## Phase 4: navigation

- Derive a walkable floor area and an obstacle occupancy grid from the reconstruction and POIs
- Obstacle-aware pathfinding (A* on a navigation grid or mesh) between POIs, and across spaces
  through door and stair connectors
- Route rendering and step-by-step guidance in the viewer

## Phase 5: platform

- Authentication, organisations, roles and sharing
- Multi-space stitching for whole buildings
- Mobile capture guidance
