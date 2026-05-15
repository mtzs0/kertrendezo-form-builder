ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS tabs_bg_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tabs_bg_image_url text,
  ADD COLUMN IF NOT EXISTS tabs_bg_overlay_color text,
  ADD COLUMN IF NOT EXISTS tabs_bg_overlay_opacity numeric,
  ADD COLUMN IF NOT EXISTS tabs_bg_font_color text,
  ADD COLUMN IF NOT EXISTS tabs_bg_text_stroke_width numeric,
  ADD COLUMN IF NOT EXISTS tabs_bg_text_stroke_color text;

-- Seed tabs_* from existing button_* values so the previously-shared toggle keeps working after the split.
UPDATE public.forms
SET tabs_bg_enabled = button_bg_enabled,
    tabs_bg_image_url = button_bg_image_url,
    tabs_bg_overlay_color = button_bg_overlay_color,
    tabs_bg_overlay_opacity = button_bg_overlay_opacity,
    tabs_bg_font_color = button_bg_font_color,
    tabs_bg_text_stroke_width = button_bg_text_stroke_width,
    tabs_bg_text_stroke_color = button_bg_text_stroke_color
WHERE tabs_bg_enabled = false AND button_bg_enabled = true;