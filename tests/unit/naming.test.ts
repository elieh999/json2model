import { describe, expect, it } from "vitest";
import {
  isValidIdentifier,
  propertyNameFor,
  quoteString,
  safeClassName,
  safePropertyName,
  toCamelCase,
  toPascalCase,
  toSnakeCase,
  uniqueName,
} from "@/src/naming/naming";

describe("case conversion", () => {
  it("converts spaces, punctuation, acronyms, and leading numbers", () => {
    expect(toPascalCase("user profile")).toBe("UserProfile");
    expect(toCamelCase("first-name")).toBe("firstName");
    expect(toCamelCase("2fa_enabled")).toBe("twoFaEnabled");
    expect(toCamelCase("API_response")).toBe("apiResponse");
    expect(toSnakeCase("display-name")).toBe("display_name");
  });

  it("keeps a trailing group of digits as digits", () => {
    expect(toCamelCase("field_2499")).toBe("field2499");
    expect(toSnakeCase("field_2499")).toBe("field_2499");
  });

  it("reduces accented Latin letters to their base form", () => {
    expect(toCamelCase("café")).toBe("cafe");
    expect(toPascalCase("Zürich")).toBe("Zurich");
  });

  it("prefixes a name that would start with a digit", () => {
    expect(toCamelCase("123")).toBe("field123");
    expect(toSnakeCase("123")).toBe("field_123");
    expect(toPascalCase("123")).toBe("Model123");
  });

  it("falls back when a value has no usable characters", () => {
    expect(toPascalCase("***")).toBe("Model");
    expect(toCamelCase("***")).toBe("value");
  });
});

describe("property names", () => {
  it("escapes reserved words per language", () => {
    expect(safePropertyName("class", "dart")).toBe("class_");
    expect(safePropertyName("class", "python")).toBe("class_");
    expect(safePropertyName("interface", "typescript")).toBe("interface_");
    // A property name is lowercased, so the capitalized Python keywords cannot
    // appear. "None" becomes the legal identifier "none".
    expect(safePropertyName("None", "python")).toBe("none");
  });

  it("renames names Pydantic claims for itself", () => {
    // Pydantic swallows `model_config` and the `model_` prefix, so a field with
    // one of those names would disappear from the model.
    expect(safePropertyName("model_config", "python")).toBe(
      "field_model_config",
    );
    expect(safePropertyName("model_id", "python")).toBe("field_model_id");
    expect(safePropertyName("schema", "python")).toBe("field_schema");
    expect(safePropertyName("copy", "python")).toBe("field_copy");
  });

  it("leaves those names alone for Dart and TypeScript", () => {
    expect(safePropertyName("model_config", "dart")).toBe("modelConfig");
    expect(safePropertyName("schema", "typescript")).toBe("schema");
  });

  it("keeps Unicode letters for Python and TypeScript", () => {
    expect(propertyNameFor("اسم المستخدم", "python")).toBe("اسم_المستخدم");
    expect(propertyNameFor("城市", "typescript")).toBe("城市");
    expect(isValidIdentifier("اسم_المستخدم", "python")).toBe(true);
  });

  it("reports that a non ASCII key cannot be a Dart identifier", () => {
    // Dart identifiers are ASCII only, so the caller has to invent a name.
    expect(propertyNameFor("اسم المستخدم", "dart")).toBeNull();
    expect(propertyNameFor("城市", "dart")).toBeNull();
    expect(isValidIdentifier("城市", "dart")).toBe(false);
    expect(isValidIdentifier("city", "dart")).toBe(true);
  });
});

describe("class names", () => {
  it("avoids names that would shadow a type in scope", () => {
    expect(safeClassName("BaseModel", "python")).toBe("BaseModelModel");
    expect(safeClassName("base model", "python")).toBe("BaseModelModel");
    expect(safeClassName("string", "dart")).toBe("StringModel");
    expect(safeClassName("date", "typescript")).toBe("DateModel");
    // A lowercase builtin cannot be produced, because class names capitalize.
    expect(safeClassName("list", "python")).toBe("List");
  });

  it("avoids keywords that cannot follow the class statement", () => {
    // `class None(BaseModel):` and `class True(BaseModel):` are syntax errors.
    expect(safeClassName("none", "python")).toBe("NoneModel");
    expect(safeClassName("true", "python")).toBe("TrueModel");
  });

  it("keeps RootModel usable as the default root name", () => {
    expect(safeClassName("RootModel", "python")).toBe("RootModel");
    expect(safeClassName("RootModel", "dart")).toBe("RootModel");
  });

  it("drops characters Dart cannot use in a class name", () => {
    expect(safeClassName("城市", "dart", "NestedModel")).toBe("NestedModel");
    expect(safeClassName("城市", "python", "NestedModel")).toBe("城市");
  });
});

describe("uniqueName", () => {
  it("resolves duplicates deterministically", () => {
    const used = new Set<string>();
    expect(uniqueName("Profile", used)).toBe("Profile");
    expect(uniqueName("Profile", used)).toBe("Profile2");
    expect(uniqueName("Profile", used)).toBe("Profile3");
  });
});

describe("quoteString", () => {
  it("escapes quotes, backslashes and control characters", () => {
    expect(quoteString("it's", "'")).toBe("'it\\'s'");
    expect(quoteString('say "hi"', '"')).toBe('"say \\"hi\\""');
    expect(quoteString("a\\b", "'")).toBe("'a\\\\b'");
    expect(quoteString("line\nbreak", "'")).toBe("'line\\nbreak'");
  });

  it("escapes the dollar sign only when asked", () => {
    // Dart interpolates `$` inside a string literal.
    expect(quoteString("$id", "'", { escapeDollar: true })).toBe("'\\$id'");
    expect(quoteString("$id", '"')).toBe('"$id"');
  });
});
