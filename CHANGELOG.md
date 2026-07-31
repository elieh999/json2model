# Changelog

## 0.1.0

Released 2026-07-30.

First public version. JSON2Model converts a pasted JSON document into Dart,
TypeScript, or Pydantic 2 models entirely in the browser.

### Added

1. Local JSON parsing with readable validation errors, a line and column when the
   browser reports one, and limits on input size, nesting depth, and visited values.
2. A language independent schema layer covering objects, arrays, primitives, unions,
   optional properties, and nullable properties, with deterministic ordering.
3. Dart, TypeScript, and Python Pydantic 2 generators driven by that schema.
4. Shared naming rules per language: reserved words, keys that collide after
   conversion, keys that cannot be an identifier, names a generated declaration
   already owns, and Pydantic's protected `model_` prefix. The original JSON key is
   always used for serialization.
5. Warnings that name the path where inference had to guess, grouped so a large array
   reports one warning per place rather than one per element.
6. A responsive two panel interface with light, dark, and system themes, keyboard
   shortcuts, visible focus, and accessible labels.
7. Format, minify, clear, load example, copy input, copy output, and download.
8. Per language generation settings, stored locally and validated when read back.
9. Unit, component, and browser tests, plus generated code validation through the
   TypeScript compiler, Ruff, Pydantic 2, and the Dart analyzer with a serialization
   round trip.
10. A single file offline build, one HTML document of about 240 KB that runs by
    being opened, with no install and no network access.
11. Continuous integration and a GitHub Pages deployment that waits for it to pass.
