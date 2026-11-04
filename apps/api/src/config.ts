import path from 'node:path';
import { z } from 'zod';

const booleanish = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: booleanish.optional(),
  DATABASE_URL: z.string().url(),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  STORAGE_DIR: z.string().default('./storage'),
  MAX_UPLOAD_MB: z.coerce.number().int().min(1).max(10_240).default(500),
});

export interface AppConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  logLevel: string;
  logPretty: boolean;
  databaseUrl: string;
  corsOrigins: string[];
  storageDir: string;
  maxUploadBytes: number;
  version: string;
}

export class ConfigError extends Error {
  override name = 'ConfigError';
}

/** Parses and validates process environment into a typed config. Throws ConfigError on failure. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new ConfigError(`Invalid environment configuration:\n${issues}`);
  }
  const e = parsed.data;
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.PORT,
    logLevel: e.LOG_LEVEL,
    logPretty: e.LOG_PRETTY ?? e.NODE_ENV === 'development',
    databaseUrl: e.DATABASE_URL,
    corsOrigins: e.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
    storageDir: path.resolve(e.STORAGE_DIR),
    maxUploadBytes: e.MAX_UPLOAD_MB * 1024 * 1024,
    version: env.npm_package_version ?? '0.1.0',
  };
}
