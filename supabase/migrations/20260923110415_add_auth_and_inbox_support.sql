/*
# Add authentication and inbox support to the platform

## Purpose
This migration transforms the platform from single-tenant to multi-user with authentication.
It adds user_id columns to all tables, stores raw email + body content in email_logs for
the inbox view, and updates all RLS policies from anon-accessible to authenticated-owner-scoped.

## Changes

### 1. `cases` table — add `user_id`
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- Drop all old anon policies, create authenticated owner-scoped policies using auth.uid()

### 2. `findings` table — update policies
- Drop all old anon policies, create authenticated owner-scoped policies that check
  ownership through the parent case

### 3. `ip_geolocation_cache` table — add `user_id`
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- Drop old unique constraint on ip_address, create new unique index on (user_id, ip_address)
- Drop all old anon policies, create authenticated owner-scoped policies

### 4. `email_logs` table — add `user_id`, `raw_email`, `body`, `sender_domain`
- `user_id` (uuid, NOT NULL, DEFAULT auth.uid(), references auth.users ON DELETE CASCADE)
- `raw_email` (text) — full raw email content for inbox display
- `body` (text) — extracted email body for quick reading
- `sender_domain` (text) — extracted sender domain for filtering
- Drop all old anon policies, create authenticated owner-scoped policies

## Security
- All tables now use authenticated-only RLS with auth.uid() ownership checks.
- The app now requires sign-in to access any data.
- user_id columns default to auth.uid() so inserts that omit user_id still work.

## Important Notes
1. The ip_geolocation_cache is now per-user. The geolocate edge function uses the service
   role key which bypasses RLS, so it can still upsert into the cache on behalf of users.
2. The findings table policies check ownership through the parent case using EXISTS subquery.
3. Existing data was cleaned prior to migration since it had no user_id (pre-auth era).
*/

-- 1. cases: add user_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cases' AND column_name = 'user_id') THEN
    ALTER TABLE cases ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop old policies on cases
DROP POLICY IF EXISTS "anon_select_cases" ON cases;
DROP POLICY IF EXISTS "anon_insert_cases" ON cases;
DROP POLICY IF EXISTS "anon_update_cases" ON cases;
DROP POLICY IF EXISTS "anon_delete_cases" ON cases;

-- New authenticated owner-scoped policies
DROP POLICY IF EXISTS "select_own_cases" ON cases;
CREATE POLICY "select_own_cases" ON cases FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_cases" ON cases;
CREATE POLICY "insert_own_cases" ON cases FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_cases" ON cases;
CREATE POLICY "update_own_cases" ON cases FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_cases" ON cases;
CREATE POLICY "delete_own_cases" ON cases FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);

-- 2. findings: update policies to check ownership through parent case
DROP POLICY IF EXISTS "anon_select_findings" ON findings;
DROP POLICY IF EXISTS "anon_insert_findings" ON findings;
DROP POLICY IF EXISTS "anon_update_findings" ON findings;
DROP POLICY IF EXISTS "anon_delete_findings" ON findings;

DROP POLICY IF EXISTS "select_own_findings" ON findings;
CREATE POLICY "select_own_findings" ON findings FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = findings.case_id AND cases.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_findings" ON findings;
CREATE POLICY "insert_own_findings" ON findings FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = findings.case_id AND cases.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_findings" ON findings;
CREATE POLICY "update_own_findings" ON findings FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = findings.case_id AND cases.user_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = findings.case_id AND cases.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "delete_own_findings" ON findings;
CREATE POLICY "delete_own_findings" ON findings FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM cases WHERE cases.id = findings.case_id AND cases.user_id = auth.uid())
  );

-- 3. ip_geolocation_cache: add user_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ip_geolocation_cache' AND column_name = 'user_id') THEN
    ALTER TABLE ip_geolocation_cache ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Drop the unique constraint on ip_address so different users can have their own cache entries
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ip_geolocation_cache_ip_address_key') THEN
    ALTER TABLE ip_geolocation_cache DROP CONSTRAINT ip_geolocation_cache_ip_address_key;
  END IF;
END $$;

-- New unique index including user_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_ip_cache_user_ip ON ip_geolocation_cache(user_id, ip_address);

DROP POLICY IF EXISTS "anon_select_ip_cache" ON ip_geolocation_cache;
DROP POLICY IF EXISTS "anon_insert_ip_cache" ON ip_geolocation_cache;
DROP POLICY IF EXISTS "anon_update_ip_cache" ON ip_geolocation_cache;
DROP POLICY IF EXISTS "anon_delete_ip_cache" ON ip_geolocation_cache;

DROP POLICY IF EXISTS "select_own_ip_cache" ON ip_geolocation_cache;
CREATE POLICY "select_own_ip_cache" ON ip_geolocation_cache FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_ip_cache" ON ip_geolocation_cache;
CREATE POLICY "insert_own_ip_cache" ON ip_geolocation_cache FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_ip_cache" ON ip_geolocation_cache;
CREATE POLICY "update_own_ip_cache" ON ip_geolocation_cache FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_ip_cache" ON ip_geolocation_cache;
CREATE POLICY "delete_own_ip_cache" ON ip_geolocation_cache FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_ip_cache_user_id ON ip_geolocation_cache(user_id);

-- 4. email_logs: add user_id, raw_email, body, sender_domain
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'user_id') THEN
    ALTER TABLE email_logs ADD COLUMN user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'raw_email') THEN
    ALTER TABLE email_logs ADD COLUMN raw_email text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'body') THEN
    ALTER TABLE email_logs ADD COLUMN body text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_logs' AND column_name = 'sender_domain') THEN
    ALTER TABLE email_logs ADD COLUMN sender_domain text DEFAULT '';
  END IF;
END $$;

DROP POLICY IF EXISTS "anon_select_email_logs" ON email_logs;
DROP POLICY IF EXISTS "anon_insert_email_logs" ON email_logs;
DROP POLICY IF EXISTS "anon_update_email_logs" ON email_logs;
DROP POLICY IF EXISTS "anon_delete_email_logs" ON email_logs;

DROP POLICY IF EXISTS "select_own_email_logs" ON email_logs;
CREATE POLICY "select_own_email_logs" ON email_logs FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_email_logs" ON email_logs;
CREATE POLICY "insert_own_email_logs" ON email_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_email_logs" ON email_logs;
CREATE POLICY "update_own_email_logs" ON email_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_email_logs" ON email_logs;
CREATE POLICY "delete_own_email_logs" ON email_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_email_logs_sender_domain ON email_logs(sender_domain);
