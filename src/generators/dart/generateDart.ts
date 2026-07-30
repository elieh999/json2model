import {
  quoteString,
  safePropertyName,
  toPascalCase,
} from "@/src/naming/naming";
import type {
  ObjectSchemaNode,
  SchemaNode,
  SchemaProperty,
  SchemaWarning,
} from "@/src/schema/types";
import { createModelRegistry, type ModelRegistry } from "../modelRegistry";
import { nullableParts } from "../shared";
import type { GenerationResult, GeneratorOptions } from "../types";

function unknownType(options: GeneratorOptions): "dynamic" | "Object?" {
  return options.unknownType === "dynamic" ? "dynamic" : "Object?";
}

function dartType(
  node: SchemaNode,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const nullable = nullableParts(node);
  if (nullable.nullable) {
    const base = dartType(nullable.node, registry, options);
    return base === "dynamic" || base.endsWith("?") ? base : `${base}?`;
  }

  switch (node.kind) {
    case "primitive":
      switch (node.type) {
        case "string":
          return "String";
        case "integer":
          return "int";
        case "number":
          return "double";
        case "boolean":
          return "bool";
        case "date":
        case "datetime":
          return "DateTime";
        case "null":
          return "Object?";
      }
    case "unknown":
      return unknownType(options);
    case "object":
      return node.empty ? "Map<String, Object?>" : registry.modelName(node);
    case "array":
      return `List<${dartType(node.element, registry, options)}>`;
    case "union":
      return unknownType(options);
  }
}

function requiredType(
  property: SchemaProperty,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const type = dartType(property.node, registry, options);
  if (property.optional && type !== "dynamic" && !type.endsWith("?")) {
    return `${type}?`;
  }
  return type;
}

function decodeNonNull(
  node: SchemaNode,
  access: string,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  switch (node.kind) {
    case "primitive":
      switch (node.type) {
        case "string":
          return `${access} as String`;
        case "integer":
          return `${access} as int`;
        case "number":
          return `(${access} as num).toDouble()`;
        case "boolean":
          return `${access} as bool`;
        case "date":
        case "datetime":
          return `DateTime.parse(${access} as String)`;
        case "null":
          return "null";
      }
    case "unknown":
      return access;
    case "object":
      if (node.empty) {
        return `Map<String, Object?>.from(${access} as Map)`;
      }
      return `${registry.modelName(node)}.fromJson(${access} as Map<String, dynamic>)`;
    case "array": {
      const item = decodeValue(node.element, "item", registry, options, false);
      return `(${access} as List<dynamic>).map((item) => ${item}).toList()`;
    }
    case "union":
      return access;
  }
}

function decodeValue(
  node: SchemaNode,
  access: string,
  registry: ModelRegistry,
  options: GeneratorOptions,
  forceNullable: boolean,
): string {
  const parts = nullableParts(node);
  if (parts.nullable || forceNullable) {
    return `${access} == null ? null : ${decodeNonNull(parts.node, `${access}!`, registry, options)}`;
  }
  return decodeNonNull(node, access, registry, options);
}

function encodeNonNull(
  node: SchemaNode,
  field: string,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const parts = nullableParts(node);
  const resolved = parts.node;
  switch (resolved.kind) {
    case "primitive":
      return resolved.type === "date" || resolved.type === "datetime"
        ? `${field}.toIso8601String()`
        : field;
    case "object":
      return resolved.empty ? field : `${field}.toJson()`;
    case "array": {
      const itemExpression = encodeValue(
        resolved.element,
        "item",
        registry,
        options,
        false,
      );
      return itemExpression === "item"
        ? field
        : `${field}.map((item) => ${itemExpression}).toList()`;
    }
    case "unknown":
    case "union":
      return field;
  }
}

function encodeValue(
  node: SchemaNode,
  field: string,
  registry: ModelRegistry,
  options: GeneratorOptions,
  forceNullable: boolean,
): string {
  const parts = nullableParts(node);
  if (parts.nullable || forceNullable) {
    const encoded = encodeNonNull(parts.node, `${field}!`, registry, options);
    return `${field} == null ? null : ${encoded}`;
  }
  return encodeNonNull(node, field, registry, options);
}

function modelCode(
  name: string,
  node: ObjectSchemaNode,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const lines: string[] = [];
  if (options.includeComments) {
    lines.push(`/// Model inferred from the JSON object for ${name}.`);
  }
  lines.push(`class ${name} {`);

  if (options.dart.constConstructors) {
    lines.push(`  const ${name}({`);
  } else {
    lines.push(`  ${name}({`);
  }
  for (const property of node.properties) {
    const fieldName = safePropertyName(property.jsonKey, "dart");
    lines.push(
      property.optional
        ? `    this.${fieldName},`
        : `    required this.${fieldName},`,
    );
  }
  lines.push("  });", "");

  for (const property of node.properties) {
    const fieldName = safePropertyName(property.jsonKey, "dart");
    lines.push(
      `  final ${requiredType(property, registry, options)} ${fieldName};`,
    );
  }

  if (options.dart.includeFromJson) {
    lines.push(
      "",
      `  factory ${name}.fromJson(Map<String, dynamic> json) {`,
      `    return ${name}(`,
    );
    for (const property of node.properties) {
      const fieldName = safePropertyName(property.jsonKey, "dart");
      const access = `json[${quoteString(property.jsonKey)}]`;
      lines.push(
        `      ${fieldName}: ${decodeValue(
          property.node,
          access,
          registry,
          options,
          property.optional,
        )},`,
      );
    }
    lines.push("    );", "  }");
  }

  if (options.dart.includeToJson) {
    lines.push("", "  Map<String, dynamic> toJson() {", "    return {");
    for (const property of node.properties) {
      const fieldName = safePropertyName(property.jsonKey, "dart");
      lines.push(
        `      ${quoteString(property.jsonKey)}: ${encodeValue(
          property.node,
          fieldName,
          registry,
          options,
          property.optional,
        )},`,
      );
    }
    lines.push("    };", "  }");
  }

  lines.push("}");
  return lines.join("\n");
}

export function generateDart(
  schema: SchemaNode,
  options: GeneratorOptions,
  sourceWarnings: readonly SchemaWarning[] = [],
): GenerationResult {
  const registry = createModelRegistry(schema, options.rootName);
  const rootTypeName = toPascalCase(options.rootName, "RootModel");
  const parts = registry.models.map((model) =>
    modelCode(model.name, model.node, registry, options),
  );

  if (!registry.rootObjectName) {
    parts.push(
      `typedef ${rootTypeName} = ${dartType(schema, registry, options)};`,
    );
  }

  return {
    code: `${parts.join("\n\n")}\n`,
    modelCount: registry.models.length,
    warnings: sourceWarnings,
    extension: "dart",
  };
}
