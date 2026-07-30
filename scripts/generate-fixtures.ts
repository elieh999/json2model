import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { generateModels } from "../src/generators/generate";
import {
  DEFAULT_GENERATOR_OPTIONS,
  type GeneratorOptions,
} from "../src/generators/types";
import { inferSchema } from "../src/schema/infer";

const representativeJson = {
  "request-id": "req_01J93Y6M",
  profile: {
    "display-name": "Ada Lovelace",
    active: true,
  },
  items: [
    { sku: "DEV-001", quantity: 2 },
    { sku: "DEV-002", quantity: 1, note: "Backordered" },
  ],
};

const options: GeneratorOptions = {
  ...DEFAULT_GENERATOR_OPTIONS,
  rootName: "RootModel",
  convertPropertyNames: true,
  dart: { ...DEFAULT_GENERATOR_OPTIONS.dart },
  typescript: { ...DEFAULT_GENERATOR_OPTIONS.typescript },
  python: { ...DEFAULT_GENERATOR_OPTIONS.python },
};

const schema = inferSchema(representativeJson).schema;
const outputDirectory = path.resolve("tests/generated");
await mkdir(outputDirectory, { recursive: true });

await Promise.all([
  writeFile(
    path.join(outputDirectory, "models.dart"),
    generateModels("dart", schema, options).code,
  ),
  writeFile(
    path.join(outputDirectory, "models.ts"),
    generateModels("typescript", schema, options).code,
  ),
  writeFile(
    path.join(outputDirectory, "models.py"),
    generateModels("python", schema, options).code,
  ),
  writeFile(
    path.join(outputDirectory, "models_test.dart"),
    `import 'models.dart';

void main() {
  final json = <String, dynamic>{
    'request-id': 'req_01J93Y6M',
    'profile': <String, dynamic>{
      'display-name': 'Ada Lovelace',
      'active': true,
    },
    'items': <dynamic>[
      <String, dynamic>{'sku': 'DEV-001', 'quantity': 2},
      <String, dynamic>{
        'sku': 'DEV-002',
        'quantity': 1,
        'note': 'Backordered',
      },
    ],
  };

  final model = RootModel.fromJson(json);
  if (model.profile.displayName != 'Ada Lovelace') {
    throw StateError('Nested model parsing failed');
  }
  if (model.items[1].note != 'Backordered') {
    throw StateError('Optional property parsing failed');
  }
  final encoded = model.toJson();
  if (encoded['request-id'] != 'req_01J93Y6M') {
    throw StateError('Original JSON key was not preserved');
  }
}
`,
  ),
  writeFile(
    path.join(outputDirectory, "validate_python.py"),
    `from models import RootModel


payload = {
    "request-id": "req_01J93Y6M",
    "profile": {"display-name": "Ada Lovelace", "active": True},
    "items": [
        {"sku": "DEV-001", "quantity": 2},
        {"sku": "DEV-002", "quantity": 1, "note": "Backordered"},
    ],
}

model = RootModel.model_validate(payload)
assert model.profile.display_name == "Ada Lovelace"
assert model.items[1].note == "Backordered"
assert model.model_dump(by_alias=True)["request-id"] == "req_01J93Y6M"
`,
  ),
]);
