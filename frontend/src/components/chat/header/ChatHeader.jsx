import React from "react";
import { formatLastSeen } from "../../../utlis/chatDateUtils";
import defaultAvatar from "../../../assets/default-avatar.webp";
import defaultGroupAvatar from "../../../assets/default-group.svg";

const ChatHeader = ({
  chat,
  currentUser,
  onlineUsers = [],
  lastSeenMap = {},
  typingUsers = [],
  onToggleInfo,
  onBackToSidebar,
  isSearchOpen,
  onToggleSearch,
}) => {
  const otherUser = chat.isGroup
    ? null
    : chat.participants?.find(
        (p) => (p._id || p)?.toString() !== currentUser?._id?.toString()
      );

  const otherUserId = (otherUser?._id || otherUser)?.toString();
  const isOnline =
    otherUserId &&
    onlineUsers.some((id) => id.toString() === otherUserId);

  const userLastSeen = otherUserId
    ? lastSeenMap[otherUserId] || otherUser?.lastSeen
    : null;

  return (
    <div className="chat-header">
      <div className="flex items-center gap-3">
        {/* Mobile back button */}
        {onBackToSidebar && (
          <button
            type="button"
            id="chat-back-to-sidebar-btn"
            onClick={onBackToSidebar}
            className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 text-gray-300 hover:text-fg hover:bg-violet-950/50 active:scale-95 rounded-xl transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
            title="Back to all chats"
            aria-label="Back to all chats"
          >
            <span className="material-icons text-2xl">arrow_back</span>
          </button>
        )}

        <div
          onClick={onToggleInfo}
          className="chat-header-user cursor-pointer hover:opacity-90 transition-opacity"
        >
          <img
            src={
              chat.isGroup
                ? chat.groupImage ||
                  defaultGroupAvatar
                : otherUser?.avatar ||
                  defaultAvatar
            }
            alt="Avatar"
            className="w-10 h-10 rounded-full border border-violet-500/30 object-cover"
          />
          <div>
            <div className="chat-header-name">
              {chat.isGroup ? chat.chatName : otherUser?.username}
            </div>
            <div className="chat-header-status flex items-center gap-1 text-xs">
              {typingUsers.length > 0 ? (
                <span className="text-emerald-400 font-medium italic flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {chat.isGroup
                    ? `${typingUsers[0]} is typing...`
                    : "typing..."}
                </span>
              ) : chat.isGroup ? (
                <span className="text-gray-400">
                  {chat.participants?.length || 0} members
                </span>
              ) : isOnline ? (
                <span className="text-emerald-400 font-medium">online</span>
              ) : (
                <span className="text-gray-400">
                  {formatLastSeen(userLastSeen)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="chat-header-actions flex items-center gap-1">
        <button
          type="button"
          onClick={onToggleSearch}
          className="chat-header-icon-btn"
          aria-pressed={Boolean(isSearchOpen)}
          aria-label="Search in this chat"
          title="Search messages"
        >
          <span className="material-icons">search</span>
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
