/*
# Create email_logs table for real-time email logging

## Purpose
Stores a log entry for every email analyzed through the platform. This powers the
real-time Live Monitor view, which uses Supabase realtime subscriptions to show
newly analyzed emails as they come in — without needing a page refresh.

## New Tables

### `email_logs`
A lightweight log of every email analysis performed.
- `id` (uuid, primary key)
- `case_id` (uuid, nullable, foreign key -> cases.id ON DELETE SET NULL) — links to a saved case if one was created
- `sender_email` (text) — extracted sender address
- `sender_name` (text) — extracted display name
- `subject` (text) — email subject
- `recipient_email` (text) — extracted recipient
- `threat_score` (integer, 0-100) — overall computed threat score
- `threat_level` (text) — 'clean' | 'suspicious' | 'malicious'
- `spf` (text) — SPF authentication result
- `dkim` (text) — DKIM authentication result
- `dmarc` (text) — DMARC authentication result
- `findings_count` (integer) — number of threat findings
- `critical_count` (integer) — number of critical-severity findings
- `warning_count` (integer) — number of warning-severity findings
- `extracted_ips` (jsonb) — array of IPs found in the email
- `extracted_links` (jsonb) — array of links found in the email
- `content_hash` (text) — SHA-256 hash of the raw email
- `created_at` (timestamptz, default now())

## Security
- RLS enabled on `email_logs`.
- Single-tenant app with NO sign-in screen, so policies allow
  `anon, authenticated` CRUD (data is intentionally shared within the workspace).

## Important Notes
1. `case_id` is nullable — logs are created at analysis time, before the user
   optionally saves a case. If a case is later deleted, the log entry's case_id
   is set to NULL (ON DELETE SET NULL) rather than cascading the delete.
2. Realtime is enabled on this table via the Supabase publication so the Live
   Monitor view receives instant INSERT events.
3. No `user_id` — single-tenant app.
*/

CREATE TABLE IF NOT EXISTS email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid REFERENCES cases(id) ON DELETE SET NULL,
  sender_email text DEFAULT '',
  sender_name text DEFAULT '',
  subject text DEFAULT '',
  recipient_email text DEFAULT '',
  threat_score integer NOT NULL DEFAULT 0,
  threat_level text NOT NULL DEFAULT 'clean',
  spf text DEFAULT '',
  dkim text DEFAULT '',
  dmarc text DEFAULT '',
  findings_count integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  extracted_ips jsonb DEFAULT '[]'::jsonb,
  extracted_links jsonb DEFAULT '[]'::jsonb,
  content_hash text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_email_logs" ON email_logs;
CREATE POLICY "anon_select_email_logs" ON email_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_email_logs" ON email_logs;
CREATE POLICY "anon_insert_email_logs" ON email_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_email_logs" ON email_logs;
CREATE POLICY "anon_update_email_logs" ON email_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_email_logs" ON email_logs;
CREATE POLICY "anon_delete_email_logs" ON email_logs FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_email_logs_created_at ON email_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_logs_threat_level ON email_logs(threat_level);
CREATE INDEX IF NOT EXISTS idx_email_logs_case_id ON email_logs(case_id);

-- Enable realtime on the email_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE email_logs;
