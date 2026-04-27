## Goal

Add a new **"Vizuális feltételek (demo)"** tab to the editor where conditions can be authored on a large freeform canvas — dragging fields in as boxes and drawing connector lines between them to represent display conditions. The existing per-field condition workflow stays untouched.

## How it works (end-user flow)

1. Open editor → new tab **"Vizuális feltételek (demo)"** appears next to the existing tabs.
2. Left side: a **field palette** listing all form fields (same source as the Mező/Űrlap tabs).
3. Right side: a large **scrollable/zoomable canvas**.
4. Drag a field from the palette onto the canvas → a **field box** appears at drop position showing the field's label, internal name and type icon.
5. Each box has two anchor handles:
   - **Top handle** = "this field's display depends on…"
   - **Bottom handle** = "this field is a source for other conditions"
6. Click + drag from `field_B`'s **top** to `field_A`'s **bottom** → a curved line is drawn. A small inline editor pops up on the line (or in a side panel) to set:
   - **Operator** — filtered by `field_A`'s type (slider → `>`, `<`, `=`, `≠`; radio/checkbox/select → `=`, `≠`, `contains`; text/email/etc → `=`, `≠`, `contains`).
   - **Value** — typed/selected with the same `ValueInput` used today (option dropdown for radio/select, number for slider, etc).
7. Multiple incoming lines into a field = multiple conditions on that field. A toggle on the target box switches the combinator (**ÉS / VAGY**) for all its incoming lines.
8. Editing or deleting a line / box updates the underlying condition data.
9. A "Mentés" indicator (same pattern as elsewhere) shows save status.

## Persistence

Conditions are saved through the **existing** `setFieldCondition(fieldId, ConditionGroup)` API → no schema changes needed. Each target box's incoming lines are serialized as one flat `ConditionGroup`:

```ts
{
  combinator: "and" | "or",
  rules: [{ fieldId: <source>, operator, value }, ...]
}
```

This means conditions created on the canvas are **the same conditions** shown in the existing per-field condition editor (and vice versa). The tab is "demo" only in UX terms — the data is real and shared.

**Canvas layout** (box positions on the canvas) is local-only for this demo: stored in `localStorage` keyed by form id. A future iteration can persist it in a new table if desired.

## Tech approach

- New file `src/form/editor/ConditionCanvas.tsx` containing the whole canvas UI.
- Use **plain absolute-positioned divs + an SVG overlay** for connectors (no new dependency). Boxes are draggable with native pointer events; connectors are SVG cubic Bézier paths between anchor points.
- Reuse `ValueInput` logic from `ConditionEditor.tsx` — extract the `ValueInput` and operator-list helpers into a small shared module `src/form/editor/conditionInputs.tsx` so both editors share them (no behavior change to existing editor).
- Wire the new tab in `src/form/EditorView.tsx`:
  - Add `<TabsTrigger value="canvas">Vizuális feltételek (demo)</TabsTrigger>`.
  - Render `<ConditionCanvas fields={editor.fields} onSetCondition={editor.setFieldCondition} formId={editor.form?.id} />`.
- Canvas bootstraps from existing conditions: any field with a `condition` is auto-placed (cascaded layout) and its rules become incoming lines, so opening the tab on an existing form shows current conditions visually.

### ASCII sketch

```text
+--------------------------------------------------------------+
| Palette         |  Canvas (scroll/zoom)                      |
| [field_A]       |                                            |
| [field_B]       |   +--------+        +--------+             |
| [field_C]       |   |field_A |        |field_C |             |
| [field_D]       |   +---o----+        +---o----+             |
|                 |       \                /                   |
|                 |        \              /                    |
|                 |         v            v                     |
|                 |       +-o-----------o--+                   |
|                 |       |   field_B      | [ÉS|VAGY]         |
|                 |       +----------------+                   |
|                 |                                            |
|                 |  Selected line: A > 50  [op▼] [value]  [x] |
+--------------------------------------------------------------+
```

## Out of scope (for this demo iteration)

- Nested condition groups (parentheses). The canvas flattens to a single AND/OR group per target. If a field already has a nested condition authored in the old editor, it's shown read-only with a note "Komplex feltétel — szerkeszd a Mező fülön".
- Persisting box positions server-side.
- Multi-select / box-group operations.
- Undo/redo.

## Files

- **New**: `src/form/editor/ConditionCanvas.tsx` (canvas, palette, boxes, connectors, line editor popover).
- **New**: `src/form/editor/conditionInputs.tsx` (shared `ValueInput` + operator list helpers, extracted from `ConditionEditor.tsx`).
- **Edit**: `src/form/editor/ConditionEditor.tsx` — import shared helpers (no UX change).
- **Edit**: `src/form/EditorView.tsx` — add the new tab and mount `ConditionCanvas`.
