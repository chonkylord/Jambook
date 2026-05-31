/* ============================================================
   spreads.jsx — dynamic scrapbook renderer
   Pages are 440×580. Content is loaded from Supabase.
   ============================================================ */

/* ── SVG botanicals ─────────────────────────────────────────── */
const Sprig = ({ style, color = "#5a6a3a", scale = 1 }) => (
  <svg className="botanical" style={style} width={60 * scale} height={120 * scale} viewBox="0 0 60 120">
    <path d="M30 5 Q30 60 30 115" stroke={color} strokeWidth="1.2" fill="none" />
    <path d="M30 20 Q15 18 8 28 Q18 30 30 26" fill={color} opacity="0.7" />
    <path d="M30 35 Q45 33 52 43 Q42 45 30 41" fill={color} opacity="0.7" />
    <path d="M30 52 Q15 50 8 60 Q18 62 30 58" fill={color} opacity="0.7" />
    <path d="M30 70 Q45 68 52 78 Q42 80 30 76" fill={color} opacity="0.7" />
    <path d="M30 88 Q15 86 8 96 Q18 98 30 94" fill={color} opacity="0.7" />
  </svg>
);

const Flower = ({ style, scale = 1, color = "#c97b5e" }) => (
  <svg className="botanical" style={style} width={70 * scale} height={70 * scale} viewBox="0 0 70 70">
    <g transform="translate(35 35)">
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <ellipse key={a} cx="0" cy="-14" rx="7" ry="13" fill={color} opacity="0.75"
          transform={`rotate(${a})`} />
      ))}
      <circle r="6" fill="#d4a957" />
    </g>
  </svg>
);

const Heart = ({ style, color = "#a83a3a", size = 30 }) => (
  <svg className="doodle-svg" style={style} width={size} height={size} viewBox="0 0 30 30">
    <path d="M15 26 C5 18, 2 12, 6 8 C9 5, 13 6, 15 10 C17 6, 21 5, 24 8 C28 12, 25 18, 15 26 Z"
      fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
);

const Wave = ({ heights = [8,14,6,18,12,20,10,16,6,14,9,20,12,8,14,6,16] }) => (
  <div className="wave">
    {heights.map((h, i) => <span key={i} style={{ height: h + "px" }} />)}
  </div>
);

