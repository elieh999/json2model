import { describe, expect, it } from "vitest";
import { generateModels } from "@/src/generators/generate";
import {
  DEFAULT_GENERATOR_OPTIONS,
  type GeneratorOptions,
} from "@/src/generators/types";
import { inferSchema } from "@/src/schema/infer";

function options(overrides: Partial<GeneratorOptions> = {}): GeneratorOptions {
  return {
    ...DEFAULT_GENERATOR_OPTIONS,
    ...overrides,
    dart: {
      ...DEFAULT_GENERATOR_OPTIONS.dart,
      ...overrides.dart,
    },
    typescript: {
      ...DEFAULT_GENERATOR_OPTIONS.typescript,
      ...overrides.typescript,
    },
    python: {
      ...DEFAULT_GENERATOR_OPTIONS.python,
      ...overrides.python,
    },
  };
}

const fixture = {
  id: 7,
  "first-name": "Ada",
  score: 9.5,
  active: true,
  profile: { label: "admin" },
  items: [{ sku: "A" }, { sku: "B", note: null }],
};

describe("language generators", () => {
  it("generates null safe Dart with serialization and numeric conversion", () => {
    const schema = inferSchema(fixture).schema;
    const result = generateModels(
      "dart",
      schema,
      options({ convertPropertyNames: true }),
    );

    expect(result.code).toContain("class RootModel");
    expect(result.code).toContain("final String firstName;");
    expect(result.code).toContain("score: (json['score'] as num).toDouble()");
    expect(result.code).toContain(
      "profile: Profile.fromJson(json['profile'] as Map<String, dynamic>)",
    );
    expect(result.code).toContain("'first-name': firstName");
    expect(result.code).toContain("Map<String, dynamic> toJson()");
  });

  it("generates strict TypeScript and preserves raw keys by default", () => {
    const schema = inferSchema([
      { "first-name": "Ada", value: 1 },
      { "first-name": "Grace" },
    ]).schema;
    const result = generateModels("typescript", schema, options());

    expect(result.code).toContain("export interface RootModelItem");
    expect(result.code).toContain('"first-name": string;');
    expect(result.code).toContain("value?: number;");
    expect(result.code).toContain("export type RootModel = RootModelItem[];");
  });

  it("warns when TypeScript keys are converted", () => {
    const schema = inferSchema({ "first-name": "Ada" }).schema;
    const result = generateModels(
      "typescript",
      schema,
      options({ convertPropertyNames: true }),
    );
    expect(result.code).toContain("firstName: string;");
    expect(
      result.warnings.some(
        (warning) => warning.code === "renamed-typescript-key",
      ),
    ).toBe(true);
  });

  it("generates Pydantic 2 aliases and required nullable fields", () => {
    const schema = inferSchema([
      { "first-name": "Ada", email: "a@example.com" },
      { "first-name": "Grace", email: null },
    ]).schema;
    const result = generateModels(
      "python",
      schema,
      options({ convertPropertyNames: true }),
    );

    expect(result.code).toContain("from pydantic import");
    expect(result.code).toContain("class RootModelItem(BaseModel):");
    expect(result.code).toContain(
      'first_name: str = Field(alias="first-name")',
    );
    expect(result.code).toContain("email: str | None");
    expect(result.code).toContain(
      "class RootModel(RootModel[list[RootModelItem]])",
    );
  });

  it("supports root primitive and primitive array inputs", () => {
    const primitive = inferSchema(true).schema;
    const array = inferSchema([1, 2, 3]).schema;
    expect(generateModels("typescript", primitive, options()).code).toContain(
      "export type RootModel = boolean;",
    );
    expect(generateModels("dart", array, options()).code).toContain(
      "typedef RootModel = List<int>;",
    );
    expect(generateModels("python", primitive, options()).code).toContain(
      "class RootModel(RootModel[bool]):",
    );
  });

  it("resolves duplicate nested class names", () => {
    const schema = inferSchema({
      "user-profile": { id: 1 },
      user_profile: { name: "Ada" },
    }).schema;
    const code = generateModels("dart", schema, options()).code;
    expect(code).toContain("class UserProfile {");
    expect(code).toContain("class UserProfile2 {");
  });

  it("produces identical output for identical input and settings", () => {
    const schema = inferSchema(fixture).schema;
    const first = generateModels("python", schema, options()).code;
    const second = generateModels("python", schema, options()).code;
    expect(second).toBe(first);
  });
});
