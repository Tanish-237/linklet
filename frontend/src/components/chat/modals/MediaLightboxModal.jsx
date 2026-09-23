import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

const MediaLightboxModal = ({ media, onClose, onShowInChat }) => {
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!media) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [media, onClose]);

  if (!media) return null;

  const handleDownload = async (e) => {
    e.stopPropagation();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      // A plain <a download> is ignored by browsers for cross-origin URLs
      // (e.g. Cloudinary), which just navigates to the file instead of
      // saving it. Fetching as a blob and downloading that forces an
      // actual save regardless of the resource's origin.
      const response = await fetch(media.url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = media.url.split("/").pop()?.split("?")[0] || "download";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(media.url, "_blank", "noopener,noreferrer");
    } finally {
      setIsDownloading(false);
    }
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
          disabled={isDownloading}
          className="lightbox-action-btn"
          title="Download media"
          aria-label="Download media"
        >
          <span className="material-icons text-xl">
            {isDownloading ? "hourglass_top" : "download"}
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
