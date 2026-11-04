import type { AppConfig } from './config.js';
import type { Database } from './db/client.js';
import type { ProviderRegistry } from './providers/types.js';
import type { StorageDriver } from './storage/storage.js';

/** Dependencies shared by all route modules. Constructed once in `buildApp`. */
export interface AppContext {
  config: AppConfig;
  db: Database;
  checkDatabase: () => Promise<boolean>;
  storage: StorageDriver;
  providers: ProviderRegistry;
}
