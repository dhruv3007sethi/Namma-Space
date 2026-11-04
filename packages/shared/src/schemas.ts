import { z } from 'zod';
import {
  MEDIA_KINDS,
  POI_CATEGORIES,
  POI_SOURCES,
  RECONSTRUCTION_STATUSES,
  SPACE_TYPES,
} from './constants.js';

const id = z.uuid();
const timestamp = z.iso.datetime({ offset: true });
const name = z.string().trim().min(1, 'Name is required').max(120);
const description = z.string().trim().max(2000);

/* ----------------------------------------------------------------------------
 * Projects
 * ------------------------------------------------------------------------- */

export const projectSchema = z.object({
  id,
  name,
  description: z.string().nullable(),
  spaceCount: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Project = z.infer<typeof projectSchema>;

export const createProjectSchema = z.object({
  name,
  description: description.optional(),
});
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const updateProjectSchema = z
  .object({
    name: name.optional(),
    description: description.nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/* ----------------------------------------------------------------------------
 * Spaces (a room, floor or building captured inside a project)
 * ------------------------------------------------------------------------- */

export const spaceTypeSchema = z.enum(SPACE_TYPES);

export const spaceSchema = z.object({
  id,
  projectId: id,
  name,
  description: z.string().nullable(),
  spaceType: spaceTypeSchema,
  floorLevel: z.number().int().nullable(),
  mediaCount: z.number().int().nonnegative(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type Space = z.infer<typeof spaceSchema>;

export const createSpaceSchema = z.object({
  name,
  description: description.optional(),
  spaceType: spaceTypeSchema.default('room'),
  floorLevel: z.number().int().min(-20).max(300).nullable().optional(),
});
export type CreateSpaceInput = z.input<typeof createSpaceSchema>;

export const updateSpaceSchema = z
  .object({
    name: name.optional(),
    description: description.nullable().optional(),
    spaceType: spaceTypeSchema.optional(),
    floorLevel: z.number().int().min(-20).max(300).nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
export type UpdateSpaceInput = z.infer<typeof updateSpaceSchema>;

/* ----------------------------------------------------------------------------
 * Media assets (uploaded photos & videos of a space)
 * ------------------------------------------------------------------------- */

export const mediaAssetSchema = z.object({
  id,
  spaceId: id,
  kind: z.enum(MEDIA_KINDS),
  originalFilename: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  url: z.string(),
  createdAt: timestamp,
});
export type MediaAsset = z.infer<typeof mediaAssetSchema>;

/* ----------------------------------------------------------------------------
 * Points of interest
 * ------------------------------------------------------------------------- */

/** Position in the space's local coordinate frame, metres, Y-up. */
export const vec3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
});
export type Vec3 = z.infer<typeof vec3Schema>;

export const poiCategorySchema = z.enum(POI_CATEGORIES);

export const poiSchema = z.object({
  id,
  spaceId: id,
  name,
  description: z.string().nullable(),
  category: poiCategorySchema,
  source: z.enum(POI_SOURCES),
  position: vec3Schema,
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type PointOfInterest = z.infer<typeof poiSchema>;

export const createPoiSchema = z.object({
  name,
  description: description.optional(),
  category: poiCategorySchema,
  position: vec3Schema,
});
export type CreatePoiInput = z.infer<typeof createPoiSchema>;

export const updatePoiSchema = z
  .object({
    name: name.optional(),
    description: description.nullable().optional(),
    category: poiCategorySchema.optional(),
    position: vec3Schema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'At least one field must be provided' });
export type UpdatePoiInput = z.infer<typeof updatePoiSchema>;

export const poiSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  category: poiCategorySchema.optional(),
  projectId: id.optional(),
  spaceId: id.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type PoiSearchQuery = z.input<typeof poiSearchQuerySchema>;

/* ----------------------------------------------------------------------------
 * Reconstruction jobs (photo/video -> 3D model via external providers)
 * ------------------------------------------------------------------------- */

export const reconstructionJobSchema = z.object({
  id,
  spaceId: id,
  provider: z.string(),
  status: z.enum(RECONSTRUCTION_STATUSES),
  externalJobId: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
});
export type ReconstructionJob = z.infer<typeof reconstructionJobSchema>;

export const createReconstructionSchema = z.object({
  provider: z.string().min(1).optional(),
  mediaAssetIds: z.array(id).min(1).optional(),
});
export type CreateReconstructionInput = z.infer<typeof createReconstructionSchema>;

/* ----------------------------------------------------------------------------
 * Platform
 * ------------------------------------------------------------------------- */

export const integrationStatusSchema = z.object({
  id: z.string(),
  label: z.string(),
  configured: z.boolean(),
});
export type IntegrationStatus = z.infer<typeof integrationStatusSchema>;

export const capabilitiesSchema = z.object({
  version: z.string(),
  maxUploadBytes: z.number().int().positive(),
  acceptedMimeTypes: z.array(z.string()),
  reconstructionProviders: z.array(integrationStatusSchema),
  visionProviders: z.array(integrationStatusSchema),
});
export type Capabilities = z.infer<typeof capabilitiesSchema>;

export const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  uptimeSeconds: z.number(),
  checks: z.object({ database: z.enum(['ok', 'error']), storage: z.enum(['ok', 'error']) }),
});
export type Health = z.infer<typeof healthSchema>;

/* ----------------------------------------------------------------------------
 * Envelopes
 * ------------------------------------------------------------------------- */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'PROVIDER_NOT_CONFIGURED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(ERROR_CODES),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export interface ListResponse<T> {
  data: T[];
}

export interface ItemResponse<T> {
  data: T;
}
