import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { describe, it, expect } from "vitest";
import TermsOfServicePage from "../static/TermsOfServicePage";

describe("TermsOfServicePage Component", () => {
  it("renders the main heading, acceptable-use rules, and links to Privacy Policy", () => {
    console.log("\n──────────────────────────────────────");
    console.log("[TEST] TermsOfServicePage › renders heading and core sections");
    const { container } = render(
      <HelmetProvider>
        <MemoryRouter>
          <TermsOfServicePage />
        </MemoryRouter>
      </HelmetProvider>
    );

    expect(
      screen.getByRole("heading", { name: "Terms of Service", level: 1 })
    ).toBeInTheDocument();

    expect(screen.getByText(/@mnnit\.ac\.in/i)).toBeInTheDocument();
    expect(screen.getByText(/Harass, bully, impersonate/i)).toBeInTheDocument();
    expect(screen.getByText(/not official institute records/i)).toBeInTheDocument();

    expect(screen.getByRole("link", { name: /Read Privacy Policy/i })).toHaveAttribute(
      "href",
      "/privacy"
    );

    const pageRoot = container.querySelector(".terms-page");
    expect(pageRoot).toBeInTheDocument();
    expect(pageRoot.className).toContain("no-scrollbar");
    console.log("[TEST] Verified TermsOfServicePage content and cross-link to Privacy Policy");
  });

  it("sets an absolute-URL og:image so shared links preview with Linklet branding", async () => {
    console.log("[TEST] TermsOfServicePage › og:image is an absolute URL");
    const { unmount } = render(
      <HelmetProvider>
        <MemoryRouter>
          <TermsOfServicePage />
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
