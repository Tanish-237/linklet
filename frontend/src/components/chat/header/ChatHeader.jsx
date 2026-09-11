import React from "react";
import { formatLastSeen } from "../../../utlis/chatDateUtils";

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
            className="md:hidden flex items-center justify-center w-9 h-9 -ml-1 text-gray-300 hover:text-white hover:bg-violet-950/50 active:scale-95 rounded-xl transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500/50"
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
                  "https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
                : otherUser?.avatar ||
                  "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
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

      <div className="chat-header-actions flex items-center gap-2">
        {/* In-chat Search Toggle */}
        <button
          type="button"
          onClick={onToggleSearch}
          className={`p-2 rounded-full transition-colors cursor-pointer ${
            isSearchOpen
              ? "bg-violet-600/30 text-violet-300"
              : "text-gray-400 hover:text-white hover:bg-gray-800/50"
          }`}
          title="Search messages"
        >
          <span className="material-icons text-xl">search</span>
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