/* ── Drag hook ───────────────────────────────────────────────
   Tracks pointer position relative to the .page container,
   correcting for whatever CSS scale the .stage applies.
   Calls onPositionUpdate(id, x, y, content) when drag ends.
──────────────────────────────────────────────────────────── */
function useDrag(memory, onPlacementUpdate) {
  const [localPos, setLocalPos] = React.useState({
    x: memory.content.x,
    y: memory.content.y,
  });
  const dragging = React.useRef(false);
  const currentPos = React.useRef({ x: memory.content.x, y: memory.content.y });
  const currentPageNum = React.useRef(memory.page_num);
  const pointerOffset = React.useRef({ x: 0, y: 0 });
  const dragNode = React.useRef(null);
  const lastPointer = React.useRef({ clientX: 0, clientY: 0 });

  React.useEffect(() => {
    if (!dragging.current) {
      const p = { x: memory.content.x, y: memory.content.y };
      setLocalPos(p);
      currentPos.current = p;
      currentPageNum.current = memory.page_num;
    }
  }, [memory.content.x, memory.content.y, memory.page_num]);

  const findPageAtPoint = React.useCallback((clientX, clientY) => {
    const nodes = document.elementsFromPoint
      ? document.elementsFromPoint(clientX, clientY)
      : [document.elementFromPoint(clientX, clientY)].filter(Boolean);

    for (const node of nodes) {
      if (!node) continue;
      if (dragNode.current && (node === dragNode.current || dragNode.current.contains(node))) continue;

      const pageEl = node.closest?.('[data-page-num]');
      if (!pageEl) continue;

      const pageNum = Number(pageEl.dataset.pageNum);
      if (Number.isFinite(pageNum)) {
        return { pageEl, pageNum };
      }
    }

    const fallback = dragNode.current?.closest?.('[data-page-num]');
    if (fallback) {
      const pageNum = Number(fallback.dataset.pageNum);
      if (Number.isFinite(pageNum)) return { pageEl: fallback, pageNum };
    }

    return null;
  }, []);

  const updateFromPoint = React.useCallback((clientX, clientY) => {
    const target = findPageAtPoint(clientX, clientY);
    if (!target) return;

    const rect = target.pageEl.getBoundingClientRect();
    const scale = rect.width / 440;
    const pageX = (clientX - rect.left) / scale;
    const pageY = (clientY - rect.top) / scale;
    const x = pageX - pointerOffset.current.x;
    const y = pageY - pointerOffset.current.y;

    currentPageNum.current = target.pageNum;
    currentPos.current = { x, y };
    lastPointer.current = { clientX, clientY };
    setLocalPos({ x, y });
  }, [findPageAtPoint]);

  const finishDrag = React.useCallback(() => {
    dragging.current = false;
    window.__jambookDraggingMemory = false;
    window.__jambookDragSuppressUntil = Date.now() + 300;
    onPlacementUpdate(
      memory.id,
      currentPos.current.x,
      currentPos.current.y,
      memory.content,
      currentPageNum.current
    );
  }, [memory.content, memory.id, onPlacementUpdate]);

  const onMouseDown = (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    const pageEl = e.currentTarget.closest('[data-page-num]');
    if (!pageEl) return;

    const rect = pageEl.getBoundingClientRect();
    const scale = rect.width / 440;
    const startPageX = (e.clientX - rect.left) / scale;
    const startPageY = (e.clientY - rect.top) / scale;

    dragNode.current = e.currentTarget;
    pointerOffset.current = {
      x: startPageX - currentPos.current.x,
      y: startPageY - currentPos.current.y,
    };
    currentPageNum.current = Number(pageEl.dataset.pageNum) || memory.page_num;
    lastPointer.current = { clientX: e.clientX, clientY: e.clientY };
    dragging.current = true;
    window.__jambookDraggingMemory = true;
    window.__jambookDragSuppressUntil = Date.now() + 300;

    const onMove = (ev) => {
      updateFromPoint(ev.clientX, ev.clientY);
    };
    const onUp = () => {
      updateFromPoint(lastPointer.current.clientX, lastPointer.current.clientY);
      finishDrag();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      dragNode.current = null;
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    updateFromPoint(e.clientX, e.clientY);
  };

  const onTouchStart = (e) => {
    e.stopPropagation();
    const touch = e.touches[0];
    const pageEl = e.currentTarget.closest('[data-page-num]');
    if (!pageEl || !touch) return;

    const rect = pageEl.getBoundingClientRect();
    const scale = rect.width / 440;
    const startPageX = (touch.clientX - rect.left) / scale;
    const startPageY = (touch.clientY - rect.top) / scale;

    dragNode.current = e.currentTarget;
    pointerOffset.current = {
      x: startPageX - currentPos.current.x,
      y: startPageY - currentPos.current.y,
    };
    currentPageNum.current = Number(pageEl.dataset.pageNum) || memory.page_num;
    lastPointer.current = { clientX: touch.clientX, clientY: touch.clientY };
    dragging.current = true;
    window.__jambookDraggingMemory = true;
    window.__jambookDragSuppressUntil = Date.now() + 300;

    const onMove = (ev) => {
      ev.preventDefault();
      const t = ev.touches[0];
      if (!t) return;
      updateFromPoint(t.clientX, t.clientY);
    };
    const onEnd = () => {
      updateFromPoint(lastPointer.current.clientX, lastPointer.current.clientY);
      finishDrag();
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
      dragNode.current = null;
    };

    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
    updateFromPoint(touch.clientX, touch.clientY);
  };

  return { localPos, onMouseDown, onTouchStart };
}

/* ── Delete button ───────────────────────────────────────── */
const DeleteMemoryButton = ({ memory, onDeleteMemory }) => {
  if (!onDeleteMemory) return null;
  return (
    <button
      className="memory-delete"
      onClick={e => { e.stopPropagation(); onDeleteMemory(memory); }}
      onMouseDown={e => e.stopPropagation()}
      onTouchStart={e => e.stopPropagation()}
      aria-label="Delete this memory"
      title="Delete this memory"
    >
      delete
    </button>
  );
};

/* ── Memory elements ─────────────────────────────────────── */
const PhotoEl = ({ memory, onDeleteMemory, onPositionUpdate }) => {
  const { content, contributor_name } = memory;
  const { rotation, url, caption, aspect = 1.22, displayWidth } = content;
  const width  = displayWidth || content.width || 200;
  const photoH = Math.round(width / aspect);

  const { localPos, onMouseDown, onTouchStart } = useDrag(
    memory,
    onPositionUpdate || (() => {})
  );

  return (
    <>
      <div
        className="polaroid"
        data-memory-id={memory.id}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        onClick={e => e.stopPropagation()}
        style={{
          position: "absolute",
          left:   localPos.x,
          top:    localPos.y,
          width,
          height: photoH + 56,
          transform: `rotate(${rotation}deg)`,
          zIndex: 3,
          cursor: "grab",
          userSelect: "none",
          touchAction: "none",
        }}
      >
        <div className="photo" style={{ backgroundImage: `url(${url})`, height: photoH }} />
        <div className="caption">
          {caption || (contributor_name && contributor_name !== "anonymous" ? `from ${contributor_name}` : "")}
        </div>
        <DeleteMemoryButton memory={memory} onDeleteMemory={onDeleteMemory} />
      </div>
      {/* Tape follows the photo during drag */}
      <div className="tape washi" style={{
        position: "absolute",
        left:  localPos.x + width * 0.28,
        top:   localPos.y - 13,
        transform: `rotate(${rotation - 5}deg)`,
        pointerEvents: "none",
      }} />
    </>
  );
};

const NoteEl = ({ memory, onDeleteMemory, onPositionUpdate }) => {
  const { content, contributor_name } = memory;
  const { rotation, width = 200, text } = content;

  const { localPos, onMouseDown, onTouchStart } = useDrag(
    memory,
    onPositionUpdate || (() => {})
  );

  return (
    <div
      className="note-card"
      data-memory-id={memory.id}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute",
        left:   localPos.x,
        top:    localPos.y,
        width,
        transform: `rotate(${rotation}deg)`,
        fontSize: 20,
        zIndex: 3,
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      {text}
      {contributor_name && contributor_name !== "anonymous" && (
        <span className="signature">— {contributor_name}</span>
      )}
      <DeleteMemoryButton memory={memory} onDeleteMemory={onDeleteMemory} />
    </div>
  );
};

const VideoEl = ({ memory, onDeleteMemory, onPositionUpdate }) => {
  const { content, contributor_name } = memory;
  const { rotation, width = 220, url, caption } = content;

  const { localPos, onMouseDown, onTouchStart } = useDrag(
    memory,
    onPositionUpdate || (() => {})
  );

  return (
    <div
      data-memory-id={memory.id}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute",
        left:   localPos.x,
        top:    localPos.y,
        width,
        transform: `rotate(${rotation}deg)`,
        zIndex: 3,
        background: "#1a1008",
        padding: 10,
        boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
      }}
    >
      <video src={url} controls style={{ width: "100%", display: "block" }}
        onMouseDown={e => e.stopPropagation()}
        onClick={e => e.stopPropagation()} />
      {(caption || contributor_name) && (
        <div style={{ fontFamily: "'Caveat', cursive", fontSize: 16, color: "#f4ead2", textAlign: "center", padding: "4px 0" }}>
          {caption || `from ${contributor_name}`}
        </div>
      )}
      <DeleteMemoryButton memory={memory} onDeleteMemory={onDeleteMemory} />
    </div>
  );
};

