import React, { useState, useEffect, useRef } from "react";
import styled from "styled-components";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { useSocket } from "../context/SocketContext";
import { format } from "timeago.js";

const ChatContainer = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: #121212;
`;

const MessagesContainer = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #121212;
`;

const Message = styled.div`
  display: flex;
  margin-bottom: 15px;
  justify-content: ${(props) => (props.$isMe ? "flex-end" : "flex-start")};
`;

const MessageContent = styled.div`
  max-width: 70%;
  padding: 10px 15px;
  border-radius: ${(props) =>
    props.$isMe ? "15px 15px 0 15px" : "15px 15px 15px 0"};
  background-color: ${(props) => (props.$isMe ? "#1db954" : "#333")};
  color: white;
  word-wrap: break-word;
`;

const MessageInfo = styled.div`
  display: flex;
  flex-direction: column;
  margin-left: ${(props) => (props.$isMe ? "0" : "10px")};
  margin-right: ${(props) => (props.$isMe ? "10px" : "0")};
`;

const SenderName = styled.span`
  font-size: 12px;
  color: #aaa;
  margin-bottom: 5px;
`;

const MessageTime = styled.span`
  font-size: 10px;
  color: #aaa;
  margin-top: 5px;
  text-align: ${(props) => (props.$isMe ? "right" : "left")};
`;

const MediaMessage = styled.div`
  margin-top: 10px;
  img,
  video {
    max-width: 100%;
    max-height: 300px;
    border-radius: 10px;
  }
`;

const InputContainer = styled.div`
  display: flex;
  padding: 15px;
  background-color: #1a1a1a;
  align-items: center;
  gap: 10px;
  border-top: 1px solid #333;
`;

const MessageInput = styled.input`
  flex: 1;
  padding: 12px 20px;
  border-radius: 25px;
  border: 1px solid #333;
  background-color: #333;
  color: white;
  font-size: 14px;
  transition: all 0.3s ease;

  &:focus {
    outline: none;
    border-color: #1db954;
    box-shadow: 0 0 0 2px rgba(29, 185, 84, 0.2);
  }

  &::placeholder {
    color: #aaa;
  }
`;

const SendButton = styled.button`
  padding: 12px;
  background-color: #1db954;
  color: white;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  width: 40px;
  height: 40px;

  &:hover {
    background-color: #1ed760;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const FileInput = styled.input`
  display: none;
