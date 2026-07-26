import {
  timingSafeEqual,
} from "node:crypto";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

export const ADMIN_API_KEY_HEADER =
  "x-admin-api-key";

export function getAdminApiKey():
string | null {
  return (
    process.env.ADMIN_API_KEY
      ?.trim() || null
  );
}

export function securelyMatchesApiKey(
  expectedValue: string,
  providedValue: string
): boolean {
  const expectedBuffer =
    Buffer.from(
      expectedValue,
      "utf8"
    );

  const providedBuffer =
    Buffer.from(
      providedValue,
      "utf8"
    );

  if (
    expectedBuffer.length !==
    providedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    expectedBuffer,
    providedBuffer
  );
}

export function requireAdminApiKey(
  request: Request,
  response: Response,
  next: NextFunction
): void {
  const configuredApiKey =
    getAdminApiKey();

  if (!configuredApiKey) {
    response.status(503).json({
      error:
        "The admin API service is not configured.",
    });

    return;
  }

  const providedApiKey =
    request
      .get(
        ADMIN_API_KEY_HEADER
      )
      ?.trim();

  if (
    !providedApiKey ||
    !securelyMatchesApiKey(
      configuredApiKey,
      providedApiKey
    )
  ) {
    response.status(401).json({
      error:
        "A valid admin API key is required.",
    });

    return;
  }

  next();
}
