import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, beforeEach, it, expect } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import ForgotPassword from "../ForgotPassword";
import { apiClient } from "../../api/apiClient";
import { toast } from "sonner";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../api/apiClient", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ForgotPassword Component Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = () => {
    return render(
      <HelmetProvider>
        <MemoryRouter>
          <ForgotPassword />
        </MemoryRouter>
      </HelmetProvider>
    );
  };

  it("renders step 1 email input and rejects non-mnnit email addresses", async () => {
    console.log("TRACE [ForgotPassword.test.jsx]: Testing initial render and institutional email validation");
    const user = userEvent.setup();
    renderComponent();

    const emailInput = screen.getByLabelText(/MNNIT Institutional Email/i);
    expect(emailInput).toBeInTheDocument();

    await user.type(emailInput, "student@gmail.com");
    const sendBtn = screen.getByRole("button", { name: /Send Reset Code/i });
    await user.click(sendBtn);

    expect(toast.error).toHaveBeenCalledWith("Please enter a valid @mnnit.ac.in institutional email");
    expect(apiClient.post).not.toHaveBeenCalled();

    console.log("TRACE [ForgotPassword.test.jsx]: Non-mnnit email correctly rejected");
  });

  it("sends OTP and transitions to step 2 for valid institutional email", async () => {
    console.log("TRACE [ForgotPassword.test.jsx]: Testing OTP sending and step 2 transition");
    const user = userEvent.setup();
    apiClient.post.mockResolvedValueOnce({
      data: {
        success: true,
        message: "Reset OTP sent to your email!",
      },
    });

    renderComponent();

    const emailInput = screen.getByLabelText(/MNNIT Institutional Email/i);
    await user.type(emailInput, "tanish.20231111@mnnit.ac.in");

    const sendBtn = screen.getByRole("button", { name: /Send Reset Code/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/auth/forgot-password-otp", {
        email: "tanish.20231111@mnnit.ac.in",
      });
      expect(screen.getByLabelText(/6-Digit Verification Code/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^New Password/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Confirm New Password/i)).toBeInTheDocument();
    });

    console.log("TRACE [ForgotPassword.test.jsx]: Transitioned to step 2 with OTP input fields");
  });

  it("resets password successfully and navigates to /login", async () => {
    console.log("TRACE [ForgotPassword.test.jsx]: Testing password reset submission");
    const user = userEvent.setup();
    apiClient.post
      .mockResolvedValueOnce({ data: { success: true } }) // OTP send
      .mockResolvedValueOnce({ data: { success: true } }); // Reset pass

    renderComponent();

    // Step 1
    const emailInput = screen.getByLabelText(/MNNIT Institutional Email/i);
    await user.type(emailInput, "tanish.20231111@mnnit.ac.in");
    await user.click(screen.getByRole("button", { name: /Send Reset Code/i }));

    // Step 2
    await waitFor(() => {
      expect(screen.getByLabelText(/6-Digit Verification Code/i)).toBeInTheDocument();
    });

    const otpInput = screen.getByLabelText(/6-Digit Verification Code/i);
    const newPassInput = screen.getByLabelText(/^New Password/i);
    const confirmPassInput = screen.getByLabelText(/Confirm New Password/i);

    await user.type(otpInput, "654321");
    await user.type(newPassInput, "NewPassword123!");
    await user.type(confirmPassInput, "NewPassword123!");

    const resetBtn = screen.getByRole("button", { name: /Reset Password/i });
    await user.click(resetBtn);

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith("/auth/reset-password", {
        email: "tanish.20231111@mnnit.ac.in",
        otp: "654321",
        newPassword: "NewPassword123!",
      });
      expect(toast.success).toHaveBeenCalledWith("Password reset successfully! You can now log in.");
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    console.log("TRACE [ForgotPassword.test.jsx]: Password reset successfully and navigated to /login");
  });
});
