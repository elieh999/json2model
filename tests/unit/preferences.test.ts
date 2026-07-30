import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_GENERATOR_OPTIONS } from "@/src/generators/types";
import {
  DEFAULT_PREFERENCES,
  persistRememberedInput,
  readPreferences,
  readRememberedInput,
  STORAGE_KEYS,
} from "@/src/hooks/useStoredPreferences";

function store(value: unknown): void {
  window.localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(value));
}

describe("readPreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns the defaults when nothing is stored", () => {
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("keeps values that are valid", () => {
    store({
      language: "python",
      theme: "dark",
      rememberInput: true,
      options: {
        rootName: "ApiResponse",
        detectDates: true,
        unknownType: "dynamic",
        python: { includeExample: true },
      },
    });
    const preferences = readPreferences();
    expect(preferences.language).toBe("python");
    expect(preferences.theme).toBe("dark");
    expect(preferences.rememberInput).toBe(true);
    expect(preferences.options.rootName).toBe("ApiResponse");
    expect(preferences.options.detectDates).toBe(true);
    expect(preferences.options.unknownType).toBe("dynamic");
    expect(preferences.options.python.includeExample).toBe(true);
    // Anything absent falls back rather than becoming undefined.
    expect(preferences.options.python.modernUnions).toBe(
      DEFAULT_GENERATOR_OPTIONS.python.modernUnions,
    );
  });

  it("replaces values of the wrong type instead of passing them through", () => {
    // A stored value of the wrong type used to reach the generators directly and
    // could break the page on load.
    store({
      language: 7,
      theme: "neon",
      rememberInput: "yes",
      options: {
        rootName: 42,
        detectDates: "true",
        unknownType: "<script>",
        dart: { includeFromJson: 0 },
        typescript: { declarationMode: "enum" },
        python: { modernUnions: null },
      },
    });
    const preferences = readPreferences();
    expect(preferences.language).toBe(DEFAULT_PREFERENCES.language);
    expect(preferences.theme).toBe("system");
    expect(preferences.rememberInput).toBe(false);
    expect(preferences.options.rootName).toBe(
      DEFAULT_GENERATOR_OPTIONS.rootName,
    );
    expect(preferences.options.detectDates).toBe(false);
    expect(preferences.options.unknownType).toBe("safe");
    expect(preferences.options.dart.includeFromJson).toBe(true);
    expect(preferences.options.typescript.declarationMode).toBe("interface");
    expect(preferences.options.python.modernUnions).toBe(true);
  });

  it("survives a stored value that is not JSON, an array, or an object", () => {
    window.localStorage.setItem(STORAGE_KEYS.preferences, "not json{");
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);

    store([1, 2, 3]);
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);

    store("string");
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
  });

  it("ignores an unusually long root name", () => {
    store({ options: { rootName: "A".repeat(500) } });
    expect(readPreferences().options.rootName).toBe(
      DEFAULT_GENERATOR_OPTIONS.rootName,
    );
  });

  it("falls back when storage itself throws", () => {
    const getItem = vi
      .spyOn(window.localStorage, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });
    expect(readPreferences()).toEqual(DEFAULT_PREFERENCES);
    getItem.mockRestore();
  });
});

describe("remembered input", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("is not stored unless the setting is enabled", () => {
    persistRememberedInput('{"a":1}', false);
    expect(window.localStorage.getItem(STORAGE_KEYS.input)).toBeNull();
  });

  it("is stored and read back once enabled", () => {
    persistRememberedInput('{"a":1}', true);
    expect(window.localStorage.getItem(STORAGE_KEYS.input)).toBe('{"a":1}');
    expect(
      readRememberedInput({ ...DEFAULT_PREFERENCES, rememberInput: true }),
    ).toBe('{"a":1}');
  });

  it("is ignored when the setting is off, even if a value is left behind", () => {
    window.localStorage.setItem(STORAGE_KEYS.input, '{"stale":true}');
    expect(readRememberedInput(DEFAULT_PREFERENCES)).toBe("");
  });

  it("is removed when the setting is turned off", () => {
    persistRememberedInput('{"a":1}', true);
    persistRememberedInput('{"a":1}', false);
    expect(window.localStorage.getItem(STORAGE_KEYS.input)).toBeNull();
  });

  it("does not throw when storage is unavailable", () => {
    const setItem = vi
      .spyOn(window.localStorage, "setItem")
      .mockImplementation(() => {
        throw new Error("quota exceeded");
      });
    expect(() => persistRememberedInput('{"a":1}', true)).not.toThrow();
    setItem.mockRestore();
  });
});
