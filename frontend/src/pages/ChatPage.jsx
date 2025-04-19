import React, { useState } from "react";
import styled from "styled-components";
import ChatSidebar from "../components/ChatSidebar";
import ChatWindow from "../components/ChatWindow";
import NewGroupModal from "../components/NewGroupModal";

const ChatPageContainer = styled.div`
  display: flex;
  height: calc(100vh - 60px); // Subtract navbar height
`;

const ChatPage = () => {
  const [activeChat, setActiveChat] = useState(null);
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);

  const handleNewGroupCreated = (newGroup) => {
    setActiveChat(newGroup._id);
    setShowNewGroupModal(false);
  };

  return (
    <>
      <ChatPageContainer>
        <ChatSidebar onSelectChat={setActiveChat} activeChat={activeChat} />
        {activeChat ? (
          <ChatWindow chatId={activeChat} />
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              color: "white",
            }}
          >
            <h2>Select a chat to start messaging</h2>
          </div>
        )}
      </ChatPageContainer>

      {showNewGroupModal && (
        <NewGroupModal
          onClose={() => setShowNewGroupModal(false)}
          onCreate={handleNewGroupCreated}
        />
      )}
    </>
  );
};

export default ChatPage;
