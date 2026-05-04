// Tiny expression language for field display conditions.
//
// Syntax (examples):
//   age > 10
//   name = "John"
//   color = red || color = blue
//   age >= 18 && (country = "HU" || country = "AT")
//   tags contains gold
//   subscribed != true
//
// Operators:
//   = == is        equality
//   != is_not      inequality
//   > >= < <=      numeric comparisons
//   contains       substring / array membership
//   && and         conjunction
//   || or          disjunction
//   ( )            grouping
//
// Field references are written as their internal name (bare identifier).
// Values can be:
//   - bare identifiers (treated as strings, e.g. red)
//   - quoted strings ("John Doe")
//   - numbers (10, 3.14)
//   - booleans (true / false)
//
// The parser produces a ConditionGroup tree where each FieldCondition uses
// the resolved field id (not its internal name) so renames are safe.

import type {
  ConditionGroup,
  ConditionRule,
  FieldCondition,
  FormField,
} from "./types";

// ---------- Tokenizer ----------

type TokenType =
  | "ident"
  | "string"
  | "number"
  | "bool"
  | "op"
  | "and"
  | "or"
  | "lparen"
  | "rparen";

interface Token {
  type: TokenType;
  value: string;
  start: number;
  end: number;
}

const OPERATORS = new Map<string, FieldCondition["operator"]>([
  ["=", "equals"],
  ["==", "equals"],
  ["is", "equals"],
  ["!=", "is_not"],
  ["is_not", "is_not"],
  ["isnot", "is_not"],
  [">", "greater_than"],
  [">=", "greater_than"], // approximated; we only have >, < — see note
  ["<", "less_than"],
  ["<=", "less_than"],
  ["contains", "contains"],
  ["answered", "answered"],
]);

