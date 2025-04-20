import React, { useState } from "react";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import { Navbar } from "../components/Navbar";

const ChatPage = () => {
  const [activeChat, setActiveChat] = useState(null);

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-b from-gray-900 to-gray-800">
      <Navbar />
      <div className="flex-1 flex overflow-hidden">
        <div className="w-1/4 h-full border-r border-gray-700 overflow-y-auto">
          <ChatSidebar onSelectChat={setActiveChat} activeChat={activeChat} />
        </div>
        <div className="w-3/4 h-full">
          {activeChat ? (
            <ChatWindow chatId={activeChat} />
          ) : (
            <div className="flex items-center justify-center h-full text-white">
              <h2 className="text-xl font-semibold">
                Select a chat to start messaging
              </h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
