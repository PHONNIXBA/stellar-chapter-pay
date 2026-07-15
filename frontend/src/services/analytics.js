import {
  CACHE_KEYS,
  loadCache,
  saveCache,
} from "../utils/cache";

const MAX_LOCAL_EVENTS = 100;

export function readLocalAnalyticsEvents() {
  const cachedEvents = loadCache(
    CACHE_KEYS.analyticsEvents,
    "[]"
  );

  try {
    const parsedEvents =
      JSON.parse(cachedEvents);

    return Array.isArray(parsedEvents)
      ? parsedEvents
      : [];
  } catch {
    return [];
  }
}

export function trackAnalyticsEvent(
  eventName,
  properties = {}
) {
  if (!eventName) {
    return null;
  }

  const event = {
    id:
      globalThis.crypto?.randomUUID?.() ||
      `${Date.now()}-${Math.random()}`,
    name: eventName,
    properties,
    timestamp:
      new Date().toISOString(),
  };

  const currentEvents =
    readLocalAnalyticsEvents();

  const updatedEvents = [
    event,
    ...currentEvents,
  ].slice(0, MAX_LOCAL_EVENTS);

  saveCache(
    CACHE_KEYS.analyticsEvents,
    JSON.stringify(updatedEvents)
  );

  return event;
}

export function getAnalyticsSummary() {
  const events =
    readLocalAnalyticsEvents();

  const eventCounts = events.reduce(
    (summary, event) => {
      summary[event.name] =
        (summary[event.name] || 0) + 1;

      return summary;
    },
    {}
  );

  return {
    totalEvents: events.length,
    eventCounts,
    latestEvent: events[0] || null,
  };
}