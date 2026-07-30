import { describe, expect, it } from "vitest";
import { generateModels } from "@/src/generators/generate";
import {
  DEFAULT_GENERATOR_OPTIONS,
  type GeneratorOptions,
  type TargetLanguage,
} from "@/src/generators/types";
import { inferSchema } from "@/src/schema/infer";
import type { GenerationResult } from "@/src/generators/types";

function options(overrides: Partial<GeneratorOptions> = {}): GeneratorOptions {
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

function generate(
  language: TargetLanguage,
  value: unknown,
  overrides: Partial<GeneratorOptions> = {},
): GenerationResult {
  const resolved = options(overrides);
  const inferred = inferSchema(value, { detectDates: resolved.detectDates });
  return generateModels(language, inferred.schema, resolved, inferred.warnings);
}

const fixture = {
  id: 7,
  "first-name": "Ada",
  score: 9.5,
  active: true,
  profile: { label: "admin" },
  items: [{ sku: "A" }, { sku: "B", note: null }],
};

describe("Dart generator", () => {
  it("generates null safe classes with serialization and numeric conversion", () => {
    const code = generate("dart", fixture).code;
    expect(code).toContain("class RootModel");
    expect(code).toContain("final String firstName;");
    expect(code).toContain("score: (json['score'] as num).toDouble()");
    expect(code).toContain(
      "profile: Profile.fromJson(json['profile'] as Map<String, dynamic>)",
    );
    expect(code).toContain("'first-name': firstName");
    expect(code).toContain("Map<String, dynamic> toJson()");
  });

  it("escapes a dollar sign in a JSON key", () => {
    // Dart interpolates `$`, so `json['$id']` would not compile.
    const code = generate("dart", { $id: 1, a$b: "x" }).code;
    expect(code).toContain("json['\\$id'] as int");
    expect(code).toContain("json['a\\$b'] as String");
    expect(code).not.toMatch(/json\['\$id'\]/);
  });

  it("renames a field that would collide with a generated member", () => {
    const result = generate("dart", { toJson: 1, fromJson: 2, hashCode: 3 });
    expect(result.code).toContain("final int toJson2;");
    expect(result.code).toContain("'toJson': toJson2");
    expect(result.code).toContain("final int fromJson2;");
    expect(result.code).toContain("final int hashCode2;");
    expect(
      result.warnings.some(
        (warning) => warning.code === "generated-identifier",
      ),
    ).toBe(true);
  });

  it("gives every colliding key its own field", () => {
    const result = generate("dart", {
      "first-name": "a",
      first_name: "b",
      firstName: "c",
    });
    expect(result.code).toContain("final String firstName;");
    expect(result.code).toContain("final String firstName2;");
    expect(result.code).toContain("final String firstName3;");
    expect(result.code).toContain("'first-name': firstName");
    expect(result.code).toContain("'first_name': firstName2");
    expect(result.code).toContain("'firstName': firstName3");
  });

  it("invents an ASCII field name for a key Dart cannot express", () => {
    const result = generate("dart", { 城市: "Beijing" });
    expect(result.code).toContain("final String field;");
    expect(result.code).toContain("json['城市'] as String");
    expect(
      result.warnings.some((warning) =>
        warning.message.includes("cannot become a Dart identifier"),
      ),
    ).toBe(true);
  });

  it("uses distinct loop variables for nested lists", () => {
    const code = generate("dart", { grid: [[1, 2], [3]] }).code;
    expect(code).toContain("final List<List<int>> grid;");
    expect(code).toContain("(item) =>");
    expect(code).toContain("(item2) =>");
  });

  it("declares no class for an object shape it cannot express", () => {
    // A union of an object and a string becomes a dynamic value, so a class for
    // the object would be generated and never referenced.
    const result = generate("dart", [{ a: 1 }, "text"]);
    expect(result.code).toBe("typedef RootModel = List<Object?>;\n");
    expect(result.modelCount).toBe(0);
    expect(
      result.warnings.some((warning) => warning.code === "dropped-union-shape"),
    ).toBe(true);
  });

  it("omits a pointless null assertion around a dynamic value", () => {
    const code = generate("dart", { values: [1, "two", null] }).code;
    expect(code).not.toContain("item!");
  });

  it("respects the serialization and constructor options", () => {
    const code = generate(
      "dart",
      { id: 1 },
      {
        dart: {
          includeFromJson: false,
          includeToJson: false,
          constConstructors: false,
        },
      },
    ).code;
    expect(code).not.toContain("fromJson");
    expect(code).not.toContain("toJson");
    expect(code).toContain("  RootModel({");
    expect(code).not.toContain("const RootModel({");
  });
});

describe("TypeScript generator", () => {
  it("generates strict declarations and keeps raw keys by default", () => {
    const result = generate("typescript", [
      { "first-name": "Ada", value: 1 },
      { "first-name": "Grace" },
    ]);
    expect(result.code).toContain("export interface RootModelItem");
    expect(result.code).toContain('"first-name": string;');
    expect(result.code).toContain("value?: number;");
    expect(result.code).toContain("export type RootModel = RootModelItem[];");
    // Nothing was renamed, so no runtime mapping warning belongs here.
    expect(result.warnings).toEqual([]);
  });

  it("warns only when converting names actually changes a key", () => {
    const renamed = generate(
      "typescript",
      { "first-name": "Ada" },
      { convertPropertyNames: true },
    );
    expect(renamed.code).toContain("firstName: string;");
    expect(
      renamed.warnings.some(
        (warning) => warning.code === "renamed-typescript-key",
      ),
    ).toBe(true);

    const unchanged = generate(
      "typescript",
      { id: 1, name: "Ada" },
      { convertPropertyNames: true },
    );
    expect(
      unchanged.warnings.some(
        (warning) => warning.code === "renamed-typescript-key",
      ),
    ).toBe(false);
  });

  it("does not declare the same property twice when converting names", () => {
    const result = generate(
      "typescript",
      { "first-name": "a", first_name: "b" },
      { convertPropertyNames: true },
    );
    expect(result.code).toContain("firstName: string;");
    expect(result.code).toContain("firstName2: string;");
  });

  it("expresses a union that mixes an object with a primitive", () => {
    const code = generate("typescript", [{ a: 1 }, "text"]).code;
    expect(code).toContain("export interface RootModelItem");
    expect(code).toMatch(/RootModelItem \| string|string \| RootModelItem/);
  });

  it("honours declaration style, semicolons, readonly, and export options", () => {
    const code = generate(
      "typescript",
      { id: 1 },
      {
        typescript: {
          declarationMode: "type",
          semicolons: false,
          readonlyProperties: true,
          exportDeclarations: false,
        },
      },
    ).code;
    expect(code).toContain("type RootModel = {");
    expect(code).toContain("  readonly id: number\n");
    expect(code).not.toContain("export ");
  });

  it("uses the configured type for unknown values", () => {
    expect(generate("typescript", { a: [] }).code).toContain("a: unknown[]");
    expect(
      generate("typescript", { a: [] }, { unknownType: "dynamic" }).code,
    ).toContain("a: any[]");
  });
});

describe("Python generator", () => {
  it("generates Pydantic 2 models with aliases", () => {
    const result = generate("python", [
      { "first-name": "Ada", email: "a@example.com" },
      { "first-name": "Grace", email: null },
    ]);
    expect(result.code).toContain("class RootModelItem(BaseModel):");
    expect(result.code).toContain(
      'first_name: str = Field(alias="first-name")',
    );
    expect(result.code).toContain("email: str | None");
    expect(result.code).toContain("model_config = ConfigDict");
  });

  it("imports Pydantic RootModel under an alias when the names collide", () => {
    const code = generate("python", [1, 2, 3]).code;
    expect(code).toContain(
      "from pydantic import RootModel as PydanticRootModel",
    );
    expect(code).toContain("class RootModel(PydanticRootModel[list[int]]):");
  });

  it("keeps a custom root name and imports RootModel directly", () => {
    const code = generate("python", [1, 2], { rootName: "Numbers" }).code;
    expect(code).toContain("from pydantic import RootModel");
    expect(code).not.toContain("PydanticRootModel");
    expect(code).toContain("class Numbers(RootModel[list[int]]):");
  });

  it("never names a class after a Python keyword", () => {
    // `class None(BaseModel):` is a syntax error.
    const code = generate("python", { none: { x: 1 }, true: { y: 2 } }).code;
    expect(code).toContain("class NoneModel(BaseModel):");
    expect(code).toContain("class TrueModel(BaseModel):");
    expect(code).not.toContain("class None(");
    expect(code).not.toContain("class True(");
  });

  it("renames fields Pydantic would swallow and keeps their aliases", () => {
    const code = generate("python", { model_config: 1, schema: "x" }).code;
    expect(code).toContain(
      'field_model_config: int = Field(alias="model_config")',
    );
    expect(code).toContain('field_schema: str = Field(alias="schema")');
  });

  it("imports only what the generated code uses", () => {
    const plain = generate("python", { id: 1 }).code;
    expect(plain).toContain("from pydantic import BaseModel");
    expect(plain).not.toContain("Field");
    expect(plain).not.toContain("ConfigDict");
    expect(plain).not.toContain("from typing import");

    // Optional must not be imported unless the legacy syntax actually uses it.
    const legacyWithoutOptional = generate(
      "python",
      { id: 1 },
      {
        python: { ...DEFAULT_GENERATOR_OPTIONS.python, modernUnions: false },
      },
    ).code;
    expect(legacyWithoutOptional).not.toContain("Optional");

    const legacyWithOptional = generate("python", [{ id: 1 }, { id: null }], {
      python: { ...DEFAULT_GENERATOR_OPTIONS.python, modernUnions: false },
    }).code;
    expect(legacyWithOptional).toContain("from typing import Optional");
    expect(legacyWithOptional).toContain("id: Optional[int]");
  });

  it("separates the standard library imports from the Pydantic import", () => {
    const code = generate(
      "python",
      { at: "2026-01-01T00:00:00Z" },
      { detectDates: true },
    ).code;
    expect(code).toContain(
      "from datetime import datetime\n\nfrom pydantic import BaseModel",
    );
  });

  it("builds an example payload that matches the schema", () => {
    const code = generate(
      "python",
      { id: 1, tags: ["a"] },
      {
        python: { ...DEFAULT_GENERATOR_OPTIONS.python, includeExample: true },
      },
    ).code;
    // The old example always used {"example": true}, which never validated.
    expect(code).toContain('payload = \'{"id":1,"tags":["text"]}\'');
    expect(code).not.toContain('{"example": true}');
  });

  it("declares nested models before the model that uses them", () => {
    const code = generate("python", {
      account: { settings: { theme: "x" } },
    }).code;
    expect(code.indexOf("class Settings(")).toBeLessThan(
      code.indexOf("class Account("),
    );
    expect(code.indexOf("class Account(")).toBeLessThan(
      code.indexOf("class RootModel("),
    );
  });
});

describe("all generators", () => {
  it("supports every root shape", () => {
    expect(generate("typescript", true).code).toContain(
      "export type RootModel = boolean;",
    );
    expect(generate("dart", [1, 2, 3]).code).toContain(
      "typedef RootModel = List<int>;",
    );
    expect(generate("python", true).code).toContain(
      "class RootModel(PydanticRootModel[bool]):",
    );
    expect(generate("dart", {}).code).toContain(
      "typedef RootModel = Map<String, Object?>;",
    );
  });

  it("resolves duplicate nested class names", () => {
    const value = { "user-profile": { id: 1 }, user_profile: { name: "Ada" } };
    for (const language of ["dart", "typescript", "python"] as const) {
      const code = generate(language, value).code;
      expect(code).toContain("UserProfile");
      expect(code).toContain("UserProfile2");
    }
  });

  it("produces identical output for identical input and settings", () => {
    for (const language of ["dart", "typescript", "python"] as const) {
      const first = generate(language, fixture).code;
      const second = generate(language, fixture).code;
      expect(second).toBe(first);
    }
  });

  it("reports a model count that matches the declarations it emitted", () => {
    for (const language of ["dart", "typescript", "python"] as const) {
      const result = generate(language, fixture);
      const declarations =
        result.code.match(/^(class|export interface|interface) /gm) ?? [];
      expect(declarations).toHaveLength(result.modelCount);
    }
  });

  it("carries inference warnings through to the result", () => {
    for (const language of ["dart", "typescript", "python"] as const) {
      const result = generate(language, { items: [], metadata: {} });
      expect(result.warnings.map((warning) => warning.code)).toContain(
        "empty-array",
      );
      expect(result.warnings.map((warning) => warning.code)).toContain(
        "empty-object",
      );
    }
  });

  it("keeps optional and nullable distinct in each language", () => {
    const value = [
      { required: 1, nullable: "x", missing: true },
      { required: 2, nullable: null },
    ];
    expect(generate("dart", value).code).toContain("final bool? missing;");
    expect(generate("typescript", value).code).toContain("missing?: boolean;");

    const python = generate("python", value).code;
    // Present in every element, so it stays required even though it can be null.
    expect(python).toContain("nullable: str | None\n");
    // Missing from an element, so it needs a default.
    expect(python).toContain("missing: bool | None = None");
  });
});
