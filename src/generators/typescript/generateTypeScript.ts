import {
  isValidIdentifier,
  quoteString,
  safeClassName,
} from "@/src/naming/naming";
import type {
  ObjectSchemaNode,
  SchemaNode,
  SchemaWarning,
} from "@/src/schema/types";
import { createModelRegistry, type ModelRegistry } from "../modelRegistry";
import { planFields, type PlannedField } from "../shared";
import type { GenerationResult, GeneratorOptions } from "../types";

function terminator(options: GeneratorOptions): string {
  return options.typescript.semicolons ? ";" : "";
}

function unknownName(options: GeneratorOptions): "any" | "unknown" {
  return options.unknownType === "dynamic" ? "any" : "unknown";
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
          // JSON has no date literal, so a date shaped value stays a string.
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
      return unknownName(options);
    case "object":
      return node.empty
        ? `Record<string, ${unknownName(options)}>`
        : registry.modelName(node);
    case "array": {
      const elementType = typescriptType(node.element, registry, options);
      return elementType.includes(" | ")
        ? `Array<${elementType}>`
        : `${elementType}[]`;
    }
    case "union": {
      const seen = new Set<string>();
      for (const variant of node.variants) {
        seen.add(typescriptType(variant, registry, options));
      }
      return [...seen].join(" | ");
    }
  }
}

/**
 * A TypeScript declaration cannot rename a key at runtime, so the original key is
 * used verbatim by default and quoted when it is not an identifier.
 */
function declaredKey(
  jsonKey: string,
  field: PlannedField | undefined,
  options: GeneratorOptions,
): string {
  if (options.convertPropertyNames && field) {
    return field.name;
  }
  return isValidIdentifier(jsonKey, "typescript")
    ? jsonKey
    : quoteString(jsonKey, '"');
}

function modelCode(
  name: string,
  node: ObjectSchemaNode,
  fields: readonly PlannedField[],
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const exportKeyword = options.typescript.exportDeclarations ? "export " : "";
  const readonlyKeyword = options.typescript.readonlyProperties
    ? "readonly "
    : "";
  const isInterface = options.typescript.declarationMode === "interface";
  const lines: string[] = [];

  if (options.includeComments) {
    lines.push(`/** Model inferred from the JSON object for ${name}. */`);
  }
  lines.push(
    isInterface
      ? `${exportKeyword}interface ${name} {`
      : `${exportKeyword}type ${name} = {`,
  );

  node.properties.forEach((property, index) => {
    const key = declaredKey(property.jsonKey, fields[index], options);
    const optional = property.optional ? "?" : "";
    const type = typescriptType(property.node, registry, options);
    lines.push(
      `  ${readonlyKeyword}${key}${optional}: ${type}${terminator(options)}`,
    );
  });

  lines.push(isInterface ? "}" : `}${terminator(options)}`);
  return lines.join("\n");
}

export function generateTypeScript(
  schema: SchemaNode,
  options: GeneratorOptions,
  sourceWarnings: readonly SchemaWarning[] = [],
): GenerationResult {
  const registry = createModelRegistry(schema, options.rootName, "typescript");
  const rootName = safeClassName(options.rootName, "typescript", "RootModel");
  const warnings: SchemaWarning[] = [...sourceWarnings];
  let renamedAnyKey = false;

  const codeParts = registry.models.map((model) => {
    const fields = planFields(model.node.properties, "typescript");
    if (options.convertPropertyNames) {
      for (const field of fields) {
        if (field.name !== field.jsonKey) {
          renamedAnyKey = true;
        }
        if (field.renamed || field.invented) {
          warnings.push({
            code: "generated-identifier",
            path: `${model.path}.${field.jsonKey}`,
            message: `The key "${field.jsonKey}" competes with another property in ${model.name}, so the declared name is ${field.name}.`,
          });
        }
      }
    }
    return modelCode(model.name, model.node, fields, registry, options);
  });

  // Only warn when a key really changed. Converting names is harmless when every
  // key is already a valid camelCase identifier.
  if (options.convertPropertyNames && renamedAnyKey) {
    warnings.push({
      code: "renamed-typescript-key",
      path: "$",
      message:
        "Property names were converted for readability. A TypeScript type does not rename keys at runtime, so map the incoming JSON before using the generated type.",
    });
  }

  if (!registry.rootObjectName) {
    const exportKeyword = options.typescript.exportDeclarations
      ? "export "
      : "";
    const rootType = typescriptType(schema, registry, options);
    codeParts.push(
      `${exportKeyword}type ${rootName} = ${rootType}${terminator(options)}`,
    );
  }

  return {
    code: `${codeParts.join("\n\n")}\n`,
    modelCount: registry.models.length,
    warnings,
    extension: "ts",
  };
}
