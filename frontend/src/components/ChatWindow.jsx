import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { useSocket } from "../context/SocketContext";
import { format } from "timeago.js";

const ChatWindow = ({ chatId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState(null);
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const socket = useSocket();
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!socket || !chatId) return;

    const typingTimeout = setTimeout(() => {
      socket.emit("stop typing", chatId);
      setIsTyping(false);
    }, 3000);

    return () => clearTimeout(typingTimeout);
  }, [newMessage]);



  useEffect(() => {
    if (!chatId || !user) return;

    const fetchMessages = async () => {
      try {
        const res = await axios.get(
          `http://localhost:5000/api/chat/message/${chatId}`,
          {
            withCredentials: true,
          }
        );
        setMessages(res.data || []);

        
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        toast.error("Failed to load messages");
      }
    };

    fetchMessages();
  }, [chatId, user]);

  

  useEffect(() => {
    if (!socket || !chatId) return;

    socket.on("message updated", (updatedMessage) => {
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg._id === updatedMessage._id ? updatedMessage : msg
        )
      );
    });

    socket.on("message deleted", (deletedMessageId) => {
      setMessages((prevMessages) =>
        prevMessages.filter((msg) => msg._id !== deletedMessageId)
      );
    });

    return () => {
      socket.off("message updated");
      socket.off("message deleted");
    };
  }, [socket, chatId]);

  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!isTyping) {
      socket.emit("typing", chatId);
      setIsTyping(true);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!newMessage && !file) return;

    const formData = new FormData();
    if (newMessage) formData.append("content", newMessage);
    if (file) formData.append("media", file);
    formData.append("chatId", chatId);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/chat/message",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
      );

      socket.emit("new message", res.data);
      setMessages([...messages, res.data]);
      setNewMessage("");
      setFile(null);
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSendMessage();
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleEditMessage = async (message) => {
    if (!editContent.trim()) return;

    try {
      const res = await axios.put(
        "http://localhost:5000/api/chat/message/edit",
        {
          chatId,
          messageId: message._id,
          content: editContent,
        },
        { withCredentials: true }
      );

      setMessages((prevMessages) =>
        prevMessages.map((msg) => (msg._id === message._id ? res.data : msg))
      );
      setEditingMessage(null);
      setEditContent("");
    } catch (error) {
      console.error("Failed to edit message:", error);
      toast.error("Failed to edit message");
    }
  };

  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete("http://localhost:5000/api/chat/message/delete", {
        data: { chatId, messageId },
        withCredentials: true,
      });
    } catch (error) {
      console.error("Failed to delete message:", error);
      toast.error("Failed to delete message");
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-gray-900 to-gray-800">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.map((message) => (
          <div
            key={message._id}
            className={`flex mb-6 group relative ${
              message.sender._id === user?._id ? "justify-end" : "justify-start"
            }`}
          >
            {message.sender._id === user?._id && (
              <div className="absolute top-0 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/50 backdrop-blur-md p-2 rounded-lg border border-purple-500/10 z-10">
                <button
                  onClick={() => {
                    setEditingMessage(message._id);
                    setEditContent(message.content);
                  }}
                  className="text-gray-400 hover:text-purple-500 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteMessage(message._id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            )}
            <div
              className={`flex flex-col ${
                message.sender._id === user?._id ? "items-end" : "items-start"
              }`}
            >
              {message.sender._id !== user?._id && (
                <span className="text-sm text-purple-500 mb-1">
                  {message.sender.username}
                </span>
              )}
              {editingMessage === message._id ? (
                <div className="w-full">
                  <input
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleEditMessage(message);
                      } else if (e.key === "Escape") {
                        setEditingMessage(null);
                        setEditContent("");
                      }
                    }}
                    className="w-full p-2 rounded-lg bg-black/50 backdrop-blur-md border border-purple-500/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-white"
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleEditMessage(message)}
                      className="px-3 py-1 bg-purple-500/20 text-white rounded-lg hover:bg-purple-500/30 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingMessage(null);
                        setEditContent("");
                      }}
                      className="px-3 py-1 bg-gray-500/20 text-white rounded-lg hover:bg-gray-500/30 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className={`max-w-[70%] p-4 rounded-lg ${
                    message.sender._id === user?._id
                      ? "bg-purple-500/20 rounded-tr-none"
                      : "bg-black/50 rounded-tl-none"
                  } backdrop-blur-md border ${
                    message.sender._id === user?._id
                      ? "border-purple-500/30"
                      : "border-purple-500/10"
                  } transition-transform hover:scale-105`}
                >
                  <div className="text-white text-base mb-2">
                {message.content}
                  </div>
                {message.media && (
                    <div className="mt-2">
                    {message.mediaType === "image" ? (
                        <img
                          src={message.media}
                          alt="Media"
                          className="max-w-full rounded-lg border border-purple-500/10"
                        />
                    ) : message.mediaType === "video" ? (
                        <video
                          controls
                          className="max-w-full rounded-lg border border-purple-500/10"
                        >
                        <source src={message.media} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <a
                        href={message.media}
                        target="_blank"
                        rel="noopener noreferrer"
                          className="text-purple-500 hover:underline"
                      >
                        View File
                      </a>
                    )}
                    </div>
                  )}
                  <div
                    className={`flex items-center gap-2 mt-2 ${
                      message.sender._id === user?._id
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    {message.updatedAt &&
                    message.updatedAt !== message.createdAt ? (
                      <span className="text-xs text-gray-400">
                        edited {format(message.updatedAt)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">
                  {format(message.createdAt)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {typingUsers.length > 0 && (
        <div className="px-6 py-2 text-gray-400 italic">
          {typingUsers.join(", ")} {typingUsers.length > 1 ? "are" : "is"}{" "}
          typing...
        </div>
      )}

      <div className="p-4 border-t border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-4">
          <label className="cursor-pointer text-gray-400 hover:text-purple-500">
            <input
              type="file"
              onChange={handleFileChange}
              className="hidden"
              accept="image/*,video/*"
            />
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
              />
            </svg>
          </label>
          <input
          type="text"
            value={newMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
          placeholder="Type a message..."
            className="flex-1 bg-gray-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          <button
            onClick={handleSendMessage}
            disabled={!newMessage && !file}
            className="bg-purple-500 text-white rounded-lg px-4 py-2 hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
