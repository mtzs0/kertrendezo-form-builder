-- Add placeholder + image-layout columns to form_fields
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS placeholder_image_url text NULL,
  ADD COLUMN IF NOT EXISTS placeholder_note_value text NULL,
  ADD COLUMN IF NOT EXISTS placeholder_note_position public.note_position NULL,
  ADD COLUMN IF NOT EXISTS option_label_position text NULL,
  ADD COLUMN IF NOT EXISTS field_image_position text NULL;

ALTER TABLE public.form_fields
  ADD CONSTRAINT form_fields_option_label_position_chk
  CHECK (option_label_position IS NULL OR option_label_position IN ('above', 'below'));

ALTER TABLE public.form_fields
  ADD CONSTRAINT form_fields_field_image_position_chk
  CHECK (field_image_position IS NULL OR field_image_position IN ('above', 'below', 'left', 'right'));

-- Public storage bucket for option illustrations
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-option-images', 'form-option-images', true)
ON CONFLICT (id) DO NOTHING;

-- Public read; permissive write (matches existing TEMP open policies, lock down with auth later)
CREATE POLICY "Option images are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'form-option-images');

CREATE POLICY "TEMP anyone can upload option images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'form-option-images');

CREATE POLICY "TEMP anyone can update option images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'form-option-images');

CREATE POLICY "TEMP anyone can delete option images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'form-option-images');