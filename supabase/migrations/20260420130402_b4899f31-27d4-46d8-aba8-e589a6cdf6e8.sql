-- =========================================================
-- TEMPORARY: open up writes so the editor works without auth.
-- Replace with admin-only policies once auth lands.
-- =========================================================

-- ---------- forms ----------
CREATE POLICY "TEMP anyone can read all forms"
ON public.forms FOR SELECT
USING (true);

CREATE POLICY "TEMP anyone can insert forms"
ON public.forms FOR INSERT
WITH CHECK (true);

CREATE POLICY "TEMP anyone can update forms"
ON public.forms FOR UPDATE
USING (true) WITH CHECK (true);

CREATE POLICY "TEMP anyone can delete forms"
ON public.forms FOR DELETE
USING (true);

-- ---------- form_groups ----------
CREATE POLICY "TEMP anyone can read all groups"
ON public.form_groups FOR SELECT USING (true);

CREATE POLICY "TEMP anyone can insert groups"
ON public.form_groups FOR INSERT WITH CHECK (true);

CREATE POLICY "TEMP anyone can update groups"
ON public.form_groups FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "TEMP anyone can delete groups"
ON public.form_groups FOR DELETE USING (true);

-- ---------- form_sub_groups ----------
CREATE POLICY "TEMP anyone can read all sub_groups"
ON public.form_sub_groups FOR SELECT USING (true);

CREATE POLICY "TEMP anyone can insert sub_groups"
ON public.form_sub_groups FOR INSERT WITH CHECK (true);

CREATE POLICY "TEMP anyone can update sub_groups"
ON public.form_sub_groups FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "TEMP anyone can delete sub_groups"
ON public.form_sub_groups FOR DELETE USING (true);

-- ---------- form_fields ----------
CREATE POLICY "TEMP anyone can read all fields"
ON public.form_fields FOR SELECT USING (true);

CREATE POLICY "TEMP anyone can insert fields"
ON public.form_fields FOR INSERT WITH CHECK (true);

CREATE POLICY "TEMP anyone can update fields"
ON public.form_fields FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "TEMP anyone can delete fields"
ON public.form_fields FOR DELETE USING (true);

-- ---------- form_field_options ----------
CREATE POLICY "TEMP anyone can read all field options"
ON public.form_field_options FOR SELECT USING (true);

CREATE POLICY "TEMP anyone can insert field options"
ON public.form_field_options FOR INSERT WITH CHECK (true);

CREATE POLICY "TEMP anyone can update field options"
ON public.form_field_options FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "TEMP anyone can delete field options"
ON public.form_field_options FOR DELETE USING (true);

-- ---------- form_field_conditions ----------
CREATE POLICY "TEMP anyone can read all field conditions"
ON public.form_field_conditions FOR SELECT USING (true);

CREATE POLICY "TEMP anyone can insert field conditions"
ON public.form_field_conditions FOR INSERT WITH CHECK (true);

CREATE POLICY "TEMP anyone can update field conditions"
ON public.form_field_conditions FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "TEMP anyone can delete field conditions"
ON public.form_field_conditions FOR DELETE USING (true);