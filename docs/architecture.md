# Architecture

JSON2Model separates input handling, schema inference, naming, generation, and React rendering.

## Conversion flow

```text
JSON text
  -> size check and JSON.parse
  -> language independent SchemaNode tree
  -> deterministic model registry
  -> selected language generator
  -> highlighted text output
```

The parser returns a typed result instead of throwing syntax errors into the interface. It also scans numeric tokens for integers beyond the safe JavaScript range.

Schema inference is pure TypeScript. It has no React, browser storage, network, or clipboard dependency. Each generator consumes the same `SchemaNode` union and returns code, warnings, the file extension, and the generated model count.

## Internal schema

`SchemaNode` represents:

1. Primitive values
2. Objects with ordered properties
3. Arrays with an inferred element
4. Unions
5. Unknown values with a reason

Optional state belongs to an object property because it describes absence. Nullable state is represented by a union containing null because it describes an observed value.

## Model registry

The registry walks the schema in stable depth first order. It assigns a model name to every nonempty object node. Names come from the root setting or the property path. Collisions receive a stable numeric suffix.

Generators ask the registry for nested model names. This keeps duplicate handling identical across languages.

## Interface

`ConverterApp` owns the input, preferences, theme, notices, and generated result. React `useDeferredValue` keeps typing responsive while generation catches up.

Harmless preferences use local storage. Input has a separate key and is written only when remember input is enabled. The default session starts empty.

The Sites application in `app` and the static Vite entry both reuse the same React component. The Sites build supports Cloudflare hosting. The static Vite build produces portable files for ordinary static hosts.

## Safety

The parser rejects input beyond 2,000,000 characters. Inference stops beyond 80 levels or 50,000 visited nodes. Unexpected failures pass through an error boundary with a local privacy reminder.

User text is rendered through normal React nodes. The project does not use `dangerouslySetInnerHTML`, `eval`, input based file paths, analytics, or conversion network calls.
