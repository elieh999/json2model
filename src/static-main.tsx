import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@/app/globals.css";
import { ConverterApp } from "@/src/components/ConverterApp";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";

const root = document.getElementById("root");
if (!root) {
  throw new Error("JSON2Model could not find its application root.");
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <ConverterApp />
    </ErrorBoundary>
  </StrictMode>,
);
