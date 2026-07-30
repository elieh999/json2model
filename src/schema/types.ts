export type PrimitiveType =
  | "string"
  | "integer"
  | "number"
  | "boolean"
  | "null"
  | "date"
  | "datetime";

export interface PrimitiveSchemaNode {
  readonly kind: "primitive";
  readonly type: PrimitiveType;
}

export interface UnknownSchemaNode {
  readonly kind: "unknown";
  readonly reason: string;
}

export interface ArraySchemaNode {
  readonly kind: "array";
  readonly element: SchemaNode;
  readonly empty: boolean;
}

export interface SchemaProperty {
  readonly jsonKey: string;
  readonly node: SchemaNode;
  readonly optional: boolean;
}

export interface ObjectSchemaNode {
  readonly kind: "object";
  readonly properties: readonly SchemaProperty[];
  readonly empty: boolean;
}

export interface UnionSchemaNode {
  readonly kind: "union";
  readonly variants: readonly SchemaNode[];
}

export type SchemaNode =
  | PrimitiveSchemaNode
  | UnknownSchemaNode
  | ArraySchemaNode
  | ObjectSchemaNode
  | UnionSchemaNode;

export interface SchemaWarning {
  readonly code:
    | "empty-array"
    | "empty-object"
    | "mixed-array"
    | "large-integer"
    | "unsafe-structure"
    | "renamed-typescript-key";
  readonly path: string;
  readonly message: string;
}

export interface InferenceResult {
  readonly schema: SchemaNode;
  readonly warnings: readonly SchemaWarning[];
}

export interface InferenceOptions {
  readonly detectDates: boolean;
  readonly preservePropertyOrder: boolean;
  readonly maxDepth: number;
  readonly maxNodes: number;
}

export interface ParsedJson {
  readonly value: unknown;
  readonly warnings: readonly SchemaWarning[];
}

export interface JsonErrorDetails {
  readonly message: string;
  readonly line: number | null;
  readonly column: number | null;
}

export type ParseResult =
  | { readonly ok: true; readonly parsed: ParsedJson }
  | { readonly ok: false; readonly error: JsonErrorDetails };

export class Json2ModelError extends Error {
  public readonly code: "input-too-large" | "depth-limit" | "node-limit";

  public constructor(
    code: "input-too-large" | "depth-limit" | "node-limit",
    message: string,
  ) {
    super(message);
    this.name = "Json2ModelError";
    this.code = code;
  }
}
