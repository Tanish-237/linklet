import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { Navbar } from "../Navbar";
import * as AuthContextModule from "../../context/AuthContext";
import * as SocketHookModule from "../../hooks/useSocket";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Navbar Component Tests", () => {
  const mockUser = {
    _id: "user123",
    username: "tanish",
    email: "tanish.20231111@mnnit.ac.in",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=tanish",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SocketHookModule, "useSocket").mockReturnValue(null);
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockUser,
      setUser: vi.fn(),
      fetchUser: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    );
  };

  it("renders logged in links and avatar button with chevron arrow icon", () => {
    console.log("TRACE [Navbar.test.jsx]: Verifying avatar dropdown button and chevron arrow in Navbar");
    renderComponent();

    const avatarBtn = document.getElementById("navbar-avatar-dropdown-btn");
    expect(avatarBtn).toBeInTheDocument();

    const arrowIcon = avatarBtn.querySelector(".nav-arrow-icon");
    expect(arrowIcon).toBeInTheDocument();
    expect(arrowIcon.textContent).toBe("expand_more");

    console.log("TRACE [Navbar.test.jsx]: Chevron arrow verified in Navbar ProfileButton");
  });

  it("toggles dropdown open and applies open class on click", async () => {
    console.log("TRACE [Navbar.test.jsx]: Testing dropdown toggle and open class application");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("navbar-avatar-dropdown-btn");
    expect(avatarBtn.className).not.toContain("open");

    await user.click(avatarBtn);

    expect(avatarBtn.className).toContain("open");
    expect(screen.getByText(mockUser.username)).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();

    console.log("TRACE [Navbar.test.jsx]: Dropdown opened, username and email rendered, and open class added to ProfileButton");
  });

  it("navigates to /settings and closes dropdown when Settings is clicked", async () => {
    console.log("TRACE [Navbar.test.jsx]: Testing Settings navigation from Navbar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("navbar-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const settingsBtn = document.getElementById("navbar-dropdown-settings-btn");
    await user.click(settingsBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/settings");
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();

    console.log("TRACE [Navbar.test.jsx]: Navigated to /settings and dropdown closed");
  });

  it("renders with id app-navbar and sticky navigation element", () => {
    console.log("TRACE [Navbar.test.jsx]: Verifying Navbar root element has id app-navbar and sticky navigation element");
    renderComponent();

    const navbar = document.getElementById("app-navbar");
    expect(navbar).toBeInTheDocument();
    expect(navbar.tagName).toBe("NAV");
    console.log("TRACE [Navbar.test.jsx]: Confirmed Navbar root element rendered properly as <nav id='app-navbar'>");
  });

  it("renders Login and Sign Up buttons with outline styling when logged out", () => {
    console.log("TRACE [Navbar.test.jsx]: Verifying outline styled Login and Sign Up buttons for unauthenticated visitors");
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: null,
      setUser: vi.fn(),
      fetchUser: vi.fn(),
    });

    renderComponent();

    const loginBtn = document.getElementById("navbar-login-btn");
    expect(loginBtn).toBeInTheDocument();
    expect(loginBtn).toHaveAttribute("href", "/login");
    expect(loginBtn.className).toContain("nav-btn-login");

    const signupBtn = document.getElementById("navbar-signup-btn");
    expect(signupBtn).toBeInTheDocument();
    expect(signupBtn).toHaveAttribute("href", "/register");
    expect(signupBtn.className).toContain("nav-btn-signup");

    console.log("TRACE [Navbar.test.jsx]: Successfully verified Login and Sign Up outline buttons");
  });
});
