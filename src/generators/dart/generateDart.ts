import { quoteString, safeClassName } from "@/src/naming/naming";
import type {
  ObjectSchemaNode,
  SchemaNode,
  SchemaProperty,
  SchemaWarning,
} from "@/src/schema/types";
import { createModelRegistry, type ModelRegistry } from "../modelRegistry";
import { nullableParts, planFields, type PlannedField } from "../shared";
import type { GenerationResult, GeneratorOptions } from "../types";

/**
 * Members every generated class already has. A JSON key that reduces to one of
 * these would collide with the class itself, with `Object`, or with the
 * serialization members, so the field is renamed. The original key is still used
 * for reading and writing JSON.
 */
const OBJECT_MEMBERS = [
  "fromJson",
  "hashCode",
  "noSuchMethod",
  "runtimeType",
  "toJson",
  "toString",
];

function unknownType(options: GeneratorOptions): "dynamic" | "Object?" {
  return options.unknownType === "dynamic" ? "dynamic" : "Object?";
}

function dartKey(jsonKey: string): string {
  // Dart interpolates `$` inside string literals, so `json['$id']` would not
  // compile without escaping it.
  return quoteString(jsonKey, "'", { escapeDollar: true });
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
      // Dart has no untagged union type, so the value keeps a dynamic type.
      return unknownType(options);
  }
}

