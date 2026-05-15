ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS visual_bg_font_color text,
  ADD COLUMN IF NOT EXISTS visual_bg_text_stroke_width numeric,
  ADD COLUMN IF NOT EXISTS visual_bg_text_stroke_color text;

ALTER TABLE public.form_groups
  ADD COLUMN IF NOT EXISTS visual_bg_font_color text,
  ADD COLUMN IF NOT EXISTS visual_bg_text_stroke_width numeric,
  ADD COLUMN IF NOT EXISTS visual_bg_text_stroke_color text;

ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS button_bg_font_color text,
  ADD COLUMN IF NOT EXISTS button_bg_text_stroke_width numeric,
  ADD COLUMN IF NOT EXISTS button_bg_text_stroke_color text;