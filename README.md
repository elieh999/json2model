# JSON2Model

JSON2Model converts pasted JSON into Dart models, TypeScript declarations, or Python models for Pydantic 2. It runs entirely in the browser and keeps the converter visible as soon as the page opens.

Your JSON stays in your browser. The application has no account system, backend, analytics, error reporting service, or AI API. Input is not written to browser storage unless you explicitly enable the remember input setting.

![JSON2Model in light mode](docs/screenshots/desktop-light.png)

## What it supports

| Target     | Generated output                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Dart       | Immutable null safe classes, named constructors, `fromJson`, `toJson`, nested models, lists, numeric conversion, and original key mapping |
| TypeScript | Strict interfaces or type aliases, optional properties, nullable types, unions, arrays, readonly options, and quoted original keys        |
| Python     | Python 3.11 type hints, Pydantic 2 models, aliases, nested models, modern unions, lists, and optional parsing examples                    |

The input can be an object, an array, a primitive array, or a primitive value. Object arrays are merged so missing fields become optional. Null values remain nullable. Empty values and uncertain mixed arrays produce visible warnings.

## Example

Input:

```json
{
  "request-id": "req_01J93Y6M",
  "profile": {
    "display-name": "Ada Lovelace"
  }
}
```

Python output:

```python
from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class Profile(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    display_name: str = Field(alias="display-name")


class RootModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    request_id: str = Field(alias="request-id")
    profile: Profile
```

## Portable Windows application

The ready-made Windows distribution is self-contained. Extract the ZIP, keep
the `Application` folder together, and double-click `JSON2Model.exe`. The
recipient does not need Python, Docker, Node.js, an installer, an account, or
an internet connection.

To rebuild that folder from source on Windows:

```bash
npm install
npm run desktop:build
```

The packaged folder is written to `release/win-unpacked`.

## Local setup

Requirements:

1. Node.js 22.13 or newer
2. npm 10 or newer

```bash
npm install
npm run dev
```

Open the local address shown in the terminal.

## Commands

```bash
npm run dev
npm run format
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run test:unit
npm run test:component
npm run test:e2e
npm run build
npm run build:static
npm run desktop:build
npm run preview
npm run preview:static
```

The normal build creates the Sites and Cloudflare Worker compatible application. The static build creates `dist-static`, which can be hosted on GitHub Pages, Cloudflare Pages, Netlify, Vercel, or any static file host.

Browser tests install their browser once:

```bash
npx playwright install chromium
npm run test:e2e
```

## Generated code validation

Representative generated files live in `tests/generated`. The fixture script recreates them from the real generator.

```bash
npm run fixtures:generate
npm run validate:typescript
npm run validate:python
npm run validate:dart
```

Python validation requires Python 3.11 or newer, Pydantic 2, and Ruff. Dart validation requires the Dart SDK.

```bash
python -m pip install "pydantic>=2,<3" ruff
```

## Deployment

For a static host, run:

```bash
npm ci
npm run build:static
```

Publish the `dist-static` directory. Relative asset paths allow the same build to work below a repository path on GitHub Pages.

The GitHub Pages workflow in `.github/workflows/deploy-pages.yml` publishes this static directory from the `main` branch. The Sites build remains available for Cloudflare based hosting.

## Project structure

```text
app/                    Sites application shell and global styles
src/components/         Converter interface and settings
src/generators/         Dart, TypeScript, and Python generators
src/naming/             Identifier and model naming rules
src/parser/             JSON parsing and input limits
src/schema/             Language independent schema inference
src/hooks/              Browser preference storage
tests/unit/             Parser, schema, naming, and generator tests
tests/component/        React interaction tests
tests/browser/          Playwright browser tests
tests/fixtures/         Representative JSON documents
docs/                   Architecture and inference notes
```

See [architecture notes](docs/architecture.md) and [inference behavior](docs/inference.md) for the design details.

## Privacy and security

The application does not call `fetch`, open a socket, submit a form, or load an analytics script during conversion. JSON is rendered as text through React. User content is never inserted through raw HTML.

The input limit is 2,000,000 characters. Schema inference stops after 80 nested levels or 50,000 visited nodes. These limits produce a readable error instead of continuing unsafe work.

See [SECURITY.md](SECURITY.md) for reporting instructions.

## Known limitations

1. JSON numbers already pass through the JavaScript number parser. A warning appears when an integer token exceeds safe JavaScript precision. Use a JSON string when exact digits matter.
2. Empty arrays cannot reveal an element type, so the configured unknown type is used.
3. TypeScript declarations do not rename runtime object keys. Original keys are preserved by default. Enabling converted TypeScript names adds a warning.
4. Date detection is optional and conservative. Date like strings remain strings by default.
5. Input is processed on the main browser thread after React defers the update. The safety limits prevent extreme documents from consuming unbounded work.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. New inference behavior should include focused unit tests and generated code validation where practical.

## License

JSON2Model is available under the [MIT License](LICENSE).
