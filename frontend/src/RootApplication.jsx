import {
  lazy,
  Suspense,
} from "react";

import App from "./App.jsx";

const EvidencePage = lazy(
  () =>
    import(
      "./components/EvidencePage.jsx"
    )
);

function normalizePathname(
  pathname
) {
  const normalizedPath =
    String(pathname || "/")
      .replace(/\/+$/, "");

  return normalizedPath || "/";
}

function EvidenceLoadingState() {
  return (
    <main
      aria-busy="true"
      aria-live="polite"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
        color: "#9dafca",
        background: "#050d1b",
        boxSizing: "border-box",
      }}
    >
      Loading public evidence...
    </main>
  );
}

function RootApplication() {
  const pathname =
    normalizePathname(
      window.location.pathname
    );

  if (
    pathname === "/evidence"
  ) {
    return (
      <Suspense
        fallback={
          <EvidenceLoadingState />
        }
      >
        <EvidencePage />
      </Suspense>
    );
  }

  return <App />;
}

export default RootApplication;
