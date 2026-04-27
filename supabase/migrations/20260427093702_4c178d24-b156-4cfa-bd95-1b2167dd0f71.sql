-- Add 'repeater' to the field type enum.
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'repeater';

-- Add a JSONB column to form_fields that holds the repeater's full
-- configuration: item label, add-button label, min/max instances, the
-- title-child id, and the array of child field definitions (each child
-- is a self-contained FormField including its own options/conditions).
ALTER TABLE public.form_fields
  ADD COLUMN IF NOT EXISTS repeater_config jsonb;