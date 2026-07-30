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

const RESERVED: Record<
  "dart" | "typescript" | "python",
  ReadonlySet<string>
> = {
  dart: new Set([
    "abstract",
    "as",
    "assert",
    "async",
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
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

function words(value: string): string[] {
  return (
    value
      .normalize("NFKD")
      .match(WORD_PATTERN)
      ?.flatMap((part) =>
        part
          .replace(/([\p{Ll}\d])([\p{Lu}])/gu, "$1 $2")
          .split(/\s+/)
          .filter(Boolean)
          .flatMap((word) => {
            const leadingNumber = /^(\d+)(\p{L}.*)$/u.exec(word);
            return leadingNumber
              ? [...leadingNumber[1], leadingNumber[2]]
              : [word];
          }),
      ) ?? []
  );
}

function normalizedWord(word: string): string {
  if (/^\d$/.test(word)) {
    return NUMBER_WORDS[word] ?? word;
  }
  return word.toLocaleLowerCase("en-US");
}

export function toPascalCase(value: string, fallback = "Model"): string {
  const parts = words(value);
  const joined = parts
    .map(normalizedWord)
    .map((part) => part.charAt(0).toLocaleUpperCase("en-US") + part.slice(1))
    .join("");
  const candidate = joined || fallback;
  return /^\p{N}/u.test(candidate) ? `Model${candidate}` : candidate;
}

export function toCamelCase(value: string, fallback = "value"): string {
  const pascal = toPascalCase(value, toPascalCase(fallback));
  const candidate =
    pascal.charAt(0).toLocaleLowerCase("en-US") + pascal.slice(1);
  return /^\p{N}/u.test(candidate) ? `value${candidate}` : candidate;
}

export function toSnakeCase(value: string, fallback = "value"): string {
  const candidate = words(value).map(normalizedWord).join("_") || fallback;
  return /^\p{N}/u.test(candidate) ? `value_${candidate}` : candidate;
}

export function safePropertyName(
  value: string,
  language: "dart" | "typescript" | "python",
): string {
  const candidate =
    language === "python" ? toSnakeCase(value) : toCamelCase(value);
  return RESERVED[language].has(candidate) ? `${candidate}_` : candidate;
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

export function isValidIdentifier(
  value: string,
  language: "dart" | "typescript" | "python",
): boolean {
  return (
    /^[\p{L}_$][\p{L}\p{N}_$]*$/u.test(value) && !RESERVED[language].has(value)
  );
}

export function quoteString(value: string, quote: "'" | '"' = "'"): string {
  const escaped = value
    .replaceAll("\\", "\\\\")
    .replaceAll(quote, `\\${quote}`)
    .replaceAll("\n", "\\n")
    .replaceAll("\r", "\\r");
  return `${quote}${escaped}${quote}`;
}
