/* ============================================================
   app.jsx — root app: loads data, manages state, renders book
   ============================================================ */

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
