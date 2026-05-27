-- Migration: allow multiple feeds per market+channel combo
-- Run this in Supabase SQL Editor

-- Drop the old unique constraint on (market_id, channel)
ALTER TABLE feed_market_configs
  DROP CONSTRAINT IF EXISTS feed_market_configs_market_id_channel_key;

-- Add new composite unique on (market_id, channel, feed_name)
ALTER TABLE feed_market_configs
  ADD CONSTRAINT feed_market_configs_market_channel_name_key
    UNIQUE (market_id, channel, feed_name);
