import React from "react";

const MessageActionsToolbar = ({
  messageId,
  isMenuActive,
  isReactionActive,
  onOpenReaction,
  onOpenMenu,
}) => {
  const isToolbarActive = isMenuActive || isReactionActive;

  return (
    <div
      className={`msg-actions-toolbar flex items-center gap-0.5 self-start mt-1 transition-all duration-150 ${
        isToolbarActive
          ? "opacity-100 scale-100 pointer-events-auto"
          : "opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto"
      }`}
    >
      <button
        type="button"
        className={`msg-action-btn ${isReactionActive ? "active" : ""}`}
        onClick={(e) => onOpenReaction(e, messageId)}
        title="React"
        aria-label="React to message"
      >
        <span className="text-sm select-none leading-none">😊</span>
      </button>
      <button
        type="button"
        className={`msg-action-btn ${isMenuActive ? "active" : ""}`}
        onClick={(e) => onOpenMenu(e, messageId)}
        title="Message options"
        aria-label="Message options"
      >
        <span className="material-icons text-base">keyboard_arrow_down</span>
      </button>
    </div>
  );
};

export default MessageActionsToolbar;
