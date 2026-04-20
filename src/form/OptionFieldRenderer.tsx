import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { FieldOption, FormValues, NotePosition, OptionField } from "@/form/types";

interface Props {
  field: OptionField;
  value: FormValues[string];
  onChange: (id: string, value: FormValues[string]) => void;
}

const COL_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-4",
};

function OptionNote({
  note,
  className,
}: {
  note: { value: string; position: NotePosition };
  className?: string;
}) {
  return (
    <p className={cn("text-[11px] text-muted-foreground leading-snug", className)}>{note.value}</p>
  );
}

/** Card body shared by radio + checkbox option tiles. */
function OptionCard({
  option,
  field,
  selected,
}: {
  option: FieldOption;
  field: OptionField;
  selected: boolean;
}) {
  const labelPos = field.optionLabelPosition ?? "below";
  const useImg = !!field.useImages;
  const note = field.uniqueNotePerOption ? option.note : undefined;
  const noteIsSide = note?.position === "side";

  const labelEl = <span className="text-sm font-medium">{option.displayName}</span>;
  const imgEl = useImg ? (
    option.imageUrl ? (
      <img
        src={option.imageUrl}
        alt={option.displayName}
        className="w-full aspect-square object-cover rounded-md"
      />
    ) : (
      <div className="w-full aspect-square rounded-md bg-secondary/60 border border-dashed border-border" />
    )
  ) : null;

  const stack = (
    <div
      className={cn(
        "flex flex-col gap-2",
        labelPos === "above" ? "" : "flex-col-reverse"
      )}
    >
      {imgEl}
      <div className="text-center">{labelEl}</div>
    </div>
  );

  // Note layout: above/below stack vertically; side renders next to it.
  if (note && !noteIsSide) {
    return (
      <div className="flex flex-col gap-2">
        {note.position === "above" && <OptionNote note={note} className="text-center" />}
        {useImg ? stack : <div className="text-center">{labelEl}</div>}
        {note.position === "below" && <OptionNote note={note} className="text-center" />}
      </div>
    );
  }
  if (note && noteIsSide) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1">{useImg ? stack : labelEl}</div>
        <OptionNote note={note} />
      </div>
    );
  }
  return useImg ? stack : <div className="text-sm">{labelEl}</div>;
}

export function OptionFieldRenderer({ field, value, onChange }: Props) {
  if (field.type === "select") {
    return <SelectFieldRenderer field={field} value={value} onChange={onChange} />;
  }

  const cols = COL_CLASS[Math.max(1, Math.min(4, field.columns ?? 1))] ?? COL_CLASS[1];

  if (field.type === "radio") {
    const selectedVal = (value as string) ?? "";
    return (
      <RadioGroup
        value={selectedVal}
        onValueChange={(v) => onChange(field.id, v)}
        className={cn("grid gap-3", cols)}
      >
        {field.options.map((opt) => {
          const selected = selectedVal === opt.dataName;
          return (
            <label
              key={opt.dataName}
              htmlFor={`${field.id}_${opt.dataName}`}
              className={cn(
                "relative rounded-lg border bg-card p-3 cursor-pointer transition-colors",
                "border-border hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
              )}
            >
              <RadioGroupItem
                id={`${field.id}_${opt.dataName}`}
                value={opt.dataName}
                className="absolute top-2 right-2"
              />
              <OptionCard option={opt} field={field} selected={selected} />
            </label>
          );
        })}
      </RadioGroup>
    );
  }

  // checkbox
  const arr = (value as string[]) ?? [];
  const toggle = (dn: string, on: boolean) => {
    onChange(field.id, on ? [...arr, dn] : arr.filter((x) => x !== dn));
  };
  return (
    <div className={cn("grid gap-3", cols)}>
      {field.options.map((opt) => {
        const checked = arr.includes(opt.dataName);
        return (
          <label
            key={opt.dataName}
            htmlFor={`${field.id}_${opt.dataName}`}
            className={cn(
              "relative rounded-lg border bg-card p-3 cursor-pointer transition-colors",
              "border-border hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            )}
          >
            <Checkbox
              id={`${field.id}_${opt.dataName}`}
              checked={checked}
              onCheckedChange={(v) => toggle(opt.dataName, Boolean(v))}
              className="absolute top-2 right-2"
            />
            <OptionCard option={opt} field={field} selected={checked} />
          </label>
        );
      })}
    </div>
  );
}

function SelectFieldRenderer({ field, value, onChange }: Props) {
  const selectedVal = (value as string) ?? "";
  const selectedOpt = field.options.find((o) => o.dataName === selectedVal);

  // Image to display: selected option image, else placeholder image.
  const imgUrl = selectedOpt?.imageUrl ?? field.placeholderImageUrl;
  const imgNote = (selectedOpt && field.uniqueNotePerOption ? selectedOpt.note : undefined)
    ?? field.placeholderNote;

  const showImageArea = !!field.useImages && (imgUrl || imgNote);
  const pos = field.fieldImagePosition ?? "above";

  const dropdown = (
    <Select value={selectedVal} onValueChange={(v) => onChange(field.id, v)}>
      <SelectTrigger id={field.id}>
        <SelectValue placeholder={field.placeholder ?? "Válassz…"} />
      </SelectTrigger>
      <SelectContent>
        {field.options.map((opt) => (
          <SelectItem key={opt.dataName} value={opt.dataName}>
            {opt.displayName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!showImageArea) return dropdown;

  const imageBlock = (
    <div className="space-y-2">
      {imgNote?.position === "above" && (
        <OptionNote note={imgNote} className="text-center" />
      )}
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={selectedOpt?.displayName ?? "preview"}
          className="w-full aspect-video object-cover rounded-md border border-border"
        />
      ) : (
        <div className="w-full aspect-video rounded-md bg-secondary/40 border border-dashed border-border" />
      )}
      {imgNote && imgNote.position !== "above" && (
        <OptionNote note={imgNote} className="text-center" />
      )}
    </div>
  );

  if (pos === "above") {
    return (
      <div className="space-y-3">
        {imageBlock}
        {dropdown}
      </div>
    );
  }
  if (pos === "below") {
    return (
      <div className="space-y-3">
        {dropdown}
        {imageBlock}
      </div>
    );
  }
  // left / right — side-by-side on md+, stacked on mobile.
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row gap-3 md:items-start",
        pos === "right" && "md:flex-row-reverse"
      )}
    >
      <div className="md:w-1/2">{imageBlock}</div>
      <div className="md:flex-1">{dropdown}</div>
    </div>
  );
}
