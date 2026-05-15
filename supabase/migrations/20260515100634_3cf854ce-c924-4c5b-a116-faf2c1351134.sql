-- Visual background columns for option fields (radio/checkbox), groups, and form-level action buttons.
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS visual_bg_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visual_bg_image_url text,
  ADD COLUMN IF NOT EXISTS visual_bg_overlay_color text,
  ADD COLUMN IF NOT EXISTS visual_bg_overlay_opacity numeric;

ALTER TABLE public.form_groups
  ADD COLUMN IF NOT EXISTS visual_bg_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS visual_bg_image_url text,
  ADD COLUMN IF NOT EXISTS visual_bg_overlay_color text,
  ADD COLUMN IF NOT EXISTS visual_bg_overlay_opacity numeric;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS button_bg_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS button_bg_image_url text,
  ADD COLUMN IF NOT EXISTS button_bg_overlay_color text,
  ADD COLUMN IF NOT EXISTS button_bg_overlay_opacity numeric;