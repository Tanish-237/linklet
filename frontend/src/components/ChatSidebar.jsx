import React, { useState, useEffect } from "react";
import styled from "styled-components";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

const SidebarContainer = styled.div`
  width: 300px;
  height: 100vh;
  background-color: #1a1a1a;
  color: white;
  padding: 20px;
  overflow-y: auto;
`;

const SearchBar = styled.input`
  width: 100%;
  padding: 10px;
  margin-bottom: 20px;
  border-radius: 5px;
  border: none;
  background-color: #333;
  color: white;
`;

const ChatItem = styled.div`
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 5px;
  cursor: pointer;
  display: flex;
  align-items: center;
  background-color: ${(props) => (props.$active ? "#333" : "transparent")};
  &:hover {
    background-color: #333;
  }
`;

const Avatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 10px;
`;

const ChatInfo = styled.div`
  flex: 1;
`;

const ChatName = styled.div`
  font-weight: bold;
`;

const LastMessage = styled.div`
  font-size: 12px;
  color: #aaa;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const NewChatButton = styled.button`
  width: 100%;
  padding: 10px;
  margin-bottom: 20px;
  background-color: #1db954;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  &:hover {
    background-color: #1ed760;
  }
`;

const UnreadCount = styled.div`
  background-color: #1db954;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  margin-left: auto;
`;

const ChatSidebar = ({ onSelectChat, activeChat }) => {
  const [chats, setChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [unreadCounts, setUnreadCounts] = useState({});
  const { user } = useAuth();
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

    const fetchUnreadCounts = async () => {
      try {
        const res = await axios.get("http://localhost:5000/api/chat/unread-count", {
          withCredentials: true,
        });
        setUnreadCounts(res.data);
      } catch (error) {
        console.error("Failed to fetch unread counts:", error);
      }
    };

    if (user) {
      fetchChats();
      fetchUnreadCounts();
    }
  }, [user]);

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

  return (
    <SidebarContainer>
      <NewChatButton onClick={() => navigate("/chat/new-group")}>
        New Group
      </NewChatButton>
      <SearchBar
        type="text"
        placeholder="Search users..."
        value={searchQuery}
        onChange={handleSearch}
      />

      {searchResults.length > 0 && (
        <div>
          {searchResults.map((user) => (
            <ChatItem key={user._id} onClick={() => startNewChat(user._id)}>
              <Avatar
                src={
                  user.avatar ||
                  "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                }
              />
              <ChatInfo>
                <ChatName>{user.username}</ChatName>
                <LastMessage>{user.fullName}</LastMessage>
              </ChatInfo>
            </ChatItem>
          ))}
        </div>
      )}

      {chats.map((chat) => (
        <ChatItem
          key={chat._id}
          $active={activeChat === chat._id}
          onClick={() => {
            onSelectChat(chat._id);
            if (unreadCounts[chat._id] > 0) {
              const lastMessage = chat.messages[chat.messages.length - 1];
              if (lastMessage) {
                axios.post(
                  "http://localhost:5000/api/chat/mark-read",
                  {
                    chatId: chat._id,
                    messageId: lastMessage._id,
                  },
                  { withCredentials: true }
                );
              }
            }
          }}
        >
          <Avatar
            src={
              chat.isGroup
                ? chat.groupImage ||
                  "https://cdn-icons-png.flaticon.com/512/3177/3177440.png"
                : chat.participants.find((p) => p._id !== user?._id)?.avatar ||
                  "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
            }
          />
          <ChatInfo>
            <ChatName>
              {chat.isGroup
                ? chat.groupName
                : chat.participants.find((p) => p._id !== user?._id)?.username}
            </ChatName>
            <LastMessage>
              {chat.lastMessage
                ? chat.lastMessage.content ||
                  (chat.lastMessage.media ? "Media" : "")
                : "No messages yet"}
            </LastMessage>
          </ChatInfo>
          {unreadCounts[chat._id] > 0 && (
            <UnreadCount>{unreadCounts[chat._id]}</UnreadCount>
          )}
        </ChatItem>
      ))}
    </SidebarContainer>
  );
};

export default ChatSidebar;
