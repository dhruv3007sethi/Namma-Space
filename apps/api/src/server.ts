import { sql } from 'drizzle-orm';
import { buildApp } from './app.js';
import { ConfigError, loadConfig } from './config.js';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { emptyProviderRegistry } from './providers/types.js';
import { LocalStorageDriver } from './storage/local.js';

async function main(): Promise<void> {
  const config = loadConfig();
  await runMigrations(config.databaseUrl);

  const database = createDatabase(config.databaseUrl);
  const app = await buildApp({
    config,
    db: database.db,
    checkDatabase: async () => {
      await database.db.execute(sql`select 1`);
      return true;
    },
    storage: new LocalStorageDriver(config.storageDir),
    // External AI adapters are registered here once implemented (see docs/INTEGRATIONS.md).
    providers: emptyProviderRegistry(),
  });

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await database.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ host: config.host, port: config.port });
}

main().catch((err: unknown) => {
  if (err instanceof ConfigError) {
    console.error(err.message);
  } else {
    console.error(err);
  }
  process.exit(1);
});
