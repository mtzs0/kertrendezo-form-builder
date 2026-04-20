-- Add width_percent column to fields, groups and sub-groups for horizontal sizing.
-- Allowed values: 25, 33, 40, 50, 60, 100 (NULL = full width default).
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS width_percent smallint NULL;

ALTER TABLE public.form_groups
  ADD COLUMN IF NOT EXISTS width_percent smallint NULL;

ALTER TABLE public.form_sub_groups
  ADD COLUMN IF NOT EXISTS width_percent smallint NULL;

ALTER TABLE public.form_fields
  ADD CONSTRAINT form_fields_width_percent_chk
  CHECK (width_percent IS NULL OR width_percent IN (25, 33, 40, 50, 60, 100));

ALTER TABLE public.form_groups
  ADD CONSTRAINT form_groups_width_percent_chk
  CHECK (width_percent IS NULL OR width_percent IN (25, 33, 40, 50, 60, 100));

ALTER TABLE public.form_sub_groups
  ADD CONSTRAINT form_sub_groups_width_percent_chk
  CHECK (width_percent IS NULL OR width_percent IN (25, 33, 40, 50, 60, 100));
