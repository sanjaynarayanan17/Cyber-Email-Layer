/*
# Create cases, findings, and IP geolocation cache tables

## Purpose
This migration creates the persistence layer for the AI-Powered Email Threat
Detection, GeoLocation and Forensic Intelligence Platform. It stores saved
forensic investigations (cases), the individual threat findings attached to
each case, and a cache of IP geolocation lookups so repeat analyses are fast
and don't re-hit external services.

## New Tables

### 1. `cases`
Stores a saved email forensic investigation.
- `id` (uuid, primary key)
- `title` (text, not null) — user-given name for the investigation
- `notes` (text) — analyst notes
- `threat_score` (integer, 0-100) — overall computed threat score
- `threat_level` (text) — 'clean' | 'suspicious' | 'malicious'
- `sender_email` (text) — extracted sender address
- `sender_name` (text) — extracted display name
- `subject` (text) — email subject
- `recipient_email` (text) — extracted recipient
- `content_hash` (text) — SHA-256 hash of raw email for tamper-evidence
- `raw_email` (text, not null) — the full raw email content
- `parsed_headers` (jsonb) — structured extracted headers
- `received_hops` (jsonb) — array of received-by hop entries
- `extracted_links` (jsonb) — array of links found in the email
- `extracted_ips` (jsonb) — array of IP addresses found in the email
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### 2. `findings`
Individual threat findings attached to a case (one case -> many findings).
- `id` (uuid, primary key)
- `case_id` (uuid, foreign key -> cases.id ON DELETE CASCADE)
- `category` (text) — e.g. 'authentication', 'spoofing', 'links', 'content'
- `severity` (text) — 'info' | 'warning' | 'critical'
- `title` (text) — short title of the finding
- `description` (text) — plain-English explanation
- `weight` (integer) — score weight contributed
- `created_at` (timestamptz, default now())

### 3. `ip_geolocation_cache`
Caches IP geolocation lookups so repeat analyses are fast and don't re-hit
external services.
- `id` (uuid, primary key)
- `ip_address` (text, unique, not null)
- `country` (text)
- `country_code` (text)
- `region` (text)
- `city` (text)
- `latitude` (double precision)
- `longitude` (double precision)
- `isp` (text)
- `org` (text)
- `as_number` (text)
- `is_hosting_provider` (boolean) — whether the network is a hosting/proxy/VPN provider
- `is_suspicious` (boolean) — whether the network is commonly associated with abuse
- `raw` (jsonb) — raw lookup response for forensic completeness
- `looked_up_at` (timestamptz, default now())

## Security
- RLS enabled on all three tables.
- This is a single-tenant app with NO sign-in screen, so policies allow
  `anon, authenticated` CRUD on all tables (the data is intentionally shared
  within the workspace). This is documented here intentionally.

## Important Notes
1. No `user_id` columns or `auth.users` foreign keys — single-tenant app.
2. `cases.updated_at` is maintained by the application on updates.
3. `findings` cascade-delete with their parent case.
4. `ip_geolocation_cache.ip_address` has a unique constraint so upserts work.
*/

CREATE TABLE IF NOT EXISTS cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  notes text DEFAULT '',
  threat_score integer NOT NULL DEFAULT 0,
  threat_level text NOT NULL DEFAULT 'clean',
  sender_email text DEFAULT '',
  sender_name text DEFAULT '',
  subject text DEFAULT '',
  recipient_email text DEFAULT '',
  content_hash text DEFAULT '',
  raw_email text NOT NULL,
  parsed_headers jsonb DEFAULT '{}'::jsonb,
  received_hops jsonb DEFAULT '[]'::jsonb,
  extracted_links jsonb DEFAULT '[]'::jsonb,
  extracted_ips jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_cases" ON cases;
CREATE POLICY "anon_select_cases" ON cases FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_cases" ON cases;
CREATE POLICY "anon_insert_cases" ON cases FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_cases" ON cases;
CREATE POLICY "anon_update_cases" ON cases FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_cases" ON cases;
CREATE POLICY "anon_delete_cases" ON cases FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  weight integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_findings" ON findings;
CREATE POLICY "anon_select_findings" ON findings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_findings" ON findings;
CREATE POLICY "anon_insert_findings" ON findings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_findings" ON findings;
CREATE POLICY "anon_update_findings" ON findings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_findings" ON findings;
CREATE POLICY "anon_delete_findings" ON findings FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS ip_geolocation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text UNIQUE NOT NULL,
  country text DEFAULT '',
  country_code text DEFAULT '',
  region text DEFAULT '',
  city text DEFAULT '',
  latitude double precision,
  longitude double precision,
  isp text DEFAULT '',
  org text DEFAULT '',
  as_number text DEFAULT '',
  is_hosting_provider boolean DEFAULT false,
  is_suspicious boolean DEFAULT false,
  raw jsonb DEFAULT '{}'::jsonb,
  looked_up_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE ip_geolocation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_ip_cache" ON ip_geolocation_cache;
CREATE POLICY "anon_select_ip_cache" ON ip_geolocation_cache FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_ip_cache" ON ip_geolocation_cache;
CREATE POLICY "anon_insert_ip_cache" ON ip_geolocation_cache FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_ip_cache" ON ip_geolocation_cache;
CREATE POLICY "anon_update_ip_cache" ON ip_geolocation_cache FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_ip_cache" ON ip_geolocation_cache;
CREATE POLICY "anon_delete_ip_cache" ON ip_geolocation_cache FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_findings_case_id ON findings(case_id);
CREATE INDEX IF NOT EXISTS idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_threat_level ON cases(threat_level);
