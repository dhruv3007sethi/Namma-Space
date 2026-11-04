import { API_PREFIX } from '@namma/shared';
import type { MediaAsset, PointOfInterest, Project, ReconstructionJob, Space } from '@namma/shared';
import type {
  mediaAssets,
  pointsOfInterest,
  projects,
  reconstructionJobs,
  spaces,
} from '../db/schema.js';

type Row<T extends { $inferSelect: unknown }> = T['$inferSelect'];

export const toProject = (row: Row<typeof projects>, spaceCount: number): Project => ({
  id: row.id,
  name: row.name,
  description: row.description,
  spaceCount,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toSpace = (row: Row<typeof spaces>, mediaCount: number): Space => ({
  id: row.id,
  projectId: row.projectId,
  name: row.name,
  description: row.description,
  spaceType: row.spaceType,
  floorLevel: row.floorLevel,
  mediaCount,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toMediaAsset = (row: Row<typeof mediaAssets>): MediaAsset => ({
  id: row.id,
  spaceId: row.spaceId,
  kind: row.kind,
  originalFilename: row.originalFilename,
  mimeType: row.mimeType,
  sizeBytes: row.sizeBytes,
  sha256: row.sha256,
  url: `${API_PREFIX}/media/${row.id}/content`,
  createdAt: row.createdAt.toISOString(),
});

export const toPoi = (row: Row<typeof pointsOfInterest>): PointOfInterest => ({
  id: row.id,
  spaceId: row.spaceId,
  name: row.name,
  description: row.description,
  category: row.category,
  source: row.source,
  position: { x: row.positionX, y: row.positionY, z: row.positionZ },
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const toReconstructionJob = (row: Row<typeof reconstructionJobs>): ReconstructionJob => ({
  id: row.id,
  spaceId: row.spaceId,
  provider: row.provider,
  status: row.status,
  externalJobId: row.externalJobId,
  errorMessage: row.errorMessage,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});
