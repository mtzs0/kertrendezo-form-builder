import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FieldRenderer } from "./FieldRenderer";
import { buildRenderTree, isFieldVisible } from "./structure";
import type { FormSchema, FormValues, FormField } from "./types";

interface Props {
  schema: FormSchema;
  /** "horizontal" = desktop/tablet wide layout, "vertical" = mobile stacked. */
  layout: "horizontal" | "vertical";
}

export function FormView({ schema, layout }: Props) {
  const [values, setValues] = useState<FormValues>({});
  const tree = useMemo(() => buildRenderTree(schema), [schema]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Foundation pass — submission wiring (Cloud + webhook) comes next.
    toast.success("Köszönjük! A foglalást rögzítettük (próba mód).");
    console.log("Form submitted", values);
  };

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

            <div className="flex flex-col gap-6">
              {item.children.map((child) => {
                if (child.kind === "field") return renderField(child.field);

                // sub-group
                return (
                  <div
                    key={child.id}
                    className="rounded-xl border border-border/70 bg-secondary/40 p-4 md:p-5 space-y-4"
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

            {/* Render group-level (non-subgroup) fields in a grid */}
            <div className={fieldGridClass}>
              {item.children
                .filter((c): c is { kind: "field"; field: FormField } => c.kind === "field")
                .map(() => null)}
            </div>
          </section>
        );
      })}

      <div className="flex justify-end pt-2">
        <Button
          type="submit"
          size="lg"
          className="bg-gradient-to-r from-primary to-primary-glow text-primary-foreground kr-shadow-soft hover:kr-shadow-elevated transition-all"
        >
          Küldés
        </Button>
      </div>
    </form>
  );
}
