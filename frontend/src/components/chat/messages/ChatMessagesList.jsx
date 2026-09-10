import React from "react";
import MessageItem from "./MessageItem";
import DateSeparator, { formatMessageDate } from "./DateSeparator";

const ChatMessagesList = ({
  messages = [],
  currentUser,
  chat,
  loadingInitial,
  loadingOlder,
  hasMore,
  onLoadOlder,
  onScroll,
  chatContainerRef,
  messagesEndRef,
  selectedMessageIds = [],
  activeMenuMessageId,
  activeReactionMessageId,
  searchQuery,
  audioPlaybackState = {},
  onToggleSelect,
  onOpenReaction,
  onOpenMenu,
  onToggleReaction,
  onToggleAudioPlay,
  onSeekAudio,
  onOpenLightbox,
}) => {
  return (
    <div
      className="chat-messages"
      ref={chatContainerRef}
      onScroll={onScroll}
    >
      {/* Load older messages loader / button */}
      {loadingOlder && (
        <div className="flex justify-center py-2 text-violet-400 text-xs items-center gap-1.5 animate-pulse">
          <span className="material-icons text-sm animate-spin">sync</span>
          <span>Loading older messages...</span>
        </div>
      )}
      {hasMore && !loadingOlder && (
        <div className="flex justify-center py-1.5">
          <button
            type="button"
            onClick={() => onLoadOlder(chatContainerRef.current)}
            className="text-xs text-violet-400 hover:text-violet-300 bg-violet-950/40 hover:bg-violet-900/40 px-3 py-1 rounded-full transition-colors border border-violet-800/40 cursor-pointer"
          >
            Load older messages
          </button>
        </div>
      )}

      {/* Shimmer skeleton or empty state */}
      {loadingInitial && messages.length === 0 ? (
        <div className="flex flex-col gap-4 p-4">
          <div className="skeleton-bubble w-48 h-12 self-start" />
          <div className="skeleton-bubble w-64 h-16 self-end" />
          <div className="skeleton-bubble w-56 h-12 self-start" />
        </div>
      ) : messages.length === 0 ? (
        <div className="chat-empty-state">
          <span className="material-icons chat-empty-icon">chat</span>
          <p className="font-semibold text-lg">No messages yet</p>
          <p className="text-sm">Send a message to start the conversation!</p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isSelected = selectedMessageIds.includes(msg._id);
          const isSelectionActive = selectedMessageIds.length > 0;

          // Date separator check
          const currentDate = formatMessageDate(msg.createdAt);
          const prevDate =
            index > 0 ? formatMessageDate(messages[index - 1]?.createdAt) : null;
          const showDateSeparator = currentDate && currentDate !== prevDate;

          const isPinned = chat.pinnedMessages?.some(
            (p) => (p._id || p).toString() === msg._id?.toString()
          );

          const audioState = audioPlaybackState[msg._id] || {
            isPlaying: false,
            currentTime: 0,
            duration: 0,
          };

          return (
            <React.Fragment key={msg._id || index}>
              {showDateSeparator && <DateSeparator dateLabel={currentDate} />}

              <MessageItem
                msg={msg}
                currentUser={currentUser}
                chat={chat}
                isSelected={isSelected}
                isSelectionActive={isSelectionActive}
                isPinned={isPinned}
                searchQuery={searchQuery}
                audioState={audioState}
                isMenuActive={activeMenuMessageId === msg._id}
                isReactionActive={activeReactionMessageId === msg._id}
                onToggleSelect={onToggleSelect}
                onOpenReaction={onOpenReaction}
                onOpenMenu={onOpenMenu}
                onToggleReaction={onToggleReaction}
                onToggleAudioPlay={onToggleAudioPlay}
                onSeekAudio={onSeekAudio}
                onOpenLightbox={onOpenLightbox}
              />
            </React.Fragment>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatMessagesList;
