# Inference behavior

These are the rules the converter follows. They are deterministic: the same
document and settings always produce the same schema, the same model names, the same
declaration order, and the same text.

## Primitive values

| JSON value            | Inferred          | Dart       | TypeScript | Python     |
| --------------------- | ----------------- | ---------- | ---------- | ---------- |
| `"text"`              | string            | `String`   | `string`   | `str`      |
| `42`                  | integer           | `int`      | `number`   | `int`      |
| `4.2`                 | number            | `double`   | `number`   | `float`    |
| `true`                | boolean           | `bool`     | `boolean`  | `bool`     |
| `null`                | null              | `Object?`  | `null`     | `None`     |
| `"2026-07-30"`        | date (opt in)     | `DateTime` | `string`   | `date`     |
| `"2026-07-30T08:00Z"` | datetime (opt in) | `DateTime` | `string`   | `datetime` |

A whole number is an integer and a number with a fractional part is a floating
point value. When both appear in the same position they merge to the floating point
type, and Dart converts through `num` so a JSON `8` still lands in a `double`.

Date detection is off by default. When it is on, only a full match against
`YYYY-MM-DD` or an ISO date and time with an offset or `Z` counts. `"2026-07"` and
`"2026-07-30 morning"` stay strings. TypeScript keeps `string` either way, because
parsed JSON contains no `Date` instance.

An integer token beyond JavaScript's safe range produces a warning. `JSON.parse` has
already lost the exact digits by the time inference runs, so the model keeps an
integer type and the warning suggests using a JSON string when the digits matter.

## Null and missing properties

Null is an observed value and makes the type nullable. A property absent from at
least one object in a merged array is optional. The two are tracked separately:

| Situation                      | Dart           | TypeScript             | Python                     |
| ------------------------------ | -------------- | ---------------------- | -------------------------- |
| Always present, never null     | `String name`  | `name: string`         | `name: str`                |
| Always present, sometimes null | `String? name` | `name: string \| null` | `name: str \| None`        |
| Sometimes absent               | `String? name` | `name?: string`        | `name: str \| None = None` |
| Only ever null                 | `Object? name` | `name: null`           | `name: None`               |

The Python column is the reason the distinction matters. A required nullable field
has no default, so Pydantic still rejects a document that omits the key, while an
optional field defaults to `None`.

## Arrays

Every element is inspected. Objects with similar shapes merge into one model, and
the first observed property order is kept unless property sorting is enabled.

An empty array cannot reveal an element type. The configured unknown type is used
and a warning names the path.

Mixed elements become a union where the language can express one. TypeScript and
Python get a real union, including one that mentions a generated model. Dart has no
untagged union, so the value becomes `Object?` or `dynamic`; when an object shape is
part of that union, no class is generated for it and a warning says so.

Nested arrays work at any depth inside the limits, and the generated Dart uses a
distinct loop variable per level so an inner closure does not shadow an outer one.

## Objects

An empty object becomes a generic map or record type and produces a warning. A
nonempty nested object becomes a named model.

## Warnings

Warnings are grouped by reason and path, with array indices collapsed. A 5,000
element array where every element has the same empty field reports one warning that
says how many places it came from, not 5,000 lines.

| Code                     | Meaning                                                         |
| ------------------------ | --------------------------------------------------------------- |
| `empty-array`            | No elements, so the element type is the configured unknown type |
| `empty-object`           | No properties, so a generic map type was used                   |
| `mixed-array`            | Elements had different types, so a union or fallback was used   |
| `large-integer`          | An integer token is past safe JavaScript precision              |
| `dropped-union-shape`    | Dart cannot express this union, so no class was generated       |
| `generated-identifier`   | A key could not be used directly, so a name was generated       |
| `renamed-typescript-key` | Converted names no longer match the runtime JSON keys           |

## Naming

Model names are PascalCase. Property names are camelCase for Dart and TypeScript
and snake_case for Python. Original JSON keys are always what Dart serialization
and Pydantic aliases use.

| Key            | Dart / TypeScript | Python           |
| -------------- | ----------------- | ---------------- |
| `user profile` | `userProfile`     | `user_profile`   |
| `first-name`   | `firstName`       | `first_name`     |
| `2fa_enabled`  | `twoFaEnabled`    | `two_fa_enabled` |
| `field_2499`   | `field2499`       | `field_2499`     |
| `API_response` | `apiResponse`     | `api_response`   |
| `café`         | `cafe`            | `cafe`           |
| `123`          | `field123`        | `field_123`      |
| `class`        | `class_`          | `class_`         |

Accented Latin letters reduce to their base form. Other scripts are kept for Python
and TypeScript, which allow Unicode identifiers, and replaced for Dart, which does
not. A key such as `اسم المستخدم` becomes `اسم_المستخدم` in Python and a generated
name in Dart, with the original key still used for reading and writing JSON.

Reserved words get a trailing underscore. Names that would collide with something
the declaration already owns are renamed:

| Key            | Why it is renamed                                | Result               |
| -------------- | ------------------------------------------------ | -------------------- |
| `toJson`       | The generated Dart class already has that member | `toJson2` in Dart    |
| `hashCode`     | Inherited from Dart's `Object`                   | `hashCode2` in Dart  |
| `model_config` | Pydantic treats it as configuration, not a field | `field_model_config` |
| `model_id`     | Pydantic protects the `model_` prefix            | `field_model_id`     |
| `schema`       | A `BaseModel` member Pydantic would swallow      | `field_schema`       |

A class name that would shadow a type in scope gets a `Model` suffix, so a key
called `none` produces `NoneModel` rather than the syntax error `class None`. The
default root name `RootModel` is kept as is; when the Python output also needs
Pydantic's `RootModel`, the import is aliased instead of renaming the class.

Duplicate names get numeric suffixes in discovery order. Two keys that reduce to the
same property name each keep their own field: `first-name`, `first_name`, and
`firstName` become `firstName`, `firstName2`, and `firstName3`, each mapped to its
own original key.

## Root values

| Root                | Result                                                |
| ------------------- | ----------------------------------------------------- |
| Object              | The requested root model                              |
| Array of objects    | An item model plus a root list type                   |
| Array of primitives | A root list type                                      |
| Primitive           | A Dart or TypeScript alias, or a Pydantic `RootModel` |
| Empty object        | A generic map type, with no class to generate         |

## Limits

Input is capped at 2,000,000 characters, nesting at 80 levels, and visited values at
50,000. Past any of them the interface explains the limit rather than continuing.
