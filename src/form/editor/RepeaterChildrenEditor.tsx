import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  FieldOption,
  FieldType,
  FormField,
  OptionField,
  RepeaterField,
  SliderField,
} from "@/form/types";
import { FieldConfigPanel } from "./FieldConfigPanel";

interface Props {
  /** Children of the parent repeater. */
  children: FormField[];
  /** Replace the full children array. */
  onChange: (next: FormField[]) => void;
}

const TYPE_LABELS: { value: FieldType; label: string }[] = [
  { value: "text", label: "Szöveg" },
  { value: "textarea", label: "Hosszú szöveg" },
  { value: "slider", label: "Csúszka" },
  { value: "radio", label: "Rádió" },
  { value: "checkbox", label: "Jelölőnégyzet" },
  { value: "select", label: "Kiválasztás" },
  { value: "phone", label: "Telefonszám" },
  { value: "date", label: "Dátum" },
  { value: "image", label: "Kép feltöltés" },
  { value: "label", label: "Cím" },
  { value: "post_code", label: "Irányítószám" },
  { value: "city", label: "Város" },
  { value: "street", label: "Utca, házszám" },
  { value: "email", label: "Email" },
  { value: "repeater", label: "Ismétlődő blokk" },
];

function genId(): string {
  // RFC4122-ish; we don't depend on uuid lib.
  return "c_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function makeChild(type: FieldType, location: number): FormField {
  const base = {
    id: genId(),
    internalName: `uj_almezo${location}`,
    label: "Új almező",
    location,
    required: false,
  };
  switch (type) {
    case "text":
    case "textarea":
    case "phone":
    case "post_code":
    case "city":
    case "street":
    case "email":
    case "label":
      return { ...base, type } as FormField;
    case "date":
      return { ...base, type: "date", withTime: false };
    case "image":
      return { ...base, type: "image", multiple: false };
    case "slider":
      return { ...base, type: "slider", min: 0, max: 100, step: 1 } as SliderField;
    case "radio":
    case "checkbox":
    case "select":
      return { ...base, type, options: [], columns: 1 } as OptionField;
    case "repeater":
      return { ...base, type: "repeater", children: [] } as RepeaterField;
  }
}

export function RepeaterChildrenEditor({ children, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addType, setAddType] = useState<FieldType>("text");

  const sorted = [...children].sort((a, b) => a.location - b.location);
  const selected = sorted.find((c) => c.id === selectedId) ?? null;

  function patchSelected(patch: Partial<FormField> & { type?: FieldType }) {
    if (!selected) return;
    onChange(
      sorted.map((c) => {
        if (c.id !== selected.id) return c;
        // Type change: rebuild with the right shape but keep id/name/label/etc.
        if (patch.type && patch.type !== c.type) {
          const fresh = makeChild(patch.type, c.location);
          return {
            ...fresh,
            id: c.id,
            internalName: c.internalName,
            label: c.label,
            placeholder: c.placeholder,
            required: c.required,
            note: c.note,
            width: c.width,
            hideLabel: c.hideLabel,
            location: c.location,
          } as FormField;
        }
        return { ...c, ...patch } as FormField;
      })
    );
  }

  function setOptions(_fieldId: string, options: FieldOption[]) {
    if (!selected) return;
    if (
      selected.type !== "radio" &&
      selected.type !== "checkbox" &&
      selected.type !== "select"
    )
      return;
    onChange(
      sorted.map((c) =>
        c.id === selected.id ? ({ ...c, options } as FormField) : c
      )
    );
  }

  function addChild() {
    const next = makeChild(addType, sorted.length + 1);
    onChange([...sorted, next]);
    setSelectedId(next.id);
  }

  function removeChild(id: string) {
    onChange(
      sorted
        .filter((c) => c.id !== id)
        .map((c, i) => ({ ...c, location: i + 1 }))
    );
    if (selectedId === id) setSelectedId(null);
  }

  function move(id: string, dir: -1 | 1) {
    const idx = sorted.findIndex((c) => c.id === id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= sorted.length) return;
    const next = sorted.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next.map((c, i) => ({ ...c, location: i + 1 })));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium">Almezők</Label>
        <div className="flex items-center gap-2">
          <Select value={addType} onValueChange={(v) => setAddType(v as FieldType)}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TYPE_LABELS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={addChild}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Hozzáad
          </Button>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs italic text-muted-foreground rounded-md border border-dashed border-border px-3 py-4 text-center">
          Még nincsenek almezők. Adj hozzá egyet a fenti típusválasztóval.
        </p>
      ) : (
        <ul className="space-y-1">
          {sorted.map((c, i) => {
            const sel = c.id === selectedId;
            return (
              <li
                key={c.id}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2 py-1.5 transition-colors",
                  sel
                    ? "border-primary ring-1 ring-primary/30 bg-primary/5"
                    : "border-border hover:border-primary/40 bg-background/40"
                )}
              >
                <button
                  type="button"
                  onClick={() => setSelectedId(sel ? null : c.id)}
                  className="flex-1 text-left min-w-0"
                >
                  <p className="text-sm font-medium truncate">
                    {c.label || "(névtelen)"}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {c.internalName || "—"} ·{" "}
                    {TYPE_LABELS.find((t) => t.value === c.type)?.label}
                    {c.required ? " · kötelező" : ""}
                  </p>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={i === 0}
                  onClick={() => move(c.id, -1)}
                  aria-label="Feljebb"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={i === sorted.length - 1}
                  onClick={() => move(c.id, 1)}
                  aria-label="Lejjebb"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => removeChild(c.id)}
                  aria-label="Almező törlése"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {selected && (
        <div className="pt-2">
          <FieldConfigPanel
            field={selected}
            onChange={patchSelected}
            onChangeOptions={setOptions}
            onDelete={() => removeChild(selected.id)}
            deleteLabel="Almező törlése"
          />
        </div>
      )}
    </div>
  );
}
