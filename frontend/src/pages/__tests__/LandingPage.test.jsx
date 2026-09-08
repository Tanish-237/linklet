import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeAll } from "vitest";
import { BrowserRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import LandingPage from "../LandingPage";

// Stub IntersectionObserver for jsdom
beforeAll(() => {
  global.IntersectionObserver = class {
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

  it("renders exactly 4 feature cards with correct titles", () => {
    console.log("[TEST] Checking 4 feature cards with real feature titles");
    renderLandingPage();
    const cards = screen.getAllByTestId("feature-card");
    expect(cards).toHaveLength(4);

    expect(screen.getByText("Campus Feed")).toBeInTheDocument();
    expect(screen.getByText("Help Forum")).toBeInTheDocument();
    expect(screen.getByText("Resource Hub")).toBeInTheDocument();
    expect(screen.getByText("Dashboard & Schedule")).toBeInTheDocument();
  });

  it("has CTA links pointing to /register and /login", () => {
    console.log("[TEST] Checking CTA links point to correct auth routes");
    renderLandingPage();

    const registerLink = screen.getByRole("link", { name: /get started/i });
    expect(registerLink).toHaveAttribute("href", "/register");

    const loginLink = screen.getByRole("link", { name: /log in/i });
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

  it("renders footer with copyright and current year", () => {
    console.log("[TEST] Checking footer has copyright with current year");
    renderLandingPage();
    const year = new Date().getFullYear().toString();
    expect(screen.getByText(new RegExp(`© ${year} Linklet`))).toBeInTheDocument();
  });

  it("renders the Linklet logo in footer", () => {
    console.log("[TEST] Checking footer logo renders");
    renderLandingPage();
    const footerLogo = screen.getByAltText("Linklet");
    expect(footerLogo).toBeInTheDocument();
    expect(footerLogo.tagName).toBe("IMG");
  });

  it("does NOT render its own navigation bar", () => {
    console.log("[TEST] Ensuring landing page relies on App-level Navbar, not its own");
    renderLandingPage();
    // The old page had nav links like Features, Testimonials, Pricing
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });
});
