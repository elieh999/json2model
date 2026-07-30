import {
  propertyNameFor,
  uniqueName,
  type Language,
} from "@/src/naming/naming";
import type { SchemaNode, SchemaProperty } from "@/src/schema/types";

export function nullableParts(node: SchemaNode): {
  readonly nullable: boolean;
  readonly node: SchemaNode;
} {
  if (node.kind !== "union") {
    return { nullable: false, node };
  }
  const nonNull = node.variants.filter(
    (variant) => !(variant.kind === "primitive" && variant.type === "null"),
  );
  if (nonNull.length === node.variants.length) {
    return { nullable: false, node };
  }
  const [only] = nonNull;
  if (!only) {
    return {
      nullable: true,
      node: { kind: "unknown", reason: "Only null values were observed." },
    };
  }
  return {
    nullable: true,
    node: nonNull.length === 1 ? only : { kind: "union", variants: nonNull },
  };
}

/** A JSON key paired with the member name a generator will use for it. */
export interface PlannedField {
  readonly jsonKey: string;
  readonly name: string;
  /** The key could not be expressed as an identifier, so a name was invented. */
  readonly invented: boolean;
  /** The preferred name was taken, so a numeric suffix was added. */
  readonly renamed: boolean;
}

/**
 * Chooses one legal member name per property.
 *
 * Two different JSON keys can reduce to the same identifier ("first-name" and
 * "first_name" both want `firstName`), and some keys cannot be identifiers at
 * all. Both cases are resolved here, once, so every generator stays consistent
 * and no key is silently dropped.
 *
 * `reservedMembers` holds names the surrounding declaration already uses, such
 * as a Dart class name and its `toJson` and `fromJson` members.
 */
export function planFields(
  properties: readonly SchemaProperty[],
  language: Language,
  reservedMembers: readonly string[] = [],
): readonly PlannedField[] {
  const used = new Set<string>(reservedMembers);
  return properties.map((property) => {
    const preferred = propertyNameFor(property.jsonKey, language);
    const name = uniqueName(preferred ?? "field", used);
    return {
      jsonKey: property.jsonKey,
      name,
      invented: preferred === null,
      renamed: preferred !== null && name !== preferred,
    };
  });
}

export function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length > 0 ? `${prefix}${line}` : line))
    .join("\n");
}
