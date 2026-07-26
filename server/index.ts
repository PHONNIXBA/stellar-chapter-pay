import "dotenv/config";

import {
  timingSafeEqual,
} from "node:crypto";

import cors from "cors";

import express, {
  NextFunction,
  Request,
  Response,
} from "express";

import {
  getContractFunctions,
  getProductReadiness,
  getRuntimeConfig,
} from "./services/contractService";

import {
  createFeedback,
  createInteraction,
  getAnalyticsSummary,
  type InteractionStatus,
  listFeedback,
  listInteractions,
} from "./services/dataService";

import {
  initializeDatabase,
  isDatabaseConfigured,
} from "./services/databaseService";

import {
  getLevel5Statistics,
} from "./services/statisticsService";

import {
  createLevel5Csv,
  createLevel5ExportFilename,
} from "./services/exportService";

import {
  getUserByWallet,
  isValidEmail,
  isValidUserName,
  isValidWalletAddress,
  listUsers,
  registerUser,
} from "./services/userService";

export const app = express();

const port = Number(
  process.env.PORT || 3001
);

app.disable("x-powered-by");

app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN?.trim() ||
      "*",
  })
);

app.use(
  express.json({
    limit: "128kb",
  })
);

function asNonEmptyString(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalizedValue =
    value.trim();

  return normalizedValue || null;
}

function parseLimit(
  value: unknown
): number {
  const normalizedValue =
    Number(value);

  if (
    !Number.isInteger(normalizedValue) ||
    normalizedValue <= 0
  ) {
    return 50;
  }

  return Math.min(
    normalizedValue,
    200
  );
}

function isInteractionStatus(
  value: string
): value is InteractionStatus {
  return [
    "pending",
    "success",
    "failed",
  ].includes(value);
}

function asMetadata(
  value: unknown
): Record<string, unknown> | undefined {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    return undefined;
  }

  return value as
    Record<string, unknown>;
}

function getExportApiKey():
string | null {
  return (
    process.env.EXPORT_API_KEY
      ?.trim() || null
  );
}

