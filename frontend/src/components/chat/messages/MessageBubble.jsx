import React from "react";
import TimeAgo from "../../TimeAgo";
import MessageMedia from "./MessageMedia";

const MessageBubble = ({
  msg,
  isSent,
  isSelected,
  isPinned,
  searchQuery,
  audioState,
  onToggleAudioPlay,
  onSeekAudio,
  onOpenLightbox,
}) => {
  const hasSearchMatch =
    searchQuery &&
    msg.content &&
    msg.content.toLowerCase().includes(searchQuery.toLowerCase());

  return (
    <div
      className={`message-bubble ${
        isSelected ? "ring-2 ring-violet-500/60" : ""
      }`}
    >
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

      {/* Message Content & Search Highlight */}
      {msg.content && (
        <div className="break-words">
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

      {/* Media Rendering */}
      <MessageMedia
        msg={msg}
        audioState={audioState}
        onToggleAudioPlay={onToggleAudioPlay}
        onSeekAudio={onSeekAudio}
        onOpenLightbox={onOpenLightbox}
      />

      {/* Message Metadata & WhatsApp Delivery Ticks */}
      <div className="message-meta">
        {isPinned && (
          <span className="material-icons text-[11px] text-violet-300">
            push_pin
          </span>
        )}
        {msg.isEdited && <span>(edited)</span>}
        <TimeAgo date={msg.createdAt} />
        {isSent && (
          <span>
            {msg.status === "sending" ? (
              <span className="material-icons tick-sending">schedule</span>
            ) : msg.status === "failed" ? (
              <span className="material-icons text-red-400 text-xs">
                error_outline
              </span>
            ) : (
              <span
                className={`material-icons text-xs ${
                  msg.readBy?.length > 1 ? "tick-read" : "tick-sent"
                }`}
              >
                {msg.readBy?.length > 1 ? "done_all" : "done"}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
};

export default MessageBubble;
