// System Schema
'use strict';

module.exports = `
CREATE TABLE IF NOT EXISTS sync_log (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  synced_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  orders_fetched INTEGER DEFAULT 0,
  orders_new     INTEGER DEFAULT 0,
  status         TEXT,
  error          TEXT
);

CREATE TABLE IF NOT EXISTS bundle_pairs (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sku_a           TEXT NOT NULL,
  sku_b           TEXT NOT NULL,
  samen_gekocht   INTEGER DEFAULT 0,
  cross_sell_freq INTEGER DEFAULT 0,
  gem_dagen_cross INTEGER,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(sku_a, sku_b)
);

CREATE TABLE IF NOT EXISTS season_weights (
  month       INTEGER NOT NULL PRIMARY KEY,
  avg_orders  NUMERIC(15,2) DEFAULT 0,
  avg_revenue NUMERIC(15,2) DEFAULT 0,
  weight      NUMERIC(10,4) DEFAULT 1.0,
  updated_at  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS opex (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  category       TEXT NOT NULL,
  name           TEXT NOT NULL,
  amount         NUMERIC(15,2) NOT NULL,
  frequency      TEXT NOT NULL DEFAULT 'monthly',
  monthly_amount NUMERIC(15,2) NOT NULL,
  btw            NUMERIC(10,2) DEFAULT 0,
  updated_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  id        BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  date      DATE NOT NULL,
  base      TEXT NOT NULL,
  target    TEXT NOT NULL,
  rate      NUMERIC(15,6) NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(date, base, target)
);
`;
