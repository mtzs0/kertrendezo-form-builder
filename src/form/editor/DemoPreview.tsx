// Demo preview tab — renders the form driven by the visual canvas.
//
// Behavior:
//  - Only fields placed on the canvas are rendered.
//  - Fields are sorted by their canvas `order` (ascending). Fields without
//    an order go to the end, stable by their original schema order.
//  - When a field's box is fully contained inside a group (or sub-group)
//    frame on the canvas, that field is rendered as part of the group.
//    Such groups appear in the demo preview using the original tabbed
//    step-by-step rendering driven by FormView (just like the Előnézet
//    tab does for the live form).
//  - Existing display conditions still apply.
//  - When the "Egyenkénti megjelenítés" toggle is ON, fields are
//    revealed one-by-one as the user fills them in: only the first
//    not-yet-answered visible REQUIRED field gates further reveals.
//    Non-required fields between two required ones are revealed
//    together.

import { useCallback, useMemo, useState } from "react";
import { FormView } from "@/form/FormView";
import { isFieldVisible } from "@/form/structure";
import type { FormField, FormGroup, FormSchema, FormSubGroup, FormValues, VisualBackground } from "@/form/types";
import { useCanvasPositions } from "./canvasPositionsStore";
import { useGroupFrames } from "./groupFramesStore";
import { useRevealOneByOne } from "./revealModeStore";

interface Props {
  fields: FormField[];
  groups: FormGroup[];
  subGroups: FormSubGroup[];
  formId: string | null | undefined;
  thankYouText: string | null | undefined;
  testWebhookUrl?: string | null | undefined;
  /** When true, the floating "Demo" debug button is shown. Defaults to true. */
  showDemoButton?: boolean;
  /** Form-wide button visual background. */
  buttonBackground?: VisualBackground;
  /** Form-wide tabs visual background. */
  tabsBackground?: VisualBackground;
}

/** Returns true if the user hasn't supplied any value for this field yet. */
function isAnswered(field: FormField, values: FormValues): boolean {
  if (field.type === "label") return true;
  const v = values[field.id];
  if (v === undefined || v === null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

export function DemoPreview({ fields, groups, subGroups, formId, thankYouText, testWebhookUrl, showDemoButton = true }: Props) {
  const positions = useCanvasPositions(formId);
  const frames = useGroupFrames(formId);
  const [revealOneByOne] = useRevealOneByOne(formId);
  const [liveValues, setLiveValues] = useState<FormValues>({});

  /**
   * Build the schema fed into FormView. Fields are ordered by their canvas
   * `order` value; groups/sub-groups that contain at least one placed
   * field get a positive `location` (so FormView treats them as steps).
   * Other groups stay unplaced (location = 0) and are ignored.
   */
  const placedSchema = useMemo(() => {
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

    // Track which groups/sub-groups actually contain placed fields.
    const usedGroupIds = new Set<string>();
    const usedSubGroupIds = new Set<string>();
    const orderedFields: FormField[] = placed.map((p, i) => {
      const f = p.field;
      // Keep the field's groupId/subGroupId as already assigned by the
      // canvas containment logic. Groups that aren't on the canvas have
      // no frame, but if a field still references them we drop the link
      // so it renders top-level (linear).
      const frame = f.groupId ? frames[`group:${f.groupId}`] : undefined;
      const subFrame = f.subGroupId ? frames[`subgroup:${f.subGroupId}`] : undefined;
      const groupId = frame ? f.groupId : undefined;
      const subGroupId = subFrame ? f.subGroupId : undefined;
      if (groupId) usedGroupIds.add(groupId);
      if (subGroupId) usedSubGroupIds.add(subGroupId);
      return {
        ...f,
        groupId,
        subGroupId,
        // Re-stamp location so FormView's structure builder orders fields
        // sensibly (top-level fields get monotonic locations; grouped
        // fields are sorted within their group by the same numbering).
        location: i + 1,
      } as FormField;
    });

    // Keep manually-entered group/sub-group order numbers authoritative.
    // FormView treats location <= 0 as unplaced, but the canvas frame itself
    // is the placement signal here, so shift numbers by +1 to allow 0 as a
    // valid first position while preserving relative order.
    const placedGroups: FormGroup[] = groups
      .filter((g) => usedGroupIds.has(g.id))
      .map((g) => ({ ...g, location: (g.location ?? 0) + 1 }));
    const placedSubGroups: FormSubGroup[] = subGroups
      .filter((sg) => usedSubGroupIds.has(sg.id))
      .map((sg) => ({ ...sg, location: (sg.location ?? 0) + 1 }));

    return { fields: orderedFields, groups: placedGroups, subGroups: placedSubGroups };
  }, [fields, groups, subGroups, positions, frames]);

  // Reveal-one-by-one slicing applied to the linear (non-grouped) tail
  // only. When grouping is in play, FormView's stepper already paces
  // the user; we still slice within whatever fields are top-level.
  const visibleSchemaFields = useMemo(() => {
    if (!revealOneByOne) return placedSchema.fields;
    const out: FormField[] = [];
    for (const f of placedSchema.fields) {
      out.push(f);
      if (f.groupId) continue; // grouped fields aren't gated linearly
      if (!isFieldVisible(f, liveValues)) continue;
      if (!f.required) continue;
      if (isAnswered(f, liveValues)) continue;
      break;
    }
    return out;
  }, [placedSchema.fields, revealOneByOne, liveValues]);

  const handleValuesChange = useCallback((vals: FormValues) => {
    setLiveValues(vals);
  }, []);

  if (placedSchema.fields.length === 0) {
    return (
      <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-8 text-center text-sm text-muted-foreground">
        Helyezz mezőket a vászonra a <span className="font-medium">Vizuális feltételek (demo)</span>{" "}
        fülön, hogy itt megjelenjenek.
      </div>
    );
  }

  const schema: FormSchema = {
    title: "",
    description: "",
    groups: placedSchema.groups,
    subGroups: placedSchema.subGroups,
    fields: visibleSchemaFields,
  };

  return (
    <div className="rounded-2xl bg-card border border-border kr-shadow-soft p-5 md:p-8">
      {revealOneByOne && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-medium">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
          Sorrendi megjelenítés (kötelező mezők szerint)
        </div>
      )}
      <FormView
        schema={schema}
        layout="horizontal"
        formId={formId ?? null}
        showDemoButton={showDemoButton}
        thankYouText={thankYouText ?? null}
        testWebhookUrl={testWebhookUrl ?? null}
        onValuesChange={handleValuesChange}
      />
    </div>
  );
}
