/**
 * Identifier rules shared by every generator.
 *
 * The original JSON key is never changed here. Generators keep it for
 * serialization and use these helpers only to pick a legal name in the target
 * language.
 */

export type Language = "dart" | "typescript" | "python";

const WORD_PATTERN = /[\p{L}\p{N}]+/gu;

const NUMBER_WORDS: Record<string, string> = {
  "0": "zero",
  "1": "one",
  "2": "two",
  "3": "three",
  "4": "four",
  "5": "five",
  "6": "six",
  "7": "seven",
  "8": "eight",
  "9": "nine",
};

const RESERVED: Record<Language, ReadonlySet<string>> = {
  dart: new Set([
    "abstract",
    "as",
    "assert",
    "async",
    "await",
    "base",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "covariant",
    "default",
    "deferred",
    "do",
    "dynamic",
    "else",
    "enum",
    "export",
    "extends",
    "extension",
    "external",
    "factory",
    "false",
    "final",
    "finally",
    "for",
    "function",
    "get",
    "hide",
    "if",
    "implements",
    "import",
    "in",
    "interface",
    "is",
    "late",
    "library",
    "mixin",
    "new",
    "null",
    "on",
    "operator",
    "part",
    "required",
    "rethrow",
    "return",
    "sealed",
    "set",
    "show",
    "static",
    "super",
    "switch",
    "sync",
    "this",
    "throw",
    "true",
    "try",
    "typedef",
    "var",
    "void",
    "when",
    "while",
    "with",
    "yield",
  ]),
  typescript: new Set([
    "any",
    "as",
    "boolean",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "declare",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "from",
    "function",
    "get",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "number",
    "of",
    "package",
    "private",
    "protected",
    "public",
    "readonly",
    "return",
    "set",
    "static",
    "string",
    "super",
    "switch",
    "symbol",
    "this",
    "throw",
    "true",
    "try",
    "type",
    "typeof",
    "undefined",
    "unknown",
    "var",
    "void",
    "while",
    "with",
    "yield",
  ]),
  python: new Set([
    "False",
    "None",
    "True",
    "and",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "class",
    "continue",
    "def",
    "del",
    "elif",
    "else",
    "except",
    "finally",
    "for",
    "from",
    "global",
    "if",
    "import",
    "in",
    "is",
    "lambda",
    "nonlocal",
    "not",
    "or",
    "pass",
    "raise",
    "return",
    "try",
    "while",
    "with",
    "yield",
  ]),
};

/**
 * Names a generated class must not take, because they resolve in the same scope
 * as the generated declarations. Only PascalCase entries are listed: a class name
 * always starts from capitalized words, so a lowercase builtin such as Python's
 * `list` can never be produced.
 */
const RESERVED_CLASS_NAMES: Record<Language, ReadonlySet<string>> = {
  dart: new Set([
    "DateTime",
    "Enum",
    "Function",
    "Iterable",
    "List",
    "Map",
    "Never",
    "Null",
    "Object",
    "Record",
    "Set",
    "String",
    "Symbol",
    "Type",
  ]),
  typescript: new Set([
    "Array",
    "Boolean",
    "Date",
    "Error",
    "Function",
    "Map",
    "Number",
    "Object",
    "Promise",
    "Record",
    "Set",
    "String",
    "Symbol",
  ]),
  python: new Set([
    // `RootModel` is deliberately absent. It is the default root name, and the
    // Python generator imports Pydantic's `RootModel` under an alias when the two
    // would collide, so the generated class keeps the name the user asked for.
    "BaseModel",
    "ConfigDict",
    "Field",
  ]),
};

/**
 * Members a generated Pydantic model already carries. A field with one of these
 * names is swallowed by Pydantic instead of becoming a model field, so it has to
 * be renamed and reached through its alias.
 */
const PYDANTIC_RESERVED_MEMBERS: ReadonlySet<string> = new Set([
  "copy",
  "dict",
  "json",
  "schema",
]);

const PYDANTIC_PROTECTED_PREFIX = "model_";

function words(value: string): string[] {
  // NFKD splits an accented letter into a base letter and a combining mark.
  // Dropping the marks keeps "Zürich" as one word rather than "Zu" and "rich".
  const normalized = value.normalize("NFKD").replace(/\p{M}+/gu, "");
  const matches = normalized.match(WORD_PATTERN);
  if (!matches) {
    return [];
  }
  return matches.flatMap((part) =>
    part
      // Split camelCase and PascalCase runs into separate words.
      .replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1 $2")
      .split(/\s+/)
      .filter(Boolean)
      .flatMap((word) => {
        // "2fa" becomes ["2", "fa"] so the leading digit can be spelled out. A
        // trailing group of digits such as "field_2499" is left alone.
        const leadingNumber = /^(\d+)(\p{L}.*)$/u.exec(word);
        const digits = leadingNumber?.[1];
        const rest = leadingNumber?.[2];
        return digits && rest ? [...digits, rest] : [word];
      }),
  );
}

function normalizedWord(word: string): string {
  if (/^\d$/.test(word)) {
    return NUMBER_WORDS[word] ?? word;
  }
  return word.toLocaleLowerCase("en-US");
}

