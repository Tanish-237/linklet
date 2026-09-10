import React from "react";
import MessageBubble from "./MessageBubble";
import MessageActionsToolbar from "../actions/MessageActionsToolbar";
import ReactionPills from "../actions/ReactionPills";

const MessageItem = ({
  msg,
  currentUser,
  chat,
  isSelected,
  isSelectionActive,
  isPinned,
  searchQuery,
  audioState,
  isMenuActive,
  isReactionActive,
  onToggleSelect,
  onOpenReaction,
  onOpenMenu,
  onToggleReaction,
  onToggleAudioPlay,
  onSeekAudio,
  onOpenLightbox,
}) => {
  const isSent =
    (msg.sender?._id || msg.sender)?.toString() === currentUser?._id?.toString();

  return (
    <div
      id={`msg-${msg._id}`}
      className="flex items-center gap-3 w-full my-1 relative group"
      onClick={() => {
        if (isSelectionActive) {
          onToggleSelect(msg._id);
        }
      }}
    >
      {/* Selection Checkbox */}
      {isSelectionActive && (
        <div
          className="flex-shrink-0 flex items-center justify-center cursor-pointer pl-1"
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect(msg._id);
          }}
        >
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {}}
            className="glass-checkbox"
          />
        </div>
      )}

      <div className={`flex-1 flex ${isSent ? "justify-end" : "justify-start"}`}>
        <div className={`message-bubble-wrapper ${isSent ? "sent" : "received"}`}>
          {!isSent && chat.isGroup && (
            <div className="message-sender-name">{msg.sender?.username}</div>
          )}

          <div
            className={`message-bubble-row flex items-start gap-1.5 ${
              isSent ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <MessageBubble
              msg={msg}
              isSent={isSent}
              isSelected={isSelected}
              isPinned={isPinned}
              searchQuery={searchQuery}
              audioState={audioState}
              onToggleAudioPlay={onToggleAudioPlay}
              onSeekAudio={onSeekAudio}
              onOpenLightbox={onOpenLightbox}
            />

            {/* Hover Action Toolbar */}
            <MessageActionsToolbar
              messageId={msg._id}
              isMenuActive={isMenuActive}
              isReactionActive={isReactionActive}
              onOpenReaction={onOpenReaction}
              onOpenMenu={onOpenMenu}
            />
          </div>

          {/* Reaction Pills Container */}
          <ReactionPills
            reactions={msg.reactions}
            currentUserId={currentUser?._id}
            isSent={isSent}
            onToggleReaction={(emoji) => onToggleReaction(msg._id, emoji)}
          />
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
