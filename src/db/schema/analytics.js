// Analytics Schemas
'use strict';

module.exports = `
CREATE TABLE IF NOT EXISTS visitor_sessions (
  id                       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id               TEXT NOT NULL,
  order_id                 TEXT REFERENCES orders(id) ON DELETE SET NULL,
  session_count            INTEGER DEFAULT 0,
  first_touch_date         TIMESTAMPTZ,
  last_touch_date          TIMESTAMPTZ,
  days_to_convert          NUMERIC(10,2),
  sessions_before_purchase INTEGER,
  touch_path               TEXT,
  had_rage_click           BOOLEAN DEFAULT FALSE,
  had_dead_click           BOOLEAN DEFAULT FALSE,
  scroll_depth             NUMERIC(10,2) DEFAULT 0.00,
  clarity_session_id       TEXT,
  created_at               TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ga4_sessions (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date                 DATE NOT NULL,
  channel              TEXT NOT NULL,
  sessions             INTEGER DEFAULT 0,
  users                INTEGER DEFAULT 0,
  new_users            INTEGER DEFAULT 0,
  bounce_rate          NUMERIC(10,4) DEFAULT 0.0000,
  avg_session_duration NUMERIC(15,2) DEFAULT 0.00,
  UNIQUE(date, channel)
);

CREATE TABLE IF NOT EXISTS ga4_funnel (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date     DATE NOT NULL,
  step     TEXT NOT NULL,
  sessions INTEGER DEFAULT 0,
  users    INTEGER DEFAULT 0,
  UNIQUE(date, step)
);

CREATE TABLE IF NOT EXISTS clarity_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date       DATE NOT NULL,
  page       TEXT NOT NULL,
  event_type TEXT NOT NULL,
  count      INTEGER DEFAULT 0,
  channel    TEXT,
  UNIQUE(date, page, event_type)
);

CREATE TABLE IF NOT EXISTS clarity_insights (
  id                   BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  fetched_at           TIMESTAMPTZ NOT NULL,
  num_of_days          INTEGER NOT NULL,
  metric               TEXT NOT NULL,
  dimension_key        TEXT NOT NULL,
  dimension_value      TEXT NOT NULL,
  sessions             INTEGER DEFAULT 0,
  subtotal             NUMERIC(15,2) DEFAULT 0.00,
  pages_views          INTEGER DEFAULT 0,
  sessions_with_pct    NUMERIC(10,4) DEFAULT 0.00,
  sessions_without_pct NUMERIC(10,4) DEFAULT 0.00,
  UNIQUE(fetched_at, metric, dimension_key, dimension_value)
);

CREATE INDEX IF NOT EXISTS idx_visitor_sessions_visitor_id ON visitor_sessions(visitor_id);
`;
