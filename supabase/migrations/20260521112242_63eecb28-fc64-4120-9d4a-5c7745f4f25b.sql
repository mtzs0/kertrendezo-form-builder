
-- =========================================================
-- 1. Add owner_id to forms + claim function
-- =========================================================
ALTER TABLE public.forms
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS forms_owner_id_idx ON public.forms(owner_id);

-- Any authenticated user can claim an unclaimed form (one-shot).
CREATE OR REPLACE FUNCTION public.claim_form(_form_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Must be authenticated to claim a form';
  END IF;

  SELECT owner_id INTO current_owner FROM public.forms WHERE id = _form_id;
  IF current_owner IS NOT NULL THEN
    RETURN false;
  END IF;

  UPDATE public.forms SET owner_id = auth.uid() WHERE id = _form_id AND owner_id IS NULL;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_form(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_form(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_form(uuid) TO anon, authenticated;

-- Required for new tables on May 30, 2026+:
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forms TO anon, authenticated;

-- =========================================================
-- 2. Drop ALL TEMP policies
-- =========================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname LIKE 'TEMP %'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- =========================================================
-- 3. forms — owner-scoped policies + column hiding
-- =========================================================
-- Existing "Published forms are publicly readable" stays in place.
-- Add: owners can read their own forms (any state).
CREATE POLICY "Owners can read their own forms"
  ON public.forms FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

-- Owners can update / delete their own forms.
CREATE POLICY "Owners can update their own forms"
  ON public.forms FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their own forms"
  ON public.forms FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Authenticated users can create forms — owner must be themselves OR
-- left NULL (then claimable). We require owner_id = auth.uid() to be safe.
CREATE POLICY "Authenticated users can create forms"
  ON public.forms FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Column-level grants: hide sensitive URL columns from anon.
-- Anon can only read the safe subset; owners (authenticated) keep full access via owner policy.
REVOKE SELECT ON public.forms FROM anon;
GRANT SELECT (
  id, slug, title, description, schema, published, thank_you_text,
  active_layout_id, canvas_reveal_one_by_one,
  include_page_url, include_browser, include_device_type,
  button_bg_enabled, button_bg_image_url, button_bg_overlay_color,
  button_bg_overlay_opacity, button_bg_font_color,
  button_bg_text_stroke_width, button_bg_text_stroke_color,
  tabs_bg_enabled, tabs_bg_image_url, tabs_bg_overlay_color,
  tabs_bg_overlay_opacity, tabs_bg_font_color,
  tabs_bg_text_stroke_width, tabs_bg_text_stroke_color,
  created_at, updated_at
) ON public.forms TO anon;

-- =========================================================
-- 4. Helper: is the caller the owner of a given form?
-- =========================================================
CREATE OR REPLACE FUNCTION public.is_form_owner(_form_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.forms
    WHERE id = _form_id AND owner_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_form_owner(uuid) TO authenticated, anon;

-- =========================================================
-- 5. Child tables — owner-scoped write policies
--    (existing "published form is readable" SELECT policies stay)
-- =========================================================

-- form_fields
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_fields TO anon, authenticated;
CREATE POLICY "Owners can read their form fields"
  ON public.form_fields FOR SELECT TO authenticated
  USING (public.is_form_owner(form_id));
CREATE POLICY "Owners can insert form fields"
  ON public.form_fields FOR INSERT TO authenticated
  WITH CHECK (public.is_form_owner(form_id));
CREATE POLICY "Owners can update form fields"
  ON public.form_fields FOR UPDATE TO authenticated
  USING (public.is_form_owner(form_id))
  WITH CHECK (public.is_form_owner(form_id));
CREATE POLICY "Owners can delete form fields"
  ON public.form_fields FOR DELETE TO authenticated
  USING (public.is_form_owner(form_id));

-- form_groups
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_groups TO anon, authenticated;
CREATE POLICY "Owners can read their groups"
  ON public.form_groups FOR SELECT TO authenticated
  USING (public.is_form_owner(form_id));
CREATE POLICY "Owners can insert groups"
  ON public.form_groups FOR INSERT TO authenticated
  WITH CHECK (public.is_form_owner(form_id));
CREATE POLICY "Owners can update groups"
  ON public.form_groups FOR UPDATE TO authenticated
  USING (public.is_form_owner(form_id))
  WITH CHECK (public.is_form_owner(form_id));
CREATE POLICY "Owners can delete groups"
  ON public.form_groups FOR DELETE TO authenticated
  USING (public.is_form_owner(form_id));

-- form_field_options
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field_options TO anon, authenticated;
CREATE POLICY "Owners can read their field options"
  ON public.form_field_options FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_options.field_id
                   AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Owners can insert field options"
  ON public.form_field_options FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.form_fields ff
                      WHERE ff.id = form_field_options.field_id
                        AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Owners can update field options"
  ON public.form_field_options FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_options.field_id
                   AND public.is_form_owner(ff.form_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.form_fields ff
                      WHERE ff.id = form_field_options.field_id
                        AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Owners can delete field options"
  ON public.form_field_options FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_options.field_id
                   AND public.is_form_owner(ff.form_id)));

-- form_field_conditions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field_conditions TO anon, authenticated;
CREATE POLICY "Owners can read their field conditions"
  ON public.form_field_conditions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_conditions.field_id
                   AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Owners can insert field conditions"
  ON public.form_field_conditions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.form_fields ff
                      WHERE ff.id = form_field_conditions.field_id
                        AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Owners can update field conditions"
  ON public.form_field_conditions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_conditions.field_id
                   AND public.is_form_owner(ff.form_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.form_fields ff
                      WHERE ff.id = form_field_conditions.field_id
                        AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Owners can delete field conditions"
  ON public.form_field_conditions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_conditions.field_id
                   AND public.is_form_owner(ff.form_id)));

-- form_layouts
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_layouts TO anon, authenticated;
CREATE POLICY "Owners can read their layouts"
  ON public.form_layouts FOR SELECT TO authenticated
  USING (public.is_form_owner(form_id));
-- Public can read layouts for published forms (needed by usePublishedForm).
CREATE POLICY "Layouts of published forms are readable"
  ON public.form_layouts FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.forms f
                 WHERE f.id = form_layouts.form_id AND f.published = true));
