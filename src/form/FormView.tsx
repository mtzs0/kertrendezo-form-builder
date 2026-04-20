import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FieldRenderer } from "./FieldRenderer";
import { buildRenderTree, filterPlacedSchema, isFieldVisible } from "./structure";
import { submitForm } from "./api";
import type { FormSchema, FormValues, FormField } from "./types";

interface Props {
  schema: FormSchema;
  /** "horizontal" = desktop/tablet wide layout, "vertical" = mobile stacked. */
  layout: "horizontal" | "vertical";
  /** When provided, submissions are persisted to Supabase under this form id. */
  formId?: string | null;
}

export function FormView({ schema, layout, formId }: Props) {
  const [values, setValues] = useState<FormValues>({});
  const [submitting, setSubmitting] = useState(false);
  const tree = useMemo(() => buildRenderTree(filterPlacedSchema(schema)), [schema]);

  const handleChange = (id: string, v: FormValues[string]) =>
    setValues((prev) => ({ ...prev, [id]: v }));

  const renderField = (field: FormField) => {
    if (!isFieldVisible(field, values)) return null;
    return (
      <FieldRenderer
        key={field.id}
        field={field}
        value={values[field.id]}
        onChange={handleChange}
        layout={layout}
      />
    );
  };

  // Horizontal: 2-column grid inside groups. Vertical: single column.
  const fieldGridClass =
    layout === "horizontal"
      ? "grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5"
      : "flex flex-col gap-4";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId) {
      toast.success("Köszönjük! (Próba mód – nincs cloud forma kötve.)");
      console.log("Form submitted (local only)", values);
      return;
    }
    setSubmitting(true);
    try {
      await submitForm(formId, values);
      toast.success("Köszönjük! A foglalást rögzítettük.");
      setValues({});
    } catch (err) {
      console.error(err);
      toast.error("Hiba történt a beküldés során. Próbáld újra.");
    } finally {
      setSubmitting(false);
    }
  };

  if (tree.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted-foreground">
        Az űrlap üres.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {tree.map((item) => {
        if (item.kind === "field") return renderField(item.field);

        // group
        return (
          <section key={item.id} className="space-y-4">
            <header className="flex items-baseline gap-3">
              <h3 className="text-lg md:text-xl font-semibold text-foreground">
                {item.label}
              </h3>
              <div className="flex-1 h-px bg-border" />
            </header>

            <div className={fieldGridClass}>
              {item.children.map((child) => {
                if (child.kind === "field") return renderField(child.field);
                // sub-group spans the full row
                return (
                  <div
                    key={child.id}
                    className="md:col-span-2 rounded-xl border border-border/70 bg-secondary/40 p-4 md:p-5 space-y-4"
                  >
                    <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {child.label}
                    </h4>
                    <div className={fieldGridClass}>
                      {child.fields.map(renderField)}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          size="lg"
          disabled={submitting}
          className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground kr-shadow-soft hover:kr-shadow-elevated transition-all"
        >
          {submitting ? "Küldés…" : "Küldés"}
        </Button>
      </div>
    </form>
  );
}
