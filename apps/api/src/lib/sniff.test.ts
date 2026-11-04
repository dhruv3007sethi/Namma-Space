import { describe, expect, it } from 'vitest';
import { mimeTypesCompatible, sniffMediaType } from './sniff.js';

const bytes = (...parts: (number[] | string)[]) =>
  Buffer.concat(
    parts.map((p) => (typeof p === 'string' ? Buffer.from(p, 'latin1') : Buffer.from(p))),
  );

describe('sniffMediaType', () => {
  it.each([
    [bytes([0xff, 0xd8, 0xff, 0xdb]), 'image/jpeg'],
    [bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a]), 'image/png'],
    [bytes('RIFF', [0, 0, 0, 0], 'WEBP'), 'image/webp'],
    [bytes([0, 0, 0, 0x18], 'ftypheic'), 'image/heic'],
    [bytes([0, 0, 0, 0x18], 'ftypmif1'), 'image/heif'],
    [bytes([0, 0, 0, 0x14], 'ftypqt  '), 'video/quicktime'],
    [bytes([0, 0, 0, 0x18], 'ftypmp42'), 'video/mp4'],
    [bytes([0x1a, 0x45, 0xdf, 0xa3]), 'video/webm'],
    [bytes('%PDF-1.7'), null],
    [bytes(), null],
  ])('detects %#', (head, expected) => {
    expect(sniffMediaType(head)).toBe(expected);
  });
});

describe('mimeTypesCompatible', () => {
  it('allows container aliases but not cross-kind mismatches', () => {
    expect(mimeTypesCompatible('video/quicktime', 'video/mp4')).toBe(true);
    expect(mimeTypesCompatible('image/heif', 'image/heic')).toBe(true);
    expect(mimeTypesCompatible('image/png', 'image/jpeg')).toBe(false);
  });
});
