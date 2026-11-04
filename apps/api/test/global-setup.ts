import pg from 'pg';
import { runMigrations } from '../src/db/migrate.js';

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? 'postgres://namma:namma@localhost:5432/namma_space_test';

/** Recreates the test database schema from migrations once per test run. */
export default async function setup(): Promise<void> {
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      'DROP SCHEMA IF EXISTS public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE;',
    );
    await client.query('CREATE SCHEMA public;');
  } finally {
    await client.end();
  }
  await runMigrations(TEST_DATABASE_URL);
}
