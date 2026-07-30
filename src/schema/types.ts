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

export type SchemaWarningCode =
  | "empty-array"
  | "empty-object"
  | "mixed-array"
  | "large-integer"
  | "unsafe-structure"
  | "renamed-typescript-key"
  | "generated-identifier"
  | "dropped-union-shape";

export interface SchemaWarning {
  readonly code: SchemaWarningCode;
  readonly path: string;
  readonly message: string;
  /**
   * How many places produced this warning. Inference reports one entry per
   * distinct reason rather than one per visited value, so a 5,000 element array
   * with the same empty field does not produce 5,000 identical lines.
   */
  readonly occurrences?: number;
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
  /** Distinguishes a size refusal from a syntax problem. */
  readonly code?: "syntax" | "input-too-large";
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
