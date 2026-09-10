import React, { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import ChatInfoPanel from "../components/ChatInfoPanel";
import CreateGroupModal from "../components/CreateGroupModal";
import "./ChatPage.css";

const ChatPage = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const socket = useSocket();

  const userChatsCacheKey = `linklet_cached_chats_${user?._id}`;

  // Read chats from localStorage cache for instant 0ms mount
  const initialLocalChats = () => {
    try {
      if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.getItem === "function") {
        const saved = window.localStorage.getItem(userChatsCacheKey);
        return saved ? JSON.parse(saved) : [];
      }
    } catch {
      return [];
    }
    return [];
  };

  // In-memory TanStack query with local storage initialData
  const {
    data: cachedChats = [],
    refetch: fetchChats,
  } = useQuery({
    queryKey: ["chats", user?._id],
    queryFn: async () => {
      const res = await apiClient.get("/chat");
      if (res.data.success) {
        try {
          if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
            window.localStorage.setItem(userChatsCacheKey, JSON.stringify(res.data.data));
          }
        } catch (e) {
          // safe fallback
        }
        return res.data.data;
      }
      return [];
    },
    placeholderData: initialLocalChats,
    enabled: !!user?._id,
    staleTime: 5 * 60 * 1000,
  });

  const [chats, setChats] = useState(cachedChats);
  const [activeChat, setActiveChat] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingMap, setTypingMap] = useState({}); // chatId -> username
  const [unreadCounts, setUnreadCounts] = useState({}); // chatId -> count

  useEffect(() => {
    if (cachedChats && cachedChats.length > 0) {
      setChats(cachedChats);
      if (!activeChat && window.innerWidth > 768) {
        setActiveChat(cachedChats[0]);
      }
    }
  }, [cachedChats]);

  const updateChats = (updater) => {
    setChats((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      queryClient.setQueryData(["chats", user?._id], next);
      try {
        if (typeof window !== "undefined" && window.localStorage && typeof window.localStorage.setItem === "function") {
          window.localStorage.setItem(userChatsCacheKey, JSON.stringify(next));
        }
      } catch {}
      return next;
    });
  };

  // Setup Socket connection & status listeners
  useEffect(() => {
    if (!socket || !user) return;

    socket.emit("setup", user);

    socket.on("user online status", ({ onlineUsers }) => {
      setOnlineUsers(onlineUsers || []);
    });

    socket.on("user_connected", ({ userId }) => {
      if (userId) {
        setOnlineUsers((prev) => (prev.includes(userId) ? prev : [...prev, userId]));
      }
    });

    socket.on("user_disconnected", ({ userId }) => {
      if (userId) {
        setOnlineUsers((prev) => prev.filter((id) => id !== userId));
      }
    });

    socket.on("typing", ({ chatId, username }) => {
      if (chatId && username) {
        setTypingMap((prev) => ({ ...prev, [chatId]: username }));
      }
    });

    socket.on("stop typing", ({ chatId }) => {
      if (chatId) {
        setTypingMap((prev) => {
          const next = { ...prev };
          delete next[chatId];
          return next;
        });
      }
    });

    socket.on("message received", (newMessage) => {
      const msgChatId =
        typeof newMessage.chat === "object" ? newMessage.chat._id : newMessage.chat;

      // Increment unread count if not in the active chat
      if (activeChat?._id !== msgChatId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [msgChatId]: (prev[msgChatId] || 0) + 1,
        }));
      }

      updateChats((prevChats) => {
        let found = false;
        const updated = prevChats.map((chat) => {
          if (chat._id === msgChatId) {
            found = true;
            return {
              ...chat,
              lastMessage: newMessage,
              updatedAt: newMessage.createdAt || chat.updatedAt,
            };
          }
          return chat;
        });

        // If it's a new chat not yet in list, re-fetch chats
        if (!found) {
          fetchChats();
        }

        // Re-sort with most recent message at the top (WhatsApp style)
        return updated.sort(
          (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0)
        );
      });
    });

    socket.on("group updated", (updatedChat) => {
      updateChats((prev) =>
        prev.map((c) => (c._id === updatedChat._id ? updatedChat : c))
      );
      if (activeChat?._id === updatedChat._id) {
        setActiveChat(updatedChat);
      }
    });

    return () => {
      socket.off("user online status");
      socket.off("user_connected");
      socket.off("user_disconnected");
      socket.off("typing");
      socket.off("stop typing");
      socket.off("message received");
      socket.off("group updated");
    };
  }, [socket, user, activeChat, fetchChats]);

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
    // Clear unread count for selected chat
    setUnreadCounts((prev) => ({ ...prev, [chat._id]: 0 }));
  };

  const handleGroupCreated = (newGroup) => {
    updateChats((prev) => [newGroup, ...prev]);
    setActiveChat(newGroup);
  };

  const handleUpdateChat = (updatedChat) => {
    updateChats((prev) =>
      prev.map((c) => (c._id === updatedChat._id ? updatedChat : c))
    );
    if (activeChat?._id === updatedChat._id) {
      setActiveChat(updatedChat);
    }
  };

  return (
    <div className="chat-container">
      {/* Sidebar */}
      <ChatSidebar
        chats={chats}
        activeChat={activeChat}
        onSelectChat={handleSelectChat}
        onOpenCreateGroup={() => setIsGroupModalOpen(true)}
        currentUser={user}
        onlineUsers={onlineUsers}
        typingMap={typingMap}
        unreadCounts={unreadCounts}
        isMobileChatOpen={Boolean(activeChat)}
      />

      {/* Main Window */}
      {activeChat ? (
        <ChatWindow
          chat={activeChat}
          allChats={chats}
          currentUser={user}
          socket={socket}
          onlineUsers={onlineUsers}
          onToggleInfo={() => setShowInfoPanel(!showInfoPanel)}
          onBackToSidebar={() => setActiveChat(null)}
        />
      ) : (
        <div className="flex-1 hidden md:flex items-center justify-center text-gray-400">
          Select a chat to start messaging
        </div>
      )}

      {/* Slide-out Info Panel */}
      {showInfoPanel && activeChat && (
        <ChatInfoPanel
          chat={activeChat}
          currentUser={user}
          onClose={() => setShowInfoPanel(false)}
          onUpdateChat={handleUpdateChat}
        />
      )}

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isGroupModalOpen}
        onClose={() => setIsGroupModalOpen(false)}
        onGroupCreated={handleGroupCreated}
      />
    </div>
  );
};

export default ChatPage;
