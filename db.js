/* ============================================================
   db.js — Supabase client + all data operations
   ============================================================ */

const db = (() => {
  const configured = !SUPABASE_URL.includes('YOUR_');

  const client = configured
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  const MAX_PER_PAGE = 3;

  // Scrapbook placement zones on a 440×580 page (page-local coords).
  // Three slots per page; choose based on how many items already exist.
  const ZONES = [
    { x: 28,  y: 68,  rot: -5, w: 205 },  // top-left anchor
    { x: 182, y: 88,  rot:  4, w: 185 },  // top-right
    { x: 42,  y: 300, rot: -3, w: 215 },  // lower-left
    { x: 188, y: 280, rot:  5, w: 190 },  // lower-right
    { x: 55,  y: 390, rot: -4, w: 195 },  // bottom-left
    { x: 198, y: 375, rot:  3, w: 175 },  // bottom-right
  ];

  function jitter(range) {
    return (Math.random() - 0.5) * range;
  }

  function computePosition(slotIndex) {
    const zone = ZONES[slotIndex % ZONES.length];
    return {
      x:        zone.x + jitter(28),
      y:        zone.y + jitter(28),
      rotation: zone.rot + jitter(4),
      width:    zone.w + jitter(20),
    };
  }

  async function getMemories() {
    if (!configured) return [];
    const { data, error } = await client
      .from('memories')
      .select('*')
      .order('page_num', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function addMemory({ type, content, contributor_name }) {
    if (!configured) throw new Error('Supabase not configured — fill in config.js');

    // Count memories per page to find first page with room
    const { data: existing } = await client
      .from('memories')
      .select('page_num');

    const counts = {};
    for (const { page_num } of (existing || [])) {
      counts[page_num] = (counts[page_num] || 0) + 1;
    }

    const maxExisting = Object.keys(counts).length
      ? Math.max(...Object.keys(counts).map(Number))
      : 0;

    let targetPage = null;
    for (let p = 1; p <= maxExisting + 1; p++) {
      if ((counts[p] || 0) < MAX_PER_PAGE) { targetPage = p; break; }
    }
    if (targetPage === null) targetPage = maxExisting + 1;

    const slotIndex = counts[targetPage] || 0;
    const pos = computePosition(slotIndex);

    const { data, error } = await client
      .from('memories')
      .insert([{
        page_num: targetPage,
        type,
        content: { ...pos, ...content },
        contributor_name: contributor_name || 'anonymous',
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async function uploadMedia(file, folder) {
    if (!configured) throw new Error('Supabase not configured');
    const ext  = (file.name || 'file').split('.').pop();
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await client.storage.from('jambook-media').upload(path, file, {
      cacheControl: '31536000',
      upsert: false,
    });
    if (error) throw error;
    return client.storage.from('jambook-media').getPublicUrl(path).data.publicUrl;
  }

  function storagePathFromPublicUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const marker = '/storage/v1/object/public/jambook-media/';
    const index = url.indexOf(marker);
    if (index === -1) return null;
    return decodeURIComponent(url.slice(index + marker.length).split('?')[0]);
  }

  async function deleteMemory(memory) {
    if (!configured) throw new Error('Supabase not configured');

    const { data, error } = await client
      .from('memories')
      .delete()
      .eq('id', memory.id)
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Supabase did not delete this memory. Refresh and try again.');
    }

    const mediaPath = storagePathFromPublicUrl(memory.content && memory.content.url);
    if (mediaPath) {
      await client.storage.from('jambook-media').remove([mediaPath]).catch(() => {});
    }
  }

  function subscribeToMemories(onInsert, onDelete) {
    if (!configured) return { unsubscribe: () => {} };
    return client
      .channel('memory-inserts')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'memories' },
        (payload) => onInsert(payload.new)
      )
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'memories' },
        (payload) => onDelete && onDelete(payload.old)
      )
      .subscribe();
  }

  return { configured, getMemories, addMemory, deleteMemory, uploadMedia, subscribeToMemories };
})();
