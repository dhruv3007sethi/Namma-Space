import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { ApiErrorBody, ErrorCode } from '@namma/shared';
import type { AppContext } from './context.js';
import { AppError } from './lib/errors.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMediaRoutes } from './routes/media.js';
import { registerPoiRoutes } from './routes/pois.js';
import { registerProjectRoutes } from './routes/projects.js';
import { registerReconstructionRoutes } from './routes/reconstructions.js';
import { registerSpaceRoutes } from './routes/spaces.js';

function codeForStatus(status: number): ErrorCode {
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 413) return 'PAYLOAD_TOO_LARGE';
  if (status === 415) return 'UNSUPPORTED_MEDIA_TYPE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'VALIDATION_ERROR';
}

export async function buildApp(ctx: AppContext): Promise<FastifyInstance> {
  const { config } = ctx;
  const app = Fastify({
    logger:
      config.logLevel === 'silent'
        ? false
        : {
            level: config.logLevel,
            ...(config.logPretty && { transport: { target: 'pino-pretty' } }),
          },
    bodyLimit: 1024 * 1024,
    trustProxy: true,
  });

  await app.register(cors, {
    origin: config.corsOrigins.includes('*') ? true : config.corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });
  await app.register(multipart, {
    limits: { fileSize: config.maxUploadBytes, files: 50, fields: 10 },
  });

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    let status: number;
    let body: ApiErrorBody;
    if (err instanceof AppError) {
      status = err.statusCode;
      body = {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details !== undefined && { details: err.details }),
        },
      };
    } else {
      status = err.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
      const code = codeForStatus(status);
      body = {
        error: {
          code,
          message: status >= 500 ? 'An unexpected error occurred' : err.message,
        },
      };
    }
    if (status >= 500) req.log.error({ err }, 'request failed');
    return reply.code(status).send(body);
  });

  app.setNotFoundHandler((req, reply) => {
    const body: ApiErrorBody = {
      error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.url} not found` },
    };
    return reply.code(404).send(body);
  });

  registerHealthRoutes(app, ctx);
  registerProjectRoutes(app, ctx);
  registerSpaceRoutes(app, ctx);
  registerMediaRoutes(app, ctx);
  registerPoiRoutes(app, ctx);
  registerReconstructionRoutes(app, ctx);

  return app;
}
