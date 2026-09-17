import React from "react";
import { render, screen } from "@testing-library/react";
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
});
