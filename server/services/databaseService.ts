import {
  Pool,
  type PoolClient,
  type PoolConfig,
  type QueryResult,
  type QueryResultRow,
} from "pg";

export interface DatabaseConfig {
  connectionString: string;
  ssl: boolean;
  rejectUnauthorized: boolean;
  maxConnections: number;
  idleTimeoutMs: number;
  connectionTimeoutMs: number;
}

export interface DatabaseHealth {
  configured: boolean;
  connected: boolean;
  latencyMs: number | null;
  message: string;
}

const DEFAULT_POOL_MAX = 10;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;

const DATABASE_SCHEMA_STATEMENTS = [
  `
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(320) NOT NULL,
      wallet_address VARCHAR(56) NOT NULL UNIQUE,
      onboarding_status VARCHAR(32) NOT NULL DEFAULT 'registered'
        CHECK (
          onboarding_status IN (
            'registered',
            'wallet_connected',
            'funded',
            'active'
          )
        ),
      onboarding_completed BOOLEAN NOT NULL DEFAULT FALSE,
      joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_active_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS users_email_index
      ON users (LOWER(email))
  `,
  `
    CREATE INDEX IF NOT EXISTS users_last_active_index
      ON users (last_active_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS interactions (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      wallet_address VARCHAR(56) NOT NULL,
      action VARCHAR(80) NOT NULL,
      contract_function VARCHAR(80),
      status VARCHAR(20) NOT NULL
        CHECK (
          status IN (
            'pending',
            'success',
            'failed'
          )
        ),
      tx_hash VARCHAR(128),
      network VARCHAR(20) NOT NULL DEFAULT 'TESTNET',
      metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS interactions_wallet_index
      ON interactions (wallet_address, created_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS interactions_user_index
      ON interactions (user_id, created_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS interactions_tx_hash_index
      ON interactions (tx_hash)
      WHERE tx_hash IS NOT NULL
  `,
  `
    CREATE INDEX IF NOT EXISTS interactions_status_index
      ON interactions (status, created_at DESC)
  `,
  `
    CREATE TABLE IF NOT EXISTS feedback (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      wallet_address VARCHAR(56),
      rating INTEGER NOT NULL
        CHECK (
          rating >= 1 AND
          rating <= 5
        ),
      comment TEXT NOT NULL,
      improvement_category VARCHAR(80),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `,
  `
    CREATE INDEX IF NOT EXISTS feedback_wallet_index
      ON feedback (wallet_address, created_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS feedback_user_index
      ON feedback (user_id, created_at DESC)
  `,
  `
    CREATE INDEX IF NOT EXISTS feedback_rating_index
      ON feedback (rating, created_at DESC)
  `,
] as const;

let pool: Pool | null = null;
let poolConnectionString: string | null = null;

function parseBoolean(
  value: string | undefined,
  fallback: boolean
): boolean {
  if (!value) {
    return fallback;
  }

  const normalizedValue =
    value.trim().toLowerCase();

  if (
    normalizedValue === "true" ||
    normalizedValue === "1" ||
    normalizedValue === "yes"
  ) {
    return true;
  }

  if (
    normalizedValue === "false" ||
    normalizedValue === "0" ||
    normalizedValue === "no"
  ) {
    return false;
  }

  return fallback;
}

function parsePositiveInteger(
  value: string | undefined,
  fallback: number
): number {
  const normalizedValue = Number(value);

  if (
    !Number.isInteger(normalizedValue) ||
    normalizedValue <= 0
  ) {
    return fallback;
  }

  return normalizedValue;
}

