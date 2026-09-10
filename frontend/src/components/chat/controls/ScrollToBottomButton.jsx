import React from "react";

const ScrollToBottomButton = ({ isVisible, unreadCount = 0, onClick }) => {
  if (!isVisible) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className="scroll-bottom-btn"
      title="Scroll to latest messages"
      aria-label="Scroll to latest messages"
    >
      <span className="material-icons text-xl">keyboard_arrow_down</span>
      {unreadCount > 0 && (
        <span className="scroll-bottom-unread-badge">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </button>
  );
};

export default ScrollToBottomButton;