function MemoryEl({ memory, onDeleteMemory, onPositionUpdate }) {
  const props = { memory, onDeleteMemory, onPositionUpdate };
  switch (memory.type) {
    case "photo": return <PhotoEl {...props} />;
    case "note":  return <NoteEl  {...props} />;
    case "video": return <VideoEl {...props} />;
    default:      return null;
  }
}

/* ── Static pages ───────────────────────────────────────────── */
const CoverFront = () => (
  <>
    <div className="cover-spine-band" />
    <div className="cover-corner tl" /><div className="cover-corner tr" />
    <div className="cover-corner bl" /><div className="cover-corner br" />
    <div className="cover-border" />
    <div className="cover-content">
      <div className="cover-ornament">✦ &nbsp; ❦ &nbsp; ✦</div>
      <div className="cover-title">Geeta's</div>
      <div className="cover-subtitle">Jam&nbsp;Book</div>
      <div className="cover-dedication">— with love from everyone</div>
    </div>
    <div className="cover-bottom">A KEEPSAKE · BIRTHDAY EDITION</div>
  </>
);

const CoverBack = () => (
  <>
    <div className="cover-spine-band" />
    <div className="cover-content" style={{ justifyContent: "flex-end" }}>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 22, opacity: 0.7, color: "var(--gold)" }}>
        love, kept.
      </div>
    </div>
    <div className="cover-corner tl" style={{ opacity: 0.4 }} />
    <div className="cover-corner tr" style={{ opacity: 0.4 }} />
    <div className="cover-corner bl" style={{ opacity: 0.4 }} />
    <div className="cover-corner br" style={{ opacity: 0.4 }} />
  </>
);

