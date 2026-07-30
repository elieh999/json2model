/**
 * Writes generated models for every fixture so the real language toolchains can
 * check them.
 *
 * Comparing generated strings only proves the generator did not change. Running
 * `tsc`, Ruff, Pydantic and the Dart analyzer over the output proves it is valid,
 * and the round trip files prove the serialization actually works.
 *
 * Run with `npm run fixtures:generate`.
 */
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateModels } from "../src/generators/generate";
import {
  DEFAULT_GENERATOR_OPTIONS,
  type GeneratorOptions,
  type TargetLanguage,
} from "../src/generators/types";
import { safeClassName } from "../src/naming/naming";
import { inferSchema } from "../src/schema/infer";

interface FixtureCase {
  /** Becomes the file name and the Python module name. */
  readonly name: string;
  readonly file?: string;
  readonly value?: unknown;
  readonly options?: Partial<GeneratorOptions>;
  readonly detectDates?: boolean;
}

const FIXTURE_DIRECTORY = path.resolve("tests/fixtures");
const OUTPUT_DIRECTORY = path.resolve("tests/generated");

/**
 * Every fixture that has to compile in all three languages. The awkward cases
 * are here on purpose: each one produced invalid code at some point.
 */
const CASES: readonly FixtureCase[] = [
  { name: "simple_object", file: "simple-object.json" },
  { name: "nested_object", file: "nested-object.json" },
  { name: "array_of_objects", file: "array-of-objects.json" },
  { name: "missing_properties", file: "missing-properties.json" },
  { name: "null_values", file: "null-values.json" },
  { name: "mixed_values", file: "mixed-values.json" },
  { name: "invalid_keys", file: "invalid-keys.json" },
  { name: "empty_values", file: "empty-values.json" },
  { name: "unicode_keys", file: "unicode-keys.json" },
  { name: "realistic_api", file: "realistic-api-response.json" },
  { name: "reserved_words", file: "reserved-words.json" },
  { name: "colliding_keys", file: "colliding-keys.json" },
  { name: "deep_nesting", file: "deep-nesting.json" },
  {
    name: "converted_names",
    file: "invalid-keys.json",
    options: { convertPropertyNames: true },
  },
  {
    name: "detected_dates",
    file: "realistic-api-response.json",
    detectDates: true,
  },
  {
    name: "legacy_python",
    file: "mixed-values.json",
    options: {
      python: { ...DEFAULT_GENERATOR_OPTIONS.python, modernUnions: false },
    },
  },
  {
    name: "python_example",
    file: "nested-object.json",
    options: {
      python: { ...DEFAULT_GENERATOR_OPTIONS.python, includeExample: true },
    },
  },
  {
    name: "type_aliases",
    file: "nested-object.json",
    options: {
      typescript: {
        ...DEFAULT_GENERATOR_OPTIONS.typescript,
        declarationMode: "type",
        readonlyProperties: true,
      },
    },
  },
  {
    name: "no_serialization",
    file: "simple-object.json",
    options: {
      dart: {
        ...DEFAULT_GENERATOR_OPTIONS.dart,
        includeFromJson: false,
        includeToJson: false,
        constConstructors: false,
      },
      includeComments: true,
    },
  },
  { name: "root_object_array", value: [{ id: 1 }, { id: 2, note: "x" }] },
  { name: "root_primitive_array", value: [1, 2, 3] },
  { name: "root_primitive", value: true },
  { name: "root_empty_object", value: {} },
  { name: "dollar_keys", value: { $id: 1, a$b: "x", price$: 2.5 } },
  { name: "dart_member_keys", value: { toJson: 1, fromJson: 2, hashCode: 3 } },
  {
    name: "pydantic_members",
    value: { model_config: 1, model_id: 2, schema: "x", copy: true },
  },
  { name: "class_name_keywords", value: { none: { x: 1 }, true: { y: 2 } } },
  {
    name: "nested_lists",
    value: { grid: [[1, 2], [3]], deep: [[[true]]] },
  },
  { name: "union_with_object", value: [{ a: 1 }, "text"] },
  { name: "nullable_object", value: [{ p: { a: 1 } }, { p: null }] },
  { name: "numeric_keys", value: { "123": 1, "2fa_enabled": true } },
];

