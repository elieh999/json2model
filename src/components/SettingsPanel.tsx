import type { GeneratorOptions, TargetLanguage } from "@/src/generators/types";

interface Props {
  readonly language: TargetLanguage;
  readonly options: GeneratorOptions;
  readonly rememberInput: boolean;
  readonly onOptionsChange: (options: GeneratorOptions) => void;
  readonly onRememberInputChange: (remember: boolean) => void;
}

function Toggle({
  checked,
  label,
  onChange,
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span />
      </span>
    </label>
  );
}

export function SettingsPanel({
  language,
  options,
  rememberInput,
  onOptionsChange,
  onRememberInputChange,
}: Props) {
  const update = <Key extends keyof GeneratorOptions>(
    key: Key,
    value: GeneratorOptions[Key],
  ) => onOptionsChange({ ...options, [key]: value });

  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="settings-heading">
        <div>
          <p className="eyebrow">Generation</p>
          <h2 id="settings-title">Settings</h2>
        </div>
        <p>Changes update the model immediately.</p>
      </div>

      <div className="settings-grid">
        <label className="field">
          <span>Root model name</span>
          <input
            aria-label="Root model name"
            value={options.rootName}
            maxLength={80}
            onChange={(event) => update("rootName", event.target.value)}
          />
        </label>

        <label className="field">
          <span>Unknown values</span>
          <select
            aria-label="Unknown value strategy"
            value={options.unknownType}
            onChange={(event) =>
              update(
                "unknownType",
                event.target.value === "dynamic" ? "dynamic" : "safe",
              )
            }
          >
            <option value="safe">
              {language === "dart"
                ? "Object?"
                : language === "typescript"
                  ? "unknown"
                  : "object"}
            </option>
            <option value="dynamic">
              {language === "typescript" ? "any" : "Dynamic type"}
            </option>
          </select>
        </label>

        <Toggle
          checked={options.detectDates}
          label="Detect dates"
          onChange={(checked) => update("detectDates", checked)}
        />
        <Toggle
          checked={options.preservePropertyOrder}
          label="Preserve JSON field order"
          onChange={(checked) => update("preservePropertyOrder", checked)}
        />
        <Toggle
          checked={options.includeComments}
          label="Include comments"
          onChange={(checked) => update("includeComments", checked)}
        />

        {language === "dart" ? (
          <>
            <Toggle
              checked={options.dart.includeFromJson}
              label="Include fromJson"
              onChange={(checked) =>
                update("dart", {
                  ...options.dart,
                  includeFromJson: checked,
                })
              }
            />
            <Toggle
              checked={options.dart.includeToJson}
              label="Include toJson"
              onChange={(checked) =>
                update("dart", { ...options.dart, includeToJson: checked })
              }
            />
            <Toggle
              checked={options.dart.constConstructors}
              label="Use const constructors"
              onChange={(checked) =>
                update("dart", {
                  ...options.dart,
                  constConstructors: checked,
                })
              }
            />
          </>
        ) : null}

        {language === "typescript" ? (
          <>
            {/*
              Dart and Python always convert names because they carry the
              original key in `fromJson` and in a Pydantic alias. Only a
              TypeScript declaration has to choose, so the toggle lives here.
            */}
            <Toggle
              checked={options.convertPropertyNames}
              label="Convert keys to camelCase"
              onChange={(checked) => update("convertPropertyNames", checked)}
            />
            <label className="field">
              <span>Declaration style</span>
              <select
                aria-label="TypeScript declaration style"
                value={options.typescript.declarationMode}
                onChange={(event) =>
                  update("typescript", {
                    ...options.typescript,
                    declarationMode:
                      event.target.value === "type" ? "type" : "interface",
                  })
                }
              >
                <option value="interface">Interfaces</option>
                <option value="type">Type aliases</option>
              </select>
            </label>
            <Toggle
              checked={options.typescript.semicolons}
              label="Use semicolons"
              onChange={(checked) =>
                update("typescript", {
                  ...options.typescript,
                  semicolons: checked,
                })
              }
            />
            <Toggle
              checked={options.typescript.readonlyProperties}
              label="Readonly properties"
              onChange={(checked) =>
                update("typescript", {
                  ...options.typescript,
                  readonlyProperties: checked,
                })
              }
            />
            <Toggle
              checked={options.typescript.exportDeclarations}
              label="Export declarations"
              onChange={(checked) =>
                update("typescript", {
                  ...options.typescript,
                  exportDeclarations: checked,
                })
              }
            />
          </>
        ) : null}

        {language === "python" ? (
          <>
            <Toggle
              checked={options.python.modernUnions}
              label="Use modern unions"
              onChange={(checked) =>
                update("python", {
                  ...options.python,
                  modernUnions: checked,
                })
              }
            />
            <Toggle
              checked={options.python.useAliases}
              label="Use Pydantic aliases"
              onChange={(checked) =>
                update("python", {
                  ...options.python,
                  useAliases: checked,
                })
              }
            />
            <Toggle
              checked={options.python.populateByName}
              label="Allow population by name"
              onChange={(checked) =>
                update("python", {
                  ...options.python,
                  populateByName: checked,
                })
              }
            />
            <Toggle
              checked={options.python.includeExample}
              label="Include parsing example"
              onChange={(checked) =>
                update("python", {
                  ...options.python,
                  includeExample: checked,
                })
              }
            />
          </>
        ) : null}

        <Toggle
          checked={rememberInput}
          label="Remember input on this device"
          onChange={onRememberInputChange}
        />
      </div>
    </section>
  );
}
