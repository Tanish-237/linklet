import React from "react";
import { render, screen } from "@testing-library/react";
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
});
