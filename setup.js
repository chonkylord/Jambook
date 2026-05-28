/**
 * setup.js — one-time database + storage setup for Geeta's JamBook
 *
 * Usage:
 *   1. Get your SERVICE ROLE key from:
 *      supabase.com → project → Settings → API → service_role (secret)
 *   2. Run:  node setup.js <service_role_key>
 */

const [,, serviceKey] = process.argv;

if (!serviceKey) {
  console.error([
    '',
    '  Usage: node setup.js <service_role_key>',
    '',
    '  Get the key from:',
    '  supabase.com → project → Settings → API → service_role (secret)',
    '',
  ].join('\n'));
  process.exit(1);
}

const PROJECT_URL = 'https://dqhfkowzohhemvnnmile.supabase.co';

async function sql(query) {
  const res = await fetch(`${PROJECT_URL}/rest/v1/rpc/exec`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query }),
  });
  // Supabase doesn't expose a raw SQL endpoint via REST — we use pg directly below
  return res;
}

// Use the Supabase Management API to execute SQL
async function execSQL(statement) {
  const ref = 'dqhfkowzohhemvnnmile';
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ query: statement }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`SQL failed (${res.status}): ${body}`);
  return body;
}

async function main() {
  console.log('\n🎁  Setting up Geeta\'s JamBook database...\n');

  const steps = [
    ['Create memories table', `
      CREATE TABLE IF NOT EXISTS memories (
        id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
        page_num         INTEGER     NOT NULL,
        type             TEXT        NOT NULL CHECK (type IN ('photo','note','voice','video')),
        content          JSONB       NOT NULL DEFAULT '{}',
        contributor_name TEXT        NOT NULL DEFAULT 'anonymous',
        created_at       TIMESTAMPTZ DEFAULT NOW()
      )
    `],
    ['Enable RLS', `ALTER TABLE memories ENABLE ROW LEVEL SECURITY`],
    ['Drop existing policies (safe)', `
      DO $$ BEGIN
        DROP POLICY IF EXISTS "public read"   ON memories;
        DROP POLICY IF EXISTS "public insert" ON memories;
        DROP POLICY IF EXISTS "public delete" ON memories;
      END $$
    `],
    ['Create read policy',   `CREATE POLICY "public read"   ON memories FOR SELECT USING (true)`],
    ['Create insert policy', `CREATE POLICY "public insert" ON memories FOR INSERT WITH CHECK (true)`],
    ['Create delete policy', `CREATE POLICY "public delete" ON memories FOR DELETE USING (true)`],
    ['Enable real-time',     `ALTER PUBLICATION supabase_realtime ADD TABLE memories`],
    ['Create storage bucket', `
      INSERT INTO storage.buckets (id, name, public)
      VALUES ('jambook-media', 'jambook-media', true)
      ON CONFLICT (id) DO UPDATE SET public = true
    `],
    ['Storage read policy', `
      DO $$ BEGIN
        DROP POLICY IF EXISTS "public read media" ON storage.objects;
        CREATE POLICY "public read media" ON storage.objects
          FOR SELECT USING (bucket_id = 'jambook-media');
      END $$
    `],
    ['Storage upload policy', `
      DO $$ BEGIN
        DROP POLICY IF EXISTS "public upload" ON storage.objects;
        CREATE POLICY "public upload" ON storage.objects
          FOR INSERT WITH CHECK (bucket_id = 'jambook-media');
      END $$
    `],
    ['Storage delete policy', `
      DO $$ BEGIN
        DROP POLICY IF EXISTS "public delete media" ON storage.objects;
        CREATE POLICY "public delete media" ON storage.objects
          FOR DELETE USING (bucket_id = 'jambook-media');
      END $$
    `],
  ];

  for (const [label, statement] of steps) {
    try {
      await execSQL(statement.trim());
      console.log(`  ✓  ${label}`);
    } catch (err) {
      console.log(`  ✗  ${label}: ${err.message}`);
    }
  }

  console.log('\n✅  Done. Open JamBook.html in a browser.\n');
}

main().catch(err => { console.error(err.message); process.exit(1); });
