import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronDown, ChevronUp, Check, ListPlus, Plus, Trash2, X } from "lucide-react";
import type { FieldOption, NotePosition, OptionField } from "@/form/types";
import { ImageUploader } from "./ImageUploader";

interface Props {
  field: OptionField;
  /** Persists the full option list to the database. */
  onChange: (options: FieldOption[]) => void;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/**
 * Editor for the options array of radio/checkbox/select fields.
 * Debounces text edits locally and only calls onChange after typing settles
 * (or when add/remove/reorder/image happens).
 */
export function OptionsEditor({ field, onChange }: Props) {
  const [draft, setDraft] = useState<FieldOption[]>(field.options ?? []);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const debounce = useRef<number | null>(null);

  // When the field id changes (different field selected), resync the draft.
  // We intentionally do NOT resync on every parent re-render to avoid losing
  // in-progress text edits.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(field.options ?? []), [field.id]);

  const commit = (next: FieldOption[], immediate = false) => {
    setDraft(next);
    if (debounce.current) window.clearTimeout(debounce.current);
    if (immediate) {
      onChange(next);
    } else {
      debounce.current = window.setTimeout(() => onChange(next), 400);
    }
  };

  const addOption = () => {
    const i = draft.length + 1;
    commit(
      [
        ...draft,
        { displayName: `Új opció ${i}`, dataName: `opcio_${i}` },
      ],
      true
    );
  };

  const removeOption = (idx: number) => {
    commit(
      draft.filter((_, i) => i !== idx),
      true
    );
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draft.length) return;
    const next = draft.slice();
    [next[idx], next[target]] = [next[target], next[idx]];
    commit(next, true);
  };

  const update = (idx: number, patch: Partial<FieldOption>, immediate = false) => {
    const next = draft.map((o, i) => (i === idx ? { ...o, ...patch } : o));
    commit(next, immediate);
  };

  /** Convert pasted lines into options. Replaces existing list. */
  const confirmBulk = () => {
    const existing = new Set<string>();
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const next: FieldOption[] = lines.map((line) => {
      // Normalize: lowercase, remove accents, replace non-alphanumeric with underscore
      let dataName = line
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 40);
      let unique = dataName;
      let n = 2;
      while (existing.has(unique)) unique = `${dataName}_${n++}`;
      existing.add(unique);
      return { displayName: line, dataName: unique };
    });
    commit([...draft, ...next], true);
    setBulkText("");
    setBulkOpen(false);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Opciók</Label>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addOption}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Új opció
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => setBulkOpen((v) => !v)}
            aria-label="Több opció beillesztése"
            title="Több opció beillesztése"
          >
            <ListPlus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {bulkOpen && (
        <div className="space-y-2 rounded-md border border-border bg-secondary/30 p-2">
          <Label className="text-xs text-muted-foreground">
            Illeszd be az opciókat — egy sor egy opció
          </Label>
          <Textarea
            rows={5}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder={"Opció 1\nOpció 2\nOpció 3"}
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setBulkText("");
                setBulkOpen(false);
              }}
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Mégse
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={confirmBulk}
              disabled={!bulkText.trim()}
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Hozzáadás
            </Button>
          </div>
        </div>
      )}

      {draft.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Még nincs opció. Adj hozzá egyet a jobb felső gombbal.
        </p>
      )}

      <div className="space-y-3">
        {draft.map((opt, idx) => (
          <OptionRow
            key={idx}
            field={field}
            option={opt}
            index={idx}
            total={draft.length}
            onMove={move}
            onRemove={removeOption}
            onUpdate={update}
            onSlugify={slugify}
          />
        ))}
      </div>
    </div>
  );
}

interface RowProps {
  field: OptionField;
  option: FieldOption;
  index: number;
  total: number;
  onMove: (idx: number, dir: -1 | 1) => void;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, patch: Partial<FieldOption>, immediate?: boolean) => void;
  onSlugify: (s: string) => string;
}

function OptionRow({
  field,
  option,
  index,
  total,
  onMove,
  onRemove,
  onUpdate,
  onSlugify,
}: RowProps) {
  const showImage = !!field.useImages;
  const showNote = !!field.uniqueNotePerOption;

  return (
    <div className="rounded-lg border border-border bg-secondary/30 p-3 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-0.5 pt-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index === 0}
            onClick={() => onMove(index, -1)}
            aria-label="Feljebb"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={index === total - 1}
            onClick={() => onMove(index, 1)}
            aria-label="Lejjebb"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Megjelenített név</Label>
            <Input
              value={option.displayName}
              onChange={(e) => {
                const displayName = e.target.value;
                // If dataName looks auto-derived, keep it in sync.
                const auto = !option.dataName || option.dataName === onSlugify(option.displayName);
                onUpdate(index, {
                  displayName,
                  ...(auto ? { dataName: onSlugify(displayName) || option.dataName } : {}),
                });
              }}
              placeholder="Pl. Igen"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Adat név</Label>
            <Input
              value={option.dataName}
              onChange={(e) =>
                onUpdate(index, {
                  dataName: e.target.value
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/[^a-z0-9_]+/g, "_")
                    .slice(0, 40),
                })
              }
              placeholder="igen"
            />
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onRemove(index)}
          aria-label="Törlés"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {showImage && (
        <div className="pl-8">
          <Label className="text-xs text-muted-foreground mb-1 block">Illusztráció</Label>
          <ImageUploader
            fieldId={field.id}
            storageKey={option.dataName || `opt-${index}`}
            url={option.imageUrl}
            onChange={(url) => onUpdate(index, { imageUrl: url ?? undefined }, true)}
            size="sm"
            label="Opció kép"
          />
        </div>
      )}

      {showNote && (
        <div className="pl-8 space-y-2">
          <Label className="text-xs text-muted-foreground">Megjegyzés ehhez az opcióhoz</Label>
          <Textarea
            rows={2}
            value={option.note?.value ?? ""}
            onChange={(e) =>
              onUpdate(index, {
                note: e.target.value
                  ? { value: e.target.value, position: option.note?.position ?? "below" }
                  : undefined,
              })
            }
            placeholder="Pl. Részletek erről az opcióról…"
          />
          {option.note?.value && (
            <Select
              value={option.note?.position ?? "below"}
              onValueChange={(v) =>
                onUpdate(
                  index,
                  { note: { value: option.note?.value ?? "", position: v as NotePosition } },
                  true
                )
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Kép/szöveg felett</SelectItem>
                <SelectItem value="below">Kép/szöveg alatt</SelectItem>
                <SelectItem value="side">Mellette</SelectItem>
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </div>
  );
}
