import React from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, beforeAll } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import LandingPage from "../LandingPage";

// Stub IntersectionObserver for jsdom
beforeAll(() => {
  globalThis.IntersectionObserver = class {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

const renderLandingPage = () =>
  render(
    <HelmetProvider>
      <BrowserRouter>
        <LandingPage />
      </BrowserRouter>
    </HelmetProvider>
  );

describe("LandingPage", () => {
  it("renders the hero headline", () => {
    console.log("[TEST] Checking hero headline renders correctly");
    renderLandingPage();
    expect(
      screen.getByText(/Everything your campus needs/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/One platform/i)).toBeInTheDocument();
  });

  it("renders the hero subtitle with real product description", () => {
    console.log("[TEST] Checking subtitle describes the real product");
    renderLandingPage();
    expect(
      screen.getByText(/manage your schedule.*track attendance/i)
    ).toBeInTheDocument();
  });

  it("renders the features section heading 'Solution to your every single problem'", () => {
    console.log("[TEST] Checking features section heading renders 'Solution to your every single problem'");
    renderLandingPage();
    expect(
      screen.getByRole("heading", {
        name: /solution to your every single problem/i,
        level: 2,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/Built for students, not startups/i)).not.toBeInTheDocument();
  });

  it("renders exactly 4 feature cards with correct titles", () => {
    console.log("[TEST] Checking 4 feature cards with real feature titles");
    renderLandingPage();
    const cards = screen.getAllByTestId("feature-card");
    expect(cards).toHaveLength(4);

    expect(screen.getByRole("heading", { name: "Campus Feed", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Help Forum", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resource Hub", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dashboard & Schedule", level: 3 })).toBeInTheDocument();
  });

  it("has CTA links pointing to /register and /login in hero", () => {
    console.log("[TEST] Checking hero CTA links point to correct auth routes");
    renderLandingPage();

    const registerLink = document.getElementById("cta-register");
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute("href", "/register");

    const loginLink = document.getElementById("cta-login");
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");
  });

  it("does NOT render pricing, testimonials, or fake content", () => {
    console.log("[TEST] Ensuring no fake/unimplemented sections exist");
    renderLandingPage();

    expect(screen.queryByText(/pricing/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/testimonials/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/success stories/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/alex johnson/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sarah chen/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/start learning now/i)).not.toBeInTheDocument();
  });

  it("renders footer with brand, copyright, and 'Made with ❤️ for MNNITians'", () => {
    console.log("[TEST] Checking footer has brand identity, copyright with current year, and 'Made with ❤️ for MNNITians' note");
    renderLandingPage();
    const footer = document.getElementById("landing-footer");
    expect(footer).toBeInTheDocument();

    const year = new Date().getFullYear().toString();
    expect(within(footer).getByText(new RegExp(`© ${year} Linklet`))).toBeInTheDocument();
    expect(within(footer).getByText(/Your campus, organized/i)).toBeInTheDocument();
    expect(within(footer).getByText(/Made with ❤️ for MNNITians/i)).toBeInTheDocument();
    expect(within(footer).queryByText("Built for students, not startups")).not.toBeInTheDocument();
  });

  it("renders the Linklet logo in footer", () => {
    console.log("[TEST] Checking footer logo renders");
    renderLandingPage();
    const footerLogo = screen.getByAltText("Linklet");
    expect(footerLogo).toBeInTheDocument();
    expect(footerLogo.tagName).toBe("IMG");
  });

  it("renders only About, Contact, and Location in the footer and excludes security, privacy, FAQ, features, feed, get started", () => {
    console.log("[TEST] Verifying footer contains ONLY About, Contact, and Location without any unnecessary links");
    renderLandingPage();

    const footer = document.getElementById("landing-footer");
    expect(footer).toBeInTheDocument();

    // Required Links: About, Contact, Location
    const aboutLink = footer.querySelector('a[href="/about"]');
    expect(aboutLink).toBeInTheDocument();
    expect(aboutLink.textContent.trim()).toBe("About");

    const contactLink = footer.querySelector('a[href="/contact"]');
    expect(contactLink).toBeInTheDocument();
    expect(contactLink.textContent.trim()).toBe("Contact");

    const locationLink = within(footer).getByRole("link", { name: /location/i });
    expect(locationLink).toBeInTheDocument();
    expect(locationLink).toHaveAttribute("href", expect.stringContaining("MNNIT"));

    // Excluded Links: security, privacy, FAQ, features, campus feed, get started
    expect(within(footer).queryByText(/security/i)).not.toBeInTheDocument();
    expect(within(footer).queryByText(/privacy/i)).not.toBeInTheDocument();
    expect(within(footer).queryByText(/faq/i)).not.toBeInTheDocument();
    expect(footer.querySelector('a[href="#landing-features"]')).not.toBeInTheDocument();
    expect(footer.querySelector('a[href="/posts"]')).not.toBeInTheDocument();
    expect(within(footer).queryByText(/get started/i)).not.toBeInTheDocument();

    console.log("[TEST] Verified footer links section has strictly About, Contact, and Location");
  });

  it("does NOT render its own navigation bar", () => {
    console.log("[TEST] Ensuring landing page relies on App-level Navbar, not its own");
    renderLandingPage();
    // The old page had nav links like Features, Testimonials, Pricing
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
