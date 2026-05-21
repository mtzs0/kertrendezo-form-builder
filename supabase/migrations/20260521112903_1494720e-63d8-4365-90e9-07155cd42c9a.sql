
REVOKE EXECUTE ON FUNCTION public.claim_form(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_form(uuid) TO authenticated;
