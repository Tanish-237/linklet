import React from "react";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

const ReactionPickerBar = ({
  activeMessageId,
  position = { top: 0, left: 0 },
  onSelectEmoji,
}) => {
  if (!activeMessageId) return null;

  return (
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
};

export default ReactionPickerBar;
