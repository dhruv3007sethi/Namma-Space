import { sql } from 'drizzle-orm';
import {
  bigint,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  MEDIA_KINDS,
  POI_CATEGORIES,
  POI_SOURCES,
  RECONSTRUCTION_STATUSES,
  SPACE_TYPES,
} from '@namma/shared';

export const spaceTypeEnum = pgEnum('space_type', SPACE_TYPES);
export const mediaKindEnum = pgEnum('media_kind', MEDIA_KINDS);
export const poiCategoryEnum = pgEnum('poi_category', POI_CATEGORIES);
export const poiSourceEnum = pgEnum('poi_source', POI_SOURCES);
export const reconstructionStatusEnum = pgEnum('reconstruction_status', RECONSTRUCTION_STATUSES);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  ...timestamps,
});

export const spaces = pgTable(
  'spaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    spaceType: spaceTypeEnum('space_type').notNull().default('room'),
    floorLevel: integer('floor_level'),
    ...timestamps,
  },
  (t) => [index('spaces_project_id_idx').on(t.projectId)],
);

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    kind: mediaKindEnum('kind').notNull(),
    originalFilename: varchar('original_filename', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    sha256: varchar('sha256', { length: 64 }).notNull(),
    storageKey: varchar('storage_key', { length: 512 }).notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('media_assets_space_id_idx').on(t.spaceId)],
);

export const pointsOfInterest = pgTable(
  'points_of_interest',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    category: poiCategoryEnum('category').notNull(),
    source: poiSourceEnum('source').notNull().default('manual'),
    positionX: doublePrecision('position_x').notNull(),
    positionY: doublePrecision('position_y').notNull(),
    positionZ: doublePrecision('position_z').notNull(),
    ...timestamps,
  },
  (t) => [
    index('poi_space_id_idx').on(t.spaceId),
    index('poi_name_lower_idx').on(sql`lower(${t.name})`),
  ],
);

export const reconstructionJobs = pgTable(
  'reconstruction_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    spaceId: uuid('space_id')
      .notNull()
      .references(() => spaces.id, { onDelete: 'cascade' }),
    provider: varchar('provider', { length: 64 }).notNull(),
    status: reconstructionStatusEnum('status').notNull().default('queued'),
    externalJobId: varchar('external_job_id', { length: 255 }),
    inputMediaIds: jsonb('input_media_ids').$type<string[]>().notNull(),
    errorMessage: text('error_message'),
    ...timestamps,
  },
  (t) => [index('reconstruction_jobs_space_id_idx').on(t.spaceId)],
);
