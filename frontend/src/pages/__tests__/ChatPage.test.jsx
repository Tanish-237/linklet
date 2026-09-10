import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

  it("allows selecting a chat and clicking top-left back button takes user back to all chats", async () => {
    console.log("TRACE [ChatPage.test.jsx]: Testing chat opening and back-to-all-chats navigation");
    apiClient.get.mockImplementation((url) => {
      if (url === "/chat") {
        return Promise.resolve({
          data: {
            success: true,
            data: [
              {
                _id: "chat-999",
                isGroup: true,
                chatName: "Design Systems Group",
                participants: [{ _id: "user123" }],
                updatedAt: new Date().toISOString(),
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

    window.innerWidth = 375;
    window.dispatchEvent(new Event("resize"));

    const queryClient3 = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient3}>
        <BrowserRouter>
          <ChatPage />
        </BrowserRouter>
      </QueryClientProvider>
    );

    // In mobile view, chat starts closed. Wait for chat item in sidebar
    const chatListItem = await screen.findByText("Design Systems Group");
    console.log("TRACE [ChatPage.test.jsx]: Found chat item in sidebar:", chatListItem.textContent);
    expect(chatListItem).toBeInTheDocument();

    // Select the chat
    fireEvent.click(chatListItem);
    console.log("TRACE [ChatPage.test.jsx]: Clicked chat item to open chat");

    // ChatWindow should now be rendered with the top-left back button
    await waitFor(() => {
      const backBtn = document.getElementById("chat-back-to-sidebar-btn");
      console.log("TRACE [ChatPage.test.jsx]: Back button present in ChatWindow:", Boolean(backBtn));
      expect(backBtn).toBeInTheDocument();
      expect(backBtn).toHaveAttribute("aria-label", "Back to all chats");
    });

    // Click the top-left back button
    const backBtn = document.getElementById("chat-back-to-sidebar-btn");
    fireEvent.click(backBtn);
    console.log("TRACE [ChatPage.test.jsx]: Clicked top-left back button, verifying return to all chats");

    // ChatWindow back button should no longer be present
    await waitFor(() => {
      const backBtnAfter = document.getElementById("chat-back-to-sidebar-btn");
      expect(backBtnAfter).not.toBeInTheDocument();
      // Selection placeholder should be visible
      expect(screen.getByText("Select a chat to start messaging")).toBeInTheDocument();
    });

    console.log("TRACE [ChatPage.test.jsx]: Successfully navigated back to all chats");
  });
});
