import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { io } from "socket.io-client";
import GamesAndVideos from "../GamesAndVideos";
import * as refreshTokenModule from "../../api/refreshToken";
import { toast } from "sonner";
import useAuthStore from "../../store/useAuthStore";

vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn() } }));

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
  });

  afterEach(() => {
    localStorage.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  const signIn = () => useAuthStore.setState({ user: { _id: "u1", username: "tester" }, isAuthenticated: true });

  it("does not open a socket connection for a signed-out visitor (public /games route)", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › anonymous visitor never triggers a socket handshake");
    useAuthStore.setState({ user: null, isAuthenticated: false });

    render(<GamesAndVideos />);

    // The backend rejects unauthenticated handshakes outright — connecting
    // anyway used to fire a misleading "check if the server is running" alert
    // on page load for every logged-out visitor.
    expect(io).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    console.log("[TEST] Verified: no io() call, no error toast, for a token-less visitor");
  });

  it("guides a signed-out visitor to log in instead of blaming the server when they try multiplayer", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › create-room without a session shows a login prompt");
    useAuthStore.setState({ user: null, isAuthenticated: false });

    render(<GamesAndVideos />);
    fireEvent.click(screen.getByText("Create Room"));

    expect(toast.info).toHaveBeenCalledWith("Please log in to play multiplayer games.");
    expect(toast.error).not.toHaveBeenCalled();
    console.log("[TEST] Verified: login-prompt toast, not a false 'server down' message");
  });

  it("connects a signed-in user's socket with the httpOnly cookie, not a JS-readable token", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › authenticated visitor establishes a cookie-authenticated socket");
    signIn();

    render(<GamesAndVideos />);

    expect(io).toHaveBeenCalledTimes(1);
    const options = io.mock.calls[0][1];
    expect(options.withCredentials).toBe(true);
    expect(options.auth).toBeUndefined();
    console.log("[TEST] Verified: cookie-based handshake, no token in JS");
  });

  it("recovers from an expired-token handshake rejection by refreshing and reconnecting, without alerting", async () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › connect_error with expired token triggers silent refresh + reconnect");
    signIn();
    refreshTokenModule.refreshAccessToken.mockResolvedValue(true);

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
    expect(toast.error).not.toHaveBeenCalled();
    console.log("[TEST] Verified: no 'server down' toast, refresh + reconnect happened instead");
  });

  it("labels every game card as Single Player, not Multiplayer Support (none of the three games actually read the room/socket props they're passed)", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GamesAndVideos › game cards no longer falsely advertise multiplayer support");
    useAuthStore.setState({ user: null, isAuthenticated: false });

    render(<GamesAndVideos />);

    expect(screen.queryByText(/Multiplayer Support/i)).not.toBeInTheDocument();
    expect(screen.getAllByText("Single Player")).toHaveLength(3);
    console.log("[TEST] Verified: game cards read 'Single Player' instead of the inaccurate multiplayer claim");
  });
});
