import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

import { apiClient } from "../api/apiClient";
import { toast } from "sonner";
import { useEffect } from "react";
import "./Navbar.css";
import linkletLogo from "../assets/linklet-logo.webp";
import defaultAvatar from "../assets/default-avatar.webp";
import ThemeToggle from "../theme/ThemeToggle";
import { clearUserCaches } from "../store/useAuthStore";

export const Navbar = () => {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const profileContainerRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        profileContainerRef.current &&
        !profileContainerRef.current.contains(event.target)
      ) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient.post(`/auth/logout`);
      clearUserCaches();
      toast.success("Logged out successfully");
      setUser(null);
      navigate("/");
    } catch {
      toast.error("Failed to logout");
    }
  };

  return (
    <nav id="app-navbar" className="app-nav">
      <Link
        to={user ? "/home" : "/"}
        className="app-nav-brand"
      >
        <img
          src={linkletLogo}
          alt="Linklet Logo"
          className="app-nav-brand-logo"
        />
        <h2 className="app-nav-brand-name">
          Linklet
        </h2>
      </Link>

      <div className="app-nav-links">
        {user ? (
          <>
            <Link to="/posts">Feed</Link>
            <Link to="/dashboard">Dashboard</Link>
            <ThemeToggle />
            <div className="app-nav-profile" ref={profileContainerRef}>
              <button
                id="navbar-avatar-dropdown-btn"
                className={`app-nav-profile-btn${isDropdownOpen ? " open" : ""}`}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-expanded={isDropdownOpen}
                aria-label="User navigation menu"
              >
                <img
                  src={
                    user.avatar ||
                    defaultAvatar
                  }
                  alt={user.username}
                />
                <span className="material-icons nav-arrow-icon">
                  expand_more
                </span>
              </button>

              {isDropdownOpen && (
                <div className="app-nav-dropdown">
                  <div className="dropdown-header">
                    <div className="dropdown-username">
                      {user?.username || "User"}
                    </div>
                    {user?.email && (
                      <div className="dropdown-email">{user.email}</div>
                    )}
                  </div>
                  <ul>
                    <li>
                      <button
                        id="navbar-dropdown-profile-btn"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate("/profile");
                        }}
                      >
                        <span className="material-icons">person</span>
                        Profile
                      </button>
                    </li>
                    <li>
                      <button
                        id="navbar-dropdown-settings-btn"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          navigate("/settings");
                        }}
                      >
                        <span className="material-icons">settings</span>
                        Settings
                      </button>
                    </li>
                    <li className="logout-wrapper">
                      <button
                        id="navbar-dropdown-logout-btn"
                        className="logout-btn"
                        onClick={() => {
                          setIsDropdownOpen(false);
                          handleLogout();
                        }}
                      >
                        <span className="material-icons">logout</span>
                        Logout
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <ThemeToggle />
            <Link
              to="/login"
              className="app-nav-auth-link nav-auth-btn nav-btn-login"
              id="navbar-login-btn"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="app-nav-auth-link nav-auth-btn nav-btn-signup"
              id="navbar-signup-btn"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
};
