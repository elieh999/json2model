import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "release/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "tests/generated/**",
      "docs/screenshots/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    languageOptions: {
      globals: { ...globals.browser },
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...react.configs.flat.recommended.rules,
      ...react.configs.flat["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/switch-exhaustiveness-check": "error",
      "no-console": ["error", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
      // The compiler's `noFallthroughCasesInSwitch` covers this and understands
      // that a case whose body always returns cannot fall through. The base rule
      // does not, and would demand unreachable `break` statements.
      "no-fallthrough": "off",
    },
  },
  {
    // Node scripts and configuration files run outside the browser.
    files: [
      "scripts/**/*.ts",
      "*.config.ts",
      "*.config.mjs",
      "tests/browser/**/*.ts",
    ],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      "no-console": "off",
    },
  },
  {
    // Plain JavaScript files are outside the TypeScript project, so type aware
    // rules and the project service are switched off for them.
    files: ["**/*.cjs", "**/*.mjs"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { projectService: false, project: false },
    },
    rules: {
      ...tseslint.configs.disableTypeChecked.rules,
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      // Test helpers routinely assert on values the compiler cannot narrow.
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
);
