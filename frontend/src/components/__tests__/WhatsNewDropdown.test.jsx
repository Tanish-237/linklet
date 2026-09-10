import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, afterEach, it, expect } from "vitest";
import WhatsNewDropdown, { RELEASE_VERSION, RELEASE_DATE, DISPLAY_DURATION_MS } from "../WhatsNewDropdown";

const fakeLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value.toString();
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

describe("WhatsNewDropdown Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeLocalStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders What's New trigger button when within 24 hours of release", () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Verifying trigger button render within 24h");
    render(<WhatsNewDropdown forceShow={true} />);

    const triggerBtn = screen.getByRole("button", { name: /What's New in Linklet/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(screen.getByText("v1.5")).toBeInTheDocument();
    console.log("Passed: Trigger button rendered with clean pill and version badge");
  });

  it("toggles simple dropdown on click and displays human-written release notes", async () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Testing dropdown open and human-written bullet points");
    const user = userEvent.setup();
    render(<WhatsNewDropdown forceShow={true} />);

    // Initially closed
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    // Click trigger
    const triggerBtn = screen.getByRole("button", { name: /What's New in Linklet/i });
    await user.click(triggerBtn);

    // Dropdown open
    const dialog = screen.getByRole("dialog", { name: /What's New release notes/i });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("What's new in v1.5")).toBeInTheDocument();
    expect(screen.getByText(/Live notifications:/i)).toBeInTheDocument();
    expect(screen.getByText(/Threaded reply notices:/i)).toBeInTheDocument();
    expect(screen.getByText(/Moderation alerts:/i)).toBeInTheDocument();
    expect(screen.getByText(/Faster load times:/i)).toBeInTheDocument();
    expect(screen.getByText("GitHub release")).toBeInTheDocument();

    console.log("Passed: Dropdown opens with simple, human-written release notes");
  });

  it("hides and remembers dismissal in localStorage when Dismiss button is clicked", async () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Testing Dismiss action and localStorage persistence");
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(
      <WhatsNewDropdown
        isOpen={true}
        onToggle={vi.fn()}
        onClose={handleClose}
        forceShow={false}
      />
    );

    const dismissBtn = screen.getByRole("button", { name: /Dismiss/i });
    await user.click(dismissBtn);

    expect(fakeLocalStorage.getItem(`linklet_whats_new_seen_${RELEASE_VERSION}`)).toBe("true");
    expect(handleClose).toHaveBeenCalled();
    console.log("Passed: Dismiss persisted to localStorage");
  });

  it("does not render when 24-hour expiration window has elapsed", () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Verifying 24h expiration window auto-hide");
    vi.useFakeTimers();
    // Set system time to 25 hours after RELEASE_DATE
    const releaseTime = new Date(RELEASE_DATE).getTime();
    vi.setSystemTime(new Date(releaseTime + DISPLAY_DURATION_MS + 3600000));

    const { container } = render(<WhatsNewDropdown forceShow={false} />);
    expect(container.firstChild).toBeNull();
    console.log("Passed: Automatically expired and hidden after 24 hours");
  });
});
