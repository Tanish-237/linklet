import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, it, expect } from "vitest";
import WhatsNewDropdown, {
  RELEASE_VERSION,
  STORAGE_KEY,
  isReleaseSeen,
  markReleaseSeen,
} from "../WhatsNewDropdown";

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

describe("WhatsNewDropdown Component Tests (Production Rollout Behavior)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fakeLocalStorage.clear();
  });

  it("renders What's New trigger button when version has not been seen yet", () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Verifying trigger button render for unread rollout");
    render(<WhatsNewDropdown forceShow={false} />);

    const triggerBtn = screen.getByRole("button", { name: /What's New in Linklet/i });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.getByText("What's New")).toBeInTheDocument();
    expect(screen.getByText(RELEASE_VERSION)).toBeInTheDocument();
    console.log("Passed: Trigger button rendered for unseen version rollout");
  });

  it("toggles dropdown on click and displays human-written release notes", async () => {
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
    expect(screen.getByText(`What's new in ${RELEASE_VERSION}`)).toBeInTheDocument();
    expect(screen.getByText(/New navigation:/i)).toBeInTheDocument();
    expect(screen.getByText(/Pages open instantly:/i)).toBeInTheDocument();
    expect(screen.getByText(/Truer online status:/i)).toBeInTheDocument();
    expect(screen.getByText(/Jump to any message:/i)).toBeInTheDocument();
    expect(screen.getByText(/Cleaner look:/i)).toBeInTheDocument();
    expect(screen.getByText("GitHub release").closest("a")).toHaveAttribute(
      "href",
      `https://github.com/Tanish-237/linklet/releases/tag/${RELEASE_VERSION}`
    );

    console.log("Passed: Dropdown opens with simple, human-written release notes");
  });

  it("persists version to localStorage and calls onMarkAsSeen when Dismiss is clicked", async () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Testing Dismiss action and production localStorage persistence");
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleMarkAsSeen = vi.fn();

    render(
      <WhatsNewDropdown
        isOpen={true}
        onToggle={vi.fn()}
        onClose={handleClose}
        onMarkAsSeen={handleMarkAsSeen}
        hasSeen={false}
      />
    );

    const dismissBtn = screen.getByRole("button", { name: /Dismiss/i });
    await user.click(dismissBtn);

    expect(fakeLocalStorage.getItem(STORAGE_KEY)).toBe(RELEASE_VERSION);
    expect(handleMarkAsSeen).toHaveBeenCalled();
    expect(handleClose).toHaveBeenCalled();
    console.log("Passed: Dismiss persisted release version to localStorage");
  });

  it("hides header trigger button if version is already marked seen in localStorage", () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Verifying trigger button auto-hides once seen");
    markReleaseSeen(RELEASE_VERSION);

    const { container } = render(<WhatsNewDropdown forceShow={false} />);
    expect(screen.queryByRole("button", { name: /What's New in Linklet/i })).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
    console.log("Passed: Header trigger button hidden once seen to avoid navbar clutter");
  });

  it("renders release notes dialog when isOpen is true even if already seen (e.g. opened from menu)", () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Verifying release notes accessible when opened from menu");
    markReleaseSeen(RELEASE_VERSION);

    render(
      <WhatsNewDropdown
        isOpen={true}
        onToggle={vi.fn()}
        onClose={vi.fn()}
        hasSeen={true}
      />
    );

    // Dialog is visible
    expect(screen.getByRole("dialog", { name: /What's New release notes/i })).toBeInTheDocument();
    expect(screen.getByText(`What's new in ${RELEASE_VERSION}`)).toBeInTheDocument();
    // But trigger button is NOT rendered
    expect(screen.queryByRole("button", { name: /What's New in Linklet/i })).not.toBeInTheDocument();
    console.log("Passed: Dialog displays cleanly without header trigger when opened from menu");
  });

  it("verifies isReleaseSeen and markReleaseSeen helper methods", () => {
    console.log("TRACE [WhatsNewDropdown.test.jsx]: Testing isReleaseSeen and markReleaseSeen");
    expect(isReleaseSeen(RELEASE_VERSION)).toBe(false);
    markReleaseSeen(RELEASE_VERSION);
    expect(isReleaseSeen(RELEASE_VERSION)).toBe(true);
    console.log("Passed: isReleaseSeen and markReleaseSeen work as expected");
  });
});
