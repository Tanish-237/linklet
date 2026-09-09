import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import Layout from "../Layout";
import * as AuthContextModule from "../../context/AuthContext";
import { apiClient } from "../../api/apiClient";

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

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Layout Avatar Dropdown & Settings Navigation Tests", () => {
  const mockUser = {
    _id: "user123",
    username: "tanish",
    email: "tanish.20231111@mnnit.ac.in",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=tanish",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockUser,
      setUser: vi.fn(),
      fetchUser: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Layout>
          <div>Child Content</div>
        </Layout>
      </MemoryRouter>
    );
  };

  it("renders avatar button with cursor-pointer and chevron arrow", () => {
    console.log("TRACE [Layout.test.jsx]: Verifying avatar dropdown button styling and arrow");
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    expect(avatarBtn).toBeInTheDocument();
    expect(avatarBtn.className).toContain("cursor-pointer");

    const arrowIcon = avatarBtn.querySelector(".material-icons");
    expect(arrowIcon).toBeInTheDocument();
    expect(arrowIcon.textContent).toBe("expand_more");
    // Initially not rotated
    expect(arrowIcon.className).not.toContain("rotate-180");
    console.log("TRACE [Layout.test.jsx]: Avatar trigger button verified with cursor-pointer and expand_more");
  });

  it("toggles dropdown and applies rotate-180 rotation class to chevron arrow on open", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing dropdown open and arrow rotation");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const arrowIcon = avatarBtn.querySelector(".material-icons");
    expect(arrowIcon.className).toContain("rotate-180");
    expect(screen.getByText(mockUser.username)).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Dropdown menu opened, username and email rendered, and chevron arrow rotated 180 deg");
  });

  it("navigates to /dashboard/settings and closes dropdown when Settings option is clicked", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing Settings option navigation from avatar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const settingsBtn = document.getElementById("layout-dropdown-settings-btn");
    expect(settingsBtn).toBeInTheDocument();
    await user.click(settingsBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/settings");
    // Dropdown should be closed
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Successfully navigated to /dashboard/settings and closed dropdown");
  });

  it("navigates to /dashboard/profile and closes dropdown when Profile option is clicked", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing Profile option navigation from avatar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const profileBtn = document.getElementById("layout-dropdown-profile-btn");
    expect(profileBtn).toBeInTheDocument();
    await user.click(profileBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/profile");
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Successfully navigated to /dashboard/profile and closed dropdown");
  });

  it("calls logout and closes dropdown when Logout option is clicked", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing Logout option click from avatar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const logoutBtn = document.getElementById("layout-dropdown-logout-btn");
    expect(logoutBtn).toBeInTheDocument();
    await user.click(logoutBtn);

    expect(apiClient.post).toHaveBeenCalledWith("/auth/logout");
    expect(document.getElementById("layout-dropdown-logout-btn")).not.toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Successfully called logout endpoint and closed dropdown");
  });

  it("closes dropdown when clicking outside", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing click outside to close dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);
    expect(screen.getByText("Settings")).toBeInTheDocument();

    // Click outside
    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    });

    console.log("TRACE [Layout.test.jsx]: Dropdown closed on outside click");
  });
});
