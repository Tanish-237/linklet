import React from "react";
import MessageBubble from "./MessageBubble";
import MessageActionsToolbar from "../actions/MessageActionsToolbar";
import ReactionPills from "../actions/ReactionPills";

const MessageItem = ({
  msg,
  currentUser,
  chat,
  isRecipientOnline = false,
  readTarget = 2,
  isSelected,
  isSelectionActive,
  isPinned,
  isStarred,
  isSameSenderAsPrev,
  searchQuery,
  isActiveMatch = false,
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
  onRetryFailed,
  onDiscardFailed,
  onJumpToMessage,
}) => {
  const isSent =
    (msg.sender?._id || msg.sender)?.toString() === currentUser?._id?.toString();
  const msgChatId = (msg.chat?._id || msg.chat)?.toString();
  const activeChatId = chat?._id?.toString();
  const isMessageForThisChat = !msgChatId || !activeChatId || msgChatId === activeChatId;

  return (
    <div
      id={`msg-${msg._id}`}
      className={`flex items-center gap-3 w-full relative group ${
        isSameSenderAsPrev ? "mt-[3px] mb-0" : "mt-2.5 mb-0"
      } ${isActiveMatch ? "search-active-match" : ""}`}
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
          {!isSent && chat.isGroup && isMessageForThisChat && !isSameSenderAsPrev && (
            <div className="message-sender-name">{msg.sender?.username}</div>
          )}

          <div
            className={`message-bubble-row flex items-center gap-2 ${
              isSent ? "flex-row-reverse" : "flex-row"
            }`}
          >
            <MessageBubble
              msg={msg}
              isSent={isSent}
              isSelected={isSelected}
              isPinned={isPinned}
              isStarred={isStarred}
              isRecipientOnline={isRecipientOnline}
              readTarget={readTarget}
              searchQuery={searchQuery}
              audioState={audioState}
              isMenuActive={isMenuActive}
              onOpenMenu={onOpenMenu}
              onToggleAudioPlay={onToggleAudioPlay}
              onSeekAudio={onSeekAudio}
              onOpenLightbox={onOpenLightbox}
              onRetryFailed={onRetryFailed}
              onDiscardFailed={onDiscardFailed}
              onJumpToMessage={isSelectionActive ? undefined : onJumpToMessage}
            />

            {/* Standalone Circular WhatsApp Reaction Button */}
            <MessageActionsToolbar
              messageId={msg._id}
              isReactionActive={isReactionActive}
              isMenuActive={isMenuActive}
              onOpenReaction={onOpenReaction}
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

// Memoized: a message row re-renders only when its own props change — not on
// every keystroke in the composer, presence update or new message elsewhere
// in the list. Every callback passed in must therefore be referentially stable.
export default React.memo(MessageItem);