export function getDatabaseConfig():
DatabaseConfig | null {
  const connectionString =
    process.env.DATABASE_URL?.trim();

  if (!connectionString) {
    return null;
  }

  const productionDefault =
    process.env.NODE_ENV === "production";

  return {
    connectionString,

    ssl: parseBoolean(
      process.env.DATABASE_SSL,
      productionDefault
    ),

    rejectUnauthorized: parseBoolean(
      process.env
        .DATABASE_SSL_REJECT_UNAUTHORIZED,
      true
    ),

    maxConnections: parsePositiveInteger(
      process.env.DATABASE_POOL_MAX,
      DEFAULT_POOL_MAX
    ),

    idleTimeoutMs: parsePositiveInteger(
      process.env.DATABASE_IDLE_TIMEOUT_MS,
      DEFAULT_IDLE_TIMEOUT_MS
    ),

    connectionTimeoutMs:
      parsePositiveInteger(
        process.env
          .DATABASE_CONNECTION_TIMEOUT_MS,
        DEFAULT_CONNECTION_TIMEOUT_MS
      ),
  };
}

export function isDatabaseConfigured():
boolean {
  return getDatabaseConfig() !== null;
}

export function getDatabaseSchemaStatements():
readonly string[] {
  return [...DATABASE_SCHEMA_STATEMENTS];
}

function buildPoolConfig(
  config: DatabaseConfig
): PoolConfig {
  return {
    connectionString:
      config.connectionString,

    max:
      config.maxConnections,

    idleTimeoutMillis:
      config.idleTimeoutMs,

    connectionTimeoutMillis:
      config.connectionTimeoutMs,

    ssl: config.ssl
      ? {
          rejectUnauthorized:
            config.rejectUnauthorized,
        }
      : undefined,
  };
}

export function getDatabasePool(): Pool {
  const config = getDatabaseConfig();

  if (!config) {
    throw new Error(
      "DATABASE_URL is not configured."
    );
  }

  if (pool) {
    if (
      poolConnectionString !==
      config.connectionString
    ) {
      throw new Error(
        "DATABASE_URL changed after the database pool was created."
      );
    }

    return pool;
  }

  pool = new Pool(
    buildPoolConfig(config)
  );

  poolConnectionString =
    config.connectionString;

  pool.on(
    "error",
    (error: Error) => {
      console.error(
        "Unexpected PostgreSQL pool error:",
        error
      );
    }
  );

  return pool;
}

export async function withDatabaseClient<T>(
  operation: (
    client: PoolClient
  ) => Promise<T>
): Promise<T> {
  const databasePool =
    getDatabasePool();

  const client =
    await databasePool.connect();

  try {
    return await operation(client);
  }
  finally {
    client.release();
  }
}

export async function queryDatabase<
  T extends QueryResultRow =
    QueryResultRow
>(
  text: string,
  values: readonly unknown[] = []
): Promise<QueryResult<T>> {
  const databasePool =
    getDatabasePool();

  return databasePool.query<T>(
    text,
    [...values]
  );
}

export async function initializeDatabase():
Promise<void> {
  await withDatabaseClient(
    async (client) => {
      await client.query("BEGIN");

      try {
        for (
          const statement of
          DATABASE_SCHEMA_STATEMENTS
        ) {
          await client.query(statement);
        }

        await client.query("COMMIT");
      }
      catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  );
}

export async function checkDatabaseHealth():
Promise<DatabaseHealth> {
  if (!isDatabaseConfigured()) {
    return {
      configured: false,
      connected: false,
      latencyMs: null,
      message:
        "DATABASE_URL is not configured.",
    };
  }

  const startedAt = Date.now();

  try {
    await queryDatabase(
      "SELECT 1 AS database_health"
    );

    return {
      configured: true,
      connected: true,
      latencyMs:
        Date.now() - startedAt,
      message:
        "PostgreSQL connection is healthy.",
    };
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown PostgreSQL error.";

    return {
      configured: true,
      connected: false,
      latencyMs:
        Date.now() - startedAt,
      message,
    };
  }
}

export async function closeDatabase():
Promise<void> {
  if (!pool) {
    return;
  }

  const activePool = pool;

  pool = null;
  poolConnectionString = null;

  await activePool.end();
}
