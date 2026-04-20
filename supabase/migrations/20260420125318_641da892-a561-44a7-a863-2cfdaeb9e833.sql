-- =========================================================
-- Schema editor data model (English names)
-- =========================================================

-- ---------- form_groups ----------
CREATE TABLE public.form_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  internal_name TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_groups_form_id ON public.form_groups(form_id);
CREATE INDEX idx_form_groups_form_position ON public.form_groups(form_id, position);

ALTER TABLE public.form_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Groups of published forms are readable"
ON public.form_groups
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.forms f
  WHERE f.id = form_groups.form_id AND f.published = true
));

CREATE TRIGGER update_form_groups_updated_at
BEFORE UPDATE ON public.form_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- form_sub_groups ----------
CREATE TABLE public.form_sub_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.form_groups(id) ON DELETE CASCADE,
  internal_name TEXT NOT NULL,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_sub_groups_form_id ON public.form_sub_groups(form_id);
CREATE INDEX idx_form_sub_groups_group_id ON public.form_sub_groups(group_id);
CREATE INDEX idx_form_sub_groups_group_position ON public.form_sub_groups(group_id, position);

ALTER TABLE public.form_sub_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sub-groups of published forms are readable"
ON public.form_sub_groups
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.forms f
  WHERE f.id = form_sub_groups.form_id AND f.published = true
));

CREATE TRIGGER update_form_sub_groups_updated_at
BEFORE UPDATE ON public.form_sub_groups
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- field type enum ----------
CREATE TYPE public.field_type AS ENUM (
  'text',
  'textarea',
  'slider',
  'radio',
  'checkbox',
  'select',
  'phone',
  'date',
  'image'
);

CREATE TYPE public.note_position AS ENUM (
  'above',
  'below',
  'side'
);


-- ---------- form_fields ----------
CREATE TABLE public.form_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.form_groups(id) ON DELETE SET NULL,
  sub_group_id UUID REFERENCES public.form_sub_groups(id) ON DELETE SET NULL,

  internal_name TEXT NOT NULL,
  label TEXT NOT NULL,
  placeholder TEXT,
  required BOOLEAN NOT NULL DEFAULT false,
  type public.field_type NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,

  -- Note shown alongside the field (when not using per-option notes)
  note_value TEXT,
  note_position public.note_position,

  -- Slider settings
  slider_min NUMERIC,
  slider_max NUMERIC,
  slider_step NUMERIC,
  slider_unit TEXT,

  -- Date settings
  with_time BOOLEAN NOT NULL DEFAULT false,

  -- Image settings
  multiple_images BOOLEAN NOT NULL DEFAULT false,

  -- Options (radio / checkbox / select) settings
  use_images BOOLEAN NOT NULL DEFAULT false,
  unique_note_per_option BOOLEAN NOT NULL DEFAULT false,
  columns INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_form_fields_form_id ON public.form_fields(form_id);
CREATE INDEX idx_form_fields_group_id ON public.form_fields(group_id);
CREATE INDEX idx_form_fields_sub_group_id ON public.form_fields(sub_group_id);
CREATE INDEX idx_form_fields_form_position ON public.form_fields(form_id, position);

ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fields of published forms are readable"
ON public.form_fields
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.forms f
  WHERE f.id = form_fields.form_id AND f.published = true
));

CREATE TRIGGER update_form_fields_updated_at
BEFORE UPDATE ON public.form_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Make sure a sub_group, when set, belongs to the same group as the field.
CREATE OR REPLACE FUNCTION public.validate_field_sub_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  sg_group_id UUID;
BEGIN
  IF NEW.sub_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT group_id INTO sg_group_id
  FROM public.form_sub_groups
  WHERE id = NEW.sub_group_id;

  IF sg_group_id IS NULL THEN
    RAISE EXCEPTION 'Sub-group % does not exist', NEW.sub_group_id;
  END IF;

  IF NEW.group_id IS NULL OR NEW.group_id <> sg_group_id THEN
    RAISE EXCEPTION 'Field sub_group_id must belong to the same group as group_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER form_fields_validate_sub_group
BEFORE INSERT OR UPDATE ON public.form_fields
FOR EACH ROW EXECUTE FUNCTION public.validate_field_sub_group();


-- ---------- form_field_options ----------
CREATE TABLE public.form_field_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID NOT NULL REFERENCES public.form_fields(id) ON DELETE CASCADE,

  display_name TEXT NOT NULL,
  data_name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 1,

  -- Per-option note (used when the field has unique_note_per_option = true)
  note_value TEXT,
  note_position public.note_position,

  -- Per-option illustration (used when the field has use_images = true)
  image_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (field_id, data_name)
);

CREATE INDEX idx_form_field_options_field_id ON public.form_field_options(field_id);
CREATE INDEX idx_form_field_options_field_position ON public.form_field_options(field_id, position);

ALTER TABLE public.form_field_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Options of fields on published forms are readable"
ON public.form_field_options
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM public.form_fields ff
  JOIN public.forms f ON f.id = ff.form_id
  WHERE ff.id = form_field_options.field_id AND f.published = true
));

CREATE TRIGGER update_form_field_options_updated_at
BEFORE UPDATE ON public.form_field_options
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ---------- form_field_conditions ----------
-- One row per field that has a visibility condition.
-- The "rules" JSON mirrors the ConditionGroup structure used in the client:
--   { combinator: "and" | "or",
--     rules: Array<
--       { fieldId: uuid, operator: "is"|"is_not"|"equals"|"greater_than"|"less_than"|"contains", value: any }
--       | ConditionGroup
--     >
--   }
CREATE TABLE public.form_field_conditions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  field_id UUID NOT NULL UNIQUE REFERENCES public.form_fields(id) ON DELETE CASCADE,
  combinator TEXT NOT NULL DEFAULT 'and',
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT form_field_conditions_combinator_check CHECK (combinator IN ('and', 'or'))
);

CREATE INDEX idx_form_field_conditions_field_id ON public.form_field_conditions(field_id);

ALTER TABLE public.form_field_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conditions of fields on published forms are readable"
ON public.form_field_conditions
FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM public.form_fields ff
  JOIN public.forms f ON f.id = ff.form_id
  WHERE ff.id = form_field_conditions.field_id AND f.published = true
));

CREATE TRIGGER update_form_field_conditions_updated_at
BEFORE UPDATE ON public.form_field_conditions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();