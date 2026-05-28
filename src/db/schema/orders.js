// Orders Schemas
'use strict';

module.exports = `
-- Orders: Consolidated with all attribution and customer fields
CREATE TABLE IF NOT EXISTS orders (
  id               TEXT PRIMARY KEY,
  order_number     TEXT,
  created_at       TIMESTAMPTZ NOT NULL,
  total_price      NUMERIC(15,2) DEFAULT 0.00,
  profit           NUMERIC(15,2) DEFAULT 0.00,
  profit_margin    NUMERIC(10,4) DEFAULT 0.0000,
  cost_of_goods    NUMERIC(15,2) DEFAULT 0.00,
  financial_status TEXT,
  channel          TEXT,
  medium           TEXT,
  utm_source       TEXT,
  utm_campaign     TEXT,
  utm_content      TEXT,
  utm_term         TEXT,
  landing_site     TEXT,
  referring_site   TEXT,
  source_name      TEXT,
  first_touch      TEXT,
  last_touch       TEXT,
  touch_path       TEXT,
  customer_email   TEXT,
  customer_id      TEXT,
  is_new_customer  BOOLEAN DEFAULT FALSE,
  days_to_convert  NUMERIC(10,2),
  sessions_before_purchase INTEGER DEFAULT 0,
  marketplace      TEXT DEFAULT 'shopify',
  direct_subchannel TEXT,
  shipping_city    TEXT,
  shipping_country TEXT,
  device_type      TEXT,
  browser_language TEXT,
  synced_at        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id    TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku         TEXT DEFAULT '',
  title       TEXT,
  quantity    INTEGER DEFAULT 1,
  price       NUMERIC(15,2) DEFAULT 0.00,
  order_date  TIMESTAMPTZ,
  marketplace TEXT DEFAULT 'shopify',
  channel     TEXT DEFAULT '',
  UNIQUE(order_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
`;
