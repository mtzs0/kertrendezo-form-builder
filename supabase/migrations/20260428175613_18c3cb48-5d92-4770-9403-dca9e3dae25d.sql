
CREATE TABLE public.form_group_canvas_frames (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id uuid NOT NULL REFERENCES public.forms(id) ON DELETE CASCADE,
  group_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('group','subgroup')),
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  w double precision NOT NULL DEFAULT 360,
  h double precision NOT NULL DEFAULT 220,
  collapsed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, group_id, kind)
);

CREATE INDEX form_group_canvas_frames_form_id_idx ON public.form_group_canvas_frames(form_id);

ALTER TABLE public.form_group_canvas_frames ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TEMP anyone can read group canvas frames"
  ON public.form_group_canvas_frames FOR SELECT USING (true);
CREATE POLICY "TEMP anyone can insert group canvas frames"
  ON public.form_group_canvas_frames FOR INSERT WITH CHECK (true);
CREATE POLICY "TEMP anyone can update group canvas frames"
  ON public.form_group_canvas_frames FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "TEMP anyone can delete group canvas frames"
  ON public.form_group_canvas_frames FOR DELETE USING (true);

CREATE TRIGGER set_updated_at_form_group_canvas_frames
  BEFORE UPDATE ON public.form_group_canvas_frames
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
