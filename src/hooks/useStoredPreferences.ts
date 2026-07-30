import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_GENERATOR_OPTIONS,
  type GeneratorOptions,
  type TargetLanguage,
} from "@/src/generators/types";

export type ThemePreference = "system" | "light" | "dark";

export interface Preferences {
  readonly language: TargetLanguage;
  readonly theme: ThemePreference;
  readonly rememberInput: boolean;
  readonly options: GeneratorOptions;
}

const PREFERENCES_KEY = "json2model.preferences.v1";
const INPUT_KEY = "json2model.input.v1";

export const DEFAULT_PREFERENCES: Preferences = {
  language: "dart",
  theme: "system",
  rememberInput: false,
  options: DEFAULT_GENERATOR_OPTIONS,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function oneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && allowed.includes(value)
    ? value
    : fallback;
}

/**
 * Rebuilds preferences from whatever local storage holds.
 *
 * Every field is checked individually rather than spread in. Stored values can
 * be edited or left behind by an older version, and a value of the wrong type
 * reaching the generators would break the page on load.
 */
function mergePreferences(value: unknown): Preferences {
  if (!isRecord(value)) {
    return DEFAULT_PREFERENCES;
  }
  const stored = isRecord(value.options) ? value.options : {};
  const dart = isRecord(stored.dart) ? stored.dart : {};
  const typescript = isRecord(stored.typescript) ? stored.typescript : {};
  const python = isRecord(stored.python) ? stored.python : {};
  const defaults = DEFAULT_GENERATOR_OPTIONS;

  return {
    language: oneOf(
      value.language,
      ["dart", "typescript", "python"] as const,
      DEFAULT_PREFERENCES.language,
    ),
    theme: oneOf(value.theme, ["system", "light", "dark"] as const, "system"),
    rememberInput: value.rememberInput === true,
    options: {
      rootName:
        typeof stored.rootName === "string" && stored.rootName.length <= 80
          ? stored.rootName
          : defaults.rootName,
      detectDates: boolean(stored.detectDates, defaults.detectDates),
      convertPropertyNames: boolean(
        stored.convertPropertyNames,
        defaults.convertPropertyNames,
      ),
      preservePropertyOrder: boolean(
        stored.preservePropertyOrder,
        defaults.preservePropertyOrder,
      ),
      includeComments: boolean(
        stored.includeComments,
        defaults.includeComments,
      ),
      unknownType: oneOf(
        stored.unknownType,
        ["safe", "dynamic"] as const,
        defaults.unknownType,
      ),
      dart: {
        includeFromJson: boolean(
          dart.includeFromJson,
          defaults.dart.includeFromJson,
        ),
        includeToJson: boolean(dart.includeToJson, defaults.dart.includeToJson),
        constConstructors: boolean(
          dart.constConstructors,
          defaults.dart.constConstructors,
        ),
      },
      typescript: {
        declarationMode: oneOf(
          typescript.declarationMode,
          ["interface", "type"] as const,
          defaults.typescript.declarationMode,
        ),
        semicolons: boolean(
          typescript.semicolons,
          defaults.typescript.semicolons,
        ),
        readonlyProperties: boolean(
          typescript.readonlyProperties,
          defaults.typescript.readonlyProperties,
        ),
        exportDeclarations: boolean(
          typescript.exportDeclarations,
          defaults.typescript.exportDeclarations,
        ),
      },
      python: {
        modernUnions: boolean(
          python.modernUnions,
          defaults.python.modernUnions,
        ),
        useAliases: boolean(python.useAliases, defaults.python.useAliases),
        populateByName: boolean(
          python.populateByName,
          defaults.python.populateByName,
        ),
        includeExample: boolean(
          python.includeExample,
          defaults.python.includeExample,
        ),
      },
    },
  };
}

export function readPreferences(): Preferences {
  try {
    const stored = window.localStorage.getItem(PREFERENCES_KEY);
    return stored
      ? mergePreferences(JSON.parse(stored) as unknown)
      : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function readRememberedInput(preferences: Preferences): string {
  if (!preferences.rememberInput) {
    return "";
  }
  try {
    return window.localStorage.getItem(INPUT_KEY) ?? "";
  } catch {
    return "";
  }
}

export function useStoredPreferences(): {
  readonly preferences: Preferences;
  readonly setPreferences: React.Dispatch<React.SetStateAction<Preferences>>;
  readonly hydrated: boolean;
} {
  const [preferences, setPreferences] =
    useState<Preferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);
  const preferencesTouched = useRef(false);
  const updatePreferences = useCallback<
    React.Dispatch<React.SetStateAction<Preferences>>
  >((update) => {
    preferencesTouched.current = true;
    setPreferences(update);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!preferencesTouched.current) {
        setPreferences(readPreferences());
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    try {
      window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      if (!preferences.rememberInput) {
        window.localStorage.removeItem(INPUT_KEY);
      }
    } catch {
      // Preferences are a convenience. The converter works without storage.
    }
  }, [hydrated, preferences]);

  return { preferences, setPreferences: updatePreferences, hydrated };
}

export function persistRememberedInput(
  input: string,
  rememberInput: boolean,
): void {
  try {
    if (rememberInput) {
      window.localStorage.setItem(INPUT_KEY, input);
    } else {
      window.localStorage.removeItem(INPUT_KEY);
    }
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

export const STORAGE_KEYS = {
  preferences: PREFERENCES_KEY,
  input: INPUT_KEY,
} as const;
