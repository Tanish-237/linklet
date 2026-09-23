import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Settings from "../Settings";
import { apiClient } from "../../api/apiClient";
import * as AuthContextModule from "../../context/AuthContext";
import * as SocketHookModule from "../../hooks/useSocket";

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("Settings Page Component Tests", () => {
  const mockUser = {
    _id: "user_test_123",
    username: "tanish",
    fullName: "Tanish Sharma",
    email: "tanish.20231111@mnnit.ac.in",
    role: "user",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SocketHookModule, "useSocket").mockReturnValue({
      connected: true,
      on: vi.fn(),
      off: vi.fn(),
    });
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: mockUser,
      setUser: vi.fn(),
      fetchUser: vi.fn(),
    });
  });

  const renderComponent = () => {
    return render(
      <HelmetProvider>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </HelmetProvider>
    );
  };

  it("renders default Account & Security tab without Profile/Academic tab or Academic Year box", () => {
    console.log("TRACE [Settings.test.jsx]: Verifying absence of Profile/Academic tab and Academic Year card");
    renderComponent();

    // Verify Profile & Academic tab does NOT exist
    expect(screen.queryByRole("tab", { name: /Profile & Academic/i })).not.toBeInTheDocument();

    // Verify default active tab is Account & Security
    const securityTab = screen.getByRole("tab", { name: /Account & Security/i });
    expect(securityTab).toBeInTheDocument();
    expect(securityTab.className).toContain("active");

    // Verify email and role are rendered
    expect(screen.getByText("tanish.20231111@mnnit.ac.in")).toBeInTheDocument();
    expect(screen.getByText("user")).toBeInTheDocument();

    // Verify Academic Year card is removed
    expect(screen.queryByText(/Academic Year/i)).not.toBeInTheDocument();

    console.log("TRACE [Settings.test.jsx]: Account & Security tab verified with clean layout");
  });

  it("handles password change submission with validation", async () => {
    console.log("TRACE [Settings.test.jsx]: Testing password change in Security tab");
    const user = userEvent.setup();
    apiClient.post.mockResolvedValueOnce({
      data: {
        success: true,
        message: "Password changed successfully",
      },
    });

    renderComponent();

    const currentPassInput = screen.getByLabelText(/Current Password/i);
    const newPassInput = screen.getByLabelText(/^New Password/i);
    const confirmPassInput = screen.getByLabelText(/Confirm New Password/i);

    await user.type(currentPassInput, "OldSecret123!");
    await user.type(newPassInput, "NewSecret456!");
    await user.type(confirmPassInput, "NewSecret456!");

    const updatePassBtn = screen.getByRole("button", { name: /Update Password/i });
    await user.click(updatePassBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/auth/change-password", {
        currentPassword: "OldSecret123!",
        newPassword: "NewSecret456!",
      });
    });

    console.log("TRACE [Settings.test.jsx]: Password change request submitted successfully");
  });

  it("switches to Preferences tab and displays the notification switches", async () => {
    console.log("TRACE [Settings.test.jsx]: Testing Preferences tab with notification options");
    const user = userEvent.setup();

    renderComponent();

    const prefsTab = screen.getByRole("tab", { name: /Preferences & Alerts/i });
    await user.click(prefsTab);

    expect(screen.getByText("Notification & Alerts Preferences")).toBeInTheDocument();

    // Attendance Guardian and Active badge pills should NOT exist
    expect(screen.queryByText(/Attendance Guardian/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Active/i)).not.toBeInTheDocument();

    // The unbuilt "Email Activity Digest" placeholder is gone
    expect(screen.queryByText(/Coming Soon/i)).not.toBeInTheDocument();

    // chat, forum, post, system — all on by default
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBe(4);
    checkboxes.forEach((cb) => expect(cb).toBeChecked());

    console.log("TRACE [Settings.test.jsx]: Notification preferences and clean toggles verified without pills");
  });

  it("saves a notification switch to the account and keeps it off", async () => {
    const setUser = vi.fn();
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({ user: mockUser, setUser, fetchUser: vi.fn() });
    apiClient.put.mockResolvedValue({
      data: { notificationPrefs: { chatAlerts: true, forumAlerts: false, postAlerts: true, systemAlerts: true } },
    });
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("tab", { name: /Preferences & Alerts/i }));

    const forumToggle = screen.getAllByRole("checkbox")[1];
    await user.click(forumToggle);

    expect(forumToggle).not.toBeChecked();
    expect(apiClient.put).toHaveBeenCalledWith("/profile/notification-preferences", { forumAlerts: false });
    await waitFor(() =>
      expect(setUser).toHaveBeenCalledWith(
        expect.objectContaining({ notificationPrefs: expect.objectContaining({ forumAlerts: false }) })
      )
    );
  });

  it("rolls a notification switch back if saving fails", async () => {
    apiClient.put.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole("tab", { name: /Preferences & Alerts/i }));

    const postToggle = screen.getAllByRole("checkbox")[2];
    await user.click(postToggle);

    await waitFor(() => expect(postToggle).toBeChecked());
  });

  it("switches to Display & App Info tab and verifies live diagnostics", async () => {
    console.log("TRACE [Settings.test.jsx]: Testing Display tab live diagnostics");
    const user = userEvent.setup();
    apiClient.get.mockResolvedValueOnce({ data: { success: true } });

    renderComponent();

    const displayTab = screen.getByRole("tab", { name: /Display & App Info/i });
    await user.click(displayTab);

    expect(screen.getByText("System & Build Information")).toBeInTheDocument();
    // Compact timetable should be removed
    expect(screen.queryByText(/Compact Timetable Timeline/i)).not.toBeInTheDocument();

    // Verify platform version and live socket connection
    expect(screen.getByText(/v\d+\.\d+\.\d+/i)).toBeInTheDocument();
    expect(screen.getByText(/Connected \(Live Socket\)/i)).toBeInTheDocument();

    console.log("TRACE [Settings.test.jsx]: Live diagnostics verified successfully");
  });
});
