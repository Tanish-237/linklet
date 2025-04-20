import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import { toast } from "react-toastify";
import { useEffect } from "react";
import styled from "styled-components";
import { useSocket } from "../context/SocketContext";

const Nav = styled.nav`
  background-color: #111111;
  padding: 15px;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NavLinks = styled.div`
  a {
    color: #f5f5f5;
    margin: 0 15px;
    font-size: 18px;
    transition: color 0.3s ease;
    &:hover {
      color: #1db954;
    }
  }
`;

export const Navbar = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();

  const handleLogout = async () => {
    try {
      await axios.post(
        "http://localhost:5000/api/logout",
        {},
        {
          withCredentials: true,
        }
      );
      toast.success("Logged out");
      setUser(null);
      navigate("/");
    } catch {
      toast.error("Logout failed");
    }
  };

  return (
    <Nav>
      <h2>Linklet</h2>
      <NavLinks>
        <Link to="/">Home</Link>
        <Link to="/posts">Feed</Link>
        {!user ? (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Sign Up</Link>
          </>
        ) : (
          <>
            <Link to="/chat">Chat</Link>
            <button onClick={handleLogout}>Logout</button>
          </>
        )}
      </NavLinks>
    </Nav>
  );
};
