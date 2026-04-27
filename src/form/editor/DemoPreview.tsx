// Demo preview tab — renders the form in a linear order driven by the
// per-box `order` numbers from the Vizuális feltételek (demo) canvas.
//
// Behavior:
//  - Only fields placed on the canvas are rendered.
//  - Fields are sorted by their canvas `order` (ascending). Fields without
//    an order go to the end, stable by their original schema order.
//  - Groupings (groupId, subGroupId) are intentionally ignored — every
//    field renders linearly.
//  - Existing display conditions still apply (visibility logic untouched).
//  - When the "Egyenkénti megjelenítés" toggle is ON in the canvas
//    toolbar, fields are revealed one-by-one as the user fills them in:
//    only the first not-yet-answered visible field is shown after the
//    answered ones, with all later fields hidden until the user answers
//    the current one.

import { useCallback, useMemo, useState } from "react";
import { FormView } from "@/form/FormView";
import { isFieldVisible } from "@/form/structure";
import type { FormField, FormSchema, FormValues } from "@/form/types";
import { useCanvasPositions } from "./canvasPositionsStore";
import { useRevealOneByOne } from "./revealModeStore";

interface Props {
  fields: FormField[];
  formId: string | null | undefined;
  thankYouText: string | null | undefined;
}

/** Returns true if the user hasn't supplied any value for this field yet. */
function isAnswered(field: FormField, values: FormValues): boolean {
  // Label fields collect no value — treat as automatically "answered" so
  // they don't block subsequent reveals.
  if (field.type === "label") return true;
  const v = values[field.id];
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function DemoPreview({ fields, formId, thankYouText }: Props) {
  const positions = useCanvasPositions(formId);
  const [revealOneByOne] = useRevealOneByOne(formId);
  const [liveValues, setLiveValues] = useState<FormValues>({});

  const orderedFields = useMemo(() => {
    const placed: { field: FormField; order: number; idx: number }[] = [];
    fields.forEach((f, idx) => {
      const pos = positions[f.id];
      if (!pos) return;
      placed.push({
        field: f,
        order: typeof pos.order === "number" ? pos.order : Number.POSITIVE_INFINITY,
        idx,
      });
    });
    placed.sort((a, b) => a.order - b.order || a.idx - b.idx);
    return placed.map((p, i) => ({
      ...p.field,
      // Re-stamp so buildRenderTree treats them as linear top-level fields.
      // Preserve the author-set width so 50%/33%/etc. fields can pack
      // side-by-side in the demo preview, just like in the live form.
      groupId: undefined,
      subGroupId: undefined,
      location: i + 1,
    })) as FormField[];
  }, [fields, positions]);

  // In reveal-one-by-one mode, slice the ordered list down to all fields
  // up to (and including) the first visible-and-unanswered one. Hidden
  // (condition-failed) fields don't count toward the cap — they're just
  // skipped, which mirrors what FormView does internally.
  const visibleSchemaFields = useMemo(() => {
    if (!revealOneByOne) return orderedFields;
    const out: FormField[] = [];
    for (const f of orderedFields) {
      out.push(f);
      // Resolve visibility against the field as it would appear in the
      // schema (without group context, matching the slice we hand to
      // FormView).
      if (!isFieldVisible(f, liveValues)) continue;
      if (!isAnswered(f, liveValues)) {
        // Stop here — this is the current "active" field. Anything after
        // it stays hidden until the user fills it in.
        break;
      }
    }
    return out;
  }, [orderedFields, revealOneByOne, liveValues]);

  const handleValuesChange = useCallback((vals: FormValues) => {
    setLiveValues(vals);
  }, []);

  if (orderedFields.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-8 text-center text-sm text-muted-foreground">
        Helyezz mezőket a vászonra a <span className="font-medium">Vizuális feltételek (demo)</span>{" "}
        fülön, hogy itt lineáris előnézetben megjelenjenek.
      </div>
    );
  }

  const schema: FormSchema = {
    title: "",
    description: "",
    groups: [],
    subGroups: [],
    fields: visibleSchemaFields,
  };

  return (
    <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-5 md:p-8">
      {revealOneByOne && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-medium">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          Egyenkénti megjelenítés bekapcsolva
        </div>
      )}
      <FormView
        schema={schema}
        layout="horizontal"
        formId={formId ?? null}
        showDemoButton
        thankYouText={thankYouText ?? null}
        onValuesChange={handleValuesChange}
      />
    </div>
  );
}
