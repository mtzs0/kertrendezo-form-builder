// Shared helpers for editing a single FieldCondition (operator list +
// value input). Used by both the per-field ConditionEditor and the
// canvas-based ConditionCanvas (demo).

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldCondition, FormField, OptionField } from "@/form/types";

export const OPERATOR_LABELS: Record<FieldCondition["operator"], string> = {
  equals: "egyenlő (=)",
  is: "az (=)",
  is_not: "nem egyenlő (!=)",
  greater_than: "nagyobb mint (>)",
  less_than: "kisebb mint (<)",
  contains: "tartalmazza",
  answered: "megválaszolva",
};

const NUMERIC_TYPES = new Set(["slider"]);

export function isNumericField(field: FormField | null | undefined): boolean {
  return !!field && NUMERIC_TYPES.has(field.type);
}

export function isOptionField(field: FormField | null | undefined): boolean {
  return (
    !!field &&
    (field.type === "radio" || field.type === "checkbox" || field.type === "select")
  );
}

/** Operators allowed for a given field type. */
export function operatorsForField(
  field: FormField | null | undefined
): FieldCondition["operator"][] {
  if (isNumericField(field)) {
    return ["equals", "is_not", "greater_than", "less_than", "answered"];
  }
  if (isOptionField(field)) {
    return ["equals", "is_not", "contains", "answered"];
  }
  return ["equals", "is_not", "contains", "answered"];
}

/** True when the operator does not need a value (e.g. "megválaszolva"). */
export function operatorNeedsValue(op: FieldCondition["operator"]): boolean {
  return op !== "answered";
}

interface ValueInputProps {
  field: FormField | null;
  value: FieldCondition["value"];
  onChange: (v: FieldCondition["value"]) => void;
  className?: string;
}

/** Renders the appropriate value editor for a condition based on field type. */
export function ValueInput({ field, value, onChange, className }: ValueInputProps) {
  if (isOptionField(field)) {
    const opts = (field as OptionField).options ?? [];
    return (
      <Select value={String(value ?? "")} onValueChange={(v) => onChange(v)}>
        <SelectTrigger className={className ?? "h-9"}>
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
  if (isNumericField(field)) {
    return (
      <Input
        type="number"
        className={className ?? "h-9"}
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
      className={className ?? "h-9"}
      value={value === undefined || value === null ? "" : String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Érték"
    />
  );
}
