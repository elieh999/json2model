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
 * Tracks what the emitted code actually references so the import block contains
 * exactly what is used. Ruff rejects an unused import, so guessing is not safe.
 */
interface Usage {
  optional: boolean;
  union: boolean;
  any: boolean;
  date: boolean;
  datetime: boolean;
  field: boolean;
  configDict: boolean;
  baseModel: boolean;
  rootModel: boolean;
}

function pythonType(
  node: SchemaNode,
  registry: ModelRegistry,
  options: GeneratorOptions,
  usage: Usage,
): string {
  const parts = nullableParts(node);
  if (parts.nullable) {
    const base = pythonType(parts.node, registry, options, usage);
    if (options.python.modernUnions) {
      return `${base} | None`;
    }
    usage.optional = true;
    return `Optional[${base}]`;
  }

  switch (node.kind) {
    case "primitive":
      switch (node.type) {
        case "string":
          return "str";
        case "integer":
          return "int";
        case "number":
          return "float";
        case "boolean":
          return "bool";
        case "null":
          return "None";
        case "date":
          usage.date = true;
          return "date";
        case "datetime":
          usage.datetime = true;
          return "datetime";
      }
    case "unknown":
      if (options.unknownType === "dynamic") {
        usage.any = true;
        return "Any";
      }
      return "object";
    case "object":
      return node.empty ? "dict[str, object]" : registry.modelName(node);
    case "array":
      return `list[${pythonType(node.element, registry, options, usage)}]`;
    case "union": {
      const variants = node.variants.map((variant) =>
        pythonType(variant, registry, options, usage),
      );
      if (options.python.modernUnions) {
        return variants.join(" | ");
      }
      usage.union = true;
      return `Union[${variants.join(", ")}]`;
    }
  }
}

function propertyType(
  property: SchemaProperty,
  registry: ModelRegistry,
  options: GeneratorOptions,
  usage: Usage,
): string {
  const type = pythonType(property.node, registry, options, usage);
  if (!property.optional || type.includes("None")) {
    return type;
  }
  if (options.python.modernUnions) {
    return `${type} | None`;
  }
  usage.optional = true;
  return `Optional[${type}]`;
}

function fieldAssignment(
  property: SchemaProperty,
  field: PlannedField,
  options: GeneratorOptions,
  usage: Usage,
): string {
  const needsAlias = options.python.useAliases && field.name !== field.jsonKey;
  if (needsAlias) {
    usage.field = true;
    const defaultArgument = property.optional ? "default=None, " : "";
    const alias = quoteString(field.jsonKey, '"');
    return ` = Field(${defaultArgument}alias=${alias})`;
  }
  return property.optional ? " = None" : "";
}

function modelCode(
  name: string,
  node: ObjectSchemaNode,
  fields: readonly PlannedField[],
  registry: ModelRegistry,
  options: GeneratorOptions,
  usage: Usage,
): string {
  usage.baseModel = true;
  const lines: string[] = [`class ${name}(BaseModel):`];
  if (options.includeComments) {
    lines.push(`    """Model inferred from the JSON object for ${name}."""`);
  }

  const needsConfig =
    options.python.useAliases &&
    options.python.populateByName &&
    fields.some((field) => field.name !== field.jsonKey);
  if (needsConfig) {
    usage.configDict = true;
    lines.push("    model_config = ConfigDict(populate_by_name=True)");
  }

  node.properties.forEach((property, index) => {
    const field = fields[index];
    if (!field) {
      return;
    }
    const type = propertyType(property, registry, options, usage);
    const assignment = fieldAssignment(property, field, options, usage);
    lines.push(`    ${field.name}: ${type}${assignment}`);
  });

  if (node.properties.length === 0) {
    lines.push("    pass");
  }
  return lines.join("\n");
}

/**
 * Builds a JSON document that matches the inferred schema, so the optional
 * example block parses instead of raising a validation error.
 */
function sampleValue(node: SchemaNode): unknown {
  const parts = nullableParts(node);
  const resolved = parts.node;
  switch (resolved.kind) {
    case "primitive":
      switch (resolved.type) {
        case "string":
          return "text";
        case "integer":
          return 1;
        case "number":
          return 1.5;
        case "boolean":
          return true;
        case "date":
          return "2026-01-01";
        case "datetime":
          return "2026-01-01T00:00:00Z";
        case "null":
          return null;
      }
    case "unknown":
      return null;
    case "object": {
      const sample: Record<string, unknown> = {};
      for (const property of resolved.properties) {
        if (!property.optional) {
          sample[property.jsonKey] = sampleValue(property.node);
        }
      }
      return sample;
    }
    case "array":
      return resolved.empty ? [] : [sampleValue(resolved.element)];
    case "union": {
      const [first] = resolved.variants;
      return first ? sampleValue(first) : null;
    }
  }
}

