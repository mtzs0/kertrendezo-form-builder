## Vizuális háttér (Visual Background)

A reusable "visual background" treatment (image + colored overlay) will be added to three places: option-type fields (radio/checkbox), groups (their step tab), and the form-wide "Tovább"/"Küldés" buttons. All three share the same shape: `{ enabled, imageUrl, overlayColor (default #000000), overlayOpacity (default 0.5) }`. Images uploaded anywhere become reusable across all three surfaces via a small image-library picker that reads previously uploaded URLs.

### 1. Database migration

Add 4 columns to each of:

- `form_fields` — `visual_bg_enabled bool not null default false`, `visual_bg_image_url text`, `visual_bg_overlay_color text`, `visual_bg_overlay_opacity numeric` (only used when `type in ('radio','checkbox')`)
- `form_groups` — same 4 columns (used by both groups and sub-groups since they share the table)
- `forms` — `button_bg_enabled`, `button_bg_image_url`, `button_bg_overlay_color`, `button_bg_overlay_opacity` (action-button background)

### 2. Image library (no new table)

A small helper `loadVisualBackgroundLibrary(formId)` does a `select` on each of the 3 tables for non-null image URLs scoped to `form_id`, then dedupes. The existing public storage bucket `form-option-images` keeps storing uploads (under a new `visual-bg/` prefix); a shared `<VisualBackgroundPicker>` shows the existing `<ImageUploader>` plus a thumbnail grid of previously used URLs to click-to-select.

### 3. Reusable `<VisualBackgroundConfig>` editor block

New component used in 3 places: option-field config, group settings dialog, and form settings tab. UI:

- Master "Vizuális háttér" Switch
- When ON: image uploader + library grid, color picker (default `#000000`), opacity slider 0–100% (default 50%), live preview tile

### 4. Option fields (radio + checkbox)

- `OptionField` type gains `visualBackground?: VisualBackground` (radio/checkbox only — UI hides for `select`)
- `FieldConfigPanel`: render `<VisualBackgroundConfig>` block for radio/checkbox
- `OptionFieldRenderer`: when an option is **selected** AND `visualBackground.enabled`, replace the card's normal selected styling with the uploaded background image (`background-size: cover; position: center; no-repeat`) plus an absolutely-positioned overlay `<div>` using `overlayColor` at `overlayOpacity`. Card text + indicator stay visible above the overlay (white text).

### 5. Groups

- `FormGroup` and `FormSubGroup` types gain `visualBackground?`
- `ConditionCanvas`: add a `Cog` icon button in every group/sub-group frame header. Clicking opens a `<GroupSettingsDialog>` (new component, shadcn `Dialog`) containing:
  - Internal name, label, color (existing fields, lifted from inline editing for consistency)
  - `<VisualBackgroundConfig>` block
- `useEditorSchema.patchGroup`/`patchSubGroup` already accept `Partial<FormGroup>` — extend with `visualBackground` and pipe through `editorApi.updateGroup`/`updateSubGroup`
- `StepNavigator`: accept a `groupBackgrounds: Record<string, VisualBackground>` prop. When the active tab has an enabled background, render the active pill with `background-image: url(...)`, `background-size: cover`, plus the overlay div. (Inactive tabs unchanged.)
- `FormView`: pass `schema.groups[*].visualBackground` to `StepNavigator`

### 6. Action buttons (form-level)

- Settings tab gets a new section "Gombok háttere" using `<VisualBackgroundConfig>`
- `forms` table gains `button_bg_*` columns wired through `EditorForm`, `updateFormMeta`, `useEditorSchema.patchForm`
- `FormView` accepts `buttonBackground?: VisualBackground` (passed from EditorView/Embed). Applied to the "Tovább" and "Küldés" buttons (and "Demo küldés"). Implementation: when enabled, swap the button's gradient classes for an inline-style `background-image` + an inner overlay span; keep text/icon white.

### 7. Image fit (per spec)

Both option cards and tab pills will use `background-size: cover; background-position: center; background-repeat: no-repeat` — taller images are cropped top/bottom, wider images are cropped left/right.

### Technical notes

- `editorApi.ts`: extend `FieldExtraCols`, `FieldPatch`, `updateField`, `rowToField` (option case), `updateGroup`/`updateSubGroup` patch shape, `EditorForm` interface, `updateFormMeta`, `loadEditorBundle` (read group bg cols + form bg cols)
- `useEditorSchema.ts`: extend `patchForm` signature, group/sub-group patch buffers already merge generically — only the schema mapping needs tweaks
- All UI strings remain in Hungarian
- Default overlay = `#000000` / `0.5` are stored as defaults the moment the toggle flips on (so DB always has values when enabled)

After your approval I'll start with the migration, then implement the rest in one pass.