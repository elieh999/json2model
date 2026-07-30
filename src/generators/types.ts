import type { SchemaWarning } from "@/src/schema/types";

export type TargetLanguage = "dart" | "typescript" | "python";
export type UnknownTypeStrategy = "safe" | "dynamic";

export interface CommonGeneratorOptions {
  readonly rootName: string;
  readonly detectDates: boolean;
  readonly convertPropertyNames: boolean;
  readonly preservePropertyOrder: boolean;
  readonly includeComments: boolean;
  readonly unknownType: UnknownTypeStrategy;
}

export interface DartGeneratorOptions {
  readonly includeFromJson: boolean;
  readonly includeToJson: boolean;
  readonly constConstructors: boolean;
}

export interface TypeScriptGeneratorOptions {
  readonly declarationMode: "interface" | "type";
  readonly semicolons: boolean;
  readonly readonlyProperties: boolean;
  readonly exportDeclarations: boolean;
}

export interface PythonGeneratorOptions {
  readonly modernUnions: boolean;
  readonly useAliases: boolean;
  readonly populateByName: boolean;
  readonly includeExample: boolean;
}

export interface GeneratorOptions extends CommonGeneratorOptions {
  readonly dart: DartGeneratorOptions;
  readonly typescript: TypeScriptGeneratorOptions;
  readonly python: PythonGeneratorOptions;
}

export interface GenerationResult {
  readonly code: string;
  readonly modelCount: number;
  readonly warnings: readonly SchemaWarning[];
  readonly extension: "dart" | "ts" | "py";
}

export const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  rootName: "RootModel",
  detectDates: false,
  convertPropertyNames: false,
  preservePropertyOrder: true,
  includeComments: false,
  unknownType: "safe",
  dart: {
    includeFromJson: true,
    includeToJson: true,
    constConstructors: true,
  },
  typescript: {
    declarationMode: "interface",
    semicolons: true,
    readonlyProperties: false,
    exportDeclarations: true,
  },
  python: {
    modernUnions: true,
    useAliases: true,
    populateByName: true,
    includeExample: false,
  },
};