CREATE POLICY "Owners can insert layouts"
  ON public.form_layouts FOR INSERT TO authenticated
  WITH CHECK (public.is_form_owner(form_id));
CREATE POLICY "Owners can update layouts"
  ON public.form_layouts FOR UPDATE TO authenticated
  USING (public.is_form_owner(form_id))
  WITH CHECK (public.is_form_owner(form_id));
CREATE POLICY "Owners can delete layouts"
  ON public.form_layouts FOR DELETE TO authenticated
  USING (public.is_form_owner(form_id));

-- form_field_canvas_positions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_field_canvas_positions TO anon, authenticated;
CREATE POLICY "Owners can read their canvas positions"
  ON public.form_field_canvas_positions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_canvas_positions.field_id
                   AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Canvas positions of published forms are readable"
  ON public.form_field_canvas_positions FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 JOIN public.forms f ON f.id = ff.form_id
                 WHERE ff.id = form_field_canvas_positions.field_id
                   AND f.published = true));
CREATE POLICY "Owners can insert canvas positions"
  ON public.form_field_canvas_positions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.form_fields ff
                      WHERE ff.id = form_field_canvas_positions.field_id
                        AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Owners can update canvas positions"
  ON public.form_field_canvas_positions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_canvas_positions.field_id
                   AND public.is_form_owner(ff.form_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.form_fields ff
                      WHERE ff.id = form_field_canvas_positions.field_id
                        AND public.is_form_owner(ff.form_id)));
CREATE POLICY "Owners can delete canvas positions"
  ON public.form_field_canvas_positions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_fields ff
                 WHERE ff.id = form_field_canvas_positions.field_id
                   AND public.is_form_owner(ff.form_id)));

-- form_group_canvas_frames
GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_group_canvas_frames TO anon, authenticated;
CREATE POLICY "Owners can read their group canvas frames"
  ON public.form_group_canvas_frames FOR SELECT TO authenticated
  USING (public.is_form_owner(form_id));
CREATE POLICY "Group canvas frames of published forms are readable"
  ON public.form_group_canvas_frames FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.forms f
                 WHERE f.id = form_group_canvas_frames.form_id AND f.published = true));
CREATE POLICY "Owners can insert group canvas frames"
  ON public.form_group_canvas_frames FOR INSERT TO authenticated
  WITH CHECK (public.is_form_owner(form_id));
CREATE POLICY "Owners can update group canvas frames"
  ON public.form_group_canvas_frames FOR UPDATE TO authenticated
  USING (public.is_form_owner(form_id))
  WITH CHECK (public.is_form_owner(form_id));
CREATE POLICY "Owners can delete group canvas frames"
  ON public.form_group_canvas_frames FOR DELETE TO authenticated
  USING (public.is_form_owner(form_id));

-- =========================================================
-- 6. form_submissions — owners can read their own
-- =========================================================
GRANT SELECT, INSERT ON public.form_submissions TO anon, authenticated;
CREATE POLICY "Owners can read their form submissions"
  ON public.form_submissions FOR SELECT TO authenticated
  USING (public.is_form_owner(form_id));

-- =========================================================
-- 7. Storage — form-option-images
-- =========================================================
-- Drop any pre-existing TEMP storage policies for this bucket.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname ILIKE '%form-option-images%' OR policyname ILIKE 'TEMP %option images%'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
  END LOOP;
END $$;

-- Drop legacy named ones explicitly if they exist
DROP POLICY IF EXISTS "TEMP anyone can read option images" ON storage.objects;
DROP POLICY IF EXISTS "TEMP anyone can upload option images" ON storage.objects;
DROP POLICY IF EXISTS "TEMP anyone can update option images" ON storage.objects;
DROP POLICY IF EXISTS "TEMP anyone can delete option images" ON storage.objects;

-- Authenticated users can upload / overwrite / delete option images.
CREATE POLICY "Authenticated users can upload option images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'form-option-images');

CREATE POLICY "Authenticated users can update option images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'form-option-images')
  WITH CHECK (bucket_id = 'form-option-images');

CREATE POLICY "Authenticated users can delete option images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'form-option-images');

-- Public READ is provided by the bucket's `public = true` flag (signed-URL/
-- public path access bypasses object-level SELECT policy). We intentionally
-- DO NOT create a public SELECT policy on storage.objects to avoid enabling
-- bucket-wide listing.
