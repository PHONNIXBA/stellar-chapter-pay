import { randomUUID } from "node:crypto";

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
  name: string;
  email: string;
  walletAddress: string;
}

export interface UserRecord
  extends UserInput {
  id: string;
  onboardingStatus:
    OnboardingStatus;
  onboardingCompleted: boolean;
  joinedAt: string;
  lastActiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DatabaseUserRow
  extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  wallet_address: string;
  onboarding_status:
    OnboardingStatus;
  onboarding_completed: boolean;
  joined_at: Date | string;
  last_active_at:
    | Date
    | string
    | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const usersByWallet =
  new Map<string, UserRecord>();

function normalizeWalletAddress(
  walletAddress: string
): string {
  return walletAddress
    .trim()
    .toUpperCase();
}

function normalizeEmail(
  email: string
): string {
  return email
    .trim()
    .toLowerCase();
}

function normalizeName(
  name: string
): string {
  return name
    .trim()
    .replace(/\s+/g, " ");
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
    name: row.name,
    email: row.email,

    walletAddress:
      row.wallet_address,

    onboardingStatus:
      row.onboarding_status,

    onboardingCompleted:
      row.onboarding_completed,

    joinedAt:
      toIsoString(row.joined_at),

    lastActiveAt:
      row.last_active_at
        ? toIsoString(
            row.last_active_at
          )
        : null,

    createdAt:
      toIsoString(row.created_at),

    updatedAt:
      toIsoString(row.updated_at),
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

export function isValidUserName(
  name: string
): boolean {
  const normalizedName =
    normalizeName(name);

  return (
    normalizedName.length >= 2 &&
    normalizedName.length <= 120
  );
}

export function isValidEmail(
  email: string
): boolean {
  const normalizedEmail =
    normalizeEmail(email);

  return (
    normalizedEmail.length <= 320 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(normalizedEmail)
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

function validateUserInput(
  input: UserInput
): UserInput {
  const normalizedInput = {
    name:
      normalizeName(input.name),

    email:
      normalizeEmail(input.email),

    walletAddress:
      normalizeWalletAddress(
        input.walletAddress
      ),
  };

  if (
    !isValidUserName(
      normalizedInput.name
    )
  ) {
    throw new Error(
      "Name must contain between 2 and 120 characters."
    );
  }

  if (
    !isValidEmail(
      normalizedInput.email
    )
  ) {
    throw new Error(
      "A valid email address is required."
    );
  }

  if (
    !isValidWalletAddress(
      normalizedInput.walletAddress
    )
  ) {
    throw new Error(
      "A valid Stellar wallet address is required."
    );
  }

  return normalizedInput;
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
    const updatedUser = {
      ...existingUser,
      name: input.name,
      email: input.email,
      updatedAt: now,
    };

    usersByWallet.set(
      input.walletAddress,
      updatedUser
    );

    return cloneUser(
      updatedUser
    );
  }

  const user: UserRecord = {
    id: randomUUID(),
    ...input,

    onboardingStatus:
      "registered",

    onboardingCompleted:
      false,

    joinedAt: now,
    lastActiveAt: null,
    createdAt: now,
    updatedAt: now,
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
    await queryDatabase<DatabaseUserRow>(
      `
        INSERT INTO users (
          id,
          name,
          email,
          wallet_address
        )
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (wallet_address)
        DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          updated_at = NOW()
        RETURNING
          id,
          name,
          email,
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
        normalizedInput.name,
        normalizedInput.email,
        normalizedInput.walletAddress,
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
    await queryDatabase<DatabaseUserRow>(
      `
        SELECT
          id,
          name,
          email,
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

  if (result.rows.length === 0) {
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
        (first, second) =>
          second.joinedAt.localeCompare(
            first.joinedAt
          )
      )
      .slice(0, safeLimit)
      .map(cloneUser);
  }

  const result =
    await queryDatabase<DatabaseUserRow>(
      `
        SELECT
          id,
          name,
          email,
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
