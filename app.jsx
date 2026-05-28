/* ============================================================
   app.jsx — root app: loads data, manages state, renders book
   ============================================================ */

function useMobilePageScale() {
  const [scale, setScale] = React.useState(0.8);

  React.useEffect(() => {
    const updateScale = () => {
      const widthScale = (window.innerWidth - 28) / 440;
      const heightScale = (window.innerHeight - 178) / 580;
      setScale(Math.max(0.58, Math.min(widthScale, heightScale, 1)));
    };

    updateScale();
    window.addEventListener("resize", updateScale);
    window.addEventListener("orientationchange", updateScale);
    return () => {
      window.removeEventListener("resize", updateScale);
      window.removeEventListener("orientationchange", updateScale);
    };
  }, []);

  return scale;
}

function buildMobilePages(leaves) {
  const pages = [];

  leaves.forEach((leaf, i) => {
    const isFirst = i === 0;
    const isLast = i === leaves.length - 1;

    if (isFirst) {
      pages.push({ content: leaf.front, type: "cover", label: "Cover" });
      pages.push({ content: leaf.back, type: "paper", label: "Inside cover" });
      return;
    }

    if (isLast && leaf.type === "back-cover") {
      pages.push({ content: leaf.front, type: "paper", label: "Final page" });
      pages.push({ content: leaf.back, type: "back-cover", label: "Back cover" });
      return;
    }

    pages.push({ content: leaf.front, type: "paper", label: `Page ${pages.length}` });
    pages.push({ content: leaf.back, type: "paper", label: `Page ${pages.length}` });
  });

  return pages;
}

function MobileBook({ leaves }) {
  const pages = React.useMemo(() => buildMobilePages(leaves), [leaves]);
  const [pageIndex, setPageIndex] = React.useState(0);
  const scale = useMobilePageScale();
  const page = pages[pageIndex] || pages[0];

  React.useEffect(() => {
    setPageIndex((current) => Math.min(current, Math.max(pages.length - 1, 0)));
  }, [pages.length]);

  const goPrevious = () => setPageIndex((current) => Math.max(current - 1, 0));
  const goNext = () => setPageIndex((current) => Math.min(current + 1, pages.length - 1));

  const handlePageTap = (e) => {
    const target = e.target;
    if (
      target &&
      target.closest &&
      target.closest("button, input, textarea, label, audio, video")
    ) {
      return;
    }
    goNext();
  };

  if (!page) return null;

  return (
    <div className="mobile-reader">
      <div
        className="mobile-page-frame"
        style={{ width: 440 * scale, height: 580 * scale }}
        onClick={handlePageTap}
      >
        <div
          className={`mobile-page mobile-${page.type}`}
          style={{ transform: `scale(${scale})` }}
        >
          {page.content}
        </div>
      </div>

      <div className="mobile-controls">
        <button className="mobile-turn" onClick={goPrevious} disabled={pageIndex === 0} aria-label="Previous page">
          &lsaquo;
        </button>
        <div className="mobile-counter">
          {page.label} &middot; {pageIndex + 1} / {pages.length}
        </div>
        <button className="mobile-turn" onClick={goNext} disabled={pageIndex === pages.length - 1} aria-label="Next page">
          &rsaquo;
        </button>
      </div>
    </div>
  );
}

function DesktopRecommendation() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 700px)");
    const storageKey = "jambook-desktop-recommendation-dismissed";

    const isDismissed = () => {
      try {
        return window.localStorage.getItem(storageKey) === "true";
      } catch {
        return false;
      }
    };

    const syncVisibility = () => {
      setVisible(media.matches && !isDismissed());
    };

    syncVisibility();
    if (media.addEventListener) {
      media.addEventListener("change", syncVisibility);
      return () => media.removeEventListener("change", syncVisibility);
    }

    media.addListener(syncVisibility);
    return () => media.removeListener(syncVisibility);
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem("jambook-desktop-recommendation-dismissed", "true");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="desktop-rec-overlay" role="dialog" aria-modal="true" aria-labelledby="desktop-rec-title">
      <div className="desktop-rec-card">
        <button className="desktop-rec-close" onClick={dismiss} aria-label="Close recommendation">×</button>
        <div className="desktop-rec-kicker">For the full JamBook</div>
        <div id="desktop-rec-title" className="desktop-rec-title">A laptop or PC is recommended.</div>
        <p>
          The phone version lets you browse and add memories, but the full two-page book,
          page turns, and keepsake details are most beautiful on a larger screen.
        </p>
        <button className="desktop-rec-action" onClick={dismiss}>
          continue on phone
        </button>
      </div>
    </div>
  );
}

function App() {
  const [memories,     setMemories]     = React.useState([]);
  const [loading,      setLoading]      = React.useState(true);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [editorOpen,   setEditorOpen]   = React.useState(false);

  // Load memories on mount and subscribe to real-time inserts
  React.useEffect(() => {
    db.getMemories()
      .then(data => { setMemories(data); setLoading(false); })
      .catch(err  => { console.error("Failed to load memories:", err); setLoading(false); });

    const channel = db.subscribeToMemories((newMemory) => {
      setMemories(prev =>
        prev.some(m => m.id === newMemory.id) ? prev : [...prev, newMemory]
      );
    });

    return () => {
      if (channel && channel.unsubscribe) channel.unsubscribe();
    };
  }, []);

  const leaves = React.useMemo(() => buildLeaves(memories), [memories]);
  const total  = leaves.length;
  const state  =
    currentIndex === 0     ? "closed-front" :
    currentIndex === total ? "closed-back"  : "open";

  const handleMemoryAdded = (memory) => {
    setMemories(prev =>
      prev.some(m => m.id === memory.id) ? prev : [...prev, memory]
    );
    setEditorOpen(false);
  };

  if (loading) {
    return (
      <div style={{
        position: "fixed", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Cormorant Garamond', serif",
        fontSize: 28, fontStyle: "italic",
        color: "rgba(245,230,200,0.7)",
      }}>
        opening the book...
      </div>
    );
  }

  return (
    <>
      <div className="book-label">Geeta's JamBook · est. 2026</div>

      <div className="progress">
        {leaves.map((_, i) => (
          <div key={i} className={`dot ${i === currentIndex - 1 ? "active" : ""}`} />
        ))}
      </div>

      <div className="stage">
        <Book leaves={leaves} currentIndex={currentIndex} setCurrentIndex={setCurrentIndex} />
      </div>

      <MobileBook leaves={leaves} />

      <DesktopRecommendation />

      <div className="hint" style={{ opacity: currentIndex === 0 ? 1 : 0.55 }}>
        {currentIndex === 0
          ? <>tap the book to open <span className="key">→</span></>
          : state === "closed-back"
            ? <>the end. <span className="key">←</span> to go back</>
            : <><span className="key">←</span> <span className="key">→</span> to turn the pages</>
        }
      </div>

      <button className="add-btn" onClick={() => setEditorOpen(true)}>
        ✚ add a memory
      </button>

      {editorOpen && <Editor onClose={() => setEditorOpen(false)} onAdd={handleMemoryAdded} />}
    </>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
