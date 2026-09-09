import React, { useContext } from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { SocketContext, SocketProvider } from "../SocketContext";
import { io } from "socket.io-client";
import { useAuth } from "../AuthContext";

vi.mock("socket.io-client", () => ({
  io: vi.fn(),
}));

vi.mock("../AuthContext", () => ({
  useAuth: vi.fn(),
}));

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
});