function securelyMatches(
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

app.get(
  "/health",
  (
    _request: Request,
    response: Response
  ) => {
    response.json({
      status: "ok",

      service:
        "stellar-chapter-pay-server",

      storage:
        isDatabaseConfigured()
          ? "postgresql"
          : "memory",

      timestamp:
        new Date().toISOString(),
    });
  }
);

app.get(
  "/api/config",
  (
    _request: Request,
    response: Response
  ) => {
    response.json(
      getRuntimeConfig()
    );
  }
);

app.get(
  "/api/functions",
  (
    _request: Request,
    response: Response
  ) => {
    const functions =
      getContractFunctions();

    response.json({
      count: functions.length,
      functions,
    });
  }
);

app.post(
  "/api/users",
  async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    const body = request.body as
      Record<string, unknown>;

    const name =
      asNonEmptyString(body.name);

    const email =
      asNonEmptyString(body.email);

    const walletAddress =
      asNonEmptyString(
        body.walletAddress
      );

    if (
      !name ||
      !email ||
      !walletAddress
    ) {
      response.status(400).json({
        error:
          "name, email, and walletAddress are required.",
      });

      return;
    }

    if (!isValidUserName(name)) {
      response.status(400).json({
        error:
          "Name must contain between 2 and 120 characters.",
      });

      return;
    }

    if (!isValidEmail(email)) {
      response.status(400).json({
        error:
          "A valid email address is required.",
      });

      return;
    }

    if (
      !isValidWalletAddress(
        walletAddress
      )
    ) {
      response.status(400).json({
        error:
          "A valid Stellar wallet address is required.",
      });

      return;
    }

    try {
      const user =
        await registerUser({
          name,
          email,
          walletAddress,
        });

      response.status(201).json({
        user,
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/users",
  async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const users =
        await listUsers(
          parseLimit(
            request.query.limit
          )
        );

      response.json({
        count: users.length,
        users,
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/users/:walletAddress",
  async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    const walletAddress =
      asNonEmptyString(
        request.params.walletAddress
      );

    if (
      !walletAddress ||
      !isValidWalletAddress(
        walletAddress
      )
    ) {
      response.status(400).json({
        error:
          "A valid Stellar wallet address is required.",
      });

      return;
    }

    try {
      const user =
        await getUserByWallet(
          walletAddress
        );

      if (!user) {
        response.status(404).json({
          error:
            "User was not found.",
        });

        return;
      }

      response.json({
        user,
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/interactions",
  async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const interactions =
        await listInteractions(
          parseLimit(
            request.query.limit
          )
        );

      response.json({
        count:
          interactions.length,

        interactions,
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/interactions",
  async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    const body = request.body as
      Record<string, unknown>;

    const walletAddress =
      asNonEmptyString(
        body.walletAddress
      );

    const action =
      asNonEmptyString(
        body.action
      );

    const status =
      asNonEmptyString(
        body.status
      );

    const txHash =
      asNonEmptyString(
        body.txHash
      );

    const contractFunction =
      asNonEmptyString(
        body.contractFunction
      );

    const network =
      asNonEmptyString(
        body.network
      );

    if (
      !walletAddress ||
      !action ||
      !status ||
      !isInteractionStatus(status)
    ) {
      response.status(400).json({
        error:
          "walletAddress, action, and a valid status are required.",
      });

      return;
    }

    try {
      const interaction =
        await createInteraction({
          walletAddress,
          action,
          status,

          txHash:
            txHash || undefined,

          contractFunction:
            contractFunction ||
            undefined,

          network:
            network || undefined,

          metadata:
            asMetadata(
              body.metadata
            ),
        });

      response.status(201).json({
        interaction,
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/feedback",
  async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const feedback =
        await listFeedback(
          parseLimit(
            request.query.limit
          )
        );

      response.json({
        count: feedback.length,
        feedback,
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.post(
  "/api/feedback",
  async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    const body = request.body as
      Record<string, unknown>;

    const walletAddress =
      asNonEmptyString(
        body.walletAddress
      );

    const comment =
      asNonEmptyString(
        body.comment
      );

    const improvementCategory =
      asNonEmptyString(
        body.improvementCategory
      );

    const rating =
      Number(body.rating);

    if (
      !comment ||
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      response.status(400).json({
        error:
          "comment and an integer rating from 1 to 5 are required.",
      });

      return;
    }

    try {
      const feedback =
        await createFeedback({
          walletAddress:
            walletAddress ||
            undefined,

          rating,
          comment,

          improvementCategory:
            improvementCategory ||
            undefined,
        });

      response.status(201).json({
        feedback,
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/analytics",
  async (
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      response.json(
        await getAnalyticsSummary()
      );
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/statistics/level-5",
  async (
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const stats =
        await getLevel5Statistics();

      response.json({
        stats,
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/exports/level-5.csv",
  async (
    request: Request,
    response: Response,
    next: NextFunction
  ) => {
    const configuredApiKey =
      getExportApiKey();

    if (!configuredApiKey) {
      response.status(503).json({
        error:
          "The Level 5 export service is not configured.",
      });

      return;
    }

    const providedApiKey =
      request
        .get("x-export-api-key")
        ?.trim();

    if (
      !providedApiKey ||
      !securelyMatches(
        configuredApiKey,
        providedApiKey
      )
    ) {
      response.status(401).json({
        error:
          "A valid export API key is required.",
      });

      return;
    }

    try {
      const csv =
        await createLevel5Csv();

      const filename =
        createLevel5ExportFilename();

      response.setHeader(
        "Content-Type",
        "text/csv; charset=utf-8"
      );

      response.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );

      response.setHeader(
        "Cache-Control",
        "no-store, max-age=0"
      );

      response.setHeader(
        "Pragma",
        "no-cache"
      );

      response.setHeader(
        "X-Content-Type-Options",
        "nosniff"
      );

      response.status(200).send(csv);
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/product-readiness",
  (
    _request: Request,
    response: Response
  ) => {
    response.json(
      getProductReadiness()
    );
  }
);

app.use(
  (
    request: Request,
    response: Response
  ) => {
    response.status(404).json({
      error: "Route not found.",
      path: request.path,
    });
  }
);

app.use(
  (
    error: Error,
    _request: Request,
    response: Response,
    _next: NextFunction
  ) => {
    console.error(
      "Backend request error:",
      error
    );

    response.status(500).json({
      error:
        "The server could not complete the request.",
    });
  }
);

async function startServer():
Promise<void> {
  if (
    process.env.NODE_ENV ===
      "production" &&
    !isDatabaseConfigured()
  ) {
    throw new Error(
      "DATABASE_URL is required in production."
    );
  }

  if (isDatabaseConfigured()) {
    await initializeDatabase();

    console.log(
      "PostgreSQL schema initialized."
    );
  }

  app.listen(
    port,
    () => {
      console.log(
        `Stellar Chapter Pay server listening on port ${port}.`
      );
    }
  );
}

if (
  process.env.NODE_ENV !== "test"
) {
  void startServer().catch(
    (error: unknown) => {
      console.error(
        "Backend startup failed:",
        error
      );

      process.exitCode = 1;
    }
  );
}
