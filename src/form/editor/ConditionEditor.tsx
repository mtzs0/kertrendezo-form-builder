import { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Code2, Eye, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ConditionGroup,
  FieldCondition,
  FormField,
  OptionField,
} from "@/form/types";
import {
  parseConditionText,
  serializeCondition,
  ConditionParseError,
} from "@/form/conditionText";

interface Props {
  /** The field whose condition is being edited (excluded from the picker). */
  currentFieldId: string;
  /** Label of the field this condition applies to (for the header). */
  currentFieldLabel?: string;
  allFields: FormField[];
  value: ConditionGroup | undefined;
  onChange: (next: ConditionGroup | undefined) => void;
}

const OPERATOR_LABELS: Record<FieldCondition["operator"], string> = {
  equals: "egyenlő (=)",
  is: "az (=)",
  is_not: "nem egyenlő (!=)",
  greater_than: "nagyobb mint (>)",
  less_than: "kisebb mint (<)",
  contains: "tartalmazza",
  answered: "megválaszolva",
};

function emptyCondition(fieldId: string): FieldCondition {
  return { fieldId, operator: "equals", value: "" };
}

function emptyGroup(): ConditionGroup {
  return { combinator: "and", rules: [] };
}

export function ConditionEditor({
  currentFieldId,
  currentFieldLabel,
  allFields,
  value,
  onChange,
}: Props) {
  const root: ConditionGroup = value ?? emptyGroup();
  const [mode, setMode] = useState<"visual" | "text">("visual");
  const otherFields = useMemo(
    () => allFields.filter((f) => f.id !== currentFieldId && f.internalName),
    [allFields, currentFieldId]
  );

  const commit = (next: ConditionGroup) => {
    if (next.rules.length === 0) onChange(undefined);
    else onChange(next);
  };

  const addRootCondition = () => {
    commit({
      ...root,
      rules: [...root.rules, emptyCondition(otherFields[0]?.id ?? "")],
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Feltétel szerkesztő
          </p>
          <h3 className="text-lg font-semibold truncate">
            Feltétel
            {currentFieldLabel && (
              <span className="text-muted-foreground font-normal">
                {" "}— {currentFieldLabel}
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            A mező csak akkor jelenik meg, ha az alábbi feltétel(ek) igazak.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={cn(
              "px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5 transition-colors",
              mode === "visual"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent"
            )}
          >
            <Eye className="h-3.5 w-3.5" /> Vizuális
          </button>
          <button
            type="button"
            onClick={() => setMode("text")}
            className={cn(
              "px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5 transition-colors",
              mode === "text"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent"
            )}
          >
            <Code2 className="h-3.5 w-3.5" /> Szöveg
          </button>
        </div>
      </div>

      {otherFields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Még nincs másik mező, amire feltételt lehetne építeni.
        </div>
      ) : mode === "visual" ? (
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/30 border border-border p-3 space-y-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
              Feltételek
            </div>

            {root.rules.length === 0 && (
              <p className="text-xs text-muted-foreground italic px-1 py-2">
                Még nincs feltétel. Adj hozzá egyet az alábbi gombbal.
              </p>
            )}

            <RuleList
              group={root}
              otherFields={otherFields}
              onChange={(next) => commit(next)}
            />

            <div className="pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRootCondition}
                className="h-7 text-xs"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Feltétel
              </Button>
            </div>
          </div>

          {value && value.rules.length > 0 && (
            <div className="flex justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(undefined)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Összes feltétel
                eltávolítása
              </Button>
            </div>
          )}
        </div>
      ) : (
        <TextEditor
          group={root}
          allFields={allFields}
          onCommit={(g) => commit(g)}
        />
      )}
    </div>
  );
}

// ---------- Visual: RuleList ----------
//
// Renders the rules of a group with a clickable AND/OR connector
// between siblings (no separate combinator dropdown).

interface RuleListProps {
  group: ConditionGroup;
  otherFields: FormField[];
  onChange: (next: ConditionGroup) => void;
}

function RuleList({ group, otherFields, onChange }: RuleListProps) {
  const updateRule = (
    index: number,
    next: ConditionGroup | FieldCondition | null
  ) => {
    const rules = group.rules.slice();
    if (next === null) rules.splice(index, 1);
    else rules[index] = next;
    // Unwrap groups with a single rule to flatten the tree.
    const cleaned = rules.map((r) => {
      if ("combinator" in r && r.rules.length === 1) {
        const only = r.rules[0];
        return only;
      }
      return r;
    });
    onChange({ ...group, rules: cleaned });
  };

  // Insert a new rule into a sub-group with the rule at index, creating
  // the group if needed. This is what "+ Feltétel" under a row does.
  const addUnderRow = (index: number) => {
    const existing = group.rules[index];
    const fresh = emptyCondition(otherFields[0]?.id ?? "");
    let newGroup: ConditionGroup;
    if ("combinator" in existing) {
      newGroup = { ...existing, rules: [...existing.rules, fresh] };
    } else {
      newGroup = { combinator: "and", rules: [existing, fresh] };
    }
    const rules = group.rules.slice();
    rules[index] = newGroup;
    onChange({ ...group, rules });
  };

  const toggleCombinator = () => {
    onChange({
      ...group,
      combinator: group.combinator === "and" ? "or" : "and",
    });
  };

  return (
    <div className="space-y-1.5">
      {group.rules.map((rule, i) => (
        <div key={i} className="space-y-1.5">
          {i > 0 && (
            <CombinatorChip
              value={group.combinator}
              onClick={toggleCombinator}
            />
          )}
          {"combinator" in rule ? (
            <NestedGroup
              group={rule}
              otherFields={otherFields}
              onChange={(next) => updateRule(i, next)}
              onAddSibling={() => addUnderRow(i)}
            />
          ) : (rule as { kind?: string }).kind === "group_seen" ? (
            <div className="rounded-md border border-dashed border-border bg-muted/40 p-2.5 text-xs text-muted-foreground flex items-center justify-between gap-2">
              <span>
                Csoport-feltétel ({(rule as { seen: boolean }).seen ? "látott" : "nem látott"}). Szerkeszd a Vizuális feltételek fülön.
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => updateRule(i, null)}
                className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <ConditionRow
              condition={rule as FieldCondition}
              otherFields={otherFields}
              onChange={(next) => updateRule(i, next)}
              onRemove={() => updateRule(i, null)}
              onAddBelow={() => addUnderRow(i)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ---------- Visual: NestedGroup (renders a parenthesized sub-group) ----------

interface NestedGroupProps {
  group: ConditionGroup;
  otherFields: FormField[];
  onChange: (next: ConditionGroup | null) => void;
  onAddSibling: () => void;
}

function NestedGroup({
  group,
  otherFields,
  onChange,
  onAddSibling,
}: NestedGroupProps) {
  return (
    <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
          Csoport
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onChange(null)}
          className="h-6 px-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
          aria-label="Csoport törlése"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
      <RuleList
        group={group}
        otherFields={otherFields}
        onChange={(next) => onChange(next)}
      />
      <div className="pt-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddSibling}
          className="h-6 px-2 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" /> Feltétel a csoportba
        </Button>
      </div>
    </div>
  );
}

// ---------- Visual: AND/OR chip between sibling rules ----------

function CombinatorChip({
  value,
  onClick,
}: {
  value: "and" | "or";
  onClick: () => void;
}) {
  return (
    <div className="flex items-center gap-2 pl-2">
      <div className="h-px w-3 bg-border" />
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "text-[10px] font-bold uppercase tracking-wide rounded px-2 py-0.5 border transition-colors",
          value === "and"
            ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
            : "bg-accent border-border text-foreground hover:bg-accent/80"
        )}
        title="Kattints az ÉS / VAGY váltáshoz"
      >
        {value === "and" ? "ÉS" : "VAGY"}
      </button>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ---------- Visual: ConditionRow ----------

interface ConditionRowProps {
  condition: FieldCondition;
  otherFields: FormField[];
  onChange: (next: FieldCondition) => void;
  onRemove: () => void;
  onAddBelow: () => void;
}

const NUMERIC_TYPES = new Set(["slider"]);

function ConditionRow({
  condition,
  otherFields,
  onChange,
  onRemove,
  onAddBelow,
}: ConditionRowProps) {
  const field = otherFields.find((f) => f.id === condition.fieldId);
  const isNumeric = field ? NUMERIC_TYPES.has(field.type) : false;
  const isOption =
    field &&
    (field.type === "radio" || field.type === "checkbox" || field.type === "select");

  const operators: FieldCondition["operator"][] = isNumeric
    ? ["equals", "is_not", "greater_than", "less_than", "answered"]
    : isOption
    ? ["equals", "is_not", "contains", "answered"]
    : ["equals", "is_not", "contains", "answered"];

  const needsValue = condition.operator !== "answered";

  return (
    <div className="rounded-md border border-border bg-background p-2.5 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-2 items-end">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Mező
          </Label>
          <Select
            value={condition.fieldId || ""}
            onValueChange={(v) => onChange({ ...condition, fieldId: v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Válassz mezőt" />
            </SelectTrigger>
            <SelectContent>
              {otherFields.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {f.label || f.internalName} ({f.internalName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Feltétel típusa
          </Label>
          <Select
            value={condition.operator}
            onValueChange={(v) =>
              onChange({ ...condition, operator: v as FieldCondition["operator"] })
            }
          >
            <SelectTrigger className="h-9 w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {needsValue ? (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Feltétel értéke
            </Label>
            <ValueInput
              field={field ?? null}
              isNumeric={isNumeric}
              value={condition.value}
              onChange={(v) => onChange({ ...condition, value: v })}
            />
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
              Érték
            </Label>
            <p className="h-9 flex items-center text-xs text-muted-foreground italic">
              Bármely válasz elegendő
            </p>
          </div>
        )}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
          aria-label="Feltétel törlése"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddBelow}
          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          title="Új feltétel csoportban ezzel"
        >
          <Plus className="h-3 w-3 mr-1" /> Feltétel
        </Button>
      </div>
    </div>
  );
}

interface ValueInputProps {
  field: FormField | null;
  isNumeric: boolean;
  value: FieldCondition["value"];
  onChange: (v: FieldCondition["value"]) => void;
}

function ValueInput({ field, isNumeric, value, onChange }: ValueInputProps) {
  if (
    field &&
    (field.type === "radio" || field.type === "checkbox" || field.type === "select")
  ) {
    const opts = (field as OptionField).options ?? [];
    return (
      <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder="Válassz értéket" />
        </SelectTrigger>
        <SelectContent>
          {opts.length === 0 && (
            <SelectItem value="__empty" disabled>
              Nincs opció
            </SelectItem>
          )}
          {opts.map((o) => (
            <SelectItem key={o.dataName} value={o.dataName}>
              {o.displayName} ({o.dataName})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  if (isNumeric) {
    return (
      <Input
        type="number"
        className="h-9"
        value={value === undefined || value === null ? "" : String(value)}
        onChange={(e) =>
          onChange(e.target.value === "" ? "" : Number(e.target.value))
        }
        placeholder="pl. 10"
      />
    );
  }
  return (
    <Input
      className="h-9"
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Érték"
    />
  );
}

// ---------- Text editor with autocomplete ----------
//
// Suggestions:
//  - Field internal names while typing an identifier.
//  - Option dataNames after `<fieldname> <op> "` (the user is filling
//    in a value for an option-type field).

interface TextEditorProps {
  group: ConditionGroup;
  allFields: FormField[];
  onCommit: (g: ConditionGroup) => void;
}

type Suggestion =
  | { kind: "field"; field: FormField }
  | { kind: "option"; dataName: string; displayName: string };

function TextEditor({ group, allFields, onCommit }: TextEditorProps) {
  const initial = useMemo(() => serializeCondition(group, allFields), []);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setError(null);
  }, [text]);

  // Detect whether the cursor is inside an open quoted value following
  // `<fieldname> <op> "<partial>` and return the field + partial token.
  const detectOptionContext = (
    val: string,
    cursor: number
  ): { field: OptionField; partial: string; quoteStart: number } | null => {
    // Walk backward from cursor to find an unmatched opening quote.
    let i = cursor - 1;
    while (i >= 0) {
      const c = val[i];
      if (c === '"' || c === "'") {
        // Check it's an opening quote (i.e., not preceded by a closing pair).
        const before = val.slice(0, i);
        const quoteCount = (before.match(/(?<!\\)["']/g) ?? []).length;
        if (quoteCount % 2 === 0) {
          // This is an opening quote.
          const partial = val.slice(i + 1, cursor);
          if (/[\n\r]/.test(partial)) return null;
          // Look back further for `<fieldname> <op>`.
          const head = val.slice(0, i).trimEnd();
          const m = head.match(
            /([A-Za-z_][A-Za-z0-9_]*)\s*(==|=|!=|is_not|isnot|is|contains)\s*$/
          );
          if (!m) return null;
          const fname = m[1];
          const field = allFields.find(
            (f) => f.internalName === fname &&
              (f.type === "radio" || f.type === "checkbox" || f.type === "select")
          ) as OptionField | undefined;
          if (!field) return null;
          return { field, partial, quoteStart: i };
        }
        return null;
      }
      i--;
    }
    return null;
  };

  const updateSuggestions = (val: string, cursor: number) => {
    // 1) Option-value autocomplete inside an open quote.
    const opt = detectOptionContext(val, cursor);
    if (opt) {
      const matches = (opt.field.options ?? [])
        .filter((o) =>
          o.dataName.toLowerCase().startsWith(opt.partial.toLowerCase())
        )
        .slice(0, 8)
        .map<Suggestion>((o) => ({
          kind: "option",
          dataName: o.dataName,
          displayName: o.displayName,
        }));
      setSuggestions(matches);
      setHighlight(0);
      return;
    }
    // 2) Field-name autocomplete on identifier word.
    let start = cursor;
    while (start > 0 && /[A-Za-z0-9_]/.test(val[start - 1])) start--;
    const word = val.slice(start, cursor);
    if (!word) {
      setSuggestions([]);
      return;
    }
    const matches = allFields
      .filter((f) => f.internalName?.toLowerCase().startsWith(word.toLowerCase()))
      .slice(0, 8)
      .map<Suggestion>((f) => ({ kind: "field", field: f }));
    setSuggestions(matches);
    setHighlight(0);
  };

  const acceptSuggestion = (s: Suggestion) => {
    const input = inputRef.current;
    if (!input) return;
    const cursor = input.selectionStart ?? text.length;
    if (s.kind === "option") {
      // Replace the partial inside the quotes with the dataName, keep quotes open.
      let i = cursor;
      while (i > 0 && text[i - 1] !== '"' && text[i - 1] !== "'") i--;
      const next = text.slice(0, i) + s.dataName + text.slice(cursor);
      setText(next);
      setSuggestions([]);
      requestAnimationFrame(() => {
        const pos = i + s.dataName.length;
        input.setSelectionRange(pos, pos);
        input.focus();
      });
      return;
    }
    let start = cursor;
    while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start--;
    const next = text.slice(0, start) + s.field.internalName + text.slice(cursor);
    setText(next);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const pos = start + s.field.internalName.length;
      input.setSelectionRange(pos, pos);
      input.focus();
    });
  };

  const handleCommit = () => {
    try {
      const parsed = parseConditionText(text, allFields);
      setError(null);
      onCommit(parsed);
    } catch (e) {
      if (e instanceof ConditionParseError) {
        setError(`${e.message}${e.position >= 0 ? ` (poz. ${e.position + 1})` : ""}`);
      } else {
        setError(e instanceof Error ? e.message : "Ismeretlen hiba");
      }
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            updateSuggestions(
              e.target.value,
              e.target.selectionStart ?? e.target.value.length
            );
          }}
          onKeyUp={(e) => {
            const t = e.currentTarget;
            if (
              e.key === "ArrowLeft" ||
              e.key === "ArrowRight" ||
              e.key === "Home" ||
              e.key === "End"
            ) {
              updateSuggestions(t.value, t.selectionStart ?? t.value.length);
            }
          }}
          onKeyDown={(e) => {
            if (suggestions.length > 0) {
              if (e.key === "Tab" || e.key === "Enter") {
                e.preventDefault();
                acceptSuggestion(suggestions[highlight]);
                return;
              }
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => (h + 1) % suggestions.length);
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight(
                  (h) => (h - 1 + suggestions.length) % suggestions.length
                );
                return;
              }
              if (e.key === "Escape") {
                setSuggestions([]);
                return;
              }
            }
            if (e.key === "Enter") {
              e.preventDefault();
              handleCommit();
            }
          }}
          placeholder='pl. nev = "Anna" && (kor > 18 || hozzajarulas = true)'
          className="font-mono text-sm"
          spellCheck={false}
        />
        {suggestions.length > 0 && (
          <div className="absolute z-20 left-0 right-0 top-full mt-1 rounded-md border border-border bg-popover shadow-md overflow-hidden">
            {suggestions.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  acceptSuggestion(s);
                }}
                className={cn(
                  "block w-full text-left px-3 py-1.5 text-sm",
                  i === highlight ? "bg-accent" : "hover:bg-accent/50"
                )}
              >
                {s.kind === "field" ? (
                  <>
                    <span className="font-mono">{s.field.internalName}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {s.field.label}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-mono">{s.dataName}</span>
                    <span className="text-muted-foreground ml-2 text-xs">
                      {s.displayName}
                    </span>
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Operátorok: <code>= != &gt; &lt; contains answered</code> · logika:{" "}
          <code>&amp;&amp; ||</code> · csoportosítás: <code>( )</code>. Tab a
          javaslat elfogadásához.
        </p>
        <Button type="button" size="sm" onClick={handleCommit} className="h-8">
          <Pencil className="h-3.5 w-3.5 mr-1" /> Alkalmaz
        </Button>
      </div>
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
}
