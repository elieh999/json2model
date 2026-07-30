import { describe, expect, it } from "vitest";
import { MAX_INPUT_CHARACTERS, parseJson } from "@/src/parser/jsonParser";
import { Json2ModelError } from "@/src/schema/types";

describe("parseJson", () => {
  it("parses objects, arrays, and primitive roots", () => {
    expect(parseJson('{"ok":true}')).toMatchObject({ ok: true });
    expect(parseJson("[1,2,3]")).toMatchObject({ ok: true });
    expect(parseJson('"hello"')).toMatchObject({ ok: true });
  });

  it("returns a friendly location for invalid JSON", () => {
    const result = parseJson('{\n  "name": "Ada",\n  "active": true,\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(
        /Invalid JSON near line \d+, column \d+/,
      );
      expect(result.error.message).not.toMatch(/SyntaxError|stack/i);
    }
  });

  it("warns when a large integer may lose precision", () => {
    const result = parseJson('{"id": 90071992547409930}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.warnings[0]?.code).toBe("large-integer");
    }
  });

  it("rejects excessively large input before parsing", () => {
    expect(() => parseJson(" ".repeat(MAX_INPUT_CHARACTERS + 1))).toThrow(
      Json2ModelError,
    );
  });
});
