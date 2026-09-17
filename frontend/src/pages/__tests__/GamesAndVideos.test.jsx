import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { io } from "socket.io-client";
import GamesAndVideos from "../GamesAndVideos";

vi.mock("socket.io-client", () => ({
  io: vi.fn(),
}));

// jsdom in this project's test environment doesn't implement window.localStorage
// (see Saved.test.jsx / WhatsNewDropdown.test.jsx for the same workaround) —
// stub a minimal in-memory version so the component's localStorage.getItem/
// setItem calls resolve instead of throwing.
const fakeLocalStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
globalThis.localStorage = fakeLocalStorage;

describe("GamesAndVideos Component Tests", () => {
  const mockSocket = {
    on: vi.fn(),
    once: vi.fn(),
    emit: vi.fn(),
    close: vi.fn(),
    removeAllListeners: vi.fn(),
    connected: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    io.mockReturnValue(mockSocket);
    window.alert = vi.fn();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("does not open a socket connection for a signed-out visitor (public /games route)", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › anonymous visitor never triggers a socket handshake");
    localStorage.removeItem("accessToken");

    render(<GamesAndVideos />);

    // The backend rejects unauthenticated handshakes outright — connecting
    // anyway used to fire a misleading "check if the server is running" alert
    // on page load for every logged-out visitor.
    expect(io).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
    console.log("[TEST] Verified: no io() call, no alert, for a token-less visitor");
  });

  it("guides a signed-out visitor to log in instead of blaming the server when they try multiplayer", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › create-room without a session shows a login prompt");
    localStorage.removeItem("accessToken");

    render(<GamesAndVideos />);
    fireEvent.click(screen.getByText("Create Room"));

    expect(window.alert).toHaveBeenCalledWith("Please log in to play multiplayer games.");
    console.log("[TEST] Verified: login-prompt alert, not a false 'server down' message");
  });

  it("connects the socket with the stored access token when a user is signed in", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › authenticated visitor establishes a socket with their token");
    localStorage.setItem("accessToken", "real-jwt-token");

    render(<GamesAndVideos />);

    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ auth: { token: "real-jwt-token" } })
    );
    console.log("[TEST] Verified socket created with the signed-in user's access token");
  });
});
