-- VANTAGE ARS — seed data
-- Run: wrangler d1 execute vantage-data --remote --file=seed.sql

-- Default branch for the report / API (idempotent — safe to re-run)
INSERT INTO branches (name, status, updated_at)
SELECT 'vantage-ars', 'bootstrapping', datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'vantage-ars');

-- Starter backlog ideas (priority 1 = written first) — title is UNIQUE so INSERT OR IGNORE prevents duplicates
INSERT OR IGNORE INTO backlog (title, target_keyword, article_type, priority) VALUES
  ('SIP trunking in South Africa: what it actually costs', 'sip trunking south africa', 'reference', 1),
  ('How to configure QoS on a Mikrotik router for VoIP', 'mikrotik qos voip', 'how-to', 2),
  ('Vox vs Telkom: comparing SA SIP trunk providers', 'sa sip trunk providers comparison', 'comparison', 3),
  ('Setting up Hikvision CCTV with remote access through Mikrotik', 'hikvision remote access mikrotik', 'how-to', 4),
  ('Panasonic PBX end-of-life: what to replace it with', 'panasonic pbx replacement', 'reference', 5);
