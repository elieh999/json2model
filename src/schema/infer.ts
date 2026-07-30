import type {
  InferenceOptions,
  InferenceResult,
  ObjectSchemaNode,
  SchemaNode,
  SchemaProperty,
  SchemaWarning,
} from "./types";
import { Json2ModelError } from "./types";

export const DEFAULT_INFERENCE_OPTIONS: InferenceOptions = {
  detectDates: false,
  preservePropertyOrder: true,
  maxDepth: 80,
  maxNodes: 50_000,
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DATETIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i;

function schemaSignature(node: SchemaNode): string {
  switch (node.kind) {
    case "primitive":
      return `primitive:${node.type}`;
    case "unknown":
      return "unknown";
    case "array":
      return `array:${schemaSignature(node.element)}`;
    case "object":
      return `object:${node.properties
        .map(
          (property) =>
            `${property.jsonKey}:${property.optional ? "?" : ""}${schemaSignature(property.node)}`,
        )
        .join("|")}`;
    case "union":
      return `union:${node.variants.map(schemaSignature).sort().join("|")}`;
  }
}

function flattenVariants(nodes: readonly SchemaNode[]): readonly SchemaNode[] {
  const flattened = nodes.flatMap((node) =>
    node.kind === "union" ? node.variants : [node],
  );
  const unique = new Map<string, SchemaNode>();
  for (const node of flattened) {
    unique.set(schemaSignature(node), node);
  }
  return [...unique.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, node]) => node);
}

function mergeObjectNodes(
  objects: readonly ObjectSchemaNode[],
  preservePropertyOrder: boolean,
): ObjectSchemaNode {
  const propertyOrder: string[] = [];
  const propertyNodes = new Map<string, SchemaNode[]>();
  const propertyPresence = new Map<string, number>();

  for (const object of objects) {
    for (const property of object.properties) {
      if (!propertyNodes.has(property.jsonKey)) {
        propertyOrder.push(property.jsonKey);
        propertyNodes.set(property.jsonKey, []);
        propertyPresence.set(property.jsonKey, 0);
      }
      propertyNodes.get(property.jsonKey)?.push(property.node);
      propertyPresence.set(
        property.jsonKey,
        (propertyPresence.get(property.jsonKey) ?? 0) + 1,
      );
    }
  }

  const keys = preservePropertyOrder
    ? propertyOrder
    : [...propertyOrder].sort((left, right) => left.localeCompare(right));
  const properties: SchemaProperty[] = keys.map((jsonKey) => ({
    jsonKey,
    node: mergeNodes(propertyNodes.get(jsonKey) ?? [], preservePropertyOrder),
    optional: (propertyPresence.get(jsonKey) ?? 0) < objects.length,
  }));

  return { kind: "object", properties, empty: properties.length === 0 };
}

export function mergeNodes(
  nodes: readonly SchemaNode[],
  preservePropertyOrder = true,
): SchemaNode {
  if (nodes.length === 0) {
    return { kind: "unknown", reason: "No values were available to infer." };
  }

  const variants = flattenVariants(nodes);
  if (variants.length === 1) {
    return variants[0];
  }

  const nonNull = variants.filter(
    (node) => !(node.kind === "primitive" && node.type === "null"),
  );
  const nullNode = variants.find(
    (node) => node.kind === "primitive" && node.type === "null",
  );

  if (nonNull.length > 0 && nonNull.every((node) => node.kind === "object")) {
    const merged = mergeObjectNodes(
      nonNull as readonly ObjectSchemaNode[],
      preservePropertyOrder,
    );
    return nullNode ? { kind: "union", variants: [merged, nullNode] } : merged;
  }

  if (nonNull.every((node) => node.kind === "array")) {
    const arrays = nonNull.filter(
      (node): node is Extract<SchemaNode, { kind: "array" }> =>
        node.kind === "array",
    );
    const element = mergeNodes(
      arrays.map((array) => array.element),
      preservePropertyOrder,
    );
    const merged: SchemaNode = {
      kind: "array",
      element,
      empty: arrays.every((array) => array.empty),
    };
    return nullNode ? { kind: "union", variants: [merged, nullNode] } : merged;
  }

  const hasInteger = variants.some(
    (node) => node.kind === "primitive" && node.type === "integer",
  );
  const hasNumber = variants.some(
    (node) => node.kind === "primitive" && node.type === "number",
  );
  if (hasInteger && hasNumber) {
    const withoutInteger = variants.filter(
      (node) => !(node.kind === "primitive" && node.type === "integer"),
    );
    return withoutInteger.length === 1
      ? withoutInteger[0]
      : { kind: "union", variants: withoutInteger };
  }

  return { kind: "union", variants };
}

