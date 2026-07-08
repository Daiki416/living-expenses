CREATE TABLE category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keyword text NOT NULL UNIQUE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY category_rules_all ON category_rules
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
