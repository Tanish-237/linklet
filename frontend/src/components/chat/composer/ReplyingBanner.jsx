import React from "react";

const ReplyingBanner = ({ replyingTo, onCancelReply }) => {
  if (!replyingTo) return null;

  return (
    <div className="reply-preview-bar">
      <div className="reply-preview-content">
        <span className="material-icons text-violet-400 text-sm">reply</span>
        <div className="flex-1 min-w-0">
          <span className="reply-preview-sender">
            {replyingTo.sender?.username || "Replying"}
          </span>
          <span className="reply-preview-text truncate">
            {replyingTo.content || "Attachment"}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onCancelReply}
        className="reply-preview-close"
        title="Cancel reply"
      >
        <span className="material-icons text-sm">close</span>
      </button>
    </div>
  );
};

export default ReplyingBanner;
