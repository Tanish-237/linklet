import React from "react";

const EditingBanner = ({ editingMessage, onCancelEdit }) => {
  if (!editingMessage) return null;

  return (
    <div className="reply-preview-bar border-violet-500/30">
      <div className="reply-preview-content">
        <span className="material-icons text-amber-400 text-sm">edit</span>
        <div className="flex-1 min-w-0">
          <span className="reply-preview-sender text-amber-300">
            Editing Message
          </span>
          <span className="reply-preview-text truncate">
            {editingMessage.content}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancelEdit}
        className="reply-preview-close"
        title="Cancel edit"
      >
        <span className="material-icons text-sm">close</span>
      </button>
    </div>
  );
};

export default EditingBanner;
