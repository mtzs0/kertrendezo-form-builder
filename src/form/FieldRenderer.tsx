import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormField, FormValues, NotePosition, OptionField } from "@/form/types";
import { OptionFieldRenderer } from "./OptionFieldRenderer";

interface Props {
  field: FormField;
  value: FormValues[string];
  onChange: (id: string, value: FormValues[string]) => void;
  layout?: "horizontal" | "vertical";
}

function FieldNote({ children, position }: { children: React.ReactNode; position: NotePosition }) {
  return (
    <p
      className={cn(
        "text-xs text-muted-foreground leading-relaxed",
        position === "above" && "mb-2",
        position === "below" && "mt-2",
        position === "side" && "md:ml-3"
      )}
    >
      {children}
    </p>
  );
}

export function FieldRenderer({ field, value, onChange, layout = "horizontal" }: Props) {
  const note = field.note;
  const showSideNote = note?.position === "side";

  const labelEl = (
    <Label htmlFor={field.id} className="text-sm font-medium text-foreground">
      {field.label}
      {field.required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );

  let control: React.ReactNode;

  switch (field.type) {
    case "text":
      control = (
        <Input
          id={field.id}
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      );
      break;
    case "textarea":
      control = (
        <Textarea
          id={field.id}
          placeholder={field.placeholder}
          rows={4}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      );
      break;
    case "phone":
      control = (
        <Input
          id={field.id}
          type="tel"
          inputMode="tel"
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value.replace(/[^\d +()-]/g, ""))}
        />
      );
      break;
    case "date":
      control = (
        <div className="relative">
          <Input
            id={field.id}
            type={field.withTime ? "datetime-local" : "date"}
            value={(value as string) ?? ""}
            onChange={(e) => onChange(field.id, e.target.value)}
          />
          <CalendarIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      );
      break;
    case "slider": {
      const hasCustom = !!(field.customStops && field.customStops.length > 0);
      if (hasCustom) {
        // Sorted unique stops strictly between min and max.
        const middle = Array.from(new Set(field.customStops!))
          .filter((n) => n > field.min && n < field.max)
          .sort((a, b) => a - b);
        // End-of-range values; last one renders with "+".
        const selectable = [...middle, field.max];
        const snap = (n: number) =>
          selectable.reduce(
            (best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best),
            selectable[0]
          );

        const current = (value as number) ?? selectable[0];
        const selectedIdx = Math.max(0, selectable.indexOf(snap(current)));
        const isLast = selectedIdx === selectable.length - 1;
        const rangeStart = selectedIdx === 0 ? field.min : selectable[selectedIdx - 1];
        const rangeEnd = selectable[selectedIdx];
        const fmt = (n: number, last: boolean) =>
          `${n}${last ? "+" : ""}${field.unit ? " " + field.unit : ""}`;

        // Tick percentages for each visible inner stop.
        const span = field.max - field.min || 1;
        const ticks = middle.map((n) => ((n - field.min) / span) * 100);

        control = (
          <div className="space-y-3 pt-1">
            <div className="relative">
              <Slider
                id={field.id}
                min={field.min}
                max={field.max}
                step={1}
                value={[current]}
                onValueChange={(v) => onChange(field.id, v[0])}
                onValueCommit={(v) => onChange(field.id, snap(v[0]))}
              />
              {/* Tick marks at each manually defined stop */}
              <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2">
                {ticks.map((pct, i) => (
                  <span
                    key={i}
                    className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-0.5 rounded-full bg-muted-foreground/60"
                    style={{ left: `${pct}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="relative h-4 text-[10px] text-muted-foreground">
              <span className="absolute left-0">
                {field.min}{field.unit ? ` ${field.unit}` : ""}
              </span>
              {middle.map((n, i) => (
                <span
                  key={i}
                  className="absolute -translate-x-1/2"
                  style={{ left: `${ticks[i]}%` }}
                >
                  {n}
                </span>
              ))}
              <span className="absolute right-0">{fmt(field.max, true)}</span>
            </div>
            <div className="text-xs text-center text-foreground font-medium">
              {isLast
                ? fmt(rangeEnd, true)
                : `${rangeStart}–${rangeEnd}${field.unit ? " " + field.unit : ""}`}
            </div>
          </div>
        );
      } else {
        const current = (value as number) ?? field.min;
        control = (
          <div className="space-y-3 pt-1">
            <Slider
              id={field.id}
              min={field.min}
              max={field.max}
              step={field.step ?? 1}
              value={[current]}
              onValueChange={(v) => onChange(field.id, v[0])}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{field.min} {field.unit}</span>
              <span className="text-foreground font-medium">
                {current} {field.unit}
              </span>
              <span>{field.max} {field.unit}</span>
            </div>
          </div>
        );
      }
      break;
    }
    case "radio":
    case "checkbox":
    case "select":
      control = (
        <OptionFieldRenderer
          field={field as OptionField}
          value={value}
          onChange={onChange}
        />
      );
      break;
    case "image":
      control = (
        <Button type="button" variant="outline" className="w-full justify-start">
          <Upload className="h-4 w-4 mr-2" />
          {field.placeholder ?? "Kép feltöltése"}
        </Button>
      );
      break;
  }

  return (
    <div className={cn("space-y-1.5", layout === "vertical" && "space-y-2")}>
      {labelEl}
      {note && note.position === "above" && (
        <FieldNote position="above">{note.value}</FieldNote>
      )}
      {showSideNote ? (
        <div className="flex flex-col md:flex-row md:items-start md:gap-3">
          <div className="flex-1">{control}</div>
          <FieldNote position="side">{note!.value}</FieldNote>
        </div>
      ) : (
        control
      )}
      {note && note.position === "below" && (
        <FieldNote position="below">{note.value}</FieldNote>
      )}
    </div>
  );
}
