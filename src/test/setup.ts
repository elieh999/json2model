import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";

/**
 * jsdom implements neither the async clipboard nor blob URLs. Both are defined
 * here so tests can spy on them, and so a missing implementation shows up as a
 * failed assertion rather than a confusing type error.
 */
if (!navigator.clipboard) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: () => Promise.resolve(),
      readText: () => Promise.resolve(""),
    },
  });
}

if (!URL.createObjectURL) {
  URL.createObjectURL = () => "blob:json2model-test";
  URL.revokeObjectURL = () => undefined;
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
