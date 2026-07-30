"use client";

import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { generateModels } from "@/src/generators/generate";
import type {
  GenerationResult,
  GeneratorOptions,
  TargetLanguage,
} from "@/src/generators/types";
import {
  persistRememberedInput,
  readRememberedInput,
  useStoredPreferences,
  type Preferences,
  type ThemePreference,
} from "@/src/hooks/useStoredPreferences";
import { toPascalCase } from "@/src/naming/naming";
import { parseJson } from "@/src/parser/jsonParser";
import { inferSchema } from "@/src/schema/infer";
import type { JsonErrorDetails } from "@/src/schema/types";
import { Json2ModelError } from "@/src/schema/types";
import { copyText } from "@/src/utilities/clipboard";
import { EXAMPLE_JSON } from "@/src/utilities/examples";
import { SettingsPanel } from "./SettingsPanel";
import { SyntaxCode } from "./SyntaxCode";

type ConversionState =
  | { readonly status: "empty" }
  | { readonly status: "invalid"; readonly error: JsonErrorDetails }
  | { readonly status: "failed"; readonly message: string }
  | { readonly status: "ready"; readonly generation: GenerationResult };

const LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  dart: "Dart",
  typescript: "TypeScript",
  python: "Python",
};

function convert(
  source: string,
  language: TargetLanguage,
  options: GeneratorOptions,
): ConversionState {
  if (!source.trim()) {
    return { status: "empty" };
  }

  try {
    const parsed = parseJson(source);
    if (!parsed.ok) {
      return { status: "invalid", error: parsed.error };
    }
    const inferred = inferSchema(parsed.parsed.value, {
      detectDates: options.detectDates,
      preservePropertyOrder: options.preservePropertyOrder,
    });
    return {
      status: "ready",
      generation: generateModels(language, inferred.schema, options, [
        ...parsed.parsed.warnings,
        ...inferred.warnings,
      ]),
    };
  } catch (error: unknown) {
    return {
      status: "failed",
      message:
        error instanceof Json2ModelError
          ? error.message
          : "The model generator could not process this structure. Your JSON remains in this browser.",
    };
  }
}

function safeDownloadName(rootName: string, extension: string): string {
  const base = toPascalCase(rootName, "RootModel")
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 80);
  return `${base || "RootModel"}.${extension}`;
}

function ThemeControl({
  theme,
  onChange,
}: {
  readonly theme: ThemePreference;
  readonly onChange: (theme: ThemePreference) => void;
}) {
  return (
    <div className="theme-control" aria-label="Color theme">
      {(["system", "light", "dark"] as const).map((option) => (
        <button
          aria-pressed={theme === option}
          className={theme === option ? "active" : ""}
          key={option}
          onClick={() => onChange(option)}
          type="button"
        >
          {option.charAt(0).toUpperCase() + option.slice(1)}
        </button>
      ))}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  title,
  primary = false,
}: {
  readonly children: React.ReactNode;
  readonly onClick: () => void;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly primary?: boolean;
}) {
  return (
    <button
      className={primary ? "action-button primary" : "action-button"}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type="button"
    >
      {children}
    </button>
  );
}

