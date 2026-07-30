import type {
  JsonErrorDetails,
  ParseResult,
  SchemaWarning,
} from "@/src/schema/types";
import { Json2ModelError } from "@/src/schema/types";

export const MAX_INPUT_CHARACTERS = 2_000_000;

const JSON_NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?(?=\s*[,}\]])/g;

function maskStrings(source: string): string {
  let inString = false;
  let escaped = false;
  let result = "";

  for (const character of source) {
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
        result += '"';
        continue;
      }
      result += " ";
      continue;
    }

    if (character === '"') {
      inString = true;
    }
    result += character;
  }

  return result;
}

function findLargeIntegers(source: string): readonly SchemaWarning[] {
  const warnings: SchemaWarning[] = [];
  const masked = maskStrings(source);

  for (const match of masked.matchAll(JSON_NUMBER)) {
    const token = match[0];
    if (token.includes(".") || /e/i.test(token)) {
      continue;
    }
    const magnitude = token.startsWith("-") ? token.slice(1) : token;
    if (
      magnitude.length > 16 ||
      (magnitude.length === 16 &&
        BigInt(token) > BigInt(Number.MAX_SAFE_INTEGER)) ||
      (magnitude.length === 16 &&
        BigInt(token) < BigInt(Number.MIN_SAFE_INTEGER))
    ) {
      warnings.push({
        code: "large-integer",
        path: "$",
        message:
          "A large integer exceeds JavaScript safe precision. The generated model keeps an integer type, but the pasted value should be handled as a string when exact digits matter.",
      });
      break;
    }
  }

  return warnings;
}

function positionFromOffset(
  source: string,
  offset: number,
): Pick<JsonErrorDetails, "line" | "column"> {
  const before = source.slice(0, Math.max(0, offset));
  const lines = before.split("\n");
  return {
    line: lines.length,
    column: (lines.at(-1)?.length ?? 0) + 1,
  };
}

function parseNativeError(source: string, error: unknown): JsonErrorDetails {
  const rawMessage = error instanceof Error ? error.message : "Invalid JSON.";
  const positionMatch = /position\s+(\d+)/i.exec(rawMessage);
  const lineColumnMatch = /line\s+(\d+)\s+column\s+(\d+)/i.exec(rawMessage);

  let line: number | null = null;
  let column: number | null = null;

  if (lineColumnMatch) {
    line = Number(lineColumnMatch[1]);
    column = Number(lineColumnMatch[2]);
  } else if (positionMatch) {
    ({ line, column } = positionFromOffset(source, Number(positionMatch[1])));
  }

  const lower = rawMessage.toLowerCase();
  let reason = "Check the JSON syntax and try again.";
  if (lower.includes("unexpected end")) {
    reason = "The document ended before a value or closing bracket was found.";
  } else if (
    lower.includes("property") ||
    lower.includes("double-quoted") ||
    lower.includes("expected")
  ) {
    reason = "Expected a comma, a quoted property name, or a closing bracket.";
  } else if (lower.includes("token") || lower.includes("character")) {
    reason = "An unexpected character was found.";
  }

  const location =
    line !== null && column !== null
      ? ` near line ${line}, column ${column}`
      : "";

  return {
    message: `Invalid JSON${location}. ${reason}`,
    line,
    column,
  };
}

export function parseJson(source: string): ParseResult {
  if (source.length > MAX_INPUT_CHARACTERS) {
    throw new Json2ModelError(
      "input-too-large",
      `Input is too large. JSON2Model accepts up to ${MAX_INPUT_CHARACTERS.toLocaleString()} characters.`,
    );
  }

  try {
    return {
      ok: true,
      parsed: {
        value: JSON.parse(source) as unknown,
        warnings: findLargeIntegers(source),
      },
    };
  } catch (error: unknown) {
    return { ok: false, error: parseNativeError(source, error) };
  }
}
