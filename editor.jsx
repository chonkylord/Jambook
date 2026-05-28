/* ============================================================
   editor.jsx — "Add a memory" panel
   ============================================================ */

function Editor({ onClose, onAdd }) {
  const [name,       setName]       = React.useState("");
  const [type,       setType]       = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitStatus, setSubmitStatus] = React.useState("");
  const [error,      setError]      = React.useState(null);

  // Photo
  const [photoFile,    setPhotoFile]    = React.useState(null);
  const [photoPreview, setPhotoPreview] = React.useState(null);
  const [photoSize,    setPhotoSize]    = React.useState(null);
  const [photoCrop,    setPhotoCrop]    = React.useState({ mode: "fit", zoom: 1, x: 50, y: 50 });
  const [caption,      setCaption]      = React.useState("");

  // Note
  const [noteText, setNoteText] = React.useState("");

  // Video
  const [videoFile,    setVideoFile]    = React.useState(null);
  const [videoCaption, setVideoCaption] = React.useState("");

  const setCropValue = (key, value) => {
    setPhotoCrop(prev => ({
      ...prev,
      mode: "crop",
      [key]: Number(value),
    }));
  };

  const setCropMode = (mode) => {
    setPhotoCrop(prev => ({ ...prev, mode }));
  };

  const selectPhotoFile = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);

    if (photoPreview) URL.revokeObjectURL(photoPreview);

    setPhotoFile(file);
    setPhotoPreview(previewUrl);
    setPhotoSize(null);
    setPhotoCrop({ mode: "fit", zoom: 1, x: 50, y: 50 });

    const img = new Image();
    img.onload = () => setPhotoSize({ width: img.naturalWidth, height: img.naturalHeight });
    img.src = previewUrl;
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    selectPhotoFile(file);
  };

  const handlePhotoDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith("image/")) return;
    selectPhotoFile(file);
  };

  const getPhotoLayout = () => {
    if (!photoSize) return { aspect: 1.22, width: 200 };

    const naturalAspect = photoSize.width / photoSize.height;
    const minAspect = 0.62;
    const maxAspect = 1.7;
    const aspect = photoCrop.mode === "crop"
      ? 1.22
      : Math.max(minAspect, Math.min(maxAspect, naturalAspect));
    const width = aspect < 0.8 ? 170 : aspect > 1.45 ? 225 : 200;

    return { aspect, width };
  };

  const createPreparedPhoto = () => new Promise((resolve, reject) => {
    if (!photoFile || !photoSize) {
      resolve({ file: photoFile, layout: getPhotoLayout() });
      return;
    }

    const layout = getPhotoLayout();
    const targetAspect = layout.aspect;
    const sourceAspect = photoSize.width / photoSize.height;
    const outputWidth = 900;
    const outputHeight = Math.round(outputWidth / targetAspect);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = outputWidth;
      canvas.height = outputHeight;
      const ctx = canvas.getContext("2d");

      if (photoCrop.mode === "crop") {
        const baseWidth = sourceAspect > targetAspect
          ? photoSize.height * targetAspect
          : photoSize.width;
        const baseHeight = baseWidth / targetAspect;
        const cropWidth = baseWidth / photoCrop.zoom;
        const cropHeight = baseHeight / photoCrop.zoom;
        const centerX = (photoCrop.x / 100) * photoSize.width;
        const centerY = (photoCrop.y / 100) * photoSize.height;
        const sourceX = Math.max(0, Math.min(photoSize.width - cropWidth, centerX - cropWidth / 2));
        const sourceY = Math.max(0, Math.min(photoSize.height - cropHeight, centerY - cropHeight / 2));

        ctx.drawImage(
          img,
          sourceX, sourceY, cropWidth, cropHeight,
          0, 0, canvas.width, canvas.height
        );
      } else {
        ctx.fillStyle = "#fbf6e9";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not crop the photo. Try another image."));
          return;
        }

        resolve({
          file: new File([blob], "jambook-photo.jpg", { type: "image/jpeg" }),
          layout,
        });
      }, "image/jpeg", 0.9);
    };
    img.onerror = () => reject(new Error("Could not load the photo for cropping."));
    img.src = photoPreview;
  });

  const handleSubmit = async () => {
    setError(null);
    setSubmitStatus("");
    if (!name.trim()) { setError("Tell us your name first."); return; }
    if (!type)        { setError("Pick what kind of memory you're adding."); return; }

    setSubmitting(true);
    try {
      let content = {};

      if (type === "photo") {
        if (!photoFile) { setError("Choose a photo first."); setSubmitting(false); return; }
        setSubmitStatus("preparing photo...");
        const preparedPhoto = await createPreparedPhoto();
        setSubmitStatus("uploading photo...");
        const url = await db.uploadMedia(preparedPhoto.file, "photos");
        content = { url, caption, aspect: preparedPhoto.layout.aspect, displayWidth: preparedPhoto.layout.width };
      } else if (type === "note") {
        if (!noteText.trim()) { setError("Write something first."); setSubmitting(false); return; }
        setSubmitStatus("placing note...");
        content = { text: noteText };
      } else if (type === "video") {
        if (!videoFile) { setError("Choose a video first."); setSubmitting(false); return; }
        setSubmitStatus("uploading video...");
        const url = await db.uploadMedia(videoFile, "videos");
        content = { url, caption: videoCaption };
      }

      setSubmitStatus("placing memory...");
      const memory = await db.addMemory({ type, content, contributor_name: name.trim() });
      onAdd(memory);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
      setSubmitStatus("");
    }
  };

  const pickType = (t) => { setType(t); setError(null); };

  React.useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  return (
    <div className="editor-overlay" onClick={onClose}>
      <div className="editor-panel" onClick={e => e.stopPropagation()}>
        <button className="editor-close" onClick={onClose} aria-label="Close">×</button>

        <div className="editor-title">Add a Memory</div>

        {/* Name */}
        <div className="editor-field">
          <label className="editor-label">Your name</label>
          <input
            className="editor-input"
            placeholder="e.g. Anjali, Rohan, Priya..."
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Type picker */}
        <div className="editor-field">
          <label className="editor-label">Type of memory</label>
          <div className="editor-types">
            {[
              { id: "photo", icon: "📷", label: "Photo" },
              { id: "note",  icon: "📝", label: "Note" },
              { id: "video", icon: "🎬", label: "Video" },
            ].map(t => (
              <button key={t.id}
                className={`editor-type-btn${type === t.id ? " active" : ""}`}
                onClick={() => pickType(t.id)}
                disabled={submitting}>
                <span className="editor-type-icon">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Photo */}
        {type === "photo" && (
          <div className="editor-field">
            <label className="editor-label">Photo</label>
            <label className="editor-upload-area"
              onDragOver={e => e.preventDefault()}
              onDrop={handlePhotoDrop}>
              {photoPreview
                ? (
                  <div className={`photo-crop-preview ${photoCrop.mode === "fit" ? "fit-mode" : "crop-mode"}`}>
                    <img
                      src={photoPreview}
                      alt="Crop preview"
                      style={{
                        objectFit: photoCrop.mode === "fit" ? "contain" : "cover",
                        transform: photoCrop.mode === "fit" ? "none" : `scale(${photoCrop.zoom})`,
                        transformOrigin: `${photoCrop.x}% ${photoCrop.y}%`,
                      }}
                    />
                    <div className="photo-crop-frame" />
                  </div>
                )
                : <span>tap to choose · or drag a photo here</span>}
              <input type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoChange} />
            </label>
            {photoPreview && (
              <div className="crop-controls">
                <div className="crop-mode-row">
                  <button
                    type="button"
                    className={photoCrop.mode === "fit" ? "active" : ""}
                    onClick={() => setCropMode("fit")}
                    disabled={submitting}
                  >
                    full image
                  </button>
                  <button
                    type="button"
                    className={photoCrop.mode === "crop" ? "active" : ""}
                    onClick={() => setCropMode("crop")}
                    disabled={submitting}
                  >
                    crop
                  </button>
                </div>
                <label>
                  <span>zoom</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={photoCrop.zoom}
                    onChange={e => setCropValue("zoom", e.target.value)}
                    disabled={photoCrop.mode === "fit" || submitting}
                  />
                </label>
                <label>
                  <span>left / right</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={photoCrop.x}
                    onChange={e => setCropValue("x", e.target.value)}
                    disabled={photoCrop.mode === "fit" || submitting}
                  />
                </label>
                <label>
                  <span>up / down</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={photoCrop.y}
                    onChange={e => setCropValue("y", e.target.value)}
                    disabled={photoCrop.mode === "fit" || submitting}
                  />
                </label>
              </div>
            )}
            <input className="editor-input" placeholder="caption (optional)"
              value={caption} onChange={e => setCaption(e.target.value)} />
          </div>
        )}

        {/* Note */}
        {type === "note" && (
          <div className="editor-field">
            <label className="editor-label">Your message</label>
            <textarea className="editor-textarea"
              placeholder="write your memory, birthday wish, or message..."
              value={noteText} onChange={e => setNoteText(e.target.value)}
              rows={5} />
          </div>
        )}

        {/* Video */}
        {type === "video" && (
          <div className="editor-field">
            <label className="editor-label">Video</label>
            <label className="editor-upload-area">
              {videoFile
                ? <span style={{ fontFamily: "'Caveat', cursive", fontSize: 18 }}>✓ {videoFile.name}</span>
                : <span>tap to choose a video</span>}
              <input type="file" accept="video/*" style={{ display: "none" }}
                onChange={e => setVideoFile(e.target.files[0])} />
            </label>
            <input className="editor-input" placeholder="caption (optional)"
              value={videoCaption} onChange={e => setVideoCaption(e.target.value)} />
          </div>
        )}

        {error && <div className="editor-error">{error}</div>}
        {submitting && submitStatus && <div className="editor-status">{submitStatus}</div>}

        {!db.configured && (
          <div className="editor-error">
            Supabase not connected yet — open <strong>config.js</strong> and fill in your URL + key.
          </div>
        )}

        <button className="editor-submit" onClick={handleSubmit} disabled={submitting || !db.configured}>
          {submitting ? (submitStatus || "adding to the book...") : "add to the book →"}
        </button>
      </div>
    </div>
  );
}
