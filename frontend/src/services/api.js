const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.trim() ||
  "http://localhost:3001";

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "");
}

function normalizeRequiredString(
  value,
  fieldName
) {
  if (typeof value !== "string") {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  const normalizedValue =
    value.trim();

  if (!normalizedValue) {
    throw new Error(
      `${fieldName} is required.`
    );
  }

  return normalizedValue;
}

function normalizeListLimit(limit) {
  const normalizedLimit =
    Number(limit);

  if (
    !Number.isInteger(normalizedLimit) ||
    normalizedLimit <= 0
  ) {
    return DEFAULT_LIST_LIMIT;
  }

  return Math.min(
    normalizedLimit,
    MAX_LIST_LIMIT
  );
}

async function readResponsePayload(
  response
) {
  if (response.status === 204) {
    return null;
  }

  const contentType =
    response.headers
      ?.get?.("content-type") || "";

  if (
    contentType.includes(
      "application/json"
    )
  ) {
    return response.json();
  }

  const responseText =
    await response.text();

  if (!responseText) {
    return null;
  }

  return {
    message: responseText,
  };
}

function createApiError(
  response,
  payload
) {
  const message =
    payload?.error ||
    payload?.message ||
    `API request failed with status ${response.status}.`;

  const error = new Error(message);

  error.status = response.status;

  return error;
}

export async function requestJson(
  path,
  {
    method = "GET",
    body,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
    fetchImplementation =
      globalThis.fetch,
  } = {}
) {
  if (
    typeof fetchImplementation !==
    "function"
  ) {
    throw new Error(
      "A fetch implementation is required."
    );
  }

  const controller =
    new AbortController();

  const timeoutId =
    globalThis.setTimeout(
      () => controller.abort(),
      timeoutMs
    );

  try {
    const requestHeaders = {
      Accept: "application/json",
      ...headers,
    };

    if (body !== undefined) {
      requestHeaders[
        "Content-Type"
      ] = "application/json";
    }

    const response =
      await fetchImplementation(
        `${normalizeBaseUrl(
          DEFAULT_API_BASE_URL
        )}${path}`,
        {
          method,
          headers: requestHeaders,

          body:
            body === undefined
              ? undefined
              : JSON.stringify(body),

          signal: controller.signal,
        }
      );

    const payload =
      await readResponsePayload(
        response
      );

    if (!response.ok) {
      throw createApiError(
        response,
        payload
      );
    }

    return payload;
  }
  catch (error) {
    if (
      error instanceof Error &&
      error.name === "AbortError"
    ) {
      throw new Error(
        "The backend request timed out.",
        {
          cause: error,
        }
      );
    }

    throw error;
  }
  finally {
    globalThis.clearTimeout(
      timeoutId
    );
  }
}

export function fetchApiHealth() {
  return requestJson("/health");
}

export function fetchRuntimeConfig() {
  return requestJson("/api/config");
}

export function fetchContractFunctions() {
  return requestJson(
    "/api/functions"
  );
}

export function registerUser({
  name,
  email,
  walletAddress,
}) {
  return requestJson("/api/users", {
    method: "POST",

    body: {
      name:
        normalizeRequiredString(
          name,
          "Name"
        ),

      email:
        normalizeRequiredString(
          email,
          "Email"
        ).toLowerCase(),

      walletAddress:
        normalizeRequiredString(
          walletAddress,
          "Wallet address"
        ).toUpperCase(),
    },
  });
}

export function fetchUsers(
  limit = DEFAULT_LIST_LIMIT
) {
  const safeLimit =
    normalizeListLimit(limit);

  return requestJson(
    `/api/users?limit=${safeLimit}`
  );
}

export function fetchUserByWallet(
  walletAddress
) {
  const normalizedWallet =
    normalizeRequiredString(
      walletAddress,
      "Wallet address"
    ).toUpperCase();

  return requestJson(
    `/api/users/${encodeURIComponent(
      normalizedWallet
    )}`
  );
}

export function fetchInteractions(
  limit = DEFAULT_LIST_LIMIT
) {
  const safeLimit =
    normalizeListLimit(limit);

  return requestJson(
    `/api/interactions?limit=${safeLimit}`
  );
}

export function recordInteraction(
  interaction
) {
  return requestJson(
    "/api/interactions",
    {
      method: "POST",
      body: interaction,
    }
  );
}

export function fetchFeedback(
  limit = DEFAULT_LIST_LIMIT
) {
  const safeLimit =
    normalizeListLimit(limit);

  return requestJson(
    `/api/feedback?limit=${safeLimit}`
  );
}

export function submitFeedback(
  feedback
) {
  return requestJson(
    "/api/feedback",
    {
      method: "POST",
      body: feedback,
    }
  );
}

export function fetchAnalytics() {
  return requestJson(
    "/api/analytics"
  );
}

export function fetchProductReadiness() {
  return requestJson(
    "/api/product-readiness"
  );
}
