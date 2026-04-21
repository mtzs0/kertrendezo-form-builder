ALTER TABLE public.form_fields ADD COLUMN IF NOT EXISTS hide_label boolean NOT NULL DEFAULT false;
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'label';