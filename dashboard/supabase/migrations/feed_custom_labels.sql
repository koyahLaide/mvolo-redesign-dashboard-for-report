-- Feed Custom Labels — Google Shopping Supplemental Feed
-- Veilig om meerdere keren te draaien

CREATE TABLE IF NOT EXISTS feed_custom_labels (
  id                uuid    DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id        uuid    NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  -- label_0: performance tier
  custom_label_0    text,   -- 'Hero' | 'Sidekick' | 'Villain' | 'Zombie'
  -- label_1: prijsklasse
  custom_label_1    text,   -- 'Budget' | 'Mid' | 'Premium' | 'Ultra'
  -- label_2: seizoen
  custom_label_2    text,   -- 'Winterfavoriet' | 'Zomerhit' | 'Altijd groen'
  -- label_3: marge
  custom_label_3    text,   -- 'Hoge marge >60%' | 'Normale marge' | 'Lage marge <30%'
  -- label_4: strategie
  custom_label_4    text,   -- 'Push' | 'Maintain' | 'Phase out'
  -- override flags: true = handmatig gezet, wordt niet overschreven door auto-calc
  label_0_override  boolean DEFAULT false,
  label_1_override  boolean DEFAULT false,
  label_2_override  boolean DEFAULT false,
  label_3_override  boolean DEFAULT false,
  label_4_override  boolean DEFAULT false,
  updated_at        timestamptz DEFAULT now(),
  UNIQUE(product_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_labels_product ON feed_custom_labels(product_id);

-- Verify
SELECT column_name, data_type, column_default
  FROM information_schema.columns
 WHERE table_name = 'feed_custom_labels'
 ORDER BY ordinal_position;
