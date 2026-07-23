import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { API_BASE_URL } from "../config";
import { apiClient } from "../api/apiClient";
import { toast } from "react-toastify";
import { useEffect } from "react";
import styled from "styled-components";
import { useSocket } from "../hooks/useSocket";

const Nav = styled.nav`
  background-color: #111111;
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NavLinks = styled.div`
  display: flex;
  align-items: center;
  gap: 1.5rem;

  a,
  button {
    color: #f5f5f5;
    font-size: 1rem;
    transition: all 0.3s ease;
    background: none;
    border: none;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.375rem;

    &:hover {
      color: #8b5cf6;
      background: rgba(139, 92, 246, 0.1);
    }
  }
`;

const ProfileContainer = styled.div`
  position: relative;
`;

const ProfileButton = styled.button`
  display: flex;
  align-items: center;
  background: none;
  border: none;
  padding: 0.25rem;
  cursor: pointer;
  border-radius: 9999px;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(139, 92, 246, 0.1);
  }

  img {
    width: 2.5rem;
    height: 2.5rem;
    border-radius: 9999px;
    border: 2px solid #8b5cf6;
  }
`;

const DropdownMenu = styled.div`
  position: absolute;
  top: 100%;
  right: 0;
  margin-top: 0.5rem;
  background: #1a1a1a;
  border: 1px solid rgba(139, 92, 246, 0.2);
  border-radius: 0.75rem;
  padding: 0.5rem;
  min-width: 12rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);

  button {
    width: 100%;
    text-align: left;
    padding: 0.75rem 1rem;
    color: #f5f5f5;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    transition: all 0.3s ease;
    border-radius: 0.5rem;

    &:hover {
      background: rgba(139, 92, 246, 0.1);
      color: #8b5cf6;
    }
  }
`;

export const Navbar = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const socket = useSocket();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await apiClient.post(`/auth/logout`);
      toast.success("Logged out successfully");
      setUser(null);
      navigate("/");
    } catch (error) {
      toast.error("Failed to logout");
    }
  };

  return (
    <Nav>
      <Link to={user ? "/home" : "/"} style={{ textDecoration: "none" }}>
        <h2
          style={{ color: "#f5f5f5", fontSize: "1.5rem", fontWeight: "bold" }}
        >
          Linklet
        </h2>
      </Link>

      <NavLinks>
        {user ? (
          <>
            <Link to="/posts">Feed</Link>
            <Link to="/dashboard">Dashboard</Link>
            <ProfileContainer>
              <ProfileButton onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                <img
                  src={
                    user.avatar ||
                    "https://cdn-icons-png.flaticon.com/512/1326/1326382.png"
                  }
                  alt={user.username}
                />
              </ProfileButton>

              {isDropdownOpen && (
                <DropdownMenu>
                  <button onClick={() => navigate("/profile")}>
                    <span className="material-icons">person</span>
                    Profile
                  </button>
                  <button onClick={() => navigate("/settings")}>
                    <span className="material-icons">settings</span>
                    Settings
                  </button>
                  <button onClick={handleLogout}>
                    <span className="material-icons">logout</span>
                    Logout
                  </button>
                </DropdownMenu>
              )}
            </ProfileContainer>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            <Link to="/register">Sign Up</Link>
          </>
        )}
      </NavLinks>
    </Nav>
  );
};
