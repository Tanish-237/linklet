import React, { useState } from "react";

const ChatList = () => {
  const [chats, setChats] = useState([]);

  return (
    <div className="w-full h-full bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6 overflow-y-auto border-r border-purple-500/10">
      <input
        type="text"
        placeholder="Search chats..."
        className="w-full p-3 mb-6 rounded-lg bg-black/50 backdrop-blur-md border border-purple-500/20 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 text-white placeholder-gray-400"
      />

      <button className="w-full p-3 mb-6 bg-purple-500/20 text-white rounded-lg hover:bg-purple-500/30 transition-colors border border-purple-500/30 hover:scale-105">
        New Chat
      </button>

      <div className="space-y-2">
        {chats.map((chat) => (
          <div
            key={chat._id}
            className="flex items-center p-3 rounded-lg cursor-pointer hover:bg-purple-500/20 transition-colors border border-purple-500/10 hover:scale-105"
          >
            <img
              src={
                chat.avatar ||
                "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
              }
              alt={chat.name}
              className="w-10 h-10 rounded-full border border-purple-500/10"
            />
            <div className="ml-3 flex-1">
              <div className="font-bold text-purple-500">{chat.name}</div>
              <div className="text-sm text-gray-400 truncate">
                {chat.lastMessage}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatList;
