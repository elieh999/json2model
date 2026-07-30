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

function pythonType(
  node: SchemaNode,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const parts = nullableParts(node);
  if (parts.nullable) {
    const base = pythonType(parts.node, registry, options);
    return options.python.modernUnions ? `${base} | None` : `Optional[${base}]`;
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
          return "date";
        case "datetime":
          return "datetime";
      }
    case "unknown":
      return options.unknownType === "dynamic" ? "Any" : "object";
    case "object":
      return node.empty ? "dict[str, object]" : registry.modelName(node);
    case "array":
      return `list[${pythonType(node.element, registry, options)}]`;
    case "union": {
      const variants = node.variants.map((variant) =>
        pythonType(variant, registry, options),
      );
      return options.python.modernUnions
        ? variants.join(" | ")
        : `Union[${variants.join(", ")}]`;
    }
  }
}

function propertyType(
  property: SchemaProperty,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const type = pythonType(property.node, registry, options);
  if (property.optional && !type.includes("None")) {
    return options.python.modernUnions ? `${type} | None` : `Optional[${type}]`;
  }
  return type;
}

function fieldAssignment(
  property: SchemaProperty,
  options: GeneratorOptions,
): string {
  const fieldName = safePropertyName(property.jsonKey, "python");
  const needsAlias =
    options.python.useAliases && fieldName !== property.jsonKey;

  if (needsAlias) {
    const defaultArgument = property.optional ? "default=None, " : "";
    return ` = Field(${defaultArgument}alias=${quoteString(property.jsonKey, '"')})`;
  }
  return property.optional ? " = None" : "";
}

function modelCode(
  name: string,
  node: ObjectSchemaNode,
  registry: ModelRegistry,
  options: GeneratorOptions,
): string {
  const lines: string[] = [`class ${name}(BaseModel):`];
  if (options.includeComments) {
    lines.push(`    """Model inferred from the JSON object for ${name}."""`);
  }
  if (options.python.useAliases && options.python.populateByName) {
    lines.push("    model_config = ConfigDict(populate_by_name=True)");
  }
  for (const property of node.properties) {
    const fieldName = safePropertyName(property.jsonKey, "python");
    lines.push(
      `    ${fieldName}: ${propertyType(property, registry, options)}${fieldAssignment(property, options)}`,
    );
  }
  return lines.join("\n");
}

function collectImports(
  schema: SchemaNode,
  options: GeneratorOptions,
  registry: ModelRegistry,
): string[] {
  const source = JSON.stringify(schema);
  const imports = ["from __future__ import annotations", ""];
  if (source.includes('"type":"date"')) {
    imports.push("from datetime import date");
  }
  if (source.includes('"type":"datetime"')) {
    imports.push("from datetime import datetime");
  }
  if (!options.python.modernUnions && source.includes('"kind":"union"')) {
    imports.push("from typing import Optional, Union");
  } else if (!options.python.modernUnions) {
    imports.push("from typing import Optional");
  }
  if (
    options.unknownType === "dynamic" &&
    source.includes('"kind":"unknown"')
  ) {
    imports.push("from typing import Any");
  }

  const hasModels = registry.models.length > 0;
  const hasAliases = registry.models.some((model) =>
    model.node.properties.some(
      (property) =>
        safePropertyName(property.jsonKey, "python") !== property.jsonKey,
    ),
  );
  const pydanticImports: string[] = [];
  if (hasModels) {
    pydanticImports.push("BaseModel");
  }
  if (options.python.useAliases && hasAliases) {
    pydanticImports.push("Field");
  }
  if (hasModels && options.python.useAliases && options.python.populateByName) {
    pydanticImports.push("ConfigDict");
  }
  if (schema.kind !== "object" || schema.empty) {
    pydanticImports.push("RootModel");
  }
  imports.push(`from pydantic import ${pydanticImports.sort().join(", ")}`);
  return imports;
}

export function generatePython(
  schema: SchemaNode,
  options: GeneratorOptions,
  sourceWarnings: readonly SchemaWarning[] = [],
): GenerationResult {
  const registry = createModelRegistry(schema, options.rootName);
  const rootName = toPascalCase(options.rootName, "RootModel");
  const imports = collectImports(schema, options, registry);
  const codeParts = [...imports, "", ""];

  for (const model of [...registry.models].reverse()) {
    codeParts.push(
      modelCode(model.name, model.node, registry, options),
      "",
      "",
    );
  }

  if (!registry.rootObjectName) {
    codeParts.push(
      `class ${rootName}(RootModel[${pythonType(schema, registry, options)}]):`,
      "    pass",
      "",
      "",
    );
  }

  if (options.python.includeExample) {
    codeParts.push(
      'if __name__ == "__main__":',
      `    model = ${rootName}.model_validate_json('{"example": true}')`,
      "    print(model.model_dump(by_alias=True))",
      "",
    );
  }

  return {
    code: `${codeParts.join("\n").trimEnd()}\n`,
    modelCount: registry.models.length,
    warnings: sourceWarnings,
    extension: "py",
  };
}
