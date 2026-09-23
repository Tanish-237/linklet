import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import Login from "../Login";

vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({
    fetchUser: vi.fn(),
    setUser: vi.fn(),
  }),
}));

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

const renderComponent = () =>
  render(
    <HelmetProvider>
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    </HelmetProvider>
  );

describe("Login Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password inputs without a remember me checkbox", () => {
    console.log("TRACE [Login.test.jsx]: Testing initial render — no remember me checkbox");
    renderComponent();

    expect(screen.getByLabelText(/^Email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Remember me/i)).not.toBeInTheDocument();

    console.log("TRACE [Login.test.jsx]: Confirmed remember me checkbox is absent");
  });

  it("password field defaults to type=password and eye toggle switches to type=text", async () => {
    console.log("TRACE [Login.test.jsx]: Testing password visibility toggle");
    const user = userEvent.setup();
    renderComponent();

    const passwordInput = screen.getByLabelText(/^Password$/i);
    expect(passwordInput).toHaveAttribute("type", "password");
    console.log("TRACE [Login.test.jsx]: Password input initially type=password");

    const toggleBtn = screen.getByRole("button", { name: /Toggle password visibility/i });
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute("type", "text");
    console.log("TRACE [Login.test.jsx]: Password input switched to type=text after toggle");

    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "password");
    console.log("TRACE [Login.test.jsx]: Password input switched back to type=password");
  });

  it("renders forgot password link", () => {
    console.log("TRACE [Login.test.jsx]: Testing forgot password link presence");
    renderComponent();

    const forgotLink = screen.getByRole("link", { name: /Forgot password\?/i });
    expect(forgotLink).toBeInTheDocument();
    expect(forgotLink).toHaveAttribute("href", "/forgot-password");
    console.log("TRACE [Login.test.jsx]: Forgot password link is present and href is correct");
  });
});
