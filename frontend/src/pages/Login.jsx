import React, { useState } from "react";
import styled from "styled-components";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { handleApiError } from "../utlis/ErrorHandler";
import { useAuth } from "../context/AuthContext";

const LoginContainer = styled.div`
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

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { setUser, fetchUser } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post(
        "http://localhost:5000/api/login",
        {
          email,
          password,
        },
        {
          withCredentials: true,
        }
      );
      if (res.status === 200) {
        toast.success("Logged In Successfully");
        await fetchUser();
        navigate("/home");
      }
    } catch (error) {
      handleApiError(error);
    }
  };

  return (
    <LoginContainer>
      <h2>Login</h2>
      <Input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <Button onClick={handleLogin}>Login</Button>
    </LoginContainer>
  );
};

export default Login;
