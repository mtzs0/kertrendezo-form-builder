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
import { Plus, Trash2, FoldVertical, Code2, Eye, Pencil } from "lucide-react";
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
};

function emptyCondition(fieldId: string): FieldCondition {
  return { fieldId, operator: "equals", value: "" };
}

function emptyGroup(): ConditionGroup {
  return { combinator: "and", rules: [] };
}

/** Build a path-keyed accessor that produces a new tree with an updated node. */
type Path = number[];

function updateAtPath(
  group: ConditionGroup,
  path: Path,
  updater: (node: ConditionGroup | FieldCondition) => ConditionGroup | FieldCondition | null
): ConditionGroup {
  if (path.length === 0) {
    const next = updater(group);
    if (!next || !("combinator" in next)) return emptyGroup();
    return next;
  }
  const [head, ...rest] = path;
  const newRules = group.rules
    .map((r, i) => {
      if (i !== head) return r;
      if (rest.length === 0) {
        const next = updater(r);
        return next;
      }
      if ("combinator" in r) {
        return updateAtPath(r, rest, updater);
      }
      return r;
    })
    .filter((r): r is ConditionGroup | FieldCondition => r !== null);
  return { ...group, rules: newRules };
}

function isComplete(c: FieldCondition): boolean {
  return Boolean(c.fieldId) && c.value !== "" && c.value !== undefined && c.value !== null;
}

function pruneEmpty(group: ConditionGroup): ConditionGroup {
  const rules = group.rules
    .map((r) => ("combinator" in r ? pruneEmpty(r) : r))
    .filter((r) => {
      if ("combinator" in r) return r.rules.length > 0;
      return isComplete(r);
    });
  return { ...group, rules };
}

export function ConditionEditor({
  currentFieldId,
  allFields,
  value,
  onChange,
}: Props) {
  const root = value ?? emptyGroup();
  const [mode, setMode] = useState<"visual" | "text">("visual");
  const otherFields = useMemo(
    () => allFields.filter((f) => f.id !== currentFieldId && f.internalName),
    [allFields, currentFieldId]
  );

  const handleRootChange = (next: ConditionGroup) => {
    const pruned = pruneEmpty(next);
    if (pruned.rules.length === 0) onChange(undefined);
    else onChange(pruned);
  };

  return (
    <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Feltétel szerkesztő</p>
          <h3 className="text-lg font-semibold">Feltétel</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Akkor jelenjen meg a mező, ha az alábbi feltétel igaz.
          </p>
        </div>
        <div className="inline-flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("visual")}
            className={cn(
              "px-2.5 py-1.5 text-xs inline-flex items-center gap-1.5 transition-colors",
              mode === "visual"
                ? "bg-primary text-primary-foreground"
                : "bg-background hover:bg-accent"
            )}
            aria-label="Vizuális szerkesztő"
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
            aria-label="Szöveges szerkesztő"
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
        <GroupEditor
          group={root}
          path={[]}
          isRoot
          otherFields={otherFields}
          onChangeRoot={(updater) =>
            handleRootChange(updateAtPath(root, [], updater) as ConditionGroup)
          }
          onChange={(updater) =>
            handleRootChange(updateAtPath(root, [], updater) as ConditionGroup)
          }
        />
      ) : (
        <TextEditor
          group={root}
          allFields={allFields}
          onCommit={(g) => handleRootChange(g)}
        />
      )}

      {value && value.rules.length > 0 && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(undefined)}
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Feltétel eltávolítása
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------- Visual: Group ----------

interface GroupEditorProps {
  group: ConditionGroup;
  path: Path;
  isRoot?: boolean;
  otherFields: FormField[];
  onChangeRoot: (
    updater: (n: ConditionGroup | FieldCondition) => ConditionGroup | FieldCondition | null
  ) => void;
  onChange: (
    updater: (n: ConditionGroup | FieldCondition) => ConditionGroup | FieldCondition | null
  ) => void;
}

