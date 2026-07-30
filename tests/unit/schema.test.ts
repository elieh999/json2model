import { describe, expect, it } from "vitest";
import { inferSchema } from "@/src/schema/infer";
import type { ObjectSchemaNode } from "@/src/schema/types";

function rootObject(value: unknown): ObjectSchemaNode {
  const schema = inferSchema(value).schema;
  expect(schema.kind).toBe("object");
  return schema as ObjectSchemaNode;
}

describe("schema inference", () => {
  it("distinguishes integers, floating point numbers, and booleans", () => {
    const schema = rootObject({ count: 3, ratio: 1.5, ready: true });
    expect(schema.properties.map((property) => property.node)).toEqual([
      { kind: "primitive", type: "integer" },
      { kind: "primitive", type: "number" },
      { kind: "primitive", type: "boolean" },
    ]);
  });

  it("merges object arrays and marks missing fields optional", () => {
    const schema = inferSchema([
      { id: 1, name: "Ada" },
      { id: 2, email: "ada@example.com" },
    ]).schema;
    expect(schema.kind).toBe("array");
    if (schema.kind === "array" && schema.element.kind === "object") {
      expect(
        Object.fromEntries(
          schema.element.properties.map((property) => [
            property.jsonKey,
            property.optional,
          ]),
        ),
      ).toEqual({ id: false, name: true, email: true });
    }
  });

  it("keeps nullable fields distinct from optional fields", () => {
    const schema = inferSchema([{ value: "x" }, { value: null }]).schema;
    if (schema.kind === "array" && schema.element.kind === "object") {
      const property = schema.element.properties[0];
      expect(property?.optional).toBe(false);
      expect(property?.node.kind).toBe("union");
    } else {
      throw new Error("Expected an array of objects");
    }
  });

  it("warns for empty arrays, empty objects, and mixed arrays", () => {
    const result = inferSchema({ empty: [], metadata: {}, mixed: [1, "x"] });
    expect(result.warnings.map((warning) => warning.code)).toEqual([
      "empty-array",
      "empty-object",
      "mixed-array",
    ]);
  });

  it("detects dates only when enabled", () => {
    expect(rootObject({ day: "2026-07-30" }).properties[0]?.node).toEqual({
      kind: "primitive",
      type: "string",
    });
    expect(
      (
        inferSchema({ day: "2026-07-30" }, { detectDates: true })
          .schema as ObjectSchemaNode
      ).properties[0]?.node,
    ).toEqual({ kind: "primitive", type: "date" });
  });

  it("enforces the nesting safety limit", () => {
    const value: Record<string, unknown> = {};
    let cursor = value;
    for (let index = 0; index < 12; index += 1) {
      cursor.next = {};
      cursor = cursor.next as Record<string, unknown>;
    }
    expect(() => inferSchema(value, { maxDepth: 5 })).toThrow(/deeper/);
  });

  it("preserves or sorts property order deterministically", () => {
    const value = { zebra: 1, alpha: 2 };
    const preserved = rootObject(value);
    const sorted = inferSchema(value, {
      preservePropertyOrder: false,
    }).schema as ObjectSchemaNode;
    expect(preserved.properties.map((property) => property.jsonKey)).toEqual([
      "zebra",
      "alpha",
    ]);
    expect(sorted.properties.map((property) => property.jsonKey)).toEqual([
      "alpha",
      "zebra",
    ]);
  });
});
