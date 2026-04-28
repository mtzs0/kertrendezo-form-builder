## Goal

Bring the existing **groups + sub-groups** system into the visual condition canvas. Today the canvas is a flat dot-grid where each field-box lives at a free `(x, y)`. Groups/sub-groups exist in the schema but are invisible here. Users want to see and manage groupings directly on the canvas.

## UX design

Group = a **resizable rectangular frame** drawn on the canvas. Field-boxes that sit inside the frame's bounds belong to that group. Sub-groups are the same idea, drawn *inside* a group frame.

```text
┌─ Group: "Kapcsolat" ──────────────── [⋮] ┐
│                                          │
│   ┌─ Subgroup: "Cím" ──────────────┐     │
│   │   [field box]   [field box]     │    │
│   └─────────────────────────────────┘    │
│                                          │
│   [field box]                            │
└──────────────────────────────────────────┘
```

Key behaviors:

- **Frame = container.** Dragging a field-box so its center lands inside a group frame sets `field.groupId` to that group (and `subGroupId` to a subgroup if its center is inside one). Dragging it out clears the assignment. This replaces having to set the group from a side panel.
- **Frame is draggable & resizable.** Drag the title bar to move it (children move with it). Drag the bottom-right corner to resize. Position + size persist per form.
- **Auto-fit option.** Each frame has a small "Igazítás a tartalomhoz" action in its menu that snaps the rectangle to tightly enclose its current children.
- **Sub-groups must live inside a group frame.** Creating one outside an existing group frame is blocked with a toast. Resizing a parent never auto-shrinks below its sub-groups.
- **Visual style.** Group = subtle dashed border with a colored title bar (using `--secondary` / accent), behind everything. Sub-group = lighter inner card with a smaller title bar. Field-boxes render *on top* with their existing chrome unchanged (handles, order pill).
- **Z-order.** SVG arrows stay on top of frames but under field-boxes; frames sit at the back so they never block clicks on boxes.
- **Palette.** Add a second palette strip row above the field strip listing groups + sub-groups not yet placed on the canvas. Drag one onto the canvas to drop a default-sized frame at the cursor.
- **Toolbar.** Add an "Új csoport" button next to "Új mező" that creates a group via `editor.addGroup` and immediately drops a frame at the canvas center.
- **Removal.** Right-click a frame → "Eltávolítás a vászonról" (keeps the group in the schema, just hides the frame) or "Törlés" (calls `editor.removeGroup` / `removeSubGroup`).

### Linear demo preview interaction

The Előnézet (demo) tab already ignores groupings on purpose. We keep that — the canvas grouping is purely a UX shortcut for assigning `groupId` / `subGroupId` and matches what the **Űrlap** tab renders.

## Technical notes

### New persistence

Add a sibling table `form_group_canvas_frames` (mirrors `form_field_canvas_positions`):

```text
id (uuid pk)
form_id (uuid, fk forms.id, on delete cascade)
group_id (uuid)        -- references groups OR sub_groups (kind disambiguates)
kind ('group' | 'subgroup')
x, y, w, h (numeric)
collapsed (bool, default false)   -- reserved for future
unique (form_id, group_id, kind)
```

Migration + RLS (same policy shape as `form_field_canvas_positions`).

Add `src/form/groupCanvasFramesApi.ts` with `loadFrames(formId)`, `upsertFrame(...)`, `deleteFrame(...)`. Add `src/form/editor/groupFramesStore.ts` mirroring `canvasPositionsStore.ts` (in-memory cache, debounced upserts, `useGroupFrames(formId)` hook).

### Containment logic

Pure helper `resolveContainerFor(box, frames)` in a new `src/form/editor/canvasContainers.ts`:

1. Compute box center `(cx, cy)`.
2. Find all subgroup frames whose rectangle contains the center → pick the smallest (deepest).
3. If no subgroup match, find all group frames whose rectangle contains it → pick the smallest.
4. Return `{ groupId?, subGroupId? }`.

Called from `ConditionCanvas`'s `onBoxPointerDown` `up` handler (after a real drag) and from `onCanvasDrop` (palette → canvas). The result is diffed against the field's current `groupId`/`subGroupId`; on change, call `editor.patchField(id, { groupId, subGroupId })` (already wired through `useEditorSchema.patchField`).

### Frame interactions

In `ConditionCanvas.tsx`:

- New `frames` array merged from the store + auto-place frames for groups/sub-groups that have at least one already-placed child but no frame yet (compute bounding box of children + 24px padding).
- Render frames in a `<div>` layer **inside the world layer, before** the SVG and the boxes layer (so z-order is: frames < arrows < boxes). Each frame is absolutely positioned with `left/top/width/height` from the store.
- Title bar: draggable (pointer handlers same pattern as boxes). On drag, move all child field-boxes by the same `dx, dy` so their relative positions are preserved; persist via `updatePositions`.
- Resize handle: bottom-right corner, pointer events update `w, h` in the frame store. Min size = 160×120. When resizing a group, clamp so it never becomes smaller than the union rect of its sub-groups.
- Sub-group constraint check on creation: if user drops a subgroup frame outside any group, show a toast and revert.

### Toolbar additions

Add buttons + dropdown next to "Új mező":

- **Új csoport** → `await editor.addGroup()`, then place a 360×220 frame at canvas center.
- **Új al-csoport** (DropdownMenu listing existing placed groups) → `editor.addSubGroup(groupId)`, then place a 280×160 frame nested inside that group's frame.

### Files to add

- `supabase/migrations/<ts>_form_group_canvas_frames.sql`
- `src/form/groupCanvasFramesApi.ts`
- `src/form/editor/groupFramesStore.ts`
- `src/form/editor/canvasContainers.ts`
- `src/form/editor/CanvasGroupFrame.tsx` (presentational frame component)

### Files to edit

- `src/form/editor/ConditionCanvas.tsx` — render frames layer, hook drag/drop to containment resolver, add toolbar buttons, palette row for unplaced groups.
- `src/integrations/supabase/types.ts` — regenerated for the new table (auto).

### Out of scope

- Nested sub-sub-groups (schema doesn't support them).
- Editing group labels from the canvas — still done in the Csoportok tab. (Frame title shows the label read-only.)
- Changing the linear Előnézet (demo) to honor groups — explicitly kept flat.
