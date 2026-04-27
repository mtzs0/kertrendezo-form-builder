-- Per-field positions on the Visual Conditions Canvas (demo).
-- One row per field. We use field_id as the primary key so upserts are simple
-- and there is at most one position per field.
CREATE TABLE public.form_field_canvas_positions (
  field_id UUID NOT NULL PRIMARY KEY REFERENCES public.form_fields(id) ON DELETE CASCADE,
  x DOUBLE PRECISION NOT NULL DEFAULT 0,
  y DOUBLE PRECISION NOT NULL DEFAULT 0,
  order_index INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Helpful index when loading all positions for a form via a join.
CREATE INDEX idx_form_field_canvas_positions_field_id
  ON public.form_field_canvas_positions(field_id);

-- Keep updated_at fresh.
CREATE TRIGGER set_form_field_canvas_positions_updated_at
BEFORE UPDATE ON public.form_field_canvas_positions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS and mirror the temporary "anyone can do anything" policies used
-- by the rest of the form tables in this project.
ALTER TABLE public.form_field_canvas_positions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "TEMP anyone can read canvas positions"
ON public.form_field_canvas_positions
FOR SELECT
USING (true);

CREATE POLICY "TEMP anyone can insert canvas positions"
ON public.form_field_canvas_positions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "TEMP anyone can update canvas positions"
ON public.form_field_canvas_positions
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "TEMP anyone can delete canvas positions"
ON public.form_field_canvas_positions
FOR DELETE
USING (true);