
-- 1) Helper: does the current user own the form that owns this field?
CREATE OR REPLACE FUNCTION public.user_owns_field(_field_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.form_fields ff
    JOIN public.forms f ON f.id = ff.form_id
    WHERE ff.id = _field_id
      AND f.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.user_owns_field(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_field(uuid) TO authenticated;

-- 2) Tighten storage policies for form-option-images
DROP POLICY IF EXISTS "Authenticated users can delete option images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update option images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload option images" ON storage.objects;

CREATE POLICY "Owners can upload option images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'form-option-images'
  AND public.user_owns_field( ((storage.foldername(name))[1])::uuid )
);

CREATE POLICY "Owners can update option images"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'form-option-images'
  AND public.user_owns_field( ((storage.foldername(name))[1])::uuid )
)
WITH CHECK (
  bucket_id = 'form-option-images'
  AND public.user_owns_field( ((storage.foldername(name))[1])::uuid )
);

CREATE POLICY "Owners can delete option images"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'form-option-images'
  AND public.user_owns_field( ((storage.foldername(name))[1])::uuid )
);

-- 3) Remove hardcoded defaults from forms table
ALTER TABLE public.forms ALTER COLUMN test_webhook_url DROP DEFAULT;
ALTER TABLE public.forms ALTER COLUMN output_url DROP DEFAULT;

-- 4) Tighten EXECUTE on SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.is_form_owner(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_form_owner(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.claim_form(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_form(uuid) TO authenticated;
