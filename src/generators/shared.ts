import type { SchemaNode } from "@/src/schema/types";

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
  if (nonNull.length === 0) {
    return {
      nullable: true,
      node: { kind: "unknown", reason: "Only null values were observed." },
    };
  }
  return {
    nullable: true,
    node:
      nonNull.length === 1 ? nonNull[0] : { kind: "union", variants: nonNull },
  };
}

export function indent(value: string, spaces: number): string {
  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => (line.length > 0 ? `${prefix}${line}` : line))
    .join("\n");
}
