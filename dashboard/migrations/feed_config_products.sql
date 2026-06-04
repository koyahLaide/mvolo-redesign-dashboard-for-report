-- Migration: feed_config_products
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS feed_config_products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_config_id  UUID NOT NULL REFERENCES feed_market_configs(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (feed_config_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_config_products_config ON feed_config_products(feed_config_id);
CREATE INDEX IF NOT EXISTS idx_feed_config_products_product ON feed_config_products(product_id);

-- Enable RLS (service role key bypasses this anyway, but good practice)
ALTER TABLE feed_config_products ENABLE ROW LEVEL SECURITY;
