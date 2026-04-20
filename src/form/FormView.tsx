import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FieldRenderer } from "./FieldRenderer";
import {
  buildRenderTree,
  filterPlacedSchema,
  isFieldVisible,
  packByWidth,
  type RenderGroup,
  type RenderGroupChild,
  type RenderItem,
  type RenderSubGroup,
} from "./structure";
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

  /** Render an array of items (fields/subgroups/groups) as width-packed rows. */
  function renderPacked<T extends { width?: number }>(
    items: T[],
    getWidth: (it: T) => number | undefined,
    renderOne: (it: T) => React.ReactNode,
    keyOf: (it: T) => string,
  ) {
    // On vertical (mobile) layout, ignore widths and stack everything full-width.
    if (layout === "vertical") {
      return (
        <div className="flex flex-col gap-4">
          {items.map((it) => (
            <div key={keyOf(it)}>{renderOne(it)}</div>
          ))}
        </div>
      );
    }
    const rows = packByWidth(items, (it) => {
      const w = getWidth(it);
      if (w === 25 || w === 33 || w === 40 || w === 50 || w === 60 || w === 100) return w;
      return undefined;
    });
    return (
      <div className="flex flex-col gap-5">
        {rows.map((row, idx) => (
          <div key={idx} className="flex flex-wrap gap-x-6 gap-y-5">
            {row.map(({ item, width }) => (
              <div
                key={keyOf(item)}
                style={{ flexBasis: `calc(${width}% - 1.5rem)` }}
                className="min-w-0 flex-grow"
              >
                {renderOne(item)}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

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

  // Top-level rendering: groups (with their own widths) + global fields, packed by width.
  const renderTopItem = (item: RenderItem) => {
    if (item.kind === "field") return renderField(item.field);
    return renderGroup(item);
  };

  const topWidth = (item: RenderItem) =>
    item.kind === "field" ? item.field.width : (item as RenderGroup).width;

  function renderGroup(group: RenderGroup) {
    const children = group.children;
    const renderChild = (child: RenderSubGroup | RenderGroupChild) => {
      if (child.kind === "field") return renderField(child.field);
      return renderSubGroup(child);
    };
    const childWidth = (child: RenderSubGroup | RenderGroupChild) =>
      child.kind === "field" ? child.field.width : child.width;

    return (
      <section key={group.id} className="space-y-4">
        <header className="flex items-baseline gap-3">
          <h3 className="text-lg md:text-xl font-semibold text-foreground">{group.label}</h3>
          <div className="flex-1 h-px bg-border" />
        </header>
        {renderPacked(
          children,
          childWidth,
          renderChild,
          (c) => (c.kind === "field" ? c.field.id : c.id),
        )}
      </section>
    );
  }

  function renderSubGroup(sg: RenderSubGroup) {
    return (
      <div className="rounded-xl border border-border/70 bg-secondary/40 p-4 md:p-5 space-y-4 h-full">
        <h4 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {sg.label}
        </h4>
        {renderPacked(
          sg.fields,
          (f) => f.width,
          (f) => renderField(f),
          (f) => f.id,
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {renderPacked(
        tree,
        topWidth,
        renderTopItem,
        (it) => (it.kind === "field" ? it.field.id : it.id),
      )}

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
