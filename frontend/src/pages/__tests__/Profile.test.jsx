import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Profile from "../Profile";
import { apiClient } from "../../api/apiClient";
import { useAuth } from "../../context/AuthContext";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

describe("Profile Component", () => {
  const mockCurrentUser = {
    _id: "user123",
    username: "alex",
    fullName: "Alex Smith",
    following: [],
  };

  const mockOtherUser = {
    _id: "user456",
    username: "jordan",
    fullName: "Jordan Lee",
    bio: "Computer Science Enthusiast",
    skills: ["React", "Node.js"],
    section: "CS",
    subSection: "CS1",
    followersCount: 10,
    followingCount: 5,
    postsCount: 2,
    following: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (initialPath = "/dashboard/profile/jordan") => {
    return render(
      <HelmetProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <Routes>
            <Route path="/dashboard/profile/:username" element={<Profile />} />
          </Routes>
        </MemoryRouter>
      </HelmetProvider>
    );
  };

  it("renders follow button on another user profile with modernized styling class", async () => {
    console.log("TRACE [Profile.test.jsx]: Testing other user profile view");
    useAuth.mockReturnValue({
      user: mockCurrentUser,
      fetchUser: vi.fn(),
    });

    apiClient.get.mockImplementation((url) => {
      if (url.includes("/profile/jordan")) {
        return Promise.resolve({ data: { data: mockOtherUser } });
      }
      if (url.includes("/posts/user/")) {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderComponent("/dashboard/profile/jordan");

    const followBtnText = await screen.findByText("Follow");
    const followBtn = followBtnText.closest("button");
    console.log("TRACE [Profile.test.jsx]: Found follow button:", followBtn.className);
    expect(followBtn).toBeInTheDocument();
    expect(followBtn).toHaveClass("profile-btn-follow");
  });

  it("renders edit profile button on own profile and opens edit modal with solid primary save button", async () => {
    console.log("TRACE [Profile.test.jsx]: Testing own profile view");
    useAuth.mockReturnValue({
      user: mockCurrentUser,
      fetchUser: vi.fn(),
    });

    apiClient.get.mockImplementation((url) => {
      if (url.includes("/profile/alex")) {
        return Promise.resolve({ data: { data: mockCurrentUser } });
      }
      if (url.includes("/posts/user/")) {
        return Promise.resolve({ data: { data: [] } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderComponent("/dashboard/profile/alex");

    const editBtn = await screen.findByRole("button", { name: /Edit Profile/i });
    console.log("TRACE [Profile.test.jsx]: Found edit button:", editBtn.className);
    expect(editBtn).toBeInTheDocument();

    fireEvent.click(editBtn);
    console.log("TRACE [Profile.test.jsx]: Clicked edit button, verifying modal opens");

    await waitFor(() => {
      const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
      console.log("TRACE [Profile.test.jsx]: Found save changes button:", saveBtn.className);
      expect(saveBtn).toBeInTheDocument();
      expect(saveBtn).toHaveClass("profile-btn-primary");
    });
    console.log("TRACE [Profile.test.jsx]: Modal verified with solid primary save button");
  });

  it("renders admin badge without lightning emoji on admin profile", async () => {
    console.log("TRACE [Profile.test.jsx]: Testing admin role badge formatting");
    const adminUser = {
      ...mockOtherUser,
      role: "admin",
    };

    useAuth.mockReturnValue({
      user: mockCurrentUser,
      fetchUser: vi.fn(),
    });

    apiClient.get.mockImplementation((url) => {
      if (url.includes("/profile/jordan")) {
        return Promise.resolve({ data: { data: adminUser } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderComponent("/dashboard/profile/jordan");

    const badge = await screen.findByText("admin");
    expect(badge).toBeInTheDocument();
    expect(badge.textContent).toBe("admin");
    expect(badge.textContent).not.toContain("⚡");
    console.log("Passed: Admin badge rendered cleanly without lightning emoji");
  });

  it("switches to the followers tab in place when clicking the followers stat card, with no separate modal", async () => {
    console.log("TRACE [Profile.test.jsx]: Testing followers stat card switches the in-page tab instead of opening a modal");
    useAuth.mockReturnValue({
      user: mockCurrentUser,
      fetchUser: vi.fn(),
    });

    const mockFollowersList = [
      { _id: "f1", username: "alice", fullName: "Alice Wonder", department: "Computer Science" },
      { _id: "f2", username: "charlie", fullName: "Charlie Day", department: "Electronics" },
    ];

    apiClient.get.mockImplementation((url) => {
      if (url.endsWith("/profile/jordan/followers")) {
        return Promise.resolve({ data: { success: true, data: mockFollowersList } });
      }
      if (url.includes("/profile/jordan")) {
        return Promise.resolve({ data: { data: mockOtherUser } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderComponent("/dashboard/profile/jordan");

    const followersCard = await screen.findByRole("button", { name: /view followers/i });
    expect(followersCard).toBeInTheDocument();

    fireEvent.click(followersCard);

    await waitFor(() => {
      expect(screen.getByText("Alice Wonder")).toBeInTheDocument();
      expect(screen.getByText("Charlie Day")).toBeInTheDocument();
    });

    // There's no separate modal to close — the list rendered directly in the tab content.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /close modal/i })).not.toBeInTheDocument();

    console.log("Passed: Followers stat card switched the in-page tab and displayed follower users, no modal involved");
  });

  it("renders and switches to followers tab directly in profile itself and displays followers", async () => {
    console.log("TRACE [Profile.test.jsx]: Testing in-profile followers tab and header button");
    useAuth.mockReturnValue({
      user: mockCurrentUser,
      fetchUser: vi.fn(),
    });

    const mockFollowersList = [
      { _id: "f1", username: "alice", fullName: "Alice Wonder", department: "Computer Science" },
      { _id: "f2", username: "charlie", fullName: "Charlie Day", department: "Electronics" },
    ];

    apiClient.get.mockImplementation((url) => {
      if (url.endsWith("/profile/jordan/followers")) {
        return Promise.resolve({ data: { success: true, data: mockFollowersList } });
      }
      if (url.includes("/profile/jordan")) {
        return Promise.resolve({ data: { data: mockOtherUser } });
      }
      return Promise.resolve({ data: { data: [] } });
    });

    renderComponent("/dashboard/profile/jordan");

    // Header counter buttons are present in profile itself
    const headerFollowersBtn = await screen.findByRole("button", { name: /followers count/i });
    expect(headerFollowersBtn).toBeInTheDocument();
    console.log("Passed: Header followers counter button is clickable in profile itself");

    // Click followers tab in profile tabs
    const followersTabBtn = screen.getByRole("button", { name: /group\s*Followers/i });
    expect(followersTabBtn).toBeInTheDocument();
    fireEvent.click(followersTabBtn);

    await waitFor(() => {
      expect(screen.getByText("Alice Wonder")).toBeInTheDocument();
      expect(screen.getByText("Charlie Day")).toBeInTheDocument();
    });
    console.log("Passed: In-profile followers tab displayed followers directly on profile page");
  });
});
