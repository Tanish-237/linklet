import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import ChatWindow from "../ChatWindow";
import { apiClient } from "../../api/apiClient";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe("ChatWindow Component", () => {
  const sampleChat = {
    _id: "c1",
    isGroup: false,
    participants: [
      { _id: "u1", username: "me" },
      { _id: "u2", username: "alice" },
    ],
  };

  const sampleMessages = [
    {
      _id: "m1",
      sender: { _id: "u2", username: "alice" },
      content: "Hello there!",
      createdAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches and renders messages for active chat", async () => {
    console.log("TRACE [ChatWindow.test.jsx]: Testing message fetching and rendering");
    apiClient.get.mockResolvedValue({
      data: {
        success: true,
        data: { messages: sampleMessages, hasMore: false },
      },
    });

    render(
      <ChatWindow
        chat={sampleChat}
        currentUser={{ _id: "u1" }}
        socket={null}
        onToggleInfo={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/chat/message/c1");
      expect(screen.getByText("Hello there!")).toBeInTheDocument();
    });
  });
});
