// Marketing Schemas
'use strict';

module.exports = `
CREATE TABLE IF NOT EXISTS ad_spend (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date          DATE NOT NULL,
  channel       TEXT NOT NULL,
  campaign_name TEXT,
  adset_name    TEXT,
  ad_name       TEXT,
  spend         NUMERIC(15,2) DEFAULT 0.00,
  impressions   INTEGER DEFAULT 0,
  clicks        INTEGER DEFAULT 0,
  purchases     INTEGER DEFAULT 0,
  currency      TEXT DEFAULT 'EUR',
  UNIQUE(date, channel, campaign_name, adset_name, ad_name)
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date           DATE NOT NULL,
  channel        TEXT NOT NULL,
  spend          NUMERIC(15,2) DEFAULT 0.00,
  revenue        NUMERIC(15,2) DEFAULT 0.00,
  profit         NUMERIC(15,2) DEFAULT 0.00,
  orders         INTEGER DEFAULT 0,
  new_customers  INTEGER DEFAULT 0,
  roas           NUMERIC(10,4) DEFAULT 0.0000,
  poas           NUMERIC(10,4) DEFAULT 0.0000,
  cac            NUMERIC(15,2) DEFAULT 0.00,
  UNIQUE(date, channel)
);

CREATE TABLE IF NOT EXISTS ga4_journeys (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date             DATE NOT NULL,
  first_channel    TEXT NOT NULL,
  session_channel  TEXT NOT NULL,
  sessions         INTEGER DEFAULT 0,
  users            INTEGER DEFAULT 0,
  UNIQUE(date, first_channel, session_channel)
);

CREATE TABLE IF NOT EXISTS journey_meta (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date          DATE NOT NULL,
  channel       TEXT NOT NULL,
  campaign_name TEXT,
  purchases_1d  INTEGER DEFAULT 0,
  purchases_7d  INTEGER DEFAULT 0,
  purchases_28d INTEGER DEFAULT 0,
  revenue_1d    NUMERIC(15,2) DEFAULT 0.00,
  revenue_7d    NUMERIC(15,2) DEFAULT 0.00,
  revenue_28d   NUMERIC(15,2) DEFAULT 0.00,
  UNIQUE(date, channel, campaign_name)
);

CREATE INDEX IF NOT EXISTS idx_ad_spend_date_channel ON ad_spend(date, channel);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_date_channel ON daily_metrics(date, channel);
`;
