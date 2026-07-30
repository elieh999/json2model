# Contributing

Changes should keep conversion local, deterministic, and readable.

## Setup

```bash
npm install
npm run dev
```

## Before opening a pull request

```bash
npm run verify
```

That runs the format check, ESLint, `tsc`, the unit and component tests, and the
build. Add these when your change touches the relevant area:

```bash
npm run test:e2e          # interface or browser behaviour
npm run validate:typescript
npm run validate:python   # needs Python 3.11+, Pydantic 2, Ruff
npm run validate:dart     # needs the Dart SDK
```

## Design rules

1. Parsing, inference, and generation stay independent of React. If a change needs a
   React import in `src/schema`, `src/parser`, `src/naming`, or `src/generators`,
   something belongs in a component instead.
2. The internal schema stays independent of the output languages. A language quirk
   belongs in that language's generator, not in inference.
3. Nothing transmits or logs pasted JSON. There is no analytics, no error reporting,
   and no network call in the conversion path.
4. Input is not persisted unless the user turns on the remember input setting.
5. Output is deterministic. Avoid `localeCompare`, iteration order that depends on
   insertion, and anything else that could differ between hosts.
6. When inference has to guess, add a warning that names the path. Silent fallbacks
   are worse than a visible one.
7. Keep every control labelled, focusable, and keyboard operable.
8. A setting must change the output. A control that does nothing for the selected
   language should not be shown for it.

## Adding a language

Add a directory under `src/generators`, consume the existing `SchemaNode` tree, and
register the generator in `src/generators/generate.ts`. Reuse `planFields` for member
names and `createModelRegistry` for class names so collision handling matches the
other targets. Then add the language to `scripts/generate-fixtures.ts` so its output
is checked by a real toolchain.

## Tests

Generator changes need a unit test for the shape that changed. When the change
affects generated code, add a case to `scripts/generate-fixtures.ts` too, so the
TypeScript compiler, Ruff, Pydantic, and the Dart analyzer all see it. Prefer a
direct assertion about a type, a key mapping, or a warning over a whole file
snapshot.

Every fixture in `tests/fixtures` must be referenced by a case in
`scripts/generate-fixtures.ts`. The script fails if one is not, so a new fixture
cannot be added without being validated.

## Commits

Describe the behaviour that changed. Examples of the style used here:

```text
fix nullable field inference for object arrays
escape dollar signs in generated Dart keys
add generated code validation for every fixture
```
