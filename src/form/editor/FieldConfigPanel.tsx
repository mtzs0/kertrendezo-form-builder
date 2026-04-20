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
import type { FieldType, FormField, NotePosition } from "@/form/types";

interface Props {
  field: FormField | null;
  onChange: (patch: Partial<FormField> & { type?: FieldType }) => void;
  onDelete: () => void;
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

export function FieldConfigPanel({ field, onChange, onDelete }: Props) {
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
            onChange={(e) => onChange({ internalName: e.target.value })}
            placeholder="pl. nev"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg_label">Külső név</Label>
          <Input
            id="cfg_label"
            value={field.label}
            onChange={(e) => onChange({ label: e.target.value })}
            placeholder="Pl. Neved"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cfg_placeholder">Helykitöltő</Label>
          <Input
            id="cfg_placeholder"
            value={field.placeholder ?? ""}
            onChange={(e) => onChange({ placeholder: e.target.value })}
            placeholder="Pl. Kovács Anna"
          />
        </div>
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

      <p className="text-xs text-muted-foreground">
        Tipus-specifikus beállítások (opciók, csúszka határai, feltétel-szerkesztő stb.) a következő körben érkeznek.
      </p>
    </div>
  );
}
