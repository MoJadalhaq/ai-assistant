-- Daily message counters that keep the public demo inside the Gemini free-tier quota.
-- One row per day and counter. Old days are wiped by the daily reset (Phase 4).

CREATE TABLE usage_counters (
  day   TEXT NOT NULL,      -- Riyadh date, 'YYYY-MM-DD'
  key   TEXT NOT NULL,      -- 'visitor:<ip>' or 'global'
  count INTEGER NOT NULL,
  PRIMARY KEY (day, key)
);
