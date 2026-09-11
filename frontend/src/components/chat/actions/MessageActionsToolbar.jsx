import React from "react";

const MessageActionsToolbar = ({
  messageId,
  isReactionActive,
  onOpenReaction,
}) => {
  return (
    <button
      type="button"
      className={`msg-reaction-circle-btn ${
        isReactionActive
          ? "active opacity-100 scale-100"
          : "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100 pointer-events-none group-hover:pointer-events-auto"
      }`}
      onClick={(e) => onOpenReaction(e, messageId)}
      title="React"
      aria-label="React to message"
    >
      <span className="material-icons">sentiment_satisfied_alt</span>
    </button>
  );
};

export default MessageActionsToolbar;