function fieldType(
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

function loopVariable(depth: number): string {
  return depth === 0 ? "item" : `item${depth + 1}`;
}

function decodeNonNull(
  node: SchemaNode,
  access: string,
  registry: ModelRegistry,
  options: GeneratorOptions,
  depth: number,
): string {
  switch (node.kind) {
    case "primitive":
      switch (node.type) {
        case "string":
          return `${access} as String`;
        case "integer":
          return `${access} as int`;
        case "number":
          // A JSON whole number decodes to `int`, so widen it explicitly.
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
    case "union":
      return access;
    case "object":
      if (node.empty) {
        return `Map<String, Object?>.from(${access} as Map)`;
      }
      return `${registry.modelName(node)}.fromJson(${access} as Map<String, dynamic>)`;
    case "array": {
      // Nested lists need distinct loop variables so an inner closure does not
      // shadow the outer one.
      const variable = loopVariable(depth);
      const element = decodeValue(
        node.element,
        variable,
        registry,
        options,
        false,
        depth + 1,
      );
      if (element === variable) {
        const elementType = dartType(node.element, registry, options);
        return `List<${elementType}>.from(${access} as List<dynamic>)`;
      }
      return `(${access} as List<dynamic>).map((${variable}) => ${element}).toList()`;
    }
  }
}

function decodeValue(
  node: SchemaNode,
  access: string,
  registry: ModelRegistry,
  options: GeneratorOptions,
  forceNullable: boolean,
  depth = 0,
): string {
  const parts = nullableParts(node);
  if (parts.nullable || forceNullable) {
    // A dynamic value needs no conversion, so a null check around it would only
    // add an assertion the analyzer flags as pointless.
    if (
      decodeNonNull(parts.node, access, registry, options, depth) === access
    ) {
      return access;
    }
    const decoded = decodeNonNull(
      parts.node,
      `${access}!`,
      registry,
      options,
      depth,
    );
    return `${access} == null ? null : ${decoded}`;
  }
  return decodeNonNull(node, access, registry, options, depth);
}

function encodeNonNull(
  node: SchemaNode,
  field: string,
  registry: ModelRegistry,
  options: GeneratorOptions,
  depth: number,
): string {
  const resolved = nullableParts(node).node;
  switch (resolved.kind) {
    case "primitive":
      return resolved.type === "date" || resolved.type === "datetime"
        ? `${field}.toIso8601String()`
        : field;
    case "object":
      return resolved.empty ? field : `${field}.toJson()`;
    case "array": {
      const variable = loopVariable(depth);
      const element = encodeValue(
        resolved.element,
        variable,
        registry,
        options,
        false,
        depth + 1,
      );
      return element === variable
        ? field
        : `${field}.map((${variable}) => ${element}).toList()`;
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
  depth = 0,
): string {
  const parts = nullableParts(node);
  if (parts.nullable || forceNullable) {
    if (encodeNonNull(parts.node, field, registry, options, depth) === field) {
      return field;
    }
    const encoded = encodeNonNull(
      parts.node,
      `${field}!`,
      registry,
      options,
      depth,
    );
    return `${field} == null ? null : ${encoded}`;
  }
  return encodeNonNull(node, field, registry, options, depth);
}

function modelCode(
  name: string,
  node: ObjectSchemaNode,
  fields: readonly PlannedField[],
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const entries = node.properties.flatMap((property, index) => {
    const field = fields[index];
    return field ? [{ property, field }] : [];
  });

  const lines: string[] = [];
  if (options.includeComments) {
    lines.push(`/// Model inferred from the JSON object for ${name}.`);
  }
  lines.push(`class ${name} {`);
  lines.push(
    options.dart.constConstructors ? `  const ${name}({` : `  ${name}({`,
  );

  for (const { property, field } of entries) {
    lines.push(
      property.optional
        ? `    this.${field.name},`
        : `    required this.${field.name},`,
    );
  }
  lines.push("  });", "");

  for (const { property, field } of entries) {
    lines.push(
      `  final ${fieldType(property, registry, options)} ${field.name};`,
    );
  }

  if (options.dart.includeFromJson) {
    lines.push(
      "",
      `  factory ${name}.fromJson(Map<String, dynamic> json) {`,
      `    return ${name}(`,
    );
    for (const { property, field } of entries) {
      const decoded = decodeValue(
        property.node,
        `json[${dartKey(property.jsonKey)}]`,
        registry,
        options,
        property.optional,
      );
      lines.push(`      ${field.name}: ${decoded},`);
    }
    lines.push("    );", "  }");
  }

  if (options.dart.includeToJson) {
    lines.push("", "  Map<String, dynamic> toJson() {", "    return {");
    for (const { property, field } of entries) {
      const encoded = encodeValue(
        property.node,
        field.name,
        registry,
        options,
        property.optional,
      );
      lines.push(`      ${dartKey(property.jsonKey)}: ${encoded},`);
    }
    lines.push("    };", "  }");
  }

  lines.push("}");
  return lines.join("\n");
}

/**
 * Collects the models the emitted Dart types actually name.
 *
 * A union that mixes an object with another type becomes a dynamic value, so an
 * object inside it is unreachable and must not be declared.
 */
function collectReferences(
  node: SchemaNode,
  registry: ModelRegistry,
  referenced: Set<string>,
  dropped: Set<string>,
): void {
  const resolved = nullableParts(node).node;
  switch (resolved.kind) {
    case "object": {
      if (resolved.empty) {
        return;
      }
      const name = registry.modelName(resolved);
      if (referenced.has(name)) {
        return;
      }
      referenced.add(name);
      for (const property of resolved.properties) {
        collectReferences(property.node, registry, referenced, dropped);
      }
      return;
    }
    case "array":
      collectReferences(resolved.element, registry, referenced, dropped);
      return;
    case "union":
      for (const variant of resolved.variants) {
        if (variant.kind === "object" && !variant.empty) {
          dropped.add(registry.modelName(variant));
        }
      }
      return;
    case "primitive":
    case "unknown":
      return;
  }
}

function identifierWarnings(
  modelName: string,
  modelPath: string,
  fields: readonly PlannedField[],
): SchemaWarning[] {
  return fields.flatMap((field) => {
    if (field.invented) {
      return [
        {
          code: "generated-identifier" as const,
          path: `${modelPath}.${field.jsonKey}`,
          message: `The key "${field.jsonKey}" cannot become a Dart identifier, so the field is named ${field.name}. Reading and writing JSON still uses the original key.`,
        },
      ];
    }
    if (field.renamed) {
      return [
        {
          code: "generated-identifier" as const,
          path: `${modelPath}.${field.jsonKey}`,
          message: `The key "${field.jsonKey}" competes with another field in ${modelName}, so it is named ${field.name}. Reading and writing JSON still uses the original key.`,
        },
      ];
    }
    return [];
  });
}

export function generateDart(
  schema: SchemaNode,
  options: GeneratorOptions,
  sourceWarnings: readonly SchemaWarning[] = [],
): GenerationResult {
  const registry = createModelRegistry(schema, options.rootName, "dart");
  const rootTypeName = safeClassName(options.rootName, "dart", "RootModel");
  const warnings: SchemaWarning[] = [...sourceWarnings];

  const referenced = new Set<string>();
  const dropped = new Set<string>();
  collectReferences(schema, registry, referenced, dropped);
  const models = registry.models.filter((model) => referenced.has(model.name));

  for (const model of registry.models) {
    if (!referenced.has(model.name) && dropped.has(model.name)) {
      warnings.push({
        code: "dropped-union-shape",
        path: model.path,
        message: `The value at ${model.path} is sometimes an object and sometimes another type. Dart cannot express that union, so the value uses ${unknownType(options)} and no class was generated for it.`,
      });
    }
  }

  const parts = models.map((model) => {
    const fields = planFields(model.node.properties, "dart", [
      model.name,
      ...OBJECT_MEMBERS,
    ]);
    warnings.push(...identifierWarnings(model.name, model.path, fields));
    return modelCode(model.name, model.node, fields, registry, options);
  });

  if (!registry.rootObjectName) {
    parts.push(
      `typedef ${rootTypeName} = ${dartType(schema, registry, options)};`,
    );
  }

  return {
    code: `${parts.join("\n\n")}\n`,
    modelCount: models.length,
    warnings,
    extension: "dart",
  };
}
