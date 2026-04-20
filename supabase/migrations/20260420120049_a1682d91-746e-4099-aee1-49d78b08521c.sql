INSERT INTO public.forms (slug, title, description, schema, published)
VALUES (
  'default',
  'Kertrendezés foglalás',
  'Töltsd ki az alábbi űrlapot, és hamarosan visszajelzünk az időpontról.',
  '{"groups":[],"subGroups":[],"fields":[]}'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;