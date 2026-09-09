import React, { useState, useEffect } from "react";
import { apiClient } from "../api/apiClient";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../hooks/useSocket";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import ChatInfoPanel from "../components/ChatInfoPanel";
import CreateGroupModal from "../components/CreateGroupModal";
import "./ChatPage.css";

const ChatPage = () => {
  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const { user } = useAuth();
  const socket = useSocket();

  // Load user's chats
  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await apiClient.get("/chat");
        if (res.data.success) {
          setChats(res.data.data);
          if (res.data.data.length > 0 && !activeChat) {
            setActiveChat(res.data.data[0]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch chats:", error);
      }
    };

    if (user) {
      fetchChats();
    }
  }, [user]);

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

    socket.on("message received", (newMessage) => {
      setChats((prevChats) =>
        prevChats.map((chat) => {
          const chatId = typeof newMessage.chat === "object" ? newMessage.chat._id : newMessage.chat;
          if (chat._id === chatId) {
            return {
              ...chat,
              lastMessage: newMessage,
              updatedAt: newMessage.createdAt || chat.updatedAt,
            };
          }
          return chat;
        })
      );
    });

    socket.on("group updated", (updatedChat) => {
      setChats((prev) =>
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
      socket.off("message received");
      socket.off("group updated");
    };
  }, [socket, user, activeChat]);

  const handleSelectChat = (chat) => {
    setActiveChat(chat);
  };

  const handleGroupCreated = (newGroup) => {
    setChats((prev) => [newGroup, ...prev]);
    setActiveChat(newGroup);
  };

  const handleUpdateChat = (updatedChat) => {
    setChats((prev) =>
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
        />
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-400">
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
