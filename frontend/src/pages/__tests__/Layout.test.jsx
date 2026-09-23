import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "../Layout";
import { RELEASE_VERSION } from "../../components/WhatsNewDropdown";
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
    get: vi.fn(() => Promise.resolve({ data: { data: [] } })),
  },
}));

vi.mock("../../api/notification.api", () => ({
  getNotifications: vi.fn().mockResolvedValue({ success: true, data: [], unreadCount: 0 }),
  getUnreadCount: vi.fn().mockResolvedValue(0),
  markNotificationRead: vi.fn().mockResolvedValue({ success: true }),
  markAllNotificationsRead: vi.fn().mockResolvedValue({ success: true, unreadCount: 0 }),
  deleteNotification: vi.fn().mockResolvedValue({ success: true }),
  clearReadNotifications: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    message: vi.fn(),
  },
}));

// Node's own experimental global `localStorage` shadows jsdom's and throws
// without a --localstorage-file flag, so (as in WhatsNewDropdown.test.jsx)
// install a plain in-memory fake for the rail-expand persistence tests.
const fakeLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => {
      store[key] = String(value);
    },
    removeItem: (key) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();
globalThis.localStorage = fakeLocalStorage;

const mockSocketListeners = {};
const mockSocket = {
  on: vi.fn((event, cb) => {
    mockSocketListeners[event] = cb;
  }),
  off: vi.fn((event) => {
    delete mockSocketListeners[event];
  }),
  emit: vi.fn(),
};

vi.mock("../../hooks/useSocket", () => ({
  useSocket: () => mockSocket,
}));

