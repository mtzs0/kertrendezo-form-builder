CREATE TABLE public.form_layouts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID NOT NULL,
  name TEXT NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_id, name)
);

ALTER TABLE public.form_layouts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TEMP anyone can read layouts" ON public.form_layouts FOR SELECT USING (true);
CREATE POLICY "TEMP anyone can insert layouts" ON public.form_layouts FOR INSERT WITH CHECK (true);
CREATE POLICY "TEMP anyone can update layouts" ON public.form_layouts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "TEMP anyone can delete layouts" ON public.form_layouts FOR DELETE USING (true);

CREATE TRIGGER update_form_layouts_updated_at
BEFORE UPDATE ON public.form_layouts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_form_layouts_form_id ON public.form_layouts(form_id);