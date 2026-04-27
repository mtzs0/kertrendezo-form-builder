import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { FieldRenderer } from "./FieldRenderer";
import { isFieldVisible } from "./structure";
import type { FormField, FormValues, RepeaterField, RepeaterInstance } from "./types";

interface Props {
  field: RepeaterField;
  value: RepeaterInstance[] | undefined;
  onChange: (id: string, value: RepeaterInstance[]) => void;
  layout: "horizontal" | "vertical";
}

/** Live renderer for the "repeater" field type. */
export function RepeaterRenderer({ field, value, onChange, layout }: Props) {
  const instances = value ?? [];
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<RepeaterInstance>({});
  const [showErrors, setShowErrors] = useState(false);

  const itemLabel = field.itemLabel || "elem";
  const addLabel = field.addButtonLabel || `Új ${itemLabel} hozzáadása`;
  const max = field.maxInstances;
  const atMax = typeof max === "number" && instances.length >= max;
  const children = field.children ?? [];

  const titleFor = (inst: RepeaterInstance, idx: number): string => {
    if (field.titleChildId) {
      const child = children.find((c) => c.id === field.titleChildId);
      if (child) {
        const v = inst[child.internalName];
        if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)) {
          if (Array.isArray(v)) return v.map(String).join(", ");
          if (v instanceof Date) return v.toLocaleDateString();
          return String(v);
        }
      }
    }
    return `${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} #${idx + 1}`;
  };

  const summaryFor = (inst: RepeaterInstance): string => {
    const parts: string[] = [];
    for (const c of children) {
      if (c.id === field.titleChildId) continue;
      const v = inst[c.internalName];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      const text = Array.isArray(v) ? v.map(String).join(", ") : String(v);
      parts.push(text);
      if (parts.length === 2) break;
    }
    return parts.join(" · ");
  };

  function startAdd() {
    setDraft({});
    setShowErrors(false);
    setOpenIdx(instances.length); // index for new item
  }

  function startEdit(idx: number) {
    setDraft({ ...instances[idx] });
    setShowErrors(false);
    setOpenIdx(idx);
  }

  function removeAt(idx: number) {
    const next = instances.slice();
    next.splice(idx, 1);
    onChange(field.id, next);
  }

  function saveDraft() {
    // Required-field validation inside modal.
    const draftAsValues = draft as FormValues;
    const missing = children.filter((c) => {
      if (!c.required) return false;
      if (!isFieldVisible(c, draftAsValues)) return false;
      const v = draft[c.internalName];
      return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
    });
    if (missing.length > 0) {
      setShowErrors(true);
      return;
    }
    const next = instances.slice();
    if (openIdx !== null && openIdx < instances.length) {
      next[openIdx] = draft;
    } else {
      next.push(draft);
    }
    onChange(field.id, next);
    setOpenIdx(null);
  }

  return (
    <div className="space-y-3">
      {instances.length > 0 && (
        <ul className="space-y-2">
          {instances.map((inst, idx) => (
            <li
              key={idx}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{titleFor(inst, idx)}</p>
                {summaryFor(inst) && (
                  <p className="text-xs text-muted-foreground truncate">
                    {summaryFor(inst)}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => startEdit(idx)}
                aria-label="Szerkesztés"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => removeAt(idx)}
                aria-label="Törlés"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={startAdd}
        disabled={atMax}
        className="w-full justify-center"
      >
        <Plus className="h-4 w-4 mr-1" />
        {atMax ? `Elérted a maximumot (${max})` : addLabel}
      </Button>

      <Dialog open={openIdx !== null} onOpenChange={(o) => !o && setOpenIdx(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {openIdx !== null && openIdx < instances.length
                ? `${itemLabel.charAt(0).toUpperCase() + itemLabel.slice(1)} szerkesztése`
                : `Új ${itemLabel} hozzáadása`}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {children.length === 0 && (
              <p className="text-sm italic text-muted-foreground text-center py-6">
                Nincsenek almezők beállítva.
              </p>
            )}
            {children
              .slice()
              .sort((a, b) => a.location - b.location)
              .map((child) => {
                if (!isFieldVisible(child, draft as FormValues)) return null;
                const v = draft[child.internalName];
                const isMissing =
                  showErrors &&
                  child.required &&
                  (v === undefined ||
                    v === null ||
                    v === "" ||
                    (Array.isArray(v) && v.length === 0));
                return (
                  <div key={child.id} className={isMissing ? "ring-1 ring-destructive rounded-md p-2 -m-2" : ""}>
                    <FieldRenderer
                      field={child as FormField}
                      value={v}
                      onChange={(_id, nv) =>
                        setDraft((d) => ({ ...d, [child.internalName]: nv }))
                      }
                      layout={layout}
                    />
                    {isMissing && (
                      <p className="text-xs text-destructive mt-1">Kötelező mező.</p>
                    )}
                  </div>
                );
              })}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenIdx(null)}>
              Mégse
            </Button>
            <Button type="button" onClick={saveDraft}>
              Mentés
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