const InsideCoverPaper = () => (
  <div className="page left">
    <div style={{ position: "absolute", inset: 30, border: "1px solid rgba(120,90,50,0.18)", borderRadius: 2 }} />
    <div style={{
      position: "absolute", left: "50%", top: "42%",
      transform: "translate(-50%,-50%)",
      width: 260, padding: "26px 18px", textAlign: "center",
      border: "1.5px double rgba(120,90,50,0.45)",
      background: "rgba(253,245,221,0.5)",
    }}>
      <div style={{ fontFamily: "'Special Elite', monospace", fontSize: 10, letterSpacing: "0.35em", color: "var(--ink-soft)", marginBottom: 14 }}>
        EX · LIBRIS
      </div>
      <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: 44, color: "var(--ink)", lineHeight: 1 }}>
        Geeta
      </div>
      <div style={{ marginTop: 10, fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 15, color: "var(--ink-soft)" }}>
        this book belongs to
      </div>
    </div>
    <Sprig style={{ left: 40, top: 70, transform: "rotate(-15deg)" }} scale={0.7} />
    <Sprig style={{ right: 40, bottom: 70, transform: "rotate(155deg)" }} scale={0.7} />
  </div>
);

const WelcomePage = () => (
  <div className="page right">
    <div style={{ marginTop: 40 }}>
      <div className="page-kicker">a book for geeta</div>
      <div className="page-title" style={{ marginTop: 4, fontSize: 44 }}>Add your memory.</div>
    </div>
    <div style={{
      marginTop: 28,
      fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic",
      fontSize: 19, lineHeight: 1.65, color: "var(--ink)", maxWidth: 340,
    }}>
      <p>This is a living memory book — anyone with this link can add a photo, a handwritten message, or a short video.</p>
      <p style={{ marginTop: 12 }}>The book grows with every memory. Use the button at the bottom of your screen to add yours.</p>
      <p style={{ marginTop: 12 }}>Turn the page to see what's already here.</p>
    </div>
    <div style={{
      position: "absolute", right: 50, bottom: 80,
      fontFamily: "'Homemade Apple', cursive",
      fontSize: 20, color: "var(--ink-soft)", textAlign: "right", lineHeight: 1.4,
    }}>
      with so much love,<br/>
      <span style={{ fontSize: 26, color: "var(--ink)" }}>your neighbours</span>
    </div>
    <Flower style={{ left: 60, bottom: 60, transform: "rotate(-20deg)" }} scale={0.85} />
    <Sprig style={{ left: 90, bottom: 40, transform: "rotate(40deg)" }} scale={0.5} />
    <Heart style={{ position: "absolute", right: 70, top: 200, transform: "rotate(15deg)" }} size={26} />
    <div className="page-num">i</div>
  </div>
);

