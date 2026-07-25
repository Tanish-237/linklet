import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import ChatPage from "../ChatPage";
import { apiClient } from "../../api/apiClient";
import { BrowserRouter } from "react-router-dom";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    user: { _id: "user123", username: "testuser" },
  }),
}));

vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => ({
    emit: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  }),
}));

describe("ChatPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches user chats on mount and renders layout", async () => {
    console.log("TRACE [ChatPage.test.jsx]: Testing page mount and initial chat fetch");
    apiClient.get.mockImplementation((url) => {
      if (url === "/chat") {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                _id: "c1",
                isGroup: true,
                chatName: "General Lounge",
                participants: [{ _id: "user123" }],
              },
            ],
          },
        });
      }
      if (url.startsWith("/chat/message/")) {
        return Promise.resolve({
          data: {
            success: true,
            data: { messages: [], hasMore: false },
          },
        });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });

    render(
      <BrowserRouter>
        <ChatPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/chat");
      expect(screen.getAllByText("General Lounge")[0]).toBeInTheDocument();
    });
  });
});
