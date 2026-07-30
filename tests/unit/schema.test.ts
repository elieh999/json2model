import { describe, expect, it } from "vitest";
import { inferSchema, mergeNodes } from "@/src/schema/infer";
import type { ObjectSchemaNode, SchemaNode } from "@/src/schema/types";
import { Json2ModelError } from "@/src/schema/types";

function rootObject(value: unknown): ObjectSchemaNode {
  const schema = inferSchema(value).schema;
  expect(schema.kind).toBe("object");
  return schema as ObjectSchemaNode;
}

function elementOf(value: unknown): SchemaNode {
  const schema = inferSchema(value).schema;
  if (schema.kind !== "array") {
    throw new Error("expected an array root");
  }
  return schema.element;
}

function optionalFlags(value: unknown): Record<string, boolean> {
  const element = elementOf(value);
  if (element.kind !== "object") {
    throw new Error("expected an array of objects");
  }
  return Object.fromEntries(
    element.properties.map((property) => [property.jsonKey, property.optional]),
  );
}

describe("primitive inference", () => {
  it("distinguishes integers, floating point numbers, and booleans", () => {
    const schema = rootObject({ count: 3, ratio: 1.5, ready: true });
    expect(schema.properties.map((property) => property.node)).toEqual([
      { kind: "primitive", type: "integer" },
      { kind: "primitive", type: "number" },
      { kind: "primitive", type: "boolean" },
    ]);
  });

  it("detects dates only when enabled", () => {
    expect(rootObject({ day: "2026-07-30" }).properties[0]?.node).toEqual({
      kind: "primitive",
      type: "string",
    });
    const detected = inferSchema(
      { day: "2026-07-30", at: "2026-07-30T08:30:00Z" },
      { detectDates: true },
    ).schema as ObjectSchemaNode;
    expect(detected.properties.map((property) => property.node)).toEqual([
      { kind: "primitive", type: "date" },
      { kind: "primitive", type: "datetime" },
    ]);
  });

  it("leaves a date shaped string alone when it is not a full match", () => {
    const schema = inferSchema(
      { almost: "2026-07-30 morning", partial: "2026-07" },
      { detectDates: true },
    ).schema as ObjectSchemaNode;
    for (const property of schema.properties) {
      expect(property.node).toEqual({ kind: "primitive", type: "string" });
    }
  });
});

describe("object merging", () => {
  it("marks a property missing from any element as optional", () => {
    expect(
      optionalFlags([
        { id: 1, name: "Ada" },
        { id: 2, email: "ada@example.com" },
      ]),
    ).toEqual({ id: false, name: true, email: true });
  });

  it("keeps nullable separate from optional", () => {
    // A property present in every element stays required even when a value is
    // null, because the key is always there.
    const element = elementOf([{ value: "x" }, { value: null }]);
    if (element.kind !== "object") {
      throw new Error("expected an object element");
    }
    expect(element.properties[0]?.optional).toBe(false);
    expect(element.properties[0]?.node.kind).toBe("union");
  });

  it("merges nested objects inside merged elements", () => {
    const element = elementOf([
      { profile: { a: 1 } },
      { profile: { a: 2, b: "x" } },
    ]);
    if (element.kind !== "object") {
      throw new Error("expected an object element");
    }
    const profile = element.properties[0]?.node;
    expect(profile?.kind).toBe("object");
    if (profile?.kind === "object") {
      expect(
        profile.properties.map((property) => [
          property.jsonKey,
          property.optional,
        ]),
      ).toEqual([
        ["a", false],
        ["b", true],
      ]);
    }
  });

  it("widens a whole number and a decimal to one floating point type", () => {
    expect(elementOf([1, 2.5])).toEqual({ kind: "primitive", type: "number" });
  });

  it("merges an object with null into a nullable object", () => {
    const element = elementOf([{ p: { a: 1 } }, { p: null }]);
    if (element.kind !== "object") {
      throw new Error("expected an object element");
    }
    const property = element.properties[0]?.node;
    expect(property?.kind).toBe("union");
    if (property?.kind === "union") {
      expect(property.variants.map((variant) => variant.kind).sort()).toEqual([
        "object",
        "primitive",
      ]);
    }
  });

  it("returns unknown when there is nothing to merge", () => {
    expect(mergeNodes([])).toEqual({
      kind: "unknown",
      reason: "No values were available to infer.",
    });
  });
});

describe("warnings", () => {
  it("reports empty arrays, empty objects, and mixed arrays", () => {
    const result = inferSchema({ empty: [], metadata: {}, mixed: [1, "x"] });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "empty-array",
      "empty-object",
      "mixed-array",
    ]);
    expect(result.warnings[0]?.message).toContain("$.empty");
  });

  it("collapses one warning per place instead of one per array element", () => {
    // A 500 element array with the same empty field used to produce 500 lines.
    const value = Array.from({ length: 500 }, () => ({ tags: [] }));
    const result = inferSchema(value);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]?.path).toBe("$[].tags");
    expect(result.warnings[0]?.occurrences).toBe(500);
  });

  it("keeps separate warnings for separate paths", () => {
    const result = inferSchema({ a: [], b: [], c: {} });
    expect(result.warnings.map((warning) => warning.path)).toEqual([
      "$.a",
      "$.b",
      "$.c",
    ]);
  });
});

describe("safety limits", () => {
  it("stops at the nesting limit with a readable message", () => {
    const value: Record<string, unknown> = {};
    let cursor = value;
    for (let index = 0; index < 12; index += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(() => inferSchema(value, { maxDepth: 5 })).toThrow(Json2ModelError);
    expect(() => inferSchema(value, { maxDepth: 5 })).toThrow(/deeper/);
  });

  it("stops after the visited node limit", () => {
    const value = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [
        `field${String(index)}`,
        index,
      ]),
    );
    expect(() => inferSchema(value, { maxNodes: 50 })).toThrow(Json2ModelError);
  });

  it("accepts deep input inside the limit", () => {
    const value: Record<string, unknown> = {};
    let cursor = value;
    for (let index = 0; index < 40; index += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(() => inferSchema(value)).not.toThrow();
  });
});

describe("determinism", () => {
  it("preserves or sorts property order on request", () => {
    const value = { zebra: 1, alpha: 2, apple: 3 };
    expect(
      rootObject(value).properties.map((property) => property.jsonKey),
    ).toEqual(["zebra", "alpha", "apple"]);
    const sorted = inferSchema(value, { preservePropertyOrder: false })
      .schema as ObjectSchemaNode;
    // Sorted by code point, which is stable across hosts and locales.
    expect(sorted.properties.map((property) => property.jsonKey)).toEqual([
      "alpha",
      "apple",
      "zebra",
    ]);
  });

  it("produces an identical schema for the same input", () => {
    const value = {
      id: 1,
      list: [{ a: 1 }, { b: 2 }],
      mixed: [1, "x", null],
      empty: [],
    };
    expect(JSON.stringify(inferSchema(value))).toBe(
      JSON.stringify(inferSchema(value)),
    );
  });
});

describe("root values", () => {
  it("supports every root shape", () => {
    expect(inferSchema({}).schema).toMatchObject({
      kind: "object",
      empty: true,
    });
    expect(inferSchema([]).schema).toMatchObject({
      kind: "array",
      empty: true,
    });
    expect(inferSchema(true).schema).toEqual({
      kind: "primitive",
      type: "boolean",
    });
    expect(inferSchema(null).schema).toEqual({
      kind: "primitive",
      type: "null",
    });
  });
});
