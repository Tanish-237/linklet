import React from "react";
import MessageMedia from "./MessageMedia";

export const formatMessageClock = (dateStr) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: true });
  } catch {
    return "";
  }
};

export const renderDeliveryTicks = (msg, isSent, isRecipientOnline = false) => {
  if (!isSent) return null;
  if (msg.status === "sending") {
    return <span className="material-icons tick-sending">schedule</span>;
  }
  if (msg.status === "failed") {
    return (
      <span className="material-icons text-red-400">
        error_outline
      </span>
    );
  }
  const isRead = Boolean(
    msg.isRead ||
    msg.status === "read" ||
    msg.status === "seen" ||
    (msg.readBy && msg.readBy.length > 1)
  );
  const isDelivered = Boolean(
    isRead ||
    msg.status === "delivered" ||
    msg.isDelivered ||
    isRecipientOnline
  );

  const tickClass = isRead ? "tick-read" : isDelivered ? "tick-delivered" : "tick-sent";
  const tickIcon = isRead || isDelivered ? "done_all" : "done";
  const tickTitle = isRead ? "Read" : isDelivered ? "Delivered" : "Sent";

  return (
    <span
      className={`material-icons text-[14px] leading-none ${tickClass}`}
      title={tickTitle}
    >
      {tickIcon}
    </span>
  );
};

const MessageBubble = ({
  msg,
  isSent,
  isSelected,
  isPinned,
  // isStarred is intentionally NOT rendered here — starring is a silent,
  // private save action (no visible badge on the bubble), unlike pinning.
  // Accepted as a prop for API consistency with MessageContextMenu, which
  // does show the Star/Unstar toggle state.
  isStarred: _isStarred,
  isRecipientOnline = false,
  searchQuery,
  audioState,
  isMenuActive,
  onOpenMenu,
  onToggleAudioPlay,
  onSeekAudio,
  onOpenLightbox,
}) => {
  const hasSearchMatch =
    searchQuery &&
    msg.content &&
    msg.content.toLowerCase().includes(searchQuery.toLowerCase());

  // If message has media and no text caption, the media component (audio/image) handles its own inline timestamp
  const showContentRow = !msg.media || Boolean(msg.content);

  return (
    <div
      className={`message-bubble relative group ${
        isSelected ? "ring-2 ring-violet-500/60" : ""
      }`}
    >
      {/* WhatsApp Fixed Top-Right Dropdown Trigger Button (Overlapping, only visible on hover) */}
      {onOpenMenu && (
        <button
          type="button"
          onClick={(e) => onOpenMenu(e, msg._id)}
          className={`msg-bubble-chevron-btn ${isMenuActive ? "active" : ""}`}
          title="Message options"
          aria-label="Message options"
        >
          <span className="material-icons">keyboard_arrow_down</span>
        </button>
      )}

      {/* Reply Preview */}
      {msg.replyTo && (
        <div className="p-2 mb-1.5 rounded bg-black/20 border-l-2 border-violet-400 text-xs text-gray-300">
          <span className="font-bold text-violet-300 block">
            {msg.replyTo.sender?.username || "Replied"}
          </span>
          <span className="truncate block">
            {msg.replyTo.content || "Attachment"}
          </span>
        </div>
      )}

      {/* Media Rendering */}
      <MessageMedia
        msg={msg}
        isSent={isSent}
        isRecipientOnline={isRecipientOnline}
        formatMessageClock={formatMessageClock}
        renderDeliveryTicks={renderDeliveryTicks}
        audioState={audioState}
        onToggleAudioPlay={onToggleAudioPlay}
        onSeekAudio={onSeekAudio}
        onOpenLightbox={onOpenLightbox}
      />

      {/* Message Content & Metadata (For text messages or captions on bottom of media with time on exact bottom right) */}
      {showContentRow && (
        <div className={`message-content-row flex flex-wrap items-end justify-between gap-x-2.5 ${msg.media ? "pt-1.5 px-0.5" : ""}`}>
          {msg.content && (
            <div className="break-words flex-1 min-w-[50px] leading-[1.35] select-text">
              {hasSearchMatch ? (
                <span>
                  {msg.content
                    .split(new RegExp(`(${searchQuery})`, "gi"))
                    .map((part, pIdx) =>
                      part.toLowerCase() === searchQuery.toLowerCase() ? (
                        <mark key={pIdx} className="search-match-highlight">
                          {part}
                        </mark>
                      ) : (
                        part
                      )
                    )}
                </span>
              ) : (
                msg.content
              )}
            </div>
          )}

          {/* Message Metadata & Delivery Ticks (Directly at right, zero trailing space) */}
          <div className="message-meta inline-flex items-center ml-auto flex-shrink-0 select-none self-end">
            {isPinned && (
              <span className="material-icons text-[11px] text-violet-300 mr-1" title="Pinned message">
                push_pin
              </span>
            )}

            {msg.isEdited && <span className="text-[10px] opacity-75 mr-1">(edited)</span>}
            <span
              className="cursor-default text-[11px] opacity-80 whitespace-nowrap"
              title={msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}
            >
              {formatMessageClock(msg.createdAt)}
            </span>
            {isSent && (
              <span className="ml-1.5 flex items-center">
                {renderDeliveryTicks(msg, isSent, isRecipientOnline)}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
