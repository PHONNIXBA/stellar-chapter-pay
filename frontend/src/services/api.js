const DEFAULT_API_BASE_URL =
  import.meta.env.VITE_API_URL?.trim() ||
  "http://localhost:3001";

const DEFAULT_TIMEOUT_MS = 8000;

async function requestJson(
  path,
  {
    method = "GET",
    body,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {}
) {
  const controller = new AbortController();

  const timeoutId = window.setTimeout(
    () => controller.abort(),
    timeoutMs
  );

  try {
    const response = await fetch(
      `${DEFAULT_API_BASE_URL}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw new Error(
        `API request failed with status ${response.status}.`
      );
    }

    return response.json();
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export function fetchApiHealth() {
  return requestJson("/health");
}

export function fetchRuntimeConfig() {
  return requestJson("/api/config");
}

export function fetchContractFunctions() {
  return requestJson("/api/functions");
}

export function fetchInteractions() {
  return requestJson("/api/interactions");
}

export function recordInteraction(interaction) {
  return requestJson("/api/interactions", {
    method: "POST",
    body: interaction,
  });
}

export function fetchFeedback() {
  return requestJson("/api/feedback");
}

export function submitFeedback(feedback) {
  return requestJson("/api/feedback", {
    method: "POST",
    body: feedback,
  });
}

export function fetchAnalytics() {
  return requestJson("/api/analytics");
}

export function fetchProductReadiness() {
  return requestJson(
    "/api/product-readiness"
  );
}