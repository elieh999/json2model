# Architecture

JSON2Model is a static React page. There is no server in the conversion path, and
the parsing, inference, naming, and generation layers have no React import, so they
can be called from a script or a test directly.

## Conversion flow

```text
JSON text
  -> parseJson            size limit, JSON.parse, friendly error, large integer scan
  -> inferSchema          language independent SchemaNode tree plus warnings
  -> createModelRegistry  one stable class name per nonempty object node
  -> generateModels       Dart, TypeScript, or Python text plus warnings
  -> SyntaxCode           tokenized output rendered as React text nodes
```

Each step is a pure function of its input. The same document and settings always
produce the same text, which is what makes the output safe to commit.

## Why a schema layer

Generating each language straight from the parsed JSON would let three generators
disagree about the same document. Inference happens once and produces a neutral
tree, and each generator is only responsible for spelling that tree in its own
language. Adding a fourth language means adding one generator and no inference
changes.

## The internal schema

`src/schema/types.ts` defines five node kinds:

| Kind        | Holds                                                        |
| ----------- | ------------------------------------------------------------ |
| `primitive` | string, integer, number, boolean, null, date, datetime       |
| `object`    | ordered properties, each with its JSON key and optional flag |
| `array`     | one element node and whether the source array was empty      |
| `union`     | variants, deduplicated and ordered by a stable signature     |
| `unknown`   | a reason string explaining why nothing could be inferred     |

Two states that look similar are kept apart on purpose:

- **Optional** belongs to the object property, because it describes a key that was
  absent from some objects.
- **Nullable** is a union containing the null primitive, because it describes a
  value that was present and null.

A Dart field is nullable in both cases, since a missing key has no value, but
Pydantic needs the distinction: an optional field gets `= None` while a required
nullable field does not, so a missing key is still a validation error.

## Determinism

Three things could have made output vary between runs and are handled explicitly:

1. Union variants are deduplicated through a structural signature and sorted by
   code point, not by insertion order.
2. Property sorting, when enabled, compares code points. `localeCompare` was
   removed because its result depends on the host's locale data.
3. Model names come from the property path in depth first order, and a collision
   gets a numeric suffix in discovery order.

## The model registry

`createModelRegistry` walks the schema once and assigns a class name to every
nonempty object node, keyed by node identity. Two structurally identical objects at
different paths get separate models, which keeps names meaningful.

The registry is language aware, because the legal character set differs. Dart
identifiers are ASCII only, and the set of names that would shadow something in
scope differs per language: `class None(BaseModel)` is a Python syntax error, and a
Dart class called `String` shadows the core type.

Dart cannot express a union of an object and a primitive. The Dart generator walks
the schema a second time to find which models its emitted types actually name and
drops the rest, rather than declaring a class nothing refers to. The model count
shown in the interface is the number of declarations actually emitted.

## Field names

`planFields` in `src/generators/shared.ts` chooses one member name per property for
all three generators, so the collision rules cannot drift apart. It handles:

- Two JSON keys that reduce to the same identifier, such as `first-name` and
  `first_name`. The first keeps the clean name and the next gets a suffix.
- A key that cannot be an identifier at all, which only happens for Dart. A name is
  generated and a warning names the key.
- Names the surrounding declaration already uses. Dart reserves the class name,
  `toJson`, `fromJson`, and the `Object` members. Python reserves `model_config`,
  anything starting with `model_`, and a few `BaseModel` members that Pydantic
  would swallow.

In every case the original JSON key is what `fromJson`, `toJson`, and the Pydantic
alias use, so no data is lost.

## Interface

`ConverterApp` owns the input text, the preferences, the theme, and the notices.
Generation runs from deferred copies of the input and the settings, so a control
responds immediately while the expensive work catches up. The output panel reads the
deferred language too, so its heading always matches the code below it.

Preferences are read back from local storage field by field rather than spread in,
because a stored value of the wrong type would otherwise reach the generators and
break the page on load. Pasted input has a separate key and is written only when the
remember input setting is on.

## Safety

The parser refuses input past 2,000,000 characters and returns that refusal as a
result rather than throwing, so a paste can never escape a click handler. Inference
stops past 80 levels of nesting or 50,000 visited values and throws a typed error
that the interface turns into a readable message. Anything unexpected lands in an
error boundary that says the JSON was not uploaded.

Generated code and JSON are rendered as React text nodes. The project does not use
`dangerouslySetInnerHTML`, `eval`, or any input derived file path. The production
build injects a Content Security Policy with `connect-src 'none'`.

## Desktop shell

`electron/main.cjs` loads the same built page from the local filesystem. The
renderer runs with context isolation on, Node integration off, and the sandbox
enabled. `electron/preload.cjs` exposes one frozen function that writes to the
clipboard, with a length limit checked in the main process, because clipboard access
from a `file://` page is unreliable. Navigation away from the local file and new
window requests are both blocked.
