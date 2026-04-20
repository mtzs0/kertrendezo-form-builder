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
