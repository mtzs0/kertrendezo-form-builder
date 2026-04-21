import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import type {
  FieldImagePosition,
  FieldOption,
  FieldType,
  FormField,
  NotePosition,
  OptionField,
  OptionLabelPosition,
  SliderField,
  WidthPercent,
} from "@/form/types";
import { WIDTH_OPTIONS } from "@/form/types";
import { OptionsEditor } from "./OptionsEditor";
import { ImageUploader } from "./ImageUploader";

interface Props {
  field: FormField | null;
  onChange: (patch: Partial<FormField> & { type?: FieldType }) => void;
  onDelete: () => void;
  /** Replace the full options array of this field (immediate save). */
  onChangeOptions?: (fieldId: string, options: FieldOption[]) => void;
}

const TYPE_LABELS: Record<FieldType, string> = {
  text: "Szöveg",
  textarea: "Hosszú szöveg",
  slider: "Csúszka",
  radio: "Rádió",
  checkbox: "Jelölőnégyzet",
  select: "Kiválasztás",
  phone: "Telefonszám",
  date: "Dátum",
  image: "Kép feltöltés",
};

const NOTE_POSITION_LABELS: Record<NotePosition, string> = {
  above: "Mező felett",
  below: "Mező alatt",
  side: "Mező mellett",
};

const WIDTH_LABELS: Record<WidthPercent | 100, string> = {
  25: "25%",
  33: "33%",
  40: "40%",
  50: "50%",
  60: "60%",
  100: "100% (teljes sor)",
};

/**
 * Convert a human label into a safe internal name:
 * lowercase, accents stripped, spaces → "_", non [a-z0-9_] removed.
 */
function slugifyName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]+/g, "")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

