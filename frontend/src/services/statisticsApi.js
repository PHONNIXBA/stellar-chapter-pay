const DEFAULT_API_BASE_URL =
  "http://localhost:3001";

function getApiBaseUrl() {
  const configuredUrl =
    import.meta.env
      .VITE_API_BASE_URL;

  const apiBaseUrl =
    typeof configuredUrl ===
      "string" &&
    configuredUrl.trim()
      ? configuredUrl.trim()
      : DEFAULT_API_BASE_URL;

  return apiBaseUrl.replace(
    /\/+$/,
    ""
  );
}

async function readErrorMessage(
  response
) {
  try {
    const payload =
      await response.json();

    if (
      typeof payload?.error ===
        "string" &&
      payload.error.trim()
    ) {
      return payload.error.trim();
    }
  }
  catch {
    return (
      `Statistics request failed ` +
      `with status ${response.status}.`
    );
  }

  return (
    `Statistics request failed ` +
    `with status ${response.status}.`
  );
}

export async function fetchLevel5Statistics({
  signal,
} = {}) {
  const response = await fetch(
    `${getApiBaseUrl()}` +
      "/api/statistics/level-5",
    {
      method: "GET",

      headers: {
        Accept:
          "application/json",
      },

      signal,
    }
  );

  if (!response.ok) {
    const error =
      new Error(
        await readErrorMessage(
          response
        )
      );

    error.status =
      response.status;

    throw error;
  }

  const payload =
    await response.json();

  if (
    !payload ||
    typeof payload !== "object" ||
    !payload.stats
  ) {
    throw new Error(
      "The backend returned an invalid statistics response."
    );
  }

  return payload;
}
