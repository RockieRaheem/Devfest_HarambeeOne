-- Run once as the Cloud SQL database administrator before `alembic upgrade head`.
-- NOLOGIN roles and this empty auth surface let historical Supabase-era revisions
-- replay without granting a browser or API direct database access.
DO $$ BEGIN
  CREATE ROLE anon NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE SCHEMA IF NOT EXISTS auth;
REVOKE ALL ON SCHEMA auth FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS auth.users (id uuid PRIMARY KEY, email text);
REVOKE ALL ON TABLE auth.users FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE SET search_path = ''
AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
REVOKE ALL ON FUNCTION auth.uid() FROM PUBLIC, anon, authenticated;
