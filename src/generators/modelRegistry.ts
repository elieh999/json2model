import { toPascalCase, uniqueName } from "@/src/naming/naming";
import type { ObjectSchemaNode, SchemaNode } from "@/src/schema/types";

export interface ModelDefinition {
  readonly name: string;
  readonly node: ObjectSchemaNode;
  readonly path: string;
}

export interface ModelRegistry {
  readonly models: readonly ModelDefinition[];
  readonly rootObjectName: string | null;
  modelName(node: ObjectSchemaNode): string;
}

function singularize(value: string): string {
  if (value.toLocaleLowerCase("en-US").endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }
  if (
    value.toLocaleLowerCase("en-US").endsWith("s") &&
    !value.toLocaleLowerCase("en-US").endsWith("ss")
  ) {
    return value.slice(0, -1);
  }
  return value;
}

function childNameHint(propertyName: string, isArrayElement: boolean): string {
  const value = isArrayElement ? singularize(propertyName) : propertyName;
  return toPascalCase(value, "NestedModel");
}

export function createModelRegistry(
  schema: SchemaNode,
  requestedRootName: string,
): ModelRegistry {
  const models: ModelDefinition[] = [];
  const namesByNode = new Map<ObjectSchemaNode, string>();
  const usedNames = new Set<string>();
  const rootName = toPascalCase(requestedRootName, "RootModel");

  function register(
    node: ObjectSchemaNode,
    baseName: string,
    path: string,
  ): string {
    const knownName = namesByNode.get(node);
    if (knownName) {
      return knownName;
    }
    const name = uniqueName(toPascalCase(baseName, "NestedModel"), usedNames);
    namesByNode.set(node, name);
    models.push({ name, node, path });

    for (const property of node.properties) {
      visit(
        property.node,
        childNameHint(property.jsonKey, property.node.kind === "array"),
        `${path}.${property.jsonKey}`,
      );
    }
    return name;
  }

  function visit(node: SchemaNode, baseName: string, path: string): void {
    if (node.kind === "object") {
      if (!node.empty) {
        register(node, baseName, path);
      }
      return;
    }
    if (node.kind === "array") {
      visit(node.element, baseName, `${path}[]`);
      return;
    }
    if (node.kind === "union") {
      for (const variant of node.variants) {
        visit(variant, baseName, path);
      }
    }
  }

  let rootObjectName: string | null = null;
  if (schema.kind === "object" && !schema.empty) {
    rootObjectName = register(schema, rootName, "$");
  } else {
    if (schema.kind === "array") {
      visit(schema.element, `${rootName}Item`, "$[]");
    } else {
      visit(schema, `${rootName}Value`, "$");
    }
  }

  return {
    models,
    rootObjectName,
    modelName(node: ObjectSchemaNode): string {
      return namesByNode.get(node) ?? rootName;
    },
  };
}
