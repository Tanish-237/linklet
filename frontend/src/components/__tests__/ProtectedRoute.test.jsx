import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ProtectedRoute from "../ProtectedRoute";
import useAuthStore from "../../store/useAuthStore";

// Mock useAuthStore
vi.mock("../../store/useAuthStore", () => ({
  default: vi.fn(),
}));

describe("ProtectedRoute Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders loading screen when isLoading is true", () => {
    console.log("TRACE [ProtectedRoute.test.jsx]: Testing loading state");
    useAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: true,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    console.log("TRACE [ProtectedRoute.test.jsx]: Confirmed loading screen rendered while auth is checking");
  });

  it("redirects unauthenticated user to /login and denies access to protected content", () => {
    console.log("TRACE [ProtectedRoute.test.jsx]: Testing redirect to /login when unauthenticated");
    useAuthStore.mockReturnValue({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Protected Dashboard Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Dashboard Content")).not.toBeInTheDocument();
    console.log("TRACE [ProtectedRoute.test.jsx]: Confirmed unauthenticated user redirected to /login");
  });

  it("renders protected content when user is authenticated", () => {
    console.log("TRACE [ProtectedRoute.test.jsx]: Testing rendering for authenticated user");
    useAuthStore.mockReturnValue({
      user: { _id: "u1", name: "Alice", role: "student" },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <ProtectedRoute>
          <div>Protected Dashboard Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText("Protected Dashboard Content")).toBeInTheDocument();
    console.log("TRACE [ProtectedRoute.test.jsx]: Confirmed authenticated user accessed protected content");
  });

  it("redirects authenticated user to /home if role does not match allowedRoles", () => {
    console.log("TRACE [ProtectedRoute.test.jsx]: Testing role check redirect when role doesn't match");
    useAuthStore.mockReturnValue({
      user: { _id: "u1", name: "Alice", role: "student" },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/admin"]}>
        <Routes>
          <Route path="/home" element={<div>Home Page</div>} />
          <Route
            path="/dashboard/admin"
            element={
              <ProtectedRoute allowedRoles={["admin"]}>
                <div>Admin Only Content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Home Page")).toBeInTheDocument();
    expect(screen.queryByText("Admin Only Content")).not.toBeInTheDocument();
    console.log("TRACE [ProtectedRoute.test.jsx]: Confirmed student redirected away from admin dashboard to /home");
  });

  it("renders protected content when user role matches allowedRoles", () => {
    console.log("TRACE [ProtectedRoute.test.jsx]: Testing role check pass when role matches");
    useAuthStore.mockReturnValue({
      user: { _id: "u2", name: "Bob", role: "admin" },
      isAuthenticated: true,
      isLoading: false,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/admin"]}>
        <ProtectedRoute allowedRoles={["admin"]}>
          <div>Admin Only Content</div>
        </ProtectedRoute>
      </MemoryRouter>
    );

    expect(screen.getByText("Admin Only Content")).toBeInTheDocument();
    console.log("TRACE [ProtectedRoute.test.jsx]: Confirmed admin accessed admin content");
  });
});
