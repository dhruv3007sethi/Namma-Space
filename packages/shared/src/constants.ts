/** API version prefix used by every REST route. */
export const API_PREFIX = '/api/v1';

/** Supported upload media types for capture ingestion. */
export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export const ACCEPTED_VIDEO_MIME_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'] as const;

export const ACCEPTED_MEDIA_MIME_TYPES = [
  ...ACCEPTED_IMAGE_MIME_TYPES,
  ...ACCEPTED_VIDEO_MIME_TYPES,
] as const;

export type AcceptedMediaMimeType = (typeof ACCEPTED_MEDIA_MIME_TYPES)[number];

export const MEDIA_KINDS = ['image', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const SPACE_TYPES = ['room', 'floor', 'building', 'outdoor_area', 'other'] as const;
export type SpaceType = (typeof SPACE_TYPES)[number];

export const POI_CATEGORIES = [
  'furniture',
  'door',
  'window',
  'stairs',
  'elevator',
  'restroom',
  'exit',
  'appliance',
  'landmark',
  'other',
] as const;
export type PoiCategory = (typeof POI_CATEGORIES)[number];

/** Where a POI came from. Phase 1 only creates `manual` POIs; AI detection arrives later. */
export const POI_SOURCES = ['manual', 'ai_detected'] as const;
export type PoiSource = (typeof POI_SOURCES)[number];

export const RECONSTRUCTION_STATUSES = [
  'queued',
  'processing',
  'succeeded',
  'failed',
  'cancelled',
] as const;
export type ReconstructionStatus = (typeof RECONSTRUCTION_STATUSES)[number];

/** Classifies a MIME type into a media kind, or returns null when unsupported. */
export function mediaKindForMimeType(mimeType: string): MediaKind | null {
  const normalized = mimeType.toLowerCase();
  if ((ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized)) return 'image';
  if ((ACCEPTED_VIDEO_MIME_TYPES as readonly string[]).includes(normalized)) return 'video';
  return null;
}