/**
 * Builds the import block in the grouping Ruff expects: `__future__`, then the
 * standard library, then third party packages, each group separated by a blank
 * line and each import list sorted.
 */
function importLines(usage: Usage, rootModelAlias: string | null): string {
  const standardLibrary: string[] = [];

  const datetimeImports: string[] = [];
  if (usage.date) {
    datetimeImports.push("date");
  }
  if (usage.datetime) {
    datetimeImports.push("datetime");
  }
  if (datetimeImports.length > 0) {
    standardLibrary.push(`from datetime import ${datetimeImports.join(", ")}`);
  }

  const typingImports: string[] = [];
  if (usage.any) {
    typingImports.push("Any");
  }
  if (usage.optional) {
    typingImports.push("Optional");
  }
  if (usage.union) {
    typingImports.push("Union");
  }
  if (typingImports.length > 0) {
    standardLibrary.push(
      `from typing import ${typingImports.sort().join(", ")}`,
    );
  }

  const pydanticImports: string[] = [];
  if (usage.baseModel) {
    pydanticImports.push("BaseModel");
  }
  if (usage.configDict) {
    pydanticImports.push("ConfigDict");
  }
  if (usage.field) {
    pydanticImports.push("Field");
  }
  pydanticImports.sort();
  if (usage.rootModel) {
    // The generated root class can also be called RootModel, so the Pydantic
    // base is imported under a different name when they would collide.
    pydanticImports.push(
      rootModelAlias ? `RootModel as ${rootModelAlias}` : "RootModel",
    );
  }

  const groups = [["from __future__ import annotations"]];
  if (standardLibrary.length > 0) {
    groups.push(standardLibrary);
  }
  if (pydanticImports.length > 0) {
    groups.push([`from pydantic import ${pydanticImports.join(", ")}`]);
  }
  // One blank line between import groups, which is what isort and Ruff expect.
  return groups.map((group) => group.join("\n")).join("\n\n");
}

export function generatePython(
  schema: SchemaNode,
  options: GeneratorOptions,
  sourceWarnings: readonly SchemaWarning[] = [],
): GenerationResult {
  const registry = createModelRegistry(schema, options.rootName, "python");
  const rootName = safeClassName(options.rootName, "python", "RootModel");
  const warnings: SchemaWarning[] = [...sourceWarnings];
  const usage: Usage = {
    optional: false,
    union: false,
    any: false,
    date: false,
    datetime: false,
    field: false,
    configDict: false,
    baseModel: false,
    rootModel: false,
  };

  // Children are declared before the models that reference them. Registration is
  // depth first from the root, so reversing puts every model after its own
  // descendants.
  const declarations: string[] = [];
  for (const model of [...registry.models].reverse()) {
    const fields = planFields(model.node.properties, "python");
    for (const field of fields) {
      if (field.invented || field.renamed) {
        warnings.push({
          code: "generated-identifier",
          path: `${model.path}.${field.jsonKey}`,
          message: `The key "${field.jsonKey}" cannot be used directly as a field in ${model.name}, so it is named ${field.name} with an alias for the original key.`,
        });
      }
    }
    declarations.push(
      modelCode(model.name, model.node, fields, registry, options, usage),
    );
  }

  let rootDeclaration: string | null = null;
  if (!registry.rootObjectName) {
    usage.rootModel = true;
    const rootModelAlias =
      rootName === "RootModel" ? "PydanticRootModel" : "RootModel";
    const rootType = pythonType(schema, registry, options, usage);
    rootDeclaration = [
      `class ${rootName}(${rootModelAlias}[${rootType}]):`,
      "    pass",
    ].join("\n");
  }

  const rootModelAlias =
    usage.rootModel && rootName === "RootModel" ? "PydanticRootModel" : null;

  const blocks = [importLines(usage, rootModelAlias)];
  blocks.push(...declarations);
  if (rootDeclaration) {
    blocks.push(rootDeclaration);
  }

  if (options.python.includeExample) {
    const example = quoteString(JSON.stringify(sampleValue(schema)), "'");
    blocks.push(
      [
        'if __name__ == "__main__":',
        `    payload = ${example}`,
        `    model = ${rootName}.model_validate_json(payload)`,
        "    print(model.model_dump(by_alias=True))",
      ].join("\n"),
    );
  }

  return {
    // Two blank lines between top level declarations is the layout Ruff expects.
    code: `${blocks.join("\n\n\n")}\n`,
    modelCount: registry.models.length,
    warnings,
    extension: "py",
  };
}
