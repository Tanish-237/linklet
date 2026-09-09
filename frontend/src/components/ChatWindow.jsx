import React, { useState, useEffect, useRef } from "react";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";
import TimeAgo from "./TimeAgo";
import ConfirmDeleteModal from "./ConfirmDeleteModal";
import ForwardMessageModal from "./ForwardMessageModal";

const ChatWindow = ({
  chat,
  allChats = [],
  currentUser,
  socket,
  onlineUsers = [],
  onToggleInfo,
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [deletingMessageId, setDeletingMessageId] = useState(null);
  const [selectedMessageIds, setSelectedMessageIds] = useState([]);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState(null);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

  useEffect(() => {
    const handleWindowClick = () => setActiveMenuMessageId(null);
    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);
  const [typingUsers, setTypingUsers] = useState([]);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [editContent, setEditContent] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const messageCacheRef = useRef({});

  // Fetch messages when active chat changes
  useEffect(() => {
    if (!chat?._id) return;

    // Check in-memory cache for instant (0ms) rendering
    const cached = messageCacheRef.current[chat._id];
    if (cached && cached.length > 0) {
      setMessages(cached);
      setLoadingMessages(false);
    } else {
      setMessages([]);
      setLoadingMessages(true);
    }

    const fetchMessages = async () => {
      try {
        const res = await apiClient.get(`/chat/message/${chat._id}`);
        if (res.data.success) {
          const fetchedMsgs = res.data.data.messages || [];
          setMessages(fetchedMsgs);
          messageCacheRef.current[chat._id] = fetchedMsgs;
          setHasMore(res.data.data.hasMore);
          setNextCursor(res.data.data.nextCursor);
          scrollToBottom();
        }
      } catch (error) {
        console.error("Failed to load messages:", error);
        toast.error("Failed to load messages");
      } finally {
        setLoadingMessages(false);
      }
    };

    fetchMessages();
    setReplyingTo(null);
    setEditingMessage(null);
    setSelectedMessageIds([]);

    // Join room
    if (socket) {
      socket.emit("join chat", chat._id);
      socket.emit("read receipt", { chatId: chat._id, userId: currentUser?._id });
    }
  }, [chat?._id, socket]);

  // Socket event listeners
  useEffect(() => {
    if (!socket || !chat?._id) return;

    const handleMessageReceived = (message) => {
      if (message.chat === chat._id || message.chat?._id === chat._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === message._id)) return prev;
          return [...prev, message];
        });
        scrollToBottom();
      }
    };

    const handleMessageUpdated = (updated) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === updated._id ? updated : m))
      );
    };

    const handleMessageDeleted = (deletedId) => {
      setMessages((prev) => prev.filter((m) => m._id !== deletedId));
    };

    const handleTyping = ({ username, chatId }) => {
      if (chatId === chat._id && !typingUsers.includes(username)) {
        setTypingUsers((prev) => [...prev, username]);
      }
    };

    const handleStopTyping = ({ username, chatId }) => {
      if (chatId === chat._id) {
        setTypingUsers((prev) => prev.filter((u) => u !== username));
      }
    };

    socket.on("message received", handleMessageReceived);
    socket.on("message updated", handleMessageUpdated);
    socket.on("message deleted", handleMessageDeleted);
    socket.on("typing", handleTyping);
    socket.on("stop typing", handleStopTyping);

    return () => {
      socket.off("message received", handleMessageReceived);
      socket.off("message updated", handleMessageUpdated);
      socket.off("message deleted", handleMessageDeleted);
      socket.off("typing", handleTyping);
      socket.off("stop typing", handleStopTyping);
    };
  }, [socket, chat?._id, typingUsers]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth" });
    }, 100);
  };

  const loadOlderMessages = async () => {
    if (!chat?._id || !hasMore || !nextCursor || loadingOlder) return;

    setLoadingOlder(true);
    const container = chatContainerRef.current;
    const previousScrollHeight = container ? container.scrollHeight : 0;

    try {
      const res = await apiClient.get(`/chat/message/${chat._id}`, {
        params: { cursor: nextCursor, limit: 30 },
      });

      if (res.data?.success) {
        const olderMsgs = res.data.data.messages || [];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newUnique = olderMsgs.filter((m) => !existingIds.has(m._id));
          const updated = [...newUnique, ...prev];
          messageCacheRef.current[chat._id] = updated;
          return updated;
        });

        setHasMore(Boolean(res.data.data.hasMore));
        setNextCursor(res.data.data.nextCursor || null);

        // WhatsApp-style scroll anchoring: keep viewport position stable after prepending
        if (container) {
          requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - previousScrollHeight;
          });
        }
      }
    } catch (error) {
      console.error("Failed to load older messages:", error);
    } finally {
      setLoadingOlder(false);
    }
  };

  const handleMessagesScroll = (e) => {
    const container = e.currentTarget;
    if (container && container.scrollTop <= 60 && hasMore && !loadingOlder) {
      loadOlderMessages();
    }
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    if (socket && chat?._id) {
      socket.emit("typing", {
        chatId: chat._id,
        username: currentUser?.username,
      });
      setTimeout(() => {
        socket.emit("stop typing", {
          chatId: chat._id,
          username: currentUser?.username,
        });
      }, 3000);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (editingMessage) {
      handleEditMessage(editingMessage._id || editingMessage, newMessage);
      return;
    }

    if (isSending || (!newMessage.trim() && selectedFiles.length === 0)) return;

    setIsSending(true);
    const formData = new FormData();
    formData.append("chatId", chat._id);
    if (newMessage.trim()) formData.append("content", newMessage.trim());
    if (replyingTo) formData.append("replyTo", replyingTo._id);

    selectedFiles.forEach((file) => {
      formData.append("media", file);
    });

    try {
      const res = await apiClient.post("/chat/message", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        const data = res.data.data;
        const newMsgs = Array.isArray(data) ? data : [data];
        setMessages((prev) => [...prev, ...newMsgs]);
        newMsgs.forEach((msg) => socket?.emit("new message", msg));

        // Reset input state
        setNewMessage("");
        setSelectedFiles([]);
        setReplyingTo(null);
        scrollToBottom();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleEditMessage = async (msgId, updatedText) => {
    if (!updatedText || !updatedText.trim()) return;
    try {
      const res = await apiClient.put("/chat/message", {
        chatId: chat._id,
        messageId: msgId,
        content: updatedText.trim(),
      });

      if (res.data.success) {
        const updated = res.data.data;
        setMessages((prev) =>
          prev.map((m) => (m._id === msgId ? updated : m))
        );
        socket?.emit("message updated", updated);
        setEditingMessage(null);
        setNewMessage("");
        toast.success("Message updated");
      }
    } catch (error) {
      toast.error("Failed to edit message");
    }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      const res = await apiClient.delete("/chat/message", {
        data: { chatId: chat._id, messageId: msgId },
      });

      if (res.data.success) {
        setMessages((prev) => prev.filter((m) => m._id !== msgId));
        socket?.emit("message deleted", { chatId: chat._id, messageId: msgId });
        toast.success("Message deleted");
      }
    } catch (error) {
      toast.error("Failed to delete message");
    }
  };

  const toggleSelectMessage = (msgId) => {
    setSelectedMessageIds((prev) =>
      prev.includes(msgId)
        ? prev.filter((id) => id !== msgId)
        : [...prev, msgId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedMessageIds.length === 0) return;
    try {
      const res = await apiClient.delete("/chat/message/bulk-delete", {
        data: { chatId: chat._id, messageIds: selectedMessageIds },
      });

      if (res.data.success) {
        const deletedIds = res.data.data.deletedIds || selectedMessageIds;
        setMessages((prev) => prev.filter((m) => !deletedIds.includes(m._id)));
        deletedIds.forEach((id) =>
          socket?.emit("message deleted", { chatId: chat._id, messageId: id })
        );
        toast.success(`${deletedIds.length} message(s) deleted`);
        setSelectedMessageIds([]);
      }
    } catch (error) {
      toast.error("Failed to delete selected messages");
    }
  };

  const handleConfirmForward = async (targetChatId) => {
    if (selectedMessageIds.length === 0 || !targetChatId) return;
    try {
      const res = await apiClient.post("/chat/message/forward", {
        targetChatId,
        messageIds: selectedMessageIds,
      });

      if (res.data.success) {
        const forwardedMsgs = res.data.data;
        if (targetChatId === chat._id) {
          setMessages((prev) => [...prev, ...forwardedMsgs]);
          scrollToBottom();
        }
        forwardedMsgs.forEach((msg) => socket?.emit("new message", msg));
        toast.success(`${selectedMessageIds.length} message(s) forwarded!`);
        setSelectedMessageIds([]);
      }
    } catch (error) {
      toast.error("Failed to forward messages");
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
    e.target.value = "";
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const getOtherUser = () => {
    if (chat.isGroup) return null;
    return chat.participants?.find(
      (p) => p._id?.toString() !== currentUser?._id?.toString()
    );
  };

  const otherUser = getOtherUser();
  const isOnline =
    otherUser &&
    onlineUsers.some((id) => id.toString() === otherUser._id?.toString());

  return (
    <div className="chat-window relative">
      {/* Header / Multi-Select Action Bar */}
      {selectedMessageIds.length > 0 ? (
        <div className="chat-header bg-slate-900 border-b border-violet-500/30 flex items-center justify-between px-6 py-3 z-20 shadow-lg">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedMessageIds([])}
              className="text-gray-400 hover:text-white cursor-pointer flex items-center"
            >
              <span className="material-icons">close</span>
            </button>
            <span className="font-bold text-violet-300 text-sm">
              {selectedMessageIds.length} Selected
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsForwardModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600/30 border border-violet-500/40 text-violet-200 rounded-lg text-xs font-semibold hover:bg-violet-600/50 transition-colors cursor-pointer"
            >
              <span className="material-icons text-sm">shortcut</span> Forward
            </button>
            <button
              onClick={() => setDeletingMessageId("BULK")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/20 border border-red-500/30 text-red-300 rounded-lg text-xs font-semibold hover:bg-red-500/30 transition-colors cursor-pointer"
            >
              <span className="material-icons text-sm">delete</span> Delete
            </button>
          </div>
        </div>
      ) : (
        <div className="chat-header">
          <div onClick={onToggleInfo} className="chat-header-user cursor-pointer hover:opacity-90 transition-opacity">
            <img
              src={
                chat.isGroup
                  ? chat.groupImage ||
                    "https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
                  : otherUser?.avatar
              }
              alt="Avatar"
              className="w-10 h-10 rounded-full border border-violet-500/30 object-cover"
            />
            <div>
              <div className="chat-header-name">
                {chat.isGroup ? chat.chatName : otherUser?.username}
              </div>
              <div className="chat-header-status">
                {chat.isGroup
                  ? `${chat.participants?.length || 0} members`
                  : isOnline
                  ? "Online"
                  : "Offline"}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Messages Feed */}
      <div
        className="chat-messages"
        ref={chatContainerRef}
        onScroll={handleMessagesScroll}
      >
        {/* WhatsApp-style Scroll-Up Older Messages Indicator / Button */}
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
              onClick={loadOlderMessages}
              className="text-xs text-violet-400 hover:text-violet-300 bg-violet-950/40 hover:bg-violet-900/40 px-3 py-1 rounded-full transition-colors border border-violet-800/40 cursor-pointer"
            >
              Load older messages
            </button>
          </div>
        )}

        {loadingMessages && messages.length === 0 ? (
          <div className="chat-empty-state">
            <span className="material-icons animate-spin text-violet-400 text-3xl mb-2">
              sync
            </span>
            <p className="text-sm text-gray-400">Loading conversation...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-empty-state">
            <span className="material-icons chat-empty-icon">chat</span>
            <p className="font-semibold text-lg">No messages yet</p>
            <p className="text-sm">Send a message to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isSent = msg.sender?._id === currentUser?._id;
            const isSelected = selectedMessageIds.includes(msg._id);
            const isNearTop = index < 2;

            return (
              <div
                key={msg._id}
                className="flex items-center gap-3 w-full my-1 relative group"
                onClick={() => {
                  if (selectedMessageIds.length > 0) {
                    toggleSelectMessage(msg._id);
                  }
                }}
              >
                {/* Selection Checkbox - Fixed Far Left Gutter like WhatsApp */}
                {selectedMessageIds.length > 0 && (
                  <div
                    className="flex-shrink-0 flex items-center justify-center cursor-pointer pl-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectMessage(msg._id);
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

                <div
                  className={`flex-1 flex ${
                    isSent ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`message-bubble-wrapper ${
                      isSent ? "sent" : "received"
                    }`}
                  >
                  {!isSent && chat.isGroup && (
                    <div className="message-sender-name">
                      {msg.sender?.username}
                    </div>
                  )}

                    <div
                      className={`message-bubble ${
                        isSelected ? "ring-2 ring-violet-500/60" : ""
                      }`}
                    >
                      {/* Reply Context */}
                      {msg.replyTo && (
                        <div className="p-2 mb-1 rounded bg-black/20 border-l-2 border-violet-400 text-xs text-gray-300">
                          <span className="font-bold text-violet-300 block">
                            {msg.replyTo.sender?.username}
                          </span>
                          {msg.replyTo.content || "Media"}
                        </div>
                      )}

                      {msg.content && <div>{msg.content}</div>}

                      {/* Media Display */}
                      {msg.media && (
                        <div>
                          {msg.mediaType === "image" ? (
                            <img
                              src={msg.media}
                              alt="Uploaded"
                              className="message-media-img"
                              onClick={() => window.open(msg.media, "_blank")}
                            />
                          ) : msg.mediaType === "video" ? (
                            <video
                              controls
                              src={msg.media}
                              className="message-media-img"
                            />
                          ) : (
                            <a
                              href={msg.media}
                              target="_blank"
                              rel="noreferrer"
                              className="message-media-doc text-violet-300 hover:underline"
                            >
                              <span className="material-icons">description</span>
                              Download Document
                            </a>
                          )}
                        </div>
                      )}

                      {/* Timestamp & Meta */}
                      <div className="message-meta">
                        {msg.isEdited && <span>(edited)</span>}
                        <TimeAgo date={msg.createdAt} />
                        {isSent && (
                          <span className="material-icons text-xs">
                            {msg.readBy?.length > 1 ? "done_all" : "done"}
                          </span>
                        )}
                      </div>

                      {/* WhatsApp Dropdown Trigger */}
                      <button
                        className={`msg-dropdown-trigger ${
                          activeMenuMessageId === msg._id ? "active" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMessageId(
                            activeMenuMessageId === msg._id ? null : msg._id
                          );
                        }}
                        title="Message options"
                      >
                        <span className="material-icons text-base">
                          keyboard_arrow_down
                        </span>
                      </button>

                      {/* WhatsApp Context Menu Dropdown */}
                      {activeMenuMessageId === msg._id && (
                        <div
                          className={`msg-context-menu ${
                            isNearTop ? "pop-down" : "pop-up"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() => {
                              setReplyingTo(msg);
                              setEditingMessage(null);
                              if (editingMessage) setNewMessage("");
                              setActiveMenuMessageId(null);
                            }}
                            className="msg-menu-item"
                          >
                            <span className="material-icons">reply</span> Reply
                          </button>

                          {msg.content && (
                            <button
                              onClick={() => {
                                if (msg.content) {
                                  navigator.clipboard.writeText(msg.content);
                                  toast.info("Copied to clipboard");
                                }
                                setActiveMenuMessageId(null);
                              }}
                              className="msg-menu-item"
                            >
                              <span className="material-icons">
                                content_copy
                              </span>{" "}
                              Copy
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setSelectedMessageIds([msg._id]);
                              setActiveMenuMessageId(null);
                            }}
                            className="msg-menu-item"
                          >
                            <span className="material-icons">shortcut</span>{" "}
                            Forward
                          </button>

                          {isSent && !msg.media && (Date.now() - new Date(msg.createdAt).getTime() <= 15 * 60 * 1000) && (
                            <button
                              onClick={() => {
                                setEditingMessage(msg);
                                setNewMessage(msg.content || "");
                                setReplyingTo(null);
                                setActiveMenuMessageId(null);
                              }}
                              className="msg-menu-item"
                            >
                              <span className="material-icons">edit</span> Edit
                            </button>
                          )}

                          {isSent && (
                            <button
                              onClick={() => {
                                setSelectedMessageIds([msg._id]);
                                setActiveMenuMessageId(null);
                              }}
                              className="msg-menu-item text-red-400 hover:bg-red-500/20"
                            >
                              <span className="material-icons text-red-400">
                                delete
                              </span>
                              Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                </div>
              </div>
            </div>
          );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <div className="typing-indicator">
          <span>{typingUsers.join(", ")} typing...</span>
          <div className="typing-dot" />
          <div className="typing-dot" />
          <div className="typing-dot" />
        </div>
      )}

      {/* Replying-to Preview Bar */}
      {replyingTo && (
        <div className="px-6 py-2 bg-slate-900/80 border-t border-violet-500/15 flex justify-between items-center text-xs text-violet-300">
          <div>
            Replying to <span className="font-bold">{replyingTo.sender?.username}</span>: "{replyingTo.content}"
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="text-gray-400 hover:text-white"
          >
            &times;
          </button>
        </div>
      )}

      {/* Editing Message Preview Bar */}
      {editingMessage && (
        <div className="px-6 py-2 bg-slate-900/90 border-t border-violet-500/20 flex justify-between items-center text-xs text-amber-300">
          <div className="flex items-center gap-2">
            <span className="material-icons text-sm text-amber-400">edit</span>
            <span>
              Editing message: <span className="font-semibold text-white">"{editingMessage.content || "Media"}"</span>
            </span>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setNewMessage("");
            }}
            className="text-gray-400 hover:text-white text-base font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* Input Composer */}
      <form onSubmit={handleSendMessage} className="chat-composer">
        <input
          type="file"
          multiple
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="chat-icon-btn"
          title="Attach files (multiple)"
        >
          <span className="material-icons">attach_file</span>
        </button>

        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 max-w-xs overflow-x-auto">
            {selectedFiles.map((file, idx) => (
              <span
                key={idx}
                className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded-lg flex items-center gap-1"
              >
                {file.name}
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="ml-1 text-red-400 hover:text-red-300 font-bold"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={handleTyping}
          className="chat-input"
        />

        <button
          type="submit"
          disabled={isSending || (!newMessage.trim() && selectedFiles.length === 0)}
          className="send-btn disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="material-icons">{isSending ? "hourglass_top" : "send"}</span>
        </button>
      </form>

      {/* Custom Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingMessageId}
        title={deletingMessageId === "BULK" ? "Delete Messages" : "Delete Message"}
        message={
          deletingMessageId === "BULK"
            ? `Are you sure you want to delete ${selectedMessageIds.length} selected message(s)?`
            : "Are you sure you want to delete this message? This action cannot be undone."
        }
        confirmText="Delete"
        onConfirm={() => {
          if (deletingMessageId === "BULK") {
            handleBulkDelete();
          } else if (deletingMessageId) {
            handleDeleteMessage(deletingMessageId);
          }
          setDeletingMessageId(null);
        }}
        onCancel={() => setDeletingMessageId(null)}
      />

      {/* Forward Message Modal */}
      <ForwardMessageModal
        isOpen={isForwardModalOpen}
        chats={allChats}
        selectedMessageCount={selectedMessageIds.length}
        onConfirmForward={handleConfirmForward}
        onClose={() => setIsForwardModalOpen(false)}
      />
    </div>
  );
};

export default ChatWindow;
