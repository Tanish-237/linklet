import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import CreatePost from "../CreatePost";
import { useAuth } from "../../context/AuthContext";
import { apiClient } from "../../api/apiClient";

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

describe("CreatePost Page", () => {
  const mockUser = {
    _id: "u1",
    username: "alexsmith",
    avatar: "https://example.com/avatar.png",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useAuth.mockReturnValue({
      user: mockUser,
    });
  });

  const renderComponent = () => {
    return render(
      <BrowserRouter>
        <CreatePost />
      </BrowserRouter>
    );
  };

  it("renders modernized card header and action button, enabling post on input", () => {
    console.log("TRACE [CreatePost.test.jsx]: Rendering CreatePost component");
    renderComponent();

    const heading = screen.getByRole("heading", { level: 1, name: /Create Post/i });
    console.log("TRACE [CreatePost.test.jsx]: Verified heading rendered:", heading.textContent);
    expect(heading).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Post/i });
    console.log("TRACE [CreatePost.test.jsx]: Submit button initial disabled state:", submitBtn.disabled);
    expect(submitBtn).toBeDisabled();

    const textarea = screen.getByPlaceholderText(/What's on your mind\?/i);
    fireEvent.change(textarea, { target: { value: "Excited to share our new project!" } });
    console.log("TRACE [CreatePost.test.jsx]: Entered post caption");

    expect(submitBtn).not.toBeDisabled();
    expect(submitBtn).toHaveClass("bg-violet-600");
  });
});
