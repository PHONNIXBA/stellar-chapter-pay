import {
  randomUUID,
} from "node:crypto";

import type {
  QueryResultRow,
} from "pg";

import {
  isDatabaseConfigured,
  queryDatabase,
} from "./databaseService";

export type OnboardingStatus =
  | "registered"
  | "wallet_connected"
  | "funded"
  | "active";

export interface UserInput {
  walletAddress: string;
}

export interface UserRecord
  extends UserInput {
  id: string;

  onboardingStatus:
    OnboardingStatus;

  onboardingCompleted: boolean;

  joinedAt: string;

  lastActiveAt:
    string | null;

  createdAt: string;

  updatedAt: string;
}

interface DatabaseUserRow
  extends QueryResultRow {
  id: string;

  wallet_address: string;

  onboarding_status:
    OnboardingStatus;

  onboarding_completed: boolean;

  joined_at:
    Date | string;

  last_active_at:
    | Date
    | string
    | null;

  created_at:
    Date | string;

  updated_at:
    Date | string;
}

const usersByWallet =
  new Map<
    string,
    UserRecord
  >();

function normalizeWalletAddress(
  walletAddress: string
): string {
  return walletAddress
    .trim()
    .toUpperCase();
}

function toIsoString(
  value: Date | string
): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return new Date(value)
    .toISOString();
}

function cloneUser(
  user: UserRecord
): UserRecord {
  return {
    ...user,
  };
}

function mapDatabaseUser(
  row: DatabaseUserRow
): UserRecord {
  return {
    id: row.id,

    walletAddress:
      row.wallet_address,

    onboardingStatus:
      row.onboarding_status,

    onboardingCompleted:
      row.onboarding_completed,

    joinedAt:
      toIsoString(
        row.joined_at
      ),

    lastActiveAt:
      row.last_active_at
        ? toIsoString(
            row.last_active_at
          )
        : null,

    createdAt:
      toIsoString(
        row.created_at
      ),

    updatedAt:
      toIsoString(
        row.updated_at
      ),
  };
}

function normalizeLimit(
  limit: number,
  maximum = 200
): number {
  if (
    !Number.isInteger(limit) ||
    limit <= 0
  ) {
    return 50;
  }

  return Math.min(
    limit,
    maximum
  );
}

export function isValidWalletAddress(
  walletAddress: string
): boolean {
  return /^G[A-Z2-7]{55}$/.test(
    normalizeWalletAddress(
      walletAddress
    )
  );
}

export function isValidOnboardingStatus(
  status: string
): status is OnboardingStatus {
  return [
    "registered",
    "wallet_connected",
    "funded",
    "active",
  ].includes(status);
}

function validateUserInput(
  input: UserInput
): UserInput {
  const walletAddress =
    normalizeWalletAddress(
      input.walletAddress
    );

  if (
    !isValidWalletAddress(
      walletAddress
    )
  ) {
    throw new Error(
      "A valid Stellar wallet address is required."
    );
  }

  return {
    walletAddress,
  };
}
function registerMemoryUser(
  input: UserInput
): UserRecord {
  const existingUser =
    usersByWallet.get(
      input.walletAddress
    );

  const now =
    new Date().toISOString();

  if (existingUser) {
    const updatedUser:
    UserRecord = {
      ...existingUser,

      onboardingStatus:
        existingUser
          .onboardingStatus ===
          "registered"
          ? "wallet_connected"
          : existingUser
              .onboardingStatus,

      onboardingCompleted:
        true,

      updatedAt:
        now,
    };

    usersByWallet.set(
      input.walletAddress,
      updatedUser
    );

    return cloneUser(
      updatedUser
    );
  }

  const user:
  UserRecord = {
    id: randomUUID(),

    walletAddress:
      input.walletAddress,

    onboardingStatus:
      "wallet_connected",

    onboardingCompleted:
      true,

    joinedAt:
      now,

    lastActiveAt:
      null,

    createdAt:
      now,

    updatedAt:
      now,
  };

  usersByWallet.set(
    input.walletAddress,
    user
  );

  return cloneUser(user);
}

