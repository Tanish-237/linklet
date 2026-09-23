import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";

import { Navbar } from "../src/components/Navbar";
import LandingPage from "../src/pages/LandingPage";
import AboutPage from "../src/pages/static/AboutPage";
import ContactPage from "../src/pages/static/ContactPage";
import PrivacyPolicyPage from "../src/pages/static/PrivacyPolicyPage";
import TermsOfServicePage from "../src/pages/static/TermsOfServicePage";
import PostsSeoShell from "../src/pages/static/PostsSeoShell";

// Only genuinely static, public marketing/legal pages go here — no
// SocketContext/React Query needed. The public Navbar is included for the
// pages that render it in App.jsx: at build time the auth store is empty, so
// it renders its logged-out state, which is exactly what a first-time visitor
// sees — the client's first render then matches this HTML instead of pushing
// the page down by a navbar's height when it mounts.
const PAGES = {
  "/": LandingPage,
  "/about": AboutPage,
  "/contact": ContactPage,
  "/privacy": PrivacyPolicyPage,
  "/terms": TermsOfServicePage,
  // Title/description/canonical only — the feed itself is client-rendered.
  "/posts": PostsSeoShell,
};

const WITH_NAVBAR = new Set(["/", "/about", "/contact", "/privacy", "/terms"]);

export const STATIC_ROUTES = Object.keys(PAGES);

export const renderPage = (path) => {
  const Page = PAGES[path];
  if (!Page) {
    throw new Error(`No prerenderable page registered for path "${path}"`);
  }

  const helmetContext = {};
  const html = renderToStaticMarkup(
    <HelmetProvider context={helmetContext}>
      <StaticRouter location={path}>
        {WITH_NAVBAR.has(path) && <Navbar />}
        <Page />
      </StaticRouter>
    </HelmetProvider>
  );

  return { html, helmet: helmetContext.helmet };
};
