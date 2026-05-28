/* ============================================================
   editor.jsx — "Add a memory" panel
   ============================================================ */

function Editor({ onClose, onAdd }) {
  const [name,       setName]       = React.useState("");
  const [type,       setType]       = React.useState(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [error,      setError]      = React.useState(null);

  // Photo
  const [photoFile,    setPhotoFile]    = React.useState(null);
  const [photoPreview, setPhotoPreview] = React.useState(null);
  const [photoSize,    setPhotoSize]    = React.useState(null);
  const [photoCrop,    setPhotoCrop]    = React.useState({ zoom: 1, x: 50, y: 50 });
  const [caption,      setCaption]      = React.useState("");

  // Note
  const [noteText, setNoteText] = React.useState("");

  // Voice
  const [recording, setRecording] = React.useState(false);
  const [voiceBlob, setVoiceBlob] = React.useState(null);
  const [voiceUrl,  setVoiceUrl]  = React.useState(null);
  const mediaRecRef = React.useRef(null);
  const chunksRef   = React.useRef([]);

  // Video
  const [videoFile,    setVideoFile]    = React.useState(null);
  const [videoCaption, setVideoCaption] = React.useState("");

  const setCropValue = (key, value) => {
    setPhotoCrop(prev => ({ ...prev, [key]: Number(value) }));
  };

  const selectPhotoFile = (file) => {
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);

    if (photoPreview) URL.revokeObjectURL(photoPreview);

    setPhotoFile(file);
    setPhotoPreview(previewUrl);
    setPhotoSize(null);
    setPhotoCrop({ zoom: 1, x: 50, y: 50 });

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

  const createCroppedPhoto = () => new Promise((resolve, reject) => {
    if (!photoFile || !photoSize) {
      resolve(photoFile);
      return;
    }

    const targetAspect = 1 / 0.82;
    const sourceAspect = photoSize.width / photoSize.height;
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

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = Math.round(canvas.width / targetAspect);
      const ctx = canvas.getContext("2d");

      ctx.drawImage(
        img,
        sourceX, sourceY, cropWidth, cropHeight,
        0, 0, canvas.width, canvas.height
      );

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Could not crop the photo. Try another image."));
          return;
        }

        resolve(new File([blob], "jambook-photo.jpg", { type: "image/jpeg" }));
      }, "image/jpeg", 0.9);
    };
    img.onerror = () => reject(new Error("Could not load the photo for cropping."));
    img.src = photoPreview;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecRef.current = new MediaRecorder(stream);
      chunksRef.current = [];
      mediaRecRef.current.ondataavailable = e => chunksRef.current.push(e.data);
      mediaRecRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setVoiceBlob(blob);
        setVoiceUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecRef.current.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied. Check your browser permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecRef.current) {
      mediaRecRef.current.stop();
      setRecording(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    if (!name.trim()) { setError("Tell us your name first."); return; }
    if (!type)        { setError("Pick what kind of memory you're adding."); return; }

    setSubmitting(true);
    try {
      let content = {};

      if (type === "photo") {
        if (!photoFile) { setError("Choose a photo first."); setSubmitting(false); return; }
        const croppedPhoto = await createCroppedPhoto();
        const url = await db.uploadMedia(croppedPhoto, "photos");
        content = { url, caption };
      } else if (type === "note") {
        if (!noteText.trim()) { setError("Write something first."); setSubmitting(false); return; }
        content = { text: noteText };
      } else if (type === "voice") {
        if (!voiceBlob) { setError("Record something first."); setSubmitting(false); return; }
        const url = await db.uploadBlob(voiceBlob, "voices", "webm");
        content = { url };
      } else if (type === "video") {
        if (!videoFile) { setError("Choose a video first."); setSubmitting(false); return; }
        const url = await db.uploadMedia(videoFile, "videos");
        content = { url, caption: videoCaption };
      }

      const memory = await db.addMemory({ type, content, contributor_name: name.trim() });
      onAdd(memory);
    } catch (err) {
      setError(err.message || "Something went wrong. Try again.");
      console.error(err);
    } finally {
      setSubmitting(false);
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
              { id: "voice", icon: "🎙",  label: "Voice" },
              { id: "video", icon: "🎬", label: "Video" },
            ].map(t => (
              <button key={t.id}
                className={`editor-type-btn${type === t.id ? " active" : ""}`}
                onClick={() => pickType(t.id)}>
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
                  <div className="photo-crop-preview">
                    <img
                      src={photoPreview}
                      alt="Crop preview"
                      style={{
                        transform: `scale(${photoCrop.zoom})`,
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
                <label>
                  <span>zoom</span>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.05"
                    value={photoCrop.zoom}
                    onChange={e => setCropValue("zoom", e.target.value)}
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

        {/* Voice */}
        {type === "voice" && (
          <div className="editor-field">
            <label className="editor-label">Voice note</label>
            {!voiceUrl ? (
              <button
                className={`editor-record-btn${recording ? " recording" : ""}`}
                onClick={recording ? stopRecording : startRecording}>
                {recording ? "⏹ tap to stop" : "⏺ tap to record"}
              </button>
            ) : (
              <div className="editor-voice-done">
                <audio src={voiceUrl} controls style={{ width: "100%" }} />
                <button className="editor-redo"
                  onClick={() => { setVoiceBlob(null); setVoiceUrl(null); }}>
                  record again
                </button>
              </div>
            )}
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

        {!db.configured && (
          <div className="editor-error">
            Supabase not connected yet — open <strong>config.js</strong> and fill in your URL + key.
          </div>
        )}

        <button className="editor-submit" onClick={handleSubmit} disabled={submitting || !db.configured}>
          {submitting ? "adding to the book..." : "add to the book →"}
        </button>
      </div>
    </div>
  );
}
