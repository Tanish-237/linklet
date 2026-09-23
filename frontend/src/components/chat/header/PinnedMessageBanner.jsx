import React, { useEffect, useState } from "react";

const previewText = (msg) => {
  if (!msg) return "Pinned message";
  if (msg.content) return msg.content;
  switch (msg.mediaType) {
    case "image":
      return "Photo";
    case "video":
      return "Video";
    case "audio":
      return "Voice message";
    case "document":
      return "Document";
    default:
      return "Pinned message";
  }
};

/**
 * Pinned-messages strip. With several pins it shows which one you're on and
 * cycles through them, newest first: clicking jumps to the shown pin and then
 * moves on to the next-older one (the WhatsApp pattern), so every pin is
 * reachable from the banner.
 */
const PinnedMessageBanner = ({ pinnedMessages = [], onJumpToPinned, onUnpin }) => {
  const count = pinnedMessages.length;
  // Index into pinnedMessages (oldest→newest); start on the newest.
  const [index, setIndex] = useState(count - 1);

  useEffect(() => {
    setIndex((i) => (count === 0 ? -1 : i < 0 || i >= count ? count - 1 : i));
  }, [count]);

  // A pin was added: show it.
  const newestId = pinnedMessages[count - 1]?._id;
  useEffect(() => {
    if (count > 0) setIndex(count - 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newestId]);

  if (count === 0 || index < 0) return null;
  const current = pinnedMessages[Math.min(index, count - 1)];
  const position = count - Math.min(index, count - 1); // 1 = newest

  const handleClick = () => {
    onJumpToPinned(current._id);
    if (count > 1) setIndex((i) => (i - 1 + count) % count);
  };

  return (
    <div className="pinned-messages-bar">
      {count > 1 && (
        <div className="pinned-progress" aria-hidden="true">
          {pinnedMessages.map((p, i) => (
            <span key={p._id} className={i === index ? "is-current" : ""} />
          ))}
        </div>
      )}
      <button type="button" className="pinned-msg-content" onClick={handleClick} title="Go to pinned message">
        <span className="material-icons icon-filled pinned-icon" aria-hidden="true">push_pin</span>
        <span className="min-w-0 flex flex-col text-left">
          <span className="pinned-label">
            {count > 1 ? `Pinned message ${position} of ${count}` : "Pinned message"}
          </span>
          <span className="pinned-text">
            {current.sender?.username && <strong>{current.sender.username}: </strong>}
            {previewText(current)}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => onUnpin(current._id)}
        className="pinned-unpin-btn"
        title="Unpin this message"
        aria-label="Unpin this message"
      >
        <span className="material-icons">close</span>
      </button>
    </div>
  );
};

export default PinnedMessageBanner;
