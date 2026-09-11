import React from "react";

const ReplyingBanner = ({ replyingTo, onCancelReply }) => {
  if (!replyingTo) return null;

  const senderName =
    replyingTo.sender?.fullName ||
    replyingTo.sender?.username ||
    "Replying";

  const previewText =
    replyingTo.content ||
    (replyingTo.mediaType ? `[${replyingTo.mediaType}]` : "Attachment");

  return (
    <div className="reply-preview-bar">
      <div className="reply-preview-left-bar" />
      <div className="reply-preview-content">
        <span className="reply-preview-sender">{senderName}</span>
        <span className="reply-preview-text">{previewText}</span>
      </div>
      <button
        type="button"
        onClick={onCancelReply}
        className="reply-preview-close"
        title="Cancel reply"
        aria-label="Cancel reply"
      >
        <span className="material-icons">close</span>
      </button>
    </div>
  );
};

export default ReplyingBanner;
