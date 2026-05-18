CREATE TABLE IF NOT EXISTS exempt_dates (
  date       text PRIMARY KEY,
  label      text NOT NULL DEFAULT '',
  created_at text NOT NULL
);

ALTER TABLE exempt_dates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "allow_all_exempt_dates" ON exempt_dates FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
