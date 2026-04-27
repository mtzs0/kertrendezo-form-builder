## Repeater field — multi-instance sub-forms

A new field type that lets end-users dynamically create N "instances" (e.g. gardening areas), each with its own set of parameter values. The editor defines the child fields once; the user fills them in per instance through a modal.

### Concept summary

- New `FieldType` value: `"repeater"`.
- A repeater field owns its own list of **child fields** (text, slider, select, even nested repeaters).
- Live form renders: instructions/note → list of saved instance cards → "Hozzáadás" (Add) button.
- Clicking Add or a card opens a modal containing the child sub-form. Save → the instance is added/updated to the parent value array.
- Submission shape: `values[repeaterFieldId] = [{ childInternalName: value, … }, …]`.

### Editor experience

In `FieldConfigPanel`, when `field.type === "repeater"`, a dedicated "Almezők" section appears with:

- **Item label** ("Elem neve") — singular noun used in buttons/empty state, e.g. "Terület".
- **Add-button label** — defaults to `Új ${itemLabel} hozzáadása`.
- **Min / Max példány** numeric inputs. Required toggle implies min ≥ 1.
- **Címke mező** — dropdown of the repeater's child fields; the chosen field's value becomes each card's title (falls back to `${itemLabel} #N`).
- **Almezők lista** — a nested mini version of the existing `FieldPicker` + `FieldConfigPanel` UI:
  - Add child field via the same type dropdown (all types allowed, including nested repeater).
  - Click a child to edit it in an inline sub-panel (reuses `FieldConfigPanel` recursively, with `deleteLabel="Almező törlése"`).
  - Reorder via existing `SortableItem` drag handles.
  - Conditions on child fields evaluate against **the current modal's values only**, not the outer form.

The repeater field itself is added like any other field via `FieldPicker` / `AddFieldMenu`, and can live globally, in a group, or in a sub-group (no placement restriction). It participates in the stepper just like any regular field.

### Live form experience (preview + published)

`FieldRenderer` gets a new branch for `type === "repeater"`:

```text
┌─────────────────────────────────────────┐
│ Külső név (Pl. Területek)               │
│ Megjegyzés / instructions               │
│                                          │
│ ┌─ Grass · 120 m² ──────────── [✎] [🗑] ┐│
│ ┌─ Forest · 40 m² ─────────────[✎] [🗑] ┐│
│                                          │
│ [+ Új terület hozzáadása]                │
└─────────────────────────────────────────┘
```

- Cards show the title-field value (or `${itemLabel} #N`) and a 1-line summary of 1–2 other filled values.
- Edit pencil & delete trash on each card. Delete confirms inline (no extra dialog).
- "Add" button is disabled at max; min violation shows a soft warning at submit/next step (consistent with existing soft-warn validation).
- Modal/Drawer (uses existing `Dialog` component): renders the child sub-form using the same `FieldRenderer` + width-packed row layout as the main form. Footer: "Mégse" / "Mentés".
- Modal validation: required child fields block save with inline messages (modal is a confirmed action, unlike step navigation).
- Nested repeaters work the same way — a child repeater inside a modal opens *another* modal stacked on top.

### Submission shape

```json
{
  "<repeaterFieldId>": [
    { "tipus": "fu", "terulet_m2": 120, "megjegyzes": "..." },
    { "tipus": "erdo", "terulet_m2": 40 }
  ]
}
```

Keys are the **internal names** of the child fields. Empty/undefined child values are omitted. Demo-fill generates 2 random instances per repeater.

### Technical changes

**1. Schema (`src/form/types.ts`)**
- Add `"repeater"` to `FieldType`.
- New `RepeaterField extends BaseField`:
  ```ts
  type: "repeater";
  itemLabel?: string;          // "Terület"
  addButtonLabel?: string;
  minInstances?: number;
  maxInstances?: number;
  titleChildId?: string;       // child field id used for card title
  children: FormField[];       // nested children, sorted by location
  ```
- Extend `FieldValue` to include `Array<Record<string, FieldValue>>`.
- Children's `groupId`/`subGroupId` are unused (always undefined) — they live inside the repeater, not the form's group tree.

**2. Persistence (Supabase)**
- Add column `form_fields.parent_field_id UUID NULL` to allow rows to be children of a repeater. Existing fields keep `parent_field_id = NULL`.
- Add columns for repeater config: `repeater_item_label TEXT`, `repeater_add_label TEXT`, `repeater_min INT`, `repeater_max INT`, `repeater_title_child_id UUID`.
- Update `editorApi.ts` and `usePublishedForm.ts` to:
  - Load child fields by `parent_field_id` and attach them to their repeater's `children` array (sorted by `position`).
  - Save children with `parent_field_id` set; `form_id` still set so RLS policies keep working.
- Submission JSON simply round-trips the array as-is (already `jsonb`).

**3. Editor UI**
- `FieldConfigPanel.tsx`: add `RepeaterConfig` sub-component rendered when `field.type === "repeater"`. It internally uses a simplified picker + recursive `FieldConfigPanel` for the selected child.
- `FieldPicker.tsx` / `AddFieldMenu`: add `{ value: "repeater", label: "Ismétlődő blokk" }` to `FIELD_TYPES`.
- `StructureEditor.tsx`: a repeater field is placed like any other field (single block, no expansion of its children into the structure tree).
- `OptionsEditor`-style nested editor for children stays inside the repeater config and never appears in the global structure / field picker lists.

**4. Live rendering**
- `FieldRenderer.tsx`: new `RepeaterRenderer` component handling list, modal, add/edit/delete, summary. Reuses `FieldRenderer` recursively for child fields inside the modal, with an isolated `values` state scoped to the modal.
- `structure.ts` `isFieldVisible`: when evaluating a child field's condition inside a modal, pass the modal-scoped values, not the outer form values.
- `FormView.tsx` demo-fill: generate `1 + floor(random*2)` instances of random child values per repeater.
- Soft-warn collector: if `field.required` and array length < `max(minInstances ?? 1, 1)`, include in missing list.

**5. Stepper compatibility**
- No changes needed — repeater fields render in whichever group/sub-group they're placed in (or globally) and behave as a single field for layout/width/packing purposes.

### Out of scope (for now)

- Drag-reordering saved instances on the live form (only add/edit/delete).
- Per-instance conditions referencing values from other instances or the outer form.
- Importing/exporting children from another repeater.
