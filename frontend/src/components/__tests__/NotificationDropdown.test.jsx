import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NotificationDropdown from "../NotificationDropdown";
import * as NotificationApi from "../../api/notification.api";
import * as AuthStoreModule from "../../store/useAuthStore";
import * as SocketHookModule from "../../hooks/useSocket";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../api/notification.api", () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  deleteNotification: vi.fn(),
  clearReadNotifications: vi.fn(),
}));

describe("NotificationDropdown Component Tests", () => {
  let queryClient;
  const mockUser = { _id: "user_test_456", username: "tanish" };
  const mockSocketOn = vi.fn();
  const mockSocketOff = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.spyOn(AuthStoreModule, "default").mockReturnValue({
      user: mockUser,
    });

    vi.spyOn(SocketHookModule, "useSocket").mockReturnValue({
      connected: true,
      on: mockSocketOn,
      off: mockSocketOff,
    });

    NotificationApi.getUnreadCount.mockResolvedValue(2);
    NotificationApi.getNotifications.mockResolvedValue({
      success: true,
      data: [
        {
          _id: "notif_1",
          type: "FORUM_ANSWER",
          title: "New Answer",
          message: "Someone answered your DSA question",
          link: "/dashboard/question/q1",
          isRead: false,
          sender: { username: "rahul", fullName: "Rahul Kumar" },
          createdAt: new Date().toISOString(),
        },
        {
          _id: "notif_2",
          type: "POST_COMMENT",
          title: "New Comment",
          message: "Nice campus picture!",
          link: "/posts/p1",
          isRead: true,
          sender: { username: "priya", fullName: "Priya Singh" },
          createdAt: new Date().toISOString(),
        },
      ],
      unreadCount: 1,
    });
    NotificationApi.markNotificationRead.mockResolvedValue({ success: true });
    NotificationApi.markAllNotificationsRead.mockResolvedValue({ success: true, unreadCount: 0 });
    NotificationApi.deleteNotification.mockResolvedValue({ success: true });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <NotificationDropdown />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("renders bell trigger button and unread count badge", async () => {
    console.log("TRACE [NotificationDropdown.test.jsx]: Verifying bell trigger and unread badge");
    renderComponent();

    const bellBtn = screen.getByRole("button", { name: /Notifications/i });
    expect(bellBtn).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
    console.log("Passed: Bell icon and unread count badge rendered");
  });

  it("opens dropdown on click and displays notification items", async () => {
    console.log("TRACE [NotificationDropdown.test.jsx]: Testing dropdown expansion and items");
    const user = userEvent.setup();
    renderComponent();

    const bellBtn = screen.getByRole("button", { name: /Notifications/i });
    await user.click(bellBtn);

    expect(screen.getByRole("dialog", { name: /Notifications panel/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("New Answer")).toBeInTheDocument();
      expect(screen.getByText("Someone answered your DSA question")).toBeInTheDocument();
      expect(screen.getByText("New Comment")).toBeInTheDocument();
    });
    console.log("Passed: Notifications dropdown displayed with items");
  });

  it("clicking a notification marks it as read and navigates to target link", async () => {
    console.log("TRACE [NotificationDropdown.test.jsx]: Testing notification click & navigate");
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole("button", { name: /Notifications/i }));

    await waitFor(() => {
      expect(screen.getByText("New Answer")).toBeInTheDocument();
    });

    await user.click(screen.getByText("New Answer"));

    expect(NotificationApi.markNotificationRead).toHaveBeenCalledWith("notif_1");
    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/question/q1");
    console.log("Passed: Notification marked read and navigated to /dashboard/question/q1");
  });

  it("clicking 'Mark all read' triggers bulk read mutation", async () => {
    console.log("TRACE [NotificationDropdown.test.jsx]: Testing 'Mark all read' action");
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole("button", { name: /Notifications/i }));

    await waitFor(() => {
      expect(screen.getByText(/Mark all read/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Mark all read/i));

    expect(NotificationApi.markAllNotificationsRead).toHaveBeenCalled();
    console.log("Passed: Mark all notifications read invoked");
  });

  it("registers real-time socket listeners for incoming notifications", () => {
    console.log("TRACE [NotificationDropdown.test.jsx]: Verifying socket subscription");
    renderComponent();

    expect(mockSocketOn).toHaveBeenCalledWith("notification:new", expect.any(Function));
    expect(mockSocketOn).toHaveBeenCalledWith("notification:count_updated", expect.any(Function));
    console.log("Passed: Socket listeners registered");
  });
});