interface InferenceContext {
  readonly options: InferenceOptions;
  readonly warnings: SchemaWarning[];
  nodeCount: number;
}

function inferNode(
  value: unknown,
  path: string,
  depth: number,
  context: InferenceContext,
): SchemaNode {
  if (depth > context.options.maxDepth) {
    throw new Json2ModelError(
      "depth-limit",
      `JSON nesting is deeper than the supported limit of ${context.options.maxDepth} levels.`,
    );
  }

  context.nodeCount += 1;
  if (context.nodeCount > context.options.maxNodes) {
    throw new Json2ModelError(
      "node-limit",
      `JSON contains more than ${context.options.maxNodes.toLocaleString()} values and properties.`,
    );
  }

  if (value === null) {
    return { kind: "primitive", type: "null" };
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      context.warnings.push({
        code: "empty-array",
        path,
        message: `The array at ${path} is empty, so its element type could not be inferred.`,
      });
      return {
        kind: "array",
        element: {
          kind: "unknown",
          reason: "The source array was empty.",
        },
        empty: true,
      };
    }

    const inferred = value.map((item, index) =>
      inferNode(item, `${path}[${index}]`, depth + 1, context),
    );
    const element = mergeNodes(inferred, context.options.preservePropertyOrder);
    if (element.kind === "union") {
      context.warnings.push({
        code: "mixed-array",
        path,
        message: `The values in ${path} use different types. A safe union or fallback type was generated.`,
      });
    }
    return { kind: "array", element, empty: false };
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      context.warnings.push({
        code: "empty-object",
        path,
        message: `The object at ${path} is empty, so a generic object type was generated.`,
      });
    }
    const orderedEntries = context.options.preservePropertyOrder
      ? entries
      : [...entries].sort(([left], [right]) => left.localeCompare(right));
    return {
      kind: "object",
      empty: entries.length === 0,
      properties: orderedEntries.map(([jsonKey, propertyValue]) => ({
        jsonKey,
        optional: false,
        node: inferNode(
          propertyValue,
          `${path}.${jsonKey}`,
          depth + 1,
          context,
        ),
      })),
    };
  }

  if (typeof value === "string") {
    if (context.options.detectDates && DATE_PATTERN.test(value)) {
      return { kind: "primitive", type: "date" };
    }
    if (context.options.detectDates && DATETIME_PATTERN.test(value)) {
      return { kind: "primitive", type: "datetime" };
    }
    return { kind: "primitive", type: "string" };
  }

  if (typeof value === "number") {
    return {
      kind: "primitive",
      type: Number.isInteger(value) ? "integer" : "number",
    };
  }

  if (typeof value === "boolean") {
    return { kind: "primitive", type: "boolean" };
  }

  return {
    kind: "unknown",
    reason: `Unsupported JavaScript value of type ${typeof value}.`,
  };
}

export function inferSchema(
  value: unknown,
  options: Partial<InferenceOptions> = {},
): InferenceResult {
  const resolvedOptions = { ...DEFAULT_INFERENCE_OPTIONS, ...options };
  const context: InferenceContext = {
    options: resolvedOptions,
    warnings: [],
    nodeCount: 0,
  };
  return {
    schema: inferNode(value, "$", 0, context),
    warnings: context.warnings,
  };
}
