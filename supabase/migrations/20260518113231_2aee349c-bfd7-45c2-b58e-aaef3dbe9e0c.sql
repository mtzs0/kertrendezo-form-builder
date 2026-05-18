-- Editor tables: anon + authenticated get full CRUD (matches existing TEMP RLS policies).
-- When auth is added later, tighten the RLS policies — not these grants.
grant select, insert, update, delete on public.forms to anon, authenticated;
grant select, insert, update, delete on public.form_fields to anon, authenticated;
grant select, insert, update, delete on public.form_field_options to anon, authenticated;
grant select, insert, update, delete on public.form_field_conditions to anon, authenticated;
grant select, insert, update, delete on public.form_field_canvas_positions to anon, authenticated;
grant select, insert, update, delete on public.form_groups to anon, authenticated;
grant select, insert, update, delete on public.form_group_canvas_frames to anon, authenticated;
grant select, insert, update, delete on public.form_layouts to anon, authenticated;

-- Submissions: only INSERT for anon/authenticated (matches existing RLS — reads stay blocked).
grant insert on public.form_submissions to anon, authenticated;

-- service_role (used by edge functions) gets everything.
grant all on public.forms to service_role;
grant all on public.form_fields to service_role;
grant all on public.form_field_options to service_role;
grant all on public.form_field_conditions to service_role;
grant all on public.form_field_canvas_positions to service_role;
grant all on public.form_groups to service_role;
grant all on public.form_group_canvas_frames to service_role;
grant all on public.form_layouts to service_role;
grant all on public.form_submissions to service_role;