function capitalize(value: string): string {
  return value.charAt(0).toLocaleUpperCase("en-US") + value.slice(1);
}

/**
 * Dart identifiers accept ASCII letters, digits, `_` and `$` only, so non ASCII
 * letters are dropped. `NFKD` has already reduced accented Latin letters to
 * their base form by this point, so this only affects other scripts.
 */
function toAsciiWords(parts: readonly string[]): string[] {
  return parts
    .map((part) => part.replace(/[^\p{ASCII}]/gu, ""))
    .filter((part) => part.length > 0);
}

function identifierWords(value: string, language: Language): string[] {
  const parts = words(value).map(normalizedWord);
  return language === "dart" ? toAsciiWords(parts) : parts;
}

export function toPascalCase(value: string, fallback = "Model"): string {
  const joined = words(value).map(normalizedWord).map(capitalize).join("");
  const candidate = joined || fallback;
  return /^\p{N}/u.test(candidate) ? `Model${candidate}` : candidate;
}

export function toCamelCase(value: string, fallback = "value"): string {
  const joined = words(value)
    .map(normalizedWord)
    .map((part, index) => (index === 0 ? part : capitalize(part)))
    .join("");
  const candidate = joined || fallback;
  return /^\p{N}/u.test(candidate)
    ? `field${capitalize(candidate)}`
    : candidate;
}

export function toSnakeCase(value: string, fallback = "value"): string {
  const candidate = words(value).map(normalizedWord).join("_") || fallback;
  return /^\p{N}/u.test(candidate) ? `field_${candidate}` : candidate;
}

function escapeReservedProperty(name: string, language: Language): string {
  if (RESERVED[language].has(name)) {
    return `${name}_`;
  }
  if (
    language === "python" &&
    (name.startsWith(PYDANTIC_PROTECTED_PREFIX) ||
      PYDANTIC_RESERVED_MEMBERS.has(name))
  ) {
    return `field_${name}`;
  }
  return name;
}

/**
 * Returns a legal property name for the language, or `null` when the key cannot
 * be expressed as an identifier at all. Dart is the only target that rejects non
 * ASCII keys, so callers must supply a generated name in that case.
 */
export function propertyNameFor(
  jsonKey: string,
  language: Language,
): string | null {
  const parts = identifierWords(jsonKey, language);
  if (parts.length === 0) {
    return null;
  }
  const joined =
    language === "python"
      ? parts.join("_")
      : parts
          .map((part, index) => (index === 0 ? part : capitalize(part)))
          .join("");
  if (joined.length === 0) {
    return null;
  }
  const prefixed = /^\p{N}/u.test(joined)
    ? language === "python"
      ? `field_${joined}`
      : `field${capitalize(joined)}`
    : joined;
  return escapeReservedProperty(prefixed, language);
}

export function safePropertyName(value: string, language: Language): string {
  return propertyNameFor(value, language) ?? "field";
}

export function safeClassName(
  value: string,
  language: Language,
  fallback = "Model",
): string {
  const parts = identifierWords(value, language).map(capitalize);
  const joined = parts.join("") || fallback;
  const candidate = /^\p{N}/u.test(joined) ? `Model${joined}` : joined;
  if (
    RESERVED[language].has(candidate) ||
    RESERVED_CLASS_NAMES[language].has(candidate)
  ) {
    return `${candidate}Model`;
  }
  return candidate;
}

export function uniqueName(base: string, used: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (used.has(candidate)) {
    candidate = `${base}${suffix}`;
    suffix += 1;
  }
  used.add(candidate);
  return candidate;
}

export function isValidIdentifier(value: string, language: Language): boolean {
  const pattern =
    language === "dart"
      ? /^[A-Za-z_$][A-Za-z0-9_$]*$/u
      : /^[\p{L}_$][\p{L}\p{N}_$]*$/u;
  return pattern.test(value) && !RESERVED[language].has(value);
}

/**
 * Quotes a string for the target language. Dart interpolates `$` inside string
 * literals, so it has to be escaped there.
 */
export function quoteString(
  value: string,
  quote: "'" | '"' = "'",
  options: { readonly escapeDollar?: boolean } = {},
): string {
  let escaped = "";
  for (const character of value) {
    if (character === "\\") {
      escaped += "\\\\";
    } else if (character === quote) {
      escaped += `\\${quote}`;
    } else if (character === "\b") {
      escaped += "\\b";
    } else if (character === "\f") {
      escaped += "\\f";
    } else if (character === "\n") {
      escaped += "\\n";
    } else if (character === "\r") {
      escaped += "\\r";
    } else if (character === "\t") {
      escaped += "\\t";
    } else {
      const code = character.charCodeAt(0);
      escaped +=
        code <= 0x1f || code === 0x7f || code === 0x2028 || code === 0x2029
          ? `\\u${code.toString(16).padStart(4, "0")}`
          : character;
    }
  }
  if (options.escapeDollar) {
    escaped = escaped.replaceAll("$", "\\$");
  }
  return `${quote}${escaped}${quote}`;
}
