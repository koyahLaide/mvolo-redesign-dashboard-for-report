-- A/B Test Hypothesis System + Learnings Knowledge Base
-- Veilig om meerdere keren te draaien

-- ── 1. feed_ab_tests uitbreiden ───────────────────────────────────────────────
ALTER TABLE feed_ab_tests
  ADD COLUMN IF NOT EXISTS hypothesis          text,
  ADD COLUMN IF NOT EXISTS hypothesis_category text,  -- 'branding'|'pricing'|'claims'|'keywords'|'images'|'seasonal'|'description_length'
  ADD COLUMN IF NOT EXISTS hypothesis_tags     text[],
  ADD COLUMN IF NOT EXISTS conclusion          text,
  ADD COLUMN IF NOT EXISTS confidence_level    text,  -- 'high'|'medium'|'low'
  ADD COLUMN IF NOT EXISTS learning            text;  -- kernles in één zin

-- ── 2. feed_learnings — kennisbank ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_learnings (
  id                    uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id               uuid    REFERENCES feed_ab_tests(id) ON DELETE SET NULL,
  category              text    NOT NULL,  -- zelfde categorieën als hypothesis_category
  learning              text    NOT NULL,
  impact_pct            numeric(6,2),      -- gemeten impact in %
  confidence            text    DEFAULT 'medium',  -- 'high'|'medium'|'low'
  applies_to_channels   text[]  DEFAULT '{}',
  applies_to_markets    text[]  DEFAULT '{}',
  applies_to_categories text[]  DEFAULT '{}',
  is_active             boolean DEFAULT true,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learnings_category   ON feed_learnings(category);
CREATE INDEX IF NOT EXISTS idx_learnings_active     ON feed_learnings(is_active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_learnings_test       ON feed_learnings(test_id);

-- ── Verify ────────────────────────────────────────────────────────────────────
SELECT table_name, column_name, data_type
  FROM information_schema.columns
 WHERE table_name IN ('feed_ab_tests','feed_learnings')
   AND column_name IN ('hypothesis','hypothesis_category','hypothesis_tags','conclusion','confidence_level','learning','is_active','impact_pct')
 ORDER BY table_name, column_name;