export function ConverterApp() {
  const { preferences, setPreferences, hydrated } = useStoredPreferences();
  const [input, setInput] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const deferredInput = useDeferredValue(input);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputTouched = useRef(false);

  const updateInput = useCallback((value: string) => {
    inputTouched.current = true;
    setInput(value);
  }, []);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const timer = window.setTimeout(() => {
      if (!inputTouched.current) {
        setInput(readRememberedInput(preferences));
      }
    }, 0);
    return () => window.clearTimeout(timer);
    // Preferences are read once after client hydration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  useEffect(() => {
    document.documentElement.dataset.theme = preferences.theme;
  }, [preferences.theme]);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const timer = window.setTimeout(
      () => persistRememberedInput(input, preferences.rememberInput),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [hydrated, input, preferences.rememberInput]);

  useEffect(
    () => () => {
      if (noticeTimer.current) {
        clearTimeout(noticeTimer.current);
      }
    },
    [],
  );

  const conversion = useMemo(
    () => convert(deferredInput, preferences.language, preferences.options),
    [deferredInput, preferences.language, preferences.options],
  );

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(null), 2200);
  }, []);

  const updatePreferences = useCallback(
    (update: Partial<Preferences>) => {
      startTransition(() => {
        setPreferences((current) => ({ ...current, ...update }));
      });
    },
    [setPreferences],
  );

  const formatInput = useCallback(() => {
    const parsed = parseJson(input);
    if (!parsed.ok) {
      showNotice(parsed.error.message);
      return;
    }
    setInput(JSON.stringify(parsed.parsed.value, null, 2));
    showNotice("JSON formatted");
  }, [input, showNotice]);

  const minifyInput = useCallback(() => {
    const parsed = parseJson(input);
    if (!parsed.ok) {
      showNotice(parsed.error.message);
      return;
    }
    setInput(JSON.stringify(parsed.parsed.value));
    showNotice("JSON minified");
  }, [input, showNotice]);

  const handleCopy = useCallback(
    async (value: string, label: string) => {
      try {
        await copyText(value);
        showNotice(`${label} copied`);
      } catch {
        showNotice(
          "Clipboard permission was denied. Select the text and copy it manually.",
        );
      }
    },
    [showNotice],
  );

  const downloadOutput = useCallback(() => {
    if (conversion.status !== "ready") {
      return;
    }
    try {
      const blob = new Blob([conversion.generation.code], {
        type: "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = safeDownloadName(
        preferences.options.rootName,
        conversion.generation.extension,
      );
      link.click();
      URL.revokeObjectURL(url);
      showNotice("Download started");
    } catch {
      showNotice("The code file could not be downloaded.");
    }
  }, [conversion, preferences.options.rootName, showNotice]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        formatInput();
      }
      if (event.shiftKey && event.key.toLocaleLowerCase("en-US") === "c") {
        if (conversion.status === "ready") {
          event.preventDefault();
          void handleCopy(conversion.generation.code, "Generated code");
        }
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [conversion, formatInput, handleCopy]);

  const lineCount =
    conversion.status === "ready"
      ? conversion.generation.code.trimEnd().split("\n").length
      : 0;

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <span>{"{"}</span>
            <i />
            <span>{"}"}</span>
          </div>
          <div>
            <div className="brand-title">
              <span>JSON2Model</span>
              <span className="local-badge">Local only</span>
            </div>
            <p>Clean models from real JSON, directly in your browser.</p>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className={`settings-button ${settingsOpen ? "active" : ""}`}
            aria-expanded={settingsOpen}
            aria-controls="settings-region"
            onClick={() => setSettingsOpen((open) => !open)}
            type="button"
          >
            Settings
          </button>
          <ThemeControl
            theme={preferences.theme}
            onChange={(theme) => updatePreferences({ theme })}
          />
        </div>
      </header>

      <section className="privacy-strip" aria-label="Privacy information">
        <span className="privacy-dot" aria-hidden="true" />
        <strong>Your JSON stays in your browser.</strong>
        <span>Nothing is uploaded.</span>
        <span className="privacy-detail">
          No account, backend, analytics, or AI API.
        </span>
      </section>

      <nav className="language-tabs" aria-label="Target language">
        {(Object.keys(LANGUAGE_LABELS) as TargetLanguage[]).map((language) => (
          <button
            aria-current={
              preferences.language === language ? "page" : undefined
            }
            className={preferences.language === language ? "active" : ""}
            key={language}
            onClick={() => updatePreferences({ language })}
            type="button"
          >
            <span>{LANGUAGE_LABELS[language]}</span>
            <small>
              {language === "dart"
                ? "Null safe"
                : language === "typescript"
                  ? "Strict types"
                  : "Pydantic 2"}
            </small>
          </button>
        ))}
      </nav>

      <div
        className={`settings-region ${settingsOpen ? "open" : ""}`}
        id="settings-region"
      >
        {settingsOpen ? (
          <SettingsPanel
            language={preferences.language}
            options={preferences.options}
            rememberInput={preferences.rememberInput}
            onOptionsChange={(options) => updatePreferences({ options })}
            onRememberInputChange={(rememberInput) =>
              updatePreferences({ rememberInput })
            }
          />
        ) : null}
      </div>

      <section className="workspace" aria-label="JSON conversion workspace">
        <InputPanel
          conversion={conversion}
          input={input}
          onInputChange={updateInput}
          onFormat={formatInput}
          onMinify={minifyInput}
          onCopy={() => void handleCopy(input, "Input")}
          onNotice={showNotice}
        />
        <OutputPanel
          conversion={conversion}
          language={preferences.language}
          lineCount={lineCount}
          onCopy={(code) => void handleCopy(code, "Generated code")}
          onDownload={downloadOutput}
        />
      </section>

      <footer>
        <span>All parsing and generation run on this device.</span>
        <span>Input limit 2,000,000 characters · Depth limit 80</span>
      </footer>

      <div
        className={`toast ${notice ? "visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </main>
  );
}

function InputPanel({
  conversion,
  input,
  onInputChange,
  onFormat,
  onMinify,
  onCopy,
  onNotice,
}: {
  readonly conversion: ConversionState;
  readonly input: string;
  readonly onInputChange: (input: string) => void;
  readonly onFormat: () => void;
  readonly onMinify: () => void;
  readonly onCopy: () => void;
  readonly onNotice: (notice: string) => void;
}) {
  return (
    <article className="editor-panel input-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-index">01</span>
          <div>
            <h2>JSON input</h2>
            <p>{input.length.toLocaleString()} characters</p>
          </div>
        </div>
        <div className="panel-actions">
          <ActionButton
            onClick={() => {
              onInputChange(EXAMPLE_JSON);
              onNotice("Example loaded");
            }}
          >
            Example
          </ActionButton>
          <ActionButton
            disabled={!input}
            onClick={onFormat}
            title="Format JSON (Ctrl or Command + Enter)"
          >
            Format
          </ActionButton>
          <ActionButton disabled={!input} onClick={onMinify}>
            Minify
          </ActionButton>
          <ActionButton disabled={!input} onClick={onCopy}>
            Copy
          </ActionButton>
          <ActionButton
            disabled={!input}
            onClick={() => {
              onInputChange("");
              onNotice("Input cleared");
            }}
          >
            Clear
          </ActionButton>
        </div>
      </div>

      <div className="input-editor">
        <label htmlFor="json-input" className="sr-only">
          Paste JSON
        </label>
        <textarea
          id="json-input"
          data-testid="json-input"
          placeholder={'Paste JSON here\n\n{\n  "id": 1,\n  "name": "Ada"\n}'}
          spellCheck={false}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          aria-invalid={conversion.status === "invalid"}
          aria-describedby={
            conversion.status === "invalid" ? "input-error" : undefined
          }
        />
      </div>

      {conversion.status === "invalid" ? (
        <div className="status-message error" id="input-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Current input is invalid</strong>
            <p>{conversion.error.message}</p>
          </div>
        </div>
      ) : null}
      {conversion.status === "failed" ? (
        <div className="status-message error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <strong>Input limit reached</strong>
            <p>{conversion.message}</p>
          </div>
        </div>
      ) : null}
    </article>
  );
}

function OutputPanel({
  conversion,
  language,
  lineCount,
  onCopy,
  onDownload,
}: {
  readonly conversion: ConversionState;
  readonly language: TargetLanguage;
  readonly lineCount: number;
  readonly onCopy: (code: string) => void;
  readonly onDownload: () => void;
}) {
  return (
    <article className="editor-panel output-panel">
      <div className="panel-heading">
        <div>
          <span className="panel-index accent">02</span>
          <div>
            <h2>{LANGUAGE_LABELS[language]} output</h2>
            <p>
              {conversion.status === "ready"
                ? `${lineCount} lines · ${conversion.generation.modelCount} model${conversion.generation.modelCount === 1 ? "" : "s"}`
                : "Waiting for valid JSON"}
            </p>
          </div>
        </div>
        <div className="panel-actions">
          <ActionButton
            primary
            disabled={conversion.status !== "ready"}
            onClick={() => {
              if (conversion.status === "ready") {
                onCopy(conversion.generation.code);
              }
            }}
            title="Copy output (Ctrl or Command + Shift + C)"
          >
            Copy code
          </ActionButton>
          <ActionButton
            disabled={conversion.status !== "ready"}
            onClick={onDownload}
          >
            Download
          </ActionButton>
        </div>
      </div>

      <div className="output-editor" aria-live="polite">
        {conversion.status === "ready" ? (
          <SyntaxCode code={conversion.generation.code} language={language} />
        ) : (
          <div className="empty-state">
            <div className="empty-glyph" aria-hidden="true">
              <span>{"{"}</span>
              <i />
              <span>{"}"}</span>
            </div>
            <h3>
              {conversion.status === "invalid"
                ? "Fix the JSON to regenerate"
                : "Your model will appear here"}
            </h3>
            <p>
              Paste JSON or load the example. Generation happens locally as you
              type.
            </p>
          </div>
        )}
      </div>

      {conversion.status === "ready" &&
      conversion.generation.warnings.length > 0 ? (
        <details className="warnings" open>
          <summary>
            {conversion.generation.warnings.length} inference warning
            {conversion.generation.warnings.length === 1 ? "" : "s"}
          </summary>
          <ul>
            {conversion.generation.warnings.map((warning, index) => (
              <li key={`${warning.code}-${warning.path}-${index}`}>
                {warning.message}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </article>
  );
}
