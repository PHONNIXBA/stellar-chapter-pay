import {
  useEffect,
  useState,
} from "react";

import "./Level5Dashboard.css";

import Level5Stats from "./Level5Stats";

import {
  fetchLevel5Statistics,
} from "../services/statisticsApi";

function Level5Dashboard() {
  const [
    statistics,
    setStatistics,
  ] = useState(null);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    const controller =
      new AbortController();

    async function loadInitialStatistics() {
      try {
        const result =
          await fetchLevel5Statistics({
            signal:
              controller.signal,
          });

        if (
          controller.signal.aborted
        ) {
          return;
        }

        setStatistics(result);
      }
      catch (requestError) {
        if (
          controller.signal.aborted
        ) {
          return;
        }

        setError(
          requestError instanceof Error
            ? requestError.message
            : "Level 5 statistics could not be loaded."
        );
      }
      finally {
        if (
          !controller.signal.aborted
        ) {
          setIsLoading(false);
        }
      }
    }

    void loadInitialStatistics();

    return () => {
      controller.abort();
    };
  }, []);

  async function handleRefresh() {
    setIsLoading(true);
    setError("");

    try {
      const result =
        await fetchLevel5Statistics();

      setStatistics(result);
    }
    catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Level 5 statistics could not be loaded."
      );
    }
    finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="level5-dashboard">
      <div className="level5-dashboard-toolbar">
        <p>
          Statistics are loaded from the
          Chapter Pay backend.
        </p>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => {
            void handleRefresh();
          }}
        >
          {isLoading
            ? "Loading..."
            : "Refresh evidence"}
        </button>
      </div>

      <Level5Stats
        stats={statistics}
        isLoading={isLoading}
        error={error}
      />
    </div>
  );
}

export default Level5Dashboard;
