import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const c = loadConfig({ DATABASE_URL: 'postgres://u:p@localhost/db' });
    expect(c).toMatchObject({ port: 4000, env: 'development', maxUploadBytes: 500 * 1024 * 1024 });
    expect(c.corsOrigins).toEqual(['http://localhost:5173']);
  });

  it('parses CORS lists and numbers', () => {
    const c = loadConfig({
      DATABASE_URL: 'postgres://u:p@localhost/db',
      CORS_ORIGINS: 'https://a.test, https://b.test',
      PORT: '8080',
    });
    expect(c.corsOrigins).toEqual(['https://a.test', 'https://b.test']);
    expect(c.port).toBe(8080);
  });

  it('throws a readable error when DATABASE_URL is missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});
