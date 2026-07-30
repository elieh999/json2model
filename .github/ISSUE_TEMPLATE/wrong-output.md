---
name: Wrong or invalid generated code
about: The generated model does not compile, loses a key, or has the wrong type
labels: ["generator"]
---

**Target language**

Dart, TypeScript, or Python.

**Input**

The smallest JSON document that shows the problem. Please replace real values with
synthetic ones.

```json

```

**What was generated**

```text

```

**What you expected**

Describe the type, key mapping, or declaration you expected instead.

**Settings**

Anything you changed from the defaults, such as the root model name, date detection,
camelCase keys, or the unknown value strategy.

**Toolchain output**

If the code does not compile, the message from `dart analyze`, `tsc`, Ruff, or
Pydantic is the most useful thing you can include.
