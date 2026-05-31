-- Geeta's JamBook — database setup
-- Run once in Supabase SQL editor or via CLI

-- 1. Memories table
CREATE TABLE IF NOT EXISTS memories (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  page_num         INTEGER     NOT NULL,
  type             TEXT        NOT NULL CHECK (type IN ('photo', 'note', 'video')),
  content          JSONB       NOT NULL DEFAULT '{}',
  contributor_name TEXT        NOT NULL DEFAULT 'anonymous',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security — public read + insert (anyone with the link)
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read"   ON memories;
DROP POLICY IF EXISTS "public insert" ON memories;
DROP POLICY IF EXISTS "public update" ON memories;
DROP POLICY IF EXISTS "public delete" ON memories;

CREATE POLICY "public read"   ON memories FOR SELECT USING (true);
CREATE POLICY "public insert" ON memories FOR INSERT WITH CHECK (true);
CREATE POLICY "public update" ON memories FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete" ON memories FOR DELETE USING (true);

-- 3. Enable real-time for the memories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'memories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE memories;
  END IF;
END $$;

-- 4. Optional storage cleanup policy for deleting uploaded media via the Storage API
DROP POLICY IF EXISTS "public delete media" ON storage.objects;
CREATE POLICY "public delete media" ON storage.objects
  FOR DELETE USING (bucket_id = 'jambook-media');