const EmptyPage = ({ side, pageNum }) => (
  <div className={`page ${side}`} data-page-num={pageNum}>
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      opacity: 0.22, pointerEvents: "none",
    }}>
      <div style={{ fontFamily: "'Dancing Script', cursive", fontSize: 28, color: "var(--ink-soft)" }}>
        a blank page,
      </div>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontStyle: "italic", fontSize: 16, color: "var(--ink-soft)", marginTop: 8 }}>
        waiting for a memory.
      </div>
    </div>
  </div>
);

const BackPaper = () => (
  <div className="page right">
    <div style={{ position: "absolute", inset: 40, border: "1px solid rgba(120,90,50,0.18)", borderRadius: 2 }} />
    <div style={{
      position: "absolute", left: "50%", top: "50%",
      transform: "translate(-50%,-50%)",
      fontFamily: "'Cormorant Garamond', serif",
      fontStyle: "italic", fontSize: 18,
      color: "var(--ink-soft)", opacity: 0.55, textAlign: "center",
    }}>
      ✦
      <div style={{ fontSize: 13, letterSpacing: "0.3em", marginTop: 12 }}>FIN ·</div>
    </div>
  </div>
);

const ContentPage = ({ side, pageNum, memories, onDeleteMemory, onPositionUpdate }) => (
  <div className={`page ${side}`} data-page-num={pageNum}>
    {(memories || []).map(m => (
      <MemoryEl
        key={m.id}
        memory={m}
        onDeleteMemory={onDeleteMemory}
        onPositionUpdate={onPositionUpdate}
      />
    ))}
  </div>
);

/* ── buildLeaves ────────────────────────────────────────────── */
function buildLeaves(memories, options = {}) {
  const { onDeleteMemory, onPositionUpdate } = options;

  const byPage = {};
  for (const m of memories) {
    if (!byPage[m.page_num]) byPage[m.page_num] = [];
    byPage[m.page_num].push(m);
  }

  const maxPage = memories.length > 0
    ? Math.max(...memories.map(m => m.page_num))
    : 0;

  const maxContentLeaf = Math.max(2, Math.ceil((maxPage + 2) / 2));

  const pageProps = { onDeleteMemory, onPositionUpdate };

  const leaves = [
    { type: "cover", front: <CoverFront />, back: <InsideCoverPaper /> },
    {
      front: <WelcomePage />,
      back: byPage[1]
        ? <ContentPage side="left" pageNum={1} memories={byPage[1]} {...pageProps} />
        : <EmptyPage side="left" pageNum={1} />,
    },
  ];

  for (let k = 2; k <= maxContentLeaf; k++) {
    const rightNum = 2 * (k - 1);
    const leftNum  = 2 * k - 1;
    const r = byPage[rightNum] || [];
    const l = byPage[leftNum]  || [];
    leaves.push({
      front: r.length ? <ContentPage side="right" pageNum={rightNum} memories={r} {...pageProps} /> : <EmptyPage side="right" pageNum={rightNum} />,
      back:  l.length ? <ContentPage side="left"  pageNum={leftNum}  memories={l} {...pageProps} /> : <EmptyPage side="left" pageNum={leftNum} />,
    });
  }

  leaves.push({ type: "back-cover", front: <BackPaper />, back: <CoverBack /> });
  return leaves;
}

Object.assign(window, { buildLeaves });
