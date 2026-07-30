# Contributing

Thank you for improving JSON2Model. Changes should keep conversion local, deterministic, and understandable.

## Setup

```bash
npm install
npm run dev
```

## Before opening a pull request

Run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm run test
npm run build
npm run build:static
```

Run `npm run test:e2e` when the interface or browser behavior changes.

Generator changes should add focused tests for the input shape that changed. Avoid broad snapshots when a direct assertion can describe the expected type, key mapping, or warning.

## Design rules

1. Keep parsing and generation independent from React.
2. Keep the internal schema independent from output languages.
3. Do not transmit or log pasted JSON.
4. Do not persist input unless the user enables the remember input setting.
5. Keep output deterministic for the same input and settings.
6. Add a clear warning when inference must use a fallback.
7. Preserve accessible labels, focus states, and keyboard behavior.

## Pull requests

Describe the behavior that changed, the tests you added, and any limitation that remains. Keep commits focused and use direct messages such as `fix nullable field inference for object arrays`.