function GroupEditor({
  group,
  path,
  isRoot,
  otherFields,
  onChangeRoot,
  onChange,
}: GroupEditorProps) {
  const addCondition = () => {
    onChange((g) => {
      if (!("combinator" in g)) return g;
      return {
        ...g,
        rules: [...g.rules, emptyCondition(otherFields[0]?.id ?? "")],
      };
    });
  };

  const addGroup = () => {
    onChange((g) => {
      if (!("combinator" in g)) return g;
      return { ...g, rules: [...g.rules, emptyGroup()] };
    });
  };

  const removeChild = (index: number) => {
    onChange((g) => {
      if (!("combinator" in g)) return g;
      return { ...g, rules: g.rules.filter((_, i) => i !== index) };
    });
  };

  const updateChild = (
    index: number,
    next: ConditionGroup | FieldCondition
  ) => {
    onChange((g) => {
      if (!("combinator" in g)) return g;
      const rules = g.rules.slice();
      rules[index] = next;
      return { ...g, rules };
    });
  };

  return (
    <div
      className={cn(
        "rounded-lg p-3 space-y-2",
        isRoot
          ? "bg-muted/30 border border-border"
          : "bg-card border border-dashed border-border"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
            {isRoot ? "Feltételek" : "Csoport"}
          </span>
          <Select
            value={group.combinator}
            onValueChange={(v) =>
              onChange((g) =>
                "combinator" in g ? { ...g, combinator: v as "and" | "or" } : g
              )
            }
          >
            <SelectTrigger className="h-7 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="and">ÉS — mind</SelectItem>
              <SelectItem value="or">VAGY — egy is elég</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!isRoot && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(() => null)}
            className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            aria-label="Csoport törlése"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {group.rules.length === 0 && (
        <p className="text-xs text-muted-foreground italic px-1 py-2">
          Még nincs feltétel. Adj hozzá egyet az alábbi gombokkal.
        </p>
      )}

      <div className="space-y-2">
        {group.rules.map((rule, i) => {
          if ("combinator" in rule) {
            return (
              <GroupEditor
                key={i}
                group={rule}
                path={[...path, i]}
                otherFields={otherFields}
                onChangeRoot={onChangeRoot}
                onChange={(updater) => {
                  const next = updater(rule);
                  if (next === null) {
                    removeChild(i);
                  } else if ("combinator" in next) {
                    updateChild(i, next);
                  }
                }}
              />
            );
          }
          return (
            <ConditionRow
              key={i}
              condition={rule}
              otherFields={otherFields}
              onChange={(next) => updateChild(i, next)}
              onRemove={() => removeChild(i)}
            />
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="h-7 text-xs"
        >
          <Plus className="h-3.5 w-3.5 mr-1" /> Feltétel
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addGroup}
          className="h-7 text-xs"
        >
          <FoldVertical className="h-3.5 w-3.5 mr-1" /> Csoport
        </Button>
      </div>
    </div>
  );
}

// ---------- Visual: ConditionRow ----------

interface ConditionRowProps {
  condition: FieldCondition;
  otherFields: FormField[];
  onChange: (next: FieldCondition) => void;
  onRemove: () => void;
}

const NUMERIC_TYPES = new Set(["slider"]);

function ConditionRow({ condition, otherFields, onChange, onRemove }: ConditionRowProps) {
  const field = otherFields.find((f) => f.id === condition.fieldId);
  const isNumeric = field ? NUMERIC_TYPES.has(field.type) : false;
  const isOption =
    field && (field.type === "radio" || field.type === "checkbox" || field.type === "select");
  const isBoolean = false; // no boolean field type yet

  const operators: FieldCondition["operator"][] = isNumeric
    ? ["equals", "is_not", "greater_than", "less_than"]
    : isOption
    ? ["equals", "is_not", "contains"]
    : ["equals", "is_not", "contains"];

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
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Feltétel értéke
          </Label>
          <ValueInput
            field={field ?? null}
            isNumeric={isNumeric}
            isBoolean={isBoolean}
            value={condition.value}
            onChange={(v) => onChange({ ...condition, value: v })}
          />
        </div>
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
    </div>
  );
}

interface ValueInputProps {
  field: FormField | null;
  isNumeric: boolean;
  isBoolean: boolean;
  value: FieldCondition["value"];
  onChange: (v: FieldCondition["value"]) => void;
}

function ValueInput({ field, isNumeric, value, onChange }: ValueInputProps) {
  // Option-type field → pick from its dataNames.
  if (field && (field.type === "radio" || field.type === "checkbox" || field.type === "select")) {
    const opts = (field as OptionField).options ?? [];
    return (
      <Select
        value={String(value ?? "")}
        onValueChange={(v) => onChange(v)}
      >
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

interface TextEditorProps {
  group: ConditionGroup;
  allFields: FormField[];
  onCommit: (g: ConditionGroup) => void;
}

function TextEditor({ group, allFields, onCommit }: TextEditorProps) {
  const initial = useMemo(() => serializeCondition(group, allFields), []);
  const [text, setText] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<FormField[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Recompute suggestions while typing the current word.
  useEffect(() => {
    setError(null);
  }, [text]);

  const updateSuggestions = (val: string, cursor: number) => {
    // Find the current word boundaries (identifier chars).
    let start = cursor;
    while (start > 0 && /[A-Za-z0-9_]/.test(val[start - 1])) start--;
    const word = val.slice(start, cursor);
    if (!word || word.length < 1) {
      setSuggestions([]);
      return { start, word };
    }
    const matches = allFields
      .filter((f) => f.internalName?.toLowerCase().startsWith(word.toLowerCase()))
      .slice(0, 8);
    setSuggestions(matches);
    setHighlight(0);
    return { start, word };
  };

  const acceptSuggestion = (suggestion: FormField) => {
    const input = inputRef.current;
    if (!input) return;
    const cursor = input.selectionStart ?? text.length;
    let start = cursor;
    while (start > 0 && /[A-Za-z0-9_]/.test(text[start - 1])) start--;
    const next = text.slice(0, start) + suggestion.internalName + text.slice(cursor);
    setText(next);
    setSuggestions([]);
    requestAnimationFrame(() => {
      const pos = start + suggestion.internalName.length;
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
            updateSuggestions(e.target.value, e.target.selectionStart ?? e.target.value.length);
          }}
          onKeyDown={(e) => {
            if (suggestions.length > 0) {
              if (e.key === "Tab" || (e.key === "Enter" && suggestions.length > 0)) {
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
                setHighlight((h) => (h - 1 + suggestions.length) % suggestions.length);
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
                key={s.id}
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
                <span className="font-mono">{s.internalName}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {s.label}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Operátorok: <code>= != &gt; &lt; contains</code> · logika:{" "}
          <code>&amp;&amp; ||</code> · csoportosítás: <code>( )</code>. Tab a javaslat elfogadásához.
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
