import { describe, expect, it } from 'vitest';
import {
  createPoiSchema,
  createProjectSchema,
  createSpaceSchema,
  mediaKindForMimeType,
  poiSearchQuerySchema,
  updateProjectSchema,
} from './index.js';

describe('createProjectSchema', () => {
  it('trims and accepts a valid name', () => {
    expect(createProjectSchema.parse({ name: '  HQ Office ' })).toEqual({ name: 'HQ Office' });
  });

  it('rejects an empty name', () => {
    expect(createProjectSchema.safeParse({ name: '   ' }).success).toBe(false);
  });
});

describe('updateProjectSchema', () => {
  it('requires at least one field', () => {
    expect(updateProjectSchema.safeParse({}).success).toBe(false);
    expect(updateProjectSchema.safeParse({ description: null }).success).toBe(true);
  });
});

describe('createSpaceSchema', () => {
  it('defaults spaceType to room', () => {
    expect(createSpaceSchema.parse({ name: 'Kitchen' }).spaceType).toBe('room');
  });

  it('rejects unknown space types', () => {
    expect(createSpaceSchema.safeParse({ name: 'X', spaceType: 'spaceship' }).success).toBe(false);
  });
});

describe('createPoiSchema', () => {
  it('requires a finite position', () => {
    const base = { name: 'Main door', category: 'door' as const };
    expect(createPoiSchema.safeParse({ ...base, position: { x: 1, y: 0, z: 2 } }).success).toBe(
      true,
    );
    expect(
      createPoiSchema.safeParse({ ...base, position: { x: Infinity, y: 0, z: 2 } }).success,
    ).toBe(false);
  });
});

describe('poiSearchQuerySchema', () => {
  it('coerces limit from a query string and applies a default', () => {
    expect(poiSearchQuerySchema.parse({ limit: '10' }).limit).toBe(10);
    expect(poiSearchQuerySchema.parse({}).limit).toBe(25);
  });
});

describe('mediaKindForMimeType', () => {
  it('classifies images and videos', () => {
    expect(mediaKindForMimeType('image/JPEG')).toBe('image');
    expect(mediaKindForMimeType('video/mp4')).toBe('video');
    expect(mediaKindForMimeType('application/pdf')).toBeNull();
  });
});
