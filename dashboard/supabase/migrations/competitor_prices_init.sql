-- competitor_prices: stores daily scraped prices per competitor product
CREATE TABLE IF NOT EXISTS competitor_prices (
  id                serial PRIMARY KEY,
  date              date NOT NULL DEFAULT CURRENT_DATE,
  competitor        text NOT NULL,
  product_name      text NOT NULL,
  price             numeric(10,2) NOT NULL,
  compare_price     numeric(10,2),
  category          text,
  url               text,
  prev_price        numeric(10,2),
  price_change_pct  numeric(6,2),
  price_changed     boolean NOT NULL DEFAULT false,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cp_date       ON competitor_prices(date);
CREATE INDEX IF NOT EXISTS idx_cp_competitor ON competitor_prices(competitor);
CREATE INDEX IF NOT EXISTS idx_cp_category   ON competitor_prices(category);
