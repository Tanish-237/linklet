import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { downloadFile } from "../../../utlis/download";

const MediaLightboxModal = ({ media, onClose, onShowInChat }) => {
  useEffect(() => {
    if (!media) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media, onClose]);

  if (!media) return null;

  // Straight from the tap: phones drop a download started after an await
  // (the old fetch-to-blob), and Cloudinary's attachment URL saves the file
  // without leaving the page.
  const handleDownload = (e) => {
    e.stopPropagation();
    downloadFile(media.url);
  };

  // Portalled to <body>: the chat container uses backdrop-filter, which makes
  // it the containing block for position:fixed descendants — rendered in place,
  // the "full-screen" lightbox was clipped to the chat area.
  return createPortal(
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
        {onShowInChat && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onShowInChat();
            }}
            className="lightbox-action-btn"
            title="Show in chat"
            aria-label="Show in chat"
          >
            <span className="material-icons text-xl">forum</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleDownload}
          className="lightbox-action-btn"
          title="Download media"
          aria-label="Download media"
        >
          <span className="material-icons text-xl">
            download
          </span>
        </button>
        <button
          type="button"
          onClick={onClose}
          className="lightbox-action-btn"
          title="Close lightbox"
          aria-label="Close lightbox"
        >
          <span className="material-icons text-xl">close</span>
        </button>
      </div>

      {media.type === "video" ? (
        <video
          src={media.url}
          controls
          autoPlay
          className="lightbox-content"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <img
          src={media.url}
          alt="Lightbox"
          className="lightbox-content"
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>,
    document.body
  );
};

export default MediaLightboxModal;
