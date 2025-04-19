import React, { useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { handleApiError } from "../utlis/ErrorHandler";

const RegisterContainer = styled.div`
  max-width: 400px;
  margin: 50px auto;
  padding: 30px;
  background-color: #1a1a1a;
  border-radius: 8px;
  box-shadow: 0 2px 15px rgba(0, 0, 0, 0.1);
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

const FileInputLabel = styled.label`
  display: block;
  margin: 10px 0;
  color: #f5f5f5;
  font-size: 14px;
`;

const AvatarPreview = styled.img`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  margin: 10px 0;
  display: ${(props) => (props.src ? "block" : "none")};
`;

const Register = () => {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const navigate = useNavigate();
  const { setUser, fetchUser } = useAuth();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatar(file);
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("username", username);
      formData.append("password", password);
      formData.append("fullName", fullName);
      if (avatar) {
        formData.append("avatar", avatar);
      }

      const res = await axios.post(
        "http://localhost:5000/api/register",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
        { withCredentials: true }
      );

      if (res.status === 201) {
        toast.success("Registration successful! Please login.");
        await fetchUser();
        navigate("/login");
      }
    } catch (error) {
      handleApiError(error);
    }
  };

  return (
    <RegisterContainer>
      <h2>Register</h2>
      <Input
        type="text"
        placeholder="fullName"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        required
      />
      <Input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <FileInputLabel>
        Avatar:
        <Input type="file" accept="image/*" onChange={handleAvatarChange} />
      </FileInputLabel>

      <AvatarPreview src={avatarPreview || null} alt="Avatar preview" />

      <Button onClick={handleRegister}>Register</Button>
    </RegisterContainer>
  );
};

export default Register;
