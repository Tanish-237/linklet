import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
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

  it("styles the avatar dropdown as a floating panel, same as the notifications dropdown", async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(document.getElementById("layout-avatar-dropdown-btn"));

    const avatarDropdown = screen.getByText("Settings").closest(".shadow-popover");
    expect(avatarDropdown).not.toBeNull();
    expect(avatarDropdown.className).toContain("bg-popover");
    expect(avatarDropdown.className).toContain("border-line-strong");
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

    it("navigates home from the drawer's logo", async () => {
      const user = userEvent.setup();
      renderComponent();

      // The rail itself never shows the logo; the drawer does.
      expect(screen.queryByAltText("Linklet Logo")).not.toBeInTheDocument();
      await user.click(document.getElementById("rail-expand-toggle-btn"));
      await user.click(await screen.findByAltText("Linklet Logo"));

      // Navigation waits a frame so the drawer's slide-out can start first.
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/home"));
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

    it("opens a drawer OVER the page instead of widening the rail (nothing reflows)", async () => {
      const user = userEvent.setup();
      renderComponent();

      const sidebar = document.getElementById("app-sidebar");
      const toggleBtn = document.getElementById("rail-expand-toggle-btn");
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
      expect(document.getElementById("app-nav-drawer")).toBeNull();

      await user.click(toggleBtn);

      const drawer = await screen.findByRole("dialog", { name: "Main menu" });
      expect(toggleBtn).toHaveAttribute("aria-expanded", "true");
      expect(drawer.className).toContain("fixed");
      // The rail keeps its width — the drawer overlays it
      expect(sidebar.className).toContain("md:w-20");
      expect(sidebar.className).not.toContain("md:w-60");
    });

    it("closes the drawer with Escape and after navigating from it", async () => {
      const user = userEvent.setup();
      renderComponent();
      const toggleBtn = document.getElementById("rail-expand-toggle-btn");

      await user.click(toggleBtn);
      const drawer = await screen.findByRole("dialog", { name: "Main menu" });
      await waitFor(() => expect(drawer.hasAttribute("inert")).toBe(false));
      await user.keyboard("{Escape}");
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");

      await user.click(toggleBtn);
      const reopened = await screen.findByRole("dialog", { name: "Main menu" });
      await waitFor(() => expect(reopened.hasAttribute("inert")).toBe(false));
      await user.click(within(reopened).getByRole("button", { name: /Saved/ }));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/saved"));
      expect(toggleBtn).toHaveAttribute("aria-expanded", "false");
    });
  });

  describe("Phone bottom bar (Explore + three pages)", () => {
    it("shows only Explore, Feed, Dashboard and Chat on phones; the rest live in the drawer", () => {
      renderComponent();
      expect(document.getElementById("mobile-explore-btn").closest("li").className).toContain("md:hidden");
      const phoneVisible = (label) => !screen.getByTitle(label).className.includes("hidden md:flex");
      expect(["Feed", "Dashboard", "Chat"].every(phoneVisible)).toBe(true);
      expect(["Resource Hub", "Saved", "Help Forum"].some(phoneVisible)).toBe(false);
      // Bell and avatar are desktop-only triggers now
      expect(document.getElementById("notification-bell-btn").className).toContain("max-md:hidden");
      expect(document.getElementById("layout-avatar-dropdown-btn").className).toContain("max-md:hidden");
    });

    it("Explore opens the drawer with account rows, and Notifications opens the notifications panel", async () => {
      const user = userEvent.setup();
      renderComponent();

      await user.click(document.getElementById("mobile-explore-btn"));
      const drawer = await screen.findByRole("dialog", { name: "Main menu" });
      await waitFor(() => expect(drawer.hasAttribute("inert")).toBe(false));
      expect(within(drawer).getByRole("button", { name: /Settings/ })).toBeInTheDocument();
      expect(within(drawer).getByRole("button", { name: /Log out/ })).toBeInTheDocument();

      await user.click(within(drawer).getByRole("button", { name: /Notifications/ }));
      expect(document.getElementById("mobile-explore-btn")).toHaveAttribute("aria-expanded", "false");
      expect(document.getElementById("notification-bell-btn")).toHaveAttribute("aria-expanded", "true");
    });

    it("Settings in the drawer navigates and closes it", async () => {
      const user = userEvent.setup();
      renderComponent();
      await user.click(document.getElementById("mobile-explore-btn"));
      const drawer = await screen.findByRole("dialog", { name: "Main menu" });
      await waitFor(() => expect(drawer.hasAttribute("inert")).toBe(false));
      await user.click(within(drawer).getByRole("button", { name: /Settings/ }));
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/settings"));
      expect(document.getElementById("mobile-explore-btn")).toHaveAttribute("aria-expanded", "false");
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


