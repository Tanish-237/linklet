import React from "react";

const MediaLightboxModal = ({ media, onClose }) => {
  if (!media) return null;

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <div className="absolute top-6 right-6 flex items-center gap-4 z-50">
        <a
          href={media.url}
          download
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-white transition-colors cursor-pointer"
          title="Download media"
        >
          <span className="material-icons text-xl">download</span>
        </a>
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 text-white transition-colors cursor-pointer"
          title="Close lightbox"
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
    </div>
  );
};

export default MediaLightboxModal;
