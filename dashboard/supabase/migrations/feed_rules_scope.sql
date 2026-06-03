-- Feed Rules: scope + channel upgrade
-- Run in Supabase SQL Editor

-- 1. Add scope and channel columns
ALTER TABLE feed_rules
  ADD COLUMN IF NOT EXISTS scope   text NOT NULL DEFAULT 'master',
  ADD COLUMN IF NOT EXISTS channel text;

-- 2. Existing 4 rules → master scope
UPDATE feed_rules SET scope = 'master' WHERE scope = 'master' OR scope IS NULL;

-- 3. Scope constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'feed_rules_scope_check'
  ) THEN
    ALTER TABLE feed_rules
      ADD CONSTRAINT feed_rules_scope_check
      CHECK (scope IN ('master', 'partner'));
  END IF;
END$$;

-- 4. Index for fast per-scope/channel queries
CREATE INDEX IF NOT EXISTS idx_feed_rules_scope_channel ON feed_rules(scope, channel, priority);

-- Verify
SELECT id, name, scope, channel, priority, active FROM feed_rules ORDER BY priority;
