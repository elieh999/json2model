import {
  isValidIdentifier,
  quoteString,
  safePropertyName,
  toPascalCase,
} from "@/src/naming/naming";
import type {
  ObjectSchemaNode,
  SchemaNode,
  SchemaWarning,
} from "@/src/schema/types";
import { createModelRegistry, type ModelRegistry } from "../modelRegistry";
import type { GenerationResult, GeneratorOptions } from "../types";

function terminator(options: GeneratorOptions): string {
  return options.typescript.semicolons ? ";" : "";
}

function typescriptType(
  node: SchemaNode,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  switch (node.kind) {
    case "primitive":
      switch (node.type) {
        case "string":
        case "date":
        case "datetime":
          return "string";
        case "integer":
        case "number":
          return "number";
        case "boolean":
          return "boolean";
        case "null":
          return "null";
      }
    case "unknown":
      return options.unknownType === "dynamic" ? "any" : "unknown";
    case "object":
      return node.empty
        ? `Record<string, ${options.unknownType === "dynamic" ? "any" : "unknown"}>`
        : registry.modelName(node);
    case "array": {
      const elementType = typescriptType(node.element, registry, options);
      return elementType.includes(" | ")
        ? `Array<${elementType}>`
        : `${elementType}[]`;
    }
    case "union":
      return node.variants
        .map((variant) => typescriptType(variant, registry, options))
        .filter((type, index, types) => types.indexOf(type) === index)
        .join(" | ");
  }
}

function propertyName(jsonKey: string, options: GeneratorOptions): string {
  if (options.convertPropertyNames) {
    return safePropertyName(jsonKey, "typescript");
  }
  return isValidIdentifier(jsonKey, "typescript")
    ? jsonKey
    : quoteString(jsonKey, '"');
}

function modelCode(
  name: string,
  node: ObjectSchemaNode,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const exportKeyword = options.typescript.exportDeclarations ? "export " : "";
  const readonlyKeyword = options.typescript.readonlyProperties
    ? "readonly "
    : "";
  const lines: string[] = [];

  if (options.includeComments) {
    lines.push(`/** Model inferred from the JSON object for ${name}. */`);
  }

  if (options.typescript.declarationMode === "interface") {
    lines.push(`${exportKeyword}interface ${name} {`);
    for (const property of node.properties) {
      lines.push(
        `  ${readonlyKeyword}${propertyName(property.jsonKey, options)}${property.optional ? "?" : ""}: ${typescriptType(property.node, registry, options)}${terminator(options)}`,
      );
    }
    lines.push("}");
  } else {
    lines.push(`${exportKeyword}type ${name} = {`);
    for (const property of node.properties) {
      lines.push(
        `  ${readonlyKeyword}${propertyName(property.jsonKey, options)}${property.optional ? "?" : ""}: ${typescriptType(property.node, registry, options)}${terminator(options)}`,
      );
    }
    lines.push(`}${terminator(options)}`);
  }

  return lines.join("\n");
}

export function generateTypeScript(
  schema: SchemaNode,
  options: GeneratorOptions,
  sourceWarnings: readonly SchemaWarning[] = [],
): GenerationResult {
  const registry = createModelRegistry(schema, options.rootName);
  const rootName = toPascalCase(options.rootName, "RootModel");
  const codeParts = registry.models.map((model) =>
    modelCode(model.name, model.node, registry, options),
  );
  const warnings = [...sourceWarnings];

  if (options.convertPropertyNames) {
    warnings.push({
      code: "renamed-typescript-key",
      path: "$",
      message:
        "TypeScript property names were converted for readability. Types do not rename keys at runtime, so map incoming JSON before using the generated type.",
    });
  }

  if (!registry.rootObjectName) {
    const exportKeyword = options.typescript.exportDeclarations
      ? "export "
      : "";
    codeParts.push(
      `${exportKeyword}type ${rootName} = ${typescriptType(schema, registry, options)}${terminator(options)}`,
    );
  }

  return {
    code: `${codeParts.join("\n\n")}\n`,
    modelCount: registry.models.length,
    warnings,
    extension: "ts",
  };
}
