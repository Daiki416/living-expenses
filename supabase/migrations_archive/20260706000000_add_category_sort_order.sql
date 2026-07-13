ALTER TABLE categories ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

WITH ordered AS (
  SELECT id, row_number() OVER (PARTITION BY parent_id ORDER BY created_at) - 1 AS rn
  FROM categories
)
UPDATE categories c SET sort_order = ordered.rn
FROM ordered WHERE c.id = ordered.id;
