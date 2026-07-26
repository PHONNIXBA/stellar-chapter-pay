import {
  StrictMode,
} from "react";

import {
  createRoot,
} from "react-dom/client";

import "./index.css";

import RootApplication from "./RootApplication.jsx";

const rootElement =
  document.getElementById("root");

if (!rootElement) {
  throw new Error(
    "The application root element was not found."
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <RootApplication />
  </StrictMode>
);
