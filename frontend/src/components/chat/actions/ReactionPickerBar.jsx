import React from "react";
import { createPortal } from "react-dom";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const ReactionPickerBar = ({
  activeMessageId,
  position = { top: 0, left: 0 },
  onSelectEmoji,
}) => {
  if (!activeMessageId) return null;

  const barContent = (
    <div
      className="reaction-picker-bar"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectEmoji(activeMessageId, emoji);
          }}
          className="reaction-btn"
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(barContent, document.body)
    : barContent;
};

export default ReactionPickerBar;
