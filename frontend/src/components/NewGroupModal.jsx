import React, { useState, useEffect } from "react";
import styled from "styled-components";
import axios from "axios";
import { toast } from "react-toastify";

const ModalOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const ModalContent = styled.div`
  background-color: #1a1a1a;
  padding: 20px;
  border-radius: 10px;
  width: 400px;
  max-width: 90%;
`;

const ModalHeader = styled.h2`
  color: white;
  margin-bottom: 20px;
`;

const Input = styled.input`
  width: 100%;
  padding: 10px;
  margin-bottom: 15px;
  border-radius: 5px;
  border: none;
  background-color: #333;
  color: white;
`;

const UserItem = styled.div`
  display: flex;
  align-items: center;
  padding: 10px;
  margin-bottom: 10px;
  background-color: #333;
  border-radius: 5px;
  cursor: pointer;
  &:hover {
    background-color: #444;
  }
`;

const UserAvatar = styled.img`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  margin-right: 10px;
`;

const UserInfo = styled.div`
  flex: 1;
`;

const Username = styled.div`
  font-weight: bold;
  color: white;
`;

const Checkbox = styled.input`
  margin-left: 10px;
`;

const Button = styled.button`
  padding: 10px 20px;
  background-color: #1db954;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  margin-top: 20px;
  &:hover {
    background-color: #1ed760;
  }
`;

const NewGroupModal = ({ onClose, onCreate }) => {
  const [groupName, setGroupName] = useState("");
  const [users, setUsers] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [file, setFile] = useState(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get(
          "http://localhost:5000/api/chat/search?query=",
          {
            withCredentials: true,
          }
        );
        setUsers(res.data);
      } catch (error) {
        toast.error("Failed to fetch users");
      }
    };

    fetchUsers();
  }, []);

  const handleUserSelect = (userId) => {
    if (selectedUsers.includes(userId)) {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    } else {
      setSelectedUsers([...selectedUsers, userId]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName || selectedUsers.length < 2) {
      toast.error("Group name and at least 2 members are required");
      return;
    }

    const formData = new FormData();
    formData.append("name", groupName);
    formData.append("users", JSON.stringify(selectedUsers));
    if (file) formData.append("groupImage", file);

    try {
      const res = await axios.post(
        "http://localhost:5000/api/chat/group",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          withCredentials: true,
        }
      );
      onCreate(res.data);
      onClose();
    } catch (error) {
      toast.error("Failed to create group");
    }
  };

  return (
    <ModalOverlay onClick={onClose}>
      <ModalContent onClick={(e) => e.stopPropagation()}>
        <ModalHeader>Create New Group</ModalHeader>

        <Input
          type="text"
          placeholder="Group Name"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
        />

        <Input
          type="text"
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          accept="image/*"
        />

        <div style={{ maxHeight: "300px", overflowY: "auto" }}>
          {users
            .filter(
              (user) =>
                user.username
                  .toLowerCase()
                  .includes(searchQuery.toLowerCase()) ||
                user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((user) => (
              <UserItem
                key={user._id}
                onClick={() => handleUserSelect(user._id)}
              >
                <UserAvatar
                  src={
                    user.avatar ||
                    "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                  }
                />
                <UserInfo>
                  <Username>{user.username}</Username>
                </UserInfo>
                <Checkbox
                  type="checkbox"
                  checked={selectedUsers.includes(user._id)}
                  onChange={() => handleUserSelect(user._id)}
                />
              </UserItem>
            ))}
        </div>

        <Button onClick={handleCreateGroup}>Create Group</Button>
      </ModalContent>
    </ModalOverlay>
  );
};

export default NewGroupModal;
