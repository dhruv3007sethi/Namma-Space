import type { Readable } from 'node:stream';

/**
 * Contracts for external AI services. Phase 1 defines the seams only: no
 * provider adapters are bundled, and the API reports every AI capability as
 * "not configured" rather than returning fabricated results.
 */

export interface ReconstructionInputMedia {
  id: string;
  kind: 'image' | 'video';
  mimeType: string;
  filename: string;
  open: () => Promise<Readable>;
}

export interface ReconstructionSubmission {
  jobId: string;
  spaceId: string;
  media: ReconstructionInputMedia[];
}

export interface ReconstructionProviderStatus {
  status: 'queued' | 'processing' | 'succeeded' | 'failed' | 'cancelled';
  errorMessage?: string;
}

/** An external photogrammetry / neural reconstruction service (e.g. a Gaussian splatting API). */
export interface ReconstructionProvider {
  readonly id: string;
  readonly label: string;
  /** Submits media and returns the provider's job identifier. */
  submit(input: ReconstructionSubmission): Promise<{ externalJobId: string }>;
  getStatus(externalJobId: string): Promise<ReconstructionProviderStatus>;
}

export interface DetectedObject {
  label: string;
  confidence: number;
  /** Normalised [0,1] bounding box in image space. */
  box: { x: number; y: number; width: number; height: number };
}

/** An external vision model that detects furniture, doors, windows, etc. */
export interface VisionProvider {
  readonly id: string;
  readonly label: string;
  detectObjects(image: Readable, mimeType: string): Promise<DetectedObject[]>;
}

export interface ProviderRegistry {
  reconstruction: ReconstructionProvider[];
  vision: VisionProvider[];
}

/** Known integrations, surfaced to clients so the UI can show what is pending configuration. */
export const KNOWN_RECONSTRUCTION_INTEGRATIONS = [
  { id: 'gaussian-splatting-api', label: 'Gaussian splatting reconstruction API' },
  { id: 'photogrammetry-api', label: 'Photogrammetry reconstruction API' },
] as const;

export const KNOWN_VISION_INTEGRATIONS = [
  { id: 'vision-object-detection', label: 'AI vision object detection' },
] as const;

export const emptyProviderRegistry = (): ProviderRegistry => ({ reconstruction: [], vision: [] });
