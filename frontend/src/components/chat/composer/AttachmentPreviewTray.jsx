import React from "react";

const AttachmentPreviewTray = ({ previews = [], onRemoveFile }) => {
  if (!previews || previews.length === 0) return null;

  return (
    <div className="attachment-preview-tray">
      {previews.map((file, idx) => (
        <div key={idx} className="attachment-preview-chip">
          {file.type === "image" ? (
            <img
              src={file.url}
              alt="Preview"
              className="attachment-preview-thumb"
            />
          ) : file.type === "video" ? (
            <div className="attachment-preview-video">
              <span className="material-icons text-white text-lg">
                videocam
              </span>
            </div>
          ) : file.type === "audio" ? (
            <div className="attachment-preview-doc">
              <span className="material-icons text-violet-400 text-lg">
                audiotrack
              </span>
            </div>
          ) : (
            <div className="attachment-preview-doc">
              <span className="material-icons text-violet-400 text-lg">
                description
              </span>
            </div>
          )}

          <div className="flex-1 min-w-0 pr-1">
            <div className="text-[11px] font-medium text-gray-200 truncate">
              {file.name}
            </div>
            <div className="text-[9px] text-gray-400">{file.size}</div>
          </div>

          <button
            type="button"
            onClick={() => onRemoveFile(idx)}
            className="attachment-preview-remove"
            title="Remove attachment"
          >
            <span className="material-icons text-xs">close</span>
          </button>
        </div>
      ))}
    </div>
  );
};

export default AttachmentPreviewTray;
