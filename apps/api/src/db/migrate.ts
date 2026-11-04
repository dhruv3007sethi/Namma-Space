import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDatabase } from './client.js';

export const MIGRATIONS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../drizzle',
);

export async function runMigrations(databaseUrl: string): Promise<void> {
  const handle = createDatabase(databaseUrl);
  try {
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_DIR });
  } finally {
    await handle.close();
  }
}

// Allow `tsx src/db/migrate.ts` / `node dist/db/migrate.js` as a CLI.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  runMigrations(url)
    .then(() => console.log('Migrations applied'))
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
