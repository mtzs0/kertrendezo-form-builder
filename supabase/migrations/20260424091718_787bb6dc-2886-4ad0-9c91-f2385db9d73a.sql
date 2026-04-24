ALTER TABLE public.forms
ADD COLUMN active_layout_id UUID NULL REFERENCES public.form_layouts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_forms_active_layout_id ON public.forms(active_layout_id);