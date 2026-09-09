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

    const followBtn = await screen.findByRole("button", { name: /Follow/i });
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
});
