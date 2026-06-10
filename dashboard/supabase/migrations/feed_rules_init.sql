-- feed_rules: initial table creation
-- Run in Supabase SQL Editor BEFORE feed_rules_scope.sql

CREATE TABLE IF NOT EXISTS feed_rules (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('filter', 'transform')),
  scope      text NOT NULL DEFAULT 'master',
  channel    text,
  conditions jsonb NOT NULL DEFAULT '[]',
  actions    jsonb NOT NULL DEFAULT '{}',
  priority   integer NOT NULL DEFAULT 10,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- scope constraint (idempotent)
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

CREATE INDEX IF NOT EXISTS idx_feed_rules_scope_channel ON feed_rules(scope, channel, priority);

ALTER TABLE feed_rules ENABLE ROW LEVEL SECURITY;
