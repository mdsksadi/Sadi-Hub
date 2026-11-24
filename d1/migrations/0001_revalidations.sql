-- Table expected by @opennextjs/cloudflare's D1 tag cache override.
CREATE TABLE IF NOT EXISTS revalidations (
  tag TEXT PRIMARY KEY,
  revalidatedAt INTEGER NOT NULL,
  stale INTEGER NOT NULL,
  expire INTEGER
);

-- The adapter writes with a plain INSERT, so repeated revalidations of the same
-- tag need upsert semantics. This trigger keeps the latest row for each tag.
CREATE TRIGGER IF NOT EXISTS revalidations_replace_existing_tag
BEFORE INSERT ON revalidations
BEGIN
  DELETE FROM revalidations WHERE tag = NEW.tag;
END;
