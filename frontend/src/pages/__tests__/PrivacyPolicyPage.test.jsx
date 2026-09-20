import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { describe, it, expect } from "vitest";
import PrivacyPolicyPage from "../static/PrivacyPolicyPage";

describe("PrivacyPolicyPage Component", () => {
  it("renders the main heading, key sections, and links to Terms of Service", () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] PrivacyPolicyPage › renders heading and core sections");
    const { container } = render(
      <HelmetProvider>
        <MemoryRouter>
          <PrivacyPolicyPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(
      screen.getByRole("heading", { name: "Privacy Policy", level: 1 })
    ).toBeInTheDocument();

    // Grounds the policy in what the app actually does, not generic filler —
    // regressing this text silently would mean the policy no longer matches
    // the real data flows (Cloudinary, Brevo, Gemini, institutional email).
    expect(screen.getByText(/@mnnit\.ac\.in/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloudinary/i)).toBeInTheDocument();
    expect(screen.getByText(/Gemini/i)).toBeInTheDocument();
    expect(screen.getByText(/do not sell, rent, or share/i)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Read Terms of Service/i })).toHaveAttribute(
      "href",
      "/terms"
    );

    const pageRoot = container.querySelector(".privacy-page");
    expect(pageRoot).toBeInTheDocument();
    expect(pageRoot.className).toContain("no-scrollbar");
    console.log("[TEST] Verified PrivacyPolicyPage content and cross-link to Terms of Service");
  });

  it("sets an absolute-URL og:image so shared links preview with Linklet branding", async () => {
    console.log("[TEST] PrivacyPolicyPage › og:image is an absolute URL");
    const { unmount } = render(
      <HelmetProvider>
        <MemoryRouter>
          <PrivacyPolicyPage />
        </MemoryRouter>
      </HelmetProvider>
    );

    // See AboutPage.test.jsx: react-helmet-async commits to document.head
    // asynchronously, so the assertion must be inside waitFor.
    await waitFor(() => {
      expect(
        document.head.querySelector('meta[property="og:image"]')?.getAttribute("content")
      ).toBe("https://linklet.org/og-image.jpg");
    });

    unmount();
  });
});
