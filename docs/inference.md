# Inference behavior

Inference is deterministic. The same JSON and settings produce the same schema, model names, declaration order, and generated text.

## Primitive values

Whole numbers become integer types. Decimal numbers become floating point types. Booleans and strings keep their direct language equivalents.

Date and date time detection is disabled by default. When enabled, strict ISO shaped strings become Dart `DateTime` or Python `date` and `datetime`. TypeScript declarations keep strings because raw JSON does not contain `Date` instances.

An integer token beyond the safe JavaScript range produces a warning. The model still uses an integer type. Use a string in the source JSON when exact digits must survive JavaScript parsing.

## Null and missing properties

Null is an observed value and creates a nullable type.

A property missing from at least one object in a merged object array becomes optional. Optional properties receive a nullable field in Dart and Python because missing input has no value. TypeScript uses the optional property marker.

A nullable property that appears in every object remains required. Pydantic 2 output therefore omits a default unless the property is also optional.

## Arrays

Array elements are inferred from every value.

Similar objects merge into one object schema. The first observed property order is retained unless property sorting is selected. Missing fields become optional.

Mixed compatible numbers merge to the floating point type. Other mixed values form a union where the language supports it. Dart uses the configured safe fallback for unions it cannot express.

An empty array uses the configured unknown element type and produces a warning.

## Objects

Empty objects become generic map or record types and produce a warning. Nonempty nested objects become named models.

Object property order follows the source by default. Sorting can be selected for teams that prefer alphabetical declarations.

## Naming

Model names use PascalCase. Dart and TypeScript property names use camelCase when conversion is active. Python uses snake_case.

Spaces, punctuation, leading numbers, Unicode letters, and reserved words are handled by the shared naming service. Original JSON keys are always used for Dart serialization and Python aliases.

TypeScript preserves original keys by default. Invalid or reserved keys are quoted. Converted TypeScript names describe a different runtime shape, so the interface adds an explicit warning.

Duplicate model names receive numeric suffixes in stable discovery order.

## Root values

A root object becomes the requested root model.

A root array of objects creates an item model and a root list type. Primitive arrays create a root list type. Primitive roots create a root alias or Pydantic root model as required by the target language.

## Limits

Maximum input length is 2,000,000 characters. Maximum depth is 80 levels. Maximum visited node count is 50,000.

These limits are product safety boundaries. They return a readable error instead of continuing recursive work.
