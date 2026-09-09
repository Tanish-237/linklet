import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { vi, describe, beforeEach, it, expect } from "vitest";
import ChatPage from "../ChatPage";
import { apiClient } from "../../api/apiClient";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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

const mockSocketOn = vi.fn();
const mockSocketOff = vi.fn();
const mockSocketEmit = vi.fn();

vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => ({
    emit: mockSocketEmit,
    on: mockSocketOn,
    off: mockSocketOff,
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

    const queryClient1 = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient1}>
        <BrowserRouter>
          <ChatPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/chat");
      expect(screen.getAllByText("General Lounge")[0]).toBeInTheDocument();
    });
  });

  it("subscribes to incremental presence events (user_connected, user_disconnected) and unregisters on unmount", async () => {
    console.log("TRACE [ChatPage.test.jsx]: Testing delta presence event subscription");
    apiClient.get.mockResolvedValue({ data: { success: true, data: [] } });

    const queryClient2 = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { unmount } = render(
      <QueryClientProvider client={queryClient2}>
        <BrowserRouter>
          <ChatPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    const registeredEvents = mockSocketOn.mock.calls.map((call) => call[0]);
    console.log("TRACE [ChatPage.test.jsx]: Registered socket events:", registeredEvents);

    expect(registeredEvents).toContain("user online status");
    expect(registeredEvents).toContain("user_connected");
    expect(registeredEvents).toContain("user_disconnected");

    unmount();

    const unregisteredEvents = mockSocketOff.mock.calls.map((call) => call[0]);
    console.log("TRACE [ChatPage.test.jsx]: Unregistered socket events:", unregisteredEvents);
    expect(unregisteredEvents).toContain("user online status");
    expect(unregisteredEvents).toContain("user_connected");
    expect(unregisteredEvents).toContain("user_disconnected");
  });
});
