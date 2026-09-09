import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import GoogleAuthButton from "../../components/GoogleAuthButton";
import { apiClient } from "../../api/apiClient";
import useAuthStore from "../../store/useAuthStore";
import { toast } from "react-toastify";

const mockedNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockedNavigate,
}));

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("GoogleAuthButton Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, isAuthenticated: false });
  });

  it("renders Google fallback button when GSI is initializing", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GoogleAuthButton › renders fallback button with proper label");

    render(<GoogleAuthButton mode="signin" />);

    expect(screen.getByTestId("google-fallback-btn")).toBeInTheDocument();
    expect(screen.getByText("Continue with Google")).toBeInTheDocument();
    console.log("[TEST] Confirmed Google fallback button rendered");
  });

  it("renders with 'Sign up with Google' text when mode is signup", () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GoogleAuthButton › renders signup variant");

    render(<GoogleAuthButton mode="signup" />);

    expect(screen.getByText("Sign up with Google")).toBeInTheDocument();
    console.log("[TEST] Confirmed signup variant text rendered");
  });

  it("calls Google GSI initialize and renderButton when window.google is present", async () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GoogleAuthButton › initializes official GSI SDK");

    const mockInitialize = vi.fn();
    const mockRenderButton = vi.fn();

    window.google = {
      accounts: {
        id: {
          initialize: mockInitialize,
          renderButton: mockRenderButton,
          prompt: vi.fn(),
        },
      },
    };

    render(<GoogleAuthButton mode="signin" />);

    await waitFor(() => {
      expect(mockInitialize).toHaveBeenCalledWith(
        expect.objectContaining({
          client_id: expect.stringContaining("apps.googleusercontent.com"),
        })
      );
    });

    expect(mockRenderButton).toHaveBeenCalled();
    console.log("[TEST] Verified GSI initialize and renderButton called successfully");
  });

  it("handles successful Google OAuth token exchange and navigates to /home", async () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GoogleAuthButton › verifies credential callback and navigation");

    let capturedCallback = null;
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn(({ callback }) => {
            capturedCallback = callback;
          }),
          renderButton: vi.fn(),
          prompt: vi.fn(),
        },
      },
    };

    apiClient.post.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        accessToken: "test_access_token_xyz",
        user: { _id: "u_google_1", fullName: "Google Student", email: "student@mnnit.ac.in" },
      },
    });

    render(<GoogleAuthButton mode="signin" />);

    expect(capturedCallback).toBeDefined();

    // Trigger credential callback simulate GSI response
    await capturedCallback({ credential: "mock_jwt_credential_string" });

    expect(apiClient.post).toHaveBeenCalledWith("/auth/google", {
      credential: "mock_jwt_credential_string",
    });
    expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Welcome"));
    expect(mockedNavigate).toHaveBeenCalledWith("/home");
    expect(useAuthStore.getState().user?.email).toBe("student@mnnit.ac.in");
    console.log("[TEST] Confirmed full Google OAuth exchange, store hydration, and redirect");
  });

  it("displays error toast if backend rejects with non-institutional email", async () => {
    console.log("\n──────────────────────────────────────────────");
    console.log("[TEST] GoogleAuthButton › handles rejection of non-campus email");

    let capturedCallback = null;
    window.google = {
      accounts: {
        id: {
          initialize: vi.fn(({ callback }) => {
            capturedCallback = callback;
          }),
          renderButton: vi.fn(),
          prompt: vi.fn(),
        },
      },
    };

    apiClient.post.mockRejectedValueOnce({
      response: {
        data: { message: "Only @mnnit.ac.in institutional accounts are allowed" },
      },
    });

    render(<GoogleAuthButton mode="signin" />);

    await capturedCallback({ credential: "outsider_jwt" });

    expect(toast.error).toHaveBeenCalledWith(
      "Only @mnnit.ac.in institutional accounts are allowed"
    );
    expect(mockedNavigate).not.toHaveBeenCalled();
    console.log("[TEST] Confirmed error toast displayed for unauthorized email domain");
  });
});
