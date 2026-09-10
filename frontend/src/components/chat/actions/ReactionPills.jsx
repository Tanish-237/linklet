import React from "react";

const ReactionPills = ({ reactions = [], currentUserId, isSent, onToggleReaction }) => {
  if (!reactions || reactions.length === 0) return null;

  const reactionCounts = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className={`reaction-pills-container flex flex-wrap gap-1 mt-1 ${
        isSent ? "justify-end" : "justify-start"
      }`}
    >
      {Object.entries(reactionCounts).map(([emoji, count]) => {
        const userReacted = reactions.some(
          (r) =>
            (r.user?._id || r.user)?.toString() === currentUserId?.toString() &&
            r.emoji === emoji
        );

        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleReaction(emoji);
            }}
            className={`reaction-pill ${userReacted ? "user-reacted" : ""}`}
            title="Click to toggle reaction"
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        );
      })}
    </div>
  );
};

export default ReactionPills;
