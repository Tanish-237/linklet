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

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

  it("renders avatar button with cursor-pointer and chevron arrow", () => {
    console.log("TRACE [Layout.test.jsx]: Verifying avatar dropdown button styling and arrow");
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    expect(avatarBtn).toBeInTheDocument();
    expect(avatarBtn.className).toContain("cursor-pointer");

    const arrowIcon = avatarBtn.querySelector(".material-icons");
    expect(arrowIcon).toBeInTheDocument();
    expect(arrowIcon.textContent).toBe("expand_more");
    // Initially not rotated
    expect(arrowIcon.className).not.toContain("rotate-180");
    console.log("TRACE [Layout.test.jsx]: Avatar trigger button verified with cursor-pointer and expand_more");
  });

  it("toggles dropdown and applies rotate-180 rotation class to chevron arrow on open", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing dropdown open and arrow rotation");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const arrowIcon = avatarBtn.querySelector(".material-icons");
    expect(arrowIcon.className).toContain("rotate-180");
    expect(screen.getByText(mockUser.username)).toBeInTheDocument();
    expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Profile")).toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Dropdown menu opened, username and email rendered, and chevron arrow rotated 180 deg");
  });

  it("navigates to /dashboard/settings and closes dropdown when Settings option is clicked", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing Settings option navigation from avatar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const settingsBtn = document.getElementById("layout-dropdown-settings-btn");
    expect(settingsBtn).toBeInTheDocument();
    await user.click(settingsBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/settings");
    // Dropdown should be closed
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Successfully navigated to /dashboard/settings and closed dropdown");
  });

  it("navigates to /dashboard/profile and closes dropdown when Profile option is clicked", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing Profile option navigation from avatar dropdown");
    const user = userEvent.setup();
    renderComponent();

    const avatarBtn = document.getElementById("layout-avatar-dropdown-btn");
    await user.click(avatarBtn);

    const profileBtn = document.getElementById("layout-dropdown-profile-btn");
    expect(profileBtn).toBeInTheDocument();
    await user.click(profileBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/dashboard/profile");
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();

    console.log("TRACE [Layout.test.jsx]: Successfully navigated to /dashboard/profile and closed dropdown");
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

  it("opens release notes dropdown from sidebar footer version button", async () => {
    console.log("TRACE [Layout.test.jsx]: Testing sidebar version button click");
    const user = userEvent.setup();
    renderComponent();

    const sidebarVersionBtn = document.getElementById("sidebar-version-btn");
    expect(sidebarVersionBtn).toBeInTheDocument();

    await user.click(sidebarVersionBtn);
    expect(screen.getByRole("dialog", { name: /What's New release notes/i })).toBeInTheDocument();
    expect(screen.getByText(`What's new in ${RELEASE_VERSION}`)).toBeInTheDocument();
    console.log("Passed: What's New opened from sidebar footer version button");
  });

  describe("Mobile Sidebar Drawer & Top-Left Hamburger Navigation Tests", () => {
    it("renders top-left 3-line hamburger button with aria attributes and menu icon", () => {
      console.log("TRACE [Layout.test.jsx]: Verifying top-left hamburger menu button");
      renderComponent();

      const hamburgerBtn = document.getElementById("mobile-sidebar-toggle-btn");
      expect(hamburgerBtn).toBeInTheDocument();
      expect(hamburgerBtn).toHaveAttribute("aria-label", "Open sidebar menu");
      expect(hamburgerBtn).toHaveAttribute("aria-expanded", "false");

      const icon = hamburgerBtn.querySelector(".material-icons");
      expect(icon).toBeInTheDocument();
      expect(icon.textContent).toBe("menu");
      console.log("Passed: Hamburger menu button rendered with 3-lines menu icon and aria-label");
    });

    it("opens mobile drawer and backdrop when hamburger button is clicked", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing drawer open on hamburger click");
      const user = userEvent.setup();
      renderComponent();

      const sidebar = document.getElementById("app-sidebar");
      expect(sidebar.className).toContain("-translate-x-full");

      const hamburgerBtn = document.getElementById("mobile-sidebar-toggle-btn");
      await user.click(hamburgerBtn);

      // Now drawer should be translated into view
      expect(sidebar.className).toContain("translate-x-0");
      expect(hamburgerBtn).toHaveAttribute("aria-expanded", "true");

      // Backdrop overlay should be rendered
      const backdrop = document.getElementById("mobile-sidebar-backdrop");
      expect(backdrop).toBeInTheDocument();
      console.log("Passed: Sidebar translated to view and backdrop displayed on hamburger click");
    });

    it("closes mobile drawer when the close button inside drawer is clicked", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing drawer close button");
      const user = userEvent.setup();
      renderComponent();

      const hamburgerBtn = document.getElementById("mobile-sidebar-toggle-btn");
      await user.click(hamburgerBtn);

      const closeBtn = document.getElementById("mobile-sidebar-close-btn");
      expect(closeBtn).toBeInTheDocument();
      await user.click(closeBtn);

      const sidebar = document.getElementById("app-sidebar");
      expect(sidebar.className).toContain("-translate-x-full");
      expect(document.getElementById("mobile-sidebar-backdrop")).not.toBeInTheDocument();
      console.log("Passed: Drawer successfully closed on close button click");
    });

    it("closes mobile drawer when clicking the backdrop overlay", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing drawer close on backdrop click");
      const user = userEvent.setup();
      renderComponent();

      const hamburgerBtn = document.getElementById("mobile-sidebar-toggle-btn");
      await user.click(hamburgerBtn);

      const backdrop = document.getElementById("mobile-sidebar-backdrop");
      expect(backdrop).toBeInTheDocument();
      await user.click(backdrop);

      const sidebar = document.getElementById("app-sidebar");
      expect(sidebar.className).toContain("-translate-x-full");
      expect(document.getElementById("mobile-sidebar-backdrop")).not.toBeInTheDocument();
      console.log("Passed: Drawer closed upon clicking backdrop");
    });

    it("closes mobile drawer and navigates when clicking a navigation link", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing navigation item click inside drawer");
      const user = userEvent.setup();
      renderComponent();

      const hamburgerBtn = document.getElementById("mobile-sidebar-toggle-btn");
      await user.click(hamburgerBtn);

      const chatMenuItem = screen.getByText("Chat");
      await user.click(chatMenuItem);

      expect(mockNavigate).toHaveBeenCalledWith("/dashboard/chat");
      const sidebar = document.getElementById("app-sidebar");
      expect(sidebar.className).toContain("-translate-x-full");
      console.log("Passed: Drawer closed and navigated to /dashboard/chat on menu item click");
    });

    it("closes mobile drawer when pressing the Escape key", async () => {
      console.log("TRACE [Layout.test.jsx]: Testing drawer close on Escape key press");
      const user = userEvent.setup();
      renderComponent();

      const hamburgerBtn = document.getElementById("mobile-sidebar-toggle-btn");
      await user.click(hamburgerBtn);

      const sidebar = document.getElementById("app-sidebar");
      expect(sidebar.className).toContain("translate-x-0");

      fireEvent.keyDown(document, { key: "Escape" });

      expect(sidebar.className).toContain("-translate-x-full");
      expect(document.getElementById("mobile-sidebar-backdrop")).not.toBeInTheDocument();
      console.log("Passed: Drawer closed on Escape key press");
    });
  });
});