function withDefaults(overrides: Partial<GeneratorOptions>): GeneratorOptions {
  return {
    ...DEFAULT_GENERATOR_OPTIONS,
    ...overrides,
    dart: { ...DEFAULT_GENERATOR_OPTIONS.dart, ...overrides.dart },
    typescript: {
      ...DEFAULT_GENERATOR_OPTIONS.typescript,
      ...overrides.typescript,
    },
    python: { ...DEFAULT_GENERATOR_OPTIONS.python, ...overrides.python },
  };
}

async function loadValue(testCase: FixtureCase): Promise<unknown> {
  if (testCase.file) {
    const raw = await readFile(
      path.join(FIXTURE_DIRECTORY, testCase.file),
      "utf8",
    );
    return JSON.parse(raw) as unknown;
  }
  return testCase.value;
}

const EXTENSIONS: Record<TargetLanguage, string> = {
  dart: "dart",
  typescript: "ts",
  python: "py",
};

const DIRECTORIES: Record<TargetLanguage, string> = {
  dart: "dart",
  typescript: "typescript",
  python: "python",
};

interface Generated {
  readonly name: string;
  readonly rootName: string;
  readonly value: unknown;
  /** A root class exists only for a nonempty object root. */
  readonly hasRootClass: boolean;
  /** The Dart round trip needs both serialization members. */
  readonly hasDartSerialization: boolean;
}

