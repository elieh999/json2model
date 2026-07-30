"use client";

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

function mergePreferences(value: unknown): Preferences {
  if (!isRecord(value)) {
    return DEFAULT_PREFERENCES;
  }
  const options = isRecord(value.options) ? value.options : {};
  const dart = isRecord(options.dart) ? options.dart : {};
  const typescript = isRecord(options.typescript) ? options.typescript : {};
  const python = isRecord(options.python) ? options.python : {};

  return {
    language:
      value.language === "typescript" || value.language === "python"
        ? value.language
        : "dart",
    theme:
      value.theme === "light" || value.theme === "dark"
        ? value.theme
        : "system",
    rememberInput: value.rememberInput === true,
    options: {
      ...DEFAULT_GENERATOR_OPTIONS,
      ...options,
      dart: { ...DEFAULT_GENERATOR_OPTIONS.dart, ...dart },
      typescript: {
        ...DEFAULT_GENERATOR_OPTIONS.typescript,
        ...typescript,
      },
      python: { ...DEFAULT_GENERATOR_OPTIONS.python, ...python },
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
