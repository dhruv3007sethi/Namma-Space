import { z } from 'zod';
import { parseOrThrow } from './errors.js';

const idParams = z.object({ id: z.uuid('Invalid id') });

export const parseIdParam = (params: unknown): string => parseOrThrow(idParams, params).id;
