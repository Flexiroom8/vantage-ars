-- VANTAGE ARS — D1 schema
-- Run: wrangler d1 execute vantage-data --remote --file=schema.sql

CREATE TABLE IF NOT EXISTS articles (
  slug         TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  description  TEXT,
  body         TEXT,
  status       TEXT DEFAULT 'draft',
  published_at TEXT,
  updated_at   TEXT
);

CREATE TABLE IF NOT EXISTS backlog (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  title         TEXT NOT NULL UNIQUE,
  target_keyword TEXT,
  article_type   TEXT DEFAULT 'reference',
  priority      INTEGER DEFAULT 0,
  status        TEXT DEFAULT 'idea'
);

CREATE TABLE IF NOT EXISTS leads (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT,
  email      TEXT,
  message    TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS decision_queue (
  id         TEXT PRIMARY KEY,
  type       TEXT,
  priority   TEXT DEFAULT 'medium',
  title      TEXT,
  body       TEXT,
  status     TEXT DEFAULT 'pending',
  created_at TEXT,
  ref        TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  agent     TEXT,
  action    TEXT,
  timestamp TEXT
);

CREATE TABLE IF NOT EXISTS corrections (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT,
  wrong      TEXT,
  right      TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS branches (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  name            TEXT,
  status          TEXT DEFAULT 'bootstrapping',
  quota_per_week  INTEGER DEFAULT 0,
  revenue_week    REAL DEFAULT 0,
  revenue_month   REAL DEFAULT 0,
  revenue_alltime REAL DEFAULT 0,
  traffic         INTEGER DEFAULT 0,
  score           REAL DEFAULT 0,
  notes           TEXT,
  updated_at      TEXT
);
