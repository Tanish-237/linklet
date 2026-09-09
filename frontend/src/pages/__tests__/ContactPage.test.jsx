import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import ContactPage from "../static/ContactPage";
import { toast } from "react-toastify";

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ContactPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders contact form with clean Send Message button and form inputs", () => {
    console.log("TRACE [ContactPage.test.jsx]: Verifying form fields and submit button rendering");
    render(<ContactPage />);

    expect(screen.getByText(/How can we help you today\?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/College Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/i)).toBeInTheDocument();

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveClass("bg-violet-600");
    console.log("TRACE [ContactPage.test.jsx]: Submit button confirmed with solid bg-violet-600");
  });

  it("submits contact form successfully and shows success state", async () => {
    console.log("TRACE [ContactPage.test.jsx]: Testing contact form submission flow");
    render(<ContactPage />);

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "Alex Scholar" },
    });
    fireEvent.change(screen.getByLabelText(/College Email/i), {
      target: { value: "alex@college.edu" },
    });
    fireEvent.change(screen.getByLabelText(/Message/i), {
      target: { value: "I need help with schedule sync." },
    });

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    fireEvent.click(submitBtn);

    // Fast-forward simulated network timeout
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/Message sent successfully/i)
    );
    expect(screen.getByText(/Thank you!/i)).toBeInTheDocument();
    expect(screen.getByText(/Your message has been received/i)).toBeInTheDocument();
    console.log("TRACE [ContactPage.test.jsx]: Contact message sent and success screen verified");
  });
});
