import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormField, FormValues, NotePosition, OptionField } from "@/form/types";
import { OptionFieldRenderer } from "./OptionFieldRenderer";

/**
 * Validate an email address. Checks:
 *  - exactly one "@"
 *  - no spaces or invalid characters
 *  - local part is non-empty
 *  - domain has a dot and a TLD of 2+ letters (e.g. .com, .hu, .co.uk)
 */
function validateEmail(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/\s/.test(v)) return "Az e-mail nem tartalmazhat szóközt.";
  const atCount = (v.match(/@/g) ?? []).length;
  if (atCount === 0) return "Hiányzik a „@\" karakter.";
  if (atCount > 1) return "Csak egy „@\" karakter lehet.";
  // Standard-ish RFC-lite check + TLD must be alphabetic, length >= 2.
  const re = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
  if (!re.test(v)) {
    if (!/\.[A-Za-z]{2,}$/.test(v)) {
      return "Érvényes domain végződés szükséges (pl. .hu, .com).";
    }
    return "Érvénytelen e-mail cím formátum.";
  }
  return null;
}

function EmailInput({
  id,
  value,
  onChange,
  placeholder,
  required,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [touched, setTouched] = useState(false);
  const error = touched
    ? required && !value.trim()
      ? "Kötelező mező."
      : validateEmail(value)
    : null;
  return (
    <div className="space-y-1">
      <Input
        id={id}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder={placeholder ?? "pelda@domain.hu"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setTouched(true)}
        aria-invalid={!!error}
        className={cn(error && "border-destructive focus-visible:ring-destructive")}
      />
      {error && (
        <p className="text-xs text-destructive leading-tight">{error}</p>
      )}
    </div>
  );
}

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
  // Display-only "Cím" element: render as a heading and stop.
  if (field.type === "label") {
    return (
      <div className={cn("space-y-1", layout === "vertical" && "space-y-1.5")}>
        <h4 className="text-sm md:text-base font-semibold text-foreground leading-tight">
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </h4>
        {field.note && (
          <FieldNote position={field.note.position}>{field.note.value}</FieldNote>
        )}
      </div>
    );
  }

  const note = field.note;
  const showSideNote = note?.position === "side";
  const hideLabel = !!field.hideLabel;

  const labelEl = hideLabel ? null : (
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
    case "post_code":
      control = (
        <Input
          id={field.id}
          type="text"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) =>
            onChange(field.id, e.target.value.replace(/\D/g, "").slice(0, 4))
          }
        />
      );
      break;
    case "city":
    case "street":
      control = (
        <Input
          id={field.id}
          placeholder={field.placeholder}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.id, e.target.value)}
        />
      );
      break;
    case "email":
      control = (
        <EmailInput
          id={field.id}
          placeholder={field.placeholder}
          required={field.required}
          value={(value as string) ?? ""}
          onChange={(v) => onChange(field.id, v)}
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
        const spacing = field.customStopsSpacing ?? "equal";
        const fmt = (n: number, last: boolean) =>
          `${n}${last ? "+" : ""}${field.unit ? " " + field.unit : ""}`;

        // Stored value: the chosen end-of-range number, or undefined when untouched.
        const stored = value as number | undefined;
        const hasSelection = typeof stored === "number";
        const selectedIdx = hasSelection
          ? Math.max(0, selectable.findIndex((s) => s === stored))
          : -1;
        const isLast = hasSelection && selectedIdx === selectable.length - 1;
        const rangeStart =
          !hasSelection ? field.min : selectedIdx === 0 ? field.min : selectable[selectedIdx - 1];
        const rangeEnd = hasSelection ? selectable[selectedIdx] : field.min;

        if (spacing === "proportional") {
          // Proportional mode: knob moves smoothly across the numeric range,
          // snaps to nearest stop on release. Untouched → knob at field.min.
          const snap = (n: number) =>
            selectable.reduce(
              (best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best),
              selectable[0]
            );
          const knob = hasSelection ? stored! : field.min;
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
                  value={[knob]}
                  onValueChange={(v) => onChange(field.id, v[0])}
                  onValueCommit={(v) => onChange(field.id, snap(v[0]))}
                />
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
                {!hasSelection
                  ? <span className="text-muted-foreground">Húzd a csúszkát a választáshoz</span>
                  : isLast
                    ? fmt(rangeEnd, true)
                    : `${rangeStart}–${rangeEnd}${field.unit ? " " + field.unit : ""}`}
              </div>
            </div>
          );
        } else {
          // Equal-spacing mode (default): use index-based slider where
          // index 0 = "no selection yet" (knob at far left), 1..N = each stop.
          // This ensures untouched required sliders read as empty.
          const total = selectable.length; // max index = total
          const knobIdx = hasSelection ? selectedIdx + 1 : 0;
          // Tick percentages: each stop sits at i/total of the track (i = 1..total).
          const ticks = selectable.map((_, i) => ((i + 1) / total) * 100);

          control = (
            <div className="space-y-3 pt-1">
              <div className="relative">
                <Slider
                  id={field.id}
                  min={0}
                  max={total}
                  step={1}
                  value={[knobIdx]}
                  onValueChange={(v) => {
                    const i = v[0];
                    if (i === 0) onChange(field.id, undefined);
                    else onChange(field.id, selectable[i - 1]);
                  }}
                />
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
                {selectable.map((n, i) => {
                  const last = i === selectable.length - 1;
                  // Skip the very last label here — we render max+ as the right edge.
                  if (last) return null;
                  return (
                    <span
                      key={i}
                      className="absolute -translate-x-1/2"
                      style={{ left: `${ticks[i]}%` }}
                    >
                      {n}
                    </span>
                  );
                })}
                <span className="absolute right-0">{fmt(field.max, true)}</span>
              </div>
              <div className="text-xs text-center text-foreground font-medium">
                {!hasSelection
                  ? <span className="text-muted-foreground">Húzd a csúszkát a választáshoz</span>
                  : isLast
                    ? fmt(rangeEnd, true)
                    : `${rangeStart}–${rangeEnd}${field.unit ? " " + field.unit : ""}`}
              </div>
            </div>
          );
        }
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
