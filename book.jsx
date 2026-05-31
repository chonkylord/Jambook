/* ============================================================
   book.jsx — page-flip engine
   ============================================================ */

const FLIP_DURATION = 1000; // ms — keep in sync with CSS transition

function Book({ leaves, currentIndex, setCurrentIndex, navRef }) {
  const [activeIndex, setActiveIndex] = React.useState(null);
  const [animating, setAnimating] = React.useState(false);

  const flipForward = React.useCallback(() => {
    setCurrentIndex((c) => {
      if (animating || c >= leaves.length) return c;
      setActiveIndex(c);
      setAnimating(true);
      window.setTimeout(() => {
        setActiveIndex(null);
        setAnimating(false);
      }, FLIP_DURATION);
      return c + 1;
    });
  }, [animating, leaves.length, setCurrentIndex]);

  const flipBack = React.useCallback(() => {
    setCurrentIndex((c) => {
      if (animating || c <= 0) return c;
      setActiveIndex(c - 1);
      setAnimating(true);
      window.setTimeout(() => {
        setActiveIndex(null);
        setAnimating(false);
      }, FLIP_DURATION);
      return c - 1;
    });
  }, [animating, setCurrentIndex]);

  // Expose flip functions so app.jsx can render nav buttons outside the scaled stage
  React.useEffect(() => {
    if (navRef) navRef.current = { flipForward, flipBack, animating };
  }, [flipForward, flipBack, animating, navRef]);

  // keyboard nav
  React.useEffect(() => {
    const onKey = (e) => {
      if (window.matchMedia("(max-width: 700px)").matches) return;

      const target = e.target;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
         target.tagName === "TEXTAREA" ||
         target.isContentEditable);

      if (isEditable) return;

      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); flipForward(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); flipBack(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipForward, flipBack]);

  const state =
    currentIndex === 0 ? "closed-front" :
    currentIndex === leaves.length ? "closed-back" :
    "open";

  const handleLeafClick = (i, isFlipped) => (e) => {
    e.stopPropagation();
    if (animating) return;
    if (isFlipped) flipBack();
    else flipForward();
  };

  return (
    <>
      <div className={`book ${state}`}>
        <div className="book-shadow" />
        {state === "open" && (
          <>
            <div className="book-block-left" />
            <div className="book-block-right" />
            <div className="spine-shadow" />
          </>
        )}
        {leaves.map((leaf, i) => {
          const flipped = i < currentIndex;
          const isCover = leaf.type === "cover";
          const isBackCover = leaf.type === "back-cover";

          let z;
          if (i === activeIndex) {
            z = 1000;
          } else if (flipped) {
            // most recently flipped should be on top of left stack
            z = i + 1;
          } else {
            // topmost unflipped (smallest i) should be on top of right stack
            z = leaves.length - i + 1;
          }

          return (
            <div
              key={i}
              className={`leaf ${flipped ? "flipped" : ""} ${i === activeIndex ? "flipping" : ""} ${isCover ? "cover" : ""} ${isBackCover ? "back-cover" : ""}`}
              style={{ zIndex: z }}
              onClick={handleLeafClick(i, flipped)}
            >
              <div className={`leaf-face front ${isCover ? "cover-face" : ""}`}>
                {leaf.front}
              </div>
              <div className={`leaf-face back ${isBackCover ? "cover-face" : ""}`}>
                {leaf.back}
              </div>
            </div>
          );
        })}
      </div>

      {/* nav buttons are rendered in app.jsx outside the scaled stage */}
    </>
  );
}

Object.assign(window, { Book, FLIP_DURATION });
