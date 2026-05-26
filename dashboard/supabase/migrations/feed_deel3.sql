-- Feed Suite Deel 3 migration
-- Run in Supabase SQL Editor

-- 1. feed_product_content: AI columns
ALTER TABLE feed_product_content
  ADD COLUMN IF NOT EXISTS ai_title           text,
  ADD COLUMN IF NOT EXISTS ai_description     text,
  ADD COLUMN IF NOT EXISTS ai_variants        jsonb,
  ADD COLUMN IF NOT EXISTS selected_variant_id text,
  ADD COLUMN IF NOT EXISTS ai_status          text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS ctr_14d            numeric(5,2),
  ADD COLUMN IF NOT EXISTS impressions_14d    integer,
  ADD COLUMN IF NOT EXISTS approved_at        timestamptz,
  ADD COLUMN IF NOT EXISTS season             text,
  ADD COLUMN IF NOT EXISTS season_start_date  date,
  ADD COLUMN IF NOT EXISTS season_end_date    date,
  ADD COLUMN IF NOT EXISTS channel_optimized_for text,
  ADD COLUMN IF NOT EXISTS description_short  text,
  ADD COLUMN IF NOT EXISTS description_long   text;

-- season constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feed_product_content_season_check'
  ) THEN
    ALTER TABLE feed_product_content
      ADD CONSTRAINT feed_product_content_season_check
      CHECK (season IN ('winter','summer','christmas','spring') OR season IS NULL);
  END IF;
END$$;

-- 2. feed_changelog: context columns
ALTER TABLE feed_changelog
  ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES products(id),
  ADD COLUMN IF NOT EXISTS language   text;

-- 3. feed_enrichment_batches: add columns (table should already exist)
ALTER TABLE feed_enrichment_batches
  ADD COLUMN IF NOT EXISTS language      text,
  ADD COLUMN IF NOT EXISTS field         text    DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS channel       text    DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS season        text,
  ADD COLUMN IF NOT EXISTS status        text    DEFAULT 'running',
  ADD COLUMN IF NOT EXISTS product_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_input  integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tokens_output integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_usd      numeric(10,6) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS errors        jsonb   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS completed_at  timestamptz;

-- 4. feed_versions (create if not exists)
CREATE TABLE IF NOT EXISTS feed_versions (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  market_id      uuid REFERENCES markets(id),
  channel        text NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  product_count  integer DEFAULT 0,
  snapshot       jsonb NOT NULL DEFAULT '{}',
  note           text,
  created_at     timestamptz DEFAULT now()
);

-- Verify
SELECT column_name, data_type
  FROM information_schema.columns
 WHERE table_name = 'feed_product_content'
   AND column_name IN ('ai_variants','description_short','description_long','ctr_14d','season')
 ORDER BY column_name;
