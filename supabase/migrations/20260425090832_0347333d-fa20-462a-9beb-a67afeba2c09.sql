-- Unify groups and sub-groups into a single self-referencing form_groups table.
-- Sub-groups become top-level group rows with parent_group_id pointing at their parent.
-- Field.sub_group_id stays the same column, now pointing at the (former) sub-group rows in form_groups.

-- 1) Add self-FK column to form_groups.
ALTER TABLE public.form_groups
  ADD COLUMN IF NOT EXISTS parent_group_id UUID NULL REFERENCES public.form_groups(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_form_groups_parent_group_id ON public.form_groups(parent_group_id);

-- 2) Drop old validator + FK on form_fields.sub_group_id (it references form_sub_groups).
DROP TRIGGER IF EXISTS form_fields_validate_sub_group ON public.form_fields;
DROP FUNCTION IF EXISTS public.validate_field_sub_group();

ALTER TABLE public.form_fields
  DROP CONSTRAINT IF EXISTS form_fields_sub_group_id_fkey;

-- 3) Copy every form_sub_groups row into form_groups, preserving id/internal_name/label/position/width/form_id,
--    and setting parent_group_id = old group_id.
INSERT INTO public.form_groups (id, form_id, internal_name, label, position, width_percent, parent_group_id, created_at, updated_at)
SELECT s.id, s.form_id, s.internal_name, s.label, s.position, s.width_percent, s.group_id, s.created_at, s.updated_at
FROM public.form_sub_groups s
ON CONFLICT (id) DO NOTHING;

-- 4) Re-create FK on form_fields.sub_group_id to point at form_groups now.
ALTER TABLE public.form_fields
  ADD CONSTRAINT form_fields_sub_group_id_fkey
  FOREIGN KEY (sub_group_id) REFERENCES public.form_groups(id) ON DELETE SET NULL;

-- 5) Drop the obsolete form_sub_groups table.
DROP TABLE public.form_sub_groups;

-- 6) Re-add a lightweight validation: when sub_group_id is set, it must be a child of group_id.
CREATE OR REPLACE FUNCTION public.validate_field_sub_group()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_id UUID;
BEGIN
  IF NEW.sub_group_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT parent_group_id INTO parent_id
  FROM public.form_groups
  WHERE id = NEW.sub_group_id;

  IF parent_id IS NULL THEN
    RAISE EXCEPTION 'sub_group_id % is not a sub-group (no parent_group_id)', NEW.sub_group_id;
  END IF;

  IF NEW.group_id IS NULL OR NEW.group_id <> parent_id THEN
    RAISE EXCEPTION 'Field sub_group_id must belong to the same group as group_id';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER form_fields_validate_sub_group
BEFORE INSERT OR UPDATE ON public.form_fields
FOR EACH ROW EXECUTE FUNCTION public.validate_field_sub_group();

-- 7) Prevent groups from being more than 2 levels deep: a sub-group's parent must be top-level.
CREATE OR REPLACE FUNCTION public.validate_group_depth()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  grandparent UUID;
BEGIN
  IF NEW.parent_group_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT parent_group_id INTO grandparent
  FROM public.form_groups
  WHERE id = NEW.parent_group_id;
  IF grandparent IS NOT NULL THEN
    RAISE EXCEPTION 'Groups can only be nested two levels deep';
  END IF;
  -- Also: if this group has children, it cannot itself become a sub-group.
  IF EXISTS (SELECT 1 FROM public.form_groups WHERE parent_group_id = NEW.id) THEN
    RAISE EXCEPTION 'A group with sub-groups cannot become a sub-group';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS form_groups_validate_depth ON public.form_groups;
CREATE TRIGGER form_groups_validate_depth
BEFORE INSERT OR UPDATE ON public.form_groups
FOR EACH ROW EXECUTE FUNCTION public.validate_group_depth();