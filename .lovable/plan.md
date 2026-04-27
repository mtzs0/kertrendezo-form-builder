## Goal

Three refinements to the visual condition canvas demo:

1. Move the field palette from the left sidebar to a horizontal strip at the top of the tab — frees the canvas to span full width.
2. Add a small per-box order-number input on the left side of every canvas box. The number drives field order in the new demo preview.
3. Add a new **Előnézet (demo)** tab that renders the form using the canvas state: fields appear in `order`-number sequence (linear, no groups), with the same conditional-visibility rules already saved on each field.

---

## Changes by file

### `src/form/editor/ConditionCanvas.tsx`

**Layout restructure** — change the outer grid from `[240px_1fr_360px]` (palette · canvas · field-config) to a two-row layout:

```text
┌──────────────────────────────────────────────────────┐
│  Top palette strip (compact horizontal field chips)  │
├───────────────────────────────────────┬──────────────┤
│  Edge inspector (always visible)      │              │
│  Canvas toolbar (zoom etc.)           │  Field       │
│  Canvas (full remaining width)        │  config      │
│                                       │  panel       │
└───────────────────────────────────────┴──────────────┘
```

- The top strip is a single full-width `flex flex-wrap gap-2` of small draggable chips. Each chip shows the field's *külső* label in normal weight and the *belső* name + type in a muted smaller line below — same compact style as the existing palette items, sized to behave as inline chips.
- Empty-state message ("Minden mező a vásznon van.") still shown when nothing is left in the palette.
- Below the strip: a 2-column grid `[minmax(0,1fr)_360px]` for canvas + field-config panel.

**Per-box order number**:

- Extend the persisted localStorage shape from `BoxPos { x, y }` to `BoxPos { x, y, order?: number }`. Existing entries are forward-compatible (missing `order` treated as `undefined`).
- Render a small editable number input on the left edge of each box (absolute-positioned, `-left-3`, ~28px wide), styled like a pill, with `data-no-drag` so dragging the number doesn't drag the box.
- Allow blank input (clears the order). Order is purely metadata for the demo preview tab.
- When the user adds a box for the first time, auto-assign order = (max existing order + 1) so newly placed boxes get a sensible default.

**Renaming/cleanup**:

- Drop the left palette `<aside>` element entirely.
- Move the canvas panel out of its column wrapper into the new grid.

### `src/form/EditorView.tsx`

- Add a new `<TabsTrigger value="demo-preview">Előnézet (demo)</TabsTrigger>` between the canvas tab and the existing preview tab.
- Add a matching `<TabsContent value="demo-preview">` that renders a new `<DemoPreview>` component (defined inline in this file or in a small new file), passing `editor.fields`, `editor.form?.id`, and `editor.form?.thank_you_text`.
- The demo-preview tab reads positions from the same `localStorage` key used by `ConditionCanvas` (`condition-canvas-positions:<formId>`) so it stays in sync with what the user laid out, no extra plumbing required.

### `src/form/editor/DemoPreview.tsx` (new)

A small wrapper that:

1. Reads `condition-canvas-positions:<formId>` from localStorage to get `{ [fieldId]: { x, y, order? } }`.
2. Filters `fields` to those that appear in the positions map.
3. Sorts them by `order` ascending; fields without an `order` go to the end (stable by their insertion order).
4. Builds a synthetic `FormSchema` with `groups: []`, `subGroups: []`, and the sorted fields *re-stamped* so they render linearly:
   - `groupId: undefined`, `subGroupId: undefined`
   - `location: index + 1` (so `filterPlacedSchema` keeps them and `buildRenderTree` orders them)
   - `width: 100` (force one-per-row, ignore packing for clarity)
   - Conditions are kept untouched, so visibility logic still works exactly like in the regular preview.
5. Renders `<FormView schema={syntheticSchema} layout="horizontal" formId={formId} showDemoButton thankYouText={thankYouText} />`.
6. Empty state: if no fields are on the canvas, show a hint asking the user to place fields on the canvas first.

This intentionally ignores groupings as requested — focus is on order + conditions only.

---

## Technical notes

- The order input is uncontrolled-ish (`<input type="number" value={...} onChange>`); on change we update the box's `order` in `positions` state, which auto-persists via the existing `useEffect`.
- Because positions live in localStorage, the new demo tab needs to *re-read* on mount and on tab switch. Easiest: read on mount + listen to a custom `condition-canvas:positions-changed` event dispatched from `ConditionCanvas` after every save, or simply re-read on every render via `useSyncExternalStore` against a small in-module event emitter. Plan: add a tiny `positionsStore.ts` (subscribe/get/set) so both the canvas writer and the demo reader share state without prop drilling through `EditorView`. This avoids stale data when switching tabs.
- No DB schema changes. No `editorApi`/`useEditorSchema` changes.
- Conditions still persist via the existing `setFieldCondition` flow; the demo preview reads them straight from `editor.fields[].condition` like the normal preview does.
