import { describe, expect, it } from "vitest";
import { MAX_INPUT_CHARACTERS, parseJson } from "@/src/parser/jsonParser";

describe("parseJson", () => {
  it("parses objects, arrays, and primitive roots", () => {
    expect(parseJson('{"ok":true}')).toMatchObject({ ok: true });
    expect(parseJson("[1,2,3]")).toMatchObject({ ok: true });
    expect(parseJson('"hello"')).toMatchObject({ ok: true });
    expect(parseJson("42")).toMatchObject({ ok: true });
    expect(parseJson("null")).toMatchObject({ ok: true });
  });

  it("returns a friendly location for invalid JSON", () => {
    const result = parseJson('{\n  "name": "Ada",\n  "active": true,\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(
        /Invalid JSON near line \d+, column \d+/,
      );
      expect(result.error.line).toBe(4);
      expect(result.error.code).toBe("syntax");
    }
  });

  it("points at the end of the document when it stops early", () => {
    // The engine gives no offset for this case, so it is worked out from the
    // length of the input.
    const result = parseJson('{\n  "a": [1,');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.line).toBe(2);
      expect(result.error.message).toContain("ended before");
    }
  });

  it("names the character that was not expected", () => {
    const result = parseJson('{"name": }');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(
        "The character } was not expected",
      );
    }
  });

  it("never leaks a stack trace or an engine error name", () => {
    for (const source of ["{", "{'a':1}", "[1,", "tru", '{"a" 1}']) {
      const result = parseJson(source);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).not.toMatch(
          /SyntaxError|stack|at \w+ \(/i,
        );
        expect(result.error.message).toMatch(/^Invalid JSON/);
      }
    }
  });

  it("reports oversized input as a result instead of throwing", () => {
    // A thrown error here would escape click handlers that format or minify.
    const result = parseJson(" ".repeat(MAX_INPUT_CHARACTERS + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("input-too-large");
      expect(result.error.message).toContain("2,000,000 characters");
    }
  });

  it("warns when an integer exceeds safe JavaScript precision", () => {
    const result = parseJson('{"id": 90071992547409930}');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.warnings[0]?.code).toBe("large-integer");
    }
  });

  it("warns for a large integer at the document root", () => {
    const result = parseJson("90071992547409930");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.parsed.warnings[0]?.code).toBe("large-integer");
    }
  });

  it("does not warn for safe integers or for digits inside strings", () => {
    for (const source of [
      '{"id": 9007199254740991}',
      '{"id": "90071992547409930"}',
      '{"ratio": 1.5}',
      '{"exponent": 1e40}',
    ]) {
      const result = parseJson(source);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.parsed.warnings).toEqual([]);
      }
    }
  });
});
