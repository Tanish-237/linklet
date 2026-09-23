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

// Search terms are user input — escape them before building a RegExp, or
// typing "(" or "?" into in-chat search throws and takes the chat down.
const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * `readTarget` is how many readBy entries mean "read": 2 in a DM (sender +
 * recipient), every participant in a group — blue ticks once everyone has
 * read it, not as soon as the first member does.
 */
export const renderDeliveryTicks = (msg, isSent, isRecipientOnline = false, readTarget = 2) => {
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
    (msg.readBy && msg.readBy.length >= Math.max(2, readTarget))
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
  readTarget = 2,
  searchQuery,
  audioState,
  isMenuActive,
  onOpenMenu,
  onToggleAudioPlay,
  onSeekAudio,
  onOpenLightbox,
  onRetryFailed,
  onDiscardFailed,
}) => {
  const renderTicks = (m, sent, online) => renderDeliveryTicks(m, sent, online, readTarget);
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

      {/* Reply Preview — the bubble it sits in is either the solid accent
          color (sent) or the theme's surface color (received), so this
          quote needs its own contrast per case rather than one fixed
          dark-on-dark styling that only worked on a dark canvas. */}
      {msg.replyTo && (
        <div
          className={`p-2 mb-1.5 rounded border-l-2 text-xs ${
            isSent
              ? "bg-white/15 border-white/70 text-white/90"
              : "bg-fg/6 border-accent text-fg-secondary"
          }`}
        >
          <span className={`font-bold block ${isSent ? "text-white" : "text-accent-fg"}`}>
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
        renderDeliveryTicks={renderTicks}
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
                    .split(new RegExp(`(${escapeRegExp(searchQuery)})`, "gi"))
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
              <span className="material-icons msg-pin-icon" title="Pinned message" aria-label="Pinned">
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
                {renderTicks(msg, isSent, isRecipientOnline)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Failed send: say so and offer the fix, instead of a bare red icon */}
      {isSent && msg.status === "failed" && (onRetryFailed || onDiscardFailed) && (
        <div className="msg-failed-row" role="alert">
          <span className="material-icons text-[14px]">error_outline</span>
          <span>Not sent</span>
          {onRetryFailed && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onRetryFailed(msg); }}>
              Retry
            </button>
          )}
          {onDiscardFailed && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onDiscardFailed(msg); }}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
