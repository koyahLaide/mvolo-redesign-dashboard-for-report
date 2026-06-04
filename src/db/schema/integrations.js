// Integration Schemas
'use strict';

module.exports = `
CREATE TABLE IF NOT EXISTS klaviyo_campaigns (
  id        TEXT PRIMARY KEY,
  name      TEXT,
  status    TEXT,
  sent_at   TIMESTAMPTZ,
  subject   TEXT,
  synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS klaviyo_metrics (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_id   TEXT NOT NULL,
  date        DATE NOT NULL,
  count       INTEGER DEFAULT 0,
  revenue     NUMERIC(15,2) DEFAULT 0.00,
  synced_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(metric_id, date)
);

CREATE TABLE IF NOT EXISTS klaviyo_flows (
  id           TEXT PRIMARY KEY,
  name         TEXT,
  status       TEXT,
  created      TIMESTAMPTZ,
  trigger_type TEXT,
  synced_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competitor_prices (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  competitor       TEXT NOT NULL,
  product_name     TEXT NOT NULL,
  price            NUMERIC(15,2) NOT NULL,
  compare_price    NUMERIC(15,2),
  category         TEXT,
  url              TEXT,
  date             DATE NOT NULL,
  prev_price       NUMERIC(15,2),
  price_change_pct NUMERIC(10,4),
  price_changed    BOOLEAN DEFAULT FALSE,
  synced_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(competitor, product_name, date)
);

CREATE INDEX IF NOT EXISTS idx_klaviyo_metrics_date ON klaviyo_metrics(date);
CREATE INDEX IF NOT EXISTS idx_comp_date ON competitor_prices(date);
`;
