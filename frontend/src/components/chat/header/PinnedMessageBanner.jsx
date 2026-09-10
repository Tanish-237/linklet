import React from "react";

const PinnedMessageBanner = ({ pinnedMessage, onJumpToPinned, onUnpin }) => {
  if (!pinnedMessage) return null;

  return (
    <div className="pinned-messages-bar">
      <div className="pinned-msg-content" onClick={onJumpToPinned}>
        <span className="material-icons text-violet-400 text-base">push_pin</span>
        <div className="text-xs text-gray-300 truncate">
          <span className="font-semibold text-violet-300">
            {pinnedMessage.sender?.username || "Pinned"}:{" "}
          </span>
          <span>{pinnedMessage.content || "Media Attachment"}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={onUnpin}
        className="text-gray-400 hover:text-red-400 p-1 cursor-pointer"
        title="Unpin message"
      >
        <span className="material-icons text-sm">close</span>
      </button>
    </div>
  );
};

export default PinnedMessageBanner;
