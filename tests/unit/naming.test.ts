import { describe, expect, it } from "vitest";
import {
  isValidIdentifier,
  safePropertyName,
  toCamelCase,
  toPascalCase,
  uniqueName,
} from "@/src/naming/naming";

describe("naming", () => {
  it("converts spaces, punctuation, acronyms, and leading numbers", () => {
    expect(toPascalCase("user profile")).toBe("UserProfile");
    expect(toCamelCase("first-name")).toBe("firstName");
    expect(toCamelCase("2fa_enabled")).toBe("twoFaEnabled");
    expect(toCamelCase("field_2499")).toBe("field2499");
    expect(toCamelCase("API_response")).toBe("apiResponse");
  });

  it("handles reserved words for each language", () => {
    expect(safePropertyName("class", "dart")).toBe("class_");
    expect(safePropertyName("class", "python")).toBe("class_");
    expect(isValidIdentifier("class", "typescript")).toBe(false);
  });

  it("keeps Unicode letters in safe identifiers", () => {
    expect(safePropertyName("اسم المستخدم", "python")).toBe("اسم_المستخدم");
    expect(isValidIdentifier("اسم_المستخدم", "python")).toBe(true);
  });

  it("resolves duplicate names deterministically", () => {
    const used = new Set<string>();
    expect(uniqueName("Profile", used)).toBe("Profile");
    expect(uniqueName("Profile", used)).toBe("Profile2");
    expect(uniqueName("Profile", used)).toBe("Profile3");
  });
});
