/* ============================================================
   db.js — Supabase client + all data operations
   ============================================================ */

const db = (() => {
  const configured = !SUPABASE_URL.includes('YOUR_');

  const client = configured
    ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

  // 2 items per page gives each photo its own breathing room.
  const MAX_PER_PAGE = 2;

  // Slot 0 anchors upper-left; slot 1 anchors lower-right.
  // The vertical gap (~250 px) comfortably fits a polaroid on each half.
  const ZONES = [
    { x: 22,  y: 48,  rot: -5, w: 190 },  // upper-left
    { x: 145, y: 295, rot:  4, w: 182 },  // lower-right
    { x: 35,  y: 155, rot: -3, w: 185 },  // mid-left (overflow safety)
    { x: 150, y: 80,  rot:  5, w: 178 },  // upper-right (overflow safety)
  ];

  function jitter(range) { return (Math.random() - 0.5) * range; }

  function computePosition(slotIndex) {
    const zone = ZONES[slotIndex % ZONES.length];
    return {
      x:        zone.x + jitter(20),   // ±10 px horizontal
      y:        zone.y + jitter(16),   // ±8 px vertical (tight, prevents overlap)
      rotation: zone.rot + jitter(4),
      width:    zone.w + jitter(16),   // ±8 px
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

  async function updateMemoryPlacement(id, currentContent, x, y, pageNum) {
    if (!configured) return;
    const nextContent = { ...currentContent, x, y };
    const updatePayload = { content: nextContent };
    if (Number.isInteger(pageNum) && pageNum > 0) {
      updatePayload.page_num = pageNum;
    }
    const { error } = await client
      .from('memories')
      .update(updatePayload)
      .eq('id', id);
    if (error) throw error;
  }

  async function updateMemoryPosition(id, currentContent, x, y) {
    return updateMemoryPlacement(id, currentContent, x, y);
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
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
  }

  async function deleteMemory(memory) {
    if (!configured) throw new Error('Supabase not configured');
    const { data, error } = await client
      .from('memories')
      .delete()
      .eq('id', memory.id)
      .select('id');
    if (error) throw error;
    if (!data || data.length === 0)
      throw new Error('Supabase did not delete this memory. Refresh and try again.');
    const mediaPath = storagePathFromPublicUrl(memory.content && memory.content.url);
    if (mediaPath) {
      await client.storage.from('jambook-media').remove([mediaPath]).catch(() => {});
    }
  }

  function subscribeToMemories(onInsert, onDelete, onUpdate) {
    if (!configured) return { unsubscribe: () => {} };
    return client
      .channel('memory-changes')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'memories' },
        (p) => onInsert?.(p.new))
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'memories' },
        (p) => onDelete?.(p.old))
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'memories' },
        (p) => onUpdate?.(p.new))
      .subscribe();
  }

  return {
    configured,
    getMemories,
    addMemory,
    updateMemoryPosition,
    updateMemoryPlacement,
    deleteMemory,
    uploadMedia,
    subscribeToMemories,
  };
})();
