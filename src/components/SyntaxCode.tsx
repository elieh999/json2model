import type { ReactNode } from "react";
import type { TargetLanguage } from "@/src/generators/types";

interface Token {
  readonly text: string;
  readonly type: "plain" | "comment" | "string" | "keyword" | "number";
}

const KEYWORDS = new Set([
  "BaseModel",
  "bool",
  "boolean",
  "class",
  "const",
  "date",
  "datetime",
  "double",
  "dynamic",
  "export",
  "extends",
  "factory",
  "false",
  "final",
  "float",
  "from",
  "import",
  "int",
  "interface",
  "List",
  "list",
  "Map",
  "None",
  "null",
  "number",
  "object",
  "readonly",
  "required",
  "return",
  "RootModel",
  "str",
  "string",
  "true",
  "type",
  "typedef",
  "unknown",
]);

const TOKEN_PATTERN =
  /(\/\/.*$|#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[\p{L}_$][\p{L}\p{N}_$]*\b)/gmu;

function tokenize(line: string): readonly Token[] {
  const tokens: Token[] = [];
  let cursor = 0;

  for (const match of line.matchAll(TOKEN_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      tokens.push({ text: line.slice(cursor, index), type: "plain" });
    }
    const text = match[0];
    let type: Token["type"] = "plain";
    if (text.startsWith("//") || text.startsWith("#")) {
      type = "comment";
    } else if (text.startsWith('"') || text.startsWith("'")) {
      type = "string";
    } else if (/^\d/.test(text)) {
      type = "number";
    } else if (KEYWORDS.has(text)) {
      type = "keyword";
    }
    tokens.push({ text, type });
    cursor = index + text.length;
  }
  if (cursor < line.length) {
    tokens.push({ text: line.slice(cursor), type: "plain" });
  }
  return tokens;
}

function renderLine(line: string, lineIndex: number): ReactNode {
  return (
    <span className="code-line" key={`${lineIndex}-${line.length}`}>
      <span className="line-number" aria-hidden="true">
        {lineIndex + 1}
      </span>
      <span className="line-content">
        {tokenize(line).map((token, tokenIndex) => (
          <span
            className={`syntax-${token.type}`}
            key={`${tokenIndex}-${token.text}`}
          >
            {token.text}
          </span>
        ))}
        {"\n"}
      </span>
    </span>
  );
}

export function SyntaxCode({
  code,
  language,
}: {
  readonly code: string;
  readonly language: TargetLanguage;
}) {
  const lines = code.split("\n");
  return (
    <pre
      className={`code-output language-${language}`}
      aria-label={`Generated ${language} code`}
      tabIndex={0}
    >
      <code>{lines.length <= 3_000 ? lines.map(renderLine) : code}</code>
    </pre>
  );
}
