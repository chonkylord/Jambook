-- Geeta's JamBook — database setup
-- Run once in Supabase SQL editor or via CLI

-- 1. Memories table
CREATE TABLE IF NOT EXISTS memories (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  page_num         INTEGER     NOT NULL,
  type             TEXT        NOT NULL CHECK (type IN ('photo', 'note', 'voice', 'video')),
  content          JSONB       NOT NULL DEFAULT '{}',
  contributor_name TEXT        NOT NULL DEFAULT 'anonymous',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security — public read + insert (anyone with the link)
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read"   ON memories;
DROP POLICY IF EXISTS "public insert" ON memories;

CREATE POLICY "public read"   ON memories FOR SELECT USING (true);
CREATE POLICY "public insert" ON memories FOR INSERT WITH CHECK (true);

-- 3. Enable real-time for the memories table
ALTER PUBLICATION supabase_realtime ADD TABLE memories;
