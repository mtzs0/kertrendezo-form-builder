ALTER TABLE public.form_groups ADD COLUMN IF NOT EXISTS color text;
ALTER TABLE public.forms ADD COLUMN IF NOT EXISTS canvas_reveal_one_by_one boolean NOT NULL DEFAULT true;