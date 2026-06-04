-- Feed Suite Deel 4 migration
-- Run in Supabase SQL Editor

-- 1. feed_ab_tests: add variant label columns
ALTER TABLE feed_ab_tests
  ADD COLUMN IF NOT EXISTS variant_a_label text DEFAULT 'Variant A (huidig)',
  ADD COLUMN IF NOT EXISTS variant_b_label text DEFAULT 'Variant B (nieuw)';

-- 2. feed_ab_assignments: add per-product value columns
ALTER TABLE feed_ab_assignments
  ADD COLUMN IF NOT EXISTS value_a text,
  ADD COLUMN IF NOT EXISTS value_b text;

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_ab_assignments_test    ON feed_ab_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_product ON feed_ab_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_ab_daily_test_group    ON feed_ab_daily_metrics(test_id, ab_group);
CREATE INDEX IF NOT EXISTS idx_alerts_ack             ON feed_alerts(acknowledged, created_at DESC);

-- 4. Verify
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_name IN ('feed_ab_tests','feed_ab_assignments')
   AND column_name IN ('variant_a_label','variant_b_label','value_a','value_b')
 ORDER BY table_name, column_name;
