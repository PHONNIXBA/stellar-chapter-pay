const DEFAULT_API_BASE_URL =
  import.meta.env
    .VITE_API_BASE_URL
    ?.trim() ||
  "http://localhost:3001";

const DEFAULT_TIMEOUT_MS = 8000;

function normalizeBaseUrl(value) {
  return value.replace(
    /\/+$/,
    ""
  );
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

async function readResponsePayload(
  response
) {
  if (response.status === 204) {
    return null;
  }

  const contentType =
    response.headers
      ?.get?.("content-type") ||
    "";

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

  const error =
    new Error(message);

  error.status =
    response.status;

  return error;
}

export function getApiBaseUrl() {
  return normalizeBaseUrl(
    DEFAULT_API_BASE_URL
  );
}



export async function requestJson(
  path,
  {
    method = "GET",
    body,
    headers = {},
    timeoutMs =
      DEFAULT_TIMEOUT_MS,

    fetchImplementation =
      globalThis.fetch,

    signal,
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

  const timeoutController =
    new AbortController();

  const timeoutId =
    globalThis.setTimeout(
      () =>
        timeoutController.abort(),
      timeoutMs
    );

  const abortRequest = () => {
    timeoutController.abort();
  };

  if (signal) {
    if (signal.aborted) {
      timeoutController.abort();
    }
    else {
      signal.addEventListener(
        "abort",
        abortRequest,
        {
          once: true,
        }
      );
    }
  }

  try {
    const requestHeaders = {
      Accept:
        "application/json",

      ...headers,
    };

    if (body !== undefined) {
      requestHeaders[
        "Content-Type"
      ] = "application/json";
    }

    const response =
      await fetchImplementation(
        `${getApiBaseUrl()}${path}`,
        {
          method,

          headers:
            requestHeaders,

          body:
            body === undefined
              ? undefined
              : JSON.stringify(
                  body
                ),

          signal:
            timeoutController
              .signal,
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
      error.name ===
        "AbortError"
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

    if (signal) {
      signal.removeEventListener(
        "abort",
        abortRequest
      );
    }
  }
}
export function fetchApiHealth(
  options = {}
) {
  return requestJson(
    "/health",
    options
  );
}

export function fetchRuntimeConfig(
  options = {}
) {
  return requestJson(
    "/api/config",
    options
  );
}

export function fetchContractFunctions(
  options = {}
) {
  return requestJson(
    "/api/functions",
    options
  );
}

export function registerUser({
  walletAddress,
}) {
  return requestJson(
    "/api/users",
    {
      method: "POST",

      body: {
        walletAddress:
          normalizeRequiredString(
            walletAddress,
            "Wallet address"
          ).toUpperCase(),
      },
    }
  );
}

export function fetchUserByWallet(
  walletAddress,
  options = {}
) {
  const normalizedWallet =
    normalizeRequiredString(
      walletAddress,
      "Wallet address"
    ).toUpperCase();

  return requestJson(
    `/api/users/${encodeURIComponent(
      normalizedWallet
    )}`,
    options
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

export function fetchAnalytics(
  options = {}
) {
  return requestJson(
    "/api/analytics",
    options
  );
}

export function fetchProductReadiness(
  options = {}
) {
  return requestJson(
    "/api/product-readiness",
    options
  );
}

export function fetchPublicEvidence(
  options = {}
) {
  return requestJson(
    "/api/evidence",
    options
  );
}
