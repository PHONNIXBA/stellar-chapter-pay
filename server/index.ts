import "dotenv/config";

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
  isInteractionStatus,
  isValidContractId,
} from "./services/dataService";

import {
  initializeDatabase,
  isDatabaseConfigured,
} from "./services/databaseService";

import {
  buildPublicEvidence,
} from "./services/exportService";

import {
  getLevel5Statistics,
} from "./services/statisticsService";

import {
  getUserByWallet,
  isValidWalletAddress,
  registerUser,
} from "./services/userService";

export const app = express();

const port = Number(
  process.env.PORT || 3001
);

function getAllowedOrigins():
string[] {
  const configuredOrigins =
    process.env.CORS_ORIGIN
      ?.trim();

  if (
    !configuredOrigins ||
    configuredOrigins === "*"
  ) {
    return [];
  }

  return configuredOrigins
    .split(",")
    .map(
      (origin) =>
        origin.trim()
    )
    .filter(Boolean);
}

const allowedOrigins =
  getAllowedOrigins();

app.disable("x-powered-by");

app.use(
  cors({
    origin: (
      origin,
      callback
    ) => {
      if (
        !origin ||
        allowedOrigins.length === 0 ||
        allowedOrigins.includes(
          origin
        )
      ) {
        callback(null, true);
        return;
      }

      callback(
        new Error(
          "Origin is not allowed by CORS."
        )
      );
    },

    methods: [
      "GET",
      "POST",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Accept",
      "Content-Type",
    ],

    maxAge: 86_400,
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

function sendValidationError(
  response: Response,
  message: string
): void {
  response.status(400).json({
    error: message,
  });
}

function setPublicEvidenceHeaders(
  response: Response
): void {
  response.setHeader(
    "Cache-Control",
    "public, max-age=60, stale-while-revalidate=300"
  );

  response.setHeader(
    "X-Content-Type-Options",
    "nosniff"
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

      privacyModel:
        "wallet-only",

      publicEvidence:
        "/api/evidence",

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

    const walletAddress =
      asNonEmptyString(
        body.walletAddress
      );

    if (
      !walletAddress ||
      !isValidWalletAddress(
        walletAddress
      )
    ) {
      sendValidationError(
        response,
        "A valid Stellar wallet address is required."
      );

      return;
    }

    try {
      const user =
        await registerUser({
          walletAddress,
        });

      response.status(201).json({
        user: {
          walletAddress:
            user.walletAddress,

          onboardingStatus:
            user.onboardingStatus,

          onboardingCompleted:
            user.onboardingCompleted,
        },
      });
    }
    catch (error) {
      next(error);
    }
  }
);

app.get(
  "/api/users",
  (
    _request: Request,
    response: Response
  ) => {
    response.redirect(
      308,
      "/api/evidence"
    );
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
      sendValidationError(
        response,
        "A valid Stellar wallet address is required."
      );

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
        user: {
          walletAddress:
            user.walletAddress,

          onboardingStatus:
            user.onboardingStatus,

          onboardingCompleted:
            user.onboardingCompleted,
        },
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

    const contractId =
      asNonEmptyString(
        body.contractId
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
      !isValidWalletAddress(
        walletAddress
      )
    ) {
      sendValidationError(
        response,
        "A valid Stellar wallet address is required."
      );

      return;
    }

    if (!action) {
      sendValidationError(
        response,
        "action is required."
      );

      return;
    }

    if (
      !status ||
      !isInteractionStatus(status)
    ) {
      sendValidationError(
        response,
        "A valid interaction status is required."
      );

      return;
    }

    if (
      contractId &&
      !isValidContractId(
        contractId
      )
    ) {
      sendValidationError(
        response,
        "A valid Stellar contract ID is required."
      );

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

          contractId:
            contractId || undefined,

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
      !walletAddress ||
      !isValidWalletAddress(
        walletAddress
      )
    ) {
      sendValidationError(
        response,
        "A valid Stellar wallet address is required."
      );

      return;
    }

    if (!comment) {
      sendValidationError(
        response,
        "comment is required."
      );

      return;
    }

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      sendValidationError(
        response,
        "rating must be an integer from 1 to 5."
      );

      return;
    }

    try {
      const feedback =
        await createFeedback({
          walletAddress,
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
  "/api/evidence",
  async (
    _request: Request,
    response: Response,
    next: NextFunction
  ) => {
    try {
      const evidence =
        await buildPublicEvidence();

      setPublicEvidenceHeaders(
        response
      );

      response.json(evidence);
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
    if (
      error.message ===
      "Origin is not allowed by CORS."
    ) {
      response.status(403).json({
        error: error.message,
      });

      return;
    }

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
      "PostgreSQL wallet-only schema initialized."
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
