import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const ChatSidebar = ({ onSelectChat, activeChat }) => {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();

  useEffect(() => {
    const fetchChats = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/chat", {
          withCredentials: true,
        });
        setChats(res.data);
      } catch (error) {
        toast.error("Failed to fetch chats");
      }
    };

    if (user) {
      fetchChats();
    }
  }, [user]);

  useEffect(() => {
    if (!socket || !user) return;

    const handleMessageReceived = (message) => {
      // Update chat list with new message
      setChats((prevChats) =>
        prevChats.map((chat) =>
          chat._id === message.chatId ? { ...chat, lastMessage: message } : chat
        )
      );
    };

    socket.on("message received", handleMessageReceived);

    return () => {
      socket.off("message received", handleMessageReceived);
    };
  }, [socket, user]);

  const handleSearch = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (query.length > 2) {
      try {
        const res = await axios.get(
          `http://localhost:5000/api/chat/search?query=${query}`,
          {
            withCredentials: true,
          }
        );
        setSearchResults(res.data);
      } catch (error) {
        toast.error("Search failed");
      }
    } else {
      setSearchResults([]);
    }
  };

  const startNewChat = async (userId) => {
    try {
      const res = await axios.post(
        "http://localhost:5000/api/chat",
        { userId },
        { withCredentials: true }
      );
      setChats([res.data, ...chats]);
      onSelectChat(res.data._id);
      setSearchQuery("");
      setSearchResults([]);
    } catch (error) {
      toast.error("Failed to start chat");
    }
  };

  const handleChatSelect = (chatId) => {
    onSelectChat(chatId);
  };

  return (
    <div className="w-80 h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6 overflow-y-auto border-r border-purple-500/10">
      <input
        type="text"
        placeholder="Search users..."
        value={searchQuery}
        onChange={handleSearch}
        className="w-full p-3 mb-6 rounded-lg bg-black/50 backdrop-blur-md border border-purple-500/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-white placeholder-gray-400"
      />

      {searchResults.length > 0 && (
        <div className="space-y-2">
          {searchResults.map((user) => (
            <div
              key={user._id}
              onClick={() => startNewChat(user._id)}
              className="flex items-center p-3 rounded-lg cursor-pointer hover:bg-purple-500/20 transition-colors border border-purple-500/10 hover:scale-105"
            >
              <img
                src={
                  user.avatar ||
                  "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                }
                alt={user.username}
                className="w-10 h-10 rounded-full border border-purple-500/10"
              />
              <div className="ml-3 flex-1">
                <div className="font-bold text-purple-500">{user.username}</div>
                <div className="text-sm text-gray-400 truncate">
                  {user.fullName}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {chats.map((chat) => (
          <div
            key={chat._id}
            onClick={() => handleChatSelect(chat._id)}
            className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors border ${
              activeChat === chat._id
                ? "bg-purple-500/20 border-purple-500/30"
                : "border-purple-500/10 hover:bg-purple-500/20"
            } hover:scale-105`}
          >
            <img
              src={
                chat.isGroup
                  ? chat.groupImage ||
                    "https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
                  : chat.participants.find((p) => p._id !== user?._id)
                      ?.avatar ||
                    "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
              }
              alt={chat.isGroup ? chat.groupName : "User"}
              className="w-10 h-10 rounded-full border border-purple-500/10"
            />
            <div className="ml-3 flex-1">
              <div className="font-bold text-purple-500">
                {chat.isGroup
                  ? chat.groupName
                  : chat.participants.find((p) => p._id !== user?._id)
                      ?.username}
              </div>
              {/* <div className="text-sm text-gray-400 truncate">
                {chat.lastMessage
                  ? chat.lastMessage.content || (chat.lastMessage.media ? "Media" : "")
                  : "No messages yet"}
              </div> */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatSidebar;
