import { describe, expect, it } from 'vitest';
import { formatBytes, formatRelativeTime, humanize } from './format';

describe('formatBytes', () => {
  it('formats across units', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(50 * 1024 * 1024)).toBe('50 MB');
    expect(formatBytes(-1)).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  it('describes recent times', () => {
    const now = Date.parse('2026-01-01T12:00:00Z');
    expect(formatRelativeTime('2026-01-01T11:58:00Z', now)).toBe('2 minutes ago');
    expect(formatRelativeTime('2025-12-31T12:00:00Z', now)).toBe('yesterday');
  });
});

describe('humanize', () => {
  it('turns enum values into labels', () => {
    expect(humanize('outdoor_area')).toBe('Outdoor area');
  });
});
