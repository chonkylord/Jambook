-- Remove voice as a supported JamBook memory type for new submissions.
-- NOT VALID keeps the migration safe if old voice rows already exist.

ALTER TABLE memories DROP CONSTRAINT IF EXISTS memories_type_check;
ALTER TABLE memories
  ADD CONSTRAINT memories_type_check
  CHECK (type IN ('photo', 'note', 'video')) NOT VALID;