export function FieldConfigPanel({ field, onChange, onDelete, onChangeOptions }: Props) {
  const isOptionType =
    field?.type === "radio" || field?.type === "checkbox" || field?.type === "select";
  if (!field) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Válassz egy mezőt a bal oldalon a szerkesztéshez.
      </div>
    );
  }

  const note = field.note;

  return (
    <div className="rounded-2xl border border-border bg-card kr-shadow-soft p-5 md:p-6 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Mező</p>
          <h3 className="text-lg font-semibold">{field.label || field.internalName || "Névtelen mező"}</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-4 w-4 mr-1" />
          Törlés
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="cfg_internal">Belső név</Label>
          <Input
            id="cfg_internal"
            value={field.internalName}
            onChange={(e) => onChange({ internalName: slugifyName(e.target.value) })}
            placeholder="pl. nev"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg_label">Külső név</Label>
          <Input
            id="cfg_label"
            value={field.label}
            onChange={(e) => {
              const label = e.target.value;
              // Auto-sync internal name when it's empty, matches the previous
              // auto-derived value, or is still the default placeholder ("uj_mezo", "uj_mezo1"…).
              const isDefault = /^uj_mezo\d*$/.test(field.internalName);
              const auto =
                !field.internalName ||
                field.internalName === slugifyName(field.label) ||
                isDefault;
              onChange({
                label,
                ...(auto ? { internalName: slugifyName(label) || field.internalName } : {}),
              });
            }}
            placeholder="Pl. Neved"
          />
        </div>
        {!isOptionType && (
          <div className="space-y-1.5">
            <Label htmlFor="cfg_placeholder">Helykitöltő</Label>
            <Input
              id="cfg_placeholder"
              value={field.placeholder ?? ""}
              onChange={(e) => onChange({ placeholder: e.target.value })}
              placeholder="Pl. Kovács Anna"
            />
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="cfg_type">Típus</Label>
          <Select
            value={field.type}
            onValueChange={(v) => onChange({ type: v as FieldType })}
          >
            <SelectTrigger id="cfg_type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(TYPE_LABELS) as FieldType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5">
        <div>
          <Label htmlFor="cfg_required" className="cursor-pointer">
            Kötelező
          </Label>
          <p className="text-xs text-muted-foreground">A felhasználónak ki kell tölteni.</p>
        </div>
        <Switch
          id="cfg_required"
          checked={!!field.required}
          onCheckedChange={(v) => onChange({ required: v })}
        />
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Megjegyzés</Label>
          <Switch
            checked={!!note}
            onCheckedChange={(v) =>
              onChange({ note: v ? { value: note?.value ?? "", position: note?.position ?? "below" } : undefined })
            }
          />
        </div>
        {note && (
          <>
            <Textarea
              rows={2}
              placeholder="Extra információ a mezőhöz…"
              value={note.value}
              onChange={(e) => onChange({ note: { value: e.target.value, position: note.position } })}
            />
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Elhelyezés</Label>
              <Select
                value={note.position}
                onValueChange={(v) =>
                  onChange({ note: { value: note.value, position: v as NotePosition } })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(NOTE_POSITION_LABELS) as NotePosition[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {NOTE_POSITION_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 rounded-lg border border-border p-3">
        <Label className="text-sm font-medium">Szélesség</Label>
        <Select
          value={String(field.width ?? 100)}
          onValueChange={(v) => {
            const num = Number(v) as WidthPercent;
            onChange({ width: num === 100 ? undefined : num } as Partial<FormField>);
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {([100, ...WIDTH_OPTIONS.filter((w) => w !== 100)] as WidthPercent[]).map((w) => (
              <SelectItem key={w} value={String(w)}>
                {WIDTH_LABELS[w]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          A szomszédos mezők egymás mellé kerülnek, ha a szélességeik 100%-ot adnak ki.
        </p>
      </div>

      {field.type === "slider" && (
        <SliderConfig
          field={field as SliderField}
          onChange={(p) => onChange(p as Partial<FormField>)}
        />
      )}

      {isOptionType && (
        <OptionTypeConfig
          field={field as OptionField}
          onChange={onChange}
          onChangeOptions={onChangeOptions}
        />
      )}
    </div>
  );
}

interface SliderConfigProps {
  field: SliderField;
  onChange: (patch: Partial<SliderField>) => void;
}

function SliderConfig({ field, onChange }: SliderConfigProps) {
  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <Label className="text-sm font-medium">Csúszka beállítások</Label>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="cfg_slider_min" className="text-xs text-muted-foreground">
            Minimum
          </Label>
          <Input
            id="cfg_slider_min"
            type="number"
            value={field.min ?? 0}
            onChange={(e) => onChange({ min: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg_slider_max" className="text-xs text-muted-foreground">
            Maximum
          </Label>
          <Input
            id="cfg_slider_max"
            type="number"
            value={field.max ?? 100}
            onChange={(e) => onChange({ max: Number(e.target.value) })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg_slider_step" className="text-xs text-muted-foreground">
            Lépések
          </Label>
          <Input
            id="cfg_slider_step"
            type="number"
            min={0}
            value={field.step ?? ""}
            placeholder="pl. 10"
            onChange={(e) => {
              const v = e.target.value;
              onChange({ step: v === "" ? undefined : Number(v) });
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg_slider_unit" className="text-xs text-muted-foreground">
            Mértékegység
          </Label>
          <Input
            id="cfg_slider_unit"
            value={field.unit ?? ""}
            placeholder="pl. m²"
            onChange={(e) => onChange({ unit: e.target.value || undefined })}
          />
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Pl. min=10, max=100, lépések=10 → csak 10, 20, …, 100 választható.
      </p>
    </div>
  );
}

interface OptionTypeConfigProps {
  field: OptionField;
  onChange: (patch: Partial<FormField> & { type?: FieldType }) => void;
  onChangeOptions?: (fieldId: string, options: FieldOption[]) => void;
}

function OptionTypeConfig({ field, onChange, onChangeOptions }: OptionTypeConfigProps) {
  const isSelect = field.type === "select";
  const isList = field.type === "radio" || field.type === "checkbox";

  return (
    <div className="space-y-3">
      {/* Toggles */}
      <div className="space-y-2 rounded-lg border border-border p-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="cursor-pointer">Illusztrációk használata</Label>
            <p className="text-xs text-muted-foreground">
              Minden opcióhoz külön kép tartozhat.
            </p>
          </div>
          <Switch
            checked={!!field.useImages}
            onCheckedChange={(v) => onChange({ useImages: v } as Partial<FormField>)}
          />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Label className="cursor-pointer">Egyedi megjegyzés opciónként</Label>
            <p className="text-xs text-muted-foreground">
              Mindegyik opcióhoz külön rövid leírás.
            </p>
          </div>
          <Switch
            checked={!!field.uniqueNotePerOption}
            onCheckedChange={(v) =>
              onChange({ uniqueNotePerOption: v } as Partial<FormField>)
            }
          />
        </div>
      </div>

      {/* Layout */}
      {isList && (
        <div className="grid grid-cols-2 gap-3 rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Oszlopok száma</Label>
            <Select
              value={String(field.columns ?? 1)}
              onValueChange={(v) => onChange({ columns: Number(v) } as Partial<FormField>)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {field.useImages && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Felirat helye</Label>
              <Select
                value={field.optionLabelPosition ?? "below"}
                onValueChange={(v) =>
                  onChange({
                    optionLabelPosition: v as OptionLabelPosition,
                  } as Partial<FormField>)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">Kép felett</SelectItem>
                  <SelectItem value="below">Kép alatt</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      )}

      {/* Select-specific: image position + placeholder image + placeholder note */}
      {isSelect && field.useImages && (
        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Előnézeti kép helye</Label>
            <Select
              value={field.fieldImagePosition ?? "above"}
              onValueChange={(v) =>
                onChange({
                  fieldImagePosition: v as FieldImagePosition,
                } as Partial<FormField>)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="above">Lista felett</SelectItem>
                <SelectItem value="below">Lista alatt</SelectItem>
                <SelectItem value="left">Lista mellett (bal)</SelectItem>
                <SelectItem value="right">Lista mellett (jobb)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Helykitöltő kép</Label>
            <p className="text-[11px] text-muted-foreground">
              Akkor látható, amíg a felhasználó nem választott.
            </p>
            <ImageUploader
              fieldId={field.id}
              storageKey="placeholder"
              url={field.placeholderImageUrl}
              onChange={(url) =>
                onChange({ placeholderImageUrl: url ?? null } as Partial<FormField>)
              }
              size="md"
              label="Helykitöltő"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Helykitöltő megjegyzés</Label>
              <Switch
                checked={!!field.placeholderNote}
                onCheckedChange={(v) =>
                  onChange({
                    placeholderNote: v
                      ? {
                          value: field.placeholderNote?.value ?? "",
                          position: field.placeholderNote?.position ?? "below",
                        }
                      : null,
                  } as Partial<FormField>)
                }
              />
            </div>
            {field.placeholderNote && (
              <>
                <Textarea
                  rows={2}
                  placeholder="Pl. Válassz egy stílust az előnézethez."
                  value={field.placeholderNote.value}
                  onChange={(e) =>
                    onChange({
                      placeholderNote: {
                        value: e.target.value,
                        position: field.placeholderNote!.position,
                      },
                    } as Partial<FormField>)
                  }
                />
                <Select
                  value={field.placeholderNote.position}
                  onValueChange={(v) =>
                    onChange({
                      placeholderNote: {
                        value: field.placeholderNote!.value,
                        position: v as NotePosition,
                      },
                    } as Partial<FormField>)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Kép felett</SelectItem>
                    <SelectItem value="below">Kép alatt</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
        </div>
      )}

      {onChangeOptions && (
        <OptionsEditor
          field={field}
          onChange={(opts) => onChangeOptions(field.id, opts)}
        />
      )}
    </div>
  );
}
