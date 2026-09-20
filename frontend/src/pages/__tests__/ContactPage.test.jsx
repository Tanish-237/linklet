import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { HelmetProvider } from "react-helmet-async";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ContactPage from "../static/ContactPage";
import { toast } from "react-toastify";

const renderContactPage = () => render(<ContactPage />, { wrapper: HelmetProvider });

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../api/apiClient.js", () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

import { apiClient } from "../../api/apiClient.js";

describe("ContactPage Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders contact form with clean Send Message button and form inputs without scrollbar", () => {
    console.log("TRACE [ContactPage.test.jsx]: Verifying form fields, submit button, and scrollbar suppression");
    const { container } = renderContactPage();

    expect(screen.getByText(/How can we help you today\?/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Your Email/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/you@example.com/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Message/i)).toBeInTheDocument();

    // Verify emails are removed from contact cards
    expect(screen.queryByText(/support@linklet.mnnit.ac.in/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/resources@linklet.mnnit.ac.in/i)).not.toBeInTheDocument();
    console.log("TRACE [ContactPage.test.jsx]: Confirmed direct email addresses are removed from contact cards");

    const pageRoot = container.querySelector(".contact-page");
    expect(pageRoot).toBeInTheDocument();
    expect(pageRoot.className).toContain("no-scrollbar");

    // Verify contributor option in category select and sidebar
    expect(screen.getByRole("option", { name: /Contribute to Linklet/i })).toBeInTheDocument();
    expect(screen.getByText(/Contributors Welcome/i)).toBeInTheDocument();
    console.log("TRACE [ContactPage.test.jsx]: Confirmed contributor option in dropdown and guidelines sidebar");

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    expect(submitBtn).toBeInTheDocument();
    expect(submitBtn).toHaveClass("bg-violet-600");
    console.log("TRACE [ContactPage.test.jsx]: Submit button confirmed with solid bg-violet-600 and no-scrollbar verified");
  });

  it("submits contact form successfully with contributor category and dispatches via apiClient.post", async () => {
    console.log("TRACE [ContactPage.test.jsx]: Testing contact form submission flow with contributor category");
    apiClient.post.mockResolvedValueOnce({
      data: {
        success: true,
        message: "Your message has been sent successfully! Our team will get back to you shortly.",
      },
    });

    renderContactPage();

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "Alex Scholar" },
    });
    fireEvent.change(screen.getByLabelText(/Your Email/i), {
      target: { value: "alex@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText(/Category/i), {
      target: { value: "Contribute to Linklet" },
    });
    fireEvent.change(screen.getByLabelText(/Subject/i), {
      target: { value: "Interested in Frontend Engineering" },
    });
    fireEvent.change(screen.getByLabelText(/Message/i), {
      target: { value: "I would love to contribute React components and UI features." },
    });

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(apiClient.post).toHaveBeenCalledWith("/contact", {
      name: "Alex Scholar",
      email: "alex@gmail.com",
      category: "Contribute to Linklet",
      subject: "Interested in Frontend Engineering",
      message: "I would love to contribute React components and UI features.",
    });

    expect(toast.success).toHaveBeenCalledWith(
      expect.stringMatching(/sent successfully/i)
    );
    expect(screen.getByText(/Thank you!/i)).toBeInTheDocument();
    expect(screen.getByText(/Your message has been received/i)).toBeInTheDocument();
    console.log("TRACE [ContactPage.test.jsx]: Contributor contact message sent via apiClient and success screen verified");
  });

  it("handles API error and displays toast error message", async () => {
    console.log("TRACE [ContactPage.test.jsx]: Testing API error handling in contact form");
    apiClient.post.mockRejectedValueOnce({
      response: {
        data: {
          message: "Too many contact requests from this IP. Please try again later.",
        },
      },
    });

    renderContactPage();

    fireEvent.change(screen.getByLabelText(/Your Name/i), {
      target: { value: "Alex Scholar" },
    });
    fireEvent.change(screen.getByLabelText(/Your Email/i), {
      target: { value: "alex@gmail.com" },
    });
    fireEvent.change(screen.getByLabelText(/Message/i), {
      target: { value: "Rate limit test message" },
    });

    const submitBtn = screen.getByRole("button", { name: /Send Message/i });
    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Too many contact requests from this IP. Please try again later."
    );
    expect(screen.queryByText(/Thank you!/i)).not.toBeInTheDocument();
    console.log("TRACE [ContactPage.test.jsx]: API error handled properly with toast notification");
  });

  it("sets a page-specific title and absolute-URL Open Graph tags for link previews", async () => {
    console.log("TRACE [ContactPage.test.jsx]: Verifying Helmet injects OG meta so shared links preview correctly");
    const { unmount } = renderContactPage();

    // See AboutPage.test.jsx: the whole assertion block must be inside
    // waitFor since react-helmet-async commits to document.head asynchronously.
    await waitFor(() => {
      expect(document.title).toContain("Contact Linklet");
      expect(
        document.head.querySelector('meta[property="og:url"]')?.getAttribute("content")
      ).toBe("https://linklet.org/contact");
      expect(
        document.head.querySelector('meta[property="og:image"]')?.getAttribute("content")
      ).toBe("https://linklet.org/og-image.jpg");
    });
    console.log("TRACE [ContactPage.test.jsx]: Confirmed og:url/og:image are present with absolute URLs");

    // Unmount so Helmet's cleanup removes these tags before another test
    // file's document.head assertions run.
    unmount();
  });
});
