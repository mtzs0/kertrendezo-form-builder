// Demo preview tab — renders the form in a linear order driven by the
// per-box `order` numbers from the Vizuális feltételek (demo) canvas.
//
// Behavior:
//  - Only fields placed on the canvas are rendered.
//  - Fields are sorted by their canvas `order` (ascending). Fields without
//    an order go to the end, stable by their original schema order.
//  - Groupings (groupId, subGroupId) are intentionally ignored — every
//    field renders linearly at full width.
//  - Existing display conditions still apply (visibility logic untouched).

import { useMemo } from "react";
import { FormView } from "@/form/FormView";
import type { FormField, FormSchema } from "@/form/types";
import { useCanvasPositions } from "./canvasPositionsStore";

interface Props {
  fields: FormField[];
  formId: string | null | undefined;
  thankYouText: string | null | undefined;
}

export function DemoPreview({ fields, formId, thankYouText }: Props) {
  const positions = useCanvasPositions(formId);

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
      groupId: undefined,
      subGroupId: undefined,
      location: i + 1,
      width: 100 as const,
    })) as FormField[];
  }, [fields, positions]);

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
    fields: orderedFields,
  };

  return (
    <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-5 md:p-8">
      <FormView
        schema={schema}
        layout="horizontal"
        formId={formId ?? null}
        showDemoButton
        thankYouText={thankYouText ?? null}
      />
    </div>
  );
}