export async function registerUser(
  input: UserInput
): Promise<UserRecord> {
  const normalizedInput =
    validateUserInput(input);

  if (!isDatabaseConfigured()) {
    return registerMemoryUser(
      normalizedInput
    );
  }

  const result =
    await queryDatabase<
      DatabaseUserRow
    >(
      `
        INSERT INTO users (
          id,
          wallet_address,
          onboarding_status,
          onboarding_completed
        )
        VALUES (
          $1,
          $2,
          'wallet_connected',
          TRUE
        )
        ON CONFLICT (
          wallet_address
        )
        DO UPDATE SET
          onboarding_status =
            CASE
              WHEN
                users.onboarding_status =
                'registered'
              THEN
                'wallet_connected'
              ELSE
                users.onboarding_status
            END,
          onboarding_completed = TRUE,
          updated_at = NOW()
        RETURNING
          id,
          wallet_address,
          onboarding_status,
          onboarding_completed,
          joined_at,
          last_active_at,
          created_at,
          updated_at
      `,
      [
        randomUUID(),

        normalizedInput
          .walletAddress,
      ]
    );

  return mapDatabaseUser(
    result.rows[0]
  );
}

export async function getUserByWallet(
  walletAddress: string
): Promise<UserRecord | null> {
  const normalizedWallet =
    normalizeWalletAddress(
      walletAddress
    );

  if (
    !isValidWalletAddress(
      normalizedWallet
    )
  ) {
    return null;
  }

  if (!isDatabaseConfigured()) {
    const user =
      usersByWallet.get(
        normalizedWallet
      );

    return user
      ? cloneUser(user)
      : null;
  }

  const result =
    await queryDatabase<
      DatabaseUserRow
    >(
      `
        SELECT
          id,
          wallet_address,
          onboarding_status,
          onboarding_completed,
          joined_at,
          last_active_at,
          created_at,
          updated_at
        FROM users
        WHERE wallet_address = $1
        LIMIT 1
      `,
      [normalizedWallet]
    );

  if (
    result.rows.length === 0
  ) {
    return null;
  }

  return mapDatabaseUser(
    result.rows[0]
  );
}
export async function markUserActivity(
  walletAddress: string,

  onboardingStatus:
    OnboardingStatus = "active"
): Promise<UserRecord | null> {
  const normalizedWallet =
    normalizeWalletAddress(
      walletAddress
    );

  if (
    !isValidWalletAddress(
      normalizedWallet
    )
  ) {
    throw new Error(
      "A valid Stellar wallet address is required."
    );
  }

  if (
    !isValidOnboardingStatus(
      onboardingStatus
    )
  ) {
    throw new Error(
      "A valid onboarding status is required."
    );
  }

  if (!isDatabaseConfigured()) {
    const existingUser =
      usersByWallet.get(
        normalizedWallet
      );

    if (!existingUser) {
      return null;
    }

    const now =
      new Date().toISOString();

    const onboardingCompleted =
      existingUser
        .onboardingCompleted ||
      onboardingStatus ===
        "wallet_connected" ||
      onboardingStatus ===
        "funded" ||
      onboardingStatus ===
        "active";

    const updatedUser:
    UserRecord = {
      ...existingUser,

      onboardingStatus,

      onboardingCompleted,

      lastActiveAt:
        now,

      updatedAt:
        now,
    };

    usersByWallet.set(
      normalizedWallet,
      updatedUser
    );

    return cloneUser(
      updatedUser
    );
  }

  const result =
    await queryDatabase<
      DatabaseUserRow
    >(
      `
        UPDATE users
        SET
          onboarding_status = $2,

          onboarding_completed =
            CASE
              WHEN $2 IN (
                'wallet_connected',
                'funded',
                'active'
              )
              THEN TRUE
              ELSE onboarding_completed
            END,

          last_active_at = NOW(),

          updated_at = NOW()
        WHERE wallet_address = $1
        RETURNING
          id,
          wallet_address,
          onboarding_status,
          onboarding_completed,
          joined_at,
          last_active_at,
          created_at,
          updated_at
      `,
      [
        normalizedWallet,
        onboardingStatus,
      ]
    );

  if (
    result.rows.length === 0
  ) {
    return null;
  }

  return mapDatabaseUser(
    result.rows[0]
  );
}

export async function listUsers(
  limit = 50
): Promise<UserRecord[]> {
  const safeLimit =
    normalizeLimit(limit);

  if (!isDatabaseConfigured()) {
    return Array.from(
      usersByWallet.values()
    )
      .sort(
        (
          first,
          second
        ) =>
          second.joinedAt
            .localeCompare(
              first.joinedAt
            )
      )
      .slice(
        0,
        safeLimit
      )
      .map(cloneUser);
  }

  const result =
    await queryDatabase<
      DatabaseUserRow
    >(
      `
        SELECT
          id,
          wallet_address,
          onboarding_status,
          onboarding_completed,
          joined_at,
          last_active_at,
          created_at,
          updated_at
        FROM users
        ORDER BY joined_at DESC
        LIMIT $1
      `,
      [safeLimit]
    );

  return result.rows.map(
    mapDatabaseUser
  );
}

export function clearUsersForTests():
void {
  usersByWallet.clear();
}
