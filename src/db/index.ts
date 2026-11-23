import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const databaseUrl = process.env.DATABASE_URL?.trim();
    const explicitSsl = process.env.SQL_SSL?.toLowerCase();
    const shouldUseSsl =
      explicitSsl === 'true' ||
      (explicitSsl !== 'false' &&
        Boolean(databaseUrl && /sslmode=(require|verify-full|verify-ca)/i.test(databaseUrl)));

    global._postgresPool = databaseUrl
      ? new Pool({
          connectionString: databaseUrl,
          ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
          max: Number(process.env.SQL_POOL_MAX) || 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
        })
      : new Pool({
          host: process.env.SQL_HOST,
          port: process.env.SQL_PORT ? Number(process.env.SQL_PORT) : 5432,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
          max: Number(process.env.SQL_POOL_MAX) || 10,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
        });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

export const pool = createPool();
export const db = drizzle(pool, { schema });

export async function closePool(): Promise<void> {
  if (global._postgresPool) {
    await global._postgresPool.end();
    global._postgresPool = undefined;
  }
}
