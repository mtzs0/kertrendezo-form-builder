import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Loader2, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormField, FormValues, ImageField, NotePosition, OptionField, RepeaterField, RepeaterInstance } from "@/form/types";
import { OptionFieldRenderer } from "./OptionFieldRenderer";
import { RepeaterRenderer } from "./RepeaterRenderer";
import { Markdown } from "./Markdown";
import { uploadOptionImage } from "@/form/editorApi";
import { toast } from "sonner";

/**
 * End-user image upload control. Uploads files to the public
 * `form-option-images` bucket and stores `{name, url}` entries as the value.
 */
type UploadedImage = { name: string; url: string };

function ImageFieldControl({
  field,
  value,
  onChange,
}: {
  field: ImageField;
  value: UploadedImage[] | File[] | undefined;
  onChange: (v: UploadedImage[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const items = (value as UploadedImage[] | undefined) ?? [];
  const multiple = !!field.multiple;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: UploadedImage[] = [];
      for (const f of Array.from(files)) {
        const url = await uploadOptionImage(f, { fieldId: field.id, key: "submission" });
        uploaded.push({ name: f.name, url });
      }
      onChange(multiple ? [...items, ...uploaded] : uploaded.slice(0, 1));
    } catch (e) {
      console.error(e);
      toast.error("Kép feltöltése sikertelen.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const removeAt = (idx: number) => {
    const next = items.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        className="w-full justify-start"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Upload className="h-4 w-4 mr-2" />
        )}
        {field.placeholder ?? (multiple ? "Képek feltöltése" : "Kép feltöltése")}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {items.length > 0 && (
        <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {items.map((it, i) => (
            <li
              key={`${it.url}-${i}`}
              className="relative group aspect-square rounded-md overflow-hidden border border-border bg-secondary/40"
            >
              <img src={it.url} alt={it.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 hover:bg-background text-foreground flex items-center justify-center shadow-sm"
                aria-label="Eltávolítás"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
  const className = cn(
    "text-xs text-muted-foreground leading-relaxed",
    position === "above" && "mb-2",
    position === "below" && "mt-2",
    position === "side" && "md:ml-3"
  );
  if (typeof children === "string") {
    return <Markdown className={className}>{children}</Markdown>;
  }
  return <p className={className}>{children}</p>;
}

/**
 * Number input shown to the LEFT of a slider. Lets the user type an exact
 * value; while typing, anything that parses as a number inside [min, max] is
 * pushed via `onCommit` so the slider knob live-updates. Out-of-range values
 * (or non-numeric input) are kept in the input but NOT applied to the slider.
 *
 * For modes that snap to discrete stops (custom-stops slider), the parent
 * supplies a `snap` function so the slider can land on the nearest legal stop.
 */
function SliderNumberInput({
  id,
  min,
  max,
  unit,
  value,
  snap,
  onCommit,
}: {
  id: string;
  min: number;
  max: number;
  unit?: string;
  /** The currently displayed slider value (or undefined when nothing chosen yet). */
  value: number | undefined;
  /** Optional snap function for discrete-stop sliders. */
  snap?: (n: number) => number;
  /** Called with a clamped (and optionally snapped) numeric value. */
  onCommit: (n: number) => void;
}) {
  // Local text state lets the user type freely (including intermediate states
  // like "" or "12.") without us fighting their input.
  const [text, setText] = useState<string>(
    value === undefined || Number.isNaN(value) ? "" : String(value)
  );

  // Sync text when the slider is moved externally (e.g. dragging the knob)
  // — but never while the input itself is focused, to avoid clobbering typing.
  const parsed = text.trim() === "" ? NaN : Number(text);
  const focused =
    typeof document !== "undefined" &&
    document.activeElement?.id === `${id}__num`;
  if (
    !focused &&
    value !== undefined &&
    !Number.isNaN(value) &&
    (Number.isNaN(parsed) || Math.abs(parsed - value) > 1e-9)
  ) {
    queueMicrotask(() => setText(String(value)));
  }

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Input
        id={`${id}__num`}
        type="number"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          const t = e.target.value;
          setText(t);
          if (t.trim() === "") return;
          const n = Number(t);
          if (Number.isNaN(n)) return;
          if (n < min || n > max) return; // out-of-range → don't move slider
          onCommit(snap ? snap(n) : n);
        }}
        className="w-20 h-9 text-sm"
        aria-label="Egyedi érték"
      />
      {unit && (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {unit}
        </span>
      )}
    </div>
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
            <div className="flex items-start gap-3 pt-1">
              <SliderNumberInput
                id={field.id}
                min={field.min}
                max={field.max}
                unit={field.unit}
                value={hasSelection ? stored : undefined}
                snap={snap}
                onCommit={(n) => onChange(field.id, n)}
              />
              <div className="space-y-3 flex-1 min-w-0">
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

          // For the typed-input mode: snap any number to the nearest end-of-
          // range stop (these are the only legal values the slider can store).
          const snapToStop = (n: number) =>
            selectable.reduce(
              (best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best),
              selectable[0]
            );

          control = (
            <div className="flex items-start gap-3 pt-1">
              <SliderNumberInput
                id={field.id}
                min={field.min}
                max={field.max}
                unit={field.unit}
                value={hasSelection ? stored : undefined}
                snap={snapToStop}
                onCommit={(n) => onChange(field.id, n)}
              />
              <div className="space-y-3 flex-1 min-w-0">
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
            </div>
          );
        }
      } else {
        const hasValue = typeof value === "number";
        const current = hasValue ? (value as number) : field.min;
        const snapToInt = (n: number) =>
          Math.min(field.max, Math.max(field.min, Math.round(n)));
        control = (
          <div className="flex items-start gap-3 pt-1">
            <SliderNumberInput
              id={field.id}
              min={field.min}
              max={field.max}
              unit={field.unit}
              value={hasValue ? current : undefined}
              snap={snapToInt}
              onCommit={(n) => onChange(field.id, n)}
            />
            <div className="space-y-3 flex-1 min-w-0">
              <Slider
                id={field.id}
                min={field.min}
                max={field.max}
                step={1}
                value={[current]}
                onValueChange={(v) => onChange(field.id, snapToInt(v[0]))}
                className="py-3 [&_[role=slider]]:h-9 [&_[role=slider]]:w-9 [&>span:first-child]:h-5"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{field.min} {field.unit}</span>
                <span className="text-foreground font-medium">
                  {current} {field.unit}
                </span>
                <span>{field.max} {field.unit}</span>
              </div>
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
    case "measurement": {
      const mv = (value as { amount?: number | ""; unit?: string } | undefined) ?? {};
      const amount = mv.amount ?? "";
      const unit = mv.unit ?? (field.options[0]?.dataName ?? "");
      const unitDisplay = (field as { unitDisplay?: "dropdown" | "radio" }).unitDisplay ?? "radio";
      const commit = (next: { amount?: number | ""; unit?: string }) =>
        onChange(field.id, { amount: next.amount ?? amount, unit: next.unit ?? unit });
      const numberInput = (
        <Input
          id={field.id}
          type="number"
          inputMode="decimal"
          placeholder={field.placeholder}
          value={amount === "" ? "" : String(amount)}
          onChange={(e) => {
            const t = e.target.value;
            commit({ amount: t === "" ? "" : Number(t) });
          }}
          className="flex-1"
        />
      );
      if (field.options.length <= 1 || unitDisplay === "dropdown") {
        control = (
          <div className="flex items-center gap-2">
            {numberInput}
            {field.options.length === 1 ? (
              <span className="shrink-0 text-sm text-muted-foreground px-1">
                {field.options[0].displayName}
              </span>
            ) : (
              <div className="w-40 shrink-0">
                <select
                  value={unit}
                  onChange={(e) => commit({ unit: e.target.value })}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  aria-label="Mértékegység"
                >
                  {field.options.length === 0 && (
                    <option value="">— nincs egység —</option>
                  )}
                  {field.options.map((o) => (
                    <option key={o.dataName} value={o.dataName}>
                      {o.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        );
      } else {
        control = (
          <div className="flex items-center gap-2 flex-wrap">
            {numberInput}
            <div
              role="radiogroup"
              aria-label="Mértékegység"
              className="flex flex-wrap gap-2 shrink-0"
            >
              {field.options.map((o) => {
                const selected = unit === o.dataName;
                return (
                  <button
                    key={o.dataName}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => commit({ unit: o.dataName })}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-sm transition-colors",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    {o.displayName}
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      break;
    }
    case "image":
      control = (
        <ImageFieldControl
          field={field}
          value={value as File[] | undefined}
          onChange={(files) => onChange(field.id, files)}
        />
      );
      break;
    case "repeater":
      control = (
        <RepeaterRenderer
          field={field as RepeaterField}
          value={value as RepeaterInstance[] | undefined}
          onChange={(id, v) => onChange(id, v)}
          layout={layout}
        />
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
