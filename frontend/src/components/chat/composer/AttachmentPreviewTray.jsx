import React from "react";

const AttachmentPreviewTray = ({ previews = [], filePreviews, onRemoveFile }) => {
  const items = filePreviews || previews || [];
  if (!items || items.length === 0) return null;

  return (
    <div className="attachment-preview-tray">
      {items.map((file, idx) => {
        const isImage = file.type === "image";

        if (isImage) {
          return (
            <div
              key={idx}
              className="attachment-preview-card attachment-preview-img-card group"
              title={file.name}
            >
              <img
                src={file.url}
                alt={file.name || "Preview"}
                className="attachment-preview-img"
              />
              <div className="attachment-preview-info-overlay">
                <span className="attachment-preview-filename">{file.name}</span>
                <span className="attachment-preview-filesize">{file.size}</span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveFile(idx);
                }}
                className="attachment-remove-btn"
                title="Remove attachment"
                aria-label="Remove attachment"
              >
                <span className="material-icons">close</span>
              </button>
            </div>
          );
        }

        return (
          <div
            key={idx}
            className="attachment-preview-card attachment-preview-doc-card group"
            title={file.name}
          >
            <div className="attachment-doc-icon-wrapper">
              <span className="material-icons">
                {file.type === "video"
                  ? "videocam"
                  : file.type === "audio"
                  ? "audiotrack"
                  : "description"}
              </span>
            </div>
            <div className="attachment-doc-meta">
              <span className="attachment-doc-name">{file.name}</span>
              <span className="attachment-doc-sub">
                {file.size} {file.type ? `• ${file.type.toUpperCase()}` : ""}
              </span>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemoveFile(idx);
              }}
              className="attachment-doc-remove-btn"
              title="Remove attachment"
              aria-label="Remove attachment"
            >
              <span className="material-icons">close</span>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default AttachmentPreviewTray;
