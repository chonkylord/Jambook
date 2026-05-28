-- Allow JamBook visitors to delete submitted memories.
-- This project is link-based and public, so delete follows the same public access model as insert.

ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public delete" ON memories;
CREATE POLICY "public delete" ON memories
  FOR DELETE
  USING (true);

DROP POLICY IF EXISTS "public delete media" ON storage.objects;
CREATE POLICY "public delete media" ON storage.objects
  FOR DELETE
  USING (bucket_id = 'jambook-media');
