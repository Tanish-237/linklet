import React, { useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

const Container = styled.div`
  max-width: 500px;
  margin: 50px auto;
  padding: 30px;
  background-color: #1a1a1a;
  border-radius: 8px;
`;

const Title = styled.h2`
  color: white;
  margin-bottom: 20px;
`;

const Input = styled.input`
  width: 100%;
  padding: 12px;
  margin: 10px 0;
  background-color: #333;
  color: #f5f5f5;
  border: none;
  border-radius: 5px;
  font-size: 16px;
  outline: none;
`;

const Button = styled.button`
  width: 100%;
  padding: 12px;
  background-color: #1db954;
  color: #fff;
  border: none;
  border-radius: 5px;
  font-size: 18px;
  margin-top: 20px;
  transition: background-color 0.3s;
  &:hover {
    background-color: #1db954b3;
  }
`;

const NewGroupPage = () => {
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

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
      navigate(`/chat/${res.data._id}`);
    } catch (error) {
      toast.error("Failed to create group");
    }
  };

  return (
    <Container>
      <Title>Create New Group</Title>

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

      <div style={{ maxHeight: "300px", overflowY: "auto", margin: "20px 0" }}>
        {users
          .filter(
            (user) =>
              user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
              user.fullName.toLowerCase().includes(searchQuery.toLowerCase())
          )
          .map((user) => (
            <div
              key={user._id}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "10px",
                marginBottom: "10px",
                backgroundColor: "#333",
                borderRadius: "5px",
                cursor: "pointer",
              }}
              onClick={() => handleUserSelect(user._id)}
            >
              <img
                src={
                  user.avatar ||
                  "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                }
                alt={user.username}
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "50%",
                  marginRight: "10px",
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: "bold", color: "white" }}>
                  {user.username}
                </div>
              </div>
              <input
                type="checkbox"
                checked={selectedUsers.includes(user._id)}
                onChange={() => handleUserSelect(user._id)}
              />
            </div>
          ))}
      </div>

      <Button onClick={handleCreateGroup}>Create Group</Button>
    </Container>
  );
};

export default NewGroupPage;
