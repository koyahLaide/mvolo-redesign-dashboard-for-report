-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Feed Suite Deel 4 - voeg ontbrekende kolommen en tabellen toe
-- Veilig om meerdere keren te draaien (IF NOT EXISTS overal)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. feed_ab_tests ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_ab_tests (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name            text        NOT NULL,
  field           text        NOT NULL,
  language        text        DEFAULT 'nl',
  channel         text,
  market_id       uuid        REFERENCES markets(id),
  status          text        DEFAULT 'draft',
  started_at      timestamptz,
  ended_at        timestamptz,
  winner          text,
  confidence      numeric(5,4),
  variant_a_label text        DEFAULT 'Variant A (huidig)',
  variant_b_label text        DEFAULT 'Variant B (nieuw)',
  created_at      timestamptz DEFAULT now()
);

ALTER TABLE feed_ab_tests
  ADD COLUMN IF NOT EXISTS language        text        DEFAULT 'nl',
  ADD COLUMN IF NOT EXISTS channel         text,
  ADD COLUMN IF NOT EXISTS market_id       uuid        REFERENCES markets(id),
  ADD COLUMN IF NOT EXISTS started_at      timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at        timestamptz,
  ADD COLUMN IF NOT EXISTS winner          text,
  ADD COLUMN IF NOT EXISTS confidence      numeric(5,4),
  ADD COLUMN IF NOT EXISTS variant_a_label text        DEFAULT 'Variant A (huidig)',
  ADD COLUMN IF NOT EXISTS variant_b_label text        DEFAULT 'Variant B (nieuw)';

-- ── 2. feed_ab_assignments ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_ab_assignments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id    uuid REFERENCES feed_ab_tests(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id),
  ab_group   text NOT NULL,
  value_a    text,
  value_b    text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE feed_ab_assignments
  ADD COLUMN IF NOT EXISTS value_a text,
  ADD COLUMN IF NOT EXISTS value_b text;

-- ── 3. feed_ab_daily_metrics ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_ab_daily_metrics (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id     uuid    REFERENCES feed_ab_tests(id) ON DELETE CASCADE,
  ab_group    text    NOT NULL,
  date        date    NOT NULL,
  impressions integer DEFAULT 0,
  clicks      integer DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue     numeric(12,2) DEFAULT 0,
  UNIQUE(test_id, ab_group, date)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'feed_ab_daily_metrics_test_id_ab_group_date_key'
  ) THEN
    ALTER TABLE feed_ab_daily_metrics
      ADD CONSTRAINT feed_ab_daily_metrics_test_id_ab_group_date_key
      UNIQUE (test_id, ab_group, date);
  END IF;
END$$;

-- ── 4. feed_alerts ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_alerts (
  id           uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  type         text    NOT NULL,
  severity     text    DEFAULT 'info',
  message      text    NOT NULL,
  product_id   uuid    REFERENCES products(id),
  channel      text,
  market_id    uuid    REFERENCES markets(id),
  acknowledged boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE feed_alerts
  ADD COLUMN IF NOT EXISTS market_id    uuid    REFERENCES markets(id),
  ADD COLUMN IF NOT EXISTS acknowledged boolean DEFAULT false;

-- ── 5. image_bank ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS image_bank (
  id          uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id  uuid    REFERENCES products(id),
  filename    text,
  storage_url text,
  image_type  text    DEFAULT 'main',
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- ── 6. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ab_assignments_test    ON feed_ab_assignments(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_assignments_product ON feed_ab_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_ab_daily_test_group    ON feed_ab_daily_metrics(test_id, ab_group);
CREATE INDEX IF NOT EXISTS idx_alerts_ack             ON feed_alerts(acknowledged, created_at DESC);

-- ── Verify ───────────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name IN ('feed_ab_tests','feed_ab_assignments','feed_ab_daily_metrics','feed_alerts','image_bank')
 ORDER BY table_name, ordinal_position;
