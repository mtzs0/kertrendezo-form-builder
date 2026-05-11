ALTER TABLE public.forms
  ADD COLUMN include_device_type boolean NOT NULL DEFAULT false,
  ADD COLUMN include_browser boolean NOT NULL DEFAULT false,
  ADD COLUMN include_page_url boolean NOT NULL DEFAULT true;