describe("Layout Avatar Dropdown & Settings Navigation Tests", () => {
  const mockUser = {
    _id: "user123",
    username: "tanish",
    email: "tanish.20231111@mnnit.ac.in",
    avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=tanish",
  };

  let queryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockUser,
      setUser: vi.fn(),
      fetchUser: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={["/dashboard"]}>
          <Layout>
            <div>Child Content</div>
          </Layout>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("seeds the muted-chats cache from the server so muted chats stay silent on a fresh device", async () => {
    apiClient.get.mockResolvedValueOnce({ data: { data: ["chat_muted_1"] } });
    renderComponent();

    expect(apiClient.get).toHaveBeenCalledWith("/chat/chat-settings/muted");
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem("linklet_muted_chats_user123"))).toEqual(["chat_muted_1"])
    );
  });

  it("renders avatar trigger button with cursor-pointer and the user's avatar image", () => {
    console.log("TRACE [Layout.test.jsx]: Verifying avatar dropdown button styling and image");
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    expect(avatarBtn).toBeInTheDocument();
    expect(avatarBtn.className).toContain("cursor-pointer");
    expect(avatarBtn).toHaveAttribute("aria-expanded", "false");

    const avatarImg = avatarBtn.querySelector("img[alt='Avatar']");
    expect(avatarImg).toBeInTheDocument();
    console.log("TRACE [Layout.test.jsx]: Avatar trigger button verified with cursor-pointer and avatar image");
  });

  it("toggles dropdown open on avatar click, rendering username, email and menu options", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing dropdown open on avatar click");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    expect(avatarBtn).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(mockUser.username)).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Dropdown menu opened with username and email rendered");
  });

  it("navigates to /settings and closes dropdown when Settings option is clicked", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing Settings option navigation from avatar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const settingsBtn = document.getElementById("layout-dropdown-settings-btn");
    expect(settingsBtn).toBeInTheDocument();
    await user.click(settingsBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/settings");
    // Dropdown should be closed
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Successfully navigated to /settings and closed dropdown");
  });

  it("navigates to /profile and closes dropdown when Profile option is clicked", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing Profile option navigation from avatar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const profileBtn = document.getElementById("layout-dropdown-profile-btn");
    expect(profileBtn).toBeInTheDocument();
    await user.click(profileBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/profile");
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Successfully navigated to /profile and closed dropdown");
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

  it("ensures mutual exclusivity between notification and avatar dropdowns (only one opens at a time)", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing mutual exclusivity between notification and profile dropdowns");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    const bellBtn = screen.getByRole("button", { name: /Notifications/i });

    // Open avatar dropdown first
    await user.click(avatarBtn);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Notifications panel/i })).not.toBeInTheDocument();

    // Now click notification bell -> Avatar dropdown MUST close and notification panel MUST open
    await user.click(bellBtn);
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Notifications panel/i })).toBeInTheDocument();

    // Now click avatar button -> Notification panel MUST close and avatar dropdown MUST open
    await user.click(avatarBtn);
    expect(screen.queryByRole("dialog", { name: /Notifications panel/i })).not.toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();

    console.log("Passed: Only one dropdown opens at a time (mutually exclusive)");
  });

  it("verifies avatar dropdown shadow, border outline, and backdrop blur match notifications", async () => {
    console.log("TRACE [Layout.test.jsx]: Verifying avatar dropdown styles match notification dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const avatarDropdown = screen.getByText("Settings").closest(".shadow-2xl");
    expect(avatarDropdown.className).toContain("shadow-2xl");
    expect(avatarDropdown.className).toContain("border-gray-800");
    expect(avatarDropdown.className).toContain("backdrop-blur-xl");
    console.log("Passed: Avatar dropdown styling strictly matches notification dropdown");
  });

  it("renders What's New trigger button to the left of notifications in the header and opens dropdown", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing What's New button in header");
    const user = userEvent.setup();
    renderComponent();

    const whatsNewBtn = document.getElementById("whats-new-btn");
    expect(whatsNewBtn).toBeInTheDocument();
    expect(whatsNewBtn).toHaveAttribute("aria-label", "What's New in Linklet");

    // Click What's New button
    await user.click(whatsNewBtn);
    expect(screen.getByRole("dialog", { name: /What's New release notes/i })).toBeInTheDocument();
    expect(screen.getByText(`What's new in ${RELEASE_VERSION}`)).toBeInTheDocument();

    // Clicking notification bell closes What's New dropdown
    const bellBtn = screen.getByRole("button", { name: /Notifications/i });
    await user.click(bellBtn);
    expect(screen.queryByRole("dialog", { name: /What's New release notes/i })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: /Notifications panel/i })).toBeInTheDocument();

    console.log("Passed: What's New button opens simple release notes dropdown with mutual exclusivity");
  });

  it("opens release notes dropdown from Avatar menu item", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing What's New option in Avatar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const whatsNewMenuItem = document.getElementById("layout-dropdown-whats-new-btn");
    expect(whatsNewMenuItem).toBeInTheDocument();
    expect(whatsNewMenuItem).toHaveTextContent("What's New");

    await user.click(whatsNewMenuItem);
    expect(screen.getByRole("dialog", { name: /What's New release notes/i })).toBeInTheDocument();
    expect(screen.getByText(`What's new in ${RELEASE_VERSION}`)).toBeInTheDocument();
    console.log("Passed: What's New opened from Avatar menu");
  });

  describe("Rail Navigation Tests (left icon rail on desktop, bottom tab bar on mobile)", () => {
    it("has no top navbar and no hamburger/drawer — the rail is a single, always-present nav surface", () => {
      console.log("TRACE [Layout.test.jsx]: Verifying the drawer/hamburger pattern was removed");
      renderComponent();

      expect(document.getElementById("mobile-sidebar-toggle-btn")).not.toBeInTheDocument();
      expect(document.getElementById("mobile-sidebar-close-btn")).not.toBeInTheDocument();
      expect(document.getElementById("mobile-sidebar-backdrop")).not.toBeInTheDocument();
      expect(document.querySelector("header")).not.toBeInTheDocument();

      const sidebar = document.getElementById("app-sidebar");
      expect(sidebar).toBeInTheDocument();
      // No slide-in/out transform classes left over from the old drawer.
      expect(sidebar.className).not.toContain("translate-x");
      console.log("Passed: no header, hamburger, drawer or backdrop present");
    });

    it("renders all nav items with icon and label inside the rail", () => {
      console.log("TRACE [Layout.test.jsx]: Verifying rail nav items render with labels");
      renderComponent();

      const sidebar = document.getElementById("app-sidebar");
      ["Feed", "Dashboard", "Chat", "Resource Hub", "Saved", "Help Forum"].forEach((label) => {
        const item = screen.getByText(label);
        expect(sidebar.contains(item)).toBe(true);
      });
      console.log("Passed: all six nav items rendered inside the rail");
    });

    it("navigates directly when a nav item is clicked (no drawer to close)", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing direct navigation from a rail nav item");
      const user = userEvent.setup();
      renderComponent();

      const chatMenuItem = screen.getByText("Chat");
      await user.click(chatMenuItem);

      expect(mockNavigate).toHaveBeenCalledWith("/chat");
      console.log("Passed: clicking a nav item navigates immediately");
    });

    it("hides the logo while collapsed, and navigates home from it once the rail is expanded", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing rail logo visibility and click");
      const user = userEvent.setup();
      renderComponent();

      // Collapsed by default — no room for a logo next to the toggle, so it
      // isn't rendered at all (not just visually hidden).
      expect(screen.queryByAltText("Linklet Logo")).not.toBeInTheDocument();

      await user.click(document.getElementById("rail-expand-toggle-btn"));

      const logo = screen.getByAltText("Linklet Logo");
      await user.click(logo);

      expect(mockNavigate).toHaveBeenCalledWith("/home");
      console.log("Passed: logo only appears once expanded, and navigates to /home");
    });

    it("renders the theme toggle inside the rail's bottom cluster", () => {
      console.log("TRACE [Layout.test.jsx]: Verifying theme toggle lives in the rail, not a header");
      renderComponent();

      const sidebar = document.getElementById("app-sidebar");
      const themeBtn = document.getElementById("theme-toggle-btn");
      expect(themeBtn).toBeInTheDocument();
      expect(sidebar.contains(themeBtn)).toBe(true);
      console.log("Passed: theme toggle is part of the rail");
    });

    it("starts collapsed (icon rail) and extends into a full sidebar when the toggle is clicked", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing rail expand/collapse toggle");
      const user = userEvent.setup();
      renderComponent();

      const sidebar = document.getElementById("app-sidebar");
      const toggleBtn = document.getElementById("rail-expand-toggle-btn");
      expect(toggleBtn).toBeInTheDocument();
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
      expect(sidebar.className).toContain("md:w-20");
      // Wordmark is only rendered once expanded.
      expect(screen.queryByText("Linklet")).not.toBeInTheDocument();

      await user.click(toggleBtn);

      expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
      expect(sidebar.className).toContain("md:w-60");
      expect(screen.getByText("Linklet")).toBeInTheDocument();
      expect(localStorage.getItem("linklet_rail_expanded")).toBe("true");

      await user.click(toggleBtn);

      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
      expect(sidebar.className).toContain("md:w-20");
      expect(screen.queryByText("Linklet")).not.toBeInTheDocument();
      expect(localStorage.getItem("linklet_rail_expanded")).toBe("false");

      console.log("Passed: rail toggles between collapsed icon rail and expanded sidebar, persisting the choice");
    });

    it("remembers an expanded rail across remounts via localStorage", () => {
      console.log("TRACE [Layout.test.jsx]: Verifying rail expand preference persists");
      localStorage.setItem("linklet_rail_expanded", "true");
      renderComponent();

      const sidebar = document.getElementById("app-sidebar");
      expect(sidebar.className).toContain("md:w-60");
      expect(screen.getByText("Linklet")).toBeInTheDocument();
      console.log("Passed: previously expanded rail stays expanded on next render");
    });
  });

  describe("Global Chat Notifications & Sidebar Badge Tests", () => {
    it("increments unread chat badge on sidebar when a new message is received via socket", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing global chat socket message receipt and badge increment");
      renderComponent();

      expect(screen.queryByText("1")).not.toBeInTheDocument();

      // Simulate incoming socket message from another user
      const mockMsg = {
        _id: "m_incoming_999",
        content: "Hey, are you free for the project discussion?",
        sender: { _id: "user456", fullName: "Shubhrati", username: "shubhrati" },
        chat: { _id: "chat_abc123" },
      };

      // Find the registered message received handler on the socket
      const handler = mockSocketListeners["message received"];
      expect(handler).toBeDefined();
      handler(mockMsg);

      await waitFor(() => {
        expect(screen.getByText("1")).toBeInTheDocument();
      });

      console.log("Passed: Unread chat badge appeared on sidebar Chat item");
    });
  });
});


