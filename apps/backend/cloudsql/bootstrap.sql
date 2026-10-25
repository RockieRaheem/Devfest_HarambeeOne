-- Run once as the Cloud SQL database administrator before `alembic upgrade head`.
-- This empty, locked auth surface lets historical Supabase-era revisions replay.
-- The schema runner rewrites legacy auth references to these compatibility objects.
CREATE TABLE public.firebase_legacy_auth_users (id uuid PRIMARY KEY, email text);
REVOKE ALL ON TABLE public.firebase_legacy_auth_users FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.firebase_legacy_uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
REVOKE ALL ON FUNCTION public.firebase_legacy_uid() FROM PUBLIC;
