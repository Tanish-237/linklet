import React from "react";
import MessageBubble from "./MessageBubble";
import MessageActionsToolbar from "../actions/MessageActionsToolbar";
import ReactionPills from "../actions/ReactionPills";

const MessageItem = ({
  msg,
  currentUser,
  chat,
  onlineUsers = [],
  isSelected,
  isSelectionActive,
  isPinned,
  isStarred,
  isSameSenderAsPrev,
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
  const msgChatId = (msg.chat?._id || msg.chat)?.toString();
  const activeChatId = chat?._id?.toString();
  const isMessageForThisChat = !msgChatId || !activeChatId || msgChatId === activeChatId;

  // Determine if recipient is online on the website for 1-on-1 chats (or if any recipient is online in group)
  const isRecipientOnline = React.useMemo(() => {
    if (!chat || !onlineUsers || onlineUsers.length === 0) return false;
    if (!chat.isGroup && Array.isArray(chat.participants)) {
      const recipient = chat.participants.find(
        (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
      );
      const recipientId = (recipient?._id || recipient)?.toString();
      return recipientId ? onlineUsers.includes(recipientId) : false;
    }
    if (chat.isGroup && Array.isArray(chat.participants)) {
      return chat.participants.some((p) => {
        const pid = (p._id || p)?.toString();
        return pid && pid !== currentUser?._id?.toString() && onlineUsers.includes(pid);
      });
    }
    return false;
  }, [chat, onlineUsers, currentUser?._id]);

  return (
    <div
      id={`msg-${msg._id}`}
      className={`flex items-center gap-3 w-full relative group ${
        isSameSenderAsPrev ? "mt-[3px] mb-0" : "mt-2.5 mb-0"
      }`}
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
              searchQuery={searchQuery}
              audioState={audioState}
              isMenuActive={isMenuActive}
              onOpenMenu={onOpenMenu}
              onToggleAudioPlay={onToggleAudioPlay}
              onSeekAudio={onSeekAudio}
              onOpenLightbox={onOpenLightbox}
            />

            {/* Standalone Circular WhatsApp Reaction Button */}
            <MessageActionsToolbar
              messageId={msg._id}
              isReactionActive={isReactionActive}
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

export default MessageItem;
