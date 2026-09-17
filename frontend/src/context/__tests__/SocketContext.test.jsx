import React, { useContext } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { SocketContext, SocketProvider } from "../SocketContext";
import { io } from "socket.io-client";
import { useAuth } from "../AuthContext";
import * as refreshTokenModule from "../../api/refreshToken";

vi.mock("socket.io-client", () => ({
  io: vi.fn(),
}));

vi.mock("../AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/refreshToken", async () => {
  const actual = await vi.importActual("../../api/refreshToken");
  return {
    ...actual,
    refreshAccessToken: vi.fn(),
  };
});

const TestConsumer = () => {
  const socket = useContext(SocketContext);
  return (
    <div>
      <span data-testid="socket-status">
        {socket ? "connected" : "disconnected"}
      </span>
    </div>
  );
};

describe("SocketProvider Component Tests", () => {
  const mockSocket = {
    disconnect: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    io.mockReturnValue(mockSocket);
  });

  it("initializes socket connection with credentials and token when user is logged in", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] SocketProvider › connects socket for authenticated user");

    useAuth.mockReturnValue({
      user: { _id: "user-123", username: "tester" },
    });

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    );

    expect(io).toHaveBeenCalledTimes(1);
    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        withCredentials: true,
      })
    );
    expect(screen.getByTestId("socket-status").textContent).toBe("connected");
    console.log("[TEST] Verified socket created with withCredentials: true");
  });

  it("disconnects socket and clears instance when user becomes null (logged out)", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] SocketProvider › disconnects socket when user logs out");

    let authState = { user: { _id: "user-123", username: "tester" } };
    useAuth.mockImplementation(() => authState);

    const { rerender } = render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    );

    expect(screen.getByTestId("socket-status").textContent).toBe("connected");

    // Simulate logout
    act(() => {
      authState = { user: null };
      rerender(
        <SocketProvider>
          <TestConsumer />
        </SocketProvider>
      );
    });

    expect(mockSocket.disconnect).toHaveBeenCalled();
    expect(screen.getByTestId("socket-status").textContent).toBe("disconnected");
    console.log("[TEST] Verified socket disconnect was called on logout");
  });

  it("does not reconnect or recreate socket when user profile changes with same _id", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] SocketProvider › preserves connection on user object ref change with same _id");

    let authState = { user: { _id: "user-123", username: "initial", bio: "hello" } };
    useAuth.mockImplementation(() => authState);

    const { rerender } = render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    );

    expect(io).toHaveBeenCalledTimes(1);

    // Simulate profile update (new object reference, same _id)
    act(() => {
      authState = { user: { _id: "user-123", username: "updated", bio: "new bio", avatar: "http://img.jpg" } };
      rerender(
        <SocketProvider>
          <TestConsumer />
        </SocketProvider>
      );
    });

    // Socket io should NOT have been called again and disconnect should NOT have been called
    expect(io).toHaveBeenCalledTimes(1);
    expect(mockSocket.disconnect).not.toHaveBeenCalled();
    console.log("[TEST] Verified socket remains connected without reconnection on profile update");
  });

  it("re-emits setup on both connect and reconnect socket events", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] SocketProvider › handles connect and reconnect events to emit setup");

    const events = {};
    const emitSpy = vi.fn();
    const eventSocket = {
      disconnect: vi.fn(),
      on: vi.fn((event, cb) => {
        events[event] = cb;
      }),
      emit: emitSpy,
    };
    io.mockReturnValue(eventSocket);

    useAuth.mockReturnValue({
      user: { _id: "user-reconnect-test", username: "reconnector" },
    });

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    );

    expect(events["connect"]).toBeDefined();
    expect(events["reconnect"]).toBeDefined();

    // Trigger connect
    act(() => {
      events["connect"]();
    });
    expect(emitSpy).toHaveBeenCalledWith("setup", expect.objectContaining({ _id: "user-reconnect-test" }));

    // Trigger reconnect
    act(() => {
      events["reconnect"]();
    });
    expect(emitSpy).toHaveBeenCalledTimes(2);
    console.log("[TEST] Verified setup was emitted on both connect and reconnect events");
  });

  it("reads the token fresh on every connection attempt via an auth function, not a static object", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] SocketProvider › auth option is a function so a refreshed token is picked up on reconnect");

    useAuth.mockReturnValue({
      user: { _id: "user-123", username: "tester" },
    });

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    );

    const authOption = io.mock.calls[0][1].auth;
    expect(typeof authOption).toBe("function");
    console.log("[TEST] Verified auth is a callback, avoiding the stale-token-after-refresh bug");
  });

  it("recovers from an expired-token handshake rejection by refreshing and forcing a reconnect", async () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] SocketProvider › connect_error with expired token triggers refresh + reconnect");

    refreshTokenModule.refreshAccessToken.mockResolvedValue("fresh-jwt-token");

    const connectMock = vi.fn();
    const handlers = {};
    const eventSocket = {
      disconnect: vi.fn(),
      connect: connectMock,
      on: vi.fn((event, cb) => { handlers[event] = cb; }),
      emit: vi.fn(),
    };
    io.mockReturnValue(eventSocket);

    useAuth.mockReturnValue({
      user: { _id: "user-expired-token", username: "tester" },
    });

    render(
      <SocketProvider>
        <TestConsumer />
      </SocketProvider>
    );

    await act(async () => {
      await handlers["connect_error"]({ message: "Session expired" });
    });

    expect(refreshTokenModule.refreshAccessToken).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
    console.log("[TEST] Verified: expired-token handshake rejection triggers a silent refresh + reconnect");
  });
});