export class ConditionParseError extends Error {
  position: number;
  constructor(message: string, position: number) {
    super(message);
    this.position = position;
  }
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ type: "lparen", value: "(", start: i, end: i + 1 });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen", value: ")", start: i, end: i + 1 });
      i++;
      continue;
    }
    if (c === "&" && input[i + 1] === "&") {
      tokens.push({ type: "and", value: "&&", start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (c === "|" && input[i + 1] === "|") {
      tokens.push({ type: "or", value: "||", start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (c === "!" && input[i + 1] === "=") {
      tokens.push({ type: "op", value: "!=", start: i, end: i + 2 });
      i += 2;
      continue;
    }
    if (c === ">" || c === "<") {
      if (input[i + 1] === "=") {
        tokens.push({ type: "op", value: c + "=", start: i, end: i + 2 });
        i += 2;
      } else {
        tokens.push({ type: "op", value: c, start: i, end: i + 1 });
        i++;
      }
      continue;
    }
    if (c === "=") {
      if (input[i + 1] === "=") {
        tokens.push({ type: "op", value: "==", start: i, end: i + 2 });
        i += 2;
      } else {
        tokens.push({ type: "op", value: "=", start: i, end: i + 1 });
        i++;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      const start = i;
      i++;
      let v = "";
      while (i < input.length && input[i] !== quote) {
        if (input[i] === "\\" && i + 1 < input.length) {
          v += input[i + 1];
          i += 2;
        } else {
          v += input[i];
          i++;
        }
      }
      if (i >= input.length) {
        throw new ConditionParseError("Lezáratlan idézőjel", start);
      }
      i++; // consume closing quote
      tokens.push({ type: "string", value: v, start, end: i });
      continue;
    }
    if (/[0-9]/.test(c) || (c === "-" && /[0-9]/.test(input[i + 1] ?? ""))) {
      const start = i;
      if (c === "-") i++;
      while (i < input.length && /[0-9.]/.test(input[i])) i++;
      const value = input.slice(start, i);
      tokens.push({ type: "number", value, start, end: i });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const start = i;
      while (i < input.length && /[A-Za-z0-9_]/.test(input[i])) i++;
      const word = input.slice(start, i);
      const lower = word.toLowerCase();
      if (lower === "and") {
        tokens.push({ type: "and", value: word, start, end: i });
      } else if (lower === "or") {
        tokens.push({ type: "or", value: word, start, end: i });
      } else if (lower === "true" || lower === "false") {
        tokens.push({ type: "bool", value: lower, start, end: i });
      } else if (lower === "is" || lower === "contains" || lower === "answered") {
        tokens.push({ type: "op", value: lower, start, end: i });
      } else {
        tokens.push({ type: "ident", value: word, start, end: i });
      }
      continue;
    }
    throw new ConditionParseError(`Ismeretlen karakter: '${c}'`, i);
  }
  return tokens;
}

// ---------- Parser ----------

interface ParseCtx {
  tokens: Token[];
  pos: number;
  fieldsByInternalName: Map<string, FormField>;
}

function peek(ctx: ParseCtx): Token | null {
  return ctx.tokens[ctx.pos] ?? null;
}
function consume(ctx: ParseCtx): Token {
  const t = ctx.tokens[ctx.pos++];
  if (!t) throw new ConditionParseError("Váratlan vég", -1);
  return t;
}

function parseValue(t: Token): string | number | boolean {
  if (t.type === "number") return Number(t.value);
  if (t.type === "bool") return t.value === "true";
  if (t.type === "string") return t.value;
  if (t.type === "ident") return t.value;
  throw new ConditionParseError(`Várható érték, kapott: ${t.value}`, t.start);
}

function parseCondition(ctx: ParseCtx): FieldCondition {
  const fieldTok = consume(ctx);
  if (fieldTok.type !== "ident") {
    throw new ConditionParseError(
      `Mezőnév várható, kapott: ${fieldTok.value}`,
      fieldTok.start
    );
  }
  const field = ctx.fieldsByInternalName.get(fieldTok.value);
  if (!field) {
    throw new ConditionParseError(
      `Ismeretlen mező: ${fieldTok.value}`,
      fieldTok.start
    );
  }
  // Check for "is not" two-word form
  const opTok = consume(ctx);
  let opStr = opTok.value.toLowerCase();
  if (opStr === "is" && peek(ctx)?.type === "ident" && peek(ctx)?.value.toLowerCase() === "not") {
    consume(ctx);
    opStr = "is_not";
  }
  const operator = OPERATORS.get(opStr);
  if (!operator) {
    throw new ConditionParseError(
      `Ismeretlen művelet: ${opTok.value}`,
      opTok.start
    );
  }
  // "answered" takes no value — short-circuit before reading the value token.
  if (operator === "answered") {
    return { fieldId: field.id, operator, value: "" };
  }
  const valTok = consume(ctx);
  const value = parseValue(valTok);
  return { fieldId: field.id, operator, value };
}

function parseAtom(ctx: ParseCtx): ConditionGroup | FieldCondition {
  const t = peek(ctx);
  if (!t) throw new ConditionParseError("Váratlan vég", -1);
  if (t.type === "lparen") {
    consume(ctx);
    const group = parseOr(ctx);
    const close = consume(ctx);
    if (close.type !== "rparen") {
      throw new ConditionParseError("Hiányzó záró zárójel", close.start);
    }
    return group;
  }
  return parseCondition(ctx);
}

function parseAnd(ctx: ParseCtx): ConditionGroup {
  const first = parseAtom(ctx);
  const rules: Array<ConditionRule> = [first];
  while (peek(ctx)?.type === "and") {
    consume(ctx);
    rules.push(parseAtom(ctx));
  }
  if (rules.length === 1) {
    // Wrap single atom for uniform return type at the OR level.
    return { combinator: "and", rules };
  }
  return { combinator: "and", rules };
}

function parseOr(ctx: ParseCtx): ConditionGroup {
  const first = parseAnd(ctx);
  const rules: Array<ConditionRule> = [unwrapSingle(first)];
  while (peek(ctx)?.type === "or") {
    consume(ctx);
    rules.push(unwrapSingle(parseAnd(ctx)));
  }
  if (rules.length === 1) {
    return first;
  }
  return { combinator: "or", rules };
}

/** If a group contains a single rule, unwrap it to keep the tree shallow. */
function unwrapSingle(g: ConditionGroup): ConditionRule {
  if (g.rules.length === 1) {
    const only = g.rules[0];
    return only;
  }
  return g;
}

export function parseConditionText(
  input: string,
  fields: FormField[]
): ConditionGroup {
  const trimmed = input.trim();
  if (!trimmed) return { combinator: "and", rules: [] };
  const tokens = tokenize(trimmed);
  if (!tokens.length) return { combinator: "and", rules: [] };
  const map = new Map<string, FormField>();
  for (const f of fields) {
    if (f.internalName) map.set(f.internalName, f);
  }
  const ctx: ParseCtx = { tokens, pos: 0, fieldsByInternalName: map };
  const group = parseOr(ctx);
  if (ctx.pos < tokens.length) {
    const extra = tokens[ctx.pos];
    throw new ConditionParseError(
      `Váratlan token: ${extra.value}`,
      extra.start
    );
  }
  // Ensure top-level is always a group.
  if ("combinator" in group) return group;
  return { combinator: "and", rules: [group] };
}

// ---------- Serializer ----------

const OP_TO_TEXT: Record<FieldCondition["operator"], string> = {
  equals: "=",
  is: "=",
  is_not: "!=",
  greater_than: ">",
  less_than: "<",
  contains: "contains",
  answered: "answered",
};

function valueToText(value: FieldCondition["value"]): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  const s = String(value);
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(s)) return s;
  return `"${s.replace(/"/g, '\\"')}"`;
}

function conditionToText(
  c: FieldCondition,
  fieldsById: Map<string, FormField>
): string {
  const f = fieldsById.get(c.fieldId);
  const name = f?.internalName ?? `unknown_${c.fieldId.slice(0, 6)}`;
  if (c.operator === "answered") return `${name} answered`;
  return `${name} ${OP_TO_TEXT[c.operator]} ${valueToText(c.value)}`;
}

function groupToText(
  g: ConditionGroup,
  fieldsById: Map<string, FormField>,
  parentCombinator?: "and" | "or"
): string {
  if (!g.rules.length) return "";
  const sep = g.combinator === "and" ? " && " : " || ";
  const parts = g.rules.map((r) => {
    if ("combinator" in r) {
      const inner = groupToText(r, fieldsById, g.combinator);
      // Wrap nested groups in parens when their combinator differs.
      if (r.rules.length > 1 && r.combinator !== g.combinator) {
        return `(${inner})`;
      }
      return inner;
    }
    if ((r as { kind?: string }).kind === "group_seen") {
      // Group-seen rules have no text representation in this mini-language.
      // Render as a placeholder so the round-trip text stays informative.
      const gs = r as { groupId: string; seen: boolean };
      return `group_${gs.groupId.slice(0, 6)} ${gs.seen ? "seen" : "not_seen"}`;
    }
    return conditionToText(r as FieldCondition, fieldsById);
  });
  const text = parts.join(sep);
  if (
    parentCombinator &&
    g.combinator !== parentCombinator &&
    g.rules.length > 1
  ) {
    return `(${text})`;
  }
  return text;
}

export function serializeCondition(
  group: ConditionGroup | undefined | null,
  fields: FormField[]
): string {
  if (!group || !group.rules.length) return "";
  const map = new Map<string, FormField>();
  for (const f of fields) map.set(f.id, f);
  return groupToText(group, map);
}