function dartLiteral(value: unknown): string {
  if (value === null) {
    return "null";
  }
  if (typeof value === "string") {
    const escaped = value
      .replaceAll("\\", "\\\\")
      .replaceAll("'", "\\'")
      .replaceAll("$", "\\$")
      .replaceAll("\n", "\\n")
      .replaceAll("\r", "\\r");
    return `'${escaped}'`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `<dynamic>[${value.map(dartLiteral).join(", ")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).map(
    ([key, item]) => `${dartLiteral(key)}: ${dartLiteral(item)}`,
  );
  return `<String, dynamic>{${entries.join(", ")}}`;
}

/**
 * A project file so `tsc` checks every generated declaration under settings at
 * least as strict as the application uses.
 */
async function writeTypeScriptProject(
  generated: readonly Generated[],
): Promise<void> {
  const tsconfig = {
    compilerOptions: {
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      target: "ES2022",
      module: "ESNext",
      moduleResolution: "bundler",
      noEmit: true,
      skipLibCheck: true,
      isolatedModules: true,
      verbatimModuleSyntax: true,
    },
    files: generated.map((entry) => `./${entry.name}.ts`),
  };
  await writeFile(
    path.join(OUTPUT_DIRECTORY, "typescript", "tsconfig.json"),
    `${JSON.stringify(tsconfig, null, 2)}\n`,
    "utf8",
  );
}

/**
 * Parses each fixture with the generated Dart model and serializes it again, so a
 * broken `fromJson` or `toJson` fails the build instead of passing quietly.
 */
async function writeDartRoundTrip(
  generated: readonly Generated[],
): Promise<void> {
  const objectCases = generated.filter(
    (entry) => entry.hasRootClass && entry.hasDartSerialization,
  );
  const imports = objectCases.map(
    (entry) => `import '${entry.name}.dart' as ${entry.name};`,
  );
  const checks = objectCases.map((entry) =>
    [
      "  {",
      `    final json = ${dartLiteral(entry.value)};`,
      `    final model = ${entry.name}.${entry.rootName}.fromJson(json);`,
      "    final encoded = model.toJson();",
      "    for (final key in json.keys) {",
      "      if (!encoded.containsKey(key)) {",
      `        throw StateError('${entry.name} lost the key $key');`,
      "      }",
      "    }",
      "    checked += 1;",
      "  }",
    ].join("\n"),
  );

  const source = [
    "// Generated by scripts/generate-fixtures.ts. Do not edit.",
    ...imports,
    "",
    "void main() {",
    "  var checked = 0;",
    ...checks,
    `  if (checked != ${objectCases.length}) {`,
    `    throw StateError('expected ${objectCases.length} round trips');`,
    "  }",
    "  print('dart round trip passed for $checked fixtures');",
    "}",
    "",
  ].join("\n");

  await writeFile(
    path.join(OUTPUT_DIRECTORY, "dart", "round_trip.dart"),
    source,
    "utf8",
  );
  // The analyzer needs a package marker before it will resolve the imports.
  await writeFile(
    path.join(OUTPUT_DIRECTORY, "dart", "pubspec.yaml"),
    [
      "name: json2model_generated",
      "environment:",
      "  sdk: '>=3.4.0 <4.0.0'",
      "",
    ].join("\n"),
    "utf8",
  );
}

/**
 * Imports every generated module and validates the original fixture with it, so
 * an alias or default that does not work shows up as a failure.
 */
async function writePythonValidator(
  generated: readonly Generated[],
): Promise<void> {
  // The payloads live in a data file so the script itself stays short enough for
  // Ruff's line length rule.
  await writeFile(
    path.join(OUTPUT_DIRECTORY, "python", "cases.json"),
    `${JSON.stringify(
      generated.map((entry) => ({
        module: entry.name,
        root: entry.rootName,
        payload: entry.value,
      })),
      null,
      2,
    )}\n`,
    "utf8",
  );

  const source = [
    '"""Generated by scripts/generate-fixtures.ts. Do not edit."""',
    "",
    "import importlib",
    "import json",
    "import pathlib",
    "import sys",
    "",
    "HERE = pathlib.Path(__file__).parent",
    "sys.path.insert(0, str(HERE))",
    "",
    "",
    "def main() -> None:",
    '    cases = json.loads((HERE / "cases.json").read_text(encoding="utf-8"))',
    "    for case in cases:",
    '        module = importlib.import_module(case["module"])',
    '        model_type = getattr(module, case["root"])',
    '        value = case["payload"]',
    "        model = model_type.model_validate(value)",
    "        dumped = model.model_dump(by_alias=True)",
    "        if isinstance(value, dict):",
    "            missing = set(value) - set(dumped)",
    "            if missing:",
    "                message = f\"{case['module']} lost keys {missing}\"",
    "                raise AssertionError(message)",
    '    print(f"pydantic validation passed for {len(cases)} fixtures")',
    "",
    "",
    'if __name__ == "__main__":',
    "    main()",
    "",
  ].join("\n");

  await writeFile(
    path.join(OUTPUT_DIRECTORY, "python", "validate.py"),
    source,
    "utf8",
  );

  await writeFile(
    path.join(OUTPUT_DIRECTORY, "python", "ruff.toml"),
    [
      'target-version = "py311"',
      "",
      "[lint]",
      "# Errors, undefined and unused names, import order, and whitespace.",
      '# The "UP" group is left out because legacy Optional and Union syntax is a',
      "# supported generator option, and those rules would always reject it.",
      'select = ["E", "F", "I", "W"]',
      "",
    ].join("\n"),
    "utf8",
  );
}

/** Guards against a fixture file being added without a matching case. */
async function checkFixtureCoverage(): Promise<void> {
  const files = (await readdir(FIXTURE_DIRECTORY)).filter((file) =>
    file.endsWith(".json"),
  );
  const used = new Set(
    CASES.flatMap((testCase) => (testCase.file ? [testCase.file] : [])),
  );
  const missing = files.filter((file) => !used.has(file));
  if (missing.length > 0) {
    throw new Error(
      `These fixtures have no case in generate-fixtures.ts: ${missing.join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  await checkFixtureCoverage();
  // A file sync client or an editor can hold a handle open on Windows, so the
  // cleanup retries rather than failing the run.
  await rm(OUTPUT_DIRECTORY, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  });
  for (const directory of Object.values(DIRECTORIES)) {
    await mkdir(path.join(OUTPUT_DIRECTORY, directory), { recursive: true });
  }

  const generated: Generated[] = [];
  for (const testCase of CASES) {
    const value = await loadValue(testCase);
    const rootName = safeClassName(testCase.name, "dart", "RootModel");
    const options = withDefaults({
      ...testCase.options,
      rootName,
      detectDates: testCase.detectDates ?? false,
    });
    const { schema } = inferSchema(value, { detectDates: options.detectDates });

    for (const language of ["dart", "typescript", "python"] as const) {
      const result = generateModels(language, schema, options);
      await writeFile(
        path.join(
          OUTPUT_DIRECTORY,
          DIRECTORIES[language],
          `${testCase.name}.${EXTENSIONS[language]}`,
        ),
        result.code,
        "utf8",
      );
    }

    const isObjectRoot =
      typeof value === "object" && value !== null && !Array.isArray(value);
    generated.push({
      name: testCase.name,
      rootName,
      value,
      hasRootClass: isObjectRoot && Object.keys(value).length > 0,
      hasDartSerialization:
        options.dart.includeFromJson && options.dart.includeToJson,
    });
  }

  await writeTypeScriptProject(generated);
  await writeDartRoundTrip(generated);
  await writePythonValidator(generated);
  console.log(
    `generated ${String(CASES.length)} fixtures in ${OUTPUT_DIRECTORY}`,
  );
}

await main();
