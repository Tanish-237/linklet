import React, { useState, useEffect } from "react";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";
import TimeAgo from "./TimeAgo";

const ChatSidebar = ({
  chats,
  activeChat,
  onSelectChat,
  onOpenCreateGroup,
  currentUser,
  onlineUsers = [],
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [userSearchResults, setUserSearchResults] = useState([]);

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.trim().length >= 2) {
      try {
        const res = await apiClient.get(`/chat/search?query=${query}`);
        if (res.data.success) {
          setUserSearchResults(res.data.data);
        }
      } catch (error) {
        console.error("Failed to search users:", error);
      }
    } else {
      setUserSearchResults([]);
    }
  };

  const startDirectChat = async (targetUserId) => {
    try {
      const res = await apiClient.post("/chat", { userId: targetUserId });
      if (res.data.success) {
        onSelectChat(res.data.data);
        setSearchQuery("");
        setUserSearchResults([]);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to start chat");
    }
  };

  const getChatDisplayName = (chat) => {
    if (chat.isGroup) return chat.chatName;
    const otherUser = chat.participants?.find((p) => p._id !== currentUser?._id);
    return otherUser ? otherUser.username : "User";
  };

  const getChatDisplayAvatar = (chat) => {
    if (chat.isGroup) {
      return (
        chat.groupImage ||
        "https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
      );
    }
    const otherUser = chat.participants?.find((p) => p._id !== currentUser?._id);
    return (
      otherUser?.avatar ||
      "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
    );
  };

  const isUserOnline = (chat) => {
    if (chat.isGroup) return false;
    const otherUser = chat.participants?.find(
      (p) => p._id?.toString() !== currentUser?._id?.toString()
    );
    return otherUser
      ? onlineUsers.some((id) => id.toString() === otherUser._id?.toString())
      : false;
  };

  return (
    <div className="chat-sidebar">
      {/* Header */}
      <div className="chat-sidebar-header">
        <h2 className="chat-sidebar-title">Messages</h2>
        <div className="chat-sidebar-actions">
          <button
            onClick={onOpenCreateGroup}
            className="chat-icon-btn"
            title="Create New Group"
          >
            <span className="material-icons text-xl">group_add</span>
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="chat-search-box">
        <div className="chat-input-wrapper">
          <span className="material-icons chat-search-icon">search</span>
          <input
            type="text"
            placeholder="Search contacts or users..."
            value={searchQuery}
            onChange={handleSearch}
            className="chat-search-input"
          />
        </div>

        {/* User Search Results Dropdown */}
        {userSearchResults.length > 0 && (
          <div className="chat-user-search-results">
            {userSearchResults.map((user) => (
              <div
                key={user._id}
                onClick={() => startDirectChat(user._id)}
                className="chat-user-result-item"
              >
                <img
                  src={user.avatar}
                  alt={user.username}
                  className="w-9 h-9 rounded-full border border-violet-500/30"
                />
                <div>
                  <div className="text-sm font-semibold text-violet-300">
                    {user.username}
                  </div>
                  <div className="text-xs text-gray-400">{user.fullName}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversation List */}
      <div className="chat-list">
        {chats.length === 0 ? (
          <div className="text-center text-gray-400 py-10 text-sm">
            No conversations yet.<br />Search users above or create a group!
          </div>
        ) : (
          chats.map((chat) => {
            const isActive = activeChat?._id === chat._id;
            const online = isUserOnline(chat);

            return (
              <div
                key={chat._id}
                onClick={() => onSelectChat(chat)}
                className={`chat-item ${isActive ? "active" : ""}`}
              >
                <div className="chat-avatar-container">
                  <img
                    src={getChatDisplayAvatar(chat)}
                    alt={getChatDisplayName(chat)}
                    className="chat-avatar"
                  />
                  {online && <div className="online-dot" />}
                </div>

                <div className="chat-item-info">
                  <div className="chat-item-top">
                    <span className="chat-item-name">
                      {getChatDisplayName(chat)}
                    </span>
                    {chat.lastMessage && (
                      <TimeAgo
                        date={chat.lastMessage.createdAt}
                        className="chat-item-time"
                      />
                    )}
                  </div>

                  <div className="chat-item-bottom">
                    <span className="chat-item-preview">
                      {chat.lastMessage
                        ? chat.lastMessage.content || (chat.lastMessage.media ? "📷 Media" : "")
                        : "No messages yet"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
