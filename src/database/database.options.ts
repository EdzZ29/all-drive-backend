import { join } from 'path';
import type { DataSourceOptions } from 'typeorm';

type PostgresConnectionOptions = Extract<
  DataSourceOptions,
  { type: 'postgres' }
>;

// Reads one setting (from ConfigService in the app, process.env in the CLI).
type Env = (key: string) => string | undefined;

// Postgres connection shared by the app, the migration CLI and the legacy
// upgrade. Use DATABASE_URL for Supabase (Project Settings > Database >
// Connection string), or the DB_* variables for a local Postgres.
export function connectionOptions(env: Env): PostgresConnectionOptions {
  const url = env('DATABASE_URL');
  return {
    type: 'postgres',
    ...(url
      ? { url }
      : {
          host: env('DB_HOST'),
          port: parseInt(env('DB_PORT') ?? '3000', 10),
          username: env('DB_USERNAME'),
          password: env('DB_PASSWORD'),
          database: env('DB_DATABASE'),
        }),
    ssl: sslOptions(env),
  };
}

// Supabase requires SSL. Its certificate is signed by Supabase's own CA, so
// paste that CA (Project Settings > Database > SSL Configuration > Download
// certificate) into DB_SSL_CA to verify it. Without it the connection is still
// encrypted, but the server certificate isn't verified.
function sslOptions(env: Env): PostgresConnectionOptions['ssl'] {
  if (env('DB_SSL') !== 'true') return undefined;
  const ca = env('DB_SSL_CA')?.replace(/\\n/g, '\n');
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

// Auto-sync the schema from the entities: handy locally, unsafe in production,
// where the migrations in ./migrations are applied instead. Defaults to on
// unless NODE_ENV=production; DB_SYNCHRONIZE=true|false overrides.
export function shouldSynchronize(env: Env) {
  const flag = env('DB_SYNCHRONIZE');
  if (flag === 'true' || flag === 'false') return flag === 'true';
  return env('NODE_ENV') !== 'production';
}

// Compiled migration files (dist/database/migrations/*.js).
export const MIGRATIONS_GLOB = join(__dirname, 'migrations', '*.js');
