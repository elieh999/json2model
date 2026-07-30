import type { SchemaNode, SchemaWarning } from "@/src/schema/types";
import { generateDart } from "./dart/generateDart";
import { generatePython } from "./python/generatePython";
import { generateTypeScript } from "./typescript/generateTypeScript";
import type {
  GenerationResult,
  GeneratorOptions,
  TargetLanguage,
} from "./types";

export function generateModels(
  language: TargetLanguage,
  schema: SchemaNode,
  options: GeneratorOptions,
  warnings: readonly SchemaWarning[] = [],
): GenerationResult {
  switch (language) {
    case "dart":
      return generateDart(schema, options, warnings);
    case "typescript":
      return generateTypeScript(schema, options, warnings);
    case "python":
      return generatePython(schema, options, warnings);
  }
}
