import React from "react";

const ChatHeader = ({
  chat,
  currentUser,
  onlineUsers = [],
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

  const isOnline =
    otherUser &&
    onlineUsers.some(
      (id) => id.toString() === (otherUser._id || otherUser)?.toString()
    );

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
            <div className="chat-header-status flex items-center gap-1">
              {typingUsers.length > 0 ? (
                <span className="text-violet-400 font-medium italic flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                  typing...
                </span>
              ) : chat.isGroup ? (
                <span>{chat.participants?.length || 0} members</span>
              ) : isOnline ? (
                <>
                  <span className="status-dot online" /> Online
                </>
              ) : (
                <>
                  <span className="status-dot offline" /> Offline
                </>
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

        {/* Info Panel Toggle */}
        <button
          type="button"
          onClick={onToggleInfo}
          className="text-gray-400 hover:text-white p-2 rounded-full hover:bg-gray-800/50 transition-colors cursor-pointer"
          title="Chat info"
        >
          <span className="material-icons text-xl">info_outline</span>
        </button>
      </div>
    </div>
  );
};

export default ChatHeader;
