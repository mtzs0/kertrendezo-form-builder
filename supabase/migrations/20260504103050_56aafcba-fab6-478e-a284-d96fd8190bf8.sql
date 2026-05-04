ALTER TABLE public.form_groups
  ADD COLUMN IF NOT EXISTS condition_combinator text NOT NULL DEFAULT 'and',
  ADD COLUMN IF NOT EXISTS condition_rules jsonb NOT NULL DEFAULT '[]'::jsonb;