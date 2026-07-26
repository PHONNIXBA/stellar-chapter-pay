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
  InteractionStatus,
  listFeedback,
  listInteractions,
} from "./services/dataService";

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

  return value as Record<
    string,
    unknown
  >;
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
  (
    request: Request,
    response: Response
  ) => {
    const interactions =
      listInteractions(
        parseLimit(
          request.query.limit
        )
      );

    response.json({
      count: interactions.length,
      interactions,
    });
  }
);

app.post(
  "/api/interactions",
  (
    request: Request,
    response: Response
  ) => {
    const body = request.body as
      Record<string, unknown>;

    const walletAddress =
      asNonEmptyString(
        body.walletAddress
      );

    const action =
      asNonEmptyString(body.action);

    const status =
      asNonEmptyString(body.status);

    const txHash =
      asNonEmptyString(body.txHash);

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

    const interaction =
      createInteraction({
        walletAddress,
        action,
        status,
        txHash:
          txHash || undefined,
        metadata:
          asMetadata(body.metadata),
      });

    response.status(201).json({
      interaction,
    });
  }
);

app.get(
  "/api/feedback",
  (
    request: Request,
    response: Response
  ) => {
    const feedback =
      listFeedback(
        parseLimit(
          request.query.limit
        )
      );

    response.json({
      count: feedback.length,
      feedback,
    });
  }
);

app.post(
  "/api/feedback",
  (
    request: Request,
    response: Response
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

    const feedback =
      createFeedback({
        walletAddress:
          walletAddress || undefined,
        rating,
        comment,
      });

    response.status(201).json({
      feedback,
    });
  }
);

app.get(
  "/api/analytics",
  (
    _request: Request,
    response: Response
  ) => {
    response.json(
      getAnalyticsSummary()
    );
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

if (
  process.env.NODE_ENV !== "test"
) {
  app.listen(
    port,
    () => {
      console.log(
        `Stellar Chapter Pay server listening on port ${port}.`
      );
    }
  );
}