`;

const FileButton = styled.label`
  padding: 12px;
  background-color: #333;
  color: white;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
  width: 40px;
  height: 40px;

  &:hover {
    background-color: #444;
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const ChatWindow = ({ chatId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [file, setFile] = useState(null);
  const { user } = useAuth();
  const messagesEndRef = useRef(null);
  const socket = useSocket();
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);

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

  // Add these effects
  useEffect(() => {
    if (!socket || !chatId) return;

    const typingTimeout = setTimeout(() => {
      socket.emit("stop typing", chatId);
      setIsTyping(false);
    }, 3000);

    return () => clearTimeout(typingTimeout);
  }, [newMessage]);

  useEffect(() => {
    if (!socket) return;

    socket.on("typing", (chatId) => {
      if (chatId === chatId) {
        setTypingUsers((prev) => [...new Set([...prev, "Someone"])]);
      }
    });

    socket.on("stop typing", (chatId) => {
      if (chatId === chatId) {
        setTypingUsers((prev) => prev.filter((u) => u !== "Someone"));
      }
    });

    return () => {
      socket.off("typing");
      socket.off("stop typing");
    };
  }, [socket, chatId]);

  useEffect(() => {
    if (!chatId || !user) return;

    // Fetch previous messages
    const fetchMessages = async () => {
      try {
        const res = await axios.get(`http://localhost:5000/api/chat/message/${chatId}`, {
          withCredentials: true
        });
        console.log("Fetched messages:", res.data);
        setMessages(res.data || []);

        // Mark messages as read when chat is opened
        if (res.data && res.data.length > 0) {
          const lastMessage = res.data[res.data.length - 1];
          await axios.post(
            "http://localhost:5000/api/chat/mark-read",
            {
              chatId,
              messageId: lastMessage._id,
            },
            { withCredentials: true }
          );
        }
      } catch (error) {
        console.error("Failed to fetch messages:", error);
        toast.error("Failed to load messages");
      }
    };

    fetchMessages();
  }, [chatId, user]);

  useEffect(() => {
    if (!chatId || !user) return;

    const unreadMessages = messages.filter(
      (msg) => msg.sender._id !== user._id && !msg.readBy.includes(user._id)
    );

    if (unreadMessages.length > 0) {
      const markAsRead = async () => {
        try {
          await axios.post(
            "http://localhost:5000/api/chat/mark-read",
            {
              chatId,
              messageId: unreadMessages[unreadMessages.length - 1]._id,
            },
            { withCredentials: true }
          );
        } catch (error) {
          console.error("Failed to mark as read", error);
        }
      };

      markAsRead();
    }
  }, [messages, chatId, user]);

  useEffect(() => {
    if (!socket || !chatId) return;

    // Join the chat room
    socket.emit("join chat", chatId);

    // Listen for new messages
    socket.on("message received", async (message) => {
      console.log("Received new message:", message);
      setMessages((prevMessages) => [...prevMessages, message]);

      // Mark new message as read
      try {
        await axios.post(
          "http://localhost:5000/api/chat/mark-read",
          {
            chatId,
            messageId: message._id,
          },
          { withCredentials: true }
        );
      } catch (error) {
        console.error("Failed to mark message as read:", error);
      }
    });

    // Cleanup on unmount
    return () => {
      socket.off("join chat");
      socket.off("message received");
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

    console.log("Sending message:", {
      content: newMessage,
      chatId,
      hasFile: !!file
    });

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

      console.log("Message sent successfully:", res.data);

      // Emit socket event
      socket.emit("new message", res.data);

      setMessages([...messages, res.data]);
      setNewMessage("");
      setFile(null);
    } catch (error) {
      console.error("Failed to send message:", {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message
      });
      
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error.response?.status === 500) {
        toast.error("Server error. Please try again later.");
      } else {
        toast.error("Failed to send message. Please try again.");
      }
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

  return (
    <ChatContainer>
      <MessagesContainer>
        {messages.map((message) => (
          <Message key={message._id} $isMe={message.sender._id === user?._id}>
            <MessageInfo $isMe={message.sender._id === user?._id}>
              {message.sender._id !== user?._id && (
                <SenderName>{message.sender.username}</SenderName>
              )}
              <MessageContent $isMe={message.sender._id === user?._id}>
                {message.content}
                {message.media && (
                  <MediaMessage>
                    {message.mediaType === "image" ? (
                      <img src={message.media} alt="Media" />
                    ) : message.mediaType === "video" ? (
                      <video controls>
                        <source src={message.media} type="video/mp4" />
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <a
                        href={message.media}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        View File
                      </a>
                    )}
                  </MediaMessage>
                )}
                <MessageTime $isMe={message.sender._id === user?._id}>
                  {format(message.createdAt)}
                </MessageTime>
              </MessageContent>
            </MessageInfo>
          </Message>
        ))}
        <div ref={messagesEndRef} />
      </MessagesContainer>

      {typingUsers.length > 0 && (
        <div
          style={{ color: "#aaa", fontStyle: "italic", marginBottom: "10px" }}
        >
          {typingUsers.join(", ")} {typingUsers.length > 1 ? "are" : "is"}{" "}
          typing...
        </div>
      )}

      <InputContainer>
        <FileButton htmlFor="file-upload">
          <i className="fas fa-paperclip"></i>
          <FileInput
            id="file-upload"
            type="file"
            onChange={handleFileChange}
            accept="image/*,video/*"
          />
        </FileButton>
        <MessageInput
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
        />
        <SendButton onClick={handleSendMessage} disabled={!newMessage && !file}>
          <i className="fas fa-paper-plane"></i>
        </SendButton>
      </InputContainer>
    </ChatContainer>
  );
};

export default ChatWindow;
