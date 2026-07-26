import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  checkDatabaseHealth,
  getDatabaseConfig,
  getDatabaseSchemaStatements,
  isDatabaseConfigured,
} from "./databaseService";

const ORIGINAL_DATABASE_ENV = {
  DATABASE_URL:
    process.env.DATABASE_URL,

  DATABASE_SSL:
    process.env.DATABASE_SSL,

  DATABASE_SSL_REJECT_UNAUTHORIZED:
    process.env
      .DATABASE_SSL_REJECT_UNAUTHORIZED,

  DATABASE_POOL_MAX:
    process.env.DATABASE_POOL_MAX,

  DATABASE_IDLE_TIMEOUT_MS:
    process.env
      .DATABASE_IDLE_TIMEOUT_MS,

  DATABASE_CONNECTION_TIMEOUT_MS:
    process.env
      .DATABASE_CONNECTION_TIMEOUT_MS,
};

function restoreEnvironmentVariable(
  name: keyof typeof ORIGINAL_DATABASE_ENV
): void {
  const originalValue =
    ORIGINAL_DATABASE_ENV[name];

  if (originalValue === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] =
    originalValue;
}

afterEach(() => {
  for (
    const name of
    Object.keys(
      ORIGINAL_DATABASE_ENV
    ) as Array<
      keyof typeof ORIGINAL_DATABASE_ENV
    >
  ) {
    restoreEnvironmentVariable(name);
  }
});

describe(
  "database configuration",
  () => {
    it(
      "reports an unconfigured database without connecting",
      async () => {
        delete process.env.DATABASE_URL;

        expect(
          getDatabaseConfig()
        ).toBeNull();

        expect(
          isDatabaseConfigured()
        ).toBe(false);

        const health =
          await checkDatabaseHealth();

        expect(
          health.configured
        ).toBe(false);

        expect(
          health.connected
        ).toBe(false);

        expect(
          health.latencyMs
        ).toBeNull();
      }
    );

    it(
      "normalizes PostgreSQL pool configuration",
      () => {
        process.env.DATABASE_URL =
          "postgresql://user:password@localhost:5432/chapter_pay";

        process.env.DATABASE_SSL =
          "true";

        process.env
          .DATABASE_SSL_REJECT_UNAUTHORIZED =
          "false";

        process.env.DATABASE_POOL_MAX =
          "15";

        process.env
          .DATABASE_IDLE_TIMEOUT_MS =
          "45000";

        process.env
          .DATABASE_CONNECTION_TIMEOUT_MS =
          "8000";

        expect(
          getDatabaseConfig()
        ).toEqual({
          connectionString:
            "postgresql://user:password@localhost:5432/chapter_pay",

          ssl: true,

          rejectUnauthorized:
            false,

          maxConnections: 15,

          idleTimeoutMs: 45000,

          connectionTimeoutMs:
            8000,
        });
      }
    );
  }
);

describe(
  "database schema",
  () => {
    it(
      "contains Level 5 user activity tables",
      () => {
        const schema =
          getDatabaseSchemaStatements()
            .join("\n")
            .toLowerCase();

        expect(schema).toContain(
          "create table if not exists users"
        );

        expect(schema).toContain(
          "create table if not exists interactions"
        );

        expect(schema).toContain(
          "create table if not exists feedback"
        );

        expect(schema).toContain(
          "wallet_address"
        );

        expect(schema).toContain(
          "tx_hash"
        );

        expect(schema).toContain(
          "onboarding_status"
        );

        expect(schema).toContain(
          "rating >= 1"
        );
      }
    );
  }
);
