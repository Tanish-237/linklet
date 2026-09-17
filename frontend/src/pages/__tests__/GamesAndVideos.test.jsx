import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { io } from "socket.io-client";
import GamesAndVideos from "../GamesAndVideos";
import * as refreshTokenModule from "../../api/refreshToken";

vi.mock("socket.io-client", () => ({
  io: vi.fn(),
}));

vi.mock("../../api/refreshToken", async () => {
  const actual = await vi.importActual("../../api/refreshToken");
  return {
    ...actual,
    refreshAccessToken: vi.fn(),
  };
});

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

  it("connects the socket with a fresh access token read on each (re)connection attempt", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › authenticated visitor establishes a socket with their token");
    localStorage.setItem("accessToken", "real-jwt-token");

    render(<GamesAndVideos />);

    expect(io).toHaveBeenCalledTimes(1);
    const authOption = io.mock.calls[0][1].auth;
    // `auth` must be a function, not a static object, so a reconnect after a
    // token refresh picks up the NEW token instead of replaying the stale one.
    expect(typeof authOption).toBe("function");
    const cb = vi.fn();
    authOption(cb);
    expect(cb).toHaveBeenCalledWith({ token: "real-jwt-token" });
    console.log("[TEST] Verified auth is a function that reads the current token from storage");
  });

  it("recovers from an expired-token handshake rejection by refreshing and reconnecting, without alerting", async () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › connect_error with expired token triggers silent refresh + reconnect");
    localStorage.setItem("accessToken", "stale-jwt-token");
    refreshTokenModule.refreshAccessToken.mockResolvedValue("fresh-jwt-token");

    const connectMock = vi.fn();
    const handlers = {};
    const eventSocket = {
      on: vi.fn((event, cb) => { handlers[event] = cb; }),
      once: vi.fn(),
      emit: vi.fn(),
      close: vi.fn(),
      removeAllListeners: vi.fn(),
      connect: connectMock,
      connected: true,
    };
    io.mockReturnValue(eventSocket);

    render(<GamesAndVideos />);

    await handlers["connect_error"]({ message: "Invalid or expired token" });

    expect(refreshTokenModule.refreshAccessToken).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
    expect(window.alert).not.toHaveBeenCalled();
    console.log("[TEST] Verified: no 'server down' alert, refresh + reconnect happened instead");
  });
});
